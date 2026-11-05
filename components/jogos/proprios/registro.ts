// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Registro dos jogos próprios. A página /[lang]/jogos lê JOGOS_PROPRIOS (só dados, sem React) para listar os cartões e
// usa JogoProprio (components/jogos/proprios/Catalogo.tsx) para abrir o jogo escolhido, carregado só nessa hora.
// Para a parte 2 (Etapa 5), basta acrescentar itens aqui e um caso em Catalogo.tsx.

export type PublicoDoJogo = "todos" | "adultos" | "jovens";

export interface JogoProprioInfo {
  slug: string;
  titulo: string;
  resumo: string;
  /** Tempo de uma partida, em minutos (aproximado). */
  minutos: number;
  publico: PublicoDoJogo;
  /** O jogo precisa das checagens lidas no servidor (lerChecagensParaJogo). */
  precisaChecagens?: boolean;
  /** Tema do currículo, para ligar o jogo às aulas. */
  tema: string;
}

export const JOGOS_PROPRIOS: JogoProprioInfo[] = [
  { slug: "linha-de-montagem", titulo: "Linha de montagem", resumo: "Em que hora do dia o trabalhador já pagou o próprio salário? Veja a mais-valia na jornada.", minutos: 5, publico: "adultos", tema: "economia-trabalho" },
  { slug: "quem-e-o-dono", titulo: "Quem é o dono?", resumo: "Para onde vai cada parte dos R$ 100 de um par de sapatos? Arraste ou escolha com o teclado.", minutos: 5, publico: "todos", tema: "economia-trabalho" },
  { slug: "conquistas-e-greves", titulo: "Conquistas e greves", resumo: "Ligue 13º, férias e jornada de oito horas às leis que os garantem e à pauta da greve de 1917.", minutos: 8, publico: "todos", tema: "economia-trabalho" },
  { slug: "orcamento", titulo: "Orçamento: quem paga a conta?", resumo: "O tamanho do bolo (Receita Federal), o orçamento da família (IBGE) e o peso do imposto no preço.", minutos: 8, publico: "adultos", tema: "estado-democracia" },
  { slug: "fato-ou-boato", titulo: "Fato ou boato?", resumo: "Cinco frases que circulam por aí, com a resposta das checagens do Instituto.", minutos: 4, publico: "todos", precisaChecagens: true, tema: "estado-democracia" },
  { slug: "detetive-de-fake-news", titulo: "Detetive de fake news", resumo: "Ache os sinais de alerta numa corrente inventada, sem cair em falso alarme.", minutos: 4, publico: "todos", tema: "estado-democracia" },
  { slug: "catraca-e-relogio", titulo: "A catraca e o relógio", resumo: "As 24 horas de quem trabalha: quanto o trajeto e a jornada deixam para a vida?", minutos: 3, publico: "todos", tema: "economia-trabalho" },
  { slug: "negociacao-coletiva", titulo: "Negociação coletiva", resumo: "Três decisões na mesa do sindicato, em texto, e nenhuma delas é perfeita.", minutos: 6, publico: "adultos", tema: "economia-trabalho" },
];

export function jogoPropioPorSlug(slug: string): JogoProprioInfo | undefined {
  return JOGOS_PROPRIOS.find((j) => j.slug === slug);
}
