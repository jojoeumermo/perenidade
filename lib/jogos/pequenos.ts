// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lógica dos jogos pequenos: forca (flor), memória, quebra-cabeça de palavras e jogo da velha com perguntas.
import type { PalavraDeJogo, Sorteio, Verbete } from "./base";
import { embaralhar, primeiraFrase, semAcento, sortear } from "./base";

// ───────────────────────── Forca (a flor que perde pétalas) ─────────────────────────

export const PETALAS = 6;

export interface Forca {
  palavra: string;
  tentadas: string[];
}
export const erros = (f: Forca) => f.tentadas.filter((l) => !f.palavra.includes(l)).length;
export const acertou = (f: Forca) => [...f.palavra].every((l) => f.tentadas.includes(l));
export const perdeu = (f: Forca) => erros(f) >= PETALAS;
export const forcaAcabou = (f: Forca) => acertou(f) || perdeu(f);

/** Tenta uma letra; letra repetida, fora de A-Z ou depois do fim não muda nada. */
export function tentarLetra(f: Forca, letra: string): Forca {
  const l = semAcento(letra);
  if (!/^[A-Z]$/.test(l) || f.tentadas.includes(l) || forcaAcabou(f)) return f;
  return { ...f, tentadas: [...f.tentadas, l] };
}

// ───────────────────────── Memória ─────────────────────────

export interface CartaDeMemoria {
  id: number;
  par: number;
  texto: string;
  tipo: "termo" | "definicao";
}

/** Pares termo / definição curta. Só entram verbetes com definição curta o bastante para caber na carta. */
export function gerarMemoria(verbetes: readonly Verbete[], pares: number, rnd: Sorteio): CartaDeMemoria[] {
  const curtos = verbetes.filter((v) => primeiraFrase(v.resumo, 200).length <= 90 && !v.termo.includes("("));
  const escolhidos = sortear(curtos, pares, rnd);
  const cartas: Omit<CartaDeMemoria, "id">[] = escolhidos.flatMap((v, par) => [
    { par, texto: v.termo, tipo: "termo" as const },
    { par, texto: primeiraFrase(v.resumo, 200), tipo: "definicao" as const },
  ]);
  return embaralhar(cartas, rnd).map((c, id) => ({ ...c, id }));
}

// ───────────────────────── Quebra-cabeça de palavras ─────────────────────────

export interface Peca {
  id: number;
  texto: string;
}
export interface Quebra {
  modo: "letras" | "frase";
  certa: string[];
  pecas: Peca[];
  dica: string;
  termo: string;
}

/** Embaralha de novo até a ordem sair diferente da certa (se houver mais de uma peça diferente). */
function embaralharDiferente<T extends { texto: string }>(lista: readonly T[], rnd: Sorteio): T[] {
  const certa = lista.map((p) => p.texto).join("|");
  if (new Set(lista.map((p) => p.texto)).size < 2) return [...lista];
  let r = embaralhar(lista, rnd);
  for (let i = 0; i < 20 && r.map((p) => p.texto).join("|") === certa; i++) r = embaralhar(lista, rnd);
  return r;
}

/** Modo "letras": reordenar as letras de um termo. Modo "frase": reordenar as palavras de uma definição curta. */
export function gerarQuebra(modo: "letras" | "frase", palavras: readonly PalavraDeJogo[], verbetes: readonly Verbete[], rnd: Sorteio, mascarar: (r: string, t: string) => string): Quebra {
  if (modo === "letras") {
    const p = palavras[Math.floor(rnd() * palavras.length)];
    const certa = [...p.palavra];
    const pecas = embaralharDiferente(certa.map((texto, id) => ({ id, texto })), rnd);
    return { modo, certa, pecas, dica: mascarar(primeiraFrase(p.resumo, 200), p.termo), termo: p.termo };
  }
  const curtos = verbetes.filter((v) => {
    const f = primeiraFrase(v.resumo, 200);
    const n = f.split(" ").length;
    return n >= 5 && n <= 11;
  });
  const v = curtos[Math.floor(rnd() * curtos.length)] ?? verbetes[0];
  const certa = primeiraFrase(v.resumo, 200).split(" ");
  const pecas = embaralharDiferente(certa.map((texto, id) => ({ id, texto })), rnd);
  return { modo, certa, pecas, dica: v.termo, termo: v.termo };
}

// ───────────────────────── Jogo da velha com perguntas ─────────────────────────

export type Marca = "X" | "O" | null;
const LINHAS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function vencedor(t: readonly Marca[]): { marca: "X" | "O"; linha: number[] } | null {
  for (const l of LINHAS) if (t[l[0]] && t[l[0]] === t[l[1]] && t[l[1]] === t[l[2]]) return { marca: t[l[0]] as "X" | "O", linha: l };
  return null;
}
export const empate = (t: readonly Marca[]) => !vencedor(t) && t.every((m) => m !== null);

/** A jogada do computador (O): fecha a sua linha, impede a do outro, pega o centro, depois qualquer casa. */
export function jogadaDoComputador(t: readonly Marca[], rnd: Sorteio): number {
  const livres = t.map((m, i) => (m === null ? i : -1)).filter((i) => i >= 0);
  const achar = (marca: "X" | "O") => livres.find((i) => { const c = [...t]; c[i] = marca; return vencedor(c)?.marca === marca; });
  const g = achar("O") ?? achar("X");
  if (g !== undefined) return g;
  if (t[4] === null) return 4;
  return livres[Math.floor(rnd() * livres.length)];
}

export interface Pergunta {
  /** A definição (com o termo escondido). */
  enunciado: string;
  opcoes: string[];
  certa: number;
  aula?: { titulo: string; href: string };
  termo: string;
}

/** "Que termo é este?": a definição e três termos, um certo. */
export function gerarPergunta(verbetes: readonly Verbete[], rnd: Sorteio, mascarar: (r: string, t: string) => string): Pergunta {
  const bons = verbetes.filter((v) => primeiraFrase(v.resumo, 220).length <= 170);
  const v = bons[Math.floor(rnd() * bons.length)];
  const outros = sortear(verbetes.filter((o) => o.termo !== v.termo), 2, rnd);
  const opcoes = embaralhar([v.termo, ...outros.map((o) => o.termo)], rnd);
  return { enunciado: mascarar(primeiraFrase(v.resumo, 220), v.termo), opcoes, certa: opcoes.indexOf(v.termo), aula: v.aula, termo: v.termo };
}
