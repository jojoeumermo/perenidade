// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 10E (decisão e números da comunidade): supabase/migracoes/20261116-alumia-o10-decisao.sql num Postgres de verdade
// (scripts/banco-local.mjs), rodada DUAS vezes sobre o install.sql. O voto secreto vai pelo caminho do banco que houver
// (scripts/voto-de-teste.mjs): depois da R2 (supabase/migracoes/20261124-r2-voto.sql), a cédula cifrada de verdade para a chave das
// guardiãs (lib/rede/voto/limiar.ts), que o servidor não abre; a cerimônia das guardiãs é provada em scripts/testar-r2-voto.mjs:
//   votação   quem abre, quem vota (só quem já era da comunidade), o quórum, o prazo, o resultado só no fechamento e só a partir
//             de 3, o modo aberto (nome junto do voto, só no fim), o caminho sem cifra e o cancelar;
//   segredo   o teste faz o papel de quem lê o banco inteiro e TENTA casar a pessoa com o voto secreto: pelo id, pela coluna, pelo
//             xmin, pela posição no disco, pela ordem de chegada, pelo freio. E não consegue;
//   números   os agregados por semana para a moderação, cada um só a partir de 3, sem pessoa nenhuma.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o10-decisao.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { votoDeTeste } from "./voto-de-teste.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const fonte = (c) => (existe(c) ? ler(c) : "");

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

// ═══════════════════ 0. Os arquivos ═══════════════════
const sql = ler("supabase/migracoes/20261116-alumia-o10-decisao.sql");
ok("toda função security definer da migração tem search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 14 && funcoes.filter((f) => /security definer/.test(f)).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a migração não lê nem guarda endereço de rede", !/x-forwarded-for|cf-connecting-ip|\binet\b|ip_address|interno\.origem\(\)/i.test(sql));
ok("as urnas sorteiam com gen_random_uuid", (sql.match(/order by gen_random_uuid\(\)/g) ?? []).length >= 5);
ok("a cédula não tem id, hora nem valor padrão", (() => {
  const m = /create table if not exists interno\.alumia_decisao_cedulas \(([\s\S]*?)\n\);/.exec(sql);
  return m && !/^\s*id\b/m.test(m[1]) && !/default|timestamptz|serial|identity|sequence/i.test(m[1]);
})());
// R2 (item 1.7): o servidor não dá mais a chave nem abre as cédulas; o aparelho cifra para a chave das guardiãs da mediação.
ok("as rotas com que o servidor dava a chave e abria as cédulas da votação sumiram", !existe("app/api/alumia/decisao/chave/route.ts") && !existe("app/api/alumia/decisao/abrir/route.ts"));
ok("o aparelho cifra pela urna das guardiãs (lib/rede/voto/urna.ts)", /urna\.votar\("decisao"/.test(fonte("lib/rede/decisao/cliente.ts")) && !/voto\/cedula|decisao\/chave|decisao\/abrir/.test(fonte("lib/rede/decisao/cliente.ts")));
ok("nenhuma cifra feita à mão na frente", ["lib/rede/decisao/cliente.ts"].every((c) => !/createCipheriv|createDecipheriv|subtle\.(encrypt|decrypt|deriveBits|deriveKey)|createECDH|hkdfSync/.test(fonte(c))));
ok("nenhum arquivo do navegador lê a chave de serviço ou o segredo", ["lib/rede/decisao/cliente.ts", ...fs.readdirSync(path.join(raiz, "components/rede/comunidades/decisao")).map((f) => `components/rede/comunidades/decisao/${f}`)]
  .every((c) => !/SERVICE_ROLE|ALUMIA_VOTO_SEGREDO/.test(fonte(c))));
ok("o voto secreto não tem caminho sem cifra no aparelho", !/sem_servico/.test(fonte("lib/rede/decisao/cliente.ts")));

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await dono(t, v)).rows[0];
const linhas = async (t, v = []) => (await dono(t, v)).rows;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub) => ({ papel: "authenticated", sub });
const chamar = (sub, funcao, argumentos = {}) => rpc(como(sub), funcao, argumentos);
const servico = (funcao, argumentos = {}) => rpc({ papel: "service_role" }, funcao, argumentos);

const VOTANTES = Array.from({ length: 16 }, (_, i) => `v${i + 1}`);
const nomes = ["mod", "outra", "tarde", "fora", ...VOTANTES];
const P = {};
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o10.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${String(i + 1).padStart(2, "0")}`, `${nome}_o10`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("delete from interno.papeis");

const SLUG = "moradia-o10";
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ($1, 'Moradia', 'lutas', 'aberta') on conflict do nothing", [SLUG]);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, entrou_em) values ($1, $2, 'moderacao', now() - interval '20 days')", [SLUG, P.mod]);
for (const n of ["outra", ...VOTANTES]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, entrou_em) values ($1, $2, now() - interval '10 days')", [SLUG, P[n]]);

// ═══════════════════ 2. A migração ═══════════════════
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_*/alumia_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("as funções do servidor (se ainda existirem: antes da R2) só aceitam a chave de serviço", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('alumia_decisao_cifradas', 'alumia_decisao_apurar')
    and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute'))`), (l) => l.length === 0);
await espera("as funções de membro passam pela porta", () => linhas(`select p.proname, pg_get_functiondef(p.oid) s from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('alumia_decisao_lista', 'alumia_decisao_criar', 'alumia_decisao_cancelar', 'alumia_decisao_votar', 'alumia_decisao_votar_cifrada', 'alumia_decisao_numeros')`),
  (l) => l.length === 6 && l.every((x) => x.s.includes("alumia_porta")));
await espera("visitante sem conta não chama nada da votação", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'alumia\\_decisao\\_%' and has_function_privilege('anon', p.oid, 'execute')`), (l) => l.length === 0);
await espera("as tabelas têm RLS e nenhuma política", () => linhas(`select c.relname, c.relrowsecurity, (select count(*) from pg_policy p where p.polrelid = c.oid)::int pol from pg_class c
    where c.relnamespace = 'interno'::regnamespace and c.relname like 'alumia\\_decis%' and c.relkind = 'r'`), (l) => l.length === 6 && l.every((x) => x.relrowsecurity && x.pol === 0));

const voto = await votoDeTeste(banco);
const CIFRADAS = voto.porTipo.decisao ? "alumia_decisao_cifradas" : "alumia_decisao_cedulas";
const temId = (coisa, id) => JSON.stringify(coisa).includes(id);
const emDias = (d) => new Date(Date.now() + d * 86_400_000).toISOString();
/** Fecha a votação: o prazo passa (a criação vai junto para trás, para o check prazo > criada_em). */
const fechar = (id) => dono("update interno.alumia_decisoes set criada_em = now() - interval '3 days', prazo = now() - interval '1 minute' where id = $1", [id]);
const daLista = async (quem, id) => (await chamar(quem, "alumia_decisao_lista", { p_slug: SLUG })).decisoes.find((d) => d.id === id);

try {
// ═══════════════════ 3. Abrir uma votação ═══════════════════
const pedido = { pergunta: "Qual dia fazemos o mutirão na ocupação?", explicacao: "A comissão topa qualquer um dos três.", opcoes: ["Sábado", "Domingo", "Feriado"], modo: "secreta", quorum: 8, prazo: emDias(3) };
await recusa("quem não modera não abre votação", () => chamar(P.outra, "alumia_decisao_criar", { p_slug: SLUG, p: pedido }), "sem_permissao");
await recusa("uma opção só não vale", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, opcoes: ["Sábado"] } }), "invalido:opcoes");
await recusa("opção repetida não vale", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, opcoes: ["Sábado", "sábado"] } }), "invalido:opcoes");
await recusa("quórum abaixo de 3 não vale", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, quorum: 2 } }), "invalido:quorum");
await recusa("prazo de menos de 1 hora não vale", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, prazo: new Date(Date.now() + 10 * 60_000).toISOString() } }), "invalido:prazo");
await recusa("prazo de mais de 60 dias não vale", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, prazo: emDias(70) } }), "invalido:prazo");
await recusa("modo que não existe", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, modo: "meio" } }), "invalido:modo");
const SEC = await espera("a moderação abre a votação secreta", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: pedido }),
  (d) => d.situacao === "aberta" && d.modo === "secreta" && d.opcoes.length === 3 && d.opcoes.every((o) => o.votos === null) && d.votantes === null);
const OPS = SEC.opcoes.map((o) => o.id);

// Quem entrou na comunidade depois de a votação abrir não vota nela.
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, entrou_em) values ($1, $2, now() + interval '1 second')", [SLUG, P.tarde]);
await dono("update interno.rede_comunidade_membros set entrou_em = now() + interval '5 minutes' where usuario = $1", [P.tarde]);

// ═══════════════════ 4. Votar em segredo (cifrado para as guardiãs, depois da R2) ═══════════════════
// 8 votos em Sábado, depois 6 em Domingo, depois 1 em Feriado: a ordem de chegada é conhecida (o atacante também sabe).
const escolhaDe = Object.fromEntries(VOTANTES.slice(0, 15).map((n, i) => [n, i < 8 ? OPS[0] : i < 14 ? OPS[1] : OPS[2]]));
await espera("quem é da comunidade e chegou antes vê que pode votar", () => daLista(P.v1, SEC.id), (d) => d.possoVotar === true && d.votei === false && d.impedimento === null);
await espera("quem chegou depois vê o motivo", () => daLista(P.tarde, SEC.id), (d) => d.possoVotar === false && d.impedimento === "chegou_depois");
const limitesAntes = (await um("select count(*)::int n from interno.limites")).n;
const xminDeQuem = {};
let antesDoUltimo = null;
for (const n of VOTANTES.slice(0, 15)) {
  if (n === "v15") antesDoUltimo = await linhas(`select ${voto.porTipo.decisao ? "cedula" : "opcao::text"} as cedula from interno.${CIFRADAS} where decisao = $1`, [SEC.id]);
  await espera(`${n} vota em segredo`, () => voto.decisao(chamar, P[n], SEC.id, escolhaDe[n]), (r) => r.votei === true);
  xminDeQuem[n] = (await um("select xmin::text x from interno.alumia_decisao_votantes where decisao = $1 and usuario = $2", [SEC.id, P[n]])).x;
}
await recusa("ninguém vota duas vezes", () => voto.decisao(chamar, P.v1, SEC.id, OPS[2]), "ja_votou");
await recusa("nem pelo caminho sem cifra", () => chamar(P.v1, "alumia_decisao_votar", { p_id: SEC.id, p_opcao: OPS[2] }), "ja_votou");
await recusa("quem chegou depois não vota", () => voto.decisao(chamar, P.tarde, SEC.id, OPS[0]), "sem_permissao");
await recusa("quem não é da comunidade nem acha a votação", () => voto.decisao(chamar, P.fora, SEC.id, OPS[0]), "nao_encontrado");
if (voto.porTipo.decisao) {
  await recusa("cédula fora do formato", () => chamar(P.v16, "alumia_decisao_votar_cifrada", { p_id: SEC.id, p_cedula: "c1.nada" }), "invalido:cedula");
  await recusa("o voto secreto às claras não existe mais", () => chamar(P.v16, "alumia_decisao_votar", { p_id: SEC.id, p_opcao: OPS[0] }), "voto_cifrado");
}
await espera("aberta: nenhum número, nem de quem votou", () => daLista(P.mod, SEC.id), (d) => d.votantes === null && d.resultado === false && d.opcoes.every((o) => o.votos === null));
await espera("o voto não grava freio com o id da pessoa", () => um("select count(*)::int n from interno.limites"), (x) => x.n === limitesAntes);

// ── O ataque, com a votação aberta: quem lê o banco inteiro ──
{
  const cifradas = await linhas(`select xmin::text x, cmin::text c, ctid::text p, * from interno.${CIFRADAS} where decisao = $1`, [SEC.id]);
  const votantes = await linhas("select xmin::text x, ctid::text p, * from interno.alumia_decisao_votantes where decisao = $1", [SEC.id]);
  ok("15 cédulas cifradas, 15 'votou'", cifradas.length === 15 && votantes.length === 15);
  ok("a cédula não tem coluna que aponte para alguém", Object.keys(cifradas[0]).filter((k) => !["x", "c", "p"].includes(k)).sort().join() === (voto.porTipo.decisao ? "cedula,decisao,resumo" : "decisao,opcao"));
  ok("nenhuma pessoa aparece em linha nenhuma das cédulas", VOTANTES.every((n) => !temId(cifradas, P[n])));
  ok("pelo xmin: as 15 cédulas dividem um xmin só (o do último voto), que não diz de quem é cada uma", new Set(cifradas.map((c) => c.x)).size === 1 && new Set(cifradas.map((c) => c.c)).size === 1);
  ok("pelo xmin: quem votou antes do último não divide xmin com cédula nenhuma", VOTANTES.slice(0, 14).every((n) => !cifradas.some((c) => c.x === xminDeQuem[n])));
  if (voto.porTipo.decisao) {
    // Duas leituras em volta de um voto mostram a cédula nova; mas ela é texto cifrado para as guardiãs, que só abre depois do prazo.
    const nova = cifradas.map((c) => c.cedula).filter((c) => !antesDoUltimo.some((a) => a.cedula === c));
    ok("duas leituras em volta de um voto: a nova é só texto cifrado (v2, tamanho fixo)", nova.length === 1 && nova.every((c) => /^v2\./.test(c) && c.length === 2233));
    ok("nenhum id de opção aparece nas cédulas", cifradas.every((c) => OPS.every((o) => !c.cedula.includes(o))));
  }
}

// ═══════════════════ 5. O fechamento e a apuração ═══════════════════
await fechar(SEC.id);
if (voto.porTipo.decisao) {
  await espera("fechada com cédula cifrada: ainda sem resultado, e a tela sabe que as guardiãs precisam abrir", () => daLista(P.v1, SEC.id), (d) => d.situacao === "fechada" && d.apurar === true && d.resultado === false && d.opcoes.every((o) => o.votos === null));
  await espera("o servidor não tem mais função para pedir ou apurar as cédulas", () => linhas("select proname from pg_proc where proname in ('alumia_decisao_cifradas', 'alumia_decisao_apurar')"), (l) => l.length === 0);
  // A abertura de verdade é das guardiãs (scripts/testar-r2-voto.mjs); aqui, a apuração de teste põe as escolhas na urna.
  await espera("a apuração (das guardiãs) põe as 15 escolhas na urna", () => voto.apurar("decisao", SEC.id), (r) => r.apuradas === 15);
}
// 8, 6 e 1 voto: com o total e os outros dois à vista, o 1 sairia por subtração (15 - 8 - 6). Então nenhum número sai.
const fim = await espera("o resultado sai com a vencedora; com uma opção abaixo de 3, nenhum número (nem o total) aparece", () => daLista(P.v1, SEC.id),
  (d) => d.resultado === true && d.numeros === false && d.quorumAtingido === true && d.votantes === null && d.opcoes.every((o) => o.votos === null)
    && d.opcoes[2].poucos === true && d.opcoes[0].vencedora === true && d.opcoes[1].vencedora === false && d.empate === false && d.opcoes.every((o) => o.quem === null));
void fim;

// ── O ataque, com a votação apurada ──
{
  const cedulas = await linhas("select xmin::text x, cmin::text c, ctid::text p, * from interno.alumia_decisao_cedulas where decisao = $1 order by ctid", [SEC.id]);
  const votantes = await linhas("select xmin::text x, * from interno.alumia_decisao_votantes where decisao = $1 order by ctid", [SEC.id]);
  ok("a cédula aberta tem só a votação e a opção", Object.keys(cedulas[0]).filter((k) => !["x", "c", "p"].includes(k)).sort().join() === "decisao,opcao");
  ok("nenhuma pessoa nas cédulas abertas", VOTANTES.every((n) => !temId(cedulas, P[n])));
  ok("as cédulas abertas dividem um xmin só (depois da apuração, que não é o de nenhum voto)", new Set(cedulas.map((c) => c.x)).size === 1 && (!voto.porTipo.decisao || !votantes.some((v) => v.x === cedulas[0].x)));
  ok("as cifradas saíram do banco", !voto.porTipo.decisao || (await um("select count(*)::int n from interno.alumia_decisao_cifradas where decisao = $1", [SEC.id])).n === 0);
  // Pela posição: a ordem no disco não é a de chegada (8 Sábados e depois 6 Domingos, na ordem exata, seria 1 chance em 45045).
  const naOrdem = VOTANTES.slice(0, 15).map((n) => escolhaDe[n]);
  ok("pela posição no disco: a ordem das cédulas não é a ordem dos votos", cedulas.map((c) => c.opcao).join() !== naOrdem.join());
  // Casar pela ordem: a n-ésima linha de "votou" com a n-ésima cédula. Acerto no nível do acaso, não mais.
  const acertos = votantes.filter((v, i) => cedulas[i] && escolhaDe[nomes.find((n) => P[n] === v.usuario)] === cedulas[i].opcao).length;
  ok(`casar "votou" com a cédula pela ordem não passa do acaso (${acertos} de 15)`, acertos < 15);
}

// ═══════════════════ 6. Sem quórum, ou com menos de 3: sem resultado ═══════════════════
{
  const Q = await chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, pergunta: "Trocamos o horário da assembleia?", opcoes: ["Sim", "Não"], quorum: 10 } });
  const DOIS = await chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, pergunta: "Mudamos o nome do grupo?", opcoes: ["Sim", "Não"], quorum: 3 } });
  for (const n of ["v1", "v2", "v3", "v4"]) await voto.decisao(chamar, P[n], Q.id, Q.opcoes[0].id);
  for (const n of ["v1", "v2"]) await voto.decisao(chamar, P[n], DOIS.id, DOIS.opcoes[0].id);
  await fechar(Q.id);
  await fechar(DOIS.id);
  await voto.apurar("decisao", Q.id);
  await voto.apurar("decisao", DOIS.id);
  await espera("sem quórum: quantas pessoas votaram e 'não atingiu', sem resultado", () => daLista(P.v1, Q.id), (d) => d.resultado === false && d.quorumAtingido === false && d.votantes === 4 && d.opcoes.every((o) => o.votos === null));
  await espera("com 2 votos: nem o número de quem votou", () => daLista(P.v1, DOIS.id), (d) => d.resultado === false && d.votantes === null && d.opcoes.every((o) => o.votos === null));
  // A urna aberta (depois da apuração; antes da R2, a urna às claras): sem pessoa, regravada junto.
  const urna = await linhas("select xmin::text x, * from interno.alumia_decisao_cedulas where decisao = $1", [Q.id]);
  ok("na urna, a cédula fica sem pessoa e regravada junto (um xmin só)", urna.length === 4 && new Set(urna.map((u) => u.x)).size === 1 && ["v1", "v2", "v3", "v4"].every((n) => !temId(urna, P[n])));
  await recusa("votação fechada não recebe voto", () => voto.decisao(chamar, P.v5, Q.id, Q.opcoes[0].id), "fechada");
}

// ═══════════════════ 7. O modo aberto: o nome vai junto, e só aparece no fim ═══════════════════
{
  const AB = await espera("a moderação abre uma votação aberta", () => chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, pergunta: "Quem leva a pauta à plenária?", opcoes: ["Comissão", "Rodízio"], modo: "aberta", quorum: 3 } }), (d) => d.modo === "aberta");
  if (voto.porTipo.decisao) await recusa("no modo aberto não há cédula cifrada", async () => chamar(P.v1, "alumia_decisao_votar_cifrada", { p_id: AB.id, p_cedula: await voto.cedula("decisao", AB.id, [AB.opcoes[0].id]) }), "invalido:modo");
  for (const [i, n] of ["v1", "v2", "v3", "v4"].entries()) await chamar(P[n], "alumia_decisao_votar", { p_id: AB.id, p_opcao: AB.opcoes[i < 3 ? 0 : 1].id });
  await recusa("opção de outra votação não vale", () => chamar(P.v5, "alumia_decisao_votar", { p_id: AB.id, p_opcao: OPS[0] }), "invalido:opcao");
  await espera("aberta: nem nomes nem números antes do prazo", () => daLista(P.v5, AB.id), (d) => d.opcoes.every((o) => o.quem === null && o.votos === null));
  await fechar(AB.id);
  await espera("no fim: os nomes por opção, e o número só a partir de 3", () => daLista(P.v5, AB.id),
    (d) => d.resultado === true && d.opcoes[0].votos === 3 && d.opcoes[0].quem.length === 3 && d.opcoes[0].quem.includes("Codinome 05")
      && d.opcoes[1].votos === null && d.opcoes[1].poucos === true && d.opcoes[1].quem.length === 1);
}

// ═══════════════════ 8. Cancelar ═══════════════════
{
  const C = await chamar(P.mod, "alumia_decisao_criar", { p_slug: SLUG, p: { ...pedido, pergunta: "Votação aberta por engano" } });
  await voto.decisao(chamar, P.v1, C.id, C.opcoes[0].id);
  await recusa("quem não modera não cancela", () => chamar(P.v1, "alumia_decisao_cancelar", { p_id: C.id }), "nao_encontrado");
  await espera("a moderação cancela: as cédulas e quem votou somem", async () => [await chamar(P.mod, "alumia_decisao_cancelar", { p_id: C.id }),
    (await um("select (select count(*) from interno.alumia_decisao_cedulas where decisao = $1) + (select count(*) from interno.alumia_decisao_cifradas where decisao = $1) + (select count(*) from interno.alumia_decisao_votantes where decisao = $1) n", [C.id])).n],
    ([d, n]) => d.situacao === "cancelada" && Number(n) === 0);
  await recusa("cancelada não recebe voto", () => voto.decisao(chamar, P.v2, C.id, C.opcoes[0].id), "fechada");
  if (!voto.porTipo.decisao) await recusa("o servidor não apura cancelada", () => servico("alumia_decisao_apurar", { p_id: C.id, p_escolhas: [], p_quantas: 0 }), "aberta");
}

// ═══════════════════ 9. Quem vê a lista ═══════════════════
await espera("quem não é da comunidade recebe a lista vazia", () => chamar(P.fora, "alumia_decisao_lista", { p_slug: SLUG }), (r) => r.membro === false && r.modero === false && r.decisoes.length === 0);
await espera("a lista nunca traz o id de quem votou", () => chamar(P.mod, "alumia_decisao_lista", { p_slug: SLUG }), (r) => r.modero === true && r.decisoes.length >= 4 && VOTANTES.every((n) => !temId(r, P[n])));

// ═══════════════════ 10. Os números para a moderação ═══════════════════
{
  await recusa("quem não modera não vê os números", () => chamar(P.v1, "alumia_decisao_numeros", { p_slug: SLUG }), "sem_permissao");
  // Esta semana: 5 posts e 2 respostas, 4 denúncias (3 decididas, com o tempo registrado), 1 pessoa nova.
  await dono("update interno.rede_comunidade_membros set entrou_em = now() - interval '40 days' where comunidade = $1", [SLUG]);
  await dono("update interno.rede_comunidade_membros set entrou_em = now() where comunidade = $1 and usuario = $2", [SLUG, P.v16]);
  const posts = [];
  for (let i = 0; i < 5; i++) posts.push((await um("insert into interno.rede_posts (autor, texto, comunidade, publico) values ($1, $2, $3, 'comunidade') returning id", [P[`v${i + 1}`], `Post ${i}`, SLUG])).id);
  for (let i = 0; i < 2; i++) await dono("insert into interno.rede_posts (autor, texto, comunidade, resposta_a, publico) values ($1, 'resposta', $2, $3, 'comunidade')", [P.v6, SLUG, posts[0]]);
  for (let i = 0; i < 4; i++) {
    const d = (await um("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, quem, situacao, criado_em) values ('post', $1, 'spam', $2, $3, now() - interval '1 minute') returning id", [posts[i], P.outra, i < 3 ? "resolvida" : "aberta"])).id;
    if (i < 3) await dono("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, motivo, quem, denuncia, criado_em) values ('remover', 'post', $1, 'spam repetido', $2, $3, now() - interval '1 minute' + ($4 || ' hours')::interval)", [posts[i], P.mod, d, String(i + 1)]);
  }
  const r = await espera("os números da semana: posts, respostas, denúncias e o tempo (mediana); abaixo de 3, nulo", () => chamar(P.mod, "alumia_decisao_numeros", { p_slug: SLUG }), (x) => {
    const s = x.semanas[0];
    return x.semanas.length === 8 && s.posts === 5 && s.respostas === null && s.membros_novos === null && s.denuncias === 4 && s.decididas === 3 && Number(s.resposta_horas) === 2
      && x.denuncias_abertas === null && x.semanas.slice(1).every((w) => w.posts === null);
  });
  ok("os números não trazem pessoa nenhuma (nem id, nem nome)", r && nomes.every((n) => !temId(r, P[n])) && !/Codinome/.test(JSON.stringify(r)));
  ok("nenhum 'quem mais posta': a resposta só tem números por semana", r && Object.keys(r.semanas[0]).sort().join() === "decididas,denuncias,membros_novos,posts,resposta_horas,respostas,semana");
}
} catch (erro) {
  falhas.push(`erro inesperado: ${erro.stack ?? erro.message}`);
}

console.log(`\n${certos} conferências certas, ${falhas.length} falha(s).`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
