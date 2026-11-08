// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a F5 da Escola de Formação (PLANO-ESCOLA.md, seções 4.5 e 6): Meu percurso e as conquistas na Alumia.
//  1. O banco (install.sql + 20261108-escola-formacao-base.sql + 20261108-escola-conquistas.sql, num Postgres de verdade
//     dentro do Node): com 'ninguem', nem seguidor nem militante vê; 'militantes' só militante; 'seguidores' só seguidor
//     aceito; 'todos' todo mundo com conta; aula declarada só aparece como contagem; desligar apaga o declarado na hora;
//     sair do departamento apaga tudo e volta para 'ninguem'; quem não é militante não declara; anon não chama nada.
//  2. As contas puras (lib/escola/conquistas.ts): selos, o que declarar, caderneta, "para fechar o degrau".
//  3. Os textos nos 6 idiomas (mesmas chaves) e as chaves novas do selo em i18n/rede/perfil.
//  4. Segurança no código: tela de consentimento antes de ligar, nada da militância no aparelho, prévia só em desenvolvimento.
// Uso: npm run testar:escola-conquistas
import fs from "node:fs";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";
import {
  aDeclarar,
  alvoDoCaderno,
  barrasDosDegraus,
  contarCaderneta,
  eSeloDaEscola,
  faltaNoDegrau,
  lerSeloDaEscola,
  MAX_DECLARADAS,
  mesEAno,
  nomeDoArquivo,
  pedeConsentimento,
  selosDaEscola,
  selosPrevistos,
} from "../lib/escola/conquistas.ts";
import { FUNCOES_DA_ESCOLA, MIGRACOES_DA_ESCOLA } from "../lib/escola/contratos.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const lerSe = (...p) => (fs.existsSync(path.join(raiz, ...p)) ? ler(...p) : "");
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

// ───────────────────────────── 1. O banco ─────────────────────────────
const BASE = ler("supabase", "migracoes", MIGRACOES_DA_ESCOLA.F1);
const MIGRACAO = ler("supabase", "migracoes", MIGRACOES_DA_ESCOLA.F5);
const banco = await criarBanco();
const { rpc, dono, criarUsuario, pg, exclusivo } = banco;
await espera("a base da Escola (F1) instala", () => exclusivo(() => pg.exec(BASE)));
const instalar = () => exclusivo(() => pg.exec(MIGRACAO));
await espera("a migração da F5 instala sobre a F1", instalar);
await espera("a migração da F5 roda de novo sem quebrar (acrescentável)", instalar);

const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.80" });
const anon = { papel: "anon", ip: "203.0.113.81" };
const ids = {};
for (const chave of ["coord", "dona", "outra", "seguidor", "pendente", "comum", "bloqueada"]) {
  ids[chave] = await criarUsuario(`${chave}@conquistas.local`, `Nome Civil ${chave}`);
  await rpc(como(ids[chave]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [ids[chave], `Codinome ${chave}`, chave]);
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.coord]);
const entrar = (u) => dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [u, ids.coord]);
await entrar(ids.dona);
await entrar(ids.outra);
await dono("insert into interno.rede_seguindo (quem, segue, pendente) values ($1, $3, false), ($2, $3, true)", [ids.seguidor, ids.pendente, ids.dona]);

const selosVistos = async (quem) => ((await rpc(como(quem), "rede_perfil_de", { p_handle: "dona" })).selos ?? []).filter((s) => s.startsWith("escola:"));
const ninguemVe = async () => {
  for (const q of ["outra", "seguidor", "pendente", "comum"]) if ((await selosVistos(ids[q])).length) return false;
  return true;
};

await espera("público nasce 'ninguem' e escola_conquistas_minhas traz a carteirinha", () => rpc(como(ids.dona), "escola_conquistas_minhas"), (r) =>
  r.publico === "ninguem" && r.conquistas.length === 1 && r.conquistas[0].tipo === "carteirinha" && r.conquistas[0].verificada === true);
await espera("com 'ninguem': a dona vê o próprio selo", () => selosVistos(ids.dona), (s) => JSON.stringify(s) === JSON.stringify(["escola:carteirinha"]));
await espera("com 'ninguem': nem seguidor, nem militante, nem conta comum vê", ninguemVe, (x) => x);
await recusa("com 'ninguem': o aparelho não declara (sem público, não há para que guardar)", () => rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "aula", p_alvo: "analise-de-conjuntura/o-que-e-conjuntura", p_ligar: true }), "invalido:publico");

await espera("ligar para 'militantes' guarda quando", async () => {
  await rpc(como(ids.dona), "escola_publico_definir", { p: "militantes" });
  return (await dono("select escola_publico, escola_publico_em from interno.perfis where id = $1", [ids.dona])).rows[0];
}, (r) => r.escola_publico === "militantes" && r.escola_publico_em !== null);
const AULAS = ["conversar-com-quem-pensa-diferente/escutar-antes-de-responder", "conversar-com-quem-pensa-diferente/perguntas-que-abrem", "analise-de-conjuntura/o-que-e-conjuntura"];
await espera("declarar 3 aulas e o caderno 03", async () => {
  for (const a of AULAS) await rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "aula", p_alvo: a, p_ligar: true });
  await rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-03", p_ligar: true });
  await rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "aula", p_alvo: AULAS[0], p_ligar: true });
  return (await dono("select count(*)::int n, bool_or(verificada) v from interno.escola_conquistas where usuario = $1 and tipo in ('aula', 'caderno')", [ids.dona])).rows[0];
}, (r) => r.n === 4 && r.v === false);
await espera("'militantes': outra militante vê carteirinha, caderno e a CONTAGEM de aulas", () => selosVistos(ids.outra), (s) => JSON.stringify(s) === JSON.stringify(["escola:carteirinha", "escola:caderno-03", "escola:aulas-3"]));
await espera("o perfil nunca leva a lista de aulas, só a contagem", () => rpc(como(ids.outra), "rede_perfil_de", { p_handle: "dona" }), (r) => !AULAS.some((a) => JSON.stringify(r).includes(a)));
await espera("'militantes': seguidor e conta comum não veem", async () => (await selosVistos(ids.seguidor)).length + (await selosVistos(ids.comum)).length, (n) => n === 0);

await rpc(como(ids.dona), "escola_publico_definir", { p: "seguidores" });
await espera("'seguidores': o seguidor aceito vê", () => selosVistos(ids.seguidor), (s) => s.includes("escola:carteirinha") && s.includes("escola:aulas-3"));
await espera("'seguidores': pedido pendente, militante que não segue e conta comum não veem", async () =>
  (await selosVistos(ids.pendente)).length + (await selosVistos(ids.outra)).length + (await selosVistos(ids.comum)).length, (n) => n === 0);
await espera("trocar de público já ligado não apaga o declarado", () => dono("select count(*)::int n from interno.escola_conquistas where usuario = $1 and not verificada", [ids.dona]), (r) => r.rows[0].n === 4);

await rpc(como(ids.dona), "escola_publico_definir", { p: "todos" });
await espera("'todos': a conta comum vê", () => selosVistos(ids.comum), (s) => s.length === 3);
await dono("update interno.escola_militancia set degrau = 2 where usuario = $1", [ids.dona]);
await dono("insert into interno.escola_conquistas (usuario, tipo, alvo, verificada) values ($1, 'degrau', 'degrau-1', true), ($1, 'degrau', 'degrau-2', true)", [ids.dona]);
await espera("degrau verificado: só o maior aparece, depois da carteirinha", () => selosVistos(ids.comum), (s) => JSON.stringify(s) === JSON.stringify(["escola:carteirinha", "escola:degrau-2", "escola:caderno-03", "escola:aulas-3"]));
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [ids.dona, ids.bloqueada]);
await espera("bloqueio: a função de visibilidade nega", () => dono("select interno.escola_pode_ver($1, $2) b", [ids.dona, ids.bloqueada]), (r) => r.rows[0].b === false);
await dono("update interno.perfis set rede_selos_mostrar = false where id = $1", [ids.dona]);
await espera("selos da Alumia escondidos: os da Escola somem junto", () => selosVistos(ids.comum), (s) => s.length === 0);
await dono("update interno.perfis set rede_selos_mostrar = true where id = $1", [ids.dona]);
await espera("sem sessão (auth.uid nulo), o filtro nunca mostra", () => dono("select interno.escola_conquistas_visiveis($1, null) s", [ids.dona]), (r) => JSON.stringify(r.rows[0].s) === "[]");
await espera("os outros selos da Alumia continuam (trilha declarada)", async () => {
  await dono("update interno.perfis set rede_selos = array['trilha:analise-de-conjuntura'] where id = $1", [ids.dona]);
  return (await rpc(como(ids.comum), "rede_perfil_de", { p_handle: "dona" })).selos;
}, (s) => s[0] === "trilha:analise-de-conjuntura" && s[1] === "escola:carteirinha");

await espera("retirar uma aula (p_ligar = false) baixa a contagem", async () => {
  await rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "aula", p_alvo: AULAS[2], p_ligar: false });
  return selosVistos(ids.comum);
}, (s) => s.includes("escola:aulas-2"));
await espera("retirar não mexe no que o servidor verificou", async () => {
  await rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-03", p_ligar: false });
  return dono("select count(*)::int n from interno.escola_conquistas where usuario = $1 and verificada", [ids.dona]);
}, (r) => r.rows[0].n === 3);
await rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-03", p_ligar: true });

// Entradas ruins.
await recusa("tipo inválido (carteirinha não se declara)", () => rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "carteirinha", p_alvo: "carteirinha", p_ligar: true }), "invalido:tipo");
await recusa("degrau não se declara", () => rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "degrau", p_alvo: "degrau-3", p_ligar: true }), "invalido:tipo");
await recusa("aula fora do formato", () => rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "aula", p_alvo: "../../segredo", p_ligar: true }), "invalido:alvo");
await recusa("caderno 12 não existe", () => rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-12", p_ligar: true }), "invalido:alvo");
await recusa("ligar nulo", () => rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-04", p_ligar: null }), "invalido:ligar");
await recusa("público inválido", () => rpc(como(ids.dona), "escola_publico_definir", { p: "mundo" }), "invalido:publico");
await recusa("conta comum não define público", () => rpc(como(ids.comum), "escola_publico_definir", { p: "todos" }), "sem_permissao");
await recusa("conta comum não declara", () => rpc(como(ids.comum), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-01", p_ligar: true }), "sem_permissao");
await recusa("conta comum não lê conquistas", () => rpc(como(ids.comum), "escola_conquistas_minhas"), "sem_permissao");
await recusa("coordenação sem a militância (fora do departamento) não declara", () => rpc(como(ids.coord), "escola_conquistas_minhas"), "sem_permissao");
for (const [f, a] of [["escola_conquistas_minhas", {}], ["escola_publico_definir", { p: "todos" }], ["escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-01", p_ligar: true }]]) {
  await recusa(`anon não chama ${f}`, () => rpc(anon, f, a), "permission denied");
}
for (const f of ["interno.escola_pode_ver(null::uuid, null::uuid)", "interno.escola_conquistas_visiveis(null::uuid, null::uuid)"]) {
  await recusa(`authenticated não chama ${f.split("(")[0]} direto`, () => exclusivo(async () => {
    await pg.exec("set role authenticated");
    try {
      return (await pg.query(`select ${f}`)).rows;
    } finally {
      await pg.exec("reset role");
    }
  }), "permission denied");
}

await espera("limite de 400 declaradas", async () => {
  const valores = [];
  for (let i = 0; i < MAX_DECLARADAS - 3; i++) valores.push(`('${ids.dona}', 'aula', 'trilha-${i}/aula-${i}', false)`);
  await dono(`insert into interno.escola_conquistas (usuario, tipo, alvo, verificada) values ${valores.join(", ")} on conflict do nothing`);
  return (await dono("select count(*)::int n from interno.escola_conquistas where usuario = $1 and not verificada", [ids.dona])).rows[0].n;
}, (n) => n === MAX_DECLARADAS);
await recusa("a 401ª declarada é recusada", () => rpc(como(ids.dona), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-05", p_ligar: true }), "invalido:muitas");
await espera("a contagem de aulas no perfil acompanha (sem lista)", () => selosVistos(ids.comum), (s) => s.includes("escola:aulas-399"));

// Desligar apaga a exibição na hora (LGPD art. 18, VI): o que o aparelho declarou sai do banco.
await espera("desligar ('ninguem') esconde de todos e apaga o declarado", async () => {
  await rpc(como(ids.dona), "escola_publico_definir", { p: "ninguem" });
  const r = (await dono("select (select count(*)::int from interno.escola_conquistas where usuario = $1 and not verificada) n, (select escola_publico_em from interno.perfis where id = $1) em", [ids.dona])).rows[0];
  return r.n === 0 && r.em === null && (await ninguemVe()) && (await selosVistos(ids.comum)).length === 0;
}, (x) => x);
await espera("desligar mantém o que o servidor verificou (carteirinha e degrau)", () => dono("select count(*)::int n from interno.escola_conquistas where usuario = $1 and verificada", [ids.dona]), (r) => r.rows[0].n === 3);

// Sair do departamento: militância e conquistas apagadas (F1) e o público volta para 'ninguem' (F5).
await rpc(como(ids.outra), "escola_publico_definir", { p: "todos" });
await rpc(como(ids.outra), "escola_conquista_declarar", { p_tipo: "caderno", p_alvo: "caderno-01", p_ligar: true });
await dono("delete from interno.departamento_membros where departamento = 'revolucionarios' and usuario = $1", [ids.outra]);
await espera("sair do departamento apaga tudo e volta o público para 'ninguem'", () => dono("select (select count(*)::int from interno.escola_conquistas where usuario = $1) n, (select escola_publico from interno.perfis where id = $1) p, (select escola_publico_em from interno.perfis where id = $1) em", [ids.outra]), (r) =>
  r.rows[0].n === 0 && r.rows[0].p === "ninguem" && r.rows[0].em === null);
await entrar(ids.outra);
await espera("voltar ao departamento recomeça escondido", async () => {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [ids.comum, ids.outra]);
  return ((await rpc(como(ids.comum), "rede_perfil_de", { p_handle: "outra" })).selos ?? []).filter((s) => s.startsWith("escola:"));
}, (s) => s.length === 0);

await espera("funções da F5: security definer e search_path fixo", () => dono("select proname, prosecdef, proconfig from pg_proc where proname in ('escola_pode_ver', 'escola_conquistas_visiveis', 'rede3_perfil_selos', 'escola_exige_militancia', 'escola_publico_definir', 'escola_conquista_declarar', 'escola_conquistas_minhas', 'escola_publico_ao_sair')"), (r) =>
  r.rows.length === 8 && r.rows.every((x) => x.prosecdef && (x.proconfig ?? []).some((c) => c === "search_path=interno, pg_temp")));
await espera("nada de nome civil nas respostas", async () => JSON.stringify([await rpc(como(ids.dona), "escola_conquistas_minhas"), await rpc(como(ids.comum), "rede_perfil_de", { p_handle: "dona" })]), (t) => !t.includes("Nome Civil"));

// ───────────────────────────── 2. Contrato e contas puras ─────────────────────────────
for (const f of ["escola_conquista_declarar", "escola_publico_definir", "escola_conquistas_minhas"]) {
  confere(`contrato: ${f} é da F5`, FUNCOES_DA_ESCOLA[f] === "F5");
  confere(`migração cria public.${f}`, MIGRACAO.includes(`function public.${f}(`));
}
confere("selo carteirinha", JSON.stringify(lerSeloDaEscola("escola:carteirinha")) === JSON.stringify({ tipo: "carteirinha" }));
confere("selo degrau", lerSeloDaEscola("escola:degrau-2")?.n === 2 && lerSeloDaEscola("escola:degrau-4") === null);
confere("selo caderno", lerSeloDaEscola("escola:caderno-03")?.n === 3 && lerSeloDaEscola("escola:caderno-12") === null && lerSeloDaEscola("escola:caderno-3") === null);
confere("selo aulas", lerSeloDaEscola("escola:aulas-17")?.n === 17 && lerSeloDaEscola("escola:aulas-0") === null);
confere("outros selos não são da Escola", !eSeloDaEscola("trilha:x") && !eSeloDaEscola("equipe") && !eSeloDaEscola("escola:aula:x/y"));
confere("selosDaEscola filtra e mantém a ordem", JSON.stringify(selosDaEscola(["equipe", "escola:carteirinha", "trilha:x", "escola:aulas-2"]).map((s) => s.tipo)) === '["carteirinha","aulas"]');
confere("alvo do caderno", alvoDoCaderno(3) === "caderno-03" && alvoDoCaderno(11) === "caderno-11");

const CADERNOS = [
  { numero: 1, degrau: 1, slug: "consciencia-de-classe", aulas: [{ id: "ta/1" }, { id: "ta/2" }] },
  { numero: 2, degrau: 1, slug: "primeiros-passos-na-militancia", aulas: [{ id: "tb/1" }] },
  { numero: 3, degrau: 2, slug: "conversar-com-quem-pensa-diferente", aulas: [{ id: "tc/1" }, { id: "tc/2" }] },
  { numero: 4, degrau: 2, slug: "organizacao-de-base", aulas: [] },
];
const feitas = new Set(["ta/1", "ta/2", "tc/1", "fora/x"]);
const decl = aDeclarar(CADERNOS, feitas, [{ tipo: "carteirinha", alvo: "carteirinha", verificada: true }, { tipo: "aula", alvo: "ta/1", verificada: false }]);
confere("aDeclarar: caderno inteiro primeiro, depois as aulas que faltam no banco", JSON.stringify(decl) === JSON.stringify([{ tipo: "caderno", alvo: "caderno-01" }, { tipo: "aula", alvo: "ta/2" }, { tipo: "aula", alvo: "tc/1" }]), JSON.stringify(decl));
confere("aDeclarar: aula fora dos cadernos não vai", !decl.some((d) => d.alvo === "fora/x"));
confere("aDeclarar: caderno em preparação não conta como feito", !decl.some((d) => d.alvo === "caderno-04"));
const cheio = Array.from({ length: MAX_DECLARADAS - 1 }, (_, i) => ({ tipo: "aula", alvo: `t/${i}`, verificada: false }));
confere("aDeclarar respeita o limite de 400", aDeclarar(CADERNOS, feitas, cheio).length === 1);
const previstos = selosPrevistos([
  { tipo: "aula", alvo: "ta/1", verificada: false },
  { tipo: "caderno", alvo: "caderno-03", verificada: false },
  { tipo: "degrau", alvo: "degrau-1", verificada: true },
  { tipo: "degrau", alvo: "degrau-2", verificada: false },
  { tipo: "carteirinha", alvo: "carteirinha", verificada: true },
  { tipo: "caderno", alvo: "caderno-01", verificada: false },
]);
confere("selosPrevistos segue a regra do banco (degrau só verificado)", JSON.stringify(previstos) === JSON.stringify([{ tipo: "carteirinha" }, { tipo: "degrau", n: 1 }, { tipo: "caderno", n: 1 }, { tipo: "caderno", n: 3 }, { tipo: "aulas", n: 1 }]), JSON.stringify(previstos));
const cad = contarCaderneta(CADERNOS, feitas, { "consciencia-de-classe": {}, outro: {} }, [{ tipo: "turma" }, { tipo: "tarefa" }, { tipo: "turma" }]);
confere("caderneta: aulas dos cadernos, tarefas e rodas", cad.aulas === 3 && cad.tarefas === 2 && cad.rodas === 2, JSON.stringify(cad));
const falta = faltaNoDegrau(2, CADERNOS, feitas, { "conversar-com-quem-pensa-diferente": {} });
confere("para fechar o degrau 2: 2 cadernos (um em preparação) e 1 tarefa", falta.cadernos === 2 && falta.tarefas === 1 && JSON.stringify(falta.quais) === "[3,4]", JSON.stringify(falta));
const falta1 = faltaNoDegrau(1, CADERNOS, new Set(["ta/1", "ta/2", "tb/1"]), { "consciencia-de-classe": {}, "primeiros-passos-na-militancia": {} });
confere("degrau 1 todo feito: só a banca falta", falta1.cadernos === 0 && falta1.tarefas === 0);
confere("barras dos degraus", JSON.stringify(barrasDosDegraus(2)) === '["feito","agora","depois"]' && JSON.stringify(barrasDosDegraus(1)) === '["agora","depois","depois"]');
confere("consentimento só ao sair de 'ninguem'", pedeConsentimento("ninguem", "todos") && !pedeConsentimento("militantes", "todos") && !pedeConsentimento("todos", "ninguem") && !pedeConsentimento("ninguem", "ninguem"));
confere("mês e ano no idioma", /mar[cç]o de 2026/.test(mesEAno("2026-03-10", "pt") ?? "") && mesEAno("x", "pt") === null && mesEAno(null, "pt") === null);
confere("nome do arquivo neutro", nomeDoArquivo(new Date("2026-11-08T12:00:00Z")) === "meu-estudo-2026-11-08.json" && !/escola|milit/i.test(nomeDoArquivo(new Date())));

// ───────────────────────────── 3. Textos ─────────────────────────────
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort();
const percurso = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(ler("i18n", "escola", "percurso", `${l}.json`))]));
for (const l of IDIOMAS.slice(1)) {
  confere(`percurso: ${l} tem as mesmas chaves do pt`, JSON.stringify(chaves(percurso[l])) === JSON.stringify(chaves(percurso.pt)));
  const vazias = chaves(percurso[l]).filter((k) => !String(k.split(".").reduce((o, x) => o[x], percurso[l])).trim());
  confere(`percurso: ${l} sem texto vazio`, vazias.length === 0, vazias.join(", "));
}
confere("o consentimento cita a LGPD e o desligar", /LGPD/.test(percurso.pt.alumia.consentimento.texto) && /desligar/i.test(percurso.pt.alumia.consentimento.texto));
const perfil = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(ler("i18n", "rede", "perfil", `${l}.json`))]));
for (const l of IDIOMAS) {
  const e = perfil[l].perfil.selosEscola;
  confere(`rede/perfil ${l}: textos do selo da Escola`, e && ["carteirinha", "degrau", "caderno", "aulas", "titulo"].every((k) => typeof e[k] === "string" && e[k].trim()) && typeof perfil[l].editar.escolaAtalho === "string");
}

// ───────────────────────────── 4. Segurança no código ─────────────────────────────
const PASTA = path.join(raiz, "components", "escola", "percurso");
const arquivos = fs.readdirSync(PASTA).filter((f) => /\.tsx?$/.test(f));
const codigo = Object.fromEntries(arquivos.map((f) => [f, fs.readFileSync(path.join(PASTA, f), "utf8")]));
const mostrar = codigo["MostrarNaAlumia.tsx"] ?? "";
confere("MostrarNaAlumia existe", Boolean(mostrar));
confere("ligar passa pela tela de consentimento", /pedeConsentimento/.test(mostrar) && /role="dialog"|<dialog/.test(mostrar));
{
  // Uma declaração que falha não pode virar laço: nada de setLido com a lista vazia e nada de tentar de novo sozinho.
  const efeito = mostrar.slice(mostrar.indexOf("escola_conquista_declarar\", {"), mostrar.indexOf("async function definir"));
  confere("declarar ao banco: setLido só quando há conquistas novas", /if \(novas\.length > 0\) setLido\(/.test(efeito) && !/^\s*setLido\(\(l\) => \(l \? \{ \.\.\.l, conquistas: \[\.\.\.l\.conquistas, \.\.\.novas\]/m.test(efeito));
  confere("declarar ao banco: depois de um erro não tenta de novo sozinho", /if \(erro\) falhouEnvio\.current = true/.test(efeito) && /falhouEnvio\.current\) return;/.test(mostrar));
}
confere("o público não é guardado no aparelho", !Object.values(codigo).some((t) => /localStorage\.setItem|sessionStorage\.setItem/.test(t)));
confere("nenhuma tela da F5 chama o banco fora do contrato", Object.values(codigo).every((t) => !/\brpc\(/.test(t)));
const pagina = lerSe("app", "[lang]", "escola", "percurso", "page.tsx");
confere("a página só manda texto público e as aulas dos cadernos (nada de militante no servidor)", Boolean(pagina) && !/escola_eu|escola_conquistas_minhas|createClient|cookies\(/.test(pagina));
confere("a prévia de exemplo só em desenvolvimento", Object.values(codigo).every((t) => !/previa/i.test(t) || /emPrevia\(\)/.test(t)));
confere("TelaDoPerfil desenha os selos 'escola:*' pelo componente da Escola", /SelosDaEscola/.test(lerSe("components", "rede", "perfil", "TelaDoPerfil.tsx")));
confere("EditarPerfil tem o atalho para escolher na Escola", /escolaAtalho/.test(lerSe("components", "rede", "perfil", "EditarPerfil.tsx")));

if (falhas.length) {
  console.error(`escola-conquistas: ${certos} certos, ${falhas.length} falhas:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`escola-conquistas: ${certos} conferências certas.`);
process.exit(0);
