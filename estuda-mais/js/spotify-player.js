// Player de música persistente para a sessão de Foco.
//
// Antes, o player (iframe do Spotify) vivia dentro da tela de Foco. Como o
// roteador do app troca de tela substituindo todo o conteúdo da área
// principal (main.innerHTML = ...), sair da aba de Foco destruía o iframe
// junto — e a música parava. Este módulo é montado UMA VEZ, fora da área que
// o roteador controla (dentro do shell, ao lado de #main), então sobrevive a
// qualquer troca de tela: a música continua tocando em qualquer lugar do app.
import { store } from "./store.js";
import { showToast } from "./ui-utils.js";
import { Icon } from "./icons.js";

function spotifyKey() {
  return `estuda-mais:spotify:${store.userId}`;
}
function loadUrl() {
  try {
    return localStorage.getItem(spotifyKey()) || null;
  } catch {
    return null;
  }
}
function saveUrl(url) {
  try {
    if (url) localStorage.setItem(spotifyKey(), url);
    else localStorage.removeItem(spotifyKey());
  } catch {
    // não crítico
  }
}

// Aceita link de compartilhamento (open.spotify.com/playlist/... ou com
// prefixo de idioma open.spotify.com/intl-pt/playlist/...) ou URI
// (spotify:playlist:...), de playlist, álbum, faixa ou artista.
function parseSpotifyRef(raw) {
  const input = (raw || "").trim();
  if (!input) return null;
  let match = input.match(/spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(playlist|album|track|artist)\/([a-zA-Z0-9]+)/i);
  if (!match) match = input.match(/^spotify:(playlist|album|track|artist):([a-zA-Z0-9]+)$/i);
  if (!match) return null;
  const [, type, id] = match;
  return { type: type.toLowerCase(), id };
}
function embedSrc(ref) {
  return `https://open.spotify.com/embed/${ref.type}/${ref.id}?utm_source=generator&theme=0`;
}
function openUrl(ref) {
  return `https://open.spotify.com/${ref.type}/${ref.id}`;
}

export function currentSpotifyUrl() {
  return loadUrl();
}

let rootEl = null;
let frameEl = null;
let frameSrc = null;
let expanded = false;

// Chamado uma vez, no shell do app — este container nunca é destruído por
// navegação entre telas.
export function mountSpotifyPlayer(container) {
  rootEl = container;
  render();
}

function render() {
  if (!rootEl) return;
  const url = loadUrl();
  if (!url) {
    rootEl.hidden = true;
    rootEl.innerHTML = "";
    return;
  }
  const ref = parseSpotifyRef(url);
  rootEl.hidden = false;
  rootEl.innerHTML = `
    <div class="spotify-mini-bar ${expanded ? "is-expanded" : ""}">
      <button class="spotify-mini-toggle" id="spotify-mini-toggle" title="${expanded ? "Recolher player" : "Mostrar player"}">
        ${Icon("music", { size: 14 })}<span>Tocando</span>
      </button>
      <div class="spotify-mini-body" ${expanded ? "" : "hidden"}>
        <div class="spotify-embed-slot" id="spotify-slot"></div>
        <div class="spotify-block-actions">
          ${ref ? `<a class="spotify-open-link" href="${openUrl(ref)}" target="_blank" rel="noopener">${Icon("link", { size: 11 })}<span>Abrir no Spotify</span></a>` : ""}
          <button class="icon-btn-ghost" id="spotify-mini-change" title="Trocar playlist">${Icon("pencil", { size: 12 })}</button>
          <button class="icon-btn-ghost" id="spotify-mini-remove" title="Remover playlist">${Icon("x", { size: 12 })}</button>
        </div>
      </div>
    </div>`;

  if (expanded) mountFrame();

  rootEl.querySelector("#spotify-mini-toggle").addEventListener("click", () => {
    expanded = !expanded;
    render();
  });
  const changeBtn = rootEl.querySelector("#spotify-mini-change");
  if (changeBtn) changeBtn.addEventListener("click", () => promptSpotifyUrl(loadUrl()));
  const removeBtn = rootEl.querySelector("#spotify-mini-remove");
  if (removeBtn) removeBtn.addEventListener("click", () => setSpotifyUrl(null));
}

// O iframe é reaproveitado (reparentado, não recriado) entre re-renders do
// próprio mini-player — assim ele nunca reinicia sozinho.
function mountFrame() {
  const slot = rootEl.querySelector("#spotify-slot");
  if (!slot) return;
  const ref = parseSpotifyRef(loadUrl());
  if (!ref) return;
  const src = embedSrc(ref);
  if (!frameEl || frameSrc !== src) {
    frameEl = document.createElement("iframe");
    frameEl.src = src;
    frameEl.width = "100%";
    frameEl.height = "152";
    frameEl.style.borderRadius = "12px";
    frameEl.frameBorder = "0";
    frameEl.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    frameEl.loading = "lazy";
    frameSrc = src;
  }
  slot.appendChild(frameEl);
}

export function setSpotifyUrl(url) {
  if (url && !parseSpotifyRef(url)) {
    showToast('Não reconheci esse link do Spotify. Copie o link de compartilhamento ("Compartilhar" → "Copiar link") de uma playlist, álbum ou faixa.', "alertCircle");
    return false;
  }
  saveUrl(url);
  if (!url) {
    frameEl = null;
    frameSrc = null;
    expanded = false;
  } else {
    expanded = true;
  }
  render();
  return true;
}

export function promptSpotifyUrl(defaultValue) {
  const url = prompt('Cole o link de uma playlist, álbum ou faixa do Spotify (botão "Compartilhar" no Spotify):', defaultValue || "");
  if (url === null) return;
  if (!url.trim()) return;
  setSpotifyUrl(url.trim());
}
