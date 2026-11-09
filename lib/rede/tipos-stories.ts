// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O contrato dos stories da Alumia (PLANO-ALUMIA F5 e §5; pranchas celular-stories-na-linha, celular-criar-story e
// celular-ver-story). As funções do banco que devolvem estes formatos são da etapa de back-end da F5 (rede_story_*): o
// front-end chama pelos nomes de lib/rede/cliente-stories.ts. Sem "@/" de propósito (roda no Node nos testes).
//
// Privacidade (PLANO-ALUMIA §6.4; LGPD art. 11: o que alguém viu numa rede militante revela opinião política, dado sensível):
//   - NÃO existe "quem viu" nem "quantos viram": nenhum campo deste contrato carrega isso, em nenhuma direção;
//   - o que a pessoa já viu fica SÓ no aparelho dela (lib/rede/stories/aparelho.ts), para o anel ficar cinza;
//   - resposta, reação e voto vão só para a autora; a soma da enquete só a autora vê, agregada e a partir de 3;
//   - story nunca vai ao Fediverso e some em 24 h (expira_em).

/** Quem vê o story (o banco tem o mesmo check): quem me segue, a comunidade da Alumia (membros) ou só os próximos. */
export type PublicoDoStory = "seguidores" | "membros" | "proximos";
export const PUBLICOS_DO_STORY: readonly PublicoDoStory[] = ["seguidores", "membros", "proximos"];

/** As 6 cores de fundo da prancha "criar story" (as listras da faixa tecida). */
export type CorDoStory = "azul" | "vermelho" | "dourado" | "verde" | "rosa" | "noite";
export const CORES_DO_STORY: readonly CorDoStory[] = ["azul", "vermelho", "dourado", "verde", "rosa", "noite"];

/** O fundo: listras (o texto puro, prancha "criar"), mosaico (prancha "ver") ou a imagem da galeria/desenho, já sem metadado. */
export type FundoDoStory =
  | { tipo: "listras"; cor: CorDoStory }
  | { tipo: "mosaico"; cor: CorDoStory }
  | { tipo: "imagem"; cor: CorDoStory; /** Endereço assinado, de vida curta, do depósito privado rede-stories. */ url: string; alt: string };

/** As 4 figurinhas da prancha. */
export type TipoDeFigurinha = "contagem" | "pergunta" | "enquete" | "link";
export const TIPOS_DE_FIGURINHA: readonly TipoDeFigurinha[] = ["contagem", "pergunta", "enquete", "link"];

/** Contagem regressiva para um ato (lê o ato da F2 só pelo id). */
export interface FigurinhaContagem {
  tipo: "contagem";
  /** O ato (rede_chamados/rede_posts da F2); nulo num story antigo cujo ato sumiu. */
  ato: string | null;
  /** "PASSE LIVRE JÁ": o nome do ato, como o ato diz. */
  titulo: string;
  /** Quando começa (ISO). */
  inicio: string;
  /** Eu já pedi o aviso de quando começar (só para quem vê; a autora não sabe quem pediu). */
  avisar?: boolean;
}

/** Pergunta aberta: as respostas vão só para a autora. */
export interface FigurinhaPergunta {
  tipo: "pergunta";
  texto: string;
}

/** Enquete de duas opções. A soma só a autora vê, agregada e a partir de 3 (abaixo disso, "poucas pessoas"). */
export interface FigurinhaEnquete {
  tipo: "enquete";
  pergunta: string;
  opcoes: [string, string];
  /** O meu voto (só eu vejo o meu); nulo = não votei. */
  meu_voto?: 0 | 1 | null;
  /** A soma por opção, SÓ quando quem vê é a autora; nula abaixo de 3 votos no total. */
  soma?: [number, number] | null;
}

/** Link para fora (só https), aberto sem passar quem veio. */
export interface FigurinhaLink {
  tipo: "link";
  url: string;
  rotulo: string;
}

export type Figurinha = FigurinhaContagem | FigurinhaPergunta | FigurinhaEnquete | FigurinhaLink;

/** A autora de um story, como ele aparece (codinome sempre; nada de nome civil, INVENTARIO.md §1). */
export interface AutoraDoStory {
  handle: string;
  /** O nome público (codinome ou nome da organização/coletivo). */
  nome: string;
  /** A cor própria (1–5, as cores das comunidades), para o rosto de 16 cartões e o anel. */
  cor?: 1 | 2 | 3 | 4 | 5 | null;
}

export interface Story {
  id: string;
  autora: AutoraDoStory;
  criado_em: string;
  expira_em: string;
  publico: PublicoDoStory;
  fundo: FundoDoStory;
  /** O texto grande (até 140). */
  texto: string;
  /** A tarja preta embaixo do texto ("Panfletagem no RU · amanhã, 11h"), até 80. */
  legenda: string | null;
  figurinhas: Figurinha[];
  /** Sou eu a autora (aí aparece "Apagar" e a soma da enquete). */
  meu: boolean;
}

/** Uma bolinha da faixa: os stories de uma autora, do mais antigo para o mais novo (só os ids; o conteúdo vem ao abrir). */
export interface GrupoDaFaixa {
  autora: AutoraDoStory;
  ids: string[];
  /** O story mais novo (ISO): a faixa põe primeiro quem tem coisa que eu ainda não vi, e depois por este instante. */
  ultimo_em: string;
}

/** O que a faixa do alto da linha recebe. */
export interface FaixaDeStories {
  /** Ids dos MEUS stories no ar (a minha bolinha "Seu story"). */
  meus: string[];
  grupos: GrupoDaFaixa[];
}

/** Um ato que pode ir numa figurinha de contagem: os próximos atos que eu organizo ou confirmei (sem contagem de ninguém). */
export interface AtoParaContagem {
  id: string;
  titulo: string;
  inicio: string;
}

/** O pedido de publicar um story. */
export interface PedidoDeStory {
  publico: PublicoDoStory;
  fundo: { tipo: "listras" | "mosaico" | "imagem"; cor: CorDoStory };
  texto: string;
  legenda: string | null;
  /** O caminho no depósito rede-stories ("<uid>/<id>.webp") quando há imagem; o envio vem antes (enviarImagem). */
  imagem: string | null;
  /** O texto alternativo da imagem (a pessoa escreve; sem ele, "Imagem do story"). */
  alt: string | null;
  figurinhas: Figurinha[];
  /** Story feito a partir de um post ou ato ("pôr no story"). */
  post_ref: string | null;
}

/** As reações da prancha "ver story": conjunto fechado (sem emoji livre, PLANO §6.3), vão só para a autora. */
export const REACOES_DO_STORY = ["punho", "chama", "coracao"] as const;
export type ReacaoDoStory = (typeof REACOES_DO_STORY)[number];

/** Limites (o banco confere de novo). */
export const LIMITES_DO_STORY = {
  texto: 140,
  legenda: 80,
  resposta: 500,
  pergunta: 90,
  opcao: 24,
  rotuloDoLink: 40,
  figurinhas: 3,
  /** 24 h, em ms. */
  vida: 24 * 60 * 60 * 1000,
} as const;
