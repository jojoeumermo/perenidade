// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas do laboratório de química: o pH de uma titulação ácido-base (ácido forte ou fraco com base forte) pelo
// balanço de cargas, sem atalho de fórmula pronta, e as cores dos indicadores. Sem os atalhos "@/": roda direto nos testes.

export const KW = 1e-14;

export interface Acido {
  id: string;
  nome: string;
  /** Constante de acidez. Ácido forte: um número enorme (ioniza tudo). */
  ka: number;
}

export const ACIDOS: Acido[] = [
  { id: "hcl", nome: "Ácido clorídrico (HCl), forte", ka: 1e8 },
  { id: "acetico", nome: "Ácido acético (vinagre), fraco", ka: 1.8e-5 },
  { id: "citrico", nome: "Ácido cítrico (1ª ionização), fraco", ka: 7.4e-4 },
];

/**
 * O pH depois de juntar `vb` mL de base forte (NaOH, `cb` mol/L) a `va` mL de um ácido monoprótico (`ca` mol/L).
 * Resolve o balanço de cargas [H+] + [Na+] = [A-] + [OH-] por bissecção no logaritmo de [H+].
 */
export function phDaTitulacao(acido: Pick<Acido, "ka">, ca: number, va: number, cb: number, vb: number): number {
  const vt = (va + vb) / 1000;
  const acidoTotal = (ca * va) / 1000 / vt;
  const sodio = (cb * vb) / 1000 / vt;
  const saldo = (h: number) => h + sodio - (acidoTotal * acido.ka) / (acido.ka + h) - KW / h;
  let baixo = -15;
  let alto = 1;
  for (let i = 0; i < 80; i++) {
    const meio = (baixo + alto) / 2;
    // saldo cresce com [H+]: se positivo, há H+ demais e o log de [H+] precisa descer.
    if (saldo(10 ** meio) > 0) alto = meio;
    else baixo = meio;
  }
  return Math.min(14, Math.max(0, -((baixo + alto) / 2)));
}

/** O volume de base no ponto de equivalência (mL). */
export const volumeDeEquivalencia = (ca: number, va: number, cb: number) => (cb > 0 ? (ca * va) / cb : Infinity);

/** A curva inteira, de 0 até `vMax` mL de base, em `passos` pontos. */
export function curvaDaTitulacao(acido: Pick<Acido, "ka">, ca: number, va: number, cb: number, vMax: number, passos = 160): [number, number][] {
  return Array.from({ length: passos + 1 }, (_, i) => {
    const vb = (vMax * i) / passos;
    return [vb, phDaTitulacao(acido, ca, va, cb, vb)];
  });
}

type Cor = [number, number, number];
const mistura = (a: Cor, b: Cor, t: number): Cor => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * Math.min(1, Math.max(0, t)))) as Cor;
const faixa = (pontos: [number, Cor][], ph: number): Cor => {
  if (ph <= pontos[0][0]) return pontos[0][1];
  for (let i = 1; i < pontos.length; i++) if (ph <= pontos[i][0]) return mistura(pontos[i - 1][1], pontos[i][1], (ph - pontos[i - 1][0]) / (pontos[i][0] - pontos[i - 1][0]));
  return pontos[pontos.length - 1][1];
};

export interface Indicador {
  id: string;
  nome: string;
  viragem: string;
  cor: (ph: number) => Cor;
}

export const INDICADORES: Indicador[] = [
  { id: "fenolftaleina", nome: "Fenolftaleína", viragem: "incolor até 8,2; rosa a partir de 10", cor: (ph) => faixa([[8.2, [246, 241, 232]], [10, [226, 70, 160]]], ph) },
  { id: "bromotimol", nome: "Azul de bromotimol", viragem: "amarelo até 6,0; verde no meio; azul a partir de 7,6", cor: (ph) => faixa([[6, [232, 200, 40]], [6.8, [90, 170, 70]], [7.6, [40, 90, 200]]], ph) },
  { id: "metila", nome: "Alaranjado de metila", viragem: "vermelho até 3,1; amarelo a partir de 4,4", cor: (ph) => faixa([[3.1, [214, 48, 40]], [4.4, [240, 190, 50]]], ph) },
  {
    id: "repolho",
    nome: "Repolho roxo (feito em casa)",
    viragem: "vermelho no ácido forte, roxo no neutro, verde e amarelo no básico",
    cor: (ph) => faixa([[2, [200, 30, 60]], [4, [210, 80, 140]], [6, [130, 60, 150]], [7, [100, 70, 170]], [8, [60, 90, 200]], [10, [40, 150, 90]], [12, [200, 200, 40]]], ph),
  },
];

export const corCss = ([r, g, b]: Cor) => `rgb(${r} ${g} ${b})`;

/** Substâncias do dia a dia e o pH aproximado de cada uma (valores típicos de livros de química do ensino médio). */
export const DO_DIA_A_DIA: { nome: string; ph: number; nota: string }[] = [
  { nome: "Suco gástrico", ph: 1.5, nota: "o ácido do estômago, que ajuda a digerir" },
  { nome: "Suco de limão", ph: 2.2, nota: "ácido cítrico" },
  { nome: "Refrigerante de cola", ph: 2.5, nota: "ácido fosfórico e gás carbônico" },
  { nome: "Vinagre", ph: 2.9, nota: "ácido acético" },
  { nome: "Café", ph: 5, nota: "levemente ácido" },
  { nome: "Chuva limpa", ph: 5.6, nota: "o gás carbônico do ar deixa a chuva levemente ácida; chuva ácida fica abaixo disso" },
  { nome: "Leite", ph: 6.6, nota: "quase neutro" },
  { nome: "Água pura", ph: 7, nota: "neutra a 25 °C" },
  { nome: "Sangue", ph: 7.4, nota: "o corpo mantém entre 7,35 e 7,45" },
  { nome: "Água do mar", ph: 8.1, nota: "fica mais ácida com o gás carbônico das queimadas e da indústria" },
  { nome: "Bicarbonato de sódio", ph: 8.3, nota: "o do fermento e do antiácido" },
  { nome: "Sabão", ph: 10, nota: "básico: escorrega na mão" },
  { nome: "Limpador com amônia", ph: 11.5, nota: "não misture com água sanitária: solta gás tóxico" },
  { nome: "Água sanitária", ph: 12.5, nota: "hipoclorito de sódio" },
  { nome: "Soda cáustica", ph: 13.5, nota: "corrosiva: queima a pele, use luva e óculos" },
];
