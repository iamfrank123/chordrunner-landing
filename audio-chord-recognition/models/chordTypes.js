/**
 * chordTypes.js — Chord quality constants and note name mappings
 *
 * Central definitions used across the audio chord recognition module.
 * Matches the game's CHORD_DB type strings for seamless integration.
 */

/** Supported chord qualities (spec §4) */
const CHORD_QUALITY = {
  MAJOR: 'major',
  MINOR: 'minor',
  MAJ7: 'maj7',
  MIN7: 'min7',
  DOMINANT7: 'dom7',
  NINTH: 'dom9',
  AUG: 'aug',
  DIM: 'dim',
  SUS2: 'sus2',
  SUS4: 'sus4',
  MAJ9: 'maj9',
  MIN9: 'min9',
  HALFDIM: 'halfdim'
};

/** All quality values as an array for iteration */
const ALL_QUALITIES = Object.values(CHORD_QUALITY);

/** Semitone → note name mapping */
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Note name → semitone mapping */
const NOTE_TO_SEMITONE = {};
NOTE_NAMES.forEach((name, i) => { NOTE_TO_SEMITONE[name] = i; });

/**
 * Interval patterns (semitones from root) for each chord quality.
 * These define the "ideal" chord structure.
 */
const QUALITY_INTERVALS = {
  [CHORD_QUALITY.MAJOR]: [0, 4, 7],
  [CHORD_QUALITY.MINOR]: [0, 3, 7],
  [CHORD_QUALITY.MAJ7]: [0, 4, 7, 11],
  [CHORD_QUALITY.MIN7]: [0, 3, 7, 10],
  [CHORD_QUALITY.DOMINANT7]: [0, 4, 7, 10],
  [CHORD_QUALITY.NINTH]: [0, 4, 7, 10, 2],  // dom9  = R 3 5 b7 9
  [CHORD_QUALITY.AUG]: [0, 4, 8],          // aug   = R 3 #5
  [CHORD_QUALITY.DIM]: [0, 3, 6],          // dim   = R b3 b5
  [CHORD_QUALITY.SUS2]: [0, 2, 7],          // sus2  = R 2 5
  [CHORD_QUALITY.SUS4]: [0, 5, 7],          // sus4  = R 4 5
  [CHORD_QUALITY.MAJ9]: [0, 4, 7, 11, 2],  // maj9  = R 3 5 7 9
  [CHORD_QUALITY.MIN9]: [0, 3, 7, 10, 2],  // min9  = R b3 5 b7 9
  [CHORD_QUALITY.HALFDIM]: [0, 3, 6, 10]       // m7b5  = R b3 b5 b7
};

/**
 * Maps game CHORD_DB type strings to our quality constants.
 * Used when translating game context into filter context.
 */
const GAME_TYPE_TO_QUALITY = {
  'major': CHORD_QUALITY.MAJOR,
  'minor': CHORD_QUALITY.MINOR,
  'maj7': CHORD_QUALITY.MAJ7,
  'min7': CHORD_QUALITY.MIN7,
  'dom7': CHORD_QUALITY.DOMINANT7,
  'dom9': CHORD_QUALITY.NINTH,
  'aug': CHORD_QUALITY.AUG,
  'dim': CHORD_QUALITY.DIM,
  'sus2': CHORD_QUALITY.SUS2,
  'sus4': CHORD_QUALITY.SUS4,
  'maj9': CHORD_QUALITY.MAJ9,
  'min9': CHORD_QUALITY.MIN9,
  'halfdim': CHORD_QUALITY.HALFDIM
};

/** System-wide audio constants (spec §3) */
const AUDIO_CONSTANTS = {
  SAMPLE_RATE: 44100,
  BUFFER_SIZE: 2048,
  ANALYSIS_INTERVAL_MS: 75,
  FFT_SIZE: 4096,
  HIGHPASS_FREQ: 80,
  LOWPASS_FREQ: 5000,
  SILENCE_RMS_THRESHOLD: 0.008,
  MIN_CONFIDENCE: 0.75,
  SMOOTHING_FRAMES: 8,
  STABILITY_THRESHOLD: 5,    // out of 8 frames
  CONTEXT_BOOST: 0.05,
  ANTI_SPAM_DELTA: 0.1
};
