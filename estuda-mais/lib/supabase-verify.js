// Verifica, no servidor, se um access_token do Supabase é válido — usado
// para exigir login antes de gastar crédito da API da Groq. Só chama a API
// pública de Auth do Supabase (GoTrue), sem precisar de SDK.
export async function verifyUser(authorizationHeader, supabaseUrl, supabaseAnonKey) {
  const token = (authorizationHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}
