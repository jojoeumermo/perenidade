// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// A Mesa por função (Etapa 8, B39): a regra, sem tela. Cada função de trabalho vê as mesmas cinco partes (pendências,
// recados, avisos de segurança, saúde da casa e atalhos), mas na ordem e com a ênfase do que ela faz. Nada some: uma
// pessoa só deixa de ver, no alto, o que não é da sua função; tudo continua no menu e na Paleta (Ctrl K).
// Este arquivo não importa nada de React: o teste (scripts/testar-mesa.mjs) o carrega direto no Node.

export type FuncaoDaMesa = "coordenacao" | "revisao" | "comunicacao" | "desenvolvimento" | "curadoria" | "moderacao" | "educador" | "geral";
export type ParteDaMesa = "pendencias" | "seguranca" | "recados" | "casa" | "atalhos";
export type TipoDePendencia = "revisar" | "responder" | "fazer";

export interface DadosDaFuncao {
  id: FuncaoDaMesa;
  nome: string;
  /** Uma frase que diz o que esta Mesa põe em primeiro lugar. */
  sobre: string;
  /** A ordem das cinco partes. Todas aparecem; a ordem é que muda. */
  ordem: ParteDaMesa[];
  /** As pendências (chaves de `ITENS`) que sobem para o alto, na ordem. As outras vêm depois, na ordem de sempre. */
  prioridade: string[];
  /** Seções (ids do painel) que viram atalhos, na ordem; as que a pessoa não pode abrir são ignoradas. */
  atalhos: string[];
  /** O bloco de avisos de segurança aparece mesmo vazio ("tudo em ordem"): é parte do trabalho desta função. */
  segurancaAberta: boolean;
}

export const FUNCOES_DA_MESA: DadosDaFuncao[] = [
  {
    id: "coordenacao",
    nome: "Coordenação",
    sobre: "A casa inteira em ordem: o que precisa de decisão, o que é de segurança e como está a equipe.",
    ordem: ["seguranca", "pendencias", "casa", "recados", "atalhos"],
    prioridade: ["pedidos_supervisao", "suspensas", "publicacao_atrasada", "candidaturas", "denuncias", "pedidos", "testemunhar", "horas"],
    atalhos: ["pessoas", "departamentos", "supervisao", "interdicao", "site", "estatisticas", "registro", "avisos"],
    segurancaAberta: true,
  },
  {
    id: "revisao",
    nome: "Revisão",
    sobre: "A fila de revisão e as traduções em primeiro lugar; o resto da casa fica mais abaixo.",
    ordem: ["pendencias", "recados", "atalhos", "casa", "seguranca"],
    prioridade: ["fila", "aguardando_publicacao", "juntas", "triagem", "pedidos_ajuda"],
    atalhos: ["fila", "traducoes", "juntas", "escrever", "fontes", "biblioteca"],
    segurancaAberta: false,
  },
  {
    id: "comunicacao",
    nome: "Comunicação",
    sobre: "Posts, jornal, rádio e podcast: o que sai e o que foi devolvido, antes de tudo.",
    ordem: ["pendencias", "atalhos", "recados", "casa", "seguranca"],
    prioridade: ["divulgacao", "fila", "juntas", "pedidos_ajuda", "mural"],
    atalhos: ["divulgacao", "estudio", "pautas", "podcast", "aovivo", "materiais"],
    segurancaAberta: false,
  },
  {
    id: "desenvolvimento",
    nome: "UI/UX e Desenvolvimento",
    sobre: "A saúde técnica primeiro: publicação parada, erros relatados e o estado do site.",
    ordem: ["casa", "seguranca", "pendencias", "recados", "atalhos"],
    prioridade: ["publicacao_atrasada", "pedidos_ajuda", "juntas"],
    atalhos: ["erros", "tecnico", "site", "estudio", "estatisticas", "registro"],
    segurancaAberta: true,
  },
  {
    id: "curadoria",
    nome: "Curadoria",
    sobre: "O acervo e o Vale o Escrito: o que espera decisão da curadoria.",
    ordem: ["pendencias", "recados", "atalhos", "casa", "seguranca"],
    prioridade: ["triagem", "gaveta", "fila", "juntas"],
    atalhos: ["vale-curadoria", "acervo-dentro", "triagem", "gaveta", "fontes", "biblioteca"],
    segurancaAberta: false,
  },
  {
    id: "moderacao",
    nome: "Moderação",
    sobre: "A Comunidade e o Mural de Saúde: denúncias, mensagens retidas e anúncios.",
    ordem: ["seguranca", "pendencias", "recados", "atalhos", "casa"],
    prioridade: ["denuncias", "retidos", "anotacoes", "mural", "reforco", "gaveta", "triagem"],
    atalhos: ["comunidade", "mural", "saude", "reforco", "gaveta", "triagem"],
    segurancaAberta: true,
  },
  {
    id: "educador",
    nome: "Educador",
    sobre: "Aulas, exercícios e reforço: o que os alunos pedem e o que espera a sua correção.",
    ordem: ["pendencias", "atalhos", "recados", "casa", "seguranca"],
    prioridade: ["reforco", "juntas", "fila", "pedidos_ajuda", "mural"],
    atalhos: ["escrever", "videoaulas", "exercicios", "reforco", "curriculo", "aulas-a-escrever"],
    segurancaAberta: false,
  },
  {
    id: "geral",
    nome: "Geral",
    sobre: "O que chegou para você, os recados e o caminho do dia a dia.",
    ordem: ["pendencias", "recados", "atalhos", "casa", "seguranca"],
    prioridade: ["juntas", "fila"],
    atalhos: ["escrever", "minhas", "tarefas", "caderno", "conversas"],
    segurancaAberta: false,
  },
];

/** Atalhos que toda Mesa tem no fim, quando a pessoa pode abrir a seção. */
export const ATALHOS_COMUNS = ["conversas", "minhas", "tarefas", "caderno", "conta"];

export const NOME_DA_PARTE: Record<ParteDaMesa, string> = {
  pendencias: "Pendências",
  recados: "Recados",
  seguranca: "Avisos de segurança",
  casa: "Saúde da casa",
  atalhos: "Atalhos",
};

export const dadosDaFuncao = (id: FuncaoDaMesa): DadosDaFuncao => FUNCOES_DA_MESA.find((f) => f.id === id) ?? FUNCOES_DA_MESA[FUNCOES_DA_MESA.length - 1];

/**
 * De qual função é cada papel do banco. Supervisão fica com a Coordenação (acompanha a equipe e a segurança); Design vai
 * para Comunicação (a arte é do Marketing, B10). Representante e quem não tem papel ficam na Geral.
 */
export const FUNCAO_DO_PAPEL: Record<string, FuncaoDaMesa> = {
  coordenacao: "coordenacao",
  vice: "coordenacao",
  supervisao: "coordenacao",
  revisao: "revisao",
  traducao: "revisao",
  jornalismo: "comunicacao",
  marketing: "comunicacao",
  porta_voz: "comunicacao",
  design: "comunicacao",
  desenvolvimento: "desenvolvimento",
  curadoria: "curadoria",
  mediacao: "moderacao",
  saude: "moderacao",
  educacao: "educador",
  educacao_secundaria: "educador",
  mentoria: "educador",
};

/** As funções da pessoa, a de maior responsabilidade primeiro; sempre ao menos "geral". Sem repetir. */
export function funcoesDaPessoa(papeis: string[]): FuncaoDaMesa[] {
  const achadas: FuncaoDaMesa[] = [];
  for (const papel of papeis) {
    const f = FUNCAO_DO_PAPEL[papel];
    if (f && !achadas.includes(f)) achadas.push(f);
  }
  const posicao = (f: FuncaoDaMesa) => FUNCOES_DA_MESA.findIndex((x) => x.id === f);
  achadas.sort((a, b) => posicao(a) - posicao(b));
  return achadas.length > 0 ? achadas : ["geral"];
}

/** Cada pendência da Mesa: de qual campo do resumo vem, o que diz, para onde leva e em qual parte da Mesa mora. */
export interface ItemDePendencia {
  chave: string;
  titulo: string;
  destino: string;
  tipo: TipoDePendencia;
  parte: "pendencias" | "seguranca";
  /** Só quem coordena vê o destino "pessoas"; os outros caem em "supervisao". */
  destinoDaCoordenacao?: string;
}

export const ITENS: ItemDePendencia[] = [
  { chave: "juntas", titulo: "Colegas chamaram você para trabalhar junto", destino: "juntas", tipo: "revisar", parte: "pendencias" },
  { chave: "triagem", titulo: "Envios do público para a triagem", destino: "triagem", tipo: "revisar", parte: "pendencias" },
  { chave: "fila", titulo: "Na fila de revisão", destino: "fila", tipo: "revisar", parte: "pendencias" },
  { chave: "aguardando_publicacao", titulo: "Aprovadas, esperando a publicação", destino: "fila", tipo: "revisar", parte: "pendencias" },
  { chave: "candidaturas", titulo: "Pedidos de voluntariado", destino: "supervisao", destinoDaCoordenacao: "pessoas", tipo: "responder", parte: "pendencias" },
  { chave: "pedidos_ajuda", titulo: "Pedidos de ajuda para a sua função", destino: "rede", tipo: "responder", parte: "pendencias" },
  { chave: "suspensas", titulo: "Contas suspensas pela supervisão", destino: "supervisao", destinoDaCoordenacao: "pessoas", tipo: "responder", parte: "seguranca" },
  { chave: "divulgacao", titulo: "Posts para sair ou devolvidos", destino: "divulgacao", tipo: "fazer", parte: "pendencias" },
  { chave: "publicacao_atrasada", titulo: "Aprovadas há mais de três horas sem ir ao ar", destino: "tecnico", tipo: "fazer", parte: "seguranca" },
  { chave: "pedidos_supervisao", titulo: "Pedidos da supervisão esperando decisão", destino: "interdicao", tipo: "responder", parte: "seguranca" },
  { chave: "denuncias", titulo: "Denúncias abertas", destino: "comunidade", tipo: "responder", parte: "seguranca" },
  { chave: "anotacoes", titulo: "Anotações para olhar", destino: "comunidade", tipo: "responder", parte: "pendencias" },
  { chave: "retidos", titulo: "Mensagens esperando a mediação", destino: "comunidade", tipo: "responder", parte: "pendencias" },
  { chave: "reforco", titulo: "Pedidos de reforço", destino: "reforco", tipo: "responder", parte: "pendencias" },
  { chave: "pedidos", titulo: "Pedidos de certificado", destino: "horas", tipo: "responder", parte: "pendencias" },
  { chave: "horas", titulo: "Horas para conferir", destino: "horas", tipo: "revisar", parte: "pendencias" },
  { chave: "testemunhar", titulo: "Certificados esperando a sua assinatura", destino: "horas", tipo: "fazer", parte: "pendencias" },
  { chave: "mural", titulo: "Anúncios do mural", destino: "mural", tipo: "revisar", parte: "pendencias" },
  { chave: "gaveta", titulo: "Trabalhos na Gaveta Aberta", destino: "gaveta", tipo: "revisar", parte: "pendencias" },
];

export interface Pendencia extends ItemDePendencia {
  n: number;
  /** Para onde o botão leva de fato (já com a escolha entre coordenação e supervisão). */
  vai: string;
}

/**
 * Do resumo do banco para as pendências: só o que tem número maior que zero e cuja seção a pessoa pode abrir
 * (`abre` diz se o id da seção existe para ela). A ordem é a da função; o que não está na prioridade vem depois.
 */
export function montarPendencias(resumo: Record<string, number | undefined> | null, opcoes: { funcao: FuncaoDaMesa; coordena: boolean; abre: (secao: string) => boolean }): Pendencia[] {
  if (!resumo) return [];
  const ordem = dadosDaFuncao(opcoes.funcao).prioridade;
  const lista: Pendencia[] = [];
  for (const item of ITENS) {
    const n = Number(resumo[item.chave] ?? 0);
    const vai = opcoes.coordena && item.destinoDaCoordenacao ? item.destinoDaCoordenacao : item.destino;
    if (n > 0 && opcoes.abre(vai)) lista.push({ ...item, n, vai });
  }
  const peso = (p: Pendencia) => {
    const i = ordem.indexOf(p.chave);
    return i === -1 ? ordem.length : i;
  };
  // sort é estável: dentro do mesmo peso fica a ordem de ITENS.
  return lista.sort((a, b) => peso(a) - peso(b));
}

export const dasPendencias = (lista: Pendencia[]) => lista.filter((p) => p.parte === "pendencias");
export const dosAvisosDeSeguranca = (lista: Pendencia[]) => lista.filter((p) => p.parte === "seguranca");
export const somar = (lista: Pendencia[]) => lista.reduce((soma, p) => soma + p.n, 0);

/** Os atalhos da função, só os que a pessoa pode abrir, sem repetir, com os comuns no fim. */
export function atalhosDaFuncao(funcao: FuncaoDaMesa, abre: (secao: string) => boolean): string[] {
  const todos = [...dadosDaFuncao(funcao).atalhos, ...ATALHOS_COMUNS];
  return todos.filter((id, i) => todos.indexOf(id) === i && abre(id));
}

/** "Departamentos com pouca gente" (B14): o limite, escrito num lugar só. Zero ou uma pessoa na equipe do departamento. */
export const LIMITE_DE_POUCA_GENTE = 1;
