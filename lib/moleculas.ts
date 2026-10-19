// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Moléculas em 3D sem servidor e sem biblioteca de fora: lê a fórmula em SMILES (o formato que o PubChem e a
// Wikipédia mostram), acrescenta os hidrogênios, escolhe a forma de cada átomo pela teoria VSEPR (pares ligantes e
// pares isolados) e acomoda as distâncias com um relaxamento simples. Não é química computacional: é o desenho certo
// para a sala de aula (ângulos de 104,5° na água, 109,5° no metano, anel plano no benzeno, octaedro no SF6).
// Também aceita coordenadas prontas (XYZ). Sem React e sem "@/", para o roteiro de conferência rodar no Node.

export interface Atomo {
  el: string;
  x: number;
  y: number;
  z: number;
  carga: number;
}
export interface Ligacao {
  a: number;
  b: number;
  /** 1, 2, 3 ou 1,5 (aromática). */
  ordem: number;
}
export interface Molecula {
  atomos: Atomo[];
  ligacoes: Ligacao[];
}

/** Raios covalentes (Å), de Cordero et al. (2008), arredondados. */
const RAIO: Record<string, number> = {
  H: 0.31, He: 0.28, Li: 1.28, Be: 0.96, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Ne: 0.58, Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11,
  P: 1.07, S: 1.05, Cl: 1.02, Ar: 1.06, K: 2.03, Ca: 1.76, Fe: 1.32, Cu: 1.32, Zn: 1.22, Se: 1.2, Br: 1.2, Kr: 1.16, I: 1.39, Xe: 1.4, As: 1.19,
};
export const raioCovalente = (el: string) => RAIO[el] ?? 1.2;

/** Elétrons de valência dos elementos dos grupos principais (para contar os pares isolados). */
const VALENCIA: Record<string, number> = { H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8, Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8, K: 1, Ca: 2, Se: 6, Br: 7, Kr: 8, I: 7, Xe: 8, As: 5 };
/** Valências usuais do "subconjunto orgânico" do SMILES: os hidrogênios completam a menor que couber. */
const VALENCIAS_SMILES: Record<string, number[]> = { B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7] };

/** Cores do modelo CPK, as dos kits de bolinhas das escolas. */
export const COR_DO_ELEMENTO: Record<string, string> = {
  H: "#f2f2f2", C: "#3a3a3a", N: "#3050f8", O: "#e02020", F: "#90e050", Cl: "#1ff01f", Br: "#a62929", I: "#940094", S: "#e6c200", P: "#ff8000",
  Na: "#ab5cf2", K: "#8f40d4", Mg: "#3fa040", Ca: "#3d8f3d", B: "#ffb5b5", Si: "#c8a070", Xe: "#429eb0", Fe: "#e06633", Cu: "#c88033", Zn: "#7d80b0", Be: "#4a8a00", Li: "#cc80ff", Al: "#bfa6a6",
};
export const NOME_DO_ELEMENTO: Record<string, string> = {
  H: "hidrogênio", C: "carbono", N: "nitrogênio", O: "oxigênio", F: "flúor", Cl: "cloro", Br: "bromo", I: "iodo", S: "enxofre", P: "fósforo", Na: "sódio", K: "potássio",
  Mg: "magnésio", Ca: "cálcio", B: "boro", Si: "silício", Xe: "xenônio", Fe: "ferro", Cu: "cobre", Zn: "zinco", Be: "berílio", Li: "lítio", Al: "alumínio", He: "hélio", Ne: "neônio", Ar: "argônio",
};

// ───────────── SMILES ─────────────

interface AtomoLido {
  el: string;
  aromatico: boolean;
  carga: number;
  /** Hidrogênios escritos entre colchetes ([NH4+]); null = completar pela valência. */
  hExplicito: number | null;
}

/** Lê SMILES sem estereoquímica: átomos, ramos, ligações simples, duplas, triplas e aromáticas, anéis e íons. */
export function lerSmiles(smiles: string): { atomos: AtomoLido[]; ligacoes: Ligacao[] } | null {
  const atomos: AtomoLido[] = [];
  const ligacoes: Ligacao[] = [];
  const pilha: number[] = [];
  const aneis = new Map<string, { atomo: number; ordem: number | null }>();
  let anterior = -1;
  let ordem: number | null = null;
  let i = 0;
  const s = smiles.trim();
  if (!s || s.length > 300) return null;
  const ligar = (a: number, b: number, o: number | null) => {
    const ordemFinal = o ?? (atomos[a].aromatico && atomos[b].aromatico ? 1.5 : 1);
    if (a !== b && !ligacoes.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) ligacoes.push({ a, b, ordem: ordemFinal });
  };
  const novo = (atomo: AtomoLido) => {
    atomos.push(atomo);
    const indice = atomos.length - 1;
    if (anterior >= 0) ligar(anterior, indice, ordem);
    anterior = indice;
    ordem = null;
  };
  while (i < s.length) {
    const c = s[i];
    if (c === "(") {
      if (anterior < 0) return null;
      pilha.push(anterior);
      i++;
    } else if (c === ")") {
      const volta = pilha.pop();
      if (volta === undefined) return null;
      anterior = volta;
      i++;
    } else if (c === "-" || c === "/" || c === "\\") {
      ordem = 1;
      i++;
    } else if (c === "=") {
      ordem = 2;
      i++;
    } else if (c === "#") {
      ordem = 3;
      i++;
    } else if (c === ":") {
      ordem = 1.5;
      i++;
    } else if (c === ".") {
      anterior = -1;
      ordem = null;
      i++;
    } else if (/[0-9%]/.test(c)) {
      let rotulo = c;
      if (c === "%") {
        rotulo = s.slice(i + 1, i + 3);
        if (!/^\d\d$/.test(rotulo)) return null;
        i += 3;
      } else i++;
      if (anterior < 0) return null;
      const aberto = aneis.get(rotulo);
      if (aberto) {
        ligar(aberto.atomo, anterior, ordem ?? aberto.ordem);
        aneis.delete(rotulo);
      } else aneis.set(rotulo, { atomo: anterior, ordem });
      ordem = null;
    } else if (c === "[") {
      const fim = s.indexOf("]", i);
      if (fim < 0) return null;
      const m = /^(\d+)?([A-Z][a-z]?|[cnops]|se|as)(@{0,2}(?:TH\d|AL\d|SP\d)?)?(H\d?)?((?:[+-]\d?)+)?(?::\d+)?$/.exec(s.slice(i + 1, fim));
      if (!m) return null;
      const simbolo = m[2];
      const aromatico = simbolo === simbolo.toLowerCase();
      let carga = 0;
      if (m[5]) {
        const sinais = m[5].match(/[+-]\d?/g) ?? [];
        for (const sinal of sinais) carga += (sinal[0] === "+" ? 1 : -1) * (sinal.length > 1 ? Number(sinal.slice(1)) : 1);
      }
      novo({ el: aromatico ? simbolo[0].toUpperCase() + simbolo.slice(1) : simbolo, aromatico, carga, hExplicito: m[4] ? (m[4].length > 1 ? Number(m[4].slice(1)) : 1) : 0 });
      i = fim + 1;
    } else {
      const dois = s.slice(i, i + 2);
      if (dois === "Cl" || dois === "Br") {
        novo({ el: dois, aromatico: false, carga: 0, hExplicito: null });
        i += 2;
      } else if (/[BCNOPSFI]/.test(c)) {
        novo({ el: c, aromatico: false, carga: 0, hExplicito: null });
        i++;
      } else if (/[bcnops]/.test(c)) {
        novo({ el: c.toUpperCase(), aromatico: true, carga: 0, hExplicito: null });
        i++;
      } else return null;
    }
    if (atomos.length > 160) return null;
  }
  if (pilha.length || aneis.size || !atomos.length) return null;
  return { atomos, ligacoes };
}

/** Junta os hidrogênios que faltam (pela valência) e devolve a molécula ainda sem coordenadas. */
export function completarHidrogenios(lido: { atomos: AtomoLido[]; ligacoes: Ligacao[] }): Molecula {
  const atomos: Atomo[] = lido.atomos.map((a) => ({ el: a.el, x: 0, y: 0, z: 0, carga: a.carga }));
  const ligacoes = [...lido.ligacoes];
  lido.atomos.forEach((a, i) => {
    const soma = ligacoes.filter((l) => l.a === i || l.b === i).reduce((t, l) => t + l.ordem, 0);
    let h = a.hExplicito ?? 0;
    if (a.hExplicito === null) {
      const valencias = VALENCIAS_SMILES[a.el] ?? [0];
      if (a.aromatico) {
        // Regra do SMILES para aromáticos: cada ligação conta 1 e o anel tira mais 1 (o carbono do benzeno fica com
        // um hidrogênio; o nitrogênio da piridina, com nenhum).
        const ligacoesDoAtomo = ligacoes.filter((l) => l.a === i || l.b === i).reduce((t, l) => t + (l.ordem === 1.5 ? 1 : l.ordem), 0);
        h = Math.max(0, valencias[0] - ligacoesDoAtomo - 1);
      } else {
        const usada = Math.round(soma);
        const alvo = valencias.find((v) => v >= usada) ?? usada;
        h = Math.max(0, alvo - usada);
      }
    }
    for (let k = 0; k < h && atomos.length < 400; k++) {
      atomos.push({ el: "H", x: 0, y: 0, z: 0, carga: 0 });
      ligacoes.push({ a: i, b: atomos.length - 1, ordem: 1 });
    }
  });
  return { atomos, ligacoes };
}

// ───────────── Geometria (VSEPR) ─────────────

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const soma = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vezes = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const ponto = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const tamanho = (a: V) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V): V => {
  const t = tamanho(a) || 1;
  return [a[0] / t, a[1] / t, a[2] / t];
};

/** Direções ideais de cada número estérico; os pares isolados ficam com as últimas (equatoriais na bipirâmide). */
const MOLDES: Record<number, V[]> = {
  1: [[1, 0, 0]],
  2: [[1, 0, 0], [-1, 0, 0]],
  3: [[1, 0, 0], [-0.5, Math.sqrt(3) / 2, 0], [-0.5, -Math.sqrt(3) / 2, 0]],
  4: [unit([1, 1, 1]), unit([1, -1, -1]), unit([-1, 1, -1]), unit([-1, -1, 1])],
  5: [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-0.5, Math.sqrt(3) / 2, 0], [-0.5, -Math.sqrt(3) / 2, 0]],
  6: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
};

/** Gira o vetor v em torno do eixo unitário k pelo ângulo t (fórmula de Rodrigues). */
const girar = (v: V, k: V, t: number): V => soma(soma(vezes(v, Math.cos(t)), vezes(cruz(k, v), Math.sin(t))), vezes(k, ponto(k, v) * (1 - Math.cos(t))));
/** Rotação que leva a direção a até b, aplicada a v. */
function alinhar(v: V, a: V, b: V): V {
  const eixo = cruz(a, b);
  const s = tamanho(eixo);
  const c = ponto(a, b);
  if (s < 1e-9) return c > 0 ? v : girar(v, Math.abs(a[0]) < 0.9 ? unit(cruz(a, [1, 0, 0])) : unit(cruz(a, [0, 1, 0])), Math.PI);
  return girar(v, vezes(eixo, 1 / s), Math.atan2(s, c));
}

export function comprimentoDaLigacao(a: string, b: string, ordem: number) {
  const base = raioCovalente(a) + raioCovalente(b);
  return base * (ordem === 3 ? 0.78 : ordem === 2 ? 0.87 : ordem === 1.5 ? 0.91 : 1);
}

/** Pares isolados pelo jeito da escola: (elétrons de valência − carga − elétrons usados nas ligações) ÷ 2. */
function paresIsolados(el: string, carga: number, somaDasOrdens: number) {
  const v = VALENCIA[el];
  if (v === undefined) return 0;
  return Math.max(0, Math.floor((v - carga - Math.round(somaDasOrdens)) / 2));
}

/** Monta as coordenadas: forma VSEPR em cada átomo, árvore a partir do primeiro, relaxamento para fechar anéis. */
export function montar3d(mol: Molecula, voltas = 600, teste: { plano?: boolean; repulsao?: boolean } = {}): Molecula {
  const n = mol.atomos.length;
  const vizinhos: number[][] = Array.from({ length: n }, () => []);
  const ordemEntre = new Map<string, number>();
  for (const l of mol.ligacoes) {
    vizinhos[l.a].push(l.b);
    vizinhos[l.b].push(l.a);
    ordemEntre.set(`${Math.min(l.a, l.b)}-${Math.max(l.a, l.b)}`, l.ordem);
  }
  const ordemDe = (a: number, b: number) => ordemEntre.get(`${Math.min(a, b)}-${Math.max(a, b)}`) ?? 1;
  const tam = (i: number, j: number) => comprimentoDaLigacao(mol.atomos[i].el, mol.atomos[j].el, ordemDe(i, j));
  const formaDe = (i: number) => {
    const somaOrdens = vizinhos[i].reduce((t, j) => t + ordemDe(i, j), 0);
    const pares = paresIsolados(mol.atomos[i].el, mol.atomos[i].carga, somaOrdens);
    const sn = Math.min(6, Math.max(vizinhos[i].length, vizinhos[i].length + pares, 1));
    return { sn, pares: sn - vizinhos[i].length };
  };
  const forma = Array.from({ length: n }, (_, i) => formaDe(i));

  // Anéis: o menor ciclo que passa por cada ligação (busca de a até b sem usar a própria ligação), até oito átomos.
  // Assim os dois anéis do naftaleno e da cafeína aparecem, e não o contorno grande em volta deles.
  const aneis: number[][] = [];
  const jaVisto = new Set<string>();
  for (const l of mol.ligacoes) {
    if (vizinhos[l.a].length < 2 || vizinhos[l.b].length < 2) continue;
    const de = new Map<number, number>([[l.a, -1]]);
    let fronteira = [l.a];
    for (let passo = 0; passo < 7 && !de.has(l.b); passo++) {
      const proxima: number[] = [];
      for (const i of fronteira) {
        for (const j of vizinhos[i]) {
          if (de.has(j) || (i === l.a && j === l.b)) continue;
          de.set(j, i);
          proxima.push(j);
        }
      }
      fronteira = proxima;
    }
    if (!de.has(l.b)) continue;
    const anel: number[] = [];
    for (let i = l.b; i !== -1; i = de.get(i)!) anel.push(i);
    const chave = [...anel].sort((x, y) => x - y).join(",");
    if (anel.length >= 3 && anel.length <= 8 && !jaVisto.has(chave)) {
      jaVisto.add(chave);
      aneis.push(anel);
    }
  }
  aneis.sort((x, y) => x.length - y.length);

  const pos: V[] = Array.from({ length: n }, () => [0, 0, 0]);
  const colocado = new Array<boolean>(n).fill(false);
  // Todo átomo que entra no lugar (sozinho ou com o anel inteiro) vai para a fila, para os vizinhos dele virem depois.
  const fila: number[] = [];
  const colocar = (i: number, p: V) => {
    pos[i] = p;
    colocado[i] = true;
    fila.push(i);
  };
  const centroDe = (ids: number[]) => vezes(ids.reduce((t, i) => soma(t, pos[i]), [0, 0, 0] as V), 1 / ids.length);
  const perpendicular = (d: V): V => unit(cruz(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const anelColocado = new Array<boolean>(aneis.length).fill(false);

  /** Anel inteiro de uma vez: polígono regular (plano), dobrado em cadeira se for de átomos tetraédricos. */
  const colocarAnel = (k: number, entrada: number, paraFora: V | null, plano: V | null) => {
    const anel = aneis[k];
    const inicio = anel.indexOf(entrada);
    const ordem = [...anel.slice(inicio), ...anel.slice(0, inicio)];
    const m = ordem.length;
    const lado = ordem.reduce((t, i, q) => t + tam(i, ordem[(q + 1) % m]), 0) / m;
    const raio = lado / (2 * Math.sin(Math.PI / m));
    const d = paraFora ?? ([1, 0, 0] as V);
    let w = plano ? unit(cruz(plano, d)) : perpendicular(d);
    if (!Number.isFinite(w[0]) || tamanho(w) < 0.5) w = perpendicular(d);
    const normal = unit(cruz(d, w));
    const centro = sub(pos[entrada], vezes(d, raio));
    const saturado = ordem.filter((i) => forma[i].sn === 4).length > m / 2;
    ordem.forEach((i, q) => {
      if (colocado[i]) return;
      const t = (2 * Math.PI * q) / m;
      let p = soma(centro, soma(vezes(d, raio * Math.cos(t)), vezes(w, raio * Math.sin(t))));
      if (saturado && m % 2 === 0) p = soma(p, vezes(normal, q % 2 ? 0.25 : -0.25));
      colocar(i, p);
    });
    anelColocado[k] = true;
  };
  /** Anel fundido: os átomos novos formam um polígono sobre a aresta já colocada, do lado de fora do anel vizinho. */
  const colocarFundido = (k: number) => {
    const anel = aneis[k];
    const m = anel.length;
    for (let q = 0; q < m; q++) {
      const a = anel[q];
      const b = anel[(q + 1) % m];
      if (!colocado[a] || !colocado[b]) continue;
      const vizinho = aneis.findIndex((outro, idx) => idx !== k && anelColocado[idx] && outro.includes(a) && outro.includes(b));
      if (vizinho < 0) continue;
      const lado = tam(a, b);
      const raio = lado / (2 * Math.sin(Math.PI / m));
      const meio = vezes(soma(pos[a], pos[b]), 0.5);
      const outro = aneis[vizinho];
      const normal = unit(cruz(sub(pos[outro[1]], pos[outro[0]]), sub(pos[outro[2]], pos[outro[0]])));
      const eixo = unit(sub(pos[b], pos[a]));
      let fora = unit(cruz(normal, eixo));
      if (ponto(fora, sub(centroDe(outro), meio)) > 0) fora = vezes(fora, -1);
      const apotema = Math.sqrt(Math.max(0, raio * raio - (lado / 2) * (lado / 2)));
      const centro = soma(meio, vezes(fora, apotema));
      // Percorre o anel a partir de b, girando no sentido que se afasta de a.
      const ini = sub(pos[b], centro);
      const passo = (2 * Math.PI) / m;
      const sentido = ponto(cruz(sub(pos[a], centro), ini), normal) > 0 ? 1 : -1;
      for (let s = 1; s < m - 1; s++) {
        const i = anel[(q + 1 + s) % m];
        if (!colocado[i]) colocar(i, soma(centro, girar(ini, normal, sentido * passo * s)));
      }
      anelColocado[k] = true;
      return true;
    }
    return false;
  };

  /** Molde girado para as direções dos vizinhos já colocados: a 1.ª direção exata, a 2.ª o mais perto possível. */
  const moldeAlinhado = (i: number, conhecidos: number[]) => {
    let dirs = MOLDES[forma[i].sn];
    if (!conhecidos.length) return dirs;
    const d0 = unit(sub(pos[conhecidos[0]], pos[i]));
    dirs = dirs.map((d) => alinhar(d, MOLDES[forma[i].sn][0], d0));
    if (conhecidos.length >= 2 && dirs.length >= 2) {
      const d1 = unit(sub(pos[conhecidos[1]], pos[i]));
      const s1 = sub(dirs[1], vezes(d0, ponto(dirs[1], d0)));
      const t1 = sub(d1, vezes(d0, ponto(d1, d0)));
      if (tamanho(s1) > 1e-6 && tamanho(t1) > 1e-6) {
        const phi = Math.atan2(ponto(cruz(s1, t1), d0), ponto(s1, t1));
        dirs = dirs.map((d) => girar(d, d0, phi));
      }
    }
    return dirs;
  };

  const molde: { dirs: V[]; ordem: number[] }[] = new Array(n);
  let deslocamento = 0;
  for (let raiz = 0; raiz < n; raiz++) {
    if (colocado[raiz]) continue;
    colocar(raiz, [deslocamento, 0, 0]);
    while (fila.length) {
      const i = fila.shift()!;
      // Chegou a um anel ainda não colocado: o anel vem inteiro, com o lado de fora virado para quem veio antes.
      for (let k = 0; k < aneis.length; k++) {
        if (anelColocado[k] || !aneis[k].includes(i)) continue;
        if (aneis[k].filter((x) => colocado[x]).length >= 2 && colocarFundido(k)) continue;
        if (aneis[k].some((x) => x !== i && colocado[x])) continue;
        const veio = vizinhos[i].find((j) => colocado[j] && !aneis[k].includes(j));
        const paraFora = veio !== undefined ? unit(sub(pos[veio], pos[i])) : null;
        const avo = veio !== undefined ? vizinhos[veio].find((j) => j !== i && colocado[j]) : undefined;
        const plano = veio !== undefined && avo !== undefined ? unit(cruz(sub(pos[avo], pos[veio]), paraFora!)) : null;
        colocarAnel(k, i, paraFora, plano);
        for (let repete = 0; repete < 3; repete++) for (let k2 = 0; k2 < aneis.length; k2++) if (!anelColocado[k2] && aneis[k2].filter((x) => colocado[x]).length >= 2) colocarFundido(k2);
      }
      const conhecidos = vizinhos[i].filter((j) => colocado[j]);
      const novos = vizinhos[i].filter((j) => !colocado[j]);
      let dirs = moldeAlinhado(i, conhecidos);
      if (conhecidos.length === 1 && novos.length && dirs.length > 2) {
        // Escolhe a torção que deixa os novos átomos mais longe de tudo o que já está no lugar.
        const eixo = unit(sub(pos[conhecidos[0]], pos[i]));
        let melhor = dirs;
        let melhorNota = -Infinity;
        for (let k = 0; k < 12; k++) {
          const tentativa = dirs.map((d) => girar(d, eixo, (k * Math.PI) / 6));
          let nota = Infinity;
          for (let s = 1; s <= novos.length && s < tentativa.length; s++) {
            const p = soma(pos[i], vezes(tentativa[s], 1.4));
            for (let j = 0; j < n; j++) if (colocado[j] && j !== i && j !== conhecidos[0]) nota = Math.min(nota, tamanho(sub(p, pos[j])));
          }
          if (nota > melhorNota + 1e-6) {
            melhorNota = nota;
            melhor = tentativa;
          }
        }
        dirs = melhor;
      }
      const ordem = [...conhecidos, ...novos];
      molde[i] = { dirs, ordem };
      novos.forEach((j, s) => {
        const slot = conhecidos.length + s;
        // Mais vizinhos do que direções (molécula estranha): o átomo vai para um lado qualquer e o relaxamento acomoda.
        const dir = dirs[slot] ?? unit([Math.cos(slot), Math.sin(slot), 0.3]);
        colocar(j, soma(pos[i], vezes(dir, tam(i, j))));
      });
    }
    deslocamento = Math.max(...pos.filter((_, i) => colocado[i]).map((p) => p[0])) + 3;
  }

  // Restrições de distância: ligações (1-2) e ângulos (1-3, pela lei dos cossenos com o ângulo do molde).
  const restricoes: { a: number; b: number; d: number; k: number }[] = [];
  const vistos = new Set<string>();
  for (const l of mol.ligacoes) {
    restricoes.push({ a: l.a, b: l.b, d: comprimentoDaLigacao(mol.atomos[l.a].el, mol.atomos[l.b].el, l.ordem), k: 1 });
    vistos.add(`${Math.min(l.a, l.b)}-${Math.max(l.a, l.b)}`);
  }
  for (let i = 0; i < n; i++) {
    const m = molde[i];
    if (!m || m.ordem.length < 2) continue;
    const sn = forma[i].sn;
    const pares = forma[i].pares;
    for (let p = 0; p < m.ordem.length; p++) {
      for (let q = p + 1; q < m.ordem.length; q++) {
        if (p >= sn || q >= sn) continue;
        const [a, b] = [m.ordem[p], m.ordem[q]];
        const chave = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        let angulo = Math.acos(Math.max(-1, Math.min(1, ponto(MOLDES[sn][p], MOLDES[sn][q]))));
        // Pares isolados apertam os ângulos: 107° na amônia, 104,5° na água, cerca de 117° no SO2.
        if (pares > 0 && sn === 4) angulo -= (2.5 * pares * Math.PI) / 180;
        if (pares > 0 && sn === 3) angulo -= (2 * Math.PI) / 180;
        // Dentro de anéis pequenos o ângulo é o do polígono (60° no de três, 108° no de cinco).
        const anelComum = aneis.find((anel) => anel.includes(i) && anel.includes(a) && anel.includes(b));
        if (anelComum && anelComum.length <= 5) angulo = Math.PI - (2 * Math.PI) / anelComum.length;
        const la = tam(i, a);
        const lb = tam(i, b);
        restricoes.push({ a, b, d: Math.sqrt(la * la + lb * lb - 2 * la * lb * Math.cos(angulo)), k: 0.6 });
      }
    }
  }
  const ligadosOuVizinhos = vistos;

  // Ligação entre dois átomos trigonais planos (dupla, aromática): tudo em volta fica no mesmo plano.
  const planos: number[][] = [];
  for (const l of mol.ligacoes) {
    const trigonal = (i: number) => forma[i].sn === 3 && vizinhos[i].length >= 2;
    if (trigonal(l.a) && trigonal(l.b) && l.ordem >= 1.5) planos.push([l.a, l.b, ...vizinhos[l.a].filter((x) => x !== l.b), ...vizinhos[l.b].filter((x) => x !== l.a)]);
  }
  const achatar = () => {
    for (const g of planos) {
      const meio = vezes(soma(pos[g[0]], pos[g[1]]), 0.5);
      // Normal do plano que passa pelos átomos do grupo: soma dos produtos vetoriais em leque, a partir do meio.
      let normal: V = [0, 0, 0];
      for (let s = 0; s < g.length; s++) {
        const c = cruz(sub(pos[g[s]], meio), sub(pos[g[(s + 1) % g.length]], meio));
        normal = soma(normal, ponto(c, normal) < 0 ? vezes(c, -1) : c);
      }
      if (tamanho(normal) < 1e-9) continue;
      normal = unit(normal);
      for (const k of g) pos[k] = sub(pos[k], vezes(normal, ponto(sub(pos[k], meio), normal) * 0.3));
    }
  };

  for (let volta = 0; volta < voltas; volta++) {
    // O plano vem antes das distâncias e sai de cena no último quinto: no fim, quem manda são as ligações e os ângulos.
    if (planos.length && teste.plano !== false && volta < voltas * 0.8) achatar();
    for (const r of restricoes) {
      const d = sub(pos[r.b], pos[r.a]);
      const atual = tamanho(d) || 1e-6;
      const corr = vezes(d, ((atual - r.d) / atual) * 0.5 * r.k);
      pos[r.a] = soma(pos[r.a], corr);
      pos[r.b] = sub(pos[r.b], corr);
    }
    // Átomos que não se ligam nem dividem um vizinho não podem se encostar.
    if (volta % 2 === 0 && teste.repulsao !== false) {
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          if (ligadosOuVizinhos.has(`${a}-${b}`)) continue;
          const minimo = mol.atomos[a].el === "H" || mol.atomos[b].el === "H" ? 2.0 : 2.5;
          const d = sub(pos[b], pos[a]);
          const atual = tamanho(d) || 1e-6;
          if (atual >= minimo) continue;
          const corr = vezes(d, ((atual - minimo) / atual) * 0.25);
          pos[a] = soma(pos[a], corr);
          pos[b] = sub(pos[b], corr);
        }
      }
    }
  }
  const centro = vezes(pos.reduce((t, p) => soma(t, p), [0, 0, 0] as V), 1 / Math.max(1, n));
  return { atomos: mol.atomos.map((a, i) => ({ ...a, x: pos[i][0] - centro[0], y: pos[i][1] - centro[1], z: pos[i][2] - centro[2] })), ligacoes: mol.ligacoes };
}

/** Coordenadas prontas (XYZ): as ligações saem das distâncias. */
export function deXyz(lista: { el: string; x: number; y: number; z: number }[]): Molecula {
  const atomos = lista.map((a) => ({ ...a, carga: 0 }));
  const ligacoes: Ligacao[] = [];
  for (let a = 0; a < atomos.length; a++) {
    for (let b = a + 1; b < atomos.length; b++) {
      const d = Math.hypot(atomos[a].x - atomos[b].x, atomos[a].y - atomos[b].y, atomos[a].z - atomos[b].z);
      if (d > 0.4 && d < 1.2 * (raioCovalente(atomos[a].el) + raioCovalente(atomos[b].el))) ligacoes.push({ a, b, ordem: 1 });
    }
  }
  const c = atomos.reduce((t, p) => [t[0] + p.x, t[1] + p.y, t[2] + p.z], [0, 0, 0]).map((v) => v / Math.max(1, atomos.length));
  return { atomos: atomos.map((p) => ({ ...p, x: p.x - c[0], y: p.y - c[1], z: p.z - c[2] })), ligacoes };
}

/** Fórmula na notação de Hill (C, depois H, depois o resto em ordem alfabética), com a carga total. */
export function formula(mol: Molecula) {
  const conta: Record<string, number> = {};
  for (const a of mol.atomos) conta[a.el] = (conta[a.el] ?? 0) + 1;
  const ordem = conta.C ? ["C", "H", ...Object.keys(conta).filter((e) => e !== "C" && e !== "H").sort()] : Object.keys(conta).sort();
  const sub = (n: number) => (n === 1 ? "" : String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]));
  const carga = mol.atomos.reduce((t, a) => t + a.carga, 0);
  const sinal = carga === 0 ? "" : `${Math.abs(carga) > 1 ? String(Math.abs(carga)).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]) : ""}${carga > 0 ? "⁺" : "⁻"}`;
  return ordem.filter((e) => conta[e]).map((e) => e + sub(conta[e])).join("") + sinal;
}

// ───────────── Biblioteca ─────────────

/** Moléculas com nome: SMILES e o que a aula costuma querer mostrar. */
export const BIBLIOTECA: { nomes: string[]; smiles: string; nota: string }[] = [
  { nomes: ["água", "agua", "h2o"], smiles: "O", nota: "Geometria angular: dois pares isolados no oxigênio fecham o ângulo para cerca de 104,5°." },
  { nomes: ["dióxido de carbono", "gás carbônico", "co2"], smiles: "O=C=O", nota: "Geometria linear: 180° entre as duas ligações duplas." },
  { nomes: ["metano", "ch4"], smiles: "C", nota: "Geometria tetraédrica: 109,5° entre as ligações." },
  { nomes: ["amônia", "amoníaco", "nh3"], smiles: "N", nota: "Geometria piramidal: um par isolado no nitrogênio, ângulos de cerca de 107°." },
  { nomes: ["amônio", "nh4+"], smiles: "[NH4+]", nota: "Íon tetraédrico: o par isolado da amônia virou a quarta ligação." },
  { nomes: ["oxigênio", "gás oxigênio", "o2"], smiles: "O=O", nota: "Molécula diatômica com ligação dupla." },
  { nomes: ["nitrogênio", "gás nitrogênio", "n2"], smiles: "N#N", nota: "Ligação tripla, uma das mais fortes da química." },
  { nomes: ["hidrogênio", "gás hidrogênio", "h2"], smiles: "[H][H]", nota: "A molécula mais simples: dois átomos e uma ligação simples." },
  { nomes: ["cloro", "gás cloro", "cl2"], smiles: "ClCl", nota: "Molécula diatômica com ligação simples." },
  { nomes: ["ácido clorídrico", "cloreto de hidrogênio", "hcl"], smiles: "Cl", nota: "Ligação polar: o cloro puxa os elétrons." },
  { nomes: ["ozônio", "o3"], smiles: "[O-][O+]=O", nota: "Geometria angular, cerca de 117°." },
  { nomes: ["dióxido de enxofre", "so2"], smiles: "O=S=O", nota: "Geometria angular: um par isolado no enxofre." },
  { nomes: ["trióxido de enxofre", "so3"], smiles: "O=S(=O)=O", nota: "Geometria trigonal plana: 120°." },
  { nomes: ["trifluoreto de boro", "bf3"], smiles: "FB(F)F", nota: "Geometria trigonal plana: o boro fica com só seis elétrons." },
  { nomes: ["tetracloreto de carbono", "ccl4"], smiles: "ClC(Cl)(Cl)Cl", nota: "Geometria tetraédrica e molécula apolar." },
  { nomes: ["pentacloreto de fósforo", "pcl5"], smiles: "ClP(Cl)(Cl)(Cl)Cl", nota: "Bipirâmide trigonal: 90° e 120°." },
  { nomes: ["tetrafluoreto de enxofre", "sf4"], smiles: "FS(F)(F)F", nota: "Gangorra: um par isolado numa posição equatorial." },
  { nomes: ["trifluoreto de cloro", "clf3"], smiles: "FCl(F)F", nota: "Forma de T: dois pares isolados equatoriais." },
  { nomes: ["hexafluoreto de enxofre", "sf6"], smiles: "FS(F)(F)(F)(F)F", nota: "Octaédrica: 90° entre as ligações vizinhas." },
  { nomes: ["tetrafluoreto de xenônio", "xef4"], smiles: "F[Xe](F)(F)F", nota: "Quadrado plano: dois pares isolados, um em cima e outro embaixo." },
  { nomes: ["ácido cianídrico", "cianeto de hidrogênio", "hcn"], smiles: "C#N", nota: "Linear, com ligação tripla entre carbono e nitrogênio." },
  { nomes: ["etano"], smiles: "CC", nota: "Dois carbonos tetraédricos; a ligação simples gira." },
  { nomes: ["eteno", "etileno"], smiles: "C=C", nota: "Ligação dupla: a molécula é plana e não gira." },
  { nomes: ["etino", "acetileno"], smiles: "C#C", nota: "Ligação tripla: molécula linear." },
  { nomes: ["propano"], smiles: "CCC", nota: "Cadeia de três carbonos em zigue-zague." },
  { nomes: ["butano"], smiles: "CCCC", nota: "O gás de cozinha: quatro carbonos." },
  { nomes: ["metanol"], smiles: "CO", nota: "O álcool mais simples." },
  { nomes: ["etanol", "álcool etílico"], smiles: "CCO", nota: "O álcool do combustível e das bebidas: grupo OH (hidroxila)." },
  { nomes: ["ácido acético", "ácido etanoico"], smiles: "CC(=O)O", nota: "O ácido do vinagre: grupo carboxila (COOH)." },
  { nomes: ["acetona", "propanona"], smiles: "CC(=O)C", nota: "Cetona: carbonila (C=O) entre dois carbonos." },
  { nomes: ["formaldeído", "metanal"], smiles: "C=O", nota: "Aldeído mais simples: trigonal plano." },
  { nomes: ["benzeno"], smiles: "c1ccccc1", nota: "Anel aromático plano: seis carbonos com ligações iguais." },
  { nomes: ["tolueno"], smiles: "Cc1ccccc1", nota: "Benzeno com um grupo metila." },
  { nomes: ["fenol"], smiles: "Oc1ccccc1", nota: "Benzeno com uma hidroxila." },
  { nomes: ["glicose"], smiles: "OCC1OC(O)C(O)C(O)C1O", nota: "Açúcar em anel de seis átomos (forma cíclica)." },
  { nomes: ["ureia"], smiles: "NC(N)=O", nota: "Primeira substância orgânica feita em laboratório (Wöhler, 1828)." },
  { nomes: ["glicina"], smiles: "NCC(=O)O", nota: "O aminoácido mais simples: grupo amina e grupo carboxila." },
  { nomes: ["ácido sulfúrico", "h2so4"], smiles: "OS(=O)(=O)O", nota: "Enxofre tetraédrico no centro." },
  { nomes: ["ácido nítrico", "hno3"], smiles: "O[N+](=O)[O-]", nota: "Nitrogênio trigonal plano." },
  { nomes: ["cafeína"], smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C", nota: "Dois anéis fundidos com nitrogênios." },
  { nomes: ["ácido acetilsalicílico", "aspirina", "aas"], smiles: "CC(=O)Oc1ccccc1C(=O)O", nota: "Anel aromático com um éster e um ácido carboxílico." },
  { nomes: ["cloreto de sódio", "sal de cozinha", "nacl"], smiles: "cristal:NaCl", nota: "Retículo cristalino: cada sódio cercado por seis cloretos (ligação iônica)." },
];

const comparavel = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export function daBiblioteca(nome: string) {
  const alvo = comparavel(nome);
  return BIBLIOTECA.find((m) => m.nomes.some((n) => comparavel(n) === alvo)) ?? null;
}

/** Pedaço do retículo do sal de cozinha: 3 × 3 × 3, sódio e cloro alternados a 2,82 Å. */
function cristalDeSal(): Molecula {
  const lista: { el: string; x: number; y: number; z: number }[] = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) lista.push({ el: (x + y + z) % 2 === 0 ? "Na" : "Cl", x: x * 2.82, y: y * 2.82, z: z * 2.82 });
  const mol = deXyz(lista);
  mol.atomos = mol.atomos.map((a) => ({ ...a, carga: a.el === "Na" ? 1 : -1 }));
  return mol;
}

/** Nome da biblioteca, SMILES ou XYZ → molécula pronta para desenhar. */
export function moleculaDe(entrada: string, xyz: { el: string; x: number; y: number; z: number }[] = []): { mol: Molecula; nota: string; nome: string } | null {
  if (xyz.length) return { mol: deXyz(xyz), nota: "", nome: entrada };
  const daLista = daBiblioteca(entrada);
  const smiles = daLista?.smiles ?? entrada.trim();
  if (smiles === "cristal:NaCl") return { mol: cristalDeSal(), nota: daLista?.nota ?? "", nome: daLista?.nomes[0] ?? entrada };
  const lido = lerSmiles(smiles);
  if (!lido) return null;
  return { mol: montar3d(completarHidrogenios(lido)), nota: daLista?.nota ?? "", nome: daLista?.nomes[0] ?? "" };
}
