from dataclasses import dataclass
from typing import List


@dataclass
class VideoIdea:
    titulo: str
    objetivo: str
    formato: str
    gancho: str


class LoadContentAgent:
    """Gera ideias de vídeos alinhadas à identidade da Load Arquitetura."""

    def __init__(self, empresa: str = "Load Arquitetura", voz: str = "Lorena") -> None:
        self.empresa = empresa
        self.voz = voz
        self.pilares = [
            "Educação",
            "Transformação",
            "Autoridade",
            "Identidade e rotina",
            "Acessibilidade e inclusão",
        ]

    def gerar_ideias(self, comando: str, quantidade: int = 6) -> List[VideoIdea]:
        quantidade_ajustada = max(5, min(10, quantidade))
        temas_base = self._temas_padrao(comando)
        ideias = []

        for tema in temas_base:
            if len(ideias) >= quantidade_ajustada:
                break
            ideias.append(self._montar_ideia(tema))

        while len(ideias) < quantidade_ajustada:
            temas_extra = {
                "pilar": "Acessibilidade e inclusão",
                "titulo": "Acessibilidade sem perder a identidade do morador",
                "objetivo": "mostrar como inclusão é ponto de partida para um lar funcional",
                "formato": "bastidor com exemplos reais",
                "gancho": "Se o projeto não abraça todas as pessoas da casa, ele está incompleto.",
            }
            ideias.append(self._montar_ideia(temas_extra))

        return ideias

    def formatar_para_whatsapp(self, ideias: List[VideoIdea]) -> str:
        linhas = [
            f"Sugestões para {self.empresa} — estilo {self.voz}",
            "(Clareza, leveza e autoridade; foco em funcionalidade e propósito)",
            "",
        ]
        for indice, ideia in enumerate(ideias, start=1):
            linhas.extend(
                [
                    f"{indice}. {ideia.titulo} [{ideia.formato}]",
                    f"   Objetivo: {ideia.objetivo}",
                    f"   Gancho: {ideia.gancho}",
                ]
            )
        return "\n".join(linhas)

    def _temas_padrao(self, comando: str) -> List[dict]:
        referencia = comando.lower()
        preferencia_formato = "YouTube" if "longo" in referencia else "Reels/Shorts"

        return [
            {
                "pilar": "Educação",
                "titulo": "Por que funcionalidade vale mais que qualquer tendência",
                "objetivo": "explicar como decisões funcionais evitam reformas caras no futuro",
                "formato": f"opinião guiada ({preferencia_formato})",
                "gancho": "Antes de copiar o Pinterest, descubra se sua casa consegue respirar com esse layout.",
            },
            {
                "pilar": "Transformação",
                "titulo": "Antes e depois: o corredor escuro que virou um eixo de convivência",
                "objetivo": "provar que pequenas intervenções mudam a rotina da família",
                "formato": f"case com storytelling ({preferencia_formato})",
                "gancho": "Esse corredor era só passagem. Agora, é onde a família se encontra sem tropeços.",
            },
            {
                "pilar": "Autoridade",
                "titulo": "O mito da cozinha gourmet que só serve para foto",
                "objetivo": "defender projetos com propósito e uso real, não só estética",
                "formato": f"opinião firme com exemplos ({preferencia_formato})",
                "gancho": "Se a cozinha trava a circulação, ela não é gourmet: é um obstáculo caro.",
            },
            {
                "pilar": "Identidade e rotina",
                "titulo": "Como traduzir a história da família em escolhas de layout",
                "objetivo": "mostrar o método da Load para personalização real",
                "formato": f"tutorial + reflexões ({preferencia_formato})",
                "gancho": "Antes de escolher materiais, eu pergunto: quais rituais vocês querem manter em casa?",
            },
            {
                "pilar": "Acessibilidade e inclusão",
                "titulo": "Checklist de inclusão: 5 ajustes que cabem em qualquer reforma",
                "objetivo": "ensinar ajustes simples para conforto, segurança e autonomia",
                "formato": f"lista prática ({preferencia_formato})",
                "gancho": "Corrimão certo, iluminação certa, altura certa: acessibilidade não é opcional.",
            },
            {
                "pilar": "Transformação",
                "titulo": "Três decisões que reduzem o medo de errar na reforma",
                "objetivo": "diminuir a ansiedade do público mostrando clareza de processo",
                "formato": f"guia passo a passo ({preferencia_formato})",
                "gancho": "Antes de quebrar paredes, alinhe quem decide, quanto investir e como conviver com a obra.",
            },
            {
                "pilar": "Identidade e rotina",
                "titulo": "Vlog: um dia acompanhando a obra de um apartamento compacto",
                "objetivo": "humanizar o processo e reforçar escuta ativa com o cliente",
                "formato": f"bastidor narrado ({preferencia_formato})",
                "gancho": "Hoje eu te levo para a obra onde até o rodapé foi pensado para caber uma cadeira de rodas.",
            },
            {
                "pilar": "Autoridade",
                "titulo": "Por que a Load não entrega projeto sem manual de uso",
                "objetivo": "reforçar metodologia própria e clareza no pós-obra",
                "formato": f"opinião + apresentação de processo ({preferencia_formato})",
                "gancho": "Projeto bom não acaba na entrega. Ele explica como o espaço deve funcionar todo dia.",
            },
            {
                "pilar": "Educação",
                "titulo": "Mitos e verdades: iluminação natural em apartamentos térreos",
                "objetivo": "educar sobre soluções acessíveis de luz e ventilação",
                "formato": f"mitos e verdades ({preferencia_formato})",
                "gancho": "Apartamento térreo não precisa ser escuro: três ajustes mudam tudo.",
            },
            {
                "pilar": "Transformação",
                "titulo": "O que eu mudaria na sala que cansa antes do dia acabar",
                "objetivo": "diagnosticar erros comuns e mostrar correções práticas",
                "formato": f"análise de erros + correção ({preferencia_formato})",
                "gancho": "Se sua sala te esgota, provavelmente é culpa da circulação e da iluminação.",
            },
        ]

    def _montar_ideia(self, tema: dict) -> VideoIdea:
        return VideoIdea(
            titulo=tema["titulo"],
            objetivo=tema["objetivo"],
            formato=tema["formato"],
            gancho=tema["gancho"],
        )


def handle_whatsapp_message(texto: str, quantidade: int = 6) -> str:
    agente = LoadContentAgent()
    ideias = agente.gerar_ideias(texto, quantidade)
    return agente.formatar_para_whatsapp(ideias)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Gera sugestões de vídeos para a Load Arquitetura em formato pronto para WhatsApp.",
    )
    parser.add_argument(
        "comando",
        type=str,
        nargs="?",
        default="Liste ideias de vídeos curtos",
        help="Pedido do time interno descrevendo o tipo de vídeo desejado.",
    )
    parser.add_argument(
        "--quantidade",
        type=int,
        default=6,
        help="Quantidade de ideias (entre 5 e 10).",
    )
    args = parser.parse_args()

    mensagem = handle_whatsapp_message(args.comando, args.quantidade)
    print(mensagem)
