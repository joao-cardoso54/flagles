// Comparação de texto tolerante. Ignora:
// - maiúsculas, acentos e pontuação ("you've" = "youve" = "you ve" = "You've")
// - espaços (compara sem espaços: "heyjude" = "hey jude")
// - sufixos de edição "(Remastered 2009)", "- 2009 Remaster"
// - artigo inicial ("the end" = "end", "a hard day's night" = "hard day's night")
// e aceita alguns erros de escrita (distância de Levenshtein), conforme o comprimento.

const SUFFIX = /\s-\s.*\b(remaster(ed)?|mix|version|mono|stereo|demo|edit)\b.*$/;
const ARTICLE = /^(the|a|an) /; // aplicado ao texto normalizado (ainda com espaços): "arkansas" não é "a" + "rkansas"

export function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // acentos
    .replace(/\(.*?\)|\[.*?\]/g, " ") // (Remastered 2009), [Live]
    .replace(SUFFIX, "")              // "- 2009 Remaster"
    .replace(/&/g, " and ")
    .replace(/['’‘`´]/g, "")          // apóstrofos desaparecem: you've -> youve
    .replace(/[^a-z0-9]+/g, " ")      // restante pontuação -> espaço
    .trim();
}

// Variantes de um texto, já sem espaços: tal como está e sem o artigo inicial.
function variants(s) {
  const n = normalize(s);
  const noArticle = n.replace(ARTICLE, "");
  const out = [n.replace(/ /g, "")];
  if (noArticle && noArticle !== n) out.push(noArticle.replace(/ /g, ""));
  return out;
}

// Distância de Damerau-Levenshtein (inserir, apagar, trocar e trocar duas letras seguidas contam 1).
export function distance(a, b) {
  if (a === b) return 0;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Nº de erros aceites conforme o comprimento da resposta certa (sem espaços).
// Só se compara com UMA resposta, por isso ser generoso é seguro, exceto em pares
// de nomes quase iguais (Áustria/Austrália, Níger/Nigéria): aí a distância é 2.
export const flagEdits = len => (len >= 12 ? 2 : len >= 5 ? 1 : 0);
export const songEdits = len => (len >= 16 ? 3 : len >= 9 ? 2 : len >= 4 ? 1 : 0);

// `answers`: todas as formas aceites (nome + aliases). Verdadeiro se o texto bate com alguma.
export function isMatch(input, answers, editsFor) {
  const xs = variants(input).filter(Boolean);
  if (!xs.length) return false;
  return answers.some(a =>
    variants(a).some(y => y && xs.some(x => x === y || distance(x, y) <= editsFor(y.length))),
  );
}

// Como isMatch, mas sem erros de escrita (só ignora maiúsculas, acentos, pontuação, espaços e artigo).
export const exactMatch = (input, answers) => isMatch(input, answers, () => 0);

// Veredicto final: bate com a resposta certa E, se bate exatamente com OUTRA resposta
// (ex.: "Revolution" quando a certa é "Revolution #9", "Kansas" quando é "Arkansas"),
// só vale se também bater exatamente com a certa.
export function judge(input, answers, othersAnswers, editsFor) {
  if (!isMatch(input, answers, editsFor)) return false;
  if (exactMatch(input, answers)) return true;
  return !othersAnswers.some(o => exactMatch(input, o));
}
