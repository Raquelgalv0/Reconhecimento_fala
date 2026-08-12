import { store } from "../store.js";
import { debounce, stripHtml, formatDate, showToast, openModal, closeModal } from "../ui-utils.js";
import { generateSummaryFromText, suggestFlashcardFromSelection, generateQuestionsFromText } from "../ai.js";
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

const HIGHLIGHT_COLORS = [
  { hex: "#ffe28a", cls: "hl-amarelo", label: "Amarelo" },
  { hex: "#bdeecb", cls: "hl-verde", label: "Verde" },
  { hex: "#f6c9dd", cls: "hl-rosa", label: "Rosa" },
  { hex: "#c7dcf7", cls: "hl-azul", label: "Azul" },
];

const FONT_COLORS = [
  { hex: "#221c2c", label: "Padrão" },
  { hex: "#5b3f82", label: "Roxo" },
  { hex: "#c98a3c", label: "Âmbar" },
  { hex: "#2f9e6b", label: "Verde" },
  { hex: "#b84a5a", label: "Vermelho" },
  { hex: "#4d6fa3", label: "Azul" },
];

const FONT_STYLES = [
  { id: "padrao", label: "Padrão", fontName: "Sistema", sample: "Assim fica o seu texto" },
  { id: "classica", label: "Clássica", fontName: "Lora", sample: "Assim fica o seu texto" },
  { id: "manuscrita", label: "Manuscrita", fontName: "Caveat", sample: "Assim fica o seu texto" },
  { id: "moderna", label: "Moderna", fontName: "Manrope", sample: "Assim fica o seu texto" },
];

// "media" é o espaçamento padrão de sempre (1.85) — só ganhou nome pra virar
// uma opção entre outras, sem mudar a aparência de resumos já existentes.
const LINE_SPACINGS = [
  { id: "simples", label: "Simples" },
  { id: "media", label: "1,5 linhas" },
  { id: "duplo", label: "Duplo" },
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
          `<button class="btn btn-sm ${activeFolderId === f.id ? "btn-primary" : "btn-ghost"}" data-filter="${f.id}">${"— ".repeat(f.depth)}${
            f.kind === "caderno" ? Icon("notebook", { size: 11 }) : ""
          }${f.name}</button>`
      )
    )
    .join("");

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Resumos</h1>
        <p class="sub">Escreva do zero, peça para a IA gerar a partir de um material e transforme trechos em flashcards com um clique.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="btn-new-subfolder">${Icon("folder", { size: 14 })}<span>Novo bloco</span></button>
        <button class="btn btn-ghost" id="btn-new-caderno">${Icon("notebook", { size: 14 })}<span>Novo caderno</span></button>
        <button class="btn btn-primary" id="btn-new-summary">${Icon("plus", { size: 14 })}<span>Novo resumo</span></button>
      </div>
    </div>
    <div class="btn-row" style="flex-wrap:wrap; margin-bottom:18px;">${chips}</div>
    <div class="summary-grid">
      <button class="new-card" id="new-card-inline">${Icon("plus", { size: 20 })}<span>Novo resumo</span></button>
      ${summaries
        .map((s) => {
          const count = store.flashcardCountForSummary(s.id);
          const folderName = store.state.folders.find((f) => f.id === s.folderId)?.name || "";
          return `
        <div class="summary-card" data-open="${s.id}">
          <button class="summary-card-delete" data-delete-summary="${s.id}" title="Excluir resumo">${Icon("trash", { size: 13 })}</button>
          <h4>${escapeAttr(s.title || "Sem título")}</h4>
          <div class="excerpt">${escapeAttr(stripHtml(s.contentHtml)).slice(0, 140) || "Resumo vazio. Clique para escrever."}</div>
          <div class="meta">
            <span class="meta-folder" title="${escapeAttr(store.folderPath(s.folderId))}">${escapeAttr(folderName)}</span>
            <span class="meta-sep">· ${formatDate(s.updatedAt)}</span>
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
  container.querySelectorAll("[data-delete-summary]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteSummary;
      const summary = store.state.summaries.find((s) => s.id === id);
      if (!summary) return;
      if (confirm(`Excluir o resumo "${summary.title || "Sem título"}"? Os flashcards já criados a partir dele são mantidos.`)) {
        store.deleteSummary(id);
        showToast("Resumo excluído.", "trash");
      }
    });
  });
  const newBtn = container.querySelector("#btn-new-summary");
  const newBtn2 = container.querySelector("#new-card-inline");
  [newBtn, newBtn2].forEach((b) => b && b.addEventListener("click", () => openNewSummaryModal(activeFolderId)));
  container.querySelector("#btn-new-caderno").addEventListener("click", () => {
    const name = prompt("Nome do novo caderno:");
    if (name && name.trim()) {
      store.addFolder(name.trim(), null, "caderno");
      showToast(`Caderno "${name.trim()}" criado.`, "notebook");
    }
  });
  container.querySelector("#btn-new-subfolder").addEventListener("click", () => openNewSubfolderModal(activeFolderId));
}

function openNewSubfolderModal(defaultFolderId) {
  const folders = store.flattenFolders();
  if (folders.length === 0) {
    showToast("Crie um assunto na barra lateral primeiro.", "alertCircle");
    return;
  }
  openModal(
    `
    <h3>Novo bloco</h3>
    <p class="modal-sub">Cria um bloco dentro do assunto escolhido, pra organizar melhor os resumos.</p>
    <div class="field">
      <label>Dentro de</label>
      <select id="sf-parent">${folderOptionsHtml(defaultFolderId || folders[0].id)}</select>
    </div>
    <div class="field">
      <label>Nome do bloco</label>
      <input type="text" id="sf-name" placeholder="Ex.: Direito Constitucional" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="confirm">Criar bloco</button>
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelector("#sf-name").focus();
        modal.querySelector("#cancel").addEventListener("click", closeModal);
        modal.querySelector("#confirm").addEventListener("click", () => {
          const name = modal.querySelector("#sf-name").value.trim();
          const parentId = modal.querySelector("#sf-parent").value;
          if (!name) {
            showToast("Digite um nome para o bloco.", "alertCircle");
            return;
          }
          const folder = store.addFolder(name, parentId);
          closeModal();
          showToast(`Bloco "${name}" criado.`, "folder");
          store.setRoute("resumos", { activeFolderId: folder.id, activeSummaryId: null });
        });
      },
    }
  );
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
    <p class="modal-sub">Organize por assunto: os flashcards criados a partir dele herdam a mesma pasta.</p>
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
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="export-summary">${Icon("download", { size: 13 })}<span>Exportar / Salvar</span></button>
        <button class="btn btn-ghost btn-sm" id="delete-summary" style="color:var(--red)">${Icon("trash", { size: 13 })}<span>Excluir</span></button>
      </div>
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
      <div class="tb-group">
        <button data-cmd="bold" title="Negrito"><b>B</b></button>
        <button data-cmd="italic" title="Itálico"><i>I</i></button>
        <button data-cmd="underline" title="Sublinhado"><u>U</u></button>
        <button data-cmd="removeFormat" title="Limpar formatação">${Icon("eraser", { size: 14 })}</button>
      </div>
      <div class="sep"></div>
      <div class="tb-group">
        <button data-cmd="formatBlock:p" title="Parágrafo normal">P</button>
        <button data-cmd="formatBlock:h2" title="Título">H2</button>
        <button data-cmd="formatBlock:h3" title="Subtítulo">H3</button>
      </div>
      <div class="sep"></div>
      <div class="tb-group">
        <button data-cmd="insertUnorderedList" title="Lista com marcadores">${Icon("list", { size: 15 })}</button>
        <button data-cmd="insertOrderedList" title="Lista numerada">${Icon("orderedList", { size: 15 })}</button>
        <button data-cmd="formatBlock:blockquote" title="Citação">${Icon("quote", { size: 15 })}</button>
      </div>
      <div class="sep"></div>
      <div class="tb-group">
        <button data-cmd="justifyLeft" title="Alinhar à esquerda">${Icon("alignLeft", { size: 15 })}</button>
        <button data-cmd="justifyCenter" title="Centralizar">${Icon("alignCenter", { size: 15 })}</button>
        <button data-cmd="justifyRight" title="Alinhar à direita">${Icon("alignRight", { size: 15 })}</button>
        <button data-cmd="justifyFull" title="Justificar">${Icon("alignJustify", { size: 15 })}</button>
        <button data-cmd="outdent" title="Diminuir recuo">${Icon("indentDecrease", { size: 15 })}</button>
        <button data-cmd="indent" title="Aumentar recuo">${Icon("indentIncrease", { size: 15 })}</button>
      </div>
      <div class="sep"></div>
      <div class="tb-group">
        <button class="toolbar-font-btn" id="font-style-btn" title="Fonte do resumo">
          ${Icon("pencil", { size: 13 })}<span>${FONT_STYLES.find((f) => f.id === (summary.fontFamily || "padrao")).label}</span>
        </button>
        <button class="toolbar-font-btn" id="line-spacing-btn" title="Espaçamento entre linhas">
          ${Icon("lineSpacing", { size: 13 })}<span>${LINE_SPACINGS.find((l) => l.id === (summary.lineSpacing || "media")).label}</span>
        </button>
      </div>
      <div class="sep"></div>
      <div class="tb-group">
        <div class="tb-popover-wrap">
          <button class="tb-popover-trigger" id="fc-trigger" title="Cor do texto"><b style="color:${FONT_COLORS[0].hex}">A</b></button>
          <div class="tb-popover" id="fc-popover">
            ${FONT_COLORS.map((c) => `<button data-fc="${c.hex}" class="fc-swatch" style="color:${c.hex}" title="Cor do texto: ${c.label}">A</button>`).join("")}
          </div>
        </div>
        <div class="tb-popover-wrap">
          <button class="tb-popover-trigger" id="hl-trigger" title="Destacar">${Icon("highlighter", { size: 15 })}</button>
          <div class="tb-popover" id="hl-popover">
            ${HIGHLIGHT_COLORS.map((c) => `<button data-hl="${c.hex}" class="hl-swatch ${c.cls}" title="Destacar (${c.label})"></button>`).join("")}
            <div class="tb-popover-sep"></div>
            <button data-hl-erase title="Apagar destaque">${Icon("eraser", { size: 15 })}</button>
          </div>
        </div>
      </div>
      <div class="sep"></div>
      <div class="tb-group">
        <button data-cmd="undo" title="Desfazer">${Icon("undo", { size: 15 })}</button>
        <button data-cmd="redo" title="Refazer">${Icon("redo", { size: 15 })}</button>
      </div>
      <div class="sep"></div>
      <div class="tb-group">
        <button data-cmd="link" title="Adicionar link">${Icon("link", { size: 15 })}</button>
        <button data-cmd="image" title="Adicionar imagem da galeria">${Icon("image", { size: 15 })}</button>
        <div class="tb-popover-wrap">
          <button class="toolbar-font-btn tb-popover-trigger" id="insert-trigger" title="Inserir bloco">${Icon("plus", { size: 13 })}<span>Inserir</span></button>
          <div class="tb-popover tb-popover--menu" id="insert-popover">
            <button data-insert="checklist" title="Checklist">${Icon("checkSquare", { size: 15 })}<span>Checklist</span></button>
            <button data-insert="table" title="Tabela">${Icon("table", { size: 15 })}<span>Tabela</span></button>
            <button data-insert="code" title="Código">${Icon("code", { size: 15 })}<span>Código</span></button>
            <button data-insert="callout" title="Caixa de destaque">${Icon("lightbulb", { size: 15 })}<span>Destaque</span></button>
            <button data-insert="columns" title="Colunas">${Icon("columns", { size: 15 })}<span>Colunas</span></button>
            ${
              (summary.pageStyle || "minimal") === "medicina"
                ? `<button data-insert="clinicalCase" title="Caso clínico">${Icon("pulse", { size: 15 })}<span>Caso clínico</span></button>`
                : ""
            }
          </div>
        </div>
      </div>
      <button class="ai-btn" id="ai-generate">${Icon("sparkles", { size: 14 })}<span>Gerar com IA</span></button>
      <button class="ai-btn" id="ai-questions">${Icon("helpCircle", { size: 14 })}<span>Transformar em questões</span></button>
    </div>
    <input type="file" id="editor-image-input" accept="image/*" style="display:none" />
    <div id="editor-body" class="editor-body page-style--${summary.pageStyle || "minimal"} font--${summary.fontFamily || "padrao"} ls--${summary.lineSpacing || "media"}" contenteditable="true" data-focus-guard
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
  container.querySelector("#export-summary").addEventListener("click", () => {
    const prevTitle = document.title;
    document.title = summary.title || "Resumo";
    const restoreTitle = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    window.addEventListener("afterprint", restoreTitle);
    window.print();
  });
  container.querySelector("#delete-summary").addEventListener("click", () => {
    if (confirm(`Excluir o resumo "${summary.title}"? Os flashcards já criados a partir dele são mantidos.`)) {
      store.deleteSummary(summaryId);
      store.setRoute("resumos", { activeSummaryId: null });
    }
  });

  // --- toolbar formatting ---
  const imageInput = container.querySelector("#editor-image-input");
  let savedRange = null;

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    imageInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Escolha um arquivo de imagem.", "alertCircle");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast("Imagem muito grande (máx. 4MB). Tente uma versão menor.", "alertCircle");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      editorBody.focus();
      const sel = window.getSelection();
      if (savedRange) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      document.execCommand("insertImage", false, String(reader.result || ""));
      editorBody.dispatchEvent(new Event("input"));
    };
    reader.onerror = () => showToast("Não foi possível ler essa imagem.", "alertCircle");
    reader.readAsDataURL(file);
  });

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
        const sel = window.getSelection();
        savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
        imageInput.click();
        return;
      } else {
        document.execCommand(cmd, false, null);
      }
      editorBody.dispatchEvent(new Event("input"));
    });
  });

  container.querySelectorAll("[data-fc]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      editorBody.focus();
      document.execCommand("foreColor", false, btn.dataset.fc);
      editorBody.dispatchEvent(new Event("input"));
    });
  });

  container.querySelectorAll("[data-hl]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      editorBody.focus();
      applyHighlightColor(editorBody, btn.dataset.hl);
      editorBody.dispatchEvent(new Event("input"));
    });
  });
  const eraseBtn = container.querySelector("[data-hl-erase]");
  let eraserMode = false;
  const setEraserMode = (on) => {
    eraserMode = on;
    eraseBtn.classList.toggle("active", eraserMode);
    editorBody.classList.toggle("eraser-mode", eraserMode);
  };
  eraseBtn.addEventListener("mousedown", (e) => e.preventDefault());
  eraseBtn.addEventListener("click", () => setEraserMode(!eraserMode));

  // Apaga o destaque sob o cursor (usado ao clicar-e-arrastar no modo borracha).
  // Trabalha em cima do elemento sob o ponteiro (sem tentar expandir pra um
  // "trecho inteiro" via Range, que se mostrou pouco confiável) — como agora
  // é clicar, segurar e arrastar por cima do texto, cada fragmento de cor que
  // o navegador criou vai sendo apagado conforme o mouse passa por cima.
  const eraseMarkAt = (target) => {
    const markEl = closestHighlightEl(editorBody, target);
    if (!markEl) return false;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNode(markEl);
    sel.removeAllRanges();
    sel.addRange(range);
    if (markEl.tagName === "MARK") {
      // Mark antigo (ex.: ligado a flashcard removido): troca o elemento pelo próprio conteúdo.
      document.execCommand("insertHTML", false, markEl.innerHTML);
    } else {
      // Span/font criado pelo hiliteColor: limpa a cor de fundo desse elemento.
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("hiliteColor", false, "transparent");
    }
    sel.removeAllRanges();
    editorBody.dispatchEvent(new Event("input"));
    return true;
  };

  // Apagar clicando-e-arrastando: pressiona o botão do mouse sobre um trecho
  // grifado, e enquanto arrasta por cima do texto (segurando o botão), tudo
  // que passar por baixo do cursor vai sendo apagado — como uma borracha de verdade.
  let isErasingDrag = false;
  editorBody.addEventListener("mousedown", (e) => {
    if (!eraserMode) return;
    if (closestHighlightEl(editorBody, e.target)) {
      e.preventDefault();
      isErasingDrag = true;
      eraseMarkAt(e.target);
    }
  });
  editorBody.addEventListener("mousemove", (e) => {
    if (!eraserMode || !isErasingDrag) return;
    eraseMarkAt(e.target);
  });
  window.addEventListener("mouseup", () => {
    isErasingDrag = false;
  });
  editorBody.addEventListener("mouseleave", () => {
    isErasingDrag = false;
  });

  container.querySelector("#ai-generate").addEventListener("click", () => openAiGenerateModal(summaryId, editorBody));
  container.querySelector("#ai-questions").addEventListener("click", () => openGenerateQuestionsModal(summaryId, editorBody));
  container.querySelector("#page-style-btn").addEventListener("click", () => openPageStyleModal(summaryId, summary.pageStyle || "minimal"));
  container.querySelector("#font-style-btn").addEventListener("click", () => openFontModal(summaryId, summary.fontFamily || "padrao"));
  container.querySelector("#line-spacing-btn").addEventListener("click", () => openLineSpacingModal(summaryId, summary.lineSpacing || "media"));

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

  // --- popovers da barra de ferramentas (cor de texto, destaque, inserir) ---
  // Em vez de deixar ~15 botões soltos sempre visíveis, cor de texto, destaque
  // e os blocos de inserção viram um gatilho + painel. A seleção de texto
  // continua preservada (mousedown com preventDefault no gatilho, igual aos
  // outros botões da barra), e o painel fecha sozinho ao escolher uma opção
  // ou ao clicar fora.
  const popoverWraps = container.querySelectorAll(".tb-popover-wrap");
  const closeAllPopovers = () => {
    popoverWraps.forEach((wrap) => wrap.querySelector(".tb-popover").classList.remove("open"));
  };
  popoverWraps.forEach((wrap) => {
    const trigger = wrap.querySelector(".tb-popover-trigger");
    const popover = wrap.querySelector(".tb-popover");
    trigger.addEventListener("mousedown", (e) => e.preventDefault());
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !popover.classList.contains("open");
      closeAllPopovers();
      if (willOpen) popover.classList.add("open");
    });
  });
  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".tb-popover-wrap")) closeAllPopovers();
  });
  container
    .querySelectorAll(".tb-popover [data-fc], .tb-popover [data-hl], .tb-popover [data-hl-erase], .tb-popover [data-insert]")
    .forEach((btn) => btn.addEventListener("click", closeAllPopovers));

  // --- click on checklist checkbox or an existing linked flashcard mark ---
  editorBody.addEventListener("click", (e) => {
    // No modo borracha o apagar já acontece no mousedown/arrastar (acima);
    // aqui só evita que o clique mexa em checklist/flashcard sem querer.
    if (eraserMode) {
      e.preventDefault();
      return;
    }
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

// Aplica cor de destaque com o comando nativo do navegador (hiliteColor) em
// vez de clonar o conteúdo selecionado na mão — isso é o que faz funcionar
// direito quando a seleção cobre um parágrafo inteiro (ou várias linhas,
// listas etc.), casos em que mexer no DOM manualmente quebrava o destaque.
function applyHighlightColor(root, colorHex) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;
  document.execCommand("styleWithCSS", false, true);
  // Limpa qualquer cor de destaque que já exista dentro da seleção antes de
  // aplicar a nova — sem esse passo, um trecho que já tinha, por exemplo,
  // azul misturado com texto sem cor ficava incompleto/remendado ao tentar
  // pintar tudo de amarelo (o navegador não sobrescrevia direito o que já
  // tinha cor). Limpar primeiro e pintar depois resolve isso.
  document.execCommand("hiliteColor", false, "transparent");
  document.execCommand("hiliteColor", false, colorHex);
  return true;
}

// Um elemento "é destaque" se for um <mark> (exceto os ligados a flashcard)
// ou um <span>/<font> com cor de fundo — o que o hiliteColor nativo cria.
function isHighlightNode(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.tagName === "MARK") return !node.classList.contains("linked-fc");
  if (node.tagName === "SPAN" || node.tagName === "FONT") {
    return !!(node.style && node.style.backgroundColor && node.style.backgroundColor !== "transparent");
  }
  return false;
}

// Acha o destaque mais próximo de um nó, subindo pelos pais até `root` — mas
// devolve o ancestral MAIS EXTERNO que ainda é destaque. Isso importa porque
// o navegador às vezes cria destaques aninhados (um span de cor dentro de
// outro), e apagar só o de dentro deixava resto de cor pra trás.
function closestHighlightEl(root, node) {
  if (node && node.nodeType === 3) node = node.parentElement;
  let found = null;
  while (node && node !== root) {
    if (isHighlightNode(node)) found = node;
    node = node.parentElement;
  }
  return found;
}

// A partir de um elemento de destaque, expande pros vizinhos diretos que
// também são destaque (sem texto normal entre eles) — o navegador costuma
// dividir um trecho grifado em vários <span> pequenos, um por palavra ou
// nó original, então apagar só o de baixo do mouse apagava só um pedaço.
function expandHighlightRun(el) {
  let start = el;
  while (start.previousSibling && isHighlightNode(start.previousSibling)) start = start.previousSibling;
  let end = el;
  while (end.nextSibling && isHighlightNode(end.nextSibling)) end = end.nextSibling;
  return { start, end };
}

// Usa document.execCommand("insertHTML", ...) em vez de mexer no DOM na mão
// (range.surroundContents/insertNode) porque só o que passa pelo execCommand
// entra no histórico nativo de desfazer/refazer (Ctrl+Z) do navegador.
// Usado só para o link de flashcard (mark.linked-fc), que precisa de um
// elemento estável pra identificar depois — as cores de destaque agora usam
// applyHighlightColor() acima.
function wrapSelection(root, cls) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const temp = document.createElement("div");
  temp.appendChild(range.cloneContents());
  const inner = temp.innerHTML;
  const uid = `wrap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const clsAttr = cls ? ` class="${cls}"` : "";
  document.execCommand("insertHTML", false, `<mark${clsAttr} data-wrap-tmp="${uid}">${inner}</mark>`);
  const mark = root.querySelector(`[data-wrap-tmp="${uid}"]`);
  if (mark) mark.removeAttribute("data-wrap-tmp");
  sel.removeAllRanges();
  return mark;
}

// Remove o <mark> mais próximo do cursor/seleção (desfaz um destaque),
// preservando o texto. Não mexe em marks ligados a flashcard (mark.linked-fc).
// Também via execCommand("insertHTML") para participar do desfazer/refazer.
function unwrapHighlight(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    showToast("Clique dentro de um destaque para apagar.", "alertCircle");
    return false;
  }
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentElement;
  const linkedMark = node && node.closest ? node.closest("mark.linked-fc") : null;
  if (linkedMark && root.contains(linkedMark)) {
    showToast("Esse trecho está ligado a um flashcard — apague o flashcard para desfazer.", "alertCircle");
    return false;
  }
  const markEl = closestHighlightEl(root, node);
  if (!markEl) {
    showToast("Clique dentro de um destaque para apagar.", "alertCircle");
    return false;
  }
  const range = document.createRange();
  if (markEl.tagName === "MARK") {
    range.selectNode(markEl);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("insertHTML", false, markEl.innerHTML);
  } else {
    const { start, end } = expandHighlightRun(markEl);
    range.setStartBefore(start);
    range.setEndAfter(end);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("hiliteColor", false, "transparent");
  }
  sel.removeAllRanges();
  return true;
}

function setupSelectionToolbar(editorBody, summary) {
  let bar = document.getElementById("selection-toolbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "selection-toolbar";
    bar.className = "selection-toolbar";
    bar.innerHTML = `
      ${FONT_COLORS.map((c) => `<button data-fc="${c.hex}" class="fc-swatch" style="color:${c.hex}" title="Cor do texto: ${c.label}">A</button>`).join("")}
      ${HIGHLIGHT_COLORS.map((c) => `<button class="hl-swatch ${c.cls}" data-hl="${c.hex}" title="${c.label}"></button>`).join("")}
      <button data-hl="${HIGHLIGHT_COLORS[0].hex}" title="Destacar">${Icon("highlighter", { size: 13 })}</button>
      <button id="sel-erase" title="Apagar destaque">${Icon("eraser", { size: 13 })}</button>
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

  const selFcBtns = bar.querySelectorAll("[data-fc]");
  const selHlBtns = bar.querySelectorAll("[data-hl]");
  const selEraseBtn = bar.querySelector("#sel-erase");
  const selFlashcardBtn = bar.querySelector("#sel-flashcard");
  selFcBtns.forEach((b) => (b.onmousedown = (e) => e.preventDefault()));
  selHlBtns.forEach((b) => (b.onmousedown = (e) => e.preventDefault()));
  selEraseBtn.onmousedown = (e) => e.preventDefault();
  selFlashcardBtn.onmousedown = (e) => e.preventDefault();

  selFcBtns.forEach((b) => {
    b.onclick = () => {
      document.execCommand("foreColor", false, b.dataset.fc);
      editorBody.dispatchEvent(new Event("input"));
      hide();
    };
  });

  selHlBtns.forEach((b) => {
    b.onclick = () => {
      applyHighlightColor(editorBody, b.dataset.hl);
      editorBody.dispatchEvent(new Event("input"));
      hide();
    };
  });

  selEraseBtn.onclick = () => {
    if (unwrapHighlight(editorBody)) editorBody.dispatchEvent(new Event("input"));
    hide();
  };

  selFlashcardBtn.onclick = () => {
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
    <div class="ai-source-note">${Icon("lightbulb", { size: 14 })}<span>Sugestão gerada por IA a partir do texto selecionado. Revise antes de salvar.</span></div>
    <div class="field">
      <label>Frente (pergunta)</label>
      <textarea id="f-front" disabled placeholder="Gerando sugestão com IA..."></textarea>
    </div>
    <div class="field">
      <label>Verso (resposta)</label>
      <textarea id="f-back" disabled placeholder="Gerando sugestão com IA..."></textarea>
    </div>
    <div class="field">
      <label>Dica (assunto / baralho)</label>
      <input type="text" id="f-hint" value="${escapeAttr(deckName)}" />
      <div class="field-hint">Vai aparecer como dica no flashcard, herdada automaticamente da pasta do resumo.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="confirm" disabled>Salvar e sincronizar</button>
    </div>`,
    {
      onMount: async (modal) => {
        const frontEl = modal.querySelector("#f-front");
        const backEl = modal.querySelector("#f-back");
        const confirmBtn = modal.querySelector("#confirm");

        modal.querySelector("#cancel").addEventListener("click", () => {
          unwrapPending();
          closeModal();
        });

        try {
          const suggestion = await suggestFlashcardFromSelection(selectedText);
          frontEl.value = suggestion.front;
          backEl.value = suggestion.back;
        } catch (err) {
          showToast(err.message, "alertCircle");
          backEl.value = selectedText;
        } finally {
          frontEl.disabled = false;
          backEl.disabled = false;
          confirmBtn.disabled = false;
        }

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
    <div class="ai-source-note">${Icon("lightbulb", { size: 14 })}<span>A IA usa o texto colado para gerar o resumo.</span></div>
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
        modal.querySelector("#confirm").addEventListener("click", async () => {
          const text = modal.querySelector("#f-source").value.trim();
          if (!text) {
            showToast("Cole um texto para gerar o resumo.", "alertCircle");
            return;
          }
          const confirmBtn = modal.querySelector("#confirm");
          confirmBtn.disabled = true;
          confirmBtn.textContent = "Gerando...";
          try {
            const html = await generateSummaryFromText(text);
            const isEmpty = stripHtml(editorBody.innerHTML).length === 0;
            editorBody.innerHTML = isEmpty ? html : editorBody.innerHTML + "<hr/>" + html;
            store.updateSummary(summaryId, { contentHtml: editorBody.innerHTML });
            closeModal();
            showToast("Resumo gerado com IA.", "sparkles");
          } catch (err) {
            showToast(err.message, "alertCircle");
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Gerar resumo";
          }
        });
      },
    }
  );
}

// Transforma o conteúdo do resumo em questões de múltipla escolha via IA e
// manda pra aba Questões, na mesma pasta do resumo. No Modo Medicina, deixa
// escolher entre caso clínico e conceitual.
function openGenerateQuestionsModal(summaryId, editorBody) {
  const summary = store.state.summaries.find((s) => s.id === summaryId);
  const isMedicina = (summary?.pageStyle || "minimal") === "medicina";
  // Clínico e conceitual podem ser marcados juntos (vira "misto"); dificuldade
  // é sempre uma escolha única entre as 4 opções (Misto aqui é uma 4ª opção,
  // não uma combinação de outras).
  const activeStyles = new Set(["conceitual"]);
  let difficulty = "medio";

  const DIFFICULTIES = [
    { id: "facil", label: "Fácil" },
    { id: "medio", label: "Médio" },
    { id: "dificil", label: "Difícil" },
    { id: "misto", label: "Misto" },
  ];

  const bodyHtml = `
    <h3>${Icon("helpCircle", { size: 16 })} Transformar em questões</h3>
    <p class="modal-sub">A IA gera questões de múltipla escolha a partir deste resumo e manda pra aba Questões.</p>
    ${
      isMedicina
        ? `<div class="field">
      <label>Tipo de questão (marque uma ou as duas)</label>
      <div class="btn-row">
        <button type="button" class="btn btn-sm btn-ghost" id="qstyle-clinico" data-qstyle="clinico">${Icon("pulse", { size: 13 })}<span>Caso clínico</span></button>
        <button type="button" class="btn btn-sm btn-primary" id="qstyle-conceitual" data-qstyle="conceitual">${Icon("lightbulb", { size: 13 })}<span>Conceitual</span></button>
      </div>
    </div>`
        : ""
    }
    <div class="field">
      <label>Nível de dificuldade</label>
      <div class="btn-row" id="qdifficulty-row">
        ${DIFFICULTIES.map((d) => `<button type="button" class="btn btn-sm ${d.id === difficulty ? "btn-primary" : "btn-ghost"}" data-qdifficulty="${d.id}">${d.label}</button>`).join("")}
      </div>
    </div>
    <div class="field">
      <label>Quantas questões?</label>
      <input type="number" id="q-count" min="1" max="10" value="3" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="confirm">${Icon("helpCircle", { size: 14 })}<span>Gerar questões</span></button>
    </div>`;

  openModal(bodyHtml, {
    onMount: (modal) => {
      if (isMedicina) activeStyles.add("clinico");
      modal.querySelector("#cancel").addEventListener("click", closeModal);
      if (isMedicina) {
        const clinicoBtn = modal.querySelector("#qstyle-clinico");
        const conceitualBtn = modal.querySelector("#qstyle-conceitual");
        clinicoBtn.classList.add("btn-primary");
        clinicoBtn.classList.remove("btn-ghost");
        const toggleStyle = (id, btn) => {
          if (activeStyles.has(id)) {
            if (activeStyles.size === 1) return; // sempre precisa de pelo menos um tipo marcado
            activeStyles.delete(id);
          } else {
            activeStyles.add(id);
          }
          btn.classList.toggle("btn-primary", activeStyles.has(id));
          btn.classList.toggle("btn-ghost", !activeStyles.has(id));
        };
        clinicoBtn.addEventListener("click", () => toggleStyle("clinico", clinicoBtn));
        conceitualBtn.addEventListener("click", () => toggleStyle("conceitual", conceitualBtn));
      }
      modal.querySelectorAll("[data-qdifficulty]").forEach((btn) => {
        btn.addEventListener("click", () => {
          difficulty = btn.dataset.qdifficulty;
          modal.querySelectorAll("[data-qdifficulty]").forEach((b) => {
            b.classList.toggle("btn-primary", b.dataset.qdifficulty === difficulty);
            b.classList.toggle("btn-ghost", b.dataset.qdifficulty !== difficulty);
          });
        });
      });
      modal.querySelector("#confirm").addEventListener("click", async () => {
        const text = stripHtml(editorBody.innerHTML).trim();
        if (!text) {
          showToast("Escreva ou gere o resumo antes de transformar em questões.", "alertCircle");
          return;
        }
        const count = Math.min(10, Math.max(1, parseInt(modal.querySelector("#q-count").value, 10) || 3));
        const style = activeStyles.size === 2 ? "misto" : [...activeStyles][0];
        const confirmBtn = modal.querySelector("#confirm");
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Gerando...";
        try {
          const questions = await generateQuestionsFromText(text, count, style, difficulty);
          questions.forEach((q) => {
            store.addQuestion({
              folderId: summary.folderId,
              statement: q.statement,
              alternatives: q.alternatives,
              correctId: q.correctId,
              difficulty: q.difficulty || (difficulty === "misto" ? "medio" : difficulty),
            });
          });
          closeModal();
          showToast(`${questions.length} ${questions.length === 1 ? "questão criada" : "questões criadas"}! Veja na aba Questões.`, "helpCircle");
          store.setRoute("questoes", { activeQuestionFolderId: summary.folderId || null });
        } catch (err) {
          showToast(err.message, "alertCircle");
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `${Icon("helpCircle", { size: 14 })}<span>Gerar questões</span>`;
        }
      });
    },
  });
}

function openPageStyleModal(summaryId, currentStyle) {
  openModal(
    `
    <h3>${Icon("layout", { size: 16 })} Modelo de página</h3>
    <p class="modal-sub">Muda só a aparência do resumo, o conteúdo continua o mesmo.</p>
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

function openFontModal(summaryId, currentFont) {
  openModal(
    `
    <h3>${Icon("pencil", { size: 16 })} Fonte do resumo</h3>
    <p class="modal-sub">Clique no exemplo para aplicar. Muda só a tipografia, o conteúdo continua o mesmo.</p>
    <div class="font-option-list">
      ${FONT_STYLES.map(
        (f) => `
        <button class="font-option ${f.id === currentFont ? "selected" : ""}" data-font="${f.id}">
          <span class="font-option-sample font--${f.id}">${f.sample}</span>
          <span class="font-option-meta"><b>${f.label}</b><span>${f.fontName}</span></span>
        </button>`
      ).join("")}
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelectorAll("[data-font]").forEach((btn) => {
          btn.addEventListener("click", () => {
            applyFontFamily(summaryId, btn.dataset.font);
            closeModal();
          });
        });
      },
    }
  );
}

function applyFontFamily(summaryId, fontId) {
  store.updateSummary(summaryId, { fontFamily: fontId });
  showToast(`Fonte "${FONT_STYLES.find((f) => f.id === fontId).label}" aplicada.`, "pencil");
}

function openLineSpacingModal(summaryId, current) {
  openModal(
    `
    <h3>${Icon("lineSpacing", { size: 16 })} Espaçamento entre linhas</h3>
    <div class="btn-row" style="flex-wrap:wrap;">
      ${LINE_SPACINGS.map((l) => `<button type="button" class="btn btn-sm ${l.id === current ? "btn-primary" : "btn-ghost"}" data-spacing="${l.id}">${l.label}</button>`).join("")}
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelectorAll("[data-spacing]").forEach((btn) => {
          btn.addEventListener("click", () => {
            applyLineSpacing(summaryId, btn.dataset.spacing);
            closeModal();
          });
        });
      },
    }
  );
}

function applyLineSpacing(summaryId, spacingId) {
  store.updateSummary(summaryId, { lineSpacing: spacingId });
  showToast(`Espaçamento "${LINE_SPACINGS.find((l) => l.id === spacingId).label}" aplicado.`, "lineSpacing");
}
