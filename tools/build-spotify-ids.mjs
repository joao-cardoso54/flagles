// NOTA: data/spotify-ids.json final foi gerado pela página spotify-teste.html ("Verificar todas") a partir deste mapeamento + pesquisa, e tem os álbuns. Não voltar a correr sem necessidade: sobrescreve-o.
// Gera data/spotify-ids.json a partir da exportação da playlist do Spotify (CSV do Exportify).
// Cada música do jogo é associada à faixa da playlist com o mesmo título e o artista certo
// (escolhe a versão remasterizada de estúdio). O álbum é descoberto na app, na primeira vez que a música toca.
// Uso: node tools/build-spotify-ids.mjs <ficheiro.csv>
import { readFileSync, writeFileSync } from "node:fs";
import { normalize, distance } from "../js/text.js";

const csvPath = process.argv[2];
const songs = JSON.parse(readFileSync(new URL("../data/songs-tiered.json", import.meta.url), "utf8")).filter(s => !s.excluded);

// leitor de CSV com aspas
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const [head, ...rows] = parseCsv(readFileSync(csvPath, "utf8").replace(/^﻿/, ""));
const col = n => head.indexOf(n);
const tracks = rows.filter(r => r[col("Track URI")]).map(r => ({
  uri: r[col("Track URI")], name: r[col("Track Name")], album: r[col("Album Name")], artists: r[col("Artist Name(s)")].split(/[,;]\s*/).map(a => a.trim()),
}));

const BASE = s => normalize(s.replace(/\(.*?\)|\[.*?\]/g, " ")).replace(/ /g, "");
const BASEN = s => BASE(s.split(" - ")[0]); // "Ebony And Ivory - Remixed 2015" -> "ebonyandivory"
const BADALBUM = /\b(love|anthology|naked|songtrack|stripped|imagined|ukulele|symphony|karaoke|tribute|live|takes?|one hand clapping)\b/i;
const BADNAME = /\b(take|takes|demo|live|one hand clapping|stripped|naked)\b/i;
// únicas versões que existem em "Anthology" (músicas que só lá estão ou cuja versão original é essa)
// (e demos que são a única versão: Cayenne, Goodbye e Child Of Nature só existem em demo; Penina é da banda Jotta Herre)
const ALLOW_ANTHOLOGY = new Set(["In Spite Of All The Danger", "Real Love", "Free As A Bird", "Cayenne", "Goodbye", "Child Of Nature"]);
const ANY_ARTIST = new Set(["Penina", "Cayenne", "Goodbye", "Child Of Nature"]); // na playlist aparecem com outro artista // gravação do tema do Paul por outro artista

// artistas aceites por música
function expected(song) {
  if (song.group === "beatles") return ["the beatles", "the quarrymen"];
  if (song.artist === "Wings" || song.artist === "Paul McCartney") return ["wings", "paul mccartney"];
  if (song.artist === "Plastic Ono Band") return ["plastic ono band", "john lennon"];
  return [normalize(song.artist)];
}

const out = {}, noMatch = [], pickedInfo = [];
for (const s of songs) {
  const want = BASE(s.title), exp = expected(s);
  const marker = ((s.title.match(/\(([^)]*)\)\s*$/) || [])[1] || "").toLowerCase();
  const cands = tracks.filter(t => {
    const nb = BASE(t.name), nn = BASEN(t.name);
    const nameOk = nb === want || nn === want || (s.title.startsWith("Silly Love Songs") && nb.startsWith("sillylovesongs")) || (want.length >= 25 && distance(nb, want) <= 3);
    if (!(nameOk && (ANY_ARTIST.has(s.title) || t.artists.some(a => exp.includes(normalize(a)))))) return false;
    if (!ALLOW_ANTHOLOGY.has(s.title) && (BADALBUM.test(t.album) || BADNAME.test(t.name.replace(new RegExp(s.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")))) return false; // fica para a pesquisa (o título "Live And Let Die" não conta como "live")
    const lname = t.name.toLowerCase();
    if ((marker === "reprise" || marker === "play out") && !lname.includes(marker)) return false;
    if (s.title.startsWith("Silly Love Songs") && !lname.includes("reprise")) return false;
    if (marker && marker !== "reprise" && marker !== "play out" && /\b(reprise|play out)\b/.test(lname)) return false;
    return true;
  });
  if (!cands.length) { noMatch.push(s); continue; }
  cands.sort((a, b) => {
    const sc = t => (/remaster/i.test(t.name + " " + t.album) ? 2 : 0) - (BADALBUM.test(t.album) ? 5 : 0) - (/\b(mix|take|demo|edit)\b/i.test(t.name) ? 1 : 0);
    return sc(b) - sc(a);
  });
  const t = cands[0];
  out[s.videoId] = { uri: t.uri, label: `${t.name} · ${t.artists.join(", ")} · ${t.album}` };
  if (cands.length > 1) pickedInfo.push(`${s.title} -> ${out[s.videoId].label}${cands.length > 1 ? `  [${cands.length} candidatas]` : ""}`);
}
writeFileSync(new URL("../data/spotify-ids.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(`faixas na playlist: ${tracks.length} | músicas do jogo: ${songs.length} | associadas: ${Object.keys(out).length} | sem correspondência: ${noMatch.length}`);
console.log("\nSEM CORRESPONDÊNCIA NA PLAYLIST:\n" + noMatch.map(s => `- ${s.title}${s.artist ? " (" + s.artist + ")" : ""}`).join("\n"));
console.log("\nPara rever (várias candidatas ou álbum estranho):\n" + pickedInfo.map(x => "- " + x).join("\n"));
