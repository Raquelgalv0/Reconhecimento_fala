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
