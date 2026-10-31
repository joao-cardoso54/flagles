// Gera tools/tier-flags.html (página para rever a dificuldade das bandeiras) a partir de data/flags.json.
import { readFileSync, writeFileSync } from "node:fs";
const flags = JSON.parse(readFileSync(new URL("../data/flags.json", import.meta.url), "utf8"));
const tpl = readFileSync(new URL("./tier-flags.template.html", import.meta.url), "utf8");
writeFileSync(new URL("./tier-flags.html", import.meta.url), tpl.replace("/*FLAGS*/", JSON.stringify(flags)));
console.log("tier-flags.html:", flags.length, "bandeiras");
