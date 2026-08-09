// Sessão de foco estilo Forest: escolhe tempo de estudo e de pausa, e cada
// sessão de estudo concluída sem cancelar constrói uma casa. As casas vão se
// acumulando numa cidade (em vez da floresta do Forest).
import { store } from "../store.js";
import { showToast } from "../ui-utils.js";
import { Icon } from "../icons.js";

const STUDY_PRESETS = [15, 25, 50];
const BREAK_PRESETS = [5, 10, 15];

const HOUSE_COLORS = {
  casa1: { wall: "#e8ceb0", roof: "#b3543e" },
  casa2: { wall: "#d7cdec", roof: "#5b3f82" },
  casa3: { wall: "#c9e3d3", roof: "#2f9e6b" },
  casa4: { wall: "#f3d9c9", roof: "#c98a3c" },
};

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

export function renderFoco(container) {
  const state = ensureFocoState();
  const city = store.state.city || [];
  const totalMinutes = city.reduce((sum, b) => sum + (b.minutes || 0), 0);

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Foco</h1>
        <p class="sub">Estude sem distração. Cada sessão concluída constrói uma casa na sua cidade.</p>
      </div>
    </div>
    <div class="focus-layout">
      <div class="panel focus-timer-card">
        ${focusStageHtml(state)}
      </div>
      <div class="panel focus-city-card">
        <h3>${Icon("landmark", { size: 16 })}<span>Sua cidade</span></h3>
        <div class="city-stats">${city.length} casa${city.length === 1 ? "" : "s"} construída${city.length === 1 ? "" : "s"} · ${totalMinutes} min focados</div>
        <div class="city-grid">
          ${
            city.length === 0
              ? `<div class="empty-state" style="padding:30px 10px;"><div class="big">${Icon("landmark", { size: 26 })}</div>Sua cidade está vazia. Complete uma sessão de foco pra construir a primeira casa.</div>`
              : city.map((b) => `<div class="city-house" title="${new Date(b.builtAt).toLocaleDateString("pt-BR")} · ${b.minutes} min">${houseSvg(b.kind)}</div>`).join("")
          }
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

  if (state.phase === "study" || state.phase === "break") {
    const label = state.phase === "study" ? "Estudando" : "Pausa";
    return `
      <div class="focus-running">
        <div class="focus-phase-label ${state.phase === "break" ? "is-break" : ""}">${label}</div>
        <div class="focus-countdown" id="foco-countdown">${formatMMSS(state.endsAt - Date.now())}</div>
        ${
          state.phase === "study"
            ? `<button class="btn btn-ghost" id="focus-cancel">${Icon("x", { size: 14 })}<span>Cancelar sessão</span></button>`
            : `<button class="btn btn-ghost" id="focus-skip-break">${Icon("checkPlain", { size: 14 })}<span>Pular pausa</span></button>`
        }
      </div>`;
  }

  // study-done
  return `
    <div class="focus-done">
      <div class="focus-done-house">${houseSvg("casa2")}</div>
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

function startTick(container, state) {
  tickHandle = setInterval(() => {
    const remaining = state.endsAt - Date.now();
    if (remaining <= 0) {
      clearTick();
      if (state.phase === "study") {
        const minutes = state.studyMinutes;
        state.phase = "study-done";
        state.endsAt = null;
        saveFocoState();
        store.addCityBuilding(minutes); // dispara store.save() -> re-renderiza a tela inteira
        showToast("Casa construída! Sessão de foco concluída.", "checkPlain");
      } else if (state.phase === "break") {
        state.phase = "idle";
        state.endsAt = null;
        saveFocoState();
        showToast("Pausa concluída. Pronta pra outra sessão?", "flame");
        renderFoco(container);
      }
      return;
    }
    const span = container.querySelector("#foco-countdown");
    if (span) span.textContent = formatMMSS(remaining);
  }, 250);
}
