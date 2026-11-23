// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O depósito do anexo cifrado do chat (Prompt 4, itens 137 e 138), do lado do servidor do site: a rota app/api/alumia/anexo chama
// `tratarAnexo` com as peças de verdade; os testes (scripts/testar-p4-anexo-cifrado.mjs) chamam com o banco local e um depósito em
// memória. Documento: docs/rede/CHAT-PRIVADO.md ("Áudio e vídeo").
//
//   POST ?d=1|7|30   corpo: o CIFRADO (application/octet-stream)   Authorization: PrivateToken (um passe anônimo por arquivo)
//                    → { endereco }: 32 letras hexadecimais (128 bits sorteados AQUI, que vão dentro da mensagem cifrada)
//   GET  ?e=<endereço>  → o cifrado (ou 404: não existe, venceu, desligado)
//   Com a flag "alumia-p4-anexo-cifrado" desligada, qualquer pedido (qualquer método) dá o mesmo 404, antes de tudo.
//   DELETE ?e=<endereço> → { ok } (quem mandou apagou para todos, ou "ver uma vez" foi aberto)
//
// Regras:
//   - SEM sessão de conta (cookie "sb-…" ou Authorization que não é passe: recusado), como as rotas das caixas. O servidor não liga
//     arquivo a conta: quem manda gasta um passe anônimo; quem baixa e quem apaga só mostram o endereço;
//   - o tamanho tem de ser um múltiplo de 64 KiB mais os 16 bytes do GCM (o aparelho enche com zeros antes de cifrar): o servidor
//     vê só o degrau, nunca o tamanho exato;
//   - o banco guarda o RESUMO do endereço (nunca o endereço) e o dia em que vence; o depósito guarda o cifrado no caminho tirado
//     do resumo. Nenhum endereço de rede é lido, guardado ou escrito em log; a resposta não vai para cache.
// Sem "@/" de propósito.
import { sha256 } from "@noble/hashes/sha2.js";
import { MAIOR_CIFRADO, tamanhoDoDepositoOk } from "./anexo-cifrado";

const ROTULO = new TextEncoder().encode("alumia/p4/anexo");
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** O resumo do endereço (o que o banco guarda): SHA-256 do rótulo e dos 16 bytes, em hexadecimal. */
export function resumoDoEndereco(endereco: string): string | null {
  if (!/^[0-9a-f]{32}$/.test(endereco)) return null;
  const b = new Uint8Array(ROTULO.length + 16);
  b.set(ROTULO);
  for (let i = 0; i < 16; i++) b[ROTULO.length + i] = parseInt(endereco.slice(2 * i, 2 * i + 2), 16);
  return hex(sha256(b));
}

/** O caminho no depósito tirado do resumo (o mesmo de interno.alumia_anexo_caminho). */
export const caminhoDoResumo = (h: string): string => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}/${h.slice(32, 64)}`;
export const caminhoDoAnexoOk = (c: unknown): c is string => typeof c === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{32}$/.test(c);

export type RespostaDoBanco<T> = { ok: true; dado: T } | { ok: false; codigo: string };

/** O que a rota precisa (no site: o banco pela chave de serviço, o depósito "alumia-anexos", o passe e o sorteio). */
export interface PecasDoAnexo {
  rpc<T>(funcao: string, argumentos: Record<string, unknown>): Promise<RespostaDoBanco<T>>;
  /** Confere o passe do cabeçalho (só a chave pública) e devolve o resumo dele, a gastar no banco. */
  conferirPasse(cabecalho: string | null): Promise<{ ok: true; resumo: Uint8Array } | { ok: false; motivo: string }>;
  guardar(caminho: string, bytes: Uint8Array): Promise<boolean>;
  ler(caminho: string): Promise<Uint8Array | null>;
  apagar(caminho: string): Promise<boolean>;
  /** Sorteio criptográfico (crypto.getRandomValues). */
  sortear(n: number): Uint8Array;
  /** A flag "alumia-p4-anexo-cifrado" está ligada agora? Desligada, a rota inteira é um 404, antes de olhar o pedido. */
  ligado(): Promise<boolean>;
}

const semCache = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const json = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semCache });

/** O pedido traz algo de conta? (o mesmo critério das rotas das caixas, lib/rede/caixas/rota.ts) */
export function trazSessao(pedido: Request): boolean {
  if (/(^|;\s*)sb-[^=]*=/.test(pedido.headers.get("cookie") ?? "")) return true;
  const a = (pedido.headers.get("authorization") ?? "").trim();
  return a !== "" && !/^PrivateToken\s/.test(a);
}

/** Lê o corpo até `max` bytes; nulo se passar (não deixa um envio gigante encher a memória). */
export async function lerAte(pedido: Request, max: number): Promise<Uint8Array | null> {
  const declarado = Number(pedido.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > max) return null;
  if (!pedido.body) return new Uint8Array();
  const leitor = pedido.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await leitor.cancel().catch(() => undefined);
      return null;
    }
    partes.push(value);
  }
  const saida = new Uint8Array(total);
  let o = 0;
  for (const p of partes) {
    saida.set(p, o);
    o += p.length;
  }
  return saida;
}

const paraBytea = (b: Uint8Array) => `\\x${hex(b)}`;

/** A rota inteira (POST, GET e DELETE). */
export async function tratarAnexo(pedido: Request, p: PecasDoAnexo): Promise<Response> {
  // Desligada, a rota não existe: o mesmo 404 para todo método e todo pedido, sem chamar o banco (nem o 401 do passe, nem o 400 do
  // formato dizem que há um depósito aqui).
  if (!(await p.ligado().catch(() => false))) return json({ erro: "nao_encontrado" }, 404);
  if (trazSessao(pedido)) return json({ erro: "sem_sessao_aqui" }, 400);
  const q = new URL(pedido.url).searchParams;

  if (pedido.method === "POST") {
    const dias = Number(q.get("d"));
    if (![1, 7, 30].includes(dias)) return json({ erro: "invalido" }, 400);
    const passe = await p.conferirPasse(pedido.headers.get("authorization"));
    if (!passe.ok) return json({ erro: passe.motivo === "sem_servico" ? "sem_servico" : "passe" }, passe.motivo === "sem_servico" ? 503 : 401);
    const cifrado = await lerAte(pedido, MAIOR_CIFRADO);
    if (!cifrado) return json({ erro: "grande" }, 413);
    if (!tamanhoDoDepositoOk(cifrado.length)) return json({ erro: "tamanho" }, 400);
    const endereco = hex(p.sortear(16));
    const idH = resumoDoEndereco(endereco) as string;
    const r = await p.rpc<{ caminho: string }>("alumia_anexo_reservar", { p_id_h: idH, p_tamanho: cifrado.length, p_dias: dias, p_passe: paraBytea(passe.resumo) });
    if (!r.ok) {
      const status = r.codigo === "desligado" ? 404 : r.codigo === "passe_usado" ? 409 : r.codigo === "invalido" ? 400 : 502;
      return json({ erro: r.codigo === "desligado" || r.codigo === "passe_usado" || r.codigo === "invalido" ? r.codigo : "rede" }, status);
    }
    if (!caminhoDoAnexoOk(r.dado?.caminho) || r.dado.caminho !== caminhoDoResumo(idH) || !(await p.guardar(r.dado.caminho, cifrado))) {
      // Não guardou: o registro sai (e o caminho vai para a fila, se algo chegou a entrar).
      await p.rpc("alumia_anexo_tirar", { p_id_h: idH });
      return json({ erro: "falha" }, 502);
    }
    return json({ endereco });
  }

  const endereco = q.get("e") ?? "";
  const idH = resumoDoEndereco(endereco);
  if (!idH) return json({ erro: "invalido" }, 400);

  if (pedido.method === "GET") {
    const r = await p.rpc<{ caminho: string; tamanho: number } | null>("alumia_anexo_ver", { p_id_h: idH });
    if (!r.ok) return json({ erro: "rede" }, 502);
    if (!r.dado || !caminhoDoAnexoOk(r.dado.caminho)) return json({ erro: "nao_encontrado" }, 404);
    const bytes = await p.ler(r.dado.caminho);
    if (!bytes || bytes.length !== r.dado.tamanho) return json({ erro: "nao_encontrado" }, 404);
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: { ...semCache, "Content-Type": "application/octet-stream", "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff", "Content-Disposition": "attachment" },
    });
  }

  if (pedido.method === "DELETE") {
    const r = await p.rpc<{ caminho: string } | null>("alumia_anexo_tirar", { p_id_h: idH });
    if (!r.ok) return json({ erro: "rede" }, 502);
    // Apaga na hora; se o depósito falhar, a fila (interno.alumia_arquivos_a_apagar) apaga depois. Mesma resposta nos dois casos.
    if (r.dado && caminhoDoAnexoOk(r.dado.caminho)) await p.apagar(r.dado.caminho).catch(() => false);
    return json({ ok: true });
  }

  return json({ erro: "metodo" }, 405);
}
