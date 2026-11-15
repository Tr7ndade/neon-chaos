// 10 modos novos com cara de aventura. Mesma base física dos 6 originais.
const { W, H } = require('./public/shared');
const { BaseGame, clamp, rankGroups, segDist } = require('./games');

const rectHit = (x, y, r, w) => {
  const nx = clamp(x, w[0], w[0] + w[2]), ny = clamp(y, w[1], w[1] + w[3]);
  return Math.hypot(x - nx, y - ny) < r;
};
const inRect = (x, y, w) => x > w[0] && x < w[0] + w[2] && y > w[1] && y < w[1] + w[3];

class Adventure extends BaseGame {
  // ponto livre (fora das paredes) dentro de uma área
  freePoint(x0, y0, x1, y1, rad = 30, rects = this.walls || [], tries = 60) {
    for (let k = 0; k < tries; k++) {
      const x = x0 + this.rand() * (x1 - x0), y = y0 + this.rand() * (y1 - y0);
      if (!rects.some((w) => rectHit(x, y, rad, w))) return { x, y };
    }
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  }
  place(fn) { const ps = this.list(); ps.forEach((p, k) => fn(p, k, ps.length)); }
  sc(map) { return this.list().map((p) => [p.n, Math.round((map[p.id] || 0) * 10) / 10]); }
}

// ======================= 1. TESOURO PERDIDO =======================
class Treasure extends Adventure {
  static MAX_TIME = 120;
  constructor(...a) {
    super(...a);
    this.ww = 1900; this.wh = 1150;
    const R = this.rand, t = 40;
    this.walls = [[0, 0, this.ww, t], [0, this.wh - t, this.ww, t], [0, 0, t, this.wh], [this.ww - t, 0, t, this.wh]];
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 4; gy++) {
      const cx = 160 + gx * 320, cy = 150 + gy * 280;
      if (Math.hypot(cx - this.ww / 2, cy - this.wh / 2) < 260 || R() < 0.3) continue;
      const horiz = R() < 0.5;
      this.walls.push(horiz ? [cx - 90, cy - 20, 180 + R() * 60, 44] : [cx - 22, cy - 90, 44, 180 + R() * 60]);
      if (R() < 0.35) this.walls.push([cx + 40, cy + 40, 60, 60]);
    }
    this.spikes = [];
    for (let k = 0; k < 9; k++) { const p = this.freePoint(100, 100, this.ww - 100, this.wh - 100, 70); this.spikes.push([p.x - 45, p.y - 45, 90, 90, R() * 3, 3.2]); }
    this.chests = []; this.coins = []; this.cid = 0; this.nextChest = 0;
    this.gold = {};
    this.place((p, k, n) => { const a = (k / n) * Math.PI * 2; p.x = this.ww / 2 + Math.cos(a) * 110; p.y = this.wh / 2 + Math.sin(a) * 110; p.prog = {}; });
    for (let k = 0; k < 5; k++) this.spawnChest();
  }
  spawnChest() {
    const p = this.freePoint(90, 90, this.ww - 90, this.wh - 90, 50);
    const roll = this.rand();
    this.chests.push({ id: ++this.cid, x: p.x, y: p.y, kind: roll < 0.15 ? 'mimic' : roll < 0.3 ? 'gold' : 'normal' });
  }
  spikeOn(s) { const ph = ((this.t + s[4]) % s[5]) / s[5]; return ph > 0.62 ? 2 : ph > 0.45 ? 1 : 0; }
  drop(p, n = 1) {
    n = Math.min(n, this.gold[p.id] || 0);
    for (let k = 0; k < n; k++) {
      this.gold[p.id]--;
      const a = this.rand() * 6.28;
      this.coins.push({ x: p.x + Math.cos(a) * 50, y: p.y + Math.sin(a) * 50 });
    }
    return n;
  }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 680, 0.18, 1.3); }
  tick(dt) {
    for (const p of this.list()) { this.move(p, dt); this.collideRects(p, this.walls); }
    for (const [a, b] of this.separate()) {
      for (const [atk, vic] of [[a, b], [b, a]]) {
        if (atk.dashT > this.t && vic.inv <= this.t) {
          vic.stun = this.t + 0.6; vic.inv = this.t + 1.2; atk.dashT = 0;
          if (this.drop(vic, 1)) { this.stat(atk.id, 'sabot'); }
          this.fx({ k: 'bump', x: vic.x | 0, y: vic.y | 0 });
        }
      }
    }
    for (const s of this.spikes) {
      if (this.spikeOn(s) !== 2) continue;
      for (const p of this.list()) {
        if (p.inv > this.t || !inRect(p.x, p.y, s)) continue;
        p.stun = this.t + 1; p.inv = this.t + 1.8;
        this.stat(p.id, 'stunTime', 1);
        this.drop(p, 1);
        this.fx({ k: 'spike', n: p.n, x: p.x | 0, y: p.y | 0 });
      }
    }
    for (const c of this.chests.slice()) {
      for (const p of this.list()) {
        const near = Math.hypot(p.x - c.x, p.y - c.y) < 52 && p.stun <= this.t;
        p.prog[c.id] = near ? (p.prog[c.id] || 0) + dt : 0;
        if (p.prog[c.id] >= 1.1) {
          this.chests = this.chests.filter((x) => x !== c);
          if (c.kind === 'mimic') {
            p.stun = this.t + 1.5; this.stat(p.id, 'stunTime', 1.5); this.drop(p, 2);
            this.fx({ k: 'mimic', n: p.n, x: c.x | 0, y: c.y | 0 });
          } else {
            const v = c.kind === 'gold' ? 5 : 1 + Math.floor(this.rand() * 3);
            this.gold[p.id] = (this.gold[p.id] || 0) + v;
            this.fx({ k: 'chest', n: p.n, v, x: c.x | 0, y: c.y | 0 });
          }
          this.nextChest = Math.min(this.nextChest || 99, this.t + 1.2);
          break;
        }
      }
    }
    if (this.chests.length < 5 && this.t >= this.nextChest) { this.spawnChest(); this.nextChest = this.t + 1.2; }
    for (const p of this.list()) {
      this.coins = this.coins.filter((c) => {
        if (Math.hypot(p.x - c.x, p.y - c.y) < p.r + 14) { this.gold[p.id] = (this.gold[p.id] || 0) + 1; this.fx({ k: 'coin', n: p.n }); return false; }
        return true;
      });
    }
  }
  over() { return this.timeUp(); }
  ranking() { return rankGroups(this.list(), (p) => -(this.gold[p.id] || 0)); }
  init() { return { world: { w: this.ww, h: this.wh }, walls: this.walls, spikes: this.spikes }; }
  snap() {
    const prog = (c) => Math.max(0, ...this.list().map((p) => p.prog[c.id] || 0));
    return { chests: this.chests.map((c) => [c.x | 0, c.y | 0, c.kind === 'gold' ? 1 : 0, Math.round(prog(c) / 1.1 * 100)]), coins: this.coins.map((c) => [c.x | 0, c.y | 0]), sc: this.sc(this.gold) };
  }
  hud() { return 'Abra baús · cuidado com os espinhos'; }
}

// ======================= 2. FUGA DA LAVA =======================
class LavaEscape extends Adventure {
  static MAX_TIME = 120;
  constructor(...a) {
    super(...a);
    this.ww = 7200; this.wh = H; this.finishX = 6900;
    const R = this.rand, top = 50, bot = H - 50;
    this.walls = [[0, 0, this.ww, top], [0, bot, this.ww, H - bot]];
    this.pits = [];
    for (let x = 700; x < this.finishX - 300; x += 380 + R() * 200) {
      const k = R();
      if (k < 0.4) { // poço de lava atravessado (precisa pular)
        const gapY = top + 60 + R() * (bot - top - 240);
        this.pits.push([x, top, 120, gapY - top], [x, gapY + 120, 120, bot - gapY - 120]);
        if (R() < 0.6) this.pits.push([x, gapY, 120, 120]);
      } else if (k < 0.75) { // blocos
        for (let i = 0; i < 2 + Math.floor(R() * 2); i++) this.walls.push([x + R() * 200, top + 40 + R() * (bot - top - 200), 70 + R() * 60, 70 + R() * 60]);
      } else { // corredor com poços laterais
        this.pits.push([x, top, 220, 130], [x, bot - 130, 220, 130]);
        this.walls.push([x + 60, (top + bot) / 2 - 30, 100, 60]);
      }
    }
    this.lavaX = -700; this.rocks = []; this.nextRock = 3; this.order = 0;
    this.place((p, k, n) => { p.x = 140; p.y = 120 + (k + 0.5) * ((H - 240) / n); });
  }
  action(id) {
    const p = this.ps.get(id);
    if (!p || !p.alive || p.fin != null || p.jumpCd > this.t) return;
    p.jumpT = this.t + 0.62; p.jumpCd = this.t + 1.1;
    this.stat(id, 'jumps'); this.fx({ k: 'jump', n: p.n });
  }
  kill(p, why) {
    p.alive = false; p.elim = this.t; this.stat(p.id, 'falls');
    this.fx({ k: 'burn', n: p.n, x: p.x | 0, y: p.y | 0, why });
  }
  tick(dt) {
    this.lavaX += (75 + this.t * 2.2) * dt;
    if (this.t >= this.nextRock) {
      const al = this.alive().filter((p) => p.fin == null);
      if (al.length) {
        const t = al[Math.floor(this.rand() * al.length)];
        this.rocks.push({ x: t.x + 120 + this.rand() * 260, y: 90 + this.rand() * (H - 180), at: this.t + 1.1 });
      }
      this.nextRock = this.t + Math.max(0.35, 1.2 - this.t / 120);
    }
    for (const p of this.alive()) {
      if (p.fin != null) { p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx * dt; p.y += p.vy * dt; continue; }
      this.move(p, dt);
      this.collideRects(p, this.walls);
      if (p.x < p.r) p.x = p.r;
      if (p.x < this.lavaX + 10) { this.kill(p, 'lava'); continue; }
      if (p.jumpT <= this.t && this.pits.some((w) => inRect(p.x, p.y, w))) { this.kill(p, 'poço'); continue; }
      if (p.x > this.finishX) { p.fin = this.t; this.order++; this.room.bestTime(p.id, this.t); this.fx({ k: 'finish', n: p.n, place: this.order }); }
    }
    for (const r of this.rocks) {
      if (r.done || this.t < r.at) continue;
      r.done = true;
      this.fx({ k: 'rock', x: r.x | 0, y: r.y | 0 });
      for (const p of this.alive()) {
        if (p.fin == null && p.jumpT <= this.t && Math.hypot(p.x - r.x, p.y - r.y) < 55 + p.r) {
          p.stun = this.t + 1.1; p.vx = -260; this.stat(p.id, 'stunTime', 1.1);
        }
      }
    }
    this.rocks = this.rocks.filter((r) => !r.done || this.t - r.at < 0.4);
    this.separate((p) => p.alive && p.fin == null);
  }
  over() { return this.timeUp() || this.list().every((p) => !p.alive || p.fin != null); }
  ranking() { return rankGroups(this.list(), (p) => p.fin != null ? p.fin : p.alive ? 1e4 - p.x / 10 : 1e6 - p.elim); }
  init() { return { world: { w: this.ww, h: this.wh }, walls: this.walls, pits: this.pits, finishX: this.finishX }; }
  snap() { return { lava: Math.round(this.lavaX), rocks: this.rocks.map((r) => [r.x | 0, r.y | 0, this.t < r.at ? Math.round((r.at - this.t) * 100) : -1]) }; }
  hud() { return `Vivos: ${this.alive().length}/${this.ps.size} · ${this.order} escaparam`; }
}

// ======================= 3. CHEFÃO TITÃ =======================
class Boss extends Adventure {
  static MAX_TIME = 120;
  constructor(...a) {
    super(...a);
    this.bx = W / 2; this.by = H / 2; this.br = 66;
    this.maxHp = 10 + this.ps.size * 5; this.hp = this.maxHp;
    this.bullets = []; this.orbs = []; this.dmg = {}; this.hits = {};
    this.ang = 0; this.cd = { spiral: 1, ring: 3, aim: 4 };
    this.flash = 0;
    this.place((p, k, n) => { const a = (k / n) * Math.PI * 2; p.x = W / 2 + Math.cos(a) * 470; p.y = H / 2 + Math.sin(a) * 270; p.orb = false; });
    for (let k = 0; k < 4; k++) this.spawnOrb();
  }
  spawnOrb() {
    const a = this.rand() * Math.PI * 2, rr = 230 + this.rand() * 140;
    this.orbs.push({ x: clamp(W / 2 + Math.cos(a) * rr * 1.5, 60, W - 60), y: clamp(H / 2 + Math.sin(a) * rr, 60, H - 60) });
  }
  fire(a, sp) { this.bullets.push({ x: this.bx + Math.cos(a) * this.br, y: this.by + Math.sin(a) * this.br, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 640, 0.17, 1.2); }
  tick(dt) {
    const f = this.hp / this.maxHp, rage = f < 0.34 ? 1.6 : f < 0.67 ? 1.25 : 1;
    this.ang += dt * 1.4 * rage;
    if (this.t > 2) {
      if ((this.cd.spiral -= dt) <= 0) { this.fire(this.ang * 2.3, 210 * rage); this.fire(this.ang * 2.3 + Math.PI, 210 * rage); this.cd.spiral = 0.16 / rage; }
      if ((this.cd.ring -= dt) <= 0) { for (let k = 0; k < 16; k++) this.fire((k / 16) * Math.PI * 2 + this.ang, 170 * rage); this.cd.ring = 2.6 / rage; }
      if (f < 0.67 && (this.cd.aim -= dt) <= 0) {
        const al = this.list().filter((p) => p.alive);
        const t = al[Math.floor(this.rand() * al.length)];
        if (t) { const a = Math.atan2(t.y - this.by, t.x - this.bx); [-0.18, 0, 0.18].forEach((d) => this.fire(a + d, 330)); }
        this.cd.aim = 1.4 / rage;
      }
    }
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    this.bullets = this.bullets.filter((b) => b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20 && !b.dead);
    for (const p of this.list()) {
      this.move(p, dt);
      this.bounds(p, 20, 20, W - 20, H - 20);
      this.collideCircles(p, [[this.bx, this.by, this.br]]);
      if (p.inv <= this.t) {
        for (const b of this.bullets) {
          if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 6) {
            b.dead = true; p.stun = this.t + 0.9; p.inv = this.t + 1.7;
            this.hits[p.id] = (this.hits[p.id] || 0) + 1; this.stat(p.id, 'stunTime', 0.9);
            if (p.orb) { p.orb = false; this.orbs.push({ x: p.x, y: p.y }); }
            this.fx({ k: 'hurt', n: p.n, x: p.x | 0, y: p.y | 0 });
            break;
          }
        }
      }
      if (!p.orb) {
        const o = this.orbs.find((o) => Math.hypot(o.x - p.x, o.y - p.y) < p.r + 16);
        if (o) { this.orbs = this.orbs.filter((x) => x !== o); p.orb = true; this.fx({ k: 'item', n: p.n, item: 'orb' }); }
      } else if (Math.hypot(p.x - this.bx, p.y - this.by) < this.br + p.r + 8) {
        p.orb = false; this.hp = Math.max(0, this.hp - 1); this.flash = this.t + 0.15;
        this.dmg[p.id] = (this.dmg[p.id] || 0) + 1;
        this.fx({ k: 'bosshit', n: p.n, x: p.x | 0, y: p.y | 0 });
        this.spawnOrb();
        if (this.hp <= 0) { this.dmg[p.id] += 3; this.killer = p.n; this.fx({ k: 'bossdown', n: p.n, x: this.bx, y: this.by }); }
      }
    }
    this.separate();
    if (this.orbs.length + this.list().filter((p) => p.orb).length < 4) this.spawnOrb();
  }
  over() { return this.timeUp() || this.hp <= 0; }
  ranking() { return rankGroups(this.list(), (p) => -(this.dmg[p.id] || 0) * 100 + (this.hits[p.id] || 0)); }
  init() { return { bx: this.bx, by: this.by, br: this.br }; }
  snap() {
    return {
      b: this.bullets.map((b) => [b.x | 0, b.y | 0]), orbs: this.orbs.map((o) => [o.x | 0, o.y | 0]),
      carry: this.list().filter((p) => p.orb).map((p) => p.n), hp: this.hp, max: this.maxHp, ang: +this.ang.toFixed(2),
      fl: this.flash > this.t ? 1 : 0, sc: this.sc(this.dmg),
    };
  }
  hud() { return `Titã: ${this.hp}/${this.maxHp} HP`; }
}

// ======================= 4. MASMORRA =======================
class Dungeon extends Adventure {
  static MAX_TIME = 150;
  constructor(...a) {
    super(...a);
    const C = 10, Rw = 7, S = 200, T = 26; this.cell = S;
    this.ww = C * S; this.wh = Rw * S;
    // labirinto (backtracker) + alguns atalhos
    const east = Array.from({ length: Rw }, () => Array(C).fill(true));
    const south = Array.from({ length: Rw }, () => Array(C).fill(true));
    const seen = Array.from({ length: Rw }, () => Array(C).fill(false));
    const stack = [[Math.floor(Rw / 2), Math.floor(C / 2)]]; seen[stack[0][0]][stack[0][1]] = true;
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && x >= 0 && y < Rw && x < C && !seen[y][x]);
      if (!nb.length) { stack.pop(); continue; }
      const [y, x] = nb[Math.floor(this.rand() * nb.length)];
      if (y === r) east[r][Math.min(c, x)] = false; else south[Math.min(r, y)][c] = false;
      seen[y][x] = true; stack.push([y, x]);
    }
    for (let r = 0; r < Rw; r++) for (let c = 0; c < C; c++) { if (this.rand() < 0.18) east[r][c] = false; if (this.rand() < 0.18) south[r][c] = false; }
    this.walls = [[0, 0, this.ww, T], [0, this.wh - T, this.ww, T], [0, 0, T, this.wh], [this.ww - T, 0, T, this.wh]];
    for (let r = 0; r < Rw; r++) for (let c = 0; c < C; c++) {
      if (c < C - 1 && east[r][c]) this.walls.push([(c + 1) * S - T / 2, r * S - T / 2, T, S + T]);
      if (r < Rw - 1 && south[r][c]) this.walls.push([c * S - T / 2, (r + 1) * S - T / 2, S + T, T]);
    }
    const cc = (r, c) => ({ x: c * S + S / 2, y: r * S + S / 2 });
    const start = cc(Math.floor(Rw / 2), Math.floor(C / 2));
    const cells = [];
    for (let r = 0; r < Rw; r++) for (let c = 0; c < C; c++) cells.push({ r, c, d: Math.abs(r - Math.floor(Rw / 2)) + Math.abs(c - Math.floor(C / 2)) });
    const far = cells.filter((x) => x.d >= 5);
    const pick = (list) => list.splice(Math.floor(this.rand() * list.length), 1)[0];
    const pc = pick(far); this.portal = cc(pc.r, pc.c);
    this.keys = [];
    const keyCells = cells.filter((x) => x.d >= 2 && !(x.r === pc.r && x.c === pc.c));
    for (let k = 0; k < Math.max(1, this.ps.size - 1); k++) { const kc = pick(keyCells); this.keys.push(cc(kc.r, kc.c)); }
    this.keyCount = this.keys.length;
    this.mobs = [];
    for (let k = 0; k < 5 + this.ps.size; k++) { const mc = pick(cells.filter((x) => x.d >= 3)); if (mc) this.mobs.push({ ...cc(mc.r, mc.c), r: 16, vx: 0, vy: 0, wa: this.rand() * 6 }); }
    this.order = 0;
    this.place((p, k, n) => { const a = (k / n) * Math.PI * 2; p.x = start.x + Math.cos(a) * 40; p.y = start.y + Math.sin(a) * 40; p.key = false; });
  }
  action(id) { const p = this.ps.get(id); if (p && p.fin == null) this.dash(p, 650, 0.17, 1.3); }
  dropKey(p) { if (!p.key) return; p.key = false; this.keys.push({ x: p.x + (this.rand() - 0.5) * 60, y: p.y + (this.rand() - 0.5) * 60 }); }
  tick(dt) {
    for (const p of this.list()) {
      if (p.fin != null) continue;
      this.move(p, dt);
      this.collideRects(p, this.walls);
      if (!p.key) {
        const k = this.keys.find((k) => Math.hypot(k.x - p.x, k.y - p.y) < p.r + 18);
        if (k) { this.keys = this.keys.filter((x) => x !== k); p.key = true; this.fx({ k: 'key', n: p.n }); }
      } else if (Math.hypot(this.portal.x - p.x, this.portal.y - p.y) < 46) {
        p.key = false; p.fin = this.t; this.order++;
        this.fx({ k: 'finish', n: p.n, place: this.order });
      }
    }
    for (const [a, b] of this.separate((p) => p.fin == null)) {
      for (const [atk, vic] of [[a, b], [b, a]]) {
        if (atk.dashT > this.t && vic.key && !atk.key && vic.inv <= this.t) {
          vic.key = false; atk.key = true; vic.stun = this.t + 0.5; vic.inv = this.t + 1; atk.dashT = 0;
          this.stat(atk.id, 'sabot'); this.fx({ k: 'steal', n: atk.n, x: vic.x | 0, y: vic.y | 0 });
        }
      }
    }
    for (const m of this.mobs) {
      let tgt = null, best = 330;
      for (const p of this.list()) { if (p.fin != null) continue; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < best) { best = d; tgt = p; } }
      let dx, dy;
      if (tgt) { dx = tgt.x - m.x; dy = tgt.y - m.y; } else { m.wa += (this.rand() - 0.5) * 2 * dt; dx = Math.cos(m.wa); dy = Math.sin(m.wa); }
      const l = Math.hypot(dx, dy) || 1, sp = tgt ? 150 : 70;
      m.vx += (dx / l * sp - m.vx) * Math.min(1, 3 * dt); m.vy += (dy / l * sp - m.vy) * Math.min(1, 3 * dt);
      m.x += m.vx * dt; m.y += m.vy * dt;
      this.collideRects(m, this.walls);
      for (const p of this.list()) {
        if (p.fin != null || p.inv > this.t || Math.hypot(p.x - m.x, p.y - m.y) > p.r + m.r) continue;
        p.stun = this.t + 1.1; p.inv = this.t + 2; this.stat(p.id, 'stunTime', 1.1);
        this.dropKey(p);
        this.fx({ k: 'mob', n: p.n, x: p.x | 0, y: p.y | 0 });
      }
    }
  }
  over() { return this.timeUp() || this.order >= this.keyCount || this.list().every((p) => p.fin != null); }
  ranking() {
    const dist = (p) => Math.hypot(p.x - this.portal.x, p.y - this.portal.y);
    return rankGroups(this.list(), (p) => p.fin != null ? p.fin : p.key ? 1e4 + dist(p) / 10 : 1e5 + dist(p) / 10);
  }
  init() { return { world: { w: this.ww, h: this.wh }, walls: this.walls, portal: this.portal, dark: true }; }
  snap() {
    return { keys: this.keys.map((k) => [k.x | 0, k.y | 0]), kh: this.list().filter((p) => p.key).map((p) => p.n), mobs: this.mobs.map((m) => [m.x | 0, m.y | 0]), out: this.list().filter((p) => p.fin != null).map((p) => p.n) };
  }
  hud() { return `Escaparam: ${this.order}/${this.keyCount} · ${this.keyCount} chave${this.keyCount > 1 ? 's' : ''}`; }
}

// ======================= 5. COROA DO REI =======================
class Crown extends Adventure {
  static MAX_TIME = 90;
  constructor(...a) {
    super(...a);
    this.pillars = [[300, 210, 50], [980, 210, 50], [300, 510, 50], [980, 510, 50]];
    this.holder = null; this.cx = W / 2; this.cy = H / 2 + 120; this.lock = 0; this.held = {};
    this.arms = [{ x: W / 2, y: H / 2, L: 250, w: 0.9 }];
    this.place((p, k, n) => { const a = (k / n) * Math.PI * 2; p.x = W / 2 + Math.cos(a) * 420; p.y = H / 2 + Math.sin(a) * 270; });
  }
  armSegs() {
    if (this.t < 8) return [];
    return this.arms.map((a) => { const g = this.t * a.w * (this.t > 45 ? 1.5 : 1); return [a.x - Math.cos(g) * a.L, a.y - Math.sin(g) * a.L, a.x + Math.cos(g) * a.L, a.y + Math.sin(g) * a.L]; });
  }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 700, 0.18, 1.2); }
  tick(dt) {
    for (const p of this.list()) {
      this.move(p, dt, p.id === this.holder ? 0.9 : 1);
      this.bounds(p, 30, 30, W - 30, H - 30);
      this.collideCircles(p, this.pillars);
    }
    const segs = this.armSegs();
    for (const p of this.list()) {
      if (p.inv > this.t || !segs.some((s) => segDist(p.x, p.y, ...s) < p.r + 4)) continue;
      p.stun = this.t + 1; p.inv = this.t + 1.8; this.stat(p.id, 'laserHits');
      if (this.holder === p.id) { this.holder = null; this.cx = clamp(p.x + 80, 60, W - 60); this.cy = clamp(p.y, 60, H - 60); this.lock = this.t + 0.6; }
      this.fx({ k: 'zap', n: p.n, x: p.x | 0, y: p.y | 0 });
    }
    for (const [a, b] of this.separate()) {
      for (const [atk, vic] of [[a, b], [b, a]]) {
        if (atk.dashT > this.t && this.holder === vic.id && this.lock <= this.t) {
          this.holder = atk.id; this.lock = this.t + 1; vic.stun = this.t + 0.5; atk.dashT = 0;
          this.stat(atk.id, 'sabot'); this.fx({ k: 'steal', n: atk.n, x: vic.x | 0, y: vic.y | 0 });
        }
      }
    }
    if (!this.holder && this.lock <= this.t) {
      const p = this.list().find((p) => p.stun <= this.t && Math.hypot(p.x - this.cx, p.y - this.cy) < p.r + 20);
      if (p) { this.holder = p.id; this.fx({ k: 'crown', n: p.n }); }
    }
    if (this.holder) { this.held[this.holder] = (this.held[this.holder] || 0) + dt; const h = this.ps.get(this.holder); this.cx = h.x; this.cy = h.y; }
  }
  over() { return this.timeUp(); }
  ranking() { return rankGroups(this.list(), (p) => -Math.floor((this.held[p.id] || 0) * 10)); }
  init() { return { pillars: this.pillars, arms: this.arms }; }
  snap() { return { crown: [this.holder ? this.ps.get(this.holder).n : -1, this.cx | 0, this.cy | 0], sc: this.sc(this.held), armOn: this.t >= 8 ? 1 : 0, armK: this.t > 45 ? 1.5 : 1 }; }
  hud() { return 'Segure a coroa! ESPAÇO rouba'; }
}

// ======================= 6. GUERRA DE NAVES =======================
class Ships extends Adventure {
  static MAX_TIME = 100;
  constructor(...a) {
    super(...a);
    this.shots = []; this.rocks = []; this.pts = {};
    for (let k = 0; k < 6; k++) this.addRock(46);
    this.place((p, k, n) => { const a = (k / n) * Math.PI * 2; p.x = W / 2 + Math.cos(a) * 380; p.y = H / 2 + Math.sin(a) * 240; p.ang = a + Math.PI; p.cd = 0; p.respawn = 0; });
  }
  get accel() { return this.has('gelo') ? 1.2 : 3.2; }
  addRock(r, x, y) {
    if (x == null) { const side = this.rand() < 0.5; x = side ? (this.rand() < 0.5 ? 0 : W) : this.rand() * W; y = side ? this.rand() * H : (this.rand() < 0.5 ? 0 : H); }
    const a = this.rand() * 6.28, s = 40 + this.rand() * 60 * (46 / r);
    this.rocks.push({ x, y, r, vx: Math.cos(a) * s, vy: Math.sin(a) * s });
  }
  wrap(o) { if (o.x < 0) o.x += W; if (o.x > W) o.x -= W; if (o.y < 0) o.y += H; if (o.y > H) o.y -= H; }
  action(id) {
    const p = this.ps.get(id);
    if (!p || !p.alive || p.cd > this.t || p.stun > this.t) return;
    p.cd = this.t + 0.28;
    const c = Math.cos(p.ang), s = Math.sin(p.ang);
    this.shots.push({ x: p.x + c * (p.r + 6), y: p.y + s * (p.r + 6), vx: c * 720 + p.vx * 0.4, vy: s * 720 + p.vy * 0.4, life: 1.0, by: p.id, n: p.n });
    this.fx({ k: 'shot', n: p.n });
  }
  boom(p, by) {
    p.alive = false; p.respawn = this.t + 1.6;
    this.stat(p.id, 'falls');
    if (by) { this.pts[by] = (this.pts[by] || 0) + 3; this.stat(by, 'kos'); this.stat(by, 'sabot'); }
    this.fx({ k: 'shipboom', n: p.n, by: by ? this.ps.get(by).n : null, x: p.x | 0, y: p.y | 0 });
  }
  tick(dt) {
    for (const p of this.list()) {
      if (!p.alive) {
        if (this.t >= p.respawn) { const q = this.freePoint(80, 80, W - 80, H - 80, 60, this.rocks.map((r) => [r.x - r.r - 60, r.y - r.r - 60, r.r * 2 + 120, r.r * 2 + 120])); p.x = q.x; p.y = q.y; p.vx = p.vy = 0; p.alive = true; p.inv = this.t + 1.6; }
        continue;
      }
      const d = this.dir(p);
      if (d.x || d.y) p.ang = Math.atan2(d.y, d.x);
      this.move(p, dt, 1.35);
      this.wrap(p);
    }
    for (const r of this.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; this.wrap(r); }
    for (const s of this.shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; this.wrap(s); }
    for (const s of this.shots) {
      if (s.life <= 0) continue;
      const rock = this.rocks.find((r) => Math.hypot(r.x - s.x, r.y - s.y) < r.r);
      if (rock) {
        s.life = 0; this.rocks = this.rocks.filter((x) => x !== rock);
        this.pts[s.by] = (this.pts[s.by] || 0) + 1;
        if (rock.r > 20) { this.addRock(rock.r * 0.62, rock.x, rock.y); this.addRock(rock.r * 0.62, rock.x, rock.y); }
        this.fx({ k: 'rockhit', x: rock.x | 0, y: rock.y | 0, r: rock.r | 0, n: s.n });
        continue;
      }
      const hit = this.list().find((p) => p.alive && p.id !== s.by && p.inv <= this.t && Math.hypot(p.x - s.x, p.y - s.y) < p.r + 4);
      if (hit) { s.life = 0; this.boom(hit, s.by); }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const p of this.list()) {
      if (!p.alive || p.inv > this.t) continue;
      if (this.rocks.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < r.r + p.r * 0.8)) this.boom(p, null);
    }
    if (this.rocks.length < 4) this.addRock(46);
    this.separate();
  }
  snapPlayers() { return this.list().map((p) => [p.n, Math.round(p.x), Math.round(p.y), Math.round(p.r), this.flags(p), +p.ang.toFixed(2)]); }
  over() { return this.timeUp(); }
  ranking() { return rankGroups(this.list(), (p) => -(this.pts[p.id] || 0)); }
  init() { return { wrap: true }; }
  snap() { return { shots: this.shots.map((s) => [s.x | 0, s.y | 0, s.n]), rocks: this.rocks.map((r) => [r.x | 0, r.y | 0, r.r | 0]), sc: this.sc(this.pts) }; }
  hud() { return 'Asteroide +1 · Nave +3'; }
}

// ======================= 7. TRAVESSIA NEON =======================
class Crossing extends Adventure {
  static MAX_TIME = 100;
  constructor(...a) {
    super(...a);
    const R = this.rand;
    const sp = (lo, hi) => (lo + R() * (hi - lo)) * (R() < 0.5 ? -1 : 1);
    this.lanes = [
      { y: 610, kind: 'car', speed: sp(150, 230), len: 90, gap: 230, off: R() * 300 },
      { y: 550, kind: 'car', speed: sp(220, 320), len: 70, gap: 280, off: R() * 300 },
      { y: 490, kind: 'car', speed: sp(120, 180), len: 160, gap: 260, off: R() * 300 },
      { y: 430, kind: 'car', speed: sp(260, 360), len: 70, gap: 320, off: R() * 300 },
      { y: 300, kind: 'log', speed: sp(80, 130), len: 220, gap: 150, off: R() * 300 },
      { y: 240, kind: 'log', speed: sp(110, 170), len: 170, gap: 170, off: R() * 300 },
      { y: 180, kind: 'log', speed: sp(70, 120), len: 260, gap: 160, off: R() * 300 },
      { y: 120, kind: 'log', speed: sp(130, 190), len: 150, gap: 170, off: R() * 300 },
    ];
    this.cross = {};
    this.place((p, k, n) => { p.x = 160 + (k + 0.5) * ((W - 320) / n); p.y = 680; p.best = 680; });
  }
  objs(l) {
    const sp = l.len + l.gap, out = [], cnt = Math.ceil((W + sp) / sp) + 1;
    const base = ((l.off + l.speed * this.t) % sp + sp) % sp;
    for (let k = -1; k < cnt; k++) out.push(base + k * sp - sp);
    return out;
  }
  reset(p, why) {
    p.y = 685; p.vx = p.vy = 0; p.stun = this.t + 0.6; p.inv = this.t + 1.2; p.best = 685;
    this.stat(p.id, 'falls');
    this.fx({ k: why, n: p.n, x: p.x | 0, y: p.y | 0 });
  }
  tick(dt) {
    for (const p of this.list()) {
      this.move(p, dt);
      this.bounds(p, 0, 20, W, H);
      p.best = Math.min(p.best, p.y);
      if (p.inv > this.t) continue;
      for (const l of this.lanes) {
        if (Math.abs(p.y - l.y) > 28) continue;
        const xs = this.objs(l);
        if (l.kind === 'car') {
          if (xs.some((x) => p.x + p.r * 0.7 > x && p.x - p.r * 0.7 < x + l.len)) { this.reset(p, 'carhit'); break; }
        } else {
          const on = xs.some((x) => p.x > x + 4 && p.x < x + l.len - 4);
          if (!on) { this.reset(p, 'splash'); break; }
          p.x += l.speed * dt;
          if (p.x < 0 || p.x > W) { this.reset(p, 'splash'); break; }
        }
      }
      if (p.y < 70) {
        this.cross[p.id] = (this.cross[p.id] || 0) + 1;
        this.fx({ k: 'cross', n: p.n, x: p.x | 0, y: p.y | 0 });
        p.y = 685; p.best = 685; p.inv = this.t + 0.8;
      }
    }
  }
  over() { return this.timeUp(); }
  ranking() { return rankGroups(this.list(), (p) => -(this.cross[p.id] || 0) * 1000 + p.best / 10); }
  init() { return { lanes: this.lanes }; }
  snap() { return { sc: this.sc(this.cross) }; }
  hud() { return 'Chegue ao topo quantas vezes puder'; }
}

// ======================= 8. VÍRUS =======================
class Virus extends Adventure {
  static MAX_TIME = 90;
  constructor(...a) {
    super(...a);
    this.pillars = [[260, 180, 40], [640, 140, 40], [1020, 180, 40], [260, 540, 40], [640, 580, 40], [1020, 540, 40], [640, 360, 55]];
    this.inf = new Set(); this.surv = {}; this.conv = {};
    this.place((p, k, n) => { const a = (k / n) * Math.PI * 2; p.x = W / 2 + Math.cos(a) * 440; p.y = H / 2 + Math.sin(a) * 260; });
    const ids = this.list().map((p) => p.id).sort(() => this.rand() - 0.5);
    ids.slice(0, this.ps.size >= 5 ? 2 : 1).forEach((id) => this.inf.add(id));
  }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 650, 0.18, 1.4); }
  score(id) { return Math.floor(this.surv[id] || 0) + 8 * (this.conv[id] || 0); }
  tick(dt) {
    for (const p of this.list()) {
      const infd = this.inf.has(p.id);
      this.move(p, dt, infd ? (this.t < 3 ? 0 : 1.1) : 1);
      this.bounds(p, 30, 30, W - 30, H - 30);
      this.collideCircles(p, this.pillars);
      if (!infd) this.surv[p.id] = (this.surv[p.id] || 0) + dt;
    }
    for (const [a, b] of this.separate()) {
      const ia = this.inf.has(a.id), ib = this.inf.has(b.id);
      if (ia === ib) continue;
      const src = ia ? a : b, vic = ia ? b : a;
      if (vic.inv > this.t) continue;
      this.inf.add(vic.id); vic.inv = this.t + 1; vic.stun = this.t + 0.8;
      this.conv[src.id] = (this.conv[src.id] || 0) + 1; this.stat(src.id, 'sabot');
      this.fx({ k: 'infect', n: vic.n, by: src.n, x: vic.x | 0, y: vic.y | 0 });
    }
  }
  over() { return this.timeUp() || this.inf.size >= this.ps.size; }
  ranking() { return rankGroups(this.list(), (p) => -this.score(p.id)); }
  init() { return { pillars: this.pillars }; }
  snap() { const m = {}; this.list().forEach((p) => { m[p.id] = this.score(p.id); }); return { inf: [...this.inf].map((id) => this.ps.get(id).n), sc: this.sc(m) }; }
  hud() { return `Infectados: ${this.inf.size}/${this.ps.size}`; }
}

// ======================= 9. CORRIDA DO OURO =======================
class GoldRush extends Adventure {
  static MAX_TIME = 100;
  constructor(...a) {
    super(...a);
    const spots = [[110, 110], [W - 110, H - 110], [W - 110, 110], [110, H - 110], [W / 2 - 260, 95], [W / 2 + 260, H - 95]];
    this.bases = {}; this.bank = {}; this.carry = {};
    this.nuggets = []; this.nextN = 0; this.nextBig = 15;
    this.place((p, k) => { const [x, y] = spots[k]; this.bases[p.id] = [x, y]; p.x = x; p.y = y; this.carry[p.id] = 0; });
    for (let k = 0; k < 8; k++) this.addNugget(false);
  }
  addNugget(big, x, y) {
    if (x == null) { const a = this.rand() * 6.28, r = Math.sqrt(this.rand()) * 210; x = W / 2 + Math.cos(a) * r * 1.4; y = H / 2 + Math.sin(a) * r; }
    this.nuggets.push({ x: clamp(x, 40, W - 40), y: clamp(y, 40, H - 40), big });
  }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 700, 0.18, 1.3); }
  tick(dt) {
    if (this.t >= this.nextN && this.nuggets.length < 16) { this.addNugget(false); this.nextN = this.t + 0.55; }
    if (this.t >= this.nextBig) { this.addNugget(true, W / 2, H / 2); this.nextBig = this.t + 18; this.fx({ k: 'bignugget' }); }
    for (const p of this.list()) {
      this.move(p, dt, 1 - 0.07 * this.carry[p.id]);
      this.bounds(p, 20, 20, W - 20, H - 20);
      this.nuggets = this.nuggets.filter((g) => {
        const v = g.big ? 3 : 1;
        if (this.carry[p.id] + v > 6 || Math.hypot(g.x - p.x, g.y - p.y) > p.r + 14) return true;
        this.carry[p.id] += v; this.fx({ k: 'coin', n: p.n }); return false;
      });
      const [bx, by] = this.bases[p.id];
      if (this.carry[p.id] && Math.hypot(p.x - bx, p.y - by) < 62) {
        this.bank[p.id] = (this.bank[p.id] || 0) + this.carry[p.id];
        this.fx({ k: 'bank', n: p.n, v: this.carry[p.id], x: bx, y: by });
        this.carry[p.id] = 0;
      }
    }
    for (const [a, b] of this.separate()) {
      for (const [atk, vic] of [[a, b], [b, a]]) {
        if (atk.dashT <= this.t || vic.inv > this.t || !this.carry[vic.id]) continue;
        const n = Math.ceil(this.carry[vic.id] / 2);
        this.carry[vic.id] -= n; vic.stun = this.t + 0.5; vic.inv = this.t + 1; atk.dashT = 0;
        for (let k = 0; k < n; k++) { const ang = this.rand() * 6.28; this.addNugget(false, vic.x + Math.cos(ang) * 60, vic.y + Math.sin(ang) * 60); }
        this.stat(atk.id, 'sabot'); this.fx({ k: 'steal', n: atk.n, x: vic.x | 0, y: vic.y | 0 });
      }
    }
  }
  over() { return this.timeUp(); }
  ranking() { return rankGroups(this.list(), (p) => -(this.bank[p.id] || 0)); }
  init() { const b = {}; this.list().forEach((p) => { b[p.n] = this.bases[p.id]; }); return { bases: b }; }
  snap() { return { g: this.nuggets.map((g) => [g.x | 0, g.y | 0, g.big ? 1 : 0]), carry: this.list().map((p) => [p.n, this.carry[p.id]]), sc: this.sc(this.bank) }; }
  hud() { return 'Leve o ouro para a SUA base'; }
}

// ======================= 10. TERRITÓRIO =======================
class Territory extends Adventure {
  static MAX_TIME = 80;
  constructor(...a) {
    super(...a);
    this.cols = 32; this.rows = 18; this.cs = 40;
    this.grid = new Array(this.cols * this.rows).fill(-1);
    this.ups = []; this.nextUp = 4;
    this.place((p, k, n) => { const a = (k / n) * Math.PI * 2; p.x = W / 2 + Math.cos(a) * 430; p.y = H / 2 + Math.sin(a) * 250; p.fast = 0; });
  }
  paint(cx, cy, n) { if (cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows) this.grid[cy * this.cols + cx] = n; }
  action(id) { const p = this.ps.get(id); if (p) this.dash(p, 720, 0.18, 1.1); }
  tick(dt) {
    if (this.t >= this.nextUp && this.ups.length < 3) {
      this.ups.push({ x: 80 + this.rand() * (W - 160), y: 80 + this.rand() * (H - 160), kind: this.rand() < 0.6 ? 'bomba' : 'turbo' });
      this.nextUp = this.t + 5;
    }
    for (const p of this.list()) {
      this.move(p, dt, p.fast > this.t ? 1.5 : 1);
      this.bounds(p, 0, 0, W, H);
      const cx = Math.floor(p.x / this.cs), cy = Math.floor(p.y / this.cs);
      this.paint(cx, cy, p.n);
      if (p.dashT > this.t) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.paint(cx + dx, cy + dy, p.n);
      const u = this.ups.find((u) => Math.hypot(u.x - p.x, u.y - p.y) < p.r + 18);
      if (u) {
        this.ups = this.ups.filter((x) => x !== u);
        if (u.kind === 'bomba') {
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) this.paint(cx + dx, cy + dy, p.n);
          this.stat(p.id, 'sabot');
          this.fx({ k: 'paintbomb', n: p.n, x: p.x | 0, y: p.y | 0 });
        } else { p.fast = this.t + 3.5; this.fx({ k: 'turbo', n: p.n }); }
      }
    }
    this.separate();
  }
  counts() { const c = {}; this.grid.forEach((v) => { if (v >= 0) c[v] = (c[v] || 0) + 1; }); return c; }
  over() { return this.timeUp(); }
  ranking() { const c = this.counts(); return rankGroups(this.list(), (p) => -(c[p.n] || 0)); }
  init() { return { cols: this.cols, rows: this.rows, cs: this.cs }; }
  snap() {
    const c = this.counts();
    return { grid: this.grid.map((v) => (v < 0 ? '.' : String(v))).join(''), ups: this.ups.map((u) => [u.x | 0, u.y | 0, u.kind === 'bomba' ? 1 : 0]), sc: this.list().map((p) => [p.n, c[p.n] || 0]) };
  }
  hud() { return 'Pinte o máximo de chão'; }
}

module.exports = {
  GAME_CLASSES2: { treasure: Treasure, lava: LavaEscape, boss: Boss, dungeon: Dungeon, crown: Crown, ships: Ships, crossing: Crossing, virus: Virus, gold: GoldRush, territory: Territory },
};
