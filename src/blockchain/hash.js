/**
 * hash.js — Lesson 1: Hashing
 * ------------------------------------------------------------
 * A hash is a one-way fingerprint of some data.
 *
 *   data (any length)  -->  SHA-256  -->  fixed 64-char hex string
 *
 * Properties that make blockchains work:
 *   1. Deterministic — same input  => same output, every time.
 *   2. Avalanche     — change 1 letter => totally different hash.
 *   3. One-way       — you cannot reverse a hash back to the data.
 *   4. Fixed size    — output is always 64 hex chars (256 bits).
 *
 * We use Node's built-in `crypto` module — no external dependency.
 */

const crypto = require('crypto');

/**
 * Hash any string with SHA-256 and return hex.
 *
 * @param {string} input - The text to fingerprint.
 * @returns {string} 64-character hex hash.
 *
 * @example
 *   sha256('hello') // => '2cf24dba5fb0a30e26e83b2ac5b9e29e...'
 */
function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Hash a JavaScript value (object/array/string/number).
 * We JSON-stringify first so objects get a stable string form.
 *
 * NOTE: JSON.stringify key order matters. For this teaching demo
 * we always build objects with the same key order, so it is stable.
 */
function hashObject(value) {
  return sha256(JSON.stringify(value));
}

module.exports = { sha256, hashObject };
