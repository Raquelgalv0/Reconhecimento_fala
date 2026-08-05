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
    profile: { name: "", studyArea: "", level: "", dailyTimeMinutes: null },
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
    dailyGoal: 10,
    dailyLog: seedDailyLog(),
    essays: seedEssays(),
    ui: {
      route: "dashboard",
      activeFolderId: null,
      activeSummaryId: null,
      activeDeckId: null,
      reviewing: false,
      practicing: false,
      activeQuestionFolderId: null,
      questionFilter: "all",
      redacaoView: "list",
      activeEssayId: null,
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

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function seedDailyLog() {
  // últimos 14 dias, com um dia sem atividade no meio para demonstrar a
  // diferença entre a sequência atual e a melhor sequência já alcançada.
  const days = [
    { n: 13, total: 5, correct: 3, minutes: 14 },
    { n: 12, total: 7, correct: 5, minutes: 18 },
    { n: 11, total: 6, correct: 5, minutes: 16 },
    { n: 10, total: 8, correct: 6, minutes: 20 },
    { n: 9, total: 9, correct: 7, minutes: 22 },
    { n: 8, total: 6, correct: 4, minutes: 15 },
    { n: 7, total: 7, correct: 6, minutes: 17 },
    { n: 6, total: 0, correct: 0, minutes: 0 },
    { n: 5, total: 5, correct: 3, minutes: 12 },
    { n: 4, total: 9, correct: 7, minutes: 20 },
    { n: 3, total: 7, correct: 6, minutes: 18 },
    { n: 2, total: 11, correct: 9, minutes: 24 },
    { n: 1, total: 8, correct: 7, minutes: 19 },
    { n: 0, total: 6, correct: 5, minutes: 10 },
  ];
  const log = {};
  for (const d of days) {
    const date = new Date(Date.now() - d.n * 86400000);
    log[dayKey(date)] = { total: d.total, correct: d.correct, minutes: d.minutes };
  }
  return log;
}

function seedEssays() {
  return [
    {
      id: uid("es"),
      title: "Desafios da mobilidade urbana no Brasil",
      theme: "Os desafios para a mobilidade urbana sustentável nas grandes cidades brasileiras",
      text:
        "A mobilidade urbana nas grandes cidades brasileiras é um problema histórico que afeta diretamente a qualidade de vida da população. O crescimento desordenado dos centros urbanos, aliado à priorização do transporte individual, gerou congestionamentos crônicos e sistemas de transporte público ineficientes.\n\n" +
        "Nesse sentido, é possível apontar duas causas centrais para esse cenário. Em primeiro lugar, o investimento insuficiente em infraestrutura de transporte coletivo de qualidade faz com que grande parte da população não tenha alternativas viáveis ao automóvel particular. Além disso, o planejamento urbano historicamente voltado para os carros, com pouca atenção a ciclovias e calçadas, reforça essa dependência.\n\n" +
        "Por outro lado, os impactos dessa situação vão além do trânsito: o tempo perdido em deslocamentos reduz a produtividade, a poluição do ar prejudica a saúde pública e a desigualdade de acesso à cidade se aprofunda, já que os bairros periféricos costumam ter o pior atendimento de transporte.\n\n" +
        "Portanto, é fundamental que o poder público, em parceria com a sociedade civil, invista na ampliação e modernização do transporte coletivo, priorizando corredores de ônibus e metrôs nas regiões periféricas. Ademais, o Ministério das Cidades deve articular políticas de incentivo ao uso de bicicletas e à criação de zonas de baixa emissão, garantindo, assim, cidades mais sustentáveis e acessíveis para toda a população.",
      corrected: true,
      total: 820,
      scores: { c1: 160, c2: 180, c3: 160, c4: 140, c5: 180 },
      feedback: {
        c1: "Boa norma culta, com poucos desvios pontuais de concordância e pontuação — releia o segundo parágrafo com atenção às vírgulas.",
        c2: "Excelente domínio do tema proposto, mantendo o foco na mobilidade urbana sustentável do início ao fim.",
        c3: "Argumentação organizada em causas e consequências, mas os parágrafos de desenvolvimento poderiam trazer um dado ou exemplo concreto para reforçar os argumentos.",
        c4: "Bom uso de conectivos ('Nesse sentido', 'Além disso', 'Por outro lado', 'Portanto'), mas repete 'transporte' muitas vezes — varie o vocabulário.",
        c5: "Proposta de intervenção completa: tem agente (poder público/Ministério das Cidades), ação (ampliar transporte, criar zonas de baixa emissão) e detalhamento.",
      },
      suggestions: [
        "Adicione um dado estatístico ou exemplo real no desenvolvimento para fortalecer a competência 3.",
        "Varie o vocabulário para evitar repetir 'transporte' e 'cidades' com tanta frequência.",
        "Revise a pontuação do segundo parágrafo.",
      ],
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];
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

  // ---- Redação (ENEM) ----
  addEssay({ title, theme, text }) {
    const essay = {
      id: uid("es"),
      title: title || "Redação sem título",
      theme,
      text,
      corrected: false,
      scores: null,
      feedback: null,
      suggestions: null,
      createdAt: new Date().toISOString(),
    };
    this.state.essays.push(essay);
    this.save();
    return essay;
  }
  updateEssay(id, patch) {
    const e = this.state.essays.find((x) => x.id === id);
    if (!e) return;
    Object.assign(e, patch);
    this.save();
  }
  deleteEssay(id) {
    this.state.essays = this.state.essays.filter((e) => e.id !== id);
    this.save();
  }

  completeOnboarding({ modes, profile, materias }) {
    this.state.modes = modes;
    this.state.profile = profile;
    (materias || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((name) => {
        const exists = this.state.folders.some((f) => !f.parentId && f.name.toLowerCase() === name.toLowerCase());
        if (!exists) this.state.folders.push({ id: uid("f"), name, parentId: null });
      });
    this.state.onboarded = true;
    this.save();
  }
  updateProfile(patch) {
    this.state.profile = { ...this.state.profile, ...patch };
    this.save();
  }

  setRoute(route, extra = {}) {
    this.state.ui = { ...this.state.ui, route, ...extra };
    this.save();
  }
}

export const store = new Store();
export { uid };
