// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a migração 20261113-alumia-o7-pedidos.sql (pedidos P18, P19 e P20 da Faixa 2 em funções da Faixa 1) num Postgres de
// verdade (scripts/banco-local.mjs), rodada DUAS vezes sobre o install.sql:
//   P18  o "baixar meus dados" não leva o endereço de quem curtiu ou impulsionou;
//   P19  as listas antigas de avisos deixam de fora curtida e impulso de fora, e o resumo semanal aplica o piso de 3;
//   P20  bloquear não serve para descobrir de quem é uma carona, bloquear tem freio, e as caronas somem depois do ato.
// E as portas da entrada continuam em todas as funções public.rede_* recriadas.
// Uso: npm run testar:alumia-o7
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
const sql = ler("supabase/migracoes/20261113-alumia-o7-pedidos.sql");
ok("toda função da migração é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length === 7 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a migração não cria tabela nem apaga coluna", !/create table|drop table|drop column|alter table/i.test(sql));

// ═══════════════════ 1. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("rede_bloquear e rede_avisos passam pela porta", async () => (await um("select pg_get_functiondef('public.rede_bloquear(uuid,boolean)'::regprocedure) as b, pg_get_functiondef('public.rede_avisos()'::regprocedure) as a")), (r) => r.b.includes("alumia_porta") && r.a.includes("alumia_porta"));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const P = {};
const nomes = ["org", "dona", "leitora", "outra"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o7.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${i + 1}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");

// ── P18 e P19: avisos de curtida de fora ──
const CURTIU = "https://social.exemplo.org/users/quem_curtiu";
await dono(
  "insert into interno.avisos (para, texto, categoria, tipo, ator_remoto) values ($1, 'Alguém de fora curtiu seu post', 'rede', 'fed_curtida', $2), ($1, 'Alguém de fora impulsionou', 'rede', 'fed_impulso', $2), ($1, 'Uma resposta nova', 'rede', 'resposta', null)",
  [P.dona, CURTIU],
);
await espera("P18: baixar meus dados não leva o endereço de quem curtiu", () => rpc(como(P.dona), "conta_meus_dados"), (r) => {
  const texto = JSON.stringify(r);
  const avisos = r?.["avisos.para"] ?? [];
  return !texto.includes(CURTIU) && avisos.length === 3 && avisos.some((a) => a.tipo === "fed_curtida" && !("ator_remoto" in a));
});
await espera("P18: o resto da cópia continua (o aviso de resposta e o perfil)", () => rpc(como(P.dona), "conta_meus_dados"), (r) => r?.perfil && (r["avisos.para"] ?? []).some((a) => a.tipo === "resposta"));
await espera("P19: rede_avisos sem curtida e impulso de fora", () => rpc(como(P.dona), "rede_avisos"), (r) => r.length === 1 && r[0].texto === "Uma resposta nova");
await espera("P19: avisos_meus sem curtida e impulso de fora", () => rpc(como(P.dona), "avisos_meus"), (r) => r.length === 1);
await espera("P19: o resumo semanal aplica o piso (2 curtidas de fora contam 1)", async () => {
  await dono("insert into interno.avisos (para, texto, categoria, tipo, ator_remoto) values ($1, 'Outra curtida', 'rede', 'fed_curtida', 'https://outro.exemplo.org/users/b')", [P.outra]);
  await dono("insert into interno.avisos (para, texto, categoria, tipo, ator_remoto) values ($1, 'Mais uma curtida', 'rede', 'fed_curtida', 'https://outro.exemplo.org/users/c')", [P.outra]);
  return (await um("select interno.rede3_aviso_resumo($1) as r", [P.outra])).r;
}, (r) => r !== null && r.n === 1 && /- 1 /.test(r.texto) && !/- 2 /.test(r.texto));

// ── P20: caronas e bloqueio ──
const daqui = (horas) => new Date(Date.now() + horas * 3_600_000).toISOString();
const ato = await espera("a organização chama um ato", () => rpc(como(P.org), "rede_ato_publicar", { p: { titulo: "Fica Esperança", inicio: daqui(72), onde: "Ocupação Esperança · na porta", cidade: "São Paulo", descricao: "Vigília na porta da ocupação." } }), (a) => Boolean(a?.id));
const ID = ato?.id;
const caronas = (quem) => rpc(como(P[quem]), "rede_ato_caronas", { p_ato: ID });
await espera("a dona oferece carona", () => rpc(como(P.dona), "rede_ato_carona_criar", { p_ato: ID, p: { tipo: "oferta", meio: "carro", saida: "Metrô Itaquera, saída B", vagas: 3 } }), (r) => r.length === 1);
await espera("a leitora vê a carona", () => caronas("leitora"), (r) => r.length === 1);
await espera("a leitora bloqueia a dona", () => rpc(como(P.leitora), "rede_bloquear", { p_usuario: P.dona, p_sim: true }), (r) => r.ok === true);
await espera("P20: bloquear a dona NÃO tira a carona da lista (bloquear não vira teste de quem vai)", () => caronas("leitora"), (r) => r.length === 1 && r[0].minha === false);
await recusa("P20: desbloquear logo em seguida é recusado", () => rpc(como(P.leitora), "rede_bloquear", { p_usuario: P.dona, p_sim: false }), "muitos_pedidos");
await espera("P20: depois de 3 horas, desbloqueia", async () => {
  await dono("update interno.rede_bloqueios set criado_em = now() - interval '4 hours' where quem = $1 and bloqueado = $2", [P.leitora, P.dona]);
  return rpc(como(P.leitora), "rede_bloquear", { p_usuario: P.dona, p_sim: false });
}, (r) => r.ok === true);
await espera("a dona bloqueia a outra", () => rpc(como(P.dona), "rede_bloquear", { p_usuario: P.outra, p_sim: true }), (r) => r.ok === true);
await espera("P20: quem a dona bloqueou não vê a carona dela", async () => (await um("select interno.rede_ato_caronas_json($1, $2, false) as r", [ID, P.outra])).r, (r) => r.length === 0);
await espera("P20: a leitora (não bloqueada pela dona) continua vendo", () => caronas("leitora"), (r) => r.length === 1);
await recusa("P20: bloquear tem freio (20 por hora)", async () => {
  for (let i = 0; i < 25; i++) await rpc({ papel: "authenticated", sub: P.org, ip: "198.51.100.7" }, "rede_bloquear", { p_usuario: P.outra, p_sim: true });
}, "muitos_pedidos");

// ── P20: a faxina ──
await espera("a faxina não apaga carona de ato que ainda vai acontecer", async () => (await um("select interno.rede_ato_caronas_faxina() as n")).n, (n) => n === 0);
await espera("ato que passou há mais de um dia: a carona some", async () => {
  await dono("update interno.rede_chamados set inicio = now() - interval '3 days', fim = now() - interval '2 days' where post = $1", [ID]);
  const n = (await um("select interno.rede_ato_caronas_faxina() as n")).n;
  const resta = (await um("select count(*)::int as n from interno.rede_ato_caronas where ato = $1", [ID])).n;
  return { n, resta };
}, ({ n, resta }) => n === 1 && resta === 0);
await recusa("a faxina não é para conta nenhuma", () => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: P.org })]);
  await banco.pg.exec("set role authenticated");
  try {
    return (await banco.pg.query("select interno.rede_ato_caronas_faxina()")).rows;
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");
await banco.pg.close?.();

console.log(`Alumia (pedidos P18 a P20): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
