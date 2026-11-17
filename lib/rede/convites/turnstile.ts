// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência, NO SERVIDOR, da resposta do desafio contra robôs da Cloudflare (Turnstile), antes de criar a conta, entrar ou
// mandar um e-mail pela porta (app/api/alumia/porta/{conta,entrar,aviso}). A Cloudflare já está na frente do site inteiro, então o
// desafio não acrescenta um terceiro novo; ele é uma camada a mais, junto da prova feita no aparelho e do freio por rede, que
// continuam valendo. Só roda no servidor: a chave secreta (TURNSTILE_SECRET_KEY) nunca vai para o navegador.
//
// Sem a chave secreta configurada, a porta segue só com a prova própria (devolve "sem_chave", e quem chama deixa passar). Com a
// chave, a resposta tem de valer (cada uma vale uma vez; os endereços em que o desafio vale ficam na configuração dele na Cloudflare);
// se a Cloudflare não responder, recusa (a porta não abre sem a conferência que foi ligada). O endereço de rede de quem pediu NÃO é
// mandado (o campo remoteip fica de fora) nem guardado; a resposta da Cloudflare também não.
const VERIFICAR = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type ConferenciaDoDesafio = "ok" | "sem_chave" | "recusado";

/** A resposta que o navegador mandou: texto curto, sem espaço nem caractere de controle. */
export function respostaDoDesafio(valor: unknown): string {
  return typeof valor === "string" && /^[!-~]{10,2048}$/.test(valor) ? valor : "";
}

export async function conferirDesafioDaCloudflare(valor: unknown): Promise<ConferenciaDoDesafio> {
  const segredo = process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!segredo) return "sem_chave";
  const resposta = respostaDoDesafio(valor);
  if (!resposta) return "recusado";
  try {
    const corpo = new URLSearchParams({ secret: segredo, response: resposta });
    const r = await fetch(VERIFICAR, { method: "POST", body: corpo, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return "recusado";
    const d = (await r.json().catch(() => null)) as { success?: unknown } | null;
    return d?.success === true ? "ok" : "recusado";
  } catch {
    return "recusado";
  }
}
