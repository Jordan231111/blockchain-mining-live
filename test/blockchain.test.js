const test = require('node:test');
const assert = require('node:assert/strict');
const { Blockchain, DIFFICULTY, GENESIS, MAX_BLOCKS, hashBlock, validate } = require('../src/server');

// Produce an honestly hashed block that deliberately lacks proof of work.
function removeProof(block) {
  do {
    block.nonce += 1;
    block.hash = hashBlock(block);
  } while (block.hash.startsWith('0'.repeat(DIFFICULTY)));
}

test('independent nodes start from the same valid genesis block', () => {
  const a = new Blockchain();
  const b = new Blockchain();
  assert.deepEqual(a.toJSON(), b.toJSON());
  assert.deepEqual(validate(a.blocks), { valid: true });
  assert.equal(a.blocks.length, 1);
});

test('hashing includes every field without ambiguous concatenation', () => {
  const block = { index: 1, timestamp: 23, data: 'hello', previousHash: GENESIS.hash, nonce: 0 };
  const changes = { index: 2, timestamp: 24, data: 'hello!', previousHash: 'f'.repeat(64), nonce: 1 };
  for (const [field, value] of Object.entries(changes)) {
    assert.notEqual(hashBlock(block), hashBlock({ ...block, [field]: value }), field);
  }
  assert.notEqual(hashBlock(block), hashBlock({ ...block, index: 2, timestamp: 22 }));
});

test('mining links blocks, satisfies proof of work, and reports the final attempt', async () => {
  const chain = new Blockchain();
  let progress;
  const first = await chain.mine('first', (attempt) => { progress = attempt; });
  const second = await chain.mine('second');
  assert.equal(first.previousHash, GENESIS.hash);
  assert.equal(second.previousHash, first.hash);
  assert.ok(first.hash.startsWith('0'.repeat(DIFFICULTY)));
  assert.equal(first.hash, hashBlock(first));
  assert.equal(progress.hash, first.hash);
  assert.equal(progress.attempts, first.nonce + 1);
  assert.deepEqual(validate(chain.blocks), { valid: true });
  assert.equal(chain.isMining, false);
});

test('changed data is detected and identifies the altered block', async () => {
  const chain = new Blockchain();
  await chain.mine('original');
  chain.blocks[1].data = 'edited';
  assert.deepEqual(validate(chain.blocks), {
    valid: false, error: 'Hash does not match block contents.', blockIndex: 1,
  });
  await assert.rejects(chain.mine('more'), /invalid chain/);
});

test('recomputed hashes do not hide broken links or a substituted genesis', async () => {
  const chain = new Blockchain();
  await chain.mine('original');
  const broken = chain.toJSON().blocks;
  broken[1].previousHash = 'f'.repeat(64);
  broken[1].hash = hashBlock(broken[1]);
  assert.match(validate(broken).error, /Previous hash/);
  const otherGenesis = { ...GENESIS, data: 'Different network' };
  otherGenesis.hash = hashBlock(otherGenesis);
  assert.match(validate([otherGenesis]).error, /Genesis/);
});

test('a longer chain with fabricated proof cannot replace a valid chain', async () => {
  const local = new Blockchain();
  const remote = new Blockchain();
  await local.mine('local');
  await remote.mine('remote 1');
  await remote.mine('remote 2');
  const forged = remote.toJSON().blocks;
  removeProof(forged[2]);
  const before = local.toJSON();
  const result = local.replace(forged);
  assert.equal(result.reason, 'invalid');
  assert.match(result.message, /Proof of work/);
  assert.deepEqual(local.toJSON(), before);
});

test('malformed and oversized proposals are rejected without changing the chain', async () => {
  const local = new Blockchain();
  await local.mine('one');
  const before = local.toJSON();
  const badFields = [
    { index: 2 }, { nonce: -1 }, { nonce: 1.5 }, { nonce: Number.MAX_SAFE_INTEGER + 1 },
    { timestamp: -1 }, { timestamp: 1.5 }, { timestamp: '123' },
    { data: {} }, { data: 'a'.repeat(1024) }, { data: '😀'.repeat(300) },
    { hash: '0'.repeat(63) }, { previousHash: null }, { unexpected: true },
  ];
  for (const fields of badFields) {
    const candidate = structuredClone(before.blocks);
    Object.assign(candidate[1], fields);
    assert.equal(local.replace(candidate).reason, 'invalid', JSON.stringify(fields));
  }
  for (const candidate of [null, {}, [], [null], [GENESIS, []], Array(MAX_BLOCKS + 1).fill(GENESIS)]) {
    assert.equal(local.replace(candidate).reason, 'invalid');
  }
  assert.deepEqual(local.toJSON(), before);
});

test('a block cannot precede its parent timestamp', async () => {
  const chain = new Blockchain();
  await chain.mine('one');
  await chain.mine('two');
  const blocks = chain.toJSON().blocks;
  blocks[2].timestamp = blocks[1].timestamp - 1;
  blocks[2].hash = hashBlock(blocks[2]);
  assert.match(validate(blocks).error, /Timestamp/);
});

test('honest equal-work forks retain their tips until one branch extends', async () => {
  const a = new Blockchain();
  const b = new Blockchain();
  await a.mine('common');
  b.replace(a.toJSON().blocks);
  const tipA = await a.mine('branch A');
  const tipB = await b.mine('branch B');
  assert.equal(a.replace(b.toJSON().blocks).reason, 'tie');
  assert.equal(b.replace(a.toJSON().blocks).reason, 'tie');
  assert.equal(a.blocks.at(-1).hash, tipA.hash);
  assert.equal(b.blocks.at(-1).hash, tipB.hash);
  await b.mine('extension');
  assert.equal(a.replace(b.toJSON().blocks).accepted, true);
  assert.deepEqual(a.toJSON(), b.toJSON());
});

test('shorter and identical chains do not trigger replacements', async () => {
  const chain = new Blockchain();
  const shorter = chain.toJSON().blocks;
  await chain.mine('one');
  assert.equal(chain.replace(shorter).reason, 'shorter');
  assert.equal(chain.replace(chain.toJSON().blocks).reason, 'unchanged');
});

test('received chains and returned blocks cannot mutate internal state afterward', async () => {
  const a = new Blockchain();
  const b = new Blockchain();
  const mined = await a.mine('original');
  mined.data = 'changed return value';
  const proposal = a.toJSON().blocks;
  assert.equal(b.replace(proposal).accepted, true);
  proposal[1].data = 'changed proposal';
  b.toJSON().blocks[1].data = 'changed snapshot';
  assert.deepEqual(a.toJSON(), b.toJSON());
  assert.equal(b.blocks[1].data, 'original');
});

test('a second mining request is rejected while the first is active', async () => {
  const chain = new Blockchain();
  let rejected;
  await chain.mine('first', ({ attempts }) => {
    if (attempts === 1) rejected = assert.rejects(chain.mine('second'), /Already mining/);
  });
  await rejected;
  assert.equal(chain.blocks.length, 2);
  assert.equal(chain.isMining, false);
});

test('a chain replacement during mining discards stale work and releases the lock', async () => {
  const local = new Blockchain();
  const remote = new Blockchain();
  await remote.mine('new parent');
  await assert.rejects(local.mine('stale', ({ attempts }) => {
    if (attempts === 1) local.replace(remote.toJSON().blocks);
  }), /Chain changed/);
  assert.deepEqual(local.toJSON(), remote.toJSON());
  await local.mine('retry');
  assert.deepEqual(validate(local.blocks), { valid: true });
});

test('invalid mining input and chain limits fail without leaving a mining lock', async () => {
  const chain = new Blockchain();
  for (const data of [null, {}, 42, 'a'.repeat(1024)]) {
    await assert.rejects(chain.mine(data), /Data must be text/);
    assert.equal(chain.isMining, false);
  }
  await chain.mine('a'.repeat(1022)); // Quotes make the JSON representation exactly 1 KiB.
  chain.blocks = Array(MAX_BLOCKS).fill(GENESIS);
  await assert.rejects(chain.mine('too many blocks'), /limit reached/);
  assert.equal(chain.isMining, false);
});
