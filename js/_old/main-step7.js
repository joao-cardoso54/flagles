// Versões anteriores: js/_old/main-step5.js (2 modos globais) e js/_old/main-step6.js (sem níveis/vidas/relógio).
import { initPlayer, ready, playClip, stop } from "./player.js";
import {
  loadSongs, pickOptions, songLabel, songAnswers,
  loadFlags, flagUrl, pickFlag, pickFlagOptions, flagAnswers,
} from "./data.js";
import { judge, flagEdits, songEdits } from "./text.js";
import { ROUND_SECONDS, LIVES, SONG_POINTS, FLAG_POINTS, LEVELS, pickTier, pickByTier } from "./levels.js";
import * as progress from "./progress.js";

// Escada de tempos do excerto. 1.º valor = excerto inicial. (SONG_POINTS em levels.js segue a mesma ordem.)
export const LADDER = [1, 2, 3, 5, 8, 15];

const $ = id => document.getElementById(id);
const SCREENS = ["home", "levels", "game", "result-screen"];
function show(name) {
  for (const s of SCREENS) $(s).hidden = s !== name;
}

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
  const done = progress.highestCompleted();
  $("record").textContent = done ? `Nível mais alto concluído: ${done} · Pontos (soma dos melhores): ${progress.totalBest()}` : "";
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

// Treino livre: sem vidas nem relógio. Nível: run.level != null.
let run = null;                      // { level, round, rounds, lives, score, usedSongs, usedFlags }
let right = 0, total = 0;            // contador do treino
let timerId = null, deadline = 0;

const hasSongs = () => settings.content !== "flags";
const hasFlags = () => settings.content !== "songs";
const inLevel = () => run && run.level != null;

const listenBtn = $("listen");
const advanceBtn = $("advance");
const statusEl = $("status");

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

/* ------------------------------------------------------------------ início de jogo */

function startTraining() {
  buildPools();
  run = { level: null };
  right = 0; total = 0;
  $("score").textContent = "Certas: 0 / 0";
  $("hud").hidden = true;
  $("timer").hidden = true;
  show("game");
  newRound();
  if (hasSongs()) listen(); // dentro do toque: desbloqueia o áudio no iOS
}

function startLevel(n) {
  buildPools();
  run = { level: n, round: 0, rounds: LEVELS[n - 1].rounds, lives: LIVES, score: 0, usedSongs: new Set(), usedFlags: new Set() };
  $("hud").hidden = false;
  $("timer").hidden = false;
  show("game");
  newRound();
  if (hasSongs()) listen();
}

/* ------------------------------------------------------------------ HUD */

function renderHud() {
  if (!inLevel()) return;
  $("hud-level").textContent = `Nível ${run.level} · ronda ${run.round}/${run.rounds}`;
  $("lives").innerHTML = Array.from({ length: LIVES }, (_, i) =>
    `<span class="heart${i >= run.lives ? " lost" : ""}">&#9829;</span>`).join("");
  $("score").textContent = `Pontos: ${run.score}`;
}

/* ------------------------------------------------------------------ relógio */

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function startTimer() {
  stopTimer();
  deadline = Date.now() + ROUND_SECONDS * 1000;
  tick();
  timerId = setInterval(tick, 100);
}

function tick() {
  const left = Math.max(0, deadline - Date.now());
  $("timer-bar").style.width = `${(left / (ROUND_SECONDS * 1000)) * 100}%`;
  $("timer-bar").classList.toggle("low", left <= 8000);
  $("timer-text").textContent = `${Math.ceil(left / 1000)}s`;
  if (left <= 0) timeUp();
}

// Acabou o tempo: o que ficou por responder conta como erro (1 vida cada) e mostra-se a resposta certa.
function timeUp() {
  stopTimer();
  stop();
  if (!songDone) {
    songDone = true;
    reveal($("options"), null, false);
    $("song-input").disabled = true;
    $("result").textContent = `Tempo! Era: ${songLabel(song)}`;
    loseLife();
  }
  if (!flagDone) {
    flagDone = true;
    reveal($("flag-options"), null, false);
    $("flag-input").disabled = true;
    $("flag-result").textContent = `Tempo! Era: ${flag.name}`;
    loseLife();
  }
  advanceBtn.disabled = true;
  finishRound();
}

function loseLife() {
  run.lives = Math.max(0, run.lives - 1);
  renderHud();
}

/* ------------------------------------------------------------------ ronda */

function newRound() {
  songDone = !hasSongs();
  flagDone = !hasFlags();
  $("q-song").hidden = !hasSongs();
  $("q-flag").hidden = !hasFlags();
  $("next").hidden = true;

  if (inLevel()) {
    run.round++;
    const tier = pickTier(LEVELS[run.level - 1].w);
    if (hasSongs()) { song = pickByTier(songs, tier, run.usedSongs); run.usedSongs.add(song); }
    if (hasFlags()) {
      // com música, a bandeira é do mesmo escalão que a música (que pode ter caído num escalão vizinho)
      flag = pickByTier(flags, hasSongs() ? song.tier : tier, run.usedFlags);
      run.usedFlags.add(flag);
    }
    renderHud();
  } else {
    if (hasSongs()) song = randomOf(songs, song);
    // com música, a bandeira é do mesmo escalão; sem música, é aleatória
    if (hasFlags()) flag = hasSongs() ? pickFlag(flags, song.tier, flag) : randomOf(flags, flag);
  }

  if (hasSongs()) renderSong();
  if (hasFlags()) renderFlag();
  if (inLevel()) startTimer();
}

// Chamado depois de cada resposta. Em nível, 0 vidas termina a ronda já (o resto revela-se sem custo).
function afterAnswer() {
  if (inLevel() && run.lives === 0) {
    stopTimer();
    stop();
    if (!songDone) { songDone = true; reveal($("options"), null, false); $("song-input").disabled = true; $("result").textContent = `Era: ${songLabel(song)}`; }
    if (!flagDone) { flagDone = true; reveal($("flag-options"), null, false); $("flag-input").disabled = true; $("flag-result").textContent = `Era: ${flag.name}`; }
    advanceBtn.disabled = true;
  }
  if (songDone && flagDone) finishRound();
}

function finishRound() {
  stopTimer();
  const btn = $("next");
  if (inLevel() && run.lives === 0) btn.textContent = "Ver resultado";
  else if (inLevel() && run.round >= run.rounds) btn.textContent = "Concluir nível";
  else btn.textContent = "Seguinte";
  btn.hidden = false;
}

// Regista o resultado de uma resposta: treino conta certas; nível dá pontos ou tira uma vida.
function score(ok, points) {
  if (inLevel()) {
    if (ok) run.score += points;
    else loseLife();
    renderHud();
  } else {
    total++;
    if (ok) right++;
    $("score").textContent = `Certas: ${right} / ${total}`;
  }
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
  advanceBtn.disabled = true;
  score(ok, SONG_POINTS[step]);
  afterAnswer();
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
  score(ok, FLAG_POINTS);
  afterAnswer();
}

/* ------------------------------------------------------------------ níveis e resultados */

function renderLevels() {
  const grid = $("level-grid");
  grid.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const n = i + 1;
    const best = progress.bestScore(n);
    const b = document.createElement("button");
    b.className = "level-card" + (best != null ? " done" : "");
    b.disabled = !progress.isUnlocked(n);
    b.innerHTML = `<strong>${n}</strong><small>${lv.rounds} rondas</small><small>${b.disabled ? "Bloqueado" : best != null ? `Melhor ${best}` : "Por jogar"}</small>`;
    b.addEventListener("click", () => startLevel(n));
    grid.appendChild(b);
  });
  $("levels-total").textContent = `Pontos: ${progress.totalBest()}`;
}

function showResult(win) {
  stopTimer();
  stop();
  const n = run.level;
  let record = false;
  if (win) record = progress.complete(n, run.score);
  $("res-title").textContent = win ? `Nível ${n} concluído` : `Nível ${n}: sem vidas`;
  $("res-score").textContent = `${run.score}`;
  const best = progress.bestScore(n);
  $("res-detail").textContent = win
    ? `${record ? "Novo recorde! " : ""}Vidas que sobraram: ${run.lives}${best != null && !record ? ` · Melhor: ${best}` : ""}`
    : `Chegaste à ronda ${run.round} de ${run.rounds}.`;
  $("res-next").hidden = !(win && n < LEVELS.length);
  show("result-screen");
}

/* ------------------------------------------------------------------ ligações */

initPlayer("yt");
Promise.all([ready(), loadSongs(), loadFlags()])
  .then(([, s, f]) => {
    ALL_SONGS = s;
    ALL_FLAGS = f;
    $("play-levels").disabled = false;
    $("play-levels").textContent = "Jogar";
    $("play").disabled = false;
  })
  .catch(err => { $("play-levels").textContent = err.message; });

$("play").addEventListener("click", startTraining);
$("play-levels").addEventListener("click", () => { renderLevels(); show("levels"); });
$("levels-back").addEventListener("click", () => { renderMenu(); show("home"); });

$("next").addEventListener("click", () => {
  if (inLevel() && run.lives === 0) return showResult(false);
  if (inLevel() && run.round >= run.rounds) return showResult(true);
  newRound();
  if (hasSongs()) listen();
});

$("menu-btn").addEventListener("click", () => {
  if (inLevel() && !confirm("Sair do nível? Perdes o progresso desta tentativa.")) return;
  stopTimer();
  stop();
  if (inLevel()) { renderLevels(); show("levels"); } else { renderMenu(); show("home"); }
});

$("res-next").addEventListener("click", () => startLevel(run.level + 1));
$("res-retry").addEventListener("click", () => startLevel(run.level));
$("res-levels").addEventListener("click", () => { renderLevels(); show("levels"); });

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
  // gémeas (bandeira idêntica) não contam como "outras"
  const others = ALL_FLAGS.filter(x => x !== flag && !(flag.twins || []).includes(x.code)).map(x => flagAnswers(x, ALL_FLAGS));
  answerFlag(judge(v, flagAnswers(flag, ALL_FLAGS), others, flagEdits), null);
});

renderMenu();
