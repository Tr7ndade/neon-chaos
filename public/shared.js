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
    treasure: {
      name: 'TESOURO PERDIDO', tag: 'Aventura', unit: 'moedas',
      desc: 'Explore as ruínas e abra baús (fique parado perto deles). Cuidado com espinhos e com o baú mímico! Investida derruba moedas dos rivais.',
      controls: 'WASD / setas: mover · ESPAÇO: investida',
    },
    lava: {
      name: 'FUGA DA LAVA', tag: 'Sobrevivência',
      desc: 'A lava avança e acelera. Corra, pule os poços e desvie das pedras que caem. Quem for alcançado está fora.',
      controls: 'WASD / setas: mover · ESPAÇO: pular',
    },
    boss: {
      name: 'CHEFÃO TITÃ', tag: 'Chefão', unit: 'dano',
      desc: 'Um robô gigante dispara sem parar. Pegue as esferas de energia e leve até ele para causar dano. Quem der o golpe final ganha bônus.',
      controls: 'WASD / setas: mover · ESPAÇO: investida',
    },
    dungeon: {
      name: 'MASMORRA', tag: 'Exploração',
      desc: 'Labirinto escuro. Ache uma chave e leve até o portal. Fuja das sentinelas e roube chaves com investidas. Tem menos chaves que jogadores!',
      controls: 'WASD / setas: mover · ESPAÇO: investida',
    },
    crown: {
      name: 'COROA DO REI', tag: 'Disputa', unit: 's',
      desc: 'Pegue a coroa e segure o máximo de tempo. Os outros roubam com investidas e o laser central derruba quem estiver com ela.',
      controls: 'WASD / setas: mover · ESPAÇO: investida (rouba)',
    },
    ships: {
      name: 'GUERRA DE NAVES', tag: 'Combate', unit: 'pts',
      desc: 'Pilote sua nave, destrua asteroides (+1) e abata rivais (+3). As bordas da tela se conectam.',
      controls: 'WASD / setas: pilotar · ESPAÇO: atirar',
    },
    crossing: {
      name: 'TRAVESSIA NEON', tag: 'Reflexo', unit: 'travessias',
      desc: 'Atravesse a avenida sem ser atropelado e o rio de energia pulando de plataforma em plataforma. Cada chegada ao topo vale ponto.',
      controls: 'WASD / setas: mover',
    },
    virus: {
      name: 'VÍRUS', tag: 'Caos', unit: 'pts',
      desc: 'Os infectados contaminam quem tocarem. Sobreviver dá 1 ponto por segundo; infectar alguém dá 8.',
      controls: 'WASD / setas: mover · ESPAÇO: arrancada',
    },
    gold: {
      name: 'CORRIDA DO OURO', tag: 'Estratégia', unit: 'ouro',
      desc: 'Minere ouro no centro e leve até a SUA base. Carregar muito deixa você lento, e uma investida faz o rival derrubar metade.',
      controls: 'WASD / setas: mover · ESPAÇO: investida',
    },
    territory: {
      name: 'TERRITÓRIO', tag: 'Estratégia', unit: 'casas',
      desc: 'Pinte o chão andando por cima. Bombas de tinta pintam uma área inteira. Quem tiver mais casas no fim vence.',
      controls: 'WASD / setas: mover · ESPAÇO: investida (pinta mais)',
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
  const ROUND_OPTIONS = [5, 7, 10];
  const ROUND_TIME = 150;     // teto por rodada (cada jogo tem o seu, menor)
  const FINAL_TIME = 120;

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

  const data = { W, H, GAMES, MODS, TABLE, ROUND_OPTIONS, ROUND_TIME, FINAL_TIME, COLORS, AVATARS, ACHIEVEMENTS, ACH_BONUS, MIN_PLAYERS: 2, MAX_PLAYERS: 6 };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.NC = data;
})(this);
