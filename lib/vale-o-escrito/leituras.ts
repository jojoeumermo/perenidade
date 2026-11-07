// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: os "dossiês de leitura" (NOVAS-TAREFAS, T31 3.4; os "case files" do bl00d.money). São portas de
// entrada temáticas que cruzam as categorias (os 6 dossiês de dossies.json): cada uma junta casos JÁ publicados, filtra
// a teia e abre um papel de leitura com o caso completo. Não criam caso, não mudam caso: só escolhem quais mostrar. Caso
// que sair da publicação (ou ainda pendente de curadoria) simplesmente não aparece.
//
// Os títulos e as descrições ficam em i18n/vale-o-escrito/<idioma>.json, chave "leituras.<slug>". Parte pura: sem
// React, sem disco, sem "@/".

import type { Entrada } from "./tipos";

export interface DossieDeLeitura {
  slug: string;
  /** Casos (ids de entradas publicadas), na ordem de leitura. */
  entradas: readonly string[];
}

export const DOSSIES_DE_LEITURA: readonly DossieDeLeitura[] = [
  { slug: "barragens", entradas: ["2015-mariana-fundao-acao-penal", "2019-brumadinho-corrego-do-feijao-acao-penal"] },
  { slug: "garimpo-e-yanomami", entradas: ["1993-haximu-genocidio-yanomami", "2017-garimpo-yanomami-financiadores-rr"] },
  {
    slug: "chacinas-do-campo",
    entradas: ["1996-eldorado-dos-carajas-massacre", "2017-pau-darco-massacre-policiais-reus", "2004-unai-chacina-auditores-fiscais"],
  },
  {
    slug: "violencia-policial",
    entradas: [
      "1992-carandiru-massacre",
      "1996-eldorado-dos-carajas-massacre",
      "2017-pau-darco-massacre-policiais-reus",
      "2022-umbauba-morte-em-viatura-da-prf",
      "2025-operacao-contencao-alemao-penha",
    ],
  },
  {
    slug: "trabalho-escravo",
    entradas: ["2004-unai-chacina-auditores-fiscais", "2010-fazendas-buritis-unai-trabalho-escravo", "2023-bento-goncalves-resgate-trabalhadores-fenix"],
  },
  {
    slug: "dinheiro-publico-e-emendas",
    entradas: ["2005-mensalao-acao-penal-470", "2019-inss-descontos-associativos-sem-desconto", "2024-emendas-parlamentares-orcamento-secreto"],
  },
  {
    slug: "terras-indigenas-invadidas",
    entradas: [
      "1993-haximu-genocidio-yanomami",
      "2016-ti-geralda-toco-preto-madeira-ilegal",
      "2017-garimpo-yanomami-financiadores-rr",
      "2018-ti-rio-das-cobras-desmatamento",
      "2022-vale-do-javari-mortes-indigenista-jornalista",
    ],
  },
];

/** As entradas publicadas de um dossiê de leitura, na ordem de leitura (as que não existem ficam de fora). */
export function entradasDaLeitura(slug: string, entradas: readonly Entrada[]): Entrada[] {
  const d = DOSSIES_DE_LEITURA.find((x) => x.slug === slug);
  if (!d) return [];
  const porId = new Map(entradas.map((e) => [e.id, e]));
  return d.entradas.map((id) => porId.get(id)).filter((e): e is Entrada => Boolean(e));
}
