// Teste: N bots jogam um torneio inteiro. Uso: node tools/bots.js [url] [N]
const { io } = require('socket.io-client');
const URL = process.argv[2] || 'http://localhost:3000';
const N = Number(process.argv[3] || 6);
const names = ['Neo', 'Trix', 'Byte', 'Vex', 'Zion', 'Kai'];
let code, rounds = 0, snaps = 0;
const bots = [];
function mk(i) {
  return new Promise((res) => {
    const s = io(URL, { transports: ['websocket'] });
    const b = { s, i, game: null };
    bots.push(b);
    s.on('room', (r) => {
      b.room = r;
      if (i === 0 && r.phase === 'results' && b.lastRes !== r.round) {
        b.lastRes = r.round; rounds++;
        console.log(`Rodada ${r.round + 1}: ${r.cur.game} [${r.cur.mods.join(',')}] →`, r.results.rows.map((x) => `${r.players.find((p) => p.id === x.id).name}:${x.place}º+${x.gained}${x.notes.length ? '(' + x.notes.join(';') + ')' : ''}`).join(' '));
      }
      if (i === 0 && r.phase === 'podium') {
        console.log('PÓDIO:', r.podium.ranking.map((x) => `${r.players.find((p) => p.id === x.id).name} ${x.score}`).join(', '));
        console.log('Conquistas:', r.podium.awards.map((a) => `${a.key}:${r.players.find((p) => p.id === a.id).name} (${a.detail})`).join(' | '));
        console.log('Curiosidades:', r.podium.funny.join(' | '));
        console.log('snaps recebidos pelo bot 0:', snaps);
        process.exit(0);
      }
    });
    s.on('snap', (sn) => {
      if (i === 0) snaps++;
      const g = b.room && b.room.cur && b.room.cur.game;
      if (Math.random() < 0.1) {
        const right = g === 'laser' || g === 'race';
        const inp = { r: right ? Math.random() < 0.85 : Math.random() < 0.5, l: !right && Math.random() < 0.5, u: Math.random() < 0.4, d: Math.random() < 0.4 };
        s.emit('in', inp);
      }
      if (Math.random() < 0.05) s.emit('act');
      if (g === 'memory' && sn.x.phase === 'input' && Math.random() < 0.3) s.emit('pick', Math.floor(Math.random() * 4));
    });
    s.on('connect', () => {
      const cb = (r) => { if (!r.ok) { console.error(r.error); process.exit(1); } code = r.code; res(b); };
      if (i === 0) s.emit('create', { name: names[i] }, cb); else s.emit('join', { code, name: names[i] }, cb);
    });
  });
}
(async () => {
  for (let i = 0; i < N; i++) await mk(i);
  console.log('Sala', code);
  if (process.argv[5]) bots[0].s.emit('rounds', Number(process.argv[5]));
  setTimeout(() => bots[0].s.emit('start'), 300);
  setTimeout(() => { console.log('TEMPO ESGOTADO, rodadas:', rounds); process.exit(1); }, Number(process.argv[4] || 600000));
})();
