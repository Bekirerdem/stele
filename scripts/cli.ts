// The Stele CLI: ask a question, answer it, read and check it.
//   npm run stele -- <command> [options]          (MIDNIGHT_NETWORK=local|preview|preprod)
//
// Asker:
//   asker keygen [--force]          make .stele/asker.json (contract secret, moderator secret, X25519 pair)
//   ask --rules rules.json --label <id>
//                                   deploy one question; the rules document is hashed into the contract
//   add-asker-key                   publish the X25519 key answers are sealed to (asker_only questions)
//   enrol <memberKey…> | --roster roster.json
//   open [--days 7 | --minutes 30]  freeze the member list and open answering
//   remove <nullifier> --reason insult|threat|doxxing|hate|spam
//   read                            open every answer you may read (after the question closes)
// Member:
//   member keygen [--force]         make .stele/member.json and print the key to send the asker
//   member key                      print your member key again
//   answer [--text "..."] [--no-shield] [--yes]
//                                   write an answer; the shield (NEAR AI private inference) lists what
//                                   could identify you, you choose what to generalize, then it is
//                                   sealed, stored and submitted. Answer again to replace it.
// Anyone:
//   close                           close answering once the deadline has passed
//   status                          phase, deadline, members, answers, removals
//   verify [--rules rules.json]     the mirror: rules hash, stored blobs vs on-chain digests, counts
//
// Options: --contract <address> (default: deployments/<network>.json), --wallet <ROLE>
// (fee wallet; default ALICE). STELE_KEYS_DIR picks another key directory, to act as several
// people on one machine. STELE_RELAY_URL stores answers on the relay instead of locally.
// NEARAI_API_KEY enables the shield.
//
// SPDX-License-Identifier: MIT

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadEnv } from 'vite';
import { WebSocket } from 'ws';
import pino from 'pino';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { CompiledSteleContract, ledger, Phase, Visibility, zkConfigPath, type Ledger } from '../contract/index.js';
import { createStelePrivateState, type StelePrivateState } from '../contract/witnesses.js';
import {
  answerNullifier,
  digestOf,
  keyFingerprint,
  memberKey,
  moderatorKey,
  openBlob,
  plainBlob,
  questionIdFromLabel,
  questionInstance,
  questionLabel,
  rulesHash,
  sealedBlob,
  validateRules,
  type AnswerBody,
  type Rules,
} from '../src/crypto.js';
import { createAskerKeys, createMemberKeys, keysDir, readAskerKeys, readMemberKeys, steleDir } from '../src/keys.js';
import { readDeployments, writeDeployment } from '../src/deployments.js';
import { buildProviders, ledgerState, type SteleCircuits, type SteleProviders } from '../src/providers.js';
import { MidnightWalletProvider, resolveWallet, syncWallet, waitForDust, waitForNightThenDust } from '../src/wallet.js';
import { blobStore } from '../src/store.js';
import { applyDecisions, checkFinal, type Decision, type Flag } from '../src/shield-core.js';
import { createShield } from '../src/shield.js';

// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

const MINUTE = 60;
const DAY = 24 * 3600;
const REASONS: Record<string, bigint> = { insult: 1n, threat: 2n, doxxing: 3n, hate: 4n, spam: 5n };
const REASON_NAMES = Object.fromEntries(Object.entries(REASONS).map(([k, v]) => [v.toString(), k]));
const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'warn', transport: { target: 'pino-pretty' } });

const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';
const isRemote = network !== 'local';
if (isRemote) {
  const dir = fileURLToPath(new URL('../', import.meta.url));
  for (const [k, v] of Object.entries(loadEnv(network, dir, ''))) if (process.env[k] === undefined) process.env[k] = v;
}

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    contract: { type: 'string' },
    wallet: { type: 'string', default: 'ALICE' },
    rules: { type: 'string' },
    label: { type: 'string' },
    roster: { type: 'string' },
    days: { type: 'string' },
    minutes: { type: 'string' },
    reason: { type: 'string' },
    text: { type: 'string' },
    'no-shield': { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

const die = (msg: string): never => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

const config = (await import('../src/config.js')).getConfig();
const store = blobStore(network);

function contractAddress(): string {
  if (opts.contract) return opts.contract;
  const address = readDeployments(network)?.contracts['stele']?.address;
  return address ?? die(`No question in deployments/${network}.json. Ask one, or pass --contract <address>.`);
}

async function readLedger(address = contractAddress()): Promise<Ledger> {
  const pdp = indexerPublicDataProvider(config.indexer, config.indexerWS);
  return ledger(ledgerState(await pdp.queryContractState(address)));
}

const rulesFile = (address: string) => path.join(steleDir(), 'questions', `${address}.rules.json`);
const readRules = (address: string): Rules | undefined => {
  const f = opts.rules ?? rulesFile(address);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Rules) : undefined;
};

type Session = { providers: SteleProviders; wallet: MidnightWalletProvider; stop: () => Promise<void> };

async function session(): Promise<Session> {
  const envConfig: EnvironmentConfiguration = { walletNetworkId: config.networkId, ...config };
  const setup = resolveWallet(network, opts.wallet);
  const wallet = await MidnightWalletProvider.build(logger, envConfig, setup.secret);
  await wallet.start();
  const timeout = Number(process.env['MIDNIGHT_SYNC_TIMEOUT_MS'] ?? (isRemote ? 120 : 10) * 60_000);
  console.log(`… syncing the ${setup.role} fee wallet on ${network}`);
  await syncWallet(logger, wallet.wallet, timeout);
  if (isRemote) {
    await waitForNightThenDust(logger, wallet.wallet, wallet.unshieldedKeystore, envConfig, config.faucet, { label: setup.role });
  } else {
    await waitForDust(logger, wallet.wallet, 1, timeout, config.indexer);
  }
  // In memory: each call sets the private state it needs, and nothing
  // outlives this process, so identities sharing a fee wallet never share a secret.
  const providers = buildProviders(wallet, zkConfigPath, config, 'memory');
  return { providers, wallet, stop: () => wallet.stop() };
}

async function call(s: Session, address: string, who: StelePrivateState, circuitId: SteleCircuits, args: unknown[]) {
  const id = 'SteleCliState';
  await s.providers.privateStateProvider.forContract(address).set(id, who);
  console.log(`… ${circuitId}: proving and submitting`);
  const tx = await submitCallTx(s.providers, {
    compiledContract: CompiledSteleContract,
    contractAddress: address,
    privateStateId: id,
    circuitId,
    args,
  } as never);
  console.log(`✔ ${circuitId} in block ${tx.public.blockHeight} (tx ${tx.public.txId})`);
}

async function withSession(fn: (s: Session, address: string) => Promise<void>, address = contractAddress()): Promise<void> {
  const s = await session();
  try {
    await fn(s, address);
  } finally {
    await s.stop().catch(() => undefined);
  }
}

/** The latest block's time in Unix seconds: the clock the contract's deadline checks use. */
async function chainNow(): Promise<number> {
  try {
    const res = await fetch(config.indexer, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ block { timestamp } }' }),
    });
    const ts = ((await res.json()) as { data?: { block?: { timestamp?: unknown } } }).data?.block?.timestamp;
    if (typeof ts === 'number') return Math.floor(ts / 1000);
  } catch {
    // fall through
  }
  console.warn("! Couldn't read the latest block time; using this machine's clock.");
  return Math.floor(Date.now() / 1000);
}

const iso = (secs: bigint) => new Date(Number(secs) * 1000).toISOString();
const phaseName = (p: Phase) => (p === Phase.ENROLMENT ? 'enrolment' : p === Phase.OPEN ? 'open' : 'closed');

// Opened only when a question must actually be asked: a readline on a closed
// stdin ends the process before pending work (the shield's requests) finishes.
let rlInstance: readline.Interface | undefined;
const rl = () => (rlInstance ??= readline.createInterface({ input: process.stdin, output: process.stdout }));

async function prompt(_unused: unknown, q: string): Promise<string> {
  return (await rl().question(q)).trim();
}

/** Runs the shield and lets the writer decide, flag by flag. */
async function shieldDraft(draft: string, _unused?: unknown): Promise<string> {
  const apiKey = process.env['NEARAI_API_KEY'];
  if (!apiKey) {
    console.warn('! NEARAI_API_KEY is not set: sending without the shield. Re-read your answer for names, dates and roles.');
    return draft;
  }
  const shield = createShield({ apiKey, model: process.env['STELE_SHIELD_MODEL'] });
  console.log(`… shield: checking your answer inside a NEAR AI enclave (${shield.model})`);
  const { value: flags, receipt } = await shield.inspect(draft);
  console.log(`  enclave signature verified (${receipt.verified}), ${receipt.seconds}s`);
  if (flags.length === 0) console.log('  Nothing in your answer points to you.');
  const decisions: Decision[] = [];
  for (const [i, f] of flags.entries()) {
    console.log(`\n  ${i + 1}/${flags.length} [${f.type}] "${f.text}"`);
    console.log(`     ${f.why}`);
    console.log(`     instead: ${f.suggestion ? `"${f.suggestion}"` : '(leave it out)'}`);
    const a = opts.yes ? 'g' : (await prompt(null, '     [g]eneralize / [k]eep? (g) ')).toLowerCase();
    decisions.push(a.startsWith('k') ? 'keep' : 'generalize');
  }
  const applied = applyDecisions(draft, flags, decisions);
  const keep = flags.filter((_, i) => decisions[i] === 'keep').map((f: Flag) => f.text);
  const { value: plain } = await shield.normalize(applied, keep);
  let final = plain;
  let check = checkFinal(final, flags, decisions);
  if (!check.ok) {
    console.warn(`! The style pass brought back ${check.leaked.map((f) => `"${f.text}"`).join(', ')}; using your choices without it.`);
    final = applied;
    check = checkFinal(final, flags, decisions);
    if (!check.ok) die('Could not remove the parts you chose to generalize. Nothing was sent.');
  }
  for (const f of check.lost) console.warn(`! "${f.text}" (which you chose to keep) is no longer in the text.`);
  return final;
}

const commands: Record<string, () => Promise<void>> = {
  async 'asker keygen'() {
    const { keys, file } = createAskerKeys(opts.force);
    console.log(`✔ Wrote ${file}. Back it up: without it you can't run or read this question.`);
    console.log(`  Answer sealing key (published by add-asker-key): ${keyFingerprint(keys.encPublicKey)}`);
  },

  async 'member keygen'() {
    const { keys, file } = createMemberKeys(opts.force);
    console.log(`✔ Wrote ${file}. Back it up: it is the only way to answer.`);
    console.log(`  Your member key (send this to the asker): ${toHex(memberKey(keys.secretKey))}`);
  },

  async 'member key'() {
    console.log(toHex(memberKey(readMemberKeys().secretKey)));
  },

  async ask() {
    if (!opts.rules || !opts.label) die('ask needs --rules rules.json and --label <id>');
    const rules = validateRules(JSON.parse(fs.readFileSync(opts.rules!, 'utf8')) as Rules);
    const asker = readAskerKeys();
    const qid = questionIdFromLabel(opts.label!);
    const vis = rules.visibility === 'public' ? Visibility.PUBLIC : Visibility.ASKER_ONLY;
    const s = await session();
    try {
      console.log(`… deploying "${rules.title}" (${opts.label})`);
      const deployed = await deployContract(s.providers, {
        compiledContract: CompiledSteleContract,
        args: [qid, rulesHash(rules), vis, BigInt(rules.minAnswers), moderatorKey(asker.moderatorSecretKey)],
        privateStateId: 'SteleAsker',
        initialPrivateState: createStelePrivateState(asker.secretKey),
      } as never);
      const tx = (deployed as unknown as { deployTxData: { public: unknown } }).deployTxData.public as {
        contractAddress: string;
        txId: string;
        txHash: string;
        blockHeight: number;
        blockHash: string;
      };
      writeDeployment(network, config.networkId, 'stele', {
        address: tx.contractAddress,
        txId: tx.txId,
        txHash: tx.txHash,
        blockHeight: tx.blockHeight,
        blockHash: tx.blockHash,
        deployer: String(s.wallet.unshieldedKeystore.getBech32Address()),
        deployedAt: new Date().toISOString(),
      });
      fs.mkdirSync(path.dirname(rulesFile(tx.contractAddress)), { recursive: true });
      fs.writeFileSync(rulesFile(tx.contractAddress), `${JSON.stringify(rules, null, 2)}\n`);
      console.log(`✔ Question deployed at ${tx.contractAddress} (block ${tx.blockHeight})`);
      console.log(`  Rules hash ${toHex(rulesHash(rules))}: publish rules.json next to the address.`);
      console.log(`Next: ${vis === Visibility.ASKER_ONLY ? 'add-asker-key, then ' : ''}enrol the members.`);
    } finally {
      await s.stop().catch(() => undefined);
    }
  },

  async 'add-asker-key'() {
    const asker = readAskerKeys();
    const l = await readLedger();
    if (l.askerEncKeys.member(asker.encPublicKey)) die('That key is already published');
    await withSession((s, a) => call(s, a, createStelePrivateState(asker.secretKey), 'addAskerKey', [asker.encPublicKey]));
  },

  async enrol() {
    const asker = readAskerKeys();
    let keys = positionals.slice(1);
    if (opts.roster) {
      const roster = JSON.parse(fs.readFileSync(opts.roster, 'utf8')) as { key: string }[];
      keys = keys.concat(roster.map((r) => r.key));
    }
    if (keys.length === 0) die('enrol needs member keys, or --roster roster.json');
    const before = await readLedger();
    const todo = keys.map(fromHex).filter((k) => {
      if (k.length !== 32) die(`Not a 32-byte member key: ${toHex(k)}`);
      return !before.memberKeys.member(k);
    });
    if (todo.length < keys.length) console.log(`  ${keys.length - todo.length} already enrolled; skipping them`);
    await withSession(async (s, a) => {
      for (const k of todo) await call(s, a, createStelePrivateState(asker.secretKey), 'enrol', [k]);
    });
    console.log(`✔ ${(await readLedger()).enrolled} members enrolled.`);
  },

  async open() {
    const asker = readAskerKeys();
    const t = await chainNow();
    const deadline = t + (opts.minutes ? Math.round(Number(opts.minutes) * MINUTE) : Math.round(Number(opts.days ?? '7') * DAY));
    if (!Number.isFinite(deadline) || deadline <= t) die('The deadline must be in the future');
    await withSession((s, a) => call(s, a, createStelePrivateState(asker.secretKey), 'open', [BigInt(deadline)]));
    console.log(`✔ Answering is open until ${iso(BigInt(deadline))}.`);
  },

  async answer() {
    const member = readMemberKeys();
    const address = contractAddress();
    const l = await readLedger(address);
    const q = questionInstance(l.questionId, address);
    if (l.phase !== Phase.OPEN || BigInt(await chainNow()) >= l.deadline) die('Answering is not open');
    if (!l.memberKeys.member(memberKey(member.secretKey))) die('Your member key is not enrolled in this question');
    const rules = readRules(address);
    const prompts = rules?.prompts ?? ['Your answer'];
    const answers: string[] = [];
    try {
      for (const [i, p] of prompts.entries()) {
        console.log(`\n${i + 1}. ${p}`);
        const draft = i === 0 && opts.text ? opts.text : await prompt(null, '> ');
        if (!draft) die('An empty answer was not sent');
        const final = opts['no-shield'] ? draft : await shieldDraft(draft);
        console.log(`\n  This is what will be sent:\n  ${final}\n`);
        answers.push(final);
      }
      if (!opts.yes && !(await prompt(null, 'Send it? [y/N] ')).toLowerCase().startsWith('y')) die('Not sent.');
    } finally {
      rlInstance?.close();
    }
    const body: AnswerBody = { v: 1, answers };
    const blob = l.visibility === Visibility.PUBLIC ? plainBlob(body) : sealedBlob(body, [...l.askerEncKeys], q);
    const digest = digestOf(blob);
    await store.put(address, blob);
    const revising = l.answers.member(answerNullifier(member.secretKey, q));
    await withSession((s, a) => call(s, a, createStelePrivateState(member.secretKey), 'answer', [digest]), address);
    console.log(`✔ ${revising ? 'Your answer was replaced' : 'Answered'}. Only your last answer counts; you can change it until the deadline.`);
  },

  async close() {
    const l = await readLedger();
    if (BigInt(await chainNow()) < l.deadline) die(`Answering is open until ${iso(l.deadline)}`);
    await withSession((s, a) => call(s, a, createStelePrivateState(new Uint8Array(32)), 'close', []));
  },

  async remove() {
    const asker = readAskerKeys();
    const n = positionals[1] ?? die('remove needs the answer nullifier (see status)');
    const reason = REASONS[(opts.reason ?? '').toLowerCase()] ?? die(`--reason must be one of ${Object.keys(REASONS).join(', ')}`);
    await withSession((s, a) => call(s, a, createStelePrivateState(asker.moderatorSecretKey), 'remove', [fromHex(n), reason]));
    console.log('✔ Removed. The mark and the reason stay visible to everyone.');
  },

  async read() {
    const address = contractAddress();
    const l = await readLedger(address);
    if (l.phase !== Phase.CLOSED) die('Answers open once the question is closed');
    if (l.answerCount < BigInt(l.minAnswers))
      die(`Only ${l.answerCount} answers, below the minimum of ${l.minAnswers}: they stay unopened to protect who wrote them`);
    const q = questionInstance(l.questionId, address);
    const secret = l.visibility === Visibility.ASKER_ONLY ? readAskerKeys().encSecretKey : undefined;
    const prompts = readRules(address)?.prompts ?? [];
    let i = 0;
    for (const [n, d] of l.answers) {
      i++;
      const mark = l.removed.member(n) ? ` (removed: ${REASON_NAMES[l.removed.lookup(n).toString()] ?? 'other'})` : '';
      const blob = await store.get(address, toHex(d));
      if (!blob) {
        console.log(`\n#${i}${mark}: blob ${toHex(d).slice(0, 16)}… is missing from ${store.where}`);
        continue;
      }
      const body = openBlob(blob, q, secret);
      console.log(`\n#${i}${mark}  (answer id ${toHex(n)})`);
      body.answers.forEach((a, k) => console.log(`  ${prompts[k] ? `${prompts[k]}\n  ` : ''}> ${l.removed.member(n) ? '[removed]' : a}`));
    }
  },

  async status() {
    const address = contractAddress();
    const l = await readLedger(address);
    console.log(`Question:   ${questionLabel(l.questionId)}  (${address})`);
    console.log(`Phase:      ${phaseName(l.phase)}${l.phase !== Phase.ENROLMENT ? `, deadline ${iso(l.deadline)}` : ''}`);
    console.log(`Visibility: ${l.visibility === Visibility.PUBLIC ? 'public' : 'asker only'}`);
    console.log(`Minimum:    ${l.minAnswers} answers before any is opened`);
    console.log(`Members:    ${l.enrolled}`);
    console.log(`Answered:   ${l.answerCount} (${l.submissions} submissions, revisions included)`);
    console.log(`Removed:    ${l.removed.size()} marked now, ${l.removedTotal} ever`);
    for (const [n] of l.answers)
      console.log(`  ${toHex(n)}${l.removed.member(n) ? `  removed: ${REASON_NAMES[l.removed.lookup(n).toString()] ?? 'other'}` : ''}`);
  },

  async verify() {
    const address = contractAddress();
    const l = await readLedger(address);
    let ok = true;
    const rules = readRules(address);
    if (!rules) {
      console.log('? No rules document to compare (pass --rules rules.json).');
    } else {
      const match = toHex(rulesHash(rules)) === toHex(l.rulesHash);
      ok &&= match;
      console.log(`${match ? '✔' : '✖'} Rules document ${match ? 'matches' : 'does NOT match'} the hash fixed in the contract`);
      const minOk = BigInt(rules.minAnswers) === BigInt(l.minAnswers);
      ok &&= minOk;
      console.log(`${minOk ? '✔' : '✖'} Minimum ${l.minAnswers} matches the rules`);
    }
    let present = 0;
    for (const [, d] of l.answers) if (await store.get(address, toHex(d))) present++;
    const all = BigInt(present) === l.answers.size();
    // A missing blob is an answer whose text is gone: never "consistent".
    ok &&= all;
    console.log(`${all ? '✔' : '✖'} ${present} of ${l.answers.size()} answer blobs found at ${store.where}, each matching its on-chain digest`);
    console.log(`✔ ${l.answerCount} members answered; ${l.removedTotal} removals ever, ${l.removed.size()} still marked`);
    console.log(ok ? 'Mirror: consistent.' : 'Mirror: INCONSISTENT — see above.');
  },
};

const two = positionals.slice(0, 2).join(' ');
const name = commands[two] ? two : positionals[0];
const cmd = name ? commands[name] : undefined;
if (!cmd) {
  console.log(`Commands: ${Object.keys(commands).join(', ')}. See the header of scripts/cli.ts.`);
  process.exit(name ? 1 : 0);
}
try {
  void keysDir;
  await cmd();
  process.exit(0);
} catch (err) {
  // Walk the cause chain: the SDK wraps the provider's failure.
  const parts: string[] = [];
  for (let e: unknown = err, i = 0; e && i < 6; e = (e as { cause?: unknown }).cause, i++)
    parts.push(e instanceof Error ? e.message : String(e));
  die(parts.join('\n  caused by: '));
}
