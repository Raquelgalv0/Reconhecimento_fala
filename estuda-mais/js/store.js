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
    ui: { route: "dashboard", activeFolderId: null, activeSummaryId: null, activeDeckId: null, reviewing: false },
  };
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
