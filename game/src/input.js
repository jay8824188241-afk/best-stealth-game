// Lantern Thief — keyboard and mouse input.
// Classic script: exposes window.LT.input. The game loop reads the held keys
// every frame; single key presses go through `onPress` (set by main.js).
(function () {
  'use strict';

  var held = {};       // key code -> true while held
  var canvas = null;
  var clickQueue = []; // {x, y} canvas coords, consumed by the game loop
  var onPress = null;  // function(code) for Enter / P / R / M ...

  var MOVE_KEYS = {
    KeyW: true, ArrowUp: true,
    KeyA: true, ArrowLeft: true,
    KeyS: true, ArrowDown: true,
    KeyD: true, ArrowRight: true,
  };

  function moveVector() {
    var x = 0;
    var y = 0;
    if (held.KeyA || held.ArrowLeft) x -= 1;
    if (held.KeyD || held.ArrowRight) x += 1;
    if (held.KeyW || held.ArrowUp) y -= 1;
    if (held.KeyS || held.ArrowDown) y += 1;
    if (x !== 0 && y !== 0) {
      var inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x: x, y: y };
  }

  function attach(c) {
    canvas = c;
    window.addEventListener('keydown', function (e) {
      if (MOVE_KEYS[e.code] || e.code === 'Space') e.preventDefault();
      if (!e.repeat) {
        if (onPress) onPress(e.code);
      }
      held[e.code] = true;
    });
    window.addEventListener('keyup', function (e) {
      held[e.code] = false;
    });
    window.addEventListener('blur', function () {
      held = {};
    });
    // Switching tabs mid-game used to leave a movement key stuck down.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) held = {};
    });
    canvas.addEventListener('mousedown', function (e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      clickQueue.push({
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      });
    });
    // Don't let the page scroll or select text while playing.
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function takeClicks() {
    var out = clickQueue;
    clickQueue = [];
    return out;
  }

  window.LT = window.LT || {};
  window.LT.input = {
    attach: attach,
    moveVector: moveVector,
    takeClicks: takeClicks,
    sneaking: function () { return !!(held.ShiftLeft || held.ShiftRight); },
    setOnPress: function (fn) { onPress = fn; },
  };
})();
