import { store } from "../store.js";
import { showToast, openModal, closeModal } from "../ui-utils.js";
import { Icon } from "../icons.js";
import { suggestQuestionComment } from "../ai.js";

const DIFF_LABEL = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
const ALT_LETTERS = ["A", "B", "C", "D", "E"];

// Fila da sessão de prática atual — fora do ciclo de render para sobreviver
// aos re-renders disparados a cada resposta (mesmo padrão do flashcards.js).
let session = null;
let answeredThisRound = null;

export function renderQuestoes(container) {
  if (store.state.ui.practicing) return renderPractice(container);
  return renderList(container);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ------------------------------------------------------------- LIST -----
function renderList(container) {
  const activeQuestionFolderId = store.state.ui.activeQuestionFolderId || null;
  const questionFilter = store.state.ui.questionFilter || "all";
  const folders = store.flattenFolders();

  let questions = activeQuestionFolderId
    ? store.state.questions.filter((q) => store.descendantFolderIds(activeQuestionFolderId).includes(q.folderId))
    : store.state.questions;
  if (questionFilter === "favoritas") questions = questions.filter((q) => q.favorite);
  if (questionFilter === "erradas") {
    const wrongIds = new Set(store.wrongQuestions().map((q) => q.id));
    questions = questions.filter((q) => wrongIds.has(q.id));
  }

  const folderChips = [`<button class="btn btn-sm ${!activeQuestionFolderId ? "btn-primary" : "btn-ghost"}" data-folder="">Todos os assuntos</button>`]
    .concat(
      folders.map(
        (f) =>
          `<button class="btn btn-sm ${activeQuestionFolderId === f.id ? "btn-primary" : "btn-ghost"}" data-folder="${f.id}">${"— ".repeat(f.depth)}${esc(f.name)}</button>`
      )
    )
    .join("");

  const filterChips = [
    { id: "all", label: "Todas" },
    { id: "favoritas", label: "Favoritas" },
    { id: "erradas", label: "Erradas" },
  ]
    .map((f) => `<button class="btn btn-sm ${questionFilter === f.id ? "btn-primary" : "btn-ghost"}" data-qfilter="${f.id}">${f.label}</button>`)
    .join("");

  const topicStats = store.topicQuestionStats();
  const mostAsked = [...topicStats].sort((a, b) => b.totalQuestions - a.totalQuestions).slice(0, 4);
  const mostError = [...topicStats].filter((s) => s.totalAttempts > 0).sort((a, b) => b.errorRate - a.errorRate).slice(0, 4);
  const confusion = store.confusionRanking(4);

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Banco de Questões</h1>
        <p class="sub">Cadastre, pratique e acompanhe onde você mais erra — por assunto, banca e dificuldade.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="btn-new-question">${Icon("plus", { size: 14 })}<span>Nova questão</span></button>
        <button class="btn btn-primary" id="btn-practice" ${questions.length === 0 ? "disabled style='opacity:.5;cursor:default'" : ""}>${Icon("target", { size: 15 })}<span>Praticar (${questions.length})</span></button>
      </div>
    </div>

    ${
      topicStats.length > 0
        ? `<div class="stat-grid stat-grid--3">
      <div class="panel">
        <h3>${Icon("barChart", { size: 15 })}<span>Mais cobrados</span></h3>
        <div class="priority-list">
          ${mostAsked
            .map((s) => `<div class="priority-item"><div class="num">${Icon("folder", { size: 12 })}</div><div class="txt"><b>${esc(s.name)}</b><span>${s.totalQuestions} questão${s.totalQuestions === 1 ? "" : "ões"}</span></div></div>`)
            .join("") || `<p class="muted-note">Sem dados ainda.</p>`}
        </div>
      </div>
      <div class="panel">
        <h3>${Icon("alertCircle", { size: 15 })}<span>Maior taxa de erro</span></h3>
        <div class="priority-list">
          ${mostError
            .map((s) => `<div class="priority-item"><div class="num">${Icon("folder", { size: 12 })}</div><div class="txt"><b>${esc(s.name)}</b><span>${Math.round(s.errorRate * 100)}% de erro em ${s.totalAttempts} tentativa${s.totalAttempts === 1 ? "" : "s"}</span></div></div>`)
            .join("") || `<p class="muted-note">Pratique para gerar estatísticas.</p>`}
        </div>
      </div>
      <div class="panel">
        <h3>${Icon("helpCircle", { size: 15 })}<span>Alternativas confundidas</span></h3>
        <div class="priority-list">
          ${confusion
            .map((c) => `<div class="priority-item"><div class="num">${c.mostChosenId}</div><div class="txt"><b>${esc(c.statement).slice(0, 60)}${c.statement.length > 60 ? "…" : ""}</b><span>Marcada errada ${c.count}x: "${esc(c.altText).slice(0, 50)}"</span></div></div>`)
            .join("") || `<p class="muted-note">Nenhuma confusão registrada ainda.</p>`}
        </div>
      </div>
    </div>`
        : ""
    }

    <div class="btn-row" style="flex-wrap:wrap; margin-bottom:8px;">${folderChips}</div>
    <div class="btn-row" style="flex-wrap:wrap; margin-bottom:18px;">${filterChips}</div>

    <div class="question-list">
      ${questions
        .map((q) => {
          const last = store.lastAttemptForQuestion(q.id);
          const statusTag = last
            ? last.correct
              ? `<span class="q-status ok">${Icon("checkPlain", { size: 11 })} acertou</span>`
              : `<span class="q-status bad">${Icon("x", { size: 11 })} errou</span>`
            : `<span class="q-status">não respondida</span>`;
          return `
        <div class="question-card" data-open="${q.id}">
          <button class="q-star ${q.favorite ? "active" : ""}" data-fav="${q.id}" title="Favoritar">${Icon("star", { size: 15 })}</button>
          <div class="q-body">
            <p class="q-statement">${esc(q.statement)}</p>
            <div class="q-meta">
              ${q.institution ? `<span class="q-tag">${esc(q.institution)}</span>` : ""}
              ${q.year ? `<span class="q-tag">${q.year}</span>` : ""}
              <span class="q-tag diff-${q.difficulty}">${DIFF_LABEL[q.difficulty]}</span>
              <span class="q-tag">${esc(store.folderPath(q.folderId))}</span>
              ${statusTag}
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" data-edit="${q.id}">${Icon("pencil", { size: 13 })}</button>
        </div>`;
        })
        .join("")}
    </div>
    ${questions.length === 0 ? `<div class="empty-state"><div class="big">${Icon("helpCircle", { size: 30 })}</div>Nenhuma questão aqui ainda.</div>` : ""}
  `;

  container.querySelectorAll("[data-folder]").forEach((btn) => {
    btn.addEventListener("click", () => store.setRoute("questoes", { activeQuestionFolderId: btn.dataset.folder || null }));
  });
  container.querySelectorAll("[data-qfilter]").forEach((btn) => {
    btn.addEventListener("click", () => store.setRoute("questoes", { questionFilter: btn.dataset.qfilter }));
  });
  container.querySelector("#btn-new-question").addEventListener("click", () => openQuestionModal());
  const practiceBtn = container.querySelector("#btn-practice");
  if (questions.length > 0) practiceBtn.addEventListener("click", () => startPractice(questions.map((q) => q.id)));

  container.querySelectorAll("[data-fav]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      store.toggleFavoriteQuestion(btn.dataset.fav);
    });
  });
  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openQuestionModal(btn.dataset.edit);
    });
  });
  container.querySelectorAll("[data-open]").forEach((card) => {
    card.addEventListener("click", () => openQuestionModal(card.dataset.open));
  });
}

// ------------------------------------------------------------- MODAL ----
function folderOptionsHtml(selectedId) {
  return store
    .flattenFolders()
    .map((f) => `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${"— ".repeat(f.depth)}${esc(f.name)}</option>`)
    .join("");
}

function openQuestionModal(questionId) {
  const editing = questionId ? store.state.questions.find((q) => q.id === questionId) : null;
  const folders = store.flattenFolders();
  if (folders.length === 0) {
    showToast("Crie uma pasta/assunto na barra lateral primeiro.", "alertCircle");
    return;
  }
  const initialAlts = editing ? editing.alternatives : [{ id: "A", text: "" }, { id: "B", text: "" }];

  openModal(
    `
    <h3>${editing ? "Editar questão" : "Nova questão"}</h3>
    <p class="modal-sub">Organize por assunto, banca, ano e dificuldade — igual ao seu caderno de questões.</p>
    <div class="field">
      <label>Enunciado</label>
      <textarea id="q-statement" style="min-height:80px">${editing ? esc(editing.statement) : ""}</textarea>
    </div>
    <div id="q-alts"></div>
    <button class="btn btn-ghost btn-sm" id="q-add-alt" type="button" style="margin-bottom:14px;">${Icon("plus", { size: 12 })}<span>Adicionar alternativa</span></button>
    <div class="field">
      <label>Gabarito (alternativa correta)</label>
      <select id="q-correct"></select>
    </div>
    <div class="field-row">
      <div class="field"><label>Assunto</label><select id="q-folder">${folderOptionsHtml(editing ? editing.folderId : folders[0].id)}</select></div>
      <div class="field"><label>Banca</label><input type="text" id="q-institution" placeholder="Ex.: CESPE" value="${editing ? esc(editing.institution) : ""}" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Ano</label><input type="text" inputmode="numeric" id="q-year" placeholder="2024" value="${editing && editing.year ? editing.year : ""}" /></div>
      <div class="field">
        <label>Dificuldade</label>
        <select id="q-difficulty">
          <option value="facil" ${editing?.difficulty === "facil" ? "selected" : ""}>Fácil</option>
          <option value="medio" ${!editing || editing?.difficulty === "medio" ? "selected" : ""}>Médio</option>
          <option value="dificil" ${editing?.difficulty === "dificil" ? "selected" : ""}>Difícil</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>Comentário (opcional)</label>
      <textarea id="q-comment" placeholder="Explicação da resposta...">${editing && editing.comment ? esc(editing.comment) : ""}</textarea>
      <button class="btn btn-ghost btn-sm" id="q-ai-comment" type="button" style="margin-top:6px;">${Icon("sparkles", { size: 12 })}<span>Sugerir comentário com IA</span></button>
    </div>
    <div class="modal-actions" style="justify-content:space-between;">
      ${editing ? `<button class="btn btn-ghost" id="q-delete" style="color:var(--red)">${Icon("trash", { size: 13 })}<span>Excluir</span></button>` : "<div></div>"}
      <div class="btn-row">
        <button class="btn btn-ghost" id="cancel">Cancelar</button>
        <button class="btn btn-primary" id="confirm">${editing ? "Salvar" : "Criar questão"}</button>
      </div>
    </div>`,
    {
      onMount: (modal) => {
        let alts = initialAlts.map((a) => ({ ...a }));

        function renderAlts() {
          const altsEl = modal.querySelector("#q-alts");
          altsEl.innerHTML = alts
            .map(
              (a, i) => `
            <div class="field alt-row">
              <label>Alternativa ${a.id}</label>
              <div class="btn-row">
                <input type="text" class="alt-input" data-idx="${i}" value="${esc(a.text)}" placeholder="Texto da alternativa ${a.id}" />
                ${alts.length > 2 ? `<button class="btn btn-sm btn-ghost" data-remove-alt="${i}" type="button">${Icon("trash", { size: 12 })}</button>` : ""}
              </div>
            </div>`
            )
            .join("");
          altsEl.querySelectorAll(".alt-input").forEach((input) => {
            input.addEventListener("input", (e) => {
              alts[Number(e.target.dataset.idx)].text = e.target.value;
            });
          });
          altsEl.querySelectorAll("[data-remove-alt]").forEach((btn) => {
            btn.addEventListener("click", () => {
              alts.splice(Number(btn.dataset.removeAlt), 1);
              alts = alts.map((a, i) => ({ ...a, id: ALT_LETTERS[i] }));
              renderAlts();
              renderCorrectOptions();
            });
          });
          modal.querySelector("#q-add-alt").style.display = alts.length >= 5 ? "none" : "";
        }

        function renderCorrectOptions() {
          const sel = modal.querySelector("#q-correct");
          const prevValue = sel.value;
          sel.innerHTML = alts.map((a) => `<option value="${a.id}">${a.id}) ${esc(a.text).slice(0, 40) || "(vazio)"}</option>`).join("");
          const wanted = editing && alts.some((a) => a.id === editing.correctId) ? editing.correctId : prevValue;
          if (alts.some((a) => a.id === wanted)) sel.value = wanted;
        }

        renderAlts();
        renderCorrectOptions();

        modal.querySelector("#q-add-alt").addEventListener("click", () => {
          if (alts.length >= 5) return;
          alts.push({ id: ALT_LETTERS[alts.length], text: "" });
          renderAlts();
          renderCorrectOptions();
        });

        modal.querySelector("#q-ai-comment").addEventListener("click", () => {
          const correctId = modal.querySelector("#q-correct").value;
          const correctText = alts.find((a) => a.id === correctId)?.text || "";
          modal.querySelector("#q-comment").value = suggestQuestionComment(modal.querySelector("#q-statement").value, correctText);
        });

        modal.querySelector("#cancel").addEventListener("click", closeModal);
        if (editing) {
          modal.querySelector("#q-delete").addEventListener("click", () => {
            if (confirm("Excluir esta questão e seu histórico de tentativas?")) {
              store.deleteQuestion(questionId);
              closeModal();
              showToast("Questão excluída.");
            }
          });
        }
        modal.querySelector("#confirm").addEventListener("click", () => {
          // sincroniza o último valor digitado antes de ler
          modal.querySelectorAll(".alt-input").forEach((input) => (alts[Number(input.dataset.idx)].text = input.value));
          const statement = modal.querySelector("#q-statement").value.trim();
          const folderId = modal.querySelector("#q-folder").value;
          const institution = modal.querySelector("#q-institution").value.trim();
          const year = Number(modal.querySelector("#q-year").value) || null;
          const difficulty = modal.querySelector("#q-difficulty").value;
          const comment = modal.querySelector("#q-comment").value.trim();
          const correctId = modal.querySelector("#q-correct").value;

          if (!statement || alts.some((a) => !a.text.trim())) {
            showToast("Preencha o enunciado e todas as alternativas.", "alertCircle");
            return;
          }
          const data = { statement, alternatives: alts, correctId, folderId, institution, year, difficulty, comment: comment || null };
          if (editing) {
            store.updateQuestion(questionId, data);
            showToast("Questão atualizada.");
          } else {
            store.addQuestion(data);
            showToast("Questão criada.");
          }
          closeModal();
        });
      },
    }
  );
}

// ---------------------------------------------------------- PRACTICE ---
function startPractice(ids) {
  if (ids.length === 0) {
    showToast("Nenhuma questão para praticar.", "alertCircle");
    return;
  }
  session = { queue: ids, index: 0 };
  answeredThisRound = null;
  store.setRoute("questoes", { practicing: true });
}

function renderPractice(container) {
  if (!session) {
    store.setRoute("questoes", { practicing: false });
    return;
  }
  const { queue, index } = session;

  if (index >= queue.length) {
    const results = queue.map((id) => store.lastAttemptForQuestion(id));
    const correctCount = results.filter((r) => r && r.correct).length;
    container.innerHTML = `
      <div class="empty-review">
        <div class="big">${Icon("target", { size: 40, strokeWidth: 1.5 })}</div>
        <h2>Sessão de questões concluída!</h2>
        <p>Você acertou ${correctCount} de ${queue.length} questões.</p>
        <button class="btn btn-primary" id="finish" style="margin-top:14px;">Voltar ao banco de questões</button>
      </div>`;
    container.querySelector("#finish").addEventListener("click", () => {
      session = null;
      store.setRoute("questoes", { practicing: false });
    });
    return;
  }

  const q = store.state.questions.find((x) => x.id === queue[index]);
  if (!q) {
    session.index++;
    return renderPractice(container);
  }

  const answered = answeredThisRound;

  container.innerHTML = `
    <div class="practice-stage">
      <div class="review-progress">Praticando · ${index + 1} de ${queue.length}</div>
      <div class="practice-card">
        <div class="q-meta" style="margin-bottom:14px;">
          ${q.institution ? `<span class="q-tag">${esc(q.institution)}</span>` : ""}
          ${q.year ? `<span class="q-tag">${q.year}</span>` : ""}
          <span class="q-tag diff-${q.difficulty}">${DIFF_LABEL[q.difficulty]}</span>
        </div>
        <p class="practice-statement">${esc(q.statement)}</p>
        <div class="practice-alts">
          ${q.alternatives
            .map((a) => {
              let cls = "";
              if (answered) {
                if (a.id === q.correctId) cls = "correct";
                else if (a.id === answered) cls = "wrong";
              }
              return `<button class="practice-alt ${cls}" data-alt="${a.id}" ${answered ? "disabled" : ""}>
                <span class="alt-letter">${a.id}</span><span>${esc(a.text)}</span>
              </button>`;
            })
            .join("")}
        </div>
        ${
          answered
            ? `<div class="practice-feedback ${answered === q.correctId ? "ok" : "bad"}">
                ${answered === q.correctId ? Icon("checkPlain", { size: 14 }) : Icon("x", { size: 14 })}
                <span>${answered === q.correctId ? "Você acertou!" : `Você errou — o gabarito é ${q.correctId}.`}</span>
              </div>`
            : ""
        }
        ${answered && q.comment ? `<div class="ai-source-note">${Icon("lightbulb", { size: 14 })}<span>${esc(q.comment)}</span></div>` : ""}
      </div>
      <div class="btn-row" style="justify-content:space-between; margin-top:16px;">
        <button class="btn btn-ghost" id="exit-practice">${Icon("x", { size: 13 })}<span>Sair</span></button>
        ${answered ? `<button class="btn btn-primary" id="next-question">${index + 1 < queue.length ? "Próxima questão" : "Ver resultado"}</button>` : ""}
      </div>
    </div>`;

  container.querySelector("#exit-practice").addEventListener("click", () => {
    session = null;
    answeredThisRound = null;
    store.setRoute("questoes", { practicing: false });
  });

  if (!answered) {
    container.querySelectorAll("[data-alt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        answeredThisRound = btn.dataset.alt;
        store.recordAttempt(q.id, btn.dataset.alt);
      });
    });
  } else {
    container.querySelector("#next-question").addEventListener("click", () => {
      answeredThisRound = null;
      session.index++;
      renderPractice(container);
    });
  }
}
