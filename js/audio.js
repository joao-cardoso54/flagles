// O áudio vem sempre do Spotify (controlo remoto da app do Spotify; precisa de Premium).
// Versão anterior, com YouTube como alternativa: js/_old/audio-youtube.js
import * as sp from "./spotify.js";

export const audioAvailable = () => sp.isLoggedIn();

// Pré-carrega (pesquisa no Spotify) enquanto o jogador ainda está a responder à ronda anterior.
export function prepare(song) { if (sp.isLoggedIn()) sp.prepare(song); }

// Toca `seconds` segundos do início. Se falhar, o erro (com o motivo) chega ao jogador.
export async function playSong(song, seconds) {
  await sp.playClip(song, seconds);
  return "spotify";
}

export function stopAll() { sp.stop(); }
