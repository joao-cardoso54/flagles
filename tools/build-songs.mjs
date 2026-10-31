// Junta IDs validados (ids-report + extra-report) com os escalões (data/song-tiers.json)
// Escreve data/songs-tiered.json e imprime um resumo.
import { readFileSync, writeFileSync } from "node:fs";
const rd = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const tiers = rd("../data/song-tiers.json");
const core = rd("./ids-report.json").map(o => ({ title: o.title, artist: null, group: "beatles", videoId: o.videoId }));
const extra = rd("./extra-report.json").map(o => ({
  title: o.title, artist: o.artist, group: /Beatles|Quarrymen/.test(o.artist) ? "beatles" : "solo", videoId: o.videoId, note: o.note ?? null,
}));
const all = [...core, ...extra];
const missing = all.filter(s => !(s.title in tiers));
const orphan = Object.keys(tiers).filter(t => !all.some(s => s.title === t));
const out = all.map(s => ({ ...s, tier: tiers[s.title] === "x" ? null : Number(tiers[s.title]), excluded: tiers[s.title] === "x" || !s.videoId }));
writeFileSync(new URL("../data/songs-tiered.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("total:", out.length, "| sem escalão:", missing.length, "| notas órfãs:", orphan.length, orphan);
const t = {};
for (const s of out.filter(s => !s.excluded)) { const k = `${s.group}/T${s.tier}`; t[k] = (t[k] || 0) + 1; }
console.log("jogáveis:", out.filter(s => !s.excluded).length, t);
console.log("excluídas:", out.filter(s => s.excluded).map(s => s.title));
