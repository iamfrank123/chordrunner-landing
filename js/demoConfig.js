/**
 * demoConfig.js — Demo Feature Flag System
 *
 * This is the single source of truth for ALL demo restrictions.
 * The game engine reads these flags BEFORE doing anything.
 * Nothing can be toggled from the UI — restrictions are engine-level.
 */

const DEMO_FLAGS = {
  IS_DEMO: true,

  /* ── Allowed chord types (engine-enforced) ─────────────────── */
  ALLOWED_CHORD_TYPES: ['major'],

  /* ── Allowed roots: only natural (white keys) ──────────────── */
  ALLOWED_ROOTS: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],

  /* ── Allowed chord keys (computed from CHORD_DB) ───────────── */
  ALLOWED_CHORDS: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],

  /* ── Only the first level is accessible ────────────────────── */
  MAX_LEVEL_INDEX: 0,

  /* ── Survival mode is enabled for the demo to show monsters ───── */
  SURVIVAL_ENABLED: true,
  CUSTOM_MODE_ENABLED: false,
  EAR_TRAINING_ENABLED: false,
  ADVANCED_SETTINGS_ENABLED: false,

  /* ── Monster HP reduced for demo (very easy) ────────────────── */
  MONSTER_HP_MULTIPLIER: 0.15, 

  /* ── Max session duration in seconds ───────────────────────── */
  MAX_DURATION_SEC: 60,

  /* ── Fixed respawn speed for demo (no customisation) ────────── */
  FIXED_SPAWN_MS: 4000,
};

/**
 * Returns true if a chord key is allowed in the demo.
 * Called by the game engine before showing/accepting any chord.
 */
function isDemoChordAllowed(chordKey) {
  if (!DEMO_FLAGS.IS_DEMO) return true;
  const entry = typeof CHORD_DB !== 'undefined' ? CHORD_DB[chordKey] : null;
  if (!entry) return false;

  // It must be a basic major triad according to the DB
  if (!DEMO_FLAGS.ALLOWED_CHORD_TYPES.includes(entry.type)) return false;

  // The chordKey itself for major triads on white keys is exactly 1 character (C, D, E, F, G, A, B)
  // or contains explicit natural letters, but MUST NOT contain # or b.
  if (chordKey.includes('#') || chordKey.includes('b')) return false;

  // Verify the root is strictly allowed
  const root = chordKey.replace(/[^A-G]/g, '').charAt(0);
  return DEMO_FLAGS.ALLOWED_ROOTS.includes(root);
}

/**
 * Filters a chord list to only include demo-allowed chords.
 */
function filterDemoChords(chordKeys) {
  if (!DEMO_FLAGS.IS_DEMO) return chordKeys;
  return chordKeys.filter(isDemoChordAllowed);
}
