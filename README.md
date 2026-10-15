# Blockchain socket demo

A basic blockchain with SHA-256 mining, socket communication, validation, and fork resolution. Two implementation files:

- [`src/client.js`](src/client.js): sends terminal commands and displays server replies. Start here for the socket flow.
- [`src/server.js`](src/server.js): `hashBlock` hashes a block, `mine` searches for a nonce, `validate` checks a chain, and `replace` chooses between chains. `startNode` handles networking.

[`demo.js`](demo.js) runs the four automated checks below; it is separate from the client and blockchain implementation.

The blockchain and mining visualizers are separate work; they can connect to the socket API below.

## Run the demonstration

Requires Node.js 20+.

```bash
npm install
npm run demo
```

The demo starts two local nodes, checks these cases, and shuts them down:

1. Mine a block and synchronize both nodes over sockets.
2. Reject a longer fabricated chain with missing proof of work.
3. Reconnect two honest, equal-length forks; each keeps its current branch.
4. Extend one branch with a valid block; both nodes adopt it.

Each check prints `PASS`; a failure exits with a nonzero status. Run `npm test` for validation and networking tests.

## Run nodes manually

```bash
npm start                                     # terminal 1: node A, port 3000
PORT=3001 PEERS=http://127.0.0.1:3000 npm start  # terminal 2: node B, connected to A
npm run client                                # terminal 3: control node A
```

Client commands: `mine hello`, `view`, `help`, `exit`. To control B, run `SERVER_URL=http://127.0.0.1:3001 npm run client`. `PEERS` accepts comma-separated node URLs. Nodes bind to `127.0.0.1` by default; `HOST` overrides this.

## Consensus rules

Every node shares the same genesis block and fixed difficulty of three leading zeroes. It checks block fields, hashes, links, timestamps, and proof of work **before** comparing chain lengths. With fixed difficulty, a valid longer chain represents more work. Equal-length forks stay unresolved until one branch becomes longer; a tie is not evidence of fabrication.

A forged hash or missing work is rejected. A fully re-mined, valid alternative history can win if it has more work: this demo cannot establish whether arbitrary text is true or authorize payments.

## Connect the visualizers

Use a Socket.IO client pointed at a running node. The server sends `chain:full` on connection and after changes. For example:

```js
const socket = io('http://127.0.0.1:3000');
socket.on('chain:full', renderChain);
socket.on('mine:progress', renderHashAttempt);
socket.emit('mine:start', { data: 'hello' });
```

| Direction | Event | Payload |
| --- | --- | --- |
| To node | `chain:get` | `{}` |
| To node | `mine:start` | `{ data }` — text |
| To node | `chain:propose` | `{ blocks }` — competing chain |
| From node | `chain:full` | `{ difficulty, blocks, validation, mining }` |
| From node | `mine:progress` | `{ index, difficulty, nonce, hash, attempts }` — sampled attempts |
| From node | `block:new` | `{ block }` |
| From node | `mine:done` | `{ block, attempts, elapsedMs }` |
| From node | `mine:error` | `{ message }` — sent to requester |
| From node | `chain:result` | `{ accepted, reason, message, blockIndex? }` — sent to proposer |

Requests also accept a Socket.IO acknowledgement callback. `chain:get` returns the state; `mine:start` returns `{ ok, ...result }` or `{ ok: false, message }`; `chain:propose` returns the decision (`longer`, `tie`, `shorter`, `unchanged`, or `invalid`).

Blocks contain `{ index, timestamp, data, previousHash, nonce, hash }`. The hash is SHA-256 of `JSON.stringify([index, timestamp, data, previousHash, nonce])`. `GET /api/chain` returns the state; `GET /api/validate` returns validation.

Local, in-memory demo: restarting resets the chain. Limits: 256 blocks including genesis, 1 KiB of JSON-encoded text per block, one mining job per node. No wallets, transaction signatures, persistence, or client authentication. The HTTP root returns chain JSON; the visualizer supplies the UI.
