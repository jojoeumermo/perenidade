// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o que a Alumia PUBLICA no Fediverso no modo total (frente F1 do plano do Fediverso): WebFinger nos dois hosts com o
// "subject" canônico no domínio curto (D1), o ator da instância, host-meta por host, o ator completo (following, featured, foto,
// trancado, descoberta), a Note com Mention + cc, imagem com texto alternativo em endereço estável, resposta a post de fora, fio
// e respostas, as visibilidades (só-seguidores e direto nunca saem), os construtores de interação (Like, Announce, Undo, Flag,
// Block), o Group (Lemmy) atrás de fediverso-grupos, o NodeInfo 2.1 e 2.0 conferidos contra os esquemas oficiais
// (scripts/dados/nodeinfo-2.*.schema.json, copiados de github.com/jhass/nodeinfo, CC0) e o HTML de fora limpo por lista permitida.
// E, com as flags desligadas, que nada muda.
//
// Não sobe banco: as ações do banco (contrato 3.1 e as pedidas à frente F3) são um dublê aqui, pelo fetch. As rotas de verdade
// (app/.well-known/**, app/api/fediverso/**) são chamadas direto, com Request.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/carregar-ts.mjs scripts/testar-fediverso-saida.mjs
import fs from "node:fs";
import { register } from "node:module";

// As rotas importam "next/server" (o `after` de lib/rede/fediverso/rotas.ts); fora do Next, o Node só acha "next/server.js".
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(e, c, p) { return p(e === "next/server" ? "next/server.js" : e, c); }`),
);

const SEGREDO = "segredo-de-teste-da-federacao-com-mais-de-32-caracteres";
const BASE = "https://alumia.institutolucia.org";
const CURTO = "institutolucia.org";
const ALUMIA = "alumia.institutolucia.org";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://banco.teste";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica-de-teste";
process.env.ALUMIA_FEDIVERSO_SEGREDO = SEGREDO;
process.env.NEXT_PUBLIC_ALUMIA_URL = BASE;
process.env.NEXT_PUBLIC_RECURSOS = "rede-v2";

const recursos = await import("../lib/recursos.ts");
const doc = await import("../lib/rede/fediverso/documentos.ts");
const end = await import("../lib/rede/fediverso/enderecos.ts");
const { limparHtml, textoParaHtml } = await import("../lib/rede/fediverso/texto.ts");
const men = await import("../lib/rede/fediverso/mencoes.ts");
const { gerarParDeChaves } = await import("../lib/rede/fediverso/assinatura.ts");

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = (v) => v !== false) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

// ── As flags: o painel (definirVivos) liga e desliga na hora, sem remontar ──
const ligar = (...nomes) => recursos.definirVivos({ ligados: new Set(nomes), desligados: new Set() });
const desligarTudo = () => recursos.definirVivos({ ligados: new Set(), desligados: new Set(["fediverso-total", "fediverso-grupos"]) });

// ── O dublê do banco (public.rede_fed_servidor) e do depósito de mídia ──
const UUID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const UUID2 = "1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const PERFIL = "9f8e7d6c-5b4a-4f3e-8d2c-1b0a9f8e7d6c";
const ARQUIVO = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const par = gerarParDeChaves();
const AVATAR = `data:image/webp;base64,${Buffer.from("RIFF0000WEBPVP8 fotinha").toString("base64")}`;
const BYTES_DA_IMAGEM = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const agora = new Date().toISOString();

const postBase = {
  id: UUID, tipo: "post", titulo: null, texto: "Oi @bia@mastodon.social e @carla! #Estudo", corpo: null, aviso: "", criado_em: agora, editado_em: null,
  resposta_a: null, handle: "ana_1", comunidade: null,
  midia: [{ ordem: 0, caminho: `${PERFIL}/${ARQUIVO}.jpg`, tipo: "image/jpeg", alt: "Um cartaz da greve", largura: 800, altura: 600, blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" }],
  mencoes: [
    { handle: "bia@mastodon.social", ator: "https://mastodon.social/users/bia", inbox: "https://mastodon.social/inbox", url: "https://mastodon.social/@bia" },
    { handle: `carla@${CURTO}`, ator: `${BASE}/api/fediverso/u/carla`, inbox: null, url: `${BASE}/@carla` },
  ],
  visibilidade: "publico",
  resposta_a_remota: "https://mastodon.social/users/bia/statuses/123",
  raiz: null,
};
let postDoBanco = postBase;
const chamadas = [];
const acoes = {
  ator: (p) =>
    p.handle === "ana_1"
      ? { estado: "ligado", perfil: PERFIL, handle: "ana_1", nome: "Ana", bio: "Estudo e luta", ligado_em: agora, chave_publica: par.publica, chave_privada: "v1:cifrada", avatar_url: AVATAR, capa_url: "/rede/capas/c01.svg", discoverable: true, trancado: true }
      : p.handle === "luta"
        ? { estado: "ligado", perfil: PERFIL, handle: "luta", nome: "Luta", bio: "", ligado_em: agora, chave_publica: par.publica, chave_privada: "v1:x" }
        : { estado: "inexistente" },
  post: (p) => (p.id === UUID ? postDoBanco : null),
  seguindo_publico: () => ({ total: 7 }),
  destaques: () => ({ itens: [{ ...postBase, id: UUID2, mencoes: [], midia: [], resposta_a_remota: null }] }),
  respostas: () => ({ itens: [UUID2, "nao-e-uuid"] }),
  contagem: () => ({ usuarios: 3, posts: 12, ativos_mes: 2, ativos_semestre: 3 }),
  comunidade: (p) =>
    ["luta", "estudo-coletivo"].includes(p.slug)
      ? { estado: "ligado", slug: p.slug, nome: "Luta coletiva", descricao: "Comunidade <aberta>", criada_em: agora, moderadores: ["ana_1", "Inválido!"], chave_publica: p.slug === "luta" ? par.publica : null, chave_privada: null }
      : p.slug === "nucleo-x" ? { estado: "fechada" } : null,
  comunidade_chaves: (p) => ({ chave_publica: p.publica, chave_privada: p.privada }),
  comunidade_outbox: () => ({ total: 1, itens: [{ ...postBase, titulo: "Assembleia", mencoes: [], comunidade_slug: "luta" }, { ...postBase, id: UUID2, visibilidade: "seguidores" }] }),
  comunidade_seguidores: () => ({ total: 4 }),
};
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u === "http://banco.teste/rest/v1/rpc/rede_fed_servidor") {
    const corpo = JSON.parse(init.body);
    if (corpo.p_segredo !== SEGREDO) return new Response(JSON.stringify({ message: "sem_permissao" }), { status: 400 });
    chamadas.push(corpo.p_acao);
    const f = acoes[corpo.p_acao];
    if (!f) return new Response(JSON.stringify({ message: "invalido:acao" }), { status: 400 });
    return new Response(JSON.stringify(f(corpo.p ?? {})), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (u === `http://banco.teste/storage/v1/object/authenticated/rede-midia/${PERFIL}/${ARQUIVO}.jpg`) {
    if (init.headers?.Authorization !== "Bearer chave-publica-de-teste") return new Response("", { status: 400 });
    return new Response(BYTES_DA_IMAGEM, { status: 200, headers: { "Content-Type": "application/octet-stream", "Content-Length": String(BYTES_DA_IMAGEM.length) } });
  }
  throw new Error(`fetch inesperado: ${u}`);
};

// As rotas de verdade.
const rotaWebfinger = await import("../app/.well-known/webfinger/route.ts");
const rotaHostMeta = await import("../app/.well-known/host-meta/route.ts");
const rotaIndiceNodeinfo = await import("../app/.well-known/nodeinfo/route.ts");
const rotaNodeinfo = await import("../app/api/fediverso/nodeinfo/route.ts");
const rotaAtor = await import("../app/api/fediverso/u/[handle]/route.ts");
const rotaImagem = await import("../app/api/fediverso/u/[handle]/imagem/[tipo]/route.ts");
const rotaSeguindo = await import("../app/api/fediverso/u/[handle]/seguindo/route.ts");
const rotaDestaques = await import("../app/api/fediverso/u/[handle]/destaques/route.ts");
const rotaPost = await import("../app/api/fediverso/p/[id]/route.ts");
const rotaRespostas = await import("../app/api/fediverso/p/[id]/respostas/route.ts");
const rotaMidia = await import("../app/api/fediverso/p/[id]/midia/[ordem]/route.ts");
const rotaGrupo = await import("../app/api/fediverso/c/[slug]/route.ts");
const rotaGrupoOutbox = await import("../app/api/fediverso/c/[slug]/outbox/route.ts");
const rotaGrupoSeguidores = await import("../app/api/fediverso/c/[slug]/seguidores/route.ts");
const rotaGrupoModeradores = await import("../app/api/fediverso/c/[slug]/moderadores/route.ts");

const AP = "application/activity+json";
const pedir = (caminho, { host = ALUMIA, aceita = AP } = {}) => new Request(`https://${host}${caminho}`, { headers: { host, accept: aceita } });
const ctx = (params) => ({ params: Promise.resolve(params) });
const json = async (r) => ({ status: r.status, tipo: r.headers.get("content-type") ?? "", corpo: r.status === 200 && /json/.test(r.headers.get("content-type") ?? "") ? await r.json() : null });
const webfinger = (resource, host = ALUMIA) => rotaWebfinger.GET(pedir(`/.well-known/webfinger?resource=${encodeURIComponent(resource)}`, { host, aceita: "application/jrd+json" })).then(json);
const semSegredo = (o) => !/PRIVATE|chave_privada|v1:cifrada/.test(JSON.stringify(o));

// ═══════════════════ Com as flags DESLIGADAS: nada muda ═══════════════════
desligarTudo();
await espera("desligado: WebFinger no domínio curto dá 404; no da Alumia, o subject de sempre", async () => [await webfinger(`acct:ana_1@${CURTO}`, CURTO), await webfinger(`acct:ana_1@${ALUMIA}`)], ([curto, alumia]) =>
  curto.status === 404 && alumia.status === 200 && alumia.corpo.subject === `acct:ana_1@${ALUMIA}` && !("properties" in alumia.corpo.links[0]));
await espera("desligado: o ator da instância não responde no WebFinger", async () => webfinger(`acct:${ALUMIA}@${ALUMIA}`), (r) => r.status === 404);
await espera("desligado: o ator sai como antes (sem following, featured, foto; fora do diretório)", async () => json(await rotaAtor.GET(pedir("/api/fediverso/u/ana_1"), ctx({ handle: "ana_1" }))), ({ status, corpo }) =>
  status === 200 && corpo.type === "Person" && !("following" in corpo) && !("featured" in corpo) && !("icon" in corpo) && corpo.discoverable === false && corpo.manuallyApprovesFollowers === false && semSegredo(corpo));
await espera("desligado: a Note sai como antes (sem menção, anexo, resposta remota nem replies), mesmo que o banco mande os campos", async () => json(await rotaPost.GET(pedir(`/api/fediverso/p/${UUID}`), ctx({ id: UUID }))), ({ status, corpo }) =>
  status === 200 && !("attachment" in corpo) && corpo.inReplyTo === null && !("replies" in corpo) && corpo.tag.every((t) => t.type === "Hashtag") && corpo.cc.length === 1 && !/h-card/.test(corpo.content));
await espera("desligado: as rotas novas respondem 404", async () => Promise.all([
  rotaSeguindo.GET(pedir("/api/fediverso/u/ana_1/seguindo"), ctx({ handle: "ana_1" })),
  rotaDestaques.GET(pedir("/api/fediverso/u/ana_1/destaques"), ctx({ handle: "ana_1" })),
  rotaImagem.GET(pedir("/api/fediverso/u/ana_1/imagem/avatar"), ctx({ handle: "ana_1", tipo: "avatar" })),
  rotaRespostas.GET(pedir(`/api/fediverso/p/${UUID}/respostas`), ctx({ id: UUID })),
  rotaMidia.GET(pedir(`/api/fediverso/p/${UUID}/midia/0`), ctx({ id: UUID, ordem: "0" })),
  rotaGrupo.GET(pedir("/api/fediverso/c/luta"), ctx({ slug: "luta" })),
]), (rs) => rs.every((r) => r.status === 404));
await espera("desligado: o índice do NodeInfo só aponta o 2.1, e o documento não traz ativos", async () => [await (await rotaIndiceNodeinfo.GET(pedir("/.well-known/nodeinfo"))).json(), await (await rotaNodeinfo.GET(pedir("/api/fediverso/nodeinfo?esquema=2.0"))).json()], ([i, n]) =>
  i.links.length === 1 && n.version === "2.1" && !("activeMonth" in n.usage.users));
await espera("desligado: host-meta aponta sempre o WebFinger da Alumia", async () => (await rotaHostMeta.GET(pedir("/.well-known/host-meta", { host: CURTO }))).text(), (x) => x.includes(`${BASE}/.well-known/webfinger`));

// ═══════════════════ Modo total ligado (só fediverso-total) ═══════════════════
ligar("fediverso-total");
const fed = end.enderecosDaFederacao(BASE);
await espera("o domínio curto é o host sem 'alumia.'; nada a encurtar quando não começa com alumia.", async () => [fed.dominioCurto, end.dominioCurtoDe("rede.org"), end.dominioCurtoDe("alumia.teste"), fed.dominioDaConta(false), fed.dominioDaConta(true)], (r) =>
  r[0] === CURTO && r[1] === "" && r[2] === "" && r[3] === ALUMIA && r[4] === CURTO);
await espera("WebFinger: acct no domínio curto, nos DOIS hosts, dá o subject canônico e o self no ator da Alumia", async () => Promise.all([webfinger(`acct:ana_1@${CURTO}`, CURTO), webfinger(`acct:ana_1@${CURTO}`, ALUMIA), webfinger(`acct:ana_1@${ALUMIA}`, ALUMIA), webfinger(`acct:ana_1@${ALUMIA}`, CURTO)]), (rs) =>
  rs.every((r) => r.status === 200 && /jrd\+json/.test(r.tipo) && r.corpo.subject === `acct:ana_1@${CURTO}` && r.corpo.links.some((l) => l.rel === "self" && l.type === AP && l.href === `${BASE}/api/fediverso/u/ana_1` && l.properties["https://www.w3.org/ns/activitystreams#type"] === "Person")));
await espera("WebFinger: o endereço do ator e o /@nome também valem; outro domínio e quem não federa, 404", async () => Promise.all([webfinger(`${BASE}/api/fediverso/u/ana_1`), webfinger(`${BASE}/@ana_1`), webfinger("acct:ana_1@outra.org"), webfinger(`acct:ninguem@${CURTO}`, CURTO)]), (r) =>
  r[0].status === 200 && r[1].status === 200 && r[2].status === 404 && r[3].status === 404);
await espera("WebFinger: o ator da instância (acct:<domínio>@<domínio>) aponta o Application", async () => webfinger(`acct:${ALUMIA}@${ALUMIA}`), ({ status, corpo }) =>
  status === 200 && corpo.subject === `acct:${ALUMIA}@${ALUMIA}` && corpo.links[0].href === `${BASE}/api/fediverso/ator`);
await espera("WebFinger: sem fediverso-grupos, comunidade não responde", async () => webfinger(`acct:estudo-coletivo@${CURTO}`, CURTO), (r) => r.status === 404);
await espera("host-meta: cada host aponta o PRÓPRIO WebFinger; host desconhecido cai na Alumia", async () => Promise.all([CURTO, ALUMIA, "localhost:3000"].map(async (h) => (await rotaHostMeta.GET(pedir("/.well-known/host-meta", { host: h }))).text())), ([c, a, l]) =>
  c.includes(`https://${CURTO}/.well-known/webfinger?resource={uri}`) && a.includes(`https://${ALUMIA}/.well-known/webfinger`) && l.includes(`${BASE}/.well-known/webfinger`));

await espera("ator completo: following, featured, foto enviada em endereço estável (webp), capa SVG da galeria fora, trancado e descoberta da pessoa", async () => json(await rotaAtor.GET(pedir("/api/fediverso/u/ana_1"), ctx({ handle: "ana_1" }))), ({ status, corpo: a }) =>
  status === 200 && a.following === `${BASE}/api/fediverso/u/ana_1/seguindo` && a.featured === `${BASE}/api/fediverso/u/ana_1/destaques` && a.icon?.type === "Image" && a.icon.url === `${BASE}/api/fediverso/u/ana_1/imagem/avatar` && a.icon.mediaType === "image/webp" &&
  !("image" in a) && a.manuallyApprovesFollowers === true && a.discoverable === true && a.indexable === true && a.published && a.publicKey.owner === a.id && semSegredo(a) && !/data:image/.test(JSON.stringify(a)) &&
  JSON.stringify(a["@context"]).includes("toot:featured"));
await espera("a foto sai pela rota estável com o tipo certo, nosniff e sandbox; capa da galeria (SVG) não sai", async () => [await rotaImagem.GET(pedir("/api/fediverso/u/ana_1/imagem/avatar"), ctx({ handle: "ana_1", tipo: "avatar" })), await rotaImagem.GET(pedir("/api/fediverso/u/ana_1/imagem/capa"), ctx({ handle: "ana_1", tipo: "capa" })), await rotaImagem.GET(pedir("/api/fediverso/u/ana_1/imagem/x"), ctx({ handle: "ana_1", tipo: "x" }))], ([a, c, x]) => {
  return a.status === 200 && a.headers.get("content-type") === "image/webp" && a.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(a.headers.get("content-security-policy")) && c.status === 404 && x.status === 404;
});
await espera("following: só o total (a lista de quem a pessoa segue não sai)", async () => json(await rotaSeguindo.GET(pedir("/api/fediverso/u/ana_1/seguindo"), ctx({ handle: "ana_1" }))), ({ corpo }) =>
  corpo.type === "OrderedCollection" && corpo.totalItems === 7 && !("orderedItems" in corpo) && !("first" in corpo));
await espera("featured: os fixados como Note", async () => json(await rotaDestaques.GET(pedir("/api/fediverso/u/ana_1/destaques"), ctx({ handle: "ana_1" }))), ({ corpo }) =>
  corpo.totalItems === 1 && corpo.orderedItems[0].type === "Note" && corpo.orderedItems[0].id === `${BASE}/api/fediverso/p/${UUID2}`);

postDoBanco = postBase;
await espera("Note: Mention de quem é de fora e de quem é daqui, os dois em cc; h-card no HTML", async () => json(await rotaPost.GET(pedir(`/api/fediverso/p/${UUID}`), ctx({ id: UUID }))), ({ corpo: n }) => {
  const mencoes = n.tag.filter((t) => t.type === "Mention");
  return n.to[0] === doc.PUBLICO && n.cc.includes(`${BASE}/api/fediverso/u/ana_1/seguidores`) && n.cc.includes("https://mastodon.social/users/bia") && n.cc.includes(`${BASE}/api/fediverso/u/carla`) &&
    mencoes.length === 2 && mencoes[0].href === "https://mastodon.social/users/bia" && mencoes[0].name === "@bia@mastodon.social" && mencoes[1].name === `@carla@${CURTO}` &&
    n.content.includes('<span class="h-card" translate="no"><a href="https://mastodon.social/@bia" class="u-url mention">@<span>bia</span></a></span>') &&
    n.content.includes(`<a href="${BASE}/@carla" class="u-url mention">@<span>carla</span></a></span>!`) && n.tag.some((t) => t.type === "Hashtag" && t.name === "#estudo");
});
await espera("Note: imagem com texto alternativo, blurhash e tamanho, num endereço estável SEM o caminho do depósito", async () => json(await rotaPost.GET(pedir(`/api/fediverso/p/${UUID}`), ctx({ id: UUID }))), ({ corpo: n }) =>
  n.attachment?.length === 1 && n.attachment[0].type === "Image" && n.attachment[0].mediaType === "image/jpeg" && n.attachment[0].url === `${BASE}/api/fediverso/p/${UUID}/midia/0` && n.attachment[0].name === "Um cartaz da greve" &&
  n.attachment[0].blurhash === "LEHV6nWB2yk8pyo0adR*.7kCMdnj" && n.attachment[0].width === 800 && n.attachment[0].height === 600 && !JSON.stringify(n).includes(PERFIL) && !JSON.stringify(n).includes(ARQUIVO));
await espera("Note: inReplyTo para post de fora, coleção de respostas; sem raiz conhecida numa resposta, sem context", async () => json(await rotaPost.GET(pedir(`/api/fediverso/p/${UUID}`), ctx({ id: UUID }))), ({ corpo: n }) =>
  n.inReplyTo === "https://mastodon.social/users/bia/statuses/123" && n.replies === `${BASE}/api/fediverso/p/${UUID}/respostas` && !("context" in n));
await espera("Note: post que abre o fio tem context = ele mesmo; resposta daqui usa a raiz", async () => [doc.documentoDoPost(fed, { ...postBase, resposta_a_remota: null }, true, { total: true, grupos: false }), doc.documentoDoPost(fed, { ...postBase, resposta_a: UUID2, raiz: UUID2, resposta_a_remota: "https://x.org/ignorado" }, true, { total: true, grupos: false })], ([a, b]) =>
  a.context === `${BASE}/api/fediverso/p/${UUID}` && a.inReplyTo === null && b.context === `${BASE}/api/fediverso/p/${UUID2}` && b.inReplyTo === `${BASE}/api/fediverso/p/${UUID2}`);
await espera("Note não listada: seguidores em to, Public em cc", async () => doc.documentoDoPost(fed, { ...postBase, visibilidade: "nao_listado", mencoes: [] }, true, { total: true, grupos: false }), (n) =>
  n.to.length === 1 && n.to[0] === `${BASE}/api/fediverso/u/ana_1/seguidores` && n.cc[0] === doc.PUBLICO);
await espera("só-seguidores e direto NUNCA saem: o construtor recusa e a rota responde 404", async () => {
  const recusas = ["seguidores", "direto", "x"].map((v) => { try { doc.documentoDoPost(fed, { ...postBase, visibilidade: v }); return false; } catch (e) { return e.message === "visibilidade_que_nao_sai"; } });
  postDoBanco = { ...postBase, visibilidade: "seguidores" };
  const [p, m] = await Promise.all([rotaPost.GET(pedir(`/api/fediverso/p/${UUID}`), ctx({ id: UUID })), rotaMidia.GET(pedir(`/api/fediverso/p/${UUID}/midia/0`), ctx({ id: UUID, ordem: "0" }))]);
  postDoBanco = postBase;
  return [...recusas, p.status === 404, m.status === 404];
}, (r) => r.every(Boolean));
await espera("Create leva o mesmo to/cc da Note (o mencionado recebe)", async () => doc.atividadeCreate(fed, postBase, { total: true, grupos: false }), (c) => c.cc.includes("https://mastodon.social/users/bia") && c.object.attachment.length === 1 && c.to[0] === doc.PUBLICO);

await espera("mídia: a rota lê o depósito como VISITANTE (chave pública) e devolve a imagem com o tipo do banco", async () => {
  const r = await rotaMidia.GET(pedir(`/api/fediverso/p/${UUID}/midia/0`), ctx({ id: UUID, ordem: "0" }));
  return { status: r.status, tipo: r.headers.get("content-type"), nosniff: r.headers.get("x-content-type-options"), bytes: Buffer.from(await r.arrayBuffer()).equals(BYTES_DA_IMAGEM) };
}, (r) => r.status === 200 && r.tipo === "image/jpeg" && r.nosniff === "nosniff" && r.bytes);
await espera("mídia: ordem sem imagem, ordem inválida e caminho estranho dão 404", async () => {
  const a = await rotaMidia.GET(pedir(`/api/fediverso/p/${UUID}/midia/1`), ctx({ id: UUID, ordem: "1" }));
  const b = await rotaMidia.GET(pedir(`/api/fediverso/p/${UUID}/midia/9`), ctx({ id: UUID, ordem: "9" }));
  postDoBanco = { ...postBase, midia: [{ ...postBase.midia[0], caminho: "../../segredo.jpg" }] };
  const c = await rotaMidia.GET(pedir(`/api/fediverso/p/${UUID}/midia/0`), ctx({ id: UUID, ordem: "0" }));
  postDoBanco = postBase;
  return [a.status, b.status, c.status];
}, (r) => r.every((s) => s === 404));
await espera("respostas: coleção com a primeira página embutida, só ids válidos", async () => json(await rotaRespostas.GET(pedir(`/api/fediverso/p/${UUID}/respostas`), ctx({ id: UUID }))), ({ corpo }) =>
  corpo.type === "Collection" && corpo.first.items.length === 1 && corpo.first.items[0] === `${BASE}/api/fediverso/p/${UUID2}`);

// ═══════════════════ Construtores de interação (contrato 3.3) ═══════════════════
const NOTA_DE_FORA = "https://mastodon.social/users/bia/statuses/9";
await espera("Like e Announce saem do ator daqui; o Announce vai a Public e aos seguidores, com o autor em cc", async () => [doc.atividadeLike(fed, "ana_1", NOTA_DE_FORA, "l1"), doc.atividadeAnnounce(fed, "ana_1", NOTA_DE_FORA, "a1", "https://mastodon.social/users/bia")], ([l, a]) =>
  l.type === "Like" && l.actor === `${BASE}/api/fediverso/u/ana_1` && l.object === NOTA_DE_FORA && l.id === `${BASE}/api/fediverso/atividades/like/l1` &&
  a.type === "Announce" && a.to[0] === doc.PUBLICO && a.cc.includes(`${BASE}/api/fediverso/u/ana_1/seguidores`) && a.cc.includes("https://mastodon.social/users/bia"));
await espera("Undo leva a atividade original inteira (sem @context) e o mesmo ator", async () => doc.atividadeUndo(fed, "ana_1", doc.atividadeLike(fed, "ana_1", NOTA_DE_FORA, "l1")), (u) =>
  u.type === "Undo" && u.object.type === "Like" && u.object.id === `${BASE}/api/fediverso/atividades/like/l1` && !("@context" in u.object) && u.actor === u.object.actor && u.id.startsWith(u.object.id));
await espera("Flag sai do ator da INSTÂNCIA (quem denunciou não aparece), com os alvos e o comentário cortado", async () => doc.atividadeFlag(fed, ["https://mastodon.social/users/bia", NOTA_DE_FORA, "javascript:x"], "spam ".repeat(400), "f1"), (f) =>
  f.type === "Flag" && f.actor === `${BASE}/api/fediverso/ator` && f.object.length === 2 && Array.from(f.content).length <= 1000 && !/u\/ana_1/.test(JSON.stringify(f)));
await espera("Block: ator daqui → alvo", async () => doc.atividadeBlock(fed, "ana_1", "https://mastodon.social/users/bia", "b1"), (b) => b.type === "Block" && b.object === "https://mastodon.social/users/bia" && b.id.endsWith("/block/b1"));

// ═══════════════════ Group (fediverso-grupos) ═══════════════════
await espera("sem fediverso-grupos, as rotas do Group dão 404 mesmo com o modo total", async () => Promise.all([rotaGrupo.GET(pedir("/api/fediverso/c/luta"), ctx({ slug: "luta" })), rotaGrupoOutbox.GET(pedir("/api/fediverso/c/luta/outbox"), ctx({ slug: "luta" }))]), (rs) => rs.every((r) => r.status === 404));
ligar("fediverso-total", "fediverso-grupos");
await espera("WebFinger do Group: link self com o tipo Group; mesmo nome de pessoa e comunidade traz os dois links", async () => Promise.all([webfinger(`acct:estudo-coletivo@${CURTO}`, CURTO), webfinger(`acct:luta@${CURTO}`, CURTO), webfinger(`acct:nucleo-x@${CURTO}`, CURTO)]), ([g, ambos, fechada]) =>
  g.status === 200 && g.corpo.subject === `acct:estudo-coletivo@${CURTO}` && g.corpo.links[0].href === `${BASE}/api/fediverso/c/estudo-coletivo` && g.corpo.links[0].properties["https://www.w3.org/ns/activitystreams#type"] === "Group" &&
  ambos.status === 200 && ambos.corpo.links.filter((l) => l.rel === "self").map((l) => l.properties["https://www.w3.org/ns/activitystreams#type"]).sort().join() === "Group,Person" && fechada.status === 404);
await espera("Group: documento como o Lemmy lê (moderators, attributedTo, publicKey, postagem só da moderação), HTML escapado", async () => json(await rotaGrupo.GET(pedir("/api/fediverso/c/luta"), ctx({ slug: "luta" }))), ({ status, corpo: g }) =>
  status === 200 && g.type === "Group" && g.preferredUsername === "luta" && g.moderators === `${BASE}/api/fediverso/c/luta/moderadores` && g.attributedTo === g.moderators && g.inbox === `${BASE}/api/fediverso/c/luta/inbox` &&
  g.publicKey.owner === g.id && g.postingRestrictedToMods === true && g.summary === "<p>Comunidade &lt;aberta&gt;</p>" && semSegredo(g));
await espera("Group sem chave: o par é gerado aqui e a privada vai CIFRADA ao banco", async () => {
  chamadas.length = 0;
  const r = await json(await rotaGrupo.GET(pedir("/api/fediverso/c/estudo-coletivo"), ctx({ slug: "estudo-coletivo" })));
  return { r, chamou: chamadas.includes("comunidade_chaves") };
}, ({ r, chamou }) => r.status === 200 && chamou && r.corpo.publicKey.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----"));
await espera("Group: comunidade fechada ou inexistente dá 404", async () => Promise.all([rotaGrupo.GET(pedir("/api/fediverso/c/nucleo-x"), ctx({ slug: "nucleo-x" })), rotaGrupo.GET(pedir("/api/fediverso/c/nada"), ctx({ slug: "nada" }))]), (rs) => rs.every((r) => r.status === 404));
await espera("Group: outbox com Announce(Create(Note)) e audience; só-seguidores fica de fora", async () => json(await rotaGrupoOutbox.GET(pedir("/api/fediverso/c/luta/outbox"), ctx({ slug: "luta" }))), ({ corpo: o }) =>
  o.orderedItems.length === 1 && o.orderedItems[0].type === "Announce" && o.orderedItems[0].actor === `${BASE}/api/fediverso/c/luta` && o.orderedItems[0].object.type === "Create" &&
  o.orderedItems[0].object.object.audience === `${BASE}/api/fediverso/c/luta` && o.orderedItems[0].object.object.name === "Assembleia" && o.orderedItems[0].object.object.cc.includes(`${BASE}/api/fediverso/c/luta`));
await espera("Group: moderação só com @ válido; seguidores só o total", async () => [await json(await rotaGrupoModeradores.GET(pedir("/api/fediverso/c/luta/moderadores"), ctx({ slug: "luta" }))), await json(await rotaGrupoSeguidores.GET(pedir("/api/fediverso/c/luta/seguidores"), ctx({ slug: "luta" })))], ([m, s]) =>
  m.corpo.orderedItems.length === 1 && m.corpo.orderedItems[0] === `${BASE}/api/fediverso/u/ana_1` && s.corpo.totalItems === 4 && !("orderedItems" in s.corpo));
await espera("Announce do Group: id estável e no host da Alumia, mesmo para atividade de fora", async () => [doc.atividadeAnnounceDoGrupo(fed, "luta", { id: "https://lemmy.ml/activities/create/1", type: "Create" }), doc.atividadeAnnounceDoGrupo(fed, "luta", { id: "https://lemmy.ml/activities/create/1", type: "Create" })], ([a, b]) =>
  a.id === b.id && a.id.startsWith(`${BASE}/api/fediverso/atividades/`) && a.cc[0] === `${BASE}/api/fediverso/c/luta/seguidores` && a.object.type === "Create");

// ═══════════════════ NodeInfo contra os esquemas oficiais ═══════════════════
/** Um conferidor pequeno do JSON Schema draft-04, só com o que os esquemas do NodeInfo usam. */
function valida(esquema, valor, caminho = "$") {
  const erros = [];
  const tipoDe = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);
  if (esquema.type) {
    const t = tipoDe(valor);
    if (!(t === esquema.type || (esquema.type === "number" && t === "integer"))) erros.push(`${caminho}: tipo ${t}, esperado ${esquema.type}`);
  }
  if (esquema.enum && !esquema.enum.includes(valor)) erros.push(`${caminho}: ${JSON.stringify(valor)} fora de ${esquema.enum.join("|")}`);
  if (esquema.pattern && typeof valor === "string" && !new RegExp(esquema.pattern).test(valor)) erros.push(`${caminho}: não casa ${esquema.pattern}`);
  if (esquema.minimum !== undefined && typeof valor === "number" && valor < esquema.minimum) erros.push(`${caminho}: menor que ${esquema.minimum}`);
  if (Array.isArray(valor)) {
    if (esquema.minItems !== undefined && valor.length < esquema.minItems) erros.push(`${caminho}: menos de ${esquema.minItems} itens`);
    if (esquema.items) valor.forEach((v, i) => erros.push(...valida(esquema.items, v, `${caminho}[${i}]`)));
  }
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    for (const r of esquema.required ?? []) if (!(r in valor)) erros.push(`${caminho}: falta ${r}`);
    for (const [k, v] of Object.entries(valor)) {
      if (esquema.properties?.[k]) erros.push(...valida(esquema.properties[k], v, `${caminho}.${k}`));
      else if (esquema.additionalProperties === false) erros.push(`${caminho}: campo a mais ${k}`);
    }
  }
  return erros;
}
const esquema21 = JSON.parse(fs.readFileSync(new URL("./dados/nodeinfo-2.1.schema.json", import.meta.url), "utf8"));
const esquema20 = JSON.parse(fs.readFileSync(new URL("./dados/nodeinfo-2.0.schema.json", import.meta.url), "utf8"));
await espera("o conferidor de esquema pega erro (campo a mais, nome fora do padrão)", async () => valida(esquema21, { ...doc.documentoNodeinfo({ usuarios: 1, posts: 1 }, "1.0"), extra: 1, software: { name: "Alumia", version: "1" } }), (e) => e.length >= 2);
await espera("NodeInfo 2.1 (modo total, com ativos) passa no esquema 2.1 oficial", async () => (await rotaNodeinfo.GET(pedir("/api/fediverso/nodeinfo"))).json(), (n) =>
  valida(esquema21, n).length === 0 && n.usage.users.activeMonth === 2 && n.usage.users.activeHalfyear === 3 && n.version === "2.1");
await espera("NodeInfo 2.0 (modo total) passa no esquema 2.0 oficial, com o profile certo", async () => {
  const r = await rotaNodeinfo.GET(pedir("/api/fediverso/nodeinfo?esquema=2.0"));
  return { perfil: r.headers.get("content-type"), n: await r.json() };
}, ({ perfil, n }) => valida(esquema20, n).length === 0 && n.version === "2.0" && /schema\/2\.0#/.test(perfil));
await espera("NodeInfo desligado também passa no 2.1", async () => doc.documentoNodeinfo({ usuarios: 0, posts: 0 }, "1.0"), (n) => valida(esquema21, n).length === 0);
await espera("o índice do NodeInfo aponta o 2.1 e o 2.0", async () => (await rotaIndiceNodeinfo.GET(pedir("/.well-known/nodeinfo"))).json(), (i) =>
  i.links.map((l) => l.rel.slice(-3)).join() === "2.1,2.0" && i.links[1].href === `${BASE}/api/fediverso/nodeinfo?esquema=2.0`);

// ═══════════════════ Texto: menções e HTML limpo ═══════════════════
await espera("acharMencoes: @nome@instancia e @nome, sem repetir, sem o ponto do fim, sem e-mail", async () => men.acharMencoes("Oi @Bia@Mastodon.Social, @bia@mastodon.social e @carla. Fale com ana@mail.org (@x_y)"), (m) =>
  m.length === 3 && m[0].usuario === "Bia" && m[0].dominio === "mastodon.social" && m[1].usuario === "carla" && m[1].dominio === null && m[2].usuario === "x_y");
await espera("resolverMencoes: de fora pelo WebFinger (dublê); daqui só quem federa; falha de uma não derruba as outras", async () => men.resolverMencoes("@bia@mastodon.social @quebra@caiu.org @carla @dani @eva@institutolucia.org", {
  dominiosLocais: [ALUMIA, CURTO],
  dominioDaConta: CURTO,
  deFora: async (u, d) => (d === "caiu.org" ? Promise.reject(new Error("fora do ar")) : { ator: `https://${d}/users/${u}`, inbox: `https://${d}/users/${u}/inbox`, inbox_compartilhada: `https://${d}/inbox` }),
  daqui: async (h) => (h === "dani" ? null : { ator: `${BASE}/api/fediverso/u/${h}`, url: `${BASE}/@${h}` }),
}), (r) => r.length === 3 && r[0].inbox === "https://mastodon.social/inbox" && r[1].handle === `carla@${CURTO}` && r[2].handle === `eva@${CURTO}` && !r.some((m) => m.handle.startsWith("dani")));
await espera("textoParaHtml: menção fora da lista fica texto; dentro, h-card escapado", async () => textoParaHtml('@a@b.org <x> @c@d.org', () => "", new Map([["a@b.org", 'https://b.org/@a"><script>']])), (h) =>
  h.includes('href="https://b.org/@a&quot;&gt;&lt;script&gt;"') && h.includes("@c@d.org") && !/<script>/.test(h) && h.includes("&lt;x&gt;"));
await espera("limparHtml: script, evento, estilo e imagem saem; link só http(s) com rel; marcas fechadas", async () => [
  limparHtml('<p>oi <script>alert(1)</script><b onclick="x" style="color:red">forte</b><img src=x onerror=alert(1)></p>'),
  limparHtml('<a href="javascript:alert(1)">x</a><a href="https://ok.org/?a=1&amp;b=2" class="mention evil u-url">y</a>'),
  limparHtml('<p><em>sem fechar'),
  limparHtml('<a href="https://x.org" title=">"><iframe src=https://x></iframe>fim'),
  limparHtml('<scr<script>ipt>alert(1)</script><svg onload=alert(1)><a href="https://x">z</a></svg>ok'),
  limparHtml('&lt;b&gt; &#x202E;x &amp;'),
], (r) =>
  r[0] === "<p>oi <b>forte</b></p>" &&
  r[1] === '<a rel="nofollow noopener noreferrer" target="_blank">x</a><a href="https://ok.org/?a=1&amp;b=2" class="mention u-url" rel="nofollow noopener noreferrer" target="_blank">y</a>' &&
  r[2] === "<p><em>sem fechar</em></p>" && r[3] === '<a href="https://x.org/" rel="nofollow noopener noreferrer" target="_blank">fim</a>' && r[4] === "&lt;scrok" && r[5] === "&lt;b&gt; x &amp;");

// ═══════════════════ Nenhum segredo em nada que sai ═══════════════════
await espera("nenhum documento que sai leva chave privada", async () => {
  const saidas = await Promise.all([
    json(await rotaAtor.GET(pedir("/api/fediverso/u/ana_1"), ctx({ handle: "ana_1" }))),
    json(await rotaGrupo.GET(pedir("/api/fediverso/c/luta"), ctx({ slug: "luta" }))),
    json(await rotaPost.GET(pedir(`/api/fediverso/p/${UUID}`), ctx({ id: UUID }))),
  ]);
  return saidas.every((s) => s.status === 200 && semSegredo(s.corpo));
});

desligarTudo();
if (falhas.length) {
  console.error(`${certos} conferências certas, ${falhas.length} com problema:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`${certos} conferências certas, 0 com problema.`);
