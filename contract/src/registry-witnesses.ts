// STELE REGISTRY - witness functions
// SPDX-License-Identifier: Apache-2.0

import { Ledger } from "./managed/registry/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { type StelePrivateState } from "./witnesses.js";

/**
 * The registry needs only the custodian's secret.
 *
 * It shares the private state shape with a round, but its ledger is a
 * different type, so its witnesses are declared separately.
 */
export const registryWitnesses = {
  localSecret: ({
    privateState,
  }: WitnessContext<Ledger, StelePrivateState>): [
    StelePrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
