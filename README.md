# ⛓️ Blockchain Mining — Live

> A **super-readable teaching codebase** for the exact assignment in the screenshot:
> *server file + client file, hashing + server/client communication over socket.io, live mining demo. No consensus yet.*

**You will learn, in order:**
1. **Hashing** — SHA-256 fingerprints (`src/blockchain/hash.js`)
2. **Blocks** — index / data / previousHash / nonce / hash (`src/blockchain/Block.js`)
3. **Mining** — brute-force proof-of-work (`Block.mine()` / `mineAsync()`)
4. **The chain** — linking + validation / tamper detection (`src/blockchain/Blockchain.js`)
5. **Server** — canonical chain + live broadcast (`src/server.js`)
6. **Clients** — terminal client (`src/client.js`) + browser live demo (`public/app.js`)

---

## 1. Run it (2 minutes)

```bash
cd blockchain-mining-live
npm install
npm start
# → open http://localhost:3000
```

Then, in a **second terminal** (optional but fun — watch two clients stay in sync):

```bash
npm run client
# Commands: view | mine hello | difficulty 3 | tamper 1 HACKED | exit
```

### The live demo section (for your site)

`http://localhost:3000` **is** the "section demonstrating blockchain mining live":
- Type data → click **Mine** → watch real hashes stream (`mine:progress` events) until one hits the target.
- Drag **difficulty** 1→5 and feel exponential slowdown.
- Click **Tamper with block #1** and watch validation go red.

Embed it in your site with an `<iframe src="http://your-server:3000">` or copy `public/` into your frontend.

---

## 2. Lessons (no server needed)

Run these standalone scripts — each is < 40 lines and heavily commented:

```bash
npm run lesson:hashing  # same input → same hash; 1 letter → totally different hash
npm run lesson:mining   # mine at difficulty 2,3,4 and feel the slowdown
npm run lesson:chain    # build a chain, validate ✅, tamper, validate ❌
```

Read them in `examples/` — they are the fastest way to "get" blockchain.

---

## 3. Project map

```
blockchain-mining-live/
├── src/
│   ├── blockchain/
│   │   ├── hash.js        Lesson 1: sha256() wrapper + explainer
│   │   ├── Block.js       Lesson 2: Block structure + mine() / mineAsync()
│   │   └── Blockchain.js  Lesson 3: chain array + addBlock() + validate() + tamper()
│   ├── server.js          ★ SERVER FILE: express + socket.io, owns the chain
│   └── client.js          ★ CLIENT FILE (terminal): socket.io-client + REPL
├── public/
│   ├── index.html         Live mining page (the embeddable demo section)
│   ├── app.js             ★ CLIENT FILE (browser): same protocol, visual version
│   └── styles.css         Dark theme, no framework
├── examples/
│   ├── 01-hashing.js      Run me first
│   ├── 02-mining.js       Run me second
│   └── 03-blockchain.js   Run me third
└── package.json
```

**Where to look first?** Open these two side-by-side — every event is commented on both ends:
- `src/server.js` (emits / listens)
- `public/app.js` (listens / emits)

---

## 4. The socket.io protocol (the whole API)

### Client → Server

| Event | Payload | Meaning |
|---|---|---|
| `chain:get` | — | "Send me the full chain." |
| `mine:start` | `{ data }` | "Mine a block containing `data`." |
| `chain:tamper` | `{ index, newData }` | "Corrupt a block (demo validation)." |
| `difficulty:set` | `{ difficulty: 1-5 }` | "Make mining easier/harder." |

### Server → Client(s)

| Event | Payload | Meaning |
|---|---|---|
| `chain:full` | `{ difficulty, blocks, validation }` | Full state (sent on connect + after every change). |
| `mine:progress` | `{ nonce, hash, attempts }` | One hash attempt — streamed live while mining. |
| `block:new` | `{ block }` | A block was just mined (broadcast to ALL). |
| `mine:done` | `{ block, elapsedMs }` | Mining finished + how long it took. |
| `mine:error` | `{ message }` | e.g. "already mining" / bad difficulty. |

That's it. Five outgoing, four incoming. If you understand this table, you understand the networking half of the assignment.

### socket.io in 30 seconds (for the "take a look at socket.io API" part)

```js
// SERVER (src/server.js)
io.on('connection', (socket) => {   // a client connected
  socket.on('mine:start', handler); // listen to ONE client
  socket.emit('chain:full', data);  // reply to ONE client
  io.emit('block:new', block);      // broadcast to ALL clients
});

// CLIENT (src/client.js / public/app.js)
const socket = io('http://localhost:3000');
socket.on('chain:full', render);    // listen
socket.emit('mine:start', { data });// send
```

Unlike REST (request → one response), a socket stays open so the server can **push** `mine:progress` 1000s of times per block. That's what makes the "live" demo possible.

---

## 5. Core concepts (one paragraph each)

**Hashing.** `sha256("hello")` → `2cf24dba…`. Deterministic, avalanche (1-letter change = new hash), one-way, fixed 64 chars. Every block's ID is a hash of its contents — so any edit changes the ID.

**Block.** `{ index, timestamp, data, previousHash, nonce, hash }`. Think of it as a row in a spreadsheet that fingerprints itself *and* names the row before it.

**Chaining.** Block N stores `previousHash = hash(block N-1)`. Change block 1 and its hash changes → block 2's `previousHash` is now wrong → block 3's is wrong → … tampering is instantly visible. `Blockchain.validate()` just re-checks every link.

**Mining (proof-of-work).** To add a block you must find a `nonce` making `hash` start with N zeroes (`difficulty`). No shortcut — try 0,1,2,… until lucky. Difficulty 2 ≈ hundreds of tries (instant); difficulty 5 ≈ millions (slow). The "work" is what makes rewriting history expensive.

**Server vs client.** The server owns the one true chain (in memory) and does the mining so every viewer sees the same thing. Clients are dumb + live: they render `chain:full`, animate `mine:progress`, and send `mine:start` requests. Open two browsers — both stay in sync because the server broadcasts.

---

## 6. What's deliberately missing (your "part 2")

Per the brief — *"No need for consensus algorithm yet"* — this demo skips:

- [ ] **Consensus** — longest-chain rule, peer-to-peer sync, fork resolution
- [ ] **Wallets/signatures** — ECDSA keys, `Alice signs $5 → Bob`
- [ ] **Mempool** — queue of pending transactions per block (currently 1 payload = 1 block)
- [ ] **Persistence** — chain lives in RAM; restart = fresh genesis (add `JSON.stringify(chain)` to disk)
- [ ] **Difficulty retargeting** — Bitcoin-style auto-adjust every N blocks

Each is a clean extension: `Blockchain.js` is where consensus/persistence go, `server.js` is where p2p gossip goes.

---

## 7. FAQ for the teammate in the screenshot

> *"Is this a completely new thing? How will this be integrated?"*

Yes — new, standalone teaching repo. Integration path for your site:
1. **Now:** iframe or copy `public/` as your "live mining demo" section.
2. **Next:** keep `src/blockchain/` as-is, swap `src/server.js`'s in-memory chain for a DB-backed one.
3. **Later:** add consensus (multi-server) without touching the mining/validation math.

> *"You just want me to understand how it works in general?"*

Exactly. Read in this order: `examples/01-hashing.js` → `02-mining.js` → `03-blockchain.js` → `src/server.js` → `public/app.js`. ~400 lines total, every tricky line commented. Then draft your own server/client files — they'll look a lot like these.

---

## License

MIT — use it in your site freely.
