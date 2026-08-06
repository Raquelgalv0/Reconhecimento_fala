// Autenticação via API REST do Supabase (GoTrue) — sem SDK externo, só
// fetch, pra manter o app livre de dependências. A sessão (tokens) fica
// salva no localStorage do navegador.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const SESSION_KEY = "estudamais_session";
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

function saveSession(session) {
  if (!session || !session.access_token) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + (session.expires_in || 3600) * 1000;
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at_ms: expiresAt,
      user: session.user || null,
    })
  );
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function authFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error("Não foi possível conectar. Verifique sua internet e tente de novo.");
  }
}

function friendlyAuthError(data) {
  const msg = data?.error_description || data?.msg || data?.error || data?.message || "";
  if (/invalid.*credentials|invalid_grant/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already.*registered|user.*exists/i.test(msg)) return "Já existe uma conta com esse e-mail.";
  if (/password.*least|password.*short/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/email.*invalid/i.test(msg)) return "E-mail inválido.";
  return msg || "Algo deu errado. Tente novamente.";
}

export async function signUp(email, password) {
  const res = await authFetch(`${AUTH_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(friendlyAuthError(data));

  if (data.access_token) {
    saveSession(data);
    return { needsEmailConfirmation: false };
  }
  // Projeto com confirmação de e-mail ativada: usuário criado, mas sem sessão ainda.
  return { needsEmailConfirmation: true };
}

export async function signIn(email, password) {
  const res = await authFetch(`${AUTH_URL}/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(friendlyAuthError(data));
  saveSession(data);
  return data.user;
}

export async function signOut() {
  const session = readSession();
  localStorage.removeItem(SESSION_KEY);
  if (session?.access_token) {
    try {
      await fetch(`${AUTH_URL}/logout`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // Sessão local já foi limpa — falha na chamada de logout remoto não é crítica.
    }
  }
}

async function refreshSession(session) {
  let res;
  try {
    res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
  } catch {
    // Falha de rede passageira: mantém a sessão atual em vez de deslogar.
    return session;
  }
  if (!res.ok) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  const data = await res.json();
  saveSession(data);
  return readSession();
}

// Garante um access_token válido, renovando com o refresh_token se estiver
// perto de expirar. Retorna null se não há sessão (usuário deslogado).
export async function getValidSession() {
  let session = readSession();
  if (!session) return null;
  const almostExpired = session.expires_at_ms - Date.now() < 60000; // < 1 min
  if (almostExpired) {
    session = await refreshSession(session);
  }
  return session;
}

export function getCachedUser() {
  return readSession()?.user || null;
}

export function isLoggedIn() {
  return !!readSession();
}
