// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas da bancada de eletrônica: LED e resistor, carga e descarga do capacitor, portas lógicas e somadores, a fonte
// que transforma a tomada em tensão contínua (retificador e filtro) e o divisor de tensão com sensor de luz. Valores
// típicos de componentes comuns; cada fabricante tem a sua folha de dados.

/** Tensão direta típica de cada cor de LED (V) e a corrente de trabalho comum (20 mA). */
export const LEDS = {
  vermelho: { vf: 2.0, cor: "#ff3b30", nome: "vermelho" },
  amarelo: { vf: 2.1, cor: "#ffd60a", nome: "amarelo" },
  verde: { vf: 2.2, cor: "#30d158", nome: "verde" },
  azul: { vf: 3.1, cor: "#0a84ff", nome: "azul" },
  branco: { vf: 3.2, cor: "#f5f5f5", nome: "branco" },
} as const;
export type CorDoLed = keyof typeof LEDS;

export const I_TRABALHO = 0.02;
export const I_QUEIMA = 0.03;
export const P_RESISTOR = 0.25;

export type EstadoDoLed = "apagado" | "fraco" | "certo" | "forte" | "queimou";

/** LED com resistor em série: corrente, potência no resistor e o que acontece com o LED. */
export function led(fonte: number, cor: CorDoLed, ohm: number) {
  const vf = LEDS[cor].vf;
  const sobra = fonte - vf;
  const i = sobra <= 0 ? 0 : ohm <= 0 ? Infinity : sobra / ohm;
  const pResistor = Number.isFinite(i) ? i * i * ohm : Infinity;
  let estado: EstadoDoLed;
  if (i === 0) estado = "apagado";
  else if (i > I_QUEIMA) estado = "queimou";
  else if (i > 0.022) estado = "forte";
  else if (i < 0.002) estado = "fraco";
  else estado = "certo";
  return { i, vf, pResistor, estado, resistorEsquenta: pResistor > P_RESISTOR, brilho: estado === "queimou" ? 0 : Math.min(1, i / I_TRABALHO) };
}

/** O resistor recomendado para o LED: (fonte − Vf) ÷ 20 mA, arredondado para o valor comercial acima. */
export function resistorDoLed(fonte: number, cor: CorDoLed) {
  const conta = (fonte - LEDS[cor].vf) / I_TRABALHO;
  return { conta, comercial: conta <= 0 ? 0 : comercialAcima(conta) };
}

const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
/** Os valores E12 de 10 Ω a 1 MΩ (os de qualquer loja). */
export const SERIE_E12 = [1, 10, 100, 1000, 10000, 100000].flatMap((d) => E12.map((b) => (b * d) / 10)).concat([1000000]);
export function comercialAcima(v: number) {
  return SERIE_E12.find((x) => x >= v - 1e-9) ?? SERIE_E12[SERIE_E12.length - 1];
}

/** Capacitor carregando ou descarregando por um resistor: v(t) em volts. t em segundos, ohm em Ω, faradays em F. */
export function rc(fonte: number, ohm: number, faradays: number, t: number, carregando: boolean) {
  const tau = ohm * faradays;
  const e = Math.exp(-t / tau);
  return carregando ? fonte * (1 - e) : fonte * e;
}

export type Porta = "E" | "OU" | "NAO" | "NAOE" | "NAOU" | "OUEX";
export const PORTAS: Record<Porta, { nome: string; ingles: string; f: (a: boolean, b: boolean) => boolean; entradas: 1 | 2 }> = {
  E: { nome: "E", ingles: "AND", f: (a, b) => a && b, entradas: 2 },
  OU: { nome: "OU", ingles: "OR", f: (a, b) => a || b, entradas: 2 },
  NAO: { nome: "NÃO", ingles: "NOT", f: (a) => !a, entradas: 1 },
  NAOE: { nome: "NÃO-E", ingles: "NAND", f: (a, b) => !(a && b), entradas: 2 },
  NAOU: { nome: "NÃO-OU", ingles: "NOR", f: (a, b) => !(a || b), entradas: 2 },
  OUEX: { nome: "OU exclusivo", ingles: "XOR", f: (a, b) => a !== b, entradas: 2 },
};

/** A tabela-verdade de uma porta, como texto de 0 e 1 (as saídas para 00, 01, 10, 11). */
export function tabela(p: Porta) {
  return [[false, false], [false, true], [true, false], [true, true]].map(([a, b]) => (PORTAS[p].f(a, b) ? "1" : "0")).join("");
}

/** Meio somador (OU exclusivo dá a soma, E dá o vai-um) e somador completo (dois meios e um OU). */
export function meioSomador(a: boolean, b: boolean) {
  return { soma: a !== b, vaiUm: a && b };
}
export function somadorCompleto(a: boolean, b: boolean, vem: boolean) {
  const m1 = meioSomador(a, b);
  const m2 = meioSomador(m1.soma, vem);
  return { soma: m2.soma, vaiUm: m1.vaiUm || m2.vaiUm };
}
/** Soma de dois números de 4 bits com quatro somadores completos em fila (o que a ULA do processador faz). */
export function somar4(a: number, b: number) {
  let vem = false;
  const bits: boolean[] = [];
  for (let i = 0; i < 4; i++) {
    const r = somadorCompleto(((a >> i) & 1) === 1, ((b >> i) & 1) === 1, vem);
    bits.push(r.soma);
    vem = r.vaiUm;
  }
  return { valor: bits.reduce((s, x, i) => s + (x ? 1 << i : 0), 0), estouro: vem };
}

export type Retificacao = "nenhuma" | "meia" | "completa";

/**
 * A fonte linear: transformador (tensão de pico), diodos (0,7 V cada um que conduz), capacitor de filtro e a carga.
 * Devolve a saída ao longo de três ciclos de 60 Hz, a ondulação (ripple) e a média. microfarads 0 = sem filtro.
 */
export function fonte(pico: number, tipo: Retificacao, microfarads: number, cargaOhm: number, amostras = 360) {
  const f = 60;
  const total = 3 / f;
  const dt = total / amostras;
  const queda = tipo === "meia" ? 0.7 : tipo === "completa" ? 1.4 : 0;
  const c = microfarads * 1e-6;
  const entrada: number[] = [];
  const saida: number[] = [];
  let v = 0;
  for (let k = 0; k <= amostras; k++) {
    const t = k * dt;
    const s = pico * Math.sin(2 * Math.PI * f * t);
    entrada.push(s);
    const ret = tipo === "nenhuma" ? s : tipo === "meia" ? Math.max(0, s - queda) : Math.max(0, Math.abs(s) - queda);
    // Com filtro, o capacitor só deixa a saída cair o quanto a carga consegue descarregá-lo até o próximo pico.
    v = tipo !== "nenhuma" && c > 0 ? Math.max(ret, v * Math.exp(-dt / (cargaOhm * c))) : ret;
    saida.push(v);
  }
  // A ondulação e a média contam só o último ciclo (o capacitor já carregou).
  const ultimo = saida.slice(Math.floor((amostras * 2) / 3));
  const max = Math.max(...ultimo);
  const min = Math.min(...ultimo);
  const media = ultimo.reduce((s, x) => s + x, 0) / ultimo.length;
  return { entrada, saida, ripple: max - min, media, max, min };
}

/** O LDR (resistor que muda com a luz): alto no escuro, baixo no sol. lux de 0 a 1000. Curva típica, só ilustrativa. */
export function ldr(lux: number) {
  return 200000 * Math.pow(lux + 1, -0.8);
}
/** Divisor de tensão: a saída é a fonte × R2 ÷ (R1 + R2). */
export function divisor(fonte: number, r1: number, r2: number) {
  return (fonte * r2) / (r1 + r2);
}
