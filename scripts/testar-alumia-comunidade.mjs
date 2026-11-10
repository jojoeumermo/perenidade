// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova "seguir a conversa" e "seguir #tema" da Alumia (supabase/migracoes/20261110-alumia-comunidade.sql) num Postgres de verdade
// dentro do Node: só membro segue; ninguém vê quem segue nem quantos; o aviso de resposta nova chega a quem segue, agrupado pela
// conversa, nunca para quem escreveu, nem com bloqueio, nem de resposta que a pessoa não vê; deixar de seguir apaga; #tema é
// normalizado (acento, #) e só a própria pessoa vê a lista; tabelas sem permissão direta; a migração roda duas vezes. Confere
// também que os textos novos da conversa existem nos 6 idiomas.
// Uso: node scripts/testar-alumia-comunidade.mjs
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

// ── Textos nos 6 idiomas (sem banco) ──
const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
const novas = ["seguir", "seguindo", "seguirRegra", "seguiu", "deixouDeSeguir", "citarTrecho", "citando", "tirarCitacao", "recolherRamo", "mostrarRamo"];
for (const l of idiomas) {
  const j = JSON.parse(fs.readFileSync(new URL(`../i18n/rede/conversa/alumia/${l}.json`, import.meta.url), "utf8"));
  const faltam = novas.filter((k) => typeof j.conversa?.[k] !== "string" || !j.conversa[k].trim());
  if (faltam.length) falhas.push(`textos ${l}: faltam ${faltam.join(", ")}`);
  else certos++;
  if (!j.conversa.citando.includes("{trecho}") || !j.conversa.recolherRamo.includes("{n}") || !j.conversa.mostrarRamo.includes("{n}")) falhas.push(`textos ${l}: marcador {trecho}/{n} sumiu`);
  else certos++;
}

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const sql = fs.readFileSync(new URL("../supabase/migracoes/20261110-alumia-comunidade.sql", import.meta.url), "utf8");
await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("instalar de novo não quebra (idempotente)", () => banco.exclusivo(() => banco.pg.exec(sql)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

const P = {};
const nomes = ["autora", "segue", "outra", "bloqueado", "fora", "fechada"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@seg.local`, `Nome Civil ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_seg`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "fora")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.autora, P.bloqueado]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet'),
  ('segredo', 'Segredo', 'lutas', 'fechada', 'comunidade') on conflict do nothing`);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('segredo', $1, 'membro'), ('segredo', $2, 'membro')", [P.autora, P.fechada]);

const postar = async (campos, autor, texto = "post do teste") => {
  const todos = { publico: "membros", ...campos };
  const colunas = Object.keys(todos);
  return (await um(`insert into interno.rede_posts (autor, texto, ${colunas.join(", ")}) values ($1, $2, ${colunas.map((_, i) => `$${i + 3}`).join(", ")}) returning id`, [autor, texto, ...Object.values(todos)])).id;
};
const avisosDe = async (quem, raiz) => (await um("select count(*)::int as n from interno.avisos where para = $1 and tipo = 'resposta' and post = $2", [quem, raiz])).n;
const semNomes = (v) => !/(@seg\.local|Nome Civil|"usuario"|"quem"|"pessoas"|"total")/.test(JSON.stringify(v));

// ── 1. Seguir a conversa ──
const raiz = await postar({ comunidade: "matematica", publico: "internet", tipo: "duvida", titulo: "Quanto fica com o app?", corpo: "Alguém já calculou?" }, P.autora, "Quanto fica com o app? #TarifaZero");
const resp1 = await postar({ comunidade: "matematica", publico: "internet", resposta_a: raiz }, P.outra, "Fiz a conta: 40%.");
const seguir = (quem, post, sim = true) => rpc(como(quem), "rede_alumia_seguir_conversa", { p_post: post, p_sim: sim });
const seguindo = (quem, post, tag = null) => rpc(quem, "rede_alumia_seguindo", { p_post: post, p_tag: tag });

await recusa("visitante não segue", () => rpc(visitante(), "rede_alumia_seguir_conversa", { p_post: raiz, p_sim: true }), "");
await recusa("sem consentimento da Rede não segue", () => seguir(P.fora, raiz), "consentimento");
await espera("membro segue pela resposta (vale a conversa inteira)", () => seguir(P.segue, resp1), (r) => r.seguindo === true);
await espera("seguir de novo não duplica", () => seguir(P.segue, raiz), (r) => r.seguindo === true);
await espera("guarda pela raiz, uma linha só", () => um("select count(*)::int as n, min(raiz::text) as r from interno.rede_alumia_seguir_conversa where usuario = $1", [P.segue]), (r) => r.n === 1 && r.r === raiz);
await espera("seguindo: sim para quem segue, pela resposta também", () => seguindo(como(P.segue), resp1), (r) => r.conversa === true && r.tag === null);
await espera("seguindo: não para quem não segue", () => seguindo(como(P.outra), raiz), (r) => r.conversa === false);
await espera("seguindo: visitante recebe nulo", () => seguindo(visitante(), raiz), (r) => r.conversa === null && r.tag === null);
await recusa("bloqueado pela autora não segue", () => seguir(P.bloqueado, raiz), "nao_encontrado");
const fechado = await postar({ comunidade: "segredo", publico: "comunidade" }, P.autora, "só da fechada");
await recusa("conversa da fechada não se segue de fora", () => seguir(P.segue, fechado), "nao_encontrado");
await espera("seguindo: post que não vê responde não (sem confirmar)", () => seguindo(como(P.segue), fechado), (r) => r.conversa === false);
await espera("nenhuma resposta diz quem segue ou quantos", async () => [await seguir(P.segue, raiz), await seguindo(como(P.segue), raiz)], semNomes);

// ── 2. O aviso agrupado ──
await postar({ comunidade: "matematica", publico: "internet", resposta_a: raiz }, P.outra, "Mais uma conta.");
await espera("resposta nova avisa quem segue, no grupo da raiz", () => avisosDe(P.segue, raiz), (n) => n === 1);
await postar({ comunidade: "matematica", publico: "internet", resposta_a: resp1 }, P.autora, "Me passa a planilha?");
await espera("outra resposta, mesmo grupo (rede3_aviso_grupos junta)", () => avisosDe(P.segue, raiz), (n) => n === 2);
await espera("o grupo vira uma linha só na leitura agrupada", () => um("select count(*)::int as n from interno.rede3_aviso_grupos($1) where tipo = 'resposta' and post = $2", [P.segue, raiz]), (r) => r.n === 1);
await postar({ comunidade: "matematica", publico: "internet", resposta_a: raiz }, P.segue, "Eu mesma respondi.");
await espera("a própria resposta não avisa quem escreveu", () => avisosDe(P.segue, raiz), (n) => n === 2);
await seguir(P.outra, raiz);
const antesOutra = await avisosDe(P.outra, raiz);
await postar({ comunidade: "matematica", publico: "internet", resposta_a: resp1 }, P.segue, "Respondendo à outra.");
await espera("quem recebeu a resposta direta não ganha aviso em dobro", () => avisosDe(P.outra, raiz), (n) => n === antesOutra);
const retida = await postar({ comunidade: "matematica", publico: "internet", resposta_a: raiz, retido: true }, P.outra, "retida");
await espera("resposta retida não avisa", () => avisosDe(P.segue, raiz), (n) => n === 2);
await dono("delete from interno.rede_posts where id = $1", [retida]);
await dono("insert into interno.rede_avisos_prefs (usuario, tipo, canal, ligado) values ($1, 'resposta', 'site', false) on conflict (usuario, tipo, canal) do update set ligado = false", [P.segue]);
await postar({ comunidade: "matematica", publico: "internet", resposta_a: raiz }, P.outra, "Com o aviso desligado.");
await espera("quem desligou o aviso de respostas não recebe", () => avisosDe(P.segue, raiz), (n) => n === 2);
await dono("delete from interno.rede_avisos_prefs where usuario = $1", [P.segue]);
await espera("deixar de seguir apaga a linha", () => seguir(P.segue, raiz, false), (r) => r.seguindo === false);
await espera("sem linha guardada depois de deixar", () => um("select count(*)::int as n from interno.rede_alumia_seguir_conversa where usuario = $1", [P.segue]), (r) => r.n === 0);
await postar({ comunidade: "matematica", publico: "internet", resposta_a: raiz }, P.outra, "Depois de deixar.");
await espera("depois de deixar de seguir, nada de aviso", () => avisosDe(P.segue, raiz), (n) => n === 2);

// ── 3. Seguir #tema ──
const seguirTag = (quem, tag, sim = true) => rpc(como(quem), "rede_alumia_seguir_tag", { p_tag: tag, p_sim: sim });
await espera("segue #tema com # e acento (vira a forma do banco)", () => seguirTag(P.segue, "#TarifaZéro"), (r) => r.seguindo === true);
await espera("guarda normalizado", () => um("select tag from interno.rede_alumia_seguir_tag where usuario = $1", [P.segue]), (r) => r.tag === "tarifazero");
await seguirTag(P.segue, "moradia");
await espera("a lista é só dela, em ordem", () => rpc(como(P.segue), "rede_alumia_tags_seguidas", {}), (r) => r.tags.join() === "moradia,tarifazero");
await espera("outra pessoa não vê a lista de ninguém", () => rpc(como(P.outra), "rede_alumia_tags_seguidas", {}), (r) => r.tags.length === 0);
await espera("visitante recebe lista vazia", () => rpc(visitante(), "rede_alumia_tags_seguidas", {}), (r) => r.tags.length === 0);
await espera("seguindo: o #tema", () => seguindo(como(P.segue), null, "TarifaZero"), (r) => r.tag === true && r.conversa === null);
await recusa("#tema inválido é recusado", () => seguirTag(P.segue, "#2026"), "invalido:tag");
await recusa("sem consentimento não segue #tema", () => seguirTag(P.fora, "moradia"), "consentimento");
await espera("deixar de seguir o #tema", () => seguirTag(P.segue, "moradia", false), (r) => r.seguindo === false);
await espera("a lista diminui", () => rpc(como(P.segue), "rede_alumia_tags_seguidas", {}), (r) => r.tags.join() === "tarifazero");

// ── 4. Conta apagada leva tudo (cascata) ──
await seguir(P.fechada, fechado);
await seguirTag(P.fechada, "segredo");
await dono("delete from interno.perfis where id = $1", [P.fechada]);
await espera("conta apagada: nada fica", () => um(`select (select count(*) from interno.rede_alumia_seguir_conversa where usuario = $1)::int
  + (select count(*) from interno.rede_alumia_seguir_tag where usuario = $1)::int as n`, [P.fechada]), (r) => r.n === 0);

// ── 5. Permissões ──
await espera("tabelas novas com RLS ligada", () => um("select bool_and(relrowsecurity) as ok from pg_class where oid in ('interno.rede_alumia_seguir_conversa'::regclass, 'interno.rede_alumia_seguir_tag'::regclass)"), (r) => r.ok === true);
await espera("tabelas novas sem permissão para anon/authenticated", () => um(`select count(*)::int as n from information_schema.role_table_grants
  where table_schema = 'interno' and table_name in ('rede_alumia_seguir_conversa', 'rede_alumia_seguir_tag') and grantee in ('anon', 'authenticated', 'PUBLIC')`), (r) => r.n === 0);
await espera("gatilho interno fechado", () => um("select has_function_privilege('authenticated', 'interno.rede_alumia_aviso_seguidores()', 'execute') as a"), (r) => r.a === false);
await espera("escrever só para quem entrou", () => um(`select has_function_privilege('anon', 'public.rede_alumia_seguir_conversa(uuid, boolean)', 'execute') as a,
  has_function_privilege('anon', 'public.rede_alumia_seguir_tag(text, boolean)', 'execute') as b`), (r) => r.a === false && r.b === false);
await espera("funções novas: security definer com search_path = interno, pg_temp", () => um(`select count(*)::int as n, bool_and(p.prosecdef) as def,
  bool_and(array_to_string(p.proconfig, ',') like '%search_path=interno, pg_temp%') as caminho
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('rede_alumia_seguir_conversa', 'rede_alumia_seguir_tag', 'rede_alumia_tags_seguidas', 'rede_alumia_seguindo')`), (r) => r.n === 4 && r.def && r.caminho);

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`Alumia comunidade (seguir conversa e #tema): ${certos} conferências certas.`);
