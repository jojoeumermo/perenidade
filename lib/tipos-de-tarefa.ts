// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos de tarefa do "Para você hoje": nome, tempo, dificuldade, quem costuma fazer, o que muda e como fazer. Puro
// (sem leitura de arquivo), para o painel e o verificador do acervo usarem o mesmo texto.

export type TipoDeLacuna = "ficha_ano" | "ficha_sinopse" | "licenca" | "sem_ligacao" | "biografia" | "duplicata" | "traducao" | "revisao_aula" | "imagem_alt" | "link" | "avulsa";

/** O que cada tipo de tarefa pede: tempo, dificuldade, quem costuma fazer e o que muda quando fica pronta. */
export const TIPOS: Record<TipoDeLacuna, { nome: string; minutos: 5 | 15 | 30; dificuldade: "iniciante" | "intermediario" | "avancado"; papel: string; impacto: string; como: string }> = {
  ficha_ano: { nome: "Completar o ano da obra", minutos: 5, dificuldade: "iniciante", papel: "", impacto: "A obra passa a aparecer na época certa da linha do tempo e nos filtros.", como: "Abra o link da obra, ache o ano da primeira publicação (na página da fonte ou no próprio livro) e escreva só o ano." },
  ficha_sinopse: { nome: "Escrever a sinopse", minutos: 15, dificuldade: "intermediario", papel: "", impacto: "Quem encontra a obra na busca entende do que ela trata antes de abrir.", como: "Leia o começo da obra e escreva de duas a quatro frases: do que trata, para quem serve e por que ler. Sem copiar texto de outro site." },
  licenca: { nome: "Conferir a licença na fonte", minutos: 15, dificuldade: "intermediario", papel: "curadoria", impacto: "A obra fica com a licença certa e, se for livre, entra nas estantes de domínio público e de licença aberta.", como: "Abra a página da fonte e procure a licença ou a data de morte do autor (70 anos depois, no Brasil, a obra cai em domínio público). Escolha a licença e cole o link onde está escrito." },
  sem_ligacao: { nome: "Indicar a obra numa aula", minutos: 15, dificuldade: "intermediario", papel: "educacao", impacto: "A obra passa a ser lida por quem estuda a trilha, e não só por quem a procura.", como: "Procure uma aula da mesma disciplina em que a obra ajude e diga em qual aula e em que ponto ela entra." },
  biografia: { nome: "Escrever a biografia do autor", minutos: 30, dificuldade: "avancado", papel: "curadoria", impacto: "O autor ganha página própria, com as obras dele reunidas.", como: "Escreva quem foi a pessoa (datas, de onde era, o que fez) em três a seis parágrafos curtos, com as fontes." },
  duplicata: { nome: "Conferir obra possivelmente repetida", minutos: 5, dificuldade: "iniciante", papel: "", impacto: "O acervo fica sem repetição, e a busca mostra cada obra uma vez.", como: "Abra as duas obras e diga se são a mesma (mesmo texto e edição) ou diferentes (outra edição, outro volume, outra tradução)." },
  traducao: { nome: "Traduzir a aula", minutos: 30, dificuldade: "avancado", papel: "traducao", impacto: "A aula passa a existir no idioma, para quem não lê português.", como: "Use o editor lado a lado de Traduções: original à esquerda, tradução à direita, parágrafo a parágrafo." },
  revisao_aula: { nome: "Revisar a aula", minutos: 30, dificuldade: "intermediario", papel: "revisao", impacto: "A aula ganha o selo de revisada e a confiança de quem estuda.", como: "Leia a aula inteira conferindo contas, datas, nomes e fontes. Anote o que precisa mudar; se estiver tudo certo, diga isso." },
  link: { nome: "Consertar o link quebrado", minutos: 15, dificuldade: "intermediario", papel: "", impacto: "Quem clica na obra volta a chegar ao texto.", como: "Procure a mesma obra na fonte (ou em outra fonte legítima e gratuita) e cole o endereço novo, começando com https://." },
  avulsa: { nome: "Tarefa da coordenação", minutos: 15, dificuldade: "iniciante", papel: "", impacto: "", como: "Siga a descrição da tarefa. Na dúvida, peça ajuda a um mentor." },
  imagem_alt: { nome: "Descrever a imagem para quem não vê", minutos: 5, dificuldade: "iniciante", papel: "", impacto: "Quem usa leitor de tela passa a saber o que a imagem mostra.", como: "Descreva em uma frase o que a imagem mostra e por que ela está ali (sem começar com “imagem de”)." },
};
