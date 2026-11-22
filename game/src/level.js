// Lantern Thief — level data and geometry.
// The museum is a 24 x 16 tile grid (tile = 40 px, canvas 960 x 640).
// Map legend: '#' wall, '.' floor, ',' shadow floor (dark patch, hides you),
// 'C' tall crate (blocks movement AND sight), 'R' relic pedestal,
// 'E' exit door, 'S' player start. Guards are defined below the map.
(function () {
  'use strict';

  var TILE = 40;
  var COLS = 24;
  var ROWS = 16;

  var MAP = [
    '########################',
    '#......#......#....R..E#',
    '#......#......#........#',
    '#..C...#..C...#..C.....#',
    '#......#......#........#',
    '#..,,,,.......,,,,,,...#',
    '#####.######.######.####',
    '#......#.....#....#....#',
    '#..R...#..C..#..C.#R...#',
    '#......#.....#....#....#',
    '#..C...#..C..#....#....#',
    '#......#.....#....#....#',
    '#####.######.######.####',
    '#.....,,,,......,,,,...#',
    '#S....#.....C......C...#',
    '########################',
  ];

  // Four watchmen, each with a patrol route (tile coords) and a pause at each stop.
  var GUARD_DEFS = [
    { name: 'North',  waypoints: [[3, 3], [10, 3]],          pause: 1.6 },
    { name: 'West',   waypoints: [[2, 9], [5, 9]],           pause: 1.2 },
    { name: 'East',   waypoints: [[20, 7], [20, 10]],        pause: 1.4 },
    { name: 'South',  waypoints: [[9, 13], [17, 13]],        pause: 1.0 },
  ];

  // The map is hand-drawn: fail loudly at load time if a row is short,
  // instead of silently spawning a broken level.
  for (var r = 0; r < MAP.length; r++) {
    if (MAP[r].length !== COLS) {
      throw new Error('Lantern Thief level: row ' + r + ' is ' + MAP[r].length + ' tiles, expected ' + COLS);
    }
  }
  if (MAP.length !== ROWS) {
    throw new Error('Lantern Thief level: ' + MAP.length + ' rows, expected ' + ROWS);
  }

  var walls = [];   // {x, y, w, h} in pixels
  var crates = [];  // {x, y, w, h} in pixels — tall, block sight too
  var shadows = []; // {x, y, w, h} in pixels — dark floor patches
  var relics = [];  // {x, y, taken}
  var exit = null;  // {x, y} center in pixels
  var start = null; // {x, y} center in pixels

  function tileCenter(cx, cy) {
    return { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 };
  }

  for (var row = 0; row < ROWS; row++) {
    for (var col = 0; col < COLS; col++) {
      var ch = MAP[row].charAt(col);
      var px = col * TILE;
      var py = row * TILE;
      if (ch === '#') walls.push({ x: px, y: py, w: TILE, h: TILE });
      else if (ch === 'C') crates.push({ x: px + 4, y: py + 4, w: TILE - 8, h: TILE - 8 });
      else if (ch === ',') shadows.push({ x: px, y: py, w: TILE, h: TILE });
      else if (ch === 'R') relics.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false });
      else if (ch === 'E') exit = { x: px + TILE / 2, y: py + TILE / 2 };
      else if (ch === 'S') start = tileCenter(col, row);
    }
  }

  // All sight-blocking rectangles: walls plus tall crates.
  var blockers = walls.concat(crates);

  function pointInRect(x, y, r) {
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }

  // True when the circle at (x, y) with radius r overlaps any solid rect.
  function hitsSolid(x, y, r) {
    for (var i = 0; i < blockers.length; i++) {
      var b = blockers[i];
      var nx = Math.max(b.x, Math.min(x, b.x + b.w));
      var ny = Math.max(b.y, Math.min(y, b.y + b.h));
      var dx = x - nx;
      var dy = y - ny;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  // True when the straight segment (x1,y1)-(x2,y2) is not cut by any blocker.
  // Sampled every 5 px — cheap, and at this scale it never misses a 40 px wall.
  function losClear(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var dist = Math.hypot(dx, dy);
    var steps = Math.max(1, Math.ceil(dist / 5));
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var x = x1 + dx * t;
      var y = y1 + dy * t;
      for (var j = 0; j < blockers.length; j++) {
        if (pointInRect(x, y, blockers[j])) return false;
      }
    }
    return true;
  }

  // Distance from (x, y) along `angle` until a blocker or maxDist. Used to
  // clip vision cones against walls, so cones never shine through a wall.
  function rayHit(x, y, angle, maxDist) {
    var step = 6;
    var cx = Math.cos(angle);
    var cy = Math.sin(angle);
    for (var d = step; d <= maxDist; d += step) {
      var px = x + cx * d;
      var py = y + cy * d;
      for (var j = 0; j < blockers.length; j++) {
        if (pointInRect(px, py, blockers[j])) return d - step / 2;
      }
    }
    return maxDist;
  }

  function inShadow(x, y) {
    for (var i = 0; i < shadows.length; i++) {
      if (pointInRect(x, y, shadows[i])) return true;
    }
    return false;
  }

  // Namespace shared by the classic scripts loaded after this one.
  window.LT = window.LT || {};
  window.LT.level = {
    TILE: TILE,
    COLS: COLS,
    ROWS: ROWS,
    walls: walls,
    crates: crates,
    shadows: shadows,
    relics: relics,
    exit: exit,
    start: start,
    guardDefs: GUARD_DEFS,
    tileCenter: tileCenter,
    hitsSolid: hitsSolid,
    losClear: losClear,
    rayHit: rayHit,
    inShadow: inShadow,
  };
})();
