// Função serverless da Vercel — mesma lógica do POST /api/ai do server.js
// local, mas hospedada. A chave (GROQ_API_KEY) fica configurada nas
// variáveis de ambiente do projeto na Vercel, nunca no código.
import { callGroq, DEFAULT_MODEL } from "../lib/groq.js";
import { verifyUser } from "../lib/supabase-verify.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../js/config.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }
  try {
    const user = await verifyUser(req.headers["authorization"], SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!user) {
      res.status(401).json({ error: "Faça login para usar a IA." });
      return;
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { task, ...params } = body;
    const result = await callGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      task,
      params,
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
