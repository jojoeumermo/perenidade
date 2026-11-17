// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O índice dos 5.570 municípios (lib/rede/mapa/municipios.json, gerado de malha pública do IBGE por scripts/gerar-malha-do-mapa.mjs):
// para cada UF, "Nome|x|y" separados por ";", com o ponto do centro do município no desenho de malha-brasil.json. O arquivo só
// chega ao navegador na tela do mapa (import dinâmico). Sem os atalhos "@/" de propósito (o teste roda no Node).
import { CAPITAIS, ehUF, nomeNaChave, type UF } from "./lugar";

export interface Municipio {
  /** O nome como o IBGE escreve ("São Paulo"). */
  nome: string;
  uf: UF;
  /** O centro do município no desenho (inteiros, mesmo sistema de malha-brasil.json). */
  x: number;
  y: number;
}

export type IndiceBruto = Record<string, string>;

export interface Indice {
  /** Os municípios pela chave do nome (vários estados podem ter o mesmo nome). */
  porNome: Map<string, Municipio[]>;
  total: number;
}

/** Monta o índice a partir do arquivo. */
export function montarIndice(bruto: IndiceBruto): Indice {
  const porNome = new Map<string, Municipio[]>();
  let total = 0;
  for (const [uf, linha] of Object.entries(bruto)) {
    if (!ehUF(uf)) continue;
    for (const item of linha.split(";")) {
      const [nome, x, y] = item.split("|");
      const m: Municipio = { nome, uf, x: Number(x), y: Number(y) };
      const k = nomeNaChave(nome);
      const lista = porNome.get(k);
      if (lista) lista.push(m);
      else porNome.set(k, [m]);
      total++;
    }
  }
  return { porNome, total };
}

export type Achado = { tipo: "municipio"; municipio: Municipio } | { tipo: "varios"; ufs: UF[] } | { tipo: "nenhum" };

/**
 * Acha o município de um lugar {nome, uf}. Com a UF: só nela. Sem a UF: o único com esse nome; se houver vários, a capital (se um
 * deles for capital); senão "varios" (o nome existe em mais de um estado e ninguém escreveu qual) e o lugar fica fora do desenho.
 */
export function acharMunicipio(indice: Indice, nome: string, uf: string | null): Achado {
  const lista = indice.porNome.get(nome) ?? [];
  if (uf) {
    const m = lista.find((x) => x.uf === uf);
    return m ? { tipo: "municipio", municipio: m } : { tipo: "nenhum" };
  }
  if (lista.length === 1) return { tipo: "municipio", municipio: lista[0] };
  if (lista.length === 0) return { tipo: "nenhum" };
  const capital = lista.find((x) => CAPITAIS[x.uf] === nome);
  return capital ? { tipo: "municipio", municipio: capital } : { tipo: "varios", ufs: lista.map((x) => x.uf).sort() };
}

let carregado: Promise<Indice> | null = null;
/** O índice, carregado uma vez por aba. */
export function carregarIndice(): Promise<Indice> {
  carregado ??= import("./municipios.json").then((m) => montarIndice((m as { default: IndiceBruto }).default ?? (m as unknown as IndiceBruto)));
  return carregado;
}
