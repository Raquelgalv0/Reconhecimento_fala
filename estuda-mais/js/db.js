// Cliente REST genérico para o Postgres do Supabase (PostgREST) — sem SDK,
// só fetch, no mesmo espírito de auth.js. Cada chamada usa o access_token do
// usuário logado, então o RLS do banco garante que só os dados dele voltam.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const REST_URL = `${SUPABASE_URL}/rest/v1`;

async function request(path, { method = "GET", session, body, prefer } = {}) {
  if (!session?.access_token) throw new Error("Sessão inválida.");
  let res;
  try {
    res = await fetch(`${REST_URL}${path}`, {
      method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sem conexão com o banco de dados.");
  }
  if (!res.ok) {
    let msg = `Erro no banco de dados (HTTP ${res.status}).`;
    try {
      const data = await res.json();
      msg = data.message || data.error_description || msg;
    } catch {
      // resposta sem corpo JSON — mantém a mensagem genérica
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function selectAll(table, session) {
  return request(`/${table}?select=*`, { session });
}
export function insertRow(table, row, session) {
  return request(`/${table}`, { method: "POST", session, body: row, prefer: "return=representation" });
}
// PostgREST insere várias linhas de uma vez quando o body é um array — usado
// pela importação de .apkg pra não disparar uma chamada de rede por card.
export function insertRows(table, rows, session) {
  return request(`/${table}`, { method: "POST", session, body: rows, prefer: "return=representation" });
}
export function updateRow(table, id, patch, session, idColumn = "id") {
  return request(`/${table}?${idColumn}=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    session,
    body: patch,
    prefer: "return=representation",
  });
}
export function deleteRow(table, id, session, idColumn = "id") {
  return request(`/${table}?${idColumn}=eq.${encodeURIComponent(id)}`, { method: "DELETE", session });
}
export function upsertRow(table, row, session, conflictColumns = "id") {
  return request(`/${table}?on_conflict=${conflictColumns}`, {
    method: "POST",
    session,
    body: row,
    prefer: "resolution=merge-duplicates,return=representation",
  });
}
