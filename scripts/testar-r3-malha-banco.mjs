// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o Farol do ato sem internet no banco (supabase/migracoes/20261125-r3-sem-internet-formal.sql) num Postgres local
// (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql. Os ataques estão escritos como teste:
//   - quem não confirmou presença, o visitante e o ato cancelado não recebem k_ato;
//   - quem confirmou e quem coordena recebem a MESMA k_ato e a MESMA lista; a lista tem SEMPRE 8 chaves (não diz quantas pessoas
//     da coordenação publicaram) e nenhuma resposta traz id de pessoa;
//   - só quem coordena publica chave; uma por pessoa (publicar de novo troca a dela: ninguém tem duas e assina o farol sozinha);
//     a chave de outra pessoa não é tomada; formato torto recusado;
//   - ataque da auditoria interna (R3, achado do farol): quem confirmou presença (um infiltrado) não descobre QUEM coordena: o
//     material não traz assinatura da identidade da conta (antes trazia, e ela conferia contra rede_diretorio_ler); e não conta as
//     chaves verdadeiras pelo teste "é ponto da curva?" (as falsas são iscas válidas, mandadas por quem publica);
//   - e o aparelho de verdade: com o material do banco, o farol de duas pessoas da coordenação vale, o de uma é pedido, e o de
//     uma pessoa que publicou duas vezes conta como uma (lib/rede/malha/farol.ts sobre a lista do banco).
// Uso: npm run testar:r3-malha-banco
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { deB64Url, sortear } from "../lib/rede/chat/r2/bytes.ts";
import { ed25519 } from "@noble/curves/ed25519.js";
import { assinarFarol, chaveDoFarol, conferirFarol, bytesDoUuid, iscasDoFarol } from "../lib/rede/malha/farol.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = "supabase/migracoes/20261125-r3-sem-internet-formal.sql";
const sql = fs.readFileSync(path.join(raiz, MIGRACAO), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
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
ok("termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("sem endereço de rede, porta nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok('"Rede Lúcia" não aparece no arquivo', !/Rede Lúcia/.test(sql));
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length === 4 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("nenhuma permissão direta nas tabelas", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("toda função de interno tem revoke de public, anon e authenticated", ["rede_ato_farol_material_garantir", "rede_ato_farol_material_json"].every((f) => new RegExp(`revoke all on function interno\\.${f}\\(uuid\\) from public`).test(sql) && new RegExp(`revoke all on function interno\\.${f}\\(uuid\\) from anon, authenticated`).test(sql)));

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const P = {};
const nomes = ["org", "g1", "g2", "g3", "m1", "m2", "fora"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@farol.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_handle = 'movimento_zl' where id = $1", [P.org]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, verificada_em) values ($1, 'movimento', 'São Paulo', now()) on conflict (perfil) do nothing", [P.org]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($1, $3, 'gestor'), ($1, $4, 'gestor') on conflict do nothing", [P.org, P.g1, P.g2, P.g3]);
for (const g of ["g1", "g2"]) {
  await dono("insert into interno.diretorio_contas (usuario, identidade, pedidos_xwing, pedidos_assinatura, pedidos_caixa, pedidos_pd) values ($1, $2, $3, $4, $5, $6) on conflict do nothing",
    [P[g], Buffer.from(sortear(32)), Buffer.from(sortear(1216)), Buffer.from(sortear(64)), Buffer.from(sortear(32)), Buffer.from(sortear(32))]);
}

const daqui = (dias, hora = 18) => {
  const d = new Date(Date.now() + dias * 86_400_000);
  d.setUTCHours(hora, 0, 0, 0);
  return d.toISOString();
};
const ato = await espera("a organização chama um ato", () => rpc(como(P.org), "rede_ato_publicar", { p: {
  titulo: "Fica Esperança", inicio: daqui(3), onde: "Ocupação Esperança · na porta", cidade: "São Paulo", descricao: "Vigília na porta da ocupação.",
} }), (a) => a.situacao === "confirmado");
const ID = ato?.id;
for (const m of ["m1", "m2"]) await rpc(como(P[m]), "rede_ato_vou", { p_id: ID, p_sim: true }).catch((e) => falhas.push(`vou ${m}: ${e.message}`));

const material = (quem) => rpc(quem ? como(P[quem]) : { papel: "anon", ip: "203.0.113.9" }, "rede_ato_farol_material", { p_ato: ID });
const b64 = (b) => Buffer.from(b).toString("base64");
const publicar = (quem, chave, iscas = iscasDoFarol()) => rpc(como(P[quem]), "rede_ato_farol_chave_publicar", { p_ato: ID, p_chave: typeof chave === "string" ? chave : b64(chave), p_iscas: iscas.map((i) => (typeof i === "string" ? i : b64(i))) });
const ehPonto = (b64c) => {
  try {
    ed25519.Point.fromBytes(new Uint8Array(Buffer.from(b64c, "base64")));
    return true;
  } catch {
    return false;
  }
};
const semIds = (r) => ![...Object.values(P)].some((id) => JSON.stringify(r).includes(id));

// ═══════════════════ 1. Quem recebe k_ato ═══════════════════
await recusa("visitante não chama (só com sessão)", () => material(null), "");
await espera("quem não confirmou presença recebe nulo", () => material("fora"), (r) => r === null);
const m1 = await espera("quem confirmou recebe k_ato (32 bytes) e 8 chaves", () => material("m1"), (r) => deB64Url(r.k_ato.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")).length === 32 && r.chaves.length === 8);
const g1 = await espera("quem coordena recebe o mesmo material", () => material("g1"), (r) => r.k_ato === m1?.k_ato && JSON.stringify(r.chaves) === JSON.stringify(m1?.chaves));
ok("nenhuma resposta traz id de pessoa", semIds(m1) && semIds(g1));
await espera("chamar de novo não troca k_ato", () => material("m2"), (r) => r.k_ato === m1?.k_ato);
ok("no banco: só o dia, nunca a hora", (await dono("select data_type from information_schema.columns where table_schema = 'interno' and table_name in ('rede_ato_farol_material', 'rede_ato_farol_chaves') and data_type like 'timestamp%'")).rows.length === 0);

// ═══════════════════ 2. Publicar a chave do farol ═══════════════════
const s1 = sortear(32);
const s2 = sortear(32);
const s1b = sortear(32);
await recusa("quem confirmou mas não coordena não publica chave", () => publicar("m1", chaveDoFarol(sortear(32))), "so_coordenacao");
await recusa("chave com tamanho errado é recusada", () => publicar("g1", sortear(31)), "invalido:chave");
await recusa("isca com tamanho errado é recusada", () => publicar("g1", chaveDoFarol(s1), [sortear(31)]), "invalido:iscas");
await recusa("mais de 7 iscas é recusado", () => publicar("g1", chaveDoFarol(s1), iscasDoFarol(7).concat([chaveDoFarol(sortear(32))])), "invalido:iscas");
await recusa("isca igual à própria chave é recusada", () => publicar("g1", chaveDoFarol(s1), [chaveDoFarol(s1)]), "invalido:iscas");
await recusa("base64 torto é recusado", () => publicar("g1", "não é base64!"), "invalido:chave");
ok("a versão de antes (com p_assinatura) não existe mais", (await dono("select count(*)::int as n from pg_proc where proname = 'rede_ato_farol_chave_publicar' and pronargs = 3 and proargtypes[2] = 'text'::regtype")).rows[0].n === 0);
ok("a tabela não guarda assinatura de identidade", (await dono("select count(*)::int as n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_ato_farol_chaves' and column_name = 'assinatura'")).rows[0].n === 0);
const depois1 = await espera("g1 publica a chave dela", () => publicar("g1", chaveDoFarol(s1)), (r) => r.chaves.length === 8 && r.chaves.some((c) => c.chave === b64(chaveDoFarol(s1))));
await espera("g2 publica a dela", () => publicar("g2", chaveDoFarol(s2)), (r) => r.chaves.length === 8);
await recusa("g2 não toma a chave da g1", () => publicar("g2", chaveDoFarol(s1)), "invalido:chave");
await recusa("g2 não põe a chave da g1 como isca (para tirá-la da lista)", () => publicar("g2", chaveDoFarol(s2), [chaveDoFarol(s1)]), "invalido:iscas");
await espera("quem coordena sem identidade no diretório também publica (a chave não aponta a conta)", () => publicar("g3", chaveDoFarol(sortear(32))), (r) => r.chaves.length === 8);
{
  // O ataque do infiltrado: confirmou presença, recebe o material e tenta achar QUEM coordena e QUANTOS publicaram.
  const mat = await material("m1");
  const identidades = (await dono("select identidade from interno.diretorio_contas where usuario = any ($1)", [[P.g1, P.g2]])).rows.map((r) => new Uint8Array(r.identidade));
  ok("ataque: o material só traz a chave (nenhuma assinatura para conferir contra a identidade)", mat.chaves.every((c) => Object.keys(c).join() === "chave"));
  const conferiu = mat.chaves.some((c) => c.assinatura && identidades.some((id) => {
    try {
      return ed25519.verify(new Uint8Array(Buffer.from(c.assinatura, "base64")), new Uint8Array(Buffer.from(c.chave, "base64")), id);
    } catch {
      return false;
    }
  }));
  ok("ataque: nenhuma linha confere com a identidade de quem coordena", !conferiu);
  ok("ataque: as 8 chaves são pontos válidos da curva (não dá para contar as verdadeiras)", mat.chaves.filter((c) => ehPonto(c.chave)).length === 8, `${mat.chaves.filter((c) => ehPonto(c.chave)).length} de 8`);
}
await espera("g1 publica de novo: troca a dela (continua uma por pessoa)", () => publicar("g1", chaveDoFarol(s1b)), (r) => r.chaves.length === 8 && r.chaves.some((c) => c.chave === b64(chaveDoFarol(s1b))) && !r.chaves.some((c) => c.chave === b64(chaveDoFarol(s1))));
ok("no banco: uma linha por pessoa, 8 no total", (await dono("select count(*)::int as n, count(de)::int as d, count(distinct de)::int as p from interno.rede_ato_farol_chaves where ato = $1", [ID])).rows[0].n === 8
  && (await dono("select count(de)::int as d from interno.rede_ato_farol_chaves where ato = $1", [ID])).rows[0].d === 3);
ok("a resposta da publicação não traz id de pessoa", semIds(depois1));

// ═══════════════════ 3. O aparelho com o material do banco ═══════════════════
{
  const mat = await material("m1");
  const autorizadas = mat.chaves.map((c) => new Uint8Array(Buffer.from(c.chave, "base64")));
  const atoB = bytesDoUuid(ID);
  const conteudo = { ato: atoB, estado: "atencao", texto: "", quando: Math.floor(Date.now() / 1000) };
  ok("aparelho: o farol de g1 e g2 (as chaves do banco) vale", conferirFarol(assinarFarol(assinarFarol(conteudo, s1b), s2), atoB, autorizadas) === 2);
  ok("aparelho: a chave antiga da g1 (trocada) não vale mais", conferirFarol(assinarFarol(assinarFarol(conteudo, s1), s2), atoB, autorizadas) === 1);
  ok("aparelho: uma pessoa com a chave velha e a nova não assina sozinha", conferirFarol(assinarFarol(assinarFarol(conteudo, s1), s1b), atoB, autorizadas) === 1);
  ok("aparelho: chave de fora da lista não conta", conferirFarol(assinarFarol(assinarFarol(conteudo, s2), sortear(32)), atoB, autorizadas) === 1);
}

// ═══════════════════ 4. Ato cancelado; o material some com o ato ═══════════════════
await rpc(como(P.org), "rede_ato_mudar", { p_id: ID, p_situacao: "cancelado", p_motivo: "" }).catch((e) => falhas.push(`cancelar: ${e.message}`));
await espera("ato cancelado: ninguém recebe o material", () => material("m1"), (r) => r === null);
await recusa("ato cancelado: ninguém publica chave", () => publicar("g2", chaveDoFarol(sortear(32))), "ato_cancelado");
await dono("delete from interno.rede_posts where id = $1", [ID]);
ok("apagar o ato apaga k_ato e as chaves", (await dono("select (select count(*) from interno.rede_ato_farol_material where ato = $1)::int + (select count(*) from interno.rede_ato_farol_chaves where ato = $1)::int as n", [ID])).rows[0].n === 0);

// ═══════════════════ 5. Permissões e porta ═══════════════════
ok("anon não executa as funções públicas novas", (await dono("select has_function_privilege('anon', 'public.rede_ato_farol_material(uuid)', 'execute') as a, has_function_privilege('anon', 'public.rede_ato_farol_chave_publicar(uuid, text, text[])', 'execute') as b")).rows.every((r) => !r.a && !r.b));
ok("ninguém de fora executa as de interno", (await dono("select bool_or(has_function_privilege(r, 'interno.rede_ato_farol_material_garantir(uuid)', 'execute') or has_function_privilege(r, 'interno.rede_ato_farol_material_json(uuid)', 'execute')) as x from unnest(array['anon', 'authenticated']) r")).rows[0].x === false);
ok("RLS ligada nas tabelas novas", (await dono("select bool_and(relrowsecurity) as x from pg_class where oid in ('interno.rede_ato_farol_material'::regclass, 'interno.rede_ato_farol_chaves'::regclass)")).rows[0].x === true);
await espera("a porta não deixa função aberta", () => dono("select interno.alumia_trancar() as r").then((x) => x.rows[0].r), (r) => (r?.abertas ?? []).length === 0);

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
