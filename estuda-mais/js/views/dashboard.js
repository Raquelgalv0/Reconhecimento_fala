import { store } from "../store.js";
import { Icon } from "../icons.js";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const MODE_LABEL = { concurso: "Concurso", vestibular: "Vestibular", graduacao: "Graduação", medicina: "Medicina" };
const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dayKeyStr(date) {
  return date.toISOString().slice(0, 10);
}

// ---- Estado de tela do calendário (não é dado do app, só qual mês/dia está
// aberto agora — não precisa persistir, refaz do zero a cada abertura). ----
let calRefDate = new Date();
let calSelectedDay = dayKeyStr(new Date());
let goalsTab = "day"; // "day" | "week" | "month" — qual meta aparece ao lado do calendário

// -------------------------------------------------------- CHECKLIST BLOCK --
// Bloco reutilizável: título + input pra adicionar item + lista de itens com
// check/x/excluir. Usado tanto no calendário (period="day") quanto nas 3
// colunas de metas (period="day"/"week"/"month").
function checklistBlockHtml(title, period, key, { emptyText = "Nada por aqui ainda." } = {}) {
  const items = store.getChecklist(period, key);
  return `
    <div class="checklist-block" data-period="${period}" data-key="${key}">
      <div class="checklist-block-title">${esc(title)}</div>
      <form class="checklist-add-form" data-add>
        <input type="text" placeholder="Adicionar item..." maxlength="120" />
        <button type="submit" class="icon-btn-ghost">${Icon("plus", { size: 14 })}</button>
      </form>
      <div class="checklist-items">
        ${
          items.length === 0
            ? `<div class="checklist-empty">${esc(emptyText)}</div>`
            : items
                .map(
                  (it) => `
          <div class="checklist-item-row status-${it.status}" data-item="${it.id}">
            <span class="ci-text">${esc(it.text)}</span>
            <button class="ci-btn ci-done" data-status="done" title="Marcar como feito">${Icon("checkPlain", { size: 12 })}</button>
            <button class="ci-btn ci-missed" data-status="missed" title="Marcar como não feito">${Icon("x", { size: 12 })}</button>
            <button class="ci-btn ci-del" data-del title="Excluir">${Icon("trash", { size: 11 })}</button>
          </div>`
                )
                .join("")
        }
      </div>
    </div>`;
}

function wireChecklistBlocks(container) {
  container.querySelectorAll(".checklist-block").forEach((block) => {
    const period = block.dataset.period;
    const key = block.dataset.key;
    block.querySelector("[data-add]").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = block.querySelector("[data-add] input");
      const text = input.value.trim();
      if (!text) return;
      store.addChecklistItem(period, key, text);
    });
    block.querySelectorAll("[data-item]").forEach((row) => {
      const itemId = row.dataset.item;
      row.querySelectorAll("[data-status]").forEach((btn) => {
        btn.addEventListener("click", () => store.setChecklistItemStatus(period, key, itemId, btn.dataset.status));
      });
      row.querySelector("[data-del]").addEventListener("click", () => store.deleteChecklistItem(period, key, itemId));
    });
  });
}

// -------------------------------------------------------------- CALENDAR --
function calendarHtml() {
  const year = calRefDate.getFullYear();
  const month = calRefDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0=domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dayKeyStr(new Date());

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push("");
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return `
    <div class="cal-header">
      <button class="icon-btn-ghost" id="cal-prev" title="Mês anterior">${Icon("chevronLeft", { size: 15 })}</button>
      <div class="cal-month-label">${MONTH_LABELS[month]} de ${year}</div>
      <button class="icon-btn-ghost" id="cal-next" title="Próximo mês">${Icon("chevronRight", { size: 15 })}</button>
    </div>
    <div class="cal-grid">
      ${WEEKDAY_LABELS.map((w) => `<div class="cal-weekday">${w}</div>`).join("")}
      ${cells
        .map((d) => {
          if (!d) return `<div class="cal-cell empty"></div>`;
          const key = dayKeyStr(new Date(year, month, d));
          const items = store.getChecklist("day", key);
          const done = items.filter((it) => it.status === "done").length;
          const missed = items.filter((it) => it.status === "missed").length;
          const pending = items.length - done - missed;
          const isToday = key === todayKey;
          const isSelected = key === calSelectedDay;
          return `
          <button class="cal-cell ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}" data-day="${key}">
            <span class="cal-daynum">${d}</span>
            ${
              items.length
                ? `<span class="cal-dots">
              ${done ? `<span class="cal-dot dot-done"></span>` : ""}
              ${missed ? `<span class="cal-dot dot-missed"></span>` : ""}
              ${pending ? `<span class="cal-dot dot-pending"></span>` : ""}
            </span>`
                : ""
            }
          </button>`;
        })
        .join("")}
    </div>`;
}

function formatDayLabel(key) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export function renderDashboard(container) {
  const modes = store.state.modes || [];
  const profile = store.state.profile || {};
  const totalSummaries = store.state.summaries.length;
  const totalCards = store.state.flashcards.length;
  const dueToday = store.cardsDueToday().length;
  const decks = store.state.folders.length;
  const greeting = profile.name ? `Olá, ${profile.name}!` : "Bem-vindo(a) de volta";

  const deckLoad = store
    .flattenFolders()
    .map((f) => ({ name: f.name, due: store.cardsDueToday(f.id).length, total: store.cardsInFolder(f.id).length }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 4);

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>${greeting}</h1>
        <p class="sub">Seu painel de estudos${modes.length ? ` (modo ${modes.map((m) => MODE_LABEL[m]).join(" + ")})` : ""}.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="go-resumos">${Icon("plus", { size: 14 })}<span>Novo resumo</span></button>
        <button class="btn btn-primary" id="go-review" ${dueToday === 0 ? "disabled style='opacity:.5;cursor:default'" : ""}>${Icon("flame", { size: 15 })}<span>Revisar hoje (${dueToday})</span></button>
      </div>
    </div>
    ${
      modes.includes("medicina")
        ? `<div class="medicina-banner">${Icon("pulse", { size: 15 })}<span>Estude para cuidar dos outros, mas também cuide de si mesmo. Bons estudos!</span></div>`
        : ""
    }

    <div class="stat-grid">
      <div class="stat-card"><div class="label">Resumos</div><div class="value">${totalSummaries}</div></div>
      <div class="stat-card"><div class="label">Flashcards</div><div class="value">${totalCards}</div></div>
      <div class="stat-card"><div class="label">Para revisar hoje</div><div class="value amber">${dueToday}</div></div>
      <div class="stat-card"><div class="label">Assuntos organizados</div><div class="value accent">${decks}</div></div>
    </div>

    <div class="panel">
      <div class="panel-header-row">
        <h3>${Icon("calendar", { size: 16 })}<span>Metas e calendário</span></h3>
        <div class="goals-tabs">
          <button class="tab-btn ${goalsTab === "day" ? "active" : ""}" data-goals-tab="day">Dia</button>
          <button class="tab-btn ${goalsTab === "week" ? "active" : ""}" data-goals-tab="week">Semana</button>
          <button class="tab-btn ${goalsTab === "month" ? "active" : ""}" data-goals-tab="month">Mês</button>
        </div>
      </div>
      <div class="cal-layout">
        <div class="cal-wrap">${calendarHtml()}</div>
        <div class="cal-day-panel">
          ${
            goalsTab === "day"
              ? checklistBlockHtml(formatDayLabel(calSelectedDay), "day", calSelectedDay, { emptyText: "Nada planejado pra esse dia ainda." })
              : goalsTab === "week"
                ? checklistBlockHtml("Essa semana", "week", store.weekKey(new Date()), { emptyText: "Nenhuma meta pra semana ainda." })
                : checklistBlockHtml("Esse mês", "month", store.monthKey(new Date()), { emptyText: "Nenhuma meta pro mês ainda." })
          }
        </div>
      </div>
    </div>

    ${
      deckLoad.length
        ? `<div class="panel">
      <h3>${Icon("trendingUp", { size: 16 })}<span>Onde focar agora</span></h3>
      <div class="priority-list">
        ${deckLoad
          .map(
            (d) => `
          <div class="priority-item">
            <div class="num">${Icon("folder", { size: 13 })}</div>
            <div class="txt"><b>${d.name}</b><span>${d.total} flashcard${d.total === 1 ? "" : "s"} · ${d.due ? `${d.due} pendente${d.due === 1 ? "" : "s"} hoje` : "em dia"}</span></div>
          </div>`
          )
          .join("")}
      </div>
    </div>`
        : ""
    }
  `;

  container.querySelector("#go-resumos").addEventListener("click", () => store.setRoute("resumos", { activeSummaryId: null, activeFolderId: null }));
  const reviewBtn = container.querySelector("#go-review");
  if (dueToday > 0) {
    reviewBtn.addEventListener("click", () => store.setRoute("flashcards", { activeDeckId: null, reviewing: false }));
  }

  wireChecklistBlocks(container);

  container.querySelector("#cal-prev").addEventListener("click", () => {
    calRefDate = new Date(calRefDate.getFullYear(), calRefDate.getMonth() - 1, 1);
    renderDashboard(container);
  });
  container.querySelector("#cal-next").addEventListener("click", () => {
    calRefDate = new Date(calRefDate.getFullYear(), calRefDate.getMonth() + 1, 1);
    renderDashboard(container);
  });
  container.querySelectorAll("[data-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      calSelectedDay = btn.dataset.day;
      goalsTab = "day";
      renderDashboard(container);
    });
  });
  container.querySelectorAll("[data-goals-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      goalsTab = btn.dataset.goalsTab;
      renderDashboard(container);
    });
  });
}
