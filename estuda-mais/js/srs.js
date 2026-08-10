// Regra de revisão espaçada do MVP: simples, explicável, válida para os 3 modos de estudo.
// Errou hoje -> volta em 1 dia. Acertou hoje -> progressão 2, 4, 8, 15, 30, 45, 60 dias.
export const SRS_SEQUENCE = [2, 4, 8, 15, 30, 45, 60];

function todayAtMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

export function newSrsState() {
  return { stepIndex: -1, dueDate: toDateStr(todayAtMidnight()), lastResult: null, reviewsCount: 0, lastReviewedAt: null };
}

export function scheduleNext(card, result) {
  const today = todayAtMidnight();
  if (result === "errou") {
    card.srs.stepIndex = -1;
    const due = new Date(today);
    due.setDate(due.getDate() + 1);
    card.srs.dueDate = toDateStr(due);
  } else {
    card.srs.stepIndex = Math.min(card.srs.stepIndex + 1, SRS_SEQUENCE.length - 1);
    const days = SRS_SEQUENCE[card.srs.stepIndex];
    const due = new Date(today);
    due.setDate(due.getDate() + days);
    card.srs.dueDate = toDateStr(due);
  }
  card.srs.lastResult = result;
  card.srs.reviewsCount = (card.srs.reviewsCount || 0) + 1;
  card.srs.lastReviewedAt = new Date().toISOString();
  return card;
}

export function isDueToday(card) {
  return card.srs.dueDate <= toDateStr(todayAtMidnight());
}

export function nextIntervalLabel(card) {
  return card.srs.stepIndex < 0 ? "novo" : `${SRS_SEQUENCE[card.srs.stepIndex]}d`;
}
