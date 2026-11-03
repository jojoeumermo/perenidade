// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O passaporte do campus (E4-09, R1-73; docs/escola/campus.md): a primeira visita a uma seção de cada prédio fica
// carimbada SÓ neste aparelho, em "lucia:escola:passaporte" ({ predio: "AAAA-MM-DD" }), que entra na cópia de
// segurança e sai no "apagar meus dados". Com o modo seguro ligado, nada é carimbado. Sem pontos e sem ranking: o mapa
// só mostra o carimbo e "Conheça o campus: 3 de 8 prédios". Nada vai para o servidor.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node, com armazenamentos de mentira.

import { estaLigado } from "../modo-seguro";
import { IDS_DOS_PREDIOS, type IdDoPredio, predioDoCaminho } from "./campus";
import { CHAVES_DA_ESCOLA } from "./estudante";

export { predioDoCaminho };

export const CHAVE_DO_PASSAPORTE = CHAVES_DA_ESCOLA.passaporte;
export type Passaporte = Partial<Record<IdDoPredio, string>>;

type Local = Pick<Storage, "getItem" | "setItem">;
type Sessao = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const local = (): Local | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const ehPredio = (v: string): v is IdDoPredio => (IDS_DOS_PREDIOS as readonly string[]).includes(v);

/** Só os carimbos com a forma certa (o valor pode ter sido mexido à mão ou vir de uma cópia antiga). */
export function validarPassaporte(bruto: unknown): Passaporte {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const saida: Passaporte = {};
  for (const [predio, dia] of Object.entries(bruto as Record<string, unknown>)) if (ehPredio(predio) && typeof dia === "string" && DIA.test(dia)) saida[predio] = dia;
  return saida;
}

export function lerPassaporte(armazenamento: Local | null = local()): Passaporte {
  try {
    const texto = armazenamento?.getItem(CHAVE_DO_PASSAPORTE);
    return validarPassaporte(texto ? JSON.parse(texto) : null);
  } catch {
    return {};
  }
}

/** O dia local (AAAA-MM-DD) do aparelho. */
const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Carimba a primeira visita ao prédio. Já carimbado, não muda (fica a data da primeira). Devolve true só quando gravou.
 * Com o modo seguro ligado (ou sem armazenamento), não grava nada.
 */
export function carimbar(predio: IdDoPredio, data: Date | string = new Date(), armazenamento: Local | null = local(), sessao?: Sessao | null): boolean {
  if (!ehPredio(predio) || !armazenamento) return false;
  if (sessao === undefined ? estaLigado() : estaLigado(sessao)) return false;
  const passaporte = lerPassaporte(armazenamento);
  if (passaporte[predio]) return false;
  const dia = typeof data === "string" ? data : diaLocal(data);
  if (!DIA.test(dia)) return false;
  passaporte[predio] = dia;
  try {
    armazenamento.setItem(CHAVE_DO_PASSAPORTE, JSON.stringify(passaporte));
  } catch {
    return false;
  }
  try {
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // fora do navegador não há quem ouvir
  }
  return true;
}

/** Carimba o prédio do caminho aberto, se ele for de algum prédio. */
export function carimbarCaminho(caminho: string, data: Date | string = new Date(), armazenamento: Local | null = local(), sessao?: Sessao | null): IdDoPredio | null {
  const predio = predioDoCaminho(caminho);
  return predio && carimbar(predio, data, armazenamento, sessao) ? predio : null;
}

/** Quantos prédios já têm carimbo. */
export const visitados = (p: Passaporte) => IDS_DOS_PREDIOS.filter((id) => Boolean(p[id])).length;
