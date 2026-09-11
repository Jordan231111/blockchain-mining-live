/**
 * Example 1 — Hashing (run: `node examples/01-hashing.js`)
 *
 * SEE for yourself:
 *  - same input  => same hash
 *  - 1-letter change => totally different hash
 *  - every hash is 64 hex chars
 */
const { sha256 } = require('../src/blockchain/hash');

console.log('--- Same input, same output ---');
console.log(sha256('hello'));
console.log(sha256('hello'));

console.log('\n--- One letter changes everything (avalanche) ---');
console.log('hello :', sha256('hello'));
console.log('hello!:', sha256('hello!'));

console.log('\n--- Fixed length ---');
console.log(`len("${sha256('a')}") =`, sha256('a').length);
console.log(`len("${sha256('a'.repeat(1000))}") =`, sha256('a'.repeat(1000)).length);
