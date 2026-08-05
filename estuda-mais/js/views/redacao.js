import { store } from "../store.js";
import { showToast } from "../ui-utils.js";
import { Icon } from "../icons.js";
import { correctEssay } from "../ai.js";

const COMPETENCIAS = [
  { key: "c1", label: "C1 · Domínio da norma culta" },
  { key: "c2", label: "C2 · Compreensão da proposta" },
  { key: "c3", label: "C3 · Seleção e organização de argumentos" },
  { key: "c4", label: "C4 · Mecanismos linguísticos (coesão)" },
  { key: "c5", label: "C5 · Proposta de intervenção" },
];

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function renderRedacao(container) {
  const view = store.state.ui.redacaoView || "list";
  const essayId = store.state.ui.activeEssayId;
  if (view === "editor") return renderEditor(container, essayId);
  if (view === "result" && essayId && store.state.essays.some((e) => e.id === essayId)) return renderResult(container, essayId);
  return renderList(container);
}

function renderList(container) {
  const essays = [...store.state.essays].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Redação ENEM</h1>
        <p class="sub">Escreva sua dissertação e receba correção imediata nas 5 competências, com feedback e sugestões (simulado).</p>
      </div>
      <button class="btn btn-primary" id="new-essay">${Icon("plus", { size: 14 })}<span>Nova redação</span></button>
    </div>
    <div class="essay-list">
      ${essays
        .map(
          (e) => `
        <div class="essay-card" data-open="${e.id}">
          <div class="essay-body">
            <p class="essay-title">${esc(e.title)}</p>
            <p class="essay-theme">${esc(e.theme || "Sem tema definido")}</p>
            <span class="muted-note">${formatDate(e.createdAt)}</span>
          </div>
          ${
            e.corrected
              ? `<div class="essay-score"><div class="essay-score-num">${e.total}</div><div class="essay-score-unit">/ 1000</div></div>`
              : `<span class="q-tag">rascunho</span>`
          }
          <button class="btn btn-sm btn-ghost" data-delete="${e.id}">${Icon("trash", { size: 13 })}</button>
        </div>`
        )
        .join("")}
    </div>
    ${essays.length === 0 ? `<div class="empty-state"><div class="big">${Icon("pencil", { size: 30 })}</div>Nenhuma redação ainda. Comece a primeira!</div>` : ""}
  `;

  container.querySelector("#new-essay").addEventListener("click", () => {
    store.setRoute("redacao", { redacaoView: "editor", activeEssayId: null });
  });
  container.querySelectorAll("[data-open]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete]")) return;
      const essay = store.state.essays.find((x) => x.id === card.dataset.open);
      store.setRoute("redacao", { redacaoView: essay.corrected ? "result" : "editor", activeEssayId: essay.id });
    });
  });
  container.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Excluir esta redação?")) {
        store.deleteEssay(btn.dataset.delete);
        showToast("Redação excluída.");
      }
    });
  });
}

function renderEditor(container, essayId) {
  const essay = essayId ? store.state.essays.find((e) => e.id === essayId) : null;

  container.innerHTML = `
    <div class="btn-row" style="justify-content:space-between; margin-bottom:8px;">
      <button class="btn btn-ghost btn-sm" id="back">← Todas as redações</button>
    </div>
    <div class="panel">
      <div class="field">
        <label>Título</label>
        <input type="text" id="es-title" placeholder="Ex.: Mobilidade urbana no Brasil" value="${essay ? esc(essay.title) : ""}" />
      </div>
      <div class="field">
        <label>Tema / proposta</label>
        <input type="text" id="es-theme" placeholder="Ex.: Os desafios da mobilidade urbana sustentável nas grandes cidades" value="${essay ? esc(essay.theme || "") : ""}" />
      </div>
      <div class="field">
        <label>Seu texto</label>
        <textarea id="es-text" style="min-height:320px" placeholder="Escreva sua dissertação argumentativa aqui...">${essay ? esc(essay.text) : ""}</textarea>
        <div class="field-hint"><span id="word-count">0</span> palavras · ideal entre 250 e 350</div>
      </div>
      <button class="btn btn-primary" id="correct-btn">${Icon("sparkles", { size: 14 })}<span>Corrigir com IA</span></button>
    </div>
  `;

  const textEl = container.querySelector("#es-text");
  const wordCountEl = container.querySelector("#word-count");
  const updateCount = () => (wordCountEl.textContent = (textEl.value.trim().match(/\S+/g) || []).length);
  updateCount();
  textEl.addEventListener("input", updateCount);

  container.querySelector("#back").addEventListener("click", () => store.setRoute("redacao", { redacaoView: "list", activeEssayId: null }));

  container.querySelector("#correct-btn").addEventListener("click", () => {
    const title = container.querySelector("#es-title").value.trim() || "Redação sem título";
    const theme = container.querySelector("#es-theme").value.trim();
    const text = textEl.value.trim();
    if (text.length < 80) {
      showToast("Escreva um texto mais completo antes de corrigir.", "alertCircle");
      return;
    }
    const result = correctEssay(text, theme);
    let id = essayId;
    if (id) {
      store.updateEssay(id, { title, theme, text, corrected: true, ...result });
    } else {
      const created = store.addEssay({ title, theme, text });
      id = created.id;
      store.updateEssay(id, { corrected: true, ...result });
    }
    showToast("Redação corrigida (simulado)!", "sparkles");
    store.setRoute("redacao", { redacaoView: "result", activeEssayId: id });
  });
}

function renderResult(container, essayId) {
  const essay = store.state.essays.find((e) => e.id === essayId);

  container.innerHTML = `
    <div class="btn-row" style="justify-content:space-between; margin-bottom:8px;">
      <button class="btn btn-ghost btn-sm" id="back">← Todas as redações</button>
      <button class="btn btn-ghost btn-sm" id="rewrite">${Icon("pencil", { size: 13 })}<span>Reescrever</span></button>
    </div>

    <div class="panel essay-result-header">
      <div>
        <h1 style="margin:0 0 4px;">${esc(essay.title)}</h1>
        <p class="muted-note">${esc(essay.theme || "Sem tema definido")}</p>
      </div>
      <div class="essay-total">
        <div class="essay-total-num">${essay.total}</div>
        <div class="essay-total-unit">de 1000</div>
      </div>
    </div>

    <div class="stat-grid stat-grid--3">
      ${COMPETENCIAS.map((c) => {
        const score = essay.scores[c.key];
        const pct = Math.round((score / 200) * 100);
        const cls = pct >= 80 ? "good" : pct >= 50 ? "mid" : "low";
        return `
        <div class="panel comp-card">
          <div class="comp-head"><b>${c.label}</b><span>${score}/200</span></div>
          <div class="goal-bar"><div class="goal-bar-fill comp-${cls}" style="width:${pct}%"></div></div>
          <p class="comp-feedback">${esc(essay.feedback[c.key])}</p>
        </div>`;
      }).join("")}
    </div>

    <div class="panel">
      <h3>${Icon("lightbulb", { size: 15 })}<span>Principais sugestões de melhoria</span></h3>
      <div class="priority-list">
        ${essay.suggestions.map((s, i) => `<div class="priority-item"><div class="num">${i + 1}</div><div class="txt"><span>${esc(s)}</span></div></div>`).join("")}
      </div>
    </div>

    <div class="panel">
      <h3>${Icon("fileText", { size: 15 })}<span>Seu texto</span></h3>
      <div class="preview-box">${esc(essay.text)
        .split(/\n+/)
        .map((p) => `<p>${p}</p>`)
        .join("")}</div>
    </div>
  `;

  container.querySelector("#back").addEventListener("click", () => store.setRoute("redacao", { redacaoView: "list", activeEssayId: null }));
  container.querySelector("#rewrite").addEventListener("click", () => store.setRoute("redacao", { redacaoView: "editor", activeEssayId: essay.id }));
}
