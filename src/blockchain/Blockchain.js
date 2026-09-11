/**
 * Blockchain.js — Lesson 3: The Chain
 * ------------------------------------------------------------
 * A Blockchain is (for now) just:
 *
 *   1. An array of Blocks, where each block points to the previous one.
 *   2. A `difficulty` number controlling how hard mining is.
 *   3. Rules for adding blocks and validating the whole chain.
 *
 * What this file does NOT do (on purpose):
 *   - No consensus algorithm (no longest-chain voting, no p2p sync).
 *   - No wallets / signatures.
 *   Those are the natural "part 2" of this project. The chat this
 *   demo is based on explicitly said: "No need for consensus yet,
 *   just basic concept: hashing + server/client communication."
 *
 * Mental model:
 *
 *   Genesis -> Block 1 -> Block 2 -> Block 3
 *      \________/ \________/ \________/
 *       each arrow is `previousHash === previous block's hash`
 */

const Block = require('./Block');

class Blockchain {
  /**
   * @param {number} [difficulty=2] Leading zeroes required. 2 = fast demo,
   *   4+ = visibly slow. The web UI lets you change it live.
   */
  constructor(difficulty = 2) {
    this.chain = [Block.genesis()];
    this.difficulty = difficulty;
    this.isMining = false; // simple lock so two mines don't overlap
  }

  /** The newest block. New blocks build on top of this one. */
  latestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Mine + append a new block carrying `data`.
   * This is the ONLY correct way to grow the chain.
   *
   * @param {*} data Payload for the new block.
   * @param {(progress:{nonce:number,hash:string,attempts:number})=>void} [onProgress]
   * @returns {Promise<Block>} The newly mined block.
   */
  async addBlock(data, onProgress) {
    if (this.isMining) {
      throw new Error('Already mining — wait for the current block to finish.');
    }
    this.isMining = true;
    try {
      const prev = this.latestBlock();
      const block = new Block(
        prev.index + 1, // next position
        Date.now(), // now
        data, // user payload
        prev.hash // <-- THE CHAIN LINK
      );

      let attempts = 0;
      await block.mineAsync(this.difficulty, ({ nonce, hash }) => {
        attempts += 1;
        if (onProgress) onProgress({ nonce, hash, attempts });
      });

      this.chain.push(block);
      return block;
    } finally {
      this.isMining = false;
    }
  }

  /**
   * Is the chain intact? We re-check two things for EVERY block:
   *   1. Its stored `hash` actually matches its contents (no edits).
   *   2. Its `previousHash` matches the real hash of the block before it.
   *   3. (Bonus) Its hash meets the difficulty target.
   *
   * @returns {{valid:boolean, error?:string, blockIndex?:number}}
   */
  validate() {
    const target = '0'.repeat(this.difficulty);

    for (let i = 0; i < this.chain.length; i += 1) {
      const block = this.chain[i];

      // 1. Does the stored hash match a fresh recomputation?
      if (block.hash !== block.calculateHash()) {
        return {
          valid: false,
          error: `Block #${block.index} hash mismatch — data was tampered with.`,
          blockIndex: block.index,
        };
      }

      // 2. Does it link correctly to its predecessor? (skip genesis)
      if (i > 0) {
        const prev = this.chain[i - 1];
        if (block.previousHash !== prev.hash) {
          return {
            valid: false,
            error: `Block #${block.index} previousHash does not match block #${prev.index}.`,
            blockIndex: block.index,
          };
        }
      }

      // 3. Does it satisfy proof-of-work? (genesis is exempt)
      if (i > 0 && !block.hash.startsWith(target)) {
        return {
          valid: false,
          error: `Block #${block.index} does not meet difficulty ${this.difficulty}.`,
          blockIndex: block.index,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Deliberately corrupt a block so you can SEE validation fail.
   * Used by the "Tamper" button in the web demo.
   */
  tamper(index, newData) {
    const block = this.chain.find((b) => b.index === index);
    if (!block) throw new Error(`No block with index ${index}`);
    if (block.index === 0) throw new Error('Refusing to tamper with genesis (try block 1+).');
    block.data = newData;
    // NOTE: we intentionally do NOT re-mine, so validate() will fail.
    return block;
  }

  /** Plain-JSON version of the chain, safe to send over socket.io. */
  toJSON() {
    return {
      difficulty: this.difficulty,
      blocks: this.chain,
      validation: this.validate(),
    };
  }

  /** Rebuild chain instances after receiving JSON over the network. */
  static fromJSON(json) {
    const chain = new Blockchain(json.difficulty);
    chain.chain = json.blocks.map(Block.fromJSON);
    return chain;
  }
}

module.exports = Blockchain;
