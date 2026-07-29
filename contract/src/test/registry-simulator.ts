// STELE REGISTRY - test harness
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
} from "../managed/registry/contract/index.js";
import { type StelePrivateState } from "../witnesses.js";
import { registryWitnesses } from "../registry-witnesses.js";

export class RegistrySimulator {
  readonly contract: Contract<StelePrivateState>;
  circuitContext: CircuitContext<StelePrivateState>;

  constructor(custodianSecret: Uint8Array) {
    this.contract = new Contract<StelePrivateState>(registryWitnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey: custodianSecret }, "0".repeat(64)),
      RegistrySimulator.custodianIdOf(custodianSecret),
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

  public switchUser(secretKey: Uint8Array): void {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public recordRound(roundNumber: bigint, roundAddress: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.recordRound(
      this.circuitContext,
      roundNumber,
      roundAddress,
    ).context;
    return this.getLedger();
  }

  public static custodianIdOf(secret: Uint8Array): Uint8Array {
    return pureCircuits.custodianIdOf(secret);
  }
}
