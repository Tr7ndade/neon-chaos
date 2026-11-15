const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { Room } = require('./room');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

const rooms = new Map();
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}
const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Jogador';

io.on('connection', (socket) => {
  let room = null, me = null;

  function bind(r, p) {
    room = r; me = p;
    p.connected = true; p.socketId = socket.id;
    socket.join(r.code);
  }

  socket.on('create', ({ name } = {}, cb) => {
    if (typeof cb !== 'function' || room) return;
    const code = newCode();
    const r = new Room(code, io);
    rooms.set(code, r);
    const id = crypto.randomUUID(), token = crypto.randomUUID();
    r.addPlayer(id, token, cleanName(name));
    bind(r, r.player(id));
    cb({ ok: true, code, id, token });
    r.emitRoom();
  });

  socket.on('join', ({ code, name, token } = {}, cb) => {
    if (typeof cb !== 'function' || room) return;
    code = String(code || '').toUpperCase().trim();
    const r = rooms.get(code);
    if (!r) return cb({ ok: false, error: 'Sala não encontrada.' });
    const existing = token && r.players.find((p) => p.token === token);
    if (existing) { bind(r, existing); cb({ ok: true, code, id: existing.id, token }); return r.emitRoom(); }
    const id = crypto.randomUUID(), tok = crypto.randomUUID();
    const err = r.addPlayer(id, tok, cleanName(name));
    if (err) return cb({ ok: false, error: err });
    bind(r, r.player(id));
    cb({ ok: true, code, id, token: tok });
    r.emitRoom();
  });

  socket.on('rounds', (n) => { if (room && me) { room.setRounds(me.id, Number(n)); room.emitRoom(); } });
  socket.on('avatar', (a) => { if (room && me) { room.setAvatar(me.id, Number(a)); room.emitRoom(); } });
  socket.on('start', () => { if (room && me) room.start(me.id); });
  socket.on('again', () => { if (room && me) room.again(me.id); });
  socket.on('in', (i) => { if (room && me && i && typeof i === 'object') room.input(me.id, i); });
  socket.on('act', () => { if (room && me) room.action(me.id); });
  socket.on('pick', (v) => { if (room && me) room.pick(me.id, v); });
  socket.on('ping2', (t, cb) => { if (typeof cb === 'function') cb(Date.now()); });
  socket.on('chat', (text) => {
    if (!room || !me) return;
    text = String(text || '').trim().slice(0, 140);
    if (!text) return;
    room.chat.push({ t: Date.now(), n: me.n, name: me.name, text });
    if (room.chat.length > 60) room.chat.shift();
    io.to(room.code).emit('chat', { t: Date.now(), n: me.n, name: me.name, text });
  });

  socket.on('leave', () => {
    if (!room || !me) return;
    const r = room, p = me;
    room = null; me = null;
    socket.leave(r.code);
    if (r.phase === 'lobby') r.removePlayer(p.id);
    else p.connected = false;
    r.emitRoom();
  });

  socket.on('disconnect', () => {
    if (!room || !me || me.socketId !== socket.id) return;
    const r = room, p = me;
    p.connected = false;
    p.inp = {};
    if (r.game) r.game.input(p.id, {});
    if (r.phase === 'lobby') {
      setTimeout(() => { if (!p.connected && r.phase === 'lobby') { r.removePlayer(p.id); r.emitRoom(); } }, 20000);
    }
    r.emitRoom();
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    const empty = r.players.every((p) => !p.connected);
    if ((empty && now - r.lastActive > 10 * 60e3) || now - r.lastActive > 3 * 3600e3) { r.stop(); rooms.delete(code); }
  }
}, 60e3);

server.listen(PORT, () => console.log(`NEON CHAOS rodando em http://localhost:${PORT}`));
