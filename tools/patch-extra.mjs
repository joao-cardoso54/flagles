// Correções manuais ao extra-report.json (resultados da pesquisa que escolhi à mão).
import { readFileSync, writeFileSync } from "node:fs";
const path = new URL("./extra-report.json", import.meta.url);
const rep = JSON.parse(readFileSync(path, "utf8"));
const fix = {
  "What Is Life": { videoId: "5Y5olEjNjAw", note: "2009 Remaster" },
  "Tomorrow": { videoId: "L8TByNr9ynI", note: "Wings - Topic, Remastered 2018" },
  "Home Tonight": { videoId: "_UMdKwsjJHg", note: "audio oficial do canal do Paul: pode ter intro" },
  "Deliver Your Children": { videoId: "0Nz91y5uoGM", note: "audio oficial do canal do Paul: pode ter intro" },
};
for (const o of rep) {
  const f = fix[o.title];
  if (!f) continue;
  const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${f.videoId}&format=json`);
  if (r.status !== 200) throw new Error(`${o.title}: oEmbed ${r.status}`);
  const j = await r.json();
  Object.assign(o, { videoId: f.videoId, status: 200, ytTitle: j.title, author: j.author_name, note: f.note });
}
writeFileSync(path, JSON.stringify(rep, null, 2));
console.log("com ID:", rep.filter(o => o.videoId).length, "/", rep.length);
console.log("sem ID:", rep.filter(o => !o.videoId).map(o => o.artist + " - " + o.title).join("; "));
