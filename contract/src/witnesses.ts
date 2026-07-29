// STELE — private state ve witness fonksiyonları
// SPDX-License-Identifier: Apache-2.0

import { Ledger } from "./managed/stele/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

/**
 * Katılımcının cihazında kalan tek gizli veri: uygunluk sırrı.
 *
 * Bu değer hiçbir koşulda zincire, kuruma veya uzak bir sunucuya gitmez.
 * Kuruma yalnız commitment (H("stele:cm:", secret)) verilir. Sırrı bilen taraf
 * nullifier'ları önceden hesaplayabileceği için, sır merkezi olarak üretilirse
 * ledger'daki damga listesi o taraf için isim listesine dönüşür.
 */
export type StelePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createStelePrivateState = (secretKey: Uint8Array): StelePrivateState => ({
  secretKey,
});

const MERKLE_DEPTH = 16;

/**
 * Ağaçta bulunmayan bir commitment için şekilsel olarak geçerli ama
 * doğrulamayı geçemeyecek bir yol üretir.
 *
 * Witness fonksiyonu bir değer döndürmek zorunda; "bulamadım" diye hata
 * fırlatmak yerine geçersiz bir yol döndürürüz. Devre zaten iki koşulu birden
 * arıyor (checkRoot VE yaprak eşleşmesi), dolayısıyla bu yol reddedilir.
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
   * Commitment'ın uygunluk ağacındaki üyelik yolu.
   *
   * Yol yalnız kanıt üretimi sırasında kullanılır; zincire yazılan tek şey
   * kökün eşleştiği bilgisidir. Hangi yaprağın kanıtlandığı görünmez —
   * üyelik testinde Set kullanılmamasının sebebi tam olarak budur.
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
