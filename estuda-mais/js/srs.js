// FSRS (Free Spaced Repetition Scheduler) — versão 4.5, a variante mais
// documentada e testada do algoritmo (a mesma que o Anki adotou como padrão
// por um bom tempo). Substitui o SRS antigo de passos fixos (2, 4, 8, 15...
// dias) por um modelo de memória de verdade: cada card tem uma
// "estabilidade" (S, em dias — quanto tempo leva pra retenção cair a 90%) e
// uma "dificuldade" (D, de 1 a 10), que evoluem a cada revisão conforme a
// nota dada (Errei / Difícil / Bom / Fácil).
//
// Referência: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
// Simplificação deliberada em relação ao Anki: este app revisa em granularidade
// de dia (um `dueDate` por dia, sem "passos de aprendizado" de minutos dentro
// do mesmo dia), então intervalos previstos são sempre arredondados pra cima,
// no mínimo 1 dia.

export const GRADES = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
export const GRADE_LABELS = { 1: "Errei", 2: "Difícil", 3: "Bom", 4: "Fácil" };

// Pesos padrão do FSRS-4.5 (17 parâmetros, w0..w16), treinados pela equipe
// do open-spaced-repetition num dataset grande de revisões reais. Um dia a
// gente pode deixar isso "personalizado" por usuário (otimizado a partir do
// próprio histórico), mas o padrão já é bem melhor que passos fixos.
export const DEFAULT_WEIGHTS = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

const DECAY = -0.5;
const FACTOR = 19 / 81; // = 0.9^(1/DECAY) - 1, faz R(t=S) = 90%

export const DEFAULT_REQUEST_RETENTION = 0.9;
// Acordado com a usuária: nenhum algoritmo garante literalmente 100% de
// retenção (exigiria revisar infinitamente); o Modo Preparação de Prova
// capa o valor pedido nesse teto.
export const MAX_PRACTICAL_RETENTION = 0.97;

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function todayAtMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ---------------------------------------------------------------- núcleo --
// Retrievability: probabilidade prevista de lembrar o card hoje, dado
// quanto tempo (em dias) se passou desde a última revisão e a estabilidade atual.
export function forgettingCurve(elapsedDays, stability) {
  const t = Math.max(0, elapsedDays);
  const s = Math.max(0.01, stability);
  return Math.pow(1 + (FACTOR * t) / s, DECAY);
}

// Inverso da curva: quantos dias até a retenção cair pro valor pedido
// (ex.: 0.9 = 90%) — é o que vira o próximo intervalo de revisão.
export function daysForRetention(stability, retention) {
  const s = Math.max(0.01, stability);
  const r = clamp(retention, 0.01, 0.999);
  return (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
}

function initialStability(grade, w) {
  return Math.max(0.1, w[grade - 1]);
}

function initialDifficulty(grade, w) {
  return clamp(w[4] - Math.exp(w[5] * (grade - 1)) + 1, 1, 10);
}

function meanReversionTarget(w) {
  // "Dificuldade inicial se a pessoa tivesse acertado fácil de cara" — é
  // pra onde a dificuldade de todo card tende a regredir um pouco a cada
  // revisão, evitando que um card fique "preso" difícil/fácil demais pra sempre.
  return initialDifficulty(GRADES.EASY, w);
}

function nextDifficulty(prevD, grade, w) {
  const delta = -w[6] * (grade - 3);
  const damped = prevD + (delta * (10 - prevD)) / 9;
  const reverted = w[7] * meanReversionTarget(w) + (1 - w[7]) * damped;
  return clamp(reverted, 1, 10);
}

function nextStabilityOnRecall(difficulty, stability, retrievability, grade, w) {
  const hardPenalty = grade === GRADES.HARD ? w[15] : 1;
  const easyBonus = grade === GRADES.EASY ? w[16] : 1;
  const inc =
    Math.exp(w[8]) * (11 - difficulty) * Math.pow(stability, -w[9]) * (Math.exp(w[10] * (1 - retrievability)) - 1) * hardPenalty * easyBonus;
  return Math.max(0.01, stability * (inc + 1));
}

function nextStabilityOnLapse(difficulty, stability, retrievability, w) {
  const s = w[11] * Math.pow(difficulty, -w[12]) * (Math.pow(stability + 1, w[13]) - 1) * Math.exp(w[14] * (1 - retrievability));
  // A estabilidade pós-erro nunca deve superar a que o card já tinha —
  // esquecer não pode "melhorar" a memória.
  return Math.max(0.01, Math.min(s, stability));
}

// --------------------------------------------------------------- estado ---
export function newSrsState() {
  return {
    state: "new",
    stability: null,
    difficulty: null,
    dueDate: toDateStr(todayAtMidnight()),
    lastResult: null,
    reviewsCount: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

// Agenda a próxima revisão a partir da nota dada (1=Errei, 2=Difícil,
// 3=Bom, 4=Fácil). `opts.requestRetention` deixa o Modo Preparação de Prova
// pedir uma retenção-alvo diferente da padrão (90%) pra um card/baralho
// específico. Muta `card.srs` e devolve o card.
export function scheduleNext(card, grade, opts = {}) {
  const w = opts.weights || DEFAULT_WEIGHTS;
  const retention = clamp(opts.requestRetention ?? DEFAULT_REQUEST_RETENTION, 0.01, MAX_PRACTICAL_RETENTION);
  const now = opts.now || new Date();
  const srs = card.srs;

  let difficulty, stability;
  if (srs.state === "new" || srs.stability == null || srs.difficulty == null) {
    stability = initialStability(grade, w);
    difficulty = initialDifficulty(grade, w);
  } else {
    const elapsed = srs.lastReviewedAt ? daysBetween(new Date(srs.lastReviewedAt), now) : 0;
    const r = forgettingCurve(elapsed, srs.stability);
    difficulty = nextDifficulty(srs.difficulty, grade, w);
    stability = grade === GRADES.AGAIN ? nextStabilityOnLapse(difficulty, srs.stability, r, w) : nextStabilityOnRecall(difficulty, srs.stability, r, grade, w);
  }

  const intervalDays = Math.max(1, Math.round(daysForRetention(stability, retention)));
  const due = new Date(todayAtMidnight());
  due.setDate(due.getDate() + intervalDays);

  srs.state = grade === GRADES.AGAIN ? "relearning" : "review";
  srs.stability = stability;
  srs.difficulty = difficulty;
  srs.dueDate = toDateStr(due);
  srs.lastResult = grade === GRADES.AGAIN ? "errou" : "acertou";
  srs.reviewsCount = (srs.reviewsCount || 0) + 1;
  srs.lapses = (srs.lapses || 0) + (grade === GRADES.AGAIN ? 1 : 0);
  srs.lastReviewedAt = now.toISOString();
  return card;
}

export function isDueToday(card, now = new Date()) {
  return card.srs.dueDate <= toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

// Retenção prevista AGORA para um card já revisado (null se o card é novo,
// já que "novo" ainda não tem curva de esquecimento pra calcular).
export function retrievability(card, now = new Date()) {
  const srs = card.srs;
  if (srs.state === "new" || srs.stability == null || !srs.lastReviewedAt) return null;
  const elapsed = daysBetween(new Date(srs.lastReviewedAt), now);
  return forgettingCurve(elapsed, srs.stability);
}

// Pra mostrar nos 4 botões da revisão (tipo Anki: "1d", "3d", "8d"...) —
// o intervalo que cada nota geraria SE fosse escolhida agora.
export function previewIntervals(card, opts = {}) {
  const w = opts.weights || DEFAULT_WEIGHTS;
  const retention = clamp(opts.requestRetention ?? DEFAULT_REQUEST_RETENTION, 0.01, MAX_PRACTICAL_RETENTION);
  const now = opts.now || new Date();
  const srs = card.srs;
  const isNew = srs.state === "new" || srs.stability == null || srs.difficulty == null;
  const elapsed = !isNew && srs.lastReviewedAt ? daysBetween(new Date(srs.lastReviewedAt), now) : 0;
  const r = isNew ? 1 : forgettingCurve(elapsed, srs.stability);

  const out = {};
  for (const grade of [GRADES.AGAIN, GRADES.HARD, GRADES.GOOD, GRADES.EASY]) {
    let s;
    if (isNew) {
      s = initialStability(grade, w);
    } else {
      const d = nextDifficulty(srs.difficulty, grade, w);
      s = grade === GRADES.AGAIN ? nextStabilityOnLapse(d, srs.stability, r, w) : nextStabilityOnRecall(d, srs.stability, r, grade, w);
    }
    out[grade] = Math.max(1, Math.round(daysForRetention(s, retention)));
  }
  return out;
}

export function intervalLabel(days) {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}m`;
  return `${(days / 365).toFixed(1)}a`;
}
