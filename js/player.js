// Wrapper do YouTube iFrame API: toca os primeiros N segundos de um vídeo.
// Decisões:
// - O player é criado ao abrir a página, para estar pronto quando se carrega em "Jogar".
// - playClip() é síncrono até ao playVideo/loadVideoById, para correr dentro do toque do
//   utilizador (exigência do iOS).
// - O tempo conta a partir do evento PLAYING (estado 1), não do clique: assim o buffering
//   não come segundos ao excerto.

const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
const START_TIMEOUT_MS = 8000;

let player = null;
let currentId = null;
let run = 0; // identifica o excerto em curso; invalida timers antigos

let resolveReady;
const readyPromise = new Promise(r => (resolveReady = r));
let active = null; // { token, seconds, timer, startTimer, resolve, reject, started }

export function ready() {
  return readyPromise;
}

export function initPlayer(elementId) {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(elementId, {
      width: 200,
      height: 200,
      playerVars: { controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => resolveReady(),
        onStateChange: onStateChange,
        onError: e => finish(new Error(`Erro do YouTube (${e.data})`)),
      },
    });
  };
}

function onStateChange(e) {
  if (!active) return;
  if (e.data === STATE.PLAYING && !active.started) {
    active.started = true;
    clearTimeout(active.startTimer);
    const token = active.token;
    active.timer = setTimeout(() => {
      if (!active || active.token !== token) return;
      player.pauseVideo();
      finish();
    }, active.seconds * 1000);
  } else if (e.data === STATE.ENDED) {
    finish();
  }
}

function finish(err) {
  if (!active) return;
  const a = active;
  active = null;
  clearTimeout(a.timer);
  clearTimeout(a.startTimer);
  err ? a.reject(err) : a.resolve();
}

// Toca `seconds` segundos desde o início. Resolve quando o excerto acaba.
export function playClip(videoId, seconds) {
  stop();
  const token = ++run;
  return new Promise((resolve, reject) => {
    active = { token, seconds, resolve, reject, started: false };
    active.startTimer = setTimeout(() => {
      if (active && active.token === token && !active.started) {
        player.pauseVideo();
        finish(new Error("O áudio não arrancou (timeout)"));
      }
    }, START_TIMEOUT_MS);

    if (videoId !== currentId) {
      currentId = videoId;
      player.loadVideoById({ videoId, startSeconds: 0 });
    } else {
      player.seekTo(0, true);
      player.playVideo();
    }
  });
}

export function stop() {
  if (active) {
    const a = active;
    active = null;
    clearTimeout(a.timer);
    clearTimeout(a.startTimer);
    a.resolve();
  }
  if (player && player.pauseVideo) player.pauseVideo();
}
