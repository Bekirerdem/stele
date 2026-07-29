// STELE - private state and witness functions
// SPDX-License-Identifier: Apache-2.0

import { Ledger } from "./managed/stele/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

/**
 * The only secret held on the participant's device: the eligibility secret.
 *
 * It never travels to the chain, to the institution, or to a remote server.
 * The institution only ever receives the commitment H("stele:cm:", secret).
 * Whoever knows a secret can precompute its nullifiers, so a centrally issued
 * secret would turn the public tag list into a roster of names.
 */
export type StelePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createStelePrivateState = (secretKey: Uint8Array): StelePrivateState => ({
  secretKey,
});

const MERKLE_DEPTH = 16;

/**
 * A structurally valid path for a commitment that is not in the tree.
 *
 * A witness has to return something; rather than throwing "not found" we
 * return a path that cannot pass verification. The circuit checks two things
 * at once - the root is recognised AND the leaf is ours - so this is rejected.
 */
const emptyPath = (leaf: Uint8Array) => ({
  leaf,
  path: Array.from({ length: MERKLE_DEPTH }, () => ({
    sibling: { field: 0n },
    goes_left: false,
  })),
});

export const witnesses = {
  localSecret: ({
    privateState,
  }: WitnessContext<Ledger, StelePrivateState>): [StelePrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  /**
   * The commitment's membership path in the eligibility tree.
   *
   * The path is used only while producing the proof; all that reaches the
   * ledger is that some recognised root matched. Which leaf was proven stays
   * hidden - precisely why a Set cannot be used for the membership test.
   */
  eligibilityPath: (
    { ledger, privateState }: WitnessContext<Ledger, StelePrivateState>,
    cm: Uint8Array,
  ): [StelePrivateState, ReturnType<typeof emptyPath>] => {
    const found = ledger.eligibility.findPathForLeaf(cm);
    return [
      privateState,
      (found as ReturnType<typeof emptyPath> | undefined) ?? emptyPath(cm),
    ];
  },
};
