// Gera data/flags.json a partir de https://flagcdn.com/pt/codes.json
// - nomes em PT-PT (o flagcdn mistura PT-BR: "Irã", "Vietnã", "Romênia"...)
// - aliases aceites no modo "escrever"
// - escalão PROPOSTO por mim (1 fácil ... 4 difícil); o utilizador revê em tools/tier-flags.html
// Uso: node tools/build-flags.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const url = new URL("./", import.meta.url);
const res = await fetch("https://flagcdn.com/pt/codes.json");
if (!res.ok) throw new Error(`codes.json: ${res.status}`);
const codes = await res.json();
// Nomes em inglês: também são aceites ao escrever (inglês ou português).
const resEn = await fetch("https://flagcdn.com/en/codes.json");
if (!resEn.ok) throw new Error(`codes.json (en): ${resEn.status}`);
const codesEn = await resEn.json();

const split = s => s.trim().split(/\s+/);

// 193 membros da ONU + Vaticano, Palestina, Kosovo, Taiwan
const SOVEREIGN = new Set(split(`
ad ae af ag al am ao ar at au az ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz ca cd cf cg ch ci cl cm cn co cr cu cv cy cz
de dj dk dm do dz ec ee eg er es et fi fj fm fr ga gb gd ge gh gm gn gq gr gt gw gy hn hr ht hu id ie il in iq ir is it jm jo jp
ke kg kh ki km kn kp kr kw kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mr mt mu mv mw mx my mz na ne ng ni
nl no np nr nz om pa pe pg ph pk pl pt pw py qa ro rs ru rw sa sb sc sd se sg si sk sl sm sn so sr ss st sv sy sz td tg th tj tl
tm tn to tr tt tv tz ua ug us uy uz vc ve vn vu ws ye za zm zw   va ps xk tw
`));

// Antes (passo 5) estas ficavam de fora: const EXCLUDE = new Set(split(`aq eu un bv sj hm um mf gp mq re yt gf bl`));
// Agora entram todas. Só 4 têm a imagem byte a byte igual à de outra (verificado por md5):
// mf=fr, bv=sj=no, um=us. Ficam "gémeas": a resposta de uma é aceite na outra e nunca aparecem juntas nas opções.
const EXCLUDE = new Set();
const TWIN_GROUPS = [["fr", "mf"], ["no", "bv", "sj"], ["us", "um"]];
const OTHER = new Set(split(`eu un aq`)); // não são países nem territórios
const STATE_T3 = split(`ca tx fl ny hi ak`);

const T1 = split(`pt br es fr de it gb us ca mx ar cl co pe ve uy cn jp kr in ru au nz za eg ma tr gr nl be ch at se no dk fi ie pl ua sa il ir ao mz cu`);
const T2 = split(`pa cr ec bo py ke et ng gh dz tn ly sn ci cm cd tz ug sd th vn my id ph sg pk bd lk np kp iq sy lb jo ae qa kw cz sk hu ro bg rs hr si ba al mk me cy mt is lu mc va by lt lv ee ge am az kz af`);
const T4 = split(`ad li sm ag dm gd kn lc vc ki nr tv mh fm pw sb vu ws to st km sc mv`);
const TERRITORY_T3 = split(`pr hk gl mo fo gb-eng gb-sct gb-wls gb-nir ky bm gu`);

const NAME = {
  ir: "Irão", vn: "Vietname", ro: "Roménia", nl: "Países Baixos", mm: "Mianmar", ps: "Palestina", dj: "Jibuti", kw: "Koweit",
  bh: "Barém", mw: "Maláui", zw: "Zimbabué", bw: "Botsuana", lk: "Sri Lanca", ki: "Quiribáti", uz: "Usbequistão", fm: "Micronésia",
  ky: "Ilhas Caimão", fo: "Ilhas Feroé", gl: "Gronelândia", fk: "Ilhas Malvinas",
};

const ALIASES = {
  us: ["EUA", "Estados Unidos da América", "USA"],
  gb: ["Grã-Bretanha", "UK"],
  nl: ["Holanda"],
  cz: ["República Checa"],
  mk: ["Macedónia"],
  ci: ["Côte d'Ivoire", "Cote d'Ivoire"],
  cv: ["Cabo-Verde"],
  tl: ["Timor"],
  cd: ["RD Congo", "RDC", "Congo-Kinshasa"],
  cg: ["Congo", "Congo-Brazzaville"],
  mm: ["Myanmar", "Birmânia"],
  sz: ["Suazilândia", "Eswatini"],
  va: ["Santa Sé", "Cidade do Vaticano"],
  ps: ["Estado da Palestina"],
  ae: ["Emirados", "EAU"],
  by: ["Belarus"],
  vn: ["Vietnam"],
  bf: ["Burkina Faso"],
  ba: ["Bósnia"],
  ag: ["Antigua e Barbuda"],
  kn: ["Saint Kitts e Nevis"],
  lc: ["Saint Lucia"],
  vc: ["Saint Vincent e Granadinas", "São Vicente"],
  st: ["São Tomé"],
  dj: ["Djibouti", "Djibuti"],
  kw: ["Kuwait"],
  bh: ["Bahrein"],
  mw: ["Malawi"],
  zw: ["Zimbabwe"],
  bw: ["Botswana"],
  ke: ["Kenya"],
  ki: ["Kiribati"],
  lk: ["Sri Lanka"],
  kg: ["Quirguizistão"],
  uz: ["Uzbequistão"],
  fm: ["Estados Federados da Micronésia"],
  gl: ["Groenlândia"],
  fo: ["Ilhas Faroé"],
  fk: ["Ilhas Falkland", "Falkland"],
  ky: ["Ilhas Cayman", "Cayman"],
  tw: ["Formosa"],
  "gb-wls": ["Gales"],
  cf: ["Centro-Africana"],
  ro: ["Romenia"],
  "us-ny": ["Nova York", "New York"],
  "us-nj": ["Nova Jersey", "New Jersey"],
  "us-ak": ["Alaska"],
  "us-la": ["Louisiana"],
  "us-pa": ["Pennsylvania"],
  "us-hi": ["Hawaii", "Havai"],
  "us-ca": ["California"],
  "us-fl": ["Florida"],
  "us-ga": ["Geórgia", "Georgia"],
  eu: ["UE"],
  un: ["ONU", "Nações Unidas"],
  aq: ["Antarctica"],
};

// Estados dos EUA: nome em inglês (original); a tradução PT fica só como alias aceite ao escrever.
const STATE_EN = {
  ak: "Alaska", al: "Alabama", ar: "Arkansas", az: "Arizona", ca: "California", co: "Colorado", ct: "Connecticut", de: "Delaware",
  fl: "Florida", ga: "Georgia", hi: "Hawaii", ia: "Iowa", id: "Idaho", il: "Illinois", in: "Indiana", ks: "Kansas", ky: "Kentucky",
  la: "Louisiana", ma: "Massachusetts", md: "Maryland", me: "Maine", mi: "Michigan", mn: "Minnesota", mo: "Missouri", ms: "Mississippi",
  mt: "Montana", nc: "North Carolina", nd: "North Dakota", ne: "Nebraska", nh: "New Hampshire", nj: "New Jersey", nm: "New Mexico",
  nv: "Nevada", ny: "New York", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania", ri: "Rhode Island", sc: "South Carolina",
  sd: "South Dakota", tn: "Tennessee", tx: "Texas", ut: "Utah", va: "Virginia", vt: "Vermont", wa: "Washington", wi: "Wisconsin",
  wv: "West Virginia", wy: "Wyoming",
};

const out = [];
for (const [code, ptName] of Object.entries(codes)) {
  if (EXCLUDE.has(code)) continue;
  const kind = code.startsWith("us-") ? "state" : OTHER.has(code) ? "other" : SOVEREIGN.has(code) ? "country" : "territory";
  let tier;
  if (kind === "country") tier = T1.includes(code) ? 1 : T2.includes(code) ? 2 : T4.includes(code) ? 4 : 3;
  else if (kind === "state") tier = STATE_T3.includes(code.slice(3)) ? 3 : 4;
  else if (kind === "other") tier = code === "eu" ? 2 : 3;
  else tier = TERRITORY_T3.includes(code) ? 3 : 4;
  let name = NAME[code] ?? ptName;
  let aliases = ALIASES[code] ?? [];
  if (kind === "state") {
    name = STATE_EN[code.slice(3)];
    aliases = [...new Set([ptName, ...aliases])].filter(a => a !== name);
  }
  const twins = (TWIN_GROUPS.find(g => g.includes(code)) ?? []).filter(c => c !== code);
  if (codesEn[code] && codesEn[code] !== name) aliases = [...new Set([...aliases, codesEn[code]])];
  // "Côte d'Ivoire (Ivory Coast)" -> aceita "Côte d'Ivoire" e "Ivory Coast"
  aliases = [...new Set(aliases.flatMap(a => {
    const m = a.match(/^(.*?)\s*\((.*)\)$/);
    return m ? [m[1], m[2]] : [a];
  }))];
  out.push({ code, name, aliases, kind, tier, twins });
}

// Sanidade: os conjuntos referidos existem e não há nomes repetidos.
const have = new Set(out.map(o => o.code));
const missing = [...SOVEREIGN].filter(c => !have.has(c));
const names = out.map(o => o.name);
const dups = names.filter((n, i) => names.indexOf(n) !== i);

// Escalões revistos pelo utilizador (se existirem) têm prioridade sobre a minha proposta.
const reviewed = new URL("../data/flag-tiers.json", url);
if (existsSync(reviewed)) {
  const t = JSON.parse(readFileSync(reviewed, "utf8"));
  for (const o of out) if (o.code in t) { o.tier = t[o.code] === "x" ? null : Number(t[o.code]); }
}

writeFileSync(new URL("../data/flags.json", url), JSON.stringify(out, null, 2));
const by = {};
for (const o of out) { const k = `${o.kind}/T${o.tier}`; by[k] = (by[k] || 0) + 1; }
console.log("total:", out.length, by);
console.log("soberanos em falta no codes.json:", missing, "| nomes repetidos:", dups);
