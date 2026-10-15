// Automated checks for the two-file implementation in src/.
// Run with npm run demo; the normal terminal client does not need these helpers.
const assert = require('node:assert/strict');
const { once } = require('node:events');
const timers = require('node:timers/promises');
const socketClient = require('socket.io-client');
const { startNode, hashBlock, DIFFICULTY } = require('./src/server');

async function runDemo() {
  const nodes = [];
  const clients = [];
  try {
    const nodeA = await startNode();
    nodes.push(nodeA);
    const nodeB = await startNode();
    nodes.push(nodeB);
    const clientA = await connectClient(nodeA.url);
    clients.push(clientA);
    const clientB = await connectClient(nodeB.url);
    clients.push(clientB);

    // 1. Connect two nodes and mine a shared block.
    const peerConnection = nodeB.connectPeer(nodeA.url);
    await once(peerConnection, 'connect', { signal: AbortSignal.timeout(5000) });
    const firstMine = await request(clientA, 'mine:start', { data: 'Shared block' });
    assert.equal(firstMine.ok, true);
    const sharedState = await waitForTip(clientB, firstMine.block.hash);
    assert.equal(sharedState.validation.valid, true);
    console.log('PASS  Mined block reaches both nodes over sockets.');

    // 2. Build a longer, correctly linked chain that lacks proof of work.
    const fabricatedBlocks = [sharedState.blocks[0]];
    for (let index = 1; index <= 3; index += 1) {
      const previousBlock = fabricatedBlocks[index - 1];
      const block = {
        index: index,
        timestamp: Date.now(),
        data: 'Fabricated',
        previousHash: previousBlock.hash,
        nonce: 0,
      };
      // Ensure even a lucky first hash does not accidentally satisfy the target.
      do {
        block.nonce += 1;
        block.hash = hashBlock(block);
      } while (block.hash.startsWith('0'.repeat(DIFFICULTY)));
      fabricatedBlocks.push(block);
    }

    const rejection = await request(clientA, 'chain:propose', { blocks: fabricatedBlocks });
    const afterRejection = await request(clientA, 'chain:get');
    assert.equal(rejection.reason, 'invalid');
    assert.equal(tipHash(afterRejection), firstMine.block.hash);
    console.log(`PASS  Longer fabricated chain rejected: ${rejection.message}`);

    // 3. Disconnect the nodes so each can mine an honest competing branch.
    peerConnection.disconnect();
    const branchA = await request(clientA, 'mine:start', { data: 'Branch A' });
    const branchB = await request(clientB, 'mine:start', { data: 'Branch B' });
    assert.equal(branchA.ok, true);
    assert.equal(branchB.ok, true);
    assert.notEqual(branchA.block.hash, branchB.block.hash);

    // Listen before reconnecting so we cannot miss the chain decision.
    const pendingDecision = once(peerConnection, 'chain:result', { signal: AbortSignal.timeout(5000) });
    peerConnection.connect();
    const [decision] = await pendingDecision;
    const stateA = await request(clientA, 'chain:get');
    const stateB = await request(clientB, 'chain:get');
    assert.equal(decision.reason, 'tie');
    assert.equal(tipHash(stateA), branchA.block.hash);
    assert.equal(tipHash(stateB), branchB.block.hash);
    console.log('PASS  Equal-length honest forks keep their own tips while tied.');

    // 4. One extra valid block gives B's branch more work, resolving the fork.
    const extension = await request(clientB, 'mine:start', { data: 'Branch B extended' });
    assert.equal(extension.ok, true);
    const resolvedA = await waitForTip(clientA, extension.block.hash);
    const resolvedB = await request(clientB, 'chain:get');
    assert.equal(resolvedA.validation.valid, true);
    assert.deepEqual(resolvedA.blocks, resolvedB.blocks);
    console.log('PASS  One more valid block resolves the fork; both nodes agree.');
  } finally {
    // Also clean up if a check fails, so the command always exits.
    for (const client of clients) {
      client.close();
    }
    for (const node of nodes) {
      await node.close();
    }
  }
}

// Socket helpers shared by this demo and the networking tests.
async function connectClient(url) {
  const socket = socketClient.io(url, { autoConnect: false });
  try {
    await new Promise(function (resolve, reject) {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    return socket;
  } catch (error) {
    socket.close();
    throw error;
  }
}

function request(socket, event, payload = {}) {
  // Resolve with the server's acknowledgement, or fail after ten seconds.
  return new Promise(function (resolve, reject) {
    socket.timeout(10000).emit(event, payload, function (error, response) {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

function tipHash(state) {
  const lastBlock = state.blocks[state.blocks.length - 1];
  return lastBlock.hash;
}

async function waitForTip(socket, expectedHash) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = await request(socket, 'chain:get');
    if (tipHash(state) === expectedHash) {
      return state;
    }
    // Give peer messages time to arrive before checking again.
    await timers.setTimeout(20);
  }
  throw new Error('Nodes did not synchronize.');
}

if (require.main === module) {
  runDemo().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { connectClient, request, waitForTip, runDemo };
