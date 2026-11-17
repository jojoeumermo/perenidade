// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o público e a vida do post (supabase/migracoes/20261115-alumia-o9-publicar.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql:
//   · só a minha roda: só a roda da autora vê, responde e é avisada de menção; quem segue e não está na roda não vê nada; a roda
//     nunca sai em lista de ninguém;
//   · não listado: abre pelo link, não aparece na linha nem na busca; com a trava da entrada, só conta aprovada abre;
//   · arquivar: some para os outros, a autora vê nos arquivados e desarquiva;
//   · some sozinho e apagar depois de X semanas: o agendador apaga de verdade, a mídia vai para a fila de arquivos e o que outra
//     pessoa respondeu fica como "[post apagado]";
//   · as regras de quem vê só valem depois da composição que quem junta faz (docs/rede/VIDA-DO-POST.md): o teste confere o antes
//     (nada fica mais aberto) e faz a composição sobre as definições vivas.
// Também confere as peças puras (lib/rede/publicar/vida.ts), os seis idiomas dos textos e as telas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o9-publicar.mjs
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

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261115-alumia-o9-publicar.sql");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 13 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("uma tabela nova só: a escolha da conta (semanas), sem nada além da pessoa e do número", (sql.match(/create table/gi) ?? []).length === 1
  && /create table if not exists interno\.rede_vida_conta \(\s*usuario uuid primary key[^;]*semanas smallint[^;]*desde timestamptz[^;]*\);/.test(sql));
ok("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("a porta passa em toda função nova (alumia_trancar no fim)", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia nem redefine interno.rede_ve, rede2_pode_ver, rede_silenciado ou a federação",
  !/rede_alumia_versao|function interno\.rede_ve\(|function interno\.rede2_pode_ver|function interno\.rede_silenciado|function interno\.rede_fed_/.test(sql));
ok("nenhum endereço de rede", !/\bip\b|x-forwarded|cf-connecting|inet/i.test(sql.replace(/^\s*--.*$/gm, "")));
ok("o agendador apaga a cada 10 minutos", /cron\.schedule\('alumia-vida-dos-posts', '\*\/10 \* \* \* \*', 'select interno\.rede_vida_rodada\(\)'\)/.test(sql));

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));

let ip = 10;
const como = (sub, aal) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}`, ...(aal ? { aal } : {}) });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

const P = {};
const nomes = ["ana", "bia", "caio", "duda", "eli"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o9.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
const zerar = () => dono("delete from interno.limites");

// caio segue ana (mas não está na roda dela); bia está na roda de ana.
await rpc(como(P.caio), "rede_seguir", { p_usuario: P.ana, p_sim: true });
await rpc(como(P.bia), "rede_seguir", { p_usuario: P.ana, p_sim: true });

const publicar = (quem, pedido) => rpc(como(P[quem]), "rede_pub_vida_publicar", { p: pedido });
const ver = (quem, id) => rpc(quem ? como(P[quem]) : visitante(), "rede_post", { p_id: id });
const linha = async (quem, aba = "tudo") => ((await rpc(quem ? como(P[quem]) : visitante(), "rede_linha", { p_aba: aba })).itens ?? []).map((x) => x.id);
const veNoBanco = async (id, quem) => (await um("select interno.rede_ve(p, $2::uuid) as v from interno.rede_posts p where p.id = $1", [id, quem ? P[quem] : null])).v;

// ── Funções e permissões ──
await espera("rede_vida_conta: RLS ligada e nenhuma política", async () => {
  const r = await um("select relrowsecurity as r, (select count(*)::int from pg_policies where schemaname = 'interno' and tablename = 'rede_vida_conta') as n from pg_class where oid = 'interno.rede_vida_conta'::regclass");
  return r.r === true && r.n === 0;
}, (x) => x);
await espera("rede_vida_conta: nenhuma permissão para anon/authenticated", async () =>
  (await um("select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and table_name = 'rede_vida_conta' and grantee in ('anon', 'authenticated', 'PUBLIC')")).n, (n) => n === 0);
const publicas = ["rede_pub_vida_publicar", "rede_pub_arquivar", "rede_pub_arquivados", "rede_pub_vida", "rede_pub_vida_conta", "rede_pub_vida_conta_previa", "rede_pub_vida_conta_mudar"];
await espera("as funções da tela passam pela porta e só conta logada chama", async () => (await dono(`select p.proname, p.prosrc ~ 'interno\\.alumia_porta\\(\\)' as porta,
  has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)`, [publicas])).rows,
(rs) => rs.length === publicas.length && rs.every((r) => r.porta && !r.anon && r.aut));
await espera("as funções de dentro (regra de quem vê, apagar, rodada) ninguém chama pela API", async () => (await dono(`select bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) as alguma, count(*)::int as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede\\_vida\\_%'`)).rows[0],
(r) => r.n >= 6 && r.alguma === false);
await recusa("visitante não publica pela vida", () => rpc(visitante(), "rede_pub_vida_publicar", { p: { texto: "x" } }), "permission denied");

// ═══════════════════ 2. Só a minha roda ═══════════════════
await recusa("roda vazia: recusa (o post ficaria só com a autora sem ela saber)", () => publicar("ana", { texto: "Só pra roda", publico: "roda" }), "roda_vazia");
await rpc(como(P.ana), "rede_roda_mudar", { p_handle: "pessoa_bia", p_sim: true });
await recusa("roda com comunidade: recusa", () => publicar("ana", { texto: "x", publico: "roda", comunidade: "qualquer" }), "invalido:publico");
const roda = await espera("publica para a roda: o post volta com público 'roda'", () => publicar("ana", { texto: "Reunião sábado, @pessoa_caio e @pessoa_bia", publico: "roda" }),
  (r) => r?.publico === "roda" && r.nao_listado === false && r.expira_em === null);
const idRoda = roda?.id;
await espera("no banco: público e alcance 'roda'", () => um("select publico, alcance from interno.rede_posts where id = $1", [idRoda]), (r) => r.publico === "roda" && r.alcance === "roda");
await espera("menção na roda: só quem está na roda é avisado (caio, que segue mas não está, não recebe aviso nenhum)", async () =>
  (await dono("select para from interno.avisos where post = $1", [idRoda])).rows.map((r) => r.para), (ps) => !ps.includes(P.caio));

// A composição já pode estar no banco (20261115-alumia-onda9-fim.sql, colada no fim do install.sql): então os passos de "antes" e
// a composição feita aqui não se aplicam, e o teste confere a que já está lá.
const jaComposta = (await um("select pg_get_functiondef('interno.rede2_pode_ver(interno.rede_posts, uuid)'::regprocedure) as d")).d.includes("interno.rede_vida_ve(p, p_quem)");
if (jaComposta) {
  await espera("a composição do fim da onda 9 já está em rede2_pode_ver e em rede_silenciado", async () => {
    const s = (await um("select prosrc from pg_proc where oid = 'interno.rede_silenciado(interno.rede_posts, uuid)'::regprocedure")).prosrc;
    return s.includes("interno.rede_vida_fora_da_lista(p, p_quem)");
  }, (x) => x === true);
} else {
// Antes da composição: nada fica mais aberto do que a autora escolheu.
await espera("antes da composição, o post da roda fica só com a autora (nem a roda vê ainda)", async () =>
  [await veNoBanco(idRoda, "ana"), await veNoBanco(idRoda, "bia"), await veNoBanco(idRoda, "caio"), await veNoBanco(idRoda, null)],
(v) => v[0] === true && v[1] === false && v[2] === false && v[3] === false);
await espera("a regra antiga (alcance) também não entrega o post da roda a ninguém além da autora", async () =>
  (await um("select count(*)::int as n from interno.rede_posts p where p.id = $1 and p.alcance in ('publico', 'seguidores', 'equipe')", [idRoda])).n, (n) => n === 0);

// ═══════════════════ 3. A composição que quem junta faz ═══════════════════
await espera("composição em rede2_pode_ver (antes do case do público)", async () => {
  let def = (await um("select pg_get_functiondef('interno.rede2_pode_ver(interno.rede_posts, uuid)'::regprocedure) as d")).d;
  if (!def.includes("  return case v_publico")) throw new Error("rede2_pode_ver mudou: o ponto da composição não está lá");
  def = def.replace(/declare\n/, "declare\n  v_vida boolean;\n").replace("  return case v_publico", "  v_vida := interno.rede_vida_ve(p, p_quem);\n  if v_vida is not null then return v_vida; end if;\n  return case v_publico");
  await exec(def);
  return true;
});
await espera("composição em rede_silenciado (com or)", async () => {
  const r = await um("select prosrc from pg_proc where oid = 'interno.rede_silenciado(interno.rede_posts, uuid)'::regprocedure");
  const corpo = r.prosrc.trim().replace(/;\s*$/, "");
  await exec(`create or replace function interno.rede_silenciado(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $f$
  select (${corpo.replace(/^select\s/i, "select ")}) or interno.rede_vida_fora_da_lista(p, p_quem)
$f$;`);
  return true;
});
}

await zerar();
await espera("depois da composição: a roda vê, quem segue e não está na roda não, visitante não", async () =>
  [await veNoBanco(idRoda, "bia"), await veNoBanco(idRoda, "caio"), await veNoBanco(idRoda, "duda"), await veNoBanco(idRoda, null)],
(v) => v[0] === true && v[1] === false && v[2] === false && v[3] === false);
await espera("bia (na roda) abre o post; caio (segue, fora da roda) não acha", async () => {
  const b = await ver("bia", idRoda);
  let c = "abriu";
  try { await ver("caio", idRoda); } catch (e) { c = e.message; }
  return { b: b.post.id, c };
}, (r) => r.b === idRoda && r.c.includes("nao_encontrado"));
await espera("menção num post da roda avisa só quem está na roda (bia sim, caio não)", async () => {
  const r = await publicar("ana", { texto: "Plenária amanhã, @pessoa_bia e @pessoa_caio", publico: "roda" });
  return (await dono("select para from interno.avisos where post = $1", [r.id])).rows.map((x) => x.para);
}, (ps) => ps.includes(P.bia) && !ps.includes(P.caio));
await espera("na linha: a roda acha o post, caio não", async () => [(await linha("bia")).includes(idRoda), (await linha("caio")).includes(idRoda)], (v) => v[0] && !v[1]);
const resp = await espera("bia responde: a resposta herda a roda (público e alcance 'roda')", async () => {
  const r = await rpc(como(P.bia), "rede_publicar", { p: { texto: "Eu vou", resposta_a: idRoda } });
  return um("select publico, alcance from interno.rede_posts where id = $1", [r.id]).then((x) => ({ ...x, id: r.id }));
}, (r) => r.publico === "roda" && r.alcance === "roda");
await espera("a resposta segue a roda de quem abriu a conversa: ana vê, caio não", async () => [await veNoBanco(resp?.id, "ana"), await veNoBanco(resp?.id, "caio")], (v) => v[0] && !v[1]);
await recusa("caio (fora da roda) não responde", () => rpc(como(P.caio), "rede_publicar", { p: { texto: "oi", resposta_a: idRoda } }), "nao_encontrado");
await espera("tirar bia da roda: ela deixa de ver na hora", async () => {
  await rpc(como(P.ana), "rede_roda_mudar", { p_handle: "pessoa_bia", p_sim: false });
  const v = await veNoBanco(idRoda, "bia");
  await rpc(como(P.ana), "rede_roda_mudar", { p_handle: "pessoa_bia", p_sim: true });
  return v;
}, (v) => v === false);
await espera("o cartão (rede_pub_vida): a autora sabe que é da roda; bia só recebe o que é de quem lê (nada sobre a lista)", async () => {
  const a = await rpc(como(P.ana), "rede_pub_vida", { p_ids: [idRoda] });
  const b = await rpc(como(P.bia), "rede_pub_vida", { p_ids: [idRoda] });
  const c = await rpc(como(P.caio), "rede_pub_vida", { p_ids: [idRoda] });
  return { a: a[idRoda], b: b[idRoda], c };
}, (r) => r.a?.roda === true && r.b && !("roda" in r.b) && !("nao_listado" in r.b) && Object.keys(r.c).length === 0);
await espera("nenhuma resposta das funções novas traz a lista da roda", async () => {
  const tudo = JSON.stringify([await rpc(como(P.ana), "rede_pub_vida", { p_ids: [idRoda] }), await rpc(como(P.ana), "rede_pub_arquivados", {})]);
  return tudo;
}, (t) => !t.includes("pessoa_bia") && !t.includes(P.bia));

// ═══════════════════ 4. Não listado ═══════════════════
await zerar();
const naoListado = await espera("publica não listado para membros", () => publicar("ana", { texto: "Só quem tem o link", publico: "membros", nao_listado: true }), (r) => r?.nao_listado === true);
const idNL = naoListado?.id;
await espera("abre pelo link para quem pode ver o público (duda, membro)", () => ver("duda", idNL), (r) => r.post.id === idNL);
await espera("não aparece na linha de ninguém (nem de quem segue)", async () => [(await linha("caio")).includes(idNL), (await linha("duda")).includes(idNL)], (v) => !v[0] && !v[1]);
await espera("a autora ainda acha o próprio não listado na linha dela", async () => (await linha("ana")).includes(idNL), (v) => v === true);
const listadoComLink = await publicar("ana", { texto: "Outro post com o link aberto a todos", publico: "membros" });
await espera("não aparece na busca (o listado com a mesma palavra aparece)", async () => {
  const r = await rpc(como(P.duda), "rede_desc_buscar", { p_q: "link" });
  return (r.itens ?? r.posts ?? []).map((x) => x.id ?? x.post?.id);
}, (ids) => ids.includes(listadoComLink.id) && !ids.includes(idNL));
await espera("não listado de 'internet' (disciplinas) abre para visitante sem a trava", async () => {
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('fisica', 'Física', 'disciplinas', 'aberta', 'internet') on conflict do nothing");
  const r = await publicar("ana", { texto: "Lista de exercícios", publico: "internet", comunidade: "fisica", nao_listado: true });
  return { id: r.id, visto: (await ver(null, r.id)).post.id };
}, (r) => r.id === r.visto);
const idNLInternet = (await um("select id from interno.rede_posts where texto = 'Lista de exercícios'"))?.id;
await espera("com a trava ligada, o link do não listado só abre para conta aprovada (visitante e conta sem aprovação não)", async () => {
  await dono("select interno.alumia_entrada_ligar(true)");
  const vis = await veNoBanco(idNLInternet, null);
  // Quem já era membro entra aprovada quando a trava liga (duda); quem consente depois espera a triagem (fora).
  P.fora = await criarUsuario("fora@o9.local", "fora");
  await rpc(como(P.fora), "eu");
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P.fora]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P.fora]);
  const semAprovacao = await veNoBanco(idNLInternet, "fora");
  const aprovada = await um("select interno.rede_vida_ve(p, $2) as v from interno.rede_posts p where p.id = $1", [idNLInternet, P.duda]);
  // O mesmo post, listado, continua aberto ao visitante (a troca vale só para o não listado).
  await dono("update interno.rede_posts set nao_listado = false where id = $1", [idNLInternet]);
  const listado = await veNoBanco(idNLInternet, null);
  await dono("update interno.rede_posts set nao_listado = true where id = $1", [idNLInternet]);
  await dono("select interno.alumia_entrada_ligar(false)");
  return { vis, semAprovacao, aprovada: aprovada.v, listado };
}, (r) => r.vis === false && r.semAprovacao === false && r.aprovada === null && r.listado === true);
await recusa("resposta não escolhe não listado (segue a conversa)", () => publicar("bia", { texto: "x", resposta_a: idNL, nao_listado: true }), "invalido:publico");
await recusa("nao_listado precisa ser verdadeiro ou falso", () => publicar("ana", { texto: "x", nao_listado: "sim" }), "invalido:nao_listado");

// ═══════════════════ 5. Arquivar ═══════════════════
await zerar();
const comum = await publicar("ana", { texto: "Um post comum para arquivar", publico: "membros" });
await espera("antes de arquivar, duda vê", () => veNoBanco(comum.id, "duda"), (v) => v === true);
await recusa("só a autora arquiva", () => rpc(como(P.duda), "rede_pub_arquivar", { p_post: comum.id, p_sim: true }), "nao_encontrado");
await espera("a autora arquiva", () => rpc(como(P.ana), "rede_pub_arquivar", { p_post: comum.id, p_sim: true }), (r) => r.arquivado === true);
await espera("arquivado: ninguém mais vê (nem pelo link)", async () => [await veNoBanco(comum.id, "duda"), await veNoBanco(comum.id, "bia"), await veNoBanco(comum.id, null)], (v) => v.every((x) => x === false));
await espera("arquivado: a autora vê pelo link, mas ele sai da linha dela também", async () => [await veNoBanco(comum.id, "ana"), (await linha("ana")).includes(comum.id)], (v) => v[0] === true && v[1] === false);
await espera("arquivado: está nos arquivados da autora (e só nos dela)", async () => {
  const a = await rpc(como(P.ana), "rede_pub_arquivados", {});
  const d = await rpc(como(P.duda), "rede_pub_arquivados", {});
  return { a: a.itens.map((x) => x.id), d: d.itens.length, quando: a.itens[0]?.arquivado_em };
}, (r) => r.a.includes(comum.id) && r.d === 0 && Boolean(r.quando));
await espera("arquivado sai do Fediverso para sempre (marca que não volta)", () => um("select fora_do_fediverso as f, interno.rede_vida_federa(p) as pode from interno.rede_posts p where id = $1", [comum.id]), (r) => r.f === true && r.pode === false);
await espera("desarquivar: volta para quem via", async () => {
  await rpc(como(P.ana), "rede_pub_arquivar", { p_post: comum.id, p_sim: false });
  return [await veNoBanco(comum.id, "duda"), (await linha("duda")).includes(comum.id)];
}, (v) => v[0] === true && v[1] === true);
await espera("desarquivado continua fora do Fediverso", () => um("select interno.rede_vida_federa(p) as pode from interno.rede_posts p where id = $1", [comum.id]), (r) => r.pode === false);

// ═══════════════════ 6. Some sozinho ═══════════════════
await zerar();
await recusa("prazo fora da lista: recusa", () => publicar("ana", { texto: "x", some_em: "3d" }), "invalido:some_em");
const efemero = await espera("publica para sumir em 24 h", () => publicar("ana", { texto: "Some amanhã", publico: "membros", some_em: "24h" }),
  (r) => r?.expira_em && Math.abs(new Date(r.expira_em).getTime() - Date.now() - 24 * 3600e3) < 120e3);
const semana = await espera("publica para sumir em 7 dias", () => publicar("ana", { texto: "Some na semana que vem", publico: "membros", some_em: "7d" }),
  (r) => r?.expira_em && Math.abs(new Date(r.expira_em).getTime() - Date.now() - 7 * 24 * 3600e3) < 120e3);
await espera("o que some sozinho nunca sai no Fediverso", () => um("select interno.rede_vida_federa(p) as pode from interno.rede_posts p where id = $1", [efemero.id]), (r) => r.pode === false);
await espera("todos que veem o post sabem quando ele some (rede_pub_vida)", () => rpc(como(P.duda), "rede_pub_vida", { p_ids: [efemero.id] }), (r) => Boolean(r[efemero.id]?.expira_em));
// Uma imagem no post que vai sumir e uma resposta de outra pessoa em outro.
const caminho = `${P.ana}/${crypto.randomUUID()}.jpg`;
await dono("insert into interno.rede_midia (post, caminho, tipo) values ($1, $2, 'image/jpeg')", [efemero.id, caminho]);
const respostaDeOutra = await rpc(como(P.duda), "rede_publicar", { p: { texto: "Vou guardar isso", resposta_a: semana.id } });
await dono("insert into interno.rede_post_edicoes (post, texto_anterior) values ($1, 'versão de antes')", [semana.id]);
await espera("vencido: ninguém mais vê, antes mesmo da faxina", async () => {
  await dono("update interno.rede_posts set expira_em = now() - interval '1 minute' where id in ($1, $2)", [efemero.id, semana.id]);
  return [await veNoBanco(efemero.id, "duda"), await veNoBanco(efemero.id, "bia")];
}, (v) => v.every((x) => x === false));
const rodada = await espera("a rodada do agendador apaga de verdade", () => dono("select interno.rede_vida_rodada() as r").then((r) => r.rows[0].r), (r) => r.apagados >= 1 && r.post_apagado >= 1);
await espera("o post sem resposta sumiu do banco, com a imagem", async () => um("select (select count(*)::int from interno.rede_posts where id = $1) as p, (select count(*)::int from interno.rede_midia where post = $1) as m", [efemero.id]), (r) => r.p === 0 && r.m === 0);
await espera("a imagem foi para a fila de arquivos do depósito (o servidor apaga pela API)", () => um("select count(*)::int as n from interno.alumia_arquivos_a_apagar where deposito = 'rede-midia' and caminho = $1", [caminho]), (r) => r.n === 1);
await espera("o post que outra pessoa respondeu ficou como [post apagado]: sem autora, sem texto, sem histórico", () => um(`select autor, texto, oculto, expira_em,
  (select count(*)::int from interno.rede_post_edicoes e where e.post = p.id) as hist from interno.rede_posts p where id = $1`, [semana.id]),
(r) => r.autor === null && r.texto === "[post apagado]" && r.oculto === true && r.expira_em === null && r.hist === 0);
await espera("a resposta da outra pessoa continua lá, dela", () => um("select autor, texto from interno.rede_posts where id = $1", [respostaDeOutra.id]), (r) => r.autor === P.duda && r.texto === "Vou guardar isso");
await espera("a rodada seguinte não acha mais nada (o [post apagado] não volta à fila)", () => dono("select interno.rede_vida_rodada() as r").then((r) => r.rows[0].r), (r) => r.apagados === 0 && r.post_apagado === 0);
void rodada;

// ═══════════════════ 7. Apagar depois de X semanas ═══════════════════
await zerar();
await espera("começa desligado", () => rpc(como(P.eli), "rede_pub_vida_conta"), (r) => r.semanas === null);
await recusa("semanas fora da lista: recusa", () => rpc(como(P.eli), "rede_pub_vida_conta_mudar", { p_semanas: 3 }), "invalido:semanas");
const velho = await rpc(como(P.eli), "rede_pub_vida_publicar", { p: { texto: "Post velho da Eli", publico: "membros" } });
const novo = await rpc(como(P.eli), "rede_pub_vida_publicar", { p: { texto: "Post novo da Eli", publico: "membros" } });
const deAna = await publicar("ana", { texto: "Post velho da Ana", publico: "membros" });
await dono("update interno.rede_posts set criado_em = now() - interval '5 weeks' where id in ($1, $2)", [velho.id, deAna.id]);
await espera("a prévia diz quantos posts meus sairiam (só os meus)", () => rpc(como(P.eli), "rede_pub_vida_conta_previa", { p_semanas: 4 }), (r) => r.posts === 1 && r.semanas === 4);
await espera("liga com 4 semanas", () => rpc(como(P.eli), "rede_pub_vida_conta_mudar", { p_semanas: 4 }), (r) => r.semanas === 4);
await espera("a rodada apaga o velho da Eli e deixa o novo (e o velho de quem não ligou)", async () => {
  await dono("select interno.rede_vida_rodada()");
  return um("select (select count(*)::int from interno.rede_posts where id = $1) as velho, (select count(*)::int from interno.rede_posts where id = $2) as novo, (select count(*)::int from interno.rede_posts where id = $3) as ana", [velho.id, novo.id, deAna.id]);
}, (r) => r.velho === 0 && r.novo === 1 && r.ana === 1);
await espera("desliga (0)", () => rpc(como(P.eli), "rede_pub_vida_conta_mudar", { p_semanas: 0 }), (r) => r.semanas === null);
await espera("desligado, não sobra linha da escolha", () => um("select count(*)::int as n from interno.rede_vida_conta where usuario = $1", [P.eli]), (r) => r.n === 0);

// ═══════════════════ 8. A porta da entrada ═══════════════════
await espera("com a trava ligada, conta sem aprovação não chama nenhuma função nova", async () => {
  await dono("select interno.alumia_entrada_ligar(true)");
  const erros = [];
  for (const [f, a] of [["rede_pub_vida_publicar", { p: { texto: "x" } }], ["rede_pub_arquivar", { p_post: comum.id, p_sim: true }], ["rede_pub_arquivados", {}],
    ["rede_pub_vida", { p_ids: [comum.id] }], ["rede_pub_vida_conta", {}], ["rede_pub_vida_conta_previa", { p_semanas: 4 }], ["rede_pub_vida_conta_mudar", { p_semanas: 4 }]]) {
    try {
      await rpc(como(P.caio), f, a);
      erros.push(`${f} passou`);
    } catch (e) {
      erros.push(String(e.message));
    }
  }
  await dono("select interno.alumia_entrada_ligar(false)");
  return erros;
}, (es) => es.length === 7 && es.every((e) => e.includes("alumia_entrada")));

// A federação ligada (achado da revisão): até a Faixa 2 compor interno.rede_vida_federa, não listado e some sozinho ficam recusados
// para quem sai no Fediverso, porque o post sairia como público e ficaria copiado do lado de lá.
await zerar();
await dono("insert into interno.rede_fed_atores (perfil, handle, ligado, consentimento_versao, ligado_em) values ($1, 'pessoa_duda', true, 2, now()) on conflict (perfil) do update set ligado = true", [P.duda]);
// Quando a federação já compõe a vida do post (20261120-alumia-o14-banco.sql, ou a migração da Faixa 2), publicar aceita e o post
// fica fora do Fediverso.
const composta = (await um("select position('rede_vida_federa' in prosrc) > 0 as c from pg_proc where oid = to_regprocedure('interno.rede_fed_federavel(interno.rede_posts, integer)')"))?.c === true;
for (const [nome, pedido] of [["não listado", { texto: "Não listado com federação", publico: "membros", nao_listado: true }], ["some sozinho", { texto: "Some com federação", publico: "membros", some_em: "24h" }]]) {
  if (!composta) await recusa(`com a federação ligada, ${nome} é recusado`, () => publicar("duda", pedido), "vida_federacao");
  else await espera(`com a federação compondo a vida do post, ${nome} é aceito e não sai no Fediverso`, async () => {
    const r = await publicar("duda", pedido);
    return (await um("select interno.rede_fed_federavel(p, 0) as f from interno.rede_posts p where p.id = $1", [r.id])).f;
  }, (f) => f === false);
}
await espera("com a federação ligada, a roda continua (nunca sai no Fediverso)", async () => {
  await dono("insert into interno.rede_roda (dono, membro) values ($1, $2) on conflict do nothing", [P.duda, P.ana]);
  return publicar("duda", { texto: "Para a roda com federação", publico: "roda" });
}, (r) => typeof r?.id === "string");
await espera("desligada a federação, não listado volta a valer", async () => {
  await dono("update interno.rede_fed_atores set ligado = false where perfil = $1", [P.duda]);
  return publicar("duda", { texto: "Não listado sem federação", publico: "membros", nao_listado: true });
}, (r) => r?.nao_listado === true);
await banco.pg.close();

// ═══════════════════ 9. Peças puras, textos e telas ═══════════════════
const V = await import("../lib/rede/publicar/vida.ts");
const { TERMOS_OFENSIVOS } = await import("../lib/rede/publicar/termos-ofensivos.ts");

// O prazo para sumir.
const T0 = Date.parse("2026-11-15T12:00:00Z");
const em = (ms) => new Date(T0 + ms).toISOString();
ok("tempoAteSumir: minutos, horas e dias", (() => {
  const a = V.tempoAteSumir(em(25 * 60e3), T0), b = V.tempoAteSumir(em(5 * 3600e3 + 59 * 60e3), T0), c = V.tempoAteSumir(em(6 * 24 * 3600e3 + 3600e3), T0);
  return a.unidade === "min" && a.n === 25 && b.unidade === "h" && b.n === 5 && c.unidade === "d" && c.n === 6;
})());
ok("tempoAteSumir: vencido, sem prazo ou data ruim dão nulo", V.tempoAteSumir(em(-1), T0) === null && V.tempoAteSumir(null, T0) === null && V.tempoAteSumir("x", T0) === null);
ok("tempoAteSumir: 47 h ainda é horas, 48 h vira 2 dias", V.tempoAteSumir(em(47 * 3600e3), T0).unidade === "h" && V.tempoAteSumir(em(48 * 3600e3), T0).n === 2);
ok("as semanas da conta são as do banco", JSON.stringify(V.SEMANAS_DA_CONTA) === "[1,2,4,8,12,26,52]" && /semanas in \(1, 2, 4, 8, 12, 26, 52\)/.test(sql)
  && V.semanasValidas(4) && !V.semanasValidas(3) && !V.semanasValidas("4"));
ok("os prazos para sumir são os do banco", JSON.stringify(V.PRAZOS_PARA_SUMIR) === '["24h","7d"]' && /v_some not in \('24h', '7d'\)/.test(sql));

// O aviso antes de publicar ofensa: palavra inteira, sem acento, com as trocas de letra, nunca dentro de outra palavra.
ok("acha o termo mesmo com acento trocado, maiúscula, número e letra repetida", (() => {
  const r = V.termosNoTexto("Esse cara é um IMB3CIL, um otáriooo e um v1ad0");
  return r.includes("imbecil") && r.includes("otário") && r.includes("viado");
})());
ok("não acha dentro de outra palavra (bichano, computador, vermelho, putativo)", V.termosNoTexto("O bichano sentou no computador vermelho do pai putativo").length === 0);
ok("acha expressão de mais de uma palavra", V.termosNoTexto("cala a boca, filho da puta").includes("filho da puta"));
ok("texto vazio não acha nada", V.termosNoTexto("   ").length === 0);
ok("a lista não repete termo e todo termo casa consigo mesmo", new Set(TERMOS_OFENSIVOS).size === TERMOS_OFENSIVOS.length && TERMOS_OFENSIVOS.every((t) => V.termosNoTexto(t).includes(t)));
ok("normalizar: espaço nas pontas, só letras", V.normalizarParaAviso("Ação! 4 m@is") === " acao a mais ");

// Leia antes de repostar.
ok("primeiroLink acha o link e tira a pontuação do fim", V.primeiroLink("leiam https://exemplo.org/materia-1. Urgente!") === "https://exemplo.org/materia-1" && V.primeiroLink("sem link") === null);
ok("chaveDoLink: barra no fim, www, # e maiúscula no domínio não mudam o link", V.chaveDoLink("https://www.Exemplo.org/a/") === V.chaveDoLink("https://exemplo.org/a#parte")
  && V.chaveDoLink("https://exemplo.org/a?x=1") !== V.chaveDoLink("https://exemplo.org/a") && V.chaveDoLink("javascript:alert(1)") === null && V.chaveDoLink("nada") === null);
ok("perguntar só com link, ligado e não aberto", V.perguntarAntesDeRepostar("https://exemplo.org/a", true, () => false)
  && !V.perguntarAntesDeRepostar("https://exemplo.org/a", true, () => true) && !V.perguntarAntesDeRepostar("https://exemplo.org/a", false, () => false)
  && !V.perguntarAntesDeRepostar(null, true, () => false));
ok("as escolhas do aparelho valem ligadas quando não há armazenamento (Node)", V.avisoDeOfensaLigado() === true && V.leiaAntesLigado() === true);

// Os seis idiomas.
const chavesDe = (v, p = "", s = new Map()) => {
  if (Array.isArray(v)) { s.set(p, `lista:${v.length}`); v.forEach((x, i) => chavesDe(x, `${p}[${i}]`, s)); }
  else if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) chavesDe(f, p ? `${p}.${k}` : k, s);
  else s.set(p, typeof v === "string" && v.trim() ? "texto" : "vazio");
  return s;
};
const marcas = (t) => (typeof t === "string" ? (t.match(/\{\w+\}/g) ?? []).sort().join() : "");
const pegar = (o, k) => k.split(/\.|\[|\]/).filter(Boolean).reduce((x, c) => x?.[c], o);
const textos = Object.fromEntries(["pt", "en", "es", "fr", "ru", "zh"].map((l) => [l, JSON.parse(ler(`i18n/rede/publicar/vida/${l}.json`))]));
const refer = chavesDe(textos.pt);
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const atual = chavesDe(textos[l]);
  ok(`textos em ${l}: as mesmas chaves do português, nenhuma vazia`, refer.size === atual.size && [...refer].every(([k, tipo]) => atual.get(k) === tipo));
  ok(`textos em ${l}: os mesmos {marcadores}`, [...refer.keys()].every((k) => marcas(pegar(textos.pt, k)) === marcas(pegar(textos[l], k))));
}
ok("o erro da federação ligada tem texto", Boolean(textos.pt.erros.vida_federacao));

ok("texto de tela novo sem palavra proibida", !/diploma|universidade|algoritmo/i.test(JSON.stringify(textos.pt)));
ok("todo erro do banco desta frente tem texto", ["roda_vazia", "invalido_some_em", "invalido_nao_listado", "invalido_semanas", "invalido_publico"].every((k) => textos.pt.erros[k]));
ok("os erros do chaveiro de grupo (P21) já têm texto", Boolean(textos.pt.cifra.grupo_suspeito && textos.pt.cifra.sem_chave && textos.pt.cifra.naoAbre));
ok("o título da seção nos Ajustes é o mesmo dos textos, nos seis idiomas", (() => {
  const enc = ler("components/rede/publicar/encaixe.tsx");
  return ["pt", "en", "es", "fr", "ru", "zh"].every((l) => enc.includes(`${l}: "${textos[l].ajustes.titulo}"`));
})());

// As telas.
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
const cartao = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
ok("o Escrever continua publicando pelo rede_pub_publicar_mais quando não há escolha da vida", escrever.includes("redePub.publicarMais(") && escrever.includes(": await publicarComB1(pedido)"));
ok("com roda, não listado ou prazo, só pelo rede_pub_vida_publicar (sem cair num caminho mais aberto)", /comVida\s*\? await redePub\.publicarComVida\(/.test(escrever) && /comVida && vt && faltaNoBanco\(e\)/.test(escrever));
ok("agendado com escolha da vida não sai (o agendador não leva as escolhas)", /comVida && \(pub\.agendar \|\| pub\.aposAto\)/.test(escrever));
ok("o aviso de ofensa só avisa: o segundo toque publica", /ofensaAvisada !== normalizarParaAviso\(oQueVai\)/.test(escrever) && !/bloqueia: true/.test(escrever));
ok("a roda não aparece em comunidade nem no ato", /const comRoda = !lugar && tipo !== "ato"/.test(escrever));
ok("o \"em breve\" da roda saiu do Escrever", !escrever.includes("rodaEmBreve"));
ok("o cartão pergunta antes de repostar link não aberto e marca o link aberto ao clicar", cartao.includes("void pedirRepostar()") && cartao.includes("onClickCapture={(e) => marcarLinkAberto(e.target)}"));
ok("Arquivar só no post da própria pessoa", /\{post\.meu && vt && \(\s*<ArquivarNoMenu/.test(cartao));
const vidaTelas = ["components/rede/publicar/vida/NoCartao.tsx", "components/rede/publicar/vida/RodaNoEscrever.tsx", "components/rede/publicar/vida/AjustesDaVida.tsx", "lib/rede/publicar/vida.ts"].map(ler).join("\n");
ok("as telas novas não buscam nada de fora (sem fetch, sem endereço http fixo)", !/\bfetch\(|https?:\/\/(?!exemplo)/.test(vidaTelas));
ok("as telas novas não usam cor literal (só os tokens da Alumia)", !/#[0-9a-fA-F]{3,6}\b|rgb\(/.test(vidaTelas));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`público e vida do post (onda 9, 9D): ${certos} conferências certas`);
