// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// A conta dos circuitos de lâmpadas (série e paralelo), separada do desenho para ser testada no Node.

export interface Lampada {
  ohm: number;
  chave: boolean;
  queimada: boolean;
}

/** O circuito resolvido: corrente, tensão e potência em cada lâmpada (lei de Ohm). */
export function resolver(tipo: "serie" | "paralelo", volts: number, lampadas: Lampada[], geral: boolean) {
  const aberta = (l: Lampada) => !l.chave || l.queimada;
  if (!geral) return { total: 0, cada: lampadas.map(() => ({ i: 0, v: 0, p: 0 })) };
  if (tipo === "serie") {
    // Em série a corrente é uma só: qualquer abertura (chave ou lâmpada queimada) apaga tudo.
    if (lampadas.some(aberta)) return { total: 0, cada: lampadas.map(() => ({ i: 0, v: 0, p: 0 })), aberto: true };
    const r = lampadas.reduce((s, l) => s + l.ohm, 0);
    const i = volts / r;
    return { total: i, cada: lampadas.map((l) => ({ i, v: i * l.ohm, p: i * i * l.ohm })) };
  }
  // Em paralelo cada ramo tem a tensão inteira da fonte; as correntes se somam.
  const cada = lampadas.map((l) => (aberta(l) ? { i: 0, v: 0, p: 0 } : { i: volts / l.ohm, v: volts, p: (volts * volts) / l.ohm }));
  return { total: cada.reduce((s, c) => s + c.i, 0), cada };
}
