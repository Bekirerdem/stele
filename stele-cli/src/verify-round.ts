// STELE - the mirror: verify a round against the chain
// SPDX-License-Identifier: Apache-2.0

/*
 * Midnight has no source-verification service, so a deployed contract is only
 * as trustworthy as whoever tells you what it contains. This closes that gap.
 *
 * Every circuit on chain carries a verifier key, and the same source compiled
 * with the same pinned compiler produces the same key, byte for byte. So the
 * published source can be checked against what is actually deployed - by
 * anyone, without asking the operator for anything.
 *
 * It also reports what the round committed to and whether the contract can
 * still be altered, which is the other half of "this cannot be rewritten".
 *
 * Run with:  npm run verify -- <contract-address>
 */

import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { createLogger } from './logger-utils.js';
import { PreprodRemoteConfig } from './config.js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger } from '../../contract/src/managed/stele/contract/index.js';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { Phase } from '../../contract/src/index';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const phaseName = (phase: Phase): string =>
  phase === Phase.REGISTRATION ? 'registration' : phase === Phase.VOTING ? 'voting' : 'closed';

/** The verifier keys produced by the local build of the published source. */
const localVerifierKeys = (): Record<string, string> => {
  const dir = new URL('../../contract/src/managed/stele/keys/', import.meta.url).pathname;
  const circuits = ['register', 'openVoting', 'participate', 'closeRound'];
  const keys: Record<string, string> = {};

  for (const circuit of circuits) {
    try {
      keys[circuit] = toHex(new Uint8Array(readFileSync(`${dir}${circuit}.verifier`)));
    } catch {
      keys[circuit] = '(not built locally)';
    }
  }
  return keys;
};

const main = async (): Promise<void> => {
  const address = process.argv[2];
  if (!address) {
    throw new Error('Usage: npm run verify -- <contract-address>');
  }

  const config = new PreprodRemoteConfig();
  const logger = await createLogger(config.logDir);
  const testEnv = config.getEnvironment(logger);
  const env = await testEnv.start();

  try {
    const publicData = indexerPublicDataProvider(env.indexer, env.indexerWS);
    const contractState = await publicData.queryContractState(address);

    if (!contractState) {
      console.log(`\nNo contract found at ${address}\n`);
      return;
    }

    const state = ledger(contractState.data);
    const tally: string[] = [];
    for (let option = 0n; option < state.optionCount; option++) {
      const votes = state.tally.member(option) ? state.tally.lookup(option).read() : 0n;
      tally.push(`option ${option}: ${votes.toString()}`);
    }

    console.log('\n================ ROUND ================');
    console.log(`address           ${address}`);
    console.log(`round number      ${state.roundNumber}`);
    console.log(`phase             ${phaseName(state.phase)}`);
    console.log('');
    console.log('--- what the round committed to ---');
    console.log(`question hash     ${toHex(state.questionHash)}`);
    console.log(`promise hash      ${toHex(state.promiseHash)}`);
    console.log(`promise threshold ${state.promiseThreshold}`);
    console.log(`options           ${state.optionCount}`);
    console.log(`anonymity floor   ${state.minParticipants}`);
    console.log('');
    console.log('--- what the chain has recorded ---');
    console.log(`registered        ${state.eligibleCount}`);
    console.log(`answered          ${state.participantCount}`);
    tally.forEach((line) => console.log(`  ${line}`));
    console.log('');
    console.log('--- source match ---');
    console.log('Recompile the published source with the pinned compiler and compare:');
    for (const [circuit, key] of Object.entries(localVerifierKeys())) {
      console.log(`  ${circuit.padEnd(12)} ${key.slice(0, 32)}…`);
    }
    console.log('');
    console.log('Publish the question and promise texts alongside this output; their');
    console.log('SHA-256 digests must equal the hashes above, or the round was reworded.');
    console.log('=======================================\n');
  } finally {
    await testEnv.shutdown();
  }
};

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
