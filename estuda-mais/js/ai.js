// Camada de "IA" simulada localmente (sem chamadas externas), para deixar o fluxo
// completo e testável no navegador sem depender de uma API key/rede.
// Numa próxima fase, estas duas funções seriam substituídas por chamadas reais
// a um modelo de linguagem (ex.: Claude) mantendo a mesma assinatura.

export function generateSummaryFromText(rawText, title) {
  const clean = rawText.replace(/\r/g, "").trim();
  const paragraphs = clean
    .split(/\n{2,}|\n(?=[A-ZÀ-Ú])/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return `<p>${escapeHtml(clean)}</p>`;
  }

  const intro = paragraphs[0];
  const rest = paragraphs.slice(1);

  let html = `<p>${escapeHtml(intro)}</p>`;
  if (rest.length > 0) {
    html += `<h3>Pontos-chave</h3><ul>`;
    for (const p of rest.slice(0, 8)) {
      html += `<li>${escapeHtml(p)}</li>`;
    }
    html += `</ul>`;
  }
  return html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Sugere pergunta/resposta a partir de um trecho selecionado no resumo.
export function suggestFlashcardFromSelection(selectionText) {
  const text = selectionText.trim().replace(/\s+/g, " ");
  const back = text;

  const defMatch = text.match(/^(.{3,60}?)\s+(é|são|refere-se a|consiste em|significa)\s+(.+)$/i);
  let front;
  if (defMatch) {
    const subject = defMatch[1].replace(/^(a|o|as|os)\s+/i, "").trim();
    front = `O que é ${subject}?`;
  } else {
    const words = text.split(" ").slice(0, 8).join(" ");
    front = `Explique: ${words}${text.split(" ").length > 8 ? "..." : ""}`;
  }
  return { front, back };
}

// Sugere um comentário explicativo para uma questão, a partir do enunciado e
// do texto da alternativa correta (heurística local — sem chamada externa).
export function suggestQuestionComment(statement, correctText) {
  const cleanCorrect = (correctText || "").trim().replace(/\s+/g, " ");
  const subject = statement.trim().replace(/\s+/g, " ").slice(0, 90);
  if (!cleanCorrect) return `Revise o conceito central de "${subject}" no seu resumo antes de tentar novamente.`;
  return `A alternativa correta é a que afirma: "${cleanCorrect}". Releia esse ponto no seu resumo sobre o assunto para fixar o porquê das demais estarem erradas.`;
}

// ---- Upload de materiais: transforma um texto-base em vários formatos ----

function splitSentences(text) {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildAlternatives(correctText, wrongTexts) {
  const letters = ["A", "B", "C", "D"];
  const items = shuffle([{ text: correctText, correct: true }, ...wrongTexts.map((t) => ({ text: t, correct: false }))]);
  let correctId = "A";
  const alternatives = items.map((item, i) => {
    const id = letters[i];
    if (item.correct) correctId = id;
    return { id, text: item.text };
  });
  return { alternatives, correctId };
}

const GENERIC_DISTRACTORS = [
  "Nenhuma das alternativas anteriores está correta.",
  "Informação não mencionada no material.",
  "O oposto do que foi descrito no texto.",
  "Uma exceção que só se aplica em casos raros.",
];

// Gera até `count` flashcards a partir das frases mais relevantes do texto.
export function generateFlashcardsFromText(text, count = 5) {
  const sentences = splitSentences(text);
  return sentences.slice(0, count).map((s) => suggestFlashcardFromSelection(s));
}

// Gera itens de checklist (pontos de revisão) a partir do texto.
export function generateChecklistFromText(text, count = 8) {
  return splitSentences(text).slice(0, count);
}

// Gera até `count` questões de múltipla escolha a partir de frases do tipo
// "X é/são Y" — quando não há frases nesse formato, usa as frases originais
// como base para perguntas mais genéricas.
export function generateQuestionsFromText(text, count = 3) {
  const sentences = splitSentences(text);
  const defRegex = /^(.{3,60}?)\s+(é|são|refere-se a|consiste em|significa)\s+(.+)$/i;
  const defs = [];
  sentences.forEach((s) => {
    const m = s.match(defRegex);
    if (m) defs.push({ subject: m[1].replace(/^(a|o|as|os)\s+/i, "").trim(), answer: m[3].trim() });
  });
  const pool = defs.length > 0 ? defs : sentences.map((s, i) => ({ subject: `Ponto ${i + 1} do material`, answer: s }));
  const allAnswers = pool.map((d) => d.answer);

  return pool.slice(0, count).map((d) => {
    const otherAnswers = shuffle(allAnswers.filter((a) => a !== d.answer));
    const wrongs = otherAnswers.slice(0, 3);
    while (wrongs.length < 3) wrongs.push(GENERIC_DISTRACTORS[wrongs.length] || GENERIC_DISTRACTORS[0]);
    const { alternatives, correctId } = buildAlternatives(d.answer, wrongs);
    return { statement: `De acordo com o material, sobre "${d.subject}", assinale a alternativa correta:`, alternatives, correctId };
  });
}

// Gera uma estrutura simples de mapa mental (tópico central + ramos) a partir do texto.
export function generateMindMapFromText(text, title) {
  const sentences = splitSentences(text);
  const branches = sentences.slice(0, 6).map((s) => (s.length > 70 ? `${s.slice(0, 68)}…` : s));
  return {
    title: title && title.trim() ? title.trim() : sentences[0] ? sentences[0].slice(0, 40) : "Mapa mental",
    branches: branches.length ? branches : ["Cole um texto mais longo para gerar os ramos."],
  };
}
