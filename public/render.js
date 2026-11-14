/* global NC */
// Desenho em canvas: avatares neon, arenas dos 6 minigames, partículas e efeitos.
const R = (() => {
  const { W, H } = NC;
  const PADS = ['#b84dff', '#22e4ff', '#ff2e55', '#c8ff3d'];
  let cv, ctx, scale = 1, ox = 0, oy = 0, dpr = 1;
  const parts = [], texts = [], rings = [];
  let shakeA = 0;
  let fog = null;
  const local = { padFlash: [0, 0, 0, 0] };

  function setup(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); addEventListener('resize', resize); }
  function resize() {
    if (!cv) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr);
    scale = Math.min(w / W, h / H); ox = (w - W * scale) / 2; oy = (h - H * scale) / 2;
  }
  const toWorld = (cx, cy) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale });

  // ---------- utilidades ----------
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function glowLine(c, x1, y1, x2, y2, color, w) {
    c.save(); c.lineCap = 'round';
    c.shadowColor = color; c.shadowBlur = 18; c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.shadowBlur = 0; c.strokeStyle = '#fff'; c.lineWidth = w * 0.35; c.stroke();
    c.restore();
  }
  function burst(x, y, color, n = 18, sp = 260, size = 4, life = 0.7) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: size * (0.5 + Math.random()) });
    }
  }
  function ring(x, y, color, max = 120) { rings.push({ x, y, color, r: 4, max, life: 0.5, maxLife: 0.5 }); }
  function text(x, y, str, color = '#fff', size = 26) { texts.push({ x, y, str, color, size, life: 1.2 }); }
  function shake(a) { shakeA = Math.max(shakeA, a); }

  // ---------- avatares ----------
  function eyes(c, ex, ey, r, kind = 'dot') {
    c.save(); c.fillStyle = '#fff'; c.shadowBlur = 0;
    if (kind === 'dot') { [-1, 1].forEach((s) => { c.beginPath(); c.arc(s * r * 0.3 + ex, -r * 0.08 + ey, r * 0.13, 0, 7); c.fill(); }); }
    if (kind === 'slit') { [-1, 1].forEach((s) => { c.beginPath(); c.ellipse(s * r * 0.3 + ex, -r * 0.05 + ey, r * 0.07, r * 0.19, 0, 0, 7); c.fill(); }); }
    if (kind === 'angry') {
      c.strokeStyle = '#fff'; c.lineWidth = r * 0.12; c.lineCap = 'round';
      [-1, 1].forEach((s) => { c.beginPath(); c.moveTo(s * r * 0.48 + ex, -r * 0.2 + ey); c.lineTo(s * r * 0.14 + ex, -r * 0.02 + ey); c.stroke(); });
    }
    if (kind === 'square') { [-1, 1].forEach((s) => c.fillRect(s * r * 0.3 - r * 0.13 + ex, -r * 0.2 + ey, r * 0.26, r * 0.26)); }
    c.restore();
  }
  function drawAvatar(c, type, color, x, y, r, look = { x: 0, y: 0 }, alpha = 1) {
    c.save();
    c.globalAlpha *= alpha;
    c.translate(x, y);
    const ex = look.x * r * 0.16, ey = look.y * r * 0.16;
    // extras atrás da cabeça
    c.shadowColor = color; c.shadowBlur = r * 0.8; c.fillStyle = color; c.strokeStyle = color;
    if (type === 1) [-1, 1].forEach((s) => { c.beginPath(); c.moveTo(s * r * 0.82, -r * 0.42); c.lineTo(s * r * 0.62, -r * 1.2); c.lineTo(s * r * 0.15, -r * 0.88); c.closePath(); c.fill(); });
    if (type === 2) { c.fillStyle = '#ff2e55'; c.shadowColor = '#ff2e55'; [-1, 1].forEach((s) => { c.beginPath(); c.moveTo(s * r * 0.3, -r * 0.85); c.quadraticCurveTo(s * r * 1.05, -r * 1.05, s * r * 0.95, -r * 1.55); c.quadraticCurveTo(s * r * 0.75, -r * 1.05, s * r * 0.7, -r * 0.6); c.closePath(); c.fill(); }); }
    if (type === 3) { c.lineWidth = r * 0.1; [-1, 1].forEach((s) => { c.beginPath(); c.moveTo(s * r * 0.3, -r * 0.85); c.lineTo(s * r * 0.6, -r * 1.45); c.stroke(); c.beginPath(); c.arc(s * r * 0.6, -r * 1.5, r * 0.16, 0, 7); c.fill(); }); }
    if (type === 6) { c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(0, -r); c.lineTo(0, -r * 1.4); c.stroke(); c.fillStyle = '#ff2e55'; c.beginPath(); c.arc(0, -r * 1.45, r * 0.15, 0, 7); c.fill(); }
    if (type === 7) { c.fillStyle = '#ffd23f'; c.shadowColor = '#ffd23f'; c.beginPath(); c.moveTo(-r * 0.6, -r * 0.75); c.lineTo(-r * 0.65, -r * 1.35); c.lineTo(-r * 0.3, -r * 1.05); c.lineTo(0, -r * 1.5); c.lineTo(r * 0.3, -r * 1.05); c.lineTo(r * 0.65, -r * 1.35); c.lineTo(r * 0.6, -r * 0.75); c.closePath(); c.fill(); }
    if (type === 5) { c.lineWidth = r * 0.14; c.lineCap = 'round'; c.beginPath(); c.moveTo(r * 0.85, -r * 0.3); c.quadraticCurveTo(r * 1.4, -r * 0.2, r * 1.5, r * 0.25); c.moveTo(r * 0.85, -r * 0.25); c.quadraticCurveTo(r * 1.3, r * 0.1, r * 1.2, r * 0.55); c.stroke(); }
    // cabeça
    c.fillStyle = '#0d0718';
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.lineWidth = Math.max(2, r * 0.16); c.strokeStyle = color; c.stroke();
    c.shadowBlur = 0;
    // brilho interno
    const g = c.createRadialGradient(-r * 0.3, -r * 0.4, 0, 0, 0, r);
    g.addColorStop(0, color + '55'); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.92, 0, 7); c.fill();
    // rosto
    c.fillStyle = color; c.shadowColor = color; c.shadowBlur = r * 0.4;
    switch (type) {
      case 0:
        rr(c, -r * 0.66 + ex, -r * 0.32 + ey, r * 1.32, r * 0.44, r * 0.22); c.fill();
        c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(-r * 0.45 + ex, -r * 0.24 + ey, r * 0.38, r * 0.09);
        break;
      case 1: eyes(c, ex, ey, r, 'slit'); break;
      case 2: eyes(c, ex, ey, r, 'angry'); break;
      case 3:
        c.shadowBlur = 0; c.fillStyle = '#fff';
        [-1, 1].forEach((s) => { c.beginPath(); c.ellipse(s * r * 0.32 + ex, -r * 0.05 + ey, r * 0.22, r * 0.14, s * 0.5, 0, 7); c.fill(); });
        break;
      case 4:
        c.shadowBlur = 0; c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, -r * 0.08 + ey, r * 0.38, 0, 7); c.fill();
        c.fillStyle = color; c.beginPath(); c.arc(ex * 1.8, -r * 0.08 + ey * 1.8, r * 0.18, 0, 7); c.fill();
        c.fillStyle = '#0d0718'; c.beginPath(); c.arc(ex * 1.8, -r * 0.08 + ey * 1.8, r * 0.08, 0, 7); c.fill();
        break;
      case 5:
        c.save(); c.beginPath(); c.arc(0, 0, r * 0.95, 0, 7); c.clip(); c.fillRect(-r, -r * 0.55, r * 2, r * 0.3); c.restore();
        c.shadowBlur = 0; c.fillStyle = '#fff'; [-1, 1].forEach((s) => c.fillRect(s * r * 0.3 - r * 0.15 + ex, -r * 0.05 + ey, r * 0.3, r * 0.09));
        break;
      case 6:
        eyes(c, ex, ey, r, 'square');
        c.shadowBlur = 0; c.fillStyle = color; for (let i = -2; i <= 2; i++) c.fillRect(i * r * 0.14 - r * 0.04, r * 0.35, r * 0.08, r * 0.18);
        break;
      case 7: default:
        eyes(c, ex, ey, r, 'dot');
        c.shadowBlur = 0; c.strokeStyle = '#fff'; c.lineWidth = r * 0.09; c.beginPath(); c.arc(ex, r * 0.18 + ey, r * 0.25, 0.2, Math.PI - 0.2); c.stroke();
    }
    c.restore();
  }
  function avatarCanvas(type, color, size = 64) {
    const k = Math.min(2, devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = size * k; c.height = size * k; c.style.width = size + 'px'; c.style.height = size + 'px';
    const g = c.getContext('2d'); g.scale(k, k);
    drawAvatar(g, type, color, size / 2, size * 0.58, size * 0.3);
    return c;
  }

  // ---------- fundo ----------
  function background(c, t, camX = 0) {
    c.fillStyle = '#05030b'; c.fillRect(-50, -50, W + 100, H + 100);
    c.save();
    c.strokeStyle = 'rgba(140, 70, 255, .10)'; c.lineWidth = 1;
    const off = (camX % 40);
    for (let x = -off; x <= W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = (t * 10) % 40; y <= H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.restore();
  }

  // ---------- jogadores ----------
  function drawPlayer(c, p, gt, game, extra) {
    const f = p.f, alive = f & 1, stun = f & 2, jump = f & 4, dash = f & 8, fin = f & 16, inv = f & 64;
    if (!alive) return;
    let r = p.r, y = p.y, alpha = 1;
    if (jump) { r *= 1.3; y -= 14; c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(p.x, p.y + p.r * 0.6, p.r * 0.9, p.r * 0.35, 0, 0, 7); c.fill(); c.restore(); }
    if (inv && Math.floor(gt * 12) % 2) alpha = 0.35;
    if (fin) alpha = 0.55;
    if (dash) {
      c.save(); c.globalAlpha = 0.35; c.fillStyle = p.color;
      for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(p.x - p.vx * 0.012 * k, y - p.vy * 0.012 * k, r * (1 - k * 0.18), 0, 7); c.fill(); }
      c.restore();
    }
    if (extra && extra.holder) {
      c.save(); c.shadowColor = '#ff2e55'; c.shadowBlur = 30; c.strokeStyle = '#ff2e55'; c.lineWidth = 3;
      c.beginPath(); c.arc(p.x, y, r + 6 + Math.sin(gt * 20) * 2, 0, 7); c.stroke(); c.restore();
    }
    const sp = Math.hypot(p.vx, p.vy);
    const look = sp > 20 ? { x: p.vx / sp, y: p.vy / sp } : { x: 0, y: 0 };
    drawAvatar(c, p.avatar, p.color, p.x, y, r, look, alpha);
    if (stun) {
      c.save(); c.fillStyle = '#ffd23f'; c.font = `${Math.max(10, r * 0.6)}px sans-serif`; c.textAlign = 'center';
      for (let k = 0; k < 3; k++) { const a = gt * 6 + k * 2.1; c.fillText('✦', p.x + Math.cos(a) * r * 0.9, y - r * 1.15 + Math.sin(a) * r * 0.3); }
      c.restore();
    }
    // nome
    c.save();
    c.font = `700 ${p.me ? 14 : 12}px "Chakra Petch", sans-serif`; c.textAlign = 'center';
    const ty = y - r - (p.avatar === 2 || p.avatar === 3 || p.avatar === 6 || p.avatar === 7 ? r * 0.75 : r * 0.35) - 8;
    c.fillStyle = 'rgba(0,0,0,.6)'; const tw = c.measureText(p.name).width + 10; rr(c, p.x - tw / 2, ty - 13, tw, 17, 4); c.fill();
    c.fillStyle = p.me ? '#fff' : p.color; c.fillText(p.name, p.x, ty);
    if (p.me) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(p.x - 6, ty - 22); c.lineTo(p.x + 6, ty - 22); c.lineTo(p.x, ty - 15); c.fill(); }
    c.restore();
    if (extra && extra.bomb) drawBomb(c, p.x + r * 0.7, y - r * 0.9, extra.heat, gt);
  }
  function drawBomb(c, x, y, heat, gt) {
    const blink = Math.sin(gt * (6 + heat * 0.25)) > 0;
    c.save();
    c.shadowColor = '#ff2e55'; c.shadowBlur = blink ? 30 : 8;
    c.fillStyle = blink ? '#3a0410' : '#14040a'; c.strokeStyle = '#ff2e55'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 7, y - 9); c.quadraticCurveTo(x + 14, y - 20, x + 20, y - 16); c.stroke();
    c.fillStyle = Math.random() < 0.5 ? '#fff' : '#ffd23f'; c.beginPath(); c.arc(x + 20, y - 16, 3 + Math.random() * 2, 0, 7); c.fill();
    c.restore();
  }

  // ---------- jogos ----------
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
        if (ph > 0.55) segs.push([l.x, 40, l.x, H - 40]);
        else if (ph > 0.3) warn.push([l.x, 40, l.x, H - 40]);
      }
    }
    return { segs, warn };
  }
  function checker(c, x, y, w, h, s) {
    for (let i = 0; i * s < h; i++) for (let j = 0; j * s < w; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#111'; c.fillRect(x + j * s, y + i * s, s, s); }
  }

  function drawLaser(c, v) {
    const I = v.init;
    c.fillStyle = 'rgba(184,77,255,.08)'; c.fillRect(0, 40, 130, H - 80);
    c.strokeStyle = 'rgba(184,77,255,.5)'; c.lineWidth = 2; c.strokeRect(1, 40, W - 2, H - 80);
    c.save(); c.globalAlpha = 0.85; checker(c, I.finishX, 40, 26, H - 80, 13); c.restore();
    c.save(); c.shadowColor = '#22e4ff'; c.shadowBlur = 20; c.fillStyle = '#22e4ff'; c.font = '700 22px Orbitron, sans-serif'; c.textAlign = 'center';
    c.translate(I.finishX + 60, H / 2); c.rotate(Math.PI / 2); c.fillText('CHEGADA', 0, 0); c.restore();
    const { segs, warn } = laserSegments(I.lasers, v.gt);
    warn.forEach((s) => { c.save(); c.setLineDash([8, 10]); c.strokeStyle = 'rgba(255,46,85,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke(); c.restore(); });
    segs.forEach((s) => glowLine(c, s[0], s[1], s[2], s[3], '#ff2e55', 6));
    I.lasers.forEach((l) => {
      c.save(); c.fillStyle = '#2a0b16'; c.strokeStyle = '#ff2e55'; c.lineWidth = 2;
      if (l.t === 'rot') { c.beginPath(); c.arc(l.x, l.y, 9, 0, 7); c.fill(); c.stroke(); }
      else { rr(c, l.x - 9, 28, 18, 14, 3); c.fill(); c.stroke(); rr(c, l.x - 9, H - 42, 18, 14, 3); c.fill(); c.stroke(); }
      c.restore();
    });
  }

  function drawFloor(c, v) {
    const I = v.init, tiles = (v.x && v.x.tiles) || '';
    for (let r = 0; r < I.rows; r++) for (let q = 0; q < I.cols; q++) {
      const i = r * I.cols + q, s = tiles[i];
      if (s === '2') continue;
      let x = I.ox + q * I.size + 3, y = I.oy + r * I.size + 3;
      const w = I.size - 6;
      if (s === '1') { x += (Math.random() - 0.5) * 3; y += (Math.random() - 0.5) * 3; }
      c.save();
      c.fillStyle = s === '1' ? '#2a0814' : ((q + r) % 2 ? '#130a2a' : '#170c33');
      c.shadowColor = s === '1' ? '#ff2e55' : '#4d7cff'; c.shadowBlur = s === '1' ? 18 : 8;
      c.strokeStyle = s === '1' ? (Math.floor(v.gt * 14) % 2 ? '#ff2e55' : '#ff9fb2') : 'rgba(77,124,255,.75)'; c.lineWidth = 2;
      rr(c, x, y, w, w, 8); c.fill(); c.stroke();
      if (s === '1') { c.strokeStyle = 'rgba(255,46,85,.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 10, y + 12); c.lineTo(x + w / 2, y + w / 2); c.lineTo(x + w - 14, y + w - 8); c.moveTo(x + w / 2, y + w / 2); c.lineTo(x + w - 10, y + 16); c.stroke(); }
      c.restore();
    }
  }

  function drawKnockout(c, v) {
    const I = v.init, Rr = (v.x && v.x.R) || 320;
    c.save();
    c.fillStyle = '#0b0620'; c.beginPath(); c.arc(I.cx, I.cy, Rr, 0, 7); c.fill();
    c.strokeStyle = 'rgba(77,124,255,.18)'; c.lineWidth = 1;
    for (let k = 1; k < 6; k++) { c.beginPath(); c.arc(I.cx, I.cy, (Rr * k) / 6, 0, 7); c.stroke(); }
    c.shadowColor = '#22e4ff'; c.shadowBlur = 30; c.strokeStyle = '#22e4ff'; c.lineWidth = 5;
    c.beginPath(); c.arc(I.cx, I.cy, Rr, 0, 7); c.stroke();
    if (Rr > 140) { c.shadowColor = '#ff2e55'; c.strokeStyle = 'rgba(255,46,85,.5)'; c.lineWidth = 2; c.setLineDash([10, 12]); c.beginPath(); c.arc(I.cx, I.cy, Rr + 14, v.gt, v.gt + 7); c.stroke(); }
    c.restore();
  }

  function padRects() {
    const s = 210, gap = 26, x0 = W / 2 - s - gap / 2, y0 = 120;
    return [0, 1, 2, 3].map((i) => ({ i, x: x0 + (i % 2) * (s + gap), y: y0 + Math.floor(i / 2) * (s + gap), s }));
  }
  function drawMemory(c, v) {
    const x = v.x || {}, lit = x.lit >= 0 ? x.lit % 10 : -1;
    const now = performance.now();
    padRects().forEach((p) => {
      const on = lit === p.i || now - local.padFlash[p.i] < 180;
      c.save();
      c.shadowColor = PADS[p.i]; c.shadowBlur = on ? 60 : 12;
      c.fillStyle = on ? PADS[p.i] : PADS[p.i] + '22';
      c.strokeStyle = PADS[p.i]; c.lineWidth = 4;
      rr(c, p.x, p.y, p.s, p.s, 26); c.fill(); c.stroke();
      c.shadowBlur = 0; c.fillStyle = on ? '#0d0718' : PADS[p.i]; c.font = '800 54px Orbitron, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(p.i + 1), p.x + p.s / 2, p.y + p.s / 2 + 2);
      c.restore();
    });
    c.save(); c.textAlign = 'center'; c.font = '700 26px Orbitron, sans-serif';
    const msg = { wait: 'PREPARE-SE…', show: 'MEMORIZE!', input: v.init.reverse ? 'SUA VEZ! (DE TRÁS PRA FRENTE)' : 'SUA VEZ! REPITA A SEQUÊNCIA', reveal: 'RESULTADO DA FASE' }[x.phase] || '';
    c.fillStyle = x.phase === 'input' ? '#c8ff3d' : '#22e4ff'; c.shadowColor = c.fillStyle; c.shadowBlur = 16;
    c.fillText(msg, W / 2, 80);
    c.shadowBlur = 0; c.font = '600 16px "Chakra Petch", sans-serif'; c.fillStyle = '#a99cc9';
    c.fillText(`Fase ${x.level || 1} · ${x.len || 3} cores${x.left ? ` · ${x.left}s` : ''}`, W / 2, 104);
    c.restore();
    if (x.seq) {
      const s = 26, tot = x.seq.length * (s + 6);
      x.seq.forEach((k, i) => { c.fillStyle = PADS[k]; rr(c, W / 2 - tot / 2 + i * (s + 6), 588 - 22, s, s, 6); c.fill(); });
    }
    // status de cada jogador
    const st = x.st || [], n = st.length, bw = Math.min(200, (W - 80) / Math.max(1, n));
    st.forEach(([pn, prog, state, score], k) => {
      const p = v.byN[pn]; if (!p) return;
      const bx = W / 2 - (n * bw) / 2 + k * bw + bw / 2, by = 650;
      drawAvatar(c, p.avatar, p.color, bx - 50, by, 18, { x: 0, y: 0 }, state === 2 ? 0.4 : 1);
      c.save(); c.font = '700 13px "Chakra Petch", sans-serif'; c.fillStyle = p.me ? '#fff' : p.color; c.textAlign = 'left';
      c.fillText(p.name, bx - 26, by - 6);
      c.fillStyle = state === 1 ? '#c8ff3d' : state === 2 ? '#ff2e55' : '#a99cc9';
      c.fillText(state === 1 ? '✓ acertou' : state === 2 ? '✗ errou' : '•'.repeat(prog) || '…', bx - 26, by + 12);
      c.fillStyle = '#ffd23f'; c.fillText(`${score} pts`, bx - 26, by + 28);
      c.restore();
    });
  }

  function drawRace(c, v) {
    const I = v.init, x = v.x || {}, cam = v.cam;
    c.save(); c.translate(-cam, 0);
    // paredes
    I.goo.forEach((g) => {
      c.save(); c.fillStyle = 'rgba(160, 20, 90, .35)'; c.strokeStyle = 'rgba(255,46,130,.5)'; c.lineWidth = 2; rr(c, g[0], g[1], g[2], g[3], 18); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,92,225,.35)'; for (let k = 0; k < 6; k++) { const bx = g[0] + ((k * 53 + v.gt * 20) % g[2]), by = g[1] + ((k * 37) % g[3]); c.beginPath(); c.arc(bx, by, 4 + (k % 3) * 2, 0, 7); c.fill(); }
      c.restore();
    });
    I.boosts.forEach((b) => {
      c.save(); c.fillStyle = 'rgba(34,228,255,.12)'; c.strokeStyle = 'rgba(34,228,255,.7)'; c.lineWidth = 2; rr(c, b[0], b[1], b[2], b[3], 10); c.fill(); c.stroke();
      c.beginPath(); c.rect(b[0], b[1], b[2], b[3]); c.clip(); c.strokeStyle = '#22e4ff'; c.lineWidth = 4; c.shadowColor = '#22e4ff'; c.shadowBlur = 10;
      for (let k = -1; k < b[2] / 30 + 1; k++) { const xx = b[0] + k * 30 + ((v.gt * 120) % 30); c.beginPath(); c.moveTo(xx, b[1] + b[3] * 0.25); c.lineTo(xx + 12, b[1] + b[3] / 2); c.lineTo(xx, b[1] + b[3] * 0.75); c.stroke(); }
      c.restore();
    });
    I.walls.forEach((w) => {
      if (w[0] + w[2] < cam - 50 || w[0] > cam + W + 50) return;
      c.save(); c.fillStyle = '#120828'; c.shadowColor = '#b84dff'; c.shadowBlur = 14; c.strokeStyle = '#b84dff'; c.lineWidth = 2.5;
      rr(c, w[0], w[1], w[2], w[3], 6); c.fill(); c.stroke(); c.restore();
    });
    checker(c, I.finishX, 60, 30, H - 120, 15);
    (x.boxes || []).forEach(([bx, by, on]) => {
      if (!on) return;
      c.save(); c.translate(bx, by); c.rotate(v.gt * 1.5); c.shadowColor = '#22e4ff'; c.shadowBlur = 18; c.strokeStyle = '#22e4ff'; c.fillStyle = 'rgba(34,228,255,.18)'; c.lineWidth = 3;
      rr(c, -16, -16, 32, 32, 6); c.fill(); c.stroke(); c.rotate(-v.gt * 1.5); c.fillStyle = '#fff'; c.font = '800 20px Orbitron'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 1); c.restore();
    });
    (x.mines || []).forEach(([mx, my, armed]) => {
      c.save(); c.fillStyle = '#1a0008'; c.strokeStyle = '#ff2e55'; c.lineWidth = 2; c.shadowColor = '#ff2e55'; c.shadowBlur = armed && Math.floor(v.gt * 6) % 2 ? 24 : 4;
      c.beginPath(); c.arc(mx, my, 11, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#ff2e55'; c.beginPath(); c.arc(mx, my, 4, 0, 7); c.fill(); c.restore();
    });
    c.restore();
  }
  function raceMinimap(c, v) {
    const I = v.init, x0 = 360, x1 = W - 360, y = H - 30;
    c.save(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    checker(c, x1, y - 8, 8, 16, 4);
    v.players.forEach((p) => { const px = x0 + (x1 - x0) * Math.min(1, p.x / I.finishX); c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 8; c.beginPath(); c.arc(px, y, p.me ? 8 : 6, 0, 7); c.fill(); });
    c.restore();
  }

  function drawBombArena(c, v) {
    const I = v.init;
    c.save(); c.strokeStyle = 'rgba(255,46,85,.55)'; c.lineWidth = 3; c.shadowColor = '#ff2e55'; c.shadowBlur = 16; rr(c, 30, 30, W - 60, H - 60, 20); c.stroke(); c.restore();
    I.pillars.forEach(([x, y, r]) => {
      c.save(); c.fillStyle = '#120828'; c.shadowColor = '#b84dff'; c.shadowBlur = 20; c.strokeStyle = '#b84dff'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke(); c.restore();
    });
  }

  // ---------- quadro ----------
  function frame(v, dt) {
    if (!cv) return;
    const w = cv.width / dpr, h = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05030b'; ctx.fillRect(0, 0, w, h);
    shakeA = Math.max(0, shakeA - dt * 30);
    const sx = (Math.random() - 0.5) * shakeA, sy = (Math.random() - 0.5) * shakeA;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx), dpr * (oy + sy));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const cam = v.cam || 0;
    background(ctx, v.gt || 0, cam);
    if (v.game === 'laser') drawLaser(ctx, v);
    if (v.game === 'floor') drawFloor(ctx, v);
    if (v.game === 'knockout') drawKnockout(ctx, v);
    if (v.game === 'memory') drawMemory(ctx, v);
    if (v.game === 'race') drawRace(ctx, v);
    if (v.game === 'bomb') drawBombArena(ctx, v);
    if (v.game !== 'memory') {
      ctx.save(); ctx.translate(-cam, 0);
      v.players.slice().sort((a, b) => a.y - b.y).forEach((p) => drawPlayer(ctx, p, v.gt || 0, v.game, v.extraFor ? v.extraFor(p) : null));
      ctx.restore();
    }
    // partículas
    ctx.save(); ctx.translate(-cam, 0);
    for (let i = rings.length - 1; i >= 0; i--) {
      const q = rings[i]; q.life -= dt; if (q.life <= 0) { rings.splice(i, 1); continue; }
      const k = 1 - q.life / q.maxLife; ctx.strokeStyle = q.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4; ctx.shadowColor = q.color; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r + (q.max - q.r) * k, 0, 7); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94;
      ctx.globalAlpha = q.life / q.max; ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    for (let i = texts.length - 1; i >= 0; i--) {
      const q = texts[i]; q.life -= dt; if (q.life <= 0) { texts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, q.life * 2); ctx.font = `800 ${q.size}px Orbitron, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#05030b'; ctx.strokeText(q.str, q.x, q.y - (1.2 - q.life) * 40);
      ctx.fillStyle = q.color; ctx.fillText(q.str, q.x, q.y - (1.2 - q.life) * 40);
    }
    ctx.restore();
    // apagão
    if (v.mods && v.mods.includes('apagao') && v.game !== 'memory') {
      if (!fog) { fog = document.createElement('canvas'); fog.width = W; fog.height = H; }
      const f = fog.getContext('2d');
      f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H);
      f.fillStyle = 'rgba(0,0,0,.95)'; f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = 'destination-out';
      v.players.forEach((p) => {
        if (!(p.f & 1)) return;
        const x = p.x - cam, y = p.y, rad = p.me ? 190 : 140;
        const rg = f.createRadialGradient(x, y, rad * 0.4, x, y, rad);
        rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = rg; f.beginPath(); f.arc(x, y, rad, 0, 7); f.fill();
      });
      ctx.drawImage(fog, 0, 0);
    }
    if (v.game === 'race') raceMinimap(ctx, v);
    ctx.restore();
  }

  return { setup, resize, frame, burst, ring, text, shake, drawAvatar, avatarCanvas, toWorld, padRects, PADS, local };
})();
