// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente de rótulos e transparência da Alumia (supabase/migracoes/20261115-alumia-o9-transparencia.sql) num Postgres de
// verdade (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · o relatório de transparência: só números agregados, nada abaixo de 3, o trimestre gravado na primeira leitura e que não muda
//     mais, os pedidos de autoridade contados na hora, aberto para quem não tem conta (fora da porta);
//   · o painel da coordenação: registrar e corrigir pedido (sem apagar), renovar o aviso de ordem sigilosa com a frase, e o aviso
//     vencido depois de 90 dias;
//   · os rótulos: só organização com selo ou a mediação rotula, lista fechada, a marca só existe para quem assina, o efeito
//     "esconder", quem foi marcado é avisado e contesta, outra pessoa da mediação decide, e o registro não se apaga;
//   · os números de components/rede/rotulos/regras.ts iguais aos do banco e os textos nos seis idiomas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o9-transparencia.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  CATEGORIAS_DO_RELATORIO, EFEITOS, FOLGA_DO_RELATORIO_DIAS, FRASE_DO_AVISO, ORGAOS, PEDIDOS, PRAZO_DO_AVISO_DIAS, RESPOSTAS, ROTULOS, numeroDoRelatorio,
} from "../components/rede/rotulos/regras.ts";

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
/** Todo número de um JSON do relatório: 3 ou mais, ou "menos_de_3". Nunca 0, 1 ou 2. */
function numerosDoRelatorio(v, saida = []) {
  if (Array.isArray(v)) v.forEach((x) => numerosDoRelatorio(x, saida));
  else if (v && typeof v === "object") for (const x of Object.values(v)) numerosDoRelatorio(x, saida);
  else if (typeof v === "number" || v === "menos_de_3") saida.push(v);
  return saida;
}
const semNumeroPequeno = (v) => numerosDoRelatorio(v).every((n) => n === "menos_de_3" || n >= 3);

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261115-alumia-o9-transparencia.sql");
ok("toda função nova é security definer com search_path fixo (menos as puras, que não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = /(alumia_transp_so_insercao|alumia_transp_n|alumia_transp_instante|alumia_transp_canario_prazo|alumia_transp_comeco|alumia_transp_folga|alumia_porta_aberta|alumia_transp_proteger|alumia_transp_m|alumia_transp_linha)\(/;
  return funcoes.length >= 30 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || puras.test(f.split("\n")[0]));
})());
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", (() => {
  const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
  const lista = sql.match(/foreach t in array array\[([^\]]+)\]/)?.[1] ?? "";
  return tabelas.length === 7 && tabelas.every((t) => lista.includes(`'${t}'`)) && /enable row level security/.test(sql) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql);
})());
ok("nenhuma tabela guarda endereço de rede nem texto livre de pedido de autoridade", (() => {
  const tabelas = sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? [];
  const pedidos = tabelas.find((t) => t.includes("alumia_transp_pedidos")) ?? "";
  return tabelas.length === 7 && !tabelas.some((t) => /\b(inet|cidr|endereco|ip)\b/.test(t)) && !/\b(processo|nota|texto|descricao|nome)\b/.test(pedidos);
})());
ok("não mexe na versão da Alumia, nem em rede_ve, e termina passando a porta em tudo",
  !/function public\.rede_alumia_versao/.test(sql) && !/function interno\.rede_ve\(/.test(sql) && !/function interno\.rede_silenciado\(/.test(sql)
  && /interno\.alumia_trancar\(\)/.test(sql.slice(-600)));
ok("a lista fechada de rótulos do código é a do banco", sql.includes(`rotulo in (${ROTULOS.map((r) => `'${r}'`).join(", ")})`));
ok("os efeitos do código são os do banco", sql.includes(`efeito in (${EFEITOS.map((r) => `'${r}'`).join(", ")})`));
ok("órgãos, pedidos e respostas do código são os do banco", sql.includes(`orgao in (${ORGAOS.map((r) => `'${r}'`).join(", ")})`)
  && sql.includes(`pedido in (${PEDIDOS.map((r) => `'${r}'`).join(", ")})`) && sql.includes(`resposta in (${RESPOSTAS.map((r) => `'${r}'`).join(", ")})`));
ok("as categorias do relatório do código são as do banco", sql.includes(`v_cats text[] := array[${CATEGORIAS_DO_RELATORIO.map((r) => `'${r}'`).join(", ")}]`));
ok("o prazo do aviso e a folga do relatório no código são os do banco", sql.includes(`select interval '${PRAZO_DO_AVISO_DIAS} days'`) && sql.includes(`select interval '${FOLGA_DO_RELATORIO_DIAS} days'`));
ok("a frase do aviso no código é a que o banco confere", sql.includes(`'${FRASE_DO_AVISO.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}'`));
ok("o número do relatório na tela segue a regra do banco", numeroDoRelatorio(12) === 12 && numeroDoRelatorio("menos_de_3") === null && numeroDoRelatorio(undefined) === null);
ok("a lista de exceções da porta é a da lei, mais o relatório de transparência", (() => {
  const daLei = ler("supabase/migracoes/20261114-alumia-o8-lei.sql").match(/create or replace function interno\.alumia_porta_aberta[\s\S]*?\n\$\$;/)[0];
  const daqui = sql.match(/create or replace function interno\.alumia_porta_aberta[\s\S]*?\n\$\$;/)[0];
  const tira = (t) => t.replace(/,\s*-- O relatório de transparência[^\n]*\n\s*'alumia_transparencia'\)/, ")");
  return tira(daqui) === daLei && daqui.includes("'alumia_transparencia'");
})());

// Os textos: as seis línguas com as mesmas chaves, listas e marcadores {x}; nenhuma palavra proibida; todo rótulo, órgão e efeito com nome.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/rotulos/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/rotulos/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`rotulos/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("o texto novo não usa \"diploma\", \"universidade\" nem \"algoritmo\"", !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt)));
  ok("todo rótulo, efeito, órgão, pedido, resposta e categoria tem nome na tela",
    ROTULOS.every((r) => pt.rotulos.nomes[r]?.nome && pt.rotulos.nomes[r]?.quer) && EFEITOS.every((e) => pt.rotulos.efeitos[e]?.nome)
    && ORGAOS.every((o) => pt.transparencia.orgaos[o]) && PEDIDOS.every((o) => pt.transparencia.pedidos[o]) && RESPOSTAS.every((o) => pt.transparencia.respostas[o])
    && CATEGORIAS_DO_RELATORIO.every((c) => pt.transparencia.categorias[c]));
  ok("a frase do aviso no texto do painel é a do código", pt.painel.frase.includes(FRASE_DO_AVISO));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const semCr = (t) => t.replace(/\r\n/g, "\n");
const noInstall = semCr(ler("supabase/install.sql")).includes(semCr(sql).trim());
const banco = await criarBanco(noInstall ? { antesDe: sql } : {});
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const visitante = { papel: "anon", ip: "203.0.113.10" };

const P = {};
const NOMES = ["coord", "vice", "mediador", "mediador2", "membro", "membro2", "alvo", "alvo2", "org", "gestora", "semselo", "gestorsem", "admin"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o9.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'vice'), ($3, 'mediacao'), ($4, 'mediacao')", [P.coord, P.vice, P.mediador, P.mediador2]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, verificada_em) values ($1, 'coletivo', 'São Paulo', 'LUME', now()), ($2, 'movimento', 'Recife', 'SEM', null)", [P.org, P.semselo]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($3, $4, 'dono')", [P.org, P.gestora, P.semselo, P.gestorsem]);

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
await espera("uma mediação só depois das três rodadas", async () => (await dono("select count(*)::int as n from interno.alumia_rotuladores where tipo = 'mediacao'")).rows[0].n, (n) => n === 1);

const C = como(P.coord), V = como(P.vice), M = como(P.mediador), M2 = como(P.mediador2);

// ═══════════════════ 2. O relatório de transparência ═══════════════════
await espera("visitante lê o relatório: em novembro de 2026 nenhum trimestre fechado, o primeiro sai em 15 de janeiro", () => rpc(visitante, "alumia_transparencia"),
  (r) => Array.isArray(r.trimestres) && r.trimestres.length === 0 && r.proximo.inicio === "2026-10-01" && r.proximo.fim === "2026-12-31" && r.proximo.sai_em === "2027-01-15");
await espera("sem renovação nenhuma, o aviso de ordem sigilosa aparece como não renovado", () => rpc(visitante, "alumia_transparencia"), (r) => r.canario.vencido === true && r.canario.renovado_em === null);

// Um trimestre de exemplo (o quarto de 2026), com números de propósito pequenos e grandes.
const post = async (autor, texto) => (await dono("insert into interno.rede_posts (autor, texto) values ($1, $2) returning id", [autor, texto])).rows[0].id;
const novembro = "2026-11-10 12:00:00-03";
for (let i = 0; i < 5; i++) {
  await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, quem, situacao, criado_em) values ('post', $1, 'spam', $2, $3, $4)",
    [`p${i}`, P.membro, i < 4 ? "resolvida" : "aberta", novembro]);
}
await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, quem, situacao, criado_em) values ('post', 'x1', 'ameaca', $1, 'descartada', $2), ('post', 'x2', 'ilegal', $1, 'resolvida', $2)", [P.membro, novembro]);
// Uma denúncia de outro trimestre não conta neste.
await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, quem, situacao, criado_em) values ('post', 'x3', 'spam', $1, 'resolvida', '2027-01-03 10:00:00-03')", [P.membro]);
for (let i = 0; i < 4; i++) {
  await dono("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem, criado_em) values ('remover', 'post', $1, 'painel', 'Motivo de teste', $2, $3)", [`post-${i}`, P.mediador, novembro]);
}
// O mesmo post retirado duas vezes conta uma.
await dono("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem, criado_em) values ('remover', 'post', 'post-0', 'painel', 'De novo', $1, $2)", [P.mediador, novembro]);
await dono("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem, criado_em) values ('suspender', 'perfil', $1, 'regra_3', 'Suspensa pela mediação', $2, $3)", [P.alvo, P.mediador, novembro]);
const relatorio = (dia) => dono("select interno.alumia_transp_relatorio($1::date) as r", [dia]).then((x) => x.rows[0].r);

const jan = await espera("em 20 de janeiro de 2027, o quarto trimestre de 2026 sai", () => relatorio("2027-01-20"),
  (r) => r.trimestres.length === 1 && r.trimestres[0].inicio === "2026-10-01" && r.trimestres[0].fim === "2026-12-31" && r.proximo.sai_em === "2027-04-15");
const q4 = jan?.trimestres[0];
ok("denúncias recebidas: 7 (a de janeiro não entra); decididas 6", q4?.numeros.denuncias.recebidas === 7 && q4?.numeros.denuncias.decididas === 6);
ok("descartadas: 1 vira \"menos_de_3\" e procedentes (5) fica \"reservado\", para o 1 não sair de 6 - 5",
  q4?.numeros.denuncias.descartadas === "menos_de_3" && q4?.numeros.denuncias.procedentes === "reservado");
ok("por tipo: spam com 5 recebidas e 4 decididas; ameaça e ilegal abaixo de 3", q4?.numeros.denuncias.por_tipo.spam.recebidas === 5 && q4?.numeros.denuncias.por_tipo.spam.decididas === 4
  && q4?.numeros.denuncias.por_tipo.ameaca.recebidas === "menos_de_3" && q4?.numeros.denuncias.por_tipo.ilegal.recebidas === "menos_de_3");
ok("posts tirados: 4 (o mesmo post duas vezes conta uma)", q4?.numeros.posts_tirados === 4);
ok("contas suspensas: 1 vira \"menos_de_3\"; nada vira zero", q4?.numeros.contas.suspensas === "menos_de_3" && q4?.numeros.contas.banidas === "menos_de_3");
ok("nenhum número do relatório é 0, 1 ou 2", semNumeroPequeno(jan));
ok("o relatório não traz id de ninguém", !!jan && !JSON.stringify(jan).includes(P.membro) && !JSON.stringify(jan).includes(P.alvo) && !JSON.stringify(jan).includes(P.mediador));

await espera("o trimestre publicado não muda: mais denúncias de novembro depois de gravado não entram", async () => {
  for (let i = 0; i < 4; i++) await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, quem, criado_em) values ('post', $1, 'odio', $2, $3)", [`t${i}`, P.membro2, novembro]);
  return relatorio("2027-02-01");
}, (r) => r.trimestres[0].numeros.denuncias.recebidas === 7 && r.trimestres[0].numeros.denuncias.por_tipo.odio.recebidas === "menos_de_3");
await recusa("ninguém altera um trimestre gravado (nem o dono do banco)", () => dono("update interno.alumia_transp_trimestres set numeros = '{}'::jsonb"), "não se alteram");
await recusa("nem apaga", () => dono("delete from interno.alumia_transp_trimestres"), "não se alteram");

// A supressão complementar (o achado da revisão): nenhum número de 1 ou 2 sai pela subtração do total e das outras partes.
await espera("a supressão complementar: total 5 com partes 4 e 1 esconde também o 4", () => dono("select interno.alumia_transp_proteger(array[5, 4, 1]::bigint[], array[true, true, true], array[array[1, 2, 3]]) as e").then((x) => x.rows[0].e),
  (e) => JSON.stringify(e) === "[false,true,true]");
await espera("e zero que se deduz pode sair (não aponta para ninguém): total 4 com partes 4 e 0", () => dono("select interno.alumia_transp_proteger(array[4, 4, 0]::bigint[], array[true, true, true], array[array[1, 2, 3]]) as e").then((x) => x.rows[0].e),
  (e) => JSON.stringify(e) === "[false,false,true]");
await espera("com vários grupos: o 2 que sairia por 6 - 4 fica escondido junto com outro número", () => dono("select interno.alumia_transp_proteger(array[9, 6, 3, 4, 2, 3]::bigint[], array[true, true, true, true, true, true], array[array[1, 2, 3], array[2, 4, 5], array[3, 6, 0]]) as e").then((x) => x.rows[0].e),
  (e) => Array.isArray(e) && e[4] === true && e.filter(Boolean).length >= 2);
const abril = "2027-05-10 12:00:00-03";
for (let i = 0; i < 5; i++) {
  await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, quem, situacao, criado_em) values ('post', $1, 'spam', $2, $3, $4)",
    [`q2-${i}`, P.membro, i < 4 ? "resolvida" : "descartada", abril]);
}
await espera("5 de spam (4 procedentes, 1 descartada): o 1 não sai por decididas - procedentes", () => relatorio("2027-07-20"), (r) => {
  const d = r.trimestres.find((t) => t.inicio === "2027-04-01")?.numeros.denuncias;
  return d && d.recebidas === 5 && d.decididas === 5 && d.descartadas === "menos_de_3" && d.procedentes === "reservado"
    && d.por_tipo.spam.recebidas === 5 && d.por_tipo.spam.decididas === 5 && semNumeroPequeno(d);
});

// ═══════════════════ 3. O painel da coordenação ═══════════════════
await recusa("a mediação não abre o painel da transparência", () => rpc(M, "alumia_transp_painel"), "sem_permissao");
await recusa("nem a vice-coordenação", () => rpc(V, "alumia_transp_painel"), "sem_permissao");
await recusa("nem um membro registra pedido", () => rpc(como(P.membro), "alumia_transp_pedido_salvar", { p_id: null, p: { recebido_em: "2026-11-05", orgao: "policia", pedido: "dados_de_conta" } }), "sem_permissao");
await recusa("visitante não chama o painel", () => rpc(visitante, "alumia_transp_painel"), "permission denied");

const pedido = await espera("a coordenação registra um pedido da polícia por dados de conta (em análise)", () => rpc(C, "alumia_transp_pedido_salvar", { p_id: null, p: { recebido_em: "2026-11-05", orgao: "policia", pedido: "dados_de_conta", contas: 2 } }),
  (r) => r.id && r.resposta === "em_analise" && r.respondido_em === null);
await recusa("órgão fora da lista é recusado", () => rpc(C, "alumia_transp_pedido_salvar", { p_id: null, p: { recebido_em: "2026-11-05", orgao: "vizinho", pedido: "dados_de_conta" } }), "invalido:orgao");
await recusa("data no futuro é recusada", () => rpc(C, "alumia_transp_pedido_salvar", { p_id: null, p: { recebido_em: "2099-01-01", orgao: "policia", pedido: "dados_de_conta" } }), "invalido:data");
await espera("e corrige quando responde: recusado", () => rpc(C, "alumia_transp_pedido_salvar", { p_id: pedido?.id, p: { recebido_em: "2026-11-05", orgao: "policia", pedido: "dados_de_conta", contas: 2, resposta: "recusado" } }),
  (r) => r.resposta === "recusado" && r.respondido_em);
for (let i = 0; i < 2; i++) await rpc(C, "alumia_transp_pedido_salvar", { p_id: null, p: { recebido_em: "2026-10-20", orgao: "judiciario", pedido: "retirar_conteudo", resposta: "atendido", respondido_em: "2026-10-22", contas: 1 } });
await espera("o painel lista os pedidos, sem nome de ninguém", () => rpc(C, "alumia_transp_painel"), (r) => r.pedidos.length === 3 && r.pedidos.every((p) => !("registrado_por" in p)));
await espera("o relatório conta os pedidos na hora, por tipo, e só a partir de 3", () => relatorio("2027-02-01"), (r) => {
  const a = r.trimestres[0].autoridade;
  return a.recebidos === 3 && a.por_orgao.judiciario === "menos_de_3" && a.por_orgao.policia === "menos_de_3" && a.por_pedido.retirar_conteudo === "menos_de_3"
    && a.contas === 4 && a.por_resposta.recusado === "menos_de_3" && semNumeroPequeno(a);
});
await espera("cada pedido vai para o registro do painel", async () => (await dono("select count(*)::int as n from interno.alumia_painel_registro where acao like 'transparencia_pedido%'")).rows[0].n, (n) => n === 4);
ok("não existe função de apagar pedido", !/function public\.alumia_transp_pedido_apagar/.test(sql));

await recusa("renovar o aviso sem a frase é recusado", () => rpc(C, "alumia_transp_canario_renovar", { p_frase: "sim" }), "invalido:frase");
await espera("renovar com a frase (maiúsculas, acento e espaço sobrando não importam)", () => rpc(C, "alumia_transp_canario_renovar", { p_frase: "  não  recebemos ORDEM sigilosa " }),
  (r) => r.vencido === false && r.renovado_em && r.vence_em);
await espera("o relatório mostra o aviso renovado hoje", () => rpc(visitante, "alumia_transparencia"), (r) => r.canario.vencido === false);
await espera("com a última renovação há 91 dias, a página diz que não foi renovado", async () => {
  await dono("alter table interno.alumia_transp_canario disable trigger alumia_transp_so_insercao");
  await dono("update interno.alumia_transp_canario set renovado_em = now() - interval '91 days'");
  await dono("alter table interno.alumia_transp_canario enable trigger alumia_transp_so_insercao");
  return rpc(visitante, "alumia_transparencia");
}, (r) => r.canario.vencido === true && r.canario.renovado_em);
await recusa("e ninguém volta a data de uma renovação", () => dono("update interno.alumia_transp_canario set renovado_em = now()"), "não se alteram");
await recusa("a mediação não renova o aviso", () => rpc(M, "alumia_transp_canario_renovar", { p_frase: FRASE_DO_AVISO }), "sem_permissao");

// ═══════════════════ 4. Rótulos: quem rotula ═══════════════════
const mediacao = (await dono("select id from interno.alumia_rotuladores where tipo = 'mediacao'")).rows[0].id;
await recusa("organização sem selo não abre o serviço de rótulos", () => rpc(como(P.gestorsem), "alumia_rotulos_abrir", { p_org: "c_semselo", p_regras: "Marcamos golpes de falsa vaquinha que circulam na nossa cidade." }), "sem_selo");
await recusa("quem não gere a organização não abre", () => rpc(como(P.membro), "alumia_rotulos_abrir", { p_org: "c_org", p_regras: "Marcamos golpes de falsa vaquinha que circulam na nossa cidade." }), "sem_permissao");
await recusa("regras curtas demais", () => rpc(como(P.gestora), "alumia_rotulos_abrir", { p_org: "c_org", p_regras: "Curto." }), "invalido:regras");
const lume = await espera("a organização com selo abre o serviço com as regras dela", () => rpc(como(P.gestora), "alumia_rotulos_abrir", { p_org: "c_org", p_regras: "Marcamos golpes de falsa vaquinha e perfis que se passam pelo coletivo." }),
  (r) => r.id && r.aberto === true);
await espera("o catálogo mostra a mediação primeiro e a organização, sem contar quem assina", () => rpc(como(P.membro), "alumia_rotulos_catalogo"),
  (r) => r.length === 2 && r[0].tipo === "mediacao" && r[1].nome && r[1].handle === "c_org" && r[1].efeito === null && r[1].posso === false && r[1].marcas === "menos_de_3"
    && !JSON.stringify(r).includes("assinantes"));
await espera("para a gestora, a organização aparece como rotulador em que ela pode marcar", () => rpc(como(P.gestora), "alumia_rotulos_catalogo"), (r) => r.find((x) => x.id === lume?.id)?.posso === true);

const postGolpe = await post(P.alvo, "Doe para a nossa vaquinha falsa! Pix na bio.");
const postNormal = await post(P.alvo2, "Assembleia amanhã às 19h no sindicato.");
await recusa("membro comum não marca em nome da organização", () => rpc(como(P.membro), "alumia_rotulos_marcar", { p_rotulador: lume?.id, p_alvo_tipo: "post", p_alvo: postGolpe, p_rotulo: "golpe", p_motivo: "Pede Pix para uma vaquinha que não existe." }), "sem_permissao");
await recusa("rótulo fora da lista fechada", () => rpc(como(P.gestora), "alumia_rotulos_marcar", { p_rotulador: lume?.id, p_alvo_tipo: "post", p_alvo: postGolpe, p_rotulo: "chato", p_motivo: "Pede Pix para uma vaquinha que não existe." }), "invalido:rotulo");
await recusa("organização não marca quem é da equipe", () => rpc(como(P.gestora), "alumia_rotulos_marcar", { p_rotulador: lume?.id, p_alvo_tipo: "perfil", p_alvo: "@c_mediador", p_rotulo: "spam", p_motivo: "Tentativa de marcar a mediação." }), "sem_permissao");
await recusa("ninguém marca a si mesmo", () => rpc(como(P.gestora), "alumia_rotulos_marcar", { p_rotulador: lume?.id, p_alvo_tipo: "perfil", p_alvo: "@c_gestora", p_rotulo: "spam", p_motivo: "Marcando a si mesma." }), "sem_permissao");
await recusa("nem a própria organização", () => rpc(como(P.gestora), "alumia_rotulos_marcar", { p_rotulador: lume?.id, p_alvo_tipo: "perfil", p_alvo: "@c_org", p_rotulo: "spam", p_motivo: "Marcando a própria organização." }), "sem_permissao");
const marca = await espera("a gestora marca o post de golpe", () => rpc(como(P.gestora), "alumia_rotulos_marcar", { p_rotulador: lume?.id, p_alvo_tipo: "post", p_alvo: postGolpe, p_rotulo: "golpe", p_motivo: "Pede Pix para uma vaquinha que não existe." }),
  (r) => r.id && r.situacao === "vale");
await recusa("a mesma marca de novo", () => rpc(como(P.gestora), "alumia_rotulos_marcar", { p_rotulador: lume?.id, p_alvo_tipo: "post", p_alvo: postGolpe, p_rotulo: "golpe", p_motivo: "Pede Pix para uma vaquinha que não existe." }), "ja_marcado");
const marcaConta = await espera("a mediação marca a conta de outra pessoa", () => rpc(M, "alumia_rotulos_marcar", { p_rotulador: mediacao, p_alvo_tipo: "perfil", p_alvo: "@c_alvo2", p_rotulo: "spam", p_motivo: "Repete o mesmo link em todas as comunidades." }),
  (r) => r.id);
await espera("a conta marcada é avisada (sem dizer quem marcou)", async () => (await dono("select texto from interno.avisos where para = $1 and categoria = 'rede' order by criado_em desc", [P.alvo])).rows,
  (rows) => rows.some((r) => r.texto.includes("rótulo") && r.texto.includes("Codinome org") && !r.texto.includes("gestora")));
await espera("as marcas do rotulador, só para quem marca em nome dele", () => rpc(como(P.gestora), "alumia_rotulos_meus", { p_rotulador: lume?.id }), (r) => r.length === 1 && r[0].rotulo === "golpe" && r[0].minha === true);
await recusa("e não para quem não marca", () => rpc(como(P.membro), "alumia_rotulos_meus", { p_rotulador: lume?.id }), "sem_permissao");

// ═══════════════════ 5. Rótulos: quem assina ═══════════════════
await espera("quem não assina não vê marca nenhuma", () => rpc(como(P.membro), "alumia_rotulos_dos_posts", { p_posts: [postGolpe, postNormal] }), (r) => r.length === 0);
await recusa("efeito fora da lista", () => rpc(como(P.membro), "alumia_rotulos_assinar", { p_rotulador: lume?.id, p_efeito: "apagar" }), "invalido:efeito");
await espera("o membro assina a organização para ser avisado", () => rpc(como(P.membro), "alumia_rotulos_assinar", { p_rotulador: lume?.id, p_efeito: "avisar" }), (r) => r.efeito === "avisar");
await espera("e passa a ver a marca no post (do rotulador que assina), sem quem marcou", () => rpc(como(P.membro), "alumia_rotulos_dos_posts", { p_posts: [postGolpe, postNormal] }),
  (r) => r.length === 1 && r[0].post === postGolpe && r[0].marcas[0].rotulo === "golpe" && r[0].marcas[0].efeito === "avisar" && !JSON.stringify(r).includes(P.gestora));
await espera("a marca da mediação não aparece para quem não assina a mediação", () => rpc(como(P.membro), "alumia_rotulos_dos_posts", { p_posts: [postNormal] }), (r) => r.length === 0);
await espera("quem foi marcado não vê a tarja nos próprios posts (vê em Rótulos)", async () => {
  await rpc(como(P.alvo), "alumia_rotulos_assinar", { p_rotulador: lume?.id, p_efeito: "avisar" });
  return rpc(como(P.alvo), "alumia_rotulos_dos_posts", { p_posts: [postGolpe] });
}, (r) => r.length === 0);
await espera("com \"avisar\", o post continua na linha", async () => (await dono("select interno.alumia_rotulo_esconde(p, $2) as e from interno.rede_posts p where id = $1", [postGolpe, P.membro])).rows[0].e, (e) => e === false);
await espera("com \"esconder\" (a lista de bloqueio assinável), o post marcado sai da linha de quem assina", async () => {
  await rpc(como(P.membro), "alumia_rotulos_assinar", { p_rotulador: lume?.id, p_efeito: "esconder" });
  return (await dono("select interno.alumia_rotulo_esconde(p, $2) as e from interno.rede_posts p where id = $1", [postGolpe, P.membro])).rows[0].e;
}, (e) => e === true);
await espera("assinando a mediação com \"esconder\", os posts da conta marcada saem também", async () => {
  await rpc(como(P.membro), "alumia_rotulos_assinar", { p_rotulador: mediacao, p_efeito: "esconder" });
  return (await dono("select interno.alumia_rotulo_esconde(p, $2) as e from interno.rede_posts p where id = $1", [postNormal, P.membro])).rows[0].e;
}, (e) => e === true);
await espera("para quem não assina, nada muda", async () => (await dono("select bool_or(interno.alumia_rotulo_esconde(p, $2)) as e from interno.rede_posts p where id in ($1, $3)", [postGolpe, P.membro2, postNormal])).rows[0].e, (e) => e === false);
await espera("o rótulo não tira o post do ar para ninguém", async () => (await dono("select oculto, retido from interno.rede_posts where id = $1", [postGolpe])).rows[0], (r) => r.oculto === false && r.retido === false);
await espera("organização que perde o selo: as marcas dela param de valer", async () => {
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org]);
  const e = (await dono("select interno.alumia_rotulo_esconde(p, $2) as e from interno.rede_posts p where id = $1", [postGolpe, P.membro])).rows[0].e;
  const cat = await rpc(como(P.membro), "alumia_rotulos_catalogo");
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org]);
  return { e, cat };
}, ({ e, cat }) => e === false && cat.length === 1 && cat[0].tipo === "mediacao");
await espera("deixar de assinar", () => rpc(como(P.membro), "alumia_rotulos_assinar", { p_rotulador: lume?.id, p_efeito: null }), (r) => r.efeito === null);

// ═══════════════════ 6. Rótulos: contestação e registro ═══════════════════
await espera("quem foi marcado vê a marca, o motivo e o rotulador (nunca a pessoa que marcou)", () => rpc(como(P.alvo), "alumia_rotulos_sobre_mim"),
  (r) => r.length === 1 && r[0].rotulo === "golpe" && r[0].motivo.includes("Pix") && r[0].nome && r[0].pode_contestar === true && !JSON.stringify(r).includes(P.gestora));
await recusa("outra pessoa não contesta a marca de alguém", () => rpc(como(P.membro), "alumia_rotulos_contestar", { p_marca: marca?.id, p_texto: "Não é golpe, é uma vaquinha de verdade." }), "nao_encontrado");
await espera("quem foi marcado contesta", () => rpc(como(P.alvo), "alumia_rotulos_contestar", { p_marca: marca?.id, p_texto: "Não é golpe: a vaquinha é do grêmio e tem prestação de contas." }), (r) => r.situacao === "contestado");
await recusa("uma vez só", () => rpc(como(P.alvo), "alumia_rotulos_contestar", { p_marca: marca?.id, p_texto: "Contestando de novo a mesma marca." }), "ja_contestado");
await espera("a fila da mediação mostra a contestação", () => rpc(M, "alumia_rotulos_fila"), (r) => r.length === 1 && r[0].contestacao.includes("grêmio") && r[0].pode === true);
await recusa("membro comum não vê a fila", () => rpc(como(P.membro), "alumia_rotulos_fila"), "sem_permissao");
await espera("a mediação reverte: a marca sai e a pessoa é avisada", async () => {
  const r = await rpc(M, "alumia_rotulos_decidir", { p_marca: marca?.id, p_decisao: "reverter", p_motivo: "O grêmio mostrou a prestação de contas." });
  const aviso = (await dono("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [P.alvo])).rows[0].texto;
  return { r, aviso };
}, ({ r, aviso }) => r.situacao === "revertido" && aviso.includes("tirou o rótulo"));
await espera("a contestação da marca da mediação: quem marcou não decide", async () => {
  await rpc(como(P.alvo2), "alumia_rotulos_contestar", { p_marca: marcaConta?.id, p_texto: "Eu só divulgo o mesmo ato em várias comunidades." });
  const fila = await rpc(M, "alumia_rotulos_fila");
  return fila.find((x) => x.id === marcaConta?.id);
}, (x) => x && x.pode === false);
await recusa("o mediador que marcou recebe \"outra_pessoa\"", () => rpc(M, "alumia_rotulos_decidir", { p_marca: marcaConta?.id, p_decisao: "manter", p_motivo: "Mantenho a marca que eu mesmo pus." }), "outra_pessoa");
await espera("outra pessoa da mediação mantém", () => rpc(M2, "alumia_rotulos_decidir", { p_marca: marcaConta?.id, p_decisao: "manter", p_motivo: "O mesmo link em vinte comunidades no mesmo dia." }), (r) => r.situacao === "vale");
await espera("mantida, a marca não se contesta de novo", () => rpc(como(P.alvo2), "alumia_rotulos_sobre_mim"), (r) => r[0].situacao === "vale" && r[0].pode_contestar === false && r[0].decisao);
await espera("o rotulador retira a marca que pôs", () => rpc(M2, "alumia_rotulos_retirar", { p_marca: marcaConta?.id, p_motivo: "A pessoa parou de repetir o link." }), (r) => r.situacao === "retirado");
await espera("o registro tem cada passo, sem o alvo", async () => (await dono("select acao from interno.alumia_rotulos_registro order by id")).rows.map((r) => r.acao),
  (acoes) => acoes.join() === "marcar,marcar,contestar,reverter,contestar,manter,retirar");
await recusa("ninguém apaga o registro das marcas", () => dono("delete from interno.alumia_rotulos_registro"), "não se alteram");
ok("o registro não tem coluna de alvo", !/alumia_rotulos_registro \([\s\S]*?\b(perfil|post|alvo)\b[\s\S]*?\n\);/.test(sql.match(/create table if not exists interno\.alumia_rotulos_registro \([\s\S]*?\n\);/)?.[0] ?? "x perfil"));

await espera("o relatório conta as marcas, contestações e reversões do trimestre (a partir de 3)", () => dono("select interno.alumia_transp_contar(date_trunc('quarter', now())::date) as r").then((x) => x.rows[0].r),
  (r) => r.rotulos.marcas === "menos_de_3" && r.rotulos.contestadas === "menos_de_3" && semNumeroPequeno(r));

// ═══════════════════ 7. A porta ═══════════════════
await dono("select interno.alumia_entrada_ligar(true)");
await espera("com a entrada fechada, visitante continua lendo o relatório", () => rpc(visitante, "alumia_transparencia"), (r) => Array.isArray(r.trimestres));
await recusa("e os rótulos passam pela porta (sessão sem o segundo fator)", () => rpc(como(P.membro, "aal1"), "alumia_rotulos_catalogo"), "alumia_entrada");
await dono("select interno.alumia_entrada_ligar(false)");
await espera("nenhuma permissão para visitante fora o relatório", async () => (await dono(`
  select bool_and(has_function_privilege('anon', p.oid, 'execute') = (p.proname = 'alumia_transparencia')) as ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'alumia_transp%' or p.proname like 'alumia_rotulos%')`)).rows[0].ok, (ok) => ok === true);

await banco.pg.close();
console.log(`\n${certos} conferências certas, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
