// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

/** Prioridade didática da visita: 3 = ir primeiro, 2 = ir esta semana, 1 = visita de rotina. */
export interface Casa {
  id: string;
  /** Nome inventado do chefe da família: todas as famílias do jogo são fictícias. */
  familia: string;
  situacao: string;
  prioridade: 1 | 2 | 3;
  /** O que o ACS faz: nunca diagnostica nem receita, encaminha à equipe. */
  porque: string;
}

export const CASAS: Casa[] = [
  {
    id: "c1",
    familia: "Casa de dona Zilda",
    situacao: "Moça de 8 meses de gravidez que, até agora, não fez nenhuma consulta de pré-natal.",
    prioridade: 3,
    porque: "Gestante sem acompanhamento é um dos grupos que a lei manda acompanhar com visitas periódicas. O agente combina e encaminha a primeira consulta na unidade.",
  },
  {
    id: "c2",
    familia: "Casa do seu Altair",
    situacao: "Idoso que mora só e passou a ficar na cama; a vizinha diz que ele não come direito.",
    prioridade: 3,
    porque: "Idoso e em situação de risco: a visita avisa a equipe, que decide o que fazer. O agente não faz exame nem diagnóstico.",
  },
  {
    id: "c3",
    familia: "Casa da família Barros",
    situacao: "Criança de 6 anos com febre há 4 dias, segundo a mãe.",
    prioridade: 3,
    porque: "Quem tem sinal ou sintoma de doença é encaminhado à unidade de saúde (Lei 11.350/2006, art. 3º, § 2º). O agente não diz do que se trata.",
  },
  {
    id: "c4",
    familia: "Casa do seu Genivaldo",
    situacao: "Hipertenso que parou de ir buscar o remédio porque perdeu o emprego e está sem dinheiro para a passagem.",
    prioridade: 2,
    porque: "Situação de risco e de vulnerabilidade (art. 3º, § 3º, V). O agente pode combinar com a equipe uma entrega ou outra forma de chegar ao remédio.",
  },
  {
    id: "c5",
    familia: "Casa da dona Marlene",
    situacao: "Recém-nascida de 15 dias; a mãe amamenta e quer tirar dúvidas.",
    prioridade: 2,
    porque: "Lactante e criança pequena também têm visita periódica prevista (art. 3º, § 3º, IV). Pode esperar poucos dias, mas não muitos.",
  },
  {
    id: "c6",
    familia: "Casa da família Teixeira",
    situacao: "Adultos sem queixa, vacinas em dia, caderneta conferida no mês passado.",
    prioridade: 1,
    porque: "Visita de rotina. O agente segue o calendário de acompanhamento depois de atender quem tem mais urgência.",
  },
];

export interface PerguntaDeSigilo {
  cena: string;
  opcoes: { texto: string; certa: boolean; retorno: string }[];
}

export const SIGILO: PerguntaDeSigilo = {
  cena: "Na quitanda, a vizinha pergunta: 'Você que anda na casa do seu Altair, ele tem aquela doença, não é?'. O que você faz?",
  opcoes: [
    { texto: "Conto só para ela, porque ela é de confiança.", certa: false, retorno: "Não. Informação de saúde ligada a uma pessoa é dado pessoal sensível: o tratamento só pode ocorrer nas hipóteses da lei (LGPD, art. 5º, II, e art. 11)." },
    { texto: "Digo que não posso falar da saúde de ninguém e me ofereço para ajudar a vizinha a procurar a unidade, se ela precisar.", certa: true, retorno: "Certo. O registro das visitas existe para controlar e planejar as ações de saúde (Lei 11.350/2006, art. 3º, § 3º, II), e não para circular na vizinhança." },
    { texto: "Digo só 'é coisa séria', sem dar nome.", certa: false, retorno: "Mesmo sem o nome da doença, dá para identificar a pessoa e assustar a vizinhança. Melhor não comentar." },
  ],
};

export const FONTES_SAUDE: Fonte[] = [
  { nome: "Lei 11.350/2006, agentes comunitários de saúde (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11350.htm" },
  { nome: "Lei 13.709/2018, LGPD (planalto.gov.br)", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" },
];

/** Casas ordenadas da mais urgente para a de rotina (a ordem de leitura de quem confere o resultado). */
export function ordemSugerida(casas: readonly Casa[]): Casa[] {
  return [...casas].sort((a, b) => b.prioridade - a.prioridade);
}

/** Dadas as três casas escolhidas, diz quantas são das de prioridade máxima que deveriam ter sido escolhidas. */
export function avaliarEscolha(casas: readonly Casa[], escolhidas: readonly string[]): { acertos: number; total: number; faltou: Casa[] } {
  const maximas = casas.filter((c) => c.prioridade === 3);
  const acertos = maximas.filter((c) => escolhidas.includes(c.id)).length;
  return { acertos, total: maximas.length, faltou: maximas.filter((c) => !escolhidas.includes(c.id)) };
}
