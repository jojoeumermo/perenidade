// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o apoio da onda 13 (supabase/migracoes/20261119-alumia-o13-apoio.sql) num Postgres de verdade (scripts/banco-local.mjs),
// com a migração rodada TRÊS vezes sobre o install.sql:
//   · a vaquinha: Pix e link só de organização COM SELO (sem selo o banco recusa pôr, e o que havia some da resposta); Pix com CPF,
//     telefone ou e-mail recusado; meta, arrecadado (com o dia) e prestação de contas só pela tesouraria ou por quem gerencia;
//     nenhuma resposta traz quem doou, quem lançou ou quem escreveu (nem número de doadores); a denúncia de vaquinha falsa cai na
//     fila da mediação sem dizer à organização quem denunciou;
//   · a petição com meta: a meta só de 10 a 10 milhões; o total só a partir de 3; "chegou" só com o total publicado; o documento de
//     entrega só para quem organiza, com o NÚMERO e o texto, e nenhum nome; abaixo de 3, recusado;
//   · as regras puras da tela e os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o13-apoio.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { casasDaMeta, documentoDaEntrega, LIMITES_DO_APOIO as L, lerMetaDaPeticao, limparCaixas, limparPeticaoComMeta } from "../components/rede/apoio/regras.ts";

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

// ═══════════════════ 0. O arquivo e as regras da tela ═══════════════════
const sql = ler("supabase/migracoes/20261119-alumia-o13-apoio.sql");
const semComentario = sql.replace(/--.*$/gm, "");
ok("toda função é security definer com search_path fixo (ou imutável sem tabela)", (() => {
  const funcoes = semComentario.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 18 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || (/immutable set search_path = interno, pg_temp/.test(f)));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("a tabela nova nasce com RLS e sem permissão para anon e authenticated", tabelas.length === 1
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede nem quem doou", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta|doador|quem|autor)\b/.test(t))
  && !/add column if not exists (ip|doador|doadores|quem)/.test(sql));
ok("nenhuma função recebe parâmetro do tipo linha de tabela", !/create or replace function [^(]+\([^)]*\binterno\.rede_[a-z_]+\b(?!\()/i.test(semComentario));
ok("nenhum parâmetro com valor padrão", !/create or replace function [^(]+\([^)]*\bdefault\b/i.test(semComentario));
ok("não mexe na versão da Alumia nem no install.sql, e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-300)));
ok("os limites da tela são os do banco", sql.includes(`meta between ${L.metaCaixaMin} and ${L.centavosMax}`) && sql.includes(`between ${L.metaPeticaoMin} and ${L.metaPeticaoMax}`)
  && sql.includes(`between ${L.contaMin} and ${L.contaMax}`) && sql.includes(`current_date - ${L.diasParaTras}`) && sql.includes(`char_length(v) > ${L.pixMax}`));

ok("a meta escrita da petição", lerMetaDaPeticao("") === null && lerMetaDaPeticao(" 1.000 ") === 1000 && lerMetaDaPeticao("9") === "numero" && lerMetaDaPeticao("abc") === "numero"
  && lerMetaDaPeticao("10000001") === "numero" && lerMetaDaPeticao("500") === 500);
ok("as casas da meta: 20 ladrilhos, cheios na proporção, nunca passa de 20", casasDaMeta(0, 1000) === 0 && casasDaMeta(500, 1000) === 10 && casasDaMeta(5000, 1000) === 20
  && casasDaMeta(1, 1000) === 1 && casasDaMeta(null, 1000) === 0 && casasDaMeta(10, null) === 0);
ok("a petição limpa: total só de 3 para cima, meta só no intervalo", (() => {
  const a = limparPeticaoComMeta({ id: "x", ato: "a", alvo: "b", texto: "c", prazo: null, aberta: true, total: 2, meta: 5, chegou: true, assinei: false, organiza: false });
  const b = limparPeticaoComMeta({ id: "x", ato: "a", alvo: "b", texto: "c", prazo: null, aberta: true, total: 120, meta: 100, chegou: true, assinei: false, organiza: true });
  return a.total === null && a.meta === null && a.chegou === false && b.total === 120 && b.meta === 100 && b.chegou === true && limparPeticaoComMeta(null) === null;
})());
ok("o caixa limpo não deixa passar Pix sem selo", (() => {
  const r = limparCaixas({ dentro: false, tesouraria: false, gerencio: false, selo: false, caixas: [{ id: "c", nome: "Fundo", tipo: "greve", pix: "12.345.678/0001-90", link: "https://x.org", nucleo: null, saldo: 0, entradas: 0, saidas: 0, esperando: null, lancamentos: [], meta: 10000, arrecadado: 500, arrecadadoDia: "2026-11-10", contas: [] }] });
  return r.caixas[0].pix === null && r.caixas[0].link === null && r.caixas[0].meta === 10000 && r.caixas[0].arrecadado === 500;
})());
ok("o documento de entrega leva o número e o texto, e nenhum nome", (() => {
  const t = JSON.parse(ler("i18n/rede/apoio/pt.json"));
  const d = documentoDaEntrega({ alvo: "Prefeitura", texto: "Pedimos moradia digna para as famílias.", total: 1234, meta: 1000, abertaEm: "2026-11-01T12:00:00Z", prazo: null, encerrada: false, ato: "Fica Esperança", geradoEm: "2026-11-16T12:00:00Z" }, t.peticao.documento, "pt");
  return d.includes("Prefeitura") && d.includes("Pedimos moradia digna") && d.includes("1.234") && !/\{[a-z]+\}/.test(d);
})());

// Os textos: as seis línguas com as mesmas chaves e marcadores; nenhuma palavra proibida; todo erro do banco com frase.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/apoio/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/apoio/${l}.json`));
    const outro = formas(j);
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`apoio/${l}.json: mesmas chaves e marcadores do pt, marcado como rascunho ou revisado${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0 && (j._rascunho === true || !("_rascunho" in j)));
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|university|universidad|universit|algoritm|algorithm|алгоритм|算法|大学/i.test(ler(`i18n/rede/apoio/${l}.json`))));
  const codigos = [...new Set([...sql.matchAll(/interno\.erro\('([a-z_]+)(?::[a-z_]+)?'/g)].map((m) => m[1]))];
  ok(`todo erro da migração tem frase (${codigos.filter((c) => !pt.erros[c]).join(", ")})`, codigos.every((c) => typeof pt.erros[c] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
const PUBLICAS = ["rede_org_caixa", "rede_org_caixa_criar", "rede_org_vaquinha_ajustar", "rede_org_vaquinha_conta", "rede_org_vaquinha_conta_retirar", "rede_org_vaquinha_denunciar",
  "rede_peticao", "rede_peticao_criar", "rede_peticao_assinar", "rede_peticao_encerrar", "rede_peticao_meta", "rede_peticao_entrega"];
await espera("toda função pública desta frente passa pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)", [PUBLICAS])).rows,
(rs) => rs.length === PUBLICAS.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
await espera("rede_org_caixa_contas: RLS ligada e nenhuma política", async () => um("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = 'rede_org_caixa_contas') as n from pg_class c where c.oid = 'interno.rede_org_caixa_contas'::regclass"),
  (r) => r.r === true && r.n === 0);
await espera("as funções internas novas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o13\\_%'`)).rows,
(rs) => rs.length >= 8 && rs.every((r) => !r.a && !r.b));
await espera("as de conta não abrem para visitante", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname in ('rede_org_vaquinha_ajustar', 'rede_org_vaquinha_conta', 'rede_org_vaquinha_conta_retirar', 'rede_org_vaquinha_denunciar', 'rede_peticao_meta', 'rede_peticao_entrega')`)).rows,
(rs) => rs.length === 6 && rs.every((r) => !r.a));
await espera("nenhuma função nova recebe parâmetro do tipo linha (o Supabase barra o ALTER TABLE depois)", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('public', 'interno') and (p.proname = any ($1) or p.proname like 'alumia\\_o13\\_%')
                 and exists (select 1 from unnest(p.proargtypes) t join pg_type ty on ty.oid = t where ty.typtype = 'c')`, [PUBLICAS])).rows,
(rs) => rs.length === 0);
await espera("dá para acrescentar coluna com valor padrão nas tabelas tocadas (nenhuma função com a linha e valor padrão)", async () => {
  await exec("alter table interno.rede_org_caixas add column if not exists teste_o13 boolean not null default false; alter table interno.rede_org_caixas drop column teste_o13;");
  await exec("alter table interno.rede_peticoes add column if not exists teste_o13 boolean not null default false; alter table interno.rede_peticoes drop column teste_o13;");
  return true;
});

const P = {};
const NOMES = ["org", "org2", "dona", "t1", "t2", "m1", "m2", "m3", "m4", "fora", "bloq"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o13.local`, nome);
  await rpc(como(P[nome]), "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const [i, nome] of NOMES.entries()) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o13`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono("update interno.perfis set rede_handle = 'lume', rede_codinome = 'Coletivo Lume' where id = $1", [P.org]);
await dono("update interno.perfis set rede_handle = 'brasa', rede_codinome = 'Coletivo Brasa' where id = $1", [P.org2]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, documento_tipo, verificada_em) values ($1, 'coletivo', 'São Paulo', 'LUME', 'CNPJ', now())", [P.org]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra) values ($1, 'coletivo', 'Recife', 'BRASA')", [P.org2]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($3, $2, 'dono')", [P.org, P.dona, P.org2]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.org, P.bloq]);
const NUC = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo Leste', $1) returning id", [P.org])).id;
const NUC2 = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo Recife', $1) returning id", [P.org2])).id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro'), ($1, $3, 'membro'), ($1, $4, 'membro'), ($5, $2, 'membro')", [NUC, P.t1, P.t2, P.m1, NUC2]);
const A = (n) => como(P[n]);
// Nenhuma resposta traz o id de pessoa nenhuma (só o das organizações, que são públicas), nem codinome de pessoa.
const semPessoas = (r) => { const s = JSON.stringify(r); return !Object.entries(P).filter(([k]) => k !== "org" && k !== "org2").some(([, id]) => s.includes(id)) && !/Codinome/.test(s); };

// A tesouraria nas duas organizações: t1 e t2 na Lume (com selo); t1 na Brasa (sem selo).
{
  const fim = new Date(Date.now() + 200 * 86400e3).toISOString().slice(0, 10);
  for (const [org, pessoas] of [["lume", ["t1", "t2"]], ["brasa", ["t1"]]]) {
    const f = await rpc(A("dona"), "rede_org_funcao_salvar", { p_handle: org, p: { tipo: "tesouraria", nome: "Tesouraria", permissoes: ["caixa"], vagas: 2 } });
    const TES = f.funcoes.find((x) => x.nome === "Tesouraria").id;
    for (const n of pessoas) {
      await rpc(A("dona"), "rede_org_mandato_dar", { p_handle: org, p: { funcao: TES, handle: `${n}_o13`, fim } });
      const minhas = (await rpc(A(n), "rede_org_funcoes", { p_handle: org })).minhas;
      await rpc(A(n), "rede_org_mandato_aceitar", { p_mandato: minhas.find((m) => m.pendente).mandato });
    }
  }
}

// ═══════════════════ 2. A vaquinha ═══════════════════
await zerar();
await recusa("organização SEM selo não põe Pix", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "brasa", p: { nome: "Fundo de greve", tipo: "greve", pix: "12.345.678/0001-90" } }), "so_com_selo");
await recusa("organização SEM selo não põe link de doação", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "brasa", p: { nome: "Fundo de greve", tipo: "greve", link: "https://exemplo.org/doar" } }), "so_com_selo");
const semSelo = await espera("sem selo, abre o caixa sem como apoiar (só a transparência)", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "brasa", p: { nome: "Fundo de greve", tipo: "greve", meta: "100000" } }),
  (r) => r.selo === false && r.caixas.length === 1 && r.caixas[0].pix === null && r.caixas[0].meta === 100000);
await recusa("…e nem ajustando depois põe Pix", () => rpc(A("t1"), "rede_org_vaquinha_ajustar", { p_caixa: semSelo?.caixas[0].id, p: { pix: "chave-aleatoria-1234" } }), "so_com_selo");
await recusa("Pix com CPF de pessoa", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo", tipo: "greve", pix: "CPF 123.456.789-09 Maria" } }), "dado_pessoal");
await recusa("Pix com telefone", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo", tipo: "greve", pix: "(11) 98888-7777" } }), "dado_pessoal");
await recusa("Pix com e-mail", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo", tipo: "greve", pix: "fulana@exemplo.org" } }), "dado_pessoal");
await recusa("link que não é https", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo", tipo: "greve", link: "http://exemplo.org" } }), "invalido:link");
await recusa("meta que não é número", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo", tipo: "greve", meta: "mil" } }), "invalido:meta");
await recusa("membro comum não abre vaquinha", () => rpc(A("m1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo", tipo: "greve" } }), "sem_permissao");
const cx = await espera("com selo, a tesouraria abre a vaquinha com Pix de CNPJ, link e meta", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo de greve", tipo: "greve", pix: "12.345.678/0001-90", link: "https://exemplo.org/doar", meta: "500000" } }),
  (r) => r.selo === true && r.caixas[0].pix === "12.345.678/0001-90" && r.caixas[0].link === "https://exemplo.org/doar" && r.caixas[0].meta === 500000 && r.caixas[0].arrecadado === null && semPessoas(r));
const CX = cx?.caixas[0].id;
await recusa("membro comum não informa o arrecadado", () => rpc(A("m1"), "rede_org_vaquinha_ajustar", { p_caixa: CX, p: { arrecadado: "1000" } }), "sem_permissao");
await recusa("arrecadado negativo é recusado", () => rpc(A("t1"), "rede_org_vaquinha_ajustar", { p_caixa: semSelo?.caixas[0].id, p: { arrecadado: "-5" } }), "invalido:arrecadado");
// O dia de hoje no fuso do banco (Brasília), não em UTC: entre 21h e meia-noite os dois diferem.
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
await espera("a tesouraria informa o arrecadado: fica com o dia de hoje", () => rpc(A("t2"), "rede_org_vaquinha_ajustar", { p_caixa: CX, p: { arrecadado: "123450" } }),
  (r) => r.caixas[0].arrecadado === 123450 && r.caixas[0].arrecadadoDia === hoje && semPessoas(r));
await espera("quem gerencia muda a meta (e a meta pequena demais é recusada antes)", async () => {
  await recusa("meta abaixo de R$ 1", () => rpc(A("dona"), "rede_org_vaquinha_ajustar", { p_caixa: CX, p: { meta: "50" } }), "invalido:meta");
  return rpc(A("dona"), "rede_org_vaquinha_ajustar", { p_caixa: CX, p: { meta: "800000" } });
}, (r) => r.caixas[0].meta === 800000 && r.caixas[0].arrecadado === 123450);
await espera("o ajuste fica na auditoria sem quem (só a organização e as chaves)", () => um("select quem, detalhes from interno.auditoria where acao = 'alumia_vaquinha_ajustar' order by criado_em desc limit 1"),
  (r) => r.quem === P.org && JSON.stringify(r.detalhes) === JSON.stringify({ chaves: ["meta"] }));
await recusa("prestação com CPF", () => rpc(A("t1"), "rede_org_vaquinha_conta", { p_caixa: CX, p: { dia: hoje, texto: "Repassamos à Maria, CPF 123.456.789-09." } }), "dado_pessoal");
await recusa("prestação com telefone", () => rpc(A("t1"), "rede_org_vaquinha_conta", { p_caixa: CX, p: { dia: hoje, texto: "Combinar com 98888-7777 a entrega." } }), "dado_pessoal");
await recusa("prestação curta", () => rpc(A("t1"), "rede_org_vaquinha_conta", { p_caixa: CX, p: { dia: hoje, texto: "Ok." } }), "invalido:texto");
await recusa("prestação no futuro", () => rpc(A("t1"), "rede_org_vaquinha_conta", { p_caixa: CX, p: { dia: "2999-01-01", texto: "Compramos 40 cestas básicas." } }), "invalido:dia");
await recusa("membro comum não presta contas", () => rpc(A("m1"), "rede_org_vaquinha_conta", { p_caixa: CX, p: { dia: hoje, texto: "Compramos 40 cestas básicas." } }), "sem_permissao");
const conta = await espera("a tesouraria presta contas com o dia e um link", () => rpc(A("t1"), "rede_org_vaquinha_conta", { p_caixa: CX, p: { dia: hoje, texto: "Compramos 40 cestas básicas para as famílias em greve.", link: "https://exemplo.org/notas" } }),
  (r) => r.caixas[0].contas.length === 1 && r.caixas[0].contas[0].dia === hoje && r.caixas[0].contas[0].possoRetirar === true && semPessoas(r));
await espera("a tabela das contas não guarda quem escreveu", () => dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_org_caixa_contas' order by ordinal_position"),
  (r) => r.rows.map((x) => x.column_name).join() === "id,caixa,dia,texto,link,criado_em");
const pub = await espera("visitante vê meta, arrecadado com o dia, contas e como apoiar; nunca quem", () => rpc(visitante(), "rede_org_caixa", { p_handle: "lume" }),
  (r) => r.caixas[0].meta === 800000 && r.caixas[0].arrecadado === 123450 && r.caixas[0].contas.length === 1 && r.caixas[0].contas[0].possoRetirar === false && r.caixas[0].pix && semPessoas(r));
ok("nenhum campo de doador, doadores ou contagem de pessoas na vaquinha", pub && !/doador|doadores|apoiadores|pessoas|quem/i.test(JSON.stringify(pub)));
await espera("visitante não vê a vaquinha da organização sem selo", () => rpc(visitante(), "rede_org_caixa", { p_handle: "brasa" }), (r) => r === null);
await recusa("passadas 24 h, a prestação não sai mais", async () => {
  await dono("update interno.rede_org_caixa_contas set criado_em = now() - interval '25 hours'");
  return rpc(A("t1"), "rede_org_vaquinha_conta_retirar", { p_conta: conta?.caixas[0].contas[0].id });
}, "prazo_passou");
await espera("dentro de 24 h, a tesouraria tira a prestação errada (registrado)", async () => {
  const r = await rpc(A("t2"), "rede_org_vaquinha_conta", { p_caixa: CX, p: { dia: hoje, texto: "Texto com engano, vai sair." } });
  const id = r.caixas[0].contas.find((k) => k.texto.startsWith("Texto com engano")).id;
  await recusa("membro comum não tira", () => rpc(A("m1"), "rede_org_vaquinha_conta_retirar", { p_conta: id }), "sem_permissao");
  return rpc(A("t2"), "rede_org_vaquinha_conta_retirar", { p_conta: id });
}, (r) => r.caixas[0].contas.length === 1);
await espera("o selo sai: Pix e link somem da resposta (ficam guardados, sem aparecer)", async () => {
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org]);
  const r = await rpc(A("m1"), "rede_org_caixa", { p_handle: "lume" });
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org]);
  return r;
}, (r) => r.selo === false && r.caixas[0].pix === null && r.caixas[0].link === null && r.caixas[0].meta === 800000);
await espera("tirar o Pix com selo (vazio tira)", () => rpc(A("t1"), "rede_org_vaquinha_ajustar", { p_caixa: CX, p: { pix: "" } }), (r) => r.caixas[0].pix === null && r.caixas[0].link === "https://exemplo.org/doar");

// A denúncia de vaquinha falsa.
await zerar();
await recusa("quem cuida do caixa não denuncia o próprio caixa", () => rpc(A("t1"), "rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "" }), "sem_permissao");
await recusa("quem gerencia também não", () => rpc(A("dona"), "rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "" }), "sem_permissao");
await recusa("bloqueado pela organização não acha", () => rpc(A("bloq"), "rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "" }), "nao_encontrado");
await recusa("visitante não denuncia", () => rpc(visitante(), "rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "" }), "permission denied");
const den = await espera("membro denuncia: protocolo, sem mais nada", () => rpc(A("fora"), "rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "O CNPJ não bate com o do coletivo." }),
  (r) => typeof r.protocolo === "string" && r.ja === false && Object.keys(r).sort().join() === "ja,protocolo");
await espera("de novo, o mesmo protocolo", () => rpc(A("fora"), "rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "" }), (r) => r.protocolo === den?.protocolo && r.ja === true);
await espera("a denúncia cai na fila da mediação: alvo org, golpe, com o caixa no texto", () => um("select alvo_tipo, alvo, categoria, texto, situacao from interno.rede_denuncias where protocolo = $1", [den?.protocolo]),
  (r) => r.alvo_tipo === "org" && r.alvo === P.org && r.categoria === "golpe" && r.texto.includes(CX) && r.texto.includes("Fundo de greve") && r.situacao === "aberta");
await espera("a organização não vê quem denunciou (o caixa não muda e não diz nada)", () => rpc(A("dona"), "rede_org_caixa", { p_handle: "lume" }), (r) => semPessoas(r) && !/denuncia|protocolo/i.test(JSON.stringify(r)));
await recusa("denúncia com telefone no texto", () => rpc(A("m2"), "rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "Me liga 98888-7777" }), "dado_pessoal");

// ═══════════════════ 3. A petição com meta ═══════════════════
await zerar();
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet') on conflict (slug) do update set categoria = 'disciplinas', tipo = 'aberta', publico_padrao = 'internet'");
const daqui = (horas) => new Date(Date.now() + horas * 3_600_000).toISOString();
const ato = await espera("a organização chama um ato", () => rpc(A("org"), "rede_ato_publicar", { p: {
  titulo: "Fica Esperança", inicio: daqui(72), onde: "Ocupação Esperança · na porta", cidade: "São Paulo", descricao: "Vigília na porta da ocupação.", comunidade: "matematica", publico: "internet",
} }), (a) => typeof a?.id === "string");
const ID = ato?.id;
const passarMarco = () => exec("update interno.rede_peticao_assinaturas set criado_em = criado_em - interval '20 minutes'; update interno.rede_contagem_saidas set entrou_em = entrou_em - interval '20 minutes', saiu_em = saiu_em - interval '20 minutes'");
const pet = (quem) => rpc(quem ? A(quem) : visitante(), "rede_peticao", { p_ato: ID });
const assinar = (quem, id, sim = true) => rpc(A(quem), "rede_peticao_assinar", { p_peticao: id, p_sim: sim });
const pedido = { alvo: "Prefeitura de São Paulo", texto: "Pedimos que a reintegração da ocupação Esperança seja suspensa até haver moradia digna.", prazo: daqui(24 * 30) };
await recusa("meta abaixo de 10", () => rpc(A("org"), "rede_peticao_criar", { p_ato: ID, p: { ...pedido, meta: 5 } }), "invalido:meta");
await recusa("meta que não é número", () => rpc(A("org"), "rede_peticao_criar", { p_ato: ID, p: { ...pedido, meta: "muitas" } }), "invalido:meta");
const p = await espera("quem organiza abre a petição com meta", () => rpc(A("org"), "rede_peticao_criar", { p_ato: ID, p: { ...pedido, meta: 10 } }),
  (r) => r.meta === 10 && r.total === null && r.chegou === false && r.organiza === true);
const PID = p?.id;
await recusa("abaixo de 3 assinaturas, não há documento de entrega", () => rpc(A("org"), "rede_peticao_entrega", { p_peticao: PID }), "poucas_assinaturas");
for (const n of ["m1", "m2", "m3", "m4", "t1", "t2", "fora", "dona", "org2"]) await assinar(n, PID);
await espera("antes do marco, ninguém vê o total (nem quem organiza)", () => pet("org"), (r) => r.total === null && r.chegou === false);
await passarMarco();
await espera("depois do marco: 9 de 10, ainda não chegou", () => pet(null), (r) => r.total === 9 && r.meta === 10 && r.chegou === false && r.organiza === false);
await recusa("membro não mexe na meta", () => rpc(A("m1"), "rede_peticao_meta", { p_peticao: PID, p_meta: 9 }), "so_quem_organizou");
await recusa("visitante não mexe na meta", () => rpc(visitante(), "rede_peticao_meta", { p_peticao: PID, p_meta: 9 }), "permission denied");
await recusa("meta fora do intervalo", () => rpc(A("org"), "rede_peticao_meta", { p_peticao: PID, p_meta: 20000000 }), "invalido:meta");
await espera("quem organiza também assina: a 10ª assinatura alcança a meta no marco seguinte", async () => {
  await assinar("org", PID);
  await passarMarco();
  return pet("m2");
}, (r) => r.total === 10 && r.meta === 10 && r.chegou === true);
await espera("tirar a meta (nulo)", () => rpc(A("org"), "rede_peticao_meta", { p_peticao: PID, p_meta: null }), (r) => r.meta === null && r.chegou === false);
await rpc(A("org"), "rede_peticao_meta", { p_peticao: PID, p_meta: 100 });
await recusa("membro não pega o documento de entrega", () => rpc(A("m1"), "rede_peticao_entrega", { p_peticao: PID }), "so_quem_organizou");
await recusa("visitante não pega o documento", () => rpc(visitante(), "rede_peticao_entrega", { p_peticao: PID }), "permission denied");
const doc = await espera("quem organiza pega o documento: texto, alvo, número, meta e datas; nenhum nome", () => rpc(A("org"), "rede_peticao_entrega", { p_peticao: PID }),
  (r) => r.total === 10 && r.meta === 100 && r.alvo === pedido.alvo && r.texto === pedido.texto && r.ato === "Fica Esperança" && r.abertaEm && r.geradoEm && semPessoas(r));
ok("o documento só tem as chaves combinadas (nenhuma lista)", doc && Object.keys(doc).sort().join() === "abertaEm,alvo,ato,encerrada,geradoEm,meta,prazo,texto,total" && !Object.values(doc).some(Array.isArray));
await espera("nenhuma resposta de petição traz id de pessoa nem codinome", async () => [await pet("org"), await pet("m1"), await pet(null)], semPessoas);
await espera("a assinatura sai: o total cai só no marco seguinte", async () => {
  await assinar("m1", PID, false);
  const antes = await pet("m2");
  await passarMarco();
  return [antes, await pet("m2")];
}, ([a, b]) => a.total === 10 && b.total === 9);
await espera("encerrada continua dando o documento (para entregar depois)", async () => {
  await rpc(A("org"), "rede_peticao_encerrar", { p_peticao: PID });
  return rpc(A("org"), "rede_peticao_entrega", { p_peticao: PID });
}, (r) => r.encerrada === true && r.total === 9);
await recusa("encerrada não muda a meta", () => rpc(A("org"), "rede_peticao_meta", { p_peticao: PID, p_meta: 50 }), "peticao_encerrada");
await espera("com 2 assinaturas, o total some e o documento é recusado", async () => {
  await dono("delete from interno.rede_peticao_assinaturas where peticao = $1 and usuario <> all ($2)", [PID, [P.m2, P.m3]]);
  await passarMarco();
  await dono("delete from interno.rede_contagem_saidas");
  const r = await pet("org");
  let e = "";
  try { await rpc(A("org"), "rede_peticao_entrega", { p_peticao: PID }); } catch (x) { e = String(x.message); }
  return [r, e];
}, ([r, e]) => r.total === null && e.includes("poucas_assinaturas"));
await espera("a petição antiga (sem meta) continua igual: meta nula, chegou falso", async () => {
  const ato2 = await rpc(A("org"), "rede_ato_publicar", { p: { titulo: "Outro ato", inicio: daqui(80), onde: "Praça", cidade: "São Paulo", descricao: "Ato na praça.", comunidade: "matematica", publico: "internet" } });
  return rpc(A("org"), "rede_peticao_criar", { p_ato: ato2.id, p: pedido });
}, (r) => r.meta === null && r.chegou === false && r.aberta === true);

// ═══════════════════ 4. A porta com a trava ligada ═══════════════════
await espera("com a trava ligada, conta não aprovada não usa nada daqui", async () => {
  await dono("select interno.alumia_entrada_ligar(true)");
  const n = await criarUsuario("novata@o13.local", "novata");
  const erros = [];
  for (const [f, a] of [["rede_org_vaquinha_denunciar", { p_caixa: CX, p_texto: "" }], ["rede_peticao_meta", { p_peticao: PID, p_meta: 10 }], ["rede_peticao_entrega", { p_peticao: PID }]]) {
    erros.push(await rpc(como(n), f, a).then(() => "passou", (e) => e.message));
  }
  await dono("select interno.alumia_entrada_ligar(false)");
  return erros;
}, (es) => es.every((e) => e.includes("alumia_entrada")));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
