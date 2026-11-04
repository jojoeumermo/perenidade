// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O catálogo de fontes do Vale o Escrito: os ids que o robô, a curadoria e as fichas usam. Só dados, sem imports.
// O pacote "fontes-e-dossies" completa cada fonte (endereço do feed ou da API, periodicidade, o que ler e o que NÃO ler)
// em content/vale-o-escrito/fontes.json; este arquivo é o contrato dos ids.
//
// Atenção ao nº de fontes: o pedido original dizia 47, mas a lista literal tem 48 nomes (21 oficiais, 16 organizações,
// 9 da imprensa, 2 de checagem; "STF/STJ" conta como um). Está aqui como veio. Ver ESPEC, seção 9.
//
// Fontes que falam de vítimas (Disque 100, DATASUS, Atlas da Violência, Fogo Cruzado, Rede de Observatórios): só
// agregados e contagens. Nome de vítima NUNCA é lido nem guardado (regra "agregado": true).

export type GrupoDeFonte = "oficial" | "organizacao" | "imprensa" | "checagem";

export interface FonteDoCatalogo {
  id: string;
  nome: string;
  grupo: GrupoDeFonte;
  /** Só números e totais: o robô descarta qualquer linha com nome de pessoa. */
  agregado?: boolean;
}

export const CATALOGO_DE_FONTES: readonly FonteDoCatalogo[] = [
  // Oficiais
  { id: "querido-diario", nome: "Querido Diário", grupo: "oficial" },
  { id: "dou", nome: "Diário Oficial da União", grupo: "oficial" },
  { id: "datajud", nome: "DataJud (CNJ)", grupo: "oficial" },
  { id: "portal-transparencia", nome: "Portal da Transparência", grupo: "oficial" },
  { id: "camara", nome: "Câmara dos Deputados", grupo: "oficial" },
  { id: "senado", nome: "Senado Federal", grupo: "oficial" },
  { id: "tse", nome: "TSE", grupo: "oficial" },
  { id: "cnpj", nome: "CNPJ (Receita Federal)", grupo: "oficial" },
  { id: "tcu", nome: "TCU", grupo: "oficial" },
  { id: "pf", nome: "Polícia Federal", grupo: "oficial" },
  { id: "mpf", nome: "Ministério Público Federal", grupo: "oficial" },
  { id: "stf-stj", nome: "STF e STJ", grupo: "oficial" },
  { id: "ibama", nome: "IBAMA", grupo: "oficial" },
  { id: "inpe", nome: "INPE", grupo: "oficial", agregado: true },
  { id: "mapbiomas", nome: "MapBiomas", grupo: "oficial", agregado: true },
  { id: "funai", nome: "FUNAI", grupo: "oficial" },
  { id: "ibge", nome: "IBGE", grupo: "oficial", agregado: true },
  { id: "lista-suja", nome: "Lista suja do trabalho escravo", grupo: "oficial" },
  { id: "datasus", nome: "DATASUS", grupo: "oficial", agregado: true },
  { id: "disque-100", nome: "Disque 100", grupo: "oficial", agregado: true },
  { id: "atlas-violencia", nome: "Atlas da Violência", grupo: "oficial", agregado: true },
  // Organizações
  { id: "cimi", nome: "CIMI", grupo: "organizacao" },
  { id: "cpt", nome: "CPT", grupo: "organizacao" },
  { id: "isa", nome: "ISA", grupo: "organizacao" },
  { id: "imazon", nome: "Imazon", grupo: "organizacao", agregado: true },
  { id: "fbsp", nome: "Fórum Brasileiro de Segurança Pública", grupo: "organizacao", agregado: true },
  { id: "fogo-cruzado", nome: "Fogo Cruzado", grupo: "organizacao", agregado: true },
  { id: "rede-observatorios", nome: "Rede de Observatórios da Segurança", grupo: "organizacao", agregado: true },
  { id: "sou-da-paz", nome: "Instituto Sou da Paz", grupo: "organizacao", agregado: true },
  { id: "justica-global", nome: "Justiça Global", grupo: "organizacao" },
  { id: "anistia", nome: "Anistia Internacional", grupo: "organizacao" },
  { id: "hrw", nome: "Human Rights Watch", grupo: "organizacao" },
  { id: "global-witness", nome: "Global Witness", grupo: "organizacao" },
  { id: "acled", nome: "ACLED", grupo: "organizacao", agregado: true },
  { id: "antra", nome: "ANTRA", grupo: "organizacao", agregado: true },
  { id: "ggb", nome: "Grupo Gay da Bahia", grupo: "organizacao", agregado: true },
  { id: "observatorio-do-clima", nome: "Observatório do Clima", grupo: "organizacao" },
  // Imprensa
  { id: "publica", nome: "Agência Pública", grupo: "imprensa" },
  { id: "reporter-brasil", nome: "Repórter Brasil", grupo: "imprensa" },
  { id: "infoamazonia", nome: "InfoAmazonia", grupo: "imprensa" },
  { id: "amazonia-real", nome: "Amazônia Real", grupo: "imprensa" },
  { id: "ponte", nome: "Ponte Jornalismo", grupo: "imprensa" },
  { id: "alma-preta", nome: "Alma Preta", grupo: "imprensa" },
  { id: "de-olho-nos-ruralistas", nome: "De Olho nos Ruralistas", grupo: "imprensa" },
  { id: "intercept-brasil", nome: "The Intercept Brasil", grupo: "imprensa" },
  { id: "brasil-de-fato", nome: "Brasil de Fato", grupo: "imprensa" },
  // Checagem
  { id: "lupa", nome: "Agência Lupa", grupo: "checagem" },
  { id: "aos-fatos", nome: "Aos Fatos", grupo: "checagem" },
];

export const IDS_DO_CATALOGO: readonly string[] = CATALOGO_DE_FONTES.map((f) => f.id);

/** Os dossiês iniciais (slugs). dossies.json tem de ter exatamente estes, na ordem. */
export const SLUGS_DOS_DOSSIES = [
  "povos-indigenas",
  "conflitos-no-campo",
  "violencia-policial",
  "trabalho-escravo",
  "crimes-ambientais",
  "dinheiro-publico",
] as const;
export type SlugDeDossie = (typeof SLUGS_DOS_DOSSIES)[number];
