# STELE

**An institution records its question, who may answer it, when it closes, and what it promises to do about the outcome — in a way it cannot take back. Respondents stay invisible; the count and the promise are publicly verifiable.**

Stele is not a survey tool. It is a **public record of accountability**. Collecting answers is the mechanism that produces the record; the product is what makes the record impossible to dispute.

It takes its name from the stele of Hammurabi: laws carved into stone and raised in the public square, where everyone can read them and no one can erase them.

Built on [Midnight Network](https://midnight.network/) in Compact.

---

## The problem

Feedback systems have three separate breaks of trust:

1. **"Will they know it was me?"** — fear of retaliation. A patient stays quiet to avoid being labelled difficult; a student softens an answer to protect a grade.
2. **"Even if I speak, nothing changes — they will bury it."**
3. **"Are the published numbers real?"**

Existing survey tools only attempt the first, and structurally cannot address the other two: **the party collecting the data is the same party reporting the result.**

Stele moves all three into the architecture. Identity never reaches the chain; the count and the institution's promise are engraved into it, where a third party can verify them independently.

---

## The unit: a ROUND

A round is five commitments recorded at once, none of which can be withdrawn:

| Commitment | Ledger field |
|---|---|
| **The question** (single, closed-ended) | `questionHash`, `optionCount` |
| **The audience** (who may answer) | `eligibility` root, `eligibleCount` |
| **Its place** in the registry | `roundNumber` |
| **The promise** tied to the outcome | `promiseHash`, `promiseThreshold` |
| **The anonymity floor** | `minParticipants` |

The fourth is the heart of the product. Engraving the count does not answer *"what will change if I speak?"* — **engraving the promise does.** When opening a round the institution states "if it comes in below this threshold, here is what I will do". When the next round opens, whether that promise was kept sits in the same registry, side by side with it.

---

## Lifecycle

```
REGISTRATION  ──►  VOTING  ──►  CLOSED
```

- **REGISTRATION** — participants submit commitments; the eligibility tree grows.
- **VOTING** — the root **freezes**; only participation is accepted.
- **CLOSED** — the count is final. A round below the anonymity floor cannot be closed.

Freezing the root closes three holes at once: proofs invalidated by a root that shifts while they are being produced, ghost entries added after the operator has seen where the round is heading, and differencing attacks that isolate a single person by running the same question against two slightly different sets.

---

## Privacy model

### What is on chain (visible to everyone)

Round number · hash of the question and its options · eligibility root · how many registered · the promise threshold and its hash · phase · spent uniqueness tags · per-option tally · total participation.

### What never reaches the chain (held only on the participant's device)

The eligibility secret · the Merkle membership path · whose answer is whose.

### What the circuit proves

> *I know the secret behind a commitment in the eligibility tree **and** my tag for this round has not been spent **and** my answer is within range.*

### What an observer learns, and what it cannot

**Learns:** how many registered, how many took part, how many votes each option received, when the round opened and closed, and what the institution promised.

**Cannot learn:** who took part, who answered what, which registration a tag belongs to, or whether two tags in different rounds belong to the same person.

### Cryptographic rules

- `commitment = persistentHash("stele:cm:", secret)` — **the secret is generated on the participant's own device.** Whoever knows a secret can precompute its nullifiers, so a centrally issued secret would turn the public tag list into a roster of names.
- `nullifier = persistentHash("stele:nul:", roundNumber, secret)` — the round number enters the domain separator, so one person's tags in different rounds cannot be linked.
- A tag is **never** derived from a commitment; commitments are held by the institution.
- `transientHash` is used for no value written to the ledger — it is not stable across protocol upgrades.
- The membership proof does **not** use a `Set`: a Set reveals which element was tested. Membership is proven with a `HistoricMerkleTree` and a witness path. A `Set` is safe for the spent-tag check, because a tag is a value that is meant to be public.
- Membership verification requires two conditions together: the root is recognised **and** the leaf is ours. The root check alone could be passed with a valid but unrelated leaf.
- Proofs are generated **on the user's own device**. A hosted proof server is not an option here: it sees the witness in plain text.

---

## Honest limits

These are stated rather than hidden, because hiding them only postpones the first serious review.

| Limit | Reality |
|---|---|
| **Live tally** | The ledger is public, so the count moves while the round is open. In small groups this can be correlated by timing — which is why the anonymity floor is a circuit rule and not a product setting. The full fix is commit-reveal, planned for v2. |
| **Uniqueness is not personhood** | The circuit proves "I hold a secret and have not spent it this round". It does not prove a human is behind it. Stele makes **no claim** to stop automated responses; a closed roster with no rewards simply does not import that economy. |
| **The secret is also a receipt** | Anyone who shares their secret has also shared their answer. Coercion is not solved. |
| **Wording** | Legally this is not "anonymous" but **pseudonymous and cryptographically protected**. |
| **Registration** | The institution sees who registered, though never their secret. Excluding a critic from the roster is not solved by the protocol; the defence is that the roster is public. |
| **Mobile** | Participation requires proof generation; v1 targets the desktop. |
| **Assurance** | This code is **not audited**. What can be claimed: open source, reproducible builds, privacy-invariant tests, and static analysis. |

---

## The registry

The chain cannot be searched for "every contract of this kind" — the indexer answers about an address you already know. So a verifier cannot scan for a round it was never told about, and on its own the claim that a round cannot be buried would rest on nothing.

One permanent append-only contract fixes that, with a rule: **only rounds recorded in the registry count.** A round number can be claimed once and never reassigned. Burying a round then no longer means hiding it — it means leaving it unofficial, which is a far weaker thing to do.

Recording the highest number alongside the count makes a skipped round visible arithmetically: three entries reaching number five means two were never filled. That is readable without searching anything.

## The mirror

Midnight has no source-verification service, so a deployed contract is otherwise only as trustworthy as whoever tells you what it contains.

Every circuit on chain carries a verifier key, and the same source compiled with the same pinned compiler produces the same key byte for byte. So:

```bash
cd stele-cli
npm run verify -- <contract-address>
```

prints what the round committed to and the verifier keys of the local build. Recompile the published source, compare the keys, and you have confirmed the deployed contract is the published one — without asking the operator for anything.

Publish the question and promise texts alongside a round; their SHA-256 digests must equal the hashes on chain, or the round was reworded after the fact.

## Setup

Development is supported on Linux and macOS. On Windows, **WSL2** is required.

```bash
# Toolchain
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update            # compiler 0.31.1

# Proof server — runs locally, so the witness never leaves the device
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0

# Dependencies (Node >= 24)
npm install
```

## Build and test

```bash
cd contract
npm run compact      # both contracts -> managed/ (zkir + prover/verifier keys)
npm run typecheck
npx vitest run       # 21 tests
```

The suite proves five things: that a round's commitments are immutable, that participation and the uniqueness tag behave correctly, that the phase rules hold, that the registry refuses to reassign a number and exposes a gap, and the **privacy invariant** — that the participant's secret appears in no ledger field.

## Running a round

```bash
cd stele-cli
npm run addresses          # which address to fund
npm run balance            # has the faucet arrived
npm run deploy:preprod     # open a round non-interactively
npm run preprod-remote     # interactive operator/participant client
npm run verify -- <addr>   # the mirror
```

Deployment reads the round's commitments from the environment (`STELE_QUESTION`, `STELE_PROMISE`, `STELE_OPTIONS`, `STELE_THRESHOLD`, `STELE_MIN`, `STELE_ROUND`) so a round can be reproduced exactly.

> A note for anyone hitting the same wall: the SDK's `waitForUnshieldedFunds` reports a balance only after the wallet has fully synced, and Preprod is around 1.9 million blocks deep. Waiting for the balance itself instead finds the funds in seconds and keeps memory flat.

---

## Layout

```
stele/
├── contract/     Compact contract, witness layer, tests
├── api/          Shared types and contract API
├── stele-cli/    Command-line client
└── stele-ui/     Web interface
```

## Versions

| Component | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23 |
| Proof server | 8.1.0 |
| Midnight.js | 4.1.1 |
| DApp connector API | 4.0.1 |
| Node | >= 24 |

## License

Apache-2.0
