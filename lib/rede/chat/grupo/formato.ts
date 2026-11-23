// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa em grupo do chat (recurso "alumia-chat-grupo"): os FORMATOS do que vai dentro do cifrado. Nada aqui é cifra: a cifra é a
// da conversa a dois (Proteus + SPQR + envelope X-Wing, lib/rede/chat/r2/) e a do grupo com membros escondidos (MLS na suíte híbrida,
// embrulho da época e caixas anônimas, lib/rede/membros/grupo.ts). Este arquivo só diz como o conteúdo é escrito e lido, e recusa
// o que vem fora do formato. Documento: docs/rede/CHAT-PRIVADO.md ("Conversa em grupo").
//
// 1. O CONVITE vai pela conversa a dois (um controle "grupo" dentro do bloco cifrado, como a posição e o toque da chamada): quem
//    administra convida pelo @ só quem já tem conversa aberta com ela, e a resposta volta pelo mesmo caminho. O servidor não vê
//    convite nenhum: vê o envelope de tamanho fixo de sempre, na caixa anônima da conversa.
//      {t:"convite", g, n}    g = o número do convite (16 bytes sorteados), n = o nome do grupo (até 60 letras)
//      {t:"pedido", g, i, k, r, d, p}   quem aceitou manda a identidade da conta (i), a chave da resposta (k), a caixa de resposta
//                             (r e d: id e passe de depósito) e o pacote de chave do MLS deste aparelho (p): o mesmo pedido de entrada
//                             dos núcleos (lib/rede/membros/entrada.ts, PedidoDeEntrada), só que pela conversa a dois
//      {t:"recusa", g}
// 2. As LINHAS do grupo vão como texto do grupo MLS (Grupo.mandarTexto), com o prefixo "alumia/chat-grupo/v1 " e um JSON pequeno:
//      {t:"msg", id, c, q, p, u?}  mensagem: id (16 bytes), texto (até 2000 letras), quando (ms), prazo em dias (1, 7 ou 30), ver uma vez
//      {t:"apagar", id}            apagar para todos (só vale do próprio autor)
//      {t:"nome", n}               o nome do grupo (só vale da mediação)
//      {t:"eu", u, c}              "esta identidade é a conta u, de @c" (quem lê confere no registro público das chaves)
//      {t:"quem", l:[{i,u,c}]}     a mediação repassa quem é quem a quem acabou de entrar (que não leu as épocas de antes)
// Sem "@/": roda no Node nos testes (scripts/testar-chat-grupo.mjs).
import { deB64, paraB64 } from "../../membros/bytes";
import type { PedidoDeEntrada } from "../../membros/entrada";

export const ROTULOS = { linha: "alumia/chat-grupo/v1" } as const;
const PREFIXO = `${ROTULOS.linha} `;
export const LIMITES = { nome: 60, texto: 2000, pacote: 12_000, quem: 200, codinome: 40 } as const;
export const PRAZOS_DO_GRUPO = [1, 7, 30] as const;
export type PrazoDoGrupo = (typeof PRAZOS_DO_GRUPO)[number];

const B64 = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODINOME = /^[a-z0-9_.]{1,40}$/;
/** base64url com exatamente `n` bytes (ou null). */
function bytes(s: unknown, n?: number): Uint8Array | null {
  if (typeof s !== "string" || !B64.test(s)) return null;
  try {
    const b = deB64(s);
    return n === undefined || b.length === n ? b : null;
  } catch {
    return null;
  }
}
const nomeValido = (n: unknown): n is string => typeof n === "string" && n.trim().length > 0 && [...n].length <= LIMITES.nome && !/[\u0000-\u001f]/.test(n);
/** O nome como vai e como fica: sem espaço sobrando nas pontas, na forma NFC. */
export const limparNome = (n: string) => n.trim().replace(/\s+/g, " ").normalize("NFC");

// ── 1. Pela conversa a dois ─────────────────────────────────────────────────────────────────────────────────────────────────

export type CorpoDoConvite =
  | { t: "convite"; g: string; n: string }
  | { t: "pedido"; g: string; i: string; k: string; r: string; d: string; p: string }
  | { t: "recusa"; g: string };

/** O corpo do controle "grupo" (JSON), conferido; null em qualquer coisa fora do formato. */
export function lerCorpoDoConvite(s: unknown): CorpoDoConvite | null {
  if (typeof s !== "string" || s.length > LIMITES.pacote + 400) return null;
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(s);
  } catch {
    return null;
  }
  if (!c || typeof c !== "object" || !bytes(c.g, 16)) return null;
  const g = c.g as string;
  if (c.t === "convite" && nomeValido(c.n)) return { t: "convite", g, n: limparNome(c.n) };
  if (c.t === "recusa") return { t: "recusa", g };
  if (c.t === "pedido" && bytes(c.i, 32) && bytes(c.k, 32) && bytes(c.r, 32) && bytes(c.d, 32) && typeof c.p === "string" && c.p.length <= LIMITES.pacote && bytes(c.p))
    return { t: "pedido", g, i: c.i as string, k: c.k as string, r: c.r as string, d: c.d as string, p: c.p };
  return null;
}
export const montarCorpoDoConvite = (c: CorpoDoConvite): string => {
  const s = JSON.stringify(c);
  if (!lerCorpoDoConvite(s)) throw Object.assign(new Error("convite_invalido"), { code: "convite_invalido" });
  return s;
};

/** O pedido de entrada (lib/rede/membros/entrada.ts) no corpo do convite, e de volta. */
export const pedidoParaCorpo = (g: string, p: PedidoDeEntrada): CorpoDoConvite => ({
  t: "pedido", g, i: paraB64(p.identidade), k: paraB64(p.kr), r: paraB64(p.resposta.id), d: paraB64(p.resposta.pd), p: paraB64(p.pacote),
});
export function pedidoDoCorpo(c: Extract<CorpoDoConvite, { t: "pedido" }>): PedidoDeEntrada {
  return { identidade: deB64(c.i), kr: deB64(c.k), resposta: { id: deB64(c.r), pd: deB64(c.d) }, pacote: deB64(c.p), texto: "" };
}

// ── 2. Dentro do grupo ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface QuemE {
  i: string;
  u: string;
  c: string;
}
export type Linha =
  | { t: "msg"; id: string; c: string; q: number; p: PrazoDoGrupo; u?: 1 }
  | { t: "apagar"; id: string }
  | { t: "nome"; n: string }
  | { t: "eu"; u: string; c: string }
  | { t: "quem"; l: QuemE[] };

const quemValido = (x: unknown): x is QuemE => {
  const q = x as QuemE;
  return !!q && typeof q === "object" && !!bytes(q.i, 32) && typeof q.u === "string" && UUID.test(q.u) && typeof q.c === "string" && CODINOME.test(q.c);
};

/** É uma linha deste formato? (Um texto do grupo que não começa com o prefixo não é desta tela.) */
export const eLinhaDoGrupo = (texto: string) => texto.startsWith(PREFIXO);

/** Lê uma linha do grupo (o texto já decifrado pelo MLS); null em qualquer coisa fora do formato. */
export function lerLinha(texto: string): Linha | null {
  if (!eLinhaDoGrupo(texto) || texto.length > PREFIXO.length + 16_000) return null;
  let l: Record<string, unknown>;
  try {
    l = JSON.parse(texto.slice(PREFIXO.length));
  } catch {
    return null;
  }
  if (!l || typeof l !== "object") return null;
  switch (l.t) {
    case "msg": {
      const c = typeof l.c === "string" ? l.c.normalize("NFC") : "";
      if (!bytes(l.id, 16) || !c.trim() || [...c].length > LIMITES.texto || !Number.isSafeInteger(l.q) || (l.q as number) < 0) return null;
      if (!PRAZOS_DO_GRUPO.includes(l.p as PrazoDoGrupo) || (l.u !== undefined && l.u !== 1)) return null;
      return { t: "msg", id: l.id as string, c, q: l.q as number, p: l.p as PrazoDoGrupo, ...(l.u === 1 ? { u: 1 as const } : {}) };
    }
    case "apagar":
      return bytes(l.id, 16) ? { t: "apagar", id: l.id as string } : null;
    case "nome":
      return nomeValido(l.n) ? { t: "nome", n: limparNome(l.n) } : null;
    case "eu":
      return typeof l.u === "string" && UUID.test(l.u) && typeof l.c === "string" && CODINOME.test(l.c) ? { t: "eu", u: l.u, c: l.c } : null;
    case "quem":
      return Array.isArray(l.l) && l.l.length <= LIMITES.quem && l.l.every(quemValido) ? { t: "quem", l: (l.l as QuemE[]).map((q) => ({ i: q.i, u: q.u, c: q.c })) } : null;
    default:
      return null;
  }
}

export function montarLinha(l: Linha): string {
  const s = `${PREFIXO}${JSON.stringify(l)}`;
  if (!lerLinha(s)) throw Object.assign(new Error("linha_invalida"), { code: "linha_invalida" });
  return s;
}
