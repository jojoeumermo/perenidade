// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o banco do modo total do Fediverso (supabase/migracoes/20261109-fediverso-total.sql, PLANO-FEDIVERSO.md, frente F3), num
// Postgres local (scripts/banco-local.mjs): o bloco no fim do install.sql idêntico à migração, rodar duas vezes sem erro, tudo
// desligado por padrão (nada muda), o modo total liga quem aceitou o item do consentimento, o que pode e o que não pode sair
// (núcleo, fechada, restrita, equipe, só-seguidores nunca), nota de fora que responde ou menciona alguém daqui guardada, direto
// nunca guardado, curtida e impulso de fora viram aviso e somem com o Undo, a linha mista sem quem a pessoa bloqueou ou silenciou,
// curtir/responder/denunciar daqui, Flag e Block de fora, o circuito por domínio, 410 apaga o seguidor, os tipos novos da fila,
// o Group atrás de "fediverso-grupos" e a faxina. Uso: node scripts/testar-fediverso-banco.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = (v) => v !== false) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
const lerTexto = (caminho) => normal(fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8"));

const SEGREDO = "segredo-de-teste-da-federacao-com-mais-de-32-caracteres";
const BASE = "https://alumia.teste";
const ATOR = "https://remota.teste/users/bia";
const ATOR2 = "https://outra.teste/users/caio";
const INSTANCIA = "https://remota.teste/actor";

// ═══════════════════ O bloco e a idempotência ═══════════════════
const migracao = lerTexto("supabase/migracoes/20261109-fediverso-total.sql");
const install = lerTexto("supabase/install.sql");
await espera("o install.sql traz a migração do modo total inteira, idêntica ao arquivo, depois da da Alumia", async () => {
  const i = install.indexOf(migracao);
  return i > 0 && i > install.indexOf(lerTexto("supabase/migracoes/2026-11-alumia.sql"));
});

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
if (!install.includes(migracao)) await espera("a migração instala por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("rodar a migração de novo não quebra (idempotente)", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("e uma terceira vez também", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("nenhuma tabela nova em public; as novas em interno, com RLS e sem permissão direta", async () => {
  if (/create table (if not exists )?public\./i.test(migracao)) throw new Error("tabela em public");
  const r = await dono(`select c.relname, c.relrowsecurity, exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'interno' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated', 'PUBLIC')) as aberta
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and c.relname like 'fediverso\\_%'`);
  // Oito do modo total; a nona (fediverso_consentimentos) vem com a migração da privacidade.
  return r.rows.length >= 8 && r.rows.length <= 9 && r.rows.every((x) => x.relrowsecurity && !x.aberta);
});
await espera("as funções públicas da federação são security definer com search_path = interno, pg_temp", async () => {
  const r = await dono(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'rede_fed_%' or p.proname = 'rede_aderir')`);
  return r.rows.length >= 20 && r.rows.every((x) => x.prosecdef && /search_path=interno, pg_temp/.test(x.cfg));
});
await espera("visitante não chama as RPCs novas da tela", async () => {
  const r = await um(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rede_fed_linha_mista', 'rede_fed_interagir', 'rede_fed_responder_remoto', 'rede_fed_denunciar_remoto', 'rede_fed_perfil_remoto', 'rede_fed_fio_remoto', 'rede_fed_respostas_de')
      and has_function_privilege('anon', p.oid, 'execute')`);
  return r.n;
}, (n) => n === 0);
await espera("nenhuma função interna nova é chamável por anon ou authenticated", async () => {
  const r = await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and (p.proname like 'rede_fed_%' or p.proname like 'rede3_aviso_%') and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`);
  return r.rows.map((x) => x.proname);
}, (l) => l.length === 0);
await espera("nenhuma função do banco escreve 'Rede Lúcia'", async () => (await um(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('interno','public') and p.prosrc like '%Rede Lúcia%'`)).n, (n) => n === 0);
await espera("a fila aceita os tipos novos da seção 3.4 e recusa um inventado", async () => {
  const tipos = ["like", "undo-like", "announce", "undo-announce", "flag", "block", "undo-block", "group-announce", "group-accept"];
  for (const t of tipos) await dono("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino, feito_em) values (null, $1, 'x', 'https://x.teste/inbox', now())", [t]);
  let recusou = false;
  try { await dono("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino) values (null, 'move', 'x', 'https://x.teste/inbox')"); } catch { recusou = true; }
  await dono("delete from interno.rede_fed_fila");
  return recusou;
});

// ═══════════════════ Pessoas, comunidades e o segredo ═══════════════════
let ip = 30;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const anon = { papel: "anon" };
const srv = (acao, p = {}) => rpc(anon, "rede_fed_servidor", { p_segredo: SEGREDO, p_acao: acao, p });
await dono("insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object('segredo_hash', encode(sha256(convert_to($1, 'UTF8')), 'hex'))) on conflict (chave) do update set valor = excluded.valor", [SEGREDO]);
const ligarTotal = (sim) => dono("update interno.configuracoes set valor = valor || jsonb_build_object('total', $1::boolean) where chave = 'fediverso'", [sim]);
const ligarGrupos = (sim) => dono("update interno.configuracoes set valor = valor || jsonb_build_object('grupos', $1::boolean) where chave = 'fediverso'", [sim]);

const pessoas = {};
const vigente = (await um("select coalesce(max(versao), 1)::int as v from interno.rede_regras")).v;
for (const nome of ["ana", "beto", "cris", "duda"]) {
  pessoas[nome] = await criarUsuario(`${nome}@fedbanco.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_modo = 'aberto', rede_avatar = 'a07' where id = $1", [pessoas[nome], `Pessoa ${nome}`, nome]);
}
const disciplina = (await um("select slug from interno.rede_comunidades where categoria = 'disciplinas' and tipo = 'aberta' order by slug limit 1"))?.slug;
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('teste-luta-aberta', 'Luta aberta de teste', 'lutas', 'aberta', 'membros'),
  ('teste-fechada', 'Fechada de teste', 'lutas', 'fechada', 'membros'),
  ('teste-restrita', 'Restrita de teste', 'disciplinas', 'restrita', 'membros') on conflict do nothing`);
const postar = async (quem, texto, extra = {}) =>
  (await um("insert into interno.rede_posts (autor, texto, comunidade, publico, alcance, nucleo) values ($1, $2, $3, $4, $5, $6) returning id",
    [quem, texto, extra.comunidade === undefined ? null : extra.comunidade, "publico" in extra ? extra.publico : "internet", extra.alcance ?? "publico", extra.nucleo ?? null])).id;
const federavel = async (id) => (await um("select interno.rede_fed_federavel(p) as f from interno.rede_posts p where p.id = $1", [id])).f;

// ═══════════════════ Desligado por padrão: nada muda ═══════════════════
await espera("sem a flag: versão 1 do consentimento e modo total desligado", async () => rpc(como(pessoas.ana), "rede_fed_situacao"), (r) => r.versao === 1 && r.total === false);
await espera("sem a flag: aceitar a Alumia com o item do Fediverso só guarda a escolha (não liga nada)", async () => {
  await rpc(como(pessoas.ana), "rede_aderir", { p_maior: true, p_versao: vigente, p_fediverso: true });
  const c = await um("select fediverso from interno.rede_consentimentos where usuario = $1 and revogado_em is null", [pessoas.ana]);
  const a = await um("select count(*)::int as n from interno.rede_fed_atores where perfil = $1", [pessoas.ana]);
  return c.fediverso === true && a.n === 0;
});
await espera("sem a flag: o servidor não guarda nota de quem ninguém segue, nem curtida", async () => {
  const n = await srv("nota_recebida", { id: "https://remota.teste/notes/x0", ator: ATOR, texto: "oi", visibilidade: "publico", mencoes_locais: ["ana"] });
  const i = await srv("interacao", { tipo: "like", ator: ATOR, atividade_id: "https://remota.teste/l/0", post_local: `${BASE}/api/fediverso/p/00000000-0000-4000-8000-000000000000`, sim: true });
  return [n.guardado, i.ok];
}, ([g, ok]) => g === false && ok === false);
await espera("sem a flag: a linha mista vem vazia", async () => rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: null, p_limite: 20 }), (r) => r.itens.length === 0 && r.proximo === null);
await recusa("sem a flag: curtir de fora é recusado", () => rpc(como(pessoas.ana), "rede_fed_interagir", { p_post_remoto: "https://remota.teste/notes/x0", p_tipo: "like", p_sim: true }), "fediverso_desligado");
await espera("sem a flag: Flag e Block de fora não gravam nada (nem denúncia, nem bloqueio, nem seguidor apagado)", async () => {
  const f = await srv("denuncia_recebida", { ator_instancia: INSTANCIA, alvos: [`${BASE}/api/fediverso/u/ana`], conteudo: "x" });
  const b = await srv("bloqueio_recebido", { ator: ATOR, alvo_handle: "ana", sim: true });
  const n = await um("select (select count(*) from interno.fediverso_denuncias)::int + (select count(*) from interno.fediverso_bloqueios_recebidos)::int + (select count(*) from interno.rede_denuncias where texto like 'Denúncia recebida de outro servidor%')::int as n");
  return [f.ok, f.motivo, b.ok, b.motivo, n.n];
}, ([fo, fm, bo, bm, n]) => fo === false && fm === "desligado" && bo === false && bm === "desligado" && n === 0);
await espera("sem a flag: o item marcado fica guardado como versão 1", async () => (await um("select fediverso_versao from interno.rede_consentimentos where usuario = $1 and revogado_em is null", [pessoas.ana])).fediverso_versao, (v) => v === 1);
await espera("sem a flag: fila_pegar devolve o de antes para os tipos antigos (e o teto de 100)", async () => {
  await dono("insert into interno.rede_fed_atores (perfil, handle, ligado, consentimento_versao, ligado_em, chave_publica, chave_privada) values ($1, 'ana', true, 1, now(), '-----BEGIN PUBLIC KEY-----v', 'v1:v')", [pessoas.ana]);
  await dono("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino, extra) select $1, 'create', 'o' || g, 'https://velha.teste/inbox', '{\"a\": 1}'::jsonb from generate_series(1, 130) g", [pessoas.ana]);
  const l = await srv("fila_pegar", { limite: 500 });
  const antigas = ["id", "tipo", "objeto", "destino", "extra", "tentativas", "handle", "chave_publica", "chave_privada"];
  const i = l[0];
  const db = await um("select id, tipo, objeto, destino, extra, tentativas from interno.rede_fed_fila where id = $1", [i.id]);
  return [l.length, antigas.every((k) => k in i), i.tipo === db.tipo && i.objeto === db.objeto && i.destino === db.destino && JSON.stringify(i.extra) === JSON.stringify(db.extra)
    && i.tentativas === db.tentativas && i.handle === "ana" && i.chave_publica === "-----BEGIN PUBLIC KEY-----v" && i.chave_privada === "v1:v"];
}, ([n, chaves, iguais]) => n === 100 && chaves && iguais);
await espera("sem a flag: fila_feito faz o de antes (sem circuito, 410 não apaga seguidor, 429 é falha comum)", async () => {
  await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox, inbox_compartilhada, pedido) values ($1, 'https://velha.teste/u/v', 'https://velha.teste/u/v/inbox', 'https://velha.teste/inbox', 'x')", [pessoas.ana]);
  const ids = (await dono("select id from interno.rede_fed_fila where feito_em is null and tentativas = 1 order by id limit 7")).rows.map((x) => x.id);
  for (const id of ids.slice(0, 5)) await srv("fila_feito", { id, ok: false, erro: "fora do ar", status: 503, dominio: "velha.teste" });
  await srv("fila_feito", { id: ids[5], ok: false, erro: "sumiu", status: 410 });
  await srv("fila_feito", { id: ids[6], ok: false, erro: "calma", status: 429, espera: 3600 });
  const r = (await dono("select erro, tentativas, feito_em, proxima < now() + interval '3 minutes' as perto from interno.rede_fed_fila where id = any($1::bigint[])", [ids])).rows;
  const seg = (await um("select count(*)::int as n from interno.rede_fed_seguidores where perfil = $1", [pessoas.ana])).n;
  const dom = (await um("select count(*)::int as n from interno.fediverso_dominios")).n;
  const sumido = await srv("fila_feito", { id: 999999999, ok: true });
  return [r.every((x) => x.feito_em === null && x.tentativas === 1 && x.perto), seg, dom, sumido.ok];
}, ([comuns, s, d, ok]) => comuns && s === 1 && d === 0 && ok === true);
await dono("delete from interno.rede_fed_fila");
await dono("delete from interno.rede_fed_seguidores");
await dono("delete from interno.rede_fed_atores where perfil = $1", [pessoas.ana]);
await espera("rede_aviso_listar traz ator_remoto, atores_remotos e objeto_remoto (o remendo não sumiu)", async () => {
  const def = (await um("select pg_get_functiondef('public.rede_aviso_listar(text, integer)'::regprocedure) as d")).d;
  return ["'ator_remoto'", "'atores_remotos'", "'objeto_remoto'"].every((k) => def.includes(k));
});
await espera("sem a flag: rede_aviso_listar devolve o de antes para os tipos antigos (só os três campos novos, nulos)", async () => {
  const def = (await um("select pg_get_functiondef('public.rede_aviso_listar(text, integer)'::regprocedure) as d")).d;
  const antes = def.replace(/\n\s*'ator_remoto', interno\.rede_fed_aviso_remoto[^\n]*\n\s*'atores_remotos'[^\n]*\n\s*'objeto_remoto'[^\n]*/, "")
    .replace(/public\.rede_aviso_listar\(/, "public.rede_aviso_listar_antes(");
  if (antes.includes("ator_remoto")) throw new Error("não deu para tirar o remendo");
  await dono(antes);
  await dono("grant execute on function public.rede_aviso_listar_antes(text, integer) to authenticated");
  await dono("insert into interno.avisos (para, texto, categoria, tipo) values ($1, 'Aviso antigo de moderação.', 'rede', 'moderacao'), ($1, 'Aviso geral.', 'rede', null)", [pessoas.ana]);
  const novo = await rpc(como(pessoas.ana), "rede_aviso_listar", { p_cursor: null, p_limite: 20 });
  const velho = await rpc(como(pessoas.ana), "rede_aviso_listar_antes", { p_cursor: null, p_limite: 20 });
  await dono("drop function public.rede_aviso_listar_antes(text, integer)");
  const novos = new Set(["ator_remoto", "atores_remotos", "objeto_remoto"]);
  const sem = (l) => JSON.stringify({ ...l, itens: l.itens.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !novos.has(k)))) });
  const novosNulos = novo.itens.every((x) => x.ator_remoto === null && x.objeto_remoto === null && Array.isArray(x.atores_remotos) && x.atores_remotos.length === 0);
  return [novo.itens.length, sem(novo) === sem(velho), novosNulos];
}, ([n, iguais, nulos]) => n >= 2 && iguais && nulos);

// ═══════════════════ O modo total liga quem aceitou ═══════════════════
await ligarTotal(true);
await espera("com a flag: versão 2 do consentimento", async () => rpc(como(pessoas.ana), "rede_fed_situacao"), (r) => r.versao === 2 && r.total === true);
await espera("ligar a flag não liga quem marcou o item na versão 1: a tela pede de novo", async () => {
  await dono("update interno.rede_consentimentos set fediverso = fediverso, fediverso_versao = fediverso_versao where usuario = $1", [pessoas.ana]);
  const n = (await um("select count(*)::int as n from interno.rede_fed_atores where perfil = $1", [pessoas.ana])).n;
  return [n, (await rpc(como(pessoas.ana), "rede_fed_situacao")).pedir_fediverso];
}, ([n, pedir]) => n === 0 && pedir === true);
await espera("aceitar a Alumia com o item marcado liga a federação sozinho (consentimento versão 2)", async () => {
  for (const nome of ["beto", "cris"]) await rpc(como(pessoas[nome]), "rede_aderir", { p_maior: true, p_versao: vigente, p_fediverso: true });
  return (await dono("select perfil, ligado, consentimento_versao from interno.rede_fed_atores where perfil = any($1::uuid[])", [[pessoas.beto, pessoas.cris]])).rows;
}, (r) => r.length === 2 && r.every((x) => x.ligado && x.consentimento_versao === 2));
await espera("quem desmarcou o item não liga", async () => {
  await rpc(como(pessoas.duda), "rede_aderir", { p_maior: true, p_versao: vigente, p_fediverso: false });
  return (await um("select count(*)::int as n from interno.rede_fed_atores where perfil = $1", [pessoas.duda])).n;
}, (n) => n === 0);
await espera("quem respondeu o item na versão 2 (marcado ou não) não é pedido de novo", async () => Promise.all([pessoas.beto, pessoas.duda].map(async (p) => (await rpc(como(p), "rede_fed_situacao")).pedir_fediverso)), (r) => r.every((x) => x === false));
await espera("quem já estava na Alumia aceita a versão 2 uma vez (rede_fed_ligar)", async () => rpc(como(pessoas.ana), "rede_fed_ligar", { p_sim: true, p_versao: 2 }), (r) => r.ligado === true && r.consentimento_versao === 2);
await recusa("ligar com a versão antiga, no modo total, é recusado", () => rpc(como(pessoas.duda), "rede_fed_ligar", { p_sim: true, p_versao: 1 }), "invalido:versao");
await dono("update interno.rede_fed_atores set ligado_em = now() - interval '1 minute' where ligado");

// ═══════════════════ O que sai (D3) ═══════════════════
const nucleo = (await um("insert into interno.rede_nucleos (nome) values ('Núcleo de teste') returning id")).id;
const posts = {
  perfil: await postar(pessoas.beto, "Post público do perfil. Oi @bia@remota.teste #teste"),
  disciplina: await postar(pessoas.beto, "Post na disciplina.", { comunidade: disciplina }),
  internet: await postar(pessoas.beto, "Post para a internet na disciplina.", { comunidade: disciplina, publico: "internet" }),
  luta: await postar(pessoas.beto, "Post numa comunidade de luta aberta.", { comunidade: "teste-luta-aberta" }),
  fechada: await postar(pessoas.beto, "Post numa comunidade fechada.", { comunidade: "teste-fechada" }),
  restrita: await postar(pessoas.beto, "Post numa comunidade restrita.", { comunidade: "teste-restrita" }),
  seguidores: await postar(pessoas.beto, "Post só para seguidores.", { publico: "seguidores", alcance: "seguidores" }),
  equipe: await postar(pessoas.beto, "Post da equipe.", { publico: "equipe", alcance: "equipe" }),
  nucleo: await postar(pessoas.beto, "Post do núcleo.", { publico: "nucleo", nucleo }),
  deDuda: await postar(pessoas.duda, "Post público de quem desmarcou o item."),
  membrosPerfil: await postar(pessoas.beto, "Post só para os membros da Alumia, no perfil.", { publico: "membros" }),
  membrosDisciplina: await postar(pessoas.beto, "Post só para os membros da Alumia, na disciplina.", { comunidade: disciplina, publico: "membros" }),
  semPublico: await postar(pessoas.beto, "Post antigo, sem público escolhido (vale o alcance).", { publico: null }),
};
await espera("o 'internet' do perfil é rebaixado para 'membros' pela matriz (é esse que D3 abre)", async () => (await um("select interno.rede2_publico(p) as v from interno.rede_posts p where p.id = $1", [posts.perfil])).v, (v) => v === "membros");
await espera("sai: o 'internet' do perfil (rebaixado), da disciplina aberta e o post antigo sem público", async () => Promise.all([posts.perfil, posts.disciplina, posts.internet, posts.semPublico].map(federavel)), (r) => r.every((f) => f === true));
await espera("não sai: núcleo, comunidade fechada, restrita, seguidores, equipe e quem não consentiu", async () => Promise.all([posts.nucleo, posts.fechada, posts.restrita, posts.seguidores, posts.equipe, posts.deDuda].map(federavel)), (r) => r.every((f) => f === false));
await espera("não sai: o 'membros' escolhido de propósito ('Membros da Alumia'), no perfil e na disciplina", async () => Promise.all([posts.membrosPerfil, posts.membrosDisciplina].map(federavel)), (r) => r.every((f) => f === false));
await espera("e o 'membros' de propósito não entra na fila nem tem documento", async () => [
  (await um("select count(*)::int as n from interno.rede_fed_enviados where post = any($1::uuid[])", [[posts.membrosPerfil, posts.membrosDisciplina]])).n,
  await srv("post", { id: posts.membrosPerfil })], ([n, d]) => n === 0 && d === null);
await espera("comunidade de luta aberta só sai com 'comunidades_de_luta' (D3, à espera da decisão)", async () => {
  const antes = await federavel(posts.luta);
  await dono("update interno.configuracoes set valor = valor || '{\"comunidades_de_luta\": true}'::jsonb where chave = 'fediverso'");
  const depois = await federavel(posts.luta);
  await dono("update interno.configuracoes set valor = valor - 'comunidades_de_luta' where chave = 'fediverso'");
  return [antes, depois];
}, ([a, d]) => a === false && d === true);
await espera("post retido deixa de sair", async () => {
  const id = await postar(pessoas.beto, "Vai ser retido.");
  await dono("update interno.rede_posts set retido = true where id = $1", [id]);
  return federavel(id);
}, (f) => f === false);
await espera("post oculto pela moderação deixa de sair e fica marcado como retirado", async () => {
  const id = await postar(pessoas.beto, "Vai ser ocultado.");
  const antes = await federavel(id);
  await dono("update interno.rede_posts set oculto = true where id = $1", [id]);
  const e = await um("select apagado_em from interno.rede_fed_enviados where post = $1", [id]);
  return [antes, await federavel(id), e?.apagado_em];
}, ([a, d, ap]) => a === true && d === false && ap !== null && ap !== undefined);
await espera("quem consentiu só na versão 1 continua com a regra antiga (o 'membros' do perfil não sai)", async () => {
  await dono("update interno.rede_fed_atores set consentimento_versao = 1 where perfil = $1", [pessoas.beto]);
  const f = await federavel(posts.perfil);
  await dono("update interno.rede_fed_atores set consentimento_versao = 2 where perfil = $1", [pessoas.beto]);
  return f;
}, (f) => f === false);

// ═══════════════════ O servidor: ator, post, mídia ═══════════════════
await srv("remoto_salvar", { ator: ATOR, chave_id: `${ATOR}#main-key`, chave_publica: "-----BEGIN PUBLIC KEY-----x", inbox: `${ATOR}/inbox`, compartilhada: "https://remota.teste/inbox", handle: "bia@remota.teste", nome: "Bia", resumo: "", url: "https://remota.teste/@bia", avatar: "https://remota.teste/a.png", tipo: "Person" });
await srv("remoto_salvar", { ator: ATOR2, inbox: `${ATOR2}/inbox`, compartilhada: "https://outra.teste/inbox", handle: "caio@outra.teste", nome: "Caio", url: "https://outra.teste/@caio" });
await espera("ator: também avatar_url (só da galeria), discoverable e trancado", async () => srv("ator", { handle: "beto" }), (a) => a.estado === "ligado" && a.avatar_url === "/rede/avatares/a07.svg" && a.discoverable === false && a.trancado === false && a.capa_url === null);
await espera("descoberta: a pessoa escolhe aparecer em diretórios de fora", async () => { await rpc(como(pessoas.beto), "rede_fed_descoberta", { p_sim: true }); return (await srv("ator", { handle: "beto" })).discoverable; }, (d) => d === true);
await espera("post: menção a quem já se conhece lá fora, visibilidade pública e mídia sem o caminho do arquivo", async () => {
  await dono("insert into interno.rede_midia (post, caminho, tipo, alt, largura, altura) values ($1, $2, 'image/webp', 'Uma foto de teste', 10, 20)", [posts.perfil, `${pessoas.beto}/${"0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"}.webp`]);
  return srv("post", { id: posts.perfil });
}, (p) => p.visibilidade === "publico" && p.mencoes.length === 1 && p.mencoes[0].ator === ATOR && p.midia.length === 1 && p.midia[0].alt === "Uma foto de teste" && !JSON.stringify(p).includes(".webp"));
await espera("mídia: o servidor pede o caminho pela ação 'midia', só de post que pode sair", async () => {
  const id = (await um("select id from interno.rede_midia where post = $1", [posts.perfil])).id;
  return srv("midia", { id });
}, (m) => m?.tipo === "image/webp" && /\.webp$/.test(m.caminho));
await espera("post que não sai não tem documento", async () => srv("post", { id: posts.seguidores }), (p) => p === null);
await espera("contagem_ativos para o NodeInfo", async () => srv("contagem_ativos"), (r) => r.mes >= 1 && r.semestre >= r.mes);

// ═══════════════════ Seguidor de fora: aviso ═══════════════════
await espera("seguidor de fora: aviso fed_seguidor com o ator remoto", async () => {
  await srv("seguidor", { handle: "beto", ator: ATOR, inbox: `${ATOR}/inbox`, compartilhada: "https://remota.teste/inbox", pedido: "https://remota.teste/f/1", sim: true });
  const l = await rpc(como(pessoas.beto), "rede_aviso_listar", { p_cursor: null, p_limite: 20 });
  return l.itens.find((x) => x.tipo === "fed_seguidor");
}, (a) => a && a.ator_remoto?.ator === ATOR && a.ator_remoto?.handle === "bia@remota.teste" && Array.isArray(a.atores_remotos));

// ═══════════════════ Quem é mencionado lá fora recebe ═══════════════════
await espera("menção a quem não segue: Create, Update e Delete vão para a caixa dele; quem já segue não recebe repetido", async () => {
  const id = await postar(pessoas.beto, "Oi @caio@outra.teste e @bia@remota.teste!");
  const fila = async (tipo, destino) => (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = $1 and objeto = $2 and destino = $3", [tipo, id, destino])).n;
  const create = [await fila("create", "https://outra.teste/inbox"), await fila("create", "https://remota.teste/inbox")];
  await dono("update interno.rede_posts set texto = 'Oi @caio@outra.teste, editado.' where id = $1", [id]);
  const update = [await fila("update", "https://outra.teste/inbox"), await fila("update", "https://remota.teste/inbox")];
  await dono("delete from interno.rede_posts where id = $1", [id]);
  const del = await fila("delete", "https://outra.teste/inbox");
  return [create, update, del];
}, ([c, u, d]) => c[0] === 1 && c[1] === 1 && u[0] === 1 && u[1] === 1 && d === 1);
await espera("menção a quem a pessoa bloqueou não sai", async () => {
  await dono("insert into interno.fediverso_filtros (usuario, ator, tipo) values ($1, $2, 'bloqueio')", [pessoas.beto, ATOR2]);
  const id = await postar(pessoas.beto, "Falando de @caio@outra.teste.");
  await dono("delete from interno.fediverso_filtros where usuario = $1", [pessoas.beto]);
  return (await um("select count(*)::int as n from interno.rede_fed_fila where objeto = $1 and destino = 'https://outra.teste/inbox'", [id])).n;
}, (n) => n === 0);

// ═══════════════════ O que entra ═══════════════════
const nota = (n, extra = {}) => ({ id: `https://remota.teste/notes/${n}`, ator: ATOR, url: `https://remota.teste/@bia/${n}`, texto: `Nota ${n}`, aviso: "", sensivel: false, publicado: new Date().toISOString(), visibilidade: "publico", mencoes_locais: [], midia: [], ...extra });
await espera("resposta de quem ninguém segue a um post daqui: guardada, ligada ao post e aviso fed_resposta para o autor", async () => {
  const r = await srv("nota_recebida", nota("r1", { em_resposta_a: `${BASE}/api/fediverso/p/${posts.perfil}`, html_limpo: '<p>Resposta <a href="https://remota.teste/x" rel="nofollow">link</a></p>' }));
  const guardada = await um("select post_local, html from interno.rede_fed_recebidos where id = 'https://remota.teste/notes/r1'");
  const l = await rpc(como(pessoas.beto), "rede_aviso_listar", { p_cursor: null, p_limite: 20 });
  return [r, guardada, l.itens.find((x) => x.tipo === "fed_resposta")];
}, ([r, g, a]) => r.guardado && r.motivo === "resposta" && g.post_local === posts.perfil && g.html.includes("<a href") && a?.post === posts.perfil && a.objeto_remoto === "https://remota.teste/notes/r1");
await espera("menção de fora a alguém daqui: guardada e aviso fed_mencao", async () => {
  const r = await srv("nota_recebida", nota("m1", { ator: ATOR2, id: "https://outra.teste/notes/m1", mencoes_locais: ["@cris@alumia.teste"] }));
  const l = await rpc(como(pessoas.cris), "rede_aviso_listar", { p_cursor: null, p_limite: 20 });
  return [r, l.itens.find((x) => x.tipo === "fed_mencao")];
}, ([r, a]) => r.guardado && r.motivo === "mencao" && a?.ator_remoto?.ator === ATOR2);
await espera("direto (limitado) nunca é guardado", async () => srv("nota_recebida", nota("d1", { visibilidade: "direto", mencoes_locais: ["beto"] })), (r) => r.guardado === false && r.motivo === "direto");
await espera("só-seguidores sem seguidor daqui é descartado", async () => srv("nota_recebida", nota("s1", { visibilidade: "seguidores", mencoes_locais: ["beto"] })), (r) => r.guardado === false);
await espera("nota sem ligação nenhuma com daqui não é guardada", async () => srv("nota_recebida", nota("n0")), (r) => r.guardado === false && r.motivo === "sem_ligacao");
await espera("HTML com script ou evento não passa a segunda tranca: fica só o texto", async () => {
  await srv("nota_recebida", nota("h1", { em_resposta_a: `${BASE}/api/fediverso/p/${posts.perfil}`, html_limpo: '<p onclick="x()">oi</p><script>alert(1)</script>' }));
  await srv("nota_recebida", nota("h2", { em_resposta_a: `${BASE}/api/fediverso/p/${posts.perfil}`, html_limpo: '<p><a href="javascript:alert(1)">x</a></p>' }));
  return (await dono("select html from interno.rede_fed_recebidos where id in ('https://remota.teste/notes/h1', 'https://remota.teste/notes/h2')")).rows;
}, (r) => r.length === 2 && r.every((x) => x.html === null));
await espera("mídia de fora: só https de imagem/vídeo/áudio, no máximo 4", async () => {
  await srv("nota_recebida", nota("mid", { em_resposta_a: `${BASE}/api/fediverso/p/${posts.perfil}`, midia: [
    { url: "https://remota.teste/m/1.png", tipo: "image/png", alt: "um gato", largura: 10, altura: 10, blurhash: "LEHV6nWB2yk8" },
    { url: "http://remota.teste/m/2.png", tipo: "image/png" }, { url: "https://remota.teste/m/3.exe", tipo: "application/x-msdownload" }] }));
  return (await um("select midia from interno.rede_fed_recebidos where id = 'https://remota.teste/notes/mid'")).midia;
}, (m) => m.length === 1 && m[0].alt === "um gato" && m[0].blurhash === "LEHV6nWB2yk8");
await espera("só o mesmo autor atualiza a nota (Update de outro ator não muda nada)", async () => {
  const r = await srv("nota_recebida", nota("r1", { ator: "https://remota.teste/users/intrusa", texto: "trocado", em_resposta_a: `${BASE}/api/fediverso/p/${posts.perfil}` }));
  return [r.guardado, (await um("select texto from interno.rede_fed_recebidos where id = 'https://remota.teste/notes/r1'")).texto];
}, ([g, t]) => g === false && t === "Nota r1");

// ═══════════════════ Curtida e impulso de fora ═══════════════════
await espera("curtida de fora num post daqui: aviso fed_curtida para o autor", async () => {
  const r = await srv("interacao", { tipo: "like", ator: ATOR, atividade_id: "https://remota.teste/likes/1", post_local: `${BASE}/api/fediverso/p/${posts.perfil}`, sim: true });
  const l = await rpc(como(pessoas.beto), "rede_aviso_listar", { p_cursor: null, p_limite: 20 });
  return [r, l.itens.filter((x) => x.tipo === "fed_curtida")];
}, ([r, a]) => r.ok && r.perfil_autor === pessoas.beto && a.length === 1 && a[0].ator_remoto?.ator === ATOR);
await espera("a mesma curtida duas vezes não repete o aviso", async () => {
  await srv("interacao", { tipo: "like", ator: ATOR, atividade_id: "https://remota.teste/likes/1", post_local: `${BASE}/api/fediverso/p/${posts.perfil}`, sim: true });
  return (await um("select count(*)::int as n from interno.avisos where tipo = 'fed_curtida'")).n;
}, (n) => n === 1);
await espera("Undo da curtida (só pelo id da atividade) tira o aviso", async () => {
  await srv("interacao", { ator: ATOR, atividade_id: "https://remota.teste/likes/1", sim: false });
  return [(await um("select count(*)::int as n from interno.avisos where tipo = 'fed_curtida'")).n, (await um("select count(*)::int as n from interno.fediverso_interacoes")).n];
}, ([a, i]) => a === 0 && i === 0);
await espera("impulso de fora: aviso fed_impulso, e o Undo tira", async () => {
  await srv("interacao", { tipo: "announce", ator: ATOR, atividade_id: "https://remota.teste/a/1", post_local: `${BASE}/api/fediverso/p/${posts.perfil}`, sim: true });
  const antes = (await um("select count(*)::int as n from interno.avisos where tipo = 'fed_impulso'")).n;
  await srv("interacao", { tipo: "announce", ator: ATOR, post_local: `${BASE}/api/fediverso/p/${posts.perfil}`, sim: false });
  return [antes, (await um("select count(*)::int as n from interno.avisos where tipo = 'fed_impulso'")).n];
}, ([a, d]) => a === 1 && d === 0);
await espera("a preferência de sempre vale: quem desligou 'apoio' no site não recebe curtida de fora", async () => {
  await rpc(como(pessoas.beto), "rede_aviso_prefs_salvar", { p_tipo: "apoio", p_canal: "site", p_ligado: false });
  await srv("interacao", { tipo: "like", ator: ATOR2, atividade_id: "https://outra.teste/likes/9", post_local: `${BASE}/api/fediverso/p/${posts.perfil}`, sim: true });
  const n = (await um("select count(*)::int as n from interno.avisos where tipo = 'fed_curtida'")).n;
  await rpc(como(pessoas.beto), "rede_aviso_prefs_salvar", { p_tipo: "apoio", p_canal: "site", p_ligado: true });
  return n;
}, (n) => n === 0);

// ═══════════════════ A linha mista ═══════════════════
await dono("insert into interno.rede_fed_seguindo (perfil, ator, pedido, aceito) values ($1, $2, 'https://alumia.teste/f/1', true), ($1, $3, 'https://alumia.teste/f/2', true)", [pessoas.ana, ATOR, ATOR2]);
await srv("nota_recebida", nota("l1", { publicado: new Date(Date.now() - 60_000).toISOString() }));
await srv("nota_recebida", nota("l2", { ator: ATOR2, id: "https://outra.teste/notes/l2", texto: "Fala sobre abacaxi" }));
await srv("nota_recebida", nota("l3", { visibilidade: "seguidores" }));
await espera("resposta só-seguidores a um post daqui: quem não segue o autor de fora não recebe aviso (nem o endereço da nota)", async () => {
  const r = await srv("nota_recebida", nota("rs", { ator: ATOR2, id: "https://outra.teste/notes/rs", visibilidade: "seguidores", em_resposta_a: `${BASE}/api/fediverso/p/${posts.perfil}` }));
  const av = (await um("select count(*)::int as n from interno.avisos where para = $1 and objeto_remoto = 'https://outra.teste/notes/rs'", [pessoas.beto])).n;
  return [r.guardado, av];
}, ([g, a]) => g === true && a === 0);
await espera("respostas de fora de um post daqui (rede_fed_respostas_de): cada um vê só o que pode", async () => {
  const beto = await rpc(como(pessoas.beto), "rede_fed_respostas_de", { p_post: posts.perfil, p_cursor: null, p_limite: 50 });
  const ana = await rpc(como(pessoas.ana), "rede_fed_respostas_de", { p_post: posts.perfil, p_cursor: null, p_limite: 50 });
  const idsB = beto.itens.map((x) => x.id);
  const idsA = ana.itens.map((x) => x.id);
  return [idsB.includes("https://remota.teste/notes/r1"), idsB.includes("https://outra.teste/notes/rs"), idsA.includes("https://outra.teste/notes/rs"),
    beto.total === beto.itens.length, beto.itens.every((x) => x.origem === "fediverso" && x.post_local === posts.perfil)];
}, ([r1, rsB, rsA, total, cartoes]) => r1 && !rsB && rsA && total && cartoes);
await espera("rede_fed_respostas_de pagina por cursor sem repetir nem pular", async () => {
  const todas = await rpc(como(pessoas.beto), "rede_fed_respostas_de", { p_post: posts.perfil, p_cursor: null, p_limite: 100 });
  const vistas = [];
  let cursor = null;
  for (let i = 0; i < 20; i++) {
    const p = await rpc(como(pessoas.beto), "rede_fed_respostas_de", { p_post: posts.perfil, p_cursor: cursor, p_limite: 2 });
    vistas.push(...p.itens.map((x) => x.id));
    if (!p.proximo) break;
    cursor = p.proximo;
  }
  return [todas.itens.map((x) => x.id).join(), vistas.join(), todas.itens.length];
}, ([a, b, n]) => a === b && n >= 3);
await recusa("rede_fed_respostas_de de um post que a pessoa não vê é recusado", () => rpc(como(pessoas.ana), "rede_fed_respostas_de", { p_post: posts.seguidores, p_cursor: null, p_limite: 10 }), "nao_encontrado");
await espera("linha mista: as notas de quem a pessoa segue, no formato de cartão (origem fediverso, autor, avatar)", async () => rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: null, p_limite: 20 }), (r) => {
  const ids = r.itens.map((x) => x.id);
  const c = r.itens.find((x) => x.id === "https://remota.teste/notes/l1");
  return ids.includes("https://outra.teste/notes/l2") && ids.includes("https://remota.teste/notes/l3") && c?.origem === "fediverso" && c.handle_remoto === "bia@remota.teste" && c.avatar === "https://remota.teste/a.png"
    && "respostas" in c && "autor" in c && c.autor.remoto === true;
});
await espera("só-seguidores aparece só para quem segue o autor", async () => rpc(como(pessoas.cris), "rede_fed_fio_remoto", { p_id: "https://remota.teste/notes/l3" }).then(() => "viu", (e) => e.message), (r) => r.includes("nao_encontrado"));
await espera("a paginação por cursor não repete nem pula", async () => {
  const p1 = await rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: null, p_limite: 1 });
  const p2 = await rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: p1.proximo, p_limite: 1 });
  return [p1.itens[0]?.id, p2.itens[0]?.id, p1.proximo];
}, ([a, b, c]) => a && b && a !== b && typeof c === "string");
await espera("impulso de uma nota de fora por quem a pessoa segue entra como impulso", async () => {
  await srv("interacao", { tipo: "announce", ator: ATOR, atividade_id: "https://remota.teste/a/2", objeto_remoto: "https://outra.teste/notes/l2", sim: true });
  const r = await rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: null, p_limite: 20 });
  return r.itens.find((x) => x.impulsionado_por?.ator === ATOR);
}, (c) => c?.id === "https://outra.teste/notes/l2");
await espera("palavra silenciada some da linha mista", async () => {
  await dono("insert into interno.rede_silenciados (usuario, palavra) values ($1, 'abacaxi')", [pessoas.ana]);
  const r = await rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: null, p_limite: 20 });
  await dono("delete from interno.rede_silenciados where usuario = $1", [pessoas.ana]);
  return r.itens.some((x) => x.id === "https://outra.teste/notes/l2");
}, (v) => v === false);
await espera("silenciar alguém de fora tira da linha (e o impulso dele também)", async () => {
  await rpc(como(pessoas.ana), "rede_fed_silenciar_pessoa", { p_ator: ATOR, p_sim: true });
  const r = await rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: null, p_limite: 20 });
  await rpc(como(pessoas.ana), "rede_fed_silenciar_pessoa", { p_ator: ATOR, p_sim: false });
  return r.itens.some((x) => x.ator_remoto === ATOR || x.impulsionado_por?.ator === ATOR);
}, (v) => v === false);
await espera("quem bloqueou a pessoa lá fora (Block) some da linha dela e deixa de segui-la", async () => {
  await srv("bloqueio_recebido", { ator: ATOR2, alvo_handle: "ana", sim: true });
  const r = await rpc(como(pessoas.ana), "rede_fed_linha_mista", { p_cursor: null, p_limite: 20 });
  const seg = (await um("select count(*)::int as n from interno.rede_fed_seguindo where perfil = $1 and ator = $2", [pessoas.ana, ATOR2])).n;
  return [r.itens.some((x) => x.ator_remoto === ATOR2), seg];
}, ([v, s]) => v === false && s === 0);

// ═══════════════════ O que a pessoa faz com gente de fora ═══════════════════
await espera("curtir uma nota de fora: Like na fila para a caixa do autor; desfazer: Undo", async () => {
  const r1 = await rpc(como(pessoas.ana), "rede_fed_interagir", { p_post_remoto: "https://remota.teste/notes/l1", p_tipo: "like", p_sim: true });
  const like = await um("select destino, extra from interno.rede_fed_fila where tipo = 'like' and perfil = $1", [pessoas.ana]);
  const r2 = await rpc(como(pessoas.ana), "rede_fed_interagir", { p_post_remoto: "https://remota.teste/notes/l1", p_tipo: "like", p_sim: false });
  const undo = await um("select extra from interno.rede_fed_fila where tipo = 'undo-like' and perfil = $1", [pessoas.ana]);
  return [r1.curti, like?.destino, r2.curti, undo?.extra?.atividade === like?.extra?.atividade];
}, ([c1, d, c2, mesma]) => c1 === true && d === `${ATOR}/inbox` && c2 === false && mesma);
await espera("impulsionar: Announce para o autor e para quem segue a pessoa", async () => {
  await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox, inbox_compartilhada, pedido) values ($1, 'https://terceira.teste/u/z', 'https://terceira.teste/u/z/inbox', 'https://terceira.teste/inbox', 'x')", [pessoas.ana]);
  await rpc(como(pessoas.ana), "rede_fed_interagir", { p_post_remoto: "https://remota.teste/notes/l1", p_tipo: "announce", p_sim: true });
  return (await dono("select destino from interno.rede_fed_fila where tipo = 'announce' and perfil = $1 order by destino", [pessoas.ana])).rows.map((x) => x.destino);
}, (d) => d.length === 2 && d.includes(`${ATOR}/inbox`) && d.includes("https://terceira.teste/inbox"));
await recusa("impulsionar só-seguidores não pode", () => rpc(como(pessoas.ana), "rede_fed_interagir", { p_post_remoto: "https://remota.teste/notes/l3", p_tipo: "announce", p_sim: true }), "sem_permissao");
await espera("responder a uma nota de fora: post daqui com resposta_a_remota, Create para a caixa do autor e o autor nas menções", async () => {
  const r = await rpc(como(pessoas.ana), "rede_fed_responder_remoto", { p_post_remoto: "https://remota.teste/notes/l1", p_texto: "Concordo com você!", p_aviso: "" });
  const p = await um("select resposta_a_remota from interno.rede_posts where id = $1", [r.id]);
  const fila = (await dono("select destino from interno.rede_fed_fila where tipo = 'create' and objeto = $1", [r.id])).rows.map((x) => x.destino);
  const doc = await srv("post", { id: r.id });
  return [r.federado, p.resposta_a_remota, fila.filter((d) => d === "https://remota.teste/inbox").length, doc?.resposta_a_remota, doc?.mencoes?.some((m) => m.ator === ATOR)];
}, ([f, rr, fila, drr, men]) => f === true && rr === "https://remota.teste/notes/l1" && fila === 1 && drr === rr && men);
await espera("editar e apagar a resposta daqui: o Update e o Delete chegam ao autor da nota de fora (que não segue a pessoa)", async () => {
  const r = await rpc(como(pessoas.ana), "rede_fed_responder_remoto", { p_post_remoto: "https://remota.teste/notes/l1", p_texto: "Vou editar esta.", p_aviso: "" });
  await dono("update interno.rede_posts set texto = 'Editada.' where id = $1", [r.id]);
  await dono("delete from interno.rede_posts where id = $1", [r.id]);
  const n = async (t) => (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = $1 and objeto = $2 and destino = 'https://remota.teste/inbox'", [t, r.id])).n;
  return [await n("create"), await n("update"), await n("delete")];
}, ([c, u, d]) => c === 1 && u === 1 && d === 1);
await espera("o fio da nota de fora mostra a resposta daqui", async () => rpc(como(pessoas.ana), "rede_fed_fio_remoto", { p_id: "https://remota.teste/notes/l1" }), (f) => f.post.id === "https://remota.teste/notes/l1" && f.respostas.some((x) => x.texto === "Concordo com você!"));
await espera("o fio de uma resposta de fora mostra acima o post daqui", async () => rpc(como(pessoas.beto), "rede_fed_fio_remoto", { p_id: "https://remota.teste/notes/r1" }), (f) => f.acima.length === 1 && f.acima[0].id === posts.perfil);
await espera("perfil remoto: o que se sabe, se segue e as notas visíveis", async () => rpc(como(pessoas.ana), "rede_fed_perfil_remoto", { p_ator: ATOR }), (p) => p.handle === "bia@remota.teste" && p.seguindo === "sim" && p.posts.length >= 1 && p.posts.every((x) => x.ator_remoto === ATOR));
await espera("denunciar uma nota de fora com encaminhar: protocolo e Flag na fila, assinada pela instância (sem perfil)", async () => {
  const r = await rpc(como(pessoas.ana), "rede_fed_denunciar_remoto", { p_alvo: "https://remota.teste/notes/l1", p_categoria: "spam", p_texto: "propaganda", p_encaminhar: true });
  const f = await um("select perfil, destino, extra from interno.rede_fed_fila where tipo = 'flag'");
  return [r, f];
}, ([r, f]) => /^[0-9A-F]{10}$/.test(r.protocolo) && r.encaminhada && f.perfil === null && f.destino === "https://remota.teste/inbox" && !JSON.stringify(f.extra).includes(pessoas.ana));
await espera("bloquear alguém de fora: Block na fila, deixa de ser seguida por ele e os avisos dele somem", async () => {
  const r = await rpc(como(pessoas.beto), "rede_fed_bloquear_pessoa", { p_ator: ATOR, p_sim: true });
  const block = (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'block' and perfil = $1", [pessoas.beto])).n;
  const seg = (await um("select count(*)::int as n from interno.rede_fed_seguidores where perfil = $1 and ator = $2", [pessoas.beto, ATOR])).n;
  const av = (await um("select count(*)::int as n from interno.avisos where para = $1 and ator_remoto = $2", [pessoas.beto, ATOR])).n;
  return [r.bloqueado, block, seg, av];
}, ([b, k, s, a]) => b === true && k === 1 && s === 0 && a === 0);
await espera("e seguir de novo, de lá, é recusado enquanto está bloqueado", async () => srv("seguidor", { handle: "beto", ator: ATOR, inbox: `${ATOR}/inbox`, pedido: "https://remota.teste/f/2", sim: true }), (r) => r.ok === false && r.motivo === "bloqueado");
await espera("desbloquear: Undo do Block", async () => { await rpc(como(pessoas.beto), "rede_fed_bloquear_pessoa", { p_ator: ATOR, p_sim: false }); return (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'undo-block'")).n; }, (n) => n === 1);

// ═══════════════════ Flag de fora ═══════════════════
await espera("Flag de fora vira denúncia com protocolo e entra na fila da mediação (post e perfil daqui)", async () => {
  const r = await srv("denuncia_recebida", { ator_instancia: INSTANCIA, alvos: [`${BASE}/api/fediverso/u/beto`, `${BASE}/api/fediverso/p/${posts.perfil}`, "https://lixo.teste/x"], conteudo: "isso aqui viola as regras" });
  const d = (await dono("select alvo_tipo, alvo, quem from interno.rede_denuncias where texto like 'Denúncia recebida de outro servidor%' order by alvo_tipo")).rows;
  return [r, d];
}, ([r, d]) => /^[0-9A-F]{10}$/.test(r.protocolo) && r.locais === 2 && d.length === 2 && d.some((x) => x.alvo_tipo === "post" && x.alvo === posts.perfil) && d.some((x) => x.alvo_tipo === "perfil" && x.alvo === pessoas.beto) && d.every((x) => x.quem === null));
await espera("a mediação lê as denúncias com o Fediverso; quem não é da mediação, não", async () => {
  let recusou = false;
  try { await rpc(como(pessoas.ana), "rede_fed_denuncias_listar", { p_situacao: null }); } catch { recusou = true; }
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao') on conflict do nothing", [pessoas.duda]);
  const l = await rpc(como(pessoas.duda), "rede_fed_denuncias_listar", { p_situacao: null });
  return [recusou, l.length, l.some((x) => "quem" in x)];
}, ([r, n, q]) => r && n === 2 && q === false);

// ═══════════════════ A fila: circuito por domínio, 410 e 429 ═══════════════════
await espera("circuito: 5 falhas de conexão seguidas deixam o domínio morto por 1 h e a fila o pula", async () => {
  await dono("update interno.rede_fed_fila set feito_em = now() where feito_em is null");
  for (let n = 0; n < 6; n++) await dono("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino) values ($1, 'create', 'x', 'https://morta.teste/inbox')", [pessoas.ana]);
  const ids = (await dono("select id from interno.rede_fed_fila where feito_em is null order by id")).rows.map((x) => x.id);
  let r;
  for (const id of ids.slice(0, 5)) r = await srv("fila_feito", { id, ok: false, erro: "conexão recusada", status: 0, dominio: "morta.teste" });
  const estado = await srv("dominio_estado", { dominio: "morta.teste" });
  await dono("update interno.rede_fed_fila set proxima = now() - interval '1 minute' where feito_em is null");
  const pegos = await srv("fila_pegar", { limite: 50 });
  return [r.morto_ate, estado.morto_ate, pegos.length];
}, ([m, e, n]) => m && e && n === 0);
await espera("um sucesso zera o circuito", async () => {
  const id = (await um("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino, feito_em) values ($1, 'create', 'x', 'https://morta.teste/inbox', null) returning id", [pessoas.ana])).id;
  await srv("fila_feito", { id, ok: true, dominio: "morta.teste" });
  return srv("dominio_estado", { dominio: "morta.teste" });
}, (e) => e.morto_ate === null && e.falhas === 0);
await espera("410 numa caixa apaga quem seguia por ela", async () => {
  await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox, inbox_compartilhada, pedido) values ($1, 'https://sumiu.teste/u/a', 'https://sumiu.teste/u/a/inbox', 'https://sumiu.teste/inbox', 'x')", [pessoas.ana]);
  const id = (await um("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino) values ($1, 'create', 'x', 'https://sumiu.teste/inbox') returning id", [pessoas.ana])).id;
  await srv("fila_feito", { id, ok: false, status: 410, erro: "http_410" });
  return [(await um("select count(*)::int as n from interno.rede_fed_seguidores where inbox_compartilhada = 'https://sumiu.teste/inbox'")).n, (await um("select feito_em from interno.rede_fed_fila where id = $1", [id])).feito_em];
}, ([n, f]) => n === 0 && f !== null);
await espera("429 respeita a espera e não gasta tentativa", async () => {
  const id = (await um("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino, tentativas) values ($1, 'create', 'x', 'https://cheia.teste/inbox', 2) returning id", [pessoas.ana])).id;
  await srv("fila_feito", { id, ok: false, status: 429, espera: 3600 });
  return um("select tentativas, proxima > now() + interval '50 minutes' as longe, feito_em from interno.rede_fed_fila where id = $1", [id]);
}, (r) => r.tentativas === 1 && r.longe && r.feito_em === null);
await espera("fila_pegar diz quem assina cada entrega (pessoa, instância)", async () => {
  await dono("update interno.rede_fed_fila set feito_em = now() where feito_em is null");
  await srv("ator", { handle: "ana" });
  await dono("update interno.rede_fed_atores set chave_publica = '-----BEGIN PUBLIC KEY-----x', chave_privada = 'v1:x' where perfil = $1", [pessoas.ana]);
  await dono("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino) values ($1, 'like', 'x', 'https://boa.teste/inbox'), (null, 'flag', 'x', 'https://boa.teste/inbox')", [pessoas.ana]);
  return srv("fila_pegar", { limite: 200 });
}, (l) => l.length === 2 && l.some((x) => x.assinante === "pessoa" && x.handle === "ana") && l.some((x) => x.assinante === "instancia" && x.chave_privada === null));

// ═══════════════════ Group (fediverso-grupos) ═══════════════════
await espera("sem 'fediverso-grupos', a comunidade não responde como Group", async () => srv("comunidade", { slug: disciplina }), (r) => r.estado === "inexistente");
await espera("com 'fediverso-grupos': Group, seguidor de fora com group-accept e post novo com group-announce", async () => {
  await ligarGrupos(true);
  const g = await srv("comunidade", { slug: disciplina });
  await srv("comunidade_seguidor", { slug: disciplina, ator: "https://lemmy.teste/u/l", inbox: "https://lemmy.teste/u/l/inbox", compartilhada: "https://lemmy.teste/inbox", pedido: "https://lemmy.teste/f/1", sim: true });
  const aceite = (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'group-accept' and comunidade = $1", [disciplina])).n;
  const novo = await postar(pessoas.beto, "Post novo na comunidade com Group.", { comunidade: disciplina });
  const anuncio = (await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'group-announce' and objeto = $1 and destino = 'https://lemmy.teste/inbox'", [novo])).n;
  const total = (await srv("comunidade_seguidores", { slug: disciplina })).total;
  const fechada = await srv("comunidade", { slug: "teste-fechada" });
  return [g.estado, aceite, anuncio, total, fechada.estado];
}, ([e, a, n, t, f]) => e === "ligado" && a === 1 && n === 1 && t === 1 && f === "inexistente");
await ligarGrupos(false);

// ═══════════════════ Desligar e a faxina ═══════════════════
await espera("desmarcar o item do Fediverso no consentimento desliga e retira o que saiu", async () => {
  await rpc(como(pessoas.cris), "rede_aderir", { p_maior: true, p_versao: vigente, p_fediverso: false });
  return (await um("select ligado from interno.rede_fed_atores where perfil = $1", [pessoas.cris])).ligado;
}, (l) => l === false);
await espera("desligar desfaz também o que a pessoa curtiu e impulsionou lá fora (Undo)", async () => {
  await rpc(como(pessoas.ana), "rede_fed_ligar", { p_sim: false, p_versao: null });
  return [(await um("select count(*)::int as n from interno.rede_fed_fila where tipo = 'undo-announce' and perfil = $1 and feito_em is null", [pessoas.ana])).n, (await um("select count(*)::int as n from interno.fediverso_interacoes where perfil = $1", [pessoas.ana])).n];
}, ([u, i]) => u >= 1 && i === 0);
await espera("faxina: nota sem ligação sai em 30 dias; a que responde a um post daqui fica", async () => {
  await dono("update interno.rede_fed_recebidos set recebido_em = now() - interval '40 days'");
  await dono("select interno.rede_fed_limpar()");
  const ficou = (await dono("select id from interno.rede_fed_recebidos")).rows.map((x) => x.id);
  return [ficou.includes("https://remota.teste/notes/r1"), ficou.includes("https://outra.teste/notes/m1"), ficou.includes("https://remota.teste/notes/l3")];
}, ([r, m, l]) => r && m && !l);
await espera("apagado o post daqui, as respostas de fora a ele vão junto", async () => {
  await dono("delete from interno.rede_posts where id = $1", [posts.perfil]);
  return (await um("select count(*)::int as n from interno.rede_fed_recebidos where id = 'https://remota.teste/notes/r1'")).n;
}, (n) => n === 0);
await espera("a mediação bloqueia uma instância: some o que era dela, até os avisos", async () => {
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao') on conflict do nothing", [pessoas.duda]);
  await rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "outra.teste", p_sim: true, p_motivo: "teste" });
  return [(await um("select count(*)::int as n from interno.avisos where ator_remoto like 'https://outra.teste/%'")).n, (await um("select count(*)::int as n from interno.rede_fed_recebidos where ator like 'https://outra.teste/%'")).n];
}, ([a, r]) => a === 0 && r === 0);

// ═══════════════════ Desligar a flag: volta ao de antes ═══════════════════
await espera("desligada a flag de novo: versão 1 e o 'membros' do perfil para de sair", async () => {
  await ligarTotal(false);
  const s = await rpc(como(pessoas.beto), "rede_fed_situacao");
  const id = await postar(pessoas.beto, "Outro post público do perfil.");
  return [s.versao, await federavel(id)];
}, ([v, f]) => v === 1 && f === false);
await espera("o painel (recursos_vivos) manda mais que a configuração: desligado no painel desliga", async () => {
  await ligarTotal(true);
  const existe = (await um("select to_regclass('interno.recursos_vivos') is not null as e")).e;
  if (!existe) return true;
  await dono("insert into interno.recursos_catalogo (nome) values ('fediverso-total') on conflict do nothing");
  await dono("insert into interno.recursos_vivos (nome, ligado) values ('fediverso-total', false) on conflict (nome) do update set ligado = false");
  const v = (await um("select interno.rede_fed_total() as t")).t;
  await dono("delete from interno.recursos_vivos where nome = 'fediverso-total'");
  await dono("delete from interno.recursos_catalogo where nome = 'fediverso-total'");
  return v === false;
});

// ═══════════════════ O que já nasce bloqueado: Threads e Bridgy Fed ═══════════════════
// (supabase/migracoes/20261110-fediverso-bloqueio-padrao.sql). A migração do modo total foi rodada de novo lá em cima e trouxe a
// função antiga de bloquear; por isso esta roda aqui, duas vezes, como rodaria no banco de verdade depois daquela.
const padrao = lerTexto("supabase/migracoes/20261110-fediverso-bloqueio-padrao.sql");
await espera("o install.sql traz a migração do bloqueio padrão, idêntica ao arquivo e depois da do modo total", async () => install.includes(padrao) && install.indexOf(padrao) > install.indexOf(migracao));
await espera("a migração do bloqueio padrão roda de novo sem erro", () => banco.exclusivo(() => banco.pg.exec(padrao)));
await espera("e mais uma vez também (idempotente)", () => banco.exclusivo(() => banco.pg.exec(padrao)));
const fixos = async () => (await dono("select dominio from interno.rede_fed_bloqueados where fixo order by dominio")).rows.map((x) => x.dominio).join();
const bloqueado = async (url) => (await um("select interno.rede_fed_bloqueado($1) as b", [url])).b;
const coordena = (sub) => ({ ...como(sub), aal: "aal2" });
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [pessoas.ana]);
await espera("a semente: threads.net, threads.com e brid.gy bloqueados e fixos, com motivo e sem autor", async () => {
  const r = (await dono("select dominio, motivo, por from interno.rede_fed_bloqueados where fixo order by dominio")).rows;
  return [r.map((x) => x.dominio).join(), r.every((x) => x.motivo.length > 10 && x.por === null)];
}, ([d, ok]) => d === "brid.gy,threads.com,threads.net" && ok);
await espera("rodar de novo não repete nem mexe na semente", async () => (await um("select count(*)::int as n from interno.rede_fed_bloqueados where dominio in ('brid.gy', 'threads.net', 'threads.com')")).n, (n) => n === 3);
await espera("o bloqueio vale para os subdomínios (www.threads.net, bsky.brid.gy, web.brid.gy, fed.brid.gy)", async () => Promise.all(
  ["https://www.threads.net/ap/users/1/", "https://threads.net/ap/users/1/", "https://www.threads.com/@x", "https://bsky.brid.gy/ap/did:plc:x", "https://web.brid.gy/site.teste", "https://fed.brid.gy/fed.brid.gy"].map(bloqueado)),
  (r) => r.every((b) => b === true));
await espera("e não pega domínio parecido (outrothreads.net, brid.gy.teste)", async () => Promise.all(["https://outrothreads.net/u/a", "https://brid.gy.teste/u/a"].map(bloqueado)), (r) => r.every((b) => b === false));
await espera("nem deixa passar o mesmo domínio escrito de outro jeito (ponto no fim, usuário na frente, porta, maiúsculas)", async () => Promise.all(
  ["https://threads.net./ap/users/1/", "https://www.threads.net./ap/users/1/", "https://x@threads.net/ap/users/1/", "https://x:y@bsky.brid.gy/ap/x", "https://threads.net:443/ap/users/1/", "https://WWW.Threads.NET/ap/users/1/", "https://brid.gy./x"].map(bloqueado)),
  (r) => r.every((b) => b === true));
await recusa("alguém com o papel educacao também não desbloqueia o Bridgy Fed", async () => {
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao') on conflict do nothing", [pessoas.beto]);
  try {
    return await rpc({ ...como(pessoas.beto), aal: "aal2" }, "rede_fed_bloquear", { p_dominio: " BRID.GY ", p_sim: false, p_motivo: "" });
  } finally {
    await dono("delete from interno.papeis where usuario = $1 and papel = 'educacao'", [pessoas.beto]);
  }
}, "bloqueio_fixo");
await espera("nada do Threads é guardado: seguidor de lá é recusado", async () => srv("seguidor", { handle: "beto", ator: "https://www.threads.net/ap/users/1/", inbox: "https://www.threads.net/ap/users/1/inbox/", pedido: "https://www.threads.net/f/1", sim: true }), (r) => r.ok === false);
await espera("a lista da mediação diz quais bloqueios são fixos", async () => rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "", p_sim: null, p_motivo: "" }),
  (l) => l.find((x) => x.dominio === "threads.net")?.fixo === true && l.find((x) => x.dominio === "brid.gy")?.fixo === true && l.find((x) => x.dominio === "outra.teste")?.fixo === false);
await recusa("mediador comum não desbloqueia o Threads", () => rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "threads.net", p_sim: false, p_motivo: "" }), "bloqueio_fixo");
await recusa("nem troca o motivo de um bloqueio fixo", () => rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "Threads.net", p_sim: true, p_motivo: "outro" }), "bloqueio_fixo");
await recusa("mediador comum não desbloqueia o Bridgy Fed", () => rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "brid.gy", p_sim: false, p_motivo: "" }), "bloqueio_fixo");
await recusa("nem a coordenação desbloqueia o Bridgy Fed pela função da mediação", () => rpc(coordena(pessoas.ana), "rede_fed_bloquear", { p_dominio: "brid.gy", p_sim: false, p_motivo: "" }), "bloqueio_fixo");
await recusa("nem o Threads por ela: o caminho é o interruptor", () => rpc(coordena(pessoas.ana), "rede_fed_bloquear", { p_dominio: "threads.com", p_sim: false, p_motivo: "" }), "bloqueio_fixo");
await espera("depois das recusas, os três continuam fixos", fixos, (d) => d === "brid.gy,threads.com,threads.net");
await espera("a mediação vê o interruptor do Threads, mas não pode mudar", async () => rpc(como(pessoas.duda), "rede_fed_threads", { p_bloquear: null }), (r) => r.bloqueado === true && r.pode_mudar === false);
await recusa("mediador comum não liga o Threads pelo interruptor", () => rpc(como(pessoas.duda), "rede_fed_threads", { p_bloquear: false }), "sem_permissao");
await recusa("quem não é da equipe nem vê o interruptor", () => rpc(como(pessoas.beto), "rede_fed_threads", { p_bloquear: null }), "sem_permissao");
await espera("visitante não chama o interruptor", async () => (await um("select has_function_privilege('anon', 'public.rede_fed_threads(boolean)', 'execute') as p")).p, (p) => p === false);
await espera("a coordenação libera o Threads: saem os dois domínios, o Bridgy Fed fica", async () => {
  const r = await rpc(coordena(pessoas.ana), "rede_fed_threads", { p_bloquear: false });
  return [r.bloqueado, r.pode_mudar, await fixos(), await bloqueado("https://www.threads.net/ap/users/1/"), await bloqueado("https://bsky.brid.gy/ap/x")];
}, ([b, p, d, t, g]) => b === false && p === true && d === "brid.gy" && t === false && g === true);
await espera("com o Threads liberado, rodar a migração de novo não bloqueia de volta", async () => {
  await banco.exclusivo(() => banco.pg.exec(padrao));
  return [await bloqueado("https://threads.net/ap/users/1/"), await fixos()];
}, ([t, d]) => t === false && d === "brid.gy");
await espera("a coordenação bloqueia o Threads de novo: volta fixo e some o que entrou dele", async () => {
  await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox, inbox_compartilhada, pedido) values ($1, 'https://www.threads.net/ap/users/2/', 'https://www.threads.net/ap/users/2/inbox/', null, 'x')", [pessoas.beto]);
  const r = await rpc(coordena(pessoas.ana), "rede_fed_threads", { p_bloquear: true });
  const seg = (await um("select count(*)::int as n from interno.rede_fed_seguidores where ator like 'https://www.threads.net/%'")).n;
  const cfg = (await um("select valor ? 'threads_liberado' as tem from interno.configuracoes where chave = 'fediverso'")).tem;
  return [r.bloqueado, await fixos(), seg, cfg];
}, ([b, d, s, c]) => b === true && d === "brid.gy,threads.com,threads.net" && s === 0 && c === false);
await espera("o Bridgy Fed não tem interruptor: nenhuma função pública o desbloqueia", async () => {
  const r = await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~ 'delete from (interno\\.)?rede_fed_bloqueados' order by 1`);
  return r.rows.map((x) => x.proname).join();
}, (f) => f === "rede_fed_bloquear,rede_fed_threads");
await espera("bloquear, desbloquear e o interruptor ficam no registro de atividades, só com o domínio", async () => {
  await rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "ruim.teste", p_sim: true, p_motivo: "motivo que não vai para o registro" });
  await rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "ruim.teste", p_sim: false, p_motivo: "" });
  const r = (await dono("select acao, alvo, detalhes::text as d from interno.auditoria where acao like 'rede_fed_instancia_%' or acao like 'rede_fed_threads_%' order by acao")).rows;
  return [[...new Set(r.map((x) => x.acao))].join(), r.every((x) => x.d === "{}" && /^[a-z0-9.-]+$/.test(x.alvo))];
}, ([a, limpo]) => a === "rede_fed_instancia_bloqueada,rede_fed_instancia_desbloqueada,rede_fed_threads_bloqueado,rede_fed_threads_liberado" && limpo);
await espera("as funções novas seguem o padrão (security definer, search_path) e as internas não abrem para ninguém", async () => {
  const pub = await um("select prosecdef, array_to_string(proconfig, ',') as cfg from pg_proc where oid = 'public.rede_fed_threads(boolean)'::regprocedure");
  const abertas = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname in ('rede_fed_threads_dominios', 'rede_fed_bloqueio_faxina')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.length;
  return [pub.prosecdef && /search_path=interno, pg_temp/.test(pub.cfg), abertas];
}, ([ok, n]) => ok && n === 0);

// ═══════════════════ Privacidade: sem lista de pessoas, piso de 3 e a prova do consentimento ═══════════════════
// (supabase/migracoes/20261110-fediverso-privacidade.sql). Roda aqui, duas vezes, DEPOIS da do bloqueio padrão, como no banco de
// verdade. O mesmo bloco, idêntico, está no install.sql, depois do bloco do bloqueio padrão.
const privacidade = lerTexto("supabase/migracoes/20261110-fediverso-privacidade.sql");
await espera("o install.sql traz a migração da privacidade idêntica ao arquivo, depois da do bloqueio padrão", async () => install.includes(privacidade) && install.indexOf(privacidade) > install.indexOf(padrao) + padrao.length - 1);
await espera("no install.sql, nada depois do bloqueio padrão redefine a função de bloquear nem a que diz se está bloqueada", async () => /create or replace function (public\.rede_fed_bloquear|interno\.rede_fed_bloqueado)\s*\(/.test(install.slice(install.indexOf(padrao) + padrao.length)), (tem) => tem === false);
await espera("a migração da privacidade roda depois da do bloqueio padrão sem erro", () => banco.exclusivo(() => banco.pg.exec(privacidade)));
await espera("e roda de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(privacidade)));
await espera("quem já estava com a federação ligada antes da migração ganha a linha do 'liga' (e rodar de novo não duplica)", async () => {
  const faltam = "select count(*)::int as n from interno.rede_fed_atores a where a.ligado and not exists (select 1 from interno.fediverso_consentimentos c where c.usuario = a.perfil)";
  await dono("delete from interno.fediverso_consentimentos");
  const antes = (await um(faltam)).n;
  await banco.exclusivo(() => banco.pg.exec(privacidade));
  await banco.exclusivo(() => banco.pg.exec(privacidade));
  const linhas = (await um("select count(*)::int as n, count(distinct usuario)::int as d, bool_and(ligado) as l from interno.fediverso_consentimentos")).n;
  return [antes, (await um(faltam)).n, linhas, (await um("select count(*)::int as n from interno.rede_fed_atores where ligado")).n];
}, ([antes, depois, linhas, ligados]) => antes > 0 && depois === 0 && linhas === ligados);
await espera("ela não redefine a função de bloquear instância nem a que diz se está bloqueada", async () => /create or replace function (public\.rede_fed_bloquear|interno\.rede_fed_bloqueado)\s*\(/.test(privacidade), (tem) => tem === false);
await espera("a trava do bloqueio fixo continua na função depois desta migração", async () => (await um("select prosrc like '%bloqueio_fixo%' as tem from pg_proc where oid = 'public.rede_fed_bloquear(text, boolean, text)'::regprocedure")).tem, (tem) => tem === true);
await recusa("mediador comum continua sem desbloquear o Threads", () => rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "threads.net", p_sim: false, p_motivo: "" }), "bloqueio_fixo");
await recusa("nem a coordenação desbloqueia o Bridgy Fed", () => rpc(coordena(pessoas.ana), "rede_fed_bloquear", { p_dominio: "brid.gy", p_sim: false, p_motivo: "" }), "bloqueio_fixo");
await espera("os três continuam fixos e o domínio escrito de outro jeito continua bloqueado", async () => [await fixos(), await bloqueado("https://x@threads.net./ap/users/1/")], ([d, b]) => d === "brid.gy,threads.com,threads.net" && b === true);
await espera("as funções novas e as redefinidas seguem o padrão (security definer, search_path fixo)", async () => {
  const r = await dono(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in ('rede_fed_ligar', 'rede_fed_perfil_remoto', 'rede_fed_fio_remoto', 'rede_fed_respostas_de', 'rede_fed_bloquear_pessoa', 'rede_fed_silenciar_pessoa', 'rede_fed_situacao', 'rede_fed_servidor'))
       or (n.nspname = 'interno' and p.proname in ('rede_fed_dominio_da_conta', 'rede_fed_aviso_remoto', 'rede_fed_consentimento_historico', 'rede_fed_cartao'))`);
  return [r.rows.length, r.rows.filter((x) => !x.prosecdef || !/search_path=interno, pg_temp/.test(x.cfg)).map((x) => x.proname)];
}, ([n, ruins]) => n === 13 && ruins.length === 0);
await espera("visitante não chama o perfil de fora (nenhuma das duas formas); quem entrou chama", async () => um(`select
  has_function_privilege('anon', 'public.rede_fed_perfil_remoto(text)', 'execute') as a1, has_function_privilege('anon', 'public.rede_fed_perfil_remoto(text, text, integer)', 'execute') as a3,
  has_function_privilege('authenticated', 'public.rede_fed_perfil_remoto(text, text, integer)', 'execute') as p3, has_function_privilege('anon', 'public.rede_fed_ligar(boolean, integer)', 'execute') as al`),
  (r) => r.a1 === false && r.a3 === false && r.p3 === true && r.al === false);
await espera("nenhuma função interna da federação abre para anon ou authenticated", async () => (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.proname like 'rede_fed_%' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.proname), (l) => l.length === 0);
await espera("a tabela do histórico: só usuário, versão, ligado e quando (nada de IP), com RLS, sem política e sem permissão direta", async () => {
  const colunas = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'fediverso_consentimentos' order by column_name")).rows.map((x) => x.column_name).join();
  const t = await um(`select c.relrowsecurity as rls, (select count(*)::int from pg_policy where polrelid = c.oid) as politicas,
    exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'interno' and g.table_name = 'fediverso_consentimentos' and g.grantee in ('anon', 'authenticated', 'PUBLIC')) as aberta
    from pg_class c where c.oid = 'interno.fediverso_consentimentos'::regclass`);
  return [colunas, t.rls, t.politicas, t.aberta];
}, ([c, rls, pol, aberta]) => c === "id,ligado,quando,usuario,versao" && rls === true && pol === 0 && aberta === false);

// O cenário: pessoas novas daqui (eva, fabio, gil; hugo não adere) e gente de fora em longe.teste (nada do que veio antes entra na conta).
const URL_DE_ENTREGA = "https://alumia.teste/api/fediverso/entregar";
const porEndereco = (url) => dono("update interno.configuracoes set valor = valor || jsonb_build_object('url_entrega', $1::text) where chave = 'fediverso'", [url]);
await ligarTotal(true);
await ligarGrupos(true);
await porEndereco(URL_DE_ENTREGA);
for (const nome of ["eva", "fabio", "gil", "hugo"]) {
  pessoas[nome] = await criarUsuario(`${nome}@fedbanco.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_modo = 'aberto', rede_avatar = 'a07' where id = $1", [pessoas[nome], `Pessoa ${nome}`, nome]);
}
for (const nome of ["eva", "fabio", "gil"]) await rpc(como(pessoas[nome]), "rede_aderir", { p_maior: true, p_versao: vigente, p_fediverso: true });
await dono("update interno.rede_fed_atores set ligado_em = now() - interval '1 minute' where ligado");
const LONGE = "https://longe.teste";
const LIA = `${LONGE}/users/lia`;
const TEO = `${LONGE}/users/teo`;
const gente = (n) => `${LONGE}/users/k${n}`;
const conhecer = (ator, handle, nome) => srv("remoto_salvar", { ator, chave_id: `${ator}#main-key`, chave_publica: "-----BEGIN PUBLIC KEY-----x", inbox: `${ator}/inbox`, compartilhada: `${LONGE}/inbox`, handle: `${handle}@longe.teste`, nome, resumo: "", url: `${LONGE}/@${handle}`, avatar: `${LONGE}/rostos/${handle}.png`, tipo: "Person" });
await conhecer(LIA, "lia", "Lia");
await conhecer(TEO, "teo", "Teo");
for (let i = 1; i <= 4; i++) await conhecer(gente(i), `k${i}`, `K${i}`);
const seguirDaqui = async (quem, ator) => {
  const pedido = `${BASE}/f/${quem}-${ator.split("/").pop()}`;
  await srv("seguir", { perfil: pessoas[quem], ator, pedido, sim: true });
  await srv("resposta_follow", { ator, aceito: true, pedido });
};
await seguirDaqui("eva", LIA);
// A nota "x5" é mais nova que a "x1" (o número no nome dá a ordem).
const notaDe = (ator, n, extra = {}) => ({ id: `${LONGE}/notes/${n}`, ator, url: `${LONGE}/n/${n}`, texto: `Nota ${n}`, aviso: "", sensivel: false, publicado: new Date(Date.now() - 60_000 * (50 - Number(n.replace(/\D/g, "") || 0))).toISOString(), visibilidade: "publico", mencoes_locais: [], midia: [], ...extra });
const postEva = await postar(pessoas.eva, "Post público da Eva para o Fediverso.");
const enderecoDoPost = (id) => `${BASE}/api/fediverso/p/${id}`;
const avisosDe = async (quem, tipo) => (await rpc(como(pessoas[quem]), "rede_aviso_listar", { p_cursor: null, p_limite: 50 })).itens.filter((x) => x.tipo === tipo);
const curtir = (n) => srv("interacao", { tipo: "like", ator: gente(n), atividade_id: `${LONGE}/likes/${n}`, post_local: enderecoDoPost(postEva), sim: true });

// 1. Avisos sem lista de pessoas ─────────────────────────────────────────────────────────────────────────────────────────
await espera("o post da Eva saiu para o Fediverso (o cenário vale)", async () => (await um("select count(*)::int as n from interno.rede_fed_enviados where post = $1 and apagado_em is null", [postEva])).n, (n) => n === 1);
await espera("curtida de fora: o aviso não diz quem foi (ator nulo, lista vazia) e diz só 'alguém' (1)", async () => {
  const r = await curtir(1);
  return [r.ok, await avisosDe("eva", "fed_curtida")];
}, ([ok, a]) => ok && a.length === 1 && a[0].ator_remoto === null && Array.isArray(a[0].atores_remotos) && a[0].atores_remotos.length === 0 && a[0].total === 1 && a[0].pessoas === 1 && !JSON.stringify(a[0]).includes("longe.teste"));
await espera("duas curtidas ainda são 'alguém': o número não sai abaixo de 3", async () => { await curtir(2); return avisosDe("eva", "fed_curtida"); },
  (a) => a.length === 1 && a[0].total === 1 && a[0].pessoas === 1 && a[0].ator_remoto === null);
await espera("três curtidas: sai o total (3), e continua sem dizer quem", async () => { await curtir(3); return avisosDe("eva", "fed_curtida"); },
  (a) => a.length === 1 && a[0].total === 3 && a[0].pessoas === 3 && a[0].ator_remoto === null && a[0].atores_remotos.length === 0 && !JSON.stringify(a[0]).includes("longe.teste"));
await espera("bloquear quem curtiu não apaga o aviso de curtida (sumir diria quem foi): o total continua o mesmo", async () => {
  await rpc(como(pessoas.eva), "rede_fed_bloquear_pessoa", { p_ator: gente(3), p_sim: true });
  try {
    return await avisosDe("eva", "fed_curtida");
  } finally {
    await rpc(como(pessoas.eva), "rede_fed_bloquear_pessoa", { p_ator: gente(3), p_sim: false });
  }
}, (a) => a.length === 1 && a[0].total === 3 && a[0].ator_remoto === null);
await espera("impulso de fora num post daqui: também sem dizer quem", async () => {
  await srv("interacao", { tipo: "announce", ator: gente(1), atividade_id: `${LONGE}/a/1`, post_local: enderecoDoPost(postEva), sim: true });
  return avisosDe("eva", "fed_impulso");
}, (a) => a.length === 1 && a[0].ator_remoto === null && a[0].atores_remotos.length === 0 && a[0].total === 1 && !JSON.stringify(a[0]).includes("longe.teste"));
await espera("seguidor de fora continua dizendo quem é, sem o endereço cru do avatar", async () => {
  await srv("seguidor", { handle: "eva", ator: gente(1), inbox: `${gente(1)}/inbox`, compartilhada: `${LONGE}/inbox`, pedido: `${LONGE}/f/eva-k1`, sim: true });
  return avisosDe("eva", "fed_seguidor");
}, (a) => a.length === 1 && a[0].ator_remoto?.ator === gente(1) && a[0].ator_remoto.handle === "k1@longe.teste" && !("avatar" in a[0].ator_remoto) && !JSON.stringify(a[0]).includes("rostos"));
await espera("resposta de fora continua dizendo quem respondeu e qual nota", async () => {
  await srv("nota_recebida", notaDe(gente(2), "resp1", { em_resposta_a: enderecoDoPost(postEva) }));
  return avisosDe("eva", "fed_resposta");
}, (a) => a.length === 1 && a[0].ator_remoto?.ator === gente(2) && a[0].objeto_remoto === `${LONGE}/notes/resp1` && !("avatar" in a[0].ator_remoto));
await espera("menção de fora continua dizendo quem mencionou", async () => {
  await srv("nota_recebida", notaDe(gente(3), "menc1", { mencoes_locais: ["@fabio@alumia.teste"] }));
  return avisosDe("fabio", "fed_mencao");
}, (a) => a.length === 1 && a[0].ator_remoto?.ator === gente(3));
await espera("o remendo do total está em rede_aviso_listar, junto com o de quem é de fora", async () => (await um("select pg_get_functiondef('public.rede_aviso_listar(text, integer)'::regprocedure) as d")).d,
  (d) => d.includes("rede_fed_aviso_total") && d.includes("ator_remoto") && d.includes("atores_remotos") && d.includes("objeto_remoto"));
await espera("o piso do aviso só vale para curtida e impulso de fora (o resto não muda)", async () => um("select interno.rede_fed_aviso_total('fed_curtida', 2) as a, interno.rede_fed_aviso_total('fed_impulso', 3) as b, interno.rede_fed_aviso_total('resposta', 2) as c, interno.rede_fed_aviso_total('fed_seguidor', 1) as d, interno.rede_fed_aviso_total(null, 2) as e"),
  (r) => r.a === 1 && r.b === 3 && r.c === 2 && r.d === 1 && r.e === 2);

// 2. Piso de 3 nas contagens ─────────────────────────────────────────────────────────────────────────────────────────────
await espera("a função do piso: 0, 2 e nulo viram 0; 3 em diante passa", async () => um("select interno.rede_fed_piso(0) as a, interno.rede_fed_piso(2) as b, interno.rede_fed_piso(3) as c, interno.rede_fed_piso(null) as d, interno.rede_fed_piso(40) as e"),
  (r) => r.a === 0 && r.b === 0 && r.c === 3 && r.d === 0 && r.e === 40);
const seguidorDeFora = (handle, n) => srv("seguidor", { handle, ator: gente(n), inbox: `${gente(n)}/inbox`, compartilhada: `${LONGE}/inbox`, pedido: `${LONGE}/f/${handle}-k${n}`, sim: true });
await espera("seguidores: com 1 ou 2 sai 0; com 3 sai 3 (inteiro, como a coleção pede)", async () => {
  const um1 = (await srv("seguidores", { handle: "eva" })).total;
  await seguidorDeFora("eva", 2);
  const dois = (await srv("seguidores", { handle: "eva" })).total;
  await seguidorDeFora("eva", 3);
  return [um1, dois, (await srv("seguidores", { handle: "eva" })).total];
}, ([a, b, c]) => a === 0 && b === 0 && c === 3 && Number.isInteger(c));
await espera("quem a pessoa segue lá fora: com 1 sai 0; com 3 sai 3", async () => {
  const antes = (await srv("seguindo_publico", { handle: "eva" })).total;
  await seguirDaqui("eva", gente(1));
  await seguirDaqui("eva", gente(2));
  const depois = (await srv("seguindo_publico", { handle: "eva" })).total;
  for (const n of [1, 2]) await srv("seguir", { perfil: pessoas.eva, ator: gente(n), sim: false });
  return [antes, depois];
}, ([a, d]) => a === 0 && d === 3);
await espera("a situação da própria pessoa continua com o número dela (só ela vê)", async () => rpc(como(pessoas.eva), "rede_fed_situacao"), (s) => s.seguidores === 3 && s.seguindo === 1);
await espera("NodeInfo: pessoas e ativos passam pelo piso (posts não: não conta pessoas)", async () => {
  const real = await um(`select (select count(*)::int from interno.rede_fed_atores where ligado) as u, (select count(*)::int from interno.rede_fed_enviados where apagado_em is null) as p,
    (select count(distinct e.perfil)::int from interno.rede_fed_enviados e join interno.rede_fed_atores t on t.perfil = e.perfil and t.ligado where e.enviado_em > now() - interval '30 days') as m,
    (select count(distinct e.perfil)::int from interno.rede_fed_enviados e join interno.rede_fed_atores t on t.perfil = e.perfil and t.ligado where e.enviado_em > now() - interval '180 days') as s`);
  return [real, await srv("contagem"), await srv("contagem_ativos")];
}, ([real, c, a]) => real.u >= 3 && c.usuarios === real.u && c.posts === real.p && a.mes === (real.m >= 3 ? real.m : 0) && a.semestre === (real.s >= 3 ? real.s : 0));
await espera("NodeInfo com só duas pessoas ligadas: sai 0 nas pessoas e nos ativos", async () =>
  // Dentro de uma transação desfeita no fim: todo mundo menos duas pessoas fica desligado só para a conta.
  banco.exclusivo(async () => {
    await banco.pg.exec("begin");
    try {
      await banco.pg.query("update interno.rede_fed_atores set ligado = false where perfil not in ($1, $2)", [pessoas.eva, pessoas.fabio]);
      const real = (await banco.pg.query("select count(*)::int as n from interno.rede_fed_atores where ligado")).rows[0].n;
      const c = (await banco.pg.query("select public.rede_fed_servidor($1, 'contagem', '{}'::jsonb) as r", [SEGREDO])).rows[0].r;
      const a = (await banco.pg.query("select public.rede_fed_servidor($1, 'contagem_ativos', '{}'::jsonb) as r", [SEGREDO])).rows[0].r;
      return [real, c.usuarios, a.mes, a.semestre];
    } finally {
      await banco.pg.exec("rollback");
    }
  }), (r) => r.join() === "2,0,0,0");
await espera("Group: seguidores da comunidade com 1 ou 2 sai 0 (no ator e na coleção); com 3 sai 3", async () => {
  const seguirGrupo = (n) => srv("comunidade_seguidor", { slug: disciplina, ator: gente(n), inbox: `${gente(n)}/inbox`, compartilhada: `${LONGE}/inbox`, pedido: `${LONGE}/gf/${n}`, sim: true });
  await dono("delete from interno.fediverso_grupo_seguidores where comunidade = $1", [disciplina]);
  await seguirGrupo(1);
  await seguirGrupo(2);
  const antes = [(await srv("comunidade", { slug: disciplina })).seguidores, (await srv("comunidade_seguidores", { slug: disciplina })).total];
  await seguirGrupo(3);
  return [...antes, (await srv("comunidade", { slug: disciplina })).seguidores, (await srv("comunidade_seguidores", { slug: disciplina })).total];
}, (r) => r.join() === "0,0,3,3");
await espera("respostas de fora a um post daqui: a lista vem inteira, o total só a partir de 3", async () => {
  await srv("nota_recebida", notaDe(gente(3), "resp2", { em_resposta_a: enderecoDoPost(postEva) }));
  const dois = await rpc(como(pessoas.eva), "rede_fed_respostas_de", { p_post: postEva, p_cursor: null, p_limite: 50 });
  await srv("nota_recebida", notaDe(gente(4), "resp3", { em_resposta_a: enderecoDoPost(postEva) }));
  const tres = await rpc(como(pessoas.eva), "rede_fed_respostas_de", { p_post: postEva, p_cursor: null, p_limite: 50 });
  return [dois.itens.length, dois.total, tres.itens.length, tres.total];
}, (r) => r.join() === "2,0,3,3");
for (let i = 1; i <= 5; i++) await srv("nota_recebida", notaDe(LIA, `lia${i}`));
const LIA1 = `${LONGE}/notes/lia1`;
await espera("o cartão: respostas só a partir de 3", async () => {
  for (const n of [1, 2]) await srv("nota_recebida", notaDe(gente(n), `rl${n}`, { em_resposta_a: LIA1 }));
  const dois = await rpc(como(pessoas.eva), "rede_fed_fio_remoto", { p_id: LIA1 });
  await srv("nota_recebida", notaDe(gente(3), "rl3", { em_resposta_a: LIA1 }));
  const tres = await rpc(como(pessoas.eva), "rede_fed_fio_remoto", { p_id: LIA1 });
  return [dois.respostas.length, dois.post.respostas, tres.respostas.length, tres.post.respostas];
}, (r) => r.join() === "2,0,3,3");

// 3. Moderadores do Group ────────────────────────────────────────────────────────────────────────────────────────────────
await espera("Group: quem modera não sai para fora (a coleção vem vazia, mesmo com moderador que federa)", async () => {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ($1, $2, 'moderacao', 'ativo') on conflict (comunidade, usuario) do update set papel = 'moderacao', situacao = 'ativo'", [disciplina, pessoas.eva]);
  const g = await srv("comunidade", { slug: disciplina });
  await dono("delete from interno.rede_comunidade_membros where comunidade = $1 and usuario = $2", [disciplina, pessoas.eva]);
  return [g.estado, g.moderadores, JSON.stringify(g).includes("eva")];
}, ([e, m, vazou]) => e === "ligado" && Array.isArray(m) && m.length === 0 && vazou === false);

// 4. O nome do ator ──────────────────────────────────────────────────────────────────────────────────────────────────────
await espera("ator: com o codinome conferido sai o nome; sem a conferência sai só o @nome (e a bio vazia)", async () => {
  await dono("update interno.perfis set rede_bio = 'Bio da Eva' where id = $1", [pessoas.eva]);
  const com = await srv("ator", { handle: "eva" });
  await dono("update interno.perfis set rede_codinome_ok = false where id = $1", [pessoas.eva]);
  const sem = await srv("ator", { handle: "eva" });
  await dono("update interno.perfis set rede_codinome_ok = true where id = $1", [pessoas.eva]);
  return [com.nome, com.bio, sem.estado, sem.nome, sem.bio];
}, (r) => r.join("|") === "Pessoa eva|Bio da Eva|ligado|eva|");

// 5. A relação no cartão e no perfil ─────────────────────────────────────────────────────────────────────────────────────
const cartaoDireto = async (quem, id) => (await um("select interno.rede_fed_cartao(c, $1) as j from interno.rede_fed_recebidos c where c.id = $2", [pessoas[quem], id])).j;
await espera("o cartão traz a relação de quem lê: tudo falso para quem não fez nada", async () => (await rpc(como(pessoas.eva), "rede_fed_fio_remoto", { p_id: LIA1 })).post,
  (c) => c.silenciado === false && c.bloqueado === false && c.bloqueou_voce === false);
await espera("silenciar aparece no cartão e no perfil de quem silenciou, e só para essa pessoa", async () => {
  await rpc(como(pessoas.eva), "rede_fed_silenciar_pessoa", { p_ator: LIA, p_sim: true });
  const eva = (await rpc(como(pessoas.eva), "rede_fed_fio_remoto", { p_id: LIA1 })).post.silenciado;
  const perfilEva = (await rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA })).silenciado;
  const fabio = (await rpc(como(pessoas.fabio), "rede_fed_fio_remoto", { p_id: LIA1 })).post.silenciado;
  await rpc(como(pessoas.eva), "rede_fed_silenciar_pessoa", { p_ator: LIA, p_sim: false });
  return [eva, perfilEva, fabio, (await cartaoDireto("eva", LIA1)).silenciado];
}, (r) => r.join() === "true,true,false,false");
await espera("bloquear aparece no cartão de quem bloqueou, e só para essa pessoa", async () => {
  await rpc(como(pessoas.gil), "rede_fed_bloquear_pessoa", { p_ator: LIA, p_sim: true });
  const gil = await cartaoDireto("gil", LIA1);
  const eva = await cartaoDireto("eva", LIA1);
  const perfil = await rpc(como(pessoas.gil), "rede_fed_perfil_remoto", { p_ator: LIA });
  await rpc(como(pessoas.gil), "rede_fed_bloquear_pessoa", { p_ator: LIA, p_sim: false });
  return [gil.bloqueado, eva.bloqueado, perfil.bloqueado, perfil.posts.length];
}, (r) => r.join() === "true,false,true,0");
await espera("sem sessão o cartão não diz relação nenhuma", async () => (await um("select interno.rede_fed_cartao(c, null) as j from interno.rede_fed_recebidos c where c.id = $1", [LIA1])).j,
  (c) => c.silenciado === false && c.bloqueado === false && c.bloqueou_voce === false);
await espera("quem foi bloqueado lá fora vê bloqueou_voce no perfil, sem posts; os outros não ficam sabendo", async () => {
  await srv("bloqueio_recebido", { ator: LIA, alvo_handle: "fabio", sim: true });
  const fabio = await rpc(como(pessoas.fabio), "rede_fed_perfil_remoto", { p_ator: LIA });
  const eva = await rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA });
  return [fabio.bloqueou_voce, fabio.posts.length, fabio.proximo, fabio.seguindo, fabio.handle, eva.bloqueou_voce, eva.posts.length > 0, (await cartaoDireto("fabio", LIA1)).bloqueou_voce, (await cartaoDireto("eva", LIA1)).bloqueou_voce];
}, (r) => r.join() === "true,0,,nao,lia@longe.teste,false,true,true,false");
await espera("quem foi bloqueado continua sem ver o fio de quem bloqueou", async () => rpc(como(pessoas.fabio), "rede_fed_fio_remoto", { p_id: LIA1 }).then(() => "viu", (e) => e.message), (r) => r.includes("nao_encontrado"));
await recusa("e o pedido de seguir de quem foi bloqueado não sai", () => srv("seguir", { perfil: pessoas.fabio, ator: LIA, pedido: `${BASE}/f/fabio-lia`, sim: true }), "sem_permissao");
await espera("nada foi para a fila em nome de quem foi bloqueado", async () => (await um("select count(*)::int as n from interno.rede_fed_fila where perfil = $1 and tipo = 'follow' and objeto = $2", [pessoas.fabio, LIA])).n, (n) => n === 0);
await espera("rede_fed_me_bloqueou: diz só a quem foi bloqueado, e vale mesmo depois de o ator sair de rede_fed_remotos (a faxina)", async () => {
  const antes = [await rpc(como(pessoas.fabio), "rede_fed_me_bloqueou", { p_ator: LIA }), await rpc(como(pessoas.eva), "rede_fed_me_bloqueou", { p_ator: LIA })];
  const FANTASMA = `${LONGE}/users/fantasma`;
  await dono("insert into interno.fediverso_bloqueios_recebidos (perfil, ator) values ($1, $2) on conflict do nothing", [pessoas.fabio, FANTASMA]);
  const semAtor = (await um("select count(*)::int as n from interno.rede_fed_remotos where ator = $1", [FANTASMA])).n;
  return [...antes, semAtor, await rpc(como(pessoas.fabio), "rede_fed_me_bloqueou", { p_ator: FANTASMA })];
}, (r) => r.join() === "true,false,0,true");
await recusa("visitante não pergunta se foi bloqueado", () => rpc(anon, "rede_fed_me_bloqueou", { p_ator: LIA }), "permission denied");
await recusa("quem não aderiu também não", () => rpc(como(pessoas.hugo), "rede_fed_me_bloqueou", { p_ator: LIA }), "consentimento");

// 6. Impulso de nota cujo autor ninguém segue ────────────────────────────────────────────────────────────────────────────
const impulsoDaLia = (n) => ({ ator: LIA, atividade_id: `${LONGE}/a/lia-${n}` });
await espera("nota de quem ninguém segue, sem impulso: continua recusada (sem_ligacao)", async () => srv("nota_recebida", notaDe(TEO, "teo0")), (r) => r.guardado === false && r.motivo === "sem_ligacao");
await espera("impulso de quem alguém daqui segue: a nota impulsionada fica guardada (motivo impulso)", async () => {
  const i = await srv("interacao", { tipo: "announce", ...impulsoDaLia("teo1"), objeto_remoto: `${LONGE}/notes/teo1`, sim: true });
  const n = await srv("nota_recebida", { ...notaDe(TEO, "teo1"), impulso: impulsoDaLia("teo1") });
  return [i.ok, n.guardado, n.motivo];
}, (r) => r.join() === "true,true,impulso");
await espera("ela aparece na linha de quem segue quem impulsionou, com quem impulsionou", async () => rpc(como(pessoas.eva), "rede_fed_linha_mista", { p_cursor: null, p_limite: 50 }),
  (l) => l.itens.some((x) => x.id === `${LONGE}/notes/teo1` && x.impulsionado_por?.ator === LIA && x.ator_remoto === TEO));
await espera("e não aparece na linha de quem não segue ninguém ali", async () => rpc(como(pessoas.gil), "rede_fed_linha_mista", { p_cursor: null, p_limite: 50 }), (l) => !l.itens.some((x) => x.id === `${LONGE}/notes/teo1`));
await espera("depois da faxina o impulso continua lá (a nota existe)", async () => {
  await dono("select interno.rede_fed_limpar()");
  return (await um("select count(*)::int as n from interno.fediverso_interacoes where direcao = 'entrada' and tipo = 'announce' and objeto_remoto = $1", [`${LONGE}/notes/teo1`])).n;
}, (n) => n === 1);
await espera("impulso de quem ninguém segue: nem o impulso nem a nota ficam", async () => {
  const i = await srv("interacao", { tipo: "announce", ator: gente(4), atividade_id: `${LONGE}/a/k4-teo2`, objeto_remoto: `${LONGE}/notes/teo2`, sim: true });
  const n = await srv("nota_recebida", { ...notaDe(TEO, "teo2"), impulso: { ator: gente(4), atividade_id: `${LONGE}/a/k4-teo2` } });
  return [i.ok, i.motivo, n.guardado, n.motivo];
}, (r) => r.join() === "false,sem_ligacao,false,sem_ligacao");
await espera("dizer que houve impulso sem o banco ter o impulso não guarda nada", async () => srv("nota_recebida", { ...notaDe(TEO, "teo3"), impulso: impulsoDaLia("inventado") }), (r) => r.guardado === false && r.motivo === "sem_ligacao");
await espera("nota só para seguidores não entra por impulso", async () => {
  await srv("interacao", { tipo: "announce", ...impulsoDaLia("teo4"), objeto_remoto: `${LONGE}/notes/teo4`, sim: true });
  return srv("nota_recebida", { ...notaDe(TEO, "teo4", { visibilidade: "seguidores" }), impulso: impulsoDaLia("teo4") });
}, (r) => r.guardado === false && r.motivo === "sem_seguidor");
await espera("nem a direta", async () => srv("nota_recebida", { ...notaDe(TEO, "teo4", { visibilidade: "direto" }), impulso: impulsoDaLia("teo4") }), (r) => r.guardado === false && r.motivo === "direto");
await espera("com a flag desligada o impulso não guarda nota de quem ninguém segue", async () => {
  await ligarTotal(false);
  try {
    return await srv("nota_recebida", { ...notaDe(TEO, "teo4"), impulso: impulsoDaLia("teo4") });
  } finally {
    await ligarTotal(true);
  }
}, (r) => r.guardado === false);

// 7. A prova do consentimento ────────────────────────────────────────────────────────────────────────────────────────────
const historico = async (quem) => (await dono("select versao, ligado from interno.fediverso_consentimentos where usuario = $1 order by id", [pessoas[quem]])).rows.map((x) => `${x.versao}:${x.ligado}`).join();
const itemDoConsentimento = async (quem) => um("select fediverso, fediverso_versao from interno.rede_consentimentos where usuario = $1 and revogado_em is null order by criado_em desc limit 1", [pessoas[quem]]);
await espera("aceitar o item na entrada já deixa a prova no histórico (versão 2, ligado)", () => historico("gil"), (h) => h === "2:true");
await espera("desligar no perfil grava no histórico e desmarca o item do consentimento de entrada", async () => {
  const s = await rpc(como(pessoas.gil), "rede_fed_ligar", { p_sim: false, p_versao: null });
  return [s.ligado, await historico("gil"), (await itemDoConsentimento("gil")).fediverso, s.pedir_fediverso];
}, (r) => r.join("|") === "false|2:true,2:false|false|false");
await espera("desligar de novo não repete a linha", async () => { await rpc(como(pessoas.gil), "rede_fed_ligar", { p_sim: false, p_versao: null }); return historico("gil"); }, (h) => h === "2:true,2:false");
await espera("ligar de novo no perfil grava outra linha e marca o item (na versão em vigor)", async () => {
  const s = await rpc(como(pessoas.gil), "rede_fed_ligar", { p_sim: true, p_versao: 2 });
  const c = await itemDoConsentimento("gil");
  return [s.ligado, s.consentimento_versao, await historico("gil"), c.fediverso, c.fediverso_versao];
}, (r) => r.join("|") === "true|2|2:true,2:false,2:true|true|2");
await espera("ligar de novo já estando ligado não repete a linha", async () => { await rpc(como(pessoas.gil), "rede_fed_ligar", { p_sim: true, p_versao: 2 }); return historico("gil"); }, (h) => h === "2:true,2:false,2:true");
await espera("desmarcar o item na entrada também grava (o gatilho vale para todos os caminhos)", async () => {
  await rpc(como(pessoas.gil), "rede_aderir", { p_maior: true, p_versao: vigente, p_fediverso: false });
  return [await historico("gil"), (await um("select ligado from interno.rede_fed_atores where perfil = $1", [pessoas.gil])).ligado];
}, (r) => r.join("|") === "2:true,2:false,2:true,2:false|false");
await espera("o histórico tem data e não guarda mais nada da pessoa", async () => (await dono("select * from interno.fediverso_consentimentos where usuario = $1", [pessoas.gil])).rows,
  (l) => l.length === 4 && l.every((x) => x.quando instanceof Date && Object.keys(x).sort().join() === "id,ligado,quando,usuario,versao"));
await espera("suspender a conta desliga a federação e isso também fica no histórico", async () => {
  await rpc(como(pessoas.gil), "rede_fed_ligar", { p_sim: true, p_versao: 2 });
  await dono("update interno.perfis set suspenso = true where id = $1", [pessoas.gil]);
  const h = await historico("gil");
  await dono("update interno.perfis set suspenso = false where id = $1", [pessoas.gil]);
  return h;
}, (h) => h === "2:true,2:false,2:true,2:false,2:true,2:false");

await espera("o teto de ligar (6 por hora) nunca barra o DESLIGAR (a retirada do consentimento), nem divide a cota com a descoberta", async () => {
  // A cota da hora começa do zero (os testes de cima já ligaram algumas vezes nesta mesma hora).
  await dono("delete from interno.limites where chave = $1", [`rede_fed_ligar_sim:${pessoas.gil}`]);
  for (let i = 0; i < 12; i++) await rpc(como(pessoas.gil), "rede_fed_descoberta", { p_sim: i % 2 === 0 }).catch(() => null);
  const liga = [];
  for (let i = 0; i < 7; i++) liga.push(await rpc(como(pessoas.gil), "rede_fed_ligar", { p_sim: true, p_versao: 2 }).then(() => "ok", (e) => e.message.includes("muitos_pedidos") ? "teto" : e.message));
  const desliga = await rpc(como(pessoas.gil), "rede_fed_ligar", { p_sim: false, p_versao: null }).then((s) => s.ligado, (e) => e.message);
  await dono("delete from interno.limites where chave like 'rede_fed_ligar_sim:%'").catch(() => null);
  return [liga.filter((x) => x === "ok").length, liga.at(-1), desliga];
}, (r) => r.join() === "6,teto,false");

// 8. O endereço completo e o cursor do perfil ────────────────────────────────────────────────────────────────────────────
const comEndereco = async (url, total) => {
  await porEndereco(url);
  await ligarTotal(total);
  try {
    return await rpc(como(pessoas.eva), "rede_fed_situacao");
  } finally {
    await porEndereco(URL_DE_ENTREGA);
    await ligarTotal(true);
  }
};
await espera("situação: o endereço completo no domínio curto, no modo total", () => comEndereco("https://alumia.exemplo.org/api/fediverso/entregar", true), (s) => s.endereco === "@eva@exemplo.org" && s.dominio === "exemplo.org" && s.handle === "eva");
await espera("sem o modo total: o endereço no domínio da Alumia", () => comEndereco("https://alumia.exemplo.org/api/fediverso/entregar", false), (s) => s.endereco === "@eva@alumia.exemplo.org" && s.dominio === "alumia.exemplo.org");
await espera("domínio que não dá para encurtar fica inteiro (alumia.teste, rede.exemplo.org)", async () => [(await comEndereco("https://alumia.teste/x", true)).endereco, (await comEndereco("https://rede.exemplo.org:8443/x", true)).endereco],
  (r) => r.join() === "@eva@alumia.teste,@eva@rede.exemplo.org");
await espera("sem o endereço do servidor configurado: endereço nulo (e nada quebra)", async () => {
  await dono("update interno.configuracoes set valor = valor - 'url_entrega' where chave = 'fediverso'");
  try {
    return await rpc(como(pessoas.eva), "rede_fed_situacao");
  } finally {
    await porEndereco(URL_DE_ENTREGA);
  }
}, (s) => s.endereco === null && s.dominio === null && s.logado === true);
await espera("quem não entrou não recebe endereço nenhum", async () => rpc(anon, "rede_fed_situacao"), (s) => s.logado === false && !("endereco" in s));
await espera("quem não ligou a federação não recebe endereço do Fediverso", async () => rpc(como(pessoas.hugo), "rede_fed_situacao"), (s) => s.logado === true && s.endereco === null);
await espera("endereço do servidor com ponto no fim: a conta sai sem o ponto", () => comEndereco("https://alumia.exemplo.org./api/fediverso/entregar", true), (s) => s.endereco === "@eva@exemplo.org" && s.dominio === "exemplo.org");
await espera("perfil de fora em páginas: 2 por vez, sem repetir, da mais nova para a mais antiga, e o fim sem 'proximo'", async () => {
  const p1 = await rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA, p_cursor: null, p_limite: 2 });
  const p2 = await rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA, p_cursor: p1.proximo, p_limite: 2 });
  const p3 = await rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA, p_cursor: p2.proximo, p_limite: 2 });
  return [[p1, p2, p3].map((p) => p.posts.map((x) => x.id.split("/").pop()).join("+")).join(), typeof p1.proximo, typeof p2.proximo, p3.proximo, p2.handle];
}, (r) => r.join("|") === "lia5+lia4,lia3+lia2,lia1|string|string||lia@longe.teste");
await espera("a chamada de sempre (um argumento) continua valendo e traz a primeira página", async () => rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA }),
  (p) => p.posts.length === 5 && p.proximo === null && p.seguindo === "sim" && p.bloqueou_voce === false && p.posts[0].id === `${LONGE}/notes/lia5`);
await recusa("cursor torto é recusado", () => rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA, p_cursor: "ontem", p_limite: 2 }), "invalido:cursor");
await recusa("cursor com data torta também", () => rpc(como(pessoas.eva), "rede_fed_perfil_remoto", { p_ator: LIA, p_cursor: "ontem|x", p_limite: 2 }), "invalido:cursor");

// 9. As RPCs da tela conferem a adesão e a flag ──────────────────────────────────────────────────────────────────────────
const chamadasDaTela = (quem) => [
  () => rpc(como(pessoas[quem]), "rede_fed_perfil_remoto", { p_ator: LIA }),
  () => rpc(como(pessoas[quem]), "rede_fed_perfil_remoto", { p_ator: LIA, p_cursor: null, p_limite: 5 }),
  () => rpc(como(pessoas[quem]), "rede_fed_fio_remoto", { p_id: LIA1 }),
  () => rpc(como(pessoas[quem]), "rede_fed_bloquear_pessoa", { p_ator: LIA, p_sim: true }),
  () => rpc(como(pessoas[quem]), "rede_fed_silenciar_pessoa", { p_ator: LIA, p_sim: true }),
];
const motivos = async (chamadas) => Promise.all(chamadas.map((c) => c().then(() => "passou", (e) => String(e.message))));
await espera("quem não aderiu à rede não usa perfil, fio, bloquear nem silenciar de fora", () => motivos(chamadasDaTela("hugo")), (r) => r.every((m) => m.includes("consentimento")));
await espera("e nada ficou gravado em nome dessa pessoa", async () => (await um("select count(*)::int as n from interno.fediverso_filtros where usuario = $1", [pessoas.hugo])).n, (n) => n === 0);
await espera("com a flag desligada, as quatro recusam (fediverso_desligado) e nada é gravado", async () => {
  await ligarTotal(false);
  try {
    return [await motivos(chamadasDaTela("eva")), (await um("select count(*)::int as n from interno.fediverso_filtros where usuario = $1 and ator = $2", [pessoas.eva, LIA])).n];
  } finally {
    await ligarTotal(true);
  }
}, ([r, n]) => r.every((m) => m.includes("fediverso_desligado")) && n === 0);
await recusa("visitante não chama nenhuma delas", () => rpc(anon, "rede_fed_fio_remoto", { p_id: LIA1 }), "permission denied");
await espera("com a flag ligada e a adesão feita, tudo volta a valer", () => motivos(chamadasDaTela("eva").slice(0, 3)), (r) => r.every((m) => m === "passou"));

// 10. No fim de tudo, a trava do bloqueio fixo segue de pé ───────────────────────────────────────────────────────────────
await espera("rodar a privacidade mais uma vez, com dados, não muda nada do que foi gravado", async () => {
  const conta = "select (select count(*)::int from interno.fediverso_consentimentos) as h, (select count(*)::int from interno.rede_fed_recebidos) as n, (select count(*)::int from interno.avisos) as a, (select count(*)::int from interno.rede_fed_atores where ligado) as l";
  const antes = await um(conta);
  await banco.exclusivo(() => banco.pg.exec(privacidade));
  return JSON.stringify(antes) === JSON.stringify(await um(conta));
});
await recusa("e o Threads continua sem desbloqueio pela mediação", () => rpc(como(pessoas.duda), "rede_fed_bloquear", { p_dominio: "threads.com", p_sim: false, p_motivo: "" }), "bloqueio_fixo");
await espera("o interruptor do Threads continua só da coordenação", async () => rpc(como(pessoas.duda), "rede_fed_threads", { p_bloquear: null }), (r) => r.bloqueado === true && r.pode_mudar === false);

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
