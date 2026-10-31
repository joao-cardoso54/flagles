// Regras do jogo por níveis. Tudo o que se quer afinar está aqui.

export const ROUND_SECONDS = 30;   // tempo fixo por ronda
export const LIVES = 3;            // vidas por tentativa de nível (não recuperam)

// Pontos por resposta certa. Música: depende do degrau da escada em que acertaste (menos segundos = mais pontos).
export const SONG_POINTS = [100, 80, 60, 40, 25, 10]; // 1s, 2s, 3s, 5s, 8s, 15s (mesma ordem de LADDER)
export const FLAG_POINTS = 100;
// Bónus por rapidez: até este valor, proporcional ao tempo que sobra no relógio quando respondes certo.
export const SPEED_BONUS_MAX = 50;

// rounds: nº de rondas do nível. w: peso de cada escalão [1, 2, 3, 4] ao sortear cada ronda.
// A música e a bandeira de uma ronda são do mesmo escalão. Podem repetir-se entre níveis, nunca dentro do mesmo.
export const LEVELS = [
  { rounds: 10,  w: [1, 0, 0, 0] },
  { rounds: 15,  w: [3, 1, 0, 0] },
  { rounds: 20,  w: [1, 1, 0, 0] },
  { rounds: 25,  w: [1, 2, 0, 0] },
  { rounds: 30,  w: [1, 2, 1, 0] },
  { rounds: 40,  w: [1, 2, 2, 0] },
  { rounds: 50,  w: [1, 2, 3, 0] },
  { rounds: 60,  w: [0, 2, 3, 1] },
  { rounds: 80,  w: [0, 2, 3, 2] },
  { rounds: 100, w: [0, 1, 3, 2] },
  { rounds: 120, w: [0, 1, 3, 3] },
  { rounds: 150, w: [1, 1, 3, 4] },
  { rounds: 180, w: [1, 1, 3, 5] },
  { rounds: 210, w: [1, 1, 3, 6] },
  { rounds: 240, w: [1, 1, 2, 6] },
];

// Sorteia um escalão (1-4) segundo os pesos.
export function pickTier(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i + 1;
  }
  return weights.findIndex(w => w > 0) + 1;
}

// Modo "nunca repetir entre níveis": nunca muda de escalão (a dificuldade fica certa).
// Escolhe um item do escalão que ainda não saiu; se esse escalão já acabou, recomeça SÓ esse escalão
// (as músicas desse escalão voltam a poder sair) e evita repetir logo o item anterior (`prev`).
// Devolve { item, cleared }: `cleared` são os itens do escalão que voltaram a ficar disponíveis.
export function pickKeepTier(pool, tier, used, prev = null) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const fresh = pool.filter(x => x.tier === tier && !used.has(x));
  if (fresh.length) return { item: pick(fresh), cleared: [] };
  const same = pool.filter(x => x.tier === tier);
  if (!same.length) return { item: pickByTier(pool, tier, used), cleared: [] }; // escalão vazio: o mais próximo
  for (const x of same) used.delete(x);
  return { item: pick(same.length > 1 ? same.filter(x => x !== prev) : same), cleared: same };
}

// Escolhe um item do escalão pedido que ainda não saiu (`used`); se o escalão acabou, usa o mais próximo.
// Se já saiu tudo, recomeça (só acontece em níveis longos com pools pequenos).
export function pickByTier(pool, tier, used) {
  for (const attempt of [0, 1]) {
    for (const d of [0, 1, -1, 2, -2, 3, -3]) {
      const c = pool.filter(x => x.tier === tier + d && !used.has(x));
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
    used.clear(); // nada por usar: recomeça
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
