// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as rotas da federação (app/api/fediverso/** e app/.well-known/**) têm em comum: o teto de pedidos por endereço de rede,
// a resposta para navegador (quem abre o endereço de um ator ou post no navegador vai para a página de gente) e a leitura do
// corpo com tamanho máximo. Só roda no servidor. Sem "@/".
import { after } from "next/server";
import { lerCorpoLimitado } from "../publicar/servidor";
import { receber } from "./caixa";
import { processarFila } from "./entrega";
import { federacaoLigada, muitosPedidos, origemDe, permitir, semFederacao } from "./servidor";

/** Quem pede quer HTML (um navegador), e não o documento ActivityPub? */
export function querHtml(pedido: Request): boolean {
  const aceita = pedido.headers.get("accept") ?? "";
  return /text\/html/i.test(aceita) && !/application\/(activity\+json|ld\+json)/i.test(aceita);
}

/** O teto de leituras por endereço de rede: 120 por minuto por rota (nada é guardado; a memória é da instância do servidor). */
export function conferirTeto(pedido: Request, rota: string, max = 120): Response | null {
  if (!federacaoLigada()) return semFederacao();
  return permitir(`${rota}:${origemDe(pedido)}`, max) ? null : muitosPedidos();
}

/** Uma caixa de entrada (a de uma pessoa ou a compartilhada): confere tudo e responde 202, 400, 401, 403 ou 413. */
export async function caixaDeEntrada(pedido: Request): Promise<Response> {
  const barrado = conferirTeto(pedido, "inbox", 300);
  if (barrado) return barrado;
  const tipo = pedido.headers.get("content-type") ?? "";
  if (!/application\/(activity\+json|ld\+json|json)/i.test(tipo)) return new Response("Unsupported Media Type", { status: 415 });
  const corpo = await lerCorpoLimitado(pedido, 256 * 1024);
  if (!corpo) return new Response("Payload Too Large", { status: 413 });
  const url = new URL(pedido.url);
  let r;
  try {
    r = await receber("POST", `${url.pathname}${url.search}`, (nome) => pedido.headers.get(nome), corpo);
  } catch {
    return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "120" } });
  }
  // Um Accept novo na fila sai já, sem esperar a rotina agendada (em segundo plano: a resposta não espera a entrega).
  if (r.entregar) after(() => processarFila(10).then(() => undefined, () => undefined));
  return new Response(r.status < 300 ? "" : r.motivo, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
