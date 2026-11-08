// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O mapa do campus da Escola Revolucionária Lúcia Maria (E4-09, D1-1 e D1-2; docs/escola/campus.md). Os prédios são uma CAMADA sobre
// a lista do "Mais" (lib/secoes-do-site.ts): cada endereço que já existe lá cai em exatamente um prédio, sem repetir a
// lista. `npm run testar:escola-campus` falha se algum item ficar sem prédio ou cair em dois.
// O "clima" de cada prédio é só o que já existe: o tom de um atalho do celular (components/celular/Atalhos.tsx), o
// desenho em traço e a frase de porta (i18n/escola/campus). Nenhuma cor, textura ou fonte nova.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node.

/** Os tons que já existem nos atalhos do celular (a paleta dos panos). O prédio empresta a cor de um deles. */
export const TONS = ["radio", "podcasts", "journal", "news", "glossary", "labs", "questionBank", "live", "health"] as const;
export type Tom = (typeof TONS)[number];

export const IDS_DOS_PREDIOS = ["escola", "biblioteca", "radio", "memorial", "oficinas", "praca", "territorio", "secretaria"] as const;
export type IdDoPredio = (typeof IDS_DOS_PREDIOS)[number];

/** A chave do desenho em traço do prédio em ATALHOS (components/celular/Atalhos.tsx). */
export type DesenhoDoPredio = `predio-${IdDoPredio}`;

export interface Predio {
  id: IdDoPredio;
  /** De qual atalho o prédio empresta a cor (fundo e tinta). */
  tom: Tom;
  desenho: DesenhoDoPredio;
  /** Os endereços da lista do "Mais" que ficam dentro do prédio (sem idioma). */
  secoes: readonly string[];
  /** Páginas que existem no site mas não estão no "Mais": só servem para o passaporte saber em que prédio a pessoa está. */
  outras: readonly string[];
}

export const PREDIOS: readonly Predio[] = [
  {
    id: "escola",
    tom: "journal",
    desenho: "predio-escola",
    secoes: ["/escola", "/trilhas", "/consciencia", "/comecar", "/meu-estudo", "/nivelamento", "/turma", "/turmas", "/ao-vivo", "/videoaulas", "/reforco", "/plantao", "/professores", "/perguntas", "/questoes", "/sala-livre"],
    outras: ["/enem", "/estantes", "/avulsos", "/estudo-em-grupo", "/estudio-de-pratica"],
  },
  {
    id: "biblioteca",
    tom: "glossary",
    desenho: "predio-biblioteca",
    secoes: ["/acervo", "/glossario", "/autores", "/guia", "/gaveta", "/materiais", "/dados"],
    outras: ["/catalogo"],
  },
  { id: "radio", tom: "radio", desenho: "predio-radio", secoes: ["/radio", "/podcasts", "/videos"], outras: [] },
  { id: "memorial", tom: "podcasts", desenho: "predio-memorial", secoes: ["/memorial", "/galeria", "/linha-do-tempo", "/dedicatoria"], outras: [] },
  { id: "oficinas", tom: "labs", desenho: "predio-oficinas", secoes: ["/laboratorios", "/jogos", "/ferramentas", "/caderno"], outras: [] },
  {
    id: "praca",
    tom: "news",
    desenho: "predio-praca",
    secoes: ["/comunidade", "/jornal", "/noticias", "/debates", "/checagens", "/falacias", "/mural"],
    outras: [],
  },
  { id: "territorio", tom: "questionBank", desenho: "predio-territorio", secoes: ["/nucleos", "/territorios", "/saude", "/direitos"], outras: ["/eventos"] },
  {
    id: "secretaria",
    tom: "live",
    desenho: "predio-secretaria",
    secoes: [
      "/meus-dados",
      "/privacidade",
      "/termos",
      "/contribuir",
      "/contribuir/guia",
      "/voluntarios",
      "/apoie",
      "/relatorio",
      "/contribuidores",
      "/conduta",
      "/uso",
      "/direitos-autorais",
      "/sobre",
      "/quem-somos",
      "/relatar-erro",
    ],
    outras: ["/status", "/modo-seguro", "/seguranca-digital", "/creditos", "/instituto", "/historico", "/divulgue", "/voluntarie-se", "/denunciar"],
  },
];

export const TOTAL_DE_PREDIOS = PREDIOS.length;

const IDIOMAS = new Set(["pt", "en", "es", "fr", "ru", "zh"]);

/** Tira o idioma do começo do caminho ("/pt/acervo/x" vira "/acervo/x"), a âncora e a busca. */
export function semIdioma(caminho: string): string {
  const limpo = (caminho.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  const [, primeiro, ...resto] = limpo.split("/");
  return IDIOMAS.has(primeiro) ? `/${resto.join("/")}`.replace(/\/+$/, "") || "/" : limpo;
}

const casa = (caminho: string, href: string) => caminho === href || caminho.startsWith(`${href}/`);

/**
 * O prédio de um caminho (com ou sem idioma), pelo endereço mais comprido que casa: "/contribuir/guia" é da Secretaria
 * e "/trilhas/x/y" é da Escola. A página inicial, o painel e o que não está no mapa não são de prédio nenhum (null).
 */
export function predioDoCaminho(caminho: string): IdDoPredio | null {
  const c = semIdioma(caminho);
  let achado: { id: IdDoPredio; tamanho: number } | null = null;
  for (const p of PREDIOS) {
    for (const href of [...p.secoes, ...p.outras]) {
      if (casa(c, href) && (!achado || href.length > achado.tamanho)) achado = { id: p.id, tamanho: href.length };
    }
  }
  return achado?.id ?? null;
}

/** Um item da lista do "Mais" como ela chega pronta do servidor (rótulo já traduzido). */
export interface ItemDoMapa {
  label: string;
  path: string;
  description: string;
  short?: string;
}

export interface PredioDoMapa {
  id: IdDoPredio;
  tom: Tom;
  desenho: DesenhoDoPredio;
  nome: string;
  frase: string;
  itens: ItemDoMapa[];
}

/**
 * Monta os prédios com os itens que a lista do "Mais" tem NESTA montagem (recurso desligado não aparece). A ordem dos
 * itens é a do prédio. Item sem prédio (o teste não deixa acontecer) vai para a Secretaria, para nenhum link sumir.
 * Prédio sem item nenhum fica de fora.
 */
export function montarCampus(itens: readonly ItemDoMapa[], textos: Record<IdDoPredio, { nome: string; frase: string }>): PredioDoMapa[] {
  const porPath = new Map(itens.map((i) => [i.path, i]));
  const usados = new Set<string>();
  const predios = PREDIOS.map((p) => {
    const dentro = p.secoes.map((href) => porPath.get(href)).filter((i): i is ItemDoMapa => Boolean(i));
    for (const i of dentro) usados.add(i.path);
    return { id: p.id, tom: p.tom, desenho: p.desenho, nome: textos[p.id].nome, frase: textos[p.id].frase, itens: dentro };
  });
  const soltos = itens.filter((i) => !usados.has(i.path));
  if (soltos.length > 0) predios[predios.length - 1].itens.push(...soltos);
  return predios.filter((p) => p.itens.length > 0);
}

/** Filtra o mapa pela busca (já normalizada): fica o prédio cujo nome casa (inteiro) ou só os itens que casam. */
export function filtrarCampus(predios: readonly PredioDoMapa[], termo: string, normalizar: (s: string) => string): PredioDoMapa[] {
  if (!termo) return [...predios];
  return predios
    .map((p) => (normalizar(`${p.nome} ${p.frase}`).includes(termo) ? p : { ...p, itens: p.itens.filter((i) => normalizar(`${i.label} ${i.description}`).includes(termo)) }))
    .filter((p) => p.itens.length > 0);
}
