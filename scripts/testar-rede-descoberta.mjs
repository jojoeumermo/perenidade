// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote descoberta da Rede v2 (supabase/migracoes/2026-11-rede-descoberta.sql, itens 29 a 35 do R4) num Postgres de
// verdade dentro do Node: a primeira entrada guiada (estado, escolhas, guia que se pode pular), os pacotes de pessoas (só perfil
// aberto que aceitou aparecer), as linhas temáticas com regra escrita, as ordenações com fórmula escrita (e o teto de 100), a
// hashtag como página, o Explorar (tags com 3 autores ou mais) e a busca em português (sem acento, plural, matriz de
// visibilidade, silenciados, perfil invisível). Também confere permissões, textos nos seis idiomas e as telas.
// Carrega o install.sql, a fundação e este pacote (os outros pacotes rede não são necessários). Uso: npm run testar:rede-descoberta
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { ORDENS, enderecosDescoberta, normalizarTag, partirComTags, tagOk } from "../lib/rede/tipos-descoberta.ts";

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
const migracao = lerTexto("supabase/migracoes/2026-11-rede-descoberta.sql");

await espera("a fundação instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(fundacao)));
await espera("a migração do pacote instala", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("instalar de novo não quebra (idempotente)", () => banco.exclusivo(() => banco.pg.exec(migracao)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

// ── As pessoas ──
const pessoas = {};
const nomes = ["autor", "membro", "membro2", "membro3", "seguidor", "comunidade", "equipe", "bloqueado", "invisivel", "trancada", "aberta", "nova"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@descoberta.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [pessoas[nome], `Lutadora ${i + 1} ${nome}`]);
}
await dono("update interno.perfis set rede_codinome = null, rede_codinome_ok = false where id = $1", [pessoas.nova]);
await dono("delete from interno.papeis where usuario <> $1", [pessoas.equipe]);
await dono("insert into interno.papeis (usuario, papel) select $1, 'educacao' where not exists (select 1 from interno.papeis where usuario = $1)", [pessoas.equipe]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "nova")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [pessoas[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [pessoas[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
for (const nome of nomes.filter((n) => n !== "nova")) await dono("update interno.perfis set rede_handle = $2 where id = $1", [pessoas[nome], `${nome}_luta`]);
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [pessoas.invisivel]);
await dono("update interno.perfis set rede_modo = 'trancado' where id = $1", [pessoas.trancada]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.autor, pessoas.bloqueado]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [pessoas.seguidor, pessoas.autor]);

await dono(`insert into interno.rede_comunidades (slug, nome, descricao, categoria, tipo, publico_padrao, trilhas) values
  ('matematica', 'Matemática', 'Dúvidas de matemática', 'disciplinas', 'aberta', 'internet', '{}'),
  ('moradia', 'Moradia', 'Luta por moradia', 'lutas', 'aberta', 'membros', '{}'),
  ('greve-geral', 'Greve geral', 'Greves e paralisações', 'lutas', 'aberta', 'membros', '{}'),
  ('saude-popular', 'Saúde popular', 'Saúde e SUS', 'lutas', 'aberta', 'membros', '{}'),
  ('terra', 'Terra', 'Reforma agrária', 'lutas', 'restrita', 'membros', '{}'),
  ('greve-fechada', 'Greve (fechada)', 'Só de dentro', 'lutas', 'fechada', 'comunidade', '{}'),
  ('cultura', 'Cultura', 'Arte e estudo', 'instituto', 'aberta', 'membros', '{filosofia-politica}')`);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('greve-fechada', $1)", [pessoas.comunidade]);

const base = Date.now() - 2 * 3600 * 1000;
let contador = 0;
const postar = async (campos = {}, autor = pessoas.autor) => {
  const c = { texto: "post do teste", publico: "membros", criado_em: new Date(base + contador++ * 1000).toISOString(), ...campos };
  const colunas = Object.keys(c);
  return (await um(`insert into interno.rede_posts (autor, ${colunas.join(", ")}) values ($1, ${colunas.map((_, i) => `$${i + 2}`).join(", ")}) returning id`, [autor, ...Object.values(c)])).id;
};
const ids = (r) => r.itens.map((i) => i.id);

// ── Hashtag: o texto vira tag, com a mesma regra no banco e no navegador ──
const AMOSTRA = "Vamos de #Greve! e #greve de novo, #Educação, a#b, http://x.com/p#sec, #123, #2026ano &#39; #a #" + "z".repeat(45);
await espera("tags no banco: sem acento, sem repetir, ignora meio de palavra, endereço, número puro e tag grande demais", async () => (await um("select interno.rede3_desc_tags(null, $1, '') as t", [AMOSTRA])).t, (t) => JSON.stringify(t) === JSON.stringify(["2026ano", "educacao", "greve"]));
await espera("tags no navegador (partirComTags) batem com as do banco", async () => [...new Set(partirComTags(AMOSTRA).filter((p) => p.tag).map((p) => p.tag))].sort(), (t) => JSON.stringify(t) === JSON.stringify(["2026ano", "educacao", "greve"]));
await espera("partirComTags devolve o texto inteiro, sem perder nem repetir pedaço", async () => partirComTags(AMOSTRA).map((p) => p.texto).join(""), (t) => t === AMOSTRA);
await espera("tagOk e normalizarTag seguem o banco", async () => [tagOk("greve"), tagOk("123"), tagOk("a"), normalizarTag("#Educação"), enderecosDescoberta.tag("pt", "greve"), enderecosDescoberta.buscar("pt", "a b")], (r) => r[0] && !r[1] && !r[2] && r[3] === "educacao" && r[4] === "/pt/comunidade/tag/greve" && r[5] === "/pt/comunidade/buscar?q=a%20b");
await espera("o texto sem acento: 'educação' vira 'educacao', outras letras ficam", async () => (await um("select interno.rede3_desc_sa('Educação Ñandú ЖИ') as t")).t, (t) => t === "educacao nandu жи");

// ── A página da hashtag respeita a matriz ──
const pGreve = await postar({ texto: "A #greve na fábrica foi decidida em assembleia.", comunidade: "moradia" });
const pAberto = await postar({ texto: "Professores em #Greve, como explicar o direito de greve?", comunidade: "matematica", publico: "internet" });
const pSeguidores = await postar({ texto: "Conversa só para quem me segue sobre #greve.", publico: "seguidores" });
const pFechado = await postar({ texto: "Pauta fechada da #greve.", comunidade: "greve-fechada", publico: "comunidade" });
const pInvisivel = await postar({ texto: "Eu, conta invisível, falo de #greve.", publico: "membros" }, pessoas.invisivel);
const pBloqueado = await postar({ texto: "Quem foi bloqueado também fala de #greve.", publico: "membros" }, pessoas.bloqueado);
const pOculto = await postar({ texto: "Post removido com #greve.", publico: "membros", oculto: true });
await espera("tag: o visitante vê só o que é da internet", async () => ids(await rpc(visitante(), "rede_desc_tag", { p_tag: "greve" })), (r) => r.length === 1 && r[0] === pAberto);
await espera("tag: o membro vê membros e internet; não vê seguidores, comunidade fechada alheia, removido", async () => new Set(ids(await rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "greve" }))), (s) => s.size === 4 && [pGreve, pAberto, pInvisivel, pBloqueado].every((x) => s.has(x)) && ![pSeguidores, pFechado, pOculto].some((x) => s.has(x)));
await espera("tag: quem segue vê o post de seguidores; quem é da comunidade vê o fechado", async () => [ids(await rpc(como(pessoas.seguidor), "rede_desc_tag", { p_tag: "greve" })).includes(pSeguidores), ids(await rpc(como(pessoas.comunidade), "rede_desc_tag", { p_tag: "greve" })).includes(pFechado)], (r) => r[0] && r[1]);
await espera("tag: o bloqueio vale dos dois lados", async () => [ids(await rpc(como(pessoas.autor), "rede_desc_tag", { p_tag: "greve" })).includes(pBloqueado), ids(await rpc(como(pessoas.bloqueado), "rede_desc_tag", { p_tag: "greve" })).includes(pGreve)], (r) => r[0] === false && r[1] === false);
await espera("tag: o autor vê os próprios posts, inclusive o removido", async () => new Set(ids(await rpc(como(pessoas.autor), "rede_desc_tag", { p_tag: "greve", p_limite: 50 }))), (s) => [pGreve, pAberto, pSeguidores, pFechado, pOculto].every((x) => s.has(x)) && !s.has(pBloqueado));
await espera("tag com # e maiúscula e acento dá a mesma página", async () => [ids(await rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "#GREVE" })).length, (await rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "Greve" })).tag], (r) => r[0] === 4 && r[1] === "greve");
await espera("tag: o post de conta invisível aparece, mas sem levar ao perfil", async () => (await rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "greve" })).itens.find((i) => i.id === pInvisivel).autor, (a) => a.perfil === false && a.handle === null);
await espera("tag: a linha temática da hashtag traz a regra pública", async () => (await rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "greve" })).linha, (l) => l?.slug === "greves" && /#greve/.test(l.regra));
await espera("tag sem linha: linha nula", async () => (await rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "outraTag" })).linha, (l) => l === null);
await recusa("tag curta demais", () => rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "a" }), "invalido:tag");
await recusa("tag só de número", () => rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "123" }), "invalido:tag");
await recusa("tag com caractere estranho", () => rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "gr eve" }), "invalido:tag");
await espera("silenciar uma pessoa tira o post dela da tag, só para quem silenciou", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [pessoas.membro, pessoas.invisivel]);
  return [ids(await rpc(como(pessoas.membro), "rede_desc_tag", { p_tag: "greve" })).includes(pInvisivel), ids(await rpc(como(pessoas.membro2), "rede_desc_tag", { p_tag: "greve" })).includes(pInvisivel)];
}, (r) => r[0] === false && r[1] === true);
await dono("delete from interno.rede_silenciados");

// ── Filtros e linhas temáticas ──
await espera("linha temática 'greves': #greve só nas comunidades de luta (a de disciplina fica de fora)", async () => ids(await rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_filtros: { linha: "greves" } })), (r) => r.includes(pGreve) && !r.includes(pAberto) && !r.includes(pInvisivel));
await espera("filtro por categoria e por tag juntos", async () => ids(await rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_filtros: { tag: "greve", categoria: "disciplinas" } })), (r) => r.length === 1 && r[0] === pAberto);
await espera("filtro por comunidade", async () => ids(await rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_filtros: { comunidade: "moradia" } })), (r) => r.length === 1 && r[0] === pGreve);
await espera("o visitante usa a linha geral com filtro e só vê a internet", async () => ids(await rpc(visitante(), "rede_desc_linha", { p_aba: "geral", p_filtros: { tag: "greve" } })), (r) => r.length === 1 && r[0] === pAberto);
await recusa("visitante não lê a aba Tudo", () => rpc(visitante(), "rede_desc_linha", { p_aba: "tudo" }), "entre_primeiro");
await recusa("linha que não existe", () => rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_filtros: { linha: "nao-existe" } }), "nao_encontrado");
await recusa("categoria inventada", () => rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_filtros: { categoria: "outra" } }), "invalido:categoria");
await recusa("tipo inventado", () => rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_filtros: { tipo: "xx" } }), "invalido:tipo");
await recusa("ordem inventada", () => rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_ordem: "popular" }), "invalido:ordem");
await recusa("'relevancia' só existe na busca", () => rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_ordem: "relevancia" }), "invalido:ordem");
await recusa("cursor estragado", () => rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_cursor: "lixo" }), "invalido:cursor");
await recusa("cursor com contagem acima do teto", () => rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_cursor: `0|${new Date().toISOString()}|${pGreve}|500` }), "invalido:cursor");

const authEquipe = como(pessoas.equipe);
await recusa("linha nova: só a equipe cria", () => rpc(como(pessoas.membro), "rede_desc_linha_salvar", { p_slug: "x-linha", p_titulo: "Titulo", p_regra: "Posts com #tagx nas lutas." }), "sem_permissao");
await recusa("linha nova: a regra precisa citar a tag do filtro", () => rpc(authEquipe, "rede_desc_linha_salvar", { p_slug: "x-linha", p_titulo: "Titulo", p_regra: "Regra que não diz qual é a tag usada.", p_tag: "tagx" }), "invalido:regra");
await recusa("linha nova: sem nenhum filtro", () => rpc(authEquipe, "rede_desc_linha_salvar", { p_slug: "x-linha", p_titulo: "Titulo", p_regra: "Regra qualquer que não filtra nada." }), "invalido:filtro");
const pTagX = await postar({ texto: "Conversa com #TagX no meio.", comunidade: "moradia" });
await espera("a equipe cria uma linha temática e ela filtra de verdade", async () => {
  await rpc(authEquipe, "rede_desc_linha_salvar", { p_slug: "x-linha", p_titulo: "Linha X", p_regra: "Posts com #tagx nas comunidades de luta.", p_tag: "#TagX", p_categoria: "lutas" });
  return ids(await rpc(como(pessoas.membro), "rede_desc_linha", { p_aba: "tudo", p_filtros: { linha: "x-linha" } }));
}, (r) => r.length === 1 && r[0] === pTagX);

// ── Ordenações com fórmula escrita ──
await dono("delete from interno.rede_posts");
const t0 = Date.now() - 3 * 3600 * 1000;
let n = 0;
const agora = (min) => new Date(t0 + min * 60000).toISOString();
const velho = await postar({ texto: "Post de quarenta dias atrás", criado_em: new Date(Date.now() - 40 * 86400000).toISOString() });
const A = await postar({ texto: "Post A", criado_em: agora(n++) });
const B = await postar({ texto: "Post B", criado_em: agora(n++) });
const C = await postar({ texto: "Post C", criado_em: agora(n++) });
const D = await postar({ texto: "Post D", criado_em: agora(n++) });
const E = await postar({ texto: "Post E", criado_em: agora(n++) });
const responder = async (pai, quem, publico = "membros") => (await um("insert into interno.rede_posts (autor, texto, resposta_a, publico) values ($1, 'resposta', $2, $3) returning id", [quem, pai, publico])).id;
for (const quem of [pessoas.membro, pessoas.membro2, pessoas.membro3]) await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'util')", [B, quem]);
await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'util')", [D, pessoas.membro]);
for (const quem of [pessoas.membro, pessoas.membro2, pessoas.membro3, pessoas.membro2, pessoas.membro3]) await dono("insert into interno.rede_reacoes (post, usuario, tipo) select $1, $2, 'util' where false", [velho, quem]);
await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'util'), ($1, $3, 'util')", [velho, pessoas.membro, pessoas.membro2]);
await responder(C, pessoas.membro);
await responder(C, pessoas.membro2);
await responder(C, pessoas.equipe, "equipe");
await responder(B, pessoas.membro);
const respE = await responder(E, pessoas.membro);
await dono("update interno.rede_posts set aceita = $2 where id = $1", [E, respE]);
const quem = como(pessoas.membro);
const lista = async (ordem, extra = {}) => ids(await rpc(quem, "rede_desc_linha", { p_aba: "tudo", p_ordem: ordem, p_limite: 50, ...extra }));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
await espera("ordem 'novos': do mais novo ao mais velho (sem janela)", () => lista("novos"), (r) => igual(r, [E, D, C, B, A, velho]));
await espera("ordem 'uteis': mais marcações de Útil primeiro, empate pelo mais novo, só 30 dias", () => lista("uteis"), (r) => igual(r, [B, D, E, C, A]));
await espera("ordem 'sem_resposta': sem resposta visível e sem resposta aceita (a resposta da equipe não conta para quem não a vê)", () => lista("sem_resposta"), (r) => igual(r, [D, A]));
await espera("ordem 'em_debate': respostas dos últimos 7 dias que a pessoa pode ver, empate pelo mais novo", () => lista("em_debate"), (r) => igual(r, [C, E, B, D, A]));
await espera("em debate para a equipe: a resposta da equipe também conta", async () => ids(await rpc(authEquipe, "rede_desc_linha", { p_aba: "tudo", p_ordem: "em_debate", p_limite: 50 })).slice(0, 1), (r) => r[0] === C);
await espera("sem_resposta como filtro de uma linha temática ('duvidas-abertas' pede dúvida em disciplina)", async () => {
  const d = await postar({ texto: "Dúvida nova", tipo: "duvida", titulo: "Como somar frações?", comunidade: "matematica", publico: "internet", criado_em: agora(n++) });
  const d2 = await postar({ texto: "Dúvida respondida", tipo: "duvida", titulo: "Como multiplicar?", comunidade: "matematica", publico: "internet", criado_em: agora(n++) });
  await responder(d2, pessoas.membro2, "internet");
  return [d, d2, ids(await rpc(quem, "rede_desc_linha", { p_aba: "tudo", p_filtros: { linha: "duvidas-abertas" } }))];
}, (r) => r[2].length === 1 && r[2][0] === r[0]);
await espera("a ordem é a mesma em todas as páginas do cursor (sem repetir nem pular), em cada ordenação", async () => {
  const resultado = {};
  for (const ordem of ORDENS) {
    const todosIds = await lista(ordem);
    const vistos = [];
    let cursor = null;
    let paginas = 0;
    do {
      const r = await rpc(quem, "rede_desc_linha", { p_aba: "tudo", p_ordem: ordem, p_cursor: cursor, p_limite: 2 });
      vistos.push(...ids(r));
      cursor = r.proximo;
      paginas++;
    } while (cursor && paginas < 20);
    resultado[ordem] = igual(vistos, todosIds) && new Set(vistos).size === vistos.length;
  }
  return resultado;
}, (r) => Object.values(r).every(Boolean));
await espera("o aviso de ordem está nos seis idiomas e a fórmula não menciona engajamento", async () => {
  const pt = JSON.parse(lerTexto("i18n/rede/descoberta/pt.json"));
  return [ORDENS.every((o) => pt.ordens[o].formula.length > 20), /nota escondida/.test(pt.ordens.semAlgoritmo), /\b100\b/.test(pt.ordens.teto)];
}, (r) => r.every(Boolean));

// O teto: cada ordenação entrega no máximo 100 posts e acaba (sem rolagem sem fim).
for (let i = 0; i < 130; i++) await postar({ texto: `Massa ${i}`, criado_em: new Date(Date.now() - (200 - i) * 1000).toISOString() });
await espera("teto de 100 posts: páginas de 50 entregam 100 e a lista acaba marcada 'fim_por_teto'", async () => {
  const vistos = [];
  let cursor = null;
  let ultima = null;
  let paginas = 0;
  do {
    ultima = await rpc(quem, "rede_desc_linha", { p_aba: "tudo", p_ordem: "novos", p_cursor: cursor, p_limite: 50 });
    vistos.push(...ids(ultima));
    cursor = ultima.proximo;
    paginas++;
  } while (cursor && paginas < 10);
  return { n: vistos.length, unicos: new Set(vistos).size, teto: ultima.fim_por_teto, proximo: ultima.proximo };
}, (r) => r.n === 100 && r.unicos === 100 && r.teto === true && r.proximo === null);
await espera("teto também com páginas de 30 (30+30+30+10)", async () => {
  const tamanhos = [];
  let cursor = null;
  do {
    const r = await rpc(quem, "rede_desc_linha", { p_aba: "tudo", p_ordem: "uteis", p_cursor: cursor, p_limite: 30 });
    tamanhos.push(r.itens.length);
    cursor = r.proximo;
  } while (cursor && tamanhos.length < 10);
  return tamanhos;
}, (t) => t.reduce((a, b) => a + b, 0) <= 100 && t.length <= 4);

// ── Busca em português ──
await dono("delete from interno.rede_posts");
const sEdu = await postar({ texto: "A educação pública precisa de investimento e de professoras valorizadas.", publico: "membros" });
const sGreve = await postar({ texto: "Greves de professores param escolas; greve, greve, greve é direito.", publico: "membros", comunidade: "moradia" });
const sGreveFraca = await postar({ texto: "Uma pauta com um comentário sobre greve no meio de muito outro assunto qualquer sobre moradia popular.", publico: "membros" });
const sAberta = await postar({ texto: "Dúvida aberta sobre frações e educação básica.", comunidade: "matematica", publico: "internet" });
const sSeg = await postar({ texto: "Segredo de seguidores sobre educação.", publico: "seguidores" });
const sFechada = await postar({ texto: "Pauta fechada sobre educação sindical.", publico: "comunidade", comunidade: "greve-fechada" });
const sBloq = await postar({ texto: "Educação segundo quem foi bloqueado.", publico: "membros" }, pessoas.bloqueado);
const sOculto = await postar({ texto: "Educação removida pela moderação.", publico: "membros", oculto: true });
const sResp = await responder(sEdu, pessoas.membro2);
await dono("update interno.rede_posts set texto = 'Resposta falando de cooperativas e mutirão.' where id = $1", [sResp]);
const buscar = (quemEh, q, extra = {}) => rpc(quemEh, "rede_desc_buscar", { p_q: q, ...extra });
await espera("busca sem acento acha texto com acento: 'educacao' acha 'educação'", async () => ids(await buscar(como(pessoas.membro), "educacao")), (r) => r.includes(sEdu) && r.includes(sAberta));
await espera("busca com acento acha o mesmo", async () => new Set(ids(await buscar(como(pessoas.membro), "educação"))), (s) => s.has(sEdu) && s.has(sAberta));
await espera("plural e singular se encontram: 'greve' acha 'Greves', 'professor' acha 'professoras'", async () => [ids(await buscar(como(pessoas.membro), "greve")).includes(sGreve), ids(await buscar(como(pessoas.membro), "professor")).includes(sEdu)], (r) => r[0] && r[1]);
await espera("busca acha resposta (nível 2) também", async () => ids(await buscar(como(pessoas.membro), "cooperativas")), (r) => r.length === 1 && r[0] === sResp);
await espera("a matriz vale na busca: membro não acha seguidores, comunidade fechada alheia, removido; o bloqueado some dos dois lados", async () => new Set(ids(await buscar(como(pessoas.membro), "educação"))), (s) => !s.has(sSeg) && !s.has(sFechada) && !s.has(sOculto) && s.has(sBloq));
await espera("o bloqueio vale na busca (quem bloqueou não acha o bloqueado)", async () => ids(await buscar(como(pessoas.autor), "educação")).includes(sBloq), (v) => v === false);
await espera("quem segue acha o post de seguidores; quem é da comunidade acha o fechado; o autor acha os próprios", async () => [ids(await buscar(como(pessoas.seguidor), "educação")).includes(sSeg), ids(await buscar(como(pessoas.comunidade), "educação")).includes(sFechada), ids(await buscar(como(pessoas.autor), "educação")).includes(sSeg)], (r) => r.every(Boolean));
await espera("visitante: só o que é da internet", async () => ids(await buscar(visitante(), "educação")), (r) => r.length === 1 && r[0] === sAberta);
await espera("visitante não recebe pessoas nem comunidades de luta", async () => { const r = await buscar(visitante(), "moradia"); return [r.pessoas.length, r.comunidades.length]; }, (r) => r[0] === 0 && r[1] === 0);
await espera("busca respeita o que a pessoa silenciou", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [pessoas.membro, pessoas.autor]);
  const r = ids(await buscar(como(pessoas.membro), "educação"));
  await dono("delete from interno.rede_silenciados");
  return r;
}, (r) => !r.includes(sEdu) && !r.includes(sAberta));
await espera("relevância: o texto que repete o termo vem antes do que só o cita", async () => ids(await buscar(como(pessoas.membro), "greve")), (r) => r.indexOf(sGreve) >= 0 && r.indexOf(sGreve) < r.indexOf(sGreveFraca));
await espera("ordem 'novos' na busca: do mais novo ao mais velho", async () => ids(await buscar(como(pessoas.membro), "educação", { p_ordem: "novos" })), (r) => igual(r, [sBloq, sAberta, sEdu].filter((x) => r.includes(x))) && r[0] === sBloq);
await espera("busca avançada: aspas, 'or' e '-' funcionam", async () => [ids(await buscar(como(pessoas.membro), '"educação pública"')).includes(sEdu), ids(await buscar(como(pessoas.membro), "educação -frações")).includes(sAberta), ids(await buscar(como(pessoas.membro), "cooperativas or fracoes")).length >= 2], (r) => r[0] && r[1] === false && r[2]);
await recusa("ordem de busca inventada", () => buscar(como(pessoas.membro), "educação", { p_ordem: "uteis" }), "invalido:ordem");
await espera("consulta curta e só de palavras comuns voltam vazias e avisam", async () => [(await buscar(como(pessoas.membro), "a")).curta, (await buscar(como(pessoas.membro), "de a o")).so_comuns], (r) => r[0] === true && r[1] === true);
await espera("pessoas: acha pelo @handle e pelo codinome; perfil invisível NUNCA aparece (nem pelo @)", async () => {
  const porHandle = (await buscar(como(pessoas.membro), "@aberta_luta")).pessoas.map((p) => p.handle);
  const porNome = (await buscar(como(pessoas.membro), "lutadora 11 aberta")).pessoas.map((p) => p.handle);
  const invisivelHandle = (await buscar(como(pessoas.membro), "@invisivel_luta")).pessoas.length;
  const invisivelNome = (await buscar(como(pessoas.membro), "invisivel")).pessoas.map((p) => p.handle);
  return [porHandle, porNome, invisivelHandle, invisivelNome];
}, (r) => r[0].includes("aberta_luta") && r[1].includes("aberta_luta") && r[2] === 0 && !r[3].includes("invisivel_luta"));
await espera("pessoas: perfil trancado aparece (existe), o bloqueado some dos dois lados", async () => [(await buscar(como(pessoas.membro), "@trancada_luta")).pessoas.length, (await buscar(como(pessoas.autor), "@bloqueado_luta")).pessoas.length, (await buscar(como(pessoas.bloqueado), "@autor_luta")).pessoas.length], (r) => r[0] === 1 && r[1] === 0 && r[2] === 0);
await espera("pessoas: conta fora da Rede (sem consentimento) não aparece", async () => (await buscar(como(pessoas.membro), "@nova_luta")).pessoas.length, (n) => n === 0);
await espera("curinga do LIKE não vaza: '_' e '%' valem como letra comum", async () => [(await buscar(como(pessoas.membro), "lutadora_11")).pessoas.length, (await buscar(como(pessoas.membro), "lutadora 11")).pessoas.length >= 1], (r) => r[0] === 0 && r[1]);
await espera("comunidades: acha por nome; a fechada só para quem é dela; luta só com conta", async () => [
  (await buscar(como(pessoas.membro), "moradia")).comunidades.map((c) => c.slug),
  (await buscar(como(pessoas.membro), "greve fechada")).comunidades.map((c) => c.slug),
  (await buscar(como(pessoas.comunidade), "fechada")).comunidades.map((c) => c.slug),
  (await buscar(visitante(), "matematica")).comunidades.map((c) => c.slug),
], (r) => r[0].includes("moradia") && !r[1].includes("greve-fechada") && r[2].includes("greve-fechada") && r[3].includes("matematica"));
await espera("a busca usa o índice próprio (expressão sobre texto sem acento) e o de hashtag", async () => (await todos("select indexname from pg_indexes where schemaname = 'interno' and tablename = 'rede_posts' and indexname in ('rede_posts_desc_doc', 'rede_posts_desc_tags')")).length, (c) => c === 2);
await espera("a busca pagina e respeita o teto de 100", async () => {
  for (let i = 0; i < 120; i++) await postar({ texto: `Texto sobre cooperativismo número ${i}`, criado_em: new Date(Date.now() - i * 1000).toISOString() });
  let total = 0;
  let cursor = null;
  let ultima;
  do {
    ultima = await buscar(como(pessoas.membro), "cooperativismo", { p_cursor: cursor, p_limite: 50, p_ordem: "novos" });
    total += ultima.itens.length;
    cursor = ultima.proximo;
  } while (cursor);
  return [total, ultima.fim_por_teto];
}, (r) => r[0] === 100 && r[1] === true);

// ── Explorar ──
await dono("delete from interno.rede_posts");
const recente = (min) => new Date(Date.now() - min * 60000).toISOString();
for (const [quemEh, nome] of [[pessoas.membro, "membro"], [pessoas.membro2, "membro2"], [pessoas.membro3, "membro3"]]) {
  await postar({ texto: `Tag popular de ${nome} #tagpop`, criado_em: recente(10) }, quemEh);
}
await postar({ texto: "Tag rara #tagraro", criado_em: recente(10) }, pessoas.membro);
await postar({ texto: "Tag rara de novo #tagraro", criado_em: recente(11) }, pessoas.membro2);
await postar({ texto: "Mesma pessoa #tagsolo", criado_em: recente(12) }, pessoas.membro);
await postar({ texto: "Mesma pessoa #tagsolo", criado_em: recente(13) }, pessoas.membro);
await postar({ texto: "Mesma pessoa #tagsolo", criado_em: recente(14) }, pessoas.membro);
for (const [quemEh] of [[pessoas.membro], [pessoas.membro2], [pessoas.membro3]]) {
  await postar({ texto: "Aberta à internet #tagaberta", comunidade: "matematica", publico: "internet", criado_em: recente(20) }, quemEh);
}
await postar({ texto: "Segredo de seguidores #tagseg", publico: "seguidores", criado_em: recente(5) }, pessoas.autor);
await postar({ texto: "Segredo de seguidores #tagseg", publico: "seguidores", criado_em: recente(6) }, pessoas.seguidor);
await postar({ texto: "Segredo de seguidores #tagseg", publico: "seguidores", criado_em: recente(7) }, pessoas.comunidade);
await postar({ texto: "Muito antigo #tagantiga", criado_em: new Date(Date.now() - 9 * 86400000).toISOString() }, pessoas.membro);
await postar({ texto: "Muito antigo #tagantiga", criado_em: new Date(Date.now() - 9 * 86400000).toISOString() }, pessoas.membro2);
await postar({ texto: "Muito antigo #tagantiga", criado_em: new Date(Date.now() - 9 * 86400000).toISOString() }, pessoas.membro3);
await espera("explorar: só tag usada por 3 autores diferentes ou mais, na semana", async () => (await rpc(como(pessoas.membro), "rede_desc_explorar")).tags.map((t) => t.tag).sort(), (t) => igual(t, ["tagaberta", "tagpop"]));
await espera("explorar: a contagem de posts da tag é agregada", async () => (await rpc(como(pessoas.membro), "rede_desc_explorar")).tags.find((t) => t.tag === "tagpop").posts, (p) => p === 3);
await espera("explorar: o visitante só conta o que a internet vê", async () => (await rpc(visitante(), "rede_desc_explorar")).tags.map((t) => t.tag), (t) => igual(t, ["tagaberta"]));
await espera("explorar: tag de posts que a pessoa não pode ver não vaza (seguidores)", async () => (await rpc(como(pessoas.membro2), "rede_desc_explorar")).tags.map((t) => t.tag).includes("tagseg"), (v) => v === false);
await espera("explorar: comunidades por permissão (visitante só disciplinas; fechada só de quem é dela)", async () => [
  (await rpc(visitante(), "rede_desc_explorar")).comunidades.map((c) => c.slug),
  (await rpc(como(pessoas.membro), "rede_desc_explorar")).comunidades.map((c) => c.slug),
  (await rpc(como(pessoas.comunidade), "rede_desc_explorar")).comunidades.map((c) => c.slug),
], (r) => igual(r[0], ["matematica"]) && r[1].includes("moradia") && !r[1].includes("greve-fechada") && r[2].includes("greve-fechada"));
await espera("explorar: linhas com regra pública e as quatro ordens; visitante não recebe 'eu' nem pacotes", async () => {
  const e = await rpc(visitante(), "rede_desc_explorar");
  return [e.linhas.length >= 4 && e.linhas.every((l) => l.regra.length >= 10), e.ordens, e.eu, e.pacotes];
}, (r) => r[0] && igual(r[1], ORDENS) && r[2] === null && igual(r[3], []));

// ── Primeira entrada guiada ──
const nova = como(pessoas.nova);
await espera("estado do visitante: 'entrar'", async () => (await rpc(visitante(), "rede_desc_entrada_estado")).passo, (p) => p === "entrar");
await espera("conta sem Rede: começa nas regras", async () => (await rpc(nova, "rede_desc_entrada_estado")).passo, (p) => p === "regras");
await recusa("escolher antes de declarar 18 anos", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "greve-geral", "saude-popular"], p_trilhas: ["a-b"] }), "confirme_idade");
await recusa("menor não adere (idade 18)", () => rpc(nova, "rede_aderir", { p_maior: false, p_versao: 1 }), "idade_minima");
await espera("depois de aderir (18+ e consentimento com a versão) o passo é o codinome", async () => {
  await rpc(nova, "rede_aderir", { p_maior: true, p_versao: 1 });
  return [(await rpc(nova, "rede_desc_entrada_estado")).passo, (await um("select versao from interno.rede_consentimentos where usuario = $1", [pessoas.nova])).versao];
}, (r) => r[0] === "codinome" && r[1] === 1);
await recusa("escolher antes do codinome", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "greve-geral", "saude-popular"], p_trilhas: ["a-b"] }), "confirme_codinome");
await espera("codinome definido: o passo é 'escolhas'", async () => {
  await rpc(nova, "rede_codinome_definir", { p_codinome: "Margarida Nova" });
  return (await rpc(nova, "rede_desc_entrada_estado")).passo;
}, (p) => p === "escolhas");
await espera("as lutas oferecidas não incluem comunidade fechada", async () => (await rpc(nova, "rede_desc_entrada_opcoes")).lutas.map((l) => l.slug).sort(), (l) => igual(l, ["greve-geral", "moradia", "saude-popular", "terra"]));
await recusa("duas lutas só", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra"], p_trilhas: ["a-b"] }), "invalido:lutas");
await recusa("quatro lutas", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra", "greve-geral", "saude-popular"], p_trilhas: ["a-b"] }), "invalido:lutas");
await recusa("luta de comunidade fechada", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra", "greve-fechada"], p_trilhas: ["a-b"] }), "invalido:lutas");
await recusa("luta que é disciplina", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra", "matematica"], p_trilhas: ["a-b"] }), "invalido:lutas");
await recusa("nenhuma trilha", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra", "greve-geral"], p_trilhas: [] }), "invalido:trilhas");
await recusa("quatro trilhas", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra", "greve-geral"], p_trilhas: ["aa", "bb", "cc", "dd"] }), "invalido:trilhas");
await recusa("trilha com nome estragado", () => rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra", "greve-geral"], p_trilhas: ["Nome Ruim!"] }), "invalido:trilhas");
await espera("o estado ainda é 'escolhas' depois de tentativas recusadas (nada foi gravado)", async () => [(await rpc(nova, "rede_desc_entrada_estado")).passo, (await um("select count(*)::int as n from interno.rede_desc_interesses where usuario = $1", [pessoas.nova])).n], (r) => r[0] === "escolhas" && r[1] === 0);
await espera("3 lutas + 3 trilhas: grava, entra nas comunidades abertas ligadas (luta e trilha) e não na restrita; aparecer fica desligado", async () => {
  const e = await rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "terra", "greve-geral"], p_trilhas: ["filosofia-politica", "historia-do-brasil", "economia-basica"] });
  const comunidades = (await todos("select comunidade from interno.rede_comunidade_membros where usuario = $1 order by 1", [pessoas.nova])).map((r) => r.comunidade);
  return [e.passo, e.lutas, e.trilhas, comunidades, e.aparece];
}, (r) => r[0] === "guia" && igual(r[1], ["greve-geral", "moradia", "terra"]) && r[2].length === 3 && igual(r[3], ["cultura", "greve-geral", "moradia"]) && r[4] === false);
await espera("o guia pode ser pulado (e só ele): o passo vira 'pronto'", async () => {
  const e = await rpc(nova, "rede_desc_entrada_guia", { p_pulado: true });
  return [e.passo, e.guia, (await um("select guia_pulado from interno.rede_desc_entrada where usuario = $1", [pessoas.nova])).guia_pulado];
}, (r) => r[0] === "pronto" && r[1] === true && r[2] === true);
await espera("quem volta a escolher troca as escolhas (não acumula) e não desfaz banimento", async () => {
  await dono("update interno.rede_comunidade_membros set situacao = 'banido' where usuario = $1 and comunidade = 'moradia'", [pessoas.nova]);
  const e = await rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia", "saude-popular", "greve-geral"], p_trilhas: ["economia-basica"], p_aparece: true });
  const banido = (await um("select situacao from interno.rede_comunidade_membros where usuario = $1 and comunidade = 'moradia'", [pessoas.nova])).situacao;
  return [e.lutas, e.trilhas, banido, e.aparece, e.passo];
}, (r) => igual(r[0], ["greve-geral", "moradia", "saude-popular"]) && igual(r[1], ["economia-basica"]) && r[2] === "banido" && r[3] === true && r[4] === "pronto");
await espera("com menos de 3 lutas disponíveis, a exigência cai para as que existem", async () => {
  await dono("update interno.rede_comunidades set categoria = 'instituto' where slug in ('saude-popular', 'greve-geral', 'terra')");
  const e = await rpc(nova, "rede_desc_entrada_escolher", { p_lutas: ["moradia"], p_trilhas: ["economia-basica"] });
  await dono("update interno.rede_comunidades set categoria = 'lutas' where slug in ('saude-popular', 'greve-geral', 'terra')");
  return e.lutas;
}, (l) => igual(l, ["moradia"]));
await recusa("visitante não escolhe (sem permissão)", () => rpc(visitante(), "rede_desc_entrada_escolher", { p_lutas: [], p_trilhas: ["aa"] }), "permission denied");
await recusa("visitante não pula o guia", () => rpc(visitante(), "rede_desc_entrada_guia", { p_pulado: true }), "permission denied");
await recusa("quem não é da Rede não ajusta o 'aparecer'", async () => { await dono("update interno.perfis set rede_consentimento = null where id = $1", [pessoas.aberta]); return rpc(como(pessoas.aberta), "rede_desc_aparecer", { p_sim: true }); }, "consentimento");
await dono("update interno.perfis set rede_consentimento = 1 where id = $1", [pessoas.aberta]);

// ── Pacotes de pessoas ──
await recusa("pacote novo: só a equipe cria", () => rpc(como(pessoas.membro), "rede_desc_pacote_salvar", { p_slug: "pacote-luta", p_titulo: "Pessoas da luta" }), "sem_permissao");
await recusa("pacote com nome estragado", () => rpc(authEquipe, "rede_desc_pacote_salvar", { p_slug: "Pacote Ruim", p_titulo: "Pessoas da luta" }), "invalido:slug");
await espera("a equipe cria o pacote", async () => (await rpc(authEquipe, "rede_desc_pacote_salvar", { p_slug: "pacote-luta", p_titulo: "Pessoas da luta", p_descricao: "Para começar a seguir." })).slug, (s) => s === "pacote-luta");
await recusa("pessoa que não aceitou aparecer não entra no pacote", () => rpc(authEquipe, "rede_desc_pacote_pessoa", { p_slug: "pacote-luta", p_handle: "aberta_luta", p_sim: true }), "invalido:pessoa");
await espera("quem aceita aparecer (perfil aberto) pode entrar", async () => {
  await rpc(como(pessoas.aberta), "rede_desc_aparecer", { p_sim: true });
  await rpc(authEquipe, "rede_desc_pacote_pessoa", { p_slug: "pacote-luta", p_handle: "@aberta_luta", p_sim: true });
  return (await um("select count(*)::int as n from interno.rede_desc_pacote_pessoas")).n;
}, (c) => c === 1);
for (const quemEh of ["trancada", "invisivel"]) {
  await rpc(como(pessoas[quemEh]), "rede_desc_aparecer", { p_sim: true });
  await recusa(`perfil ${quemEh} não entra em pacote, mesmo aceitando`, () => rpc(authEquipe, "rede_desc_pacote_pessoa", { p_slug: "pacote-luta", p_handle: `${quemEh}_luta`, p_sim: true }), "invalido:pessoa");
}
await espera("o pacote lista só perfil aberto que aceitou, sem nome civil", async () => {
  const p = await rpc(como(pessoas.membro), "rede_desc_pacote", { p_slug: "pacote-luta" });
  return [p.pessoas.map((x) => x.handle), JSON.stringify(p).includes("@descoberta.local")];
}, (r) => igual(r[0], ["aberta_luta"]) && r[1] === false);
await espera("o pacote aparece no Explorar com a contagem; sem pessoas elegíveis, some", async () => {
  const comPessoa = (await rpc(como(pessoas.membro), "rede_desc_explorar")).pacotes;
  const paraAPropria = (await rpc(como(pessoas.aberta), "rede_desc_explorar")).pacotes;
  return [comPessoa, paraAPropria];
}, (r) => r[0].length === 1 && r[0][0].pessoas === 1 && r[1].length === 0);
await espera("bloqueio entre as pessoas esconde do pacote", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.membro3, pessoas.aberta]);
  const r = (await rpc(como(pessoas.membro3), "rede_desc_pacote", { p_slug: "pacote-luta" })).pessoas.length;
  await dono("delete from interno.rede_bloqueios where quem = $1", [pessoas.membro3]);
  return r;
}, (n) => n === 0);
await espera("seguir o pacote: segue quem está nele, uma vez só", async () => {
  const a = await rpc(como(pessoas.membro2), "rede_desc_pacote_seguir", { p_slug: "pacote-luta" });
  const b = await rpc(como(pessoas.membro2), "rede_desc_pacote_seguir", { p_slug: "pacote-luta" });
  const sigo = (await rpc(como(pessoas.membro2), "rede_desc_pacote", { p_slug: "pacote-luta" })).pessoas[0].sigo;
  const linha = await um("select pendente from interno.rede_seguindo where quem = $1 and segue = $2", [pessoas.membro2, pessoas.aberta]);
  return [a.seguidos, b.seguidos, sigo, linha.pendente];
}, (r) => r[0] === 1 && r[1] === 0 && r[2] === true && r[3] === false);
await espera("deixar de aparecer tira a pessoa do pacote na hora", async () => {
  await rpc(como(pessoas.aberta), "rede_desc_aparecer", { p_sim: false });
  return (await rpc(como(pessoas.membro), "rede_desc_pacote", { p_slug: "pacote-luta" })).pessoas.length;
}, (n) => n === 0);
await espera("pacote inativo some; tirar pessoa pela equipe funciona", async () => {
  await rpc(como(pessoas.aberta), "rede_desc_aparecer", { p_sim: true });
  await rpc(authEquipe, "rede_desc_pacote_pessoa", { p_slug: "pacote-luta", p_handle: "aberta_luta", p_sim: false });
  const aposTirar = (await um("select count(*)::int as n from interno.rede_desc_pacote_pessoas")).n;
  await rpc(authEquipe, "rede_desc_pacote_salvar", { p_slug: "pacote-luta", p_titulo: "Pessoas da luta", p_ativo: false });
  return [aposTirar, await rpc(como(pessoas.membro), "rede_desc_pacote", { p_slug: "pacote-luta" }).then(() => "achou", (e) => String(e.message))];
}, (r) => r[0] === 0 && /nao_encontrado/.test(r[1]));
await recusa("visitante não abre pacote (sem permissão)", () => rpc(visitante(), "rede_desc_pacote", { p_slug: "pacote-luta" }), "permission denied");

// ── Permissões e segredos ──
await espera("nenhuma função interna do pacote é executável por anon ou authenticated", async () => todos("select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r where n.nspname = 'interno' and p.proname like 'rede3_desc_%' and r.rolname in ('anon', 'authenticated') and has_function_privilege(r.oid, p.oid, 'execute')"), (r) => r.length === 0);
await espera("nenhuma tabela do pacote é acessível por anon ou authenticated, e todas têm RLS ligada", async () => ({
  acesso: await todos("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join pg_roles r where n.nspname = 'interno' and c.relname like 'rede_desc_%' and c.relkind = 'r' and r.rolname in ('anon', 'authenticated') and (has_table_privilege(r.oid, c.oid, 'select') or has_table_privilege(r.oid, c.oid, 'insert') or has_table_privilege(r.oid, c.oid, 'update') or has_table_privilege(r.oid, c.oid, 'delete'))"),
  semRls: await todos("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname like 'rede_desc_%' and c.relkind = 'r' and not c.relrowsecurity"),
  noPublic: await todos("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'rede_desc_%'"),
}), (r) => r.acesso.length === 0 && r.semRls.length === 0 && r.noPublic.length === 0);
await espera("as funções públicas são security definer com search_path fixo", async () => todos("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede_desc_%' and (not p.prosecdef or p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))"), (r) => r.length === 0);
await espera("anon lê (linha, tag, busca, explorar, estado) e não escreve (escolher, guia, aparecer, pacote, salvar)", async () => (await um(`select
  has_function_privilege('anon', 'public.rede_desc_linha(text, text, text, integer, jsonb)', 'execute') as linha, has_function_privilege('anon', 'public.rede_desc_tag(text, text, text, integer)', 'execute') as tag,
  has_function_privilege('anon', 'public.rede_desc_buscar(text, text, text, integer)', 'execute') as busca, has_function_privilege('anon', 'public.rede_desc_explorar()', 'execute') as explorar,
  has_function_privilege('anon', 'public.rede_desc_entrada_estado()', 'execute') as estado,
  has_function_privilege('anon', 'public.rede_desc_entrada_escolher(text[], text[], boolean)', 'execute') as escolher, has_function_privilege('anon', 'public.rede_desc_entrada_guia(boolean)', 'execute') as guia,
  has_function_privilege('anon', 'public.rede_desc_aparecer(boolean)', 'execute') as aparecer, has_function_privilege('anon', 'public.rede_desc_pacote_seguir(text)', 'execute') as seguir,
  has_function_privilege('anon', 'public.rede_desc_pacote_salvar(text, text, text, integer, boolean)', 'execute') as salvar,
  has_function_privilege('authenticated', 'public.rede_desc_entrada_escolher(text[], text[], boolean)', 'execute') as escolher_auth`)), (p) => p.linha && p.tag && p.busca && p.explorar && p.estado && !p.escolher && !p.guia && !p.aparecer && !p.seguir && !p.salvar && p.escolher_auth);
await espera("a busca tem limite por pessoa (contra raspagem)", async () => {
  const eu = como(pessoas.membro3);
  let recusada = 0;
  for (let i = 0; i < 130; i++) {
    try {
      await buscar(eu, "teste de limite");
    } catch (e) {
      if (String(e.message).includes("muitos_pedidos") || String(e.message).includes("limite")) recusada++;
      else throw e;
    }
  }
  return recusada;
}, (r) => r > 0);
await espera("o recurso rede-v2 continua só pelo nome (as telas novas ficam atrás dele)", async () => /SO_PELO_NOME[^=]*=\s*\[[^\]]*"rede-v2"/.test(lerTexto("lib/recursos.ts")), (v) => v === true);

// ── Textos nos seis idiomas ──
const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${pre}${k}.`) : [`${pre}${k}`]));
const chavesPt = achatar(JSON.parse(lerTexto("i18n/rede/descoberta/pt.json"))).sort();
await espera("os seis idiomas do pacote têm as mesmas chaves; pt é final e os outros cinco são rascunho marcado", async () => {
  const r = { pt: JSON.parse(lerTexto("i18n/rede/descoberta/pt.json"))._rascunho === undefined };
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(lerTexto(`i18n/rede/descoberta/${l}.json`));
    r[l] = JSON.stringify(achatar(j).filter((k) => k !== "_rascunho").sort()) === JSON.stringify(chavesPt) && j._rascunho === true;
  }
  return r;
}, (r) => Object.values(r).every(Boolean));
await espera("nenhum texto está vazio nem sobra {marcador} que a tela não preenche diferente do português", async () => {
  const problemas = [];
  const pt = JSON.parse(lerTexto("i18n/rede/descoberta/pt.json"));
  const folhas = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? folhas(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]));
  const marcadores = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const base = new Map(folhas(pt).map(([k, v]) => [k, marcadores(v)]));
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    for (const [k, v] of folhas(JSON.parse(lerTexto(`i18n/rede/descoberta/${l}.json`)))) {
      if (k === "_rascunho") continue;
      if (String(v).trim() === "") problemas.push(`${l}:${k} vazio`);
      else if (marcadores(v) !== base.get(k)) problemas.push(`${l}:${k} marcadores`);
    }
  }
  return problemas;
}, (p) => p.length === 0);
await espera("o consentimento destacado cita o art. 11, I da LGPD e a versão das regras é gravada", async () => {
  const pt = JSON.parse(lerTexto("i18n/rede/descoberta/pt.json"));
  return [/art\. 11, I/.test(pt.entrada.consentimento.caixa), /art\. 5º, II/.test(pt.entrada.consentimento.texto), /art\. 14/.test(pt.entrada.idade.texto), /art\. 18/.test(pt.entrada.consentimento.revogar), /rede_consentimentos/.test(migracao) || /rede_aderir/.test(migracao)];
}, (r) => r.every(Boolean));
await espera("o passo a passo tem os seis passos na ordem da ESPEC e só o guia tem 'pular'", async () => {
  const fonte = lerTexto("components/rede/descoberta/PrimeiraEntrada.tsx");
  const tipos = lerTexto("lib/rede/tipos-descoberta.ts");
  return [/PASSOS = \["regras", "consentimento", "idade", "codinome", "escolhas", "guia"\]/.test(tipos), (fonte.match(/guia\.pular/g) ?? []).length === 1, !/escolhas\.pular|codinome\.pular|idade\.pular|consentimento\.pular|regras\.pular/.test(fonte)];
}, (r) => r.every(Boolean));

// ── Telas, rotas e ligações ──
await espera("as rotas explorar, buscar e tag existem, atrás do recurso (404 desligado) e sem trecho de conteúdo nos metadados", async () => {
  const dir = "app/[lang]/comunidade";
  return ["explorar/page.tsx", "buscar/page.tsx", "tag/[tag]/page.tsx"].map((a) => {
    const f = lerTexto(`${dir}/${a}`);
    return { a, ok: /ligado\("rede-v2"\)/.test(f) && /notFound\(\)/.test(f) && /index: false/.test(f) && /RedeSobDemanda/.test(f) };
  });
}, (r) => r.every((x) => x.ok));
await espera("o registro tem as três telas com import dinâmico; a casca liga Explorar e leva a busca para a Rede", async () => {
  const reg = lerTexto("components/rede/registro.tsx");
  const casca = lerTexto("components/rede/Casca.tsx");
  return [/explorar: \{ componente: dynamic\(\(\) => import\("\.\/descoberta\/Explorar"\)/.test(reg), /buscar: \{ componente: dynamic\(\(\) => import\("\.\/descoberta\/Buscar"\)/.test(reg), /tag: \{ componente: dynamic\(\(\) => import\("\.\/descoberta\/Tag"\)/.test(reg), /chave: "explorar"/.test(casca), /comunidade\/buscar/.test(casca)];
}, (r) => r.every(Boolean));
await espera("a Rede usa a porta da primeira entrada (com a entrada simples de reserva) e o cartão de post liga as hashtags", async () => [/PortaDaEntrada/.test(lerTexto("components/rede/Rede.tsx")), /alternativa=/.test(lerTexto("components/rede/Rede.tsx")), /TextoComTags/.test(lerTexto("components/rede/CartaoDePost.tsx"))], (r) => r.every(Boolean));
await espera("a lista de trilhas é estática, atrás do recurso, e lê o catálogo só na rota (nunca em componente)", async () => {
  const rota = lerTexto("app/api/rede/trilhas/[lang]/route.ts");
  const comps = fs.readdirSync(new URL("../components/rede/descoberta/", import.meta.url)).map((f) => lerTexto(`components/rede/descoberta/${f}`)).join("\n");
  return [/force-static/.test(rota), /ligado\("rede-v2"\)/.test(rota), /getTracks/.test(rota), !/from "node:fs"|from "fs"|lib\/content/.test(comps)];
}, (r) => r.every(Boolean));
await espera("as telas não usam alert, confirm nem prompt, e a lib do pacote não usa '@/'", async () => {
  const comps = fs.readdirSync(new URL("../components/rede/descoberta/", import.meta.url)).map((f) => lerTexto(`components/rede/descoberta/${f}`)).join("\n");
  const libs = ["tipos-descoberta", "cliente-descoberta", "textos-descoberta"].map((f) => lerTexto(`lib/rede/${f}.ts`)).join("\n");
  return [/window\.(alert|confirm|prompt)|\b(alert|confirm|prompt)\(/.test(comps), /from "@\//.test(libs)];
}, (r) => r[0] === false && r[1] === false);
await espera("o menu da Rede tem 'explorar' nos seis idiomas", async () => ["pt", "en", "es", "fr", "ru", "zh"].every((l) => typeof JSON.parse(lerTexto(`i18n/rede/${l}.json`)).menu.explorar === "string"), (v) => v === true);
await espera("a migração não toca no install.sql nem cria tabela no esquema public", async () => !/create table (if not exists )?public\./i.test(migracao) && !/install\.sql/.test(migracao.replace(/--[^\n]*/g, "")), (v) => v === true);

// ── T18: a primeira entrada curta (lutas, trilhas e guia opcionais; consentimento, 18+ e codinome continuam obrigatórios) ──
const curta = lerTexto("supabase/migracoes/20261106-t18-alumia-entrada.sql");
await espera("a migração da entrada curta instala por cima (e de novo, sem estrago)", () => banco.exclusivo(async () => { await banco.pg.exec(curta); await banco.pg.exec(curta); }));
const pressa = await criarUsuario("pressa@descoberta.local", "pressa");
const comPressa = como(pressa);
await rpc(comPressa, "eu");
await dono("update interno.perfis set rede_codinome = null, rede_codinome_ok = false where id = $1", [pressa]);
await recusa("adiar sem consentimento nem 18+ não passa", () => rpc(comPressa, "rede_desc_entrada_adiar"), "consentimento");
await espera("adiar sem codinome não pula o codinome", async () => {
  await rpc(comPressa, "rede_aderir", { p_maior: true, p_versao: 1 });
  return (await rpc(comPressa, "rede_desc_entrada_estado")).passo;
}, (p) => p === "codinome");
await espera("com codinome, 'agora não' leva direto ao 'pronto', sem gravar luta nem trilha", async () => {
  await rpc(comPressa, "rede_codinome_definir", { p_codinome: "Pressa Boa" });
  const e = await rpc(comPressa, "rede_desc_entrada_adiar");
  const n = (await um("select count(*)::int as n from interno.rede_desc_interesses where usuario = $1", [pressa])).n;
  return [e.passo, e.adiou, n, (await um("select versao from interno.rede_consentimentos where usuario = $1", [pressa]))?.versao];
}, (r) => r[0] === "pronto" && r[1] === true && r[2] === 0 && r[3] === 1);
await espera("quem adiou escolhe depois normalmente (as escolhas continuam valendo)", async () => {
  const lutas = (await rpc(comPressa, "rede_desc_entrada_opcoes")).lutas.map((l) => l.slug).slice(0, 3);
  return [lutas, (await rpc(comPressa, "rede_desc_entrada_escolher", { p_lutas: lutas, p_trilhas: ["economia-basica"] })).lutas];
}, (r) => r[0].length > 0 && igual([...r[0]].sort(), r[1]));
await espera("quem já tinha escolhido continua 'pronto' com a função nova", async () => (await rpc(nova, "rede_desc_entrada_estado")).passo, (p) => p === "pronto");
await espera("visitante e anon: estado sim, adiar não", async () => um(`select has_function_privilege('anon', 'public.rede_desc_entrada_estado()', 'execute') as estado, has_function_privilege('anon', 'public.rede_desc_entrada_adiar()', 'execute') as adiar`), (r) => r.estado === true && r.adiar === false);

console.log(`Rede v2 (descoberta): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
