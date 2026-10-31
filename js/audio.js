// Escolhe de onde vem o áudio de cada música: Spotify (se ligado) ou YouTube.
// "auto": Spotify quando está ligado e a música é encontrada; se falhar, YouTube.
import * as yt from "./player.js";
import * as sp from "./spotify.js";

let source = "auto"; // "auto" | "youtube" | "spotify"
let via = null;       // quem está a tocar agora

export const setSource = s => { source = s; };
export const spotifyOn = () => sp.isLoggedIn() && source !== "youtube";

// Pré-carrega (pesquisa no Spotify) enquanto o jogador ainda está a responder à ronda anterior.
export function prepare(song) { if (spotifyOn()) sp.prepare(song); }

// Toca `seconds` segundos do início. Resolve com "spotify" ou "youtube" (quem tocou).
export async function playSong(song, seconds) {
  if (spotifyOn()) {
    try {
      via = "spotify";
      await sp.playClip(song, seconds);
      return "spotify";
    } catch (err) {
      if (source === "spotify") throw err; // "só Spotify": mostra o erro
      // automático: cai para o YouTube
    }
  }
  via = "youtube";
  await yt.playClip(song.videoId, seconds);
  return "youtube";
}

export function stopAll() {
  yt.stop();
  if (via === "spotify") sp.stop();
  via = null;
}
