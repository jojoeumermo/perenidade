// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a entrada da Alumia (supabase/migracoes/20261110-alumia-entrada.sql) num Postgres de verdade (scripts/banco-local.mjs), com
// a migração rodada TRÊS vezes sobre o install.sql, e a lógica pura da ponte de sessão (lib/sessao/ponte.ts) e das silhuetas.
// Matriz: visitante, conta nova (em análise → recusada → pede de novo só depois de 30 dias), conta nova aprovada, quem já era
// membro antes da trava, militante da Escola, coordenação, mediação (com e sem o segundo fator) e a chave de serviço.
// Regras: trava desligada não muda nada; ligada, sem aprovação e sem aal2 ninguém lê a linha nem é membro; 'geral' continua
// aberta; a fila só para a triagem com aal2 e sem e-mail nem id de conta; ninguém decide o próprio pedido; aprovar na Alumia
// não dá a Escola; recusar pede motivo; o motivo do pedido some 30 dias depois da decisão.
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
await espera("o motivo do pedido some 30 dias depois da decisão", async () => {
  await dono("update interno.alumia_entrada set decidido_em = now() - interval '40 days' where usuario = $1", [P.nova2]);
  await rpc(como(P.mediador, "aal2"), "alumia_triagem_fila");
  return (await dono("select motivo_pedido from interno.alumia_entrada where usuario = $1", [P.nova2])).rows[0];
}, (r) => r.motivo_pedido === null);
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
await espera("desligar a trava devolve tudo como era", async () => {
  await dono("select interno.alumia_entrada_ligar(false)");
  return rpc(visitante(), "rede_linha", { p_aba: "c:geral" });
}, (r) => Array.isArray(r?.itens));

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
ok("silhuetas: a lista final da coordenação (8 figuras)", ["lenin", "marx", "engels", "stalin", "gramsci", "freire", "rosa", "marielle"].every((id) => figuras.some((f) => f.id === id)) && figuras.length === 8);
ok("silhuetas: pessoa viva sem autorização nunca entra", lista.filter((f) => f.viva && !f.autorizacao).every((f) => !figuras.some((x) => x.id === f.id)));
ok("silhuetas: toda figura tem arquivo e crédito com licença livre", figuras.every((f) => fs.existsSync(path.join(raiz, "public", f.src)) && /^(Public domain|CC0|CC BY(-SA)? [0-9.]+)/i.test(f.credito.licenca) && /^https:\/\/commons\.wikimedia\.org\//.test(f.credito.fonte)));
ok("silhuetas: licença CC traz o endereço da licença", creditos.filter((c) => /^CC BY/.test(c.licenca)).every((c) => /^https:\/\/creativecommons\.org\//.test(c.licencaUrl ?? "")));
ok("silhuetas: a de Marielle Franco traz o cuidado com a imagem", creditos.find((c) => c.id === "marielle")?.cuidado?.includes("Instituto Marielle Franco"));

// ═══════════════════ 4. O site ═══════════════════
ok("rota de API da ponte existe", fs.existsSync(path.join(raiz, "app/api/sessao/ponte/route.ts")));
ok("a federação continua fora do portão (o proxy não tranca /.well-known nem /api/fediverso)", !/alumia-entrada/.test(ler("proxy.ts")));
ok("o recurso alumia-entrada existe e só liga pelo nome", /"alumia-entrada":/.test(ler("lib/recursos.ts")));

console.log(`testar:alumia-entrada — ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
