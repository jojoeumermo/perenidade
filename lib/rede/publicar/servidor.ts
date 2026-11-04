// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Ajudas das rotas do servidor do pacote publicar (app/api/rede/*): quem é a pessoa (pelo token da sessão dela, conferido no
// serviço de contas), chamar uma função do banco COMO ela (as regras de membro, limite e visibilidade valem sem exceção) e
// guardar um arquivo no depósito com a permissão dela. Nenhuma chave de serviço entra aqui: o servidor só repassa o token
// que o navegador mandou. Só roda no servidor.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const servicoLigado = Boolean(url && chave);

/** O token do cabeçalho "Authorization: Bearer …", ou nulo. */
export function tokenDe(pedido: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

const cabecalhos = (token: string, extra: Record<string, string> = {}) => ({ apikey: chave, Authorization: `Bearer ${token}`, ...extra });

/** Chama uma função pública do banco com o token da pessoa. Devolve o dado ou o código de erro (a mensagem da função). */
export async function chamarComoPessoa<T>(token: string, funcao: string, argumentos: Record<string, unknown> = {}): Promise<{ ok: true; dado: T } | { ok: false; codigo: string; status: number }> {
  if (!servicoLigado) return { ok: false, codigo: "sem_servico", status: 503 };
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${funcao}`, { method: "POST", headers: cabecalhos(token, { "Content-Type": "application/json" }), body: JSON.stringify(argumentos), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const corpo = (await r.json().catch(() => null)) as unknown;
    if (r.ok) return { ok: true, dado: corpo as T };
    const mensagem = typeof corpo === "object" && corpo !== null && "message" in corpo ? String((corpo as { message: unknown }).message) : "falha";
    return { ok: false, codigo: mensagem.slice(0, 80), status: r.status };
  } catch {
    return { ok: false, codigo: "sem_conexao", status: 504 };
  }
}

/** Guarda os bytes no depósito "rede-midia" no caminho dado (a regra do depósito confere a pasta e se a pessoa é membro). */
export async function guardarNoDeposito(token: string, caminho: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  if (!servicoLigado) return false;
  try {
    const r = await fetch(`${url}/storage/v1/object/rede-midia/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: cabecalhos(token, { "Content-Type": mime, "Cache-Control": "max-age=31536000", "x-upsert": "false" }),
      body: bytes as unknown as BodyInit,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Lê o corpo do pedido até `max` bytes; nulo se passar (não deixa um envio gigante encher a memória). */
export async function lerCorpoLimitado(pedido: Request, max: number): Promise<Uint8Array | null> {
  const declarado = Number(pedido.headers.get("content-length") ?? "0");
  if (declarado > max) return null;
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

/** O código de erro da função do banco vira o status HTTP que a rota devolve. */
export const statusDoCodigo = (codigo: string): number =>
  codigo === "entre_primeiro" || codigo === "JWT expired" ? 401 : codigo === "muitos_pedidos" ? 429 : codigo.startsWith("invalido") ? 400 : codigo === "sem_servico" ? 503 : 403;
