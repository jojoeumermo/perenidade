// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a fundação da Rede v2 (docs/rede/ESPEC.md, seção 2) num banco local com o install.sql inteiro: a matriz de
// quem vê o quê, linha por linha e coluna por coluna, as regras transversais (removido, bloqueio, suspensão, comunidade
// fechada e restrita), a contagem de respostas que obedece à mesma regra, o registro de moderação que não se altera, o
// recurso revisto por outra pessoa, os limites e a instalação repetida. Uso: npm run testar:rede
import { criarBanco } from "./banco-local.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 200)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
const recusa = async (promessa) => {
  try {
    await promessa();
    return null;
  } catch (erro) {
    return erro.message;
  }
};

const banco = await criarBanco();
const { dono, criarUsuario } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];

// As pessoas da matriz. A primeira conta vira coordenação; as outras entram antes de existir convite obrigatório.
const pessoas = {};
for (const nome of ["autor", "membro", "seguidor", "comunidade", "nucleo", "equipe", "bloqueado", "semconta", "suspensa", "pendente"]) {
  pessoas[nome] = await criarUsuario(`${nome}@rede.local`, nome);
  // O perfil nasce na primeira chamada da pessoa, como no site.
  await banco.rpc({ papel: "authenticated", sub: pessoas[nome] }, "eu");
}
const visitante = null;
const VERSAO = 1;
await dono("insert into interno.rede_regras (versao, texto) values ($1, $2) on conflict do nothing", [VERSAO, "Normas da Rede para o teste. ".repeat(4)]);
// Membro da Rede = 18+ e consentimento em vigor. "semconta" tem conta no site mas não entrou na Rede.
for (const nome of ["autor", "membro", "seguidor", "comunidade", "nucleo", "equipe", "bloqueado", "suspensa", "pendente"]) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = $2 where id = $1", [pessoas[nome], VERSAO]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, $2)", [pessoas[nome], VERSAO]);
}
// A equipe por função (e só ela): sem papel, ninguém é equipe.
await dono("delete from interno.papeis where usuario <> $1", [pessoas.equipe]);
await dono("insert into interno.papeis (usuario, papel) select $1, 'educacao' where not exists (select 1 from interno.papeis where usuario = $1)", [pessoas.equipe]);
await dono("update interno.perfis set suspenso = true where id = $1", [pessoas.suspensa]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [pessoas.seguidor, pessoas.autor]);
await dono("insert into interno.rede_seguindo (quem, segue, pendente) values ($1, $2, true)", [pessoas.pendente, pessoas.autor]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.autor, pessoas.bloqueado]);

await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet'),
  ('moradia', 'Moradia', 'lutas', 'aberta', 'membros'),
  ('greve-restrita', 'Greve (restrita)', 'lutas', 'restrita', 'comunidade'),
  ('greve-fechada', 'Greve (fechada)', 'lutas', 'fechada', 'comunidade')`);
for (const slug of ["greve-restrita", "greve-fechada", "moradia"]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ($1, $2)", [slug, pessoas.comunidade]);
}
const nucleo = (await um("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo do teste', 'Niterói') returning id")).id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro')", [nucleo, pessoas.nucleo]);

const postar = async (campos) => {
  const colunas = Object.keys(campos);
  const linha = await um(`insert into interno.rede_posts (autor, texto, ${colunas.join(", ")}) values ($1, 'post do teste', ${colunas.map((_, i) => `$${i + 2}`).join(", ")}) returning id`, [pessoas.autor, ...Object.values(campos)]);
  return linha.id;
};
const ve = async (post, quem) => (await um("select interno.rede2_pode_ver(p, $2) as v from interno.rede_posts p where p.id = $1", [post, quem])).v;

// A matriz da especificação, com "só restrita lê" e o asterisco do núcleo resolvidos em casos próprios.
const colunas = ["visitante", "membro", "seguidor", "comunidade", "nucleo", "equipe", "autor", "bloqueado"];
const quem = (coluna) => (coluna === "visitante" ? visitante : pessoas[coluna]);
const matriz = [
  ["internet (disciplinas)", { publico: "internet", comunidade: "matematica" }, [1, 1, 1, 1, 1, 1, 1, 0]],
  ["membros da Rede", { publico: "membros" }, [0, 1, 1, 1, 1, 1, 1, 0]],
  ["quem me segue", { publico: "seguidores" }, [0, 0, 1, 0, 0, 0, 1, 0]],
  ["comunidade fechada", { publico: "comunidade", comunidade: "greve-fechada" }, [0, 0, 0, 1, 0, 0, 1, 0]],
  ["núcleo", { publico: "nucleo", nucleo }, [0, 0, 0, 0, 1, 0, 1, 0]],
  ["equipe do instituto", { publico: "equipe" }, [0, 0, 0, 0, 0, 1, 1, 0]],
];
for (const [linha, campos, esperado] of matriz) {
  const post = await postar(campos);
  for (const [i, coluna] of colunas.entries()) {
    await espera(`matriz: "${linha}" × ${coluna} = ${esperado[i] ? "vê" : "não vê"}`, () => ve(post, quem(coluna)), (v) => v === Boolean(esperado[i]));
  }
}

// Regras que a matriz não mostra numa célula.
const restrita = await postar({ publico: "comunidade", comunidade: "greve-restrita" });
await espera("comunidade restrita com público da comunidade: membro da Rede de fora não vê", () => ve(restrita, pessoas.membro), (v) => v === false);
await espera("comunidade restrita com público da comunidade: quem é da comunidade vê", () => ve(restrita, pessoas.comunidade), (v) => v === true);
const restritaMembros = await postar({ publico: "membros", comunidade: "greve-restrita" });
await espera("comunidade restrita: membro da Rede lê o que foi para membros", () => ve(restritaMembros, pessoas.membro), (v) => v === true);
await espera("comunidade restrita: visitante não lê", () => ve(restritaMembros, visitante), (v) => v === false);
const fechadaMembros = await postar({ publico: "membros", comunidade: "greve-fechada" });
await espera("comunidade fechada barra mesmo post marcado para membros", () => ve(fechadaMembros, pessoas.membro), (v) => v === false);
await espera("comunidade fechada barra a equipe também", () => ve(fechadaMembros, pessoas.equipe), (v) => v === false);

const internetFora = await postar({ publico: "internet", comunidade: "moradia" });
await espera("internet fora das disciplinas cai para membros: visitante não vê", () => ve(internetFora, visitante), (v) => v === false);
await espera("internet fora das disciplinas cai para membros: membro vê", () => ve(internetFora, pessoas.membro), (v) => v === true);
const internetSemComunidade = await postar({ publico: "internet" });
await espera("internet sem comunidade também cai para membros", () => ve(internetSemComunidade, visitante), (v) => v === false);

const antigoPublico = await postar({ alcance: "publico" });
await espera("post da Rede de hoje com alcance público: visitante não vê na v2 (decisão 2)", () => ve(antigoPublico, visitante), (v) => v === false);
await espera("post da Rede de hoje com alcance público: membro vê", () => ve(antigoPublico, pessoas.membro), (v) => v === true);
const antigoSeguidores = await postar({ alcance: "seguidores" });
await espera("post de hoje para seguidores continua só para seguidores", async () => [await ve(antigoSeguidores, pessoas.seguidor), await ve(antigoSeguidores, pessoas.membro)], ([a, b]) => a === true && b === false);

const membros = await postar({ publico: "membros" });
await espera("conta no site sem entrar na Rede não é membro", () => ve(membros, pessoas.semconta), (v) => v === false);
await espera("conta suspensa não vê", () => ve(membros, pessoas.suspensa), (v) => v === false);
const seguidores = await postar({ publico: "seguidores" });
await espera("pedido de seguir ainda pendente (perfil trancado) não vê", () => ve(seguidores, pessoas.pendente), (v) => v === false);

await dono("update interno.rede_consentimentos set revogado_em = now() where usuario = $1", [pessoas.membro]);
await espera("consentimento revogado tira a pessoa da Rede", () => ve(membros, pessoas.membro), (v) => v === false);
await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, $2)", [pessoas.membro, VERSAO]);
await espera("consentimento dado de novo devolve", () => ve(membros, pessoas.membro), (v) => v === true);

await dono("update interno.rede_comunidade_membros set situacao = 'banido' where usuario = $1 and comunidade = 'greve-fechada'", [pessoas.comunidade]);
const fechada = await postar({ publico: "comunidade", comunidade: "greve-fechada" });
await espera("banido da comunidade fechada deixa de ver", () => ve(fechada, pessoas.comunidade), (v) => v === false);
await dono("update interno.rede_comunidade_membros set situacao = 'ativo' where usuario = $1", [pessoas.comunidade]);
await dono("delete from interno.rede_nucleo_membros where usuario = $1", [pessoas.nucleo]);
const doNucleo = await postar({ publico: "nucleo", nucleo });
await espera("sair do núcleo corta o acesso na hora", () => ve(doNucleo, pessoas.nucleo), (v) => v === false);

for (const [estado, sql] of [["removido", "oculto = true"], ["retido para revisão", "retido = true"], ["apagado", "apagado_em = now()"]]) {
  const post = await postar({ publico: "membros" });
  await dono(`update interno.rede_posts set ${sql} where id = $1`, [post]);
  await espera(`post ${estado}: ninguém vê`, async () => [await ve(post, pessoas.membro), await ve(post, pessoas.equipe)], (r) => r.every((v) => v === false));
  await espera(`post ${estado}: o autor ainda vê`, () => ve(post, pessoas.autor), (v) => v === true);
}
await espera("bloqueio vale nos dois sentidos", async () => {
  const doBloqueado = (await um("insert into interno.rede_posts (autor, texto, publico) values ($1, 'oi', 'membros') returning id", [pessoas.bloqueado])).id;
  return ve(doBloqueado, pessoas.autor);
}, (v) => v === false);

// Árvore e contagem de respostas pela mesma regra.
const raiz = await postar({ publico: "membros" });
const r1 = (await um("insert into interno.rede_posts (autor, texto, resposta_a, publico) values ($1, 'r1', $2, 'membros') returning id, root_id, profundidade", [pessoas.membro, raiz]));
const r2 = (await um("insert into interno.rede_posts (autor, texto, resposta_a, publico) values ($1, 'r2', $2, 'equipe') returning id, root_id, profundidade", [pessoas.equipe, r1.id]));
await espera("resposta herda a raiz e ganha um nível", async () => [r1, r2], ([a, b]) => a.root_id === raiz && a.profundidade === 1 && b.root_id === raiz && b.profundidade === 2);
await espera("raiz enviada por quem posta é ignorada", async () => (await um("insert into interno.rede_posts (autor, texto, resposta_a, root_id) values ($1, 'r3', $2, $3) returning root_id", [pessoas.membro, r1.id, r2.id])).root_id, (v) => v === raiz);
await espera("número de respostas obedece à matriz", async () => [
  (await um("select interno.rede2_respostas_visiveis($1, $2) as n", [r1.id, pessoas.membro])).n,
  (await um("select interno.rede2_respostas_visiveis($1, $2) as n", [r1.id, pessoas.equipe])).n,
], ([membro, equipe]) => membro === 1 && equipe === 2); // r3 (membros) os dois veem; r2 (equipe) só a equipe

// Registro de moderação: só inserção.
const acao = (await um("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, motivo, quem) values ('remover', 'post', $1, 'exposição de dado pessoal', $2) returning id", [raiz, pessoas.equipe])).id;
await espera("registro de moderação não se altera", () => recusa(() => dono("update interno.rede_moderacao set motivo = 'outro' where id = $1", [acao])), (e) => /não se altera/.test(e ?? ""));
await espera("registro de moderação não se apaga", () => recusa(() => dono("delete from interno.rede_moderacao where id = $1", [acao])), (e) => /não se altera/.test(e ?? ""));
await espera("registro de moderação não se esvazia", () => recusa(() => dono("truncate interno.rede_moderacao cascade")), (e) => /não se altera/.test(e ?? ""));
await espera("recurso não pode ser revisto por quem decidiu", () => recusa(() => dono("insert into interno.rede_recursos (acao, autor, texto, revisou) values ($1, $2, 'não era dado pessoal, era o nome da praça', $3)", [acao, pessoas.autor, pessoas.equipe])), (e) => /outra pessoa/.test(e ?? ""));
await espera("recurso revisto por outra pessoa passa", () => dono("insert into interno.rede_recursos (acao, autor, texto, revisou) values ($1, $2, 'não era dado pessoal, era o nome da praça', $3)", [acao, pessoas.autor, pessoas.comunidade]), () => true);

// Regras de forma.
await espera("internet só como público padrão das disciplinas", () => recusa(() => dono("insert into interno.rede_comunidades (slug, nome, categoria, publico_padrao) values ('lutas-x', 'Lutas X', 'lutas', 'internet')")), (e) => e !== null);
await espera("proposta de comunidade exige dois moderadores", () => recusa(() => dono("insert into interno.rede_propostas (autor, slug, nome, objetivo, regras, moderadores) values ($1, 'nova', 'Nova', $2, $2, array[$1]::uuid[])", [pessoas.membro, "objetivo longo o bastante para passar"])), (e) => e !== null);
await espera("convite guarda só hash de 64 caracteres", () => recusa(() => dono("insert into interno.rede_convites (nucleo, token_hash, validade) values ($1, 'codigo-em-texto', now() + interval '1 day')", [nucleo])), (e) => e !== null);
await espera("post de núcleo sem núcleo é recusado", () => recusa(() => postar({ publico: "nucleo" })), (e) => e !== null);
await espera("handle: formato, imitação da equipe e repetição", async () => {
  await dono("update interno.perfis set rede_handle = 'maria_luta' where id = $1", [pessoas.membro]);
  const ok = async (h, u) => (await um("select interno.rede2_handle_ok($1, $2) as v", [h, u])).v;
  return [await ok("joana_13", pessoas.autor), await ok("Jo", pessoas.autor), await ok("equipe_lucia", pessoas.autor), await ok("maria_luta", pessoas.autor), await ok("maria_luta", pessoas.membro)];
}, (r) => JSON.stringify(r) === "[true,false,false,false,true]");
await espera("prioridade da fila: menores e ameaça antes de spam", async () => (await um("select interno.rede2_prioridade('menores') as a, interno.rede2_prioridade('ameaca') as b, interno.rede2_prioridade('spam') as c")), (r) => r.a === 1 && r.b === 1 && r.c === 3);
await espera("busca encontra pelo título e pelo corpo", async () => {
  await dono("insert into interno.rede_posts (autor, texto, titulo, corpo, tipo, publico) values ($1, 'resumo', 'Mais-valia relativa', 'Como a jornada de trabalho se intensifica', 'duvida', 'membros')", [pessoas.autor]);
  const achar = async (termo) => (await um("select count(*)::int as n from interno.rede_posts where busca @@ plainto_tsquery('portuguese', $1)", [termo])).n;
  return [await achar("valia relativa"), await achar("jornadas de trabalho")];
}, (r) => r[0] === 1 && r[1] === 1);

// Limites: metade do teto para conta nova, e ninguém de fora chama as funções internas.
await espera("conta nova bate no limite de propostas na segunda", async () => {
  const rodar = () => banco.exclusivo(async () => {
    await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: pessoas.membro })]);
    return banco.pg.query("select interno.rede2_limite('propor')");
  });
  await rodar();
  return recusa(rodar);
}, (e) => /muitos_pedidos/.test(e ?? ""));
await espera("visitante e conta comum não chamam a regra de visibilidade", async () => (await um("select has_function_privilege('anon', 'interno.rede2_pode_ver(interno.rede_posts, uuid)', 'execute') as a, has_function_privilege('authenticated', 'interno.rede2_pode_ver(interno.rede_posts, uuid)', 'execute') as b")), (r) => r.a === false && r.b === false);
await espera("toda tabela nova da Rede tem segurança por linha e nenhuma permissão direta", async () => (await um(`select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'interno' and c.relkind = 'r' and c.relname like 'rede_%'
    and (not c.relrowsecurity or has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))`)).n, (n) => n === 0);

await espera("instalar de novo não quebra nem duplica", async () => {
  await banco.instalarDeNovo();
  return (await um("select count(*)::int as n from interno.rede_comunidades")).n;
}, (n) => n === 4);

console.log(`Rede v2 (fundação): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
