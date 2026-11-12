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

/**
 * Quem vê o story (o banco tem o mesmo check): quem me segue, a comunidade da Alumia (membros), a minha RODA DE CONFIANÇA
 * ("proximos": a lista pessoal e privada, não "seguir um ao outro") ou só os membros de UMA comunidade minha.
 */
export type PublicoDoStory = "seguidores" | "membros" | "proximos" | "comunidade";
export const PUBLICOS_DO_STORY: readonly PublicoDoStory[] = ["seguidores", "membros", "proximos", "comunidade"];

/** As 6 cores de fundo da prancha "criar story" (as listras da faixa tecida). */
export type CorDoStory = "azul" | "vermelho" | "dourado" | "verde" | "rosa" | "noite";
export const CORES_DO_STORY: readonly CorDoStory[] = ["azul", "vermelho", "dourado", "verde", "rosa", "noite"];

/** O fundo: listras (o texto puro, prancha "criar"), mosaico (prancha "ver"), a imagem ou o vídeo (câmera/galeria), já sem metadado. */
export type FundoDoStory =
  | { tipo: "listras"; cor: CorDoStory }
  | { tipo: "mosaico"; cor: CorDoStory }
  | {
      tipo: "imagem";
      cor: CorDoStory;
      /** Endereço assinado, de vida curta, do depósito privado rede-stories (o cliente pede a partir do caminho). */
      url: string;
      alt: string;
      /** O caminho no depósito ("<uid>/<id>.webp"), como o banco devolve; o cliente troca por `url`. */
      caminho?: string;
    }
  | {
      tipo: "video";
      cor: CorDoStory;
      /** Endereço assinado de vida curta (ou local, na prévia). */
      url: string;
      alt: string;
      caminho?: string;
      /** Duração em ms (até 60 s): a barra do alto anda com o vídeo. */
      duracao: number;
      /** A autora publicou com som? Sem som, o arquivo nem tem áudio (o aparelho tirou antes de enviar). */
      som: boolean;
    };

/** As fontes do texto (lista fechada; o banco recusa outra): condensada (a da prancha), serifa, máquina e marcador. */
export type FonteDoStory = "condensada" | "serifa" | "maquina" | "marcador";
export const FONTES_DO_STORY: readonly FonteDoStory[] = ["condensada", "serifa", "maquina", "marcador"];
/** A cor da letra: o papel ou uma das 6 cores. */
export type CorDaLetra = "papel" | CorDoStory;
export const CORES_DA_LETRA: readonly CorDaLetra[] = ["papel", "noite", "dourado", "vermelho", "rosa", "verde", "azul"];
export type Alinhamento = "esq" | "centro" | "dir";

/** O estilo do texto grande (o que não é texto fica fora: filtro, giro e zoom vão "queimados" na mídia no aparelho). */
export interface EstiloDoStory {
  fonte?: FonteDoStory;
  /** Nula = a cor que contrasta com o fundo. */
  cor_texto?: CorDaLetra | null;
  alinhar?: Alinhamento;
  /** "caixa" = o texto numa caixa de cor sólida (como o "A" do Instagram), legível sobre foto e vídeo. */
  caixa?: "nenhuma" | "caixa";
}

/**
 * As figurinhas: as 4 da prancha, a menção de comunidade e as do B1 ("vou" no ato, menção a pessoa, #campanha e a "resposta" à
 * pergunta, que só nasce de uma resposta que chegou), mais as decorativas da Alumia (lista fechada, desenhadas no aparelho).
 */
export type TipoInterativo = "contagem" | "pergunta" | "enquete" | "link" | "comunidade" | "vou" | "pessoa" | "campanha" | "resposta";
export type TipoDeFigurinha = TipoInterativo | "decorativa";
/** As interativas que a autora liga pelos botões do "criar" (a "resposta" vem da caixa de respostas). */
export type TipoDoBotao = Exclude<TipoInterativo, "resposta">;
export const TIPOS_DE_FIGURINHA: readonly TipoDoBotao[] = ["contagem", "pergunta", "enquete", "link", "comunidade", "vou", "pessoa", "campanha"];

/** As figurinhas decorativas da Alumia (o banco aceita só estes nomes; o desenho é components/rede/figurinhas/Decorativas.tsx). */
export const DECORATIVAS = ["punho", "lampiao", "megafone", "faixa", "carimbo-luta", "carimbo-presente", "estrela", "flor"] as const;
export type NomeDecorativo = (typeof DECORATIVAS)[number];

/** A música opcional do vídeo: gerada no aparelho (lib/rede/stories/musica.ts), sem arquivo de fora e sem serviço de terceiros. */
export const MUSICAS_DO_STORY = ["batucada", "marcha", "ciranda", "tambor"] as const;
export type MusicaDoStory = (typeof MUSICAS_DO_STORY)[number];

/** Uma legenda do vídeo (feita e aprovada pela autora): de `de` a `ate` (ms); "grande" = texto no meio da tela, não embaixo. */
export interface LegendaDoVideo {
  de: number;
  ate: number;
  texto: string;
  grande?: boolean;
}

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

/** Menção a uma comunidade da Alumia (o nome vem da comunidade; nulo se ela sumiu). */
export interface FigurinhaComunidade {
  tipo: "comunidade";
  slug: string | null;
  nome: string;
}

/**
 * Onde a figurinha fica na tela do story, como a autora a deixou no "criar" (arrastar, dois dedos giram e mudam o tamanho): o
 * centro dela em x e y de 0 a 1, o giro em graus (até 45 para cada lado) e o tamanho (0,5 a 1,6). Sem isso, a tela escolhe.
 */
export interface PosicaoDaFigurinha {
  x: number;
  y: number;
  giro: number;
  escala: number;
}

/** Decorativa: só o desenho (punho, lampião, megafone…). */
export interface FigurinhaDecorativa {
  tipo: "decorativa";
  nome: NomeDecorativo;
}

/** Uma resposta à minha pergunta, publicada num story novo: a pergunta e a resposta, NUNCA quem respondeu. */
export interface FigurinhaResposta {
  tipo: "resposta";
  pergunta: string;
  texto: string;
  /** Só no pedido: o id da resposta (o banco busca o texto de novo e confere que a pergunta é minha). */
  resposta?: string;
}

/** "Vou": confirmar presença no ato direto do story (a mesma confirmação da página do ato). */
export interface FigurinhaVou {
  tipo: "vou";
  /** Nulo se quem vê não pode ver o ato (ou ele sumiu). */
  ato: string | null;
  titulo: string;
  inicio: string;
  cidade?: string | null;
  vou_eu?: boolean;
  /** Quantas pessoas vão, só a partir de 3 (de 10 para cima, arredondado de 5 em 5). */
  total?: number | null;
  encerrado?: boolean;
}

/** Menção a uma pessoa da Alumia (o @ e o codinome; nulo se há bloqueio ou a conta sumiu). */
export interface FigurinhaPessoa {
  tipo: "pessoa";
  handle: string | null;
  nome: string;
}

/** #campanha; com `corrente`, quem vê pode "Adicionar o seu" (um story seu com a mesma #). */
export interface FigurinhaCampanha {
  tipo: "campanha";
  tag: string;
  corrente: boolean;
  /** Quantas pessoas entraram na corrente (stories no ar), só a partir de 3. */
  total?: number | null;
}

export type Figurinha = (
  | FigurinhaContagem
  | FigurinhaPergunta
  | FigurinhaEnquete
  | FigurinhaLink
  | FigurinhaComunidade
  | FigurinhaDecorativa
  | FigurinhaResposta
  | FigurinhaVou
  | FigurinhaPessoa
  | FigurinhaCampanha
) & { pos?: PosicaoDaFigurinha | null };

/** O cartão do post ou do ato de onde o story veio ("Pôr no story"), como quem vê pode vê-lo. */
export type CartaoDoPost =
  | { tipo: "post"; id: string; autora: AutoraDoStory | null; texto: string; criado_em: string; aviso?: string | null }
  | {
      tipo: "ato";
      id: string;
      autora: AutoraDoStory | null;
      titulo: string;
      inicio: string;
      /** Só a cidade (nunca o ponto exato do ato num story). */
      cidade: string;
      tipo_do_ato?: string;
      situacao: "confirmado" | "adiado" | "cancelado";
    }
  | { tipo: "indisponivel"; id: null };

/** As reações do story, para a autora: só totais, e só a partir de 3 ("poucas" abaixo disso). Nunca quem. */
export interface ReacoesDoStory {
  total: number | null;
  poucas: boolean;
  por: { punho: number | null; chama: number | null; coracao: number | null };
}

/** Uma resposta que chegou a um story meu (como numa mensagem direta: quem mandou escolheu falar comigo). */
export interface RespostaDoStory {
  id: string;
  texto: string;
  criado_em: string;
  /** Veio da figurinha de pergunta (aí pode virar um story novo, sem o nome). */
  pergunta: boolean;
  /** Nulo se há bloqueio ou a conta saiu da Alumia. */
  de: AutoraDoStory | null;
}

/** Um story meu na caixa de respostas. */
export interface ItemDaCaixa {
  id: string;
  texto: string;
  cor: CorDoStory;
  criado_em: string;
  expira_em: string;
  n: number;
  perguntas: number;
  ultima: string;
}

/** Uma pessoa da minha roda de confiança (só eu vejo a lista). */
export interface PessoaDaRoda {
  handle: string;
  nome: string;
  cor?: 1 | 2 | 3 | 4 | 5 | null;
}

/** Uma comunidade que posso mencionar (as minhas). */
export interface ComunidadeParaMencao {
  slug: string;
  nome: string;
}

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
  /** O estilo do texto (vazio = o da prancha). */
  estilo?: EstiloDoStory;
  /** Só para a autora: os destaques onde este story está guardado. */
  destaques?: string[] | null;
  /** O post ou o ato de onde veio ("Pôr no story"). */
  post?: CartaoDoPost | null;
  /** Público "comunidade": qual. */
  comunidade?: { slug: string; nome: string } | null;
  /** As legendas do vídeo (aprovadas pela autora). */
  legendas?: LegendaDoVideo[] | null;
  /** A música da Alumia que foi misturada no vídeo (só o nome, para a etiqueta). */
  musica?: MusicaDoStory | null;
  /** Só para a autora: quantas respostas chegaram (mensagens, não pessoas). */
  respostas?: number | null;
  /** Só para a autora: as reações, só a partir de 3. */
  reacoes?: ReacoesDoStory | null;
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
  fundo: { tipo: "listras" | "mosaico" | "imagem" | "video"; cor: CorDoStory };
  texto: string;
  legenda: string | null;
  /** O caminho no depósito rede-stories ("<uid>/<id>.webp" ou ".mp4/.webm") quando há mídia; o envio vem antes (enviarImagem). */
  imagem: string | null;
  /** Só com fundo "video": a duração, se vai com som, a música da Alumia e as legendas. */
  video?: { duracao_ms: number; som: boolean; musica?: MusicaDoStory | null; legendas?: LegendaDoVideo[] } | null;
  /** Público "comunidade": o slug (de uma comunidade em que sou membro ativa). */
  comunidade?: string | null;
  estilo?: EstiloDoStory;
  /** O texto alternativo da imagem (a pessoa escreve; sem ele, "Imagem do story"). */
  alt: string | null;
  figurinhas: Figurinha[];
  /** Story feito a partir de um post ou ato ("pôr no story"). */
  post_ref: string | null;
}

/** As reações da prancha "ver story": conjunto fechado (sem emoji livre, PLANO §6.3), vão só para a autora. */
export const REACOES_DO_STORY = ["punho", "chama", "coracao"] as const;
export type ReacaoDoStory = (typeof REACOES_DO_STORY)[number];

/** Um destaque no perfil (até 6): stories guardados que não somem em 24 h, com o mesmo público de quando foram publicados. */
export interface DestaqueDeStories {
  id: string;
  titulo: string;
  cor: CorDoStory;
  /** Quantos stories EU posso ver nele (nunca quantas pessoas viram). */
  n: number;
  /** A capa: a escolhida pela dona ou a primeira imagem (endereço assinado, pedido pelo cliente), ou nula (aí a cor). */
  capa?: { caminho?: string; tipo: "imagem"; url?: string } | null;
  /** Só para a dona: o story escolhido como capa (nulo = a primeira foto). */
  capa_story?: string | null;
}

/** Limites (o banco confere de novo). */
export const LIMITES_DO_STORY = {
  texto: 140,
  legenda: 80,
  resposta: 500,
  pergunta: 90,
  opcao: 24,
  rotuloDoLink: 40,
  /** Interativas (as decorativas contam à parte). */
  figurinhas: 3,
  decorativas: 3,
  roda: 150,
  legendas: 40,
  legendaDoVideo: 120,
  /** 24 h, em ms. */
  vida: 24 * 60 * 60 * 1000,
  /** O vídeo: até 60 s e 20 MB depois de regravado no aparelho. */
  videoMs: 60_000,
  videoBytes: 20 * 1024 * 1024,
  destaques: 6,
  tituloDoDestaque: 24,
} as const;
