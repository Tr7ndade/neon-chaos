# NEON CHAOS ⚡

Torneio de minigames online para 5 ou 6 jogadores, direto no navegador do PC. Salas privadas com código, 16 minigames, 5, 7 ou 10 rodadas (o anfitrião escolhe), interface em português e visual neon 2.5D.

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

1. **Lobby:** apelido, avatar (8 opções) e o anfitrião escolhe **5, 7 ou 10 rodadas** (~13, ~18 ou ~26 min).
2. **Rodadas:** cada uma sorteia um minigame diferente entre os 16 (nunca repete na mesma partida).
   - 1ª rodada: aquecimento, sem eventos.
   - Rodadas do meio: 1 evento aleatório cada; uma delas é o **Evento especial**, com 2 eventos ao mesmo tempo.
   - Última rodada: **FINAL, pontos em dobro**.
3. **Pódio:** ranking, conquistas e curiosidades; o anfitrião pode pedir revanche.

**Pontos por colocação:** 100 · 75 · 50 · 35 · 20 · 10 (empate = mesma colocação). No Knockout, cada eliminação vale +20.

**Conquistas (+25 pontos cada, no pódio):** Exterminador (mais eliminações), Relâmpago (chegada mais rápida), Imparável (2+ vitórias seguidas), Sobrevivente improvável (venceu uma rodada estando em último), Sabotador (mais sabotagens).

## Os 16 minigames

| Jogo | Tipo | Resumo |
|---|---|---|
| Laser Run | Reflexo | Atravesse lasers móveis até a chegada |
| Last Floor | Sobrevivência | O piso cai; pule e seja o último de pé |
| Knockout | Combate | Empurre todos para fora da arena que encolhe |
| Memory Glitch | Memória | Repita a sequência de cores |
| Neon Race | Corrida | Corrida com turbos, gosma, minas e choques |
| Hot Bomb | Caos | Passe a bomba antes que ela exploda |
| Tesouro Perdido | Aventura | Abra baús nas ruínas, cuidado com espinhos e o mímico |
| Fuga da Lava | Sobrevivência | Fuja da lava que acelera, pule poços, desvie de pedras |
| Chefão Titã | Chefão | Leve esferas de energia ao robô gigante enquanto ele atira |
| Masmorra | Exploração | Labirinto escuro: ache uma chave e chegue ao portal |
| Coroa do Rei | Disputa | Segure a coroa o máximo de tempo; roube com investidas |
| Guerra de Naves | Combate | Naves com tiros, asteroides (+1) e rivais (+3) |
| Travessia Neon | Reflexo | Atravesse avenida e rio de energia quantas vezes puder |
| Vírus | Caos | Sobreviva (1 pt/s) ou infecte os outros (8 pts) |
| Corrida do Ouro | Estratégia | Minere e leve o ouro para a sua base |
| Território | Estratégia | Pinte o chão com a sua cor |

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
- **✨** (canto superior direito): alterna entre gráficos completos e modo leve. Em computadores fracos o jogo entra sozinho no modo leve.

## Ajustes fáceis

- `public/shared.js`: textos, eventos, tabela de pontos, rodadas e tempos. `MIN_PLAYERS` está em 2 para você poder testar com poucas pessoas; mude para 5 se quiser exigir 5 ou 6.
- `games.js` (6 originais) e `games2.js` (10 modos novos): física e regras de cada minigame.
- `public/render.js`: o visual (arenas, objetos com altura, brilho, partículas); `public/avatars.js`: os avatares.
- `room.js`: fluxo do torneio, pontuação e conquistas.

## Teste automático

Com o servidor rodando (`NC_SPEED=6 npm start` acelera o tempo 6×), em outro terminal:

```bash
npm i --no-save socket.io-client
node tools/bots.js http://localhost:3000 6 600000 10
```

6 bots jogam um torneio inteiro (o último número é a quantidade de rodadas) e o resultado aparece no terminal.
