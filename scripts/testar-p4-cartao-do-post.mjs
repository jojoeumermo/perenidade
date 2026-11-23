// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, grupo "cartão do post" (itens 30, 31, 35 e 120, e a prova dos que já existiam, 32 e 135), atrás de "alumia-p4-cartao-do-post":
//   · 30: a mediação escolhe até 6 emojis; reagir e contar seguem a lista em vigor; ninguém vê quem reagiu; total nulo abaixo de 3;
//   · 31: a tradução roda no aparelho (o tradutor do próprio navegador), sem ir à rede; no modo leve, desligada; sem ele, o nosso servidor;
//   · 35: a pasta privada vira coleção pública do perfil; o post restrito fica fora e, na leitura, cada post passa por rede_ve;
//   · 120: só o post aberto à internet vira imagem; a autora pode sumir da imagem; o pé leva o endereço e o @institutoluciaorg.
// O banco: o install.sql deste ramo (o antes) e a migração por cima, duas vezes, com a porta conferida por interno.alumia_trancar().
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p4-cartao-do-post.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import * as regras from "../lib/rede/p4/cartao/regras.ts";
import { cartaoP4Ligado } from "../lib/rede/p4/cartao/ligado.ts";
import * as traducaoLocal from "../lib/rede/p4/cartao/traducao-local.ts";
import * as voz from "../lib/rede/midia/voz.ts";
import { reacoesParaMostrar, REACOES } from "../lib/rede/tipos-conversa.ts";
import { TAMANHOS, desenharArte, PALETA_NOITE } from "../lib/rede/alcance/arte.ts";
import { SO_PELO_NOME, RECURSOS } from "../lib/recursos.ts";
import { NOMES_DAS_FUNCOES } from "../components/painel/alumia/nomes-das-funcoes.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const IP = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

const SQL = normal(ler("supabase/migracoes/20261127-p4-cartao-do-post.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração tem licença, o que faz, 'Pode rodar mais de uma vez' e a lei", SQL.startsWith("-- Instituto Lúcia") && SQL.includes("Pode rodar mais de uma vez") && /Lei: LGPD art\./.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr/i.test(semComentario));
ok("o interruptor entra no catálogo protegido por to_regclass", /to_regclass\('interno\.recursos_catalogo'\)[\s\S]{0,200}'alumia-p4-cartao-do-post', true/.test(SQL));
ok("as tabelas novas têm RLS ligada", (SQL.match(/enable row level security/g) ?? []).length === 2);
{
  const publicas = [...semComentario.matchAll(/create or replace function (public\.\w+)[\s\S]*?\$\$([\s\S]*?)\$\$;/g)];
  ok(`toda função pública nova começa pela porta (${publicas.length})`, publicas.length === 4 && publicas.every((m) => /^\s*declare[^;]*(;[^;]*)*?begin\s+perform interno\.alumia_porta\(\);/.test(m[2])));
}

async function montar(banco) {
  const { dono, criarUsuario, rpc } = banco;
  const P = {};
  for (const [i, nome] of ["ana", "bia", "cris", "duda", "eva", "fora"].entries()) {
    P[nome] = await criarUsuario(`${nome}@p4-cartao.local`, nome);
    await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [P[nome], `Pessoa ${nome}`, `pessoa_${nome}`]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('praca', 'Praça', 'disciplinas', 'aberta'), ('outra', 'Outra', 'disciplinas', 'aberta'), ('roda', 'Roda', 'lutas', 'aberta') on conflict do nothing");
  for (const [nome, id] of Object.entries(P)) {
    if (nome === "fora") continue;
    await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao, papel) values ('praca', $1, 'ativo', $2), ('outra', $1, 'ativo', 'membro') on conflict do nothing",
      [id, nome === "ana" ? "moderacao" : "membro"]);
  }
  const como = (quem) => ({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9" });
  const chamar = async (quem, f, a) => {
    await dono("delete from interno.limites");
    return rpc(como(quem), f, a);
  };
  const publicar = (quem, pedido) => chamar(quem, "rede_publicar", { p: pedido });
  return { P, como, chamar, publicar };
}
const ligar = (banco, sim) => banco.dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-cartao-do-post', $1) on conflict (nome) do update set ligado = excluded.ligado", [sim]);

// ═══ 1. Antes: a lista fixa de 8 estava no check da tabela ═══
// Colada no install.sql (depois da junção), o banco de antes é o install.sql cortado antes dela.
const banco = await criarBanco(normal(ler("supabase/install.sql")).includes(SQL) ? { antesDe: SQL } : {});
const { dono } = banco;
const install = normal(ler("supabase/install.sql"));
const montado = await montar(banco);
{
  const { P, publicar } = montado;
  const post = await passa("antes: um post aberto publica", () => publicar("ana", { comunidade: "praca", publico: "internet", texto: "Antes." }));
  if (post?.id) {
    await recusa("antes: emoji fora dos 8 nem entrava na tabela", () => dono("insert into interno.rede_reacoes_emoji (post, usuario, emoji) values ($1, $2, '🌻')", [post.id, P.bia]), "rede_reacoes_emoji_emoji_check");
  }
  const existe = (await dono("select to_regprocedure('public.rede_p4_reacoes_mudar(text, text[])') is not null as e")).rows[0].e;
  ok("antes: não havia como a mediação escolher a lista", existe === false);
}

// ═══ 2. A migração por cima, duas vezes ═══
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const t = (await dono("select count(*)::int n from pg_trigger where tgname in ('p4_reacao_da_lista', 'p4_pasta_mudou', 'p4_pasta_desligou')")).rows[0].n;
  ok(`as três regras nas tabelas (${t})`, t === 3);
  const k = (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-cartao-do-post'")).rows[0];
  ok("o interruptor está no catálogo, só pelo nome", k?.so_pelo_nome === true);
  const diretas = (await dono(`select count(*)::int n from information_schema.role_table_grants where table_schema = 'interno'
     and table_name in ('rede_p4_com_reacoes', 'rede_p4_pastas_publicas') and grantee in ('anon', 'authenticated')`)).rows[0].n;
  ok("nenhuma permissão direta nas tabelas novas", diretas === 0);
}

const { P, chamar, publicar } = montado;
const post = await publicar("bia", { comunidade: "praca", publico: "internet", texto: "Um post da praça." });
const postOutra = await publicar("bia", { comunidade: "outra", publico: "internet", texto: "Um post da outra." });

// ═══ 3. Item 30: reações próprias da comunidade ═══
{
  await ligar(banco, false);
  await recusa("desligado: a mediação não muda a lista", () => chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🌻"] }), "desligado");
  const r0 = await passa("desligado: a lista da praça é a fechada", () => chamar("bia", "rede_p4_reacoes_da_comunidade", { p_slug: "praca" }));
  ok("desligado: a lista é a padrão e ninguém pode mudar", JSON.stringify(r0?.emojis) === JSON.stringify(REACOES.map((x) => x.emoji)) && r0?.pode_mudar === false);
  await recusa("desligado: emoji fora dos 8 continua recusado", () => chamar("bia", "rede_alumia_reagir", { p_post: post.id, p_emoji: "🌻", p_sim: true }), "invalido:emoji");

  await ligar(banco, true);
  await recusa("ligado: quem não é da mediação não muda", () => chamar("bia", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🌻"] }), "sem_permissao");
  await recusa("ligado: 7 emojis, recusa", () => chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🌻", "🌹", "🌷", "🌼", "🌸", "🌺", "🍀"] }), "invalido:muitos");
  await recusa("ligado: letra no lugar de emoji, recusa", () => chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🌻", "abc"] }), "invalido:emoji");
  await recusa("ligado: o gesto obsceno, recusa", () => chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🖕"] }), "invalido:emoji");
  await recusa("ligado: emoji repetido, recusa", () => chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🌻", "🌻"] }), "invalido:repetido");
  const lista = ["🌻", "✊🏾", "🏳️‍🌈", "📢", "❤️", "🚩"];
  const m = await passa("ligado: a mediação escolhe 6 emojis", () => chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: lista }));
  ok("a lista volta como foi escolhida", JSON.stringify(m?.emojis) === JSON.stringify(lista) && m?.propria === true);
  const vista = await chamar("bia", "rede_p4_reacoes_da_comunidade", { p_slug: "praca" });
  ok("quem é da comunidade vê a lista própria (sem poder mudar)", JSON.stringify(vista.emojis) === JSON.stringify(lista) && vista.propria === true && vista.pode_mudar === false);
  const vistaAna = await chamar("ana", "rede_p4_reacoes_da_comunidade", { p_slug: "praca" });
  ok("a mediação pode mudar", vistaAna.pode_mudar === true);
  ok("a lista não diz quem da mediação mudou", !JSON.stringify(vista).match(UUID) && !/pessoa_|Pessoa /.test(JSON.stringify(vista)));
  const linha = (await dono("select * from interno.rede_p4_com_reacoes where comunidade = 'praca'")).rows[0];
  ok("a tabela da lista não guarda quem mudou", Object.keys(linha).sort().join() === "comunidade,emojis,mudou_em");

  await recusa("emoji da lista padrão que não está na lista própria, recusa", () => chamar("bia", "rede_alumia_reagir", { p_post: post.id, p_emoji: "🔥", p_sim: true }), "invalido:emoji");
  await recusa("emoji da lista própria em post de outra comunidade, recusa", () => chamar("bia", "rede_alumia_reagir", { p_post: postOutra.id, p_emoji: "🌻", p_sim: true }), "invalido:emoji");
  await recusa("a tabela recusa emoji fora da lista, venha de onde vier", () => dono("insert into interno.rede_reacoes_emoji (post, usuario, emoji) values ($1, $2, '🔥')", [post.id, P.bia]), "invalido:emoji");
  const r1 = await passa("um emoji da lista própria entra", () => chamar("bia", "rede_alumia_reagir", { p_post: post.id, p_emoji: "🌻", p_sim: true }));
  ok("com uma pessoa, o total é nulo (poucas) e a minha vem marcada", r1?.reacoes?.length === 1 && r1.reacoes[0].total === null && r1.reacoes[0].minha === true);
  await chamar("cris", "rede_alumia_reagir", { p_post: post.id, p_emoji: "🌻", p_sim: true });
  // Auditoria do P4 (B4): a própria ação não pode revelar um número abaixo de 3. Antes, com 2 reações dos outros, quem reagia em
  // 3º recebia total 3 (e ficava sabendo que eram exatamente 2); e quem não reagiu via a entrada do emoji com total nulo ("1 ou 2").
  {
    const deFora = (await chamar("eva", "rede_alumia_reacoes", { p_posts: [post.id] })).itens[0].reacoes;
    ok(`com 2 reações, quem não reagiu não vê nem a entrada do emoji (${JSON.stringify(deFora)})`, !deFora.some((x) => x.emoji === "🌻"));
    const terceira = await chamar("duda", "rede_alumia_reagir", { p_post: post.id, p_emoji: "🌻", p_sim: true });
    const t3 = terceira?.reacoes?.find((x) => x.emoji === "🌻");
    ok(`quem reage em 3º não recebe o total (${JSON.stringify(t3)})`, t3?.minha === true && t3.total === null);
    const daBia = (await chamar("bia", "rede_alumia_reacoes", { p_posts: [post.id] })).itens[0].reacoes.find((x) => x.emoji === "🌻");
    ok("quem reagiu antes também não (fora ela, só 2)", daBia?.minha === true && daBia.total === null);
  }
  await chamar("eva", "rede_alumia_reagir", { p_post: post.id, p_emoji: "🚩", p_sim: true });
  const r3 = await chamar("eva", "rede_alumia_reacoes", { p_posts: [post.id] });
  const reacoes = r3.itens[0].reacoes;
  ok(`com 3 pessoas, o total aparece; na ordem da lista (${JSON.stringify(reacoes)})`, reacoes[0].emoji === "🌻" && reacoes[0].total === 3 && reacoes[1].emoji === "🚩" && reacoes[1].total === null && reacoes[1].minha === true);
  ok("nenhum número abaixo de 3 sai", reacoes.every((x) => x.total === null || x.total >= 3));
  const autora = await chamar("bia", "rede_alumia_reacoes", { p_posts: [post.id] });
  const daMediacao = await chamar("ana", "rede_alumia_reacoes", { p_posts: [post.id] });
  ok("nem a autora nem a mediação veem quem reagiu", [autora, daMediacao, r3].every((x) => !JSON.stringify(x.itens.map((i) => i.reacoes)).match(UUID) && !/pessoa_|Pessoa /.test(JSON.stringify(x))));
  const conversa = await chamar("eva", "rede_alumia_conversa", { p_id: post.id, p_ordem: "antigas" });
  ok("a conversa mostra as reações da lista própria", conversa?.post?.reacoes?.[0]?.emoji === "🌻");

  // A mediação tira o 🚩: a reação some da conta, mas não é apagada; volta com o emoji.
  await chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🌻", "📢"] });
  const r4 = (await chamar("eva", "rede_alumia_reacoes", { p_posts: [post.id] })).itens[0].reacoes;
  ok("o emoji que saiu da lista não aparece", r4.length === 1 && r4[0].emoji === "🌻");
  ok("a reação com o emoji que saiu não foi apagada", (await dono("select count(*)::int n from interno.rede_reacoes_emoji where emoji = '🚩'")).rows[0].n === 1);
  // Desligar o interruptor: volta a lista fechada, sem apagar a lista própria.
  await ligar(banco, false);
  const r5 = await chamar("bia", "rede_p4_reacoes_da_comunidade", { p_slug: "praca" });
  ok("desligado de novo: vale a lista fechada", JSON.stringify(r5.emojis) === JSON.stringify(REACOES.map((x) => x.emoji)) && r5.propria === false);
  const r6 = (await chamar("eva", "rede_alumia_reacoes", { p_posts: [post.id] })).itens[0].reacoes;
  ok("desligado de novo: as reações próprias não aparecem", r6.length === 0);
  await ligar(banco, true);
  const volta = await chamar("ana", "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: [] });
  ok("lista vazia volta à fechada", volta.propria === false && (await dono("select count(*)::int n from interno.rede_p4_com_reacoes")).rows[0].n === 0);
  await passa("na lista fechada, os 8 de sempre reagem", () => chamar("bia", "rede_alumia_reagir", { p_post: post.id, p_emoji: "🔥", p_sim: true }));
  // Visitante (sem conta) não lê a lista de uma comunidade que não é de disciplina (a mesma regra de ver a comunidade).
  await recusa("visitante não lê a lista de comunidade de lutas", () => banco.rpc({ papel: "anon" }, "rede_p4_reacoes_da_comunidade", { p_slug: "roda" }), "entre_primeiro");
  await recusa("visitante não muda a lista", () => banco.rpc({ papel: "anon" }, "rede_p4_reacoes_mudar", { p_slug: "praca", p_emojis: ["🌻"] }), "");
}

// ═══ 4. Item 35: a pasta pública ═══
{
  await ligar(banco, true);
  const aberto = await publicar("bia", { comunidade: "praca", publico: "internet", texto: "Explicação aberta." });
  const membros = await publicar("cris", { publico: "membros", texto: "Só para membros." });
  const seguidores = await publicar("bia", { publico: "seguidores", texto: "Texto só para quem segue a Bia." });
  const daComunidade = await publicar("cris", { comunidade: "praca", publico: "comunidade", texto: "Só da praça." });
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P.ana, P.bia]);
  const pasta = await chamar("ana", "rede_alumia_pasta_criar", { p_nome: "Boas explicações", p_nucleo: null });
  for (const x of [aberto, membros, seguidores, daComunidade]) await chamar("ana", "rede_alumia_pasta_por", { p_pasta: pasta.id, p_post: x.id, p_sim: true });

  await ligar(banco, false);
  await recusa("desligado: a pasta não vira pública", () => chamar("ana", "rede_p4_pasta_publica", { p_pasta: pasta.id, p_sim: true }), "desligado");
  await ligar(banco, true);
  await recusa("a pasta de outra pessoa não vira pública por ela", () => chamar("bia", "rede_p4_pasta_publica", { p_pasta: pasta.id, p_sim: true }), "nao_encontrado");
  const pub = await passa("a dona torna a pasta pública", () => chamar("ana", "rede_p4_pasta_publica", { p_pasta: pasta.id, p_sim: true, p_titulo: null, p_descricao: "Para estudar." }));
  ok("a resposta diz que algum post ficou de fora, sem dizer quantos nem quais", pub?.publica === true && pub.ficou_fora === true && Object.keys(pub).sort().join() === "colecao,ficou_fora,publica");
  const itens = (await dono("select post from interno.rede_acervo_colecao_itens where colecao = $1", [pub.colecao])).rows.map((r) => r.post);
  ok(`na coleção entram só os posts abertos (${itens.length})`, itens.length === 2 && itens.includes(aberto.id) && itens.includes(membros.id));
  ok("o post de seguidores e o da comunidade ficam só na pasta", !itens.includes(seguidores.id) && !itens.includes(daComunidade.id));
  const col = await chamar("fora", "rede_acervo_colecao", { p_id: pub.colecao });
  ok("quem é de fora da praça lê a coleção com o nome da pasta", col.titulo === "Boas explicações" && col.dono.tipo === "pessoa" && col.dono.handle === "pessoa_ana");
  ok("e nenhum texto restrito vem junto", !JSON.stringify(col).includes("só para quem segue") && !JSON.stringify(col).includes("Só da praça"));
  const visitante = await banco.rpc({ papel: "anon" }, "rede_acervo_colecao", { p_id: pub.colecao }).catch((e) => ({ erro: e.message }));
  ok(`o visitante, pela coleção, não vê o post só de membros (rede_ve na leitura): ${JSON.stringify(visitante).slice(0, 120)}`,
    !JSON.stringify(visitante).includes("Só para membros"));
  // O post que entra ou sai da pasta entra ou sai da coleção.
  const outro = await publicar("duda", { comunidade: "praca", publico: "internet", texto: "Mais um aberto." });
  await chamar("ana", "rede_alumia_pasta_por", { p_pasta: pasta.id, p_post: outro.id, p_sim: true });
  await chamar("ana", "rede_alumia_pasta_por", { p_pasta: pasta.id, p_post: membros.id, p_sim: false });
  const depois = (await dono("select post from interno.rede_acervo_colecao_itens where colecao = $1", [pub.colecao])).rows.map((r) => r.post);
  ok("a coleção acompanha a pasta (entrou um, saiu outro)", depois.length === 2 && depois.includes(outro.id) && !depois.includes(membros.id));
  // A autora tira o post dela da coleção: ele não volta, nem se a dona puser de novo na pasta.
  await chamar("duda", "rede_acervo_colecao_tirar_meu", { p_id: pub.colecao, p_post: outro.id });
  await chamar("ana", "rede_alumia_pasta_por", { p_pasta: pasta.id, p_post: outro.id, p_sim: false });
  await chamar("ana", "rede_alumia_pasta_por", { p_pasta: pasta.id, p_post: outro.id, p_sim: true });
  const fora = (await dono("select count(*)::int n from interno.rede_acervo_colecao_itens where colecao = $1 and post = $2", [pub.colecao, outro.id])).rows[0].n;
  ok("o post que a autora tirou não volta pela pasta", fora === 0);
  const minhas = await chamar("ana", "rede_p4_pastas_publicas", {});
  ok("a dona vê quais pastas estão públicas", minhas.ligado === true && minhas.itens.length === 1 && minhas.itens[0].pasta === pasta.id);
  const deOutra = await chamar("bia", "rede_p4_pastas_publicas", {});
  ok("outra pessoa não vê as pastas públicas da dona por aqui", deOutra.itens.length === 0);
  // Pasta do núcleo nunca vira pública (a tabela tem a pasta com núcleo; a função recusa antes de olhar o núcleo).
  const nuc = (await dono("select id from interno.rede_nucleos limit 1")).rows[0];
  if (nuc) {
    const pn = (await dono("insert into interno.rede_alumia_pastas (nucleo, nome) values ($1, 'Do núcleo') returning id", [nuc.id])).rows[0].id;
    await recusa("pasta do núcleo não vira pública", () => chamar("ana", "rede_p4_pasta_publica", { p_pasta: pn, p_sim: true }), "nao_encontrado");
  } else {
    const k = ler("supabase/migracoes/20261127-p4-cartao-do-post.sql");
    ok("pasta do núcleo não vira pública (a função exige a pasta da própria pessoa)", k.includes("if k.usuario is distinct from v then perform interno.erro('sem_permissao')"));
  }
  // Voltar para privada: a coleção some, os salvos ficam.
  const priv = await chamar("ana", "rede_p4_pasta_publica", { p_pasta: pasta.id, p_sim: false });
  const sobra = (await dono("select count(*)::int n from interno.rede_acervo_colecoes where id = $1", [pub.colecao])).rows[0].n;
  const salvos = (await dono("select count(*)::int n from interno.rede_alumia_pasta_itens where pasta = $1", [pasta.id])).rows[0].n;
  ok("voltar para privada apaga a coleção e deixa a pasta", priv.publica === false && sobra === 0 && salvos >= 3);
  // Apagar a pasta pública apaga a coleção.
  const pub2 = await chamar("ana", "rede_p4_pasta_publica", { p_pasta: pasta.id, p_sim: true, p_titulo: "Outra vez" });
  await chamar("ana", "rede_alumia_pasta_mudar", { p_id: pasta.id, p_nome: null });
  ok("apagar a pasta apaga a coleção", (await dono("select count(*)::int n from interno.rede_acervo_colecoes where id = $1", [pub2.colecao])).rows[0].n === 0);
  const colunas = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_pastas_publicas' order by 1")).rows.map((r) => r.column_name);
  ok(`a ligação não guarda quem viu nem quantas vezes (${colunas})`, colunas.join() === "colecao,criado_em,pasta");
}

// ═══ 5. Nada de endereço de rede nas tabelas novas ═══
{
  const cols = (await dono(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno'
    and table_name in ('rede_p4_com_reacoes', 'rede_p4_pastas_publicas')`)).rows;
  ok("nenhuma coluna de endereço de rede", cols.every((c) => c.data_type !== "inet" && !/ip|endereco/.test(c.column_name)));
  const dump = JSON.stringify((await dono("select * from interno.rede_p4_com_reacoes")).rows) + JSON.stringify((await dono("select * from interno.rede_p4_pastas_publicas")).rows);
  ok("nenhum IP gravado", !IP.test(dump));
}

// ═══ 6. As regras puras ═══
ok("emojiAceito: emoji simples, com tom de pele, bandeira e família", ["🌻", "✊🏾", "🏳️‍🌈", "❤️", "👩‍👩‍👧"].every(regras.emojiAceito));
ok("emojiAceito: recusa letra, número, espaço, texto e o gesto obsceno", ["a", "1", " ", "🌻a", "🖕", "", "<b>"].every((e) => !regras.emojiAceito(e)));
ok("separarEmojis: por grafema, sem espaço nem vírgula", JSON.stringify(regras.separarEmojis(" 🌻, ✊🏾 🏳️‍🌈")) === JSON.stringify(["🌻", "✊🏾", "🏳️‍🌈"]));
ok("conferirLista: 7 é demais, repetido e letra não", regras.conferirLista(["🌻", "🌹", "🌷", "🌼", "🌸", "🌺", "🍀"]) === "muitos" && regras.conferirLista(["🌻", "🌻"]) === "repetido" && regras.conferirLista(["x"]) === "emoji" && regras.conferirLista(["🌻"]) === null);
ok("paletaDoPost: a do banco, ou a padrão", JSON.stringify(regras.paletaDoPost(["🌻", "x"], ["✊"])) === JSON.stringify(["🌻"]) && JSON.stringify(regras.paletaDoPost(null, ["✊"])) === JSON.stringify(["✊"]));
{
  const mostrar = reacoesParaMostrar([{ emoji: "🌻", total: 2, minha: false }, { emoji: "✊", total: 5, minha: false }], ["🌻"]);
  ok("reacoesParaMostrar com a paleta da comunidade: só os dela, sem número abaixo de 3", mostrar.length === 1 && mostrar[0].emoji === "🌻" && mostrar[0].total === null);
  const padrao = reacoesParaMostrar([{ emoji: "✊", total: 5, minha: false }, { emoji: "🌻", total: 9, minha: false }]);
  ok("reacoesParaMostrar sem paleta: a lista fechada de sempre", padrao.length === 1 && padrao[0].emoji === "✊" && padrao[0].nome === "punho");
}
// Item 31: traduzir no aparelho (o tradutor do próprio navegador), desligado no modo leve; sem ele, o nosso servidor.
ok("tradução no aparelho: desligada no modo leve, mesmo com o modelo no aparelho", ["available", "downloadable"].every((d) =>
  regras.estadoDaTraducaoNoAparelho({ saveData: true }, d) === "desligada_no_leve" && regras.estadoDaTraducaoNoAparelho({ deviceMemory: 2 }, d) === "desligada_no_leve"
  && regras.estadoDaTraducaoNoAparelho({ effectiveType: "slow-2g" }, d) === "desligada_no_leve" && regras.estadoDaTraducaoNoAparelho({ leveEscolhido: true }, d) === "desligada_no_leve"));
ok("tradução no aparelho: pronta, baixar (o navegador baixa o modelo) ou sem modelo", regras.estadoDaTraducaoNoAparelho({ deviceMemory: 8 }, "available") === "pronta"
  && regras.estadoDaTraducaoNoAparelho({}, "downloadable") === "baixar" && regras.estadoDaTraducaoNoAparelho({}, "downloading") === "baixar"
  && ["unavailable", null, undefined, "qualquer"].every((d) => regras.estadoDaTraducaoNoAparelho({}, d) === "sem_modelo"));
ok("a língua detectada só com certeza (60%) e etiqueta de verdade", regras.linguaDetectada([{ detectedLanguage: "en", confidence: 0.9 }, { detectedLanguage: "es", confidence: 0.1 }]) === "en"
  && regras.linguaDetectada([{ detectedLanguage: "pt-BR", confidence: 0.8 }]) === "pt" && regras.linguaDetectada([{ detectedLanguage: "en", confidence: 0.4 }]) === null
  && regras.linguaDetectada([{ detectedLanguage: "und", confidence: 0.99 }]) === null && regras.linguaDetectada([{ detectedLanguage: "<b>", confidence: 0.99 }]) === null && regras.linguaDetectada(null) === null);
{
  // Um navegador falso: conta o que foi pedido ao tradutor e prova que nada foi à rede durante a tradução.
  const pedidos = [];
  const falso = (disp = "available", confianca = 0.95, lingua = "en") => ({
    LanguageDetector: { create: async () => ({ detect: async (t) => (pedidos.push(["detectar", t]), [{ detectedLanguage: lingua, confidence: confianca }]) }) },
    Translator: {
      availability: async (o) => (pedidos.push(["par", `${o.sourceLanguage}>${o.targetLanguage}`]), disp),
      create: async (o) => ({ translate: async (t) => `[${o.sourceLanguage}>${o.targetLanguage}] ${t}` }),
    },
  });
  const fetchDeVerdade = globalThis.fetch;
  let foiARede = 0;
  globalThis.fetch = async () => {
    foiARede++;
    throw new Error("rede proibida no teste");
  };
  try {
    const r = await traducaoLocal.traduzirNoAparelho(falso(), { deviceMemory: 8 }, "Hello, comrades.", "Title", "pt");
    ok(`no aparelho: traduz o texto e o título, com a língua detectada (${JSON.stringify(r)})`, r.ok && r.texto === "[en>pt] Hello, comrades." && r.titulo === "[en>pt] Title" && r.origem === "en");
    const baixar = await traducaoLocal.traduzirNoAparelho(falso("downloadable"), {}, "Hello.", null, "pt");
    ok("no aparelho: com o modelo para baixar, traduz (o navegador baixa o modelo; o texto fica aqui)", baixar.ok && baixar.texto === "[en>pt] Hello.");
    const leve = await traducaoLocal.traduzirNoAparelho(falso(), { leveEscolhido: true }, "Hello.", null, "pt");
    const antesDoLeve = pedidos.length;
    ok("no modo leve, nem pergunta ao tradutor", !leve.ok && leve.motivo === "desligada_no_leve" && pedidos.length === antesDoLeve);
    const incerto = await traducaoLocal.traduzirNoAparelho(falso("available", 0.3), {}, "Hm.", null, "pt");
    ok("sem certeza da língua, desiste (a tela usa o nosso servidor, se houver)", !incerto.ok && incerto.motivo === "sem_lingua");
    const semPar = await traducaoLocal.traduzirNoAparelho(falso("unavailable"), {}, "Hello.", null, "pt");
    ok("par sem modelo, desiste", !semPar.ok && semPar.motivo === "sem_modelo");
    const mesma = await traducaoLocal.traduzirNoAparelho(falso("available", 0.9, "pt"), {}, "Olá.", null, "pt");
    ok("já na língua da página, devolve o texto como está", mesma.ok && mesma.texto === "Olá.");
    const sem = await traducaoLocal.traduzirNoAparelho(null, {}, "Hello.", null, "pt");
    ok("navegador sem o tradutor: sem_modelo", !sem.ok && sem.motivo === "sem_modelo");
    ok("nenhuma tradução no aparelho foi à rede", foiARede === 0);
    ok("aparelhoPodeTentar: com o tradutor e fora do leve", traducaoLocal.aparelhoPodeTentar(falso(), {}) && !traducaoLocal.aparelhoPodeTentar(falso(), { saveData: true }) && !traducaoLocal.aparelhoPodeTentar(null, {}));
  } finally {
    globalThis.fetch = fetchDeVerdade;
  }
  const local = ler("lib/rede/p4/cartao/traducao-local.ts").replace(/\/\/.*$/gm, "");
  ok("o tradutor do aparelho não tem fetch, endereço nem serviço de fora", !/\bfetch\(|https?:\/\/|XMLHttpRequest|sendBeacon|WebSocket/.test(local));
  const tela = ler("components/rede/pontes/Traduzir.tsx");
  ok("Traduzir: tenta no aparelho primeiro e só então o nosso servidor", /traduzirNoAparelho\([\s\S]*?\)[\s\S]*?pontes\.traduzir\(/.test(tela) && tela.includes("if (!servidor) throw"));
  ok("Traduzir: diz onde rodou (no aparelho ou pelo nosso servidor)", tela.includes("t4.traducao.noAparelho") && tela.includes("t4.traducao.noServidor"));
  ok("Traduzir: sem 'alumia-traducao', o nosso servidor não entra", /if \(!traducaoLigada\(\)\) return Promise\.resolve\(false\);/.test(tela));
  const traduzir = ler("app/api/rede/traduzir/route.ts") + ler("lib/rede/pontes/traducao.ts");
  ok("o caminho do servidor continua só no servidor próprio (sem serviço de terceiros pelo navegador)", /servidorInterno/.test(traduzir) && !/translate\.googleapis|deepl\.com|api\.openai/i.test(traduzir));
}
// Item 120
const base = { retido: false, grupo: null, corpo_grupo: null };
ok("só o post aberto à internet vira imagem", regras.postPodeVirarImagem({ ...base, publico: "internet" })
  && ["membros", "seguidores", "comunidade", "nucleo", "equipe"].every((p) => !regras.postPodeVirarImagem({ ...base, publico: p })));
ok("nem o post da internet retido, nem o cifrado", !regras.postPodeVirarImagem({ ...base, publico: "internet", retido: true }) && !regras.postPodeVirarImagem({ ...base, publico: "internet", corpo_grupo: "p2.1.x.y" }));
ok("o pé da imagem leva o endereço da Alumia e o @institutoluciaorg", regras.rodapeDaImagem("https://alumia.exemplo.org/") === "alumia.exemplo.org · @institutoluciaorg"
  && regras.rodapeDaImagem("https://exemplo.org/pt/alumia") === "exemplo.org/pt/alumia · @institutoluciaorg");
{
  const autor = { codinome: "Pessoa ana", handle: "pessoa_ana", perfil: true };
  const sem = regras.autoriaDaImagem({ autor }, true);
  const com = regras.autoriaDaImagem({ autor }, false);
  ok("esconder a autora tira o codinome e o @", sem.codinome === "" && sem.handle === null && com.codinome === "Pessoa ana" && com.handle === "pessoa_ana");
  ok("os destinos: Instagram e WhatsApp, com o formato de cada um", regras.DESTINOS_DA_IMAGEM.length === 4 && regras.DESTINOS_DA_IMAGEM.every((d) => d.formato in TAMANHOS) && TAMANHOS.story.altura === 1920);
  // Desenha num contexto falso: sem autora, nem o codinome nem o @ vão para a imagem; o pé vai.
  const escritos = [];
  const falso = new Proxy({}, {
    get: (alvo, chave) => chave === "measureText" ? (s) => ({ width: String(s).length * 20 }) : chave === "fillText" ? (s) => escritos.push(String(s)) : chave in alvo ? alvo[chave] : () => undefined,
    set: (alvo, chave, valor) => ((alvo[chave] = valor), true),
  });
  const conteudo = { titulo: null, texto: "Texto aberto.", aviso: "", codinome: "", handle: null, comunidade: null, carimbo: null, qr: null, marca: "Alumia", chamada: "Leia", rotuloAviso: "Aviso", rodape: regras.rodapeDaImagem("https://alumia.exemplo.org") };
  desenharArte(falso, "story", PALETA_NOITE, conteudo, "sans-serif", null);
  ok(`sem autora, a arte não escreve codinome nem @, e escreve o pé (${escritos.join(" | ").slice(0, 160)})`, !escritos.some((s) => s.includes("Pessoa") || s.startsWith("@pessoa")) && escritos.some((s) => s.includes("@institutoluciaorg")));
}
{
  const levar = ler("components/rede/alcance/LevarParaFora.tsx");
  ok("Levar para fora: com o grupo ligado, a arte só sai de post aberto (postPodeVirarImagem)", levar.includes("postPodeVirarImagem(post)") && levar.includes("cartaoP4Ligado()"));
  ok("Levar para fora: a opção de esconder a autora e os destinos", levar.includes("semAutora") && levar.includes("DESTINOS_DA_IMAGEM"));
  ok("Levar para fora: partilhar usa só o compartilhar do próprio aparelho", levar.includes("navigator.share") && !/fetch\(\s*["'`]https?:/.test(levar));
}

// Item 32 (já existia): ler em voz alta com a voz do próprio aparelho. Prova: só voz local (a que o navegador marca como do
// aparelho), nenhuma voz da rede, e nada do texto vai a lugar nenhum (sem fetch, sem áudio de fora, sem endereço).
{
  const vozes = [
    { name: "Nuvem", lang: "pt-BR", localService: false, default: true },
    { name: "Aparelho", lang: "pt-BR", localService: true, default: false },
  ];
  ok("ler em voz alta: só a voz do aparelho, nunca a da rede", voz.escolherVoz(vozes, "pt")?.name === "Aparelho" && voz.escolherVoz([vozes[0]], "pt") === null);
  const botao = ler("components/rede/midia/BotaoOuvir.tsx").replace(/\/\/.*$/gm, "");
  const lib = ler("lib/rede/midia/voz.ts").replace(/\/\/.*$/gm, "");
  ok("ler em voz alta: usa speechSynthesis do aparelho", /speechSynthesis/.test(botao) && /SpeechSynthesisUtterance/.test(botao));
  ok("ler em voz alta: nenhum pedido à rede nem áudio de fora", ![botao, lib].some((s) => /\bfetch\(|new Audio\(|XMLHttpRequest|sendBeacon|WebSocket|["'`]https?:\/\//.test(s)));
}
// Item 135 (já existia): recolher um ramo da conversa com um toque. Prova: o botão "Recolher" diz o estado (aria-expanded) e qual
// ramo controla, o ramo recolhido fica inerte, e o recolhido mora só na memória da tela (nada no aparelho, nada no servidor).
{
  const conv = ler("components/rede/conversa/TelaDaConversaAlumia.tsx");
  ok("recolher: o botão diz o estado e o ramo que controla", /className="al3-recolher" aria-expanded=\{!recolhida\} aria-controls=\{idDosFilhos\} onClick=\{\(\) => c\.recolher\(p\.id\)\}/.test(conv));
  ok("recolher: o ramo recolhido fica inerte e marcado", /data-recolhido=\{recolhida \? "sim" : "nao"\} id=\{idDosFilhos\} inert=\{recolhida\}/.test(conv));
  const trecho = conv.slice(conv.indexOf("recolher: (pid) =>"), conv.indexOf("recolher: (pid) =>") + 260);
  ok("recolher: só na memória da tela (sem localStorage nem chamada ao banco)", /setRecolhidas\(/.test(trecho) && !/localStorage|sessionStorage|rede\.|conversa\.|fetch\(/.test(trecho));
  const textos = JSON.parse(ler("i18n/rede/conversa/alumia/pt.json"));
  ok("recolher: os rótulos com o número de respostas (posts, não pessoas)", textos.conversa.recolherRamo.includes("{n}") && textos.conversa.mostrarRamo.includes("{n}"));
}

// ═══ 7. Interruptor, painel, telas e textos ═══
ok("o interruptor está em RECURSOS e em SO_PELO_NOME", "alumia-p4-cartao-do-post" in RECURSOS && SO_PELO_NOME.includes("alumia-p4-cartao-do-post"));
ok("o painel único descreve o interruptor", typeof NOMES_DAS_FUNCOES["alumia-p4-cartao-do-post"]?.sobre === "string");
ok("desligado por padrão (nem 'todos' liga)", !cartaoP4Ligado(new Set(["todos"])) && cartaoP4Ligado(new Set(["alumia-p4-cartao-do-post"])));
{
  const encaixes = ler("components/rede/encaixes.tsx");
  ok("o encaixe do grupo está na lista das frentes", encaixes.includes('import { encaixe as p4cartao } from "./p4/cartao/encaixe";') && /rotulos,\n\s+compositorP4, p4cartao, criacaoColetiva,/.test(encaixes));
  const enc = ler("components/rede/p4/cartao/encaixe.tsx");
  ok("o encaixe fica vazio com o grupo desligado", /!LIGADO \? \{\}/.test(enc));
  const salvos = ler("components/rede/alumia/Salvos.tsx");
  ok("Salvos mostra o 'tornar pública' só na pasta privada", salvos.includes("<PastaPublica") && salvos.includes("!pastaAberta.nucleo"));
  const conv = ler("components/rede/conversa/TelaDaConversaAlumia.tsx");
  ok("a conversa usa a paleta da comunidade", conv.includes("usePaletaDaComunidade(post.comunidade)") && conv.includes("reacoesParaMostrar(reacoes, paletaDaCom)"));
}
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
{
  const chaves = (v, p = "", s = new Set()) => {
    if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) { if (k !== "_rascunho") chaves(f, p ? `${p}.${k}` : k, s); }
    else s.add(p);
    return s;
  };
  const pt = JSON.parse(ler("i18n/rede/cartao-do-post/pt.json"));
  const ref = [...chaves(pt)].sort().join();
  ok("pt não é rascunho", pt._rascunho === undefined);
  for (const l of IDIOMAS.slice(1)) {
    const t = JSON.parse(ler(`i18n/rede/cartao-do-post/${l}.json`));
    ok(`${l}: as mesmas chaves do português e a marca _rascunho`, t._rascunho === true && [...chaves(t)].sort().join() === ref);
  }
  const tudo = IDIOMAS.map((l) => ler(`i18n/rede/cartao-do-post/${l}.json`)).join("");
  ok("os textos não prometem o que o código não garante (sem 'anônimo', 'ninguém nunca', 'seguro')", !/an[oô]nim|ningu[eé]m nunca|100%|totalmente seguro/i.test(ler("i18n/rede/cartao-do-post/pt.json")) && !IP.test(tudo));
}
{
  const pacote = JSON.parse(ler("package.json"));
  ok("o teste está no package.json", /testar-p4-cartao-do-post\.mjs/.test(pacote.scripts["testar:p4-cartao-do-post"] ?? ""));
  ok("o e2e do grupo existe", fs.existsSync(path.join(raiz, "e2e/p4-cartao-do-post.spec.ts")));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
