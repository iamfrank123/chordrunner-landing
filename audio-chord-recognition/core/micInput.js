/**
 * micInput.js — Microphone access and AudioContext management
 *
 * Handles:
 * - Requesting microphone permission (getUserMedia)
 * - Creating/resuming an AudioContext (44100 Hz)
 * - Connecting the media stream as a source node
 * - Cleanup on stop (releasing mic stream)
 *
 * PWA note: AudioContext must be created/resumed after a user gesture
 * on iOS Safari. The start() method should be called from a click handler.
 */

const MicInput = (() => {
  let _audioCtx = null;
  let _stream   = null;
  let _sourceNode = null;

  /**
   * Request microphone access and create the AudioContext.
   * Must be called after a user gesture (click/tap) for iOS PWA support.
   *
   * @returns {Promise<{audioCtx: AudioContext, sourceNode: MediaStreamAudioSourceNode}>}
   */
  async function start() {
    // Request microphone
    _stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl:  false,
        sampleRate:       AUDIO_CONSTANTS.SAMPLE_RATE
      }
    });

    // Create AudioContext
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: AUDIO_CONSTANTS.SAMPLE_RATE
    });

    // iOS/Safari: resume if suspended
    if (_audioCtx.state === 'suspended') {
      await _audioCtx.resume();
    }

    // Create source from mic stream
    _sourceNode = _audioCtx.createMediaStreamSource(_stream);

    return {
      audioCtx:   _audioCtx,
      sourceNode: _sourceNode
    };
  }

  /**
   * Stop microphone and release all resources.
   */
  function stop() {
    // Disconnect source
    if (_sourceNode) {
      try { _sourceNode.disconnect(); } catch (e) { /* already disconnected */ }
      _sourceNode = null;
    }

    // Stop all mic tracks (releases the mic indicator)
    if (_stream) {
      _stream.getTracks().forEach(track => track.stop());
      _stream = null;
    }

    // Close AudioContext
    if (_audioCtx) {
      _audioCtx.close().catch(() => {});
      _audioCtx = null;
    }
  }

  /**
   * @returns {AudioContext|null}
   */
  function getAudioContext() {
    return _audioCtx;
  }

  /**
   * @returns {boolean}
   */
  function isActive() {
    return _audioCtx !== null && _audioCtx.state === 'running';
  }

  return { start, stop, getAudioContext, isActive };
})();
