import { store } from "../store.js";
import { showToast } from "../ui-utils.js";
import { Icon } from "../icons.js";

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function formatDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function renderDesempenho(container) {
  const streak = store.currentStreak();
  const best = store.bestStreak();
  const totalMinutes = store.totalStudyMinutes();
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const accuracy = store.overallAccuracy();
  const days = store.last14Days();
  const progress = store.todayProgress();
  const progressPct = Math.min(100, Math.round((progress.done / progress.goal) * 100));
  const mastery = store.topicMasteryStats();
  const mostError = [...mastery].sort((a, b) => b.errorRate - a.errorRate).slice(0, 4);
  const dominated = [...mastery]
    .filter((s) => s.total >= 2 && s.errorRate <= 0.4)
    .sort((a, b) => a.errorRate - b.errorRate)
    .slice(0, 4);
  const bestDay = store.bestDay();

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Desempenho</h1>
        <p class="sub">Sua evolução ao longo do tempo: sequência de estudo, tempo dedicado e onde focar.</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">${Icon("flame", { size: 13 })} Sequência atual</div>
        <div class="value amber">${streak}<span class="value-unit">${streak === 1 ? "dia" : "dias"}</span></div>
      </div>
      <div class="stat-card">
        <div class="label">${Icon("award", { size: 13 })} Melhor sequência</div>
        <div class="value accent">${best}<span class="value-unit">${best === 1 ? "dia" : "dias"}</span></div>
      </div>
      <div class="stat-card">
        <div class="label">${Icon("clock", { size: 13 })} Tempo estudado</div>
        <div class="value">${hours}h${String(mins).padStart(2, "0")}</div>
      </div>
      <div class="stat-card">
        <div class="label">${Icon("target", { size: 13 })} Taxa de acerto geral</div>
        <div class="value ${accuracy === null ? "" : accuracy >= 70 ? "" : "amber"}">${accuracy === null ? "—" : `${accuracy}%`}</div>
      </div>
    </div>

    <div class="panel">
      <h3>${Icon("trendingUp", { size: 15 })}<span>Evolução (últimos 14 dias)</span></h3>
      <div class="evo-chart">
        ${days
          .map((d) => {
            const h = d.total > 0 ? Math.max(6, d.accuracy) : 3;
            const cls = d.total === 0 ? "empty" : d.accuracy >= 70 ? "good" : d.accuracy >= 40 ? "mid" : "low";
            const title = d.total > 0 ? `${formatDay(d.date)}: ${d.accuracy}% de acerto (${d.total} atividades)` : `${formatDay(d.date)}: sem atividade`;
            return `<div class="evo-col" title="${title}">
              <div class="evo-bar ${cls}" style="height:${h}%"></div>
              <span class="evo-label">${formatDay(d.date)}</span>
            </div>`;
          })
          .join("")}
      </div>
    </div>

    <div class="panel">
      <h3>${Icon("checkSquare", { size: 15 })}<span>Meta diária</span></h3>
      <p class="muted-note" style="margin-bottom:10px;">${progress.done} de ${progress.goal} atividades hoje (flashcards revisados + questões praticadas).</p>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${progressPct}%"></div></div>
      <div class="btn-row" style="margin-top:12px;">
        <input type="text" inputmode="numeric" id="goal-input" value="${store.state.dailyGoal}" style="width:70px; border:1px solid var(--border); border-radius:8px; padding:6px 10px; text-align:center;" />
        <button class="btn btn-ghost btn-sm" id="save-goal">Salvar meta</button>
      </div>
    </div>

    <div class="stat-grid stat-grid--3">
      <div class="panel">
        <h3>${Icon("alertCircle", { size: 15 })}<span>Assuntos mais errados</span></h3>
        <div class="priority-list">
          ${mostError
            .map((s) => `<div class="priority-item"><div class="num">${Icon("folder", { size: 12 })}</div><div class="txt"><b>${esc(s.name)}</b><span>${Math.round(s.errorRate * 100)}% de erro em ${s.total} atividade${s.total === 1 ? "" : "s"}</span></div></div>`)
            .join("") || `<p class="muted-note">Pratique para gerar estatísticas.</p>`}
        </div>
      </div>
      <div class="panel">
        <h3>${Icon("check", { size: 15 })}<span>Assuntos dominados</span></h3>
        <div class="priority-list">
          ${dominated
            .map((s) => `<div class="priority-item"><div class="num">${Icon("folder", { size: 12 })}</div><div class="txt"><b>${esc(s.name)}</b><span>${100 - Math.round(s.errorRate * 100)}% de acerto em ${s.total} atividade${s.total === 1 ? "" : "s"}</span></div></div>`)
            .join("") || `<p class="muted-note">Pratique para gerar estatísticas.</p>`}
        </div>
      </div>
      <div class="panel">
        <h3>${Icon("award", { size: 15 })}<span>Recorde pessoal</span></h3>
        <div class="priority-list">
          ${
            bestDay
              ? `<div class="priority-item"><div class="num">${Icon("calendar", { size: 12 })}</div><div class="txt"><b>Melhor dia: ${formatDay(bestDay.date)}</b><span>${bestDay.correct} acertos de ${bestDay.total} atividades</span></div></div>`
              : `<p class="muted-note">Continue estudando para bater recordes.</p>`
          }
        </div>
      </div>
    </div>
  `;

  const goalInput = container.querySelector("#goal-input");
  container.querySelector("#save-goal").addEventListener("click", () => {
    const n = Number(goalInput.value);
    if (!n || n < 1) {
      showToast("Informe um número de atividades válido.", "alertCircle");
      return;
    }
    store.setDailyGoal(n);
    showToast("Meta diária atualizada.");
  });
}
