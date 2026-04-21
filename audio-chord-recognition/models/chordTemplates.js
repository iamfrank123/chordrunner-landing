/**
 * chordTemplates.js — Precomputed L2-normalized chroma templates
 *
 * Generates chroma template vectors for all 12 roots × 13 qualities = 156 chords.
 * Each template is a 12-element array representing expected energy per pitch class.
 *
 * Uses weighted harmonics: root note gets a slight boost (×1.2) to help
 * disambiguation between chords sharing the same interval structure.
 */

// Depends on: chordTypes.js, normalizeVector.js (loaded before this via <script>)

/**
 * Build all chord templates. Called once at module init.
 * @returns {Array<{root: string, rootSemitone: number, quality: string, chordKey: string, vector: number[]}>}
 */
function buildChordTemplates() {
  const templates = [];

  for (let rootIdx = 0; rootIdx < 12; rootIdx++) {
    const rootName = NOTE_NAMES[rootIdx];

    for (const quality of ALL_QUALITIES) {
      const intervals = QUALITY_INTERVALS[quality];
      if (!intervals) continue;

      // Build raw chroma vector
      const chroma = new Array(12).fill(0);
      for (let i = 0; i < intervals.length; i++) {
        const pitchClass = (rootIdx + intervals[i]) % 12;
        // Root note gets a slight boost for disambiguation
        chroma[pitchClass] = (i === 0) ? 1.2 : 1.0;
      }

      // L2 normalize
      const normalized = normalizeVector(chroma);

      // Generate chord key matching CHORD_DB naming convention
      const chordKey = _buildChordKey(rootName, quality);

      templates.push({
        root:         rootName,
        rootSemitone: rootIdx,
        quality:      quality,
        chordKey:     chordKey,
        vector:       normalized
      });
    }
  }

  return templates;
}

/**
 * Generates the chord key string used in CHORD_DB.
 * E.g. root="C", quality="major" → "C"
 *      root="C", quality="min7"  → "Cm7"
 *      root="C", quality="dom7"  → "C7"
 *      root="C", quality="dom9"  → "C9"
 *      root="C", quality="maj7"  → "Cmaj7"
 *
 * @param {string} root
 * @param {string} quality
 * @returns {string}
 */
function _buildChordKey(root, quality) {
  switch (quality) {
    case CHORD_QUALITY.MAJOR:     return root;
    case CHORD_QUALITY.MINOR:     return root + 'm';
    case CHORD_QUALITY.MAJ7:      return root + 'maj7';
    case CHORD_QUALITY.MIN7:      return root + 'm7';
    case CHORD_QUALITY.DOMINANT7: return root + '7';
    case CHORD_QUALITY.NINTH:     return root + '9';
    case CHORD_QUALITY.AUG:       return root + 'aug';
    case CHORD_QUALITY.DIM:       return root + 'dim';
    case CHORD_QUALITY.SUS2:      return root + 'sus2';
    case CHORD_QUALITY.SUS4:      return root + 'sus4';
    case CHORD_QUALITY.MAJ9:      return root + 'maj9';
    case CHORD_QUALITY.MIN9:      return root + 'm9';
    case CHORD_QUALITY.HALFDIM:   return root + 'm7b5';
    default:                      return root + quality;
  }
}

/** Pre-built templates (initialized when script loads) */
const CHORD_TEMPLATES = buildChordTemplates();
