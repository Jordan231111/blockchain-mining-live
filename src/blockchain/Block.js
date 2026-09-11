/**
 * Block.js — Lesson 2: What is a Block?
 * ------------------------------------------------------------
 * A Block is just a container with 6 fields:
 *
 *   {
 *     index:        3,                 // position in the chain (0,1,2,3...)
 *     timestamp:    1725912345678,     // when it was created (ms since epoch)
 *     data:         "Alice -> Bob $5", // anything: string, object, transactions
 *     previousHash: "abc123...",       // hash of the block BEFORE this one
 *     nonce:        4821,              // magic number miners brute-force (see below)
 *     hash:         "000f9a..."        // fingerprint of everything above
 *   }
 *
 * The two key ideas:
 *
 *   1. CHAINING — every block stores `previousHash`.
 *      If you tamper with block #1, its hash changes, so block #2's
 *      `previousHash` no longer matches => tampering is obvious.
 *
 *   2. MINING (Proof-of-Work) — to add a block, you must find a `nonce`
 *      such that the block's hash starts with N zeroes, e.g. "000...".
 *      N = `difficulty`. There is no shortcut; you just try
 *      nonce = 0, 1, 2, 3 ... until you get lucky. That brute-force
 *      search IS mining.
 */

const { sha256 } = require('./hash');

class Block {
  /**
   * @param {number} index        Position in chain.
   * @param {number} timestamp    Date.now() when created.
   * @param {*}      data         Payload (string / object / array).
   * @param {string} previousHash Hash of previous block ("0" for genesis).
   * @param {number} [nonce=0]    Proof-of-work counter, mutated by mining.
   * @param {string} [hash=""]    Cached hash; computed by calculateHash().
   */
  constructor(index, timestamp, data, previousHash, nonce = 0, hash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = hash;
  }

  /**
   * Compute the fingerprint of this block's contents.
   * The hash covers EVERYTHING except the `hash` field itself
   * (otherwise it would be circular).
   */
  calculateHash() {
    const payload =
      this.index +
      this.timestamp +
      JSON.stringify(this.data) +
      this.previousHash +
      this.nonce;
    return sha256(payload);
  }

  /**
   * The first block in every chain. It has no predecessor,
   * so previousHash is just "0" by convention.
   */
  static genesis() {
    const block = new Block(0, Date.now(), 'Genesis Block', '0');
    block.hash = block.calculateHash();
    return block;
  }

  /**
   * Synchronous mining — easy to understand, blocks the event loop.
   * Good for lessons / tests. The server uses mineAsync() instead
   * so it can stream live progress to browsers.
   *
   * @param {number} difficulty  How many leading zeroes are required.
   * @param {(attempt:{nonce:number,hash:string})=>void} [onAttempt] Called per hash (for logging).
   * @returns {Block} this (now with valid nonce + hash).
   */
  mine(difficulty, onAttempt) {
    const target = '0'.repeat(difficulty); // e.g. difficulty 3 => "000"

    // Brute force: try nonce 0,1,2,... until hash starts with target.
    while (true) {
      this.hash = this.calculateHash();
      if (onAttempt) onAttempt({ nonce: this.nonce, hash: this.hash });
      if (this.hash.startsWith(target)) break; // FOUND IT
      this.nonce += 1;
    }
    return this;
  }

  /**
   * Async mining — same math, but yields to the event loop every
   * `batchSize` hashes so the server stays responsive and can
   * emit live `mine:progress` events over socket.io.
   *
   * @param {number} difficulty
   * @param {(attempt:{nonce:number,hash:string})=>void} [onAttempt]
   * @param {number} [batchSize=5000] Hashes per event-loop tick.
   * @returns {Promise<Block>}
   */
  async mineAsync(difficulty, onAttempt, batchSize = 5000) {
    const target = '0'.repeat(difficulty);
    let sinceYield = 0;

    while (true) {
      this.hash = this.calculateHash();
      if (onAttempt) onAttempt({ nonce: this.nonce, hash: this.hash });
      if (this.hash.startsWith(target)) return this;

      this.nonce += 1;
      sinceYield += 1;

      // Let other code (socket.io, HTTP) run for a moment.
      if (sinceYield >= batchSize) {
        sinceYield = 0;
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  /** Rebuild a Block instance from plain JSON (after network transfer). */
  static fromJSON(obj) {
    return new Block(
      obj.index,
      obj.timestamp,
      obj.data,
      obj.previousHash,
      obj.nonce,
      obj.hash
    );
  }
}

module.exports = Block;
