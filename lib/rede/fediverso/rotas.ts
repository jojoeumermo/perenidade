// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as rotas da federação (app/api/fediverso/** e app/.well-known/**) têm em comum: o teto de pedidos por endereço de rede,
// a resposta para navegador (quem abre o endereço de um ator ou post no navegador vai para a página de gente) e a leitura do
// corpo com tamanho máximo. Só roda no servidor. Sem "@/".
import { after } from "next/server";
import { lerCorpoLimitado } from "../publicar/servidor";
import { receber, type DestinoDaCaixa } from "./caixa";
import { processarFila } from "./entrega";
import { atorComChaves, federacaoLigada, muitosPedidos, origemDe, permitir, semFederacao } from "./servidor";

/** Quem pede quer HTML (um navegador), e não o documento ActivityPub? */
export function querHtml(pedido: Request): boolean {
  const aceita = pedido.headers.get("accept") ?? "";
  return /text\/html/i.test(aceita) && !/application\/(activity\+json|ld\+json)/i.test(aceita);
}

/**
 * Antes de pôr na fila algo que sai assinado pela pessoa (seguir, curtir, impulsionar, responder): ela federa DE VERDADE (o banco,
 * na ação "ator", só diz "ligado" a quem está ligado e sem impedimento; quem desligou a federação no perfil fica de fora, mesmo no
 * modo total: seguir de fora revela o @ dela à outra instância, LGPD art. 33, VIII, e o desligar continua valendo, D2) e tem o par
 * de chaves (gerado aqui na primeira vez; sem isso o item sairia da fila como "sem_chave" e a ação sumiria sem aviso).
 * "ok"; "desligado" (409 para a tela); "falha" (o banco ou a chave falharam: 503).
 */
export async function pessoaFederada(handle: string | null | undefined): Promise<"ok" | "desligado" | "falha"> {
  if (!handle) return "desligado";
  const a = await atorComChaves(handle).catch(() => undefined);
  if (a === undefined) return "falha";
  if (!a || a.estado !== "ligado") return "desligado";
  return a.privada ? "ok" : "falha";
}

/** A resposta da tela para pessoaFederada quando não deu "ok". */
export const recusaDaFederacao = (r: "desligado" | "falha") =>
  Response.json(r === "desligado" ? { erro: "fediverso_desligado" } : { erro: "falha" }, { status: r === "desligado" ? 409 : 503, headers: { "Cache-Control": "private, no-store" } });

/** O teto de leituras por endereço de rede: 120 por minuto por rota (nada é guardado; a memória é da instância do servidor). */
export function conferirTeto(pedido: Request, rota: string, max = 120): Response | null {
  if (!federacaoLigada()) return semFederacao();
  return permitir(`${rota}:${origemDe(pedido)}`, max) ? null : muitosPedidos();
}

/** Uma caixa de entrada (a de uma pessoa ou a compartilhada): confere tudo e responde 202, 400, 401, 403 ou 413. */
export async function caixaDeEntrada(pedido: Request, destino: DestinoDaCaixa = {}): Promise<Response> {
  const barrado = conferirTeto(pedido, "inbox", 300);
  if (barrado) return barrado;
  const tipo = pedido.headers.get("content-type") ?? "";
  if (!/application\/(activity\+json|ld\+json|json)/i.test(tipo)) return new Response("Unsupported Media Type", { status: 415 });
  const corpo = await lerCorpoLimitado(pedido, 256 * 1024);
  if (!corpo) return new Response("Payload Too Large", { status: 413 });
  const url = new URL(pedido.url);
  let r;
  try {
    r = await receber("POST", `${url.pathname}${url.search}`, (nome) => pedido.headers.get(nome), corpo, destino);
  } catch {
    return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "120" } });
  }
  // Um Accept novo na fila sai já, sem esperar a rotina agendada (em segundo plano: a resposta não espera a entrega).
  if (r.entregar) after(() => processarFila(10).then(() => undefined, () => undefined));
  return new Response(r.status < 300 ? "" : r.motivo, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
