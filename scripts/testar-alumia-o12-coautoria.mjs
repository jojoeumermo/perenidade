// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 12C, "assinar junto e reagir" (supabase/migracoes/20261118-alumia-o12-coautoria.sql), num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · assinar junto: até 3, o nome só aparece depois do aceite, quem recusou ou saiu não volta, a coautora sai quando quiser,
//     a escolha "quem pode me mencionar" vale para o convite;
//   · "fonte?": ninguém vê quem pediu, o total só para a autora e a mediação e só a partir de 3, a autora responde com a fonte;
//   · marcar em foto: proibido em post de ato e de comunidade de luta, por qualquer caminho;
//   · notas ligadas ao Vale o Escrito: só caso não retirado, trocar zera os votos, retirado depois some;
//   · as contas da tela (lib/rede/tipos-conversa.ts) e os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o12-coautoria.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  COAUTORAS_NO_MAXIMO, fonteDoLinkOk, linhaDaCoautoria, textoDosPedidosDeFonte, valeDoEndereco,
} from "../lib/rede/tipos-conversa.ts";

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
const sql = ler("supabase/migracoes/20261118-alumia-o12-coautoria.sql");
const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
ok("toda função nova é security definer com search_path fixo", funcoes.length >= 18 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f)));
ok("nenhuma função recebe linha de tabela com valor padrão", !funcoes.some((f) => /\b\w+ interno\.[a-z_]+ default\b/i.test(f.split("returns")[0])));
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão direta", tabelas.length === 5
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("não mexe na versão da Alumia nem na federação, e termina passando a porta em tudo",
  !/function public\.rede_alumia_versao/.test(sql) && !/rede_fed_|fediverso/i.test(sql.replace(/^--.*$/gm, "")) && /interno\.alumia_trancar\(\)/.test(sql.slice(-500)));

// ═══════════════════ 0b. As contas da tela ═══════════════════
ok("até 3 coautoras", COAUTORAS_NO_MAXIMO === 3);
ok("o caso do Vale o Escrito sai do endereço colado ou do identificador", valeDoEndereco("https://institutolucia.org/pt/vale-o-escrito/caso/grilagem-no-para?x=1") === "grilagem-no-para"
  && valeDoEndereco("/es/vale-o-escrito/caso/abc-12") === "abc-12" && valeDoEndereco("abc-12") === "abc-12" && valeDoEndereco("  ABC-12 ") === "abc-12");
ok("o que não é caso do Vale o Escrito não passa", valeDoEndereco("https://outro.site/qualquer") === null && valeDoEndereco("") === null
  && valeDoEndereco("a") === null && valeDoEndereco("../../etc") === null && valeDoEndereco("javascript:alert(1)") === null);
ok("o link da fonte: só http(s), sem usuário no endereço", fonteDoLinkOk("https://www.gov.br/dados") && !fonteDoLinkOk("ftp://x.y/z") && !fonteDoLinkOk("https://a@b.c/d") && !fonteDoLinkOk("http://x"));
ok("a linha da coautoria junta os nomes no idioma", linhaDaCoautoria([{ handle: "a", codinome: "Ana" }, { handle: "b", codinome: "Bia" }], "pt") === "Ana e Bia"
  && linhaDaCoautoria([], "pt") === "");
ok("os pedidos de fonte: número só a partir de 3", textoDosPedidosDeFonte({ ha: true, total: null }, { poucos: "P", muitos: "{n} M" }) === "P"
  && textoDosPedidosDeFonte({ ha: true, total: 4 }, { poucos: "P", muitos: "{n} M" }) === "4 M" && textoDosPedidosDeFonte({ ha: true, total: 2 }, { poucos: "P", muitos: "{n} M" }) === "P"
  && textoDosPedidosDeFonte({ ha: false, total: null }, { poucos: "P", muitos: "{n} M" }) === null && textoDosPedidosDeFonte(null, { poucos: "P", muitos: "{n} M" }) === null);

// Os textos: as seis línguas com as mesmas chaves, listas e marcadores; nenhuma palavra proibida.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) formas(x, p ? `${p}.${k}` : k, out);
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/coautoria/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/coautoria/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`coautoria/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|university|universidad|universit|algoritm|algorithm|алгоритм|算法/i.test(ler(`i18n/rede/coautoria/${l}.json`))));
  ok("todo erro novo do banco tem texto", ["coautoria_fechada", "fonte_ja_dada", "marcar_luta", "marcar_ato", "marcar_fechado", "invalido:vale", "invalido:fonte", "invalido:muitas", "invalido:sem_imagem", "nao_encontrado", "sem_permissao"]
    .every((c) => typeof pt.erros[c] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "198.51.100.7" });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const zerar = () => dono("delete from interno.limites");

const P = {};
const NOMES = ["autora", "bia", "caio", "duda", "eva", "fabi", "gil", "mod", "fora"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o12.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Codinome ${nome}`, `o12_${nome}`]);
  if (nome === "fora") continue;
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '90 days'");
await dono("update interno.rede_niveis set dias = 2, participacoes = 0, posts = 0, sem_procedente = 0 where nivel = 1");
await dono("update interno.rede_niveis set dias = 30, participacoes = 0, posts = 0, sem_procedente = 0 where nivel = 2");
await dono("update interno.rede_niveis set dias = 9999 where nivel = 3");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('o12-moradia', 'Moradia do teste', 'lutas', 'aberta', 'membros'),
  ('o12-calculo', 'Cálculo do teste', 'disciplinas', 'aberta', 'membros') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('o12-moradia', $1, 'moderacao'), ('o12-moradia', $2, 'membro'), ('o12-calculo', $1, 'moderacao'), ('o12-calculo', $2, 'membro')`, [P.mod, P.autora]);

const inserir = (quem, texto, extra = {}) => banco.exclusivo(() => banco.pg.transaction(async (tx) => {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2" })]);
  return (await tx.query("insert into interno.rede_posts (autor, texto, comunidade, publico, resposta_a) values ($1, $2, $3, $4, $5) returning id",
    [P[quem], texto, extra.comunidade ?? null, extra.publico ?? "membros", extra.resposta_a ?? null])).rows[0].id;
}));
const comImagem = async (id, quem) => {
  await dono("insert into interno.rede_midia (post, caminho, tipo, alt, ordem) values ($1, $2, 'image/webp', 'Mesa da plenária', 0)", [id, `${P[quem]}/${crypto.randomUUID()}.webp`]);
  return id;
};

// Na trava desligada (o padrão do teste) rede2_membro vale para quem tem consentimento; a porta não barra.
await espera("a migração instala sobre o install.sql", () => exec(sql));
// Uma marcação já gravada num post de comunidade de luta, antes da regra rodar de novo: tem de sair na segunda volta.
const fotoLutaAntiga = await comImagem(await inserir("autora", "Foto antiga da ocupação.", { comunidade: "o12-moradia" }), "autora");
await dono("alter table interno.rede_o9_marcacoes disable trigger rede_marcacao_confere");
await dono("insert into interno.rede_o9_marcacoes (post, marcado, estado) values ($1, $2, 'aprovada')", [fotoLutaAntiga, P.bia]);
await dono("alter table interno.rede_o9_marcacoes enable trigger rede_marcacao_confere");
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a marcação antiga em post de comunidade de luta saiu", () => um("select count(*)::int as n from interno.rede_o9_marcacoes where post = $1", [fotoLutaAntiga]), (r) => r.n === 0);
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => r.abertas.length === 0);
const PUBLICAS = ["rede_coautoria_convidar", "rede_coautoria_decidir", "rede_coautoria_sair", "rede_coautoria_tirar", "rede_coautoria_convites",
  "rede_fonte_pedir", "rede_fonte_dar", "rede_fonte_tirar", "rede_coautoria_cartoes", "rede_nota_vale_ligar", "rede_notas_vale"];
await espera("toda função pública nova passa pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)", [PUBLICAS])).rows,
(rs) => rs.length === PUBLICAS.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada, nenhuma política e nenhuma permissão direta`, async () => um(`select c.relrowsecurity as r,
      (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n,
      (select count(*)::int from information_schema.role_table_grants g where g.table_schema = 'interno' and g.table_name = $2 and g.grantee in ('anon', 'authenticated', 'PUBLIC')) as g
    from pg_class c where c.oid = $1::regclass`, [`interno.${t}`, t]), (r) => r.r === true && r.n === 0 && r.g === 0);
}
await espera("escrever não abre para visitante (só ler o cartão e as checagens das notas)", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) and has_function_privilege('anon', p.oid, 'execute')`, [PUBLICAS])).rows.map((r) => r.proname).sort(),
(r) => JSON.stringify(r) === JSON.stringify(["rede_coautoria_cartoes", "rede_notas_vale"]));
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno'
                 and p.proname in ('rede_coautoria_viva', 'rede_coautoria_post', 'rede_post_de_luta', 'rede_marcar_cabe', 'rede_vale_citavel', 'rede_media_do_post', 'rede_marcacao_confere')`)).rows,
(rs) => rs.length === 7 && rs.every((r) => !r.a && !r.b));

const cartao = async (quem, id) => (await rpc(quem ? como(P[quem]) : visitante, "rede_coautoria_cartoes", { p_ids: [id] }))[id];
const semIds = (r) => !NOMES.some((n) => JSON.stringify(r).includes(P[n]));

// ═══════════════════ 2. Assinar junto ═══════════════════
await zerar();
const post = await inserir("autora", "Carta aberta sobre a tarifa do ônibus.", { comunidade: "o12-calculo", publico: "internet" });
const resposta = await inserir("bia", "Concordo com a carta.", { resposta_a: post });
const convidar = (quem, id, handle) => rpc(como(P[quem]), "rede_coautoria_convidar", { p_post: id, p_handle: handle });
// Com "alumia-coautoria" desligado (o começo de tudo), o banco não grava nem avisa nada, e o cartão não traz nada.
const avisosAntes = (await um("select count(*)::int as n from interno.avisos")).n;
await recusa("desligado: ninguém convida", () => convidar("autora", post, "o12_bia"), "desligado");
await recusa("desligado: ninguém pede a fonte", () => rpc(como(P.bia), "rede_fonte_pedir", { p_post: post, p_sim: true }), "desligado");
await recusa("desligado: a autora não põe fonte", () => rpc(como(P.autora), "rede_fonte_dar", { p_post: post, p_link: "https://exemplo.org/fonte-da-carta", p_vale: null }), "desligado");
await espera("desligado: o cartão, os convites e as checagens das notas vêm vazios", async () => [
  await rpc(como(P.bia), "rede_coautoria_cartoes", { p_ids: [post] }), await rpc(como(P.bia), "rede_coautoria_convites"), await rpc(visitante, "rede_notas_vale", { p_post: post }),
], ([c, l, n]) => JSON.stringify(c) === "{}" && JSON.stringify(l) === "[]" && JSON.stringify(n) === "{}");
await espera("desligado: nada foi gravado nem avisado", async () => [(await um("select count(*)::int as n from interno.rede_coautorias")).n, (await um("select count(*)::int as n from interno.avisos")).n - avisosAntes],
  ([c, a]) => c === 0 && a === 0);
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-coautoria', true) on conflict (nome) do update set ligado = true");
await recusa("só a autora convida", () => convidar("bia", post, "o12_caio"), "sem_permissao");
await recusa("não em resposta", () => convidar("bia", resposta, "o12_caio"), "invalido:resposta");
await recusa("não a si mesma", () => convidar("autora", post, "@o12_autora"), "invalido:propria");
await recusa("@ que não existe", () => convidar("autora", post, "ninguem_aqui"), "nao_encontrado");
// Quem não pode receber o convite não recebe, mas a autora ouve o mesmo "convite feito" (não fica sabendo da escolha da pessoa).
const semConvite = async (handle) => (await um("select count(*)::int as n from interno.rede_coautorias k join interno.perfis f on f.id = k.coautora where k.post = $1 and f.rede_handle = $2", [post, handle])).n === 0;
await espera("quem não entrou na Alumia não é convidada (e a resposta não conta)", async () => [await convidar("autora", post, "o12_fora"), await semConvite("o12_fora")], ([r, s]) => r.estado === "convite" && s);
await recusa("visitante não convida", () => rpc(visitante, "rede_coautoria_convidar", { p_post: post, p_handle: "o12_bia" }), "permission denied");
const avisosDe = async (quem) => (await um("select count(*)::int as n from interno.avisos where para = $1", [P[quem]])).n;
const avisosBia = await avisosDe("bia");
await espera("a autora convida a bia (com ou sem @)", () => convidar("autora", post, "@o12_bia"), (r) => r.estado === "convite");
await espera("a bia recebe o aviso do convite", async () => (await avisosDe("bia")) - avisosBia, (n) => n === 1);
await espera("antes do aceite, o nome não aparece para ninguém (nem para a própria bia, como coautora)", async () => [await cartao("caio", post), await cartao(null, post), await cartao("bia", post)],
  ([c, v, b]) => c.coautores.length === 0 && v.coautores.length === 0 && b.coautores.length === 0 && b.meu_convite === "convite" && c.convites === null && v.convites === null);
await espera("a autora vê o convite que ela fez", () => cartao("autora", post), (c) => c.convites.length === 1 && c.convites[0].handle === "o12_bia" && c.pode_convidar === true && semIds(c));
await espera("a bia vê o convite na lista dela", () => rpc(como(P.bia), "rede_coautoria_convites"), (l) => l.length === 1 && l[0].post === post && l[0].handle === "o12_autora" && semIds(l));
await espera("convidar de novo não duplica", () => convidar("autora", post, "o12_bia"), (r) => r.estado === "feita");
await rpc(como(P.duda), "rede_o9_preferir", { p: { mencao_quem: "ninguem" } });
await espera("quem escolheu 'ninguém me menciona' não é convidada (e a resposta não conta)", async () => [await convidar("autora", post, "o12_duda"), await semConvite("o12_duda"), await avisosDe("duda")],
  ([r, s, n]) => r.estado === "convite" && s && n === 0);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.eva, P.autora]);
await espera("bloqueio: não convida (e a resposta não conta)", async () => [await convidar("autora", post, "o12_eva"), await semConvite("o12_eva"), await avisosDe("eva")],
  ([r, s, n]) => r.estado === "convite" && s && n === 0);
await espera("convida a caio e a fabi (três no total)", async () => [await convidar("autora", post, "o12_caio"), await convidar("autora", post, "o12_fabi")], (r) => r.every((x) => x.estado === "convite"));
await recusa("a quarta não entra (até 3)", () => convidar("autora", post, "o12_gil"), "invalido:muitas");
await espera("com 3, a autora não pode convidar mais", () => cartao("autora", post), (c) => c.pode_convidar === false && c.convites.length === 3);
const avisosAutora = await avisosDe("autora");
await espera("a bia aceita", () => rpc(como(P.bia), "rede_coautoria_decidir", { p_post: post, p_aceitar: true }), (r) => r.estado === "aceita");
await espera("a autora é avisada do aceite", async () => (await avisosDe("autora")) - avisosAutora, (n) => n === 1);
await espera("depois do aceite, o nome aparece para todo mundo que vê o post", async () => [await cartao("gil", post), await cartao(null, post)],
  ([g, v]) => g.coautores.length === 1 && g.coautores[0].codinome === "Codinome bia" && g.coautores[0].handle === "o12_bia" && v.coautores.length === 1 && semIds(g));
const avisosAutora2 = await avisosDe("autora");
await espera("o caio recusa, sem aviso a ninguém", async () => [await rpc(como(P.caio), "rede_coautoria_decidir", { p_post: post, p_aceitar: false }), (await avisosDe("autora")) - avisosAutora2],
  ([r, n]) => r.estado === "recusada" && n === 0);
await espera("quem recusou some do cartão e da lista da autora", () => cartao("autora", post), (c) => c.convites.length === 1 && c.convites[0].handle === "o12_fabi" && c.coautores.length === 1);
await espera("e não é convidado de novo (a resposta não diz por quê)", () => convidar("autora", post, "o12_caio"), (r) => r.estado === "feita");
await recusa("o caio não decide de novo", () => rpc(como(P.caio), "rede_coautoria_decidir", { p_post: post, p_aceitar: true }), "nao_encontrado");
await espera("o convite vencido (7 dias) some e não pode ser aceito", async () => {
  await dono("update interno.rede_coautorias set convidada_em = now() - interval '8 days' where post = $1 and coautora = $2", [post, P.fabi]);
  return { c: await cartao("fabi", post), a: await cartao("autora", post), l: await rpc(como(P.fabi), "rede_coautoria_convites") };
}, ({ c, a, l }) => c.meu_convite === null && a.convites.length === 0 && l.length === 0);
await recusa("aceitar convite vencido", () => rpc(como(P.fabi), "rede_coautoria_decidir", { p_post: post, p_aceitar: true }), "nao_encontrado");
await espera("o convite vencido não é refeito: a mesma resposta de quem recusou", () => convidar("autora", post, "o12_fabi"), (r) => r.estado === "feita");
await espera("tirar o convite vencido não abre caminho para convidar de novo", async () => {
  await rpc(como(P.autora), "rede_coautoria_tirar", { p_post: post, p_handle: "o12_fabi" });
  return [await convidar("autora", post, "o12_fabi"), await cartao("fabi", post)];
}, ([r, c]) => r.estado === "feita" && c.meu_convite === null);
await espera("a autora tira um convite vivo", async () => {
  await convidar("autora", post, "o12_gil");
  await rpc(como(P.autora), "rede_coautoria_tirar", { p_post: post, p_handle: "o12_gil" });
  return cartao("gil", post);
}, (c) => c.meu_convite === null);
await espera("a bia sai quando quiser, sem aviso", async () => {
  const antes = await avisosDe("autora");
  const r = await rpc(como(P.bia), "rede_coautoria_sair", { p_post: post });
  return { r, n: (await avisosDe("autora")) - antes, c: await cartao("gil", post) };
}, ({ r, n, c }) => r.estado === "saiu" && n === 0 && c.coautores.length === 0);
await espera("e não é convidada de novo", () => convidar("autora", post, "o12_bia"), (r) => r.estado === "feita");
await recusa("sair de novo", () => rpc(como(P.bia), "rede_coautoria_sair", { p_post: post }), "nao_encontrado");
await espera("a tabela não guarda quem convidou (é sempre a autora do post)", () => dono("select * from interno.rede_coautorias limit 1"), (r) => Object.keys(r.rows[0]).sort().join() === "coautora,convidada_em,decidida_em,estado,post");

// ═══════════════════ 3. "Fonte?" ═══════════════════
await zerar();
const afirmacao = await inserir("autora", "A tarifa subiu 40% em dois anos.", { comunidade: "o12-calculo", publico: "internet" });
const pedir = (quem, sim = true) => rpc(como(P[quem]), "rede_fonte_pedir", { p_post: afirmacao, p_sim: sim });
await recusa("a autora não pede a fonte do próprio post", () => pedir("autora"), "invalido:propria");
await recusa("quem não entrou na Alumia não pede", () => pedir("fora"), "consentimento");
const avisosFonte = await avisosDe("autora");
await espera("a bia pede a fonte (volta só a dela, nunca o total)", () => pedir("bia"), (r) => r.minha === true && Object.keys(r).join() === "minha");
await espera("a autora é avisada uma vez, sem nome nem número", async () => {
  const n = (await avisosDe("autora")) - avisosFonte;
  const a = await um("select texto, ator from interno.avisos where para = $1 order by criado_em desc limit 1", [P.autora]);
  return { n, a };
}, ({ n, a }) => n === 1 && a.ator === null && !/bia|\d+ pessoa/i.test(a.texto));
await espera("o segundo pedido no mesmo dia não avisa de novo", async () => { await pedir("caio"); return (await avisosDe("autora")) - avisosFonte; }, (n) => n === 1);
await espera("com 2 pedidos, a autora vê que há pedido, sem número", () => cartao("autora", afirmacao), (c) => c.pedidos_fonte.ha === true && c.pedidos_fonte.total === null);
await espera("quem pediu vê só que pediu; os outros não veem pedido nenhum", async () => [await cartao("bia", afirmacao), await cartao("gil", afirmacao), await cartao(null, afirmacao)],
  ([b, g, v]) => b.pedi_fonte === true && b.pedidos_fonte === null && g.pedi_fonte === false && g.pedidos_fonte === null && g.pode_pedir_fonte === true && v.pedidos_fonte === null && v.pode_pedir_fonte === false);
await espera("com 3 pedidos, o número aparece para a autora e para a mediação da comunidade", async () => {
  await pedir("gil");
  return [await cartao("autora", afirmacao), await cartao("mod", afirmacao)];
}, ([a, m]) => a.pedidos_fonte.total === 3 && m.pedidos_fonte.total === 3);
await espera("desfazer o pedido tira a pessoa da conta", async () => { await pedir("gil", false); return cartao("autora", afirmacao); }, (c) => c.pedidos_fonte.total === null && c.pedidos_fonte.ha);
await recusa("só a autora põe a fonte", () => rpc(como(P.bia), "rede_fonte_dar", { p_post: afirmacao, p_link: "https://www.gov.br/tarifa", p_vale: null }), "sem_permissao");
await recusa("fonte sem link nem checagem", () => rpc(como(P.autora), "rede_fonte_dar", { p_post: afirmacao, p_link: " ", p_vale: null }), "invalido:fonte");
await recusa("link que não é http(s)", () => rpc(como(P.autora), "rede_fonte_dar", { p_post: afirmacao, p_link: "javascript:alert(1)", p_vale: null }), "invalido:fonte");
await recusa("link com parâmetro de rastreio", () => rpc(como(P.autora), "rede_fonte_dar", { p_post: afirmacao, p_link: "https://www.gov.br/tarifa?utm_source=zap", p_vale: null }), "invalido:fonte");
await recusa("link com fbclid no meio", () => rpc(como(P.autora), "rede_fonte_dar", { p_post: afirmacao, p_link: "https://www.gov.br/tarifa?a=1&fbclid=abc", p_vale: null }), "invalido:fonte");
await recusa("checagem com forma errada", () => rpc(como(P.autora), "rede_fonte_dar", { p_post: afirmacao, p_link: null, p_vale: "../x" }), "invalido:vale");
const avisosBiaFonte = await avisosDe("bia");
await espera("a autora põe a fonte; os pedidos se apagam", async () => {
  const r = await rpc(como(P.autora), "rede_fonte_dar", { p_post: afirmacao, p_link: "https://www.gov.br/tarifa", p_vale: null });
  return { r, n: (await um("select count(*)::int as n from interno.rede_fonte_pedidos where post = $1", [afirmacao])).n };
}, ({ r, n }) => r.link === "https://www.gov.br/tarifa" && n === 0);
await espera("quem pediu é avisada que a fonte chegou", async () => (await avisosDe("bia")) - avisosBiaFonte, (n) => n === 1);
await espera("a fonte aparece para todo mundo que vê o post, e ninguém mais pede", async () => [await cartao("gil", afirmacao), await cartao(null, afirmacao)],
  ([g, v]) => g.fonte?.link === "https://www.gov.br/tarifa" && g.pode_pedir_fonte === false && v.fonte?.link === "https://www.gov.br/tarifa");
await recusa("com a fonte posta, pedir é recusado", () => pedir("eva"), "nao_encontrado"); // a eva bloqueou a autora
await recusa("com a fonte posta, pedir é recusado (sem bloqueio)", () => pedir("duda"), "fonte_ja_dada");
await espera("a autora tira a fonte e dá para pedir de novo", async () => { await rpc(como(P.autora), "rede_fonte_tirar", { p_post: afirmacao }); return pedir("duda"); }, (r) => r.minha);
await espera("a tabela de pedidos não sai por função nenhuma como lista", async () => {
  const todos = await Promise.all(["autora", "mod", "bia", "gil"].map((q) => cartao(q, afirmacao)));
  return todos;
}, (lista) => lista.every((c) => semIds(c) && !JSON.stringify(c).includes("o12_duda")));

// ═══════════════════ 4. Marcar em foto ═══════════════════
await zerar();
await rpc(como(P.gil), "rede_o9_preferir", { p: { marcar_quem: "todos" } });
const fotoComum = await comImagem(await inserir("autora", "Foto da roda de estudo.", { comunidade: "o12-calculo" }), "autora");
const fotoLuta = await comImagem(await inserir("autora", "Foto da ocupação.", { comunidade: "o12-moradia" }), "autora");
const fotoAto = await comImagem(await inserir("autora", "Foto do ato de sexta."), "autora");
await dono("update interno.rede_posts set ato = $2 where id = $1", [fotoAto, post]);
const marcar = (id) => rpc(como(P.autora), "rede_o9_marcar", { p_post: id, p_handle: "o12_gil" });
await recusa("proibido em post de comunidade de luta", () => marcar(fotoLuta), "marcar_luta");
await recusa("proibido em post de ato", () => marcar(fotoAto), "marcar_ato");
await recusa("nem por fora da função (gatilho na tabela)", () => dono("insert into interno.rede_o9_marcacoes (post, marcado, estado) values ($1, $2, 'aprovada')", [fotoLuta, P.gil]), "marcar_luta");
await espera("o cartão diz à autora onde dá para marcar", async () => [await cartao("autora", fotoComum), await cartao("autora", fotoLuta), await cartao("autora", fotoAto), await cartao("gil", fotoComum)],
  ([c, l, a, g]) => c.marcar_pode === true && l.marcar_pode === false && a.marcar_pode === false && g.marcar_pode === false);
await espera("na comunidade de estudo, a marcação nasce esperando o aceite", () => marcar(fotoComum), (r) => r.estado === "pendente");
await espera("a autora vê a que espera; os outros não veem nada antes do aceite", async () => [await cartao("autora", fotoComum), await cartao("bia", fotoComum), await rpc(como(P.bia), "rede_o9_cartoes", { p_ids: [fotoComum] })],
  ([a, b, o9]) => a.marcacoes_esperando.length === 1 && b.marcacoes_esperando === null && o9[fotoComum].marcacoes.length === 0);
await espera("depois do aceite, aparece e sai da espera", async () => {
  await rpc(como(P.gil), "rede_o9_marcacao_decidir", { p_post: fotoComum, p_aceitar: true });
  return [await cartao("autora", fotoComum), await rpc(como(P.bia), "rede_o9_cartoes", { p_ids: [fotoComum] })];
}, ([a, o9]) => a.marcacoes_esperando.length === 0 && o9[fotoComum].marcacoes.length === 1);
await espera("quem foi marcado tira quando quiser", async () => {
  await rpc(como(P.gil), "rede_o9_desmarcar", { p_post: fotoComum, p_handle: "o12_gil" });
  return rpc(como(P.bia), "rede_o9_cartoes", { p_ids: [fotoComum] });
}, (o9) => o9[fotoComum].marcacoes.length === 0);

// ═══════════════════ 5. Notas ligadas ao Vale o Escrito ═══════════════════
await zerar();
await dono(`insert into interno.vale_entradas (id, dossie, situacao, confianca, doc) values
  ('caso-no-ar', 'conflitos-no-campo', 'reu', 'primaria', '{}'::jsonb),
  ('caso-retirado', 'conflitos-no-campo', 'reu', 'primaria', '{}'::jsonb) on conflict do nothing`);
await dono("update interno.vale_entradas set retirado_em = now() where id = 'caso-retirado'");
const alvoDaNota = await inserir("autora", "O fazendeiro foi condenado em última instância.", { comunidade: "o12-calculo", publico: "internet" });
const notaBia = (await rpc(como(P.bia), "rede_alumia_nota_propor", { p_post: alvoDaNota, p_texto: "Segundo a checagem, o caso ainda está em primeira instância.", p_fonte: "https://www.jus.br/processo" })).id;
const ligar = (quem, vale, nota = notaBia) => rpc(como(P[quem]), "rede_nota_vale_ligar", { p_nota: nota, p_vale: vale });
await recusa("só a autora da nota liga a checagem", () => ligar("caio", "caso-no-ar"), "nao_encontrado");
await recusa("caso retirado do ar não entra", () => ligar("bia", "caso-retirado"), "invalido:vale");
await recusa("forma errada não entra", () => ligar("bia", "https://fora.site/x"), "invalido:vale");
await espera("caso no ar entra (também o que está só nos arquivos do site)", async () => [await ligar("bia", "caso-no-ar"), await ligar("bia", "Caso-Dos-Arquivos")], ([a, b]) => a.vale === "caso-no-ar" && b.vale === "caso-dos-arquivos");
await espera("a proposta com a checagem: a autora da nota e quem avalia veem; visitante não", async () =>
  [await rpc(como(P.bia), "rede_notas_vale", { p_post: alvoDaNota }), await rpc(como(P.caio), "rede_notas_vale", { p_post: alvoDaNota }), await rpc(visitante, "rede_notas_vale", { p_post: alvoDaNota })],
([b, c, v]) => b[notaBia] === "caso-dos-arquivos" && c[notaBia] === "caso-dos-arquivos" && Object.keys(v).length === 0);
await espera("trocar a checagem zera os votos", async () => {
  await rpc(como(P.caio), "rede_alumia_nota_avaliar", { p_nota: notaBia, p_ajuda: true });
  const antes = (await um("select count(*)::int as n from interno.rede_alumia_nota_votos where nota = $1", [notaBia])).n;
  await ligar("bia", "caso-no-ar");
  return [antes, (await um("select count(*)::int as n from interno.rede_alumia_nota_votos where nota = $1", [notaBia])).n];
}, ([a, d]) => a === 1 && d === 0);
await espera("ligar a mesma checagem de novo não zera", async () => {
  await rpc(como(P.caio), "rede_alumia_nota_avaliar", { p_nota: notaBia, p_ajuda: true });
  await ligar("bia", "caso-no-ar");
  return (await um("select count(*)::int as n from interno.rede_alumia_nota_votos where nota = $1", [notaBia])).n;
}, (n) => n === 1);
await espera("nota que aparece: a checagem aparece para visitante também", async () => {
  await dono("update interno.rede_alumia_notas set situacao = 'mostrada' where id = $1", [notaBia]);
  return rpc(visitante, "rede_notas_vale", { p_post: alvoDaNota });
}, (r) => r[notaBia] === "caso-no-ar");
await espera("o caso retirado depois deixa de aparecer", async () => {
  await dono("update interno.vale_entradas set retirado_em = now() where id = 'caso-no-ar'");
  return rpc(como(P.caio), "rede_notas_vale", { p_post: alvoDaNota });
}, (r) => !(notaBia in r));
await espera("e a fonte do post com checagem retirada também perde a checagem", async () => {
  await dono("update interno.vale_entradas set retirado_em = null where id = 'caso-no-ar'");
  await rpc(como(P.autora), "rede_fonte_dar", { p_post: alvoDaNota, p_link: null, p_vale: "caso-no-ar" });
  const antes = (await cartao("gil", alvoDaNota)).fonte;
  await dono("update interno.vale_entradas set retirado_em = now() where id = 'caso-no-ar'");
  return [antes, (await cartao("gil", alvoDaNota)).fonte];
}, ([a, d]) => a.vale === "caso-no-ar" && d.vale === null);
await espera("desligar a checagem (vazio) tira a ligação", async () => { await ligar("bia", ""); return um("select count(*)::int as n from interno.rede_nota_vale where nota = $1", [notaBia]); }, (r) => r.n === 0);
await espera("apagar a nota leva a ligação junto", async () => {
  await ligar("bia", "caso-dos-arquivos");
  await dono("update interno.rede_alumia_notas set situacao = 'proposta' where id = $1", [notaBia]);
  await rpc(como(P.bia), "rede_alumia_nota_retirar", { p_nota: notaBia });
  return um("select count(*)::int as n from interno.rede_nota_vale", []);
}, (r) => r.n === 0);

// ═══════════════════ Fim ═══════════════════
await banco.pg.close?.();
if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Frente 12C (assinar junto e reagir): ${certos} conferências, todas certas.`);
