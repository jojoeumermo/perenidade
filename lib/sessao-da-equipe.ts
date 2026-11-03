// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem está pedindo, para as rotas /api do servidor que não são para qualquer visitante. O navegador manda o token da
// sessão (Authorization: Bearer <access_token>, o mesmo que o painel já usa com o banco) e o próprio banco responde, pela
// função "equipe_sessao" (supabase/migracoes/2026-11-seguranca.sql). A regra de "ser da equipe" é a mesma da transcrição
// automática: ter ao menos uma função no painel.
//
// Não usa a função "eu" de propósito: ela grava no perfil a origem de quem chama, e daqui quem chama é o servidor, não a
// pessoa (a origem gravada seria a do servidor, e o banimento por origem pegaria o endereço errado). "equipe_sessao" só lê.
// Sem a função no banco (antes de rodar a migração), ninguém passa: a checagem falha fechada.
// Nada daqui guarda o token nem registra quem pediu. Só as rotas do servidor importam este arquivo.
import { rpcNoBanco } from "@/lib/instagram";

export interface QuemPede {
  /** Tem conta ativa e mandou uma sessão válida. */
  conta: boolean;
  /** Tem ao menos uma função no painel. */
  equipe: boolean;
}

const NINGUEM: QuemPede = { conta: false, equipe: false };

/** O token do cabeçalho Authorization, só se tiver o formato de um JWT (três partes em base64url). */
export function tokenDoPedido(pedido: Request): string | null {
  const token = /^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/.exec(pedido.headers.get("authorization")?.trim() ?? "")?.[1];
  return token ?? null;
}

/** Pergunta ao banco quem mandou o pedido. Sem token, com token vencido ou com o banco fora do ar: ninguém. */
export async function quemPede(pedido: Request): Promise<QuemPede> {
  const token = tokenDoPedido(pedido);
  if (!token) return NINGUEM;
  const resposta = await rpcNoBanco<{ conta?: unknown; equipe?: unknown } | null>("equipe_sessao", {}, token);
  if (!resposta.ok || !resposta.dados || typeof resposta.dados !== "object") return NINGUEM;
  const conta = resposta.dados.conta === true;
  return { conta, equipe: conta && resposta.dados.equipe === true };
}

/** A pessoa tem função no painel? */
export async function daEquipe(pedido: Request): Promise<boolean> {
  return (await quemPede(pedido)).equipe;
}

/**
 * Resposta JSON das rotas que dependem de quem pediu: nunca guardada no intermediário (Cloudflare, Vercel). Se a resposta
 * fosse "public, s-maxage", a borda guardaria pelo endereço e entregaria a quem nem mandou sessão, o que anularia a checagem.
 * O que vem de fora continua guardado do lado do servidor, pelo "revalidate" de lib/externo.ts.
 */
export function respostaPrivada(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
      "X-Robots-Tag": "noindex",
    },
  });
}

/** O pedido sem sessão da equipe: 401 sem guardar nada. */
export const soDaEquipe = () => respostaPrivada({ erro: "entre_primeiro" }, 401);
