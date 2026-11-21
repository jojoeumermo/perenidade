// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Teoria revolucionária e Lutas do povo moram na Escola (P5, B2). As 26 disciplinas dos dois grupos (lib/areas.ts) saíram do
// site do instituto e abrem dentro da Escola, no desenho dela, em /escola/aulas/<disciplina>/<trilha>/<aula>. Continuam
// ABERTAS para ler, sem conta e sem cadastro (decisão da coordenação): o site promete "todo o conhecimento, para todos", a aula
// aberta é a porta de quem ainda não é militante, e pedir conta para ler criaria uma lista de quem lê teoria revolucionária.
// Quem lê sem conta não deixa rastro: nada aqui grava quem leu o quê; o progresso continua só no aparelho.
//
// Por que estas páginas ficam no endereço do instituto (lib/escola/endereco.ts, ABERTAS), e não no endereço próprio da Escola:
//  - a aula é a MESMA de /trilhas (mesmo lessonId), e o progresso, as anotações, os salvos e os exercícios de quem já estudou
//    moram no armazenamento do navegador, que é separado por endereço. No endereço da Escola, tudo isso sumiria;
//  - o endereço próprio da Escola existe para guardar a Escola fechada longe das centenas de páginas abertas do site
//    (laboratórios, editores). As aulas abertas trazem essas peças: levá-las para lá desfaria a proteção.
//
// Os endereços antigos (/estantes/<disciplina>, /trilhas/<trilha> e /trilhas/<trilha>/<aula>) vão com 301 para o novo
// (proxy.ts). A prova da trilha (/trilhas/<trilha>/prova), o kit de núcleo e os formatos de impressão e de texto puro
// (/texto, /cordel, /zine) continuam onde estão: são as mesmas para todo o site e já são públicos.
// Sem os atalhos "@/" de propósito: o proxy e os testes (Node) importam este arquivo.

import { ligado } from "../recursos";
import dados from "./aulas-abertas.json";

/** Os dois grupos de disciplinas da Escola, na ordem de lib/areas.ts (gerado por scripts/gerar-aulas-abertas.mjs). */
export const GRUPOS_DA_ESCOLA_ABERTA: { teoria: readonly string[]; lutas: readonly string[] } = dados.grupos;

/** As disciplinas que moram na Escola. */
export const AREAS_DA_ESCOLA: ReadonlySet<string> = new Set([...dados.grupos.teoria, ...dados.grupos.lutas]);

/** Trilha → disciplina, só das trilhas que moram na Escola. */
const TRILHAS: Readonly<Record<string, string>> = dados.trilhas;

export const BASE_DAS_AULAS = "/escola/aulas";

/**
 * A disciplina mora na Escola? Só com a Escola ligada (recurso "escola", que só liga pelo nome): desligada, nenhuma página de
 * /escola existe, e as 26 disciplinas continuam no site, exatamente como eram.
 */
export const areaNaEscola = (area: string): boolean => ligado("escola") && AREAS_DA_ESCOLA.has(area);

/** A disciplina de uma trilha que mora na Escola, ou null (a trilha é do site). */
export const areaDaTrilhaNaEscola = (trilha: string): string | null => (ligado("escola") && Object.hasOwn(TRILHAS, trilha) ? TRILHAS[trilha] : null);

/** O caminho (sem idioma) da página da disciplina: na Escola ou em /estantes. */
export function caminhoDaEstante(area: string): string {
  return areaNaEscola(area) ? `${BASE_DAS_AULAS}/${area}` : `/estantes/${area}`;
}

/** O caminho (sem idioma) da página da trilha. Pela disciplina da trilha (o campo "area"), não pelo nome. */
export function caminhoDaTrilha(trilha: { slug: string; area?: string } | string): string {
  const slug = typeof trilha === "string" ? trilha : trilha.slug;
  const area = (typeof trilha === "string" ? null : trilha.area && areaNaEscola(trilha.area) ? trilha.area : null) ?? areaDaTrilhaNaEscola(slug);
  return area ? `${BASE_DAS_AULAS}/${area}/${slug}` : `/trilhas/${slug}`;
}

/** O caminho (sem idioma) de uma aula. */
export function caminhoDaAula(trilha: { slug: string; area?: string } | string, aula: string): string {
  return `${caminhoDaTrilha(trilha)}/${aula}`;
}

/** O caminho (sem idioma) de "trilha/aula", o lessonId das aulas (lib/ids.ts). */
export function caminhoDoLessonId(id: string): string {
  const [trilha, aula] = id.split("/");
  return aula ? caminhoDaAula(trilha, aula) : caminhoDaTrilha(trilha);
}

/** O que fica no endereço de /trilhas mesmo para as trilhas da Escola (não é aula: prova e kit de núcleo). */
const FICAM_NO_SITE = new Set(["prova", "nucleo"]);

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];

/**
 * Um endereço antigo do site que agora mora na Escola: o caminho novo (com o idioma), ou null. Só com idioma (o proxy põe o
 * idioma antes); só a página da disciplina, a da trilha e a da aula. Os formatos da aula (/texto, /cordel, /zine), a prova e o
 * kit de núcleo continuam no site.
 */
export function enderecoAntigoDaEscola(pathname: string): string | null {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length < 3 || partes.length > 4 || !IDIOMAS.includes(partes[0])) return null;
  const [lang, secao, slug, aula] = partes;
  if (secao === "estantes") return partes.length === 3 && areaNaEscola(slug) ? `/${lang}${BASE_DAS_AULAS}/${slug}` : null;
  if (secao !== "trilhas") return null;
  const area = areaDaTrilhaNaEscola(slug);
  if (!area) return null;
  if (aula === undefined) return `/${lang}${BASE_DAS_AULAS}/${area}/${slug}`;
  if (FICAM_NO_SITE.has(aula) || !/^[a-z0-9-]+$/.test(aula)) return null;
  return `/${lang}${BASE_DAS_AULAS}/${area}/${slug}/${aula}`;
}

/** O caminho (sem idioma) é uma das páginas das aulas abertas da Escola (/escola/aulas e abaixo)? */
export const caminhoDasAulasAbertas = (caminhoSemIdioma: string): boolean => {
  const c = caminhoSemIdioma.replace(/\/+$/, "");
  return c === BASE_DAS_AULAS || c.startsWith(`${BASE_DAS_AULAS}/`);
};
