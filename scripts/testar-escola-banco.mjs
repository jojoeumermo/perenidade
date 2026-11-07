// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o banco da Escola Revolucionária Lúcia Maria (supabase/migracoes/2026-11-escola.sql, no fim do install.sql) num Postgres de
// verdade dentro do Node, e prova que o que já existia não mudou (contar continua igual). Também confere as marcas do
// aparelho (lib/escola/contagem-local.ts) e a lista de alvos (scripts/alvos-de-contagem.mjs).
// Uso: npm run testar:escola-banco   (ou node --import ./scripts/carregar-ts.mjs scripts/testar-escola-banco.mjs)
// Depois, npm run testar:banco inteiro, para provar que nada antigo mudou.
import fs from "node:fs";
import { semPosteriores } from "./install-posteriores.mjs";
import os from "node:os";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";
import { alvosDaEscola, alvosDasAulas } from "./alvos-de-contagem.mjs";

const banco = await criarBanco();
const { rpc, dono, criarUsuario } = banco;
let certos = 0;
const falhas = [];

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

let ipSeq = 10;
/** Uma origem nova por chamada, para um teste não esbarrar no freio de outro. */
const anonNovo = () => ({ papel: "anon", ip: `198.51.100.${ipSeq++}` });
const anon = { papel: "anon", ip: "203.0.113.9" };
const servico = { papel: "service_role" };
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.50" });

const linhas = async (texto, valores = []) => (await dono(texto, valores)).rows;
const total = async (tipo, alvo) => (await linhas("select coalesce(sum(total), 0)::int as n from interno.contagens_escola where tipo = $1 and alvo = $2", [tipo, alvo]))[0].n;

// Contas: nascem sem função; a coordenação e a mediação são dadas direto no banco (como o SQL Editor faria).
const ids = {};
for (const chave of ["coord", "estudante", "outra", "med", "curiosa"]) {
  ids[chave] = await criarUsuario(`${chave}@escola.local`, chave);
  await rpc(como(ids[chave]), "eu");
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'mediacao') on conflict do nothing", [ids.med]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.coord]);

// ── Instalação ──
await espera("instalar de novo não quebra (o bloco é idempotente)", () => banco.instalarDeNovo());
await espera("a migração é o mesmo bloco do fim do install.sql", async () => {
  const migracao = fs.readFileSync(new URL("../supabase/migracoes/2026-11-escola.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n").trim();
  let install = semPosteriores(fs.readFileSync(new URL("../supabase/install.sql", import.meta.url), "utf8"));
  // Migrações que vieram depois da Escola (acertos por aula, Vale o Escrito) ficam depois do bloco dela, cada uma inteira,
  // na ordem do install.sql; tiram-se do fim, da última para a primeira.
  // A Rede v2 entrou depois, em 9 blocos (um por pacote), na ordem de docs/rede/V2.md.
  // As migrações do lote 5/6/8/9 (departamentos-termos, eixos-equipe, controles, backend-1, backend-2) vêm depois da Rede, inteiras.
  // As migrações datadas (AAAAMMDD-*.sql, de 6/11 em diante) já saíram com semPosteriores (scripts/install-posteriores.mjs).
  const lote = [...["departamentos-termos", "eixos-equipe", "controles", "backend-1", "backend-2", "progresso-qr", "alumia"].map((n) => `2026-11-${n}.sql`)];
  const rede = ["fundacao", "consertos", "perfil", "publicar", "conversa", "descoberta", "comunidades", "avisos", "moderacao", "integracao"].map((n) => `2026-11-rede-${n}.sql`);
  for (const depois of [...lote.reverse(), ...rede.reverse(), "2026-11-vale-o-escrito.sql", "2026-11-acertos.sql"]) {
    const bloco = fs.readFileSync(new URL(`../supabase/migracoes/${depois}`, import.meta.url), "utf8").replace(/\r\n/g, "\n").trim();
    if (!install.endsWith(bloco)) return false;
    install = install.slice(0, -bloco.length).trim();
  }
  return install.endsWith(migracao);
}, (ok) => ok === true);
await espera("as tabelas novas têm segurança por linha e nenhuma permissão direta", async () => linhas(`
  select c.relname, c.relrowsecurity, exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'interno' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated', 'PUBLIC')) as aberta
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'interno' and c.relname in ('contagens_escola', 'escola_alvos', 'turmas_curso', 'turmas_curso_salas', 'ouvidoria')`),
(r) => r.length === 5 && r.every((t) => t.relrowsecurity && !t.aberta));
await recusa("anônimo não lê a tabela de contagens da Escola", () => banco.exclusivo(async () => { await banco.pg.exec("set role anon"); try { return await banco.pg.query("select * from interno.contagens_escola"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");
await espera("as funções públicas novas fixam o search_path", async () => linhas(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('contar_escola', 'escola_contagens', 'escola_presenca_hoje', 'escola_alvos_definir', 'turma_curso', 'turma_curso_entrar',
    'turmas_curso_minhas', 'ouvidoria_enviar', 'ouvidoria_fila', 'ouvidoria_responder', 'ouvidoria_publicas')
    and p.prosecdef and exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')`), (r) => r.length === 11);

// ── contar_escola ──
await espera("tipo inválido não grava", async () => {
  await rpc(anonNovo(), "contar_escola", { p_tipo: "aula_abriu", p_alvo: "escola" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "qualquer", p_alvo: "escola" });
  return linhas("select count(*)::int as n from interno.contagens_escola");
}, (r) => r[0].n === 0);
await espera("alvo fora do formato não grava", async () => {
  await rpc(anonNovo(), "contar_escola", { p_tipo: "escola_presenca", p_alvo: "Escola Maiúscula" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "escola_presenca", p_alvo: "" });
  return linhas("select count(*)::int as n from interno.contagens_escola");
}, (r) => r[0].n === 0);
await espera("contar_escola responde sempre vazio", () => rpc(anonNovo(), "contar_escola", { p_tipo: "escola_presenca", p_alvo: "escola" }), (r) => r && Object.keys(r).length === 0);
await espera("o válido soma", async () => {
  await rpc(anonNovo(), "contar_escola", { p_tipo: "escola_presenca", p_alvo: "escola" });
  return total("escola_presenca", "escola");
}, (n) => n === 2);
await espera("o dia gravado é o de Brasília", () => linhas("select dia = (now() at time zone 'America/Sao_Paulo')::date as ok from interno.contagens_escola limit 1"), (r) => r[0].ok === true);
await espera("o limite por minuto funciona (5 por tipo e origem)", async () => {
  const mesma = { papel: "anon", ip: "192.0.2.77" };
  for (let i = 0; i < 8; i++) await rpc(mesma, "contar_escola", { p_tipo: "escola_turma", p_alvo: "curso-de-teste" });
  return total("escola_turma", "curso-de-teste");
}, (n) => n === 5);
await espera("o limite é por tipo: outro tipo da mesma origem ainda conta", async () => {
  await rpc({ papel: "anon", ip: "192.0.2.77" }, "contar_escola", { p_tipo: "escola_formatura", p_alvo: "curso-de-teste" });
  return total("escola_formatura", "curso-de-teste");
}, (n) => n === 1);
await espera("voto da assembleia soma no formato 'AAAA.S/trilha'", async () => {
  await rpc(anonNovo(), "contar_escola", { p_tipo: "assembleia_voto", p_alvo: "2026.2/historia-do-brasil" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "assembleia_voto", p_alvo: "historia-do-brasil" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "assembleia_voto", p_alvo: "2026.3/historia-do-brasil" });
  return linhas("select alvo from interno.contagens_escola where tipo = 'assembleia_voto'");
}, (r) => r.length === 1 && r[0].alvo === "2026.2/historia-do-brasil");
await espera("nenhuma linha de interno.limites tem o alvo na chave", async () => linhas(`
  select chave from interno.limites where chave like 'contar_escola%'
    and (chave like '%curso-de-teste%' or chave like '%historia-do-brasil%' or chave like '%2026.2%' or chave like '%:escola:%' or chave ~ ':escola$')`), (r) => r.length === 0);
await espera("as chaves de limite da Escola são só 'contar_escola' e 'contar_escola:<tipo>'", async () => linhas("select distinct split_part(chave, ':', 1) || ':' || split_part(chave, ':', 2) as k, (length(chave) - length(replace(chave, ':', ''))) as pontos from interno.limites where chave like 'contar_escola%'"),
  (r) => r.length > 0 && r.every((l) => (l.pontos === 1 && l.k.startsWith("contar_escola:")) || (l.pontos === 2 && /^contar_escola:(escola_presenca|escola_matricula|escola_formatura|escola_turma|assembleia_voto)$/.test(l.k))));

// Lista de alvos
await recusa("anônimo não define a lista de alvos", () => rpc(anon, "escola_alvos_definir", { p_grupo: "curso", p_alvos: ["x"] }), "permission denied");
await recusa("conta comum não define a lista de alvos", () => rpc(como(ids.coord), "escola_alvos_definir", { p_grupo: "curso", p_alvos: ["x"] }), "permission denied");
await recusa("grupo inventado é recusado", () => rpc(servico, "escola_alvos_definir", { p_grupo: "jornal", p_alvos: ["x"] }), "invalido:grupo");
await espera("o serviço define as listas", async () => {
  await rpc(servico, "escola_alvos_definir", { p_grupo: "curso", p_alvos: ["escola", "eletricista-residencial", "Inválido!"] });
  await rpc(servico, "escola_alvos_definir", { p_grupo: "curso-sensivel", p_alvos: ["ano-de-formacao-politica"] });
  return rpc(servico, "escola_alvos_definir", { p_grupo: "assembleia", p_alvos: ["2026.2/historia-do-brasil"] });
}, (r) => r.ok && r.total === 1);
await espera("alvo fora da lista é ignorado quando a lista existe", async () => {
  await rpc(anonNovo(), "contar_escola", { p_tipo: "escola_matricula", p_alvo: "curso-inventado" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "assembleia_voto", p_alvo: "2026.2/trilha-inventada" });
  return linhas("select count(*)::int as n from interno.contagens_escola where alvo in ('curso-inventado', '2026.2/trilha-inventada')");
}, (r) => r[0].n === 0);
await espera("alvo da lista (comum ou sensível) e o geral 'escola' contam", async () => {
  await rpc(anonNovo(), "contar_escola", { p_tipo: "escola_matricula", p_alvo: "eletricista-residencial" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "escola_matricula", p_alvo: "ano-de-formacao-politica" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "escola_matricula", p_alvo: "escola" });
  await rpc(anonNovo(), "contar_escola", { p_tipo: "assembleia_voto", p_alvo: "2026.2/historia-do-brasil" });
  return [await total("escola_matricula", "eletricista-residencial"), await total("escola_matricula", "ano-de-formacao-politica"), await total("escola_matricula", "escola"), await total("assembleia_voto", "2026.2/historia-do-brasil")];
}, (r) => r.join() === "1,1,1,2");

// ── escola_contagens ──
await espera("escola_contagens só traz agregados {alvo, total}, em ordem de alvo", async () => {
  await dono("insert into interno.contagens_escola (tipo, alvo, dia, total) values ('escola_matricula', 'aaa-primeiro', (now() at time zone 'America/Sao_Paulo')::date - 3, 50)");
  return rpc(anonNovo(), "escola_contagens", { p_tipo: "escola_matricula", p_dias: 30 });
}, (r) => Array.isArray(r) && r.length === 4 && r.every((l) => Object.keys(l).sort().join() === "alvo,total")
  && r.map((l) => l.alvo).join() === ["aaa-primeiro", "ano-de-formacao-politica", "eletricista-residencial", "escola"].join() && r[0].total === 50);
await espera("escola_contagens respeita a janela de dias", () => rpc(anonNovo(), "escola_contagens", { p_tipo: "escola_matricula", p_dias: 1 }), (r) => r.length === 3 && !r.some((l) => l.alvo === "aaa-primeiro"));
await espera("escola_contagens filtra pelo prefixo do semestre", async () => {
  await dono("insert into interno.contagens_escola (tipo, alvo, dia, total) values ('assembleia_voto', '2026.1/antiga', (now() at time zone 'America/Sao_Paulo')::date - 100, 9)");
  return rpc(anonNovo(), "escola_contagens", { p_tipo: "assembleia_voto", p_dias: 400, p_prefixo: "2026.2/" });
}, (r) => r.length === 1 && r[0].alvo === "2026.2/historia-do-brasil" && r[0].total === 2);
await espera("prefixo fora do formato não traz nada", () => rpc(anonNovo(), "escola_contagens", { p_tipo: "assembleia_voto", p_dias: 400, p_prefixo: "%" }), (r) => r.length === 0);

// ── escola_presenca_hoje e o contar antigo ──
await espera("escola_presenca_hoje lê o aula_abriu gravado por contar", async () => {
  await rpc(anonNovo(), "contar", { p_tipo: "aula_abriu", p_alvo: "trilha-teste/aula-um" });
  await rpc(anonNovo(), "contar", { p_tipo: "aula_abriu", p_alvo: "trilha-teste/aula-dois" });
  await rpc(anonNovo(), "contar", { p_tipo: "aula_terminou", p_alvo: "trilha-teste/aula-um" });
  return rpc(anonNovo(), "escola_presenca_hoje");
}, (r) => Number(r.aulas_hoje) === 2 && Number(r.aulas_terminadas_7d) === 1 && Number(r.matriculas_mes) >= 3 && Object.keys(r).sort().join() === "aulas_hoje,aulas_terminadas_7d,matriculas_mes");
await espera("o contar antigo continua aceitando 'aula_abriu'", () => linhas("select coalesce(sum(total), 0)::int as n from interno.contagens where tipo = 'aula_abriu'"), (r) => r[0].n === 2);
await espera("o contar antigo ignora 'escola_presenca' (não mudou)", async () => {
  const antes = await total("escola_presenca", "escola");
  await rpc(anonNovo(), "contar", { p_tipo: "escola_presenca", p_alvo: "escola" });
  const novas = await linhas("select count(*)::int as n from interno.contagens where tipo not in ('aula_abriu', 'aula_terminou')");
  return novas[0].n === 0 && (await total("escola_presenca", "escola")) === antes;
}, (ok) => ok === true);
await espera("o contar antigo ainda soma 'aula_ajudou' (usado pelo Isso ajudou)", async () => {
  await rpc(anonNovo(), "contar", { p_tipo: "aula_ajudou", p_alvo: "trilha-teste/aula-um" });
  return linhas("select total from interno.contagens where tipo = 'aula_ajudou'");
}, (r) => r.length === 1 && r[0].total === 1);

// ── Turmas por curso ──
const mesAgora = (await linhas("select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') as m"))[0].m;
const mesProximo = (await linhas("select to_char((now() at time zone 'America/Sao_Paulo') + interval '1 month', 'YYYY-MM') as m"))[0].m;
const mesLonge = (await linhas("select to_char((now() at time zone 'America/Sao_Paulo') + interval '3 months', 'YYYY-MM') as m"))[0].m;
const curso = "eletricista-residencial";
const sensivel = "ano-de-formacao-politica";
await espera("turma_curso sem conta: eu=false e sala nula", () => rpc(anon, "turma_curso", { p_mes: mesAgora, p_curso: curso }), (r) => r.eu === false && r.sala === null && r.inscritos === 0 && r.sensivel === false);
await recusa("turma_curso_entrar sem conta dá erro", () => rpc(anon, "turma_curso_entrar", { p_mes: mesAgora, p_curso: curso, p_entrar: true }), "entre_primeiro");
await espera("com conta, entra", () => rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: mesAgora, p_curso: curso, p_entrar: true }), (r) => r.eu === true && r.inscritos === 1 && /^InstitutoLucia-Curso-[0-9a-f]{10}$/.test(r.sala));
await espera("entrar de novo não duplica", () => rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: mesAgora, p_curso: curso, p_entrar: true }), (r) => r.inscritos === 1);
await espera("a sala aparece só para quem entrou", async () => {
  const fora = await rpc(como(ids.outra), "turma_curso", { p_mes: mesAgora, p_curso: curso });
  const semConta = await rpc(anon, "turma_curso", { p_mes: mesAgora, p_curso: curso });
  return fora.sala === null && fora.eu === false && fora.inscritos === 1 && semConta.sala === null;
}, (ok) => ok === true);
await espera("a turma do mês seguinte também aceita", () => rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: mesProximo, p_curso: curso, p_entrar: true }), (r) => r.eu === true);
await recusa("mês fora da janela é recusado", () => rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: mesLonge, p_curso: curso, p_entrar: true }), "invalido:mes");
await recusa("mês passado é recusado", () => rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: "2020-01", p_curso: curso, p_entrar: true }), "invalido:mes");
await recusa("curso fora da lista é recusado", () => rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: mesAgora, p_curso: "curso-inventado", p_entrar: true }), "invalido:curso");
await recusa("'escola' não é curso", () => rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: mesAgora, p_curso: "escola", p_entrar: true }), "invalido:curso");
await espera("turma_curso diz que o curso é sensível", () => rpc(anon, "turma_curso", { p_mes: mesAgora, p_curso: sensivel }), (r) => r.sensivel === true);
await recusa("curso sensível sem consentimento é recusado", () => rpc(como(ids.outra), "turma_curso_entrar", { p_mes: mesAgora, p_curso: sensivel, p_entrar: true }), "consentimento");
await recusa("curso sensível com consentimento falso é recusado", () => rpc(como(ids.outra), "turma_curso_entrar", { p_mes: mesAgora, p_curso: sensivel, p_entrar: true, p_consentimento: false }), "consentimento");
await espera("recusado sem consentimento: nenhuma linha gravada", () => linhas("select count(*)::int as n from interno.turmas_curso where curso = $1", [sensivel]), (r) => r[0].n === 0);
await espera("curso sensível com consentimento entra e o consentimento fica registrado", async () => {
  await rpc(como(ids.outra), "turma_curso_entrar", { p_mes: mesAgora, p_curso: sensivel, p_entrar: true, p_consentimento: true });
  return linhas("select consentiu_sensivel from interno.turmas_curso where curso = $1 and usuario = $2", [sensivel, ids.outra]);
}, (r) => r.length === 1 && r[0].consentiu_sensivel === true);
await espera("turmas_curso_minhas lista as turmas de quem está logado", () => rpc(como(ids.estudante), "turmas_curso_minhas"), (r) => r.length === 2 && r.every((t) => t.curso === curso) && r[0].mes === mesProximo);
await espera("turmas_curso_minhas sem conta é vazia", () => rpc(anon, "turmas_curso_minhas"), (r) => Array.isArray(r) && r.length === 0);
await espera("sair apaga a linha", async () => {
  const r = await rpc(como(ids.outra), "turma_curso_entrar", { p_mes: mesAgora, p_curso: sensivel, p_entrar: false });
  const sobrou = await linhas("select count(*)::int as n from interno.turmas_curso where usuario = $1", [ids.outra]);
  return r.eu === false && r.sala === null && sobrou[0].n === 0;
}, (ok) => ok === true);
await espera("sair de uma turma antiga também apaga (sair nunca é barrado pelo mês)", async () => {
  await dono("insert into interno.turmas_curso (mes, curso, usuario) values ('2025-01', $1, $2)", [curso, ids.estudante]);
  await rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: "2025-01", p_curso: curso, p_entrar: false });
  return linhas("select count(*)::int as n from interno.turmas_curso where mes = '2025-01'");
}, (r) => r[0].n === 0);
await espera("com o site pausado, quem não é da equipe não entra, mas sai", async () => {
  await dono("insert into interno.configuracoes (chave, valor) values ('site', '{\"pausa\": true}') on conflict (chave) do update set valor = interno.configuracoes.valor || '{\"pausa\": true}'::jsonb");
  let barrou = false;
  try { await rpc(como(ids.curiosa), "turma_curso_entrar", { p_mes: mesAgora, p_curso: curso, p_entrar: true }); } catch (e) { barrou = String(e.message).includes("envios_pausados"); }
  const saiu = await rpc(como(ids.estudante), "turma_curso_entrar", { p_mes: mesProximo, p_curso: curso, p_entrar: false });
  await dono("update interno.configuracoes set valor = valor || '{\"pausa\": false}'::jsonb where chave = 'site'");
  return barrou && saiu.eu === false;
}, (ok) => ok === true);
await espera("com a área 'estudo' interditada, não entra", async () => {
  await dono("insert into interno.configuracoes (chave, valor) values ('interdicao', '{\"areas\": [\"estudo\"]}') on conflict (chave) do update set valor = '{\"areas\": [\"estudo\"]}'::jsonb");
  let barrou = false;
  try { await rpc(como(ids.curiosa), "turma_curso_entrar", { p_mes: mesAgora, p_curso: curso, p_entrar: true }); } catch (e) { barrou = String(e.message).includes("area_interditada"); }
  await dono("update interno.configuracoes set valor = '{}'::jsonb where chave = 'interdicao'");
  return barrou;
}, (ok) => ok === true);

// ── Ouvidoria ──
const mensagem = (extra = {}) => ({ sobre: "aula", caminho: "/pt/trilhas/trilha-teste/aula-um", texto: "A explicação da segunda parte ficou confusa para mim.", contato: "eu@exemplo.org", ...extra });
let protocolo = "";
await espera("ouvidoria_enviar sem conta funciona e devolve o protocolo", async () => {
  const r = await rpc(anonNovo(), "ouvidoria_enviar", { p: mensagem() });
  protocolo = r.protocolo;
  return r;
}, (r) => r.ok === true && /^[0-9a-f]{8}$/.test(r.protocolo));
await espera("a ouvidoria não grava endereço de rede na tabela", () => linhas("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'ouvidoria'"),
  (r) => r.length > 0 && !r.some((c) => /origem|ip|endereco|usuario|autor/.test(c.column_name)));
await espera("a isca não grava", async () => {
  const antes = (await linhas("select count(*)::int as n from interno.ouvidoria"))[0].n;
  const r = await rpc(anonNovo(), "ouvidoria_enviar", { p: mensagem({ site: "https://spam.example" }) });
  const depois = (await linhas("select count(*)::int as n from interno.ouvidoria"))[0].n;
  return r.ok === true && !r.protocolo && antes === depois;
}, (ok) => ok === true);
await recusa("texto curto demais é recusado", () => rpc(anonNovo(), "ouvidoria_enviar", { p: mensagem({ texto: "curto" }) }), "invalido:texto");
await recusa("assunto inventado é recusado", () => rpc(anonNovo(), "ouvidoria_enviar", { p: mensagem({ sobre: "politica" }) }), "invalido:sobre");
await recusa("caminho fora do formato é recusado", () => rpc(anonNovo(), "ouvidoria_enviar", { p: mensagem({ caminho: "https://fora.example" }) }), "invalido:caminho");
await recusa("o freio da ouvidoria segura a quinta mensagem da mesma origem na hora", async () => {
  const mesma = { papel: "anon", ip: "192.0.2.200" };
  for (let i = 0; i < 4; i++) await rpc(mesma, "ouvidoria_enviar", { p: mensagem({ contato: "" }) });
  return rpc(mesma, "ouvidoria_enviar", { p: mensagem({ contato: "" }) });
}, "muitos_pedidos");
await recusa("a fila recusa quem não tem conta", () => rpc(anon, "ouvidoria_fila"), "entre_primeiro");
await recusa("a fila recusa pessoa sem papel", () => rpc(como(ids.estudante), "ouvidoria_fila"), "sem_permissao");
let idDaMensagem = "";
await espera("a fila aceita a mediação e mostra texto e contato", async () => {
  const fila = await rpc(como(ids.med), "ouvidoria_fila");
  idDaMensagem = fila.find((m) => m.protocolo === protocolo)?.id ?? "";
  return fila;
}, (r) => r.length >= 1 && r.some((m) => m.protocolo === protocolo && m.contato === "eu@exemplo.org" && m.texto.includes("segunda parte")));
await espera("a fila aceita a coordenação", () => rpc(como(ids.coord), "ouvidoria_fila"), (r) => Array.isArray(r) && r.length >= 1);
await recusa("pessoa sem papel não responde", () => rpc(como(ids.estudante), "ouvidoria_responder", { p_id: idDaMensagem, p_status: "respondida", p_resumo: "x", p_resposta: "y", p_publicar: true }), "sem_permissao");
await recusa("publicar exige resumo e resposta", () => rpc(como(ids.med), "ouvidoria_responder", { p_id: idDaMensagem, p_status: "respondida", p_resumo: "", p_resposta: "Refizemos a aula.", p_publicar: true }), "invalido:publicar");
await recusa("situação inventada é recusada", () => rpc(como(ids.med), "ouvidoria_responder", { p_id: idDaMensagem, p_status: "apagada", p_resumo: "", p_resposta: "", p_publicar: false }), "invalido:status");
await espera("antes de responder, nada é público", () => rpc(anon, "ouvidoria_publicas"), (r) => Array.isArray(r) && r.length === 0);
await espera("a mediação responde e publica", () => rpc(como(ids.med), "ouvidoria_responder", {
  p_id: idDaMensagem, p_status: "respondida", p_resumo: "Uma pessoa achou confusa a segunda parte de uma aula.", p_resposta: "A segunda parte foi reescrita com um exemplo novo.", p_publicar: true,
}), (r) => r.ok === true);
await espera("publicas nunca expõe texto nem contato", () => rpc(anon, "ouvidoria_publicas"), (r) => r.length === 1
  && Object.keys(r[0]).sort().join() === "protocolo,respondida_em,resposta_publica,resumo_publico,sobre"
  && !JSON.stringify(r).includes("eu@exemplo.org") && !JSON.stringify(r).includes("ficou confusa para mim") && !JSON.stringify(r).includes("/pt/trilhas"));
await espera("respondida mas não publicada não aparece", async () => {
  const outra = (await rpc(como(ids.med), "ouvidoria_fila")).find((m) => m.id !== idDaMensagem);
  await rpc(como(ids.med), "ouvidoria_responder", { p_id: outra.id, p_status: "respondida", p_resumo: "Resumo.", p_resposta: "Resposta.", p_publicar: false });
  return rpc(anon, "ouvidoria_publicas");
}, (r) => r.length === 1);
await espera("a faxina de um ano apaga só texto e contato", async () => {
  await dono("update interno.ouvidoria set criado_em = now() - interval '400 days' where id = $1", [idDaMensagem]);
  await dono("update interno.ouvidoria set texto = '', contato = '' where criado_em < now() - interval '365 days' and (texto <> '' or contato <> '')");
  const r = await linhas("select texto, contato, resumo_publico from interno.ouvidoria where id = $1", [idDaMensagem]);
  return r[0];
}, (r) => r.texto === "" && r.contato === "" && r.resumo_publico !== "");
await espera("com a ouvidoria faxinada, a resposta pública continua", () => rpc(anon, "ouvidoria_publicas"), (r) => r.length === 1);

// ── Tranca final, como em testar-banco ──
await espera("nenhuma função interna executável por anon ou authenticated", () => linhas("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r where n.nspname = 'interno' and r.rolname in ('anon', 'authenticated') and has_function_privilege(r.oid, p.oid, 'execute')"), (r) => r.length === 0);
await espera("nenhuma tabela no esquema público", () => linhas("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p', 'f', 'S')"), (r) => r.length === 0);

// ── Marcas do aparelho (lib/escola/contagem-local.ts) ──
const local = await import("../lib/escola/contagem-local.ts").catch((e) => ({ erro: e }));
if ("erro" in local) {
  falhas.push(`contagem-local: não carregou (${local.erro.message}); rode com --import ./scripts/carregar-ts.mjs`);
} else {
  const { deveContar, marcar, chaveDoPeriodo, MAXIMO_DE_MARCAS } = local;
  const dia = new Date(2026, 10, 3, 10, 0, 0);
  await espera("chave do período: dia, mês e semestre", () => [chaveDoPeriodo("dia", dia), chaveDoPeriodo("mes", dia), chaveDoPeriodo("semestre", dia), chaveDoPeriodo("semestre", new Date(2026, 5, 30))],
    (r) => r.join() === "d2026-11-03,m2026-11,s2026.2,s2026.1");
  await espera("sem marca, deve contar; com marca do mesmo período, não", () => {
    const m = marcar([], "escola_presenca", "escola", "dia", dia);
    return [deveContar([], "escola_presenca", "escola", "dia", dia), deveContar(m, "escola_presenca", "escola", "dia", dia), deveContar(m, "escola_presenca", "escola", "dia", new Date(2026, 10, 4))];
  }, (r) => r.join() === "true,false,true");
  await espera("marca de um tipo não vale para outro, nem para outro alvo", () => {
    const m = marcar([], "escola_matricula", "curso-a", "semestre", dia);
    return [deveContar(m, "escola_formatura", "curso-a", "semestre", dia), deveContar(m, "escola_matricula", "curso-b", "semestre", dia), deveContar(m, "escola_matricula", "curso-a", "semestre", new Date(2026, 11, 20))];
  }, (r) => r.join() === "true,true,false");
  await espera("tipo ou alvo inválido nunca conta", () => [deveContar([], "outro", "escola", "dia", dia), deveContar([], "escola_presenca", "Com Espaço", "dia", dia)], (r) => r.join() === "false,false");
  await espera("as velhas saem: marca de dia antigo some na marca seguinte", () => {
    const m1 = marcar([], "escola_presenca", "escola", "dia", new Date(2026, 10, 1));
    const m2 = marcar(m1, "escola_presenca", "escola", "dia", dia);
    return m2;
  }, (r) => r.length === 1 && r[0].endsWith("d2026-11-03"));
  await espera(`no máximo ${MAXIMO_DE_MARCAS} marcas`, () => {
    let m = [];
    for (let i = 0; i < 400; i++) m = marcar(m, "escola_matricula", `curso-${i}`, "semestre", dia);
    return m;
  }, (r) => r.length === MAXIMO_DE_MARCAS && r.at(-1).includes("curso-399"));
  await espera("marcas estragadas viram lista vazia, sem quebrar", () => marcar("lixo", "escola_presenca", "escola", "dia", dia), (r) => r.length === 1);
}

// ── Lista de alvos da Escola (scripts/alvos-de-contagem.mjs) ──
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "escola-alvos-"));
try {
  await espera("sem a pasta da Escola, nenhum grupo é mandado", () => alvosDaEscola(temp), (r) => Object.keys(r).length === 0);
  fs.mkdirSync(path.join(temp, "escola", "cursos"), { recursive: true });
  fs.writeFileSync(path.join(temp, "escola", "cursos", "eletricista-residencial.json"), JSON.stringify({ slug: "eletricista-residencial" }));
  fs.writeFileSync(path.join(temp, "escola", "cursos", "ano-de-formacao-politica.json"), JSON.stringify({ slug: "ano-de-formacao-politica", sensivel: true }));
  fs.writeFileSync(path.join(temp, "escola", "cursos", "quebrado.json"), "{ não é json");
  fs.writeFileSync(path.join(temp, "escola", "assembleia.json"), JSON.stringify({ semestre: "2026.2", candidatas: ["historia-do-brasil", "quimica-basica"] }));
  await espera("cursos, cursos sensíveis e pautas da assembleia", () => alvosDaEscola(temp), (r) =>
    r.curso.join() === "eletricista-residencial,escola" && r["curso-sensivel"].join() === "ano-de-formacao-politica" && r.assembleia.join() === "2026.2/historia-do-brasil,2026.2/quimica-basica");
  fs.mkdirSync(path.join(temp, "trilhas", "trilha-x"), { recursive: true });
  fs.writeFileSync(path.join(temp, "trilhas", "trilha-x", "_trilha.md"), "x");
  fs.writeFileSync(path.join(temp, "trilhas", "trilha-x", "01-aula.md"), "x");
  fs.writeFileSync(path.join(temp, "trilhas", "trilha-x", "01-aula.facil.md"), "x");
  fs.writeFileSync(path.join(temp, "trilhas", "trilha-x", "01-aula.en.md"), "x");
  await espera("as versões fáceis ('*.facil.md') não viram alvo", () => alvosDasAulas(temp), (r) => r.join() === "trilha-x/aula");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
