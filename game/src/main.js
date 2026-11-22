// Lantern Thief — game state, main loop and screenshot staging.
// Wires level, input, guards, render and sound together. Classic script,
// loaded last. The game is playable by opening game/index.html directly
// (no build step, no network), and `node main.ts` hands it in.
(function () {
  'use strict';

  var L = window.LT.level;
  var input = window.LT.input;
  var render = window.LT.render;
  var sound = window.LT.sound;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  var WALK_SPEED = 130;   // px/s — quick, but loud
  var SNEAK_SPEED = 70;   // px/s — slow, quiet, harder to spot
  var RUN_NOISE_RADIUS = 85;
  var PEBBLE_NOISE_RADIUS = 190;
  var PEBBLE_START = 3;

  var G = null; // the game state, rebuilt by reset()

  function reset() {
    // Fresh relics: level.js keeps `taken` flags on its own relic objects.
    for (var i = 0; i < L.relics.length; i++) L.relics[i].taken = false;
    G = {
      state: 'title', // title | playing | paused | caught | won
      thief: {
        x: L.start.x,
        y: L.start.y,
        face: -Math.PI / 2,
        sneaking: false,
        running: false,
      },
      guards: L.guardDefs.map(function (d) { return new window.LT.Guard(d); }),
      pebbles: PEBBLE_START,
      pebblesOnFloor: [],
      rings: [],          // expanding noise rings, {x, y, age, life}
      noises: [],         // active noise events, {x, y, radius, ttl}
      relicsTaken: 0,
      alarms: 0,
      time: 0,
      timeText: '0:00',
      rank: '',
      pulse: 0,
      shot: null,         // 'start' | 'play' | 'alert' | 'end' when staged
    };
  }

  function rankFor(time, alarms) {
    if (alarms === 0 && time <= 150) return 'S — Ghost';
    if (alarms <= 1 && time <= 240) return 'A — Shadow';
    if (alarms <= 3) return 'B — Cat Burglar';
    return 'C — Loud Tourist';
  }

  function formatTime(t) {
    var mm = Math.floor(t / 60);
    var ss = Math.floor(t % 60);
    return mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function startGame() {
    reset();
    G.state = 'playing';
    sound.ensure();
  }

  function throwPebble(x, y) {
    if (G.pebbles <= 0) return;
    G.pebbles -= 1;
    G.pebblesOnFloor.push({ x: x, y: y });
    G.rings.push({ x: x, y: y, age: 0, life: 0.7 });
    G.noises.push({ x: x, y: y, radius: PEBBLE_NOISE_RADIUS, ttl: 0.6 });
    sound.pebble();
  }

  function updatePlaying(dt) {
    var thief = G.thief;

    // --- movement ---
    var mv = input.moveVector();
    thief.sneaking = input.sneaking();
    var speed = thief.sneaking ? SNEAK_SPEED : WALK_SPEED;
    var moving = mv.x !== 0 || mv.y !== 0;
    thief.running = moving && !thief.sneaking;
    if (moving) {
      thief.face = Math.atan2(mv.y, mv.x);
      var nx = thief.x + mv.x * speed * dt;
      var ny = thief.y + mv.y * speed * dt;
      if (!L.hitsSolid(nx, thief.y, 12)) thief.x = nx;
      if (!L.hitsSolid(thief.x, ny, 12)) thief.y = ny;
      if (thief.running) {
        G.noises.push({ x: thief.x, y: thief.y, radius: RUN_NOISE_RADIUS, ttl: 0.05 });
      }
    }

    // --- pebble throws ---
    var clicks = input.takeClicks();
    for (var c = 0; c < clicks.length; c++) {
      throwPebble(clicks[c].x, clicks[c].y);
    }

    // --- relic pickup ---
    for (var i = 0; i < L.relics.length; i++) {
      var r = L.relics[i];
      if (!r.taken && Math.hypot(r.x - thief.x, r.y - thief.y) < 26) {
        r.taken = true;
        G.relicsTaken += 1;
        sound.pickup();
      }
    }

    // --- guards ---
    var wasAlarmed = 0;
    for (var g = 0; g < G.guards.length; g++) {
      var guard = G.guards[g];
      var before = guard.state;
      guard.update(dt, thief, G.noises);
      if (guard.state === 'alarmed' && before !== 'alarmed') {
        G.alarms += 1;
        sound.alert();
      }
      if (guard.caught) {
        G.state = 'caught';
        G.timeText = formatTime(G.time);
        sound.caught();
        return;
      }
      if (guard.state === 'alarmed') wasAlarmed += 1;
    }
    void wasAlarmed;

    // --- noise events age out ---
    for (var n = G.noises.length - 1; n >= 0; n--) {
      G.noises[n].ttl -= dt;
      if (G.noises[n].ttl <= 0) G.noises.splice(n, 1);
    }
    for (var k = G.rings.length - 1; k >= 0; k--) {
      G.rings[k].age += dt;
      if (G.rings[k].age >= G.rings[k].life) G.rings.splice(k, 1);
    }

    // --- win: all relics, reach the exit ---
    if (G.relicsTaken === 3 && Math.hypot(L.exit.x - thief.x, L.exit.y - thief.y) < 30) {
      G.state = 'won';
      G.timeText = formatTime(G.time);
      G.rank = rankFor(G.time, G.alarms);
      sound.win();
      return;
    }

    G.time += dt;
    G.timeText = formatTime(G.time);
  }

  // Stage a deterministic scene for a screenshot (?shot=start|play|alert|end).
  // The staged game does not update, so the render is identical every run.
  function applyShot(shot) {
    reset();
    G.shot = shot;
    if (shot === 'start') {
      G.state = 'title';
      return;
    }
    if (shot === 'play') {
      G.state = 'playing';
      // Mid-heist: one relic already stolen, thief sneaking past the
      // West guard's patrol with the South guard's cone in view.
      L.relics[0].taken = true;
      G.relicsTaken = 1;
      G.pebbles = 2;
      G.time = 47;
      G.thief.x = 450;
      G.thief.y = 380;
      G.thief.face = Math.PI / 2;
      G.thief.sneaking = true;
      G.guards[1].x = 130;
      G.guards[1].y = 360;
      G.guards[1].angle = 0;
      G.guards[1].suspicion = 0.45;
      G.guards[3].x = 620;
      G.guards[3].y = 520;
      G.guards[3].angle = Math.PI;
      return;
    }
    if (shot === 'alert') {
      G.state = 'playing';
      G.alarms = 1;
      G.time = 83;
      G.pebbles = 1;
      // The East guard has spotted the thief and is closing in, red cone.
      G.thief.x = 820;
      G.thief.y = 330;
      G.thief.face = -Math.PI / 2;
      var east = G.guards[2];
      east.x = 780;
      east.y = 420;
      east.angle = -Math.PI / 2;
      east.state = 'alarmed';
      east.suspicion = 1;
      east.lastSeen = { x: 820, y: 330 };
      return;
    }
    if (shot === 'end') {
      G.state = 'won';
      for (var i = 0; i < L.relics.length; i++) L.relics[i].taken = true;
      G.relicsTaken = 3;
      G.time = 142;
      G.timeText = formatTime(142);
      G.alarms = 1;
      G.rank = rankFor(142, 1);
      G.thief.x = L.exit.x - 40;
      G.thief.y = L.exit.y + 10;
      G.thief.face = 0;
      return;
    }
    G.state = 'title';
  }

  input.setOnPress(function (code) {
    if (code === 'Enter') {
      if (G.state === 'title' || G.state === 'caught' || G.state === 'won') startGame();
      return;
    }
    if (code === 'KeyR') {
      if (G.state !== 'title') startGame();
      return;
    }
    if (code === 'KeyP') {
      if (G.state === 'playing') G.state = 'paused';
      else if (G.state === 'paused') G.state = 'playing';
      return;
    }
    if (code === 'KeyM') {
      sound.setMuted(!sound.isMuted());
      return;
    }
    if (code === 'Space' && G.state === 'title') startGame();
  });

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    G.pulse += dt;
    // In shot mode the scene is frozen: identical pixels every run.
    if (!G.shot && G.state === 'playing') updatePlaying(dt);
    render(ctx, G);
    requestAnimationFrame(frame);
  }

  input.attach(canvas);
  reset();
  // Read-only handle for automated playtests (state, relic count, positions),
  // plus warp(): a playtest hook that moves the thief (used by the local
  // Playwright playtest to reach each relic and the exit). Not used by the
  // game itself, and unreachable from normal play.
  window.LT.debug = {
    state: function () { return G.state; },
    relicsTaken: function () { return G.relicsTaken; },
    alarms: function () { return G.alarms; },
    pebbles: function () { return G.pebbles; },
    thief: function () { return { x: G.thief.x, y: G.thief.y }; },
    warp: function (x, y) { G.thief.x = x; G.thief.y = y; },
    guards: function () {
      return G.guards.map(function (g) {
        return { x: g.x, y: g.y, state: g.state, suspicion: g.suspicion };
      });
    },
  };
  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  if (shot) applyShot(shot);
  requestAnimationFrame(frame);
})();
