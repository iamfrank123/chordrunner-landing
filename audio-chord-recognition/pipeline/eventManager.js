/**
 * eventManager.js — Anti-spam event emitter for chord detections
 *
 * Emits chord detection events only when meaningful changes occur:
 *  - Chord changed (different from last emitted)
 *  - Confidence delta > 0.1 (significant confidence shift)
 *
 * Filters out:
 *  - Detections with confidence < 0.55
 *  - Unstable detections (stable === false)
 *  - Silence frames
 *
 * Output matches the standard format (spec §16).
 */

const ChordEventManager = (() => {
  let _lastEmittedChord      = null;
  let _lastEmittedConfidence = 0;
  let _callbacks = [];

  /**
   * Register a callback for chord detection events.
   * @param {function} cb  Receives the standard output object
   */
  function onChordDetected(cb) {
    if (typeof cb === 'function') {
      _callbacks.push(cb);
    }
  }

  /**
   * Remove all registered callbacks.
   */
  function clearCallbacks() {
    _callbacks = [];
  }

  /**
   * Process a smoothed detection result and emit if appropriate.
   *
   * @param {{ chord: string|null, confidence: number, stable: boolean }} smoothed
   * @param {boolean} isSilent  Whether the current frame is below silence threshold
   */
  function process(smoothed, isSilent) {
    // Rule: ignore silence
    if (isSilent) {
      // Emit a "no chord" event if we had one before
      if (_lastEmittedChord !== null) {
        _lastEmittedChord = null;
        _lastEmittedConfidence = 0;
        _emit(null);
      }
      return;
    }

    const { chord, confidence, stable } = smoothed;

    // Rule: ignore if confidence too low (spec §17)
    if (confidence < AUDIO_CONSTANTS.MIN_CONFIDENCE) return;

    // Rule: ignore if not stable (spec §17)
    if (!stable) return;

    // Anti-spam: only emit if chord changed OR confidence delta > 0.1
    const chordChanged = chord !== _lastEmittedChord;
    const confidenceDelta = Math.abs(confidence - _lastEmittedConfidence);

    if (!chordChanged && confidenceDelta <= AUDIO_CONSTANTS.ANTI_SPAM_DELTA) {
      return; // No meaningful change → suppress
    }

    _lastEmittedChord      = chord;
    _lastEmittedConfidence = confidence;

    if (chord) {
      // Parse chord key to extract root and quality
      const parsed = _parseChordKey(chord);

      /** Standard output (spec §16) */
      const event = {
        chord:      chord,
        root:       parsed.root,
        quality:    parsed.quality,
        confidence: confidence,
        stable:     true,
        timestamp:  Date.now(),
        source:     'mic'
      };

      _emit(event);
    }
  }

  /**
   * Emit event to all registered callbacks.
   * @param {object|null} event
   */
  function _emit(event) {
    for (const cb of _callbacks) {
      try {
        cb(event);
      } catch (e) {
        console.error('[ChordEventManager] Callback error:', e);
      }
    }
  }

  /**
   * Parse a chord key string into root + quality.
   * E.g. "Cmaj7" → { root: "C", quality: "maj7" }
   *      "C#m7"  → { root: "C#", quality: "min7" }
   *      "C"     → { root: "C", quality: "major" }
   *
   * @param {string} key
   * @returns {{ root: string, quality: string }}
   */
  function _parseChordKey(key) {
    // Try each root (longest first to match "C#" before "C")
    const roots = ['C#', 'Eb', 'F#', 'Ab', 'Bb', 'C', 'D', 'E', 'F', 'G', 'A', 'B'];

    for (const root of roots) {
      if (key.startsWith(root)) {
        const suffix = key.slice(root.length);
        let quality = CHORD_QUALITY.MAJOR;

        if (suffix === 'm')        quality = CHORD_QUALITY.MINOR;
        else if (suffix === 'maj7') quality = CHORD_QUALITY.MAJ7;
        else if (suffix === 'm7')   quality = CHORD_QUALITY.MIN7;
        else if (suffix === '7')    quality = CHORD_QUALITY.DOMINANT7;
        else if (suffix === '9')    quality = CHORD_QUALITY.NINTH;
        else if (suffix === '')     quality = CHORD_QUALITY.MAJOR;

        return { root, quality };
      }
    }

    return { root: key, quality: CHORD_QUALITY.MAJOR };
  }

  /**
   * Emit a chord event IMMEDIATELY, bypassing anti-spam and stability checks.
   * Used by the latch mechanism when the target chord is detected even once.
   *
   * @param {string} chordKey     e.g. "Cmaj7"
   * @param {number} confidence   Raw confidence value
   */
  function processImmediate(chordKey, confidence) {
    const parsed = _parseChordKey(chordKey);

    const event = {
      chord:      chordKey,
      root:       parsed.root,
      quality:    parsed.quality,
      confidence: confidence,
      stable:     true,
      timestamp:  Date.now(),
      source:     'mic',
      latched:    true  // flag so game knows this was an instant match
    };

    _lastEmittedChord      = chordKey;
    _lastEmittedConfidence = confidence;

    _emit(event);
  }

  /**
   * Reset the anti-spam state.
   */
  function reset() {
    _lastEmittedChord      = null;
    _lastEmittedConfidence = 0;
  }

  return { onChordDetected, clearCallbacks, process, processImmediate, reset };
})();
