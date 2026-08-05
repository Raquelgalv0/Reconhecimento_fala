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

// ---- Redação (ENEM): correção heurística local das 5 competências ----
// Isto é uma simulação por regras (contagem de palavras, conectivos, parágrafos)
// — não é uma IA de linguagem real. Serve para dar feedback imediato no MVP;
// numa próxima fase seria substituída por um modelo de linguagem de verdade.

const CONECTIVOS = [
  "além disso", "por outro lado", "dessa forma", "desse modo", "portanto",
  "entretanto", "contudo", "todavia", "segundo", "de acordo com",
  "nesse sentido", "assim", "logo", "pois", "ademais", "outrossim",
  "primeiramente", "em suma", "por fim", "no entanto",
];

const PROPOSTA_MARCADORES = [
  "governo", "estado", "escola", "escolas", "mídia", "sociedade",
  "poder público", "políticas públicas", "campanha", "campanhas",
  "ministério", "é necessário", "deve-se", "é preciso", "cabe",
];

function splitParagraphs(text) {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function countWords(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

function countOccurrences(text, list) {
  const lower = text.toLowerCase();
  return list.reduce((sum, term) => sum + (lower.split(term).length - 1), 0);
}

function tier(score) {
  if (score >= 160) return "alto";
  if (score >= 100) return "médio";
  return "baixo";
}

export function correctEssay(text, theme) {
  const clean = text.trim();
  const words = countWords(clean);
  const paragraphs = splitParagraphs(clean);
  const sentences = splitSentences(clean);
  const avgWordsPerSentence = sentences.length ? words / sentences.length : 0;
  const conectivos = countOccurrences(clean, CONECTIVOS);
  const lastParagraph = paragraphs[paragraphs.length - 1] || "";
  const propostaHits = countOccurrences(lastParagraph, PROPOSTA_MARCADORES);

  // C1 — domínio da norma culta (proxy: extensão, ausência de frases longas demais)
  let c1 = 200;
  if (words < 120) c1 -= 60;
  else if (words < 200) c1 -= 20;
  if (avgWordsPerSentence > 35) c1 -= 40;
  if (paragraphs.length < 3) c1 -= 20;
  c1 = Math.max(40, Math.min(200, c1));

  // C2 — compreensão do tema (proxy: palavras do tema presentes no texto)
  const themeWords = (theme || "").toLowerCase().match(/[a-zà-ú]{5,}/g) || [];
  const uniqueThemeWords = [...new Set(themeWords)];
  const themeHits = uniqueThemeWords.filter((w) => clean.toLowerCase().includes(w)).length;
  const themeCoverage = uniqueThemeWords.length ? themeHits / uniqueThemeWords.length : 0.6;
  let c2 = Math.round(80 + themeCoverage * 120);
  if (words < 100) c2 -= 40;
  c2 = Math.max(40, Math.min(200, c2));

  // C3 — seleção e organização de argumentos (proxy: nº de parágrafos + conectivos)
  let c3 = 80;
  if (paragraphs.length >= 4) c3 += 60;
  else if (paragraphs.length >= 3) c3 += 30;
  c3 += Math.min(60, conectivos * 10);
  c3 = Math.max(40, Math.min(200, c3));

  // C4 — mecanismos linguísticos / coesão (proxy: densidade de conectivos)
  let c4 = 60 + Math.min(120, conectivos * 20);
  if (paragraphs.length >= 4) c4 += 20;
  c4 = Math.max(40, Math.min(200, c4));

  // C5 — proposta de intervenção (proxy: marcadores de proposta no último parágrafo)
  let c5 = 40;
  if (propostaHits >= 3) c5 = 200;
  else if (propostaHits === 2) c5 = 160;
  else if (propostaHits === 1) c5 = 100;
  c5 = Math.max(40, Math.min(200, c5));

  const scores = { c1, c2, c3, c4, c5 };
  const total = c1 + c2 + c3 + c4 + c5;

  const feedback = {
    c1:
      tier(c1) === "alto"
        ? "Boa norma culta — poucos desvios aparentes de gramática e pontuação."
        : tier(c1) === "médio"
        ? "Norma culta razoável, mas o texto está curto ou tem frases muito longas — divida períodos extensos."
        : "Desenvolva mais o texto (o ideal são 25-30 linhas) e revise a pontuação com cuidado.",
    c2:
      tier(c2) === "alto"
        ? "Ótimo domínio do tema proposto, mantendo o foco do início ao fim."
        : tier(c2) === "médio"
        ? "O texto aborda o tema, mas poderia citar mais elementos específicos da proposta."
        : "Aproxime mais o texto do tema proposto, retomando termos-chave da proposta ao longo da redação.",
    c3:
      tier(c3) === "alto"
        ? "Argumentação bem organizada, com parágrafos claros de introdução, desenvolvimento e conclusão."
        : tier(c3) === "médio"
        ? "A organização existe, mas fortaleça os parágrafos de desenvolvimento com exemplos ou dados."
        : "Estruture o texto em ao menos 4 parágrafos (introdução, 2 de desenvolvimento e conclusão).",
    c4:
      tier(c4) === "alto"
        ? "Bom uso de conectivos, garantindo coesão entre as ideias."
        : tier(c4) === "médio"
        ? "Use mais conectivos ('além disso', 'portanto', 'por outro lado') para ligar os parágrafos."
        : "O texto carece de conectivos — eles são essenciais para amarrar as ideias entre os parágrafos.",
    c5:
      tier(c5) === "alto"
        ? "Proposta de intervenção completa, com agente, ação e detalhamento."
        : tier(c5) === "médio"
        ? "Há proposta de intervenção, mas detalhe melhor quem deve agir e como."
        : "Finalize com uma proposta de intervenção clara: quem age (governo/escola/sociedade), o que faz e como.",
  };

  const suggestions = Object.entries(scores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([key]) => feedback[key]);

  return { scores, total, feedback, suggestions };
}
