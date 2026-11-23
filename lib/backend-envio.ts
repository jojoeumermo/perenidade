// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A chave do envio (idempotência, supabase/migracoes/20261126-p5-publicar.sql): o aparelho gera uma chave por envio e põe no pedido
// como `chave_envio`; a chamada ao banco (lib/backend.ts) tira o campo do pedido e manda no cabeçalho "x-alumia-envio". O banco
// recusa a mesma chave chegando de novo ("envio_repetido") e rede_envio_achar devolve o que ela já publicou.

/** O cabeçalho que leva a chave do envio ao banco. */
export const CABECALHO_DO_ENVIO = "x-alumia-envio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Uma chave nova para um envio (uuid v4 do aparelho). */
export function novaChaveDeEnvio(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const simples = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Uint8Array);

/**
 * Tira `chave_envio` dos argumentos (de primeiro nível ou de dentro de um objeto de primeiro nível, como o `p` dos pedidos) e
 * devolve os argumentos sem ela e a chave (só se for um uuid). Não mexe no objeto recebido.
 */
export function semChaveDeEnvio(argumentos: Record<string, unknown>): { argumentos: Record<string, unknown>; chave: string | null } {
  let chave: string | null = null;
  let mudou = false;
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(argumentos)) {
    if (k === "chave_envio") {
      mudou = true;
      if (typeof v === "string" && UUID.test(v)) chave = v;
      continue;
    }
    if (simples(v) && "chave_envio" in v) {
      const { chave_envio, ...resto } = v;
      if (typeof chave_envio === "string" && UUID.test(chave_envio)) chave = chave_envio;
      saida[k] = resto;
      mudou = true;
      continue;
    }
    saida[k] = v;
  }
  return { argumentos: mudou ? saida : argumentos, chave };
}
