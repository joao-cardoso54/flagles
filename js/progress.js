// Progresso guardado neste telemóvel, SEPARADO por modo de jogo. A chave do modo junta o conteúdo e a forma de responder:
//   "songs:options", "songs:typing", "flags:options", "flags:typing", "both:options-typing", ...
// Cada modo tem os seus níveis desbloqueados e as suas melhores pontuações (ver modeKey() em main.js).
import { LEVELS } from "./levels.js";

const KEY = "flagles-progress-v3";
const V2_KEY = "flagles-progress-v2"; // separado só por conteúdo: songs / flags / both
const V1_KEY = "flagles-progress-v1"; // tudo junto

const fresh = () => ({ unlocked: 1, best: {} });
let state = {};

try {
  const read = k => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; };
  const v3 = read(KEY);
  if (v3) state = v3;
  else {
    // migração: o que existia contava como "Opções"
    const v2 = read(V2_KEY);
    const v1 = read(V1_KEY);
    if (v2) {
      if (v2.songs) state["songs:options"] = v2.songs;
      if (v2.flags) state["flags:options"] = v2.flags;
      if (v2.both) state["both:options-options"] = v2.both;
    } else if (v1) state["both:options-options"] = v1;
  }
} catch (e) {}

const get = mode => (state[mode] ??= fresh());

// ?unlock=1 no endereço abre todos os níveis (para testar os mais difíceis).
const cheat = new URLSearchParams(location.search).has("unlock");

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

export const isUnlocked = (mode, n) => cheat || n <= get(mode).unlocked;
export const bestScore = (mode, n) => get(mode).best[n] ?? null;
export const highestCompleted = mode => Math.max(0, ...Object.keys(get(mode).best).map(Number));
export const totalBest = mode => Object.values(get(mode).best).reduce((a, b) => a + b, 0);

// Regista um nível concluído nesse modo. Devolve true se bateu o recorde desse nível.
export function complete(mode, level, score) {
  const s = get(mode);
  const record = score > (s.best[level] ?? -1);
  if (record) s.best[level] = score;
  s.unlocked = Math.min(LEVELS.length, Math.max(s.unlocked, level + 1));
  save();
  return record;
}
