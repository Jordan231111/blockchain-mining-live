# 📖 Glossary — every term in one sentence

Read top to bottom. Each term only uses words defined above it.

| Term | Meaning |
|---|---|
| **Hash** | A 64-character fingerprint of some data — same data always gives the same fingerprint, and changing even 1 letter gives a totally different one. Try: `npm run lesson:hashing`. |
| **SHA-256** | The specific fingerprint formula we use (made by the NSA, used by Bitcoin). It's one-way: fingerprint → data is impossible. |
| **Block** | A container holding: its position (`index`), creation time, some `data`, the previous block's fingerprint, a `nonce`, and its own fingerprint. See `src/blockchain/Block.js`. |
| **Nonce** | A throwaway number ("number used once") that miners keep changing to get different fingerprints. The only thing you vary while mining. |
| **Difficulty** | How many zeroes a fingerprint must start with to count (2 = `00…`, 4 = `0000…`). Each extra zero makes mining ~16× slower. |
| **Mining** | Brute-force guessing: try nonce 0, 1, 2… until the block's fingerprint starts with enough zeroes. That's it — there is no shortcut. |
| **Proof-of-work** | The mined block itself, which *proves* someone did the guessing work. Verifying takes 1 try; producing took thousands. |
| **previousHash** | The field where each block stores the fingerprint of the block before it. This single field is what makes it a *chain*. |
| **Chain** | Blocks linked by `previousHash`: Genesis → #1 → #2 → … Break one link and every block after it is visibly wrong. |
| **Genesis block** | Block #0 — the first one, with no predecessor (`previousHash` is just `"0"` by convention). |
| **Validation** | Re-checking every block: (1) fingerprint matches contents, (2) `previousHash` matches the real previous block, (3) fingerprint meets difficulty. See `Blockchain.validate()`. |
| **Tampering** | Editing an old block's data without re-mining it (and everything after it). Validation catches this instantly. Try the 🧪 button in the demo. |
| **Server** | The program (`src/server.js`) that owns the one true chain, does the mining, and broadcasts updates. Run with `npm start`. |
| **Client** | Anything that *views* the chain and *asks* the server to mine: the browser page (`public/app.js`) or the terminal (`src/client.js`). Clients never mine here — the server does. |
| **socket.io** | The library that keeps a live, two-way connection open between server and clients so the server can *push* updates (like live hash attempts) instead of clients having to refresh. |
| **Broadcast** | The server sending one message to *every* connected client at once (e.g. "new block!"). Open two browser tabs and mine — both update. |
| **Consensus** | **Not in this demo (on purpose).** The rules for how *many* servers agree on one chain. That's part 2 — this repo has one server, so no agreement is needed. |

## Analogy (if it still feels abstract)

Think of a shared notebook where each page ends with a fingerprint of everything
written so far, and starting a new page requires winning a dice lottery:
- **Hash** = the fingerprint at the bottom of each page.
- **Mining** = rolling dice until you win the right to start the next page.
- **Chain** = because each page fingerprints the last one, ripping out page 5 to
  rewrite it means re-winning the lottery for pages 6, 7, 8… — too expensive to fake.
