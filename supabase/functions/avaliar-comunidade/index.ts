// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Segunda avaliação das mensagens da Comunidade. Roda no serviço de contas (Edge Function), nunca no navegador.
//
// O navegador só diz "avalie a mensagem tal". O texto é buscado no banco com a chave de serviço, vai para o serviço de
// moderação e o resultado volta ao banco, que decide (publicar, barrar ou deixar na fila de revisão). Se qualquer passo
// falhar, a mensagem continua na fila, onde alguém da equipe decide: falha nunca publica.
//
// Segredos (Edge Functions → Secrets): OPENAI_API_KEY e, opcional, GOOGLE_SAFE_BROWSING_KEY (confere os links das
// mensagens; sem ela, mensagem com link vai para a fila). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos.
// Nenhum deles aparece em resposta nem em registro; o texto das mensagens também não é registrado.
import { comLinks, linksPerigosos, moderar } from "./moderacao.mjs";

declare const Deno: { env: { get(nome: string): string | undefined }; serve(tratar: (pedido: Request) => Response | Promise<Response>): void };

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const cabecalhos = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos, "Content-Type": "application/json" } });

async function chamar(funcao: string, argumentos: Record<string, unknown>): Promise<unknown> {
  const resposta = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
    body: JSON.stringify(argumentos),
    signal: AbortSignal.timeout(8000),
  });
  if (!resposta.ok) throw new Error(`${funcao}: ${resposta.status}`);
  return resposta.json();
}

Deno.serve(async (pedido) => {
  if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos });
  if (pedido.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (!base || !servico) return responder({ veredito: "revisar" });

  let tipo: unknown, id: unknown, recuperar: unknown, verificar: unknown;
  try {
    ({ tipo, id, recuperar, verificar } = (await pedido.json()) as { tipo?: unknown; id?: unknown; recuperar?: unknown; verificar?: unknown });
  } catch {
    return responder({ erro: "pedido" }, 400);
  }

  /** Avalia uma mensagem. O banco só entrega o texto de quem está esperando e não está em avaliação neste momento. */
  const avaliar = async (qual: unknown, alvo: unknown): Promise<string> => {
    const pendente = (await chamar("comunidade_para_avaliar", { p_tipo: qual, p_id: alvo })) as { texto?: string } | null;
    if (!pendente?.texto) return "ignorado";
    let resultado = await moderar(pendente.texto, Deno.env.get("OPENAI_API_KEY"));
    // Links: conferidos no Safe Browsing quando há chave; sem chave ou sem resposta, a mensagem com link vai para a fila.
    if (!("erro" in resultado)) resultado = comLinks(resultado, await linksPerigosos(pendente.texto, Deno.env.get("GOOGLE_SAFE_BROWSING_KEY")));
    if ("erro" in resultado) console.error(`avaliar-comunidade: avaliação sem resultado (${resultado.erro})`);
    const decisao = (await chamar("comunidade_avaliada", { p_tipo: qual, p_id: alvo, p_resultado: resultado })) as { veredito?: string } | null;
    return decisao?.veredito ?? "revisar";
  };

  try {
    // Teste de funcionamento, pedido pelo painel: só para a coordenação (o banco confere, com a sessão de quem pediu).
    // Faz uma chamada de verdade ao serviço com um texto fixo e inofensivo e guarda o resultado; não toca em mensagem nenhuma.
    if (verificar === true) {
      const sessao = pedido.headers.get("Authorization") ?? "";
      const autorizado = await fetch(`${base}/rest/v1/rpc/comunidade_controles`, { method: "POST", headers: { apikey: servico, Authorization: sessao, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) });
      if (!autorizado.ok) return responder({ erro: "sem_permissao" }, 403);
      const chave = Deno.env.get("OPENAI_API_KEY");
      const resultado = await moderar("Teste de funcionamento da avaliação da Comunidade.", chave);
      const falha = "erro" in resultado ? resultado.erro : "";
      await chamar("comunidade_verificacao", { p: { chave: Boolean(chave), ok: !falha, falha } });
      return responder({ chave: Boolean(chave), ok: !falha, falha });
    }
    // Recuperação: passa de novo pelo que ficou esperando (navegador fechado, serviço fora do ar). O banco limita a três tentativas por mensagem.
    if (recuperar === true) {
      const lista = (await chamar("comunidade_pendentes", {})) as { tipo: string; id: string }[] | null;
      const contagem: Record<string, number> = {};
      for (const item of Array.isArray(lista) ? lista : []) {
        const veredito = await avaliar(item.tipo, item.id);
        contagem[veredito] = (contagem[veredito] ?? 0) + 1;
      }
      return responder({ recuperadas: contagem });
    }
    if ((tipo !== "topico" && tipo !== "resposta") || typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return responder({ erro: "pedido" }, 400);
    return responder({ veredito: await avaliar(tipo, id) });
  } catch (falha) {
    // Sem o banco, nada muda: a mensagem segue na fila de revisão.
    console.error(`avaliar-comunidade: ${falha instanceof Error ? falha.message : "falha"}`);
    return responder({ veredito: "revisar" });
  }
});
