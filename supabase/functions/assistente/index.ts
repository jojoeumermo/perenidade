// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Assistente de reforço: responde dúvidas de estudo quando não há voluntário disponível. Roda no serviço de contas
// (Edge Function), nunca no navegador, e usa o Claude, da Anthropic, um serviço pago.
//
// Antes de gastar qualquer centavo, o banco diz "sim" (public.assistente_usar, com a sessão de quem pergunta): conta
// ativa, assistente ligado, área aberta, envios não pausados e vaga nos limites do dia. Pergunta, foto e resposta não
// são guardadas nem registradas; o banco guarda só quantas perguntas cada pessoa fez em cada dia.
//
// Segredos (Edge Functions → Secrets): ANTHROPIC_API_KEY e, opcional, ASSISTENTE_MODELO (padrão claude-opus-5-5; veja
// os aceitos em assistente.mjs). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos. Nenhum aparece em resposta nem em registro.
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { escolherModelo, lerResposta, montarPedido, pedidoDeTeste, tipoDeFalha, validarEntrada } from "./assistente.ts";

declare const Deno: { env: { get(nome: string): string | undefined }; serve(tratar: (pedido: Request) => Response | Promise<Response>): void };

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
/** Uma foto reduzida no navegador cabe com folga; acima disso, nem se lê o pedido. */
const TAMANHO_MAXIMO = 3_000_000;

const cabecalhos = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos, "Content-Type": "application/json" } });

/** Chama uma função do banco: com a sessão de quem pediu (o banco confere quem é) ou, sem ela, com a chave de serviço. */
async function banco(funcao: string, argumentos: Record<string, unknown>, sessao?: string): Promise<{ ok: true; dados: Record<string, unknown> | null } | { ok: false; codigo: string }> {
  try {
    const resposta = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: servico, Authorization: sessao ?? `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      signal: AbortSignal.timeout(8000),
    });
    const corpo = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;
    if (resposta.ok) return { ok: true, dados: corpo };
    const mensagem = typeof corpo?.message === "string" ? corpo.message : "";
    return { ok: false, codigo: /^[a-z_]+(:[a-z_]+)?$/.test(mensagem) ? mensagem : "falha" };
  } catch {
    return { ok: false, codigo: "falha" };
  }
}

Deno.serve(async (pedido) => {
  if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos });
  if (pedido.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (!base || !servico) return responder({ erro: "assistente_indisponivel" }, 503);
  const sessao = pedido.headers.get("Authorization") ?? "";
  if (!/^Bearer \S+$/.test(sessao)) return responder({ erro: "entre_primeiro" }, 401);
  if (Number(pedido.headers.get("Content-Length") ?? 0) > TAMANHO_MAXIMO) return responder({ erro: "imagem" }, 413);

  let corpo: Record<string, unknown>;
  try {
    corpo = (await pedido.json()) as Record<string, unknown>;
  } catch {
    return responder({ erro: "pedido" }, 400);
  }

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  const modelo = escolherModelo(Deno.env.get("ASSISTENTE_MODELO"));
  // Uma nova tentativa no máximo, e um prazo que cabe no tempo de vida da função.
  const cliente = chave ? new Anthropic({ apiKey: chave, maxRetries: 1, timeout: 120_000 }) : null;

  // Teste de funcionamento, pedido pelo painel: só coordenação e vice (o banco confere, com a sessão de quem pediu).
  if (corpo?.verificar === true) {
    const autorizado = await banco("assistente_controles", {}, sessao);
    if (!autorizado.ok) return responder({ erro: "sem_permissao" }, 403);
    let falha = "";
    if (!cliente) falha = "sem_chave";
    else {
      try {
        const lido = lerResposta(await cliente.beta.messages.create(pedidoDeTeste(modelo)));
        if ("erro" in lido) falha = lido.erro;
        else if ("recusa" in lido) falha = "recusa";
      } catch (erro) {
        falha = tipoDeFalha(erro, Anthropic);
      }
    }
    await banco("assistente_verificacao", { p: { chave: Boolean(chave), ok: !falha, falha, modelo } });
    return responder({ chave: Boolean(chave), ok: !falha, falha, modelo });
  }

  const conferido = validarEntrada(corpo);
  if ("erro" in conferido) return responder({ erro: conferido.erro }, 400);

  const uso = await banco("assistente_usar", {}, sessao);
  if (!uso.ok) return responder({ erro: uso.codigo }, uso.codigo === "entre_primeiro" ? 401 : uso.codigo === "falha" ? 503 : 403);
  const usuario = typeof uso.dados?.usuario === "string" ? uso.dados.usuario : "";
  const restantes = typeof uso.dados?.restantes === "number" ? uso.dados.restantes : null;
  // Falha do serviço devolve a vez da pessoa; o banco anota só se deu certo e o tipo de falha.
  const anotar = (ok: boolean, falha = "") => banco("assistente_resultado", { p: { ok, falha, usuario: ok ? "" : usuario } });

  if (!cliente) {
    await anotar(false, "sem_chave");
    return responder({ erro: "assistente_indisponivel" }, 503);
  }
  try {
    const lido = lerResposta(await cliente.beta.messages.create(montarPedido(conferido.entrada, modelo)), conferido.entrada.modo);
    if ("erro" in lido) {
      console.error(`assistente: resposta sem proveito (${lido.erro})`);
      await anotar(false, lido.erro);
      return responder({ erro: "assistente_falhou" }, 502);
    }
    await anotar(true);
    return responder({ ...lido, restantes });
  } catch (erro) {
    const falha = tipoDeFalha(erro, Anthropic);
    console.error(`assistente: falha na chamada (${falha})`);
    await anotar(false, falha);
    return responder({ erro: "assistente_falhou" }, 502);
  }
});
