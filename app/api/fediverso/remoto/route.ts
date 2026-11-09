// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que a tela precisa de gente de FORA, lido pelo servidor (o navegador de quem olha nunca toca a outra instância). Só no modo
// "fediverso-total" (desligado por padrão: 404) e só para quem entrou (token da sessão; teto por pessoa no banco, rede_fed_eu):
//   ?ator=<url> ou ?conta=@nome@instancia  → o perfil (nome, @, bio em texto, avatar pela rota-proxy) e os últimos posts públicos
//                                            (HTML limpo por lista permitida, mídia pela rota-proxy), mais o que o banco sabe
//                                            (rede_fed_perfil_remoto: se a pessoa segue, se bloqueou);
//   ?post=<url>                            → o fio: o post (só público ou não listado), até 5 posts acima dele e as respostas que o
//                                            banco guardou (rede_fed_fio_remoto, que só devolve o que a pessoa pode ver);
//   ?linha=1[&cursor=…&limite=…]           → a linha mista (rede_fed_linha_mista, COMO a pessoa: só o que ela pode ver) com o avatar
//                                            e a mídia já pela rota-proxy assinada.
// Nada de só-seguidores nem de mensagem direta é lido aqui (a linha mista só traz só-seguidores a quem segue o autor, regra do banco).
// A rota NÃO assina URL que a tela manda: só endereço lido de um documento de fora agora mesmo ou guardado pelo banco. Assim ninguém
// usa a rota-proxy de mídia como proxy aberto (o "?midia=" de antes deixava qualquer conta assinar qualquer URL).
import { lerConta } from "@/lib/rede/fediverso/enderecos";
import { dominio, idDe, lerNota, type NotaRecebida } from "@/lib/rede/fediverso/entrada/nota";
import { buscarNaOrigem } from "@/lib/rede/fediverso/entrada/repasse";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { assinarCartao, atorPorConta, banco, buscarDocumento, fed, lerAtorRemoto, modoTotal, semFederacao, urlDaMidia } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
const urlOk = (v: string | null) => (v && /^https:\/\/[^\s<>"']{1,490}$/.test(v) ? v : null);
const bloqueado = (url: string) => banco<boolean>("bloqueado", { url }).catch(() => true);

/** Uma nota lida, no formato da tela: a mídia já pelo proxy, nunca o endereço de fora. */
function paraTela(n: NotaRecebida) {
  return {
    id: n.id,
    url: n.url ?? n.id,
    ator: n.ator,
    html: n.html_limpo,
    texto: n.texto,
    aviso: n.aviso,
    sensivel: n.sensivel,
    publicado: n.publicado,
    em_resposta_a: n.em_resposta_a,
    visibilidade: n.visibilidade,
    midia: n.midia.map((m) => ({ url: urlDaMidia(m.url), tipo: m.tipo, alt: m.alt, largura: m.largura, altura: m.altura, blurhash: m.blurhash })).filter((m) => m.url),
  };
}

/** Os últimos posts públicos (e não listados) de um ator, da primeira página da caixa de saída dele (até 20). */
async function postsDoAtor(atorId: string, doc: Record<string, unknown>) {
  const outbox = typeof doc.outbox === "string" ? doc.outbox : null;
  if (!outbox || dominio(outbox) !== dominio(atorId)) return [];
  const colecao = await buscarDocumento(outbox);
  const primeira = colecao?.first;
  const pagina = typeof primeira === "string" ? (dominio(primeira) === dominio(atorId) ? await buscarDocumento(primeira) : null) : primeira && typeof primeira === "object" ? (primeira as Record<string, unknown>) : colecao;
  const itens = Array.isArray(pagina?.orderedItems) ? (pagina.orderedItems as unknown[]) : [];
  const saida = [];
  for (const item of itens.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (a.type !== "Create" || !a.object || typeof a.object !== "object") continue;
    const lida = lerNota(a.object as Record<string, unknown>, atorId);
    if (!lida.ok || (lida.nota.visibilidade !== "publico" && lida.nota.visibilidade !== "nao_listado")) continue;
    saida.push(paraTela(lida.nota));
    if (saida.length >= 20) break;
  }
  return saida;
}

async function perfil(token: string, atorId: string) {
  if (await bloqueado(atorId)) return resposta({ erro: "instancia_bloqueada" }, 403);
  const doc = await buscarDocumento(atorId);
  const ator = doc ? lerAtorRemoto(doc, atorId) : null;
  if (!doc || !ator) return resposta({ erro: "nao_encontrado" }, 404);
  const [posts, local] = await Promise.all([
    postsDoAtor(ator.ator, doc).catch(() => []),
    chamarComoPessoa<Record<string, unknown>>(token, "rede_fed_perfil_remoto", { p_ator: ator.ator }),
  ]);
  return resposta({
    ator: ator.ator,
    handle: ator.handle,
    nome: ator.nome,
    resumo: ator.resumo,
    url: ator.url,
    avatar: urlDaMidia(ator.avatar),
    tipo: String(doc.type),
    posts,
    local: local.ok ? local.dado : null,
  });
}

async function fio(token: string, postId: string) {
  if (await bloqueado(postId)) return resposta({ erro: "instancia_bloqueada" }, 403);
  const lerPublica = async (id: string) => {
    const { doc } = await buscarNaOrigem(id);
    const autor = doc ? (Array.isArray(doc.attributedTo) ? idDe(doc.attributedTo[0]) : idDe(doc.attributedTo)) : null;
    if (!doc || !autor || (await bloqueado(autor))) return null;
    const lida = lerNota(doc, autor);
    return lida.ok && (lida.nota.visibilidade === "publico" || lida.nota.visibilidade === "nao_listado") ? lida.nota : null;
  };
  const nota = await lerPublica(postId);
  if (!nota) return resposta({ erro: "nao_encontrado" }, 404);
  // Os posts acima (até 5). Um post daqui no meio do fio para a subida: a tela já o tem.
  const acima = [];
  let pai = nota.em_resposta_a;
  for (let i = 0; pai && i < 5; i++) {
    if (pai.startsWith(`${fed.base}/`)) {
      acima.unshift({ local: pai });
      break;
    }
    const n = await lerPublica(pai).catch(() => null);
    if (!n) break;
    acima.unshift(paraTela(n));
    pai = n.em_resposta_a;
  }
  const respostas = await chamarComoPessoa<unknown[]>(token, "rede_fed_fio_remoto", { p_id: nota.id });
  return resposta({ post: paraTela(nota), acima, respostas: respostas.ok && Array.isArray(respostas.dado) ? respostas.dado.map(assinarCartao) : [] });
}

export async function GET(pedido: Request) {
  if (!modoTotal()) return semFederacao();
  const barrado = conferirTeto(pedido, "remoto", 60);
  if (barrado) return barrado;
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const p = new URL(pedido.url).searchParams;

  if (p.has("linha")) {
    const cursor = p.get("cursor");
    const limite = Number(p.get("limite") ?? 20);
    if ((cursor && !/^[^s<>"']{1,700}$/.test(cursor)) || !Number.isInteger(limite) || limite < 1 || limite > 50) return resposta({ erro: "invalido:pedido" }, 400);
    const linha = await chamarComoPessoa<{ itens?: unknown[]; proximo?: string | null }>(token, "rede_fed_linha_mista", { p_cursor: cursor || null, p_limite: limite });
    if (!linha.ok) return resposta({ erro: linha.codigo }, statusDoCodigo(linha.codigo));
    return resposta({ itens: Array.isArray(linha.dado?.itens) ? linha.dado.itens.map(assinarCartao) : [], proximo: linha.dado?.proximo ?? null });
  }

  // A sessão é conferida no banco ANTES de buscar qualquer coisa lá fora (com o teto por pessoa de rede_fed_eu).
  const eu = await chamarComoPessoa<{ perfil: string }>(token, "rede_fed_eu", { p_acao: "remoto" });
  if (!eu.ok) return resposta({ erro: eu.codigo }, statusDoCodigo(eu.codigo));

  const post = urlOk(p.get("post"));
  if (post) return fio(token, post);
  const ator = urlOk(p.get("ator"));
  if (ator) return perfil(token, ator);
  const conta = lerConta(p.get("conta") ?? "");
  if (conta) {
    if (conta.dominio === fed.dominio) return resposta({ local: true, handle: conta.usuario.toLowerCase() });
    if (await bloqueado(`https://${conta.dominio}/`)) return resposta({ erro: "instancia_bloqueada" }, 403);
    const achado = await atorPorConta(conta.usuario, conta.dominio).catch(() => null);
    if (!achado) return resposta({ erro: "nao_encontrado" }, 404);
    return perfil(token, achado.ator);
  }
  return resposta({ erro: "invalido:pedido" }, 400);
}
