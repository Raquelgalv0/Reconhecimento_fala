import { store } from "../store.js";
import { showToast } from "../ui-utils.js";
import { Icon } from "../icons.js";
import {
  generateSummaryFromText,
  generateFlashcardsFromText,
  generateChecklistFromText,
  generateQuestionsFromText,
  generateMindMapFromText,
} from "../ai.js";

// Rascunho gerado — vive fora do ciclo de render para sobreviver a re-renders
// (mesmo padrão de `session` em flashcards.js/questoes.js).
let lastResult = null;

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function folderOptionsHtml(selectedId) {
  return store
    .flattenFolders()
    .map((f) => `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${"— ".repeat(f.depth)}${esc(f.name)}</option>`)
    .join("");
}

function mindMapHtml(mm) {
  return `<div class="mindmap"><div class="mm-center">${esc(mm.title)}</div><div class="mm-branches">${mm.branches
    .map((b) => `<div class="mm-branch">${esc(b)}</div>`)
    .join("")}</div></div>`;
}

export function renderUpload(container) {
  const folders = store.flattenFolders();

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Upload de Materiais</h1>
        <p class="sub">Cole o texto de uma aula, PDF ou slide — a IA transforma automaticamente em resumo, flashcards, questões, checklist e mapa mental.</p>
      </div>
    </div>
    ${
      folders.length === 0
        ? `<div class="empty-state"><div class="big">${Icon("folder", { size: 30 })}</div>Crie um assunto na barra lateral primeiro.</div>`
        : renderForm(folders)
    }
    <div id="upload-result">${lastResult ? renderResultHtml(lastResult) : ""}</div>
  `;

  if (folders.length === 0) return;
  wireForm(container);
  if (lastResult) wireResult(container);
}

function renderForm(folders) {
  return `
    <div class="panel">
      <div class="field">
        <label>Título do material</label>
        <input type="text" id="up-title" placeholder="Ex.: Aula 3 - Sistema Cardiovascular" />
      </div>
      <div class="field">
        <label>Arquivo de texto (.txt/.md) — opcional</label>
        <input type="file" id="up-file" accept=".txt,.md,text/plain" />
        <div class="field-hint">PDFs, imagens e slides ainda não são lidos automaticamente neste protótipo — cole o texto extraído abaixo.</div>
      </div>
      <div class="field">
        <label>Cole o texto do material</label>
        <textarea id="up-source" style="min-height:180px" placeholder="Cole aqui o conteúdo da aula, do PDF ou dos slides..."></textarea>
      </div>
      <div class="field">
        <label>Assunto</label>
        <select id="up-folder">${folderOptionsHtml(folders[0].id)}</select>
      </div>
      <div class="upload-options">
        <label class="upload-opt"><input type="checkbox" id="opt-resumo" checked />${Icon("fileText", { size: 14 })}<span>Resumo</span></label>
        <label class="upload-opt">
          <input type="checkbox" id="opt-flashcards" checked />${Icon("layers", { size: 14 })}<span>Flashcards</span>
          <input type="text" inputmode="numeric" class="opt-count" id="count-flashcards" value="5" />
        </label>
        <label class="upload-opt">
          <input type="checkbox" id="opt-questoes" checked />${Icon("helpCircle", { size: 14 })}<span>Questões</span>
          <input type="text" inputmode="numeric" class="opt-count" id="count-questoes" value="3" />
        </label>
        <label class="upload-opt"><input type="checkbox" id="opt-checklist" checked />${Icon("checkSquare", { size: 14 })}<span>Checklist</span></label>
        <label class="upload-opt"><input type="checkbox" id="opt-mindmap" checked />${Icon("mindMap", { size: 14 })}<span>Mapa mental</span></label>
      </div>
      <button class="btn btn-primary" id="process-btn">${Icon("sparkles", { size: 14 })}<span>Processar com IA</span></button>
    </div>
  `;
}

function renderResultHtml(r) {
  return `
    <div class="panel upload-preview">
      <h3>${Icon("check", { size: 16 })}<span>Pré-visualização</span></h3>
      <p class="muted-note" style="margin-bottom:14px;">Revise o que a IA gerou (simulado localmente). Você poderá editar tudo depois de salvar.</p>

      ${
        r.summaryHtml
          ? `<div class="preview-block"><b>${Icon("fileText", { size: 13 })} Resumo: ${esc(r.title)}</b><div class="preview-box editor-body">${r.summaryHtml}</div></div>`
          : ""
      }
      ${r.mindmap ? `<div class="preview-block"><b>${Icon("mindMap", { size: 13 })} Mapa mental</b>${mindMapHtml(r.mindmap)}</div>` : ""}
      ${
        r.checklist && r.checklist.length
          ? `<div class="preview-block"><b>${Icon("checkSquare", { size: 13 })} Checklist (${r.checklist.length} itens)</b><div class="preview-box">${r.checklist
              .map((c) => `<div class="checklist-item" data-checked="false"><span class="check-box"></span><span class="check-text">${esc(c)}</span></div>`)
              .join("")}</div></div>`
          : ""
      }
      ${
        r.flashcards && r.flashcards.length
          ? `<div class="preview-block"><b>${Icon("layers", { size: 13 })} Flashcards (${r.flashcards.length})</b><div class="preview-flashcards">${r.flashcards
              .map((fc) => `<div class="preview-fc"><div class="fc-front">${esc(fc.front)}</div><div class="fc-back">${esc(fc.back)}</div></div>`)
              .join("")}</div></div>`
          : ""
      }
      ${
        r.questions && r.questions.length
          ? `<div class="preview-block"><b>${Icon("helpCircle", { size: 13 })} Questões (${r.questions.length})</b>${r.questions
              .map(
                (q) => `
        <div class="preview-question">
          <p>${esc(q.statement)}</p>
          <div class="q-meta">${q.alternatives.map((a) => `<span class="q-tag ${a.id === q.correctId ? "diff-facil" : ""}">${a.id}) ${esc(a.text).slice(0, 50)}</span>`).join("")}</div>
        </div>`
              )
              .join("")}</div>`
          : ""
      }

      <div class="btn-row" style="margin-top:18px; justify-content:space-between;">
        <button class="btn btn-ghost" id="discard-btn">Descartar</button>
        <button class="btn btn-primary" id="save-all-btn">${Icon("checkPlain", { size: 14 })}<span>Salvar tudo no Estuda+</span></button>
      </div>
    </div>
  `;
}

function wireForm(container) {
  const fileInput = container.querySelector("#up-file");
  const sourceEl = container.querySelector("#up-source");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      sourceEl.value = String(reader.result || "");
      showToast(`Arquivo "${file.name}" carregado.`, "upload");
    };
    reader.onerror = () => showToast("Não foi possível ler esse arquivo.", "alertCircle");
    reader.readAsText(file);
  });

  container.querySelector("#process-btn").addEventListener("click", async () => {
    const text = sourceEl.value.trim();
    if (text.length < 40) {
      showToast("Cole um texto mais completo (mínimo de 40 caracteres).", "alertCircle");
      return;
    }
    const title = container.querySelector("#up-title").value.trim() || "Material importado";
    const folderId = container.querySelector("#up-folder").value;
    const wantResumo = container.querySelector("#opt-resumo").checked;
    const wantFlashcards = container.querySelector("#opt-flashcards").checked;
    const wantQuestoes = container.querySelector("#opt-questoes").checked;
    const wantChecklist = container.querySelector("#opt-checklist").checked;
    const wantMindmap = container.querySelector("#opt-mindmap").checked;
    const countFlashcards = Math.max(1, Math.min(10, Number(container.querySelector("#count-flashcards").value) || 5));
    const countQuestoes = Math.max(1, Math.min(10, Number(container.querySelector("#count-questoes").value) || 3));

    if (!wantResumo && !wantFlashcards && !wantQuestoes && !wantChecklist && !wantMindmap) {
      showToast("Selecione ao menos um formato para gerar.", "alertCircle");
      return;
    }

    const btn = container.querySelector("#process-btn");
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${Icon("sparkles", { size: 14 })}<span>Processando com IA...</span>`;

    try {
      const [summaryHtml, flashcards, questions, checklist, mindmap] = await Promise.all([
        wantResumo ? generateSummaryFromText(text) : Promise.resolve(null),
        wantFlashcards ? generateFlashcardsFromText(text, countFlashcards) : Promise.resolve(null),
        wantQuestoes ? generateQuestionsFromText(text, countQuestoes) : Promise.resolve(null),
        wantChecklist ? generateChecklistFromText(text) : Promise.resolve(null),
        wantMindmap ? generateMindMapFromText(text, title) : Promise.resolve(null),
      ]);
      lastResult = { title, folderId, summaryHtml, flashcards, questions, checklist, mindmap };
      showToast("Material processado! Revise antes de salvar.", "sparkles");
      renderUpload(container);
    } catch (err) {
      showToast(err.message, "alertCircle");
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  });
}

function wireResult(container) {
  const discardBtn = container.querySelector("#discard-btn");
  const saveBtn = container.querySelector("#save-all-btn");

  discardBtn.addEventListener("click", () => {
    lastResult = null;
    renderUpload(container);
  });

  saveBtn.addEventListener("click", () => {
    const r = lastResult;
    let summaryId = null;

    if (r.summaryHtml || r.mindmap || r.checklist) {
      let html = r.summaryHtml || "";
      if (r.mindmap) html += mindMapHtml(r.mindmap);
      if (r.checklist && r.checklist.length) {
        html +=
          `<h3>Checklist de revisão</h3>` +
          r.checklist.map((c) => `<div class="checklist-item" data-checked="false"><span class="check-box"></span><span class="check-text">${esc(c)}</span></div>`).join("");
      }
      const summary = store.addSummary(r.folderId, r.title);
      store.updateSummary(summary.id, { contentHtml: html });
      summaryId = summary.id;
    }
    if (r.flashcards) {
      r.flashcards.forEach((fc) => store.addFlashcard({ folderId: r.folderId, front: fc.front, back: fc.back, summaryId }));
    }
    if (r.questions) {
      r.questions.forEach((q) => store.addQuestion({ folderId: r.folderId, statement: q.statement, alternatives: q.alternatives, correctId: q.correctId }));
    }

    lastResult = null;
    showToast("Material salvo — resumo, flashcards e questões sincronizados.", "check");
    if (summaryId) store.setRoute("resumos", { activeSummaryId: summaryId });
    else renderUpload(container);
  });
}
