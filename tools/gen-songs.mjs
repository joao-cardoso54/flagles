// Gera js/songs.js a partir de tools/ids-report.json (só IDs validados).
// Uso: node tools/gen-songs.mjs
import { readFileSync, writeFileSync } from "node:fs";

const report = JSON.parse(readFileSync(new URL("./ids-report.json", import.meta.url), "utf8"));
const want = [
  "Here Comes The Sun", "Come Together", "Let It Be", "Yesterday", "Hey Jude",
  "Twist and Shout", "Blackbird", "In My Life", "I Want To Hold Your Hand", "Help!",
  "Eleanor Rigby", "Love Me Do", "A Hard Day's Night", "Strawberry Fields Forever",
  "Penny Lane", "Yellow Submarine", "Get Back", "She Loves You", "Can't Buy Me Love",
  "Day Tripper", "Drive My Car", "Hello Goodbye", "I Am The Walrus", "Helter Skelter",
  "Back In The USSR",
];
const n = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const rows = want.map(w => {
  const o = report.find(x => x.status === 200 && n(x.title) === n(w));
  if (!o) throw new Error(`sem ID validado para: ${w}`);
  return `  { title: ${JSON.stringify(o.title)}, videoId: ${JSON.stringify(o.videoId)} },`;
});

const day = new Date().toISOString().slice(0, 10);
writeFileSync(
  new URL("../js/songs.js", import.meta.url),
  `// IDs validados por oEmbed (tools/validate-ids.mjs, ${day}): todos 200 e embeddable.\n` +
  `// Lista de arranque para testes; a lista completa (210) está em docs/revolution1-songs.md.\n` +
  `export const SONGS = [\n${rows.join("\n")}\n];\n`,
);
console.log(rows.length, "músicas escritas em js/songs.js");
