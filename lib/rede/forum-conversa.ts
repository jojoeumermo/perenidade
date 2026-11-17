// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fórum da comunidade (onda 10, frente 10A; supabase/migracoes/20261116-alumia-o10-forum.sql): a lista de tópicos com a regra
// aberta, o estado do tópico (aberto, encaminhado, resolvido), o resumo de uma linha escrito por gente e o "virar tópico". Tipos,
// as chamadas ao banco, o dublê da prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) e os limites que o teste confere contra o banco.
// Sem "@/" de propósito (roda no Node nos testes).
import { chamar, type Chamar } from "./cliente";

/** Os estados de um tópico, na ordem em que a tela oferece. */
export const ESTADOS_DO_TOPICO = ["aberto", "encaminhado", "resolvido"] as const;
export type EstadoDoTopico = (typeof ESTADOS_DO_TOPICO)[number];

/** As ordens da lista: todas cronológicas, iguais para todo mundo (a regra de cada uma está escrita na tela). */
export const ORDENS_DO_FORUM = ["ultima", "novos", "sem_resposta"] as const;
export type OrdemDoForum = (typeof ORDENS_DO_FORUM)[number];

/** Os tamanhos que o banco aceita (o teste confere que são os mesmos do SQL). */
export const LIMITES_DO_FORUM = { resumo: 140, tituloMin: 5, titulo: 140, corpoMin: 10, corpo: 10000, etiqueta: 40, pagina: 30 } as const;

/** Um tópico como a lista mostra. As respostas são posts (não pessoas); o autor sai pelo codinome, como no cartão. */
export interface TopicoDoForum {
  id: string;
  titulo: string;
  tipo: "discussao" | "duvida" | string;
  etiqueta: string | null;
  estado: EstadoDoTopico;
  criado_em: string;
  ultima_em: string;
  respostas: number;
  autor: string;
  meu: boolean;
  resumo: string | null;
  /** Só o papel de quem escreveu o resumo, nunca a pessoa. */
  resumo_de: "autora" | "moderacao" | null;
  fixado: boolean;
  travado: boolean;
  /** O tópico nasceu de outra conversa ("virar tópico"). */
  veio: boolean;
}

export interface MarcadorDoForum {
  t: string;
  id: string;
}

export interface PaginaDoForum {
  itens: TopicoDoForum[];
  fixados: TopicoDoForum[];
  proximo: MarcadorDoForum | null;
  ordem: OrdemDoForum;
  modero: boolean;
  pode_abrir: boolean;
  etiquetas: string[];
}

export interface FiltroDoForum {
  ordem?: OrdemDoForum;
  estado?: EstadoDoTopico | null;
  etiqueta?: string | null;
  depois?: MarcadorDoForum | null;
}

/** Para onde partes de uma conversa foram levadas: a resposta (ou a raiz) de onde saiu e o tópico novo. */
export interface ContinuaEm {
  de: string;
  topico: string;
  titulo: string;
  comunidade: string;
}

/** O que o fórum sabe da conversa aberta. */
export interface ForumDaConversa {
  raiz: string;
  topico: boolean;
  item: TopicoDoForum | null;
  pode_mudar: boolean;
  modero: boolean;
  veio_de: string | null;
  continua: ContinuaEm[];
}

export interface PedidoDeVirarTopico {
  comunidade: string;
  titulo: string;
  corpo: string;
  tipo?: "discussao" | "duvida";
  etiqueta?: string | null;
}

export function criarClienteDoForum(c: Chamar) {
  return {
    /** Os tópicos de uma comunidade, 30 por vez (os fixados vêm à parte na primeira página). */
    lista: (slug: string, filtro: FiltroDoForum = {}) => c<PaginaDoForum>("alumia_forum_lista", { p_slug: slug, p: filtro }),
    /** O que o fórum sabe da conversa deste post (qualquer post dela). */
    topico: (post: string) => c<ForumDaConversa>("alumia_forum_topico", { p_post: post }),
    /** Muda o estado do tópico. Só quem abriu ou a moderação. */
    estado: (post: string, estado: EstadoDoTopico) => c<TopicoDoForum>("alumia_forum_estado", { p_post: post, p_estado: estado }),
    /** Escreve (ou tira, com texto vazio) o resumo de uma linha. Só quem abriu ou a moderação. */
    resumo: (post: string, texto: string) => c<TopicoDoForum>("alumia_forum_resumo", { p_post: post, p_texto: texto }),
    /** Leva um post para um tópico novo do fórum, que cita o original. */
    virar: (post: string, pedido: PedidoDeVirarTopico) => c<{ topico: string; avaliar: boolean }>("alumia_forum_virar", { p_post: post, p: pedido }),
  };
}

export const forum = criarClienteDoForum(chamar);

/** O resumo como o banco guarda: uma linha só (espaços e quebras viram um espaço), sem espaço nas pontas. */
export function resumoEmUmaLinha(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Cabe no banco? (o mesmo teto de 140; vazio vale: tira o resumo) */
export function resumoCabe(texto: string): boolean {
  return resumoEmUmaLinha(texto).length <= LIMITES_DO_FORUM.resumo;
}

/** O título do tópico novo ao virar tópico: o começo do texto original, numa linha, no tamanho que o banco aceita. */
export function tituloSugerido(texto: string): string {
  const linha = resumoEmUmaLinha(texto);
  if (linha.length <= 80) return linha;
  const corte = linha.slice(0, 80);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 40 ? corte.slice(0, espaco) : corte).replace(/[\s,.;:]+$/, "")}…`;
}

// ── A prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): tópicos de exemplo, sem banco ────────────────────────────────────────────────

const agora = () => Date.now();
const ha = (min: number) => new Date(agora() - min * 60_000).toISOString();

/** Os tópicos de exemplo de uma comunidade, na prévia. As contas da ordem são as mesmas do banco (feitas aqui). */
export function topicosDeExemplo(slug: string, filtro: FiltroDoForum = {}): PaginaDoForum {
  // Os ids são os dos posts de exemplo da comunidade (lib/rede/conversa/exemplos.ts): tocar um tópico abre a conversa de exemplo.
  const base: TopicoDoForum[] = [
    { id: "00000000-0000-4000-8000-0000000000c1", titulo: "Quanto do valor da corrida fica com o app? Alguém já fez a conta?", tipo: "duvida", etiqueta: "Estudo", estado: "resolvido", criado_em: ha(60), ultima_em: ha(9), respostas: 31, autor: "Lia Quilombo", meu: false, resumo: "A conta da aula de mais-valia bate: perto de 40% fica com o app; a planilha está na resposta marcada.", resumo_de: "moderacao", fixado: false, travado: false, veio: false },
    { id: "00000000-0000-4000-8000-0000000000e1", titulo: "RU fechado no sábado: levar ao conselho na terça", tipo: "discussao", etiqueta: "Organização", estado: "aberto", criado_em: ha(60 * 20), ultima_em: ha(15), respostas: 23, autor: "Maré Alta", meu: false, resumo: null, resumo_de: null, fixado: false, travado: false, veio: true },
    { id: "00000000-0000-4000-8000-0000000000e3", titulo: "Mutirão de cadastro da ocupação: quem leva o quê no sábado", tipo: "discussao", etiqueta: "Mutirão", estado: "aberto", criado_em: ha(60 * 7), ultima_em: ha(60 * 3), respostas: 4, autor: "Moradia ZL", meu: true, resumo: null, resumo_de: null, fixado: false, travado: false, veio: false },
    { id: "00000000-0000-4000-8000-0000000000e2", titulo: "Bolsa permanência atrasada para 312 estudantes: os números da assembleia", tipo: "duvida", etiqueta: "Organização", estado: "encaminhado", criado_em: ha(60 * 50), ultima_em: ha(60 * 26), respostas: 8, autor: "Frevo Vermelho", meu: false, resumo: "Virou pauta da reunião com a reitoria; a planilha está no núcleo.", resumo_de: "autora", fixado: false, travado: true, veio: false },
    { id: "00000000-0000-4000-8000-0000000000e4", titulo: "Sarau na laje da Dona Cida: ordem do microfone aberto", tipo: "discussao", etiqueta: "Mutirão", estado: "aberto", criado_em: ha(35), ultima_em: ha(35), respostas: 0, autor: "Rima Firme", meu: false, resumo: null, resumo_de: null, fixado: false, travado: false, veio: false },
  ];
  const fixados: TopicoDoForum[] = [
    { id: "00000000-0000-4000-8000-0000000000e5", titulo: "Leia antes de abrir um tópico: como o fórum funciona", tipo: "discussao", etiqueta: null, estado: "aberto", criado_em: ha(60 * 24 * 20), ultima_em: ha(60 * 24 * 3), respostas: 6, autor: "Faísca", meu: false, resumo: "Um assunto por tópico; quem abriu marca resolvido quando a dúvida for respondida.", resumo_de: "moderacao", fixado: true, travado: false, veio: false },
  ];
  const ordem = filtro.ordem ?? "ultima";
  const itens = base
    .filter((t) => (!filtro.estado || t.estado === filtro.estado) && (!filtro.etiqueta || t.etiqueta === filtro.etiqueta) && (ordem !== "sem_resposta" || t.respostas === 0))
    .sort((a, b) => (ordem === "ultima" ? b.ultima_em.localeCompare(a.ultima_em) : b.criado_em.localeCompare(a.criado_em)));
  return {
    itens,
    fixados: fixados.filter((t) => !filtro.etiqueta || t.etiqueta === filtro.etiqueta),
    proximo: null,
    ordem,
    modero: true,
    pode_abrir: true,
    etiquetas: ["Estudo", "Mutirão", "Organização"],
  };
}
