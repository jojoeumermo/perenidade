// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a B1 da comunidade da Alumia (supabase/migracoes/20261110-alumia-b1-comunidade.sql) num Postgres de verdade dentro do Node,
// com a matriz visitante / membro / bloqueado / suspensa: o total das reações sem bloqueio nem suspensa; a página da comunidade na
// ordem certa (sem gastar limite antes de conferir); os avisos dos tipos novos; notas de contexto; wiki com histórico; busca com
// operadores e busca salva; a linha dos #temas seguidos; salvos em pastas; "Pergunte a…"; posts recorrentes; citação com âncora;
// lembrar mais tarde; conversas que sigo. Confere também as contas puras do navegador (a reserva só para função que não existe, os
// operadores da busca, o "leu antes?"), os textos nos 6 idiomas, que as tabelas novas não têm permissão direta e que a migração
// roda duas vezes. Uso: npm run testar:alumia-b1-comunidade
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { comReserva, faltaFuncaoNoBanco } from "../lib/rede/reserva.ts";

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
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ── 0. A reserva do navegador: só para "função não existe" ──
{
  const erro = (code) => Object.assign(new Error(code), { code });
  let chamadas = 0;
  const deHoje = async () => (chamadas++, "hoje");
  ok("reserva: banco_desatualizado cai na de hoje", (await comReserva(() => Promise.reject(erro("banco_desatualizado")), deHoje)) === "hoje" && chamadas === 1);
  for (const code of ["muitos_pedidos", "conta_suspensa", "sem_permissao", "nao_encontrado", "sem_conexao", "falha"]) {
    try {
      await comReserva(() => Promise.reject(erro(code)), deHoje);
      falhas.push(`reserva: ${code} não deveria virar segunda chamada`);
    } catch (e) {
      ok(`reserva: ${code} sobe sem segunda chamada`, e.code === code && chamadas === 1);
    }
  }
  ok("reserva: PGRST202 e 42883 também contam", faltaFuncaoNoBanco(erro("PGRST202")) && faltaFuncaoNoBanco(erro("42883")) && !faltaFuncaoNoBanco(erro("muitos_pedidos")));
  ok("reserva: a nova que dá certo não chama a de hoje", (await comReserva(async () => "nova", deHoje)) === "nova" && chamadas === 1);
}

// ── Banco ──
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const sql = fs.readFileSync(new URL("../supabase/migracoes/20261110-alumia-b1-comunidade.sql", import.meta.url), "utf8");
await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("instalar de novo não quebra (idempotente)", () => banco.exclusivo(() => banco.pg.exec(sql)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

const P = {};
const nomes = ["autora", "membro", "outra", "terceira", "quarta", "bloqueado", "suspensa", "fora", "moderadora", "nova"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@b1c.local`, `Nome Civil ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_b1c`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "fora")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono("update auth.users set created_at = now() where id = $1", [P.nova]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.autora, P.bloqueado]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet'),
  ('moradia', 'Moradia', 'lutas', 'aberta', 'membros'),
  ('segredo', 'Segredo', 'lutas', 'fechada', 'comunidade') on conflict do nothing`);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('matematica', $1, 'moderacao'), ('moradia', $1, 'moderacao'), ('segredo', $2, 'membro')", [P.moderadora, P.membro]);
for (const nome of ["autora", "membro", "outra", "terceira", "quarta"]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('moradia', $1, 'membro') on conflict do nothing", [P[nome]]);
}

const postar = async (campos, autor = P.autora, texto = "post do teste") => {
  const todos = { publico: "membros", ...campos };
  const colunas = Object.keys(todos);
  return (await um(`insert into interno.rede_posts (autor, texto, ${colunas.join(", ")}) values ($1, $2, ${colunas.map((_, i) => `$${i + 3}`).join(", ")}) returning id`, [autor, texto, ...Object.values(todos)])).id;
};
const semNomes = (v) => !/(@b1c\.local|Nome Civil|"usuario"|"quem"|"pessoas"|"autora"|"editou")/.test(JSON.stringify(v));
const limiteDe = async (acao, quem) => (await um("select coalesce(sum(total), 0)::int as n from interno.limites where chave = $1", [`${acao}:${quem}`])).n;

// ── 1. Reações: o total sem bloqueio nem suspensa ──
const doPost = await postar({ comunidade: "matematica", publico: "internet" }, P.membro, "Quanto fica com o app?");
const reagir = (quem, emoji, sim = true) => rpc(como(quem), "rede_alumia_reagir", { p_post: doPost, p_emoji: emoji, p_sim: sim });
const totalDe = (r, emoji = "✊") => {
  const x = r.reacoes.find((y) => y.emoji === emoji);
  return x ? x.total : "sem";
};
await reagir(P.outra, "✊");
await reagir(P.terceira, "✊");
await reagir(P.bloqueado, "✊");
await espera("reações: para quem não tem bloqueio, 3 contam", () => rpc(como(P.quarta), "rede_alumia_reacoes", { p_posts: [doPost] }), (r) => totalDe(r.itens[0]) === 3);
await espera("reações: para a autora, quem ela bloqueou não conta (3 vira 'poucas')", () => rpc(como(P.autora), "rede_alumia_reacoes", { p_posts: [doPost] }), (r) => totalDe(r.itens[0]) === null);
await espera("reações: reagir e tirar não deixa ver o bloqueado mexendo no número", async () => {
  const antes = totalDe(await rpc(como(P.autora), "rede_alumia_reagir", { p_post: doPost, p_emoji: "✊", p_sim: true }));
  const depois = totalDe(await rpc(como(P.autora), "rede_alumia_reagir", { p_post: doPost, p_emoji: "✊", p_sim: false }));
  return { antes, depois };
}, (r) => r.antes === 3 && r.depois === null);
await dono("update interno.perfis set suspenso = true where id = $1", [P.terceira]);
await espera("reações: conta suspensa sai do total", () => rpc(como(P.quarta), "rede_alumia_reacoes", { p_posts: [doPost] }), (r) => totalDe(r.itens[0]) === null);
await dono("update interno.perfis set suspenso = false where id = $1", [P.terceira]);
await espera("reações: a conversa usa a mesma conta", () => rpc(como(P.autora), "rede_alumia_conversa", { p_id: doPost }), (r) => r.post.reacoes.find((x) => x.emoji === "✊")?.total === null);
await espera("reações: a própria reação sempre conta para a pessoa (minha)", () => rpc(como(P.outra), "rede_alumia_reacoes", { p_posts: [doPost] }), (r) => r.itens[0].reacoes[0].minha === true);

// ── 2. A página da comunidade, na ordem certa ──
for (let i = 0; i < 4; i++) await postar({ comunidade: "matematica", publico: "internet" }, P.outra, `post ${i}`);
await espera("página: visitante vê a disciplina", () => rpc(visitante(), "rede_alumia_com_pagina", { p_slug: "matematica" }), (r) => r.comunidade.slug === "matematica" && r.posts_7d === 5);
await recusa("página: visitante, luta que existe → entre_primeiro", () => rpc(visitante(), "rede_alumia_com_pagina", { p_slug: "moradia" }), "entre_primeiro");
await recusa("página: visitante, slug que não existe → o mesmo entre_primeiro (sem sondar)", () => rpc(visitante(), "rede_alumia_com_pagina", { p_slug: "nao-existe" }), "entre_primeiro");
await recusa("página: fechada para quem é de fora → nao_encontrado", () => rpc(como(P.outra), "rede_alumia_com_pagina", { p_slug: "segredo" }), "nao_encontrado");
await recusa("página: slug que não existe → o mesmo nao_encontrado", () => rpc(como(P.outra), "rede_alumia_com_pagina", { p_slug: "nao-existe" }), "nao_encontrado");
await espera("página: recusa não gasta o limite de leitura", async () => {
  await dono("delete from interno.limites");
  for (const slug of ["segredo", "nao-existe"]) await rpc(como(P.outra), "rede_alumia_com_pagina", { p_slug: slug }).catch(() => {});
  return limiteDe("rede2_ler", P.outra);
}, (n) => n === 0);
await espera("página: um pedido gasta o limite UMA vez", async () => {
  await dono("delete from interno.limites");
  await rpc(como(P.outra), "rede_alumia_com_pagina", { p_slug: "matematica" });
  return limiteDe("rede2_ler", P.outra);
}, (n) => n === 1);
await espera("página: Rede fechada (área interditada) recusa antes de gastar o limite", async () => {
  await dono("delete from interno.limites");
  await dono(`insert into interno.configuracoes (chave, valor) values ('interdicao', '{"areas": {"comunidade": true}}') on conflict (chave) do update set valor = excluded.valor`);
  const r = await rpc(como(P.outra), "rede_alumia_com_pagina", { p_slug: "matematica" }).then(() => "passou", (e) => e.message);
  await dono("delete from interno.configuracoes where chave = 'interdicao'");
  return { r, n: await limiteDe("rede2_ler", P.outra) };
}, (x) => x.r.includes("area_interditada") && x.n === 0);
await dono("update interno.perfis set suspenso = true where id = $1", [P.quarta]);
await recusa("página: conta suspensa recusa", () => rpc(como(P.quarta), "rede_alumia_com_pagina", { p_slug: "matematica" }), "conta_suspensa");
await dono("update interno.perfis set suspenso = false where id = $1", [P.quarta]);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ('matematica', $1, 'membro', 'banido') on conflict (comunidade, usuario) do update set situacao = 'banido'", [P.quarta]);
await espera("página: quem foi banido vê a página, sem a contagem da semana", () => rpc(como(P.quarta), "rede_alumia_com_pagina", { p_slug: "matematica" }), (r) => r.posts_7d === null && r.comunidade.banido === true);
await dono("delete from interno.rede_comunidade_membros where comunidade = 'matematica' and usuario = $1", [P.quarta]);
await espera("página: quem é da fechada vê", () => rpc(como(P.membro), "rede_alumia_com_pagina", { p_slug: "segredo" }), (r) => r.comunidade.slug === "segredo");

// ── 3. Avisos dos tipos novos ──
const avisosDe = async (quem) => (await rpc(como(quem), "rede_aviso_listar", {})).itens;
await dono("delete from interno.avisos");
const raiz = await postar({ comunidade: "moradia", tipo: "discussao", titulo: "Assembleia da ocupação", corpo: "Como foi a assembleia?" }, P.autora, "Assembleia da ocupação");
await rpc(como(P.membro), "rede_alumia_seguir_conversa", { p_post: raiz, p_sim: true });
const resp1 = await postar({ comunidade: "moradia", resposta_a: raiz, root_id: raiz }, P.outra, "Foi boa");
await postar({ comunidade: "moradia", resposta_a: raiz, root_id: raiz }, P.terceira, "Foi ótima");
await espera("conversa seguida: chega como 'conversa_seguida', agrupada", () => avisosDe(P.membro), (r) => r.length === 1 && r[0].tipo === "conversa_seguida" && r[0].total === 2 && r[0].post === raiz);
await espera("conversa seguida: a autora recebe 'resposta' (não o tipo da seguida)", () => avisosDe(P.autora), (r) => r.every((x) => x.tipo === "resposta"));
await rpc(como(P.membro), "rede_aviso_prefs_salvar", { p_tipo: "conversa_seguida", p_canal: "site", p_ligado: false });
await postar({ comunidade: "moradia", resposta_a: raiz, root_id: raiz }, P.outra, "Mais uma");
await espera("conversa seguida: desligada no site, não chega (e as respostas a ela continuam ligadas)", async () => {
  const prefs = await rpc(como(P.membro), "rede_aviso_prefs_ver", {});
  return { n: (await avisosDe(P.membro))[0].total, prefs };
}, (r) => r.n === 2 && r.prefs.site.conversa_seguida === false && r.prefs.site.resposta === true && "ajudou" in r.prefs.push);
await rpc(como(P.membro), "rede_aviso_prefs_salvar", { p_tipo: "conversa_seguida", p_canal: "site", p_ligado: true });
await dono("update interno.rede_posts set retido = true where id = $1", [raiz]);
await postar({ comunidade: "moradia", resposta_a: raiz, root_id: raiz }, P.outra, "Na retida");
await espera("conversa seguida: raiz retida para de avisar", () => um("select count(*)::int as n from interno.avisos where para = $1", [P.membro]), (r) => r.n === 2);
await dono("update interno.rede_posts set retido = false where id = $1", [raiz]);
await recusa("preferência: tipo desconhecido é recusado", () => rpc(como(P.membro), "rede_aviso_prefs_salvar", { p_tipo: "qualquer", p_canal: "site", p_ligado: false }), "invalido:tipo");
await espera("ajudou: aviso do tipo 'ajudou', sem nome de quem marcou", async () => {
  await rpc(como(P.autora), "rede_alumia_ajudou", { p_resposta: resp1, p_sim: true });
  return (await avisosDe(P.outra)).find((x) => x.tipo === "ajudou");
}, (r) => r && r.post === raiz && r.alvo === resp1 && r.atores.length === 0);
await espera("ato: aviso 'chamado' de ato vira 'ato' (com o texto, sem trecho de post)", async () => {
  await dono("insert into interno.avisos (para, texto, categoria, tipo, post) values ($1, 'Um ato que você confirmou mudou de data.', 'rede', 'chamado', $2)", [P.membro, raiz]);
  return (await avisosDe(P.membro)).find((x) => x.tipo === "ato");
}, (r) => r && r.texto === "Um ato que você confirmou mudou de data.");
await espera("story: reação vira 'reacao_story'", async () => {
  await dono("insert into interno.avisos (para, texto, categoria) values ($1, 'Alguém reagiu ao seu story com uma chama.', 'rede')", [P.membro]);
  return (await avisosDe(P.membro)).find((x) => x.tipo === "reacao_story");
}, (r) => r && /story/.test(r.texto));
await espera("story: desligar 'reacao_story' para de gravar", async () => {
  await rpc(como(P.membro), "rede_aviso_prefs_salvar", { p_tipo: "reacao_story", p_canal: "site", p_ligado: false });
  await dono("insert into interno.avisos (para, texto, categoria) values ($1, 'Alguém reagiu ao seu story com um coração.', 'rede')", [P.membro]);
  return um("select count(*)::int as n from interno.avisos where para = $1 and tipo = 'reacao_story'", [P.membro]);
}, (r) => r.n === 1);
await espera("push: os tipos novos têm preferência no celular (desligada até ligar)", () => rpc(como(P.membro), "rede_aviso_prefs_ver", {}), (r) => r.push.conversa_seguida === false && r.push.ato === false && r.push.lembrete === false);

// ── Níveis do teste: quem tem 60 dias de conta é nível 2; a conta nova é nível 0 ──
await dono("update interno.rede_niveis set dias = 2, participacoes = 0, posts = 0, sem_procedente = 0 where nivel = 1");
await dono("update interno.rede_niveis set dias = 30, participacoes = 0, posts = 0, sem_procedente = 0 where nivel = 2");
await dono("update interno.rede_niveis set dias = 9999 where nivel = 3");

// ── 4. Notas de contexto ──
const fonte = "https://www.gov.br/fonte-oficial";
const nota = (quem, post, texto, f = fonte) => rpc(como(quem), "rede_alumia_nota_propor", { p_post: post, p_texto: texto, p_fonte: f });
const avaliar = (quem, id, ajuda) => rpc(como(quem), "rede_alumia_nota_avaliar", { p_nota: id, p_ajuda: ajuda });
const notasDe = (ator, post) => rpc(ator, "rede_alumia_notas", { p_post: post });
const avisosAntes = (await um("select count(*)::int as n from interno.avisos where para = $1", [P.membro])).n;
await recusa("nota: nível 0 não propõe", () => nota(P.nova, doPost, "O valor citado está errado segundo a tabela oficial."), "nivel");
await recusa("nota: ninguém propõe no próprio post", () => nota(P.membro, doPost, "O valor citado está errado segundo a tabela oficial."), "invalido:propria");
await recusa("nota: sem fonte http(s) é recusada", () => nota(P.outra, doPost, "O valor citado está errado segundo a tabela oficial.", "ouvi dizer"), "invalido:fonte");
await recusa("nota: com dado pessoal é recusada", () => nota(P.outra, doPost, "Liga para (11) 98765-4321 que ela confirma o valor."), "dado_pessoal");
await recusa("nota: quem não entrou na Alumia não propõe", () => nota(P.fora, doPost, "O valor citado está errado segundo a tabela oficial."), "consentimento");
const n0 = (await nota(P.outra, doPost, "O valor citado está errado segundo a tabela oficial de 2026.")).id;
await espera("nota: proposta não aparece para visitante", () => notasDe(visitante(), doPost), (r) => r.mostradas.length === 0 && r.para_avaliar.length === 0 && r.pode_propor === false);
await espera("nota: quem tem nível avalia sem ver total nem autora", () => notasDe(como(P.autora), doPost), (r) => r.para_avaliar.length === 1 && r.para_avaliar[0].minha === null && !("votos" in r.para_avaliar[0]) && semNomes(r));
await espera("nota: a autora vê a própria em 'minha'", () => notasDe(como(P.outra), doPost), (r) => r.minha?.id === n0 && r.para_avaliar.length === 0);
// Histórico: terceira e autora discordam em duas notas; quarta e moderadora concordam com a terceira.
const pA = await postar({ comunidade: "matematica", publico: "internet" }, P.membro, "Outro post A");
const pB = await postar({ comunidade: "matematica", publico: "internet" }, P.membro, "Outro post B");
const nA = (await nota(P.outra, pA, "Contexto que falta neste post A, segundo a fonte.")).id;
const nB = (await nota(P.outra, pB, "Contexto que falta neste post B, segundo a fonte.")).id;
for (const id of [nA, nB]) {
  await avaliar(P.terceira, id, true);
  await avaliar(P.autora, id, false);
  await avaliar(P.quarta, id, true);
  await avaliar(P.moderadora, id, true);
}
await recusa("nota: nível 0 não avalia", () => avaliar(P.nova, n0, true), "nivel");
await recusa("nota: ninguém avalia a própria", () => avaliar(P.outra, n0, true), "invalido:propria");
await avaliar(P.quarta, n0, true);
await avaliar(P.moderadora, n0, true);
await espera("nota: 3 'ajuda' de quem sempre concorda não bastam", () => avaliar(P.terceira, n0, true), (r) => r.mostrada === false && r.minha === true);
await espera("nota: aparece quando quem costuma discordar também aprova", () => avaliar(P.autora, n0, true), (r) => r.mostrada === true);
await espera("nota: a que aparece vem para o visitante, sem quem propôs nem quem avaliou", () => notasDe(visitante(), doPost), (r) => r.mostradas.length === 1 && r.mostradas[0].fonte === fonte && semNomes(r) && Object.keys(r.mostradas[0]).sort().join() === "criado_em,fonte,id,texto");
await espera("nota: nenhum aviso para quem escreveu o post (nem DM)", () => um("select count(*)::int as n from interno.avisos where para = $1", [P.membro]), (r) => r.n === avisosAntes);
await recusa("nota: quem não modera não oculta", () => rpc(como(P.terceira), "rede_alumia_nota_ocultar", { p_nota: n0, p_sim: true }), "sem_permissao");
await espera("nota: a moderação da comunidade oculta", () => rpc(como(P.moderadora), "rede_alumia_nota_ocultar", { p_nota: n0, p_sim: true }), (r) => r.situacao === "oculta");
await espera("nota: oculta some para o visitante", () => notasDe(visitante(), doPost), (r) => r.mostradas.length === 0);
await espera("nota: devolver recalcula pela regra", () => rpc(como(P.moderadora), "rede_alumia_nota_ocultar", { p_nota: n0, p_sim: false }), (r) => r.situacao === "mostrada");
await espera("nota: reescrever zera os votos", async () => {
  await nota(P.outra, doPost, "Texto novo da nota, com outra explicação e a mesma fonte.");
  return um("select count(*)::int as n, (select situacao from interno.rede_alumia_notas where id = $1) as s from interno.rede_alumia_nota_votos where nota = $1", [n0]);
}, (r) => r.n === 0 && r.s === "proposta");
await espera("nota: retirar apaga (LGPD art. 18)", async () => {
  await rpc(como(P.outra), "rede_alumia_nota_retirar", { p_nota: n0 });
  return um("select count(*)::int as n from interno.rede_alumia_notas where id = $1", [n0]);
}, (r) => r.n === 0);

// ── 5. Wiki ──
const wiki = (ator, slug, pagina = null) => rpc(ator, "rede_alumia_wiki", { p_slug: slug, p_pagina: pagina });
const salvarWiki = (quem, pagina, corpo, base = null, titulo = "Cartilha de direitos") =>
  rpc(como(quem), "rede_alumia_wiki_salvar", { p_slug: "moradia", p_pagina: pagina, p_titulo: titulo, p_corpo: corpo, p_resumo: "teste", p_base: base });
await espera("wiki: visitante lê a das disciplinas (vazia), sem editar", () => wiki(visitante(), "matematica"), (r) => r.paginas.length === 0 && r.pode_editar === false);
await recusa("wiki: visitante, luta → entre_primeiro", () => wiki(visitante(), "moradia"), "entre_primeiro");
await recusa("wiki: fechada para quem é de fora → nao_encontrado", () => wiki(como(P.outra), "segredo"), "nao_encontrado");
await recusa("wiki: quem não é da comunidade não edita", () => salvarWiki(P.nova, null, "Texto"), "sem_permissao");
await espera("wiki: quem é da comunidade cria a página", () => salvarWiki(P.membro, null, "Seus direitos num despejo: 1. Peça a ordem judicial."), (r) => r.pagina === "cartilha-de-direitos" && r.versao === 1);
await espera("wiki: outra pessoa edita na versão certa", () => salvarWiki(P.outra, "cartilha-de-direitos", "Seus direitos num despejo: 1. Peça a ordem judicial. 2. Chame a defensoria.", 1), (r) => r.versao === 2);
await recusa("wiki: editar em cima de versão velha → conflito", () => salvarWiki(P.terceira, "cartilha-de-direitos", "Outro texto", 1), "conflito");
await recusa("wiki: CPF nunca entra", () => salvarWiki(P.terceira, "cartilha-de-direitos", "Fale com 123.456.789-00", 2), "dado_pessoal");
await espera("wiki: o histórico não diz quem editou (para quem não modera)", () => rpc(como(P.terceira), "rede_alumia_wiki_historico", { p_slug: "moradia", p_pagina: "cartilha-de-direitos" }),
  (r) => r.versoes.length === 2 && r.versoes.every((x) => x.editou === null) && !JSON.stringify(r).includes("Codinome"));
await espera("wiki: a moderação vê quem editou", () => rpc(como(P.moderadora), "rede_alumia_wiki_historico", { p_slug: "moradia", p_pagina: "cartilha-de-direitos" }),
  (r) => r.versoes[0].editou === "Codinome 3" && r.versoes[1].editou === "Codinome 2");
await rpc(como(P.moderadora), "rede_alumia_wiki_travar", { p_slug: "moradia", p_pagina: "cartilha-de-direitos", p_sim: true });
await recusa("wiki: travada, só a moderação edita", () => salvarWiki(P.outra, "cartilha-de-direitos", "Mudança", 2), "travado");
await espera("wiki: a moderação volta a versão 1 (vira a 3)", () => rpc(como(P.moderadora), "rede_alumia_wiki_restaurar", { p_slug: "moradia", p_pagina: "cartilha-de-direitos", p_versao: 1 }), (r) => r.versao === 3);
await espera("wiki: quem é da comunidade lê a página e vê que está travada", () => wiki(como(P.terceira), "moradia"), (r) => r.pagina.versao === 3 && r.pagina.travada === true && r.pode_editar === false && r.pode_criar === true && /ordem judicial\.$/.test(r.pagina.corpo));

// A tela da wiki: no conflito, a versão nova fica à vista junto do formulário (o segundo "Salvar" não cobre o que a pessoa não
// viu); e a versão antiga aberta pelo histórico diz que é antiga e tem a volta para a atual.
{
  const tela = fs.readFileSync(new URL("../components/rede/comunidades/WikiDaComunidade.tsx", import.meta.url), "utf8");
  const form = tela.slice(tela.indexOf("{editando && ("));
  ok("wiki (tela): no conflito, a versão nova aparece dentro do formulário", form.includes("{conflito && atual && (") && form.includes("<TextoDaWiki corpo={atual.corpo} />") && form.includes("w.conflitoNova"));
  ok("wiki (tela): o conflito só é marcado depois de a versão nova chegar", /setEstado\(\{ chave, wiki: nova, erro: "" \}\);\s+if \(nova\.pagina\) \{\s+setEditando\([^)]*\);\s+setConflito\(true\);/.test(tela));
  ok("wiki (tela): versão antiga é dita como antiga, com a volta para a atual", tela.includes("vendo && vendo.versao !== atual.versao") && tela.includes("w.vendoAntiga") && tela.includes("{w.voltarAtual}"));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const w = JSON.parse(fs.readFileSync(new URL(`../i18n/rede/b1/${l}.json`, import.meta.url), "utf8")).wiki;
    ok(`wiki (${l}): os textos do conflito e da versão antiga existem`, w.conflitoNova?.includes("{n}") && w.vendoAntiga?.includes("{n}") && !!w.voltarAtual);
  }
}

// ── 6. Conversas que sigo ──
await espera("seguidas: a pessoa vê as conversas que segue", () => rpc(como(P.membro), "rede_alumia_conversas_seguidas", {}), (r) => r.itens.length === 1 && r.itens[0].raiz === raiz && r.itens[0].disponivel && r.itens[0].titulo === "Assembleia da ocupação" && r.total === 1);
await dono("update interno.rede_posts set oculto = true where id = $1", [raiz]);
await espera("seguidas: a oculta vem indisponível, sem título", () => rpc(como(P.membro), "rede_alumia_conversas_seguidas", {}), (r) => r.itens[0].disponivel === false && r.itens[0].titulo === null);
await espera("seguidas: deixa de seguir mesmo indisponível", () => rpc(como(P.membro), "rede_alumia_deixar_conversas", { p_raizes: [raiz] }), (r) => r.removidas === 1);
await dono("update interno.rede_posts set oculto = false where id = $1", [raiz]);

// ── 7. A linha dos #temas seguidos ──
const comTag = await postar({ comunidade: "moradia" }, P.autora, "Reunião hoje #moradia na praça");
await rpc(como(P.membro), "rede_alumia_seguir_tag", { p_tag: "moradia", p_sim: true });
await rpc(como(P.bloqueado), "rede_alumia_seguir_tag", { p_tag: "moradia", p_sim: true });
await espera("linha dos temas: os seguidos, do mais novo", () => rpc(como(P.membro), "rede_alumia_linha_tags", {}), (r) => r.itens.some((x) => x.id === comTag) && r.tags.includes("moradia"));
await espera("linha dos temas: a aba de um #tema", () => rpc(como(P.membro), "rede_alumia_linha_tags", { p_tag: "#Moradia" }), (r) => r.itens[0]?.id === comTag);
await espera("linha dos temas: quem foi bloqueado não vê o post", () => rpc(como(P.bloqueado), "rede_alumia_linha_tags", {}), (r) => !r.itens.some((x) => x.id === comTag));
await espera("linha dos temas: visitante só vê o que é da internet", () => rpc(visitante(), "rede_alumia_linha_tags", { p_tag: "moradia" }), (r) => r.itens.length === 0);
await recusa("linha dos temas: visitante não tem 'seguidos'", () => rpc(visitante(), "rede_alumia_linha_tags", {}), "entre_primeiro");

// ── 8. Busca com operadores ──
const buscar = (ator, q) => rpc(ator, "rede_alumia_buscar", { p_q: q });
await espera("busca: lê os operadores", () => um("select interno.rede_alumia_busca_ler($1) as o", ["greve tag:moradia de:@autora_b1c desde:2026-01-01 c:moradia tipo:duvida"]),
  (r) => r.o.texto === "greve" && r.o.tag === "moradia" && r.o.de === "@autora_b1c" && r.o.desde === "2026-01-01" && r.o.c === "moradia" && r.o.tipo === "duvida");
await espera("busca: tag: acha", () => buscar(como(P.membro), "tag:moradia"), (r) => r.itens.some((x) => x.id === comTag));
await espera("busca: de: com c: acha", () => buscar(como(P.membro), "de:@autora_b1c c:moradia reunião"), (r) => r.itens.some((x) => x.id === comTag));
await espera("busca: de: com bloqueio volta vazia, sem erro", () => buscar(como(P.bloqueado), "de:@autora_b1c"), (r) => r.itens.length === 0);
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [P.autora]);
await espera("busca: de: com perfil invisível volta vazia", () => buscar(como(P.membro), "de:@autora_b1c"), (r) => r.itens.length === 0);
await dono("update interno.perfis set rede_modo = 'aberto' where id = $1", [P.autora]);
await recusa("busca: desde: no futuro é recusado", () => buscar(como(P.membro), "desde:2099-01-01"), "invalido:desde");
await recusa("busca: tipo: desconhecido é recusado", () => buscar(como(P.membro), "tipo:xyz"), "invalido:tipo");
await espera("busca: sem operador é a busca de sempre", () => buscar(como(P.membro), "reunião"), (r) => Array.isArray(r.pessoas) && r.itens.some((x) => x.id === comTag));
const salva = await rpc(como(P.membro), "rede_alumia_busca_salvar", { p_nome: "Moradia", p_q: "tag:moradia" });
await espera("busca salva: aparece na lista da pessoa", () => rpc(como(P.membro), "rede_alumia_buscas_salvas", {}), (r) => r.itens.length === 1 && r.itens[0].q === "tag:moradia");
await espera("busca salva: só a dona vê", () => rpc(como(P.outra), "rede_alumia_buscas_salvas", {}), (r) => r.itens.length === 0);
await recusa("busca salva: outra pessoa não apaga", () => rpc(como(P.outra), "rede_alumia_busca_apagar", { p_id: salva.id }), "nao_encontrado");
await espera("busca salva: a dona apaga", () => rpc(como(P.membro), "rede_alumia_busca_apagar", { p_id: salva.id }), (r) => r.apagada);

// ── 9. Salvos em pastas ──
const pasta1 = (await rpc(como(P.membro), "rede_alumia_pasta_criar", { p_nome: "Leituras" })).id;
const pasta2 = (await rpc(como(P.membro), "rede_alumia_pasta_criar", { p_nome: "Para a assembleia" })).id;
await recusa("pastas: nome repetido é recusado", () => rpc(como(P.membro), "rede_alumia_pasta_criar", { p_nome: "leituras" }), "invalido:nome");
await espera("pastas: pôr na pasta também salva", async () => {
  await rpc(como(P.membro), "rede_alumia_pasta_por", { p_pasta: pasta1, p_post: doPost });
  return um("select count(*)::int as n from interno.rede_salvos where usuario = $1 and post = $2", [P.membro, doPost]);
}, (r) => r.n === 1);
await espera("pastas: pôr em outra pasta privada move", async () => {
  await rpc(como(P.membro), "rede_alumia_pasta_por", { p_pasta: pasta2, p_post: doPost });
  return rpc(como(P.membro), "rede_alumia_pastas", { p_post: doPost });
}, (r) => r.itens.find((x) => x.id === pasta1).posts === 0 && r.itens.find((x) => x.id === pasta2).tem === true);
await recusa("pastas: outra pessoa não abre a pasta privada", () => rpc(como(P.outra), "rede_alumia_pasta_posts", { p_pasta: pasta2 }), "nao_encontrado");
await espera("pastas: renomear", () => rpc(como(P.membro), "rede_alumia_pasta_mudar", { p_id: pasta2, p_nome: "Assembleia" }), (r) => r.nome === "Assembleia");
await espera("pastas: tirar dos salvos tira da pasta privada", async () => {
  await dono("delete from interno.rede_salvos where usuario = $1 and post = $2", [P.membro, doPost]);
  return rpc(como(P.membro), "rede_alumia_pasta_posts", { p_pasta: pasta2 });
}, (r) => r.itens.length === 0);
const nuc = (await um("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo B1', 'São Paulo') returning id")).id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'mediacao'), ($1, $3, 'membro')", [nuc, P.membro, P.outra]);
const pastaN = (await rpc(como(P.outra), "rede_alumia_pasta_criar", { p_nome: "Clipping", p_nucleo: nuc })).id;
await rpc(como(P.outra), "rede_alumia_pasta_por", { p_pasta: pastaN, p_post: doPost });
await espera("pasta do núcleo: quem é do núcleo vê, sem saber quem pôs", () => rpc(como(P.membro), "rede_alumia_pasta_posts", { p_pasta: pastaN }), (r) => r.itens.length === 1 && r.pasta.nucleo === true && semNomes(r.pasta));
await recusa("pasta do núcleo: quem não é do núcleo não vê", () => rpc(como(P.terceira), "rede_alumia_pasta_posts", { p_pasta: pastaN }), "nao_encontrado");
await recusa("pasta do núcleo: só a mediação apaga", () => rpc(como(P.outra), "rede_alumia_pasta_mudar", { p_id: pastaN, p_nome: null }), "sem_permissao");
await espera("pasta do núcleo: a mediação apaga", () => rpc(como(P.membro), "rede_alumia_pasta_mudar", { p_id: pastaN, p_nome: null }), (r) => r.apagada);
await espera("pastas: a tabela de itens não guarda quem pôs", () => um("select count(*)::int as n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_alumia_pasta_itens' and column_name in ('usuario', 'quem')"), (r) => r.n === 0);

// ── 10. "Pergunte a…" ──
await rpc(como(P.autora), "rede_alumia_caixa_ajustar", { p_aberta: true, p_anonimas: true, p_chamada: "Pergunte sobre a ocupação" });
const perguntar = (quem, texto, extra = {}) => rpc(como(quem), "rede_alumia_perguntar", { p_handle: "autora_b1c", p_slug: null, p_texto: texto, ...extra });
await perguntar(P.membro, "Quando é a próxima assembleia?");
await perguntar(P.outra, "Posso levar a minha filha?", { p_mostrar_nome: true });
await recusa("pergunta: anônima exige nível 1", () => perguntar(P.nova, "Pergunta anônima de quem chegou agora", { p_anonima: true }), "nivel");
await recusa("pergunta: com dado pessoal é recusada", () => perguntar(P.terceira, "Meu e-mail é ana@exemplo.com.br, me responde"), "dado_pessoal");
await recusa("pergunta: quem foi bloqueado não acha a caixa", () => perguntar(P.bloqueado, "Pergunta de quem foi bloqueado"), "nao_encontrado");
await recusa("pergunta: ninguém pergunta à própria caixa", () => perguntar(P.autora, "Pergunta para mim mesma"), "invalido:propria");
await perguntar(P.terceira, "Pergunta anônima de quem tem nível", { p_anonima: true, p_mostrar_nome: true });
let fila;
await espera("pergunta: a fila em ordem de chegada; nome só de quem quis", async () => (fila = (await rpc(como(P.autora), "rede_alumia_caixa", { p_handle: "autora_b1c" })).fila),
  (f) => f.length === 3 && f[0].texto.startsWith("Quando") && f[0].quem === null && f[1].quem === "Codinome 3" && f[2].anonima === true && f[2].quem === null);
await espera("pergunta: quem não cuida não vê a fila", () => rpc(como(P.quarta), "rede_alumia_caixa", { p_handle: "autora_b1c" }), (r) => r.fila === null && r.pode_perguntar === true && r.respondidas.length === 0);
await rpc(como(P.autora), "rede_alumia_pergunta_tratar", { p_id: fila[1].id, p_resposta: "Pode sim, terá roda de crianças." });
await espera("pergunta: a respondida aparece para todos, com o nome só se quis", () => rpc(como(P.quarta), "rede_alumia_caixa", { p_handle: "autora_b1c" }), (r) => r.respondidas.length === 1 && r.respondidas[0].quem === "Codinome 3");
await recusa("pergunta: outra pessoa não responde", () => rpc(como(P.quarta), "rede_alumia_pergunta_tratar", { p_id: fila[0].id, p_resposta: "Eu respondo" }), "nao_encontrado");
await espera("pergunta: quem perguntou retira", () => rpc(como(P.membro), "rede_alumia_pergunta_tratar", { p_id: fila[0].id, p_retirar: true }), (r) => r.retirada);
await rpc(como(P.moderadora), "rede_alumia_caixa_ajustar", { p_slug: "moradia", p_aberta: true, p_anonimas: false });
await rpc(como(P.membro), "rede_alumia_perguntar", { p_handle: null, p_slug: "moradia", p_texto: "Como entrar na comissão de moradia?" });
await espera("pergunta: na comunidade, a moderação responde sem aparecer", async () => {
  const f = (await rpc(como(P.moderadora), "rede_alumia_caixa", { p_slug: "moradia" })).fila;
  await rpc(como(P.moderadora), "rede_alumia_pergunta_tratar", { p_id: f[0].id, p_resposta: "Na assembleia de terça." });
  return rpc(como(P.outra), "rede_alumia_caixa", { p_slug: "moradia" });
}, (r) => r.respondidas.length === 1 && r.respondidas[0].quem === null && !JSON.stringify(r).includes("Codinome 9"));

// ── 11. Posts recorrentes ──
await espera("recorrente: agenda a série", async () => {
  const quando = new Date(Date.now() + 3600e3).toISOString();
  return rpc(como(P.autora), "rede_alumia_agendar_serie", { p: { texto: "Assembleia toda terça", comunidade: "moradia" }, p_quando: quando, p_repetir: "semanal" });
}, (r) => r.serie && r.repetir === "semanal");
await recusa("recorrente: repetição desconhecida é recusada", () => rpc(como(P.autora), "rede_alumia_agendar_serie", { p: { texto: "x" }, p_quando: new Date(Date.now() + 3600e3).toISOString(), p_repetir: "diaria" }), "invalido:repetir");
await espera("recorrente: quando sai um, o próximo entra na fila uma semana depois", async () => {
  await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where autor = $1 and serie is not null and estado = 'pendente'", [P.autora]);
  await dono("select interno.rede3_pub_rodar($1)", [P.autora]);
  return um("select count(*) filter (where estado = 'publicado')::int as pub, count(*) filter (where estado = 'pendente' and vezes = 2 and quando > now() + interval '6 days')::int as prox from interno.rede_agendados where autor = $1 and serie is not null", [P.autora]);
}, (r) => r.pub === 1 && r.prox === 1);
await espera("recorrente: rodar de novo (agendador e 'ao ler') não põe outro na fila nem publica em dobro", async () => {
  await dono("select interno.rede3_pub_rodar(null)");
  await dono("select interno.rede3_pub_rodar($1)", [P.autora]);
  return um("select count(*) filter (where estado = 'publicado')::int as pub, count(*) filter (where estado = 'pendente')::int as fila, (select count(*)::int from interno.rede_posts where autor = $1 and texto = 'Assembleia toda terça') as posts from interno.rede_agendados where autor = $1 and serie is not null", [P.autora]);
}, (r) => r.pub === 1 && r.fila === 1 && r.posts === 1);
await recusa("recorrente: série não leva imagem (o arquivo só nasce uma vez)", () => rpc(como(P.autora), "rede_alumia_agendar_serie", { p: { texto: "x", midia: [{ caminho: "a/b.jpg", alt: "" }] }, p_quando: new Date(Date.now() + 3600e3).toISOString(), p_repetir: "mensal" }), "repetir_sem_arquivo");
await espera("recorrente: as colunas são as mesmas da casca (nada de coluna própria)", () => um("select count(*)::int as n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_agendados' and column_name in ('ate', 'vez')"), (r) => r.n === 0);
await espera("fim da onda: rede_alumia_versao() = 3, para visitante também, e a migração é a última do install.sql", async () => {
  const fim = fs.readFileSync(new URL("../supabase/migracoes/20261111-alumia-onda6-fim.sql", import.meta.url), "utf8");
  const install = fs.readFileSync(new URL("../supabase/install.sql", import.meta.url), "utf8");
  return { v: await rpc({ papel: "anon", ip: "203.0.113.250" }, "rede_alumia_versao"), ultima: install.endsWith(String.fromCharCode(10) + fim), ordem: ["b1-atos", "b1-perfil-org", "b1-stories", "b1-casca", "b1-comunidade"].map((n) => install.indexOf(fs.readFileSync(new URL(`../supabase/migracoes/20261110-alumia-${n}.sql`, import.meta.url), "utf8"))) };
}, (r) => r.v === 3 && r.ultima && r.ordem.every((i, k) => i > 0 && (k === 0 || i > r.ordem[k - 1])));
let serie;
await espera("recorrente: a lista das séries", async () => (serie = (await rpc(como(P.autora), "rede_alumia_series", {})).itens), (s) => s.length === 1 && s[0].vez === 2);
await espera("recorrente: parar a série cancela a fila", async () => {
  await rpc(como(P.autora), "rede_alumia_serie_parar", { p_serie: serie[0].serie });
  return rpc(como(P.autora), "rede_alumia_series", {});
}, (r) => r.itens.length === 0);

// ── 12. Lembrar mais tarde ──
await recusa("lembrete: menos de 5 minutos é recusado", () => rpc(como(P.membro), "rede_alumia_lembrar", { p_post: doPost, p_quando: new Date(Date.now() + 60e3).toISOString() }), "invalido:quando");
await rpc(como(P.membro), "rede_alumia_lembrar", { p_post: doPost, p_quando: new Date(Date.now() + 600e3).toISOString() });
await rpc(como(P.membro), "rede_alumia_lembrar", { p_post: comTag, p_quando: new Date(Date.now() + 600e3).toISOString() });
await espera("lembrete: só a pessoa vê os dela", () => rpc(como(P.outra), "rede_alumia_lembretes", {}), (r) => r.itens.length === 0);
await dono("update interno.rede_alumia_lembretes set quando = now() - interval '1 minute' where usuario = $1", [P.membro]);
await dono("update interno.rede_posts set retido = true where id = $1", [comTag]);
await espera("lembrete: na hora, vira aviso do tipo 'lembrete' (o do post retido some calado)", async () => {
  const n = (await um("select interno.rede_alumia_lembretes_rodar(null) as n")).n;
  const a = await um("select count(*)::int as n from interno.avisos where para = $1 and tipo = 'lembrete'", [P.membro]);
  const sobra = await um("select count(*)::int as n from interno.rede_alumia_lembretes where usuario = $1", [P.membro]);
  return { n, a: a.n, sobra: sobra.n };
}, (r) => r.n === 1 && r.a === 1 && r.sobra === 0);
await dono("update interno.rede_posts set retido = false where id = $1", [comTag]);

const FUNCOES_NOVAS = ["rede_alumia_com_pagina", "rede_alumia_ajudou", "rede_aviso_prefs_ver", "rede_aviso_prefs_salvar", "rede_alumia_notas", "rede_alumia_nota_propor",
  "rede_alumia_nota_retirar", "rede_alumia_nota_avaliar", "rede_alumia_nota_ocultar", "rede_alumia_wiki", "rede_alumia_wiki_salvar", "rede_alumia_wiki_historico",
  "rede_alumia_wiki_restaurar", "rede_alumia_wiki_travar", "rede_alumia_conversas_seguidas", "rede_alumia_deixar_conversas", "rede_alumia_linha_tags", "rede_alumia_buscar",
  "rede_alumia_buscas_salvas", "rede_alumia_busca_salvar", "rede_alumia_busca_apagar", "rede_alumia_pastas", "rede_alumia_pasta_criar", "rede_alumia_pasta_mudar",
  "rede_alumia_pasta_por", "rede_alumia_pasta_posts", "rede_alumia_caixa", "rede_alumia_caixa_ajustar", "rede_alumia_perguntar", "rede_alumia_pergunta_tratar",
  "rede_alumia_agendar_serie", "rede_alumia_series", "rede_alumia_serie_parar", "rede_alumia_lembrar", "rede_alumia_lembretes", "rede_alumia_lembretes_disparar"];
const TABELAS_NOVAS = ["rede_alumia_notas", "rede_alumia_nota_votos", "rede_alumia_wiki", "rede_alumia_wiki_versoes", "rede_alumia_buscas_salvas", "rede_alumia_pastas",
  "rede_alumia_pasta_itens", "rede_alumia_caixas", "rede_alumia_perguntas", "rede_alumia_lembretes"];
const INTERNAS_NOVAS = ["rede_alumia_com_ver", "rede_alumia_tipos_de_aviso", "rede_alumia_aviso_seguidores", "rede_alumia_reacoes_de", "rede_alumia_discordam",
  "rede_alumia_nota_recalcular", "rede_alumia_nota_post", "rede_alumia_wiki_edita", "rede_alumia_busca_ler", "rede_alumia_pasta", "rede_alumia_caixa_de",
  "rede_alumia_caixa_cuida", "rede_alumia_serie_seguir", "rede_alumia_lembretes_rodar"];

// ── Permissões das funções novas ──
await espera("funções públicas novas: security definer com search_path = interno, pg_temp", () => um(`select count(*)::int as n, bool_and(p.prosecdef) as def,
  bool_and(array_to_string(p.proconfig, ',') like '%search_path=interno, pg_temp%') as caminho
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1::text[])`, [FUNCOES_NOVAS]), (r) => r.n >= FUNCOES_NOVAS.length && r.def && r.caminho);
await espera("tabelas novas da B1: RLS ligada e nenhuma permissão direta", () => um(`select count(*)::int as n, bool_and(c.relrowsecurity) as rls,
  (select count(*)::int from information_schema.role_table_grants g where g.table_schema = 'interno' and g.table_name = any ($1::text[]) and g.grantee in ('anon', 'authenticated', 'PUBLIC')) as grants
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and c.relname = any ($1::text[])`, [TABELAS_NOVAS]), (r) => r.n === TABELAS_NOVAS.length && (r.rls ?? true) && r.grants === 0);
await espera("funções internas novas fechadas para anon e authenticated", () => um(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.proname = any ($1::text[]) and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`, [INTERNAS_NOVAS]), (r) => r.n === 0);

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`Alumia B1 comunidade: ${certos} conferências certas.`);
