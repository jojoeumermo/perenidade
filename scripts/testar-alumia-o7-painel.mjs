// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o painel de controle da Alumia (supabase/migracoes/20261113-alumia-o7-painel.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql, e a conta pura da impressão de rede
// (lib/rede/painel/impressao.ts).
// O centro é quem NÃO passa: visitante, conta comum, mediação e vice-coordenação não usam nenhuma função do painel; o admin não
// nomeia admin, não busca pelo nome e não mexe na coordenação; ninguém age sobre si; quem tem função na casa não perde o segundo
// fator nem a conta por aqui. Depois, cada fluxo: cadastros, pessoas e sanções com prazo, banir a rede sem guardar endereço,
// posts e a lixeira, stories, mídias, aviso fixado, denúncias, papéis, comunidades, organizações, interruptores, a trava da
// entrada com confirmação dupla e o registro que não se apaga.
// Uso: npm run testar:alumia-o7-painel
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { impressaoDaRede, redeDoEndereco, enderecoDoPedido } from "../lib/rede/painel/impressao.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
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

// ═══════════════════ 0. O arquivo e a conta pura ═══════════════════
const sql = ler("supabase/migracoes/20261113-alumia-o7-painel.sql");
ok("toda função nova é security definer com search_path fixo (menos as quatro puras, que não leem nada)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = /alumia_painel_(so_insercao|motivo|recurso_da_alumia|busca)\(/;
  return funcoes.length >= 50 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || puras.test(f));
})());
ok("nenhuma permissão direta em tabela para anon/authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("as nove tabelas nascem com RLS", (sql.match(/create table if not exists interno\.(alumia_[a-z_]+)/g) ?? []).length === 9 && /enable row level security/.test(sql));
ok("nenhuma tabela guarda endereço de rede (decisão de 13/11): só o resumo de 64 letras", (() => {
  const tabelas = sql.match(/create table if not exists interno\.alumia_[a-z_]+ \([\s\S]*?\n\);/g) ?? [];
  return tabelas.length === 9 && !tabelas.some((t) => /\b(inet|cidr|endereco|porta)\b/.test(t)) && /impressao text not null check \(impressao ~ '\^\[0-9a-f\]\{64\}\$'\)/.test(sql);
})());
ok("a migração apaga o registro de acesso e os endereços barrados de uma versão anterior", /drop table if exists interno\.alumia_registro_acesso cascade/.test(sql) && /drop table if exists interno\.alumia_impressao_banidas_endereco cascade/.test(sql)
  && /drop function if exists public\.alumia_acesso_registrar\(/.test(sql) && /drop function if exists public\.alumia_painel_acessos\(/.test(sql) && /drop function if exists public\.alumia_painel_rede_enderecos\(/.test(sql));
ok("não mexe no install.sql nem na versão da Alumia", !/create or replace function public\.rede_alumia_versao/.test(sql));

const SEGREDO = "segredo-de-teste-com-mais-de-32-letras-0123456789";
ok("rede do IPv4: o endereço inteiro", redeDoEndereco("203.0.113.7") === "203.0.113.7");
ok("rede do IPv6: só o prefixo /64", redeDoEndereco("2001:db8:aa:bb:1:2:3:4") === "2001:db8:aa:bb::/64" && redeDoEndereco("2001:db8:aa:bb:ffff::1") === "2001:db8:aa:bb::/64");
ok("IPv6 abreviado se expande antes do corte", redeDoEndereco("2001:db8::1") === "2001:db8:0:0::/64");
ok("IPv4 dentro de IPv6 vale como IPv4", redeDoEndereco("::ffff:203.0.113.7") === "203.0.113.7");
ok("lixo não vira rede", redeDoEndereco("não é endereço") === null && redeDoEndereco("999.1.1.1") === null && redeDoEndereco("") === null);
ok("a impressão é HMAC-SHA-256 em hexadecimal, igual para o mesmo /64 e diferente para outro", (() => {
  const a = impressaoDaRede("2001:db8:aa:bb:1:2:3:4", SEGREDO), b = impressaoDaRede("2001:db8:aa:bb:9:9:9:9", SEGREDO), c = impressaoDaRede("2001:db8:aa:cc::1", SEGREDO);
  return /^[0-9a-f]{64}$/.test(a ?? "") && a === b && a !== c;
})());
ok("outro segredo dá outra impressão; segredo curto ou ausente não dá impressão nenhuma", impressaoDaRede("203.0.113.7", SEGREDO) !== impressaoDaRede("203.0.113.7", SEGREDO + "x") && impressaoDaRede("203.0.113.7", "curto") === null && impressaoDaRede("203.0.113.7", undefined) === null);
ok("o endereço do pedido vem do cabeçalho da borda (cf-connecting-ip), na frente do x-forwarded-for", enderecoDoPedido(new Headers({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1, 10.0.0.1" }), true) === "203.0.113.9");
ok("em produção, sem o cabeçalho da borda não há endereço (o x-forwarded-for e o x-real-ip quem chama escolhe)", enderecoDoPedido(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1", "x-real-ip": "198.51.100.2" }), true) === null && enderecoDoPedido(new Headers(), true) === null);
ok("fora de produção (cópia local), o primeiro do x-forwarded-for vale", enderecoDoPedido(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }), false) === "198.51.100.1" && enderecoDoPedido(new Headers(), false) === null);
ok("a rota da impressão entrega ao banco só a impressão: sem endereço, sem porta, sem registro de acesso", (() => {
  const rota = ler("app/api/alumia/impressao/route.ts");
  return /rpc\/alumia_impressao_registrar/.test(rota) && !/p_endereco|p_porta|alumia_acesso_registrar|x-porta-de-origem/.test(rota) && /JSON\.stringify\(\{ p_usuario: conta, p_impressao: impressao, p_momento: momento, p_versao: versao, p_anterior: anterior \}\)/.test(rota);
})());
ok("a rota da mídia do painel pergunta ao banco (que confere e registra) antes de assinar", /rpc\/alumia_painel_midia_abrir/.test(ler("app/api/alumia/painel/midia/route.ts")));

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub, aal = "aal1") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const servico = { papel: "service_role", ip: "127.0.0.1" };
const imp = (n) => impressaoDaRede(`203.0.113.${n}`, SEGREDO);

const P = {};
for (const nome of ["coord", "vice", "mediador", "admin", "membro", "alvo", "socio", "inocente", "nova", "org", "apagavel"]) {
  P[nome] = await criarUsuario(`${nome}@painel.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set nome = $2 where id = $1", [P[nome], `Pessoa ${nome}`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'vice'), ($3, 'mediacao')", [P.coord, P.vice, P.mediador]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
// O install.sql inteiro de novo por cima: as definições finais (a R2 redefiniu funções desta migração) voltam a valer.
await espera("e o install.sql inteiro de novo por cima (as definições finais voltam)", () => banco.instalarDeNovo());
await banco.filiacaoDeTeste();
for (const nome of ["admin", "membro", "alvo", "socio", "inocente", "org", "apagavel", "mediador"]) {
  await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);
}
await dono("insert into interno.alumia_entrada (usuario, situacao, motivo_pedido) values ($1, 'em_analise', 'Quero me organizar com o núcleo do meu bairro.') on conflict (usuario) do update set situacao = 'em_analise', motivo_pedido = excluded.motivo_pedido, decidido_em = null", [P.nova]);

// ═══════════════════ 2. Quem NÃO passa ═══════════════════
const funcoesDoPainel = (await dono(`
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args,
    has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut,
    p.prosecdef as definer, array_to_string(p.proconfig, ',') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'alumia\\_painel\\_%' order by 1`)).rows;
ok("o painel tem as funções esperadas (40 ou mais)", funcoesDoPainel.length >= 40);
ok("no banco, toda função do painel é security definer com search_path fixo", funcoesDoPainel.every((f) => f.definer && /search_path=interno, pg_temp/.test(f.config ?? "")));
ok("visitante não tem permissão de executar nenhuma", funcoesDoPainel.every((f) => !f.anon && f.aut));
const valorDe = (tipo) => {
  if (tipo === "uuid") return "00000000-0000-4000-8000-00000000abcd";
  if (tipo === "integer") return 1;
  if (tipo === "boolean") return true;
  if (tipo === "jsonb") return { nome: "Nome de teste", slug: "teste-de-slug" };
  return "texto de teste com mais de dez letras";
};
const argumentosDe = (args) => Object.fromEntries(args.split(", ").filter(Boolean).map((a) => {
  const [nome, ...tipo] = a.split(" ");
  return [nome, valorDe(tipo.join(" "))];
}));
{
  const furos = [];
  const quem = [["conta comum", como(P.membro, "aal2")], ["mediação", como(P.mediador, "aal2")], ["vice-coordenação", como(P.vice, "aal2")]];
  for (const f of funcoesDoPainel) {
    for (const [rotulo, sessao] of quem) {
      try {
        const r = await rpc(sessao, f.nome, argumentosDe(f.args));
        if (!(f.nome === "alumia_painel_eu" && r?.pode === false && Object.keys(r).length === 1)) furos.push(`${f.nome} respondeu a ${rotulo}: ${JSON.stringify(r)?.slice(0, 120)}`);
      } catch (erro) {
        if (f.nome === "alumia_painel_eu" || !String(erro.message).includes("sem_permissao")) furos.push(`${f.nome} (${rotulo}): ${erro.message}`);
      }
    }
    try {
      await rpc(visitante, f.nome, argumentosDe(f.args));
      furos.push(`${f.nome} respondeu a visitante`);
    } catch (erro) {
      if (!String(erro.message).includes("permission denied")) furos.push(`${f.nome} (visitante): ${erro.message}`);
    }
  }
  ok(`conta comum, mediação, vice e visitante não passam em NENHUMA função do painel (${furos.length} furos${furos.length ? `: ${furos.slice(0, 6).join(" | ")}` : ""})`, furos.length === 0);
}
await recusa("conta comum não entrega impressão de rede (só a chave de serviço)", () => rpc(como(P.membro, "aal2"), "alumia_impressao_registrar", { p_usuario: P.membro, p_impressao: imp(1) }), "permission denied");
await recusa("visitante também não", () => rpc(visitante, "alumia_impressao_registrar", { p_usuario: P.membro, p_impressao: imp(1) }), "permission denied");
await recusa("nem a coordenação pela API", () => rpc(como(P.coord, "aal2"), "alumia_impressao_registrar", { p_usuario: P.membro, p_impressao: imp(1) }), "permission denied");
await espera("não existe função nem tabela de registro de acesso ou de endereço barrado, nem coluna de endereço", async () => (await dono(`select
    (select count(*)::int from pg_proc where proname in ('alumia_acesso_registrar', 'alumia_painel_acessos', 'alumia_painel_rede_enderecos', 'alumia_registro_acesso_guarda')) as funcoes,
    (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('alumia_registro_acesso', 'alumia_impressao_banidas_endereco')) as tabelas,
    (select count(*)::int from information_schema.columns where table_schema = 'interno' and table_name like 'alumia%' and data_type in ('inet', 'cidr')) as colunas`)).rows[0],
  (r) => r.funcoes === 0 && r.tabelas === 0 && r.colunas === 0);
await espera("a mediação continua moderando pelo papel que tem: lê a fila de denúncias da rede", () => rpc(como(P.mediador, "aal2"), "rede_mod_fila"), (r) => Array.isArray(r));
await espera("e faz a triagem dos cadastros", () => rpc(como(P.mediador, "aal2"), "alumia_triagem_fila"), (r) => Array.isArray(r?.pendentes));
await espera("a coordenação tem o painel", () => rpc(como(P.coord, "aal2"), "alumia_painel_eu"), (r) => r.pode === true && r.papel === "coordenacao");
const C = como(P.coord, "aal2");

// ═══════════════════ 3. Papéis: o admin ═══════════════════
const MOTIVO = "Motivo escrito para o teste do painel.";
await recusa("nomear pede motivo", () => rpc(C, "alumia_painel_admin_nomear", { p_id: P.admin, p_motivo: "curto" }), "invalido:motivo");
await recusa("a coordenação não se nomeia", () => rpc(C, "alumia_painel_admin_nomear", { p_id: P.coord, p_motivo: MOTIVO }), "voce_mesmo");
await recusa("conta sem aprovação não vira admin", () => rpc(C, "alumia_painel_admin_nomear", { p_id: P.nova, p_motivo: MOTIVO }), "conta_nao_aprovada");
await espera("a coordenação nomeia o admin", () => rpc(C, "alumia_painel_admin_nomear", { p_id: P.admin, p_motivo: MOTIVO }), (r) => r.ok === true);
await recusa("só um admin: o segundo é recusado", () => rpc(C, "alumia_painel_admin_nomear", { p_id: P.membro, p_motivo: MOTIVO }), "ja_tem_admin");
const A = como(P.admin, "aal2");
await espera("o admin tem o painel", () => rpc(A, "alumia_painel_eu"), (r) => r.pode === true && r.papel === "admin");
await espera("o admin lê a visão geral", () => rpc(A, "alumia_painel_geral"), (r) => r.papel === "admin" && r.numeros.fila === 1 && r.saude.admin === true && r.saude.mediadores === 1);
await recusa("o admin NÃO nomeia admin", () => rpc(A, "alumia_painel_admin_nomear", { p_id: P.membro, p_motivo: MOTIVO }), "sem_permissao");
await recusa("o admin NÃO destitui (nem a si mesmo)", () => rpc(A, "alumia_painel_admin_destituir", { p_motivo: MOTIVO }), "sem_permissao");
await recusa("o admin NÃO busca pelo nome da conta", () => rpc(A, "alumia_painel_pessoas", { p_busca: "Pessoa", p_pelo_nome: true }), "sem_permissao");
await recusa("o admin NÃO suspende a coordenação", () => rpc(A, "alumia_painel_sancionar", { p_id: P.coord, p_tipo: "suspensao", p_dias: 1, p_motivo: MOTIVO }), "coordenacao_protegida");
await recusa("o admin NÃO encerra as sessões da coordenação", () => rpc(A, "alumia_painel_sessoes_encerrar", { p_id: P.coord, p_motivo: MOTIVO }), "coordenacao_protegida");
await recusa("o admin NÃO tira o segundo fator da coordenação", () => rpc(A, "alumia_painel_fator_tirar", { p_id: P.coord, p_motivo: MOTIVO }), "coordenacao_protegida");
await recusa("o admin NÃO apaga a conta da coordenação", () => rpc(A, "alumia_painel_conta_apagar", { p_id: P.coord, p_motivo: MOTIVO, p_confirma: "Codinome coord" }), "coordenacao_protegida");
await recusa("o admin NÃO bane a rede da coordenação", () => rpc(A, "alumia_painel_rede_banir", { p_id: P.coord, p_dias: 1, p_motivo: MOTIVO, p_contas: 0 }), "coordenacao_protegida");
await recusa("o admin NÃO bane a mediação (sozinho, tiraria a mediação inteira do ar)", () => rpc(A, "alumia_painel_sancionar", { p_id: P.mediador, p_tipo: "banimento", p_dias: null, p_motivo: MOTIVO }), "tem_funcao");
await recusa("nem suspende a vice-coordenação por 365 dias", () => rpc(A, "alumia_painel_sancionar", { p_id: P.vice, p_tipo: "suspensao", p_dias: 365, p_motivo: MOTIVO }), "tem_funcao");
await recusa("nem encerra as sessões da mediação", () => rpc(A, "alumia_painel_sessoes_encerrar", { p_id: P.mediador, p_motivo: MOTIVO }), "tem_funcao");
await recusa("o admin não age sobre si", () => rpc(A, "alumia_painel_sancionar", { p_id: P.admin, p_tipo: "banimento", p_dias: null, p_motivo: MOTIVO }), "voce_mesmo");
await espera("os papéis: um admin, a coordenação e a mediação derivada do papel do Instituto", () => rpc(C, "alumia_painel_papeis"), (r) => r.admin?.id === P.admin && r.coordenacao.length === 1 && r.mediacao.length === 1 && r.mediacao[0].nome === "Pessoa mediador" && r.mediacao[0].na_alumia === true);
await espera("para o admin, os papéis vêm pelo codinome: nenhum nome civil da coordenação nem da mediação", () => rpc(A, "alumia_painel_papeis"),
  (r) => r.coordenacao.length === 1 && /^Codinome coord/.test(r.coordenacao[0]) && /^Codinome mediador/.test(r.mediacao[0].nome) && /^Codinome coord/.test(r.admin.por) && !/Pessoa /.test(JSON.stringify(r)));
await espera("admin com o aplicativo cadastrado e sessão sem o código não tem o painel", async () => {
  await exec("create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null default 'verified'); create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null); grant select on auth.mfa_factors, auth.sessions to anon, authenticated, service_role;");
  await dono("insert into auth.mfa_factors (user_id) values ($1)", [P.admin]);
  return rpc(como(P.admin, "aal1"), "alumia_painel_eu");
}, (r) => r.pode === false);

// ═══════════════════ 4. Cadastros ═══════════════════
const fila = await espera("a fila de cadastros: codinome e o que a pessoa escreveu, sem e-mail nem número da conta", () => rpc(A, "alumia_painel_cadastros", { p_situacao: "em_analise" }),
  (r) => r.itens.length === 1 && r.itens[0].codinome === "Codinome nova" && r.contagem.em_analise === 1 && !JSON.stringify(r).includes(P.nova) && !JSON.stringify(r).includes("@painel.local"));
const ficha = fila?.itens[0]?.id;
await recusa("recusar pede motivo", () => rpc(A, "alumia_painel_cadastro_decidir", { p_id: ficha, p_aprovar: false, p_motivo: "não" }), "invalido:motivo");
await espera("recusar com motivo", () => rpc(A, "alumia_painel_cadastro_decidir", { p_id: ficha, p_aprovar: false, p_motivo: "O pedido não diz de que luta a pessoa participa." }), (r) => r.situacao === "recusada");
await espera("a pessoa recebe o motivo", async () => (await dono("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [P.nova])).rows[0]?.texto, (t) => /não foi aceito/.test(t ?? "") && /de que luta/.test(t));
await espera("o histórico mostra a recusada e quem decidiu", () => rpc(C, "alumia_painel_cadastros", { p_situacao: "recusada" }), (r) => r.itens.length === 1 && r.itens[0].decidido_por === "Pessoa admin");
await espera("para o admin, quem decidiu aparece pelo codinome", () => rpc(A, "alumia_painel_cadastros", { p_situacao: "recusada" }), (r) => r.itens.length === 1 && /^Codinome admin/.test(r.itens[0].decidido_por));
await espera("reabrir devolve à fila", () => rpc(C, "alumia_painel_cadastro_reabrir", { p_id: ficha, p_motivo: MOTIVO }), (r) => r.situacao === "em_analise");
await recusa("reabrir o que já está na fila", () => rpc(C, "alumia_painel_cadastro_reabrir", { p_id: ficha, p_motivo: MOTIVO }), "ja_na_fila");
await espera("aprovar", () => rpc(C, "alumia_painel_cadastro_decidir", { p_id: ficha, p_aprovar: true }), (r) => r.situacao === "aprovada");
await recusa("não se tira por aqui a aprovação de quem tem função na casa", async () => {
  const id = (await dono("select id from interno.alumia_entrada where usuario = $1", [P.mediador])).rows[0].id;
  return rpc(A, "alumia_painel_cadastro_decidir", { p_id: id, p_aprovar: false, p_motivo: MOTIVO });
}, "tem_funcao");
await espera("busca na fila pelo codinome", () => rpc(C, "alumia_painel_cadastros", { p_situacao: "todas", p_busca: "nova" }), (r) => r.itens.length === 1);

// ═══════════════════ 5. Pessoas e sanções ═══════════════════
await recusa("busca curta demais", () => rpc(C, "alumia_painel_pessoas", { p_busca: "a" }), "invalido:busca");
await espera("busca pelo codinome: sem nome civil nem e-mail", () => rpc(A, "alumia_painel_pessoas", { p_busca: "alvo" }), (r) => r.length === 1 && r[0].id === P.alvo && !JSON.stringify(r).includes("Pessoa alvo") && !JSON.stringify(r).includes("painel.local"));
await espera("busca pelo @", () => rpc(A, "alumia_painel_pessoas", { p_busca: "@c_socio" }), (r) => r.length === 1 && r[0].id === P.socio);
await espera("o codinome não é achado pelo nome da conta", () => rpc(A, "alumia_painel_pessoas", { p_busca: "Pessoa alvo" }), (r) => r.length === 0);
await espera("a coordenação busca pelo nome, e isso fica no registro", async () => {
  const r = await rpc(C, "alumia_painel_pessoas", { p_busca: "Pessoa alvo", p_pelo_nome: true });
  const n = (await dono("select count(*)::int as n from interno.alumia_painel_registro where acao = 'busca_pelo_nome'")).rows[0].n;
  return { r, n };
}, ({ r, n }) => r.length === 1 && r[0].id === P.alvo && !JSON.stringify(r).includes("Pessoa alvo") && n === 1);
await espera("a ficha de moderação não traz e-mail, nome civil nem endereço", () => rpc(A, "alumia_painel_pessoa", { p_id: P.alvo }),
  (r) => r.codinome === "Codinome alvo" && r.entrada === "aprovada" && r.suspensa === false && r.fator === false && Array.isArray(r.sancoes) && !/Pessoa alvo|painel\.local|203\.0\.113/.test(JSON.stringify(r)));
await recusa("suspender pede prazo de 1 a 365 dias", () => rpc(A, "alumia_painel_sancionar", { p_id: P.alvo, p_tipo: "suspensao", p_dias: 0, p_motivo: MOTIVO }), "invalido:dias");
await recusa("suspender pede motivo", () => rpc(A, "alumia_painel_sancionar", { p_id: P.alvo, p_tipo: "suspensao", p_dias: 7, p_motivo: "" }), "invalido:motivo");
await dono("insert into auth.sessions (user_id) values ($1), ($1)", [P.alvo]);
const sancao = await espera("suspender por 7 dias", () => rpc(A, "alumia_painel_sancionar", { p_id: P.alvo, p_tipo: "suspensao", p_dias: 7, p_motivo: MOTIVO }), (r) => r.id && r.ate);
await espera("a conta fica suspensa, as sessões caem e a pessoa é avisada", async () => ({
  s: (await dono("select suspenso from interno.perfis where id = $1", [P.alvo])).rows[0].suspenso,
  n: (await dono("select count(*)::int as n from auth.sessions where user_id = $1", [P.alvo])).rows[0].n,
  a: (await dono("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [P.alvo])).rows[0]?.texto,
}), (r) => r.s === true && r.n === 0 && /suspensa na Alumia por 7 dia/.test(r.a ?? ""));
await recusa("suspensa, a conta não usa a rede", () => rpc(como(P.alvo, "aal2"), "rede_eu"), "conta_suspensa");
await espera("o prazo vence e a faxina devolve a conta", async () => {
  await dono("update interno.alumia_sancoes set ate = now() - interval '1 minute' where id = $1", [sancao.id]);
  await dono("select interno.alumia_painel_faxina()");
  return (await dono("select suspenso from interno.perfis where id = $1", [P.alvo])).rows[0].suspenso;
}, (s) => s === false);
const ban = await espera("banir a conta (sem prazo)", () => rpc(C, "alumia_painel_sancionar", { p_id: P.alvo, p_tipo: "banimento", p_dias: null, p_motivo: MOTIVO }), (r) => r.id && r.ate === null);
await recusa("desfazer pede motivo", () => rpc(C, "alumia_painel_sancao_desfazer", { p_sancao: ban.id, p_motivo: "" }), "invalido:motivo");
await recusa("o admin NÃO desfaz o banimento que a coordenação deu", () => rpc(A, "alumia_painel_sancao_desfazer", { p_sancao: ban.id, p_motivo: MOTIVO }), "sem_permissao");
await espera("a coordenação desfaz e a conta volta", () => rpc(C, "alumia_painel_sancao_desfazer", { p_sancao: ban.id, p_motivo: MOTIVO }), (r) => r.ok === true && r.suspensa === false);
await espera("o admin desfaz a sanção que ele mesmo deu", async () => {
  const s = await rpc(A, "alumia_painel_sancionar", { p_id: P.alvo, p_tipo: "suspensao", p_dias: 2, p_motivo: MOTIVO });
  return rpc(A, "alumia_painel_sancao_desfazer", { p_sancao: s.id, p_motivo: MOTIVO });
}, (r) => r.ok === true && r.suspensa === false);
await espera("desfazer a sanção do painel NÃO desfaz o banimento da mediação que já havia", async () => {
  await dono("update interno.perfis set suspenso = true, suspensao = 'mediacao' where id = $1", [P.socio]);
  await dono("insert into interno.banimentos (usuario, nome, motivo, por) values ($1, 'Pessoa socio', 'Banimento da mediação, anterior.', $2)", [P.socio, P.mediador]);
  const s = await rpc(C, "alumia_painel_sancionar", { p_id: P.socio, p_tipo: "suspensao", p_dias: 3, p_motivo: MOTIVO });
  const r = await rpc(C, "alumia_painel_sancao_desfazer", { p_sancao: s.id, p_motivo: MOTIVO });
  await dono("update interno.banimentos set ativo = false where usuario = $1", [P.socio]);
  await dono("update interno.perfis set suspenso = false, suspensao = '' where id = $1", [P.socio]);
  return r;
}, (r) => r.suspensa === true);
await espera("encerrar as sessões", async () => {
  await dono("insert into auth.sessions (user_id) values ($1)", [P.alvo]);
  await rpc(A, "alumia_painel_sessoes_encerrar", { p_id: P.alvo, p_motivo: MOTIVO });
  return (await dono("select count(*)::int as n from auth.sessions where user_id = $1", [P.alvo])).rows[0].n;
}, (n) => n === 0);
await espera("tirar o segundo fator para recadastro", async () => {
  await dono("insert into auth.mfa_factors (user_id) values ($1)", [P.alvo]);
  await rpc(A, "alumia_painel_fator_tirar", { p_id: P.alvo, p_motivo: MOTIVO });
  return (await dono("select count(*)::int as n from auth.mfa_factors where user_id = $1", [P.alvo])).rows[0].n;
}, (n) => n === 0);
await recusa("o segundo fator de quem tem função na casa não sai por aqui (regra de duas pessoas do painel da equipe)", () => rpc(C, "alumia_painel_fator_tirar", { p_id: P.mediador, p_motivo: MOTIVO }), "tem_funcao");
await recusa("nem o do admin", () => rpc(C, "alumia_painel_fator_tirar", { p_id: P.admin, p_motivo: MOTIVO }), "tem_funcao");
await recusa("apagar conta de quem tem função na casa: não", () => rpc(C, "alumia_painel_conta_apagar", { p_id: P.vice, p_motivo: MOTIVO, p_confirma: "Codinome vice" }), "tem_funcao");
await recusa("apagar conta pede o codinome escrito igual", () => rpc(C, "alumia_painel_conta_apagar", { p_id: P.apagavel, p_motivo: MOTIVO, p_confirma: "codinome apagavel" }), "confirmacao_errada");
await espera("apagar a conta: sai o perfil e a conta, fica a linha do registro", async () => {
  await rpc(C, "alumia_painel_conta_apagar", { p_id: P.apagavel, p_motivo: MOTIVO, p_confirma: "Codinome apagavel" });
  return {
    perfil: (await dono("select count(*)::int as n from interno.perfis where id = $1", [P.apagavel])).rows[0].n,
    conta: (await dono("select count(*)::int as n from auth.users where id = $1", [P.apagavel])).rows[0].n,
    registro: (await dono("select alvo, alvo_nome from interno.alumia_painel_registro where acao = 'conta_apagada'")).rows[0],
  };
}, (r) => r.perfil === 0 && r.conta === 0 && /Codinome apagavel/.test(r.registro?.alvo_nome ?? "") && r.registro.alvo === "");

// ═══════════════════ 6. Banir a rede sem guardar endereço ═══════════════════
await recusa("o resumo tem de ter 64 letras hexadecimais", () => rpc(servico, "alumia_impressao_registrar", { p_usuario: P.alvo, p_impressao: "203.0.113.5" }), "invalido:impressao");
await espera("o servidor registra a rede do alvo (duas redes), do sócio e da inocente (a mesma rede 5)", async () => {
  const r = [];
  r.push(await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.alvo, p_impressao: imp(5) }));
  r.push(await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.alvo, p_impressao: imp(6) }));
  r.push(await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.socio, p_impressao: imp(5) }));
  r.push(await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.inocente, p_impressao: imp(5) }));
  r.push(await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.mediador, p_impressao: imp(5) }));
  r.push(await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.membro, p_impressao: imp(9) }));
  return r;
}, (r) => r.every((x) => x.barrada === false));
await espera("no banco só há o resumo: nenhum endereço em coluna nenhuma", async () => (await dono("select impressao from interno.alumia_impressoes")).rows, (l) => l.length === 6 && l.every((x) => /^[0-9a-f]{64}$/.test(x.impressao)) && !JSON.stringify(l).includes("203.0.113"));
const previa = await espera("a prévia diz quantas contas seriam atingidas, sem contar quem é da casa, e não devolve resumo", () => rpc(A, "alumia_painel_rede_previa", { p_id: P.alvo }),
  (r) => r.redes === 2 && r.contas === 3 && !/[0-9a-f]{64}/.test(JSON.stringify(r)));
await recusa("banir a rede com o número errado de contas: confira de novo", () => rpc(A, "alumia_painel_rede_banir", { p_id: P.alvo, p_dias: 7, p_motivo: MOTIVO, p_contas: 1 }), "confira_de_novo");
await recusa("o prazo é de 1 a 90 dias", () => rpc(A, "alumia_painel_rede_banir", { p_id: P.alvo, p_dias: 120, p_motivo: MOTIVO, p_contas: previa.contas }), "invalido:dias");
await recusa("conta sem rede vista não tem o que banir", () => rpc(A, "alumia_painel_rede_banir", { p_id: P.org, p_dias: 7, p_motivo: MOTIVO, p_contas: 0 }), "sem_rede");
await recusa("a rede de quem tem função na casa não se bane", () => rpc(C, "alumia_painel_rede_banir", { p_id: P.mediador, p_dias: 7, p_motivo: MOTIVO, p_contas: 3 }), "tem_funcao");
const redeBan = await espera("banir a rede por 7 dias", () => rpc(A, "alumia_painel_rede_banir", { p_id: P.alvo, p_dias: 7, p_motivo: MOTIVO, p_contas: previa.contas }), (r) => r.contas === 3 && r.id);
await espera("as três contas da rede ficam suspensas; a mediação (da casa) e quem é de outra rede, não", async () => (await dono("select id, suspenso from interno.perfis where id = any($1::uuid[])", [[P.alvo, P.socio, P.inocente, P.mediador, P.membro]])).rows,
  (l) => l.every((x) => x.suspenso === [P.alvo, P.socio, P.inocente].includes(x.id)));
await espera("conta nova entrando da rede barrada: o servidor avisa e ela fica barrada", () => rpc(servico, "alumia_impressao_registrar", { p_usuario: P.nova, p_impressao: imp(6), p_momento: "pedido" }), (r) => r.barrada === true && r.ate);
await recusa("barrada, não usa a rede", () => rpc(como(P.nova, "aal2"), "rede_eu"), "conta_suspensa");
await espera("a inocente entra de outra rede e a barreira sai (a barreira é da rede, não da pessoa)", async () => {
  const r = await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.inocente, p_impressao: imp(40) });
  return { r, s: (await dono("select suspenso from interno.perfis where id = $1", [P.inocente])).rows[0].suspenso };
}, ({ r, s }) => r.barrada === false && s === false);
await espera("com banimento por rede em vigor, pedido de entrada sem rede vista há pouco é recusado (quem pula o servidor não pede)", async () => {
  const u = await criarUsuario("fura@painel.local", "Pessoa fura");
  await rpc(como(u), "eu");
  try {
    await rpc(como(u), "alumia_entrada_pedir", { p_codinome: "Codinome fura", p_motivo: "Quero me organizar com o núcleo do meu bairro.", p_maior: true, p_versao: 1, p_aceite: true });
    return "passou";
  } catch (erro) {
    const primeiro = erro.message;
    await rpc(servico, "alumia_impressao_registrar", { p_usuario: u, p_impressao: imp(77), p_momento: "pedido" });
    const depois = await rpc(como(u), "alumia_entrada_pedir", { p_codinome: "Codinome fura", p_motivo: "Quero me organizar com o núcleo do meu bairro.", p_maior: true, p_versao: 1, p_aceite: true });
    return `${primeiro}|${depois.situacao}`;
  }
}, (r) => r === "alumia_rede|em_analise");
await espera("a lista de redes barradas não mostra resumo nem endereço", () => rpc(C, "alumia_painel_redes"), (r) => r.length === 1 && r[0].ativo === true && r[0].contas === 3 && r[0].barradas_agora === 3 && !/[0-9a-f]{64}|203\.0\.113/.test(JSON.stringify(r)));
await espera("desfazer o banimento da rede devolve as contas", async () => {
  const r = await rpc(C, "alumia_painel_rede_desfazer", { p_id: redeBan.id, p_motivo: MOTIVO });
  return { r, l: (await dono("select suspenso from interno.perfis where id = any($1::uuid[])", [[P.alvo, P.socio, P.nova]])).rows };
}, ({ r, l }) => r.contas === 3 && l.every((x) => x.suspenso === false));
await espera("o admin NÃO libera a rede que a coordenação barrou; a coordenação libera", async () => {
  const p = await rpc(C, "alumia_painel_rede_previa", { p_id: P.alvo });
  const b = await rpc(C, "alumia_painel_rede_banir", { p_id: P.alvo, p_dias: 2, p_motivo: MOTIVO, p_contas: p.contas });
  let erro = "";
  try { await rpc(A, "alumia_painel_rede_desfazer", { p_id: b.id, p_motivo: MOTIVO }); } catch (e) { erro = e.message; }
  const r = await rpc(C, "alumia_painel_rede_desfazer", { p_id: b.id, p_motivo: MOTIVO });
  return { erro, r };
}, ({ erro, r }) => erro.includes("sem_permissao") && r.ok === true);
await espera("banimento por rede vencido se encerra sozinho na faxina, e o resumo vencido some", async () => {
  const p = await rpc(A, "alumia_painel_rede_previa", { p_id: P.alvo });
  const b = await rpc(A, "alumia_painel_rede_banir", { p_id: P.alvo, p_dias: 1, p_motivo: MOTIVO, p_contas: p.contas });
  await dono("update interno.alumia_impressao_banimentos set ate = now() - interval '1 minute', criado_em = now() - interval '2 days' where id = $1", [b.id]);
  await dono("update interno.alumia_impressoes set vence_em = now() - interval '1 minute' where usuario = $1", [P.socio]);
  await dono("select interno.alumia_painel_faxina()");
  return {
    s: (await dono("select bool_or(suspenso) as s from interno.perfis where id = any($1::uuid[])", [[P.alvo, P.socio]])).rows[0].s,
    ativo: (await dono("select count(*)::int as n from interno.alumia_impressao_banimentos where encerrado_em is null")).rows[0].n,
    resumos: (await dono("select count(*)::int as n from interno.alumia_impressoes where usuario = $1", [P.socio])).rows[0].n,
  };
}, (r) => r.s === false && r.ativo === 0 && r.resumos === 0);

// ═══════════════════ 6b. A versão antiga, com registro de acesso, some ao rodar de novo ═══════════════════
await espera("se uma versão antiga criou o registro de acesso (com o gatilho que não deixava apagar), rodar a migração apaga tudo", async () => {
  await exec(`create table interno.alumia_registro_acesso (id bigint generated always as identity primary key, usuario uuid not null, endereco inet not null, porta integer, criado_em timestamptz not null default now(), vence_em timestamptz not null default now() + interval '6 months');
    create table interno.alumia_impressao_banidas_endereco (banimento uuid not null, endereco inet not null, primary key (banimento, endereco));
    create or replace function interno.alumia_registro_acesso_guarda() returns trigger language plpgsql as $f$ begin raise exception 'O registro de acesso não se altera e só sai depois do prazo legal.'; end $f$;
    create trigger alumia_registro_acesso_guarda before update or delete on interno.alumia_registro_acesso for each row execute function interno.alumia_registro_acesso_guarda();
    create trigger alumia_registro_acesso_guarda_truncate before truncate on interno.alumia_registro_acesso for each statement execute function interno.alumia_painel_so_insercao();
    insert into interno.alumia_registro_acesso (usuario, endereco, porta) values (gen_random_uuid(), '198.51.100.77', 51234);
    create or replace function public.alumia_acesso_registrar(p_usuario uuid, p_endereco text, p_porta integer default null, p_impressao text default null, p_momento text default 'entrada') returns jsonb language sql as $f$ select '{}'::jsonb $f$;
    create or replace function public.alumia_painel_acessos(p jsonb default '{}'::jsonb) returns jsonb language sql as $f$ select '{}'::jsonb $f$;
    create or replace function public.alumia_painel_rede_enderecos(p_id uuid) returns jsonb language sql as $f$ select '{}'::jsonb $f$;`);
  let antes = "";
  try { await dono("delete from interno.alumia_registro_acesso"); } catch (e) { antes = e.message; }
  await exec(sql);
  // As definições finais de depois (a R2 redefiniu funções desta migração) voltam com o install.sql inteiro.
  await banco.instalarDeNovo();
  await banco.filiacaoDeTeste();
  return {
    antes,
    sobrou: (await dono("select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('alumia_registro_acesso', 'alumia_impressao_banidas_endereco')")).rows[0].n,
    funcoes: (await dono("select count(*)::int as n from pg_proc where proname in ('alumia_acesso_registrar', 'alumia_painel_acessos', 'alumia_painel_rede_enderecos', 'alumia_registro_acesso_guarda')")).rows[0].n,
  };
}, (r) => /não se altera/.test(r.antes) && r.sobrou === 0 && r.funcoes === 0);
await espera("a lista de redes barradas não traz endereço nem número de endereços", () => rpc(C, "alumia_painel_redes"), (r) => r.length >= 1 && r.every((x) => !("enderecos" in x)));

// ═══════════════════ 7. Posts, lixeira, stories, mídias, aviso fixado ═══════════════════
const post = async (autor, texto, extra = {}) => (await dono(
  "insert into interno.rede_posts (autor, texto, comunidade, resposta_a, nucleo, criado_em) values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now())) returning id",
  [autor, texto, extra.comunidade ?? null, extra.resposta_a ?? null, extra.nucleo ?? null, extra.criado_em ?? null])).rows[0].id;
const p1 = await post(P.alvo, "Post de teste sobre a assembleia do bairro");
const p2 = await post(P.socio, "Outro post, com a palavra SINDICATO");
const r1 = await post(P.membro, "Resposta ao primeiro post", { resposta_a: p1 });
const nucleo = (await dono("insert into interno.rede_nucleos (nome) values ('Núcleo de teste') returning id")).rows[0].id;
// Depois da R2 (membros escondidos) o banco não aceita post de núcleo: o mural do núcleo é mensagem do grupo, nos aparelhos.
await recusa("o banco não aceita post de núcleo (R2)", () => post(P.alvo, "Post de dentro de um núcleo fechado", { nucleo }), "rede_posts_sem_nucleo");
const pn = null;
const pv = await post(P.socio, "Post velho de outubro", { criado_em: "2026-10-01T12:00:00Z" });
await espera("a busca acha posts e respostas, e NÃO mostra post de núcleo", () => rpc(A, "alumia_painel_posts", { p: {} }), (r) => r.itens.length === 4 && !r.itens.some((x) => x.id === pn) && r.mais === false);
await espera("filtro por texto", () => rpc(A, "alumia_painel_posts", { p: { busca: "sindicato" } }), (r) => r.itens.length === 1 && r.itens[0].id === p2);
await espera("filtro por pessoa (@)", () => rpc(A, "alumia_painel_posts", { p: { pessoa: "@c_alvo" } }), (r) => r.itens.length === 1 && r.itens[0].id === p1);
await espera("filtro por tipo: só respostas", () => rpc(A, "alumia_painel_posts", { p: { tipo: "respostas" } }), (r) => r.itens.length === 1 && r.itens[0].id === r1 && r.itens[0].resposta === true);
await espera("filtro por data", () => rpc(A, "alumia_painel_posts", { p: { de: "2026-10-01", ate: "2026-10-02" } }), (r) => r.itens.length === 1 && r.itens[0].id === pv);
await recusa("data torta", () => rpc(A, "alumia_painel_posts", { p: { de: "ontem" } }), "invalido:data");
await recusa("ocultar pede motivo", () => rpc(A, "alumia_painel_post_agir", { p_id: p1, p_acao: "ocultar", p_motivo: "ruim" }), "invalido:motivo");
await espera("ocultar: some, o autor é avisado com o recurso e a decisão entra no registro de moderação", async () => {
  await rpc(A, "alumia_painel_post_agir", { p_id: p1, p_acao: "ocultar", p_motivo: MOTIVO });
  return {
    p: (await dono("select oculto, motivo from interno.rede_posts where id = $1", [p1])).rows[0],
    a: (await dono("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [P.alvo])).rows[0]?.texto,
    m: (await dono("select count(*)::int as n from interno.rede_moderacao where alvo = $1 and acao = 'remover'", [p1])).rows[0].n,
  };
}, (r) => r.p.oculto === true && /recorrer em até 30 dias/.test(r.a ?? "") && r.m === 1);
await espera("filtro: ocultos", () => rpc(A, "alumia_painel_posts", { p: { estado: "ocultos" } }), (r) => r.itens.length === 1 && r.itens[0].id === p1);
await espera("mostrar de novo", async () => { await rpc(A, "alumia_painel_post_agir", { p_id: p1, p_acao: "mostrar", p_motivo: MOTIVO }); return (await dono("select oculto from interno.rede_posts where id = $1", [p1])).rows[0].oculto; }, (o) => o === false);
await espera("apagar manda para a lixeira (some, mas o texto ainda existe por 30 dias)", async () => {
  await rpc(A, "alumia_painel_post_agir", { p_id: p2, p_acao: "apagar", p_motivo: MOTIVO });
  return { p: (await dono("select oculto, texto from interno.rede_posts where id = $1", [p2])).rows[0], l: await rpc(A, "alumia_painel_posts", { p: { estado: "lixeira" } }) };
}, (r) => r.p.oculto === true && /SINDICATO/.test(r.p.texto) && r.l.itens.length === 1 && r.l.itens[0].lixeira?.ate);
await recusa("o que está na lixeira não se oculta de novo", () => rpc(A, "alumia_painel_post_agir", { p_id: p2, p_acao: "ocultar", p_motivo: MOTIVO }), "na_lixeira");
await espera("restaurar dentro do prazo devolve o post como estava", async () => { await rpc(A, "alumia_painel_post_agir", { p_id: p2, p_acao: "restaurar", p_motivo: MOTIVO }); return (await dono("select oculto, texto from interno.rede_posts where id = $1", [p2])).rows[0]; }, (r) => r.oculto === false && /SINDICATO/.test(r.texto));
await espera("passado o prazo, a faxina apaga o conteúdo de vez e não há mais o que restaurar", async () => {
  await rpc(A, "alumia_painel_post_agir", { p_id: pv, p_acao: "apagar", p_motivo: MOTIVO });
  await dono("update interno.alumia_painel_lixeira set restaurar_ate = now() - interval '1 minute' where post = $1", [pv]);
  await dono("select interno.alumia_painel_faxina()");
  const p = (await dono("select texto, apagado_em is not null as apagado from interno.rede_posts where id = $1", [pv])).rows[0];
  let erro = "";
  try { await rpc(A, "alumia_painel_post_agir", { p_id: pv, p_acao: "restaurar", p_motivo: MOTIVO }); } catch (e) { erro = e.message; }
  return { p, erro };
}, (r) => r.p.apagado === true && !/outubro/.test(r.p.texto) && r.erro.includes("nao_encontrado"));

const story = async (autor, texto) => (await dono("insert into interno.rede_stories (autor, como, texto, conferido) values ($1, $1, $2, true) returning id", [autor, texto])).rows[0].id;
const s1 = await story(P.alvo, "Story de teste do ato de sexta");
const s2 = await story(P.socio, "Outro story");
await espera("os stories no ar", () => rpc(A, "alumia_painel_stories", { p: {} }), (r) => r.length === 2 && r.every((x) => x.midia === false));
await espera("reter um story", async () => { await rpc(A, "alumia_painel_story_agir", { p_id: s1, p_acao: "reter", p_motivo: MOTIVO }); return rpc(A, "alumia_painel_stories", { p: { retidos: true } }); }, (r) => r.length === 1 && r[0].id === s1);
await espera("liberar", async () => { await rpc(A, "alumia_painel_story_agir", { p_id: s1, p_acao: "liberar", p_motivo: MOTIVO }); return (await dono("select retido from interno.rede_stories where id = $1", [s1])).rows[0].retido; }, (x) => x === false);
await espera("apagar um story", async () => { await rpc(C, "alumia_painel_story_agir", { p_id: s2, p_acao: "apagar", p_motivo: MOTIVO }); return (await dono("select count(*)::int as n from interno.rede_stories where id = $1", [s2])).rows[0].n; }, (n) => n === 0);
{
  const caminho = `${P.alvo}/22222222-2222-4222-8222-222222222222.webp`;
  const sp = (await dono("insert into interno.rede_stories (autor, como, texto, conferido, publico, fundo, midia_caminho) values ($1, $1, 'Só para os próximos', true, 'proximos', 'imagem', $2) returning id", [P.alvo, caminho])).rows[0].id;
  await espera("story para os amigos próximos não entra na lista geral do painel", () => rpc(A, "alumia_painel_stories", { p: {} }), (r) => !r.some((x) => x.id === sp));
  await recusa("nem se mexe nele sem denúncia", () => rpc(A, "alumia_painel_story_agir", { p_id: sp, p_acao: "reter", p_motivo: MOTIVO }), "so_pela_denuncia");
  await recusa("nem se abre o arquivo dele", () => rpc(A, "alumia_painel_midia_abrir", { p_tipo: "story", p_caminho: caminho }), "nao_encontrado");
  await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ('story', $1, 'assedio', 2, 'Denúncia do story de teste.', $2)", [sp, P.membro]);
  await espera("com denúncia aberta, ele aparece no painel", () => rpc(A, "alumia_painel_stories", { p: {} }), (r) => r.some((x) => x.id === sp && x.publico === "proximos"));
  await espera("e o arquivo abre, com a abertura no registro do painel", async () => ({
    r: await rpc(A, "alumia_painel_midia_abrir", { p_tipo: "story", p_caminho: caminho }),
    n: (await dono("select count(*)::int as n from interno.alumia_painel_registro where acao = 'midia_aberta' and alvo = $1", [sp])).rows[0].n,
  }), ({ r, n }) => r.ok === true && n === 1);
  await dono("delete from interno.rede_denuncias where alvo_tipo = 'story' and alvo = $1", [sp]);
  await dono("delete from interno.rede_stories where id = $1", [sp]);
}

const midia = (await dono("insert into interno.rede_midia (post, caminho, tipo, largura, altura, alt) values ($1, $2, 'image/webp', 800, 600, 'Foto da assembleia') returning id", [p1, `${P.alvo}/11111111-1111-4111-8111-111111111111.webp`])).rows[0].id;
await espera("as mídias dos posts", () => rpc(A, "alumia_painel_midias", { p: {} }), (r) => r.itens.length === 1 && r.itens[0].alt === "Foto da assembleia");
await espera("abrir a imagem de um post para moderar fica no registro do painel", async () => ({
  r: await rpc(A, "alumia_painel_midia_abrir", { p_tipo: "post", p_caminho: `${P.alvo}/11111111-1111-4111-8111-111111111111.webp` }),
  n: (await dono("select count(*)::int as n from interno.alumia_painel_registro where acao = 'midia_aberta' and alvo = $1", [p1])).rows[0].n,
}), ({ r, n }) => r.ok === true && n === 1);
// (O post de núcleo e a imagem dele não existem mais no banco desde a R2.)
await recusa("nem um caminho que não é de post nenhum", () => rpc(A, "alumia_painel_midia_abrir", { p_tipo: "post", p_caminho: `${P.alvo}/44444444-4444-4444-8444-444444444444.webp` }), "nao_encontrado");
await espera("apagar uma imagem: o post fica", async () => {
  await rpc(A, "alumia_painel_midia_apagar", { p_id: midia, p_motivo: MOTIVO });
  return { m: (await dono("select count(*)::int as n from interno.rede_midia where id = $1", [midia])).rows[0].n, p: (await dono("select count(*)::int as n from interno.rede_posts where id = $1", [p1])).rows[0].n };
}, (r) => r.m === 0 && r.p === 1);

await recusa("aviso fixado: link de fora não entra", () => rpc(A, "alumia_painel_aviso_fixar", { p_texto: "Ato sexta, 18h, na praça.", p_link: "https://exemplo.org", p_dias: 3 }), "invalido:link");
await recusa("nem endereço que começa com duas barras", () => rpc(A, "alumia_painel_aviso_fixar", { p_texto: "Ato sexta, 18h, na praça.", p_link: "//exemplo.org", p_dias: 3 }), "invalido:link");
const aviso = await espera("fixar um aviso", () => rpc(A, "alumia_painel_aviso_fixar", { p_texto: "Ato sexta, 18h, na praça.", p_link: "/alumia/atos", p_dias: 3 }), (r) => r.id);
await espera("a Alumia lê o aviso (sem quem fixou)", () => rpc(como(P.membro), "alumia_avisos_fixados"), (r) => r.length === 1 && r[0].texto.startsWith("Ato sexta") && r[0].link === "/alumia/atos" && !("por" in r[0]));
await recusa("no máximo três avisos de cada vez", async () => { for (let i = 0; i < 3; i++) await rpc(A, "alumia_painel_aviso_fixar", { p_texto: `Aviso de número ${i}.`, p_link: "", p_dias: 1 }); }, "avisos_demais");
await espera("tirar o aviso", async () => { await rpc(A, "alumia_painel_aviso_tirar", { p_id: aviso.id }); return rpc(visitante, "alumia_avisos_fixados"); }, (r) => r.length === 2 && !r.some((x) => x.id === aviso.id));

// ═══════════════════ 8. Denúncias ═══════════════════
const denuncia = async (tipo, alvo, categoria = "assedio") => (await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ($1, $2, $3, 2, 'Texto da denúncia de teste.', $4) returning id, protocolo", [tipo, alvo, categoria, P.membro])).rows[0];
const d1 = await denuncia("post", p1);
const d2 = await denuncia("perfil", P.socio, "spam");
// (A denúncia de post de núcleo, com o quebra-vidro, saiu com os posts de núcleo na R2: o mural do núcleo é do grupo.)
await espera("a fila única, sem quem denunciou", () => rpc(A, "alumia_painel_denuncias"), (r) => r.length === 2 && !JSON.stringify(r).includes(P.membro) && !/Codinome membro|c_membro/.test(JSON.stringify(r)));
await espera("abrir a denúncia mostra o post e marca em análise", () => rpc(A, "alumia_painel_denuncia", { p_id: d1.id }), (r) => r.denuncia.situacao === "em_analise" && /assembleia/.test(r.alvo.texto) && !JSON.stringify(r).includes(P.membro));
await recusa("decidir pede regra e motivo", () => rpc(A, "alumia_painel_denuncia_decidir", { p_id: d1.id, p_decisao: "ocultar", p_regra: "", p_motivo: MOTIVO }), "invalido:regra");
await espera("ocultar pela denúncia: o post sai, a denúncia fecha e quem denunciou recebe a resposta", async () => {
  await rpc(A, "alumia_painel_denuncia_decidir", { p_id: d1.id, p_decisao: "ocultar", p_regra: "Assédio", p_motivo: MOTIVO, p_resposta: "Retiramos o post. Se voltar a acontecer, avise." });
  return {
    p: (await dono("select oculto from interno.rede_posts where id = $1", [p1])).rows[0].oculto,
    d: (await dono("select situacao from interno.rede_denuncias where id = $1", [d1.id])).rows[0].situacao,
    a: (await dono("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [P.membro])).rows[0]?.texto,
  };
}, (r) => r.p === true && r.d === "resolvida" && r.a?.includes(d1.protocolo) && /Resposta da coordenação: Retiramos o post/.test(r.a));
await recusa("denúncia já decidida não se decide de novo", () => rpc(A, "alumia_painel_denuncia_decidir", { p_id: d1.id, p_decisao: "descartar", p_regra: "Assédio", p_motivo: MOTIVO }), "ja_decidida");
await recusa("perfil não se 'oculta': é aviso, ou sanção na aba Pessoas", () => rpc(A, "alumia_painel_denuncia_decidir", { p_id: d2.id, p_decisao: "ocultar", p_regra: "Spam", p_motivo: MOTIVO }), "invalido:decisao");
await espera("descartar", () => rpc(C, "alumia_painel_denuncia_decidir", { p_id: d2.id, p_decisao: "descartar", p_regra: "Sem violação", p_motivo: MOTIVO }), (r) => r.situacao === "descartada");
await espera("as fechadas", () => rpc(C, "alumia_painel_denuncias", { p_situacao: "fechadas" }), (r) => r.length === 2);

// ═══════════════════ 9. Comunidades e organizações ═══════════════════
await recusa("slug torto", () => rpc(A, "alumia_painel_comunidade_criar", { p: { slug: "Com Espaço", nome: "Comunidade de teste" } }), "invalido:slug");
await espera("criar comunidade", () => rpc(A, "alumia_painel_comunidade_criar", { p: { slug: "moradia-zona-leste", nome: "Moradia Zona Leste", descricao: "Luta por moradia.", categoria: "lutas", tipo: "aberta" } }), (r) => r.slug === "moradia-zona-leste");
await recusa("slug repetido", () => rpc(A, "alumia_painel_comunidade_criar", { p: { slug: "moradia-zona-leste", nome: "Outra com o mesmo endereço" } }), "slug_em_uso");
await espera("pôr alguém na moderação", () => rpc(A, "alumia_painel_comunidade_moderacao", { p_slug: "moradia-zona-leste", p_id: P.membro, p_sim: true, p_motivo: MOTIVO }), (r) => r.ok);
await espera("a lista mostra a moderação pelo codinome", () => rpc(A, "alumia_painel_comunidades"), (r) => r.find((c) => c.slug === "moradia-zona-leste")?.moderacao[0]?.nome.startsWith("Codinome membro"));
await espera("trocar a moderação: tira uma, põe outra", async () => {
  await rpc(A, "alumia_painel_comunidade_moderacao", { p_slug: "moradia-zona-leste", p_id: P.membro, p_sim: false, p_motivo: MOTIVO });
  await rpc(A, "alumia_painel_comunidade_moderacao", { p_slug: "moradia-zona-leste", p_id: P.inocente, p_sim: true, p_motivo: MOTIVO });
  return (await rpc(A, "alumia_painel_comunidades")).find((c) => c.slug === "moradia-zona-leste").moderacao;
}, (m) => m.length === 1 && m[0].id === P.inocente);
const publicarComo = (quem, comunidade) => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: quem, aal: "aal2" })]);
  try { return (await banco.pg.query("insert into interno.rede_posts (autor, texto, comunidade) values ($1, 'Post na comunidade', $2) returning id", [quem, comunidade])).rows[0].id; }
  finally { await banco.pg.query("select set_config('request.jwt.claims', '', false)"); }
});
await espera("encerrar a comunidade", () => rpc(A, "alumia_painel_comunidade_fechar", { p_slug: "moradia-zona-leste", p_fechar: true, p_motivo: MOTIVO }), (r) => r.ok);
await recusa("em comunidade encerrada ninguém publica", () => publicarComo(P.membro, "moradia-zona-leste"), "comunidade_encerrada");
await recusa("encerrar duas vezes", () => rpc(A, "alumia_painel_comunidade_fechar", { p_slug: "moradia-zona-leste", p_fechar: true, p_motivo: MOTIVO }), "ja_encerrada");
await espera("reabrir, e publicar volta a valer", async () => { await rpc(A, "alumia_painel_comunidade_fechar", { p_slug: "moradia-zona-leste", p_fechar: false, p_motivo: MOTIVO }); return publicarComo(P.membro, "moradia-zona-leste"); }, (id) => Boolean(id));

await dono("insert into interno.rede_orgs (perfil, tipo, cidade) values ($1, 'sindicato', 'São Paulo')", [P.org]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono')", [P.org, P.membro]);
const pedido = (await dono("insert into interno.rede_org_pedidos (org, documento_tipo, documento, sobre) values ($1, 'CNPJ', '00.000.000/0001-00', 'Sindicato de teste.') returning id", [P.org])).rows[0].id;
await espera("as organizações, com o pedido de selo e sem quem cuida delas", () => rpc(A, "alumia_painel_orgs"), (r) => r.length === 1 && r[0].pedido?.id === pedido && r[0].selo === null && !JSON.stringify(r).includes(P.membro));
await recusa("recusar o selo pede motivo", () => rpc(A, "alumia_painel_org_pedido_decidir", { p_id: pedido, p_aceitar: false, p_motivo: "" }), "invalido:motivo");
await espera("dar o selo pelo pedido", async () => { await rpc(A, "alumia_painel_org_pedido_decidir", { p_id: pedido, p_aceitar: true }); return (await rpc(A, "alumia_painel_orgs"))[0]; }, (o) => o.selo !== null && o.documento_tipo === "CNPJ" && o.pedido === null);
await espera("tirar o selo, com aviso a quem cuida", async () => {
  await rpc(C, "alumia_painel_org_selo", { p_org: P.org, p_dar: false, p_motivo: MOTIVO });
  return { o: (await rpc(A, "alumia_painel_orgs"))[0], a: (await dono("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [P.membro])).rows[0]?.texto };
}, (r) => r.o.selo === null && /selo .* foi retirado/.test(r.a ?? ""));
await recusa("tirar o que não tem", () => rpc(C, "alumia_painel_org_selo", { p_org: P.org, p_dar: false, p_motivo: MOTIVO }), "nada_a_fazer");
await espera("dar o selo direto", () => rpc(C, "alumia_painel_org_selo", { p_org: P.org, p_dar: true, p_motivo: MOTIVO }), (r) => r.ok);

// ═══════════════════ 10. Interruptores e a trava ═══════════════════
await espera("as funções: só recursos da Alumia, e a trava desligada", () => rpc(A, "alumia_painel_funcoes"), (r) => r.recursos.length >= 8 && r.recursos.every((x) => /^(alumia-|rede-v2$|fediverso-)/.test(x.nome)) && r.trava.ligada === false);
await recusa("recurso que não é da Alumia não se mexe por aqui", () => rpc(C, "alumia_painel_recurso", { p_nome: "escola", p_ligar: true, p_motivo: MOTIVO }), "invalido:nome");
await recusa("o recurso da entrada só anda junto com a trava", () => rpc(C, "alumia_painel_recurso", { p_nome: "alumia-entrada", p_ligar: true, p_motivo: MOTIVO }), "use_a_trava");
await recusa("ligar pede motivo", () => rpc(C, "alumia_painel_recurso", { p_nome: "alumia-modo-ato", p_ligar: true, p_motivo: "" }), "invalido:motivo");
const pedidoDeRecurso = await espera("ligar um recurso que só liga pelo nome abre pedido de segunda pessoa e ainda não liga", async () => {
  const r = await rpc(A, "alumia_painel_recurso", { p_nome: "alumia-modo-ato", p_ligar: true, p_motivo: MOTIVO });
  return { r, lidos: await rpc(visitante, "recursos_lidos"), f: await rpc(A, "alumia_painel_funcoes") };
}, ({ r, lidos, f }) => r.aguardando === true && r.id && !lidos.ligados.includes("alumia-modo-ato") && f.recursos.find((x) => x.nome === "alumia-modo-ato")?.aguardando === true && f.recursos.find((x) => x.nome === "alumia-modo-ato")?.so_pelo_nome === true);
await recusa("o admin não confirma pedido (só a coordenação confirma)", () => rpc(A, "confirmacao_decidir", { p_id: pedidoDeRecurso?.r.id, p_aceitar: true }), "sem_permissao");
await espera("a coordenação confirma o pedido do admin e o recurso liga no que o site lê (recursos_lidos)", async () => { await rpc(C, "confirmacao_decidir", { p_id: pedidoDeRecurso?.r.id, p_aceitar: true }); return rpc(visitante, "recursos_lidos"); }, (r) => r.ligados.includes("alumia-modo-ato"));
await espera("e quem pede não confirma o próprio pedido", async () => {
  const r = await rpc(C, "alumia_painel_recurso", { p_nome: "alumia-proximas", p_ligar: true, p_motivo: MOTIVO });
  try { await rpc(C, "confirmacao_decidir", { p_id: r.id, p_aceitar: true }); return "passou"; } catch (erro) { return erro.message; }
}, (m) => /segunda_pessoa/.test(m));
await espera("desligar desliga", async () => { await rpc(A, "alumia_painel_recurso", { p_nome: "alumia-stories", p_ligar: false, p_motivo: MOTIVO }); return rpc(visitante, "recursos_lidos"); }, (r) => r.desligados.includes("alumia-stories"));
await recusa("\"voltar ao padrão\" de um recurso que só liga pelo nome e está desligado é recusado (seria ligar sem a segunda pessoa)", () => rpc(A, "alumia_painel_recurso", { p_nome: "alumia-stories", p_ligar: null, p_motivo: MOTIVO }), "use_ligar");
await recusa("nem a coordenação contorna assim", () => rpc(C, "alumia_painel_recurso", { p_nome: "alumia-stories", p_ligar: null, p_motivo: MOTIVO }), "use_ligar");
await espera("e o desligado continua desligado, sem pedido aberto", async () => ({ lidos: await rpc(visitante, "recursos_lidos"), n: (await dono("select count(*)::int as n from interno.confirmacoes where alvo = 'alumia-stories'")).rows[0].n }),
  ({ lidos, n }) => lidos.desligados.includes("alumia-stories") && n === 0);
await espera("voltar ao padrão do que está LIGADO apaga a decisão", async () => { await rpc(A, "alumia_painel_recurso", { p_nome: "alumia-modo-ato", p_ligar: null, p_motivo: MOTIVO }); return rpc(visitante, "recursos_lidos"); }, (r) => !r.desligados.includes("alumia-modo-ato") && !r.ligados.includes("alumia-modo-ato"));
await recusa("o admin NÃO liga o Fediverso inteiro", () => rpc(A, "alumia_painel_fediverso", { p_ligar: true, p_motivo: MOTIVO }), "sem_permissao");
await espera("a coordenação liga o Fediverso inteiro sozinha, sem segunda pessoa: os dois recursos juntos", async () => {
  const r = await rpc(C, "alumia_painel_fediverso", { p_ligar: true, p_motivo: MOTIVO });
  return { r, lidos: await rpc(visitante, "recursos_lidos") };
}, ({ r, lidos }) => r.ligado === true && lidos.ligados.includes("fediverso-total") && lidos.ligados.includes("fediverso-grupos"));
await espera("o admin desliga o Fediverso inteiro (emergência): os dois juntos, na hora", async () => {
  const r = await rpc(A, "alumia_painel_fediverso", { p_ligar: false, p_motivo: MOTIVO });
  return { r, lidos: await rpc(visitante, "recursos_lidos"), reg: (await dono("select count(*)::int as n from interno.alumia_painel_registro where acao in ('fediverso_ligado', 'fediverso_desligado')")).rows[0].n };
}, ({ r, lidos, reg }) => r.ligado === false && lidos.desligados.includes("fediverso-total") && lidos.desligados.includes("fediverso-grupos") && reg === 2);
const CINCO = [true, true, true, true, true];
const trava = (quem, extra) => rpc(quem, "alumia_painel_trava", { p_ligar: true, p_motivo: MOTIVO, p_frase: "LIGAR A TRAVA", p_conferencia: JSON.stringify(CINCO), ...extra });
await recusa("a trava pede a frase escrita", () => trava(C, { p_frase: "ligar" }), "confirmacao_errada");
await recusa("e a lista de conferência inteira", () => trava(C, { p_conferencia: JSON.stringify([true, true, false, true, true]) }), "conferencia_incompleta");
await recusa("lista com itens de menos também não", () => trava(C, { p_conferencia: JSON.stringify([true, true]) }), "conferencia_incompleta");
await recusa("sem o segundo fator nesta sessão ninguém liga a trava (ficaria do lado de fora)", () => trava(como(P.coord, "aal1")), "sem_permissao");
await recusa("busca com curinga não vira \"traga tudo\"", async () => { const r = await rpc(C, "alumia_painel_pessoas", { p_busca: "%%" }); if (r.length === 0) throw new Error("vazio"); return r; }, "vazio");
await espera("ligar a trava: a trava e o recurso da entrada no mesmo instante", async () => {
  const r = await trava(C);
  const lidos = await rpc(visitante, "recursos_lidos");
  return { r, lidos, exigida: (await dono("select interno.alumia_exigida() as e")).rows[0].e };
}, ({ r, lidos, exigida }) => r.exigir === true && exigida === true && lidos.ligados.includes("alumia-entrada") && Array.isArray(r.portas?.abertas) && r.portas.abertas.length === 0);
await espera("com a trava ligada, toda função do painel tem a porta da entrada", async () => (await dono("select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'alumia\\_painel\\_%' and p.prosrc !~ 'interno\\.alumia_porta\\(\\)'")).rows[0].n, (n) => n === 0);
await recusa("e a coordenação sem o segundo fator não passa da porta", () => rpc(como(P.coord, "aal1"), "alumia_painel_geral"), "alumia_entrada");
await recusa("conta comum aprovada, com o segundo fator, passa da porta e para na permissão", () => rpc(como(P.membro, "aal2"), "alumia_painel_geral"), "sem_permissao");
await recusa("ligar o que já está ligado", () => trava(C), "nada_a_fazer");
await recusa("desligar também pede a frase", () => rpc(C, "alumia_painel_trava", { p_ligar: false, p_motivo: MOTIVO, p_frase: "LIGAR A TRAVA" }), "confirmacao_errada");
await recusa("o admin NÃO desliga a trava (abriria a rede inteira sozinho)", () => rpc(A, "alumia_painel_trava", { p_ligar: false, p_motivo: MOTIVO, p_frase: "DESLIGAR A TRAVA" }), "sem_permissao");
await espera("e a trava continua ligada", async () => (await dono("select interno.alumia_exigida() as e")).rows[0].e, (e) => e === true);
await espera("desligar a trava", async () => {
  const r = await rpc(C, "alumia_painel_trava", { p_ligar: false, p_motivo: MOTIVO, p_frase: "DESLIGAR A TRAVA" });
  return { r, lidos: await rpc(visitante, "recursos_lidos") };
}, ({ r, lidos }) => r.exigir === false && lidos.desligados.includes("alumia-entrada"));

// ═══════════════════ 11. O registro e o fim do admin ═══════════════════
await espera("o registro tem quem, o quê, em quê, quando e por quê", () => rpc(C, "alumia_painel_registro", { p: {} }),
  (r) => r.itens.length >= 40 && r.itens.every((x) => x.quem && x.papel && x.acao && x.quando) && r.acoes.includes("conta_suspensa") && r.acoes.includes("trava_ligada") && r.acoes.includes("rede_banida") && r.acoes.includes("post_apagar"));
await espera("filtro por ação", () => rpc(C, "alumia_painel_registro", { p: { acao: "trava_ligada" } }), (r) => r.itens.length === 1 && r.itens[0].motivo === MOTIVO && r.itens[0].papel === "coordenacao");
await espera("busca no registro", () => rpc(C, "alumia_painel_registro", { p: { busca: "Codinome alvo" } }), (r) => r.itens.length >= 5);
await espera("exportar devolve tudo e a própria exportação fica registrada", async () => {
  const r = await rpc(A, "alumia_painel_registro", { p: { tudo: true } });
  return { n: r.itens.length, e: (await dono("select count(*)::int as n from interno.alumia_painel_registro where acao = 'registro_exportado'")).rows[0].n };
}, (r) => r.n >= 40 && r.e === 1);
await recusa("o registro não se altera", () => dono("update interno.alumia_painel_registro set motivo = 'outro'"), "não se altera nem se apaga");
await recusa("nem se apaga", () => dono("delete from interno.alumia_painel_registro"), "não se altera nem se apaga");
await recusa("nem se esvazia", () => dono("truncate interno.alumia_painel_registro"), "não se altera nem se apaga");
await espera("o registro nunca guarda endereço nem resumo de rede", async () => (await dono("select string_agg(detalhes::text || alvo || alvo_nome || motivo, ' ') as t from interno.alumia_painel_registro")).rows[0].t, (t) => !/203\.0\.113|198\.51\.100\.|192\.0\.2\.|[0-9a-f]{64}/.test(t));
await espera("quem está com o nome público: o registro (que não se apaga) guarda o codinome guardado e o @, nunca o nome de verdade", async () => {
  await dono("update interno.perfis set rede_identidade = 'publica', rede_codinome_reserva = rede_codinome, rede_codinome = 'Maria Teste' where id = $1", [P.membro]);
  await rpc(C, "alumia_painel_sessoes_encerrar", { p_id: P.membro, p_motivo: MOTIVO });
  const l = (await dono("select alvo_nome from interno.alumia_painel_registro where acao = 'sessoes_encerradas' and alvo = $1 order by id desc limit 1", [P.membro])).rows[0];
  const tela = await rpc(C, "alumia_painel_pessoa", { p_id: P.membro });
  await dono("update interno.perfis set rede_identidade = 'codinome', rede_codinome = rede_codinome_reserva, rede_codinome_reserva = null where id = $1", [P.membro]);
  return { l, tela };
}, ({ l, tela }) => l.alvo_nome === "Codinome membro (@c_membro)" && tela.codinome === "Maria Teste");
await espera("quem agiu também fica gravado pelo codinome, nunca pelo nome da conta", async () => (await dono("select string_agg(distinct quem_nome, '|') as q from interno.alumia_painel_registro")).rows[0].q,
  (q) => !/Pessoa /.test(q) && /Codinome coord/.test(q) && /Codinome admin/.test(q));
await recusa("a vice não destitui o admin", () => rpc(como(P.vice, "aal2"), "alumia_painel_admin_destituir", { p_motivo: MOTIVO }), "sem_permissao");
await espera("a coordenação destitui o admin", () => rpc(C, "alumia_painel_admin_destituir", { p_motivo: MOTIVO }), (r) => r.ok);
await espera("destituído, perde o painel na hora", () => rpc(A, "alumia_painel_eu"), (r) => r.pode === false);
await recusa("e não lê mais nada", () => rpc(A, "alumia_painel_registro", { p: {} }), "sem_permissao");
await espera("coordenação suspensa não usa o painel", async () => {
  await dono("update interno.perfis set suspenso = true where id = $1", [P.coord]);
  try { return await rpc(C, "alumia_painel_eu"); } finally { await dono("update interno.perfis set suspenso = false where id = $1", [P.coord]); }
}, (r) => r.pode === false);

console.log(`testar:alumia-o7-painel — ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
