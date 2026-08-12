// Sessão de foco estilo SimCity: escolhe tempo de estudo e de pausa, e cada
// sessão de estudo concluída ergue um prédio na sua cidade isométrica — vista
// de cima, em bloco, tipo painel de simulador de cidade (população, minutos
// focados, nível), em vez de uma cena fofa com mascote.
import { store } from "../store.js";
import { showToast, playChime } from "../ui-utils.js";
import { Icon } from "../icons.js";
import { currentSpotifyUrl, promptSpotifyUrl, setSpotifyUrl } from "../spotify-player.js";

const STUDY_PRESETS = [15, 25, 50];
const BREAK_PRESETS = [5, 10, 15];

// Níveis da cidade — puramente cosmético, dá o "senso de progresso" tipo jogo.
const CITY_LEVELS = [
  { min: 0, label: "Terreno vazio", icon: "house" },
  { min: 1, label: "Vila iniciante", icon: "house" },
  { min: 5, label: "Cidadezinha", icon: "landmark" },
  { min: 15, label: "Cidade grande", icon: "landmark" },
  { min: 30, label: "Metrópole", icon: "landmark" },
  { min: 60, label: "Megalópole dos estudos", icon: "landmark" },
];

function cityLevelInfo(count) {
  let current = CITY_LEVELS[0];
  let next = CITY_LEVELS[1];
  for (let i = 0; i < CITY_LEVELS.length; i++) {
    if (count >= CITY_LEVELS[i].min) {
      current = CITY_LEVELS[i];
      next = CITY_LEVELS[i + 1] || null;
    }
  }
  const progress = next ? Math.min(100, Math.round(((count - current.min) / (next.min - current.min)) * 100)) : 100;
  return { current, next, progress };
}

// Dias seguidos (incluindo hoje) com pelo menos 1 prédio construído — igual
// espírito do streak de flashcard, mas calculado direto do array de prédios,
// sem precisar guardar nada a mais.
function focusStreakDays(city) {
  const daysWithBuild = new Set(city.map((b) => new Date(b.builtAt).toISOString().slice(0, 10)));
  let streak = 0;
  for (let n = 0; ; n++) {
    const key = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    if (daysWithBuild.has(key)) streak++;
    else break;
  }
  return streak;
}

// Estado da sessão em andamento — não é dado do app (não entra no store),
// só controla o timer na tela. Persistido no localStorage pra sobreviver a
// um F5 sem perder a sessão em curso.
let focoState = null;
let tickHandle = null;

function focoKey() {
  return `estuda-mais:foco:${store.userId}`;
}
function loadFocoState() {
  try {
    const raw = localStorage.getItem(focoKey());
    if (raw) return JSON.parse(raw);
  } catch {
    // ignora
  }
  return { phase: "idle", studyMinutes: 25, breakMinutes: 5, endsAt: null };
}
function saveFocoState() {
  try {
    localStorage.setItem(focoKey(), JSON.stringify(focoState));
  } catch {
    // não crítico
  }
}
function ensureFocoState() {
  if (!focoState) focoState = loadFocoState();
  return focoState;
}

function clearTick() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function formatMMSS(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---- Blocos isométricos (o "look" de simulador de cidade) ----
// Cada prédio é desenhado como um bloco falso-3D (topo + duas paredes) via
// polígonos SVG planos — sem transform 3D, então renderiza igual em qualquer
// navegador. Quanto mais avançada a cidade, mais alto o prédio.
const ISO_TILE_W = 46;
const ISO_HH = 12; // metade da altura do losango do topo

const ISO_TIERS = [
  { top: "#f0d2a8", left: "#d9a35e", right: "#b3733a", bh: 16 },
  { top: "#d9cdf0", left: "#9c85d1", right: "#5b3f82", bh: 24 },
  { top: "#c9ecd6", left: "#7fd19c", right: "#2f9e6b", bh: 34 },
  { top: "#cfe0f5", left: "#86a9d6", right: "#4d6fa3", bh: 48 },
];

function buildingTierIndex(count) {
  if (count >= 30) return 3;
  if (count >= 15) return 2;
  if (count >= 5) return 1;
  return 0;
}

function isoBuildingSvg(tierIdx, scale = 1) {
  const t = ISO_TIERS[tierIdx] || ISO_TIERS[0];
  const w = ISO_TILE_W;
  const hh = ISO_HH;
  const bh = t.bh;
  const vh = 2 * hh + bh;
  const edge = 'stroke="rgba(34,28,44,0.18)" stroke-width="0.6"';
  const leftFace = `0,${hh} ${w / 2},${2 * hh} ${w / 2},${2 * hh + bh} 0,${hh + bh}`;
  const rightFace = `${w / 2},${2 * hh} ${w},${hh} ${w},${hh + bh} ${w / 2},${2 * hh + bh}`;
  const topFace = `${w / 2},0 ${w},${hh} ${w / 2},${2 * hh} 0,${hh}`;

  let windows = "";
  if (tierIdx >= 1) {
    const n = tierIdx;
    const step = bh / (n + 1);
    for (let k = 1; k <= n; k++) {
      const wy = (hh + step * k - 2.5).toFixed(1);
      windows += `<rect x="${w / 2 + 6}" y="${wy}" width="5" height="5" rx="1" fill="#fbe8b8" opacity="0.85"/>`;
    }
  }
  if (tierIdx >= 2) {
    const wy = (hh + bh / 2 - 2.5).toFixed(1);
    windows += `<rect x="6" y="${wy}" width="5" height="5" rx="1" fill="#fbe8b8" opacity="0.7"/>`;
  }

  const svg = `<svg viewBox="0 0 ${w} ${vh}" width="${(w * scale).toFixed(1)}" height="${(vh * scale).toFixed(1)}">
    <polygon points="${leftFace}" fill="${t.left}" ${edge}/>
    <polygon points="${rightFace}" fill="${t.right}" ${edge}/>
    <polygon points="${topFace}" fill="${t.top}" ${edge}/>
    ${windows}
  </svg>`;
  return { svg, w, vh, bh };
}

// Grade isométrica: coloca cada prédio numa posição "diamante" (col/linha)
// pra imitar a câmera de topo/diagonal clássica dos sim-city. baseX generoso
// evita que a matemática (col-row) dê posição negativa nas linhas de trás.
const GRID_COLS = 6;
const GRID_BASE_X = 300;
const GRID_MAX_DISPLAY = 72;
const GRID_OFFSET_Y = 72; // = vh do prédio mais alto (tier 3), garante top >= 0

function isoTilePos(index) {
  const row = Math.floor(index / GRID_COLS);
  const col = index % GRID_COLS;
  return {
    x: GRID_BASE_X + (col - row) * (ISO_TILE_W / 2),
    y: (col + row) * ISO_HH,
  };
}

function cityIsoGridHtml(city) {
  if (city.length === 0) {
    return `<div class="empty-state" style="padding:26px 10px;"><div class="big">${Icon("landmark", { size: 26 })}</div>Sua cidade está vazia. Complete uma sessão de foco pra erguer o primeiro prédio.</div>`;
  }
  const hidden = Math.max(0, city.length - GRID_MAX_DISPLAY);
  const visible = city.slice(hidden);
  let maxY = 0;
  const tiles = visible
    .map((b, vi) => {
      const originalIndex = hidden + vi;
      const tierIdx = buildingTierIndex(originalIndex);
      const { svg, w, vh } = isoBuildingSvg(tierIdx);
      const { x, y } = isoTilePos(vi);
      maxY = Math.max(maxY, y);
      const left = (x - w / 2).toFixed(1);
      const top = (GRID_OFFSET_Y + y - vh).toFixed(1);
      const dateLabel = new Date(b.builtAt).toLocaleDateString("pt-BR");
      return `<div class="city-iso-tile" style="left:${left}px;top:${top}px;animation-delay:${Math.min(vi, 24) * 0.025}s" title="${dateLabel} · ${b.minutes} min">${svg}</div>`;
    })
    .join("");
  const containerHeight = Math.round(GRID_OFFSET_Y + maxY + 20);
  const note =
    hidden > 0
      ? `<div class="city-grid-note">+${hidden} prédio${hidden === 1 ? "" : "s"} mais antigo${hidden === 1 ? "" : "s"} fora de vista</div>`
      : "";
  return `<div class="city-iso-grid" style="height:${containerHeight}px;">${tiles}</div>${note}`;
}

// ---- Cena de construção ao vivo (aparece durante a fase de estudo) ----
// Elevação frontal (não isométrica) do mesmo prédio que vai entrar na
// cidade — sobe do chão conforme o tempo passa, num fundo estilo planta
// baixa/blueprint. As cores batem com os blocos isométricos (mesmo tom da
// parede "right" de cada tier), pra cidade e canteiro de obras conversarem.
const BUILDING_TIERS = [
  { path: "M18,92 V60 L45,36 L72,60 V92 Z", color: ISO_TIERS[0].right, windows: [[30, 70, 8, 8], [52, 70, 8, 8]] },
  { path: "M10,92 V48 L45,20 L80,48 V92 Z", color: ISO_TIERS[1].right, windows: [[26, 60, 9, 9], [55, 60, 9, 9], [26, 76, 9, 9], [55, 76, 9, 9]] },
  { path: "M14,92 V38 L45,22 L76,38 V92 Z", color: ISO_TIERS[2].right, windows: [[22, 50, 8, 8], [42, 50, 8, 8], [62, 50, 8, 8], [22, 66, 8, 8], [42, 66, 8, 8], [62, 66, 8, 8]] },
  { path: "M38,92 V12 H82 V92 Z", color: ISO_TIERS[3].right, windows: [[45, 22, 8, 8], [64, 22, 8, 8], [45, 38, 8, 8], [64, 38, 8, 8], [45, 54, 8, 8], [64, 54, 8, 8], [45, 70, 8, 8], [64, 70, 8, 8]] },
];

function constructionSceneHtml(count) {
  const tier = BUILDING_TIERS[buildingTierIndex(count)];
  return `
    <div class="construction-scene">
      <svg class="construction-svg" viewBox="0 0 120 100">
        <line class="cs-ground" x1="2" y1="92" x2="118" y2="92"></line>
        <path class="cs-outline" d="${tier.path}"></path>
        <clipPath id="cs-clip"><rect id="foco-clip-rect" x="0" y="92" width="120" height="0"></rect></clipPath>
        <g clip-path="url(#cs-clip)">
          <path class="cs-fill" d="${tier.path}" fill="${tier.color}"></path>
          ${tier.windows.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#fbe8b8" opacity="0.85"></rect>`).join("")}
        </g>
      </svg>
    </div>`;
}

// ---- Playlist de foco ----
// O player em si (iframe do Spotify) agora mora fora desta tela — veja
// spotify-player.js — porque ele precisa sobreviver a trocas de tela, e
// tudo dentro de #main é destruído a cada navegação. Aqui só ficam os
// controles de conectar/trocar/remover, que atuam sobre esse player global.
function spotifyStatusHtml() {
  const url = currentSpotifyUrl();
  if (!url) {
    return `
      <div class="spotify-block spotify-block--empty">
        <button class="btn btn-ghost btn-sm" id="spotify-add">${Icon("music", { size: 13 })}<span>Conectar playlist do Spotify</span></button>
      </div>`;
  }
  return `
    <div class="spotify-block spotify-block--connected">
      <span>${Icon("music", { size: 13 })}Playlist conectada — veja o player fixo no canto da tela.</span>
      <div class="spotify-block-actions">
        <button class="icon-btn-ghost" id="spotify-change" title="Trocar playlist">${Icon("pencil", { size: 12 })}</button>
        <button class="icon-btn-ghost" id="spotify-remove" title="Remover playlist">${Icon("x", { size: 12 })}</button>
      </div>
    </div>`;
}

function wireSpotifyControls(container) {
  const addBtn = container.querySelector("#spotify-add");
  const changeBtn = container.querySelector("#spotify-change");
  const removeBtn = container.querySelector("#spotify-remove");
  if (addBtn) addBtn.addEventListener("click", () => promptSpotifyUrl());
  if (changeBtn) changeBtn.addEventListener("click", () => promptSpotifyUrl(currentSpotifyUrl()));
  if (removeBtn) removeBtn.addEventListener("click", () => setSpotifyUrl(null));
}

export function renderFoco(container) {
  const state = ensureFocoState();
  const city = store.state.city || [];
  const totalMinutes = city.reduce((sum, b) => sum + (b.minutes || 0), 0);
  const { current, next, progress } = cityLevelInfo(city.length);
  const streak = focusStreakDays(city);

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Foco</h1>
        <p class="sub">Estude sem distração. Cada sessão concluída ergue um prédio na sua cidade.</p>
      </div>
      ${streak > 0 ? `<div class="focus-streak-badge">${Icon("flame", { size: 15 })}<span>${streak} dia${streak === 1 ? "" : "s"} seguido${streak === 1 ? "" : "s"}</span></div>` : ""}
    </div>
    <div class="focus-layout">
      <div class="panel focus-timer-card">
        ${spotifyStatusHtml()}
        ${focusStageHtml(state)}
      </div>
      <div class="panel focus-city-card">
        <div class="city-card-header">
          <h3>${Icon("landmark", { size: 16 })}<span>Sua cidade</span></h3>
          <span class="city-level-badge">${Icon(current.icon, { size: 12 })}${current.label}</span>
        </div>
        <div class="city-hud-bar">
          <div class="hud-stat">${Icon("house", { size: 13 })}<span>${city.length}</span><small>prédios</small></div>
          <div class="hud-stat">${Icon("clock", { size: 13 })}<span>${totalMinutes}</span><small>min focados</small></div>
          <div class="hud-stat">${Icon("trendingUp", { size: 13 })}<span>${progress}%</span><small>${next ? "próx. nível" : "nível máx."}</small></div>
        </div>
        ${
          next
            ? `<div class="city-level-hint">${next.min - city.length} prédio${next.min - city.length === 1 ? "" : "s"} pra virar "${next.label}"</div>`
            : `<div class="city-level-hint">Nível máximo da cidade — você é imparável.</div>`
        }
        <div class="city-scene">
          ${cityIsoGridHtml(city)}
        </div>
      </div>
    </div>
  `;

  wireSpotifyControls(container);
  wireStage(container, state);
}

function focusStageHtml(state) {
  if (state.phase === "idle") {
    return `
      <div class="focus-setup">
        <div class="focus-setup-field">
          <label>Tempo de estudo</label>
          <div class="focus-presets" data-presets="study">
            ${STUDY_PRESETS.map((m) => `<button type="button" class="btn btn-sm ${state.studyMinutes === m ? "btn-primary" : "btn-ghost"}" data-study-min="${m}">${m} min</button>`).join("")}
            <input type="number" id="study-min-custom" min="1" max="180" value="${state.studyMinutes}" />
          </div>
        </div>
        <div class="focus-setup-field">
          <label>Tempo de pausa</label>
          <div class="focus-presets" data-presets="break">
            ${BREAK_PRESETS.map((m) => `<button type="button" class="btn btn-sm ${state.breakMinutes === m ? "btn-primary" : "btn-ghost"}" data-break-min="${m}">${m} min</button>`).join("")}
            <input type="number" id="break-min-custom" min="1" max="60" value="${state.breakMinutes}" />
          </div>
        </div>
        <button class="btn btn-primary" id="focus-start" style="margin-top:6px;">${Icon("flame", { size: 15 })}<span>Iniciar sessão de foco</span></button>
      </div>`;
  }

  if (state.phase === "study") {
    const cityCount = (store.state.city || []).length;
    return `
      <div class="focus-running">
        <div class="focus-phase-label">Erguendo prédio...</div>
        <div class="focus-countdown focus-countdown--sm" id="foco-countdown">${formatMMSS(state.endsAt - Date.now())}</div>
        ${constructionSceneHtml(cityCount)}
        <div class="focus-progress-track"><div class="focus-progress-fill" id="foco-progress-fill"></div></div>
        <button class="btn btn-ghost" id="focus-cancel">${Icon("x", { size: 14 })}<span>Cancelar sessão</span></button>
      </div>`;
  }

  if (state.phase === "break") {
    const totalMs = state.breakMinutes * 60000;
    return `
      <div class="focus-running">
        <div class="focus-phase-label is-break">Pausa · obra parada</div>
        <div class="focus-ring-wrap is-break">
          <svg class="focus-ring" viewBox="0 0 120 120">
            <circle class="focus-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="focus-ring-fg" id="foco-ring-fg" cx="60" cy="60" r="52" data-total-ms="${totalMs}"></circle>
          </svg>
          <div class="focus-countdown" id="foco-countdown">${formatMMSS(state.endsAt - Date.now())}</div>
        </div>
        <button class="btn btn-ghost" id="focus-skip-break">${Icon("checkPlain", { size: 14 })}<span>Pular pausa</span></button>
      </div>`;
  }

  // study-done
  const { svg } = isoBuildingSvg(buildingTierIndex(Math.max(0, (store.state.city || []).length - 1)), 1.8);
  return `
    <div class="focus-done">
      <div class="focus-done-house">
        <div class="confetti">${Array.from({ length: 10 }, (_, i) => `<span class="confetti-piece c${i % 5}"></span>`).join("")}</div>
        ${svg}
      </div>
      <h3>Prédio erguido!</h3>
      <p class="modal-sub" style="margin-bottom:16px;">Você completou ${state.studyMinutes} minutos de foco. Quer fazer uma pausa de ${state.breakMinutes} min?</p>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-ghost" id="focus-skip-break">Pular pausa</button>
        <button class="btn btn-primary" id="focus-start-break">${Icon("flame", { size: 14 })}<span>Iniciar pausa</span></button>
      </div>
    </div>`;
}

function wireStage(container, state) {
  clearTick();

  if (state.phase === "idle") {
    container.querySelectorAll("[data-study-min]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.studyMinutes = Number(btn.dataset.studyMin);
        saveFocoState();
        renderFoco(container);
      });
    });
    container.querySelectorAll("[data-break-min]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.breakMinutes = Number(btn.dataset.breakMin);
        saveFocoState();
        renderFoco(container);
      });
    });
    container.querySelector("#study-min-custom").addEventListener("change", (e) => {
      state.studyMinutes = Math.max(1, Math.min(180, Number(e.target.value) || 25));
      saveFocoState();
    });
    container.querySelector("#break-min-custom").addEventListener("change", (e) => {
      state.breakMinutes = Math.max(1, Math.min(60, Number(e.target.value) || 5));
      saveFocoState();
    });
    container.querySelector("#focus-start").addEventListener("click", () => {
      state.phase = "study";
      state.endsAt = Date.now() + state.studyMinutes * 60000;
      saveFocoState();
      renderFoco(container);
    });
    return;
  }

  if (state.phase === "study") {
    container.querySelector("#focus-cancel").addEventListener("click", () => {
      if (!confirm("Se cancelar agora, o prédio não vai ser erguido. Cancelar mesmo assim?")) return;
      state.phase = "idle";
      state.endsAt = null;
      saveFocoState();
      renderFoco(container);
    });
    startTick(container, state);
    return;
  }

  if (state.phase === "break") {
    container.querySelector("#focus-skip-break").addEventListener("click", () => {
      state.phase = "idle";
      state.endsAt = null;
      saveFocoState();
      renderFoco(container);
    });
    startTick(container, state);
    return;
  }

  if (state.phase === "study-done") {
    container.querySelector("#focus-skip-break").addEventListener("click", () => {
      state.phase = "idle";
      state.endsAt = null;
      saveFocoState();
      renderFoco(container);
    });
    container.querySelector("#focus-start-break").addEventListener("click", () => {
      state.phase = "break";
      state.endsAt = Date.now() + state.breakMinutes * 60000;
      saveFocoState();
      renderFoco(container);
    });
  }
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
const BUILDING_TOP_Y = 92; // y do chão no viewBox da cena de construção

function updateRing(container, remaining, totalMs) {
  const ring = container.querySelector("#foco-ring-fg");
  if (!ring) return;
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - fraction)}`;
}

// Faz o prédio "subir" do chão conforme o tempo de estudo passa — a régua de
// progresso embaixo também cresce junto, então dá pra sentir o avanço de
// duas formas ao mesmo tempo (visual principal + barrinha).
function updateConstruction(container, remaining, totalMs) {
  const clipRect = container.querySelector("#foco-clip-rect");
  const bar = container.querySelector("#foco-progress-fill");
  const fractionDone = totalMs > 0 ? Math.max(0, Math.min(1, 1 - remaining / totalMs)) : 0;
  const height = BUILDING_TOP_Y * fractionDone;
  if (clipRect) {
    clipRect.setAttribute("y", `${BUILDING_TOP_Y - height}`);
    clipRect.setAttribute("height", `${height}`);
  }
  if (bar) bar.style.width = `${Math.round(fractionDone * 100)}%`;
}

function startTick(container, state) {
  const totalMs = (state.phase === "study" ? state.studyMinutes : state.breakMinutes) * 60000;
  if (state.phase === "study") updateConstruction(container, state.endsAt - Date.now(), totalMs);
  else updateRing(container, state.endsAt - Date.now(), totalMs);

  tickHandle = setInterval(() => {
    const remaining = state.endsAt - Date.now();
    if (remaining <= 0) {
      clearTick();
      if (state.phase === "study") {
        const minutes = state.studyMinutes;
        const countBefore = (store.state.city || []).length;
        const levelBefore = cityLevelInfo(countBefore).current.label;
        state.phase = "study-done";
        state.endsAt = null;
        saveFocoState();
        playChime();
        store.addCityBuilding(minutes); // dispara store.save() -> re-renderiza a tela inteira
        const levelAfter = cityLevelInfo(countBefore + 1).current.label;
        if (levelAfter !== levelBefore) {
          showToast(`Sua cidade agora é uma "${levelAfter}"!`, "landmark");
        } else {
          showToast("Prédio erguido! Hora da pausa.", "checkPlain");
        }
      } else if (state.phase === "break") {
        state.phase = "idle";
        state.endsAt = null;
        saveFocoState();
        playChime();
        showToast("Pausa concluída. Pronta pra outra sessão?", "flame");
        renderFoco(container);
      }
      return;
    }
    const span = container.querySelector("#foco-countdown");
    if (span) span.textContent = formatMMSS(remaining);
    if (state.phase === "study") updateConstruction(container, remaining, totalMs);
    else updateRing(container, remaining, totalMs);
  }, 250);
}
