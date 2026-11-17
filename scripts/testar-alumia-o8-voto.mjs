// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a migração 20261114-alumia-o8-voto.sql (voto secreto de verdade no banco) num Postgres de verdade (scripts/banco-local.mjs),
// rodada DUAS vezes sobre o install.sql. O teste faz o papel de quem tem acesso total ao banco e TENTA casar quem votou com o que
// votou, pelos caminhos que um `select` dá: o xmin (a transação que gravou a linha), o cmin, o ctid (a posição no disco), a ordem
// de leitura, uma sequência ou uma hora. Primeiro, com o código antigo, mostra que o ataque funcionava (para provar que o teste
// enxerga o problema); depois da migração, mostra que não funciona mais, nem com os votos que já existiam nem com os novos.
// Também: os votos dados antes da migração ficam; a marca da presença da equipe sai; o resultado só sai fechado, com quórum e
// com 3 votos ou mais.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/testar-alumia-o8-voto.mjs
import fs from "node:fs";
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
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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

// ═══════════════════ 0. O arquivo ═══════════════════
const migracao = ler("supabase/migracoes/20261114-alumia-o8-voto.sql");
ok("toda função da migração é security definer com search_path fixo", (() => {
  const funcoes = migracao.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length === 6 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", migracao.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a urna sorteia com gen_random_uuid (aleatório forte), não com random()", !/\brandom\(\)/.test(migracao) && (migracao.match(/order by gen_random_uuid\(\)/g) ?? []).length >= 6);

// ═══════════════════ 1. Banco e pessoas ═══════════════════
// Com a migração já colada no install.sql (depois da junção), o banco é montado como estava ANTES dela, para o ataque ao código
// antigo continuar provando alguma coisa.
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
const colada = normal(ler("supabase/install.sql")).includes(normal(migracao));
const banco = await criarBanco(colada ? { antesDe: migracao } : {});
const { dono: sql, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await sql(t, v)).rows[0];
const linhas = async (t, v = []) => (await sql(t, v)).rows;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const nomes = ["org", ...Array.from({ length: 10 }, (_, i) => `v${i + 1}`), "e1", "e2", "e3", "e4", "e5", "fora"];
const P = {};
for (const nome of nomes) {
  P[nome] = await criarUsuario(`${nome}@o8.local`, nome);
  await rpc(como(P[nome]), "eu");
  await sql("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${nome}`, `${nome}_o8`]);
}
await sql("delete from interno.papeis");
for (const e of ["e1", "e2", "e3", "e4", "e5"]) await sql("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P[e]]);
await sql("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await sql("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await sql("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await sql("update auth.users set created_at = now() - interval '30 days'");
const A = (nome) => como(P[nome]);
const VOTANTES = Array.from({ length: 10 }, (_, i) => `v${i + 1}`);

// A organização e um núcleo com os dez votantes (direto, como o dono do banco: o caminho do selo é da F4).
await sql("insert into interno.rede_orgs (perfil, tipo) values ($1, 'coletivo')", [P.org]);
const NUCLEO = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo do teste', $1) returning id", [P.org])).id;
for (const n of VOTANTES) await sql("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [NUCLEO, P[n]]);

const OPCOES = ["Tarifa zero", "Moradia", "Creche", "Saúde"];
async function novaConsulta({ metodo = "ranqueada", quorum = null } = {}) {
  const id = (await um("insert into interno.rede_consultas (org, pergunta, metodo, quorum, prazo, compromisso) values ($1, 'Qual pauta levamos?', $2, $3, now() + interval '2 days', 'A vencedora abre a próxima plenária.') returning id", [P.org, metodo, quorum])).id;
  const ops = [];
  for (let i = 0; i < OPCOES.length; i++) ops.push((await um("insert into interno.rede_consulta_opcoes (consulta, ordem, texto) values ($1, $2, $3) returning id", [id, i + 1, OPCOES[i]])).id);
  return { id, ops };
}
const fechar = (id) => sql("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [id]);
const verConsulta = async (quem, id) => (await rpc(quem, "rede_org_perfil", { p_handle: "org_o8" })).consultas.find((c) => c.id === id);
// Cada votante com uma cédula diferente (permutações das 4 opções), para o casamento ser conferível.
const permutacoes = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutacoes([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
const chave = (ranking) => (Array.isArray(ranking) ? ranking : String(ranking).replace(/[{}]/g, "").split(",")).join(",");

/**
 * O ataque: casar cédula e votante pelo mesmo xmin, um para um (um votante só com aquele xmin, e uma cédula só com ele). Devolve
 * quantas cédulas foram casadas assim com a pessoa CERTA. Se várias cédulas dividem o xmin de um votante, não há casamento: quem
 * olha só sabe que uma delas pode ser dele, como qualquer outra.
 */
async function casarPorXmin(consulta, certo) {
  const ced = await linhas("select xmin::text x, ranking::text r from interno.rede_consulta_cedulas where consulta = $1", [consulta]);
  const vot = await linhas("select xmin::text x, usuario from interno.rede_consulta_votantes where consulta = $1", [consulta]);
  let acertos = 0;
  for (const c of ced) {
    const mesmos = vot.filter((v) => v.x === c.x);
    const irmas = ced.filter((d) => d.x === c.x);
    if (mesmos.length === 1 && irmas.length === 1 && certo[mesmos[0].usuario] === chave(c.r)) acertos++;
  }
  return acertos;
}
/** O ataque pela ordem: a k-ésima cédula no disco (ctid) é do k-ésimo votante (ordem de chegada pelo xmin). */
async function casarPorOrdem(consulta, certo, desc = false) {
  const ced = await linhas(`select ranking::text r from interno.rede_consulta_cedulas where consulta = $1 order by ctid ${desc ? "desc" : ""}`, [consulta]);
  const vot = await linhas("select usuario from interno.rede_consulta_votantes where consulta = $1 order by xmin::text::bigint", [consulta]);
  return ced.reduce((n, c, i) => n + (vot[i] && certo[vot[i].usuario] === chave(c.r) ? 1 : 0), 0);
}
/** O ataque pela leitura sem ordem (a ordem em que o banco devolve). */
async function casarPorLeitura(consulta, certo) {
  const ced = await linhas("select ranking::text r from interno.rede_consulta_cedulas where consulta = $1", [consulta]);
  const vot = await linhas("select usuario from interno.rede_consulta_votantes where consulta = $1 order by xmin::text::bigint", [consulta]);
  return ced.reduce((n, c, i) => n + (vot[i] && certo[vot[i].usuario] === chave(c.r) ? 1 : 0), 0);
}

// ═══════════════════ 2. ANTES: com o código antigo, o ataque funciona ═══════════════════
const antiga = await novaConsulta();
const certoAntes = {};
const PERM = permutacoes([0, 1, 2, 3]);
for (let i = 0; i < 6; i++) {
  const ranking = PERM[i * 3].map((k) => antiga.ops[k]);
  certoAntes[P[VOTANTES[i]]] = ranking.join(",");
  await rpc(A(VOTANTES[i]), "rede_org_consulta_votar", { p_consulta: antiga.id, p_ranking: ranking });
}
await espera("ANTES (código antigo): o xmin casa cada cédula com quem votou — o defeito existia", () => casarPorXmin(antiga.id, certoAntes), (n) => n === 6);
await espera("ANTES: a posição no disco (ctid) também casava, na ordem de chegada", () => casarPorOrdem(antiga.id, certoAntes), (n) => n === 6);
await espera("ANTES: e a ordem em que o banco devolve", () => casarPorLeitura(antiga.id, certoAntes), (n) => n === 6);
const cedulasAntes = (await linhas("select ranking::text r from interno.rede_consulta_cedulas where consulta = $1", [antiga.id])).map((r) => chave(r.r)).sort();

// A votação secreta da equipe, com o código antigo.
const VOT_ANTIGA = (await um("insert into interno.votacoes (titulo, opcoes, secreta, encerra_em) values ('Reunião no sábado?', '{Sim,Não,Tanto faz}', true, now() + interval '1 day') returning id")).id;
const escolhaAntes = { e1: 0, e2: 1, e3: 1, e4: 2 };
for (const [e, o] of Object.entries(escolhaAntes)) await rpc(A(e), "votar", { p_id: VOT_ANTIGA, p_opcao: o });
await espera("ANTES: na equipe, presença e voto tinham o mesmo xmin", async () => {
  const pres = await linhas("select xmin::text x from interno.votacao_presencas where votacao = $1", [VOT_ANTIGA]);
  const votos = await linhas("select xmin::text x from interno.votacao_votos where votacao = $1", [VOT_ANTIGA]);
  return pres.filter((p) => votos.some((v) => v.x === p.x)).length;
}, (n) => n === 4);
await espera("ANTES: e a marca se desfazia com o sal guardado no próprio banco", async () =>
  (await um(`select count(*)::int n from interno.votacao_presencas p join interno.perfis f
             on p.marca = md5(coalesce((select valor #>> '{}' from interno.configuracoes where chave = 'cuidado_sal'), '') || ':voto:' || p.votacao::text || ':' || f.id::text)
             where p.votacao = $1`, [VOT_ANTIGA])).n, (n) => n === 4);
const votosAntes = (await linhas("select opcao from interno.votacao_votos where votacao = $1 order by opcao", [VOT_ANTIGA])).map((r) => r.opcao).join();

// ═══════════════════ 3. A migração, duas vezes ═══════════════════
await espera("a migração instala sobre o install.sql", () => exec(migracao));
await espera("e de novo, sem estrago (idempotente)", () => exec(migracao));
await espera("as portas: nenhuma função public.rede_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("o voto da consulta passa pela porta", async () => (await um("select pg_get_functiondef('public.rede_org_consulta_votar(uuid,uuid[])'::regprocedure) as d")).d, (d) => d.includes("alumia_porta") && d.includes("alumia_urna"));

// ═══════════════════ 4. A conversão: nenhum voto perdido, ligação antiga desfeita ═══════════════════
await espera("os votos já dados na consulta ficaram (as mesmas 6 cédulas e os mesmos 6 votantes)", async () => [
  (await linhas("select ranking::text r from interno.rede_consulta_cedulas where consulta = $1", [antiga.id])).map((r) => chave(r.r)).sort(),
  (await um("select count(*)::int n from interno.rede_consulta_votantes where consulta = $1", [antiga.id])).n,
], ([c, n]) => JSON.stringify(c) === JSON.stringify(cedulasAntes) && n === 6);
await espera("DEPOIS da conversão: o xmin não casa mais nenhuma cédula antiga", () => casarPorXmin(antiga.id, certoAntes), (n) => n === 0);
await espera("as cédulas antigas foram regravadas juntas (um xmin só, nenhum igual ao de quem votou)", async () => {
  const c = await linhas("select distinct xmin::text x from interno.rede_consulta_cedulas where consulta = $1", [antiga.id]);
  const v = await linhas("select xmin::text x from interno.rede_consulta_votantes where consulta = $1", [antiga.id]);
  return c.length === 1 && !v.some((x) => x.x === c[0].x);
});
await espera("na equipe: os votos ficaram, e a presença virou a pessoa (a marca saiu)", async () => [
  (await linhas("select opcao from interno.votacao_votos where votacao = $1 order by opcao", [VOT_ANTIGA])).map((r) => r.opcao).join(),
  (await linhas("select usuario from interno.votacao_votantes where votacao = $1", [VOT_ANTIGA])).map((r) => r.usuario).sort().join(),
], ([v, p]) => v === votosAntes && p === ["e1", "e2", "e3", "e4"].map((e) => P[e]).sort().join());
await espera("na equipe: presença e voto não têm mais o mesmo xmin", async () => {
  const pres = await linhas("select xmin::text x from interno.votacao_votantes where votacao = $1", [VOT_ANTIGA]);
  const votos = await linhas("select xmin::text x from interno.votacao_votos where votacao = $1", [VOT_ANTIGA]);
  return pres.filter((p) => votos.some((v) => v.x === p.x)).length;
}, (n) => n === 0);
await espera("quem já votou na equipe continua 'votei' e não vota de novo", async () => (await rpc(A("e1"), "votacoes_listar")).find((v) => v.id === VOT_ANTIGA), (v) => v.votei === true && v.votantes === 4);
await recusa("e1 não vota duas vezes (presença convertida)", () => rpc(A("e1"), "votar", { p_id: VOT_ANTIGA, p_opcao: 0 }), "ja_votou");

// ═══════════════════ 5. O formato: nada que dê ordem, hora ou ligação ═══════════════════
const colunas = async (t) => (await linhas("select column_name from information_schema.columns where table_schema = 'interno' and table_name = $1 order by 1", [t])).map((r) => r.column_name).join();
await espera("a cédula da consulta só tem a consulta e o voto (sem id, sem hora, sem pessoa)", () => colunas("rede_consulta_cedulas"), (c) => c === "consulta,ranking");
await espera("a cédula da equipe: votação, opção e (só no voto aberto) a pessoa", () => colunas("votacao_votos"), (c) => c === "opcao,usuario,votacao");
await espera("quem votou na equipe: votação e pessoa (sem marca); a tabela das marcas não existe mais", async () => [await colunas("votacao_votantes"), (await um("select to_regclass('interno.votacao_presencas') is null as sem")).sem], ([c, sem]) => c === "usuario,votacao" && sem === true);
await espera("nenhuma coluna das cédulas tem valor padrão (nada de sequência, relógio ou id gerado)", async () =>
  (await um(`select count(*)::int n from pg_attrdef d join pg_class c on c.oid = d.adrelid join pg_namespace s on s.oid = c.relnamespace
             where s.nspname = 'interno' and c.relname in ('rede_consulta_cedulas', 'votacao_votos')`)).n, (n) => n === 0);
await espera("nenhuma sequência pendurada nas cédulas", async () =>
  (await um(`select count(*)::int n from pg_depend d join pg_class s on s.oid = d.objid and s.relkind = 'S'
             where d.refobjid in ('interno.rede_consulta_cedulas'::regclass, 'interno.votacao_votos'::regclass)`)).n, (n) => n === 0);
await espera("a marca da equipe não existe mais (nem a função)", async () => (await um("select to_regprocedure('interno.votacao_marca(uuid,uuid)') is null as sem")).sem, (s) => s === true);

// ═══════════════════ 6. DEPOIS: votos novos, e o ataque por todos os caminhos ═══════════════════
let xminsUnicos = true;
let acertosXmin = 0;
let acertosCtid = 0;
let acertosCtidDesc = 0;
let acertosLeitura = 0;
let cminsUnicos = true;
const RODADAS = 6;
const POR_RODADA = 8;
const consultasNovas = [];
for (let k = 0; k < RODADAS; k++) {
  const c = await novaConsulta();
  consultasNovas.push(c);
  const certo = {};
  for (let i = 0; i < POR_RODADA; i++) {
    const ranking = PERM[(i * 3 + k) % PERM.length].map((j) => c.ops[j]);
    certo[P[VOTANTES[i]]] = ranking.join(",");
    const r = await rpc(A(VOTANTES[i]), "rede_org_consulta_votar", { p_consulta: c.id, p_ranking: ranking });
    if (JSON.stringify(r) !== '{"votei":true}') falhas.push(`o voto devolveu mais que "votei": ${JSON.stringify(r)}`);
    // Depois de CADA voto, quem olha o banco vê todas as cédulas com o mesmo xmin e o mesmo cmin.
    const x = await um("select count(distinct xmin::text)::int x, count(distinct cmin::text)::int m, count(*)::int n from interno.rede_consulta_cedulas where consulta = $1", [c.id]);
    if (x.x !== 1 || x.n !== i + 1) xminsUnicos = false;
    if (x.m !== 1) cminsUnicos = false;
  }
  acertosXmin += await casarPorXmin(c.id, certo);
  acertosCtid += await casarPorOrdem(c.id, certo);
  acertosCtidDesc += await casarPorOrdem(c.id, certo, true);
  acertosLeitura += await casarPorLeitura(c.id, certo);
}
const TOTAL = RODADAS * POR_RODADA;
ok("depois de cada voto, todas as cédulas da consulta têm um xmin só", xminsUnicos);
ok("e um cmin só (entraram num comando só)", cminsUnicos);
ok(`pelo xmin: nenhuma das ${TOTAL} cédulas casa com uma pessoa só (acertos: ${acertosXmin})`, acertosXmin === 0);
// Ao acaso, acerta-se 1 em 8 (6 de 48, em média). 20 ou mais seria ordem vazando (a chance disso por sorte é desprezível).
ok(`pela posição no disco (ctid): acertos no nível do acaso (${acertosCtid} de ${TOTAL})`, acertosCtid < 20);
ok(`pela posição no disco, de trás para a frente: no nível do acaso (${acertosCtidDesc} de ${TOTAL})`, acertosCtidDesc < 20);
ok(`pela ordem em que o banco devolve: no nível do acaso (${acertosLeitura} de ${TOTAL})`, acertosLeitura < 20);
await espera("o xmin das cédulas é o do último voto, que não diz qual cédula é de quem (são todas)", async () => {
  const c = consultasNovas[0].id;
  const x = await um("select min(xmin::text) x, count(*)::int n from interno.rede_consulta_cedulas where consulta = $1", [c]);
  const v = await linhas("select usuario from interno.rede_consulta_votantes where consulta = $1 and xmin::text = $2", [c, x.x]);
  return [x.n, v.length];
}, ([n, v]) => n === POR_RODADA && v === 1);

// Acima de 2000 cédulas: a nova entra misturada a 2000 sorteadas.
{
  const grande = await novaConsulta({ metodo: "simples" });
  await sql("insert into interno.rede_consulta_cedulas (consulta, ranking) select $1, array[$2::uuid] from generate_series(1, 2100)", [grande.id, grande.ops[0]]);
  await rpc(A("v10"), "rede_org_consulta_votar", { p_consulta: grande.id, p_ranking: [grande.ops[1]] });
  await espera("com mais de 2000 cédulas, a nova entra junto com 2000 sorteadas (mesmo xmin), sem perder nenhuma", async () =>
    um(`select count(*)::int n, (select count(*)::int from interno.rede_consulta_cedulas c2 where c2.consulta = $1 and c2.xmin::text = (select xmin::text from interno.rede_consulta_votantes where consulta = $1)) as juntas,
        count(*) filter (where ranking[1] = $2::uuid)::int nova from interno.rede_consulta_cedulas where consulta = $1`, [grande.id, grande.ops[1]]),
  (r) => r.n === 2101 && r.juntas === 2001 && r.nova === 1);
}

// ═══════════════════ 7. Resultado: só fechado, com quórum e com 3 votos ou mais ═══════════════════
{
  const c = consultasNovas[1];
  await espera("aberta: nem resultado, nem número de quem votou", () => verConsulta(A("v1"), c.id), (x) => x.situacao === "aberta" && x.votantes === null && x.opcoes.every((o) => o.proporcao === null) && x.votei === true);
  await fechar(c.id);
  await espera("fechada com 8 votos e sem quórum pedido: sai o resultado (somando 1)", () => verConsulta(A("fora"), c.id), (x) =>
    x.situacao === "fechada" && x.votantes === 8 && x.quorumAtingido === true && Math.abs(x.opcoes.reduce((s, o) => s + o.proporcao, 0) - 1) < 1e-3);
  await recusa("fechada não recebe voto", () => rpc(A("v9"), "rede_org_consulta_votar", { p_consulta: c.id, p_ranking: c.ops }), "consulta_fechada");
}
{
  const c = await novaConsulta({ metodo: "simples", quorum: 5 });
  for (const n of ["v1", "v2", "v3", "v4"]) await rpc(A(n), "rede_org_consulta_votar", { p_consulta: c.id, p_ranking: [c.ops[0]] });
  await fechar(c.id);
  await espera("fechada sem quórum (4 de 5): o resultado não aparece", () => verConsulta(A("v1"), c.id), (x) => x.votantes === 4 && x.quorumAtingido === false && x.opcoes.every((o) => o.proporcao === null));
}
{
  const c = await novaConsulta({ metodo: "simples" });
  for (const n of ["v1", "v2"]) await rpc(A(n), "rede_org_consulta_votar", { p_consulta: c.id, p_ranking: [c.ops[1]] });
  await recusa("ninguém vota duas vezes", () => rpc(A("v1"), "rede_org_consulta_votar", { p_consulta: c.id, p_ranking: [c.ops[0]] }), "ja_votou");
  await fechar(c.id);
  await espera("fechada com 2 votos: nem o número nem o resultado", () => verConsulta(A("v3"), c.id), (x) => x.votantes === null && x.opcoes.every((o) => o.proporcao === null));
}
{
  const c = await novaConsulta({ metodo: "simples", quorum: 3 });
  for (const [n, o] of [["v1", 0], ["v2", 0], ["v3", 2]]) await rpc(A(n), "rede_org_consulta_votar", { p_consulta: c.id, p_ranking: [c.ops[o]] });
  await fechar(c.id);
  await espera("fechada com 3 votos e quórum de 3: o resultado aparece", () => verConsulta(A("v9"), c.id), (x) =>
    x.votantes === 3 && x.quorumAtingido === true && Math.abs(x.opcoes[0].proporcao - 2 / 3) < 1e-3 && Math.abs(x.opcoes[2].proporcao - 1 / 3) < 1e-3);
}

// ═══════════════════ 8. Votação da equipe depois da migração ═══════════════════
{
  const vid = (await um("insert into interno.votacoes (titulo, opcoes, secreta, encerra_em) values ('Mudar o horário?', '{Sim,Não}', true, now() + interval '1 day') returning id")).id;
  await rpc(A("e1"), "votar", { p_id: vid, p_opcao: 0 });
  await rpc(A("e2"), "votar", { p_id: vid, p_opcao: 1 });
  await espera("equipe: votei para quem votou, não para quem não votou", async () => [
    (await rpc(A("e1"), "votacoes_listar")).find((v) => v.id === vid), (await rpc(A("e3"), "votacoes_listar")).find((v) => v.id === vid),
  ], ([a, b]) => a.votei === true && b.votei === false && a.resultado === null);
  await espera("equipe: todas as cédulas secretas com um xmin só, diferente do de cada presença menos a última", async () => {
    const c = await linhas("select distinct xmin::text x from interno.votacao_votos where votacao = $1", [vid]);
    const p = await linhas("select xmin::text x from interno.votacao_votantes where votacao = $1", [vid]);
    return [c.length, p.filter((x) => x.x === c[0]?.x).length];
  }, ([c, p]) => c === 1 && p === 1);
  await sql("update interno.votacoes set encerrada_em = now() where id = $1", [vid]);
  await espera("equipe, voto secreto encerrado com 2 votos: o resultado não aparece", async () => (await rpc(A("e3"), "votacoes_listar")).find((v) => v.id === vid), (v) => v.encerrada && v.resultado === null);
  await sql("update interno.votacoes set encerrada_em = null where id = $1", [vid]);
  await rpc(A("e3"), "votar", { p_id: vid, p_opcao: 1 });
  await sql("update interno.votacoes set encerrada_em = now() where id = $1", [vid]);
  await espera("com 3 votos, encerrada: o resultado aparece, sem nomes", async () => (await rpc(A("e4"), "votacoes_listar")).find((v) => v.id === vid), (v) =>
    v.resultado?.[0].votos === 1 && v.resultado?.[1].votos === 2 && v.resultado.every((r) => r.quem === null));
  await espera("no voto secreto, nenhuma cédula guarda a pessoa", async () => (await um("select count(*)::int n from interno.votacao_votos where votacao = $1 and usuario is not null", [vid])).n, (n) => n === 0);
}
{
  const vid = (await um("insert into interno.votacoes (titulo, opcoes, secreta, encerra_em) values ('Voto aberto?', '{Sim,Não}', false, now() + interval '1 day') returning id")).id;
  await rpc(A("e1"), "votar", { p_id: vid, p_opcao: 0 });
  await rpc(A("e2"), "votar", { p_id: vid, p_opcao: 1 });
  await sql("update interno.votacoes set encerrada_em = now() where id = $1", [vid]);
  await espera("voto aberto continua mostrando quem votou em quê (é a regra dele)", async () => (await rpc(A("e3"), "votacoes_listar")).find((v) => v.id === vid), (v) =>
    v.resultado?.[0].quem?.length === 1 && v.resultado?.[1].quem?.length === 1);
}
await recusa("quem não é da equipe não vota", async () => {
  const vid = (await um("insert into interno.votacoes (titulo, opcoes, secreta, encerra_em) values ('Fora vota?', '{Sim,Não}', true, now() + interval '1 day') returning id")).id;
  return rpc(A("fora"), "votar", { p_id: vid, p_opcao: 0 });
}, "sem_permissao");

// ═══════════════════ 9. Permissões ═══════════════════
await espera("ninguém logado lê as cédulas nem chama a urna (nem a votacao_json, que confia na linha recebida) direto", async () => {
  const r = await um(`select has_table_privilege('authenticated', 'interno.rede_consulta_cedulas', 'select') a,
                             has_table_privilege('anon', 'interno.votacao_votos', 'select') b,
                             has_table_privilege('authenticated', 'interno.votacao_votantes', 'select') c,
                             has_function_privilege('authenticated', 'interno.alumia_urna(uuid,uuid[])', 'execute') d,
                             has_function_privilege('authenticated', 'interno.votacao_urna(uuid,smallint)', 'execute') e,
                             has_function_privilege('anon', 'interno.votacao_json(interno.votacoes)', 'execute') f,
                             has_function_privilege('authenticated', 'interno.votacao_json(interno.votacoes)', 'execute') g`);
  return Object.values(r);
}, (v) => v.every((x) => x === false));
await espera("RLS continua ligada nas tabelas do voto", async () =>
  (await linhas(`select c.relrowsecurity r from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'interno' and c.relname in ('rede_consulta_cedulas', 'rede_consulta_votantes')`)).map((x) => x.r), (r) => r.length === 2 && r.every(Boolean));

console.log(`\n${certos} conferências certas, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
