// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas puras da tela Tirar uma dúvida (F6 da Escola de Formação, prancha Cel-Dúvida): de que aula a pessoa veio
// (pelo endereço: ?aula=F-0304&de=/escola/formacao/...), o texto que vai para a pauta do núcleo e o aviso de cada recusa
// do banco (public.escola_levar_ao_nucleo, da F4).
// Puro e sem "@/" de propósito: scripts/testar-escola-frente.mjs roda este arquivo direto no Node.

/** Mesmos limites da pauta do núcleo (um item de pauta curto). */
export const TEXTO_MIN = 3;
export const TEXTO_MAX = 200;

const CODIGO_DA_AULA = /^F-\d{4}$/;
/** Só volta para dentro da Formação da Escola: nada de endereço de fora, "//", ".." ou barra invertida. */
const VOLTA = /^\/escola\/formacao(?:\/[a-z0-9-]{1,160}){1,2}$/;

export interface ContextoDaDuvida {
  /** O código da aula no quadro (F-0304), ou null. */
  aula: string | null;
  /** O caminho da aula (sem idioma) para "Voltar à aula", ou null. */
  de: string | null;
}

/** Lê ?aula= e ?de= do endereço, aceitando só o formato esperado (o resto é ignorado, nunca mostrado). */
export function contextoDaDuvida(busca: string): ContextoDaDuvida {
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(busca);
  } catch {
    return { aula: null, de: null };
  }
  const aula = p.get("aula");
  const de = p.get("de");
  return { aula: aula && CODIGO_DA_AULA.test(aula) ? aula : null, de: de && VOLTA.test(de) ? de : null };
}

/** O texto da dúvida como vai para a pauta: espaços juntados; null se curto ou longo demais. */
export function textoParaLevar(bruto: string): string | null {
  const t = bruto.replace(/\s+/g, " ").trim();
  return t.length >= TEXTO_MIN && t.length <= TEXTO_MAX ? t : null;
}

export type AvisoDoLevar = "ausente" | "semPermissao" | "semNucleo" | "semEncontro" | "pautaCheia" | "tamanho" | "falha";

/** O código de recusa do banco (ou do lerDaEscola, na prévia) vira o aviso da tela. */
export function avisoDoLevar(codigo: string): AvisoDoLevar {
  if (codigo === "banco_desatualizado" || codigo === "ausente") return "ausente";
  if (codigo === "sem_permissao" || codigo === "entre_primeiro") return "semPermissao";
  if (codigo === "sem_nucleo") return "semNucleo";
  if (codigo === "sem_encontro") return "semEncontro";
  if (codigo === "pauta_cheia") return "pautaCheia";
  if (codigo.startsWith("invalido")) return "tamanho";
  return "falha";
}
