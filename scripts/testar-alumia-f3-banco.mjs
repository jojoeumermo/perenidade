// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o back-end mínimo da F3 da Alumia (supabase/migracoes/20261109-alumia-f3.sql; PLANO-ALUMIA §5, §6 e §8 F3) num Postgres
// de verdade dentro do Node, com a matriz visitante / membro / dono / bloqueado: "N posts esta semana" (agregado, a partir de 3),
// "Comunidades ativas", "ajudou a autora" (só quem abriu a conversa marca), o post fixado pela moderação e as reações com emoji
// (lista fechada, só total a partir de 3, nunca quem). Confere também que as tabelas novas não têm permissão direta e que a
// migração roda duas vezes. Uso: node scripts/testar-alumia-f3-banco.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
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

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const sql = fs.readFileSync(new URL("../supabase/migracoes/20261109-alumia-f3.sql", import.meta.url), "utf8");

await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("instalar de novo não quebra (idempotente)", () => banco.exclusivo(() => banco.pg.exec(sql)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

// ── As pessoas: dono (abre a conversa), membro, outros dois membros, bloqueado (pelo dono), fora (sem consentimento), moderadora ──
const P = {};
const nomes = ["dono", "membro", "outra", "terceira", "bloqueado", "fora", "moderadora", "banida"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@f3.local`, `Nome Civil ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_f3`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "fora")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.dono, P.bloqueado]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet'),
  ('moradia', 'Moradia', 'lutas', 'aberta', 'membros'),
  ('quieta', 'Quieta', 'disciplinas', 'aberta', 'internet'),
  ('segredo', 'Segredo', 'lutas', 'fechada', 'comunidade')
  on conflict do nothing`);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('matematica', $1, 'moderacao'), ('segredo', $2, 'membro')", [P.moderadora, P.membro]);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ('matematica', $1, 'membro', 'banido')", [P.banida]);

const postar = async (campos, autor = P.dono, texto = "post do teste") => {
  const todos = { publico: "membros", ...campos };
  const colunas = Object.keys(todos);
  return (await um(`insert into interno.rede_posts (autor, texto, ${colunas.join(", ")}) values ($1, $2, ${colunas.map((_, i) => `$${i + 3}`).join(", ")}) returning id`, [autor, texto, ...Object.values(todos)])).id;
};
const semNomes = (v) => !/(@f3\.local|Nome Civil|"usuario"|"quem"|"pessoas")/.test(JSON.stringify(v));

// ── 1. "N posts esta semana" ──
for (let i = 0; i < 5; i++) await postar({ comunidade: "matematica", publico: "internet" }, i % 2 ? P.membro : P.outra, `post ${i}`);
await postar({ comunidade: "quieta", publico: "internet" }, P.membro, "um só");
await postar({ comunidade: "quieta", publico: "internet" }, P.outra, "e outro");
const velho = await postar({ comunidade: "matematica", publico: "internet" }, P.membro, "antigo");
await dono("update interno.rede_posts set criado_em = now() - interval '8 days' where id = $1", [velho]);
const removido = await postar({ comunidade: "matematica", publico: "internet" }, P.membro, "removido");
await dono("update interno.rede_posts set oculto = true where id = $1", [removido]);
for (let i = 0; i < 4; i++) await postar({ comunidade: "segredo", publico: "comunidade" }, P.membro, `segredo ${i}`);

await espera("página: visitante vê os posts da semana da disciplina (5: sem o velho nem o removido)", () => rpc(visitante(), "rede_alumia_com_pagina", { p_slug: "matematica" }), (r) => r.posts_7d === 5 && r.comunidade.slug === "matematica");
await espera("página: membro vê o mesmo número", () => rpc(como(P.membro), "rede_alumia_com_pagina", { p_slug: "matematica" }), (r) => r.posts_7d === 5);
await espera("página: abaixo de 3 vem nulo (\"poucos\")", () => rpc(como(P.membro), "rede_alumia_com_pagina", { p_slug: "quieta" }), (r) => r.posts_7d === null);
await espera("página: nunca quantos membros nem quem escreveu", () => rpc(como(P.membro), "rede_alumia_com_pagina", { p_slug: "matematica" }), (r) => semNomes(r) && !("membros" in r));
await recusa("página: comunidade fechada não abre para quem é de fora", () => rpc(como(P.outra), "rede_alumia_com_pagina", { p_slug: "segredo" }), "nao_encontrado");
await recusa("página: das lutas, visitante precisa entrar", () => rpc(visitante(), "rede_alumia_com_pagina", { p_slug: "moradia" }), "entre_primeiro");
await espera("página: quem é da fechada vê a contagem dela", () => rpc(como(P.membro), "rede_alumia_com_pagina", { p_slug: "segredo" }), (r) => r.posts_7d === 4);

// ── 2. Fixado pela moderação ──
const fixavel = await postar({ comunidade: "matematica", publico: "internet", tipo: "discussao", titulo: "Sexta tem ato", corpo: "Como vai funcionar a sexta." }, P.membro, "Sexta tem ato");
await recusa("fixar: membro comum não fixa", () => rpc(como(P.membro), "rede_com_fixar", { p_slug: "matematica", p_post: fixavel, p_sim: true }), "sem_permissao");
await espera("fixar: a moderação fixa", () => rpc(como(P.moderadora), "rede_com_fixar", { p_slug: "matematica", p_post: fixavel, p_sim: true }), (r) => r.fixado === true);
await espera("fixado aparece na página nova para o visitante", () => rpc(visitante(), "rede_alumia_com_pagina", { p_slug: "matematica" }), (r) => r.fixados.length === 1 && r.fixados[0].id === fixavel);
await espera("fixado aparece para o membro", () => rpc(como(P.outra), "rede_alumia_com_pagina", { p_slug: "matematica" }), (r) => r.fixados.some((p) => p.id === fixavel));

// ── 3. Comunidades ativas ──
const ativas = (quem, n) => rpc(quem, "rede_alumia_ativas", n === undefined ? {} : { p_quantas: n });
await espera("ativas: visitante vê só disciplinas com 3+ posts (matemática; a quieta tem 2)", () => ativas(visitante()), (r) => r.itens.map((c) => c.slug).join() === "matematica");
await espera("ativas: membro de fora não vê a fechada", () => ativas(como(P.outra)), (r) => !r.itens.some((c) => c.slug === "segredo"));
await espera("ativas: quem é da fechada vê, na ordem dos posts", () => ativas(como(P.membro)), (r) => r.itens.map((c) => c.slug).join() === "matematica,segredo" && r.itens[0].posts_7d === 6);
await espera("ativas: p_quantas corta (1)", () => ativas(como(P.membro), 1), (r) => r.itens.length === 1);
await espera("ativas: sem nomes de pessoas", () => ativas(como(P.membro)), semNomes);

// ── 4. Reações com emoji ──
const doPost = await postar({ comunidade: "matematica", publico: "internet", tipo: "duvida", titulo: "Quanto fica com o app?", corpo: "Alguém já calculou quanto fica com o app?" }, P.dono, "Quanto fica com o app?");
const reagir = (quem, emoji, sim = true, post = doPost) => rpc(como(quem), "rede_alumia_reagir", { p_post: post, p_emoji: emoji, p_sim: sim });
const totais = (r) => Object.fromEntries(r.reacoes.map((x) => [x.emoji, x.total]));
await espera("reagir: membro reage com ✊; total abaixo de 3 vem nulo", () => reagir(P.membro, "✊"), (r) => r.reacoes.length === 1 && r.reacoes[0].total === null && r.reacoes[0].minha === true);
await espera("reagir: de novo não duplica", () => reagir(P.membro, "✊"), (r) => r.reacoes.length === 1);
await reagir(P.outra, "✊");
await espera("reagir: o 3º aparece com total", () => reagir(P.terceira, "✊"), (r) => totais(r)["✊"] === 3);
await espera("reagir: o dono reage no próprio post", () => reagir(P.dono, "📚"), (r) => r.reacoes.find((x) => x.emoji === "📚")?.minha === true);
await espera("reagir: a resposta nunca traz quem reagiu", () => reagir(P.membro, "❤️"), (r) => semNomes(r) && r.reacoes.every((x) => Object.keys(x).sort().join() === "emoji,minha,total"));
await espera("reagir: tirar a reação", () => reagir(P.membro, "❤️", false), (r) => !r.reacoes.some((x) => x.emoji === "❤️"));
await recusa("reagir: emoji fora da lista é recusado", () => reagir(P.membro, "💩"), "invalido:emoji");
await recusa("reagir: texto livre é recusado", () => reagir(P.membro, "viva"), "invalido:emoji");
await recusa("reagir: bloqueado pelo dono não reage", () => reagir(P.bloqueado, "✊"), "nao_encontrado");
await recusa("reagir: banida da comunidade não reage", () => reagir(P.banida, "✊"), "sem_permissao");
await recusa("reagir: sem consentimento não reage", () => reagir(P.fora, "✊"), "consentimento");
await recusa("reagir: visitante não reage", () => rpc(visitante(), "rede_alumia_reagir", { p_post: doPost, p_emoji: "✊", p_sim: true }), "permission denied");
const doSegredo = await postar({ comunidade: "segredo", publico: "comunidade" }, P.membro, "só da fechada");
await recusa("reagir: post de comunidade fechada não existe para quem é de fora", () => reagir(P.outra, "✊", true, doSegredo), "nao_encontrado");

const ler = (quem, posts) => rpc(quem, "rede_alumia_reacoes", { p_posts: posts });
await espera("ler reações: visitante lê os totais do post aberto à internet", () => ler(visitante(), [doPost]), (r) => r.itens.length === 1 && totais(r.itens[0])["✊"] === 3 && r.itens[0].reacoes.every((x) => x.minha === false));
await espera("ler reações: o dono vê só totais (nunca quem), como todo mundo", () => ler(como(P.dono), [doPost]), (r) => semNomes(r) && totais(r.itens[0])["📚"] === null);
await espera("ler reações: bloqueado não recebe o post (nem o id)", () => ler(como(P.bloqueado), [doPost]), (r) => r.itens.length === 0);
await espera("ler reações: post da fechada não volta para quem é de fora", () => ler(como(P.outra), [doSegredo]), (r) => r.itens.length === 0);
await recusa("ler reações: mais de 50 de uma vez é recusado", () => ler(como(P.membro), Array.from({ length: 51 }, () => doPost)), "invalido:posts");
await espera("a reação some quando a conta é apagada", async () => {
  await dono("delete from auth.users where id = $1", [P.terceira]);
  return ler(como(P.membro), [doPost]);
}, (r) => totais(r.itens[0])["✊"] === null);

// ── 5. "ajudou a autora" ──
const r1 = await postar({ resposta_a: doPost, comunidade: "matematica", publico: "internet" }, P.membro, "Fica uns 40%.");
const r2 = await postar({ resposta_a: doPost, comunidade: "matematica", publico: "internet" }, P.outra, "Depende da cidade.");
const r3 = await postar({ resposta_a: r1, comunidade: "matematica", publico: "internet" }, P.dono, "Obrigada!");
const ajudou = (quem, resposta, sim = true) => rpc(como(quem), "rede_alumia_ajudou", { p_resposta: resposta, p_sim: sim });
await recusa("ajudou: membro comum não marca", () => ajudou(P.outra, r1), "sem_permissao");
await recusa("ajudou: nem a moderação marca (só a autora)", () => ajudou(P.moderadora, r1), "sem_permissao");
await recusa("ajudou: bloqueado não marca (nem vê a conversa)", () => ajudou(P.bloqueado, r1), "nao_encontrado");
await recusa("ajudou: visitante não marca", () => rpc(visitante(), "rede_alumia_ajudou", { p_resposta: r1, p_sim: true }), "permission denied");
await recusa("ajudou: a autora não marca a própria resposta", () => ajudou(P.dono, r3), "invalido:propria");
await espera("ajudou: a autora marca", () => ajudou(P.dono, r1), (r) => r.ajudou === r1);
await espera("ajudou: quem escreveu a resposta recebe um aviso (sem dizer quem marcou)", () => um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%ajudou quem abriu%'", [P.membro]), (r) => r.n === 1);
await espera("ajudou: na dúvida, a marca também é a 'resolveu' de hoje", () => um("select aceita from interno.rede_posts where id = $1", [doPost]), (r) => r.aceita === r1);
await espera("ajudou: marcar outra troca a marca (uma por conversa)", () => ajudou(P.dono, r2), (r) => r.ajudou === r2);
const conversa = (quem) => rpc(quem, "rede_alumia_conversa", { p_id: doPost, p_ordem: "antigas" });
await espera("conversa: a autora vê a marca e pode marcar", () => conversa(como(P.dono)), (r) => r.ajudou === r2 && r.pode_ajudou === true);
await espera("conversa: membro vê a marca e não pode marcar", () => conversa(como(P.membro)), (r) => r.ajudou === r2 && r.pode_ajudou === false);
await espera("conversa: visitante vê a marca, as respostas e os totais das reações", () => conversa(visitante()), (r) => r.ajudou === r2 && r.pode_ajudou === false && r.respostas.length === 3 && Array.isArray(r.post.reacoes));
await recusa("conversa: bloqueado não abre a conversa do dono", () => conversa(como(P.bloqueado)), "nao_encontrado");
await espera("conversa: sem pronomes no perfil, vem nulo (o selo diz 'quem perguntou')", () => conversa(como(P.membro)), (r) => r.pronomes_da_raiz === null);
await espera("conversa: nada de nome civil nem e-mail", () => conversa(como(P.membro)), semNomes);
await espera("ajudou: desmarcar", () => ajudou(P.dono, r2, false), (r) => r.ajudou === null);
await espera("ajudou: desmarcar também solta a 'resolveu'", () => um("select aceita from interno.rede_posts where id = $1", [doPost]), (r) => r.aceita === null);
// Fora de dúvida também vale (a prancha marca numa conversa qualquer), sem mexer na "resolveu".
const discussao = await postar({ comunidade: "matematica", publico: "internet", tipo: "discussao", titulo: "Vamos discutir", corpo: "Uma discussão aberta aqui." }, P.dono, "Vamos discutir");
const rd = await postar({ resposta_a: discussao, comunidade: "matematica", publico: "internet" }, P.outra, "Boa ideia.");
await espera("ajudou: numa discussão a autora também marca", () => ajudou(P.dono, rd), (r) => r.ajudou === rd);
await espera("ajudou: numa discussão a 'resolveu' fica como estava", () => um("select aceita from interno.rede_posts where id = $1", [discussao]), (r) => r.aceita === null);
await espera("ajudou: resposta removida pela moderação some da marca", async () => {
  await dono("update interno.rede_posts set oculto = true where id = $1", [rd]);
  return rpc(como(P.membro), "rede_alumia_conversa", { p_id: discussao, p_ordem: "antigas" });
}, (r) => r.ajudou === null);

// ── 6. Permissões ──
await espera("tabelas novas com RLS ligada", () => um("select bool_and(relrowsecurity) as ok from pg_class where oid in ('interno.rede_reacoes_emoji'::regclass, 'interno.rede_ajudou'::regclass)"), (r) => r.ok === true);
await espera("tabelas novas sem nenhuma permissão para anon/authenticated", () => um(`select count(*)::int as n from information_schema.role_table_grants
  where table_schema = 'interno' and table_name in ('rede_reacoes_emoji', 'rede_ajudou') and grantee in ('anon', 'authenticated', 'PUBLIC')`), (r) => r.n === 0);
await espera("funções internas novas fechadas para anon/authenticated", () => um(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.proname like 'rede_alumia_%' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`), (r) => r.n === 0);
await espera("funções públicas novas: security definer com search_path = interno, pg_temp", () => um(`select count(*)::int as n, bool_and(p.prosecdef) as def,
  bool_and(array_to_string(p.proconfig, ',') like '%search_path=interno, pg_temp%') as caminho
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('rede_alumia_com_pagina', 'rede_alumia_ativas', 'rede_alumia_reagir', 'rede_alumia_reacoes', 'rede_alumia_ajudou', 'rede_alumia_conversa')`), (r) => r.n === 6 && r.def && r.caminho);
await espera("escrita só para quem entrou (anon não executa reagir/ajudou)", () => um(`select has_function_privilege('anon', 'public.rede_alumia_reagir(uuid, text, boolean)', 'execute') as a,
  has_function_privilege('anon', 'public.rede_alumia_ajudou(uuid, boolean)', 'execute') as b`), (r) => r.a === false && r.b === false);
await recusa("limite de uso: reagir tem teto", async () => {
  await dono("insert into interno.limites_config (acao, maximo, minutos) values ('rede2_reagir', 2, 60) on conflict (acao) do update set maximo = 2");
  for (let i = 0; i < 4; i++) await reagir(P.outra, i % 2 ? "🔥" : "👏", i < 2);
}, "muitos_pedidos");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`Alumia F3 (banco): ${certos} conferências certas.`);
