// Lógica compartilhada de chamada à Groq — usada tanto pelo servidor local
// (server.js) quanto pela função serverless da Vercel (api/ai.js), para não
// duplicar os prompts em dois lugares.

// ---- Prompts por tarefa: cada uma pede uma resposta em JSON estrito, no
// mesmo formato que o front-end (js/ai.js) já espera. ----
export function buildPrompt(task, params) {
  const common = "Responda sempre em português do Brasil. Responda SOMENTE com um objeto JSON válido, sem nenhum texto antes ou depois, sem markdown.";

  switch (task) {
    case "summary": {
      const { text, title } = params;
      return {
        system: `Você ajuda estudantes brasileiros a transformar material de aula em um resumo de estudo, em HTML simples (apenas as tags <p>, <h3>, <ul>, <li>, <strong>, <em>). ${common}`,
        user: `Título (opcional): ${title || "(sem título)"}\n\nTexto-base:\n"""${text}"""\n\nGere um resumo: um parágrafo introdutório e, se fizer sentido, uma seção "Pontos-chave" em lista.\nResponda em JSON: {"html": "<p>...</p><h3>Pontos-chave</h3><ul><li>...</li></ul>"}`,
      };
    }
    case "flashcardFromSelection": {
      const { selectionText } = params;
      return {
        system: `Você cria flashcards de estudo (pergunta objetiva na frente, resposta direta no verso) a partir de um trecho de texto. ${common}`,
        user: `Trecho selecionado:\n"""${selectionText}"""\n\nResponda em JSON: {"front": "pergunta objetiva", "back": "resposta direta"}`,
      };
    }
    case "questionComment": {
      const { statement, correctText } = params;
      return {
        system: `Você escreve comentários explicativos curtos para questões de múltipla escolha, justificando a alternativa correta. ${common}`,
        user: `Enunciado: ${statement}\nAlternativa correta: ${correctText}\n\nResponda em JSON: {"comment": "explicação de 1 a 3 frases"}`,
      };
    }
    case "flashcards": {
      const { text, count } = params;
      return {
        system: `Você cria flashcards de estudo (pergunta objetiva, resposta direta) a partir de um material de aula. ${common}`,
        user: `Material:\n"""${text}"""\n\nGere exatamente ${count} flashcards distintos, cobrindo os pontos mais importantes.\nResponda em JSON: {"flashcards": [{"front": "...", "back": "..."}]}`,
      };
    }
    case "checklist": {
      const { text, count } = params;
      return {
        system: `Você extrai uma checklist de pontos de revisão a partir de um material de aula. ${common}`,
        user: `Material:\n"""${text}"""\n\nGere até ${count} itens de checklist (frases curtas, cada uma um ponto a revisar).\nResponda em JSON: {"items": ["...", "..."]}`,
      };
    }
    case "questions": {
      const { text, count, style, difficulty } = params;
      const styleInstruction =
        style === "misto"
          ? 'Misture os dois formatos ao longo do conjunto: algumas questões em formato de caso clínico (breve descrição de paciente, idade, sintomas e achados relevantes, terminando numa pergunta objetiva sobre conduta, diagnóstico ou fisiopatologia) e outras conceituais diretas.'
          : style === "clinico"
          ? "Todas as questões devem ser em formato de caso clínico: cada enunciado descreve um breve caso (paciente, idade, sintomas, achados relevantes) baseado nos conceitos do material, terminando numa pergunta objetiva sobre conduta, diagnóstico ou fisiopatologia."
          : "Todas as questões devem ser conceituais e diretas.";
      const difficultyInstruction =
        difficulty === "misto"
          ? 'Varie a dificuldade entre "facil", "medio" e "dificil" ao longo do conjunto.'
          : `Todas as questões devem ter dificuldade "${difficulty || "medio"}".`;
      return {
        system: `Você cria questões de múltipla escolha (estilo prova) a partir de um material de aula, com 4 alternativas (A a D), sendo só uma correta. ${common}`,
        user: `Material:\n"""${text}"""\n\nGere exatamente ${count} questões distintas. ${styleInstruction} ${difficultyInstruction} Indique em cada questão o campo "difficulty" com o valor "facil", "medio" ou "dificil" (nunca "misto" — esse valor é só uma instrução de variedade, não uma resposta válida).\nResponda em JSON: {"questions": [{"statement": "...", "alternatives": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}], "correctId": "A", "difficulty": "facil"}]}`,
      };
    }
    case "chat": {
      const { messages, contextText } = params;
      const contextBlock = contextText
        ? `A pessoa está estudando o seguinte material agora — use como contexto quando a pergunta se referir a ele:\n"""${contextText}"""\n\n`
        : "";
      const history = (messages || [])
        .map((m) => `${m.role === "user" ? "Estudante" : "Você"}: ${m.content}`)
        .join("\n");
      return {
        system: `Você é um tutor de estudos, tirando dúvidas rápidas de um estudante brasileiro dentro de um app de resumos. Responda de forma direta, didática e curta (poucos parágrafos ou uma lista, sem enrolação). Pode usar **negrito** e listas com "-" em markdown simples. ${common}`,
        user: `${contextBlock}Conversa até agora:\n${history}\n\nResponda à última mensagem do estudante.\nResponda em JSON: {"reply": "sua resposta em markdown simples"}`,
      };
    }
    case "mindmap": {
      const { text, title } = params;
      return {
        system: `Você organiza um material de aula em um mapa mental simples: um tópico central e até 6 ramos (subtemas curtos). ${common}`,
        user: `Título (opcional): ${title || "(sem título)"}\nMaterial:\n"""${text}"""\n\nResponda em JSON: {"title": "...", "branches": ["...", "..."]} com até 6 ramos curtos (no máximo ~10 palavras cada).`,
      };
    }
    default:
      throw new Error(`Tarefa de IA desconhecida: "${task}".`);
  }
}

export async function callGroq({ apiKey, model, task, params }) {
  if (!apiKey) {
    throw new Error("GROQ_API_KEY não configurada.");
  }
  const { system, user } = buildPrompt(task, params);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`A Groq retornou um erro (HTTP ${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("A Groq devolveu uma resposta vazia.");

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Não foi possível interpretar a resposta da IA (não era um JSON válido).");
  }
}

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";
