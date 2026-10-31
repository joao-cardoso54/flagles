// Versão anterior (passo 5, só 2 modos globais) guardada em js/_old/main-step5.js.
import { initPlayer, ready, playClip, stop } from "./player.js";
import {
  loadSongs, pickOptions, songLabel, songAnswers,
  loadFlags, flagUrl, pickFlag, pickFlagOptions, flagAnswers,
} from "./data.js";
import { judge, flagEdits, songEdits } from "./text.js";

// Escada de tempos do excerto. 1.º valor = excerto inicial.
export const LADDER = [1, 2, 3, 5, 8, 15];

const $ = id => document.getElementById(id);

/* ------------------------------------------------------------------ definições */

const DEFAULTS = { content: "both", songMode: "options", flagMode: "options", solo: true, territories: true, states: true };
const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem("flagles-settings") || "{}")); } catch (e) {}

function saveSettings() {
  try { localStorage.setItem("flagles-settings", JSON.stringify(settings)); } catch (e) {}
}

// Marca o botão ativo de um grupo segmentado.
function markSeg(id, value) {
  for (const b of $(id).children) b.classList.toggle("on", b.dataset.v === value);
}

function renderMenu() {
  markSeg("content", settings.content);
  markSeg("mode-song", settings.songMode);
  markSeg("mode-flag", settings.flagMode);
  $("opt-solo").checked = settings.solo;
  $("opt-terr").checked = settings.territories;
  $("opt-states").checked = settings.states;
  // só mostra o que é relevante para o conteúdo escolhido
  $("row-song").hidden = settings.content === "flags";
  $("row-flag").hidden = settings.content === "songs";
  $("row-solo").hidden = settings.content === "flags";
  $("row-terr").hidden = settings.content === "songs";
  $("row-states").hidden = settings.content === "songs";
}

function bindSeg(id, key) {
  $(id).addEventListener("click", e => {
    if (!e.target.dataset.v) return;
    settings[key] = e.target.dataset.v;
    saveSettings();
    renderMenu();
  });
}
bindSeg("content", "content");
bindSeg("mode-song", "songMode");
bindSeg("mode-flag", "flagMode");
$("opt-solo").addEventListener("change", e => { settings.solo = e.target.checked; saveSettings(); });
$("opt-terr").addEventListener("change", e => { settings.territories = e.target.checked; saveSettings(); });
$("opt-states").addEventListener("change", e => { settings.states = e.target.checked; saveSettings(); });

/* ------------------------------------------------------------------ estado do jogo */

let ALL_SONGS = [], ALL_FLAGS = [];
let songs = [], flags = [];          // pools depois de aplicar as definições
let song = null, flag = null;
let step = 0;                        // posição na escada (índice de LADDER)
let songDone = true, flagDone = true;
let right = 0, total = 0;

const playBtn = $("play");
const listenBtn = $("listen");
const advanceBtn = $("advance");
const statusEl = $("status");

const hasSongs = () => settings.content !== "flags";
const hasFlags = () => settings.content !== "songs";

function buildPools() {
  songs = ALL_SONGS.filter(s => settings.solo || s.group === "beatles");
  // países: sempre; estados dos EUA: opção própria; territórios e "outros" (UE, ONU, Antártida): opção dos territórios
  flags = ALL_FLAGS.filter(f => f.kind === "country" || (f.kind === "state" ? settings.states : settings.territories));
  // antes (passo 5b): flags = ALL_FLAGS.filter(f => settings.territories || f.kind === "country");
}

const randomOf = (arr, not) => {
  let x;
  do { x = arr[Math.floor(Math.random() * arr.length)]; } while (x === not && arr.length > 1);
  return x;
};

/* ------------------------------------------------------------------ ronda */

function newRound() {
  songDone = !hasSongs();
  flagDone = !hasFlags();
  $("q-song").hidden = !hasSongs();
  $("q-flag").hidden = !hasFlags();
  $("next").hidden = true;

  if (hasSongs()) {
    song = randomOf(songs, song);
    renderSong();
  }
  if (hasFlags()) {
    // com música, a bandeira é do mesmo escalão; sem música, é aleatória
    flag = hasSongs() ? pickFlag(flags, song.tier, flag) : randomOf(flags, flag);
    renderFlag();
  }
}

function maybeFinishRound() {
  if (songDone && flagDone) $("next").hidden = false;
}

function setScore(ok) {
  total++;
  if (ok) right++;
  $("score").textContent = `Certas: ${right} / ${total}`;
}

// Cria um botão de opção; `isCorrect` marca-o como a resposta certa quando se revela.
function optionButton(text, isCorrect, onPick) {
  const b = document.createElement("button");
  b.className = "btn option";
  b.textContent = text;
  b.dataset.correct = isCorrect ? "1" : "";
  b.addEventListener("click", () => onPick(b));
  return b;
}

function reveal(box, picked, ok) {
  for (const b of box.children) {
    b.disabled = true;
    if (b.dataset.correct) b.classList.add("correct");
  }
  if (!ok && picked) picked.classList.add("wrong");
}

/* ---- música ---- */

function renderSong() {
  step = 0;
  $("result").textContent = "";
  renderSteps();
  const typing = settings.songMode === "typing";
  $("options").hidden = typing;
  $("song-form").hidden = !typing;
  $("options").innerHTML = "";
  if (typing) {
    $("song-input").value = "";
    $("song-input").disabled = false;
  } else {
    for (const opt of pickOptions(song, songs)) {
      $("options").appendChild(optionButton(songLabel(opt), opt === song, b => answerSong(opt === song, b)));
    }
  }
}

function answerSong(ok, btn) {
  if (songDone) return;
  songDone = true;
  reveal($("options"), btn, ok);
  $("song-input").disabled = true;
  $("result").textContent = ok ? "Certo!" : `Errado. Era: ${songLabel(song)}`;
  setScore(ok);
  advanceBtn.disabled = true;
  maybeFinishRound();
}

// Mostra a escada: tempos já desbloqueados a cheio, o atual destacado.
function renderSteps() {
  $("steps").innerHTML = LADDER
    .map((s, i) => `<span class="step${i < step ? " done" : ""}${i === step ? " current" : ""}">${s}s</span>`)
    .join("");
  listenBtn.textContent = `Ouvir ${LADDER[step]}s`;
  const last = step === LADDER.length - 1;
  advanceBtn.disabled = songDone || last;
  advanceBtn.textContent = last ? "Máximo" : `Avançar (${LADDER[step + 1]}s)`;
  statusEl.innerHTML = "&nbsp;";
}

// Toca o excerto atual desde o início, sem mexer na escada.
async function listen() {
  listenBtn.disabled = true;
  advanceBtn.disabled = true;
  statusEl.textContent = "A tocar…";
  try {
    await playClip(song.videoId, LADDER[step]);
    statusEl.textContent = "Fim do excerto";
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    listenBtn.disabled = false;
    advanceBtn.disabled = songDone || step === LADDER.length - 1;
  }
}

// Sobe um degrau e toca desde o início com mais tempo.
function advance() {
  if (step >= LADDER.length - 1) return;
  step++;
  renderSteps();
  listen();
}

/* ---- bandeira ---- */

function renderFlag() {
  $("flag-img").src = flagUrl(flag.code);
  $("flag-result").textContent = "";
  const typing = settings.flagMode === "typing";
  $("flag-options").hidden = typing;
  $("flag-form").hidden = !typing;
  $("flag-options").innerHTML = "";
  if (typing) {
    $("flag-input").value = "";
    $("flag-input").disabled = false;
  } else {
    for (const opt of pickFlagOptions(flag, flags)) {
      $("flag-options").appendChild(optionButton(opt.name, opt === flag, b => answerFlag(opt === flag, b)));
    }
  }
}

function answerFlag(ok, btn) {
  if (flagDone) return;
  flagDone = true;
  reveal($("flag-options"), btn, ok);
  $("flag-input").disabled = true;
  $("flag-result").textContent = ok ? "Certo!" : `Errado. Era: ${flag.name}`;
  setScore(ok);
  maybeFinishRound();
}

/* ------------------------------------------------------------------ ligações */

initPlayer("yt");
Promise.all([ready(), loadSongs(), loadFlags()])
  .then(([, s, f]) => {
    ALL_SONGS = s;
    ALL_FLAGS = f;
    playBtn.disabled = false;
    playBtn.textContent = "Jogar";
  })
  .catch(err => { playBtn.textContent = err.message; });

playBtn.addEventListener("click", () => {
  buildPools();
  right = 0; total = 0;
  $("score").textContent = "Certas: 0 / 0";
  $("home").hidden = true;
  $("game").hidden = false;
  newRound();
  if (hasSongs()) listen(); // dentro do toque em "Jogar": desbloqueia o áudio no iOS
});

$("next").addEventListener("click", () => {
  newRound();
  if (hasSongs()) listen();
});

$("menu-btn").addEventListener("click", () => {
  stop();
  $("game").hidden = true;
  $("home").hidden = false;
});

listenBtn.addEventListener("click", listen);
advanceBtn.addEventListener("click", advance);

$("song-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("song-input").value;
  if (songDone || !v.trim()) return;
  // antes: answerSong(isMatch(v, songAnswers(song), songEdits), null);
  const others = ALL_SONGS.filter(x => x.title !== song.title).map(songAnswers);
  answerSong(judge(v, songAnswers(song), others, songEdits), null);
});

$("flag-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("flag-input").value;
  if (flagDone || !v.trim()) return;
  // antes: isMatch(v, [flag.name, ...flag.aliases], flagEdits)
  // gémeas (bandeira idêntica) não contam como "outras"
  const others = ALL_FLAGS.filter(x => x !== flag && !(flag.twins || []).includes(x.code)).map(x => flagAnswers(x, ALL_FLAGS));
  answerFlag(judge(v, flagAnswers(flag, ALL_FLAGS), others, flagEdits), null);
});

renderMenu();
