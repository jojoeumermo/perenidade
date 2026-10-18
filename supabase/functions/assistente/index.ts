// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Assistente de reforço: responde dúvidas de estudo quando não há voluntário disponível. Roda no serviço de contas
// (Edge Function), nunca no navegador. Chama os provedores na ordem escolhida no painel (Controles do site), com reserva
// automática: Claude (Anthropic, pago por pergunta), Groq, Cerebras, Gemini e OpenRouter (planos gratuitos com limites).
//
// Antes de gastar qualquer centavo, o banco diz "sim" (public.assistente_usar, com a sessão de quem pergunta): conta
// ativa, assistente ligado, área aberta, envios não pausados e vaga nos limites do dia. Pergunta, foto e resposta não
// são guardadas nem registradas; o banco guarda só quantas perguntas cada pessoa fez em cada dia.
//
// Segredos (Edge Functions → Secrets), cada provedor com a sua chave e, opcional, o modelo: ANTHROPIC_API_KEY e
// ASSISTENTE_MODELO; GROQ_API_KEY e GROQ_MODELO; CEREBRAS_API_KEY e CEREBRAS_MODELO; GEMINI_API_KEY e GEMINI_MODELO;
// OPENROUTER_API_KEY e OPENROUTER_MODELO (veja provedores.ts). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos.
// Nenhuma chave aparece em resposta nem em registro.
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { lerResposta, montarPedido, pedidoDeTeste, tipoDeFalha, validarEntrada, type Entrada } from "./assistente.ts";
import { FalhaDoProvedor, IDS, modeloDe, perguntar, PROVEDORES, verificar } from "./provedores.ts";

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

  const chaves = Object.fromEntries(PROVEDORES.map((p) => [p.id, Deno.env.get(p.segredo) ?? ""]));
  const modelos = Object.fromEntries(PROVEDORES.map((p) => [p.id, modeloDe(p, Deno.env.get(p.segredoModelo))]));
  const chave = chaves.anthropic;
  const modelo = modelos.anthropic;
  // Uma nova tentativa no máximo, e um prazo que cabe no tempo de vida da função.
  const cliente = chave ? new Anthropic({ apiKey: chave, maxRetries: 1, timeout: 120_000 }) : null;
  const claude = async (entrada: Entrada, nome: string) => {
    if (!cliente) throw new FalhaDoProvedor("sem_chave");
    try {
      return lerResposta(await cliente.beta.messages.create(montarPedido(entrada, nome)), entrada.modo);
    } catch (erro) {
      throw new FalhaDoProvedor(tipoDeFalha(erro, Anthropic));
    }
  };

  // Teste de funcionamento, pedido pelo painel: só coordenação e vice (o banco confere, com a sessão de quem pediu).
  if (corpo?.verificar === true) {
    const autorizado = await banco("assistente_controles", {}, sessao);
    if (!autorizado.ok) return responder({ erro: "sem_permissao" }, 403);
    // Todos os provedores conhecidos são testados (ligados ou não), para o painel mostrar quem já pode entrar na ordem.
    const provedores = await verificar({
      ids: IDS,
      chaves,
      modelos,
      buscar: fetch,
      claudeTeste: async (nome) => {
        try {
          const lido = lerResposta(await cliente!.beta.messages.create(pedidoDeTeste(nome)));
          return "erro" in lido ? lido.erro : "recusa" in lido ? "recusa" : "";
        } catch (erro) {
          return tipoDeFalha(erro, Anthropic);
        }
      },
    });
    const algum = provedores.find((p) => p.ok);
    const resumo = { chave: provedores.some((p) => p.chave), ok: Boolean(algum), falha: algum ? "" : (provedores.find((p) => p.chave)?.falha ?? "sem_chave"), modelo: algum ? `${algum.id}: ${algum.modelo}` : modelo };
    await banco("assistente_verificacao", { p: { ...resumo, provedores } });
    return responder({ ...resumo, provedores });
  }

  const conferido = validarEntrada(corpo);
  if ("erro" in conferido) return responder({ erro: conferido.erro }, 400);

  const uso = await banco("assistente_usar", {}, sessao);
  if (!uso.ok) return responder({ erro: uso.codigo }, uso.codigo === "entre_primeiro" ? 401 : uso.codigo === "falha" ? 503 : 403);
  const usuario = typeof uso.dados?.usuario === "string" ? uso.dados.usuario : "";
  const restantes = typeof uso.dados?.restantes === "number" ? uso.dados.restantes : null;
  // Falha do serviço devolve a vez da pessoa; o banco anota só se deu certo, quem respondeu e o tipo de falha.
  const config = await banco("assistente_provedores", {});
  const ordem = config.ok && Array.isArray(config.dados?.ordem) ? (config.dados.ordem as string[]) : ["anthropic"];
  const r = await perguntar({ ordem, chaves, modelos, entrada: conferido.entrada, buscar: fetch, claude });
  const falhou = "erro" in r.lido;
  await banco("assistente_resultado", { p: { ok: !falhou, falha: falhou ? (r.lido as { erro: string }).erro : "", provedor: r.provedor, tentativas: r.tentativas, usuario: falhou ? usuario : "" } });
  if (falhou) {
    console.error(`assistente: nenhum provedor respondeu (${r.tentativas.map((t) => `${t.id}:${t.falha}`).join(", ")})`);
    return responder({ erro: r.tentativas.every((t) => t.falha === "sem_chave") ? "assistente_indisponivel" : "assistente_falhou" }, r.tentativas.every((t) => t.falha === "sem_chave") ? 503 : 502);
  }
  return responder({ ...r.lido, restantes, provedor: PROVEDORES.find((p) => p.id === r.provedor)?.nome ?? r.provedor });
});
