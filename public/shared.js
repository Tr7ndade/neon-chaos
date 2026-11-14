// Dados compartilhados entre servidor (Node) e navegador.
(function (root) {
  const W = 1280, H = 720;

  const GAMES = {
    laser: {
      name: 'LASER RUN', tag: 'Reflexo',
      desc: 'Atravesse a arena cheia de lasers móveis. Encostou, perdeu tempo. O primeiro a cruzar a linha vence.',
      controls: 'WASD / setas: mover',
    },
    floor: {
      name: 'LAST FLOOR', tag: 'Sobrevivência',
      desc: 'O chão está desaparecendo. Pule entre as plataformas e seja o último de pé.',
      controls: 'WASD / setas: mover · ESPAÇO: pular',
    },
    knockout: {
      name: 'KNOCKOUT', tag: 'Combate',
      desc: 'Empurre os adversários para fora da arena, que vai encolhendo. Cada eliminação vale +20 pontos.',
      controls: 'WASD / setas: mover · ESPAÇO: investida',
    },
    memory: {
      name: 'MEMORY GLITCH', tag: 'Memória',
      desc: 'Memorize a sequência de cores e repita certinho antes dos outros. A cada fase, ela fica maior.',
      controls: 'Teclas 1 2 3 4 ou clique nas cores',
    },
    race: {
      name: 'NEON RACE', tag: 'Corrida',
      desc: 'Corra até a chegada. Turbos e atalhos ajudam, gosma atrasa. Pegue caixas de item: turbo, mina e choque.',
      controls: 'WASD / setas: mover · ESPAÇO: usar item',
    },
    bomb: {
      name: 'HOT BOMB', tag: 'Caos',
      desc: 'Encoste em alguém para passar a bomba. Quando ela explodir, quem estiver segurando está fora.',
      controls: 'WASD / setas: mover · ESPAÇO: arrancada',
    },
  };

  // Eventos aleatórios (modificadores sorteados entre as rodadas)
  const MODS = {
    turbo:     { name: 'TURBO', icon: '⚡', desc: 'Todo mundo 45% mais rápido.', mem: 'A sequência pisca no dobro da velocidade.' },
    gelo:      { name: 'PISTA DE GELO', icon: '🧊', desc: 'O chão vira gelo. Frear é quase impossível.', movement: true },
    invertido: { name: 'CONTROLES INVERTIDOS', icon: '🔄', desc: 'Esquerda vira direita, cima vira baixo.', mem: 'Repita a sequência de trás pra frente.' },
    apagao:    { name: 'APAGÃO', icon: '🌑', desc: 'As luzes caem. Só dá para ver perto dos jogadores.', mem: 'As cores piscam bem mais rápido.' },
    gigantes:  { name: 'GIGANTES', icon: '🦍', desc: 'Todos os jogadores ficam enormes.', movement: true },
    nanicos:   { name: 'NANICOS', icon: '🐜', desc: 'Todos encolhem e ficam minúsculos.', movement: true },
    robinhood: { name: 'ROBIN HOOD', icon: '🏹', desc: 'Quem vencer a rodada rouba 25 pontos do líder do torneio.' },
    azarao:    { name: 'DIA DO AZARÃO', icon: '🎲', desc: 'A metade de baixo do placar ganha pontos em dobro nesta rodada.' },
  };

  const TABLE = [100, 75, 50, 35, 20, 10];
  const ROUNDS = [
    { label: 'Aquecimento', time: 120, mods: 0, pool: ['laser', 'floor', 'knockout', 'memory', 'race', 'bomb'] },
    { label: 'Obstáculos e sabotagem', time: 180, mods: 1, pool: ['race', 'laser'] },
    { label: 'Habilidade e reflexo', time: 180, mods: 1, pool: ['memory', 'knockout', 'laser'] },
    { label: 'Evento especial', time: 180, mods: 2, pool: ['bomb', 'floor', 'knockout'] },
    { label: 'FINAL · pontos em dobro', time: 120, mods: 0, pool: ['laser', 'floor', 'knockout', 'memory', 'race', 'bomb'], final: true },
  ];

  const COLORS = ['#b84dff', '#22e4ff', '#ff2e55', '#4d7cff', '#ff5ce1', '#c8ff3d'];
  const AVATARS = ['Visor', 'Gato', 'Chifres', 'Alien', 'Ciclope', 'Ninja', 'Robô', 'Coroa'];

  const ACHIEVEMENTS = {
    kos:      { icon: '💀', name: 'Exterminador', desc: 'Mais eliminações' },
    fast:     { icon: '⚡', name: 'Relâmpago', desc: 'Jogador mais rápido' },
    streak:   { icon: '🔥', name: 'Imparável', desc: 'Maior sequência de vitórias' },
    underdog: { icon: '🍀', name: 'Sobrevivente improvável', desc: 'Venceu uma rodada estando em último' },
    sabot:    { icon: '😈', name: 'Sabotador', desc: 'Mais sabotagens' },
  };
  const ACH_BONUS = 25;

  const data = { W, H, GAMES, MODS, TABLE, ROUNDS, COLORS, AVATARS, ACHIEVEMENTS, ACH_BONUS, MIN_PLAYERS: 2, MAX_PLAYERS: 6 };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.NC = data;
})(this);
