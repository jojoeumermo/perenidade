// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, lote "publicar" (supabase/migracoes/20261126-p5-publicar.sql), num Postgres de verdade (scripts/banco-local.mjs):
//   · o install.sql do ramo sobe do zero; a migração roda duas vezes por cima dele; a porta não acha nada aberto;
//   · a chave do envio: o mesmo envio (mesma chave no cabeçalho "x-alumia-envio") vira UM post, uma resposta, uma enquete, um aviso,
//     um fio, um ato, um story, um agendamento; a segunda chamada é recusada com "envio_repetido" e o limite não é gasto; sem chave,
//     tudo como antes; rede_envio_achar devolve o que a chave publicou só para a autora;
//   · o cliente tira a chave do pedido e põe no cabeçalho (lib/backend.ts: semChaveDeEnvio);
//   · apagar o próprio post (rede_pub_apagar): sai de vez, ou fica "[post apagado]" quando há resposta; o ato sai da lista; ninguém
//     apaga post de outra pessoa;
//   · moderar: "remover" no próprio post apaga, sem aviso de moderação; remover o post de outra pessoa avisa UMA vez, mesmo com
//     quatro cliques; o mesmo "avisar" em 2 minutos não repete;
//   · "Posts de hoje" não conta as cópias de um envio repetido (e nada é apagado para isso);
//   · story sem @nome devolve "sem_handle" (a tela diz o que fazer).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p5-publicar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { semChaveDeEnvio } from "../lib/backend-envio.ts";
import { codigoDoErro as erroDoStory } from "../components/rede/stories/usar.ts";
import { ehPedacoPerdido, INTERVALO_DO_PEDACO_MS, podeRecarregarPorPedaco } from "../lib/pedaco-perdido.ts";

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

// ═══════════════════ 0. O arquivo e o cliente ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261126-p5-publicar.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não guarda nem lê endereço de rede", !/\binet\b|x-forwarded|cf-connecting|remote_addr/i.test(semComentario));
ok("a migração não mexe na versão da Alumia nem na lista de exceções da porta", !/function public.rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
{
  const redefinidas = [...semComentario.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\(/g)].map((m) => m[1]);
  ok(`as funções da migração (${redefinidas.join(", ")})`,
    redefinidas.join() === "interno.rede_envio_chave,interno.rede_envio_confere,public.rede_envio_achar,interno.rede_pub_apagar_post,public.rede_pub_apagar,public.rede_mod_agir,interno.alumia_posts_de_hoje,public.alumia_painel_geral");
}
{
  const a = semChaveDeEnvio({ p: { texto: "oi", chave_envio: "11111111-2222-4333-8444-555555555555" } });
  ok("o cliente tira a chave do pedido e devolve para o cabeçalho", a.chave === "11111111-2222-4333-8444-555555555555" && !("chave_envio" in a.argumentos.p) && a.argumentos.p.texto === "oi");
  const b = semChaveDeEnvio({ p_id: "x" });
  ok("sem chave, os argumentos passam iguais", b.chave === null && b.argumentos.p_id === "x");
  const c = semChaveDeEnvio({ p: { chave_envio: "não é uuid" } });
  ok("chave que não é uuid não vai ao cabeçalho (e sai do pedido)", c.chave === null && !("chave_envio" in c.argumentos.p));
}
{
  // O story de quem não tem @nome: a tela diz onde escolher (antes caía no "Não deu para publicar. Tente de novo").
  const pt = JSON.parse(ler("i18n/rede/stories/pt.json"));
  ok("story: sem_handle vira o texto de escolher o @nome", erroDoStory(new Error("sem_handle")) === "semHandle" && /@nome/.test(pt.criar.erro.semHandle));
  ok("story: o mesmo envio de novo conta como publicado", erroDoStory(new Error("envio_repetido")) === "envioRepetido");
  const criar = ler("components/rede/stories/Criar.tsx");
  ok("story: o pedido leva a chave do envio", criar.includes("chave_envio: chaveDoEnvio.current"));
  // O Escrever: o relógio do "Enviando em N s" dispara uma vez por envio, e o ato, o fio e o post levam a chave.
  const esc = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
  ok("Escrever: o relógio confere a marca antes de enviar", /if \(disparado\.current === envio\.chave\) return;\s*disparado\.current = envio\.chave;/.test(esc));
  ok("Escrever: um envio correndo não começa outro (duplo clique, Enter repetido)", esc.includes("if (envio || ocupado) return;"));
  ok("Escrever: o ato leva a chave", /atos\.publicar\([^)]*chave_envio: chave/.test(esc));
  ok("Escrever: o post leva a chave", esc.includes("pedido = { ...pedido, chave_envio: chave };"));
  // Apagar o próprio post pelo menu do cartão (antes só pela moderação), com a confirmação da Alumia, nunca o confirm() do navegador.
  const cartao = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
  const apagar = ler("components/rede/publicar/alumia2/ApagarNoMenu.tsx");
  ok("cartão: \"Apagar post\" no menu, só no post da própria pessoa", /\{post\.meu && \(\s*<ApagarNoMenu/.test(cartao));
  ok("cartão: o apagar chama rede_pub_apagar e não usa confirm()", apagar.includes("redePub.apagar(postId)") && !/\bconfirm\(/.test(apagar.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));
  const ptCartao = JSON.parse(ler("i18n/rede/publicar/alumia2/pt.json")).cartao;
  ok("cartão: os textos do apagar existem", ["apagar", "apagarPergunta", "apagarSim", "apagarNao", "apagado"].every((k) => typeof ptCartao[k] === "string" && ptCartao[k].length > 0));
  // Moderar: depois do "Confirmar", o formulário sai e fica o resultado (antes voltava ao "Aplicar" e cada toque avisava de novo).
  const painel = ler("components/rede/moderacao/PainelDoPost.tsx");
  ok("moderar: depois de agir, o formulário some e um novo toque não manda de novo", painel.includes("if (ocupado || agiu) return;") && /\{agiu \? \(/.test(painel));
  ok("moderar: o próprio post e a ação repetida têm frase própria", painel.includes("sm.moderar.feitoProprio") && painel.includes("sm.moderar.feitoRepetido"));
  // Pedaço não encontrado (ChunkLoadError) depois de uma versão nova: recarrega UMA vez, com guarda na aba.
  ok("pedaço: reconhece o ChunkLoadError e o import dinâmico que falhou", ehPedacoPerdido({ name: "ChunkLoadError", message: "x" }) &&
    ehPedacoPerdido(new Error("Loading chunk 4521 failed.")) && ehPedacoPerdido(new TypeError("Failed to fetch dynamically imported module: https://x/_next/a.js")) &&
    ehPedacoPerdido("Loading CSS chunk app-casca failed"));
  ok("pedaço: outros erros não recarregam", !ehPedacoPerdido(new Error("sem_permissao")) && !ehPedacoPerdido(null) && !ehPedacoPerdido({}));
  {
    const mapa = new Map();
    const guarda = { getItem: (k) => (mapa.has(k) ? mapa.get(k) : null), setItem: (k, v) => mapa.set(k, v) };
    ok("pedaço: a primeira vez recarrega", podeRecarregarPorPedaco(1_000_000, guarda) === true);
    ok("pedaço: logo depois, não (sem laço)", podeRecarregarPorPedaco(1_000_000 + 30_000, guarda) === false);
    ok("pedaço: passado o intervalo, pode de novo", podeRecarregarPorPedaco(1_000_000 + INTERVALO_DO_PEDACO_MS + 1, guarda) === true);
    ok("pedaço: sem armazenamento, não recarrega (sem guarda, viraria laço)", podeRecarregarPorPedaco(1, null) === false);
  }
  ok("pedaço: o ouvinte está no layout de todas as páginas", ler("app/[lang]/layout.tsx").includes("<RecarregarPorPedaco />"));
  ok("pedaço: as telas de erro da Alumia e do painel recarregam uma vez", ler("app/[lang]/alumia/error.tsx").includes("recarregarSePedacoPerdido(error)") && ler("app/[lang]/painel/error.tsx").includes("recarregarSePedacoPerdido(error)"));
  // Conversa: a foto e o nome abrem o perfil.
  ok("conversa: o nome leva ao perfil", /enderecos\.perfil\(lang, conversa\.com\.handle\)/.test(ler("components/rede/chat/Conversa.tsx")));
}

// ═══════════════════ 1. O banco do zero e a migração duas vezes ═══════════════════
const install = normal(ler("supabase/install.sql"));
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
await espera("a migração roda por cima do install.sql", () => exec(SQL));
await espera("e de novo (idempotente)", () => exec(SQL));
ok("a migração está no fim do install.sql", install.includes(SQL) && noFimDoInstall(SQL, install));
{
  const r = (await um("select interno.alumia_trancar() as r")).r;
  ok(`trancar não acha nada aberto (abertas: ${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const portas = await dono(`select p.proname, p.prosrc ~ 'interno\\.alumia_porta\\(\\)' as porta from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rede_envio_achar', 'rede_pub_apagar', 'rede_mod_agir', 'alumia_painel_geral')`);
  ok("as funções públicas novas e redefinidas passam pela porta", portas.rows.length === 4 && portas.rows.every((x) => x.porta));
  const t = await um("select relrowsecurity from pg_class where oid = 'interno.rede_envios'::regclass");
  ok("a tabela das chaves tem RLS ligada", t.relrowsecurity === true);
  const g = await um("select has_table_privilege('authenticated', 'interno.rede_envios', 'select') as s, has_table_privilege('anon', 'interno.rede_envios', 'select') as a");
  ok("ninguém da API lê a tabela das chaves", !g.s && !g.a);
}

try {
  // ═══════════════════ 2. Pessoas ═══════════════════
  let ip = 10;
  const como = (sub, chave) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}`, ...(chave ? { cabecalhos: { "x-alumia-envio": chave } } : {}) });
  const P = {};
  const nomes = ["ana", "bia", "mod"];
  for (const [i, nome] of nomes.entries()) {
    P[nome] = await criarUsuario(`${nome}@p5.local`, nome);
    await rpc(como(P[nome]), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.mod]);
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const n of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[n]]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  const zerar = () => dono("delete from interno.limites");
  const conta = async (sql, v = []) => Number((await um(sql, v)).n);
  const postsDe = (quem) => conta("select count(*) n from interno.rede_posts where autor = $1", [P[quem]]);

  // ═══════════════════ 3. A chave do envio ═══════════════════
  /** Manda o mesmo pedido duas vezes com a mesma chave: a primeira publica, a segunda é recusada; conta o que nasceu. */
  async function duasVezes(nome, quem, funcao, argumentos, tabela = "interno.rede_posts") {
    await zerar();
    const chave = randomUUID();
    const antes = await conta(`select count(*) n from ${tabela} where autor = $1`, [P[quem]]);
    const r = await espera(`${nome}: a primeira chamada publica`, () => rpc(como(P[quem], chave), funcao, argumentos), (x) => x !== null);
    await recusa(`${nome}: a mesma chave de novo é recusada`, () => rpc(como(P[quem], chave), funcao, argumentos), "envio_repetido");
    await recusa(`${nome}: e de novo (o terceiro clique)`, () => rpc(como(P[quem], chave), funcao, argumentos), "envio_repetido");
    const depois = await conta(`select count(*) n from ${tabela} where autor = $1`, [P[quem]]);
    return { r, chave, nasceram: depois - antes };
  }
  {
    const { r, chave, nasceram } = await duasVezes("post", "ana", "rede_publicar", { p: { texto: "Um post só, por favor." } });
    ok(`post: um envio, um post (nasceram ${nasceram})`, nasceram === 1);
    await espera("rede_envio_achar devolve o post à autora", () => rpc(como(P.ana), "rede_envio_achar", { p_chave: chave }), (x) => x?.id === r?.id);
    await espera("rede_envio_achar não devolve nada a outra pessoa", () => rpc(como(P.bia), "rede_envio_achar", { p_chave: chave }), (x) => x === null);
    await espera("a mesma chave vinda de OUTRA pessoa é outro envio (a chave é por autora)", async () => {
      await zerar();
      return rpc(como(P.bia, chave), "rede_publicar", { p: { texto: "Outra pessoa, mesma chave por acaso." } });
    }, (x) => Boolean(x?.id));
    const limite = await um("select coalesce(sum(1), 0)::int n from interno.limites where acao = 'rede2_postar'").catch(() => ({ n: -1 }));
    ok(`a chamada recusada não gasta o limite de posts (${limite.n})`, limite.n <= 1);
    const id = r?.id;
    const nova = await espera("resposta: um envio, uma resposta", async () => {
      const x = await duasVezes("resposta", "bia", "rede_publicar", { p: { texto: "Respondendo uma vez.", resposta_a: id } });
      return x.nasceram;
    }, (n) => n === 1);
    void nova;
  }
  {
    const { nasceram } = await duasVezes("enquete", "ana", "rede_pub_publicar_mais", { p: { tipo: "enquete", texto: "Corto o cabelo?", enquete: { opcoes: ["sim", "não"], horas: 24 } } });
    ok(`enquete: um envio, uma enquete (nasceram ${nasceram})`, nasceram === 1);
  }
  {
    const { nasceram } = await duasVezes("aviso", "mod", "rede_pub_publicar_mais", { p: { tipo: "aviso", texto: "Aviso da equipe para todo mundo.", publico: "membros" } });
    ok(`aviso: a equipe cria o aviso, um só (nasceram ${nasceram})`, nasceram === 1);
  }
  {
    const { nasceram } = await duasVezes("vida do post", "ana", "rede_pub_vida_publicar", { p: { texto: "Some em um dia.", publico: "membros", some_em: "24h" } });
    ok(`vida do post: um envio, um post (nasceram ${nasceram})`, nasceram === 1);
  }
  if ((await um("select to_regprocedure('public.rede_pub_o12_fio(jsonb)') is not null as t")).t) {
    const { nasceram } = await duasVezes("fio", "ana", "rede_pub_o12_fio", { p: { publico: "membros", blocos: [{ texto: "Bloco um do fio." }, { texto: "Bloco dois do fio." }, { texto: "Bloco três." }] } });
    ok(`fio: os três blocos nascem juntos com a mesma chave, e o reenvio não repete (nasceram ${nasceram})`, nasceram === 3);
  }
  {
    const quando = new Date(Date.now() + 3 * 86400000).toISOString();
    const { nasceram } = await duasVezes("ato", "ana", "rede_ato_publicar", { p: { titulo: "Greve geral já", inicio: quando, onde: "Praça da Sé", cidade: "São Paulo", descricao: "Todo mundo na praça." } });
    ok(`ato: um envio, um ato (nasceram ${nasceram})`, nasceram === 1);
    ok("ato: um chamado só na lista", (await conta("select count(*) n from interno.rede_chamados c join interno.rede_posts p on p.id = c.post where p.autor = $1", [P.ana])) === 1);
  }
  {
    const { nasceram } = await duasVezes("story", "ana", "rede_story_publicar",
      { p: { publico: "membros", fundo: { tipo: "listras", cor: "azul" }, texto: "teste", estilo: { fonte: "maquina" }, figurinhas: [{ tipo: "decorativa", nome: "lampiao", pos: { x: 0.1, y: 0.85, giro: 8, escala: 1 } }] } },
      "interno.rede_stories");
    ok(`story com enfeite e "Comunidade" (membros): um envio, um story (nasceram ${nasceram})`, nasceram === 1);
  }
  {
    const quando = new Date(Date.now() + 86400000).toISOString();
    const { nasceram } = await duasVezes("agendado", "ana", "rede_pub_agendar", { p: { texto: "Para amanhã." }, p_quando: quando }, "interno.rede_agendados");
    ok(`agendamento: um envio, um agendado (nasceram ${nasceram})`, nasceram === 1);
  }
  await espera("sem chave, publicar duas vezes o mesmo texto continua publicando duas vezes (nada muda para quem não manda a chave)", async () => {
    await zerar();
    const antes = await postsDe("bia");
    await rpc(como(P.bia), "rede_publicar", { p: { texto: "Sem chave." } });
    await rpc(como(P.bia), "rede_publicar", { p: { texto: "Sem chave." } });
    return (await postsDe("bia")) - antes;
  }, (n) => n === 2);
  await espera("um envio recusado (erro de validação) não queima a chave: corrigido, a mesma chave publica", async () => {
    await zerar();
    const chave = randomUUID();
    try {
      await rpc(como(P.ana, chave), "rede_publicar", { p: { texto: "" } });
    } catch {
      /* esperado */
    }
    return rpc(como(P.ana, chave), "rede_publicar", { p: { texto: "Agora com texto." } });
  }, (x) => Boolean(x?.id));

  // Story de quem não escolheu o @nome: o banco diz "sem_handle" (a tela explica, em vez de "Não deu para publicar").
  await dono("update interno.perfis set rede_handle = null where id = $1", [P.bia]);
  await recusa("story sem @nome: sem_handle", () => rpc(como(P.bia), "rede_story_publicar", { p: { publico: "membros", fundo: { tipo: "listras", cor: "azul" }, texto: "oi", figurinhas: [] } }), "sem_handle");
  await dono("update interno.perfis set rede_handle = 'pessoa_bia' where id = $1", [P.bia]);
  for (const publico of ["seguidores", "membros", "proximos"]) {
    for (const nome of ["punho", "lampiao", "megafone", "faixa", "carimbo-luta", "carimbo-presente", "estrela", "flor"]) {
      await zerar();
      await espera(`story "${publico}" com o enfeite ${nome}`, () => rpc(como(P.bia), "rede_story_publicar",
        { p: { publico, fundo: { tipo: "listras", cor: "verde" }, texto: "", figurinhas: [{ tipo: "decorativa", nome, pos: { x: 0.5, y: 0.5, giro: 0, escala: 1 } }] } }), (x) => Boolean(x?.id));
    }
  }

  // Ato de outra pessoa (público "Alumia"): aparece na busca e na lista "Perto"; o post aberto traz o @ e o perfil da autora.
  {
    await zerar();
    const atoDaAna = await rpc(como(P.ana), "rede_ato_publicar", { p: { titulo: "Panfletagem no terminal", inicio: new Date(Date.now() + 4 * 86400000).toISOString(), onde: "Terminal central", cidade: "Belém", descricao: "Panfletar na saída do turno.", publico: "membros" } });
    for (const f of ["rede_alumia_buscar", "rede_desc_buscar"]) {
      await espera(`o ato de outra pessoa aparece na busca (${f})`, () => rpc(como(P.bia), f, { p_q: "panfletagem", p_ordem: "relevancia", p_cursor: null, p_limite: 20 }),
        (r) => (r?.itens ?? []).some((x) => x.id === atoDaAna.id));
    }
    await espera("e na lista \"Perto\" da cidade escrita", () => rpc(como(P.bia), "rede_atos", { p_filtro: "perto", p_cidade: "Belém", p_comunidade: null, p_cursor: null, p_limite: 20 }),
      (r) => (r?.itens ?? []).some((x) => x.id === atoDaAna.id));
    await espera("o post aberto traz o @ e o perfil da autora (o nome vira link)", () => rpc(como(P.bia), "rede_post", { p_id: atoDaAna.id }),
      (r) => r?.post?.autor?.handle === "pessoa_ana" && r?.post?.autor?.perfil === true);
  }

  // As funções básicas, uma por uma, entre duas pessoas (A13: "postar, comentar, responder, acender, repostar, citar, salvar,
  // seguir, buscar, apagar e editar"): cada uma responde certo e nada nasce em dobro.
  {
    await zerar();
    // Post novo nasce com "ninguém cita" (B1); aqui a autora deixa todos citarem, como no "Quem pode citar" do Escrever.
    const base = await rpc(como(P.ana), "rede_pub_publicar_mais", { p: { texto: "Plenária do bairro no sábado, às 15h.", publico: "membros", citar_quem: "todos" } });
    const n = (sql, v) => conta(sql, v);
    const resp = await espera("básico: comentar (resposta da bia)", () => rpc(como(P.bia), "rede_publicar", { p: { texto: "Vou levar a faixa.", resposta_a: base.id } }), (x) => x?.resposta_a === base.id || Boolean(x?.id));
    await zerar();
    await espera("básico: responder à resposta", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Boa, obrigada!", resposta_a: resp.id } }), (x) => Boolean(x?.id));
    await espera("básico: acender", () => rpc(como(P.bia), "rede_reagir", { p_post: base.id, p_tipo: "apoio", p_sim: true }), (x) => x?.apoiei === true);
    await espera("básico: acender de novo não conta duas vezes", () => rpc(como(P.bia), "rede_reagir", { p_post: base.id, p_tipo: "apoio", p_sim: true }), (x) => x?.apoiei === true);
    ok("básico: um acender só da bia", (await n("select count(*) n from interno.rede_reacoes where post = $1 and tipo = 'apoio'", [base.id])) === 1);
    await espera("básico: apagar o acender", () => rpc(como(P.bia), "rede_reagir", { p_post: base.id, p_tipo: "apoio", p_sim: false }), (x) => x?.apoiei === false);
    await espera("básico: salvar", () => rpc(como(P.bia), "rede_salvar", { p_post: base.id, p_sim: true }), (x) => x?.salvei === true);
    await espera("básico: tirar dos salvos", () => rpc(como(P.bia), "rede_salvar", { p_post: base.id, p_sim: false }), (x) => x?.salvei === false);
    await espera("básico: repostar", () => rpc(como(P.bia), "rede_pub_repostar", { p_post: base.id, p_sim: true }), (x) => x?.repostei === true);
    await espera("básico: repostar de novo não duplica", () => rpc(como(P.bia), "rede_pub_repostar", { p_post: base.id, p_sim: true }), (x) => x?.repostei === true);
    await espera("básico: desfazer o repost", () => rpc(como(P.bia), "rede_pub_repostar", { p_post: base.id, p_sim: false }), (x) => x?.repostei === false);
    await zerar();
    await espera("básico: citar", () => rpc(como(P.bia), "rede_conv_citar", { p: { texto: "Todo mundo lá!", citar: base.id } }), (x) => Boolean(x?.id));
    await espera("básico: seguir", () => rpc(como(P.bia), "rede_perfil_seguir", { p_handle: "pessoa_ana", p_sim: true }), (x) => x?.sigo === true || x?.pendente === true);
    await espera("básico: deixar de seguir", () => rpc(como(P.bia), "rede_perfil_seguir", { p_handle: "pessoa_ana", p_sim: false }), (x) => x?.sigo === false);
    await espera("básico: buscar acha o post", () => rpc(como(P.bia), "rede_alumia_buscar", { p_q: "plenária", p_ordem: "relevancia", p_cursor: null, p_limite: 20 }),
      (r) => (r?.itens ?? []).some((x) => x.id === base.id));
    await zerar();
    await espera("básico: editar o próprio post", () => rpc(como(P.ana), "rede_pub_editar", { p_post: base.id, p: { texto: "Plenária do bairro no sábado, às 16h." } }), (x) => /16h/.test(x?.texto ?? ""));
    await recusa("básico: ninguém edita o post de outra pessoa", () => rpc(como(P.bia), "rede_pub_editar", { p_post: base.id, p: { texto: "Mudei." } }), "");
    ok("básico: o post continua um só", (await n("select count(*) n from interno.rede_posts where texto like 'Plenária do bairro%'")) === 1);
  }

  // ═══════════════════ 4. Apagar o próprio post ═══════════════════
  await zerar();
  const solto = await rpc(como(P.ana), "rede_publicar", { p: { texto: "Vou apagar este." } });
  await recusa("ninguém apaga o post de outra pessoa", () => rpc(como(P.bia), "rede_pub_apagar", { p_post: solto.id }), "nao_encontrado");
  await espera("a autora apaga o próprio post", () => rpc(como(P.ana), "rede_pub_apagar", { p_post: solto.id }), (x) => x?.apagado === true);
  ok("o post sem resposta sai de vez", (await conta("select count(*) n from interno.rede_posts where id = $1", [solto.id])) === 0);
  await recusa("apagar de novo: não encontrado", () => rpc(como(P.ana), "rede_pub_apagar", { p_post: solto.id }), "nao_encontrado");
  const comResposta = await rpc(como(P.ana), "rede_publicar", { p: { texto: "Este tem resposta." } });
  await zerar();
  await rpc(como(P.bia), "rede_publicar", { p: { texto: "Respondi.", resposta_a: comResposta.id } });
  await espera("a autora apaga o post respondido", () => rpc(como(P.ana), "rede_pub_apagar", { p_post: comResposta.id }), (x) => x?.apagado === true);
  await espera("o respondido fica como \"[post apagado]\", sem autora", () => um("select autor, texto, apagado_em from interno.rede_posts where id = $1", [comResposta.id]),
    (x) => x.autor === null && x.texto === "[post apagado]" && x.apagado_em !== null);
  {
    await zerar();
    const ato = await rpc(como(P.ana), "rede_ato_publicar", { p: { titulo: "Ocupar e resistir", inicio: new Date(Date.now() + 5 * 86400000).toISOString(), onde: "Praça central", cidade: "Recife", descricao: "Vamos ocupar." } });
    await espera("a autora apaga o próprio ato", () => rpc(como(P.ana), "rede_pub_apagar", { p_post: ato.id }), (x) => x?.apagado === true);
    ok("o chamado do ato sai junto", (await conta("select count(*) n from interno.rede_chamados where post = $1", [ato.id])) === 0);
  }

  // ═══════════════════ 5. Moderar ═══════════════════
  const avisosDe = (quem) => conta("select count(*) n from interno.avisos where para = $1 and texto like 'Um post seu foi retirado%'", [P[quem]]);
  await zerar();
  const doMod = await rpc(como(P.mod), "rede_publicar", { p: { texto: "Post do moderador." } });
  await espera("a moderação no próprio post: \"remover\" apaga", () => rpc(como(P.mod), "rede_mod_agir",
    { p_denuncia: null, p_alvo_tipo: "post", p_alvo: doMod.id, p_acao: "remover", p_regra: "norma 1", p_motivo: "testando" }), (x) => x?.apagado === true);
  ok("e não avisa \"uma pessoa da moderação\"", (await avisosDe("mod")) === 0);
  ok("nem grava registro de moderação", (await conta("select count(*) n from interno.rede_moderacao where alvo = $1", [doMod.id])) === 0);
  ok("o post saiu", (await conta("select count(*) n from interno.rede_posts where id = $1", [doMod.id])) === 0);
  await zerar();
  const daAna = await rpc(como(P.ana), "rede_publicar", { p: { texto: "Post que a moderação vai tirar." } });
  for (let i = 1; i <= 4; i++) {
    await espera(`a moderação tira o post de outra pessoa (clique ${i})`, () => rpc(como(P.mod), "rede_mod_agir",
      { p_denuncia: null, p_alvo_tipo: "post", p_alvo: daAna.id, p_acao: "remover", p_regra: "norma 1", p_motivo: "kk testando" }), (x) => x?.acao);
  }
  ok(`quatro cliques, um aviso só (${await avisosDe("ana")})`, (await avisosDe("ana")) === 1);
  ok("e um registro só de moderação", (await conta("select count(*) n from interno.rede_moderacao where alvo = $1 and acao = 'remover'", [daAna.id])) === 1);
  await espera("restaurar depois volta a valer (não é repetição)", () => rpc(como(P.mod), "rede_mod_agir",
    { p_denuncia: null, p_alvo_tipo: "post", p_alvo: daAna.id, p_acao: "restaurar", p_regra: "norma 1", p_motivo: "voltou" }), (x) => x?.acao && !x.repetida);
  await espera("e remover de novo, depois de restaurado, avisa de novo", async () => {
    await rpc(como(P.mod), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: daAna.id, p_acao: "remover", p_regra: "norma 1", p_motivo: "de novo" });
    return avisosDe("ana");
  }, (n) => n === 2);
  {
    const avisos = () => conta("select count(*) n from interno.avisos where para = $1 and texto like 'A moderação da Rede deixou um aviso%'", [P.bia]);
    await zerar();
    const daBia = await rpc(como(P.bia), "rede_publicar", { p: { texto: "Post para receber um aviso." } });
    for (let i = 0; i < 3; i++) {
      await rpc(como(P.mod), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: daBia.id, p_acao: "avisar", p_regra: "norma 2", p_motivo: "cuidado com isso" });
    }
    ok(`o mesmo "avisar" três vezes seguidas: um aviso (${await avisos()})`, (await avisos()) === 1);
  }

  // ═══════════════════ 6. Posts de hoje ═══════════════════
  {
    const dia = "date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'";
    const antes = await conta(`select interno.alumia_posts_de_hoje(${dia}) n`);
    // Cinco cópias do mesmo post (como o envio repetido fazia), gravadas direto, e um post diferente.
    for (let i = 0; i < 5; i++) {
      await dono("insert into interno.rede_posts (autor, texto, publico, alcance, criado_em) values ($1, 'fala tropa', 'membros', 'publico', now() - make_interval(secs => $2))", [P.bia, i]);
    }
    await dono("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'outro post', 'membros', 'publico')", [P.bia]);
    const depois = await conta(`select interno.alumia_posts_de_hoje(${dia}) n`);
    ok(`"Posts de hoje": cinco cópias contam como um (+${depois - antes}, esperado +2)`, depois - antes === 2);
    ok("e nenhuma cópia foi apagada", (await conta("select count(*) n from interno.rede_posts where autor = $1 and texto = 'fala tropa'", [P.bia])) === 5);
  }
} catch (e) {
  falhas.push(`o teste parou: ${e.stack ?? e.message}`);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
