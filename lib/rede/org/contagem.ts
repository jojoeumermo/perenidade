// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Como a F4 escreve números de PESSOAS na tela (PLANO-ALUMIA §6.1; docs/rede/PRIVACIDADE.md §8). Puro: roda no Node nos testes.
// Opinião política e filiação são dado sensível (LGPD art. 5º, II; art. 11): por isso nada abaixo de 3 vira número, e número
// grande vira "mais de" (o desenho mostra "1.204 na sala"; a regra da casa arredonda para não dar para seguir a entrada e a saída
// de uma pessoa só olhando o número mudar). A decisão final entre exato e arredondado é do Jonathan (PLANO-ALUMIA §11).

/** O mínimo para um agregado de pessoas aparecer. */
export const MINIMO_DE_PESSOAS = 3;

/**
 * Arredonda uma contagem de pessoas para mostrar: nulo abaixo de 3; de 3 a 19, exato; de 20 a 99, para baixo de 10 em 10;
 * de 100 a 999, de 50 em 50; daí para cima, de 100 em 100. Devolve o número e se ele foi arredondado ("mais de").
 */
export function pessoasParaMostrar(n: number | null | undefined): { valor: number; maisDe: boolean } | null {
  if (n === null || n === undefined || !Number.isFinite(n) || n < MINIMO_DE_PESSOAS) return null;
  const k = Math.floor(n);
  if (k < 20) return { valor: k, maisDe: false };
  const passo = k < 100 ? 10 : k < 1000 ? 50 : 100;
  const valor = Math.floor(k / passo) * passo;
  return { valor, maisDe: valor !== k };
}

/** Textos para escrever pessoas: "{n}", "mais de {n}" e "poucas pessoas". */
export interface TextosDePessoas {
  exato: string;
  maisDe: string;
  poucas: string;
}

/** A frase pronta ("mais de 1.200 na sala", "poucas pessoas na sala"), com o número no formato do idioma. */
export function escreverPessoas(n: number | null | undefined, t: TextosDePessoas, lang: string): string {
  const p = pessoasParaMostrar(n);
  if (!p) return t.poucas;
  const numero = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang).format(p.valor);
  return (p.maisDe ? t.maisDe : t.exato).replace("{n}", numero);
}

/** Uma proporção (0–1) como porcentagem inteira; fora do intervalo vira nulo. */
export function porcentagem(p: number | null | undefined): number | null {
  if (p === null || p === undefined || !Number.isFinite(p) || p < 0 || p > 1) return null;
  return Math.round(p * 100);
}

/** Uma data AAAA-MM-DD ou ISO como "03/11/2026" (pt) ou no formato curto do idioma. Inválida: o texto como veio. */
export function dataCurta(iso: string, lang: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}

/** Quanto falta para o prazo, em dias ou horas (nulo se já passou). */
export function faltaPara(iso: string, agora: Date = new Date()): { dias: number; horas: number } | null {
  const fim = new Date(iso).getTime();
  if (Number.isNaN(fim)) return null;
  const ms = fim - agora.getTime();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3_600_000);
  return { dias: Math.floor(horas / 24), horas: horas % 24 };
}

/** Só endereços http(s) viram link (a fonte de uma votação, a sala da plenária); o resto é recusado. */
export function linkSeguro(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "Atualizada agora" nos primeiros segundos; depois "Atualizada há N s" (nunca "há 0 s"). `ms` é o tempo desde a última leitura. */
export function haQuanto(textos: { atualizada: string; atualizadaAgora: string }, ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 3 ? textos.atualizadaAgora : textos.atualizada.replace("{s}", String(s));
}
