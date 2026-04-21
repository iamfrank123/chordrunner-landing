/**
 * index.js — Public API for Audio Chord Recognition module
 *
 * This is the ONLY file external code needs to interact with.
 * It orchestrates all internal modules and exposes a clean API.
 *
 * Usage (from game integration):
 *
 *   AudioChordRecognition.onChordDetected((event) => {
 *     console.log(event.chord, event.confidence);
 *   });
 *
 *   await AudioChordRecognition.startChordRecognition();
 *
 *   AudioChordRecognition.setGameContext({ root: 'C', quality: 'maj7' });
 *
 *   AudioChordRecognition.stopChordRecognition();
 *
 * Integration with game (spec §20 — NO modification to existing code):
 *   if (midiAvailable) useMIDI();
 *   else AudioChordRecognition.startChordRecognition();
 */

const AudioChordRecognition = (() => {
  let _initialized = false;

  /**
   * Start chord recognition from microphone.
   *
   * MUST be called after a user gesture (click/tap) due to
   * browser autoplay policies and iOS AudioContext restrictions.
   *
   * @returns {Promise<void>}
   * @throws {Error} If microphone access is denied or unavailable
   */
  async function startChordRecognition() {
    if (_initialized) {
      console.warn('[AudioChordRecognition] Already running. Call stop() first.');
      return;
    }

    try {
      // 1. Start microphone
      const { audioCtx, sourceNode } = await MicInput.start();
      console.log('[AudioChordRecognition] Microphone active, sampleRate:', audioCtx.sampleRate);

      // 2. Build audio processing chain
      AudioProcessor.buildChain(audioCtx, sourceNode);

      // 3. Initialize chroma extractor with actual FFT/sample rate
      ChromaExtractor.init(AUDIO_CONSTANTS.FFT_SIZE, audioCtx.sampleRate);

      // 4. Reset smoother and event manager state
      ChordSmoother.reset();
      ChordEventManager.reset();

      // 5. Start the realtime analysis loop
      RealtimeLoop.start();

      _initialized = true;
      console.log('[AudioChordRecognition] ✅ Pipeline started successfully');

    } catch (err) {
      // Cleanup on failure
      _cleanup();
      console.error('[AudioChordRecognition] ❌ Failed to start:', err);
      throw err;
    }
  }

  /**
   * Stop chord recognition and release all resources.
   * Safe to call multiple times.
   */
  function stopChordRecognition() {
    _cleanup();
    console.log('[AudioChordRecognition] Stopped and cleaned up');
  }

  /**
   * Set the current game context for context-aware filtering.
   * Pass null to clear context (search all chords).
   *
   * @param {{ root: string, quality: string }|null} ctx
   */
  function setGameContext(ctx) {
    ContextFilter.setContext(ctx);

    // Release latch so system starts listening for the new target
    RealtimeLoop.unlatch();

    // Reset smoother when context changes to avoid stale votes
    ChordSmoother.reset();
    ChordEventManager.reset();
  }

  /**
   * Register a callback for chord detection events.
   *
   * Callback receives:
   * {
   *   chord: "Cmaj7",
   *   root: "C",
   *   quality: "maj7",
   *   confidence: 0.78,
   *   stable: true,
   *   timestamp: 123456,
   *   source: "mic"
   * }
   *
   * Or null when silence / no chord detected.
   *
   * @param {function} callback
   */
  function onChordDetected(callback) {
    ChordEventManager.onChordDetected(callback);
  }

  /**
   * Check if the recognition system is currently active.
   * @returns {boolean}
   */
  function isActive() {
    return _initialized && RealtimeLoop.isRunning();
  }

  /**
   * Internal cleanup — stops everything and releases resources.
   */
  function _cleanup() {
    RealtimeLoop.stop();
    AudioProcessor.destroy();
    MicInput.stop();
    ChordSmoother.reset();
    ChordEventManager.reset();
    ContextFilter.clearContext();
    _initialized = false;
  }

  return {
    startChordRecognition,
    stopChordRecognition,
    setGameContext,
    onChordDetected,
    isActive
  };
})();
