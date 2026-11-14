# NEON CHAOS ⚡

Torneio de minigames online para 5 ou 6 jogadores, direto no navegador do PC. Salas privadas com código, partidas de uns 15 minutos, interface em português.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Para testar sozinho, abra várias abas ou janelas anônimas: cada uma é um jogador.

## Colocar online (Render, grátis)

É igual ao Magnata Brasil, mas num **repositório novo**:

1. GitHub: **+ → New repository**, nome `neon-chaos`, Public, sem README → **Create repository** → **uploading an existing file** → arraste **o conteúdo** da pasta `neon-chaos` (incluindo as pastas `public` e `tools`) → **Commit changes**.
2. Render: **New + → Web Service** → escolha `neon-chaos` → Build `npm install`, Start `npm start`, Instance **Free** → **Deploy Web Service**.
3. Quando aparecer **Live**, abra o link, crie uma sala e mande o link de convite.

## Como funciona o torneio

| Etapa | Duração máx. | O que acontece |
|---|---|---|
| Lobby | — | Apelido, avatar (8 opções), anfitrião inicia |
| Rodada 1 | 2 min | Minigame aleatório de aquecimento |
| Rodada 2 | 3 min | Obstáculos e sabotagem (Neon Race ou Laser Run) + 1 evento |
| Rodada 3 | 3 min | Habilidade/reflexo (Memory Glitch, Knockout ou Laser Run) + 1 evento |
| Rodada 4 | 3 min | Evento especial (Hot Bomb, Last Floor ou Knockout) + 2 eventos |
| Final | 2 min | Minigame restante, **pontos em dobro** |
| Pódio | — | Ranking, conquistas e curiosidades; anfitrião pode pedir revanche |

Cada jogo aparece no máximo uma vez por torneio. Muitos terminam antes do tempo máximo (quando todos cruzam a chegada ou só sobra um).

**Pontos por colocação:** 100 · 75 · 50 · 35 · 20 · 10 (empate = mesma colocação). No Knockout, cada eliminação vale +20.

**Conquistas (+25 pontos cada, no pódio):** Exterminador (mais eliminações), Relâmpago (chegada mais rápida), Imparável (2+ vitórias seguidas), Sobrevivente improvável (venceu uma rodada estando em último), Sabotador (mais sabotagens: minas, choques, bombas passadas, empurrões que eliminam, Robin Hood).

## Eventos aleatórios

| Evento | Efeito |
|---|---|
| ⚡ Turbo | Todos 45% mais rápidos (no Memory: sequência pisca mais rápido) |
| 🧊 Pista de gelo | Quase sem atrito |
| 🔄 Controles invertidos | Direções trocadas (no Memory: repetir de trás pra frente) |
| 🌑 Apagão | Arena escura, só se vê perto dos jogadores |
| 🦍 Gigantes / 🐜 Nanicos | Todos maiores / menores |
| 🏹 Robin Hood | Vencedor da rodada rouba 25 pontos do líder |
| 🎲 Dia do Azarão | Metade de baixo do placar ganha pontos em dobro |

## Controles

- **WASD / setas**: mover
- **ESPAÇO**: ação (pular, investida, usar item, arrancada)
- **1 2 3 4** ou clique: cores do Memory Glitch
- **TAB** (segurar): placar do torneio

## Ajustes fáceis

- `public/shared.js`: textos, eventos, tabela de pontos, rodadas e tempos. `MIN_PLAYERS` está em 2 para você poder testar com poucas pessoas; mude para 5 se quiser exigir 5 ou 6.
- `games.js`: física e regras de cada minigame (velocidades, tamanho das arenas, tempo das bombas…).
- `room.js`: fluxo do torneio, pontuação e conquistas.

## Teste automático

Com o servidor rodando (`NC_SPEED=6 npm start` acelera o tempo 6×), em outro terminal:

```bash
npm i --no-save socket.io-client
node tools/bots.js http://localhost:3000 6
```

6 bots jogam um torneio inteiro e o resultado aparece no terminal.
