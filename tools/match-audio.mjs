// Associa os ficheiros de áudio de uma pasta às músicas do jogo (pelo nome do ficheiro).
// Uso: node tools/match-audio.mjs <pasta> [--cut <pasta-destino>]
// Com --cut, corta os primeiros 15s de cada ficheiro associado (ffmpeg do venv) e escreve manifest.json.
import { readdirSync, statSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { normalize, distance, songEdits } from "../js/text.js";

const dir = process.argv[2];
const cutIdx = process.argv.indexOf("--cut");
const outDir = cutIdx > 0 ? process.argv[cutIdx + 1] : null;
const songs = JSON.parse(readFileSync(new URL("../data/songs-tiered.json", import.meta.url), "utf8")).filter(s => !s.excluded);

// Chave de comparação: tira "(Remastered 2009)", "(2021 Mix)", "(1)", mas MANTÉM outros parênteses
// ("(Reprise)", "(Ballad)") para não confundir versões da mesma música.
const EDITION = /\((?:[^)]*\b(?:remaster(?:ed)?|mix|version|mono|stereo|demo|edit|take|official|audio|video)\b[^)]*|\d{1,2})\)/gi;
const key = s => normalize(s.replace(EDITION, " ").replace(/[()]/g, " ")).replace(/ /g, "");
const looseKey = s => normalize(s).replace(/ /g, ""); // sem nada entre parênteses

const files = readdirSync(dir).filter(f => /\.(mp3|m4a|flac|wav)$/i.test(f));
const byKey = new Map(songs.map(s => [key(s.title), s]));
const byLoose = new Map();
for (const s of songs) { const k = looseKey(s.title); byLoose.set(k, [...(byLoose.get(k) || []), s]); }

const matched = new Map(); // title -> { file, how, size }
const dupes = [], unmatched = [], fuzzy = [];
for (const f of files) {
  const base = f.replace(/\.[^.]+$/, "");
  const k = key(base.replace(/^\s*\d+\s*[-.]\s*/, "").replace(/^the beatles\s*-\s*/i, ""));
  let song = byKey.get(k), how = "exata";
  if (!song) { // parênteses diferentes: aceita só se for inequívoco
    const cands = byLoose.get(looseKey(base.replace(EDITION, " "))) || [];
    if (cands.length === 1) { song = cands[0]; how = "sem parênteses"; }
  }
  if (!song) { // pequenos erros de escrita
    const near = songs.map(s => [s, distance(k, key(s.title))]).sort((a, b) => a[1] - b[1])[0];
    if (near && near[1] <= songEdits(key(near[0].title).length)) { song = near[0]; how = `aprox (${near[1]})`; fuzzy.push([f, song.title]); }
  }
  if (!song) { unmatched.push(f); continue; }
  const size = statSync(join(dir, f)).size;
  const prev = matched.get(song.title);
  if (prev) { dupes.push([song.title, prev.file, f]); if (size <= prev.size) continue; }
  matched.set(song.title, { file: f, how, size });
}

const missing = songs.filter(s => !matched.has(s.title));
console.log(`ficheiros: ${files.length} | associados a músicas: ${matched.size} | duplicados: ${dupes.length} | sem associação: ${unmatched.length}`);
console.log(`músicas do jogo: ${songs.length} | já com ficheiro: ${matched.size} | em falta: ${missing.length}`);
if (dupes.length) console.log("\nDuplicados (fica o maior):", dupes.map(d => `\n  ${d[0]}: "${d[1]}" / "${d[2]}"`).join(""));
if (unmatched.length) console.log("\nSem associação:", unmatched.map(f => `\n  ${f}`).join(""));
if (fuzzy.length) console.log("\nAssociados por aproximação (confirmar):", fuzzy.map(x => `\n  ${x[0]} -> ${x[1]}`).join(""));
writeFileSync(new URL("./audio-missing.txt", import.meta.url), missing.map(s => `${s.title}${s.artist ? " (" + s.artist + ")" : ""} - https://youtu.be/${s.videoId}`).join("\n") + "\n");

if (outDir) {
  const ff = process.env.FFMPEG;
  mkdirSync(outDir, { recursive: true });
  const manifest = {};
  let n = 0, outBytes = 0;
  for (const s of songs) {
    const m = matched.get(s.title);
    if (!m) continue;
    const name = `${s.videoId}.mp3`; // nome estável: não depende de acentos nem de edições
    execFileSync(ff, ["-y", "-loglevel", "error", "-i", join(dir, m.file), "-t", "15", "-vn", "-map_metadata", "-1", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", join(outDir, name)]);
    manifest[s.videoId] = { title: s.title, file: name };
    outBytes += statSync(join(outDir, name)).size; n++;
  }
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
  console.log(`\ncortados: ${n} ficheiros | tamanho total dos cortes: ${(outBytes / 1e6).toFixed(1)} MB`);
}
