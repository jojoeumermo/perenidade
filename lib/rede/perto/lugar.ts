// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Perto de Recife (PE)": o município mais perto de uma posição recebida, calculado NO APARELHO com o índice dos municípios que a
// Alumia já tem (lib/rede/mapa/municipios.json, malha pública do IBGE). Nenhum serviço de mapa de fora é chamado (regra 6): a posição
// não sai do aparelho de quem recebeu. O centro de cada município vem do desenho pela conta inversa da projeção (a mesma de
// lib/rede/mapa/avisos.ts, celulaDoMunicipio). Longe de todo município (fora do Brasil): null.
// Sem "@/": roda no Node nos testes.
import type { Indice, Municipio } from "../mapa/indice";
import { distancia } from "./posicao";

/** O ponto do desenho de volta para latitude e longitude (equirretangular, a mesma conta de celulaDoMunicipio). */
export const latLonDoMunicipio = (m: { x: number; y: number }) => ({ la: 5.2294 - 0.037896 * m.y, lo: -74.0084 + 0.039225 * m.x });

/** Mais longe que isto do centro de todo município, a posição está fora do índice. */
export const LONGE_DEMAIS_M = 80_000;

export function municipioPerto(indice: Indice, la: number, lo: number): Municipio | null {
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  let melhor: Municipio | null = null;
  let menor = Infinity;
  for (const lista of indice.porNome.values()) {
    for (const m of lista) {
      const c = latLonDoMunicipio(m);
      // Corte barato antes da conta de verdade (1 grau ≈ 111 km).
      if (Math.abs(c.la - la) > 1.5 || Math.abs(c.lo - lo) > 1.5) continue;
      const d = distancia({ la, lo }, c);
      if (d < menor) {
        menor = d;
        melhor = m;
      }
    }
  }
  return melhor && menor <= LONGE_DEMAIS_M ? melhor : null;
}

/** Abrir no aplicativo de mapas do próprio aparelho (RFC 5870): a Alumia não fica sabendo, e nada vai a um site. */
export const linkGeo = (la: number, lo: number): string => `geo:${la},${lo}`;

// Sem link para mapa de site de fora com a posição (Prompt 4, item 2: "o aparelho nunca pede blocos a um serviço de fora com a
// posição da pessoa"): só o aplicativo de mapas do aparelho (geo:) e as coordenadas para copiar.
