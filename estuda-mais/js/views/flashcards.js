import { store } from "../store.js";
import { showToast, openModal, closeModal, relativeDue, playFeedbackSound } from "../ui-utils.js";
import { scheduleNext, isDueToday } from "../srs.js";
import { Icon } from "../icons.js";

// Fila de revisão da sessão atual — guardada fora do ciclo de render para
// sobreviver aos re-renders disparados a cada resposta (Errei/Acertei).
let session = null;

export function renderFlashcards(container) {
  const { activeDeckId, reviewing } = store.state.ui;
  if (reviewing) return renderReview(container, activeDeckId);
  if (activeDeckId) return renderDeckDetail(container, activeDeckId);
  return renderDecksGrid(container);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ------------------------------------------------------------ DECKS GRID --
function renderDecksGrid(container) {
  const folders = store.flattenFolders();
  const totalDue = store.cardsDueToday().length;

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Flashcards</h1>
        <p class="sub">Baralhos organizados por assunto, sincronizados automaticamente com os resumos.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="btn-new-card">${Icon("plus", { size: 14 })}<span>Novo flashcard</span></button>
        <button class="btn btn-primary" id="btn-review-all" ${totalDue === 0 ? "disabled style='opacity:.5;cursor:default'" : ""}>
          ${Icon("flame", { size: 15 })}<span>Revisar hoje ${totalDue ? `(${totalDue})` : ""}</span>
        </button>
      </div>
    </div>
    <div class="deck-grid">
      ${folders
        .map((f) => {
          const cards = store.cardsInFolder(f.id);
          const due = store.cardsDueToday(f.id).length;
          return `
        <div class="deck-card" data-deck="${f.id}">
          <div class="deck-name">${"— ".repeat(f.depth)}${esc(f.name)}</div>
          <div class="deck-stats">
            <span>${cards.length} carta${cards.length === 1 ? "" : "s"}</span>
            ${due ? `<span class="due-pill">${due} p/ hoje</span>` : `<span class="due-ok">${Icon("checkPlain", { size: 12 })} em dia</span>`}
          </div>
        </div>`;
        })
        .join("")}
    </div>
    ${folders.length === 0 ? `<div class="empty-state"><div class="big">${Icon("folder", { size: 30 })}</div>Crie um assunto na barra lateral para começar.</div>` : ""}
  `;

  container.querySelectorAll("[data-deck]").forEach((el) => {
    el.addEventListener("click", () => store.setRoute("flashcards", { activeDeckId: el.dataset.deck }));
  });
  container.querySelector("#btn-new-card").addEventListener("click", () => openManualCardModal());
  const reviewBtn = container.querySelector("#btn-review-all");
  if (totalDue > 0) {
    reviewBtn.addEventListener("click", () => startReview(null));
  }
}

// ----------------------------------------------------------- DECK DETAIL --
function renderDeckDetail(container, deckId) {
  const folder = store.state.folders.find((f) => f.id === deckId);
  if (!folder) {
    store.setRoute("flashcards", { activeDeckId: null });
    return;
  }
  const cards = store.cardsInFolder(deckId).sort((a, b) => a.srs.dueDate.localeCompare(b.srs.dueDate));
  const due = store.cardsDueToday(deckId).length;

  container.innerHTML = `
    <div class="btn-row" style="justify-content:space-between; margin-bottom:8px;">
      <button class="btn btn-ghost btn-sm" id="back">← Todos os baralhos</button>
    </div>
    <div class="main-header">
      <div>
        <h1>${esc(store.folderPath(deckId))}</h1>
        <p class="sub">${cards.length} flashcard${cards.length === 1 ? "" : "s"} · ${due ? `${due} para revisar hoje` : "tudo em dia"}</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="btn-new-card">${Icon("plus", { size: 14 })}<span>Novo flashcard</span></button>
        <button class="btn btn-primary" id="btn-review-deck" ${due === 0 ? "disabled style='opacity:.5;cursor:default'" : ""}>${Icon("flame", { size: 15 })}<span>Revisar (${due})</span></button>
      </div>
    </div>
    <div class="flash-list">
      ${cards
        .map(
          (c) => `
        <div class="flash-row" data-card="${c.id}" draggable="true" title="Arraste pra um assunto na barra lateral pra mover">
          <span class="drag-handle">${Icon("menu", { size: 13 })}</span>
          <span class="front">${esc(c.front)}</span>
          <span class="due-tag ${isDueToday(c) ? "today" : ""}">${isDueToday(c) ? "revisar hoje" : `próx. rev. ${relativeDue(c.srs.dueDate)}`}</span>
          <button class="btn btn-sm btn-ghost" data-edit="${c.id}">${Icon("pencil", { size: 13 })}</button>
        </div>`
        )
        .join("")}
    </div>
    ${cards.length === 0 ? `<div class="empty-state"><div class="big">${Icon("layers", { size: 30 })}</div>Nenhum flashcard neste baralho ainda.</div>` : ""}
    ${cards.length > 0 ? `<div class="field-hint" style="margin-top:8px;">Dica: arraste um flashcard pra cima de um assunto na barra lateral pra mover ele de pasta.</div>` : ""}
  `;

  container.querySelector("#back").addEventListener("click", () => store.setRoute("flashcards", { activeDeckId: null }));
  container.querySelector("#btn-new-card").addEventListener("click", () => openManualCardModal(deckId));
  if (due > 0) container.querySelector("#btn-review-deck").addEventListener("click", () => startReview(deckId));
  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditCardModal(btn.dataset.edit);
    });
  });
  container.querySelectorAll(".flash-row[draggable]").forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/x-flashcard-id", row.dataset.card);
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
  });
}

// --------------------------------------------------------------- MODALS --
function folderOptionsHtml(selectedId) {
  return store
    .flattenFolders()
    .map((f) => `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${"— ".repeat(f.depth)}${esc(f.name)}</option>`)
    .join("");
}

function openManualCardModal(defaultFolderId) {
  const folders = store.flattenFolders();
  if (folders.length === 0) {
    showToast("Crie uma pasta/assunto na barra lateral primeiro.", "alertCircle");
    return;
  }
  const initialFolder = defaultFolderId || folders[0].id;
  openModal(
    `
    <h3>Novo flashcard</h3>
    <p class="modal-sub">Criação manual, estilo Anki: frente, verso e dica.</p>
    <div class="field">
      <label>Frente (pergunta)</label>
      <textarea id="f-front" placeholder="Ex.: O que é...?"></textarea>
    </div>
    <div class="field">
      <label>Verso (resposta)</label>
      <textarea id="f-back" placeholder="Resposta"></textarea>
    </div>
    <div class="field">
      <label>Baralho / assunto</label>
      <select id="f-folder">${folderOptionsHtml(initialFolder)}</select>
    </div>
    <div class="field">
      <label>Dica</label>
      <input type="text" id="f-hint" value="${esc(store.folderPath(initialFolder))}" />
      <div class="field-hint">Por padrão é o nome do baralho, mas pode personalizar.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="confirm">Criar flashcard</button>
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelector("#f-front").focus();
        const folderSelect = modal.querySelector("#f-folder");
        const hintInput = modal.querySelector("#f-hint");
        let hintTouched = false;
        hintInput.addEventListener("input", () => (hintTouched = true));
        folderSelect.addEventListener("change", () => {
          if (!hintTouched) hintInput.value = store.folderPath(folderSelect.value);
        });
        modal.querySelector("#cancel").addEventListener("click", closeModal);
        modal.querySelector("#confirm").addEventListener("click", () => {
          const front = modal.querySelector("#f-front").value.trim();
          const back = modal.querySelector("#f-back").value.trim();
          const hint = hintInput.value.trim();
          const folderId = folderSelect.value;
          if (!front || !back) {
            showToast("Preencha frente e verso.", "alertCircle");
            return;
          }
          store.addFlashcard({ folderId, front, back, hint });
          closeModal();
          showToast("Flashcard criado.");
        });
      },
    }
  );
}

function openEditCardModal(cardId) {
  const card = store.state.flashcards.find((c) => c.id === cardId);
  if (!card) return;
  openModal(
    `
    <h3>Editar flashcard</h3>
    <div class="field"><label>Frente</label><textarea id="f-front">${esc(card.front)}</textarea></div>
    <div class="field"><label>Verso</label><textarea id="f-back">${esc(card.back)}</textarea></div>
    <div class="field"><label>Pasta</label><select id="f-folder">${folderOptionsHtml(card.folderId)}</select></div>
    <div class="field"><label>Dica</label><input type="text" id="f-hint" value="${esc(card.hint || store.folderPath(card.folderId))}" /></div>
    <div class="modal-actions" style="justify-content:space-between;">
      <button class="btn btn-ghost" id="delete" style="color:var(--red)">${Icon("trash", { size: 14 })}<span>Excluir</span></button>
      <div class="btn-row">
        <button class="btn btn-ghost" id="cancel">Cancelar</button>
        <button class="btn btn-primary" id="confirm">Salvar</button>
      </div>
    </div>`,
    {
      onMount: (modal) => {
        modal.querySelector("#cancel").addEventListener("click", closeModal);
        modal.querySelector("#delete").addEventListener("click", () => {
          if (confirm("Excluir este flashcard?")) {
            store.deleteFlashcard(cardId);
            closeModal();
            showToast("Flashcard excluído.");
          }
        });
        modal.querySelector("#confirm").addEventListener("click", () => {
          store.updateFlashcard(cardId, {
            front: modal.querySelector("#f-front").value.trim(),
            back: modal.querySelector("#f-back").value.trim(),
            folderId: modal.querySelector("#f-folder").value,
            hint: modal.querySelector("#f-hint").value.trim(),
          });
          closeModal();
          showToast("Flashcard atualizado.");
        });
      },
    }
  );
}

// ------------------------------------------------------------- REVIEW ----
function startReview(deckId) {
  const due = store.cardsDueToday(deckId).map((c) => c.id);
  if (due.length === 0) {
    showToast("Nada para revisar por aqui agora.", "check");
    return;
  }
  session = { queue: due, index: 0 };
  store.setRoute("flashcards", { activeDeckId: deckId, reviewing: true });
}

function renderReview(container, deckId) {
  if (!session) {
    store.setRoute("flashcards", { reviewing: false });
    return;
  }
  const { queue, index } = session;

  if (index >= queue.length) {
    container.innerHTML = `
      <div class="empty-review">
        <div class="big">${Icon("check", { size: 40, strokeWidth: 1.5 })}</div>
        <h2>Sessão concluída!</h2>
        <p>Você revisou ${queue.length} flashcard${queue.length === 1 ? "" : "s"}. A fila de amanhã já está sendo montada.</p>
        <button class="btn btn-primary" id="finish" style="margin-top:14px;">Voltar aos baralhos</button>
      </div>`;
    container.querySelector("#finish").addEventListener("click", () => {
      session = null;
      store.setRoute("flashcards", { reviewing: false, activeDeckId: deckId });
    });
    return;
  }

  const card = store.state.flashcards.find((c) => c.id === queue[index]);
  if (!card) {
    session.index++;
    return renderReview(container, deckId);
  }
  const folderName = store.folderPath(card.folderId);

  container.innerHTML = `
    <div class="review-stage">
      <div class="review-progress">Revisão de hoje · ${index + 1} de ${queue.length}</div>
      <div class="flip-card">
        <div class="flip-card-inner" id="flip-inner">
          <div class="flip-face front">
            <div class="card-folder-label">${esc(folderName)}</div>
            <div class="kicker">Pergunta</div>
            <div class="content">${esc(card.front)}</div>
            <div class="flip-hint">clique no cartão para virar</div>
          </div>
          <div class="flip-face back">
            <div class="card-folder-label">${esc(folderName)}</div>
            <div class="kicker">Resposta</div>
            <div class="content">${esc(card.back)}</div>
          </div>
        </div>
      </div>
      <div class="review-actions" id="actions" style="visibility:hidden">
        <button class="btn-erro" id="btn-errei">${Icon("x", { size: 15 })}<span>Errei</span></button>
        <button class="btn-acerto" id="btn-acertei">${Icon("checkPlain", { size: 15 })}<span>Acertei</span></button>
      </div>
    </div>`;

  const inner = container.querySelector("#flip-inner");
  const actions = container.querySelector("#actions");
  inner.addEventListener("click", () => {
    inner.classList.toggle("flipped");
    actions.style.visibility = inner.classList.contains("flipped") ? "visible" : "hidden";
  });

  const grade = (result) => {
    playFeedbackSound(result === "acertou");
    scheduleNext(card, result);
    store.updateFlashcard(card.id, { srs: card.srs });
    store.logStudyDay({ correct: result === "acertou" });
    store.markFlashcardReviewedToday();
    session.index++;
  };
  container.querySelector("#btn-errei").addEventListener("click", (e) => {
    e.stopPropagation();
    grade("errou");
  });
  container.querySelector("#btn-acertei").addEventListener("click", (e) => {
    e.stopPropagation();
    grade("acertou");
  });
}
