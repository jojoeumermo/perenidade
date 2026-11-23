// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A integração das duas faixas, o banco final (supabase/migracoes/20261121-alumia-integracao.sql), num Postgres de verdade
// (scripts/banco-local.mjs):
//   · o install.sql do ramo sobe do zero; a migração da integração roda duas vezes por cima dele;
//   · o corpo final de cada função que as duas faixas redefinem: a lista sem a porta, a porta que não libera em silêncio, quem vê
//     o post, a federação, publicar e o post como a tela recebe;
//   · nenhuma função com valor padrão que dependa do tipo linha de uma tabela (pg_proc e pg_depend); nenhuma security definer de
//     interno ao alcance de todo mundo; trancar não acha nada aberto; o chat da equipe fora da porta e com a conferência dele;
//   · o rótulo de robô dentro do post (autor.robo);
//   · o post restrito cifrado (P21): só no núcleo e na comunidade fechada, só de quem é do grupo, sem texto aberto; quem é do grupo
//     recebe o corpo cifrado e quem não é não recebe o post; não federa nem sai por RSS, incorporação, Telegram, resumo, aviso
//     com trecho ou busca;
//   · o "internet" do perfil no modo total do Fediverso (P9) e o que os pedidos P11, P18, P19 e P20 deixaram no banco.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-integracao.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

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
const SQL = normal(ler("supabase/migracoes/20261121-alumia-integracao.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não guarda nem lê endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr/i.test(semComentario));
ok("a migração não mexe na versão da Alumia", !/rede_alumia_versao/.test(semComentario));
{
  const redefinidas = [...semComentario.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\(/g)].map((m) => m[1]);
  ok(`a migração redefine só as quatro (${redefinidas.join(", ")})`,
    redefinidas.join() === "interno.alumia_alc_sai,interno.rede_fed_federavel,interno.rede_post_v2,public.rede_publicar");
  ok("nenhuma tabela nova e nenhuma permissão de tabela", !/create table|grant [a-z, ]+ on (table )?interno\./i.test(semComentario));
}

{
  // A tela: o cartão usa autor.robo quando a chave vem e só pergunta por alumia_pontes_rotulos quando ela não vem.
  const rotulo = ler("components/rede/pontes/RotuloDeRobo.tsx");
  ok("o rótulo no cartão usa autor.robo do post sem chamada, e pergunta só sem a chave",
    /const veio = post\.autor != null && "robo" in post\.autor;/.test(rotulo) && /const autor = veio \? null :/.test(rotulo) && /if \(!autor\) return;/.test(rotulo));
}

// ═══════════════════ 1. O banco do zero e a migração duas vezes ═══════════════════
const install = normal(ler("supabase/install.sql"));
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const linhas = async (s, v = []) => (await dono(s, v)).rows;
const um = async (s, v = []) => (await dono(s, v)).rows[0];
ok("o install.sql do ramo sobe do zero", true);
await espera("a migração da integração roda por cima do install.sql", () => exec(SQL));
await espera("e de novo (idempotente)", () => exec(SQL));
if (install.includes(SQL)) ok("a migração está no fim do install.sql (depois dela, só o fim da integração)", noFimDoInstall(SQL, install));
{
  // O fim da integração: a versão 12, a porta, e ele por último no install.sql, depois do resumo e da integração.
  const FIM = normal(ler("supabase/migracoes/20261121-alumia-integracao-fim.sql"));
  const RESUMO = normal(ler("supabase/migracoes/20261121-alumia-int-resumo.sql"));
  const ONDA14 = normal(ler("supabase/migracoes/20261120-alumia-onda14-fim.sql"));
  ok("o fim da integração sobe a versão para 12", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 12\s*\$\$/.test(FIM));
  ok("o fim da integração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(FIM));
  // Depois do fim da integração vêm só as migrações do beta fechado (22/11), inteiras, e o fim do beta por último.
  ok("o fim da integração está no install.sql, e depois dele só migrações datadas inteiras", noFimDoInstall(FIM, install));
  const BETA_FIM = normal(ler("supabase/migracoes/20261122-alumia-beta-fim.sql"));
  // Depois do fim do beta vêm só as migrações da onda R1 (23/11), inteiras, e o fim da R1 por último.
  ok("o fim do beta está no install.sql, e depois dele só migrações datadas inteiras", noFimDoInstall(BETA_FIM, install));
  const R1 = ["banco", "uso", "fediverso", "borda", "fim"].map((n) => normal(ler(`supabase/migracoes/20261123-r1-${n}.sql`)));
  // Depois do fim da R1 vêm só as migrações da onda R2 (24/11), inteiras, e o fim da R2 por último.
  ok("o fim da R1 está no install.sql, e depois dele só migrações datadas inteiras", noFimDoInstall(R1[4], install));
  ok("o fim da R1 sobe a versão para 14", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 14\s*\$\$/.test(R1[4]));
  ok("o fim da R1 termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(R1[4]));
  const posR1 = R1.map((t) => install.lastIndexOf(t));
  ok("ordem da R1 no fim do install.sql: fim do beta, banco, uso, fediverso, borda, fim da R1 (cada uma uma vez só)",
    install.lastIndexOf(BETA_FIM) < posR1[0] && posR1.every((k, i) => k > 0 && (i === 0 || posR1[i - 1] < k))
    && R1.every((t) => install.indexOf(t) === install.lastIndexOf(t)));
  const R2 = ["caixas", "dupla", "equipe", "franquia", "grupos", "membros", "voto", "fim"].map((n) => normal(ler(`supabase/migracoes/20261124-r2-${n}.sql`)));
  // Depois do fim da R2 vêm só as migrações da onda R3 (25/11), inteiras, e o fim da R3 por último.
  ok("o fim da R2 está no install.sql, e depois dele só migrações datadas inteiras", noFimDoInstall(R2[7], install));
  ok("o fim da R2 sobe a versão para 15", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 15\s*\$\$/.test(R2[7]));
  ok("o fim da R2 termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(R2[7]));
  ok("cada migração da R2 termina passando a porta", R2.every((t) => /select interno\.alumia_trancar\(\);$/.test(t)));
  const posR2 = R2.map((t) => install.lastIndexOf(t));
  ok("ordem da R2 no fim do install.sql: fim da R1, caixas, dupla, equipe, franquia, grupos, membros, voto, fim da R2 (cada uma uma vez só)",
    install.lastIndexOf(R1[4]) < posR2[0] && posR2.every((k, i) => k > 0 && (i === 0 || posR2[i - 1] < k))
    && R2.every((t) => install.indexOf(t) === install.lastIndexOf(t)));
  const R3 = ["resto-r2", "sem-internet-formal", "servidor-chat", "publico-ferramentas", "fim"].map((n) => normal(ler(`supabase/migracoes/20261125-r3-${n}.sql`)));
  // Depois do fim da R3 vêm só as migrações do Prompt 5 (26/11), inteiras, e o fim do Prompt 5 por último.
  ok("o fim da R3 está no install.sql, e depois dele só migrações datadas inteiras", noFimDoInstall(R3[4], install));
  ok("o fim da R3 sobe a versão para 16", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 16\s*\$\$/.test(R3[4]));
  ok("cada migração da R3 termina passando a porta", R3.every((t) => /select interno\.alumia_trancar\(\);$/.test(t)));
  const posR3 = R3.map((t) => install.lastIndexOf(t));
  ok("ordem da R3 no fim do install.sql: fim da R2, resto da R2, sem internet, servidor do chat, público e ferramentas, fim da R3 (cada uma uma vez só)",
    install.lastIndexOf(R2[7]) < posR3[0] && posR3.every((k, i) => k > 0 && (i === 0 || posR3[i - 1] < k))
    && R3.every((t) => install.indexOf(t) === install.lastIndexOf(t)));
  const P5 = ["publicar", "entrada", "somente-leitura", "equipe", "escola", "avisos", "beta", "federacao", "stories", "emergencia", "design", "imagens", "stories-mais", "auditoria", "fim"].map((n) => normal(ler(`supabase/migracoes/20261126-p5-${n}.sql`)));
  // Depois do fim do Prompt 5 vêm só as migrações do Prompt 4 (27/11), inteiras, e o fim do Prompt 4 por último.
  ok("o fim do Prompt 5 está no install.sql, e depois dele só migrações datadas inteiras", noFimDoInstall(P5[P5.length - 1], install));
  ok("o fim do Prompt 5 sobe a versão para 17", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 17\s*\$\$/.test(P5[P5.length - 1]));
  ok("o fim do Prompt 5 termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(P5[P5.length - 1]));
  ok("antes do fim, nenhuma migração do Prompt 5 mexe na versão ou na lista da porta",
    P5.slice(0, -1).every((t) => !/function public\.rede_alumia_versao|function interno\.alumia_porta_aberta/.test(t)));
  ok("cada migração do Prompt 5 diz que roda depois do fim da R3 (versão 16)",
    P5.every((t) => /Roda depois de 20261125-r3-fim\.sql \(banco na versão 16\)/.test(t.replace(/\n-- /g, " "))));
  const posP5 = P5.map((t) => install.lastIndexOf(t));
  ok("ordem do Prompt 5 no fim do install.sql: fim da R3, publicar, entrada, somente leitura, equipe, escola, avisos, beta, federação, stories, emergência, design, imagens, stories (mais), fim do Prompt 5 (cada uma uma vez só)",
    install.lastIndexOf(R3[4]) < posP5[0] && posP5.every((k, i) => k > 0 && (i === 0 || posP5[i - 1] < k))
    && P5.every((t) => install.indexOf(t) === install.lastIndexOf(t)));
  const P4 = ["cifrado-sem-anexo", "anexo-cifrado", "selo-contagens", "presenca-print", "avisos-de-local", "seguranca-pessoal", "meusdados", "fim"].map((n) => normal(ler("supabase/migracoes/20261127-p4-" + n + ".sql")));
  // Depois do fim do Prompt 4 vêm só as migrações avulsas da versão 18 (não mexem na versão nem na porta), em ordem.
  const DEPOIS_DO_P4 = ["20261128-coordenacao-geral.sql", "20261129-chat-flutuante.sql"].map((n) => normal(ler("supabase/migracoes/" + n)));
  ok("o install.sql termina com o fim do Prompt 4 e, depois dele, só as avulsas da versão 18, em ordem", (() => {
    let pos = install.lastIndexOf(P4[P4.length - 1]);
    if (pos < 0) return false;
    pos += P4[P4.length - 1].length;
    for (const t of DEPOIS_DO_P4) {
      const achou = install.indexOf(t, pos);
      if (achou < 0 || install.slice(pos, achou).trim() !== "") return false;
      pos = achou + t.length;
    }
    return install.slice(pos).trim() === "";
  })());
  ok("as avulsas da versão 18 não mexem na versão nem na lista da porta e terminam passando a porta",
    DEPOIS_DO_P4.every((t) => !/function public\.rede_alumia_versao|function interno\.alumia_porta_aberta/.test(t) && /select interno\.alumia_trancar\(\);$/.test(t)));
  ok("o fim do Prompt 4 sobe a versão para 18", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 18\s*\$\$/.test(P4[P4.length - 1]));
  ok("o fim do Prompt 4 termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(P4[P4.length - 1]));
  ok("cada migração do Prompt 4 termina passando a porta", P4.every((t) => /select interno\.alumia_trancar\(\);$/.test(t)));
  ok("antes do fim, nenhuma migração do Prompt 4 mexe na versão ou na lista da porta",
    P4.slice(0, -1).every((t) => !/function public\.rede_alumia_versao|function interno\.alumia_porta_aberta/.test(t)));
  ok("cada migração do Prompt 4 diz que roda depois do fim do Prompt 5 (versão 17)",
    P4.every((t) => /Roda depois de 20261126-p5-fim\.sql \(banco na versão 17\)/.test(t.replace(/\n-- /g, " "))));
  const porta = (t) => t.slice(t.indexOf("create or replace function interno.alumia_porta_aberta"), t.indexOf("$$;", t.indexOf("create or replace function interno.alumia_porta_aberta"))).replace(/^\s*--.*$/gm, "").replace(/\s+/g, " ");
  ok("o Prompt 4 não abre exceção nova na porta (a lista do fim do Prompt 4 é a do Prompt 5)", porta(P4[P4.length - 1]) === porta(P5[P5.length - 1]));
  const posP4 = P4.map((t) => install.lastIndexOf(t));
  ok("ordem do Prompt 4 no fim do install.sql: fim do Prompt 5, cifrado sem anexo, anexo cifrado, selo e contagens, presença e print, avisos de local, segurança pessoal, meus dados, fim do Prompt 4 (cada uma uma vez só)",
    install.lastIndexOf(P5[P5.length - 1]) < posP4[0] && posP4.every((k, i) => k > 0 && (i === 0 || posP4[i - 1] < k))
    && P4.every((t) => install.indexOf(t) === install.lastIndexOf(t)));
  ok("o fim do beta sobe a versão para 13", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 13\s*\$\$/.test(BETA_FIM));
  const BETA = ["chat", "visibilidade", "codigo", "admin", "beta-fim"].map((n) => normal(ler(`supabase/migracoes/20261122-alumia-${n}.sql`)));
  const posBeta = BETA.map((t) => install.lastIndexOf(t));
  ok("ordem do beta no fim do install.sql: fim da integração, chat, visibilidade, código, admin, fim do beta (cada uma uma vez só)",
    install.lastIndexOf(FIM) < posBeta[0] && posBeta.every((k, i) => k > 0 && (i === 0 || posBeta[i - 1] < k))
    && BETA.every((t) => install.indexOf(t) === install.lastIndexOf(t)));
  const [a, b, c, d] = [ONDA14, RESUMO, SQL, FIM].map((t) => install.lastIndexOf(t));
  ok("ordem do fim do install.sql: onda 14, resumo, integração, fim (cada uma uma vez só)", a > 0 && a < b && b < c && c < d
    && [ONDA14, RESUMO, SQL, FIM].every((t) => install.indexOf(t) === install.lastIndexOf(t)));
  // A espera do chat da equipe (revisão de 17/11): entre a integração e o fim, e o corpo final das conferências com ela.
  const ESPERA = normal(ler("supabase/migracoes/20261121-equipe-chat-espera.sql"));
  const e = install.lastIndexOf(ESPERA);
  ok("a espera do chat da equipe fica entre a integração e o fim, uma vez só", e > c && e < d && install.indexOf(ESPERA) === e);
  // Depois da R2 (20261124-r2-equipe.sql) o Megolm sai, e a conferência do aparelho do chat da equipe passa a ser interno.equipe_mls_meu.
  const meu = (await um("select to_regprocedure('interno.equipe_chat_meu(uuid)') is not null as tem")).tem ? "interno.equipe_chat_meu(uuid)" : "interno.equipe_mls_meu(uuid)";
  for (const [f, pedaco] of [[meu, "interno.chat_aparelho_vale(a.vale_desde)"], ["interno.equipe_de(uuid)", "interno.chat_aparelho_vale(a.vale_desde)"],
    ["public.chat_aparelho_aprovar(uuid, uuid, text, text)", "interno.chat_aparelho_vale(vale_desde)"], ["public.chat_aparelho_recuperar(uuid, text, text)", "vale_desde = now() + interval '24 hours'"]]) {
    const linha = await um("select prosrc from pg_proc where oid = to_regprocedure($1)", [f]);
    ok(`o corpo final de ${f} tem a espera`, Boolean(linha?.prosrc.includes(pedaco)));
  }
  ok("o código espera a versão 18 do banco", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) === 18);
  await espera("o install.sql do zero responde a versão 18, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.5" }, "rede_alumia_versao"), (v) => v === 18);
  await espera("o interruptor alumia-chat-so-app está no catálogo, só pelo nome, e ninguém o ligou", async () => (await dono("select c.so_pelo_nome, v.ligado from interno.recursos_catalogo c left join interno.recursos_vivos v using (nome) where c.nome = 'alumia-chat-so-app'")).rows[0], (x) => x?.so_pelo_nome === true && x.ligado == null);
  // O lançamento: "alumia-aberta" no catálogo (só pelo nome), para o painel poder desligar o que o PADRAO do código liga.
  await espera("o interruptor alumia-aberta está no catálogo, só pelo nome", async () => (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-aberta'")).rows[0]?.so_pelo_nome, (x) => x === true);
  await espera("o interruptor fediverso-grupos está no catálogo, só pelo nome", async () => (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'fediverso-grupos'")).rows[0]?.so_pelo_nome, (x) => x === true);
  await espera("o fim do beta roda de novo por cima (idempotente)", () => exec(BETA_FIM));
}

// ═══════════════════ 2. O catálogo ═══════════════════
{
  const r = (await um("select interno.alumia_trancar() as r")).r;
  ok(`trancar não acha nada aberto (abertas: ${JSON.stringify(r.abertas)})`, r.trancadas === 0 && r.abertas.length === 0);
}

/** O corpo final das funções que as duas faixas redefinem: cada uma tem de ter todos estes pedaços (e nenhum dos proibidos). */
const CORPOS = [
  ["interno.alumia_porta_aberta(text, text)", ["'rede_fed_servidor'", "'rede_fed_midia_servidor'", "'rede_fed_mudanca_servidor'", "'rede_org_diretorio'",
    "'rede_org_mapa'", "'alumia_transparencia'", "'rede_kt_ponta'", "'rede_kt_trecho'", "'rede_caixa_lote'", "'rede_nucleo_entrada_trocar'"], ["'rede_sel_depositar'"]],
  ["interno.alumia_passa()", ["interno.alumia_sessao_viva()", "interno.alumia_exigida()", "interno.alumia_sessao_ok()"], ["exception"]],
  // A da onda 14 (sem leitura, vale o token) ou a do reforço do banco, 20261123-r1-banco.sql (sem leitura, nega): as duas olham o corte e o prazo.
  ["interno.alumia_sessao_viva()", ["interno.alumia_sessao_cortada(", "interno.alumia_token_no_prazo()", "exception when"], ["then return true; end;"]],
  ["interno.rede_ve(interno.rede_posts)", ["interno.rede_bloqueado(", "interno.rede_espaco_entra(", "interno.rede_vida_ve(", "interno.rede_o9_recolhida("], []],
  ["interno.rede2_pode_ver(interno.rede_posts, uuid)", ["interno.rede_vida_ve(p, p_quem)", "interno.rede_o9_recolhida(p, p_quem)", "'fechada'"], []],
  ["interno.rede_fed_federavel(interno.rede_posts, integer)", ["interno.rede_vida_federa(p)", "p.corpo_grupo is not null", "<> 'internet' then",
    "p.nucleo is not null", "c.tipo = 'fechada'", "interno.rede_fed_impedimento(", "interno.rede_ve(p, null)", "interno.rede_fed_comunidade_ok("], []],
  ["public.rede_publicar(jsonb)", ["perform interno.alumia_porta()", "enquete", "responde_quem", "audio", "rede3_pub_previa", "rede_triagem",
    "v_corpo_grupo", "interno.rede_grupo_membro(v_grupo, v)", "'invalido:grupo'", "interno.rede_fed_total()", "grupo, corpo_grupo)"], []],
  ["interno.rede_post_v2(interno.rede_posts, uuid, boolean)", ["interno.rede_o9_recolhida(p, p_quem)", "'util', interno.rede_util_publicado(p.id)",
    "'robo', (select", "rede_pontes_robos", "r.situacao <> 'criando'", "'grupo', p.grupo", "'corpo_grupo', p.corpo_grupo", "'aguardando', true, 'corpo_grupo', null"], []],
  ["interno.alumia_alc_sai(interno.rede_posts)", ["p.corpo_grupo is null", "interno.rede_vida_federa(p)", "= 'internet'", "c.tipo = 'aberta'"], []],
];
for (const [f, tem, nunca] of CORPOS) {
  const linha = await um("select prosrc from pg_proc where oid = to_regprocedure($1)", [f]);
  const faltam = linha ? tem.filter((x) => !linha.prosrc.includes(x)) : ["(a função não existe)"];
  const sobram = linha ? nunca.filter((x) => linha.prosrc.includes(x)) : [];
  ok(`o corpo final de ${f} está completo (faltam: ${faltam.join(", ") || "nada"}; sobram: ${sobram.join(", ") || "nada"})`, !faltam.length && !sobram.length);
}
{
  // Uma versão só de cada (nenhuma sobrecarga esquecida por uma das faixas).
  const n = await linhas(`select p.proname, count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where (s.nspname, p.proname) in (('interno', 'rede_post_v2'), ('public', 'rede_publicar'), ('interno', 'rede_fed_federavel'), ('interno', 'alumia_alc_sai'), ('interno', 'alumia_porta_aberta'), ('interno', 'alumia_passa'))
    group by p.proname`);
  ok(`uma definição só de cada função redefinida (${n.map((x) => `${x.proname}=${x.n}`).join(", ")})`, n.length === 6 && n.every((x) => x.n === 1));
  const [abre] = await linhas(`select interno.alumia_porta_aberta('rede_caixa_lote', 'p_itens jsonb') a, interno.alumia_porta_aberta('rede_kt_trecho', 'p_desde bigint') b,
    interno.alumia_porta_aberta('rede_kt_ponta', '') c, interno.alumia_porta_aberta('rede_fed_servidor', '') d, interno.alumia_porta_aberta('rede_publicar', 'p jsonb') e`);
  ok("a lista aberta tem a federação, o registro das chaves e as caixas anônimas (R2), e publicar não está nela", abre.a && abre.b && abre.c && abre.d && !abre.e);
  ok("o envelope selado do beta saiu da lista aberta (a função não existe mais)", !(await um("select interno.alumia_porta_aberta('rede_sel_depositar', 'p_para uuid, p_senha text, p_envelope text') as a")).a);
}
await espera("nenhuma função com valor padrão que dependa do tipo linha de uma tabela (tipo do parâmetro com padrão ou expressão do padrão)", () => linhas(`
  select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.pronargdefaults > 0 and n.nspname in ('public', 'interno')
    and (exists (select 1 from unnest((p.proargtypes::oid[])[p.pronargs - p.pronargdefaults : p.pronargs - 1]) t (o)
                 join pg_type ty on ty.oid = t.o join pg_class c on c.oid = ty.typrelid where c.relkind in ('r', 'p'))
         or exists (select 1 from pg_class c join pg_namespace cn on cn.oid = c.relnamespace
                    where c.relkind in ('r', 'p') and cn.nspname in ('public', 'interno')
                      and pg_get_expr(p.proargdefaults, 0) ~ ('::' || cn.nspname || '\\.' || c.relname || '([^a-z0-9_]|$)')))`), (r) => r.length === 0);
await espera("pg_depend: nenhuma função com padrão depende de um tipo linha que não está entre os tipos dela", () => linhas(`
  select n.nspname || '.' || p.proname as f, d.refobjid::regtype::text as tipo
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.refclassid = 'pg_type'::regclass
  join pg_type ty on ty.oid = d.refobjid join pg_class c on c.oid = ty.typrelid and c.relkind in ('r', 'p')
  where p.pronargdefaults > 0 and n.nspname in ('public', 'interno')
    and not (d.refobjid = any (coalesce(p.proallargtypes, p.proargtypes::oid[])) or d.refobjid = p.prorettype)`), (r) => r.length === 0);
await espera("nenhuma função security definer de interno executável por todo mundo (PUBLIC)", () => linhas(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.prosecdef
    and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')`), (r) => r.length === 0);
await espera("o chat da equipe (public.chat_*, public.equipe_chat_* ou, depois da R2, public.equipe_mls_*) fica fora da porta e confere quem chama do jeito dele", async () => {
  const fs_ = await linhas(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'chat\\_%' or p.proname like 'equipe\\_chat\\_%' or p.proname like 'equipe\\_mls\\_%')`);
  const daEquipe = (f) => f.proname.startsWith("equipe_chat_") || f.proname.startsWith("equipe_mls_");
  const comPorta = fs_.filter((f) => /interno\.alumia_(porta|passa)\(\)/.test(f.prosrc)).map((f) => f.proname);
  const semConferencia = fs_.filter((f) => !/interno\.(eu|equipe_chat_meu|equipe_mls_meu|voluntario|lider|gere_cargos|na_conversa)\(/.test(f.prosrc)).map((f) => f.proname);
  const equipeSemAparelho = fs_.filter((f) => daEquipe(f) && !/interno\.(equipe_chat_meu|equipe_mls_meu|na_conversa)\(/.test(f.prosrc)).map((f) => f.proname);
  return { n: fs_.length, equipe: fs_.filter(daEquipe).length, comPorta, semConferencia, equipeSemAparelho };
}, (r) => r.n >= 30 && r.equipe >= 5 && !r.comPorta.length && !r.semConferencia.length && !r.equipeSemAparelho.length);

// O resto roda num bloco só: um tropeço vira falha contada, não um erro solto.
try {
  // ═══════════════════ 3. Pessoas, núcleo, comunidades ═══════════════════
  let ip = 10;
  const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
  const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
  const P = {};
  const nomes = ["ana", "bia", "caio", "org", "robo"];
  for (const [i, nome] of nomes.entries()) {
    P[nome] = await criarUsuario(`${nome}@integracao.local`, nome);
    await rpc(como(P[nome]), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  const zerar = () => dono("delete from interno.limites");

  const { id: NUCLEO } = await um("insert into interno.rede_nucleos (nome) values ('Núcleo do teste') returning id");
  // Depois da R2 (membros escondidos, 20261124-r2-membros.sql) o servidor não sabe quem é de qual núcleo: o post cifrado de grupo
  // que era "do núcleo" vai para uma segunda comunidade fechada (a filiação à comunidade fechada continua no banco).
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('roda-fechada', 'Roda fechada', 'lutas', 'fechada'), ('roda-dois', 'Roda dois', 'lutas', 'fechada'), ('praca-aberta', 'Praça aberta', 'lutas', 'aberta'), ('aula-aberta', 'Aula aberta', 'disciplinas', 'aberta')");
  for (const n of ["ana", "bia"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('roda-fechada', $1, 'ativo'), ('roda-dois', $1, 'ativo')", [P[n]]);
  for (const n of ["ana", "bia", "caio"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('praca-aberta', $1, 'ativo'), ('aula-aberta', $1, 'ativo')", [P[n]]);

  const publicar = async (quem, pedido) => {
    await zerar();
    return rpc(como(P[quem]), "rede_publicar", { p: pedido });
  };
  const cartao = async (id, quem) => (await um("select interno.rede_post_v2(p, $2::uuid, false) as j from interno.rede_posts p where p.id = $1", [id, quem ? P[quem] : null])).j;
  const CIFRA = "p2.3.dmV0b3I.Y2lmcmFkb3NlZ3JlZG9wYWxhdnJhdW5pY2E";

  // ═══════════════════ 4. O rótulo de robô dentro do post ═══════════════════
  await dono("insert into interno.rede_orgs (perfil, tipo) values ($1, 'coletivo')", [P.org]);
  await dono("update interno.perfis set rede_codinome = 'Coletivo do Teste' where id = $1", [P.org]);
  const { id: ROBO } = await um("insert into interno.rede_pontes_robos (org, perfil, nome, descricao, situacao) values ($1, $2, 'Robô do teste', 'Publica a agenda do coletivo do teste.', 'ativo') returning id", [P.org, P.robo]);
  {
    const doRobo = await publicar("robo", { texto: "Agenda da semana do coletivo." });
    const daAna = await publicar("ana", { texto: "Um post de gente." });
    await espera("o post do robô traz a organização dona dentro de autor.robo, para quem está de fora também", async () => [
      (await cartao(doRobo.id, "caio")).autor, (await cartao(doRobo.id, null)).autor, doRobo.autor], (r) =>
      r.every((a) => a.robo?.handle === "pessoa_org" && a.robo?.nome === "Coletivo do Teste"));
    await espera("o post de gente traz autor.robo nulo (a chave vem, para a tela não perguntar)", async () => (await cartao(daAna.id, "caio")).autor,
      (a) => Object.hasOwn(a, "robo") && a.robo === null);
    await dono("update interno.rede_pontes_robos set situacao = 'criando' where id = $1", [ROBO]);
    await espera("o robô ainda em criação não leva rótulo", async () => (await cartao(doRobo.id, "caio")).autor.robo, (r) => r === null);
    await dono("update interno.rede_pontes_robos set situacao = 'desligado' where id = $1", [ROBO]);
    await espera("o robô desligado continua com o rótulo (os posts antigos dizem de quem eram)", async () => (await cartao(doRobo.id, "caio")).autor.robo?.handle, (h) => h === "pessoa_org");
  }

  // ═══════════════════ 5. O post restrito cifrado (P21) ═══════════════════
  let doNucleo;
  let daRoda;
  {
    await recusa("no núcleo, o servidor não aceita post nenhum (não sabe quem é do núcleo: o mural é do grupo, nos aparelhos)", () =>
      publicar("ana", { publico: "nucleo", nucleo: NUCLEO, grupo: `nucleo:${NUCLEO}`, corpo_grupo: CIFRA }), "sem_permissao");
    doNucleo = await espera("quem é da comunidade fechada publica o post cifrado nela", () =>
      publicar("ana", { comunidade: "roda-dois", publico: "comunidade", grupo: "comunidade:roda-dois", corpo_grupo: CIFRA }),
    (r) => r?.texto === "" && r.grupo === "comunidade:roda-dois" && r.corpo_grupo === CIFRA && r.publico === "comunidade");
    daRoda = await espera("e na comunidade fechada", () =>
      publicar("bia", { comunidade: "roda-fechada", publico: "comunidade", grupo: "comunidade:roda-fechada", corpo_grupo: CIFRA }),
    (r) => r?.texto === "" && r.grupo === "comunidade:roda-fechada" && r.corpo_grupo === CIFRA);
    await espera("no banco o texto fica vazio, sem título nem corpo longo", async () =>
      um("select texto, titulo, corpo, grupo, corpo_grupo from interno.rede_posts where id = $1", [doNucleo?.id]),
    (r) => r.texto === "" && r.titulo === null && r.corpo === null && r.corpo_grupo === CIFRA);
    await espera("quem é do grupo recebe o grupo e o corpo cifrado", async () => cartao(doNucleo?.id, "bia"), (j) => j.corpo_grupo === CIFRA && j.grupo === "comunidade:roda-dois");
    await espera("quem não é da comunidade fechada não recebe o post (nem pela API)", () => rpc(como(P.caio), "rede_post", { p_id: doNucleo?.id }).then((r) => JSON.stringify(r ?? null), (e) => e.message),
      (r) => !r.includes(CIFRA));
    await espera("quem não é da comunidade fechada também não", async () => (await um("select interno.rede2_pode_ver(p, $2) as v from interno.rede_posts p where p.id = $1", [daRoda?.id, P.caio])).v,
      (v) => v === false);

    const base = { comunidade: "roda-dois", publico: "comunidade", grupo: "comunidade:roda-dois", corpo_grupo: CIFRA };
    await recusa("com texto aberto junto: recusa", () => publicar("ana", { ...base, texto: "isto ficaria aberto" }), "invalido:grupo");
    await recusa("só o grupo, sem o corpo: recusa", () => publicar("ana", { ...base, corpo_grupo: undefined, texto: "x" }), "invalido:grupo");
    await recusa("só o corpo, sem o grupo: recusa", () => publicar("ana", { ...base, grupo: undefined }), "invalido:grupo");
    await recusa("corpo fora do formato do MLS: recusa", () => publicar("ana", { ...base, corpo_grupo: "p1.velho.formato" }), "invalido:grupo");
    await recusa("corpo grande demais: recusa", () => publicar("ana", { ...base, corpo_grupo: `p2.${"a".repeat(12000)}` }), "invalido:grupo");
    await recusa("discussão (título e corpo abertos): recusa", () => publicar("ana", { ...base, tipo: "discussao", titulo: "Título aberto" }), "invalido:grupo");
    await recusa("enquete (opções abertas): recusa", () => publicar("ana", { ...base, tipo: "enquete", enquete: { opcoes: ["a", "b"] } }), "invalido:grupo");
    await recusa("prévia de link (título aberto): recusa", () => publicar("ana", { ...base, previa: { url: "https://exemplo.org", titulo: "aberto" } }), "invalido:grupo");
    await recusa("descrição de imagem aberta: recusa", () => publicar("ana", { ...base, midia: [{ caminho: `${P.ana}/${"0".repeat(8)}-0000-0000-0000-000000000000.jpg`, alt: "aberta" }] }), "invalido:grupo");
    await recusa("grupo de outra comunidade: recusa", () => publicar("ana", { ...base, grupo: "comunidade:roda-fechada" }), "invalido:grupo");
    await recusa("público de membros: recusa", () => publicar("ana", { publico: "membros", grupo: "comunidade:roda-dois", corpo_grupo: CIFRA }), "invalido:grupo");
    await recusa("comunidade aberta: recusa", () => publicar("ana", { comunidade: "praca-aberta", publico: "comunidade", grupo: "comunidade:praca-aberta", corpo_grupo: CIFRA }), "invalido:grupo");
    await recusa("internet: recusa", () => publicar("ana", { comunidade: "aula-aberta", publico: "internet", grupo: "comunidade:aula-aberta", corpo_grupo: CIFRA }), "invalido:grupo");
    await recusa("quem não é da comunidade fechada não publica nela (a segunda)", () => publicar("caio", base), "sem_permissao");
    await recusa("quem não é da comunidade fechada não publica nela", () => publicar("caio", { comunidade: "roda-fechada", publico: "comunidade", grupo: "comunidade:roda-fechada", corpo_grupo: CIFRA }), "sem_permissao");
    await espera("sem grupo, publicar segue como antes (texto aberto na comunidade fechada)", () => publicar("ana", { comunidade: "roda-dois", publico: "comunidade", texto: "Reunião na quinta." }),
      (r) => r?.texto === "Reunião na quinta." && r.grupo === null && r.corpo_grupo === null);
    await recusa("o banco recusa texto aberto num post cifrado (editar não abre o post)", () => dono("update interno.rede_posts set texto = 'aberto' where id = $1", [doNucleo?.id]), "rede_posts_grupo_sem_texto");
    await recusa("e editar pela tela não grava texto aberto nele", async () => {
      await zerar();
      return rpc(como(P.ana), "rede_pub_editar", { p_post: doNucleo?.id, p: { texto: "aberto pela edição" } });
    }, "invalido:post");

    // A resposta cifrada: avisa sem trecho.
    await dono("delete from interno.avisos");
    await espera("a resposta cifrada ao post da comunidade fechada é aceita (herda o público)", () =>
      publicar("bia", { resposta_a: doNucleo?.id, grupo: "comunidade:roda-dois", corpo_grupo: CIFRA }), (r) => r?.texto === "" && r.corpo_grupo === CIFRA);
    await espera("o aviso da resposta cifrada sai sem trecho do post", async () => linhas("select texto from interno.avisos where para = $1", [P.ana]),
      (r) => r.length >= 1 && r.every((a) => !a.texto.includes("“") && !a.texto.includes(CIFRA)));
  }

  // ═══════════════════ 6. O post cifrado não sai da Alumia ═══════════════════
  {
    // A federação ligada para a Ana, no modo total.
    await dono("delete from interno.recursos_vivos where nome = 'fediverso-total'");
    await dono("insert into interno.configuracoes (chave, valor) values ('fediverso', '{\"total\": \"true\"}'::jsonb) on conflict (chave) do update set valor = excluded.valor");
    await dono("insert into interno.rede_fed_atores (perfil, handle, ligado, ligado_em, consentimento_versao) values ($1, 'pessoa_ana', true, now() - interval '1 day', 2) on conflict (perfil) do update set ligado = true, ligado_em = now() - interval '1 day', consentimento_versao = 2", [P.ana]);
    const aberto = await publicar("ana", { comunidade: "aula-aberta", publico: "internet", texto: "Post aberto da aula." });
    const sai = async (id) => um("select interno.rede_fed_federavel(p) as fed, interno.alumia_alc_sai(p) as alc from interno.rede_posts p where p.id = $1", [id]);
    await espera("controle: o post aberto da aula sai (federação e RSS)", () => sai(aberto?.id), (r) => r.fed === true && r.alc === true);
    // O mesmo post, à força, com o corpo cifrado (como se alguma regra de público falhasse): nada sai.
    await dono("update interno.rede_posts set texto = '', grupo = 'comunidade:aula-aberta', corpo_grupo = $2 where id = $1", [aberto?.id, CIFRA]);
    await espera("com o corpo cifrado, nem a federação nem o RSS, a incorporação, o Telegram ou o resumo das comunidades levam o post", () => sai(aberto?.id),
      (r) => r.fed === false && r.alc === false);
    await espera("o post cifrado da segunda comunidade fechada não federa nem sai", () => sai(doNucleo?.id), (r) => r.fed === false && r.alc === false);
    await espera("o da comunidade fechada também não", () => sai(daRoda?.id), (r) => r.fed === false && r.alc === false);
    await espera("RSS, incorporação, Telegram e resumo das comunidades passam por interno.alumia_alc_sai", async () => linhas(`select p.proname, position('alumia_alc_sai' in p.prosrc) > 0 as usa
        from pg_proc p where p.oid in (to_regprocedure('public.rede_alc_rss(text, text)'), to_regprocedure('public.rede_alc_post(uuid)'),
          to_regprocedure('public.rede_pontes_telegram_pendentes(integer)'), to_regprocedure('interno.alumia_pontes_resumo_texto(uuid)'))`),
    (r) => r.length === 4 && r.every((x) => x.usa));
    await espera("a incorporação de um post cifrado volta vazia", () => rpc(visitante(), "rede_alc_post", { p_post: doNucleo?.id }), (r) => r === null);
    await espera("o resumo semanal só leva títulos de conversa pública (internet), nunca a do núcleo", async () =>
      (await um("select prosrc from pg_proc where oid = 'interno.rede3_aviso_resumo(uuid)'::regprocedure")).prosrc,
    (s) => s.includes("interno.rede2_publico(p) = 'internet'"));

    // A busca não acha o post cifrado por nada do corpo (o servidor não tem o texto).
    await dono("update interno.rede_posts set corpo_grupo = 'p2.1.vetor.palavraunicadabusca' where id = $1", [doNucleo?.id]);
    await espera("a busca da Alumia não acha o post cifrado pelo corpo", async () => {
      await zerar();
      const r = await rpc(como(P.bia), "rede_desc_buscar", { p_q: "palavraunicadabusca" });
      await zerar();
      const s = await rpc(como(P.bia), "rede_alumia_buscar", { p_q: "palavraunicadabusca c:roda-fechada" });
      return [...(r.itens ?? []), ...(s.itens ?? [])].map((x) => x.id);
    }, (ids) => !ids.includes(doNucleo?.id));
    await dono("update interno.rede_posts set corpo_grupo = $2 where id = $1", [doNucleo?.id, CIFRA]);
  }

  // ═══════════════════ 7. P9: o "internet" do perfil no modo total ═══════════════════
  {
    await espera("modo total ligado: o post de perfil pode escolher internet (vale como membros na Alumia)", () => publicar("ana", { publico: "internet", texto: "Para o Fediverso." }),
      (r) => r?.publico === "membros");
    const [{ id }] = await linhas("select id from interno.rede_posts where autor = $1 and texto = 'Para o Fediverso.'", [P.ana]);
    await espera("e ele sai para o Fediverso (a pessoa ligou a federação)", async () => (await um("select interno.rede_fed_federavel(p) as f from interno.rede_posts p where p.id = $1", [id])).f, (f) => f === true);
    await dono("update interno.configuracoes set valor = '{\"total\": \"false\"}'::jsonb where chave = 'fediverso'");
    await recusa("modo total desligado: o perfil não escolhe internet, como antes", () => publicar("ana", { publico: "internet", texto: "Sem o modo total." }), "invalido:publico");
    await recusa("comunidade que não é das disciplinas continua sem internet", () => publicar("ana", { comunidade: "praca-aberta", publico: "internet", texto: "x" }), "invalido:publico");
  }

  // ═══════════════════ 8. P11, P18, P19 e P20 no banco final ═══════════════════
  {
    const corpo = async (f) => (await um("select prosrc from pg_proc where oid = to_regprocedure($1)", [f]))?.prosrc ?? "";
    ok("P11: os avisos de curtida e impulso de fora não dizem quem foi e o total sai pelo piso de 3",
      (await corpo("public.rede_aviso_listar(text, integer)")).includes("interno.rede_fed_aviso_total(n.tipo, n.total)")
      && /not in \('fed_curtida', 'fed_impulso'\)/.test(await corpo("interno.rede_fed_aviso_remoto(uuid[])"))
      && !(await corpo("public.rede_aviso_listar(text, integer)")).includes("'avatar'"));
    ok("P18: baixar meus dados tira ator_remoto e atores_remotos",
      (await corpo("public.conta_meus_dados()")).includes("alumia_md_sem_terceiros")
      && /'ator_remoto', 'atores_remotos'/.test(await corpo("interno.alumia_md_sem_terceiros(jsonb, uuid)")));
    ok("P19: rede_avisos e avisos_meus deixam de fora curtida e impulso de fora; o resumo conta 1 abaixo de 3",
      /not in \('fed_curtida', 'fed_impulso'\)/.test(await corpo("public.rede_avisos()")) && /not in \('fed_curtida', 'fed_impulso'\)/.test(await corpo("public.avisos_meus()"))
      && /q\.n < 3 then 1/.test(await corpo("interno.rede3_aviso_resumo(uuid)")));
    ok("P20: a lista das caronas só tira a carona quando a DONA bloqueou quem lê; bloquear tem freio; a faxina existe",
      /b\.quem = x\.quem and b\.bloqueado = p_quem/.test(await corpo("interno.rede_ato_caronas_json(uuid, uuid, boolean)"))
      && !/rede_bloqueado\(x\.quem, p_quem\)/.test(await corpo("interno.rede_ato_caronas_json(uuid, uuid, boolean)"))
      && /interval '3 hours'/.test(await corpo("public.rede_bloquear(uuid, boolean)")) && (await corpo("interno.rede_ato_caronas_faxina()")).includes("cancelado"));
    // P18 de verdade: um aviso de curtida de fora não leva o endereço de quem curtiu no "baixar meus dados".
    await dono("insert into interno.avisos (para, texto, categoria, tipo, ator_remoto) values ($1, 'curtiram', 'rede', 'fed_curtida', 'https://outro.exemplo/users/x')", [P.bia]);
    await espera("P18 na prática: o arquivo dos meus dados não tem o endereço de quem curtiu", async () => {
      await zerar();
      return JSON.stringify(await rpc(como(P.bia), "conta_meus_dados"));
    }, (s) => s.includes("curtiram") && !s.includes("outro.exemplo"));
  }

  // ═══════════════════ Menção de fora (20261121-alumia-mencao-de-fora.sql) ═══════════════════
  // "@pessoa_bia@mastodon.social" é uma conta de outro servidor: não avisa a @pessoa_bia daqui. "@pessoa_caio" sozinho avisa.
  {
    const MENCAO = normal(ler("supabase/migracoes/20261121-alumia-mencao-de-fora.sql"));
    const [e, m, d] = [normal(ler("supabase/migracoes/20261121-equipe-chat-espera.sql")), MENCAO, normal(ler("supabase/migracoes/20261121-alumia-integracao-fim.sql"))]
      .map((t) => install.lastIndexOf(t));
    ok("menção de fora: a migração fica entre a espera do chat da equipe e o fim, uma vez só", e > 0 && e < m && m < d && install.indexOf(MENCAO) === m);
    await espera("menção de fora: a migração roda de novo por cima (idempotente)", () => exec(MENCAO));
    await recusa("menção de fora: @nome@servidor que ninguém buscou continua recusado (pode ser um e-mail)",
      () => publicar("ana", { texto: "Falei com @pessoa_bia@mastodon.social sobre o ato." }), "dado_pessoal");
    await dono("insert into interno.rede_fed_remotos (ator, handle, inbox) values ('https://mastodon.social/users/pessoa_bia', 'pessoa_bia@mastodon.social', 'https://mastodon.social/users/pessoa_bia/inbox') on conflict do nothing");
    await recusa("menção de fora: um e-mail de verdade continua recusado", () => publicar("ana", { texto: "Escreve para pessoa_bia@mastodon.social." }), "dado_pessoal");
    await recusa("menção de fora: e-mail disfarçado com @ na frente, de conta que ninguém conhece, continua recusado",
      () => publicar("ana", { texto: "Oi @fulano@gmail.com" }), "dado_pessoal");
    const post = await publicar("ana", { texto: "Falei com @pessoa_bia@mastodon.social e com @pessoa_caio sobre o ato." });
    await espera("menção de fora: só a @pessoa_caio daqui foi mencionada, a @pessoa_bia não", async () =>
      (await linhas("select mencionado from interno.rede_mencoes where post = $1 and exists (select 1 from interno.rede_posts p where p.id = $1 and not p.retido and not p.oculto)", [post.id])).map((r) => r.mencionado),
      (r) => r.length === 1 && r[0] === P.caio);
    const outro = await publicar("ana", { texto: "Oi @pessoa_bia, tudo certo?" });
    await espera("menção de fora: o @nome daqui seguido de vírgula continua avisando", async () =>
      (await linhas("select mencionado from interno.rede_mencoes where post = $1", [outro.id])).map((r) => r.mencionado),
      (r) => r.length === 1 && r[0] === P.bia);
  }

} catch (e) {
  falhas.push(`o banco: ${e.message}`);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
