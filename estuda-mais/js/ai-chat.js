// Chat de dúvidas com a IA — separado do botão "Gerar com IA" (que só cria
// conteúdo pro resumo). Este é para conversar/perguntar, tipo um chat.
//
// Mesma ideia do spotify-player.js: montado UMA VEZ no shell do app, fora da
// área que o roteador troca (#main), então continua aberto e com a conversa
// intacta mesmo navegando entre Resumos, Flashcards etc.
import { askAiTutor } from "./ai.js";
import { showToast, stripHtml } from "./ui-utils.js";
import { Icon } from "./icons.js";
import { store } from "./store.js";
import { MODE_TAG } from "./modes.js";

let rootEl = null;
let expanded = false;
let messages = []; // [{ role: "user" | "assistant", content }]
let context = null; // { text, label } | null — resumo aberto no momento em que o chat foi iniciado
let sending = false;
// Como render() recria o <textarea> do zero a cada chamada, o valor digitado
// não sobrevive a um re-render sozinho — draftText segura o texto entre eles
// (ex.: pra devolver a pergunta no campo se o envio falhar).
let draftText = "";

export function mountAiChat(container) {
  rootEl = container;
  render();
}

// Chamado a partir de qualquer tela (hoje, o editor de Resumos) pra abrir o
// chat já com o material atual como contexto. Passar null limpa o contexto.
export function openAiChat(ctx) {
  context = ctx || null;
  expanded = true;
  render();
  const input = rootEl?.querySelector("#ai-chat-input");
  if (input) input.focus();
}

// Monta um contexto automático a partir de onde a pessoa está no app agora
// — pra sentir "agente de estudo" (sabe o que você tá fazendo) em vez de só
// responder em branco, sem precisar clicar em "Tirar dúvida" de dentro de
// um resumo especificamente toda vez. Usado quando abre pela aba flutuante.
function buildAmbientContext() {
  const ui = store.state.ui;

  // Mais específico: um resumo aberto no editor agora.
  if (ui.activeSummaryId) {
    const summary = store.state.summaries.find((s) => s.id === ui.activeSummaryId);
    if (summary) {
      const text = stripHtml(summary.contentHtml || "").slice(0, 6000);
      if (text) return { text, label: summary.title || "Sem título" };
    }
  }

  // Um assunto/pasta específico sendo filtrado (Resumos, Flashcards ou Questões).
  const folderId = ui.activeFolderId || ui.activeDeckId || ui.activeQuestionFolderId;
  if (folderId) {
    const folder = store.state.folders.find((f) => f.id === folderId);
    if (folder) {
      const titles = store
        .summariesInFolder(folderId)
        .map((s) => s.title || "Sem título")
        .slice(0, 6);
      const parts = [`A pessoa está vendo o assunto "${store.folderPath(folderId)}" no app agora.`];
      if (titles.length) parts.push(`Resumos desse assunto: ${titles.join(", ")}.`);
      parts.push(
        `${store.cardsInFolder(folderId).length} flashcards e ${store.questionsInFolder(folderId).length} questões cadastradas nesse assunto.`
      );
      return { text: parts.join(" "), label: folder.name };
    }
  }

  // Sem nada específico em foco (ex.: no Painel) — dá uma visão geral: Ala(s)
  // ativa(s) e o resumo mais recente, pra ainda soar contextualizado.
  const modes = (store.state.modes || []).map((m) => MODE_TAG[m] || m);
  const recent = [...store.state.summaries].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
  const parts = [];
  if (modes.length) parts.push(`A pessoa estuda para: ${modes.join(", ")}.`);
  if (recent) parts.push(`O resumo mais recente dela é "${recent.title || "Sem título"}" (assunto: ${store.folderPath(recent.folderId)}).`);
  if (!parts.length) return null;
  return { text: parts.join(" "), label: modes[0] || "Seus estudos" };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Conversor bem simples: só o que a IA foi instruída a usar (negrito e
// listas com "-"), sem trazer uma lib de markdown pra isso.
function mdToHtml(raw) {
  const lines = escapeHtml(raw).split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^-\s+/.test(trimmed)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${trimmed.replace(/^-\s+/, "")}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (trimmed) html += `<p>${trimmed}</p>`;
    }
  }
  if (inList) html += "</ul>";
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  return html || "<p></p>";
}

// Fica no canto direito da tela, como uma aba/gaveta — não no canto
// esquerdo (onde brigava com a sidebar) nem sobreposto ao player do
// Spotify (que já mora no canto inferior direito). Recolhido é só um
// botão flutuante discreto; aberto, desliza um painel de altura cheia a
// partir da borda direita, abaixo do sininho de notificações.
function render() {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div class="ai-chat-dock ${expanded ? "is-open" : ""}">
      <button class="ai-chat-tab" id="ai-chat-toggle" title="Tirar dúvida com IA">
        ${Icon("messageCircle", { size: 16 })}<span>Dúvidas</span>
      </button>
      <div class="ai-chat-panel">
        <div class="ai-chat-head">
          <span>${Icon("sparkles", { size: 13 })} Tirar dúvida com IA</span>
          <div class="ai-chat-head-actions">
            ${messages.length ? `<button class="icon-btn-ghost" id="ai-chat-clear" title="Limpar conversa">${Icon("eraser", { size: 12 })}</button>` : ""}
            <button class="icon-btn-ghost" id="ai-chat-close" title="Fechar">${Icon("x", { size: 13 })}</button>
          </div>
        </div>
        ${context ? `<div class="ai-chat-context">${Icon("fileText", { size: 11 })}<span>Sobre: ${escapeHtml(context.label)}</span><button id="ai-chat-drop-context" title="Parar de usar como contexto">${Icon("x", { size: 11 })}</button></div>` : ""}
        <div class="ai-chat-messages" id="ai-chat-messages">
          ${
            messages.length === 0
              ? `<div class="ai-chat-empty">${Icon("messageCircle", { size: 22 })}<span>Pergunte alguma coisa sobre o que você está estudando.</span></div>`
              : messages
                  .map(
                    (m) => `<div class="ai-chat-msg ai-chat-msg--${m.role}">${m.role === "user" ? escapeHtml(m.content) : mdToHtml(m.content)}</div>`
                  )
                  .join("")
          }
          ${sending ? `<div class="ai-chat-msg ai-chat-msg--assistant ai-chat-typing"><span></span><span></span><span></span></div>` : ""}
        </div>
        <div class="ai-chat-input-row">
          <textarea id="ai-chat-input" placeholder="Digite sua dúvida..." rows="1"></textarea>
          <button id="ai-chat-send" title="Enviar" ${sending ? "disabled" : ""}>${Icon("send", { size: 15 })}</button>
        </div>
      </div>
    </div>`;

  rootEl.querySelector("#ai-chat-toggle").addEventListener("click", () => {
    // Recalcula o contexto toda vez que abre pela aba flutuante, pra refletir
    // onde a pessoa está AGORA no app (pode ter mudado de tela desde a
    // última vez que abriu o chat).
    context = buildAmbientContext();
    expanded = true;
    render();
    rootEl.querySelector("#ai-chat-input")?.focus();
  });
  rootEl.querySelector("#ai-chat-close").addEventListener("click", () => {
    expanded = false;
    render();
  });

  const clearBtn = rootEl.querySelector("#ai-chat-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      messages = [];
      render();
    });
  }

  const dropContextBtn = rootEl.querySelector("#ai-chat-drop-context");
  if (dropContextBtn) {
    dropContextBtn.addEventListener("click", () => {
      context = null;
      render();
    });
  }

  const msgList = rootEl.querySelector("#ai-chat-messages");
  if (msgList) msgList.scrollTop = msgList.scrollHeight;

  const input = rootEl.querySelector("#ai-chat-input");
  const sendBtn = rootEl.querySelector("#ai-chat-send");
  if (!input || !sendBtn) return;
  input.value = draftText;
  input.addEventListener("input", () => {
    draftText = input.value;
  });

  const send = () => {
    const text = input.value.trim();
    if (!text || sending) return;
    draftText = "";
    messages.push({ role: "user", content: text });
    sending = true;
    render();
    // Manda só as últimas mensagens pra IA — numa conversa longa, o
    // histórico inteiro deixa o pedido pesado e mais lento (risco de
    // estourar o tempo limite do servidor), sem ganhar muito em contexto.
    askAiTutor(messages.slice(-16), context?.text || null)
      .then((reply) => {
        messages.push({ role: "assistant", content: reply });
      })
      .catch((err) => {
        showToast(err.message, "alertCircle");
        messages.pop(); // devolve a pergunta pro campo, não perde o que a pessoa digitou
        draftText = text;
      })
      .finally(() => {
        sending = false;
        render();
      });
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      expanded = false;
      render();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  sendBtn.addEventListener("click", send);
}
