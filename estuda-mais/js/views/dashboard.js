import { store } from "../store.js";

const MODE_LABEL = { concurso: "Concurso", vestibular: "Vestibular", graduacao: "Graduação" };

const PRIORITIES = {
  concurso: [
    { icon: "📊", title: "Ataque o que mais cai", desc: "Priorize baralhos com mais cartas atrasadas — geralmente são os tópicos mais cobrados em prova." },
    { icon: "🔁", title: "Erros voltam rápido", desc: "O que você errou hoje reaparece amanhã. Não deixe a fila de revisão acumular." },
  ],
  vestibular: [
    { icon: "📚", title: "Vença o conteúdo do dia", desc: "Gere um resumo por tópico logo após a aula e crie os flashcards essenciais na hora." },
    { icon: "🗺️", title: "Cobertura do edital", desc: "Distribua os resumos entre as áreas (Humanas, Exatas, Biológicas) para não deixar lacunas." },
  ],
  graduacao: [
    { icon: "🗂️", title: "Organize por disciplina", desc: "Crie uma pasta por matéria do semestre e registre resumo + flashcards logo após cada aula." },
    { icon: "🗓️", title: "Antecipe provas e trabalhos", desc: "Revisar aos poucos ao longo do semestre evita a virada de noite antes da prova." },
  ],
};

export function renderDashboard(container) {
  const modes = store.state.modes || [];
  const totalSummaries = store.state.summaries.length;
  const totalCards = store.state.flashcards.length;
  const dueToday = store.cardsDueToday().length;
  const decks = store.state.folders.length;

  const deckLoad = store
    .flattenFolders()
    .map((f) => ({ name: f.name, due: store.cardsDueToday(f.id).length, total: store.cardsInFolder(f.id).length }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 4);

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Bem-vinda de volta 👋</h1>
        <p class="sub">Seu painel de estudos${modes.length ? ` — modo ${modes.map((m) => MODE_LABEL[m]).join(" + ")}` : ""}.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="go-resumos">＋ Novo resumo</button>
        <button class="btn btn-primary" id="go-review" ${dueToday === 0 ? "disabled style='opacity:.5;cursor:default'" : ""}>🔥 Revisar hoje (${dueToday})</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="label">Resumos</div><div class="value">${totalSummaries}</div></div>
      <div class="stat-card"><div class="label">Flashcards</div><div class="value">${totalCards}</div></div>
      <div class="stat-card"><div class="label">Para revisar hoje</div><div class="value amber">${dueToday}</div></div>
      <div class="stat-card"><div class="label">Assuntos organizados</div><div class="value accent">${decks}</div></div>
    </div>

    <div class="panel">
      <h3>🎯 Prioridades para o seu modo de estudo</h3>
      <div class="priority-list">
        ${(modes.length ? modes : ["concurso", "vestibular", "graduacao"])
          .flatMap((m) => PRIORITIES[m] || [])
          .map(
            (p, i) => `
          <div class="priority-item">
            <div class="num">${i + 1}</div>
            <div class="txt"><b>${p.icon} ${p.title}</b><span>${p.desc}</span></div>
          </div>`
          )
          .join("")}
      </div>
    </div>

    ${
      deckLoad.length
        ? `<div class="panel">
      <h3>📈 Onde focar agora</h3>
      <div class="priority-list">
        ${deckLoad
          .map(
            (d) => `
          <div class="priority-item">
            <div class="num">🗂</div>
            <div class="txt"><b>${d.name}</b><span>${d.total} flashcard${d.total === 1 ? "" : "s"} · ${d.due ? `${d.due} pendente${d.due === 1 ? "" : "s"} hoje` : "em dia"}</span></div>
          </div>`
          )
          .join("")}
      </div>
    </div>`
        : ""
    }
  `;

  container.querySelector("#go-resumos").addEventListener("click", () => store.setRoute("resumos", { activeSummaryId: null, activeFolderId: null }));
  const reviewBtn = container.querySelector("#go-review");
  if (dueToday > 0) {
    reviewBtn.addEventListener("click", () => store.setRoute("flashcards", { activeDeckId: null, reviewing: false }));
  }
}
