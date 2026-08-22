// Sessão de foco no modelo clássico Pomodoro: estuda um bloco, faz uma
// pausa curta, repete — e a cada 4 blocos completos, uma pausa longa. Sem
// tema de cidade/construção; só o timer, o ciclo e o essencial.
import { store } from "../store.js";
import { showToast, playChime } from "../ui-utils.js";
import { Icon } from "../icons.js";
import { currentSpotifyUrl, promptSpotifyUrl, setSpotifyUrl } from "../spotify-player.js";
import { villageState } from "../village.js";

const STUDY_PRESETS = [15, 25, 50];
const BREAK_PRESETS = [5, 10, 15];
const LONG_BREAK_PRESETS = [15, 20, 30];
const CYCLES_PER_ROUND = 4; // clássico: a cada 4 sessões de foco, pausa longa

// Frases curtas mostradas durante a sessão de estudo — um empurrãozinho
// contra a maior distração de todas: o celular.
const FOCUS_PHRASES = [
  "Não vá se distrair no celular.",
  "Deixa o celular de lado — depois você confere.",
  "Uma notificação pode esperar. Seu foco, não.",
  "Você já começou. Não para agora.",
  "Respira. Volta o olho pra tela. Segue firme.",
];
function randomFocusPhrase() {
  return FOCUS_PHRASES[Math.floor(Math.random() * FOCUS_PHRASES.length)];
}

// Sessões concluídas ficam no store (store.state.city / addCityBuilding —
// nome legado do formato antigo, mas o dado em si é só "sessão concluída,
// tantos minutos, tal hora", que continua servindo pras estatísticas aqui.
function completedSessions() {
  return store.state.city || [];
}

// Dias seguidos (incluindo hoje) com pelo menos 1 sessão concluída.
function focusStreakDays(sessions) {
  const daysWithSession = new Set(sessions.map((s) => new Date(s.builtAt).toISOString().slice(0, 10)));
  let streak = 0;
  for (let n = 0; ; n++) {
    const key = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    if (daysWithSession.has(key)) streak++;
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
    if (raw) {
      const parsed = JSON.parse(raw);
      return { longBreakMinutes: 20, cycleCount: 0, isLongBreak: false, ...parsed };
    }
  } catch {
    // ignora
  }
  return { phase: "idle", studyMinutes: 25, breakMinutes: 5, longBreakMinutes: 20, cycleCount: 0, isLongBreak: false, endsAt: null };
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

// 4 bolinhas mostrando quantas sessões de foco já foram completadas desde
// a última pausa longa — o indicador de ciclo clássico do Pomodoro.
function cycleDotsHtml(cycleCount) {
  return `<div class="pomo-dots">${Array.from({ length: CYCLES_PER_ROUND }, (_, i) => `<span class="pomo-dot ${i < cycleCount ? "is-done" : ""}"></span>`).join("")}</div>`;
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

// Rotas de navegação pra onde cada construção "pertence" — clicar num nó da
// vila leva direto pra função que o alimenta, junto com os mesmos parâmetros
// que os botões da sidebar usam pra abrir aquela tela "zerada".
const BUILDING_ROUTE_EXTRA = {
  resumos: { activeSummaryId: null, activeFolderId: null },
  flashcards: { activeDeckId: null, reviewing: false },
  questoes: { activeQuestionFolderId: null, questionFilter: "all", practicing: false },
  foco: {},
  desempenho: {},
};

// 5 pontos ao redor de um centro (0-100, casando com o viewBox do SVG das
// linhas) — a "constelação" da vila, com o personagem no meio.
function pentagonPositions(count, radius = 34) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (-90 + i * (360 / count)) * (Math.PI / 180);
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
  });
}

function attrBarHtml(building) {
  return `
    <div class="village-attr">
      <div class="village-attr-label"><span>${Icon(building.icon, { size: 12 })}${building.attr}</span><b>Nv ${building.level}</b></div>
      <div class="village-attr-track"><div class="village-attr-fill village-attr-fill--${building.id}" style="width:${Math.round(building.progress * 100)}%"></div></div>
    </div>`;
}

function villageHtml(vs) {
  const positions = pentagonPositions(vs.buildings.length);
  const lines = positions.map((p) => `<line x1="50" y1="50" x2="${p.x}" y2="${p.y}"></line>`).join("");
  const nodes = vs.buildings
    .map((b, i) => {
      const p = positions[i];
      return `
        <button type="button" class="village-node" data-village-route="${b.route}" style="left:${p.x}%; top:${p.y}%;" title="${b.name} — nível ${b.level}. ${b.blurb}">
          <span class="village-hex village-hex--${b.id}">${Icon(b.icon, { size: 20 })}</span>
          <span class="village-node-level">Nv ${b.level}</span>
          <span class="village-node-name">${b.name}</span>
        </button>`;
    })
    .join("");

  return `
    <div class="panel village-map-card">
      <h3>${Icon("map", { size: 16 })}<span>Sua Vila</span></h3>
      <p class="village-map-hint">Cada construção sobe de nível sozinha, de acordo com a função que ela representa. Clique numa construção pra ir direto estudar ali.</p>
      <div class="village-map">
        <svg class="village-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        <div class="village-node village-node--center" title="Nível geral do personagem">
          <span class="village-hex village-hex--center">${Icon("star", { size: 22 })}</span>
          <span class="village-node-level">Nv ${vs.character.level}</span>
        </div>
        ${nodes}
      </div>
    </div>`;
}

export function renderFoco(container) {
  const state = ensureFocoState();
  const streak = focusStreakDays(completedSessions());
  const vs = villageState();

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Foco</h1>
        <p class="sub">Técnica Pomodoro: blocos de estudo intercalados com pausas curtas — e uma pausa longa a cada ${CYCLES_PER_ROUND} blocos.</p>
      </div>
      ${streak > 0 ? `<div class="focus-streak-badge">${Icon("flame", { size: 15 })}<span>${streak} dia${streak === 1 ? "" : "s"} seguido${streak === 1 ? "" : "s"}</span></div>` : ""}
    </div>
    <div class="panel village-banner">
      <div class="village-avatar">
        <span class="village-hex village-hex--avatar">${Icon("star", { size: 26 })}</span>
        <span class="village-avatar-level">${vs.character.level}</span>
      </div>
      <div class="village-banner-body">
        <div class="village-banner-head">
          <h2>${vs.className}</h2>
          <span class="village-banner-sub">Nível ${vs.character.level} · ${vs.character.xp} XP no total</span>
        </div>
        <div class="village-attrs">
          ${vs.buildings.map(attrBarHtml).join("")}
        </div>
      </div>
    </div>
    <div class="focus-layout">
      <div class="panel focus-timer-card">
        ${spotifyStatusHtml()}
        ${focusStageHtml(state)}
      </div>
      ${villageHtml(vs)}
    </div>
  `;

  wireSpotifyControls(container);
  wireStage(container, state);
  container.querySelectorAll("[data-village-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = btn.dataset.villageRoute;
      store.setRoute(route, BUILDING_ROUTE_EXTRA[route] || {});
    });
  });
}

function focusStageHtml(state) {
  if (state.phase === "idle") {
    return `
      <div class="focus-setup">
        <div class="focus-setup-field">
          <label>Tempo de foco</label>
          <div class="focus-presets" data-presets="study">
            ${STUDY_PRESETS.map((m) => `<button type="button" class="btn btn-sm ${state.studyMinutes === m ? "btn-primary" : "btn-ghost"}" data-study-min="${m}">${m} min</button>`).join("")}
            <input type="number" id="study-min-custom" min="1" max="180" value="${state.studyMinutes}" />
          </div>
        </div>
        <div class="focus-setup-field">
          <label>Pausa curta</label>
          <div class="focus-presets" data-presets="break">
            ${BREAK_PRESETS.map((m) => `<button type="button" class="btn btn-sm ${state.breakMinutes === m ? "btn-primary" : "btn-ghost"}" data-break-min="${m}">${m} min</button>`).join("")}
            <input type="number" id="break-min-custom" min="1" max="60" value="${state.breakMinutes}" />
          </div>
        </div>
        <div class="focus-setup-field">
          <label>Pausa longa (a cada ${CYCLES_PER_ROUND} blocos)</label>
          <div class="focus-presets" data-presets="long-break">
            ${LONG_BREAK_PRESETS.map((m) => `<button type="button" class="btn btn-sm ${state.longBreakMinutes === m ? "btn-primary" : "btn-ghost"}" data-long-break-min="${m}">${m} min</button>`).join("")}
            <input type="number" id="long-break-min-custom" min="1" max="90" value="${state.longBreakMinutes}" />
          </div>
        </div>
        ${cycleDotsHtml(state.cycleCount)}
        <button class="btn btn-primary" id="focus-start" style="margin-top:6px;">${Icon("flame", { size: 15 })}<span>Iniciar bloco de foco</span></button>
      </div>`;
  }

  if (state.phase === "study") {
    const totalMs = state.studyMinutes * 60000;
    if (!state.phrase) state.phrase = randomFocusPhrase();
    return `
      <div class="focus-running">
        <div class="focus-phase-label">Foco · bloco ${state.cycleCount + 1} de ${CYCLES_PER_ROUND}</div>
        <div class="focus-ring-wrap">
          <svg class="focus-ring" viewBox="0 0 120 120">
            <circle class="focus-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="focus-ring-fg" id="foco-ring-fg" cx="60" cy="60" r="52" data-total-ms="${totalMs}"></circle>
          </svg>
          <div class="focus-countdown" id="foco-countdown">${formatMMSS(state.endsAt - Date.now())}</div>
        </div>
        <div class="focus-phrase">${Icon("lightbulb", { size: 13 })}<span>${state.phrase}</span></div>
        <button class="btn btn-ghost" id="focus-cancel">${Icon("x", { size: 14 })}<span>Cancelar sessão</span></button>
      </div>`;
  }

  if (state.phase === "break") {
    const totalMs = (state.isLongBreak ? state.longBreakMinutes : state.breakMinutes) * 60000;
    return `
      <div class="focus-running">
        <div class="focus-phase-label is-break">${state.isLongBreak ? "Pausa longa" : "Pausa curta"}</div>
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
  const nextIsLongBreak = state.cycleCount % CYCLES_PER_ROUND === 0;
  const nextBreakMinutes = nextIsLongBreak ? state.longBreakMinutes : state.breakMinutes;
  return `
    <div class="focus-done">
      <div class="focus-done-icon">${Icon("checkPlain", { size: 30 })}</div>
      <h3>Bloco concluído!</h3>
      <p class="modal-sub" style="margin-bottom:16px;">Você completou ${state.studyMinutes} minutos de foco. ${nextIsLongBreak ? `Já são ${CYCLES_PER_ROUND} blocos — hora de uma pausa longa.` : `Quer fazer uma pausa de ${nextBreakMinutes} min?`}</p>
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-ghost" id="focus-skip-break">Pular pausa</button>
        <button class="btn btn-primary" id="focus-start-break">${Icon("flame", { size: 14 })}<span>Iniciar pausa${nextIsLongBreak ? " longa" : ""}</span></button>
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
    container.querySelectorAll("[data-long-break-min]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.longBreakMinutes = Number(btn.dataset.longBreakMin);
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
    container.querySelector("#long-break-min-custom").addEventListener("change", (e) => {
      state.longBreakMinutes = Math.max(1, Math.min(90, Number(e.target.value) || 20));
      saveFocoState();
    });
    container.querySelector("#focus-start").addEventListener("click", () => {
      state.phase = "study";
      state.endsAt = Date.now() + state.studyMinutes * 60000;
      state.phrase = randomFocusPhrase();
      saveFocoState();
      renderFoco(container);
    });
    return;
  }

  if (state.phase === "study") {
    container.querySelector("#focus-cancel").addEventListener("click", () => {
      if (!confirm("Se cancelar agora, esse bloco não vai contar. Cancelar mesmo assim?")) return;
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
      state.endsAt = Date.now() + (state.isLongBreak ? state.longBreakMinutes : state.breakMinutes) * 60000;
      saveFocoState();
      renderFoco(container);
    });
  }
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

function updateRing(container, remaining, totalMs) {
  const ring = container.querySelector("#foco-ring-fg");
  if (!ring) return;
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - fraction)}`;
}

function startTick(container, state) {
  const totalMs = (state.phase === "study" ? state.studyMinutes : state.isLongBreak ? state.longBreakMinutes : state.breakMinutes) * 60000;
  updateRing(container, state.endsAt - Date.now(), totalMs);

  tickHandle = setInterval(() => {
    const remaining = state.endsAt - Date.now();
    if (remaining <= 0) {
      clearTick();
      if (state.phase === "study") {
        const minutes = state.studyMinutes;
        state.cycleCount += 1;
        state.isLongBreak = state.cycleCount % CYCLES_PER_ROUND === 0;
        state.phase = "study-done";
        state.endsAt = null;
        saveFocoState();
        playChime();
        store.addCityBuilding(minutes); // dispara store.save() -> re-renderiza a tela inteira
        showToast(state.isLongBreak ? `${CYCLES_PER_ROUND} blocos completos! Hora da pausa longa.` : "Bloco concluído! Hora da pausa.", "checkPlain");
      } else if (state.phase === "break") {
        const wasLongBreak = state.isLongBreak;
        state.phase = "idle";
        state.endsAt = null;
        if (wasLongBreak) state.cycleCount = 0;
        state.isLongBreak = false;
        saveFocoState();
        playChime();
        showToast("Pausa concluída. Bora pra outro bloco?", "flame");
        renderFoco(container);
      }
      return;
    }
    const span = container.querySelector("#foco-countdown");
    if (span) span.textContent = formatMMSS(remaining);
    updateRing(container, remaining, totalMs);
  }, 250);
}
