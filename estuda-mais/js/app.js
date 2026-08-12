import { store } from "./store.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderResumos } from "./views/resumos.js";
import { renderFlashcards } from "./views/flashcards.js";
import { renderQuestoes } from "./views/questoes.js";
import { renderDesempenho } from "./views/desempenho.js";
import { renderUpload } from "./views/upload.js";
import { renderFoco } from "./views/foco.js";
import { renderAssuntos } from "./views/assuntos.js";
import { Icon } from "./icons.js";
import { openModal, closeModal, showToast } from "./ui-utils.js";
import { signUp, signIn, signOut, getValidSession, getCachedUser } from "./auth.js";
import { mountSpotifyPlayer } from "./spotify-player.js";
import { MODES, MODE_TAG } from "./modes.js";

const appRoot = document.getElementById("app");

function renderLoadingScreen(message) {
  appRoot.innerHTML = `
    <div class="onboarding-overlay">
      <div class="onboarding-card" style="text-align:center;">
        <div class="onboarding-step">HiperNotes</div>
        <p style="margin:0;">${message}</p>
      </div>
    </div>`;
}

async function boot() {
  const session = await getValidSession();
  if (!session) {
    renderAuthScreen();
    return;
  }
  if (!store.hydrated || store.userId !== session.user.id) {
    renderLoadingScreen("Carregando seus dados...");
    await store.hydrate(session);
  }
  if (!store.state.onboarded) {
    renderOnboarding();
  } else {
    renderShell();
  }
}

function renderAuthScreen() {
  let mode = "signin"; // ou "signup"

  function render() {
    appRoot.innerHTML = `
      <div class="onboarding-overlay">
        <div class="onboarding-card">
          <div class="onboarding-step">HiperNotes</div>
          <h1>${mode === "signin" ? "Entrar na sua conta" : "Criar sua conta"}</h1>
          <p>${mode === "signin" ? "Acesse com seu e-mail e senha." : "Leva menos de um minuto."}</p>
          <div id="auth-error-slot"></div>
          <div class="field">
            <label>${Icon("mail", { size: 12 })} E-mail</label>
            <input type="email" id="auth-email" placeholder="voce@email.com" autocomplete="email" />
          </div>
          <div class="field">
            <label>${Icon("lock", { size: 12 })} Senha</label>
            <input type="password" id="auth-password" placeholder="••••••••" autocomplete="${mode === "signin" ? "current-password" : "new-password"}" />
          </div>
          <button class="btn btn-primary" id="auth-submit" style="width:100%; justify-content:center;">
            ${mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
          <div class="auth-foot">
            ${
              mode === "signin"
                ? `Ainda não tem conta? <button class="auth-switch" id="auth-toggle">Criar conta</button>`
                : `Já tem conta? <button class="auth-switch" id="auth-toggle">Entrar</button>`
            }
          </div>
        </div>
      </div>`;

    appRoot.querySelector("#auth-toggle").addEventListener("click", () => {
      mode = mode === "signin" ? "signup" : "signin";
      render();
    });

    const emailEl = appRoot.querySelector("#auth-email");
    const passEl = appRoot.querySelector("#auth-password");
    const submitBtn = appRoot.querySelector("#auth-submit");

    const submit = async () => {
      const email = emailEl.value.trim();
      const password = passEl.value;
      const errorSlot = appRoot.querySelector("#auth-error-slot");
      errorSlot.innerHTML = "";
      if (!email || !password) {
        errorSlot.innerHTML = `<div class="auth-error">Preencha e-mail e senha.</div>`;
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = mode === "signin" ? "Entrando..." : "Criando conta...";
      try {
        if (mode === "signin") {
          await signIn(email, password);
          boot();
        } else {
          const { needsEmailConfirmation } = await signUp(email, password);
          if (needsEmailConfirmation) {
            errorSlot.innerHTML = `<div class="auth-error" style="background:var(--accent-soft); color:#4b3fa0;">Conta criada! Verifique seu e-mail para confirmar antes de entrar.</div>`;
            submitBtn.disabled = false;
            submitBtn.textContent = "Criar conta";
            mode = "signin";
          } else {
            boot();
          }
        }
      } catch (err) {
        errorSlot.innerHTML = `<div class="auth-error">${escapeHtml(err.message)}</div>`;
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "signin" ? "Entrar" : "Criar conta";
      }
    };

    submitBtn.addEventListener("click", submit);
    passEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  }

  render();
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
          <h1>Bem-vinda ao HiperNotes</h1>
          <p>Escolha um ou mais objetivos. O app ajusta prioridades e relatórios para o seu caso, sem precisar de apps diferentes.</p>
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
          <p>Isso ajuda a personalizar seu painel e suas metas (pode pular e preencher depois).</p>
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
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
      <button class="mobile-menu-btn" id="mobile-menu-btn" title="Menu">${Icon("menu", { size: 18 })}</button>
      <div class="notif-wrap" id="notif-wrap">
        <button class="notif-bell" id="notif-bell" title="Notificações">${Icon("bell", { size: 17 })}<span class="notif-badge" id="notif-badge" hidden></span></button>
        <div class="notif-dropdown" id="notif-dropdown" hidden></div>
      </div>
      <main class="main" id="main"></main>
      <div id="spotify-mini-root" hidden></div>
    </div>`;

  mountSpotifyPlayer(appRoot.querySelector("#spotify-mini-root"));

  const sidebarEl = appRoot.querySelector("#sidebar");
  const mainEl = appRoot.querySelector("#main");
  const backdropEl = appRoot.querySelector("#sidebar-backdrop");
  const notifBell = appRoot.querySelector("#notif-bell");
  const notifBadge = appRoot.querySelector("#notif-badge");
  const notifDropdown = appRoot.querySelector("#notif-dropdown");
  let notifOpen = false;

  const closeMobileSidebar = () => {
    sidebarEl.classList.remove("mobile-open");
    backdropEl.classList.remove("show");
  };

  appRoot.querySelector("#mobile-menu-btn").addEventListener("click", () => {
    sidebarEl.classList.toggle("mobile-open");
    backdropEl.classList.toggle("show");
  });
  backdropEl.addEventListener("click", closeMobileSidebar);
  sidebarEl.addEventListener("click", (e) => {
    if (e.target.closest("[data-nav], [data-folder]")) closeMobileSidebar();
  });

  const renderNotifDropdown = (notifications) => {
    if (notifications.length === 0) {
      notifDropdown.innerHTML = `<div class="notif-empty">Nenhum aviso por aqui. Tudo em dia!</div>`;
      return;
    }
    notifDropdown.innerHTML = notifications
      .map(
        (n) => `
      <button class="notif-item" data-notif-route="${n.route}">
        <span class="notif-item-icon">${Icon(n.icon, { size: 15 })}</span>
        <span class="notif-item-text"><b>${n.title}</b><span>${n.desc}</span></span>
      </button>`
      )
      .join("");
    notifDropdown.querySelectorAll("[data-notif-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        store.setRoute(btn.dataset.notifRoute, { activeDeckId: null, reviewing: false });
        notifOpen = false;
        notifDropdown.hidden = true;
      });
    });
  };

  const renderNotifBell = () => {
    const notifications = store.getNotifications();
    if (notifications.length > 0) {
      notifBadge.hidden = false;
      notifBadge.textContent = notifications.length;
    } else {
      notifBadge.hidden = true;
    }
    renderNotifDropdown(notifications);
  };

  notifBell.addEventListener("click", (e) => {
    e.stopPropagation();
    notifOpen = !notifOpen;
    notifDropdown.hidden = !notifOpen;
  });
  document.addEventListener("click", (e) => {
    if (notifOpen && !e.target.closest("#notif-wrap")) {
      notifOpen = false;
      notifDropdown.hidden = true;
    }
  });

  const safeRender = () => {
    renderSidebar(sidebarEl);
    renderNotifBell();
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
  if (route === "foco") return renderFoco(mainEl);
  if (route === "assuntos") return renderAssuntos(mainEl);
  return renderDashboard(mainEl);
}

function renderSidebar(sidebarEl) {
  const { route } = store.state.ui;
  const dueToday = store.cardsDueToday().length;

  sidebarEl.innerHTML = `
    <div class="brand"><span class="dot">●</span> HiperNotes</div>
    <div class="mode-badges">${(store.state.modes || []).map((m) => `<span class="mode-badge">${MODE_TAG[m]}</span>`).join("")}</div>

    <div class="nav">
      <button class="nav-item ${route === "dashboard" ? "active" : ""}" data-nav="dashboard">${Icon("home")}<span>Painel</span></button>
      <button class="nav-item ${route === "resumos" ? "active" : ""}" data-nav="resumos">${Icon("fileText")}<span>Resumos</span></button>
      <button class="nav-item ${route === "flashcards" ? "active" : ""}" data-nav="flashcards">${Icon("layers")}<span>Flashcards</span> ${dueToday ? `<span class="badge-count">${dueToday}</span>` : ""}</button>
      <button class="nav-item ${route === "questoes" ? "active" : ""}" data-nav="questoes">${Icon("helpCircle")}<span>Questões</span></button>
      <button class="nav-item ${route === "assuntos" ? "active" : ""}" data-nav="assuntos">${Icon("folder")}<span>Assuntos</span></button>
      <button class="nav-item ${route === "desempenho" ? "active" : ""}" data-nav="desempenho">${Icon("trendingUp")}<span>Desempenho</span></button>
      <button class="nav-item ${route === "upload" ? "active" : ""}" data-nav="upload">${Icon("upload")}<span>Upload de Materiais</span></button>
      <button class="nav-item ${route === "foco" ? "active" : ""}" data-nav="foco">${Icon("clock")}<span>Foco</span></button>
    </div>

    <div class="sidebar-footer">
      <button class="icon-btn" id="edit-profile-btn" title="Editar perfil">${Icon("pencil", { size: 12 })}</button>
      <button class="icon-btn" id="logout-btn" title="Sair${getCachedUser()?.email ? ` (${getCachedUser().email})` : ""}">${Icon("logOut", { size: 12 })}</button>
      <span>${store.state.profile?.name ? `Olá, ${escapeHtml(store.state.profile.name)}` : "Resumos e flashcards sincronizados"} · revisão espaçada Acertei/Errei</span>
    </div>
  `;

  sidebarEl.querySelector("#logout-btn").addEventListener("click", async () => {
    if (!confirm("Sair da sua conta?")) return;
    await signOut();
    store.reset();
    boot();
  });

  sidebarEl.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (target === "resumos") store.setRoute("resumos", { activeSummaryId: null, activeFolderId: null });
      else if (target === "flashcards") store.setRoute("flashcards", { activeDeckId: null, reviewing: false });
      else if (target === "questoes") store.setRoute("questoes", { activeQuestionFolderId: null, questionFilter: "all", practicing: false });
      else if (target === "desempenho") store.setRoute("desempenho");
      else if (target === "upload") store.setRoute("upload");
      else if (target === "foco") store.setRoute("foco");
      else if (target === "assuntos") store.setRoute("assuntos");
      else store.setRoute("dashboard");
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
    <div class="field">
      <label>Backup dos dados</label>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost btn-sm" id="export-data">${Icon("download", { size: 13 })}<span>Exportar</span></button>
        <button type="button" class="btn btn-ghost btn-sm" id="import-data-btn">${Icon("upload", { size: 13 })}<span>Importar</span></button>
        <input type="file" id="import-data-file" accept="application/json" style="display:none" />
      </div>
      <div class="field-hint">Seus dados já ficam salvos na sua conta (sincronizados automaticamente). Esse backup é só uma cópia extra, útil pra guardar num arquivo seu.</div>
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
        modal.querySelector("#export-data").addEventListener("click", () => {
          const json = store.exportData();
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `hipernotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast("Backup exportado.");
        });
        const importInput = modal.querySelector("#import-data-file");
        const importBtn = modal.querySelector("#import-data-btn");
        importBtn.addEventListener("click", () => importInput.click());
        importInput.addEventListener("change", () => {
          const file = importInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async () => {
            importBtn.disabled = true;
            const originalHtml = importBtn.innerHTML;
            importBtn.innerHTML = `${Icon("upload", { size: 13 })}<span>Importando...</span>`;
            try {
              await store.importData(String(reader.result || ""));
              setTimeout(() => location.reload(), 600);
            } catch (e) {
              showToast(e.message || "Arquivo de backup inválido.", "alertCircle");
              importBtn.disabled = false;
              importBtn.innerHTML = originalHtml;
            }
          };
          reader.readAsText(file);
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
