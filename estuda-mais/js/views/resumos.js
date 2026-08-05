import { store } from "../store.js";
import { debounce, stripHtml, formatDate, showToast, openModal, closeModal } from "../ui-utils.js";
import { generateSummaryFromText, suggestFlashcardFromSelection } from "../ai.js";
import { Icon } from "../icons.js";

export function renderResumos(container) {
  const { activeSummaryId, activeFolderId } = store.state.ui;
  if (activeSummaryId) {
    renderEditor(container, activeSummaryId);
  } else {
    renderList(container, activeFolderId);
  }
}

function folderOptionsHtml(selectedId) {
  return store
    .flattenFolders()
    .map(
      (f) =>
        `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${"— ".repeat(f.depth)}${escapeAttr(f.name)}</option>`
    )
    .join("");
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const PAGE_STYLES = [
  { id: "minimal", label: "Minimalista" },
  { id: "a4", label: "Folha A4" },
  { id: "caderno", label: "Caderno" },
  { id: "pautada", label: "Pautada colorida" },
  { id: "pontilhada", label: "Pontilhada" },
  { id: "pastel", label: "Pastel" },
  { id: "medicina", label: "Modo Medicina" },
  { id: "concurso", label: "Modo Concurso" },
  { id: "enem", label: "Modo ENEM" },
  { id: "fichamento", label: "Fichamento" },
  { id: "cornell", label: "Cornell" },
];

// ---------------------------------------------------------------- LIST ----
function renderList(container, activeFolderId) {
  const folders = store.flattenFolders();
  const summaries = activeFolderId
    ? store.state.summaries.filter((s) => store.descendantFolderIds(activeFolderId).includes(s.folderId))
    : store.state.summaries;

  const chips = [`<button class="btn btn-sm ${!activeFolderId ? "btn-primary" : "btn-ghost"}" data-filter="">Todos os assuntos</button>`]
    .concat(
      folders.map(
        (f) =>
          `<button class="btn btn-sm ${activeFolderId === f.id ? "btn-primary" : "btn-ghost"}" data-filter="${f.id}">${"— ".repeat(f.depth)}${f.name}</button>`
      )
    )
    .join("");

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Resumos</h1>
        <p class="sub">Escreva do zero, peça para a IA gerar a partir de um material e transforme trechos em flashcards com um clique.</p>
      </div>
      <button class="btn btn-primary" id="btn-new-summary">${Icon("plus", { size: 14 })}<span>Novo resumo</span></button>
    </div>
    <div class="btn-row" style="flex-wrap:wrap; margin-bottom:18px;">${chips}</div>
    <div class="summary-grid">
      <button class="new-card" id="new-card-inline">${Icon("plus", { size: 20 })}<span>Novo resumo</span></button>
      ${summaries
        .map((s) => {
          const count = store.flashcardCountForSummary(s.id);
          return `
        <div class="summary-card" data-open="${s.id}">
          <h4>${escapeAttr(s.title || "Sem título")}</h4>
          <div class="excerpt">${escapeAttr(stripHtml(s.contentHtml)).slice(0, 140) || "Resumo vazio — clique para escrever."}</div>
          <div class="meta">
            <span>${store.folderPath(s.folderId)}</span>
            <span>· ${formatDate(s.updatedAt)}</span>
            ${count ? `<span class="fc-count">${Icon("layers", { size: 11 })} ${count} flashcard${count > 1 ? "s" : ""}</span>` : ""}
          </div>
        </div>`;
        })
        .join("")}
    </div>
    ${summaries.length === 0 ? `<div class="empty-state"><div class="big">${Icon("fileText", { size: 30 })}</div>Nenhum resumo neste assunto ainda.</div>` : ""}
  `;

  container.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      store.setRoute("resumos", { activeFolderId: btn.dataset.filter || null });
    });
  });
  container.querySelectorAll("[data-open]").forEach((card) => {
    card.addEventListener("click", () => store.setRoute("resumos", { activeSummaryId: card.dataset.open }));
  });
  const newBtn = container.querySelector("#btn-new-summary");
  const newBtn2 = container.querySelector("#new-card-inline");
  [newBtn, newBtn2].forEach((b) => b && b.addEventListener("click", () => openNewSummaryModal(activeFolderId)));
}

function openNewSummaryModal(defaultFolderId) {
  const folders = store.flattenFolders();
  if (folders.length === 0) {
    showToast("Crie uma pasta/assunto na barra lateral primeiro.", "alertCircle");
    return;
  }
  openModal(
    `
    <h3>Novo resumo</h3>
    <p class="modal-sub">Organize por assunto — os flashcards criados a partir dele herdam a mesma pasta.</p>
    <div class="field">
      <label>Título</label>
      <input type="text" id="f-title" placeholder="Ex.: Controle de Constitucionalidade" />
    </div>
    <div class="field">
      <label>Assunto / pasta</label>
      <select id="f-folder">${folderOptionsHtml(defaultFolderId || folders[0].id)}</select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="confirm">Criar resumo</button>
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelector("#f-title").focus();
        modal.querySelector("#cancel").addEventListener("click", closeModal);
        modal.querySelector("#confirm").addEventListener("click", () => {
          const title = modal.querySelector("#f-title").value.trim() || "Novo resumo";
          const folderId = modal.querySelector("#f-folder").value;
          const s = store.addSummary(folderId, title);
          closeModal();
          store.setRoute("resumos", { activeSummaryId: s.id, activeFolderId: null });
        });
      },
    }
  );
}

// -------------------------------------------------------------- EDITOR ----
function renderEditor(container, summaryId) {
  const summary = store.state.summaries.find((s) => s.id === summaryId);
  if (!summary) {
    store.setRoute("resumos", { activeSummaryId: null });
    return;
  }

  container.innerHTML = `
    <div class="btn-row" style="justify-content:space-between; margin-bottom:8px;">
      <button class="btn btn-ghost btn-sm" id="back">← Todos os resumos</button>
      <button class="btn btn-ghost btn-sm" id="delete-summary" style="color:var(--red)">${Icon("trash", { size: 13 })}<span>Excluir</span></button>
    </div>
    <div class="folder-picker-inline">
      ${Icon("folder", { size: 13 })} Salvo em
      <select id="folder-select">${folderOptionsHtml(summary.folderId)}</select>
      <button class="page-style-btn" id="page-style-btn" title="Modelo de página">
        ${Icon("layout", { size: 13 })}<span>${PAGE_STYLES.find((s) => s.id === (summary.pageStyle || "minimal")).label}</span>
      </button>
    </div>
    <input type="text" id="title-input" class="title-input" data-focus-guard placeholder="Título do resumo" value="${escapeAttr(summary.title)}" />

    <div class="editor-toolbar">
      <button data-cmd="bold" title="Negrito"><b>B</b></button>
      <button data-cmd="italic" title="Itálico"><i>I</i></button>
      <button data-cmd="formatBlock:h2" title="Título">H2</button>
      <button data-cmd="formatBlock:h3" title="Subtítulo">H3</button>
      <div class="sep"></div>
      <button data-cmd="insertUnorderedList" title="Lista">${Icon("list", { size: 15 })}</button>
      <button data-cmd="formatBlock:blockquote" title="Citação">${Icon("quote", { size: 15 })}</button>
      <button data-cmd="highlight" title="Destacar">${Icon("highlighter", { size: 15 })}</button>
      <div class="sep"></div>
      <button data-cmd="link" title="Adicionar link">${Icon("link", { size: 15 })}</button>
      <button data-cmd="image" title="Adicionar imagem">${Icon("image", { size: 15 })}</button>
      <button class="ai-btn" id="ai-generate">${Icon("sparkles", { size: 14 })}<span>Gerar com IA</span></button>
    </div>
    <div class="editor-toolbar editor-toolbar--insert">
      <button data-insert="checklist" title="Checklist">${Icon("checkSquare", { size: 15 })}<span>Checklist</span></button>
      <button data-insert="table" title="Tabela">${Icon("table", { size: 15 })}<span>Tabela</span></button>
      <button data-insert="code" title="Código">${Icon("code", { size: 15 })}<span>Código</span></button>
      <button data-insert="callout" title="Caixa de destaque">${Icon("lightbulb", { size: 15 })}<span>Destaque</span></button>
      <button data-insert="columns" title="Colunas">${Icon("columns", { size: 15 })}<span>Colunas</span></button>
      <button data-insert="clinicalCase" title="Caso clínico">${Icon("pulse", { size: 15 })}<span>Caso clínico</span></button>
    </div>
    <div id="editor-body" class="editor-body page-style--${summary.pageStyle || "minimal"}" contenteditable="true" data-focus-guard
         data-placeholder="Comece a escrever ou clique em “Gerar com IA” para criar a partir de um material...">${summary.contentHtml || ""}</div>
  `;

  const titleInput = container.querySelector("#title-input");
  const editorBody = container.querySelector("#editor-body");
  const folderSelect = container.querySelector("#folder-select");

  const silentSaveTitle = debounce((val) => store.patchSummarySilent(summaryId, { title: val }), 400);
  const silentSaveBody = debounce((html) => store.patchSummarySilent(summaryId, { contentHtml: html }), 500);

  titleInput.addEventListener("input", (e) => silentSaveTitle(e.target.value));
  titleInput.addEventListener("blur", (e) => store.updateSummary(summaryId, { title: e.target.value.trim() || "Sem título" }));

  editorBody.addEventListener("input", () => silentSaveBody(editorBody.innerHTML));
  editorBody.addEventListener("blur", () => store.updateSummary(summaryId, { contentHtml: editorBody.innerHTML }));

  folderSelect.addEventListener("change", (e) => {
    store.updateSummary(summaryId, { folderId: e.target.value });
    showToast("Resumo movido de pasta.");
  });

  container.querySelector("#back").addEventListener("click", () => store.setRoute("resumos", { activeSummaryId: null }));
  container.querySelector("#delete-summary").addEventListener("click", () => {
    if (confirm(`Excluir o resumo "${summary.title}"? Os flashcards já criados a partir dele são mantidos.`)) {
      store.deleteSummary(summaryId);
      store.setRoute("resumos", { activeSummaryId: null });
    }
  });

  // --- toolbar formatting ---
  container.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep selection
    btn.addEventListener("click", () => {
      editorBody.focus();
      const cmd = btn.dataset.cmd;
      if (cmd.startsWith("formatBlock:")) {
        document.execCommand("formatBlock", false, cmd.split(":")[1]);
      } else if (cmd === "link") {
        const url = prompt("Cole o link (URL):", "https://");
        if (url) document.execCommand("createLink", false, url);
      } else if (cmd === "image") {
        const url = prompt("Cole o link da imagem (URL):", "https://");
        if (url) document.execCommand("insertImage", false, url);
      } else if (cmd === "highlight") {
        wrapSelection(editorBody, "");
      } else {
        document.execCommand(cmd, false, null);
      }
      editorBody.dispatchEvent(new Event("input"));
    });
  });

  container.querySelector("#ai-generate").addEventListener("click", () => openAiGenerateModal(summaryId, editorBody));
  container.querySelector("#page-style-btn").addEventListener("click", () => openPageStyleModal(summaryId, summary.pageStyle || "minimal"));

  // --- insert-block toolbar ---
  const INSERTERS = {
    checklist: () => `<div class="checklist-item" data-checked="false"><span class="check-box"></span><span class="check-text">Item da lista</span></div>`,
    table: () =>
      `<table class="editor-table"><tbody>` +
      `<tr><td>Coluna 1</td><td>Coluna 2</td><td>Coluna 3</td></tr>` +
      `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>` +
      `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>` +
      `</tbody></table><p><br></p>`,
    code: () => `<pre class="code-block">// seu código aqui</pre><p><br></p>`,
    callout: () =>
      `<div class="callout"><span class="callout-icon">${Icon("lightbulb", { size: 15 })}</span><span class="callout-text">Escreva aqui uma observação importante...</span></div><p><br></p>`,
    columns: () => `<div class="columns"><div class="column"><p>Coluna 1</p></div><div class="column"><p>Coluna 2</p></div></div><p><br></p>`,
    clinicalCase: () =>
      `<div class="clinical-case">` +
      `<div class="cc-header">${Icon("pulse", { size: 14 })}<span>Caso clínico</span></div>` +
      `<div class="cc-field"><label>Identificação</label><p>Paciente, idade, sexo, comorbidades...</p></div>` +
      `<div class="cc-field"><label>Queixa principal</label><p>...</p></div>` +
      `<div class="cc-field"><label>História da doença atual</label><p>...</p></div>` +
      `<div class="cc-field"><label>Exame físico</label><p>...</p></div>` +
      `<div class="cc-field"><label>Hipótese diagnóstica / Conduta</label><p>...</p></div>` +
      `</div><p><br></p>`,
  };
  container.querySelectorAll("[data-insert]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      editorBody.focus();
      document.execCommand("insertHTML", false, INSERTERS[btn.dataset.insert]());
      editorBody.dispatchEvent(new Event("input"));
    });
  });

  // --- click on checklist checkbox or an existing linked flashcard mark ---
  editorBody.addEventListener("click", (e) => {
    const checkBox = e.target.closest(".check-box");
    if (checkBox) {
      const item = checkBox.closest(".checklist-item");
      item.dataset.checked = item.dataset.checked === "true" ? "false" : "true";
      editorBody.dispatchEvent(new Event("input"));
      return;
    }
    const mark = e.target.closest("mark.linked-fc");
    if (!mark || !mark.dataset.fcId) return;
    const card = store.state.flashcards.find((c) => c.id === mark.dataset.fcId);
    if (card) {
      showToast("Abrindo o flashcard vinculado...", "layers");
      store.setRoute("flashcards", { activeDeckId: card.folderId });
    }
  });

  // --- selection -> floating toolbar ---
  setupSelectionToolbar(editorBody, summary);
}

function wrapSelection(root, cls) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const mark = document.createElement("mark");
  if (cls) mark.className = cls;
  try {
    range.surroundContents(mark);
  } catch (e) {
    const frag = range.extractContents();
    mark.appendChild(frag);
    range.insertNode(mark);
  }
  sel.removeAllRanges();
  return mark;
}

function setupSelectionToolbar(editorBody, summary) {
  let bar = document.getElementById("selection-toolbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "selection-toolbar";
    bar.className = "selection-toolbar";
    bar.innerHTML = `
      <button id="sel-highlight">${Icon("highlighter", { size: 13 })}<span>Destacar</span></button>
      <button id="sel-flashcard" class="primary">${Icon("sparkles", { size: 13 })}<span>Criar Flashcard</span></button>
    `;
    document.body.appendChild(bar);
  }

  const hide = () => bar.classList.remove("show");
  const updatePosition = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return hide();
    const range = sel.getRangeAt(0);
    if (!editorBody.contains(range.commonAncestorContainer)) return hide();
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return hide();
    bar.style.left = `${rect.left + rect.width / 2}px`;
    bar.style.top = `${rect.top - 10}px`;
    bar.classList.add("show");
  };

  editorBody.onmouseup = updatePosition;
  editorBody.onkeyup = updatePosition;
  document.addEventListener("mousedown", (e) => {
    if (e.target.closest("#selection-toolbar") || e.target.closest("#editor-body")) return;
    hide();
  });

  bar.querySelector("#sel-highlight").onclick = () => {
    wrapSelection(editorBody, "");
    editorBody.dispatchEvent(new Event("input"));
    hide();
  };

  bar.querySelector("#sel-flashcard").onclick = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const selectedText = sel.toString();
    const tempId = `pending-${Date.now()}`;
    const mark = wrapSelection(editorBody, "linked-fc pending");
    if (mark) mark.dataset.temp = tempId;
    hide();
    editorBody.dispatchEvent(new Event("input"));
    openCreateFlashcardModal({ editorBody, summary, selectedText, tempId, mark });
  };
}

function openCreateFlashcardModal({ editorBody, summary, selectedText, tempId, mark }) {
  const suggestion = suggestFlashcardFromSelection(selectedText);
  const deckName = store.folderPath(summary.folderId);

  const unwrapPending = () => {
    const el = editorBody.querySelector(`mark[data-temp="${tempId}"]`);
    if (el) {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      editorBody.dispatchEvent(new Event("input"));
    }
  };

  openModal(
    `
    <h3>${Icon("sparkles", { size: 16 })} Criar flashcard a partir do trecho</h3>
    <div class="ai-source-note">${Icon("lightbulb", { size: 14 })}<span>Sugestão gerada automaticamente a partir do texto selecionado. Revise antes de salvar.</span></div>
    <div class="field">
      <label>Frente (pergunta)</label>
      <textarea id="f-front">${escapeAttr(suggestion.front)}</textarea>
    </div>
    <div class="field">
      <label>Verso (resposta)</label>
      <textarea id="f-back">${escapeAttr(suggestion.back)}</textarea>
    </div>
    <div class="field">
      <label>Dica (assunto / baralho)</label>
      <input type="text" id="f-hint" value="${escapeAttr(deckName)}" />
      <div class="field-hint">Vai aparecer como dica no flashcard — herdada automaticamente da pasta do resumo.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="confirm">Salvar e sincronizar</button>
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelector("#cancel").addEventListener("click", () => {
          unwrapPending();
          closeModal();
        });
        modal.querySelector("#confirm").addEventListener("click", () => {
          const front = modal.querySelector("#f-front").value.trim();
          const back = modal.querySelector("#f-back").value.trim();
          const hint = modal.querySelector("#f-hint").value.trim();
          if (!front || !back) {
            showToast("Preencha frente e verso.", "alertCircle");
            return;
          }
          const card = store.addFlashcard({ folderId: summary.folderId, front, back, hint, summaryId: summary.id });
          const el = editorBody.querySelector(`mark[data-temp="${tempId}"]`);
          if (el) {
            el.className = "linked-fc";
            el.dataset.fcId = card.id;
            delete el.dataset.temp;
          }
          store.updateSummary(summary.id, { contentHtml: editorBody.innerHTML });
          closeModal();
          showToast(`Flashcard criado e sincronizado com "${deckName}"`, "layers");
        });
      },
    }
  );
}

function openAiGenerateModal(summaryId, editorBody) {
  openModal(
    `
    <h3>${Icon("sparkles", { size: 16 })} Gerar resumo com IA</h3>
    <div class="ai-source-note">${Icon("lightbulb", { size: 14 })}<span>Neste protótipo a geração roda localmente (sem enviar dados para fora) — na versão final chamaria um modelo de linguagem real.</span></div>
    <div class="field">
      <label>Cole o material (aula, PDF copiado, anotações...)</label>
      <textarea id="f-source" style="min-height:160px" placeholder="Cole aqui o texto-base..."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="confirm">Gerar resumo</button>
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelector("#f-source").focus();
        modal.querySelector("#cancel").addEventListener("click", closeModal);
        modal.querySelector("#confirm").addEventListener("click", () => {
          const text = modal.querySelector("#f-source").value.trim();
          if (!text) {
            showToast("Cole um texto para gerar o resumo.", "alertCircle");
            return;
          }
          const html = generateSummaryFromText(text);
          const isEmpty = stripHtml(editorBody.innerHTML).length === 0;
          editorBody.innerHTML = isEmpty ? html : editorBody.innerHTML + "<hr/>" + html;
          store.updateSummary(summaryId, { contentHtml: editorBody.innerHTML });
          closeModal();
          showToast("Resumo gerado com IA (simulado).", "sparkles");
        });
      },
    }
  );
}

function openPageStyleModal(summaryId, currentStyle) {
  openModal(
    `
    <h3>${Icon("layout", { size: 16 })} Modelo de página</h3>
    <p class="modal-sub">Muda só a aparência do resumo — o conteúdo continua o mesmo.</p>
    <div class="style-grid">
      ${PAGE_STYLES.map(
        (s) => `
        <button class="style-swatch ${s.id === currentStyle ? "selected" : ""}" data-style="${s.id}">
          <span class="style-preview page-style--${s.id}"></span>
          <span>${s.label}</span>
        </button>`
      ).join("")}
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelectorAll("[data-style]").forEach((btn) => {
          btn.addEventListener("click", () => {
            applyPageStyle(summaryId, btn.dataset.style);
            closeModal();
          });
        });
      },
    }
  );
}

function applyPageStyle(summaryId, styleId) {
  const summary = store.state.summaries.find((s) => s.id === summaryId);
  const patch = { pageStyle: styleId };
  if (styleId === "cornell" && !/cornell-layout/.test(summary.contentHtml || "")) {
    const skeleton =
      `<div class="cornell-layout">` +
      `<div class="cornell-cue"><p><b>Perguntas / palavras-chave</b></p></div>` +
      `<div class="cornell-notes"><p>Suas anotações da aula aqui...</p></div>` +
      `<div class="cornell-summary"><p><b>Resumo:</b> escreva aqui a síntese do conteúdo.</p></div>` +
      `</div>`;
    patch.contentHtml = (summary.contentHtml || "") + skeleton;
  }
  store.updateSummary(summaryId, patch);
  showToast(`Modelo "${PAGE_STYLES.find((s) => s.id === styleId).label}" aplicado.`, "layout");
}
