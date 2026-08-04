# Estuda+ — Resumos e Flashcards sincronizados

Protótipo (MVP) da plataforma única de estudos para **Concurso, Vestibular e
Graduação**, com foco no recurso central discutido no planejamento: **Resumos**
e **Flashcards** vivendo em perfeita sincronia, mais uma **revisão espaçada**
simples baseada em Acertei/Errei.

Este é um app 100% estático (HTML/CSS/JS puro, sem build, sem dependências
externas), então roda em qualquer navegador sem `npm install`.

## Rodando localmente

```bash
cd estuda-mais
python3 -m http.server 8080
# abra http://localhost:8080
```

Ou simplesmente abra `index.html` diretamente no navegador.

Os dados (pastas, resumos, flashcards e progresso de revisão) ficam salvos no
`localStorage` do navegador — não há backend nesta fase.

## O que está implementado

- **Onboarding por modo de estudo** (Concurso / Vestibular / Graduação,
  multi-seleção) que ajusta as prioridades exibidas no Painel.
- **Organização por assunto/subassunto** (pastas e subpastas), compartilhada
  entre Resumos e Flashcards — o mesmo assunto vira o mesmo baralho.
- **Resumos**: editor rico (contentEditable) com título, formatação
  (negrito, itálico, títulos, citação, lista, destaque, link, imagem),
  organização por pasta e geração assistida por "IA" (simulada localmente
  nesta fase — a interface já está pronta para plugar um modelo real depois).
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
    ai.js               # geração de resumo/flashcard "IA" (mock local)
    ui-utils.js          # toast, modal, helpers de formatação
    views/
      dashboard.js
      resumos.js
      flashcards.js
```
