/**
 * Example 2 — Mining (run: `node examples/02-mining.js`)
 *
 * Watch proof-of-work happen: we try nonce 0,1,2... until the
 * hash starts with `difficulty` zeroes. Higher difficulty =
 * exponentially more tries.
 */
const Block = require('../src/blockchain/Block');

function demo(difficulty) {
  console.log(`\n=== Mining with difficulty ${difficulty} (need "${'0'.repeat(difficulty)}...") ===`);
  const block = new Block(1, Date.now(), `demo difficulty ${difficulty}`, 'abc123');
  const start = Date.now();
  let attempts = 0;
  block.mine(difficulty, () => {
    attempts += 1;
  });
  console.log(`DONE in ${attempts} attempts, ${Date.now() - start}ms`);
  console.log(`nonce=${block.nonce} hash=${block.hash}`);
}

demo(2);
demo(3);
demo(4); // feel how much slower each extra zero is
