// Alterna entre modo claro e escuro. É uma preferência de exibição do
// aparelho (localStorage), não um dado de estudo — por isso não sincroniza
// com a conta/Supabase, só fica salva no navegador local.
const THEME_KEY = "estudamais_theme";

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage indisponível (ex.: modo privado) — tema só não persiste
  }
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
