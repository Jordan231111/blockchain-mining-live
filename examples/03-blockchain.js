/**
 * Example 3 — The chain + tamper detection (run: `node examples/03-blockchain.js`)
 *
 * 1. Build a 3-block chain.
 * 2. Validate it (should pass).
 * 3. Tamper with block #1 WITHOUT re-mining.
 * 4. Validate again (should FAIL + tell you exactly where).
 */
const Blockchain = require('../src/blockchain/Blockchain');

(async () => {
  const chain = new Blockchain(2); // easy difficulty for a fast demo

  console.log('Mining block 1...');
  await chain.addBlock('Alice -> Bob $5');
  console.log('Mining block 2...');
  await chain.addBlock('Bob -> Carol $3');

  console.log('\nChain:');
  for (const b of chain.chain) {
    console.log(`  #${b.index} nonce=${b.nonce} hash=${b.hash.slice(0, 16)}… data=${JSON.stringify(b.data)}`);
  }

  console.log('\nValidate (before tamper):', chain.validate());

  // Attack! Edit old data without doing the mining work again.
  chain.chain[1].data = 'Alice -> Mallory $5000!!!';
  console.log('\nTampered with block #1 data (no re-mine).');

  console.log('Validate (after tamper):', chain.validate());
})();
