// Carrega as músicas (data/songs-tiered.json) e escolhe opções de resposta.

export async function loadSongs() {
  const res = await fetch("data/songs-tiered.json");
  if (!res.ok) throw new Error(`Não consegui carregar as músicas (${res.status})`);
  const all = await res.json();
  return all.filter(s => !s.excluded && s.videoId);
}

// Título sem parênteses, minúsculas e sem pontuação: serve para detetar títulos "parecidos".
const base = t => t.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

// "Revolution" vs "Revolution #9", "Love" vs "Love Me Do": não podem aparecer juntas
// como opções, senão a ronda fica confusa.
function tooSimilar(a, b) {
  const x = base(a), y = base(b);
  return x === y || x.startsWith(y) || y.startsWith(x);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 4 opções (1 certa + 3 erradas) do mesmo escalão que a certa; se não chegar, completa com escalões vizinhos.
export function pickOptions(correct, pool, n = 4) {
  const ok = s => s !== correct && !tooSimilar(s.title, correct.title);
  const sameTier = shuffle(pool.filter(s => ok(s) && s.tier === correct.tier));
  const near = shuffle(pool.filter(s => ok(s) && Math.abs(s.tier - correct.tier) === 1));
  const wrong = [];
  for (const s of [...sameTier, ...near]) {
    if (wrong.length === n - 1) break;
    if (wrong.every(w => !tooSimilar(w.title, s.title))) wrong.push(s);
  }
  return shuffle([correct, ...wrong]);
}

// ---- Bandeiras ----

export async function loadFlags() {
  const res = await fetch("data/flags.json");
  if (!res.ok) throw new Error(`Não consegui carregar as bandeiras (${res.status})`);
  const all = await res.json();
  return all.filter(f => f.tier != null); // tier null = excluída (✕)
}

export const flagUrl = (code, w = 320) => `https://flagcdn.com/w${w}/${code}.png`;

// Bandeira aleatória do escalão pedido (se não houver, do mais próximo).
export function pickFlag(pool, tier, exclude = null) {
  for (const d of [0, 1, -1, 2, -2, 3]) {
    const c = pool.filter(f => f.tier === tier + d && f !== exclude);
    if (c.length) return c[Math.floor(Math.random() * c.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// 4 opções (1 certa + 3 erradas): mesmo escalão e mesmo tipo (país/território) que a certa.
export function pickFlagOptions(correct, pool, n = 4) {
  // gémeas (bandeira idêntica, ex.: São Martinho/França) nunca aparecem juntas
  const ok = f => f !== correct && f.kind === correct.kind && !(correct.twins || []).includes(f.code);
  const same = shuffle(pool.filter(f => ok(f) && f.tier === correct.tier));
  const near = shuffle(pool.filter(f => ok(f) && Math.abs(f.tier - correct.tier) === 1));
  // antes: const rest = shuffle(pool.filter(f => ok(f) && ...)) -> o grupo "outros" (UE, ONU, Antártida) só tem 3 e ficava com <4 opções
  const notTwin = f => f !== correct && !(correct.twins || []).includes(f.code);
  const rest = shuffle(pool.filter(f => notTwin(f) && !same.includes(f) && !near.includes(f)));
  return shuffle([correct, ...[...same, ...near, ...rest].slice(0, n - 1)]);
}

// ---- Etiquetas de artista nas opções ----
// Músicas dos Beatles ficam sem etiqueta; as a solo mostram o autor entre parênteses.
const ARTIST_LABEL = {
  "Wings": "Paul McCartney & Wings",
  "Plastic Ono Band": "John Lennon & Plastic Ono Band",
};

export function songLabel(s) {
  if (s.group === "beatles" || !s.artist) return s.title;
  return `${s.title} (${ARTIST_LABEL[s.artist] ?? s.artist})`;
}

// Formas aceites no modo escrever: título completo (com e sem o texto entre parênteses),
// e cada metade de títulos "A / B" ou "A - B".
// antes: return [s.title, ...s.title.split(" / ")];
export function songAnswers(s) {
  const t = s.title;
  return [t, t.replace(/[()]/g, " "), ...t.split(/ \/ | - /)];
}

// Formas aceites ao escrever: nome + aliases da bandeira e de todas as gémeas (a imagem é a mesma).
export function flagAnswers(f, all) {
  const group = [f, ...all.filter(x => (f.twins || []).includes(x.code))];
  return group.flatMap(x => [x.name, ...x.aliases]);
}
