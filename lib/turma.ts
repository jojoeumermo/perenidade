// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Modo turma, sem cadastro e sem servidor. O professor monta uma sequência de aulas; a sequência inteira vai escrita
// no próprio link, depois do "#" (a parte do endereço que o navegador nunca manda ao servidor). O aluno abre, segue a
// trilha, e o progresso continua o do aparelho dele. Se quiser, gera um comprovante (um texto) para entregar ao
// professor; o professor cola os comprovantes na mesma página para ver quem concluiu o quê. Nada é enviado sozinho.
//
// O comprovante tem um dígito de conferência contra erro de cópia; não é assinatura: quem quiser pode inventar um.
// Sem os atalhos "@/" de propósito: `npm run testar:meu-estudo` roda este arquivo direto no Node.

export interface Sequencia {
  v: 1;
  titulo: string;
  /** Aulas na ordem, como "trilha/aula". */
  aulas: string[];
  /** Recado do professor para a turma (opcional). */
  recado?: string;
}

export interface Comprovante {
  v: 1;
  /** Código da sequência (o mesmo para todo mundo da turma). */
  s: string;
  /** Nome que o aluno escreveu (opcional). */
  n: string;
  /** Posições (na sequência) das aulas concluídas. */
  c: number[];
  /** Total de aulas da sequência. */
  t: number;
  /** Data, AAAA-MM-DD. */
  d: string;
}

const AULA = /^[a-z0-9-]{1,90}\/[a-z0-9-]{1,90}$/;
export const MAX_AULAS = 60;

function paraBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(codigo: string): string | null {
  try {
    const base = codigo.replace(/-/g, "+").replace(/_/g, "/");
    const binario = atob(base + "=".repeat((4 - (base.length % 4)) % 4));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Resumo curto e estável de um texto (FNV-1a), em base 36. */
function resumo(texto: string, tamanho = 6): string {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36).padStart(tamanho, "0").slice(-tamanho).toUpperCase();
}

const limpar = (texto: string, max: number) => texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Confere e normaliza uma sequência (vinda do link ou do formulário). Devolve null se não serve. */
export function normalizarSequencia(bruto: unknown): Sequencia | null {
  if (!bruto || typeof bruto !== "object") return null;
  const s = bruto as Partial<Sequencia>;
  if (s.v !== 1 || typeof s.titulo !== "string" || !Array.isArray(s.aulas)) return null;
  const aulas = [...new Set(s.aulas.filter((a): a is string => typeof a === "string" && AULA.test(a)))].slice(0, MAX_AULAS);
  const titulo = limpar(s.titulo, 120);
  if (!titulo || aulas.length === 0) return null;
  const recado = typeof s.recado === "string" ? limpar(s.recado, 500) : "";
  return recado ? { v: 1, titulo, aulas, recado } : { v: 1, titulo, aulas };
}

/** O fragmento do link: "t=<sequência codificada>". */
export function codificarSequencia(seq: Sequencia): string {
  const normal = normalizarSequencia(seq);
  if (!normal) throw new RangeError("sequência vazia");
  return `t=${paraBase64Url(JSON.stringify(normal))}`;
}

/** Lê a sequência do fragmento do link (com ou sem o "#"). */
export function lerSequencia(fragmento: string): Sequencia | null {
  const achado = /(?:^|[#&])t=([A-Za-z0-9_-]{4,8000})/.exec(fragmento);
  if (!achado) return null;
  const texto = deBase64Url(achado[1]);
  if (!texto) return null;
  try {
    return normalizarSequencia(JSON.parse(texto));
  } catch {
    return null;
  }
}

/** Código curto da sequência ("T-4K2Q9Z"): o mesmo para a turma inteira; muda se a lista de aulas mudar. */
export const codigoDaSequencia = (seq: Sequencia) => `T-${resumo(`${seq.titulo}\u0000${seq.aulas.join("|")}`)}`;

const PREFIXO = "LUCIA-";

export function gerarComprovante(seq: Sequencia, feitas: Set<string>, nome: string, dia: string): string {
  const c = seq.aulas.map((a, i) => (feitas.has(a) ? i : -1)).filter((i) => i >= 0);
  const comprovante: Comprovante = { v: 1, s: codigoDaSequencia(seq), n: limpar(nome, 80), c, t: seq.aulas.length, d: dia };
  const corpo = paraBase64Url(JSON.stringify(comprovante));
  return `${PREFIXO}${corpo}-${resumo(corpo, 4)}`;
}

/** Lê um comprovante colado pelo professor. Devolve null se o texto foi cortado ou alterado na cópia. */
export function lerComprovante(texto: string): Comprovante | null {
  const achado = new RegExp(`${PREFIXO}([A-Za-z0-9_-]+)-([0-9A-Z]{4})(?![A-Za-z0-9_-])`).exec(texto.trim());
  if (!achado || resumo(achado[1], 4) !== achado[2]) return null;
  const json = deBase64Url(achado[1]);
  if (!json) return null;
  try {
    const c = JSON.parse(json) as Partial<Comprovante>;
    if (c.v !== 1 || typeof c.s !== "string" || typeof c.n !== "string" || !Array.isArray(c.c) || typeof c.t !== "number" || typeof c.d !== "string") return null;
    if (!/^T-[0-9A-Z]{6}$/.test(c.s) || !/^\d{4}-\d{2}-\d{2}$/.test(c.d) || c.t < 1 || c.t > MAX_AULAS) return null;
    const feitas = [...new Set(c.c.filter((i) => Number.isInteger(i) && i >= 0 && i < c.t!))].sort((a, b) => a - b);
    return { v: 1, s: c.s, n: limpar(c.n, 80), c: feitas, t: c.t, d: c.d };
  } catch {
    return null;
  }
}

/** Separa vários comprovantes colados de uma vez (um por linha, ou misturados num texto). */
export function lerComprovantes(texto: string): { lidos: Comprovante[]; invalidos: number } {
  const pedacos = texto.match(new RegExp(`${PREFIXO}[A-Za-z0-9_-]+(?:-[0-9A-Za-z]{0,4})?`, "g")) ?? [];
  const lidos: Comprovante[] = [];
  let invalidos = 0;
  for (const p of pedacos) {
    const c = lerComprovante(p);
    if (c) lidos.push(c);
    else invalidos++;
  }
  return { lidos, invalidos };
}
