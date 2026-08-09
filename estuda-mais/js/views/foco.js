// Sessão de foco estilo Forest: escolhe tempo de estudo e de pausa, e cada
// sessão de estudo concluída sem cancelar constrói uma casa. As casas vão se
// acumulando numa cidade (em vez da floresta do Forest).
import { store } from "../store.js";
import { showToast, playChime } from "../ui-utils.js";
import { Icon } from "../icons.js";

const STUDY_PRESETS = [15, 25, 50];
const BREAK_PRESETS = [5, 10, 15];

const HOUSE_COLORS = {
  casa1: { wall: "#e8ceb0", roof: "#b3543e" },
  casa2: { wall: "#d7cdec", roof: "#5b3f82" },
  casa3: { wall: "#c9e3d3", roof: "#2f9e6b" },
  casa4: { wall: "#f3d9c9", roof: "#c98a3c" },
};

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

// Dias seguidos (incluindo hoje) com pelo menos 1 casa construída — igual
// espírito do streak de flashcard, mas calculado direto do array de casas,
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

function houseSvg(kind) {
  const c = HOUSE_COLORS[kind] || HOUSE_COLORS.casa1;
  return `<svg viewBox="0 0 40 40" width="36" height="36">
    <path d="M4 20 20 8 36 20" fill="none" stroke="${c.roof}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
    <rect x="8" y="19" width="24" height="15" rx="1.5" fill="${c.wall}"/>
    <rect x="17" y="24" width="6" height="10" fill="${c.roof}" opacity="0.6"/>
  </svg>`;
}

// ---- Cena de construção ao vivo (aparece durante a fase de estudo) ----
// Quanto mais casas a cidade já tem, mais "avançado" o prédio que está sendo
// erguido agora — dá um senso real de evolução, não só repete a casinha.
const BUILDING_TIERS = [
  { path: "M18,92 V60 L45,36 L72,60 V92 Z", color: "#c98a3c", windows: [[30, 70, 8, 8], [52, 70, 8, 8]] },
  { path: "M10,92 V48 L45,20 L80,48 V92 Z", color: "#5b3f82", windows: [[26, 60, 9, 9], [55, 60, 9, 9], [26, 76, 9, 9], [55, 76, 9, 9]] },
  { path: "M14,92 V38 L45,22 L76,38 V92 Z", color: "#2f9e6b", windows: [[22, 50, 8, 8], [42, 50, 8, 8], [62, 50, 8, 8], [22, 66, 8, 8], [42, 66, 8, 8], [62, 66, 8, 8]] },
  { path: "M38,92 V12 H82 V92 Z", color: "#4d6fa3", windows: [[45, 22, 8, 8], [64, 22, 8, 8], [45, 38, 8, 8], [64, 38, 8, 8], [45, 54, 8, 8], [64, 54, 8, 8], [45, 70, 8, 8], [64, 70, 8, 8]] },
];
function buildingTierIndex(count) {
  if (count >= 30) return 3;
  if (count >= 15) return 2;
  if (count >= 5) return 1;
  return 0;
}

function mascotSvg(celebrate) {
  return `<g class="cs-mascot ${celebrate ? "celebrate" : "working"}" transform="translate(90,72)">
    <ellipse cx="0" cy="0" rx="11" ry="10" fill="#7f77dd"/>
    <circle cx="-4" cy="-3" r="1.8" fill="#26215c"/>
    <circle cx="4" cy="-3" r="1.8" fill="#26215c"/>
    <path d="M-5,3 Q0,7 5,3" stroke="#26215c" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <rect x="-9" y="8" width="6" height="4" rx="2" fill="#7f77dd"/>
    <rect x="3" y="8" width="6" height="4" rx="2" fill="#7f77dd"/>
    <g class="cs-mascot-arm">
      <rect x="9" y="-6" width="10" height="4" rx="2" fill="#7f77dd"/>
      <rect x="15" y="-12" width="4" height="10" rx="1.5" fill="#8a6a4f" transform="rotate(30 17 -7)"/>
    </g>
  </g>`;
}

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
        ${mascotSvg(false)}
      </svg>
    </div>`;
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
        <p class="sub">Estude sem distração. Cada sessão concluída constrói uma casa na sua cidade.</p>
      </div>
      ${streak > 0 ? `<div class="focus-streak-badge">${Icon("flame", { size: 15 })}<span>${streak} dia${streak === 1 ? "" : "s"} seguido${streak === 1 ? "" : "s"}</span></div>` : ""}
    </div>
    <div class="focus-layout">
      <div class="panel focus-timer-card">
        ${focusStageHtml(state)}
      </div>
      <div class="panel focus-city-card">
        <div class="city-card-header">
          <h3>${Icon("landmark", { size: 16 })}<span>Sua cidade</span></h3>
          <span class="city-level-badge">${Icon(current.icon, { size: 12 })}${current.label}</span>
        </div>
        <div class="city-stats">${city.length} casa${city.length === 1 ? "" : "s"} construída${city.length === 1 ? "" : "s"} · ${totalMinutes} min focados</div>
        ${
          next
            ? `<div class="city-level-progress"><div class="city-level-bar" style="width:${progress}%"></div></div>
               <div class="city-level-hint">${next.min - city.length} casa${next.min - city.length === 1 ? "" : "s"} pra virar "${next.label}"</div>`
            : `<div class="city-level-hint">Nível máximo da cidade — você é imparável.</div>`
        }
        <div class="city-scene">
          <div class="city-sky"><span class="city-sun"></span><span class="city-cloud c1"></span><span class="city-cloud c2"></span></div>
          <div class="city-grid">
            ${
              city.length === 0
                ? `<div class="empty-state" style="padding:20px 10px;"><div class="big">${Icon("landmark", { size: 26 })}</div>Sua cidade está vazia. Complete uma sessão de foco pra construir a primeira casa.</div>`
                : city
                    .map(
                      (b, i) =>
                        `<div class="city-house" style="animation-delay:${Math.min(i, 20) * 0.03}s" title="${new Date(b.builtAt).toLocaleDateString("pt-BR")} · ${b.minutes} min">${houseSvg(b.kind)}</div>`
                    )
                    .join("")
            }
          </div>
        </div>
      </div>
    </div>
  `;

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
        <div class="focus-phase-label">Construindo...</div>
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
        <div class="focus-phase-label is-break">Pausa · sua equipe descansa</div>
        <div class="focus-ring-wrap is-break">
          <svg class="focus-ring" viewBox="0 0 120 120">
            <circle class="focus-ring-bg" cx="60" cy="60" r="52"></circle>
            <circle class="focus-ring-fg" id="foco-ring-fg" cx="60" cy="60" r="52" data-total-ms="${totalMs}"></circle>
          </svg>
          <div class="focus-countdown" id="foco-countdown">${formatMMSS(state.endsAt - Date.now())}</div>
        </div>
        <svg class="focus-resting-mascot" viewBox="0 0 40 20" width="70" height="34"><g transform="translate(20,12)"><ellipse cx="0" cy="0" rx="11" ry="8" fill="#7f77dd"/><path d="M-4,-4 h3 M-1,-7 v3" stroke="#26215c" stroke-width="1.2" stroke-linecap="round"/><text x="9" y="-6" font-size="8" fill="#5b3f82">zz</text></g></svg>
        <button class="btn btn-ghost" id="focus-skip-break">${Icon("checkPlain", { size: 14 })}<span>Pular pausa</span></button>
      </div>`;
  }

  // study-done
  const tier = BUILDING_TIERS[buildingTierIndex(Math.max(0, (store.state.city || []).length - 1))];
  return `
    <div class="focus-done">
      <div class="focus-done-house">
        <div class="confetti">${Array.from({ length: 10 }, (_, i) => `<span class="confetti-piece c${i % 5}"></span>`).join("")}</div>
        <svg viewBox="0 0 120 100" width="100" height="84">
          <path d="${tier.path}" fill="${tier.color}"></path>
          <g class="cs-mascot celebrate" transform="translate(90,72)">
            <ellipse cx="0" cy="0" rx="11" ry="10" fill="#7f77dd"/>
            <circle cx="-4" cy="-3" r="1.8" fill="#26215c"/>
            <circle cx="4" cy="-3" r="1.8" fill="#26215c"/>
            <path d="M-5,2 Q0,8 5,2" stroke="#26215c" stroke-width="1.4" fill="none" stroke-linecap="round"/>
            <rect x="-9" y="8" width="6" height="4" rx="2" fill="#7f77dd"/>
            <rect x="3" y="8" width="6" height="4" rx="2" fill="#7f77dd"/>
          </g>
        </svg>
      </div>
      <h3>Casa construída!</h3>
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
      if (!confirm("Se cancelar agora, a casa não vai ser construída. Cancelar mesmo assim?")) return;
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
          showToast("Casa construída! Hora da pausa.", "checkPlain");
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
