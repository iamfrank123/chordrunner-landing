/**
 * cosineSimilarity.js — Cosine similarity between two numeric vectors
 *
 * Used by the chord engine to compare a live chroma vector
 * against precomputed chord templates.
 */

/**
 * Computes the cosine similarity between vectors a and b.
 * Both must be the same length. Returns a value in [-1, 1].
 * Returns 0 if either vector has zero magnitude.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
