// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prévia de link da Rede, gerada no servidor (pacote publicar): quem escreve cola o link, esta rota busca a página (só http/https,
// só portas 80 e 443, DNS conferido na hora de conectar: nada de endereço interno), lê as etiquetas Open Graph e devolve título,
// descrição e uma imagem que passa pelo nosso proxy assinado. O navegador de quem escreve e o de quem lê nunca tocam no site de
// fora. Só para quem é membro da Rede (não é um proxy aberto), com cache e um teto de pedidos por pessoa.
import { buscarSeguro } from "@/lib/rede/publicar/buscar-seguro";
import { enderecoDaImagem, extrairPrevia, urlSegura } from "@/lib/rede/publicar/previa";
import { chamarComoPessoa, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" } });

const cache = new Map<string, { quando: number; previa: unknown }>();
const pedidos = new Map<string, number[]>();
const UMA_HORA = 3_600_000;

export async function GET(pedido: Request) {
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const alvo = urlSegura(new URL(pedido.url).searchParams.get("url") ?? "");
  if (!alvo) return resposta({ erro: "invalido" }, 400);
  const membro = await chamarComoPessoa<boolean>(token, "rede_pub_pode_enviar");
  if (!membro.ok || membro.dado !== true) return resposta({ erro: membro.ok ? "consentimento" : membro.codigo }, membro.ok ? 403 : 401);

  // Teto por pessoa (por instância; o banco também limita o envio de arquivos): 12 prévias por minuto.
  const agora = Date.now();
  const chave = token.slice(-24);
  const recentes = (pedidos.get(chave) ?? []).filter((t) => agora - t < 60_000);
  if (recentes.length >= 12) return resposta({ erro: "muitos_pedidos" }, 429);
  recentes.push(agora);
  pedidos.set(chave, recentes);
  if (pedidos.size > 2000) pedidos.clear();

  const guardada = cache.get(alvo.href);
  if (guardada && agora - guardada.quando < UMA_HORA) return resposta(guardada.previa);
  const busca = await buscarSeguro(alvo.href, { tipos: ["text/html", "application/xhtml+xml"], maxBytes: 400 * 1024, tempoMs: 5000 });
  if (!busca) return resposta({ erro: "indisponivel" }, 404);
  const p = extrairPrevia(new TextDecoder("utf-8", { fatal: false }).decode(busca.corpo), busca.url);
  const saida = { url: p.url, dominio: p.dominio, titulo: p.titulo, descricao: p.descricao, imagem: enderecoDaImagem(p.imagem, process.env.REDE_PREVIA_SEGREDO) ?? undefined };
  if (cache.size > 300) cache.clear();
  cache.set(alvo.href, { quando: agora, previa: saida });
  return resposta(saida);
}
