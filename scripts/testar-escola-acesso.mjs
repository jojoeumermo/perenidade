// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a fundação da Escola de Formação (PLANO-ESCOLA.md, F1):
//  1. O banco (supabase/migracoes/20261108-escola-formacao-base.sql, sobre o install.sql, num Postgres de verdade dentro do
//     Node): quem não é militante não recebe nada de escola_eu; o gatilho do departamento cria e apaga; anon e
//     authenticated não leem tabela nenhuma; a migração roda duas vezes; nada de nome civil.
//  2. O contrato (lib/escola/contratos.ts): todas as funções do plano, com dono; cadernos na ordem da tabela 1.6.
//  3. As contas puras da tela Hoje (quadro, percurso, datas) e as rotas novas.
//  4. Os textos nos 6 idiomas (mesmas chaves) e o contraste AA dos pares de cor usados.
//  5. Segurança no código: a prévia só em desenvolvimento; a porta e as telas não guardam militância no aparelho.
// Uso: npm run testar:escola-acesso
import fs from "node:fs";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";
import { CADERNOS_DA_ESCOLA, FUNCOES_DA_ESCOLA, MIGRACOES_DA_ESCOLA, caminhoDaAula, codigoDaAula, lessonIdDoPedaco, pedacoDaAula } from "../lib/escola/contratos.ts";
import { BARRA_DA_ESCOLA, COLUNA_DA_ESCOLA, PUBLICAS_DA_ESCOLA, TELAS_DA_FORMACAO, publicaDaEscola, telaAberta } from "../lib/escola/rotas.ts";
import { cadernoAtual, fracaoDoPercurso, linhasDoQuadro, situacoes } from "../components/escola/hoje/quadro.ts";
import { dataDeHoje, diaEHora, horaCurta, hojeISO, periodoDoDia } from "../components/escola/hoje/tempo.ts";

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

// ───────────────────────────── 1. O banco ─────────────────────────────
const MIGRACAO = ler("supabase", "migracoes", "20261108-escola-formacao-base.sql");
const banco = await criarBanco();
const { rpc, dono, criarUsuario, pg, exclusivo } = banco;
const instalar = () => exclusivo(() => pg.exec(MIGRACAO));
await espera("a migração instala sobre o install.sql", instalar);
await espera("a migração roda de novo sem quebrar (acrescentável)", instalar);

const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.70" });
const anon = { papel: "anon", ip: "203.0.113.71" };
const ids = {};
for (const chave of ["coord", "militante", "jurema", "comum", "suspensa", "sai"]) {
  ids[chave] = await criarUsuario(`${chave}@formacao.local`, `Nome Civil ${chave}`);
  await rpc(como(ids[chave]), "eu");
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.coord]);
const entrar = (u) => dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [u, ids.coord]);
for (const u of ["militante", "jurema", "suspensa", "sai"]) await entrar(ids[u]);

await espera("anon: escola_eu só diz que não é militante", () => rpc(anon, "escola_eu"), (r) => JSON.stringify(r) === JSON.stringify({ conta: false, militante: false }));
await espera("conta comum: escola_eu só diz que não é militante", () => rpc(como(ids.comum), "escola_eu"), (r) => JSON.stringify(r) === JSON.stringify({ conta: true, militante: false }));

await espera("entrar no departamento cria a militância (degrau 1) e a carteirinha verificada", async () => {
  const m = (await dono("select degrau from interno.escola_militancia where usuario = $1", [ids.militante])).rows;
  const c = (await dono("select verificada from interno.escola_conquistas where usuario = $1 and tipo = 'carteirinha'", [ids.militante])).rows;
  return m.length === 1 && m[0].degrau === 1 && c.length === 1 && c[0].verificada === true;
}, (x) => x);

// Codinome, núcleo e quem acompanha.
await dono("update interno.perfis set rede_codinome = 'Faísca', rede_codinome_ok = true, rede_handle = 'faisca' where id = $1", [ids.militante]);
await dono("update interno.perfis set rede_codinome = 'Jurema', rede_codinome_ok = true, rede_handle = 'jurema' where id = $1", [ids.jurema]);
const nucleo = (await dono("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo Zona Leste', 'São Paulo') returning id")).rows[0].id;
await dono("update interno.escola_militancia set degrau = 2, nucleo = $2, acompanha = $3, frente = 'bairros' where usuario = $1", [ids.militante, nucleo, ids.jurema]);
await dono("update interno.escola_militancia set degrau = 3 where usuario = $1", [ids.jurema]);

await espera("militante: escola_eu com codinome, degrau, núcleo e quem acompanha", () => rpc(como(ids.militante), "escola_eu"), (r) =>
  r.militante === true && r.codinome === "Faísca" && r.handle === "faisca" && r.degrau === 2 && r.frente === "bairros" &&
  r.nucleo?.id === nucleo && r.nucleo?.nome === "Núcleo Zona Leste" && r.acompanha?.codinome === "Jurema" && r.acompanha?.handle === "jurema" &&
  r.publico === "ninguem" && r.coordena === false && typeof r.desde === "string");
await espera("escola_eu nunca leva o nome civil", () => rpc(como(ids.militante), "escola_eu"), (r) => !JSON.stringify(r).includes("Nome Civil") && !("nome" in r));
await dono("update interno.perfis set rede_invisivel = true where id = $1", [ids.jurema]);
await espera("quem acompanha invisível: sem o @", () => rpc(como(ids.militante), "escola_eu"), (r) => r.acompanha?.codinome === "Jurema" && r.acompanha?.handle === null);
await dono("update interno.perfis set rede_codinome_ok = false where id = $1", [ids.militante]);
await espera("codinome não confirmado não aparece", () => rpc(como(ids.militante), "escola_eu"), (r) => r.militante === true && r.codinome === null);

await espera("coordenação entra na Escola (sem estar no departamento) e vê que coordena", () => rpc(como(ids.coord), "escola_eu"), (r) => r.militante === true && r.coordena === true && r.degrau === 1 && r.desde === null);
await dono("update interno.perfis set suspenso = true where id = $1", [ids.suspensa]);
await espera("conta suspensa: não é militante", () => rpc(como(ids.suspensa), "escola_eu"), (r) => r.militante === false);
await espera("e_militante: comum não, militante sim, nulo não", () => dono("select interno.e_militante($1) a, interno.e_militante($2) b, interno.e_militante(null) c", [ids.comum, ids.militante]), (r) => r.rows[0].a === false && r.rows[0].b === true && r.rows[0].c === false);

// Sair apaga (LGPD art. 18, VI) e solta quem a pessoa acompanhava.
await dono("update interno.escola_militancia set acompanha = $2 where usuario = $1", [ids.militante, ids.sai]);
await dono("insert into interno.escola_bancas (militante, degrau, por) values ($1, 1, $2)", [ids.sai, ids.coord]);
await dono("insert into interno.escola_conquistas (usuario, tipo, alvo) values ($1, 'aula', 'conversar-com-quem-pensa-diferente/escutar-antes-de-responder')", [ids.sai]);
await dono("delete from interno.departamento_membros where departamento = 'revolucionarios' and usuario = $1", [ids.sai]);
await espera("sair do departamento apaga militância, conquistas e bancas", async () => {
  const n = (await dono(
    "select (select count(*) from interno.escola_militancia where usuario = $1)::int + (select count(*) from interno.escola_conquistas where usuario = $1)::int + (select count(*) from interno.escola_bancas where militante = $1)::int as n",
    [ids.sai],
  )).rows[0].n;
  return n;
}, (n) => n === 0);
await espera("sair solta quem a pessoa acompanhava", () => dono("select acompanha from interno.escola_militancia where usuario = $1", [ids.militante]), (r) => r.rows[0].acompanha === null);
await espera("quem saiu: escola_eu fechado", () => rpc(como(ids.sai), "escola_eu"), (r) => r.militante === false);
await entrar(ids.sai);
await espera("voltar ao departamento cria de novo", () => dono("select count(*)::int n from interno.escola_militancia where usuario = $1", [ids.sai]), (r) => r.rows[0].n === 1);

// Representante do departamento (sem a linha de participação) ganha a militância na primeira vez que entra.
const rep = await criarUsuario("rep@formacao.local", "Nome Civil rep");
await rpc(como(rep), "eu");
await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'representante', 'revolucionarios')", [rep]);
await espera("representante dos Revolucionários entra e ganha a militância", () => rpc(como(rep), "escola_eu"), async (r) => r.militante === true && (await dono("select count(*)::int n from interno.escola_militancia where usuario = $1", [rep])).rows[0].n === 1);

await dono("insert into interno.escola_conquistas (usuario, tipo, alvo) values ($1, 'aula', 'conversar-com-quem-pensa-diferente/escutar-antes-de-responder')", [rep]);
await dono("delete from interno.papeis where usuario = $1 and papel = 'representante' and disciplina = 'revolucionarios'", [rep]);
await espera("deixar de representar os Revolucionários apaga militância e conquistas", () => dono("select (select count(*) from interno.escola_militancia where usuario = $1)::int + (select count(*) from interno.escola_conquistas where usuario = $1)::int as n", [rep]), (r) => r.rows[0].n === 0);
await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'representante', 'revolucionarios')", [rep]);
await espera("voltar a representar cria a militância de novo", () => dono("select count(*)::int n from interno.escola_militancia where usuario = $1", [rep]), (r) => r.rows[0].n === 1);
await entrar(rep);
await dono("delete from interno.papeis where usuario = $1 and papel = 'representante' and disciplina = 'revolucionarios'", [rep]);
await espera("quem continua no departamento não perde nada ao deixar de representar", () => dono("select count(*)::int n from interno.escola_militancia where usuario = $1", [rep]), (r) => r.rows[0].n === 1);

// Funções internas fechadas para os papéis da API; escola_eu aberta para anon e authenticated.
for (const papel of ["anon", "authenticated"]) {
  for (const chamada of [`interno.escola_militancia_criar('${ids.comum}')`, `interno.escola_militancia_apagar('${ids.militante}')`, `interno.e_militante('${ids.militante}')`]) {
    await recusa(`${papel} não executa ${chamada.split("(")[0]}`, () => exclusivo(async () => {
      await pg.exec(`set role ${papel}`);
      try {
        return (await pg.query(`select ${chamada}`)).rows;
      } finally {
        await pg.exec("reset role");
      }
    }), "permission denied");
  }
}
await espera("escola_eu: execute só para anon, authenticated e service_role (não para public)", () => dono(
  "select has_function_privilege('anon', 'public.escola_eu()', 'execute') a, has_function_privilege('authenticated', 'public.escola_eu()', 'execute') b, exists (select 1 from pg_proc, aclexplode(proacl) x where proname = 'escola_eu' and x.grantee = 0) p"),
  (r) => r.rows[0].a === true && r.rows[0].b === true && r.rows[0].p === false);

// Tabelas trancadas para os papéis da API.
const TABELAS = ["escola_militancia", "escola_encontros", "escola_encontro_tarefas", "escola_perguntas", "escola_recados", "escola_bancas", "escola_conquistas"];
await espera("todas as tabelas da Escola com segurança por linha ligada", () => dono("select relname, relrowsecurity from pg_class where relnamespace = 'interno'::regnamespace and relname = any($1)", [TABELAS]), (r) => r.rows.length === TABELAS.length && r.rows.every((x) => x.relrowsecurity));
for (const papel of ["anon", "authenticated"]) {
  for (const tabela of TABELAS) {
    await recusa(`${papel} não lê interno.${tabela}`, () => exclusivo(async () => {
      await pg.exec(`set role ${papel}`);
      try {
        return (await pg.query(`select * from interno.${tabela} limit 1`)).rows;
      } finally {
        await pg.exec("reset role");
      }
    }), "permission denied");
  }
}
await espera("funções da Escola: security definer e search_path fixo", () => dono("select proname, prosecdef, proconfig from pg_proc where proname in ('escola_eu', 'e_militante', 'escola_militancia_criar', 'escola_militancia_apagar', 'escola_departamento_gatilho', 'escola_papel_gatilho')"), (r) =>
  r.rows.length === 6 && r.rows.every((x) => x.prosecdef && (x.proconfig ?? []).some((c) => c === "search_path=interno, pg_temp")));
await espera("escola_publico nasce 'ninguem' e só aceita os 4 públicos", async () => {
  const p = (await dono("select escola_publico from interno.perfis where id = $1", [ids.comum])).rows[0].escola_publico;
  let recusou = false;
  try {
    await dono("update interno.perfis set escola_publico = 'mundo' where id = $1", [ids.comum]);
  } catch {
    recusou = true;
  }
  return p === "ninguem" && recusou;
}, (x) => x);
await espera("a pausa geral vale nos inserts da Escola (encontros, tarefas, perguntas, recados, bancas)", () => dono("select count(*)::int n from pg_trigger where tgname = 'lucia_pausa' and tgrelid::regclass::text = any($1)", [["interno.escola_encontros", "interno.escola_encontro_tarefas", "interno.escola_perguntas", "interno.escola_recados", "interno.escola_bancas"]]), (r) => r.rows[0].n === 5);
confere("a migração não grava nome civil (perfis.nome) em lugar nenhum", !/perfis\.nome|f\.nome|p\.nome/.test(MIGRACAO));
confere("a migração está inteira no install.sql", semCR(ler("supabase", "install.sql")).includes(semCR(ler("supabase", "migracoes", "20261108-escola-formacao-base.sql")).trim()));

// ───────────────────────────── 2. O contrato ─────────────────────────────
const DO_PLANO = ["escola_eu", "escola_aulas_hoje", "escola_gravacoes", "escola_nucleo", "escola_encontro_salvar", "escola_tarefa_pegar", "escola_levar_ao_nucleo", "escola_pergunta_da_semana", "escola_pergunta_definir", "escola_recados", "escola_recado_salvar", "escola_acompanhar", "escola_banca_marcar", "escola_banca_decidir", "escola_militantes_listar", "escola_militante_ajustar", "escola_conquista_declarar", "escola_publico_definir", "escola_conquistas_minhas", "escola_frente_escolher", "escola_frentes_somadas"];
confere("contrato: todas as funções públicas do plano (4.1 a 4.6)", DO_PLANO.every((n) => n in FUNCOES_DA_ESCOLA) && Object.keys(FUNCOES_DA_ESCOLA).length === DO_PLANO.length);
const contratoTs = ler("lib", "escola", "contratos.ts");
confere("contrato: cada função também no tipo FuncoesDaEscola", DO_PLANO.every((n) => new RegExp(`\\n  ${n}: \\{ frente: "F\\d"`).test(contratoTs)));
confere("contrato: as funções da F1 estão na migração da F1", Object.entries(FUNCOES_DA_ESCOLA).filter(([, f]) => f === "F1").every(([n]) => MIGRACAO.includes(`public.${n}(`)) && MIGRACOES_DA_ESCOLA.F1 === "20261108-escola-formacao-base.sql");
for (const [frente, arquivo] of Object.entries(MIGRACOES_DA_ESCOLA)) {
  const caminho = path.join(raiz, "supabase", "migracoes", arquivo);
  if (frente === "F1" || !fs.existsSync(caminho)) continue;
  const sql = fs.readFileSync(caminho, "utf8");
  const faltam = Object.entries(FUNCOES_DA_ESCOLA).filter(([, f]) => f === frente).map(([n]) => n).filter((n) => !sql.includes(`public.${n}(`));
  confere(`contrato: a migração da ${frente} tem as funções do contrato`, faltam.length === 0, faltam.join(", "));
}
confere("cadernos: 11, na ordem, com os degraus da tabela 1.6", CADERNOS_DA_ESCOLA.map((c) => `${c.numero}:${c.degrau}`).join() === "1:1,2:1,3:2,4:2,5:2,6:2,7:2,8:3,9:3,10:3,11:3");
for (const c of CADERNOS_DA_ESCOLA) {
  const existe = c.fonte.tipo === "despertar" ? fs.existsSync(path.join(raiz, "content", "despertar.json")) : c.fonte.tipo === "trilha" ? fs.existsSync(path.join(raiz, "content", "trilhas", c.fonte.trilha, "_trilha.md")) : fs.existsSync(path.join(raiz, "content", "escola", "cursos", `${c.fonte.curso}.json`));
  confere(`caderno ${c.numero}: a fonte existe`, existe);
}
const c03 = CADERNOS_DA_ESCOLA[2];
const c01 = CADERNOS_DA_ESCOLA[0];
confere("endereço da aula da própria trilha é só o slug", pedacoDaAula(c03, "conversar-com-quem-pensa-diferente/discordar-sem-humilhar") === "discordar-sem-humilhar" && caminhoDaAula(c03, "conversar-com-quem-pensa-diferente/discordar-sem-humilhar") === "/escola/formacao/conversar-com-quem-pensa-diferente/discordar-sem-humilhar");
confere("endereço da aula de outra trilha é trilha--aula, e volta", pedacoDaAula(c01, "marxismo-fundamental/o-que-e-exploracao") === "marxismo-fundamental--o-que-e-exploracao" && lessonIdDoPedaco(c01, "marxismo-fundamental--o-que-e-exploracao") === "marxismo-fundamental/o-que-e-exploracao" && lessonIdDoPedaco(c03, "discordar-sem-humilhar") === "conversar-com-quem-pensa-diferente/discordar-sem-humilhar");
confere("código F-0304", codigoDaAula(3, 3) === "F-0304" && codigoDaAula(11, 0) === "F-1101");

// ───────────────────────────── 3. Contas puras e rotas ─────────────────────────────
const cad = (numero, n) => ({ numero, aulas: Array.from({ length: n }, (_, i) => ({ id: `t${numero}/a${i}` })) });
const cads = [cad(1, 3), cad(2, 2), cad(3, 0), cad(4, 4)];
const feitas = new Set(["t1/a0", "t1/a1", "t1/a2", "t2/a0", "t4/a0", "t4/a1"]);
const s = situacoes(cads, feitas);
confere("situações: feito, aberto, em preparação", s.join() === "feito,aberto,preparacao,aberto");
confere("caderno atual é o primeiro aberto", cadernoAtual(s) === 1 && cadernoAtual(["feito", "preparacao"]) === -1);
const linhas = linhasDoQuadro(cads[3], feitas, 6);
confere("quadro: 2 riscadas antes da de agora, depois as seguintes", linhas.map((l) => `${l.aula.id}:${l.feita ? "x" : "-"}${l.agora ? "!" : ""}`).join() === "t4/a0:x,t4/a1:x,t4/a2:-!,t4/a3:-");
confere("quadro: caderno feito não tem linha", linhasDoQuadro(cads[0], feitas, 6).length === 0);
confere("quadro: respeita as vagas", linhasDoQuadro(cad(9, 20), new Set(), 5).length === 5);
confere("percurso: fração até o caderno atual", fracaoDoPercurso(11, 2, []) === 0.2 && fracaoDoPercurso(11, 0, []) === 0);
const quarta = new Date("2026-11-11T22:00:00Z"); // 19h em Brasília
confere("datas em Brasília", hojeISO(new Date("2026-11-12T02:00:00Z")) === "2026-11-11" && periodoDoDia(quarta) === "noite" && periodoDoDia(new Date("2026-11-11T12:00:00Z")) === "manha");
confere("hora curta: 19h no português, 19:00 nos outros", horaCurta("pt", quarta.toISOString()) === "19h" && horaCurta("en", quarta.toISOString()) === "19:00" && horaCurta("pt", "2026-11-11T22:30:00Z") === "19h30");
confere("dia e hora sem '-feira'", diaEHora("pt", quarta.toISOString()) === "quarta, 19h", diaEHora("pt", quarta.toISOString()));
confere("data de hoje por extenso", /^quarta, 11 de novembro$/.test(dataDeHoje("pt", quarta)), dataDeHoje("pt", quarta));
confere("coluna: Hoje, Formação, Núcleo, Biblioteca, Meu percurso, A Frente", COLUNA_DA_ESCOLA.map((x) => x.chave).join() === "hoje,formacao,nucleo,biblioteca,percurso,frente");
confere("barra do celular: Hoje, Formação, Núcleo, Biblioteca, Eu", BARRA_DA_ESCOLA.map((x) => x.chave).join() === "hoje,formacao,nucleo,biblioteca,percurso");
confere("tela aberta", telaAberta("/escola") === "hoje" && telaAberta("/escola/formacao/x/y") === "formacao" && telaAberta("/escola/ao-vivo/123") === "aoVivo" && telaAberta("/escola/cursos") === null && telaAberta("/escolar") === null);
confere("públicas: o chamado, o manifesto e o entrar da Escola", PUBLICAS_DA_ESCOLA.join() === "/escola/militantes,/escola/manifesto,/escola/entrar" && publicaDaEscola("/escola/manifesto/") && !publicaDaEscola("/escola"));
const semPagina = TELAS_DA_FORMACAO.filter((x) => x.frente === "F1" && !fs.existsSync(path.join(raiz, "app", "[lang]", ...x.caminho.split("/").filter(Boolean), "page.tsx")));
confere("as telas da F1 têm página", semPagina.length === 0, semPagina.map((x) => x.caminho).join());

// ───────────────────────────── 4. Textos e contraste ─────────────────────────────
const chaves = (o, p = "") => (Array.isArray(o) ? [`${p}[${o.length}]`, ...o.flatMap((v, i) => chaves(v, `${p}[${i}]`))] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => chaves(v, p ? `${p}.${k}` : k)) : [p]);
const pt = JSON.parse(ler("i18n", "escola", "formacao-base", "pt.json"));
const chavesPt = chaves(pt).join("|");
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(ler("i18n", "escola", "formacao-base", `${l}.json`));
  confere(`textos ${l}: mesmas chaves do português`, chaves(t).join("|") === chavesPt);
  confere(`textos ${l}: nada vazio`, !JSON.stringify(t).includes('""'));
  confere(`textos ${l}: os marcadores {x} batem`, JSON.stringify(t).match(/\{[a-z]+\}/gi)?.sort().join() === JSON.stringify(pt).match(/\{[a-z]+\}/gi)?.sort().join());
}
confere("11 nomes de caderno", pt.hoje.cadernos.length === 11 && pt.porta.passos.length === 4 && pt.porta.degraus.length === 3);
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const PARES = [
  ["#F1EEE6", "#A3150F"], ["#EADFD5", "#A3150F"], ["#D9CCC2", "#A3150F"], ["#F2C94C", "#A3150F"], ["#CDBFB5", "#110C0A"],
  ["#AE9C90", "#1A1311"], ["#CDBFB5", "#1A1311"], ["#E63B2A", "#110C0A"], ["#E8604C", "#110C0A"], ["#FFFFFF", "#C21F16"],
  ["#FAE3A0", "#C21F16"], ["#110C0A", "#E8604C"], ["#110C0A", "#F2C94C"], ["#110C0A", "#EA7A24"], ["#110C0A", "#F1EEE6"], ["#EADFD5", "#1A1311"], ["#F1EEE6", "#3D2A24"],
];
for (const [f, b] of PARES) confere(`contraste AA ${f} sobre ${b}`, contraste(f, b) >= 4.5, contraste(f, b).toFixed(2));
const css = ler("styles", "escola-formacao.css");
confere("CSS: foco visível de 3 px ouro", /:focus-visible \{\s*outline: 3px solid var\(--ef-ouro\)/.test(css));
confere("CSS: o par fraco da prancha (#CDBFB5 na porta vermelha) não é usado", !/\.ef-porta-resto \{[^}]*#cdbfb5/i.test(css));

// ───────────────────────────── 5. Segurança no código ─────────────────────────────
const acesso = ler("lib", "escola", "acesso.ts");
confere("prévia só em desenvolvimento", /if \(process\.env\.NODE_ENV !== "development"\) return false;/.test(acesso) && /import\("\.\/previa"\)/.test(acesso) && !/^import .*previa/m.test(acesso));
confere("a militância não vai para o aparelho (nada de localStorage nem useStored de escrita)", !/localStorage|setItem\(KEYS/.test(acesso));
{
  const { contaDaSessao } = await import("../lib/escola/acesso.ts");
  const jwt = (sub, n) => `x.${Buffer.from(JSON.stringify({ sub, n })).toString("base64url")}.y`;
  const s1 = JSON.stringify({ access_token: jwt("u-1", 1), user: { id: "u-1" } });
  const s2 = JSON.stringify({ access_token: jwt("u-1", 2), user: { id: "u-1" } });
  confere("renovar o token não muda a chave da Escola (é o id da conta)", contaDaSessao(s1) === "u-1" && contaDaSessao(s1) === contaDaSessao(s2));
  confere("sem user na sessão: a chave sai do sub do token", contaDaSessao(JSON.stringify({ access_token: jwt("u-2", 1) })) === "u-2");
  confere("outra conta, outra chave; sem sessão, nenhuma", contaDaSessao(JSON.stringify({ user: { id: "u-3" } })) === "u-3" && contaDaSessao(null) === null);
  confere("mesma conta conferindo de novo: a Escola não desmonta (guarda a última resposta de militante)", /resposta\?\.conta === dono && resposta\.estado\.estado === "militante"/.test(acesso));
}
confere("escola_eu pelo nome do contrato", /rpc<EscolaEu>\("escola_eu"\)/.test(acesso));
confere("função inexistente vira vazio honesto ('ausente')", /banco_desatualizado"\) return \{ ok: false, motivo: "ausente" \}/.test(acesso));
const pastaHoje = path.join(raiz, "components", "escola", "hoje");
const hoje = fs.readdirSync(pastaHoje).map((n) => fs.readFileSync(path.join(pastaHoje, n), "utf8")).join("\n");
confere("Hoje: nenhuma chamada direta ao banco fora do contrato", !/\brpc\(/.test(hoje) && !/from "@\/lib\/backend"/.test(hoje));
confere("Hoje: nada no aparelho além do progresso de /trilhas", !/localStorage|sessionStorage|setItem/.test(hoje));
const pagina = ler("app", "[lang]", "escola", "page.tsx");
confere("a página Hoje só manda texto e aulas públicas", /cadernosDoQuadro\(lang/.test(pagina) && !/rpc|supabase|service/i.test(pagina));
const layout = ler("app", "[lang]", "escola", "layout.tsx");
confere("layout: recurso desligado dá 404 e a porta envolve tudo", /if \(!ligado\("escola"\)\) notFound\(\)/.test(layout) && /<PortaDaEscola[\s\S]*\{children\}[\s\S]*<\/PortaDaEscola>/.test(layout));
const dentro = ler("components", "painel", "casca", "Dentro.tsx");
confere("painel: uma entrada Escola, só para coordenação, carregada com dynamic", /id: "escola", nome: "Escola de Formação"[^\n]*mostra: can\(eu, "coordenacao", "vice"\)/.test(dentro) && /dynamic\(\(\) => import\("\.\.\/escola\/PainelDaEscola"\)/.test(dentro));
confere("o esboço do painel existe", fs.existsSync(path.join(raiz, "components", "painel", "escola", "PainelDaEscola.tsx")));

// 6. Sessão vencida volta à porta de quem não entrou (e não lê "ainda não está na militância"); a entrada do painel está no mapa.
confere("sessão vencida (entre_primeiro) vira sem-conta", /motivo === "entre_primeiro"\) definir\(\{ estado: "sem-conta" \}\)/.test(acesso));
confere("painel: escola no MAPA de estrutura.ts", /\n  escola: \{ espaco: "equipe", molde: "[a-z]+" \}/.test(ler("components", "painel", "estrutura.ts")));

// 7. Risco 1.1 do plano (children no pacote RSC): o HTML servido sem sessão não traz nada de militante. Só roda com um
//    servidor no ar: ESCOLA_URL=http://localhost:3110 npm run testar:escola-acesso. Sem ESCOLA_URL, avisa e segue.
const base = process.env.ESCOLA_URL;
const PROIBIDOS = [/Faísca/, /Jurema/, /Núcleo Zona Leste/, /Balanço da panfletagem/, /nome civil/i, /"codinome"/, /escola_nucleo|escola_recados|escola_pergunta/];
if (base) {
  for (const rota of ["/pt/escola", "/pt/escola/nucleo"]) {
    try {
      const r = await fetch(base + rota, { redirect: "manual", signal: AbortSignal.timeout(180_000) });
      const html = await r.text();
      if (r.status === 404 && rota !== "/pt/escola") {
        console.log(`escola-acesso: ${rota} ainda não existe (404), pulei.`);
        continue;
      }
      confere(`HTML sem sessão de ${rota}: responde`, r.status === 200, `status ${r.status}`);
      const achados = PROIBIDOS.filter((re) => re.test(html)).map(String);
      confere(`HTML sem sessão de ${rota}: nada de militante (pauta, núcleo, codinome, nome civil)`, achados.length === 0, achados.join(", "));
      console.log(`escola-acesso: ${rota} sem sessão -> ${r.status}, ${html.length} bytes, proibidos achados: ${achados.length}`);
    } catch (erro) {
      falhas.push(`HTML sem sessão de ${rota}: ${erro.message}`);
    }
  }
} else console.log("escola-acesso: sem ESCOLA_URL, a prova do HTML sem sessão não rodou.");

if (falhas.length) {
  console.error(`escola-acesso: ${certos} certos, ${falhas.length} falhas:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`escola-acesso: ${certos} conferências certas.`);
process.exit(0);
