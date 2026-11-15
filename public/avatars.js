/* Avatares neon (cabeças) desenhados em canvas. */
const AV = (() => {
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
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

  return { drawAvatar, avatarCanvas, rr };
})();
