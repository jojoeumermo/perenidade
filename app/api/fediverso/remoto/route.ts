// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que a tela precisa de gente de FORA, lido pelo servidor (o navegador de quem olha nunca toca a outra instância). Só no modo
// "fediverso-total" (desligado por padrão: 404) e só para quem entrou (token da sessão; teto por pessoa no banco, rede_fed_eu):
//   ?ator=<url> ou ?conta=@nome@instancia  → o perfil (nome, @, bio em texto, avatar pela rota-proxy) e os últimos posts públicos
//                                            (HTML limpo por lista permitida, mídia pela rota-proxy), mais o que o banco sabe
//                                            (rede_fed_perfil_remoto: se a pessoa segue, se bloqueou);
//   ?post=<url>                            → o fio {post, acima, respostas}. Se o banco guarda a nota, vem tudo dele
//                                            (rede_fed_fio_remoto, que só devolve o que a pessoa pode ver); senão o post (só
//                                            público ou não listado) e até 5 acima são lidos na origem agora, sem respostas;
//   ?linha=1[&cursor=…&limite=…]           → a linha mista (rede_fed_linha_mista, COMO a pessoa: só o que ela pode ver) com o avatar
//                                            e a mídia já pela rota-proxy assinada.
// Todo post de fora sai no MESMO formato de cartão do banco (interno.rede_fed_cartao); o lido agora na origem leva "ao_vivo": true
// e os campos que não se sabe, neutros. Post DAQUI no meio do fio sai como { local: <id>, post: <cartão daqui> }.
// Nada de só-seguidores nem de mensagem direta é lido aqui (a linha mista só traz só-seguidores a quem segue o autor, regra do banco).
// A rota NÃO assina URL que a tela manda: só endereço lido de um documento de fora agora mesmo ou guardado pelo banco. Assim ninguém
// usa a rota-proxy de mídia como proxy aberto (o "?midia=" de antes deixava qualquer conta assinar qualquer URL).
import { lerConta } from "@/lib/rede/fediverso/enderecos";
import { dominio, idDe, lerNota, postLocal, type NotaRecebida } from "@/lib/rede/fediverso/entrada/nota";
import { buscarNaOrigem } from "@/lib/rede/fediverso/entrada/repasse";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { assinarCartao, atorPorConta, atorRemoto, banco, buscarDocumento, fed, lerAtorRemoto, modoTotal, semFederacao, urlDaMidia, type AtorRemoto } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
const urlOk = (v: string | null) => (v && /^https:\/\/[^\s<>"']{1,490}$/.test(v) ? v : null);
const bloqueado = (url: string) => banco<boolean>("bloqueado", { url }).catch(() => true);

type Cartao = Record<string, unknown>;
type Autor = Pick<AtorRemoto, "handle" | "nome" | "avatar"> | null;

/**
 * Uma nota lida agora na origem, no formato de cartão do banco (interno.rede_fed_cartao): as mesmas chaves, neutras onde não se
 * sabe (contagens, se curti), a mídia e o avatar já pelo proxy. "ao_vivo" avisa a tela: o banco não a guarda (não dá para curtir).
 */
function cartaoAoVivo(n: NotaRecebida, autor: Autor): Cartao {
  const servidor = dominio(n.ator);
  const handle = autor?.handle ?? null;
  const nome = autor?.nome ?? null;
  return {
    id: n.id, origem: "fediverso", tipo: "post", titulo: null, texto: n.texto, html: n.html_limpo,
    corpo: null, longo: false, comunidade: null, flair: null,
    publico: "internet", visibilidade: n.visibilidade,
    criado_em: n.publicado ?? new Date().toISOString(), editado_em: null,
    fixado: false, travado: false, aceita: null, verificada: false,
    resposta_a: n.em_resposta_a, raiz: n.contexto ?? n.id, nivel: 0,
    aviso: n.aviso, sensivel: n.sensivel || n.aviso !== "", cita: null, chamado: null,
    meu: false, retido: false, motivo: "", modero: false,
    autor: { id: null, codinome: nome || handle || servidor, handle, perfil: false, equipe: false, remoto: true },
    ator_remoto: n.ator, handle_remoto: handle, nome_remoto: nome, avatar: urlDaMidia(autor?.avatar),
    servidor, url: n.url ?? n.id,
    respostas: 0, na_conversa: null, util: 0, util_eu: false, apoios: null,
    curti: false, impulsionei: false, apoiei: false, salvei: false, vou: null, vou_eu: false,
    midia: n.midia.map((m) => ({ url: urlDaMidia(m.url), tipo: m.tipo, alt: m.alt, largura: m.largura, altura: m.altura, blurhash: m.blurhash })).filter((m) => m.url),
    citado: null, post_local: null, impulsionado_por: null, ao_vivo: true,
  };
}

const eCartao = (v: unknown): v is Cartao => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const deFora = (c: Cartao) => c.origem === "fediverso";
/** Um item do fio que veio do banco: o de fora, assinado; o daqui, embrulhado com o id (a tela o mostra com o cartão de sempre). */
const itemDoFio = (v: unknown) => (!eCartao(v) ? null : deFora(v) ? assinarCartao(v) : typeof v.id === "string" ? { local: v.id, post: v } : null);
const itensDoFio = (v: unknown) => (Array.isArray(v) ? v.map(itemDoFio).filter(Boolean) : []);

/** Os últimos posts públicos (e não listados) de um ator, da primeira página da caixa de saída dele (até 20). */
async function postsDoAtor(atorId: string, doc: Record<string, unknown>, autor: Autor) {
  const outbox = typeof doc.outbox === "string" ? doc.outbox : null;
  if (!outbox || dominio(outbox) !== dominio(atorId)) return [];
  const colecao = await buscarDocumento(outbox);
  const primeira = colecao?.first;
  const pagina = typeof primeira === "string" ? (dominio(primeira) === dominio(atorId) ? await buscarDocumento(primeira) : null) : primeira && typeof primeira === "object" ? (primeira as Record<string, unknown>) : colecao;
  const itens = Array.isArray(pagina?.orderedItems) ? (pagina.orderedItems as unknown[]) : [];
  const saida: Cartao[] = [];
  for (const item of itens.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (a.type !== "Create" || !a.object || typeof a.object !== "object") continue;
    const lida = lerNota(a.object as Record<string, unknown>, atorId);
    if (!lida.ok || (lida.nota.visibilidade !== "publico" && lida.nota.visibilidade !== "nao_listado")) continue;
    saida.push(cartaoAoVivo(lida.nota, autor));
    if (saida.length >= 20) break;
  }
  return saida;
}

async function perfil(token: string, atorId: string) {
  if (await bloqueado(atorId)) return resposta({ erro: "instancia_bloqueada" }, 403);
  const doc = await buscarDocumento(atorId);
  const ator = doc ? lerAtorRemoto(doc, atorId) : null;
  if (!doc || !ator) return resposta({ erro: "nao_encontrado" }, 404);
  const [aoVivo, guardado] = await Promise.all([
    postsDoAtor(ator.ator, doc, ator).catch(() => [] as Cartao[]),
    chamarComoPessoa<Cartao>(token, "rede_fed_perfil_remoto", { p_ator: ator.ator }),
  ]);
  // O que o banco sabe (se a pessoa segue, se bloqueou) e os posts que ele guarda, tudo já pelo proxy. Os posts saem numa lista só:
  // o cartão do banco (com "curti" e as contagens) ganha do lido agora; o que só o banco tem (só-seguidores de quem se segue) entra.
  const { posts: doBanco, ...local } = guardado.ok && eCartao(guardado.dado) ? assinarCartao(guardado.dado) : ({} as Cartao);
  const porId = new Map<string, Cartao>();
  for (const c of Array.isArray(doBanco) ? doBanco.filter(eCartao) : []) if (typeof c.id === "string") porId.set(c.id, c);
  const vistos = new Set<string>();
  const posts = aoVivo.map((c) => {
    vistos.add(String(c.id));
    return porId.get(String(c.id)) ?? c;
  });
  for (const [id, c] of porId) if (!vistos.has(id)) posts.push(c);
  posts.sort((a, b) => Date.parse(String(b.criado_em)) - Date.parse(String(a.criado_em)) || 0);
  return resposta({
    ator: ator.ator,
    handle: ator.handle,
    nome: ator.nome,
    resumo: ator.resumo,
    url: ator.url,
    avatar: urlDaMidia(ator.avatar),
    tipo: String(doc.type),
    servidor: dominio(ator.ator),
    posts: posts.slice(0, 40),
    local: guardado.ok && eCartao(guardado.dado) ? local : null,
  });
}

/** O fio como o banco o guarda (nulo se o banco não tem a nota ou a pessoa não pode vê-la). */
async function fioDoBanco(token: string, id: string) {
  const r = await chamarComoPessoa<{ post?: unknown; acima?: unknown; respostas?: unknown }>(token, "rede_fed_fio_remoto", { p_id: id });
  if (!r.ok || !eCartao(r.dado) || !eCartao(r.dado.post) || !deFora(r.dado.post)) return null;
  return { post: assinarCartao(r.dado.post), acima: itensDoFio(r.dado.acima), respostas: itensDoFio(r.dado.respostas) };
}

async function fio(token: string, postId: string) {
  if (await bloqueado(postId)) return resposta({ erro: "instancia_bloqueada" }, 403);
  const guardado = await fioDoBanco(token, postId);
  if (guardado) return resposta(guardado);
  const lerPublica = async (id: string) => {
    const { doc } = await buscarNaOrigem(id);
    const autor = doc ? (Array.isArray(doc.attributedTo) ? idDe(doc.attributedTo[0]) : idDe(doc.attributedTo)) : null;
    if (!doc || !autor || (await bloqueado(autor))) return null;
    const lida = lerNota(doc, autor);
    return lida.ok && (lida.nota.visibilidade === "publico" || lida.nota.visibilidade === "nao_listado") ? lida.nota : null;
  };
  const nota = await lerPublica(postId);
  if (!nota) return resposta({ erro: "nao_encontrado" }, 404);
  const autorDe = (n: NotaRecebida) => atorRemoto(n.ator).catch(() => null);
  // Os posts acima (até 5). Um post daqui no meio do fio para a subida: a tela o busca pelo id.
  const acima: unknown[] = [];
  let pai = nota.em_resposta_a;
  for (let i = 0; pai && i < 5; i++) {
    if (pai.startsWith(`${fed.base}/`)) {
      const local = postLocal(pai);
      if (local) acima.unshift({ local });
      break;
    }
    const n = await lerPublica(pai).catch(() => null);
    if (!n) break;
    acima.unshift(cartaoAoVivo(n, await autorDe(n)));
    pai = n.em_resposta_a;
  }
  return resposta({ post: cartaoAoVivo(nota, await autorDe(nota)), acima, respostas: [] });
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
    if ((cursor && !/^[^\s<>"']{1,700}$/.test(cursor)) || !Number.isInteger(limite) || limite < 1 || limite > 50) return resposta({ erro: "invalido:pedido" }, 400);
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
