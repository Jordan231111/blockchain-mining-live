# 👋 START HERE (no experience needed)

**What is this?** A tiny, working blockchain you can run on your laptop. You'll watch
new "blocks" get "mined" live in your browser. The whole thing is ~400 lines of
commented JavaScript — built so a total beginner can read it top to bottom.

**Time:** ~15 minutes to run it + understand the big picture.

---

## Step 0 — Check you have Node.js (2 min)

Open a terminal (Mac: Spotlight → "Terminal". Windows: Start → "PowerShell") and type:

```bash
node --version
```

- ✅ You see something like `v20.x.x` or higher → you're good, skip to Step 1.
- ❌ "command not found" → install it from **https://nodejs.org** (click the green
  "LTS" button, run the installer, then close + reopen your terminal and try again).

> You don't need to know Node. Just know: `node` runs JavaScript files, and `npm`
> downloads helper libraries. That's all we use them for.

---

## Step 1 — Run the live demo (2 min)

```bash
cd blockchain-mining-live
npm install     # downloads 3 libraries (express, socket.io, socket.io-client)
npm start       # starts the server
```

**Expected output:**

```
  ⛓️  Blockchain server running
  → Web demo:  http://localhost:3000
  → REST:      http://localhost:3000/api/chain
  → Difficulty: 2 (change it live in the UI)
```

Now open **http://localhost:3000** in your browser. You should see the mining page.

**Try this (30 seconds each):**
1. Click **⛏️ Mine** → watch hashes stream by until one starts with `00`. That's mining.
2. Drag **Difficulty** to 4 → mine again → notice it's much slower. That's proof-of-work.
3. Click **🧪 Tamper with block #1** → the green "chain valid" pill turns red.
   You just broke the chain (on purpose). Restart the server to reset it.

**If something fails:** see [Troubleshooting](#troubleshooting) at the bottom.

---

## Step 2 — Understand what just happened (5 min)

Here's the entire system. There are only 3 moving parts:

```
┌─────────────────┐      socket.io (live, two-way)      ┌─────────────────┐
│     BROWSER     │ ◄─────────────────────────────────► │     SERVER      │
│  public/app.js  │                                     │  src/server.js  │
│                 │   mine:start { data }        ──────► │                 │
│  shows blocks,  │   mine:progress { hash }     ◄────── │  owns the ONE   │
│  animates live  │   block:new { block }        ◄────── │  true chain,    │
│  hashes         │   chain:full { blocks }      ◄────── │  does mining    │
└─────────────────┘                                     └────────┬────────┘
                                                                 │ uses
                                                        ┌────────▼────────┐
                                                        │   BLOCKCHAIN    │
                                                        │ src/blockchain/ │
                                                        │ hash → Block →  │
                                                        │ chain + validate│
                                                        └─────────────────┘
```

- **Blockchain** = the math (hashing + mining + validation). No networking.
- **Server** = owns the chain, mines blocks, broadcasts updates to everyone watching.
- **Browser/Client** = displays the chain, sends "please mine this" requests.

Open two browser tabs to http://localhost:3000 and mine in one — both update.
That's the server *broadcasting*. That's the whole networking concept.

---

## Step 3 — Read the code in order (10 min)

Read these 5 files **in this order**. Each is short and explains itself at the top:

| # | File | What you'll learn | Lines |
|---|------|-------------------|-------|
| 1 | `examples/01-hashing.js` | Same input → same hash; 1 letter → totally different hash | ~20 |
| 2 | `examples/02-mining.js` | Mining = guessing a number until the hash starts with zeroes | ~25 |
| 3 | `examples/03-blockchain.js` | Blocks link together; tampering breaks the link | ~35 |
| 4 | `src/server.js` | The server: receives requests, mines, broadcasts to all | ~150 |
| 5 | `public/app.js` | The browser client: sends requests, draws blocks live | ~130 |

Run the first three without the server to see them work:

```bash
npm run lesson:hashing
npm run lesson:mining
npm run lesson:chain
```

**Expected output** of `lesson:chain` (the punchline — tampering gets caught):

```
Validate (before tamper): { valid: true }
Tampered with block #1 data (no re-mine).
Validate (after tamper): {
  valid: false,
  error: 'Block #1 hash mismatch — data was tampered with.',
  blockIndex: 1
}
```

---

## Step 4 — Go deeper

- **Glossary** (hash? nonce? difficulty? in one sentence each) → [`GLOSSARY.md`](GLOSSARY.md)
- **Full reference** (protocol tables, concepts, what's missing) → [`README.md`](README.md)
- **Terminal client** (same as browser, but text) → run `npm run client` in a second terminal

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node LTS from https://nodejs.org, reopen terminal |
| `EADDRINUSE :::3000` (port busy) | Something already uses port 3000. Stop it, or run `PORT=3001 npm start` and open http://localhost:3001 |
| `npm install` fails / no internet | You need internet once to download libraries. After that, everything runs offline |
| Page loads but mining does nothing | Check the terminal running `npm start` for errors; restart it with Ctrl+C then `npm start` again |
| "Already mining" message | Wait 2 seconds and retry — the server mines one block at a time (by design) |
