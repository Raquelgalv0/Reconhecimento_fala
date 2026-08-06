# Roteiro de migração — do protótipo ao SaaS real

Este documento descreve como transformar o protótipo estático atual (HTML/CSS/JS puro, dados só no `localStorage` do navegador) em um produto real, com backend, banco de dados seguro, backup e contas de usuário.

> **Status atual**: a etapa de IA (item 3 abaixo) e o caminho de hospedagem na Vercel (item 6) **já estão implementados** — veja `server.js`, `lib/groq.js`, `api/ai.js` e a seção "Publicando num site" do `README.md`. O que falta é o restante: banco de dados real (item 1), login (item 2), upload de PDF/Word (item 4) e pagamento (item 5) — hoje os dados continuam só no `localStorage` de cada navegador, sem conta de usuário nem cobrança.

## Stack alvo

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend | Next.js / React | Reaproveita a estrutura de telas já validada no protótipo |
| Banco de dados | Supabase (Postgres) | Gerenciado, com backup automático |
| Autenticação | Supabase Auth | Login pronto (email/senha, Google etc.) |
| Segurança por usuário | Row Level Security (Supabase) | Cada usuário só acessa seus próprios dados, garantido no banco |
| Armazenamento de arquivos | Supabase Storage | Guardar os PDFs/Word anexados pelos usuários |
| IA (geração de conteúdo) | **Groq API** (Llama 3.3 70B ou similar) | Rápida, barata, cobre 100% das tarefas de geração de texto do app |
| Extração de texto de PDF/Word | `pdf-parse` (PDF) + `mammoth` (.docx) | Não é IA — só leitura do conteúdo já digital do arquivo |
| Pagamento/assinatura | Stripe | Padrão de mercado para SaaS |
| Hospedagem | Vercel | Integração nativa com Next.js |

## 1. Banco de dados (Supabase)

Portar o estado hoje guardado em `store.js` (um objeto único no `localStorage`) para tabelas reais:

- `profiles` (nome, área de estudo, nível, tempo diário, meta diária)
- `folders` (assunto/pasta, com `parent_id` para subpastas)
- `summaries` (resumo, com `folder_id`, `content_html`, `page_style`)
- `flashcards` (frente, verso, dica, `folder_id`, `summary_id`, estado de SRS: `step_index`, `due_date`, `last_result`)
- `questions` (enunciado, alternativas, gabarito, `folder_id`, banca, ano, dificuldade, comentário)
- `question_attempts` (histórico de respostas, para as estatísticas de erro/confusão)
- `daily_log` (minutos estudados e acertos/erros por dia, para streak e gráfico de evolução)

Cada tabela leva `user_id` + política de RLS restringindo `auth.uid() = user_id`.

## 2. Autenticação (🟡 login feito, dados ainda não sincronizam)

O login (cadastro/entrada por e-mail e senha via Supabase Auth) já está implementado — veja a seção "Login" do `README.md`. O que falta desta etapa: hoje o onboarding (escolha de modo, perfil, matérias) e todos os dados do app continuam gravando só no `localStorage`, sem ligação real com a conta logada. Terminar esta etapa é trocar esses pontos de gravação para o banco de dados (item 1), usando o `user_id` da sessão já disponível em `js/auth.js`.

## 3. IA com Groq — mapeamento direto do `ai.js` atual (✅ já feito)

Cada função hoje simulada por regras em `js/ai.js` vira uma chamada de servidor pra Groq (nunca direto do navegador, pra não expor a chave de API):

| Função hoje (heurística) | Vira (Groq) |
|---|---|
| `generateSummaryFromText` | Prompt: resumir o texto em tópicos/parágrafos |
| `suggestFlashcardFromSelection` | Prompt: gerar par pergunta/resposta a partir do trecho selecionado |
| `suggestQuestionComment` | Prompt: explicar por que a alternativa correta está certa |
| `generateFlashcardsFromText` | Prompt: gerar N flashcards a partir do material |
| `generateChecklistFromText` | Prompt: extrair itens de checklist/tópicos de estudo |
| `generateQuestionsFromText` | Prompt: gerar N questões de múltipla escolha com gabarito |
| `generateMindMapFromText` | Prompt: gerar tópico central + ramos em JSON |

Implementação: uma rota de API no Next.js (ou Edge Function do Supabase) por tipo de geração, recebendo o texto e devolvendo JSON estruturado — a interface de entrada/saída dessas funções já foi pensada assim no protótipo, então a troca é só no "miolo".

## 4. Upload de materiais — extração de texto (sem IA)

Esta é a etapa que evolui em relação ao protótipo atual (que só aceita `.txt`/`.md`/texto colado):

1. Usuário anexa `.pdf` ou `.docx` (arquivo real, gerado digitalmente — **não** foto nem escaneado)
2. **Antes** de qualquer chamada de IA, extrair o texto puro do arquivo:
   - PDF → biblioteca `pdf-parse`
   - Word (`.docx`) → biblioteca `mammoth`
3. O texto extraído entra no mesmo pipeline de geração (resumo/flashcards/questões/checklist/mapa mental) já existente, agora chamando a Groq em vez da heurística local

Essa extração roda em segundos, não tem custo de IA e cobre a grande maioria dos materiais reais dos usuários (slides, apostilas e provas exportados de Word/PowerPoint/Google Docs). Fica de fora apenas PDF/foto escaneada (imagem sem texto selecionável) — que não é o caso que a Raquel quer suportar, então não é um requisito aqui.

## 5. Pagamento

Integrar Stripe para assinatura (mensal/anual), com um endpoint que verifica o status da assinatura antes de liberar as telas do app.

## 6. Hospedagem e domínio (✅ caminho pronto — ver "Publicando num site" no README.md)

Deploy no Vercel, conectado ao repositório. Domínio próprio configurado depois de validar o produto.

## 7. Segurança e conformidade

- Chaves de API (Groq, Stripe, Supabase) só em variáveis de ambiente do servidor, nunca no código do frontend
- RLS ativo em todas as tabelas desde o primeiro dia
- Rate limiting nos endpoints de IA (evita abuso e custo inesperado)
- Política de privacidade e termos de uso — o app guarda dados pessoais de estudo (LGPD)
- Fluxo de exclusão de conta/dados a pedido do usuário

## 8. Ordem sugerida de execução

1. Setar projeto Next.js + Supabase (banco + auth)
2. Portar as telas do protótipo (reaproveitando a lógica de UI já validada)
3. Trocar o `Store` (localStorage) por chamadas ao Supabase
4. Implementar as rotas de IA com Groq, uma função de cada vez (começar por flashcards, que é o fluxo mais usado)
5. Adicionar upload de PDF/Word com `pdf-parse`/`mammoth`
6. Integrar Stripe
7. Deploy no Vercel e teste com usuários reais antes de abrir pagamento
