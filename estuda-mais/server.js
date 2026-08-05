// Servidor local mínimo para rodar o Estuda+ com IA real (Groq).
//
// Faz duas coisas:
//   1) Serve os arquivos estáticos do app (substitui o "python3 -m http.server").
//   2) Expõe POST /api/ai, que recebe { task, ...params } do navegador e repassa
//      para a API da Groq usando a chave lida de .env.local — a chave nunca
//      fica no código do navegador, só aqui no servidor.
//
// Como rodar:
//   1) Crie o arquivo .env.local nesta mesma pasta (copie .env.local.example)
//      com a linha: GROQ_API_KEY=sua_chave_aqui
//   2) node server.js
//   3) Abra http://localhost:8000
//
// Requer Node.js 18 ou mais recente (usa o fetch nativo).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8000;

function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

const localEnv = loadEnvLocal();
const GROQ_API_KEY = process.env.GROQ_API_KEY || localEnv.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || localEnv.GROQ_MODEL || "llama-3.3-70b-versatile";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const fullPath = path.normalize(path.join(__dirname, decodeURIComponent(urlPath)));
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado.");
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ---- Prompts por tarefa: cada uma pede uma resposta em JSON estrito, no
// mesmo formato que o front-end (js/ai.js) já espera. ----
function buildPrompt(task, params) {
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
      const { text, count } = params;
      return {
        system: `Você cria questões de múltipla escolha (estilo prova) a partir de um material de aula, com 4 alternativas (A a D), sendo só uma correta. ${common}`,
        user: `Material:\n"""${text}"""\n\nGere exatamente ${count} questões distintas, cada uma com exatamente 4 alternativas e apenas um "correctId" correto.\nResponda em JSON: {"questions": [{"statement": "...", "alternatives": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}], "correctId": "A"}]}`,
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

async function callGroq(task, params) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY não configurada. Crie o arquivo estuda-mais/.env.local com GROQ_API_KEY=sua_chave (veja .env.local.example).");
  }
  const { system, user } = buildPrompt(task, params);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
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

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/ai") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const { task, ...params } = parsed;
        const result = await callGroq(task, params);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Estuda+ rodando em http://localhost:${PORT}`);
  if (!GROQ_API_KEY) {
    console.log('Aviso: GROQ_API_KEY não encontrada. Crie o arquivo ".env.local" (veja ".env.local.example") para habilitar a IA real.');
  } else {
    console.log(`IA real habilitada — usando o modelo "${GROQ_MODEL}" na Groq.`);
  }
});
