// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a tag de revolucionária(o) e a frente de atuação no perfil da Alumia (P5, B3 e B5; supabase/migracoes/20261126-p5-escola.sql),
// num Postgres de verdade dentro do Node, com o install.sql deste ramo:
//  - padrão desligada; só liga com o público das conquistas escolhido; aparece para esse público, antes dos outros selos;
//  - só quem está na Frente (departamento Revolucionários) tem a tag; sair da Frente tira na hora; voltar o público para
//    "ninguém" desliga a tag; o "Mostrar meus selos" da Alumia esconde junto;
//  - privacidade: nenhuma função devolve lista de quem tem a tag ou de quem está numa frente; nada de nome civil; conta comum e
//    anon não chamam nada; as funções internas não são chamáveis de fora.
// Uso: npm run testar:escola-tag
import fs from "node:fs";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";
import { lerSeloDaEscola, selosDaEscola } from "../lib/escola/conquistas.ts";
import { FUNCOES_DA_ESCOLA, MIGRACOES_DA_ESCOLA } from "../lib/escola/contratos.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const semCR = (t) => t.replace(/\r\n/g, "\n");
let certos = 0;
const falhas = [];
const confere = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !(await conferir(valor))) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
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

// ───────────────────────────── 0. A migração está no lugar ─────────────────────────────
const MIGRACAO = ler("supabase", "migracoes", "20261126-p5-escola.sql");
confere("contrato: a migração do P5 é a da tabela", MIGRACOES_DA_ESCOLA.P5 === "20261126-p5-escola.sql");
confere("contrato: as duas funções do P5", FUNCOES_DA_ESCOLA.escola_tag_definir === "P5" && FUNCOES_DA_ESCOLA.escola_tag_minha === "P5");
confere("a migração está colada inteira no install.sql", semCR(ler("supabase", "install.sql")).includes(semCR(MIGRACAO).trim()));
confere("a migração diz que roda depois do r3-fim (versão 16)", /Roda depois de 20261125-r3-fim\.sql \(banco na versão 16\)/.test(MIGRACAO));
confere("a migração não mexe na versão nem na lista da porta", !/rede_alumia_versao\s*\(|alumia_porta_aberta\s*\(/.test(MIGRACAO.replace(/^--.*$/gm, "")));
confere("a migração não grava nome civil", !/perfis\.nome|f\.nome\b|p\.nome\b/.test(MIGRACAO));

// ───────────────────────────── 1. O banco ─────────────────────────────
const banco = await criarBanco();
const { rpc, dono, criarUsuario, pg, exclusivo } = banco;
await espera("a migração roda de novo sem quebrar (acrescentável)", () => exclusivo(() => pg.exec(MIGRACAO)));

const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.90" });
const anon = { papel: "anon", ip: "203.0.113.91" };
const ids = {};
for (const chave of ["coord", "dona", "outra", "comum"]) {
  ids[chave] = await criarUsuario(`${chave}@tag.local`, `Nome Civil ${chave}`);
  await rpc(como(ids[chave]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [ids[chave], `Codinome ${chave}`, chave]);
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.coord]);
const entrar = (u) => dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [u, ids.coord]);
await entrar(ids.dona);
await entrar(ids.outra);
// A linha da militância nasce na primeira visita à Escola (escola_eu).
await rpc(como(ids.dona), "escola_eu").catch(() => null);
await rpc(como(ids.outra), "escola_eu").catch(() => null);

const selosVistos = async (quem, handle = "dona") => ((await rpc(como(quem), "rede_perfil_de", { p_handle: handle })).selos ?? []).filter((s) => s.startsWith("escola:"));

await espera("a tag nasce desligada", () => rpc(como(ids.dona), "escola_tag_minha"), (r) => r.mostrar === false && r.publico === "ninguem" && r.na_frente === true && r.frente === null);
await recusa("com o público 'ninguem', não liga (a tela de consentimento vem antes)", () => rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: true }), "invalido:publico");
await recusa("mostrar nulo", () => rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: null }), "invalido:mostrar");

await rpc(como(ids.dona), "escola_publico_definir", { p: "todos" });
await espera("com o público escolhido e a tag desligada, ninguém vê a tag", () => selosVistos(ids.comum), (s) => !s.includes("escola:revolucionario") && s.includes("escola:carteirinha"));
await espera("ligar a tag", () => rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: true }), (r) => r.ok === true);
await espera("a tag aparece antes dos outros selos, para o público escolhido", () => selosVistos(ids.comum), (s) => s[0] === "escola:revolucionario" && s.includes("escola:carteirinha"));
await espera("sem frente escolhida, não há selo de frente", () => selosVistos(ids.comum), (s) => !s.some((x) => x.startsWith("escola:frente-")));
await rpc(como(ids.dona), "escola_frente_escolher", { p_frente: "cultura" });
await espera("com a frente escolhida, a frente aparece logo depois da tag (B5: a frente na Alumia)", () => selosVistos(ids.comum), (s) => JSON.stringify(s.slice(0, 3)) === JSON.stringify(["escola:revolucionario", "escola:frente-cultura", "escola:carteirinha"]));
await espera("o estado da tag", () => rpc(como(ids.dona), "escola_tag_minha"), (r) => r.mostrar === true && r.publico === "todos" && r.frente === "cultura");

await rpc(como(ids.dona), "escola_publico_definir", { p: "militantes" });
await espera("público 'militantes': a conta comum não vê a tag", () => selosVistos(ids.comum), (s) => s.length === 0);
await espera("público 'militantes': a outra militante vê", () => selosVistos(ids.outra), (s) => s.includes("escola:revolucionario") && s.includes("escola:frente-cultura"));

await dono("update interno.perfis set rede_selos_mostrar = false where id = $1", [ids.dona]);
await espera("'Mostrar meus selos' desligado na Alumia: a tag some junto", () => selosVistos(ids.outra), (s) => s.length === 0);
await dono("update interno.perfis set rede_selos_mostrar = true where id = $1", [ids.dona]);

await espera("desligar a tag: some na hora, e a frente junto", async () => {
  await rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: false });
  return selosVistos(ids.outra);
}, (s) => !s.includes("escola:revolucionario") && !s.some((x) => x.startsWith("escola:frente-")) && s.includes("escola:carteirinha"));

await rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: true });
await espera("voltar o público para 'ninguem' desliga a tag (o banco, não só a tela)", async () => {
  await rpc(como(ids.dona), "escola_publico_definir", { p: "ninguem" });
  await rpc(como(ids.dona), "escola_publico_definir", { p: "todos" });
  return { tag: (await rpc(como(ids.dona), "escola_tag_minha")).mostrar, vistos: await selosVistos(ids.comum) };
}, (r) => r.tag === false && !r.vistos.includes("escola:revolucionario"));

await rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: true });
await espera("sair da Frente tira a tag na hora", async () => {
  await dono("delete from interno.departamento_membros where departamento = 'revolucionarios' and usuario = $1", [ids.dona]);
  return { vistos: await selosVistos(ids.comum), tag: (await dono("select escola_tag from interno.perfis where id = $1", [ids.dona])).rows[0].escola_tag };
}, (r) => r.vistos.length === 0 && r.tag === false);
await entrar(ids.dona);
await espera("voltar à Frente recomeça escondido (sem tag e sem público)", () => selosVistos(ids.comum), (s) => s.length === 0);

await espera("a dona vê a própria tag mesmo com o público ligado só para militantes", async () => {
  await rpc(como(ids.dona), "escola_publico_definir", { p: "militantes" });
  await rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: true });
  return selosVistos(ids.dona);
}, (s) => s[0] === "escola:revolucionario");

// O modo só leitura de emergência (P5, interno.alumia_so_leitura_perfil): ligar a tag é trocar o que os outros veem e fica barrado;
// desligar (tirar) continua, como pôr vazio nas outras colunas. A tag é booleana: "false" não é trocar, é tirar.
await espera("a coordenação liga o modo só leitura", () => rpc(como(ids.coord), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), (r) => r.ok && r.ligado);
await espera("só leitura: desligar a própria tag continua", () => rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: false }), (r) => r.ok === true);
await espera("só leitura: voltar o público para 'ninguem' (que desliga a tag) continua", async () => {
  await dono("update interno.perfis set escola_tag = true where id = $1", [ids.dona]);
  await rpc(como(ids.dona), "escola_publico_definir", { p: "ninguem" });
  return (await dono("select escola_tag from interno.perfis where id = $1", [ids.dona])).rows[0].escola_tag;
}, (tag) => tag === false);
await rpc(como(ids.dona), "escola_publico_definir", { p: "militantes" });
await recusa("só leitura: ligar a tag fica barrado", () => rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: true }), "alumia_so_leitura");
await espera("a coordenação desliga o modo", () => rpc(como(ids.coord), "alumia_modo_so_leitura", { p_ligar: false, p_motivo: "O teste da tag acabou, a rede volta ao normal." }), (r) => r.ok && r.ligado === false);
await espera("desligado o modo, ligar a tag volta a passar", () => rpc(como(ids.dona), "escola_tag_definir", { p_mostrar: true }), (r) => r.ok === true);

// Quem não pode.
await recusa("conta comum não liga tag", () => rpc(como(ids.comum), "escola_tag_definir", { p_mostrar: true }), "sem_permissao");
await recusa("conta comum não lê o estado", () => rpc(como(ids.comum), "escola_tag_minha"), "sem_permissao");
await recusa("coordenação fora da Frente não tem tag", () => rpc(como(ids.coord), "escola_tag_minha"), "sem_permissao");
for (const [f, a] of [["escola_tag_definir", { p_mostrar: true }], ["escola_tag_minha", {}]]) await recusa(`anon não chama ${f}`, () => rpc(anon, f, a), "permission denied");
await recusa("authenticated não chama o gatilho nem o filtro direto", () => exclusivo(async () => {
  await pg.exec("set role authenticated");
  try {
    return (await pg.query("select interno.escola_conquistas_visiveis(null::uuid, null::uuid)")).rows;
  } finally {
    await pg.exec("reset role");
  }
}), "permission denied");

// Privacidade: a tag nunca vira lista nem número.
// A trava do modo só leitura (P5, auditoria) também lê a coluna: só compara a linha nova com a velha da mesma pessoa, num gatilho, e
// não devolve nada (nem lista, nem número).
await espera("só o filtro do perfil, as funções da tag e a trava do modo só leitura leem a coluna escola_tag", () => dono("select array_agg(p.proname order by p.proname) n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname in ('public', 'interno') and p.prosrc ~ 'escola_tag\\M'"), (r) =>
  JSON.stringify(r.rows[0].n) === JSON.stringify(["alumia_so_leitura_perfil", "escola_conquistas_visiveis", "escola_tag_ao_esconder", "escola_tag_definir", "escola_tag_minha"]));
await espera("a trava do modo só leitura é só gatilho (não se chama de fora e não devolve linha)", () => dono("select p.prorettype::regtype::text t, has_function_privilege('authenticated', p.oid, 'execute') a, has_function_privilege('anon', p.oid, 'execute') v from pg_proc p where p.proname = 'alumia_so_leitura_perfil'"), (r) =>
  r.rows.length === 1 && r.rows[0].t === "trigger" && !r.rows[0].a && !r.rows[0].v);
await espera("o filtro dos selos da Escola só é chamado pelo selo de UM perfil", () => dono("select array_agg(p.proname order by p.proname) n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname in ('public', 'interno') and p.prosrc ~ 'escola_conquistas_visiveis\\(' and p.proname <> 'escola_conquistas_visiveis'"), (r) =>
  JSON.stringify(r.rows[0].n) === JSON.stringify(["rede3_perfil_selos"]));
await espera("os selos do perfil só saem no perfil de uma pessoa (rede_perfil_de e o próprio)", () => dono("select array_agg(distinct p.proname order by p.proname) n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname in ('public', 'interno') and p.prosrc ~ 'rede3_perfil_selos\\(' and p.proname <> 'rede3_perfil_selos'"), (r) =>
  (r.rows[0].n ?? []).every((n) => ["rede3_perfil_meu", "rede_perfil_de"].includes(n)));
await espera("nada de nome civil nas respostas", async () => JSON.stringify([await rpc(como(ids.dona), "escola_tag_minha"), await rpc(como(ids.outra), "rede_perfil_de", { p_handle: "dona" })]), (t) => !t.includes("Nome Civil"));
await espera("funções da tag: security definer e search_path fixo", () => dono("select proname, prosecdef, proconfig from pg_proc where proname in ('escola_tag_definir', 'escola_tag_minha', 'escola_tag_ao_esconder', 'escola_conquistas_visiveis')"), (r) =>
  r.rows.length === 4 && r.rows.every((x) => x.prosecdef && (x.proconfig ?? []).some((c) => c === "search_path=interno, pg_temp")));
await espera("escola_tag_minha não é 'stable' (o freio grava; na API, stable roda só de leitura)", () => dono("select provolatile v from pg_proc where proname = 'escola_tag_minha'"), (r) => r.rows[0].v === "v");

// ───────────────────────────── 2. A leitura no aparelho ─────────────────────────────
confere("lê a tag", JSON.stringify(lerSeloDaEscola("escola:revolucionario")) === JSON.stringify({ tipo: "revolucionario" }));
confere("lê a frente", JSON.stringify(lerSeloDaEscola("escola:frente-cultura")) === JSON.stringify({ tipo: "frente", frente: "cultura" }));
confere("frente que não existe é ignorada", lerSeloDaEscola("escola:frente-inventada") === null);
confere("os outros selos continuam", selosDaEscola(["escola:revolucionario", "escola:frente-atos", "escola:carteirinha", "escola:degrau-2", "escola:aulas-3", "trilha:x"]).length === 5);
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const p = JSON.parse(ler("i18n", "escola", "percurso", `${l}.json`));
  const r = JSON.parse(ler("i18n", "rede", "perfil", `${l}.json`)).perfil.selosEscola;
  confere(`textos da tag em ${l}`, Boolean(p.selos.revolucionario && p.selos.frente.includes("{nome}") && Object.keys(p.selos.frentes).length === 7 && p.alumia.tag?.ligar && r.revolucionario && Object.keys(r.frentes).length === 7));
}
const tela = ler("components", "escola", "percurso", "TagNaAlumia.tsx");
confere("a tela não guarda nada no aparelho", !/localStorage|sessionStorage|indexedDB/.test(tela));
confere("a tela só liga com o público escolhido", /disabled=\{ocupado \|\| publico === "ninguem"\}/.test(tela));

console.log(`escola-tag: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
