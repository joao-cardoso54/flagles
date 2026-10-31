// passo 2/3: import { SONGS } from "./songs.js";  (lista de 25 de teste, substituída por data/songs-tiered.json)
import { loadSongs, pickOptions, loadFlags, flagUrl, pickFlag, pickFlagOptions } from "./data.js";
import { isMatch, flagEdits } from "./text.js";
import { initPlayer, ready, playClip } from "./player.js";

// Escada de tempos (passo 3 vai usá-la). 1.º valor = excerto inicial.
export const LADDER = [1, 2, 3, 5, 8, 15];

const $ = id => document.getElementById(id);
const playBtn = $("play");
const listenBtn = $("listen");
const statusEl = $("status");

const advanceBtn = $("advance");

let POOL = [];
let FLAGS = [];
let song = null;
let flag = null;
let answered = false;       // música respondida
let flagAnswered = false;   // bandeira respondida
let mode = "options";       // "options" | "typing" (escrever só está ligado nas bandeiras; músicas: passo 6)
let right = 0, total = 0;
let step = 0; // posição atual na escada (índice de LADDER)

function pickSong() {
  let next;
  do { next = POOL[Math.floor(Math.random() * POOL.length)]; } while (next === song && POOL.length > 1);
  song = next;
  step = 0;
  answered = false;
  // passo 2/3: $("answer").textContent = "?";
  $("result").textContent = "";
  $("next").hidden = true;
  renderSteps();
  renderOptions();
  pickRoundFlag();
}

// Cada ronda tem uma bandeira do mesmo escalão que a música.
function pickRoundFlag() {
  flag = pickFlag(FLAGS, song.tier, flag);
  flagAnswered = false;
  $("flag-img").src = flagUrl(flag.code);
  $("flag-result").textContent = "";
  const typing = mode === "typing";
  $("flag-options").hidden = typing;
  $("flag-form").hidden = !typing;
  $("flag-options").innerHTML = "";
  if (typing) {
    $("flag-input").value = "";
    $("flag-input").disabled = false;
  } else {
    for (const opt of pickFlagOptions(flag, FLAGS)) {
      const b = document.createElement("button");
      b.className = "btn option";
      b.textContent = opt.name;
      b.addEventListener("click", () => answerFlag(opt === flag, b));
      $("flag-options").appendChild(b);
    }
  }
}

function answerFlag(ok, btn) {
  if (flagAnswered) return;
  flagAnswered = true;
  total++;
  if (ok) right++;
  for (const b of $("flag-options").children) {
    b.disabled = true;
    if (b.textContent === flag.name) b.classList.add("correct");
  }
  if (!ok && btn) btn.classList.add("wrong");
  $("flag-input").disabled = true;
  $("flag-result").textContent = ok ? "Certo!" : `Errado. Era: ${flag.name}`;
  $("score").textContent = `Certas: ${right} / ${total}`;
  maybeFinishRound();
}

// "Seguinte" só aparece quando as duas perguntas da ronda estão respondidas.
function maybeFinishRound() {
  if (answered && flagAnswered) $("next").hidden = false;
}

function renderOptions() {
  const box = $("options");
  box.innerHTML = "";
  for (const opt of pickOptions(song, POOL)) {
    const b = document.createElement("button");
    b.className = "btn option";
    b.textContent = opt.title;
    b.addEventListener("click", () => answer(opt, b));
    box.appendChild(b);
  }
}

// Valida a escolha: marca a certa a verde e, se errou, a escolhida a vermelho.
function answer(opt, btn) {
  if (answered) return;
  answered = true;
  total++;
  const ok = opt === song;
  if (ok) right++;
  for (const b of $("options").children) {
    b.disabled = true;
    if (b.textContent === song.title) b.classList.add("correct");
  }
  if (!ok) btn.classList.add("wrong");
  $("result").textContent = ok ? "Certo!" : `Errado. Era: ${song.title}`;
  $("score").textContent = `Certas: ${right} / ${total}`;
  // passo 4: $("next").hidden = false;
  maybeFinishRound();
  advanceBtn.disabled = true;
}

// Mostra a escada: tempos já desbloqueados a cheio, o atual destacado.
function renderSteps() {
  $("steps").innerHTML = LADDER
    .map((s, i) => `<span class="step${i < step ? " done" : ""}${i === step ? " current" : ""}">${s}s</span>`)
    .join("");
  listenBtn.textContent = `Ouvir ${LADDER[step]}s`;
  const last = step === LADDER.length - 1;
  advanceBtn.disabled = last;
  advanceBtn.textContent = last ? "Máximo" : `Avançar (${LADDER[step + 1]}s)`;
}

// Toca o excerto atual desde o início, sem mexer na escada.
async function listen() {
  listenBtn.disabled = true;
  advanceBtn.disabled = true;
  statusEl.textContent = "A tocar…";
  try {
    // antes (passo 2): await playClip(song.videoId, LADDER[0]);
    await playClip(song.videoId, LADDER[step]);
    statusEl.textContent = "Fim do excerto";
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    listenBtn.disabled = false;
    advanceBtn.disabled = answered || step === LADDER.length - 1;
  }
}

// Sobe um degrau e toca desde o início com mais tempo.
function advance() {
  if (step >= LADDER.length - 1) return;
  step++;
  renderSteps();
  listen();
}

initPlayer("yt");
Promise.all([ready(), loadSongs(), loadFlags()])
  .then(([, songs, flags]) => {
    POOL = songs;
    FLAGS = flags;
    playBtn.disabled = false;
    playBtn.textContent = "Jogar";
  })
  .catch(err => { playBtn.textContent = err.message; });

playBtn.addEventListener("click", () => {
  $("home").hidden = true;
  $("test").hidden = false;
  pickSong();
  listen(); // dentro do toque em "Jogar": desbloqueia o áudio no iOS
});

listenBtn.addEventListener("click", listen);
advanceBtn.addEventListener("click", advance);
// passo 2/3:
// $("reveal").addEventListener("click", () => { $("answer").textContent = song.title; });
// $("next").addEventListener("click", () => { pickSong(); listen(); });
$("next").addEventListener("click", () => { pickSong(); listen(); });

// Modo de resposta (guardado neste telemóvel).
try { mode = localStorage.getItem("flagles-mode") === "typing" ? "typing" : "options"; } catch (e) {}
function setMode(m) {
  mode = m;
  try { localStorage.setItem("flagles-mode", m); } catch (e) {}
  for (const b of $("mode").children) b.classList.toggle("on", b.dataset.m === m);
}
setMode(mode);
$("mode").addEventListener("click", e => { if (e.target.dataset.m) setMode(e.target.dataset.m); });

$("flag-form").addEventListener("submit", e => {
  e.preventDefault();
  if (flagAnswered || !$("flag-input").value.trim()) return;
  answerFlag(isMatch($("flag-input").value, [flag.name, ...flag.aliases], flagEdits), null);
});
