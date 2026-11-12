// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que a tela precisa de gente de FORA, lido pelo servidor (o navegador de quem olha nunca toca a outra instância). Só no modo
// "fediverso-total" (desligado por padrão: 404) e só para quem entrou (token da sessão; teto por pessoa no banco, rede_fed_eu):
//   ?ator=<url> ou ?conta=@nome@instancia  → o perfil (nome, @, bio em texto, avatar pela rota-proxy) e os últimos posts públicos
//                                            (HTML limpo por lista permitida, mídia pela rota-proxy), mais o que o banco sabe
//                                            (rede_fed_perfil_remoto: se a pessoa segue, se bloqueou). O que é lido lá fora fica
//                                            5 minutos na memória do servidor. Se a pessoa de fora bloqueou quem pede, o banco
//                                            devolve "bloqueou_voce" e a rota manda só o cabeçalho: nada de posts (nem os lidos
//                                            agora) e a tela não mostra "seguir". Se o banco recusa, a rota recusa também.
//                                            Com &cursor=<proximo>: só a página seguinte dos posts GUARDADOS ({ posts, proximo }),
//                                            sem ler nada lá fora;
//   ?post=<url>[&buscar=1]                 → o fio {post, acima, respostas}. Se o banco guarda a nota, vem tudo dele
//                                            (rede_fed_fio_remoto, que só devolve o que a pessoa pode ver). Senão a rota responde
//                                            "so_na_origem" e NÃO busca nada: só com buscar=1 (um toque da pessoa na tela) o post
//                                            (só público ou não listado) e até 5 acima são lidos na origem, sem respostas, e
//                                            nunca de quem bloqueou a pessoa lá fora (bloqueouQuemPede). Assim
//                                            um link armado não faz o servidor bater num endereço qualquer só por ser aberto;
//   ?linha=1[&cursor=…&limite=…]           → a linha mista (rede_fed_linha_mista, COMO a pessoa: só o que ela pode ver) com o avatar
//                                            e a mídia já pela rota-proxy assinada;
//   ?respostas=<id do post daqui>[&cursor=…] → as respostas de fora a um post DAQUI (rede_fed_respostas_de, COMO a pessoa), cada
//                                            uma em cartão e pelo proxy: { itens, proximo, total }.
// Todo post de fora sai no MESMO formato de cartão do banco (interno.rede_fed_cartao); o lido agora na origem leva "ao_vivo": true
// e os campos que não se sabe, neutros. Post DAQUI no meio do fio sai como { local: <id>, post: <cartão daqui> }.
// Nada de só-seguidores nem de mensagem direta é lido aqui (a linha mista só traz só-seguidores a quem segue o autor, regra do banco).
// A rota NÃO assina URL que a tela manda: só endereço lido de um documento de fora agora mesmo ou guardado pelo banco. Assim ninguém
// usa a rota-proxy de mídia como proxy aberto (o "?midia=" de antes deixava qualquer conta assinar qualquer URL).
import { lerConta } from "@/lib/rede/fediverso/enderecos";
import { dominio, idDe, lerNota, postLocal, type NotaRecebida } from "@/lib/rede/fediverso/entrada/nota";
import { buscarNaOrigem } from "@/lib/rede/fediverso/entrada/repasse";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { assinarCartao, atorPorConta, atorRemoto, banco, buscarDocumento, codigoParaATela, fed, lembrar, lerAtorRemoto, modoTotal, semFederacao, urlDaMidia, type AtorRemoto } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
const urlOk = (v: string | null) => (v && /^https:\/\/[^\s<>"']{1,490}$/.test(v) ? v : null);
const bloqueado = (url: string) => banco<boolean>("bloqueado", { url }).catch(() => true);
/** A recusa que vai para a tela: só o código da casa (a mensagem crua do banco vira "falha"). */
const recusa = (codigo: string) => resposta({ erro: codigoParaATela(codigo) }, codigo === "nao_encontrado" ? 404 : statusDoCodigo(codigo));
// O cursor é o que o banco devolveu em "proximo": "<data e hora>|<chave>". A data vem como texto do banco, COM espaço
// ("2026-11-10 12:34:56.789+00|https://…"); só ficam de fora os caracteres de controle e os de marcação.
const CURSOR = /^[^<>"'\u0000-\u001f\u007f]{1,700}$/;
const ID_DAQUI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEMORIA_MS = 5 * 60_000;

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
    silenciado: false, bloqueado: false, bloqueou_voce: false,
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

interface PerfilLido {
  ator: AtorRemoto;
  tipo: string;
  posts: Cartao[];
}

/** O perfil e os últimos posts, lidos agora na origem. O banco passa a conhecer o ator (é o que rede_fed_perfil_remoto consulta). */
async function lerPerfil(atorId: string): Promise<PerfilLido | null> {
  const doc = await buscarDocumento(atorId);
  const ator = doc ? lerAtorRemoto(doc, atorId) : null;
  if (!doc || !ator) return null;
  const tipo = String(doc.type);
  const [posts] = await Promise.all([
    postsDoAtor(ator.ator, doc, ator).catch(() => [] as Cartao[]),
    banco("remoto_salvar", { ator: ator.ator, chave_id: ator.chave_id, chave_publica: ator.chave_publica, inbox: ator.inbox, compartilhada: ator.inbox_compartilhada, handle: ator.handle, nome: ator.nome, resumo: ator.resumo, url: ator.url, avatar: ator.avatar ?? null, tipo }).catch(() => undefined),
  ]);
  return { ator, tipo, posts };
}

/** A página seguinte dos posts que o banco guarda de um perfil de fora (nada é lido lá fora). */
async function maisDoPerfil(token: string, atorId: string, cursor: string) {
  if (await bloqueado(atorId)) return resposta({ erro: "instancia_bloqueada" }, 403);
  const r = await chamarComoPessoa<Cartao>(token, "rede_fed_perfil_remoto", { p_ator: atorId, p_cursor: cursor, p_limite: 20 });
  if (!r.ok || !eCartao(r.dado)) return recusa(r.ok ? "falha" : r.codigo);
  const pagina = assinarCartao(r.dado);
  const posts = pagina.bloqueou_voce === true || !Array.isArray(pagina.posts) ? [] : pagina.posts.filter((c): c is Cartao => eCartao(c) && deFora(c));
  return resposta({ posts, proximo: typeof pagina.proximo === "string" && pagina.proximo ? pagina.proximo : null });
}

async function perfil(token: string, atorId: string) {
  if (await bloqueado(atorId)) return resposta({ erro: "instancia_bloqueada" }, 403);
  // O que vem de fora fica uns minutos na memória: reabrir o perfil não vira um pedido novo lá a cada visita.
  const lido = await lembrar(`perfil:${atorId}`, MEMORIA_MS, () => lerPerfil(atorId));
  if (!lido) return resposta({ erro: "nao_encontrado" }, 404);
  const { ator, posts: aoVivo } = lido;
  const guardado = await chamarComoPessoa<Cartao>(token, "rede_fed_perfil_remoto", { p_ator: ator.ator });
  // O banco já conhece o ator; se mesmo assim recusa (federação desligada, sem adesão, o banco falhou), a rota recusa junto.
  if (!guardado.ok || !eCartao(guardado.dado)) return recusa(guardado.ok ? "falha" : guardado.codigo);
  // O que o banco sabe (se a pessoa segue, se bloqueou) e os posts que ele guarda, tudo já pelo proxy. Os posts saem numa lista só:
  // o cartão do banco (com "curti" e as contagens) ganha do lido agora; o que só o banco tem (só-seguidores de quem se segue) entra.
  const { posts: doBanco, proximo, ...local } = assinarCartao(guardado.dado);
  // A pessoa de fora bloqueou quem pede: só o cabeçalho. Os posts lidos agora na origem NÃO vão (a memória do servidor é de
  // todos, o bloqueio é de cada um).
  const bloqueouVoce = local.bloqueou_voce === true;
  // A relação de quem lê vale também para os posts lidos agora (o banco não os guarda, então não os marcou).
  const relacao = { silenciado: local.silenciado === true, bloqueado: local.bloqueado === true, bloqueou_voce: false };
  const porId = new Map<string, Cartao>();
  for (const c of Array.isArray(doBanco) ? doBanco.filter(eCartao) : []) if (typeof c.id === "string") porId.set(c.id, c);
  const vistos = new Set<string>();
  const posts = aoVivo.map((c) => {
    vistos.add(String(c.id));
    return porId.get(String(c.id)) ?? { ...c, ...relacao };
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
    tipo: lido.tipo,
    servidor: dominio(ator.ator),
    posts: bloqueouVoce ? [] : posts.slice(0, 40),
    proximo: !bloqueouVoce && typeof proximo === "string" && proximo ? proximo : null,
    local,
  });
}

/** O limite de pedidos estourou no meio do fio: a rota responde 429, não "não encontrado". */
class LimiteNoFio extends Error {}

/**
 * A pessoa de fora bloqueou quem pede (um Block recebido de lá)? Vale também para o que é lido agora na origem, que o banco não
 * guarda. Pergunta direto ao bloqueio recebido (rede_fed_me_bloqueou), que não depende de o ator ainda estar guardado. Qualquer
 * falha conta como sim: na dúvida, não mostra. O limite estourado sobe como LimiteNoFio.
 */
async function bloqueouQuemPede(token: string, autor: string): Promise<boolean> {
  const r = await chamarComoPessoa<boolean>(token, "rede_fed_me_bloqueou", { p_ator: autor });
  if (r.ok) return r.dado !== false;
  if (r.codigo === "muitos_pedidos") throw new LimiteNoFio();
  return true;
}

/** O fio como o banco o guarda (nulo se o banco não tem a nota ou a pessoa não pode vê-la). */
async function fioDoBanco(token: string, id: string) {
  const r = await chamarComoPessoa<{ post?: unknown; acima?: unknown; respostas?: unknown }>(token, "rede_fed_fio_remoto", { p_id: id });
  if (!r.ok || !eCartao(r.dado) || !eCartao(r.dado.post) || !deFora(r.dado.post)) return null;
  return { post: assinarCartao(r.dado.post), acima: itensDoFio(r.dado.acima), respostas: itensDoFio(r.dado.respostas) };
}

async function fio(token: string, postId: string, buscarLa: boolean) {
  if (await bloqueado(postId)) return resposta({ erro: "instancia_bloqueada" }, 403);
  const guardado = await fioDoBanco(token, postId);
  if (guardado) return resposta(guardado);
  // O banco não guarda a nota. Só o toque da pessoa em "buscar este post em <servidor>" faz o servidor ir lá fora: abrir um link
  // não basta (senão quem arma o link fica sabendo a hora em que cada pessoa o abriu).
  if (!buscarLa) return resposta({ erro: "so_na_origem", servidor: dominio(postId) }, 404);
  const lerPublica = async (id: string) => {
    const { doc } = await buscarNaOrigem(id);
    const autor = doc ? (Array.isArray(doc.attributedTo) ? idDe(doc.attributedTo[0]) : idDe(doc.attributedTo)) : null;
    // Instância bloqueada, ou a pessoa de fora bloqueou quem pede: como se o post não existisse (o banco faz o mesmo no fio guardado).
    if (!doc || !autor || (await bloqueado(autor)) || (await bloqueouQuemPede(token, autor))) return null;
    const lida = lerNota(doc, autor);
    return lida.ok && (lida.nota.visibilidade === "publico" || lida.nota.visibilidade === "nao_listado") ? lida.nota : null;
  };
  let nota: NotaRecebida | null;
  try {
    nota = await lerPublica(postId);
  } catch (erro) {
    if (erro instanceof LimiteNoFio) return resposta({ erro: "muitos_pedidos" }, 429);
    throw erro;
  }
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
    if ((cursor && !CURSOR.test(cursor)) || !Number.isInteger(limite) || limite < 1 || limite > 50) return resposta({ erro: "invalido:pedido" }, 400);
    const linha = await chamarComoPessoa<{ itens?: unknown[]; proximo?: string | null }>(token, "rede_fed_linha_mista", { p_cursor: cursor || null, p_limite: limite });
    if (!linha.ok) return recusa(linha.codigo);
    return resposta({ itens: Array.isArray(linha.dado?.itens) ? linha.dado.itens.map(assinarCartao) : [], proximo: linha.dado?.proximo ?? null });
  }

  // As respostas de fora a um post DAQUI: só o banco é lido (o teto e a regra de quem vê são os da função, que roda como a pessoa).
  if (p.has("respostas")) {
    const id = p.get("respostas") ?? "";
    const cursor = p.get("cursor");
    if (!ID_DAQUI.test(id) || (cursor && !CURSOR.test(cursor))) return resposta({ erro: "invalido:pedido" }, 400);
    const r = await chamarComoPessoa<{ itens?: unknown[]; proximo?: string | null; total?: number }>(token, "rede_fed_respostas_de", { p_post: id.toLowerCase(), p_cursor: cursor || null, p_limite: 50 });
    if (!r.ok) return recusa(r.codigo);
    const itens = Array.isArray(r.dado?.itens) ? r.dado.itens.filter((c): c is Cartao => eCartao(c) && deFora(c)).map(assinarCartao) : [];
    return resposta({ itens, proximo: typeof r.dado?.proximo === "string" ? r.dado.proximo : null, total: typeof r.dado?.total === "number" ? r.dado.total : itens.length });
  }

  // A sessão é conferida no banco ANTES de buscar qualquer coisa lá fora (com o teto por pessoa de rede_fed_eu).
  const eu = await chamarComoPessoa<{ perfil: string }>(token, "rede_fed_eu", { p_acao: "remoto" });
  if (!eu.ok) return recusa(eu.codigo);

  const post = urlOk(p.get("post"));
  if (post) return fio(token, post, p.get("buscar") === "1");
  const ator = urlOk(p.get("ator"));
  if (ator) {
    const cursor = p.get("cursor");
    if (cursor && !CURSOR.test(cursor)) return resposta({ erro: "invalido:pedido" }, 400);
    return cursor ? maisDoPerfil(token, ator, cursor) : perfil(token, ator);
  }
  const conta = lerConta(p.get("conta") ?? "");
  if (conta) {
    if (conta.dominio === fed.dominio) return resposta({ local: true, handle: conta.usuario.toLowerCase() });
    if (await bloqueado(`https://${conta.dominio}/`)) return resposta({ erro: "instancia_bloqueada" }, 403);
    // O WebFinger também fica uns minutos na memória (o mesmo @ aberto de novo não pergunta de novo lá fora).
    const achado = await lembrar(`conta:${conta.usuario.toLowerCase()}@${conta.dominio}`, MEMORIA_MS, () => atorPorConta(conta.usuario, conta.dominio).then((a) => a?.ator ?? null));
    if (!achado) return resposta({ erro: "nao_encontrado" }, 404);
    return perfil(token, achado);
  }
  return resposta({ erro: "invalido:pedido" }, 400);
}
