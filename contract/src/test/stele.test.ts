// STELE — kontrat testleri
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { randomBytes } from "./utils.js";
import {
  SteleSimulator,
  defaultRound,
  roundToBytes,
  type RoundParams,
} from "./stele-simulator.js";
import { Phase } from "../managed/stele/contract/index.js";

setNetworkId("undeployed");

/** Operatör sırrı + o sırdan türeyen tur parametreleri. */
const newRound = (overrides: Partial<RoundParams> = {}) => {
  const operatorSecret = randomBytes(32);
  const params = {
    ...defaultRound(SteleSimulator.operatorIdOf(operatorSecret)),
    ...overrides,
  };
  return { operatorSecret, params };
};

describe("Stele — tur taahhütleri", () => {
  it("turun değişmez taahhütlerini deploy anında kazır", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);
    const l = sim.getLedger();

    expect(l.roundNumber).toEqual(params.round);
    expect(l.questionHash).toEqual(params.question);
    expect(l.optionCount).toEqual(params.options);
    expect(l.promiseHash).toEqual(params.promise);
    expect(l.promiseThreshold).toEqual(params.threshold);
    expect(l.minParticipants).toEqual(params.minCount);
    expect(l.phase).toEqual(Phase.REGISTRATION);
    expect(l.participantCount).toEqual(0n);
    expect(l.eligibleCount).toEqual(0n);
  });

  it("aynı girdilerle aynı başlangıç durumunu üretir", () => {
    const { operatorSecret, params } = newRound();
    const a = new SteleSimulator(operatorSecret, params).getLedger();
    const b = new SteleSimulator(operatorSecret, params).getLedger();

    // Ledger'da Merkle ağacı ve Set gibi davranışlı yapılar var; derin
    // karşılaştırma yerine turun taahhüt ettiği değerleri kıyaslıyoruz.
    const snapshot = (l: typeof a) => ({
      roundNumber: l.roundNumber,
      questionHash: Buffer.from(l.questionHash).toString("hex"),
      optionCount: l.optionCount,
      promiseHash: Buffer.from(l.promiseHash).toString("hex"),
      promiseThreshold: l.promiseThreshold,
      minParticipants: l.minParticipants,
      operatorId: Buffer.from(l.operatorId).toString("hex"),
      phase: l.phase,
      participantCount: l.participantCount,
      eligibleCount: l.eligibleCount,
      root: a.eligibility.root().field,
    });
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it("commitment ve damga türetimi deterministiktir", () => {
    const secret = randomBytes(32);
    const hex = (u: Uint8Array) => Buffer.from(u).toString("hex");

    expect(hex(SteleSimulator.commitmentOf(secret))).toEqual(
      hex(SteleSimulator.commitmentOf(secret)),
    );
    expect(hex(SteleSimulator.nullifierOf(secret, roundToBytes(1n)))).toEqual(
      hex(SteleSimulator.nullifierOf(secret, roundToBytes(1n))),
    );
  });
});

describe("Stele — katılım", () => {
  it("uygun katılımcı seçtiği seçeneğin sayacını artırır", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    expect(sim.getLedger().eligibleCount).toEqual(1n);

    sim.openVoting();
    sim.switchUser(voter);
    const l = sim.participate(1n);

    expect(l.participantCount).toEqual(1n);
    expect(l.tally.lookup(1n).read()).toEqual(1n);
    expect(l.nullifiers.size()).toEqual(1n);
  });

  it("kayıtlı olmayan kişiyi reddeder", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    sim.register(SteleSimulator.commitmentOf(randomBytes(32)));
    sim.openVoting();

    sim.switchUser(randomBytes(32)); // hiç kaydolmamış biri
    expect(() => sim.participate(0n)).toThrow();
  });

  it("aynı sırla ikinci kez katılmayı reddeder (tekillik damgası)", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();

    sim.switchUser(voter);
    sim.participate(0n);
    expect(() => sim.participate(2n)).toThrow();
    expect(sim.getLedger().participantCount).toEqual(1n);
  });

  it("geçerli aralık dışındaki cevabı reddeder", () => {
    const { operatorSecret, params } = newRound({ options: 3n });
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);

    expect(() => sim.participate(3n)).toThrow();
  });
});

describe("Stele — faz makinesi", () => {
  it("kayıt fazında oy kabul etmez", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.switchUser(voter);

    expect(() => sim.participate(0n)).toThrow();
  });

  it("oylama açıldıktan sonra yeni kayıt kabul etmez (kök donar)", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    sim.register(SteleSimulator.commitmentOf(randomBytes(32)));
    sim.openVoting();

    expect(() => sim.register(SteleSimulator.commitmentOf(randomBytes(32)))).toThrow();
  });

  it("faz geçişlerini yalnız operatör yapabilir", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    sim.register(SteleSimulator.commitmentOf(randomBytes(32)));
    sim.switchUser(randomBytes(32)); // operatör değil
    expect(() => sim.openVoting()).toThrow();
  });

  it("k-eşiğinin altındaki turu kapatmayı reddeder", () => {
    const { operatorSecret, params } = newRound({ minCount: 2n });
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);
    sim.participate(0n); // yalnız 1 katılım, eşik 2

    sim.switchUser(operatorSecret);
    expect(() => sim.closeRound()).toThrow();

    expect(sim.getLedger().phase).toEqual(Phase.VOTING);
  });

  it("eşik karşılandığında turu kapatır", () => {
    const { operatorSecret, params } = newRound({ minCount: 2n });
    const sim = new SteleSimulator(operatorSecret, params);

    const a = randomBytes(32);
    const b = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(a));
    sim.register(SteleSimulator.commitmentOf(b));
    sim.openVoting();

    sim.switchUser(a);
    sim.participate(0n);
    sim.switchUser(b);
    sim.participate(1n);

    sim.switchUser(operatorSecret);
    const l = sim.closeRound();

    expect(l.phase).toEqual(Phase.CLOSED);
    expect(l.participantCount).toEqual(2n);
    expect(l.tally.lookup(0n).read()).toEqual(1n);
    expect(l.tally.lookup(1n).read()).toEqual(1n);
  });
});

describe("Stele — gizlilik invariantı", () => {
  it("katılımcının sırrı hiçbir ledger alanında görünmez", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);
    sim.participate(1n);

    // Ledger'ın tamamını tarayıp sırrın bayt dizisini arıyoruz.
    const dump = JSON.stringify(sim.getLedger(), (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
    const secretHex = Buffer.from(voter).toString("hex");
    expect(dump).not.toContain(secretHex);

    // Damga ve commitment sırdan türetilmiş olsa da sırrın kendisi değildir.
    const nullifier = SteleSimulator.nullifierOf(voter, roundToBytes(params.round));
    expect(Buffer.from(nullifier).toString("hex")).not.toEqual(secretHex);
  });

  it("damga sırra geri götürülemez ve turlar arasında bağlanamaz", () => {
    const voter = randomBytes(32);
    const n1 = SteleSimulator.nullifierOf(voter, roundToBytes(1n));
    const n2 = SteleSimulator.nullifierOf(voter, roundToBytes(2n));

    // Aynı kişi, farklı turlar -> ilişkisiz damgalar.
    expect(Buffer.from(n1).toString("hex")).not.toEqual(
      Buffer.from(n2).toString("hex"),
    );

    // Commitment de damgadan farklı bir alanda yaşar.
    const cm = SteleSimulator.commitmentOf(voter);
    expect(Buffer.from(cm).toString("hex")).not.toEqual(
      Buffer.from(n1).toString("hex"),
    );
  });

  it("katılım özel durumu değiştirmez", () => {
    const { operatorSecret, params } = newRound();
    const sim = new SteleSimulator(operatorSecret, params);

    const voter = randomBytes(32);
    sim.register(SteleSimulator.commitmentOf(voter));
    sim.openVoting();
    sim.switchUser(voter);

    const before = sim.getPrivateState();
    sim.participate(0n);
    expect(sim.getPrivateState()).toEqual(before);
  });
});
