// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Estatística descritiva para quem estuda: média, mediana, moda, amplitude, variância e desvio-padrão (populacional
// e amostral, sempre dizendo qual), quartis e a tabela de frequências para o histograma.

export class ErroDeEstatistica extends Error {
  codigo: "vazio" | "numero";
  detalhe: string;
  constructor(codigo: ErroDeEstatistica["codigo"], detalhe = "") {
    super(codigo);
    this.codigo = codigo;
    this.detalhe = detalhe;
  }
}

/**
 * Lê uma lista de números colada de qualquer lugar. Com ponto e vírgula, espaço ou quebra de linha entre os números, a
 * vírgula é a casa decimal ("1,5; 2,5"). Só com vírgulas, a vírgula separa ("1, 2, 3" ou "1,2,3") e o decimal é o ponto.
 */
export function lerNumeros(texto: string): number[] {
  const limpo = texto.trim().replace(/−/g, "-");
  if (!limpo) throw new ErroDeEstatistica("vazio");
  const temOutroSeparador = /[;\n\t]/.test(limpo) || /\d\s+[\d-]/.test(limpo);
  const pedacos = temOutroSeparador ? limpo.split(/[;\s]+/) : limpo.split(/,\s*/);
  return pedacos
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const normal = temOutroSeparador ? p.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".") : p;
      if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normal)) throw new ErroDeEstatistica("numero", p);
      return Number(normal);
    });
}

export interface Resumo {
  n: number;
  soma: number;
  media: number;
  mediana: number;
  modas: number[];
  minimo: number;
  maximo: number;
  amplitude: number;
  varianciaPopulacional: number;
  desvioPopulacional: number;
  /** Com n − 1 no denominador; não existe com um número só. */
  varianciaAmostral: number | null;
  desvioAmostral: number | null;
  q1: number;
  q3: number;
  ordenados: number[];
}

const mediana = (ordenados: number[]) => {
  const n = ordenados.length;
  const meio = Math.floor(n / 2);
  return n % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
};

/**
 * Quartis pelo método das medianas das metades (o mais usado nos livros escolares): Q1 é a mediana da metade de baixo
 * e Q3 a da metade de cima, sem a mediana quando n é ímpar. Outros métodos (planilhas, por exemplo) dão valores um
 * pouco diferentes; a tela avisa.
 */
export function resumir(numeros: number[]): Resumo {
  if (numeros.length === 0) throw new ErroDeEstatistica("vazio");
  const ordenados = [...numeros].sort((a, b) => a - b);
  const n = ordenados.length;
  const soma = ordenados.reduce((s, v) => s + v, 0);
  const media = soma / n;
  const desvios = ordenados.reduce((s, v) => s + (v - media) ** 2, 0);
  const contagem = new Map<number, number>();
  for (const v of ordenados) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  const maior = Math.max(...contagem.values());
  // Se todos os valores aparecem o mesmo número de vezes, não há moda (o conjunto é amodal).
  const modas = [...contagem].filter(([, c]) => c === maior).map(([v]) => v);
  const amodal = contagem.size > 1 && [...contagem.values()].every((c) => c === maior);
  const metade = Math.floor(n / 2);
  const baixo = ordenados.slice(0, metade);
  const cima = ordenados.slice(n % 2 ? metade + 1 : metade);
  return {
    n,
    soma,
    media,
    mediana: mediana(ordenados),
    modas: amodal ? [] : modas,
    minimo: ordenados[0],
    maximo: ordenados[n - 1],
    amplitude: ordenados[n - 1] - ordenados[0],
    varianciaPopulacional: desvios / n,
    desvioPopulacional: Math.sqrt(desvios / n),
    varianciaAmostral: n > 1 ? desvios / (n - 1) : null,
    desvioAmostral: n > 1 ? Math.sqrt(desvios / (n - 1)) : null,
    q1: n > 1 ? mediana(baixo) : ordenados[0],
    q3: n > 1 ? mediana(cima) : ordenados[0],
    ordenados,
  };
}

export interface Classe {
  de: number;
  ate: number;
  vezes: number;
}

/** Tabela de frequências com o número de classes pela regra de Sturges (k = 1 + log₂ n, arredondado para cima). */
export function classes(numeros: number[]): Classe[] {
  const r = resumir(numeros);
  if (r.amplitude === 0) return [{ de: r.minimo, ate: r.maximo, vezes: r.n }];
  const k = Math.max(1, Math.ceil(1 + Math.log2(r.n)));
  const largura = r.amplitude / k;
  const lista: Classe[] = Array.from({ length: k }, (_, i) => ({ de: r.minimo + i * largura, ate: r.minimo + (i + 1) * largura, vezes: 0 }));
  // Cada classe inclui o começo e não o fim; a última inclui também o maior valor.
  for (const v of r.ordenados) lista[Math.min(k - 1, Math.floor((v - r.minimo) / largura))].vezes++;
  return lista;
}
