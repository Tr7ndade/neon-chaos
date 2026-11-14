/* global io, NC, R */
const { GAMES, MODS, AVATARS, ACHIEVEMENTS, ACH_BONUS, MIN_PLAYERS, MAX_PLAYERS } = NC;
const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DELAY = 110; // ms de atraso de renderização para interpolar

const socket = io({ transports: ['websocket', 'polling'] });
let ST = null;            // estado da sala
let myId = null;
let offset = 0;           // relógio do servidor - relógio local
let bestRtt = 1e9, ping = 0;
let snaps = [];
let lastPhaseKey = '';
let lastLit = -1;
let camX = 0;

// ---------- Som ----------
const Sfx = {
  ctx: null,
  on: (() => { try { return localStorage.getItem('nc_sound') !== '0'; } catch { return true; } })(),
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } } if (this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(f, d = 0.1, type = 'sine', vol = 0.06, when = 0, slide) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.03);
  },
  noise(d = 0.4, vol = 0.12, f = 900) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = f; s.buffer = b; g.gain.value = vol;
    s.connect(fl).connect(g).connect(c.destination); s.start();
  },
  beep(hi) { this.tone(hi ? 1320 : 660, hi ? 0.4 : 0.15, 'square', 0.05); },
  zap() { this.tone(1400, 0.25, 'sawtooth', 0.05, 0, 120); },
  jump() { this.tone(300, 0.18, 'triangle', 0.07, 0, 700); },
  dash() { this.noise(0.18, 0.08, 2500); },
  bump() { this.tone(120, 0.15, 'square', 0.06, 0, 60); },
  fall() { this.tone(600, 0.6, 'sine', 0.07, 0, 60); },
  ko() { this.noise(0.35, 0.14, 1400); this.tone(200, 0.3, 'square', 0.05, 0, 50); },
  boom() { this.noise(0.9, 0.3, 700); this.tone(80, 0.6, 'sine', 0.15, 0, 30); },
  item() { [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.08, 'square', 0.04, i * 0.05)); },
  pass() { this.tone(1000, 0.05, 'square', 0.05); this.tone(700, 0.05, 'square', 0.05, 0.08); },
  finish() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.07, i * 0.09)); },
  fail() { this.tone(180, 0.35, 'sawtooth', 0.06, 0, 90); },
  pad(i) { this.tone([330, 440, 554, 659][i], 0.28, 'triangle', 0.08); },
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'square', 0.04, i * 0.12)); },
  whoosh() { this.tone(200, 0.4, 'sawtooth', 0.03, 0, 1600); },
};
document.addEventListener('pointerdown', () => Sfx.init());
document.addEventListener('keydown', () => Sfx.init());
function syncSound() { document.querySelectorAll('.btnSound').forEach((b) => { b.textContent = Sfx.on ? '🔊' : '🔇'; }); }
document.querySelectorAll('.btnSound').forEach((b) => b.onclick = () => { Sfx.on = !Sfx.on; try { localStorage.setItem('nc_sound', Sfx.on ? '1' : '0'); } catch {} syncSound(); });
syncSound();

// ---------- Sessão e telas ----------
const session = {
  get() { try { return JSON.parse(localStorage.getItem('nc_session')); } catch { return null; } },
  set(v) { try { localStorage.setItem('nc_session', JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem('nc_session'); } catch {} },
};
const savedName = (() => { try { return localStorage.getItem('nc_name') || ''; } catch { return ''; } })();
$('#name').value = savedName;
const urlCode = new URLSearchParams(location.search).get('sala');
if (urlCode) $('#code').value = urlCode.toUpperCase();

function show(id) { ['#home', '#lobby', '#game'].forEach((s) => $(s).classList.toggle('hidden', s !== id)); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 2800); }
function getName() {
  const n = $('#name').value.trim();
  if (!n) { $('#homeErr').textContent = 'Escolha um apelido primeiro.'; $('#name').focus(); return null; }
  try { localStorage.setItem('nc_name', n); } catch {}
  return n;
}
function onJoined(res) {
  if (!res.ok) { $('#homeErr').textContent = res.error; session.clear(); show('#home'); return; }
  myId = res.id;
  session.set({ code: res.code, token: res.token });
  history.replaceState(null, '', '?sala=' + res.code);
}
$('#btnCreate').onclick = () => { const name = getName(); if (name) socket.emit('create', { name }, onJoined); };
$('#btnJoin').onclick = () => {
  const name = getName(), code = $('#code').value.trim().toUpperCase();
  if (!name) return;
  if (code.length !== 4) { $('#homeErr').textContent = 'O código da sala tem 4 letras.'; return; }
  socket.emit('join', { code, name }, onJoined);
};
$('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnJoin').click(); });
$('#name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnCreate').click(); });
$('#btnStart').onclick = () => socket.emit('start');
$('#btnCopy').onclick = async () => {
  const link = location.origin + location.pathname + '?sala=' + ST.code;
  try { await navigator.clipboard.writeText(link); toast('Link copiado! Mande para a galera.'); } catch { prompt('Copie o link:', link); }
};
function leave() { socket.emit('leave'); session.clear(); myId = null; ST = null; history.replaceState(null, '', location.pathname); show('#home'); }
document.querySelectorAll('.btnLeave').forEach((b) => b.onclick = leave);

socket.on('connect', () => {
  const s = session.get();
  if (s && (!urlCode || urlCode.toUpperCase() === s.code)) socket.emit('join', { code: s.code, token: s.token, name: savedName }, onJoined);
});

// ---------- Relógio / ping ----------
function serverNow() { return Date.now() + offset; }
setInterval(() => {
  const t0 = Date.now();
  socket.emit('ping2', t0, (sn) => {
    const rtt = Date.now() - t0;
    ping = rtt;
    if (rtt <= bestRtt * 1.3) { bestRtt = Math.min(bestRtt, rtt); offset = sn + rtt / 2 - Date.now(); }
    $('#ping').textContent = `${rtt} ms`;
  });
}, 2000);

// ---------- Estado da sala ----------
const pByN = () => { const m = {}; (ST ? ST.players : []).forEach((p) => { m[p.n] = p; }); return m; };
const me = () => ST && ST.players.find((p) => p.id === myId);

socket.on('room', (st) => {
  if (bestRtt === 1e9) offset = st.now - Date.now();
  const prev = ST;
  ST = st;
  const key = st.phase + ':' + st.round;
  const changed = key !== lastPhaseKey;
  lastPhaseKey = key;
  if (st.phase === 'lobby') { show('#lobby'); renderLobby(); return; }
  show('#game');
  R.resize();
  $('#intro').classList.toggle('hidden', st.phase !== 'intro');
  $('#results').classList.toggle('hidden', st.phase !== 'results');
  $('#podium').classList.toggle('hidden', st.phase !== 'podium');
  $('#hud').classList.toggle('hidden', st.phase !== 'play');
  if (changed) {
    if (st.phase === 'intro') { snaps = []; renderIntro(); Sfx.whoosh(); }
    $('#game').classList.toggle('memory', st.phase === 'play' && st.cur && st.cur.game === 'memory');
    if (st.phase === 'play') { snaps = []; lastLit = -1; camX = 0; R.local.padFlash = [0, 0, 0, 0]; renderHudStatic(); }
    if (st.phase === 'results') renderResults();
    if (st.phase === 'podium') { renderPodium(); Sfx.win(); }
  } else if (st.phase === 'podium') renderPodiumButtons();
  renderScores();
  if (prev && prev.phase === 'play' && st.phase !== 'play') sendInput(true);
});

socket.on('chat', (m) => {
  if (!ST) return;
  ST.chat = (ST.chat || []).concat(m).slice(-40);
  renderChat();
});

// ---------- Lobby ----------
function renderLobby() {
  $('#lobbyCode').textContent = ST.code;
  const list = $('#lobbyPlayers'); list.innerHTML = '';
  for (let k = 0; k < MAX_PLAYERS; k++) {
    const p = ST.players[k];
    const li = el('div', 'slot' + (p ? '' : ' empty'));
    if (p) {
      li.style.setProperty('--c', p.color);
      li.appendChild(R.avatarCanvas(p.avatar, p.color, 64));
      li.appendChild(el('div', 'sname', `${esc(p.name)}${p.id === myId ? ' <small>(você)</small>' : ''}`));
      li.appendChild(el('div', 'stag', `${p.id === ST.hostId ? '👑 anfitrião' : AVATARS[p.avatar]}${!p.connected ? ' · offline' : ''}`));
    } else li.appendChild(el('div', 'sname', 'vaga livre'));
    list.appendChild(li);
  }
  const mine = me();
  const pick = $('#avatarPick'); pick.innerHTML = '';
  AVATARS.forEach((name, a) => {
    const b = el('button', 'av' + (mine && mine.avatar === a ? ' on' : ''));
    b.appendChild(R.avatarCanvas(a, mine ? mine.color : '#b84dff', 56));
    b.appendChild(el('span', '', name));
    b.onclick = () => socket.emit('avatar', a);
    pick.appendChild(b);
  });
  const host = ST.hostId === myId, n = ST.players.length;
  $('#btnStart').classList.toggle('hidden', !host);
  $('#btnStart').disabled = n < MIN_PLAYERS;
  $('#lobbyInfo').innerHTML = `${n}/${MAX_PLAYERS} jogadores · ideal: 5 ou 6. ` +
    (host ? (n < MIN_PLAYERS ? 'Esperando mais gente…' : 'Inicie quando todos estiverem prontos.') : 'Esperando o anfitrião iniciar…');
  renderChat();
}

// ---------- Chat (lobby e pódio) ----------
function renderChat() {
  document.querySelectorAll('.chatMsgs').forEach((box) => {
    box.innerHTML = '';
    const byN = pByN();
    (ST.chat || []).forEach((m) => {
      const p = byN[m.n];
      const d = el('div'); d.innerHTML = `<b style="color:${p ? p.color : '#fff'}">${esc(m.name)}</b> ${esc(m.text)}`;
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  });
}
document.querySelectorAll('.chatForm').forEach((f) => f.onsubmit = (e) => {
  e.preventDefault();
  const i = f.querySelector('input'); const v = i.value.trim();
  if (v) socket.emit('chat', v);
  i.value = '';
});

// ---------- Apresentação da rodada ----------
function modCard(m, game) {
  const M = MODS[m];
  const desc = game === 'memory' && M.mem ? M.mem : M.desc;
  return `<div class="mod"><div class="mi">${M.icon}</div><div><b>${M.name}</b><p>${desc}</p></div></div>`;
}
function renderIntro() {
  const c = ST.cur, G = GAMES[c.game];
  $('#intro').innerHTML = `
    <div class="intro-card ${c.final ? 'final' : ''}">
      <div class="round">RODADA ${ST.round + 1} / ${ST.total} · ${esc(c.label)}</div>
      <h1 class="glitch" data-t="${G.name}">${G.name}</h1>
      <div class="gtag">${G.tag}</div>
      <p class="gdesc">${G.desc}</p>
      <div class="controls">🎮 ${G.controls}</div>
      ${c.mods.length ? `<div class="modhead">⚠ EVENTO ALEATÓRIO</div><div class="mods">${c.mods.map((m) => modCard(m, c.game)).join('')}</div>` : ''}
      <div class="count" id="introCount"></div>
    </div>`;
}
let lastBeep = 0;
setInterval(() => {
  if (!ST) return;
  const left = Math.max(0, Math.ceil((ST.phaseEnd - serverNow()) / 1000));
  if (ST.phase === 'intro') {
    const c = $('#introCount');
    if (c) {
      c.textContent = left <= 3 ? (left || 'VAI!') : `começa em ${left}s`;
      c.classList.toggle('big', left <= 3);
      if (left <= 3 && left !== lastBeep) { lastBeep = left; Sfx.beep(left === 0); }
    }
  }
  if (ST.phase === 'results') { const c = $('#resCount'); if (c) c.textContent = ST.round + 1 >= ST.total ? `Pódio em ${left}s` : `Próxima rodada em ${left}s`; }
}, 200);

// ---------- Resultado ----------
const medal = (k) => ['🥇', '🥈', '🥉'][k - 1] || `${k}º`;
function renderResults() {
  const r = ST.results, byId = Object.fromEntries(ST.players.map((p) => [p.id, p]));
  const rows = r.rows.slice().sort((a, b) => a.place - b.place);
  $('#results').innerHTML = `<div class="panel res">
    <div class="round">RESULTADO · ${GAMES[r.game].name}</div>
    <div class="rows"></div>
    <div class="muted" id="resCount"></div></div>`;
  const box = $('#results .rows');
  rows.forEach((x, k) => {
    const p = byId[x.id]; if (!p) return;
    const row = el('div', 'rrow' + (x.id === myId ? ' me' : ''));
    row.style.setProperty('--c', p.color); row.style.animationDelay = k * 0.12 + 's';
    row.appendChild(el('div', 'rplace', medal(x.place)));
    row.appendChild(R.avatarCanvas(p.avatar, p.color, 44));
    const det = [x.bonus ? `+${x.bonus} KO` : '', x.mult > 1 ? `×${x.mult}` : '', ...x.notes].filter(Boolean).join(' · ');
    row.appendChild(el('div', 'rname', `${esc(p.name)}${det ? `<small>${esc(det)}</small>` : ''}`));
    row.appendChild(el('div', 'rgain', `+${x.gained}`));
    row.appendChild(el('div', 'rtotal', `${x.total}`));
    box.appendChild(row);
  });
  const mine = rows.find((x) => x.id === myId);
  if (mine && mine.place === 1) Sfx.finish(); else Sfx.beep(false);
}

// ---------- Pódio ----------
function renderPodium() {
  const P = ST.podium, byId = Object.fromEntries(ST.players.map((p) => [p.id, p]));
  const top = P.ranking.slice(0, 3);
  const order = [1, 0, 2].filter((k) => top[k]);
  $('#podium').innerHTML = `<div class="panel pod">
    <div class="round">FIM DO TORNEIO</div>
    <h1 class="glitch" data-t="PÓDIO">PÓDIO</h1>
    <div class="stands"></div>
    <div class="podcols">
      <div><h3>Conquistas <small>(+${ACH_BONUS} pts cada)</small></h3><div class="awards"></div></div>
      <div><h3>Ranking final</h3><div class="final"></div><h3>Curiosidades</h3><div class="funny"></div></div>
      <div class="chatbox"><h3>Chat</h3><div class="chatMsgs"></div><form class="chatForm"><input maxlength="140" placeholder="GG!"><button>➤</button></form></div>
    </div>
    <div class="podbtns"></div></div>`;
  const stands = $('#podium .stands');
  order.forEach((k) => {
    const x = top[k], p = byId[x.id]; if (!p) return;
    const s = el('div', `stand s${k + 1}`);
    s.style.setProperty('--c', p.color);
    s.appendChild(R.avatarCanvas(p.avatar, p.color, k === 0 ? 96 : 76));
    s.appendChild(el('div', 'pn', esc(p.name)));
    s.appendChild(el('div', 'ps', `${x.score} pts`));
    s.appendChild(el('div', 'block', `<span>${k + 1}</span>`));
    stands.appendChild(s);
  });
  const aw = $('#podium .awards');
  if (!P.awards.length) aw.innerHTML = '<p class="muted">Ninguém se destacou dessa vez.</p>';
  P.awards.forEach((a) => {
    const A = ACHIEVEMENTS[a.key], p = byId[a.id]; if (!p) return;
    aw.appendChild(el('div', 'award', `<div class="ai">${A.icon}</div><div><b>${A.name}</b> · <span style="color:${p.color}">${esc(p.name)}</span><small>${esc(a.detail)}</small></div>`));
  });
  const fin = $('#podium .final');
  P.ranking.forEach((x, k) => { const p = byId[x.id]; if (p) fin.appendChild(el('div', 'frow', `<span>${k + 1}º</span><b style="color:${p.color}">${esc(p.name)}</b><span>${x.score}</span>`)); });
  const fu = $('#podium .funny');
  if (!P.funny.length) fu.innerHTML = '<p class="muted">Partida comportada demais.</p>';
  P.funny.forEach((t) => fu.appendChild(el('p', '', esc(t))));
  document.querySelectorAll('#podium .chatForm').forEach((f) => f.onsubmit = (e) => { e.preventDefault(); const i = f.querySelector('input'); if (i.value.trim()) socket.emit('chat', i.value.trim()); i.value = ''; });
  renderChat();
  renderPodiumButtons();
  confetti();
}
function renderPodiumButtons() {
  const b = $('#podium .podbtns'); if (!b) return;
  b.innerHTML = '';
  if (ST.hostId === myId) { const x = el('button', 'primary', '↻ Jogar de novo'); x.onclick = () => socket.emit('again'); b.appendChild(x); }
  else b.appendChild(el('span', 'muted', 'Esperando o anfitrião decidir se tem revanche…'));
  const l = el('button', 'ghost', 'Sair'); l.onclick = leave; b.appendChild(l);
}
function confetti() {
  const colors = ['#b84dff', '#22e4ff', '#ff2e55', '#4d7cff', '#ff5ce1', '#c8ff3d'];
  for (let i = 0; i < 80; i++) {
    const c = el('div', 'confetti'); c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
    c.style.animationDuration = 2.5 + Math.random() * 2.5 + 's'; c.style.animationDelay = Math.random() * 1.2 + 's';
    $('#podium').appendChild(c); setTimeout(() => c.remove(), 6000);
  }
}

// ---------- HUD ----------
function renderHudStatic() {
  const c = ST.cur, G = GAMES[c.game];
  $('#hudRound').textContent = `RODADA ${ST.round + 1}/${ST.total}${c.final ? ' · FINAL ×2' : ''}`;
  $('#hudGame').textContent = G.name;
  $('#hudMods').innerHTML = c.mods.map((m) => `<span class="chip">${MODS[m].icon} ${MODS[m].name}</span>`).join('');
  $('#hudHelp').textContent = G.controls;
  $('#hudItem').classList.add('hidden');
}
function renderScores() {
  const box = $('#hudScores'); if (!box || !ST) return;
  const sorted = ST.players.slice().sort((a, b) => b.score - a.score), mi = sorted.findIndex((p) => p.id === myId);
  if (mi >= 0) $('#hudRank').textContent = `Você: ${mi + 1}º · ${sorted[mi].score} pts · TAB = placar`;
  box.innerHTML = '';
  ST.players.slice().sort((a, b) => b.score - a.score).forEach((p) => {
    const d = el('div', 'sc' + (p.id === myId ? ' me' : '') + (!p.connected ? ' off' : ''));
    d.style.setProperty('--c', p.color);
    d.appendChild(R.avatarCanvas(p.avatar, p.color, 28));
    d.appendChild(el('span', 'scn', esc(p.name)));
    d.appendChild(el('b', '', p.score));
    box.appendChild(d);
  });
}

// ---------- Entrada (teclado e mouse) ----------
const keys = { u: false, d: false, l: false, r: false };
const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
let sentKeys = '';
function sendInput(force) {
  const k = JSON.stringify(keys);
  if (k === sentKeys && !force) return;
  sentKeys = k;
  socket.emit('in', keys);
}
function typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }
addEventListener('keydown', (e) => {
  if (typing() || !ST || ST.phase !== 'play') return;
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; sendInput(); e.preventDefault(); }
  if ((e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'KeyJ') && !e.repeat) { socket.emit('act'); e.preventDefault(); }
  const d = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
  if (d != null && !e.repeat && ST.cur.game === 'memory') pickPad(d);
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; sendInput(); } if (e.code === 'Tab') $('#game').classList.remove('tab'); });
addEventListener('keydown', (e) => { if (e.code === 'Tab' && ST && ST.phase !== 'lobby') { e.preventDefault(); $('#game').classList.add('tab'); } });
addEventListener('blur', () => { keys.u = keys.d = keys.l = keys.r = false; sendInput(); $('#game').classList.remove('tab'); });
function pickPad(i) {
  const last = snaps[snaps.length - 1];
  if (!last || !last.x || last.x.phase !== 'input') return;
  R.local.padFlash[i] = performance.now();
  Sfx.pad(i);
  socket.emit('pick', i);
}
$('#cv').addEventListener('pointerdown', (e) => {
  if (!ST || ST.phase !== 'play' || ST.cur.game !== 'memory') return;
  const r = $('#cv').getBoundingClientRect(), w = R.toWorld(e.clientX - r.left, e.clientY - r.top);
  const pad = R.padRects().find((p) => w.x > p.x && w.x < p.x + p.s && w.y > p.y && w.y < p.y + p.s);
  if (pad) pickPad(pad.i);
});

// ---------- Snapshots e eventos ----------
socket.on('snap', (s) => {
  if (!ST || ST.phase !== 'play') return;
  snaps.push(s);
  if (snaps.length > 40) snaps.splice(0, snaps.length - 40);
  $('#hudInfo').textContent = s.hud || '';
  s.ev.forEach(handleEvent);
});

function posOf(n) {
  const last = snaps[snaps.length - 1]; if (!last) return { x: 640, y: 360 };
  const p = last.p.find((q) => q[0] === n);
  return p ? { x: p[1], y: p[2] } : { x: 640, y: 360 };
}
function handleEvent(ev) {
  const byN = pByN(), my = me(), isMe = my && ev.n === my.n, P = byN[ev.n];
  const col = P ? P.color : '#fff';
  const at = ev.x != null ? { x: ev.x, y: ev.y } : posOf(ev.n);
  switch (ev.k) {
    case 'zap': R.burst(at.x, at.y, '#ff2e55', 22, 300); if (isMe) { R.shake(10); R.text(at.x, at.y - 30, 'ZAP!', '#ff2e55'); } Sfx.zap(); break;
    case 'finish': R.text(at.x - 60, at.y - 30, `${ev.place}º!`, col, 34); R.burst(at.x, at.y, col, 30, 300); if (isMe) Sfx.finish(); else Sfx.beep(false); break;
    case 'fall': R.burst(at.x, at.y, col, 26, 200, 5, 1); R.ring(at.x, at.y, col, 90); if (isMe) { R.text(at.x, at.y - 30, 'CAIU!', '#ff2e55'); R.shake(8); } Sfx.fall(); break;
    case 'jump': if (isMe) Sfx.jump(); break;
    case 'dash': if (isMe) Sfx.dash(); break;
    case 'bump': R.ring(at.x, at.y, '#fff', 60); Sfx.bump(); R.shake(4); break;
    case 'ko': {
      R.burst(at.x, at.y, col, 40, 380, 6, 1); R.shake(12); R.text(at.x, at.y - 20, 'KO!', '#ff2e55', 38); Sfx.ko();
      if (my && ev.by === my.n) R.text(at.x, at.y + 30, '+20', '#c8ff3d', 28);
      break;
    }
    case 'memok': if (isMe) Sfx.tone(1200, 0.05, 'square', 0.03); break;
    case 'memdone': if (isMe) { Sfx.finish(); R.text(640, 560, `CERTO! ${ev.order}º`, '#c8ff3d', 34); } break;
    case 'memfail': if (isMe) { Sfx.fail(); R.text(640, 560, 'ERROU!', '#ff2e55', 34); R.shake(8); } break;
    case 'turbo': R.burst(at.x, at.y, '#22e4ff', 20, 250); if (isMe) Sfx.whoosh(); break;
    case 'item':
      if (isMe) { Sfx.item(); R.text(at.x, at.y - 30, { turbo: '⚡ TURBO', mina: '💣 MINA', choque: '⚡ CHOQUE' }[ev.item], '#22e4ff', 22); }
      break;
    case 'mine': if (isMe) Sfx.bump(); break;
    case 'shock': R.ring(at.x, at.y, '#22e4ff', 240); R.burst(at.x, at.y, '#22e4ff', 30, 400); Sfx.zap(); R.shake(6); break;
    case 'pass': R.ring(at.x, at.y, '#ff2e55', 70); R.text(at.x, at.y - 34, 'PASSOU!', '#ff2e55', 22); Sfx.pass(); break;
    case 'newbomb': R.text(at.x, at.y - 40, isMe ? 'A BOMBA É SUA!' : 'BOMBA!', '#ff2e55', isMe ? 30 : 22); Sfx.pass(); break;
    case 'boom':
      if (ev.small) { R.burst(at.x, at.y, '#ff9f1c', 26, 280); R.ring(at.x, at.y, '#ff2e55', 80); Sfx.ko(); R.shake(6); }
      else { R.burst(at.x, at.y, '#ff2e55', 70, 520, 7, 1.2); R.burst(at.x, at.y, '#ffd23f', 40, 380, 5, 1); R.ring(at.x, at.y, '#ff9f1c', 260); R.shake(22); Sfx.boom(); if (isMe) R.text(at.x, at.y - 40, 'BOOM! VOCÊ ESTÁ FORA', '#ff2e55', 26); }
      break;
  }
}

// ---------- Loop de renderização ----------
function interp() {
  if (!snaps.length) return null;
  const rt = serverNow() - DELAY;
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) { if (snaps[i - 1].st <= rt) { a = snaps[i - 1]; b = snaps[i]; break; } }
  const span = b.st - a.st || 1;
  const k = Math.max(0, Math.min(1, (rt - a.st) / span));
  const byN = pByN(), my = me();
  const am = {}; a.p.forEach((q) => { am[q[0]] = q; });
  const players = b.p.map((q) => {
    const o = am[q[0]] || q, info = byN[q[0]] || { name: '?', color: '#fff', avatar: 0 };
    const x = o[1] + (q[1] - o[1]) * k, y = o[2] + (q[2] - o[2]) * k;
    return { n: q[0], x, y, r: q[3], f: k < 0.5 ? o[4] : q[4], vx: ((q[1] - o[1]) / span) * 1000, vy: ((q[2] - o[2]) / span) * 1000, name: info.name, color: info.color, avatar: info.avatar, me: my && info.id === my.id };
  });
  return { gt: a.gt + (b.gt - a.gt) * k, players, x: b.x, latest: snaps[snaps.length - 1] };
}
let lastT = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (ST && ST.phase !== 'lobby' && !$('#game').classList.contains('hidden')) {
    const it = ST.phase === 'play' ? interp() : null;
    const init = ST.init || {};
    const v = { game: ST.phase === 'play' ? ST.cur.game : null, init, mods: ST.cur ? ST.cur.mods : [], gt: it ? it.gt : t / 1000, players: it ? it.players : [], x: it ? it.x : null, byN: pByN(), cam: 0 };
    if (it && v.game === 'race') {
      const mp = it.players.find((p) => p.me) || it.players[0];
      const target = Math.max(0, Math.min((init.len || 1280) - 1280, (mp ? mp.x : 0) - 420));
      camX += (target - camX) * Math.min(1, dt * 6);
      v.cam = camX;
      const mine = it.x && it.x.items && it.x.items.find((q) => me() && q[0] === me().n);
      const slot = $('#hudItem');
      if (mine && mine[1]) { slot.classList.remove('hidden'); slot.innerHTML = `${{ turbo: '⚡ TURBO', mina: '💣 MINA', choque: '🌀 CHOQUE' }[mine[1]]} <small>ESPAÇO para usar</small>`; }
      else slot.classList.add('hidden');
    }
    if (it && v.game === 'bomb') v.extraFor = (p) => ({ bomb: it.x.h === p.n, holder: it.x.h === p.n, heat: it.x.heat || 0 });
    if (it && v.game === 'memory' && it.latest.x) {
      const lit = it.latest.x.lit;
      if (lit !== lastLit) { lastLit = lit; if (lit >= 0) Sfx.pad(lit % 10); }
      v.x = it.latest.x;
    }
    if (it && ST.init) {
      const left = Math.max(0, ST.init.max - it.latest.gt);
      const tm = $('#hudTimer');
      tm.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      tm.classList.toggle('low', left < 10);
    }
    R.frame(v, dt);
  }
  requestAnimationFrame(loop);
}
R.setup($('#cv'));
requestAnimationFrame(loop);
