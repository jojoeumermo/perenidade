// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 51 (Prompt 4): linhas compartilháveis. A regra publicada (só #temas e comunidades abertas) mora no banco, sem quem segue; seguir
// é só NESTE aparelho: a linha entra nas "Minhas linhas" (lib/rede/linha-aberta.ts, a mesma linha montada da onda 7) e o código fica
// guardado aqui para a linha se atualizar quando quem publicou mudar ou tirar. Sem "@/" de propósito (roda nos testes).
import { apagarLinha, criarLinha, guardarLinhas, lerLinhas, type ErroDaLinha, type Guarda as GuardaDaLinha, type LinhaMontada } from "../linha-aberta";
import { gravarNoAparelho, lerDoAparelho, type Guarda } from "./aparelho";

/** Uma linha como o banco devolve (public.rede_p4_de_linha). */
export interface LinhaCompartilhada {
  codigo: string;
  nome: string;
  minha: boolean;
  tags: string[];
  comunidades: { slug: string; nome: string }[];
}

export interface Seguida {
  codigo: string;
  /** O id da linha montada correspondente neste aparelho. */
  local: string;
}

export const CODIGO_OK = /^[a-f0-9]{12}$/;

/** O código colado (aceita o endereço inteiro com ?linha=…). */
export function codigoDe(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  const m = /(?:linha=)?([a-f0-9]{12})\b/.exec(t);
  return m && CODIGO_OK.test(m[1]) ? m[1] : null;
}

export function seguidas(g?: Guarda | null): Seguida[] {
  const v = lerDoAparelho<unknown>("linhas-seguidas", g);
  return Array.isArray(v) ? (v as Seguida[]).filter((x) => x && CODIGO_OK.test(String(x.codigo)) && typeof x.local === "string") : [];
}

const filtroDe = (l: LinhaCompartilhada) => ({ ...(l.tags.length ? { tags: l.tags } : {}), ...(l.comunidades.length ? { comunidades: l.comunidades.map((c) => c.slug) } : {}) });

/** Segue: a linha entra nas "Minhas linhas" deste aparelho. Devolve as seguidas ou o motivo de não caber. */
export function seguirLinha(l: LinhaCompartilhada, g?: Guarda | null, gl?: GuardaDaLinha | null): Seguida[] | ErroDaLinha | "ja" {
  const atuais = seguidas(g);
  if (atuais.some((s) => s.codigo === l.codigo)) return "ja";
  const antes = lerLinhas(gl);
  const depois = criarLinha(antes, { nome: l.nome.slice(0, 30), base: "tudo", filtro: filtroDe(l), fixada: false });
  if (typeof depois === "string") return depois;
  const nova = depois[depois.length - 1];
  guardarLinhas(depois, gl);
  const lista = [...atuais, { codigo: l.codigo, local: nova.id }];
  gravarNoAparelho("linhas-seguidas", lista, g);
  return lista;
}

/** Atualiza a linha local com a regra do banco (nome e filtro). Nula: quem publicou tirou, e a linha local sai também. */
export function atualizarSeguida(codigo: string, l: LinhaCompartilhada | null, g?: Guarda | null, gl?: GuardaDaLinha | null): LinhaMontada[] {
  const s = seguidas(g).find((x) => x.codigo === codigo);
  let linhas = lerLinhas(gl);
  if (!s) return linhas;
  if (!l) return deixarDeSeguir(codigo, g, gl);
  const filtro = filtroDe(l);
  linhas = linhas.map((x) => (x.id === s.local ? { ...x, nome: l.nome.slice(0, 30), filtro } : x));
  guardarLinhas(linhas, gl);
  return linhas;
}

/** Deixa de seguir: o código sai daqui e a linha sai das "Minhas linhas". */
export function deixarDeSeguir(codigo: string, g?: Guarda | null, gl?: GuardaDaLinha | null): LinhaMontada[] {
  const atuais = seguidas(g);
  const s = atuais.find((x) => x.codigo === codigo);
  gravarNoAparelho("linhas-seguidas", atuais.filter((x) => x.codigo !== codigo).length ? atuais.filter((x) => x.codigo !== codigo) : null, g);
  const linhas = s ? apagarLinha(lerLinhas(gl), s.local) : lerLinhas(gl);
  guardarLinhas(linhas, gl);
  return linhas;
}

/** Os #temas digitados (separados por vírgula ou espaço), sem "#", até 5. */
export function temasDigitados(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).map((x) => x.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].slice(0, 6);
}
