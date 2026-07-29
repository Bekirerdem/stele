// STELE - shared types for the API, CLI and UI
// SPDX-License-Identifier: Apache-2.0

/**
 * Types and abstractions shared across the Stele clients.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { Phase, StelePrivateState, Contract, Witnesses } from '../../contract/src/index';

export const stelePrivateStateKey = 'stelePrivateState';
export type PrivateStateId = typeof stelePrivateStateKey;

/**
 * The private states consumed throughout the application.
 *
 * There is one contract type in Stele, so the schema has a single key. The
 * value behind it never leaves the device: it holds the eligibility secret.
 *
 * @public
 */
export type PrivateStates = {
  readonly stelePrivateState: StelePrivateState;
};

/**
 * A Stele round contract together with its private state.
 *
 * @public
 */
export type SteleContract = Contract<StelePrivateState, Witnesses<StelePrivateState>>;

/**
 * The circuits exported by {@link SteleContract}.
 *
 * @public
 */
export type SteleCircuitKeys = Exclude<keyof SteleContract['impureCircuits'], number | symbol>;

/**
 * The providers required by {@link SteleContract}.
 *
 * @public
 */
export type SteleProviders = MidnightProviders<SteleCircuitKeys, PrivateStateId, StelePrivateState>;

/**
 * A {@link SteleContract} that has been deployed to the network.
 *
 * @public
 */
export type DeployedSteleContract = FoundContract<SteleContract>;

/**
 * The five commitments a round is opened with.
 *
 * These are written once, at construction, and cannot be changed afterwards:
 * the question, who may answer, where it sits in the registry, what the
 * operator promises to do about the outcome, and the anonymity floor.
 *
 * @public
 */
export type RoundParams = {
  readonly round: bigint;
  readonly questionHash: Uint8Array;
  readonly optionCount: bigint;
  readonly promiseHash: Uint8Array;
  readonly promiseThreshold: bigint;
  readonly minParticipants: bigint;
  readonly operatorId: Uint8Array;
};

/**
 * Public state of a round, combined with what the local device can tell about
 * its own position in it.
 *
 * Everything here is either already public on the ledger or derived locally.
 * Nothing in this shape can identify another participant.
 *
 * @public
 */
export type SteleDerivedState = {
  readonly phase: Phase;
  readonly roundNumber: bigint;
  readonly questionHash: Uint8Array;
  readonly optionCount: bigint;
  readonly promiseHash: Uint8Array;
  readonly promiseThreshold: bigint;
  readonly minParticipants: bigint;

  /** How many commitments are in the eligibility tree. */
  readonly eligibleCount: bigint;

  /** How many answers have been recorded. */
  readonly participantCount: bigint;

  /** Votes per option, indexed by option number. */
  readonly tally: readonly bigint[];

  /**
   * Whether this device's commitment is in the eligibility tree.
   *
   * Derived locally by looking up our own commitment; it says nothing about
   * anyone else.
   */
  readonly isRegistered: boolean;

  /**
   * Whether this device's tag for this round has already been spent.
   *
   * The tag is public, so this is a local lookup rather than a disclosure.
   * It answers "have I answered yet", never "who else has".
   */
  readonly hasParticipated: boolean;

  /** Whether this device holds the operator secret for this round. */
  readonly isOperator: boolean;
};
