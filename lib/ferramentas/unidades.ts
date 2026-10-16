// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Conversor de unidades: cada unidade tem o fator que a leva à unidade de base da grandeza (o metro, o quilograma,
// o segundo…). A conversão passa sempre pela base, e a tela mostra o fator e a conta feita. A temperatura é a
// exceção: as escalas não começam no mesmo zero, então a conta é uma fórmula, não um fator.

export interface Unidade {
  id: string;
  /** Quanto vale 1 desta unidade na unidade de base da grandeza. */
  fator: number;
}

export interface Grandeza {
  id: string;
  base: string;
  unidades: Unidade[];
}

const u = (id: string, fator: number): Unidade => ({ id, fator });

/** Os fatores são os das definições oficiais (SI e acordos internacionais); as unidades brasileiras vêm com a fonte na tela. */
export const grandezas: Grandeza[] = [
  { id: "comprimento", base: "m", unidades: [u("mm", 1e-3), u("cm", 1e-2), u("m", 1), u("km", 1e3), u("pol", 0.0254), u("pe", 0.3048), u("jarda", 0.9144), u("milha", 1609.344), u("milha_nautica", 1852)] },
  // Alqueire paulista (24.200 m²) e mineiro (48.400 m², o dobro): medidas regionais, que mudam de lugar para lugar.
  // Documento oficial usa o hectare; a tela avisa para confirmar qual alqueire vale na região.
  { id: "area", base: "m2", unidades: [u("mm2", 1e-6), u("cm2", 1e-4), u("m2", 1), u("ha", 1e4), u("km2", 1e6), u("alqueire_sp", 24200), u("alqueire_mg", 48400), u("pe2", 0.09290304), u("acre", 4046.8564224)] },
  { id: "volume", base: "m3", unidades: [u("ml", 1e-6), u("cm3", 1e-6), u("l", 1e-3), u("dm3", 1e-3), u("m3", 1), u("galao_us", 0.003785411784)] },
  // Arroba: 15 kg, a medida do gado no Brasil.
  { id: "massa", base: "kg", unidades: [u("mg", 1e-6), u("g", 1e-3), u("kg", 1), u("t", 1e3), u("arroba", 15), u("lb", 0.45359237), u("oz", 0.028349523125)] },
  // O ano é o juliano (365,25 dias), o da astronomia.
  { id: "tempo", base: "s", unidades: [u("s", 1), u("min", 60), u("h", 3600), u("dia", 86400), u("semana", 604800), u("ano", 31557600)] },
  { id: "temperatura", base: "c", unidades: [u("c", 1), u("f", 1), u("k", 1)] },
  { id: "velocidade", base: "m_s", unidades: [u("m_s", 1), u("km_h", 1 / 3.6), u("mph", 0.44704), u("no", 1852 / 3600)] },
  // A caloria é a termoquímica (4,184 J); o elétron-volt é exato desde 2019.
  { id: "energia", base: "j", unidades: [u("j", 1), u("kj", 1e3), u("cal", 4.184), u("kcal", 4184), u("wh", 3600), u("kwh", 3.6e6), u("ev", 1.602176634e-19)] },
  { id: "pressao", base: "pa", unidades: [u("pa", 1), u("kpa", 1e3), u("bar", 1e5), u("atm", 101325), u("mmhg", 133.322387415), u("psi", 6894.757293168)] },
  // Cavalo-vapor (cv) é o métrico, de 735,49875 W; o hp é o mecânico inglês.
  { id: "potencia", base: "w", unidades: [u("w", 1), u("kw", 1e3), u("cv", 735.49875), u("hp", 745.69987158227022)] },
  // Quilobyte do SI (mil bytes) e kibibyte (1.024 bytes): os dois aparecem por aí, e não são a mesma coisa.
  { id: "dados", base: "byte", unidades: [u("bit", 1 / 8), u("byte", 1), u("kb", 1e3), u("mb", 1e6), u("gb", 1e9), u("tb", 1e12), u("kib", 1024), u("mib", 1024 ** 2), u("gib", 1024 ** 3)] },
];

export interface Conversao {
  resultado: number;
  /** Para multiplicar: quanto 1 unidade de origem vale na unidade de destino (não existe na temperatura). */
  fator: number | null;
  /** A fórmula usada, para a tela mostrar (só na temperatura). */
  formula?: "c_f" | "f_c" | "c_k" | "k_c" | "f_k" | "k_f" | "igual";
}

function temperatura(valor: number, de: string, para: string): Conversao {
  if (de === para) return { resultado: valor, fator: 1, formula: "igual" };
  const emC = de === "c" ? valor : de === "f" ? ((valor - 32) * 5) / 9 : valor - 273.15;
  if (de === "k" && valor < 0) throw new RangeError("abaixo_do_zero_absoluto");
  if (emC < -273.15 - 1e-9) throw new RangeError("abaixo_do_zero_absoluto");
  const resultado = para === "c" ? emC : para === "f" ? (emC * 9) / 5 + 32 : emC + 273.15;
  return { resultado, fator: null, formula: `${de}_${para}` as Conversao["formula"] };
}

/** Converte `valor` da unidade `de` para a unidade `para`, dentro da mesma grandeza. */
export function converter(grandeza: string, valor: number, de: string, para: string): Conversao {
  const g = grandezas.find((item) => item.id === grandeza);
  if (!g) throw new RangeError("grandeza");
  const a = g.unidades.find((item) => item.id === de);
  const b = g.unidades.find((item) => item.id === para);
  if (!a || !b || !Number.isFinite(valor)) throw new RangeError("unidade");
  if (g.id === "temperatura") return temperatura(valor, de, para);
  const fator = a.fator / b.fator;
  return { resultado: valor * fator, fator };
}
