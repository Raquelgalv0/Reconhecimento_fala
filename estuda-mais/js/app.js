import { store } from "./store.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderResumos } from "./views/resumos.js";
import { renderFlashcards } from "./views/flashcards.js";
import { renderQuestoes } from "./views/questoes.js";
import { renderDesempenho } from "./views/desempenho.js";
import { renderUpload } from "./views/upload.js";
import { renderRedacao } from "./views/redacao.js";
import { Icon } from "./icons.js";

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

function renderOnboarding() {
  const selected = new Set();
  appRoot.innerHTML = `
    <div class="onboarding-overlay">
      <div class="onboarding-card">
        <h1>Bem-vinda ao Estuda+</h1>
        <p>Escolha um ou mais objetivos. O app ajusta prioridades e relatórios para o seu caso — sem precisar de apps diferentes.</p>
        <div id="mode-list"></div>
        <button class="btn btn-primary" id="continue" style="width:100%; justify-content:center; margin-top:6px; opacity:.5;" disabled>Continuar</button>
      </div>
    </div>`;

  const list = appRoot.querySelector("#mode-list");
  const continueBtn = appRoot.querySelector("#continue");

  MODES.forEach((m) => {
    const card = document.createElement("div");
    card.className = "checkbox-card";
    card.innerHTML = `<span class="mode-icon">${Icon(m.icon, { size: 19 })}</span><div><b>${m.title}</b><span>${m.desc}</span></div>`;
    card.addEventListener("click", () => {
      if (selected.has(m.id)) selected.delete(m.id);
      else selected.add(m.id);
      card.classList.toggle("selected");
      continueBtn.disabled = selected.size === 0;
      continueBtn.style.opacity = selected.size === 0 ? ".5" : "1";
    });
    list.appendChild(card);
  });

  continueBtn.addEventListener("click", () => {
    if (selected.size === 0) return;
    store.setOnboarded([...selected]);
    renderShell();
  });
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

    <div class="sidebar-footer">Resumos e flashcards sincronizados · revisão espaçada Acertei/Errei</div>
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
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

boot();
