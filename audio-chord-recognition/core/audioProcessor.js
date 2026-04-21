/**
 * audioProcessor.js — Audio processing chain (filters + analyser)
 *
 * Builds the Web Audio processing chain:
 *   source → highpass(80Hz) → lowpass(5000Hz) → analyserNode
 *
 * Also provides silence detection via RMS threshold.
 */

const AudioProcessor = (() => {
  let _analyser     = null;
  let _highpass     = null;
  let _lowpass      = null;
  let _timeDomainBuf = null;
  let _freqDataBuf   = null;

  /**
   * Build the audio processing chain and connect it.
   *
   * @param {AudioContext} audioCtx
   * @param {MediaStreamAudioSourceNode} sourceNode
   * @returns {{ analyser: AnalyserNode }}
   */
  function buildChain(audioCtx, sourceNode) {
    // High-pass filter: remove rumble below 80 Hz
    _highpass = audioCtx.createBiquadFilter();
    _highpass.type = 'highpass';
    _highpass.frequency.value = AUDIO_CONSTANTS.HIGHPASS_FREQ;
    _highpass.Q.value = 0.7;

    // Low-pass filter: remove harmonics above 5000 Hz
    _lowpass = audioCtx.createBiquadFilter();
    _lowpass.type = 'lowpass';
    _lowpass.frequency.value = AUDIO_CONSTANTS.LOWPASS_FREQ;
    _lowpass.Q.value = 0.7;

    // Analyser node for FFT data extraction
    _analyser = audioCtx.createAnalyser();
    _analyser.fftSize = AUDIO_CONSTANTS.FFT_SIZE;
    _analyser.smoothingTimeConstant = 0.4;  // moderate smoothing between frames

    // Connect the chain: source → highpass → lowpass → analyser
    sourceNode.connect(_highpass);
    _highpass.connect(_lowpass);
    _lowpass.connect(_analyser);

    // Pre-allocate typed arrays for getFloatTimeDomainData / getFloatFrequencyData
    _timeDomainBuf = new Float32Array(_analyser.fftSize);
    _freqDataBuf   = new Float32Array(_analyser.frequencyBinCount);

    return { analyser: _analyser };
  }

  /**
   * Returns the current frequency data (Float32Array in dB).
   * @returns {Float32Array}
   */
  function getFrequencyData() {
    if (!_analyser) return null;
    _analyser.getFloatFrequencyData(_freqDataBuf);
    return _freqDataBuf;
  }

  /**
   * Check if the current audio level is above the silence threshold.
   * Uses RMS of the time-domain signal.
   *
   * @returns {boolean} true if sound detected, false if silence
   */
  function isAboveSilence() {
    if (!_analyser) return false;

    _analyser.getFloatTimeDomainData(_timeDomainBuf);

    let sumSq = 0;
    for (let i = 0; i < _timeDomainBuf.length; i++) {
      sumSq += _timeDomainBuf[i] * _timeDomainBuf[i];
    }
    const rms = Math.sqrt(sumSq / _timeDomainBuf.length);

    return rms >= AUDIO_CONSTANTS.SILENCE_RMS_THRESHOLD;
  }

  /**
   * Disconnect all nodes and clean up.
   */
  function destroy() {
    try {
      if (_highpass) _highpass.disconnect();
      if (_lowpass)  _lowpass.disconnect();
      if (_analyser) _analyser.disconnect();
    } catch (e) { /* already disconnected */ }

    _analyser      = null;
    _highpass      = null;
    _lowpass       = null;
    _timeDomainBuf = null;
    _freqDataBuf   = null;
  }

  /**
   * @returns {AnalyserNode|null}
   */
  function getAnalyser() {
    return _analyser;
  }

  return { buildChain, getFrequencyData, isAboveSilence, destroy, getAnalyser };
})();
