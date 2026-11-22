// Lantern Thief — guard AI.
// A guard patrols waypoints, watches a vision cone, and runs a suspicion
// meter (0..1) on the thief. Meter full -> ALARM: chase the thief. Lose
// sight for a while -> drop back to SUSPICIOUS, investigate the last seen
// spot, then return to patrol. Noises (running feet, a thrown pebble) pull
// a patrolling guard to investigate.
(function () {
  'use strict';

  var L = window.LT.level;

  var VIEW_RANGE = 175;      // px, how far a guard can see
  var VIEW_HALF = 0.70;      // radians, half of the ~80 degree cone
  var PATROL_SPEED = 55;     // px/s
  var CHASE_SPEED = 138;     // px/s — slightly faster than the thief's walk
  var INVESTIGATE_SPEED = 85;
  var ALARM_LOSE_TIME = 4.0; // seconds out of sight before giving up the chase
  var CATCH_DIST = 26;       // px — a chasing guard this close catches you

  function angleLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }

  function Guard(def) {
    var pts = def.waypoints.map(function (w) { return L.tileCenter(w[0], w[1]); });
    this.name = def.name;
    this.waypoints = pts;
    this.pauseAtStop = def.pause;
    this.x = pts[0].x;
    this.y = pts[0].y;
    this.angle = Math.PI / 2; // face down the gallery to start
    this.wpIndex = 1 % pts.length;
    this.pauseTimer = 0;
    this.scanPhase = 0;
    this.state = 'patrol';    // patrol | suspicious | alarmed | returning
    this.suspicion = 0;       // 0..1, fills while the thief is visible
    this.lastSeen = null;     // {x, y} where the thief was last spotted
    this.investigate = null;  // {x, y} noise point to check out
    this.lookTimer = 0;       // seconds spent looking around while suspicious
    this.loseTimer = 0;       // seconds the thief has been out of sight
    this.caught = false;
  }

  // Can this guard see the thief right now? Range, cone angle, line of sight.
  Guard.prototype.canSee = function (px, py) {
    var dx = px - this.x;
    var dy = py - this.y;
    var dist = Math.hypot(dx, dy);
    if (dist > VIEW_RANGE) return false;
    if (dist > 12 && angleDiff(this.angle, Math.atan2(dy, dx)) > VIEW_HALF) return false;
    return L.losClear(this.x, this.y, px, py);
  };

  // Move toward (tx, ty) at `speed`, sliding along walls. Returns distance left.
  Guard.prototype.stepToward = function (tx, ty, speed, dt) {
    var dx = tx - this.x;
    var dy = ty - this.y;
    var dist = Math.hypot(dx, dy);
    if (dist < 2) return 0;
    var step = Math.min(dist, speed * dt);
    var nx = this.x + (dx / dist) * step;
    var ny = this.y + (dy / dist) * step;
    if (!L.hitsSolid(nx, this.y, 13)) this.x = nx;
    if (!L.hitsSolid(this.x, ny, 13)) this.y = ny;
    this.angle = angleLerp(this.angle, Math.atan2(dy, dx), Math.min(1, dt * 10));
    return Math.hypot(tx - this.x, ty - this.y);
  };

  Guard.prototype.update = function (dt, thief, noises) {
    var visible = this.canSee(thief.x, thief.y);

    // --- suspicion meter ---
    if (visible) {
      var dist = Math.hypot(thief.x - this.x, thief.y - this.y);
      var rate = 1.5 - dist / VIEW_RANGE; // closer = spotted faster
      if (thief.running) rate *= 1.6;
      if (thief.sneaking) rate *= 0.55;
      if (L.inShadow(thief.x, thief.y)) rate *= 0.5;
      this.suspicion = Math.min(1, this.suspicion + rate * dt);
      this.lastSeen = { x: thief.x, y: thief.y };
      this.loseTimer = 0;
    } else {
      this.suspicion = Math.max(0, this.suspicion - 0.35 * dt);
      if (this.state === 'alarmed') this.loseTimer += dt;
    }

    if (this.suspicion >= 1 && this.state !== 'alarmed') {
      this.state = 'alarmed';
      this.loseTimer = 0;
    }

    // Bumping into a guard at arm's length gives you away instantly,
    // whatever state the guard is in — no walking through a watchman.
    if (this.state !== 'alarmed') {
      var bump = Math.hypot(thief.x - this.x, thief.y - this.y);
      if (bump < 22) {
        this.suspicion = 1;
        this.state = 'alarmed';
        this.lastSeen = { x: thief.x, y: thief.y };
        this.loseTimer = 0;
      }
    }

    // --- noises pull a calm guard to investigate ---
    if (this.state === 'patrol' || this.state === 'returning') {
      for (var i = 0; i < noises.length; i++) {
        var n = noises[i];
        if (Math.hypot(n.x - this.x, n.y - this.y) <= n.radius) {
          this.state = 'suspicious';
          this.investigate = { x: n.x, y: n.y };
          this.lookTimer = 0;
          break;
        }
      }
    }

    // --- state behaviour ---
    if (this.state === 'alarmed') {
      if (visible) {
        this.stepToward(thief.x, thief.y, CHASE_SPEED, dt);
        if (Math.hypot(thief.x - this.x, thief.y - this.y) < CATCH_DIST) {
          this.caught = true;
        }
      } else if (this.lastSeen) {
        this.stepToward(this.lastSeen.x, this.lastSeen.y, CHASE_SPEED, dt);
      }
      if (this.loseTimer > ALARM_LOSE_TIME) {
        this.state = 'suspicious';
        this.investigate = this.lastSeen ? { x: this.lastSeen.x, y: this.lastSeen.y } : { x: this.x, y: this.y };
        this.lookTimer = 0;
      }
      return;
    }

    if (this.state === 'suspicious') {
      if (this.investigate) {
        var left = this.stepToward(this.investigate.x, this.investigate.y, INVESTIGATE_SPEED, dt);
        if (left < 10) {
          // Arrived: look around for a while, then head back to patrol.
          this.lookTimer += dt;
          this.angle += Math.sin(this.lookTimer * 2.2) * dt * 1.4;
          if (this.lookTimer > 2.6) {
            this.state = 'returning';
            this.investigate = null;
          }
        }
      }
      return;
    }

    if (this.state === 'returning') {
      // Walk back to the nearest waypoint, then resume the patrol.
      var nearest = 0;
      var best = Infinity;
      for (var w = 0; w < this.waypoints.length; w++) {
        var d = Math.hypot(this.waypoints[w].x - this.x, this.waypoints[w].y - this.y);
        if (d < best) { best = d; nearest = w; }
      }
      var rem = this.stepToward(this.waypoints[nearest].x, this.waypoints[nearest].y, PATROL_SPEED, dt);
      if (rem < 6) {
        this.state = 'patrol';
        this.wpIndex = (nearest + 1) % this.waypoints.length;
      }
      return;
    }

    // patrol
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      this.scanPhase += dt;
      this.angle += Math.sin(this.scanPhase * 1.1) * dt * 0.9;
      return;
    }
    var target = this.waypoints[this.wpIndex];
    var left2 = this.stepToward(target.x, target.y, PATROL_SPEED, dt);
    if (left2 < 6) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.pauseTimer = this.pauseAtStop;
      this.scanPhase = 0;
    }
  };

  // Vision cone polygon, clipped against walls so it never shines through one.
  Guard.prototype.conePolygon = function () {
    var rays = 26;
    var pts = [{ x: this.x, y: this.y }];
    for (var i = 0; i <= rays; i++) {
      var a = this.angle - VIEW_HALF + (2 * VIEW_HALF * i) / rays;
      var d = L.rayHit(this.x, this.y, a, VIEW_RANGE);
      pts.push({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d });
    }
    return pts;
  };

  window.LT = window.LT || {};
  window.LT.Guard = Guard;
  window.LT.guardConsts = {
    VIEW_RANGE: VIEW_RANGE,
    VIEW_HALF: VIEW_HALF,
    CATCH_DIST: CATCH_DIST,
  };
})();
