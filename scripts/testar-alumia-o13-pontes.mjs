// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as pontes da onda 13 (supabase/migracoes/20261119-alumia-o13-pontes.sql) num Postgres de verdade (scripts/banco-local.mjs),
// com a migração rodada TRÊS vezes sobre o install.sql, e as regras do servidor do site com dublês de rede:
//   · a tradução: desligada no painel, recusa; ligada, só o texto de post que a pessoa pode ver, com limite; o servidor manda
//     ao tradutor próprio e nada sai sem o endereço configurado;
//   · o resumo das comunidades: só comunidade aberta, até 10; só títulos do que pode sair da Alumia e a pessoa vê (nada para
//     membros, de fato ou escolhido, retido, arquivado, não listado ou de comunidade fechada); post curto só como número a partir
//     de 3; um e-mail por pessoa, sem lista, no máximo um a cada 6 dias; nada com a trava ou com "alumia-org" desligado no painel;
//     desligar apaga a escolha;
//   · os robôs: só quem gerencia pede; no máximo 3; com selo nasce ativo, sem selo espera a coordenação; a chave só como resumo;
//     só a chave de serviço liga e publica; 12 por hora; o rótulo diz robô e a organização; desligado, a chave para;
//   · o Telegram: desligado no painel, recusa; só com selo; o canal no formato certo; sai só post da organização pela regra do
//     RSS (nada de perfil, que vale para membros, não listado, arquivado, com prazo, fora do Fediverso ou com a trava), há mais
//     de 10 minutos, uma vez; cinco falhas desligam;
//   · o robô não publica com a trava nem com "alumia-org" desligado no painel;
//   · o Mural dos Trabalhadores: só organização com selo, só quem fala por ela; vence; encerrar; sem selo some;
//   · as listas e os limites da tela iguais aos do banco, e os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o13-pontes.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { canalDoTelegram, chaveNova, chaveTemForma, LIMITES_DAS_PONTES as L, maisDias, problemaDoChamado, PUBLICOS_DO_ROBO, resumoDaChave, TIPOS_DO_MURAL } from "../lib/rede/pontes/regras.ts";
import { configDaTraducao, traduzir } from "../lib/rede/pontes/traducao.ts";
import { enviarAoCanal, mensagemDoPost, tokenDoAmbiente } from "../lib/rede/pontes/telegram.ts";
import { soPeloNomeLigado, telegramLigado, traducaoLigada } from "../lib/rede/pontes/ligado.ts";
import { criarContaDoRobo } from "../lib/rede/pontes/robos.ts";

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

// ═══════════════════ 0. O arquivo e as regras puras ═══════════════════
const sql = ler("supabase/migracoes/20261119-alumia-o13-pontes.sql");
const semComentario = sql.replace(/--.*$/gm, "");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 30 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 6
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede, token ou chave", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta|token|chave)\b/.test(t)));
ok("nenhuma tabela guarda quem escreveu o chamado ou criou o robô", !/\b(escreveu|criado_por|pedido_por|autor)\b/.test(/create table if not exists interno\.rede_trabalhadores_chamados \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "x autor")
  && !/\b(escreveu|criado_por|pedido_por|dono)\b/.test(/create table if not exists interno\.rede_pontes_robos \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "x dono"));
ok("nenhuma função recebe parâmetro do tipo linha de tabela", !/create or replace function [^(]+\([^)]*\binterno\.rede_[a-z_]+\b(?!\()/i.test(semComentario));
ok("não mexe na versão da Alumia nem no install.sql, e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("os limites da tela são os do banco", sql.includes(`cardinality(comunidades) <= ${L.resumoComunidades}`) && sql.includes(`>= ${L.robosPorHora}`) && sql.includes(`>= ${L.robosPorDia}`)
  && sql.includes(`between ${L.roboNomeMin} and ${L.roboNome}`) && sql.includes(`between ${L.roboDescricaoMin} and ${L.roboDescricao}`) && sql.includes(`between 1 and ${L.roboTexto}`)
  && sql.includes(`, ${L.traducaoTexto})`) && sql.includes(`'alumia_pontes_traduzir', ${L.traducoesPorHora}, 60`) && sql.includes(`between ${L.muralTituloMin} and ${L.muralTitulo}`)
  && sql.includes(`between ${L.muralTextoMin} and ${L.muralTexto}`) && sql.includes(`between ${L.muralCategoriaMin} and ${L.muralCategoria}`) && sql.includes(`> ${L.muralCidade}`)
  && sql.includes(`>= ${L.muralAbertosPorOrg} then perform interno.erro('limite')`) && sql.includes(`v_hoje + ${L.muralDiasMax}`) && sql.includes(`v_hoje + ${L.muralDiasPadrao}`)
  && sql.includes(`interval '${L.telegramMinutos} minutes'`) && sql.includes(`falhas >= ${L.telegramFalhas}`) && sql.includes(`>= ${L.robosPorOrg} then perform interno.erro('limite')`));
ok("os tipos do mural e os públicos do robô são os do banco", sql.includes(`tipo in (${TIPOS_DO_MURAL.map((t) => `'${t}'`).join(", ")})`) && sql.includes(`v_pub not in (${PUBLICOS_DO_ROBO.map((t) => `'${t}'`).join(", ")})`));
ok("o canal do Telegram: @nome, link t.me e número do canal", canalDoTelegram("t.me/sindicato_xyz") === "@sindicato_xyz" && canalDoTelegram("https://t.me/Metro_SP/") === "@Metro_SP"
  && canalDoTelegram("sindicato") === "@sindicato" && canalDoTelegram("-1001234567890") === "-1001234567890" && canalDoTelegram("@ab") === null && canalDoTelegram("12345") === null
  && canalDoTelegram("@nome com espaço") === null && canalDoTelegram("https://exemplo.org/x") === null);
{
  const hoje = "2026-11-19";
  const base = { tipo: "greve", categoria: "Metroviários", titulo: "Greve a partir de segunda", texto: "Assembleia aprovou greve por tempo indeterminado.", cidade: "São Paulo", quando: "", ate: "" };
  ok("o chamado do mural: o que falta, na ordem", problemaDoChamado(base, hoje) === null && problemaDoChamado({ ...base, tipo: "festa" }, hoje) === "tipo"
    && problemaDoChamado({ ...base, categoria: "x" }, hoje) === "categoria" && problemaDoChamado({ ...base, titulo: "abc" }, hoje) === "titulo"
    && problemaDoChamado({ ...base, texto: "curto" }, hoje) === "texto" && problemaDoChamado({ ...base, ate: maisDias(hoje, 91) }, hoje) === "ate"
    && problemaDoChamado({ ...base, ate: "2026-11-18" }, hoje) === "ate" && problemaDoChamado({ ...base, ate: maisDias(hoje, 10), quando: maisDias(hoje, 11) }, hoje) === "quando"
    && problemaDoChamado({ ...base, ate: maisDias(hoje, 10), quando: maisDias(hoje, 3) }, hoje) === null);
}
{
  const c = chaveNova();
  const c2 = chaveNova();
  const r = await resumoDaChave(c);
  ok("a chave nasce com o prefixo e 32 bytes, nunca igual, e o resumo é SHA-256 em hexadecimal", chaveTemForma(c) && c !== c2 && /^[0-9a-f]{64}$/.test(r) && r !== (await resumoDaChave(c2))
    && (await resumoDaChave("abc")) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" && !chaveTemForma("alumia_robo_curta"));
}
ok("os interruptores só pelo nome: sem o nome na lista, desligados (nem por \"todos\")", !soPeloNomeLigado("alumia-traducao", new Set(["todos"]), []) && soPeloNomeLigado("alumia-traducao", new Set(["alumia-traducao"]), [])
  && !soPeloNomeLigado("alumia-traducao", new Set(["alumia-traducao", "-alumia-traducao"]), []) && !traducaoLigada(new Set(["todos"])) && !telegramLigado(new Set(["todos"])));

// O tradutor (dublê): sem endereço, nada; com endereço, só o formato do LibreTranslate, sem HTML.
{
  ok("sem ALUMIA_TRADUCAO_URL não há tradutor", configDaTraducao({}) === null && configDaTraducao({ ALUMIA_TRADUCAO_URL: "ftp://x" }) === null
    && configDaTraducao({ ALUMIA_TRADUCAO_URL: "http://tradutor:5000/" })?.url === "http://tradutor:5000");
  ok("o tradutor só com https, ou com http dentro da máquina ou da rede interna", configDaTraducao({ ALUMIA_TRADUCAO_URL: "https://tradutor.exemplo.org" })?.url === "https://tradutor.exemplo.org"
    && configDaTraducao({ ALUMIA_TRADUCAO_URL: "http://localhost:5000" }) !== null && configDaTraducao({ ALUMIA_TRADUCAO_URL: "http://127.0.0.1:5000" }) !== null
    && configDaTraducao({ ALUMIA_TRADUCAO_URL: "http://[::1]:5000" }) !== null
    && configDaTraducao({ ALUMIA_TRADUCAO_URL: "http://tradutor.exemplo.org" }) === null && configDaTraducao({ ALUMIA_TRADUCAO_URL: "http://198.51.100.7:5000" }) === null
    && configDaTraducao({ ALUMIA_TRADUCAO_URL: "https://quem:senha@tradutor.exemplo.org" }) === null);
  const pedidos = [];
  const buscar = async (url, init) => { pedidos.push({ url, corpo: JSON.parse(init.body) }); return new Response(JSON.stringify({ translatedText: "Strike on Monday", detectedLanguage: { language: "pt", confidence: 90 } }), { status: 200 }); };
  await espera("traduz pelo tradutor próprio, no formato de texto", () => traduzir("Greve na segunda", "en", { url: "http://tradutor:5000", chave: "", buscar }),
    (r) => r.ok && r.texto === "Strike on Monday" && r.origem === "pt" && pedidos[0].url === "http://tradutor:5000/translate" && pedidos[0].corpo.format === "text" && pedidos[0].corpo.target === "en" && !("api_key" in pedidos[0].corpo));
  await espera("idioma fora da lista nem é pedido", () => traduzir("Oi", "de", { url: "http://t", chave: "", buscar }), (r) => !r.ok && r.erro === "invalido" && pedidos.length === 1);
  await espera("tradutor fora do ar vira erro curto", () => traduzir("Oi", "es", { url: "http://t", chave: "k", buscar: async () => { throw new Error("rede"); } }), (r) => !r.ok && r.erro === "tradutor_fora");
  await espera("sem configuração, sem tradução", () => traduzir("Oi", "es", null), (r) => !r.ok && r.erro === "sem_tradutor");
}
// O Telegram (dublê).
{
  ok("o token só do ambiente e no formato certo", tokenDoAmbiente({}) === null && tokenDoAmbiente({ ALUMIA_TELEGRAM_TOKEN: "lixo" }) === null
    && tokenDoAmbiente({ ALUMIA_TELEGRAM_TOKEN: `123456789:${"A".repeat(35)}` }) !== null);
  const m = mensagemDoPost({ post: "11111111-1111-4111-8111-111111111111", canal: "@x", titulo: "Assembleia", texto: "a".repeat(5000) }, "https://exemplo.org/");
  ok("a mensagem leva título, texto e o endereço do post, até 4096 letras", m.length <= 4096 && m.startsWith("Assembleia\n\n") && m.endsWith("https://exemplo.org/pt/alumia/p/11111111-1111-4111-8111-111111111111"));
  let corpo = null;
  await espera("manda ao canal sem prévia de link", () => enviarAoCanal("1:x", "@canal", "oi", async (u, init) => { corpo = { u, b: JSON.parse(init.body) }; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }),
    (r) => r === true && corpo.u.endsWith("/sendMessage") && corpo.b.chat_id === "@canal" && corpo.b.link_preview_options.is_disabled === true);
  await espera("o Telegram recusou: falso", () => enviarAoCanal("1:x", "@canal", "oi", async () => new Response(JSON.stringify({ ok: false }), { status: 400 })), (r) => r === false);
}
// A conta do robô (dublê do Auth e do banco): falhou a ligação, a conta criada é apagada.
{
  const chamadas = [];
  const config = { url: "https://banco", chave: "servico", buscar: async (url, init) => {
    chamadas.push(`${init.method} ${url.replace("https://banco", "")}`);
    if (url.endsWith("/auth/v1/admin/users")) {
      const b = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "22222222-2222-4222-8222-222222222222", meta: b.user_metadata, email: b.email }), { status: 200 });
    }
    if (url.endsWith("rede_pontes_robo_ligar")) return new Response(JSON.stringify({ message: "invalido:perfil" }), { status: 400 });
    return new Response("null", { status: 200 });
  } };
  await espera("a ligação falhou: apaga a conta e desfaz o pedido", () => criarContaDoRobo("33333333-3333-4333-8333-333333333333", "Robô da Greve", config),
    (r) => !r.ok && chamadas.includes("DELETE /auth/v1/admin/users/22222222-2222-4222-8222-222222222222") && chamadas.at(-1) === "POST /rest/v1/rpc/rede_pontes_robo_desfazer");
}

// Os textos: as seis línguas com as mesmas chaves e marcadores; nenhuma palavra proibida; todo erro do banco com frase.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/pontes/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/pontes/${l}.json`));
    const outro = formas(j);
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`pontes/${l}.json: mesmas chaves e marcadores do pt, marcado como rascunho ou revisado${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0 && (j._rascunho === true || !("_rascunho" in j)));
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|university|universidad|universit|algoritm|algorithm|алгоритм|算法|大学/i.test(ler(`i18n/rede/pontes/${l}.json`))));
  ok("os tipos do mural têm nome nas seis línguas", TIPOS_DO_MURAL.every((t) => typeof pt.mural.tipos[t] === "string"));
  const codigos = [...new Set([...sql.matchAll(/interno\.erro\('([a-z_]+)(?::[a-z_]+)?'\)/g)].map((m) => m[1]))];
  ok(`todo erro da migração tem frase (${codigos.filter((c) => !pt.erros[c]).join(", ")})`, codigos.every((c) => typeof pt.erros[c] === "string"));
  ok("nenhum endereço .onion nem endereço de rede nos arquivos da frente", ["i18n/rede/pontes/pt.json", "lib/rede/pontes/ligado.ts", "lib/rede/pontes/traducao.ts", "lib/rede/pontes/telegram.ts", "components/rede/seguranca/EntrarPeloTor.tsx", "i18n/rede/seguranca/pt.json"]
    .every((c) => !/[a-z2-7]{56}\.onion|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(ler(c))));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const servico = { papel: "service_role", ip: "127.0.0.1" };
const visitante = { papel: "anon", ip: "127.0.0.1" };
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
const PESSOA = ["alumia_pontes_resumo_ver", "alumia_pontes_resumo_salvar", "alumia_pontes_resumo_previa", "alumia_pontes_traduzir_texto", "alumia_pontes_eu", "alumia_pontes_org",
  "alumia_pontes_robo_pedir", "alumia_pontes_robo_chave", "alumia_pontes_robo_desligar", "alumia_pontes_robos_fila", "alumia_pontes_robo_decidir", "alumia_pontes_telegram_salvar",
  "alumia_trabalhadores", "alumia_trabalhadores_publicar", "alumia_trabalhadores_encerrar", "alumia_pontes_rotulos", "alumia_pontes_robo_de"];
const SERVICO = ["rede_pontes_robo_ligar", "rede_pontes_robo_desfazer", "rede_pontes_robo_publicar", "rede_pontes_telegram_pendentes", "rede_pontes_telegram_resultado"];
await espera("toda função pública nova de pessoa passa pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)", [PESSOA])).rows,
(rs) => rs.length === PESSOA.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
await espera("as do servidor do site são só da chave de serviço", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') b, has_function_privilege('service_role', p.oid, 'execute') c
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)`, [SERVICO])).rows,
(rs) => rs.length === SERVICO.length && rs.every((r) => !r.a && !r.b && r.c));
await espera("as internas novas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and (p.proname like 'alumia\\_pontes\\_%' or p.proname = 'alumia_trabalhadores_json')`)).rows,
(rs) => rs.length >= 9 && rs.every((r) => !r.a && !r.b));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => um("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t]),
    (r) => r.r === true && r.n === 0);
}
await espera("nenhuma função nova recebe parâmetro do tipo linha (o Supabase barra o ALTER TABLE depois)", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('public', 'interno') and (p.proname = any ($1) or p.proname like 'alumia\\_pontes\\_%' or p.proname = 'alumia_trabalhadores_json')
                 and exists (select 1 from unnest(p.proargtypes) t join pg_type ty on ty.oid = t where ty.typtype = 'c')`, [[...PESSOA, ...SERVICO]])).rows,
(rs) => rs.length === 0);
await espera("os dois interruptores no catálogo, só pelo nome", async () => (await dono("select nome, so_pelo_nome from interno.recursos_catalogo where nome in ('alumia-traducao', 'alumia-telegram')")).rows,
  (rs) => rs.length === 2 && rs.every((r) => r.so_pelo_nome === true));

const P = {};
const NOMES = ["org", "semselo", "dona", "com", "coord", "m1", "m2", "fora", "robo1", "robo2", "robo3", "robo4"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o13.local`, nome);
  await rpc(como(P[nome]), "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const [i, nome] of NOMES.entries()) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o13`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono("update interno.perfis set rede_handle = 'metro', rede_codinome = 'Sindicato do Metrô' where id = $1", [P.org]);
await dono("update interno.perfis set rede_handle = 'brasa', rede_codinome = 'Coletivo Brasa' where id = $1", [P.semselo]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, documento_tipo, verificada_em) values ($1, 'sindicato', 'São Paulo', 'METRO', 'CNPJ', now())", [P.org]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra) values ($1, 'coletivo', 'Recife', 'BRASA')", [P.semselo]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($3, $2, 'dono')", [P.org, P.dona, P.semselo]);
{
  const NUC = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo Leste', $1) returning id", [P.org])).id;
  await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro')", [NUC, P.com]);
  const fim = new Date(Date.now() + 200 * 86400e3).toISOString().slice(0, 10);
  const f = await rpc(como(P.dona), "rede_org_funcao_salvar", { p_handle: "metro", p: { tipo: "comunicacao", nome: "Comunicação", permissoes: ["avisos"], vagas: 2 } });
  const COM = f.funcoes.find((x) => x.nome === "Comunicação").id;
  await rpc(como(P.dona), "rede_org_mandato_dar", { p_handle: "metro", p: { funcao: COM, handle: "com_o13", fim } });
  await rpc(como(P.com), "rede_org_mandato_aceitar", { p_mandato: (await rpc(como(P.com), "rede_org_funcoes", { p_handle: "metro" })).minhas[0].mandato });
}
const A = (n) => como(P[n]);
const semPessoas = (r) => { const s = JSON.stringify(r); return !Object.entries(P).filter(([k]) => !["org", "semselo", "robo1", "robo2", "robo3", "robo4"].includes(k)).some(([, id]) => s.includes(id)); };
const ligar = (nome, sim = true) => dono("insert into interno.recursos_vivos (nome, ligado) values ($1, $2) on conflict (nome) do update set ligado = $2", [nome, sim]);
await ligar("rede-v2");
await ligar("alumia-2");

// ═══════════════════ 2. Tradução ═══════════════════
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('historia', 'História', 'disciplinas', 'aberta', 'internet'), ('lutas-metro', 'Lutas do metrô', 'lutas', 'aberta', 'membros'), ('fechada-x', 'Fechada', 'lutas', 'fechada', 'membros') on conflict do nothing");
const post = async (autor, extra = {}) => (await um(`insert into interno.rede_posts (autor, como, tipo, titulo, texto, publico, alcance, comunidade, criado_em)
  values ($1, $1, $2, $3, $4, $5, interno.rede_alcance($5), $6, coalesce($7::timestamptz, now())) returning id`,
  [autor, extra.tipo ?? "post", extra.titulo ?? null, extra.texto ?? "Texto do post de teste.", extra.publico ?? "internet", extra.comunidade ?? null, extra.criado ?? null])).id;
const PUB = await post(P.m1, { texto: "Greve na segunda, todo mundo na assembleia." });
const SEG = await post(P.m1, { texto: "Só para quem me segue.", publico: "seguidores" });
await recusa("tradução com o interruptor desligado no painel", () => rpc(A("m2"), "alumia_pontes_traduzir_texto", { p_post: PUB }), "desligado");
await ligar("alumia-traducao");
await espera("ligada: o texto de um post que a pessoa vê", () => rpc(A("m2"), "alumia_pontes_traduzir_texto", { p_post: PUB }), (r) => r.texto.startsWith("Greve na segunda") && semPessoas(r));
await recusa("post que a pessoa não vê", () => rpc(A("m2"), "alumia_pontes_traduzir_texto", { p_post: SEG }), "nao_encontrado");
await recusa("visitante não traduz", () => rpc(visitante, "alumia_pontes_traduzir_texto", { p_post: PUB }), "");
await espera("o limite: 60 por hora", async () => {
  await zerar();
  for (let i = 0; i < L.traducoesPorHora; i++) await rpc(A("m2"), "alumia_pontes_traduzir_texto", { p_post: PUB });
  try { await rpc(A("m2"), "alumia_pontes_traduzir_texto", { p_post: PUB }); return false; } catch (e) { return /muitos|limite/.test(e.message); }
}, (r) => r === true);
await zerar();

// ═══════════════════ 3. Resumo das comunidades ═══════════════════
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('historia', $1), ('lutas-metro', $1), ('fechada-x', $1)", [P.m2]);
await espera("o resumo começa desligado e oferece só as comunidades abertas da pessoa", () => rpc(A("m2"), "alumia_pontes_resumo_ver"),
  (r) => r.ligado === false && r.escolhidas.length === 0 && r.opcoes.map((o) => o.slug).sort().join() === "historia,lutas-metro");
await recusa("comunidade fechada não entra", () => rpc(A("m2"), "alumia_pontes_resumo_salvar", { p_ligado: true, p_comunidades: ["fechada-x"] }), "invalido:comunidades");
await recusa("comunidade que não existe", () => rpc(A("m2"), "alumia_pontes_resumo_salvar", { p_ligado: true, p_comunidades: ["nao-existe"] }), "invalido:comunidades");
await recusa("ligar sem escolher nada", () => rpc(A("m2"), "alumia_pontes_resumo_salvar", { p_ligado: true, p_comunidades: [] }), "invalido:comunidades");
await espera("ligar com duas comunidades", () => rpc(A("m2"), "alumia_pontes_resumo_salvar", { p_ligado: true, p_comunidades: ["historia", "lutas-metro", "historia"] }),
  (r) => r.ligado && r.escolhidas.length === 2);
await espera("sem título novo, nada a mandar", () => rpc(A("m2"), "alumia_pontes_resumo_previa"), (r) => r === null);
await post(P.m1, { tipo: "discussao", titulo: "A Revolta da Vacina em https://exemplo.org", comunidade: "historia" });
await post(P.m1, { tipo: "discussao", titulo: "Só para membros", comunidade: "historia", publico: "membros" });
const RET = await post(P.m1, { tipo: "discussao", titulo: "Retido pela mediação", comunidade: "historia" });
await dono("update interno.rede_posts set retido = true where id = $1", [RET]);
await post(P.m1, { tipo: "discussao", titulo: "Da semana passada", comunidade: "historia", criado: new Date(Date.now() - 9 * 86400e3).toISOString() });
await post(P.m1, { tipo: "discussao", titulo: "Na fechada", comunidade: "fechada-x" });
{
  const arq = await post(P.m1, { tipo: "discussao", titulo: "Arquivado pela autora", comunidade: "historia" });
  const nl = await post(P.m1, { tipo: "discussao", titulo: "Fora da lista", comunidade: "historia" });
  await dono("update interno.rede_posts set arquivado_em = now() where id = $1", [arq]);
  await dono("update interno.rede_posts set nao_listado = true where id = $1", [nl]);
  // Comunidade aberta que não é de disciplina: "internet" escolhido vale como "membros" (interno.rede2_publico).
  await post(P.m1, { tipo: "discussao", titulo: "Nas lutas para a internet", comunidade: "lutas-metro" });
}
for (let i = 0; i < 2; i++) await post(P.m1, { texto: `Curto ${i}`, comunidade: "historia" });
const previa = await espera("a prévia: só o título público da semana, sem link, sem os outros", () => rpc(A("m2"), "alumia_pontes_resumo_previa"),
  (r) => r && r.texto.includes("- A Revolta da Vacina em") && !r.texto.includes("exemplo.org") && !r.texto.includes("Só para membros") && !r.texto.includes("Retido")
    && !r.texto.includes("semana passada") && !r.texto.includes("Na fechada") && !r.texto.includes("posts curtos") && !r.texto.includes("Codinome") && semPessoas(r)
    && !r.texto.includes("Arquivado") && !r.texto.includes("Fora da lista") && !r.texto.includes("Nas lutas") && !r.texto.includes("Lutas do metrô"));
void previa;
await post(P.m1, { texto: "Curto 3", comunidade: "historia" });
await espera("post curto só como número, a partir de 3", () => rpc(A("m2"), "alumia_pontes_resumo_previa"), (r) => r.texto.includes("e mais 3 posts curtos") && !r.texto.includes("Curto"));
await dono("insert into interno.rede_pontes_resumo (usuario, ligado, comunidades) values ($1, true, '{historia}') on conflict (usuario) do update set ligado = true, comunidades = '{historia}'", [P.m1]);
await espera("com a trava da entrada ligada, a rotina não manda nada", async () => {
  await dono("select interno.alumia_entrada_ligar(true)");
  const n = (await um("select interno.alumia_pontes_resumo_semanal() as n")).n;
  await dono("select interno.alumia_entrada_ligar(false)");
  return n;
}, (n) => n === 0);
await espera("com as organizações desligadas no painel, também não", async () => {
  await ligar("alumia-org", false);
  const n = (await um("select interno.alumia_pontes_resumo_semanal() as n")).n;
  await dono("delete from interno.recursos_vivos where nome = 'alumia-org'");
  return n;
}, (n) => n === 0);
await espera("a rotina manda um e-mail por pessoa que ligou, para o endereço da conta", async () => {
  const n = (await um("select interno.alumia_pontes_resumo_semanal() as n")).n;
  const emails = (await dono("select para, texto from interno.emails where tipo = 'rede_comunidades' order by para")).rows;
  return { n, emails };
}, (r) => r.n === 2 && r.emails.length === 2 && r.emails.every((e) => !e.texto.includes(";")) && r.emails.map((e) => e.para).join() === ["m1@o13.local", "m2@o13.local"].join());
await espera("na mesma semana, não manda de novo", async () => (await um("select interno.alumia_pontes_resumo_semanal() as n")).n, (n) => n === 0);
await espera("desligar apaga a escolha", async () => {
  await rpc(A("m2"), "alumia_pontes_resumo_salvar", { p_ligado: false, p_comunidades: null });
  return um("select count(*)::int n from interno.rede_pontes_resumo where usuario = $1", [P.m2]);
}, (r) => r.n === 0);

// ═══════════════════ 4. Robôs ═══════════════════
await espera("quem gerencia vê as organizações dela (e quem fala por ela também)", () => rpc(A("dona"), "alumia_pontes_eu"),
  (r) => r.orgs.length === 2 && r.orgs.find((o) => o.handle === "metro").selo === true && r.orgs.find((o) => o.handle === "brasa").selo === false && !r.coordenacao && semPessoas(r));
await espera("quem fala pela organização sem gerenciar aparece sem \"gerencio\"", () => rpc(A("com"), "alumia_pontes_eu"), (r) => r.orgs.length === 1 && r.orgs[0].gerencio === false);
await recusa("quem só fala pela organização não cria robô", () => rpc(A("com"), "alumia_pontes_robo_pedir", { p_handle: "metro", p_nome: "Robô", p_descricao: "Publica os boletins da greve." }), "sem_permissao");
await recusa("quem está fora não cria robô", () => rpc(A("fora"), "alumia_pontes_robo_pedir", { p_handle: "metro", p_nome: "Robô", p_descricao: "Publica os boletins da greve." }), "sem_permissao");
await recusa("nome curto", () => rpc(A("dona"), "alumia_pontes_robo_pedir", { p_handle: "metro", p_nome: "R", p_descricao: "Publica os boletins da greve." }), "invalido:nome");
await recusa("sem dizer para que serve", () => rpc(A("dona"), "alumia_pontes_robo_pedir", { p_handle: "metro", p_nome: "Robô da greve", p_descricao: "x" }), "invalido:descricao");
const ped = await espera("quem gerencia pede um robô", () => rpc(A("dona"), "alumia_pontes_robo_pedir", { p_handle: "metro", p_nome: "Boletim da greve", p_descricao: "Publica os boletins diários do comando de greve." }), (r) => r.id && r.nome === "Boletim da greve");
await recusa("só o servidor liga a conta ao pedido", () => rpc(A("dona"), "rede_pontes_robo_ligar", { p_robo: ped?.id, p_perfil: P.robo1 }), "");
await recusa("uma organização não vira robô", () => rpc(servico, "rede_pontes_robo_ligar", { p_robo: ped?.id, p_perfil: P.semselo }), "invalido:perfil");
const R1 = await espera("com selo, o robô nasce ativo, com o @ de robô", () => rpc(servico, "rede_pontes_robo_ligar", { p_robo: ped?.id, p_perfil: P.robo1 }),
  (r) => r.situacao === "ativo" && /^robo_[0-9a-f]{8}$/.test(r.handle) && r.temChave === false);
await espera("o perfil do robô ganhou o nome dado", () => um("select rede_codinome, rede_handle from interno.perfis where id = $1", [P.robo1]), (r) => r.rede_codinome === "Boletim da greve" && r.rede_handle.startsWith("robo_"));
await zerar();
const ped2 = await rpc(A("dona"), "alumia_pontes_robo_pedir", { p_handle: "brasa", p_nome: "Agenda da Brasa", p_descricao: "Publica a agenda semanal do coletivo." });
const R2 = await espera("sem selo, o robô espera a coordenação (avisada)", () => rpc(servico, "rede_pontes_robo_ligar", { p_robo: ped2.id, p_perfil: P.robo2 }), (r) => r.situacao === "esperando");
await espera("a coordenação recebeu o aviso", async () => (await dono("select count(*)::int n from interno.avisos where para = $1 and texto like '%conta de robô%'", [P.coord])).rows[0], (r) => r.n === 1);
await recusa("quem não é da coordenação não vê a fila", () => rpc(A("dona"), "alumia_pontes_robos_fila"), "sem_permissao");
await espera("a coordenação vê a fila, com a organização e sem ninguém de dentro", () => rpc(A("coord"), "alumia_pontes_robos_fila"),
  (r) => r.length === 1 && r[0].org.handle === "brasa" && semPessoas(r));
await recusa("chave para robô que espera", async () => rpc(A("dona"), "alumia_pontes_robo_chave", { p_robo: R2?.id, p_resumo: await resumoDaChave(chaveNova()) }), "robo_parado");
await espera("a coordenação aprova", () => rpc(A("coord"), "alumia_pontes_robo_decidir", { p_robo: R2?.id, p_aprovar: true }), (r) => r.situacao === "ativo");
await recusa("decidir de novo", () => rpc(A("coord"), "alumia_pontes_robo_decidir", { p_robo: R2?.id, p_aprovar: true }), "ja_decidido");
await recusa("chave fora do formato", () => rpc(A("dona"), "alumia_pontes_robo_chave", { p_robo: R1?.id, p_resumo: "abc" }), "invalido:chave");
await recusa("quem não gerencia não troca a chave", async () => rpc(A("com"), "alumia_pontes_robo_chave", { p_robo: R1?.id, p_resumo: await resumoDaChave(chaveNova()) }), "sem_permissao");
const CHAVE = chaveNova();
await espera("quem gerencia guarda a chave nova (só o resumo)", async () => rpc(A("dona"), "alumia_pontes_robo_chave", { p_robo: R1?.id, p_resumo: await resumoDaChave(CHAVE) }), (r) => r.temChave === true && !JSON.stringify(r).includes(CHAVE));
await espera("o banco não tem a chave, só o resumo", async () => (await dono("select count(*)::int n from interno.rede_pontes_robos where resumo = $1", [await resumoDaChave(CHAVE)])).rows[0], (r) => r.n === 1);
await recusa("quem tem conta não publica pelo robô", async () => rpc(A("dona"), "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(CHAVE), p_texto: "Oi", p_publico: "internet" }), "");
await recusa("chave errada", async () => rpc(servico, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(chaveNova()), p_texto: "Oi", p_publico: "internet" }), "chave");
await recusa("público fora da lista (robô não fala em comunidade)", async () => rpc(servico, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(CHAVE), p_texto: "Oi", p_publico: "comunidade" }), "invalido:publico");
await recusa("texto com telefone é dado pessoal", async () => rpc(servico, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(CHAVE), p_texto: "Liga: (11) 98888-7777", p_publico: "internet" }), "dado_pessoal");
const RP = await espera("o robô publica com a chave", async () => rpc(servico, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(CHAVE), p_texto: "Boletim 1: a greve segue amanhã.", p_publico: "internet" }),
  (r) => r.id && r.retido === false);
await recusa("com a trava da entrada ligada, o robô não publica", async () => {
  await dono("select interno.alumia_entrada_ligar(true)");
  try { return await rpc(servico, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(CHAVE), p_texto: "Com a trava.", p_publico: "internet" }); }
  finally { await dono("select interno.alumia_entrada_ligar(false)"); }
}, "alumia_entrada");
await recusa("com as organizações desligadas no painel, o robô não publica", async () => {
  await ligar("alumia-org", false);
  try { return await rpc(servico, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(CHAVE), p_texto: "Desligado.", p_publico: "internet" }); }
  finally { await dono("delete from interno.recursos_vivos where nome = 'alumia-org'"); }
}, "desligado");
await espera("o post é do robô", () => um("select autor, publico from interno.rede_posts where id = $1", [RP?.id]), (r) => r.autor === P.robo1 && r.publico === "internet");
await espera("o rótulo: o robô e a organização dona, entre os autores de uma página", () => rpc(A("fora"), "alumia_pontes_rotulos", { p_autores: [P.robo1, P.m1, P.robo2] }),
  (r) => r.length === 2 && r.find((x) => x.autor === P.robo1).org.handle === "metro" && r.find((x) => x.autor === P.robo2).org.handle === "brasa" && semPessoas(r));
await espera("o rótulo pelo @ do robô (e nulo para quem não é robô)", async () => [await rpc(A("fora"), "alumia_pontes_robo_de", { p_handle: R1?.handle }), await rpc(A("fora"), "alumia_pontes_robo_de", { p_handle: "m1_o13" })],
  ([r, n]) => r.org.handle === "metro" && r.parado === false && n === null);
await espera("o limite: 12 por hora", async () => {
  const resumo = await resumoDaChave(CHAVE);
  for (let i = 1; i < L.robosPorHora; i++) await rpc(servico, "rede_pontes_robo_publicar", { p_resumo: resumo, p_texto: `Boletim ${i + 1}.`, p_publico: "membros" });
  try { await rpc(servico, "rede_pontes_robo_publicar", { p_resumo: resumo, p_texto: "Mais um.", p_publico: "membros" }); return false; } catch (e) { return e.message.includes("muitos_pedidos"); }
}, (r) => r === true);
await espera("a organização vê os robôs dela, com o uso do dia, sem chave", () => rpc(A("dona"), "alumia_pontes_org", { p_handle: "metro" }),
  (r) => r.selo && r.robos.length === 1 && r.robos[0].hoje === L.robosPorHora && r.telegram === null && !JSON.stringify(r).includes(CHAVE) && semPessoas(r));
await espera("desligar o robô: a chave some", () => rpc(A("dona"), "alumia_pontes_robo_desligar", { p_robo: R1?.id }), (r) => r.situacao === "desligado" && r.temChave === false);
await recusa("a chave do robô desligado não publica mais", async () => rpc(servico, "rede_pontes_robo_publicar", { p_resumo: await resumoDaChave(CHAVE), p_texto: "Oi", p_publico: "internet" }), "chave");
await espera("o rótulo fica no robô desligado", () => rpc(A("fora"), "alumia_pontes_robo_de", { p_handle: R1?.handle }), (r) => r.parado === true);
await espera("no máximo 3 robôs por organização", async () => {
  await zerar();
  for (let i = 0; i < 3; i++) await rpc(A("dona"), "alumia_pontes_robo_pedir", { p_handle: "metro", p_nome: `Robô ${i}`, p_descricao: "Publica os boletins diários." });
  try { await rpc(A("dona"), "alumia_pontes_robo_pedir", { p_handle: "metro", p_nome: "Robô 4", p_descricao: "Publica os boletins diários." }); return false; } catch (e) { return e.message.includes("limite"); }
}, (r) => r === true);
await espera("o pedido que não virou conta é desfeito pelo servidor", async () => {
  const id = (await um("select id from interno.rede_pontes_robos where org = $1 and situacao = 'criando' limit 1", [P.org])).id;
  await rpc(servico, "rede_pontes_robo_desfazer", { p_robo: id });
  return um("select count(*)::int n from interno.rede_pontes_robos where id = $1", [id]);
}, (r) => r.n === 0);

// ═══════════════════ 5. Telegram ═══════════════════
await zerar();
await recusa("com o interruptor desligado, nada", () => rpc(A("dona"), "alumia_pontes_telegram_salvar", { p_handle: "metro", p_canal: "@metro_greve", p_ligado: true }), "desligado");
await ligar("alumia-telegram");
await recusa("organização sem selo não liga", () => rpc(A("dona"), "alumia_pontes_telegram_salvar", { p_handle: "brasa", p_canal: "@brasa_canal", p_ligado: true }), "sem_selo");
await recusa("quem só fala pela organização não liga", () => rpc(A("com"), "alumia_pontes_telegram_salvar", { p_handle: "metro", p_canal: "@metro_greve", p_ligado: true }), "sem_permissao");
await recusa("canal fora do formato", () => rpc(A("dona"), "alumia_pontes_telegram_salvar", { p_handle: "metro", p_canal: "https://t.me/x", p_ligado: true }), "invalido:canal");
const ANTES = await post(P.org, { texto: "Post de antes de ligar o canal.", criado: new Date(Date.now() - 30 * 60e3).toISOString() });
void ANTES;
await espera("quem gerencia liga o canal da organização com selo", () => rpc(A("dona"), "alumia_pontes_telegram_salvar", { p_handle: "metro", p_canal: "@metro_greve", p_ligado: true }),
  (r) => r.telegram.canal === "@metro_greve" && r.telegram.ligado === true);
await dono("update interno.rede_pontes_telegram set ligado_em = now() - interval '1 hour' where org = $1", [P.org]);
const vinte = new Date(Date.now() - 20 * 60e3).toISOString();
const T1 = await post(P.org, { titulo: "Assembleia", texto: "Assembleia geral na sexta.", comunidade: "historia", criado: vinte });
const T2 = await post(P.org, { texto: "Só para membros.", publico: "membros", comunidade: "historia", criado: vinte });
// Pela regra do RSS (interno.alumia_alc_sai), nada disto sai: no perfil, "internet" vale como "membros"; numa comunidade aberta
// que não é de disciplina, também; e a vida do post (não listado, some sozinho, arquivado, fora do Fediverso) segura o resto.
const NAO_SAEM = {
  perfil: await post(P.org, { texto: "No perfil, para a internet.", criado: vinte }),
  lutas: await post(P.org, { texto: "Nas lutas, para a internet.", comunidade: "lutas-metro", criado: vinte }),
  naoListado: await post(P.org, { texto: "Não listado.", comunidade: "historia", criado: vinte }),
  someSozinho: await post(P.org, { texto: "Some sozinho.", comunidade: "historia", criado: vinte }),
  arquivado: await post(P.org, { texto: "Arquivado.", comunidade: "historia", criado: vinte }),
  foraDoFediverso: await post(P.org, { texto: "Fora do Fediverso.", comunidade: "historia", criado: vinte }),
};
await dono("update interno.rede_posts set nao_listado = true where id = $1", [NAO_SAEM.naoListado]);
await dono("update interno.rede_posts set expira_em = now() + interval '1 day' where id = $1", [NAO_SAEM.someSozinho]);
await dono("update interno.rede_posts set arquivado_em = now() where id = $1", [NAO_SAEM.arquivado]);
await dono("update interno.rede_posts set fora_do_fediverso = true where id = $1", [NAO_SAEM.foraDoFediverso]);
const T3 = await post(P.org, { texto: "Agora mesmo." });
const T4 = await post(P.org, { texto: "Na comunidade fechada.", comunidade: "fechada-x", criado: vinte });
const T5 = await post(P.org, { texto: "Apagado.", criado: vinte });
await dono("update interno.rede_posts set apagado_em = now() where id = $1", [T5]);
const T6 = await post(P.m1, { texto: "De outra pessoa.", criado: vinte });
await dono("update interno.rede_posts set criado_em = now() - interval '2 hours' where id = $1", [ANTES]);
await recusa("só a chave de serviço pega a fila", () => rpc(A("dona"), "rede_pontes_telegram_pendentes", { p_limite: 10 }), "");
await espera("sai só o post da organização, para a internet, de pé, há mais de 10 minutos e depois de ligar", () => rpc(servico, "rede_pontes_telegram_pendentes", { p_limite: 10 }),
  (r) => r.length === 1 && r[0].post === T1 && r[0].canal === "@metro_greve" && r[0].titulo === "Assembleia" && ![T2, T3, T4, T5, T6, ...Object.values(NAO_SAEM)].some((x) => JSON.stringify(r).includes(x)));
await espera("cada post sai uma vez", () => rpc(servico, "rede_pontes_telegram_pendentes", { p_limite: 10 }), (r) => r.length === 0);
await espera("com a trava da entrada ligada, nada sai (e depois de desligar, sai)", async () => {
  const id = await post(P.org, { texto: "Com a trava.", comunidade: "historia", criado: vinte });
  await dono("select interno.alumia_entrada_ligar(true)");
  const com = await rpc(servico, "rede_pontes_telegram_pendentes", { p_limite: 10 });
  await dono("select interno.alumia_entrada_ligar(false)");
  const sem = await rpc(servico, "rede_pontes_telegram_pendentes", { p_limite: 10 });
  if (sem.length) await rpc(servico, "rede_pontes_telegram_resultado", { p_post: id, p_ok: true });
  return [com, sem.map((x) => x.post), id];
}, ([com, sem, id]) => com.length === 0 && sem.length === 1 && sem[0] === id);
await espera("com as organizações desligadas no painel, nada sai", async () => {
  await post(P.org, { texto: "Desligado no painel.", comunidade: "historia", criado: vinte });
  await ligar("alumia-org", false);
  const r = await rpc(servico, "rede_pontes_telegram_pendentes", { p_limite: 10 });
  await dono("delete from interno.recursos_vivos where nome = 'alumia-org'");
  await dono("delete from interno.rede_posts where texto = 'Desligado no painel.'");
  return r;
}, (r) => r.length === 0);
await espera("deu certo: a organização vê o dia do último envio", async () => {
  await rpc(servico, "rede_pontes_telegram_resultado", { p_post: T1, p_ok: true });
  return rpc(A("dona"), "alumia_pontes_org", { p_handle: "metro" });
}, (r) => r.telegram.enviadoDia !== null && r.telegram.ligado);
await espera("cinco falhas seguidas desligam o canal", async () => {
  for (let i = 0; i < L.telegramFalhas; i++) {
    const id = await post(P.org, { texto: `Falha ${i}.`, comunidade: "historia", criado: vinte });
    const lista = await rpc(servico, "rede_pontes_telegram_pendentes", { p_limite: 10 });
    if (!lista.some((x) => x.post === id)) return "não saiu";
    await rpc(servico, "rede_pontes_telegram_resultado", { p_post: id, p_ok: false });
  }
  return rpc(A("dona"), "alumia_pontes_org", { p_handle: "metro" });
}, (r) => r.telegram && r.telegram.ligado === false && r.telegram.motivo === "falhas");
await espera("desligado no painel, a fila fica vazia", async () => {
  await rpc(A("dona"), "alumia_pontes_telegram_salvar", { p_handle: "metro", p_canal: "@metro_greve", p_ligado: true });
  await dono("update interno.rede_pontes_telegram set ligado_em = now() - interval '1 hour'");
  await post(P.org, { texto: "Depois de religar.", comunidade: "historia", criado: vinte });
  await ligar("alumia-telegram", false);
  return rpc(servico, "rede_pontes_telegram_pendentes", { p_limite: 10 });
}, (r) => r.length === 0);
await espera("apagar o canal", async () => {
  await ligar("alumia-telegram");
  return rpc(A("dona"), "alumia_pontes_telegram_salvar", { p_handle: "metro", p_canal: "", p_ligado: false });
}, (r) => r.telegram === null);

// ═══════════════════ 6. Mural dos Trabalhadores ═══════════════════
await zerar();
const chamado = { tipo: "greve", categoria: "Metroviários", titulo: "Greve a partir de segunda", texto: "Assembleia aprovou greve por tempo indeterminado. Apoie o fundo.", cidade: "São Paulo" };
await recusa("quem está fora não publica", () => rpc(A("fora"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: chamado }), "sem_permissao");
await recusa("organização sem selo não publica", () => rpc(A("dona"), "alumia_trabalhadores_publicar", { p_handle: "brasa", p: chamado }), "sem_selo");
await recusa("tipo fora da lista", () => rpc(A("com"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: { ...chamado, tipo: "festa" } }), "invalido:tipo");
await recusa("prazo maior que 90 dias", () => rpc(A("com"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: { ...chamado, ate: new Date(Date.now() + 100 * 86400e3).toISOString().slice(0, 10) } }), "invalido:ate");
await recusa("data quebrada", () => rpc(A("com"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: { ...chamado, ate: "amanhã" } }), "invalido:data");
await recusa("telefone no texto", () => rpc(A("com"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: { ...chamado, texto: "Ligue para (11) 98888-7777 e saiba mais." } }), "dado_pessoal");
const C1 = await espera("quem fala pela organização publica (sem prazo: 30 dias)", () => rpc(A("com"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: chamado }),
  (r) => r.titulo === chamado.titulo && r.org.handle === "metro" && r.posso === true && r.encerrado === false && semPessoas(r));
await espera("todo mundo com conta vê o mural, sem saber quem escreveu", () => rpc(A("fora"), "alumia_trabalhadores", { p: {} }),
  (r) => r.chamados.length === 1 && r.chamados[0].posso === false && r.possoPublicar.length === 0 && r.cidades.join() === "São Paulo" && semPessoas(r));
await espera("o filtro por tipo e por cidade", async () => [await rpc(A("fora"), "alumia_trabalhadores", { p: { tipo: "assembleia" } }), await rpc(A("fora"), "alumia_trabalhadores", { p: { cidade: "são paulo" } })],
  ([a, b]) => a.chamados.length === 0 && b.chamados.length === 1);
await espera("quem fala pela organização vê onde pode publicar e os chamados dela", () => rpc(A("com"), "alumia_trabalhadores", { p: {} }), (r) => r.possoPublicar.length === 1 && r.meus.length === 1);
await espera("o visitante também lê (com a entrada desligada)", () => rpc(visitante, "alumia_trabalhadores", { p: {} }), (r) => r.chamados.length === 1 && r.possoPublicar.length === 0);
await recusa("quem está fora não encerra", () => rpc(A("fora"), "alumia_trabalhadores_encerrar", { p_id: C1?.id }), "nao_encontrado");
await espera("vencido some sozinho", async () => {
  await dono("update interno.rede_trabalhadores_chamados set ate = current_date - 1 where id = $1", [C1?.id]);
  return rpc(A("fora"), "alumia_trabalhadores", { p: {} });
}, (r) => r.chamados.length === 0);
await dono("update interno.rede_trabalhadores_chamados set ate = current_date + 5 where id = $1", [C1?.id]);
await espera("encerrar tira do mural", async () => { await rpc(A("com"), "alumia_trabalhadores_encerrar", { p_id: C1?.id }); return rpc(A("fora"), "alumia_trabalhadores", { p: {} }); }, (r) => r.chamados.length === 0);
await espera("no máximo 5 abertos por organização", async () => {
  for (let i = 0; i < L.muralAbertosPorOrg; i++) await rpc(A("com"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: { ...chamado, titulo: `Chamado número ${i}` } });
  try { await rpc(A("com"), "alumia_trabalhadores_publicar", { p_handle: "metro", p: { ...chamado, titulo: "Mais um chamado" } }); return false; } catch (e) { return e.message.includes("limite"); }
}, (r) => r === true);
await espera("sem selo, os chamados somem do mural", async () => {
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org]);
  return rpc(A("fora"), "alumia_trabalhadores", { p: {} });
}, (r) => r.chamados.length === 0);

// ═══════════════════ Fim ═══════════════════
await banco.pg.close?.();
console.log(`\n${certos} conferências certas.`);
if (falhas.length) {
  console.log(`\n${falhas.length} FALHA(S):`);
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
console.log("Pontes da onda 13: tudo certo.");
