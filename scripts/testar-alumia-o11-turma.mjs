// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova turma e agenda da onda 11 (supabase/migracoes/20261117-alumia-o11-turma.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · turma: entra só com o código, até 12 pessoas; cada pessoa marca só a própria semana; a turma vê só o total, e só a partir
//     de 3; nenhuma função devolve quem marcou, quem não marcou ou quem está na turma; a semana fechada vira só o número e a
//     marca de cada pessoa some; o aviso da semana só sai com 3 ou mais;
//   · agenda: só coordenação, vice e mediação escrevem; sem fonte oficial não entra; a mesma data não duplica; assinar e deixar
//     de assinar; os avisos de 7 dias e de 1 dia, uma vez cada; data que muda ou sai avisa quem assinou; a assinatura some
//     depois do dia;
//   · monitoria: só quem foi nomeado e aceitou oferece; quem estuda não vê o monitor nem quantas vagas sobram; ao marcar, os dois
//     são avisados e só os dois se veem; sem vaga, recusado; o lembrete de 1 hora, uma vez; um dia depois, tudo some;
//   · as listas e os limites da tela iguais aos do banco, os textos nas seis línguas e o .ics.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-turma.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { codigoDoTexto, fileiraDeSemanas, LIMITES_DA_TURMA, limparCodigo, segundaDe } from "../components/rede/estudo/turma/regras.ts";
import {
  datasDoSite, diasEntre, DISCIPLINAS, enderecoDaSala, fonteValida, icsDasDatas, icsDaMonitoria, instanteDeBrasilia, LIMITES_DA_AGENDA,
  LIMITES_DA_MONITORIA, salaAberta,
} from "../components/rede/estudo/agenda/regras.ts";

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
const sql = ler("supabase/migracoes/20261117-alumia-o11-turma.sql");
const PURAS = /alumia_o11t_(numero|total|alvo|semana|hoje|disciplinas|disciplina_nome|quando)\(/;
const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
ok("toda função é security definer com search_path fixo (menos as puras, que não leem tabela)", funcoes.length >= 35
  && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || PURAS.test(f.split("\n")[0])));
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 9
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("não mexe na versão da Alumia nem no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-400)));
ok("nenhuma função pública grava ou devolve lugar (GPS) nem perfil de comportamento", !/latitude|longitude|geoloc|comportamento/i.test(sql.replace(/--.*$/gm, "")));
ok("a lista de disciplinas da tela é a do banco (regra da tabela e função)", (() => {
  const lista = DISCIPLINAS.map((d) => `'${d}'`).join(", ");
  return sql.includes(`disciplinas <@ array[${lista}]::text[]`) && sql.includes(`disciplina in (${lista})`) && sql.includes(`select array[${lista}]::text[]`);
})());
ok("os limites da turma na tela são os do banco", sql.includes(`char_length(nome) between ${LIMITES_DA_TURMA.nomeMin} and ${LIMITES_DA_TURMA.nome}`)
  && sql.includes(`char_length(meta) between ${LIMITES_DA_TURMA.metaMin} and ${LIMITES_DA_TURMA.meta}`)
  && sql.includes(`>= ${LIMITES_DA_TURMA.pessoas} then perform interno.erro('turma_cheia')`)
  && sql.includes(`>= ${LIMITES_DA_TURMA.turmasPorPessoa} then perform interno.erro('limite_de_turmas')`)
  && sql.includes(`limit ${LIMITES_DA_TURMA.semanas}) s))`));
ok("os limites da agenda na tela são os do banco", sql.includes(`char_length(exame) between ${LIMITES_DA_AGENDA.exameMin} and ${LIMITES_DA_AGENDA.exame}`)
  && sql.includes(`char_length(etapa) between ${LIMITES_DA_AGENDA.etapaMin} and ${LIMITES_DA_AGENDA.etapa}`)
  && sql.includes(`char_length(orgao) between ${LIMITES_DA_AGENDA.orgaoMin} and ${LIMITES_DA_AGENDA.orgao}`)
  && sql.includes(`char_length(fonte) <= ${LIMITES_DA_AGENDA.fonte}`) && sql.includes(`> ${LIMITES_DA_AGENDA.assinaturas} then perform interno.erro('limite_de_assinaturas')`));
ok("os limites da monitoria na tela são os do banco", sql.includes(`duracao between ${LIMITES_DA_MONITORIA.duracaoMin} and ${LIMITES_DA_MONITORIA.duracao}`)
  && sql.includes(`vagas between ${LIMITES_DA_MONITORIA.vagasMin} and ${LIMITES_DA_MONITORIA.vagas}`) && sql.includes(`char_length(nota) <= ${LIMITES_DA_MONITORIA.nota}`)
  && sql.includes(`char_length(duvida) <= ${LIMITES_DA_MONITORIA.duvida}`) && sql.includes(`>= ${LIMITES_DA_MONITORIA.marcasAFrente} then\n    perform interno.erro('limite_de_marcas')`)
  && sql.includes(`>= ${LIMITES_DA_MONITORIA.horarios} then perform interno.erro('limite_de_horarios')`)
  && sql.includes(`now() + interval '${LIMITES_DA_MONITORIA.diasAFrente} days'`) && sql.includes(`now() + interval '${LIMITES_DA_MONITORIA.horasAntesMin} hour'`));

// ═══════════════════ 0b. As contas da tela ═══════════════════
ok("o código limpo como o banco procura", limparCodigo("  AB12cd34EF ") === "ab12cd34ef" && limparCodigo("curto") === "" && limparCodigo("ab12-cd34-ef") === "ab12cd34ef");
ok("o código sai do endereço colado", codigoDoTexto("https://x/pt/alumia/turmas?codigo=ab12cd34ef") === "ab12cd34ef" && codigoDoTexto("ab12cd34ef") === "ab12cd34ef");
ok("a segunda-feira de Brasília", segundaDe(Date.UTC(2026, 10, 16, 2, 0)) === "2026-11-09" && segundaDe(Date.UTC(2026, 10, 16, 4, 0)) === "2026-11-16"
  && segundaDe(Date.UTC(2026, 10, 22, 23, 0)) === "2026-11-16");
ok("a fileira do mosaico: 8 semanas fechadas, abaixo de 3 sem número", (() => {
  const f = fileiraDeSemanas([{ semana: "2026-11-09", total: 4 }, { semana: "2026-11-02", total: 2 }, { semana: "2026-10-26", total: null }], "2026-11-16");
  return f.length === 8 && f[7].semana === "2026-11-09" && f[7].total === 4 && f[6].total === null && f[5].total === null && f[0].semana === "2026-09-21";
})());
ok("a fonte só https completo", fonteValida("https://www.gov.br/inep/x") && !fonteValida("http://www.gov.br/inep") && !fonteValida("https://a b") && !fonteValida(`https://${"a".repeat(600)}`));
ok("dias entre duas datas", diasEntre("2026-11-13", "2026-11-15") === 2 && diasEntre("2026-11-13", "2026-11-13") === 0 && diasEntre("2026-11-13", "2026-12-01") === 18);
ok("as datas do ENEM do site entram com fonte e a partir de hoje", (() => {
  const d = datasDoSite("2026-11-13");
  return d.length >= 1 && d.every((x) => x.dia >= "2026-11-13" && fonteValida(x.fonte) && /^ENEM \d{4}$/.test(x.exame) && /^\d{4}-\d{2}-\d{2}$/.test(x.conferido_em));
})());
ok("Brasília é UTC−3", instanteDeBrasilia("2026-11-15", "13:30").toISOString() === "2026-11-15T16:30:00.000Z");
ok("o .ics das datas: dia inteiro, hora certa, lembrete e linhas dobradas", (() => {
  const ics = icsDasDatas([
    { id: "a1", exame: "ENEM 2026", etapa: "Segundo dia de provas", dia: "2026-11-15", hora: null, orgao: "Inep", fonte: "https://www.gov.br/inep/pt-br/" + "x".repeat(90), conferido_em: "2026-11-02", assinada: true },
    { id: "b2", exame: "Vestibular", etapa: "Primeira fase; manhã", dia: "2026-12-06", hora: "13:00", orgao: "Banca", fonte: "https://exemplo.org/edital", conferido_em: "2026-11-01", assinada: false },
  ], "https://institutolucia.org/pt/alumia/agenda", new Date(Date.UTC(2026, 10, 13)));
  return ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.includes("DTSTART;VALUE=DATE:20261115\r\nDTEND;VALUE=DATE:20261116") && ics.includes("DTSTART:20261206T160000Z")
    && ics.includes("TRIGGER:-P1D") && ics.includes("Primeira fase\\; manhã") && ics.split("\r\n").every((l) => l.length <= 75) && (ics.match(/BEGIN:VEVENT/g) ?? []).length === 2;
})());
ok("o .ics da monitoria leva só a disciplina, com lembrete de 1 hora", (() => {
  const ics = icsDaMonitoria({ id: "j1", inicio: "2026-11-20T22:00:00.000Z", duracao: 45 }, "Monitoria de Matemática", "https://institutolucia.org/pt/alumia/agenda?aba=monitoria");
  return ics.includes("DTSTART:20261120T220000Z") && ics.includes("DTEND:20261120T224500Z") && ics.includes("TRIGGER:-PT60M") && !/@[a-z]/.test(ics.replace(/@institutolucia\.org/g, ""));
})());
ok("a sala: aula ao vivo do site ou a conversa da Alumia", enderecoDaSala("pt", "aula", "6f1c2b8e-1a2b-4c3d-8e9f-001122334455", "ana") === "/pt/ao-vivo/sala?aula=6f1c2b8e-1a2b-4c3d-8e9f-001122334455"
  && enderecoDaSala("pt", "conversa", null, "ana_luta") === "/pt/alumia/conversas?com=ana_luta" && enderecoDaSala("en", "aula", null, null) === "/en/alumia/conversas");
ok("a sala abre 15 minutos antes e fecha no fim", (() => {
  const j = { inicio: "2026-11-20T22:00:00.000Z", duracao: 45 };
  const t = Date.parse(j.inicio);
  return !salaAberta(j, t - 16 * 60_000) && salaAberta(j, t - 14 * 60_000) && salaAberta(j, t + 44 * 60_000) && !salaAberta(j, t + 46 * 60_000);
})());

// Os textos: as seis línguas com as mesmas chaves, listas do mesmo tamanho e os mesmos marcadores {x}; nenhuma palavra proibida.
for (const pasta of ["turma", "agenda"]) {
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler(`i18n/rede/${pasta}/pt.json`));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/${pasta}/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`${pasta}/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok(`${pasta}: nenhum texto vazio no pt`, ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok(`${pasta}: os textos não usam "diploma", "universidade" nem "algoritmo"`, !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt)));
  ok(`${pasta}: nenhum texto fala de "atrasado" nem de "quem não"`, !/atrasad|quem não cumpriu|quem faltou/i.test(JSON.stringify(pt)));
}
{
  const ta = JSON.parse(ler("i18n/rede/agenda/pt.json"));
  ok("toda disciplina tem nome", DISCIPLINAS.every((d) => typeof ta.disciplinas[d] === "string"));
  const tt = JSON.parse(ler("i18n/rede/turma/pt.json"));
  ok("todo erro do banco tem texto", ["nao_encontrado", "turma_cheia", "limite_de_turmas", "sem_permissao", "muitos_pedidos", "generico"].every((c) => typeof tt.erros[c] === "string")
    && ["sem_vaga", "ja_comecou", "ja_marcada", "limite_de_marcas", "limite_de_horarios", "limite_de_assinaturas", "invalido:fonte", "invalido:dia", "invalido:inicio", "invalido:aula", "invalido:pessoa", "sem_permissao", "nao_encontrado", "muitos_pedidos", "generico"].every((c) => typeof ta.erros[c] === "string"));
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
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
               and (p.proname like 'alumia\\_turma\\_%' or p.proname like 'alumia\\_agenda\\_%' or p.proname like 'alumia\\_monitoria%')`)).rows,
(rs) => rs.length === 21 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o11t\\_%'`)).rows,
(rs) => rs.length >= 19 && rs.every((r) => !r.a && !r.b));
await espera("as funções públicas não abrem para quem não tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and (p.proname like 'alumia\\_turma\\_%' or p.proname like 'alumia\\_agenda\\_%' or p.proname like 'alumia\\_monitoria%')`)).rows,
(rs) => rs.length === 21 && rs.every((r) => !r.a));
await espera("nenhuma função pública devolve as pessoas da turma, quem assinou uma data ou quem marcou (fora do próprio horário)", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
               and (p.proname like 'alumia\\_turma\\_%' or p.proname like 'alumia\\_agenda\\_%') and p.proname ~ '(quem|pessoas|membros|assinantes|lista)'`)).rows,
(rs) => rs.length === 0);

const P = {};
const NOMES = ["coord", "media", "monitor", "monitor2", "a1", "a2", "a3", "a4", "a5", "fora", "bloq"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o11.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.media]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o11_${nome}`]);
}
const C = (n) => como(P[n]);

// ═══════════════════ 2. Turma ═══════════════════
await recusa("sem conta não abre a turma", () => rpc(visitante, "alumia_turma_minhas"), "");
await recusa("nome curto", () => rpc(C("a1"), "alumia_turma_criar", { p_nome: "X", p_meta: "1 redação por semana" }), "invalido:nome");
await recusa("combinado curto", () => rpc(C("a1"), "alumia_turma_criar", { p_nome: "Turma de redação", p_meta: "x" }), "invalido:meta");
const turma = await espera("a1 cria a turma e cuida dela", () => rpc(C("a1"), "alumia_turma_criar", { p_nome: "Redação de sábado", p_meta: "1 redação por semana" }),
  (t) => t.cuida === true && /^[a-z0-9]{10}$/.test(t.codigo) && t.pessoas === null && t.total === null && t.marquei === false && Array.isArray(t.semanas));
const T = turma?.id;
await recusa("código errado não diz nada", () => rpc(C("a2"), "alumia_turma_entrar", { p_codigo: "zzzzzzzzzz" }), "nao_encontrado");
await recusa("código fora do formato", () => rpc(C("a2"), "alumia_turma_entrar", { p_codigo: "abc" }), "nao_encontrado");
await espera("a2 entra pelo código (com maiúsculas e espaços)", () => rpc(C("a2"), "alumia_turma_entrar", { p_codigo: ` ${turma.codigo.toUpperCase()} ` }), (t) => t.id === T && t.cuida === false && t.pessoas === null);
await espera("entrar de novo não duplica", () => rpc(C("a2"), "alumia_turma_entrar", { p_codigo: turma.codigo }), (t) => t.id === T);
await recusa("quem não está na turma não marca", () => rpc(C("fora"), "alumia_turma_marcar", { p_turma: T, p_sim: true }), "nao_encontrado");
await espera("a1 marca a semana: abaixo de 3, sem número", () => rpc(C("a1"), "alumia_turma_marcar", { p_turma: T, p_sim: true }), (t) => t.marquei === true && t.total === null);
await espera("a2 marca: ainda abaixo de 3", () => rpc(C("a2"), "alumia_turma_marcar", { p_turma: T, p_sim: true }), (t) => t.total === null && t.pessoas === null);
await espera("a3 entra: três pessoas, o número aparece", () => rpc(C("a3"), "alumia_turma_entrar", { p_codigo: turma.codigo }), (t) => t.pessoas === 3 && t.total === null && t.marquei === false);
await espera("a3 marca: a marca nova não muda o número na hora (marco de 15 minutos)", () => rpc(C("a3"), "alumia_turma_marcar", { p_turma: T, p_sim: true }), (t) => t.total === null && t.marquei === true);
/** O marco seguinte chega: as marcas (e os intervalos de quem desmarcou) ficam de antes dele. */
const passarOMarco = async () => {
  await dono("update interno.alumia_turma_marcas set marcado_em = now() - interval '1 hour' where turma = $1", [T]);
  await dono("update interno.rede_contagem_saidas set entrou_em = entrou_em - interval '1 hour', saiu_em = now() - interval '1 hour' where alvo = interno.alumia_o11t_alvo($1, interno.alumia_o11t_semana(now()))", [T]);
};
await passarOMarco();
await espera("turma de 3 com as 3 marcas: sem número ('todo mundo marcou' diria quem foi)", () => rpc(C("a1"), "alumia_turma_minhas"), (r) => r.itens[0].pessoas === 3 && r.itens[0].total === null);
for (let i = 0; i < 3; i++) {
  const u = await criarUsuario(`turma${i}@o11.local`, `Turma ${i}`);
  await zerar();
  await rpc(como(u), "alumia_turma_entrar", { p_codigo: turma.codigo });
}
await espera("seis pessoas, três marcas: o total 3 aparece para todo mundo", () => rpc(C("a3"), "alumia_turma_minhas"), (r) => r.itens[0].pessoas === 6 && r.itens[0].total === 3);
await espera("a1 vê o total 3 e só a própria marca", () => rpc(C("a1"), "alumia_turma_minhas"), (r) => r.itens.length === 1 && r.itens[0].total === 3 && r.itens[0].marquei === true
  && !JSON.stringify(r).includes(P.a2) && !JSON.stringify(r).includes("o11_a2") && !JSON.stringify(r).includes("Codinome"));
await espera("marcar duas vezes não conta duas", () => rpc(C("a3"), "alumia_turma_marcar", { p_turma: T, p_sim: true }), (t) => t.total === 3);
await espera("desmarcar não muda o número na hora (quem saiu conta até o marco seguinte)", () => rpc(C("a3"), "alumia_turma_marcar", { p_turma: T, p_sim: false }), (t) => t.total === 3 && t.marquei === false);
await espera("o intervalo de quem desmarcou não guarda a pessoa", () => dono("select count(*)::int as n from interno.rede_contagem_saidas where alvo = interno.alumia_o11t_alvo($1, interno.alumia_o11t_semana(now()))", [T]), (r) => r.rows[0].n === 1);
await passarOMarco();
await espera("no marco seguinte: volta a menos de 3, sem número", () => rpc(C("a3"), "alumia_turma_minhas"), (r) => r.itens[0].total === null && r.itens[0].marquei === false);
await rpc(C("a3"), "alumia_turma_marcar", { p_turma: T, p_sim: true });
await passarOMarco();
await recusa("quem não cuida não troca o combinado", () => rpc(C("a2"), "alumia_turma_editar", { p_turma: T, p_nome: "Outra", p_meta: "2 redações" }), "sem_permissao");
await recusa("quem não cuida não troca o código", () => rpc(C("a2"), "alumia_turma_novo_codigo", { p_turma: T }), "sem_permissao");
await espera("quem cuida troca o combinado e a turma é avisada", async () => {
  await rpc(C("a1"), "alumia_turma_editar", { p_turma: T, p_nome: "Redação de sábado", p_meta: "2 redações por semana" });
  return (await dono("select para from interno.avisos where texto like '%combinado novo: 2 redações por semana%'")).rows.map((r) => r.para);
}, (ps) => ps.length === 5 && ps.includes(P.a2) && ps.includes(P.a3) && !ps.includes(P.a1));
const velho = turma.codigo;
const novo = await espera("código novo: o antigo deixa de valer", () => rpc(C("a1"), "alumia_turma_novo_codigo", { p_turma: T }), (t) => t.codigo !== velho);
await zerar();
await recusa("o código antigo não entra mais", () => rpc(C("a4"), "alumia_turma_entrar", { p_codigo: velho }), "nao_encontrado");

// Fechar a semana: a marca vira só o número, e o aviso sai só com 3 ou mais.
await espera("a semana passada (com 3 marcas) fecha: o número fica, as marcas somem, a turma é avisada", async () => {
  await dono("update interno.alumia_turma_marcas set semana = semana - 7 where turma = $1", [T]);
  const n = (await dono("select interno.alumia_o11t_fechar_semanas(null) as n")).rows[0].n;
  const marcas = (await dono("select count(*)::int as n from interno.alumia_turma_marcas where turma = $1", [T])).rows[0].n;
  const semanas = (await dono("select total from interno.alumia_turma_semanas where turma = $1", [T])).rows;
  const avisos = (await dono("select count(*)::int as n from interno.avisos where texto like '%3 pessoas da turma “Redação de sábado” cumpriram%'")).rows[0].n;
  return { n, marcas, semanas, avisos };
}, (r) => r.n === 1 && r.marcas === 0 && r.semanas.length === 1 && r.semanas[0].total === 3 && r.avisos === 6);
await espera("a semana fechada aparece na fileira, com o número", () => rpc(C("a2"), "alumia_turma_minhas"), (r) => r.itens[0].semanas.length === 1 && r.itens[0].semanas[0].total === 3 && r.itens[0].total === null);
await espera("semana fechada com menos de 3: sem número e sem aviso", async () => {
  await rpc(C("a1"), "alumia_turma_marcar", { p_turma: T, p_sim: true });
  await dono("update interno.alumia_turma_marcas set semana = semana - 14 where turma = $1", [T]);
  const antes = (await dono("select count(*)::int as n from interno.avisos where texto like '%cumpriram o combinado%'")).rows[0].n;
  const r = await rpc(C("a1"), "alumia_turma_minhas");
  const depois = (await dono("select count(*)::int as n from interno.avisos where texto like '%cumpriram o combinado%'")).rows[0].n;
  return { r, antes, depois };
}, ({ r, antes, depois }) => antes === depois && r.itens[0].semanas.length === 2 && r.itens[0].semanas.some((s) => s.total === null));
await espera("nenhuma tabela da turma guarda a pessoa depois da semana fechar", async () =>
  (await dono("select count(*)::int as n from interno.alumia_turma_marcas where semana < interno.alumia_o11t_semana(now())")).rows[0].n, (n) => n === 0);

// Cheia e limite de turmas.
await espera("até 12 pessoas", async () => {
  for (let i = 0; i < 6; i++) {
    const u = await criarUsuario(`extra${i}@o11.local`, `Extra ${i}`);
    await zerar();
    await rpc(como(u), "alumia_turma_entrar", { p_codigo: novo.codigo });
  }
  return (await dono("select count(*)::int as n from interno.alumia_turma_pessoas where turma = $1", [T])).rows[0].n;
}, (n) => n === 12);
await zerar();
await recusa("a 13ª pessoa não entra", () => rpc(C("a4"), "alumia_turma_entrar", { p_codigo: novo.codigo }), "turma_cheia");
await espera("até 5 turmas por pessoa", async () => {
  for (let i = 0; i < 4; i++) await rpc(C("a5"), "alumia_turma_criar", { p_nome: `Turma ${i} do teste`, p_meta: "1 lista por semana" });
  return (await rpc(C("a5"), "alumia_turma_minhas")).itens.length;
}, (n) => n === 4);
await rpc(C("a5"), "alumia_turma_criar", { p_nome: "Turma 4 do teste", p_meta: "1 lista por semana" }).catch(() => null);
await zerar();
await recusa("a sexta turma é recusada", () => rpc(C("a5"), "alumia_turma_criar", { p_nome: "Turma 5 do teste", p_meta: "1 lista por semana" }), "limite_de_turmas");

// Sair.
await espera("quem cuida sai: a pessoa mais antiga passa a cuidar e é avisada", async () => {
  await rpc(C("a1"), "alumia_turma_sair", { p_turma: T });
  const cuida = (await dono("select usuario from interno.alumia_turma_pessoas where turma = $1 and cuida", [T])).rows.map((r) => r.usuario);
  const aviso = (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like 'Agora você cuida da turma%'", [P.a2])).rows[0].n;
  return { cuida, aviso };
}, ({ cuida, aviso }) => cuida.length === 1 && cuida[0] === P.a2 && aviso === 1);
await espera("a última pessoa que sai apaga a turma", async () => {
  const t = await rpc(C("a4"), "alumia_turma_criar", { p_nome: "Só eu", p_meta: "1 redação por semana" });
  await rpc(C("a4"), "alumia_turma_sair", { p_turma: t.id });
  return (await dono("select count(*)::int as n from interno.alumia_turmas where id = $1", [t.id])).rows[0].n;
}, (n) => n === 0);

// ═══════════════════ 3. Agenda de provas ═══════════════════
await zerar();
const hoje = (await dono("select interno.alumia_o11t_hoje()::text as d")).rows[0].d;
const somar = (n) => (new Date(Date.parse(`${hoje}T12:00:00Z`) + n * 86_400_000)).toISOString().slice(0, 10);
const dado = (extra = {}) => ({ exame: "ENEM 2026", etapa: "Segundo dia de provas", dia: somar(10), hora: "13:30", orgao: "Inep", fonte: "https://www.gov.br/inep/pt-br/enem", conferido_em: hoje, ...extra });
await recusa("conta comum não escreve na agenda", () => rpc(C("a1"), "alumia_agenda_salvar", { p_id: null, p: dado() }), "sem_permissao");
await recusa("monitor não escreve na agenda", () => rpc(C("monitor"), "alumia_agenda_salvar", { p_id: null, p: dado() }), "sem_permissao");
await recusa("sem fonte oficial não entra", () => rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: dado({ fonte: "" }) }), "invalido:fonte");
await recusa("fonte sem https não entra", () => rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: dado({ fonte: "http://inep.gov.br/enem" }) }), "invalido:fonte");
await recusa("conferida no futuro não entra", () => rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: dado({ conferido_em: somar(2) }) }), "invalido:conferido_em");
await recusa("dia que não é dia", () => rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: dado({ dia: "amanhã" }) }), "invalido:dia");
await recusa("campo desconhecido", () => rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: { ...dado(), lugar: "x" } }), "invalido:data");
const d1 = await espera("a coordenação escreve uma data", () => rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: dado() }), (d) => d.hora === "13:30" && d.assinada === false);
const d2 = await espera("a mediação também (a 3 dias)", () => rpc(C("media"), "alumia_agenda_salvar", { p_id: null, p: dado({ exame: "Vestibular do teste", etapa: "Primeira fase", dia: somar(3), hora: "" }) }), (d) => d.hora === null);
await espera("escrever de novo a mesma prova, etapa e dia não duplica (só atualiza a fonte)", async () => {
  await rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: dado({ fonte: "https://www.gov.br/inep/pt-br/enem/edital" }) });
  return (await dono("select count(*)::int as n, max(fonte) as f from interno.alumia_agenda_datas where exame = 'ENEM 2026'")).rows[0];
}, (r) => r.n === 1 && r.f.endsWith("/edital"));
await espera("a lista mostra as datas e quem pode cuidar", () => rpc(C("a1"), "alumia_agenda_datas"), (r) => r.itens.length === 2 && r.pode_cuidar === false && r.hoje === hoje);
await espera("para a coordenação, pode cuidar", () => rpc(C("coord"), "alumia_agenda_datas"), (r) => r.pode_cuidar === true);
await espera("a1 e a2 assinam as duas datas", async () => {
  await rpc(C("a1"), "alumia_agenda_assinar", { p_datas: [d1.id, d2.id], p_sim: true });
  return rpc(C("a2"), "alumia_agenda_assinar", { p_datas: [d1.id, d2.id], p_sim: true });
}, (r) => r.itens.every((d) => d.assinada));
await espera("a lista não diz quantas pessoas assinaram nem quem", () => rpc(C("a3"), "alumia_agenda_datas"), (r) => r.itens.every((d) => d.assinada === false && !("assinantes" in d) && !("pessoas" in d)));
await espera("assinar a 3 dias já nasce sem o aviso de 7 dias", async () =>
  (await dono("select avisado_7, avisado_1 from interno.alumia_agenda_assinaturas where data = $1 and usuario = $2", [d2.id, P.a1])).rows[0], (r) => r.avisado_7 === true && r.avisado_1 === false);
await espera("de madrugada, nenhum aviso", async () => (await dono("select interno.alumia_o11t_agenda_rodar($1::timestamptz) as n", [`${hoje}T06:00:00Z`])).rows[0].n, (n) => n === 0);
await espera("os avisos de 7 dias saem uma vez (e não para quem assinou a 3 dias)", async () => {
  await dono("update interno.alumia_agenda_datas set dia = $2::date where id = $1", [d1.id, somar(6)]);
  const n1 = (await dono("select interno.alumia_o11t_agenda_rodar($1::timestamptz) as n", [`${hoje}T15:00:00Z`])).rows[0].n;
  const n2 = (await dono("select interno.alumia_o11t_agenda_rodar($1::timestamptz) as n", [`${hoje}T16:00:00Z`])).rows[0].n;
  const textos = (await dono("select texto from interno.avisos where para = $1 and texto like 'Faltam%'", [P.a1])).rows.map((r) => r.texto);
  return { n1, n2, textos };
}, ({ n1, n2, textos }) => n1 === 2 && n2 === 0 && textos.length === 1 && textos[0].includes("Faltam 6 dias: ENEM 2026"));
await espera("o aviso de véspera sai uma vez", async () => {
  await dono("update interno.alumia_agenda_datas set dia = $2::date where id = $1", [d2.id, somar(1)]);
  const n1 = (await dono("select interno.alumia_o11t_agenda_rodar($1::timestamptz) as n", [`${hoje}T15:00:00Z`])).rows[0].n;
  const n2 = (await dono("select interno.alumia_o11t_agenda_rodar($1::timestamptz) as n", [`${hoje}T16:00:00Z`])).rows[0].n;
  return { n1, n2, t: (await dono("select texto from interno.avisos where para = $1 and texto like 'Amanhã:%'", [P.a2])).rows };
}, ({ n1, n2, t }) => n1 === 2 && n2 === 0 && t.length === 1);
await espera("a data muda: quem assinou é avisado, com a fonte", async () => {
  await rpc(C("coord"), "alumia_agenda_salvar", { p_id: d1.id, p: dado({ dia: somar(20) }) });
  return (await dono("select para, texto from interno.avisos where texto like 'A data mudou%'")).rows;
}, (rs) => rs.length === 2 && rs.every((r) => r.texto.includes("https://www.gov.br/inep/pt-br/enem")));
await espera("e os lembretes recomeçam", async () => (await dono("select bool_and(not avisado_7 and not avisado_1) as b from interno.alumia_agenda_assinaturas where data = $1", [d1.id])).rows[0].b, (b) => b === true);
await espera("deixar de assinar", () => rpc(C("a2"), "alumia_agenda_assinar", { p_datas: [d1.id], p_sim: false }), (r) => r.itens.find((d) => d.id === d1.id).assinada === false);
await espera("a data sai: quem assinou é avisado", async () => {
  await rpc(C("media"), "alumia_agenda_apagar", { p_id: d1.id });
  return (await dono("select para from interno.avisos where texto like '%saiu da agenda de provas%'")).rows.map((r) => r.para);
}, (ps) => ps.length === 1 && ps[0] === P.a1);
await espera("depois do dia, a assinatura some", async () => {
  await dono("update interno.alumia_agenda_datas set dia = $2::date where id = $1", [d2.id, somar(-1)]);
  await dono("select interno.alumia_o11t_agenda_rodar($1::timestamptz)", [`${hoje}T15:00:00Z`]);
  return (await dono("select count(*)::int as n from interno.alumia_agenda_assinaturas where data = $1", [d2.id])).rows[0].n;
}, (n) => n === 0);
await recusa("data que já passou não se assina", () => rpc(C("a3"), "alumia_agenda_assinar", { p_datas: [d2.id], p_sim: true }).then((r) => {
  if (!r.itens.find((d) => d.id === d2.id)?.assinada) throw new Error("nao_assinou");
  return r;
}), "nao_assinou");
await espera("as datas do ENEM do site entram pela coordenação sem duplicar", async () => {
  const lista = datasDoSite("2000-01-01").filter((d) => d.dia >= somar(-30));
  for (const d of lista) await rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: { ...d, conferido_em: d.conferido_em > hoje ? hoje : d.conferido_em } });
  for (const d of lista) await rpc(C("coord"), "alumia_agenda_salvar", { p_id: null, p: { ...d, conferido_em: d.conferido_em > hoje ? hoje : d.conferido_em } });
  // A data do ENEM escrita à mão no começo já saiu da agenda: só ficam as que vieram do site.
  return { lista: lista.length, banco: (await dono("select count(*)::int as n from interno.alumia_agenda_datas where exame like 'ENEM %'")).rows[0].n };
}, ({ lista, banco }) => banco === lista);

// ═══════════════════ 4. Monitoria ═══════════════════
await zerar();
const em = (horas) => new Date(Date.now() + horas * 3_600_000).toISOString();
const oferta = (extra = {}) => ({ disciplina: "matematica", inicio: em(26), duracao: 45, vagas: 2, sala: "conversa", nota: "Funções do 1º grau", ...extra });
await recusa("quem não foi nomeado não oferece horário", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta() }), "sem_permissao");
await recusa("conta comum não nomeia", () => rpc(C("a1"), "alumia_monitoria_nomear", { p_handle: "o11_monitor", p_disciplinas: ["matematica"] }), "sem_permissao");
await recusa("disciplina fora da lista", () => rpc(C("coord"), "alumia_monitoria_nomear", { p_handle: "o11_monitor", p_disciplinas: ["astrologia"] }), "invalido:disciplinas");
await espera("a coordenação convida; a pessoa é avisada", async () => {
  const r = await rpc(C("coord"), "alumia_monitoria_nomear", { p_handle: "@o11_monitor", p_disciplinas: ["matematica", "redacao"] });
  const a = (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like 'Chegou um convite para você dar monitoria%'", [P.monitor])).rows[0].n;
  return { r, a };
}, ({ r, a }) => r.itens.length === 1 && r.itens[0].situacao === "convidado" && r.itens[0].handle === "o11_monitor" && a === 1);
await recusa("convidado ainda não oferece", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta() }), "sem_permissao");
await espera("aceita", () => rpc(C("monitor"), "alumia_monitoria_responder", { p_aceita: true }), (r) => r.eu.situacao === "ativo");
await espera("a mediação nomeia o segundo, que aceita", async () => {
  await rpc(C("media"), "alumia_monitoria_nomear", { p_handle: "o11_monitor2", p_disciplinas: ["humanas"] });
  return rpc(C("monitor2"), "alumia_monitoria_responder", { p_aceita: true });
}, (r) => r.eu.situacao === "ativo");
await recusa("só a lista de monitores para quem cuida", () => rpc(C("a1"), "alumia_monitoria_monitores"), "sem_permissao");
await recusa("fora da disciplina dele", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta({ disciplina: "humanas" }) }), "sem_permissao");
await recusa("em menos de 1 hora", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta({ inicio: em(0.5) }) }), "invalido:inicio");
await recusa("mais de 5 vagas", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta({ vagas: 9 }) }), "invalido:vagas");
await recusa("aula ao vivo que não é dele", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta({ sala: "aula", aula: "6f1c2b8e-1a2b-4c3d-8e9f-001122334455" }) }), "invalido:aula");
await recusa("campo desconhecido", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: { ...oferta(), quem: "x" } }), "invalido:horario");
const j1 = await espera("o monitor oferece um horário com 2 vagas", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta() }), (j) => j.vagas === 2 && j.marcas.length === 0);
const aula = (await dono(`insert into interno.aulas_ao_vivo (titulo, disciplina, inicio, educador) values ('Plantão de redação', 'redacao', now() + interval '3 days', $1) returning id`, [P.monitor])).rows[0].id;
const j2 = await espera("e outro na aula ao vivo dele, com 1 vaga", () => rpc(C("monitor"), "alumia_monitoria_oferecer", { p: oferta({ disciplina: "redacao", sala: "aula", aula, vagas: 1, inicio: em(72) }) }), (j) => j.sala === "aula" && j.aula === aula);
await espera("quem estuda vê os horários sem o monitor e sem quantas vagas", () => rpc(C("a1"), "alumia_monitoria"), (r) => {
  const s = JSON.stringify(r.abertas);
  return r.abertas.length === 2 && !s.includes("o11_monitor") && !s.includes(P.monitor) && !s.includes("Codinome") && !/"vagas"/.test(s) && r.eu === null && r.pode_nomear === false;
});
await espera("o horário na aula ao vivo diz só que é na aula, sem o id dela (a aula diria quem é o monitor)", () => rpc(C("a1"), "alumia_monitoria"), (r) => {
  const j = r.abertas.find((x) => x.id === j2.id);
  return j && j.sala === "aula" && !("aula" in j) && !JSON.stringify(r.abertas).includes(aula);
});
await espera("o monitor não vê os próprios horários como abertos", () => rpc(C("monitor"), "alumia_monitoria"), (r) => r.abertas.length === 0 && r.minhas.length === 2 && r.aulas.length === 1);
await recusa("o monitor não marca o próprio horário", () => rpc(C("monitor"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "" }), "nao_encontrado");
await espera("a1 marca com a dúvida: os dois são avisados", async () => {
  const r = await rpc(C("a1"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "Não entendo o coeficiente angular." });
  const m = (await dono("select texto from interno.avisos where para = $1 and texto like 'Monitoria marcada%'", [P.monitor])).rows;
  const e = (await dono("select texto from interno.avisos where para = $1 and texto like 'Você marcou a monitoria%'", [P.a1])).rows;
  return { r, m, e };
}, ({ r, m, e }) => r.monitor.handle === "o11_monitor" && m.length === 1 && m[0].texto.includes("Codinome a1") && m[0].texto.includes("coeficiente") && e.length === 1);
await recusa("marcar de novo", () => rpc(C("a1"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "" }), "ja_marcada");
await espera("a1 vê o monitor no que marcou; o horário some das abertas dela", () => rpc(C("a1"), "alumia_monitoria"), (r) =>
  r.marcadas.length === 1 && r.marcadas[0].monitor.handle === "o11_monitor" && r.abertas.every((j) => j.id !== j1.id));
await espera("a2 marca a última vaga", () => rpc(C("a2"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "" }), (r) => r.id === j1.id);
await espera("cheio: some das abertas de quem não marcou", () => rpc(C("a3"), "alumia_monitoria"), (r) => r.abertas.every((j) => j.id !== j1.id));
await espera("sem vaga (a resposta volta sem erro, para contar no freio)", () => rpc(C("a3"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "" }), (r) => r.erro === "sem_vaga");
await espera("o monitor vê quem marcou o horário dele, com a dúvida", () => rpc(C("monitor"), "alumia_monitoria"), (r) => {
  const j = r.minhas.find((x) => x.id === j1.id);
  return j.marcas.length === 2 && j.marcas.some((m) => m.handle === "o11_a1" && m.duvida.includes("coeficiente"));
});
await espera("a2 não vê quem mais marcou", () => rpc(C("a2"), "alumia_monitoria"), (r) => !JSON.stringify(r).includes("o11_a1") && !JSON.stringify(r).includes("Codinome a1"));
await espera("ninguém de fora vê quem marcou", () => rpc(C("a3"), "alumia_monitoria"), (r) => !JSON.stringify(r).includes("o11_a1") && !JSON.stringify(r).includes("o11_a2"));
await espera("a2 desmarca: o monitor é avisado e a vaga volta", async () => {
  await rpc(C("a2"), "alumia_monitoria_desmarcar", { p_janela: j1.id });
  const a = (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like '%desmarcou a monitoria%'", [P.monitor])).rows[0].n;
  return { a, r: await rpc(C("a3"), "alumia_monitoria") };
}, ({ a, r }) => a === 1 && r.abertas.some((j) => j.id === j1.id));
{
  const antes = (await rpc(C("bloq"), "alumia_monitoria")).abertas.map((j) => j.id).sort().join();
  await rpc(C("bloq"), "rede_bloquear", { p_usuario: P.monitor, p_sim: true });
  await espera("bloqueio: a lista não muda (bloquear não aponta quem dá cada horário)", () => rpc(C("bloq"), "alumia_monitoria"), (r) => r.abertas.length > 0 && r.abertas.map((j) => j.id).sort().join() === antes);
  await espera("bloqueio: marcar com quem bloqueou dá a mesma resposta de horário cheio", () => rpc(C("bloq"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "" }), (r) => r.erro === "sem_vaga");
  await espera("e conta no freio de marcar", () => dono("select coalesce(sum(total), 0)::int n from interno.limites where chave = $1", [`alumia_monitoria_marcar:${P.bloq}`]).then((x) => x.rows[0].n), (n) => n >= 1);
  await espera("sem marca nenhuma", () => dono("select count(*)::int n from interno.alumia_monitoria_marcas where usuario = $1", [P.bloq]).then((x) => x.rows[0].n), (n) => n === 0);
}
await espera("até 3 marcados à frente por pessoa", async () => {
  const outros = [];
  for (let i = 0; i < 3; i++) outros.push(await rpc(C("monitor2"), "alumia_monitoria_oferecer", { p: oferta({ disciplina: "humanas", inicio: em(30 + i) }) }));
  await zerar();
  await rpc(C("a1"), "alumia_monitoria_marcar", { p_janela: outros[0].id, p_duvida: "" });
  await rpc(C("a1"), "alumia_monitoria_marcar", { p_janela: outros[1].id, p_duvida: "" });
  try {
    await rpc(C("a1"), "alumia_monitoria_marcar", { p_janela: outros[2].id, p_duvida: "" });
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => m.includes("limite_de_marcas"));
await espera("o lembrete de 1 hora sai uma vez para quem marcou e para o monitor", async () => {
  await dono("update interno.alumia_monitoria_janelas set inicio = now() + interval '50 minutes' where id = $1", [j1.id]);
  const n1 = (await dono("select interno.alumia_o11t_monitoria_rodar() as n")).rows[0].n;
  const n2 = (await dono("select interno.alumia_o11t_monitoria_rodar() as n")).rows[0].n;
  return { n1, n2 };
}, ({ n1, n2 }) => n1 === 2 && n2 === 0);
await recusa("o que já está para começar não se marca", () => rpc(C("a3"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "" }).then(async (r) => {
  await dono("update interno.alumia_monitoria_janelas set inicio = now() + interval '5 minutes' where id = $1", [j1.id]);
  return rpc(C("a4"), "alumia_monitoria_marcar", { p_janela: j1.id, p_duvida: "" }).then(() => r);
}), "ja_comecou");
await espera("o monitor cancela: quem marcou é avisado", async () => {
  await rpc(C("monitor"), "alumia_monitoria_cancelar", { p_janela: j2.id });
  await rpc(C("a5"), "alumia_monitoria").catch(() => null);
  return (await dono("select interno.alumia_o11t_janela_json(j) as j from interno.alumia_monitoria_janelas j where id = $1", [j2.id])).rows[0].j;
}, (j) => j.cancelada === true);
await espera("um dia depois do fim, o horário, as marcas e as dúvidas somem, e a monitoria dada conta na medalha", async () => {
  await dono("update interno.alumia_monitoria_janelas set inicio = now() - interval '2 days' where id = $1", [j1.id]);
  await dono("select interno.alumia_o11t_monitoria_rodar()");
  return (await dono("select (select count(*)::int from interno.alumia_monitoria_janelas where id = $1) as j, (select count(*)::int from interno.alumia_monitoria_marcas where janela = $1) as m, (select progresso from interno.alumia_conquistas where usuario = $2 and medalha = 'monitoria') as p", [j1.id, P.monitor])).rows[0];
}, (r) => r.j === 0 && r.m === 0 && r.p === 1);
await espera("tirar o monitor: os horários à frente caem com aviso a quem marcou", async () => {
  await rpc(C("coord"), "alumia_monitoria_tirar", { p_handle: "o11_monitor2" });
  const a = (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like '%foi cancelada por quem ia dar%'", [P.a1])).rows[0].n;
  const j = (await dono("select count(*)::int as n from interno.alumia_monitoria_janelas j where j.monitor = $1", [P.monitor2])).rows[0].n;
  return { a, j };
}, ({ a, j }) => a === 2 && j === 0);
await espera("deixar a monitoria por vontade própria", () => rpc(C("monitor"), "alumia_monitoria_deixar"), (r) => r.eu === null);

// ═══════════════════ 5. A porta da entrada ═══════════════════
await espera("com a trava ligada, conta não aprovada não passa", async () => {
  await dono("select interno.alumia_entrada_ligar(true)").catch(() => null);
  const novo = await criarUsuario("novo@o11.local", "Pessoa nova");
  try {
    await rpc(como(novo), "alumia_turma_minhas");
    return "passou";
  } catch (e) {
    return e.message;
  } finally {
    await dono("select interno.alumia_entrada_ligar(false)").catch(() => null);
  }
}, (m) => m.includes("alumia_entrada"));

// ═══════════════════ 6. Nada de endereço de rede ═══════════════════
await espera("nenhuma coluna nova guarda endereço", async () =>
  (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta)($|_)/.test(c.column_name)));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`turma e agenda (onda 11): ${certos} conferências certas.`);
process.exit(0);
