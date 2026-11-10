// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o B1 dos atos (supabase/migracoes/20261110-alumia-b1-atos.sql) num Postgres de verdade (scripts/banco-local.mjs), com a
// migração rodada mais duas vezes sobre o install.sql. Matriz: visitante, quem organizou, membros que confirmaram e que não,
// bloqueado. Regras: a borda de 3 não acende na hora; tarefas mostram codinome só a quem organiza; caronas sem contato e sem quem;
// petição sem lista e total só a partir de 3; lembretes de 24 h e 2 h só a quem confirmou, sem nome; meta e link editáveis só por
// quem organizou; nenhuma resposta traz id de pessoa.
// Uso: npm run testar:alumia-b1-atos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarClienteDosAtos } from "../lib/rede/cliente-atos.ts";
import { codigoDoErro } from "../lib/rede/atos/erros.ts";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
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

const sql = ler("supabase/migracoes/20261110-alumia-b1-atos.sql");
ok("a migração está colada no FIM do install.sql (seguida só das datadas posteriores)", noFimDoInstall(sql, ler("supabase/install.sql")));
ok("toda função nova é security definer (ou imutável) com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 20 && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f) && (/security definer/.test(f) || /immutable/.test(f)));
})());
ok("nenhuma permissão direta nas tabelas para anon/authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("a migração cita a LGPD com o artigo", /art\. 11/.test(sql) && /art\. 18, IX/.test(sql));
ok("o package.json tem a linha do teste", /"testar:alumia-b1-atos"/.test(ler("package.json")));

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala de novo sobre o install.sql (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));

// ── pessoas ──
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const P = {};
const nomes = ["org", "m1", "m2", "m3", "m4", "m5", "bloqueado"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@b1atos.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${i + 1}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_handle = 'movimento_zl' where id = $1", [P.org]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.org, P.bloqueado]);
// Uma comunidade aberta e pública na internet: o ato principal é lido também por visitante.
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet') on conflict (slug) do update set categoria = 'disciplinas', tipo = 'aberta', publico_padrao = 'internet'");

const daqui = (horas) => new Date(Date.now() + horas * 3_600_000).toISOString();
const chamar = (quem, extra = {}) => rpc(como(P[quem]), "rede_ato_publicar", { p: {
  titulo: "Fica Esperança", inicio: daqui(72), onde: "Ocupação Esperança · na porta", cidade: "São Paulo", descricao: "Vigília na porta da ocupação.", ...extra,
} });
const ato = await espera("a organização chama um ato com meta e link de apoio", () => chamar("org", { meta: 100, link_apoio: "https://exemplo.org/fundo", comunidade: "matematica", publico: "internet" }), (a) => a.meta === 100 && a.link_apoio === "https://exemplo.org/fundo");
const ID = ato?.id;
const ler1 = (quem) => rpc(quem ? como(P[quem]) : visitante(), "rede_ato", { p_id: ID });
const semIds = (s) => !Object.values(P).some((id) => s.includes(id));
// Faz o tempo andar: tudo o que entrou (e saiu) recua 20 minutos, para cair antes do último marco.
const passarMarco = () => exec("update interno.rede_vou set criado_em = criado_em - interval '20 minutes'; update interno.rede_contagem_saidas set entrou_em = entrou_em - interval '20 minutes', saiu_em = saiu_em - interval '20 minutes'; update interno.rede_peticao_assinaturas set criado_em = criado_em - interval '20 minutes'");

// ═══════════════════ 1. A borda de 3 ═══════════════════
{
  const ATO = (await chamar("org", { titulo: "Borda de três" }))?.id;
  const vou = (quem, sim = true) => rpc(como(P[quem]), "rede_ato_vou", { p_id: ATO, p_sim: sim });
  await vou("m1");
  await vou("m2");
  await passarMarco();
  await espera("com 2 confirmações publicadas, nada acende", () => rpc(como(P.m4), "rede_ato", { p_id: ATO }), (a) => a.acesos === null);
  await espera("a 3ª confirmação NÃO acende na hora para quem confirma", () => vou("m3"), (r) => r.vou_eu === true && r.acesos === null && r.total === null);
  await espera("nem para quem lê logo depois", () => rpc(como(P.m4), "rede_ato", { p_id: ATO }), (a) => a.acesos === null);
  await espera("quem organizou vê o total exato na hora", () => rpc(como(P.org), "rede_ato", { p_id: ATO }), (a) => a.total === 3 && a.acesos === null);
  await passarMarco();
  await espera("depois do marco, acende 10 %", () => rpc(como(P.m4), "rede_ato", { p_id: ATO }), (a) => a.acesos === 0.1);
  await espera("desfazer não apaga na hora (a saída só conta no próximo marco)", () => vou("m3", false), (r) => r.vou_eu === false && r.acesos === 0.1);
  await espera("a saída guarda só o intervalo, sem a pessoa", () => dono("select * from interno.rede_contagem_saidas where alvo = $1", [ATO]), (r) => r.rows.length === 1 && !("usuario" in r.rows[0]) && semIds(JSON.stringify(r.rows)));
  await espera("confirmar de novo no mesmo marco não conta duas vezes", async () => { await vou("m3"); return rpc(como(P.m4), "rede_ato", { p_id: ATO }); }, (a) => a.acesos === 0.1);
  await vou("m3", false);
  await passarMarco();
  await espera("no marco seguinte, com 2, apaga", () => rpc(como(P.m4), "rede_ato", { p_id: ATO }), (a) => a.acesos === null);
  await espera("apagar o post não deixa saída", async () => {
    await dono("delete from interno.rede_posts where id = $1", [ATO]);
    return um("select count(*)::int as n from interno.rede_contagem_saidas where alvo = $1 and saiu_em > now() - interval '1 minute'", [ATO]);
  }, (r) => r.n === 0);
}

// ═══════════════════ 2. Meta e link de apoio ═══════════════════
{
  const editar = (quem, p) => rpc(como(P[quem]), "rede_ato_editar", { p_id: ID, p });
  await recusa("membro não edita a meta", () => editar("m1", { meta: 50 }), "so_quem_organizou");
  await recusa("visitante não edita", () => rpc(visitante(), "rede_ato_editar", { p_id: ID, p: { meta: 50 } }), "permission denied");
  await recusa("meta abaixo de 3", () => editar("org", { meta: 2 }), "invalido:meta");
  await recusa("meta que não é número", () => editar("org", { meta: "muitas" }), "invalido:meta");
  await recusa("link sem https", () => editar("org", { link_apoio: "http://exemplo.org" }), "invalido:link_apoio");
  await recusa("link com telefone é dado pessoal", () => editar("org", { link_apoio: "https://exemplo.org/(11)98888-7777" }), "dado_pessoal");
  await espera("quem organizou muda só a meta (o link fica)", () => editar("org", { meta: 300 }), (a) => a.meta === 300 && a.link_apoio === "https://exemplo.org/fundo");
  await espera("e tira o link (vazio)", () => editar("org", { link_apoio: "" }), (a) => a.meta === 300 && a.link_apoio === null);
  await espera("e tira a meta (nulo)", () => editar("org", { meta: null, link_apoio: "https://exemplo.org/greve" }), (a) => a.meta === null && a.link_apoio === "https://exemplo.org/greve");
  await espera("o código do erro vira frase específica na tela (link)", async () => codigoDoErro(new Error("invalido:link_apoio")), (c) => c === "link_apoio");
}

// ═══════════════════ 3. Quadro de tarefas ═══════════════════
let T1;
{
  const tarefas = (quem) => rpc(quem ? como(P[quem]) : visitante(), "rede_ato_tarefas", { p_ato: ID });
  const criar = (quem, item, quantos = 1) => rpc(como(P[quem]), "rede_ato_tarefa_criar", { p_ato: ID, p_item: item, p_quantos: quantos });
  const assumir = (quem, id, sim = true) => rpc(como(P[quem]), "rede_ato_tarefa_assumir", { p_tarefa: id, p_sim: sim });
  await recusa("membro não cria tarefa", () => criar("m1", "Caixa de som"), "so_quem_organizou");
  await recusa("item curto", () => criar("org", "x"), "invalido:item");
  await recusa("quantos fora do limite", () => criar("org", "Faixa", 0), "invalido:quantos");
  await recusa("item com telefone é dado pessoal", () => criar("org", "Liga (11) 98888-7777"), "dado_pessoal");
  await criar("org", "Caixa de som", 1);
  const lista = await espera("quem organiza cria e vê as tarefas", () => criar("org", "Faixas", 2), (r) => r.organiza === true && r.tarefas.length === 2 && r.tarefas[0].assumidas === 0);
  T1 = lista?.tarefas[0].id;
  const T2 = lista?.tarefas[1].id;
  await espera("visitante vê os itens, sem quem e sem quantas pessoas", () => tarefas(null), (r) => r.organiza === false && r.tarefas.length === 2 && r.tarefas.every((t) => t.quem === null && t.assumidas === null && t.eu === false));
  await espera("m1 assume a caixa de som: vê que é dela, mas não o próprio codinome numa lista", () => assumir("m1", T1), (r) => r.tarefas[0].eu === true && r.tarefas[0].completa === true && r.tarefas[0].quem === null);
  await recusa("a caixa de som já tem quem leve", () => assumir("m2", T1), "tarefa_completa");
  await espera("m2 e m3 levam faixas", async () => { await assumir("m2", T2); return assumir("m3", T2); }, (r) => r.tarefas[1].completa === true && r.tarefas[1].eu === true);
  await espera("m4 vê 'já tem quem leve', sem ninguém", () => tarefas("m4"), (r) => r.tarefas.every((t) => t.completa && !t.eu && t.quem === null && t.assumidas === null));
  await espera("quem organiza vê os codinomes de quem assumiu", () => tarefas("org"), (r) => JSON.stringify(r.tarefas[0].quem) === '["Codinome 2"]' && r.tarefas[1].assumidas === 2 && r.tarefas[1].quem.length === 2);
  await espera("desfazer sempre pode", () => assumir("m3", T2, false), (r) => r.tarefas[1].completa === false && r.tarefas[1].eu === false);
  await recusa("bloqueado nem acha o ato", () => tarefas("bloqueado"), "nao_encontrado");
  await espera("nenhuma resposta de tarefa traz id de pessoa", async () => JSON.stringify([await tarefas("org"), await tarefas("m1"), await tarefas(null)]), semIds);
  await espera("quem organiza tira uma tarefa", () => rpc(como(P.org), "rede_ato_tarefa_apagar", { p_tarefa: T2 }), (r) => r.tarefas.length === 1);
  await recusa("membro não tira tarefa", () => rpc(como(P.m1), "rede_ato_tarefa_apagar", { p_tarefa: T1 }), "so_quem_organizou");
}

// ═══════════════════ 4. Caronas ═══════════════════
{
  const caronas = (quem) => rpc(como(P[quem]), "rede_ato_caronas", { p_ato: ID });
  const criar = (quem, p) => rpc(como(P[quem]), "rede_ato_carona_criar", { p_ato: ID, p });
  const oferta = { tipo: "oferta", meio: "carro", saida: "Metrô Itaquera, saída B", vagas: 3, sai_em: daqui(71) };
  await recusa("visitante não vê caronas", () => rpc(visitante(), "rede_ato_caronas", { p_ato: ID }), "permission denied");
  await recusa("telefone na saída é barrado", () => criar("m1", { ...oferta, saida: "Me chama no 11 98888-7777" }), "dado_pessoal");
  await recusa("telefone sem DDD também", () => criar("m1", { ...oferta, saida: "Chama 98888 7777 ok" }), "dado_pessoal");
  await recusa("endereço com número é barrado", () => criar("m1", { ...oferta, saida: "Rua das Flores, 123" }), "dado_pessoal");
  await recusa("e-mail é barrado", () => criar("m1", { ...oferta, saida: "fulana@exemplo.org" }), "dado_pessoal");
  await recusa("tipo inventado", () => criar("m1", { ...oferta, tipo: "venda" }), "invalido:tipo");
  await recusa("saída depois do ato", () => criar("m1", { ...oferta, sai_em: daqui(80) }), "invalido:sai_em");
  await recusa("vagas fora do limite", () => criar("m1", { ...oferta, vagas: 99 }), "invalido:vagas");
  const r1 = await espera("m1 oferece carona", () => criar("m1", oferta), (r) => r.length === 1 && r[0].minha === true && r[0].saida === "Metrô Itaquera, saída B" && r[0].vagas === 3);
  await espera("m2 pede ônibus", () => criar("m2", { tipo: "pedido", meio: "onibus", saida: "Terminal Parque Dom Pedro" }), (r) => r.length === 2);
  await espera("m4 vê as duas, nenhuma dela, sem quem", () => caronas("m4"), (r) => r.length === 2 && r.every((k) => k.minha === false && k.apagar === false && !("quem" in k)));
  await espera("quem organiza pode tirar (abuso), sem ver de quem é", () => caronas("org"), (r) => r.every((k) => k.apagar === true && k.minha === false));
  await espera("nenhuma resposta de carona traz id de pessoa", async () => JSON.stringify([await caronas("org"), await caronas("m4")]), semIds);
  await espera("a dona muda as vagas para lotada", () => rpc(como(P.m1), "rede_ato_carona_vagas", { p_id: r1?.[0]?.id ?? r1?.find((k) => k.minha)?.id, p_vagas: 0 }), (r) => r.some((k) => k.minha && k.vagas === 0));
  await recusa("outra pessoa não muda as vagas", () => rpc(como(P.m4), "rede_ato_carona_vagas", { p_id: r1?.[0]?.id, p_vagas: 2 }), "nao_encontrado");
  await recusa("outra pessoa não tira a carona", () => rpc(como(P.m4), "rede_ato_carona_apagar", { p_id: r1?.[0]?.id }), "nao_encontrado");
  await criar("m1", { tipo: "oferta", meio: "van", saida: "Praça do Forró" });
  await recusa("até 2 por pessoa por ato", () => criar("m1", { tipo: "pedido", meio: "a_pe", saida: "Largo do Rosário" }), "invalido:caronas");
  await espera("a dona tira a carona", () => rpc(como(P.m1), "rede_ato_carona_apagar", { p_id: r1?.[0]?.id }), (r) => r.length === 2);
  await espera("bloqueado por quem ofereceu não vê a carona", async () => {
    await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.m2, P.m5]);
    return caronas("m5");
  }, (r) => r.length === 1 && r[0].tipo === "oferta");
}

// ═══════════════════ 5. Petição sem lista ═══════════════════
{
  const pet = (quem) => rpc(quem ? como(P[quem]) : visitante(), "rede_peticao", { p_ato: ID });
  const criar = (quem, p) => rpc(como(P[quem]), "rede_peticao_criar", { p_ato: ID, p });
  const assinar = (quem, id, sim = true) => rpc(como(P[quem]), "rede_peticao_assinar", { p_peticao: id, p_sim: sim });
  const pedido = { alvo: "Prefeitura de São Paulo", texto: "Pedimos que a reintegração da ocupação Esperança seja suspensa até haver moradia digna.", prazo: daqui(24 * 30) };
  await espera("sem petição: nulo", () => pet("m1"), (r) => r === null);
  await recusa("membro não cria petição no ato de outra pessoa", () => criar("m1", pedido), "so_quem_organizou");
  await recusa("texto curto", () => criar("org", { ...pedido, texto: "Curto." }), "invalido:texto");
  await recusa("prazo no passado", () => criar("org", { ...pedido, prazo: daqui(-1) }), "invalido:prazo");
  await recusa("e-mail no texto é dado pessoal", () => criar("org", { ...pedido, texto: `${pedido.texto} Escreva para fulana@exemplo.org.` }), "dado_pessoal");
  const p = await espera("quem organiza abre a petição", () => criar("org", pedido), (r) => r.aberta === true && r.total === null && r.organiza === true && r.assinei === false);
  const PID = p?.id;
  await recusa("só uma por ato", () => criar("org", pedido), "peticao_existe");
  await espera("visitante lê a petição de ato público, sem total", () => pet(null), (r) => r.alvo === pedido.alvo && r.total === null && r.organiza === false);
  await recusa("visitante não assina", () => rpc(visitante(), "rede_peticao_assinar", { p_peticao: PID, p_sim: true }), "permission denied");
  await espera("1ª assinatura", () => assinar("m1", PID), (r) => r.assinei === true && r.total === null);
  await assinar("m2", PID);
  await espera("a 3ª assinatura não mostra o total na hora", () => assinar("m3", PID), (r) => r.total === null);
  await espera("quem criou também não vê lista nem total abaixo do marco", () => pet("org"), (r) => r.total === null && !("assinaturas" in r));
  await passarMarco();
  await espera("depois do marco, total 3 para todo mundo", () => pet(null), (r) => r.total === 3);
  await espera("tirar a assinatura sempre pode (o total só muda no marco)", () => assinar("m3", PID, false), (r) => r.assinei === false && r.total === 3);
  await passarMarco();
  await espera("com 2, o total some", () => pet("m4"), (r) => r.total === null);
  await recusa("bloqueado não assina", () => assinar("bloqueado", PID), "nao_encontrado");
  await espera("nenhuma resposta de petição traz id de pessoa nem codinome", async () => JSON.stringify([await pet("org"), await pet("m1"), await pet(null)]), (s) => semIds(s) && !/Codinome/.test(s));
  await recusa("membro não encerra", () => rpc(como(P.m1), "rede_peticao_encerrar", { p_peticao: PID }), "so_quem_organizou");
  await espera("quem organiza encerra", () => rpc(como(P.org), "rede_peticao_encerrar", { p_peticao: PID }), (r) => r.aberta === false);
  await recusa("encerrada não recebe assinatura", () => assinar("m4", PID), "peticao_encerrada");
  await espera("e ainda dá para tirar a assinatura", () => assinar("m1", PID, false), (r) => r.assinei === false);
  ok("a petição não entra no post (nunca federa)", !/peticao/.test(JSON.stringify((await um("select chamado from interno.rede_posts where id = $1", [ID])).chamado)));
}

// ═══════════════════ 6. Lembretes de 24 h e 2 h ═══════════════════
{
  const A = (await chamar("org", { titulo: "Lembrete de amanhã", inicio: daqui(20) }))?.id;
  for (const m of ["m1", "m2"]) await rpc(como(P[m]), "rede_ato_vou", { p_id: A, p_sim: true });
  await dono("insert into interno.rede_avisos_prefs (usuario, tipo, canal, ligado) values ($1, 'lembrete', 'site', false) on conflict (usuario, tipo, canal) do update set ligado = false", [P.m2]);
  const lembretes = () => dono("select interno.rede_ato_lembretes() as r").then((r) => r.rows[0].r);
  const avisos = (post) => dono("select para, texto from interno.avisos where post = $1 and texto like 'Lembrete:%'", [post]).then((r) => r.rows);
  await recusa("ninguém de fora roda os lembretes", () => banco.exclusivo(async () => {
    await banco.pg.exec("set role authenticated");
    try {
      return await banco.pg.query("select interno.rede_ato_lembretes()");
    } finally {
      await banco.pg.exec("reset role");
    }
  }), "permission denied");
  await espera("o lembrete de 24 h sai", () => lembretes(), (r) => r.avisos >= 1);
  await espera("só para quem confirmou e não desligou, sem nome", () => avisos(A), (r) => r.length === 1 && r[0].para === P.m1 && /24 horas/.test(r[0].texto) && !/Codinome|movimento/.test(r[0].texto));
  await espera("rodar de novo não repete", async () => { await lembretes(); return avisos(A); }, (r) => r.length === 1);
  await espera("nada guardado por pessoa: só a hora no ato", () => um("select lembrete_24h_em is not null as a, lembrete_2h_em is null as b from interno.rede_chamados where post = $1", [A]), (r) => r.a && r.b);
  await dono("update interno.rede_chamados set inicio = now() + interval '90 minutes' where post = $1", [A]);
  await espera("chegar a 2 h (mudar a data zera) manda o das 2 h", async () => { await lembretes(); return avisos(A); }, (r) => r.length === 2 && r.some((x) => /2 horas/.test(x.texto)));
  const B = (await chamar("org", { titulo: "Em cima da hora", inicio: daqui(5) }))?.id;
  await rpc(como(P.m1), "rede_ato_vou", { p_id: B, p_sim: true });
  await espera("ato chamado em cima da hora não recebe o de 24 h", async () => { await lembretes(); return avisos(B); }, (r) => r.length === 0);
  const C = (await chamar("org", { titulo: "Cancelado amanhã", inicio: daqui(20) }))?.id;
  await rpc(como(P.m1), "rede_ato_vou", { p_id: C, p_sim: true });
  await rpc(como(P.org), "rede_ato_mudar", { p_id: C, p_situacao: "cancelado", p_motivo: "" });
  await espera("ato cancelado não lembra", async () => { await lembretes(); return avisos(C); }, (r) => r.length === 0);
  ok("o aviso usa o tipo 'chamado' (o push vai sem texto)", (await um("select count(*)::int as n from interno.avisos where post = $1 and tipo = 'chamado' and texto like 'Lembrete:%'", [A])).n === 2);
}

// ═══════════════════ 7. O cliente do site sobre o banco de verdade ═══════════════════
{
  const chamarComo = (quem) => (funcao, argumentos = {}) => rpc(quem ? como(P[quem]) : visitante(), funcao, argumentos);
  const cOrg = criarClienteDosAtos(chamarComo("org"));
  const cM4 = criarClienteDosAtos(chamarComo("m4"));
  await espera("cliente: tarefas de quem não organiza não trazem quem", () => cM4.tarefas(ID), (r) => r.tarefas.every((t) => t.quem === null && t.assumidas === null));
  await espera("cliente: quem organiza vê o codinome", () => cOrg.tarefas(ID), (r) => r.tarefas.some((t) => (t.quem ?? []).length > 0));
  await espera("cliente: caronas", () => cM4.caronas(ID), (r) => Array.isArray(r) && r.every((k) => typeof k.saida === "string"));
  await espera("cliente: editar a meta", () => cOrg.editar(ID, { meta: 40 }), (a) => a.meta === 40);
  await espera("cliente: petição encerrada", () => cM4.peticao(ID), (r) => r?.aberta === false);
  await espera("cliente: publicar com meta e link", () => cOrg.publicar({ tipo: "ato", titulo: "Ato com meta", palavra: "META", quando: daqui(48), onde: "Praça da Sé", cidade: "São Paulo", descricao: "Com meta.", meta: 50, link_apoio: "https://exemplo.org/vaquinha", pronto: true, problemas: {} }), (a) => a.meta === 50 && a.link_apoio === "https://exemplo.org/vaquinha");
}

await banco.pg.close?.();
console.log(`Alumia (B1 dos atos no banco): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
