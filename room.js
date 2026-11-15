// Sala + torneio: lobby → 5 rodadas (apresentação, jogo, resultado) → pódio.
const { GAMES, MODS, TABLE, ROUND_OPTIONS, ROUND_TIME, FINAL_TIME, COLORS, AVATARS, ACHIEVEMENTS, ACH_BONUS, MIN_PLAYERS, MAX_PLAYERS } = require('./public/shared');
const { GAME_CLASSES: G1 } = require('./games');
const { GAME_CLASSES2: G2 } = require('./games2');
const GAME_CLASSES = { ...G1, ...G2 };

const TICK_HZ = 60;
const SPEED = Number(process.env.NC_SPEED || 1); // só para testes
const SNAP_EVERY = 3;   // 20 snapshots por segundo
const INTRO_S = 7;
const RESULTS_S = 8;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

class Room {
  constructor(code, io) {
    this.code = code;
    this.io = io;
    this.players = [];
    this.hostId = null;
    this.phase = 'lobby'; // lobby | intro | play | results | podium
    this.round = -1;
    this.plan = [];
    this.game = null;
    this.phaseEnd = 0;
    this.results = null;
    this.podium = null;
    this.timer = null;
    this.loop = null;
    this.tickN = 0;
    this.lastActive = Date.now();
    this.chat = [];
    this.rounds = 5;
  }

  player(id) { return this.players.find((p) => p.id === id); }

  addPlayer(id, token, name) {
    if (this.phase !== 'lobby') return 'O torneio já começou. Espere a próxima partida.';
    if (this.players.length >= MAX_PLAYERS) return 'Sala cheia (máximo de 6 jogadores).';
    const usedN = this.players.map((p) => p.n);
    const n = [0, 1, 2, 3, 4, 5].find((k) => !usedN.includes(k));
    const usedA = this.players.map((p) => p.avatar);
    this.players.push({
      id, token, n, name, color: COLORS[n], avatar: [0, 1, 2, 3, 4, 5, 6, 7].find((a) => !usedA.includes(a)) ?? 0,
      score: 0, connected: true, socketId: null, stats: {}, inp: {},
    });
    if (!this.hostId) this.hostId = id;
    return null;
  }
  removePlayer(id) {
    this.players = this.players.filter((p) => p.id !== id);
    if (this.hostId === id) this.hostId = this.players[0] ? this.players[0].id : null;
  }
  setRounds(id, n) {
    if (id === this.hostId && this.phase === 'lobby' && ROUND_OPTIONS.includes(n)) this.rounds = n;
  }
  setAvatar(id, a) {
    const p = this.player(id);
    if (p && this.phase === 'lobby' && Number.isInteger(a) && a >= 0 && a < AVATARS.length) p.avatar = a;
  }

  // ---------- estatísticas ----------
  addStat(id, k, v = 1) { const p = this.player(id); if (p) p.stats[k] = (p.stats[k] || 0) + v; }
  bestTime(id, t) { const p = this.player(id); if (p && (p.stats.bestTime == null || t < p.stats.bestTime)) p.stats.bestTime = t; }
  bestMemory(id, t) { const p = this.player(id); if (p && (p.stats.bestMem == null || t < p.stats.bestMem)) p.stats.bestMem = t; }

  // ---------- fluxo do torneio ----------
  start(byId) {
    if (byId !== this.hostId || this.phase !== 'lobby' || this.players.length < MIN_PLAYERS) return;
    this.players.forEach((p) => { p.score = 0; p.stats = {}; p.streak = 0; });
    const N = this.rounds;
    const modKeys = Object.keys(MODS);
    const games = shuffle(Object.keys(GAMES)).slice(0, N);
    const special = N >= 3 ? 1 + Math.floor(Math.random() * (N - 2)) : -1; // rodada com 2 eventos
    this.plan = games.map((game, i) => {
      const final = i === N - 1, first = i === 0;
      const nMods = first || final ? 0 : i === special ? 2 : 1;
      const ok = modKeys.filter((m) => !(game === 'memory' && MODS[m].movement) && !(game === 'dungeon' && m === 'apagao'));
      const mods = [];
      for (const m of shuffle(ok.slice())) {
        if (mods.length >= nMods) break;
        if ((m === 'gigantes' && mods.includes('nanicos')) || (m === 'nanicos' && mods.includes('gigantes'))) continue;
        mods.push(m);
      }
      const label = first ? 'Aquecimento' : final ? 'FINAL · pontos em dobro' : i === special ? 'Evento especial' : `Rodada ${i + 1}`;
      return { game, mods, final, time: final ? FINAL_TIME : ROUND_TIME, label };
    });
    // ganchos de teste (variáveis de ambiente); em produção não são usados
    if (process.env.NC_ORDER) process.env.NC_ORDER.split(',').forEach((g, i) => { if (this.plan[i] && GAMES[g]) this.plan[i].game = g; });
    if (process.env.NC_MODS) process.env.NC_MODS.split(';').forEach((m, i) => { if (this.plan[i]) this.plan[i].mods = m ? m.split(',') : []; });
    if (process.env.NC_MAXT) this.plan.forEach((p) => { p.time = Number(process.env.NC_MAXT); });
    this.round = -1;
    this.nextRound();
  }

  nextRound() {
    this.round++;
    if (this.round >= this.plan.length) return this.toPodium();
    this.phase = 'intro';
    this.results = null;
    this.setPhaseTimer(INTRO_S / SPEED, () => this.beginPlay());
    this.emitRoom();
  }

  beginPlay() {
    const r = this.plan[this.round];
    const Cls = GAME_CLASSES[r.game];
    const ids = this.players.map((p) => p.id);
    this.standingBefore = this.players.slice().sort((a, b) => b.score - a.score).map((p) => p.id);
    this.game = new Cls(this, ids, r.mods, r.time);
    this.players.forEach((p) => { if (p.inp) this.game.input(p.id, p.inp); });
    this.phase = 'play';
    this.gameStart = Date.now();
    this.phaseEnd = this.gameStart + this.game.maxTime * 1000;
    this.emitRoom();
    clearInterval(this.loop);
    let last = Date.now();
    this.loop = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      for (let k = 1; k < SPEED; k++) { try { this.step(dt, true); } catch (e) {} if (!this.game) return; }
      last = now;
      try { this.step(dt); } catch (e) { console.error(e); this.endRound(); }
    }, 1000 / TICK_HZ);
  }

  step(dt, silent) {
    const g = this.game;
    if (!g) return;
    g.t += dt;
    g.tick(dt);
    this.tickN++;
    const over = g.over();
    if ((!silent && this.tickN % SNAP_EVERY === 0) || over) {
      this.io.to(this.code).volatile.emit('snap', {
        st: Date.now(), gt: +g.t.toFixed(3), p: g.snapPlayers(), x: g.snap(), ev: g.events, hud: g.hud(),
      });
      g.events = [];
    }
    if (over) this.endRound();
  }

  endRound() {
    clearInterval(this.loop);
    this.loop = null;
    const g = this.game, r = this.plan[this.round];
    if (!g) return;
    this.game = null;
    const groups = g.ranking().map((grp) => grp.filter((id) => this.player(id)));
    const before = this.standingBefore || [];
    const half = Math.floor(this.players.length / 2);
    const bottomHalf = new Set(before.slice(before.length - half));
    const res = [];
    let place = 0;
    for (const grp of groups) {
      if (!grp.length) continue;
      const base = TABLE[place] ?? 5;
      for (const id of grp) {
        const p = this.player(id);
        const bonus = g.bonus(id);
        let mult = r.final ? 2 : 1;
        if (r.mods.includes('azarao') && bottomHalf.has(id)) mult *= 2;
        const gained = (base + bonus) * mult;
        p.score += gained;
        res.push({ id, place: place + 1, base, bonus, mult, gained, notes: [] });
        // sequência de vitórias e azarão
        if (place === 0) {
          p.streak = (p.streak || 0) + 1;
          p.stats.maxStreak = Math.max(p.stats.maxStreak || 0, p.streak);
          p.stats.wins = (p.stats.wins || 0) + 1;
          if (before.length > 2 && before[before.length - 1] === id && this.round > 0) this.addStat(id, 'underdog');
        } else p.streak = 0;
      }
      place += grp.length;
    }
    // Robin Hood: o vencedor rouba 25 do líder
    if (r.mods.includes('robinhood') && res.length) {
      const winner = res.find((x) => x.place === 1);
      const leader = this.players.filter((p) => p.id !== winner.id).sort((a, b) => b.score - a.score)[0];
      if (leader && leader.score > 0) {
        const amt = Math.min(25, leader.score);
        leader.score -= amt; this.player(winner.id).score += amt;
        winner.notes.push(`🏹 roubou ${amt} de ${leader.name}`);
        const lr = res.find((x) => x.id === leader.id);
        if (lr) lr.notes.push(`🏹 perdeu ${amt}`);
        this.addStat(winner.id, 'sabot');
      }
    }
    res.forEach((x) => { x.total = this.player(x.id).score; });
    this.results = { round: this.round, game: r.game, rows: res };
    this.phase = 'results';
    this.setPhaseTimer(RESULTS_S / SPEED, () => this.nextRound());
    this.emitRoom();
  }

  toPodium() {
    const ps = this.players;
    const awards = [];
    const best = (key, dir = 1, min = 0) => {
      const vals = ps.map((p) => ({ p, v: p.stats[key] })).filter((x) => x.v != null && (dir > 0 ? x.v > min : true));
      if (!vals.length) return [];
      const top = dir > 0 ? Math.max(...vals.map((x) => x.v)) : Math.min(...vals.map((x) => x.v));
      return vals.filter((x) => Math.abs(x.v - top) < 1e-9).map((x) => x.p);
    };
    const give = (key, winners, detail) => winners.forEach((p) => { p.score += ACH_BONUS; awards.push({ key, id: p.id, detail: detail(p) }); });
    give('kos', best('kos'), (p) => `${p.stats.kos} eliminaç${p.stats.kos > 1 ? 'ões' : 'ão'}`);
    const fastRace = best('bestTime', -1);
    if (fastRace.length) give('fast', fastRace, (p) => `cruzou a chegada em ${p.stats.bestTime.toFixed(1)} s`);
    else give('fast', best('bestMem', -1), (p) => `${p.stats.bestMem.toFixed(2)} s por cor na memória`);
    give('streak', best('maxStreak', 1, 1), (p) => `${p.stats.maxStreak} vitória${p.stats.maxStreak > 1 ? 's' : ''} seguida${p.stats.maxStreak > 1 ? 's' : ''}`);
    give('underdog', best('underdog'), () => 'venceu uma rodada estando em último');
    give('sabot', best('sabot'), (p) => `${p.stats.sabot} sabotage${p.stats.sabot > 1 ? 'ns' : 'm'}`);

    const funny = [];
    const f = (key, fmt, min = 0) => { const w = best(key, 1, min); if (w.length) funny.push(fmt(w[0], w[0].stats[key])); };
    f('laserHits', (p, v) => `🔴 ${p.name} encostou em ${v} laser${v > 1 ? 's' : ''}. Ímã de laser oficial.`);
    f('stunTime', (p, v) => `😵 ${p.name} passou ${v.toFixed(1)} s tonto.`, 2);
    f('bombTime', (p, v) => `💣 ${p.name} ficou ${v.toFixed(1)} s abraçado com a bomba.`, 3);
    f('falls', (p, v) => `🕳️ ${p.name} caiu do mapa ${v} ${v > 1 ? 'vezes' : 'vez'}.`);
    f('dashes', (p, v) => `💨 ${p.name} deu ${v} investidas. Calma!`, 5);
    f('jumps', (p, v) => `🦘 ${p.name} pulou ${v} vezes.`, 5);

    const ranking = ps.slice().sort((a, b) => b.score - a.score).map((p) => ({ id: p.id, score: p.score }));
    this.podium = { awards, funny: shuffle(funny).slice(0, 3), ranking };
    this.phase = 'podium';
    clearTimeout(this.timer);
    this.phaseEnd = 0;
    this.emitRoom();
  }

  again(byId) {
    if (byId !== this.hostId || this.phase !== 'podium') return;
    this.phase = 'lobby';
    this.players = this.players.filter((p) => p.connected);
    if (!this.player(this.hostId)) this.hostId = this.players[0] ? this.players[0].id : null;
    this.players.forEach((p) => { p.score = 0; p.stats = {}; });
    this.plan = []; this.round = -1; this.results = null; this.podium = null;
    this.emitRoom();
  }

  setPhaseTimer(sec, fn) {
    clearTimeout(this.timer);
    this.phaseEnd = Date.now() + sec * 1000;
    this.timer = setTimeout(() => { try { fn(); } catch (e) { console.error(e); } }, sec * 1000);
  }

  // ---------- entradas dos jogadores ----------
  input(id, inp) {
    const p = this.player(id);
    if (!p) return;
    p.inp = inp;
    if (this.game) this.game.input(id, inp);
  }
  action(id) { if (this.game) this.game.action(id); }
  pick(id, v) { if (this.game) this.game.pick(id, v); }

  stop() { clearTimeout(this.timer); clearInterval(this.loop); }

  state() {
    const r = this.plan[this.round];
    return {
      code: this.code, hostId: this.hostId, phase: this.phase, round: this.round, total: this.plan.length || this.rounds, rounds: this.rounds,
      now: Date.now(), phaseEnd: this.phaseEnd,
      players: this.players.map(({ id, n, name, color, avatar, score, connected }) => ({ id, n, name, color, avatar, score, connected })),
      cur: r ? { game: r.game, mods: r.mods, final: r.final, label: r.label } : null,
      init: this.phase === 'play' && this.game ? { ...this.game.init(), start: this.gameStart, max: this.game.maxTime } : null,
      results: this.results,
      podium: this.podium,
      chat: this.chat.slice(-40),
    };
  }
  emitRoom() { this.lastActive = Date.now(); this.io.to(this.code).emit('room', this.state()); }
}

module.exports = { Room };
