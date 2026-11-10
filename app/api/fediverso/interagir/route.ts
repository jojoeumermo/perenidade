// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Curtir ou impulsionar um post de FORA (e desfazer). Só no modo "fediverso-total" (desligado por padrão: 404). Quem pede entra com
// o token da sessão; a função do banco (rede_fed_interagir, contrato 3.2) roda COMO a pessoa: confere quem é, o teto por pessoa, a
// instância bloqueada, e põe o Like/Announce (ou o Undo) na fila, que sai assinado pela pessoa. Sai para fora só o @nome público
// dela e o endereço do post curtido (LGPD art. 7º, I: o consentimento da federação; art. 33, VIII: a transferência é o próprio ato).
import { after } from "next/server";
import { processarFila } from "@/lib/rede/fediverso/entrega";
import { conferirTeto, pessoaFederada, recusaDaFederacao } from "@/lib/rede/fediverso/rotas";
import { modoTotal, semFederacao } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });

export async function POST(pedido: Request) {
  if (!modoTotal()) return semFederacao();
  const barrado = conferirTeto(pedido, "interagir", 60);
  if (barrado) return barrado;
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { post?: unknown; tipo?: unknown; sim?: unknown } | null;
  const post = typeof corpo?.post === "string" && /^https:\/\/[^\s<>"']{1,490}$/.test(corpo.post) ? corpo.post : null;
  if (!post) return resposta({ erro: "invalido:post" }, 400);
  const tipo = corpo?.tipo === "like" || corpo?.tipo === "announce" ? corpo.tipo : null;
  if (!tipo) return resposta({ erro: "invalido:tipo" }, 400);
  const sim = corpo?.sim !== false;
  // Quem desligou a federação (ou tem impedimento) não manda nada para fora; quem federa ganha o par de chaves antes da fila.
  const eu = await chamarComoPessoa<{ handle?: string | null; ligado?: boolean }>(token, "rede_fed_eu", { p_acao: "interagir" });
  if (!eu.ok) return resposta({ erro: eu.codigo }, statusDoCodigo(eu.codigo));
  if (!eu.dado.ligado) return resposta({ erro: "fediverso_desligado" }, 409);
  const federada = await pessoaFederada(eu.dado.handle);
  if (federada !== "ok") return recusaDaFederacao(federada);
  const r = await chamarComoPessoa<{ ok?: boolean; curti?: boolean; impulsionei?: boolean }>(token, "rede_fed_interagir", { p_post_remoto: post, p_tipo: tipo, p_sim: sim });
  if (!r.ok) return resposta({ erro: r.codigo }, statusDoCodigo(r.codigo));
  after(() => processarFila(10).then(() => undefined, () => undefined));
  // O estado de verdade depois da ação (o banco é quem sabe: um pedido repetido não muda nada).
  return resposta({ ok: true, tipo, sim, curti: r.dado?.curti === true, impulsionei: r.dado?.impulsionei === true });
}
