// Os 6 minigames. Toda a física roda no servidor; os navegadores só mandam teclas.
const { W, H } = require('./public/shared');

const BASE_SPEED = 270;
const BASE_R = 18;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Agrupa em colocações (empates ficam no mesmo grupo). key menor = melhor.
function rankGroups(items, key) {
  const sorted = items.slice().sort((a, b) => key(a) - key(b));
  const groups = [];
  let last = null;
  for (const it of sorted) {
    const k = key(it);
    if (last !== null && Math.abs(k - last) < 1e-9) groups[groups.length - 1].push(it.id);
    else groups.push([it.id]);
    last = k;
  }
  return groups;
}

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

class BaseGame {
  constructor(room, ids, mods, cap) {
    this.room = room;
    this.mods = mods;
    this.t = 0;
    this.maxTime = Math.min(cap, this.constructor.MAX_TIME);
    this.seed = (Math.random() * 1e9) | 0;
    this.rand = rng(this.seed);
    this.events = [];
    this.ps = new Map();
    ids.forEach((id, k) => {
      const p = {
        id, n: room.player(id).n, x: 0, y: 0, vx: 0, vy: 0, r: this.radius, alive: true,
        stun: 0, inv: 0, inp: {}, dashCd: 0, dashT: 0, jumpT: 0, jumpCd: 0, fin: null, elim: null, fx: 1, fy: 0,
      };
      this.ps.set(id, p);
      this.spawn(p, k, ids.length);
    });
  }
  has(m) { return this.mods.includes(m); }
  get speed() { return BASE_SPEED * (this.has('turbo') ? 1.45 : 1); }
  get accel() { return this.has('gelo') ? 2.2 : 14; }
  get radius() { return this.has('gigantes') ? 31 : this.has('nanicos') ? 11 : BASE_R; }
  list() { return [...this.ps.values()]; }
  alive() { return this.list().filter((p) => p.alive); }
  spawn(p, k, n) { p.x = W / 2; p.y = H / 2; }

  input(id, inp) {
    const p = this.ps.get(id);
    if (p) p.inp = { u: !!inp.u, d: !!inp.d, l: !!inp.l, r: !!inp.r };
  }
  action() {}
  pick() {}
  stat(id, k, v = 1) { this.room.addStat(id, k, v); }
  fx(ev) { this.events.push(ev); }

  dir(p) {
    let x = (p.inp.r ? 1 : 0) - (p.inp.l ? 1 : 0), y = (p.inp.d ? 1 : 0) - (p.inp.u ? 1 : 0);
    const l = Math.hypot(x, y);
    if (l) { x /= l; y /= l; }
    if (this.has('invertido')) { x = -x; y = -y; }
    if (l) { p.fx = x; p.fy = y; }
    return { x, y };
  }
  move(p, dt, mul = 1) {
    if (p.stun > this.t) {
      const k = Math.pow(0.03, dt);
      p.vx *= k; p.vy *= k;
    } else if (p.dashT > this.t) {
      // mantém o impulso da investida
    } else {
      const d = this.dir(p), sp = this.speed * mul, k = Math.min(1, this.accel * dt);
      p.vx += (d.x * sp - p.vx) * k;
      p.vy += (d.y * sp - p.vy) * k;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  bounds(p, x0 = 0, y0 = 0, x1 = W, y1 = H) {
    if (p.x < x0 + p.r) { p.x = x0 + p.r; p.vx = Math.abs(p.vx) * 0.3; }
    if (p.x > x1 - p.r) { p.x = x1 - p.r; p.vx = -Math.abs(p.vx) * 0.3; }
    if (p.y < y0 + p.r) { p.y = y0 + p.r; p.vy = Math.abs(p.vy) * 0.3; }
    if (p.y > y1 - p.r) { p.y = y1 - p.r; p.vy = -Math.abs(p.vy) * 0.3; }
  }
  collideRects(p, rects) {
    for (const w of rects) {
      const nx = clamp(p.x, w[0], w[0] + w[2]), ny = clamp(p.y, w[1], w[1] + w[3]);
      let dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy);
      if (d < p.r) {
        if (d < 0.01) { dx = 0; dy = p.y < w[1] + w[3] / 2 ? -1 : 1; d = 1; }
        p.x = nx + (dx / d) * p.r; p.y = ny + (dy / d) * p.r;
        const vn = p.vx * (dx / d) + p.vy * (dy / d);
        if (vn < 0) { p.vx -= vn * (dx / d); p.vy -= vn * (dy / d); }
      }
    }
  }
  collideCircles(p, circles) {
    for (const [cx, cy, r] of circles) {
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      if (d < r + p.r) { p.x = cx + (dx / d) * (r + p.r); p.y = cy + (dy / d) * (r + p.r); }
    }
  }
  // empurra jogadores que se sobrepõem; devolve pares que colidiram
  separate(filter = (p) => p.alive) {
    const ps = this.list().filter(filter), hits = [];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (d < min) {
          if (d < 0.01) { dx = 1; dy = 0; d = 1; }
          const nx = dx / d, ny = dy / d, o = (min - d) / 2;
          a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
          hits.push([a, b, nx, ny]);
        }
      }
    }
    return hits;
  }
  dash(p, power = 720, dur = 0.17, cd = 1.3) {
    if (!p.alive || p.dashCd > this.t || p.stun > this.t) return false;
    let { x, y } = this.dir(p);
    if (!x && !y) { x = p.fx; y = p.fy; }
    p.vx = x * power; p.vy = y * power;
    p.dashT = this.t + dur; p.dashCd = this.t + cd;
    this.stat(p.id, 'dashes');
    this.fx({ k: 'dash', n: p.n });
    return true;
  }
  flags(p) {
    return (p.alive ? 1 : 0) | (p.stun > this.t ? 2 : 0) | (p.jumpT > this.t ? 4 : 0) | (p.dashT > this.t ? 8 : 0)
      | (p.fin != null ? 16 : 0) | (p.inv > this.t ? 64 : 0);
  }
  snapPlayers() {
    return this.list().map((p) => [p.n, Math.round(p.x), Math.round(p.y), Math.round(p.r), this.flags(p)]);
  }
  timeUp() { return this.t >= this.maxTime; }
  init() { return {}; }
  snap() { return {}; }
  hud() { return ''; }
  bonus() { return 0; }
}

// ======================= LASER RUN =======================
class LaserRun extends BaseGame {
  static MAX_TIME = 90;
  constructor(...a) {
    super(...a);
    this.finishX = 1170;
    this.lasers = [];
    const cols = [270, 420, 570, 720, 870, 1020];
    const types = ['gate', 'rot', 'blink', 'gate', 'rot', 'gate'].sort(() => this.rand() - 0.5);
    cols.forEach((x, i) => {
      const t = types[i], ph = this.rand() * 6.28, w = 0.9 + this.rand() * 0.9;
      if (t === 'gate') this.lasers.push({ t, x, ph, w, gap: 150 });
      if (t === 'rot') { this.lasers.push({ t, x, y: 220, L: 170, ph, w: w * (this.rand() < 0.5 ? 1 : -1) }); this.lasers.push({ t, x, y: 500, L: 170, ph: ph + 1.5, w: -w }); }
      if (t === 'blink') this.lasers.push({ t, x, ph: this.rand() * 2, period: 2.4 });
    });
    this.order = 0;
  }
  spawn(p, k, n) { p.x = 60; p.y = 120 + (k + 0.5) * (480 / n); }
  // segmentos ativos no instante t (mesma fórmula do navegador)
  segments(t) {
    const segs = [];
    for (const l of this.lasers) {
      if (l.t === 'gate') {
        const c = H / 2 + Math.sin(t * l.w + l.ph) * (H / 2 - 130);
        segs.push([l.x, 40, l.x, c - l.gap / 2], [l.x, c + l.gap / 2, l.x, H - 40]);
      } else if (l.t === 'rot') {
        const a = t * l.w + l.ph;
        segs.push([l.x - Math.cos(a) * l.L, l.y - Math.sin(a) * l.L, l.x + Math.cos(a) * l.L, l.y + Math.sin(a) * l.L]);
      } else if (l.t === 'blink') {
        const ph = ((t + l.ph) % l.period) / l.period;
        if (ph > 0.55) segs.push([l.x, 40, l.x, H - 40]);
      }
    }
    return segs;
  }
  tick(dt) {
    const segs = this.segments(this.t);
    for (const p of this.list()) {
      if (p.fin != null) { p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx * dt; p.y += p.vy * dt; this.bounds(p, 0, 40, W, H - 40); continue; }
      this.move(p, dt);
      this.bounds(p, 0, 40, W, H - 40);
      if (p.inv <= this.t && segs.some((s) => segDist(p.x, p.y, ...s) < p.r + 3)) {
        p.stun = this.t + 1.1; p.inv = this.t + 2.2;
        p.vx = -420; p.vy = 0;
        this.stat(p.id, 'laserHits'); this.stat(p.id, 'stunTime', 1.1);
        this.fx({ k: 'zap', n: p.n, x: p.x | 0, y: p.y | 0 });
      }
      if (p.x > this.finishX) {
        p.fin = this.t; this.order++;
        this.room.bestTime(p.id, this.t);
        this.fx({ k: 'finish', n: p.n, place: this.order });
      }
    }
  }
  over() { return this.timeUp() || this.list().every((p) => p.fin != null); }
  ranking() { return rankGroups(this.list(), (p) => p.fin != null ? p.fin : 10000 - p.x); }
  init() { return { lasers: this.lasers, finishX: this.finishX }; }
  hud() { return `Chegaram: ${this.order}/${this.ps.size}`; }
}

// ======================= LAST FLOOR =======================
class LastFloor extends BaseGame {
  static MAX_TIME = 120;
  constructor(...a) {
    super(...a);
    this.cols = 14; this.rows = 8; this.size = 74;
    this.ox = (W - this.cols * this.size) / 2; this.oy = (H - this.rows * this.size) / 2 + 10;
    this.tiles = new Array(this.cols * this.rows).fill(0); // 0 firme, 1 rachando, 2 caiu
    this.crackAt = new Array(this.tiles.length).fill(0);
    this.elimOrder = 0;
    this.nextRandom = 3;
  }
  spawn(p, k, n) {
    const a = (k / n) * Math.PI * 2;
    p.x = W / 2 + Math.cos(a) * 200; p.y = H / 2 + 10 + Math.sin(a) * 140;
  }
  tileAt(x, y) {
    const c = Math.floor((x - this.ox) / this.size), r = Math.floor((y - this.oy) / this.size);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }
  crack(i, delay) {
    if (i < 0 || this.tiles[i] !== 0) return;
    this.tiles[i] = 1; this.crackAt[i] = this.t + delay;
  }
  action(id) {
    const p = this.ps.get(id);
    if (!p || !p.alive || p.jumpCd > this.t) return;
    p.jumpT = this.t + 0.6; p.jumpCd = this.t + 1.05;
    this.stat(id, 'jumps');
    this.fx({ k: 'jump', n: p.n });
  }
  tick(dt) {
    // rachaduras viram buraco
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === 1 && this.t >= this.crackAt[i]) this.tiles[i] = 2;
    // pisos somem sozinhos, cada vez mais rápido
    if (this.t >= this.nextRandom && this.t > 3) {
      const solid = this.tiles.map((v, i) => v === 0 ? i : -1).filter((i) => i >= 0);
      const n = 1 + Math.floor(this.t / 20);
      for (let k = 0; k < n && solid.length; k++) this.crack(solid.splice(Math.floor(this.rand() * solid.length), 1)[0], 1.2);
      this.nextRandom = this.t + Math.max(0.35, 1.4 - this.t / 60);
    }
    for (const p of this.alive()) {
      this.move(p, dt);
      this.bounds(p, this.ox - 30, this.oy - 30, this.ox + this.cols * this.size + 30, this.oy + this.rows * this.size + 30);
    }
    this.separate();
    for (const p of this.alive()) {
      if (p.jumpT > this.t) continue;
      const i = this.tileAt(p.x, p.y);
      if (this.t < 3 && i >= 0) continue; // carência no início
      if (i < 0 || this.tiles[i] === 2) {
        p.alive = false; p.elim = this.t; this.elimOrder++;
        this.stat(p.id, 'falls');
        this.fx({ k: 'fall', n: p.n, x: p.x | 0, y: p.y | 0 });
      } else this.crack(i, 1.15);
    }
  }
  over() { return this.timeUp() || this.alive().length <= (this.ps.size > 1 ? 1 : 0); }
  ranking() {
    if (this.alive().length === 1) this.alive()[0].survivor = true;
    return rankGroups(this.list(), (p) => p.alive ? -1e6 : -p.elim);
  }
  init() { return { cols: this.cols, rows: this.rows, size: this.size, ox: this.ox, oy: this.oy }; }
  snap() { return { tiles: this.tiles.join('') }; }
  hud() { return `De pé: ${this.alive().length}/${this.ps.size}`; }
}

// ======================= KNOCKOUT =======================
class Knockout extends BaseGame {
  static MAX_TIME = 120;
  constructor(...a) {
    super(...a);
    this.cx = W / 2; this.cy = H / 2;
    this.R0 = 320; this.Rmin = 130;
    this.kos = {};
  }
  get R() { return this.R0 - (this.R0 - this.Rmin) * Math.min(1, this.t / 75); }
  spawn(p, k, n) {
    const a = (k / n) * Math.PI * 2;
    p.x = W / 2 + Math.cos(a) * 190; p.y = H / 2 + Math.sin(a) * 190;
    p.lastHit = null; p.lastHitT = -9;
  }
  get accel() { return this.has('gelo') ? 1.6 : 7; }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 760, 0.18, 1.25); }
  tick(dt) {
    for (const p of this.alive()) { this.move(p, dt); }
    for (const [a, b, nx, ny] of this.separate()) {
      const ad = a.dashT > this.t, bd = b.dashT > this.t;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      const imp = Math.max(160, rel) * (ad || bd ? 1.5 : 0.9);
      const ma = a.r * a.r, mb = b.r * b.r;
      a.vx -= nx * imp * (mb / (ma + mb)) * 2; a.vy -= ny * imp * (mb / (ma + mb)) * 2;
      b.vx += nx * imp * (ma / (ma + mb)) * 2; b.vy += ny * imp * (ma / (ma + mb)) * 2;
      if (ad) { b.lastHit = a.id; b.lastHitT = this.t; b.dashT = 0; this.fx({ k: 'bump', x: (a.x + b.x) / 2 | 0, y: (a.y + b.y) / 2 | 0 }); }
      if (bd) { a.lastHit = b.id; a.lastHitT = this.t; a.dashT = 0; this.fx({ k: 'bump', x: (a.x + b.x) / 2 | 0, y: (a.y + b.y) / 2 | 0 }); }
      if (!ad && !bd) { a.lastHit = b.id; a.lastHitT = this.t; b.lastHit = a.id; b.lastHitT = this.t; }
    }
    for (const p of this.alive()) {
      if (Math.hypot(p.x - this.cx, p.y - this.cy) > this.R + p.r * 0.4) {
        p.alive = false; p.elim = this.t;
        this.stat(p.id, 'falls');
        let by = null;
        if (p.lastHit && this.t - p.lastHitT < 3 && this.ps.get(p.lastHit).alive) {
          by = p.lastHit; this.kos[by] = (this.kos[by] || 0) + 1;
          this.stat(by, 'kos'); this.stat(by, 'sabot');
        }
        this.fx({ k: 'ko', n: p.n, by: by ? this.ps.get(by).n : null, x: p.x | 0, y: p.y | 0 });
      }
    }
  }
  over() { return this.timeUp() || this.alive().length <= (this.ps.size > 1 ? 1 : 0); }
  ranking() {
    if (this.alive().length === 1) this.alive()[0].survivor = true;
    return rankGroups(this.list(), (p) => p.alive ? -1e6 : -p.elim);
  }
  bonus(id) { return (this.kos[id] || 0) * 20; }
  init() { return { cx: this.cx, cy: this.cy }; }
  snap() { return { R: Math.round(this.R) }; }
  hud() { return `Na arena: ${this.alive().length}/${this.ps.size}`; }
}

// ======================= MEMORY GLITCH =======================
class MemoryGlitch extends BaseGame {
  static MAX_TIME = 150;
  constructor(...a) {
    super(...a);
    this.level = 0; this.maxLevels = 6;
    this.score = {}; this.timeSum = {};
    this.list().forEach((p) => { this.score[p.id] = 0; this.timeSum[p.id] = 0; });
    this.flash = this.has('turbo') || this.has('apagao') ? 0.32 : 0.6;
    this.reverse = this.has('invertido');
    this.nextLevel(1.5);
  }
  nextLevel(delay = 0) {
    this.level++;
    this.seq = Array.from({ length: this.level + 2 }, () => Math.floor(this.rand() * 4));
    this.phase = 'wait'; this.phaseT = this.t + delay;
    this.prog = {}; this.state = {}; this.doneOrder = 0;
    this.list().forEach((p) => { this.prog[p.id] = 0; this.state[p.id] = 0; }); // 0 jogando, 1 acertou, 2 errou
  }
  expected(k) { return this.reverse ? this.seq[this.seq.length - 1 - k] : this.seq[k]; }
  pick(id, v) {
    v = Number(v);
    if (this.phase !== 'input' || !(v >= 0 && v < 4) || this.state[id] !== 0) return;
    const p = this.ps.get(id);
    if (v === this.expected(this.prog[id])) {
      this.prog[id]++;
      this.fx({ k: 'memok', n: p.n });
      if (this.prog[id] >= this.seq.length) {
        this.state[id] = 1; this.doneOrder++;
        const pts = Math.max(1, 6 - this.doneOrder);
        this.score[id] += pts;
        const tt = this.t - this.inputStart;
        this.timeSum[id] += tt;
        this.room.bestMemory(id, tt / this.seq.length);
        this.fx({ k: 'memdone', n: p.n, order: this.doneOrder });
      }
    } else {
      this.state[id] = 2; this.timeSum[id] += 30;
      this.fx({ k: 'memfail', n: p.n });
    }
  }
  tick() {
    if (this.phase === 'wait' && this.t >= this.phaseT) { this.phase = 'show'; this.phaseT = this.t; }
    if (this.phase === 'show') {
      const step = this.flash + 0.18;
      if (this.t - this.phaseT >= this.seq.length * step + 0.2) {
        this.phase = 'input'; this.inputStart = this.t; this.inputEnd = this.t + 4 + this.seq.length * 1.2;
      }
    }
    if (this.phase === 'input') {
      const allDone = this.list().every((p) => this.state[p.id] !== 0);
      if (allDone || this.t >= this.inputEnd) {
        this.list().forEach((p) => { if (this.state[p.id] === 0) { this.state[p.id] = 2; this.timeSum[p.id] += 30; } });
        this.phase = 'reveal'; this.phaseT = this.t + 2.2;
      }
    }
    if (this.phase === 'reveal' && this.t >= this.phaseT) {
      if (this.level >= this.maxLevels || this.t > this.maxTime - 12) this.finished = true;
      else this.nextLevel(0.6);
    }
  }
  lit() {
    if (this.phase !== 'show') return -1;
    const step = this.flash + 0.18, e = this.t - this.phaseT, k = Math.floor(e / step);
    if (k >= this.seq.length || e - k * step > this.flash) return -1;
    return this.seq[k] + 10 * k; // cor + índice (para piscar de novo cores repetidas)
  }
  over() { return this.finished || this.timeUp(); }
  ranking() { return rankGroups(this.list(), (p) => -this.score[p.id] * 1000 + this.timeSum[p.id] / 1000); }
  init() { return { reverse: this.reverse }; }
  snap() {
    return {
      phase: this.phase, level: this.level, len: this.seq.length, lit: this.lit(),
      left: this.phase === 'input' ? Math.max(0, this.inputEnd - this.t).toFixed(1) : null,
      st: this.list().map((p) => [p.n, this.prog[p.id], this.state[p.id], this.score[p.id]]),
      seq: this.phase === 'reveal' ? this.seq : null,
    };
  }
  hud() { return `Fase ${this.level}/${this.maxLevels}`; }
}

// ======================= NEON RACE =======================
class NeonRace extends BaseGame {
  static MAX_TIME = 150;
  constructor(...a) {
    super(...a);
    this.len = 8800; this.finishX = 8600;
    const R = this.rand;
    this.walls = []; this.boosts = []; this.goo = []; this.boxes = [];
    const top = 60, bot = H - 60;
    this.walls.push([0, 0, this.len, top], [0, bot, this.len, H - bot]);
    let x = 420;
    let kind = 0;
    while (x < this.finishX - 300) {
      const k = kind++ % 4;
      if (k === 0) { // parede com duas passagens
        const g1 = top + 40 + R() * 150, g2 = bot - 40 - R() * 150;
        this.walls.push([x, top, 40, g1 - top], [x, g1 + 110, 40, (g2 - 110) - (g1 + 110)], [x, g2, 40, bot - g2]);
        this.boosts.push([x + 120, (g1 + 55) - 35, 140, 70]);
      } else if (k === 1) { // blocos espalhados + gosma
        for (let i = 0; i < 3; i++) this.walls.push([x + R() * 200, top + 60 + R() * 420, 60 + R() * 50, 60 + R() * 50]);
        this.goo.push([x + 250, top + R() * 300, 220, 200]);
      } else if (k === 2) { // atalho estreito no meio, volta longa pelas bordas
        const cy = (top + bot) / 2;
        this.walls.push([x, cy - 170, 260, 140], [x, cy + 30, 260, 140]);
        this.boosts.push([x + 30, cy - 25, 200, 50]);
        this.goo.push([x, top, 260, 70], [x, bot - 70, 260, 70]);
      } else { // caixas de item
        for (let i = 0; i < 4; i++) this.boxes.push({ x: x + 80, y: top + 70 + i * ((bot - top - 140) / 3), ready: 0 });
        this.walls.push([x + 220, top + 120 + R() * 200, 50, 120]);
      }
      x += 520;
    }
    this.walls = this.walls.filter((w) => w[2] > 0 && w[3] > 0);
    this.mines = []; this.order = 0; this.mineId = 0;
    this.list().forEach((p) => { p.item = null; p.boostT = 0; });
  }
  spawn(p, k, n) { p.x = 90; p.y = 120 + (k + 0.5) * (480 / n); }
  inRect(p, r) { return p.x > r[0] && p.x < r[0] + r[2] && p.y > r[1] && p.y < r[1] + r[3]; }
  action(id) {
    const p = this.ps.get(id);
    if (!p || p.fin != null || !p.item || p.stun > this.t) return;
    const it = p.item; p.item = null;
    this.stat(id, 'items');
    if (it === 'turbo') { p.boostT = this.t + 1.8; this.fx({ k: 'turbo', n: p.n }); }
    if (it === 'mina') {
      this.mines.push({ id: ++this.mineId, x: p.x - p.fx * (p.r + 22), y: p.y - p.fy * (p.r + 22), owner: id, armed: this.t + 0.7 });
      this.fx({ k: 'mine', n: p.n });
    }
    if (it === 'choque') {
      this.fx({ k: 'shock', n: p.n, x: p.x | 0, y: p.y | 0 });
      for (const o of this.list()) {
        if (o === p || o.fin != null || Math.hypot(o.x - p.x, o.y - p.y) > 240) continue;
        o.stun = this.t + 1.1; this.stat(o.id, 'stunTime', 1.1); this.stat(id, 'sabot');
      }
    }
  }
  tick(dt) {
    for (const p of this.list()) {
      if (p.fin != null) { p.vx *= 0.92; p.vy *= 0.92; p.x += p.vx * dt; p.y += p.vy * dt; continue; }
      let mul = 1.12;
      if (this.boosts.some((b) => this.inRect(p, b))) p.boostT = Math.max(p.boostT, this.t + 0.9);
      if (p.boostT > this.t) mul *= 1.75;
      if (this.goo.some((g) => this.inRect(p, g))) mul *= 0.42;
      this.move(p, dt, mul);
      // colisão com paredes
      for (const w of this.walls) {
        const nx = clamp(p.x, w[0], w[0] + w[2]), ny = clamp(p.y, w[1], w[1] + w[3]);
        let dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy);
        if (d < p.r) {
          if (d < 0.01) { dx = 0; dy = p.y < w[1] + w[3] / 2 ? -1 : 1; d = 1; }
          p.x = nx + (dx / d) * p.r; p.y = ny + (dy / d) * p.r;
          const vn = p.vx * (dx / d) + p.vy * (dy / d);
          if (vn < 0) { p.vx -= vn * (dx / d); p.vy -= vn * (dy / d); }
        }
      }
      if (p.x < p.r) p.x = p.r;
      // caixas de item
      for (const b of this.boxes) {
        if (b.ready <= this.t && !p.item && Math.hypot(p.x - b.x, p.y - b.y) < p.r + 20) {
          b.ready = this.t + 4;
          p.item = ['turbo', 'mina', 'choque'][Math.floor(this.rand() * 3)];
          this.fx({ k: 'item', n: p.n, item: p.item });
        }
      }
      // minas
      for (const m of this.mines) {
        if (m.hit || m.armed > this.t || (m.owner === p.id && m.armed + 0.6 > this.t)) continue;
        if (Math.hypot(p.x - m.x, p.y - m.y) < p.r + 14) {
          m.hit = true; p.stun = this.t + 1.4; p.vx = -p.vx * 0.5; p.vy = -p.vy * 0.5;
          this.stat(p.id, 'stunTime', 1.4);
          if (m.owner !== p.id) this.stat(m.owner, 'sabot');
          this.fx({ k: 'boom', small: 1, x: m.x | 0, y: m.y | 0, n: p.n });
        }
      }
      if (p.x > this.finishX) {
        p.fin = this.t; this.order++;
        this.room.bestTime(p.id, this.t);
        this.fx({ k: 'finish', n: p.n, place: this.order });
      }
    }
    this.mines = this.mines.filter((m) => !m.hit);
    this.separate((p) => p.fin == null);
  }
  over() { return this.timeUp() || this.list().every((p) => p.fin != null); }
  ranking() { return rankGroups(this.list(), (p) => p.fin != null ? p.fin : 10000 - p.x); }
  init() { return { len: this.len, finishX: this.finishX, walls: this.walls, boosts: this.boosts, goo: this.goo }; }
  snap() {
    return {
      mines: this.mines.map((m) => [m.x | 0, m.y | 0, m.armed > this.t ? 0 : 1]),
      boxes: this.boxes.map((b) => [b.x, b.y | 0, b.ready <= this.t ? 1 : 0]),
      items: this.list().map((p) => [p.n, p.item, p.boostT > this.t ? 1 : 0]),
    };
  }
  hud() { return `Chegaram: ${this.order}/${this.ps.size}`; }
}

// ======================= HOT BOMB =======================
class HotBomb extends BaseGame {
  static MAX_TIME = 150;
  constructor(...a) {
    super(...a);
    this.pillars = [[320, 220, 45], [960, 220, 45], [320, 500, 45], [960, 500, 45], [640, 360, 60]];
    this.holder = null; this.fuseEnd = 0; this.fuseLen = 1; this.passT = -9; this.prevHolder = null;
    this.nextBombT = 2; this.order = 0;
  }
  spawn(p, k, n) {
    const a = (k / n) * Math.PI * 2;
    p.x = W / 2 + Math.cos(a) * 420; p.y = H / 2 + Math.sin(a) * 250;
  }
  giveBomb() {
    const al = this.alive();
    if (al.length < 2) return;
    const p = al[Math.floor(this.rand() * al.length)];
    this.holder = p.id; this.prevHolder = null;
    this.fuseLen = 7 + this.rand() * 8; this.fuseEnd = this.t + this.fuseLen;
    this.fx({ k: 'newbomb', n: p.n });
  }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 650, 0.2, 1.6); }
  tick(dt) {
    if (!this.holder && this.t >= this.nextBombT) this.giveBomb();
    for (const p of this.alive()) {
      this.move(p, dt, p.id === this.holder ? 1.12 : 1);
      this.bounds(p, 30, 30, W - 30, H - 30);
      for (const [cx, cy, r] of this.pillars) {
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
        if (d < r + p.r) { p.x = cx + (dx / d) * (r + p.r); p.y = cy + (dy / d) * (r + p.r); }
      }
    }
    for (const [a, b] of this.separate()) {
      if (!this.holder || this.t - this.passT < 0.45) continue;
      let from = null, to = null;
      if (a.id === this.holder) { from = a; to = b; } else if (b.id === this.holder) { from = b; to = a; }
      if (!from) continue;
      if (to.id === this.prevHolder && this.t - this.passT < 1.0) continue;
      this.prevHolder = from.id; this.holder = to.id; this.passT = this.t;
      this.stat(from.id, 'sabot'); this.stat(from.id, 'passes');
      this.fx({ k: 'pass', from: from.n, to: to.n, x: to.x | 0, y: to.y | 0 });
    }
    if (this.holder) this.stat(this.holder, 'bombTime', dt);
    if (this.holder && this.t >= this.fuseEnd) {
      const p = this.ps.get(this.holder);
      p.alive = false; p.elim = this.t; this.holder = null;
      this.stat(p.id, 'booms');
      this.fx({ k: 'boom', n: p.n, x: p.x | 0, y: p.y | 0 });
      for (const o of this.alive()) {
        const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < 260) { o.vx += (dx / d) * 600; o.vy += (dy / d) * 600; o.stun = this.t + 0.4; }
      }
      this.nextBombT = this.t + 1.6;
    }
  }
  over() { return this.timeUp() || this.alive().length <= (this.ps.size > 1 ? 1 : 0); }
  ranking() {
    if (this.alive().length === 1) this.alive()[0].survivor = true;
    return rankGroups(this.list(), (p) => p.alive ? (p.id === this.holder ? -1e5 : -1e6) : -p.elim);
  }
  init() { return { pillars: this.pillars }; }
  snap() {
    const h = this.holder ? this.ps.get(this.holder).n : null;
    const left = this.holder ? (this.fuseEnd - this.t) / this.fuseLen : 1;
    return { h, heat: Math.round((1 - left) * 100) };
  }
  hud() { return `Vivos: ${this.alive().length}/${this.ps.size}`; }
}

const GAME_CLASSES = { laser: LaserRun, floor: LastFloor, knockout: Knockout, memory: MemoryGlitch, race: NeonRace, bomb: HotBomb };
module.exports = { GAME_CLASSES, BaseGame, rng, clamp, rankGroups, segDist };
