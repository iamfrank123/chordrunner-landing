/**
 * normalizeVector.js — L2 (Euclidean) normalization for numeric vectors
 *
 * Ensures chroma vectors have unit length before comparison,
 * making cosine similarity scale-invariant.
 */

/**
 * Returns a new array that is the L2-normalized version of `vec`.
 * If the vector has zero magnitude, returns a zero-filled array.
 *
 * @param {number[]} vec
 * @returns {number[]}
 */
function normalizeVector(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }

  const mag = Math.sqrt(sumSq);
  if (mag === 0) return new Array(vec.length).fill(0);

  const out = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    out[i] = vec[i] / mag;
  }
  return out;
}
