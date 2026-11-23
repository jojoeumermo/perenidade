// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a linha com regra aberta da Alumia (supabase/migracoes/20261113-alumia-o7-linha.sql) num Postgres de verdade (banco
// local, sem rede). O que este teste PROVA:
//   - a regra "Em roda" sai exatamente como está escrita na tela (avisos fixados, atos perto, blocos de 6 horas, quem ajudou,
//     a roda por pessoa, o teto de 3 por tela de 20, e a ordem de chegada depois dos 7 dias);
//   - a mesma entrada dá a mesma ordem: duas pessoas com as mesmas escolhas veem a mesma linha;
//   - nenhum sinal de comportamento entra: curtir, apoiar, marcar útil, salvar, "eu vou", responder e ganhar seguidores NÃO
//     mudam a ordem, e o código da regra não lê nenhuma dessas tabelas;
//   - o que a pessoa ESCOLHEU muda (seguir, silenciar, filtro da linha montada);
//   - assuntos em alta: piso de 3 pessoas, só crescimento, igual para todo mundo, sem número;
//   - "enquanto você esteve fora", ocultar resposta sem apagar, e a porta da entrada em toda função.
// Uso: npm run testar:alumia-o7-linha
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import * as L from "../lib/rede/linha-aberta.ts";
const { NUMEROS_DA_REGRA } = L;

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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
const ler = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const sql = ler("supabase/migracoes/20261113-alumia-o7-linha.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
await espera("a migração instala", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(sql)));
// O install.sql inteiro de novo por cima: as definições finais (a R2 redefiniu funções desta migração) voltam a valer.
await espera("e o install.sql inteiro de novo por cima (as definições finais voltam)", () => banco.instalarDeNovo());

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

const p = {};
const nomes = ["ana", "bia", "um", "dois", "tres", "quatro", "cinco", "seis", "mod"];
for (const [i, nome] of nomes.entries()) {
  p[nome] = await criarUsuario(`${nome}@o7.local`, nome);
  await rpc(como(p[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [p[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [p[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [p[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
const zerar = () => dono("delete from interno.limites");

// ═══════════════════ Tabelas e funções ═══════════════════
for (const tabela of ["rede_o7_ocultas", "rede_o7_temas_retidos"]) {
  await espera(`${tabela}: RLS ligada`, async () => (await um("select relrowsecurity as r from pg_class where oid = $1::regclass", [`interno.${tabela}`])).r, (r) => r === true);
  await espera(`${tabela}: nenhuma política`, async () => (await um("select count(*)::int as n from pg_policies where schemaname = 'interno' and tablename = $1", [tabela])).n, (n) => n === 0);
  await espera(`${tabela}: nenhuma permissão para anon/authenticated`, async () =>
    (await um(`select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and table_name = $1 and grantee in ('anon', 'authenticated', 'PUBLIC')`, [tabela])).n, (n) => n === 0);
  await espera(`${tabela}: não guarda quem (nenhuma coluna de pessoa)`, async () =>
    (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = $1", [tabela])).rows.map((r) => r.column_name),
  (cs) => !cs.some((c) => /usuario|quem|autor|pessoa/.test(c)));
}
const publicas = ["rede_roda_linha", "rede_roda_regra", "rede_roda_desde", "rede_roda_em_alta", "rede_roda_tema_reter", "rede_roda_ocultar", "rede_roda_ocultas"];
const internas = ["rede_o7_numeros", "rede_o7_filtro", "rede_o7_cabe", "rede_o7_montar"];
await espera("as funções públicas são security definer com search_path fixo", async () =>
  (await dono(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [publicas])).rows,
(rs) => rs.length === publicas.length && rs.every((r) => r.prosecdef && r.cfg.includes("search_path=interno, pg_temp")));
await espera("toda função pública passa pela porta da entrada", async () =>
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [publicas])).rows,
(rs) => rs.length === publicas.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
await espera("a regra das portas não acha função da rede aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r.abertas) && r.abertas.length === 0);
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname = any($1)`, [internas])).rows,
(rs) => rs.length === internas.length && rs.every((r) => !r.a && !r.b));
for (const f of ["rede_roda_linha", "rede_roda_em_alta"]) {
  await recusa(`visitante não chama ${f}`, () => rpc(visitante(), f, f === "rede_roda_linha" ? { p_aba: "tudo" } : {}), "permission denied");
}
await recusa("visitante não oculta resposta", () => rpc(visitante(), "rede_roda_ocultar", { p_resposta: crypto.randomUUID() }), "permission denied");

// Nenhum sinal de comportamento no código da regra: ela não lê reação, apoio, salvo, "eu vou", aviso lido nem contagem.
const PROIBIDAS = /rede_reacoes|rede_apoios|rede_salvos|rede_vou|rede_alumia_reac|rede_avisos|rede_seguindo\b[^)]*count|lido|visto|clique|respostas_visiveis|count\(/i;
await espera("o código da regra não lê nenhuma tabela de comportamento", async () =>
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname in ('rede_o7_montar', 'rede_o7_cabe')`)).rows,
// A única contagem permitida é o piso da marca "ajudou" (3 pessoas diferentes respondendo): ela não ordena nada, só decide se a
// marca de quem perguntou vale. Fora dela, nenhum count.
(rs) => rs.length === 2 && rs.every((r) => !PROIBIDAS.test(r.prosrc.replace(/\(select count\(distinct r\.autor\) from rede_posts r\s+where r\.resposta_a = c\.id[^)]*\)\s*>= \(n ->> 'ajudou_piso'\)::integer/, "PISO"))));
await espera("os números da tela são os do banco", async () => (await um("select interno.rede_o7_numeros() as r")).r, (r) => igual(Object.fromEntries(Object.keys(NUMEROS_DA_REGRA).map((k) => [k, r[k]])), NUMEROS_DA_REGRA));

// ═══════════════════ O que fica só no aparelho (lib/rede/linha-aberta.ts) ═══════════════════
{
  const caixa = new Map();
  const g = { getItem: (k) => caixa.get(k) ?? null, setItem: (k, v) => void caixa.set(k, v), removeItem: (k) => void caixa.delete(k) };
  await espera("aparelho: a ordem padrão é Em roda e a escolha fica guardada", async () => {
    const antes = L.lerModo(g);
    L.guardarModo("chegada", g);
    const depois = L.lerModo(g);
    L.guardarModo("roda", g);
    return [antes, depois, L.lerModo(g)];
  }, (r) => igual(r, ["roda", "chegada", "roda"]));
  await espera("aparelho: criar, renomear, ordenar, fixar e apagar linhas", async () => {
    let ls = L.criarLinha([], { nome: "Chamados de Recife", base: "tudo", filtro: { tipos: ["chamado"], cidade: "Recife" } });
    ls = L.criarLinha(ls, { nome: "Só núcleos", base: "tudo", filtro: { nucleos: true } });
    ls = L.criarLinha(ls, { nome: "Estudo e ENEM", base: "tudo", filtro: { estudo: true } });
    ls = L.renomearLinha(ls, ls[1].id, "Meus núcleos");
    ls = L.moverLinha(ls, ls[2].id, -1);
    ls = L.fixarLinha(ls, ls[0].id, false);
    L.guardarLinhas(ls, g);
    const lidas = L.lerLinhas(g);
    return [lidas.map((l) => l.nome), lidas.map((l) => l.fixada), L.apagarLinha(lidas, lidas[0].id).length];
  }, (r) => igual(r, [["Chamados de Recife", "Estudo e ENEM", "Meus núcleos"], [false, true, true], 2]));
  await espera("aparelho: linha sem nome, repetida, vazia ou além do limite não entra", async () => {
    const uma = L.criarLinha([], { nome: "Estudo", base: "tudo", filtro: { estudo: true } });
    const cheia = Array.from({ length: L.MAXIMO_DE_LINHAS }, (_, i) => ({ id: "l-abc" + i, nome: "Linha " + i, base: "seguindo", filtro: {}, fixada: false }));
    return [L.criarLinha([], { nome: "  ", base: "tudo", filtro: { estudo: true } }), L.criarLinha(uma, { nome: "estudo", base: "tudo", filtro: { nucleos: true } }),
      L.criarLinha([], { nome: "Tudo de novo", base: "tudo", filtro: {} }), L.criarLinha(cheia, { nome: "Mais uma", base: "tudo", filtro: { estudo: true } })];
  }, (r) => igual(r, ["nome", "repetida", "vazia", "muitas"]));
  await espera("aparelho: filtro mexido à mão perde o que o banco não aceita", async () => L.arrumarFiltro({ tipos: ["chamado", "patrocinado"], tags: ["#ENEM", "a b"], curtidas: 10, cidade: " São  Paulo " }),
    (f) => igual(f, { tipos: ["chamado"], tags: ["enem"], cidade: "São Paulo" }));
  await espera("aparelho: a última visita fica guardada e a faixa só aparece depois de 8 horas fora", async () => {
    L.marcarVisita(new Date("2026-11-12T08:00:00Z"), g);
    const v = L.ultimaVisita(g);
    return [v, L.esteveFora(v, Date.parse("2026-11-12T10:00:00Z")), L.esteveFora(v, Date.parse("2026-11-12T17:00:00Z")), L.esteveFora(null)];
  }, (r) => igual(r, ["2026-11-12T08:00:00.000Z", false, true, false]));
  const ramo = (id, util, filhos = 0) => ({ post: { id, util }, filhos: Array.from({ length: filhos }) });
  const ramos = [ramo("a", 2, 1), ramo("b", 0), ramo("c", 5, 2), ramo("d", 3), ramo("e", 1)];
  await espera("respostas úteis: a que ajudou, depois as marcadas por 3 ou mais; 1 ou 2 marcas não mudam nada", async () => L.ordenarRamos(ramos, "uteis", "e").map((r) => r.post.id), (r) => igual(r, ["e", "c", "d", "a", "b"]));
  await espera("respostas sem resposta primeiro, na ordem em que chegaram", async () => L.ordenarRamos(ramos, "sem_resposta").map((r) => r.post.id), (r) => igual(r, ["b", "d", "e", "a", "c"]));
  await espera("as outras ordens ficam como o banco mandou", async () => L.ordenarRamos(ramos, "antigas").map((r) => r.post.id), (r) => igual(r, ["a", "b", "c", "d", "e"]));
}

// ═══════════════════ O cenário ═══════════════════
// Os blocos de 6 horas são fixos no relógio. O bloco P é o bloco inteiro anterior ao de agora; PP, o anterior a ele.
const SEIS_H = 6 * 3600 * 1000;
const agora = Date.now();
const P = Math.floor(agora / SEIS_H) * SEIS_H - SEIS_H;
const PP = P - SEIS_H;
const em = (base, minutos) => new Date(base + minutos * 60000).toISOString();
const post = async (autor, texto, quando, mais = {}) =>
  (await um(
    `insert into interno.rede_posts (autor, texto, publico, criado_em, tipo, fixado, comunidade, nucleo)
     values ($1, $2, 'membros', $3, $4, $5, $6, $7) returning id`,
    [p[autor], texto, quando, mais.tipo ?? "post", mais.fixado ?? false, mais.comunidade ?? null, mais.nucleo ?? null],
  )).id;

const id = {};
// Bloco P: "um" publica cinco vezes; "dois", "tres" e "quatro" uma vez cada.
id.a1 = await post("um", "Um, primeira do bloco.", em(P, 10));
id.a2 = await post("um", "Um, segunda do bloco.", em(P, 20));
id.a3 = await post("um", "Um, terceira do bloco.", em(P, 30));
id.a4 = await post("um", "Um, quarta do bloco.", em(P, 40));
id.a5 = await post("um", "Um, quinta do bloco.", em(P, 50));
id.b1 = await post("dois", "Dois no bloco.", em(P, 15));
id.c1 = await post("tres", "Três pergunta: como faço a inscrição?", em(P, 5), { tipo: "duvida" });
id.d1 = await post("quatro", "Quatro no bloco.", em(P, 25));
// Bloco PP: um post comum, um aviso fixado e dois chamados (um para amanhã, um para daqui a dez dias).
id.e1 = await post("dois", "Dois no bloco de antes.", em(PP, 50));
id.av = await post("mod", "Aviso da moderação: manutenção no domingo.", em(PP, 10), { tipo: "aviso", fixado: true });
id.ato1 = await post("tres", "Assembleia do bairro amanhã.", em(PP, 20), { tipo: "chamado" });
id.ato2 = await post("tres", "Mutirão daqui a dez dias.", em(PP, 30), { tipo: "chamado" });
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, tipo) values ($1, now() + interval '24 hours', 'São Paulo', 'Praça da Sé', 'assembleia')", [id.ato1]);
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, tipo) values ($1, now() + interval '10 days', 'Recife', 'Marco Zero', 'mutirao')", [id.ato2]);
// Muito antes da janela de 7 dias.
id.velho = await post("quatro", "Quatro, dez dias atrás.", new Date(agora - 10 * 86400000).toISOString());
// A resposta que ajudou quem perguntou (c1).
id.r1 = (await um(
  `insert into interno.rede_posts (autor, texto, publico, criado_em, resposta_a, root_id, profundidade) values ($1, 'É pelo formulário da secretaria.', 'membros', $2, $3, $3, 1) returning id`,
  [p.cinco, em(P, 8), id.c1],
)).id;
await dono("insert into interno.rede_ajudou (raiz, resposta) values ($1, $2)", [id.c1, id.r1]);

const resposta = (autor, texto, raiz, minutos) => um(
  `insert into interno.rede_posts (autor, texto, publico, criado_em, resposta_a, root_id, profundidade) values ($1, $2, 'membros', $3, $4, $4, 1) returning id`,
  [p[autor], texto, em(P, minutos), raiz],
);

// Ana e Bia fazem AS MESMAS escolhas: seguem um, dois, tres, quatro e a moderação.
for (const quem of ["ana", "bia"]) for (const alvo of ["um", "dois", "tres", "quatro", "mod"]) {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [p[quem], p[alvo]]);
}

const linha = (quem, aba = "tudo", modo = "roda", filtro = null, cursor = null) =>
  rpc(como(p[quem]), "rede_roda_linha", { p_aba: aba, p_modo: modo, p_filtro: filtro, p_cursor: cursor });
const ids = (r) => r.itens.map((x) => x.id);
const nome = (x) => Object.entries(id).find(([, v]) => v === x)?.[0] ?? x;
const nomesDe = (r) => ids(r).map(nome);

// ═══════════════════ "Ajudou" só a partir de 3 pessoas ═══════════════════
// Uma marca sozinha não muda a ordem: com uma resposta só (de uma segunda conta, por exemplo), a conversa fica na roda.
await espera("ajudou numa conversa com UMA pessoa respondendo não sobe: fica na roda", async () => (await linha("ana")).itens.find((x) => x.id === id.c1)?.o7_porque, (x) => x === "roda");
await resposta("tres", "Três responde a si mesmo.", id.c1, 9);
await resposta("tres", "E de novo.", id.c1, 9);
await espera("respostas da própria autora não contam para as 3 pessoas", async () => (await linha("ana")).itens.find((x) => x.id === id.c1)?.o7_porque, (x) => x === "roda");
await resposta("seis", "Seis também respondeu.", id.c1, 9);
await resposta("mod", "A moderação respondeu.", id.c1, 9);
{
  // A autora marcando a PRÓPRIA resposta como a que ajudou não conta (mesmo com 3 pessoas respondendo).
  const propria = (await dono("select id from interno.rede_posts where resposta_a = $1 and autor = $2 limit 1", [id.c1, p.tres])).rows[0].id;
  await dono("update interno.rede_ajudou set resposta = $2 where raiz = $1", [id.c1, propria]);
  await espera("marcar a própria resposta como a que ajudou não sobe a conversa", async () => (await linha("ana")).itens.find((x) => x.id === id.c1)?.o7_porque, (x) => x === "roda");
  await dono("update interno.rede_ajudou set resposta = $2 where raiz = $1", [id.c1, id.r1]);
}

// ═══════════════════ A regra, como está escrita ═══════════════════
const TELA_1 = ["av", "ato1", "c1", "a5", "d1", "b1", "a4", "a3", "e1", "ato2"];
const TELA_2 = ["a2", "a1"];
let primeira;
await espera("Em roda: aviso fixado, ato perto, quem ajudou, a roda por pessoa e o teto de 3", async () => (primeira = await linha("ana")), (r) => igual(nomesDe(r), TELA_1));
await espera("cada item diz por que está onde está", async () => primeira.itens.map((x) => x.o7_porque),
  (m) => igual(m, ["aviso", "ato", "ajudou", "roda", "roda", "roda", "roda", "roda", "roda", "roda"]));
await espera("o que passou do teto desce para a tela seguinte (cursor da regra)", async () => primeira.proximo, (c) => /^r\|.+\|2$/.test(c));
let segunda;
await espera("tela 2: as duas que sobraram da mesma pessoa, na ordem", async () => (segunda = await linha("ana", "tudo", "roda", null, primeira.proximo)), (r) => igual(nomesDe(r), TELA_2));
await espera("acabou a regra: o cursor passa para a ordem de chegada", async () => segunda.proximo, (c) => /^d\|/.test(c));
await espera("depois da regra vem o que é mais velho que 7 dias, por ordem de chegada", () => linha("ana", "tudo", "roda", null, segunda.proximo), (r) => igual(nomesDe(r), ["velho"]) && r.proximo === null && r.na_regra === false);
await espera("a resposta que ajudou não entra na linha (só o post de primeiro nível)", async () => [...ids(primeira), ...ids(segunda)], (x) => !x.includes(id.r1));
await espera("a linha devolve os números da regra", async () => primeira.regra, (r) => r.teto === 3 && r.tela === 20 && r.bloco_horas === 6 && r.janela_dias === 7);

// ═══════════════════ Mesma entrada, mesma ordem ═══════════════════
await espera("chamar de novo dá a mesma ordem", () => linha("ana"), (r) => igual(nomesDe(r), TELA_1));
await espera("Bia, com as mesmas escolhas, vê a mesma ordem (Tudo)", () => linha("bia"), (r) => igual(nomesDe(r), TELA_1));
let seguindoAna;
await espera("na aba Seguindo, Ana e Bia veem a mesma ordem", async () => {
  seguindoAna = await linha("ana", "seguindo");
  const b = await linha("bia", "seguindo");
  return [nomesDe(seguindoAna), nomesDe(b)];
}, ([a, b]) => igual(a, b) && igual(a, TELA_1));
await espera("a ordem é função do instante preso no cursor (a tela 2 não muda com post novo)", async () => {
  const novo = await post("seis", "Seis chegou agora.", new Date().toISOString());
  const r = await linha("ana", "tudo", "roda", null, primeira.proximo);
  await dono("delete from interno.rede_posts where id = $1", [novo]);
  return nomesDe(r);
}, (r) => igual(r, TELA_2));

// ═══════════════════ Nenhum sinal de comportamento entra ═══════════════════
await zerar();
await espera("Ana marca útil, apoia, salva e diz que vai; outras pessoas reagem, respondem e passam a seguir", async () => {
  for (const alvo of [id.a1, id.a2, id.e1]) {
    await rpc(como(p.ana), "rede_reagir", { p_post: alvo, p_tipo: "util", p_sim: true });
    await rpc(como(p.ana), "rede_reagir", { p_post: alvo, p_tipo: "apoio", p_sim: true });
    await rpc(como(p.ana), "rede_salvar", { p_post: alvo, p_sim: true });
  }
  for (const quem of ["cinco", "seis", "mod", "dois"]) {
    await rpc(como(p[quem]), "rede_reagir", { p_post: id.a1, p_tipo: "util", p_sim: true });
    await rpc(como(p[quem]), "rede_reagir", { p_post: id.a1, p_tipo: "apoio", p_sim: true });
    await dono("insert into interno.rede_posts (autor, texto, publico, resposta_a, root_id, profundidade) values ($1, 'Respondendo ao primeiro do bloco.', 'membros', $2, $2, 1)", [p[quem], id.a1]);
    await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [p[quem], p.um]);
  }
  await dono("insert into interno.rede_vou (post, usuario) values ($1, $2), ($1, $3), ($1, $4) on conflict do nothing", [id.ato2, p.ana, p.cinco, p.seis]);
  return (await um("select (select count(*)::int from interno.rede_reacoes) as r, (select count(*)::int from interno.rede_salvos) as s, (select count(*)::int from interno.rede_vou) as v")) ;
}, (n) => n.r >= 14 && n.s === 3 && n.v === 3);
await espera("…e a ordem de Ana não muda", () => linha("ana"), (r) => igual(nomesDe(r), TELA_1));
await espera("…nem a tela 2", async () => linha("ana", "tudo", "roda", null, (await linha("ana")).proximo), (r) => igual(nomesDe(r), TELA_2));
await espera("…nem a de Bia, que não reagiu a nada", () => linha("bia"), (r) => igual(nomesDe(r), TELA_1));
await espera("…nem a aba Seguindo", () => linha("ana", "seguindo"), (r) => igual(nomesDe(r), TELA_1));

// ═══════════════════ O que a pessoa ESCOLHEU muda ═══════════════════
await espera("Bia silencia uma pessoa: os posts dela saem só da linha de Bia", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [p.bia, p.quatro]);
  const b = await linha("bia");
  const a = await linha("ana");
  await dono("delete from interno.rede_silenciados where usuario = $1", [p.bia]);
  return [nomesDe(b), nomesDe(a)];
}, ([b, a]) => !b.includes("d1") && igual(b, TELA_1.filter((x) => x !== "d1")) && igual(a, TELA_1));
await espera("Ana deixa de seguir uma pessoa: ela sai da aba Seguindo e a de Bia fica como estava", async () => {
  await dono("delete from interno.rede_seguindo where quem = $1 and segue = $2", [p.ana, p.um]);
  const a = await linha("ana", "seguindo");
  const b = await linha("bia", "seguindo");
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [p.ana, p.um]);
  return [nomesDe(a), nomesDe(b)];
}, ([a, b]) => igual(a, ["av", "ato1", "c1", "d1", "b1", "e1", "ato2"]) && igual(b, TELA_1));

// ═══════════════════ Ordem de chegada ═══════════════════
await espera("Ordem de chegada: do mais novo para o mais velho, sem mais nada", () => linha("ana", "tudo", "chegada"),
  (r) => igual(nomesDe(r), ["a5", "a4", "a3", "d1", "a2", "b1", "a1", "c1", "e1", "ato2", "ato1", "av", "velho"]) && r.itens.every((x) => x.o7_porque === "chegada") && r.na_regra === false);
await recusa("modo que não existe", () => linha("ana", "tudo", "para-voce"), "invalido:modo");
await recusa("aba de perfil não entra na regra", () => linha("ana", "u:pessoa_um"), "invalido:aba");
await recusa("cursor torto", () => linha("ana", "tudo", "roda", null, "x|y|z"), "invalido:cursor");

// ═══════════════════ As linhas que a pessoa monta (filtro aberto) ═══════════════════
await espera("só chamados", () => linha("ana", "tudo", "roda", { tipos: ["chamado"] }), (r) => igual(nomesDe(r), ["ato1", "ato2"]));
await espera("só chamados da minha cidade (a cidade ESCRITA, com ou sem acento)", () => linha("ana", "tudo", "roda", { tipos: ["chamado"], cidade: "sao paulo" }), (r) => igual(nomesDe(r), ["ato1"]));
await espera("cidade sem chamado: linha vazia, sem erro", () => linha("ana", "tudo", "roda", { cidade: "Manaus" }), (r) => r.itens.length === 0 && r.proximo === null);
await espera("só estudo: as comunidades das disciplinas", async () => {
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, publico_padrao) values ('o7-matematica', 'Matemática do teste', 'disciplinas', 'membros') on conflict do nothing");
  id.mat = await post("cinco", "Dúvida de função afim para o #enem.", em(P, 12), { tipo: "duvida", comunidade: "o7-matematica" });
  return linha("ana", "tudo", "roda", { estudo: true });
}, (r) => igual(nomesDe(r), ["mat"]));
await espera("por #tema", () => linha("ana", "tudo", "chegada", { tags: ["#ENEM"] }), (r) => igual(nomesDe(r), ["mat"]));
// Depois da R2 (membros escondidos) o banco não tem post de núcleo (rede_posts_sem_nucleo) nem sabe quem é de qual núcleo: o filtro
// "só núcleos" continua aceito e volta vazio (o mural do núcleo é do grupo, nos aparelhos).
await recusa("só núcleos: o banco não aceita post de núcleo", async () => {
  const nucleo = (await um("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo do teste', 'Recife') returning id")).id;
  return um("insert into interno.rede_posts (autor, texto, publico, criado_em, nucleo) values ($1, 'Pauta do núcleo de quinta.', 'nucleo', $2, $3) returning id", [p.ana, em(P, 14), nucleo]);
}, "rede_posts_sem_nucleo");
await espera("só núcleos: a linha vem vazia para todo mundo", async () => [nomesDe(await linha("ana", "tudo", "roda", { nucleos: true })), nomesDe(await linha("bia", "tudo", "roda", { nucleos: true }))],
  ([a, b]) => a.length === 0 && b.length === 0);
await recusa("filtro com chave desconhecida", () => linha("ana", "tudo", "roda", { curtidas_minimas: 10 }), "invalido:filtro");
await recusa("filtro com tipo que não existe", () => linha("ana", "tudo", "roda", { tipos: ["patrocinado"] }), "invalido:filtro");
await espera("a aba dos #temas seguidos", async () => {
  await rpc(como(p.ana), "rede_alumia_seguir_tag", { p_tag: "enem", p_sim: true });
  const a = await linha("ana", "temas");
  const b = await linha("bia", "temas");
  return [nomesDe(a), nomesDe(b)];
}, ([a, b]) => igual(a, ["mat"]) && b.length === 0);
await dono("delete from interno.rede_posts where id = any($1)", [[id.mat, id.nuc]]);

// ═══════════════════ Enquanto você esteve fora ═══════════════════
await zerar();
const fora = (quem, desde, aba = "tudo") => rpc(como(p[quem]), "rede_roda_desde", { p_aba: aba, p_desde: desde, p_filtro: null });
await espera("fora: só o que chegou depois da última visita, pela mesma regra, até 5", () => fora("ana", em(P, 22)),
  (r) => r.novos === 4 && igual(r.destaques.map((x) => nome(x.id)), ["a5", "d1", "a4", "a3"]));
await espera("fora: desde antes de tudo, os cinco primeiros da regra", () => fora("ana", em(PP, 0)),
  (r) => r.novos === 12 && igual(r.destaques.map((x) => nome(x.id)), TELA_1.slice(0, 5)));
await espera("fora: os posts da própria pessoa não contam", () => fora("um", em(P, 22)), (r) => r.novos === 1 && igual(r.destaques.map((x) => nome(x.id)), ["d1"]));
await espera("fora: sem marco, nada", () => fora("ana", null), (r) => r.novos === 0 && r.destaques.length === 0);
await espera("fora: nada foi gravado sobre a visita (nenhuma tabela nova de pessoa)", async () =>
  (await dono("select table_name from information_schema.tables where table_schema = 'interno' and table_name like 'rede_o7_%'")).rows.map((r) => r.table_name).sort(),
(t) => igual(t, ["rede_o7_ocultas", "rede_o7_temas_retidos"]));

// ═══════════════════ Assuntos em alta ═══════════════════
const comTag = (autor, tag, horas) => post(autor, `Falando de #${tag} hoje.`, new Date(agora - horas * 3600000).toISOString());
for (const a of ["um", "dois", "tres"]) await comTag(a, "greve", 5);           // 3 pessoas agora, 0 antes: entra, nova
for (const a of ["um", "dois"]) await comTag(a, "poucos", 5);                  // 2 pessoas: não entra
for (const a of ["um", "dois", "tres"]) await comTag(a, "parado", 5);          // 3 agora e 3 antes: não cresceu
for (const a of ["quatro", "cinco", "seis"]) await comTag(a, "parado", 60);
for (const a of ["um", "dois", "tres", "quatro"]) await comTag(a, "moradia", 5); // 4 agora, 1 antes: entra, cresceu 3
await comTag("cinco", "moradia", 70);
for (let i = 0; i < 6; i++) await comTag("seis", "sozinho", 3 + i);            // uma pessoa só, seis vezes: não entra
for (const a of ["um", "dois", "tres"]) await comTag(a, "retido", 5);
const alta = (quem) => rpc(como(p[quem]), "rede_roda_em_alta");
let altaAna;
await espera("em alta: piso de 3 pessoas e só o que cresceu; quem mais cresceu primeiro", async () => (altaAna = await alta("ana")),
  (r) => igual(r.temas.map((t) => t.tag), ["greve", "moradia", "retido"]) && r.horas === 48 && r.piso === 3);
await espera("em alta: sem número de pessoas, só a faixa e se é novo", async () => altaAna.temas,
  (ts) => ts.every((t) => igual(Object.keys(t).sort(), ["faixa", "nova", "tag"]) && t.faixa === "algumas") && ts[0].nova === true && ts[1].nova === false);
await espera("em alta: igual para todo mundo (Bia, e alguém que silenciou meio mundo)", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2), ($1, $3)", [p.bia, p.um, p.dois]);
  const b = await alta("bia");
  await dono("delete from interno.rede_silenciados where usuario = $1", [p.bia]);
  return b;
}, (b) => igual(b, altaAna));
await recusa("em alta: só a moderação retém um tema", () => rpc(como(p.ana), "rede_roda_tema_reter", { p_tag: "retido" }), "sem_permissao");
await espera("em alta: a moderação retém um tema e ele sai da lista", async () => {
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'mediacao')", [p.mod]);
  await rpc({ ...como(p.mod), aal: "aal2" }, "rede_roda_tema_reter", { p_tag: "#Retido" });
  return alta("ana");
}, (r) => igual(r.temas.map((t) => t.tag), ["greve", "moradia"]));
await espera("em alta: post só para seguidores não conta", async () => {
  for (const a of ["um", "dois", "tres"]) {
    await dono("insert into interno.rede_posts (autor, texto, publico, criado_em) values ($1, 'Combinando o #fechado entre nós.', 'seguidores', now() - interval '2 hours')", [p[a]]);
  }
  return alta("ana");
}, (r) => !r.temas.some((t) => t.tag === "fechado"));

// ═══════════════════ Ocultar resposta sem apagar ═══════════════════
await zerar();
const ocultar = (quem, resposta, sim = true) => rpc(como(p[quem]), "rede_roda_ocultar", { p_resposta: resposta, p_sim: sim });
const ocultas = (quem, de) => rpc(quem ? como(p[quem]) : visitante(), "rede_roda_ocultas", { p_post: de });
await recusa("ocultar: quem não abriu a conversa não oculta", () => ocultar("ana", id.r1), "sem_permissao");
await recusa("ocultar: nem quem escreveu a resposta", () => ocultar("cinco", id.r1), "sem_permissao");
await recusa("ocultar: o post que abre a conversa não se oculta", () => ocultar("tres", id.c1), "nao_encontrado");
await espera("ocultar: quem abriu a conversa oculta", () => ocultar("tres", id.r1), (r) => r.oculta === true);
await espera("ocultar: a resposta NÃO foi apagada", async () => um("select apagado_em, oculto, texto from interno.rede_posts where id = $1", [id.r1]), (r) => r.apagado_em === null && r.oculto === false && r.texto.length > 0);
await espera("ocultas: qualquer pessoa que vê a conversa sabe quais são, e só quem abriu pode devolver", async () => [await ocultas("ana", id.c1), await ocultas("tres", id.r1)],
  ([a, t]) => igual(a.ids, [id.r1]) && a.pode === false && igual(t.ids, [id.r1]) && t.pode === true);
await espera("ocultas: visitante não recebe nada de post só para membros", () => ocultas(null, id.c1), (r) => r.ids.length === 0 && r.pode === false);
await espera("ocultar: ninguém é avisado", async () => (await um("select count(*)::int as n from interno.rede_avisos where usuario = $1 and criado_em > now() - interval '1 minute'", [p.cinco]).catch(() => ({ n: 0 }))).n, (n) => n === 0);
await recusa("ocultar: a própria resposta não", async () => {
  const minha = (await um("insert into interno.rede_posts (autor, texto, publico, resposta_a, root_id, profundidade) values ($1, 'Obrigada!', 'membros', $2, $2, 1) returning id", [p.tres, id.c1])).id;
  return ocultar("tres", minha);
}, "invalido:propria");
await espera("ocultar: devolver a resposta ao fio", async () => {
  await ocultar("tres", id.r1, false);
  return ocultas("ana", id.c1);
}, (r) => r.ids.length === 0);

// ═══════════════════ A porta da entrada ═══════════════════
await espera("com a trava da entrada ligada, conta sem aprovação não lê a linha nem os assuntos em alta", async () => {
  const fora1 = await criarUsuario("fora@o7.local", "fora");
  await rpc(como(fora1), "eu");
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [fora1]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [fora1]);
  await dono("select interno.alumia_entrada_ligar(true)");
  const erros = [];
  for (const [f, a] of [["rede_roda_linha", { p_aba: "tudo" }], ["rede_roda_em_alta", {}], ["rede_roda_desde", { p_aba: "tudo", p_desde: em(P, 0) }], ["rede_roda_ocultas", { p_post: id.c1 }], ["rede_roda_regra", {}]]) {
    try {
      await rpc(como(fora1), f, a);
      erros.push(`${f} passou`);
    } catch (e) {
      erros.push(String(e.message));
    }
  }
  await dono("select interno.alumia_entrada_ligar(false)");
  return erros;
}, (es) => es.length === 5 && es.every((e) => e.includes("alumia_entrada")));

await banco.pg.close();
if (falhas.length) {
  console.error(`${falhas.length} falha(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`testar:alumia-o7-linha: ${certos} conferências certas.`);
