/**
 * blockchain.test.js — Your safety net
 * ------------------------------------------------------------
 * Run:  npm test
 *
 * These tests describe, in plain English, everything the blockchain
 * MUST do. If you rewrite any file and all tests still pass, your
 * rewrite is correct. If one fails, its name tells you what broke.
 *
 * No libraries to learn: this uses Node's BUILT-IN test runner.
 *   - test('description', ...)  → one check with a human-readable name
 *   - assert.equal(a, b)        → "these two must match"
 *   - assert.ok(value)          → "this must be truthy"
 *
 * Reading this file top-to-bottom is itself a great lesson:
 * it shows every important behavior in ~100 lines.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { sha256 } = require('../src/blockchain/hash');
const Block = require('../src/blockchain/Block');
const Blockchain = require('../src/blockchain/Blockchain');

// ------------------------------------------------------------------
// Lesson 1: Hashing (src/blockchain/hash.js)
// ------------------------------------------------------------------

test('hashing: same input always gives the same hash', () => {
  assert.equal(sha256('hello'), sha256('hello'));
});

test('hashing: changing 1 letter gives a totally different hash', () => {
  assert.notEqual(sha256('hello'), sha256('hello!'));
});

test('hashing: every hash is 64 hex characters, no matter the input size', () => {
  assert.equal(sha256('a').length, 64);
  assert.equal(sha256('a'.repeat(1000)).length, 64);
  assert.match(sha256('anything'), /^[0-9a-f]{64}$/); // only hex chars
});

// ------------------------------------------------------------------
// Lesson 2: Blocks (src/blockchain/Block.js)
// ------------------------------------------------------------------

test('block: calculateHash is deterministic', () => {
  const block = new Block(1, 12345, 'data', 'prevhash');
  assert.equal(block.calculateHash(), block.calculateHash());
});

test('block: changing the data changes the hash', () => {
  const a = new Block(1, 12345, 'Alice -> Bob $5', 'prev');
  const b = new Block(1, 12345, 'Alice -> Mallory $5000', 'prev');
  assert.notEqual(a.calculateHash(), b.calculateHash());
});

test('block: genesis block starts the chain (index 0, no predecessor)', () => {
  const genesis = Block.genesis();
  assert.equal(genesis.index, 0);
  assert.equal(genesis.previousHash, '0');
});

test('block: mining finds a hash with the required leading zeroes', () => {
  const block = new Block(1, Date.now(), 'test', 'prev');
  block.mine(2); // difficulty 2 → hash must start with "00"
  assert.ok(block.hash.startsWith('00'));
  // And the stored hash must honestly match the block's contents.
  assert.equal(block.hash, block.calculateHash());
});

test('block: survives a trip to JSON and back (needed for networking)', () => {
  const original = new Block(3, 99999, { coins: 5 }, 'abc', 42, 'hash123');
  const revived = Block.fromJSON(JSON.parse(JSON.stringify(original)));
  assert.equal(revived.index, 3);
  assert.deepEqual(revived.data, { coins: 5 });
  assert.equal(revived.nonce, 42);
  assert.equal(revived.hash, 'hash123');
});

// ------------------------------------------------------------------
// Lesson 3: The chain (src/blockchain/Blockchain.js)
// ------------------------------------------------------------------

test('chain: starts with only the genesis block', () => {
  const chain = new Blockchain(1); // difficulty 1 = fast tests
  assert.equal(chain.chain.length, 1);
  assert.equal(chain.chain[0].index, 0);
});

test('chain: new blocks link to the previous block via previousHash', async () => {
  const chain = new Blockchain(1);
  const block = await chain.addBlock('Alice -> Bob $5');
  assert.equal(chain.chain.length, 2);
  assert.equal(block.index, 1);
  assert.equal(block.previousHash, chain.chain[0].hash); // THE chain link
  assert.ok(block.hash.startsWith('0')); // meets difficulty 1
});

test('chain: a fresh chain validates as true', async () => {
  const chain = new Blockchain(1);
  await chain.addBlock('one');
  await chain.addBlock('two');
  assert.deepEqual(chain.validate(), { valid: true });
});

test('chain: tampered data fails validation AND names the broken block', async () => {
  const chain = new Blockchain(1);
  await chain.addBlock('honest data');
  chain.chain[1].data = 'HACKED!'; // corrupt without re-mining
  const result = chain.validate();
  assert.equal(result.valid, false);
  assert.equal(result.blockIndex, 1);
  assert.match(result.error, /tampered/);
});

test('chain: a broken previousHash link fails validation', async () => {
  const chain = new Blockchain(1);
  await chain.addBlock('one');
  await chain.addBlock('two');
  chain.chain[2].previousHash = 'forged-link'; // snap the chain link
  const result = chain.validate();
  assert.equal(result.valid, false);
  assert.equal(result.blockIndex, 2);
});

test('chain: refuses a second mine while one is already running', async () => {
  const chain = new Blockchain(1);
  const firstMine = chain.addBlock('first'); // start, don't await yet
  await assert.rejects(chain.addBlock('second'), /Already mining/);
  await firstMine; // let the first one finish cleanly
});

test('chain: tamper() corrupts a block so validation fails (powers the demo button)', async () => {
  const chain = new Blockchain(1);
  await chain.addBlock('honest');
  chain.tamper(1, 'HACKED!'); // same call the 🧪 button makes
  const result = chain.validate();
  assert.equal(result.valid, false);
  assert.equal(result.blockIndex, 1);
});
