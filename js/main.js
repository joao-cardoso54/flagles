// Versões anteriores: js/_old/main-step5.js, main-step6.js e main-step7.js (antes do passo 8: PWA e redesenho).
import { initPlayer, ready, playClip, stop } from "./player.js";
import {
  loadSongs, pickOptions, songLabel, songAnswers,
  loadFlags, flagUrl, pickFlag, pickFlagOptions, flagAnswers,
} from "./data.js";
import { judge, flagEdits, songEdits } from "./text.js";
import { ROUND_SECONDS, LIVES, SONG_POINTS, FLAG_POINTS, SPEED_BONUS_MAX, LEVELS, pickTier, pickByTier } from "./levels.js";
import * as progress from "./progress.js";
import { APP_VERSION } from "./version.js";

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
  $("row-song").hidden = content() === "flags";
  $("row-flag").hidden = content() === "songs";
  $("row-solo").hidden = content() === "flags";
  $("row-terr").hidden = content() === "songs";
  $("row-states").hidden = content() === "songs";
  $("offline-note").hidden = audioOk;
  if (!audioOk) $("offline-note").textContent = "Sem ligação ao YouTube: o áudio não está disponível, por isso só podes jogar com bandeiras.";
  // o recorde mostrado é o do tipo de jogo escolhido (cada um tem o seu progresso)
  const done = progress.highestCompleted(modeKey());
  $("record").textContent = done ? `${modeLabel()}: nível mais alto ${done} · ${progress.totalBest(modeKey())} pontos` : "";
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

let audioOk = true; // false se o YouTube não carregar (sem ligação): joga-se só com bandeiras
const content = () => (audioOk ? settings.content : "flags");
// Cada combinação de conteúdo + forma de responder tem o seu próprio progresso e os seus pontos.
const ANSWER = { options: "Opções", typing: "Escrever" };
function modeKey() {
  if (content() === "songs") return `songs:${settings.songMode}`;
  if (content() === "flags") return `flags:${settings.flagMode}`;
  return `both:${settings.songMode}-${settings.flagMode}`;
}
function modeLabel() {
  if (content() === "songs") return `Beatles · ${ANSWER[settings.songMode]}`;
  if (content() === "flags") return `Bandeiras · ${ANSWER[settings.flagMode]}`;
  if (settings.songMode === settings.flagMode) return `Os dois · ${ANSWER[settings.songMode]}`;
  return `Os dois · música ${ANSWER[settings.songMode]}, bandeira ${ANSWER[settings.flagMode]}`;
}

const hasSongs = () => content() !== "flags";
const hasFlags = () => content() !== "songs";
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
  run = { level: n, mode: modeKey(), round: 0, rounds: LEVELS[n - 1].rounds, lives: LIVES, score: 0, usedSongs: new Set(), usedFlags: new Set() };
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
  window.scrollTo(0, 0);
  // em computador, o cursor vai logo para a caixa de texto (no telemóvel o teclado tapava o ecrã)
  if (matchMedia("(pointer: fine)").matches) {
    if (hasSongs() && settings.songMode === "typing") $("song-input").focus();
    else if (hasFlags() && settings.flagMode === "typing") $("flag-input").focus();
  }
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
// Devolve os pontos ganhos (nível) para mostrar ao jogador.
function score(ok, points) {
  let gained = 0;
  if (inLevel()) {
    if (ok) {
      // bónus de rapidez: quanto mais tempo sobra no relógio, mais pontos
      const left = Math.max(0, deadline - Date.now()) / (ROUND_SECONDS * 1000);
      gained = points + Math.round(SPEED_BONUS_MAX * left);
      run.score += gained;
    } else loseLife();
    if (!ok) try { navigator.vibrate?.(120); } catch (e) {}
    renderHud();
  } else {
    total++;
    if (ok) right++;
    $("score").textContent = `Certas: ${right} / ${total}`;
  }
  return gained;
}

// Cria um botão de opção; `isCorrect` marca-o como a resposta certa quando se revela.
function optionButton(text, isCorrect, onPick, i = 0) {
  const b = document.createElement("button");
  b.className = "btn option";
  b.style.setProperty("--i", i);
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
    pickOptions(song, songs).forEach((opt, i) => {
      $("options").appendChild(optionButton(songLabel(opt), opt === song, b => answerSong(opt === song, b), i));
    });
  }
}

function answerSong(ok, btn) {
  if (songDone) return;
  songDone = true;
  reveal($("options"), btn, ok);
  $("song-input").disabled = true;
  advanceBtn.disabled = true;
  const gained = score(ok, SONG_POINTS[step]);
  $("result").textContent = ok ? `Certo!${gained ? ` +${gained}` : ""}` : `Errado. Era: ${songLabel(song)}`;
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
  $("q-song").classList.add("playing");
  try {
    await playClip(song.videoId, LADDER[step]);
    statusEl.textContent = "Fim do excerto";
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    $("q-song").classList.remove("playing");
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
  const img = $("flag-img");
  img.classList.remove("loaded");
  img.onload = () => img.classList.add("loaded");
  img.src = flagUrl(flag.code);
  $("flag-result").textContent = "";
  const typing = settings.flagMode === "typing";
  $("flag-options").hidden = typing;
  $("flag-form").hidden = !typing;
  $("flag-options").innerHTML = "";
  if (typing) {
    $("flag-input").value = "";
    $("flag-input").disabled = false;
  } else {
    pickFlagOptions(flag, flags).forEach((opt, i) => {
      $("flag-options").appendChild(optionButton(opt.name, opt === flag, b => answerFlag(opt === flag, b), i));
    });
  }
}

function answerFlag(ok, btn) {
  if (flagDone) return;
  flagDone = true;
  reveal($("flag-options"), btn, ok);
  $("flag-input").disabled = true;
  const gained = score(ok, FLAG_POINTS);
  $("flag-result").textContent = ok ? `Certo!${gained ? ` +${gained}` : ""}` : `Errado. Era: ${flag.name}`;
  afterAnswer();
}

/* ------------------------------------------------------------------ níveis e resultados */

function renderLevels() {
  const grid = $("level-grid");
  grid.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const n = i + 1;
    const best = progress.bestScore(modeKey(), n);
    const b = document.createElement("button");
    b.className = "level-card" + (best != null ? " done" : "");
    b.disabled = !progress.isUnlocked(modeKey(), n);
    b.innerHTML = `<strong>${n}</strong><small>${lv.rounds} rondas</small><small>${b.disabled ? "Bloqueado" : best != null ? `Melhor ${best}` : "Por jogar"}</small>`;
    b.addEventListener("click", () => startLevel(n));
    grid.appendChild(b);
  });
  $("levels-total").textContent = `Pontos: ${progress.totalBest(modeKey())}`;
  $("levels-mode").textContent = modeLabel();
}

function showResult(win) {
  stopTimer();
  stop();
  const n = run.level;
  let record = false;
  if (win) record = progress.complete(run.mode, n, run.score);
  $("res-title").textContent = win ? `Nível ${n} concluído` : `Nível ${n}: sem vidas`;
  countUp($("res-score"), run.score);
  confetti(win);
  const best = progress.bestScore(run.mode, n);
  $("res-detail").textContent = win
    ? `${record ? "Novo recorde! " : ""}Vidas que sobraram: ${run.lives}${best != null && !record ? ` · Melhor: ${best}` : ""}`
    : `Chegaste à ronda ${run.round} de ${run.rounds}.`;
  $("res-next").hidden = !(win && n < LEVELS.length);
  show("result-screen");
}

// Número a subir até ao valor final.
function countUp(el, to) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || to === 0) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 900;
  const frame = now => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function confetti(on) {
  const box = $("confetti");
  box.innerHTML = "";
  if (!on || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#1f4fd8", "#d23a2a", "#f5b700", "#1e8a4c", "#f5f0e6"];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement("i");
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${1.6 + Math.random() * 1.8}s`;
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    box.appendChild(c);
  }
}

// Diálogo de confirmação (em vez do confirm() do browser).
function askLeave() {
  return new Promise(resolve => {
    const d = $("confirm");
    d.returnValue = "";
    d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
    d.showModal();
  });
}

/* ------------------------------------------------------------------ ligações */

initPlayer("yt");
// Sem ligação o YouTube nunca carrega: ao fim de 8s passa a jogar-se só com bandeiras (e volta ao normal se carregar depois).
const audioReady = Promise.race([ready().then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]);
// antes: Promise.all([ready(), loadSongs(), loadFlags()])
Promise.all([audioReady, loadSongs(), loadFlags()])
  .then(([ok, s, f]) => {
    audioOk = ok;
    ALL_SONGS = s;
    ALL_FLAGS = f;
    $("play-levels").disabled = false;
    $("play-levels").textContent = "Jogar";
    $("play").disabled = false;
    renderMenu();
    precacheFlags(f);
    if (!ok) ready().then(() => { audioOk = true; renderMenu(); });
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

$("menu-btn").addEventListener("click", async () => {
  // antes: if (inLevel() && !confirm("Sair do nível? Perdes o progresso desta tentativa.")) return;
  if (inLevel() && !(await askLeave())) return;
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

/* ------------------------------------------------------------------ PWA */

$("version").textContent = `v${APP_VERSION}`;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Guarda todas as bandeiras em segundo plano para jogar offline (só na 1.ª vez; o service worker ignora as que já tem).
function precacheFlags(all) {
  if (!("serviceWorker" in navigator) || !navigator.onLine) return;
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({ type: "precache-flags", urls: all.map(f => flagUrl(f.code)) });
  }).catch(() => {});
}

// Android/Chrome: botão "Instalar a app".
let installEvent = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installEvent = e;
  $("install").hidden = false;
});
$("install").addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $("install").hidden = true;
});
addEventListener("appinstalled", () => { $("install").hidden = true; });

// iPhone: não há botão de instalar; mostra a dica enquanto a app não estiver instalada.
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (isIOS && !standalone) $("ios-tip").hidden = false;
