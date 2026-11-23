// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a conta segura da Alumia (supabase/migracoes/20261114-alumia-o8-conta.sql) num Postgres de verdade (scripts/banco-local.mjs),
// com a migração rodada DUAS vezes sobre o install.sql e as tabelas do serviço de contas que o banco local não traz
// (auth.sessions, auth.refresh_tokens, auth.mfa_factors) criadas como no serviço real, com o endereço de rede dentro.
// O centro: nada do que sai do banco traz endereço de rede; sessão desconectada para na porta na hora; os códigos de recuperação
// ficam só como bcrypt, valem uma vez, os novos anulam os antigos e usar um tira o aplicativo e os outros aparelhos; o pânico
// desconecta tudo e esconde o perfil sem deixar rastro no registro; "fora da busca" some da busca e das sugestões, menos pelo @.
// Também confere as peças puras (lib/rede/seguranca/*.ts), os seis idiomas dos textos e que nenhuma entrada pede telefone.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o8-conta.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { navegadorDe } from "../lib/rede/seguranca/navegador.ts";
import { arquivoDosCodigos, codigoCompleto, formatarCodigo, normalizarCodigo } from "../lib/rede/seguranca/codigos.ts";
import { comTeto } from "../lib/rede/saida.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
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

// ═══════════════════ 0. O arquivo, as peças puras, os textos e a entrada ═══════════════════
const sql = ler("supabase/migracoes/20261114-alumia-o8-conta.sql");
ok("toda função nova com acesso a dado é security definer com search_path fixo (as puras não leem nada)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = /interno\.(alumia_navegador|alumia_navegador_texto|alumia_sessao_atual|codigo_normal)\(/;
  return funcoes.length >= 20 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || puras.test(f));
})());
ok("uma tabela nova só: o sal da hora da origem (nada de registro de acesso, nada guardado do aparelho)", (sql.match(/create table/gi) ?? []).length === 1
  && /create table if not exists interno\.origem_sal \(\s*hora timestamptz primary key,\s*sal text not null[^;]*\);/.test(sql));
ok("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?(interno|auth)\./i.test(sql));
ok("o endereço de rede do serviço de contas nunca é lido: só aparece para ser zerado", !/\bs\.ip\b|->> ?'ip'|new\.ip/.test(sql)
  && sql.split("\n").filter((l) => /ip_address/.test(l) && !/^\s*--/.test(l)).every((l) => /\{"ip_address": /.test(l)));
ok("a porta passa em toda função nova (alumia_trancar no fim)", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia", !/rede_alumia_versao/.test(sql));
ok("o resumo dos códigos é bcrypt (crypt + gen_salt bf)", /crypt\(\$1, %I\.gen_salt\(''bf'', 10\)\)/.test(sql));

const AGENTES = [
  ["Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0", "firefox", "linux"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "edge", "windows"],
  ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "chrome", "android"],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "safari", "ios"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/114.0.0.0", "opera", "macos"],
  ["curl/8.0", "outro", "outro"],
  ["", "outro", "outro"],
];
ok("navegadorDe lê só o navegador e o sistema", AGENTES.every(([a, n, s]) => { const r = navegadorDe(a); return r.navegador === n && r.sistema === s; }));
ok("navegadorDe sem agente não quebra", navegadorDe(null).navegador === "outro" && navegadorDe(undefined).sistema === "outro");
ok("o código: traço, espaço e minúscula não contam", normalizarCodigo(" a1b2c-3d4e5 ") === "A1B2C3D4E5" && codigoCompleto("a1b2c 3d4e5") && !codigoCompleto("A1B2C-3D4E") && !codigoCompleto("G1B2C-3D4E5"));
ok("o código se formata enquanto se digita (no máximo 10)", formatarCodigo("a1b2c3") === "A1B2C-3" && formatarCodigo("a1b2c3d4e5f6") === "A1B2C-3D4E5" && formatarCodigo("a1b") === "A1B");
ok("o arquivo dos códigos: numerado, com a data e sem nada da pessoa", (() => {
  const txt = arquivoDosCodigos(["AAAAA-11111", "BBBBB-22222"], { titulo: "T", geradosEm: "Em {quando}", instrucoes: ["Uma vez."] }, "14/11/2026");
  return txt === "T\nEm 14/11/2026\n\nUma vez.\n\n 1. AAAAA-11111\n 2. BBBBB-22222\n";
})());
await espera("comTeto: promessa que acaba a tempo", () => comTeto(Promise.resolve(1), 200), (r) => r === true);
await espera("comTeto: promessa que falha não lança", () => comTeto(Promise.reject(new Error("x")), 200), (r) => r === false);
await espera("comTeto: promessa lenta para no teto", () => comTeto(new Promise((p) => setTimeout(p, 500)), 50), (r) => r === false);

const chavesDe = (v, p = "", s = new Map()) => {
  if (Array.isArray(v)) { s.set(p, `lista:${v.length}`); v.forEach((x, i) => chavesDe(x, `${p}[${i}]`, s)); }
  else if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) chavesDe(f, p ? `${p}.${k}` : k, s);
  else s.set(p, typeof v === "string" && v.trim() ? "texto" : "vazio");
  return s;
};
const marcas = (t) => (typeof t === "string" ? (t.match(/\{\w+\}/g) ?? []).sort().join() : "");
const textos = Object.fromEntries(["pt", "en", "es", "fr", "ru", "zh"].map((l) => [l, JSON.parse(ler(`i18n/rede/seguranca/${l}.json`))]));
const refer = chavesDe(textos.pt);
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const atual = chavesDe(textos[l]);
  ok(`textos em ${l}: as mesmas chaves do português, nenhuma vazia`, refer.size === atual.size && [...refer].every(([k, tipo]) => atual.get(k) === tipo));
  const planoPt = Object.fromEntries([...refer.keys()].map((k) => [k, k.split(/\.|\[|\]/).filter(Boolean).reduce((o, c) => o?.[c], textos.pt)]));
  ok(`textos em ${l}: os mesmos {marcadores}`, Object.entries(planoPt).every(([k, v]) => marcas(v) === marcas(k.split(/\.|\[|\]/).filter(Boolean).reduce((o, c) => o?.[c], textos[l]))));
}
ok("texto de tela novo sem palavra proibida", !/diploma|universidade|algoritmo/i.test(JSON.stringify(textos.pt)));

const entrada = ["components/rede/entrada/Formularios.tsx", "components/rede/entrada/PortaoDaAlumia.tsx", "components/rede/entrada/SegundoFator.tsx", "components/SignIn.tsx"].map(ler).join("\n");
ok("nenhuma entrada pede telefone (sem campo tel, sem login por telefone)", !/type="tel"|autoComplete="tel"|signInWithOtp\(\s*\{\s*phone|phone:/.test(entrada));
ok("criar conta continua pedindo e-mail (campo obrigatório)", /id="ale-criar-email"[^>]*type="email"[^>]*required/.test(ler("components/rede/entrada/Formularios.tsx")));
ok("as telas não leem endereço de rede", !/\bip\b|endereco_ip|ip_address/.test(["components/rede/seguranca/ListaDeAparelhos.tsx", "lib/rede/seguranca/cliente.ts"].map(ler).join("\n")));

// ═══════════════════ 1. Banco, serviço de contas e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
/** Chama uma função como a API faria, com o session_id no token (o rpc do banco local não leva). */
const rpc = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    const claims = JSON.stringify({ role: quem.papel ?? "authenticated", ...(quem.sub ? { sub: quem.sub } : {}), aal: quem.aal ?? "aal1", ...(quem.sessao ? { session_id: quem.sessao } : {}) });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, JSON.stringify({ "x-forwarded-for": "198.51.100.10" })]);
    await banco.pg.exec(`set role ${quem.papel === "anon" ? "anon" : quem.papel === "service_role" ? "service_role" : "authenticated"}`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, nomes.map((n) => argumentos[n]))).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });

await exec(`
  create table auth.sessions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, created_at timestamptz default now(), updated_at timestamptz default now(),
    factor_id uuid, aal text, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text);
  create table auth.refresh_tokens (
    id bigserial primary key, token varchar(255), user_id varchar(255), revoked boolean default false, created_at timestamptz default now(),
    session_id uuid references auth.sessions (id) on delete cascade);
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null, factor_type text default 'totp', created_at timestamptz default now());
  create table auth.mfa_challenges (id uuid primary key default gen_random_uuid(), factor_id uuid not null, created_at timestamptz not null default now(), ip_address inet not null);
  create table auth.audit_log_entries (instance_id uuid, id uuid primary key default gen_random_uuid(), payload json, created_at timestamptz default now(), ip_address varchar(64) not null default '');
  -- O que o serviço de contas já tinha gravado antes da migração, com o endereço de rede dentro.
  insert into auth.sessions (user_id, user_agent, ip) values (gen_random_uuid(), 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0', '192.0.2.10');
  insert into auth.mfa_challenges (factor_id, ip_address) values (gen_random_uuid(), '192.0.2.11');
  insert into auth.audit_log_entries (payload, ip_address) values ('{"action": "login"}', '192.0.2.12');
`);

const P = {};
for (const nome of ["ana", "bia", "caio", "duda"]) {
  P[nome] = await criarUsuario(`${nome}@conta.local`, `Pessoa ${nome}`);
  await rpc({ sub: P[nome] }, "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia", "duda"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}

// Um código antigo, gravado como era antes da onda (SHA-256 sem sal), num banco em que a regra da coluna ainda aceita isso.
await dono("alter table interno.codigos_recuperacao drop constraint if exists codigos_recuperacao_hash_forma");
await dono("insert into interno.codigos_recuperacao (usuario, hash) values ($1, interno.codigo_hash('ABCDE-12345'))", [P.duda]);
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
// O conserto de 18/11 (20261118-mfa-endereco-depois.sql): o pedido de código do autenticador guarda o endereço enquanto vale.
const mfa = ler("supabase/migracoes/20261118-mfa-endereco-depois.sql");
await espera("o conserto do autenticador instala por cima", () => exec(mfa));
await espera("e de novo (idempotente)", () => exec(mfa));
// ═══════════════════ 1b. Endereço de rede: nem a Alumia nem o serviço de contas guardam ═══════════════════
await espera("o que o serviço de contas já tinha gravado ficou sem o endereço", () => dono(`select (select count(*) from auth.sessions where ip is not null)::int as s,
  (select count(*) from auth.mfa_challenges where ip_address <> '0.0.0.0')::int as m, (select count(*) from auth.audit_log_entries where ip_address <> '')::int as a`),
  (r) => r.rows[0].s === 0 && r.rows[0].m === 0 && r.rows[0].a === 0);
await espera("e o que ele grava daqui em diante também", async () => {
  await dono("insert into auth.sessions (user_id, user_agent, ip) values (gen_random_uuid(), 'x', '192.0.2.20')");
  await dono("update auth.sessions set ip = '192.0.2.21'");
  await dono("insert into auth.mfa_challenges (factor_id, ip_address) values (gen_random_uuid(), '192.0.2.22')");
  await dono("insert into auth.audit_log_entries (payload, ip_address) values ('{}', '192.0.2.23')");
  return dono(`select (select count(*) from auth.sessions where ip is not null)::int as s, (select count(*) from auth.mfa_challenges where ip_address <> '0.0.0.0')::int as m,
    (select count(*) from auth.audit_log_entries where ip_address <> '')::int as a`);
}, (r) => r.rows[0].s === 0 && r.rows[0].m === 1 && r.rows[0].a === 0);
// O serviço de contas compara o endereço do pedido de código com o de quem confirma (422 mfa_ip_address_mismatch se diferem):
// zerar na hora travava todo código, até o certo. O endereço fica só enquanto o pedido vale e sai depois de 15 minutos.
await espera("o pedido de código novo guarda o endereço (sem ele, o serviço de contas recusa todo código)", () =>
  dono("select ip_address::text as ip from auth.mfa_challenges where ip_address <> '0.0.0.0'"), (r) => r.rows.length === 1 && r.rows[0].ip.startsWith("192.0.2.22"));
await espera("e confirmar o código (o serviço de contas grava a hora) não apaga o endereço", async () => {
  await dono("update auth.mfa_challenges set created_at = created_at where ip_address <> '0.0.0.0'");
  return dono("select count(*)::int as n from auth.mfa_challenges where ip_address <> '0.0.0.0'");
}, (r) => r.rows[0].n === 1);
await espera("o pedido que passou dos 15 minutos perde o endereço no próximo pedido", async () => {
  await dono("update auth.mfa_challenges set created_at = now() - interval '20 minutes'");
  await dono("insert into auth.mfa_challenges (factor_id, ip_address) values (gen_random_uuid(), '192.0.2.24')");
  return dono("select ip_address::text as ip from auth.mfa_challenges where ip_address <> '0.0.0.0'");
}, (r) => r.rows.length === 1 && r.rows[0].ip.startsWith("192.0.2.24"));
await espera("e a faxina sozinha (a do pg_cron) zera o que passou do prazo", async () => {
  await dono("update auth.mfa_challenges set created_at = now() - interval '20 minutes'");
  const n = (await dono("select interno.mfa_endereco_zerar() as n")).rows[0].n;
  return { n, resta: (await dono("select count(*)::int as c from auth.mfa_challenges where ip_address <> '0.0.0.0'")).rows[0].c };
}, (r) => r.n === 1 && r.resta === 0);
ok("nem o conserto lê o endereço: só zera", !/select [^;]*ip_address[^;]* from auth/i.test(mfa.replace(/--.*$/gm, "")));
await exec("delete from auth.sessions; delete from auth.mfa_challenges; delete from auth.audit_log_entries;");
await espera("o segredo fixo das origens saiu do banco", () => dono("select count(*)::int as n from interno.origem_segredo"), (r) => r.rows[0].n === 0);
await espera("entrar não grava a origem no perfil", async () => {
  await rpc({ sub: P.caio }, "eu");
  return dono("select count(*)::int as n from interno.perfis where origem is not null");
}, (r) => r.rows[0].n === 0);
const origem = await espera("o limite de quem não tem conta usa o resumo com o sal desta hora", () => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', '{}', false), set_config('request.headers', $1, false)", [JSON.stringify({ "cf-connecting-ip": "203.0.113.78" })]);
  await banco.pg.query("select interno.limite('teste_origem', 5, 60)");
  const chave = (await banco.pg.query("select chave from interno.limites where chave like 'teste_origem:%'")).rows[0]?.chave;
  const sal = (await banco.pg.query("select count(*)::int as n, bool_and(hora = date_trunc('hour', now())) as desta from interno.origem_sal")).rows[0];
  const refeito = (await banco.pg.query("select 'teste_origem:' || encode(sha256(convert_to((select sal from interno.origem_sal) || ':203.0.113.78', 'UTF8')), 'hex') as c")).rows[0].c;
  return { chave, sal, refeito };
}), ({ chave, sal, refeito }) => /^teste_origem:[0-9a-f]{64}$/.test(chave) && !chave.includes("203.0.113") && sal.n === 1 && sal.desta && chave === refeito);
await espera("acabada a hora, o sal sai e o resumo não volta mais ao endereço (nem com o banco inteiro na mão)", async () => {
  await dono("update interno.origem_sal set hora = hora - interval '1 hour'");
  const saiu = (await dono("select interno.origem_sal_faxina() as n")).rows[0].n;
  const sobrou = (await dono("select count(*)::int as n from interno.origem_sal")).rows[0].n;
  return { saiu, sobrou };
}, ({ saiu, sobrou }) => saiu === 1 && sobrou === 0);
await espera("a hora seguinte tem outro sal: o mesmo endereço vira outro resumo", () => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.headers', $1, false)", [JSON.stringify({ "cf-connecting-ip": "203.0.113.78" })]);
  return (await banco.pg.query("select interno.origem() as o")).rows[0].o;
}), (o) => origem && /^[0-9a-f]{64}$/.test(o) && `teste_origem:${o}` !== origem.chave);
await espera("numa transação só de leitura, a origem ainda responde (com um sal jogado fora)", () => banco.exclusivo(async () => {
  await banco.pg.exec("delete from interno.origem_sal; begin read only;");
  try {
    return (await banco.pg.query("select interno.origem() as o")).rows[0].o;
  } finally {
    await banco.pg.exec("rollback");
  }
}), (o) => /^[0-9a-f]{64}$/.test(o));
await espera("o gatilho de entrada nova existe em auth.sessions", () => dono("select count(*)::int as n from pg_trigger where tgname = 'alumia_sessao_nova' and not tgisinternal"), (r) => r.rows[0].n === 1);

const funcoes = (await dono(`
  select p.proname as nome, has_function_privilege('anon', p.oid, 'execute') as anon, p.prosrc like '%alumia_porta()%' as porta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'alumia\\_conta\\_%'`)).rows;
ok("as seis funções da tela existem", funcoes.length === 6);
ok("visitante não executa nenhuma", funcoes.every((f) => !f.anon));
ok("todas com a porta da Alumia", funcoes.every((f) => f.porta));
ok("a busca e as sugestões refeitas voltam com a porta", (await dono("select bool_and(prosrc like '%alumia_porta()%') as ok from pg_proc where proname in ('rede_desc_buscar', 'rede_conv_sugerir')")).rows[0].ok);

// ═══════════════════ 2. Aviso de entrada nova ═══════════════════
const IP = "203.0.113.77";
const FIREFOX = AGENTES[0][0], CHROME_ANDROID = AGENTES[2][0], EDGE = AGENTES[1][0];
const novaSessao = async (usuario, agente, aal = "aal2", minutosAtras = 0) =>
  (await dono(`insert into auth.sessions (user_id, user_agent, ip, aal, created_at, updated_at, refreshed_at)
               values ($1, $2, $3, $4, now() - make_interval(mins => $5), now() - make_interval(mins => $5), (now() - make_interval(mins => $5))::timestamp) returning id`,
    [usuario, agente, IP, aal, minutosAtras])).rows[0].id;
const avisosDe = async (u) => (await dono("select texto from interno.avisos where para = $1 and categoria = 'conta' order by criado_em", [u])).rows.map((r) => r.texto);
const emailsDe = async (u, tipo) => (await dono("select texto from interno.emails where para = $1 and tipo = $2", [`${u}@conta.local`, tipo])).rows.map((r) => r.texto);

const s1 = await novaSessao(P.ana, FIREFOX);
await dono("insert into auth.refresh_tokens (token, user_id, session_id) values ('t1', $1, $2)", [P.ana, s1]);
let av = await avisosDe(P.ana);
ok("entrada nova: aviso na conta com navegador, sistema, dia e hora", av.length === 1 && /Firefox em Linux, em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} \(hora de Brasília\)/.test(av[0]));
ok("o aviso não traz endereço de rede nem cidade", !av.some((t) => t.includes(IP) || /203\.0/.test(t)));
let em = await emailsDe("ana", "alumia_entrada_nova");
ok("entrada nova: e-mail para a conta, sem endereço de rede", em.length === 1 && em[0].includes("Firefox em Linux") && !em[0].includes(IP));
const s2 = await novaSessao(P.ana, FIREFOX);
ok("o mesmo navegador em até 15 minutos (o login único) não avisa de novo", (await avisosDe(P.ana)).length === 1);
const s3 = await novaSessao(P.ana, CHROME_ANDROID, "aal1");
await dono("insert into auth.refresh_tokens (token, user_id, session_id) values ('t3', $1, $2)", [P.ana, s3]);
ok("outro navegador avisa", (await avisosDe(P.ana)).length === 2 && (await avisosDe(P.ana))[1].includes("Chrome em Android"));
await novaSessao(P.caio, FIREFOX);
ok("quem não está na Alumia não recebe o aviso da Alumia", (await avisosDe(P.caio)).length === 0);
const sb = await novaSessao(P.bia, EDGE);

// ═══════════════════ 3. Aparelhos conectados ═══════════════════
const ana = (sessao, aal = "aal2") => ({ sub: P.ana, sessao, aal });
const lista = await espera("a lista de aparelhos", () => rpc(ana(s1), "alumia_conta_aparelhos"), (r) => r.disponivel === true && r.aparelhos.length === 3);
if (lista) {
  ok("este aparelho vem marcado e primeiro", lista.aparelhos[0].id === s1 && lista.aparelhos[0].este === true && lista.aparelhos.filter((a) => a.este).length === 1);
  ok("cada aparelho: navegador, sistema, dias e se passou pelo código", lista.aparelhos.every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.desde) && /^\d{4}-\d{2}-\d{2}$/.test(a.ultima) && typeof a.confirmado === "boolean" && a.navegador && a.sistema));
  ok("a lista não traz endereço de rede, user agent, token nem hora", (() => { const j = JSON.stringify(lista); return !j.includes(IP) && !/"ip"|user_agent|Mozilla|token|T\d{2}:/.test(j); })());
  ok("a sessão sem o código aparece como tal", lista.aparelhos.find((a) => a.id === s3)?.confirmado === false);
}
await dono("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [P.ana]);
await recusa("com o aplicativo cadastrado, sessão sem o código não vê os aparelhos", () => rpc(ana(s3, "aal1"), "alumia_conta_aparelhos"), "confirme_segundo_fator");
await recusa("visitante não chama", () => rpc({ papel: "anon" }, "alumia_conta_aparelhos"), "permission denied");

await recusa("não desconecta este aparelho por aqui", () => rpc(ana(s1), "alumia_conta_desconectar", { p_sessao: s1 }), "invalido:este_aparelho");
await recusa("não desconecta aparelho de outra pessoa", () => rpc(ana(s1), "alumia_conta_desconectar", { p_sessao: sb }), "nao_encontrado");
ok("a sessão da outra pessoa continua", (await dono("select count(*)::int as n from auth.sessions where id = $1", [sb])).rows[0].n === 1);
await espera("desconecta um aparelho", () => rpc(ana(s1), "alumia_conta_desconectar", { p_sessao: s3 }), (r) => r.ok && r.desconectados === 1);
ok("a sessão e o token de renovação dele saíram", (await dono("select (select count(*) from auth.sessions where id = $1)::int as s, (select count(*) from auth.refresh_tokens where session_id = $1)::int as t", [s3])).rows[0].s === 0);
ok("o token de renovação deste aparelho ficou", (await dono("select count(*)::int as n from auth.refresh_tokens where session_id = $1", [s1])).rows[0].n === 1);

// ═══════════════════ 4. Sessão desconectada para na porta ═══════════════════
await recusa("o token da sessão desconectada não usa mais nada da Alumia (trava desligada)", () => rpc(ana(s3), "alumia_conta_situacao"), "alumia_entrada");
await espera("o token da sessão viva passa", () => rpc(ana(s1), "alumia_conta_situacao"), (r) => r.segundo_fator === true && r.fora_da_busca === false && r.sessoes === true);
await espera("token sem sessão (antigo, ou o próprio serviço) passa", () => rpc({ sub: P.ana, aal: "aal2" }, "alumia_conta_situacao"), (r) => r !== null);

await espera("desconecta todos os outros", () => rpc(ana(s1), "alumia_conta_desconectar"), (r) => r.desconectados === 1);
ok("sobrou só este aparelho", (await dono("select array_agg(id::text) as ids from auth.sessions where user_id = $1", [P.ana])).rows[0].ids.join() === s1);
await recusa("e o outro também para na porta", () => rpc(ana(s2), "alumia_conta_situacao"), "alumia_entrada");

// ═══════════════════ 5. Fora da busca ═══════════════════
await dono("insert into interno.rede_desc_entrada (usuario, aparece) values ($1, true) on conflict (usuario) do update set aparece = true", [P.bia]).catch(() => null);
const bia = { sub: P.bia, sessao: sb, aal: "aal2" };
const pessoas = async (q) => ((await rpc(ana(s1), "rede_desc_buscar", { p_q: q })) ?? {}).pessoas?.map((p) => p.handle) ?? [];
const sugestoes = async (q) => ((await rpc(ana(s1), "rede_conv_sugerir", { p_prefixo: q })) ?? []).map((p) => p.handle);
const buscaOk = await espera("a busca de pessoas acha bia pelo codinome (antes)", () => pessoas("Codinome bia"), (r) => r.includes("c_bia"));
await espera("as sugestões de @ acham bia pelo começo (antes)", () => sugestoes("c_b"), (r) => r.includes("c_bia"));
await espera("bia fica fora da busca", () => rpc(bia, "alumia_conta_fora_da_busca", { p_fora: true }), (r) => r.fora_da_busca === true);
if (buscaOk) await espera("a busca pelo codinome não acha mais", () => pessoas("Codinome bia"), (r) => !r.includes("c_bia"));
if (buscaOk) await espera("pelo @ inteiro ainda acha", () => pessoas("@c_bia"), (r) => r.includes("c_bia"));
await espera("a sugestão pelo começo não acha mais", () => sugestoes("c_b"), (r) => !r.includes("c_bia"));
await espera("a sugestão pelo @ inteiro acha", () => sugestoes("c_bia"), (r) => r.includes("c_bia"));
await espera("fora dos pacotes de sugestão", () => dono("select interno.rede3_desc_elegivel(f, $2) as e from interno.perfis f where f.id = $1", [P.bia, P.ana]), (r) => r.rows[0].e === false);
await espera("de volta à busca", () => rpc(bia, "alumia_conta_fora_da_busca", { p_fora: false }), (r) => r.fora_da_busca === false);

// ═══════════════════ 6. Códigos de recuperação ═══════════════════
await recusa("sem o código do aplicativo nesta sessão, não gera códigos", () => rpc({ sub: P.ana, sessao: s1, aal: "aal1" }, "conta_codigos_gerar"), "confirme_segundo_fator");
await recusa("sem aplicativo cadastrado, não há códigos", () => rpc({ sub: P.duda, aal: "aal2" }, "conta_codigos_gerar"), "sem_segundo_fator");
const gerados = await espera("gera dez códigos", () => rpc(ana(s1), "conta_codigos_gerar"), (r) => r.codigos.length === 10 && r.codigos.every((c) => /^[0-9A-F]{5}-[0-9A-F]{5}$/.test(c)) && new Set(r.codigos).size === 10);
const codigos = gerados?.codigos ?? [];
const hashes = (await dono("select hash from interno.codigos_recuperacao where usuario = $1", [P.ana])).rows.map((r) => r.hash);
ok("o banco guarda só bcrypt, um sal por código", hashes.length === 10 && hashes.every((h) => /^\$2[aby]\$10\$/.test(h)) && new Set(hashes.map((h) => h.slice(7, 29))).size === 10);
ok("nenhum código aparece no banco", !hashes.some((h) => codigos.some((c) => h.includes(c) || h.includes(c.replace("-", "")))));
await espera("a situação conta os códigos", () => rpc(ana(s1), "alumia_conta_situacao"), (r) => Number(r.codigos_restantes) === 10 && r.codigos_gerados_em);

const s4 = await novaSessao(P.ana, CHROME_ANDROID, "aal1", 30);
await novaSessao(P.ana, EDGE, "aal2", 40);
await espera("código errado não vale (e não é erro)", () => rpc(ana(s4, "aal1"), "conta_codigo_usar", { p_codigo: "00000-00000" }), (r) => r.ok === false && r.motivo === "codigo_invalido");
await espera("código pela metade não vale", () => rpc(ana(s4, "aal1"), "conta_codigo_usar", { p_codigo: codigos[0]?.slice(0, 6) }), (r) => r.ok === false);
await espera("código de outra pessoa não vale", () => rpc({ sub: P.bia, sessao: sb, aal: "aal1" }, "conta_codigo_usar", { p_codigo: codigos[1] }), (r) => r.ok === false);
await espera("código certo (minúsculas, sem traço) entra só com a senha", () => rpc(ana(s4, "aal1"), "conta_codigo_usar", { p_codigo: codigos[0].replace("-", "").toLowerCase() }), (r) => r.ok === true && Number(r.restantes) === 9);
ok("o aplicativo saiu da conta (é preciso cadastrar outro)", (await dono("select count(*)::int as n from auth.mfa_factors where user_id = $1", [P.ana])).rows[0].n === 0);
ok("os outros aparelhos foram desconectados; o que usou o código ficou", (await dono("select array_agg(id::text) as ids from auth.sessions where user_id = $1", [P.ana])).rows[0].ids.join() === s4);
ok("aviso e e-mail de código usado", (await avisosDe(P.ana)).some((t) => /código de recuperação foi usado/.test(t)) && (await emailsDe("ana", "codigo_recuperacao_usado")).length === 1);
await espera("o mesmo código não vale duas vezes", () => rpc(ana(s4, "aal1"), "conta_codigo_usar", { p_codigo: codigos[0] }), (r) => r.ok === false);

await dono("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [P.ana]);
const s6 = await novaSessao(P.ana, FIREFOX, "aal2", 50);
const novos = await espera("gerar de novo dá outros dez", () => rpc(ana(s6), "conta_codigos_gerar"), (r) => r.codigos.length === 10);
await espera("os antigos deixam de valer", () => rpc(ana(s6, "aal1"), "conta_codigo_usar", { p_codigo: codigos[2] }), (r) => r.ok === false);
await espera("o resumo antigo (SHA-256 sem sal) foi embrulhado em bcrypt com sal próprio", () => dono("select hash from interno.codigos_recuperacao where usuario = $1", [P.duda]),
  (r) => r.rows.length === 1 && /^h\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(r.rows[0].hash));
await recusa("SHA-256 cru não entra mais na tabela", () => dono("insert into interno.codigos_recuperacao (usuario, hash) values ($1, interno.codigo_hash('FFFFF-00000'))", [P.duda]), "codigos_recuperacao_hash_forma");
await espera("o código antigo, embrulhado, ainda vale", () => rpc({ sub: P.duda, aal: "aal1" }, "conta_codigo_usar", { p_codigo: "abcde12345" }), (r) => r.ok === true);
await espera("o SHA-256 cru do código não confere com nada", () => dono("select interno.codigo_confere('ABCDE-12345', interno.codigo_hash('ABCDE-12345')) as c"), (r) => r.rows[0].c === false);
await recusa("a sexta tentativa na mesma hora para", async () => { for (let i = 0; i < 6; i++) await rpc({ sub: P.bia, aal: "aal1" }, "conta_codigo_usar", { p_codigo: "11111-11111" }); }, "muitos_pedidos");
ok("os códigos novos são outros", novos ? !novos.codigos.some((c) => codigos.includes(c)) : false);

// ═══════════════════ 7. O pânico ═══════════════════
const s7 = await novaSessao(P.ana, CHROME_ANDROID, "aal2", 60);
await dono("insert into auth.refresh_tokens (token, user_id, session_id) values ('t7', $1, $2)", [P.ana, s7]);
const antesRegistro = (await dono("select count(*)::int as n from interno.auditoria")).rows[0].n;
await espera("o pânico desconecta todos, este também, e esconde o perfil", () => rpc(ana(s6), "alumia_conta_panico", { p_esconder: true }), (r) => r.ok && r.desconectados >= 2 && r.escondido === true);
ok("nenhuma sessão nem token de renovação sobrou", (await dono("select (select count(*) from auth.sessions where user_id = $1)::int as s, (select count(*) from auth.refresh_tokens where user_id = $1::text)::int as t", [P.ana])).rows[0].s === 0);
ok("o perfil ficou escondido (mesmo efeito do modo invisível)", (await dono("select rede_invisivel and rede_panico_em is not null as e from interno.perfis where id = $1", [P.ana])).rows[0].e);
ok("o pânico não deixa linha no registro de atividades", (await dono("select count(*)::int as n from interno.auditoria")).rows[0].n === antesRegistro);
await recusa("o token de antes do pânico para na porta", () => rpc(ana(s6), "alumia_conta_situacao"), "alumia_entrada");
const bp = await espera("a busca não acha mais a pessoa, nem pelo @", () => rpc({ sub: P.bia, sessao: sb, aal: "aal2" }, "rede_desc_buscar", { p_q: "@c_ana" }), (r) => !(r?.pessoas ?? []).some((p) => p.handle === "c_ana"));
void bp;
const s8 = await novaSessao(P.ana, FIREFOX, "aal2", 70);
await espera("ao voltar, a tela sabe que o pânico escondeu o perfil", () => rpc(ana(s8), "alumia_conta_situacao"), (r) => r.escondido_pelo_panico === true && r.panico_em);
await espera("mostrar de novo devolve o modo escolhido", () => rpc(ana(s8), "alumia_conta_mostrar_perfil"), (r) => r.ok && r.invisivel === false);
await espera("e a marca do pânico some", () => rpc(ana(s8), "alumia_conta_situacao"), (r) => r.escondido_pelo_panico === false && r.panico_em === null);
await dono("update interno.perfis set rede_modo = 'invisivel', rede_invisivel = true where id = $1", [P.duda]);
await rpc({ sub: P.duda, aal: "aal2" }, "alumia_conta_panico", { p_esconder: true });
await espera("quem já era invisível continua invisível ao mostrar", () => rpc({ sub: P.duda, aal: "aal2" }, "alumia_conta_mostrar_perfil"), (r) => r.invisivel === true);
await espera("pânico sem esconder só desconecta", () => rpc(bia, "alumia_conta_panico", { p_esconder: false }), (r) => r.escondido === false);
ok("bia continua visível", (await dono("select rede_invisivel as i from interno.perfis where id = $1", [P.bia])).rows[0].i === false);

// ═══════════════════ 8. Com a trava da entrada ligada ═══════════════════
await espera("liga a trava", () => dono("select interno.alumia_entrada_ligar(true) as r"));
await dono("update interno.alumia_entrada set situacao = 'em_analise' where usuario = $1", [P.duda]).catch(() => null);
await dono("insert into interno.alumia_entrada (usuario, situacao, motivo_pedido) values ($1, 'em_analise', 'Quero me organizar com o núcleo.') on conflict (usuario) do update set situacao = 'em_analise'", [P.duda]);
await recusa("conta não aprovada não usa a conta segura da Alumia", () => rpc({ sub: P.duda, aal: "aal2" }, "alumia_conta_situacao"), "alumia_entrada");
await espera("o código de recuperação continua usável antes do aal2 (é do serviço de contas, não da rede)", () => rpc({ sub: P.duda, aal: "aal1" }, "conta_codigo_usar", { p_codigo: "00000-00000" }), (r) => r.ok === false);

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
