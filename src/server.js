/**
 * server.js — The Blockchain SERVER (socket.io + express)
 * ------------------------------------------------------------
 * Run:  npm start        →  http://localhost:3000
 *
 * What this server does:
 *   1. Owns ONE canonical Blockchain instance (in memory).
 *   2. Serves the live-mining web page from /public.
 *   3. Talks to browsers / Node clients in real time via socket.io.
 *
 * socket.io crash course (the only API you need):
 *   - io.on('connection', socket => ...)  — a client just connected.
 *   - socket.on('event-name', handler)     — listen for a message.
 *   - socket.emit('event-name', data)      — reply to ONE client.
 *   - io.emit('event-name', data)          — broadcast to ALL clients.
 *
 * Our tiny protocol (all JSON):
 *
 *   Client → Server
 *     'chain:get'                 ask for the full chain
 *     'mine:start'   { data }     ask server to mine a block with `data`
 *     'chain:tamper' { index, newData }  corrupt a block (demo validation)
 *     'difficulty:set' { difficulty }    change mining difficulty (1-5)
 *
 *   Server → Client(s)
 *     'chain:full'    { difficulty, blocks, validation }  full state
 *     'block:new'     { block }        a block was just mined (broadcast)
 *     'mine:progress' { nonce, hash, attempts }  live hash attempts
 *     'mine:done'     { block, attempts, elapsedMs }
 *     'mine:error'    { message }
 */

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Blockchain = require('./blockchain/Blockchain');

const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// 1. Express: serve static files (our live demo page)
// ------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__adirectoryname, '..', 'public')));

// Small REST helpers (handy for curl; socket.io is the main API).
const blockchain = new Blockchain(2); // difficulty 2 = fast, visible mining

app.get('/api/chain', (_req, res) => res.json(blockchain.toJSON()));
app.get('/api/validate', (_req, res) => res.json(blockchain.validate()));

// ------------------------------------------------------------------
// 2. socket.io: real-time layer
// ------------------------------------------------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // demo only — lock this down in production
});

/** Send the full chain state to every connected client. */
function broadcastChain() {
  io.emit('chain:full', blockchain.toJSON());
}

io.on('connection', (socket) => {
  console.log(`[+] client connected: ${socket.id}`);

  // Immediately orient the newcomer: here is the current chain.
  socket.emit('chain:full', blockchain.toJSON());

  // --- Client asks for the chain ----------------------------------
  socket.on('chain:get', () => {
    socket.emit('chain:full', blockchain.toJSON());
  });

  // --- Client asks us to mine a block ------------------------------
  // This is the "live mining" money shot: we stream every Nth hash
  // attempt so the UI can animate the search in real time.
  socket.on('mine:start', async (payload = {}) => {
    const data = payload.data ?? `Block data @ ${new Date().toLocaleTimeString()}`;
    console.log(`[mine] request from ${socket.id}:`, JSON.stringify(data));

    if (blockchain.isMining) {
      socket.emit('mine:error', { message: 'Server is already mining. Try again in a second.' });
      return;
    }

    const startedAt = Date.now();
    try {
      const block = await blockchain.addBlock(data, ({ nonce, hash, attempts }) => {
        // Emit every attempt at low difficulty; throttle when fast.
        // (attempts % 5 keeps the UI smooth without flooding the socket.)
        if (attempts % 5 === 0 || hash.startsWith('0'.repeat(blockchain.difficulty))) {
          io.emit('mine:progress', { nonce, hash, attempts });
        }
      });

      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[mine] DONE #${block.index} nonce=${block.nonce} hash=${block.hash} (${elapsedMs}ms)`
      );

      // Tell everyone: new block + fresh full state.
      io.emit('block:new', { block });
      io.emit('mine:done', { block, elapsedMs });
      broadcastChain();
    } catch (err) {
      console.error('[mine] error:', err.message);
      socket.emit('mine:error', { message: err.message });
    }
  });

  // --- Client wants to corrupt a block (to SEE validation fail) ---
  socket.on('chain:tamper', ({ index, newData } = {}) => {
    try {
      const block = blockchain.tamper(Number(index), newData ?? 'HACKED!');
      console.log(`[tamper] block #${block.index} corrupted by ${socket.id}`);
      broadcastChain(); // validation field will now show valid:false
    } catch (err) {
      socket.emit('mine:error', { message: err.message });
    }
  });

  // --- Client wants easier/harder mining ----------------------------
  socket.on('difficulty:set', ({ difficulty } = {}) => {
    const n = Number(difficulty);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      socket.emit('mine:error', { message: 'Difficulty must be an integer 1-5.' });
      return;
    }
    blockchain.difficulty = n;
    console.log(`[difficulty] set to ${n} by ${socket.id}`);
    broadcastChain();
  });

  socket.on('disconnect', (reason) => {
    console.log(`[-] client disconnected: ${socket.id} (${reason})`);
  });
});

// ------------------------------------------------------------------
server.listen(PORT, () => {
  console.log('');
  console.log('  ⛓️  Blockchain server running');
  console.log(`  → Web demo:  http://localhost:${PORT}`);
  console.log(`  → REST:      http://localhost:${PORT}/api/chain`);
  console.log(`  → Difficulty: ${blockchain.difficulty} (change it live in the UI)`);
  console.log('');
});
