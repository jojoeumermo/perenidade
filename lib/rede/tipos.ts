// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos da Rede Lúcia v2 no navegador: o que as funções do banco devolvem (supabase/migracoes/2026-11-rede-*.sql,
// contrato em docs/rede/V2.md). Sem os atalhos "@/" de propósito (roda no Node nos testes). Campo que só o autor vê vem
// nulo para os outros: a tela nunca deve inferir contagem de quem não pode ver (decisão 3 da ESPEC).

/** Os tipos de post. Enquete e chamado entram com os pacotes publicar e comunidades; o aviso é só da equipe. */
export type TipoDePost = "post" | "discussao" | "duvida" | "chamado" | "enquete" | "aviso";

/** Quem pode ver: o "público" do post (ESPEC, seção 2). "internet" só em comunidade de disciplina. */
export type Publico = "internet" | "membros" | "seguidores" | "comunidade" | "nucleo" | "equipe";

/** As abas da linha. "c:<slug>" é uma comunidade; "u:<handle>" é o perfil de uma pessoa. */
export type Aba = "seguindo" | "comunidades" | "tudo" | "geral" | `c:${string}` | `u:${string}`;

/** Quem escreveu: só o codinome, nunca o nome do painel. `perfil` é falso quando a pessoa está invisível. */
export interface AutorDoPost {
  id: string | null;
  codinome: string;
  handle: string | null;
  perfil: boolean;
  equipe: boolean;
}

export interface MidiaDoPost {
  id: string;
  alt: string;
  largura: number | null;
  altura: number | null;
  blurhash: string | null;
}

/** O post como a v2 mostra. A linha traz o resumo (`texto`); a página do post traz também o `corpo` inteiro. */
export interface Post {
  id: string;
  tipo: TipoDePost;
  titulo: string | null;
  texto: string;
  corpo: string | null;
  longo: boolean;
  comunidade: string | null;
  flair: string | null;
  publico: Publico;
  criado_em: string;
  editado_em: string | null;
  fixado: boolean;
  travado: boolean;
  aceita: string | null;
  verificada: boolean;
  resposta_a: string | null;
  raiz: string;
  nivel: number;
  aviso: string;
  cita: { tipo: "aula" | "obra" | "materia"; caminho: string; titulo: string } | null;
  chamado: {
    tipo: string;
    quando: string;
    onde: string;
    /** Onda 5 (F2): a situação do ato; sem ela (banco de antes da migração), vale "confirmado". */
    situacao?: "confirmado" | "adiado" | "cancelado";
    /** Onda 5 (F2): a data de antes quando o ato foi adiado ("era 12/11"). */
    inicio_anterior?: string | null;
    /** Onda 5 (F2): a palavra do mosaico (só A–Z e espaço, até 14). */
    palavra?: string | null;
    /** Onda 5 (F2): a proporção acesa do mosaico, em passos de 10 %; nula abaixo de 3 confirmações. Nunca um número de pessoas. */
    acesos?: number | null;
  } | null;
  meu: boolean;
  retido: boolean;
  motivo: string;
  modero: boolean;
  autor: AutorDoPost;
  /** Respostas diretas que ESTA pessoa pode ver. */
  respostas: number;
  /** Todas as respostas visíveis da conversa (só no primeiro nível). */
  na_conversa: number | null;
  util: number;
  util_eu: boolean;
  /** Só o autor vê o número de apoios; para os outros vem `null`. */
  apoios: number | null;
  apoiei: boolean;
  salvei: boolean;
  /** Só quem organizou o chamado vê o total do "eu vou"; para os outros vem `null`. Nunca há lista de nomes. */
  vou: number | null;
  vou_eu: boolean;
  midia: MidiaDoPost[];
  citado: { id: string; codinome: string; trecho: string } | { restrito: true } | null;
  /** Só na resposta de `rede_publicar`: a avaliação externa ainda precisa rodar para este post. */
  avaliar?: boolean;

  // ───── Onda 5 (PLANO-ALUMIA §5 F0): campos OPCIONAIS do contrato. As funções de hoje não os mandam; cada frente passa a
  // mandar o seu. Quem lê confere se veio. ─────
  /** F3: total por emoji (conjunto fechado). Só totais, NUNCA quem reagiu; total abaixo de 3 vem nulo ("poucas pessoas"). */
  reacoes?: { emoji: string; total: number | null; minha: boolean }[];
  /** F2: o ato a que este post pertence (linha ao vivo do ato, publicada com o atraso do modo ato). */
  ato?: string | null;
  /** F4: a organização que publicou (quando a conta é de organização verificada). O vínculo com a pessoa que gere NUNCA vem. */
  org?: { handle: string; codinome: string; verificada_em: string | null } | null;
  /** F4: coautores que ACEITARAM (só @nome e codinome). */
  coautores?: { handle: string; codinome: string }[];
  /** F6: quando o post some sozinho (posts de 24 h, "apagar depois de X semanas"). */
  expira_em?: string | null;
}

/** Uma página da linha: o `proximo` é o cursor da próxima (nulo quando acabou). */
export interface PaginaDaLinha {
  itens: Post[];
  proximo: string | null;
}

/** Um post, o que ele responde (do mais antigo ao mais próximo) e a conversa abaixo dele. */
export interface PostComConversa {
  post: Post;
  acima: Post[];
  respostas: Post[];
}

/** Onde a pessoa está na Rede: decide entre a linha, a primeira entrada e o convite a entrar. */
export interface Situacao {
  logado: boolean;
  suspenso?: boolean;
  membro: boolean;
  maior?: boolean;
  consentimento?: number | null;
  regras_versao: number;
  codinome?: string | null;
  codinome_ok?: boolean;
  handle?: string | null;
  modo?: "aberto" | "trancado" | "invisivel";
  equipe?: boolean;
  cuida?: boolean;
}

export interface Perfil {
  id: string;
  codinome: string;
  handle: string;
  bio: string;
  modo: "aberto" | "trancado" | "invisivel";
  selos: string[];
  equipe: boolean;
  meu: boolean;
  sigo: boolean;
  pendente: boolean;
  fixado: Post | null;
}

export interface RegraDaComunidade {
  numero: number;
  titulo: string;
  texto: string;
}

export interface Comunidade {
  slug: string;
  nome: string;
  descricao: string;
  categoria: "lutas" | "disciplinas" | "instituto";
  tipo: "aberta" | "restrita" | "fechada";
  publico_padrao: "internet" | "membros" | "comunidade";
  icone: string;
  cor: string;
  aulas: string[];
  trilhas: string[];
  regras: RegraDaComunidade[];
  etiquetas: { nome: string; cor: string }[];
  /** Os codinomes de quem modera. */
  moderacao: string[];
  membro: boolean;
  banido: boolean;
}

/** Um aviso da Rede (o pacote avisos define o agrupamento). */
export interface Aviso {
  id: string;
  texto: string;
  lido: boolean;
  criado_em: string;
  categoria: "rede" | "conta";
  tipo?: "resposta" | "mencao" | "citacao" | "seguidor" | "chamado" | "nucleo" | "moderacao";
  /** Quantas pessoas ou respostas o aviso agrupa (nunca os nomes). */
  total?: number;
  post?: string | null;
}

/** O que `rede_publicar` aceita. Campos de outros pacotes (mídia, enquete, agendamento) entram nas funções deles. */
export interface PedidoDePost {
  tipo?: TipoDePost;
  texto?: string;
  titulo?: string;
  corpo?: string;
  publico?: Publico;
  comunidade?: string | null;
  nucleo?: string | null;
  flair?: string | null;
  aviso?: string;
  resposta_a?: string | null;
}

/** O endereço novo de algo que tinha endereço antigo (?t=, ?sala=). */
export interface EnderecoAntigo {
  tipo: "post" | "comunidade";
  novo: string;
}

/** O que se pode ver em cada tela da casca: a rota diz qual. */
export type Tela =
  | { tipo: "linha"; aba: Aba }
  | { tipo: "post"; id: string }
  | { tipo: "comunidade"; slug: string }
  | { tipo: "perfil"; handle: string }
  /** Uma tela de outro pacote (avisos, salvos, explorar, busca, tag…), registrada em components/rede/registro.tsx. */
  | { tipo: "pacote"; nome: string; params?: Record<string, string> };

/** Os códigos de erro que as funções da Rede devolvem (a tela traduz por `erros.<código>` em i18n/rede). */
export const ERROS_DA_REDE = [
  "entre_primeiro", "conta_suspensa", "area_interditada", "confirme_idade", "idade_minima", "consentimento", "confirme_codinome",
  "dado_pessoal", "sem_permissao", "nao_encontrado", "travado", "limite_de_niveis", "muitos_pedidos", "banco_desatualizado",
  "sem_servico", "sem_conexao", "modo_lento", "nivel_links", "nivel_imagens", "limite_diario", "lista_bloqueio", "falha",
  "limite_identidades",
] as const;
export type ErroDaRede = (typeof ERROS_DA_REDE)[number];

/** Os endereços da v2 (relativos ao idioma): um lugar só, para a casca, os links e os testes. */
export const enderecos = {
  linha: (lang: string) => `/${lang}/alumia`,
  post: (lang: string, id: string) => `/${lang}/alumia/p/${id}`,
  comunidade: (lang: string, slug: string) => `/${lang}/alumia/c/${slug}`,
  perfil: (lang: string, handle: string) => `/${lang}/alumia/u/${handle}`,
} as const;

/** Só letras minúsculas, números e "-" (comunidade) ou "_" (handle): o que o banco aceita. Confere antes de montar um endereço. */
export const slugOk = (s: string): boolean => /^[a-z0-9-]{2,60}$/.test(s);
export const handleOk = (s: string): boolean => /^[a-z0-9_]{3,20}$/.test(s);
export const idOk = (s: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
