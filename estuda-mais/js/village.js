// Motor de progressão de "Sua Vila" — o RPG de estudos. Cada construção
// sobe de nível a partir de dados que o app já guarda (resumos, flashcards,
// questões, blocos de foco, sequência de dias): nada aqui fica armazenado à
// parte, tudo é derivado do estado do store, recalculado a cada render.
import { store } from "./store.js";

// Curva de XP de RPG clássico — cada nível pede mais que o anterior.
function levelFromXp(xp) {
  let level = 1;
  let threshold = 0;
  let next = 60;
  while (xp >= next) {
    level++;
    threshold = next;
    next = Math.round(next * 1.35 + 40);
  }
  const span = next - threshold;
  const progress = span > 0 ? Math.min(1, (xp - threshold) / span) : 1;
  return { level, xp, xpIntoLevel: xp - threshold, xpForNext: span, progress };
}

// As 5 construções — cada uma "pertence" a uma função do app (fecha o
// pedido de que nenhuma função fique solta: usar Resumos, Flashcards,
// Questões ou Foco sempre alimenta a mesma vila/personagem).
export const BUILDINGS = [
  {
    id: "biblioteca",
    name: "Biblioteca",
    attr: "Conhecimento",
    icon: "fileText",
    route: "resumos",
    blurb: "Cresce a cada resumo escrito.",
    xp: () => store.state.summaries.length * 20,
  },
  {
    id: "torre",
    name: "Torre da Memória",
    attr: "Memória",
    icon: "layers",
    route: "flashcards",
    blurb: "Cresce revisando flashcards.",
    xp: () => {
      const cards = store.state.flashcards;
      const reviews = cards.reduce((sum, c) => sum + (c.srs?.reviewsCount || 0), 0);
      const lapses = cards.reduce((sum, c) => sum + (c.srs?.lapses || 0), 0);
      return reviews * 5 + Math.max(0, reviews - lapses) * 3;
    },
  },
  {
    id: "arena",
    name: "Arena",
    attr: "Estratégia",
    icon: "helpCircle",
    route: "questoes",
    blurb: "Cresce respondendo questões, acertar vale mais.",
    xp: () => {
      const attempts = store.state.questionAttempts;
      const correct = attempts.filter((a) => a.correct).length;
      return attempts.length * 4 + correct * 6;
    },
  },
  {
    id: "posto",
    name: "Posto de Foco",
    attr: "Foco",
    icon: "flame",
    route: "foco",
    blurb: "Cresce com blocos de foco completos.",
    xp: () => (store.state.city || []).reduce((sum, s) => sum + (s.minutes || 0), 0) * 2,
  },
  {
    id: "praca",
    name: "Praça Central",
    attr: "Disciplina",
    icon: "trendingUp",
    route: "desempenho",
    blurb: "Cresce batendo metas e mantendo sequência.",
    xp: () => {
      const goal = store.state.dailyGoal || 10;
      const daysWithGoal = Object.values(store.state.dailyLog || {}).filter((d) => d.total >= goal).length;
      return daysWithGoal * 15 + store.currentStreak() * 5;
    },
  },
];

const CLASS_BY_ATTR = {
  Conhecimento: "Erudito(a)",
  Memória: "Memorista",
  Estratégia: "Estrategista",
  Foco: "Guardião(ã) do Foco",
  Disciplina: "Sentinela",
};

// Estado completo da vila+personagem pra uma renderização — cada construção
// com seu nível/XP, o personagem (soma de tudo) e a classe que emerge do
// atributo mais forte.
export function villageState() {
  const buildings = BUILDINGS.map((b) => ({ ...b, ...levelFromXp(b.xp()) }));
  const totalXp = buildings.reduce((sum, b) => sum + b.xp, 0);
  const character = levelFromXp(totalXp);
  const top = buildings.reduce((best, b) => (b.level > best.level ? b : best), buildings[0]);
  const className = totalXp > 0 ? CLASS_BY_ATTR[top.attr] : "Aventureiro(a) iniciante";
  return { buildings, character, className, topAttr: top.attr };
}
