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
import { callGroq, DEFAULT_MODEL } from "./lib/groq.js";

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
const GROQ_MODEL = process.env.GROQ_MODEL || localEnv.GROQ_MODEL || DEFAULT_MODEL;

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

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/ai") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        if (!GROQ_API_KEY) {
          throw new Error('GROQ_API_KEY não configurada. Crie o arquivo estuda-mais/.env.local com GROQ_API_KEY=sua_chave (veja .env.local.example).');
        }
        const parsed = JSON.parse(body || "{}");
        const { task, ...params } = parsed;
        const result = await callGroq({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, task, params });
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
