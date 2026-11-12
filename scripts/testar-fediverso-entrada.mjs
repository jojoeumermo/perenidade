// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente F2 do PLANO-FEDIVERSO (entrada, interações e fila do modo "fediverso-total"): atividades ASSINADAS por chaves de
// teste chegam à caixa de entrada (lib/rede/fediverso/caixa.ts), a fila entrega (lib/rede/fediverso/entrega.ts) e as rotas novas
// respondem (chamadas direto pelos handlers). O banco é um DUBLÊ em memória que imita as ações da F3 como estão em
// supabase/migracoes/20261109-fediverso-total.sql (nota_recebida, interacao, fila_pegar, fila_feito, dominio_estado, ator, chaves,
// comunidade, comunidade_chaves, comunidade_seguidor…). ATENÇÃO: o que é regra do BANCO (o 410 apagar o seguidor, o circuito contar
// as falhas entre as chamadas, só-seguidores só com seguidor daqui, o impulso de quem alguém segue) aqui é o dublê; o que este teste
// prova é que o código manda os campos certos e reage ao que o banco devolve. Essas regras precisam ser repetidas com o SQL real em
// scripts/testar-fediverso-banco.mjs (docs/rede/FEDIVERSO-JUNCAO-F2.md). A rede também é um dublê (http.ts → usarDubleDeRede), DEPOIS da
// trava de SSRF: endereço interno nem chega ao dublê.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/carregar-ts.mjs scripts/testar-fediverso-entrada.mjs
import { register } from "node:module";

// As rotas importam "next/server" sem extensão (o Next resolve; o Node puro, não).
register("data:text/javascript," + encodeURIComponent(`export async function resolve(e, c, p) { return p(e === "next/server" ? "next/server.js" : e, c); }`));

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
const rotas = {
  interagir: await import("../app/api/fediverso/interagir/route.ts"),
  responder: await import("../app/api/fediverso/responder/route.ts"),
  remoto: await import("../app/api/fediverso/remoto/route.ts"),
  buscar: await import("../app/api/fediverso/buscar/route.ts"),
  denunciar: await import("../app/api/fediverso/denunciar/route.ts"),
  midia: await import("../app/api/fediverso/midia/route.ts"),
  seguir: await import("../app/api/fediverso/seguir/route.ts"),
  inboxDaComunidade: await import("../app/api/fediverso/c/[slug]/inbox/route.ts"),
};

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

// ═══════════════════ O banco (dublê das ações da F3) ═══════════════════
const PUBLICO = "https://www.w3.org/ns/activitystreams#Public";
const POST_LOCAL = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const URL_POST_LOCAL = `${BASE}/api/fediverso/p/${POST_LOCAL}`;
const GRUPO = `${BASE}/api/fediverso/c/hortas`;
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
  pegos: new Map(),
  feitos: [],
  dominios: new Map(),
  instancia: {},
  chamadas: [],
  // As pessoas daqui (ação "ator"): ligada ou não, e as chaves (nulas até alguém gerar).
  atores: new Map([
    ["autora", { perfil: "perfil-da-autora", ligado: true, pub: null, priv: null }],
    ["desligada", { perfil: "perfil-da-desligada", ligado: false, pub: null, priv: null }],
  ]),
  // As comunidades que podem sair como Group (ação "comunidade").
  comunidades: new Map([["hortas", { pub: null, priv: null }]]),
  grupoSeguidores: [],
  // As funções que a tela chama com a sessão (chamarComoPessoa).
  pessoa: { handle: "autora", ligado: true },
  rpcs: [],
  // O que rede_fed_fio_remoto e rede_fed_perfil_remoto guardam (por id da nota e por ator) e o que a denúncia responde.
  fios: new Map(),
  perfis: new Map(),
  // Quem de fora mandou Block para a pessoa (fediverso_bloqueios_recebidos), mesmo que o ator já não esteja guardado.
  meBloquearam: new Set(),
  denunciaDaTela: () => ({ protocolo: "FED-1", encaminhada: false, ja: false }),
  // O que a tela mandou por último à linha mista e às respostas de um post daqui, e o que estas devolvem.
  ultimaLinha: null,
  ultimasRespostas: null,
  respostasDe: () => ({ itens: [], proximo: null, total: 0 }),
};
const dominioDe = (u) => { try { return new URL(u).host; } catch { return ""; } };
const bloqueado = (u) => { const h = dominioDe(u); return Boolean(h) && [...db.bloqueados].some((d) => h === d || h.endsWith(`.${d}`)); };
const conexao = (s) => s === 0 || s === 502 || s === 503 || s === 504 || (s >= 520 && s <= 526) || s === 530;
const acoes = {
  bloqueado: (p) => bloqueado(p.url),
  remoto: (p) => db.remotos.get(p.ator) ?? null,
  remoto_salvar: (p) => { db.remotos.set(p.ator, { ator: p.ator, chave_id: p.chave_id, chave_publica: p.chave_publica, inbox: p.inbox, inbox_compartilhada: p.compartilhada, handle: p.handle, nome: p.nome, resumo: p.resumo, url: p.url, buscado_em: new Date().toISOString() }); return true; },
  instancia: (p) => { if (p.publica) db.instancia = { publica: p.publica, privada: p.privada }; return db.instancia; },
  ator: (p) => {
    const a = db.atores.get(p.handle);
    if (!a) return { estado: "inexistente" };
    if (!a.ligado) return { estado: "desligado" };
    return { estado: "ligado", perfil: a.perfil, handle: p.handle, nome: p.handle, chave_publica: a.pub, chave_privada: a.priv };
  },
  chaves: (p) => {
    const a = [...db.atores.values()].find((x) => x.perfil === p.perfil);
    if (!a.pub) { a.pub = p.publica; a.priv = p.privada; }
    return { chave_publica: a.pub, chave_privada: a.priv };
  },
  comunidade: (p) => {
    const c = db.comunidades.get(p.slug);
    return c ? { estado: "ligado", slug: p.slug, nome: p.slug, chave_publica: c.pub, chave_privada: c.priv } : { estado: "inexistente" };
  },
  comunidade_chaves: (p) => {
    const c = db.comunidades.get(p.slug);
    if (!c.pub) { c.pub = p.publica; c.priv = p.privada; }
    return { chave_publica: c.pub, chave_privada: c.priv };
  },
  comunidade_seguidor: (p) => { db.grupoSeguidores.push(p); return { ok: true }; },
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
    // Regra proposta à F3 (nota de junção): guarda a nota impulsionada se o impulso já foi aceito pela ação interacao.
    const impulso = Boolean(p.impulso && db.interacoes.has(p.impulso.atividade_id));
    if (!["publico", "nao_listado", "seguidores"].includes(p.visibilidade)) return { guardado: false, motivo: "direto" };
    if (p.visibilidade === "seguidores") { if (!segue) return { guardado: false, motivo: "sem_seguidor" }; }
    else if (!segue && !respondeDaqui && !menciona && !impulso) return { guardado: false, motivo: "sem_ligacao" };
    db.notas.set(p.id, p);
    if (respondeDaqui) db.avisos.push({ tipo: "fed_resposta", ator: p.ator, nota: p.id });
    for (const h of p.mencoes_locais) db.avisos.push({ tipo: "fed_mencao", ator: p.ator, handle: h });
    return { guardado: true };
  },
  recebido_apagado: (p) => { db.notas.delete(p.id); return true; },
  ator_apagado: () => true,
  // Como a F3: Like/Announce de post daqui guarda e avisa; Announce de nota de fora só se alguém daqui segue quem impulsionou; o
  // Undo apaga pela atividade (e pelo objeto), sempre só do mesmo ator.
  interacao: (p) => {
    const local = typeof p.post_local === "string" && !p.post_local.startsWith("https://") ? p.post_local : null;
    if (p.sim) {
      if (local) {
        db.interacoes.set(p.atividade_id, p);
        db.avisos.push({ tipo: p.tipo === "like" ? "fed_curtida" : "fed_impulso", ator: p.ator, atividade: p.atividade_id });
        return { ok: true, perfil_autor: "perfil-da-autora" };
      }
      if (p.tipo === "announce" && p.post_local && db.seguindo.has(p.ator)) {
        db.interacoes.set(p.atividade_id, p);
        return { ok: true, perfil_autor: null };
      }
      return { ok: false, motivo: "sem_ligacao" };
    }
    for (const [k, v] of db.interacoes) if (v.ator === p.ator && (k === p.atividade_id || (p.post_local && v.post_local === p.post_local && (!p.tipo || v.tipo === p.tipo)))) db.interacoes.delete(k);
    db.avisos = db.avisos.filter((a) => !(a.ator === p.ator && a.atividade === p.atividade_id));
    return { ok: true, perfil_autor: null };
  },
  denuncia_recebida: (p) => { db.denuncias.push(p); return { protocolo: `FED-${db.denuncias.length}` }; },
  bloqueio_recebido: (p) => { db.bloqueios.push(p); return { ok: true }; },
  post: (p) => ({ id: p.id, tipo: "post", titulo: null, texto: "Post daqui.", corpo: null, aviso: "", criado_em: new Date().toISOString(), editado_em: null, resposta_a: null, handle: "autora" }),
  fila_pegar: (p) => {
    const pegos = db.fila.splice(0, p.limite);
    for (const i of pegos) db.pegos.set(i.id, i);
    return pegos;
  },
  // Como a F3: ok zera o domínio; 410 apaga quem seguia por aquela caixa; 429 devolve a tentativa e espera "espera" segundos; a 5ª
  // falha de conexão seguida mata o domínio por 1 h e devolve morto_ate.
  fila_feito: (p) => {
    db.feitos.push(p);
    const item = db.pegos.get(p.id);
    const d = p.dominio ?? dominioDe(item?.destino ?? "");
    const e = db.dominios.get(d) ?? { falhas: 0, morto_ate: null };
    db.dominios.set(d, e);
    if (p.ok) { e.falhas = 0; e.morto_ate = null; return { ok: true }; }
    if (p.status === 410) { db.seguidores = db.seguidores.filter((s) => s.inbox !== item?.destino && s.compartilhada !== item?.destino); return { ok: true }; }
    if (p.status === 429) return { ok: true };
    if ("status" in p && conexao(p.status)) {
      e.falhas++;
      if (e.falhas >= 5) { e.morto_ate = new Date(Date.now() + 3_600_000).toISOString(); e.falhas = 0; return { ok: true, morto_ate: e.morto_ate }; }
    }
    return { ok: true };
  },
  dominio_estado: (p) => ({ morto_ate: db.dominios.get(p.dominio)?.morto_ate ?? null }),
};
// As funções da tela (com a sessão da pessoa), no formato do PostgREST.
const funcoesDaPessoa = {
  rede_fed_eu: () => ({ perfil: `perfil-da-${db.pessoa.handle}`, handle: db.pessoa.handle, ligado: db.pessoa.ligado, total: true }),
  rede_fed_interagir: (a) => ({ ok: true, curti: a.p_tipo === "like" && a.p_sim, impulsionei: a.p_tipo === "announce" && a.p_sim }),
  rede_fed_linha_mista: (a) => (db.ultimaLinha = a) && ({
    itens: [{ id: "https://remota.teste/notes/l1", origem: "fediverso", avatar: "https://remota.teste/av.png", midia: [{ url: "https://remota.teste/m/l1.png", tipo: "image/png", alt: "x" }, { url: "javascript:alert(1)", tipo: "image/png" }] }],
    proximo: null,
  }),
  // rede_fed_fio_remoto devolve um OBJETO { post, acima, respostas }; o post daqui no meio vem no formato de rede_post_v2 (id em uuid).
  rede_fed_fio_remoto: (a) => db.fios.get(a.p_id) ?? new Response(JSON.stringify({ message: "nao_encontrado" }), { status: 400 }),
  rede_fed_perfil_remoto: (a) => db.perfis.get(a.p_ator) ?? new Response(JSON.stringify({ message: "nao_encontrado" }), { status: 400 }),
  rede_fed_me_bloqueou: (a) => db.meBloquearam.has(a.p_ator),
  rede_fed_denunciar_remoto: (a) => db.denunciaDaTela(a),
  rede_fed_respostas_de: (a) => { db.ultimasRespostas = a; return db.respostasDe(a); },
  rede_fed_seguindo_lista: () => [],
};
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const funcao = /^http:\/\/banco\.teste\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(u)?.[1];
  if (!funcao) throw new Error(`fetch inesperado: ${u}`);
  const corpo = JSON.parse(String(init.body ?? "{}"));
  if (funcao !== "rede_fed_servidor") {
    db.rpcs.push(funcao);
    const f = funcoesDaPessoa[funcao];
    if (!f) return new Response(JSON.stringify({ message: `funcao_desconhecida:${funcao}` }), { status: 400 });
    const dado = f(corpo);
    return dado instanceof Response ? dado : new Response(JSON.stringify(dado), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  db.chamadas.push(corpo.p_acao);
  const f = acoes[corpo.p_acao];
  if (corpo.p_segredo !== SEGREDO || !f) return new Response(JSON.stringify({ message: `acao_desconhecida:${corpo.p_acao}` }), { status: 400 });
  return new Response(JSON.stringify(f(corpo.p ?? {}) ?? null), { status: 200, headers: { "Content-Type": "application/json" } });
};

// ═══════════════════ A rede (dublê, depois da trava de SSRF) ═══════════════════
const rede = { docs: new Map(), gets: [], entregas: [], redirecionar: new Map(), post: () => ({ status: 202 }) };
usarDubleDeRede(async (url, o) => {
  if ((o.metodo ?? "GET") === "GET") {
    rede.gets.push(url.href);
    if (rede.redirecionar.has(url.href)) return { status: 302, local: rede.redirecionar.get(url.href), tipo: "", texto: "" };
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
/** Manda uma atividade assinada à caixa compartilhada (ou, com `comunidade`, à do Group). */
async function enviar(atividade, { quem = BIA, chave = chaves.bia.privada, data, corpoEnviado, comunidade } = {}) {
  const corpo = JSON.stringify(atividade);
  const caminho = comunidade ? `/api/fediverso/c/${comunidade}/inbox` : CAMINHO;
  const cab = assinarPedido({ metodo: "POST", url: `${BASE}${caminho}`, corpo, chaveId: `${quem}#main-key`, chavePrivada: chave, data });
  return receber("POST", caminho, leitor(cab), new TextEncoder().encode(corpoEnviado ?? corpo), comunidade ? { comunidade } : {});
}
let n = 0;
const AS = "https://www.w3.org/ns/activitystreams";
const novaNota = (extra = {}) => ({ id: `https://remota.teste/notes/${++n}`, type: "Note", attributedTo: BIA, content: "<p>Olá daqui de fora</p>", to: [PUBLICO], cc: [`${BIA}/followers`], published: new Date().toISOString(), ...extra });
const criar = (objeto, ator = BIA) => ({ "@context": AS, id: `${objeto.id}/activity`, type: "Create", actor: ator, object: objeto });
const TOKEN = "Bearer token-de-teste-da-sessao-0123456789";
const pedidoDaTela = (caminho, { metodo = "POST", corpo, token = true } = {}) =>
  new Request(`${BASE}${caminho}`, { method: metodo, headers: { "content-type": "application/json", ...(token ? { authorization: TOKEN } : {}), "cf-connecting-ip": `203.0.113.${++n % 250}` }, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });

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
await espera("rota-proxy: a URL da mídia sai assinada com validade e só a assinatura certa, ainda valendo, confere", async () => {
  const proxy = servidor.urlDaMidia("https://remota.teste/m/1.png");
  const q = new URL(proxy, BASE).searchParams;
  const [u, e, s] = [q.get("u"), q.get("e"), q.get("s")];
  const ate = Number(e) * 1000 - Date.now();
  return [
    proxy.startsWith("/api/fediverso/midia?u="),
    servidor.midiaAssinada(u, e, s),
    servidor.midiaAssinada("https://remota.teste/m/2.png", e, s),
    servidor.midiaAssinada(u, e, "x".repeat(32)),
    servidor.midiaAssinada(u, String(Number(e) + 604800), s),
    servidor.midiaAssinada(u, e, s, Number(e) * 1000 + 1),
    servidor.urlDaMidia("http://remota.teste/a.png"),
    ate > 7 * 86_400_000 - 1000 && ate <= 14 * 86_400_000,
  ];
}, (r) => r[0] && r[1] && !r[2] && !r[3] && !r[4] && !r[5] && r[6] === null && r[7]);
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
}, (r) => r[0] === "sem_seguidor" && r[1] === false);
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

// ── Sotaques por software (B6) ──
await espera("Lemmy: Announce{Create{Page}} da comunidade, de quem alguém segue: a nota de DENTRO é buscada na origem e guardada, com o link do post", async () => {
  const COMUNIDADE = "https://remota.teste/c/moradia";
  rede.docs.set(COMUNIDADE, { ...atorDoc(COMUNIDADE, chaves.bia.publica), type: "Group" });
  db.seguindo.add(COMUNIDADE);
  const pagina = { id: "https://lemmy.teste/post/77", type: "Page", attributedTo: "https://lemmy.teste/u/rui", name: "Despejo na Zona Leste", content: "<p>Precisamos de gente.</p>", attachment: [{ type: "Link", href: "https://jornal.teste/materia/1" }], to: [COMUNIDADE, PUBLICO], audience: COMUNIDADE };
  rede.docs.set(pagina.id, pagina);
  const r = await enviar({ "@context": AS, id: "https://remota.teste/activities/announce/77", type: "Announce", actor: COMUNIDADE,
    object: { id: "https://lemmy.teste/activities/create/77", type: "Create", actor: pagina.attributedTo, object: { ...pagina, content: "<p>forjado</p>" } }, to: [PUBLICO] }, { quem: COMUNIDADE, chave: chaves.bia.privada });
  db.seguindo.delete(COMUNIDADE);
  const g = db.notas.get(pagina.id);
  return [r.motivo, g?.texto?.startsWith("Despejo na Zona Leste"), g?.texto?.includes("https://jornal.teste/materia/1"), g?.html_limpo?.includes('href="https://jornal.teste/materia/1"'), g?.texto?.includes("forjado")];
}, (r) => r.join() === "impulso,true,true,true,false");
await espera("Lemmy: Announce de curtida ou de apagamento embrulhado é ignorado (nada é buscado)", async () => {
  const antes = rede.gets.length;
  const a = await enviar({ "@context": AS, id: "https://remota.teste/activities/announce/78", type: "Announce", actor: BIA, object: { id: "https://lemmy.teste/activities/like/1", type: "Like", object: "https://lemmy.teste/post/77" }, to: [PUBLICO] });
  const b = await enviar({ "@context": AS, id: "https://remota.teste/activities/announce/79", type: "Announce", actor: BIA, object: { id: "https://lemmy.teste/activities/delete/1", type: "Delete", object: "https://lemmy.teste/post/77" }, to: [PUBLICO] });
  return [a.motivo, b.motivo, rede.gets.length === antes];
}, (r) => r.join() === "ignorado,ignorado,true");
await espera("PeerTube: Video entra, o autor é a PESSOA (não o canal), o markdown vira texto escapado, a página é a text/html e a miniatura vira imagem", async () => {
  const PESSOA = "https://tube.teste/accounts/ana";
  const r = nota.lerNota({
    id: "https://tube.teste/videos/watch/abc", type: "Video", name: "Mutirão da horta",
    attributedTo: [{ type: "Group", id: "https://tube.teste/video-channels/horta" }, { type: "Person", id: PESSOA }],
    mediaType: "text/markdown", content: "Primeiro **dia**.\n\n<script>alert(1)</script>",
    url: [{ type: "Link", mediaType: "application/x-mpegURL", href: "https://tube.teste/hls/abc.m3u8" }, { type: "Link", mediaType: "text/html", href: "https://tube.teste/w/abc" }],
    icon: [{ type: "Image", url: "https://tube.teste/thumb/abc.jpg", mediaType: "image/jpeg", width: 280, height: 157 }],
    to: [PUBLICO],
  }, PESSOA);
  return [r.ok, r.nota?.url, r.nota?.html_limpo?.includes("<script>"), r.nota?.html_limpo?.includes("&lt;script&gt;"), r.nota?.texto?.startsWith("Mutirão da horta"), r.nota?.midia?.[0]?.url, r.nota?.midia?.[0]?.tipo];
}, (r) => r.join() === "true,https://tube.teste/w/abc,false,true,true,https://tube.teste/thumb/abc.jpg,image/jpeg");
await espera("contentMap: sem 'content', vale o português (ou o primeiro idioma)", async () => [
  nota.lerNota({ id: "https://remota.teste/notes/cm1", type: "Note", attributedTo: BIA, contentMap: { en: "<p>Hello</p>", pt: "<p>Olá</p>" }, to: [PUBLICO] }, BIA).nota?.texto,
  nota.lerNota({ id: "https://remota.teste/notes/cm2", type: "Note", attributedTo: BIA, contentMap: { de: "<p>Hallo</p>" }, to: [PUBLICO] }, BIA).nota?.texto,
], (r) => r.join() === "Olá,Hallo");
await espera("WordPress: o 'summary' de um Article é resumo, não aviso de conteúdo (só vale como aviso se a nota se diz sensível)", async () => [
  nota.lerNota({ id: "https://blog.teste/2026/11/x", type: "Article", attributedTo: "https://blog.teste/author/eu", name: "Título", summary: "Um resumo", content: "<p>Texto</p>", to: [PUBLICO] }, "https://blog.teste/author/eu").nota?.aviso,
  nota.lerNota({ id: "https://blog.teste/2026/11/y", type: "Article", attributedTo: "https://blog.teste/author/eu", name: "Título", summary: "Violência", sensitive: true, content: "<p>Texto</p>", to: [PUBLICO] }, "https://blog.teste/author/eu").nota?.aviso,
  nota.lerNota({ id: "https://remota.teste/notes/cw", type: "Note", attributedTo: BIA, summary: "CW de nota", content: "<p>x</p>", to: [PUBLICO] }, BIA).nota?.aviso,
], (r) => r.join("|") === "|Violência|CW de nota");
await espera("citação (Misskey, Pleroma, Mastodon 4.4): vira um link no fim, sem repetir quando o texto já traz o endereço", async () => {
  const c = "https://outra.teste/notes/citada";
  const a = nota.lerNota({ id: "https://remota.teste/notes/q1", type: "Note", attributedTo: BIA, content: "<p>Olha isso</p>", _misskey_quote: c, to: [PUBLICO] }, BIA).nota;
  const b = nota.lerNota({ id: "https://remota.teste/notes/q2", type: "Note", attributedTo: BIA, content: `<p>RE: <a href="${c}">${c}</a></p>`, quoteUrl: c, to: [PUBLICO] }, BIA).nota;
  const z = nota.lerNota({ id: "https://remota.teste/notes/q3", type: "Note", attributedTo: BIA, content: "<p>x</p>", quote: "javascript:alert(1)", to: [PUBLICO] }, BIA).nota;
  return [a?.texto.endsWith(c), (b?.texto.match(/notes\/citada/g) ?? []).length, z?.html_limpo.includes("javascript")];
}, (r) => r.join() === "true,1,false");

await espera("leitura por GET de servidor bloqueado: a assinatura (cavage ou RFC 9421) ou o User-Agent dizem de onde vem, e vem 403", async () => {
  const { conferirLeitor, dominiosDoLeitor } = await import("../lib/rede/fediverso/rotas.ts");
  db.bloqueados.add("bloqueada.teste");
  try {
    const pedir = (cab) => new Request(`${BASE}/api/fediverso/u/autora`, { headers: cab });
    const cavage = await conferirLeitor(pedir({ signature: 'keyId="https://bloqueada.teste/users/x#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="x"' }));
    const rfc9421 = await conferirLeitor(pedir({ "signature-input": 'sig1=("@method" "@target-uri");keyid="https://www.bloqueada.teste/actor#key";created=1' }));
    const agente = await conferirLeitor(pedir({ "user-agent": "http.rb/5.1.1 (Mastodon/4.3.0; +https://BLOQUEADA.teste./)" }));
    const outro = await conferirLeitor(pedir({ "user-agent": "Mastodon/4.3.0 (+https://remota.teste/)", signature: 'keyId="https://remota.teste/users/bia#main-key"' }));
    const semNada = await conferirLeitor(pedir({ accept: "application/activity+json" }));
    return [cavage?.status, rfc9421?.status, agente?.status, outro, semNada, dominiosDoLeitor(pedir({ "user-agent": "x (+https://a.teste/) (+https://b.teste/) (+https://c.teste/) (+https://d.teste/)" })).length];
  } finally {
    db.bloqueados.delete("bloqueada.teste");
  }
}, (r) => r.join() === "403,403,403,,,3");
await espera("as rotas que servem documentos a outros servidores (ator, post, coleções, comunidade, WebFinger, NodeInfo) conferem o leitor", async () => {
  const fs = await import("node:fs");
  const rotasDeLeitura = ["app/api/fediverso/u/[handle]/route.ts", "app/api/fediverso/u/[handle]/outbox/route.ts", "app/api/fediverso/u/[handle]/seguidores/route.ts",
    "app/api/fediverso/u/[handle]/seguindo/route.ts", "app/api/fediverso/u/[handle]/destaques/route.ts", "app/api/fediverso/p/[id]/route.ts",
    "app/api/fediverso/p/[id]/respostas/route.ts", "app/api/fediverso/p/[id]/midia/[ordem]/route.ts", "app/api/fediverso/c/[slug]/route.ts",
    "app/api/fediverso/c/[slug]/outbox/route.ts", "app/api/fediverso/c/[slug]/seguidores/route.ts", "app/api/fediverso/c/[slug]/moderadores/route.ts",
    "app/api/fediverso/ator/route.ts", "app/api/fediverso/ator/outbox/route.ts", "app/.well-known/webfinger/route.ts", "app/.well-known/nodeinfo/route.ts",
    "app/.well-known/host-meta/route.ts", "app/api/fediverso/nodeinfo/route.ts"];
  return rotasDeLeitura.filter((f) => !/const recusado = await conferirLeitor\(pedido\);\s*if \(recusado\) return recusado;/.test(fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8")));
}, (l) => l.length === 0);

// ── RFC 9421 (HTTP Message Signatures) na entrada ──
const { createHash: hash9421, createSign: assinador9421, generateKeyPairSync: par9421, sign: assinarCru } = await import("node:crypto");
/** Monta e assina um pedido RFC 9421 À MÃO (sem usar o código que está sendo testado), com a chave RSA da Bia. */
function pedido9421(atividade, { cobrir = ["@method", "@target-uri", "content-digest"], criado = Math.floor(Date.now() / 1000), digestErrado = false, alg = "rsa-v1_5-sha256" } = {}) {
  const corpo = JSON.stringify(atividade);
  const host = new URL(BASE).host;
  const cab = {
    host,
    date: new Date().toUTCString(),
    "content-type": "application/activity+json",
    "content-digest": `sha-256=:${hash9421("sha256").update(digestErrado ? `${corpo} ` : corpo).digest("base64")}:`,
  };
  const valores = { "@method": "POST", "@target-uri": `https://${host}${CAMINHO}`, "@authority": host, "@path": CAMINHO, "content-digest": cab["content-digest"] };
  const params = `(${cobrir.map((c) => `"${c}"`).join(" ")});created=${criado};keyid="${BIA}#main-key";alg="${alg}"`;
  const base = [...cobrir.map((c) => `"${c}": ${valores[c]}`), `"@signature-params": ${params}`].join("\n");
  const assinatura = assinador9421("sha256").update(base).sign(chaves.bia.privada, "base64");
  return { corpo, cab: { ...cab, "signature-input": `sig1=${params}`, signature: `sig1=:${assinatura}:` } };
}
const receber9421 = ({ corpo, cab }) => receber("POST", CAMINHO, leitor(cab), new TextEncoder().encode(corpo), {});
await espera("RFC 9421: uma nota assinada só no formato novo (rsa-v1_5-sha256, com Content-Digest) passa a assinatura", async () => {
  const n = novaNota();
  const r = await receber9421(pedido9421(criar(n)));
  return [r.status, r.motivo];
}, (r) => r[0] === 202 && !["sem_assinatura", "assinatura_invalida", "chave_desconhecida", "cabecalhos_faltando"].includes(r[1]));
await espera("RFC 9421: corpo trocado, Content-Digest fora da assinatura, data velha, algoritmo errado e destino não coberto são recusados", async () => {
  const n = novaNota();
  const certo = pedido9421(criar(n));
  const trocado = await receber9421({ ...certo, corpo: certo.corpo.replace("Olá", "Oi!") });
  const digest = await receber9421(pedido9421(criar(novaNota()), { digestErrado: true }));
  const semDigest = await receber9421(pedido9421(criar(novaNota()), { cobrir: ["@method", "@target-uri"] }));
  const velha = await receber9421(pedido9421(criar(novaNota()), { criado: Math.floor(Date.now() / 1000) - 13 * 3600 }));
  const alg = await receber9421(pedido9421(criar(novaNota()), { alg: "hmac-sha256" }));
  const semDestino = await receber9421(pedido9421(criar(novaNota()), { cobrir: ["@method", "content-digest"] }));
  return [trocado, digest, semDigest, velha, alg, semDestino].map((r) => `${r.status}:${r.motivo}`);
}, (r) => r.join() === "401:digest_diferente,401:digest_diferente,401:cabecalhos_faltando,401:data_fora_da_janela,401:algoritmo,401:cabecalhos_faltando");
await espera("RFC 9421 com Ed25519 e RSA-PSS: confere com a chave certa e recusa com a errada", async () => {
  const { conferirAssinatura9421 } = await import("../lib/rede/fediverso/assinatura.ts");
  const ed = par9421("ed25519", { publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const outra = par9421("ed25519", { publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const criado = Math.floor(Date.now() / 1000);
  const host = new URL(BASE).host;
  const params = `("@method" "@authority" "@path");created=${criado};keyid="https://ed.teste/actor#ed"`;
  const base = `"@method": GET\n"@authority": ${host}\n"@path": /api/fediverso/u/autora\n"@signature-params": ${params}`;
  const sig = assinarCru(null, Buffer.from(base), ed.privateKey).toString("base64");
  const cab = { host, "signature-input": `x=${params}`, signature: `x=:${sig}:` };
  const ler = (nome) => cab[nome] ?? null;
  const a = conferirAssinatura9421({ metodo: "GET", caminho: "/api/fediverso/u/autora", ler, chavePublica: ed.publicKey });
  const b = conferirAssinatura9421({ metodo: "GET", caminho: "/api/fediverso/u/autora", ler, chavePublica: outra.publicKey });
  const outroCaminho = conferirAssinatura9421({ metodo: "GET", caminho: "/api/fediverso/u/outra", ler, chavePublica: ed.publicKey });
  return [a.ok, b.ok ? "ok" : b.motivo, outroCaminho.ok ? "ok" : outroCaminho.motivo];
}, (r) => r.join() === "true,assinatura_invalida,assinatura_invalida");

await espera("Move: quem daqui seguia a conta antiga passa a seguir a nova (que declara a antiga em alsoKnownAs) e deixa a antiga", async () => {
  const NOVA = "https://nova.teste/users/bia";
  rede.docs.set(NOVA, { ...atorDoc(NOVA, chaves.bia.publica), alsoKnownAs: [BIA] });
  const seguires = [];
  const guardadas = { seguir: acoes.seguir };
  acoes.seguir = (p) => { seguires.push(`${p.perfil}:${p.ator === NOVA ? "nova" : p.ator === BIA ? "antiga" : p.ator}:${p.sim}`); return { ok: true }; };
  funcoesDaPessoa.rede_fed_mudanca_servidor = (c) => (c.p_segredo === SEGREDO && c.p_acao === "quem_segue" && c.p.ator === BIA ? ["perfil-1", "perfil-2"] : new Response(JSON.stringify({ message: "sem_permissao" }), { status: 400 }));
  try {
    const r = await enviar({ "@context": AS, id: "https://remota.teste/move/1", type: "Move", actor: BIA, object: BIA, target: NOVA });
    return [r.motivo, seguires.join(" ")];
  } finally {
    acoes.seguir = guardadas.seguir;
    delete funcoesDaPessoa.rede_fed_mudanca_servidor;
  }
}, (r) => r[0] === "mudou:2" && r[1] === "perfil-1:nova:true perfil-1:antiga:false perfil-2:nova:true perfil-2:antiga:false");
await espera("Move não confirmado (o ator novo não declara o antigo), de outra pessoa ou para instância bloqueada: ninguém muda", async () => {
  const FALSA = "https://falsa.teste/users/bia";
  rede.docs.set(FALSA, { ...atorDoc(FALSA, chaves.bia.publica), alsoKnownAs: [] });
  db.bloqueados.add("bloqueada.teste");
  try {
    const a = await enviar({ "@context": AS, id: "https://remota.teste/move/2", type: "Move", actor: BIA, object: BIA, target: FALSA });
    const b = await enviar({ "@context": AS, id: "https://remota.teste/move/3", type: "Move", actor: BIA, object: "https://remota.teste/users/outra", target: FALSA });
    const c = await enviar({ "@context": AS, id: "https://remota.teste/move/4", type: "Move", actor: BIA, object: BIA, target: "https://bloqueada.teste/users/bia" });
    return [a.motivo, b.motivo, c.motivo];
  } finally {
    db.bloqueados.delete("bloqueada.teste");
  }
}, (r) => r.join() === "mudanca_nao_confirmada,ignorado,instancia_bloqueada");

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

// ═══════════════════ Impulso, Undo só com id, caixa do Group ═══════════════════
await espera("impulso de nota de fora de quem NINGUÉM daqui segue: 202 sem tocar na rede (nenhum GET)", async () => {
  const antes = rede.gets.length;
  rede.docs.set("https://outra.teste/notes/50", { id: "https://outra.teste/notes/50", type: "Note", attributedTo: "https://outra.teste/users/dani", content: "<p>x</p>", to: [PUBLICO] });
  const r = await enviar({ "@context": AS, id: "https://remota.teste/announces/50", type: "Announce", actor: BIA, object: "https://outra.teste/notes/50", to: [PUBLICO] });
  return [r.status, r.motivo, rede.gets.length - antes, db.notas.has("https://outra.teste/notes/50")];
}, (r) => r[0] === 202 && r[1] === "sem_ligacao" && r[2] === 0 && r[3] === false);
await espera("impulso de nota numa instância BLOQUEADA (mesmo de quem alguém segue): nenhum GET", async () => {
  db.seguindo.add(BIA);
  db.bloqueados.add("bloqueada.teste");
  const antes = rede.gets.length;
  const r = await enviar({ "@context": AS, id: "https://remota.teste/announces/51", type: "Announce", actor: BIA, object: "https://bloqueada.teste/notes/1", to: [PUBLICO] });
  db.bloqueados.delete("bloqueada.teste");
  db.seguindo.delete(BIA);
  return [r.motivo, rede.gets.length - antes];
}, (r) => r[0] === "instancia_bloqueada" && r[1] === 0);
await espera("Undo só com o id (Pleroma/Akkoma): a curtida some; id de outro domínio é ignorado", async () => {
  await enviar({ "@context": AS, id: "https://remota.teste/likes/70", type: "Like", actor: BIA, object: URL_POST_LOCAL });
  const tinha = db.interacoes.has("https://remota.teste/likes/70");
  const fora = await enviar({ "@context": AS, id: "https://remota.teste/u/71", type: "Undo", actor: BIA, object: "https://outra.teste/likes/70" });
  const r = await enviar({ "@context": AS, id: "https://remota.teste/u/70", type: "Undo", actor: BIA, object: "https://remota.teste/likes/70" });
  return [tinha, fora.motivo, r.motivo, db.interacoes.has("https://remota.teste/likes/70")];
}, (r) => r[0] === true && r[1] === "ignorado" && r[2] === "desfez" && r[3] === false);
await espera("Follow ao Group (caixa da comunidade): vira seguidor da comunidade (comunidade_seguidor) e pede entrega", async () => {
  const r = await enviar({ "@context": AS, id: "https://remota.teste/follows/g1", type: "Follow", actor: BIA, object: GRUPO }, { comunidade: "hortas" });
  const s = db.grupoSeguidores.at(-1);
  return [r.motivo, r.entregar, s?.slug, s?.ator, s?.inbox];
}, (r) => r[0] === "seguidor_da_comunidade" && r[1] === true && r[2] === "hortas" && r[3] === BIA && r[4] === `${BIA}/inbox`);
await espera("nota na caixa do Group SEM endereçar o Group (to/cc/audience): não vira post da comunidade", async () => {
  db.seguindo.add(BIA);
  const solta = novaNota();
  const certa = novaNota({ to: [GRUPO], cc: [PUBLICO], audience: GRUPO });
  const a = await enviar(criar(solta), { comunidade: "hortas" });
  const b = await enviar(criar(certa), { comunidade: "hortas" });
  db.seguindo.delete(BIA);
  return [a.motivo, db.notas.get(solta.id)?.comunidade ?? null, b.motivo, db.notas.get(certa.id)?.comunidade];
}, (r) => r[0] === "recebido" && r[1] === null && r[2] === "recebido" && r[3] === "hortas");

// ═══════════════════ As rotas novas ═══════════════════
const ctxSlug = (slug) => ({ params: Promise.resolve({ slug }) });
await espera("rotas com a chave ligada e sem sessão: 401 (interagir, responder, remoto, denunciar)", async () => [
  (await rotas.interagir.POST(pedidoDaTela("/api/fediverso/interagir", { token: false, corpo: { post: "https://remota.teste/notes/1", tipo: "like" } }))).status,
  (await rotas.responder.POST(pedidoDaTela("/api/fediverso/responder", { token: false, corpo: { post: "https://remota.teste/notes/1", texto: "oi" } }))).status,
  (await rotas.remoto.GET(pedidoDaTela("/api/fediverso/remoto?linha=1", { metodo: "GET", token: false }))).status,
  (await rotas.denunciar.POST(pedidoDaTela("/api/fediverso/denunciar", { token: false, corpo: { alvo: BIA, categoria: "spam" } }))).status,
], (r) => r.every((s) => s === 401));
await espera("rota-proxy de mídia: assinatura errada, vencida ou de outra URL dá 404 sem tocar na rede; a certa serve a imagem", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  rede.docs.set("https://remota.teste/m/9.png", png);
  const certa = servidor.urlDaMidia("https://remota.teste/m/9.png");
  const q = new URL(certa, BASE).searchParams;
  const antes = rede.gets.length;
  const errada = await rotas.midia.GET(new Request(`${BASE}/api/fediverso/midia?u=${encodeURIComponent("https://remota.teste/m/9.png")}&e=${q.get("e")}&s=${"A".repeat(32)}`));
  const outra = await rotas.midia.GET(new Request(`${BASE}/api/fediverso/midia?u=${encodeURIComponent("https://remota.teste/m/8.png")}&e=${q.get("e")}&s=${q.get("s")}`));
  const velha = servidor.urlDaMidia("https://remota.teste/m/9.png", Date.now() - 30 * 24 * 3_600_000);
  const vencida = await rotas.midia.GET(new Request(`${BASE}${velha}`));
  const semRede = rede.gets.length === antes;
  const boa = await rotas.midia.GET(new Request(`${BASE}${certa}`));
  return [errada.status, outra.status, vencida.status, semRede, boa.status, boa.headers.get("content-type"), boa.headers.get("cache-control")];
}, (r) => r[0] === 404 && r[1] === 404 && r[2] === 404 && r[3] && r[4] === 200 && r[5] === "image/png" && !/immutable/.test(r[6]));
await espera("P12: com a pasta da VPS, a rodada guarda a imagem na hora sorteada; a rota-proxy serve a cópia sem tocar a origem, não busca fora a que está na fila e a faxina apaga o arquivo", async () => {
  const { mkdtemp, readdir, rm: apagarPasta } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const pasta = await mkdtemp(join(tmpdir(), "fed-midia-"));
  const sha = (u) => createHash("sha256").update(u, "utf8").digest("hex");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 1, 2, 3]);
  const GUARDAR = "https://remota.teste/m/guardar.png";
  const NA_FILA = "https://remota.teste/m/na-fila.png";
  const NAO_SVG = "https://remota.teste/m/nao.svg";
  rede.docs.set(GUARDAR, png);
  rede.docs.set(NA_FILA, png);
  rede.docs.set(NAO_SVG, new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"));
  // O dublê do banco das imagens: a fila com três, uma não é imagem; a faxina devolve a guardada.
  const estados = new Map([[sha(GUARDAR), "pendente"], [sha(NA_FILA), "pendente"], [sha(NAO_SVG), "pendente"]]);
  const vistos = [];
  funcoesDaPessoa.rede_fed_midia_servidor = (c) => {
    vistos.push(c.p_acao);
    if (c.p_segredo !== SEGREDO) return new Response(JSON.stringify({ message: "sem_permissao" }), { status: 400 });
    if (c.p_acao === "pendentes") return [{ chave: sha(GUARDAR), url: GUARDAR }, { chave: sha(NAO_SVG), url: NAO_SVG }, { chave: "f".repeat(64), url: "https://remota.teste/m/chave-errada.png" }];
    if (c.p_acao === "guardada") { estados.set(c.p.chave, c.p.ok ? "guardada" : "falhou"); return { ok: true }; }
    if (c.p_acao === "estado") return { estado: estados.get(c.p.chave) ?? "desconhecida" };
    if (c.p_acao === "faxina") return vistos.includes("estado") ? [sha(GUARDAR)] : [];
    return new Response(JSON.stringify({ message: "invalido:acao" }), { status: 400 });
  };
  process.env.ALUMIA_FEDIVERSO_MIDIA_DIR = pasta;
  try {
    const mg = await import("../lib/rede/fediverso/midia-guardada.ts");
    const rodada = await mg.guardarPendentes(10, 20_000);
    const arquivos = (await readdir(join(pasta, sha(GUARDAR).slice(0, 2)))).filter((f) => !f.endsWith(".parcial"));
    const getsAntes = rede.gets.length;
    const copia = await rotas.midia.GET(new Request(`${BASE}${servidor.urlDaMidia(GUARDAR)}`));
    const daCopia = new Uint8Array(await copia.arrayBuffer());
    const naFila = await rotas.midia.GET(new Request(`${BASE}${servidor.urlDaMidia(NA_FILA)}`));
    const semTocarOrigem = rede.gets.length === getsAntes;
    // A faxina (a próxima rodada) apaga o arquivo da imagem que saiu do registro.
    const outra = await mg.guardarPendentes(0, 1);
    const depois = await readdir(join(pasta, sha(GUARDAR).slice(0, 2))).catch(() => []);
    return [rodada.guardadas, rodada.falhas, arquivos.join() === sha(GUARDAR), copia.status, copia.headers.get("content-type"), daCopia.length === png.length, naFila.status, semTocarOrigem, estados.get(sha(NAO_SVG)), outra.apagadas, depois.length];
  } finally {
    delete process.env.ALUMIA_FEDIVERSO_MIDIA_DIR;
    delete funcoesDaPessoa.rede_fed_midia_servidor;
    await apagarPasta(pasta, { recursive: true, force: true });
  }
}, (r) => r.join() === "1,1,true,200,image/png,true,404,true,falhou,1,0");
await espera("P12: sem a pasta configurada, a rota-proxy busca na hora, como antes (nada da fila é consultado)", async () => {
  const URL_SEM = "https://remota.teste/m/sem-pasta.png";
  rede.docs.set(URL_SEM, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49]));
  const antes = db.rpcs.filter((f) => f === "rede_fed_midia_servidor").length;
  const r = await rotas.midia.GET(new Request(`${BASE}${servidor.urlDaMidia(URL_SEM)}`));
  return [r.status, db.rpcs.filter((f) => f === "rede_fed_midia_servidor").length - antes];
}, (r) => r.join() === "200,0");
await espera("rota-proxy de mídia: redirecionamento para instância bloqueada não é seguido nem servido", async () => {
  db.bloqueados.add("bloqueada.teste");
  rede.redirecionar.set("https://remota.teste/m/10.png", "https://bloqueada.teste/m/10.png");
  rede.docs.set("https://bloqueada.teste/m/10.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]));
  const r = await rotas.midia.GET(new Request(`${BASE}${servidor.urlDaMidia("https://remota.teste/m/10.png")}`));
  db.bloqueados.delete("bloqueada.teste");
  return [r.status, rede.gets.includes("https://bloqueada.teste/m/10.png")];
}, (r) => r[0] === 404 && r[1] === false);
await espera("remoto ?linha: a linha mista vem com avatar e mídia pela rota-proxy assinada (nada de URL de fora, nada de javascript:)", async () => {
  const r = await rotas.remoto.GET(pedidoDaTela("/api/fediverso/remoto?linha=1", { metodo: "GET" }));
  const j = await r.json();
  const c = j.itens?.[0];
  return [r.status, c?.avatar?.startsWith("/api/fediverso/midia?u="), c?.midia?.length, c?.midia?.[0]?.url?.startsWith("/api/fediverso/midia?u="), JSON.stringify(j).includes('"https://remota.teste/m/l1.png"')];
}, (r) => r[0] === 200 && r[1] && r[2] === 1 && r[3] && r[4] === false);
await espera("remoto: o '?midia=' (assinar URL que a tela manda) não existe mais", async () => {
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?midia=${encodeURIComponent("https://qualquer.teste/x.png")}`, { metodo: "GET" }));
  return [r.status, JSON.stringify(await r.json()).includes("/api/fediverso/midia")];
}, (r) => r[0] === 400 && r[1] === false);
// O formato que a tela recebe: sempre o cartão do banco, e NENHUM endereço de fora para o navegador buscar.
const semEnderecoDeForaParaBuscar = (j) => {
  const ruins = [];
  const olhar = (v, chave) => {
    if (Array.isArray(v)) return v.forEach((x) => olhar(x, chave));
    if (v && typeof v === "object") return Object.entries(v).forEach(([k, x]) => olhar(x, k === "url" && Array.isArray(v.midia) ? "pagina" : k));
    if ((chave === "avatar" && v !== null && !String(v).startsWith("/api/fediverso/midia?u=")) || (typeof v === "string" && /\.png/.test(v) && !v.startsWith("/api/fediverso/midia?u="))) ruins.push(`${chave}=${v}`);
  };
  olhar(j, "");
  return ruins;
};
const cartaoDoBanco = (id, extra = {}) => ({ id, origem: "fediverso", tipo: "post", texto: "oi", html: "<p>oi</p>", visibilidade: "publico", criado_em: "2026-11-01T10:00:00Z", autor: { id: null, codinome: "Bia", handle: "bia@remota.teste", perfil: false, equipe: false, remoto: true }, ator_remoto: BIA, handle_remoto: "bia@remota.teste", nome_remoto: "Bia", avatar: "https://remota.teste/av.png", servidor: "remota.teste", url: id, respostas: 1, curti: true, impulsionei: false, midia: [{ url: `https://remota.teste/m/${id.split("/").pop()}.png`, tipo: "image/png", alt: "" }], impulsionado_por: null, ...extra });
await espera("assinarCartao: uma função só troca avatar, mídia, impulsionado_por.avatar, autor.avatar e posts[] pelo proxy; '//host' e http somem; post daqui passa como veio", async () => {
  const c = servidor.assinarCartao({ ...cartaoDoBanco("https://remota.teste/notes/a1"), autor: { codinome: "Bia", avatar: "https://remota.teste/av2.png" }, impulsionado_por: { ator: CID, handle: "cid@ponte.teste", nome: "Cid", avatar: "https://ponte.teste/cid.png", em: "2026-11-01T10:00:00Z" }, posts: [cartaoDoBanco("https://remota.teste/notes/a2")] });
  const ruim = servidor.assinarCartao({ origem: "fediverso", id: "https://remota.teste/notes/a3", avatar: "//remota.teste/av.png", impulsionado_por: { avatar: "http://remota.teste/av.png" }, midia: [{ url: "//remota.teste/m.png" }, { url: "data:image/png;base64,AAAA" }] });
  const daqui = { id: POST_LOCAL, tipo: "post", midia: [{ id: "m1", alt: "" }], autor: { codinome: "Autora" } };
  return [semEnderecoDeForaParaBuscar(c), c.impulsionado_por.avatar?.startsWith("/api/fediverso/midia?u="), c.autor.avatar?.startsWith("/api/fediverso/midia?u="), c.posts[0].midia[0].url.startsWith("/api/fediverso/midia?u="), c.posts[0].avatar?.startsWith("/api/fediverso/midia?u="), ruim.avatar, ruim.impulsionado_por.avatar, ruim.midia.length, servidor.assinarCartao(daqui) === daqui];
}, (r) => r[0].length === 0 && r[1] && r[2] && r[3] && r[4] && r[5] === null && r[6] === null && r[7] === 0 && r[8] === true);
await espera("remoto ?post: com a nota no banco, vem o fio de rede_fed_fio_remoto (post, acima e RESPOSTAS de verdade), tudo em cartão e pelo proxy; o post daqui vem embrulhado", async () => {
  const id = "https://remota.teste/notes/f1";
  const daqui = { id: POST_LOCAL, tipo: "post", texto: "resposta daqui", midia: [], autor: { id: "x", codinome: "Autora", handle: "autora", perfil: true, equipe: false } };
  db.fios.set(id, { post: cartaoDoBanco(id), acima: [daqui, cartaoDoBanco("https://remota.teste/notes/f0")], respostas: [cartaoDoBanco("https://remota.teste/notes/f2", { impulsionado_por: { ator: CID, avatar: "https://ponte.teste/cid.png" } }), daqui] });
  const antes = rede.gets.length;
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent(id)}`, { metodo: "GET" }));
  const j = await r.json();
  return [r.status, j.post?.id, j.post?.curti, j.post?.handle_remoto, j.respostas?.length, j.respostas?.[0]?.origem, j.respostas?.[1]?.local, j.respostas?.[1]?.post?.texto, j.acima?.length, j.acima?.[0]?.local, j.acima?.[1]?.id, semEnderecoDeForaParaBuscar(j), rede.gets.length - antes];
}, (r) => r[0] === 200 && r[1] === "https://remota.teste/notes/f1" && r[2] === true && r[3] === "bia@remota.teste" && r[4] === 2 && r[5] === "fediverso" && r[6] === POST_LOCAL && r[7] === "resposta daqui" && r[8] === 2 && r[9] === POST_LOCAL && r[10] === "https://remota.teste/notes/f0" && r[11].length === 0 && r[12] === 0);
await espera("remoto ?post: sem a nota no banco, o post e os de cima são lidos na origem e saem no MESMO formato de cartão (neutros, 'ao_vivo'), com a mídia pelo proxy", async () => {
  const pai = novaNota({ content: "<p>o de cima</p>" });
  const filha = novaNota({ inReplyTo: pai.id, content: '<p>ao vivo <img src="https://remota.teste/x.png"></p>', attachment: [{ type: "Document", mediaType: "image/png", url: "https://remota.teste/m/v1.png", name: "foto" }] });
  rede.docs.set(pai.id, pai);
  rede.docs.set(filha.id, filha);
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent(filha.id)}&buscar=1`, { metodo: "GET" }));
  const j = await r.json();
  const p = j.post ?? {};
  return [r.status, p.id === filha.id, p.origem, p.ao_vivo, p.curti, p.impulsionei, p.respostas, p.servidor, p.ator_remoto, p.handle_remoto, p.autor?.remoto, p.autor?.codinome, p.visibilidade, p.midia?.[0]?.url?.startsWith("/api/fediverso/midia?u="), /<img/.test(p.html ?? ""), j.acima?.length, j.acima?.[0]?.id === pai.id, j.acima?.[0]?.origem, Array.isArray(j.respostas) && j.respostas.length, semEnderecoDeForaParaBuscar(j)];
}, (r) => r[0] === 200 && r[1] && r[2] === "fediverso" && r[3] === true && r[4] === false && r[5] === false && r[6] === 0 && r[7] === "remota.teste" && r[8] === BIA && r[9] === "bia@remota.teste" && r[10] === true && r[11] === "bia@remota.teste" && r[12] === "publico" && r[13] === true && r[14] === false && r[15] === 1 && r[16] && r[17] === "fediverso" && r[18] === 0 && r[19].length === 0);
await espera("remoto ?post: o post daqui acima de uma nota lida na origem vem como { local: <id> }; nota que não existe dá 404", async () => {
  const filha = novaNota({ inReplyTo: URL_POST_LOCAL });
  rede.docs.set(filha.id, filha);
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent(filha.id)}&buscar=1`, { metodo: "GET" }));
  const j = await r.json();
  const nada = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent("https://remota.teste/notes/nao-existe")}&buscar=1`, { metodo: "GET" }));
  return [r.status, JSON.stringify(j.acima), nada.status, (await nada.json()).erro];
}, (r) => r[0] === 200 && r[1] === JSON.stringify([{ local: POST_LOCAL }]) && r[2] === 404 && r[3] === "nao_encontrado");
await espera("remoto ?ator: o perfil junta numa lista só os posts lidos agora e os do banco (o do banco ganha), tudo em cartão; 'local' vem sem avatar nem mídia de fora", async () => {
  servidor.esquecerOLembrado();
  const DUDA = "https://remota.teste/users/duda";
  const n1 = novaNota({ attributedTo: DUDA, cc: [`${DUDA}/followers`], published: "2026-11-03T10:00:00Z" });
  const n2 = novaNota({ attributedTo: DUDA, cc: [`${DUDA}/followers`], published: "2026-11-02T10:00:00Z" });
  rede.docs.set(DUDA, { ...atorDoc(DUDA, chaves.bia.publica), name: "Duda", outbox: `${DUDA}/outbox`, icon: { type: "Image", url: "https://remota.teste/duda.png" } });
  rede.docs.set(`${DUDA}/outbox`, { type: "OrderedCollection", orderedItems: [criar(n1, DUDA), criar(n2, DUDA)] });
  db.perfis.set(DUDA, { ator: DUDA, handle: "duda@remota.teste", avatar: "https://remota.teste/duda.png", seguindo: "sim", segue_voce: true, bloqueado: false, silenciado: false,
    posts: [cartaoDoBanco(n2.id, { criado_em: "2026-11-02T10:00:00Z" }), cartaoDoBanco("https://remota.teste/notes/so-seguidores", { visibilidade: "seguidores", criado_em: "2026-11-01T10:00:00Z" })] });
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?ator=${encodeURIComponent(DUDA)}`, { metodo: "GET" }));
  const j = await r.json();
  return [r.status, j.handle, j.avatar?.startsWith("/api/fediverso/midia?u="), j.servidor, j.posts?.map((p) => p.id).join(" ") === [n1.id, n2.id, "https://remota.teste/notes/so-seguidores"].join(" "), j.posts?.[0]?.ao_vivo, j.posts?.[0]?.nome_remoto, j.posts?.[1]?.curti, j.posts?.[1]?.ao_vivo, j.local?.seguindo, j.local?.segue_voce, "posts" in (j.local ?? {}), j.local?.avatar?.startsWith("/api/fediverso/midia?u="), semEnderecoDeForaParaBuscar(j)];
}, (r) => r[0] === 200 && r[1] === "duda@remota.teste" && r[2] === true && r[3] === "remota.teste" && r[4] === true && r[5] === true && r[6] === "Duda" && r[7] === true && r[8] === undefined && r[9] === "sim" && r[10] === true && r[11] === false && r[12] === true && r[13].length === 0);
await espera("ataque: abrir um link com ?post=<endereço qualquer> NÃO faz o servidor buscar lá fora (só o toque 'buscar', com buscar=1)", async () => {
  const armada = novaNota({ id: "https://remota.teste/notes/armada-1" });
  rede.docs.set(armada.id, armada);
  const antes = rede.gets.length;
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent(armada.id)}`, { metodo: "GET" }));
  const j = await r.json();
  const zero = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent(armada.id)}&buscar=0`, { metodo: "GET" }));
  const semRede = rede.gets.length - antes;
  const comToque = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent(armada.id)}&buscar=1`, { metodo: "GET" }));
  return [r.status, j.erro, j.servidor, "post" in j, zero.status, semRede, comToque.status, rede.gets.includes(armada.id)];
}, (r) => r[0] === 404 && r[1] === "so_na_origem" && r[2] === "remota.teste" && r[3] === false && r[4] === 404 && r[5] === 0 && r[6] === 200 && r[7] === true);
await espera("ataque: quem foi bloqueado lá fora não lê pelo 'buscar na origem' o post de quem o bloqueou, nem quando o ator já saiu da memória do banco; na dúvida também não; e limite estourado é 429", async () => {
  const IVO = "https://remota.teste/users/ivo";
  const JUCA = "https://remota.teste/users/juca";
  const LEO = "https://remota.teste/users/leo";
  const doIvo = novaNota({ attributedTo: IVO, cc: [`${IVO}/followers`] });
  const doJuca = novaNota({ attributedTo: JUCA, cc: [`${JUCA}/followers`] });
  const doLeo = novaNota({ attributedTo: LEO, cc: [`${LEO}/followers`] });
  for (const n of [doIvo, doJuca, doLeo]) rede.docs.set(n.id, n);
  // Ivo bloqueou a pessoa e já nem está em db.perfis (a faxina tirou o ator; o bloqueio recebido ficou).
  db.meBloquearam.add(IVO);
  const guardada = funcoesDaPessoa.rede_fed_me_bloqueou;
  funcoesDaPessoa.rede_fed_me_bloqueou = (a) =>
    a.p_ator === JUCA ? new Response(JSON.stringify({ message: "falha" }), { status: 500 })
    : a.p_ator === LEO ? new Response(JSON.stringify({ message: "muitos_pedidos" }), { status: 400 })
    : guardada(a);
  const pedir = (n) => rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?post=${encodeURIComponent(n.id)}&buscar=1`, { metodo: "GET" }));
  try {
    const ivo = await pedir(doIvo);
    const juca = await pedir(doJuca);
    const leo = await pedir(doLeo);
    db.meBloquearam.delete(IVO);
    const semBloqueio = await pedir(doIvo);
    return [ivo.status, (await ivo.json()).erro, juca.status, leo.status, (await leo.json()).erro, semBloqueio.status];
  } finally {
    funcoesDaPessoa.rede_fed_me_bloqueou = guardada;
  }
}, (r) => r.join() === "404,nao_encontrado,404,429,muitos_pedidos,200");
await espera("remoto ?linha: o cursor no formato REAL do banco (data com espaço e fuso, '|', a chave) passa e chega inteiro à função", async () => {
  const cursor = "2026-11-10 12:34:56.789+00|https://remota.teste/notes/l1#impulso-de-https://ponte.teste/users/cid";
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?linha=1&limite=20&cursor=${encodeURIComponent(cursor)}`, { metodo: "GET" }));
  const chegou = db.ultimaLinha?.p_cursor;
  const ruins = await Promise.all(["a\nb", "a\tb", "<script>", 'a"b', "a'b", "x".repeat(701)].map(async (c) => (await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?linha=1&cursor=${encodeURIComponent(c)}`, { metodo: "GET" }))).status));
  const limites = await Promise.all(["0", "51", "1.5", "x"].map(async (l) => (await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?linha=1&limite=${l}`, { metodo: "GET" }))).status));
  return [r.status, chegou === cursor, db.ultimaLinha?.p_limite, ruins.join(), limites.join()];
}, (r) => r[0] === 200 && r[1] === true && r[2] === 20 && r[3] === "400,400,400,400,400,400" && r[4] === "400,400,400,400");
await espera("remoto ?respostas: as respostas de fora a um post DAQUI vêm em cartão e pelo proxy, com total e cursor, sem gastar o teto de 'remoto' nem tocar a rede", async () => {
  const cursor = "2026-11-09 08:00:00+00|https://remota.teste/notes/r2";
  db.respostasDe = () => ({ itens: [cartaoDoBanco("https://remota.teste/notes/r1", { resposta_a: URL_POST_LOCAL }), cartaoDoBanco("https://remota.teste/notes/r2"), { id: POST_LOCAL, tipo: "post" }, null, "x"], proximo: cursor, total: 7 });
  const eusAntes = db.rpcs.filter((f) => f === "rede_fed_eu").length;
  const redeAntes = rede.gets.length;
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?respostas=${POST_LOCAL.toUpperCase()}`, { metodo: "GET" }));
  const j = await r.json();
  const primeira = { ...db.ultimasRespostas };
  const r2 = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?respostas=${POST_LOCAL}&cursor=${encodeURIComponent(cursor)}`, { metodo: "GET" }));
  const segunda = { ...db.ultimasRespostas };
  db.respostasDe = () => ({ itens: [], proximo: null, total: 0 });
  return [r.status, j.itens?.length, j.itens?.every((c) => c.origem === "fediverso"), j.proximo === cursor, j.total, semEnderecoDeForaParaBuscar(j), primeira.p_post, primeira.p_cursor, r2.status, segunda.p_cursor === cursor,
    db.rpcs.filter((f) => f === "rede_fed_eu").length - eusAntes, rede.gets.length - redeAntes, r.headers.get("cache-control")];
}, (r) => r[0] === 200 && r[1] === 2 && r[2] === true && r[3] === true && r[4] === 7 && r[5].length === 0 && r[6] === POST_LOCAL && r[7] === null && r[8] === 200 && r[9] === true && r[10] === 0 && r[11] === 0 && /no-store/.test(r[12]));
await espera("remoto ?respostas: id que não é de post daqui, cursor torto e sem sessão são recusados; o erro do banco chega como código", async () => {
  const ruins = await Promise.all(["", "1", "https://remota.teste/notes/1", `${POST_LOCAL}x`, "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4g"].map(async (id) => (await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?respostas=${encodeURIComponent(id)}`, { metodo: "GET" }))).status));
  const cursorTorto = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?respostas=${POST_LOCAL}&cursor=${encodeURIComponent("a\nb")}`, { metodo: "GET" }));
  const semSessao = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?respostas=${POST_LOCAL}`, { metodo: "GET", token: false }));
  db.respostasDe = () => new Response(JSON.stringify({ message: "nao_encontrado" }), { status: 400 });
  const sumiu = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?respostas=${POST_LOCAL}`, { metodo: "GET" }));
  db.respostasDe = () => ({ itens: [], proximo: null, total: 0 });
  return [ruins.join(), cursorTorto.status, semSessao.status, sumiu.status, (await sumiu.json()).erro];
}, (r) => r[0] === "400,400,400,400,400" && r[1] === 400 && r[2] === 401 && r[3] === 404 && r[4] === "nao_encontrado");
await espera("ataque: erro inesperado do banco não vaza nome de tabela nem de coluna no corpo da resposta (vira 'falha')", async () => {
  const cru = 'relation "interno.rede_fed_recebidos" does not exist';
  db.respostasDe = () => new Response(JSON.stringify({ message: cru }), { status: 404 });
  const guardada = funcoesDaPessoa.rede_fed_linha_mista;
  funcoesDaPessoa.rede_fed_linha_mista = () => new Response(JSON.stringify({ message: 'column "chave_privada" does not exist' }), { status: 400 });
  const antigaDenuncia = db.denunciaDaTela;
  db.denunciaDaTela = () => new Response(JSON.stringify({ message: 'duplicate key value violates unique constraint "fediverso_denuncias_pkey"' }), { status: 409 });
  const corpos = [
    await (await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?respostas=${POST_LOCAL}`, { metodo: "GET" }))).text(),
    await (await rotas.remoto.GET(pedidoDaTela("/api/fediverso/remoto?linha=1", { metodo: "GET" }))).text(),
    await (await rotas.denunciar.POST(pedidoDaTela("/api/fediverso/denunciar", { corpo: { alvo: BIA, categoria: "spam" } }))).text(),
  ];
  db.respostasDe = () => ({ itens: [], proximo: null, total: 0 });
  funcoesDaPessoa.rede_fed_linha_mista = guardada;
  db.denunciaDaTela = antigaDenuncia;
  return corpos;
}, (r) => r.every((c) => JSON.parse(c).erro === "falha" && !/interno|relation|column|constraint|chave_privada|pkey/.test(c)));
await espera("remoto ?ator: quando o banco recusa o perfil (federação desligada, sem adesão), a rota recusa junto, sem posts nem 'seguir': 404", async () => {
  servidor.esquecerOLembrado();
  const EVA = "https://remota.teste/users/eva";
  const n1 = novaNota({ attributedTo: EVA, cc: [`${EVA}/followers`] });
  rede.docs.set(EVA, { ...atorDoc(EVA, chaves.bia.publica), name: "Eva", outbox: `${EVA}/outbox` });
  rede.docs.set(`${EVA}/outbox`, { type: "OrderedCollection", orderedItems: [criar(n1, EVA)] });
  // db.perfis não tem a Eva: rede_fed_perfil_remoto responde "nao_encontrado" (o banco recusou).
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?ator=${encodeURIComponent(EVA)}`, { metodo: "GET" }));
  const j = await r.json();
  return [r.status, j.erro, "posts" in j, "local" in j, db.remotos.has(EVA)];
}, (r) => r[0] === 404 && r[1] === "nao_encontrado" && r[2] === false && r[3] === false && r[4] === true);
await espera("remoto ?ator: quando o banco diz que a pessoa de fora BLOQUEOU quem pede, vai só o cabeçalho: nenhum post (nem os lidos agora) e sem página seguinte", async () => {
  servidor.esquecerOLembrado();
  const GIL = "https://remota.teste/users/gil";
  const n1 = novaNota({ attributedTo: GIL });
  rede.docs.set(GIL, { ...atorDoc(GIL, chaves.bia.publica), name: "Gil", outbox: `${GIL}/outbox` });
  rede.docs.set(`${GIL}/outbox`, { type: "OrderedCollection", orderedItems: [criar(n1, GIL)] });
  db.perfis.set(GIL, { ator: GIL, handle: "gil@remota.teste", seguindo: "nao", segue_voce: false, bloqueado: false, silenciado: false, bloqueou_voce: true, posts: [], proximo: null });
  const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?ator=${encodeURIComponent(GIL)}`, { metodo: "GET" }));
  const j = await r.json();
  // Outra pessoa (o banco não diz bloqueou_voce) recebe os posts do mesmo perfil: o que fica na memória do servidor não leva o bloqueio junto.
  db.perfis.set(GIL, { ator: GIL, handle: "gil@remota.teste", seguindo: "nao", segue_voce: false, bloqueado: false, silenciado: true, bloqueou_voce: false, posts: [], proximo: null });
  const j2 = await (await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?ator=${encodeURIComponent(GIL)}`, { metodo: "GET" }))).json();
  return [r.status, j.nome, j.posts?.length, j.proximo, j.local?.bloqueou_voce, j2.posts?.length, j2.local?.bloqueou_voce, j2.posts?.[0]?.silenciado, j2.posts?.[0]?.bloqueado, j2.posts?.[0]?.bloqueou_voce];
}, (r) => r[0] === 200 && r[1] === "Gil" && r[2] === 0 && r[3] === null && r[4] === true && r[5] === 1 && r[6] === false && r[7] === true && r[8] === false && r[9] === false);
await espera("remoto ?ator&cursor: a página seguinte vem só do banco (nada é lido lá fora), pelo proxy; cursor torto é 400 e quem foi bloqueado não recebe nada", async () => {
  servidor.esquecerOLembrado();
  const HUGO = "https://remota.teste/users/hugo";
  const cursor = "2026-11-10 12:34:56.789+00|https://remota.teste/notes/h2";
  const guardada = funcoesDaPessoa.rede_fed_perfil_remoto;
  let pedido = null;
  let bloqueou = false;
  funcoesDaPessoa.rede_fed_perfil_remoto = (a) => {
    pedido = a;
    return { ator: HUGO, handle: "hugo@remota.teste", bloqueou_voce: bloqueou, proximo: "2026-11-09 10:00:00+00|https://remota.teste/notes/h0",
      posts: [{ id: "https://remota.teste/notes/h1", origem: "fediverso", avatar: "https://remota.teste/av.png", midia: [{ url: "https://remota.teste/m/h1.png", tipo: "image/png", alt: "x" }] }, { id: "nao-e-cartao" }, "lixo"] };
  };
  const redeAntes = rede.gets.length;
  try {
    const r = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?ator=${encodeURIComponent(HUGO)}&cursor=${encodeURIComponent(cursor)}`, { metodo: "GET" }));
    const j = await r.json();
    const torto = await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?ator=${encodeURIComponent(HUGO)}&cursor=${encodeURIComponent("a\nb")}`, { metodo: "GET" }));
    bloqueou = true;
    const jb = await (await rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?ator=${encodeURIComponent(HUGO)}&cursor=${encodeURIComponent(cursor)}`, { metodo: "GET" }))).json();
    return [r.status, Object.keys(j).sort().join(), j.posts.length, j.posts[0]?.id, semEnderecoDeForaParaBuscar(j).length, j.proximo, pedido.p_cursor === cursor, pedido.p_limite, rede.gets.length - redeAntes, torto.status, jb.posts.length];
  } finally {
    funcoesDaPessoa.rede_fed_perfil_remoto = guardada;
  }
}, (r) => r[0] === 200 && r[1] === "posts,proximo" && r[2] === 1 && r[3] === "https://remota.teste/notes/h1" && r[4] === 0 && r[5] === "2026-11-09 10:00:00+00|https://remota.teste/notes/h0" && r[6] === true && r[7] === 20 && r[8] === 0 && r[9] === 400 && r[10] === 0);
await espera("ataque: reabrir o mesmo perfil (?ator= ou ?conta=) não bate de novo no servidor de fora: fica uns minutos na memória", async () => {
  servidor.esquecerOLembrado();
  const FOX = "https://remota.teste/users/fox";
  rede.docs.set(FOX, { ...atorDoc(FOX, chaves.bia.publica), name: "Fox", outbox: `${FOX}/outbox` });
  rede.docs.set(`${FOX}/outbox`, { type: "OrderedCollection", orderedItems: [] });
  rede.docs.set("https://remota.teste/.well-known/webfinger?resource=acct%3Afox%40remota.teste", { subject: "acct:fox@remota.teste", links: [{ rel: "self", type: "application/activity+json", href: FOX }] });
  db.perfis.set(FOX, { ator: FOX, handle: "fox@remota.teste", seguindo: "nao", segue_voce: false, bloqueado: false, silenciado: false, posts: [] });
  const pedir = (q) => rotas.remoto.GET(pedidoDaTela(`/api/fediverso/remoto?${q}`, { metodo: "GET" }));
  const a = await pedir(`ator=${encodeURIComponent(FOX)}`);
  const depoisDaPrimeira = rede.gets.length;
  const b = await pedir(`ator=${encodeURIComponent(FOX)}`);
  const c = await pedir(`conta=${encodeURIComponent("@fox@remota.teste")}`);
  const depoisDoWebfinger = rede.gets.length;
  const d = await pedir(`conta=${encodeURIComponent("@Fox@remota.teste")}`);
  const j = await d.json();
  return [a.status, b.status, c.status, d.status, depoisDoWebfinger - depoisDaPrimeira, rede.gets.length - depoisDoWebfinger, j.handle, j.local?.seguindo, j.tipo];
}, (r) => r[0] === 200 && r[1] === 200 && r[2] === 200 && r[3] === 200 && r[4] === 1 && r[5] === 0 && r[6] === "fox@remota.teste" && r[7] === "nao" && r[8] === "Person");
await espera("buscar: sem conseguir conferir o bloqueio a rota NÃO busca (403), e a 'first' da caixa de saída em outro servidor não é seguida", async () => {
  servidor.esquecerOLembrado();
  const GIL = "https://remota.teste/users/gil";
  const webfinger = "https://remota.teste/.well-known/webfinger?resource=acct%3Agil%40remota.teste";
  rede.docs.set(GIL, { ...atorDoc(GIL, chaves.bia.publica), name: "Gil", outbox: `${GIL}/outbox` });
  rede.docs.set(`${GIL}/outbox`, { type: "OrderedCollection", first: "https://ponte.teste/coletor?de=gil" });
  rede.docs.set("https://ponte.teste/coletor?de=gil", { type: "OrderedCollectionPage", orderedItems: [] });
  rede.docs.set(webfinger, { subject: "acct:gil@remota.teste", links: [{ rel: "self", type: "application/activity+json", href: GIL }] });
  const pedir = () => rotas.buscar.GET(pedidoDaTela(`/api/fediverso/buscar?conta=${encodeURIComponent("@gil@remota.teste")}`, { metodo: "GET" }));
  const conferir = acoes.bloqueado;
  acoes.bloqueado = () => { throw new Error("banco fora do ar"); };
  const antes = rede.gets.length;
  const semBanco = await pedir();
  const semRede = rede.gets.length - antes;
  acoes.bloqueado = conferir;
  const boa = await pedir();
  const j = await boa.json();
  return [semBanco.status, (await semBanco.json()).erro, semRede, boa.status, j.ator, j.posts?.length, rede.gets.includes("https://ponte.teste/coletor?de=gil")];
}, (r) => r[0] === 403 && r[1] === "instancia_bloqueada" && r[2] === 0 && r[3] === 200 && r[4] === "https://remota.teste/users/gil" && r[5] === 0 && r[6] === false);
await espera("interagir: a resposta traz o estado de verdade que o banco devolve (curti, impulsionei)", async () => {
  const pedir = async (corpo) => {
    const r = await rotas.interagir.POST(pedidoDaTela("/api/fediverso/interagir", { corpo })).catch(() => null);
    return r ? await r.json() : null;
  };
  const a = await pedir({ post: "https://remota.teste/notes/1", tipo: "like" });
  const b = await pedir({ post: "https://remota.teste/notes/1", tipo: "announce", sim: false });
  // Fora de um pedido de verdade o after() do Next lança depois de o banco responder e não sobra corpo para ler: aí confere-se
  // no código da rota que a resposta é montada com o que o banco devolveu (e não com o que a tela pediu).
  if (a === null && b === null) {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync(new URL("../app/api/fediverso/interagir/route.ts", import.meta.url), "utf8");
    return fonte.includes("return resposta({ ok: true, tipo, sim, curti: r.dado?.curti === true, impulsionei: r.dado?.impulsionei === true });");
  }
  return a?.ok === true && a.curti === true && a.impulsionei === false && b?.curti === false && b.impulsionei === false;
}, (r) => r === true);
await espera("denunciar: 'encaminhada' é o que o banco FEZ (não o que a tela pediu) e 'ja' chega à tela", async () => {
  // Pediu para encaminhar, mas o banco não encaminhou (sem caixa de destino): a tela não pode dizer que avisou o servidor de lá.
  db.denunciaDaTela = () => ({ protocolo: "FED-7", encaminhada: false, ja: false });
  const a = await (await rotas.denunciar.POST(pedidoDaTela("/api/fediverso/denunciar", { corpo: { alvo: BIA, categoria: "spam", encaminhar: true } }))).json();
  // Já tinha denunciado (e aquela foi encaminhada): volta o protocolo antigo com "ja".
  db.denunciaDaTela = () => ({ protocolo: "FED-3", encaminhada: true, ja: true });
  const b = await (await rotas.denunciar.POST(pedidoDaTela("/api/fediverso/denunciar", { corpo: { alvo: BIA, categoria: "spam" } }))).json();
  db.denunciaDaTela = () => ({ protocolo: "FED-1", encaminhada: false, ja: false });
  return [a.ok, a.protocolo, a.encaminhada, a.ja, b.protocolo, b.encaminhada, b.ja];
}, (r) => r[0] === true && r[1] === "FED-7" && r[2] === false && r[3] === false && r[4] === "FED-3" && r[5] === true && r[6] === true);
await espera("seguir e interagir: quem DESLIGOU a federação recebe 409 e nada vai para a fila (nem no modo total)", async () => {
  db.pessoa = { handle: "desligada", ligado: false };
  const antes = db.rpcs.filter((f) => f === "rede_fed_interagir").length;
  const a = await rotas.seguir.POST(pedidoDaTela("/api/fediverso/seguir", { corpo: { ator: BIA } }));
  const b = await rotas.interagir.POST(pedidoDaTela("/api/fediverso/interagir", { corpo: { post: "https://remota.teste/notes/1", tipo: "like" } }));
  const c = await rotas.responder.POST(pedidoDaTela("/api/fediverso/responder", { corpo: { post: "https://remota.teste/notes/1", texto: "oi" } }));
  // E se o banco ainda dissesse "ligado" no rede_fed_eu, a ação "ator" (que confere impedimento) segura do mesmo jeito.
  db.pessoa = { handle: "desligada", ligado: true };
  const d = await rotas.interagir.POST(pedidoDaTela("/api/fediverso/interagir", { corpo: { post: "https://remota.teste/notes/1", tipo: "like" } }));
  db.pessoa = { handle: "autora", ligado: true };
  return [a.status, b.status, c.status, d.status, db.rpcs.filter((f) => f === "rede_fed_interagir").length - antes, db.atores.get("desligada").pub];
}, (r) => r.slice(0, 4).every((s) => s === 409) && r[4] === 0 && r[5] === null);
await espera("interagir de quem federa e nunca teve chave: o par é gerado ANTES de ir para a fila", async () => {
  db.atores.get("autora").pub = null;
  db.atores.get("autora").priv = null;
  const antes = db.rpcs.filter((f) => f === "rede_fed_interagir").length;
  // O after() do Next só existe dentro de um pedido de verdade: aqui ele pode falhar DEPOIS de a fila receber o item.
  await rotas.interagir.POST(pedidoDaTela("/api/fediverso/interagir", { corpo: { post: "https://remota.teste/notes/1", tipo: "like" } })).catch(() => null);
  return [Boolean(db.atores.get("autora").pub), db.rpcs.filter((f) => f === "rede_fed_interagir").length - antes];
}, (r) => r[0] === true && r[1] === 1);
await espera("caixa do Group: comunidade que não pode sair (ou não existe) dá 404 sem ler a atividade", async () => {
  const r = await rotas.inboxDaComunidade.POST(new Request(`${BASE}/api/fediverso/c/fechada/inbox`, { method: "POST", headers: { "content-type": "application/activity+json" }, body: "{}" }), ctxSlug("fechada"));
  return r.status;
}, (s) => s === 404);

// ═══════════════════ Com a chave desligada: como antes ═══════════════════
process.env.NEXT_PUBLIC_RECURSOS = "rede-v2";
await espera("chave desligada: modoTotal falso; Like ignorado; repasse 401", async () => {
  const like = await enviar({ "@context": AS, id: "https://remota.teste/likes/50", type: "Like", actor: BIA, object: URL_POST_LOCAL });
  const repasse = await enviar(criar(novaNota({ inReplyTo: URL_POST_LOCAL })), { quem: CID, chave: chaves.cid.privada });
  return [servidor.modoTotal(), servidor.gruposLigados(), like.motivo, repasse.status, repasse.motivo, db.interacoes.has("https://remota.teste/likes/50")];
}, (r) => r[0] === false && r[1] === false && r[2] === "ignorado" && r[3] === 401 && r[4] === "chave_de_outro_dominio" && r[5] === false);
await espera("chave desligada: TODAS as rotas novas respondem 404 (interagir, responder, remoto, denunciar, midia, c/[slug]/inbox)", async () => {
  const midia = servidor.urlDaMidia("https://remota.teste/m/9.png");
  return [
    (await rotas.interagir.POST(pedidoDaTela("/api/fediverso/interagir", { corpo: { post: "https://remota.teste/notes/1", tipo: "like" } }))).status,
    (await rotas.responder.POST(pedidoDaTela("/api/fediverso/responder", { corpo: { post: "https://remota.teste/notes/1", texto: "oi" } }))).status,
    (await rotas.remoto.GET(pedidoDaTela("/api/fediverso/remoto?linha=1", { metodo: "GET" }))).status,
    (await rotas.denunciar.POST(pedidoDaTela("/api/fediverso/denunciar", { corpo: { alvo: BIA, categoria: "spam" } }))).status,
    (await rotas.midia.GET(new Request(`${BASE}${midia}`))).status,
    (await rotas.inboxDaComunidade.POST(new Request(`${BASE}/api/fediverso/c/hortas/inbox`, { method: "POST", body: "{}" }), ctxSlug("hortas"))).status,
  ];
}, (r) => r.every((s) => s === 404));
await espera("chave desligada: seguir continua pedindo 'ligado' (como antes)", async () => {
  db.pessoa = { handle: "desligada", ligado: false };
  const r = await rotas.seguir.POST(pedidoDaTela("/api/fediverso/seguir", { corpo: { ator: BIA } }));
  db.pessoa = { handle: "autora", ligado: true };
  return r.status;
}, (s) => s === 409);
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
db.atores.get("autora").pub = autora.publica;
db.atores.get("autora").priv = cifrar(autora.privada, SEGREDO);
let proximoId = 1;
const item = (tipo, destino, extra = {}, objeto = "https://remota.teste/notes/1", resto = {}) => ({ id: proximoId++, tipo, objeto, destino, extra, tentativas: 1, handle: "autora", assinante: "pessoa", chave_publica: autora.publica, chave_privada: cifrar(autora.privada, SEGREDO), ...resto });
const conferirEntrega = (e, publica) => conferirAssinatura({ metodo: "POST", caminho: new URL(e.url).pathname, ler: leitor(e.cab), corpo: JSON.stringify(e.corpo), chavePublica: publica }).ok;
const keyId = (e) => /keyId="([^"]+)"/.exec(e?.cab?.Signature ?? "")?.[1];
const feito = (id) => db.feitos.find((x) => x.id === id);

await espera("Update(Person): o perfil mudou e sai o documento do ator inteiro, assinado pela pessoa, para a caixa do seguidor; de outra pessoa, não sai", async () => {
  rede.entregas = [];
  rede.post = () => ({ status: 202 });
  const certo = item("update", "https://remota.teste/inbox", {}, "ator:autora");
  const deOutra = item("update", "https://remota.teste/inbox", {}, "ator:outra");
  db.fila.push(certo, deOutra);
  await entrega.processarFila(200);
  const e = rede.entregas.find((x) => x.corpo.type === "Update" && x.corpo.object?.type === "Person");
  return [
    e?.corpo.actor === `${BASE}/api/fediverso/u/autora`,
    e?.corpo.object?.id === `${BASE}/api/fediverso/u/autora`,
    e?.corpo.object?.publicKey?.publicKeyPem === autora.publica,
    e ? conferirEntrega(e, autora.publica) : false,
    rede.entregas.filter((x) => x.corpo.type === "Update").length,
    Boolean(feito(deOutra.id)),
  ];
}, (r) => r.join() === "true,true,true,true,1,true");
await espera("like, undo-like, announce, undo-announce, block e undo-block saem assinados pela pessoa; cada Undo repete o id do original", async () => {
  rede.entregas = [];
  rede.post = () => ({ status: 202 });
  const uuid = "6f1d2c3b-4a5e-4f60-8172-93a4b5c6d7e8";
  db.fila.push(
    item("like", "https://remota.teste/inbox", { atividade: uuid }),
    item("undo-like", "https://remota.teste/inbox", { atividade: uuid }),
    item("announce", "https://remota.teste/inbox"),
    item("undo-announce", "https://remota.teste/inbox"),
    item("block", "https://remota.teste/inbox", {}, BIA),
    item("undo-block", "https://remota.teste/inbox", {}, BIA),
  );
  const r = await entrega.processarFila(200);
  const de = (t, dentro) => rede.entregas.find((e) => e.corpo.type === t && (!dentro || e.corpo.object?.type === dentro));
  const [like, ulike, ann, uann, blk, ublk] = [de("Like"), de("Undo", "Like"), de("Announce"), de("Undo", "Announce"), de("Block"), de("Undo", "Block")];
  return [
    r.entregues,
    like?.corpo.id === `${BASE}/api/fediverso/atividades/like/${uuid}`,
    ulike?.corpo.object.id === like?.corpo.id,
    uann?.corpo.object.id === ann?.corpo.id,
    ublk?.corpo.object.id === blk?.corpo.id && blk?.corpo.object === BIA,
    ann?.corpo.to?.[0] === PUBLICO,
    [like, ulike, ann, uann, blk, ublk].every((e) => e && conferirEntrega(e, autora.publica) && keyId(e) === `${BASE}/api/fediverso/u/autora#main-key`),
  ];
}, (r) => r[0] === 6 && r.slice(1).every(Boolean));
await espera("item de pessoa SEM chave (só aceitou o consentimento novo): a chave é gerada e o item sai; desligada, é descartado", async () => {
  rede.entregas = [];
  db.atores.set("nova", { perfil: "perfil-da-nova", ligado: true, pub: null, priv: null });
  const a = item("like", "https://remota.teste/inbox", {}, "https://remota.teste/notes/2", { handle: "nova", chave_publica: null, chave_privada: null });
  const b = item("like", "https://remota.teste/inbox", {}, "https://remota.teste/notes/3", { handle: "desligada", chave_publica: null, chave_privada: null });
  db.fila.push(a, b);
  await entrega.processarFila(200);
  const nova = db.atores.get("nova");
  const e = rede.entregas.find((x) => x.corpo.actor === `${BASE}/api/fediverso/u/nova`);
  return [feito(a.id)?.ok, Boolean(nova.pub), e && conferirEntrega(e, nova.pub), feito(b.id)?.erro, feito(b.id)?.definitivo, rede.entregas.some((x) => x.corpo.actor?.endsWith("/desligada"))];
}, (r) => r[0] === true && r[1] && r[2] && r[3] === "sem_chave" && r[4] === true && r[5] === false);
await espera("Flag sai assinada pelo ATOR DA INSTÂNCIA, sem o @ de quem denunciou; id estranho do banco não vira id da atividade", async () => {
  rede.entregas = [];
  db.fila.push(item("flag", "https://remota.teste/inbox", { alvos: [BIA, "https://remota.teste/notes/1"], conteudo: "spam", atividade: "https://malvado.teste/atividade" }, BIA, { handle: null, assinante: "instancia", chave_privada: null }));
  await entrega.processarFila(200);
  const e = rede.entregas[0];
  return [e?.corpo.type, e?.corpo.actor, JSON.stringify(e?.corpo ?? {}).includes("autora"), keyId(e), e && conferirEntrega(e, db.instancia.publica), e?.corpo.id?.startsWith(`${BASE}/api/fediverso/atividades/flag/`)];
}, (r) => r[0] === "Flag" && r[1] === `${BASE}/api/fediverso/ator` && r[2] === false && r[3] === `${BASE}/api/fediverso/ator#main-key` && r[4] && r[5]);
await espera("group-accept e group-announce (criar e apagar) saem pelo Group, com a chave da comunidade gerada na hora", async () => {
  rede.entregas = [];
  const doGrupo = { handle: null, assinante: "grupo", comunidade: "hortas", chave_publica: null, chave_privada: null };
  db.fila.push(
    item("group-accept", `${BIA}/inbox`, { pedido: "https://remota.teste/follows/g1" }, BIA, doGrupo),
    item("group-announce", "https://remota.teste/inbox", { atividade: "create" }, POST_LOCAL, doGrupo),
    item("group-announce", "https://remota.teste/inbox", { atividade: "delete" }, POST_LOCAL, doGrupo),
  );
  await entrega.processarFila(200);
  const pub = db.comunidades.get("hortas").pub;
  const [ac, cria, apaga] = [rede.entregas.find((e) => e.corpo.type === "Accept"), rede.entregas.find((e) => e.corpo.object?.type === "Create"), rede.entregas.find((e) => e.corpo.object?.type === "Delete")];
  return [
    Boolean(pub),
    ac?.corpo.actor === GRUPO && ac?.corpo.object.object === GRUPO && ac?.corpo.object.id === "https://remota.teste/follows/g1",
    cria?.corpo.type === "Announce" && cria?.corpo.actor === GRUPO && cria?.corpo.object.object?.id === `${BASE}/api/fediverso/p/${POST_LOCAL}`,
    apaga?.corpo.type === "Announce" && apaga?.corpo.object.object?.id === `${BASE}/api/fediverso/p/${POST_LOCAL}`,
    [ac, cria, apaga].every((e) => e && keyId(e) === `${GRUPO}#main-key` && conferirEntrega(e, pub)),
  ];
}, (r) => r.every(Boolean));
await espera("410 numa caixa: o fila_feito leva status 410 e o banco apaga o seguidor daquela caixa", async () => {
  db.seguidores.push({ handle: "autora", ator: "https://sumiu.teste/users/z", inbox: "https://sumiu.teste/users/z/inbox", compartilhada: null });
  rede.post = (url) => ({ status: url.host === "sumiu.teste" ? 410 : 202 });
  const i = item("create", "https://sumiu.teste/users/z/inbox", {}, POST_LOCAL);
  db.fila.push(i);
  const r = await entrega.processarFila(200);
  return [r.descartados, feito(i.id)?.status, feito(i.id)?.definitivo, db.seguidores.some((s) => s.ator === "https://sumiu.teste/users/z")];
}, (r) => r[0] === 1 && r[1] === 410 && r[2] === true && r[3] === false);
await espera("429 com Retry-After: o item espera o pedido (espera em segundos) e os outros do domínio esperam junto, sem tocar na rede", async () => {
  rede.entregas = [];
  rede.post = (url) => (url.host === "calma.teste" ? { status: 429, retryAfter: "120" } : { status: 202 });
  const itens = [1, 2, 3, 4].map(() => item("like", "https://calma.teste/inbox"));
  db.fila.push(...itens);
  await entrega.processarFila(200);
  const feitos = itens.map((i) => feito(i.id));
  return [rede.entregas.length, feitos.every((f) => f?.status === 429 && f.espera >= 110 && f.espera <= 125), feitos.filter((f) => f?.erro === "http_429").length];
}, (r) => r[0] <= 2 && r[1] && r[2] === 4);
await espera("Retry-After como data HTTP e sem valor: lido entre agora e 24 h (sem valor, 5 min)", async () => {
  const agora = Date.now();
  return [entrega.lerRetryAfter(new Date(agora + 600_000).toUTCString(), agora).getTime() - agora, entrega.lerRetryAfter(null, agora).getTime() - agora, entrega.lerRetryAfter("999999", agora).getTime() - agora];
}, (r) => r[0] > 590_000 && r[0] <= 600_000 && r[1] === 300_000 && r[2] === 24 * 3_600_000);
await espera("circuito: na 5ª falha de conexão o banco devolve morto_ate e os itens seguintes do domínio voltam sem tocar na rede", async () => {
  rede.entregas = [];
  rede.post = (url) => (url.host === "morto.teste" ? null : { status: 202 });
  const itens = Array.from({ length: 10 }, () => item("like", "https://morto.teste/inbox"));
  db.fila.push(...itens);
  await entrega.processarFila(200);
  const tentativas = rede.entregas.filter((e) => new URL(e.url).host === "morto.teste").length;
  const esperando = itens.filter((i) => feito(i.id)?.erro === "dominio_morto" && feito(i.id)?.status === 429).length;
  return [tentativas, esperando, db.dominios.get("morto.teste")?.morto_ate];
}, (r) => r[0] >= 5 && r[0] <= 6 && r[1] === 10 - r[0] && Boolean(r[2]));
await espera("circuito: na chamada seguinte, o banco diz que está morto e NENHUM pedido sai para lá", async () => {
  rede.entregas = [];
  const [a, b] = [item("like", "https://morto.teste/inbox"), item("like", "https://vivo.teste/inbox")];
  db.fila.push(a, b);
  await entrega.processarFila(200);
  return [rede.entregas.map((e) => new URL(e.url).host).join(), feito(a.id)?.status, feito(a.id)?.erro];
}, (r) => r[0] === "vivo.teste" && r[1] === 429 && r[2] === "dominio_morto");
await espera("orçamento de tempo esgotado: nada sai e todo item volta sem gastar tentativa", async () => {
  rede.entregas = [];
  rede.post = () => ({ status: 202 });
  const itens = [item("like", "https://a.teste/inbox"), item("like", "https://b.teste/inbox")];
  db.fila.push(...itens);
  const r = await entrega.processarFila(200, -1);
  return [rede.entregas.length, r.adiados, itens.every((i) => feito(i.id)?.erro === "sem_tempo" && feito(i.id)?.status === 429)];
}, (r) => r[0] === 0 && r[1] === 2 && r[2]);
await espera("no máximo 2 entregas ao mesmo tempo por domínio e até 10 no total (15 domínios)", async () => {
  let agora = 0;
  let maxDominio = 0;
  let maxTotal = 0;
  const porDominio = new Map();
  await entrega.emParalelo(Array.from({ length: 60 }, (_, i) => ({ d: i < 30 ? `d${i % 3}` : `d${i % 15}` })), (t) => t.d, async (t) => {
    agora++;
    porDominio.set(t.d, (porDominio.get(t.d) ?? 0) + 1);
    maxTotal = Math.max(maxTotal, agora);
    maxDominio = Math.max(maxDominio, ...porDominio.values());
    await new Promise((r) => setTimeout(r, 5));
    porDominio.set(t.d, porDominio.get(t.d) - 1);
    agora--;
  });
  return [maxDominio, maxTotal];
}, (r) => r[0] === 2 && r[1] === 10);
await espera("com a chave desligada, um tipo novo na fila não sai (nada muda em produção)", async () => {
  process.env.NEXT_PUBLIC_RECURSOS = "rede-v2";
  rede.entregas = [];
  rede.post = () => ({ status: 202 });
  const i = item("like", "https://remota.teste/inbox");
  db.fila.push(i);
  await entrega.processarFila(40);
  process.env.NEXT_PUBLIC_RECURSOS = LIGADO;
  return [rede.entregas.length, feito(i.id)?.ok, "status" in (feito(i.id) ?? {})];
}, (r) => r[0] === 0 && r[1] === true && r[2] === false);

usarDubleDeRede(null);
console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
