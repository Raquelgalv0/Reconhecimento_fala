import { store } from "./store.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderResumos } from "./views/resumos.js";
import { renderFlashcards } from "./views/flashcards.js";
import { renderQuestoes } from "./views/questoes.js";
import { renderDesempenho } from "./views/desempenho.js";
import { renderUpload } from "./views/upload.js";
import { renderRedacao } from "./views/redacao.js";
import { Icon } from "./icons.js";
import { openModal, closeModal, showToast } from "./ui-utils.js";

const MODES = [
  { id: "concurso", icon: "barChart", title: "Concurso público", desc: "Banco de questões, cadernos por assunto e revisão de erros." },
  { id: "vestibular", icon: "graduationCap", title: "Vestibular", desc: "Resumo por tópico, flashcards essenciais e metas de conteúdo." },
  { id: "graduacao", icon: "landmark", title: "Graduação", desc: "Organização por disciplina, datas de provas e revisão para retenção." },
];

const appRoot = document.getElementById("app");

function boot() {
  if (!store.state.onboarded) {
    renderOnboarding();
  } else {
    renderShell();
  }
}

const TIME_OPTIONS = [
  { value: 30, label: "30 min/dia" },
  { value: 60, label: "1h/dia" },
  { value: 120, label: "2h/dia" },
  { value: 180, label: "3h+/dia" },
];

function renderOnboarding() {
  const selectedModes = new Set();
  let step = 1;

  function render() {
    if (step === 1) renderStep1();
    else renderStep2();
  }

  function renderStep1() {
    appRoot.innerHTML = `
      <div class="onboarding-overlay">
        <div class="onboarding-card">
          <div class="onboarding-step">Etapa 1 de 2</div>
          <h1>Bem-vinda ao Estuda+</h1>
          <p>Escolha um ou mais objetivos. O app ajusta prioridades e relatórios para o seu caso — sem precisar de apps diferentes.</p>
          <div id="mode-list"></div>
          <button class="btn btn-primary" id="continue" style="width:100%; justify-content:center; margin-top:6px; opacity:${selectedModes.size ? "1" : ".5"};" ${selectedModes.size ? "" : "disabled"}>Continuar</button>
        </div>
      </div>`;

    const list = appRoot.querySelector("#mode-list");
    const continueBtn = appRoot.querySelector("#continue");

    MODES.forEach((m) => {
      const card = document.createElement("div");
      card.className = `checkbox-card${selectedModes.has(m.id) ? " selected" : ""}`;
      card.innerHTML = `<span class="mode-icon">${Icon(m.icon, { size: 19 })}</span><div><b>${m.title}</b><span>${m.desc}</span></div>`;
      card.addEventListener("click", () => {
        if (selectedModes.has(m.id)) selectedModes.delete(m.id);
        else selectedModes.add(m.id);
        card.classList.toggle("selected");
        continueBtn.disabled = selectedModes.size === 0;
        continueBtn.style.opacity = selectedModes.size === 0 ? ".5" : "1";
      });
      list.appendChild(card);
    });

    continueBtn.addEventListener("click", () => {
      if (selectedModes.size === 0) return;
      step = 2;
      render();
    });
  }

  function renderStep2() {
    appRoot.innerHTML = `
      <div class="onboarding-overlay">
        <div class="onboarding-card">
          <div class="onboarding-step">Etapa 2 de 2</div>
          <h1>Conte um pouco sobre você</h1>
          <p>Isso ajuda a personalizar seu painel e suas metas — pode pular e preencher depois.</p>
          <div class="field">
            <label>Nome</label>
            <input type="text" id="ob-name" placeholder="Como podemos te chamar?" />
          </div>
          <div class="field-row">
            <div class="field"><label>Área de estudo</label><input type="text" id="ob-area" placeholder="Ex.: Medicina, Direito..." /></div>
            <div class="field">
              <label>Nível de conhecimento</label>
              <select id="ob-level">
                <option value="iniciante">Iniciante</option>
                <option value="intermediario" selected>Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Tempo disponível por dia</label>
            <div class="btn-row" id="ob-time-options">
              ${TIME_OPTIONS.map((t, i) => `<button type="button" class="btn btn-sm ${i === 1 ? "btn-primary" : "btn-ghost"}" data-time="${t.value}">${t.label}</button>`).join("")}
            </div>
          </div>
          <div class="field">
            <label>Matérias (separe por vírgula)</label>
            <input type="text" id="ob-materias" placeholder="Ex.: Direito Constitucional, Farmacologia, Anatomia" />
            <div class="field-hint">Criamos uma pasta para cada uma automaticamente.</div>
          </div>
          <div class="btn-row" style="justify-content:space-between; margin-top:6px;">
            <button class="btn btn-ghost" id="back">← Voltar</button>
            <button class="btn btn-primary" id="finish">Concluir</button>
          </div>
        </div>
      </div>`;

    let dailyTimeMinutes = 60;
    appRoot.querySelectorAll("[data-time]").forEach((btn) => {
      btn.addEventListener("click", () => {
        dailyTimeMinutes = Number(btn.dataset.time);
        appRoot.querySelectorAll("[data-time]").forEach((b) => {
          b.classList.remove("btn-primary");
          b.classList.add("btn-ghost");
        });
        btn.classList.remove("btn-ghost");
        btn.classList.add("btn-primary");
      });
    });

    appRoot.querySelector("#back").addEventListener("click", () => {
      step = 1;
      render();
    });

    appRoot.querySelector("#finish").addEventListener("click", () => {
      const profile = {
        name: appRoot.querySelector("#ob-name").value.trim(),
        studyArea: appRoot.querySelector("#ob-area").value.trim(),
        level: appRoot.querySelector("#ob-level").value,
        dailyTimeMinutes,
      };
      const materias = appRoot.querySelector("#ob-materias").value.trim();
      store.completeOnboarding({ modes: [...selectedModes], profile, materias });
      if (dailyTimeMinutes) store.setDailyGoal(Math.max(3, Math.round(dailyTimeMinutes / 10)));
      renderShell();
    });
  }

  render();
}

function renderShell() {
  appRoot.innerHTML = `
    <div class="shell">
      <nav class="sidebar" id="sidebar"></nav>
      <main class="main" id="main"></main>
    </div>`;

  const sidebarEl = appRoot.querySelector("#sidebar");
  const mainEl = appRoot.querySelector("#main");

  const safeRender = () => {
    renderSidebar(sidebarEl);
    const active = document.activeElement;
    const typingInEditor = active && active.closest && active.closest("[data-focus-guard]");
    if (!typingInEditor) renderMain(mainEl);
  };

  store.subscribe(safeRender);
  safeRender();

  if (!window.__studyTimerStarted) {
    window.__studyTimerStarted = true;
    setInterval(() => {
      if (document.visibilityState === "visible") store.addStudyMinutes(1);
    }, 60000);
  }
}

function renderMain(mainEl) {
  const route = store.state.ui.route;
  if (route === "resumos") return renderResumos(mainEl);
  if (route === "flashcards") return renderFlashcards(mainEl);
  if (route === "questoes") return renderQuestoes(mainEl);
  if (route === "desempenho") return renderDesempenho(mainEl);
  if (route === "upload") return renderUpload(mainEl);
  if (route === "redacao") return renderRedacao(mainEl);
  return renderDashboard(mainEl);
}

const MODE_TAG = { concurso: "Concurso", vestibular: "Vestibular", graduacao: "Graduação" };

function renderSidebar(sidebarEl) {
  const { route } = store.state.ui;
  const dueToday = store.cardsDueToday().length;
  const folders = store.flattenFolders();

  sidebarEl.innerHTML = `
    <div class="brand"><span class="dot">●</span> Estuda+</div>
    <div class="mode-badges">${(store.state.modes || []).map((m) => `<span class="mode-badge">${MODE_TAG[m]}</span>`).join("")}</div>

    <div class="nav">
      <button class="nav-item ${route === "dashboard" ? "active" : ""}" data-nav="dashboard">${Icon("home")}<span>Painel</span></button>
      <button class="nav-item ${route === "resumos" ? "active" : ""}" data-nav="resumos">${Icon("fileText")}<span>Resumos</span></button>
      <button class="nav-item ${route === "flashcards" ? "active" : ""}" data-nav="flashcards">${Icon("layers")}<span>Flashcards</span> ${dueToday ? `<span class="badge-count">${dueToday}</span>` : ""}</button>
      <button class="nav-item ${route === "questoes" ? "active" : ""}" data-nav="questoes">${Icon("helpCircle")}<span>Questões</span></button>
      <button class="nav-item ${route === "desempenho" ? "active" : ""}" data-nav="desempenho">${Icon("trendingUp")}<span>Desempenho</span></button>
      <button class="nav-item ${route === "upload" ? "active" : ""}" data-nav="upload">${Icon("upload")}<span>Upload de Materiais</span></button>
      <button class="nav-item ${route === "redacao" ? "active" : ""}" data-nav="redacao">${Icon("pencil")}<span>Redação ENEM</span></button>
    </div>

    <div class="sidebar-section-title">Assuntos <button class="icon-btn" id="add-root-folder" title="Nova pasta">${Icon("plus", { size: 13 })}</button></div>
    <div class="folder-tree" id="folder-tree">
      ${folders
        .map(
          (f) => `
        <div class="folder-row ${f.depth > 0 ? "sub" : ""}" data-folder="${f.id}">
          ${f.depth > 0 ? "" : Icon("folder", { size: 14 })}<span>${escapeHtml(f.name)}</span>
          <span class="count">${store.cardsInFolder(f.id).length ? store.cardsInFolder(f.id).length : ""}</span>
          <button class="icon-btn" data-add-sub="${f.id}" title="Nova subpasta">${Icon("plus", { size: 12 })}</button>
        </div>`
        )
        .join("")}
    </div>

    <div class="sidebar-footer">
      <button class="icon-btn" id="edit-profile-btn" title="Editar perfil">${Icon("pencil", { size: 12 })}</button>
      <span>${store.state.profile?.name ? `Olá, ${escapeHtml(store.state.profile.name)}` : "Resumos e flashcards sincronizados"} · revisão espaçada Acertei/Errei</span>
    </div>
  `;

  sidebarEl.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "resumos") store.setRoute("resumos", { activeSummaryId: null, activeFolderId: null });
      else if (target === "flashcards") store.setRoute("flashcards", { activeDeckId: null, reviewing: false });
      else if (target === "questoes") store.setRoute("questoes", { activeQuestionFolderId: null, questionFilter: "all", practicing: false });
      else if (target === "desempenho") store.setRoute("desempenho");
      else if (target === "upload") store.setRoute("upload");
      else if (target === "redacao") store.setRoute("redacao", { redacaoView: "list", activeEssayId: null });
      else store.setRoute("dashboard");
    });
  });

  sidebarEl.querySelectorAll("[data-folder]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-add-sub]")) return;
      const folderId = row.dataset.folder;
      if (store.state.ui.route === "flashcards") {
        store.setRoute("flashcards", { activeDeckId: folderId, reviewing: false });
      } else if (store.state.ui.route === "questoes") {
        store.setRoute("questoes", { activeQuestionFolderId: folderId, practicing: false });
      } else {
        store.setRoute("resumos", { activeFolderId: folderId, activeSummaryId: null });
      }
    });
  });

  sidebarEl.querySelector("#add-root-folder").addEventListener("click", () => {
    const name = prompt("Nome do novo assunto:");
    if (name && name.trim()) store.addFolder(name.trim(), null);
  });

  sidebarEl.querySelectorAll("[data-add-sub]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = prompt("Nome da subpasta:");
      if (name && name.trim()) store.addFolder(name.trim(), btn.dataset.addSub);
    });
  });

  sidebarEl.querySelector("#edit-profile-btn").addEventListener("click", openProfileModal);
}

function openProfileModal() {
  const p = store.state.profile || {};
  openModal(
    `
    <h3>${Icon("pencil", { size: 16 })} Editar perfil</h3>
    <p class="modal-sub">Essas informações personalizam seu painel e suas metas.</p>
    <div class="field">
      <label>Nome</label>
      <input type="text" id="pf-name" value="${escapeHtml(p.name || "")}" placeholder="Como podemos te chamar?" />
    </div>
    <div class="field-row">
      <div class="field"><label>Área de estudo</label><input type="text" id="pf-area" value="${escapeHtml(p.studyArea || "")}" placeholder="Ex.: Medicina, Direito..." /></div>
      <div class="field">
        <label>Nível de conhecimento</label>
        <select id="pf-level">
          <option value="iniciante" ${p.level === "iniciante" ? "selected" : ""}>Iniciante</option>
          <option value="intermediario" ${!p.level || p.level === "intermediario" ? "selected" : ""}>Intermediário</option>
          <option value="avancado" ${p.level === "avancado" ? "selected" : ""}>Avançado</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>Tempo disponível por dia</label>
      <div class="btn-row" id="pf-time-options">
        ${TIME_OPTIONS.map((t) => `<button type="button" class="btn btn-sm ${p.dailyTimeMinutes === t.value ? "btn-primary" : "btn-ghost"}" data-time="${t.value}">${t.label}</button>`).join("")}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancel">Cancelar</button>
      <button class="btn btn-primary" id="save-profile">Salvar</button>
    </div>`,
    {
      onMount: (modal) => {
        let dailyTimeMinutes = p.dailyTimeMinutes || 60;
        modal.querySelectorAll("[data-time]").forEach((btn) => {
          btn.addEventListener("click", () => {
            dailyTimeMinutes = Number(btn.dataset.time);
            modal.querySelectorAll("[data-time]").forEach((b) => {
              b.classList.remove("btn-primary");
              b.classList.add("btn-ghost");
            });
            btn.classList.remove("btn-ghost");
            btn.classList.add("btn-primary");
          });
        });
        modal.querySelector("#cancel").addEventListener("click", closeModal);
        modal.querySelector("#save-profile").addEventListener("click", () => {
          store.updateProfile({
            name: modal.querySelector("#pf-name").value.trim(),
            studyArea: modal.querySelector("#pf-area").value.trim(),
            level: modal.querySelector("#pf-level").value,
            dailyTimeMinutes,
          });
          closeModal();
          showToast("Perfil atualizado.");
        });
      },
    }
  );
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

boot();
