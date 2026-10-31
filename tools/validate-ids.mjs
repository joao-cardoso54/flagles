// Valida os videoIds do docs/revolution1-songs.md via oEmbed (sem chave, grátis).
// Uso: node tools/validate-ids.mjs   ->  escreve tools/ids-report.json
// 200 = existe e permite embed | 401 = embed bloqueado | 404 = removido/privado
import { readFileSync, writeFileSync } from "node:fs";

const md = readFileSync(new URL("../docs/revolution1-songs.md", import.meta.url), "utf8");
const all = md.split("## Todas")[1];
const songs = [...all.matchAll(/^\d+\. (.+) \| (\S+)$/gm)].map(m => ({ title: m[1], videoId: m[2] }));

async function check({ title, videoId }) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  try {
    const r = await fetch(url);
    if (r.status !== 200) return { title, videoId, status: r.status };
    const j = await r.json();
    return { title, videoId, status: 200, ytTitle: j.title, author: j.author_name };
  } catch (e) {
    return { title, videoId, status: "erro", error: String(e) };
  }
}

const out = [];
for (let i = 0; i < songs.length; i += 10) {
  out.push(...await Promise.all(songs.slice(i, i + 10).map(check)));
}
writeFileSync(new URL("./ids-report.json", import.meta.url), JSON.stringify(out, null, 2));

const by = {};
for (const o of out) by[o.status] = (by[o.status] || 0) + 1;
console.log("resumo:", by);
console.log("autores:", Object.entries(out.reduce((a, o) => (o.author && (a[o.author] = (a[o.author] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 8));
for (const o of out.filter(o => o.status !== 200)) console.log(o.status, o.title, o.videoId);
