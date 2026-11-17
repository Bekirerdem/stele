# Stele

**Ask the questions people can't answer honestly.**

People under pressure say what is expected of them, not what they think. Economist Timur Kuran calls it *preference falsification*. The people in charge find out the truth only when it blows up: a wave of resignations, a scandal, a split.

Stele is a place to ask the questions that normally get no honest answer:

- "Are you planning to leave in the next six months? Why?"
- "Have you seen practices here that put someone at risk?"
- "Everyone said yes. What do you actually think?"

Members answer in their own words, without fear. The asker gets the truth before it blows up.

## What makes the answers worth reading

An anonymous answer is usually worthless: anyone could have written it, or one person ten times. In Stele every answer is **provably from a real member of the group, one per person**, and the asker **can't quietly bury it**.

| Property | How |
|---|---|
| A real member, but not which one | Zero-knowledge membership proof against a Merkle root of member keys |
| One answer per person | A nullifier bound to the question and the contract instance |
| The rules can't move afterwards | The rules document (questions, visibility, minimum, moderation rules, promise) is hashed into the contract at deployment |
| Nothing is buried silently | Removal is possible, but it stays listed with its reason, and the removal total only grows |
| No small-group exposure | A minimum number of answers (at least 3) before any is opened |
| Coercion doesn't pay | A member can replace their answer until the deadline; only the last counts, so "show me what you wrote" proves nothing |

## The answer shield

Cryptography hides **who sent** an answer. It does not hide **who wrote** it: language models identify the author of an anonymous text among a known set of candidates with high accuracy, and in a workplace the candidates are known.

So before an answer is sent, a model running inside a **NEAR AI confidential-computing enclave** (Intel TDX + NVIDIA) lists the parts that could identify the writer: names, dates, meetings, roles, unusual details, style. The writer decides, part by part, whether to generalize it or keep it, because sometimes the detail *is* the evidence ("one nurse for twelve patients"). Then the style is neutralized, and code (not the model) checks that every part the writer chose to generalize is really gone.

The draft is encrypted on the device to a key the enclave attests to; the relay forwards ciphertext only; every reply's signature is checked against the attested signer. No party sees both the text and its author.

## Why Midnight

| Need | Midnight |
|---|---|
| Prove membership without revealing the member | ZK proofs; the compiler refuses code that leaks private data |
| One person, one answer | Nullifiers in contract state |
| Paying fees must not expose the writer | Fees are paid in shielded DUST |
| Who sees what is fixed in code | Selective disclosure; visibility is committed at deployment |

## Layout

```
contract/stele.compact     the contract (Compact, language 0.28)
contract/witnesses.ts      the two witnesses: the secret and the Merkle path
src/crypto.ts              keys, nullifiers, the rules hash, padded and sealed answer blobs
src/shield-core.ts         the shield's prompts, response shapes and code checks (no I/O)
src/shield.ts              the shield on NEAR AI private inference (end-to-end encrypted, verified)
src/store.ts               answer blob storage (local, or the relay)
scripts/cli.ts             ask, enrol, open, answer, close, remove, read, status, verify
relay/                     Cloudflare Worker: encrypted shield proxy + content-addressed answer store
src/test/                  simulator tests (contract guards, privacy invariants, shield checks)
```

## Run it locally

Requirements: Node 22+, Docker, the Compact toolchain (`compact update 0.36.1`).

```bash
npm install
npm run compile                 # contract + proving keys
npm run test:sim                # in-memory tests, no network
npm run env:up                  # local node, indexer, proof server
npm run wait:dust

# the asker
STELE_KEYS_DIR=.stele/asker npm run stele -- asker keygen
STELE_KEYS_DIR=.stele/asker npm run stele -- ask --rules examples/leaving.rules.json --label demo-1
STELE_KEYS_DIR=.stele/asker npm run stele -- add-asker-key
STELE_KEYS_DIR=.stele/asker npm run stele -- enrol <memberKey> <memberKey> <memberKey>
STELE_KEYS_DIR=.stele/asker npm run stele -- open --minutes 30

# a member (NEARAI_API_KEY enables the shield)
STELE_KEYS_DIR=.stele/m1 npm run stele -- member keygen
STELE_KEYS_DIR=.stele/m1 npm run stele -- answer --wallet BOB

# anyone
npm run stele -- status
npm run stele -- close
npm run stele -- verify
STELE_KEYS_DIR=.stele/asker npm run stele -- read
```

## Honest limits

- Pseudonymous and cryptographically protected, not "fully anonymous".
- The shield helps; it is not a guarantee. The last word, and the responsibility, are the writer's.
- Transaction timing is public: when a nullifier answered can be seen. Batching through the relay is the planned defence.
- The minimum-answers rule is enforced by the clients and the relay, not yet by cryptography.
- Not audited.

## Status

v0.2 — contract, simulator tests, CLI, shield and relay. Web app next.

MIT licensed. Network helpers in `src/` are adapted from [midnightntwrk/midnight-examples](https://github.com/midnightntwrk/midnight-examples) (Apache-2.0).
