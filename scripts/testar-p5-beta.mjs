// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, A21 (supabase/migracoes/20261126-p5-beta.sql), num Postgres de verdade (scripts/banco-local.mjs), numa CÓPIA montada
// com o install.sql do ramo e cheia de dados do instituto e da Alumia:
//   · zerar o beta: só a coordenação com o segundo fator; dois passos (prévia, depois confirmação com a frase, de 10 s a 15 min
//     depois, pela mesma pessoa); a prévia não apaga nada; a confirmação apaga posts (menos as salas das disciplinas), stories,
//     destaques, rascunhos, agendados, chaves de envio, álbum, avisos da Alumia; os arquivos vão para a fila do depósito;
//   · NADA do instituto some: o retrato (md5 de cada linha) de toda tabela de fora da Alumia é o mesmo antes e depois, menos os
//     registros que só crescem (auditoria, limites); os avisos da equipe ficam;
//   · "manter as contas" não toca em conta; "contas saem" revoga o consentimento (a linha fica), tira a ficha da entrada, os seguir,
//     as rodas e as comunidades de quem não é da equipe, e a equipe fica; nada em auth.* muda;
//   · a trava: uma tabela de fora da Alumia ligada a um post por "on delete cascade" faz a rotina parar sem apagar nada;
//   · relatar um problema: o endereço sai sem nada de quem é, sem conta e sem hora; a fila é só da coordenação;
//   · erros da tela: qualquer pessoa manda, nada de e-mail, link, @nome, id ou número longo fica, somado por dia; a lista é só da
//     coordenação; nenhuma tabela nova tem coluna de conta ou de endereço de rede.
//   · o aparelho limpa igual ao banco (lib/rede/beta/tela.ts), o erro vai sem o token da sessão, e as telas existem.
// Uso: npm run testar:p5-beta
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { aparelhoDoRelato, criarFreio, familiaDoNavegador, medidaDaTela, mensagemLimpa, telaLimpa, versaoLimpa } from "../lib/rede/beta/tela.ts";

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
const SQL = normal(ler("supabase/migracoes/20261126-p5-beta.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração está no fim do install.sql (seguida só de migrações datadas)", noFimDoInstall(SQL));
ok("diz que roda depois do fim da R3 e antes do p5-fim", /Roda depois de 20261125-r3-fim\.sql \(banco na versão 16\)[\s\S]{0,200}20261126-p5-fim\.sql vem por último/.test(SQL));
ok("não guarda nem lê endereço de rede", !/\binet\b|x-forwarded|cf-connecting|remote_addr|request\.headers/i.test(semComentario));
ok("não mexe na versão nem na lista de exceções da porta", !/function public\.rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
ok("não toca em auth.*", !/\bauth\.(users|sessions|identities|mfa_[a-z_]+|refresh_tokens|audit_log_entries)\b/.test(semComentario));
ok("não toca no chat (caixas, pacotes, cofres, grupos)", !/\binterno\.(caixas|pacotes|caixa_contagem)\b|rede_cofres_da_conta|rede_grupo_/.test(semComentario));
ok("nenhum agendador chama o zerar", !/cron\.schedule/.test(semComentario));
{
  const funcoes = [...semComentario.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\(/g)].map((m) => m[1]);
  ok(`as funções da migração são todas novas (${funcoes.join(", ")})`, funcoes.length === 13 && funcoes.every((f) => /^(interno\.alumia_(p5_|zerar_)|public\.(alumia_admin_(zerar_|relato|erros_tela)|alumia_relato_enviar|erro_tela_registrar))/.test(f)));
}

// ═══════════════════ 1. A cópia: o install.sql do ramo, com gente e dados ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const anon = { papel: "anon", ip: "203.0.113.7" };

await espera("a migração roda de novo por cima (idempotente)", () => exec(SQL));
await espera("e de novo", () => exec(SQL));
// A auditoria do P5 (20261126-p5-auditoria.sql, que vem depois no install.sql) redefine a limpeza da tela e da mensagem e o
// registro de erros: roda de novo por cima, como no SQL único, para o banco ficar como o do install.sql.
await espera("a migração da auditoria, que vem depois, roda de novo por cima", () => exec(ler("supabase/migracoes/20261126-p5-auditoria.sql")));
await espera("nenhuma função da rede ficou sem a porta", () => um("select interno.alumia_trancar() as r"), (x) => Array.isArray(x.r.abertas) && x.r.abertas.length === 0);
await espera("as tabelas novas: RLS, sem política, sem coluna de conta além de quem pediu o zerar, sem endereço de rede", () => dono(`
  select c.relname, c.relrowsecurity, (select count(*) from pg_policies p where p.schemaname = 'interno' and p.tablename = c.relname) politicas,
    (select string_agg(a.column_name || ':' || a.data_type, ',') from information_schema.columns a where a.table_schema = 'interno' and a.table_name = c.relname) colunas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('alumia_zerar_pedidos', 'alumia_relatos', 'alumia_erros_tela')`), (r) =>
  r.rows.length === 3 && r.rows.every((t) => t.relrowsecurity && Number(t.politicas) === 0 && !/inet|cidr|(^|,)(ip|email|endereco)[:_]/.test(t.colunas))
  && r.rows.filter((t) => t.relname !== "alumia_zerar_pedidos").every((t) => !/uuid/.test(t.colunas.replace(/(^|,)id:uuid/, ""))));

const P = {};
for (const nome of ["coord", "coord2", "equipe", "m1", "m2", "m3", "m4"]) {
  P[nome] = await criarUsuario(`${nome}@beta.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'coordenacao'), ($3, 'mediacao')", [P.coord, P.coord2, P.equipe]);
for (const [i, nome] of Object.keys(P).entries()) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}_${i}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
  await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);
}
// A Alumia: posts, respostas, uma sala de disciplina, mídia, stories, destaques, rascunhos, avisos, seguir, roda, comunidade.
await dono("insert into interno.rede_comunidades (slug, nome, categoria) values ('sala-teste-p5', 'Sala de teste', 'disciplinas'), ('luta-teste-p5', 'Luta de teste', 'lutas') on conflict do nothing");
const post = async (autor, texto, extra = {}) =>
  (await um(`insert into interno.rede_posts (autor, texto, comunidade, resposta_a, root_id) values ($1, $2, $3, $4, $5) returning id`,
    [autor, texto, extra.comunidade ?? null, extra.resposta ?? null, extra.raiz ?? null])).id;
const p1 = await post(P.m1, "Primeiro post do beta");
const p2 = await post(P.m2, "Resposta no beta", { resposta: p1, raiz: p1 });
const p3 = await post(P.m3, "Post na comunidade de luta", { comunidade: "luta-teste-p5" });
const pSala = await post(P.m4, "Dúvida da aula, na sala da disciplina", { comunidade: "sala-teste-p5" });
const FOTO_BETA = `${P.m1}/${randomUUID()}.webp`;
const FOTO_SALA = `${P.m4}/${randomUUID()}.webp`;
await dono("insert into interno.rede_midia (post, caminho, tipo) values ($1, $2, 'image/webp'), ($3, $4, 'image/webp')", [p1, FOTO_BETA, pSala, FOTO_SALA]);
await dono("insert into interno.rede_reacoes (post, usuario) select $1, $2 where exists (select 1 from information_schema.columns where table_schema = 'interno' and table_name = 'rede_reacoes' and column_name = 'usuario')", [p1, P.m2]).catch(() => undefined);
const s1 = (await um("insert into interno.rede_stories (autor, fundo, midia_caminho, conferido) values ($1, 'imagem', $2, true) returning id", [P.m1, `${P.m1}/${randomUUID()}.webp`])).id;
await dono("insert into interno.rede_stories (autor, texto) values ($1, 'Story só de texto')", [P.m2]);
await dono("insert into interno.rede_story_destaques (autor, titulo, capa) values ($1, 'Destaque', $2)", [P.m1, s1]);
await dono("insert into interno.rede_rascunhos (autor, pedido) values ($1, '{\"texto\": \"rascunho\"}')", [P.m3]);
await dono("insert into interno.avisos (para, texto, categoria) values ($1, 'Aviso da Alumia', 'rede'), ($1, 'Aviso da equipe', 'equipe'), ($2, 'Aviso da conta', 'conta')", [P.m1, P.equipe]);
await dono("insert into interno.avisos (para, texto, categoria, tipo, post) values ($1, 'Responderam', 'rede', 'resposta', $2)", [P.m1, p1]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($2, $1), ($3, $1), ($4, $1)", [P.m1, P.m2, P.equipe, P.coord]);
await dono("insert into interno.rede_roda (dono, membro) values ($1, $2)", [P.m1, P.m2]);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('luta-teste-p5', $1), ('luta-teste-p5', $2)", [P.m1, P.equipe]);
// O instituto: um relato de erro do site, um aviso de equipe (acima), uma hora de voluntariado se a tabela existir.
await dono("insert into interno.erros_relatados (pagina, descricao) values ('/pt/escola', 'O botão da aula não abre no celular')");

/** O retrato de cada tabela de fora da Alumia: md5 das linhas, em ordem. */
async function retrato() {
  const tabelas = (await dono(`select n.nspname || '.' || c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('interno', 'public', 'auth') and c.relname !~ '^(rede|alumia|fediverso)_' order by 1`)).rows.map((r) => r.t);
  const saida = {};
  for (const t of tabelas) {
    const linha = await um(`select count(*)::int n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') h from ${t} x`);
    saida[t] = linha;
  }
  return saida;
}
// O que cresce de propósito com qualquer chamada: o registro de atividades e os limites de pedidos (com o sal da origem).
const SO_CRESCEM = new Set(["interno.auditoria", "interno.limites", "interno.origem_sal"]);
function compara(antes, depois, { avisosRede }) {
  const mudaram = [];
  for (const [t, a] of Object.entries(antes)) {
    const d = depois[t];
    if (!d) mudaram.push(`${t} sumiu`);
    else if (t === "interno.avisos") continue;
    else if (SO_CRESCEM.has(t)) { if (d.n < a.n) mudaram.push(`${t} diminuiu`); }
    else if (a.h !== d.h) mudaram.push(`${t} (${a.n} → ${d.n})`);
  }
  return mudaram.length ? mudaram : avisosRede;
}

// ═══════════════════ 2. Zerar: quem não passa e os dois passos ═══════════════════
const C = como(P.coord);
for (const [rotulo, quem] of [["conta comum", como(P.m1)], ["mediação", como(P.equipe)], ["coordenação sem o segundo fator", como(P.coord, "aal1")], ["visitante", anon]]) {
  await recusa(`zerar (prévia): ${rotulo} não passa`, () => rpc(quem, "alumia_admin_zerar_previa", { p_manter_contas: true }), rotulo === "visitante" ? "permission denied" : rotulo.includes("segundo") ? "confirme_segundo_fator" : "sem_permissao");
}
const antes = await retrato();
const contagem = async () => um(`select (select count(*)::int from interno.rede_posts) posts, (select count(*)::int from interno.rede_stories) stories,
  (select count(*)::int from interno.avisos where categoria = 'rede') avisos_rede, (select count(*)::int from interno.avisos where categoria <> 'rede') avisos_outros,
  (select count(*)::int from interno.rede_seguindo) seguir, (select count(*)::int from interno.alumia_entrada) fichas,
  (select count(*)::int from interno.rede_consentimentos where revogado_em is null) consent, (select count(*)::int from interno.rede_rascunhos) rascunhos`);
const c0 = await contagem();
const previa = await espera("a prévia diz o que sai, em números, e a frase", () => rpc(C, "alumia_admin_zerar_previa", { p_manter_contas: true }),
  (r) => r.id && r.frase === "ZERAR O BETA" && r.previa.posts === 3 && r.previa.posts_das_disciplinas_ficam === 1 && r.previa.stories === 2 && r.previa.avisos === 2
    && r.previa.contas_saem.algum === false && Array.isArray(r.tocaria) && r.tocaria.length === 0);
const c1 = await contagem();
ok("a prévia não apaga nada", JSON.stringify(c0) === JSON.stringify(c1));
await recusa("confirmar na hora (o mesmo clique) é recusado", () => rpc(C, "alumia_admin_zerar_confirmar", { p_id: previa?.id, p_frase: "ZERAR O BETA", p_motivo: "Fim do beta fechado, como avisado." }), "cedo_demais");
await dono("update interno.alumia_zerar_pedidos set criado_em = now() - interval '20 seconds' where id = $1", [previa?.id]);
await recusa("frase errada é recusada", () => rpc(C, "alumia_admin_zerar_confirmar", { p_id: previa?.id, p_frase: "zerar o beta", p_motivo: "Fim do beta fechado, como avisado." }), "invalido:frase");
await recusa("sem motivo é recusado", () => rpc(C, "alumia_admin_zerar_confirmar", { p_id: previa?.id, p_frase: "ZERAR O BETA", p_motivo: "" }), "motivo");
await recusa("outra pessoa da coordenação não confirma o pedido de quem fez a prévia", () => rpc(como(P.coord2), "alumia_admin_zerar_confirmar", { p_id: previa?.id, p_frase: "ZERAR O BETA", p_motivo: "Fim do beta fechado, como avisado." }), "nao_encontrado");
ok("nada foi apagado pelas tentativas recusadas", JSON.stringify(c0) === JSON.stringify(await contagem()));

// A trava: uma tabela do instituto ligada a um post por cascata faz a rotina parar sem apagar nada.
await dono("create table interno.p5_teste_do_instituto (id serial primary key, post uuid references interno.rede_posts (id) on delete cascade)");
await dono("insert into interno.p5_teste_do_instituto (post) values ($1)", [p1]);
await recusa("a trava: tabela de fora ligada a um post por cascata faz o zerar parar", () => rpc(C, "alumia_admin_zerar_confirmar", { p_id: previa?.id, p_frase: "ZERAR O BETA", p_motivo: "Fim do beta fechado, como avisado." }), "zerar_tocaria:interno.p5_teste_do_instituto");
ok("a trava não apagou nada", JSON.stringify(c0) === JSON.stringify(await contagem()));
await dono("drop table interno.p5_teste_do_instituto");

const feito = await espera("confirmar (mesma pessoa, frase, motivo, 20 s depois) apaga", () => rpc(C, "alumia_admin_zerar_confirmar", { p_id: previa?.id, p_frase: "ZERAR O BETA", p_motivo: "Fim do beta fechado, como avisado." }),
  (r) => r.ok && r.posts === 3 && r.stories === 2 && r.avisos >= 1 && r.arquivos_na_fila === 2 && r.contas === null);
const c2 = await contagem();
ok("sobrou só o post da sala da disciplina", c2.posts === 1 && (await um("select id from interno.rede_posts")).id === pSala);
ok("a mídia da sala ficou, a do beta saiu", (await um("select count(*)::int n from interno.rede_midia")).n === 1);
ok("nenhum story, destaque, rascunho ou aviso da Alumia", c2.stories === 0 && c2.avisos_rede === 0 && c2.rascunhos === 0 && (await um("select count(*)::int n from interno.rede_story_destaques")).n === 0);
ok("os avisos da equipe e da conta ficaram", c2.avisos_outros === c0.avisos_outros && c2.avisos_outros === 2);
ok("os arquivos foram para a fila do depósito (o da sala não)", await (async () => {
  const fila = (await dono("select deposito, caminho from interno.alumia_arquivos_a_apagar order by 1, 2")).rows;
  return fila.some((f) => f.deposito === "rede-midia" && f.caminho === FOTO_BETA) && fila.some((f) => f.deposito === "rede-stories") && !fila.some((f) => f.caminho === FOTO_SALA);
})());
ok("manter as contas: seguir, fichas e consentimentos iguais", c2.seguir === c0.seguir && c2.fichas === c0.fichas && c2.consent === c0.consent);
{
  const diferencas = compara(antes, await retrato(), { avisosRede: [] });
  ok(`NADA do instituto mudou (toda tabela de fora da Alumia igual, linha a linha)${diferencas.length ? `: ${diferencas.join("; ")}` : ""}`, diferencas.length === 0);
}
await recusa("o mesmo pedido não roda duas vezes", () => rpc(C, "alumia_admin_zerar_confirmar", { p_id: previa?.id, p_frase: "ZERAR O BETA", p_motivo: "Fim do beta fechado, como avisado." }), "ja_feito");
await espera("o registro do painel tem a prévia e o feito, com o motivo", () => dono("select acao, motivo from interno.alumia_painel_registro where acao in ('zerar_previa', 'zerar_feito') order by id"),
  (r) => r.rows.length === 2 && r.rows[1].motivo === "Fim do beta fechado, como avisado.");
ok("o resultado ficou no pedido", Boolean(feito) && (await um("select feito_em is not null f, resultado ->> 'posts' p from interno.alumia_zerar_pedidos where id = $1", [previa?.id])).p === "3");

// ═══════════════════ 3. Contas saem da Alumia ═══════════════════
await post(P.m1, "Post depois do zerar");
const authAntes = await um("select md5(string_agg(u::text, '|' order by u.id)) h from auth.users u");
const previa2 = await espera("prévia com as contas saindo: pessoas só a partir de 3", () => rpc(C, "alumia_admin_zerar_previa", { p_manter_contas: false }),
  (r) => r.previa.contas_saem.n === 4 && r.previa.posts === 1);
await dono("update interno.alumia_zerar_pedidos set criado_em = now() - interval '20 seconds' where id = $1", [previa2?.id]);
const antes2 = await retrato();
await espera("confirmar com as contas saindo", () => rpc(C, "alumia_admin_zerar_confirmar", { p_id: previa2?.id, p_frase: " ZERAR O BETA ", p_motivo: "Começo da Alumia aberta, contas de novo." }),
  (r) => r.ok && r.contas && r.contas.fichas === 4 && r.contas.consentimentos_revogados === 4);
const c3 = await contagem();
ok("quem não é da equipe saiu da Alumia (ficha fora, consentimento revogado com a linha guardada)", await (async () => {
  const fichas = (await dono("select usuario from interno.alumia_entrada")).rows.map((r) => r.usuario).sort();
  const consent = (await dono("select usuario, revogado_em from interno.rede_consentimentos")).rows;
  return JSON.stringify(fichas) === JSON.stringify([P.coord, P.coord2, P.equipe].sort()) && consent.length === 7
    && consent.filter((c) => c.revogado_em).length === 4 && consent.filter((c) => !c.revogado_em).every((c) => [P.coord, P.coord2, P.equipe].includes(c.usuario));
})());
ok("os seguir com quem saiu foram embora; entre a equipe, nada a perder", c3.seguir === 0 && (await um("select count(*)::int n from interno.rede_roda")).n === 0);
ok("a comunidade: a equipe continua membro, quem saiu não", await (async () => {
  const m = (await dono("select usuario from interno.rede_comunidade_membros where comunidade = 'luta-teste-p5'")).rows.map((r) => r.usuario);
  return m.length === 1 && m[0] === P.equipe;
})());
ok("auth.users não mudou (nenhuma coluna do serviço de contas foi tocada)", (await um("select md5(string_agg(u::text, '|' order by u.id)) h from auth.users u")).h === authAntes.h);
ok("os perfis do instituto ficaram (as contas não foram apagadas)", (await um("select count(*)::int n from interno.perfis where id = any($1)", [Object.values(P)])).n === 7);
{
  const diferencas = compara(antes2, await retrato(), { avisosRede: [] });
  ok(`contas saindo: nada do instituto mudou${diferencas.length ? `: ${diferencas.join("; ")}` : ""}`, diferencas.length === 0);
}
await espera("a coordenação continua com o painel depois de zerar com as contas saindo", () => rpc(C, "alumia_admin_eu"), (r) => r.pode === true);

// ═══════════════════ 4. Relatar um problema ═══════════════════
await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P.m1]);
await recusa("visitante não relata", () => rpc(anon, "alumia_relato_enviar", { p: { texto: "Não abre nada aqui" } }), "permission denied");
await espera("quem está na Alumia relata", () => rpc(como(P.m1), "alumia_relato_enviar", {
  p: { texto: "O botão de publicar some quando abro o teclado.", tela: "https://alumia.exemplo.test/pt/alumia/u/@fulana_7/posts?x=1#y", aparelho: "Chrome · Android · celular<script>", medida: "390x844", versao: "ABC123def" },
}), (r) => r.ok === true && Object.keys(r).length === 1);
await espera("o relato guardou a tela sem nada de quem é, o aparelho limpo, sem conta e sem hora", () => um("select * from interno.alumia_relatos"), (r) =>
  r.tela === "/pt/alumia/u/:x" && r.aparelho.startsWith("Chrome · Android · celular") && !/[<>]/.test(r.aparelho) && r.medida === "390x844" && r.versao === "abc123def" && r.dia && !("autor" in r) && !("criado_em" in r));
await recusa("texto curto demais", () => rpc(como(P.m1), "alumia_relato_enviar", { p: { texto: "ruim" } }), "texto");
await recusa("conta comum não lê a fila", () => rpc(como(P.m1), "alumia_admin_relatos"), "sem_permissao");
const fila = await espera("a coordenação lê a fila", () => rpc(C, "alumia_admin_relatos"), (r) => r.novos === 1 && r.relatos.length === 1 && !JSON.stringify(r).includes(P.m1));
await espera("a coordenação marca como visto, com nota", () => rpc(C, "alumia_admin_relato_mudar", { p_id: fila?.relatos[0].id, p_situacao: "visto", p_nota: "Vamos olhar o teclado." }), (r) => r.ok);
await recusa("situação que não existe", () => rpc(C, "alumia_admin_relato_mudar", { p_id: fila?.relatos[0].id, p_situacao: "apagado", p_nota: "" }), "invalido:situacao");

// ═══════════════════ 5. Erros da tela ═══════════════════
const erro = (mensagem, pagina = "/pt/alumia/p/123e4567-e89b-42d3-a456-426614174000", navegador = "firefox") =>
  rpc(anon, "erro_tela_registrar", { p: { mensagem, pagina, versao: "abc1234", navegador } });
await espera("visitante registra um erro da tela", () => erro("TypeError: x is undefined (fulana@exemplo.org em https://alumia.exemplo.test/u/@fulana?t=99 id 123e4567-e89b-42d3-a456-426614174000 tel 21987654321)"), (r) => r.ok);
await espera("o mesmo erro de novo soma, não vira linha nova", () => erro("TypeError: x is undefined (fulana@exemplo.org em https://alumia.exemplo.test/u/@fulana?t=99 id 123e4567-e89b-42d3-a456-426614174000 tel 21987654321)"), (r) => r.ok);
await espera("navegador desconhecido vira 'outro'", () => erro("ReferenceError: y", "/pt/alumia", "netscape"), (r) => r.ok);
await espera("o que ficou guardado: sem e-mail, link, @nome, id nem número; a página sem id", () => dono("select * from interno.alumia_erros_tela order by mensagem"), (r) => {
  const a = r.rows.find((x) => x.mensagem.startsWith("TypeError"));
  const b = r.rows.find((x) => x.mensagem.startsWith("ReferenceError"));
  const tudo = JSON.stringify(r.rows);
  return r.rows.length === 2 && a.vezes === 2 && a.pagina === "/pt/alumia/p/:x" && b.navegador === "outro"
    && !/fulana|exemplo|21987654321|123e4567|https?:/.test(tudo) && /<e-mail>/.test(a.mensagem) && /<link>/.test(a.mensagem);
});
await espera("erro sem página de verdade é ignorado", () => erro("Erro qualquer", "javascript:alert(1)"), (r) => r.ok === false);
await recusa("conta comum não lê os erros", () => rpc(como(P.m1), "alumia_admin_erros_tela", { p_dias: 7 }), "sem_permissao");
await espera("a coordenação lê os erros somados", () => rpc(C, "alumia_admin_erros_tela", { p_dias: 7 }), (r) => r.erros.length === 2 && r.erros[0].vezes === 2);
await espera("os erros têm limite por origem (o 21º em 10 minutos é recusado)", async () => {
  for (let i = 0; i < 25; i++) {
    try {
      await rpc({ papel: "anon", ip: "203.0.113.99" }, "erro_tela_registrar", { p: { mensagem: `Erro ${i}`, pagina: "/pt/alumia", versao: "", navegador: "chrome" } });
    } catch (e) {
      return String(e.message);
    }
  }
  return "";
}, (m) => m.includes("muitos_pedidos"));

// ═══════════════════ 6. O aparelho limpa igual ao banco; as telas ═══════════════════
{
  const casos = ["https://alumia.exemplo.test/pt/alumia/u/@fulana_7/posts?x=1#y", "/pt/alumia/p/123e4567-e89b-42d3-a456-426614174000", "/pt/alumia/c/sala-de-luta/sobre",
    "/pt/alumia/@outra", "/pt/alumia/convite/ABCD1234", "/pt/alumia/ato/987654/album", "/pt/alumia"];
  const doBanco = (await dono("select x, interno.alumia_p5_endereco_limpo(x) l from unnest($1::text[]) x", [casos])).rows;
  const dif = doBanco.filter((r) => telaLimpa(r.x) !== r.l).map((r) => `${r.x}: aparelho "${telaLimpa(r.x)}", banco "${r.l}"`);
  ok(`a tela limpa no aparelho é a mesma do banco${dif.length ? ` (${dif.join("; ")})` : ""}`, dif.length === 0);
  const msgs = ["TypeError: x (fulana@exemplo.org) https://a.b/c?d=1 @fulana 123e4567-e89b-42d3-a456-426614174000 21987654321", "Erro   com\n quebras", "ChunkLoadError: Loading chunk 4521 failed."];
  const doBanco2 = (await dono("select x, interno.alumia_p5_texto_limpo(x) l from unnest($1::text[]) x", [msgs])).rows;
  const dif2 = doBanco2.filter((r) => mensagemLimpa(r.x) !== r.l).map((r) => `"${mensagemLimpa(r.x)}" x "${r.l}"`);
  ok(`a mensagem limpa no aparelho é a mesma do banco${dif2.length ? ` (${dif2.join("; ")})` : ""}`, dif2.length === 0);
  ok("o aparelho do relato: família, sistema e tipo, sem versão nem modelo",
    aparelhoDoRelato("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", 390) === "Chrome · Android · celular"
    && aparelhoDoRelato("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0", 1440) === "Firefox · Windows · computador");
  ok("a família do navegador para o registro (Brave e Vivaldi contam como Chrome)", familiaDoNavegador("Mozilla/5.0 Chrome/130.0 Vivaldi/6.9") === "chrome" && familiaDoNavegador("algo estranho") === "outro");
  ok("a medida e a versão", medidaDaTela(390.4, 844) === "390x844" && medidaDaTela(0, 10) === "" && versaoLimpa("ABCDEF1234567890\n") === "abcdef123456" && versaoLimpa("<html>") === "");
  const freio = criarFreio(2);
  ok("o freio do aparelho: cada mensagem uma vez e no máximo o teto", freio("a") && !freio("a") && freio("b") && !freio("c"));
  const registrar = ler("lib/rede/beta/registrar.ts");
  ok("o registro de erros vai como visitante (a chave pública, nunca o token da sessão) e sem cookie", registrar.includes("Authorization: `Bearer ${chave}`") && /credentials: "omit"/.test(registrar) && !/getSession|access_token/.test(registrar));
  ok("a tela de erro da Alumia e o ouvinte da casca mandam o erro", ler("app/[lang]/alumia/error.tsx").includes("registrarErroDaTela(error)") && ler("app/[lang]/alumia/layout.tsx").includes("<OuvirErros />"));
  const ajuda = ler("components/rede/lei/TelaDaAjuda.tsx");
  ok("a ajuda tem o relato e o pedido de não divulgar a falha, com o security.txt", ajuda.includes("<RelatarProblema") && ajuda.includes("/.well-known/security.txt"));
  const painel = ler("components/painel/alumia/admin/PainelUnico.tsx");
  ok("o painel de admin tem a fila dos relatos e os erros na Saúde, e o Beta tem o zerar", painel.includes("<Relatos />") && painel.includes("<ErrosDaTela />") && ler("components/painel/alumia/admin/Beta.tsx").includes("<ZerarOBeta"));
  const sec = ler("public/.well-known/security.txt");
  ok("o security.txt vale para o endereço da Alumia também, com prazo e contato", /^Contact: mailto:/m.test(sec) && /^Expires: /m.test(sec) && /Canonical: https:\/\/alumia\./.test(sec));
}

console.log(`\nP5 · beta (zerar, relatos, erros da tela): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
