/**
 * app.js — The Blockchain CLIENT (browser version)
 * ------------------------------------------------------------
 * This is the same socket.io conversation as src/client.js,
 * but with buttons + live animation instead of a terminal.
 *
 * socket.io client API used here (that's the whole API):
 *   const socket = io();              // connect to the server that served this page
 *   socket.on('event', handler);      // listen
 *   socket.emit('event', data);       // send
 */

// `io` is a global from /socket.io/socket.io.js (loaded in index.html).
const socket = io();

// --- Grab DOM elements ------------------------------------------------
const $ = (id) => document.getElementById(id);
const connStatus = $('conn-status');
const validStatus = $('valid-status');
const blockCount = $('block-count');
const chainDiv = $('chain');
const dataInput = $('data-input');
const mineBtn = $('mine-btn');
const mineMsg = $('mine-msg');
const miningLive = $('mining-live');
const liveHash = $('live-hash');
const liveMeta = $('live-meta');
const difficultySlider = $('difficulty');
const difficultyVal = $('difficulty-val');
const targetPreview = $('target-preview');

// ------------------------------------------------------------------
// Incoming events (Server → Browser)
// ------------------------------------------------------------------
socket.on('connect', () => {
  connStatus.textContent = `🟢 connected (${socket.id.slice(0, 6)}…)`;
  connStatus.className = 'pill ok';
});

socket.on('disconnect', () => {
  connStatus.textContent = '🔴 disconnected';
  connStatus.className = 'pill bad';
});

// Full state refresh — re-render the whole chain.
socket.on('chain:full', (state) => {
  renderChain(state);
});

// Live! The server streams hash attempts while it mines.
socket.on('mine:progress', ({ nonce, hash, attempts }) => {
  miningLive.classList.remove('hidden');
  mineBtn.disabled = true;
  liveHash.textContent = hash;
  liveMeta.textContent = `attempt #${attempts} · nonce ${nonce}`;
});

// Mining finished — show result, hide animation shortly after.
socket.on('mine:done', ({ block, elapsedMs }) => {
  mineMsg.textContent = `✅ Block #${block.index} mined in ${elapsedMs}ms — nonce ${block.nonce}.`;
  setTimeout(() => miningLive.classList.add('hidden'), 600);
  mineBtn.disabled = false;
});

socket.on('mine:error', ({ message }) => {
  mineMsg.textContent = `⚠️ ${message}`;
  miningLive.classList.add('hidden');
  mineBtn.disabled = false;
});

// ------------------------------------------------------------------
// Outgoing events (Browser → Server)
// ------------------------------------------------------------------
mineBtn.addEventListener('click', () => {
  const data = dataInput.value.trim() || 'Empty block';
  mineMsg.textContent = 'Mining… watch the hashes fly.';
  socket.emit('mine:start', { data }); // <-- the request
});

dataInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') mineBtn.click();
});

difficultySlider.addEventListener('change', () => {
  socket.emit('difficulty:set', { difficulty: difficultySlider.value });
});
difficultySlider.addEventListener('input', () => {
  difficultyVal.textContent = difficultySlider.value;
  targetPreview.textContent = '0'.repeat(Number(difficultySlider.value));
});

$('tamper-btn').addEventListener('click', () => {
  socket.emit('chain:tamper', { index: 1, newData: 'HACKED! 👾 (edited without re-mining)' });
});

// ------------------------------------------------------------------
// Rendering — turn chain JSON into pretty block cards
// ------------------------------------------------------------------
function short(hash) {
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

function renderChain({ blocks, difficulty, validation }) {
  // Header pills
  blockCount.textContent = `${blocks.length} block(s)`;
  difficultyVal.textContent = difficulty;
  difficultySlider.value = difficulty;
  targetPreview.textContent = '0'.repeat(difficulty);

  if (validation.valid) {
    validStatus.textContent = '✅ chain valid';
    validStatus.className = 'pill ok';
  } else {
    validStatus.textContent = `❌ INVALID: ${validation.error}`;
    validStatus.className = 'pill bad';
  }

  // Block cards (genesis first, newest last)
  chainDiv.innerHTML = '';
  blocks.forEach((b, i) => {
    const brokenHere = !validation.valid && validation.blockIndex === b.index;

    const card = document.createElement('div');
    card.className = `block mono ${b.index === 0 ? 'genesis' : validation.valid ? 'valid' : brokenHere ? 'invalid' : 'valid'}`;
    card.innerHTML = `
      <div class="block-head">
        <strong>${b.index === 0 ? '🌱 Genesis' : `Block #${b.index}`}</strong>
        <span class="block-hash">${short(b.hash)}</span>
      </div>
      <table>
        <tr><td>data</td><td>${escapeHtml(JSON.stringify(b.data))}</td></tr>
        <tr><td>nonce</td><td>${b.nonce}</td></tr>
        <tr><td>prev hash</td><td>${short(b.previousHash)}</td></tr>
        <tr><td>time</td><td>${new Date(b.timestamp).toLocaleTimeString()}</td></tr>
      </table>
    `;
    chainDiv.appendChild(card);

    // Arrow between blocks to show the "chain link"
    if (i < blocks.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'link-arrow';
      arrow.textContent = '⬇ prevHash links here ⬇';
      chainDiv.appendChild(arrow);
    }
  });
}

// Never inject raw user data as HTML — escape it first.
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
