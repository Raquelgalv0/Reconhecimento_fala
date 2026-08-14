import { store } from "../store.js";
import { showToast } from "../ui-utils.js";
import { Icon } from "../icons.js";
import {
  generateSummaryFromText,
  generateFlashcardsFromText,
  generateChecklistFromText,
  generateQuestionsFromText,
  generateMindMapFromText,
} from "../ai.js";

// Rascunho gerado — vive fora do ciclo de render para sobreviver a re-renders
// (mesmo padrão de `session` em flashcards.js/questoes.js).
let lastResult = null;

// ---- Leitura de PDF (pdf.js, carregado sob demanda do CDN) ----
// Só baixa a biblioteca quando a pessoa realmente sobe um PDF, pra não pesar
// o carregamento do app pra quem nunca usa isso.
const PDFJS_VERSION = "6.1.200";
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
let pdfjsLibPromise = null;

function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(`${PDFJS_BASE}/pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

// Junta os itens de texto de uma página preservando quebras de linha e de
// parágrafo. O pdf.js devolve cada trecho de texto com sua posição (x, y) no
// item.transform, mas NÃO em ordem de leitura pronta — juntar tudo com um
// espaço só (como era antes) transformava a página inteira numa única frase
// gigante, sem parágrafo nem quebra de linha nenhuma. Aqui, quando a posição
// vertical muda de um item pro outro, entende que é uma linha nova; se o
// salto for bem maior que o normal entre linhas, entende que é um parágrafo
// novo (linha em branco).
function joinPageTextItems(items) {
  let pageText = "";
  let lastY = null;
  let lastGap = null;
  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform ? item.transform[5] : null;
    let sep = "";
    if (lastY !== null && y !== null) {
      const gap = Math.abs(y - lastY);
      if (gap > 1) {
        sep = lastGap && gap > lastGap * 1.6 ? "\n\n" : "\n";
        lastGap = gap;
      } else if (pageText && !pageText.endsWith(" ")) {
        sep = " ";
      }
    }
    pageText += sep + item.str;
    lastY = y;
  }
  return pageText.trim();
}

// Lê o PDF página por página. Se UMA página falhar (conteúdo complexo,
// fonte incomum, etc.), pula ela e continua nas seguintes — antes, um erro
// em qualquer página abortava a leitura inteira e só o que já tinha sido
// lido (às vezes só a página 1) ficava sem aviso nenhum do que aconteceu.
async function extractPdfText(file) {
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const totalPages = doc.numPages;
  let text = "";
  let failedPages = 0;
  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += joinPageTextItems(content.items) + "\n\n";
    } catch (err) {
      failedPages++;
      console.error(`Falha ao ler a página ${i} do PDF:`, err);
    }
  }
  return { text: text.trim(), totalPages, failedPages };
}

// ---- Leitura de slides (.pptx), via JSZip (CDN) ----
// Um .pptx é um .zip com um XML por slide (ppt/slides/slideN.xml); o texto
// de cada caixa fica em tags <a:t>. Não precisa de nenhuma lib de PowerPoint,
// só descompactar e ler o XML.
const JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
let jszipPromise = null;

function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipPromise) {
    jszipPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = JSZIP_URL;
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error("não foi possível carregar o leitor de slides"));
      document.head.appendChild(script);
    });
  }
  return jszipPromise;
}

async function extractPptxText(file) {
  const JSZip = await loadJSZip();
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)[1]) - Number(b.match(/slide(\d+)\.xml/)[1]));
  const totalPages = slideFiles.length;
  let text = "";
  let failedPages = 0;
  const parser = new DOMParser();
  for (let i = 0; i < slideFiles.length; i++) {
    try {
      const xml = await zip.files[slideFiles[i]].async("text");
      const xmlDoc = parser.parseFromString(xml, "application/xml");
      // Cada marcador/linha do slide é um parágrafo <a:p>, que pode ter vários
      // trechos <a:t> dentro (ex.: palavras com formatação diferente). Antes
      // isso lia todo <a:t> do slide de uma vez e juntava tudo numa linha só
      // — título e cada marcador da lista viravam uma frase única emendada.
      // Aqui, cada <a:p> vira uma linha, preservando os marcadores separados.
      const paragraphs = xmlDoc.getElementsByTagName("a:p");
      const lines = [];
      for (let p = 0; p < paragraphs.length; p++) {
        const runs = paragraphs[p].getElementsByTagName("a:t");
        let line = "";
        for (let r = 0; r < runs.length; r++) line += runs[r].textContent;
        line = line.trim();
        if (line) lines.push(line);
      }
      if (lines.length) text += `Slide ${i + 1}:\n${lines.join("\n")}\n\n`;
    } catch (err) {
      failedPages++;
      console.error(`Falha ao ler o slide ${i + 1}:`, err);
    }
  }
  return { text: text.trim(), totalPages, failedPages };
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function folderOptionsHtml(selectedId) {
  return store
    .flattenFolders()
    .map((f) => `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${"— ".repeat(f.depth)}${esc(f.name)}</option>`)
    .join("");
}

// ---- Mapa mental interativo (clica num ramo -> ele vira o novo centro) ----
// `path` é uma lista de índices, andando pela árvore `mm.branches` a partir
// da raiz — mora fora do render pra sobreviver a re-renders do preview
// inteiro, mas é resetado toda vez que um mapa novo é gerado.
let mindMapPath = [];

function mindMapNodeAt(mm, path) {
  let node = { label: mm.title, children: mm.branches || [] };
  for (const idx of path) {
    const next = node.children?.[idx];
    if (!next) break;
    node = next;
  }
  return node;
}

function renderMindMapInteractive(root, mm) {
  if (!root) return;
  const current = mindMapNodeAt(mm, mindMapPath);
  const children = current.children || [];

  root.innerHTML = `
    <div class="mindmap">
      <div class="mm-breadcrumb">
        <button type="button" class="mm-crumb ${mindMapPath.length === 0 ? "active" : ""}" data-mm-jump="0">${esc(mm.title)}</button>
        ${mindMapPath
          .map((idx, i) => {
            const node = mindMapNodeAt(mm, mindMapPath.slice(0, i + 1));
            const isLast = i === mindMapPath.length - 1;
            return `<span class="mm-crumb-sep">›</span><button type="button" class="mm-crumb ${isLast ? "active" : ""}" data-mm-jump="${i + 1}">${esc(node.label)}</button>`;
          })
          .join("")}
      </div>
      <button type="button" class="mm-center" id="mm-center-btn" title="${mindMapPath.length ? "Voltar um nível" : ""}" ${mindMapPath.length ? "" : "disabled"}>${esc(current.label)}</button>
      ${
        children.length
          ? `<div class="mm-trunk"></div><div class="mm-branches">${children
              .map((b, i) => {
                const hasKids = b.children && b.children.length > 0;
                return `<button type="button" class="mm-branch ${hasKids ? "mm-branch--parent" : ""}" data-mm-child="${i}">
                  <span class="mm-branch-label"><span class="mm-dot"></span><span>${esc(b.label)}</span></span>${hasKids ? `<span class="mm-branch-arrow">${Icon("chevronRight", { size: 13 })}</span>` : ""}
                </button>`;
              })
              .join("")}</div>`
          : `<div class="mm-leaf-note">${mindMapPath.length ? "Sem mais sub-tópicos aqui." : ""}</div>`
      }
    </div>`;

  root.querySelectorAll("[data-mm-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mindMapPath = mindMapPath.slice(0, Number(btn.dataset.mmJump));
      renderMindMapInteractive(root, mm);
    });
  });
  root.querySelectorAll("[data-mm-child]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mindMapPath = [...mindMapPath, Number(btn.dataset.mmChild)];
      renderMindMapInteractive(root, mm);
    });
  });
  const centerBtn = root.querySelector("#mm-center-btn");
  if (centerBtn && mindMapPath.length) {
    centerBtn.addEventListener("click", () => {
      mindMapPath = mindMapPath.slice(0, -1);
      renderMindMapInteractive(root, mm);
    });
  }
}

// Versão estática (sem clique) pra quando o mapa é salvo dentro de um
// resumo — o conteúdo do resumo é HTML inerte, então em vez de esconder os
// sub-ramos atrás de clique, mostra tudo já aninhado numa lista.
function mindMapStaticHtml(mm) {
  const renderChildren = (nodes) => {
    if (!nodes || nodes.length === 0) return "";
    return `<ul class="mm-static-list">${nodes.map((n) => `<li>${esc(n.label)}${renderChildren(n.children)}</li>`).join("")}</ul>`;
  };
  return `<div class="mindmap-static"><div class="mm-static-title">${esc(mm.title)}</div>${renderChildren(mm.branches)}</div>`;
}

export function renderUpload(container) {
  const folders = store.flattenFolders();

  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Upload de Materiais</h1>
        <p class="sub">Cole o texto de uma aula, PDF ou slide, e a IA transforma automaticamente em resumo, flashcards, questões, checklist e mapa mental.</p>
      </div>
    </div>
    ${
      folders.length === 0
        ? `<div class="empty-state"><div class="big">${Icon("folder", { size: 30 })}</div>Você ainda não tem nenhum assunto.<br/><button class="btn btn-primary" id="up-create-folder" style="margin-top:12px;">${Icon("plus", { size: 14 })}<span>Criar o primeiro assunto</span></button></div>`
        : renderForm(folders)
    }
    <div id="upload-result">${lastResult ? renderResultHtml(lastResult) : ""}</div>
  `;

  if (folders.length === 0) {
    container.querySelector("#up-create-folder").addEventListener("click", () => {
      const name = prompt("Como quer chamar o primeiro assunto?");
      if (!name || !name.trim()) return;
      store.addFolder(name.trim(), null);
      showToast(`"${name.trim()}" criado.`, "folder");
      renderUpload(container);
    });
    return;
  }
  wireForm(container);
  if (lastResult) wireResult(container);
}

function renderForm(folders) {
  return `
    <div class="panel">
      <div class="field">
        <label>Título do material</label>
        <input type="text" id="up-title" placeholder="Ex.: Aula 3 - Sistema Cardiovascular" />
      </div>
      <div class="field">
        <label>Arquivo (.txt, .md, .pdf ou .pptx), opcional</label>
        <div class="dropzone" id="up-dropzone">
          ${Icon("upload", { size: 20 })}
          <div class="dropzone-text"><b>Arraste um arquivo aqui</b><span>ou clique para escolher</span></div>
          <input type="file" id="up-file" accept=".txt,.md,.pdf,.pptx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" />
        </div>
        <div class="field-hint" id="up-file-hint">PDF e slides (.pptx) são lidos automaticamente (PDFs de imagem/escaneados não têm o texto extraído). Imagens soltas ainda não são lidas, cole o texto manualmente.</div>
      </div>
      <div class="field">
        <label>Cole o texto do material</label>
        <textarea id="up-source" style="min-height:180px" placeholder="Cole aqui o conteúdo da aula, do PDF ou dos slides..."></textarea>
      </div>
      <div class="field">
        <label>Assunto</label>
        <select id="up-folder">${folderOptionsHtml(folders[0].id)}</select>
      </div>
      <div class="upload-options">
        <label class="upload-opt"><input type="checkbox" id="opt-resumo" checked />${Icon("fileText", { size: 14 })}<span>Resumo</span></label>
        <label class="upload-opt">
          <input type="checkbox" id="opt-flashcards" checked />${Icon("layers", { size: 14 })}<span>Flashcards</span>
          <input type="text" inputmode="numeric" class="opt-count" id="count-flashcards" value="5" />
        </label>
        <label class="upload-opt">
          <input type="checkbox" id="opt-questoes" checked />${Icon("helpCircle", { size: 14 })}<span>Questões</span>
          <input type="text" inputmode="numeric" class="opt-count" id="count-questoes" value="3" />
        </label>
        <label class="upload-opt"><input type="checkbox" id="opt-checklist" checked />${Icon("checkSquare", { size: 14 })}<span>Checklist</span></label>
        <label class="upload-opt"><input type="checkbox" id="opt-mindmap" checked />${Icon("mindMap", { size: 14 })}<span>Mapa mental</span></label>
      </div>
      <button class="btn btn-primary" id="process-btn">${Icon("sparkles", { size: 14 })}<span>Processar com IA</span></button>
    </div>
  `;
}

function renderResultHtml(r) {
  return `
    <div class="panel upload-preview">
      <h3>${Icon("check", { size: 16 })}<span>Pré-visualização</span></h3>
      <p class="muted-note" style="margin-bottom:14px;">Revise o que a IA gerou (simulado localmente). Você poderá editar tudo depois de salvar.</p>

      ${
        r.summaryHtml
          ? `<div class="preview-block"><b>${Icon("fileText", { size: 13 })} Resumo: ${esc(r.title)}</b><div class="preview-box editor-body">${r.summaryHtml}</div></div>`
          : ""
      }
      ${r.mindmap ? `<div class="preview-block"><b>${Icon("mindMap", { size: 13 })} Mapa mental</b><div class="field-hint" style="margin:2px 0 4px;">Clique num ramo pra ver os sub-tópicos.</div><div id="mindmap-slot"></div></div>` : ""}
      ${
        r.checklist && r.checklist.length
          ? `<div class="preview-block"><b>${Icon("checkSquare", { size: 13 })} Checklist (${r.checklist.length} itens)</b><div class="preview-box">${r.checklist
              .map((c) => `<div class="checklist-item" data-checked="false"><span class="check-box"></span><span class="check-text">${esc(c)}</span></div>`)
              .join("")}</div></div>`
          : ""
      }
      ${
        r.flashcards && r.flashcards.length
          ? `<div class="preview-block"><b>${Icon("layers", { size: 13 })} Flashcards (${r.flashcards.length})</b><div class="preview-flashcards">${r.flashcards
              .map((fc) => `<div class="preview-fc"><div class="fc-front">${esc(fc.front)}</div><div class="fc-back">${esc(fc.back)}</div></div>`)
              .join("")}</div></div>`
          : ""
      }
      ${
        r.questions && r.questions.length
          ? `<div class="preview-block"><b>${Icon("helpCircle", { size: 13 })} Questões (${r.questions.length})</b>${r.questions
              .map(
                (q) => `
        <div class="preview-question">
          <p>${esc(q.statement)}</p>
          <div class="q-meta">${q.alternatives.map((a) => `<span class="q-tag ${a.id === q.correctId ? "correct" : ""}">${a.id}) ${esc(a.text).slice(0, 50)}</span>`).join("")}</div>
        </div>`
              )
              .join("")}</div>`
          : ""
      }

      <div class="btn-row" style="margin-top:18px; justify-content:space-between;">
        <button class="btn btn-ghost" id="discard-btn">Descartar</button>
        <button class="btn btn-primary" id="save-all-btn">${Icon("checkPlain", { size: 14 })}<span>Salvar tudo no HiperNotes</span></button>
      </div>
    </div>
  `;
}

function wireForm(container) {
  const fileInput = container.querySelector("#up-file");
  const sourceEl = container.querySelector("#up-source");

  // Fluxo comum pra qualquer formato que a gente extrai texto de verdade
  // (PDF, PPTX): valida tamanho, limpa a caixa, chama o extrator escolhido
  // e avisa quantas páginas/slides realmente foram lidos.
  const readDocumentFile = async (file, { extract, kindLabel, unitSingular, unitPlural }) => {
    if (file.size > 20 * 1024 * 1024) {
      showToast(`${kindLabel} muito grande (máx. 20MB). Tente um arquivo menor.`, "alertCircle");
      fileInput.value = "";
      return;
    }
    sourceEl.value = "";
    showToast(`Lendo "${file.name}"...`, "upload");
    try {
      const { text, totalPages, failedPages } = await extract(file);
      if (!text) {
        showToast(`Não encontrei texto nesse ${kindLabel.toLowerCase()}. Cole o texto manualmente.`, "alertCircle");
        return;
      }
      sourceEl.value = text;
      const unit = totalPages === 1 ? unitSingular : unitPlural;
      if (failedPages > 0) {
        showToast(
          `${kindLabel} lido: ${totalPages - failedPages} de ${totalPages} ${unit} (${failedPages} não ${
            failedPages === 1 ? "pôde" : "puderam"
          } ser lido${failedPages === 1 ? "" : "s"} — confira o texto).`,
          "alertCircle"
        );
      } else {
        showToast(`${kindLabel} "${file.name}" lido com sucesso (${totalPages} ${unit}).`, "upload");
      }
    } catch (err) {
      showToast(`Não foi possível ler esse ${kindLabel.toLowerCase()} (${err.message || "erro desconhecido"}).`, "alertCircle");
    }
  };

  // Único ponto de entrada pra processar um arquivo escolhido, venha ele do
  // clique no seletor nativo ou de arrastar-e-soltar na zona de upload —
  // as duas formas caem aqui pra não duplicar a lógica de PDF/PPTX/texto.
  const handleSelectedFile = async (file) => {
    if (!file) return;

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      await readDocumentFile(file, { extract: extractPdfText, kindLabel: "PDF", unitSingular: "página", unitPlural: "páginas" });
      return;
    }

    const isPptx =
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || /\.pptx$/i.test(file.name);
    if (isPptx) {
      await readDocumentFile(file, { extract: extractPptxText, kindLabel: "Slide", unitSingular: "slide", unitPlural: "slides" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      sourceEl.value = String(reader.result || "");
      showToast(`Arquivo "${file.name}" carregado.`, "upload");
    };
    reader.onerror = () => showToast("Não foi possível ler esse arquivo.", "alertCircle");
    reader.readAsText(file);
  };

  fileInput.addEventListener("change", () => handleSelectedFile(fileInput.files[0]));

  // Arrastar-e-soltar: a zona toda vira alvo (o input de arquivo cobre a
  // área inteira de forma invisível, então clicar nela já abre o seletor
  // nativo normalmente — só precisamos tratar o "drop" para os arquivos
  // arrastados de fora, que não passam pelo evento "change" do input).
  const dropZone = container.querySelector("#up-dropzone");
  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });
  ["dragleave", "dragend"].forEach((evt) => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove("drag-over"));
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleSelectedFile(file);
  });

  container.querySelector("#process-btn").addEventListener("click", async () => {
    const text = sourceEl.value.trim();
    if (text.length < 40) {
      showToast("Cole um texto mais completo (mínimo de 40 caracteres).", "alertCircle");
      return;
    }
    const title = container.querySelector("#up-title").value.trim() || "Material importado";
    const folderId = container.querySelector("#up-folder").value;
    const wantResumo = container.querySelector("#opt-resumo").checked;
    const wantFlashcards = container.querySelector("#opt-flashcards").checked;
    const wantQuestoes = container.querySelector("#opt-questoes").checked;
    const wantChecklist = container.querySelector("#opt-checklist").checked;
    const wantMindmap = container.querySelector("#opt-mindmap").checked;
    const countFlashcards = Math.max(1, Math.min(10, Number(container.querySelector("#count-flashcards").value) || 5));
    const countQuestoes = Math.max(1, Math.min(10, Number(container.querySelector("#count-questoes").value) || 3));

    if (!wantResumo && !wantFlashcards && !wantQuestoes && !wantChecklist && !wantMindmap) {
      showToast("Selecione ao menos um formato para gerar.", "alertCircle");
      return;
    }

    const btn = container.querySelector("#process-btn");
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${Icon("sparkles", { size: 14 })}<span>Processando com IA...</span>`;

    try {
      const [summaryHtml, flashcards, questions, checklist, mindmap] = await Promise.all([
        wantResumo ? generateSummaryFromText(text) : Promise.resolve(null),
        wantFlashcards ? generateFlashcardsFromText(text, countFlashcards) : Promise.resolve(null),
        wantQuestoes ? generateQuestionsFromText(text, countQuestoes) : Promise.resolve(null),
        wantChecklist ? generateChecklistFromText(text) : Promise.resolve(null),
        wantMindmap ? generateMindMapFromText(text, title) : Promise.resolve(null),
      ]);
      lastResult = { title, folderId, summaryHtml, flashcards, questions, checklist, mindmap };
      mindMapPath = [];
      showToast("Material processado! Revise antes de salvar.", "sparkles");
      renderUpload(container);
    } catch (err) {
      showToast(err.message, "alertCircle");
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  });
}

function wireResult(container) {
  const discardBtn = container.querySelector("#discard-btn");
  const saveBtn = container.querySelector("#save-all-btn");

  const mindmapSlot = container.querySelector("#mindmap-slot");
  if (mindmapSlot && lastResult?.mindmap) renderMindMapInteractive(mindmapSlot, lastResult.mindmap);

  discardBtn.addEventListener("click", () => {
    lastResult = null;
    mindMapPath = [];
    renderUpload(container);
  });

  saveBtn.addEventListener("click", () => {
    const r = lastResult;
    let summaryId = null;

    if (r.summaryHtml || r.mindmap || r.checklist) {
      let html = r.summaryHtml || "";
      if (r.mindmap) html += mindMapStaticHtml(r.mindmap);
      if (r.checklist && r.checklist.length) {
        html +=
          `<h3>Checklist de revisão</h3>` +
          r.checklist.map((c) => `<div class="checklist-item" data-checked="false"><span class="check-box"></span><span class="check-text">${esc(c)}</span></div>`).join("");
      }
      const summary = store.addSummary(r.folderId, r.title);
      store.updateSummary(summary.id, { contentHtml: html });
      summaryId = summary.id;
    }
    if (r.flashcards) {
      r.flashcards.forEach((fc) => store.addFlashcard({ folderId: r.folderId, front: fc.front, back: fc.back, summaryId }));
    }
    if (r.questions) {
      r.questions.forEach((q) => store.addQuestion({ folderId: r.folderId, statement: q.statement, alternatives: q.alternatives, correctId: q.correctId }));
    }

    lastResult = null;
    mindMapPath = [];
    showToast("Material salvo: resumo, flashcards e questões sincronizados.", "check");
    if (summaryId) store.setRoute("resumos", { activeSummaryId: summaryId });
    else renderUpload(container);
  });
}
