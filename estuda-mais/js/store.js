import { newSrsState } from "./srs.js";
import { showToast } from "./ui-utils.js";
import * as db from "./db.js";
import { MODE_TAG } from "./modes.js";

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function emptyState() {
  return {
    onboarded: false,
    modes: [],
    profile: { name: "", studyArea: "", level: "", dailyTimeMinutes: null },
    folders: [],
    summaries: [],
    flashcards: [],
    questions: [],
    questionAttempts: [],
    dailyGoal: 10,
    dailyLog: {},
    checklists: { day: {}, week: {}, month: {} },
    city: [],
    ui: {
      route: "dashboard",
      activeFolderId: null,
      activeSummaryId: null,
      activeDeckId: null,
      reviewing: false,
      practicing: false,
      activeQuestionFolderId: null,
      questionFilter: "all",
    },
  };
}

// ---- Conversão entre o formato do app (camelCase) e as tabelas do banco
// (snake_case). Mantém store.js como a única peça que sabe desse mapeamento
// — o resto do app continua lendo store.state exatamente como antes. ----
const mapFolder = {
  toDb: (f, userId) => ({ id: f.id, user_id: userId, name: f.name, parent_id: f.parentId, kind: f.kind || "pasta", mode: f.mode || null }),
  fromDb: (r) => ({ id: r.id, name: r.name, parentId: r.parent_id, kind: r.kind || "pasta", mode: r.mode || null }),
};
const mapSummary = {
  toDb: (s, userId) => ({
    id: s.id,
    user_id: userId,
    folder_id: s.folderId,
    title: s.title,
    content_html: s.contentHtml,
    page_style: s.pageStyle,
    font_family: s.fontFamily,
    line_spacing: s.lineSpacing,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }),
  fromDb: (r) => ({
    id: r.id,
    folderId: r.folder_id,
    title: r.title,
    contentHtml: r.content_html,
    pageStyle: r.page_style,
    fontFamily: r.font_family || "padrao",
    lineSpacing: r.line_spacing || "media",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),
};
const mapCard = {
  toDb: (c, userId) => ({
    id: c.id,
    user_id: userId,
    folder_id: c.folderId,
    front: c.front,
    back: c.back,
    hint: c.hint,
    summary_id: c.summaryId,
    created_at: c.createdAt,
    srs: c.srs,
  }),
  fromDb: (r) => ({
    id: r.id,
    folderId: r.folder_id,
    front: r.front,
    back: r.back,
    hint: r.hint,
    summaryId: r.summary_id,
    createdAt: r.created_at,
    srs: r.srs,
  }),
};
const mapQuestion = {
  toDb: (q, userId) => ({
    id: q.id,
    user_id: userId,
    folder_id: q.folderId,
    statement: q.statement,
    alternatives: q.alternatives,
    correct_id: q.correctId,
    institution: q.institution,
    year: q.year,
    difficulty: q.difficulty,
    favorite: q.favorite,
    comment: q.comment,
    created_at: q.createdAt,
  }),
  fromDb: (r) => ({
    id: r.id,
    folderId: r.folder_id,
    statement: r.statement,
    alternatives: r.alternatives,
    correctId: r.correct_id,
    institution: r.institution,
    year: r.year,
    difficulty: r.difficulty,
    favorite: r.favorite,
    comment: r.comment,
    createdAt: r.created_at,
  }),
};
const mapAttempt = {
  toDb: (a, userId) => ({ id: a.id, user_id: userId, question_id: a.questionId, chosen_id: a.chosenId, correct: a.correct, at: a.at }),
  fromDb: (r) => ({ id: r.id, questionId: r.question_id, chosenId: r.chosen_id, correct: r.correct, at: r.at }),
};

function reportSyncError(action, err) {
  showToast(`Não foi possível ${action} na nuvem: ${err.message}`, "alertCircle");
}

class Store {
  constructor() {
    this.state = emptyState();
    this.listeners = new Set();
    this.userId = null;
    this.session = null;
    this.hydrated = false;
  }

  // Chamado no logout, para não deixar os dados de um usuário visíveis por
  // um instante quando outra pessoa loga em seguida na mesma aba.
  reset() {
    this.state = emptyState();
    this.userId = null;
    this.session = null;
    this.hydrated = false;
  }

  localCacheKey() {
    return `estuda-mais:v2:${this.userId}`;
  }

  // Guardado direto no localStorage (fora do state que é reconstruído no
  // hydrate()) só pra saber se a pessoa pulou um dia sem revisar flashcard —
  // não precisa sincronizar entre dispositivos, é só um lembrete local.
  flashcardStreakKey() {
    return `estuda-mais:last-flashcard-day:${this.userId}`;
  }
  markFlashcardReviewedToday() {
    try {
      localStorage.setItem(this.flashcardStreakKey(), dayKey(new Date()));
    } catch {
      // não crítico
    }
  }
  // true se a pessoa já revisou flashcard alguma vez, mas não ontem nem hoje
  // (ou seja, pulou pelo menos um dia inteiro sem revisar).
  missedFlashcardDay() {
    try {
      const last = localStorage.getItem(this.flashcardStreakKey());
      if (!last) return false;
      const todayKey = dayKey(new Date());
      const yesterdayKey = dayKey(new Date(Date.now() - 86400000));
      return last !== todayKey && last !== yesterdayKey;
    } catch {
      return false;
    }
  }
  // Lista de avisos pro sininho de notificações no topo do app.
  getNotifications() {
    const list = [];
    if (this.missedFlashcardDay()) {
      list.push({
        id: "missed-day",
        icon: "flame",
        title: "Você pulou um dia sem revisar flashcards.",
        desc: "Retome agora pra não perder o ritmo.",
        route: "flashcards",
      });
    }
    const dueToday = this.cardsDueToday().length;
    if (dueToday > 0) {
      list.push({
        id: "due-today",
        icon: "repeat",
        title: `${dueToday} flashcard${dueToday === 1 ? "" : "s"} para revisar hoje.`,
        desc: "Bora manter a sequência em dia.",
        route: "flashcards",
      });
    }
    return list;
  }

  save() {
    if (this.userId) {
      try {
        localStorage.setItem(this.localCacheKey(), JSON.stringify(this.state));
      } catch {
        // localStorage cheio/indisponível — não é crítico, o banco continua sendo a fonte real.
      }
    }
    this.listeners.forEach((fn) => fn(this.state));
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  loadLocalCache() {
    try {
      const raw = localStorage.getItem(this.localCacheKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // Busca todos os dados do usuário logado no Supabase e monta o estado do
  // app a partir do banco. Chamado uma vez, logo após o login.
  async hydrate(session) {
    this.session = session;
    this.userId = session.user.id;
    try {
      const [profileRows, folderRows, summaryRows, cardRows, questionRows, attemptRows, dailyRows, checklistRows, cityRows] = await Promise.all([
        db.selectAll("profiles", session),
        db.selectAll("folders", session),
        db.selectAll("summaries", session),
        db.selectAll("flashcards", session),
        db.selectAll("questions", session),
        db.selectAll("question_attempts", session),
        db.selectAll("daily_log", session),
        db.selectAll("checklists", session),
        db.selectAll("city_buildings", session),
      ]);

      const profileRow = profileRows[0] || null;
      const dailyLog = {};
      dailyRows.forEach((r) => {
        dailyLog[r.day] = { total: r.total, correct: r.correct, minutes: r.minutes };
      });
      const checklists = { day: {}, week: {}, month: {} };
      checklistRows.forEach((r) => {
        if (!checklists[r.period]) checklists[r.period] = {};
        checklists[r.period][r.period_key] = r.items || [];
      });
      const city = cityRows
        .map((r) => ({ id: r.id, kind: r.kind, minutes: r.minutes, builtAt: r.built_at }))
        .sort((a, b) => (a.builtAt || "").localeCompare(b.builtAt || ""));

      this.state = {
        onboarded: profileRow?.onboarded || false,
        modes: profileRow?.modes || [],
        profile: {
          name: profileRow?.name || "",
          studyArea: profileRow?.study_area || "",
          level: profileRow?.level || "",
          dailyTimeMinutes: profileRow?.daily_time_minutes ?? null,
        },
        folders: folderRows.map(mapFolder.fromDb),
        summaries: summaryRows.map(mapSummary.fromDb),
        flashcards: cardRows.map(mapCard.fromDb),
        questions: questionRows.map(mapQuestion.fromDb),
        questionAttempts: attemptRows.map(mapAttempt.fromDb),
        dailyGoal: profileRow?.daily_goal ?? 10,
        dailyLog,
        checklists,
        city,
        ui: emptyState().ui,
      };
      this.hydrated = true;
      this.save();
    } catch (err) {
      const cached = this.loadLocalCache();
      if (cached) {
        // Mescla com o estado vazio padrão pra cobrir campos novos (ex.: checklists,
        // city) que uma cópia local salva antes dessas features não teria.
        this.state = { ...emptyState(), ...cached, ui: cached.ui || emptyState().ui };
        showToast("Sem conexão com o banco. Mostrando a última cópia salva neste navegador.", "alertCircle");
      } else {
        showToast("Sem conexão com o banco. Verifique sua internet e recarregue a página.", "alertCircle");
      }
      this.hydrated = true;
    }
  }

  // ---- Folders ----
  // kind: "pasta" (padrão) ou "caderno" — mesma estrutura de pasta, só muda o
  // ícone/rótulo. Usado principalmente a partir da tela de Resumos.
  addFolder(name, parentId = null, kind = "pasta") {
    const folder = { id: uid("f"), name, parentId, kind };
    this.state.folders.push(folder);
    this.save();
    db.insertRow("folders", mapFolder.toDb(folder, this.userId), this.session).catch((err) => reportSyncError("salvar a pasta", err));
    return folder;
  }
  // patch aceita { name, mode } — usado hoje só pra "migrar pra outra Ala"
  // (o campo mode), mas fica genérico pra qualquer edição futura de pasta.
  updateFolder(folderId, patch) {
    const f = this.state.folders.find((x) => x.id === folderId);
    if (!f) return;
    Object.assign(f, patch);
    this.save();
    db.updateRow("folders", folderId, mapFolder.toDb(f, this.userId), this.session).catch((err) => reportSyncError("salvar a pasta", err));
  }
  folderPath(folderId) {
    const names = [];
    let current = this.state.folders.find((f) => f.id === folderId);
    while (current) {
      names.unshift(current.name);
      current = this.state.folders.find((f) => f.id === current.parentId);
    }
    return names.join(" > ");
  }
  childFolders(parentId) {
    return this.state.folders.filter((f) => f.parentId === parentId);
  }
  flattenFolders() {
    const roots = this.state.folders.filter((f) => !f.parentId);
    const result = [];
    const walk = (f, depth) => {
      result.push({ ...f, depth });
      this.childFolders(f.id).forEach((c) => walk(c, depth + 1));
    };
    roots.forEach((r) => walk(r, 0));
    return result;
  }
  descendantFolderIds(folderId) {
    const ids = [folderId];
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of this.state.folders) {
        if (ids.includes(f.parentId) && !ids.includes(f.id)) {
          ids.push(f.id);
          changed = true;
        }
      }
    }
    return ids;
  }
  // Apaga a pasta, suas subpastas e tudo que vive dentro delas (resumos,
  // flashcards, questões e tentativas). No banco, "on delete cascade" cuida
  // de tudo a partir da linha da pasta raiz — aqui só espelhamos isso no
  // estado local pra tela atualizar na hora.
  deleteFolder(folderId) {
    const ids = new Set(this.descendantFolderIds(folderId));
    const removedQuestionIds = new Set(this.state.questions.filter((q) => ids.has(q.folderId)).map((q) => q.id));
    this.state.folders = this.state.folders.filter((f) => !ids.has(f.id));
    this.state.summaries = this.state.summaries.filter((s) => !ids.has(s.folderId));
    this.state.flashcards = this.state.flashcards.filter((c) => !ids.has(c.folderId));
    this.state.questions = this.state.questions.filter((q) => !ids.has(q.folderId));
    this.state.questionAttempts = this.state.questionAttempts.filter((a) => !removedQuestionIds.has(a.questionId));
    if (ids.has(this.state.ui.activeFolderId)) this.state.ui.activeFolderId = null;
    if (ids.has(this.state.ui.activeDeckId)) this.state.ui.activeDeckId = null;
    if (ids.has(this.state.ui.activeQuestionFolderId)) this.state.ui.activeQuestionFolderId = null;
    if (this.state.ui.activeSummaryId && !this.state.summaries.some((s) => s.id === this.state.ui.activeSummaryId)) {
      this.state.ui.activeSummaryId = null;
    }
    this.save();
    db.deleteRow("folders", folderId, this.session).catch((err) => reportSyncError("excluir a pasta", err));
  }

  // ---- Summaries ----
  addSummary(folderId, title = "Novo resumo") {
    const summary = {
      id: uid("s"),
      folderId,
      title,
      contentHtml: "",
      pageStyle: "minimal",
      fontFamily: "padrao",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.summaries.push(summary);
    this.save();
    db.insertRow("summaries", mapSummary.toDb(summary, this.userId), this.session).catch((err) => reportSyncError("salvar o resumo", err));
    return summary;
  }
  updateSummary(id, patch) {
    const s = this.state.summaries.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    this.save();
    db.updateRow("summaries", id, mapSummary.toDb(s, this.userId), this.session).catch((err) => reportSyncError("salvar o resumo", err));
  }
  // Persiste sem notificar os listeners: usado nos handlers de digitação
  // (título/editor) para nunca reconstruir o DOM enquanto o usuário digita.
  // O erro é silencioso aqui de propósito (dispara a cada pausa na digitação);
  // updateSummary (chamado no blur) tenta de novo e avisa se continuar falhando.
  patchSummarySilent(id, patch) {
    const s = this.state.summaries.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    if (this.userId) {
      try {
        localStorage.setItem(this.localCacheKey(), JSON.stringify(this.state));
      } catch {
        // não crítico
      }
    }
    db.updateRow("summaries", id, mapSummary.toDb(s, this.userId), this.session).catch(() => {});
  }
  deleteSummary(id) {
    this.state.summaries = this.state.summaries.filter((s) => s.id !== id);
    this.save();
    db.deleteRow("summaries", id, this.session).catch((err) => reportSyncError("excluir o resumo", err));
  }
  summariesInFolder(folderId) {
    return this.state.summaries.filter((s) => s.folderId === folderId);
  }
  flashcardCountForSummary(summaryId) {
    return this.state.flashcards.filter((fc) => fc.summaryId === summaryId).length;
  }

  // ---- Flashcards ----
  addFlashcard({ folderId, front, back, hint = "", summaryId = null, tags = [] }) {
    const card = {
      id: uid("fc"),
      folderId,
      front,
      back,
      hint,
      summaryId,
      tags,
      createdAt: new Date().toISOString(),
      srs: newSrsState(),
    };
    this.state.flashcards.push(card);
    this.save();
    db.insertRow("flashcards", mapCard.toDb(card, this.userId), this.session).catch((err) => reportSyncError("salvar o flashcard", err));
    return card;
  }
  // Usado pela importação de .apkg (e qualquer outra fonte que precise
  // criar muitos cards de uma vez) — um só save()/re-render local e o
  // envio pro banco em lotes, em vez de uma chamada de rede por card.
  // Cada item aceita os mesmos campos de addFlashcard, mais `srs` e
  // `createdAt` opcionais (pra já nascer com estado/data histórica, no
  // caso da importação reconstruir o histórico de revisão do Anki).
  addFlashcardsBulk(cards) {
    const withIds = cards.map((c) => ({
      id: uid("fc"),
      folderId: c.folderId,
      front: c.front,
      back: c.back,
      hint: c.hint || "",
      summaryId: c.summaryId || null,
      tags: c.tags || [],
      createdAt: c.createdAt || new Date().toISOString(),
      srs: c.srs || newSrsState(),
    }));
    this.state.flashcards.push(...withIds);
    this.save();
    const BATCH = 300;
    const rows = withIds.map((c) => mapCard.toDb(c, this.userId));
    for (let i = 0; i < rows.length; i += BATCH) {
      db.insertRows("flashcards", rows.slice(i, i + BATCH), this.session).catch((err) => reportSyncError("salvar os flashcards importados", err));
    }
    return withIds;
  }
  updateFlashcard(id, patch) {
    const c = this.state.flashcards.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    this.save();
    db.updateRow("flashcards", id, mapCard.toDb(c, this.userId), this.session).catch((err) => reportSyncError("salvar o flashcard", err));
  }
  deleteFlashcard(id) {
    this.state.flashcards = this.state.flashcards.filter((c) => c.id !== id);
    this.save();
    db.deleteRow("flashcards", id, this.session).catch((err) => reportSyncError("excluir o flashcard", err));
  }
  cardsInFolder(folderId) {
    return this.state.flashcards.filter((c) => c.folderId === folderId);
  }
  cardsDueToday(folderId = null) {
    const todayStr = new Date().toISOString().slice(0, 10);
    return this.state.flashcards.filter(
      (c) => c.srs.dueDate <= todayStr && (folderId ? c.folderId === folderId : true)
    );
  }

  // ---- Questões ----
  addQuestion(data) {
    const question = {
      id: uid("q"),
      folderId: data.folderId,
      statement: data.statement,
      alternatives: data.alternatives,
      correctId: data.correctId,
      institution: data.institution || "",
      year: data.year || null,
      difficulty: data.difficulty || "medio",
      favorite: false,
      comment: data.comment || null,
      createdAt: new Date().toISOString(),
    };
    this.state.questions.push(question);
    this.save();
    db.insertRow("questions", mapQuestion.toDb(question, this.userId), this.session).catch((err) => reportSyncError("salvar a questão", err));
    return question;
  }
  updateQuestion(id, patch) {
    const q = this.state.questions.find((x) => x.id === id);
    if (!q) return;
    Object.assign(q, patch);
    this.save();
    db.updateRow("questions", id, mapQuestion.toDb(q, this.userId), this.session).catch((err) => reportSyncError("salvar a questão", err));
  }
  deleteQuestion(id) {
    this.state.questions = this.state.questions.filter((q) => q.id !== id);
    this.state.questionAttempts = this.state.questionAttempts.filter((a) => a.questionId !== id);
    this.save();
    // question_attempts tem "on delete cascade" no banco — apagar a questão já limpa as tentativas.
    db.deleteRow("questions", id, this.session).catch((err) => reportSyncError("excluir a questão", err));
  }
  toggleFavoriteQuestion(id) {
    const q = this.state.questions.find((x) => x.id === id);
    if (!q) return;
    q.favorite = !q.favorite;
    this.save();
    db.updateRow("questions", id, { favorite: q.favorite }, this.session).catch((err) => reportSyncError("salvar o favorito", err));
  }
  questionsInFolder(folderId) {
    return this.state.questions.filter((q) => q.folderId === folderId);
  }
  favoriteQuestions() {
    return this.state.questions.filter((q) => q.favorite);
  }
  attemptsForQuestion(questionId) {
    return this.state.questionAttempts.filter((a) => a.questionId === questionId);
  }
  lastAttemptForQuestion(questionId) {
    const attempts = this.attemptsForQuestion(questionId);
    return attempts.length ? attempts[attempts.length - 1] : null;
  }
  wrongQuestions() {
    return this.state.questions.filter((q) => {
      const last = this.lastAttemptForQuestion(q.id);
      return last && !last.correct;
    });
  }
  recordAttempt(questionId, chosenId) {
    const question = this.state.questions.find((q) => q.id === questionId);
    if (!question) return null;
    const correct = chosenId === question.correctId;
    const attempt = { id: uid("qa"), questionId, chosenId, correct, at: new Date().toISOString() };
    this.state.questionAttempts.push(attempt);
    db.insertRow("question_attempts", mapAttempt.toDb(attempt, this.userId), this.session).catch((err) => reportSyncError("salvar a tentativa", err));
    this.logStudyDay({ correct });
    return attempt;
  }
  // Ranking de assuntos: mais cobrados (nº de questões) e com maior taxa de erro.
  topicQuestionStats() {
    return this.flattenFolders()
      .map((f) => {
        const questions = this.questionsInFolder(f.id);
        const attempts = questions.flatMap((q) => this.attemptsForQuestion(q.id));
        const wrong = attempts.filter((a) => !a.correct).length;
        return {
          folderId: f.id,
          name: f.name,
          path: this.folderPath(f.id),
          totalQuestions: questions.length,
          totalAttempts: attempts.length,
          errorRate: attempts.length ? wrong / attempts.length : 0,
        };
      })
      .filter((s) => s.totalQuestions > 0);
  }
  // Alternativas mais confundidas: para cada questão com erros, qual alternativa errada foi mais marcada.
  confusionRanking(limit = 5) {
    return this.state.questions
      .map((q) => {
        const wrongAttempts = this.attemptsForQuestion(q.id).filter((a) => !a.correct);
        if (wrongAttempts.length === 0) return null;
        const tally = {};
        wrongAttempts.forEach((a) => (tally[a.chosenId] = (tally[a.chosenId] || 0) + 1));
        const [mostChosenId, count] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
        const altText = q.alternatives.find((alt) => alt.id === mostChosenId)?.text || "";
        return { questionId: q.id, statement: q.statement, mostChosenId, count, altText, folderId: q.folderId };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // ---- Desempenho ----
  logStudyDay({ correct, minutes = 0 } = {}) {
    const key = dayKey(new Date());
    const day = this.state.dailyLog[key] || (this.state.dailyLog[key] = { total: 0, correct: 0, minutes: 0 });
    if (correct !== undefined && correct !== null) {
      day.total += 1;
      if (correct) day.correct += 1;
    }
    if (minutes) day.minutes += minutes;
    this.save();
    db.upsertRow("daily_log", { user_id: this.userId, day: key, ...day }, this.session, "user_id,day").catch((err) =>
      reportSyncError("salvar o progresso do dia", err)
    );
  }
  addStudyMinutes(n) {
    this.logStudyDay({ minutes: n });
  }
  last14Days() {
    const out = [];
    for (let n = 13; n >= 0; n--) {
      const date = new Date(Date.now() - n * 86400000);
      const key = dayKey(date);
      const day = this.state.dailyLog[key] || { total: 0, correct: 0, minutes: 0 };
      out.push({ date: key, ...day, accuracy: day.total ? Math.round((day.correct / day.total) * 100) : 0 });
    }
    return out;
  }
  currentStreak() {
    let streak = 0;
    for (let n = 0; ; n++) {
      const key = dayKey(new Date(Date.now() - n * 86400000));
      const day = this.state.dailyLog[key];
      if (day && day.total > 0) streak++;
      else break;
    }
    return streak;
  }
  bestStreak() {
    const keys = Object.keys(this.state.dailyLog)
      .filter((k) => this.state.dailyLog[k].total > 0)
      .sort();
    let best = 0;
    let current = 0;
    let prevTime = null;
    for (const k of keys) {
      const t = new Date(k + "T00:00:00").getTime();
      if (prevTime !== null && t - prevTime === 86400000) current += 1;
      else current = 1;
      best = Math.max(best, current);
      prevTime = t;
    }
    return Math.max(best, this.currentStreak());
  }
  totalStudyMinutes() {
    return Object.values(this.state.dailyLog).reduce((sum, d) => sum + (d.minutes || 0), 0);
  }
  overallAccuracy() {
    const totals = Object.values(this.state.dailyLog).reduce(
      (acc, d) => ({ total: acc.total + d.total, correct: acc.correct + d.correct }),
      { total: 0, correct: 0 }
    );
    return totals.total ? Math.round((totals.correct / totals.total) * 100) : null;
  }
  bestDay() {
    const entries = Object.entries(this.state.dailyLog).filter(([, d]) => d.total > 0);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1].correct - a[1].correct);
    return { date: entries[0][0], ...entries[0][1] };
  }
  setDailyGoal(n) {
    this.state.dailyGoal = Math.max(1, Math.round(n));
    this.save();
    db.updateRow("profiles", this.userId, { daily_goal: this.state.dailyGoal }, this.session, "id").catch((err) =>
      reportSyncError("salvar a meta diária", err)
    );
  }
  todayProgress() {
    const key = dayKey(new Date());
    const day = this.state.dailyLog[key] || { total: 0 };
    return { done: day.total, goal: this.state.dailyGoal };
  }
  // Combina flashcards (último resultado) e questões (tentativas) por assunto,
  // para achar assuntos mais errados e assuntos dominados.
  topicMasteryStats() {
    return this.flattenFolders()
      .map((f) => {
        const cards = this.cardsInFolder(f.id).filter((c) => c.srs.lastResult);
        const cardsWrong = cards.filter((c) => c.srs.lastResult === "errou").length;
        const questions = this.questionsInFolder(f.id);
        const attempts = questions.flatMap((q) => this.attemptsForQuestion(q.id));
        const qWrong = attempts.filter((a) => !a.correct).length;
        const total = cards.length + attempts.length;
        const wrong = cardsWrong + qWrong;
        return { folderId: f.id, name: f.name, path: this.folderPath(f.id), total, errorRate: total ? wrong / total : 0 };
      })
      .filter((s) => s.total > 0);
  }

  // ---- Checklists (calendário do painel + metas do dia/semana/mês) ----
  // period: "day" | "week" | "month". key: "2026-08-09" | "2026-W32" | "2026-08".
  // Os itens do dia de hoje (period="day") são os mesmos usados na coluna
  // "Hoje" do painel de metas — mesma fonte de dado, dois lugares na tela.
  weekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  getChecklist(period, key) {
    return (this.state.checklists[period] && this.state.checklists[period][key]) || [];
  }
  saveChecklist(period, key, items) {
    if (!this.state.checklists[period]) this.state.checklists[period] = {};
    this.state.checklists[period][key] = items;
    this.save();
    db.upsertRow("checklists", { user_id: this.userId, period, period_key: key, items }, this.session, "user_id,period,period_key").catch((err) =>
      reportSyncError("salvar o checklist", err)
    );
  }
  addChecklistItem(period, key, text) {
    if (!text.trim()) return;
    this.saveChecklist(period, key, [...this.getChecklist(period, key), { id: uid("ci"), text: text.trim(), status: "pending" }]);
  }
  // status: "pending" (ainda não marcado) | "done" (check) | "missed" (x).
  // Clicar de novo no mesmo marcador volta pra "pending" (permite corrigir).
  setChecklistItemStatus(period, key, itemId, status) {
    const items = this.getChecklist(period, key).map((it) => (it.id === itemId ? { ...it, status: it.status === status ? "pending" : status } : it));
    this.saveChecklist(period, key, items);
  }
  deleteChecklistItem(period, key, itemId) {
    this.saveChecklist(
      period,
      key,
      this.getChecklist(period, key).filter((it) => it.id !== itemId)
    );
  }

  // ---- Log de sessões de foco (Pomodoro) — cada bloco de estudo concluído
  // vira uma linha aqui, usada pras estatísticas da tela de Foco (sessões,
  // minutos, sequência de dias). Os nomes "city"/"building"/"kind" são
  // resquício de uma versão antiga com tema de cidade; mantidos porque já
  // batem com a tabela criada no banco (mudar exigiria migração).
  addCityBuilding(minutes) {
    const building = {
      id: uid("city"),
      kind: "predio",
      minutes,
      builtAt: new Date().toISOString(),
    };
    this.state.city.push(building);
    this.save();
    db.insertRow(
      "city_buildings",
      { id: building.id, user_id: this.userId, kind: building.kind, minutes, built_at: building.builtAt },
      this.session
    ).catch((err) => reportSyncError("salvar a sessão de foco", err));
    return building;
  }

  completeOnboarding({ modes, profile, materias }) {
    this.state.modes = modes;
    this.state.profile = profile;
    const newFolders = [];
    (materias || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((name) => {
        const exists = this.state.folders.some((f) => !f.parentId && f.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
          const folder = { id: uid("f"), name, parentId: null };
          this.state.folders.push(folder);
          newFolders.push(folder);
        }
      });
    // "Matérias" é opcional no onboarding — mas terminar sem nenhum assunto
    // criado é um beco sem saída: Resumos, Flashcards, Questões e Upload
    // dependem de ter pelo menos uma pasta pra salvar o material em. Garante
    // um ponto de partida mesmo se a pessoa pular esse campo.
    if (this.state.folders.length === 0) {
      const fallbackName = profile.studyArea?.trim() || MODE_TAG[modes[0]] || "Meus estudos";
      const folder = { id: uid("f"), name: fallbackName, parentId: null };
      this.state.folders.push(folder);
      newFolders.push(folder);
    }
    this.state.onboarded = true;
    this.save();

    const profileRow = {
      id: this.userId,
      modes,
      name: profile.name || "",
      study_area: profile.studyArea || "",
      level: profile.level || "",
      daily_time_minutes: profile.dailyTimeMinutes ?? null,
      onboarded: true,
      daily_goal: this.state.dailyGoal,
    };
    db.upsertRow("profiles", profileRow, this.session, "id").catch((err) => reportSyncError("salvar seu perfil", err));
    newFolders.forEach((folder) => {
      db.insertRow("folders", mapFolder.toDb(folder, this.userId), this.session).catch((err) => reportSyncError("salvar a pasta", err));
    });
  }
  updateProfile(patch) {
    this.state.profile = { ...this.state.profile, ...patch };
    this.save();
    db.updateRow(
      "profiles",
      this.userId,
      {
        name: this.state.profile.name || "",
        study_area: this.state.profile.studyArea || "",
        level: this.state.profile.level || "",
        daily_time_minutes: this.state.profile.dailyTimeMinutes ?? null,
      },
      this.session,
      "id"
    ).catch((err) => reportSyncError("salvar seu perfil", err));
  }
  // Troca as Alas ativas (Concurso/Vestibular/Graduação/Medicina) — usado
  // pelas etiquetas clicáveis na sidebar, sem precisar refazer o onboarding.
  setModes(modes) {
    this.state.modes = modes;
    this.save();
    db.updateRow("profiles", this.userId, { modes }, this.session, "id").catch((err) => reportSyncError("salvar suas Alas", err));
  }

  // ---- Backup ----
  exportData() {
    return JSON.stringify(this.state, null, 2);
  }
  // Substitui TUDO (local e na nuvem) pelo conteúdo do backup. Apaga as
  // tabelas do usuário e reinsere na ordem que respeita as dependências
  // entre elas (pastas antes de resumos/flashcards/questões, questões antes
  // das tentativas) — evita erro de chave estrangeira durante a reinserção.
  async syncFullReplace() {
    if (!this.userId || !this.session) throw new Error("Sem sessão ativa.");
    const s = this.state;
    const { session, userId } = this;

    // Um flashcard pode apontar para um resumo já excluído (o app permite
    // isso hoje) — sem essa limpeza, a reinserção quebraria por causa da
    // chave estrangeira. O mesmo vale para tentativas de questões que não
    // vieram junto no backup.
    const summaryIds = new Set(s.summaries.map((x) => x.id));
    const questionIds = new Set(s.questions.map((x) => x.id));
    const safeCards = s.flashcards.map((c) => (c.summaryId && !summaryIds.has(c.summaryId) ? { ...c, summaryId: null } : c));
    const safeAttempts = s.questionAttempts.filter((a) => questionIds.has(a.questionId));

    await db.deleteRow("question_attempts", userId, session, "user_id");
    await db.deleteRow("questions", userId, session, "user_id");
    await db.deleteRow("flashcards", userId, session, "user_id");
    await db.deleteRow("summaries", userId, session, "user_id");
    await db.deleteRow("folders", userId, session, "user_id");
    await db.deleteRow("daily_log", userId, session, "user_id");

    if (s.folders.length) await db.insertRow("folders", s.folders.map((f) => mapFolder.toDb(f, userId)), session);
    if (s.summaries.length) await db.insertRow("summaries", s.summaries.map((x) => mapSummary.toDb(x, userId)), session);
    if (safeCards.length) await db.insertRow("flashcards", safeCards.map((x) => mapCard.toDb(x, userId)), session);
    if (s.questions.length) await db.insertRow("questions", s.questions.map((x) => mapQuestion.toDb(x, userId)), session);
    if (safeAttempts.length) await db.insertRow("question_attempts", safeAttempts.map((x) => mapAttempt.toDb(x, userId)), session);

    const dailyRows = Object.entries(s.dailyLog || {}).map(([day, d]) => ({
      user_id: userId,
      day,
      total: d.total || 0,
      correct: d.correct || 0,
      minutes: d.minutes || 0,
    }));
    if (dailyRows.length) await db.insertRow("daily_log", dailyRows, session);

    await db.upsertRow(
      "profiles",
      {
        id: userId,
        modes: s.modes || [],
        name: s.profile?.name || "",
        study_area: s.profile?.studyArea || "",
        level: s.profile?.level || "",
        daily_time_minutes: s.profile?.dailyTimeMinutes ?? null,
        onboarded: !!s.onboarded,
        daily_goal: s.dailyGoal || 10,
      },
      session,
      "id"
    );
  }
  async importData(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.folders) || !Array.isArray(parsed.summaries)) {
      throw new Error("Arquivo de backup inválido.");
    }
    this.state = parsed;
    this.save();
    try {
      await this.syncFullReplace();
      showToast("Backup importado e sincronizado com a nuvem.", "check");
    } catch (err) {
      showToast(`Backup importado neste navegador, mas falhou ao sincronizar com a nuvem: ${err.message}`, "alertCircle");
    }
  }

  setRoute(route, extra = {}) {
    this.state.ui = { ...this.state.ui, route, ...extra };
    this.save();
  }
}

export const store = new Store();
export { uid };
