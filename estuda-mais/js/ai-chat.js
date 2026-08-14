// Chat de dúvidas com a IA — separado do botão "Gerar com IA" (que só cria
// conteúdo pro resumo). Este é para conversar/perguntar, tipo um chat.
//
// Mesma ideia do spotify-player.js: montado UMA VEZ no shell do app, fora da
// área que o roteador troca (#main), então continua aberto e com a conversa
// intacta mesmo navegando entre Resumos, Flashcards etc.
import { askAiTutor } from "./ai.js";
import { showToast } from "./ui-utils.js";
import { Icon } from "./icons.js";

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
    askAiTutor(messages, context?.text || null)
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
