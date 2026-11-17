// Runs the answer shield on NEAR AI's private inference: the model runs in an
// Intel TDX + NVIDIA confidential-computing enclave, the request is encrypted
// on this machine to a key the enclave attests to, and every reply's
// signature is checked against the attested signer. Nobody on the way, the
// operator included, sees the draft in the clear.
//
// SPDX-License-Identifier: MIT

import { InferenceClient, createTdxQuoteVerifier } from '@nearai/inference-sdk/node';
import {
  DETECT_SCHEMA,
  DETECT_SYSTEM,
  NORMALIZE_SCHEMA,
  NORMALIZE_SYSTEM,
  normalizeInput,
  parseFlags,
  parsePlain,
  shieldRequest,
  type Flag,
} from './shield-core.js';

export const DEFAULT_SHIELD_MODEL = 'z-ai/glm-5.3-flash';
const BASE_URL = 'https://cloud-api.near.ai/v1';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const text = (e: unknown) => `${(e as { failure?: { code?: string } })?.failure?.code ?? ''} ${(e as Error)?.message ?? ''}`;

export type ShieldReceipt = { model: string; verified: string; seconds: number };

export function createShield(opts: { apiKey: string; model?: string }) {
  const model = opts.model ?? DEFAULT_SHIELD_MODEL;
  // Intel's collateral service is the default for checking the TDX quote.
  // STELE_PCCS_URL points it at a mirror instead (e.g. https://pccs.phala.network)
  // when Intel's endpoint is unreachable. That is safe: the collateral is
  // signed by Intel and the signature is checked, so a mirror can't forge it.
  const pccsUrl = process.env['STELE_PCCS_URL']?.trim();
  const tdx = pccsUrl ? { verifiers: { tdxQuote: createTdxQuoteVerifier({ pccsUrl }) } } : {};
  const build = () =>
    new InferenceClient({
      apiKey: opts.apiKey,
      baseUrl: BASE_URL,
      e2ee: true,
      ...(pccsUrl ? { modelVerification: tdx, gatewayVerification: tdx } : {}),
    } as never);
  let client = build();

  async function verify(id: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await client.verifyResponse(id);
      } catch (e) {
        // The signature is sometimes not ready the instant the reply arrives.
        if (attempt >= 4 || !/completion signature/i.test(text(e))) throw e;
        await wait(1500 * attempt);
      }
    }
  }

  async function send<T>(body: object, parse: (content: unknown) => T): Promise<{ value: T; receipt: ShieldReceipt }> {
    const started = performance.now();
    for (let attempt = 1; ; attempt++) {
      let completion;
      try {
        completion = await client.chat.completions.create(body as never);
      } catch (e) {
        // The enclave restarted and its key changed: check the hardware again
        // with a fresh client and send once more. Nothing readable left here.
        if (attempt >= 3 || !/decryption failed/i.test(text(e))) throw e;
        client = build();
        continue;
      }
      let value: T;
      try {
        value = parse(completion.choices[0]?.message?.content);
      } catch (e) {
        if (attempt >= 3) throw e;
        continue;
      }
      const verified = await verify(completion.id);
      return {
        value,
        receipt: {
          model,
          verified: String((verified as { signatureKind?: string })?.signatureKind ?? 'verified'),
          seconds: Number(((performance.now() - started) / 1000).toFixed(1)),
        },
      };
    }
  }

  return {
    model,
    /** Lists the parts of `draft` that could identify its writer. */
    inspect: (draft: string) => send<Flag[]>(shieldRequest(model, DETECT_SYSTEM, draft, DETECT_SCHEMA), (c) => parseFlags(c, draft)),
    /** Neutralizes the style of `text`, holding the `keep` spans fixed. */
    normalize: (t: string, keep: string[]) =>
      send<string>(shieldRequest(model, NORMALIZE_SYSTEM, normalizeInput(t, keep), NORMALIZE_SCHEMA), parsePlain),
  };
}

export type Shield = ReturnType<typeof createShield>;
