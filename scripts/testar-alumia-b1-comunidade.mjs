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

// @@MAIS_TESTES@@

const FUNCOES_NOVAS = ["rede_alumia_com_pagina", "rede_alumia_ajudou", "rede_aviso_prefs_ver", "rede_aviso_prefs_salvar"];
const TABELAS_NOVAS = [];
const INTERNAS_NOVAS = ["rede_alumia_com_ver", "rede_alumia_tipos_de_aviso", "rede_alumia_aviso_seguidores", "rede_alumia_reacoes_de"];

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
