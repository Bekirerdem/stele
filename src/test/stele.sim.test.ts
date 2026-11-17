// In-memory tests: the compiled contract runs with compact-runtime, with no
// network and no proofs. Every guard, the answer/revise/remove rules and the
// privacy invariants live here.
//
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { Sim, assertNotInPublicState, expectRejects } from './sim.js';
import { Contract, ledger, Phase, Visibility } from '../../contract/index.js';
import { createStelePrivateState, witnesses } from '../../contract/witnesses.js';
import {
  answerNullifier,
  askerKey,
  digestOf,
  memberKey,
  moderatorKey,
  newEncryptionKeys,
  newSecretKey,
  openBlob,
  plainBlob,
  questionIdFromLabel,
  questionInstance,
  rulesHash,
  sealedBlob,
  type Rules,
} from '../crypto.js';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

const QID = questionIdFromLabel('acme-2026-q4');
const RULES: Rules = {
  version: 1,
  title: 'Leaving',
  prompts: ['Are you planning to leave in the next six months? Why?'],
  visibility: 'asker_only',
  minAnswers: 3,
  moderation: { remove: ['insult', 'threat', 'doxxing'], model: 'z-ai/glm-5.3-flash', provider: 'near-ai-tee' },
};
const ASKER_SK = newSecretKey();
const MOD_SK = newSecretKey();
const T0 = 1_800_000_000;
const DAY = 24 * 3600;
const DEADLINE = T0 + 7 * DAY;
const REASON_INSULT = 1n;

const deploy = (vis = Visibility.ASKER_ONLY, minimum = 3n) =>
  Sim.deploy({
    contract: new Contract(witnesses),
    ledger,
    privateState: createStelePrivateState(ASKER_SK),
    args: [QID, rulesHash(RULES), vis, minimum, moderatorKey(MOD_SK)],
  });

type SteleSim = Awaited<ReturnType<typeof deploy>>;

const as = (sim: SteleSim, sk: Uint8Array) => {
  sim.privateState = createStelePrivateState(sk);
  return sim;
};

const Q = (sim: SteleSim) => questionInstance(QID, sim.address);
const digest = (s: string) => digestOf(new TextEncoder().encode(s));

/** A deployed question with `n` members enrolled, an asker key published, opened at T0. */
const setup = async (n = 4, vis = Visibility.ASKER_ONLY) => {
  const sim = (await deploy(vis)).at(T0);
  const members = Array.from({ length: n }, () => newSecretKey());
  const enc = newEncryptionKeys();
  for (const sk of members) await sim.call('enrol', memberKey(sk));
  await sim.call('addAskerKey', enc.publicKey);
  await sim.call('open', BigInt(DEADLINE));
  return { sim, members, enc };
};

describe('construction', () => {
  it('fixes the asker, the rules and the threshold', async () => {
    const sim = await deploy();
    const l = sim.ledger();
    expect(toHex(l.askerPk)).toBe(toHex(askerKey(ASKER_SK)));
    expect(toHex(l.moderatorPk)).toBe(toHex(moderatorKey(MOD_SK)));
    expect(toHex(l.rulesHash)).toBe(toHex(rulesHash(RULES)));
    expect(l.minAnswers).toBe(3n);
    expect(l.visibility).toBe(Visibility.ASKER_ONLY);
    expect(l.phase).toBe(Phase.ENROLMENT);
  });

  it('refuses a minimum below 3', async () => {
    await expectRejects(() => deploy(Visibility.PUBLIC, 2n), 'at least 3');
  });

  it('hashes the same rules the same way whatever the key order', () => {
    const shuffled = Object.fromEntries(Object.entries(RULES).reverse()) as Rules;
    expect(toHex(rulesHash(shuffled))).toBe(toHex(rulesHash(RULES)));
    expect(toHex(rulesHash({ ...RULES, minAnswers: 4 }))).not.toBe(toHex(rulesHash(RULES)));
  });
});

describe('enrolment', () => {
  it('only the asker enrols, once per key', async () => {
    const sim = await deploy();
    const m = newSecretKey();
    await expectRejects(() => as(sim, m).call('enrol', memberKey(m)), 'Only the asker');
    as(sim, ASKER_SK);
    await sim.call('enrol', memberKey(m));
    await expectRejects(() => sim.call('enrol', memberKey(m)), 'already enrolled');
    expect(sim.ledger().enrolled).toBe(1n);
  });

  it('cannot open with fewer members than the minimum', async () => {
    const sim = (await deploy()).at(T0);
    for (let i = 0; i < 2; i++) await sim.call('enrol', memberKey(newSecretKey()));
    await sim.call('addAskerKey', newEncryptionKeys().publicKey);
    await expectRejects(() => sim.call('open', BigInt(DEADLINE)), 'Fewer members than the minimum');
  });

  it('asker-only questions need a key to seal to before opening', async () => {
    const sim = (await deploy()).at(T0);
    for (let i = 0; i < 3; i++) await sim.call('enrol', memberKey(newSecretKey()));
    await expectRejects(() => sim.call('open', BigInt(DEADLINE)), 'No asker key');
  });

  it('public questions open without one', async () => {
    const sim = (await deploy(Visibility.PUBLIC)).at(T0);
    for (let i = 0; i < 3; i++) await sim.call('enrol', memberKey(newSecretKey()));
    await sim.call('open', BigInt(DEADLINE));
    expect(sim.ledger().phase).toBe(Phase.OPEN);
  });

  it('freezes the member list once open', async () => {
    const { sim } = await setup();
    await expectRejects(() => as(sim, ASKER_SK).call('enrol', memberKey(newSecretKey())), 'Enrolment is closed');
    await expectRejects(() => sim.call('addAskerKey', newEncryptionKeys().publicKey), 'Enrolment is closed');
  });

  it('refuses a deadline in the past', async () => {
    const sim = (await deploy(Visibility.PUBLIC)).at(T0);
    for (let i = 0; i < 3; i++) await sim.call('enrol', memberKey(newSecretKey()));
    await expectRejects(() => sim.call('open', BigInt(T0 - 1)), 'in the past');
  });
});

describe('answering', () => {
  it('a member answers once and is counted once', async () => {
    const { sim, members } = await setup();
    const m = members[0]!;
    const { ledger: l } = await as(sim, m).call('answer', digest('first'));
    expect(l.answerCount).toBe(1n);
    expect(l.submissions).toBe(1n);
    const n = answerNullifier(m, Q(sim));
    expect(toHex(l.answers.lookup(n))).toBe(toHex(digest('first')));
  });

  it('a revision replaces the answer without counting the member twice', async () => {
    const { sim, members } = await setup();
    const m = members[1]!;
    as(sim, m);
    await sim.call('answer', digest('first'));
    const { ledger: l } = await sim.call('answer', digest('second'));
    expect(l.answerCount).toBe(1n);
    expect(l.submissions).toBe(2n);
    expect(toHex(l.answers.lookup(answerNullifier(m, Q(sim))))).toBe(toHex(digest('second')));
  });

  it('different members get different, unlinkable nullifiers', async () => {
    const { sim, members } = await setup();
    for (const m of members.slice(0, 3)) await as(sim, m).call('answer', digest(toHex(m)));
    const l = sim.ledger();
    expect(l.answerCount).toBe(3n);
    expect(l.answers.size()).toBe(3n);
  });

  it('a non-member cannot answer', async () => {
    const { sim } = await setup();
    await expectRejects(() => as(sim, newSecretKey()).call('answer', digest('x')), 'not enrolled');
  });

  it('the asker is not a member and cannot answer', async () => {
    const { sim } = await setup();
    await expectRejects(() => as(sim, ASKER_SK).call('answer', digest('x')), 'not enrolled');
  });

  it('refuses an empty digest', async () => {
    const { sim, members } = await setup();
    await expectRejects(() => as(sim, members[0]!).call('answer', new Uint8Array(32)), 'Empty answer');
  });

  it('closes at the deadline', async () => {
    const { sim, members } = await setup();
    sim.at(DEADLINE);
    await expectRejects(() => as(sim, members[0]!).call('answer', digest('late')), 'Answering is closed');
  });

  it('cannot answer before opening', async () => {
    const sim = (await deploy()).at(T0);
    const m = newSecretKey();
    await sim.call('enrol', memberKey(m));
    await expectRejects(() => as(sim, m).call('answer', digest('early')), 'not open');
  });
});

describe('closing', () => {
  it('anyone can close after the deadline, nobody before', async () => {
    const { sim, members } = await setup();
    as(sim, members[2]!);
    await expectRejects(() => sim.call('close'), 'still open');
    sim.at(DEADLINE);
    const { ledger: l } = await sim.call('close');
    expect(l.phase).toBe(Phase.CLOSED);
  });
});

describe('moderation', () => {
  it('only the moderator removes, always with a reason, and it stays visible', async () => {
    const { sim, members } = await setup();
    const m = members[0]!;
    await as(sim, m).call('answer', digest('rude'));
    const n = answerNullifier(m, Q(sim));
    await expectRejects(() => as(sim, ASKER_SK).call('remove', n, REASON_INSULT), 'Only the moderator');
    as(sim, MOD_SK);
    await expectRejects(() => sim.call('remove', n, 0n), 'A reason is required');
    const { ledger: l } = await sim.call('remove', n, REASON_INSULT);
    expect(l.removed.lookup(n)).toBe(REASON_INSULT);
    expect(l.removedTotal).toBe(1n);
    // The answer itself is still listed: removal is a visible mark, not a deletion.
    expect(l.answers.member(n)).toBe(true);
    await expectRejects(() => sim.call('remove', n, REASON_INSULT), 'Already removed');
  });

  it('a corrected answer clears the mark but never the total', async () => {
    const { sim, members } = await setup();
    const m = members[0]!;
    await as(sim, m).call('answer', digest('rude'));
    const n = answerNullifier(m, Q(sim));
    await as(sim, MOD_SK).call('remove', n, REASON_INSULT);
    const { ledger: l } = await as(sim, m).call('answer', digest('polite'));
    expect(l.removed.member(n)).toBe(false);
    expect(l.removedTotal).toBe(1n);
    expect(l.answerCount).toBe(1n);
  });

  it('cannot remove an answer that does not exist', async () => {
    const { sim } = await setup();
    await expectRejects(() => as(sim, MOD_SK).call('remove', new Uint8Array(32).fill(7), REASON_INSULT), 'No such answer');
  });
});

describe('privacy', () => {
  it('no secret and no answer text ever reaches the public state', async () => {
    const { sim, members, enc } = await setup();
    const q = Q(sim);
    const texts = members.map((_, i) => `I am planning to leave, reason number ${i}`);
    for (const [i, m] of members.entries()) {
      const blob = sealedBlob({ v: 1, answers: [texts[i]!] }, [enc.publicKey], q);
      await as(sim, m).call('answer', digestOf(blob));
    }
    const secrets: Record<string, Uint8Array> = { asker: ASKER_SK, moderator: MOD_SK, askerEnc: enc.secretKey };
    members.forEach((m, i) => {
      secrets[`member${i}`] = m;
      secrets[`text${i}`] = new TextEncoder().encode(texts[i]!);
    });
    assertNotInPublicState(sim.ledger(), secrets);
  });

  it('the public ledger does not say which member answered', async () => {
    const { sim, members } = await setup();
    await as(sim, members[2]!).call('answer', digest('a'));
    const l = sim.ledger();
    const [n] = [...l.answers].map(([k]) => k);
    // The nullifier is not any member key, and member keys are all still just listed.
    for (const m of members) expect(toHex(n!)).not.toBe(toHex(memberKey(m)));
    expect(l.memberKeys.size()).toBe(BigInt(members.length));
  });

  it('nullifiers differ across questions and across deployments', async () => {
    const m = newSecretKey();
    const a = questionInstance(QID, '11'.repeat(32));
    const b = questionInstance(QID, '22'.repeat(32));
    const c = questionInstance(questionIdFromLabel('other'), '11'.repeat(32));
    const na = toHex(answerNullifier(m, a));
    expect(toHex(answerNullifier(m, b))).not.toBe(na);
    expect(toHex(answerNullifier(m, c))).not.toBe(na);
  });
});

describe('answer blobs', () => {
  const q = questionInstance(QID, 'ab'.repeat(32));

  it('sealed blobs open only with an asker key and only for this question', () => {
    const k1 = newEncryptionKeys();
    const k2 = newEncryptionKeys();
    const body = { v: 1 as const, answers: ['Management never listens.'] };
    const blob = sealedBlob(body, [k1.publicKey, k2.publicKey], q);
    expect(openBlob(blob, q, k1.secretKey)).toEqual(body);
    expect(openBlob(blob, q, k2.secretKey)).toEqual(body);
    expect(() => openBlob(blob, q, newEncryptionKeys().secretKey)).toThrow('not sealed to this key');
    expect(() => openBlob(blob, questionInstance(QID, 'cd'.repeat(32)), k1.secretKey)).toThrow();
  });

  it('pads answers so short and long ones look alike', () => {
    const short = plainBlob({ v: 1, answers: ['No.'] });
    const longer = plainBlob({ v: 1, answers: ['No. '.repeat(100)] });
    expect(short.length).toBe(longer.length);
    expect(openBlob(short, q)).toEqual({ v: 1, answers: ['No.'] });
  });

  it('refuses an answer too long for the largest bucket', () => {
    expect(() => plainBlob({ v: 1, answers: ['x'.repeat(20_000)] })).toThrow('too long');
  });
});
