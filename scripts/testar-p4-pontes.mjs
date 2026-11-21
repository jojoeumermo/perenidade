// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, lote "pontes" (interruptor "alumia-p4-pontes"): Fediverso e pontes (81 a 86), acessibilidade (87, 88), o widget do
// Android (106, só a parte que dá para conferir no Node) e as lacunas 130 a 134. Cada parte prova o item E a regra de privacidade
// dele:
//   81  o ato sai como Event só com o ponto público (nunca quem confirmou, quantos nem a meta), e a mudança vai como Update;
//   82  o modo "só os aprovados": fora da lista, o servidor conta como bloqueado; ligar não apaga nada; o bloqueio fixo continua;
//   83  os cartões de vídeo e áudio de fora: a miniatura só pela rota-proxy, nunca o vídeo nem o áudio direto da origem;
//   85  a ponte com o Bluesky: a escolha fica guardada, mas não liga com o Bridgy Fed no bloqueio fixo;
//   86  o aviso de ato no Telegram: só o ponto público e o endereço; adiar e cancelar saem uma vez cada;
//   87  a janela de Libras: escolha só no aparelho, tamanho mínimo, nada vai à rede;
//   88  as legendas ao vivo: só com o reconhecedor local do navegador (processLocally), texto só na tela;
//   130 a busca nos salvos: só no aparelho (nenhuma chamada à rede com o que se procurou);
//   131 avisos só de quem eu sigo: o resto fica na tela, só não vira push;
//   132 "pouco útil": nenhuma função devolve o total nem quem votou; 2 votos não mudam a ordem, 3 descem a resposta;
//   133 o leitor de fios: só o que quem lê vê (interno.rede_ve), sem cifrado nem núcleo;
//   134 a sessão de perguntas com convidada (já existia): perguntas sem nome por padrão e sem id de ninguém.
// Uso: npm run testar:p4-pontes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
const FLAG = "alumia-p4-pontes";

let certos = 0;
const falhas = [];
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
/** Uma parte inteira: se o código ainda não existe (antes do item), a parte conta como falha, sem derrubar as outras. */
async function parte(nome, f) {
  try {
    await f();
  } catch (e) {
    falhas.push(`${nome}: ${e?.code ?? ""} ${e?.message ?? e}`);
  }
}

const CAMINHO_SQL = "supabase/migracoes/20261127-p4-pontes.sql";
const SQL = existe(CAMINHO_SQL) ? normal(ler(CAMINHO_SQL)) : "";

// ═══ 0. A migração, lida ═══
await parte("0: a migração", async () => {
  if (!SQL) throw new Error("migração ainda não existe");
  const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
  ok("a migração diz a lei e que pode rodar de novo", /Lei: LGPD art\./.test(SQL) && /Pode rodar mais de uma vez/.test(SQL));
  ok("o cabeçalho diz onde ela entra", /Roda depois de 20261126-p5-fim\.sql/.test(SQL) && /antes do\s+--\s*20261127-p4-fim\.sql|antes do 20261127-p4-fim\.sql/.test(SQL));
  ok("a migração não lê nem guarda endereço de rede", !/\binet\b|x-forwarded|cf-connecting|remote_addr|request\.headers/i.test(semComentario));
  ok("não mexe na versão nem na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
  ok("ligar o modo dos aprovados não chama a faxina do bloqueio", !/rede_fed_bloqueio_faxina/.test(semComentario));
  ok("nenhuma tabela nova guarda a conta de quem vota no pouco útil", !/create table if not exists interno\.rede_p4_pouco_util \([^;]*\b(usuario|quem|autor|criado_em)\b/.test(semComentario));
  for (const f of ["interno.rede_fed_bloqueado(text)", "interno.rede_fed_post_json(interno.rede_posts)", "public.rede_pontes_telegram_pendentes(integer)",
    "public.rede_aviso_push_pendentes(integer)", "public.rede_conv_arvore(uuid, text)"]) {
    ok(`o cabeçalho cita a função redefinida ${f}`, SQL.slice(0, 6000).includes(f));
  }
});

// ═══ 1. O banco ═══
// Depois da junção a migração já está colada no install.sql: o banco de antes é o install.sql cortado antes dela.
const banco = await criarBanco(SQL && normal(ler("supabase/install.sql")).includes(SQL.trim()) ? { antesDe: SQL } : {});
const { dono, criarUsuario, rpc } = banco;

// Antes da migração (o install.sql do ramo, cortado antes dela se já estiver colado): nada do lote existe, um servidor qualquer conversa e o ato sai sem o ponto.
{
  const f = (await dono("select to_regprocedure('public.rede_p4_pouco_util(uuid, uuid, boolean, text)') is not null as a, to_regprocedure('public.rede_p4_fio_texto(uuid)') is not null as b")).rows[0];
  ok("antes: não havia 'pouco útil' nem leitor de fios", !f.a && !f.b);
  const b = (await dono("select interno.rede_fed_bloqueado('https://qualquer.example/u/a') as b")).rows[0].b;
  ok("antes: um servidor desconhecido não contava como bloqueado (não havia modo de aprovados)", b === false);
}

await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r?.abertas)})`, r?.abertas?.length === 0);
  const k = (await dono("select k.so_pelo_nome, v.ligado from interno.recursos_catalogo k left join interno.recursos_vivos v on v.nome = k.nome where k.nome = $1", [FLAG])).rows[0];
  ok("o interruptor está no catálogo, só pelo nome e sem decisão (desligado)", k?.so_pelo_nome === true && k.ligado !== true);
  const tabelas = ["rede_p4_fed_modo", "rede_p4_fed_aprovados", "rede_p4_bluesky", "rede_p4_telegram_atos", "rede_p4_avisos_so_seguidos", "rede_p4_pouco_util"];
  const rls = (await dono("select count(*)::int n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname = any($1) and c.relkind = 'r' and c.relrowsecurity", [tabelas])).rows[0].n;
  ok(`as ${tabelas.length} tabelas têm RLS ligada (${rls})`, rls === tabelas.length);
  const pol = (await dono("select count(*)::int n from pg_policies where schemaname = 'interno' and tablename = any($1)", [tabelas])).rows[0].n;
  ok("e nenhuma política (só as funções entram)", pol === 0);
  const cols = (await dono("select column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows;
  ok("nenhuma coluna de endereço de rede", !cols.some((c) => c.data_type === "inet" || /(^|_)ip($|_)/.test(c.column_name)));
  ok("o voto 'pouco útil' só tem a resposta e a marca", cols.filter((c) => c.column_name && tabelas.includes("rede_p4_pouco_util")).length > 0
    && (await dono("select array_agg(column_name::text order by column_name) a from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_pouco_util'")).rows[0].a.join() === "marca,post");
  // Da junção: a árvore redefinida parte do corpo do banco montado, com o "útil" publicado em marcos de 15 minutos (onda 14,
  // interno.rede_util_publicado); a contagem crua deixaria quem marca e desmarca descobrir quem marcou.
  const arv = (await dono("select pg_get_functiondef('public.rede_conv_arvore(uuid, text)'::regprocedure) d")).rows[0].d;
  ok("132: a árvore continua com o 'útil' publicado em marcos (onda 14), sem a contagem crua",
    /coalesce\(interno\.rede_util_publicado\(c\.id\), 0\) as util/.test(arv) && !/count\(\*\)::integer from rede_reacoes u where u\.post = c\.id/.test(arv));
  const anon = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname like 'rede_p4_%' and p.proname in ('rede_p4_fed_aprovados_ver', 'rede_p4_fed_aprovar', 'rede_p4_fed_modo',
                               'rede_p4_bluesky_ver', 'rede_p4_bluesky_escolher', 'rede_p4_avisos_so_seguidos', 'rede_p4_pouco_util', 'rede_p4_telegram_atos_pendentes', 'rede_p4_telegram_atos_resultado')
                               and has_function_privilege('anon', p.oid, 'execute')`)).rows.map((x) => x.proname);
  ok(`visitante não chama as funções de escrita nem as do servidor (${anon.join(", ")})`, anon.length === 0);
  const servico = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
                               and p.proname in ('rede_p4_telegram_atos_pendentes', 'rede_pontes_telegram_pendentes', 'rede_aviso_push_pendentes') and has_function_privilege('authenticated', p.oid, 'execute')`)).rows;
  ok("quem tem conta não chama as funções do servidor", servico.length === 0);
  const internas = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'interno' and p.proname like 'rede_p4_%' and (p.proname like '%pontes%' or p.proname like '%fed_%' or p.proname like '%bluesky%' or p.proname like '%pouco_util%' or p.proname like '%fio_%' or p.proname like '%aviso_empurra%' or p.proname like '%telegram_ato%' or p.proname like '%ato_publico%')
                                   and has_function_privilege('authenticated', p.oid, 'execute')`)).rows.map((x) => x.proname);
  ok(`as funções internas ficam fechadas (${internas.join(", ")})`, internas.length === 0);
}

// Pessoas: ana escreve; bia, cris, duda e eva leem e votam; org é uma organização; equipe é a coordenação (mediação).
const P = {};
for (const [i, nome] of ["ana", "bia", "cris", "duda", "eva", "fabi", "org", "equipe"].entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-pontes.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], nome === "org" ? "Coletivo Ponte" : `Pessoa ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i)}`, nome === "org" ? "coletivo_ponte" : `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.equipe]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values
  ('aulas-abertas', 'Aulas abertas', 'disciplinas', 'aberta'), ('roda-fechada', 'Roda fechada', 'lutas', 'fechada') on conflict do nothing`);
for (const [slug, quem, papel] of [["aulas-abertas", "ana", "moderacao"], ["aulas-abertas", "bia", "membro"], ["roda-fechada", "ana", "moderacao"], ["roda-fechada", "bia", "membro"]]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ($1, $2, $3, 'ativo') on conflict do nothing", [slug, P[quem], papel]);
}
const como = (quem, funcao, args = {}) => {
  const extra = quem === "equipe" ? { aal: "aal2" } : {};
  return rpc({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9", ...extra }, funcao, args);
};
const chamar = async (quem, funcao, args) => {
  await dono("delete from interno.limites");
  return como(quem, funcao, args);
};
const servico = (funcao, args = {}) => rpc({ papel: "service_role", ip: "127.0.0.1" }, funcao, args);
const visitante = (funcao, args = {}) => rpc({ papel: "anon", ip: "198.51.100.77" }, funcao, args);
const ligar = (nome, sim) => dono("insert into interno.recursos_vivos (nome, ligado) values ($1, $2) on conflict (nome) do update set ligado = $2", [nome, sim]);
/** Nenhum id de pessoa na resposta. */
const semPessoas = (r, ...quem) => {
  const s = JSON.stringify(r ?? null);
  return (quem.length ? quem : Object.keys(P)).every((k) => !s.includes(P[k]));
};
const post = async (autor, texto, extra = {}) => {
  const campos = { autor: P[autor], texto, tipo: "post", ...extra };
  const nomes = Object.keys(campos);
  return (await dono(`insert into interno.rede_posts (${nomes.join(", ")}) values (${nomes.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(campos))).rows[0].id;
};

// ═══ 82. Federação só com servidores aprovados ═══
await parte("82", async () => {
  const bloq = async (u) => (await dono("select interno.rede_fed_bloqueado($1) as b", [u])).rows[0].b;
  await recusa("82: desligado, a lista não muda", () => chamar("equipe", "rede_p4_fed_aprovar", { p_dominio: "mastodon.social", p_sim: true }), "desligado");
  await ligar(FLAG, true);
  await recusa("82: quem não é da mediação não mexe", () => chamar("bia", "rede_p4_fed_aprovar", { p_dominio: "mastodon.social", p_sim: true }), "sem_permissao");
  await recusa("82: quem não é da mediação nem lê a lista", () => chamar("bia", "rede_p4_fed_aprovados_ver", {}), "sem_permissao");
  await recusa("82: nome que não é de servidor não entra", () => chamar("equipe", "rede_p4_fed_aprovar", { p_dominio: "localhost", p_sim: true }), "invalido:dominio");
  const l = await passa("82: a mediação aprova um servidor", () => chamar("equipe", "rede_p4_fed_aprovar", { p_dominio: "https://Mastodon.Social/@x", p_sim: true }));
  ok("82: a lista traz só o nome do servidor e o dia", l?.lista?.length === 1 && l.lista[0].dominio === "mastodon.social" && Object.keys(l.lista[0]).sort().join() === "desde,dominio" && semPessoas(l));
  ok("82: com o modo desligado, servidor fora da lista ainda conversa", (await bloq("https://outro.example/u/a")) === false);
  await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox) values ($1, 'https://outro.example/u/x', 'https://outro.example/inbox') on conflict do nothing", [P.ana]);
  await passa("82: a mediação liga o modo", () => chamar("equipe", "rede_p4_fed_modo", { p_so_aprovados: true }));
  ok("82: com o modo, servidor fora da lista conta como bloqueado", (await bloq("https://outro.example/u/a")) === true);
  ok("82: o aprovado e os subdomínios dele, não", (await bloq("https://mastodon.social/@a")) === false && (await bloq("https://media.mastodon.social/x.png")) === false);
  ok("82: o mesmo nome escrito de outro jeito (ponto no fim, usuário na frente) não escapa", (await bloq("https://x@outro.example./u")) === true && (await bloq("https://evilmastodon.social/u")) === true);
  ok("82: endereço vazio ou sem https fica para quem chama conferir (não muda)", (await bloq(null)) === false && (await bloq("")) === false);
  await chamar("equipe", "rede_p4_fed_aprovar", { p_dominio: "brid.gy", p_sim: true });
  ok("82: o bloqueio fixo (Bridgy Fed) continua mesmo aprovado", (await bloq("https://bsky.brid.gy/r/x")) === true);
  ok("82: ligar o modo não apaga quem seguia (desligar volta ao que era)", (await dono("select count(*)::int n from interno.rede_fed_seguidores where ator = 'https://outro.example/u/x'")).rows[0].n === 1);
  // A fila de entrega também respeita: espalhar não põe destino fora da lista.
  const n = (await dono("select interno.rede_fed_espalhar($1, 'update', 'x') as n", [P.ana])).rows[0].n;
  ok("82: nada sai para o servidor fora da lista", n === 0);
  await ligar(FLAG, false);
  ok("82: com o lote desligado, o modo não vale", (await bloq("https://outro.example/u/a")) === false);
  await ligar(FLAG, true);
  await chamar("equipe", "rede_p4_fed_modo", { p_so_aprovados: false });
  ok("82: desligar o modo volta ao que era", (await bloq("https://outro.example/u/a")) === false);
  await dono("delete from interno.rede_fed_seguidores where ator = 'https://outro.example/u/x'");
});

// ═══ 81. O ato como evento no Fediverso ═══
let ATO = null;
await parte("81", async () => {
  ATO = await post("org", "Ato pela educação pública, com bateria e faixa.", { comunidade: "aulas-abertas", publico: "internet", titulo: "Ato pela educação" });
  await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, titulo, meta) values ($1, now() + interval '2 days', 'Recife', 'Praça do Derby', 'Ato pela educação', 500)", [ATO]);
  for (const q of ["bia", "cris", "duda"]) await dono("insert into interno.rede_vou (post, usuario) values ($1, $2) on conflict do nothing", [ATO, P[q]]);
  await dono("insert into interno.rede_fed_atores (perfil, handle, ligado) values ($1, 'coletivo_ponte', true) on conflict (perfil) do update set ligado = true", [P.org]);
  const json = async () => (await dono("select interno.rede_fed_post_json(p) as j from interno.rede_posts p where p.id = $1", [ATO])).rows[0].j;
  await ligar(FLAG, false);
  ok("81: desligado, o documento é o de antes (sem o ato)", !("ato" in (await json())));
  await ligar(FLAG, true);
  const j = await json();
  ok("81: ligado, leva o ponto público (título, começo, ponto, cidade, situação)", j?.ato?.titulo === "Ato pela educação" && j.ato.onde === "Praça do Derby" && j.ato.cidade === "Recife" && j.ato.situacao === "confirmado" && !!j.ato.inicio);
  ok("81: nunca quem confirmou, quantos ou a meta", semPessoas(j.ato) && !/vou|total|acesos|meta|confirm/.test(Object.keys(j.ato).join()) && !JSON.stringify(j).includes("500"));
  // A mudança vai como Update para quem segue lá fora.
  await dono("insert into interno.rede_fed_enviados (post, perfil) values ($1, $2) on conflict (post) do update set apagado_em = null", [ATO, P.org]);
  await dono("insert into interno.rede_fed_seguidores (perfil, ator, inbox) values ($1, 'https://mobilizon.example/@a', 'https://mobilizon.example/inbox') on conflict do nothing", [P.org]);
  await dono("delete from interno.rede_fed_fila");
  await dono("update interno.rede_chamados set ponto = 'Praça da Independência' where post = $1", [ATO]);
  const fila = (await dono("select tipo, objeto, destino from interno.rede_fed_fila")).rows;
  ok(`81: mudar o ponto manda o Update a quem segue (${JSON.stringify(fila)})`, fila.length === 1 && fila[0].tipo === "update" && fila[0].objeto === ATO);
  await dono("delete from interno.rede_fed_fila");
  await dono("update interno.rede_chamados set meta = 900 where post = $1", [ATO]);
  ok("81: mudar só a meta (que não sai) não manda nada", (await dono("select count(*)::int n from interno.rede_fed_fila")).rows[0].n === 0);
  await dono("delete from interno.rede_fed_seguidores where perfil = $1", [P.org]);
});

// ═══ 85. A ponte com o Bluesky ═══
await parte("85", async () => {
  await recusa("85: quem não modera não vê nem escolhe", () => chamar("bia", "rede_p4_bluesky_escolher", { p_slug: "aulas-abertas", p_sim: true }), "sem_permissao");
  await recusa("85: comunidade fechada não vai", () => chamar("ana", "rede_p4_bluesky_escolher", { p_slug: "roda-fechada", p_sim: true }), "so_comunidade_aberta");
  const r = await passa("85: a moderação da comunidade aberta escolhe", () => chamar("ana", "rede_p4_bluesky_escolher", { p_slug: "aulas-abertas", p_sim: true }));
  ok("85: a escolha fica guardada, mas a ponte NÃO liga (Bridgy Fed no bloqueio fixo)", r?.escolheu === true && r.ativa === false && r.barrada === true && semPessoas(r));
  ok("85: a tabela não guarda quem escolheu", (await dono("select array_agg(column_name::text order by column_name) a from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_bluesky'")).rows[0].a.join() === "comunidade,desde");
  const fixo = (await dono("select fixo from interno.rede_fed_bloqueados where dominio = 'brid.gy'")).rows[0];
  ok("85: o bloqueio fixo do Bridgy Fed continua como estava", fixo?.fixo === true);
  const desfeito = await chamar("ana", "rede_p4_bluesky_escolher", { p_slug: "aulas-abertas", p_sim: false });
  ok("85: desfazer apaga a escolha", desfeito?.escolheu === false);
});

// ═══ 86. O aviso de ato no Telegram ═══
await parte("86", async () => {
  await ligar("alumia-telegram", true);
  await dono("insert into interno.rede_orgs (perfil, tipo, cidade, verificada_em) values ($1, 'coletivo', 'Recife', now()) on conflict (perfil) do update set verificada_em = now()", [P.org]);
  await dono("insert into interno.rede_pontes_telegram (org, canal, ligado, ligado_em) values ($1, '@canal_do_coletivo', true, now() - interval '3 days') on conflict (org) do update set ligado = true, ligado_em = now() - interval '3 days'", [P.org]);
  await dono("update interno.rede_posts set criado_em = now() - interval '1 hour' where id = $1", [ATO]);
  const lista = await passa("86: o servidor pega os posts que saem", () => servico("rede_pontes_telegram_pendentes", { p_limite: 20 }));
  const doAto = (lista ?? []).find((x) => x.post === ATO);
  ok(`86: o post do ato sai com o ponto público (${JSON.stringify(doAto)?.slice(0, 300)})`, doAto?.ato?.onde === "Praça da Independência" && doAto.ato.cidade === "Recife" && doAto.canal === "@canal_do_coletivo");
  ok("86: nenhum dado de conta passa (nem quem confirmou, nem a meta)", semPessoas(lista) && !/"(vou|total|meta|autor|org)"/.test(JSON.stringify(lista)));
  await servico("rede_pontes_telegram_resultado", { p_post: ATO, p_ok: true });
  await recusa("86: os avisos de mudança são só do servidor", () => chamar("ana", "rede_p4_telegram_atos_pendentes", { p_limite: 5 }), "");
  await dono("update interno.rede_chamados set situacao = 'cancelado', motivo = 'chuva forte' where post = $1", [ATO]);
  const m = await passa("86: o cancelamento sai", () => servico("rede_p4_telegram_atos_pendentes", { p_limite: 5 }));
  ok("86: uma vez, com a situação nova", m?.length === 1 && m[0].ato?.situacao === "cancelado" && m[0].post === ATO);
  const de_novo = await servico("rede_p4_telegram_atos_pendentes", { p_limite: 5 });
  ok("86: e não sai de novo", de_novo?.length === 0);
  // Ato fechado (comunidade fechada) nunca sai.
  const FECHADO = await post("org", "Reunião fechada da roda.", { comunidade: "roda-fechada", titulo: "Reunião" });
  await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, titulo) values ($1, now() + interval '2 days', 'Recife', 'Sede', 'Reunião')", [FECHADO]);
  await dono("update interno.rede_posts set criado_em = now() - interval '1 hour' where id = $1", [FECHADO]);
  const l2 = await servico("rede_pontes_telegram_pendentes", { p_limite: 20 });
  ok("86: ato de comunidade fechada não sai", !(l2 ?? []).some((x) => x.post === FECHADO));
  await ligar(FLAG, false);
  const ATO2 = await post("org", "Outro ato público na praça.", { comunidade: "aulas-abertas", publico: "internet", titulo: "Ato dois" });
  await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, titulo) values ($1, now() + interval '4 days', 'Recife', 'Marco Zero', 'Ato dois')", [ATO2]);
  await dono("update interno.rede_posts set criado_em = now() - interval '1 hour' where id = $1", [ATO2]);
  const l3 = await servico("rede_pontes_telegram_pendentes", { p_limite: 20 });
  ok("86: com o lote desligado, sai como sempre saiu (sem o campo do ato)", (l3 ?? []).some((x) => x.post === ATO2 && !("ato" in x)));
  await ligar(FLAG, true);
});

// ═══ 131. Avisos só de quem eu sigo ═══
await parte("131", async () => {
  await dono("insert into interno.rede_push_assinaturas (usuario, endpoint, p256dh, auth, criado_em) values ($1, 'https://push.example/eva', $2, $3, now() - interval '1 day')",
    [P.eva, "a".repeat(40), "b".repeat(16)]);
  await dono("insert into interno.rede_avisos_prefs (usuario, tipo, canal, ligado) values ($1, 'mencao', 'push', true) on conflict (usuario, tipo, canal) do update set ligado = true", [P.eva]);
  const avisar = (ator) => dono("insert into interno.avisos (para, texto, categoria, tipo, ator) values ($1, 'Mencionaram você.', 'rede', 'mencao', $2)", [P.eva, P[ator]]);
  const empurra = async () => {
    await dono("update interno.rede_push_assinaturas set ultimo_envio = null");
    return ((await servico("rede_aviso_push_pendentes", { p_limite: 50 })) ?? []).length > 0;
  };
  await avisar("fabi");
  ok("131: sem a escolha, a menção de quem a eva não segue vira push (como antes)", await empurra());
  await recusa("131: com o lote desligado, a escolha não liga", async () => {
    await ligar(FLAG, false);
    try {
      return await chamar("eva", "rede_p4_avisos_so_seguidos", { p_sim: true });
    } finally {
      await ligar(FLAG, true);
    }
  }, "desligado");
  const e = await passa("131: a eva escolhe só de quem segue", () => chamar("eva", "rede_p4_avisos_so_seguidos", { p_sim: true }));
  ok("131: devolve só a escolha dela", e?.so_seguidos === true && semPessoas(e));
  await avisar("fabi");
  ok("131: menção de quem ela não segue não vira push", !(await empurra()));
  ok("131: mas continua na tela de avisos", (await dono("select count(*)::int n from interno.avisos where para = $1 and tipo = 'mencao' and ator = $2", [P.eva, P.fabi])).rows[0].n === 2);
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P.eva, P.cris]);
  await avisar("cris");
  ok("131: menção de quem ela segue vira push", await empurra());
  const daBia = await chamar("bia", "rede_p4_avisos_so_seguidos", {});
  ok("131: cada pessoa só lê a própria escolha", daBia?.so_seguidos === false);
});

// ═══ 132. "Pouco útil" ═══
// O voto vai pelo servidor do site (app/api/alumia/voto/marca, tipos "pouco_util" e "pouco_util_ver"): ele confere a sessão, calcula a
// marca (HMAC com ALUMIA_VOTO_SEGREDO, que nunca vai ao banco) e chama o banco com a chave de serviço. O teste chama a rota de
// verdade, com um dublê do serviço de contas e do PostgREST que repassa ao banco local.
const SEGREDO_DO_VOTO = "segredo-do-voto-para-o-teste-das-pontes-0123456789";
await parte("132", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://contas.duble";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anonima-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-de-teste";
  process.env.ALUMIA_VOTO_SEGREDO = SEGREDO_DO_VOTO;
  const doServico = [];
  const fetchAntes = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const cab = new Headers(init.headers);
    if (u.endsWith("/auth/v1/user")) {
      const quem = /^Bearer tok-([0-9a-f-]{36})$/.exec(cab.get("authorization") ?? "")?.[1];
      return quem ? Response.json({ id: quem, email_confirmed_at: "2026-01-01" }) : Response.json({ message: "sem" }, { status: 401 });
    }
    const m = /\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(u);
    if (m && cab.get("authorization") === "Bearer chave-de-servico-de-teste") {
      const args = JSON.parse(String(init.body || "{}"));
      doServico.push({ funcao: m[1], args });
      await dono("delete from interno.limites");
      try {
        return Response.json(await servico(m[1], args));
      } catch (e) {
        return Response.json({ message: e.message }, { status: 400 });
      }
    }
    return Response.json({ message: "sem dublê" }, { status: 404 });
  };
  try {
    const rota = await import("../app/api/alumia/voto/marca/route.ts");
    const { marcaDoVoto } = await import("../lib/rede/voto/servidor.ts");
    const pedido = (quem, corpo) => new Request("https://alumia.duble/api/alumia/voto/marca", {
      method: "POST", headers: { "Content-Type": "application/json", ...(quem ? { Authorization: `Bearer tok-${P[quem]}` } : {}) }, body: JSON.stringify(corpo),
    });
    const pelaRota = async (quem, corpo) => {
      const d = await (await rota.POST(pedido(quem, corpo))).json();
      if (!d?.ok) throw new Error(String(d?.motivo));
      return d.dado;
    };
    const votar = (quem, alvo, sim) => pelaRota(quem, { tipo: "pouco_util", post: alvo, sim });
    const meus = (quem, posts) => pelaRota(quem, { tipo: "pouco_util_ver", posts });

    const RAIZ = await post("ana", "Como organizar uma roda de estudo no bairro?", { comunidade: "aulas-abertas" });
    const R = [];
    for (const [i, q] of ["bia", "cris", "duda"].entries()) {
      R.push(await post(q, `Resposta ${i + 1}: uma ideia para a roda.`, { comunidade: "aulas-abertas", resposta_a: RAIZ, root_id: RAIZ, criado_em: new Date(Date.now() - (10 - i) * 60_000).toISOString() }));
    }
    const ordem = async () => ((await chamar("fabi", "rede_conv_arvore", { p_id: RAIZ, p_ordem: "antigas" }))?.respostas ?? []).map((x) => x.id);
    ok("132: a ordem de chegada antes dos votos", (await ordem()).join() === R.join());
    await recusa("132: na própria resposta não", () => votar("bia", R[0], true), "invalido:propria");
    await recusa("132: na raiz (que não é resposta) não", () => votar("eva", RAIZ, true), "nao_encontrado");
    await recusa("132: sem sessão, não", () => pelaRota(null, { tipo: "pouco_util", post: R[0], sim: true }), "entre_primeiro");
    const v1 = await passa("132: a eva marca", () => votar("eva", R[0], true));
    ok(`132: devolve só o voto dela, nunca o total (${JSON.stringify(v1)})`, JSON.stringify(v1) === '{"eu":true}');
    await votar("fabi", R[0], true);
    await votar("eva", R[0], true);
    ok("132: 2 votos (de contas diferentes; o repetido não conta) não mudam a ordem", (await ordem()).join() === R.join());
    await votar("cris", R[0], true);
    const depois = await ordem();
    ok(`132: com 3, a resposta desce para o fim das irmãs (${depois.map((x) => R.indexOf(x)).join()})`, depois.join() === [R[1], R[2], R[0]].join());
    const arv = await chamar("fabi", "rede_conv_arvore", { p_id: RAIZ, p_ordem: "uteis" });
    ok("132: a conversa não traz o voto nem a marca de quem desceu", !/pouco|desce|marca/.test(JSON.stringify(arv)));
    // Nenhuma função pública devolve o total ou quem votou: as únicas que leem a tabela são estas duas, e só a chave de serviço as chama.
    const leem = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ~ 'rede_p4_pouco_util[^_a-z]' order by 1`)).rows.map((x) => x.proname);
    ok(`132: só duas funções públicas tocam no voto (${leem.join(", ")})`, leem.join() === "rede_p4_pouco_util,rede_p4_pouco_util_meus");
    const abertas = (await dono(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede_p4_pouco_util%'
                                  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.f);
    ok(`132: nem visitante nem conta chamam o voto direto, só a chave de serviço (${abertas.join(", ")})`, abertas.length === 0);
    await recusa("132: visitante não chama 'os meus' direto no banco", () => visitante("rede_p4_pouco_util_meus", { p_marcas: {} }), "");
    await recusa("132: uma conta não grava marca inventada (encher o voto) chamando o banco direto",
      () => chamar("eva", "rede_p4_pouco_util", { p_usuario: P.eva, p_post: R[1], p_sim: true, p_marca: "ab".repeat(32) }), "");
    const internas = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                  where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ~ 'pouco_util_desce' order by 1`)).rows.map((x) => x.proname);
    ok(`132: a ordem (que usa o "desce") só na árvore da conversa (${internas.join(", ")})`, internas.join() === "rede_conv_arvore");
    const meusEva = await passa("132: 'os meus' da eva", () => meus("eva", R));
    ok(`132: 'os meus' devolve só os votos dela (ids), sem número (${JSON.stringify(meusEva)})`, JSON.stringify(meusEva) === JSON.stringify([R[0]]));
    ok("132: quem não votou não fica sabendo dos votos dos outros", JSON.stringify(await meus("duda", R).catch((e) => e.message)) === "[]");
    const marcas = (await dono("select encode(marca, 'hex') m from interno.rede_p4_pouco_util")).rows.map((x) => x.m);
    ok("132: a marca não é a conta (nenhum id de pessoa aparece nela)", Object.values(P).every((id) => !marcas.join().includes(id.replace(/-/g, ""))));
    ok("132: a marca é o HMAC do servidor do site (o segredo dele, que o banco não tem)", ["eva", "fabi", "cris"].every((q) => marcas.includes(marcaDoVoto(SEGREDO_DO_VOTO, "pouco_util", R[0], P[q]))));
    ok("132: o servidor manda ao banco só a conta (para conferir as regras), a resposta, o sim e a marca",
      doServico.some((c) => c.funcao === "rede_p4_pouco_util") && doServico.filter((c) => c.funcao === "rede_p4_pouco_util").every((c) => Object.keys(c.args).sort().join() === "p_marca,p_post,p_sim,p_usuario"));

    // Auditoria do P4 (M1): quem tem o banco inteiro (SQL Editor, chave de serviço ou um vazamento) não pode descobrir quem votou.
    // Antes, a marca era sha256(sal ‖ resposta ‖ conta) com o sal numa tabela do próprio banco, e esta consulta devolvia as contas.
    {
      const tem = (await dono("select to_regprocedure('interno.rede_p4_pouco_util_marca(uuid, uuid)') is not null as f, to_regclass('interno.rede_p4_pontes_sal') is not null as t")).rows[0];
      let achados = [];
      if (tem.f) {
        achados = (await dono(`select f.rede_handle from interno.perfis f where exists (select 1 from interno.rede_p4_pouco_util u where u.post = $1 and u.marca = interno.rede_p4_pouco_util_marca($1, f.id)) order by 1`, [R[0]])).rows.map((x) => x.rede_handle);
      }
      ok(`132 (ataque do dono do banco): recalcular a marca de cada conta não acha quem votou (${achados.join(", ")})`, achados.length === 0 && !tem.f && !tem.t);
      const sem = (await dono(`select count(*)::int n from interno.perfis f, interno.rede_p4_pouco_util u
                                where u.post = $1 and u.marca = sha256(convert_to($1::text || ':' || f.id::text, 'UTF8'))`, [R[0]])).rows[0].n;
      ok("132 (ataque do dono do banco): sem o segredo, o sha256 da resposta e da conta não bate com marca nenhuma", sem === 0);
    }
    await ligar(FLAG, false);
    ok("132: com o lote desligado, a ordem volta à de sempre", (await ordem()).join() === R.join());
    await recusa("132: com o lote desligado, não se marca", () => votar("duda", R[0], true), "desligado");
    ok("132: com o lote desligado, 'os meus' vem vazio", JSON.stringify(await meus("eva", R).catch((e) => e.message)) === "[]");
    await ligar(FLAG, true);
    await votar("cris", R[0], false);
    ok("132: desfazer tira o voto (volta a 2 e a ordem volta)", (await ordem()).join() === R.join());
  } finally {
    globalThis.fetch = fetchAntes;
  }
});

// ═══ 133. O leitor de fios ═══
await parte("133", async () => {
  const F1 = await post("ana", "Fio sobre a história do bairro. Parte 1.", { comunidade: "aulas-abertas", titulo: "História do bairro" });
  const F2 = await post("ana", "Parte 2: as primeiras casas.", { comunidade: "aulas-abertas", resposta_a: F1, root_id: F1, criado_em: new Date(Date.now() + 1000).toISOString() });
  await post("bia", "Resposta da bia no meio do fio.", { comunidade: "aulas-abertas", resposta_a: F2, root_id: F1, criado_em: new Date(Date.now() + 1500).toISOString() });
  const F3 = await post("ana", "Parte 3: a luta pela água.", { comunidade: "aulas-abertas", resposta_a: F2, root_id: F1, criado_em: new Date(Date.now() + 2000).toISOString() });
  const F4 = await post("ana", "Parte 4: retida pela triagem.", { comunidade: "aulas-abertas", resposta_a: F3, root_id: F1, retido: true, criado_em: new Date(Date.now() + 3000).toISOString() });
  const r = await passa("133: o fio abre a partir de qualquer parte", () => chamar("cris", "rede_p4_fio_texto", { p_id: F3 }));
  ok(`133: junta só os posts da autora, na ordem, do começo ao fim (${(r?.itens ?? []).length})`, (r?.itens ?? []).map((x) => x.id).join() === [F1, F2, F3].join());
  ok("133: a resposta de outra pessoa e o post retido ficam fora", !JSON.stringify(r).includes("Resposta da bia") && !(r?.itens ?? []).some((x) => x.id === F4));
  ok("133: só o nome público da autora; nenhum id de pessoa", typeof r?.autor === "string" && semPessoas(r));
  const C1 = await post("ana", "Fio da roda fechada.", { comunidade: "roda-fechada" });
  await recusa("133: quem não vê o post (comunidade fechada) não abre o fio", () => chamar("cris", "rede_p4_fio_texto", { p_id: C1 }), "nao_encontrado");
  await recusa("133: o retido também não abre", () => chamar("cris", "rede_p4_fio_texto", { p_id: F4 }), "nao_encontrado");
  await ligar(FLAG, false);
  await recusa("133: desligado, não abre", () => chamar("cris", "rede_p4_fio_texto", { p_id: F1 }), "desligado");
  await ligar(FLAG, true);
});

// ═══ 134. Sessão de perguntas com convidada (já existia: 20261119-alumia-o13-mapa.sql) ═══
await parte("134", async () => {
  await ligar("alumia-ao-vivo", true);
  await dono("delete from interno.limites");
  const inicio = new Date(Date.now() + 60 * 60_000).toISOString();
  const s = await passa("134: a moderação da comunidade marca com uma convidada", () => chamar("ana", "rede_ama_marcar", { p_slug: "aulas-abertas", p: { titulo: "Pergunte à educadora", inicio, minutos: 60, convidada: "pessoa_bia" } }));
  const id = s?.id;
  await passa("134: a convidada aceita", () => chamar("bia", "rede_ama_convite", { p_id: id, p_aceita: true }));
  await dono("update interno.rede_ama set inicio = now() - interval '5 minutes', fim = now() + interval '55 minutes' where id = $1", [id]);
  await passa("134: alguém pergunta (sem mostrar o nome, o padrão)", () => chamar("cris", "rede_ama_perguntar", { p_id: id, p_texto: "Como começar um grupo de estudo?" }));
  const vista = await chamar("duda", "rede_ama", { p_id: id });
  const texto = JSON.stringify(vista);
  ok("134: a pergunta aparece sem o nome de quem perguntou e sem id de ninguém", texto.includes("Como começar um grupo de estudo?") && !texto.includes("Pessoa CC") && semPessoas(vista, "cris", "duda", "ana"));
});

// ═══ 2. As peças do aparelho e das rotas (Node, sem rede) ═══
const chamadas = [];
const fetchDeVerdade = globalThis.fetch;
globalThis.fetch = async (url, ...resto) => {
  const u = String(url instanceof Request ? url.url : url);
  if (u.startsWith("file:") || u.startsWith("data:")) return fetchDeVerdade(url, ...resto);
  chamadas.push(u);
  throw new Error("sem_rede_no_teste");
};

const extras = existe("scripts/testar-p4-pontes-aparelho.mjs") ? await import("./testar-p4-pontes-aparelho.mjs") : null;
if (extras) {
  const r = await extras.conferir({ ok, recusa, passa, parte, chamadas, ler, existe });
  void r;
} else {
  falhas.push("aparelho: o teste das peças do aparelho ainda não existe");
}

await banco.pg.close?.();
for (const f of falhas) console.log(`  ✗ ${f}`);
console.log(`\np4-pontes: ${certos} certos, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
