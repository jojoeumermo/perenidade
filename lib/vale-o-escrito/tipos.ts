// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: a teia do poder no Brasil. Modelo de dados (docs/vale-o-escrito/ESPEC.md, seção 3).
//
// Só tipos e constantes: nenhum import, nenhum acesso a disco, nenhum "@/" (roda direto no Node nos testes). Quem lê
// os arquivos publicados é lib/vale-o-escrito/dados.ts; quem confere as regras é lib/vale-o-escrito/regras.ts.

/** Os 6 idiomas do site. O português é o principal; os outros são rascunho até a revisão. */
export const IDIOMAS_VE = ["pt", "en", "es", "fr", "ru", "zh"] as const;
export type IdiomaVE = (typeof IDIOMAS_VE)[number];

/** Texto por idioma. O português é obrigatório; os demais caem no português quando faltam. */
export type TextoPorIdioma = { pt: string } & Partial<Record<Exclude<IdiomaVE, "pt">, string>>;

// ───────────────────────────── Situação jurídica e confiança ─────────────────────────────

/**
 * A situação jurídica de quem aparece numa entrada. Sempre escrita, nunca omitida: sem ela a entrada é inválida.
 * Os valores abaixo são os do banco (coluna `situacao`) e dos arquivos; os rótulos escritos vêm de ROTULO_SITUACAO.
 * Presunção de inocência: Constituição Federal, art. 5º, LVII. Só "condenado_transitado" é condenação definitiva.
 */
export const SITUACOES = [
  "suspeito",
  "investigado",
  "denunciado",
  "reu",
  "condenado_1a_instancia",
  "condenado_transitado",
  "absolvido",
  "arquivado",
] as const;
export type Situacao = (typeof SITUACOES)[number];

/** Os rótulos em português (os mesmos da ESPEC). Os dos outros idiomas ficam em i18n/vale-o-escrito/<idioma>.json. */
export const ROTULO_SITUACAO: Record<Situacao, string> = {
  suspeito: "Suspeito",
  investigado: "Investigado",
  denunciado: "Denunciado",
  reu: "Réu",
  condenado_1a_instancia: "Condenado em 1ª instância",
  condenado_transitado: "Condenado com trânsito em julgado",
  absolvido: "Absolvido",
  arquivado: "Arquivado",
};

/** Situações que encerram o caso a favor da pessoa: a entrada TEM de mostrar a data da atualização. */
export const SITUACOES_DE_ENCERRAMENTO: readonly Situacao[] = ["absolvido", "arquivado"];

/** Situações que afirmam condenação: exigem fonte primária (decisão ou processo). */
export const SITUACOES_DE_CONDENACAO: readonly Situacao[] = ["condenado_1a_instancia", "condenado_transitado"];

/**
 * Dois níveis de confiança, e só dois:
 *  - "primaria": confirmado por fonte primária (processo, investigação oficial, dado oficial);
 *  - "reportado": consta em relatório de organização, reportagem ou checagem, ainda sem fonte primária.
 */
export const CONFIANCAS = ["primaria", "reportado"] as const;
export type Confianca = (typeof CONFIANCAS)[number];

// ───────────────────────────── Fonte ─────────────────────────────

/** A natureza da fonte. As três primeiras contam como primárias. */
export const TIPOS_DE_FONTE = ["processo", "investigacao_oficial", "dado_oficial", "relatorio_organizacao", "reportagem", "checagem"] as const;
export type TipoDeFonte = (typeof TIPOS_DE_FONTE)[number];
export const TIPOS_PRIMARIOS: readonly TipoDeFonte[] = ["processo", "investigacao_oficial", "dado_oficial"];

/**
 * Uma fonte de uma entrada. Guarda o TRECHO (curto), o link e o arquivo, nunca a página inteira: o trecho é a citação
 * que sustenta a frase da ficha (citação curta, com crédito; e custo zero no Supabase gratuito). A Lei 9.610/1998 não
 * foi conferida no planalto.gov.br nesta fase: a assessoria jurídica confere antes de ligar (ESPEC, seção 5).
 */
export interface Fonte {
  /** Identificador dentro da entrada ("f1", "f2"...). As fichas numeram as fontes na ordem desta lista. */
  id: string;
  /** Id do catálogo (lib/vale-o-escrito/catalogo.ts), quando a fonte é uma das listadas. */
  catalogoId?: string;
  /** O nome de quem publica, como vai na frase "segundo [veículo]" (ex.: "Repórter Brasil", "TCU", "STF"). */
  veiculo: string;
  tipo: TipoDeFonte;
  titulo: string;
  /** Link da fonte (http ou https). */
  url: string;
  /** Trecho citado, de 20 a 400 caracteres. */
  trecho: string;
  /** Data da publicação da fonte (AAAA-MM-DD). */
  data: string;
  /** Data em que a curadoria leu a fonte (AAAA-MM-DD). */
  acessadoEm: string;
  /** Cópia no Internet Archive (https://web.archive.org/web/...), feita (Save Page Now) na aprovação. */
  arquivoUrl?: string;
  /** O Save Page Now falhou e a curadoria foi avisada: libera a entrada sem arquivoUrl até a nova tentativa. */
  arquivoFalhou?: boolean;
}

// ───────────────────────────── Lugar ─────────────────────────────

/**
 * Lugar em três níveis, pronto para outros países: país → região → município. No Brasil, a região é a UF e o município
 * leva o código IBGE de 7 dígitos (a mesma chave das malhas do IBGE que o mapa usa).
 */
export interface Lugar {
  /** Código ISO 3166-1 alfa-2. No começo, só "BR". */
  pais: string;
  /** Sigla da UF (no Brasil) ou código da região (fora). */
  regiao?: string;
  /** Código IBGE do município (7 dígitos). Só no Brasil. */
  municipioIbge?: string;
  /** Nome para mostrar ("Altamira"). */
  nome?: string;
}

// ───────────────────────────── Pessoas e organizações ─────────────────────────────

/**
 * Papéis que uma pessoa pode ter como NÓ da teia. Vítima, criança, adolescente e testemunha NÃO existem aqui, de
 * propósito: quem é vítima não vira nó (ECA, arts. 17, 143 e 247; LGPD, art. 14; Código Penal, arts. 138 a 140).
 * A lista de papéis proibidos, para a conferência, está em regras.ts.
 */
export const PAPEIS_DE_PESSOA = [
  "acusado",
  "investigado",
  "autoridade",
  "agente_publico",
  "parlamentar",
  "dirigente",
  "empresario",
  "proprietario_rural",
  "agente_de_seguranca",
  "outro_publico_no_caso",
] as const;
export type PapelDePessoa = (typeof PAPEIS_DE_PESSOA)[number];

/** Uma pessoa que JÁ é pública no caso (consta em processo, investigação oficial ou reportagem sobre o caso). */
export interface PessoaPublica {
  id: string;
  nome: string;
  /** Marca obrigatória: a curadoria confirmou que o nome já é público no caso. Sem ela, a pessoa não entra. */
  publicaNoCaso: true;
  papel: PapelDePessoa;
  /** Fontes (ids do catálogo de fontes DA ENTRADA ou da ficha) onde o nome aparece. Pelo menos uma. */
  fonteIds: string[];
  /** Cargo ou função pública, quando houver (texto livre, curto). */
  cargo?: string;
  /** Foto: só com licença livre e crédito. Nunca de vítima. */
  foto?: FotoLivre;
}

export const TIPOS_DE_ORGANIZACAO = ["empresa", "orgao_publico", "partido", "associacao", "grupo_armado", "outra"] as const;
export type TipoDeOrganizacao = (typeof TIPOS_DE_ORGANIZACAO)[number];

export interface Organizacao {
  id: string;
  nome: string;
  tipo: TipoDeOrganizacao;
  /** CNPJ só com os 14 dígitos, quando for pessoa jurídica pública no caso. Nunca CPF. */
  cnpj?: string;
  fonteIds: string[];
  foto?: FotoLivre;
}

/** Foto ou imagem: só domínio público ou licença livre, sempre com crédito. */
export interface FotoLivre {
  url: string;
  credito: string;
  licenca: string;
  /** Página de origem, para conferir a licença. */
  origem: string;
}

// ───────────────────────────── Entrada (caso) ─────────────────────────────

/** Uma pessoa dentro de uma entrada: quem é e a situação jurídica DELA naquele caso. */
export interface PessoaNaEntrada {
  pessoaId: string;
  situacao: Situacao;
  /** Frase curta sobre o papel no caso, com "segundo [fonte]" ou "supostamente". */
  papelNoCaso?: string;
}

/** Entrada aprovada, do jeito que vai para content/vale-o-escrito/ e para a tabela interno.vale_entradas. */
export interface Entrada {
  /** Identificador estável e legível ("2026-altamira-conflito-fazenda-x"). */
  id: string;
  /** Slug do dossiê (dossies.json). */
  dossie: string;
  titulo: string;
  /** Resumo neutro. Tem de conter "segundo [veículo]" de pelo menos uma fonte. */
  resumo: string;
  /** Data do fato (AAAA-MM-DD) ou só o mês (AAAA-MM) ou o ano (AAAA), quando a fonte não dá mais. */
  dataDoFato: string;
  lugar: Lugar;
  /** Situação jurídica do caso como um todo (a mais avançada entre as ações citadas). Obrigatória. */
  situacao: Situacao;
  confianca: Confianca;
  fontes: Fonte[];
  pessoas: PessoaNaEntrada[];
  /** Ids das organizações citadas (lista de Organizacao do mesmo dossiê). */
  organizacoes: string[];
  etiquetas: string[];
  /** Primeira aprovação (AAAA-MM-DD). */
  publicadoEm: string;
  /** Última atualização (AAAA-MM-DD): obrigatória e conferida quando a situação é de encerramento. */
  atualizadoEm: string;
  /** Mudanças de situação jurídica (absolvição, arquivamento, nova decisão), da mais antiga à mais nova. Visível na ficha. */
  historico?: MudancaDeSituacao[];
  /** Direitos de resposta e retificações aceitos, publicados ao lado da ficha (Lei 13.188/2015, art. 2º). */
  respostas?: RespostaPublicada[];
  /**
   * Estado da revisão. "pendente-curadoria" = redigida pela equipe a partir de fonte conferida, mas AINDA NÃO revisada
   * pela curadoria nem pela assessoria jurídica: não é publicada (dados.ts a separa em `pendentes`). Sem o campo, vale
   * "aprovada" (entrada já aprovada). Pacote "fontes-e-dossies".
   */
  revisao?: "pendente-curadoria" | "aprovada";
  /** Data em que alguém conferiu a situação jurídica na fonte (AAAA-MM-DD). A curadoria reconfere antes de aprovar. */
  situacaoConferidaEm?: string;
  /** Recado para a curadoria: o que conferir, o que a fonte não diz, por que a situação foi escrita assim. */
  notaDaCuradoria?: string;
  /**
   * Valores em dinheiro documentados no caso (multas, reparações, acordos, valores sob apuração), cada um com fonte. O
   * valor tem de estar ESCRITO no resumo já revisado ou no trecho da fonte (regras.ts confere): nada calculado nem
   * estimado pela equipe. Alimentam os "fluxos de dinheiro" da ficha e o total no topo do observatório.
   */
  valores?: ValorDocumentado[];
}

/** O que o valor é. "movimentacao_suposta" e "estimativa_oficial" nunca são prova de desvio: a ficha diz isso. */
export const TIPOS_DE_VALOR = ["multa", "reparacao", "indenizacao", "acordo", "repasse", "emenda", "estimativa_oficial", "movimentacao_suposta"] as const;
export type TipoDeValor = (typeof TIPOS_DE_VALOR)[number];

/** Um valor em reais documentado num caso: um "fluxo de dinheiro" ligado (opcionalmente) a quem paga ou recebe. */
export interface ValorDocumentado {
  /** Identificador dentro da entrada ("v1", "v2"...). */
  id: string;
  /** Em reais. Tem de bater com `escrito`. */
  valor: number;
  /** O valor como está escrito no resumo ou no trecho da fonte ("R$ 6 milhões", "R$ 3.009.000,00"). */
  escrito: string;
  tipo: TipoDeValor;
  /**
   * AAAA, AAAA-MM ou AAAA-MM-DD da decisão, do acordo ou da apuração, SÓ quando a fonte dá. Sem data na fonte, fica
   * sem: a ficha mostra a data da fonte que registra o valor (nunca uma data deduzida).
   */
  data?: string;
  /** Uma linha, com "segundo [fonte]" ou "supostamente". */
  resumo: string;
  /** Id da fonte (da entrada) que sustenta o valor. */
  fonteId: string;
  /** Quem paga, recebe ou responde pelo valor, quando a fonte diz (só pessoa ou organização já citada no caso). */
  ponta?: RefDeNo;
}

/** Uma mudança de situação, no histórico visível na ficha. Anônima: nunca diz quem da curadoria a fez. */
export interface MudancaDeSituacao {
  /** AAAA-MM-DD da atualização. */
  em: string;
  de: Situacao;
  para: Situacao;
  /** Id da fonte (da entrada) que sustenta a mudança. Obrigatório: sem fonte não há atualização. */
  fonteId: string;
  /** Texto curto, com "segundo [fonte]". */
  nota?: string;
}

/** Resposta ou retificação aceita, publicada na ficha. */
export interface RespostaPublicada {
  em: string;
  tipo: "correcao" | "direito_de_resposta";
  texto: string;
}

/** O arquivo de um dossiê: content/vale-o-escrito/entradas/<slug>.json. */
export interface ArquivoDeEntradas {
  dossie: string;
  /** Pessoas públicas citadas nas entradas deste dossiê. */
  pessoas: PessoaPublica[];
  organizacoes: Organizacao[];
  ligacoes: Ligacao[];
  entradas: Entrada[];
}

// ───────────────────────────── Teia ─────────────────────────────

export const TIPOS_DE_NO = ["pessoa", "organizacao", "entrada", "lugar"] as const;
export type TipoDeNo = (typeof TIPOS_DE_NO)[number];

export const TIPOS_DE_LIGACAO = [
  "integra",
  "dirige",
  "financia",
  "contrata",
  "doa_para",
  "investiga",
  "denuncia",
  "citado_em",
  "ocorreu_em",
  "relacionada",
] as const;
export type TipoDeLigacao = (typeof TIPOS_DE_LIGACAO)[number];

export interface RefDeNo {
  tipo: TipoDeNo;
  id: string;
}

/** Uma aresta da teia. Sem fonte, não existe: a ligação é uma afirmação sobre pessoas e precisa de prova. */
export interface Ligacao {
  id: string;
  de: RefDeNo;
  para: RefDeNo;
  tipo: TipoDeLigacao;
  /** Ids de fontes (de alguma entrada) que sustentam a ligação. Pelo menos uma. */
  fonteIds: string[];
  /** Entrada onde a ligação aparece. */
  entradaId: string;
  /** Rótulo curto opcional ("doou R$ 50 mil em 2022"). Com "segundo [fonte]" quando for afirmação. */
  rotulo?: string;
}

// ───────────────────────────── Dossiê ─────────────────────────────

/** Um dossiê temático (dossies.json). */
export interface Dossie {
  slug: string;
  titulo: TextoPorIdioma;
  descricao: TextoPorIdioma;
  /** Cor do nó no mapa e na teia (neon). */
  cor: "amarelo" | "azul" | "vermelho";
  /** Ordem na coluna esquerda (1 a 9: o número da aba). */
  ordem: number;
  /** Temas (etiquetas) que o robô usa para sugerir entradas para este dossiê. */
  temas: string[];
}

// ───────────────────────────── Correção e envio do público ─────────────────────────────

export const TIPOS_DE_CORRECAO = ["correcao", "direito_de_resposta", "remocao_de_dado"] as const;
export type TipoDeCorrecao = (typeof TIPOS_DE_CORRECAO)[number];

/**
 * Pedido de correção, direito de resposta ou remoção de dado. Entra por vale_corrigir (banco), com limite de pedidos.
 * Direito de resposta pede contato (para responder); correção e remoção podem ser anônimas.
 */
export interface Correcao {
  entradaId: string;
  tipo: TipoDeCorrecao;
  /** O que está errado, o que deveria constar, de 20 a 4000 caracteres. */
  texto: string;
  /** Link ou documento que comprova (opcional, mas acelera). */
  comprovanteUrl?: string;
  /** Nome de quem pede (opcional). */
  nome?: string;
  /** E-mail ou telefone (obrigatório no direito de resposta). */
  contato?: string;
  /** Campo-isca: gente não vê, robô preenche. Tem de vir vazio. */
  site?: string;
}

/** Envio de fonte pelo público. Sem conta, sem IP cru no banco (só hash com sal diário). */
export interface EnvioDoPublico {
  url: string;
  /** O que a fonte mostra, em poucas linhas. */
  descricao: string;
  /** Trecho que sustenta (opcional, até 400 caracteres). */
  trecho?: string;
  /** Slug do dossiê, se a pessoa souber. */
  dossie?: string;
  contato?: string;
  /** Marcou que leu o aviso (nada de vítima, criança ou testemunha; só o que já é público). */
  leuOAviso: boolean;
  /** Campo-isca: tem de vir vazio. */
  site?: string;
}

// ───────────────────────────── Fila de curadoria e robô ─────────────────────────────

export const ESTADOS_DA_FILA = ["pendente", "em_revisao", "aprovada", "recusada", "devolvida"] as const;
export type EstadoDaFila = (typeof ESTADOS_DA_FILA)[number];

export const ORIGENS_DA_FILA = ["robo", "equipe", "publico"] as const;
export type OrigemDaFila = (typeof ORIGENS_DA_FILA)[number];

/** Uma sugestão do robô (tabela interno.vale_sugestoes): ainda não é entrada; só um achado com resumo opcional. */
export interface SugestaoDoRobo {
  fonteCatalogoId: string;
  url: string;
  titulo: string;
  trecho: string;
  /** AAAA-MM-DD da publicação da fonte. */
  data: string;
  municipioIbge?: string;
  uf?: string;
  temas: string[];
  /** Resumo e etiquetas da IA gratuita (rodízio). Vazio quando não houve cota: segue sem resumo. */
  resumoIa?: string;
  provedorIa?: string;
}

// ───────────────────────────── Visões (pacote visual) ─────────────────────────────

export const VISOES = ["teia", "orbita", "grupos", "fluxo", "mapa", "linha"] as const;
export type Visao = (typeof VISOES)[number];

/** Níveis de zoom do mapa, do mais aberto ao mais fechado. */
export const NIVEIS_DE_ZOOM = ["pais", "estado", "municipio"] as const;
export type NivelDeZoom = (typeof NIVEIS_DE_ZOOM)[number];
