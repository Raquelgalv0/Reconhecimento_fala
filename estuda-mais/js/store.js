import { newSrsState } from "./srs.js";

const STORAGE_KEY = "estuda-mais:v1";

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function seedState() {
  const folderConst = uid("f");
  const folderControle = uid("f");
  const folderMedFam = uid("f");
  const folderDengue = uid("f");

  const summaryId = uid("s");

  const fc1 = uid("fc");
  const fc2 = uid("fc");
  const fc3 = uid("fc");

  return {
    onboarded: false,
    modes: [],
    folders: [
      { id: folderConst, name: "Direito Constitucional", parentId: null },
      { id: folderControle, name: "Controle de Constitucionalidade", parentId: folderConst },
      { id: folderMedFam, name: "Medicina da Família", parentId: null },
      { id: folderDengue, name: "Doenças Virais", parentId: folderMedFam },
    ],
    summaries: [
      {
        id: summaryId,
        folderId: folderControle,
        title: "Controle de Constitucionalidade",
        contentHtml:
          "<p>O controle de constitucionalidade é o mecanismo que garante a supremacia da Constituição Federal sobre as demais normas do ordenamento jurídico.</p>" +
          `<p><mark class="linked-fc" data-fc-id="${fc1}">A Ação Direta de Inconstitucionalidade (ADI) é o instrumento utilizado para declarar que uma lei ou ato normativo é incompatível com a Constituição Federal.</mark> Ela é julgada originariamente pelo Supremo Tribunal Federal.</p>` +
          "<h3>Legitimados</h3>" +
          "<p>Podem propor ADI, entre outros: o Presidente da República, a Mesa do Senado, a Mesa da Câmara, partidos políticos com representação no Congresso e confederações sindicais.</p>" +
          `<p>Já a <mark class="linked-fc" data-fc-id="${fc2}">Ação Declaratória de Constitucionalidade (ADC) tem o objetivo inverso: confirmar que uma norma é compatível com a Constituição, geralmente usada quando há controvérsia relevante nos tribunais.</mark></p>`,
        createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: uid("s"),
        folderId: folderDengue,
        title: "Sintomas e Diagnóstico da Dengue",
        contentHtml:
          `<p><mark class="linked-fc" data-fc-id="${fc3}">Os sintomas clássicos da dengue incluem febre alta de início súbito, dor de cabeça intensa, dor atrás dos olhos, dores musculares e articulares, além de manchas vermelhas na pele.</mark></p>` +
          "<p>Sinais de alarme exigem atenção imediata: dor abdominal intensa, vômitos persistentes, sangramentos e queda da pressão arterial.</p>",
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ],
    flashcards: [
      {
        id: fc1,
        folderId: folderControle,
        front: "O que é a Ação Direta de Inconstitucionalidade (ADI)?",
        back: "É o instrumento utilizado para declarar que uma lei ou ato normativo é incompatível com a Constituição Federal.",
        hint: "",
        summaryId,
        createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
        srs: { ...newSrsState(), stepIndex: -1, dueDate: new Date().toISOString().slice(0, 10) },
      },
      {
        id: fc2,
        folderId: folderControle,
        front: "Qual o objetivo da Ação Declaratória de Constitucionalidade (ADC)?",
        back: "Confirmar que uma norma é compatível com a Constituição, geralmente usada quando há controvérsia relevante nos tribunais.",
        hint: "",
        summaryId,
        createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
        srs: { ...newSrsState(), stepIndex: 1, dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) },
      },
      {
        id: fc3,
        folderId: folderDengue,
        front: "Quais são os sintomas clássicos da dengue?",
        back: "Febre alta de início súbito, dor de cabeça intensa, dor atrás dos olhos, dores musculares e articulares, além de manchas vermelhas na pele.",
        hint: "",
        summaryId: uid("s"),
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        srs: { ...newSrsState(), stepIndex: -1, dueDate: new Date().toISOString().slice(0, 10) },
      },
      {
        id: uid("fc"),
        folderId: folderDengue,
        front: "Cite dois sinais de alarme da dengue.",
        back: "Dor abdominal intensa e vômitos persistentes (também: sangramentos, queda de pressão).",
        hint: "",
        summaryId: null,
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        srs: { ...newSrsState(), stepIndex: 0, dueDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10) },
      },
    ],
    ...seedQuestionData(folderControle, folderDengue),
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

function seedQuestionData(folderControle, folderDengue) {
  const q1 = uid("q");
  const q2 = uid("q");
  const q3 = uid("q");
  const q4 = uid("q");
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  const attempts = [
    { id: uid("qa"), questionId: q1, chosenId: "A", correct: false, at: daysAgo(6) },
    { id: uid("qa"), questionId: q1, chosenId: "A", correct: false, at: daysAgo(3) },
    { id: uid("qa"), questionId: q1, chosenId: "C", correct: true, at: daysAgo(1) },
    { id: uid("qa"), questionId: q2, chosenId: "B", correct: true, at: daysAgo(5) },
    { id: uid("qa"), questionId: q2, chosenId: "B", correct: true, at: daysAgo(2) },
    { id: uid("qa"), questionId: q3, chosenId: "A", correct: false, at: daysAgo(4) },
    { id: uid("qa"), questionId: q3, chosenId: "B", correct: true, at: daysAgo(1) },
    { id: uid("qa"), questionId: q4, chosenId: "A", correct: false, at: daysAgo(4) },
    { id: uid("qa"), questionId: q4, chosenId: "A", correct: false, at: daysAgo(2) },
    { id: uid("qa"), questionId: q4, chosenId: "C", correct: false, at: daysAgo(1) },
  ];

  const questions = [
    {
      id: q1,
      folderId: folderControle,
      statement: "Sobre o controle de constitucionalidade, é correto afirmar que:",
      alternatives: [
        { id: "A", text: "A ADI pode ser proposta por qualquer cidadão brasileiro." },
        { id: "B", text: "A ADC tem por objetivo declarar a inconstitucionalidade de uma lei." },
        { id: "C", text: "O Presidente da República é um dos legitimados para propor ADI." },
        { id: "D", text: "Decisões em ADI não possuem efeito vinculante." },
        { id: "E", text: "A ADI só pode ser julgada por tribunais estaduais." },
      ],
      correctId: "C",
      institution: "CESPE/Cebraspe",
      year: 2022,
      difficulty: "medio",
      favorite: false,
      comment: "A legitimidade para propor ADI está prevista no art. 103 da CF/88 e inclui o Presidente da República, entre outros.",
      createdAt: daysAgo(6),
    },
    {
      id: q2,
      folderId: folderControle,
      statement: "A Ação Declaratória de Constitucionalidade (ADC) tem como principal finalidade:",
      alternatives: [
        { id: "A", text: "Revogar uma lei já declarada inconstitucional." },
        { id: "B", text: "Confirmar a constitucionalidade de uma lei federal diante de controvérsia relevante." },
        { id: "C", text: "Substituir o controle difuso de constitucionalidade." },
        { id: "D", text: "Impedir que o Congresso Nacional edite novas leis." },
        { id: "E", text: "Julgar crimes de responsabilidade do Presidente." },
      ],
      correctId: "B",
      institution: "FGV",
      year: 2021,
      difficulty: "facil",
      favorite: true,
      comment: null,
      createdAt: daysAgo(5),
    },
    {
      id: q3,
      folderId: folderDengue,
      statement: "Sobre os sintomas clássicos da dengue, assinale a alternativa correta:",
      alternatives: [
        { id: "A", text: "Tosse seca persistente é o sintoma mais característico." },
        { id: "B", text: "Febre alta de início súbito associada a dores musculares e articulares é típica da fase inicial." },
        { id: "C", text: "A ausência de febre descarta o diagnóstico de dengue." },
        { id: "D", text: "Manchas vermelhas na pele indicam cura da doença." },
        { id: "E", text: "A doença não causa dor de cabeça." },
      ],
      correctId: "B",
      institution: "Hospital Sírio-Libanês",
      year: 2023,
      difficulty: "medio",
      favorite: false,
      comment: null,
      createdAt: daysAgo(4),
    },
    {
      id: q4,
      folderId: folderDengue,
      statement: "São considerados sinais de alarme na dengue, EXCETO:",
      alternatives: [
        { id: "A", text: "Dor abdominal intensa e contínua." },
        { id: "B", text: "Vômitos persistentes." },
        { id: "C", text: "Sangramento de mucosas." },
        { id: "D", text: "Queda abrupta da pressão arterial." },
        { id: "E", text: "Apetite preservado e disposição para atividades físicas." },
      ],
      correctId: "E",
      institution: "SES-SP",
      year: 2022,
      difficulty: "dificil",
      favorite: false,
      comment: "Sinais de alarme indicam agravamento clínico; apetite preservado é sinal de estabilidade, não de alarme.",
      createdAt: daysAgo(4),
    },
  ];

  return { questions, questionAttempts: attempts };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Falha ao carregar estado salvo, iniciando com dados de exemplo.", e);
  }
  return seedState();
}

class Store {
  constructor() {
    this.state = load();
    this.listeners = new Set();
  }
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((fn) => fn(this.state));
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---- Folders ----
  addFolder(name, parentId = null) {
    const folder = { id: uid("f"), name, parentId };
    this.state.folders.push(folder);
    this.save();
    return folder;
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

  // ---- Summaries ----
  addSummary(folderId, title = "Novo resumo") {
    const summary = {
      id: uid("s"),
      folderId,
      title,
      contentHtml: "",
      pageStyle: "minimal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.summaries.push(summary);
    this.save();
    return summary;
  }
  updateSummary(id, patch) {
    const s = this.state.summaries.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    this.save();
  }
  // Persiste sem notificar os listeners: usado nos handlers de digitação
  // (título/editor) para nunca reconstruir o DOM enquanto o usuário digita.
  patchSummarySilent(id, patch) {
    const s = this.state.summaries.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
  deleteSummary(id) {
    this.state.summaries = this.state.summaries.filter((s) => s.id !== id);
    this.save();
  }
  summariesInFolder(folderId) {
    return this.state.summaries.filter((s) => s.folderId === folderId);
  }
  flashcardCountForSummary(summaryId) {
    return this.state.flashcards.filter((fc) => fc.summaryId === summaryId).length;
  }

  // ---- Flashcards ----
  addFlashcard({ folderId, front, back, hint = "", summaryId = null }) {
    const card = {
      id: uid("fc"),
      folderId,
      front,
      back,
      hint,
      summaryId,
      createdAt: new Date().toISOString(),
      srs: newSrsState(),
    };
    this.state.flashcards.push(card);
    this.save();
    return card;
  }
  updateFlashcard(id, patch) {
    const c = this.state.flashcards.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    this.save();
  }
  deleteFlashcard(id) {
    this.state.flashcards = this.state.flashcards.filter((c) => c.id !== id);
    this.save();
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
    return question;
  }
  updateQuestion(id, patch) {
    const q = this.state.questions.find((x) => x.id === id);
    if (!q) return;
    Object.assign(q, patch);
    this.save();
  }
  deleteQuestion(id) {
    this.state.questions = this.state.questions.filter((q) => q.id !== id);
    this.state.questionAttempts = this.state.questionAttempts.filter((a) => a.questionId !== id);
    this.save();
  }
  toggleFavoriteQuestion(id) {
    const q = this.state.questions.find((x) => x.id === id);
    if (!q) return;
    q.favorite = !q.favorite;
    this.save();
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
    this.save();
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

  setOnboarded(modes) {
    this.state.modes = modes;
    this.state.onboarded = true;
    this.save();
  }

  setRoute(route, extra = {}) {
    this.state.ui = { ...this.state.ui, route, ...extra };
    this.save();
  }
}

export const store = new Store();
export { uid };
