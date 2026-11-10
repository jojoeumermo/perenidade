// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o Farol do ato e a Corrente de solidariedade (Onda A, área atos; supabase/migracoes/20261110-alumia-atos.sql) num Postgres
// de verdade (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql. Matriz: visitante, membro que
// confirmou, membro que não confirmou, as duas pessoas da coordenação (gestores de uma organização com selo) e organização sem selo.
// Regras: o farol só muda com DUAS pessoas diferentes; quem não confirmou não vê o farol; o aviso não diz o estado; nenhuma
// resposta traz id de pessoa; a corrente só a partir de 3 e em passos de 10 %; fecha na meta; 2 por semana; erros com código.
// Uso: npm run testar:alumia-atos-banco
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proporcaoDoMosaico } from "../lib/rede/mosaico.ts";
import { elosDaCorrente } from "../lib/rede/atos/corrente.ts";
import { criarClienteDosAtos } from "../lib/rede/cliente-atos.ts";
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

const sql = ler("supabase/migracoes/20261110-alumia-atos.sql");
ok("a migração está colada no FIM do install.sql", ler("supabase/install.sql").trimEnd().endsWith(sql.trimEnd()));
ok("toda função nova é security definer (ou imutável) com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 9 && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f) && (/security definer/.test(f) || /immutable/.test(f)));
})());
ok("nenhuma permissão direta nas tabelas para anon/authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala de novo sobre o install.sql (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));

// ── pessoas ──
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const P = {};
const nomes = ["org", "g1", "g2", "m1", "m2", "m3", "m4", "m5", "fora", "semselo", "bloqueado"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@atos.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_handle = 'movimento_zl' where id = $1", [P.org]);
await dono("update interno.perfis set rede_handle = 'coletivo_sem_selo' where id = $1", [P.semselo]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, verificada_em) values ($1, 'movimento', 'São Paulo', now()), ($2, 'coletivo', 'São Paulo', null) on conflict (perfil) do nothing", [P.org, P.semselo]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($1, $3, 'gestor'), ($4, $5, 'dono') on conflict do nothing", [P.org, P.g1, P.g2, P.semselo, P.m5]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.org, P.bloqueado]);

const daqui = (dias, hora = 18) => {
  const d = new Date(Date.now() + dias * 86_400_000);
  d.setUTCHours(hora, 0, 0, 0);
  return d.toISOString();
};
const ato = await espera("a organização chama um ato", () => rpc(como(P.org), "rede_ato_publicar", { p: {
  titulo: "Fica Esperança", inicio: daqui(3), onde: "Ocupação Esperança · na porta", cidade: "São Paulo", descricao: "Vigília na porta da ocupação.",
} }), (a) => a.situacao === "confirmado");
const ID = ato?.id;
for (const m of ["m1", "m2", "m3"]) await rpc(como(P[m]), "rede_ato_vou", { p_id: ID, p_sim: true }).catch((e) => falhas.push(`vou ${m}: ${e.message}`));

// ═══════════════════ 1. Farol do ato ═══════════════════
const farol = (quem) => rpc(quem ? como(P[quem]) : visitante(), "rede_ato_farol", { p_id: ID });
const pedir = (quem, estado, texto = "") => rpc(como(P[quem]), "rede_ato_farol_pedir", { p_id: ID, p_estado: estado, p_texto: texto });
const avisosDoFarol = async () => Object.fromEntries((await dono("select para, count(*)::int as n from interno.avisos where tipo = 'chamado' and post = $1 and texto like '%farol%' group by para", [ID])).rows.map((r) => [r.para, r.n]));

await espera("visitante não vê o farol", () => farol(null), (r) => r === null);
await espera("quem não confirmou não vê o farol", () => farol("m4"), (r) => r === null);
await espera("quem confirmou vê o farol tranquilo, sem poder mudar", () => farol("m1"), (r) => r.estado === "tranquilo" && r.coordena === false && r.pendente === null);
await espera("gestor vê o farol e pode mudar", () => farol("g1"), (r) => r.coordena === true);
await recusa("quem confirmou não muda o farol", () => pedir("m1", "dispersar"), "so_coordenacao");
await recusa("bloqueado nem acha o ato", () => pedir("bloqueado", "dispersar"), "nao_encontrado");
await recusa("visitante não pede", () => rpc(visitante(), "rede_ato_farol_pedir", { p_id: ID, p_estado: "dispersar" }), "permission denied");
await recusa("estado inventado", () => pedir("g1", "fogo"), "invalido:estado");
await recusa("ponto 2 sem texto", () => pedir("g1", "ponto2", " "), "invalido:texto");
await recusa("ponto 2 com telefone é dado pessoal", () => pedir("g1", "ponto2", "liga (11) 98888-7777"), "dado_pessoal");
await espera("g1 pede DISPERSAR: fica pendente, o farol não muda", () => pedir("g1", "dispersar"), (r) => r.estado === "tranquilo" && r.pendente?.estado === "dispersar" && r.pendente.meu === true);
await espera("a mesma pessoa pedir de novo não confirma", () => pedir("g1", "dispersar"), (r) => r.estado === "tranquilo" && r.pendente?.meu === true);
await espera("quem confirmou ainda vê tranquilo e nada do pedido", () => farol("m1"), (r) => r.estado === "tranquilo" && r.pendente === null);
await espera("g2 recebe o aviso para confirmar, sem nome de quem pediu", async () => (await dono("select texto from interno.avisos where para = $1 and texto like '%farol%'", [P.g2])).rows.map((r) => r.texto), (t) => t.length >= 1 && t.every((x) => !/Pessoa|g1/.test(x)));
await espera("g2 vê o pedido de outra pessoa", () => farol("g2"), (r) => r.pendente?.estado === "dispersar" && r.pendente.meu === false);
await espera("g2 pede outro estado: troca o pedido (não confirma)", () => pedir("g2", "atencao"), (r) => r.estado === "tranquilo" && r.pendente?.estado === "atencao" && r.pendente.meu === true);
await espera("g1 confirma ATENÇÃO: o farol muda", () => pedir("g1", "atencao"), (r) => r.estado === "atencao" && r.pendente === null && typeof r.mudado_em === "string");
await espera("quem confirmou vê ATENÇÃO", () => farol("m2"), (r) => r.estado === "atencao");
await espera("o aviso vai só a quem confirmou, sem o estado no texto", async () => [await avisosDoFarol(), (await dono("select distinct texto from interno.avisos where post = $1 and texto like '%farol%'", [ID])).rows.map((r) => r.texto)], ([m, t]) =>
  m[P.m1] === 1 && m[P.m2] === 1 && m[P.m3] === 1 && !m[P.m4] && !m[P.g1] && t.every((x) => !/aten|dispers|ponto/i.test(x)));
await espera("a mudança vai ao registro", () => um("select count(*)::int as n from interno.auditoria where acao = 'alumia_ato_farol' and alvo = $1", [ID]), (r) => r.n === 1);
await espera("ponto 2 com o novo ponto (duas pessoas)", async () => { await pedir("g2", "ponto2", "Praça Silva Teles"); return pedir("g1", "ponto2", "Praça Silva Teles"); }, (r) => r.estado === "ponto2" && r.texto === "Praça Silva Teles");
await espera("texto diferente não confirma", async () => { await pedir("g2", "ponto2", "Praça A"); return pedir("g1", "ponto2", "Praça B"); }, (r) => r.estado === "ponto2" && r.texto === "Praça Silva Teles" && r.pendente?.texto === "Praça B");
await espera("pedido vencido (15 min) não confirma", async () => {
  await pedir("g2", "dispersar");
  await dono("update interno.rede_ato_farol_pedidos set pedido_em = now() - interval '16 minutes' where post = $1", [ID]);
  return pedir("g1", "dispersar");
}, (r) => r.estado === "ponto2" && r.pendente?.meu === true);
await espera("nenhuma resposta do farol traz id de pessoa", async () => JSON.stringify([await farol("g1"), await farol("g2"), await farol("m1")]), (s) => ![P.g1, P.g2, P.org, P.m1].some((id) => s.includes(id)));
await recusa("ninguém de fora lê os pedidos do farol", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role authenticated");
  try {
    return await banco.pg.query("select * from interno.rede_ato_farol_pedidos");
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");
await rpc(como(P.org), "rede_ato_mudar", { p_id: ID, p_situacao: "cancelado", p_motivo: "" }).catch((e) => falhas.push(`cancelar: ${e.message}`));
await recusa("ato cancelado não muda de farol", () => pedir("g1", "tranquilo"), "ato_cancelado");

// ═══════════════════ 2. Corrente de solidariedade ═══════════════════
const abrir = (quem, p) => rpc(como(P[quem]), "rede_corrente_abrir", { p });
const corrente = (extra = {}) => ({ org: P.org, texto: "Precisamos de 6 pessoas às 5h na ocupação Esperança", cidade: "São Paulo", meta: 6, quando: daqui(1, 8), ...extra });
const vou = (quem, id, sim = true) => rpc(como(P[quem]), "rede_corrente_vou", { p_id: id, p_sim: sim });
const lista = (quem, cidade = "sao paulo") => rpc(quem ? como(P[quem]) : visitante(), "rede_correntes", { p_cidade: cidade });

await espera("g1 pode abrir corrente pela organização com selo (e só por ela)", () => rpc(como(P.g1), "rede_corrente_posso"), (r) => r.length === 1 && r[0].id === P.org && r[0].handle === "movimento_zl");
await espera("m5 gerencia uma organização sem selo: não pode", () => rpc(como(P.m5), "rede_corrente_posso"), (r) => r.length === 0);
await recusa("membro comum não abre corrente", () => abrir("m1", corrente()), "so_org_verificada");
await recusa("organização sem selo não abre corrente", () => abrir("m5", corrente({ org: P.semselo })), "so_org_verificada");
await recusa("visitante não abre corrente", () => rpc(visitante(), "rede_corrente_abrir", { p: corrente() }), "permission denied");
await recusa("texto curto", () => abrir("g1", corrente({ texto: "vem" })), "invalido:texto");
await recusa("meta abaixo de 3", () => abrir("g1", corrente({ meta: 2 })), "invalido:meta");
await recusa("hora no passado", () => abrir("g1", corrente({ quando: daqui(-1) })), "invalido:quando");
await recusa("texto com e-mail é dado pessoal", () => abrir("g1", corrente({ texto: "Mande nome para fulana@exemplo.org agora" })), "dado_pessoal");
const k = await espera("g1 abre a corrente", () => abrir("g1", corrente()), (r) => r.elos === null && r.fechada === false && r.total === 0 && r.org.handle === "movimento_zl" && r.meta === 6);
const KID = k?.id;
await espera("visitante não lista correntes", () => lista(null), (r) => r.length === 0);
await espera("membro lista pela cidade escrita (sem acento e com espaços)", () => lista("m4", "  SAO   paulo "), (r) => r.length === 1 && r[0].id === KID && r[0].total === null);
await espera("outra cidade não vê", () => lista("m4", "Recife"), (r) => r.length === 0);
await espera("bloqueado não vê", () => lista("bloqueado"), (r) => r.length === 0);
await recusa("bloqueado não responde", () => vou("bloqueado", KID), "nao_encontrado");
await espera("1 vou: nenhum elo", () => vou("m1", KID), (r) => r.vou_eu === true && r.elos === null && r.total === null);
await espera("2 vou: nenhum elo", () => vou("m2", KID), (r) => r.elos === null);
await espera("3 vou: metade da corrente (3 de 6)", () => vou("m3", KID), (r) => r.elos === 0.5 && r.fechada === false);
await espera("gestor vê o total exato", () => lista("g2"), (r) => r[0].total === 3);
await espera("desfazer volta a 2: apaga os elos", () => vou("m3", KID, false), (r) => r.vou_eu === false && r.elos === null);
for (const m of ["m3", "m4", "m5"]) await vou(m, KID).catch((e) => falhas.push(`vou ${m}: ${e.message}`));
await espera("a 6ª resposta fecha a corrente", () => vou("fora", KID), (r) => r.fechada === true && r.elos === 1);
await espera("fechada sai da lista", () => lista("m1"), (r) => r.length === 0);
await recusa("corrente fechada não recebe resposta nova", () => vou("g2", KID), "corrente_fechada");
await espera("nenhuma resposta da corrente traz id de pessoa", async () => JSON.stringify([await vou("m1", KID, false), await rpc(como(P.g1), "rede_corrente_posso")]), (s) => ![P.g1, P.g2, P.m1, P.m2].some((id) => s.includes(id)));
await espera("2 correntes por semana por organização", async () => {
  await abrir("g2", corrente({ texto: "Segunda corrente da semana para a ocupação" }));
  try {
    await abrir("g1", corrente({ texto: "Terceira corrente da semana para a ocupação" }));
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("muitos_pedidos"));
await espera("os elos do banco são os MESMOS de lib/rede/atos/corrente.ts (0 a 120, metas variadas)", async () => {
  const r = await dono("select n, m, interno.rede_corrente_elos(n, m)::float8 as p from generate_series(0, 120) n, unnest(array[3, 6, 30, 100]::int[]) m");
  return r.rows.filter((x) => (x.p ?? null) !== elosDaCorrente(x.n, x.m)).map((x) => `${x.n}/${x.m}:${x.p}`);
}, (d) => d.length === 0);
ok("a corrente usa a mesma regra de 3 do mosaico", elosDaCorrente(2, 3) === null && proporcaoDoMosaico(2) === null);

// ═══════════════════ 3. O cliente do site sobre o banco de verdade ═══════════════════
{
  const chamarComo = (quem) => (funcao, argumentos = {}) => rpc(quem ? como(P[quem]) : visitante(), funcao, argumentos);
  const cG1 = criarClienteDosAtos(chamarComo("g1"));
  const cM1 = criarClienteDosAtos(chamarComo("m1"));
  await espera("cliente: posso", () => cG1.correntePosso(), (r) => r.length === 1);
  await espera("cliente: correntes de quem não gerencia não trazem total", () => cM1.correntes("São Paulo"), (r) => r.every((x) => x.total === null));
  await espera("cliente: farol de ato cancelado continua legível para quem confirmou", () => cM1.farol(ID), (r) => r?.estado === "ponto2");
}

await banco.pg.close?.();
console.log(`Alumia (atos: farol e corrente no banco): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
