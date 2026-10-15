// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// A ligação do coletor com o banco do Sentinela: só pelas funções "coleta_*" e afins, com a chave de serviço.
import type { Env } from "./tipos.ts";

export class Banco {
  private url: string;
  private chave: string;

  constructor(env: Env) {
    this.url = (env.SENTINELA_SUPABASE_URL ?? "").replace(/\/$/, "");
    this.chave = env.SENTINELA_SERVICE_KEY ?? "";
  }

  get pronto(): boolean {
    return Boolean(this.url && this.chave);
  }

  async rpc<T = unknown>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> {
    if (!this.pronto) throw new Error("banco: SENTINELA_SUPABASE_URL ou SENTINELA_SERVICE_KEY não configurados");
    const resposta = await fetch(`${this.url}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: this.chave, Authorization: `Bearer ${this.chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => "");
      // O texto do banco pode citar nomes de tabela; nunca a chave. Mesmo assim, corta.
      throw new Error(`banco: ${funcao} respondeu ${resposta.status} ${texto.slice(0, 200)}`);
    }
    return (await resposta.json()) as T;
  }

  /** Chama uma função com a sessão de uma pessoa (o token que o app mandou), para o banco dizer quem é e o que pode. */
  async comoPessoa<T = unknown>(token: string, funcao: string, argumentos: Record<string, unknown> = {}): Promise<T | null> {
    if (!this.url || !/^[A-Za-z0-9_.-]{20,}$/.test(token)) return null;
    const resposta = await fetch(`${this.url}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: this.chave, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!resposta?.ok) return null;
    return (await resposta.json()) as T;
  }
}
