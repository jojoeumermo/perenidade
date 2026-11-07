// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote "comunidades" da Rede v2 (supabase/migracoes/2026-11-rede-comunidades.sql, itens 36 a 40 do R4) num Postgres de
// verdade dentro do Node: a semente da taxonomia (Lutas, Disciplinas, Instituto; disciplinas repetidas viram apelido da luta e os
// posts mudam de lugar), a lista e a página (visitante só vê disciplinas; fechada não existe para quem não é dela), entrar e sair
// (aberta, restrita com pedido, fechada, banido), regras, etiquetas, fixados e moderação, criação por proposta aprovada pela
// coordenação, "discutir esta aula" (sem vazar post restrito), núcleo, encontros em local público, turma do mês e permissões.
// Também confere os arquivos do pacote (textos nos seis idiomas, rotas, registro, painel). Uso: npm run testar:rede-comunidades
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { enderecoDiscutirAula, rotuloDiscutirAula } from "../lib/rede/discutir-aula.ts";
import { aulaOk, enderecosCom, mesOk } from "../lib/rede/tipos-comunidades.ts";

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

const banco = await criarBanco({ semRede: true });
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;
const lerTexto = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const fundacao = lerTexto("supabase/migracoes/2026-11-rede-fundacao.sql");
const migracao = lerTexto("supabase/migracoes/2026-11-rede-comunidades.sql");

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });
// A coordenação passa pelo segundo fator (aal2), como no resto dos testes do banco.
const daCoord = () => ({ ...como(pessoas.coord), aal: "aal2" });
const limpaLimites = () => dono("delete from interno.limites");

await espera("a fundação instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(fundacao)));

// ── As pessoas ──
const pessoas = {};
const nomes = ["coord", "educ", "mod", "membro", "membro2", "membro3", "mediacao", "acompanha", "turmista", "fora", "semconta", "menor", "banido", "invisivel", "bloqueador", "outro"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@com.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [pessoas[nome], `Companheira ${i + 1} ${nome}`, `${nome}_luta`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [pessoas.coord]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao')", [pessoas.educ]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => !["semconta", "menor", "fora"].includes(n))) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [pessoas[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [pessoas[nome]]);
}
// "fora": é da Rede e fica sem comunidade nenhuma; "semconta": 18+ declarado mas sem o consentimento; "menor": não declarou 18.
await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [pessoas.fora]);
await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [pessoas.fora]);
await dono("update interno.perfis set rede_18 = true where id = $1", [pessoas.semconta]);
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [pessoas.invisivel]);
await dono("update auth.users set created_at = now() - interval '30 days'");

// ── O cenário antigo, antes da migração: disciplinas repetidas que a fundação criou sozinha ──
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('trabalho', 'Trabalho', 'disciplinas', 'aberta', 'internet'),
  ('sindicalismo', 'Sindicalismo', 'disciplinas', 'aberta', 'internet'),
  ('feminismo', 'Feminismo', 'disciplinas', 'aberta', 'internet')`);
const postar = async (campos, autor = pessoas.membro, texto = "post do teste") => {
  const colunas = Object.keys(campos);
  const linha = await um(`insert into interno.rede_posts (autor, texto${colunas.length ? ", " : ""}${colunas.join(", ")}) values ($1, $2${colunas.map((_, i) => `, $${i + 3}`).join("")}) returning id`, [autor, texto, ...Object.values(campos)]);
  return linha.id;
};
const topicoDoForum = await postar({ comunidade: "trabalho", publico: "internet", tipo: "duvida" });
await dono("insert into interno.rede_migracao (tipo, antigo, novo) values ('topico', 'topico-antigo-1', $1)", [topicoDoForum]);
const postDaRedeAntiga = await postar({ comunidade: "trabalho", publico: "membros" });
const postDaSindicalismo = await postar({ comunidade: "sindicalismo", publico: "internet" });
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('sindicalismo', $1)", [pessoas.membro2]);
await dono("insert into interno.rede_silenciados (usuario, comunidade) values ($1, 'sindicalismo')", [pessoas.membro2]);

await espera("a migração do pacote instala sobre a fundação", () => banco.exclusivo(() => banco.pg.exec(migracao)));
const contagemInicial = await um("select (select count(*) from interno.rede_comunidades)::int as n, (select count(*) from interno.rede_comunidade_regras)::int as r, (select count(*) from interno.rede_comunidade_flairs)::int as f");
await dono("update interno.rede_comunidades set nome = 'Moradia, do jeito da moderação', descricao = 'Descrição editada pela moderação.' where slug = 'moradia'");
await espera("instalar de novo não quebra", () => banco.exclusivo(() => banco.pg.exec(migracao)));

// ── 1. A semente da taxonomia ──
await espera("a semente tem 90 comunidades: 10 lutas, 77 disciplinas e 3 do Instituto", async () => ({
  total: (await um("select count(*)::int as n from interno.rede_comunidades")).n,
  porCategoria: Object.fromEntries((await todos("select categoria, count(*)::int as n from interno.rede_comunidades group by categoria")).map((l) => [l.categoria, l.n])),
}), (r) => r.total === 90 && r.porCategoria.lutas === 10 && r.porCategoria.disciplinas === 77 && r.porCategoria.instituto === 3);
await espera("rodar a semente de novo não duplica nada (comunidades, regras e etiquetas)", async () => um("select (select count(*) from interno.rede_comunidades)::int as n, (select count(*) from interno.rede_comunidade_regras)::int as r, (select count(*) from interno.rede_comunidade_flairs)::int as f"),
  (r) => r.n === contagemInicial.n && r.r === contagemInicial.r && r.f === contagemInicial.f);
await espera("o que a moderação editou não é sobrescrito pela semente", async () => um("select nome, descricao from interno.rede_comunidades where slug = 'moradia'"), (r) => r.nome === "Moradia, do jeito da moderação" && r.descricao.startsWith("Descrição editada"));
await espera("toda comunidade nasce com 3 regras numeradas e etiquetas", async () => um(`select
  (select count(*) from interno.rede_comunidades c where (select count(*) from interno.rede_comunidade_regras r where r.comunidade = c.slug) < 3)::int as sem_regras,
  (select count(*) from interno.rede_comunidades c where not exists (select 1 from interno.rede_comunidade_flairs f where f.comunidade = c.slug))::int as sem_etiquetas`), (r) => r.sem_regras === 0 && r.sem_etiquetas === 0);
await espera("só as disciplinas são para a internet; lutas e Instituto são para membros", async () => todos("select slug from interno.rede_comunidades where (categoria = 'disciplinas') <> (publico_padrao = 'internet')"), (r) => r.length === 0);
await espera("'trabalho' virou a luta 'Trabalho e sindicato' e a disciplina saiu para 'oficios-e-trabalho'", async () => ({
  luta: await um("select categoria, nome, apelidos from interno.rede_comunidades where slug = 'trabalho'"),
  oficios: await um("select categoria, publico_padrao from interno.rede_comunidades where slug = 'oficios-e-trabalho'"),
}), (r) => r.luta.categoria === "lutas" && r.luta.nome === "Trabalho e sindicato" && r.luta.apelidos.includes("sindicalismo") && r.oficios.categoria === "disciplinas" && r.oficios.publico_padrao === "internet");
await espera("o tópico do Fórum foi para 'oficios-e-trabalho' e o post da Rede de hoje ficou na luta", async () => ({
  forum: (await um("select comunidade from interno.rede_posts where id = $1", [topicoDoForum])).comunidade,
  rede: (await um("select comunidade from interno.rede_posts where id = $1", [postDaRedeAntiga])).comunidade,
}), (r) => r.forum === "oficios-e-trabalho" && r.rede === "trabalho");
await espera("o mapa antigo → novo guarda 'trabalho' → 'oficios-e-trabalho' e 'sindicalismo' → 'trabalho'", async () => todos("select antigo, novo from interno.rede_migracao where tipo = 'comunidade' and antigo in ('trabalho', 'sindicalismo') order by antigo"),
  (r) => r.length === 2 && r[0].antigo === "sindicalismo" && r[0].novo === "trabalho" && r[1].antigo === "trabalho" && r[1].novo === "oficios-e-trabalho");
await espera("a disciplina repetida sumiu: posts e adesões passaram para a luta", async () => ({
  sobrou: (await um("select count(*)::int as n from interno.rede_comunidades where slug = 'sindicalismo'")).n,
  post: (await um("select comunidade from interno.rede_posts where id = $1", [postDaSindicalismo])).comunidade,
  membro: (await um("select count(*)::int as n from interno.rede_comunidade_membros where comunidade = 'trabalho' and usuario = $1", [pessoas.membro2])).n,
}), (r) => r.sobrou === 0 && r.post === "trabalho" && r.membro === 1);
await espera("quem silenciou a disciplina repetida continua com a luta silenciada", async () => (await um("select count(*)::int as n from interno.rede_silenciados where usuario = $1 and comunidade = 'trabalho'", [pessoas.membro2])).n, (n) => n === 1);
await espera("o endereço antigo (apelido) abre a comunidade nova", async () => (await rpc(como(pessoas.membro), "rede_comunidade", { p_slug: "sindicalismo" })).slug, (s) => s === "trabalho");
await espera("'feminismo' (disciplina e luta com o mesmo slug) virou uma só, na categoria das lutas", async () => um("select categoria, publico_padrao, tipo from interno.rede_comunidades where slug = 'feminismo'"), (r) => r.categoria === "lutas" && r.publico_padrao === "membros" && r.tipo === "aberta");
await espera("o Instituto: avisos da coordenação é restrita, sugestões e ajuda são abertas", async () => todos("select slug, tipo from interno.rede_comunidades where categoria = 'instituto' order by slug"),
  (r) => r.map((x) => `${x.slug}:${x.tipo}`).join() === "ajuda:aberta,avisos-da-coordenacao:restrita,sugestoes:aberta");

// ── 2. Lista e página ──
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('fechada-teste', 'Fechada do teste', 'lutas', 'fechada', 'comunidade'), ('restrita-teste', 'Restrita do teste', 'lutas', 'restrita', 'membros')");
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('fechada-teste', $1, 'membro'), ('restrita-teste', $1, 'membro'), ('restrita-teste', $2, 'moderacao'), ('avisos-da-coordenacao', $2, 'moderacao'), ('moradia', $2, 'moderacao'), ('matematica', $2, 'moderacao')", [pessoas.membro3, pessoas.mod]);
const nomesDaLista = async (quem) => (await rpc(quem, "rede_com_lista")).itens;
await espera("visitante vê só as comunidades das disciplinas, nenhuma fechada", async () => nomesDaLista(visitante()), (itens) => itens.length === 77 && itens.every((i) => i.categoria === "disciplinas" && i.tipo !== "fechada"));
await espera("a lista não traz contagem de membros nem quem é de quê", async () => Object.keys((await nomesDaLista(como(pessoas.membro)))[0]).sort().join(), (k) => k === "categoria,cor,descricao,icone,nome,situacao,slug,tipo");
await espera("membro vê lutas, disciplinas e Instituto; a fechada só aparece para quem é dela", async () => ({
  de_fora: (await nomesDaLista(como(pessoas.membro))).map((i) => i.slug),
  de_dentro: (await nomesDaLista(como(pessoas.membro3))).map((i) => i.slug),
}), (r) => !r.de_fora.includes("fechada-teste") && r.de_dentro.includes("fechada-teste") && r.de_fora.includes("moradia") && r.de_fora.includes("avisos-da-coordenacao") && r.de_fora.includes("restrita-teste"));
await espera("a lista marca a situação de quem pergunta (membro) e mais ninguém vê a de outros", async () => (await nomesDaLista(como(pessoas.membro3))).filter((i) => i.situacao === "membro").map((i) => i.slug).sort().join(),
  (s) => s === "fechada-teste,restrita-teste");
await recusa("visitante não abre página de luta", () => rpc(visitante(), "rede_com_pagina", { p_slug: "moradia" }), "entre_primeiro");
await espera("visitante abre página de disciplina, com regras e etiquetas", async () => rpc(visitante(), "rede_com_pagina", { p_slug: "matematica" }),
  (p) => p.comunidade.slug === "matematica" && p.comunidade.regras.length === 3 && p.comunidade.etiquetas.length === 4 && p.situacao === null && p.modero === false && p.pedidos === null);
await recusa("comunidade fechada não existe para quem não é dela", () => rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "fechada-teste" }), "nao_encontrado");
await espera("a moderação aparece por codinome, nunca por nome ou código", async () => {
  const p = await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "moradia" });
  return JSON.stringify(p.comunidade.moderacao) + JSON.stringify(p).includes(pessoas.mod);
}, (r) => r.includes("Companheira") && r.endsWith("false"));
await espera("só a moderação vê quantos pedidos esperam", async () => {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('moradia', $1, 'pendente')", [pessoas.outro]);
  const moderador = await rpc(como(pessoas.mod), "rede_com_pagina", { p_slug: "moradia" });
  const comum = await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "moradia" });
  await dono("delete from interno.rede_comunidade_membros where comunidade = 'moradia' and usuario = $1", [pessoas.outro]);
  return [moderador.modero, moderador.pedidos, comum.modero, comum.pedidos];
}, (r) => r[0] === true && r[1] === 1 && r[2] === false && r[3] === null);

// ── 3. Entrar e sair ──
await recusa("visitante não entra em comunidade", () => rpc(visitante(), "rede_com_entrar", { p_slug: "matematica" }), "permission denied");
await recusa("quem não declarou 18 anos não entra", () => rpc(como(pessoas.menor), "rede_com_entrar", { p_slug: "matematica" }), "confirme_idade");
await recusa("quem não deu o consentimento não entra", () => rpc(como(pessoas.semconta), "rede_com_entrar", { p_slug: "matematica" }), "consentimento");
await espera("comunidade aberta: entra na hora, e entrar de novo não muda nada", async () => {
  const a = await rpc(como(pessoas.membro), "rede_com_entrar", { p_slug: "moradia" });
  const b = await rpc(como(pessoas.membro), "rede_com_entrar", { p_slug: "moradia" });
  const p = await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "moradia" });
  return [a.situacao, b.situacao, p.situacao, (await um("select count(*)::int as n from interno.rede_comunidade_membros where comunidade = 'moradia' and usuario = $1", [pessoas.membro])).n];
}, (r) => r[0] === "membro" && r[1] === "membro" && r[2] === "membro" && r[3] === 1);
await espera("entrar pelo apelido antigo vale para a comunidade nova", async () => (await rpc(como(pessoas.membro), "rede_com_entrar", { p_slug: "sindicalismo" })).situacao, (s) => s === "membro");
await recusa("comunidade fechada: ninguém entra pedindo", () => rpc(como(pessoas.membro), "rede_com_entrar", { p_slug: "fechada-teste" }), "nao_encontrado");
await espera("comunidade restrita: o pedido fica pendente e a moderação recebe aviso", async () => {
  const r = await rpc(como(pessoas.membro), "rede_com_entrar", { p_slug: "restrita-teste" });
  const aviso = await um("select count(*)::int as n from interno.avisos where para = $1 and categoria = 'rede' and texto like '%Restrita do teste%'", [pessoas.mod]);
  return [r.situacao, aviso.n];
}, (r) => r[0] === "pendente" && r[1] === 1);
await espera("pendente não vê o que é só da comunidade e ainda não escreve", async () => {
  const post = await postar({ comunidade: "restrita-teste", publico: "comunidade" }, pessoas.membro3);
  return (await um("select interno.rede_ve(p, $2) as v from interno.rede_posts p where p.id = $1", [post, pessoas.membro])).v;
}, (v) => v === false);
await recusa("quem não modera não vê os pedidos", () => rpc(como(pessoas.membro), "rede_com_pedidos", { p_slug: "restrita-teste" }), "sem_permissao");
await espera("a moderação vê o codinome de quem pediu, e só", async () => {
  const r = await rpc(como(pessoas.mod), "rede_com_pedidos", { p_slug: "restrita-teste" });
  return [r.itens.length, Object.keys(r.itens[0]).sort().join(), r.itens[0].codinome];
}, (r) => r[0] === 1 && r[1] === "codinome,quando,usuario" && r[2].includes("membro"));
await recusa("quem não modera não decide pedido", () => rpc(como(pessoas.membro), "rede_com_decidir_pedido", { p_slug: "restrita-teste", p_usuario: pessoas.membro, p_aceita: true }), "sem_permissao");
await espera("aceitar o pedido: vira membro e recebe aviso", async () => {
  await rpc(como(pessoas.mod), "rede_com_decidir_pedido", { p_slug: "restrita-teste", p_usuario: pessoas.membro, p_aceita: true });
  const p = await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "restrita-teste" });
  const aviso = await um("select count(*)::int as n from interno.avisos where para = $1 and texto like 'Você entrou em%'", [pessoas.membro]);
  return [p.situacao, aviso.n];
}, (r) => r[0] === "membro" && r[1] === 1);
await espera("recusar o pedido: some, e a pessoa é avisada", async () => {
  await rpc(como(pessoas.membro2), "rede_com_entrar", { p_slug: "restrita-teste" });
  await rpc(como(pessoas.mod), "rede_com_decidir_pedido", { p_slug: "restrita-teste", p_usuario: pessoas.membro2, p_aceita: false });
  const p = await rpc(como(pessoas.membro2), "rede_com_pagina", { p_slug: "restrita-teste" });
  return p.situacao;
}, (s) => s === null);
await espera("desistir do pedido apaga o pedido", async () => {
  await rpc(como(pessoas.membro2), "rede_com_entrar", { p_slug: "restrita-teste" });
  await rpc(como(pessoas.membro2), "rede_com_sair", { p_slug: "restrita-teste" });
  return (await um("select count(*)::int as n from interno.rede_comunidade_membros where comunidade = 'restrita-teste' and usuario = $1", [pessoas.membro2])).n;
}, (n) => n === 0);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('moradia', $1, 'banido')", [pessoas.banido]);
await recusa("banido não entra de novo", () => rpc(como(pessoas.banido), "rede_com_entrar", { p_slug: "moradia" }), "sem_permissao");
await espera("banido que 'sai' continua banido (a linha do banimento fica)", async () => {
  await rpc(como(pessoas.banido), "rede_com_sair", { p_slug: "moradia" });
  return (await um("select situacao from interno.rede_comunidade_membros where comunidade = 'moradia' and usuario = $1", [pessoas.banido])).situacao;
}, (s) => s === "banido");
await espera("sair da comunidade tira a pessoa dela", async () => {
  await rpc(como(pessoas.membro), "rede_com_sair", { p_slug: "moradia" });
  return (await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "moradia" })).situacao;
}, (s) => s === null);
await espera("quem escreve numa comunidade aberta usa as etiquetas da semente (integração com rede_publicar)", async () => {
  await limpaLimites();
  const r = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "Aluguel subiu de novo no bairro", comunidade: "moradia", flair: "Notícia" } });
  return [r.comunidade, r.flair, r.publico];
}, (r) => r[0] === "moradia" && r[1] === "Notícia" && r[2] === "membros");

// ── 4. Regras, etiquetas, fixados e moderadores ──
await recusa("quem não modera não troca as regras", () => rpc(como(pessoas.membro), "rede_com_regras_salvar", { p_slug: "moradia", p_regras: [{ titulo: "Regra única", texto: "" }] }), "sem_permissao");
await recusa("sem nenhuma regra não vale", () => rpc(como(pessoas.mod), "rede_com_regras_salvar", { p_slug: "moradia", p_regras: [] }), "invalido:regras");
await recusa("regra com título curto não vale", () => rpc(como(pessoas.mod), "rede_com_regras_salvar", { p_slug: "moradia", p_regras: [{ titulo: "Oi", texto: "" }] }), "invalido:regras");
await recusa("mais de 20 regras não valem", () => rpc(como(pessoas.mod), "rede_com_regras_salvar", { p_slug: "moradia", p_regras: Array.from({ length: 21 }, (_, i) => ({ titulo: `Regra número ${i + 1}`, texto: "" })) }), "invalido:regras");
await espera("a moderação troca as regras e elas saem numeradas na ordem", async () => {
  await rpc(como(pessoas.mod), "rede_com_regras_salvar", { p_slug: "moradia", p_regras: [{ titulo: "Primeira regra", texto: "Explicação um." }, { titulo: "Segunda regra", texto: "" }] });
  return (await rpc(como(pessoas.membro), "rede_comunidade", { p_slug: "moradia" })).regras.map((r) => `${r.numero}:${r.titulo}`).join();
}, (s) => s === "1:Primeira regra,2:Segunda regra");
await espera("quem cuida da comunidade em geral (educação) também edita, e fica no registro de atividades", async () => {
  await rpc(como(pessoas.educ), "rede_com_regras_salvar", { p_slug: "moradia", p_regras: [{ titulo: "Regra da educação", texto: "" }] });
  return (await um("select count(*)::int as n from interno.auditoria where acao = 'rede_com_regras' and alvo = 'moradia'")).n;
}, (n) => n === 2);
await recusa("cor de etiqueta inválida não vale", () => rpc(como(pessoas.mod), "rede_com_etiquetas_salvar", { p_slug: "moradia", p_etiquetas: [{ nome: "Aluguel", cor: "vermelho" }] }), "invalido:etiquetas");
await recusa("mais de 12 etiquetas não valem", () => rpc(como(pessoas.mod), "rede_com_etiquetas_salvar", { p_slug: "moradia", p_etiquetas: Array.from({ length: 13 }, (_, i) => ({ nome: `Etiqueta ${i + 1}` })) }), "invalido:etiquetas");
await recusa("quem não modera não troca etiquetas", () => rpc(como(pessoas.membro), "rede_com_etiquetas_salvar", { p_slug: "moradia", p_etiquetas: [{ nome: "Aluguel" }] }), "sem_permissao");
await espera("a moderação troca as etiquetas e o post passa a aceitar a nova", async () => {
  await rpc(como(pessoas.mod), "rede_com_etiquetas_salvar", { p_slug: "moradia", p_etiquetas: [{ nome: "Aluguel", cor: "#C21F16" }, { nome: "Despejo" }] });
  const e = (await rpc(como(pessoas.membro), "rede_comunidade", { p_slug: "moradia" })).etiquetas;
  await limpaLimites();
  const r = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "Despejo marcado na rua de baixo", comunidade: "moradia", flair: "Despejo" } });
  return [e.map((x) => `${x.nome}:${x.cor}`).join(), r.flair];
}, (r) => r[0] === "Aluguel:#c21f16,Despejo:" && r[1] === "Despejo");
const doMoradia = await postar({ comunidade: "moradia", publico: "membros" });
const doMoradia2 = await postar({ comunidade: "moradia", publico: "membros" });
const doMoradia3 = await postar({ comunidade: "moradia", publico: "membros" });
const doMoradia4 = await postar({ comunidade: "moradia", publico: "membros" });
const deOutraComunidade = await postar({ comunidade: "ajuda", publico: "membros" });
await recusa("quem não modera não fixa", () => rpc(como(pessoas.membro), "rede_com_fixar", { p_slug: "moradia", p_post: doMoradia, p_sim: true }), "sem_permissao");
await recusa("não se fixa post de outra comunidade", () => rpc(como(pessoas.mod), "rede_com_fixar", { p_slug: "moradia", p_post: deOutraComunidade, p_sim: true }), "nao_encontrado");
await espera("fixar até 3 posts: aparecem na página, no registro de moderação, e o quarto é recusado", async () => {
  for (const p of [doMoradia, doMoradia2, doMoradia3]) await rpc(como(pessoas.mod), "rede_com_fixar", { p_slug: "moradia", p_post: p, p_sim: true });
  let quarto = "passou";
  try {
    await rpc(como(pessoas.mod), "rede_com_fixar", { p_slug: "moradia", p_post: doMoradia4, p_sim: true });
  } catch (e) {
    quarto = e.message;
  }
  const pagina = await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "moradia" });
  const registro = await um("select count(*)::int as n from interno.rede_moderacao where acao = 'fixar' and alvo_tipo = 'post' and quem = $1", [pessoas.mod]);
  return [pagina.fixados.length, pagina.fixados.every((f) => f.fixado === true), quarto.includes("invalido:limite_de_fixados"), registro.n];
}, (r) => r[0] === 3 && r[1] && r[2] && r[3] === 3);
await espera("soltar um fixado libera o lugar", async () => {
  await rpc(como(pessoas.mod), "rede_com_fixar", { p_slug: "moradia", p_post: doMoradia, p_sim: false });
  await rpc(como(pessoas.mod), "rede_com_fixar", { p_slug: "moradia", p_post: doMoradia4, p_sim: true });
  return (await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "moradia" })).fixados.map((f) => f.id).sort().join();
}, (s) => s === [doMoradia2, doMoradia3, doMoradia4].sort().join());
await espera("post removido ou retido não se fixa", async () => {
  const oculto = await postar({ comunidade: "moradia", publico: "membros", oculto: true });
  try {
    await rpc(como(pessoas.mod), "rede_com_fixar", { p_slug: "moradia", p_post: oculto, p_sim: true });
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => m.includes("nao_encontrado"));
await espera("a página não entrega fixado que a pessoa não pode ver (matriz de visibilidade)", async () => {
  const soDaComunidade = await postar({ comunidade: "restrita-teste", publico: "comunidade", fixado: true }, pessoas.membro3);
  const deFora = (await rpc(como(pessoas.fora), "rede_com_pagina", { p_slug: "restrita-teste" })).fixados.map((f) => f.id);
  const deDentro = (await rpc(como(pessoas.membro3), "rede_com_pagina", { p_slug: "restrita-teste" })).fixados.map((f) => f.id);
  return [deFora.includes(soDaComunidade), deDentro.includes(soDaComunidade)];
}, (r) => r[0] === false && r[1] === true);
await recusa("só a coordenação define moderação", () => rpc(como(pessoas.mod), "rede_com_moderacao_definir", { p_slug: "ajuda", p_usuario: pessoas.membro, p_sim: true }), "sem_permissao");
await recusa("moderador tem de ser da Rede", () => rpc(daCoord(), "rede_com_moderacao_definir", { p_slug: "ajuda", p_usuario: pessoas.menor, p_sim: true }), "invalido:moderador");
await espera("a coordenação põe e tira moderação; a pessoa é avisada e passa a ver as ferramentas", async () => {
  await rpc(daCoord(), "rede_com_moderacao_definir", { p_slug: "ajuda", p_usuario: pessoas.membro2, p_sim: true });
  const com = await rpc(como(pessoas.membro2), "rede_com_pagina", { p_slug: "ajuda" });
  const aviso = (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like 'Você agora modera%'", [pessoas.membro2])).n;
  await rpc(daCoord(), "rede_com_moderacao_definir", { p_slug: "ajuda", p_usuario: pessoas.membro2, p_sim: false });
  const sem = await rpc(como(pessoas.membro2), "rede_com_pagina", { p_slug: "ajuda" });
  return [com.modero, aviso, sem.modero];
}, (r) => r[0] === true && r[1] === 1 && r[2] === false);
await recusa("só quem cuida liga trilhas e aulas à comunidade", () => rpc(como(pessoas.mod), "rede_com_trilhas_salvar", { p_slug: "matematica", p_trilhas: ["algebra"], p_aulas: [] }), "sem_permissao");
await recusa("trilha com nome inválido não vale", () => rpc(como(pessoas.educ), "rede_com_trilhas_salvar", { p_slug: "matematica", p_trilhas: ["Algebra!"], p_aulas: [] }), "invalido:trilhas");
await espera("trilhas e aulas ligadas saem na página da comunidade", async () => {
  await rpc(como(pessoas.educ), "rede_com_trilhas_salvar", { p_slug: "matematica", p_trilhas: ["matematica-basica"], p_aulas: ["matematica-basica/fracoes"] });
  const c = (await rpc(visitante(), "rede_com_pagina", { p_slug: "matematica" })).comunidade;
  return [c.trilhas.join(), c.aulas.join()];
}, (r) => r[0] === "matematica-basica" && r[1] === "matematica-basica/fracoes");

// ── 5. Comunidade nova só por proposta ──
await limpaLimites();
const proposta = (extra = {}) => ({ slug: "horta-comunitaria", nome: "Horta comunitária", objetivo: "Trocar saberes e sementes das hortas de bairro, com cuidado e sem vender nada.", regras: "Respeito sempre\nNada de venda\nFonte quando afirmar um fato", moderadores: ["membro_luta", "membro2_luta"], ...extra });
await recusa("visitante não propõe", () => rpc(visitante(), "rede_com_propor", { p: proposta() }), "permission denied");
await recusa("quem não deu o consentimento não propõe", () => rpc(como(pessoas.semconta), "rede_com_propor", { p: proposta() }), "consentimento");
for (const [nome, extra, codigo] of [
  ["endereço já usado por uma comunidade", { slug: "moradia" }, "invalido:slug"],
  ["endereço que é apelido antigo", { slug: "sindicalismo" }, "invalido:slug"],
  ["endereço com espaço e pontuação", { slug: "Horta Boa!" }, "invalido:slug"],
  ["endereço reservado às turmas", { slug: "turma-do-bairro" }, "invalido:slug"],
  ["objetivo curto demais", { objetivo: "Curto." }, "invalido:objetivo"],
  ["regras curtas demais", { regras: "Nada." }, "invalido:regras"],
  ["um moderador só", { moderadores: ["membro_luta"] }, "invalido:moderadores"],
  ["o mesmo moderador duas vezes", { moderadores: ["membro_luta", "@MEMBRO_luta"] }, "invalido:moderadores"],
  ["moderador que não existe", { moderadores: ["membro_luta", "ninguem_aqui"] }, "invalido:moderadores"],
  ["moderador que não é da Rede", { moderadores: ["membro_luta", "semconta_luta"] }, "invalido:moderadores"],
  ["moderador com perfil invisível", { moderadores: ["membro_luta", "invisivel_luta"] }, "invalido:moderadores"],
]) {
  await limpaLimites();
  await recusa(`proposta recusada: ${nome}`, () => rpc(como(pessoas.membro), "rede_com_propor", { p: proposta(extra) }), codigo);
}
await espera("quem bloqueou o indicado não pode indicá-lo", async () => {
  await limpaLimites();
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.membro, pessoas.outro]);
  try {
    await rpc(como(pessoas.membro), "rede_com_propor", { p: proposta({ moderadores: ["membro_luta", "outro_luta"] }) });
    return "passou";
  } catch (e) {
    return e.message;
  } finally {
    await dono("delete from interno.rede_bloqueios");
  }
}, (m) => m.includes("invalido:moderadores"));
let propostaId;
await espera("proposta válida (a pessoa pode ser uma das moderadoras) fica aberta e avisa a coordenação", async () => {
  await limpaLimites();
  const r = await rpc(como(pessoas.membro), "rede_com_propor", { p: proposta() });
  propostaId = r.id;
  const aviso = (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%Horta comunitária%'", [pessoas.coord])).n;
  return [r.situacao, aviso];
}, (r) => r[0] === "aberta" && r[1] === 1);
await espera("o mesmo endereço não pode ter duas propostas abertas", async () => {
  await limpaLimites();
  try {
    await rpc(como(pessoas.membro3), "rede_com_propor", { p: proposta({ moderadores: ["membro3_luta", "outro_luta"] }) });
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => m.includes("invalido:slug"));
await espera("limite de 3 propostas por dia por pessoa", async () => {
  await limpaLimites();
  const resultados = [];
  for (let i = 0; i < 4; i++) {
    try {
      await rpc(como(pessoas.outro), "rede_com_propor", { p: proposta({ slug: `comunidade-extra-${i}`, nome: `Comunidade extra ${i}`, moderadores: ["outro_luta", "mod_luta"] }) });
      resultados.push("ok");
    } catch (e) {
      resultados.push(e.message.includes("muitos_pedidos") ? "limite" : e.message);
    }
  }
  return resultados.join();
}, (s) => s === "ok,ok,ok,limite");
await espera("cada pessoa só vê as próprias propostas", async () => ({
  minhas: (await rpc(como(pessoas.membro), "rede_com_minhas_propostas")).itens.map((i) => i.slug),
  alheias: (await rpc(como(pessoas.membro3), "rede_com_minhas_propostas")).itens.length,
}), (r) => r.minhas.join() === "horta-comunitaria" && r.alheias === 0);
await recusa("quem não é da coordenação não lê a fila", () => rpc(como(pessoas.mod), "rede_com_propostas_fila"), "sem_permissao");
await recusa("educação também não lê a fila (só coordenação decide)", () => rpc(como(pessoas.educ), "rede_com_propostas_fila"), "sem_permissao");
await espera("a fila da coordenação mostra codinome, nunca nome, e-mail ou código de pessoa", async () => {
  const f = await rpc(daCoord(), "rede_com_propostas_fila");
  const texto = JSON.stringify(f);
  const horta = f.itens.find((i) => i.slug === "horta-comunitaria");
  return [horta.autor.startsWith("Companheira"), horta.moderadores.length, horta.situacao, texto.includes("@com.local"), Object.values(pessoas).some((id) => texto.includes(id))];
}, (r) => r[0] && r[1] === 2 && r[2] === "aberta" && r[3] === false && r[4] === false);
await recusa("quem não é da coordenação não decide", () => rpc(como(pessoas.mod), "rede_com_decidir", { p_id: propostaId, p_aprova: true }), "sem_permissao");
await recusa("recusar pede o motivo", () => rpc(daCoord(), "rede_com_decidir", { p_id: propostaId, p_aprova: false, p_motivo: "não" }), "invalido:motivo");
await espera("recusar com motivo: situação, aviso com o motivo e nenhuma comunidade criada", async () => {
  await limpaLimites();
  const r0 = await rpc(como(pessoas.membro3), "rede_com_propor", { p: proposta({ slug: "proposta-recusada", nome: "Proposta recusada", moderadores: ["membro3_luta", "outro_luta"] }) });
  const r = await rpc(daCoord(), "rede_com_decidir", { p_id: r0.id, p_aprova: false, p_motivo: "Já existe uma comunidade parecida: Moradia." });
  const minha = (await rpc(como(pessoas.membro3), "rede_com_minhas_propostas")).itens[0];
  const aviso = (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%não foi aprovada%'", [pessoas.membro3])).n;
  const criada = (await um("select count(*)::int as n from interno.rede_comunidades where slug = 'proposta-recusada'")).n;
  return [r.situacao, minha.situacao, minha.motivo.startsWith("Já existe"), aviso, criada];
}, (r) => r[0] === "recusada" && r[1] === "recusada" && r[2] && r[3] === 1 && r[4] === 0);
await espera("aprovar cria a comunidade: aberta, entre as lutas, só para membros, regras por linha, moderadores e autora dentro", async () => {
  const r = await rpc(daCoord(), "rede_com_decidir", { p_id: propostaId, p_aprova: true });
  const c = await um("select categoria, tipo, publico_padrao, criada_por from interno.rede_comunidades where slug = 'horta-comunitaria'");
  const regras = (await todos("select numero, titulo from interno.rede_comunidade_regras where comunidade = 'horta-comunitaria' order by numero")).map((x) => x.titulo);
  const mods = (await todos("select usuario from interno.rede_comunidade_membros where comunidade = 'horta-comunitaria' and papel = 'moderacao' and situacao = 'ativo'")).map((x) => x.usuario).sort();
  const autora = (await um("select papel from interno.rede_comunidade_membros where comunidade = 'horta-comunitaria' and usuario = $1", [pessoas.membro])).papel;
  const etiquetas = (await um("select count(*)::int as n from interno.rede_comunidade_flairs where comunidade = 'horta-comunitaria'")).n;
  const aviso = (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%Horta comunitária%' and texto like '%moderar%'", [pessoas.membro2])).n;
  return [r.situacao, r.slug, c.categoria, c.tipo, c.publico_padrao, c.criada_por === pessoas.membro, regras.join("|"), mods.join() === [pessoas.membro, pessoas.membro2].sort().join(), autora, etiquetas, aviso];
}, (r) => r[0] === "aprovada" && r[1] === "horta-comunitaria" && r[2] === "lutas" && r[3] === "aberta" && r[4] === "membros" && r[5] && r[6] === "Respeito sempre|Nada de venda|Fonte quando afirmar um fato" && r[7] && r[8] === "moderacao" && r[9] === 4 && r[10] === 1);
await recusa("proposta já decidida não se decide de novo", () => rpc(daCoord(), "rede_com_decidir", { p_id: propostaId, p_aprova: true }), "nao_encontrado");
await espera("a nova comunidade já funciona: moderadora vê as ferramentas, membro da Rede entra e escreve", async () => {
  const p = await rpc(como(pessoas.membro2), "rede_com_pagina", { p_slug: "horta-comunitaria" });
  const entrou = await rpc(como(pessoas.membro3), "rede_com_entrar", { p_slug: "horta-comunitaria" });
  await limpaLimites();
  const post = await rpc(como(pessoas.membro3), "rede_publicar", { p: { texto: "Quem tem muda de manjericão?", comunidade: "horta-comunitaria", flair: "Pedido de ajuda" } });
  return [p.modero, entrou.situacao, post.comunidade];
}, (r) => r[0] === true && r[1] === "membro" && r[2] === "horta-comunitaria");
await espera("endereço tomado depois da proposta: a aprovação é recusada", async () => {
  await limpaLimites();
  const r0 = await rpc(como(pessoas.membro3), "rede_com_propor", { p: proposta({ slug: "endereco-disputado", nome: "Endereço disputado", moderadores: ["membro3_luta", "outro_luta"] }) });
  await dono("insert into interno.rede_comunidades (slug, nome, categoria) values ('endereco-disputado', 'Já existe', 'lutas')");
  try {
    await rpc(daCoord(), "rede_com_decidir", { p_id: r0.id, p_aprova: true });
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => m.includes("invalido:slug"));

// ── 6. Discutir esta aula ──
const AULA = "matematica-basica/fracoes";
await limpaLimites();
const postAula = async (autor, texto, extra = {}) => {
  const r = await rpc(como(autor), "rede_publicar", { p: { texto, comunidade: "matematica", ...extra } });
  return r.id;
};
const p1 = await postAula(pessoas.membro, "Não entendi a soma de frações com denominadores diferentes");
await recusa("só o autor liga o próprio post a uma aula", () => rpc(como(pessoas.membro2), "rede_com_ligar_aula", { p_post: p1, p_aula: AULA, p_titulo: "Frações" }), "nao_encontrado");
await recusa("aula com formato inválido não liga", () => rpc(como(pessoas.membro), "rede_com_ligar_aula", { p_post: p1, p_aula: "../etc/passwd" }), "invalido:aula");
await espera("o autor liga o post à aula (citação) e a linha da aula mostra só os ligados", async () => {
  await rpc(como(pessoas.membro), "rede_com_ligar_aula", { p_post: p1, p_aula: AULA, p_titulo: "Frações" });
  await limpaLimites();
  const solto = await postAula(pessoas.membro, "Um post sobre outra coisa na mesma comunidade");
  const linha = await rpc(como(pessoas.membro2), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: AULA });
  const outraAula = await rpc(como(pessoas.membro2), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: "matematica-basica/decimais" });
  return [linha.itens.map((i) => i.id).join() === p1, linha.itens[0].cita.caminho, linha.itens[0].cita.titulo, outraAula.itens.length, linha.itens.some((i) => i.id === solto)];
}, (r) => r[0] && r[1] === "/trilhas/matematica-basica/fracoes" && r[2] === "Frações" && r[3] === 0 && r[4] === false);
await recusa("não se troca a citação que já existe", () => rpc(como(pessoas.membro), "rede_com_ligar_aula", { p_post: p1, p_aula: "matematica-basica/decimais" }), "invalido:aula");
await espera("a linha da aula é aberta ao visitante nas disciplinas", async () => (await rpc(visitante(), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: AULA })).itens.length, (n) => n === 1);
await espera("a linha da aula também abre para quem tem conta", async () => (await rpc(como(pessoas.membro), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: AULA })).itens.length, (n) => n === 1);
await recusa("linha de aula numa luta pede conta", () => rpc(visitante(), "rede_com_aula_linha", { p_comunidade: "moradia", p_aula: AULA }), "entre_primeiro");
await recusa("linha de aula numa comunidade fechada não existe para quem não é dela", () => rpc(como(pessoas.membro), "rede_com_aula_linha", { p_comunidade: "fechada-teste", p_aula: AULA }), "nao_encontrado");
await recusa("aula com formato inválido na linha", () => rpc(como(pessoas.membro), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: "so-um-pedaco" }), "invalido:aula");
await espera("post restrito ligado a uma aula não aparece para quem não pode ver (matriz de visibilidade)", async () => {
  const restrito = await postar({ comunidade: "restrita-teste", publico: "comunidade", cita: JSON.stringify({ tipo: "aula", caminho: "/trilhas/matematica-basica/fracoes", titulo: "x" }) }, pessoas.membro3);
  const deFora = (await rpc(como(pessoas.fora), "rede_com_aula_linha", { p_comunidade: "restrita-teste", p_aula: AULA })).itens.map((i) => i.id);
  const deDentro = (await rpc(como(pessoas.membro3), "rede_com_aula_linha", { p_comunidade: "restrita-teste", p_aula: AULA })).itens.map((i) => i.id);
  return [deFora.includes(restrito), deDentro.includes(restrito)];
}, (r) => r[0] === false && r[1] === true);
await espera("bloqueio vale na linha da aula, nos dois sentidos", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.bloqueador, pessoas.membro]);
  const r = (await rpc(como(pessoas.bloqueador), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: AULA })).itens.length;
  await dono("delete from interno.rede_bloqueios");
  return r;
}, (n) => n === 0);
await espera("a linha da aula pagina por cursor sem repetir nem pular", async () => {
  await dono("update interno.perfis set rede_codinome_ok = true where id = $1", [pessoas.membro2]);
  const ids = [p1];
  for (let i = 0; i < 4; i++) {
    await limpaLimites();
    const id = await postAula(pessoas.membro2, `Mais uma dúvida sobre frações, número ${i}`);
    await dono("update interno.rede_posts set criado_em = now() + ($2 || ' minutes')::interval where id = $1", [id, String(i + 1)]);
    await rpc(como(pessoas.membro2), "rede_com_ligar_aula", { p_post: id, p_aula: AULA, p_titulo: "Frações" });
    ids.push(id);
  }
  const vistos = [];
  let cursor = null;
  let paginas = 0;
  do {
    const r = await rpc(como(pessoas.membro), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: AULA, p_cursor: cursor, p_limite: 2 });
    vistos.push(...r.itens.map((i) => i.id));
    cursor = r.proximo;
    paginas++;
  } while (cursor && paginas < 10);
  return [vistos.length, new Set(vistos).size, paginas, vistos[vistos.length - 1] === p1];
}, (r) => r[0] === 5 && r[1] === 5 && r[2] === 3 && r[3]);
await recusa("cursor estragado é recusado", () => rpc(como(pessoas.membro), "rede_com_aula_linha", { p_comunidade: "matematica", p_aula: AULA, p_cursor: "lixo|lixo" }), "invalido:cursor");

// ── 7. Núcleo e encontros ──
const nucleoPublico = (await um("insert into interno.nucleos (nome, cidade, uf, acompanha) values ('Núcleo do Fonseca', 'Niterói', 'RJ', $1) returning id", [pessoas.acompanha])).id;
let nucleo;
await recusa("quem não acompanha o núcleo nem é da coordenação não abre o espaço", () => rpc(como(pessoas.membro), "rede_com_nucleo_abrir", { p_nucleo: nucleoPublico }), "sem_permissao");
await recusa("núcleo que não existe", () => rpc(daCoord(), "rede_com_nucleo_abrir", { p_nucleo: "00000000-0000-0000-0000-000000000000" }), "nao_encontrado");
await espera("quem acompanha abre o espaço e vira mediação; abrir de novo devolve o mesmo", async () => {
  const a = await rpc(como(pessoas.acompanha), "rede_com_nucleo_abrir", { p_nucleo: nucleoPublico });
  const b = await rpc(daCoord(), "rede_com_nucleo_abrir", { p_nucleo: nucleoPublico });
  nucleo = a.id;
  const papel = (await um("select papel from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [nucleo, pessoas.acompanha])).papel;
  const ligado = (await um("select nome, cidade from interno.rede_nucleos where id = $1", [nucleo]));
  return [a.id === b.id, papel, ligado.nome, ligado.cidade];
}, (r) => r[0] && r[1] === "mediacao" && r[2] === "Núcleo do Fonseca" && r[3] === "Niterói");
if (!nucleo) {
  // Sem o espaço do núcleo, o resto desta seção não tem o que provar: mostra o que falhou até aqui e para.
  console.log(`Rede v2 (comunidades): ${certos} certos, ${falhas.length} falhas.\n${falhas.map((f) => `  ✗ ${f}`).join("\n")}`);
  process.exit(1);
}
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro')", [nucleo, pessoas.membro]);
await espera("cada pessoa lista só os próprios núcleos", async () => ({
  meu: (await rpc(como(pessoas.membro), "rede_com_nucleos")).itens.map((n) => n.nome),
  alheio: (await rpc(como(pessoas.membro2), "rede_com_nucleos")).itens.length,
}), (r) => r.meu.join() === "Núcleo do Fonseca" && r.alheio === 0);
await recusa("quem não é do núcleo não abre a página (nem a coordenação)", () => rpc(daCoord(), "rede_com_nucleo", { p_id: nucleo }), "nao_encontrado");
await espera("a página do núcleo mostra a mediação por codinome, sem código de pessoa", async () => {
  const p = await rpc(como(pessoas.membro), "rede_com_nucleo", { p_id: nucleo });
  return [p.papel, p.mediacao.join().startsWith("Companheira"), JSON.stringify(p).includes(pessoas.acompanha)];
}, (r) => r[0] === "membro" && r[1] && r[2] === false);
let postNucleo;
let postNucleoDaMediacao;
await espera("o mural do núcleo: post com público 'nucleo' só aparece para quem é do núcleo", async () => {
  await limpaLimites();
  const r = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "Reunião do núcleo, quem leva o café?", publico: "nucleo", nucleo } });
  postNucleo = r.id;
  const dentro = (await rpc(como(pessoas.acompanha), "rede_com_nucleo_linha", { p_id: nucleo })).itens.map((i) => i.id);
  postNucleoDaMediacao = await postar({ publico: "nucleo", nucleo }, pessoas.acompanha);
  const nenhumPost = (await rpc(como(pessoas.fora), "rede_linha", { p_aba: "tudo" })).itens.some((i) => i.id === r.id);
  return [r.publico, dentro.includes(r.id), nenhumPost];
}, (r) => r[0] === "nucleo" && r[1] && r[2] === false);
await recusa("o mural não abre para quem não é do núcleo", () => rpc(como(pessoas.membro2), "rede_com_nucleo_linha", { p_id: nucleo }), "nao_encontrado");
await recusa("nem para a equipe (a matriz não deixa)", () => rpc(daCoord(), "rede_com_nucleo_linha", { p_id: nucleo }), "nao_encontrado");
const quandoEncontro = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
const encontro = (extra = {}) => ({ nucleo, quando: quandoEncontro, local_tipo: "biblioteca", local_texto: "Biblioteca Parque", ...extra });
await recusa("só a mediação marca encontro", () => rpc(como(pessoas.membro), "rede_com_encontro_salvar", { p: encontro() }), "sem_permissao");
await recusa("endereço de casa não passa (rua com número)", () => rpc(como(pessoas.acompanha), "rede_com_encontro_salvar", { p: encontro({ local_texto: "Rua das Flores, 123" }) }), "dado_pessoal");
await recusa("CEP não passa", () => rpc(como(pessoas.acompanha), "rede_com_encontro_salvar", { p: encontro({ local_texto: "perto do 24220-000" }) }), "dado_pessoal");
await recusa("tipo de local inválido", () => rpc(como(pessoas.acompanha), "rede_com_encontro_salvar", { p: encontro({ local_tipo: "casa" }) }), "invalido:local");
await recusa("'outro lugar' pede o nome do lugar", () => rpc(como(pessoas.acompanha), "rede_com_encontro_salvar", { p: encontro({ local_tipo: "outro", local_texto: "" }) }), "invalido:local");
await recusa("encontro no passado não vale", () => rpc(como(pessoas.acompanha), "rede_com_encontro_salvar", { p: encontro({ quando: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() }) }), "invalido:quando");
let idEncontro;
await espera("a mediação marca o encontro em local público e ele aparece na página, para quem é do núcleo", async () => {
  const r = await rpc(como(pessoas.acompanha), "rede_com_encontro_salvar", { p: encontro() });
  idEncontro = r.id;
  const p = await rpc(como(pessoas.membro), "rede_com_nucleo", { p_id: nucleo });
  return [p.encontros.length, p.encontros[0].local_tipo, p.encontros[0].local_texto, Object.keys(p.encontros[0]).sort().join()];
}, (r) => r[0] === 1 && r[1] === "biblioteca" && r[2] === "Biblioteca Parque" && r[3] === "id,local_texto,local_tipo,quando");
await espera("sem lista de presença: o banco guarda no máximo uma contagem e a página não a mostra", async () => JSON.stringify(await rpc(como(pessoas.membro), "rede_com_nucleo", { p_id: nucleo })), (j) => !j.includes("presentes"));
await espera("só a mediação tira encontro", async () => {
  await rpc(como(pessoas.membro), "rede_com_encontro_remover", { p_id: idEncontro });
  const aindaLa = (await um("select count(*)::int as n from interno.rede_encontros where id = $1", [idEncontro])).n;
  await rpc(como(pessoas.acompanha), "rede_com_encontro_remover", { p_id: idEncontro });
  return [aindaLa, (await um("select count(*)::int as n from interno.rede_encontros where id = $1", [idEncontro])).n];
}, (r) => r[0] === 1 && r[1] === 0);
await espera("sair do núcleo corta o acesso na hora (página, mural e a lista)", async () => {
  await rpc(como(pessoas.membro), "rede_com_nucleo_sair", { p_id: nucleo });
  const resultados = [];
  for (const [funcao, args] of [["rede_com_nucleo", { p_id: nucleo }], ["rede_com_nucleo_linha", { p_id: nucleo }]]) {
    try {
      await rpc(como(pessoas.membro), funcao, args);
      resultados.push("passou");
    } catch (e) {
      resultados.push(e.message.includes("nao_encontrado") ? "fechado" : e.message);
    }
  }
  const lista = (await rpc(como(pessoas.membro), "rede_com_nucleos")).itens.length;
  const veMural = (await um("select interno.rede_ve(p, $2) as v from interno.rede_posts p where p.id = $1", [postNucleoDaMediacao, pessoas.membro])).v;
  return [...resultados, lista, veMural];
}, (r) => r[0] === "fechado" && r[1] === "fechado" && r[2] === 0 && r[3] === false);

// ── 8. Turma do mês ──
await dono("insert into interno.turmas_mes (mes, usuario) values ('2026-11', $1)", [pessoas.turmista]);
await recusa("mês com formato inválido", () => rpc(como(pessoas.turmista), "rede_com_turma", { p_mes: "2026-13" }), "invalido:mes");
await espera("a turma mostra se a pessoa está inscrita e se já entrou", async () => ({
  inscrita: await rpc(como(pessoas.turmista), "rede_com_turma", { p_mes: "2026-11" }),
  naoInscrita: (await rpc(como(pessoas.membro), "rede_com_turma", { p_mes: "2026-11" })).inscrito,
}), (r) => r.inscrita.inscrito === true && r.inscrita.entrou === false && r.inscrita.slug === "turma-2026-11" && r.naoInscrita === false);
await recusa("quem não se inscreveu na turma não entra na conversa dela", () => rpc(como(pessoas.membro), "rede_com_turma_entrar", { p_mes: "2026-11" }), "sem_permissao");
await recusa("outro mês, outra turma: sem inscrição não entra", () => rpc(como(pessoas.turmista), "rede_com_turma_entrar", { p_mes: "2026-10" }), "sem_permissao");
await espera("a inscrita entra: nasce a comunidade fechada 'Turma de novembro de 2026', com regras e etiquetas", async () => {
  const r = await rpc(como(pessoas.turmista), "rede_com_turma_entrar", { p_mes: "2026-11" });
  await rpc(como(pessoas.turmista), "rede_com_turma_entrar", { p_mes: "2026-11" });
  const c = await um("select nome, tipo, categoria, publico_padrao from interno.rede_comunidades where slug = $1", [r.slug]);
  const regras = (await um("select count(*)::int as n from interno.rede_comunidade_regras where comunidade = $1", [r.slug])).n;
  const membros = (await um("select count(*)::int as n from interno.rede_comunidade_membros where comunidade = $1", [r.slug])).n;
  return [r.slug, c.nome, c.tipo, c.categoria, c.publico_padrao, regras, membros];
}, (r) => r[0] === "turma-2026-11" && r[1] === "Turma de novembro de 2026" && r[2] === "fechada" && r[3] === "instituto" && r[4] === "comunidade" && r[5] === 3 && r[6] === 1);
await espera("a comunidade da turma é invisível para quem não está nela: página, lista e posts", async () => {
  await limpaLimites();
  const post = await rpc(como(pessoas.turmista), "rede_publicar", { p: { texto: "Primeira conversa da turma de novembro", comunidade: "turma-2026-11" } });
  let pagina = "passou";
  try {
    await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "turma-2026-11" });
  } catch (e) {
    pagina = e.message.includes("nao_encontrado") ? "fechada" : e.message;
  }
  const naLista = (await nomesDaLista(como(pessoas.membro))).some((i) => i.slug === "turma-2026-11");
  const naListaDela = (await nomesDaLista(como(pessoas.turmista))).some((i) => i.slug === "turma-2026-11");
  const veMembro = (await um("select interno.rede_ve(p, $2) as v from interno.rede_posts p where p.id = $1", [post.id, pessoas.membro])).v;
  const veTurmista = (await um("select interno.rede_ve(p, $2) as v from interno.rede_posts p where p.id = $1", [post.id, pessoas.turmista])).v;
  return [post.publico, pagina, naLista, naListaDela, veMembro, veTurmista];
}, (r) => r[0] === "comunidade" && r[1] === "fechada" && r[2] === false && r[3] === true && r[4] === false && r[5] === true);
await recusa("entrar numa turma pelo botão de comunidade não funciona (fechada)", () => rpc(como(pessoas.membro), "rede_com_entrar", { p_slug: "turma-2026-11" }), "nao_encontrado");

// ── 9. Permissões ──
await espera("nenhuma função interna do pacote é executável por anon ou authenticated", async () => todos("select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r where n.nspname = 'interno' and p.proname in ('rede3_com_modera', 'rede3_com_achar', 'rede3_com_padroes', 'rede3_com_semear', 'rede3_com_situacao') and r.rolname in ('anon', 'authenticated') and has_function_privilege(r.oid, p.oid, 'execute')"), (r) => r.length === 0);
await espera("as funções públicas: leitura aberta só onde a página decide; o resto só com conta", async () => um(`select
  has_function_privilege('anon', 'public.rede_com_lista()', 'execute') as lista_anon, has_function_privilege('anon', 'public.rede_com_pagina(text)', 'execute') as pagina_anon,
  has_function_privilege('anon', 'public.rede_com_aula_linha(text, text, text, integer)', 'execute') as aula_anon,
  has_function_privilege('anon', 'public.rede_com_entrar(text)', 'execute') as entrar_anon, has_function_privilege('anon', 'public.rede_com_propor(jsonb)', 'execute') as propor_anon,
  has_function_privilege('anon', 'public.rede_com_decidir(uuid, boolean, text)', 'execute') as decidir_anon, has_function_privilege('anon', 'public.rede_com_nucleo(uuid)', 'execute') as nucleo_anon,
  has_function_privilege('anon', 'public.rede_com_turma_entrar(text)', 'execute') as turma_anon, has_function_privilege('anon', 'public.rede_com_fixar(text, uuid, boolean)', 'execute') as fixar_anon,
  has_function_privilege('authenticated', 'public.rede_com_entrar(text)', 'execute') as entrar_auth, has_function_privilege('authenticated', 'public.rede_com_decidir(uuid, boolean, text)', 'execute') as decidir_auth`),
  (r) => r.lista_anon && r.pagina_anon && r.aula_anon && !r.entrar_anon && !r.propor_anon && !r.decidir_anon && !r.nucleo_anon && !r.turma_anon && !r.fixar_anon && r.entrar_auth && r.decidir_auth);
await espera("nenhuma tabela nova no esquema public", async () => todos("select tablename from pg_tables where schemaname = 'public' and tablename like 'rede%'"), (r) => r.length === 0);
await espera("nenhuma função do pacote devolve e-mail ou nome do painel", async () => {
  const p = await rpc(como(pessoas.membro), "rede_com_pagina", { p_slug: "horta-comunitaria" });
  const n = await rpc(como(pessoas.membro3), "rede_com_nucleos");
  const texto = JSON.stringify([p, n]);
  return [texto.includes("@com.local"), texto.includes("Companheira") === true];
}, (r) => r[0] === false);

// ── 10. Os arquivos do pacote ──
await espera("as funções de endereço e de conferência batem com o banco", async () => [
  enderecosCom.lista("pt"), enderecosCom.propor("en"), enderecosCom.aula("pt", "matematica-basica", "fracoes", "matematica"), enderecosCom.nucleo("pt", "x"),
  aulaOk("matematica-basica/fracoes"), aulaOk("../fora"), aulaOk("so-um"), mesOk("2026-11"), mesOk("2026-13"),
], (r) => r[0] === "/pt/comunidade/comunidades" && r[1] === "/en/comunidade/propor" && r[2] === "/pt/comunidade/aula/matematica-basica/fracoes?c=matematica" && r[3] === "/pt/comunidade/nucleos/x" && r[4] === true && r[5] === false && r[6] === false && r[7] === true && r[8] === false);
await espera("o botão da aula leva à comunidade da disciplina; 'trabalho' vai para 'oficios-e-trabalho'; slug estranho não vira endereço", async () => [
  enderecoDiscutirAula("pt", "matematica-basica", "fracoes", "matematica"),
  enderecoDiscutirAula("en", "oficios", "eletrica", "trabalho"),
  enderecoDiscutirAula("pt", "Ma Ti", "fracoes", "matematica"),
  enderecoDiscutirAula("pt", "a", "fracoes", "matematica"),
  rotuloDiscutirAula("pt"), rotuloDiscutirAula("xx") === rotuloDiscutirAula("pt"), ["en", "es", "fr", "ru", "zh"].every((l) => rotuloDiscutirAula(l) !== rotuloDiscutirAula("pt")),
], (r) => r[0] === "/pt/comunidade/aula/matematica-basica/fracoes?c=matematica" && r[1] === "/en/comunidade/aula/oficios/eletrica?c=oficios-e-trabalho" && r[2] === null && r[3] === null && r[4].includes("aula") && r[5] && r[6]);
await espera("os seis idiomas do pacote têm as mesmas chaves (pt é o final; os outros cinco são rascunho marcado)", async () => {
  const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const pt = achatar(JSON.parse(lerTexto("i18n/rede/comunidades/pt.json"))).filter((k) => k !== "_rascunho").sort();
  const resultado = { pt: JSON.parse(lerTexto("i18n/rede/comunidades/pt.json"))._rascunho === undefined };
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(lerTexto(`i18n/rede/comunidades/${l}.json`));
    resultado[l] = JSON.stringify(achatar(j).filter((k) => k !== "_rascunho").sort()) === JSON.stringify(pt) && j._rascunho === true;
  }
  return resultado;
}, (r) => Object.values(r).every(Boolean));
await espera("todo texto do pacote usado nos componentes existe no português", async () => {
  const pt = JSON.parse(lerTexto("i18n/rede/comunidades/pt.json"));
  const fontes = ["AcoesDaComunidade", "Moderar", "PaginaDaComunidade", "Lista", "Propor", "TelaAula", "Nucleos", "Compositor"].map((a) => lerTexto(`components/rede/comunidades/${a}.tsx`)).join("\n");
  const faltando = [];
  for (const [, grupo, chave] of fontes.matchAll(/\bsc\.(lista|tipo|acao|pagina|moderar|propor|aula|nucleos)\.(\w+)/g)) if (!(chave in pt[grupo])) faltando.push(`${grupo}.${chave}`);
  return faltando;
}, (r) => r.length === 0);
await espera("as rotas do pacote existem, dão 404 com o recurso desligado e não indexam", async () => {
  const dir = "app/[lang]/comunidade";
  const rotas = [`${dir}/comunidades/page.tsx`, `${dir}/propor/page.tsx`, `${dir}/aula/[track]/[lesson]/page.tsx`, `${dir}/nucleos/page.tsx`, `${dir}/nucleos/[id]/page.tsx`];
  return rotas.map((a) => ({ a, ok: fs.existsSync(new URL(`../${a}`, import.meta.url)) && /notFound\(\)/.test(lerTexto(a)) && /ligado\("rede-v2"\)/.test(lerTexto(a)) && /index: false/.test(lerTexto(a)) }));
}, (r) => r.every((x) => x.ok));
await espera("a rota da comunidade traz os textos do pacote e a página da aula só entra com o recurso ligado, sem ler disco", async () => {
  const rota = lerTexto("app/[lang]/comunidade/c/[slug]/page.tsx");
  const aula = lerTexto("app/[lang]/trilhas/[track]/[lesson]/page.tsx");
  const modulo = lerTexto("lib/rede/discutir-aula.ts");
  return [/comTextos\(lang\)/.test(rota), /ligado\("rede-v2"\) && \(\s*<p[^>]*>\s*<Link href=\{enderecoDiscutirAula/.test(aula), /from "@\/lib\/rede\/discutir-aula"/.test(aula), /node:fs|readFile|from "@\//.test(modulo)];
}, (r) => r[0] && r[1] && r[2] && r[3] === false);
await espera("o registro da Rede e o menu ligam as telas do pacote", async () => {
  const registro = lerTexto("components/rede/registro.tsx");
  const casca = lerTexto("components/rede/Casca.tsx");
  const telas = lerTexto("components/rede/Telas.tsx");
  return [["comunidades", "propor", "aula", "nucleos"].every((n) => new RegExp(`${n}: \\{ componente: dynamic\\(\\(\\) => import\\("\\./comunidades/`).test(registro)), /\/comunidades`/.test(casca), /\/nucleos`/.test(casca), /<PaginaDaComunidade \{\.\.\.props\} sc=\{sc\} \/>/.test(telas)];
}, (r) => r.every(Boolean));
await espera("o painel da coordenação tem a seção 'Rede: propostas de comunidade', com guia e só para coordenação", async () => {
  // O registro de seções e a casca saíram de Painel.tsx para casca/ no redesenho (docs/PAINEL-REDESENHO.md): lemos os dois.
const painel = lerTexto("components/painel/Painel.tsx") + "\n" + lerTexto("components/painel/casca/Dentro.tsx");
  return [/id: "rede-propostas", nome: "Rede: propostas de comunidade"[^}]*can\(eu, "coordenacao", "vice"\)/.test(painel), /atual\.id === "rede-propostas" && <RedePropostas \/>/.test(painel), /"rede-propostas": \{/.test(lerTexto("components/painel/guias.ts")), /rede_com_propostas_fila/.test(lerTexto("components/painel/RedePropostas.tsx")), /rede_com_decidir/.test(lerTexto("components/painel/RedePropostas.tsx"))];
}, (r) => r.every(Boolean));
await espera("a migração não mexe no install.sql nem cria tabela, e toda função nova é security definer com search_path", async () => {
  const funcoes = [...migracao.matchAll(/create or replace function ([\w.]+)\(([^)]*)\)([\s\S]*?)\bas \$\$/g)];
  const semDefiner = funcoes.filter((m) => !/security definer set search_path = interno, pg_temp/.test(m[3])).map((m) => m[1]);
  return [funcoes.length >= 30, semDefiner, /create table/i.test(migracao.replace(/--[^\n]*/g, ""))];
}, (r) => r[0] && r[1].length === 0 && r[2] === false);

// ── T32 (itens 2b e 3): a vitrine com contagens agregadas e a amostra para visitante; o painel da semeadura ──
const vitrine = lerTexto("supabase/migracoes/20261106-t32-alumia-vitrine.sql");
await espera("a migração da vitrine instala por cima (e de novo, sem estrago)", () => banco.exclusivo(async () => { await banco.pg.exec(vitrine); await banco.pg.exec(vitrine); }));
await limpaLimites();
for (const [n, autor] of [[1, pessoas.membro], [2, pessoas.membro2], [3, pessoas.membro3], [4, pessoas.membro]]) await postar({ comunidade: "moradia" }, autor, `moradia ${n}`);
await postar({ comunidade: "terra" }, pessoas.membro, "terra 1");
await espera("vitrine: só contagens da semana (posts e pessoas), nunca nomes; pessoas só a partir de 3", async () => {
  const itens = await nomesDaLista(como(pessoas.membro));
  const moradia = itens.find((i) => i.slug === "moradia");
  const terra = itens.find((i) => i.slug === "terra");
  return [moradia.posts_7d >= 4, moradia.pessoas_7d >= 3, terra.posts_7d >= 1, terra.pessoas_7d, JSON.stringify(itens).includes("Companheira")];
}, (r) => r[0] && r[1] && r[2] && r[3] === null && r[4] === false);
await espera("vitrine: ordem pública (mais posts na semana primeiro, depois alfabética) dentro de cada grupo", async () => (await nomesDaLista(como(pessoas.membro))).filter((i) => i.categoria === "lutas"), (lutas) => lutas[0].slug === "moradia" && lutas.every((x, i) => i === 0 || lutas[i - 1].posts_7d >= x.posts_7d));
await espera("visitante vê a amostra das lutas e do Instituto (nome, descrição e regras, sem contagem) e nenhuma fechada", async () => {
  const itens = await nomesDaLista(visitante());
  const amostra = itens.filter((i) => i.amostra);
  return [itens.filter((i) => i.categoria === "disciplinas").length, amostra.length > 0, amostra.every((i) => i.categoria !== "disciplinas" && i.posts_7d === null && i.pessoas_7d === null && Array.isArray(i.regras)), itens.some((i) => i.tipo === "fechada"), amostra.find((i) => i.slug === "moradia")?.regras.length];
}, (r) => r[0] === 77 && r[1] && r[2] && r[3] === false && r[4] >= 1);
await espera("a página de luta continua fechada para visitante (a amostra não abre posts)", async () => { try { await rpc(visitante(), "rede_com_pagina", { p_slug: "moradia" }); return "abriu"; } catch (e) { return String(e.message); } }, (m) => m.includes("entre_primeiro"));
await recusa("semeadura: só a coordenação", () => rpc(como(pessoas.membro), "rede_painel_semeadura"), "sem_permissao");
await espera("semeadura: posts reais e quantas pessoas moderam, por comunidade", async () => (await rpc(daCoord(), "rede_painel_semeadura")).itens.find((i) => i.slug === "moradia"), (m) => m.posts >= 4 && m.posts_7d >= 4 && m.moderacao >= 1 && !("autores" in m));
await espera("semeadura: visitante não chama a função", async () => (await um("select has_function_privilege('anon', 'public.rede_painel_semeadura()', 'execute') as x")).x, (x) => x === false);

console.log(`Rede v2 (comunidades): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
