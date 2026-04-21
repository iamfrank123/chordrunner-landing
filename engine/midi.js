/**
 * midi.js — Gestione Web MIDI API + Virtual Keyboard fallback
 *
 * Espone un oggetto globale `MidiManager` con:
 *   - init()                  → mostra overlay selezione input
 *   - useVirtual()            → attiva tastiera virtuale
 *   - onChordChange = fn      → setter callback(chordKey|null)
 *   - activeSemitones         → getter: Set<number> note attive
 *   - updateVirtualChords([]) → aggiorna bottoni tastiera virtuale
 */

const MidiManager = (() => {
  /* ── Stato interno ─────────────────────────────────────────── */
  let _activeMidi      = new Set();   // MIDI note numbers (0–127)
  let _activeSemitones = new Set();   // note mod 12 (0–11)
  let _useVirtual      = false;
  let _isMic           = false;
  let _midiAccess      = null;
  let _onChordChangeCb = null;
  let _onNoteChangeCb  = null;        // callback note singole (heal orb)

  /* ── Riferimenti DOM ────────────────────────────────────────── */
  const overlay       = document.getElementById('midi-overlay');
  const btnMidi       = document.getElementById('btn-midi');
  const btnVirtual    = document.getElementById('btn-virtual');
  const statusEl      = document.getElementById('midi-status');
  const vkSection     = document.getElementById('virtual-keyboard');
  const vkButtons     = document.getElementById('vk-buttons');
  const notesPlayedEl = document.getElementById('notes-played');

  /* ═══════════════════════════════════════════════════════════
     API PUBBLICA
  ═══════════════════════════════════════════════════════════ */

  function init(onChordChange) {
    _onChordChangeCb = onChordChange || null;
    _showOverlay();
  }

  function useVirtual() {
    _useVirtual = true;
    _buildVirtualKeyboard();
    vkSection.classList.remove('hidden');
    overlay.classList.add('hidden');
  }

  function updateVirtualChords(chordKeys) {
    if (_useVirtual) _renderVkButtons(chordKeys);
  }

  /* ═══════════════════════════════════════════════════════════
     OVERLAY SELEZIONE INPUT
  ═══════════════════════════════════════════════════════════ */

  function _showOverlay() {
    overlay.classList.remove('hidden');

    // Popola menu livelli
    const levelSelect = document.getElementById('level-select');
    if (levelSelect) {
      levelSelect.innerHTML = '';
      LEVELS.forEach(lvl => {
        const opt = document.createElement('option');
        opt.value = lvl.id - 1; // index base 0
        opt.textContent = `Level ${lvl.id}: ${lvl.name}`;
        levelSelect.appendChild(opt);
      });
    }

    const radios = document.querySelectorAll('input[name="game_mode"]');
    const levelsPanel = document.getElementById('levels-panel');
    const customPanel = document.getElementById('custom-chords-panel');

    radios.forEach(r => {
      r.addEventListener('change', (e) => {
        const val = e.target.value;
        customPanel.classList.toggle('hidden', val !== 'custom');
        levelsPanel.classList.toggle('hidden', val !== 'levels');
        const survPanel = document.getElementById('survival-panel');
        if (survPanel) survPanel.classList.toggle('hidden', val !== 'survival');
        const speedRow = document.querySelector('#midi-overlay .speed-dur-row');
        if (speedRow) speedRow.style.display = val === 'survival' ? 'none' : '';
      });
    });

    // Mode-col container click → golden "active-mode" highlight
    const modeCols = document.querySelectorAll('.mode-col');
    const _updateActiveMode = () => {
      const checkedVal = document.querySelector('input[name="game_mode"]:checked')?.value;
      modeCols.forEach(col => {
        const radio = col.querySelector('input[name="game_mode"]');
        col.classList.toggle('active-mode', radio?.value === checkedVal);
      });
    };
    _updateActiveMode(); // set initial state
    radios.forEach(r => r.addEventListener('change', _updateActiveMode));
    modeCols.forEach(col => {
      col.addEventListener('click', () => {
        const radio = col.querySelector('input[name="game_mode"]');
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    });

    const speedSelect = document.getElementById('speed-select');
    const speedCustomVal = document.getElementById('speed-custom-val');
    if (speedSelect && speedCustomVal) {
      speedSelect.addEventListener('change', (e) => {
        speedCustomVal.style.display = e.target.value === 'custom' ? 'block' : 'none';
      });
    }
    const btnMic        = document.getElementById('btn-mic');

    const monsterWindowSelect = document.getElementById('monster-chord-window');
    const monsterWindowCustom = document.getElementById('monster-window-custom');
    if (monsterWindowSelect && monsterWindowCustom) {
      monsterWindowSelect.addEventListener('change', (e) => {
        monsterWindowCustom.style.display = e.target.value === 'custom' ? 'block' : 'none';
      });
    }

    // Survival: timed vs unlimited toggle
    const survTypeRadios = document.querySelectorAll('input[name="survival_type"]');
    const survTimerRow = document.getElementById('survival-timer-row');
    survTypeRadios.forEach(r => {
      r.addEventListener('change', () => {
        const isUnlimited = document.querySelector('input[name="survival_type"]:checked').value === 'unlimited';
        if (survTimerRow) survTimerRow.style.display = isUnlimited ? 'none' : '';
      });
    });

    if (btnMidi) {
      btnMidi.addEventListener('click', async () => {
        try {
          btnMidi.disabled = true;
          btnMidi.textContent = '⏳ Connecting...';
          await _initMidi();
          overlay.classList.add('hidden');
          const { speedVal, durVal, waitMode, lvlIdx, customOptions, survivalOptions, wrongPenalty } = _readMenuOptions();
          if (window.startGame) window.startGame(lvlIdx, speedVal, durVal, waitMode, customOptions, survivalOptions, wrongPenalty);
        } catch (err) {
          statusEl.textContent = '❌ MIDI Error. Check permissions or connect device.';
          btnMidi.disabled = false;
          btnMidi.textContent = '🎹 Use MIDI Keyboard';
          console.error(err);
        }
      });
    }

    if (btnMic) {
      btnMic.addEventListener('click', async () => {
        try {
          btnMic.disabled = true;
          btnMic.textContent = '⏳ Starting Mic...';
          await _initMicRecognition();
          overlay.classList.add('hidden');
          const { speedVal, durVal, waitMode, lvlIdx, customOptions, survivalOptions, wrongPenalty } = _readMenuOptions();
          if (window.startGame) window.startGame(lvlIdx, speedVal, durVal, waitMode, customOptions, survivalOptions, wrongPenalty);
        } catch (err) {
          statusEl.textContent = '❌ Microphone Error. Check permissions/connect mic.';
          btnMic.disabled = false;
          btnMic.textContent = '🎤 Use Microphone';
          console.error(err);
        }
      });
    }

    if (btnVirtual) {
      btnVirtual.addEventListener('click', () => {
        useVirtual();
        const { speedVal, durVal, waitMode, lvlIdx, customOptions, survivalOptions, wrongPenalty } = _readMenuOptions();
        if (window.startGame) window.startGame(lvlIdx, speedVal, durVal, waitMode, customOptions, survivalOptions, wrongPenalty);
      });
    }
  }

  /* ── Helper: legge tutte le opzioni dal menu ─────────────── */
  function _readMenuOptions() {
    const levelSelect = document.getElementById('level-select');
    const mode = document.querySelector('input[name="game_mode"]:checked')?.value || 'levels';

    const speedSelectVal = document.getElementById('speed-select')?.value;
    let speedVal = 5000;
    if (speedSelectVal === 'custom') {
      speedVal = parseInt(document.getElementById('speed-custom-val')?.value || 7) * 1000;
    } else {
      speedVal = parseInt(speedSelectVal || 5000);
    }
    
    const durVal   = parseInt(document.getElementById('duration-select')?.value || 60);
    const waitMode = document.getElementById('wait-mode-toggle')?.checked || false;

    let lvlIdx          = 0;
    let customOptions   = null;
    let survivalOptions = null;

    if (mode === 'custom') {
      lvlIdx     = 'custom';
      const types    = Array.from(document.querySelectorAll('.custom-type-cb:checked')).map(cb => cb.value);
      const rootType = document.querySelector('input[name="custom_roots"]:checked')?.value || 'natural';
      customOptions  = { types, rootType };

    } else if (mode === 'survival') {
      const wrongPenalty = document.getElementById('wrong-penalty-toggle')?.checked !== false;

      const survType      = document.querySelector('input[name="survival_type"]:checked')?.value || 'timed';
      const survDuration  = parseInt(document.getElementById('survival-duration')?.value || 120);
      const survRoots     = document.querySelector('input[name="survival_roots"]:checked')?.value || 'natural';

      const mwSelect = document.getElementById('monster-chord-window')?.value;
      let chordWindowMs = 8000;
      if (mwSelect === 'custom') {
        chordWindowMs = parseInt(document.getElementById('monster-window-custom')?.value || 7) * 1000;
      } else {
        chordWindowMs = parseInt(mwSelect || 8000);
      }

      survivalOptions = {
        unlimited:    survType === 'unlimited',
        duration:     survDuration,
        chordWindowMs,
        roots: survRoots,
      };
      lvlIdx = 'adaptive_survival';

    } else {
      lvlIdx = parseInt(levelSelect?.value || 0);
    }

    const wrongPenalty = document.getElementById('wrong-penalty-toggle')?.checked !== false;
    return { speedVal, durVal, waitMode, lvlIdx, customOptions, survivalOptions, wrongPenalty };
  }

  /* ═══════════════════════════════════════════════════════════
     WEB MIDI API
  ═══════════════════════════════════════════════════════════ */

  async function _initMidi() {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not supported in this browser.');
    }
    _midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    _midiAccess.addEventListener('statechange', _onMidiStateChange);
    _connectAllInputs();
  }

  function _connectAllInputs() {
    if (!_midiAccess) return;
    for (const input of _midiAccess.inputs.values()) {
      input.onmidimessage = _onMidiMessage;
    }
  }

  function _onMidiStateChange(e) {
    if (e.port.type === 'input' && e.port.state === 'connected') {
      e.port.onmidimessage = _onMidiMessage;
    }
  }

  function _onMidiMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status & 0xf0;

    let isNoteOn = false;

    if (command === 0x90 && velocity > 0) {
      // Note ON
      _activeMidi.add(note);
      _activeSemitones.add(midiToSemitone(note));
      isNoteOn = true;
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      // Note OFF
      _activeMidi.delete(note);
      // Ricalcola semitoni (evita duplicati di ottave diverse)
      _activeSemitones.clear();
      for (const n of _activeMidi) _activeSemitones.add(midiToSemitone(n));
      isNoteOn = false;
    } else {
      return;
    }

    _onSemitonesChanged(isNoteOn);
  }

  /* ═══════════════════════════════════════════════════════════
     VIRTUAL KEYBOARD
  ═══════════════════════════════════════════════════════════ */

  function _buildVirtualKeyboard() {
    vkButtons.innerHTML = '';
    // Default: accordi del primo livello
    _renderVkButtons(LEVELS[0].chords);
  }

  function _renderVkButtons(chordKeys) {
    vkButtons.innerHTML = '';
    chordKeys.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'vk-btn';
      btn.id        = `vk-${key}`;
      btn.textContent = getChordLabel(key);

      const activate = (e) => {
        e.preventDefault();
        _activateSemitonesFromChord(key);
        btn.classList.add('active');
      };
      const deactivate = (e) => {
        e.preventDefault();
        _clearSemitones();
        btn.classList.remove('active');
      };

      btn.addEventListener('mousedown',  activate);
      btn.addEventListener('touchstart', activate,   { passive: false });
      btn.addEventListener('mouseup',    deactivate);
      btn.addEventListener('mouseleave', deactivate);
      btn.addEventListener('touchend',   deactivate, { passive: false });

      vkButtons.appendChild(btn);
    });
  }

  function _activateSemitonesFromChord(chordKey) {
    const notes = getChordNotes(chordKey);
    if (!notes) return;
    _activeSemitones = new Set(notes);
    _activeMidi.clear();
    _onSemitonesChanged(true);
  }

  function _clearSemitones() {
    _activeSemitones = new Set();
    _activeMidi.clear();
    _onSemitonesChanged(false);
  }

  /* ═══════════════════════════════════════════════════════════
     CHORD DETECTION & CALLBACK
  ═══════════════════════════════════════════════════════════ */

  function _onSemitonesChanged(isNoteOn = true) {
    const matchedChords = recognizeChords(_activeSemitones);
    const primaryChord = matchedChords.length > 0 ? matchedChords[0] : null;

    // Aggiorna "notes played" nel pannello HTML
    if (notesPlayedEl) {
      if (_activeSemitones.size === 0) {
        notesPlayedEl.textContent = '—';
        notesPlayedEl.className   = 'chord-name dim';
      } else {
        notesPlayedEl.textContent = primaryChord ? getChordLabel(primaryChord) : '?';
        notesPlayedEl.className   = primaryChord ? 'chord-name' : 'chord-name dim';
      }
    }

    if (_onChordChangeCb) _onChordChangeCb(matchedChords, Array.from(_activeSemitones), isNoteOn);
    // Notifica raw semitones (per heal orb)
    if (_onNoteChangeCb && _activeSemitones.size > 0) {
      _onNoteChangeCb(Array.from(_activeSemitones));
    }
  }

  /* ═══════════════════════════════════════════════════════════
     MICROPHONE API (Audio Chord Recognition)
  ═══════════════════════════════════════════════════════════ */
  async function _initMicRecognition() {
    if (typeof AudioChordRecognition === 'undefined') {
      throw new Error('AudioChordRecognition module missing. Did you include the scripts?');
    }

    try {
      await AudioChordRecognition.startChordRecognition();
      _useVirtual = false; // Disable virtual if we succeed
      _isMic = true;

      AudioChordRecognition.onChordDetected((event) => {
        if (!event) {
          // Silence or no stable chord
          if (notesPlayedEl) {
            notesPlayedEl.textContent = '—';
            notesPlayedEl.className   = 'chord-name dim';
          }
          if (_onChordChangeCb) _onChordChangeCb([], [], false);
        } else {
          // Stable chord detected
          if (notesPlayedEl) {
            notesPlayedEl.textContent = getChordLabel(event.chord);
            notesPlayedEl.className   = 'chord-name';
          }
          // The game engine expects an array of matched chord keys, raw semitones are not needed for chords
          if (_onChordChangeCb) _onChordChangeCb([event.chord], [], true);
        }
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     EXPORT (object con getter/setter corretti)
  ═══════════════════════════════════════════════════════════ */

  return {
    init,
    useVirtual,
    updateVirtualChords,

    /** Getter: Set<number> dei semitoni correntemente attivi */
    get activeSemitones() {
      return new Set(_activeSemitones);
    },

    /** Getter: true if using virtual keyboard */
    get isVirtual() {
      return _useVirtual;
    },

    /** Getter: true if using microphone */
    get isMic() {
      return _isMic;
    },

    /** Setter: imposta la callback chiamata ad ogni cambio accordo */
    set onChordChange(cb) {
      _onChordChangeCb = cb;
    },

    /** Setter: callback note grezze (semitones[]) per heal orb */
    set onNoteChange(cb) {
      _onNoteChangeCb = cb;
    },

    // A helper method for the game engine to tell the microphone pipeline what chord it expects
    setGameTargetChord(chordKey) {
      if (typeof AudioChordRecognition === 'undefined' || !AudioChordRecognition.isActive()) return;
      if (!chordKey) {
        AudioChordRecognition.setGameContext(null);
        return;
      }

      let root = chordKey;
      let quality = 'major';

      // Sort roots longest-first so 'C#' matches before 'C', etc.
      const roots = ['C#', 'Eb', 'F#', 'Ab', 'Bb', 'C', 'D', 'E', 'F', 'G', 'A', 'B'];
      for (const r of roots) {
        if (chordKey.startsWith(r)) {
          root = r;
          const suffix = chordKey.slice(r.length);
          // Longer / more-specific suffixes must be checked first
          if      (suffix === 'm7b5') quality = 'halfdim';
          else if (suffix === 'maj9') quality = 'maj9';
          else if (suffix === 'maj7') quality = 'maj7';
          else if (suffix === 'sus4') quality = 'sus4';
          else if (suffix === 'sus2') quality = 'sus2';
          else if (suffix === 'aug')  quality = 'aug';
          else if (suffix === 'dim')  quality = 'dim';
          else if (suffix === 'm9')   quality = 'min9';
          else if (suffix === 'm7')   quality = 'min7';
          else if (suffix === 'm')    quality = 'minor';
          else if (suffix === '9')    quality = 'dom9';
          else if (suffix === '7')    quality = 'dom7';
          else                        quality = 'major';  // bare root
          break;
        }
      }
      AudioChordRecognition.setGameContext({ root, quality });
    }
  };

})();
