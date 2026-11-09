// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente F2 do PLANO-FEDIVERSO (entrada, interações e fila do modo "fediverso-total"): atividades ASSINADAS por chaves de
// teste chegam à caixa de entrada (lib/rede/fediverso/caixa.ts) e a fila entrega (lib/rede/fediverso/entrega.ts). O banco é um
// DUBLÊ em memória que segue o contrato 3.1 (as ações nota_recebida, interacao, denuncia_recebida, bloqueio_recebido,
// dominio_estado e fila_feito são da frente F3; quando ela juntar, o teste do banco confere o SQL de verdade). A rede também é um
// dublê (lib/rede/fediverso/http.ts → usarDubleDeRede), DEPOIS da trava de SSRF: endereço interno nem chega ao dublê.
// Casos: resposta de não-seguido a post daqui guardada; menção guardada; Like vira aviso e o Undo tira; só-seguidores sem seguidor
// daqui descartado; direto descartado; repasse com keyId de outro domínio conferido pela origem; Flag vira denúncia; Block;
// domínio bloqueado 403; assinatura velha (13 h) 401; Digest errado 401; HTML limpo por lista permitida; mídia pela rota-proxy
// assinada; a fila: tipos novos, Flag pelo ator da instância, circuito por domínio, 410 apaga o seguidor, 429 respeita Retry-After,
// no máximo 2 por domínio; e, com a chave desligada, tudo como antes.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/carregar-ts.mjs scripts/testar-fediverso-entrada.mjs

// O ambiente ANTES de importar os módulos (eles leem as variáveis ao carregar).
const SEGREDO = "segredo-de-teste-da-federacao-com-mais-de-32-caracteres";
const BASE = "https://alumia.teste";
const LIGADO = "rede-v2,fediverso-total,fediverso-grupos";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://banco.teste";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica-de-teste";
process.env.ALUMIA_FEDIVERSO_SEGREDO = SEGREDO;
process.env.NEXT_PUBLIC_ALUMIA_URL = BASE;
process.env.NEXT_PUBLIC_RECURSOS = LIGADO;

const { assinarPedido, conferirAssinatura, gerarParDeChaves } = await import("../lib/rede/fediverso/assinatura.ts");
const { cifrar } = await import("../lib/rede/fediverso/cifra.ts");
const { pedirAoFediverso, usarDubleDeRede } = await import("../lib/rede/fediverso/http.ts");
const servidor = await import("../lib/rede/fediverso/servidor.ts");
const { receber } = await import("../lib/rede/fediverso/caixa.ts");
const entrega = await import("../lib/rede/fediverso/entrega.ts");
const nota = await import("../lib/rede/fediverso/entrada/nota.ts");

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

// ═══════════════════ O banco (dublê do contrato 3.1) ═══════════════════
const PUBLICO = "https://www.w3.org/ns/activitystreams#Public";
const POST_LOCAL = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const URL_POST_LOCAL = `${BASE}/api/fediverso/p/${POST_LOCAL}`;
const db = {
  bloqueados: new Set(),
  remotos: new Map(),
  seguidores: [],
  seguindo: new Set(),
  notas: new Map(),
  interacoes: new Map(),
  avisos: [],
  denuncias: [],
  bloqueios: [],
  fila: [],
  feitos: [],
  dominios: new Map(),
  instancia: {},
  chamadas: [],
};
const dominioDe = (u) => { try { return new URL(u).host; } catch { return ""; } };
const bloqueado = (u) => { const h = dominioDe(u); return [...db.bloqueados].some((d) => h === d || h.endsWith(`.${d}`)); };
const conexao = (s) => s === 0 || s === 502 || s === 503 || s === 504 || (s >= 520 && s <= 526);
const acoes = {
  bloqueado: (p) => bloqueado(p.url),
  remoto: (p) => db.remotos.get(p.ator) ?? null,
  remoto_salvar: (p) => { db.remotos.set(p.ator, { ator: p.ator, chave_id: p.chave_id, chave_publica: p.chave_publica, inbox: p.inbox, inbox_compartilhada: p.compartilhada, handle: p.handle, nome: p.nome, resumo: p.resumo, url: p.url, buscado_em: new Date().toISOString() }); return true; },
  instancia: (p) => { if (p.publica) db.instancia = { publica: p.publica, privada: p.privada }; return db.instancia; },
  seguidor: (p) => {
    db.seguidores = db.seguidores.filter((s) => !(s.handle === p.handle && s.ator === p.ator));
    if (p.sim) db.seguidores.push({ handle: p.handle, ator: p.ator, inbox: p.inbox, compartilhada: p.compartilhada });
    return { ok: true };
  },
  resposta_follow: () => true,
  nota_recebida: (p) => {
    const segue = db.seguindo.has(p.ator);
    const respondeDaqui = Boolean(p.em_resposta_a && (p.em_resposta_a.startsWith(`${BASE}/api/fediverso/p/`) || db.notas.has(p.em_resposta_a)));
    const menciona = p.mencoes_locais.length > 0;
    const impulso = p.impulso && db.seguindo.has(p.impulso.ator);
    if (p.visibilidade === "seguidores") { if (!segue) return { guardado: false, motivo: "sem_seguidor_daqui" }; }
    else if (!segue && !respondeDaqui && !menciona && !impulso) return { guardado: false, motivo: "sem_ligacao" };
    db.notas.set(p.id, p);
    if (respondeDaqui) db.avisos.push({ tipo: "fed_resposta", ator: p.ator, nota: p.id });
    for (const h of p.mencoes_locais) db.avisos.push({ tipo: "fed_mencao", ator: p.ator, handle: h });
    return { guardado: true };
  },
  recebido_apagado: (p) => { db.notas.delete(p.id); return true; },
  ator_apagado: () => true,
  interacao: (p) => {
    if (p.sim) {
      db.interacoes.set(p.atividade_id, p);
      db.avisos.push({ tipo: p.tipo === "like" ? "fed_curtida" : "fed_impulso", ator: p.ator, atividade: p.atividade_id });
    } else {
      db.interacoes.delete(p.atividade_id);
      db.avisos = db.avisos.filter((a) => a.atividade !== p.atividade_id);
    }
    return { ok: true, perfil_autor: "perfil-da-autora" };
  },
  denuncia_recebida: (p) => { db.denuncias.push(p); return { protocolo: `FED-${db.denuncias.length}` }; },
  bloqueio_recebido: (p) => { db.bloqueios.push(p); return { ok: true }; },
  grupo_seguidor: () => ({ ok: true }),
  post: (p) => ({ id: p.id, tipo: "post", titulo: null, texto: "Post daqui.", corpo: null, aviso: "", criado_em: new Date().toISOString(), editado_em: null, resposta_a: null, handle: "autora" }),
  fila_pegar: (p) => db.fila.splice(0, p.limite),
  fila_feito: (p) => {
    db.feitos.push(p);
    const d = p.dominio;
    if (d && !p.sem_tentativa) {
      const e = db.dominios.get(d) ?? { falhas: 0, vezes: 0, morto_ate: null };
      if (p.ok) e.falhas = 0;
      else if (conexao(p.status)) {
        e.falhas++;
        if (e.falhas >= 5) { e.morto_ate = new Date(Date.now() + 3_600_000).toISOString(); e.vezes++; e.falhas = 0; }
      }
      db.dominios.set(d, e);
    }
    if (p.status === 410 && p.sumiu) db.seguidores = db.seguidores.filter((s) => s.inbox !== p.sumiu && s.compartilhada !== p.sumiu);
    return true;
  },
  dominio_estado: (p) => ({ morto_ate: db.dominios.get(p.dominio)?.morto_ate ?? null }),
};
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u !== "http://banco.teste/rest/v1/rpc/rede_fed_servidor") throw new Error(`fetch inesperado: ${u}`);
  const corpo = JSON.parse(String(init.body ?? "{}"));
  db.chamadas.push(corpo.p_acao);
  const f = acoes[corpo.p_acao];
  if (corpo.p_segredo !== SEGREDO || !f) return new Response(JSON.stringify({ message: `acao_desconhecida:${corpo.p_acao}` }), { status: 400 });
  return new Response(JSON.stringify(f(corpo.p ?? {}) ?? null), { status: 200, headers: { "Content-Type": "application/json" } });
};

// ═══════════════════ A rede (dublê, depois da trava de SSRF) ═══════════════════
const rede = { docs: new Map(), gets: [], entregas: [], post: () => ({ status: 202 }) };
usarDubleDeRede(async (url, o) => {
  if ((o.metodo ?? "GET") === "GET") {
    rede.gets.push(url.href);
    const d = rede.docs.get(url.href);
    if (typeof d === "number") return { status: d, tipo: "", texto: "" };
    if (d === undefined) return { status: 404, tipo: "text/html", texto: "" };
    if (o.binario) return { status: 200, tipo: "image/png", texto: "", bytes: d };
    return { status: 200, tipo: "application/activity+json", texto: JSON.stringify(d) };
  }
  const entregaFeita = { url: url.href, corpo: JSON.parse(o.corpo), cab: o.cabecalhos, inicio: Date.now() };
  rede.entregas.push(entregaFeita);
  const r = await rede.post(url, entregaFeita);
  return r === null ? null : { status: r.status, tipo: "", texto: "", retryAfter: r.retryAfter ?? null };
});

// Os atores de fora, com chaves de teste (os documentos ficam na "instância" de cada um, como no Mastodon).
const atorDoc = (id, pem) => ({ "@context": ["https://www.w3.org/ns/activitystreams"], id, type: "Person", preferredUsername: id.split("/").pop(), inbox: `${id}/inbox`, followers: `${id}/followers`, endpoints: { sharedInbox: `https://${dominioDe(id)}/inbox` }, publicKey: { id: `${id}#main-key`, owner: id, publicKeyPem: pem } });
const BIA = "https://remota.teste/users/bia";
const CID = "https://ponte.teste/users/cid";
const INST = "https://remota.teste/actor";
const chaves = { bia: gerarParDeChaves(), cid: gerarParDeChaves(), inst: gerarParDeChaves() };
rede.docs.set(BIA, atorDoc(BIA, chaves.bia.publica));
rede.docs.set(CID, atorDoc(CID, chaves.cid.publica));
rede.docs.set(INST, { ...atorDoc(INST, chaves.inst.publica), type: "Application" });

const leitor = (c) => (n) => { const k = Object.keys(c).find((x) => x.toLowerCase() === n.toLowerCase()); return k ? c[k] : null; };
const CAMINHO = "/api/fediverso/inbox";
/** Manda uma atividade assinada à caixa compartilhada. */
async function enviar(atividade, { quem = BIA, chave = chaves.bia.privada, data, corpoEnviado } = {}) {
  const corpo = JSON.stringify(atividade);
  const cab = assinarPedido({ metodo: "POST", url: `${BASE}${CAMINHO}`, corpo, chaveId: `${quem}#main-key`, chavePrivada: chave, data });
  return receber("POST", CAMINHO, leitor(cab), new TextEncoder().encode(corpoEnviado ?? corpo));
}
let n = 0;
const AS = "https://www.w3.org/ns/activitystreams";
const novaNota = (extra = {}) => ({ id: `https://remota.teste/notes/${++n}`, type: "Note", attributedTo: BIA, content: "<p>Olá daqui de fora</p>", to: [PUBLICO], cc: [`${BIA}/followers`], published: new Date().toISOString(), ...extra });
const criar = (objeto, ator = BIA) => ({ "@context": AS, id: `${objeto.id}/activity`, type: "Create", actor: ator, object: objeto });

// ═══════════════════ HTML limpo, visibilidade e mídia (puros) ═══════════════════
await espera("HTML de fora: só a lista permitida (sem script, img, onclick, javascript:, style), links com rel e as classes do Mastodon", async () =>
  nota.limparHtml('<p>oi <script>alert(1)</script><a href="javascript:alert(1)" onclick="x">x</a><img src=x onerror=alert(1)><a href="https://ok.teste/@a" class="u-url mention evil" style="color:red">@a</a> <b>forte<i>junto</b></p><style>p{}</style><iframe src="https://x"></iframe>&lt;script&gt;'),
(h) => !/<script|<img|onclick|onerror|javascript:|style|<iframe|evil/i.test(h) && /<a href="https:\/\/ok\.teste\/@a" rel="nofollow noopener noreferrer" target="_blank" class="u-url mention">@a<\/a>/.test(h) && h.includes("&lt;script&gt;") && h.endsWith("&lt;script&gt;") && /<b>forte<i>junto<\/i><\/b>/.test(h));
await espera("HTML de fora: marca aberta é fechada, título vira parágrafo, comentário e <!doctype> somem, '<' solto vira texto", async () => nota.limparHtml("<!doctype html><h1>Título</h1><!-- x --><p>a < b<ul><li>um"), (h) => h === "<p>Título</p><p>a &lt; b<ul><li>um</li></ul></p>");
await espera("visibilidade pelo to/cc: Public em to = público; em cc = não listado; seguidores; o resto é direto", async () => [
  nota.visibilidadeDe({ to: [PUBLICO] }, BIA),
  nota.visibilidadeDe({ to: [`${BIA}/followers`], cc: ["as:Public"] }, BIA),
  nota.visibilidadeDe({ to: [`${BIA}/followers`] }, BIA),
  nota.visibilidadeDe({ to: [`${BASE}/api/fediverso/u/autora`] }, BIA),
  nota.visibilidadeDe({ to: ["https://remota.teste/users/outra/followers"] }, BIA),
], (r) => r.join() === "publico,nao_listado,seguidores,direto,direto");
await espera("mídia: só https, até 4, com alt, tamanho e blurhash; tipo estranho e http ficam de fora", async () => nota.midiaDe({ attachment: [
  { type: "Image", url: "https://remota.teste/m/1.png", mediaType: "image/png", name: "um gato", width: 640, height: 480, blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" },
  { type: "Document", url: "http://remota.teste/m/2.png", mediaType: "image/png" },
  { type: "Document", url: { type: "Link", href: "https://remota.teste/m/3.webp" }, mediaType: "image/webp" },
  { type: "Document", url: "https://remota.teste/m/4.exe", mediaType: "application/x-msdownload" },
] }), (m) => m.length === 2 && m[0].alt === "um gato" && m[0].largura === 640 && m[0].blurhash && m[1].url === "https://remota.teste/m/3.webp");
await espera("rota-proxy: a URL da mídia sai assinada e só a assinatura certa confere", async () => {
  const proxy = servidor.urlDaMidia("https://remota.teste/m/1.png");
  const q = new URL(proxy, BASE).searchParams;
  return [proxy.startsWith("/api/fediverso/midia?u="), servidor.midiaAssinada(q.get("u"), q.get("s")), servidor.midiaAssinada("https://remota.teste/m/2.png", q.get("s")), servidor.midiaAssinada(q.get("u"), "x".repeat(32)), servidor.urlDaMidia("http://remota.teste/a.png")];
}, (r) => r[0] && r[1] && !r[2] && !r[3] && r[4] === null);
await espera("trava de SSRF antes do dublê: IP interno, localhost e http não chegam nem a sair", async () => {
  const antes = rede.gets.length;
  const r = await Promise.all(["https://127.0.0.1/a.png", "https://10.0.0.1/a", "https://localhost/a", "http://remota.teste/a", "https://[::1]/a"].map((u) => pedirAoFediverso(u)));
  return r.every((x) => x === null) && rede.gets.length === antes;
});

// ═══════════════════ A caixa de entrada no modo total ═══════════════════
await espera("resposta de quem ninguém daqui segue a um post daqui: guardada (HTML limpo e texto), e vira aviso", async () => {
  const objeto = novaNota({ inReplyTo: URL_POST_LOCAL, content: '<p>Concordo! <script>x</script><a href="https://remota.teste/tags/a">#a</a></p>' });
  const r = await enviar(criar(objeto));
  const g = db.notas.get(objeto.id);
  return [r.status, r.motivo, g?.texto, /<script/.test(g?.html_limpo ?? "<script"), g?.visibilidade, db.avisos.some((a) => a.tipo === "fed_resposta" && a.nota === objeto.id)];
}, (r) => r[0] === 202 && r[1] === "recebido" && r[2] === "Concordo! #a" && r[3] === false && r[4] === "publico" && r[5]);
await espera("nota de quem ninguém segue, sem responder nem mencionar nada daqui: não é guardada (202 do mesmo jeito)", async () => {
  const objeto = novaNota();
  const r = await enviar(criar(objeto));
  return [r.status, r.motivo, db.notas.has(objeto.id)];
}, (r) => r[0] === 202 && r[1] === "sem_ligacao" && r[2] === false);
await espera("menção a alguém daqui (tag Mention): guardada e vira aviso para a pessoa mencionada", async () => {
  const objeto = novaNota({ tag: [{ type: "Mention", href: `${BASE}/api/fediverso/u/autora`, name: "@autora@alumia.teste" }], cc: [`${BASE}/api/fediverso/u/autora`] });
  const r = await enviar(criar(objeto));
  return [r.motivo, db.notas.get(objeto.id)?.mencoes_locais, db.avisos.some((a) => a.tipo === "fed_mencao" && a.handle === "autora")];
}, (r) => r[0] === "recebido" && r[1]?.join() === "autora" && r[2]);
await espera("só-seguidores sem seguidor daqui: descartado", async () => {
  const objeto = novaNota({ to: [`${BIA}/followers`], cc: [] });
  const r = await enviar(criar(objeto));
  return [r.motivo, db.notas.has(objeto.id)];
}, (r) => r[0] === "sem_seguidor_daqui" && r[1] === false);
await espera("só-seguidores com seguidor daqui: guardado como 'seguidores' (o banco mostra só a quem segue)", async () => {
  db.seguindo.add(BIA);
  const objeto = novaNota({ to: [`${BIA}/followers`], cc: [] });
  const r = await enviar(criar(objeto));
  db.seguindo.delete(BIA);
  return [r.motivo, db.notas.get(objeto.id)?.visibilidade];
}, (r) => r[0] === "recebido" && r[1] === "seguidores");
await espera("mensagem direta (mesmo mencionando alguém daqui e respondendo a post daqui): NUNCA chega ao banco", async () => {
  const objeto = novaNota({ to: [`${BASE}/api/fediverso/u/autora`], cc: [], inReplyTo: URL_POST_LOCAL, tag: [{ type: "Mention", href: `${BASE}/api/fediverso/u/autora` }] });
  const antes = db.chamadas.filter((c) => c === "nota_recebida").length;
  const r = await enviar(criar(objeto));
  return [r.status, r.motivo, db.notas.has(objeto.id), db.chamadas.filter((c) => c === "nota_recebida").length - antes];
}, (r) => r[0] === 202 && r[1] === "direto" && r[2] === false && r[3] === 0);
await espera("nota com autor declarado diferente de quem assinou: recusada", async () => (await enviar(criar(novaNota({ attributedTo: "https://remota.teste/users/outra", inReplyTo: URL_POST_LOCAL })))).motivo, (m) => m === "nota_de_outro");
await espera("enquete (Question) entra como texto + opções", async () => {
  const objeto = novaNota({ type: "Question", inReplyTo: URL_POST_LOCAL, content: "<p>Qual?</p>", oneOf: [{ type: "Note", name: "A" }, { type: "Note", name: "B" }] });
  await enviar(criar(objeto));
  return db.notas.get(objeto.id)?.texto;
}, (t) => t === "Qual?\n\n• A\n• B");

await espera("Like de fora num post daqui: vira aviso de curtida para a autora", async () => {
  const r = await enviar({ "@context": AS, id: "https://remota.teste/likes/1", type: "Like", actor: BIA, object: URL_POST_LOCAL });
  return [r.motivo, db.interacoes.get("https://remota.teste/likes/1")?.post_local, db.avisos.some((a) => a.tipo === "fed_curtida" && a.ator === BIA)];
}, (r) => r[0] === "like" && r[1] === POST_LOCAL && r[2]);
await espera("Undo do Like (objeto embutido, mesmo ator): a curtida e o aviso somem", async () => {
  const r = await enviar({ "@context": AS, id: "https://remota.teste/likes/1/undo", type: "Undo", actor: BIA, object: { id: "https://remota.teste/likes/1", type: "Like", actor: BIA, object: URL_POST_LOCAL } });
  return [r.motivo, db.interacoes.has("https://remota.teste/likes/1"), db.avisos.some((a) => a.atividade === "https://remota.teste/likes/1")];
}, (r) => r[0] === "desfez_like" && r[1] === false && r[2] === false);
await espera("Undo de um Like de OUTRO ator: ignorado", async () => {
  await enviar({ "@context": AS, id: "https://remota.teste/likes/2", type: "Like", actor: BIA, object: URL_POST_LOCAL });
  const r = await enviar({ "@context": AS, id: "https://remota.teste/u/2", type: "Undo", actor: BIA, object: { id: "https://remota.teste/likes/2", type: "Like", actor: "https://remota.teste/users/outra", object: URL_POST_LOCAL } });
  return [r.motivo, db.interacoes.has("https://remota.teste/likes/2")];
}, (r) => r[0] === "ignorado" && r[1] === true);
await espera("Announce de um post daqui: vira aviso de impulso", async () => (await enviar({ "@context": AS, id: "https://remota.teste/announces/1", type: "Announce", actor: BIA, object: URL_POST_LOCAL, to: [PUBLICO] })).motivo, (m) => m === "announce");
await espera("impulso de nota de FORA, de quem alguém segue: a nota é buscada NA ORIGEM (o corpo do impulso não vale)", async () => {
  db.seguindo.add(BIA);
  const original = { id: "https://outra.teste/notes/9", type: "Note", attributedTo: "https://outra.teste/users/dani", content: "<p>Texto de verdade</p>", to: [PUBLICO] };
  rede.docs.set(original.id, original);
  const r = await enviar({ "@context": AS, id: "https://remota.teste/announces/2", type: "Announce", actor: BIA, object: { ...original, content: "<p>Texto forjado</p>" }, to: [PUBLICO] });
  db.seguindo.delete(BIA);
  const g = db.notas.get(original.id);
  return [r.motivo, g?.texto, g?.impulso?.ator];
}, (r) => r[0] === "impulso" && r[1] === "Texto de verdade" && r[2] === BIA);

await espera("Flag (vinda do ator da instância): vira denúncia na mediação, só com os alvos daqui e o comentário", async () => {
  const r = await enviar({ "@context": AS, id: "https://remota.teste/flags/1", type: "Flag", actor: INST, object: [`${BASE}/api/fediverso/u/autora`, URL_POST_LOCAL, "https://outra.teste/users/x"], content: "Spam <b>repetido</b>" }, { quem: INST, chave: chaves.inst.privada });
  const d = db.denuncias.at(-1);
  return [r.motivo, d?.ator_instancia, d?.alvos?.length, d?.conteudo];
}, (r) => r[0] === "denuncia" && r[1] === INST && r[2] === 2 && r[3] === "Spam repetido");
await espera("Block de fora a alguém daqui e o Undo dele vão para bloqueio_recebido", async () => {
  const bloqueio = { id: "https://remota.teste/blocks/1", type: "Block", actor: BIA, object: `${BASE}/api/fediverso/u/autora` };
  const a = await enviar({ "@context": AS, ...bloqueio });
  const b = await enviar({ "@context": AS, id: "https://remota.teste/blocks/1/undo", type: "Undo", actor: BIA, object: bloqueio });
  return [a.motivo, b.motivo, db.bloqueios.map((x) => `${x.alvo_handle}:${x.sim}`).join()];
}, (r) => r[0] === "bloqueio" && r[1] === "desbloqueio" && r[2] === "autora:true,autora:false");

// Repasse: a resposta de Bia chega pela instância de Cid, assinada por Cid.
await espera("repasse (keyId de outro domínio): confere a assinatura de quem repassou e guarda o que a ORIGEM confirma, não o corpo", async () => {
  const original = novaNota({ inReplyTo: URL_POST_LOCAL, content: "<p>Original da origem</p>" });
  rede.docs.set(original.id, original);
  const r = await enviar(criar({ ...original, content: "<p>Adulterado no repasse</p>" }), { quem: CID, chave: chaves.cid.privada });
  return [r.status, r.motivo, db.notas.get(original.id)?.texto];
}, (r) => r[0] === 202 && r[1] === "recebido" && r[2] === "Original da origem");
await espera("repasse de nota que a origem não confirma (404): nada é guardado", async () => {
  const falsa = novaNota({ inReplyTo: URL_POST_LOCAL });
  const r = await enviar(criar(falsa), { quem: CID, chave: chaves.cid.privada });
  return [r.status, r.motivo, db.notas.has(falsa.id)];
}, (r) => r[0] === 202 && r[1] === "repasse_nao_confirmado" && r[2] === false);
await espera("repasse com a assinatura de quem repassou errada: 401", async () => (await enviar(criar(novaNota({ inReplyTo: URL_POST_LOCAL })), { quem: CID, chave: gerarParDeChaves().privada })).status, (s) => s === 401);
await espera("repasse de Like (que não se repassa): ignorado, nada gravado", async () => {
  const antes = db.interacoes.size;
  const r = await enviar({ "@context": AS, id: "https://remota.teste/likes/9", type: "Like", actor: BIA, object: URL_POST_LOCAL }, { quem: CID, chave: chaves.cid.privada });
  return [r.motivo, db.interacoes.size - antes];
}, (r) => r[0] === "repasse_nao_confirmado" && r[1] === 0);
await espera("Delete repassado só vale se a origem diz que sumiu (410)", async () => {
  const guardada = [...db.notas.keys()].find((k) => k.startsWith("https://remota.teste/notes/"));
  rede.docs.set(guardada, { id: guardada, type: "Note", attributedTo: BIA, content: "ainda existe", to: [PUBLICO] });
  const a = await enviar({ "@context": AS, id: `${guardada}#delete`, type: "Delete", actor: BIA, object: guardada }, { quem: CID, chave: chaves.cid.privada });
  const ficou = db.notas.has(guardada);
  rede.docs.set(guardada, 410);
  const b = await enviar({ "@context": AS, id: `${guardada}#delete`, type: "Delete", actor: BIA, object: guardada }, { quem: CID, chave: chaves.cid.privada });
  return [a.motivo, ficou, b.motivo, db.notas.has(guardada)];
}, (r) => r[0] === "repasse_nao_confirmado" && r[1] === true && r[2] === "apagado" && r[3] === false);

await espera("domínio bloqueado pela mediação: 403 (direto e no repasse)", async () => {
  db.bloqueados.add("remota.teste");
  const a = await enviar(criar(novaNota({ inReplyTo: URL_POST_LOCAL })));
  db.bloqueados.delete("remota.teste");
  db.bloqueados.add("ponte.teste");
  const b = await enviar(criar(novaNota({ inReplyTo: URL_POST_LOCAL })), { quem: CID, chave: chaves.cid.privada });
  db.bloqueados.delete("ponte.teste");
  return [a.status, b.status];
}, (r) => r[0] === 403 && r[1] === 403);
await espera("assinatura velha (13 h): 401", async () => (await enviar(criar(novaNota({ inReplyTo: URL_POST_LOCAL })), { data: new Date(Date.now() - 13 * 3_600_000) })).motivo, (m) => m === "data_fora_da_janela");
await espera("Digest errado (corpo trocado depois de assinar): 401", async () => {
  const a = criar(novaNota({ inReplyTo: URL_POST_LOCAL }));
  const r = await enviar(a, { corpoEnviado: JSON.stringify({ ...a, object: { ...a.object, content: "<p>trocado</p>" } }) });
  return [r.status, r.motivo, db.notas.has(a.object.id)];
}, (r) => r[0] === 401 && r[1] === "digest_diferente" && r[2] === false);

// ═══════════════════ Com a chave desligada: como antes ═══════════════════
process.env.NEXT_PUBLIC_RECURSOS = "rede-v2";
await espera("chave desligada: modoTotal falso; Like ignorado; repasse 401; rotas novas responderiam 404", async () => {
  const like = await enviar({ "@context": AS, id: "https://remota.teste/likes/50", type: "Like", actor: BIA, object: URL_POST_LOCAL });
  const repasse = await enviar(criar(novaNota({ inReplyTo: URL_POST_LOCAL })), { quem: CID, chave: chaves.cid.privada });
  return [servidor.modoTotal(), servidor.gruposLigados(), like.motivo, repasse.status, repasse.motivo, db.interacoes.has("https://remota.teste/likes/50")];
}, (r) => r[0] === false && r[1] === false && r[2] === "ignorado" && r[3] === 401 && r[4] === "chave_de_outro_dominio" && r[5] === false);
await espera("chave desligada: 'todos' NÃO liga o modo total (só pelo nome)", async () => {
  process.env.NEXT_PUBLIC_RECURSOS = "todos,rede-v2";
  const v = servidor.modoTotal();
  process.env.NEXT_PUBLIC_RECURSOS = "rede-v2,fediverso-total,-fediverso-total";
  const w = servidor.modoTotal();
  return [v, w];
}, (r) => r[0] === false && r[1] === false);
process.env.NEXT_PUBLIC_RECURSOS = LIGADO;

// ═══════════════════ A fila do modo total ═══════════════════
const autora = gerarParDeChaves();
const item = (id, tipo, destino, extra = {}, objeto = "https://remota.teste/notes/1") => ({ id, tipo, objeto, destino, extra, tentativas: 0, handle: "autora", chave_publica: autora.publica, chave_privada: cifrar(autora.privada, SEGREDO) });
const conferirEntrega = (e, publica) => conferirAssinatura({ metodo: "POST", caminho: new URL(e.url).pathname, ler: leitor(e.cab), corpo: JSON.stringify(e.corpo), chavePublica: publica }).ok;

await espera("like, undo-like e announce saem assinados pela pessoa; o Undo repete o id do Like", async () => {
  rede.entregas = [];
  rede.post = () => ({ status: 202 });
  db.fila.push(item(1, "like", "https://remota.teste/inbox"), item(2, "undo-like", "https://remota.teste/inbox"), item(3, "announce", "https://remota.teste/inbox"));
  const r = await entrega.processarFila(200);
  const [like, undo, ann] = [1, 2, 3].map((i) => rede.entregas.find((e) => e.corpo.type === ["Like", "Undo", "Announce"][i - 1]));
  return [r.entregues, like?.corpo.actor, undo?.corpo.object.id === like?.corpo.id, ann?.corpo.to?.[0], [like, undo, ann].every((e) => e && conferirEntrega(e, autora.publica)), like?.cab.Signature.includes(`keyId="${BASE}/api/fediverso/u/autora#main-key"`)];
}, (r) => r[0] === 3 && r[1] === `${BASE}/api/fediverso/u/autora` && r[2] && r[3] === PUBLICO && r[4] && r[5]);
await espera("Flag sai assinada pelo ATOR DA INSTÂNCIA, sem o @ de quem denunciou", async () => {
  rede.entregas = [];
  db.fila.push(item(4, "flag", "https://remota.teste/inbox", { alvos: [BIA, "https://remota.teste/notes/1"], conteudo: "spam", atividade: `${BASE}/api/fediverso/atividades/flag/1` }));
  await entrega.processarFila(200);
  const e = rede.entregas[0];
  return [e?.corpo.type, e?.corpo.actor, JSON.stringify(e?.corpo ?? {}).includes("autora"), e?.cab.Signature.includes(`keyId="${BASE}/api/fediverso/ator#main-key"`), e && conferirEntrega(e, db.instancia.publica)];
}, (r) => r[0] === "Flag" && r[1] === `${BASE}/api/fediverso/ator` && r[2] === false && r[3] && r[4]);
await espera("410 numa caixa: recusa definitiva e o seguidor daquela caixa é apagado", async () => {
  db.seguidores.push({ handle: "autora", ator: "https://sumiu.teste/users/z", inbox: "https://sumiu.teste/users/z/inbox", compartilhada: null });
  rede.post = (url) => ({ status: url.host === "sumiu.teste" ? 410 : 202 });
  db.fila.push(item(5, "create", "https://sumiu.teste/users/z/inbox", {}, POST_LOCAL));
  const r = await entrega.processarFila(200);
  const f = db.feitos.find((x) => x.id === 5);
  return [r.descartados, f?.status, f?.definitivo, db.seguidores.some((s) => s.ator === "https://sumiu.teste/users/z")];
}, (r) => r[0] === 1 && r[1] === 410 && r[2] === true && r[3] === false);
await espera("429 com Retry-After: o item espera o pedido e os outros do domínio esperam junto, sem gastar tentativa", async () => {
  rede.entregas = [];
  rede.post = (url) => (url.host === "calma.teste" ? { status: 429, retryAfter: "120" } : { status: 202 });
  db.fila.push(...[6, 7, 8, 9].map((i) => item(i, "like", "https://calma.teste/inbox")));
  const antes = Date.now();
  await entrega.processarFila(200);
  const feitos = db.feitos.filter((x) => x.id >= 6 && x.id <= 9);
  const com429 = feitos.filter((x) => x.status === 429);
  const esperando = feitos.filter((x) => x.sem_tentativa);
  const ate = Date.parse(com429[0]?.adiar_ate ?? "");
  return [rede.entregas.length, com429.length + esperando.length, ate - antes >= 119_000 && ate - antes <= 125_000, esperando.every((x) => Date.parse(x.adiar_ate) >= ate - 1000)];
}, (r) => r[0] <= 2 && r[1] === 4 && r[2] && r[3]);
await espera("Retry-After como data HTTP e sem valor: lido entre agora e 24 h (sem valor, 5 min)", async () => {
  const agora = Date.now();
  return [entrega.lerRetryAfter(new Date(agora + 600_000).toUTCString(), agora).getTime() - agora, entrega.lerRetryAfter(null, agora).getTime() - agora, entrega.lerRetryAfter("999999", agora).getTime() - agora];
}, (r) => r[0] > 590_000 && r[0] <= 600_000 && r[1] === 300_000 && r[2] === 24 * 3_600_000);
await espera("circuito por domínio: 5 falhas de conexão seguidas param o domínio; os itens seguintes esperam sem gastar tentativa", async () => {
  rede.entregas = [];
  rede.post = (url) => (url.host === "morto.teste" ? null : { status: 202 });
  db.fila.push(...Array.from({ length: 10 }, (_, i) => item(100 + i, "like", "https://morto.teste/inbox")));
  await entrega.processarFila(200);
  const tentativas = rede.entregas.filter((e) => new URL(e.url).host === "morto.teste").length;
  const esperando = db.feitos.filter((x) => x.id >= 100 && x.id < 110 && x.sem_tentativa && x.erro === "dominio_morto").length;
  return [tentativas, esperando, db.dominios.get("morto.teste")?.morto_ate];
}, (r) => r[0] >= 5 && r[0] <= 6 && r[1] === 10 - r[0] && Boolean(r[2]));
await espera("circuito por domínio: na chamada seguinte, o banco diz que está morto e NENHUM pedido sai para lá", async () => {
  rede.entregas = [];
  db.fila.push(item(200, "like", "https://morto.teste/inbox"), item(201, "like", "https://vivo.teste/inbox"));
  await entrega.processarFila(200);
  const f = db.feitos.find((x) => x.id === 200);
  return [rede.entregas.map((e) => new URL(e.url).host).join(), f?.sem_tentativa, f?.adiar_ate === db.dominios.get("morto.teste").morto_ate];
}, (r) => r[0] === "vivo.teste" && r[1] === true && r[2]);
await espera("no máximo 2 entregas ao mesmo tempo por domínio, e até 10 no total", async () => {
  let agora = 0;
  let maxDominio = 0;
  let maxTotal = 0;
  const porDominio = new Map();
  await entrega.emParalelo(Array.from({ length: 30 }, (_, i) => ({ d: `d${i % 3}` })), (t) => t.d, async (t) => {
    agora++;
    porDominio.set(t.d, (porDominio.get(t.d) ?? 0) + 1);
    maxTotal = Math.max(maxTotal, agora);
    maxDominio = Math.max(maxDominio, ...porDominio.values());
    await new Promise((r) => setTimeout(r, 5));
    porDominio.set(t.d, porDominio.get(t.d) - 1);
    agora--;
  });
  return [maxDominio, maxTotal];
}, (r) => r[0] === 2 && r[1] === 6);
await espera("com a chave desligada, um tipo novo na fila não sai (nada muda em produção)", async () => {
  process.env.NEXT_PUBLIC_RECURSOS = "rede-v2";
  rede.entregas = [];
  rede.post = () => ({ status: 202 });
  db.fila.push(item(300, "like", "https://remota.teste/inbox"));
  await entrega.processarFila(40);
  process.env.NEXT_PUBLIC_RECURSOS = LIGADO;
  const f = db.feitos.find((x) => x.id === 300);
  return [rede.entregas.length, f?.ok, "status" in (f ?? {})];
}, (r) => r[0] === 0 && r[1] === true && r[2] === false);

usarDubleDeRede(null);
console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
