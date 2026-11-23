// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O seletor de visibilidade do Escrever e o "só mencionados" cifrado (supabase/migracoes/20261122-alumia-visibilidade.sql), num
// Postgres de verdade (scripts/banco-local.mjs):
//   · o install.sql do ramo sobe do zero; a migração roda duas vezes por cima dele; a porta não acha nada aberto;
//   · cada visibilidade publica e só quem deve vê (interno.rede_ve): só eu, amigos próximos (a roda), seguidores, todos na Alumia,
//     Alumia e Fediverso, só a comunidade, o núcleo e a comunidade fechada cifrados;
//   · só "Alumia e Fediverso" federa; "Todos na Alumia" nunca, nem com fediverso-grupos ligado; o post de perfil antigo que já
//     federava continua federando, e a migração não muda post nenhum que já existe;
//   · nada do "só nela" (nem do "só eu", da roda, dos seguidores) sai por RSS, incorporação, Telegram ou resumo das comunidades;
//   · o "só mencionados" no post cifrado funciona com a lista dos @ (só os nomes) e o texto continua vazio no banco;
//   · as contas puras da tela (lib/rede/publicar/visibilidade.ts e o pedido cifrado) e os textos nos seis idiomas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-visibilidade.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { mencionadosDoTexto, opcoesDeVisibilidade, publicoParaConferir, vaiPelaVida, visibilidadeQueVale } from "../lib/rede/publicar/visibilidade.ts";
import { pedidoCifrado } from "../components/rede/publicar/restrito/grupo.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

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

// ═══════════════════ 0. O arquivo ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261122-alumia-visibilidade.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não guarda nem lê endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr/i.test(semComentario));
ok("a migração não mexe na versão da Alumia", !/rede_alumia_versao/.test(semComentario));
ok("a migração não escreve 'Rede Lúcia' em corpo de função", !/Rede Lúcia/.test(semComentario));
{
  const redefinidas = [...semComentario.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\(/g)].map((m) => m[1]);
  ok(`a migração redefine só as seis (${redefinidas.join(", ")})`,
    redefinidas.join() === "interno.rede_vida_ve,interno.rede_vida_federa,interno.rede_vida_nasce,public.rede_pub_vida_publicar,public.rede_pub_vida,public.rede_publicar");
  ok("nenhuma tabela nova e nenhuma permissão de tabela", !/create table|grant [a-z, ]+ on (table )?interno\./i.test(semComentario));
  ok("a federação e o que sai por RSS não são redefinidos (a regra de antes já separa)", !/function interno\.(rede_fed_federavel|alumia_alc_sai)\(/.test(semComentario));
}

// ═══════════════════ 1. O banco do zero e a migração duas vezes ═══════════════════
const install = normal(ler("supabase/install.sql"));
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const linhas = async (s, v = []) => (await dono(s, v)).rows;
const um = async (s, v = []) => (await dono(s, v)).rows[0];
ok("o install.sql do ramo sobe do zero", true);
await espera("a migração roda por cima do install.sql", () => exec(SQL));
await espera("e de novo (idempotente)", () => exec(SQL));
// O install.sql inteiro de novo por cima: as definições finais (a R2 redefiniu funções desta migração) voltam a valer.
await espera("e o install.sql inteiro de novo por cima (as definições finais voltam)", () => banco.instalarDeNovo());
if (install.includes(SQL)) ok("a migração está no fim do install.sql (depois dela, só migrações datadas)", noFimDoInstall(SQL, install));
{
  const r = (await um("select interno.alumia_trancar() as r")).r;
  ok(`trancar não acha nada aberto (abertas: ${JSON.stringify(r.abertas)})`, r.trancadas === 0 && r.abertas.length === 0);
}
const CORPOS = [
  // O corpo de antes inteiro (a lista da integração) mais o que entra aqui.
  ["public.rede_publicar(jsonb)", ["perform interno.alumia_porta()", "enquete", "responde_quem", "audio", "rede3_pub_previa", "rede_triagem",
    "v_corpo_grupo", "interno.rede_grupo_membro(v_grupo, v)", "'invalido:grupo'", "interno.rede_fed_total()", "grupo, corpo_grupo)",
    "'invalido:mencionados'", "e.mencionados", "v_mencionados)", "rede3_pub_dado_pessoal", "regra_simples_odio", "rede_alcance(v_publico)"], ["Rede Lúcia"]],
  ["interno.rede_vida_ve(interno.rede_posts, uuid)", ["p.publico = 'eu' then return false", "p.arquivado_em is not null", "rede_roda x"], []],
  ["interno.rede_vida_federa(interno.rede_posts)", ["in ('roda', 'eu')", "p.nao_listado", "p.fora_do_fediverso", "p.expira_em"], []],
  ["interno.rede_vida_nasce()", ["new.publico := 'eu'", "new.alcance := 'eu'", "new.publico := 'roda'", "new.alcance := 'roda'"], []],
  ["public.rede_pub_vida_publicar(jsonb)", ["perform interno.alumia_porta()", "v_eu", "'roda_vazia'", "rede_pub_publicar_mais", "'eu', v_eu"], []],
  ["public.rede_pub_vida(uuid[])", ["perform interno.alumia_porta()", "'so_eu'", "'roda'"], []],
  // As duas regras de saída, com o corpo final que já existia (não redefinidas aqui).
  ["interno.rede_fed_federavel(interno.rede_posts, integer)", ["interno.rede_vida_federa(p)", "<> 'internet' then", "p.corpo_grupo is not null"], []],
  ["interno.alumia_alc_sai(interno.rede_posts)", ["interno.rede_vida_federa(p)", "interno.rede2_publico(p) = 'internet'", "p.corpo_grupo is null"], []],
];
for (const [f, tem, nunca] of CORPOS) {
  const linha = await um("select prosrc from pg_proc where oid = to_regprocedure($1)", [f]);
  const faltam = linha ? tem.filter((x) => !linha.prosrc.includes(x)) : ["(a função não existe)"];
  const sobram = linha ? nunca.filter((x) => linha.prosrc.includes(x)) : [];
  ok(`o corpo final de ${f} está completo (faltam: ${faltam.join(", ") || "nada"}; sobram: ${sobram.join(", ") || "nada"})`, !faltam.length && !sobram.length);
}
{
  const n = await linhas(`select p.proname, count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where (s.nspname, p.proname) in (('public', 'rede_publicar'), ('interno', 'rede_vida_ve'), ('interno', 'rede_vida_federa'), ('interno', 'rede_vida_nasce'),
      ('public', 'rede_pub_vida_publicar'), ('public', 'rede_pub_vida')) group by p.proname`);
  ok(`uma definição só de cada função redefinida (${n.map((x) => `${x.proname}=${x.n}`).join(", ")})`, n.length === 6 && n.every((x) => x.n === 1));
}
await espera("nenhuma função com valor padrão que dependa do tipo linha de uma tabela", () => linhas(`
  select n.nspname || '.' || p.proname as f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.pronargdefaults > 0 and n.nspname in ('public', 'interno')
    and exists (select 1 from unnest((p.proargtypes::oid[])[p.pronargs - p.pronargdefaults : p.pronargs - 1]) t (o)
                join pg_type ty on ty.oid = t.o join pg_class c on c.oid = ty.typrelid where c.relkind in ('r', 'p'))`), (r) => r.length === 0);
await espera("nenhuma security definer de interno ao alcance de todo mundo (PUBLIC)", () => linhas(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.prosecdef
    and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')`), (r) => r.length === 0);
await espera("as regras novas da tabela estão lá (público 'eu', alcance 'eu', os dois juntos, a lista dos mencionados)", () => linhas(`
  select conname, pg_get_constraintdef(oid) as d from pg_constraint
  where conname in ('rede_posts_publico', 'rede_posts_alcance_v9', 'rede_posts_eu_alcance', 'rede_posts_roda_alcance', 'rede_pub_extras_mencionados')`),
(r) => r.length === 5 && r.find((x) => x.conname === "rede_posts_publico").d.includes("'eu'") && r.find((x) => x.conname === "rede_posts_alcance_v9").d.includes("'eu'"));

try {
  // ═══════════════════ 2. Pessoas, roda, quem segue, comunidades, núcleo ═══════════════════
  let ip = 10;
  const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
  const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
  const P = {};
  const nomes = ["ana", "bia", "caio", "dani", "edu"];
  for (const [i, nome] of nomes.entries()) {
    P[nome] = await criarUsuario(`${nome}@visibilidade.local`, nome);
    await rpc(como(P[nome]), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  const zerar = () => dono("delete from interno.limites");
  // bia segue a ana; dani está na roda da ana; caio só tem conta; edu é da comunidade aberta.
  await dono("insert into interno.rede_seguindo (quem, segue, pendente) values ($1, $2, false)", [P.bia, P.ana]);
  await dono("insert into interno.rede_roda (dono, membro) values ($1, $2)", [P.ana, P.dani]);
  const { id: NUCLEO } = await um("insert into interno.rede_nucleos (nome) values ('Núcleo do teste') returning id");
  // (R2, membros escondidos: o servidor não guarda mais quem é de qual núcleo; a filiação mora no grupo, nos aparelhos.)
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('roda-fechada', 'Roda fechada', 'lutas', 'fechada'), ('praca-aberta', 'Praça aberta', 'lutas', 'aberta'), ('aula-aberta', 'Aula aberta', 'disciplinas', 'aberta')");
  for (const n of ["ana", "bia"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('roda-fechada', $1, 'ativo')", [P[n]]);
  // O grupo cifrado de três pessoas (Ana, Bia e Caio) para o "só mencionados": depois da R2 (membros escondidos) o núcleo não aceita
  // post no servidor, e o grupo daqui é uma comunidade fechada.
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('roda-tres', 'Roda de três', 'lutas', 'fechada') on conflict do nothing");
  for (const n of ["ana", "bia", "caio"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('roda-tres', $1, 'ativo')", [P[n]]);
  for (const n of ["ana", "edu"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('praca-aberta', $1, 'ativo'), ('aula-aberta', $1, 'ativo')", [P[n]]);

  // O modo total do Fediverso ligado e a federação da ana ligada desde ontem (consentimento da versão 2).
  await dono("delete from interno.recursos_vivos where nome in ('fediverso-total', 'fediverso-grupos')");
  await dono("insert into interno.configuracoes (chave, valor) values ('fediverso', '{\"total\": \"true\", \"grupos\": \"true\"}'::jsonb) on conflict (chave) do update set valor = excluded.valor");
  await dono("insert into interno.rede_fed_atores (perfil, handle, ligado, ligado_em, consentimento_versao) values ($1, 'pessoa_ana', true, now() - interval '1 day', 2) on conflict (perfil) do update set ligado = true, ligado_em = now() - interval '1 day', consentimento_versao = 2", [P.ana]);

  const publicar = async (quem, pedido) => {
    await zerar();
    return rpc(como(P[quem]), "rede_publicar", { p: pedido });
  };
  const comVida = async (quem, pedido) => {
    await zerar();
    return rpc(como(P[quem]), "rede_pub_vida_publicar", { p: pedido });
  };
  const linha = (id) => um("select publico, alcance, texto, corpo_grupo from interno.rede_posts where id = $1", [id]);
  /** Quem vê o post: um mapa { ana, bia, caio, dani, edu, anon } com interno.rede_ve(p, quem). */
  const quemVe = async (id) => {
    const r = await um(`select interno.rede_ve(p, $2) a, interno.rede_ve(p, $3) b, interno.rede_ve(p, $4) c, interno.rede_ve(p, $5) d, interno.rede_ve(p, $6) e,
      interno.rede_ve(p, null) v from interno.rede_posts p where p.id = $1`, [id, P.ana, P.bia, P.caio, P.dani, P.edu]);
    return `${r.a ? "A" : "-"}${r.b ? "B" : "-"}${r.c ? "C" : "-"}${r.d ? "D" : "-"}${r.e ? "E" : "-"}${r.v ? "V" : "-"}`;
  };
  const sai = async (id) => um("select interno.rede_fed_federavel(p) as fed, interno.alumia_alc_sai(p) as alc from interno.rede_posts p where p.id = $1", [id]);
  const CIFRA = "p2.3.dmV0b3I.Y2lmcmFkb3NlZ3JlZG9wYWxhdnJhdW5pY2E";

  // ═══════════════════ 3. Cada visibilidade publica, e só quem deve vê ═══════════════════
  const V = {};
  V.eu = await espera("só eu: publica pela vida do post", () => comVida("ana", { texto: "Nota só minha, palavraunicaeu.", publico: "eu" }), (r) => r?.id);
  V.roda = await espera("amigos próximos (a roda): publica", () => comVida("ana", { texto: "Para a roda.", publico: "roda" }), (r) => r?.id);
  V.seguidores = await espera("seguidores: publica", () => publicar("ana", { texto: "Para quem me segue.", publico: "seguidores" }), (r) => r?.id);
  V.membros = await espera("todos na Alumia (só nela): publica", () => publicar("ana", { texto: "Para toda a Alumia.", publico: "membros" }), (r) => r?.id);
  V.internet = await espera("Alumia e Fediverso: publica (modo total ligado)", () => publicar("ana", { texto: "Para a Alumia e o Fediverso.", publico: "internet" }), (r) => r?.id);
  V.comunidade = await espera("só a comunidade: publica", () => publicar("ana", { comunidade: "praca-aberta", publico: "comunidade", texto: "Só a praça." }), (r) => r?.id);
  V.membrosAula = await espera("todos na Alumia numa comunidade das disciplinas: publica", () => publicar("ana", { comunidade: "aula-aberta", publico: "membros", texto: "Da aula, só na Alumia." }), (r) => r?.id);
  V.internetAula = await espera("aberto na internet numa comunidade das disciplinas: publica", () => publicar("ana", { comunidade: "aula-aberta", publico: "internet", texto: "Da aula, aberto." }), (r) => r?.id);
  await recusa("núcleo cifrado: o servidor não aceita mais (R2: o mural do núcleo é do grupo, nos aparelhos)", () => publicar("ana", { publico: "nucleo", nucleo: NUCLEO, grupo: `nucleo:${NUCLEO}`, corpo_grupo: CIFRA }), "sem_permissao");
  V.fechada = await espera("comunidade fechada cifrada: publica", () => publicar("ana", { comunidade: "roda-fechada", publico: "comunidade", grupo: "comunidade:roda-fechada", corpo_grupo: CIFRA }), (r) => r?.id);
  const id = (k) => V[k]?.id;

  await espera("só eu: gravado com público e alcance 'eu'", () => linha(id("eu")), (r) => r.publico === "eu" && r.alcance === "eu");
  await espera("a roda continua com público e alcance 'roda'", () => linha(id("roda")), (r) => r.publico === "roda" && r.alcance === "roda");
  // A = ana (autora), B = bia (segue), C = caio (só conta), D = dani (na roda), E = edu (da comunidade), V = visitante.
  const esperado = {
    eu: "A-----", roda: "A--D--", seguidores: "AB----", membros: "ABCDE-", internet: "ABCDE-", comunidade: "A---E-",
    membrosAula: "ABCDE-", internetAula: "ABCDEV", fechada: "AB----",
  };
  for (const [k, quem] of Object.entries(esperado)) await espera(`quem vê "${k}" é ${quem}`, () => quemVe(id(k)), (r) => r === quem);
  await espera("só eu: a regra antiga (interno.rede_ve de um argumento) também não entrega a ninguém além da autora", async () => {
    const r = await banco.exclusivo(async () => {
      const lerComo = async (quem) => {
        await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: quem })]);
        return (await banco.pg.query("select interno.rede_ve(p) v from interno.rede_posts p where p.id = $1", [id("eu")])).rows[0].v;
      };
      const out = [await lerComo(P.ana), await lerComo(P.bia), await lerComo(P.dani)];
      await banco.pg.query("select set_config('request.jwt.claims', '', false)");
      return out;
    });
    return r;
  }, (r) => r[0] === true && r[1] === false && r[2] === false);
  await espera("só eu: a busca de outra pessoa não acha", async () => {
    await zerar();
    const r = await rpc(como(P.bia), "rede_desc_buscar", { p_q: "palavraunicaeu" });
    return (r.itens ?? []).map((x) => x.id);
  }, (ids) => !ids.includes(id("eu")));
  await espera("só eu: o selo só para a autora (rede_pub_vida)", async () => [
    (await rpc(como(P.ana), "rede_pub_vida", { p_ids: [id("eu")] }))?.[id("eu")]?.so_eu,
    (await rpc(como(P.bia), "rede_pub_vida", { p_ids: [id("eu")] }))?.[id("eu")],
  ], ([a, b]) => a === true && b === undefined);
  await recusa("só eu: ninguém mais responde (o post não existe para a bia)", () => publicar("bia", { resposta_a: id("eu"), texto: "Oi?" }), "nao_encontrado");
  const respostaEu = await espera("só eu: a autora responde ao próprio post e a resposta herda o 'eu'", async () => linha((await publicar("ana", { resposta_a: id("eu"), texto: "Continuação." })).id),
    (r) => r.publico === "eu" && r.alcance === "eu");
  void respostaEu;
  await recusa("só eu numa comunidade: recusa", () => comVida("ana", { texto: "x", publico: "eu", comunidade: "praca-aberta" }), "invalido:publico");
  await recusa("só eu como resposta: recusa", () => comVida("ana", { texto: "x", publico: "eu", resposta_a: id("membros") }), "invalido:publico");
  await recusa("só eu direto no rede_publicar (sem a vida do post): recusa", () => publicar("ana", { texto: "x", publico: "eu" }), "invalido:publico");
  await espera("só eu com não listado: o não listado não vale (não é post de lista)", async () => {
    const r = await comVida("ana", { texto: "Só eu, não listado?", publico: "eu", nao_listado: true });
    return um("select publico, nao_listado from interno.rede_posts where id = $1", [r.id]);
  }, (r) => r.publico === "eu" && r.nao_listado === false);
  if (await um("select to_regprocedure('public.rede_pub_o12_publicar(jsonb)') is not null as t").then((r) => r.t)) {
    await espera("só eu pelo compositor da onda 12 (arranjo, legenda, figurinha) também fica 'eu'", async () => {
      await zerar();
      return linha((await rpc(como(P.ana), "rede_pub_o12_publicar", { p: { texto: "Pelo compositor.", publico: "eu" } })).id);
    }, (r) => r.publico === "eu" && r.alcance === "eu");
  }
  if (await um("select to_regprocedure('public.rede_pub_o12_fio(jsonb)') is not null as t").then((r) => r.t)) {
    await espera("só eu num fio: todos os blocos ficam 'eu'", async () => {
      await zerar();
      const r = await rpc(como(P.ana), "rede_pub_o12_fio", { p: { publico: "eu", blocos: [{ texto: "Bloco um." }, { texto: "Bloco dois." }] } });
      return linhas("select publico, alcance from interno.rede_posts where id = any ($1::uuid[])", [r.ids]);
    }, (r) => r.length === 2 && r.every((x) => x.publico === "eu" && x.alcance === "eu"));
  }

  // ═══════════════════ 4. Só "Alumia e Fediverso" federa; nada do "só nela" sai por RSS, incorporação, Telegram ou resumo ═══════════════════
  for (const k of ["eu", "roda", "seguidores", "membros", "comunidade", "membrosAula", "fechada"]) {
    await espera(`"${k}" não federa nem sai por RSS, incorporação, Telegram ou resumo`, () => sai(id(k)), (r) => r.fed === false && r.alc === false);
  }
  await espera("Alumia e Fediverso federa (e, como na Alumia vale para quem tem conta, não sai pelo RSS aberto)", () => sai(id("internet")), (r) => r.fed === true && r.alc === false);
  await espera("controle: o aberto na internet da aula federa e sai pelo RSS", () => sai(id("internetAula")), (r) => r.fed === true && r.alc === true);
  await espera("RSS, incorporação, Telegram e resumo das comunidades passam por interno.alumia_alc_sai", async () => linhas(`select p.proname, position('alumia_alc_sai' in p.prosrc) > 0 as usa
      from pg_proc p where p.oid in (to_regprocedure('public.rede_alc_rss(text, text)'), to_regprocedure('public.rede_alc_post(uuid)'),
        to_regprocedure('public.rede_pontes_telegram_pendentes(integer)'), to_regprocedure('interno.alumia_pontes_resumo_texto(uuid)'))`),
  (r) => r.length === 4 && r.every((x) => x.usa));
  await espera("a incorporação de um post só na Alumia e de um só eu voltam vazias", async () => [
    await rpc(visitante(), "rede_alc_post", { p_post: id("membros") }), await rpc(visitante(), "rede_alc_post", { p_post: id("eu") })], (r) => r.every((x) => x === null));
  await espera("o grupo do Fediverso (fediverso-grupos ligado) também passa pela mesma regra: o 'só nela' da aula não entra na caixa de saída do grupo", async () =>
    linhas("select interno.rede_fed_grupo_ok('aula-aberta') ok, interno.rede_fed_federavel(p) fed from interno.rede_posts p where p.id = $1", [id("membrosAula")]),
  (r) => r[0].ok === true && r[0].fed === false);
  await espera("nada do 'só nela', do 'só eu', da roda ou dos seguidores ficou na fila de saída da federação", async () =>
    linhas("select objeto from interno.rede_fed_fila where objeto = any ($1::text[])", [["eu", "roda", "seguidores", "membros", "membrosAula", "comunidade"].map(id)]), (r) => r.length === 0);

  // O post de perfil antigo que já federava continua: o "internet" gravado (P9) e o antigo sem público, com o alcance "publico".
  const { id: ANTIGO } = await um(`insert into interno.rede_posts (autor, tipo, texto, publico, alcance, avaliacao) values ($1, 'post', 'Post antigo de perfil.', null, 'publico', 'publicada') returning id`, [P.ana]);
  await espera("o post de perfil antigo (sem público, alcance público) vale como 'membros' na Alumia e continua federando", async () => [
    (await um("select interno.rede2_publico(p) x from interno.rede_posts p where p.id = $1", [ANTIGO])).x, await sai(ANTIGO)], ([pub, s]) => pub === "membros" && s.fed === true);
  const antes = await linhas("select id, publico, alcance from interno.rede_posts order by id");
  await espera("a migração de novo, com posts no banco", () => exec(SQL));
  await espera("e ela não muda o público de post nenhum que já existe", async () => JSON.stringify(await linhas("select id, publico, alcance from interno.rede_posts order by id")) === JSON.stringify(antes), (r) => r === true);
  await espera("depois de rodar de novo, o antigo e o Alumia e Fediverso continuam federando", async () => [await sai(ANTIGO), await sai(id("internet"))], (r) => r.every((x) => x.fed === true));
  await espera("e o 'só nela' continua sem sair", () => sai(id("membros")), (r) => r.fed === false && r.alc === false);
  await dono("update interno.configuracoes set valor = '{\"total\": \"false\"}'::jsonb where chave = 'fediverso'");
  await recusa("modo total desligado: Alumia e Fediverso não é aceito no perfil", () => publicar("ana", { publico: "internet", texto: "Sem o modo total." }), "invalido:publico");
  await dono("update interno.configuracoes set valor = '{\"total\": \"true\"}'::jsonb where chave = 'fediverso'");

  // ═══════════════════ 5. "Só mencionados" no post cifrado ═══════════════════
  const cifrado = (extra) => ({ comunidade: "roda-tres", publico: "comunidade", grupo: "comunidade:roda-tres", corpo_grupo: CIFRA, responde_quem: "mencionados", ...extra });
  const resposta = (quem, post) => publicar(quem, { resposta_a: post, grupo: "comunidade:roda-tres", corpo_grupo: CIFRA });
  const comLista = await espera("o post cifrado com só mencionados leva a lista dos @ (só os nomes)", () => publicar("ana", cifrado({ mencionados: ["@Pessoa_Bia", "pessoa_bia"] })), (r) => r?.id && r.texto === "");
  await espera("no banco o texto continua vazio, e a lista fica em minúsculas, sem repetir", async () => [await linha(comLista?.id), await um("select mencionados from interno.rede_pub_extras where post = $1", [comLista?.id])],
    ([p, e]) => p.texto === "" && p.corpo_grupo === CIFRA && JSON.stringify(e.mencionados) === JSON.stringify(["pessoa_bia"]));
  await espera("quem foi mencionada responde", () => resposta("bia", comLista?.id), (r) => r?.id);
  await recusa("quem não foi mencionado não responde", () => resposta("caio", comLista?.id), "sem_permissao");
  await espera("a autora responde sempre", () => resposta("ana", comLista?.id), (r) => r?.id);
  await espera("a lista não sai em nenhum JSON do post (nem para quem é do grupo)", async () => JSON.stringify([
    await rpc(como(P.bia), "rede_post", { p_id: comLista?.id }), (await um("select interno.rede_post_v2(p, $2::uuid, true) j from interno.rede_posts p where p.id = $1", [comLista?.id, P.caio])).j]),
  (s) => !/"mencionados"\s*:/.test(s) && !s.includes('["pessoa_bia"]'));
  const semLista = await espera("o post cifrado com só mencionados e ninguém marcado publica", () => publicar("ana", cifrado({})), (r) => r?.id);
  await recusa("sem lista, ninguém além da autora responde", () => resposta("bia", semLista?.id), "sem_permissao");
  await recusa("lista num post aberto: recusa (lá o servidor lê os @ no texto)", () => publicar("ana", { texto: "Oi @pessoa_bia", responde_quem: "mencionados", mencionados: ["pessoa_bia"] }), "invalido:mencionados");
  await recusa("lista sem só mencionados: recusa", () => publicar("ana", cifrado({ responde_quem: "todos", mencionados: ["pessoa_bia"] })), "invalido:mencionados");
  await recusa("lista com mais de 20: recusa", () => publicar("ana", cifrado({ mencionados: Array.from({ length: 21 }, (_, i) => `pessoa_${i}xx`) })), "invalido:mencionados");
  await recusa("lista com nome fora do formato: recusa", () => publicar("ana", cifrado({ mencionados: ["pessoa bia"] })), "invalido:mencionados");
  await recusa("lista que não é lista: recusa", () => publicar("ana", cifrado({ mencionados: "pessoa_bia" })), "invalido:mencionados");
  await recusa("lista numa resposta: recusa (quem decide é o post que abre a conversa)", () => publicar("bia", { resposta_a: comLista?.id, grupo: "comunidade:roda-tres", corpo_grupo: CIFRA, mencionados: ["pessoa_caio"] }), "invalido:mencionados");
  const aberto = await espera("controle: no post aberto, só mencionados continua lendo os @ do texto", () => publicar("ana", { texto: "Chamo @pessoa_bia para a conversa.", responde_quem: "mencionados" }), (r) => r?.id);
  await espera("a mencionada no texto aberto responde", () => publicar("bia", { resposta_a: aberto?.id, texto: "Cheguei." }), (r) => r?.id);
  await recusa("e quem não foi mencionado no texto aberto não", () => publicar("caio", { resposta_a: aberto?.id, texto: "E eu?" }), "sem_permissao");
} catch (erro) {
  falhas.push(`tropeço no meio do teste: ${erro.stack ?? erro.message}`);
}

// ═══════════════════ 6. As contas puras da tela ═══════════════════
{
  const fedi = (total, ligado, pode = true) => ({ total, ligado, pode });
  const valores = (ctx) => opcoesDeVisibilidade(ctx).map((o) => `${o.valor}${o.saiDaAlumia ? "*" : ""}${o.desligada ? "!" : ""}`).join();
  const base = { comunidade: null, ato: false, comVida: true, soEu: true, equipe: false };
  ok("perfil com o modo total: só eu, amigos próximos, seguidores, todos na Alumia e Alumia e Fediverso (o único que sai)",
    valores({ ...base, fediverso: fedi(true, true) }) === "eu,roda,seguidores,membros,internet*");
  ok("banco sem o público 'só eu' (versão de antes): a opção não aparece (o post ficaria para os seguidores)",
    valores({ ...base, soEu: false, fediverso: fedi(true, true) }) === "roda,seguidores,membros,internet*");
  ok("perfil sem o modo total: Alumia e Fediverso não aparece", valores({ ...base, fediverso: fedi(false, true) }) === "eu,roda,seguidores,membros");
  ok("perfil com o modo total e a federação desligada no perfil: aparece apagada, com o porquê",
    opcoesDeVisibilidade({ ...base, fediverso: fedi(true, false) }).find((o) => o.valor === "internet")?.desligada === "fediverso_desligado_no_perfil");
  ok("perfil impedido de federar: aparece apagada, com o porquê", opcoesDeVisibilidade({ ...base, fediverso: fedi(true, true, false) }).find((o) => o.valor === "internet")?.desligada === "fediverso_impedido");
  ok("ato: sem só eu e sem a roda", valores({ ...base, ato: true, fediverso: fedi(false, null) }) === "seguidores,membros");
  ok("comunidade de luta: a comunidade, todos na Alumia e seguidores (nada sai)", valores({ ...base, comunidade: { categoria: "lutas" }, fediverso: fedi(true, true) }) === "comunidade,membros,seguidores");
  ok("comunidade das disciplinas: também o aberto na internet", valores({ ...base, comunidade: { categoria: "disciplinas" }, fediverso: fedi(false, null) }) === "comunidade,membros,seguidores,internet*");
  ok("equipe: a opção da equipe por último", valores({ ...base, equipe: true, fediverso: fedi(false, null) }).endsWith(",equipe"));
  const lista = opcoesDeVisibilidade({ ...base, fediverso: fedi(true, false) });
  ok("a escolha que deixou de valer volta para todos na Alumia (que nunca sai)", visibilidadeQueVale("internet", lista) === "membros" && visibilidadeQueVale("eu", lista) === "eu"
    && visibilidadeQueVale("roda", opcoesDeVisibilidade({ ...base, ato: true, fediverso: fedi(false, null) })) === "membros");
  ok("só eu e a roda vão pela vida do post, conferidos como seguidores", vaiPelaVida("eu") && vaiPelaVida("roda") && !vaiPelaVida("membros")
    && publicoParaConferir("eu") === "seguidores" && publicoParaConferir("roda") === "seguidores" && publicoParaConferir("internet") === "internet");
  ok("os @ do texto: em minúsculas, sem repetir, sem gente de fora (@nome@servidor) nem e-mail",
    JSON.stringify(mencionadosDoTexto("Oi @Rosa_V e @rosa_v, @tiao@mastodon.social, rosa@email.com e @li.")) === JSON.stringify(["rosa_v"]));
  ok("os @ do texto: no máximo 20", mencionadosDoTexto(Array.from({ length: 30 }, (_, i) => `@pessoa${i}xx`).join(" ")).length === 20);
  const C = { grupo: "comunidade:roda-fechada", corpo_grupo: "p2.1.AAAAAAAAAAAAAAAA.BBBB" };
  const comMencao = pedidoCifrado({ tipo: "post", texto: "segredo para @pessoa_bia", responde_quem: "mencionados", publico: "comunidade" }, C);
  ok("o pedido cifrado com só mencionados leva os @ e nada do texto", comMencao.texto === "" && JSON.stringify(comMencao.mencionados) === JSON.stringify(["pessoa_bia"]) && !JSON.stringify(comMencao).includes("segredo"));
  ok("o pedido cifrado sem só mencionados não leva lista", !("mencionados" in pedidoCifrado({ tipo: "post", texto: "oi @pessoa_bia", publico: "comunidade" }, C)));
  ok("a resposta cifrada não leva lista", !("mencionados" in pedidoCifrado({ tipo: "post", texto: "oi @pessoa_bia", responde_quem: "mencionados", resposta_a: "x" }, C)));
  ok("sem nenhum @, nada vai junto", !("mencionados" in pedidoCifrado({ tipo: "post", texto: "sem marca", responde_quem: "mencionados" }, C)));
}

// ═══════════════════ 7. A tela e os textos ═══════════════════
{
  const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
  ok("o Escrever monta Quem vê pelo seletor (opcoesDeVisibilidade) e diz se a opção sai da Alumia", escrever.includes("useOpcoesDeVisibilidade({") && escrever.includes("return opcoesDeVisibilidade(ctx);") && escrever.includes("tv.saiDaAlumia : tv.ficaNaAlumia"));
  ok("o Escrever avisa, com Alumia e Fediverso, que outros servidores podem guardar uma cópia", /publico === "internet" && !naoListado && someEm === null && \([\s\S]{0,300}tv\.avisoFediverso/.test(escrever) && escrever.includes("tv.naoSaiComVida"));
  ok("o Escrever diz quais @ vão em aberto no post cifrado com só mencionados", escrever.includes("tv.mencionadosCifrado") && escrever.includes("mencionadosDoTexto(texto)"));
  ok("só eu vai pela vida do post (como a roda)", escrever.includes("vaiPelaVida(publico) || naoListado || someEm !== null"));
  const anexos = ler("components/rede/publicar/alumia2/AnexosDoEscrever.tsx");
  const faixa = ler("components/rede/publicar/alumia2/FaixaDeFerramentas.tsx");
  const css = ler("components/rede/publicar/alumia2/escrever.css");
  const alumiaCss = ler("styles/alumia.css");
  ok("a barra de ferramentas rola numa linha só, com a seta de que há mais", anexos.includes("<FaixaDeFerramentas") && faixa.includes('role="toolbar"') && faixa.includes("data-mais-depois")
    && /\.al2-ferramentas-faixa \.al2-ferramentas \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto/.test(css) && !/\.al2-ferramentas \{ flex-wrap: wrap/.test(alumiaCss));
  ok("as ferramentas continuam com 44 px", /\.al2-ferramenta \{[^}]*width: 44px; height: 44px/.test(alumiaCss));
  const tons = (s) => (s.match(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/gi) ?? []).length;
  ok("o CSS novo usa só os tokens (nenhuma cor literal)", tons(css) === 0);
  const pt = JSON.parse(ler("i18n/rede/publicar/alumia2/pt.json")).visibilidade;
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const t = JSON.parse(ler(`i18n/rede/publicar/alumia2/${l}.json`)).visibilidade;
    const v = JSON.parse(ler(`i18n/rede/publicar/vida/${l}.json`)).cartao;
    ok(`${l}: os textos do seletor estão todos, sem vazio`, t && Object.keys(pt).every((k) => typeof t[k] === "string" && t[k].trim()) && Object.keys(t).length === Object.keys(pt).length && typeof v.soEu === "string" && v.soEu.trim());
    ok(`${l}: a lista dos @ tem o marcador {lista}`, t?.mencionadosLista.includes("{lista}"));
  }
  ok("pt: as frases dizem se sai da Alumia", pt.membrosAjuda.includes("não vai para o Fediverso") && pt.internetAjuda.includes("Sai da Alumia") && pt.euAjuda.includes("Não sai da Alumia")
    && pt.avisoFediverso.includes("guardar uma cópia") && pt.avisoFediverso.includes("não garante"));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
