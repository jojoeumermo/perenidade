// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a estrutura das comunidades da onda 10 (supabase/migracoes/20261116-alumia-o10-estrutura.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · subcomunidades: a filha pede, a mãe aceita; um nível só; a herança "mae" dá à moderação da mãe o papel de moderar a filha
//     de verdade (e tira quando acaba, devolvendo o que era antes);
//   · comunidade só leitura: só a moderação abre post; as respostas seguem a escolha (todos, membros, ninguém), em qualquer caminho;
//   · cidade e bairro escritos (sem GPS), a lista por município conta lugares e nunca pessoas;
//   · os Espaços da organização com selo: comunidades e núcleos num lugar só; quem gerencia aceita;
//   · repostar em outra comunidade: só o que é de toda a Alumia, só se quem escreveu deixa citar, só se o destino aceita, nunca
//     mais aberto que o original, com a origem visível e sem dizer quem trouxe;
//   · a proposta de comunidade já traz a cidade e a mãe;
//   · os textos nas seis línguas e nenhuma coluna de endereço de rede.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o10-estrutura.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { UFS, ERROS_DA_ESTRUTURA, chaveDaCidade, nomeDoLugar } from "../lib/rede/estrutura/regras.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

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
const sql = ler("supabase/migracoes/20261116-alumia-o10-estrutura.sql");
const PURAS = /alumia_o10_nome_lugar\(/;
ok("toda função nova é security definer com search_path fixo (menos a pura, que não lê tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 20 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || PURAS.test(f.split("\n")[0]));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 4
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede nem coordenada", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|ip|porta|latitude|longitude|lat|lng|geo)\b/.test(t)));
ok("a tabela dos reposts não tem coluna de pessoa", (() => {
  const t = sql.match(/create table if not exists interno\.alumia_com_reposts \([\s\S]*?\n\);/)?.[0] ?? "";
  return t.length > 0 && !/\b(usuario|quem|autor|pessoa|conta)\s+uuid/.test(t);
})());
ok("não mexe na versão da Alumia, no install.sql, nem redefine rede_ve, rede_publicar ou rede_post_v2", !/function public\.rede_alumia_versao|function interno\.rede_ve\(|function public\.rede_publicar\(|function interno\.rede_post_v2\(/.test(sql));
ok("termina passando a porta em tudo", /interno\.alumia_trancar\(\)/.test(sql.slice(-300)));
ok("as UFs da tela são as do banco", UFS.every((u) => sql.includes(`'${u}'`)) && UFS.length === 27);
ok("o ponto dos cargos (10B) só nasce se não existir", /to_regprocedure\('interno\.alumia_o10_cargo_posta\(text, uuid\)'\) is null/.test(sql));
ok("a chave da cidade da tela casa com interno.normal", chaveDaCidade("  São  João del-Rei ") === "sao joao del rei" && chaveDaCidade("") === "");
ok("o nome do lugar arrumado como no banco", nomeDoLugar("  Vila   Mariana ") === "Vila Mariana" && nomeDoLugar(" ") === null);

// Os textos: as seis línguas com as mesmas chaves e os mesmos marcadores {x}; nenhuma palavra proibida; todo erro novo com texto.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/estrutura/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/estrutura/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`estrutura/${l}.json tem as mesmas chaves e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("nenhum texto usa \"diploma\", \"universidade\" nem \"algoritmo\"", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidad|universit|algoritm|algorithm/i.test(ler(`i18n/rede/estrutura/${l}.json`))));
  ok("todo erro novo do banco tem texto", ERROS_DA_ESTRUTURA.every((c) => typeof pt.erros[c] === "string") && ERROS_DA_ESTRUTURA.every((c) => sql.includes(`'${c}'`)));
  ok("toda UF tem nome", UFS.every((u) => typeof pt.ufs[u] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
await espera("toda função pública nova passa pela porta", async () =>
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'alumia\\_estr\\_%'`)).rows,
(rs) => rs.length === 12 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o10\\_%'`)).rows,
(rs) => rs.length >= 12 && rs.every((r) => !r.a && !r.b)); // o prefixo alumia_o10_ é de todas as frentes da onda 10: depois da junta são mais
await espera("visitante não ajusta, não pede e não reposta", async () =>
  (await dono(`select has_function_privilege('anon', 'public.alumia_estr_salvar(text, jsonb)', 'execute') as a, has_function_privilege('anon', 'public.alumia_estr_repostar(uuid, text, text)', 'execute') as b,
               has_function_privilege('anon', 'public.alumia_estr_cidades()', 'execute') as c`)).rows[0],
(r) => !r.a && !r.b && r.c);

const P = {};
const NOMES = ["coord", "modmae", "modmae2", "modfilha", "membro", "membro2", "fora", "autora", "gestora", "orgperfil", "semselo", "propoe"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o10.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o10_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('o10-moradia', 'Moradia do teste', 'lutas', 'aberta', 'membros'),
  ('o10-ocupa-leste', 'Ocupação Leste', 'lutas', 'aberta', 'membros'),
  ('o10-avisos', 'Avisos oficiais', 'lutas', 'aberta', 'membros'),
  ('o10-fechada', 'Fechada do teste', 'lutas', 'fechada', 'comunidade'),
  ('o10-fisica', 'Física do teste', 'disciplinas', 'aberta', 'internet') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('o10-moradia', $1, 'moderacao'), ('o10-moradia', $2, 'moderacao'), ('o10-ocupa-leste', $3, 'moderacao'), ('o10-ocupa-leste', $4, 'membro'),
  ('o10-moradia', $4, 'membro'), ('o10-avisos', $1, 'moderacao'), ('o10-avisos', $4, 'membro'), ('o10-fechada', $3, 'moderacao'),
  ('o10-moradia', $5, 'membro'), ('o10-ocupa-leste', $6, 'membro'), ('o10-fisica', $6, 'membro'), ('o10-fisica', $3, 'moderacao')`,
  [P.modmae, P.modmae2, P.modfilha, P.membro, P.autora, P.membro2]);
// A organização com selo (o perfil dela é uma conta) e a sem selo.
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, verificada_em) values ($1, 'movimento', 'São Paulo', now()), ($2, 'coletivo', 'Recife', null) on conflict (perfil) do nothing", [P.orgperfil, P.semselo]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono') on conflict do nothing", [P.orgperfil, P.gestora]);
await dono("insert into interno.rede_nucleos (nome, cidade, org) values ('Núcleo Zona Leste', 'São Paulo', $1)", [P.orgperfil]);

const MM = como(P.modmae);
const MF = como(P.modfilha);
const papel = async (com, quem) => (await dono("select papel, situacao from interno.rede_comunidade_membros where comunidade = $1 and usuario = $2", [com, P[quem]])).rows[0] ?? null;
const postar = (quem, texto, extra = {}) => rpc(como(P[quem]), "rede_publicar", { p: { texto, ...extra } });

// ═══════════════════ 2. Ler a estrutura ═══════════════════
await espera("sem nada ajustado: a estrutura vazia, aberta a visitante, sem lista de pessoas", () => rpc(visitante, "alumia_estr_ver", { p_slug: "o10-moradia" }),
  (r) => r.comunidade === "o10-moradia" && r.mae === null && r.filhas.length === 0 && r.so_leitura === false && r.modero === false && r.pedidos_filhas === null
    && r.posso_abrir_post === false && !JSON.stringify(r).includes(P.modmae));
await recusa("comunidade fechada não aparece para quem é de fora", () => rpc(como(P.fora), "alumia_estr_ver", { p_slug: "o10-fechada" }), "nao_encontrado");
await espera("quem modera a fechada a vê", () => rpc(MF, "alumia_estr_ver", { p_slug: "o10-fechada" }), (r) => r.modero === true);

// ═══════════════════ 3. Subcomunidades ═══════════════════
await recusa("quem não modera não pede mãe", () => rpc(como(P.membro), "alumia_estr_mae_pedir", { p_slug: "o10-ocupa-leste", p_mae: "o10-moradia" }), "sem_permissao");
await recusa("não é mãe de si mesma", () => rpc(MF, "alumia_estr_mae_pedir", { p_slug: "o10-ocupa-leste", p_mae: "o10-ocupa-leste" }), "invalido:mae");
await espera("a moderação da filha pede; fica esperando a mãe", () => rpc(MF, "alumia_estr_mae_pedir", { p_slug: "o10-ocupa-leste", p_mae: "o10-moradia" }),
  (r) => r.mae === null && r.mae_pedido?.slug === "o10-moradia");
await espera("a moderação da mãe é avisada", async () => (await dono("select para from interno.avisos where texto like '%pediu para ser subcomunidade%'")).rows.map((x) => x.para),
  (r) => r.length === 2 && r.includes(P.modmae) && r.includes(P.modmae2));
await espera("a mãe vê o pedido (sem pessoas)", () => rpc(MM, "alumia_estr_ver", { p_slug: "o10-moradia" }),
  (r) => r.pedidos_filhas.length === 1 && r.pedidos_filhas[0].slug === "o10-ocupa-leste" && r.filhas.length === 0);
await espera("quem não modera a mãe não vê pedido", () => rpc(como(P.membro), "alumia_estr_ver", { p_slug: "o10-moradia" }), (r) => r.pedidos_filhas === null);
await recusa("quem não modera a mãe não decide", () => rpc(MF, "alumia_estr_mae_decidir", { p_mae: "o10-moradia", p_filha: "o10-ocupa-leste", p_aceita: true }), "sem_permissao");
await espera("a mãe aceita: a filha aparece na mãe e a mãe na filha", async () => {
  await rpc(MM, "alumia_estr_mae_decidir", { p_mae: "o10-moradia", p_filha: "o10-ocupa-leste", p_aceita: true });
  return Promise.all([rpc(visitante, "alumia_estr_ver", { p_slug: "o10-moradia" }), rpc(visitante, "alumia_estr_ver", { p_slug: "o10-ocupa-leste" })]);
}, ([mae, filha]) => mae.filhas.length === 1 && mae.filhas[0].slug === "o10-ocupa-leste" && filha.mae?.slug === "o10-moradia" && filha.heranca === "propria");
await espera("herança própria: a moderação da mãe NÃO modera a filha", () => papel("o10-ocupa-leste", "modmae"), (r) => r === null);
await recusa("um nível só: a mãe não vira filha", () => rpc(MM, "alumia_estr_mae_pedir", { p_slug: "o10-moradia", p_mae: "o10-avisos" }), "filha_e_mae");
await recusa("um nível só: ninguém mora dentro da filha", () => rpc(MM, "alumia_estr_mae_pedir", { p_slug: "o10-avisos", p_mae: "o10-ocupa-leste" }), "mae_e_filha");
await zerar();

// Herança "mae".
await recusa("herança desconhecida é recusada", () => rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { heranca: "tudo" } }), "invalido:heranca");
await espera("a filha escolhe herdar a moderação da mãe: quem modera a mãe passa a moderar a filha de verdade", async () => {
  await rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { heranca: "mae" } });
  return Promise.all([papel("o10-ocupa-leste", "modmae"), papel("o10-ocupa-leste", "modmae2"), papel("o10-ocupa-leste", "modfilha")]);
}, ([a, b, c]) => a?.papel === "moderacao" && b?.papel === "moderacao" && c?.papel === "moderacao");
await espera("e a conferência de moderação que já existia vale (a mãe modera a página da filha)", () => rpc(MM, "alumia_estr_ver", { p_slug: "o10-ocupa-leste" }), (r) => r.modero === true);
await espera("quem passa a moderar a mãe herda a filha; quem era membro da filha guarda o papel de antes", async () => {
  await dono("update interno.rede_comunidade_membros set papel = 'moderacao' where comunidade = 'o10-moradia' and usuario = $1", [P.membro]);
  return papel("o10-ocupa-leste", "membro");
}, (r) => r?.papel === "moderacao");
await espera("deixou de moderar a mãe: volta a ser membro da filha (não sai dela)", async () => {
  await dono("update interno.rede_comunidade_membros set papel = 'membro' where comunidade = 'o10-moradia' and usuario = $1", [P.membro]);
  return papel("o10-ocupa-leste", "membro");
}, (r) => r?.papel === "membro" && r?.situacao === "ativo");
await espera("herança desligada: a moderação herdada sai da filha; a própria fica", async () => {
  await rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { heranca: "propria" } });
  return Promise.all([papel("o10-ocupa-leste", "modmae"), papel("o10-ocupa-leste", "modfilha"), dono("select count(*)::int as n from interno.alumia_com_herdados")]);
}, ([a, c, h]) => a === null && c?.papel === "moderacao" && h.rows[0].n === 0);
await espera("herança de novo e a mãe desfaz a filha: a herança some junto", async () => {
  await rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { heranca: "mae" } });
  const antes = await papel("o10-ocupa-leste", "modmae");
  await rpc(MM, "alumia_estr_mae_decidir", { p_mae: "o10-moradia", p_filha: "o10-ocupa-leste", p_aceita: false });
  return { antes, depois: await papel("o10-ocupa-leste", "modmae"), filha: await rpc(visitante, "alumia_estr_ver", { p_slug: "o10-ocupa-leste" }) };
}, ({ antes, depois, filha }) => antes?.papel === "moderacao" && depois === null && filha.mae === null);
await espera("quem modera as duas liga direto, sem pedido", async () => {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('o10-moradia', $1, 'moderacao') on conflict (comunidade, usuario) do update set papel = 'moderacao'", [P.modfilha]);
  return rpc(MF, "alumia_estr_mae_pedir", { p_slug: "o10-ocupa-leste", p_mae: "o10-moradia" });
}, (r) => r.mae?.slug === "o10-moradia" && r.mae_pedido === null);
await dono("delete from interno.rede_comunidade_membros where comunidade = 'o10-moradia' and usuario = $1", [P.modfilha]);
await zerar();

// ═══════════════════ 4. Só leitura ═══════════════════
await recusa("quem não modera não liga o só leitura", () => rpc(como(P.membro), "alumia_estr_salvar", { p_slug: "o10-avisos", p: { so_leitura: true } }), "sem_permissao");
await recusa("campo desconhecido é recusado", () => rpc(MM, "alumia_estr_salvar", { p_slug: "o10-avisos", p: { gps: "-23.5,-46.6" } }), "invalido:estrutura");
await recusa("respostas fora da lista são recusadas", () => rpc(MM, "alumia_estr_salvar", { p_slug: "o10-avisos", p: { respostas: "amigos" } }), "invalido:respostas");
await espera("a moderação liga o só leitura, respostas de quem é da comunidade", () => rpc(MM, "alumia_estr_salvar", { p_slug: "o10-avisos", p: { so_leitura: true, respostas: "membros" } }),
  (r) => r.so_leitura === true && r.respostas === "membros" && r.posso_abrir_post === true);
const aviso = await espera("quem modera abre post", () => postar("modmae", "Assembleia geral sábado às 10h.", { comunidade: "o10-avisos" }), (r) => typeof r?.id === "string");
await recusa("quem é membro não abre post", () => postar("membro", "Posso postar aqui?", { comunidade: "o10-avisos" }), "so_leitura");
await recusa("quem é de fora também não", () => postar("fora", "E eu?", { comunidade: "o10-avisos" }), "so_leitura");
await espera("a tela já sabe: membro não abre post, mas responde", () => rpc(como(P.membro), "alumia_estr_ver", { p_slug: "o10-avisos" }), (r) => r.posso_abrir_post === false && r.posso_responder === true);
await espera("membro responde", () => postar("membro", "Vou levar a faixa.", { resposta_a: aviso.id }), (r) => typeof r?.id === "string");
await recusa("quem não é da comunidade não responde (escolha: membros)", () => postar("fora", "Também quero ir.", { resposta_a: aviso.id }), "so_leitura_respostas");
await espera("respostas para todos: quem é de fora responde", async () => {
  await rpc(MM, "alumia_estr_salvar", { p_slug: "o10-avisos", p: { respostas: "todos" } });
  return postar("fora", "Também quero ir.", { resposta_a: aviso.id });
}, (r) => typeof r?.id === "string");
await recusa("respostas fechadas: nem membro responde", async () => {
  await rpc(MM, "alumia_estr_salvar", { p_slug: "o10-avisos", p: { respostas: "ninguem" } });
  return postar("membro", "Mais uma.", { resposta_a: aviso.id });
}, "so_leitura_respostas");
await espera("quem modera responde mesmo assim", () => postar("modmae", "Ônibus sai às 9h.", { resposta_a: aviso.id }), (r) => typeof r?.id === "string");
await recusa("o gatilho vale em qualquer caminho (gravação direta)", () => banco.exclusivo(() => banco.pg.transaction(async (tx) => {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: P.membro, aal: "aal2" })]);
  await tx.query("insert into interno.rede_posts (autor, texto, comunidade) values ($1, 'direto no banco', 'o10-avisos')", [P.membro]);
})), "so_leitura");
await espera("o ponto dos cargos (10B) libera quem ele disser", async () => {
  await dono(`create or replace function interno.alumia_o10_cargo_posta(p_com text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$ select p_com = 'o10-avisos' and p_quem = '${P.membro}'::uuid $$`);
  return postar("membro", "Informe da secretaria.", { comunidade: "o10-avisos" });
}, (r) => typeof r?.id === "string");
await espera("rodar a migração de novo não apaga o ponto dos cargos da 10B", async () => {
  await exec(sql);
  return (await dono("select prosrc from pg_proc where proname = 'alumia_o10_cargo_posta'")).rows[0].prosrc;
}, (s) => s.includes("o10-avisos"));
await dono("create or replace function interno.alumia_o10_cargo_posta(p_com text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$ select false $$");
await rpc(MM, "alumia_estr_salvar", { p_slug: "o10-avisos", p: { so_leitura: false } });
await espera("só leitura desligado: membro volta a postar", () => postar("membro", "Agora sim.", { comunidade: "o10-avisos" }), (r) => typeof r?.id === "string");
await zerar();

// ═══════════════════ 5. Cidade e bairro ═══════════════════
await recusa("município sem UF é recusado", () => rpc(MM, "alumia_estr_salvar", { p_slug: "o10-moradia", p: { municipio: "São Paulo" } }), "invalido:uf");
await recusa("UF que não existe é recusada", () => rpc(MM, "alumia_estr_salvar", { p_slug: "o10-moradia", p: { uf: "XX", municipio: "São Paulo" } }), "invalido:uf");
await recusa("nome com marcação é recusado", () => rpc(MM, "alumia_estr_salvar", { p_slug: "o10-moradia", p: { uf: "SP", municipio: "<b>SP</b>" } }), "invalido:municipio");
await espera("a moderação escreve a cidade (espaços arrumados)", () => rpc(MM, "alumia_estr_salvar", { p_slug: "o10-moradia", p: { uf: "sp", municipio: "  São   Paulo " } }),
  (r) => r.local?.uf === "SP" && r.local.municipio === "São Paulo" && r.local.bairro === null);
await espera("a filha escreve o bairro, com o município escrito de outro jeito", () => rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { uf: "SP", municipio: "sao paulo", bairro: "Itaquera" } }),
  (r) => r.local?.bairro === "Itaquera");
await rpc(MF, "alumia_estr_salvar", { p_slug: "o10-fechada", p: { uf: "SP", municipio: "São Paulo", bairro: "Sé" } });
await rpc(como(P.modfilha), "alumia_estr_salvar", { p_slug: "o10-fisica", p: { uf: "PE", municipio: "Recife" } });
await espera("a lista por município junta as grafias e conta lugares; a fechada não entra para quem é de fora", () => rpc(como(P.fora), "alumia_estr_cidades"),
  (r) => r.length === 2 && r.find((c) => c.uf === "SP")?.comunidades === 2 && r.find((c) => c.uf === "PE")?.comunidades === 1 && !JSON.stringify(r).includes("pessoas"));
await espera("quem é da fechada a conta", () => rpc(MF, "alumia_estr_cidades"), (r) => r.find((c) => c.uf === "SP")?.comunidades === 3);
await espera("as comunidades do município: a cidade toda primeiro, depois por bairro, com a situação de quem pergunta", () => rpc(como(P.membro), "alumia_estr_da_cidade", { p_uf: "SP", p_municipio: "São Paulo" }),
  (r) => r.itens.length === 2 && r.itens[0].slug === "o10-moradia" && r.itens[0].bairro === null && r.itens[1].bairro === "Itaquera" && r.itens[1].situacao === "membro" && (r.itens[0].posts_7d === null || r.itens[0].posts_7d >= 3));
await espera("visitante vê os lugares sem número", () => rpc(visitante, "alumia_estr_da_cidade", { p_uf: "SP", p_municipio: "SÃO PAULO" }),
  (r) => r.itens.length === 2 && r.itens.every((i) => i.posts_7d === null && i.situacao === null));
await espera("bairro sem município cai junto", () => rpc(MF, "alumia_estr_salvar", { p_slug: "o10-fechada", p: { municipio: "" } }), (r) => r.local === null);
await zerar();

// ═══════════════════ 6. Os Espaços da organização ═══════════════════
await recusa("organização sem selo não recebe comunidade", () => rpc(MM, "alumia_estr_org_pedir", { p_slug: "o10-moradia", p_handle: "o10_semselo" }), "sem_selo");
await espera("a moderação pede para a comunidade aparecer nos Espaços; quem gerencia é avisada", async () => {
  const r = await rpc(MM, "alumia_estr_org_pedir", { p_slug: "o10-moradia", p_handle: "@o10_orgperfil" });
  const avisos = (await dono("select para from interno.avisos where texto like '%Espaços da organização%'")).rows.map((x) => x.para);
  return { r, avisos };
}, ({ r, avisos }) => r.org === null && r.org_pedido?.handle === "o10_orgperfil" && avisos.length === 1 && avisos[0] === P.gestora);
await espera("antes de aceitar, os Espaços só têm o núcleo; quem gerencia vê o pedido", () => rpc(como(P.gestora), "alumia_estr_espacos", { p_handle: "o10_orgperfil" }),
  (r) => r.comunidades.length === 0 && r.nucleos.length === 1 && r.nucleos[0].nome === "Núcleo Zona Leste" && r.pedidos.length === 1 && r.gerencio === true);
await recusa("quem não gerencia não decide", () => rpc(MM, "alumia_estr_org_decidir", { p_handle: "o10_orgperfil", p_slug: "o10-moradia", p_aceita: true }), "sem_permissao");
await espera("quem gerencia aceita: a comunidade (com as filhas) aparece nos Espaços, sem pessoas", async () => {
  await rpc(MM, "alumia_estr_mae_decidir", { p_mae: "o10-moradia", p_filha: "o10-ocupa-leste", p_aceita: true }).catch(() => null);
  await rpc(como(P.gestora), "alumia_estr_org_decidir", { p_handle: "o10_orgperfil", p_slug: "o10-moradia", p_aceita: true });
  return rpc(visitante, "alumia_estr_espacos", { p_handle: "o10_orgperfil" });
}, (r) => r.selo === true && r.comunidades.length === 1 && r.comunidades[0].slug === "o10-moradia" && r.comunidades[0].municipio === "São Paulo"
  && r.comunidades[0].filhas.length === 1 && r.comunidades[0].posts_7d === null && r.pedidos === null && r.gerencio === false
  && !JSON.stringify(r).includes(P.gestora) && !JSON.stringify(r).includes(P.modmae));
await espera("a comunidade mostra a organização", () => rpc(visitante, "alumia_estr_ver", { p_slug: "o10-moradia" }), (r) => r.org?.handle === "o10_orgperfil");
await espera("organização sem selo: os Espaços não respondem a quem é de fora", () => rpc(como(P.fora), "alumia_estr_espacos", { p_handle: "o10_semselo" }), (r) => r === null);
await espera("perdeu o selo: some da comunidade e dos Espaços", async () => {
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.orgperfil]);
  const r = await Promise.all([rpc(visitante, "alumia_estr_ver", { p_slug: "o10-moradia" }), rpc(visitante, "alumia_estr_espacos", { p_handle: "o10_orgperfil" })]);
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.orgperfil]);
  return r;
}, ([c, e]) => c.org === null && e === null);
await zerar();

// ═══════════════════ 7. Repostar em outra comunidade ═══════════════════
const original = await postar("autora", "Mutirão de limpeza na ocupação, domingo cedo.", { comunidade: "o10-moradia" });
await recusa("quem escreveu não deixou citar (padrão dos posts novos): não reposta", () => rpc(como(P.membro), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-ocupa-leste", p_texto: "Bora!" }), "citar_fechado");
await dono("update interno.rede_b1_post set citar_quem = 'todos' where post = $1", [original.id]);
await recusa("comentário vazio é recusado", () => rpc(como(P.membro), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-ocupa-leste", p_texto: "  " }), "invalido:texto");
await recusa("não se reposta na mesma comunidade", () => rpc(como(P.membro), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-moradia", p_texto: "De novo" }), "mesma_comunidade");
await recusa("comunidade que não existe é recusada", () => rpc(como(P.membro), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-nada", p_texto: "Bora" }), "invalido:comunidade");
await recusa("comunidade fechada de que não se é membro também", () => rpc(como(P.membro), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-fechada", p_texto: "Bora" }), "invalido:comunidade");
const repost = await espera("reposta na comunidade de destino, com a origem", () => rpc(como(P.membro), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-ocupa-leste", p_texto: "Quem é da Leste, cola!" }),
  (r) => r.comunidade === "o10-ocupa-leste" && r.origem?.slug === "o10-moradia" && r.destino?.slug === "o10-ocupa-leste" && r.citado?.id === original.id);
await espera("a origem aparece para quem lê, sem dizer quem trouxe", () => rpc(como(P.fora), "alumia_estr_origens", { p_ids: [repost.id, original.id] }),
  (r) => r.length === 1 && r[0].post === repost.id && r[0].origem?.slug === "o10-moradia" && r[0].perfil === false && !JSON.stringify(r).includes(P.membro));
await espera("o repost na comunidade de destino tem o público de membros", async () => (await dono("select publico, quote_of from interno.rede_posts where id = $1", [repost.id])).rows[0],
  (r) => r.publico === "membros" && r.quote_of === original.id);
await recusa("resposta não se reposta", async () => {
  const resp = await postar("membro", "Eu vou!", { resposta_a: original.id });
  return rpc(como(P.membro2), "alumia_estr_repostar", { p_post: resp.id, p_destino: "o10-ocupa-leste", p_texto: "Olha" });
}, "invalido:repostar");
await recusa("post só da comunidade não viaja", async () => {
  const doLugar = await postar("autora", "Só para quem é da moradia.", { comunidade: "o10-moradia", publico: "comunidade" });
  await dono("update interno.rede_b1_post set citar_quem = 'todos' where post = $1", [doLugar.id]);
  return rpc(como(P.membro), "alumia_estr_repostar", { p_post: doLugar.id, p_destino: "o10-ocupa-leste", p_texto: "Olha" });
}, "repostar_publico");
await recusa("o destino que só aceita repost da moderação recusa quem é membro", async () => {
  await rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { reposts: "moderacao" } });
  return rpc(como(P.membro2), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-ocupa-leste", p_texto: "Olha" });
}, "repostar_fechado");
await espera("e aceita da moderação dele", () => rpc(MF, "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-ocupa-leste", p_texto: "Da moderação: vamos juntos." }), (r) => r.comunidade === "o10-ocupa-leste");
await recusa("destino que não aceita repost", async () => {
  await rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { reposts: "ninguem" } });
  return rpc(MF, "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-ocupa-leste", p_texto: "De novo" });
}, "repostar_fechado");
await espera("para a disciplina aberta à internet, um post só de membros vai como membros (nunca mais aberto)", async () => {
  const r = await rpc(como(P.membro2), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-fisica", p_texto: "Física também é luta." });
  return (await dono("select publico from interno.rede_posts where id = $1", [r.id])).rows[0];
}, (r) => r.publico === "membros");
await recusa("o destino só leitura vale para repost também", async () => {
  await rpc(MM, "alumia_estr_salvar", { p_slug: "o10-avisos", p: { so_leitura: true } });
  return rpc(como(P.membro), "alumia_estr_repostar", { p_post: original.id, p_destino: "o10-avisos", p_texto: "Para os avisos" });
}, "so_leitura");
await espera("origem restrita: quem não vê a comunidade de origem fica sabendo só que é restrita", async () => {
  await rpc(MF, "alumia_estr_salvar", { p_slug: "o10-ocupa-leste", p: { reposts: "todos" } });
  const daFechada = await postar("modfilha", "Da fechada, para todos.", { comunidade: "o10-fechada", publico: "membros" }).catch((e) => ({ erro: e.message }));
  // Comunidade fechada não deixa post sair dela: o repost recusa (repostar_publico), e a origem de um repost antigo vem restrita.
  await dono("insert into interno.alumia_com_reposts (post, origem, destino) values ($1, 'o10-fechada', 'o10-ocupa-leste') on conflict (post) do update set origem = 'o10-fechada'", [repost.id]);
  const r = await rpc(como(P.fora), "alumia_estr_origens", { p_ids: [repost.id] });
  await dono("update interno.alumia_com_reposts set origem = 'o10-moradia' where post = $1", [repost.id]);
  return { r, daFechada };
}, ({ r }) => r.length === 1 && r[0].origem === null && r[0].restrita === true);
await zerar();

// ═══════════════════ 8. A proposta já traz cidade e mãe ═══════════════════
const proposta = await espera("propor comunidade nova", () => rpc(como(P.propoe), "rede_com_propor", { p: {
  slug: "o10-ocupa-sul", nome: "Ocupação Sul", objetivo: "Organizar a ocupação da zona sul com assembleias.", regras: "Respeito nas assembleias.\nNada de dado pessoal.",
  moderadores: ["o10_propoe", "o10_membro2"] } }), (r) => typeof r?.id === "string");
await recusa("só quem propôs acrescenta", () => rpc(como(P.fora), "alumia_estr_proposta", { p_id: proposta.id, p: { uf: "SP", municipio: "São Paulo" } }), "nao_encontrado");
await recusa("a mãe que já é filha não serve", () => rpc(como(P.propoe), "alumia_estr_proposta", { p_id: proposta.id, p: { mae: "o10-ocupa-leste" } }), "mae_e_filha");
await espera("quem propôs acrescenta cidade, bairro e mãe", () => rpc(como(P.propoe), "alumia_estr_proposta", { p_id: proposta.id, p: { mae: "o10-moradia", uf: "SP", municipio: "São Paulo", bairro: "Grajaú" } }),
  (r) => r.mae === "o10-moradia" && r.bairro === "Grajaú");
await espera("aprovada: a comunidade nova nasce com a cidade e o pedido à mãe; o rascunho some", async () => {
  await rpc(como(P.coord), "rede_com_decidir", { p_id: proposta.id, p_aprova: true, p_motivo: "" });
  const nova = await rpc(como(P.propoe), "alumia_estr_ver", { p_slug: "o10-ocupa-sul" });
  const resto = (await dono("select count(*)::int as n from interno.alumia_com_proposta_estrutura")).rows[0].n;
  return { nova, resto };
}, ({ nova, resto }) => nova.local?.bairro === "Grajaú" && nova.mae_pedido?.slug === "o10-moradia" && resto === 0);

// ═══════════════════ 9. Nada de endereço de rede ═══════════════════
await espera("nenhuma coluna nova guarda endereço ou coordenada", async () =>
  (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta|lat|lng|latitude|longitude)($|_)/.test(c.column_name)));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`estrutura das comunidades (onda 10): ${certos} conferências certas.`);
process.exit(0);
