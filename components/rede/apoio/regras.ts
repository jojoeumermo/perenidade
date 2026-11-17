// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do apoio (onda 13, frente 13A; supabase/migracoes/20261119-alumia-o13-apoio.sql): os tipos da vaquinha e da
// petição com meta, os limites (os mesmos do banco; o teste confere), a limpeza do que vem do servidor e o documento de entrega.
// Sem "@/" de propósito (o teste importa direto).
//
// Nenhum pagamento passa pela Alumia: o "como apoiar" é a chave Pix da organização como texto e/ou um link de fora, e só de
// organização com selo. Quem doa nunca aparece. A petição nunca traz quem assinou: só o número, a partir de 3.
import type { CaixaDaOrg, CaixasDaOrg } from "../../../lib/rede/org/b1";
import type { PeticaoDoAto } from "../../../lib/rede/tipos-atos";

export const LIMITES_DO_APOIO = {
  /** A meta da vaquinha, em centavos: de R$ 1 a R$ 1 bilhão. */
  metaCaixaMin: 100,
  centavosMax: 100_000_000_000,
  /** A meta da petição, em assinaturas. */
  metaPeticaoMin: 10,
  metaPeticaoMax: 10_000_000,
  /** A prestação de contas: de 10 a 1000 letras, com o dia até 2 anos para trás. */
  contaMin: 10,
  contaMax: 1000,
  diasParaTras: 730,
  pixMax: 140,
  linkMax: 300,
} as const;

export interface ContaDaVaquinha { id: string; dia: string; texto: string; link: string | null; possoRetirar: boolean }
export interface CaixaComVaquinha extends CaixaDaOrg { meta: number | null; arrecadado: number | null; arrecadadoDia: string | null; contas: ContaDaVaquinha[] }
export interface CaixasComVaquinha extends Omit<CaixasDaOrg, "caixas"> { selo: boolean; caixas: CaixaComVaquinha[] }

export interface PeticaoComMeta extends PeticaoDoAto { meta: number | null; chegou: boolean }

/** O documento de entrega da petição: só o número, o texto e as datas. Nenhum nome. */
export interface EntregaDaPeticao {
  alvo: string;
  texto: string;
  total: number;
  meta: number | null;
  abertaEm: string;
  prazo: string | null;
  encerrada: boolean;
  ato: string | null;
  geradoEm: string;
}

const inteiro = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const dia = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const linkHttps = (v: unknown): string | null => (typeof v === "string" && /^https:\/\/\S{3,}$/.test(v) && v.length <= LIMITES_DO_APOIO.linkMax ? v : null);

/** Desconfia do que vem do servidor: sem selo, nada de Pix nem link (a regra do banco, de novo aqui). */
export function limparCaixas(r: (CaixasDaOrg & { selo?: boolean }) | null | undefined): CaixasComVaquinha | null {
  if (!r || !Array.isArray(r.caixas)) return null;
  const selo = r.selo === true;
  return {
    dentro: r.dentro === true,
    tesouraria: r.tesouraria === true,
    gerencio: r.gerencio === true,
    selo,
    caixas: r.caixas.map((c0) => {
      const c = c0 as Partial<CaixaComVaquinha> & CaixaDaOrg;
      return {
        ...c,
        pix: selo && typeof c.pix === "string" && c.pix ? c.pix : null,
        link: selo ? linkHttps(c.link) : null,
        meta: inteiro(c.meta, LIMITES_DO_APOIO.metaCaixaMin, LIMITES_DO_APOIO.centavosMax),
        arrecadado: inteiro(c.arrecadado, 0, LIMITES_DO_APOIO.centavosMax),
        arrecadadoDia: dia(c.arrecadadoDia),
        contas: (Array.isArray(c.contas) ? c.contas : []).filter((k) => k && typeof k.id === "string").map((k) => ({
          id: k.id, dia: dia(k.dia) ?? "", texto: texto(k.texto), link: linkHttps(k.link), possoRetirar: k.possoRetirar === true,
        })),
      };
    }),
  };
}

/** A petição com a meta. O total só de 3 para cima; "chegou" só com o total publicado. */
export function limparPeticaoComMeta(p: (Partial<PeticaoComMeta> & { id?: unknown }) | null | undefined): PeticaoComMeta | null {
  if (!p || typeof p.id !== "string") return null;
  const total = typeof p.total === "number" && Number.isInteger(p.total) && p.total >= 3 ? p.total : null;
  const meta = inteiro(p.meta, LIMITES_DO_APOIO.metaPeticaoMin, LIMITES_DO_APOIO.metaPeticaoMax);
  return {
    id: p.id,
    ato: String(p.ato ?? ""),
    alvo: texto(p.alvo),
    texto: texto(p.texto),
    prazo: typeof p.prazo === "string" ? p.prazo : null,
    aberta: p.aberta === true,
    total,
    assinei: p.assinei === true,
    organiza: p.organiza === true,
    meta,
    chegou: p.chegou === true && total !== null && meta !== null,
  };
}

/** A meta escrita no campo da petição ("" = sem meta; "1.000" = 1000). "numero" quando não serve. */
export function lerMetaDaPeticao(escrito: string): number | null | "numero" {
  const t = (escrito ?? "").replace(/[\s.]/g, "");
  if (!t) return null;
  if (!/^\d{1,8}$/.test(t)) return "numero";
  const n = Number(t);
  return n >= LIMITES_DO_APOIO.metaPeticaoMin && n <= LIMITES_DO_APOIO.metaPeticaoMax ? n : "numero";
}

/** Quantos dos 20 ladrilhos da meta ficam acesos (qualquer valor acima de zero acende ao menos um; nunca passa de 20). */
export function casasDaMeta(valor: number | null, meta: number | null, casas = 20): number {
  if (!valor || !meta || valor <= 0 || meta <= 0) return 0;
  return Math.min(casas, Math.max(1, Math.ceil((valor / meta) * casas - 1e-9)));
}

const preencher = (modelo: string, valores: Record<string, string>) => modelo.replace(/\{(\w+)\}/g, (m, k: string) => valores[k] ?? m);
const local = (lang: string) => (lang === "pt" ? "pt-BR" : lang);
const dataLonga = (iso: string, lang: string) => new Date(iso).toLocaleDateString(local(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

export interface TextosDoDocumento { titulo: string; para: string; ato: string; total: string; meta: string; abertaEm: string; prazo: string; encerrada: string; gerado: string; nota: string }

/** O documento de entrega em texto simples (para imprimir ou salvar): para quem, o texto, o número e as datas. Nenhum nome. */
export function documentoDaEntrega(e: EntregaDaPeticao, t: TextosDoDocumento, lang: string): string {
  const n = (x: number) => x.toLocaleString(local(lang));
  const linhas = [
    t.titulo.toUpperCase(),
    "",
    preencher(t.para, { alvo: e.alvo }),
    ...(e.ato ? [preencher(t.ato, { ato: e.ato })] : []),
    "",
    e.texto,
    "",
    preencher(t.total, { n: n(e.total) }),
    ...(e.meta ? [preencher(t.meta, { meta: n(e.meta) })] : []),
    preencher(t.abertaEm, { data: dataLonga(e.abertaEm, lang) }),
    ...(e.encerrada ? [t.encerrada] : e.prazo ? [preencher(t.prazo, { data: dataLonga(e.prazo, lang) })] : []),
    preencher(t.gerado, { data: dataLonga(e.geradoEm, lang) }),
    "",
    t.nota,
  ];
  return linhas.join("\n");
}
