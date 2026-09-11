/**
 * client.js — The Blockchain CLIENT (terminal version)
 * ------------------------------------------------------------
 * Run:  npm run client
 * (Make sure the server is running first: `npm start`)
 *
 * This is the exact counterpart to server.js. It shows the
 * socket.io CLIENT API, which is only 3 lines at its core:
 *
 *   const socket = io('http://localhost:3000'); // connect
 *   socket.on('chain:full', handler);              // listen
 *   socket.emit('mine:start', { data });           // send
 *
 * Commands (type them + Enter):
 *   view              print the current chain
 *   mine <text>       ask the server to mine a block with <text>
 *   difficulty <1-5>  change mining difficulty
 *   tamper <index> <new text>  corrupt a block, watch validation fail
 *   help / exit
 */

const readline = require('readline');
const { io } = require('socket.io-client');

const URL = process.env.SERVER_URL || 'http://localhost:3000';
const socket = io(URL);

let lastChain = null;

// ------------------------------------------------------------------
// Incoming events (Server → Client)
// ------------------------------------------------------------------
socket.on('connect', () => {
  console.log(`Connected to ${URL} as ${socket.id}`);
  console.log('Type "help" for commands.\n');
  socket.emit('chain:get');
});

socket.on('chain:full', (chainJson) => {
  lastChain = chainJson;
  const { blocks, difficulty, validation } = chainJson;
  console.log(
    `\n[chain] ${blocks.length} block(s), difficulty=${difficulty}, valid=${validation.valid}`
  );
  if (!validation.valid) console.log(`[chain] ⚠️  ${validation.error}`);
});

socket.on('mine:progress', ({ nonce, hash, attempts }) => {
  // Overwrite the same line to animate the search.
  process.stdout.write(`\r[mining] attempt #${attempts} nonce=${nonce} hash=${hash.slice(0, 20)}…`);
});

socket.on('block:new', ({ block }) => {
  process.stdout.write('\n');
  console.log(`[block:new] #${block.index} mined! hash=${block.hash} nonce=${block.nonce}`);
});

socket.on('mine:done', ({ block, elapsedMs }) => {
  console.log(`[mine:done] block #${block.index} took ${elapsedMs}ms`);
});

socket.on('mine:error', ({ message }) => {
  console.log(`\n[error] ${message}`);
});

socket.on('disconnect', (reason) => {
  console.log(`\nDisconnected: ${reason}`);
});

// ------------------------------------------------------------------
// Outgoing events (Client → Server) via a tiny REPL
// ------------------------------------------------------------------
function printChain() {
  if (!lastChain) return console.log('(no chain received yet)');
  for (const b of lastChain.blocks) {
    console.log('─'.repeat(64));
    console.log(`#${b.index}  hash=${b.hash}`);
    console.log(`     prev=${b.previousHash}`);
    console.log(`     nonce=${b.nonce}  time=${new Date(b.timestamp).toLocaleTimeString()}`);
    console.log(`     data=${JSON.stringify(b.data)}`);
  }
  console.log('─'.repeat(64));
}

function printHelp() {
  console.log([
    '',
    'Commands:',
    '  view                        show the full chain',
    '  mine <text>                 mine a block containing <text>',
    '  difficulty <1-5>            set mining difficulty',
    '  tamper <index> <new text>   corrupt block <index> (demo validation)',
    '  help                        this message',
    '  exit                        quit',
    '',
  ].join('\n'));
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
rl.prompt();
rl.on('line', (line) => {
  const [cmd, ...rest] = line.trim().split(' ');
  switch (cmd) {
    case 'view':
      printChain();
      break;
    case 'mine': {
      const data = rest.join(' ') || 'Hello, blockchain!';
      socket.emit('mine:start', { data });
      console.log(`[you] mining request sent: ${JSON.stringify(data)}`);
      break;
    }
    case 'difficulty':
      socket.emit('difficulty:set', { difficulty: rest[0] });
      break;
    case 'tamper': {
      const [index, ...words] = rest;
      socket.emit('chain:tamper', { index, newData: words.join(' ') || 'HACKED!' });
      break;
    }
    case 'help':
      printHelp();
      break;
    case 'exit':
      socket.close();
      rl.close();
      return;
    case '':
      break;
    default:
      console.log(`Unknown command: ${cmd} (try "help")`);
  }
  rl.prompt();
});
