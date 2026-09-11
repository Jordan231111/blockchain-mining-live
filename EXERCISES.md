# 💪 Exercises — from reading to rewriting

You read the code. Now *prove* you own it. Do these in order — each one only
needs what the previous ones taught you.

**Your safety net:** after every exercise, run:

```bash
npm test
```

All 15 tests green = you didn't break anything. A failing test's name tells you
exactly what broke. (Exercises 1–5 are designed so the tests keep passing.
Exercise 6 *uses* the tests as the grader.)

**Stuck?** Each exercise has hints that start vague and get specific. Try for
10 minutes before reading the next hint.

---

## Exercise 1 — Warm-up: mine from the terminal (no code, 5 min)

**Goal:** mine a block without touching the browser, using the terminal client.

1. Terminal 1: `npm start`
2. Terminal 2: `npm run client`
3. In the client, type: `mine Hello from the terminal`
4. Then type: `view`

**Expected output** (hashes will differ — that's normal, mining is random):

```
[you] mining request sent: "Hello from the terminal"
[block:new] #1 mined! hash=00... nonce=...
────────────────────────────────────────────────────────────────
#1  hash=00...
     prev=a9831a2e0b64958b...
     nonce=...  time=...
     data="Hello from the terminal"
```

**You learned:** the server doesn't care *who* asks — browser and terminal are
the same 3-line socket.io conversation. Open `src/client.js` and find the line
that sent your message (search for `mine:start`).

---

## Exercise 2 — Change the Block: add a `note` field (15 min)

**Goal:** every block carries a human-readable `note`, and tampering with the
note is caught by validation — just like `data`.

**Rules:** `npm test` must stay green. (The tests never check exact hashes, so
changing what goes *into* the hash is safe.)

<details>
<summary>Hint 1 (where to look)</summary>

Two methods in `src/blockchain/Block.js`: the `constructor` (add the field) and
`calculateHash()` (mix it into the fingerprint). Then check `Blockchain.addBlock()`
— does it need to pass the note through, or can it default?
</details>

<details>
<summary>Hint 2 (the trap)</summary>

If you add `note` to the constructor but forget `calculateHash()`, validation
will NOT catch note-tampering — because the fingerprint doesn't cover it.
That's the whole lesson: **a hash only protects what you put into it.**
</details>

<details>
<summary>Hint 3 (verify it works)</summary>

After your change, run this in Node and confirm the second validation fails:

```bash
node -e "
const Blockchain = require('./src/blockchain/Blockchain');
(async () => {
  const c = new Blockchain(1);
  await c.addBlock('pay rent');
  c.chain[1].note = 'forged note';
  console.log(c.validate());
})();
"
```

</details>

**Expected output:** `validate()` returns `{ valid: false, blockIndex: 1, ... }`
after forging the note, and `npm test` is still 15/15 green.

**You learned:** what a hash *covers* is a design decision, and validation is
only as strong as that coverage.

---

## Exercise 3 — Change the protocol: add a `chain:count` event (20 min)

**Goal:** the terminal client gets a new command, `count`, that asks the server
"how many blocks?" and prints the answer. No page refresh, no restart logic —
pure socket.io request/reply.

<details>
<summary>Hint 1 (the pattern — 3 lines, twice)</summary>

SERVER (`src/server.js`), inside `io.on('connection', ...)`:

```js
socket.on('chain:count', () => {
  socket.emit('chain:count:reply', { count: blockchain.chain.length });
});
```

CLIENT (`src/client.js`): listen for `chain:count:reply` to print it, and add a
`count` case to the `switch` that emits `chain:count`.
</details>

<details>
<summary>Hint 2 (naming)</summary>

Event names are just strings you invent — `chain:count` / `chain:count:reply`
is a convention (request + `:reply`), not a rule. Pick names a stranger could
guess the meaning of.
</details>

**Expected output** in the terminal client:

```
> count
[count] The chain has 3 block(s).
```

**You learned:** the "protocol" from the README is just agreed-upon strings.
Adding a feature = agreeing on a new string on both ends. That's all of socket.io.

---

## Exercise 4 — Change the UI: show mining stats (20 min)

**Goal:** after each mine, the browser shows *"Block #N mined in Xms after Y attempts."*
The server already sends everything you need — the browser just doesn't display it yet.

<details>
<summary>Hint 1 (what's missing)</summary>

Look at what the server emits in `src/server.js` on `mine:done`: `{ block, elapsedMs }`.
Now look at the `mine:done` handler in `public/app.js`. The `attempts` count exists
during `mine:progress` but isn't saved anywhere. Where could the browser remember it?
</details>

<details>
<summary>Hint 2 (simplest fix)</summary>

Keep a `let lastAttempts = 0;` at the top of `public/app.js`, update it in the
`mine:progress` handler, and use it in the `mine:done` handler. Three lines total.
</details>

**Expected output** in the browser under the Mine button:

```
✅ Block #2 mined in 34ms after 412 attempts — nonce 411.
```

(Numbers will differ every time — mining is random.)

**You learned:** client/server split in practice — the server *streams facts*,
the client *decides what to show*. Most "features" are client-only changes.

---

## Exercise 5 — Bigger build: save the chain to disk (30–45 min)

**Goal:** restarting the server no longer wipes the chain. Every new block is
saved to `chain.json`; on startup, the server loads it back if it exists.

**Why this one:** it's the most-requested "part 2" feature, and 90% of the work
already exists: `blockchain.toJSON()` serializes, `Blockchain.fromJSON()` revives.
You're just adding a file in the middle.

<details>
<summary>Hint 1 (the two spots)</summary>

In `src/server.js`: (1) right after `const blockchain = new Blockchain(2)` —
"if `chain.json` exists, load it instead"; (2) right after a block is mined —
"save". Node's `fs.readFileSync` / `fs.writeFileSync` are all you need.
</details>

<details>
<summary>Hint 2 (validate on load)</summary>

Don't trust the file blindly — run `.validate()` after loading. If it says
invalid, log a warning and start fresh. Real blockchains do exactly this with
peers' chains (minus the trust part — that's consensus, still part 2).
</details>

<details>
<summary>Hint 3 (don't commit the data file)</summary>

Add `chain.json` to `.gitignore` — it's runtime data, like a database, not source code.
</details>

**Expected output:**

```bash
npm start
# mine 2 blocks in the browser, then Ctrl+C, then:
npm start
# → chain still has 3 blocks (genesis + 2), validation green
```

**You learned:** serialization round-trips (`toJSON`/`fromJSON`) are the seam
between memory, disk, and network. Persistence, APIs, and future p2p sync all
stand on that one seam.

---

## Exercise 6 — Final boss: rewrite `Block.js` from memory 🏆 (30 min)

**Goal:** prove you don't need the original anymore.

1. Run `npm test` — confirm 15/15 green. This is your "before" photo.
2. Rename `src/blockchain/Block.js` to `Block.js.backup` (don't delete — bravery,
   not recklessness).
3. Create an empty `src/blockchain/Block.js` and rewrite it from memory:
   constructor, `calculateHash()`, `genesis()`, `mine()`, `mineAsync()`, `fromJSON()`.
4. Run `npm test`. Fix failures one by one until 15/15 green again.
5. Diff against your backup: `diff src/blockchain/Block.js src/blockchain/Block.js.backup`
   — different variable names are fine; different *behavior* is what tests catch.

**Expected output:** `npm test` green with YOUR implementation. The diff will
show your personal style — and that's the point. There is no single "right"
blockchain file; there's only behavior, and now you can write behavior that passes.

**You learned:** everything. If Exercise 6 took under 30 minutes, you can genuinely
say you understand blockchains at the code level — and adapt this repo into your site.

---

## Scorecard

| Done | Meaning |
|---|---|
| 1–2 | You can navigate and tweak the code |
| 3–4 | You can add features to both ends of the protocol |
| 5 | You can extend the architecture (persistence → consensus is next) |
| 6 | You can rewrite it from scratch — it's yours now |
