// Modos de estudo (as "Alas") — compartilhado entre o onboarding (app.js) e
// a tela de Assuntos (que deixa migrar uma pasta de uma Ala pra outra).
export const MODES = [
  { id: "concurso", icon: "barChart", title: "Concurso público", desc: "Banco de questões, cadernos por assunto e revisão de erros." },
  { id: "vestibular", icon: "graduationCap", title: "Vestibular", desc: "Resumo por tópico, flashcards essenciais e metas de conteúdo." },
  { id: "graduacao", icon: "landmark", title: "Graduação", desc: "Organização por disciplina, datas de provas e revisão para retenção." },
  { id: "medicina", icon: "pulse", title: "Medicina", desc: "Resumos com modelo clínico, questões de caso clínico e conceituais, flashcards por assunto." },
];

export const MODE_TAG = { concurso: "Concurso", vestibular: "Vestibular", graduacao: "Graduação", medicina: "Medicina" };
