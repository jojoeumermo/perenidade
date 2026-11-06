// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Achar alguém do Fediverso pelo endereço (@nome@instancia): o servidor pergunta à instância (WebFinger), lê o perfil público e os
// últimos posts PÚBLICOS (só texto: sem HTML, sem imagem, sem script) e devolve à tela. O navegador de quem busca nunca toca a outra
// instância (ela não fica sabendo quem olhou). Só para quem entrou na Alumia, com teto por pessoa no banco (rede_fed_eu).
import { lerConta } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { atorPorConta, banco, buscarDocumento, fed } from "@/lib/rede/fediverso/servidor";
import { htmlParaTexto, textoCurto } from "@/lib/rede/fediverso/texto";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
const PUBLICO = ["https://www.w3.org/ns/activitystreams#Public", "as:Public", "Public"];
const lista = (v: unknown) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).map((x) => (typeof x === "string" ? x : typeof x === "object" && x && "id" in x ? String((x as { id: unknown }).id) : ""));

/** Os últimos posts públicos de um ator remoto (até 10), lidos da primeira página da caixa de saída dele. */
async function postsPublicos(atorId: string): Promise<{ id: string; url: string | null; texto: string; aviso: string; publicado: string | null }[]> {
  const ator = await buscarDocumento(atorId);
  const outbox = typeof ator?.outbox === "string" ? ator.outbox : null;
  if (!outbox || new URL(outbox).host !== new URL(atorId).host) return [];
  const colecao = await buscarDocumento(outbox);
  const primeira = colecao?.first;
  const pagina = typeof primeira === "string" ? await buscarDocumento(primeira) : primeira && typeof primeira === "object" ? (primeira as Record<string, unknown>) : colecao;
  const itens = Array.isArray(pagina?.orderedItems) ? (pagina.orderedItems as unknown[]) : [];
  const saida = [];
  for (const item of itens.slice(0, 30)) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (a.type !== "Create" || !a.object || typeof a.object !== "object") continue;
    const nota = a.object as Record<string, unknown>;
    if (nota.type !== "Note" && nota.type !== "Article") continue;
    if (!lista(nota.to).concat(lista(nota.cc)).some((x) => PUBLICO.includes(x))) continue;
    const id = typeof nota.id === "string" ? nota.id : "";
    if (!/^https:\/\//.test(id) || new URL(id).host !== new URL(atorId).host) continue;
    const texto = htmlParaTexto(typeof nota.content === "string" ? nota.content : "", 1000);
    if (!texto) continue;
    const url = typeof nota.url === "string" && /^https:\/\//.test(nota.url) ? nota.url : id;
    saida.push({ id, url, texto, aviso: textoCurto(nota.summary, 200), publicado: typeof nota.published === "string" ? nota.published : null });
    if (saida.length >= 10) break;
  }
  return saida;
}

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "buscar", 30);
  if (barrado) return barrado;
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const eu = await chamarComoPessoa<{ perfil: string; handle: string | null; ligado: boolean }>(token, "rede_fed_eu", { p_acao: "buscar" });
  if (!eu.ok) return resposta({ erro: eu.codigo }, statusDoCodigo(eu.codigo));
  const conta = lerConta(new URL(pedido.url).searchParams.get("conta") ?? "");
  if (!conta) return resposta({ erro: "invalido:conta" }, 400);
  // Alguém daqui: a tela leva direto ao perfil na Alumia.
  if (conta.dominio === fed.dominio) return resposta({ local: true, handle: conta.usuario.toLowerCase() });
  if (await banco<boolean>("bloqueado", { url: `https://${conta.dominio}/` }).catch(() => false)) return resposta({ erro: "instancia_bloqueada" }, 403);
  const ator = await atorPorConta(conta.usuario, conta.dominio).catch(() => null);
  if (!ator) return resposta({ erro: "nao_encontrado" }, 404);
  const [posts, seguindo] = await Promise.all([
    postsPublicos(ator.ator).catch(() => []),
    chamarComoPessoa<{ ator: string; aceito: boolean }[]>(token, "rede_fed_seguindo_lista"),
  ]);
  const meu = seguindo.ok ? seguindo.dado.find((s) => s.ator === ator.ator) : undefined;
  return resposta({
    ator: ator.ator,
    handle: ator.handle,
    nome: ator.nome,
    resumo: ator.resumo,
    url: ator.url,
    posts,
    seguindo: meu ? (meu.aceito ? "sim" : "pedido") : "nao",
    ligado: eu.dado.ligado,
  });
}
