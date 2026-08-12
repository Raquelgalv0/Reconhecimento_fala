// Tela dedicada de Assuntos — navega pastas/cadernos por pastas/blocos em
// vez de listar tudo de uma vez na barra lateral (que não escala quando a
// pessoa tem dezenas de assuntos cadastrados).
import { store } from "../store.js";
import { showToast, openModal, closeModal } from "../ui-utils.js";
import { Icon } from "../icons.js";
import { MODES, MODE_TAG } from "../modes.js";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Estado de navegação da tela — não é dado do app, só "onde a pessoa está
// olhando agora". Fica fora do store de propósito (não precisa persistir
// nem sincronizar), no mesmo espírito do calRefDate em dashboard.js.
let currentParentId = null;
let searchQuery = "";

function ancestorChain(folderId) {
  const chain = [];
  let current = store.state.folders.find((f) => f.id === folderId);
  while (current) {
    chain.unshift(current);
    current = store.state.folders.find((f) => f.id === current.parentId);
  }
  return chain;
}

function folderCounts(folderId) {
  return {
    summaries: store.summariesInFolder(folderId).length,
    cards: store.cardsInFolder(folderId).length,
    questions: store.questionsInFolder(folderId).length,
    children: store.childFolders(folderId).length,
  };
}

export function renderAssuntos(container) {
  if (searchQuery.trim()) {
    renderSearch(container);
  } else {
    renderBrowser(container);
  }
}

function toolbarHtml() {
  return `
    <div class="main-header">
      <div>
        <h1>Assuntos</h1>
        <p class="sub">Organize suas pastas e cadernos — clique em um assunto pra ver o que tem dentro.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="btn-new-caderno">${Icon("notebook", { size: 14 })}<span>Novo caderno</span></button>
        <button class="btn btn-primary" id="btn-new-folder">${Icon("plus", { size: 14 })}<span>${currentParentId ? "Novo bloco" : "Nova pasta"}</span></button>
      </div>
    </div>
    <div class="field" style="max-width:360px;">
      <input type="text" id="assuntos-search" placeholder="Buscar assunto pelo nome..." value="${esc(searchQuery)}" />
    </div>`;
}

function wireToolbar(container) {
  container.querySelector("#btn-new-caderno").addEventListener("click", () => {
    const name = prompt("Nome do novo caderno:");
    if (name && name.trim()) {
      store.addFolder(name.trim(), null, "caderno");
      showToast(`Caderno "${name.trim()}" criado.`, "notebook");
      renderAssuntos(container);
    }
  });
  container.querySelector("#btn-new-folder").addEventListener("click", () => {
    const name = prompt(currentParentId ? "Nome do bloco:" : "Nome da nova pasta:");
    if (name && name.trim()) {
      store.addFolder(name.trim(), currentParentId);
      showToast(`"${name.trim()}" criado.`, "folder");
      renderAssuntos(container);
    }
  });
  const searchInput = container.querySelector("#assuntos-search");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderAssuntos(container);
    // devolve o foco pro campo de busca depois do re-render, senão a
    // pessoa perde o cursor a cada letra digitada.
    const again = container.querySelector("#assuntos-search");
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  });
}

function folderCardHtml(f) {
  const counts = folderCounts(f.id);
  const badges = [
    counts.children ? `${counts.children} bloco${counts.children === 1 ? "" : "s"}` : null,
    counts.summaries ? `${counts.summaries} resumo${counts.summaries === 1 ? "" : "s"}` : null,
    counts.cards ? `${counts.cards} flashcard${counts.cards === 1 ? "" : "s"}` : null,
    counts.questions ? `${counts.questions} ${counts.questions === 1 ? "questão" : "questões"}` : null,
  ].filter(Boolean);
  return `
    <div class="assunto-card" data-open-folder="${f.id}">
      <div class="assunto-card-top">
        ${Icon(f.kind === "caderno" ? "notebook" : "folder", { size: 20, cls: "assunto-card-icon" })}
        ${!f.parentId && f.mode ? `<span class="folder-mode-tag light">${MODE_TAG[f.mode] || f.mode}</span>` : ""}
      </div>
      <h4>${esc(f.name)}</h4>
      <div class="assunto-card-meta">${badges.length ? esc(badges.join(" · ")) : "Vazio"}</div>
      <div class="assunto-card-actions">
        <button class="icon-btn" data-add-sub="${f.id}" title="Novo bloco dentro">${Icon("plus", { size: 12 })}</button>
        ${!f.parentId ? `<button class="icon-btn" data-move-folder="${f.id}" title="Migrar para outra Ala">${Icon("map", { size: 12 })}</button>` : ""}
        <button class="icon-btn icon-btn-danger" data-delete-folder="${f.id}" title="Apagar">${Icon("trash", { size: 12 })}</button>
      </div>
    </div>`;
}

function renderBrowser(container) {
  const children = store.childFolders(currentParentId);
  const chain = currentParentId ? ancestorChain(currentParentId) : [];
  const current = currentParentId ? store.state.folders.find((f) => f.id === currentParentId) : null;

  container.innerHTML = `
    ${toolbarHtml()}
    <div class="assuntos-breadcrumb">
      <button class="crumb ${!currentParentId ? "active" : ""}" data-crumb="">Todos os assuntos</button>
      ${chain.map((f) => `<span class="crumb-sep">/</span><button class="crumb ${f.id === currentParentId ? "active" : ""}" data-crumb="${f.id}">${esc(f.name)}</button>`).join("")}
    </div>
    ${current ? currentDetailHtml(current) : ""}
    <div class="assuntos-grid">
      ${children.map(folderCardHtml).join("")}
    </div>
    ${
      children.length === 0
        ? `<div class="empty-state"><div class="big">${Icon("folder", { size: 30 })}</div>${current ? "Nenhum bloco aqui ainda." : "Nenhum assunto ainda — crie uma pasta ou caderno pra começar."}</div>`
        : ""
    }
  `;

  wireToolbar(container);
  wireCommon(container);

  container.querySelectorAll("[data-crumb]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentParentId = btn.dataset.crumb || null;
      renderAssuntos(container);
    });
  });
}

function currentDetailHtml(folder) {
  const counts = folderCounts(folder.id);
  return `
    <div class="panel assunto-detail-panel">
      <div class="assunto-detail-head">
        <h3>${Icon(folder.kind === "caderno" ? "notebook" : "folder", { size: 16 })}<span>${esc(folder.name)}</span></h3>
        ${!folder.parentId && folder.mode ? `<span class="folder-mode-tag light">${MODE_TAG[folder.mode] || folder.mode}</span>` : ""}
      </div>
      <div class="assunto-shortcut-row">
        <button class="btn btn-sm btn-ghost" data-go-resumos="${folder.id}">${Icon("fileText", { size: 13 })}<span>Ver ${counts.summaries} resumo${counts.summaries === 1 ? "" : "s"}</span></button>
        <button class="btn btn-sm btn-ghost" data-go-flashcards="${folder.id}">${Icon("layers", { size: 13 })}<span>Ver ${counts.cards} flashcard${counts.cards === 1 ? "" : "s"}</span></button>
        <button class="btn btn-sm btn-ghost" data-go-questoes="${folder.id}">${Icon("helpCircle", { size: 13 })}<span>Ver ${counts.questions} ${counts.questions === 1 ? "questão" : "questões"}</span></button>
      </div>
    </div>`;
}

function renderSearch(container) {
  const query = searchQuery.trim().toLowerCase();
  const matches = store.flattenFolders().filter((f) => f.name.toLowerCase().includes(query));

  container.innerHTML = `
    ${toolbarHtml()}
    <div class="assuntos-grid">
      ${matches
        .map((f) => {
          const path = store.folderPath(f.id);
          return `
        <div class="assunto-card" data-open-search-result="${f.id}">
          <div class="assunto-card-top">${Icon(f.kind === "caderno" ? "notebook" : "folder", { size: 20, cls: "assunto-card-icon" })}</div>
          <h4>${esc(f.name)}</h4>
          <div class="assunto-card-meta" title="${esc(path)}">${esc(path)}</div>
        </div>`;
        })
        .join("")}
    </div>
    ${matches.length === 0 ? `<div class="empty-state"><div class="big">${Icon("helpCircle", { size: 30 })}</div>Nenhum assunto encontrado com esse nome.</div>` : ""}
  `;

  wireToolbar(container);
  container.querySelectorAll("[data-open-search-result]").forEach((card) => {
    card.addEventListener("click", () => {
      currentParentId = card.dataset.openSearchResult;
      searchQuery = "";
      renderAssuntos(container);
    });
  });
}

function confirmAndDeleteFolder(folderId) {
  const descendantIds = store.descendantFolderIds(folderId);
  const subCount = descendantIds.length - 1;
  const summaryCount = store.state.summaries.filter((s) => descendantIds.includes(s.folderId)).length;
  const cardCount = store.state.flashcards.filter((c) => descendantIds.includes(c.folderId)).length;
  const questionCount = store.state.questions.filter((q) => descendantIds.includes(q.folderId)).length;
  const parts = [];
  if (subCount > 0) parts.push(`${subCount} bloco${subCount === 1 ? "" : "s"}`);
  if (summaryCount > 0) parts.push(`${summaryCount} resumo${summaryCount === 1 ? "" : "s"}`);
  if (cardCount > 0) parts.push(`${cardCount} flashcard${cardCount === 1 ? "" : "s"}`);
  if (questionCount > 0) parts.push(`${questionCount} ${questionCount === 1 ? "questão" : "questões"}`);
  const warning = parts.length ? ` Junto vai tudo o que está dentro dela: ${parts.join(", ")}.` : "";
  if (!confirm(`Apagar "${store.folderPath(folderId)}"?${warning} Essa ação não pode ser desfeita.`)) return false;
  store.deleteFolder(folderId);
  showToast("Pasta apagada.", "trash");
  return true;
}

// Migra uma pasta de assunto (e tudo dentro dela) de uma Ala pra outra —
// ex.: uma pasta de Graduação virar uma pasta da Ala de Medicina. Só marca
// uma "etiqueta" de modo na pasta raiz; o conteúdo em si não muda de lugar.
function openMoveFolderModal(folderId) {
  const folder = store.state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  openModal(
    `
    <h3>${Icon("map", { size: 16 })} Migrar "${esc(folder.name)}" para outra Ala</h3>
    <p class="modal-sub">Move toda essa pasta (e tudo dentro dela) para outro modo de estudo.</p>
    <div class="btn-row" style="flex-wrap:wrap;">
      <button type="button" class="btn btn-sm ${!folder.mode ? "btn-primary" : "btn-ghost"}" data-mode="">Nenhuma Ala específica</button>
      ${MODES.map((m) => `<button type="button" class="btn btn-sm ${folder.mode === m.id ? "btn-primary" : "btn-ghost"}" data-mode="${m.id}">${Icon(m.icon, { size: 13 })}<span>${m.title}</span></button>`).join("")}
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelectorAll("[data-mode]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const mode = btn.dataset.mode || null;
            store.updateFolder(folderId, { mode });
            closeModal();
            showToast(mode ? `Pasta migrada para a Ala de ${MODE_TAG[mode]}.` : "Pasta sem Ala específica agora.", "map");
          });
        });
      },
    }
  );
}

// Wiring comum entre a grade normal e o painel de detalhe (não usado na busca).
function wireCommon(container) {
  container.querySelectorAll("[data-open-folder]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-add-sub], [data-move-folder], [data-delete-folder]")) return;
      currentParentId = card.dataset.openFolder;
      renderAssuntos(container);
    });
  });
  container.querySelectorAll("[data-add-sub]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = prompt("Nome do bloco:");
      if (name && name.trim()) store.addFolder(name.trim(), btn.dataset.addSub);
    });
  });
  container.querySelectorAll("[data-move-folder]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMoveFolderModal(btn.dataset.moveFolder);
    });
  });
  container.querySelectorAll("[data-delete-folder]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const folderId = btn.dataset.deleteFolder;
      const wasCurrent = folderId === currentParentId;
      if (confirmAndDeleteFolder(folderId)) {
        if (wasCurrent) currentParentId = store.state.folders.find((f) => f.id === folderId)?.parentId || null;
        renderAssuntos(container);
      }
    });
  });
  const detail = container.querySelector(".assunto-detail-panel");
  if (detail) {
    const goResumos = detail.querySelector("[data-go-resumos]");
    if (goResumos) goResumos.addEventListener("click", () => store.setRoute("resumos", { activeFolderId: goResumos.dataset.goResumos, activeSummaryId: null }));
    const goFlashcards = detail.querySelector("[data-go-flashcards]");
    if (goFlashcards) goFlashcards.addEventListener("click", () => store.setRoute("flashcards", { activeDeckId: goFlashcards.dataset.goFlashcards, reviewing: false }));
    const goQuestoes = detail.querySelector("[data-go-questoes]");
    if (goQuestoes) goQuestoes.addEventListener("click", () => store.setRoute("questoes", { activeQuestionFolderId: goQuestoes.dataset.goQuestoes, practicing: false }));
  }
}
