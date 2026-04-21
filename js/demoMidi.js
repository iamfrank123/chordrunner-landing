/**
 * demoMidi.js — MIDI + Virtual Keyboard for the DEMO
 *
 * Wraps the core chord recognition logic but ONLY exposes
 * major chords on natural roots (C D E F G A B).
 * Restrictions are applied at recognition time — not just UI.
 */

const DemoMidiManager = (() => {
  let _activeMidi      = new Set();
  let _activeSemitones = new Set();
  let _useVirtual      = false;
  let _isMic           = false;
  let _midiAccess      = null;
  let _onChordChangeCb = null;

  const overlay       = document.getElementById('demo-midi-overlay');
  const btnMidi       = document.getElementById('demo-btn-midi');
  const btnVirtual    = document.getElementById('demo-btn-virtual');
  const statusEl      = document.getElementById('demo-midi-status');
  const vkSection     = document.getElementById('demo-virtual-keyboard');
  const vkButtons     = document.getElementById('demo-vk-buttons');
  const notesPlayedEl = document.getElementById('notes-played');

  /* ── Demo-allowed chords (major, natural roots only) ───────── */
  const DEMO_CHORDS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  function init(onChordChange) {
    _onChordChangeCb = onChordChange || null;
    const btnMidi    = document.getElementById('demo-btn-midi');
    const btnMic     = document.getElementById('demo-btn-mic');
    const btnVirtual = document.getElementById('demo-btn-virtual');
    const statusEl   = document.getElementById('demo-midi-status');
    const overlay    = document.getElementById('demo-midi-overlay');

    if (btnMidi) {
      btnMidi.addEventListener('click', async () => {
        try {
          btnMidi.disabled = true;
          btnMidi.textContent = '⏳ Connecting...';
          await _initMidi();
          if (overlay) overlay.classList.add('hidden');
          _launchGame();
        } catch (err) {
          if (statusEl) statusEl.textContent = '❌ MIDI Error. Check permissions or connection.';
          btnMidi.disabled = false;
          btnMidi.textContent = '🎹 Use MIDI Keyboard';
        }
      });
    }

    if (btnMic) {
      btnMic.addEventListener('click', async () => {
        try {
          btnMic.disabled = true;
          btnMic.textContent = '⏳ Starting Microphone...';
          await _initMicRecognition();
          if (overlay) overlay.classList.add('hidden');
          _launchGame();
        } catch (err) {
          if (statusEl) statusEl.textContent = '❌ Microphone Error. Check permissions.';
          btnMic.disabled = false;
          btnMic.textContent = '🎤 Use Microphone';
        }
      });
    }

    if (btnVirtual) {
      btnVirtual.addEventListener('click', () => {
        useVirtual();
        if (overlay) overlay.classList.add('hidden');
        _launchGame();
      });
    }
  }

  function useVirtual() {
    _useVirtual = true;
    _buildVirtualKeyboard();
    vkSection.classList.remove('hidden');
    overlay.classList.add('hidden');
  }

  function _launchGame() {
    if (window.startGame) {
      // Level 0 = Major Chords, fixed 5s spawn, 60s duration, waitMode ON
      window.startGame(
        0,                        // levelIndex → Major Chords
        DEMO_FLAGS.FIXED_SPAWN_MS,
        DEMO_FLAGS.MAX_DURATION_SEC,
        true,                     // waitMode
        null,                     // no customOptions
        null,                     // no survivalOptions
        true                      // wrongPenalty
      );
    }
  }

  /* ── Web MIDI ──────────────────────────────────────────────── */
  async function _initMidi() {
    if (!navigator.requestMIDIAccess) throw new Error('Web MIDI API not supported.');
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
      _activeMidi.add(note);
      _activeSemitones.add(midiToSemitone(note));
      isNoteOn = true;
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      _activeMidi.delete(note);
      _activeSemitones.clear();
      for (const n of _activeMidi) _activeSemitones.add(midiToSemitone(n));
      isNoteOn = false;
    } else {
      return;
    }
    _onSemitonesChanged(isNoteOn);
  }

  /* ── Virtual Keyboard ─────────────────────────────────────── */
  function _buildVirtualKeyboard() {
    vkButtons.innerHTML = '';
    DEMO_CHORDS.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'vk-btn';
      btn.id = `demo-vk-${key}`;
      btn.textContent = key;

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

  /* ── Microphone Detection ────────────────────────────────── */
  async function _initMicRecognition() {
    if (typeof AudioChordRecognition === 'undefined') {
      throw new Error('AudioChordRecognition module missing');
    }
    
    try {
      await AudioChordRecognition.startChordRecognition();
      _useVirtual = false;
      _isMic = true;

      AudioChordRecognition.onChordDetected((event) => {
        if (!event) {
          if (notesPlayedEl) {
            notesPlayedEl.textContent = '—';
            notesPlayedEl.className   = 'chord-name dim';
          }
          if (_onChordChangeCb) _onChordChangeCb([], [], false);
        } else {
          // Check if allowed in demo (Major triads, white keys)
          const allowed = isDemoChordAllowed(event.chord);
          if (allowed) {
            if (notesPlayedEl) {
              notesPlayedEl.textContent = getChordLabel(event.chord);
              notesPlayedEl.className   = 'chord-name';
            }
            if (_onChordChangeCb) _onChordChangeCb([event.chord], [], true);
          } else {
            if (notesPlayedEl) {
              notesPlayedEl.textContent = '?'; // Hidden because it's not allowed
              notesPlayedEl.className   = 'chord-name dim';
            }
            if (_onChordChangeCb) _onChordChangeCb([], [], false);
          }
        }
      });
    } catch(e) {
      console.error(e);
      throw e;
    }
  }

  /* ── Chord Detection (demo-filtered) ─────────────────────── */
  function _onSemitonesChanged(isNoteOn = true) {
    const allMatches  = recognizeChords(_activeSemitones);
    // Engine-level filter: only major chords on natural roots
    const matched = allMatches.filter(k => isDemoChordAllowed(k));
    const primary = matched.length > 0 ? matched[0] : null;

    if (notesPlayedEl) {
      if (_activeSemitones.size === 0) {
        notesPlayedEl.textContent = '—';
        notesPlayedEl.className   = 'chord-name dim';
      } else {
        notesPlayedEl.textContent = primary ? getChordLabel(primary) : '?';
        notesPlayedEl.className   = primary ? 'chord-name' : 'chord-name dim';
      }
    }

    if (_onChordChangeCb) _onChordChangeCb(matched, Array.from(_activeSemitones), isNoteOn);
  }

  return {
    init,
    useVirtual,
    updateVirtualChords() {},   // no-op in demo
    get activeSemitones() { return new Set(_activeSemitones); },
    get isVirtual()        { return _useVirtual; },
    get isMic()            { return _isMic; },
    set onChordChange(cb)  { _onChordChangeCb = cb; },
    set onNoteChange(cb)   { /* heal orb – allowed in demo */ },
    
    // Support for latch filtering target chord
    setGameTargetChord(chordKey) {
      if (typeof AudioChordRecognition === 'undefined' || !AudioChordRecognition.isActive()) return;
      if (!chordKey) {
        AudioChordRecognition.setGameContext(null);
        return;
      }
      
      let root = chordKey;
      let quality = 'major';
      
      // Longest-match first for roots
      const roots = ['C#', 'Eb', 'F#', 'Ab', 'Bb', 'C', 'D', 'E', 'F', 'G', 'A', 'B'];
      for (const r of roots) {
        if (chordKey.startsWith(r)) {
          root = r;
          const suffix = chordKey.slice(r.length);
          // Standard Major Triad logic for demo (it only supports major types anyway)
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
          else                        quality = 'major';
          break;
        }
      }
      AudioChordRecognition.setGameContext({ root, quality });
    }
  };
})();
