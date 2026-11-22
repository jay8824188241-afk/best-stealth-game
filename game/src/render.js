// Lantern Thief — canvas rendering.
// Draws the museum, vision cones, guards, thief, HUD and the title /
// caught / win overlays. Pure drawing: all game state comes from main.js.
(function () {
  'use strict';

  var L = window.LT.level;
  var TILE = L.TILE;

  var RELIC_COLORS = ['#7fe0a8', '#e8c96a', '#7fb8e8'];

  function drawFloor(ctx) {
    for (var row = 0; row < L.ROWS; row++) {
      for (var col = 0; col < L.COLS; col++) {
        var x = col * TILE;
        var y = row * TILE;
        ctx.fillStyle = (row + col) % 2 === 0 ? '#171c2a' : '#141927';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
    // Shadow patches: darker floor that hides the thief.
    for (var i = 0; i < L.shadows.length; i++) {
      var s = L.shadows[i];
      ctx.fillStyle = 'rgba(4, 6, 14, 0.55)';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = 'rgba(120, 140, 190, 0.18)';
      ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
    }
  }

  function drawExit(ctx, open, pulse) {
    var e = L.exit;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = open ? '#123524' : '#1a1f2e';
    ctx.strokeStyle = open ? '#4ade80' : '#3a4157';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (open) {
      ctx.fillStyle = 'rgba(74, 222, 128,' + (0.25 + 0.15 * Math.sin(pulse * 3)) + ')';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = open ? '#4ade80' : '#5a6480';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 0, 1);
    ctx.restore();
  }

  function drawRelics(ctx, pulse) {
    for (var i = 0; i < L.relics.length; i++) {
      var r = L.relics[i];
      if (r.taken) continue;
      var bob = Math.sin(pulse * 2 + i * 2.1) * 3;
      var color = RELIC_COLORS[i % RELIC_COLORS.length];
      ctx.save();
      ctx.translate(r.x, r.y + bob);
      ctx.fillStyle = 'rgba(255, 220, 130, 0.10)';
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      // Pedestal.
      ctx.fillStyle = '#3d3a2e';
      ctx.fillRect(-10, 4, 20, 12);
      ctx.fillStyle = '#57503a';
      ctx.fillRect(-12, 2, 24, 4);
      // The relic itself: a cut gem.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(9, -4);
      ctx.lineTo(0, 4);
      ctx.lineTo(-9, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(4, -4);
      ctx.lineTo(0, -1);
      ctx.lineTo(-4, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCrates(ctx) {
    for (var i = 0; i < L.crates.length; i++) {
      var c = L.crates[i];
      ctx.fillStyle = '#4a3a22';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#5d4a2c';
      ctx.fillRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
      ctx.strokeStyle = '#2e2412';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.beginPath();
      ctx.moveTo(c.x + 3, c.y + 3);
      ctx.lineTo(c.x + c.w - 3, c.y + c.h - 3);
      ctx.moveTo(c.x + c.w - 3, c.y + 3);
      ctx.lineTo(c.x + 3, c.y + c.h - 3);
      ctx.stroke();
    }
  }

  function drawWalls(ctx) {
    for (var i = 0; i < L.walls.length; i++) {
      var w = L.walls[i];
      ctx.fillStyle = '#2b3247';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#39415c';
      ctx.fillRect(w.x, w.y, w.w, 4);
      ctx.strokeStyle = '#171b28';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
    }
  }

  var CONE_COLORS = {
    patrol: 'rgba(232, 201, 106, 0.20)',
    suspicious: 'rgba(240, 150, 60, 0.28)',
    alarmed: 'rgba(230, 60, 60, 0.34)',
    returning: 'rgba(232, 201, 106, 0.20)',
  };
  var CONE_EDGES = {
    patrol: 'rgba(232, 201, 106, 0.45)',
    suspicious: 'rgba(240, 150, 60, 0.6)',
    alarmed: 'rgba(230, 60, 60, 0.7)',
    returning: 'rgba(232, 201, 106, 0.45)',
  };

  function drawGuards(ctx, guards) {
    for (var i = 0; i < guards.length; i++) {
      var g = guards[i];
      var poly = g.conePolygon();
      ctx.fillStyle = CONE_COLORS[g.state] || CONE_COLORS.patrol;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (var p = 1; p < poly.length; p++) ctx.lineTo(poly[p].x, poly[p].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = CONE_EDGES[g.state] || CONE_EDGES.patrol;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Body: dark uniform, brass helmet ring, facing tick.
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = '#1c2436';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c8a24a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#8fa3bf';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d8d3c3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(g.angle) * 17, Math.sin(g.angle) * 17);
      ctx.stroke();
      ctx.restore();

      // Suspicion: filling arc + mark above the head.
      if (g.suspicion > 0.03 && g.state !== 'alarmed') {
        ctx.save();
        ctx.translate(g.x, g.y - 22);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.suspicion);
        ctx.stroke();
        ctx.fillStyle = g.suspicion > 0.6 ? '#f0963c' : '#e8c96a';
        ctx.font = 'bold 13px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, -14);
        ctx.restore();
      }
      if (g.state === 'alarmed') {
        ctx.fillStyle = '#ff5a5a';
        ctx.font = 'bold 16px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', g.x, g.y - 26);
      }
    }
  }

  function drawThief(ctx, thief, pulse) {
    var x = thief.x;
    var y = thief.y;
    // Lantern glow.
    var glow = ctx.createRadialGradient(x, y, 4, x, y, 52);
    glow.addColorStop(0, 'rgba(255, 214, 130, 0.28)');
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 52, 0, Math.PI * 2);
    ctx.fill();
    // Hooded cloak.
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = thief.sneaking ? '#2e4a3a' : '#3a5a48';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8d3c3';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#e8c96a';
    ctx.beginPath();
    ctx.arc(Math.cos(thief.face) * 4, Math.sin(thief.face) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (thief.sneaking) {
      ctx.fillStyle = 'rgba(216, 211, 195, 0.75)';
      ctx.font = '11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', x, y - 20);
    }
    void pulse;
  }

  function drawPebbles(ctx, pebbles, rings) {
    for (var i = 0; i < pebbles.length; i++) {
      ctx.fillStyle = '#9aa0b0';
      ctx.beginPath();
      ctx.arc(pebbles[i].x, pebbles[i].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (var j = 0; j < rings.length; j++) {
      var r = rings[j];
      var age = r.age / r.life;
      if (age >= 1) continue;
      ctx.strokeStyle = 'rgba(232, 201, 106,' + (0.8 * (1 - age)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + age * 60, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(ctx, G) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.85)';
    ctx.fillRect(0, 0, 960, 30);
    ctx.fillStyle = '#d8d3c3';
    ctx.font = '14px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    var relicText = 'Relics ' + G.relicsTaken + ' / 3';
    ctx.fillText(relicText, 12, 16);
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = i < G.relicsTaken ? RELIC_COLORS[i] : '#3a4157';
      ctx.beginPath();
      ctx.moveTo(120 + i * 22, 10);
      ctx.lineTo(126 + i * 22, 16);
      ctx.lineTo(120 + i * 22, 22);
      ctx.lineTo(114 + i * 22, 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#d8d3c3';
    ctx.fillText('Pebbles ' + G.pebbles, 200, 16);
    var mm = Math.floor(G.time / 60);
    var ss = Math.floor(G.time % 60);
    ctx.fillText('Time ' + mm + ':' + (ss < 10 ? '0' : '') + ss, 300, 16);
    ctx.fillText('Alarms ' + G.alarms, 420, 16);
    if (G.relicsTaken === 3) {
      ctx.fillStyle = '#4ade80';
      ctx.fillText('All relics stolen — reach the green EXIT!', 520, 16);
    } else {
      ctx.fillStyle = '#8a8fa0';
      ctx.fillText('Stay out of the cones. Shift = sneak, click = throw a pebble.', 520, 16);
    }
    ctx.restore();
  }

  function overlay(ctx, title, lines, accent) {
    ctx.fillStyle = 'rgba(6, 8, 14, 0.78)';
    ctx.fillRect(0, 0, 960, 640);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#e8c96a';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(title, 480, 210);
    ctx.fillStyle = '#d8d3c3';
    ctx.font = '17px Georgia, serif';
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 480, 270 + i * 30);
    }
  }

  function render(ctx, G) {
    ctx.clearRect(0, 0, 960, 640);
    drawFloor(ctx);
    drawExit(ctx, G.relicsTaken === 3, G.pulse);
    drawRelics(ctx, G.pulse);
    drawCrates(ctx);
    drawWalls(ctx);
    drawPebbles(ctx, G.pebblesOnFloor, G.rings);
    drawGuards(ctx, G.guards);
    if (G.state !== 'title') drawThief(ctx, G.thief, G.pulse);
    drawHud(ctx, G);

    if (G.state === 'title') {
      overlay(ctx, 'LANTERN THIEF', [
        'The Silent Gallery',
        '',
        'Steal the three relics and slip out the green exit.',
        'Guards patrol with lantern cones — stay out of the light,',
        'hide behind crates, sneak through the shadows.',
        '',
        'Press ENTER to begin',
      ]);
    } else if (G.state === 'paused') {
      overlay(ctx, 'PAUSED', ['Press P to keep sneaking.'], '#8fa3bf');
    } else if (G.state === 'caught') {
      overlay(ctx, 'CAUGHT!', [
        'A watchman grabbed you by the collar.',
        'Relics stolen: ' + G.relicsTaken + ' of 3   ·   Time: ' + G.timeText,
        '',
        'Press R to try again — quieter this time.',
      ], '#ff5a5a');
    } else if (G.state === 'won') {
      overlay(ctx, 'CLEAN GETAWAY', [
        'All three relics, and not a single footprint heard.',
        'Time: ' + G.timeText + '   ·   Alarms raised: ' + G.alarms,
        'Rank: ' + G.rank,
        '',
        'Press R to steal again.',
      ], '#4ade80');
    }
  }

  window.LT = window.LT || {};
  window.LT.render = render;
})();
