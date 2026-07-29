import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Phase { REGISTRATION = 0, VOTING = 1, CLOSED = 2 }

export type Witnesses<PS> = {
  localSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  eligibilityPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
                  cm_0: Uint8Array): [PS, { leaf: Uint8Array,
                                            path: { sibling: { field: bigint },
                                                    goes_left: boolean
                                                  }[]
                                          }];
}

export type ImpureCircuits<PS> = {
  register(context: __compactRuntime.CircuitContext<PS>, cm_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openVoting(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  participate(context: __compactRuntime.CircuitContext<PS>, choice_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeRound(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  register(context: __compactRuntime.CircuitContext<PS>, cm_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openVoting(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  participate(context: __compactRuntime.CircuitContext<PS>, choice_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeRound(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  commitmentOf(secret_0: Uint8Array): Uint8Array;
  nullifierOf(secret_0: Uint8Array, round_0: Uint8Array): Uint8Array;
  operatorIdOf(secret_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  commitmentOf(context: __compactRuntime.CircuitContext<PS>,
               secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  nullifierOf(context: __compactRuntime.CircuitContext<PS>,
              secret_0: Uint8Array,
              round_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  operatorIdOf(context: __compactRuntime.CircuitContext<PS>,
               secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  register(context: __compactRuntime.CircuitContext<PS>, cm_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openVoting(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  participate(context: __compactRuntime.CircuitContext<PS>, choice_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeRound(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly roundNumber: bigint;
  readonly questionHash: Uint8Array;
  readonly optionCount: bigint;
  readonly promiseHash: Uint8Array;
  readonly promiseThreshold: bigint;
  readonly minParticipants: bigint;
  readonly operatorId: Uint8Array;
  readonly phase: Phase;
  eligibility: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  readonly eligibleCount: bigint;
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  tally: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): { read(): bigint }
  };
  readonly participantCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               round_0: bigint,
               question_0: Uint8Array,
               options_0: bigint,
               promise_0: Uint8Array,
               threshold_0: bigint,
               minCount_0: bigint,
               operator_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
