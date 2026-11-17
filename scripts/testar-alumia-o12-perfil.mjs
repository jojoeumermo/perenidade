// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o perfil da onda 12 (supabase/migracoes/20261118-alumia-o12-perfil.sql) num Postgres de verdade (scripts/banco-local.mjs),
// com a migração rodada TRÊS vezes sobre o install.sql, e as regras da tela (lib/rede/secoes-perfil.ts):
//   · seções: nada aparece sem escolha; só as seções conhecidas, sem repetir; o "Sobre" só com a seção; comunidades só as abertas
//     de que a pessoa é membro, e sair da comunidade a tira do perfil; a mesma regra de quem vê o perfil (bloqueio, sem conta);
//   · links: até 8, só https, sem rastreio, sem repetir; o rel="me" só marca pelo servidor (chave de serviço), logo depois do
//     pedido da própria pessoa; trocar o @ desfaz; Instagram pela mediação, com código; só a mediação vê a fila e decide;
//   · status: "na luta" e "ausente" na lista fechada; só a roda vê o status que a pessoa deixou para a roda;
//   · voluntariado: frente da lista fechada (sem frente política), anos só; só a linha confirmada pela coordenação aparece; recusar
//     pede motivo; ninguém decide a própria linha; fica no registro do painel;
//   · pacotes: convidar não põe no pacote; só quem aceitou está nele; sair some na hora; perfil trancado não entra;
//   · as listas e os limites da tela iguais aos do banco; o rel="me" lido do HTML.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o12-perfil.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  alternarSecao, apontaParaOPerfil, arrumarLinks, arrumarSecoes, arrumarSobre, FRENTES_DE_VOLUNTARIADO, LIMITES_DO_PERFIL, linkPedeMediacao, moverSecao,
  ordemDaFileira, paginaApontaDeVolta, periodoEmTexto, periodoOk, SECOES_DO_PERFIL, STATUS_TODOS, numeroQueAparece, enderecoDoPacote,
} from "../lib/rede/secoes-perfil.ts";

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
const sql = ler("supabase/migracoes/20261118-alumia-o12-perfil.sql");
const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
ok("toda função é security definer com search_path fixo", funcoes.length >= 20 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f)));
ok("nenhuma função tem parâmetro do tipo linha com valor padrão", !funcoes.some((f) => /\(([^)]*\binterno\.[a-z_]+\b[^)]*\bdefault\b[^)]*)\)/.test(f.split("\n")[0])));
const tabelas = ["alumia_perfil_secoes", "alumia_perfil_links", "alumia_perfil_voluntariado", "alumia_pacote_convites"];
ok("as tabelas nascem com RLS e sem permissão para anon e authenticated", tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !/\b(inet|cidr)\b/.test(sql) && !/\b(ip|endereco_ip|porta_origem)\s+(text|inet)/.test(sql));
ok("não mexe na versão da Alumia nem no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-400)));
ok("nenhuma localização nem perfil de comportamento", !/latitude|longitude|geoloc|comportamento/i.test(sql.replace(/--.*$/gm, "")));
ok("a lista de seções da tela é a do banco", sql.includes(`array[${SECOES_DO_PERFIL.map((s) => `'${s}'`).join(", ")}]::text[]`));
ok("a lista de frentes da tela é a do banco (tabela e função)", (() => {
  const lista = FRENTES_DE_VOLUNTARIADO.map((f) => `'${f}'`).join(", ");
  return sql.replace(/\s+/g, " ").includes(`frente in (${lista})`) && sql.includes(`v_frente not in (${lista})`);
})());
ok("nenhuma frente política no histórico", !FRENTES_DE_VOLUNTARIADO.some((f) => /revolucion|partido|militan|represent/.test(f)) && !/revolucionarios/.test(sql));
ok("a lista fechada do status da tela é a do banco", sql.includes(`in (${STATUS_TODOS.map((s) => `'${s}'`).join(", ")})`));
ok("os limites da tela são os do banco", sql.includes(`char_length(sobre) <= ${LIMITES_DO_PERFIL.sobre}`) && sql.includes(`cardinality(comunidades) <= ${LIMITES_DO_PERFIL.comunidades}`)
  && sql.includes(`ordem between 1 and ${LIMITES_DO_PERFIL.links}`) && sql.includes(`char_length(titulo) between 1 and ${LIMITES_DO_PERFIL.tituloDoLink}`)
  && sql.includes(`char_length(url) <= ${LIMITES_DO_PERFIL.url}`) && sql.includes(`>= ${LIMITES_DO_PERFIL.voluntariado} then perform interno.erro('limite:voluntariado')`)
  && sql.includes(`ano_de between ${LIMITES_DO_PERFIL.anoMinimo} and 2100`));

// ═══════════════════ 0b. As regras da tela ═══════════════════
ok("seções: só as conhecidas, sem repetir", JSON.stringify(arrumarSecoes(["sobre", "x", "links", "sobre", 3])) === '["sobre","links"]' && arrumarSecoes(null).length === 0);
ok("seções: ligar, desligar e mover", JSON.stringify(alternarSecao(["sobre"], "links", true)) === '["sobre","links"]' && alternarSecao(["sobre", "links"], "sobre", false).join() === "links"
  && moverSecao(["sobre", "links", "trilhas"], "trilhas", -1).join() === "sobre,trilhas,links" && moverSecao(["sobre"], "sobre", -1).join() === "sobre");
ok("a fileira sem escolha fica como sempre (só as peças encaixadas)", JSON.stringify(ordemDaFileira(null, ["destaques", "colecoes", "conquistas"]).map((i) => i.chave)) === '["destaques","colecoes","conquistas"]');
ok("a fileira com escolha segue a ordem da pessoa e esconde o que não escolheu", (() => {
  const f = ordemDaFileira(["conquistas", "sobre", "destaques"], ["destaques", "colecoes", "conquistas", "espacos"]);
  return JSON.stringify(f) === JSON.stringify([{ tipo: "encaixe", chave: "conquistas" }, { tipo: "secao", chave: "sobre" }, { tipo: "encaixe", chave: "destaques" }, { tipo: "encaixe", chave: "espacos" }]);
})());
ok("a seção encaixada sem a peça (frente desligada) não aparece", ordemDaFileira(["colecoes", "links"], []).map((i) => i.chave).join() === "links");
ok("o Sobre sem controle e sem quebra demais", arrumarSobre("a\r\n\n\n\nb‮ c\u0007") === "a\n\nb c" && arrumarSobre("x".repeat(1200)).length === 1000);
ok("links: só https limpo, sem repetir, até 8", (() => {
  const l = arrumarLinks([{ titulo: "Site", url: "https://exemplo.org/?utm_source=x" }, { titulo: "De novo", url: "https://exemplo.org/" }, { titulo: "", url: "https://a.org" },
    { titulo: "Velho", url: "http://a.org" }, ...Array.from({ length: 12 }, (_, i) => ({ titulo: `L${i}`, url: `https://l${i}.org` }))]);
  return l.length === 8 && l[0].url === "https://exemplo.org/" && !l.some((x) => x.titulo === "De novo" || x.url.startsWith("http:"));
})());
ok("Instagram pede a mediação; o resto, rel=me", linkPedeMediacao("https://www.instagram.com/faisca") && linkPedeMediacao("https://instagram.com/faisca") && !linkPedeMediacao("https://exemplo.org"));
const BASES = ["https://alumia.institutolucia.org", "https://institutolucia.org"];
ok("o rel=me aceita o perfil nas duas bases, com e sem idioma, e o @ do Fediverso", apontaParaOPerfil("https://alumia.institutolucia.org/pt/u/faisca", "faisca", BASES)
  && apontaParaOPerfil("https://institutolucia.org/pt/alumia/u/faisca/", "faisca", BASES) && apontaParaOPerfil("https://alumia.institutolucia.org/@faisca", "faisca", BASES)
  && apontaParaOPerfil("http://institutolucia.org/u/faisca", "faisca", BASES));
ok("o rel=me recusa outro @, outro site, consulta e base parecida", !apontaParaOPerfil("https://alumia.institutolucia.org/pt/u/faiscaa", "faisca", BASES)
  && !apontaParaOPerfil("https://institutolucia.org.mal.com/u/faisca", "faisca", BASES) && !apontaParaOPerfil("https://institutolucia.org/u/faisca?x=1", "faisca", BASES)
  && !apontaParaOPerfil("https://alumia.institutolucia.org/pt/u/faisca", "fa", BASES));
ok("a página de fora: <a> e <link> com rel=me, relativo e com várias palavras", paginaApontaDeVolta('<p><a class="x" rel="noopener me" href="https://alumia.institutolucia.org/pt/u/faisca">eu</a></p>', "https://exemplo.org/", "faisca", BASES)
  && paginaApontaDeVolta("<link rel=me href='https://institutolucia.org/pt/alumia/u/faisca'>", "https://exemplo.org/", "faisca", BASES)
  && paginaApontaDeVolta('<a rel="me" href="/pt/u/faisca">eu</a>', "https://alumia.institutolucia.org/sobre", "faisca", BASES));
ok("a página de fora: sem rel=me, em comentário ou de outro @ não conta", !paginaApontaDeVolta('<a href="https://alumia.institutolucia.org/pt/u/faisca">eu</a>', "https://exemplo.org/", "faisca", BASES)
  && !paginaApontaDeVolta('<!-- <a rel="me" href="https://alumia.institutolucia.org/pt/u/faisca"> -->', "https://exemplo.org/", "faisca", BASES)
  && !paginaApontaDeVolta('<a rel="me" href="https://alumia.institutolucia.org/pt/u/outra">x</a>', "https://exemplo.org/", "faisca", BASES)
  && !paginaApontaDeVolta('<a rel="menu" href="https://alumia.institutolucia.org/pt/u/faisca">x</a>', "https://exemplo.org/", "faisca", BASES));
const ano = new Date().getUTCFullYear();
ok("o período em anos", periodoOk(2020, 2022) && periodoOk(2024, null) && !periodoOk(2014, null) && !periodoOk(2022, 2020) && !periodoOk(ano + 2, null) && !periodoOk(2020.5, null)
  && periodoEmTexto(2023, null, "hoje") === "2023 – hoje" && periodoEmTexto(2024, 2024, "hoje") === "2024" && periodoEmTexto(2022, 2024, "x") === "2022 – 2024");
ok("número só a partir de 3; endereço do pacote", numeroQueAparece(2) === null && numeroQueAparece(3) === 3 && numeroQueAparece(null) === null && enderecoDoPacote("pt", "comecar") === "/pt/alumia/pacote/comecar");

// ═══════════════════ 0c. Os textos ═══════════════════
{
  const pt = JSON.parse(ler("i18n/rede/perfil/secoes/pt.json"));
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = chaves(pt).filter((k) => k !== "_rascunho").sort().join("|");
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const t = JSON.parse(ler(`i18n/rede/perfil/secoes/${l}.json`));
    ok(`os textos em ${l} têm as mesmas chaves do português`, chaves(t).filter((k) => k !== "_rascunho").sort().join("|") === base);
  }
  ok("toda seção, frente e status novo tem nome", SECOES_DO_PERFIL.every((s) => typeof pt.secoes.nomes[s] === "string") && FRENTES_DE_VOLUNTARIADO.every((f) => typeof pt.voluntariado.frentes[f] === "string")
    && typeof pt.status.tipos.na_luta === "string" && typeof pt.status.tipos.ausente === "string");
  ok("nenhum texto novo usa as palavras proibidas", !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt)));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
// O banco como estava antes desta migração (o install.sql até ela): depois da junta, o install.sql já a traz, e o pacote antigo
// tem de existir ANTES de ela rodar pela primeira vez.
const banco = await criarBanco({ antesDe: sql });
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const servico = { papel: "service_role" };
const zerar = () => dono("delete from interno.limites");

// Um pacote com uma pessoa dentro ANTES da migração: tem de virar convite.
const antes = await criarUsuario("antes@o12.local", "Pessoa antes");
await rpc({ papel: "authenticated", sub: antes, aal: "aal2" }, "eu");
await dono("insert into interno.rede_desc_pacotes (slug, titulo) values ('antigo', 'Pacote antigo') on conflict do nothing");
await dono("insert into interno.rede_desc_pacote_pessoas (pacote, usuario) values ('antigo', $1)", [antes]);

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("quem estava num pacote antes virou convite (e não está mais no pacote)", async () => (await dono(
  "select (select count(*)::int from interno.rede_desc_pacote_pessoas where usuario = $1) as dentro, (select count(*)::int from interno.alumia_pacote_convites where usuario = $1) as convites", [antes])).rows[0],
(r) => r.dentro === 0 && r.convites === 1);
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
const NOVAS = ["alumia_perfil_secoes", "alumia_perfil_secoes_minhas", "alumia_perfil_secoes_salvar", "alumia_perfil_links_salvar", "alumia_perfil_link_conferir", "alumia_perfil_link_mediacao",
  "alumia_perfil_links_fila", "alumia_perfil_link_decidir", "alumia_perfil_voluntariado_salvar", "alumia_perfil_voluntariado_apagar", "alumia_painel_voluntariado_fila",
  "alumia_painel_voluntariado_decidir", "alumia_pacotes_meus", "alumia_pacote_responder", "alumia_pacotes_cuidar", "rede_perfil_extras", "rede_perfil_extras_editar", "rede_desc_pacote_pessoa"];
await espera("toda função pública de membro passa pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)", [NOVAS])).rows,
(rs) => rs.length === NOVAS.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para ninguém de fora", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o12p\\_%'`)).rows,
(rs) => rs.length === 4 && rs.every((r) => !r.a && !r.b));
await espera("marcar o link conferido é só da chave de serviço", async () =>
  (await dono(`select has_function_privilege('anon', 'public.alumia_perfil_link_resultado(uuid, uuid, boolean)', 'execute') as a,
                      has_function_privilege('authenticated', 'public.alumia_perfil_link_resultado(uuid, uuid, boolean)', 'execute') as b,
                      has_function_privilege('service_role', 'public.alumia_perfil_link_resultado(uuid, uuid, boolean)', 'execute') as c`)).rows[0],
(r) => !r.a && !r.b && r.c);
await espera("nenhuma função pública devolve quem atuou numa frente ou quem foi convidado para um pacote", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
               and (p.proname like 'alumia\\_perfil\\_%' or p.proname like 'alumia\\_pacote%' or p.proname like 'alumia\\_painel\\_voluntariado%') and p.proname ~ '(quem|pessoas|membros|lista|convidados|voluntarios)'`)).rows,
(rs) => rs.length === 0);

const P = {};
const NOMES = ["coord", "media", "faisca", "rosa", "lia", "fora", "bloq", "tranca"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o12.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.media]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o12_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update interno.perfis set rede_modo = 'trancado' where id = $1", [P.tranca]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.faisca, P.bloq]);
const C = (n) => como(P[n]);

// ═══════════════════ 2. Seções ═══════════════════
await espera("sem escolha, nenhuma seção (secoes nulo)", () => rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" }), (r) => r && r.secoes === null);
await recusa("seção desconhecida", () => rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { secoes: ["sobre", "seguidores"] } }), "invalido:secoes");
await recusa("seção repetida", () => rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { secoes: ["sobre", "sobre"] } }), "invalido:secoes");
await recusa("Sobre comprido demais", () => rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { sobre: "x".repeat(1001) } }), "invalido:sobre");
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('passe-livre', 'Passe Livre', 'lutas', 'aberta'), ('nucleo-fechado', 'Núcleo fechado', 'lutas', 'fechada'), ('outra-aberta', 'Outra aberta', 'lutas', 'aberta') on conflict do nothing");
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('passe-livre', $1), ('nucleo-fechado', $1)", [P.faisca]);
await espera("as comunidades que dá para escolher: só abertas e minhas", () => rpc(C("faisca"), "alumia_perfil_secoes_minhas"), (r) => r.secoes === null && r.possiveis.length === 1 && r.possiveis[0].slug === "passe-livre");
await recusa("comunidade fechada não vai ao perfil", () => rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { comunidades: ["nucleo-fechado"] } }), "invalido:comunidades");
await recusa("comunidade de que não sou membro não vai ao perfil", () => rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { comunidades: ["outra-aberta"] } }), "invalido:comunidades");
await espera("guardar as comunidades e o Sobre, sem as seções ligadas", () => rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { comunidades: ["passe-livre"], sobre: "Militante.\r\n\n\n\nNa Zona Leste." } }),
  (r) => r.secoes.length === 0 && r.sobre === "Militante.\n\nNa Zona Leste." && r.comunidades[0] === "passe-livre");
await espera("sem a seção ligada, nada aparece para os outros", () => rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" }), (r) => r.secoes.length === 0 && !("sobre" in r) && !("comunidades" in r));
await espera("com as seções ligadas, aparecem na ordem dela", async () => {
  await rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { secoes: ["comunidades", "sobre", "colecoes"] } });
  return rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" });
}, (r) => r.secoes.join() === "comunidades,sobre,colecoes" && r.sobre === "Militante.\n\nNa Zona Leste." && r.comunidades.length === 1 && r.comunidades[0].nome === "Passe Livre" && !("links" in r));
await espera("saiu da comunidade, sumiu do perfil", async () => {
  await dono("delete from interno.rede_comunidade_membros where comunidade = 'passe-livre' and usuario = $1", [P.faisca]);
  return rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" });
}, (r) => r.comunidades.length === 0);
await espera("bloqueio: quem foi bloqueado não vê as seções", () => rpc(C("bloq"), "alumia_perfil_secoes", { p_handle: "o12_faisca" }), (r) => r === null);
await espera("sem conta, as seções de uma pessoa não aparecem", async () => {
  try {
    return await rpc(visitante, "alumia_perfil_secoes", { p_handle: "o12_faisca" });
  } catch {
    return null;
  }
}, (r) => r === null);

// ═══════════════════ 3. Links ═══════════════════
await zerar();
await recusa("link com rastreio", () => rpc(C("faisca"), "alumia_perfil_links_salvar", { p: [{ titulo: "Site", url: "https://exemplo.org/?utm_source=x" }] }), "invalido:links");
await recusa("link sem https", () => rpc(C("faisca"), "alumia_perfil_links_salvar", { p: [{ titulo: "Site", url: "http://exemplo.org/" }] }), "invalido:links");
await recusa("link repetido", () => rpc(C("faisca"), "alumia_perfil_links_salvar", { p: [{ titulo: "A", url: "https://exemplo.org/" }, { titulo: "B", url: "https://exemplo.org/" }] }), "invalido:links");
await recusa("mais de 8", () => rpc(C("faisca"), "alumia_perfil_links_salvar", { p: Array.from({ length: 9 }, (_, i) => ({ titulo: `L${i}`, url: `https://l${i}.org/` })) }), "invalido:links");
const meus = await espera("guardar os links na ordem", () => rpc(C("faisca"), "alumia_perfil_links_salvar", { p: [{ titulo: "Meu site", url: "https://exemplo.org/" }, { titulo: "Instagram", url: "https://www.instagram.com/faisca" }] }),
  (r) => r.links.length === 2 && r.links[0].titulo === "Meu site" && r.links[1].conferido === null);
const site = meus?.links[0].id;
const insta = meus?.links[1].id;
await recusa("a própria pessoa não marca o link como conferido", () => rpc(C("faisca"), "alumia_perfil_link_resultado", { p_usuario: P.faisca, p_link: site, p_ok: true }), "permission denied");
await recusa("o servidor não marca sem o pedido da pessoa", () => rpc(servico, "alumia_perfil_link_resultado", { p_usuario: P.faisca, p_link: site, p_ok: true }), "sem_pedido");
await recusa("ninguém pede a conferência do link de outra pessoa", () => rpc(C("rosa"), "alumia_perfil_link_conferir", { p_link: site }), "nao_encontrado");
await espera("o pedido devolve o endereço e o @ (para o servidor buscar)", () => rpc(C("faisca"), "alumia_perfil_link_conferir", { p_link: site }), (r) => r.url === "https://exemplo.org/" && r.handle === "o12_faisca");
await recusa("o servidor não marca o link com a conta errada", () => rpc(servico, "alumia_perfil_link_resultado", { p_usuario: P.rosa, p_link: site, p_ok: true }), "nao_encontrado");
await espera("o servidor marca, logo depois do pedido", () => rpc(servico, "alumia_perfil_link_resultado", { p_usuario: P.faisca, p_link: site, p_ok: true }), (r) => r.conferido === true);
await recusa("e o pedido vale uma vez só", () => rpc(servico, "alumia_perfil_link_resultado", { p_usuario: P.faisca, p_link: site, p_ok: true }), "sem_pedido");
await espera("com a seção Links, aparecem para os outros com a marca", async () => {
  await rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { secoes: ["links", "sobre"] } });
  return rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" });
}, (r) => r.links.length === 2 && r.links[0].conferido === "rel_me" && r.links[1].conferido === null && !("codigo" in r.links[1]));
await espera("guardar de novo com o mesmo endereço guarda a marca; trocar a ordem também", () => rpc(C("faisca"), "alumia_perfil_links_salvar", { p: [{ titulo: "Instagram", url: "https://www.instagram.com/faisca" }, { titulo: "Site novo", url: "https://exemplo.org/" }] }),
  (r) => r.links[1].conferido === "rel_me" && r.links[1].titulo === "Site novo" && r.links[0].titulo === "Instagram");
await espera("trocar o @ desfaz o que o rel=me conferiu", async () => {
  await dono("update interno.perfis set rede_handle = 'o12_faisca2' where id = $1", [P.faisca]);
  await dono("update interno.perfis set rede_handle = 'o12_faisca' where id = $1", [P.faisca]);
  return rpc(C("faisca"), "alumia_perfil_secoes_minhas");
}, (r) => r.links.every((l) => l.conferido === null));
await recusa("a mediação é só para o Instagram", () => rpc(C("faisca"), "alumia_perfil_link_mediacao", { p_link: site, p_sim: true }), "invalido:site");
const pedido = await espera("pedir à mediação dá um código", () => rpc(C("faisca"), "alumia_perfil_link_mediacao", { p_link: insta, p_sim: true }), (r) => /^alumia-[a-f0-9]{8}$/.test(r.codigo) && r.mediacao === true);
await recusa("quem não é da mediação não vê a fila", () => rpc(C("rosa"), "alumia_perfil_links_fila"), "sem_permissao");
await espera("a mediação vê o endereço, o código e o @", () => rpc(C("media"), "alumia_perfil_links_fila"), (r) => r.length === 1 && r[0].codigo === pedido?.codigo && r[0].handle === "o12_faisca" && Object.keys(r[0]).length === 4);
await recusa("quem não é da mediação não decide", () => rpc(C("rosa"), "alumia_perfil_link_decidir", { p_link: insta, p_ok: true }), "sem_permissao");
await espera("a mediação confere", () => rpc(C("media"), "alumia_perfil_link_decidir", { p_link: insta, p_ok: true }), (r) => r.ok === true);
await espera("o link sai da fila, sem código, conferido pela mediação", async () => [await rpc(C("media"), "alumia_perfil_links_fila"), await rpc(C("faisca"), "alumia_perfil_secoes_minhas")],
  ([fila, eu]) => fila.length === 0 && eu.links[0].conferido === "mediacao" && eu.links[0].codigo === null);
await espera("conferência por rel=me que falha não tira a da mediação", async () => {
  await rpc(C("faisca"), "alumia_perfil_link_conferir", { p_link: insta });
  await rpc(servico, "alumia_perfil_link_resultado", { p_usuario: P.faisca, p_link: insta, p_ok: false });
  return rpc(C("faisca"), "alumia_perfil_secoes_minhas");
}, (r) => r.links[0].conferido === "mediacao");

// ═══════════════════ 4. Status ═══════════════════
await zerar();
await recusa("status fora da lista", () => rpc(C("faisca"), "rede_perfil_extras_editar", { p: { status: { tipo: "online", texto: "", horas: 8 } } }), "invalido:status");
await recusa("público do status fora da lista", () => rpc(C("faisca"), "rede_perfil_extras_editar", { p: { status: { tipo: "na_luta", texto: "", horas: 8, publico: "seguidores" } } }), "invalido:status");
await espera("\"na luta\" para todos", () => rpc(C("faisca"), "rede_perfil_extras_editar", { p: { status: { tipo: "na_luta", texto: "", horas: 8 } } }), (r) => r.status.tipo === "na_luta" && r.status.publico === "todos");
await espera("quem vê o perfil vê o status (sem saber para quem é)", () => rpc(C("rosa"), "rede_perfil_extras", { p_handle: "o12_faisca" }), (r) => r.status.tipo === "na_luta" && r.status.publico === null);
await espera("\"ausente\" só para a roda", () => rpc(C("faisca"), "rede_perfil_extras_editar", { p: { status: { tipo: "ausente", texto: "volto segunda", horas: 72, publico: "roda" } } }), (r) => r.status.tipo === "ausente" && r.status.publico === "roda");
await dono("insert into interno.rede_roda (dono, membro) values ($1, $2)", [P.faisca, P.lia]);
await espera("fora da roda, o status não aparece (e o resto do perfil sim)", () => rpc(C("rosa"), "rede_perfil_extras", { p_handle: "o12_faisca" }), (r) => r.status === null && Array.isArray(r.campos));
await espera("na roda, aparece", () => rpc(C("lia"), "rede_perfil_extras", { p_handle: "o12_faisca" }), (r) => r.status?.tipo === "ausente" && r.status.texto === "volto segunda");
await espera("tirar o status volta o público para todos", async () => {
  await rpc(C("faisca"), "rede_perfil_extras_editar", { p: { status: null } });
  return (await dono("select rede_status_publico as p, rede_status_tipo as t from interno.perfis where id = $1", [P.faisca])).rows[0];
}, (r) => r.p === "todos" && r.t === null);

// ═══════════════════ 5. Voluntariado ═══════════════════
await zerar();
await recusa("frente fora da lista (política não entra)", () => rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { frente: "revolucionarios", de: 2023 } }), "invalido:frente");
await recusa("antes de 2015", () => rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { frente: "traducao", de: 2010 } }), "invalido:periodo");
await recusa("fim antes do começo", () => rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { frente: "traducao", de: 2024, ate: 2022 } }), "invalido:periodo");
await recusa("data com dia não serve", () => rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { frente: "traducao", de: "2024-03-01" } }), "invalido:periodo");
const v1 = await espera("pôr uma linha: nasce esperando", () => rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { frente: "traducao", de: 2024, ate: null } }), (r) => r.voluntariado.length === 1 && r.voluntariado[0].situacao === "esperando");
await espera("e outra", () => rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { frente: "educacao", de: 2022, ate: 2023 } }), (r) => r.voluntariado.length === 2);
await recusa("a mesma frente e ano não repete", () => rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { frente: "traducao", de: 2024 } }), "repetido");
await espera("com a seção ligada, a linha que espera NÃO aparece", async () => {
  await rpc(C("faisca"), "alumia_perfil_secoes_salvar", { p: { secoes: ["voluntariado"] } });
  return rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" });
}, (r) => r.voluntariado.length === 0);
await recusa("a mediação não usa o painel", () => rpc(C("media"), "alumia_painel_voluntariado_fila"), "sem_permissao");
await recusa("conta comum não usa o painel", () => rpc(C("rosa"), "alumia_painel_voluntariado_fila"), "sem_permissao");
const fila = await espera("a coordenação vê a fila (codinome, frente e anos)", () => rpc(C("coord"), "alumia_painel_voluntariado_fila"), (r) => r.length === 2 && r.every((x) => /Codinome faisca/.test(x.quem) && Object.keys(x).sort().join() === "ate,de,frente,id,quem"));
const traducao = fila?.find((x) => x.frente === "traducao")?.id;
const educacao = fila?.find((x) => x.frente === "educacao")?.id;
await espera("a coordenação confirma", () => rpc(C("coord"), "alumia_painel_voluntariado_decidir", { p_id: traducao, p_confirmar: true, p_motivo: null }), (r) => r.ok === true);
await recusa("recusar pede motivo", () => rpc(C("coord"), "alumia_painel_voluntariado_decidir", { p_id: educacao, p_confirmar: false, p_motivo: "curto" }), "invalido:motivo");
await espera("recusar com motivo", () => rpc(C("coord"), "alumia_painel_voluntariado_decidir", { p_id: educacao, p_confirmar: false, p_motivo: "Não achamos a participação nessa frente." }), (r) => r.ok === true);
await espera("as decisões ficam no registro do painel", async () => (await dono("select acao from interno.alumia_painel_registro where alvo_tipo = 'voluntariado' order by id")).rows.map((r) => r.acao),
  (r) => r.join() === "voluntariado_confirmar,voluntariado_recusar");
await espera("só a confirmada aparece, em anos", () => rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" }), (r) => r.voluntariado.length === 1 && r.voluntariado[0].frente === "traducao" && r.voluntariado[0].de === 2024 && r.voluntariado[0].ate === null);
await espera("mudar a linha confirmada volta a esperar (e some do perfil)", async () => {
  await rpc(C("faisca"), "alumia_perfil_voluntariado_salvar", { p: { id: v1?.voluntariado[0].id, frente: "traducao", de: 2023, ate: null } });
  return rpc(C("rosa"), "alumia_perfil_secoes", { p_handle: "o12_faisca" });
}, (r) => r.voluntariado.length === 0);
await espera("ninguém decide a própria linha", async () => {
  await rpc(C("coord"), "alumia_perfil_voluntariado_salvar", { p: { frente: "curadoria", de: 2021 } });
  const f = await rpc(C("coord"), "alumia_painel_voluntariado_fila");
  const minha = f.find((x) => /Codinome coord/.test(x.quem));
  try {
    await rpc(C("coord"), "alumia_painel_voluntariado_decidir", { p_id: minha.id, p_confirmar: true, p_motivo: null });
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => /sem_permissao/.test(m));
await espera("apagar some na hora, também da fila", async () => {
  const eu = await rpc(C("faisca"), "alumia_perfil_secoes_minhas");
  for (const x of eu.voluntariado) await rpc(C("faisca"), "alumia_perfil_voluntariado_apagar", { p_id: x.id });
  return (await rpc(C("coord"), "alumia_painel_voluntariado_fila")).filter((x) => /Codinome faisca/.test(x.quem));
}, (r) => r.length === 0);

// ═══════════════════ 6. Pacotes ═══════════════════
await zerar();
await espera("a mediação cria um pacote", () => rpc(C("media"), "rede_desc_pacote_salvar", { p_slug: "comecar", p_titulo: "Para começar", p_descricao: "Gente que acolhe quem chega." }));
await recusa("quem não cuida não convida", () => rpc(C("rosa"), "rede_desc_pacote_pessoa", { p_slug: "comecar", p_handle: "o12_lia", p_sim: true }), "sem_permissao");
await recusa("perfil trancado nem é convidado", () => rpc(C("media"), "rede_desc_pacote_pessoa", { p_slug: "comecar", p_handle: "o12_tranca", p_sim: true }), "invalido:pessoa");
await espera("convidar não põe no pacote", async () => {
  await rpc(C("media"), "rede_desc_pacote_pessoa", { p_slug: "comecar", p_handle: "o12_lia", p_sim: true });
  await rpc(C("media"), "rede_desc_pacote_pessoa", { p_slug: "comecar", p_handle: "o12_rosa", p_sim: true });
  return rpc(C("faisca"), "rede_desc_pacote", { p_slug: "comecar" });
}, (r) => r.pessoas.length === 0);
await espera("a equipe vê só o número de convites, não quem", () => rpc(C("media"), "alumia_pacotes_cuidar"), (r) => {
  const k = r.find((x) => x.slug === "comecar");
  return k && k.convites === null && k.ha_convites === true && k.dentro.length === 0;
});
await espera("a pessoa vê o convite", () => rpc(C("lia"), "alumia_pacotes_meus"), (r) => r.convites.length === 1 && r.convites[0].slug === "comecar" && r.dentro.length === 0 && r.aparece === false);
await recusa("aceitar convite que não existe", () => rpc(C("fora"), "alumia_pacote_responder", { p_slug: "comecar", p_sim: true }), "nao_encontrado");
await espera("aceitar põe no pacote e liga aparecer", () => rpc(C("lia"), "alumia_pacote_responder", { p_slug: "comecar", p_sim: true }), (r) => r.convites.length === 0 && r.dentro[0].slug === "comecar" && r.aparece === true);
await espera("recusar apaga o convite", () => rpc(C("rosa"), "alumia_pacote_responder", { p_slug: "comecar", p_sim: false }), (r) => r.convites.length === 0 && r.dentro.length === 0);
await espera("o pacote mostra só quem aceitou", () => rpc(C("faisca"), "rede_desc_pacote", { p_slug: "comecar" }), (r) => r.pessoas.length === 1 && r.pessoas[0].handle === "o12_lia");
await espera("perfil que trancou depois do convite não entra", async () => {
  await dono("insert into interno.alumia_pacote_convites (pacote, usuario) values ('comecar', $1)", [P.tranca]);
  try {
    await rpc(C("tranca"), "alumia_pacote_responder", { p_slug: "comecar", p_sim: true });
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => /perfil_fechado/.test(m));
await espera("sair do pacote some na hora", async () => {
  await rpc(C("lia"), "alumia_pacote_responder", { p_slug: "comecar", p_sim: false });
  return rpc(C("faisca"), "rede_desc_pacote", { p_slug: "comecar" });
}, (r) => r.pessoas.length === 0);
await espera("tirar do pacote apaga convite e entrada", async () => {
  await rpc(C("media"), "rede_desc_pacote_pessoa", { p_slug: "comecar", p_handle: "o12_lia", p_sim: true });
  await rpc(C("lia"), "alumia_pacote_responder", { p_slug: "comecar", p_sim: true });
  await rpc(C("media"), "rede_desc_pacote_pessoa", { p_slug: "comecar", p_handle: "o12_lia", p_sim: false });
  return rpc(C("lia"), "alumia_pacotes_meus");
}, (r) => r.convites.length === 0 && r.dentro.length === 0);

// ═══════════════════ Fim ═══════════════════
if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(" ✗", f);
  process.exit(1);
}
console.log(`perfil da onda 12: ${certos} conferências, todas certas.`);
