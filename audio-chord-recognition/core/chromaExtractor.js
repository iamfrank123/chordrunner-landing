/**
 * chromaExtractor.js — FFT-based chroma feature extraction
 *
 * Converts the frequency-domain data from the AnalyserNode
 * into a 12-bin chroma vector (one bin per pitch class C..B).
 *
 * Approach:
 *  1. Read Float32 frequency data (in dB) from AnalyserNode
 *  2. Map each FFT bin to its corresponding musical pitch
 *  3. Accumulate energy per pitch class (0–11)
 *  4. L2-normalize the result
 *
 * This is a lightweight alternative to Essentia.js that runs
 * entirely on the browser's built-in FFT via AnalyserNode.
 */

const ChromaExtractor = (() => {
  // Pre-computed mapping: for each FFT bin, which pitch class (0–11) does it belong to?
  // -1 means "out of musical range, ignore"
  let _binToPitchClass = null;
  let _binWeights      = null;
  let _numBins         = 0;

  /** Reference frequency for A4 */
  const A4_FREQ = 440.0;
  /** MIDI note number for A4 */
  const A4_MIDI = 69;

  /**
   * Initialize the bin-to-pitch-class mapping for the given FFT configuration.
   * Must be called once before extracting chroma.
   *
   * @param {number} fftSize     e.g. 4096
   * @param {number} sampleRate  e.g. 44100
   */
  function init(fftSize, sampleRate) {
    _numBins = fftSize / 2;
    _binToPitchClass = new Int8Array(_numBins);
    _binWeights      = new Float32Array(_numBins);

    const binFreqStep = sampleRate / fftSize;

    for (let bin = 0; bin < _numBins; bin++) {
      const freq = bin * binFreqStep;

      // Ignore frequencies outside the musical range (below ~30Hz or above ~5000Hz)
      if (freq < 30 || freq > 5000) {
        _binToPitchClass[bin] = -1;
        _binWeights[bin] = 0;
        continue;
      }

      // Convert frequency to MIDI note number (continuous)
      const midiNote = 12 * Math.log2(freq / A4_FREQ) + A4_MIDI;
      // Pitch class = midiNote mod 12
      const pitchClass = Math.round(midiNote) % 12;
      _binToPitchClass[bin] = (pitchClass + 12) % 12; // ensure positive

      // Weight: how close is this bin's frequency to the exact pitch?
      // Bins closer to exact pitch frequencies contribute more.
      const nearestMidi = Math.round(midiNote);
      const centsOff = Math.abs(midiNote - nearestMidi) * 100; // deviation in cents
      // Gaussian-like weighting: full weight at center, drops off beyond 30 cents
      _binWeights[bin] = Math.exp(-0.5 * (centsOff / 30) * (centsOff / 30));
    }
  }

  /**
   * Extract a 12-bin chroma vector from the current frequency data.
   *
   * @param {Float32Array} freqData  Frequency data in dB from AnalyserNode
   * @returns {number[]}  L2-normalized 12-element chroma vector
   */
  function extract(freqData) {
    if (!_binToPitchClass) {
      console.warn('[ChromaExtractor] Not initialized. Call init() first.');
      return new Array(12).fill(0);
    }

    const chroma = new Array(12).fill(0);

    for (let bin = 0; bin < _numBins && bin < freqData.length; bin++) {
      const pc = _binToPitchClass[bin];
      if (pc < 0) continue;

      // Convert dB to linear power (freqData is in dB, typically -100 to 0)
      // Clamp to avoid extremely low values
      const dbValue = Math.max(freqData[bin], -100);
      const linearPower = Math.pow(10, dbValue / 20);

      // Accumulate weighted power into the pitch class bin
      chroma[pc] += linearPower * _binWeights[bin];
    }

    // L2 normalize
    return normalizeVector(chroma);
  }

  return { init, extract };
})();
