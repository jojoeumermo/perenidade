// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a migração dos grupos cifrados da rede no OpenMLS (supabase/migracoes/20261124-r2-grupos.sql) num Postgres local
// (scripts/banco-local.mjs), rodada DUAS vezes sobre o install.sql com o estado antigo (ts-mls) já gravado, e o chaveiro de verdade
// (lib/rede/grupos/chaveiro.ts, com o motor @wireapp/core-crypto) falando com as funções do banco como o site fala:
//   - a troca: tabelas da ts-mls (com a GroupInfo e o autor de cada commit) e posts "p2" antigos saem, uma vez só;
//   - o que o banco guarda: sem GroupInfo, sem autor, sem hora; commits só em embrulho de tamanho fixo;
//   - ponta a ponta: post "p2" escrito por uma pessoa abre nos outros membros; quem não é membro não chega ao grupo; quem sai do
//     núcleo não abre o que vem depois (e ainda relê o que já lia); aparelho novo da mesma conta volta com aviso;
//   - ataques ao banco: commit fora do formato, época pulada, folha de outra conta, boas-vindas para quem não é membro, pacote de
//     quem não é do grupo, boas-vindas de outra folha;
//   - a porta: as funções novas passam por ela.
// Uso: npm run testar:r2-grupos-banco
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { motorNoNode } from "./cifra-no-node.mjs";
import { criarChaveiroDeGrupo } from "../lib/rede/grupos/chaveiro.ts";
import { registroDeTeste } from "./identidade-de-teste.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = "supabase/migracoes/20261124-r2-grupos.sql";
const sql = fs.readFileSync(path.join(raiz, MIGRACAO), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
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

// ═══════════════════ 0. O arquivo da migração ═══════════════════
ok("a migração tem cabeçalho com a função e a lei", /Alumia · R2 · grupos cifrados/.test(sql) && /Leis e princípios: LGPD/.test(sql));
ok("a migração termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("a migração não tem endereço de rede, porta nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função da migração recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok("nenhuma função da migração tem valor padrão em parâmetro", !/create or replace function [^\n]*\bdefault\b[^\n]*\)\s+returns/i.test(sql));
ok("o nome antigo da rede não aparece", !/Rede Lúcia/.test(sql));

// ═══════════════════ 1. O banco de antes, com o estado da ts-mls ═══════════════════
// Se a migração já estiver colada no install.sql (depois da junção), o banco é montado só até antes dela: o estado de antes é o da ts-mls.
const banco = await criarBanco({ antesDe: sql }).catch(() => criarBanco());
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const P = {};
for (const nome of ["ana", "bia", "caio", "fora"]) {
  P[nome] = await criarUsuario(`${nome}@r2g.local`, `Pessoa ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r2g_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
const nucleo = (await dono("insert into interno.rede_nucleos (nome) values ('Núcleo R2') returning id")).rows[0].id;
for (const m of ["ana", "bia", "caio"]) await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, entrou_em) values ($1, $2, now() - interval '2 hours')", [nucleo, P[m]]);
const G = `nucleo:${nucleo}`;
// O estado de antes: um commit da ts-mls com autor e hora, a GroupInfo e um post "p2" que ninguém mais vai abrir.
await dono("insert into interno.rede_mls_commits (grupo, epoca, autor, commit) values ($1, 1, $2, 'AAAA')", [G, P.ana]);
await dono("insert into interno.rede_mls_info (grupo, epoca, info) values ($1, 1, 'AAAA')", [G]);
await dono("insert into interno.rede_posts (autor, texto, publico, nucleo, grupo, corpo_grupo) values ($1, '', 'nucleo', $2, $3, 'p2.1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')", [P.ana, nucleo, G])
  .catch((e) => falhas.push(`montar o post p2 de antes: ${e.message}`));
const postsAntes = Number((await dono("select count(*) from interno.rede_posts where corpo_grupo is not null")).rows[0].count);

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
// Onda R3 (14): as folhas com certificado (a migração que vem depois desta; o chaveiro de agora já publica com certificado).
// O banco aqui é o de antes dos membros escondidos (os núcleos ainda com membros no servidor): da migração da R3 entra só a parte (14),
// a dos grupos (as outras partes dependem do resto da R2). A migração inteira é provada em scripts/testar-r3-resto-*.mjs.
const sqlR3Todo = fs.readFileSync(path.join(raiz, "supabase/migracoes/20261125-r3-resto-r2.sql"), "utf8");
const sqlR3 = sqlR3Todo.slice(sqlR3Todo.indexOf("-- ══════════════════════════════ (14)"), sqlR3Todo.indexOf("-- ══════════════════════════════ (15)")) + "\nselect interno.alumia_trancar();\n";
await espera("a parte (14) da migração da onda R3 (certificado das folhas) por cima", () => exec(sqlR3), () => sqlR3.includes("rede_grupo_folhas add column if not exists certificado"));
const registro = registroDeTeste();
const CERT = Buffer.alloc(96, 1).toString("base64");

// ═══════════════════ 2. A troca e o que o banco guarda ═══════════════════
ok(`o post "p2" da ts-mls saiu (havia ${postsAntes})`, postsAntes === 1 && Number((await dono("select count(*) from interno.rede_posts where corpo_grupo is not null")).rows[0].count) === 0);
ok("as tabelas da ts-mls (com a GroupInfo e o autor de cada commit) não existem mais", (await dono("select count(*)::int as n from unnest(array['rede_mls_info','rede_mls_commits','rede_mls_pacotes','rede_mls_boasvindas']) t where to_regclass('interno.' || t) is not null")).rows[0].n === 0);
const colunas = (await dono(`select table_name || '.' || column_name as c, data_type from information_schema.columns where table_schema = 'interno' and table_name like 'rede\\_grupo\\_%' order by 1`)).rows;
ok(`nenhuma coluna de autor, de hora ou de endereço nas tabelas dos grupos (${colunas.map((c) => c.c).join(", ")})`, colunas.length >= 12 && !colunas.some((c) => /autor|criado|_em$|ip|endereco/.test(c.c) || /timestamp/.test(c.data_type)));
ok("nenhuma sequência nas tabelas dos grupos", (await dono(`select count(*)::int as n from information_schema.columns where table_schema = 'interno' and table_name like 'rede\\_grupo\\_%' and (column_default like 'nextval%' or is_identity = 'YES')`)).rows[0].n === 0);
ok("RLS ligada e sem políticas nas tabelas novas", (await dono(`select bool_and(c.relrowsecurity) as rls, (select count(*) from pg_policies where schemaname = 'interno' and tablename like 'rede\\_grupo\\_%')::int as pol, count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname like 'rede\\_grupo\\_%' and c.relkind = 'r'`)).rows.every((r) => r.rls && r.pol === 0 && r.n === 5));
const funcoes = (await dono(`select p.oid::regprocedure::text as f, p.prosrc, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where (n.nspname = 'public' and p.proname like 'rede\\_mls\\_%') or (n.nspname = 'interno' and p.proname like 'rede\\_mls\\_%')`)).rows;
ok(`as funções públicas antigas saíram (achadas: ${funcoes.map((f) => f.f).join(", ")})`, !funcoes.some((f) => /rede_mls_commit\(text,integer,text,text,jsonb\)|rede_mls_estado\(text,integer\)|rede_mls_pacotes_pegar\(text,uuid\[\]\)|rede_mls_pacotes_publicar/.test(f.f.replace(/ /g, ""))));
ok("as públicas passam pela porta e só authenticated chama", funcoes.filter((f) => f.f.startsWith("rede_mls")).every((f) => /interno\.alumia_porta\(\)/.test(f.prosrc) && !f.anon && f.aut) && funcoes.filter((f) => f.f.startsWith("rede_mls")).length === 6);
ok("a de interno não é de ninguém e tem search_path fixo", funcoes.filter((f) => f.f.startsWith("interno.")).every((f) => !f.anon && !f.aut && (f.proconfig ?? []).some((c) => c.startsWith("search_path=interno"))));
ok("'Rede Lúcia' não aparece em corpo de função nova", funcoes.every((f) => !/Rede Lúcia/.test(f.prosrc)));

// ═══════════════════ 3. Ponta a ponta com o motor de verdade ═══════════════════
const M = await motorNoNode();
await dono("delete from interno.limites").catch(() => undefined);
const chamarComo = (u) => (funcao, argumentos) => rpc({ papel: "authenticated", sub: u }, funcao, argumentos);
const memoria = () => {
  const m = new Map();
  return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => void m.set(k, v), apagar: async (k) => void m.delete(k) };
};
const aparelho = (u) => {
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  return criarChaveiroDeGrupo({ chamar: chamarComo(u), guarda: memoria(), abrirMotor: async () => ({ M, cc }), identidade: async () => registro.fonte(u) });
};
const A = aparelho(P.ana), B = aparelho(P.bia), C = aparelho(P.caio), F = aparelho(P.fora);
await espera("cada um publica a folha do aparelho e os pacotes de chave", async () => {
  for (const [k, u] of [[B, P.bia], [C, P.caio]]) await k.preparar(u);
  return (await dono("select count(*)::int as n from interno.rede_grupo_folhas")).rows[0].n;
}, (n) => n === 2);
const p1 = await espera("ana escreve o primeiro post cifrado do núcleo (cria o grupo e põe bia e caio)", () => A.cifrar(G, P.ana, "Reunião sábado às 15h"), (c) => /^p2\.\d+\./.test(c));
await espera("bia e caio abrem", async () => [await B.abrir(G, P.bia, P.ana, p1), await C.abrir(G, P.caio, P.ana, p1)], (l) => l.every((t) => t === "Reunião sábado às 15h"));
await espera("com o autor errado o post não abre (amarrado a quem escreveu)", () => B.abrir(G, P.bia, P.caio, p1), (t) => t === null);
await recusa("quem não é do núcleo não chega ao grupo", () => F.cifrar(G, P.fora, "oi"), "nao_encontrado");
const commits = (await dono("select commit from interno.rede_grupo_commits where grupo = $1", [G])).rows;
ok("o banco só tem commits em embrulho de tamanho fixo, sem nome de ninguém às claras", commits.length >= 1 && commits.every((c) => [2098, 8242, 32818, 131122].includes(Buffer.from(c.commit, "base64").length) && !Buffer.from(c.commit, "base64").toString("latin1").includes("alumia.invalid")));

// Caio sai do núcleo: o próximo aparelho que escreve tira ele.
await dono("delete from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [nucleo, P.caio]);
const p2 = await espera("bia escreve depois que caio saiu", () => B.cifrar(G, P.bia, "Só para quem ficou"));
await espera("ana abre o post novo", () => A.abrir(G, P.ana, P.bia, p2), (t) => t === "Só para quem ficou");
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, entrou_em) values ($1, $2, now())", [nucleo, P.caio]); // um servidor que deixa caio ler o estado de novo
await espera("caio, mesmo vendo o estado, não abre o que veio depois que saiu", () => C.abrir(G, P.caio, P.bia, p2), (t) => t === null);
await espera("e ainda relê o que já lia antes de sair", () => C.abrir(G, P.caio, P.ana, p1), (t) => t === "Reunião sábado às 15h");
await dono("delete from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [nucleo, P.caio]);

// Bia perde o aparelho (o "Sair rápido" apaga a loja): volta com aparelho novo; a ana aceita e fica o aviso.
const B2 = aparelho(P.bia);
await B2.preparar(P.bia);
const p3 = await espera("ana escreve depois que bia voltou com aparelho novo (troca a folha)", () => A.cifrar(G, P.ana, "Bem-vinda de volta"));
await espera("o aparelho novo da bia abre", () => B2.abrir(G, P.bia, P.ana, p3), (t) => t === "Bem-vinda de volta");
await espera("e a ana tem o aviso de aparelho novo da bia", () => A.avisos(P.ana), (l) => l.some((x) => x.usuario === P.bia));
await espera("o aparelho velho da bia, que ainda vale, também abre (são dois aparelhos dela)", () => B.abrir(G, P.bia, P.ana, p3), (t) => t === "Bem-vinda de volta");
// O aparelho velho sai da lista da conta (tirado, ou trocado depois de 5): a próxima escrita tira a folha dele do grupo.
const folhaVelha = (await dono("select b.para as nome from interno.rede_grupo_boasvindas b join interno.rede_grupo_folhas f on f.nome = b.para where f.usuario = $1 order by b.epoca limit 1", [P.bia])).rows[0]?.nome;
await dono("delete from interno.rede_grupo_folhas where nome = $1", [folhaVelha]);
const p4 = await espera("ana escreve depois que o aparelho velho da bia saiu da lista", () => A.cifrar(G, P.ana, "Depois da troca"));
await espera("o aparelho novo da bia abre e o velho não", async () => [await B2.abrir(G, P.bia, P.ana, p4), await B.abrir(G, P.bia, P.ana, p4)], ([n, v]) => n === "Depois da troca" && v === null);

// O aparelho que ficou na árvore sem o grupo (as boas-vindas venceram em 30 dias antes de ele abrir): pede para entrar de novo, e
// o próximo membro que escreve tira a folha e põe de novo. Sem isso, ele ficaria preso: os outros o veem no grupo e ele não lê.
const A2 = aparelho(P.ana);
await A2.preparar(P.ana);
const p5 = await espera("bia escreve com o segundo aparelho da ana publicado (ele entra no grupo)", () => B2.cifrar(G, P.bia, "Para os dois aparelhos"));
const nomeA2 = (await dono("select b.para as nome from interno.rede_grupo_boasvindas b join interno.rede_grupo_folhas f on f.nome = b.para where f.usuario = $1 and b.epoca = (select max(epoca) from interno.rede_grupo_boasvindas where para = b.para) order by b.epoca desc limit 1", [P.ana])).rows[0]?.nome;
await dono("delete from interno.rede_grupo_boasvindas where para = $1", [nomeA2]);
await espera("sem as boas-vindas, o segundo aparelho da ana não abre e pede para entrar de novo", async () => [await A2.abrir(G, P.ana, P.bia, p5), (await dono("select count(*)::int as n from interno.rede_grupo_reentrar where nome = $1", [nomeA2])).rows[0].n], ([t, n]) => t === null && n === 1);
await espera("o pedido aparece em 'reentrar' para os membros", async () => (await rpc({ papel: "authenticated", sub: P.bia }, "rede_mls_estado", { p_grupo: G, p_nome: (await dono("select nome from interno.rede_grupo_folhas where usuario = $1 order by dia desc limit 1", [P.bia])).rows[0].nome, p_desde: 2147483647 })).reentrar, (r) => r.includes(nomeA2));
const p6 = await espera("bia escreve de novo (tira a folha do aparelho e põe de novo)", () => B2.cifrar(G, P.bia, "Agora sim"));
await espera("o segundo aparelho da ana abre, o pedido dele sai do banco e nenhum membro aparece em 'reentrar'", async () => [await A2.abrir(G, P.ana, P.bia, p6), (await dono("select count(*)::int as n from interno.rede_grupo_reentrar where nome = $1", [nomeA2])).rows[0].n, (await rpc({ papel: "authenticated", sub: P.ana }, "rede_mls_estado", { p_grupo: G, p_nome: nomeA2, p_desde: 2147483647 })).reentrar], ([t, n, r]) => t === "Agora sim" && n === 0 && r.length === 0);
await recusa("ninguém pede para entrar de novo com a folha de outra conta", () => rpc({ papel: "authenticated", sub: P.bia }, "rede_mls_reentrar", { p_grupo: G, p_nome: nomeA2, p_visto: 0 }), "invalido:nome");
await espera("com boas-vindas mais novas do que as vistas, o pedido não muda nada", () => rpc({ papel: "authenticated", sub: P.ana }, "rede_mls_reentrar", { p_grupo: G, p_nome: nomeA2, p_visto: 0 }), (r) => r.ok === false && r.novas === true);

// ═══════════════════ 4. Ataques ao banco ═══════════════════
const ana = { papel: "authenticated", sub: P.ana };
const epoca = Number((await dono("select max(epoca) as e from interno.rede_grupo_commits where grupo = $1", [G])).rows[0].e);
const embrulhoFalso = (n, marca = 0x47) => {
  const b = Buffer.alloc(n);
  b[0] = marca;
  b[1] = 1;
  return b.toString("base64");
};
await recusa("commit que não é embrulho de tamanho fixo é recusado", () => rpc(ana, "rede_mls_commit", { p_grupo: G, p_epoca: epoca + 1, p_commit: embrulhoFalso(2097), p_boasvindas: [] }), "invalido:commit");
await recusa("commit sem a marca do embrulho é recusado", () => rpc(ana, "rede_mls_commit", { p_grupo: G, p_epoca: epoca + 1, p_commit: embrulhoFalso(2098, 0x00), p_boasvindas: [] }), "invalido:commit");
await recusa("commit que pula época é recusado", () => rpc(ana, "rede_mls_commit", { p_grupo: G, p_epoca: epoca + 2, p_commit: embrulhoFalso(2098), p_boasvindas: [] }), "versao_ocupada");
await recusa("segundo commit da mesma época é recusado", () => rpc(ana, "rede_mls_commit", { p_grupo: G, p_epoca: epoca, p_commit: embrulhoFalso(2098), p_boasvindas: [] }), "versao_ocupada");
await recusa("quem não é membro não grava commit", () => rpc({ papel: "authenticated", sub: P.fora }, "rede_mls_commit", { p_grupo: G, p_epoca: epoca + 1, p_commit: embrulhoFalso(2098), p_boasvindas: [] }), "nao_encontrado");
await recusa("publicar folha com o nome de outra conta é recusado", () => rpc(ana, "rede_mls_publicar", { p_nome: `${P.bia}:1@alumia.invalid`, p_pacotes: [], p_certificado: CERT }), "invalido:nome");
await recusa("nome de folha fora do formato é recusado", () => rpc(ana, "rede_mls_publicar", { p_nome: `${P.ana}:1@wire.com`, p_pacotes: [], p_certificado: CERT }), "invalido:nome");
const foraNome = `${P.fora}:abc@alumia.invalid`;
await rpc({ papel: "authenticated", sub: P.fora }, "rede_mls_publicar", { p_nome: foraNome, p_pacotes: ["AAAA"], p_certificado: CERT });
await espera("pegar o pacote de quem não é do grupo não dá nada (e o pacote fica)", async () => [await rpc(ana, "rede_mls_pacotes_pegar", { p_grupo: G, p_nomes: [foraNome] }), (await dono("select count(*)::int as n from interno.rede_grupo_pacotes where nome = $1", [foraNome])).rows[0].n], ([r, n]) => Object.keys(r).length === 0 && n === 1);
await espera("boas-vindas para folha de quem não é membro são ignoradas", async () => {
  await rpc(ana, "rede_mls_commit", { p_grupo: G, p_epoca: epoca + 1, p_commit: embrulhoFalso(2098), p_boasvindas: [{ para: foraNome, welcome: "AAAA" }] });
  return (await dono("select count(*)::int as n from interno.rede_grupo_boasvindas where para = $1", [foraNome])).rows[0].n;
}, (n) => n === 0);
const nomeAna = (await dono("select nome from interno.rede_grupo_folhas where usuario = $1", [P.ana])).rows[0].nome;
await dono("insert into interno.rede_grupo_boasvindas (grupo, epoca, para, welcome) values ($1, 99, $2, 'BBBB')", [G, nomeAna]);
await espera("as boas-vindas de uma folha só saem para a conta dona dela", async () => [(await rpc({ papel: "authenticated", sub: P.bia }, "rede_mls_estado", { p_grupo: G, p_nome: nomeAna, p_desde: 0 })).boasvindas, (await rpc(ana, "rede_mls_estado", { p_grupo: G, p_nome: nomeAna, p_desde: 0 })).boasvindas?.welcome], ([b, a]) => b === null && a === "BBBB");
await espera("a conta tem no máximo 5 folhas (a mais antiga sai)", async () => {
  for (let i = 1; i <= 7; i++) await rpc({ papel: "authenticated", sub: P.fora }, "rede_mls_publicar", { p_nome: `${P.fora}:${i}@alumia.invalid`, p_pacotes: [], p_certificado: CERT });
  return (await dono("select count(*)::int as n from interno.rede_grupo_folhas where usuario = $1", [P.fora])).rows[0].n;
}, (n) => n === 5);
// O install.sql rodado de novo: a migração da ts-mls (de antes) recria as tabelas antigas vazias e as funções antigas; esta, que vem
// depois, apaga de novo. Os posts "p2" do OpenMLS e as tabelas novas ficam (a troca dos posts é uma vez só).
await espera("rodar de novo a migração antiga e esta não apaga os posts p2 nem os grupos novos", async () => {
  await dono("insert into interno.rede_posts (autor, texto, publico, nucleo, grupo, corpo_grupo) values ($1, '', 'nucleo', $2, $3, $4)", [P.ana, nucleo, G, p4]);
  const antes = [(await dono("select count(*)::int as n from interno.rede_posts where corpo_grupo is not null")).rows[0].n, (await dono("select count(*)::int as n from interno.rede_grupo_commits")).rows[0].n];
  await exec(fs.readFileSync(path.join(raiz, "supabase/migracoes/20261113-rede-grupos-mls.sql"), "utf8"));
  await exec(sql);
  await exec(sqlR3);
  const depois = [(await dono("select count(*)::int as n from interno.rede_posts where corpo_grupo is not null")).rows[0].n, (await dono("select count(*)::int as n from interno.rede_grupo_commits")).rows[0].n];
  return [antes, depois, (await dono("select to_regclass('interno.rede_mls_info') as t")).rows[0].t];
}, ([a, d, t]) => a[0] === 1 && a[0] === d[0] && a[1] === d[1] && t === null);
await espera("e o p2 de antes da troca abre de novo", () => A.abrir(G, P.ana, P.ana, p4), (t) => t === "Depois da troca");
await recusa("anon não chama", () => rpc({ papel: "anon" }, "rede_mls_estado", { p_grupo: G, p_nome: nomeAna, p_desde: 0 }), "permission denied");
// A rota da voz (app/api/alumia/voz/retransmissao) confere se quem pede a credencial TURN é membro chamando rede_mls_estado com os
// mesmos parâmetros nomeados; com a assinatura nova (p_nome), a chamada de antes (sem p_nome) não acharia a função e ninguém teria voz.
const rota = fs.readFileSync(path.join(raiz, "app/api/alumia/voz/retransmissao/route.ts"), "utf8");
const chamadaDaRota = /rpcNoBanco<unknown>\("rede_mls_estado", \{ ([^}]*) \}/.exec(rota)?.[1] ?? "";
// (Se a rota deixar de chamar a função, como no desenho dos grupos de membros escondidos, não há o que conferir aqui.)
ok("a rota da voz, se chama rede_mls_estado, passa todos os parâmetros da função", !/"rede_mls_estado"/.test(rota) || ["p_grupo", "p_nome", "p_desde"].every((p) => chamadaDaRota.includes(`${p}:`)));
await espera("a chamada da rota da voz responde para quem é membro (sem boas-vindas)", () => rpc(ana, "rede_mls_estado", { p_grupo: G, p_nome: null, p_desde: 2147483647 }), (r) => r.boasvindas === null && Array.isArray(r.membros));
await recusa("e recusa quem não é", () => rpc({ papel: "authenticated", sub: P.fora }, "rede_mls_estado", { p_grupo: G, p_nome: null, p_desde: 2147483647 }), "nao_encontrado");

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
