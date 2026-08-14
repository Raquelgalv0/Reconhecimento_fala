// Camada de IA — chama a API da Groq através do servidor local (server.js),
// que é quem de fato guarda a chave e fala com a Groq. O navegador nunca vê
// a chave: só manda { task, ...params } para /api/ai e recebe o resultado.
// O servidor exige login (token do Supabase) antes de gastar crédito da Groq.
import { getValidSession } from "./auth.js";

async function callAi(task, params) {
  const session = await getValidSession();
  if (!session) {
    throw new Error("Faça login para usar a IA.");
  }

  let response;
  try {
    response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ task, ...params }),
    });
  } catch {
    throw new Error('Não foi possível falar com o servidor local. Confirme que você rodou "node server.js" (não só um servidor de arquivos estático).');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor local respondeu algo inesperado.");
  }

  if (!response.ok || data.error) {
    throw new Error(data.error || `Erro ao chamar a IA (HTTP ${response.status}).`);
  }
  return data;
}

export async function generateSummaryFromText(rawText, title) {
  const { html } = await callAi("summary", { text: rawText, title });
  return html;
}

// Sugere pergunta/resposta a partir de um trecho selecionado no resumo.
export async function suggestFlashcardFromSelection(selectionText) {
  const { front, back } = await callAi("flashcardFromSelection", { selectionText });
  return { front, back };
}

// Sugere um comentário explicativo para uma questão, a partir do enunciado e
// do texto da alternativa correta.
export async function suggestQuestionComment(statement, correctText) {
  const { comment } = await callAi("questionComment", { statement, correctText });
  return comment;
}

// Gera até `count` flashcards a partir de um material.
export async function generateFlashcardsFromText(text, count = 5) {
  const { flashcards } = await callAi("flashcards", { text, count });
  return flashcards;
}

// Gera itens de checklist (pontos de revisão) a partir do texto.
export async function generateChecklistFromText(text, count = 8) {
  const { items } = await callAi("checklist", { text, count });
  return items;
}

// Gera até `count` questões de múltipla escolha a partir de um material.
// style: "conceitual" (padrão), "clinico" ou "misto" (mistura os dois, Modo Medicina).
// difficulty: "facil" | "medio" (padrão) | "dificil" | "misto" (mistura as três).
export async function generateQuestionsFromText(text, count = 3, style = "conceitual", difficulty = "medio") {
  const { questions } = await callAi("questions", { text, count, style, difficulty });
  return questions;
}

// Tira dúvidas em formato de chat — separado do "Gerar com IA" (que produz
// conteúdo pro resumo). `messages` é o histórico [{role: "user"|"assistant", content}],
// `contextText` (opcional) é o texto do resumo aberto, pra IA responder com base nele.
export async function askAiTutor(messages, contextText) {
  const { reply } = await callAi("chat", { messages, contextText });
  return reply;
}

// Gera um mapa mental hierárquico: tópico central -> ramos -> sub-ramos
// (cada branch é { label, children: Branch[] }, children pode vir vazio).
export async function generateMindMapFromText(text, title) {
  const { title: mapTitle, branches } = await callAi("mindmap", { text, title });
  return { title: mapTitle, branches };
}
