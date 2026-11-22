// Lantern Thief — tiny WebAudio sound effects.
// No audio files: every sound is a short oscillator phrase, created only
// after the first user gesture (browsers block audio before that).
(function () {
  'use strict';

  var ctx = null;
  var muted = false;

  function ensure() {
    if (ctx) {
      // Browsers create the context suspended until a gesture; resume it
      // so the first sound after Enter actually plays.
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch (e) {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, when) {
    if (muted || !ctx) return;
    try {
      var t0 = ctx.currentTime + (when || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.08, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch (e) { /* sound is decoration; never break the game */ }
  }

  function pickup() {
    if (!ensure()) return;
    tone(660, 0.12, 'sine', 0.09, 0);
    tone(990, 0.18, 'sine', 0.08, 0.09);
  }

  function pebble() {
    if (!ensure()) return;
    tone(1400, 0.05, 'triangle', 0.05, 0);
  }

  function alert() {
    if (!ensure()) return;
    tone(220, 0.16, 'square', 0.06, 0);
    tone(175, 0.22, 'square', 0.06, 0.14);
  }

  function caught() {
    if (!ensure()) return;
    tone(160, 0.3, 'sawtooth', 0.07, 0);
    tone(110, 0.45, 'sawtooth', 0.07, 0.22);
  }

  function win() {
    if (!ensure()) return;
    tone(523, 0.16, 'sine', 0.09, 0);
    tone(659, 0.16, 'sine', 0.09, 0.14);
    tone(784, 0.3, 'sine', 0.09, 0.28);
  }

  window.LT = window.LT || {};
  window.LT.sound = {
    ensure: ensure,
    pickup: pickup,
    pebble: pebble,
    alert: alert,
    caught: caught,
    win: win,
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },
  };
})();
