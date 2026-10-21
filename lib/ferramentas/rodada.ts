// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas das ferramentas novas de prática: ordenação e busca passo a passo, grafos, sudoku, referências ABNT, céu
// (fase da Lua e Sol), direitos do trabalhador, mapas de Karnaugh, eletrônica, sólidos e contas do dia a dia. Tudo
// calculado no aparelho, sem serviço de fora. Testado em scripts/testar-rodada.mjs.

/** Sorteio com semente (o mesmo de outros laboratórios): a mesma semente dá o mesmo resultado. */
export function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────── Ordenação e busca ─────────────

export interface Passo {
  v: number[];
  /** Os índices sendo comparados (ou olhados) neste passo. */
  olhando: number[];
  /** Houve troca ou escrita neste passo. */
  trocou: boolean;
  /** Os índices que já estão no lugar certo. */
  prontos: number[];
  nota: string;
}
export type Algoritmo = "bolha" | "selecao" | "insercao" | "quick";

export function ordenar(algoritmo: Algoritmo, entrada: number[]): Passo[] {
  const v = [...entrada];
  const n = v.length;
  const passos: Passo[] = [];
  const prontos = new Set<number>();
  const p = (olhando: number[], trocou: boolean, nota: string) => passos.push({ v: [...v], olhando, trocou, prontos: [...prontos].sort((a, b) => a - b), nota });
  const troca = (i: number, j: number) => { [v[i], v[j]] = [v[j], v[i]]; };
  if (algoritmo === "bolha") {
    for (let fim = n - 1; fim > 0; fim--) {
      let trocouAlgo = false;
      for (let i = 0; i < fim; i++) {
        if (v[i] > v[i + 1]) { troca(i, i + 1); trocouAlgo = true; p([i, i + 1], true, `${v[i + 1]} > ${v[i]}: troca`); }
        else p([i, i + 1], false, `${v[i]} ≤ ${v[i + 1]}: fica`);
      }
      prontos.add(fim);
      if (!trocouAlgo) { for (let k = 0; k < fim; k++) prontos.add(k); break; }
    }
    prontos.add(0);
  } else if (algoritmo === "selecao") {
    for (let i = 0; i < n - 1; i++) {
      let menor = i;
      for (let j = i + 1; j < n; j++) {
        p([menor, j], false, `o menor até agora é ${v[menor]}; olha ${v[j]}`);
        if (v[j] < v[menor]) menor = j;
      }
      if (menor !== i) { troca(i, menor); p([i, menor], true, `leva o menor (${v[i]}) para a posição ${i + 1}`); }
      prontos.add(i);
    }
    prontos.add(n - 1);
  } else if (algoritmo === "insercao") {
    prontos.add(0);
    for (let i = 1; i < n; i++) {
      let j = i;
      p([j], false, `pega ${v[j]} e procura o lugar dele à esquerda`);
      while (j > 0 && v[j - 1] > v[j]) { troca(j - 1, j); p([j - 1, j], true, `${v[j]} > ${v[j - 1]}: anda uma casa para a esquerda`); j--; }
      for (let k = 0; k <= i; k++) prontos.add(k);
    }
  } else {
    const quick = (lo: number, hi: number) => {
      if (lo > hi) return;
      if (lo === hi) { prontos.add(lo); return; }
      const pivo = v[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) {
        p([j, hi], false, `pivô ${pivo}: ${v[j]} ${v[j] < pivo ? "<" : "≥"} ${pivo}`);
        if (v[j] < pivo) { if (i !== j) { troca(i, j); p([i, j], true, `${v[i]} vai para o lado dos menores`); } i++; }
      }
      troca(i, hi);
      prontos.add(i);
      p([i], true, `o pivô ${pivo} chega ao lugar final`);
      quick(lo, i - 1);
      quick(i + 1, hi);
    };
    quick(0, n - 1);
  }
  for (let k = 0; k < n; k++) prontos.add(k);
  p([], false, "ordenado");
  return passos;
}

/** Busca linear e binária, passo a passo. Na binária, o vetor precisa estar ordenado. */
export function buscar(tipo: "linear" | "binaria", v: number[], alvo: number): { olhando: number; faixa: [number, number]; achou: boolean; nota: string }[] {
  const passos: { olhando: number; faixa: [number, number]; achou: boolean; nota: string }[] = [];
  if (tipo === "linear") {
    for (let i = 0; i < v.length; i++) {
      const achou = v[i] === alvo;
      passos.push({ olhando: i, faixa: [i, v.length - 1], achou, nota: achou ? `achou ${alvo} na posição ${i + 1}` : `${v[i]} não é ${alvo}` });
      if (achou) return passos;
    }
  } else {
    let lo = 0;
    let hi = v.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      const achou = v[m] === alvo;
      passos.push({ olhando: m, faixa: [lo, hi], achou, nota: achou ? `achou ${alvo} na posição ${m + 1}` : v[m] < alvo ? `${v[m]} < ${alvo}: descarta a metade da esquerda` : `${v[m]} > ${alvo}: descarta a metade da direita` });
      if (achou) return passos;
      if (v[m] < alvo) lo = m + 1;
      else hi = m - 1;
    }
  }
  passos.push({ olhando: -1, faixa: [0, -1], achou: false, nota: `${alvo} não está na lista` });
  return passos;
}

// ───────────── Grafos ─────────────

export interface Grafo {
  nos: string[];
  arestas: [string, string, number][];
}
const vizinhos = (g: Grafo, no: string) => g.arestas.flatMap(([a, b, w]) => (a === no ? [[b, w] as const] : b === no ? [[a, w] as const] : [])).sort((x, y) => x[0].localeCompare(y[0]));

export function largura(g: Grafo, inicio: string) {
  const ordem: string[] = [];
  const fila = [inicio];
  const visto = new Set([inicio]);
  while (fila.length) {
    const no = fila.shift()!;
    ordem.push(no);
    for (const [v] of vizinhos(g, no)) if (!visto.has(v)) { visto.add(v); fila.push(v); }
  }
  return ordem;
}
export function profundidade(g: Grafo, inicio: string) {
  const ordem: string[] = [];
  const visto = new Set<string>();
  const andar = (no: string) => {
    visto.add(no);
    ordem.push(no);
    for (const [v] of vizinhos(g, no)) if (!visto.has(v)) andar(v);
  };
  andar(inicio);
  return ordem;
}
/** Dijkstra: a menor distância de "inicio" até cada nó e o caminho até "fim". */
export function menorCaminho(g: Grafo, inicio: string, fim: string) {
  const dist = new Map(g.nos.map((n) => [n, Infinity]));
  const antes = new Map<string, string>();
  const aberto = new Set(g.nos);
  dist.set(inicio, 0);
  while (aberto.size) {
    const u = [...aberto].sort((a, b) => dist.get(a)! - dist.get(b)! || a.localeCompare(b))[0];
    aberto.delete(u);
    if (dist.get(u) === Infinity) break;
    for (const [v, w] of vizinhos(g, u)) {
      const alt = dist.get(u)! + w;
      if (alt < dist.get(v)!) { dist.set(v, alt); antes.set(v, u); }
    }
  }
  const caminho: string[] = [];
  if (dist.get(fim) !== Infinity) for (let n: string | undefined = fim; n; n = antes.get(n)) caminho.unshift(n);
  return { distancia: dist.get(fim)!, caminho, dist: Object.fromEntries(dist) };
}

// ───────────── Sudoku ─────────────

export type Grade = number[]; // 81 casas, 0 = vazia

function pode(g: Grade, i: number, d: number) {
  const l = Math.floor(i / 9), c = i % 9, bl = l - (l % 3), bc = c - (c % 3);
  for (let k = 0; k < 9; k++) {
    if (g[l * 9 + k] === d || g[k * 9 + c] === d) return false;
    if (g[(bl + Math.floor(k / 3)) * 9 + bc + (k % 3)] === d) return false;
  }
  return true;
}
export function candidatos(g: Grade, i: number) {
  return g[i] ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => pode(g, i, d));
}
/** Conta as soluções (até "limite"), escolhendo sempre a casa com menos candidatos. */
export function contarSolucoes(g: Grade, limite = 2): number {
  let melhor = -1, menos = 10;
  for (let i = 0; i < 81; i++) if (!g[i]) { const n = candidatos(g, i).length; if (n < menos) { menos = n; melhor = i; if (n <= 1) break; } }
  if (melhor < 0) return 1;
  let total = 0;
  for (const d of candidatos(g, melhor)) {
    g[melhor] = d;
    total += contarSolucoes(g, limite - total);
    g[melhor] = 0;
    if (total >= limite) break;
  }
  return total;
}
function resolverAleatorio(g: Grade, r: () => number): boolean {
  const i = g.indexOf(0);
  if (i < 0) return true;
  const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => r() - 0.5);
  for (const d of ds) if (pode(g, i, d)) { g[i] = d; if (resolverAleatorio(g, r)) return true; g[i] = 0; }
  return false;
}
export const NIVEIS = { facil: 40, medio: 32, dificil: 26 } as const;
/** Um sudoku com solução única: começa da grade cheia e tira números enquanto a solução continuar única. */
export function gerarSudoku(semente: number, nivel: keyof typeof NIVEIS) {
  const r = sorteio(semente);
  const solucao: Grade = Array(81).fill(0);
  resolverAleatorio(solucao, r);
  const jogo = [...solucao];
  const ordem = Array.from({ length: 81 }, (_, i) => i).sort(() => r() - 0.5);
  let pistas = 81;
  for (const i of ordem) {
    if (pistas <= NIVEIS[nivel]) break;
    const guardado = jogo[i];
    jogo[i] = 0;
    if (contarSolucoes([...jogo]) !== 1) jogo[i] = guardado;
    else pistas--;
  }
  return { jogo, solucao };
}
/** Uma dica: primeiro uma casa com um só candidato possível; se não houver, a casa vazia com menos candidatos. */
export function dicaSudoku(g: Grade, solucao: Grade) {
  let melhor = -1, menos = 10;
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const n = candidatos(g, i).length;
    if (n === 1) return { casa: i, valor: solucao[i], motivo: "só cabe um número nesta casa" };
    if (n < menos) { menos = n; melhor = i; }
  }
  return melhor < 0 ? null : { casa: melhor, valor: solucao[melhor], motivo: `esta casa tem ${menos} possibilidades; o certo é este` };
}

// ───────────── Referências ABNT (NBR 6023:2018) ─────────────

const MESES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
export function dataAbnt(d: Date) {
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
/** "Maria da Silva Souza" → "SOUZA, Maria da Silva". Partícula final como Júnior/Filho/Neto vai junto do sobrenome. */
export function autorAbnt(nome: string) {
  const partes = nome.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].toLocaleUpperCase("pt-BR");
  const sufixo = /^(júnior|junior|jr\.?|filho|neto|sobrinho)$/i;
  let n = 1;
  if (sufixo.test(partes[partes.length - 1]) && partes.length > 2) n = 2;
  const sobrenome = partes.slice(-n).join(" ").toLocaleUpperCase("pt-BR");
  return `${sobrenome}, ${partes.slice(0, -n).join(" ")}`;
}
export function autoresAbnt(lista: string[]) {
  const nomes = lista.map((x) => x.trim()).filter(Boolean);
  if (nomes.length === 0) return "";
  if (nomes.length > 3) return `${autorAbnt(nomes[0])} et al.`;
  return nomes.map(autorAbnt).join("; ");
}
export type TipoDeReferencia = "livro" | "artigo" | "site" | "trabalho";
export interface CamposDaReferencia {
  autores: string[];
  titulo: string;
  subtitulo?: string;
  edicao?: string;
  local?: string;
  editora?: string;
  ano?: string;
  revista?: string;
  volume?: string;
  numero?: string;
  paginas?: string;
  url?: string;
  acesso?: Date;
  tipoTrabalho?: string;
  curso?: string;
  instituicao?: string;
  anoDefesa?: string;
}
/** Partes da referência: "negrito" marca o que vai em destaque (o título ou o nome da revista). */
export function referencia(tipo: TipoDeReferencia, c: CamposDaReferencia): { t: string; negrito?: boolean }[] {
  const autores = autoresAbnt(c.autores);
  const titulo = c.titulo.trim();
  const sub = c.subtitulo?.trim() ? `: ${c.subtitulo.trim()}` : "";
  const fim = (x: string) => (/[.?!]$/.test(x) ? x : `${x}.`);
  const online = c.url?.trim() ? [{ t: ` Disponível em: ${c.url.trim()}. Acesso em: ${dataAbnt(c.acesso ?? new Date())}.` }] : [];
  const edicao = c.edicao && c.edicao.trim() && c.edicao.trim() !== "1" ? ` ${c.edicao.trim()}. ed.` : "";
  const sl = c.local?.trim() || "[S. l.]";
  const sn = c.editora?.trim() || "[s. n.]";
  const ano = c.ano?.trim() || "[s. d.]";
  const ab = autores ? `${fim(autores)} ` : "";
  if (tipo === "livro") return [{ t: ab }, { t: titulo, negrito: true }, { t: `${sub}.${edicao} ${sl}: ${sn}, ${ano}.` }, ...online];
  if (tipo === "artigo") {
    const partes = [c.local?.trim(), c.volume?.trim() && `v. ${c.volume.trim()}`, c.numero?.trim() && `n. ${c.numero.trim()}`, c.paginas?.trim() && `p. ${c.paginas.trim()}`, ano].filter(Boolean).join(", ");
    return [{ t: `${ab}${titulo}${sub}. ` }, { t: c.revista?.trim() || "[nome da revista]", negrito: true }, { t: `, ${partes}.` }, ...online];
  }
  if (tipo === "site") return [{ t: ab }, { t: titulo, negrito: true }, { t: `${sub}. ${c.local?.trim() ? `${c.local.trim()}, ` : ""}${ano}.` }, ...online];
  const grau = [c.tipoTrabalho?.trim() || "Trabalho de Conclusão de Curso", c.curso?.trim() ? ` (${c.curso.trim()})` : ""].join("");
  return [{ t: ab }, { t: titulo, negrito: true }, { t: `${sub}. ${ano}. ${grau} – ${c.instituicao?.trim() || "[instituição]"}, ${sl}, ${c.anoDefesa?.trim() || ano}.` }, ...online];
}

// ───────────── Céu: fase da Lua e Sol ─────────────

const MES_SINODICO = 29.530588853;
const LUA_NOVA_REFERENCIA = Date.UTC(2000, 0, 6, 18, 14); // lua nova de 6 de janeiro de 2000, 18h14 UTC
export function faseDaLua(data: Date) {
  const dias = (data.getTime() - LUA_NOVA_REFERENCIA) / 86_400_000;
  const idade = ((dias % MES_SINODICO) + MES_SINODICO) % MES_SINODICO;
  const iluminada = (1 - Math.cos((2 * Math.PI * idade) / MES_SINODICO)) / 2;
  const nomes = ["Lua nova", "Lua crescente", "Quarto crescente", "Crescente gibosa", "Lua cheia", "Minguante gibosa", "Quarto minguante", "Lua minguante"];
  const nome = nomes[Math.floor(((idade / MES_SINODICO) * 8 + 0.5) % 8)];
  return { idade, iluminada, nome, crescendo: idade < MES_SINODICO / 2 };
}

const rad = (g: number) => (g * Math.PI) / 180;
const graus = (r: number) => (r * 180) / Math.PI;
/** Nascer, pôr e meio-dia solar (algoritmo da NOAA, precisão de cerca de um minuto), em horas do fuso dado. */
export function sol(data: Date, latitude: number, longitude: number, fusoHoras: number) {
  const ano = data.getUTCFullYear();
  const inicio = Date.UTC(ano, 0, 1);
  const diaDoAno = Math.floor((Date.UTC(ano, data.getUTCMonth(), data.getUTCDate()) - inicio) / 86_400_000) + 1;
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const gama = ((2 * Math.PI) / (bissexto ? 366 : 365)) * (diaDoAno - 1);
  const eqTempo = 229.18 * (0.000075 + 0.001868 * Math.cos(gama) - 0.032077 * Math.sin(gama) - 0.014615 * Math.cos(2 * gama) - 0.040849 * Math.sin(2 * gama));
  const decl = 0.006918 - 0.399912 * Math.cos(gama) + 0.070257 * Math.sin(gama) - 0.006758 * Math.cos(2 * gama) + 0.000907 * Math.sin(2 * gama) - 0.002697 * Math.cos(3 * gama) + 0.00148 * Math.sin(3 * gama);
  const lat = rad(latitude);
  const cosH = Math.cos(rad(90.833)) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  const meioDia = (720 - 4 * longitude - eqTempo) / 60 + fusoHoras;
  const alturaMax = 90 - Math.abs(latitude - graus(decl));
  if (cosH > 1) return { nascer: null, por: null, meioDia, duracao: 0, declinacao: graus(decl), alturaMax };
  if (cosH < -1) return { nascer: null, por: null, meioDia, duracao: 24, declinacao: graus(decl), alturaMax };
  const h = graus(Math.acos(cosH));
  return { nascer: meioDia - (4 * h) / 60, por: meioDia + (4 * h) / 60, meioDia, duracao: (8 * h) / 60, declinacao: graus(decl), alturaMax };
}
export const hhmm = (h: number | null) => {
  if (h === null) return "—";
  const m = Math.round((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// ───────────── Direitos do trabalhador (valores brutos, sem INSS nem IR) ─────────────

const centavos = (x: number) => Math.round(x * 100) / 100;
/** Férias: o salário do mês de descanso mais um terço (CF, art. 7º, XVII). Proporcionais: 1/12 por mês (CLT, art. 146). */
export function ferias(salario: number, meses = 12) {
  const base = (salario / 12) * Math.min(12, Math.max(0, meses));
  return { base: centavos(base), terco: centavos(base / 3), total: centavos(base + base / 3) };
}
/** 13º salário: 1/12 da remuneração por mês trabalhado no ano; 15 dias ou mais contam como mês (Lei 4.090/1962). */
export function decimoTerceiro(salario: number, meses: number) {
  return centavos((salario / 12) * Math.min(12, Math.max(0, meses)));
}
/** Meses que contam: os completos mais um se a sobra tiver 15 dias ou mais. */
export const mesesQueContam = (mesesCompletos: number, diasSobrando: number) => mesesCompletos + (diasSobrando >= 15 ? 1 : 0);
/** Hora extra: valor da hora (salário ÷ divisor, 220 para 44 horas semanais) com o adicional (mínimo de 50%: CF, art. 7º, XVI). */
export function horasExtras(salario: number, horas: number, adicional = 0.5, divisor = 220) {
  const hora = salario / divisor;
  return { valorDaHora: centavos(hora), valorDaHoraExtra: centavos(hora * (1 + adicional)), total: centavos(hora * (1 + adicional) * horas) };
}
/** Aviso prévio: 30 dias mais 3 por ano completo na mesma empresa, até 90 dias (Lei 12.506/2011). */
export function diasDeAviso(anosCompletos: number) {
  return Math.min(90, 30 + 3 * Math.max(0, Math.floor(anosCompletos)));
}
/** FGTS: 8% do salário por mês (Lei 8.036/1990, art. 15); na dispensa sem justa causa, multa de 40% do saldo (art. 18, § 1º). */
export const fgtsDoMes = (salario: number) => centavos(salario * 0.08);
export const multaDoFgts = (saldo: number) => centavos(saldo * 0.4);
export interface Rescisao {
  salario: number;
  diasTrabalhadosNoMes: number;
  mesesDeFeriasProporcionais: number;
  feriasVencidas: boolean;
  mesesDe13: number;
  anosCompletos: number;
  saldoFgts: number;
  avisoIndenizado: boolean;
}
/** Dispensa sem justa causa: as verbas principais, com a lei de cada uma. Valores brutos. */
export function rescisaoSemJustaCausa(r: Rescisao) {
  const itens: { nome: string; valor: number; lei: string }[] = [];
  itens.push({ nome: `Saldo de salário (${r.diasTrabalhadosNoMes} dias)`, valor: centavos((r.salario / 30) * r.diasTrabalhadosNoMes), lei: "CLT, art. 462 e seguintes" });
  if (r.avisoIndenizado) {
    const dias = diasDeAviso(r.anosCompletos);
    itens.push({ nome: `Aviso prévio indenizado (${dias} dias)`, valor: centavos((r.salario / 30) * dias), lei: "CF, art. 7º, XXI; CLT, art. 487; Lei 12.506/2011" });
  }
  if (r.feriasVencidas) itens.push({ nome: "Férias vencidas + 1/3", valor: ferias(r.salario).total, lei: "CF, art. 7º, XVII; CLT, art. 146" });
  if (r.mesesDeFeriasProporcionais > 0) itens.push({ nome: `Férias proporcionais (${r.mesesDeFeriasProporcionais}/12) + 1/3`, valor: ferias(r.salario, r.mesesDeFeriasProporcionais).total, lei: "CLT, art. 146, parágrafo único, e art. 147" });
  if (r.mesesDe13 > 0) itens.push({ nome: `13º proporcional (${r.mesesDe13}/12)`, valor: decimoTerceiro(r.salario, r.mesesDe13), lei: "Lei 4.090/1962, art. 3º" });
  const verbas = centavos(itens.reduce((s, i) => s + i.valor, 0));
  const multa = multaDoFgts(r.saldoFgts);
  return { itens, verbas, multaFgts: multa, saqueFgts: centavos(r.saldoFgts + multa) };
}

// ───────────── Mapas de Karnaugh (Quine-McCluskey) ─────────────

const LETRAS = ["A", "B", "C", "D"];
/** A expressão mínima em soma de produtos para os mintermos dados (2 a 4 variáveis), com "não importa" opcional. */
export function minimizar(variaveis: number, mintermos: number[], naoImporta: number[] = []): string {
  const total = 1 << variaveis;
  const uns = [...new Set(mintermos)].filter((m) => m >= 0 && m < total);
  if (uns.length === 0) return "0";
  const todos = [...new Set([...uns, ...naoImporta])].filter((m) => m >= 0 && m < total);
  if (todos.length === total && uns.length) return "1";
  // Cada implicante: valor, máscara de "tanto faz" e os mintermos que cobre.
  type Imp = { v: number; mask: number; cobre: number[] };
  let grupo: Imp[] = todos.map((m) => ({ v: m, mask: 0, cobre: [m] }));
  const primos: Imp[] = [];
  while (grupo.length) {
    const usados = new Set<number>();
    const proximos = new Map<string, Imp>();
    for (let i = 0; i < grupo.length; i++)
      for (let j = i + 1; j < grupo.length; j++) {
        const a = grupo[i], b = grupo[j];
        if (a.mask !== b.mask) continue;
        const dif = a.v ^ b.v;
        if (dif && (dif & (dif - 1)) === 0) {
          usados.add(i).add(j);
          const n = { v: a.v & ~dif, mask: a.mask | dif, cobre: [...new Set([...a.cobre, ...b.cobre])].sort((x, y) => x - y) };
          proximos.set(`${n.v}/${n.mask}`, n);
        }
      }
    grupo.forEach((imp, i) => { if (!usados.has(i)) primos.push(imp); });
    grupo = [...proximos.values()];
  }
  // Cobertura: primeiro os essenciais, depois o que cobre mais mintermos que faltam.
  const faltam = new Set(uns);
  const escolhidos: Imp[] = [];
  for (const m of uns) {
    const quem = primos.filter((p) => p.cobre.includes(m));
    if (quem.length === 1 && !escolhidos.includes(quem[0])) { escolhidos.push(quem[0]); quem[0].cobre.forEach((x) => faltam.delete(x)); }
  }
  while (faltam.size) {
    const melhor = primos.filter((p) => !escolhidos.includes(p)).sort((a, b) => b.cobre.filter((x) => faltam.has(x)).length - a.cobre.filter((x) => faltam.has(x)).length || bitsLigados(b.mask) - bitsLigados(a.mask))[0];
    escolhidos.push(melhor);
    melhor.cobre.forEach((x) => faltam.delete(x));
  }
  const termo = (p: Imp) => {
    let s = "";
    for (let k = 0; k < variaveis; k++) {
      const bit = 1 << (variaveis - 1 - k);
      if (p.mask & bit) continue;
      s += p.v & bit ? LETRAS[k] : `${LETRAS[k]}'`;
    }
    return s || "1";
  };
  return escolhidos.map(termo).sort((a, b) => a.length - b.length || a.localeCompare(b)).join(" + ");
}
function bitsLigados(x: number) { let n = 0; while (x) { n += x & 1; x >>= 1; } return n; }

// ───────────── Eletrônica ─────────────

export const emSerie = (rs: number[]) => rs.reduce((s, r) => s + r, 0);
export const emParalelo = (rs: number[]) => (rs.some((r) => r === 0) ? 0 : 1 / rs.reduce((s, r) => s + 1 / r, 0));
/** Frequência de corte de um filtro RC: 1 ÷ (2π R C). */
export const corteRC = (ohm: number, faradays: number) => 1 / (2 * Math.PI * ohm * faradays);
/** Ganho do filtro RC na frequência f (passa-baixa ou passa-alta), de 0 a 1. */
export function ganhoRC(tipo: "baixa" | "alta", f: number, fc: number) {
  const x = f / fc;
  return tipo === "baixa" ? 1 / Math.sqrt(1 + x * x) : x / Math.sqrt(1 + x * x);
}
/** As faixas de cor de um resistor de 4 faixas para um valor (dois algarismos e o multiplicador). */
export function faixasDoResistor(ohm: number) {
  if (!(ohm >= 1)) return null;
  const exp = Math.floor(Math.log10(ohm)) - 1;
  const dois = Math.round(ohm / 10 ** exp);
  const [d1, d2] = dois >= 100 ? [1, 0] : [Math.floor(dois / 10), dois % 10];
  const mult = dois >= 100 ? exp + 1 : exp;
  if (mult < -1 || mult > 9) return null;
  return { d1, d2, mult, valor: (d1 * 10 + d2) * 10 ** mult };
}

// ───────────── Sólidos ─────────────

export type Solido = "cubo" | "paralelepipedo" | "cilindro" | "cone" | "esfera" | "piramide";
export function medidasDoSolido(s: Solido, a: number, b: number, c: number) {
  switch (s) {
    case "cubo": return { area: 6 * a * a, volume: a ** 3, formulaArea: "6 · a²", formulaVolume: "a³" };
    case "paralelepipedo": return { area: 2 * (a * b + a * c + b * c), volume: a * b * c, formulaArea: "2 · (ab + ac + bc)", formulaVolume: "a · b · c" };
    case "cilindro": return { area: 2 * Math.PI * a * (a + b), volume: Math.PI * a * a * b, formulaArea: "2πr · (r + h)", formulaVolume: "π · r² · h" };
    case "cone": { const g = Math.hypot(a, b); return { area: Math.PI * a * (a + g), volume: (Math.PI * a * a * b) / 3, formulaArea: "πr · (r + g), com g = √(r² + h²)", formulaVolume: "π · r² · h ÷ 3" }; }
    case "esfera": return { area: 4 * Math.PI * a * a, volume: (4 / 3) * Math.PI * a ** 3, formulaArea: "4 · π · r²", formulaVolume: "4 · π · r³ ÷ 3" };
    case "piramide": { const ap = Math.hypot(a / 2, b); return { area: a * a + 2 * a * ap, volume: (a * a * b) / 3, formulaArea: "a² + 2 · a · g, com g = √((a/2)² + h²)", formulaVolume: "a² · h ÷ 3" }; }
  }
}

// ───────────── Contas do dia a dia ─────────────

/** Regra de três: se a está para b, então c está para x. Direta (cresce junto) ou inversa (um sobe, o outro desce). */
export const regraDeTres = (a: number, b: number, c: number, inversa = false) => (inversa ? (a * b) / c : (b * c) / a);
/** Aumentos e descontos em sequência: o resultado e a variação total, que não é a soma das porcentagens. */
export function variacoes(valor: number, porcentagens: number[]) {
  const final = porcentagens.reduce((v, p) => v * (1 + p / 100), valor);
  return { final, total: (final / valor - 1) * 100 };
}
/** Prestação de um parcelamento com juros (tabela Price): PMT = PV · i ÷ (1 − (1 + i)^−n). */
export function prestacao(valor: number, jurosMes: number, parcelas: number) {
  const i = jurosMes / 100;
  const p = i === 0 ? valor / parcelas : (valor * i) / (1 - (1 + i) ** -parcelas);
  return { parcela: p, total: p * parcelas, juros: p * parcelas - valor };
}
