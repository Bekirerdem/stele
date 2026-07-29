// STELE — kontrat paketi giriş noktası
// SPDX-License-Identifier: Apache-2.0

import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/stele/contract/index.js";
export * from "./witnesses";

import * as CompiledSteleContract from "./managed/stele/contract/index.js";
import * as Witnesses from "./witnesses";

export const SteleContract = CompiledContract.make<
  CompiledSteleContract.Contract<Witnesses.StelePrivateState>
>("Stele", CompiledSteleContract.Contract<Witnesses.StelePrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/stele"),
);
