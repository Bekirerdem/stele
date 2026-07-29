// STELE - test harness
// SPDX-License-Identifier: Apache-2.0

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from "../managed/stele/contract/index.js";
import { type StelePrivateState, witnesses } from "../witnesses.js";

/** The commitments a round is opened with. */
export type RoundParams = {
  round: bigint;
  question: Uint8Array;
  options: bigint;
  promise: Uint8Array;
  threshold: bigint;
  minCount: bigint;
  operator: Uint8Array;
};

/** Reasonable defaults for tests. */
export const defaultRound = (operator: Uint8Array): RoundParams => ({
  round: 1n,
  question: new Uint8Array(32).fill(7),
  options: 3n,
  promise: new Uint8Array(32).fill(9),
  threshold: 2n,
  minCount: 1n,
  operator,
});

export class SteleSimulator {
  readonly contract: Contract<StelePrivateState>;
  circuitContext: CircuitContext<StelePrivateState>;

  constructor(secretKey: Uint8Array, params: RoundParams) {
    this.contract = new Contract<StelePrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64)),
      params.round,
      params.question,
      params.options,
      params.promise,
      params.threshold,
      params.minCount,
      params.operator,
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /** Act as if we had moved to another participant's device. */
  public switchUser(secretKey: Uint8Array): void {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): StelePrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public register(cm: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.register(
      this.circuitContext,
      cm,
    ).context;
    return this.getLedger();
  }

  public openVoting(): Ledger {
    this.circuitContext = this.contract.impureCircuits.openVoting(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }

  public participate(choice: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.participate(
      this.circuitContext,
      choice,
    ).context;
    return this.getLedger();
  }

  public closeRound(): Ledger {
    this.circuitContext = this.contract.impureCircuits.closeRound(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }

  /** Values a participant derives on their own device; none of these travel. */
  public static commitmentOf(secret: Uint8Array): Uint8Array {
    return pureCircuits.commitmentOf(secret);
  }

  public static operatorIdOf(secret: Uint8Array): Uint8Array {
    return pureCircuits.operatorIdOf(secret);
  }

  public static nullifierOf(secret: Uint8Array, round: Uint8Array): Uint8Array {
    return pureCircuits.nullifierOf(secret, round);
  }
}

/** Convert a Uint64 round number into the 32-byte form the circuit expects. */
export const roundToBytes = (round: bigint): Uint8Array => {
  const out = new Uint8Array(32);
  let v = round;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
};
