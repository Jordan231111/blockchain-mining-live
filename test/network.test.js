const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { startNode, GENESIS, DIFFICULTY, hashBlock } = require('../src/server');
const { connectClient, request, waitForTip } = require('../demo');

// Every test owns its nodes and sockets, so failures still close all listeners.
function network(t) {
  const nodes = [];
  const clients = [];
  t.after(async () => {
    clients.forEach((socket) => socket.close());
    await Promise.all(nodes.map((node) => node.close()));
  });
  return {
    async node(options) {
      const node = await startNode(options);
      nodes.push(node);
      return node;
    },
    async client(node) {
      const socket = await connectClient(node.url);
      clients.push(socket);
      return socket;
    },
  };
}

test('mined blocks propagate across three nodes and stream visualizer events', async (t) => {
  const net = network(t);
  const a = await net.node();
  const b = await net.node({ peers: [a.url] });
  const c = await net.node({ peers: [b.url] });
  const client = await net.client(a);
  const observer = await net.client(a);
  const tail = await net.client(c);
  const progress = [];
  observer.on('mine:progress', (attempt) => progress.push(attempt));
  const done = once(observer, 'mine:done', { signal: AbortSignal.timeout(5000) });
  const added = once(observer, 'block:new', { signal: AbortSignal.timeout(5000) });
  const result = await request(client, 'mine:start', { data: 'network block' });
  assert.equal(result.ok, true);
  const state = await waitForTip(tail, result.block.hash);
  assert.equal(state.validation.valid, true);
  assert.equal(state.mining, false);
  assert.equal((await done)[0].block.hash, result.block.hash);
  assert.equal((await added)[0].block.hash, result.block.hash);
  assert.equal(progress.at(-1).hash, result.block.hash);
  assert.equal(progress.at(-1).attempts, result.attempts);
});

test('connected peers keep equal-work forks and converge after an extension', async (t) => {
  const net = network(t);
  const a = await net.node();
  const b = await net.node();
  const alice = await net.client(a);
  const bob = await net.client(b);
  const forkA = await request(alice, 'mine:start', { data: 'A' });
  const forkB = await request(bob, 'mine:start', { data: 'B' });
  assert.equal(forkA.ok, true);
  assert.equal(forkB.ok, true);
  const link = b.connectPeer(a.url);
  const [decision] = await once(link, 'chain:result', { signal: AbortSignal.timeout(5000) });
  assert.equal(decision.reason, 'tie');
  assert.equal((await request(alice, 'chain:get')).blocks.at(-1).hash, forkA.block.hash);
  assert.equal((await request(bob, 'chain:get')).blocks.at(-1).hash, forkB.block.hash);
  const extension = await request(bob, 'mine:start', { data: 'B continues' });
  assert.equal(extension.ok, true);
  const agreed = await waitForTip(alice, extension.block.hash);
  assert.deepEqual(agreed.blocks, (await request(bob, 'chain:get')).blocks);
});

test('a reconnecting peer offers blocks mined while disconnected', async (t) => {
  const net = network(t);
  const a = await net.node();
  const b = await net.node();
  const alice = await net.client(a);
  const bob = await net.client(b);
  const link = b.connectPeer(a.url);
  await once(link, 'connect', { signal: AbortSignal.timeout(5000) });
  link.disconnect();
  const result = await request(bob, 'mine:start', { data: 'offline block' });
  assert.equal(result.ok, true);
  assert.equal((await request(alice, 'chain:get')).blocks.length, 1);
  link.connect();
  await waitForTip(alice, result.block.hash);
});

test('the socket rejects a longer forged chain even if it claims an easier difficulty', async (t) => {
  const net = network(t);
  const node = await net.node();
  const client = await net.client(node);
  const blocks = [{ ...GENESIS }];
  for (let index = 1; index <= 3; index += 1) {
    const block = { index, timestamp: 1, data: 'forged', previousHash: blocks.at(-1).hash, nonce: 0 };
    do {
      block.nonce += 1;
      block.hash = hashBlock(block);
    } while (block.hash.startsWith('0'.repeat(DIFFICULTY)));
    blocks.push(block);
  }
  const decision = once(client, 'chain:result', { signal: AbortSignal.timeout(5000) });
  const result = await request(client, 'chain:propose', { difficulty: 0, blocks });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'invalid');
  assert.match(result.message, /Proof of work/);
  assert.deepEqual((await decision)[0], result);
  assert.deepEqual((await request(client, 'chain:get')).blocks, [GENESIS]);
});

test('malformed socket requests return errors and the node remains usable', async (t) => {
  const net = network(t);
  const node = await net.node();
  const client = await net.client(node);
  for (const payload of [null, {}, { data: {} }, { data: 'x'.repeat(1024) }]) {
    const error = once(client, 'mine:error', { signal: AbortSignal.timeout(5000) });
    const result = await request(client, 'mine:start', payload);
    assert.equal(result.ok, false);
    assert.equal((await error)[0].message, result.message);
  }
  for (const payload of [null, {}, { blocks: [null] }, { blocks: 'fake' }]) {
    assert.equal((await request(client, 'chain:propose', payload)).reason, 'invalid');
  }
  const mined = await request(client, 'mine:start', { data: 'still running' });
  assert.equal(mined.ok, true);
  assert.equal((await request(client, 'chain:get')).validation.valid, true);
});

test('HTTP state agrees with socket state for visualizer integration', async (t) => {
  const net = network(t);
  const node = await net.node();
  const client = await net.client(node);
  const mined = await request(client, 'mine:start', { data: '<script>plain text</script>' });
  assert.equal(mined.ok, true);
  const response = await fetch(`${node.url}/api/chain`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), await request(client, 'chain:get'));
  const validation = await fetch(`${node.url}/api/validate`);
  assert.deepEqual(await validation.json(), { valid: true });
});
