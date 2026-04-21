/**
 * realtimeLoop.js — 75ms analysis loop orchestrator
 *
 * Runs the full chord detection pipeline at a fixed interval:
 *   1. Check silence → skip if silent
 *   2. Extract chroma vector from FFT data
 *   3. Filter templates by game context
 *   4. Match against templates (cosine similarity)
 *   5. Apply context boost
 *   6. Push through temporal smoother
 *   7. Emit event via event manager
 */

const RealtimeLoop = (() => {
  let _intervalId = null;
  let _running    = false;

  /**
   * LATCH MECHANISM:
   * When the game sets a target chord and the system detects it
   * (even for a single 75ms frame), we immediately emit and "latch"
   * onto that chord. While latched, we suppress all further emissions
   * so background noise can't override the correct detection.
   *
   * The latch is cleared when:
   *  - setGameContext() is called (new chord target)
   *  - stopChordRecognition() is called
   */
  let _latched = false;

  /** Minimum confidence for latch activation (much stricter to prevent false positives) */
  const LATCH_MIN_CONFIDENCE = 0.78;

  /**
   * Start the analysis loop.
   * All dependent modules must be initialized before calling this.
   */
  function start() {
    if (_running) return;
    _running = true;
    _latched = false;

    _intervalId = setInterval(_tick, AUDIO_CONSTANTS.ANALYSIS_INTERVAL_MS);
    console.log('[RealtimeLoop] Started at', AUDIO_CONSTANTS.ANALYSIS_INTERVAL_MS, 'ms interval');
  }

  /**
   * Stop the analysis loop.
   */
  function stop() {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    _running = false;
    _latched = false;
    console.log('[RealtimeLoop] Stopped');
  }

  /**
   * Release the latch. Called when game context changes.
   */
  function unlatch() {
    if (_latched) {
      console.log('[RealtimeLoop] Latch released');
    }
    _latched = false;
  }

  /**
   * @returns {boolean}
   */
  function isRunning() {
    return _running;
  }

  /**
   * Single analysis tick — the core pipeline.
   */
  function _tick() {
    // If latched, skip all processing — the correct chord was already emitted
    if (_latched) return;

    // 1. Silence check
    const isSilent = !AudioProcessor.isAboveSilence();

    if (isSilent) {
      // Still process through smoother/event manager to emit "silence" events
      ChordEventManager.process(
        { chord: null, confidence: 0, stable: false },
        true
      );
      return;
    }

    // 2. Get frequency data
    const freqData = AudioProcessor.getFrequencyData();
    if (!freqData) return;

    // 3. Extract chroma vector
    const chroma = ChromaExtractor.extract(freqData);

    // 3b. Strict Peak-Ratio Guard:
    // A true chord is made of 3+ deliberately played notes, which will all have substantial energy.
    // A single note has one massive fundamental down and weak harmonics (e.g. 5ths/3rds).
    // By sorting the chroma bins, we can require the 2nd and 3rd strongest notes
    // to be a healthy percentage of the loudest note.
    const sortedChroma = [...chroma].sort((a, b) => b - a);
    const maxEnergy = sortedChroma[0];

    // If the 2nd note is less than 60% of the loudest, or the 3rd is less than 40%,
    // it's strictly rejected as a 1 or 2 note input. This prevents harmonic bleeding.
    if (sortedChroma[1] < maxEnergy * 0.60 || sortedChroma[2] < maxEnergy * 0.40) {
      ChordEventManager.process({ chord: null, confidence: 0, stable: false }, true);
      return;
    }

    // 4. Filter templates by game context
    const candidates = ContextFilter.filterTemplates(CHORD_TEMPLATES);

    // 5. Find best match via cosine similarity
    let bestChord      = null;
    let bestConfidence = -1;
    let bestQuality    = null;

    for (const template of candidates) {
      const similarity = cosineSimilarity(chroma, template.vector);

      if (similarity > bestConfidence) {
        bestConfidence = similarity;
        bestChord      = template.chordKey;
        bestQuality    = template.quality;
      }
    }

    // 6. Apply context boost
    if (bestQuality) {
      bestConfidence = ContextFilter.applyBoost(bestQuality, bestConfidence);
    }

    // ── LATCH FAST-PATH ──────────────────────────────────────
    // If game context is set AND the raw (pre-smoothed) best match
    // IS the target chord with reasonable confidence → emit immediately
    // and latch. This ensures even a single 75ms frame of correct
    // chord detection counts as a match.
    if (bestChord && bestConfidence >= LATCH_MIN_CONFIDENCE) {
      if (ContextFilter.matchesTarget(bestChord)) {
        console.log('[RealtimeLoop] ⚡ LATCH: target chord detected!', bestChord,
                     'confidence:', bestConfidence.toFixed(3));
        _latched = true;
        ChordEventManager.processImmediate(bestChord, bestConfidence);
        return;
      }
    }

    // ── NORMAL PATH (no target match) ────────────────────────
    // 7. Push through temporal smoother
    const smoothed = ChordSmoother.push({
      chord:      bestChord,
      confidence: bestConfidence
    });

    // 8. Emit via event manager (with normal anti-spam + stability checks)
    ChordEventManager.process(smoothed, false);
  }

  return { start, stop, unlatch, isRunning };
})();

