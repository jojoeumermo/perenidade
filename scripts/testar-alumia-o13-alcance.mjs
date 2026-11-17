// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 13C, sair da Alumia (supabase/migracoes/20261119-alumia-o13-alcance.sql, lib/rede/alcance/*, app/api/rede/{rss,embed}),
// num Postgres de verdade (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · o que sai: só o post de primeiro nível, aberto à internet, de comunidade aberta (ou de perfil), de conta aberta e à vista; nem
//     resposta, nem membros, nem não listado, arquivado, com prazo, fora do Fediverso, retido ou apagado; nem de conta trancada,
//     invisível, fora da busca ou suspensa; nem de comunidade restrita ou fechada;
//   · RSS de perfil só de organização com selo; com a TRAVA da entrada ligada, nada sai (a função diz nulo e a porta recusa visitante);
//   · quem eu sigo: só a lista de quem chama, sem pedido pendente, sem invisível, com os de fora aceitos; visitante não chama;
//   · as rotas do RSS e do cartão, de ponta a ponta, sobre um serviço falso que repassa ao banco como visitante: 404 com a trava, com o
//     interruptor desligado, com a Alumia interditada e com post que não sai; o cartão sem script, com a política e o sandbox;
//   · as regras puras: escapar, o RSS, o cartão, o código para colar, o arquivo da lista (ida e volta), quebrar o texto da arte, as
//     cores da arte iguais aos tokens, o interruptor só pelo nome e os textos nos seis idiomas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o13-alcance.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 600)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// O ambiente das rotas, ANTES de importar qualquer módulo do site (eles leem as variáveis ao carregar).
const servico = http.createServer();
await new Promise((r) => servico.listen(0, "127.0.0.1", r));
const PORTA = servico.address().port;
process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${PORTA}`;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica-de-teste";
process.env.NEXT_PUBLIC_SITE_URL = "https://exemplo.test";
process.env.NEXT_PUBLIC_ALUMIA_URL = "https://alumia.exemplo.test";
process.env.NEXT_PUBLIC_RECURSOS = "rede-v2,alumia-2,alumia-alcance";

const R = await import("../lib/rede/alcance/regras.ts");
const A = await import("../lib/rede/alcance/arte.ts");
const { alcanceLigado, RECURSO_DO_ALCANCE } = await import("../lib/rede/alcance/ligado.ts");
const { esquecerGuardados } = await import("../lib/rede/alcance/servidor.ts");
const rotaRss = await import("../app/api/rede/rss/[tipo]/[nome]/route.ts");
const rotaCartao = await import("../app/api/rede/embed/[id]/route.ts");

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261119-alumia-o13-alcance.sql");
const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
ok("toda função é security definer com search_path fixo", funcoes.length === 6 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f)));
ok("nenhuma função tem parâmetro do tipo linha com valor padrão", !funcoes.some((f) => /\(([^)]*\binterno\.[a-z_]+\b[^)]*\bdefault\b[^)]*)\)/.test(f.split("\n")[0])));
ok("nenhuma tabela nova e nenhum endereço de rede", !/create table/i.test(sql) && !/\b(inet|cidr)\b/.test(sql));
ok("não mexe na versão da Alumia e termina passando a porta", !/function public\.rede_alumia_versao/.test(sql) && /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("nenhuma localização nem lista de quem segue outra pessoa", !/latitude|longitude|geoloc/i.test(sql) && !/segue = v\b/.test(sql));

// ═══════════════════ 0b. As regras puras ═══════════════════
ok("o interruptor só liga pelo nome (todos não liga)", alcanceLigado(new Set(["alumia-alcance"]), []) && !alcanceLigado(new Set(["todos"]), []) && !alcanceLigado(new Set(["alumia-alcance", "-alumia-alcance"]), []) && RECURSO_DO_ALCANCE === "alumia-alcance");
ok("o interruptor liga nesta montagem de teste", alcanceLigado());
ok("escapar: tags, aspas, controle e direção", R.escapar(`<script>"x"&'y'\u0007‮`) === "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;");
const bases = { alumia: "https://alumia.exemplo.test", site: "https://exemplo.test" };
ok("endereço absoluto: no endereço da Alumia (pt sem prefixo) e no site sem ele", R.enderecoAbsoluto("pt", "/p/1", bases) === "https://alumia.exemplo.test/p/1"
  && R.enderecoAbsoluto("en", "/c/x", bases) === "https://alumia.exemplo.test/en/c/x" && R.enderecoAbsoluto("xx", "/u/a", { alumia: "", site: "https://exemplo.test/" }) === "https://exemplo.test/pt/alumia/u/a");
const itemFalso = {
  id: "11111111-1111-4111-8111-111111111111", tipo: "post", titulo: null, texto: "Linha 1 <b>negrito</b>\n\nLinha 2 & mais", longo: true, aviso: "",
  criado_em: "2026-11-10T12:00:00Z", editado_em: null, comunidade: { slug: "passe-livre", nome: "Passe <Livre>" }, autor: { codinome: "Faísca \"F\"", handle: "faisca" },
};
const textosPt = JSON.parse(ler("i18n/rede/alcance/pt.json"));
const xml = R.montarRss({ tipo: "comunidade", nome: "passe-livre", titulo: "Passe <Livre>", descricao: "", itens: [itemFalso, { ...itemFalso, id: "22222222-2222-4222-8222-222222222222", aviso: "violência policial", texto: "segredo" }] },
  { lang: "pt", bases, textos: textosPt.rss, proprio: "https://exemplo.test/api/rede/rss/c/passe-livre" });
ok("RSS: XML bem formado, sem tag crua de quem escreveu", xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && xml.includes("&lt;b&gt;negrito&lt;/b&gt;") && !xml.includes("<b>") && xml.includes("<category>Passe &lt;Livre&gt;</category>"));
ok("RSS: link do post no endereço da Alumia e o continua do texto longo", xml.includes("<link>https://alumia.exemplo.test/p/11111111-1111-4111-8111-111111111111</link>") && xml.includes("Continua na Alumia: https://alumia.exemplo.test/p/"));
ok("RSS: o título do post com aviso é o aviso, não o texto", xml.includes("<title>Aviso de conteúdo: violência policial</title>") && !xml.includes("<title>segredo"));
const html = R.montarCartao({ ...itemFalso, aviso: "luto" }, { lang: "pt", bases, textos: textosPt.cartao });
ok("cartão: sem script, sem tag de quem escreveu, aviso atrás de um clique", !/<script/i.test(html) && !/ on[a-z]+=/i.test(html) && html.includes("&lt;b&gt;") && html.includes("<details><summary>Aviso de conteúdo: luto"));
ok("cartão: os links abrem fora sem levar de onde veio", html.includes('target="_blank" rel="noopener noreferrer"') && html.includes('<meta name="referrer" content="no-referrer">'));
const politica = R.politicaDoCartao("sha256-abc");
ok("cartão: a política não deixa nada rodar e deixa qualquer site embutir", /default-src 'none'/.test(politica) && /style-src 'sha256-abc'/.test(politica) && !/script-src/.test(politica)
  && /frame-ancestors \*/.test(politica) && /sandbox allow-popups allow-popups-to-escape-sandbox/.test(politica) && /form-action 'none'/.test(politica));
const colar = R.codigoParaColar('https://exemplo.test/api/rede/embed/x"><script>', "Título");
ok("código para colar: quadro com sandbox sem scripts e endereço escapado", colar.startsWith("<iframe ") && colar.includes('sandbox="allow-popups allow-popups-to-escape-sandbox"') && !colar.includes("allow-scripts") && !colar.includes("<script>"));
ok("o estilo do cartão só usa tokens declarados nele (sem cor crua fora dos tokens)", (() => {
  const fora = R.ESTILO_DO_CARTAO.replace(/:root\{[^}]*\}/g, "").replace(/@media \(prefers-color-scheme:light\)\{:root\{[^}]*\}\}/g, "");
  return !/#[0-9a-f]{3,8}\b/i.test(fora);
})());
const arquivo = R.arquivoDaLista({ locais: ["faisca", "rosa", "faisca", "X!"], fora: ["Ana@Mastodon.Example", "lixo", "ana@mastodon.example"] }, "alumia.exemplo.test");
ok("arquivo da lista: cabeçalho do Fediverso, sem repetir, só endereços válidos", arquivo === `${R.CABECALHO_DA_LISTA}\nfaisca@alumia.exemplo.test,true,false,\nrosa@alumia.exemplo.test,true,false,\nana@mastodon.example,true,false,\n`);
const lido = R.lerLista(`﻿${arquivo}@Beto@outra.social  @cris@outra.social\nnao-e-conta\n#comentario\nacct:dani@x.org`);
ok("ler a lista: CSV, várias por linha, acct:, sem repetir; o que não é conta conta como ignorada", lido.contas.join() === "faisca@alumia.exemplo.test,rosa@alumia.exemplo.test,ana@mastodon.example,beto@outra.social,cris@outra.social,dani@x.org" && lido.ignoradas === 1);
ok("conta daqui pelo domínio (os dois da Alumia), de fora não", R.handleDaqui("faisca@alumia.exemplo.test", ["alumia.exemplo.test", "exemplo.test"]) === "faisca"
  && R.handleDaqui("faisca@exemplo.test", ["alumia.exemplo.test", "exemplo.test"]) === "faisca" && R.handleDaqui("ana@mastodon.example", ["alumia.exemplo.test"]) === null);
ok("o que pode sair, na tela", R.postPodeSair({ publico: "internet", resposta_a: null, retido: false }) && !R.postPodeSair({ publico: "membros", resposta_a: null, retido: false })
  && !R.postPodeSair({ publico: "internet", resposta_a: "x", retido: false }) && R.postPodeVirarArte({ publico: "membros", resposta_a: null, retido: false, meu: true })
  && !R.postPodeVirarArte({ publico: "membros", resposta_a: null, retido: false, meu: false }));
const medir = (s) => s.length * 10;
ok("arte: quebra em linhas que cabem e corta com …", (() => {
  const l = A.quebrarEmLinhas("uma duas tres quatro cinco seis sete oito nove dez", medir, 100, 3);
  return l.length === 3 && l.every((x) => medir(x) <= 100) && l[2].endsWith("…");
})());
ok("arte: palavra comprida é partida; parágrafos respeitados", (() => {
  const l = A.quebrarEmLinhas("abcdefghijklmnopqrstuvwxyz\n\nfim", medir, 100, 10);
  return l.join("|") === "abcdefghij|klmnopqrst|uvwxyz||fim";
})());
ok("arte: o título encolhe até caber", (() => {
  const r = A.ajustarTitulo("TITULO GRANDE DEMAIS PARA UMA LINHA", (s, t) => s.length * t * 0.5, 600, 2, 120, 40);
  return r.tamanho < 120 && r.linhas.length <= 2;
})());
ok("arte: as cores são as dos tokens da Alumia", (() => {
  const tokens = ler("styles/alumia-tokens.css");
  const escuro = tokens.slice(0, tokens.indexOf("Variante clara"));
  const claro = tokens.slice(tokens.indexOf("[data-al=\"2\"][data-al-tema=\"claro\"]"), tokens.indexOf(":root:not([data-contrast])"));
  const tem = (bloco, nome, cor) => new RegExp(`--al-${nome}: ${cor};`, "i").test(bloco);
  const n = A.PALETA_NOITE;
  const c = A.PALETA_CREME;
  return tem(escuro, "fundo", n.fundo) && tem(escuro, "texto", n.texto) && tem(escuro, "vermelho", n.vermelho) && tem(escuro, "dourado", n.dourado) && tem(escuro, "superficie", n.superficie)
    && tem(claro, "fundo", c.fundo) && tem(claro, "texto", c.texto) && tem(claro, "vermelho", c.vermelho) && tem(claro, "dourado", c.dourado) && tem(claro, "superficie", c.superficie)
    && A.FAIXA_TECIDA.map((f) => f.peso).join("-") === "5-2-3-1-4-2-3-1-3-2-4" && A.FAIXA_TECIDA.every((f) => tokens.toLowerCase().includes(f.cor));
})());
{
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = chaves(textosPt).filter((k) => k !== "_rascunho").sort().join("|");
  const marcas = (o) => JSON.stringify(o).match(/\{\w+\}/g)?.sort().join() ?? "";
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const t = JSON.parse(ler(`i18n/rede/alcance/${l}.json`));
    ok(`os textos em ${l} têm as mesmas chaves e marcadores do português`, chaves(t).filter((k) => k !== "_rascunho").sort().join("|") === base && marcas(t) === marcas(textosPt));
  }
  ok("nenhum texto novo usa as palavras proibidas", !/diploma|universidade|algoritmo/i.test(JSON.stringify(textosPt)));
  ok("toda situação da importação tem texto", ["esperando", "seguindo", "pedido", "naoAchado", "bloqueada", "fediverso", "limite", "erro"].every((s) => typeof textosPt.listas.situacoes[s] === "string"));
}

// Os cabeçalhos do next.config.ts: o cartão sai da regra geral (sem X-Frame-Options nem frame-ancestors 'self'), o resto não.
{
  const leitor = await import("next/dist/compiled/path-to-regexp/index.js");
  const pathToRegexp = leitor.pathToRegexp ?? leitor.default.pathToRegexp;
  const regras = await (await import("../next.config.ts")).default.headers();
  const finais = (caminho) => {
    const r = {};
    for (const regra of regras) if (pathToRegexp(regra.source).test(caminho)) for (const c of regra.headers) r[c.key.toLowerCase()] = c.value;
    return r;
  };
  const cartao = finais("/api/rede/embed/11111111-1111-4111-8111-111111111111");
  ok("cabeçalhos do cartão: sem X-Frame-Options, COOP, CORP nem a política geral (a rota manda a dela)", !("x-frame-options" in cartao) && !("cross-origin-opener-policy" in cartao)
    && !("cross-origin-resource-policy" in cartao) && !("content-security-policy" in cartao) && cartao["x-content-type-options"] === "nosniff");
  ok("cabeçalhos: o RSS e as outras rotas seguem com a regra geral", finais("/api/rede/rss/c/x")["x-frame-options"] === "SAMEORIGIN" && finais("/api/rede/embedx")["x-frame-options"] === "SAMEORIGIN"
    && /frame-ancestors 'self'/.test(finais("/pt/alumia/listas")["content-security-policy"] ?? ""));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
const NOVAS = ["rede_alc_rss", "rede_alc_post", "rede_alc_seguindo"];
await espera("as três funções públicas passam pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)", [NOVAS])).rows,
(rs) => rs.length === 3 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
await espera("as internas não abrem para ninguém de fora; a lista de quem sigo não abre para visitante", async () =>
  (await dono(`select has_function_privilege('anon', 'interno.alumia_alc_sai(interno.rede_posts)', 'execute') as a,
                      has_function_privilege('authenticated', 'interno.alumia_alc_item(interno.rede_posts)', 'execute') as b,
                      has_function_privilege('anon', 'public.rede_alc_seguindo()', 'execute') as c,
                      has_function_privilege('anon', 'public.rede_alc_rss(text, text)', 'execute') as d`)).rows[0],
(r) => !r.a && !r.b && !r.c && r.d);

const P = {};
const NOMES = ["org", "pessoa", "tranca", "invis", "fora", "susp", "eu", "outra"];
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = { papel: "anon", ip: "203.0.113.10" };
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o13.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o13_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update interno.perfis set rede_modo = 'trancado' where id = $1", [P.tranca]);
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [P.invis]);
await dono("update interno.perfis set rede_fora_da_busca = true where id = $1", [P.fora]);
await dono("insert into interno.rede_orgs (perfil, tipo, verificada_em) values ($1, 'coletivo', now())", [P.org]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('o13-aberta', 'Aberta <13>', 'disciplinas', 'aberta'),
            ('o13-restrita', 'Restrita', 'disciplinas', 'restrita'), ('o13-fechada', 'Fechada', 'disciplinas', 'fechada'), ('o13-lutas', 'Lutas', 'lutas', 'aberta') on conflict do nothing`);

const post = async (autor, campos = {}) => {
  const c = { texto: "Post de teste.", publico: "internet", comunidade: "o13-aberta", ...campos };
  const r = await dono(`insert into interno.rede_posts (autor, texto, comunidade, publico, titulo, aviso) values ($1, $2, $3, $4, $5, coalesce($6, '')) returning id`,
    [P[autor], c.texto, c.comunidade, c.publico, c.titulo ?? null, c.aviso ?? null]);
  return r.rows[0].id;
};
const ID = {};
ID.bom = await post("pessoa", { texto: "Assembleia quinta <b>às 19h</b>.", titulo: "Assembleia" });
ID.org = await post("org", { texto: "Prestação de contas." });
ID.orgSemComunidade = await post("org", { texto: "No perfil, sem comunidade.", comunidade: null });
ID.lutas = await post("pessoa", { texto: "Em comunidade que não é de disciplina.", comunidade: "o13-lutas" });
ID.membros = await post("pessoa", { publico: "membros", texto: "Só da Alumia." });
ID.resposta = await (async () => (await dono("insert into interno.rede_posts (autor, texto, comunidade, publico, resposta_a, root_id, profundidade) values ($1, 'Resposta.', 'o13-aberta', 'internet', $2, $2, 1) returning id", [P.outra, ID.bom])).rows[0].id)();
ID.naoListado = await post("pessoa", { texto: "Não listado." });
await dono("update interno.rede_posts set nao_listado = true where id = $1", [ID.naoListado]);
ID.arquivado = await post("pessoa", { texto: "Arquivado." });
await dono("update interno.rede_posts set arquivado_em = now() where id = $1", [ID.arquivado]);
ID.foraFed = await post("pessoa", { texto: "Fora do Fediverso." });
await dono("update interno.rede_posts set fora_do_fediverso = true where id = $1", [ID.foraFed]);
ID.retido = await post("pessoa", { texto: "Retido." });
await dono("update interno.rede_posts set retido = true where id = $1", [ID.retido]);
ID.tranca = await post("tranca", { texto: "De conta trancada." });
ID.invis = await post("invis", { texto: "De conta invisível." });
ID.fora = await post("fora", { texto: "De conta fora da busca." });
ID.susp = await post("susp", { texto: "De conta suspensa." });
await dono("update interno.perfis set suspenso = true where id = $1", [P.susp]);
ID.restrita = await post("pessoa", { comunidade: "o13-restrita", texto: "Na restrita." });
ID.fechada = await post("pessoa", { comunidade: "o13-fechada", texto: "Na fechada." });
ID.aviso = await post("pessoa", { texto: "Texto atrás do aviso.", aviso: "violência" });

// ═══════════════════ 2. O que sai ═══════════════════
await espera("o post bom sai, sem foto, sem número e sem e-mail", () => rpc(visitante, "rede_alc_post", { p_post: ID.bom }),
  (r) => r && r.id === ID.bom && r.titulo === "Assembleia" && r.autor.handle === "o13_pessoa" && r.comunidade.nome === "Aberta <13>" && !("midia" in r) && !("util" in r) && !JSON.stringify(r).includes("@o13.local"));
await espera("o post da organização em comunidade aberta sai", () => rpc(visitante, "rede_alc_post", { p_post: ID.org }), (r) => r && r.comunidade.slug === "o13-aberta");
for (const [nome, chave] of [["membros", "membros"], ["resposta", "resposta"], ["não listado", "naoListado"], ["arquivado", "arquivado"], ["fora do Fediverso", "foraFed"], ["retido", "retido"],
  ["conta trancada", "tranca"], ["conta invisível", "invis"], ["conta fora da busca", "fora"], ["conta suspensa", "susp"], ["comunidade restrita", "restrita"], ["comunidade fechada", "fechada"], ["fora de comunidade de disciplina (a matriz: aí \"internet\" vale membros)", "lutas"], ["perfil sem comunidade (idem)", "orgSemComunidade"]]) {
  await espera(`não sai: ${nome}`, () => rpc(visitante, "rede_alc_post", { p_post: ID[chave] }), (r) => r === null);
}
await espera("post que não existe: nulo (igual)", () => rpc(visitante, "rede_alc_post", { p_post: "00000000-0000-4000-8000-000000000000" }), (r) => r === null);

// ═══════════════════ 3. RSS ═══════════════════
await espera("RSS da comunidade aberta: só o que sai, do mais novo ao mais antigo", () => rpc(visitante, "rede_alc_rss", { p_tipo: "comunidade", p_nome: "o13-aberta" }),
  (r) => r && r.titulo === "Aberta <13>" && r.itens.map((i) => i.id).sort().join() === [ID.bom, ID.aviso, ID.org].sort().join() && r.itens[0].id === ID.aviso);
await espera("RSS da comunidade restrita: nulo", () => rpc(visitante, "rede_alc_rss", { p_tipo: "comunidade", p_nome: "o13-restrita" }), (r) => r === null);
await espera("RSS da comunidade fechada: nulo", () => rpc(visitante, "rede_alc_rss", { p_tipo: "comunidade", p_nome: "o13-fechada" }), (r) => r === null);
await espera("RSS do perfil da organização com selo", () => rpc(visitante, "rede_alc_rss", { p_tipo: "perfil", p_nome: "@o13_org" }), (r) => r && r.itens.length === 1 && r.itens[0].id === ID.org);
await espera("RSS do perfil de pessoa: nulo (a regra de quem vê perfil sem conta)", () => rpc(visitante, "rede_alc_rss", { p_tipo: "perfil", p_nome: "o13_pessoa" }), (r) => r === null);
await espera("RSS com tipo ou nome inválido: nulo", async () => [await rpc(visitante, "rede_alc_rss", { p_tipo: "tudo", p_nome: "x" }), await rpc(visitante, "rede_alc_rss", { p_tipo: "comunidade", p_nome: "../x" })],
  (r) => r.every((x) => x === null));
await espera("organização perde o selo: o RSS do perfil some", async () => {
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org]);
  const r = await rpc(visitante, "rede_alc_rss", { p_tipo: "perfil", p_nome: "o13_org" });
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org]);
  return r;
}, (r) => r === null);

await espera("\"alumia-alcance\" desligado no painel: o RSS e o cartão respondem nulo também a quem chama o banco direto", async () => {
  await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-alcance', false) on conflict (nome) do update set ligado = false");
  const r = [await rpc(visitante, "rede_alc_rss", { p_tipo: "comunidade", p_nome: "o13-aberta" }), await rpc(visitante, "rede_alc_post", { p_post: ID.bom })];
  await dono("delete from interno.recursos_vivos where nome = 'alumia-alcance'");
  r.push(await rpc(visitante, "rede_alc_post", { p_post: ID.bom }));
  return r;
}, ([rss, post, depois]) => rss === null && post === null && depois?.id === ID.bom);

// ═══════════════════ 4. Quem eu sigo ═══════════════════
await dono("insert into interno.rede_seguindo (quem, segue, pendente) values ($1, $2, false), ($1, $3, false), ($1, $4, true), ($1, $5, false), ($6, $7, false)",
  [P.eu, P.org, P.pessoa, P.tranca, P.invis, P.outra, P.fora]);
await dono(`insert into interno.rede_fed_remotos (ator, handle) values ('https://mastodon.example/users/ana', 'ana@mastodon.example'), ('https://outra.example/users/beto', 'beto@outra.example')
            on conflict (ator) do update set handle = excluded.handle`).catch(async () => {
  // a tabela pede mais colunas: preenche o mínimo que ela exige
  await dono(`insert into interno.rede_fed_remotos (ator, chave_id, chave_publica, inbox, handle) values
    ('https://mastodon.example/users/ana', 'https://mastodon.example/users/ana#k', 'x', 'https://mastodon.example/users/ana/inbox', 'ana@mastodon.example'),
    ('https://outra.example/users/beto', 'https://outra.example/users/beto#k', 'x', 'https://outra.example/users/beto/inbox', 'beto@outra.example') on conflict do nothing`);
});
await dono(`insert into interno.rede_fed_seguindo (perfil, ator, pedido, aceito) values ($1, 'https://mastodon.example/users/ana', 'https://a/1', true), ($1, 'https://outra.example/users/beto', 'https://a/2', false)`, [P.eu]);
await espera("a minha lista: os aceitos daqui (sem pendente nem invisível) e os de fora aceitos", () => rpc(como(P.eu), "rede_alc_seguindo"),
  (r) => r.locais.slice().sort().join() === "o13_org,o13_pessoa" && r.fora.join() === "ana@mastodon.example");
await espera("a lista de outra pessoa não vem junto", () => rpc(como(P.outra), "rede_alc_seguindo"), (r) => r.locais.join() === "o13_fora" && r.fora.length === 0);
await recusa("visitante não pede lista nenhuma", () => rpc(visitante, "rede_alc_seguindo"), "permission denied");

// ═══════════════════ 5. As rotas, de ponta a ponta ═══════════════════
// O serviço falso: cada /rest/v1/rpc/<função> vira a chamada da função como VISITANTE no banco de teste (a rota manda a chave pública).
servico.on("request", (pedido, resposta) => {
  let corpo = "";
  pedido.on("data", (p) => (corpo += p));
  pedido.on("end", async () => {
    const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(pedido.url ?? "");
    const autorizado = pedido.headers.apikey === "chave-publica-de-teste" && pedido.headers.authorization === "Bearer chave-publica-de-teste";
    if (!m || !autorizado) {
      resposta.writeHead(404).end();
      return;
    }
    try {
      const r = await rpc(visitante, m[1], corpo ? JSON.parse(corpo) : {});
      resposta.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(r));
    } catch (e) {
      resposta.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ message: String(e.message) }));
    }
  });
});
const pedir = async (rota, url, params) => {
  esquecerGuardados();
  const r = await rota.GET(new Request(url), { params: Promise.resolve(params) });
  return { status: r.status, corpo: await r.text(), cab: r.headers };
};
await espera("rota do RSS da comunidade: 200, RSS, sem tag crua", () => pedir(rotaRss, "https://exemplo.test/api/rede/rss/c/o13-aberta", { tipo: "c", nome: "o13-aberta" }),
  (r) => r.status === 200 && /application\/rss\+xml/.test(r.cab.get("content-type")) && r.corpo.includes(`/p/${ID.bom}`) && r.corpo.includes("&lt;b&gt;às 19h&lt;/b&gt;") && !r.corpo.includes(ID.membros) && !r.corpo.includes(ID.naoListado));
await espera("rota do RSS de pessoa: 404", () => pedir(rotaRss, "https://exemplo.test/api/rede/rss/u/o13_pessoa", { tipo: "u", nome: "o13_pessoa" }), (r) => r.status === 404);
await espera("rota do cartão: 200, HTML sem script, com a política e o sandbox", () => pedir(rotaCartao, `https://exemplo.test/api/rede/embed/${ID.bom}`, { id: ID.bom }),
  (r) => r.status === 200 && /text\/html/.test(r.cab.get("content-type")) && !/<script/i.test(r.corpo) && /default-src 'none'/.test(r.cab.get("content-security-policy"))
    && /sandbox/.test(r.cab.get("content-security-policy")) && /frame-ancestors \*/.test(r.cab.get("content-security-policy")) && r.cab.get("referrer-policy") === "no-referrer");
await espera("o hash do estilo na política é o do estilo que vai na página", async () => {
  const { createHash } = await import("node:crypto");
  const r = await pedir(rotaCartao, `https://exemplo.test/api/rede/embed/${ID.bom}`, { id: ID.bom });
  const estilo = /<style>([\s\S]*?)<\/style>/.exec(r.corpo)?.[1] ?? "";
  return r.cab.get("content-security-policy").includes(`'sha256-${createHash("sha256").update(estilo).digest("base64")}'`);
}, (v) => v === true);
await espera("rota do cartão de post de membros: 404", () => pedir(rotaCartao, `https://exemplo.test/api/rede/embed/${ID.membros}`, { id: ID.membros }), (r) => r.status === 404);
await espera("rota do cartão com id que não é id: 404", () => pedir(rotaCartao, "https://exemplo.test/api/rede/embed/x", { id: "../../x" }), (r) => r.status === 404);

// A trava da entrada ligada: a função diz nulo para quem passa (chave de serviço) e a porta recusa o visitante; as rotas, 404.
await dono("update interno.configuracoes set valor = '{\"exigir\": true}'::jsonb where chave = 'alumia_entrada'");
await recusa("com a trava, o visitante para na porta (RSS)", () => rpc(visitante, "rede_alc_rss", { p_tipo: "comunidade", p_nome: "o13-aberta" }), "alumia_entrada");
await recusa("com a trava, o visitante para na porta (cartão)", () => rpc(visitante, "rede_alc_post", { p_post: ID.bom }), "alumia_entrada");
await espera("com a trava, nem pela chave de serviço sai nada", async () => [await rpc({ papel: "service_role" }, "rede_alc_rss", { p_tipo: "comunidade", p_nome: "o13-aberta" }), await rpc({ papel: "service_role" }, "rede_alc_post", { p_post: ID.bom })],
  (r) => r.every((x) => x === null));
await espera("com a trava, a rota do RSS responde 404", () => pedir(rotaRss, "https://exemplo.test/api/rede/rss/c/o13-aberta", { tipo: "c", nome: "o13-aberta" }), (r) => r.status === 404);
await espera("com a trava, a rota do cartão responde 404", () => pedir(rotaCartao, `https://exemplo.test/api/rede/embed/${ID.bom}`, { id: ID.bom }), (r) => r.status === 404);
await dono("update interno.configuracoes set valor = '{\"exigir\": false}'::jsonb where chave = 'alumia_entrada'");
await espera("trava desligada de novo: volta a sair", () => pedir(rotaCartao, `https://exemplo.test/api/rede/embed/${ID.bom}`, { id: ID.bom }), (r) => r.status === 200);

// A Alumia interditada pela coordenação (a área "comunidade"): o RSS e o cartão fecham também.
await espera("com a Alumia interditada, as duas rotas respondem 404", async () => {
  const antes = (await dono("select valor from interno.configuracoes where chave = 'interdicao'")).rows[0]?.valor ?? null;
  await dono(`insert into interno.configuracoes (chave, valor) values ('interdicao', '{"geral": false, "areas": ["comunidade"], "mensagem": ""}'::jsonb)
              on conflict (chave) do update set valor = excluded.valor`);
  const site = await rpc(visitante, "site");
  const r = [await pedir(rotaRss, "https://exemplo.test/api/rede/rss/c/o13-aberta", { tipo: "c", nome: "o13-aberta" }), await pedir(rotaCartao, `https://exemplo.test/api/rede/embed/${ID.bom}`, { id: ID.bom })];
  if (antes === null) await dono("delete from interno.configuracoes where chave = 'interdicao'");
  else await dono("update interno.configuracoes set valor = $1 where chave = 'interdicao'", [antes]);
  // Se o banco guarda a interdição de outro jeito, o teste avisa em vez de passar à toa.
  if (!JSON.stringify(site ?? {}).includes("comunidade")) throw new Error(`a interdição não apareceu em site(): ${JSON.stringify(site)?.slice(0, 300)}`);
  return r.map((x) => x.status);
}, (s) => s.every((x) => x === 404));

servico.close();
console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
