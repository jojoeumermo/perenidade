// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o back-end mínimo da F1 da Alumia (supabase/migracoes/20261109-alumia-f1.sql) num Postgres de verdade (banco local, sem
// rede): Repostar, rascunho na conta, desfazer envio e emblemas, com a matriz visitante / membro / dono / bloqueado. Também que
// nada é lido direto das tabelas (RLS e nenhuma permissão para anon/authenticated) e que a migração roda duas vezes.
// O teste das telas e das regras puras é o scripts/testar-alumia-f1.mjs.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-f1-banco.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ler = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const f0 = ler("supabase/migracoes/20261109-alumia-f0-contrato.sql");
const f1 = ler("supabase/migracoes/20261109-alumia-f1.sql");
await espera("a F1 está colada no install.sql (o integrador colou)", async () => ler("supabase/install.sql").includes("Alumia · Onda 5 · F1"), (v) => v === true);

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
// A F0 já pode estar no install.sql (depois da integração); rodar de novo não estraga (é idempotente).
await espera("a F0 instala", () => banco.exclusivo(() => banco.pg.exec(f0)));
await espera("a F1 instala sobre a F0", () => banco.exclusivo(() => banco.pg.exec(f1)));
await espera("e instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(f1)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

const p = {};
const nomes = ["autora", "membro", "seguidor", "bloqueado", "semconsent"];
for (const [i, nome] of nomes.entries()) {
  p[nome] = await criarUsuario(`${nome}@f1.local`, nome);
  await rpc(como(p[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [p[nome], `Pessoa ${i + 1}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [p[nome]]);
for (const nome of nomes.filter((n) => n !== "semconsent")) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [p[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.rede_niveis set imagens = 4, links = 50, posts_dia = 5000").catch(() => undefined);
// O seguidor segue o membro (é pela conta do membro que o repost chega a ele); a autora bloqueou "bloqueado".
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [p.seguidor, p.membro]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [p.autora, p.bloqueado]);
const zerar = () => dono("delete from interno.limites");
const publicar = (quem, pedido) => rpc(como(p[quem]), "rede_publicar", { p: pedido });

const post = await publicar("autora", { texto: "Assembleia da ocupação na quinta, 19h. Tragam a vizinhança.", publico: "membros" });
const soSeguidores = await publicar("autora", { texto: "Recado só para quem me segue.", publico: "seguidores" });
const resposta = await publicar("membro", { texto: "Vou levar a faixa.", resposta_a: post.id });
await espera("os posts de teste existem", async () => [post.id, soSeguidores.id, resposta.id].every((x) => /^[0-9a-f-]{36}$/.test(x)));

// ═══════════════════ Tabelas: nada direto ═══════════════════
for (const tabela of ["rede_repostagens", "rede_rascunhos"]) {
  await espera(`${tabela}: RLS ligada`, async () => (await um("select relrowsecurity as r from pg_class where oid = $1::regclass", [`interno.${tabela}`])).r, (r) => r === true);
  await espera(`${tabela}: nenhuma permissão para anon/authenticated`, async () =>
    (await um(`select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and table_name = $1 and grantee in ('anon', 'authenticated', 'PUBLIC')`, [tabela])).n, (n) => n === 0);
}
await espera("as funções públicas novas são security definer com search_path fixo", async () =>
  (await dono(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rede_pub_repostar', 'rede_pub_repostados', 'rede_pub_repostes', 'rede_pub_rascunho_salvar', 'rede_pub_rascunhos', 'rede_pub_rascunho_apagar', 'rede_pub_desfazer', 'rede_alumia_emblemas')`)).rows,
(rs) => rs.length === 8 && rs.every((r) => r.prosecdef && r.cfg.includes("search_path=interno, pg_temp")));

// ═══════════════════ Repostar ═══════════════════
const repostar = (quem, id, sim = true) => rpc(como(p[quem]), "rede_pub_repostar", { p_post: id, p_sim: sim });
await recusa("visitante não reposta", () => rpc(visitante(), "rede_pub_repostar", { p_post: post.id, p_sim: true }), "permission denied");
await recusa("sem consentimento não reposta", () => repostar("semconsent", post.id), "consentimento");
await recusa("a dona não reposta o próprio post", () => repostar("autora", post.id), "sem_permissao");
await recusa("bloqueado pela autora não vê, logo não reposta", () => repostar("bloqueado", post.id), "nao_encontrado");
await recusa("post para seguidores não se reposta (nem quem pode ver)", () => repostar("seguidor", soSeguidores.id), "nao_encontrado");
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [p.membro, p.autora]);
await recusa("quem segue a autora vê o post só de seguidores, mas não espalha", () => repostar("membro", soSeguidores.id), "sem_permissao");
await recusa("resposta não se reposta (fora da conversa perde o sentido)", () => repostar("seguidor", resposta.id), "sem_permissao");
await recusa("post inexistente", () => repostar("membro", crypto.randomUUID()), "nao_encontrado");
await espera("membro reposta", () => repostar("membro", post.id), (r) => r.repostei === true);
await espera("repostar de novo não duplica", () => repostar("membro", post.id), (r) => r.repostei === true);
await espera("uma linha só no banco", async () => (await um("select count(*)::int as n from interno.rede_repostagens where post = $1", [post.id])).n, (n) => n === 1);
await espera("repostados: o membro vê só o próprio estado", () => rpc(como(p.membro), "rede_pub_repostados", { p_ids: [post.id, soSeguidores.id] }), (r) => JSON.stringify(r) === JSON.stringify([post.id]));
await espera("repostados: outra pessoa não vê o repost do membro", () => rpc(como(p.seguidor), "rede_pub_repostados", { p_ids: [post.id] }), (r) => Array.isArray(r) && r.length === 0);
await recusa("repostados: visitante não chama", () => rpc(visitante(), "rede_pub_repostados", { p_ids: [post.id] }), "permission denied");

const repostes = (quem, args = {}) => rpc(como(p[quem]), "rede_pub_repostes", { p_ate: null, p_desde: null, p_limite: 20, ...args });
await espera("quem segue o membro recebe o post repostado, sem dizer quem repostou", () => repostes("seguidor"), (r) =>
  r.length === 1 && r[0].id === post.id && typeof r[0].repostado_em === "string" && !JSON.stringify(r[0]).includes(p.membro) && !("repostou" in r[0]) && !("repostes" in r[0]));
await espera("quem não segue ninguém que repostou não recebe nada", () => repostes("autora"), (r) => r.length === 0);
await espera("a janela de tempo filtra (antes do repost: nada)", () => repostes("seguidor", { p_ate: "2000-01-01T00:00:00Z" }), (r) => r.length === 0);
await recusa("repostes: visitante não chama", () => rpc(visitante(), "rede_pub_repostes", { p_ate: null, p_desde: null, p_limite: 20 }), "permission denied");
await espera("seguidor silencia a autora: o repost some da linha dele", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [p.seguidor, p.autora]);
  const r = await repostes("seguidor");
  await dono("delete from interno.rede_silenciados where usuario = $1", [p.seguidor]);
  return r.length;
}, (n) => n === 0);
await espera("o seguidor que a autora bloqueou não recebe o repost", async () => {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [p.bloqueado, p.membro]);
  return (await repostes("bloqueado")).length;
}, (n) => n === 0);
await espera("quem reposta e foi suspensa some da linha dos outros", async () => {
  await dono("update interno.perfis set suspenso = true where id = $1", [p.membro]);
  const r = await repostes("seguidor");
  await dono("update interno.perfis set suspenso = false where id = $1", [p.membro]);
  return r.length;
}, (n) => n === 0);
await espera("post retido pela moderação some da linha de repostes", async () => {
  await dono("update interno.rede_posts set retido = true where id = $1", [post.id]);
  const r = await repostes("seguidor");
  await dono("update interno.rede_posts set retido = false where id = $1", [post.id]);
  return r.length;
}, (n) => n === 0);
await espera("desfazer o repost apaga a linha (não marca)", () => repostar("membro", post.id, false), (r) => r.repostei === false);
await espera("e o repost sai da linha de quem segue", () => repostes("seguidor"), (r) => r.length === 0);
await espera("desfazer vale mesmo se o post sumiu", async () => {
  await repostar("membro", post.id);
  await dono("update interno.rede_posts set oculto = true where id = $1", [post.id]);
  const r = await repostar("membro", post.id, false);
  await dono("update interno.rede_posts set oculto = false where id = $1", [post.id]);
  return r;
}, (r) => r.repostei === false);
await espera("o limite de uso vale (120 por hora)", async () => {
  await zerar();
  let erro = "";
  for (let i = 0; i < 125 && !erro; i++) {
    try {
      await repostar("membro", post.id, i % 2 === 0);
    } catch (e) {
      erro = String(e.message);
    }
  }
  await zerar();
  return erro;
}, (e) => e.includes("muitos_pedidos"));

// ═══════════════════ Rascunho na conta ═══════════════════
const salvar = (quem, r) => rpc(como(p[quem]), "rede_pub_rascunho_salvar", { p: r });
const lista = (quem) => rpc(como(p[quem]), "rede_pub_rascunhos");
const apagar = (quem, id) => rpc(como(p[quem]), "rede_pub_rascunho_apagar", { p_id: id });
const base = { id: null, tipo: "post", texto: "Rascunho da chamada", titulo: "", corpo: "", comunidade: null, publico: "membros", responde_quem: "todos" };
await recusa("visitante não guarda rascunho", () => rpc(visitante(), "rede_pub_rascunho_salvar", { p: base }), "permission denied");
await recusa("visitante não lista rascunho", () => rpc(visitante(), "rede_pub_rascunhos"), "permission denied");
await recusa("sem consentimento não guarda", () => salvar("semconsent", base), "consentimento");
const r1 = await salvar("autora", { ...base, extra: "não fica", arquivo: "data:image/png;base64,AAAA" });
await espera("a dona guarda e recebe o id", async () => r1, (r) => /^[0-9a-f-]{36}$/.test(r.id) && typeof r.atualizado_em === "string");
await espera("só as chaves conhecidas ficam (nada de arquivo)", async () => (await um("select pedido from interno.rede_rascunhos where id = $1", [r1.id])).pedido, (x) => !("extra" in x) && !("arquivo" in x) && x.texto === "Rascunho da chamada");
await espera("atualizar pelo id não cria outro", async () => {
  const r = await salvar("autora", { ...base, id: r1.id, texto: "Rascunho da chamada, revisto" });
  return [r.id, (await lista("autora")).length];
}, ([id, n]) => id === r1.id && n === 1);
await espera("a lista da dona traz o texto novo", () => lista("autora"), (l) => l[0].id === r1.id && l[0].texto === "Rascunho da chamada, revisto" && l[0].publico === "membros");
await espera("outra pessoa não vê os rascunhos da dona", () => lista("membro"), (l) => Array.isArray(l) && l.length === 0);
await espera("outra pessoa que usa o id da dona cria um rascunho DELA, sem tocar no da dona", async () => {
  const r = await salvar("membro", { ...base, id: r1.id, texto: "tentativa" });
  const daDona = (await lista("autora"))[0];
  return [r.id !== r1.id, daDona.texto];
}, ([outro, texto]) => outro && texto === "Rascunho da chamada, revisto");
await espera("outra pessoa não apaga o rascunho da dona", () => apagar("membro", r1.id), (r) => r.apagado === false);
await espera("o bloqueado também não", () => apagar("bloqueado", r1.id), (r) => r.apagado === false);
await recusa("visitante não apaga", () => rpc(visitante(), "rede_pub_rascunho_apagar", { p_id: r1.id }), "permission denied");
await recusa("rascunho vazio não vai", () => salvar("autora", { ...base, texto: "   " }), "invalido:vazio");
await recusa("tipo inventado não vai", () => salvar("autora", { ...base, tipo: "qualquer" }), "invalido:tipo");
await recusa("público inventado não vai", () => salvar("autora", { ...base, publico: "todo-mundo" }), "invalido:publico");
await recusa("comunidade fora do formato não vai", () => salvar("autora", { ...base, comunidade: "../x" }), "invalido:comunidade");
await recusa("texto grande demais não vai", () => salvar("autora", { ...base, texto: "a".repeat(2001) }), "invalido:tamanho");
await espera("id quebrado vira rascunho novo (sem erro de banco)", () => salvar("autora", { ...base, id: "não-é-uuid", texto: "segundo" }), (r) => /^[0-9a-f-]{36}$/.test(r.id) && r.id !== r1.id);
await espera("até 20 por pessoa; o 21º é recusado com limite_rascunhos", async () => {
  await zerar();
  const atuais = (await lista("autora")).length;
  for (let i = atuais; i < 20; i++) await salvar("autora", { ...base, texto: `rascunho ${i}` });
  try {
    await salvar("autora", { ...base, texto: "o vigésimo primeiro" });
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("limite_rascunhos"));
await espera("a lista para em 20", () => lista("autora"), (l) => l.length === 20);
await espera("rascunho com mais de 30 dias some (e abre vaga)", async () => {
  await dono("update interno.rede_rascunhos set atualizado_em = now() - interval '31 days' where id = $1", [r1.id]);
  const l = await lista("autora");
  const ainda = (await um("select count(*)::int as n from interno.rede_rascunhos where id = $1", [r1.id])).n;
  const novo = await salvar("autora", { ...base, texto: "cabe de novo" });
  return [l.length, ainda, Boolean(novo.id)];
}, ([n, ainda, ok]) => n === 19 && ainda === 0 && ok);
await espera("a faxina geral apaga os velhos de todo mundo", async () => {
  await dono("update interno.rede_rascunhos set atualizado_em = now() - interval '40 days' where autor = $1", [p.membro]);
  await dono("select interno.rede_rascunhos_faxina()");
  return (await um("select count(*)::int as n from interno.rede_rascunhos where autor = $1", [p.membro])).n;
}, (n) => n === 0);
await espera("a dona apaga o próprio", async () => {
  const [primeiro] = await lista("autora");
  return apagar("autora", primeiro.id);
}, (r) => r.apagado === true);

// ═══════════════════ Desfazer envio ═══════════════════
await zerar();
const desfazer = (quem, id) => rpc(como(p[quem]), "rede_pub_desfazer", { p_post: id });
const recente = await publicar("autora", { texto: "Ops, saiu sem querer.", publico: "membros" });
await recusa("visitante não desfaz", () => rpc(visitante(), "rede_pub_desfazer", { p_post: recente.id }), "permission denied");
await recusa("outra pessoa não desfaz o post da autora", () => desfazer("membro", recente.id), "nao_encontrado");
await recusa("o bloqueado também não", () => desfazer("bloqueado", recente.id), "nao_encontrado");
await espera("a autora desfaz nos primeiros segundos: o post some de vez", async () => {
  const r = await desfazer("autora", recente.id);
  return [r.desfeito, (await um("select count(*)::int as n from interno.rede_posts where id = $1", [recente.id])).n];
}, ([d, n]) => d === true && n === 0);
const velho = await publicar("autora", { texto: "Esse já tem tempo.", publico: "membros" });
await dono("update interno.rede_posts set criado_em = now() - interval '2 minutes' where id = $1", [velho.id]);
await recusa("depois de 30 s não desfaz (aí é apagar)", () => desfazer("autora", velho.id), "prazo_passou");
const segurado = await publicar("autora", { texto: "Post que a triagem segurou.", publico: "membros" });
await dono("update interno.rede_posts set retido = true, avaliacao = 'revisao' where id = $1", [segurado.id]);
await recusa("o que a triagem segurou não se desfaz (a moderação precisa ver)", () => desfazer("autora", segurado.id), "sem_permissao");
const comResposta = await publicar("autora", { texto: "Alguém já respondeu.", publico: "membros" });
await dono("insert into interno.rede_posts (autor, texto, resposta_a, tipo, publico) values ($1, 'respondi rápido', $2, 'post', 'membros')", [p.membro, comResposta.id]);
await recusa("com resposta de outra pessoa não se desfaz (apagaria a dela)", () => desfazer("autora", comResposta.id), "sem_permissao");

// ═══════════════════ Emblemas ═══════════════════
await zerar();
const emblemas = (quem) => rpc(como(p[quem]), "rede_alumia_emblemas");
await recusa("visitante não chama os emblemas", () => rpc(visitante(), "rede_alumia_emblemas"), "permission denied");
await espera("sem consentimento: tudo zero", () => emblemas("semconsent"), (e) => e.avisos === 0 && e.conversas === 0 && e.atos === 0);
await espera("emblemas trazem só números da própria pessoa", () => emblemas("autora"), (e) => Object.keys(e).sort().join() === "atos,avisos,conversas" && Object.values(e).every((n) => Number.isInteger(n) && n >= 0));
await espera("avisos: a mesma conta do rede_aviso_contar", async () => [(await emblemas("autora")).avisos, await rpc(como(p.autora), "rede_aviso_contar")], ([a, b]) => a === b);
await espera("conversas: um pedido esperando conta 1 para quem recebeu e 0 para quem pediu", async () => {
  const [a, b] = [p.autora, p.membro].sort();
  await dono("insert into interno.rede_dm_conversas (a, b, pediu) values ($1, $2, $3)", [a, b, p.membro]);
  return [(await emblemas("autora")).conversas, (await emblemas("membro")).conversas];
}, ([recebeu, pediu]) => recebeu === 1 && pediu === 0);
await espera("atos: o chamado que confirmei e ainda vai acontecer conta; o passado não", async () => {
  const futuro = await um("insert into interno.rede_posts (autor, texto, chamado) values ($1, 'ato', $2) returning id", [p.autora, JSON.stringify({ quando: new Date(Date.now() + 86400000).toISOString(), onde: "praça" })]);
  const passado = await um("insert into interno.rede_posts (autor, texto, chamado) values ($1, 'ato velho', $2) returning id", [p.autora, JSON.stringify({ quando: "2020-01-01T10:00:00Z", onde: "praça" })]);
  const quebrado = await um("insert into interno.rede_posts (autor, texto, chamado) values ($1, 'ato sem data', $2) returning id", [p.autora, JSON.stringify({ quando: "amanhã cedo" })]);
  for (const x of [futuro, passado, quebrado]) await dono("insert into interno.rede_vou (post, usuario) values ($1, $2)", [x.id, p.seguidor]);
  return [(await emblemas("seguidor")).atos, (await emblemas("membro")).atos];
}, ([meu, outro]) => meu === 1 && outro === 0);

// ═══════════════════ Fim ═══════════════════
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s) (${certos} certas):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ Alumia F1 no banco: ${certos} verificações certas.`);
process.exit(0);
