/**
 * contextFilter.js — Game-aware chord candidate filtering
 *
 * Narrows down the chord template search space based on the
 * game's current context (what chord the player is supposed to play).
 *
 * Quality-family filtering rules (spec §11):
 *  - major    → only major triads
 *  - minor    → only minor triads
 *  - maj7     → only maj7 chords
 *  - min7     → only min7 chords
 *  - dom7     → only dominant7 chords
 *  - dom9     → only 9th chords
 *  - aug      → only augmented triads
 *  - dim      → only diminished triads
 *  - sus2     → only sus2 chords
 *  - sus4     → only sus4 chords
 *  - maj9     → only maj9 chords
 *  - min9     → only min9 chords
 *  - halfdim  → only half-diminished (m7b5) chords
 *  - no context → full template set
 *
 * Also applies a +0.15 confidence boost when detected quality
 * matches the target quality.
 */

const ContextFilter = (() => {
  let _context = null; // { root: string, quality: string } or null

  /**
   * Set the current game context.
   * Call this whenever the game changes the target chord.
   *
   * @param {{ root: string, quality: string }|null} ctx
   */
  function setContext(ctx) {
    _context = ctx;
  }

  /**
   * Get the current context.
   * @returns {{ root: string, quality: string }|null}
   */
  function getContext() {
    return _context;
  }

  /**
   * Filter the full template set based on current game context.
   * Returns the subset of templates the chord engine should consider.
   *
   * @param {Array} allTemplates  The full CHORD_TEMPLATES array
   * @returns {Array}  Filtered templates
   */
  function filterTemplates(allTemplates) {
    // We no longer hard-filter by quality. This makes the engine much 'stricter' 
    // because it can now correctly identify if a player plays the wrong quality 
    // (e.g. playing minor when major is required) instead of forcing a match.
    return allTemplates;
  }

  /**
   * Apply context-aware confidence boost.
   * If the detected chord's quality matches the target, add +0.15.
   *
   * @param {string} detectedQuality
   * @param {number} rawConfidence
   * @returns {number} Adjusted confidence (capped at 1.0)
   */
  function applyBoost(detectedQuality, rawConfidence) {
    if (!_context || !_context.quality) return rawConfidence;

    if (detectedQuality === _context.quality) {
      return Math.min(1.0, rawConfidence + AUDIO_CONSTANTS.CONTEXT_BOOST);
    }
    return rawConfidence;
  }

  /**
   * Check if a detected chord key matches the current game target.
   * Used by the latch mechanism for instant recognition.
   *
   * @param {string} chordKey  e.g. "Cmaj7"
   * @returns {boolean}
   */
  function matchesTarget(chordKey) {
    if (!_context || !_context.root || !_context.quality) return false;

    // Build expected chord key from context
    const expected = _buildExpectedKey(_context.root, _context.quality);
    return chordKey === expected;
  }

  /**
   * Build the expected CHORD_DB key from root + quality.
   * @param {string} root
   * @param {string} quality
   * @returns {string}
   */
  function _buildExpectedKey(root, quality) {
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
      default:                      return root;
    }
  }

  /**
   * Get the target chord key string (for logging / debugging).
   * @returns {string|null}
   */
  function getTargetChordKey() {
    if (!_context || !_context.root || !_context.quality) return null;
    return _buildExpectedKey(_context.root, _context.quality);
  }

  /**
   * Clear the game context (e.g. when game ends).
   */
  function clearContext() {
    _context = null;
  }

  return { setContext, getContext, filterTemplates, applyBoost, matchesTarget, getTargetChordKey, clearContext };
})();
