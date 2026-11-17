// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a ponte com a Escola da onda 11 (supabase/migracoes/20261117-alumia-o11-escola.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · o tópico da aula é o primeiro post ligado a ela que quem pede pode ver; sem post, nulo; comunidade fechada não abre;
//   · as medalhas nascem escondidas, só a dona liga cada uma, o perfil mostra só as ligadas e nunca o progresso; o feito da
//     redação e da monitoria só conta por dentro do banco; nenhuma função devolve quem tem uma medalha;
//   · a faixa de reputação nasce desligada, começa em 3 e o número nunca sai;
//   · o mural: entra por vontade própria, com o perfil ou com um codinome sem link, sai na hora; dado pessoal e campo estranho
//     são recusados; bloqueio, suspensão e perfil invisível somem; a mediação tira com registro;
//   · apagar a conta e sair só da Alumia levam tudo;
//   · as regras da tela (components/rede/estudo/conquistas/regras.ts) iguais às do banco, os textos nas seis línguas, o botão da
//     aula atrás da Alumia aberta, da conta aprovada e fora do aplicativo.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-escola.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { faixaDe, faltamPara, LIMIARES_DAS_FAIXAS, LIMITES_DO_MURAL, mesDoMural, nivelDa, NIVEIS, trilhasDoAparelho } from "../components/rede/estudo/conquistas/regras.ts";
import { alumiaAbertaParaAula, enderecoDiscutirAula } from "../lib/rede/discutir-aula.ts";

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
const sql = ler("supabase/migracoes/20261117-alumia-o11-escola.sql");
const PURAS = /(alumia_o11_nivel|alumia_o11_faixa)\(/;
ok("toda função nova é security definer com search_path fixo (menos as puras, que não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 18 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || PURAS.test(f.split("\n")[0]));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas começam com alumia_, nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 3 && tabelas.every((t) => t.startsWith("alumia_"))
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("toda tabela nova aponta para o perfil com on delete cascade (apagar e sair só da Alumia levam junto)",
  (sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).every((t) => /references interno\.perfis \(id\) on delete cascade/.test(t)));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("não mexe na versão da Alumia nem no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-500)));
ok("os níveis da tela são os do banco", sql.includes(`when 'redacao' then case when p_progresso >= ${NIVEIS.redacao[2]} then 3 when p_progresso >= ${NIVEIS.redacao[1]} then 2 when p_progresso >= ${NIVEIS.redacao[0]} then 1`)
  && sql.includes(`when 'monitoria' then case when p_progresso >= ${NIVEIS.monitoria[2]} then 3 when p_progresso >= ${NIVEIS.monitoria[1]} then 2 when p_progresso >= ${NIVEIS.monitoria[0]} then 1`));
ok("as faixas da tela são as do banco e a primeira começa em 3", LIMIARES_DAS_FAIXAS.semente === 3
  && sql.includes(`when p_n >= ${LIMIARES_DAS_FAIXAS.referencia} then 'referencia' when p_n >= ${LIMIARES_DAS_FAIXAS.apoio} then 'apoio' when p_n >= ${LIMIARES_DAS_FAIXAS.semente} then 'semente'`));
ok("os limites do mural da tela são os do banco", Object.entries(LIMITES_DO_MURAL).every(([c, [a, b]]) => sql.includes(`char_length(${c}) between ${a} and ${b}`) && sql.includes(`'${c}', ${a}, ${b}, v)`)));

// ═══════════════════ 0b. As contas da tela ═══════════════════
ok("nível pelo progresso", nivelDa("trilha", 0) === 1 && nivelDa("redacao", 0) === 0 && nivelDa("redacao", 1) === 1 && nivelDa("redacao", 10) === 2
  && nivelDa("redacao", 30) === 3 && nivelDa("monitoria", 4) === 1 && nivelDa("monitoria", 5) === 2 && nivelDa("monitoria", 20) === 3 && nivelDa("outra", 99) === 0);
ok("quanto falta para o próximo nível", faltamPara("redacao", 0) === 1 && faltamPara("redacao", 4) === 6 && faltamPara("redacao", 30) === null && faltamPara("trilha", 0) === null);
ok("faixa pelo número", faixaDe(0) === null && faixaDe(2) === null && faixaDe(3) === "semente" && faixaDe(10) === "apoio" && faixaDe(30) === "referencia");
ok("as trilhas do aparelho vêm da lista de aulas concluídas, sem lixo", JSON.stringify(trilhasDoAparelho(["b-trilha/aula-1", "a-trilha/x", "b-trilha/aula-2", "../fora", 3, "X Y/z"])) === '["a-trilha","b-trilha"]');
ok("o mês do mural", mesDoMural("2026-11")?.getUTCMonth() === 10 && mesDoMural("2026-13") === null);

// O botão da aula: a Alumia aberta (o recurso "alumia-aberta" quando existe), o endereço da Alumia e o componente.
{
  ok("o endereço da aula continua o mesmo sem o domínio próprio", enderecoDiscutirAula("pt", "matematica-basica", "fracoes", "matematica") === "/pt/alumia/aula/matematica-basica/fracoes?c=matematica");
  ok("com o domínio próprio, o botão vai para a Alumia", enderecoDiscutirAula("en", "oficios", "eletrica", "trabalho", "https://alumia.exemplo.org") === "https://alumia.exemplo.org/en/aula/oficios/eletrica?c=oficios-e-trabalho"
    && enderecoDiscutirAula("pt", "a-b", "c-d", "historia", "https://alumia.exemplo.org") === "https://alumia.exemplo.org/aula/a-b/c-d?c=historia");
  ok("Alumia aberta: precisa da rede-v2; com 'alumia-aberta' na lista de recursos, vale ele", [
    alumiaAbertaParaAula(new Set(["rede-v2"]), ["rede-v2"]) === true,
    alumiaAbertaParaAula(new Set([]), ["rede-v2"]) === false,
    // Desde a integração (21/11/2026) "alumia-aberta" está em PADRAO: só fecha quando é desligada ("-alumia-aberta" ou o painel).
    alumiaAbertaParaAula(new Set(["rede-v2", "-alumia-aberta"]), ["rede-v2", "alumia-aberta"]) === false,
    alumiaAbertaParaAula(new Set(["rede-v2", "alumia-aberta"]), ["rede-v2", "alumia-aberta"]) === true,
  ].every(Boolean));
  const botao = ler("components/rede/estudo/conquistas/DiscutirNaAlumia.tsx");
  const pagina = ler("app/[lang]/trilhas/[track]/[lesson]/page.tsx");
  ok("o botão some no aplicativo, pergunta a conta aprovada e só depois aparece", /isApp\(\)/.test(botao) && /app:hidden/.test(botao) && /alumia_entrada_eu/.test(botao)
    && /situacao === "aprovada"/.test(botao) && /hasSession\(\)/.test(botao));
  ok("a página da aula usa o botão novo, atrás da Alumia aberta", /alumiaAbertaParaAula\(\)\s*&&\s*\(?\s*<DiscutirNaAlumia/.test(pagina) && !/rotuloDiscutirAula/.test(pagina));
  ok("lib/rede/discutir-aula.ts continua sem os atalhos @/ e sem ler disco", !/node:fs|readFile|from "@\//.test(ler("lib/rede/discutir-aula.ts")));
}

// Os textos: as seis línguas com as mesmas chaves, listas do mesmo tamanho e os mesmos marcadores {x}; nenhuma palavra proibida.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/conquistas/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/conquistas/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`conquistas/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  const todos = ["pt", "en", "es", "fr", "ru", "zh"].map((l) => ler(`i18n/rede/conquistas/${l}.json`)).join("\n");
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt)));
  ok("os textos não falam em ranking nem placar como promessa", !/ranking|placar|leaderboard/i.test(JSON.stringify(pt).replace(/(sem|nenhum|não existe|nem) (ranking|placar)/gi, "")));
  ok("toda medalha e todo nível têm nome", ["redacao", "monitoria"].every((m) => [1, 2, 3].every((n) => typeof pt.medalhas[m].niveis[n - 1] === "string")) && typeof pt.medalhas.trilha.nome === "string");
  ok("toda faixa tem nome e explicação", ["semente", "apoio", "referencia"].every((f) => typeof pt.faixas[f]?.nome === "string" && typeof pt.faixas[f]?.texto === "string"));
  ok("todo erro do banco tem texto", ["dado_pessoal", "invalido:codinome", "invalido:curso", "invalido:instituicao", "invalido:recado", "invalido:muitas", "sem_permissao", "nao_encontrado", "generico"].every((c) => typeof pt.erros[c] === "string"));
  ok("os rótulos do encaixe são os de cada língua", (() => {
    const enc = ler("components/rede/estudo/conquistas/encaixe.tsx");
    return ["pt", "en", "es", "fr", "ru", "zh"].every((l) => enc.includes(`${l}: ${JSON.stringify(JSON.parse(ler(`i18n/rede/conquistas/${l}.json`)).aba)}`));
  })());
  ok("nenhum endereço de rede nos textos", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(todos));
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
               and p.proname = any (array['alumia_conquistas_minhas', 'alumia_conquista_mostrar', 'alumia_conquista_trilha', 'alumia_conquista_apagar',
                 'alumia_reputacao_mostrar', 'alumia_conquistas_de', 'alumia_aula_topico', 'alumia_mural', 'alumia_mural_meu', 'alumia_mural_entrar',
                 'alumia_mural_sair', 'alumia_mural_tirar'])`)).rows,
(rs) => rs.length === 12 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o11\\_%'`)).rows,
(rs) => rs.length >= 7 && rs.every((r) => !r.a && !r.b));
await espera("nenhuma função pública devolve quem tem uma medalha ou quem ajudou", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
               and (p.proname like 'alumia\\_conquista%' or p.proname like 'alumia\\_reputacao%') and p.proname ~ '(quem|lista|pessoas|membros|ranking|placar)'`)).rows,
(rs) => rs.length === 0);

const P = {};
const NOMES = ["coord", "mediadora", "ana", "bia", "caio", "duda", "eva", "fora", "susp"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o11.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.mediadora]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o11_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('o11-historia', 'História do teste', 'disciplinas', 'aberta', 'membros'),
  ('o11-fechada', 'Fechada do teste', 'lutas', 'fechada', 'membros') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('o11-historia', $1, 'membro'), ('o11-historia', $2, 'membro'), ('o11-historia', $3, 'membro'), ('o11-historia', $4, 'membro'), ('o11-historia', $5, 'membro'),
  ('o11-fechada', $1, 'membro')`, [P.ana, P.bia, P.caio, P.duda, P.eva]);

const eu = (n) => como(P[n]);
const postar = (quem, texto, extra = {}) => rpc(eu(quem), "rede_publicar", { p: { texto, ...extra } });

// ═══════════════════ 2. O tópico da aula ═══════════════════
const AULA = "historia-do-brasil/revolta-dos-males";
await espera("sem post ligado, a aula ainda não tem tópico", () => rpc(eu("bia"), "alumia_aula_topico", { p_comunidade: "o11-historia", p_aula: AULA }), (r) => r.id === null && r.comunidade === "o11-historia");
await recusa("aula fora do formato", () => rpc(eu("bia"), "alumia_aula_topico", { p_comunidade: "o11-historia", p_aula: "../fora" }), "invalido:aula");
const primeiro = (await postar("ana", "Tópico da aula: a Revolta dos Malês", { comunidade: "o11-historia" })).id;
await rpc(eu("ana"), "rede_com_ligar_aula", { p_post: primeiro, p_aula: AULA, p_titulo: "Revolta dos Malês" });
await dono("update interno.rede_posts set criado_em = now() - interval '1 hour' where id = $1", [primeiro]);
const segundo = (await postar("bia", "Mais uma conversa sobre a mesma aula", { comunidade: "o11-historia" })).id;
await rpc(eu("bia"), "rede_com_ligar_aula", { p_post: segundo, p_aula: AULA, p_titulo: "Revolta dos Malês" });
await espera("o tópico é o primeiro post ligado à aula", () => rpc(eu("caio"), "alumia_aula_topico", { p_comunidade: "o11-historia", p_aula: AULA }), (r) => r.id === primeiro);
await espera("o tópico de outra aula continua vazio", () => rpc(eu("caio"), "alumia_aula_topico", { p_comunidade: "o11-historia", p_aula: "historia-do-brasil/outra-aula" }), (r) => r.id === null);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.caio, P.ana]);
await espera("quem bloqueou a autora do primeiro cai no seguinte que pode ver", () => rpc(eu("caio"), "alumia_aula_topico", { p_comunidade: "o11-historia", p_aula: AULA }), (r) => r.id === segundo);
await dono("delete from interno.rede_bloqueios where quem = $1", [P.caio]);
await dono("update interno.rede_posts set apagado_em = now() where id = $1", [primeiro]);
await espera("post apagado não é tópico: vale o seguinte", () => rpc(eu("duda"), "alumia_aula_topico", { p_comunidade: "o11-historia", p_aula: AULA }), (r) => r.id === segundo);
await dono("update interno.rede_posts set apagado_em = null where id = $1", [primeiro]);
await recusa("comunidade fechada não abre para quem não é dela", () => rpc(eu("fora"), "alumia_aula_topico", { p_comunidade: "o11-fechada", p_aula: AULA }), "nao_encontrad");

// ═══════════════════ 3. Medalhas ═══════════════════
await zerar();
await espera("sem nada, as minhas conquistas vêm vazias e a faixa desligada", () => rpc(eu("ana"), "alumia_conquistas_minhas"),
  (r) => r.medalhas.length === 0 && r.faixa.mostrar === false && r.faixa.faixa === null);
await espera("marca uma trilha terminada (nasce escondida)", () => rpc(eu("ana"), "alumia_conquista_trilha", { p_trilha: "historia-do-brasil", p_ligar: true }), (r) => r.ligada === true);
await espera("marcar de novo não duplica", () => rpc(eu("ana"), "alumia_conquista_trilha", { p_trilha: "historia-do-brasil", p_ligar: true }));
await recusa("trilha com nome estranho", () => rpc(eu("ana"), "alumia_conquista_trilha", { p_trilha: "../x", p_ligar: true }), "invalido:trilha");
await espera("as minhas conquistas trazem a trilha, escondida", () => rpc(eu("ana"), "alumia_conquistas_minhas"),
  (r) => r.medalhas.length === 1 && r.medalhas[0].medalha === "trilha" && r.medalhas[0].alvo === "historia-do-brasil" && r.medalhas[0].mostrar === false);
await espera("o perfil não mostra a medalha escondida", () => rpc(eu("bia"), "alumia_conquistas_de", { p_handle: "o11_ana" }), (r) => r.medalhas.length === 0 && r.faixa === null);

// O feito da redação e da monitoria: só por dentro do banco.
await recusa("ninguém de fora conta um feito", () => rpc(eu("ana"), "alumia_o11_feito", { p_usuario: P.ana, p_medalha: "redacao" }), "");
await espera("o feito não vem de fora: a função interna não está exposta para authenticated", async () =>
  (await dono("select has_function_privilege('authenticated', 'interno.alumia_o11_feito(uuid, text)', 'execute') as x")).rows[0].x, (x) => x === false);
for (let i = 0; i < 10; i++) await dono("select interno.alumia_o11_feito($1, 'redacao')", [P.ana]);
await dono("select interno.alumia_o11_feito($1, 'monitoria')", [P.ana]);
await espera("feito de medalha desconhecida não grava nada", async () => (await dono("select interno.alumia_o11_feito($1, 'curtida') as x", [P.ana])).rows[0].x, (x) => x === null);
await espera("dez correções dão o nível 2; uma monitoria, o nível 1", () => rpc(eu("ana"), "alumia_conquistas_minhas"), (r) => {
  const red = r.medalhas.find((m) => m.medalha === "redacao");
  const mon = r.medalhas.find((m) => m.medalha === "monitoria");
  return red?.nivel === 2 && red.progresso === 10 && red.mostrar === false && mon?.nivel === 1;
});
await espera("ligar a medalha da redação", () => rpc(eu("ana"), "alumia_conquista_mostrar", { p_medalha: "redacao", p_alvo: "", p_mostrar: true }), (r) => r.mostrar === true);
await recusa("ligar medalha que não tem", () => rpc(eu("bia"), "alumia_conquista_mostrar", { p_medalha: "redacao", p_alvo: "", p_mostrar: true }), "nao_encontrado");
await espera("o perfil mostra só a ligada, com o nível e SEM o progresso", () => rpc(eu("bia"), "alumia_conquistas_de", { p_handle: "o11_ana" }),
  (r) => r.medalhas.length === 1 && r.medalhas[0].medalha === "redacao" && r.medalhas[0].nivel === 2 && !("progresso" in r.medalhas[0]) && r.meu === false);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.ana, P.caio]);
await recusa("quem está bloqueado não vê as conquistas", () => rpc(eu("caio"), "alumia_conquistas_de", { p_handle: "o11_ana" }), "nao_encontrado");
await dono("delete from interno.rede_bloqueios where quem = $1", [P.ana]);
await dono("update interno.perfis set rede_modo = 'invisivel', rede_invisivel = true where id = $1", [P.ana]);
await recusa("perfil invisível não mostra conquistas a ninguém", () => rpc(eu("bia"), "alumia_conquistas_de", { p_handle: "o11_ana" }), "nao_encontrado");
await espera("a dona vê as próprias mesmo invisível", () => rpc(eu("ana"), "alumia_conquistas_de", { p_handle: "o11_ana" }), (r) => r.meu === true);
await dono("update interno.perfis set rede_modo = 'aberto', rede_invisivel = false where id = $1", [P.ana]);
await recusa("visitante sem conta não lê conquistas", () => rpc(visitante, "alumia_conquistas_de", { p_handle: "o11_ana" }), "");
await espera("esconder de novo", () => rpc(eu("ana"), "alumia_conquista_mostrar", { p_medalha: "redacao", p_alvo: "", p_mostrar: false }));
await espera("escondida, some do perfil", () => rpc(eu("bia"), "alumia_conquistas_de", { p_handle: "o11_ana" }), (r) => r.medalhas.length === 0);
await espera("apagar a monitoria de vez", () => rpc(eu("ana"), "alumia_conquista_apagar", { p_medalha: "monitoria", p_alvo: "" }), (r) => r.apagada === true);
await espera("desmarcar a trilha", () => rpc(eu("ana"), "alumia_conquista_trilha", { p_trilha: "historia-do-brasil", p_ligar: false }));
await espera("sobrou só a redação", () => rpc(eu("ana"), "alumia_conquistas_minhas"), (r) => r.medalhas.length === 1 && r.medalhas[0].medalha === "redacao");
await zerar();
await espera("até 60 trilhas", async () => {
  for (let i = 0; i < 60; i++) await rpc(eu("eva"), "alumia_conquista_trilha", { p_trilha: `trilha-${i}`, p_ligar: true });
  return true;
});
await recusa("a 61ª trilha é recusada", () => rpc(eu("eva"), "alumia_conquista_trilha", { p_trilha: "trilha-61", p_ligar: true }), "invalido:muitas");

// ═══════════════════ 4. A faixa de reputação ═══════════════════
await zerar();
// Caio responde a perguntas de várias pessoas; quem perguntou marca a resposta como a que ajudou.
async function ajudou(perguntou, texto) {
  const raizP = (await postar(perguntou, texto, { comunidade: "o11-historia" })).id;
  const resp = (await postar("caio", `Resposta do Caio: ${texto}`, { comunidade: "o11-historia", resposta_a: raizP })).id;
  await dono("insert into interno.rede_ajudou (raiz, resposta) values ($1, $2) on conflict (raiz) do update set resposta = excluded.resposta", [raizP, resp]);
  return raizP;
}
const raizes = [];
raizes.push(await ajudou("ana", "Por que os malês se revoltaram?"));
raizes.push(await ajudou("bia", "Quando foi a revolta?"));
await espera("com 2 ajudas, nenhuma faixa (número só a partir de 3)", () => rpc(eu("caio"), "alumia_conquistas_minhas"), (r) => r.faixa.faixa === null && r.faixa.mostrar === false);
raizes.push(await ajudou("duda", "Quem liderou a revolta?"));
await espera("com 3, a faixa semente, ainda desligada", () => rpc(eu("caio"), "alumia_conquistas_minhas"), (r) => r.faixa.faixa === "semente" && r.faixa.mostrar === false);
await espera("desligada por padrão: o perfil não mostra a faixa", () => rpc(eu("bia"), "alumia_conquistas_de", { p_handle: "o11_caio" }), (r) => r.faixa === null);
await espera("ligar a faixa", () => rpc(eu("caio"), "alumia_reputacao_mostrar", { p_mostrar: true }), (r) => r.mostrar === true);
await espera("ligada, o perfil mostra a faixa escrita e nenhum número", () => rpc(eu("bia"), "alumia_conquistas_de", { p_handle: "o11_caio" }),
  (r) => r.faixa === "semente" && !/\d/.test(JSON.stringify({ f: r.faixa, m: r.medalhas })));
await espera("a ajuda na própria pergunta não conta", async () => {
  const raizP = (await postar("caio", "Eu mesmo pergunto", { comunidade: "o11-historia" })).id;
  const resp = (await postar("caio", "E eu mesmo respondo", { comunidade: "o11-historia", resposta_a: raizP })).id;
  await dono("insert into interno.rede_ajudou (raiz, resposta) values ($1, $2) on conflict do nothing", [raizP, resp]);
  return (await dono("select interno.alumia_o11_ajudas($1) as n", [P.caio])).rows[0].n;
}, (n) => n === 3);
await espera("a resposta aceita conta como ajuda (uma vez por conversa)", async () => {
  await dono("update interno.rede_posts set aceita = (select resposta from interno.rede_ajudou where raiz = $1) where id = $1", [raizes[0]]);
  return (await dono("select interno.alumia_o11_ajudas($1) as n", [P.caio])).rows[0].n;
}, (n) => n === 3);
await espera("conversa de mais de 12 meses não conta", async () => {
  await dono("update interno.rede_posts set criado_em = now() - interval '400 days' where id = $1", [raizes[2]]);
  return (await dono("select interno.alumia_o11_ajudas($1) as n", [P.caio])).rows[0].n;
}, (n) => n === 2);
await espera("abaixo de 3 de novo, o perfil volta a não mostrar faixa", () => rpc(eu("bia"), "alumia_conquistas_de", { p_handle: "o11_caio" }), (r) => r.faixa === null);
await espera("desligar apaga a linha", async () => {
  await rpc(eu("caio"), "alumia_reputacao_mostrar", { p_mostrar: false });
  return (await dono("select count(*)::int as n from interno.alumia_reputacao where usuario = $1", [P.caio])).rows[0].n;
}, (n) => n === 0);
await espera("as faixas do banco batem com as da tela", async () => (await dono("select interno.alumia_o11_faixa(2) a, interno.alumia_o11_faixa(3) b, interno.alumia_o11_faixa(10) c, interno.alumia_o11_faixa(30) d")).rows[0],
  (r) => r.a === faixaDe(2) && r.b === faixaDe(3) && r.c === faixaDe(10) && r.d === faixaDe(30));
await espera("os níveis do banco batem com os da tela", async () => {
  const casos = [["trilha", 0], ["redacao", 0], ["redacao", 1], ["redacao", 9], ["redacao", 10], ["redacao", 30], ["monitoria", 4], ["monitoria", 5], ["monitoria", 20]];
  const r = (await dono(`select ${casos.map(([m, n], i) => `interno.alumia_o11_nivel('${m}', ${n}) as n${i}`).join(", ")}`)).rows[0];
  return casos.every(([m, n], i) => r[`n${i}`] === nivelDa(m, n));
});

// ═══════════════════ 5. O mural de aprovados ═══════════════════
await zerar();
await espera("ninguém no mural no começo", () => rpc(eu("bia"), "alumia_mural", {}), (r) => r.itens.length === 0 && r.proximo == null);
await espera("Ana entra com o perfil, curso e instituição", () => rpc(eu("ana"), "alumia_mural_entrar", { p: { como: "perfil", curso: "Medicina", instituicao: "Federal da Bahia", recado: "Estudei com a roda de sábado!" } }),
  (r) => r.nome === "Codinome ana" && r.handle === "o11_ana" && r.curso === "Medicina" && r.minha === true && /^\d{4}-\d{2}$/.test(r.mes));
await espera("Bia entra com um codinome só para o mural, sem link do perfil", () => rpc(eu("bia"), "alumia_mural_entrar", { p: { como: "codinome", codinome: "Estrela do Sertão" } }),
  (r) => r.nome === "Estrela do Sertão" && r.handle === null && r.curso === null);
await recusa("codinome na forma perfil", () => rpc(eu("duda"), "alumia_mural_entrar", { p: { como: "perfil", codinome: "Outro" } }), "invalido:codinome");
await recusa("forma codinome sem codinome", () => rpc(eu("duda"), "alumia_mural_entrar", { p: { como: "codinome" } }), "invalido:codinome");
await recusa("campo estranho", () => rpc(eu("duda"), "alumia_mural_entrar", { p: { como: "perfil", nota: "990" } }), "invalido:inscricao");
await recusa("telefone no recado", () => rpc(eu("duda"), "alumia_mural_entrar", { p: { como: "perfil", recado: "Me chama no (71) 99999-1234" } }), "dado_pessoal");
await recusa("e-mail no curso", () => rpc(eu("duda"), "alumia_mural_entrar", { p: { como: "perfil", curso: "duda@exemplo.org" } }), "dado_pessoal");
await recusa("curso curto demais", () => rpc(eu("duda"), "alumia_mural_entrar", { p: { como: "perfil", curso: "X" } }), "invalido:curso");
await espera("Duda entra só com o nome do perfil", () => rpc(eu("duda"), "alumia_mural_entrar", { p: { como: "perfil" } }), (r) => r.nome === "Codinome duda");
await espera("o mural mostra as três, do mais novo para o mais antigo, sem o id de ninguém", () => rpc(eu("caio"), "alumia_mural", {}),
  (r) => r.itens.length === 3 && r.itens.every((i) => !JSON.stringify(i).includes(P.ana) && !JSON.stringify(i).includes(P.bia) && i.minha === false));
await espera("paginação por cursor", async () => {
  const a = await rpc(eu("caio"), "alumia_mural", { p_limite: 2 });
  const b = await rpc(eu("caio"), "alumia_mural", { p_cursor: a.proximo, p_limite: 2 });
  return [a.itens.length, b.itens.length, new Set([...a.itens, ...b.itens].map((i) => i.id)).size, b.proximo ?? null];
}, (r) => r[0] === 2 && r[1] === 1 && r[2] === 3 && r[3] === null);
await espera("o cursor é só o id da inscrição, sem o dia de entrada (o mural mostra só o mês)", async () => {
  const cursores = [];
  for (let c = null, i = 0; i < 3; i++) {
    const r = await rpc(eu("caio"), "alumia_mural", { p_cursor: c, p_limite: 1 });
    if (!r.proximo) break;
    cursores.push(r.proximo);
    c = r.proximo;
  }
  return cursores;
}, (cs) => cs.length === 3 && cs.every((c) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c)));
await recusa("cursor estranho", () => rpc(eu("caio"), "alumia_mural", { p_cursor: "x|y" }), "invalido:cursor");
await recusa("cursor de uma inscrição que não existe", () => rpc(eu("caio"), "alumia_mural", { p_cursor: "00000000-0000-0000-0000-000000000000" }), "invalido:cursor");
await espera("trocar a inscrição mantém uma linha só", async () => {
  await rpc(eu("ana"), "alumia_mural_entrar", { p: { como: "codinome", codinome: "Malê de Salvador" } });
  return (await dono("select count(*)::int as n from interno.alumia_mural where usuario = $1", [P.ana])).rows[0].n;
}, (n) => n === 1);
await espera("a minha inscrição para editar", () => rpc(eu("ana"), "alumia_mural_meu"), (r) => r.como === "codinome" && r.codinome === "Malê de Salvador" && r.curso === null);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.caio, P.duda]);
await espera("quem tem bloqueio com quem lê some do mural", () => rpc(eu("caio"), "alumia_mural", {}), (r) => r.itens.length === 2 && !r.itens.some((i) => i.nome === "Codinome duda"));
await dono("delete from interno.rede_bloqueios where quem = $1", [P.caio]);
await dono("update interno.perfis set rede_modo = 'invisivel', rede_invisivel = true where id = $1", [P.duda]);
await espera("perfil invisível na forma perfil some do mural (para os outros)", () => rpc(eu("caio"), "alumia_mural", {}), (r) => r.itens.length === 2);
await espera("mas a dona ainda vê a própria", () => rpc(eu("duda"), "alumia_mural", {}), (r) => r.itens.some((i) => i.minha));
await dono("update interno.perfis set rede_modo = 'aberto', rede_invisivel = false where id = $1", [P.duda]);
await dono("update interno.perfis set suspenso = true where id = $1", [P.bia]);
await espera("conta suspensa some do mural", () => rpc(eu("caio"), "alumia_mural", {}), (r) => !r.itens.some((i) => i.nome === "Estrela do Sertão"));
await dono("update interno.perfis set suspenso = false where id = $1", [P.bia]);
await recusa("visitante não lê o mural", () => rpc(visitante, "alumia_mural", {}), "");
await espera("sair do mural apaga na hora", async () => {
  await rpc(eu("duda"), "alumia_mural_sair");
  return [(await dono("select count(*)::int as n from interno.alumia_mural where usuario = $1", [P.duda])).rows[0].n, await rpc(eu("duda"), "alumia_mural_meu")];
}, (r) => r[0] === 0 && r[1] === null);
await recusa("membro comum não tira a inscrição de ninguém", async () => {
  const id = (await rpc(eu("caio"), "alumia_mural", {})).itens[0].id;
  return rpc(eu("caio"), "alumia_mural_tirar", { p_id: id, p_motivo: "Não gostei" });
}, "sem_permissao");
await espera("a mediação tira uma inscrição abusiva, com registro e aviso para a pessoa", async () => {
  const alvo = (await rpc(eu("caio"), "alumia_mural", {})).itens.find((i) => i.nome === "Estrela do Sertão");
  await rpc(eu("mediadora"), "alumia_mural_tirar", { p_id: alvo.id, p_motivo: "Inscrição com texto ofensivo." });
  const resto = await rpc(eu("caio"), "alumia_mural", {});
  const aviso = (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like '%mural de aprovados%'", [P.bia])).rows[0].n;
  return [resto.itens.some((i) => i.nome === "Estrela do Sertão"), aviso];
}, (r) => r[0] === false && r[1] === 1);

// ═══════════════════ 6. Apagar a conta e sair só da Alumia levam tudo ═══════════════════
await espera("sair só da Alumia leva medalhas, faixa e mural", async () => {
  await rpc(eu("caio"), "alumia_reputacao_mostrar", { p_mostrar: true });
  await dono("select interno.alumia_o11_feito($1, 'monitoria')", [P.caio]);
  await rpc(eu("caio"), "alumia_mural_entrar", { p: { como: "perfil" } });
  await dono("select interno.alumia_md_sair_de_vez($1)", [P.caio]);
  return (await dono(`select (select count(*) from interno.alumia_conquistas where usuario = $1)::int + (select count(*) from interno.alumia_reputacao where usuario = $1)::int
                     + (select count(*) from interno.alumia_mural where usuario = $1)::int as n`, [P.caio])).rows[0].n;
}, (n) => n === 0);
await espera("apagar o perfil leva tudo (on delete cascade)", async () => {
  await dono("delete from interno.perfis where id = $1", [P.ana]);
  return (await dono(`select (select count(*) from interno.alumia_conquistas where usuario = $1)::int + (select count(*) from interno.alumia_mural where usuario = $1)::int as n`, [P.ana])).rows[0].n;
}, (n) => n === 0);

// ═══════════════════ 7. Nada de endereço de rede ═══════════════════
await espera("nenhuma coluna nova guarda endereço", async () =>
  (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta)($|_)/.test(c.column_name)));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ponte com a Escola (onda 11): ${certos} conferências certas.`);
process.exit(0);
