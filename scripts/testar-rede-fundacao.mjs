// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a fundação das funções da Rede v2 (supabase/migracoes/2026-11-rede-fundacao.sql) num Postgres de verdade dentro
// do Node: cada célula da matriz de visibilidade (docs/rede/ESPEC.md, seção 2), a linha com cursor e as quatro abas, o
// contador "N novos", o post com a conversa, a adesão (18 anos e consentimento), a publicação com seus limites, a
// migração do Fórum (idempotente, sem apagar nada) e as permissões. Também confere o contrato dos tipos e do cliente
// (lib/rede/tipos.ts, lib/rede/cliente.ts) e dos textos (i18n/rede). Uso: npm run testar:rede-fundacao
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { destinoDireto, destinoNovo, pedidoAntigo } from "../lib/rede/antigos.ts";
import { enderecos, handleOk, idOk, slugOk } from "../lib/rede/tipos.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 240)}`);
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
const migracao = fs.readFileSync(new URL("../supabase/migracoes/2026-11-rede-fundacao.sql", import.meta.url), "utf8");

await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("instalar de novo não quebra", () => banco.exclusivo(() => banco.pg.exec(migracao)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

// ── As pessoas ──
const pessoas = {};
const nomes = ["autor", "membro", "seguidor", "comunidade", "nucleo", "equipe", "bloqueado", "semconta", "suspensa", "pendente", "menor", "nova"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@rede.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [pessoas[nome], `Lutadora ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis where usuario <> $1", [pessoas.equipe]);
await dono("insert into interno.papeis (usuario, papel) select $1, 'educacao' where not exists (select 1 from interno.papeis where usuario = $1)", [pessoas.equipe]);
const VERSAO = 1;
await dono("insert into interno.rede_regras (versao, texto) values ($1, $2) on conflict do nothing", [VERSAO, "Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["autor", "membro", "seguidor", "comunidade", "nucleo", "equipe", "bloqueado", "suspensa", "pendente"]) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = $2 where id = $1", [pessoas[nome], VERSAO]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, $2)", [pessoas[nome], VERSAO]);
}
// Contas criadas agora contam como novas (metade do teto de posts por hora): para os testes de volume, a conta fica velha.
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set suspenso = true where id = $1", [pessoas.suspensa]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [pessoas.seguidor, pessoas.autor]);
await dono("insert into interno.rede_seguindo (quem, segue, pendente) values ($1, $2, true)", [pessoas.pendente, pessoas.autor]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.autor, pessoas.bloqueado]);
await dono("update interno.perfis set rede_handle = $2 where id = $1", [pessoas.autor, "autora_luta"]);
await dono("update interno.perfis set rede_handle = $2 where id = $1", [pessoas.membro, "membro_luta"]);

await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao, apelidos) values
  ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet', '{matematica-antiga}'),
  ('moradia', 'Moradia', 'lutas', 'aberta', 'membros', '{}'),
  ('greve-restrita', 'Greve (restrita)', 'lutas', 'restrita', 'comunidade', '{}'),
  ('greve-fechada', 'Greve (fechada)', 'lutas', 'fechada', 'comunidade', '{}')`);
for (const slug of ["greve-restrita", "greve-fechada", "moradia"]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ($1, $2)", [slug, pessoas.comunidade]);
}
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('moradia', $1, 'moderacao')", [pessoas.autor]);
await dono("insert into interno.rede_comunidade_flairs (comunidade, nome) values ('moradia', 'Aluguel')");
const nucleo = (await um("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo do teste', 'Niterói') returning id")).id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro')", [nucleo, pessoas.nucleo]);

const postar = async (campos, autor = pessoas.autor) => {
  const colunas = Object.keys(campos);
  const linha = await um(`insert into interno.rede_posts (autor, texto, ${colunas.join(", ")}) values ($1, 'post do teste', ${colunas.map((_, i) => `$${i + 2}`).join(", ")}) returning id`, [autor, ...Object.values(campos)]);
  return linha.id;
};
const ve = async (post, quem) => (await um("select interno.rede_ve(p, $2) as v from interno.rede_posts p where p.id = $1", [post, quem])).v;

// ── A matriz da ESPEC, célula por célula (6 públicos × 8 colunas) ──
const colunas = ["visitante", "membro", "seguidor", "comunidade", "nucleo", "equipe", "autor", "bloqueado"];
const quem = (coluna) => (coluna === "visitante" ? null : pessoas[coluna]);
const matriz = [
  ["Internet (disciplinas)", { publico: "internet", comunidade: "matematica" }, [1, 1, 1, 1, 1, 1, 1, 0]],
  ["Membros da Rede", { publico: "membros" }, [0, 1, 1, 1, 1, 1, 1, 0]],
  ["Quem me segue", { publico: "seguidores" }, [0, 0, 1, 0, 0, 0, 1, 0]],
  ["Comunidade fechada", { publico: "comunidade", comunidade: "greve-fechada" }, [0, 0, 0, 1, 0, 0, 1, 0]],
  ["Núcleo", { publico: "nucleo", nucleo }, [0, 0, 0, 0, 1, 0, 1, 0]],
  ["Equipe do instituto", { publico: "equipe" }, [0, 0, 0, 0, 0, 1, 1, 0]],
];
const postDaMatriz = {};
for (const [linha, campos, esperado] of matriz) {
  const post = await postar(campos);
  postDaMatriz[linha] = post;
  for (const [i, coluna] of colunas.entries()) {
    await espera(`matriz: "${linha}" × ${coluna} = ${esperado[i] ? "vê" : "não vê"}`, () => ve(post, quem(coluna)), (v) => v === Boolean(esperado[i]));
  }
}
// "Só restrita lê": numa comunidade restrita, o membro da Rede lê o que foi para membros; o que é "só da comunidade" fica de dentro.
const restritaMembros = await postar({ publico: "membros", comunidade: "greve-restrita" });
const restritaSo = await postar({ publico: "comunidade", comunidade: "greve-restrita" });
await espera("restrita: membro da Rede lê o que foi para membros", () => ve(restritaMembros, pessoas.membro), (v) => v === true);
await espera("restrita: visitante não lê", () => ve(restritaMembros, null), (v) => v === false);
await espera("restrita: o que é só da comunidade não vai para o membro de fora", () => ve(restritaSo, pessoas.membro), (v) => v === false);
// A equipe não entra em núcleo nem em comunidade fechada pela matriz (o quebra-vidro é registrado à parte).
await espera("o asterisco: equipe fora do núcleo continua sem ver (só o quebra-vidro, registrado)", () => ve(postDaMatriz["Núcleo"], pessoas.equipe), (v) => v === false);
// Regras que valem para toda linha da matriz.
for (const [estado, sql] of [["removido", "oculto = true"], ["retido para revisão", "retido = true"], ["apagado", "apagado_em = now()"]]) {
  const post = await postar({ publico: "membros" });
  await dono(`update interno.rede_posts set ${sql} where id = $1`, [post]);
  await espera(`post ${estado}: ninguém vê, o autor vê`, async () => [await ve(post, pessoas.membro), await ve(post, pessoas.equipe), await ve(post, pessoas.autor)], (r) => r[0] === false && r[1] === false && r[2] === true);
}
await espera("conta suspensa não vê nada", async () => ve(postDaMatriz["Membros da Rede"], pessoas.suspensa), (v) => v === false);
await espera("conta no site que não entrou na Rede não é membro", async () => ve(postDaMatriz["Membros da Rede"], pessoas.semconta), (v) => v === false);
await espera("pedido de seguir pendente (perfil trancado) não vê", async () => ve(postDaMatriz["Quem me segue"], pessoas.pendente), (v) => v === false);
// O espaço fechado da Rede de hoje não vaza para quem é só "membro da Rede".
await dono("insert into interno.rede_espacos (slug, nome, criado_por, codigo) values ('fechado-velho', 'Espaço velho', $1, 'ABCDEFGHIJKL')", [pessoas.autor]);
await dono("insert into interno.rede_espaco_membros (espaco, usuario) values ('fechado-velho', $1)", [pessoas.comunidade]);
const doEspaco = await postar({ comunidade: "fechado-velho", alcance: "publico" });
await espera("espaço fechado da Rede de hoje: membro da Rede de fora não vê", () => ve(doEspaco, pessoas.membro), (v) => v === false);
await espera("espaço fechado da Rede de hoje: quem é do espaço vê, o autor vê", async () => [await ve(doEspaco, pessoas.comunidade), await ve(doEspaco, pessoas.autor)], (r) => r[0] === true && r[1] === true);

// ── Linha, abas, cursor ──
// Posts em massa, de primeiro nível, com tempos distintos (a ordem da linha é a do tempo).
await dono("delete from interno.rede_posts");
const base = Date.now() - 3 * 24 * 3600 * 1000;
const lote = [];
for (let i = 0; i < 25; i++) {
  lote.push(await postar({ publico: "membros", criado_em: new Date(base + i * 60000).toISOString() }, i % 2 ? pessoas.autor : pessoas.seguidor));
}
const seguidoresPost = await postar({ publico: "seguidores", criado_em: new Date(base + 26 * 60000).toISOString() });
const internetPost = await postar({ publico: "internet", comunidade: "matematica", criado_em: new Date(base + 27 * 60000).toISOString() });
const comunidadePost = await postar({ publico: "comunidade", comunidade: "greve-fechada", criado_em: new Date(base + 28 * 60000).toISOString() });
const moradiaPost = await postar({ publico: "membros", comunidade: "moradia", criado_em: new Date(base + 29 * 60000).toISOString() });

await recusa("visitante não lê a linha Tudo", () => rpc(visitante(), "rede_linha", { p_aba: "tudo" }), "entre_primeiro");
await recusa("visitante não lê a linha Seguindo", () => rpc(visitante(), "rede_linha", { p_aba: "seguindo" }), "entre_primeiro");
await recusa("aba inventada é recusada", () => rpc(como(pessoas.membro), "rede_linha", { p_aba: "qualquer" }), "invalido:aba");
await recusa("cursor estragado é recusado", () => rpc(como(pessoas.membro), "rede_linha", { p_aba: "tudo", p_cursor: "lixo|lixo" }), "invalido:cursor");
await espera("a linha geral é aberta: o visitante vê só o que é da internet", async () => (await rpc(visitante(), "rede_linha", { p_aba: "geral" })).itens.map((i) => i.id), (ids) => ids.length === 1 && ids[0] === internetPost);
await espera("Tudo para membro: vê membros, internet e comunidade que é dele, não vê post de seguidores nem de comunidade fechada alheia", async () => {
  const ids = new Set();
  let cursor = null;
  do {
    const r = await rpc(como(pessoas.membro), "rede_linha", { p_aba: "tudo", p_cursor: cursor, p_limite: 50 });
    r.itens.forEach((i) => ids.add(i.id));
    cursor = r.proximo;
  } while (cursor);
  return ids;
}, (ids) => ids.size === 25 + 2 && ids.has(internetPost) && ids.has(moradiaPost) && !ids.has(seguidoresPost) && !ids.has(comunidadePost));
await espera("paginação por cursor: 10 por vez, sem repetir e sem pular, do mais novo ao mais velho", async () => {
  const vistos = [];
  let cursor = null;
  let paginas = 0;
  do {
    const r = await rpc(como(pessoas.membro), "rede_linha", { p_aba: "tudo", p_cursor: cursor, p_limite: 10 });
    r.itens.forEach((i) => vistos.push(i));
    cursor = r.proximo;
    paginas++;
  } while (cursor && paginas < 10);
  const ordenado = [...vistos].sort((a, b) => (a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0));
  return { n: vistos.length, unicos: new Set(vistos.map((v) => v.id)).size, paginas, ordem: JSON.stringify(ordenado.map((v) => v.id)) === JSON.stringify(vistos.map((v) => v.id)) };
}, (r) => r.n === 27 && r.unicos === 27 && r.paginas === 3 && r.ordem);
await espera("o limite não passa de 50", async () => (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "tudo", p_limite: 500 })).itens.length, (n) => n === 27);
await espera("Seguindo: o que o seguidor escreveu e o que ele segue", async () => {
  const r = await rpc(como(pessoas.seguidor), "rede_linha", { p_aba: "seguindo", p_limite: 50 });
  return r.itens.map((i) => i.id);
}, (ids) => ids.includes(seguidoresPost) && ids.includes(lote[1]) && ids.includes(lote[0]) && !ids.includes(comunidadePost));
await espera("Minhas comunidades: só as que a pessoa integra", async () => (await rpc(como(pessoas.comunidade), "rede_linha", { p_aba: "comunidades", p_limite: 50 })).itens.map((i) => i.id), (ids) => ids.includes(moradiaPost) && ids.includes(comunidadePost) && !ids.includes(internetPost));
await espera("Minhas comunidades de quem não é de nenhuma: vazia", async () => (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "comunidades" })).itens, (itens) => itens.length === 0);
await espera("a página de comunidade pelo apelido antigo entra na comunidade nova", async () => (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "c:matematica-antiga" })).itens.map((i) => i.id), (ids) => ids.length === 1 && ids[0] === internetPost);
await espera("a linha de um perfil pelo @handle", async () => (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "u:autora_luta", p_limite: 50 })).itens.every((i) => i.autor.id === pessoas.autor), (v) => v === true);
await dono("update interno.perfis set rede_modo = 'trancado' where id = $1", [pessoas.autor]);
await espera("perfil trancado: quem não é seguidor aprovado não lê a linha dele", async () => (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "u:autora_luta" })).itens, (itens) => itens.length === 0);
await espera("perfil trancado: o seguidor aprovado lê", async () => (await rpc(como(pessoas.seguidor), "rede_linha", { p_aba: "u:autora_luta" })).itens.length, (n) => n > 0);
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [pessoas.autor]);
await recusa("perfil invisível não existe para os outros", () => rpc(como(pessoas.membro), "rede_linha", { p_aba: "u:autora_luta" }), "nao_encontrado");
await dono("update interno.perfis set rede_modo = 'aberto' where id = $1", [pessoas.autor]);
await espera("quem bloqueou não vê a linha de quem foi bloqueado, e vice-versa", async () => {
  const doBloqueado = await postar({ publico: "membros" }, pessoas.bloqueado);
  const a = (await rpc(como(pessoas.autor), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens.map((i) => i.id);
  const b = (await rpc(como(pessoas.bloqueado), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens.map((i) => i.id);
  return a.includes(doBloqueado) === false && b.some((id) => lote.includes(id) && lote.indexOf(id) % 2 === 1) === false;
}, (v) => v === true);
await espera("silenciar uma pessoa tira da linha só de quem silenciou", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [pessoas.membro, pessoas.seguidor]);
  const doMembro = (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens;
  const doOutro = (await rpc(como(pessoas.comunidade), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens;
  return [doMembro.some((i) => i.autor.id === pessoas.seguidor), doOutro.some((i) => i.autor.id === pessoas.seguidor)];
}, (r) => r[0] === false && r[1] === true);

// O post na linha: só codinome, e as contagens sensíveis só para quem escreveu.
await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'apoio'), ($1, $3, 'apoio')", [lote[1], pessoas.membro, pessoas.comunidade]);
await espera("apoios: o autor vê o número, os outros não (decisão 3)", async () => {
  const autor = (await rpc(como(pessoas.autor), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens.find((i) => i.id === lote[1]);
  const outro = (await rpc(como(pessoas.comunidade), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens.find((i) => i.id === lote[1]);
  return [autor.apoios, outro.apoios, outro.apoiei];
}, (r) => r[0] === 2 && r[1] === null && r[2] === true);
await espera("a Rede de hoje também conta: apoio antigo soma para o autor", async () => {
  await dono("insert into interno.rede_apoios (post, usuario) values ($1, $2)", [lote[1], pessoas.nucleo]);
  return (await rpc(como(pessoas.autor), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens.find((i) => i.id === lote[1]).apoios;
}, (n) => n === 3);
await espera("a pessoa só aparece pelo codinome (nunca o nome do painel)", async () => {
  const item = (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "tudo", p_limite: 5 })).itens[0];
  return JSON.stringify(item).toLowerCase().includes("@rede.local") === false && /^Lutadora/.test(item.autor.codinome);
}, (v) => v === true);
await espera("'Eu vou': o total só sai para quem organizou", async () => {
  const chamado = await postar({ publico: "membros", chamado: JSON.stringify({ tipo: "ato", quando: new Date(Date.now() + 86400000).toISOString(), onde: "Praça" }) });
  await dono("insert into interno.rede_vou (post, usuario) values ($1, $2), ($1, $3)", [chamado, pessoas.membro, pessoas.comunidade]);
  const org = (await rpc(como(pessoas.autor), "rede_post", { p_id: chamado })).post;
  const eu = (await rpc(como(pessoas.membro), "rede_post", { p_id: chamado })).post;
  return [org.vou, eu.vou, eu.vou_eu];
}, (r) => r[0] === 2 && r[1] === null && r[2] === true);

// ── "N novos" ──
await espera("rede_novos conta só o que a pessoa vê, de outros, depois do instante", async () => {
  const desde = new Date((await um("select clock_timestamp() as t")).t).toISOString();
  await new Promise((r) => setTimeout(r, 25));
  await postar({ publico: "membros" }, pessoas.seguidor);
  await postar({ publico: "seguidores" }, pessoas.seguidor);
  await postar({ publico: "membros" }, pessoas.membro);
  return [
    await rpc(como(pessoas.comunidade), "rede_novos", { p_aba: "tudo", p_desde: desde }),
    await rpc(como(pessoas.membro), "rede_novos", { p_aba: "tudo", p_desde: desde }),
    await rpc(como(pessoas.membro), "rede_novos", { p_aba: "seguindo", p_desde: desde }),
    await rpc(visitante(), "rede_novos", { p_aba: "geral", p_desde: desde }),
  ];
}, (r) => r[0] === 2 && r[1] === 0 && r[2] === 0 && r[3] === 0);
await recusa("rede_novos de aba que pede conta, sem conta", () => rpc(visitante(), "rede_novos", { p_aba: "tudo", p_desde: new Date().toISOString() }), "entre_primeiro");

// ── Um post e a conversa ──
const raiz = await postar({ publico: "membros" });
const r1 = (await um("insert into interno.rede_posts (autor, texto, resposta_a, publico) values ($1, 'r1', $2, 'membros') returning id", [pessoas.membro, raiz])).id;
const r2 = (await um("insert into interno.rede_posts (autor, texto, resposta_a, publico) values ($1, 'r2', $2, 'equipe') returning id", [pessoas.equipe, r1])).id;
const r3 = (await um("insert into interno.rede_posts (autor, texto, resposta_a, publico) values ($1, 'r3', $2, 'membros') returning id", [pessoas.comunidade, r1])).id;
await espera("rede_post: a conversa só traz o que a pessoa pode ver", async () => {
  const membro = await rpc(como(pessoas.membro), "rede_post", { p_id: raiz });
  const equipe = await rpc(como(pessoas.equipe), "rede_post", { p_id: raiz });
  return [membro.respostas.map((r) => r.id).sort(), equipe.respostas.map((r) => r.id).sort(), membro.post.respostas, membro.post.na_conversa, equipe.post.na_conversa];
}, (r) => JSON.stringify(r[0]) === JSON.stringify([r1, r3].sort()) && JSON.stringify(r[1]) === JSON.stringify([r1, r2, r3].sort()) && r[2] === 1 && r[3] === 2 && r[4] === 3);
await espera("rede_post de uma resposta traz a cadeia acima", async () => (await rpc(como(pessoas.membro), "rede_post", { p_id: r3 })).acima.map((a) => a.id), (ids) => ids.length === 2 && ids[0] === raiz && ids[1] === r1);
await recusa("post que a pessoa não pode ver responde 'não encontrado'", () => rpc(como(pessoas.membro), "rede_post", { p_id: r2 }), "nao_encontrado");
await recusa("visitante não abre post de membros", () => rpc(visitante(), "rede_post", { p_id: raiz }), "nao_encontrado");
await espera("visitante abre post da internet (disciplinas)", async () => (await rpc(visitante(), "rede_post", { p_id: internetPost })).post.id, (id) => id === internetPost);
await espera("o corpo inteiro só vem na página do post, não na linha", async () => {
  await dono("update interno.rede_posts set tipo = 'discussao', titulo = 'Titulo grande', corpo = $2, texto = left($2, 500) where id = $1", [raiz, "x".repeat(2000)]);
  const pagina = (await rpc(como(pessoas.membro), "rede_post", { p_id: raiz })).post;
  const linha = (await rpc(como(pessoas.membro), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens.find((i) => i.id === raiz);
  return [pagina.corpo?.length, linha.corpo, linha.longo];
}, (r) => r[0] === 2000 && r[1] === null && r[2] === true);

// ── Adesão ──
await espera("rede_situacao do visitante", async () => rpc(visitante(), "rede_situacao"), (s) => s.logado === false && s.membro === false);
await recusa("menor de 18 não entra", () => rpc(como(pessoas.menor), "rede_aderir", { p_maior: false, p_versao: 1 }), "idade_minima");
await recusa("versão das normas errada", () => rpc(como(pessoas.menor), "rede_aderir", { p_maior: true, p_versao: 9 }), "invalido:versao");
await recusa("visitante não adere", () => rpc(visitante(), "rede_aderir", { p_maior: true, p_versao: 1 }), "permission denied");
await espera("quem declara 18 anos e consente vira membro (e o registro fica)", async () => {
  const antes = await rpc(como(pessoas.semconta), "rede_situacao");
  const depois = await rpc(como(pessoas.semconta), "rede_aderir", { p_maior: true, p_versao: 1 });
  const linhas = await todos("select count(*)::int as n from interno.rede_consentimentos where usuario = $1 and versao = 1 and revogado_em is null", [pessoas.semconta]);
  return [antes.membro, depois.membro, depois.maior, linhas[0].n];
}, (r) => r[0] === false && r[1] === true && r[2] === true && r[3] === 1);
await espera("aderir de novo não duplica o consentimento", async () => {
  await rpc(como(pessoas.semconta), "rede_aderir", { p_maior: true, p_versao: 1 });
  return (await um("select count(*)::int as n from interno.rede_consentimentos where usuario = $1", [pessoas.semconta])).n;
}, (n) => n === 1);

// ── Publicar ──
await recusa("sem 18 anos confirmados não publica", () => rpc(como(pessoas.menor), "rede_publicar", { p: { texto: "oi" } }), "confirme_idade");
await dono("update interno.perfis set rede_18 = true where id = $1", [pessoas.menor]);
await recusa("sem consentimento não publica", () => rpc(como(pessoas.menor), "rede_publicar", { p: { texto: "oi" } }), "consentimento");
await dono("update interno.perfis set rede_codinome_ok = false where id = $1", [pessoas.membro]);
await recusa("sem codinome confirmado não publica", () => rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "oi" } }), "confirme_codinome");
await dono("update interno.perfis set rede_codinome_ok = true where id = $1", [pessoas.membro]);
await recusa("visitante não publica", () => rpc(visitante(), "rede_publicar", { p: { texto: "oi" } }), "permission denied");
await recusa("conta suspensa não publica", () => rpc(como(pessoas.suspensa), "rede_publicar", { p: { texto: "oi" } }), "conta_suspensa");

let publicado;
await espera("post curto: padrão é 'membros', o alcance de hoje fica fechado e o texto vem como escrito", async () => {
  publicado = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "Primeira conversa na Rede nova." } });
  const linha = await um("select publico, alcance, tipo, oculto, retido from interno.rede_posts where id = $1", [publicado.id]);
  return [publicado.publico, publicado.meu, linha.alcance, linha.tipo, linha.oculto || linha.retido, publicado.apoios, publicado.avaliar];
}, (r) => r[0] === "membros" && r[1] === true && r[2] === "equipe" && r[3] === "post" && r[4] === false && r[5] === 0 && r[6] === false);
await espera("a Rede de hoje não mostra post da v2 que não é da internet", async () => {
  const hoje = await rpc(como(pessoas.nucleo), "rede_linha", { p_modo: "tudo", p_comunidade: null, p_usuario: null, p_antes: null });
  return Array.isArray(hoje) && hoje.every((p) => p.id !== publicado.id);
}, (v) => v === true);
await espera("público 'internet' em disciplina vale e a Rede de hoje o mostra como público", async () => {
  const p = await rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "Dúvida aberta sobre frações.", comunidade: "matematica", publico: "internet" } });
  const aberto = await rpc(visitante(), "rede_post", { p_id: p.id });
  return [aberto.post.publico, (await um("select alcance from interno.rede_posts where id = $1", [p.id])).alcance];
}, (r) => r[0] === "internet" && r[1] === "publico");
await espera("o padrão da comunidade manda no público (disciplina = internet)", async () => (await rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "Sem dizer o público.", comunidade: "matematica" } })).publico, (p) => p === "internet");
await recusa("internet fora das disciplinas é recusado", () => rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "x", comunidade: "moradia", publico: "internet" } }), "invalido:publico");
await recusa("público 'comunidade' sem comunidade", () => rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "x", publico: "comunidade" } }), "invalido:publico");
await recusa("público inventado", () => rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "x", publico: "todos" } }), "invalido:publico");
await recusa("comunidade que não existe", () => rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "x", comunidade: "nao-existe" } }), "invalido:comunidade");
await recusa("comunidade fechada: quem não é dela não publica", () => rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "x", comunidade: "greve-fechada" } }), "sem_permissao");
await espera("comunidade fechada: quem é dela publica, com o público da comunidade", async () => (await rpc(como(pessoas.comunidade), "rede_publicar", { p: { texto: "Pauta da greve.", comunidade: "greve-fechada" } })).publico, (p) => p === "comunidade");
await dono("update interno.rede_comunidade_membros set situacao = 'banido' where usuario = $1 and comunidade = 'moradia'", [pessoas.comunidade]);
await recusa("banido da comunidade não publica nela", () => rpc(como(pessoas.comunidade), "rede_publicar", { p: { texto: "x", comunidade: "moradia" } }), "sem_permissao");
await dono("update interno.rede_comunidade_membros set situacao = 'ativo' where usuario = $1 and comunidade = 'moradia'", [pessoas.comunidade]);
await espera("etiqueta da comunidade: existe passa, inventada não", async () => {
  const ok = await rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "Aluguel subiu de novo.", comunidade: "moradia", flair: "Aluguel" } });
  return ok.flair;
}, (f) => f === "Aluguel");
await recusa("etiqueta inventada", () => rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "x", comunidade: "moradia", flair: "Outra" } }), "invalido:flair");
await recusa("público 'equipe' só para a equipe", () => rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "x", publico: "equipe" } }), "sem_permissao");
await recusa("aviso só para a equipe", () => rpc(como(pessoas.membro), "rede_publicar", { p: { tipo: "aviso", texto: "x" } }), "sem_permissao");
await espera("a equipe publica aviso e público de equipe", async () => {
  const a = await rpc(como(pessoas.equipe), "rede_publicar", { p: { tipo: "aviso", texto: "Reunião da coordenação.", publico: "equipe" } });
  return [a.tipo, a.publico];
}, (r) => r[0] === "aviso" && r[1] === "equipe");
await recusa("público 'nucleo' sem ser do núcleo", () => rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "x", publico: "nucleo", nucleo } }), "sem_permissao");
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2) on conflict do nothing", [nucleo, pessoas.nucleo]);
await espera("público 'nucleo' para quem é do núcleo", async () => {
  const p = await rpc(como(pessoas.nucleo), "rede_publicar", { p: { texto: "Encontro do núcleo.", publico: "nucleo", nucleo } });
  return [p.publico, await ve(p.id, pessoas.membro), await ve(p.id, pessoas.nucleo)];
}, (r) => r[0] === "nucleo" && r[1] === false && r[2] === true);
await recusa("enquete e chamado ainda não (pacotes publicar e comunidades)", () => rpc(como(pessoas.membro), "rede_publicar", { p: { tipo: "enquete", texto: "x" } }), "invalido:tipo");
await recusa("dúvida pede título", () => rpc(como(pessoas.membro), "rede_publicar", { p: { tipo: "duvida", corpo: "Como se calcula a mais-valia relativa?" } }), "invalido:titulo");
await espera("dúvida: título, corpo longo e resumo de 500 no texto", async () => {
  const d = await rpc(como(pessoas.membro), "rede_publicar", { p: { tipo: "duvida", titulo: "Mais-valia relativa", corpo: "palavra ".repeat(300), comunidade: "matematica", publico: "internet" } });
  const linha = await um("select char_length(texto) as t, char_length(corpo) as c from interno.rede_posts where id = $1", [d.id]);
  return [d.tipo, d.titulo, linha.t, linha.c, d.corpo.length];
}, (r) => r[0] === "duvida" && r[1] === "Mais-valia relativa" && r[2] === 500 && r[3] === 2399 && r[4] === 2399);
await recusa("post com mais de 500 caracteres", () => rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "a".repeat(501) } }), "invalido:texto");
for (const [nome, texto] of [["CPF", "meu cpf 123.456.789-09"], ["telefone", "liga (21) 91234-5678"], ["e-mail", "escreve para fulana@exemplo.com"]]) {
  await recusa(`dado pessoal: ${nome}`, () => rpc(como(pessoas.membro), "rede_publicar", { p: { texto } }), "dado_pessoal");
}
// Respostas: árvore, herança do alcance, travar, limite de níveis, aviso à pessoa.
await espera("resposta herda comunidade e público e avisa quem foi respondido", async () => {
  const pai = await rpc(como(pessoas.comunidade), "rede_publicar", { p: { texto: "Quem vai à assembleia?", comunidade: "greve-fechada" } });
  const antes = (await um("select count(*)::int as n from interno.avisos where para = $1 and categoria = 'rede'", [pessoas.comunidade])).n;
  const filha = await rpc(como(pessoas.comunidade), "rede_publicar", { p: { texto: "Eu vou.", resposta_a: pai.id, publico: "internet", comunidade: "matematica" } });
  const outra = await rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "Respondendo a mim mesma é possível.", resposta_a: pai.id } }).catch((e) => ({ erro: e.message }));
  const depois = (await um("select count(*)::int as n from interno.avisos where para = $1 and categoria = 'rede'", [pessoas.comunidade])).n;
  return [filha.publico, filha.comunidade, filha.nivel, filha.raiz === pai.id, antes === depois, outra.erro];
}, (r) => r[0] === "comunidade" && r[1] === "greve-fechada" && r[2] === 1 && r[3] === true && r[4] === true && /nao_encontrado/.test(r[5] ?? ""));
await espera("resposta a um post de outra pessoa gera aviso para ela", async () => {
  const pai = await rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "Pergunta para todas." } });
  await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "Resposta.", resposta_a: pai.id } });
  return (await um("select count(*)::int as n from interno.avisos where para = $1 and categoria = 'rede' and texto like '%respondeu ao seu post%'", [pessoas.autor])).n;
}, (n) => n === 1);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_18 = true, rede_consentimento = $2 where id = $1", [pessoas.nova, VERSAO]);
await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, $2)", [pessoas.nova, VERSAO]);
await espera("árvore até o 6º nível e travar", async () => {
  let atual = (await rpc(como(pessoas.nova), "rede_publicar", { p: { texto: "Raiz da conversa." } })).id;
  const raizId = atual;
  const niveis = [];
  for (let n = 1; n <= 6; n++) {
    const r = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: `nível ${n}`, resposta_a: atual } });
    niveis.push(r.nivel);
    atual = r.id;
  }
  const setimo = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "nível 7", resposta_a: atual } }).catch((e) => e.message);
  await dono("update interno.rede_posts set travado = true where id = $1", [raizId]);
  const travada = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "depois de travar", resposta_a: raizId } }).catch((e) => e.message);
  return [niveis.join(","), String(setimo), String(travada)];
}, (r) => r[0] === "1,2,3,4,5,6" && /limite_de_niveis/.test(r[1]) && /travado/.test(r[2]));
await recusa("responder a post que não se vê", () => rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "x", resposta_a: r2 } }), "nao_encontrado");
await espera("o limite de posts por hora existe (conta velha: 20)", async () => {
  let ultimo = "ok";
  for (let i = 0; i < 22 && ultimo === "ok"; i++) {
    try { await rpc(como(pessoas.seguidor), "rede_publicar", { p: { texto: `rajada ${i}` } }); } catch (e) { ultimo = e.message; }
  }
  return ultimo;
}, (e) => /muitos_pedidos/.test(e));
await espera("conta nova tem metade do teto", async () => {
  await dono("update auth.users set created_at = now() where id = $1", [pessoas.pendente]);
  await dono("update interno.perfis set rede_codinome_ok = true where id = $1", [pessoas.pendente]);
  let feitos = 0;
  try { for (let i = 0; i < 15; i++) { await rpc(como(pessoas.pendente), "rede_publicar", { p: { texto: `nova ${i}` } }); feitos++; } } catch { /* o teto */ }
  return feitos;
}, (n) => n === 10);
await espera("modo de segurança (aprovação manual): o post nasce retido e só o autor o vê", async () => {
  await dono("insert into interno.configuracoes (chave, valor) values ('comunidade', '{\"aprovacao_manual\": true}') on conflict (chave) do update set valor = excluded.valor");
  const p = await rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "Esperando a mediação." } });
  const visto = await ve(p.id, pessoas.membro);
  await dono("update interno.configuracoes set valor = '{\"aprovacao_manual\": false}' where chave = 'comunidade'");
  return [p.retido, p.motivo, visto];
}, (r) => r[0] === true && r[1] === "modo_seguranca" && r[2] === false);
await espera("avaliação externa ligada: retém e pede a avaliação ('avaliar')", async () => {
  await dono("update interno.configuracoes set valor = '{\"avaliacao_externa\": true}' where chave = 'comunidade'");
  const p = await rpc(como(pessoas.autor), "rede_publicar", { p: { texto: "Passa pela segunda avaliação." } });
  await dono("update interno.configuracoes set valor = '{}' where chave = 'comunidade'");
  return [p.avaliar, p.retido, p.motivo];
}, (r) => r[0] === true && r[1] === true && r[2] === "aguardando_avaliacao");

// ── Reagir e salvar ──
await espera("apoiar: a pessoa sabe que apoiou, o total de apoios não volta, só o autor o vê na linha", async () => {
  const post = await postar({ publico: "membros" });
  const r = await rpc(como(pessoas.comunidade), "rede_reagir", { p_post: post, p_tipo: "apoio", p_sim: true });
  const outro = await rpc(como(pessoas.nucleo), "rede_reagir", { p_post: post, p_tipo: "util", p_sim: true });
  const doAutor = (await rpc(como(pessoas.autor), "rede_post", { p_id: post })).post;
  const dePessoa = (await rpc(como(pessoas.comunidade), "rede_post", { p_id: post })).post;
  await rpc(como(pessoas.comunidade), "rede_reagir", { p_post: post, p_tipo: "apoio", p_sim: false });
  const depois = (await rpc(como(pessoas.autor), "rede_post", { p_id: post })).post;
  return [r.apoiei, "apoios" in r, outro.util, doAutor.apoios, dePessoa.apoios, depois.apoios];
}, (r) => r[0] === true && r[1] === false && r[2] === 1 && r[3] === 1 && r[4] === null && r[5] === 0);
await recusa("não se apoia o próprio post", async () => rpc(como(pessoas.autor), "rede_reagir", { p_post: await postar({ publico: "membros" }), p_tipo: "apoio", p_sim: true }), "sem_permissao");
await recusa("não se reage ao que não se vê", async () => rpc(como(pessoas.membro), "rede_reagir", { p_post: await postar({ publico: "equipe" }), p_tipo: "util", p_sim: true }), "nao_encontrado");
await recusa("quem não é membro não reage", async () => rpc(como(pessoas.menor), "rede_reagir", { p_post: await postar({ publico: "membros" }), p_tipo: "util", p_sim: true }), "consentimento");
await recusa("reação inventada", async () => rpc(como(pessoas.membro), "rede_reagir", { p_post: await postar({ publico: "membros" }), p_tipo: "odio", p_sim: true }), "invalido:tipo");
await espera("salvar é privado: só quem salvou vê que salvou", async () => {
  const post = await postar({ publico: "membros" });
  await rpc(como(pessoas.membro), "rede_salvar", { p_post: post, p_sim: true });
  const eu = (await rpc(como(pessoas.membro), "rede_post", { p_id: post })).post.salvei;
  const outro = (await rpc(como(pessoas.comunidade), "rede_post", { p_id: post })).post.salvei;
  return [eu, outro];
}, (r) => r[0] === true && r[1] === false);

// ── Comunidade e perfil ──
await espera("rede_comunidade: cabeçalho, regras, etiquetas e moderação por codinome", async () => {
  await dono("insert into interno.rede_comunidade_regras (comunidade, numero, titulo, texto) values ('moradia', 1, 'Sem endereço de casa', 'Só ponto público.')");
  const c = await rpc(como(pessoas.membro), "rede_comunidade", { p_slug: "moradia" });
  return [c.nome, c.regras.length, c.etiquetas[0]?.nome, c.moderacao, c.membro];
}, (r) => r[0] === "Moradia" && r[1] === 1 && r[2] === "Aluguel" && r[3].length === 1 && /^Lutadora/.test(r[3][0]) && r[4] === false);
await espera("rede_comunidade abre pelo apelido antigo e devolve o nome novo", async () => (await rpc(visitante(), "rede_comunidade", { p_slug: "matematica-antiga" })).slug, (s) => s === "matematica");
await recusa("comunidade fechada não existe para quem não é dela", () => rpc(como(pessoas.membro), "rede_comunidade", { p_slug: "greve-fechada" }), "nao_encontrado");
await recusa("comunidade de luta pede conta", () => rpc(visitante(), "rede_comunidade", { p_slug: "moradia" }), "entre_primeiro");
await espera("rede_perfil_de: codinome, handle, bio, sem nome do painel", async () => {
  const f = await rpc(como(pessoas.membro), "rede_perfil_de", { p_handle: "@autora_luta" });
  return [f.handle, /^Lutadora/.test(f.codinome), JSON.stringify(f).includes("rede.local"), f.sigo];
}, (r) => r[0] === "autora_luta" && r[1] === true && r[2] === false && r[3] === false);
await recusa("rede_perfil_de de quem bloqueou", () => rpc(como(pessoas.bloqueado), "rede_perfil_de", { p_handle: "autora_luta" }), "nao_encontrado");
await recusa("rede_perfil_de de quem não existe", () => rpc(como(pessoas.membro), "rede_perfil_de", { p_handle: "ninguem_aqui" }), "nao_encontrado");
await recusa("visitante não abre perfil", () => rpc(visitante(), "rede_perfil_de", { p_handle: "autora_luta" }), "permission denied");

// ── Migração do Fórum ──
await dono("delete from interno.rede_posts");
await dono("delete from interno.rede_migracao");
const t1 = (await um("insert into interno.topicos (autor, titulo, corpo, disciplina, tipo, criado_em) values ($1, 'Como somar frações?', 'Preciso entender a soma de frações com denominadores diferentes.', 'matematica', 'duvida', now() - interval '10 days') returning id", [pessoas.membro])).id;
const t2 = (await um("insert into interno.topicos (autor, titulo, corpo, disciplina, tipo, criado_em, trancado) values ($1, 'Conversa sobre moradia', 'O aluguel sobe mais que o salário, e agora? Vamos conversar sobre isso.', 'disciplina-nova', 'conversa', now() - interval '9 days', true) returning id", [pessoas.autor])).id;
const t3 = (await um("insert into interno.topicos (autor, titulo, corpo, disciplina, tipo, criado_em, alvo, alvo_titulo) values ($1, 'Sem disciplina nenhuma', 'Tópico sem disciplina, para conferir que não vira público.', null, 'conversa', now() - interval '8 days', '/trilhas/historia/aula-1', 'Aula 1') returning id", [pessoas.membro])).id;
const t4 = (await um("insert into interno.topicos (autor, titulo, corpo, disciplina, tipo, oculto, criado_em) values ($1, 'Removido pela mediação', 'Tópico removido que não pode aparecer.', 'matematica', 'conversa', true, now() - interval '7 days') returning id", [pessoas.membro])).id;
const respostasAntigas = [];
const responder = async (topico, autor, corpo, pai = null, minutos = 0) => {
  const id = (await um("insert into interno.respostas (topico, autor, corpo, pai, criado_em) values ($1, $2, $3, $4, now() - interval '5 days' + ($5 || ' minutes')::interval) returning id", [topico, autor, corpo, pai, String(minutos)])).id;
  respostasAntigas.push(id);
  return id;
};
const a1 = await responder(t1, pessoas.autor, "Ache o mínimo múltiplo comum dos denominadores.", null, 1);
const a2 = await responder(t1, pessoas.seguidor, "Um exemplo: 1/2 + 1/3 = 5/6.", a1, 2);
let cadeia = a2;
for (let n = 0; n < 8; n++) cadeia = await responder(t1, pessoas.comunidade, `Resposta profunda número ${n + 1} da conversa.`, cadeia, 3 + n);
const folha = cadeia;
await dono("update interno.topicos set aceita = $2 where id = $1", [t1, a1]);
await dono("insert into interno.votos (usuario, tipo, alvo, valor) values ($1, 'topico', $3, 1), ($2, 'topico', $3, 1), ($2, 'resposta', $4, 1), ($1, 'resposta', $4, -1)", [pessoas.autor, pessoas.seguidor, t1, a1]);
const antesForum = await um("select (select count(*) from interno.topicos)::int as t, (select count(*) from interno.respostas)::int as r, (select count(*) from interno.votos)::int as v");
let resultado;
await espera("a migração leva tópicos, respostas e votos úteis", async () => {
  resultado = (await um("select interno.rede_migrar_forum() as r")).r;
  return resultado;
}, (r) => r.topicos === 4 && r.respostas === respostasAntigas.length && r.votos === 3 && r.comunidades === 1);
await espera("rodar de novo não duplica nada", async () => (await um("select interno.rede_migrar_forum() as r")).r, (r) => r.topicos === 0 && r.respostas === 0 && r.votos === 0 && r.comunidades === 0);
await espera("as tabelas antigas ficam intactas", async () => um("select (select count(*) from interno.topicos)::int as t, (select count(*) from interno.respostas)::int as r, (select count(*) from interno.votos)::int as v"), (d) => d.t === antesForum.t && d.r === antesForum.r && d.v === antesForum.v);
const novoDe = async (tipo, antigo) => (await um("select novo from interno.rede_migracao where tipo = $1 and antigo = $2", [tipo, antigo]))?.novo;
await espera("o mapa antigo → novo guarda tópicos e respostas", async () => [await novoDe("topico", t1), await novoDe("resposta", a1)], (r) => r.every(Boolean));
await espera("dúvida vira 'duvida', conversa vira 'discussao', título e corpo preservados, data preservada", async () => {
  const d = await um("select tipo, titulo, corpo, comunidade, publico, criado_em < now() - interval '9 days' as antigo from interno.rede_posts where id = $1", [await novoDe("topico", t1)]);
  const c = await um("select tipo, travado, comunidade from interno.rede_posts where id = $1", [await novoDe("topico", t2)]);
  return [d.tipo, d.titulo, d.corpo.startsWith("Preciso"), d.comunidade, d.publico, d.antigo, c.tipo, c.travado, c.comunidade];
}, (r) => r[0] === "duvida" && r[1] === "Como somar frações?" && r[2] && r[3] === "matematica" && r[4] === "internet" && r[5] && r[6] === "discussao" && r[7] === true && r[8] === "disciplina-nova");
await espera("a disciplina nova vira comunidade de disciplinas", async () => um("select categoria, publico_padrao from interno.rede_comunidades where slug = 'disciplina-nova'"), (c) => c.categoria === "disciplinas" && c.publico_padrao === "internet");
await espera("tópico sem disciplina vira 'membros' e leva a aula citada", async () => {
  const p = await um("select publico, comunidade, cita from interno.rede_posts where id = $1", [await novoDe("topico", t3)]);
  return [p.publico, p.comunidade, p.cita?.tipo, p.cita?.caminho];
}, (r) => r[0] === "membros" && r[1] === null && r[2] === "aula" && r[3] === "/trilhas/historia/aula-1");
await espera("a resposta aceita aponta para a resposta nova", async () => [(await um("select aceita from interno.rede_posts where id = $1", [await novoDe("topico", t1)])).aceita, await novoDe("resposta", a1)], (r) => r[0] === r[1]);
await espera("resposta de resposta: a árvore é preservada", async () => {
  const filho = await um("select r.resposta_a, r.profundidade, r.root_id from interno.rede_posts r where r.id = $1", [await novoDe("resposta", a2)]);
  return [filho.resposta_a === (await novoDe("resposta", a1)), filho.profundidade, filho.root_id === (await novoDe("topico", t1))];
}, (r) => r[0] === true && r[1] === 2 && r[2] === true);
await espera("a árvore nunca passa do 6º nível (as respostas mais fundas sobem)", async () => (await um("select max(profundidade)::int as m, count(*)::int as n from interno.rede_posts where root_id = $1", [await novoDe("topico", t1)])), (r) => r.m === 6 && r.n === 10);
await espera("votos +1 viram 'útil'; voto -1 não vira nada; a v2 só devolve o total", async () => {
  const total = (await um("select count(*)::int as n from interno.rede_reacoes where post = $1 and tipo = 'util'", [await novoDe("topico", t1)])).n;
  const util = (await rpc(como(pessoas.membro), "rede_post", { p_id: await novoDe("topico", t1) })).post;
  const res = (await um("select count(*)::int as n from interno.rede_reacoes where post = $1", [await novoDe("resposta", a1)])).n;
  return [total, util.util, res, JSON.stringify(util).includes(pessoas.seguidor)];
}, (r) => r[0] === 2 && r[1] === 2 && r[2] === 1 && r[3] === false);
await espera("o conteúdo migrado das disciplinas é público para a internet; o removido não aparece para ninguém", async () => {
  const aberto = await rpc(visitante(), "rede_post", { p_id: await novoDe("topico", t1) });
  const removido = await ve(await novoDe("topico", t4), pessoas.nucleo);
  return [aberto.post.titulo, aberto.respostas.length > 0, removido];
}, (r) => r[0] === "Como somar frações?" && r[1] === true && r[2] === false);
await espera("a Rede de hoje não vê os tópicos migrados na linha dela", async () => {
  const hoje = await rpc(como(pessoas.nucleo), "rede_linha", { p_modo: "tudo", p_comunidade: null, p_usuario: null, p_antes: null });
  return hoje.length;
}, (n) => n === 0);
await espera("a linha geral (aberta) mostra a dúvida migrada, só as das disciplinas", async () => {
  const itens = (await rpc(visitante(), "rede_linha", { p_aba: "geral", p_limite: 50 })).itens;
  return itens.map((i) => i.titulo).sort();
}, (t) => JSON.stringify(t) === JSON.stringify(["Como somar frações?", "Conversa sobre moradia"]));
await espera("tópico novo no Fórum entra na próxima rodada", async () => {
  await dono("insert into interno.topicos (autor, titulo, corpo, disciplina) values ($1, 'Tópico tardio', 'Chegou depois da primeira migração do Fórum.', 'matematica')", [pessoas.membro]);
  return (await um("select interno.rede_migrar_forum() as r")).r;
}, (r) => r.topicos === 1);
await espera("rede_antigo resolve ?t= e ?sala=", async () => {
  const a = await rpc(visitante(), "rede_antigo", { p_tipo: "topico", p_antigo: t1 });
  const b = await rpc(visitante(), "rede_antigo", { p_tipo: "sala", p_antigo: "matematica-antiga" });
  const c = await rpc(visitante(), "rede_antigo", { p_tipo: "sala", p_antigo: "nada-por-aqui" });
  const d = await rpc(visitante(), "rede_antigo", { p_tipo: "topico", p_antigo: "não é id" });
  return [a, b, c, d];
}, (r) => r[0].tipo === "post" && r[1].tipo === "comunidade" && r[1].novo === "matematica" && r[2] === null && r[3] === null);

// ── Permissões ──
await espera("nenhuma função interna nova é executável por anon ou authenticated", async () => todos("select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r where n.nspname = 'interno' and p.proname in ('rede_ve', 'rede_silenciado', 'rede_alcance', 'rede_post_v2', 'rede_aba', 'rede_na_aba', 'rede_triagem', 'rede_migrar_forum') and r.rolname in ('anon', 'authenticated') and has_function_privilege(r.oid, p.oid, 'execute') and (p.proname <> 'rede_ve' or pg_get_function_identity_arguments(p.oid) like '%uuid')"), (r) => r.length === 0);
await espera("publicar, aderir e perfil só para conta; leitura para quem tem a chave", async () => um(`select
  has_function_privilege('anon', 'public.rede_publicar(jsonb)', 'execute') as publicar_anon, has_function_privilege('authenticated', 'public.rede_publicar(jsonb)', 'execute') as publicar_auth,
  has_function_privilege('anon', 'public.rede_aderir(boolean, integer)', 'execute') as aderir_anon, has_function_privilege('anon', 'public.rede_perfil_de(text)', 'execute') as perfil_anon,
  has_function_privilege('anon', 'public.rede_linha(text, text, integer)', 'execute') as linha_anon, has_function_privilege('anon', 'public.rede_post(uuid)', 'execute') as post_anon,
  has_function_privilege('anon', 'public.rede_novos(text, timestamptz)', 'execute') as novos_anon, has_function_privilege('anon', 'public.rede_antigo(text, text)', 'execute') as antigo_anon`),
(r) => !r.publicar_anon && r.publicar_auth && !r.aderir_anon && !r.perfil_anon && r.linha_anon && r.post_anon && r.novos_anon && r.antigo_anon);
await espera("as funções públicas novas fixam o search_path e são security definer", async () => todos(`
  select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('rede_linha', 'rede_post', 'rede_publicar', 'rede_aderir', 'rede_situacao', 'rede_comunidade', 'rede_perfil_de', 'rede_antigo', 'rede_reagir', 'rede_salvar')
    and p.prosecdef and exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')`), (r) => r.length === 10);
await espera("as funções da Rede de hoje continuam lá, com os mesmos nomes", async () => todos("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('rede_postar', 'rede_post_ver', 'rede_apoiar', 'rede_vou', 'rede_buscar')"), (r) => r.length === 5);
await espera("nenhuma tabela nova no esquema public", async () => (await um("select count(*)::int as n from pg_tables where schemaname = 'public'")).n, (n) => n === 0);

// ── Endereços antigos (?t=, ?sala=, ?post=) e endereços novos ──
const ID = "0b9c5f0e-7f3a-4c1e-9d55-2f6a8f0d1c11";
await espera("pedidoAntigo reconhece ?t=, ?sala= e ?post= só na linha de cada idioma", async () => [
  pedidoAntigo("/pt/alumia", `?t=${ID}`),
  pedidoAntigo("/en/alumia/", "?sala=matematica"),
  pedidoAntigo("/pt/alumia", `?post=${ID}`),
  pedidoAntigo("/pt/alumia", "?t=nao-e-id"),
  pedidoAntigo("/pt/alumia", "?sala=Maiuscula!"),
  pedidoAntigo("/pt/trilhas", `?t=${ID}`),
  pedidoAntigo("/xx/alumia", `?t=${ID}`),
  pedidoAntigo("/pt/alumia", ""),
], (r) => r[0]?.tipo === "topico" && r[1]?.tipo === "sala" && r[1].lang === "en" && r[2]?.tipo === "post" && r.slice(3).every((x) => x === null));
await espera("destinoNovo só devolve endereço bem formado (nada de ir para fora do site)", async () => [
  destinoNovo("pt", { tipo: "post", novo: ID }),
  destinoNovo("pt", { tipo: "comunidade", novo: "matematica" }),
  destinoNovo("pt", { tipo: "comunidade", novo: "../../fora" }),
  destinoNovo("pt", { tipo: "post", novo: "//evil.example" }),
  destinoNovo("pt", null),
  destinoDireto({ lang: "pt", tipo: "post", antigo: ID }),
  destinoDireto({ lang: "pt", tipo: "topico", antigo: ID }),
], (r) => r[0] === `/pt/alumia/p/${ID}` && r[1] === "/pt/alumia/c/matematica" && r[2] === null && r[3] === null && r[4] === null && r[5] === `/pt/alumia/p/${ID}` && r[6] === null);
await espera("os endereços da v2 e as conferências de formato batem com o banco", async () => [
  enderecos.post("pt", ID), enderecos.comunidade("pt", "luta-pela-terra"), enderecos.perfil("pt", "maria_luta"), idOk(ID), slugOk("Ab"), handleOk("a_b"), handleOk("ab"),
], (r) => r[0] === `/pt/alumia/p/${ID}` && r[1] === "/pt/alumia/c/luta-pela-terra" && r[2] === "/pt/alumia/u/maria_luta" && r[3] === true && r[4] === false && r[5] === true && r[6] === false);
await espera("o proxy só redireciona com o recurso ligado e responde 301", async () => {
  const proxy = lerTexto("proxy.ts");
  return [/ligado\("rede-v2"\)/.test(proxy), /NextResponse\.redirect\(url, 301\)/.test(proxy), /rede_antigo/.test(proxy)];
}, (r) => r.every(Boolean));
await espera("a página /alumia escolhe a v2 só com o recurso ligado e carrega sob demanda; a Rede de hoje continua no resto", async () => {
  const pagina = lerTexto("app/[lang]/alumia/page.tsx");
  const sob = lerTexto("components/rede/RedeSobDemanda.tsx");
  return [/if \(ligado\("rede-v2"\)\)/.test(pagina), /ComunidadeComRede forum=\{t\.community\} rede=\{t\.rede\}/.test(pagina), /dynamic\(\(\) => import\("\.\/Rede"\)/.test(sob), /ssr: false/.test(sob)];
}, (r) => r.every(Boolean));

// ── Contrato do cliente, dos tipos e dos textos ──
await espera("lib/rede/tipos.ts e cliente.ts existem, sem atalhos '@/' e com as funções do contrato", async () => {
  const tipos = lerTexto("lib/rede/tipos.ts");
  const cliente = lerTexto("lib/rede/cliente.ts");
  const funcoes = ["rede_linha", "rede_post", "rede_novos", "rede_publicar", "rede_aderir", "rede_situacao", "rede_comunidade", "rede_perfil_de", "rede_reagir", "rede_salvar", "rede_antigo"];
  return [/from "@\//.test(tipos), /from "@\//.test(cliente), funcoes.every((f) => cliente.includes(`"${f}"`)), /export interface Post\b/.test(tipos), /export interface Perfil\b/.test(tipos), /export interface Comunidade\b/.test(tipos), /export interface Aviso\b/.test(tipos)];
}, (r) => r[0] === false && r[1] === false && r[2] && r[3] && r[4] && r[5] && r[6]);
await espera("os seis idiomas têm as mesmas chaves (pt é o texto final; os outros são rascunho marcado)", async () => {
  const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const pt = achatar(JSON.parse(lerTexto("i18n/rede/pt.json"))).filter((k) => k !== "_rascunho").sort();
  const resultado = {};
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(lerTexto(`i18n/rede/${l}.json`));
    const chaves = achatar(j).filter((k) => k !== "_rascunho").sort();
    resultado[l] = { iguais: JSON.stringify(chaves) === JSON.stringify(pt), rascunho: j._rascunho === true };
  }
  return resultado;
}, (r) => Object.values(r).every((x) => x.iguais && x.rascunho));
await espera("a rota de cada tela da v2 existe e responde 404 com o recurso desligado", async () => {
  const dir = "app/[lang]/alumia";
  const lista = [`${dir}/p/[id]/page.tsx`, `${dir}/c/[slug]/page.tsx`, `${dir}/u/[handle]/page.tsx`];
  return lista.map((a) => ({ a, ok: fs.existsSync(new URL(`../${a}`, import.meta.url)) && /notFound\(\)/.test(lerTexto(a)) && /ligado\("rede-v2"\)/.test(lerTexto(a)) }));
}, (r) => r.every((x) => x.ok));
await espera("o recurso rede-v2 só liga pelo nome", async () => {
  const fonte = lerTexto("lib/recursos.ts");
  return [/"rede-v2":/.test(fonte), /SO_PELO_NOME[^=]*=\s*\[[^\]]*"rede-v2"/.test(fonte)];
}, (r) => r[0] && r[1]);

console.log(`Rede v2 (fundação): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
