// Ligação ao Spotify: login (OAuth com PKCE, sem servidor), pesquisa da música e controlo remoto da app do Spotify.
// A app NÃO recebe áudio do Spotify: manda a app do Spotify tocar a partir do início e parar ao fim de X segundos.
// Requer Spotify Premium e a app do Spotify aberta no aparelho.
import { normalize } from "./text.js";

// Público (não é segredo). Criado em developer.spotify.com/dashboard.
const CLIENT_ID = "896f832f2f4c4f3eafb78184d2ef800b";
const SCOPES = "user-modify-playback-state user-read-playback-state";

const LS = {
  tokens: "flagles-spotify-tokens",
  verifier: "flagles-spotify-verifier",
  ids: "flagles-spotify-ids",       // videoId -> { uri, label }
  bias: "flagles-spotify-bias",     // correção automática do atraso (ms)
  offset: "flagles-spotify-offset", // ajuste manual (ms)
  ret: "flagles-spotify-return",    // página para onde voltar depois do login
  error: "flagles-spotify-error",
};

const read = (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// O endereço de retorno tem de ser IGUAL a um dos registados no painel do Spotify.
export const redirectUri = () => new URL("./", location.href).href;

/* ------------------------------------------------------------------ login (PKCE) */

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function login(returnTo = "") {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  write(LS.verifier, verifier);
  write(LS.ret, returnTo);
  const q = new URLSearchParams({
    response_type: "code", client_id: CLIENT_ID, scope: SCOPES, redirect_uri: redirectUri(),
    code_challenge_method: "S256", code_challenge: challenge,
  });
  location.href = `https://accounts.spotify.com/authorize?${q}`;
}

async function tokenRequest(params) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || `Spotify ${res.status}`);
  return json;
}

function saveTokens(t, prev = {}) {
  write(LS.tokens, {
    access_token: t.access_token,
    refresh_token: t.refresh_token || prev.refresh_token,
    expires_at: Date.now() + (t.expires_in || 3600) * 1000,
  });
}

// Chamar ao abrir a página. Se o Spotify nos devolveu aqui com ?code=..., troca-o por um token.
// Devolve a página para onde voltar (ou "" se não houver redirecionamento a fazer).
export async function handleRedirect() {
  const p = new URLSearchParams(location.search);
  if (!p.has("code") && !p.has("error")) return "";
  const ret = read(LS.ret, "") || "";
  try {
    if (p.has("error")) throw new Error(p.get("error") === "access_denied" ? "Login cancelado." : p.get("error"));
    const verifier = read(LS.verifier);
    if (!verifier) throw new Error("Sessão de login perdida; tenta ligar outra vez.");
    saveTokens(await tokenRequest({ grant_type: "authorization_code", code: p.get("code"), redirect_uri: redirectUri(), code_verifier: verifier }));
    write(LS.error, "");
  } catch (e) {
    write(LS.error, e.message);
  }
  history.replaceState(null, "", location.pathname); // tira ?code= do endereço
  return ret;
}

export const lastError = () => read(LS.error, "") || "";
export const isLoggedIn = () => !!read(LS.tokens);
export function logout() { try { localStorage.removeItem(LS.tokens); } catch (e) {} }

async function accessToken() {
  const t = read(LS.tokens);
  if (!t) throw new Error("Spotify não ligado.");
  if (Date.now() < t.expires_at - 60_000) return t.access_token;
  if (!t.refresh_token) { logout(); throw new Error("Sessão do Spotify expirou; liga outra vez."); }
  try {
    saveTokens(await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token }), t);
  } catch (e) { logout(); throw new Error("Sessão do Spotify expirou; liga outra vez."); }
  return read(LS.tokens).access_token;
}

/* ------------------------------------------------------------------ API */

async function api(method, path, body) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  return { status: res.status, json, retryAfter: Number(res.headers.get("Retry-After") || 0) };
}

/* ------------------------------------------------------------------ pesquisa da música certa */

const BAD = /\b(live|ao vivo|remix|karaoke|instrumental|tribute|cover|made famous|originally|piano version|acoustic|session|sessions|reprise)\b/i;
const BAD_ALBUM = /\b(live|tribute|karaoke|lullaby|rendition|string quartet|piano)\b/i;
const BASE = s => normalize(s.replace(/\(.*?\)|\[.*?\]/g, " ")).replace(/ /g, "");

// Nome do artista a procurar. "Wings" é do Paul; a pesquisa do Spotify aceita ambos.
const ARTIST = { "Wings": "Wings", "Plastic Ono Band": "Plastic Ono Band" };
const artistOf = song => (song.group === "beatles" || !song.artist ? "The Beatles" : ARTIST[song.artist] || song.artist);

// Escolhe, entre os resultados, a versão de estúdio mais provável. Pura (testável sem rede).
export function pickBest(items, song) {
  const want = BASE(song.title);
  const wantsSpecial = /\b(demo|reprise|live|remix|acoustic)\b/i.test(song.title);
  const artist = normalize(artistOf(song));
  let best = null;
  for (const t of items || []) {
    const name = t.name || "";
    if (BASE(name) !== want) continue;
    if (!wantsSpecial && (BAD.test(name) || BAD_ALBUM.test(t.album?.name || ""))) continue;
    // variantes pedidas explicitamente nos parênteses do título (ex.: "(Reprise)", "(Ballad)")
    // ("Reprise" e "Play Out" têm de aparecer no nome; "Ballad" é a versão normal, sem etiqueta)
    const marker = ((song.title.match(/\(([^)]*)\)\s*$/) || [])[1] || "").toLowerCase();
    const lname = name.toLowerCase();
    if ((marker === "reprise" || marker === "play out") && !lname.includes(marker)) continue;
    if (marker !== "reprise" && marker !== "play out" && /\b(reprise|play out)\b/.test(lname) && !/\b(reprise|play out)\b/i.test(song.title)) continue;
    let score = 0;
    if (t.artists?.some(a => normalize(a.name).includes(artist) || artist.includes(normalize(a.name)))) score += 5;
    if (t.album?.album_type === "album") score += 2;
    if (/\b(greatest|hits|collection|anthology|essential|best of|1962|1967|1970|1\b)/i.test(t.album?.name || "")) score -= 2;
    score += (t.popularity || 0) / 100;
    if (!best || score > best.score) best = { score, t };
  }
  return best && best.t;
}

// Devolve { uri, label } da música no Spotify (com cache), ou null se não encontrar.
export async function findTrack(song) {
  const cache = read(LS.ids, {});
  if (cache[song.videoId]?.album) return cache[song.videoId]; // entradas antigas (sem álbum) refazem-se
  const title = song.title.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const artist = artistOf(song);
  const queries = [`track:"${title}" artist:"${artist}"`, `${title} ${artist}`];
  for (const q of queries) {
    const r = await api("GET", `/search?${new URLSearchParams({ q, type: "track", limit: "10", market: "PT" })}`);
    if (r.status === 429) throw new Error("O Spotify pediu para esperar um pouco; tenta já a seguir.");
    // mostra o motivo que o próprio Spotify dá (ex.: "User not registered in the Developer Dashboard")
    if (r.status >= 400) throw new Error(`Pesquisa no Spotify falhou (${r.status})${r.json?.error?.message ? ": " + r.json.error.message : ""}`);
    const t = pickBest(r.json?.tracks?.items, song);
    if (t) {
      const found = { uri: t.uri, album: t.album?.uri, label: `${t.name} · ${t.artists.map(a => a.name).join(", ")} · ${t.album.name}` };
      write(LS.ids, { ...read(LS.ids, {}), [song.videoId]: found });
      return found;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ reprodução */

const NO_DEVICE = "Abre a app do Spotify no telemóvel, toca numa música (podes pausá-la) e volta aqui.";

async function startPlayback(uri) {
  const body = { uris: [uri], position_ms: 0 };
  let r = await api("PUT", "/me/player/play", body);
  if (r.status === 404 || r.status === 202) { // sem dispositivo ativo: tenta acordar o primeiro disponível
    const d = await api("GET", "/me/player/devices");
    const list = d.json?.devices || [];
    const dev = list.find(x => x.is_active) || list.find(x => /smartphone|tablet/i.test(x.type)) || list[0];
    if (!dev) throw new Error(NO_DEVICE);
    r = await api("PUT", `/me/player/play?device_id=${encodeURIComponent(dev.id)}`, body);
  }
  if (r.status === 403) throw new Error(`O Spotify recusou${r.json?.error?.message ? ": " + r.json.error.message : ""}. É preciso Premium e o teu email em 'User Management' do painel de developers.`);
  if (r.status === 401) throw new Error("Sessão do Spotify inválida; liga outra vez.");
  if (r.status === 404) throw new Error(NO_DEVICE);
  if (r.status === 429) throw new Error("O Spotify pediu para esperar um pouco; tenta já a seguir.");
  if (r.status >= 400) throw new Error(`Spotify ${r.status}${r.json?.error?.message ? ": " + r.json.error.message : ""}`);
  return r;
}

let lastClip = null; // para o stop()

// Toca `seconds` segundos desde o início. Resolve quando mandou parar.
// Devolve { requestedMs, rtt, bias } (e mede em segundo plano quanto tocou realmente, para corrigir o próximo).
export async function playClip(song, seconds, { adaptive = true } = {}) {
  const found = await findTrack(song);
  if (!found) throw new Error("Esta música não foi encontrada no Spotify.");
  const bias = Number(read(LS.bias, 0)) || 0;
  const offset = Number(read(LS.offset, 0)) || 0;

  const t0 = performance.now();
  await startPlayback(found.uri);
  const rtt = performance.now() - t0;
  const started = performance.now();            // o áudio só pode começar a partir daqui
  const clip = { cancelled: false };
  lastClip = clip;

  // pedido de pausa sai antes do fim para compensar o caminho de ida (metade do RTT) e o erro medido antes
  const sendAt = started + seconds * 1000 - rtt / 2 - bias + offset;
  await sleep(Math.max(0, sendAt - performance.now()));
  if (clip.cancelled) return { requestedMs: seconds * 1000, rtt, bias };
  await api("PUT", "/me/player/pause");

  if (adaptive) measure(seconds * 1000, bias).catch(() => {});
  return { requestedMs: seconds * 1000, rtt, bias };
}

// Lê a posição em que o Spotify parou: diz quanto tocou realmente (a partir de 0) e afina a correção.
let lastMeasure = null;
async function measure(requestedMs, bias) {
  const r = await api("GET", "/me/player");
  const played = r.json?.progress_ms;
  if (typeof played !== "number") return;
  if (played <= 0) { lastMeasure = { requestedMs, playedMs: 0, error: -requestedMs, device: r.json?.device?.name || "?", playing: !!r.json?.is_playing, nothing: true }; return; } // nada tocou: não afinar
  const error = played - requestedMs; // >0: tocou a mais; <0: tocou a menos
  lastMeasure = { requestedMs, playedMs: played, error, device: r.json?.device?.name || "?", playing: !!r.json?.is_playing };
  const next = Math.max(-1000, Math.min(2000, bias + error * 0.6));
  write(LS.bias, Math.round(next));
}
export const lastMeasurement = () => lastMeasure;

// Diagnóstico: tenta várias formas de mandar tocar e diz qual funciona (o Spotify aceita o comando mas pode não arrancar).
export async function diagnose(song) {
  const found = await findTrack(song);
  if (!found) throw new Error("Esta música não foi encontrada no Spotify.");
  const lines = [`Faixa: ${found.label}`, `URI: ${found.uri} | álbum: ${found.album}`];
  const id = found.uri.split(":").pop();
  const tr = await api("GET", `/tracks/${id}?market=PT`);
  lines.push(`Faixa no Spotify: HTTP ${tr.status} | is_playable=${tr.json?.is_playable} | restrições=${JSON.stringify(tr.json?.restrictions ?? null)}`);
  const dv = await api("GET", "/me/player/devices");
  const dev = (dv.json?.devices || []).find(d => d.is_active) || (dv.json?.devices || [])[0];
  if (!dev) { lines.push("Sem dispositivos Spotify."); return lines; }
  lines.push(`Dispositivo: ${dev.name} (${dev.type}) volume ${dev.volume_percent}%`);

  const attempts = [
    ["A) uris, sem posição", () => api("PUT", "/me/player/play", { uris: [found.uri] })],
    ["B) uris, posição 0", () => api("PUT", "/me/player/play", { uris: [found.uri], position_ms: 0 })],
    ["C) álbum + faixa", () => api("PUT", "/me/player/play", { context_uri: found.album, offset: { uri: found.uri } })],
    ["D) transferir para o dispositivo e tocar", async () => {
      await api("PUT", "/me/player", { device_ids: [dev.id], play: true });
      await sleep(800);
      return api("PUT", `/me/player/play?device_id=${dev.id}`, { uris: [found.uri] });
    }],
  ];
  for (const [label, run] of attempts) {
    const r = await run();
    await sleep(1800);
    const st = await api("GET", "/me/player");
    const j = st.json;
    lines.push(`${label}: comando HTTP ${r.status}${r.json?.error?.message ? " (" + r.json.error.message + ")" : ""} -> a tocar=${j?.is_playing} | posição=${j?.progress_ms} ms | faixa=${j?.item?.name ?? "nenhuma"}`);
    await api("PUT", "/me/player/pause");
    await sleep(400);
  }
  return lines;
}

// Dispositivos Spotify disponíveis (a música sai do que estiver ativo, não necessariamente deste aparelho).
export async function devices() {
  const r = await api("GET", "/me/player/devices");
  if (r.status >= 400) throw new Error(`Spotify ${r.status}${r.json?.error?.message ? ": " + r.json.error.message : ""}`);
  return (r.json?.devices || []).map(d => `${d.name} (${d.type})${d.is_active ? " [ativo]" : ""}`);
}

export async function stop() {
  if (lastClip) lastClip.cancelled = true;
  lastClip = null;
  try { await api("PUT", "/me/player/pause"); } catch (e) {}
}

// Ajustes (para a página de teste)
export const getOffset = () => Number(read(LS.offset, 0)) || 0;
export const setOffset = ms => write(LS.offset, Number(ms) || 0);
export const getBias = () => Number(read(LS.bias, 0)) || 0;
export const resetBias = () => write(LS.bias, 0);
export const clearTrackCache = () => { try { localStorage.removeItem(LS.ids); } catch (e) {} };

// Resolve a música no Spotify sem tocar (para o jogo pré-carregar enquanto o jogador responde).
export const prepare = song => (isLoggedIn() ? findTrack(song).catch(() => null) : Promise.resolve(null));
