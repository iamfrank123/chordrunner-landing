/**
 * demoMain.js — Demo Entry Point
 *
 * Initialises Phaser with the shared engine scenes but injects
 * the DEMO_FLAGS restrictions at the engine level:
 *
 *  1. MidiManager is replaced by DemoMidiManager (chord-filtered)
 *  2. LEVELS is filtered: only index 0 (Major Chords) is exposed
 *  3. LEVELS[0].chords is filtered to natural roots only (C D E F G A B)
 *  4. Monster HP is reduced via DEMO_FLAGS.MONSTER_HP_MULTIPLIER
 *
 * NOTHING in here can be bypassed from the UI — all restrictions
 * are applied before the game engine starts.
 */

/* ── 1. Restrict LEVELS to demo-allowed content ──────────────── */
(function patchLevels() {
  if (typeof LEVELS !== 'undefined') {
    // Keep only level 0 (Major Chords)
    while (LEVELS.length > 1) LEVELS.pop();

    // Filter chords to natural-root majors only
    LEVELS[0].chords = filterDemoChords(LEVELS[0].chords);
    LEVELS[0].name   = 'Major Chords — Demo';
  }
})();

/* ── 2. Patch MONSTER metadata for easy demo ─────────────────── */
(function patchMonsters() {
  if (typeof CONFIG === 'undefined' || typeof MONSTER_DEFS === 'undefined') return;
  
  const mult = DEMO_FLAGS.MONSTER_HP_MULTIPLIER;

  // Reduce HP for all monster categories
  for (const key in CONFIG.MONSTER_HP) {
    CONFIG.MONSTER_HP[key].min = Math.max(12, Math.round(CONFIG.MONSTER_HP[key].min * mult));
    CONFIG.MONSTER_HP[key].max = Math.max(20, Math.round(CONFIG.MONSTER_HP[key].max * mult));
  }

  // Make all monsters equally likely to appear so users see variety
  for (const key in CONFIG.MONSTER_WEIGHTS) {
    CONFIG.MONSTER_WEIGHTS[key] = 10;
  }
  
  // Increase spawn chance for demo so monsters appear quickly
  CONFIG.MONSTER_SPAWN_CHANCE = 0.50; 
  CONFIG.MONSTER_SPAWN_INTERVAL = 6000;

  // IMPORTANT: Restrict all monster attack chords to the 7 allowed natural majors
  for (const key in MONSTER_DEFS) {
    MONSTER_DEFS[key].chordPool = [...DEMO_FLAGS.ALLOWED_ROOTS];
  }
})();

/* ── 3. Override global MidiManager with demo version ────────── */
window.MidiManager = DemoMidiManager;

/* ── 4. Wire Start Buttons in game.html ─────────────────────── */
(function setupStartButtons() {
  const startWithMode = (isVirtual) => {
    if (typeof startGame !== 'function') return;

    // Force survival mode in demo to show the 9 monsters
    const survivalOptions = {
      duration: 60,
      unlimited: false,
      roots: 'natural',
      chordWindowMs: 2500,
    };

    // Transition overlay and start
    const overlay = document.getElementById('demo-midi-overlay');
    if (overlay) overlay.classList.add('hidden');
    
    // Set virtual mode
    MidiManager.setVirtual(isVirtual);
    if (isVirtual) {
      document.getElementById('demo-virtual-keyboard')?.classList.remove('hidden');
    }

    // Start Phaser engine with Survival Mode parameter
    window.startGame(0, 4000, 60, false, null, survivalOptions, true);
  };

  const midiBtn = document.getElementById('demo-btn-midi');
  if (midiBtn) midiBtn.onclick = () => startWithMode(false);

  const virtBtn = document.getElementById('demo-btn-virtual');
  if (virtBtn) virtBtn.onclick = () => startWithMode(true);
})();

/* ── 5. Override GameScene "Back to menu" logic ────────────────── */
(function patchGameSceneMenu() {
  // GameScene's create() method overrides the .onclick of the end-game buttons.
  // Instead of fighting the DOM, we just monkey-patch the engine function
  // it uses to handle the menu return.
  if (typeof GameScene !== 'undefined') {
    GameScene.prototype._returnToMainMenu = function() {
      // Apri il link all'acquisto in una nuova scheda, lasciando intatto il gioco sotto
      window.open('https://payhip.com/b/I3lgE', '_blank');
    };
  }
})();

/* ── 6. Kick off Phaser ──────────────────────────────────────── */
const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#131b3a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: CONFIG.DEBUG,
    },
  },
  scene: [BootScene, GameScene, UIScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',
  },
  render: {
    antialias:   true,
    pixelArt:    false,
    roundPixels: false,
  },
};

window.addEventListener('DOMContentLoaded', () => {
  // Store globally so orientation handlers can call game.scale.resize()
  window._phaserGame = new Phaser.Game(phaserConfig);
  DemoMidiManager.init(null);
});
