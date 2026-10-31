// Procura videoIds "Topic" para tools/extra-songs.json (yt-dlp, sem chave) e valida por oEmbed.
// Uso: node tools/find-ids.mjs   ->  escreve tools/extra-report.json
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";

const run = promisify(execFile);
const ytdlp = new URL("./.venv/bin/yt-dlp", import.meta.url).pathname;
const songs = JSON.parse(readFileSync(new URL("./extra-songs.json", import.meta.url), "utf8"));
const n = s => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

async function search(query) {
  // args em array (sem shell): o texto da pesquisa nunca é interpretado como comando
  const { stdout } = await run(ytdlp, ["--flat-playlist", "-j", `ytsearch8:${query}`], { maxBuffer: 20e6 });
  return stdout.trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
}

async function oembed(id) {
  const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  return r.status === 200 ? { status: 200, ...(await r.json()) } : { status: r.status };
}

async function resolve({ title, artist, alt }) {
  const want = n(alt || title);
  for (const q of [`${artist} ${title} topic`, `${artist} - ${title}`]) {
    let hits;
    try { hits = await search(q); } catch (e) { continue; }
    for (const h of hits) {
      const channel = h.channel || h.uploader || "";
      // faixa auto-gerada pelo YouTube: canal "- Topic" ou descrição "Provided to YouTube by ..."
      const isAuto = /topic/i.test(channel) || /^Provided to YouTube/i.test(h.description || "");
      const bad = /\b(live|remix|karaoke|cover|instrumental|reaction|lyrics?)\b/i.test(h.title || "") && !/\b(live|remix|instrumental)\b/i.test(title);
      const t = n(h.title || "");
      if (isAuto && !bad && (t.includes(want) || want.includes(t))) {
        const o = await oembed(h.id);
        if (o.status === 200) return { title, artist, videoId: h.id, status: 200, ytTitle: o.title, author: o.author_name };
      }
    }
  }
  return { title, artist, videoId: null, status: "nao-encontrado" };
}

const out = [];
for (let i = 0; i < songs.length; i += 4) {
  out.push(...await Promise.all(songs.slice(i, i + 4).map(resolve)));
  process.stderr.write(`\r${out.length}/${songs.length}`);
}
writeFileSync(new URL("./extra-report.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`\nencontrados: ${out.filter(o => o.videoId).length}/${out.length}`);
for (const o of out.filter(o => !o.videoId)) console.log("FALTA:", o.artist, "-", o.title);
