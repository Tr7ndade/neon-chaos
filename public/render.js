/* global NC, AV */
// Motor gráfico 2.5D: plataformas com espessura, objetos com altura, personagens com corpo,
// brilho neon (bloom), câmera, partículas e o desenho dos 16 modos.
const R = (() => {
  const { W, H } = NC;
  const PADS = ['#b84dff', '#22e4ff', '#ff2e55', '#c8ff3d'];
  const { drawAvatar, avatarCanvas, rr } = AV;
  let cv, ctx, scale = 1, ox = 0, oy = 0, dpr = 1;
  let glowCv, glowCtx, vignette, fog;
  const parts = [], texts = [], rings = [], ghosts = [];
  let shakeA = 0, punch = 0, flashA = 0;
  const local = { padFlash: [0, 0, 0, 0] };
  const Q = { hi: true, auto: true, fps: 60 };
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * 2000, y: Math.random() * 1200, z: 0.15 + Math.random() * 0.5, s: Math.random() * 1.6 + 0.4 }));
  const prevFlags = {};
  const hitFlash = {};

  function setup(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); addEventListener('resize', resize); }
  function resize() {
    if (!cv) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr);
    scale = Math.min(w / W, h / H); ox = (w - W * scale) / 2; oy = (h - H * scale) / 2;
    glowCv = document.createElement('canvas'); glowCv.width = Math.max(1, cv.width / 4); glowCv.height = Math.max(1, cv.height / 4);
    glowCtx = glowCv.getContext('2d');
    vignette = null;
  }
  const toWorld = (cx, cy) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale });

  // ---------- utilidades ----------
  function glow(c, color, b) { if (Q.hi) { c.shadowColor = color; c.shadowBlur = b; } else c.shadowBlur = 0; }
  function noGlow(c) { c.shadowBlur = 0; }
  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function line(c, x1, y1, x2, y2, color, w, blur = 16) {
    c.save(); c.lineCap = 'round'; glow(c, color, blur); c.strokeStyle = color; c.lineWidth = w;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    noGlow(c); c.strokeStyle = '#fff'; c.lineWidth = w * 0.35; c.stroke(); c.restore();
  }
  // feixe de laser elevado (altura hgt) com reflexo no chão
  function beam(c, x1, y1, x2, y2, color, hgt = 22) {
    c.save(); c.globalAlpha = 0.35; c.strokeStyle = color; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
    line(c, x1, y1 - hgt, x2, y2 - hgt, color, 5, 20);
  }
  // bloco com altura: face de cima deslocada para cima e face frontal (sul)
  function block(c, x, y, w, h, hgt, top, side, edge, rad = 6) {
    c.save();
    const g = c.createLinearGradient(0, y + h - hgt, 0, y + h);
    g.addColorStop(0, side); g.addColorStop(1, shadeHex(side, -0.5));
    c.fillStyle = g; rr(c, x, y + h - hgt - rad, w, hgt + rad, rad); c.fill();
    c.fillStyle = top; glow(c, edge, 12); c.strokeStyle = edge; c.lineWidth = 2;
    rr(c, x, y - hgt, w, h, rad); c.fill(); c.stroke();
    noGlow(c); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + rad, y - hgt + 2); c.lineTo(x + w - rad, y - hgt + 2); c.stroke();
    c.restore();
  }
  function cylinder(c, cx, cy, r, hgt, top, side, edge) {
    c.save();
    const g = c.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, shadeHex(side, -0.45)); g.addColorStop(0.4, side); g.addColorStop(1, shadeHex(side, -0.6));
    c.fillStyle = g;
    c.beginPath(); c.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI); c.lineTo(cx - r, cy - hgt); c.ellipse(cx, cy - hgt, r, r * 0.55, 0, Math.PI, 0, true); c.closePath(); c.fill();
    c.fillStyle = top; glow(c, edge, 16); c.strokeStyle = edge; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(cx, cy - hgt, r, r * 0.55, 0, 0, 7); c.fill(); c.stroke();
    c.restore();
  }
  // plataforma flutuante (espessura aparece embaixo)
  function slab(c, x, y, w, h, thick, top, side, edge, rad = 10) {
    c.save();
    c.fillStyle = shadeHex(side, -0.3); rr(c, x, y + thick * 0.3, w, h + thick * 0.7, rad); c.fill();
    const g = c.createLinearGradient(0, y + h - rad, 0, y + h + thick);
    g.addColorStop(0, side); g.addColorStop(1, shadeHex(side, -0.7));
    c.fillStyle = g; rr(c, x, y + h - rad, w, thick + rad, rad); c.fill();
    c.fillStyle = top; rr(c, x, y, w, h, rad); c.fill();
    if (edge) { glow(c, edge, 14); c.strokeStyle = edge; c.lineWidth = 2; c.stroke(); }
    c.restore();
  }
  function disc(c, cx, cy, r, thick, top, side, edge) {
    c.save();
    const g = c.createLinearGradient(0, cy, 0, cy + thick + r * 0.1);
    g.addColorStop(0, side); g.addColorStop(1, shadeHex(side, -0.75));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI); c.lineTo(cx - r, cy + thick); c.arc(cx, cy + thick, r, Math.PI, 0, true); c.closePath(); c.fill();
    c.fillStyle = top; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    if (edge) { glow(c, edge, 26); c.strokeStyle = edge; c.lineWidth = 4; c.stroke(); }
    c.restore();
  }
  function checker(c, x, y, w, h, s) {
    for (let i = 0; i * s < h; i++) for (let j = 0; j * s < w; j++) { c.fillStyle = (i + j) % 2 ? '#e9e4ff' : '#14102a'; c.fillRect(x + j * s, y + i * s, s, s); }
  }
  function floorGrid(c, x, y, w, h, color, step = 40) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = color; c.lineWidth = 1;
    for (let gx = x - (x % step); gx <= x + w; gx += step) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
    for (let gy = y - (y % step); gy <= y + h; gy += step) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
    c.restore();
  }

  // ---------- efeitos ----------
  function burst(x, y, color, n = 18, sp = 260, size = 4, life = 0.7, up = 0) {
    if (!Q.hi) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life, max: life, color, size: size * (0.5 + Math.random()), g: up ? 500 : 0 });
    }
  }
  function ring(x, y, color, max = 120) { rings.push({ x, y, color, r: 4, max, life: 0.5, maxLife: 0.5 }); }
  function text(x, y, str, color = '#fff', size = 26) { texts.push({ x, y, str, color, size, life: 1.2 }); }
  function shake(a) { shakeA = Math.max(shakeA, a); }
  function kick(a = 0.04) { punch = Math.max(punch, a); }
  function flash(a = 0.5) { flashA = Math.max(flashA, a); }
  function fall(x, y, color, avatar, r = 18, kind = 'fall') { ghosts.push({ x, y, color, avatar, r, t: 0, kind }); }

  // ---------- personagem com corpo ----------
  function drawChar(c, p, gt, deco = {}) {
    const f = p.f, stun = f & 2, jump = f & 4, dash = f & 8, fin = f & 16, inv = f & 64;
    const r = p.r, sp = Math.hypot(p.vx, p.vy), moving = sp > 40;
    const lift = jump ? r * 1.1 : 0;
    let alpha = 1;
    if (inv && Math.floor(gt * 12) % 2) alpha = 0.4;
    if (fin) alpha = 0.5;
    const ph = moving ? gt * 16 : 0;
    const bob = moving ? Math.abs(Math.sin(ph)) * r * 0.12 : Math.sin(gt * 3 + p.n) * r * 0.04;
    c.save(); c.globalAlpha = alpha;
    // sombra
    c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(p.x, p.y + r * 0.1, r * (jump ? 0.6 : 0.95), r * (jump ? 0.22 : 0.36), 0, 0, 7); c.fill();
    if (deco.aura) { c.save(); glow(c, deco.aura, 26); c.strokeStyle = deco.aura; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y + r * 0.1, r * 1.15 + Math.sin(gt * 10) * 2, r * 0.48, 0, 0, 7); c.stroke(); c.restore(); }
    if (dash) {
      c.save(); c.globalAlpha = 0.3 * alpha; c.fillStyle = p.color;
      for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(p.x - p.vx * 0.014 * k, p.y - r * 1.2 - lift - p.vy * 0.014 * k, r * (1 - k * 0.2), 0, 7); c.fill(); }
      c.restore();
    }
    const y0 = p.y - lift;
    // pés
    const dark = shadeHex(p.color, -0.55);
    c.fillStyle = dark;
    [-1, 1].forEach((s, i) => { const o = moving ? Math.sin(ph + i * Math.PI) * r * 0.22 : 0; c.beginPath(); c.ellipse(p.x + s * r * 0.36 + o * 0.3, y0 - Math.max(0, o) * 0.5, r * 0.3, r * 0.2, 0, 0, 7); c.fill(); });
    // corpo
    const bw = r * 1.15, bh = r * 0.95, by = y0 - bh - r * 0.08 - bob;
    const bg = c.createLinearGradient(p.x - bw / 2, 0, p.x + bw / 2, 0);
    bg.addColorStop(0, '#1b1036'); bg.addColorStop(0.5, '#2a1a52'); bg.addColorStop(1, '#120a24');
    c.fillStyle = bg; glow(c, p.color, 10); c.strokeStyle = p.color; c.lineWidth = Math.max(1.5, r * 0.1);
    rr(c, p.x - bw / 2, by, bw, bh, r * 0.42); c.fill(); c.stroke(); noGlow(c);
    c.fillStyle = p.color; c.globalAlpha = alpha * 0.8; c.fillRect(p.x - r * 0.08, by + bh * 0.3, r * 0.16, bh * 0.4); c.globalAlpha = alpha;
    // braços
    c.strokeStyle = p.color; c.lineWidth = Math.max(2, r * 0.16); c.lineCap = 'round';
    [-1, 1].forEach((s, i) => { const sw = moving ? Math.sin(ph + i * Math.PI) * r * 0.3 : 0; c.beginPath(); c.moveTo(p.x + s * bw * 0.45, by + bh * 0.3); c.lineTo(p.x + s * bw * 0.68, by + bh * 0.7 + sw * 0.3); c.stroke(); });
    // cabeça
    const look = moving ? { x: p.vx / sp, y: p.vy / sp } : { x: 0, y: 0.2 };
    const hy = by - r * 0.62;
    drawAvatar(c, p.avatar, deco.tint || p.color, p.x, hy, r * 0.9, look, 1);
    if (hitFlash[p.n] > 0) { c.globalAlpha = hitFlash[p.n]; c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x, hy, r * 0.95, 0, 7); c.fill(); c.globalAlpha = alpha; }
    if (stun) {
      c.fillStyle = '#ffd23f'; c.font = `${Math.max(10, r * 0.6)}px sans-serif`; c.textAlign = 'center';
      for (let k = 0; k < 3; k++) { const a = gt * 6 + k * 2.1; c.fillText('✦', p.x + Math.cos(a) * r * 0.9, hy - r * 1.05 + Math.sin(a) * r * 0.3); }
    }
    c.restore();
    // decorações acima da cabeça
    let topY = hy - r * (p.avatar === 2 || p.avatar === 3 || p.avatar === 6 || p.avatar === 7 ? 1.7 : 1.2);
    if (deco.crown) { drawCrown(c, p.x, topY - 4 + Math.sin(gt * 5) * 2, 1); topY -= 26; }
    if (deco.bomb) { drawBomb(c, p.x + r * 0.6, topY - 6, deco.heat, gt); topY -= 22; }
    if (deco.key) { drawKey(c, p.x, topY - 8 + Math.sin(gt * 6) * 2, 0.9); topY -= 20; }
    if (deco.orb) { drawOrb(c, p.x, topY - 8, gt, 9); topY -= 20; }
    if (deco.carry) { for (let k = 0; k < deco.carry; k++) drawNugget(c, p.x - 10 + (k % 3) * 10, topY - 6 - Math.floor(k / 3) * 9, false, gt, 0.7); topY -= 10 + Math.ceil(deco.carry / 3) * 9; }
    // nome
    c.save();
    c.font = `700 ${p.me ? 14 : 12}px "Chakra Petch", sans-serif`; c.textAlign = 'center';
    const ty = topY - 6;
    const tw = c.measureText(p.name).width + 10;
    c.fillStyle = 'rgba(5,3,11,.7)'; rr(c, p.x - tw / 2, ty - 13, tw, 17, 5); c.fill();
    c.fillStyle = p.me ? '#fff' : p.color; c.fillText(p.name, p.x, ty);
    if (p.me) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(p.x - 6, ty - 22); c.lineTo(p.x + 6, ty - 22); c.lineTo(p.x, ty - 15); c.fill(); }
    c.restore();
  }

  // ---------- itens ----------
  function drawBomb(c, x, y, heat, gt) {
    const blink = Math.sin(gt * (6 + heat * 0.25)) > 0;
    c.save(); glow(c, '#ff2e55', blink ? 30 : 6);
    c.fillStyle = blink ? '#3a0410' : '#14040a'; c.strokeStyle = '#ff2e55'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 6, y - 9); c.quadraticCurveTo(x + 13, y - 19, x + 18, y - 15); c.stroke();
    c.fillStyle = Math.random() < 0.5 ? '#fff' : '#ffd23f'; c.beginPath(); c.arc(x + 18, y - 15, 3 + Math.random() * 2, 0, 7); c.fill();
    c.restore();
  }
  function drawCrown(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s); glow(c, '#ffd23f', 18);
    c.fillStyle = '#ffd23f'; c.strokeStyle = '#a8740b'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-14, 8); c.lineTo(-16, -8); c.lineTo(-7, -1); c.lineTo(0, -12); c.lineTo(7, -1); c.lineTo(16, -8); c.lineTo(14, 8); c.closePath(); c.fill(); c.stroke();
    noGlow(c); c.fillStyle = '#ff2e55'; c.beginPath(); c.arc(0, 2, 2.6, 0, 7); c.fill(); c.fillStyle = '#22e4ff'; c.beginPath(); c.arc(-8, 3, 2, 0, 7); c.arc(8, 3, 2, 0, 7); c.fill();
    c.restore();
  }
  function drawKey(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s); glow(c, '#ffd23f', 18); c.strokeStyle = '#ffd23f'; c.fillStyle = '#ffd23f'; c.lineWidth = 3.5;
    c.beginPath(); c.arc(-8, 0, 6, 0, 7); c.stroke(); c.beginPath(); c.moveTo(-2, 0); c.lineTo(14, 0); c.moveTo(9, 0); c.lineTo(9, 6); c.moveTo(14, 0); c.lineTo(14, 5); c.stroke(); c.restore();
  }
  function drawOrb(c, x, y, gt, r = 12) {
    c.save(); glow(c, '#22e4ff', 24);
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#7ff3ff'); g.addColorStop(1, '#0a6b8a');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * (1 + Math.sin(gt * 8) * 0.06), 0, 7); c.fill(); c.restore();
  }
  function drawNugget(c, x, y, big, gt, s = 1) {
    const r = (big ? 16 : 9) * s;
    c.save(); glow(c, '#ffd23f', big ? 24 : 10);
    c.fillStyle = '#ffcf33'; c.strokeStyle = '#b88400'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.9, y - r * 0.2); c.lineTo(x + r * 0.5, y + r * 0.7); c.lineTo(x - r * 0.6, y + r * 0.6); c.lineTo(x - r * 0.9, y - r * 0.3); c.closePath(); c.fill(); c.stroke();
    noGlow(c); c.fillStyle = '#fff7c2'; c.beginPath(); c.moveTo(x - r * 0.2, y - r * 0.6); c.lineTo(x + r * 0.3, y - r * 0.3); c.lineTo(x - r * 0.1, y); c.closePath(); c.fill();
    c.restore();
  }
  function drawCoin(c, x, y, gt, s = 1) {
    const w = Math.abs(Math.cos(gt * 4 + x)) * 9 * s + 2;
    c.save(); glow(c, '#ffd23f', 12); c.fillStyle = '#ffcf33'; c.strokeStyle = '#a8740b'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(x, y - 10, w, 9 * s, 0, 0, 7); c.fill(); c.stroke(); c.restore();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y, 7 * s, 3 * s, 0, 0, 7); c.fill();
  }

  // ---------- fundo (abismo) ----------
  function abyss(c, t, camX, camY, space) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, space ? '#05020f' : '#0c0420'); g.addColorStop(1, '#010006');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (space) {
      const n = c.createRadialGradient(W * 0.7, H * 0.3, 10, W * 0.7, H * 0.3, 500);
      n.addColorStop(0, 'rgba(184,77,255,.18)'); n.addColorStop(1, 'transparent'); c.fillStyle = n; c.fillRect(0, 0, W, H);
      const n2 = c.createRadialGradient(W * 0.2, H * 0.8, 10, W * 0.2, H * 0.8, 400);
      n2.addColorStop(0, 'rgba(34,228,255,.12)'); n2.addColorStop(1, 'transparent'); c.fillStyle = n2; c.fillRect(0, 0, W, H);
    }
    for (const s of stars) {
      const x = ((s.x - camX * s.z) % 2000 + 2000) % 2000 * (W / 2000) * 1.6 - 100, y = ((s.y - camY * s.z) % 1200 + 1200) % 1200 * (H / 1200);
      c.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * s.z * 3 + s.x));
      c.fillStyle = s.z > 0.45 ? '#cfe9ff' : '#b18cff'; c.fillRect(x, y, s.s, s.s);
    }
    c.globalAlpha = 1;
    if (!space) { // grade em perspectiva no fundo do abismo
      c.save(); c.strokeStyle = 'rgba(184,77,255,.12)'; c.lineWidth = 1;
      const hz = H * 0.5, off = (t * 30) % 40;
      for (let k = 0; k < 14; k++) { const y = hz + Math.pow((k * 40 + off) / 560, 2) * (H - hz); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let k = -12; k <= 12; k++) { c.beginPath(); c.moveTo(W / 2 + k * 18, hz); c.lineTo(W / 2 + k * 140, H); c.stroke(); }
      c.restore();
    }
  }
  function arenaFloor(c, x, y, w, h, top = '#0f0824', grid = 'rgba(77,124,255,.13)', edge = '#4d7cff') {
    slab(c, x, y, w, h, 26, top, '#1a0f38', edge, 14);
    floorGrid(c, x, y, w, h, grid);
  }

  // ============ JOGOS ORIGINAIS ============
  function laserSegments(L, t) {
    const segs = [], warn = [];
    for (const l of L) {
      if (l.t === 'gate') {
        const cc = H / 2 + Math.sin(t * l.w + l.ph) * (H / 2 - 130);
        segs.push([l.x, 40, l.x, cc - l.gap / 2], [l.x, cc + l.gap / 2, l.x, H - 40]);
      } else if (l.t === 'rot') {
        const a = t * l.w + l.ph;
        segs.push([l.x - Math.cos(a) * l.L, l.y - Math.sin(a) * l.L, l.x + Math.cos(a) * l.L, l.y + Math.sin(a) * l.L]);
      } else if (l.t === 'blink') {
        const ph = ((t + l.ph) % l.period) / l.period;
        if (ph > 0.55) segs.push([l.x, 40, l.x, H - 40]); else if (ph > 0.3) warn.push([l.x, 40, l.x, H - 40]);
      }
    }
    return { segs, warn };
  }
  const G = {};
  G.laser = {
    floor(c, v) {
      const I = v.init;
      arenaFloor(c, 0, 40, W, H - 80);
      c.fillStyle = 'rgba(184,77,255,.12)'; c.fillRect(0, 40, 130, H - 80);
      c.save(); c.globalAlpha = 0.9; checker(c, I.finishX, 40, 26, H - 80, 13); c.restore();
      const { segs, warn } = laserSegments(I.lasers, v.gt);
      warn.forEach((s) => { c.save(); c.setLineDash([8, 10]); c.strokeStyle = 'rgba(255,46,85,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke(); c.restore(); });
      v._segs = segs;
    },
    objects(c, v, add) {
      v.init.lasers.forEach((l) => {
        if (l.t === 'rot') add(l.y, () => cylinder(c, l.x, l.y, 12, 26, '#3a0b1c', '#2a0814', '#ff2e55'));
        else { add(46, () => block(c, l.x - 10, 30, 20, 16, 22, '#3a0b1c', '#2a0814', '#ff2e55', 4)); add(H - 30, () => block(c, l.x - 10, H - 46, 20, 16, 22, '#3a0b1c', '#2a0814', '#ff2e55', 4)); }
      });
    },
    over(c, v) { (v._segs || []).forEach((s) => beam(c, s[0], s[1], s[2], s[3], '#ff2e55', 22)); },
  };
  G.floor = {
    floor(c, v) {
      const I = v.init, tiles = (v.x && v.x.tiles) || '';
      for (let r = 0; r < I.rows; r++) for (let q = 0; q < I.cols; q++) {
        const s = tiles[r * I.cols + q]; if (s === '2') continue;
        let x = I.ox + q * I.size + 3, y = I.oy + r * I.size + 3;
        if (s === '1') { x += (Math.random() - 0.5) * 3; y += (Math.random() - 0.5) * 3; }
        const crack = s === '1';
        slab(c, x, y, I.size - 6, I.size - 6, 16, crack ? '#3a0a1a' : ((q + r) % 2 ? '#1a0f3a' : '#211347'), crack ? '#2a0612' : '#140a2e', crack ? (Math.floor(v.gt * 14) % 2 ? '#ff2e55' : '#ff9fb2') : 'rgba(77,124,255,.8)', 8);
        if (crack) { c.strokeStyle = 'rgba(255,46,85,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 10, y + 12); c.lineTo(x + 34, y + 36); c.lineTo(x + 58, y + 58); c.moveTo(x + 34, y + 36); c.lineTo(x + 60, y + 16); c.stroke(); }
      }
    },
  };
  G.knockout = {
    floor(c, v) {
      const I = v.init, Rr = (v.x && v.x.R) || 320;
      disc(c, I.cx, I.cy, Rr, 40, '#120a2c', '#1d1145', '#22e4ff');
      c.save(); c.beginPath(); c.arc(I.cx, I.cy, Rr, 0, 7); c.clip(); c.strokeStyle = 'rgba(34,228,255,.15)';
      for (let k = 1; k < 6; k++) { c.beginPath(); c.arc(I.cx, I.cy, (Rr * k) / 6, 0, 7); c.stroke(); }
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + v.gt * 0.2; c.beginPath(); c.moveTo(I.cx, I.cy); c.lineTo(I.cx + Math.cos(a) * Rr, I.cy + Math.sin(a) * Rr); c.stroke(); }
      c.restore();
      if (Rr > 140) { c.save(); c.strokeStyle = 'rgba(255,46,85,.6)'; c.lineWidth = 2; c.setLineDash([10, 12]); c.beginPath(); c.arc(I.cx, I.cy, Rr + 16, v.gt, v.gt + 7); c.stroke(); c.restore(); }
    },
  };
  function padRects() {
    const s = 200, gap = 30, x0 = W / 2 - s - gap / 2, y0 = 130;
    return [0, 1, 2, 3].map((i) => ({ i, x: x0 + (i % 2) * (s + gap), y: y0 + Math.floor(i / 2) * (s + gap), s }));
  }
  G.memory = {
    floor(c, v) {
      const x = v.x || {}, lit = x.lit >= 0 ? x.lit % 10 : -1, now = performance.now();
      slab(c, W / 2 - 250, 110, 500, 470, 30, '#100826', '#1a0f38', 'rgba(184,77,255,.6)', 20);
      padRects().forEach((p) => {
        const on = lit === p.i || now - local.padFlash[p.i] < 180, col = PADS[p.i];
        const hgt = on ? 6 : 16;
        block(c, p.x, p.y + 16, p.s, p.s - 16, hgt, on ? col : shadeHex(col, -0.72), shadeHex(col, -0.55), col, 22);
        if (on) { c.save(); glow(c, col, 60); c.fillStyle = col; c.globalAlpha = 0.35; rr(c, p.x - 8, p.y + 8 - hgt, p.s + 16, p.s, 26); c.fill(); c.restore(); }
        c.save(); c.fillStyle = on ? '#0d0718' : col; c.font = '800 52px Orbitron, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(p.i + 1), p.x + p.s / 2, p.y + 16 - hgt + (p.s - 16) / 2 + 2); c.restore();
      });
      c.save(); c.textAlign = 'center'; c.font = '800 26px Orbitron, sans-serif';
      const msg = { wait: 'PREPARE-SE…', show: 'MEMORIZE!', input: v.init.reverse ? 'SUA VEZ! (DE TRÁS PRA FRENTE)' : 'SUA VEZ! REPITA A SEQUÊNCIA', reveal: 'RESULTADO DA FASE' }[x.phase] || '';
      c.fillStyle = x.phase === 'input' ? '#c8ff3d' : '#22e4ff'; glow(c, c.fillStyle, 16); c.fillText(msg, W / 2, 76);
      noGlow(c); c.font = '600 16px "Chakra Petch", sans-serif'; c.fillStyle = '#a99cc9';
      c.fillText(`Fase ${x.level || 1} · ${x.len || 3} cores${x.left ? ` · ${x.left}s` : ''}`, W / 2, 100); c.restore();
      if (x.seq) { const s = 26, tot = x.seq.length * (s + 6); x.seq.forEach((k, i) => { c.fillStyle = PADS[k]; rr(c, W / 2 - tot / 2 + i * (s + 6), 598, s, s, 6); c.fill(); }); }
      const st = x.st || [], n = st.length, bw = Math.min(200, (W - 80) / Math.max(1, n));
      st.forEach(([pn, prog, state, score], k) => {
        const p = v.byN[pn]; if (!p) return;
        const bx = W / 2 - (n * bw) / 2 + k * bw + bw / 2, by = 668;
        drawAvatar(c, p.avatar, p.color, bx - 50, by, 18, { x: 0, y: 0 }, state === 2 ? 0.4 : 1);
        c.save(); c.font = '700 13px "Chakra Petch", sans-serif'; c.fillStyle = p.me ? '#fff' : p.color; c.textAlign = 'left';
        c.fillText(p.name, bx - 26, by - 6);
        c.fillStyle = state === 1 ? '#c8ff3d' : state === 2 ? '#ff2e55' : '#a99cc9';
        c.fillText(state === 1 ? '✓ acertou' : state === 2 ? '✗ errou' : '•'.repeat(prog) || '…', bx - 26, by + 12);
        c.fillStyle = '#ffd23f'; c.fillText(`${score} pts`, bx - 26, by + 28); c.restore();
      });
    },
    noPlayers: true,
  };
  function boxCube(c, x, y, gt, col = '#22e4ff') {
    const bob = Math.sin(gt * 3 + x) * 4, s = 15, a = gt * 1.5;
    c.save(); c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x, y + 6, 14, 5, 0, 0, 7); c.fill();
    c.translate(x, y - 20 + bob); glow(c, col, 18); c.strokeStyle = col; c.lineWidth = 2.5; c.fillStyle = 'rgba(34,228,255,.2)';
    const pts = [0, 1, 2, 3].map((k) => [Math.cos(a + k * Math.PI / 2) * s, Math.sin(a + k * Math.PI / 2) * s * 0.55]);
    c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(px, py - 8) : c.moveTo(px, py - 8))); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); pts.forEach(([px, py]) => { c.moveTo(px, py - 8); c.lineTo(px, py + 8); }); c.stroke();
    c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(px, py + 8) : c.moveTo(px, py + 8))); c.closePath(); c.stroke();
    noGlow(c); c.fillStyle = '#fff'; c.font = '800 14px Orbitron'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 0);
    c.restore();
  }
  G.race = {
    floor(c, v) {
      const I = v.init;
      slab(c, 0, 60, I.len, H - 120, 30, '#0d0722', '#1a0f38', '#b84dff', 0);
      floorGrid(c, v.cam.x, 60, W, H - 120, 'rgba(184,77,255,.1)');
      I.goo.forEach((g) => {
        c.save(); c.fillStyle = 'rgba(160,20,90,.45)'; glow(c, '#ff2e82', 10); c.strokeStyle = 'rgba(255,46,130,.6)'; c.lineWidth = 2; rr(c, g[0], g[1], g[2], g[3], 18); c.fill(); c.stroke();
        noGlow(c); c.fillStyle = 'rgba(255,92,225,.45)'; for (let k = 0; k < 7; k++) { const bx = g[0] + ((k * 53 + v.gt * 20) % g[2]), by = g[1] + ((k * 37 + v.gt * 9) % g[3]); c.beginPath(); c.arc(bx, by, 3 + (k % 3) * 2 + Math.sin(v.gt * 4 + k) * 1.5, 0, 7); c.fill(); }
        c.restore();
      });
      I.boosts.forEach((b) => {
        c.save(); c.fillStyle = 'rgba(34,228,255,.14)'; c.strokeStyle = 'rgba(34,228,255,.7)'; c.lineWidth = 2; rr(c, b[0], b[1], b[2], b[3], 10); c.fill(); c.stroke();
        c.beginPath(); c.rect(b[0], b[1], b[2], b[3]); c.clip(); c.strokeStyle = '#22e4ff'; c.lineWidth = 4; glow(c, '#22e4ff', 10);
        for (let k = -1; k < b[2] / 30 + 1; k++) { const xx = b[0] + k * 30 + ((v.gt * 140) % 30); c.beginPath(); c.moveTo(xx, b[1] + b[3] * 0.25); c.lineTo(xx + 12, b[1] + b[3] / 2); c.lineTo(xx, b[1] + b[3] * 0.75); c.stroke(); }
        c.restore();
      });
      checker(c, I.finishX, 60, 30, H - 120, 15);
      ((v.x && v.x.mines) || []).forEach(([mx, my, armed]) => {
        c.save(); c.fillStyle = '#1a0008'; c.strokeStyle = '#ff2e55'; c.lineWidth = 2; glow(c, '#ff2e55', armed && Math.floor(v.gt * 6) % 2 ? 24 : 4);
        c.beginPath(); c.arc(mx, my, 11, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#ff2e55'; c.beginPath(); c.arc(mx, my, 4, 0, 7); c.fill(); c.restore();
      });
    },
    objects(c, v, add) {
      v.init.walls.forEach((w) => {
        if (w[1] <= 0 || w[1] >= H - 60) return; // bordas desenhadas à parte
        if (w[0] + w[2] < v.cam.x - 60 || w[0] > v.cam.x + W + 60) return;
        add(w[1] + w[3], () => block(c, w[0], w[1], w[2], w[3], 34, '#1c0f3d', '#120828', '#b84dff'));
      });
      ((v.x && v.x.boxes) || []).forEach(([bx, by, on]) => { if (on) add(by, () => boxCube(c, bx, by, v.gt)); });
    },
    over(c, v) {
      // muretas superior e inferior
      c.save(); c.fillStyle = '#160b30'; c.fillRect(v.cam.x - 10, 0, W + 20, 60); c.strokeStyle = '#b84dff'; glow(c, '#b84dff', 14); c.lineWidth = 2;
      c.beginPath(); c.moveTo(v.cam.x - 10, 60); c.lineTo(v.cam.x + W + 10, 60); c.stroke(); c.restore();
    },
    hud(c, v) { minimap(c, v, v.init.finishX); },
  };
  function minimap(c, v, finish, lava) {
    const x0 = 360, x1 = W - 360, y = H - 26;
    c.save(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    checker(c, x1, y - 8, 8, 16, 4);
    if (lava != null) { const lx = x0 + (x1 - x0) * Math.max(0, Math.min(1, lava / finish)); c.strokeStyle = '#ff6a00'; glow(c, '#ff6a00', 10); c.beginPath(); c.moveTo(x0, y); c.lineTo(lx, y); c.stroke(); noGlow(c); }
    v.players.forEach((p) => { if (!(p.f & 1)) return; const px = x0 + (x1 - x0) * Math.max(0, Math.min(1, p.x / finish)); c.fillStyle = p.color; glow(c, p.color, 8); c.beginPath(); c.arc(px, y, p.me ? 8 : 6, 0, 7); c.fill(); });
    c.restore();
  }
  G.bomb = {
    floor(c) { arenaFloor(c, 30, 30, W - 60, H - 60, '#120717', 'rgba(255,46,85,.1)', '#ff2e55'); },
    objects(c, v, add) { v.init.pillars.forEach(([x, y, r]) => add(y, () => cylinder(c, x, y, r, 60, '#1c0f3d', '#140a2e', '#b84dff'))); },
    deco(v, p) { return v.x && v.x.h === p.n ? { bomb: true, heat: v.x.heat || 0, aura: '#ff2e55' } : null; },
  };

  // ============ MODOS NOVOS ============
  G.treasure = {
    floor(c, v) {
      const I = v.init;
      slab(c, 0, 0, I.world.w, I.world.h, 30, '#140c22', '#1c1233', '#5a3f8f', 0);
      c.save(); c.strokeStyle = 'rgba(150,120,200,.08)'; c.lineWidth = 2;
      for (let y = Math.floor(v.cam.y / 60) * 60; y < v.cam.y + H + 60; y += 60) for (let x = Math.floor(v.cam.x / 90) * 90 + ((y / 60) % 2) * 45; x < v.cam.x + W + 90; x += 90) c.strokeRect(x, y, 90, 60);
      c.restore();
      I.spikes.forEach((s) => {
        const ph = ((v.gt + s[4]) % s[5]) / s[5], st = ph > 0.62 ? 2 : ph > 0.45 ? 1 : 0;
        c.save(); c.fillStyle = st === 1 ? 'rgba(255,46,85,.25)' : 'rgba(40,20,60,.8)'; c.strokeStyle = st ? '#ff2e55' : 'rgba(255,46,85,.35)'; glow(c, '#ff2e55', st ? 14 : 0); c.lineWidth = 2;
        rr(c, s[0], s[1], s[2], s[3], 8); c.fill(); c.stroke(); noGlow(c);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const x = s[0] + 12 + i * 22, y = s[1] + 18 + j * 22;
          if (st === 2) { c.fillStyle = '#e8e2ff'; c.beginPath(); c.moveTo(x - 6, y + 4); c.lineTo(x, y - 12); c.lineTo(x + 6, y + 4); c.closePath(); c.fill(); c.fillStyle = '#ff2e55'; c.fillRect(x - 1, y - 12, 2, 4); }
          else { c.fillStyle = st ? '#ff2e55' : '#3a2a55'; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
        }
        c.restore();
      });
      ((v.x && v.x.coins) || []).forEach(([x, y]) => drawCoin(c, x, y, v.gt));
    },
    objects(c, v, add) {
      v.init.walls.forEach((w) => {
        if (w[0] + w[2] < v.cam.x - 60 || w[0] > v.cam.x + W + 60 || w[1] + w[3] < v.cam.y - 80 || w[1] > v.cam.y + H + 80) return;
        add(w[1] + w[3], () => block(c, w[0], w[1], w[2], w[3], 46, '#3b2d5c', '#251a3d', '#8a6cd1', 5));
      });
      ((v.x && v.x.chests) || []).forEach(([x, y, gold, prog]) => add(y + 14, () => {
        const col = gold ? '#ffd23f' : '#c07a3a';
        block(c, x - 22, y - 14, 44, 28, 24, gold ? '#5a4210' : '#4a2a14', gold ? '#3d2c08' : '#331c0c', col, 5);
        c.fillStyle = col; c.fillRect(x - 3, y - 30, 6, 10);
        if (prog > 0) { c.save(); c.strokeStyle = '#c8ff3d'; c.lineWidth = 5; glow(c, '#c8ff3d', 10); c.beginPath(); c.arc(x, y - 60, 14, -Math.PI / 2, -Math.PI / 2 + (prog / 100) * Math.PI * 2); c.stroke(); c.restore(); }
      }));
    },
    hudSc: true,
  };
  G.lava = {
    floor(c, v) {
      const I = v.init, lava = (v.x && v.x.lava) || -300;
      slab(c, 0, 50, I.world.w, H - 100, 30, '#1a0d0d', '#2a1212', '#ff6a00', 0);
      c.save(); c.strokeStyle = 'rgba(255,106,0,.07)';
      for (let x = Math.floor(v.cam.x / 80) * 80; x < v.cam.x + W + 80; x += 80) { c.beginPath(); c.moveTo(x, 50); c.lineTo(x + 30, H - 50); c.stroke(); }
      c.restore();
      I.pits.forEach((p) => { if (p[0] + p[2] < v.cam.x - 50 || p[0] > v.cam.x + W + 50) return; lavaPool(c, p[0], p[1], p[2], p[3], v.gt); });
      c.save(); glow(c, '#22e4ff', 30); c.fillStyle = 'rgba(34,228,255,.18)'; c.fillRect(I.finishX, 50, 300, H - 100); c.restore();
      checker(c, I.finishX, 50, 24, H - 100, 12);
      ((v.x && v.x.rocks) || []).forEach(([x, y, w]) => {
        if (w < 0) return;
        const k = 1 - Math.min(1, w / 110);
        c.save(); c.strokeStyle = '#ff2e55'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(x, y, 55, 0, 7); c.stroke();
        c.fillStyle = `rgba(255,46,85,${0.1 + k * 0.25})`; c.beginPath(); c.arc(x, y, 55 * k, 0, 7); c.fill(); c.restore();
      });
    },
    objects(c, v, add) {
      v.init.walls.forEach((w) => {
        if (w[1] <= 0 || w[1] >= H - 50) return;
        if (w[0] + w[2] < v.cam.x - 60 || w[0] > v.cam.x + W + 60) return;
        add(w[1] + w[3], () => block(c, w[0], w[1], w[2], w[3], 40, '#2d1a1a', '#1d0f0f', '#ff6a00', 6));
      });
      ((v.x && v.x.rocks) || []).forEach(([x, y, w]) => {
        if (w < 0) return;
        add(y, () => { const hgt = w * 5; c.save(); glow(c, '#ff6a00', 20); c.fillStyle = '#4a2a1a'; c.strokeStyle = '#ff6a00'; c.lineWidth = 3; c.beginPath(); c.arc(x, y - hgt - 20, 24, 0, 7); c.fill(); c.stroke(); c.restore(); });
      });
    },
    over(c, v) {
      const lava = (v.x && v.x.lava) || -300;
      if (lava > v.cam.x - 300) {
        c.save();
        const g = c.createLinearGradient(lava - 260, 0, lava + 40, 0);
        g.addColorStop(0, '#ff3d00'); g.addColorStop(0.7, '#ff8a00'); g.addColorStop(1, 'rgba(255,138,0,0)');
        c.fillStyle = g; c.fillRect(v.cam.x - 10, 0, lava - v.cam.x + 50, H);
        glow(c, '#ff6a00', 40); c.fillStyle = '#ffd23f';
        for (let k = 0; k < 18; k++) { const y = (k / 18) * H, w = 18 + Math.sin(v.gt * 6 + k) * 14; c.beginPath(); c.ellipse(lava + 10, y + 20, w, 22, 0, 0, 7); c.fill(); }
        c.restore();
        if (Math.random() < 0.6) parts.push({ x: lava + Math.random() * 20, y: Math.random() * H, vx: 60 + Math.random() * 80, vy: -120 - Math.random() * 100, life: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#ffd23f' : '#ff6a00', size: 4, g: 0 });
      }
    },
    hud(c, v) { minimap(c, v, v.init.finishX, (v.x && v.x.lava) || 0); },
  };
  function lavaPool(c, x, y, w, h, gt) {
    c.save();
    c.fillStyle = '#120404'; rr(c, x - 4, y - 4, w + 8, h + 8, 12); c.fill();
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#ff3d00'); g.addColorStop(0.5 + Math.sin(gt * 2 + x) * 0.2, '#ffb300'); g.addColorStop(1, '#ff2e00');
    glow(c, '#ff6a00', 26); c.fillStyle = g; rr(c, x, y + 6, w, h - 6, 10); c.fill(); noGlow(c);
    c.fillStyle = 'rgba(255,240,180,.6)';
    for (let k = 0; k < 4; k++) { const bx = x + ((k * 47 + gt * 25) % w), by = y + 10 + ((k * 31) % Math.max(10, h - 20)); c.beginPath(); c.arc(bx, by, 3 + Math.abs(Math.sin(gt * 3 + k)) * 4, 0, 7); c.fill(); }
    c.restore();
  }
  G.boss = {
    floor(c, v) {
      arenaFloor(c, 20, 20, W - 40, H - 40, '#0b0a20', 'rgba(34,228,255,.08)', '#22e4ff');
      const I = v.init;
      c.save(); c.strokeStyle = 'rgba(255,46,85,.25)'; c.lineWidth = 2; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(I.bx, I.by, I.br + k * 40, 0, 7); c.stroke(); } c.restore();
      ((v.x && v.x.orbs) || []).forEach(([x, y]) => { c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x, y + 4, 12, 4, 0, 0, 7); c.fill(); drawOrb(c, x, y - 16 + Math.sin(v.gt * 3 + x) * 4, v.gt, 13); });
    },
    objects(c, v, add) {
      const I = v.init, x = v.x || {}, ang = x.ang || 0, hit = x.fl;
      add(I.by + 10, () => {
        cylinder(c, I.bx, I.by + 10, I.br, 40, hit ? '#fff' : '#2a0c1f', '#1b0614', '#ff2e55');
        const cy = I.by - 30;
        for (let k = 0; k < 6; k++) {
          const a = ang + (k / 6) * Math.PI * 2;
          c.save(); c.translate(I.bx + Math.cos(a) * (I.br - 8), cy + Math.sin(a) * (I.br - 8) * 0.55); c.rotate(a);
          c.fillStyle = '#3a1030'; c.strokeStyle = '#ff2e55'; glow(c, '#ff2e55', 10); c.lineWidth = 2; rr(c, -10, -16, 20, 32, 4); c.fill(); c.stroke(); c.restore();
        }
        c.save(); glow(c, '#ff2e55', 40); c.fillStyle = hit ? '#fff' : '#1a0010'; c.beginPath(); c.arc(I.bx, cy, 34, 0, 7); c.fill();
        c.fillStyle = '#ff2e55'; c.beginPath(); c.arc(I.bx + Math.cos(ang * 0.7) * 10, cy + Math.sin(ang * 0.7) * 6, 15, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(I.bx + Math.cos(ang * 0.7) * 10 - 4, cy + Math.sin(ang * 0.7) * 6 - 5, 4, 0, 7); c.fill(); c.restore();
      });
    },
    over(c, v) {
      const b = (v.x && v.x.b) || [];
      c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; b.forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y + 2, 5, 2, 0, 0, 7); c.fill(); });
      glow(c, '#ff5ce1', 12); c.fillStyle = '#ff9ff0'; b.forEach(([x, y]) => { c.beginPath(); c.arc(x, y - 20, 6, 0, 7); c.fill(); });
      noGlow(c); c.fillStyle = '#fff'; b.forEach(([x, y]) => { c.beginPath(); c.arc(x, y - 20, 2.5, 0, 7); c.fill(); });
      c.restore();
    },
    hud(c, v) {
      const x = v.x || {}, w = 520, f = (x.hp || 0) / (x.max || 1);
      c.save(); c.fillStyle = 'rgba(0,0,0,.6)'; rr(c, W / 2 - w / 2 - 4, H - 40, w + 8, 22, 8); c.fill();
      const g = c.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0); g.addColorStop(0, '#ff2e55'); g.addColorStop(1, '#ff5ce1');
      glow(c, '#ff2e55', 16); c.fillStyle = g; rr(c, W / 2 - w / 2, H - 36, w * f, 14, 6); c.fill(); noGlow(c);
      c.fillStyle = '#fff'; c.font = '800 12px Orbitron'; c.textAlign = 'center'; c.fillText(`TITÃ  ${x.hp}/${x.max}`, W / 2, H - 25); c.restore();
    },
    deco(v, p) { return v.x && v.x.carry && v.x.carry.includes(p.n) ? { orb: true, aura: '#22e4ff' } : null; },
    hudSc: true,
  };
  G.dungeon = {
    floor(c, v) {
      const I = v.init;
      slab(c, 0, 0, I.world.w, I.world.h, 30, '#120d1c', '#1a1428', '#3d2d66', 0);
      c.save(); c.strokeStyle = 'rgba(120,100,170,.09)'; c.lineWidth = 1.5;
      for (let y = Math.floor(v.cam.y / 50) * 50; y < v.cam.y + H + 50; y += 50) for (let x = Math.floor(v.cam.x / 50) * 50; x < v.cam.x + W + 50; x += 50) c.strokeRect(x + 2, y + 2, 46, 46);
      c.restore();
      const P = I.portal;
      c.save(); c.translate(P.x, P.y);
      for (let k = 0; k < 4; k++) { c.rotate(v.gt * (0.8 + k * 0.3)); glow(c, '#22e4ff', 20); c.strokeStyle = k % 2 ? '#22e4ff' : '#b84dff'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 50 - k * 9, 34 - k * 6, 0, 0, Math.PI * 1.5); c.stroke(); }
      c.restore();
      ((v.x && v.x.keys) || []).forEach(([x, y]) => { c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x, y + 4, 12, 4, 0, 0, 7); c.fill(); drawKey(c, x, y - 16 + Math.sin(v.gt * 4 + x) * 3, 1.1); });
    },
    objects(c, v, add) {
      v.init.walls.forEach((w) => {
        if (w[0] + w[2] < v.cam.x - 60 || w[0] > v.cam.x + W + 60 || w[1] + w[3] < v.cam.y - 80 || w[1] > v.cam.y + H + 80) return;
        add(w[1] + w[3], () => block(c, w[0], w[1], w[2], w[3], 50, '#2a2142', '#1a142b', '#6a52b0', 3));
      });
      ((v.x && v.x.mobs) || []).forEach(([x, y]) => add(y, () => {
        const b = Math.sin(v.gt * 5 + x) * 4;
        c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(x, y + 4, 16, 6, 0, 0, 7); c.fill();
        glow(c, '#ff2e55', 22); c.fillStyle = '#1a0612'; c.strokeStyle = '#ff2e55'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(x - 18, y - 6 + b); c.quadraticCurveTo(x - 20, y - 48 + b, x, y - 50 + b); c.quadraticCurveTo(x + 20, y - 48 + b, x + 18, y - 6 + b);
        for (let k = 0; k < 4; k++) c.lineTo(x + 18 - (k + 0.5) * 9, y - (k % 2 ? 0 : 8) + b);
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#ff2e55'; c.beginPath(); c.arc(x - 6, y - 32 + b, 4, 0, 7); c.arc(x + 6, y - 32 + b, 4, 0, 7); c.fill(); c.restore();
      }));
    },
    deco(v, p) {
      const x = v.x || {};
      if (x.out && x.out.includes(p.n)) return { hidden: true };
      return x.kh && x.kh.includes(p.n) ? { key: true } : null;
    },
    fog(v) { return { mine: v.mods.includes('apagao') ? 180 : 250, others: 70 }; },
    hud(c, v) {
      const me = v.players.find((p) => p.me), x = v.x || {};
      if (!me || !x.kh || !x.kh.includes(me.n)) return;
      const P = v.init.portal, a = Math.atan2(P.y - me.y, P.x - me.x);
      c.save(); c.translate(me.x - v.cam.x, me.y - v.cam.y - 70); c.rotate(a); glow(c, '#22e4ff', 16); c.fillStyle = '#22e4ff';
      c.beginPath(); c.moveTo(30, 0); c.lineTo(14, -9); c.lineTo(14, 9); c.closePath(); c.fill(); c.restore();
    },
  };
  G.crown = {
    floor(c, v) {
      arenaFloor(c, 30, 30, W - 60, H - 60, '#140a26', 'rgba(255,210,63,.07)', '#ffd23f');
      c.save(); c.strokeStyle = 'rgba(255,210,63,.18)'; c.lineWidth = 3; c.beginPath(); c.arc(W / 2, H / 2, 260, 0, 7); c.stroke(); c.restore();
    },
    objects(c, v, add) {
      v.init.pillars.forEach(([x, y, r]) => add(y, () => cylinder(c, x, y, r, 70, '#2a1a48', '#1c1033', '#ffd23f')));
      add(H / 2, () => cylinder(c, W / 2, H / 2, 20, 30, '#3a0b1c', '#2a0814', '#ff2e55'));
      const cr = v.x && v.x.crown;
      if (cr && cr[0] < 0) add(cr[2], () => {
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(cr[1], cr[2] + 4, 18, 6, 0, 0, 7); c.fill();
        c.save(); glow(c, '#ffd23f', 30); c.strokeStyle = 'rgba(255,210,63,.6)'; c.lineWidth = 2; c.beginPath(); c.ellipse(cr[1], cr[2], 26 + Math.sin(v.gt * 5) * 4, 10, 0, 0, 7); c.stroke(); c.restore();
        drawCrown(c, cr[1], cr[2] - 26 + Math.sin(v.gt * 4) * 4, 1.6);
      });
    },
    over(c, v) {
      const x = v.x || {}; if (!x.armOn) return;
      v.init.arms.forEach((a) => { const g = v.gt * a.w * (x.armK || 1); beam(c, a.x - Math.cos(g) * a.L, a.y - Math.sin(g) * a.L, a.x + Math.cos(g) * a.L, a.y + Math.sin(g) * a.L, '#ff2e55', 26); });
    },
    deco(v, p) { const cr = v.x && v.x.crown; return cr && cr[0] === p.n ? { crown: true, aura: '#ffd23f' } : null; },
    hudSc: true,
  };
  G.ships = {
    space: true,
    floor(c, v) {
      ((v.x && v.x.rocks) || []).forEach(([x, y, r]) => {
        c.save(); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 10, y + 16, r, r * 0.5, 0, 0, 7); c.fill();
        const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r);
        g.addColorStop(0, '#6a5a8a'); g.addColorStop(1, '#1d1530');
        c.fillStyle = g; glow(c, '#b84dff', 10); c.strokeStyle = '#b84dff'; c.lineWidth = 2;
        c.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr2 = r * (0.85 + ((k * 37 + r) % 7) / 30); k ? c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2) : c.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
        c.closePath(); c.fill(); c.stroke();
        noGlow(c); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(x + r * 0.25, y + r * 0.1, r * 0.22, 0, 7); c.arc(x - r * 0.3, y + r * 0.35, r * 0.13, 0, 7); c.fill();
        c.restore();
      });
    },
    over(c, v) {
      ((v.x && v.x.shots) || []).forEach(([x, y, n]) => { const p = v.byN[n]; c.save(); glow(c, p ? p.color : '#fff', 14); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); c.restore(); });
    },
    drawPlayer(c, p, gt) {
      if (!(p.f & 1)) return;
      const a = p.a || 0, r = p.r * 1.25, inv = p.f & 64;
      c.save(); if (inv && Math.floor(gt * 12) % 2) c.globalAlpha = 0.35;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(p.x + 8, p.y + 14, r * 0.9, r * 0.45, 0, 0, 7); c.fill();
      c.translate(p.x, p.y); c.rotate(a);
      if (Math.hypot(p.vx, p.vy) > 60) { glow(c, '#ff9f1c', 16); c.fillStyle = Math.random() < 0.5 ? '#ffd23f' : '#ff6a00'; c.beginPath(); c.moveTo(-r * 0.8, -r * 0.3); c.lineTo(-r * (1.3 + Math.random() * 0.5), 0); c.lineTo(-r * 0.8, r * 0.3); c.fill(); }
      glow(c, p.color, 18); c.fillStyle = '#140b28'; c.strokeStyle = p.color; c.lineWidth = 3;
      c.beginPath(); c.moveTo(r * 1.1, 0); c.lineTo(-r * 0.8, -r * 0.8); c.lineTo(-r * 0.45, 0); c.lineTo(-r * 0.8, r * 0.8); c.closePath(); c.fill(); c.stroke();
      noGlow(c); c.rotate(-a);
      drawAvatar(c, p.avatar, p.color, 0, 0, r * 0.42, { x: Math.cos(a), y: Math.sin(a) });
      c.restore();
      c.save(); c.font = `700 ${p.me ? 14 : 12}px "Chakra Petch"`; c.textAlign = 'center'; c.fillStyle = p.me ? '#fff' : p.color; c.fillText(p.name, p.x, p.y - r - 10); c.restore();
    },
    hudSc: true,
  };
  function crossingObjs(l, t) {
    const sp = l.len + l.gap, out = [], cnt = Math.ceil((W + sp) / sp) + 1;
    const base = ((l.off + l.speed * t) % sp + sp) % sp;
    for (let k = -1; k < cnt; k++) out.push(base + k * sp - sp);
    return out;
  }
  const CAR_COLORS = ['#22e4ff', '#ff5ce1', '#c8ff3d', '#ff9f1c'];
  G.crossing = {
    floor(c, v) {
      const L = v.init.lanes;
      slab(c, 0, 650, W, 70, 20, '#16103a', '#0e0828', '#c8ff3d', 0);
      c.fillStyle = '#0c0a14'; c.fillRect(0, 395, W, 255);
      c.save(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.setLineDash([26, 22]);
      [580, 520, 460].forEach((y) => { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }); c.restore();
      slab(c, 0, 335, W, 60, 16, '#16103a', '#0e0828', '#4d7cff', 0);
      // rio de energia
      c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#22e4ff'; c.lineWidth = 1.5;
      for (let k = 0; k < 16; k++) { const y = 92 + k * 15, off = (v.gt * (40 + (k % 4) * 25) * (k % 2 ? 1 : -1)) % 80; c.beginPath(); c.setLineDash([30, 50]); c.lineDashOffset = off; c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.restore();
      L.filter((l) => l.kind === 'log').forEach((l) => crossingObjs(l, v.gt).forEach((x) => slab(c, x, l.y - 24, l.len, 48, 14, '#1f1450', '#130b33', '#22e4ff', 10)));
      slab(c, 0, 20, W, 66, 16, '#24124a', '#140a2e', '#ffd23f', 0);
      c.save(); c.font = '800 20px Orbitron'; c.fillStyle = '#ffd23f'; c.textAlign = 'center'; glow(c, '#ffd23f', 16); c.fillText('★ CHEGADA ★', W * 0.22, 60); c.fillText('★ CHEGADA ★', W * 0.78, 60); c.restore();
    },
    objects(c, v, add) {
      v.init.lanes.filter((l) => l.kind === 'car').forEach((l, i) => crossingObjs(l, v.gt).forEach((x) => add(l.y + 20, () => {
        const col = CAR_COLORS[i % 4];
        block(c, x, l.y - 18, l.len, 38, 22, shadeHex(col, -0.7), shadeHex(col, -0.8), col, 8);
        c.save(); glow(c, '#fff', 14); c.fillStyle = '#fff'; const fx = l.speed > 0 ? x + l.len - 6 : x + 2;
        c.fillRect(fx, l.y - 34, 4, 6); c.fillRect(fx, l.y - 22, 4, 6); c.restore();
      })));
    },
    hudSc: true,
  };
  G.virus = {
    floor(c) { arenaFloor(c, 30, 30, W - 60, H - 60, '#081410', 'rgba(80,255,140,.07)', '#3dff8a'); },
    objects(c, v, add) { v.init.pillars.forEach(([x, y, r]) => add(y, () => cylinder(c, x, y, r, 56, '#0f2a1d', '#0a1c14', '#3dff8a'))); },
    deco(v, p) { return v.x && v.x.inf && v.x.inf.includes(p.n) ? { tint: '#3dff8a', aura: '#3dff8a', infected: true } : null; },
    hudSc: true,
  };
  G.gold = {
    floor(c, v) {
      arenaFloor(c, 20, 20, W - 40, H - 40, '#17110a', 'rgba(255,207,51,.06)', '#ffcf33');
      c.save(); const g = c.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 320); g.addColorStop(0, 'rgba(255,207,51,.12)'); g.addColorStop(1, 'transparent');
      c.fillStyle = g; c.beginPath(); c.ellipse(W / 2, H / 2, 330, 240, 0, 0, 7); c.fill(); c.restore();
      Object.entries(v.init.bases || {}).forEach(([n, [x, y]]) => {
        const p = v.byN[n]; if (!p) return;
        c.save(); glow(c, p.color, 20); c.strokeStyle = p.color; c.lineWidth = 4; c.fillStyle = shadeHex(p.color, -0.8);
        c.beginPath(); c.arc(x, y, 60, 0, 7); c.fill(); c.stroke(); c.restore();
        c.save(); c.font = '800 12px Orbitron'; c.fillStyle = p.color; c.textAlign = 'center'; c.fillText(`BASE ${p.name.toUpperCase()}`, x, y + 48); c.restore();
      });
      ((v.x && v.x.g) || []).forEach(([x, y, big]) => { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 3, big ? 16 : 9, big ? 6 : 4, 0, 0, 7); c.fill(); drawNugget(c, x, y - 8, big, v.gt); });
    },
    objects(c, v, add) {
      Object.entries(v.init.bases || {}).forEach(([n, [x, y]]) => { const p = v.byN[n]; if (p) add(y - 10, () => { block(c, x - 22, y - 30, 44, 26, 34, shadeHex(p.color, -0.6), shadeHex(p.color, -0.75), p.color, 6); }); });
    },
    deco(v, p) { const cr = v.x && v.x.carry && v.x.carry.find((q) => q[0] === p.n); return cr && cr[1] ? { carry: cr[1] } : null; },
    hudSc: true,
  };
  G.territory = {
    floor(c, v) {
      const I = v.init, grid = (v.x && v.x.grid) || '';
      slab(c, 0, 0, W, H, 24, '#0d0820', '#1a0f38', null, 0);
      for (let r = 0; r < I.rows; r++) for (let q = 0; q < I.cols; q++) {
        const ch = grid[r * I.cols + q], x = q * I.cs, y = r * I.cs;
        if (ch && ch !== '.') {
          const p = v.byN[ch];
          const col = p ? p.color : '#666';
          c.fillStyle = shadeHex(col, -0.45); c.fillRect(x + 1, y + 1, I.cs - 2, I.cs - 2);
          c.fillStyle = shadeHex(col, -0.15); c.fillRect(x + 1, y + 1, I.cs - 2, I.cs - 8);
        } else { c.fillStyle = (q + r) % 2 ? '#140c2c' : '#170e33'; c.fillRect(x + 1, y + 1, I.cs - 2, I.cs - 2); }
      }
      ((v.x && v.x.ups) || []).forEach(([x, y, bomb]) => {
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x, y + 4, 14, 5, 0, 0, 7); c.fill();
        c.save(); c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; glow(c, bomb ? '#ff5ce1' : '#22e4ff', 20);
        c.fillText(bomb ? '🎨' : '⚡', x, y - 14 + Math.sin(v.gt * 4 + x) * 3); c.restore();
      });
    },
    hudSc: true,
  };

  // ---------- quadro ----------
  function frame(v, dt) {
    if (!cv) return;
    // qualidade automática
    Q.fps = Q.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
    if (Q.auto && Q.hi) { if (Q.fps < 34) { Q.low = (Q.low || 0) + dt; if (Q.low > 3) Q.hi = false; } else Q.low = 0; }
    const w = cv.width / dpr, h = cv.height / dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#05030b'; ctx.fillRect(0, 0, cv.width, cv.height);
    shakeA = Math.max(0, shakeA - dt * 30); punch = Math.max(0, punch - dt * 0.25); flashA = Math.max(0, flashA - dt * 2.5);
    Object.keys(hitFlash).forEach((k) => { hitFlash[k] = Math.max(0, hitFlash[k] - dt * 4); });
    const sx = (Math.random() - 0.5) * shakeA, sy = (Math.random() - 0.5) * shakeA, z = 1 + punch;
    ctx.setTransform(dpr * scale * z, 0, 0, dpr * scale * z, dpr * (ox + sx + (W * scale * (1 - z)) / 2), dpr * (oy + sy + (H * scale * (1 - z)) / 2));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const g = G[v.game] || {};
    const cam = v.cam || { x: 0, y: 0 };
    v.cam = cam;
    abyss(ctx, v.gt || 0, cam.x, cam.y, g.space);
    // flags anteriores para piscar quando é atingido
    v.players.forEach((p) => { const pf = prevFlags[p.n] || 0; if ((p.f & 2) && !(pf & 2)) hitFlash[p.n] = 1; prevFlags[p.n] = p.f; });
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    if (g.floor) g.floor(ctx, v);
    // fantasmas caindo (atrás de tudo)
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const q = ghosts[i]; q.t += dt; if (q.t > 1.1) { ghosts.splice(i, 1); continue; }
      const k = q.t / 1.1;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(q.x, q.y + k * k * 260); ctx.rotate(k * 4); ctx.scale(1 - k * 0.8, 1 - k * 0.8);
      drawAvatar(ctx, q.avatar, q.color, 0, 0, q.r); ctx.restore();
    }
    // objetos e jogadores ordenados por profundidade
    const items = [];
    const add = (y, fn) => items.push({ y, fn });
    if (g.objects) g.objects(ctx, v, add);
    if (!g.noPlayers) v.players.forEach((p) => {
      if (!(p.f & 1) && !g.drawPlayer) return;
      const deco = (g.deco && g.deco(v, p)) || {};
      if (deco.hidden) return;
      add(p.y, () => (g.drawPlayer ? g.drawPlayer(ctx, p, v.gt) : drawChar(ctx, p, v.gt, deco)));
      if (Q.hi && Math.hypot(p.vx, p.vy) > 200 && Math.random() < 0.5 && !g.drawPlayer) parts.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - 4, vx: -p.vx * 0.1, vy: -20, life: 0.35, max: 0.35, color: p.color, size: 3, g: 0 });
    });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.fn());
    if (g.over) g.over(ctx, v);
    // partículas
    for (let i = rings.length - 1; i >= 0; i--) {
      const q = rings[i]; q.life -= dt; if (q.life <= 0) { rings.splice(i, 1); continue; }
      const k = 1 - q.life / q.maxLife; ctx.strokeStyle = q.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4; glow(ctx, q.color, 20);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r + (q.max - q.r) * k, (q.r + (q.max - q.r) * k) * 0.6, 0, 0, 7); ctx.stroke();
    }
    noGlow(ctx);
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= q.g ? 1 : 0.95;
      ctx.globalAlpha = q.life / q.max; ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    for (let i = texts.length - 1; i >= 0; i--) {
      const q = texts[i]; q.life -= dt; if (q.life <= 0) { texts.splice(i, 1); continue; }
      const pop = q.life > 1.05 ? 1 + (q.life - 1.05) * 4 : 1;
      ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `800 ${q.size * pop}px Orbitron, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = '#05030b'; ctx.strokeText(q.str, q.x, q.y - (1.2 - q.life) * 40);
      ctx.fillStyle = q.color; ctx.fillText(q.str, q.x, q.y - (1.2 - q.life) * 40);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // escuridão (apagão / masmorra)
    const fogCfg = g.fog ? g.fog(v) : (v.mods && v.mods.includes('apagao') && v.game !== 'memory') ? { mine: 190, others: 140 } : null;
    if (fogCfg) {
      if (!fog) { fog = document.createElement('canvas'); fog.width = W / 2; fog.height = H / 2; }
      const f = fog.getContext('2d');
      f.setTransform(0.5, 0, 0, 0.5, 0, 0);
      f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H); f.fillStyle = 'rgba(2,0,8,.96)'; f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = 'destination-out';
      v.players.forEach((p) => {
        if (!(p.f & 1)) return;
        const x = p.x - cam.x, y = p.y - cam.y - 10, rad = p.me ? fogCfg.mine : fogCfg.others;
        const rg = f.createRadialGradient(x, y, rad * 0.35, x, y, rad); rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = rg; f.beginPath(); f.arc(x, y, rad, 0, 7); f.fill();
      });
      ctx.drawImage(fog, 0, 0, W, H);
    }
    if (g.hud) g.hud(ctx, v);
    ctx.restore();
    // bloom: cópia reduzida e borrada somada por cima
    if (Q.hi && glowCtx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      glowCtx.globalCompositeOperation = 'source-over'; glowCtx.clearRect(0, 0, glowCv.width, glowCv.height);
      glowCtx.filter = 'blur(3px) brightness(1.1)'; glowCtx.drawImage(cv, 0, 0, glowCv.width, glowCv.height); glowCtx.filter = 'none';
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.drawImage(glowCv, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    // vinheta e flash
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!vignette) {
      vignette = document.createElement('canvas'); vignette.width = cv.width; vignette.height = cv.height;
      const vc = vignette.getContext('2d'), vg = vc.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.35, cv.width / 2, cv.height / 2, cv.height * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); vc.fillStyle = vg; vc.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.drawImage(vignette, 0, 0);
    if (flashA > 0) { ctx.globalAlpha = flashA; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
  }
  function setQuality(hi) { Q.hi = hi; Q.auto = false; }

  return { setup, resize, frame, burst, ring, text, shake, kick, flash, fall, drawAvatar, avatarCanvas, toWorld, padRects, PADS, local, Q, setQuality, G };
})();
