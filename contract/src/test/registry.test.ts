// STELE REGISTRY - contract tests
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { randomBytes } from "./utils.js";
import { RegistrySimulator } from "./registry-simulator.js";

setNetworkId("undeployed");

const addressOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);

describe("Registry - recording rounds", () => {
  it("starts empty and knows its custodian", () => {
    const custodian = randomBytes(32);
    const l = new RegistrySimulator(custodian).getLedger();

    expect(l.roundCount).toEqual(0n);
    expect(l.highestRound).toEqual(0n);
    expect(l.custodianId).toEqual(RegistrySimulator.custodianIdOf(custodian));
  });

  it("records a round under its number", () => {
    const custodian = randomBytes(32);
    const sim = new RegistrySimulator(custodian);

    const l = sim.recordRound(1n, addressOf(7));

    expect(l.roundCount).toEqual(1n);
    expect(l.highestRound).toEqual(1n);
    expect(l.rounds.lookup(1n)).toEqual(addressOf(7));
  });

  it("lets only the custodian record", () => {
    const sim = new RegistrySimulator(randomBytes(32));
    sim.switchUser(randomBytes(32));

    expect(() => sim.recordRound(1n, addressOf(1))).toThrow();
  });
});

describe("Registry - immutability", () => {
  it("refuses to reassign a round number", () => {
    const custodian = randomBytes(32);
    const sim = new RegistrySimulator(custodian);

    sim.recordRound(1n, addressOf(1));

    // Rewriting an entry is how an inconvenient round would disappear.
    expect(() => sim.recordRound(1n, addressOf(2))).toThrow();
    expect(sim.getLedger().rounds.lookup(1n)).toEqual(addressOf(1));
  });

  it("exposes a skipped round as a gap in the sequence", () => {
    const custodian = randomBytes(32);
    const sim = new RegistrySimulator(custodian);

    sim.recordRound(1n, addressOf(1));
    sim.recordRound(2n, addressOf(2));
    sim.recordRound(5n, addressOf(5)); // 3 and 4 were never recorded

    const l = sim.getLedger();

    // Three entries, but the sequence reaches five: two numbers are missing.
    // A verifier sees this without searching the chain for anything.
    expect(l.roundCount).toEqual(3n);
    expect(l.highestRound).toEqual(5n);
    expect(l.highestRound - l.roundCount).toEqual(2n);
    expect(l.rounds.member(3n)).toEqual(false);
    expect(l.rounds.member(4n)).toEqual(false);
  });

  it("keeps the highest number when a lower one arrives late", () => {
    const custodian = randomBytes(32);
    const sim = new RegistrySimulator(custodian);

    sim.recordRound(5n, addressOf(5));
    const l = sim.recordRound(3n, addressOf(3));

    expect(l.highestRound).toEqual(5n);
    expect(l.roundCount).toEqual(2n);
  });
});
