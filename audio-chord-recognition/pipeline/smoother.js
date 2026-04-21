/**
 * smoother.js — Temporal smoothing via majority vote
 *
 * Stabilizes chord detections over a sliding window of 8 frames.
 * A chord is considered "stable" only if ≥ 5 out of the last 8
 * frames agree on the same chord.
 *
 * This prevents flickering between chords during gameplay,
 * providing a reliable signal for the game input system.
 */

const ChordSmoother = (() => {
  const _buffer = new RingBuffer(AUDIO_CONSTANTS.SMOOTHING_FRAMES);

  /**
   * Push a new detection frame and compute the smoothed result.
   *
   * @param {{ chord: string|null, confidence: number }} frame
   * @returns {{ chord: string|null, confidence: number, stable: boolean }}
   */
  function push(frame) {
    _buffer.push(frame);

    const all = _buffer.getAll();
    if (all.length === 0) {
      return { chord: null, confidence: 0, stable: false };
    }

    // Count occurrences of each chord
    const counts = {};
    let totalConfidence = {};

    for (const f of all) {
      const key = f.chord || '__null__';
      counts[key] = (counts[key] || 0) + 1;
      totalConfidence[key] = (totalConfidence[key] || 0) + f.confidence;
    }

    // Find the chord with the most votes
    let bestChord = null;
    let bestCount = 0;

    for (const [key, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestCount = count;
        bestChord = key === '__null__' ? null : key;
      }
    }

    // Average confidence for the winning chord
    const avgConfidence = bestChord
      ? totalConfidence[bestChord] / bestCount
      : 0;

    // Stable if ≥ STABILITY_THRESHOLD out of SMOOTHING_FRAMES agree
    const stable = bestCount >= AUDIO_CONSTANTS.STABILITY_THRESHOLD;

    return {
      chord:      bestChord,
      confidence: Math.round(avgConfidence * 1000) / 1000,
      stable:     stable
    };
  }

  /**
   * Clear the smoothing buffer (e.g. when context changes).
   */
  function reset() {
    _buffer.clear();
  }

  return { push, reset };
})();
