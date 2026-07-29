// STELE - contract tests
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { randomBytes } from "./utils.js";
import {
  SteleSimulator,
  defaultRound,
  roundToBytes,
  type RoundParams,
} from "./stele-simulator.js";
import { Phase } from "../managed/stele/contract/index.js";

setNetworkId("undeployed");

/** An operator secret plus a round committed to that operator's identity. */
const newRound = (overrides: Partial<RoundParams> = {}) => {
  const operatorSecret = randomBytes(32);
  const params = {
    ...defaultRound(SteleSimulator.operatorIdOf(operatorSecret)),
    ...overrides,
  };
  return { operatorSecret, params };
};

const hex = (u: Uint8Array) => Buffer.from(u).toString("hex");

describe("Stele - round commitments", () => {
  it("engraves the round's commitments at construction", () => {
    const { operatorSecret, params } = newRound();
    const l = new SteleSimulator(operatorSecret, params).getLedger();

    expect(l.roundNumber).toEqual(params.round);
    expect(l.questionHash).toEqual(params.question);
    expect(l.optionCount).toEqual(params.options);
    expect(l.promiseHash).toEqual(params.promise);
    expect(l.promiseThreshold).toEqual(params.threshold);
    expect(l.minParticipants).toEqual(params.minCount);
    expect(l.phase).toEqual(Phase.REGISTRATION);
    expect(l.participantCount).toEqual(0n);
    expect(l.eligibleCount).toEqual(0n);
  });

  it("produces the same initial state for the same inputs", () => {
    const { operatorSecret, params } = newRound();
    const a = new SteleSimulator(operatorSecret, params).getLedger();
    const b = new SteleSimulator(operatorSecret, params).getLedger();

    // The ledger holds behavioural structures (a Merkle tree, a Set), so we
    // compare the values the round commits to rather than the objects.
    const snapshot = (l: typeof a) => ({
      roundNumber: l.roundNumber,
      questionHash: hex(l.questionHash),
      optionCount: l.optionCount,
      promiseHash: hex(l.promiseHash),
      promiseThreshold: l.promiseThreshold,
      minParticipants: l.minParticipants,
      operatorId: hex(l.operatorId),
      phase: l.phase,
      participantCount: l.participantCount,
      eligibleCount: l.eligibleCount,
      root: l.eligibility.root().field,
    });
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it("derives commitments and tags deterministically", () => {
    const secret = randomBytes(32);

    expect(hex(SteleSimulator.commitmentOf(secret))).toEqual(
      hex(SteleSimulator.commitmentOf(secret)),
    );
    expect(hex(SteleSimulator.nullifierOf(secret, roundToBytes(1n)))).toEqual(
      hex(SteleSimulator.nullifierOf(secret, roundToBytes(1n))),
    );
  });
});

describe("Stele - participation", () => {
  it("counts an eligible participant's chosen option", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    expect(sim.getLedger().eligibleCount).toEqual(1n);

    sim.openVoting();
    sim.switchUser(voter);
    const l = sim.participate(1n);

    expect(l.participantCount).toEqual(1n);
    expect(l.tally.lookup(1n).read()).toEqual(1n);
    expect(l.nullifiers.size()).toEqual(1n);
  });

  it("rejects someone who never registered", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    sim.register(SteleSimulator.commitmentOf(randomBytes(32)));
    sim.openVoting();

    sim.switchUser(randomBytes(32));
    expect(() => sim.participate(0n)).toThrow();
  });

  it("rejects a second answer from the same secret", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();

    sim.switchUser(voter);
    sim.participate(0n);
    expect(() => sim.participate(2n)).toThrow();
    expect(sim.getLedger().participantCount).toEqual(1n);
  });

  it("rejects an answer outside the declared range", () => {
    const { operatorSecret, params } = newRound({ options: 3n });
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);

    expect(() => sim.participate(3n)).toThrow();
  });
});

describe("Stele - phases", () => {
  it("accepts no answers while registration is open", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.switchUser(voter);

    expect(() => sim.participate(0n)).toThrow();
  });

  it("accepts no registrations once voting opens (the root freezes)", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    sim.register(SteleSimulator.commitmentOf(randomBytes(32)));
    sim.openVoting();

    expect(() => sim.register(SteleSimulator.commitmentOf(randomBytes(32)))).toThrow();
  });

  it("lets only the operator move the phase", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    sim.register(SteleSimulator.commitmentOf(randomBytes(32)));
    sim.switchUser(randomBytes(32));
    expect(() => sim.openVoting()).toThrow();
  });

  it("refuses to close a round below the anonymity floor", () => {
    const { operatorSecret, params } = newRound({ minCount: 2n });
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);
    sim.participate(0n); // one participant, floor is two

    sim.switchUser(operatorSecret);
    expect(() => sim.closeRound()).toThrow();
    expect(sim.getLedger().phase).toEqual(Phase.VOTING);
  });

  it("closes the round once the floor is met", () => {
    const { operatorSecret, params } = newRound({ minCount: 2n });
    const sim = new SteleSimulator(operatorSecret, params);

    const a = randomBytes(32);
    const b = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(a));
    sim.register(SteleSimulator.commitmentOf(b));
    sim.openVoting();

    sim.switchUser(a);
    sim.participate(0n);
    sim.switchUser(b);
    sim.participate(1n);

    sim.switchUser(operatorSecret);
    const l = sim.closeRound();

    expect(l.phase).toEqual(Phase.CLOSED);
    expect(l.participantCount).toEqual(2n);
    expect(l.tally.lookup(0n).read()).toEqual(1n);
    expect(l.tally.lookup(1n).read()).toEqual(1n);
  });
});

describe("Stele - privacy invariant", () => {
  it("never exposes the participant's secret in any ledger field", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);
    sim.participate(1n);

    // Scan the entire ledger for the secret's bytes.
    const dump = JSON.stringify(sim.getLedger(), (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
    expect(dump).not.toContain(hex(voter));

    // The tag is derived from the secret but is not the secret.
    const nullifier = SteleSimulator.nullifierOf(voter, roundToBytes(params.round));
    expect(hex(nullifier)).not.toEqual(hex(voter));
  });

  it("keeps tags unlinkable across rounds", () => {
    const voter = randomBytes(32);
    const n1 = SteleSimulator.nullifierOf(voter, roundToBytes(1n));
    const n2 = SteleSimulator.nullifierOf(voter, roundToBytes(2n));

    // Same person, different rounds -> unrelated tags.
    expect(hex(n1)).not.toEqual(hex(n2));

    // And the commitment lives in its own domain.
    expect(hex(SteleSimulator.commitmentOf(voter))).not.toEqual(hex(n1));
  });

  it("leaves the private state untouched by participation", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);

    const before = sim.getPrivateState();
    sim.participate(0n);
    expect(sim.getPrivateState()).toEqual(before);
  });
});
