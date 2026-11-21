// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 72 (Prompt 4): a estante de fontes com citação pronta. Cada fonte (livro, artigo, página, trabalho acadêmico) fica só NESTE
// aparelho ("lucia:p4-de:fontes", que o Sair rápido apaga) e sai com a referência da ABNT (NBR 6023:2018, a mesma da ferramenta do
// site: lib/ferramentas/rodada.ts) e a citação no texto (NBR 10520: "(FREIRE, 1987, p. 45)"). Nada vai ao servidor. Sem "@/".
import { autorAbnt, referencia, type CamposDaReferencia, type TipoDeReferencia } from "../../ferramentas/rodada";
import { gravarNoAparelho, idNovo, lerDoAparelho, type Guarda } from "./aparelho";

export const TIPOS_DE_FONTE: readonly TipoDeReferencia[] = ["livro", "artigo", "site", "trabalho"];
export const MAXIMO_DE_FONTES = 200;

export interface Fonte {
  id: string;
  tipo: TipoDeReferencia;
  autores: string[];
  campos: Omit<CamposDaReferencia, "autores" | "acesso">;
  /** Quando a página foi acessada (ISO), para o "Acesso em" da ABNT. */
  acesso?: string;
}

const LIMITE_DO_CAMPO = 400;

function limpa(f: Fonte): Fonte | null {
  if (!f || typeof f !== "object" || !TIPOS_DE_FONTE.includes(f.tipo) || typeof f.campos?.titulo !== "string" || !f.campos.titulo.trim()) return null;
  const campos = Object.fromEntries(Object.entries(f.campos).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).slice(0, LIMITE_DO_CAMPO)])) as Fonte["campos"];
  const autores = (Array.isArray(f.autores) ? f.autores : []).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 10);
  return { id: String(f.id || idNovo()), tipo: f.tipo, autores, campos, ...(f.acesso && !Number.isNaN(Date.parse(f.acesso)) ? { acesso: f.acesso } : {}) };
}

export function lerFontes(g?: Guarda | null): Fonte[] {
  const v = lerDoAparelho<unknown>("fontes", g);
  return Array.isArray(v) ? (v as Fonte[]).map(limpa).filter((x): x is Fonte => !!x) : [];
}

/** Guarda uma fonte nova (ou troca a de mesmo id). Devolve a estante ou o motivo de não caber. */
export function guardarFonte(f: Omit<Fonte, "id"> & { id?: string }, g?: Guarda | null): Fonte[] | "titulo" | "muitas" {
  const nova = limpa({ ...f, id: f.id ?? idNovo() } as Fonte);
  if (!nova) return "titulo";
  const atuais = lerFontes(g);
  const outras = atuais.filter((x) => x.id !== nova.id);
  if (outras.length >= MAXIMO_DE_FONTES) return "muitas";
  const lista = [...outras, nova];
  gravarNoAparelho("fontes", lista, g);
  return lista;
}

export function tirarFonte(id: string, g?: Guarda | null): Fonte[] {
  const lista = lerFontes(g).filter((x) => x.id !== id);
  gravarNoAparelho("fontes", lista.length ? lista : null, g);
  return lista;
}

/** As partes da referência ABNT (a de "negrito" é o destaque: título ou revista). */
export function partesDaReferencia(f: Fonte): { t: string; negrito?: boolean }[] {
  return referencia(f.tipo, { ...f.campos, autores: f.autores, ...(f.acesso ? { acesso: new Date(f.acesso) } : {}) } as CamposDaReferencia);
}
export const referenciaTexto = (f: Fonte): string => partesDaReferencia(f).map((p) => p.t).join("");
const escaparHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const referenciaHtml = (f: Fonte): string => partesDaReferencia(f).map((p) => (p.negrito ? `<strong>${escaparHtml(p.t)}</strong>` : escaparHtml(p.t))).join("");

/** A citação no texto: "(FREIRE, 1987)", "(FREIRE; SHOR, 1986, p. 12)", "(SILVA et al., 2020)"; sem autoria, a primeira palavra do título. */
export function citacao(f: Fonte, pagina = ""): string {
  const ano = (f.tipo === "trabalho" ? f.campos.anoDefesa || f.campos.ano : f.campos.ano)?.trim() || "s. d.";
  const sobrenomes = f.autores.map((a) => autorAbnt(a).split(",")[0]).filter(Boolean);
  const quem = sobrenomes.length > 3 ? `${sobrenomes[0]} et al.` : sobrenomes.length ? sobrenomes.join("; ") : `${(f.campos.titulo.trim().split(/\s+/)[0] ?? "").toLocaleUpperCase("pt-BR")} ...`;
  const p = pagina.trim() ? `, p. ${pagina.trim()}` : "";
  return `(${quem}, ${ano}${p})`;
}

/** A lista de referências em ordem alfabética (como a ABNT pede no fim do trabalho). */
export function emOrdem(lista: readonly Fonte[]): Fonte[] {
  return [...lista].sort((a, b) => referenciaTexto(a).localeCompare(referenciaTexto(b), "pt-BR"));
}
