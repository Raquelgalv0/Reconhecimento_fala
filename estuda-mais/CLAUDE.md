# HiperNotes (Estuda+)

Plataforma de estudos em pt-BR para qualquer pessoa que estuda: concurso, vestibular, graduação, medicina, o que for. Não é uma ferramenta de nicho, é um ambiente de estudo geral.

## Stack

- Vanilla JS/HTML/CSS, sem build step, sem framework. Roteador feito à mão (`store.setRoute`/`store.subscribe`), views em `js/views/`.
- Backend: Supabase (Postgres + Auth). `supabase/schema.sql` usa `create table if not exists` + `alter table ... add column if not exists` para toda migração, sempre idempotente.
- IA: Groq (API compatível com OpenAI), modelo atual `openai/gpt-oss-120b` (o `llama-3.3-70b-versatile` foi descontinuado). `lib/groq.js`, `js/ai.js`.
- FSRS (repetição espaçada) já implementado de verdade em `js/srs.js`, campos `dueDate, lastResult, reviewsCount, lapses` no `srs` de cada flashcard.

## Identidade visual

- Paleta terracota/creme/espresso, tokens em `style.css` (`--bg`, `--accent`, `--ink` etc). Fonte serifada `Fraunces` pros títulos, sans do sistema pro corpo.
- Modo escuro já foi implementado e revertido (a dona do produto não gostou). Não reintroduzir sem pedido explícito.
- **Evite travessões (—) em qualquer texto voltado pro usuário.** Use ponto, vírgula ou dois-pontos no lugar. Comentário de código pode ter, texto que a pessoa lê não.
- Efeitos visuais: prefira fundo sólido. **Evite blur/transparência/glassmorphism e animação decorativa** — a dona do produto pediu explicitamente pra reduzir isso (só ficou o feedback tátil de `:active` nos botões/cards, que é funcional, não decorativo).
- Existe uma skill instalada em `.claude/skills/apple-design/SKILL.md` com os princípios de design da Apple (resposta, spring animation, materiais). Use como referência de vocabulário, mas o ajuste acima (sem blur/transparência) tem prioridade sobre o que a skill sugere.

## Mascote

Personagem chamado **Capelinho**: um círculo com carinha simples (olhinhos, sorriso) e um capelo de formatura em cima, em `js/mascot.js` (`Mascot({ size })`). Segue o mesmo traço da lupinha do outro produto da autora, o Lupa Redação (luparedacao.com.br), pra manter identidade entre os dois apps. Hoje só aparece na tela de onboarding; dá pra reaproveitar em outros lugares (estados vazios, dicas) mantendo o mesmo estilo de rosto.

## Onboarding

A tela de entrada pergunta "o que você está estudando?" com um campo de texto livre (sem categoria fixa), alimentando `profile.studyArea`. Isso substituiu uma tela antiga que obrigava escolher entre 4 "Alas" (Concurso/Vestibular/Graduação/Medicina).

As Alas **continuam existindo como recurso opcional**, não foram removidas do app: o botão "Escolher Ala" na sidebar (`openModesModal` em `js/app.js`) e a organização de pastas por Ala em Assuntos (`js/views/assuntos.js`) seguem funcionando pra quem quiser usar. `store.state.modes` pode ficar vazio (`[]`) sem quebrar nada, o app já trata esse caso.

## Gamificação: Sua Vila

Em `js/village.js`, pura computação, sem tabela nova no banco. Cinco construções, cada uma ligada a uma função real do app e derivando XP de dados que já existem:

- Biblioteca (resumos) → `resumos`
- Torre da Memória (flashcards/FSRS) → `flashcards`
- Arena (questões) → `questoes`
- Posto de Foco (sessões de Pomodoro) → `foco`
- Praça Central (metas/streak) → `desempenho`

Cada construção sobe de nível sozinha; o personagem central é a soma de todas. Renderizado em `js/views/foco.js` (`villageHtml`), com nós clicáveis que navegam direto pra função.

## Foco

Pomodoro clássico (não é mais a cidade isométrica de antes): presets de 15/25/50min de estudo, pausas curtas e uma pausa longa a cada 4 blocos. Lógica em `js/views/foco.js`.

## Plano de negócio (em discussão, nada implementado ainda)

- **Não existe cobrança implementada** (sem Stripe, sem plano pago, sem limite de free tier). É o item mais urgente antes de qualquer coisa gerar receita.
- Direção discutida: plano em camadas com trial de 7 dias, depois algo como R$39,99/mês (limitado) e R$49,99/mês (mais recursos), meta de faturamento em torno de R$500 mil/ano.
- Recomendação dada: limitar geração por IA (custo variável real via Groq) nos planos de entrada, mas deixar Vila/Pomodoro/FSRS liberados mesmo no plano barato (custo marginal zero, é o diferencial).
- Evitar "sem botão de cancelamento automático" (risco legal no Brasil, CDC exige cancelamento tão fácil quanto assinar) e cartão de crédito obrigatório desde o trial (parte do público estudante não tem cartão próprio, considerar Pix).
- A dona do produto vai mandar uma skill sobre SaaS pra revisar antes de aplicar qualquer coisa de monetização. **Não implementar cobrança/planos sem essa conversa acontecer primeiro.**

## Plano pedagógico maior (Fase 1 de 5, mal começou)

Existe uma especificação grande e aprovada pra reconstruir o motor de estudo em torno de: onboarding com data de prova, pré-teste diagnóstico por tópico, resumo como fonte única de verdade (com gate de revisão), método socrático guiado, geração de flashcard de reforço a partir de pontos fracos, e FSRS calibrado por retenção-alvo/data de prova, com Pomodoro estruturando o calendário de estudo.

Progresso real até agora: só a coluna `profiles.exam_date` existe no schema (`supabase/schema.sql`). Nada do resto (onboarding com data de prova, pipeline de resumo com gate, pré-teste, socrático, FSRS recalibrado) foi implementado. Isso é trabalho grande, não assumir que está pronto.

## Fluxo de git

Branch de desenvolvimento: `claude/study-platform-summaries-flashcards-lluc05`. A branch `main` só recebe merge quando a dona do produto confirma explicitamente, nunca automaticamente.

## Testando mudanças de UI

Sempre testar visualmente antes de considerar uma mudança de UI pronta (não só rodar `node --check`). Rode `node server.js` localmente e abra no navegador (ou headless Chromium via CDP, se preferir automatizar com screenshot).
