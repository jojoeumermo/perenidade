// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, grupo "conta, identidade e convivência" (Parte H: itens 74 a 80, 104, 105, 107 a 114 e 127 a 129), atrás de
// "alumia-p4-conta":
//   · banco (supabase/migracoes/20261127-p4-conta.sql por cima do install.sql, duas vezes): cada item e a regra de privacidade dele
//     (nenhuma lista de pessoas, nenhum número abaixo de 3, nenhum IP, quem respondeu/foi encaminhada/esperou nunca sai para outra);
//   · os itens que já existiam (77 rel=me, 113 boas-vindas, 128 filtro da comunidade, 129 saúde da comunidade), provados no banco;
//   · as regras puras do aparelho (lib/rede/conta/regras.ts: releia antes de enviar, diário cifrado, modo viagem, respostas rápidas,
//     checkup, horário);
//   · as ligações (flag, rota, registro, encaixe, textos nos seis idiomas).
// Uso: npm run testar:p4-conta
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { paginaApontaDeVolta } from "../lib/rede/secoes-perfil.ts";
import * as R from "../lib/rede/conta/regras.ts";
import * as C from "../lib/rede/conta/cofres.ts";
import * as M from "../lib/rede/conta/mudanca.ts";
import * as A from "../lib/rede/conta/aparelho.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
process.on("uncaughtException", (e) => {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  console.log(`parou: ${e?.message}`);
  process.exit(1);
});
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

const SQL = normal(ler("supabase/migracoes/20261127-p4-conta.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
const TABELAS = [...semComentario.matchAll(/create table if not exists interno\.(rede_p4_ct_\w+)/g)].map((m) => m[1]);

// ═══ 0. A migração, por fora ═══
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("cabeçalho com licença, a ordem (antes do p4-fim), \"Pode rodar mais de uma vez\" e a lei",
  SQL.startsWith("-- Instituto Lúcia") && SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)") && SQL.includes("antes do 20261127-p4-fim.sql")
  && SQL.includes("Pode rodar mais de uma vez") && /Lei: LGPD art\./.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem\(|vale_hash_origem/i.test(semComentario));
ok("o interruptor entra no catálogo protegido por to_regclass", /if to_regclass\('interno\.recursos_catalogo'\) is not null then\s+insert into interno\.recursos_catalogo \(nome, so_pelo_nome\) values \('alumia-p4-conta', true\)/.test(SQL));
ok("não sobe a versão nem mexe na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
ok("não redefine função que já existia (só rede_p4_ct_*)", [...semComentario.matchAll(/create or replace function (\w+)\.(\w+)/g)].every((m) => m[2].startsWith("rede_p4_ct_")));
ok("nenhum random() de segurança", !/random\(\)/.test(semComentario.replace(/gen_random_uuid\(\)/g, "")));
{
  const publicas = [...semComentario.matchAll(/create or replace function public\.(\w+)\([^)]*\)[^$]*?\$\$\s*(declare[\s\S]*?)?begin\s+([^;]+);/g)];
  const semPorta = publicas.filter((m) => !m[3].includes("interno.alumia_porta()")).map((m) => m[1]);
  ok(`toda função pública começa pela porta (${semPorta.join(", ")})`, semPorta.length === 0 && publicas.length >= 10);
}

// ═══ 1. Antes da migração: nada disso existia (o teste falha sem ela) ═══
{
  const banco = await criarBanco(normal(ler("supabase/install.sql")).includes(SQL) ? { antesDe: SQL } : {});
  const n = (await banco.dono("select count(*)::int n from pg_proc where proname like 'rede_p4_ct_%'")).rows[0].n;
  ok(`antes: nenhuma função do grupo (${n})`, n === 0);
  const t = (await banco.dono("select count(*)::int n from pg_class where relname like 'rede_p4_ct_%'")).rows[0].n;
  ok(`antes: nenhuma tabela do grupo (${t})`, t === 0);
  const mv = (await banco.dono("select pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'interno.rede_fed_fila'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%tipo%'")).rows;
  ok("antes: a fila do Fediverso não tinha o tipo move", mv.every((r) => !r.d.includes("'move'")));
  await banco.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const install = normal(ler("supabase/install.sql"));
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const t = (await dono(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'interno' and c.relname = any($1) and c.relkind = 'r'`, [TABELAS])).rows;
  ok(`as tabelas novas existem, todas com RLS ligada (${t.length} de ${TABELAS.length})`, t.length === TABELAS.length && TABELAS.length >= 9 && t.every((x) => x.relrowsecurity));
  const pol = (await dono("select count(*)::int n from pg_policies where schemaname = 'interno' and tablename = any($1)", [TABELAS])).rows[0].n;
  ok("nenhuma política nas tabelas (só as funções)", pol === 0);
  const cols = (await dono(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)`, [TABELAS])).rows;
  ok("nenhuma coluna de endereço de rede", !cols.some((c) => c.data_type === "inet" || /(^|_)ip($|_)|origem|endereco_rede/.test(c.column_name)));
  ok("o quiz não tem coluna de resposta de quem fez (só a certa, da mediação)", !cols.some((c) => c.table_name === "rede_p4_ct_quiz" && /resposta|usuario|quem/.test(c.column_name)));
  ok("a sala de cuidado não guarda a quem a mediação encaminhou", !cols.some((c) => c.table_name === "rede_p4_ct_cuidado" && /usuario|quem|para|alvo/.test(c.column_name)));
  ok("o escudo não guarda quem entrou", !cols.some((c) => c.table_name === "rede_p4_ct_escudo" && /usuario|quem|contas_lista/.test(c.column_name)));
  const cat = (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-conta'")).rows[0];
  ok("o interruptor está no catálogo, só pelo nome", cat?.so_pelo_nome === true);
  const vivo = (await dono("select ligado from interno.recursos_vivos where nome = 'alumia-p4-conta'")).rows[0];
  ok("e começa desligado (sem decisão no painel)", vivo === undefined || vivo.ligado === false);
  const anon = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname like 'rede_p4_ct_%' and has_function_privilege('anon', p.oid, 'execute')`)).rows.map((x) => x.proname);
  ok(`visitante não chama nada do grupo (${anon.join(", ")})`, anon.length === 0);
  const internas = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'interno' and p.proname like 'rede_p4_ct_%' and has_function_privilege('authenticated', p.oid, 'execute')`)).rows.map((x) => x.proname);
  ok(`as funções internas ficam fechadas para quem tem conta (${internas.join(", ")})`, internas.length === 0);
  const servico = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname = 'public' and p.proname in ('rede_p4_ct_mudanca_enviar', 'rede_p4_ct_mudou_para') and has_function_privilege('authenticated', p.oid, 'execute')`)).rows;
  ok("as duas funções do servidor do site (o Move e o movedTo) ficam só com a chave de serviço", servico.length === 0);
  const mv = (await dono("select pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'interno.rede_fed_fila'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%tipo%'")).rows;
  ok("a fila do Fediverso aceita o tipo move (uma regra só de tipo)", mv.length === 1 && mv[0].d.includes("'move'") && mv[0].d.includes("'group-accept'"));
  // A rotina diária do pg_cron (da junção): a mediação vencida e a menção esperando há mais de 30 dias somem sem ninguém abrir a tela.
  // O PGlite não tem pg_cron: confere o comando agendado, que cada parte dele é SQL válido neste banco e que ele apaga o que deve.
  const rotina = /cron\.schedule\('alumia-p4-conta-faxina', '[^']+',\s*'([^']+)'\)/.exec(SQL)?.[1] ?? "";
  ok("78 e 76: a rotina diária chama a faxina das mediações e apaga a menção esperando há mais de 30 dias",
    /select interno\.rede_p4_ct_med_faxina\(\)/.test(rotina) && /delete from interno\.rede_p4_ct_mencoes where criado_em < now\(\) - make_interval\(days => 30\)/.test(rotina));
  let validas = rotina.length > 0;
  for (const parte of rotina.split(";").map((x) => x.trim()).filter(Boolean)) {
    try { await dono(`explain ${parte}`); } catch { validas = false; }
  }
  ok("78 e 76: cada parte da rotina é SQL válido no banco montado", validas);
}

// Pessoas: ana modera a comunidade "roda"; bia, cris, duda e eva são membros; fabi é de fora; gil é conta nova.
const P = {};
for (const [i, nome] of ["ana", "bia", "cris", "duda", "eva", "fabi", "gil"].entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-conta.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Pessoa ${nome}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values
  ('roda', 'Roda de conversa', 'lutas', 'aberta'), ('fechada', 'Roda fechada', 'lutas', 'fechada') on conflict do nothing`);
for (const [slug, quem, papel] of [["roda", "ana", "moderacao"], ["roda", "bia", "membro"], ["roda", "cris", "membro"], ["roda", "duda", "membro"], ["roda", "eva", "membro"],
  ["fechada", "ana", "moderacao"]]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao, entrou_em) values ($1, $2, $3, 'ativo', now() - interval '20 days') on conflict do nothing", [slug, P[quem], papel]);
}
const como = (quem, funcao, args = {}) => rpc({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9" }, funcao, args);
const chamar = async (quem, funcao, args) => {
  await dono("delete from interno.limites");
  return como(quem, funcao, args);
};
/** Nenhum id de pessoa na resposta. */
const semIds = (r, ...quem) => {
  const s = JSON.stringify(r ?? null);
  return (quem.length ? quem : Object.keys(P)).every((k) => !s.includes(P[k]));
};
/** Um post gravado com a sessão da pessoa (auth.uid() valendo para os gatilhos do banco), num comando só. */
const comoAutora = async (quem, texto, comunidade) =>
  (await dono(`insert into interno.rede_posts (autor, texto, tipo, comunidade)
               select $1, $2, 'post', $3 from (select set_config('request.jwt.claims', $4, true)) s returning id, retido`, [P[quem], texto, comunidade, JSON.stringify({ sub: P[quem], role: "authenticated" })])).rows[0];
const avisosDe = async (quem) => (await dono("select texto from interno.avisos where para = $1 order by criado_em", [P[quem]])).rows.map((x) => x.texto);

// ── Desligado: tudo recusa e os gatilhos deixam passar ──
await recusa("desligado: as escolhas recusam", () => chamar("bia", "rede_p4_ct_prefs", {}), "desligado");
await recusa("desligado: o nível recusa", () => chamar("bia", "rede_p4_ct_nivel", { p_nivel: "maximo" }), "desligado");
await dono("insert into interno.rede_p4_ct_prefs (usuario, mencao_revisar) values ($1, true) on conflict (usuario) do update set mencao_revisar = true", [P.bia]);
{
  const post = (await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Olá @pessoa_bia, desligado', 'post') returning id", [P.fabi])).rows[0].id;
  const m = (await dono("select count(*)::int n from interno.rede_mencoes where post = $1 and mencionado = $2", [post, P.bia])).rows[0].n;
  ok("desligado: a menção vira menção como antes (a revisão não segura)", m === 1);
}
await dono("delete from interno.rede_p4_ct_prefs");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-conta', true) on conflict (nome) do update set ligado = true");

// ═══ 3. Os itens ═══

// ── 76. Revisão das menções antes de aparecer ──
{
  await dono("delete from interno.avisos");
  const p0 = await passa("76: as escolhas de quem nunca escolheu (o padrão)", () => chamar("bia", "rede_p4_ct_prefs", {}));
  ok("76: sem revisão por padrão, menção de todas (o9), nada esperando", p0?.mencao_revisar === false && p0.mencao_quem === "todos" && p0.pendentes === 0);
  await passa("76: a bia liga a revisão", () => chamar("bia", "rede_p4_ct_mencao_revisar", { p_sim: true }));
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P.bia, P.cris]);
  const deFora = (await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Oi @pessoa_bia, olha isto', 'post') returning id", [P.fabi])).rows[0].id;
  const deQuemSegue = (await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Valeu @pessoa_bia', 'post') returning id", [P.cris])).rows[0].id;
  const mencoes = (await dono("select post from interno.rede_mencoes where mencionado = $1", [P.bia])).rows.map((x) => x.post);
  ok("76: a menção de quem ela segue aparece na hora", mencoes.includes(deQuemSegue));
  ok("76: a de quem ela não segue não vira menção (espera)", !mencoes.includes(deFora));
  const av = await avisosDe("bia");
  ok(`76: e não sai aviso da que espera (só o da cris) (${JSON.stringify(av)})`, av.filter((t) => t.includes("mencionou você")).length === 1 && av.some((t) => t.includes("Pessoa cris")));
  const fila = await passa("76: a fila da bia", () => chamar("bia", "rede_p4_ct_mencoes", {}));
  ok("76: a fila traz o post que espera, quem escreveu (codinome e @) e um trecho", fila?.itens?.length === 1 && fila.itens[0].post === deFora && fila.itens[0].handle === "pessoa_fabi" && fila.itens[0].trecho.includes("olha isto"));
  ok("76: a fila não traz id de pessoa", semIds(fila));
  const daFabi = await chamar("fabi", "rede_p4_ct_mencoes", {});
  ok("76: quem escreveu não vê a fila da outra (a dela está vazia)", daFabi?.itens?.length === 0);
  ok("76: a contagem de pendentes é só dela", (await chamar("bia", "rede_p4_ct_prefs", {}))?.pendentes === 1 && (await chamar("fabi", "rede_p4_ct_prefs", {}))?.pendentes === 0);
  await recusa("76: a fabi não decide pela bia", () => chamar("fabi", "rede_p4_ct_mencao_decidir", { p_post: deFora, p_aprovar: true }), "nao_encontrado");
  await passa("76: a bia aprova", () => chamar("bia", "rede_p4_ct_mencao_decidir", { p_post: deFora, p_aprovar: true }));
  const depois = (await dono("select count(*)::int n from interno.rede_mencoes where post = $1 and mencionado = $2", [deFora, P.bia])).rows[0].n;
  ok("76: aprovada, vira a menção de sempre", depois === 1);
  ok("76: com o aviso de sempre", (await avisosDe("bia")).some((t) => t.includes("Pessoa fabi mencionou você")));
  const outra = (await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'De novo @pessoa_bia', 'post') returning id", [P.fabi])).rows[0].id;
  await passa("76: a bia recusa a outra", () => chamar("bia", "rede_p4_ct_mencao_decidir", { p_post: outra, p_aprovar: false }));
  const rec = (await dono("select count(*)::int n from interno.rede_mencoes where post = $1", [outra])).rows[0].n;
  const naFila = (await dono("select count(*)::int n from interno.rede_p4_ct_mencoes where post = $1", [outra])).rows[0].n;
  ok("76: recusada, some da fila e não vira menção (sem aviso a ninguém)", rec === 0 && naFila === 0);
  ok("76: quem escreveu não recebe aviso nenhum", !(await avisosDe("fabi")).some((t) => /menção|revis|recus/i.test(t)));
  await recusa("76: decidir de novo a mesma: não existe mais", () => chamar("bia", "rede_p4_ct_mencao_decidir", { p_post: outra, p_aprovar: true }), "nao_encontrado");
  await dono("update interno.rede_o9_prefs set mencao_quem = 'ninguem' where usuario = $1", [P.bia]).catch(() => null);
  await dono("insert into interno.rede_o9_prefs (usuario, mencao_quem) values ($1, 'ninguem') on conflict (usuario) do update set mencao_quem = 'ninguem'", [P.bia]);
  const barrada = (await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Mais uma @pessoa_bia', 'post') returning id", [P.fabi])).rows[0].id;
  const fila2 = (await dono("select count(*)::int n from interno.rede_p4_ct_mencoes where post = $1", [barrada])).rows[0].n;
  ok("76: o \"quem pode me mencionar\" vem antes: o que ele recusa nem entra na fila", fila2 === 0);
  await dono("update interno.rede_o9_prefs set mencao_quem = 'todos' where usuario = $1", [P.bia]);
  await dono("update interno.rede_p4_ct_mencoes set criado_em = now() - interval '31 days'");
  ok("76: a fila some sozinha em 30 dias", (await chamar("bia", "rede_p4_ct_mencoes", {}))?.itens?.length === 0);
}

// ── 107. Níveis de proteção prontos ──
{
  await dono("insert into interno.rede_p4_presenca (usuario, ativo_ate) values ($1, date_trunc('hour', now()) + interval '1 hour') on conflict do nothing", [P.cris]).catch(() => null);
  await dono("insert into interno.rede_p4_contagens (perfil, seguidores, apoios) values ($1, true, true) on conflict (perfil) do update set seguidores = true, apoios = true", [P.cris]).catch(() => null);
  await recusa("107: nível desconhecido", () => chamar("cris", "rede_p4_ct_nivel", { p_nivel: "total" }), "invalido:nivel");
  const max = await passa("107: a cris escolhe o Máximo", () => chamar("cris", "rede_p4_ct_nivel", { p_nivel: "maximo" }));
  ok("107: Máximo: ninguém menciona nem marca, revisão ligada", max?.mencao_quem === "ninguem" && max.marcar_quem === "ninguem" && max.mencao_revisar === true && max.nivel === "maximo");
  ok("107: e diz o que ficou e o que sugere (sair rápido, print, trancar, Fediverso)", max?.ficou?.foto_protegida === true && JSON.stringify(max.sugestoes) === JSON.stringify(["sair_rapido", "print", "trancar", "fediverso"]));
  const o9 = (await dono("select mencao_quem, marcar_quem, marcar_aprovar from interno.rede_o9_prefs where usuario = $1", [P.cris])).rows[0];
  ok("107: gravou nas escolhas de sempre do o9 (as mesmas que a tela de proteção mostra)", o9?.mencao_quem === "ninguem" && o9.marcar_quem === "ninguem" && o9.marcar_aprovar === true);
  if ((await dono("select to_regclass('interno.rede_p4_presenca') is not null as t")).rows[0].t) {
    const pres = (await dono("select count(*)::int n from interno.rede_p4_presenca where usuario = $1", [P.cris])).rows[0].n;
    const cont = (await dono("select seguidores, apoios from interno.rede_p4_contagens where perfil = $1", [P.cris])).rows[0];
    const foto = (await dono("select count(*)::int n from interno.rede_p4_foto_protegida where dono = $1", [P.cris])).rows[0].n;
    ok("107: Máximo desliga o status online e as contagens e protege a foto", pres === 0 && cont?.seguidores === false && cont.apoios === false && foto === 1);
  }
  const bas = await passa("107: volta ao Básico", () => chamar("cris", "rede_p4_ct_nivel", { p_nivel: "basico" }));
  ok("107: Básico: menção de todas, marcação de quem segue com aprovação, sem revisão", bas?.mencao_quem === "todos" && bas.marcar_quem === "seguindo" && bas.marcar_aprovar === true && bas.mencao_revisar === false);
  if ((await dono("select to_regclass('interno.rede_p4_contagens') is not null as t")).rows[0].t) {
    const cont = (await dono("select seguidores, apoios from interno.rede_p4_contagens where perfil = $1", [P.cris])).rows[0];
    const pres = (await dono("select count(*)::int n from interno.rede_p4_presenca where usuario = $1", [P.cris])).rows[0].n;
    ok("107: descer de nível nunca liga o que mostra mais (status e contagens continuam desligados)", cont?.seguidores === false && pres === 0);
  }
  const ref = await chamar("cris", "rede_p4_ct_nivel", { p_nivel: "reforcado" });
  ok("107: Reforçado: menção só de quem segue, revisão das outras", ref?.mencao_quem === "seguindo" && ref.mencao_revisar === true && ref.marcar_quem === "seguindo");
  ok("107: a resposta não traz id de ninguém", semIds(ref));
}

// ── 80. Escudo contra invasão ──
{
  const e0 = await passa("80: o escudo da roda, para a mediação", () => chamar("ana", "rede_p4_ct_escudo", { p_slug: "roda" }));
  ok("80: ligado por padrão: 10 contas com menos de 7 dias em 60 minutos travam por 6 horas", e0?.ligado === true && e0.contas === 10 && e0.conta_dias === 7 && e0.minutos === 60 && e0.horas === 6 && e0.travado_ate === null);
  const eBia = await chamar("bia", "rede_p4_ct_escudo", { p_slug: "roda" });
  ok("80: quem só é membro vê só se está travado (sem a calibragem)", eBia?.modero === false && !("contas" in (eBia ?? {})));
  await recusa("80: só a mediação calibra", () => chamar("bia", "rede_p4_ct_escudo_salvar", { p_slug: "roda", p: { contas: 3 } }), "sem_permissao");
  await recusa("80: nunca abaixo de 3 contas", () => chamar("ana", "rede_p4_ct_escudo_salvar", { p_slug: "roda", p: { contas: 2 } }), "invalido:contas");
  await recusa("80: chave desconhecida", () => chamar("ana", "rede_p4_ct_escudo_salvar", { p_slug: "roda", p: { quem: "x" } }), "invalido:escudo");
  const cal = await passa("80: a ana calibra para 3 contas", () => chamar("ana", "rede_p4_ct_escudo_salvar", { p_slug: "roda", p: { contas: 3, horas: 2 } }));
  ok("80: calibrado", cal?.contas === 3 && cal.horas === 2);
  const novas = [];
  for (let i = 0; i < 4; i++) {
    const id = await criarUsuario(`nova${i}@p4-conta.local`, `nova${i}`);
    await rpc({ papel: "authenticated", sub: id, ip: "198.51.100.40" }, "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [id, `Nova ${i}`, `nova_${i}`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
    novas.push(id);
  }
  await dono("update auth.users set created_at = now() - interval '1 day' where id = any($1)", [novas]);
  await dono("delete from interno.avisos");
  for (const id of novas.slice(0, 2)) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('roda', $1)", [id]);
  ok("80: duas contas novas: não trava", (await chamar("ana", "rede_p4_ct_escudo", { p_slug: "roda" }))?.travado_ate === null);
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('roda', $1)", [novas[2]]);
  const trav = await chamar("ana", "rede_p4_ct_escudo", { p_slug: "roda" });
  ok("80: a terceira conta nova em 60 minutos trava a entrada", trav?.travado_ate !== null);
  const av = await avisosDe("ana");
  ok("80: a mediação recebe um aviso só com os números", av.length === 1 && av[0].includes("3 contas com menos de 7 dias") && !novas.some((id) => av[0].includes(id)) && !/Nova \d|nova_\d/.test(av[0]));
  ok("80: quem é só membro não recebe o aviso", (await avisosDe("bia")).every((t) => !t.includes("Escudo")));
  let barrou = "";
  try { await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('roda', $1)", [novas[3]]); } catch (e) { barrou = e.message; }
  ok("80: travado, a conta nova seguinte não entra (\"escudo\")", barrou.includes("escudo"));
  let antiga = "";
  try { await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('roda', $1)", [P.fabi]); } catch (e) { antiga = e.message; }
  ok("80: conta antiga continua entrando", antiga === "");
  await dono("delete from interno.rede_comunidade_membros where comunidade = 'roda' and usuario = $1", [P.fabi]);
  const destravado = await passa("80: a mediação destrava na mão", () => chamar("ana", "rede_p4_ct_escudo_salvar", { p_slug: "roda", p: { destravar: true } }));
  ok("80: destravado", destravado?.travado_ate === null);
  const tabela = (await dono("select * from interno.rede_p4_ct_escudo where comunidade = 'roda'")).rows[0];
  ok("80: o escudo guarda só a calibragem e o prazo (nenhuma conta)", tabela && !novas.some((id) => JSON.stringify(tabela).includes(id)));
  await dono("delete from interno.rede_comunidade_membros where usuario = any($1)", [novas]);
  await chamar("ana", "rede_p4_ct_escudo_salvar", { p_slug: "roda", p: { contas: 10, horas: 6 } });
}

// ── 127. Quiz das regras ──
{
  await dono("insert into interno.rede_comunidade_regras (comunidade, numero, titulo, texto) values ('roda', 1, 'Respeito sempre', 'Nada de ataque pessoal.') on conflict do nothing");
  await dono("insert into interno.alumia_chegada (comunidade, regras_antes) values ('roda', true) on conflict (comunidade) do update set regras_antes = true");
  await recusa("127: só a mediação (ou o cargo regras) escreve o quiz", () => chamar("bia", "rede_p4_ct_quiz_salvar", { p_slug: "roda", p: [] }), "sem_permissao");
  await recusa("127: no máximo 5 perguntas", () => chamar("ana", "rede_p4_ct_quiz_salvar", { p_slug: "roda", p: Array.from({ length: 6 }, () => ({ pergunta: "Pode xingar?", opcoes: ["Sim", "Não"], certa: 2 })) }), "invalido:quiz");
  await recusa("127: a certa tem de ser uma das opções", () => chamar("ana", "rede_p4_ct_quiz_salvar", { p_slug: "roda", p: [{ pergunta: "Pode xingar?", opcoes: ["Sim", "Não"], certa: 3 }] }), "invalido:certa");
  const QUIZ = [{ pergunta: "Pode atacar a pessoa?", opcoes: ["Sim", "Não, só debater a ideia"], certa: 2 }, { pergunta: "Onde se denuncia?", opcoes: ["No botão Denunciar", "No grupo de fora", "Em lugar nenhum"], certa: 1 }];
  const q = await passa("127: a ana escreve duas perguntas", () => chamar("ana", "rede_p4_ct_quiz_salvar", { p_slug: "roda", p: QUIZ }));
  ok("127: a mediação vê a resposta certa", q?.perguntas?.length === 2 && q.perguntas[0].certa === 2 && q.modero === true);
  const daBia = await chamar("bia", "rede_p4_ct_quiz", { p_slug: "roda" });
  ok("127: quem faz não vê a resposta certa", daBia?.perguntas?.length === 2 && daBia.perguntas.every((x) => !("certa" in x)) && daBia.aceitei === false);
  await recusa("127: com quiz, o \"li e aceito\" sozinho não vale", () => chamar("bia", "alumia_cargos_regras_aceitar", { p_slug: "roda" }), "quiz_pendente");
  const errou = await passa("127: a bia erra uma", () => chamar("bia", "rede_p4_ct_quiz_responder", { p_slug: "roda", p_respostas: [2, 2] }));
  ok("127: errou: diz só quantas (não quais, nem a certa)", errou?.ok === false && errou.erradas === 1 && Object.keys(errou).sort().join() === "erradas,ok");
  ok("127: e nada foi aceito", (await dono("select count(*)::int n from interno.alumia_regras_lidas where comunidade = 'roda' and usuario = $1", [P.bia])).rows[0].n === 0);
  await recusa("127: número errado de respostas", () => chamar("bia", "rede_p4_ct_quiz_responder", { p_slug: "roda", p_respostas: [2] }), "invalido:respostas");
  const acertou = await passa("127: a bia acerta todas", () => chamar("bia", "rede_p4_ct_quiz_responder", { p_slug: "roda", p_respostas: [2, 1] }));
  ok("127: acertou: o aceite de sempre foi gravado", acertou?.ok === true && !!acertou.lidas_em && (await chamar("bia", "rede_p4_ct_quiz", { p_slug: "roda" }))?.aceitei === true);
  const guardou = (await dono("select count(*)::int n from pg_stat_user_tables where relname like 'rede_p4_ct_quiz%'")).rows[0].n;
  ok("127: as respostas não ficam em lugar nenhum (só a tabela das perguntas)", guardou <= 1);
  const post = await passa("127: com o aceite, a bia posta na comunidade que pede as regras antes", () => comoAutora("bia", "Primeiro post na roda", "roda"));
  ok("127: o post entrou", !!post?.id);
  let semAceite = "";
  try { await comoAutora("duda", "Post sem aceitar as regras", "roda"); } catch (e) { semAceite = e.message; }
  ok("127: sem o aceite (sem o quiz), a duda não posta", semAceite.includes("leia_as_regras"));
  await passa("127: a mediação aceita as regras sem quiz", () => chamar("ana", "alumia_cargos_regras_aceitar", { p_slug: "roda" }));
  await recusa("127: a cris (sem fazer o quiz) não aceita pela função de sempre", () => chamar("cris", "alumia_cargos_regras_aceitar", { p_slug: "roda" }), "quiz_pendente");
  await recusa("127: quem não vê a comunidade fechada não vê o quiz dela", () => chamar("bia", "rede_p4_ct_quiz", { p_slug: "fechada" }), "nao_encontrado");
  await passa("127: tirar o quiz (lista vazia)", () => chamar("ana", "rede_p4_ct_quiz_salvar", { p_slug: "roda", p: [] }));
  await passa("127: sem quiz, o aceite de sempre volta a valer", () => chamar("cris", "alumia_cargos_regras_aceitar", { p_slug: "roda" }));
  await dono("update interno.alumia_chegada set regras_antes = false where comunidade = 'roda'");
}

// ── 113. Boas-vindas automáticas (já existiam: interno.alumia_o10_membros_depois) ──
{
  await dono("update interno.alumia_chegada set boas_vindas = 'Que bom ter você aqui. Leia as regras e se apresente.' where comunidade = 'roda'");
  await dono("delete from interno.avisos");
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('roda', $1)", [P.fabi]);
  const av = await avisosDe("fabi");
  ok("113: quem entra recebe as boas-vindas da comunidade num aviso (já existia)", av.length === 1 && av[0].includes("Boas-vindas a “Roda de conversa”") && av[0].includes("Que bom ter você aqui"));
  ok("113: ninguém mais recebe aviso dessa entrada (nem a mediação)", (await avisosDe("ana")).length === 0);
  await dono("delete from interno.rede_comunidade_membros where comunidade = 'roda' and usuario = $1", [P.fabi]);
}

// ── 114. Guia de entrada ──
{
  await recusa("114: só quem cuida das boas-vindas escreve o guia", () => chamar("bia", "rede_p4_ct_guia_salvar", { p_slug: "roda", p: [] }), "sem_permissao");
  await recusa("114: no máximo 6 passos", () => chamar("ana", "rede_p4_ct_guia_salvar", { p_slug: "roda", p: Array.from({ length: 7 }, () => ({ titulo: "Passo", texto: "" })) }), "invalido:guia");
  await recusa("114: link só para dentro da Alumia", () => chamar("ana", "rede_p4_ct_guia_salvar", { p_slug: "roda", p: [{ titulo: "Leia", texto: "", link: "https://fora.example/x" }] }), "invalido:link");
  await recusa("114: sem telefone no texto", () => chamar("ana", "rede_p4_ct_guia_salvar", { p_slug: "roda", p: [{ titulo: "Contato", texto: "liga 11 98765-4321" }] }), "dado_pessoal");
  const g = await passa("114: a ana escreve três passos", () => chamar("ana", "rede_p4_ct_guia_salvar", { p_slug: "roda", p: [
    { titulo: "Leia as regras", texto: "São curtas.", link: "/alumia/c/roda" }, { titulo: "Apresente-se", texto: "Diga de onde vem." }, { titulo: "Siga uma tag", texto: "" }] }));
  ok("114: o guia volta com os passos", g?.passos?.length === 3 && g.passos[0].link === "/alumia/c/roda" && g.posso_editar === true);
  const daBia = await chamar("bia", "rede_p4_ct_guia", { p_slug: "roda" });
  ok("114: quem chega lê o guia (sem editar)", daBia?.passos?.length === 3 && daBia.posso_editar === false);
  ok("114: o banco não guarda o progresso de ninguém", !(await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_ct_guia'")).rows.some((c) => /usuario|feito|progresso/.test(c.column_name)));
}

// ── 105. Sala de cuidado entre pares ──
{
  await recusa("105: só a mediação marca a sala", () => chamar("bia", "rede_p4_ct_cuidado_marcar", { p_slug: "roda", p_sim: true }), "sem_permissao");
  await recusa("105: encaminhar fora de uma sala de cuidado", () => chamar("ana", "rede_p4_ct_cuidado_encaminhar", { p_slug: "roda", p_handle: "pessoa_bia" }), "nao_e_sala");
  const s = await passa("105: a ana marca a roda como sala de cuidado", () => chamar("ana", "rede_p4_ct_cuidado_marcar", { p_slug: "roda", p_sim: true, p_texto: "Aqui a gente se escuta sem julgamento." }));
  ok("105: marcada, com o texto da mediação", s?.sala === true && s.texto.includes("sem julgamento"));
  const lista = await passa("105: as salas que a bia pode ver (para a página Como a Rede cuida)", () => chamar("bia", "rede_p4_ct_cuidados", {}));
  ok("105: a lista traz só o nome e o endereço (nenhum número, nenhuma pessoa)", lista?.salas?.length === 1 && Object.keys(lista.salas[0]).sort().join() === "nome,slug" && semIds(lista));
  await dono("insert into interno.rede_p4_ct_cuidado (comunidade) values ('fechada') on conflict do nothing");
  ok("105: a sala de uma comunidade fechada não aparece para quem não é dela", (await chamar("bia", "rede_p4_ct_cuidados", {}))?.salas?.length === 1);
  await dono("delete from interno.avisos");
  await recusa("105: encaminhar quem não é da comunidade", () => chamar("ana", "rede_p4_ct_cuidado_encaminhar", { p_slug: "roda", p_handle: "pessoa_fabi" }), "nao_encontrado");
  await passa("105: a ana encaminha a duda ao CVV e aos serviços públicos", () => chamar("ana", "rede_p4_ct_cuidado_encaminhar", { p_slug: "roda", p_handle: "@pessoa_duda" }));
  const av = await avisosDe("duda");
  ok("105: a duda recebe, em particular, o 188 e os serviços públicos", av.length === 1 && av[0].includes("188") && av[0].includes("192") && av[0].includes("CAPS"));
  ok("105: ninguém mais fica sabendo (nem quem encaminhou guarda)", (await avisosDe("ana")).length === 0 && (await avisosDe("bia")).length === 0);
  ok("105: a página Como a Rede cuida (/alumia/cuidado) continua (D7) e ganha as salas de cuidado e o CVV", /<SalasDeCuidado /.test(ler("components/rede/moderacao/TelaCuidado.tsx")) && /188/.test(JSON.parse(ler("i18n/rede/conta/pt.json")).cuidado.paginaSobre));
}

// ── 78. Mediação restaurativa ──
{
  await recusa("78: só quem modera abre", () => chamar("bia", "rede_p4_ct_mediacao_abrir", { p_slug: "roda", p_handle_a: "pessoa_cris", p_handle_b: "pessoa_duda" }), "sem_permissao");
  await recusa("78: as duas partes têm de ser da comunidade", () => chamar("ana", "rede_p4_ct_mediacao_abrir", { p_slug: "roda", p_handle_a: "pessoa_cris", p_handle_b: "pessoa_fabi" }), "invalido:partes");
  await dono("delete from interno.avisos");
  const m = await passa("78: a ana convida a cris e a duda", () => chamar("ana", "rede_p4_ct_mediacao_abrir", { p_slug: "roda", p_handle_a: "pessoa_cris", p_handle_b: "@pessoa_duda" }));
  ok("78: nasce como convite, com as duas pelo codinome", m?.situacao === "convite" && m.partes?.length === 2 && m.sou === "mediadora" && semIds(m));
  const avC = await avisosDe("cris");
  ok("78: o aviso não diz com quem nem por quê", avC.length === 1 && avC[0].includes("conversa mediada") && !avC[0].includes("Pessoa duda") && !avC[0].includes("pessoa_duda"));
  await recusa("78: não abre duas vezes para as mesmas", () => chamar("ana", "rede_p4_ct_mediacao_abrir", { p_slug: "roda", p_handle_a: "pessoa_duda", p_handle_b: "pessoa_cris" }), "ja_existe");
  await recusa("78: quem é de fora nem sabe que existe", () => chamar("bia", "rede_p4_ct_mediacao_falar", { p_id: m?.id, p_texto: "oi" }), "nao_encontrado");
  ok("78: e não vê nas mediações dela", (await chamar("bia", "rede_p4_ct_mediacoes", {}))?.itens?.length === 0);
  await recusa("78: falar antes de as duas aceitarem", () => chamar("ana", "rede_p4_ct_mediacao_falar", { p_id: m?.id, p_texto: "Vamos começar" }), "encerrada");
  await passa("78: a cris aceita", () => chamar("cris", "rede_p4_ct_mediacao_responder", { p_id: m?.id, p_aceitar: true }));
  const aberta = await passa("78: a duda aceita", () => chamar("duda", "rede_p4_ct_mediacao_responder", { p_id: m?.id, p_aceitar: true }));
  ok("78: as duas aceitaram: a conversa abre", aberta?.situacao === "aberta");
  await passa("78: a cris fala", () => chamar("cris", "rede_p4_ct_mediacao_falar", { p_id: m?.id, p_texto: "Me senti atacada no fio de ontem." }));
  await passa("78: a duda fala", () => chamar("duda", "rede_p4_ct_mediacao_falar", { p_id: m?.id, p_texto: "Não foi minha intenção, peço desculpas." }));
  const vista = await chamar("ana", "rede_p4_ct_mediacoes", {});
  ok("78: as três leem as falas, pelo codinome", vista?.itens?.[0]?.falas?.length === 2 && vista.itens[0].falas[0].codinome === "Pessoa cris" && semIds(vista));
  await recusa("78: só a mediadora propõe o acordo", () => chamar("cris", "rede_p4_ct_mediacao_propor", { p_id: m?.id, p_acordo: "Conversar com calma no fio." }), "sem_permissao");
  await recusa("78: aceitar sem acordo proposto", () => chamar("cris", "rede_p4_ct_mediacao_acordo", { p_id: m?.id, p_sim: true }), "sem_acordo");
  await passa("78: a ana propõe o acordo", () => chamar("ana", "rede_p4_ct_mediacao_propor", { p_id: m?.id, p_acordo: "As duas debatem ideias no fio, sem ataque pessoal." }));
  const meio = await passa("78: a cris aceita o acordo", () => chamar("cris", "rede_p4_ct_mediacao_acordo", { p_id: m?.id, p_sim: true }));
  ok("78: com uma só, continua aberta", meio?.situacao === "aberta");
  const fim = await passa("78: a duda aceita o acordo", () => chamar("duda", "rede_p4_ct_mediacao_acordo", { p_id: m?.id, p_sim: true }));
  ok("78: as duas aceitaram: termina com acordo", fim?.situacao === "acordo" && fim.acordo.includes("sem ataque pessoal") && fim.falas.length === 0);
  ok("78: as falas foram apagadas do banco", (await dono("select count(*)::int n from interno.rede_p4_ct_med_falas where mediacao = $1", [m?.id])).rows[0].n === 0);
  const hist = (await dono("select count(*)::int n from interno.rede_denuncias")).rows[0].n + (await dono("select count(*)::int n from interno.rede_mod_acoes where alvo in ($1, $2)", [P.cris, P.duda]).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
  ok("78: não entra no histórico de moderação de ninguém", hist === 0);
  await dono("update interno.rede_p4_ct_mediacoes set encerrada_em = now() - interval '31 days' where id = $1", [m?.id]);
  ok("78: o acordo some em 30 dias", (await chamar("cris", "rede_p4_ct_mediacoes", {}))?.itens?.length === 0);
  const m2 = await chamar("ana", "rede_p4_ct_mediacao_abrir", { p_slug: "roda", p_handle_a: "pessoa_bia", p_handle_b: "pessoa_eva" });
  const rec = await passa("78: a eva recusa", () => chamar("eva", "rede_p4_ct_mediacao_responder", { p_id: m2?.id, p_aceitar: false }));
  ok("78: recusou: termina para as três", rec?.situacao === "recusada");
  const daBia = (await chamar("bia", "rede_p4_ct_mediacoes", {}))?.itens?.find((x) => x.id === m2?.id);
  ok("78: e ninguém fica sabendo quem recusou", daBia && daBia.partes.every((p) => p.aceite !== "recusou"));
}

// ── 112. Horário de atendimento e mensagem de ausência ──
{
  await recusa("112: horário inválido", () => chamar("eva", "rede_p4_ct_atendimento_salvar", { p_atendimento: { dias: [1], de: "25:00", ate: "18:00" }, p_ausencia: "" }), "invalido:atendimento");
  await recusa("112: mensagem com telefone", () => chamar("eva", "rede_p4_ct_atendimento_salvar", { p_atendimento: null, p_ausencia: "me liga 11 98765-4321" }), "dado_pessoal");
  ok("112: sem horário nem mensagem: nada aparece para quem vai escrever", (await chamar("bia", "rede_p4_ct_atendimento_de", { p_handle: "pessoa_eva" })) === null);
  const todos = [0, 1, 2, 3, 4, 5, 6];
  await passa("112: a eva põe um horário que nunca cobre agora", async () => {
    const agora = (await dono("select extract(hour from now() at time zone 'America/Sao_Paulo')::int h")).rows[0].h;
    const de = String((agora + 2) % 24).padStart(2, "0"); const ate = String((agora + 3) % 24).padStart(2, "0");
    return chamar("eva", "rede_p4_ct_atendimento_salvar", { p_atendimento: { dias: todos, de: `${de}:00`, ate: `${ate}:00` }, p_ausencia: "Respondo no horário de atendimento." });
  });
  const fora = await chamar("bia", "rede_p4_ct_atendimento_de", { p_handle: "@pessoa_eva" });
  ok("112: fora do horário: quem vai escrever vê o aviso e a mensagem", fora?.fora === true && fora.mensagem === "Respondo no horário de atendimento.");
  ok("112: a resposta não traz id de ninguém", semIds(fora));
  await passa("112: a eva põe um horário que cobre agora (atravessando a meia-noite)", async () => {
    const agora = (await dono("select extract(hour from now() at time zone 'America/Sao_Paulo')::int h")).rows[0].h;
    const de = String((agora + 23) % 24).padStart(2, "0"); const ate = String((agora + 1) % 24).padStart(2, "0");
    return chamar("eva", "rede_p4_ct_atendimento_salvar", { p_atendimento: { dias: todos, de: `${de}:00`, ate: `${ate}:00` }, p_ausencia: "Respondo no horário de atendimento." });
  });
  const dentro = await chamar("bia", "rede_p4_ct_atendimento_de", { p_handle: "pessoa_eva" });
  ok("112: dentro do horário: sem aviso nem mensagem", dentro?.fora === false && dentro.mensagem === "");
  const regra = (await dono(`select interno.rede_p4_ct_fora('{"dias":[1],"de":540,"ate":1080}'::jsonb, '2026-11-23 12:00-03') a,
                                    interno.rede_p4_ct_fora('{"dias":[1],"de":540,"ate":1080}'::jsonb, '2026-11-24 12:00-03') b,
                                    interno.rede_p4_ct_fora('{"dias":[1],"de":1320,"ate":360}'::jsonb, '2026-11-24 02:00-03') c`)).rows[0];
  ok("112: a conta do horário (segunda 9h-18h: segunda ao meio-dia dentro, terça fora; 22h-6h da segunda: terça 2h dentro)", regra.a === false && regra.b === true && regra.c === false);
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.eva, P.duda]);
  ok("112: quem foi bloqueada não vê nada", (await chamar("duda", "rede_p4_ct_atendimento_de", { p_handle: "pessoa_eva" })) === null);
  await dono("delete from interno.rede_bloqueios where quem = $1", [P.eva]);
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_ct_prefs'")).rows.map((c) => c.column_name);
  ok("112: nada é guardado sobre quem perguntou (as escolhas são só da própria pessoa)", !cols.some((c) => /visto|perguntou|quem/.test(c)));
}

// ── 74. Mudar de servidor no Fediverso ──
{
  const m0 = await passa("74: a mudança de quem não ligou a federação", () => chamar("bia", "rede_p4_ct_mudanca", {}));
  ok("74: sem federação ligada, nada a mudar", m0?.federada === false && m0.alvo === null);
  await recusa("74: sem federação, não aponta conta nova", () => chamar("bia", "rede_p4_ct_mudanca_pedir", { p_alvo: "https://outra.example/users/bia" }), "sem_federacao");
  await dono("insert into interno.rede_fed_atores (perfil, handle, ligado, ligado_em) values ($1, 'pessoa_bia', true, now()) on conflict (perfil) do update set ligado = true", [P.bia]);
  for (const [i, caixa] of [["https://a.example/users/um", "https://a.example/inbox"], ["https://a.example/users/dois", "https://a.example/inbox"], ["https://b.example/users/tres", null]].entries()) {
    await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox, inbox_compartilhada) values ($1, $2, $3, $4) on conflict do nothing", [P.bia, caixa[0], `${caixa[0]}/inbox${i}`, caixa[1]]);
  }
  await recusa("74: endereço que não é https", () => chamar("bia", "rede_p4_ct_mudanca_pedir", { p_alvo: "http://outra.example/users/bia" }), "invalido:alvo");
  const pedido = await passa("74: a bia aponta a conta nova", () => chamar("bia", "rede_p4_ct_mudanca_pedir", { p_alvo: "https://outra.example/users/bia" }));
  ok("74: fica esperando a conferência do servidor", pedido?.situacao === "conferir" && pedido.alvo === "https://outra.example/users/bia" && pedido.federada === true);
  ok("74: o número de seguidoras de fora só aparece a partir de 3 (aqui, 3)", pedido?.seguidoras === 3);
  await recusa("74: quem tem conta não manda o Move (só o servidor do site, depois de conferir o alsoKnownAs)", () => chamar("bia", "rede_p4_ct_mudanca_enviar", { p_usuario: P.bia, p_alvo: "https://outra.example/users/bia" }), "permission denied");
  const servico = (f, a) => rpc({ papel: "service_role" }, f, a);
  await recusa("74: o servidor não envia para um endereço diferente do pedido", () => servico("rede_p4_ct_mudanca_enviar", { p_usuario: P.bia, p_alvo: "https://mal.example/users/x" }), "nao_encontrado");
  const env = await passa("74: o servidor envia", () => servico("rede_p4_ct_mudanca_enviar", { p_usuario: P.bia, p_alvo: "https://outra.example/users/bia" }));
  ok("74: um Move por caixa de entrada (a compartilhada conta uma vez)", env?.caixas === 2);
  const fila = (await dono("select tipo, objeto, destino from interno.rede_fed_fila where perfil = $1 and tipo = 'move' order by destino", [P.bia])).rows;
  ok("74: na fila: o Move para a conta nova, uma vez por servidor", fila.length === 2 && fila.every((x) => x.objeto === "https://outra.example/users/bia") && fila[0].destino === "https://a.example/inbox");
  ok("74: enviar de novo não repete", (await servico("rede_p4_ct_mudanca_enviar", { p_usuario: P.bia, p_alvo: "https://outra.example/users/bia" }))?.caixas === 0);
  ok("74: o documento do ator passa a dizer para onde ela foi (movedTo)", (await servico("rede_p4_ct_mudou_para", { p_handle: "pessoa_bia" })) === "https://outra.example/users/bia");
  await recusa("74: depois de enviada, não troca", () => chamar("bia", "rede_p4_ct_mudanca_pedir", { p_alvo: "https://terceira.example/users/bia" }), "ja_enviada");
  // A cópia completa (LGPD art. 18, V) já existia: o testar:alumia-o8-meusdados prova o conteúdo; aqui, que ela continua de pé e
  // pede o segundo fator recente, como antes.
  await recusa("74: a cópia completa dos dados continua existindo (e pede o segundo fator recente)", () => chamar("bia", "rede_meusdados_exportar", {}), "confirme_segundo_fator");
}

// ── As comunidades da pessoa ──
{
  const daAna = await passa("as comunidades da ana", () => chamar("ana", "rede_p4_ct_minhas", {}));
  ok("as da ana: as duas que modera", daAna?.comunidades?.length === 2 && daAna.comunidades.every((c) => c.modero));
  const daFabi = await chamar("fabi", "rede_p4_ct_minhas", {});
  ok("a fabi, sem comunidade, não vê nenhuma", daFabi?.comunidades?.length === 0);
  ok("nenhuma pessoa e nenhum número na resposta", semIds(daAna) && !/membros|total|pessoas/.test(JSON.stringify(daAna)));
}

// ═══ 4. O que já existia, provado ═══

// ── 77. Link verificado do próprio site (rel=me): já existia (onda 12, alumia_perfil_link_*; lib/rede/secoes-perfil.ts) ──
{
  const BASES = ["https://alumia.example", "https://site.example"];
  ok("77: a página de fora com <a rel=\"me\"> para o perfil confere", paginaApontaDeVolta('<a href="https://alumia.example/u/pessoa_bia" rel="me noopener">Alumia</a>', "https://blog.example/", "pessoa_bia", BASES));
  ok("77: rel=\"me\" para o perfil de OUTRA pessoa não confere", !paginaApontaDeVolta('<a href="https://alumia.example/u/pessoa_fabi" rel="me">x</a>', "https://blog.example/", "pessoa_bia", BASES));
  ok("77: link sem rel=\"me\" não confere; dentro de comentário também não", !paginaApontaDeVolta('<a href="https://alumia.example/u/pessoa_bia">x</a><!-- <a rel="me" href="https://alumia.example/u/pessoa_bia"> -->', "https://blog.example/", "pessoa_bia", BASES));
  ok("77: endereço de outro site (não a Alumia) não confere", !paginaApontaDeVolta('<link rel="me" href="https://golpe.example/u/pessoa_bia">', "https://blog.example/", "pessoa_bia", BASES));
  const link = (await dono("insert into interno.alumia_perfil_links (usuario, ordem, titulo, url) values ($1, 1, 'Meu blog', 'https://blog.example/') returning id", [P.bia])).rows[0].id;
  await recusa("77: sem a pessoa pedir, o servidor não marca", () => rpc({ papel: "service_role" }, "alumia_perfil_link_resultado", { p_usuario: P.bia, p_link: link, p_ok: true }), "sem_pedido");
  const pedido = await passa("77: a bia pede a conferência", () => chamar("bia", "alumia_perfil_link_conferir", { p_link: link }));
  ok("77: o banco devolve só o endereço e o @ para o servidor buscar", pedido?.url === "https://blog.example/" && pedido.handle === "pessoa_bia");
  await recusa("77: quem tem conta não marca o próprio link", () => chamar("bia", "alumia_perfil_link_resultado", { p_usuario: P.bia, p_link: link, p_ok: true }), "");
  await passa("77: o servidor (chave de serviço) marca, depois de ler o rel=\"me\"", () => rpc({ papel: "service_role" }, "alumia_perfil_link_resultado", { p_usuario: P.bia, p_link: link, p_ok: true }));
  ok("77: o link fica conferido pelo rel=\"me\"", (await dono("select conferido_como from interno.alumia_perfil_links where id = $1", [link])).rows[0].conferido_como === "rel_me");
  ok("77: a rota do servidor usa o mesmo leitor", /paginaApontaDeVolta/.test(ler("app/api/rede/perfil-link/route.ts")));
}

// ── 128. Filtro automático por comunidade (palavras próprias da mediação, somadas à triagem geral) ──
{
  const fn = (await dono("select count(*)::int n from pg_proc where proname in ('alumia_o9_novata', 'alumia_o9_dominio_bate')")).rows[0].n;
  ok("128: o filtro automático da comunidade existe (o9: links, domínios, conta nova, fila de recém-chegados)", fn === 2);
  const lista = (await dono("select to_regclass('interno.rede_bloqueio_lista') is not null as t")).rows[0].t;
  ok("128: as palavras próprias de cada comunidade existem (rede_bloqueio_lista)", lista === true);
  await passa("128: a ana calibra o filtro da roda (domínio)", () => chamar("ana", "alumia_mod_automod_salvar", { p_slug: "roda", p: { dominios: ["golpe.example"] } }).catch(async (e) => {
    if (!String(e.message).includes("function")) throw e;
    return dono("insert into interno.alumia_automod (comunidade, dominios) values ('roda', '{golpe.example}') on conflict (comunidade) do update set dominios = '{golpe.example}'");
  }));
  const r = await comoAutora("duda", "Vejam https://golpe.example/promo", "roda");
  const limpo = await comoAutora("duda", "Vejam https://boa.example/texto", "roda");
  ok("128: o post sem o domínio da lista entra", limpo?.retido === false);
  ok("128: o post com o domínio da lista da comunidade fica esperando a mediação", r?.retido === true);
}

// ── 129. Saúde da comunidade (atividade e denúncias por semana, agregadas, a partir de 3) ──
{
  const fn = (await dono("select count(*)::int n from pg_proc where proname = 'alumia_decisao_numeros'")).rows[0].n;
  ok("129: os números da comunidade existem (alumia_decisao_numeros)", fn >= 1);
  const n = await passa("129: a mediação abre os números da roda", () => chamar("ana", "alumia_decisao_numeros", { p_slug: "roda" }));
  ok("129: só agregados: nenhum id de pessoa", n && semIds(n));
  const valores = JSON.stringify(n ?? {}).match(/:(\d+)[,}]/g)?.map((x) => Number(x.slice(1, -1))) ?? [];
  ok(`129: nenhum número de pessoas abaixo de 3 (${valores.join(",")})`, valores.every((v) => v === 0 || v >= 3 || v > 1000));
  await recusa("129: quem é só membro não vê", () => chamar("bia", "alumia_decisao_numeros", { p_slug: "roda" }), "");
}

// ═══ 4b. As regras do aparelho ═══
{
  // 79. Releia antes de enviar
  ok("79: texto com palavra que fere: avisa", R.pareceAgressivo("Você é uma idiota, sério").includes("palavra"));
  ok("79: sem acento também (estupido)", R.pareceAgressivo("que estupido isso").includes("palavra"));
  ok("79: tudo em maiúsculas: avisa", R.pareceAgressivo("NINGUÉM AGUENTA MAIS ESSA DIREÇÃO").includes("gritando"));
  ok("79: muitas exclamações: avisa", R.pareceAgressivo("Absurdo!!!").includes("exclamacoes"));
  ok("79: texto calmo não avisa (nem anta dentro de quantas)", R.pareceAgressivo("Quantas pessoas vão ao ato amanhã? Vamos juntas.").length === 0);
  ok("79: sigla curta em maiúsculas não conta como grito", R.pareceAgressivo("Ato do MST e da UNE hoje").length === 0);
  const enc = ler("components/rede/conta/encaixe.tsx");
  const corpoDoReleia = enc.split("export async function releiaAntesDePublicar")[1].split("export const encaixe")[0];
  ok("79: o aviso entra pelo antesDePublicar (sem mexer no compositor) e no chat, e nada vai ao servidor",
    /antesDePublicar: \[releiaAntesDePublicar\]/.test(enc) && !/fetch\(|conta\.|chamar\(/.test(corpoDoReleia) && /<ReleiaNoChat /.test(ler("components/rede/chat/Conversa.tsx")));
  ok("79: o compositor não foi tocado (D10)", !/conta\//.test(ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx")));
  // 107. tour
  ok("107: o tour sugere o Máximo para quem sofre perseguição e o Básico para quem começa", R.nivelDoRisco("perseguida") === "maximo" && R.nivelDoRisco("comeco") === "basico" && R.nivelDoRisco("ato") === "reforcado");
  // 108. checkup
  const agora = Date.parse("2026-11-21T12:00:00Z");
  ok("108: nunca feito: é hora", R.hojeTemCheckup(null, agora));
  ok("108: feito há 10 dias: não", !R.hojeTemCheckup("2026-11-11T12:00:00Z", agora));
  ok("108: feito há 90 dias: é hora de novo", R.hojeTemCheckup("2026-08-23T12:00:00Z", agora));
  const passos = JSON.parse(ler("i18n/rede/conta/pt.json")).checkup.passos;
  const semTela = R.PASSOS_DO_CHECKUP.filter((p) => !(passos[p]?.titulo && passos[p].texto && (!passos[p].link || existe("app/[lang]" + passos[p].link + "/page.tsx"))));
  ok("108: sete passos, cada um com texto e caminho de uma tela que existe (" + semTela.join(", ") + ")", R.PASSOS_DO_CHECKUP.length === 7 && semTela.length === 0);
  // 111. respostas rápidas
  const vinte = Array.from({ length: 20 }, (_, i) => "r" + i);
  ok("111: sem vazias, sem repetidas, no máximo 12", JSON.stringify(R.arrumarRespostas(["oi", " oi ", "", 3, ...vinte])) === JSON.stringify(["oi", ...vinte.slice(0, 11)]));
  ok("111: as respostas ficam numa chave que o Sair rápido apaga (começa com lucia)", /CHAVE_DAS_RESPOSTAS = "lucia:/.test(ler("components/rede/conta/RespostasRapidas.tsx")));
  ok("111: o chat ganha o botão das respostas, que só cola o texto no campo", /<RespostasNoChat lang=\{lang\} aoEscolher=/.test(ler("components/rede/chat/Conversa.tsx")));
  // 112. a conta do horário no aparelho é a mesma do banco
  const seg9a18 = { dias: [1], de: 540, ate: 1080 };
  ok("112: no aparelho, segunda ao meio-dia está dentro e terça está fora", R.foraDoHorario(seg9a18, new Date("2026-11-23T15:00:00Z")) === false && R.foraDoHorario(seg9a18, new Date("2026-11-24T15:00:00Z")) === true);
  ok("112: 22h às 6h da segunda: terça às 2h dentro", R.foraDoHorario({ dias: [1], de: 1320, ate: 360 }, new Date("2026-11-24T05:00:00Z")) === false);
  ok("112: horas por extenso", R.horaDe(540) === "09:00" && R.minutosDe("18:30") === 1110 && R.minutosDe("25:00") === null);
  ok("112: o chat mostra o fora do horário de quem vai receber", /<AvisoDeAtendimento lang=\{lang\} handle=\{conversa\.com\.handle\}/.test(ler("components/rede/chat/Conversa.tsx")));
  // 104. diário
  const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
  const g = mem();
  await recusa("104: senha curta não cria", () => C.criarDiario(g, "curta"), "senha_curta");
  const d = await passa("104: cria o diário", () => C.criarDiario(g, "minha senha longa"));
  const d2 = C.novaEntrada(d, "Hoje fui ao ato e fiquei com medo da polícia.");
  await C.guardarDiario(g, d2);
  const guardado = g.getItem(C.CHAVE_DO_DIARIO) ?? "";
  ok("104: o que fica no aparelho é cifrado (o texto não aparece)", guardado.length > 50 && !guardado.includes("ato") && !guardado.includes("medo"));
  ok("104: a chave do diário não começa com lucia (sobrevive ao Sair rápido) e o cofre não fala com o servidor",
    !C.CHAVE_DO_DIARIO.startsWith("lucia") && !/fetch\(|chamar|supabase/.test(ler("lib/rede/conta/cofres.ts").replace(/\/\/.*$/gm, "")));
  ok("104: senha errada não abre", (await C.abrirDiario(g, "outra senha qualquer")) === null);
  const aberto = await C.abrirDiario(g, "minha senha longa");
  ok("104: a senha certa abre e devolve a entrada", aberto?.entradas?.length === 1 && aberto.entradas[0].texto.includes("medo da polícia"));
  const mexido = JSON.parse(guardado);
  mexido.dado = mexido.dado.slice(0, -8) + "AAAAAAA=";
  g.setItem(C.CHAVE_DO_DIARIO, JSON.stringify(mexido));
  ok("104: bytes mexidos não abrem", (await C.abrirDiario(g, "minha senha longa")) === null);
  // 109. modo viagem
  const v = mem();
  C.garantirViagem(v);
  const fachada = v.getItem(C.CHAVE_DA_VIAGEM);
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
  ok("109: sem ligar, nada some", (await C.escondidasPelaViagem(v, ids)).size === 0);
  await recusa("109: código curto não liga", () => C.ligarViagem(v, "12345", [ids[0]]), "codigo_curto");
  await passa("109: liga escondendo duas conversas", () => C.ligarViagem(v, "codigo secreto", [ids[0], ids[2]]));
  const ligadoV = v.getItem(C.CHAVE_DA_VIAGEM);
  const esc = await C.escondidasPelaViagem(v, ids);
  ok("109: as duas escolhidas somem; a outra fica", esc.size === 2 && esc.has(ids[0]) && esc.has(ids[2]) && !esc.has(ids[1]));
  const forma = (x) => { const o = JSON.parse(x); return [Object.keys(o).sort().join(), o.marcas.length, o.verificador.length, o.sal.length, Object.keys(o.cab).sort().join()].join("|"); };
  ok("109: o registro ligado tem a mesma forma e o mesmo tamanho do de fachada (indistinguível)", forma(ligadoV) === forma(fachada) && Math.abs(ligadoV.length - fachada.length) <= 4);
  ok("109: o registro não traz os ids das conversas", !ids.some((i) => ligadoV.includes(i)));
  ok("109: código errado não mostra", (await C.desligarViagem(v, "outro codigo")) === false && (await C.escondidasPelaViagem(v, ids)).size === 2);
  ok("109: o código certo mostra de novo e volta à fachada", (await C.desligarViagem(v, "codigo secreto")) === true && (await C.escondidasPelaViagem(v, ids)).size === 0 && forma(v.getItem(C.CHAVE_DA_VIAGEM)) === forma(fachada));
  ok("109: a lista do chat usa o filtro do modo viagem", /escondidasPelaViagem\.has\(c\.id\)/.test(ler("components/rede/chat/Tela.tsx")));
  // 74. o Move
  const antigo = "https://alumia.example/api/fediverso/u/pessoa_bia";
  const novo = "https://novo.example/users/bia";
  ok("74: a conta nova que declara a antiga em alsoKnownAs passa", M.declaraApelido({ id: novo, alsoKnownAs: [antigo] }, novo, antigo));
  ok("74: sem o apelido, não", !M.declaraApelido({ id: novo, alsoKnownAs: [] }, novo, antigo));
  ok("74: documento de outro endereço não vale", !M.declaraApelido({ id: "https://golpe.example/users/x", alsoKnownAs: [antigo] }, novo, antigo));
  const mv = M.atividadeMove("https://www.w3.org/ns/activitystreams", "https://alumia.example/a/move/1", antigo, novo);
  ok("74: a atividade Move: o ator antigo, ele mesmo como objeto, a conta nova como alvo", mv.type === "Move" && mv.actor === antigo && mv.object === antigo && mv.target === novo);
  ok("74: o documento do ator ganha movedTo só com a mudança enviada", M.comMovedTo({ id: antigo }, novo).movedTo === novo && !("movedTo" in M.comMovedTo({ id: antigo }, null)));
  ok("74: a fila de entrega monta o Move e o ator diz movedTo", /case "move":/.test(ler("lib/rede/fediverso/entrega.ts")) && /comMovedTo\(/.test(ler("app/api/fediverso/u/[handle]/route.ts")));
  // 110. Checagem do aparelho (app Android)
  const hoje = Date.parse("2026-11-21T12:00:00Z");
  ok("110: aparelho em dia, com bloqueio e sem acessibilidade: nada a avisar", A.avaliarAparelho({ sdk: 35, patch: "2026-10-05", bloqueio: true, acessibilidade: [] }, hoje).length === 0);
  const ruim = A.avaliarAparelho({ sdk: 30, patch: "2025-01-05", bloqueio: false, acessibilidade: ["Leitor X", " "] }, hoje).map((a) => a.tipo).sort().join();
  ok("110: sistema velho, sem atualização há mais de 6 meses, sem bloqueio e com app de acessibilidade: os quatro avisos", ruim === "acessibilidade,antigo,desatualizado,semBloqueio");
  ok("110: data de atualização ilegível não vira aviso falso", A.avaliarAparelho({ sdk: 35, patch: "", bloqueio: true, acessibilidade: [] }, hoje).length === 0);
  const java = ler("android/app/src/main/java/org/institutolucia/app/AlumiaAparelho.java");
  ok("110: o plugin só lê (versão, atualização, bloqueio e nomes da acessibilidade) e está registrado no app", java.includes("isDeviceSecure()") && java.includes("SECURITY_PATCH") && java.includes("getEnabledAccessibilityServiceList")
    && !/HttpURLConnection|new URL|Socket/.test(java) && ler("android/app/src/main/java/org/institutolucia/app/MainActivity.java").includes("registerPlugin(AlumiaAparelho.class)"));
  ok("110: a casca mostra a checagem nos ajustes, só com o lote ligado e só no app", ler("casca/app/Casca.tsx").includes('ligado("alumia-p4-conta") && noApp() ? <ChecagemDoAparelho />'));
  ok("74: a rota do servidor confere o apelido antes de mandar", /declaraApelido\(doc, alvo, fed\.ator\(handle\)\)/.test(ler("app/api/rede/fediverso/mudar/route.ts")));
}

// ═══ 5. As ligações ═══
{
  const recursos = ler("lib/recursos.ts");
  ok("a flag alumia-p4-conta está em RECURSOS e só pelo nome", /"alumia-p4-conta":/.test(recursos) && /SO_PELO_NOME[^;]*"alumia-p4-conta"/.test(recursos));
  ok("a rota /alumia/conta nasce atrás da flag", /nome: "conta", caminho: "\/conta", flag: "alumia-p4-conta"/.test(ler("lib/rede/rotas-novas.ts")));
  ok("a tela está registrada", /conta: \{ componente: dynamic\(\(\) => import\("\.\/conta\/TelaDaConta"\)/.test(ler("components/rede/registro.tsx")));
  ok("a página existe", existe("app/[lang]/alumia/conta/page.tsx"));
  ok("o encaixe entra na lista das frentes", /contaP4/.test(ler("components/rede/encaixes.tsx")));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) ok(`textos em ${l}`, existe(`i18n/rede/conta/${l}.json`));
  const pt = JSON.parse(ler("i18n/rede/conta/pt.json"));
  ok("o português não é rascunho", !pt._rascunho);
  ok("os outros cinco são rascunho", ["en", "es", "fr", "ru", "zh"].every((l) => JSON.parse(ler(`i18n/rede/conta/${l}.json`))._rascunho));
  const nomes = ler("components/painel/alumia/nomes-das-funcoes.ts");
  ok("o painel dá nome ao interruptor novo", /"alumia-p4-conta":/.test(nomes));
}

for (const f of falhas) console.log(`  ✗ ${f}`);
console.log(`\ntestar:p4-conta — ${certos} certos, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
