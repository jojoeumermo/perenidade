// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a sobra 4 da onda 13 (supabase/migracoes/20261121-alumia-int-resumo.sql) num Postgres de verdade (scripts/banco-local.mjs),
// com a migração rodada duas vezes sobre o install.sql:
//   · a escolha do resumo só oferece comunidade que pode dar título (a das disciplinas, aberta, fora das "fechado-*"), nunca a das
//     lutas, a fechada ou a "fechado-*", mesmo sendo da pessoa;
//   · o que já estava gravado e não pode dar título some da escolha devolvida;
//   · gravar comunidade que não pode dar título é recusado; desligar apaga a escolha;
//   · as duas funções continuam com a porta, sem parâmetro do tipo linha, e a tela diz quando não há nenhuma comunidade.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-int-resumo.mjs
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

// ═══════════════════ 0. O arquivo e a tela ═══════════════════
const sql = ler("supabase/migracoes/20261121-alumia-int-resumo.sql");
ok("não mexe na versão da Alumia e termina passando a porta", !/function public\.rede_alumia_versao/.test(sql) && /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("só redefine as duas funções do resumo, com search_path fixo", (sql.match(/create or replace function/g) ?? []).length === 2
  && (sql.match(/security definer set search_path = interno, pg_temp/g) ?? []).length === 2 && !/create table/i.test(sql));
ok("a mesma regra do RSS nas duas (disciplinas, aberta, fora das fechado-*)", (sql.match(/c\.tipo = 'aberta' and c\.categoria = 'disciplinas' and c\.slug not like 'fechado-%'/g) ?? []).length === 3);
const tela = ler("components/rede/pontes/AjustesDasPontes.tsx");
ok("a tela diz quando não há comunidade, em vez de lista vazia", /r\.opcoes\.length === 0 \? <p className="po-nota">\{t\.resumo\.semComunidades\}/.test(tela));
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(ler(`i18n/rede/pontes/${l}.json`));
  ok(`pontes/${l}: o aviso de nenhuma comunidade fala das disciplinas, e o Tor saiu das Pontes`, typeof t.resumo.semComunidades === "string" && t.resumo.semComunidades.length > 40 && !("tor" in t));
  const s = JSON.parse(ler(`i18n/rede/seguranca/${l}.json`));
  ok(`seguranca/${l}: o Tor está na Segurança da conta, com o link do documento`, ["titulo", "texto", "endereco", "semEndereco", "comoUsar", "comoFunciona"].every((k) => typeof s.tor?.[k] === "string" && s.tor[k]));
}
ok("o bloco do Tor não leva a documento de operação (o repositório é público)", !/ONION\.md|github\.com/.test(ler("components/rede/seguranca/EntrarPeloTor.tsx")));
ok("a Segurança da conta mostra o Tor e as Pontes não", /<EntrarPeloTor t=\{t\} \/>/.test(ler("components/rede/seguranca/TelaDaSeguranca.tsx")) && !/Tor/.test(tela.replace(/^\/\/.*$/gm, "")));

// ═══════════════════ 1. Banco e pessoa ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => r.abertas.length === 0);
await espera("as duas passam pela porta e não recebem parâmetro do tipo linha", async () =>
  (await dono(`select p.proname, p.prosrc, exists (select 1 from unnest(p.proargtypes) t join pg_type ty on ty.oid = t where ty.typtype = 'c') as linha
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('alumia_pontes_resumo_ver', 'alumia_pontes_resumo_salvar')`)).rows,
(rs) => rs.length === 2 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc) && !r.linha));
await espera("nenhuma das duas abre para o visitante", async () =>
  (await dono(`select bool_or(has_function_privilege('anon', p.oid, 'execute')) as a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname in ('alumia_pontes_resumo_ver', 'alumia_pontes_resumo_salvar')`)).rows[0].a,
(a) => a === false);

const m = await criarUsuario("m@int-resumo.local", "m");
await rpc(como(m), "eu");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("update interno.perfis set rede_codinome = 'Codinome 1', rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = 'm_resumo' where id = $1", [m]);
await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [m]);
await dono("update auth.users set created_at = now() - interval '60 days'");
for (const nome of ["rede-v2", "alumia-2"]) await dono("insert into interno.recursos_vivos (nome, ligado) values ($1, true) on conflict (nome) do update set ligado = true", [nome]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('historia-r', 'História R', 'disciplinas', 'aberta', 'internet'), ('quimica-r', 'Química R', 'disciplinas', 'aberta', 'membros'),
  ('lutas-r', 'Lutas R', 'lutas', 'aberta', 'membros'), ('fechada-r', 'Fechada R', 'lutas', 'fechada', 'membros'),
  ('fechado-r', 'Fechado R', 'disciplinas', 'aberta', 'membros'), ('restrita-r', 'Restrita R', 'disciplinas', 'restrita', 'membros') on conflict do nothing`);
await espera("sem comunidade que dê título, a escolha vem vazia", () => rpc(como(m), "alumia_pontes_resumo_ver"), (r) => r.ligado === false && r.opcoes.length === 0);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) select s, $1 from unnest(array['historia-r', 'quimica-r', 'lutas-r', 'fechada-r', 'fechado-r', 'restrita-r']) s", [m]);
await espera("a escolha só oferece as das disciplinas, abertas, fora das fechado-*", () => rpc(como(m), "alumia_pontes_resumo_ver"),
  (r) => r.opcoes.map((o) => o.slug).sort().join() === "historia-r,quimica-r");
for (const s of ["lutas-r", "fechada-r", "fechado-r", "restrita-r", "nao-existe"]) {
  await recusa(`gravar "${s}" é recusado`, () => rpc(como(m), "alumia_pontes_resumo_salvar", { p_ligado: true, p_comunidades: ["historia-r", s] }), "invalido:comunidades");
}
await espera("gravar as duas que dão título", () => rpc(como(m), "alumia_pontes_resumo_salvar", { p_ligado: true, p_comunidades: ["quimica-r", "historia-r", "quimica-r"] }),
  (r) => r.ligado === true && r.escolhidas.join() === "historia-r,quimica-r");
// O que ficou gravado antes da regra (uma comunidade das lutas) não volta na escolha nem na lista para escolher.
await dono("update interno.rede_pontes_resumo set comunidades = '{historia-r,lutas-r}' where usuario = $1", [m]);
await espera("o que estava gravado e não dá título some da escolha", () => rpc(como(m), "alumia_pontes_resumo_ver"),
  (r) => r.escolhidas.join() === "historia-r" && !r.opcoes.some((o) => o.slug === "lutas-r"));
await espera("desligar apaga a escolha", async () => {
  await rpc(como(m), "alumia_pontes_resumo_salvar", { p_ligado: false, p_comunidades: [] });
  return (await um("select count(*)::int as n from interno.rede_pontes_resumo where usuario = $1", [m])).n;
}, (n) => n === 0);

await banco.pg.close?.();
console.log(`
${certos} conferências certas.`);
if (falhas.length) {
  console.log(`
${falhas.length} FALHA(S):`);
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
console.log("Resumo só com comunidade que dá título: tudo certo.");
