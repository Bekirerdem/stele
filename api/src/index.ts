// STELE - client API for a deployed round
// SPDX-License-Identifier: Apache-2.0

/**
 * Types and utilities for working with Stele round contracts.
 *
 * @packageDocumentation
 */

import * as Stele from '../../contract/src/managed/stele/contract/index.js';

import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type RoundParams,
  type SteleContract,
  type SteleDerivedState,
  type SteleProviders,
  type DeployedSteleContract,
  stelePrivateStateKey,
} from './common-types.js';
import { SteleContract as CompiledStele } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { type StelePrivateState, createStelePrivateState } from '../../contract/src/witnesses.js';

/** Convert a round number into the 32-byte form the circuit expects. */
export const roundToBytes = (round: bigint): Uint8Array => {
  const out = new Uint8Array(32);
  let v = round;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
};

/**
 * The API of a deployed Stele round.
 */
export interface DeployedSteleAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<SteleDerivedState>;

  register: () => Promise<void>;
  openVoting: () => Promise<void>;
  participate: (choice: bigint) => Promise<void>;
  closeRound: () => Promise<void>;
}

/**
 * Adapts a deployed round contract into {@link DeployedSteleAPI}.
 *
 * The eligibility secret lives in the private state provider and never leaves
 * the device. Everything this class exposes is either already public on the
 * ledger or derived locally from that secret - it can answer "am I registered"
 * and "have I already answered", never the same question about anyone else.
 */
export class SteleAPI implements DeployedSteleAPI {
  private constructor(
    public readonly deployedContract: DeployedSteleContract,
    private readonly providers: SteleProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);

    this.state$ = combineLatest(
      [
        providers.publicDataProvider
          .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
          .pipe(map((contractState) => Stele.ledger(contractState.data))),
        from(providers.privateStateProvider.get(stelePrivateStateKey) as Promise<StelePrivateState>),
      ],
      (ledgerState, privateState): SteleDerivedState => {
        const commitment = Stele.pureCircuits.commitmentOf(privateState.secretKey);
        const nullifier = Stele.pureCircuits.nullifierOf(privateState.secretKey, roundToBytes(ledgerState.roundNumber));

        const tally: bigint[] = [];
        for (let option = 0n; option < ledgerState.optionCount; option++) {
          tally.push(ledgerState.tally.member(option) ? ledgerState.tally.lookup(option).read() : 0n);
        }

        return {
          phase: ledgerState.phase,
          roundNumber: ledgerState.roundNumber,
          questionHash: ledgerState.questionHash,
          optionCount: ledgerState.optionCount,
          promiseHash: ledgerState.promiseHash,
          promiseThreshold: ledgerState.promiseThreshold,
          minParticipants: ledgerState.minParticipants,
          eligibleCount: ledgerState.eligibleCount,
          participantCount: ledgerState.participantCount,
          tally,
          isRegistered: ledgerState.eligibility.findPathForLeaf(commitment) !== undefined,
          hasParticipated: ledgerState.nullifiers.member(nullifier),
          isOperator: toHex(ledgerState.operatorId) === toHex(Stele.pureCircuits.operatorIdOf(privateState.secretKey)),
        };
      },
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<SteleDerivedState>;

  /**
   * Adds this device's commitment to the eligibility tree.
   *
   * Only the commitment travels; the secret behind it stays here. Whoever
   * knows a secret can precompute its tags, which is why the operator must
   * never be the one to issue it.
   */
  async register(): Promise<void> {
    const privateState = (await this.providers.privateStateProvider.get(stelePrivateStateKey)) as
      | StelePrivateState
      | undefined;

    if (!privateState) {
      throw new Error('No private state found for this round');
    }

    const commitment = Stele.pureCircuits.commitmentOf(privateState.secretKey);
    const txData = await this.deployedContract.callTx.register(commitment);

    this.logger?.trace({
      transactionAdded: { circuit: 'register', txHash: txData.public.txHash },
    });
  }

  /** Close registration and open voting. The eligibility root freezes here. */
  async openVoting(): Promise<void> {
    const txData = await this.deployedContract.callTx.openVoting();

    this.logger?.trace({
      transactionAdded: { circuit: 'openVoting', txHash: txData.public.txHash },
    });
  }

  /**
   * Answer the round's question.
   *
   * Fails locally if this device is not in the eligibility tree, if its tag
   * for this round has already been spent, or if the choice is out of range.
   */
  async participate(choice: bigint): Promise<void> {
    const txData = await this.deployedContract.callTx.participate(choice);

    this.logger?.trace({
      transactionAdded: { circuit: 'participate', txHash: txData.public.txHash },
    });
  }

  /** Close the round. Refused while participation is below the floor. */
  async closeRound(): Promise<void> {
    const txData = await this.deployedContract.callTx.closeRound();

    this.logger?.trace({
      transactionAdded: { circuit: 'closeRound', txHash: txData.public.txHash },
    });
  }

  /**
   * Opens a new round.
   *
   * The five commitments are constructor arguments, so they are fixed by the
   * deployment transaction itself and cannot be edited afterwards.
   */
  static async deploy(
    providers: SteleProviders,
    params: RoundParams,
    secretKey?: Uint8Array,
    logger?: Logger,
  ): Promise<SteleAPI> {
    logger?.info({ deployRound: { round: params.round.toString() } });

    const deployed = await deployContract(providers, {
      compiledContract: CompiledStele,
      privateStateId: stelePrivateStateKey,
      initialPrivateState: createStelePrivateState(secretKey ?? utils.randomBytes(32)),
      args: [
        params.round,
        params.questionHash,
        params.optionCount,
        params.promiseHash,
        params.promiseThreshold,
        params.minParticipants,
        params.operatorId,
      ],
    });

    logger?.trace({ roundDeployed: { finalizedDeployTxData: deployed.deployTxData.public } });

    return new SteleAPI(deployed, providers, logger);
  }

  /**
   * Joins a round that is already on the network.
   *
   * A participant generates their own secret here; it is created locally on
   * first join and reused from the private state provider afterwards.
   */
  static async join(providers: SteleProviders, contractAddress: ContractAddress, logger?: Logger): Promise<SteleAPI> {
    logger?.info({ joinRound: { contractAddress } });

    const deployed = await findDeployedContract<SteleContract>(providers, {
      contractAddress,
      compiledContract: CompiledStele,
      privateStateId: stelePrivateStateKey,
      initialPrivateState: await SteleAPI.getPrivateState(providers),
    });

    logger?.trace({ roundJoined: { finalizedDeployTxData: deployed.deployTxData.public } });

    return new SteleAPI(deployed, providers, logger);
  }

  private static async getPrivateState(providers: SteleProviders): Promise<StelePrivateState> {
    const existing = (await providers.privateStateProvider.get(stelePrivateStateKey)) as StelePrivateState | undefined;

    if (existing) {
      return existing;
    }

    const created = createStelePrivateState(utils.randomBytes(32));
    await providers.privateStateProvider.set(stelePrivateStateKey, created);
    return created;
  }
}

export * from './common-types.js';
export * as utils from './utils/index.js';
