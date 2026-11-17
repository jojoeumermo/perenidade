// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conta do toque no desenho do mapa, sem tela (o teste roda em Node). Cada cidade tem uma área de toque de 44 px na tela, maior
// que o ladrilho; no celular, com o Brasil inteiro em 390 px, as áreas de cidades próximas se sobrepõem. Em vez de acertar uma
// cidade por sorte (a de cima no desenho), o toque junta TODAS as cidades cuja área contém o ponto tocado: uma só, ela abre; mais
// de uma, a tela mostra a lista delas. Sem "@/" de propósito.
import { tamanhoDoPonto, type Filtro, type PontoDoMapa } from "../../../lib/rede/mapa/regras";

/** O lado do ladrilho de cada tamanho, em unidades do desenho do Brasil inteiro (a escala multiplica). */
export const LADO = [13, 18, 24] as const;
/** O alvo de toque de cada cidade, em pixels da tela. */
export const ALVO_PX = 44;

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Os tipos que o ponto mostra com o filtro de agora (um ladrilho para cada). */
export function tiposDoPonto(p: PontoDoMapa, filtro: Filtro): ("chamados" | "eventos" | "nucleos")[] {
  return (["chamados", "eventos", "nucleos"] as const).filter((tipo) => filtro[tipo] && p[`${tipo}_ha`]);
}

/** O desenho de um ponto: o lado e a largura da fileira de ladrilhos, e a área de toque (nunca menor que o alvo). */
export function geometriaDoPonto(p: PontoDoMapa, filtro: Filtro, escala: number, alvo: number) {
  const tipos = tiposDoPonto(p, filtro);
  const lado = LADO[tamanhoDoPonto(p, filtro) - 1] * escala;
  const vao = 2.5 * escala;
  const largura = tipos.length * lado + Math.max(0, tipos.length - 1) * vao;
  const ladoDoAlvo = Math.max(alvo, lado);
  const larguraDoAlvo = Math.max(alvo, largura);
  const area: Caixa = { x: p.municipio.x - larguraDoAlvo / 2, y: p.municipio.y - ladoDoAlvo / 2, largura: larguraDoAlvo, altura: ladoDoAlvo };
  return { tipos, lado, vao, largura, x0: p.municipio.x - largura / 2, y0: p.municipio.y - lado / 2, area };
}

/**
 * As cidades cuja área de toque contém o ponto tocado (em unidades do desenho), da mais perto para a mais longe do toque.
 * Lista vazia: o toque caiu fora de todas (a conta arredonda diferente do navegador na borda).
 */
export function pontosNoToque(pontos: PontoDoMapa[], filtro: Filtro, escala: number, alvo: number, x: number, y: number): PontoDoMapa[] {
  const dentro: { p: PontoDoMapa; d: number }[] = [];
  for (const p of pontos) {
    const { area } = geometriaDoPonto(p, filtro, escala, alvo);
    if (x >= area.x && x <= area.x + area.largura && y >= area.y && y <= area.y + area.altura) {
      dentro.push({ p, d: (p.municipio.x - x) ** 2 + (p.municipio.y - y) ** 2 });
    }
  }
  return dentro.sort((a, b) => a.d - b.d || a.p.municipio.nome.localeCompare(b.p.municipio.nome)).map((x) => x.p);
}
