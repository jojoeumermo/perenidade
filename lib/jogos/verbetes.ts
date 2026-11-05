// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Só o servidor importa este arquivo: lê o glossário (content/glossario e os termos que as aulas definem, pelo mesmo
// índice da página /glossario) e entrega os verbetes que os jogos de treino usam, já enxutos.
import type { Locale } from "../../i18n/config";
import { getGlossaryIndex } from "../content";
import type { Verbete } from "./base";

/** Quantos verbetes seguem para o navegador: o suficiente para variar as partidas sem pesar no celular de entrada. */
export const MAXIMO_DE_VERBETES = 260;

/** Termos para os jogos: definição de tamanho razoável, sem parênteses no termo, no máximo MAXIMO_DE_VERBETES. */
export function verbetesParaJogos(): Verbete[] {
  const todos = getGlossaryIndex("pt" as Locale)
    .map((t) => ({ termo: t.term.trim(), resumo: t.summary.replace(/\s+/g, " ").trim(), aula: t.lessons[0] ? { titulo: t.lessons[0].title, href: t.lessons[0].href } : undefined }))
    .filter((v) => v.termo.length >= 3 && v.resumo.length >= 20 && v.resumo.length <= 260 && !/[()]/.test(v.termo));
  // Entram primeiro os termos de uma palavra só (servem a todos os jogos de letras), depois os demais, até o limite.
  const simples = todos.filter((v) => /^[\p{L}]+$/u.test(v.termo));
  const outros = todos.filter((v) => !/^[\p{L}]+$/u.test(v.termo));
  return [...simples, ...outros].slice(0, MAXIMO_DE_VERBETES);
}
