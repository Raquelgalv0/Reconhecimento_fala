# Estuda+ — Resumos e Flashcards sincronizados

Protótipo (MVP) da plataforma única de estudos para **Concurso, Vestibular e
Graduação**, com foco no recurso central discutido no planejamento: **Resumos**
e **Flashcards** vivendo em perfeita sincronia, mais uma **revisão espaçada**
simples baseada em Acertei/Errei.

Este é um app 100% estático (HTML/CSS/JS puro, sem build, sem dependências
externas), então roda em qualquer navegador sem `npm install`.

## Rodando localmente

**Com IA real (Groq)** — recomendado, requer Node.js 18+:

```bash
cd estuda-mais
cp .env.local.example .env.local
# edite .env.local e cole sua GROQ_API_KEY
node server.js
# abra http://localhost:8000
```

O arquivo `.env.local` nunca é commitado (está no `.gitignore`) — a chave fica
só no seu computador, e só o `server.js` (rodando no seu próprio computador)
fala com a Groq. O navegador nunca vê a chave.

**Sem IA (só para navegar pela interface)**, sem precisar de Node:

```bash
cd estuda-mais
python3 -m http.server 8080
# abra http://localhost:8080
```

Nesse modo, tudo funciona normalmente exceto os botões de geração por IA
("Gerar com IA", "Sugerir comentário", "Processar com IA" no Upload), que
mostram um aviso pedindo para rodar via `node server.js`.

Os dados (pastas, resumos, flashcards, questões e progresso) ficam salvos no
`localStorage` do navegador — não há banco de dados nesta fase (cada pessoa
que acessa tem seus próprios dados, isolados no navegador dela).

## Publicando num site (link público)

`server.js` é para uso local. Para um link público de verdade, é preciso um
serviço que rode a parte de servidor — GitHub Pages **não** serve, porque só
publica arquivos estáticos e não executa código, então a IA não funcionaria.

O jeito mais simples é a **Vercel** (tem plano gratuito):

1. Crie uma conta em vercel.com e conecte com o GitHub
2. "Add New Project" → selecione este repositório
3. Em **Root Directory**, aponte para `estuda-mais`
4. Em **Environment Variables**, adicione `GROQ_API_KEY` com sua chave (cole
   direto no campo da Vercel — nunca no código)
5. Deploy

O projeto já está estruturado para isso: `api/ai.js` vira automaticamente uma
função na nuvem (mesma lógica do `/api/ai` do `server.js`, compartilhada via
`lib/groq.js`), e os arquivos estáticos são servidos pela própria Vercel.

> **Atenção antes de divulgar o link**: como ainda não há login, qualquer
> pessoa com o link consegue usar os botões de IA — e isso consome a sua
> chave/seu crédito na Groq. Para um teste com poucas pessoas de confiança,
> tudo bem. Para divulgação ampla e pública, espere a etapa de autenticação
> do roteiro de migração (veja `MIGRATION.md`) e considere configurar um
> limite de gasto na sua conta da Groq como proteção extra nesse meio-tempo.

## O que está implementado

- **Onboarding por modo de estudo** (Concurso / Vestibular / Graduação,
  multi-seleção) que ajusta as prioridades exibidas no Painel.
- **Organização por assunto/subassunto** (pastas e subpastas), compartilhada
  entre Resumos e Flashcards — o mesmo assunto vira o mesmo baralho.
- **Resumos**: editor rico (contentEditable) com título, formatação
  (negrito, itálico, títulos, citação, lista, destaque, link, imagem),
  organização por pasta e geração assistida por IA real (Groq, via `server.js`).
- **Sincronização Resumo → Flashcard**: ao selecionar um trecho do resumo,
  aparece uma barra flutuante com a opção "✨ Criar Flashcard". O app sugere
  pergunta/resposta a partir do trecho, o usuário revisa e salva — o
  flashcard é criado automaticamente no baralho do mesmo assunto e o trecho
  fica destacado e clicável no resumo, linkando de volta ao flashcard.
- **Flashcards**: criação manual (frente, verso, dica), cartão que vira
  (flip), e "dica" = o assunto/baralho do cartão (preenchido automaticamente
  pela pasta, editável).
- **Revisão espaçada (regra simples do MVP)**: errou hoje → volta em 1 dia;
  acertou → intervalo cresce 2, 4, 8, 15, 30, 45, 60 dias. Fila de "Revisar
  hoje" por baralho ou geral.
- **Painel** com estatísticas gerais e prioridades específicas de cada modo
  de estudo selecionado.

## Fora de escopo nesta fase

Banco de questões, análises de erro por alternativa e o algoritmo adaptativo
(FSRS) fazem parte da visão completa da plataforma (ver RF4–RF8 do
planejamento), mas não estão implementados neste protótipo — o foco aqui foi
validar a experiência de Resumos + Flashcards sincronizados, que é a peça
central do produto.

## Estrutura

```
estuda-mais/
  index.html
  style.css
  js/
    app.js          # shell, onboarding, sidebar, roteamento
    store.js         # estado + persistência em localStorage
    srs.js            # regra de revisão espaçada
    ai.js               # chama a IA (Groq) via /api/ai do server.js
    ui-utils.js          # toast, modal, helpers de formatação
    views/
      dashboard.js
      resumos.js
      flashcards.js
```
