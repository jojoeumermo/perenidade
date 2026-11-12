// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a entrada da Alumia (supabase/migracoes/20261110-alumia-entrada.sql) num Postgres de verdade (scripts/banco-local.mjs), com
// a migração rodada TRÊS vezes sobre o install.sql, e a lógica pura da ponte de sessão (lib/sessao/ponte.ts) e das silhuetas.
// Matriz: visitante, conta nova (em análise → recusada → pede de novo só depois de 30 dias), conta nova aprovada, quem já era
// membro antes da trava, militante da Escola, coordenação, mediação (com e sem o segundo fator) e a chave de serviço.
// Regras: trava desligada não muda nada; ligada, sem aprovação e sem aal2 ninguém lê a linha nem é membro; 'geral' continua
// aberta; a fila só para a triagem com aal2 e sem e-mail nem id de conta; ninguém decide o próprio pedido; aprovar na Alumia
// não dá a Escola; recusar pede motivo; o motivo do pedido some 30 dias depois da decisão.
// No fim, o login único de ponta a ponta: a rota /api/sessao/ponte de verdade contra as contas de teste (scripts/backend-local.mjs).
// Depois, as portas (supabase/migracoes/20261112-alumia-portas.sql): o ataque da conta nova que segue e lê os posts de seguidores,
// a varredura do pg_proc (toda função public.rede_* e alumia_* chamada sem aprovação e sem o segundo fator), quem fura a fila
// aderindo direto, a triagem que não vira arma, e o freio da ponte no banco.
// Uso: npm run testar:alumia-entrada
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { origemDoSite, origemPodePedir, mensagemDaPonte } from "../lib/sessao/ponte.ts";
import { figurasDaEntrada } from "../lib/rede/entrada/figuras.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261110-alumia-entrada.sql");
ok("a migração está colada no FIM do install.sql (seguida só das datadas posteriores)", noFimDoInstall(sql, ler("supabase/install.sql")));
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 12 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("nenhuma permissão direta na tabela para anon/authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("a tabela nasce com RLS", /alter table interno\.alumia_entrada enable row level security/.test(sql));
ok("a fila nunca devolve e-mail", !/'email'/.test(sql.slice(sql.indexOf("alumia_triagem_fila"))));
const portas = ler("supabase/migracoes/20261112-alumia-portas.sql");
ok("as portas estão coladas no FIM do install.sql, depois da entrada", noFimDoInstall(portas, ler("supabase/install.sql")) && ler("supabase/install.sql").lastIndexOf("alumia_trancar()") > ler("supabase/install.sql").lastIndexOf("create or replace function public.alumia_entrada_eu"));
ok("portas: toda função nova é security definer com search_path fixo (menos a lista de exceções, que não lê nada)", (() => {
  const funcoes = portas.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 9 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || /interno\.alumia_porta_aberta/.test(f));
})());

// ═══════════════════ 1. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const como = (sub, aal = "aal1") => ({ papel: "authenticated", sub, aal, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const servico = { papel: "service_role", ip: "127.0.0.1" };

const P = {};
for (const nome of ["coord", "mediador", "militante", "antiga", "nova", "nova2", "curiosa"]) {
  P[nome] = await criarUsuario(`${nome}@entrada.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.mediador]);
await dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [P.militante, P.coord]);
// "antiga" já era membro da Alumia antes da trava.
await dono("update interno.perfis set rede_codinome = 'Antiga do Bairro', rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1 where id = $1", [P.antiga]);
await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P.antiga]);

await espera("a migração instala de novo sobre o install.sql (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("as portas instalam de novo depois da entrada (idempotente)", () => exec(portas));
await espera("e uma terceira vez sem estrago", () => exec(portas));
await espera("quem já era membro ficou aprovado (ja_membro)", async () => (await dono("select situacao, origem from interno.alumia_entrada where usuario = $1", [P.antiga])).rows[0], (r) => r?.situacao === "aprovada" && r.origem === "ja_membro");
await espera("com a trava desligada, visitante lê a linha aberta como antes", () => rpc(visitante(), "rede_linha", { p_aba: "geral" }), (r) => Array.isArray(r?.itens));
await espera("com a trava desligada, a antiga lê 'tudo' mesmo sem aal2", () => rpc(como(P.antiga), "rede_linha", { p_aba: "tudo" }), (r) => Array.isArray(r?.itens));

// ── a pessoa ──
await espera("visitante: só {logado: false}", () => rpc(visitante(), "alumia_entrada_eu"), (r) => r.logado === false && Object.keys(r).length <= 2);
await espera("conta nova sem pedido", () => rpc(como(P.nova), "alumia_entrada_eu"), (r) => r.situacao === "sem_pedido" && r.aal2 === false);
await espera("coordenação entra direto", () => rpc(como(P.coord), "alumia_entrada_eu"), (r) => r.situacao === "aprovada" && r.direto === true);
await espera("militante da Escola entra direto", () => rpc(como(P.militante), "alumia_entrada_eu"), (r) => r.situacao === "aprovada" && r.direto === true);
const pedir = (quem, extra = {}) => rpc(como(P[quem]), "alumia_entrada_pedir", { p_codinome: `Codinome ${quem}`, p_motivo: "Quero me organizar com o núcleo do meu bairro.", p_maior: true, p_versao: 1, p_aceite: true, ...extra });
await recusa("visitante não pede", () => rpc(visitante(), "alumia_entrada_pedir", { p_codinome: "X", p_motivo: "y", p_maior: true, p_versao: 1, p_aceite: true }), "permission denied");
await recusa("sem aceite das regras não pede", () => pedir("nova", { p_aceite: false }), "aceite_obrigatorio");
await recusa("menor de 18 não pede", () => pedir("nova", { p_maior: false }), "idade_minima");
await recusa("motivo curto demais", () => pedir("nova", { p_motivo: "oi" }), "invalido:motivo");
await recusa("motivo com telefone é dado pessoal", () => pedir("nova", { p_motivo: "me liga no (11) 98888-7777 por favor" }), "dado_pessoal");
await recusa("motivo com e-mail é dado pessoal", () => pedir("nova", { p_motivo: "escreve para fulana@exemplo.com.br" }), "dado_pessoal");
await recusa("codinome com @ não serve", () => pedir("nova", { p_codinome: "@fulana" }), "invalido:codinome");
await espera("o pedido entra em análise", () => pedir("nova"), (r) => r.situacao === "em_analise" && r.codinome === "Codinome nova");
await espera("pedir de novo em análise só atualiza o motivo", () => pedir("nova", { p_motivo: "Quero ajudar na comunicação do ato de sexta." }), (r) => r.situacao === "em_analise");
await espera("e não conta como outra tentativa", async () => (await dono("select tentativas, motivo_pedido from interno.alumia_entrada where usuario = $1", [P.nova])).rows[0], (r) => r.tentativas === 1 && /comunicação/.test(r.motivo_pedido));
await espera("o pedido gravou 18+ e o consentimento", async () => (await dono("select rede_18, rede_consentimento from interno.perfis where id = $1", [P.nova])).rows[0], (r) => r.rede_18 === true && r.rede_consentimento === 1);
await espera("nova2 também pede", () => pedir("nova2"), (r) => r.situacao === "em_analise");
await espera("o mediador também tem um pedido (para provar que não decide o próprio)", () => pedir("mediador"), (r) => r.situacao === "em_analise");
await espera("militante pede sem motivo e continua aprovada (só codinome e consentimento)", () => pedir("militante", { p_motivo: "" }), (r) => r.situacao === "aprovada");

// ── a trava ──
await espera("a coordenação liga a trava pelo SQL Editor", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r.exigir === true);
await recusa("ligar não é para conta nenhuma (só o dono do banco)", () => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: P.coord, aal: "aal2" })]);
  await banco.pg.exec("set role authenticated");
  try { return (await banco.pg.query("select interno.alumia_entrada_ligar(false)")).rows; } finally { await banco.pg.exec("reset role"); }
}), "permission denied");
await recusa("visitante não lê 'tudo'", () => rpc(visitante(), "rede_linha", { p_aba: "tudo" }), "alumia_entrada");
await recusa("visitante não lê comunidade", () => rpc(visitante(), "rede_linha", { p_aba: "c:geral" }), "alumia_entrada");
await espera("a linha aberta das disciplinas continua aberta", () => rpc(visitante(), "rede_linha", { p_aba: "geral" }), (r) => Array.isArray(r?.itens));
await recusa("conta em análise não lê", () => rpc(como(P.nova, "aal2"), "rede_linha", { p_aba: "tudo" }), "alumia_entrada");
await recusa("conta em análise não conta novos", () => rpc(como(P.nova, "aal2"), "rede_novos", { p_aba: "tudo", p_desde: new Date(0).toISOString() }), "alumia_entrada");
await recusa("antiga sem o segundo fator não lê", () => rpc(como(P.antiga), "rede_linha", { p_aba: "tudo" }), "alumia_entrada");
await espera("antiga com o segundo fator lê", () => rpc(como(P.antiga, "aal2"), "rede_linha", { p_aba: "tudo" }), (r) => Array.isArray(r?.itens));
await espera("a chave de serviço (federação) passa", () => rpc(servico, "rede_linha", { p_aba: "c:geral" }), (r) => Array.isArray(r?.itens));
const membro = (quem, aal) => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal })]);
  try { return (await banco.pg.query("select interno.rede2_membro($1) as m", [P[quem]])).rows[0].m; } finally { await banco.pg.query("select set_config('request.jwt.claims', '', false)"); }
});
await espera("antiga: membro só com aal2", async () => [await membro("antiga", "aal1"), await membro("antiga", "aal2")], ([a, b]) => a === false && b === true);
await espera("nova em análise não é membro nem com aal2", () => membro("nova", "aal2"), (m) => m === false);
await espera("a coordenação é membro com aal2 (depois do consentimento)", async () => {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P.coord]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P.coord]);
  return membro("coord", "aal2");
}, (m) => m === true);

// ── a triagem ──
await recusa("visitante não vê a fila", () => rpc(visitante(), "alumia_triagem_fila"), "permission denied");
await recusa("conta comum não vê a fila", () => rpc(como(P.curiosa, "aal2"), "alumia_triagem_fila"), "sem_permissao");
await recusa("militante (sem papel de triagem) não vê a fila", () => rpc(como(P.militante, "aal2"), "alumia_triagem_fila"), "sem_permissao");
await recusa("mediação sem o segundo fator não vê a fila", () => rpc(como(P.mediador), "alumia_triagem_fila"), "sem_permissao");
await espera("conta comum recebe nulo na contagem", () => rpc(como(P.curiosa, "aal2"), "alumia_triagem_contagem"), (n) => n === null);
const fila = await espera("mediação com aal2 vê a fila", () => rpc(como(P.mediador, "aal2"), "alumia_triagem_fila"), (r) => r.pendentes.length === 3);
const texto = JSON.stringify(fila ?? {});
ok("a fila não traz e-mail nem id de conta", !/@entrada\.local/.test(texto) && !Object.values(P).some((id) => texto.includes(id)));
ok("a fila traz codinome, motivo e idade da conta", fila?.pendentes?.some((p) => p.codinome === "Codinome nova" && /comunicação/.test(p.motivo) && typeof p.conta_dias === "number"));
await espera("a contagem bate", () => rpc(como(P.coord, "aal2"), "alumia_triagem_contagem"), (n) => n === 3);
const ficha = (codinome) => fila?.pendentes?.find((p) => p.codinome === codinome)?.id;
await recusa("ninguém decide o próprio pedido", () => rpc(como(P.mediador, "aal2"), "alumia_triagem_decidir", { p_id: ficha("Codinome mediador"), p_aprovar: true, p_motivo: "" }), "proprio_pedido");
await recusa("recusar sem motivo não vale", () => rpc(como(P.mediador, "aal2"), "alumia_triagem_decidir", { p_id: ficha("Codinome nova"), p_aprovar: false, p_motivo: "não" }), "invalido:motivo");
await recusa("ficha inventada", () => rpc(como(P.mediador, "aal2"), "alumia_triagem_decidir", { p_id: "00000000-0000-4000-8000-000000000000", p_aprovar: true, p_motivo: "" }), "nao_encontrado");
await espera("a mediação recusa com motivo", () => rpc(como(P.mediador, "aal2"), "alumia_triagem_decidir", { p_id: ficha("Codinome nova"), p_aprovar: false, p_motivo: "Pedido sem relação com a organização." }), (r) => r.situacao === "recusada");
await espera("a pessoa vê a recusa e o motivo, e quando pode pedir de novo", () => rpc(como(P.nova), "alumia_entrada_eu"), (r) => r.situacao === "recusada" && /sem relação/.test(r.motivo_recusa) && r.pedir_de_novo_em);
await recusa("e não pede de novo antes de 30 dias", () => pedir("nova"), "recusada_recente");
await espera("a pessoa recebeu o aviso com o motivo", async () => (await dono("select texto from interno.avisos where para = $1", [P.nova])).rows.map((r) => r.texto), (t) => t.some((x) => /não foi aceito/.test(x) && /sem relação/.test(x)));
await espera("depois de 30 dias pede de novo (outra tentativa)", async () => {
  await dono("update interno.alumia_entrada set decidido_em = now() - interval '31 days' where usuario = $1", [P.nova]);
  return pedir("nova");
}, (r) => r.situacao === "em_analise");
await espera("a coordenação aprova nova2", () => rpc(como(P.coord, "aal2"), "alumia_triagem_decidir", { p_id: ficha("Codinome nova2"), p_aprovar: true, p_motivo: "" }), (r) => r.situacao === "aprovada");
await recusa("nova2 aprovada sem o segundo fator ainda não lê", () => rpc(como(P.nova2), "rede_linha", { p_aba: "tudo" }), "alumia_entrada");
await espera("nova2 aprovada com o segundo fator lê", () => rpc(como(P.nova2, "aal2"), "rede_linha", { p_aba: "tudo" }), (r) => Array.isArray(r?.itens));
await espera("aprovar na Alumia não dá a Escola", () => rpc(como(P.nova2, "aal2"), "escola_eu"), (r) => r.militante === false);
await espera("a militante continua na Escola", () => rpc(como(P.militante, "aal2"), "escola_eu"), (r) => r.militante === true);
await espera("a decisão foi ao registro", async () => (await dono("select count(*)::int as n from interno.auditoria where acao = 'alumia_triagem'")).rows[0], (r) => r.n === 2);
await espera("o motivo do pedido e o da decisão somem 30 dias depois, pela faxina (abrir a fila não apaga nada)", async () => {
  await dono("update interno.alumia_entrada set decidido_em = now() - interval '40 days' where usuario = $1", [P.nova2]);
  await dono("update interno.alumia_entrada set motivo_decisao = 'Motivo antigo da decisão.' where usuario = $1", [P.nova2]);
  await rpc(como(P.mediador, "aal2"), "alumia_triagem_fila");
  const aindaLa = (await dono("select motivo_pedido from interno.alumia_entrada where usuario = $1", [P.nova2])).rows[0].motivo_pedido;
  const n = (await dono("select interno.alumia_entrada_faxina() as n")).rows[0].n;
  return { aindaLa, n, ...(await dono("select motivo_pedido, motivo_decisao from interno.alumia_entrada where usuario = $1", [P.nova2])).rows[0] };
}, (r) => typeof r.aindaLa === "string" && r.n === 1 && r.motivo_pedido === null && r.motivo_decisao === null);
await espera("tirar a aprovação (recusar quem já entrou) tranca de novo", async () => {
  const f = await rpc(como(P.coord, "aal2"), "alumia_triagem_fila");
  const id = (await dono("select id from interno.alumia_entrada where usuario = $1", [P.nova2])).rows[0].id;
  await rpc(como(P.coord, "aal2"), "alumia_triagem_decidir", { p_id: id, p_aprovar: false, p_motivo: "Descumpriu as normas da Alumia." });
  return [f, await membro("nova2", "aal2")];
}, ([, m]) => m === false);
await espera("conta suspensa aparece como suspensa", async () => {
  await dono("update interno.perfis set suspenso = true where id = $1", [P.curiosa]);
  return (await dono("select interno.alumia_situacao($1) as s", [P.curiosa])).rows[0].s;
}, (s) => s === "suspensa");
// ═══════════════════ 1b. As portas (20261112-alumia-portas.sql), com a trava LIGADA ═══════════════════
// O ataque que os revisores provaram: conta nova, sem pedido e sem o segundo fator, abria o perfil de uma pessoa, seguia e lia os
// posts "só para seguidores" pelas funções da Rede de antes, que não passavam por rede2_membro nem por rede_aba.
for (const nome of ["controle", "intrusa", "furona"]) {
  P[nome] = await criarUsuario(`${nome}@entrada.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.rede_niveis set imagens = 4, links = 50, posts_dia = 5000").catch(() => undefined);
await dono("update interno.perfis set rede_codinome = 'Controle da Ocupação', rede_codinome_ok = true, rede_handle = 'controle', rede_18 = true, rede_consentimento = 1 where id = $1", [P.controle]);
await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P.controle]);
await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P.controle]);
const segredo = await espera("a conta de controle (aprovada, com o segundo fator) publica só para seguidores", () => rpc(como(P.controle, "aal2"), "rede_publicar", { p: { texto: "SEGREDO da ocupação: a reunião é na quinta.", publico: "seguidores" } }), (r) => typeof r?.id === "string");
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P.antiga, P.controle]);
for (const aal of ["aal1", "aal2"]) {
  await recusa(`ataque (${aal}): conta sem pedido não abre o perfil de ninguém`, () => rpc(como(P.intrusa, aal), "rede_perfil_de", { p_handle: "controle" }), "alumia_entrada");
  await recusa(`ataque (${aal}): conta sem pedido não segue ninguém`, () => rpc(como(P.intrusa, aal), "rede_seguir", { p_usuario: P.controle, p_sim: true }), "alumia_entrada");
  await recusa(`ataque (${aal}): conta sem pedido não lê a linha do perfil (Rede de antes)`, () => rpc(como(P.intrusa, aal), "rede_linha", { p_modo: "perfil", p_usuario: P.controle }), "alumia_entrada");
  await recusa(`ataque (${aal}): conta sem pedido não busca`, () => rpc(como(P.intrusa, aal), "rede_buscar", { p_termo: "SEGREDO" }), "alumia_entrada");
  await recusa(`ataque (${aal}): conta sem pedido não conta novos (Rede de antes)`, () => rpc(como(P.intrusa, aal), "rede_novos", { p_desde: new Date(0).toISOString() }), "alumia_entrada");
}
await recusa("ataque: visitante não abre perfil pelo id", () => rpc(visitante(), "rede_perfil", { p_usuario: P.controle }), "alumia_entrada");
await recusa("ataque: aprovada sem o segundo fator (senha roubada) não segue", () => rpc(como(P.antiga), "rede_seguir", { p_usuario: P.controle, p_sim: true }), "alumia_entrada");
await espera("ataque: mesmo com a linha de 'seguir' já gravada, quem não é aprovada não vê o post de seguidores", async () => {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P.intrusa, P.controle]);
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P.intrusa]);
  const ve = async (quem) => (await dono("select interno.rede2_pode_ver(p, $2) as v from interno.rede_posts p where p.id = $1", [segredo.id, quem])).rows[0].v;
  const r = [await ve(P.intrusa), await ve(P.antiga)];
  await dono("delete from interno.rede_seguindo where quem = $1", [P.intrusa]);
  await dono("update interno.perfis set rede_18 = false, rede_consentimento = null where id = $1", [P.intrusa]);
  return r;
}, ([intrusa, antiga]) => intrusa === false && antiga === true);
await espera("a seguidora aprovada, com o segundo fator, lê o post (a porta não tranca quem é de dentro)", () => rpc(como(P.antiga, "aal2"), "rede_buscar", { p_termo: "SEGREDO" }), (r) => JSON.stringify(r).includes("SEGREDO"));

// A regra, função por função: lê o pg_proc e chama CADA public.rede_* / alumia_* que anon ou authenticated podem chamar, como
// (i) conta não aprovada com o segundo fator, (ii) conta aprovada SEM o segundo fator e (iii) visitante. Fora da lista curta de
// exceções, todas têm de recusar com "alumia_entrada" (as três de regra de arquivo respondem falso). Função nova não nasce aberta.
const ABERTAS = ["alumia_entrada_eu()", "alumia_entrada_pedir(p_codinome text, p_motivo text, p_maior boolean, p_versao integer, p_aceite boolean)",
  "alumia_triagem_contagem()", "alumia_triagem_decidir(p_id uuid, p_aprovar boolean, p_motivo text)", "alumia_triagem_fila()",
  "rede_aderir(p_maior boolean, p_versao integer)", "rede_aderir(p_maior boolean, p_versao integer, p_fediverso boolean)", "rede_alumia_versao()",
  "rede_antigo(p_tipo text, p_antigo text)", "rede_codinome_definir(p_codinome text)", "rede_confirmar_idade()", "rede_confirmar_idade(p_maior boolean)",
  "rede_eu()", "rede_fed_servidor(p_segredo text, p_acao text, p jsonb)", "rede_fed_situacao()", "rede_linha(p_aba text, p_cursor text, p_limite integer)", "rede_novos(p_aba text, p_desde timestamp with time zone)", "rede_situacao()"];
const SO_FALSO = ["rede_pub_midia_pode", "rede_pub_pode_enviar", "rede_story_pode"];
const funcoesDaRede = async () => (await dono(`
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  order by 1, 2`)).rows;
const valorDe = (tipo) => {
  if (/\[\]$/.test(tipo)) return "{}";
  if (tipo === "uuid") return "00000000-0000-4000-8000-00000000abcd";
  if (/^(integer|smallint|bigint|numeric|double precision|real)$/.test(tipo)) return 1;
  if (tipo === "boolean") return true;
  if (/^jsonb?$/.test(tipo)) return {};
  if (/^(timestamp|date)/.test(tipo)) return new Date(0).toISOString();
  return "x";
};
const argumentosDe = (args) => Object.fromEntries(args.split(", ").filter((a) => a && !/^OUT /.test(a)).map((a) => {
  const [nome, ...tipo] = a.replace(/^(IN|INOUT|VARIADIC) /, "").split(" ");
  return [nome, valorDe(tipo.join(" "))];
}));
{
  const todas = await funcoesDaRede();
  ok("portas: a varredura achou as funções da rede (mais de 300)", todas.length > 300);
  ok("portas: sem a porta só ficam as exceções escritas (nem uma a mais, nem uma a menos)", todas.filter((f) => !f.porta).map((f) => `${f.nome}(${f.args})`).sort().join("\n") === [...ABERTAS].sort().join("\n"));
  const furos = [];
  for (const f of todas.filter((x) => x.porta)) {
    const chamadas = [["não aprovada com aal2", como(P.intrusa, "aal2"), f.aut], ["aprovada sem aal2", como(P.antiga), f.aut], ["visitante", visitante(), f.anon]];
    for (const [quem, sessao, pode] of chamadas) {
      if (!pode) continue;
      try {
        const r = await rpc(sessao, f.nome, argumentosDe(f.args));
        if (!(SO_FALSO.includes(f.nome) && r === false)) furos.push(`${f.nome}(${f.args}) respondeu a ${quem}: ${JSON.stringify(r)?.slice(0, 80)}`);
      } catch (erro) {
        const m = String(erro.message);
        if (!m.includes("alumia_entrada")) furos.push(`${f.nome}(${f.args}) para ${quem}: ${m.slice(0, 80)}`);
      }
    }
  }
  ok(`portas: toda função da rede recusa quem não passou pela entrada (${furos.slice(0, 6).join(" | ")}${furos.length > 6 ? ` … e mais ${furos.length - 6}` : ""})`, furos.length === 0);
}
await espera("portas: função nova em plpgsql nasce aberta, e a regra tranca", async () => {
  await exec(`create or replace function public.rede_teste_nova() returns text language plpgsql security definer set search_path = interno, pg_temp as $f$ begin return 'aberta'; end $f$;
    create or replace function public.rede_teste_sql(p_x integer) returns integer language sql stable security definer set search_path = interno, pg_temp as $f$ select p_x + 1 $f$;
    grant execute on function public.rede_teste_nova(), public.rede_teste_sql(integer) to anon, authenticated;`);
  const antes = await rpc(como(P.intrusa), "rede_teste_nova");
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  return [antes, r];
}, ([antes, r]) => antes === "aberta" && r.trancadas === 2 && r.abertas.length === 0);
await recusa("portas: depois da regra, a função nova recusa", () => rpc(como(P.intrusa), "rede_teste_nova"), "alumia_entrada");
await recusa("portas: a função nova em SQL também", () => rpc(visitante(), "rede_teste_sql", { p_x: 1 }), "alumia_entrada");
await espera("portas: e segue respondendo a quem é de dentro", () => rpc(como(P.antiga, "aal2"), "rede_teste_sql", { p_x: 1 }), (r) => r === 2);
await espera("portas: rodar a regra de novo não mexe em nada", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.trancadas === 0 && r.abertas.length === 0);
await espera("portas: função que a regra não consegue trancar aparece em 'abertas'", async () => {
  await exec(`create or replace function public.rede_teste_lista() returns setof integer language sql stable as $f$ select 1 $f$; grant execute on function public.rede_teste_lista() to authenticated;`);
  return (await dono("select interno.alumia_trancar() as r")).rows[0].r;
}, (r) => r.abertas.join() === "rede_teste_lista()");
await recusa("portas: e a trava não liga com porta aberta", () => dono("select interno.alumia_entrada_ligar(true)"), "sem porta");
await exec("drop function public.rede_teste_lista(); drop function public.rede_teste_nova(); drop function public.rede_teste_sql(integer);");
// Onda 7: as funções do servidor da federação ficam fora da porta, e o que já tinha sido trancado se destranca.
const portasFed = ler("supabase/migracoes/20261113-alumia-o7-portas-fediverso.sql");
ok("portas do Fediverso: a migração está colada no FIM do install.sql", noFimDoInstall(portasFed, ler("supabase/install.sql")));
await espera("portas do Fediverso: a regra não tranca rede_fed_servidor", async () => (await dono("select prosrc ~ 'interno\.alumia_porta' as t from pg_proc where proname = 'rede_fed_servidor'")).rows.every((r) => !r.t), (r) => r === true);
await espera("portas do Fediverso: o que tinha sido trancado (como em produção) volta ao corpo de antes", async () => {
  await exec(`create or replace function public.rede_teste_volta() returns text language plpgsql security definer set search_path = interno, pg_temp as $f$ begin return 'aberta'; end $f$;
    create or replace function public.rede_teste_volta_sql(p_x integer) returns integer language sql stable security definer set search_path = interno, pg_temp as $f$ select p_x + 1 $f$;
    grant execute on function public.rede_teste_volta(), public.rede_teste_volta_sql(integer) to anon, authenticated;`);
  await dono("select interno.alumia_trancar()");
  const n = (await dono("select interno.alumia_destrancar('rede_teste_volta') + interno.alumia_destrancar('rede_teste_volta_sql') as n")).rows[0].n;
  const corpo = (await dono("select string_agg(l.lanname || ':' || (p.prosrc ~ 'alumia_porta')::text, ',' order by p.proname) as c from pg_proc p join pg_language l on l.oid = p.prolang where proname in ('rede_teste_volta', 'rede_teste_volta_sql')")).rows[0].c;
  return [n, corpo, await rpc(como(P.intrusa), "rede_teste_volta"), await rpc(visitante(), "rede_teste_volta_sql", { p_x: 1 })];
}, ([n, corpo, a, b]) => n === 2 && corpo === "plpgsql:false,sql:false" && a === "aberta" && b === 2);
await espera("portas do Fediverso: a migração roda duas vezes sem estrago", async () => { await exec(portasFed); await exec(portasFed); return true; });
await exec("drop function public.rede_teste_volta(); drop function public.rede_teste_volta_sql(integer);");
await espera("portas: o próprio banco (agendador, SQL Editor) continua passando", async () => (await dono("select public.rede_avisos() as a, public.rede_pub_agendados_rodar() as b")).rows[0], (r) => Array.isArray(r.a));
await espera("portas: a chave de serviço passa", () => rpc(servico, "rede_mod_niveis"), (r) => Array.isArray(r));

// ── quem fura a fila ──
await recusa("fura-fila: com a trava ligada, consentir direto (sem pedido) é recusado", () => rpc(como(P.furona), "rede_aderir", { p_maior: true, p_versao: 1 }), "alumia_entrada");
await recusa("fura-fila: e pela função com o Fediverso também", () => rpc(como(P.furona), "rede_aderir", { p_maior: true, p_versao: 1, p_fediverso: false }), "alumia_entrada");
await espera("fura-fila: ligar de novo com a trava já ligada não aprova ninguém", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r.aprovados_agora === 0 && r.exigir === true);
await espera("fura-fila: desligar, aderir pelo caminho antigo e ligar de novo NÃO aprova", async () => {
  const antes = (await dono("select valor ->> 'ligada_em' as t from interno.configuracoes where chave = 'alumia_entrada'")).rows[0].t;
  await dono("select interno.alumia_entrada_ligar(false)");
  await rpc(como(P.furona), "rede_codinome_definir", { p_codinome: "Furona da Fila" });
  await rpc(como(P.furona), "rede_aderir", { p_maior: true, p_versao: 1 });
  const r = (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r;
  const depois = (await dono("select valor ->> 'ligada_em' as t from interno.configuracoes where chave = 'alumia_entrada'")).rows[0].t;
  return [r, (await dono("select interno.alumia_situacao($1) as s", [P.furona])).rows[0].s, antes, depois];
}, ([r, s, antes, depois]) => r.aprovados_agora === 0 && s === "sem_pedido" && typeof antes === "string" && antes === depois);
await recusa("fura-fila: e ela continua do lado de fora", () => rpc(como(P.furona, "aal2"), "rede_linha", { p_aba: "tudo" }), "alumia_entrada");
await espera("fura-fila: pelo pedido de verdade ela entra na fila", () => rpc(como(P.furona), "alumia_entrada_pedir", { p_codinome: "Furona da Fila", p_motivo: "Agora peço do jeito certo, pela fila.", p_maior: true, p_versao: 1, p_aceite: true }), (r) => r.situacao === "em_analise");

// ── a triagem não vira arma ──
{
  const fichaDe = async (quem) => (await dono("select id from interno.alumia_entrada where usuario = $1", [P[quem]])).rows[0]?.id;
  await recusa("triagem: a mediação não vira uma decisão já tomada", async () => rpc(como(P.mediador, "aal2"), "alumia_triagem_decidir", { p_id: await fichaDe("nova2"), p_aprovar: true, p_motivo: "" }), "sem_permissao");
  await recusa("triagem: a mediação não tira a aprovação de quem já entrou", async () => rpc(como(P.mediador, "aal2"), "alumia_triagem_decidir", { p_id: await fichaDe("controle"), p_aprovar: false, p_motivo: "Quero expulsar esta pessoa da rede." }), "sem_permissao");
  await espera("triagem: a coordenação aprova o pedido do mediador", async () => rpc(como(P.coord, "aal2"), "alumia_triagem_decidir", { p_id: await fichaDe("mediador"), p_aprovar: true, p_motivo: "" }), (r) => r.situacao === "aprovada");
  await recusa("triagem: nem a coordenação tira por aqui a aprovação de quem tem papel", async () => rpc(como(P.coord, "aal2"), "alumia_triagem_decidir", { p_id: await fichaDe("mediador"), p_aprovar: false, p_motivo: "Tentativa de expulsar a mediação." }), "sem_permissao");
  await espera("triagem: a contagem não conta conta suspensa (como a fila)", async () => {
    await dono("insert into interno.alumia_entrada (usuario, situacao, motivo_pedido) values ($1, 'em_analise', 'Pedido de conta que depois foi suspensa.') on conflict (usuario) do nothing", [P.curiosa]);
    const fila = await rpc(como(P.coord, "aal2"), "alumia_triagem_fila");
    return [await rpc(como(P.coord, "aal2"), "alumia_triagem_contagem"), fila.pendentes.length];
  }, ([n, naFila]) => n === naFila && n === 2);
}

// ── a ponte: freio e registro no banco ──
await recusa("ponte no banco: conta comum não chama", () => rpc(como(P.antiga, "aal2"), "alumia_ponte_passar", { p_conta: P.antiga, p_destino: "alumia" }), "permission denied");
await espera("ponte no banco: 6 códigos por conta a cada 10 minutos, o sétimo não", async () => {
  await dono("delete from interno.limites where chave like 'alumia_ponte:%'");
  const r = [];
  for (let i = 0; i < 7; i++) r.push(await rpc(servico, "alumia_ponte_passar", { p_conta: P.antiga, p_destino: i % 2 ? "escola" : "alumia" }));
  return r;
}, (r) => r.join() === "true,true,true,true,true,true,false");
await espera("ponte no banco: o freio é por conta, e conta suspensa não passa", async () => [await rpc(servico, "alumia_ponte_passar", { p_conta: P.controle, p_destino: "alumia" }), await rpc(servico, "alumia_ponte_passar", { p_conta: P.curiosa, p_destino: "alumia" })], ([a, b]) => a === true && b === false);
await espera("ponte no banco: cada código vai ao registro, só com a conta e o destino", async () => (await dono("select quem, alvo, detalhes from interno.auditoria where acao = 'ponte' order by id")).rows, (l) => l.length === 7 && l.every((x) => ["alumia", "escola"].includes(x.alvo) && JSON.stringify(x.detalhes) === "{}"));
await dono("delete from interno.limites where chave like 'alumia_ponte:%'");

await espera("desligar a trava devolve tudo como era", async () => {
  await dono("select interno.alumia_entrada_ligar(false)");
  return rpc(visitante(), "rede_linha", { p_aba: "c:geral" });
}, (r) => Array.isArray(r?.itens));
await espera("com a trava desligada, as funções com a porta respondem como antes (conta sem aprovação abre perfil)", () => rpc(como(P.intrusa), "rede_perfil_de", { p_handle: "controle" }), (r) => r?.handle === "controle" || r?.perfil?.handle === "controle" || JSON.stringify(r).includes("controle"));
await espera("e a migração da entrada, rodada com a trava desligada, não aprova quem aderiu depois de a trava ter sido ligada", async () => {
  await dono("delete from interno.alumia_entrada where usuario = $1", [P.furona]);
  await exec(sql);
  await exec(portas);
  return (await dono("select interno.alumia_situacao($1) as s", [P.furona])).rows[0].s;
}, (s) => s === "sem_pedido");

// ── aplicativo autenticador novo: a conta fica sabendo ──
await espera("autenticador novo: quando passa a valer, a pessoa recebe o aviso de conta (uma vez)", async () => {
  await exec("create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null default 'unverified', created_at timestamptz not null default now())");
  await exec(portas);
  const avisos = async () => (await dono("select count(*)::int as n from interno.avisos where para = $1 and categoria = 'conta' and texto like 'Um aplicativo autenticador novo%'", [P.antiga])).rows[0].n;
  await dono("insert into auth.mfa_factors (user_id) values ($1)", [P.antiga]);
  const semValer = await avisos();
  await dono("update auth.mfa_factors set status = 'verified' where user_id = $1", [P.antiga]);
  const valendo = await avisos();
  await dono("update auth.mfa_factors set status = 'verified' where user_id = $1", [P.antiga]);
  const r = [semValer, valendo, await avisos()];
  await exec("drop table auth.mfa_factors");
  return r;
}, (r) => r.join() === "0,1,1");

// ═══════════════════ 2. A ponte de sessão (lógica pura) ═══════════════════
ok("ponte: o site de alumia.institutolucia.org é institutolucia.org", origemDoSite("https://alumia.institutolucia.org") === "https://institutolucia.org");
ok("ponte: o site de escola.institutolucia.org é institutolucia.org", origemDoSite("https://escola.institutolucia.org") === "https://institutolucia.org");
ok("ponte: no computador, alumia.localhost:3107 → localhost:3107", origemDoSite("http://alumia.localhost:3107") === "http://localhost:3107");
ok("ponte: o próprio site não tem ponte", origemDoSite("https://institutolucia.org") === null);
ok("ponte: outro domínio não tem ponte", origemDoSite("https://alumia.exemplo.com") === null);
ok("ponte: http fora do computador não vale", origemDoSite("http://alumia.institutolucia.org") === null);
ok("ponte: a Alumia pode pedir ao site", origemPodePedir("https://alumia.institutolucia.org", "https://institutolucia.org"));
ok("ponte: a Escola pode pedir ao site", origemPodePedir("https://escola.institutolucia.org", "https://institutolucia.org"));
ok("ponte: sub-subdomínio não pode", !origemPodePedir("https://x.alumia.institutolucia.org", "https://institutolucia.org"));
ok("ponte: outro subdomínio não pode", !origemPodePedir("https://estudio.institutolucia.org", "https://institutolucia.org"));
ok("ponte: domínio parecido não pode", !origemPodePedir("https://alumia.institutolucia.org.mal.com", "https://institutolucia.org"));
ok("ponte: domínio colado não pode", !origemPodePedir("https://alumiainstitutolucia.org", "https://institutolucia.org"));
ok("ponte: o site não pede a si mesmo", !origemPodePedir("https://institutolucia.org", "https://institutolucia.org"));
ok("ponte: http não pode em produção", !origemPodePedir("http://alumia.institutolucia.org", "https://institutolucia.org"));
ok("ponte: no computador vale com a mesma porta", origemPodePedir("http://alumia.localhost:3107", "http://localhost:3107"));
ok("ponte: no computador, outra porta não", !origemPodePedir("http://alumia.localhost:9999", "http://localhost:3107"));
ok("ponte: mensagem boa", mensagemDaPonte({ tipo: "pedir", n: "a".repeat(32) })?.tipo === "pedir");
ok("ponte: mensagem sem número da vez", mensagemDaPonte({ tipo: "pedir" }) === null);
ok("ponte: mensagem com tipo estranho", mensagemDaPonte({ tipo: "roubar", n: "a".repeat(32) }) === null);
ok("ponte: resposta com token_hash bom", mensagemDaPonte({ tipo: "sessao", n: "b".repeat(32), token_hash: "c".repeat(56) })?.token_hash === "c".repeat(56));
ok("ponte: resposta com token_hash estranho", mensagemDaPonte({ tipo: "sessao", n: "b".repeat(32), token_hash: "<script>" }) === null);

// ═══════════════════ 3. As silhuetas ═══════════════════
const figuras = figurasDaEntrada();
const lista = JSON.parse(ler("lib/rede/entrada/silhuetas.json")).figuras;
const creditos = JSON.parse(ler("lib/rede/entrada/creditos.json"));
ok("silhuetas: as 9 figuras ligadas (a lista da coordenação com Mariátegui; a de Fanon espera a decisão sobre a foto)", ["lenin", "marx", "engels", "stalin", "gramsci", "freire", "rosa", "marielle", "mariategui"].every((id) => figuras.some((f) => f.id === id)) && figuras.length === 9);
ok("silhuetas: figura desligada não fica publicada (nem arquivo, nem crédito, nem nome no rótulo) e o motivo está escrito", lista.filter((f) => !f.ligada).every((f) => !fs.existsSync(path.join(raiz, "public/alumia/entrada", `${f.id}.webp`)) && !creditos.some((c) => c.id === f.id) && (f.motivo ?? "").length > 40) && !/Fanon|Фанон|法农/.test(ler("lib/rede/entrada/textos.ts")));
ok("silhuetas: a grade conta as figuras (duas fileiras no celular, todas em linha no computador)", /\.ale-figuras \{[^}]*repeat\(var\(--ale-colunas, 5\), 1fr\)/.test(ler("styles/alumia-entrada.css")) && ler("styles/alumia-entrada.css").includes("grid-template-columns: repeat(var(--ale-n, 9), 1fr)") && /"--ale-n": figuras\.length/.test(ler("components/rede/entrada/Cena.tsx")));
ok("silhuetas: a derivada de foto CC BY-SA diz que sai sob a mesma licença (e o repositório avisa que ela não é AGPL)", creditos.filter((c) => /^CC BY-SA /.test(c.licenca)).length === 2 && creditos.filter((c) => /^CC BY-SA /.test(c.licenca)).every((c) => c.licencaDerivada === c.licenca) && figuras.filter((f) => f.credito.licencaDerivada).length === 2 && /freire\.webp. é CC BY-SA 3\.0 e .marielle\.webp. é CC BY-SA 2\.0/.test(ler("README.md")) && /creditosDerivada/.test(ler("components/rede/entrada/Cena.tsx")));
ok("silhuetas: pessoa viva sem autorização nunca entra", lista.filter((f) => f.viva && !f.autorizacao).every((f) => !figuras.some((x) => x.id === f.id)));
ok("silhuetas: toda figura tem arquivo e crédito com licença livre", figuras.every((f) => fs.existsSync(path.join(raiz, "public", f.src)) && /^(Public domain|CC0|CC BY(-SA)? [0-9.]+)/i.test(f.credito.licenca) && /^https:\/\/commons\.wikimedia\.org\//.test(f.credito.fonte)));
ok("silhuetas: licença CC traz o endereço da licença", creditos.filter((c) => /^CC BY/.test(c.licenca)).every((c) => /^https:\/\/creativecommons\.org\//.test(c.licencaUrl ?? "")));
ok("silhuetas: a de Marielle Franco traz o cuidado com a imagem", creditos.find((c) => c.id === "marielle")?.cuidado?.includes("Instituto Marielle Franco"));

// ═══════════════════ 4. O site ═══════════════════
ok("rota de API da ponte existe", fs.existsSync(path.join(raiz, "app/api/sessao/ponte/route.ts")));
ok("a federação continua fora do portão (o proxy não tranca /.well-known nem /api/fediverso)", !/alumia-entrada/.test(ler("proxy.ts")));
ok("o recurso alumia-entrada existe e só liga pelo nome", /"alumia-entrada":/.test(ler("lib/recursos.ts")));

// Os cabeçalhos finais do quadro da ponte (next.config.ts): fora da regra geral, sem X-Frame-Options, com a política própria.
{
  // O mesmo leitor de caminhos que o Next usa para casar as regras de cabeçalho.
  const leitor = await import("next/dist/compiled/path-to-regexp/index.js");
  const pathToRegexp = leitor.pathToRegexp ?? leitor.default.pathToRegexp;
  const regras = await (await import("../next.config.ts")).default.headers();
  const finais = (caminho) => {
    const r = {};
    for (const regra of regras) if (pathToRegexp(regra.source).test(caminho)) for (const c of regra.headers) r[c.key.toLowerCase()] = c.value;
    return r;
  };
  for (const caminho of ["/api/sessao/ponte", "/api/sessao/ponte/script"]) {
    const c = finais(caminho);
    ok(`cabeçalhos de ${caminho}: sem X-Frame-Options, COOP nem CORP (um subdomínio tem de poder embutir)`, !("x-frame-options" in c) && !("cross-origin-opener-policy" in c) && !("cross-origin-resource-policy" in c));
    ok(`cabeçalhos de ${caminho}: a política própria diz quem embute (só alumia. e escola.) e nada vai para o cache`, /frame-ancestors (https:\/\/alumia\.[a-z0-9.:-]+ https:\/\/escola\.[a-z0-9.:-]+|http:\/\/alumia\.localhost:\* http:\/\/escola\.localhost:\*)(;|$)/.test(c["content-security-policy"] ?? "") && /default-src 'none'/.test(c["content-security-policy"]) && /no-store/.test(c["cache-control"] ?? "") && c["x-content-type-options"] === "nosniff" && c["referrer-policy"] === "no-referrer");
  }
  const pagina = finais("/pt/alumia");
  ok("cabeçalhos: as outras páginas seguem com X-Frame-Options e frame-ancestors 'self'", pagina["x-frame-options"] === "SAMEORIGIN" && /frame-ancestors 'self'/.test(pagina["content-security-policy"] ?? ""));
  ok("cabeçalhos: uma rota de nome parecido não escapa da regra geral", finais("/api/sessao/ponte-falsa")["x-frame-options"] === "SAMEORIGIN");
}

// ═══════════════════ 5. O login único de ponta a ponta ═══════════════════
// A rota de verdade (app/api/sessao/ponte/route.ts) contra o banco e as contas de teste (scripts/backend-local.mjs, que imita o
// generate_link e o verify do serviço de contas): a sessão do site vira um código de uma vez, e o código vira uma sessão NOVA.
// Sem rede: tudo em 127.0.0.1, numa porta própria (para não bater num "npm run dev:local" aberto).
{
  process.env.PORTA_BANCO = process.env.PORTA_BANCO_TESTE_ENTRADA || "54417";
  const local = await import("./backend-local.mjs");
  const { servidor, banco: bancoDasContas } = await local.iniciar({ silencioso: true });
  process.env.NEXT_PUBLIC_SUPABASE_URL = local.URL_LOCAL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = local.CHAVE_ANON;
  process.env.SUPABASE_SERVICE_ROLE_KEY = local.CHAVE_SERVICO;
  const rota = await import("../app/api/sessao/ponte/route.ts");
  const SITE = "http://localhost:3107";
  const ALUMIA = "http://alumia.localhost:3107";
  const contas = async (caminho, corpo, token) =>
    (await fetch(`${local.URL_LOCAL}${caminho}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: local.CHAVE_ANON, Authorization: `Bearer ${token ?? local.CHAVE_ANON}` }, body: JSON.stringify(corpo) })).json();
  const entrar = (email) => contas("/auth/v1/token?grant_type=password", { email, password: "qualquer" });
  const carga = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  const pedir = async ({ token, origem = SITE, destino = ALUMIA, lugar = "same-origin" } = {}) => {
    const r = await rota.POST(new Request(`${SITE}/api/sessao/ponte`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(origem ? { Origin: origem } : {}), ...(lugar ? { "Sec-Fetch-Site": lugar } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ destino }),
    }));
    return { status: r.status, corpo: await r.json(), cache: r.headers.get("cache-control") };
  };
  try {
    const quadro = rota.GET();
    ok("login único: o quadro da ponte é só o script, sem cache", (await quadro.text()).includes('<script src="/api/sessao/ponte/script">') && /no-store/.test(quadro.headers.get("cache-control") ?? ""));

    const noSite = await entrar("leitora@local");
    ok("login único: a pessoa entra no site", typeof noSite.access_token === "string" && carga(noSite.access_token).aal === "aal1");
    ok("login único: sem sessão não há código", (await pedir()).status === 401);
    ok("login único: token inventado não vale", (await pedir({ token: `${noSite.access_token.slice(0, -6)}abcdef` })).status === 401);
    ok("login único: pedido de outro site é recusado", (await pedir({ token: noSite.access_token, lugar: "cross-site" })).status === 403);
    ok("login único: sem a origem do pedido é recusado", (await pedir({ token: noSite.access_token, origem: "" })).status === 403);
    ok("login único: destino que não é a Alumia nem a Escola é recusado", (await pedir({ token: noSite.access_token, destino: "http://estudio.localhost:3107" })).status === 403);
    ok("login único: destino em outra porta é recusado", (await pedir({ token: noSite.access_token, destino: "http://alumia.localhost:9999" })).status === 403);

    const codigo = await pedir({ token: noSite.access_token });
    ok("login único: a sessão do site vira um código de uma vez, sem cache", codigo.status === 200 && /^[a-f0-9]{20,128}$/.test(codigo.corpo.token_hash ?? "") && /no-store/.test(codigo.cache ?? ""));
    ok("login único: a resposta traz só o código (nada de token, e-mail ou id)", Object.keys(codigo.corpo).join() === "token_hash");
    const naAlumia = await contas("/auth/v1/verify", { type: "magiclink", token_hash: codigo.corpo.token_hash });
    ok("login único: o código vira uma sessão NOVA da mesma pessoa", typeof naAlumia.access_token === "string" && naAlumia.access_token !== noSite.access_token && carga(naAlumia.access_token).sub === carga(noSite.access_token).sub && carga(naAlumia.access_token).session_id !== carga(noSite.access_token).session_id);
    ok("login único: a sessão nova nasce sem o segundo fator (o código é pedido de novo no endereço novo)", carga(naAlumia.access_token).aal === "aal1");
    ok("login único: o código só vale uma vez", (await contas("/auth/v1/verify", { type: "magiclink", token_hash: codigo.corpo.token_hash })).access_token === undefined);
    const paraEscola = await pedir({ token: noSite.access_token, destino: "http://escola.localhost:3107" });
    ok("login único: a Escola também recebe o código", paraEscola.status === 200 && paraEscola.corpo.token_hash !== codigo.corpo.token_hash);

    // Quem tem o aplicativo autenticador só passa com a sessão confirmada pelo código (aal2).
    const comFator = await entrar("mediador@local");
    const fator = await contas("/auth/v1/factors", { factor_type: "totp", friendly_name: "teste" }, comFator.access_token);
    const confirmada = await contas(`/auth/v1/factors/${fator.id}/verify`, { code: "123456" }, comFator.access_token);
    ok("login único: com aplicativo autenticador, sessão sem o código não gera a ponte", (await pedir({ token: comFator.access_token })).corpo.erro === "segundo_fator");
    const comCodigo = await pedir({ token: confirmada.access_token });
    ok("login único: com o código confirmado (aal2), gera", comCodigo.status === 200 && /^[a-f0-9]{20,128}$/.test(comCodigo.corpo.token_hash ?? ""));
    const novaDoMediador = await contas("/auth/v1/verify", { type: "magiclink", token_hash: comCodigo.corpo.token_hash });
    ok("login único: no endereço novo o segundo fator é pedido de novo (a sessão nova não herda o aal2)", carga(novaDoMediador.access_token ?? "a.e30.c").aal === "aal1");

    // Token de acesso velho (roubado de um log, de uma extensão): não vira sessão nova. O quadro de verdade renova antes de pedir.
    {
      const agoraDeVerdade = Date.now;
      Date.now = () => agoraDeVerdade() + 11 * 60_000;
      let velho;
      try {
        velho = await pedir({ token: noSite.access_token });
      } finally {
        Date.now = agoraDeVerdade;
      }
      ok("login único: token de acesso emitido há mais de 10 minutos não gera código", velho.status === 401 && velho.corpo.erro === "sessao_antiga");
    }
    ok("login único: o quadro renova a sessão quando o token tem mais de 5 minutos", /emitido\(s\) \* 1000 > Date\.now\(\) - 300000/.test(ler("app/api/sessao/ponte/script/route.ts")));

    // O freio e o registro moram no banco (valem entre processos): conta que já gastou os 6 códigos em outro processo é freada
    // aqui, mesmo sem nenhum pedido na memória deste.
    {
      const outra = await entrar("vice@local");
      await bancoDasContas.dono("insert into interno.limites (chave, janela, total) select 'alumia_ponte:' || $1, to_timestamp((floor(extract(epoch from now()) / 600) + d) * 600), 6 from generate_series(0, 1) d on conflict (chave, janela) do update set total = 6", [carga(outra.access_token).sub]);
      ok("login único: o freio do banco vale mesmo com a memória do processo zerada", (await pedir({ token: outra.access_token })).status === 429);
      const registro = (await bancoDasContas.dono("select quem, alvo, detalhes from interno.auditoria where acao = 'ponte'")).rows;
      ok("login único: cada código gerado foi ao registro (a conta e o destino; nada de token)", registro.length === 3 && registro.every((r) => ["alumia", "escola"].includes(r.alvo) && JSON.stringify(r.detalhes) === "{}") && !JSON.stringify(registro).includes("eyJ"));
    }

    // O freio: no máximo 6 códigos por conta a cada 10 minutos (a leitora já pediu 2).
    const seguidos = [];
    for (let i = 0; i < 5; i++) seguidos.push((await pedir({ token: noSite.access_token })).status);
    ok("login único: o sétimo pedido da mesma conta em 10 minutos é freado", seguidos.join() === "200,200,200,200,429");
    ok("login único: o freio é por conta (outra conta segue passando)", (await pedir({ token: confirmada.access_token })).status === 200);
  } catch (erro) {
    falhas.push(`login único de ponta a ponta: ${erro.message}`);
  } finally {
    servidor.closeAllConnections?.();
    servidor.close();
  }
}

console.log(`testar:alumia-entrada — ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
