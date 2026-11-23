// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o painel único de admin da Alumia (supabase/migracoes/20261122-alumia-admin.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada DUAS vezes (e uma terceira) sobre o install.sql, e as rotas do servidor
// (app/api/alumia/admin/*) com um banco de ponte e uma Cloudflare de mentira, sem rede.
// O centro é quem NÃO passa: conta comum, mediação, vice-coordenação, o admin da Alumia e a coordenação sem o segundo fator são
// recusados em tudo. Depois: cada ação vai para o registro; banir cascateia (convites, convidados de volta à triagem, e-mail só
// em resumo, sessões); a porta fecha com um clique; nenhuma tabela nova tem coluna de endereço de rede; o bloqueio na borda
// guarda só o número da regra e o prazo.
// Uso: npm run testar:alumia-admin
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

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

// ═══════════════════ 0. Os arquivos ═══════════════════
const sql = ler("supabase/migracoes/20261122-alumia-admin.sql");
ok("a migração termina trancando as funções na porta da Alumia", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia", !/function public\.rede_alumia_versao/.test(sql));
ok("toda função nova é security definer com search_path fixo (menos as três puras, que não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?(\$\$|\$function\$)/g) ?? [];
  const puras = /alumia_admin_(conta|direto)\(|alumia_painel_motivo\(/;
  return funcoes.length >= 24 && funcoes.every((f) => /security definer set search_path = interno, pg_temp|SECURITY DEFINER\s+SET search_path TO 'interno', 'pg_temp'/.test(f) || puras.test(f));
})());
ok("nenhum parâmetro do tipo linha de tabela", !/\(\s*[a-z_]+ interno\.[a-z_]+[,)]/.test(sql.replace(/returns interno\.[a-z_]+/g, "")));
ok("nenhuma permissão direta em tabela para anon ou authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("as três tabelas novas nascem com RLS e sem coluna de endereço de rede", (() => {
  const tabelas = sql.match(/create table if not exists interno\.alumia_admin_[a-z_]+ \([\s\S]*?\n\);/g) ?? [];
  return tabelas.length === 3 && !tabelas.some((t) => /\b(inet|cidr|ip|ipv4|ipv6|endereco|porta|email)\b/i.test(t.replace(/--.*$/gm, ""))) && /enable row level security/.test(sql);
})());
ok("a rota da borda nunca escreve em log nem devolve o endereço", (() => {
  const rota = ler("app/api/alumia/admin/borda/route.ts");
  return !/console\./.test(rota) && !/resposta\(\{[^}]*\bip\b/.test(rota) && !/p_ip|p_endereco/.test(rota);
})());
ok("a chave da Cloudflare só vem do ambiente do servidor (nada de NEXT_PUBLIC)", (() => {
  const lib = ler("lib/rede/admin/cloudflare.ts");
  return /ambiente\.ALUMIA_CF_TOKEN/.test(lib) && /ambiente\.ALUMIA_CF_ZONA/.test(lib) && !/NEXT_PUBLIC_[A-Z_]*CF/.test(lib);
})());
ok("as telas do painel único não chamam a Cloudflare do navegador", (() => {
  const pasta = path.join(raiz, "components/painel/alumia/admin");
  if (!fs.existsSync(pasta)) return false;
  return fs.readdirSync(pasta).every((a) => !/api\.cloudflare\.com|process\.env\.ALUMIA_CF/.test(fs.readFileSync(path.join(pasta, a), "utf8")));
})());

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const servico = { papel: "service_role", ip: "127.0.0.1" };

const P = {};
for (const nome of ["coord", "coord2", "vice", "mediador", "admin", "membro", "alvo", "conv1", "conv2", "conv3", "espera", "outra", "nova"]) {
  P[nome] = await criarUsuario(`${nome}@admin.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'coordenacao'), ($3, 'vice'), ($4, 'mediacao')", [P.coord, P.coord2, P.vice, P.mediador]);
await dono("insert into interno.alumia_painel_admin (usuario) values ($1) on conflict do nothing", [P.admin]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set nome = $2, rede_codinome = $3, rede_codinome_ok = true, rede_handle = $4, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${nome}`, `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}

const antes = await um("select pg_get_functiondef('public.alumia_cadastro_passar(text,text,text,timestamptz,text,uuid,text)'::regprocedure) as d");
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("nenhuma função da rede ficou sem a porta", () => um("select interno.alumia_trancar() as r"), (x) => Array.isArray(x.r.abertas) && x.r.abertas.length === 0);
const depois = await um("select pg_get_functiondef('public.alumia_cadastro_passar(text,text,text,timestamptz,text,uuid,text)'::regprocedure) as d");
ok("a porta do servidor foi redefinida inteira (a parte de antes continua, com a porta fechada e o laço)", (() => {
  const trechos = ["insert into alumia_cadastro_gastos", "rede_barrada", "alumia_cadastro_freio", "porta_cheia", "alumia_cadastro_passes", "alumia_convite_pedidos", "criado_por <> p_usuario"];
  return trechos.every((t) => antes.d.includes(t) && depois.d.includes(t)) && /porta_fechada/.test(depois.d) && /alumia_admin_convite_lacos/.test(depois.d);
})());
await espera("a porta do servidor continua só da chave de serviço", () => um("select has_function_privilege('authenticated', 'public.alumia_cadastro_passar(text,text,text,timestamptz,text,uuid,text)', 'execute') a, has_function_privilege('anon', 'public.alumia_cadastro_passar(text,text,text,timestamptz,text,uuid,text)', 'execute') b, has_function_privilege('service_role', 'public.alumia_cadastro_passar(text,text,text,timestamptz,text,uuid,text)', 'execute') c"),
  (x) => !x.a && !x.b && x.c);
await espera("nenhuma função escreve 'Rede Lúcia'", () => um("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','interno') and p.proname like 'alumia_admin%' and p.prosrc like '%Rede Lúcia%'"), (x) => x.n === 0);

// ═══════════════════ 2. Nenhuma tabela nova tem endereço de rede ═══════════════════
await espera("as colunas das tabelas novas: nenhuma de endereço, nenhuma do tipo inet ou cidr", () => dono(`
  select table_name, column_name, data_type from information_schema.columns
  where table_schema = 'interno' and table_name like 'alumia\\_admin\\_%'`), (r) => {
  const cols = r.rows;
  return cols.length >= 10 && !cols.some((c) => /inet|cidr/.test(c.data_type) || /(^|_)(ip|ipv4|ipv6|endereco|rede|email)($|_)/.test(c.column_name));
});
await espera("as três tabelas estão com RLS e sem política", () => um(`
  select count(*) filter (where c.relrowsecurity)::int com_rls, (select count(*)::int from pg_policies where schemaname = 'interno' and tablename like 'alumia\\_admin\\_%') politicas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname like 'alumia\\_admin\\_%' and c.relkind = 'r'`), (x) => x.com_rls === 3 && x.politicas === 0);

// ═══════════════════ 3. Quem NÃO passa ═══════════════════
const funcoes = (await dono(`
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args,
    has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut,
    has_function_privilege('service_role', p.oid, 'execute') as serv, p.prosecdef as definer, array_to_string(p.proconfig, ',') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'alumia\\_admin\\_%' order by 1`)).rows;
const daRotina = ["alumia_admin_email_de", "alumia_admin_email_barrado", "alumia_admin_borda_vencidas", "alumia_admin_borda_apagada"];
// 16 do painel único e 6 do P5 (20261126-p5-beta.sql: zerar o beta em dois passos, relatos e erros da tela; 20261126-p5-federacao.sql).
const DO_P5 = ["alumia_admin_zerar_previa", "alumia_admin_zerar_confirmar", "alumia_admin_relatos", "alumia_admin_relato_mudar", "alumia_admin_erros_tela", "alumia_admin_federacao"];
ok("o painel único tem as funções esperadas (16, mais as 6 do P5)", funcoes.length === 22 && DO_P5.every((n) => funcoes.some((f) => f.nome === n)));
ok("todas security definer com search_path fixo", funcoes.every((f) => f.definer && /search_path=interno, pg_temp/.test(f.config ?? "")));
ok("visitante não executa nenhuma", funcoes.every((f) => !f.anon));
ok("as da rotina e do e-mail só a chave de serviço executa", funcoes.filter((f) => daRotina.includes(f.nome)).every((f) => !f.aut && f.serv) && funcoes.filter((f) => daRotina.includes(f.nome)).length === 4);
const valorDe = (tipo) => (tipo === "uuid" ? "00000000-0000-4000-8000-00000000abcd" : tipo === "integer" ? 24 : tipo === "boolean" ? true : "texto de teste com mais de dez letras");
const argumentosDe = (args) => Object.fromEntries(args.split(", ").filter(Boolean).map((a) => {
  const [nome, ...tipo] = a.split(" ");
  return [nome, valorDe(tipo.join(" "))];
}));
{
  const furos = [];
  const quem = [["conta comum", como(P.membro)], ["mediação", como(P.mediador)], ["vice-coordenação", como(P.vice)], ["admin da Alumia", como(P.admin)], ["coordenação sem o segundo fator", como(P.coord, "aal1")]];
  for (const f of funcoes.filter((x) => x.aut && x.nome !== "alumia_admin_eu")) {
    for (const [rotulo, sessao] of quem) {
      try {
        const r = await rpc(sessao, f.nome, argumentosDe(f.args));
        furos.push(`${rotulo} passou em ${f.nome}: ${JSON.stringify(r)?.slice(0, 80)}`);
      } catch (erro) {
        if (!/sem_permissao|confirme_segundo_fator/.test(String(erro.message))) furos.push(`${rotulo} em ${f.nome}: erro inesperado "${erro.message}"`);
      }
    }
  }
  for (const f of funcoes.filter((x) => daRotina.includes(x.nome))) {
    try {
      await rpc(como(P.coord), f.nome, argumentosDe(f.args));
      furos.push(`coordenação passou na função da rotina ${f.nome}`);
    } catch (erro) {
      if (!/permission denied|sem_permissao/.test(String(erro.message))) furos.push(`${f.nome}: erro inesperado "${erro.message}"`);
    }
  }
  ok(`ninguém além da coordenação com o segundo fator usa o painel único${furos.length ? ` (${furos.slice(0, 4).join(" | ")})` : ""}`, furos.length === 0);
}
await espera("alumia_admin_eu: conta comum recebe só {pode: false}", () => rpc(como(P.membro), "alumia_admin_eu"), (r) => r.pode === false && Object.keys(r).length === 1);
await espera("alumia_admin_eu: o admin da Alumia também não tem o painel único", () => rpc(como(P.admin), "alumia_admin_eu"), (r) => r.pode === false);
await espera("alumia_admin_eu: a coordenação sem o código recebe o aviso do segundo fator", () => rpc(como(P.coord, "aal1"), "alumia_admin_eu"), (r) => r.pode === false && r.falta_segundo_fator === true);
await espera("alumia_admin_eu: a coordenação com o código pode", () => rpc(como(P.coord), "alumia_admin_eu"), (r) => r.pode === true);
await dono("update interno.perfis set suspenso = true where id = $1", [P.coord2]);
await recusa("coordenação suspensa perde o painel na hora", () => rpc(como(P.coord2), "alumia_admin_estado"), "sem_permissao");
await dono("update interno.perfis set suspenso = false where id = $1", [P.coord2]);

// ═══════════════════ 4. O estado do beta e os recursos ═══════════════════
const C = como(P.coord);
const registro = async (acao) => (await dono("select * from interno.alumia_painel_registro where acao = $1 order by id desc limit 1", [acao])).rows[0];
const estado = await espera("o estado do beta fechado", () => rpc(C, "alumia_admin_estado"), (e) => e.trava && e.porta && Array.isArray(e.recursos) && e.recursos.length >= 30 && "fila" in e);
ok("o estado mostra pessoas só a partir de 3: fila e aprovadas vêm como {n, algum}", ["fila", "aprovadas"].every((k) => estado && typeof estado[k] === "object" && "algum" in estado[k] && (estado[k].n === null || estado[k].n >= 3)));
ok("o estado lista TODOS os recursos do catálogo (os do site também)", ["vlibras", "escola", "alumia-aberta", "alumia-entrada", "fediverso-grupos"].every((n) => estado?.recursos.some((r) => r.nome === n)));
ok("os do lançamento valem direto; os outros que só ligam pelo nome pedem a segunda pessoa", (() => {
  const r = Object.fromEntries((estado?.recursos ?? []).map((x) => [x.nome, x]));
  return r["alumia-aberta"].direto && r["fediverso-grupos"].direto && r["alumia-convites"].direto && !r["alumia-mapa"].direto && r["vlibras"].direto;
})());

await recusa("a entrada com triagem liga pela trava, não por aqui", () => rpc(C, "alumia_admin_recurso", { p_nome: "alumia-entrada", p_ligar: true, p_motivo: "Abrir o beta fechado hoje.", p_frase: null }), "use_a_trava");
await recusa("motivo curto não passa", () => rpc(C, "alumia_admin_recurso", { p_nome: "vlibras", p_ligar: false, p_motivo: "curto", p_frase: null }), "invalido:motivo");
await recusa("nome que não existe não passa", () => rpc(C, "alumia_admin_recurso", { p_nome: "nao-existe", p_ligar: false, p_motivo: "Teste do painel único.", p_frase: null }), "invalido:nome");
await espera("desligar um recurso do site (vlibras)", () => rpc(C, "alumia_admin_recurso", { p_nome: "vlibras", p_ligar: false, p_motivo: "Teste do painel único.", p_frase: null }), (r) => r.ok && r.decisao === false);
await espera("... fica em recursos_vivos e no registro, com quem e o motivo", async () => ({ v: await um("select ligado from interno.recursos_vivos where nome = 'vlibras'"), r: await registro("recurso_desligado") }),
  (x) => x.v.ligado === false && x.r.quem === P.coord && x.r.papel === "coordenacao" && x.r.alvo === "vlibras" && x.r.motivo === "Teste do painel único.");
await espera("ligar fediverso-grupos vale direto (sem segunda pessoa)", () => rpc(C, "alumia_admin_recurso", { p_nome: "fediverso-grupos", p_ligar: true, p_motivo: "Fediverso em tudo no lançamento.", p_frase: null }), (r) => r.ok && r.decisao === true && !r.aguardando);
await espera("ligar alumia-convites vale direto", () => rpc(C, "alumia_admin_recurso", { p_nome: "alumia-convites", p_ligar: true, p_motivo: "Convites no beta fechado.", p_frase: null }), (r) => r.decisao === true);
await espera("ligar alumia-mapa abre o pedido para a segunda pessoa", () => rpc(C, "alumia_admin_recurso", { p_nome: "alumia-mapa", p_ligar: true, p_motivo: "Mapa por cidade para o beta.", p_frase: null }), (r) => r.aguardando === true);
await espera("... e o pedido fica no registro", () => registro("recurso_pedido"), (r) => r && r.alvo === "alumia-mapa");
await espera("desligar alumia-aberta", () => rpc(C, "alumia_admin_recurso", { p_nome: "alumia-aberta", p_ligar: false, p_motivo: "Em construção até o SQL.", p_frase: null }), (r) => r.decisao === false);
await recusa("voltar ao padrão um recurso que só liga pelo nome e está desligado não passa", () => rpc(C, "alumia_admin_recurso", { p_nome: "alumia-aberta", p_ligar: null, p_motivo: "Voltar ao padrão do código.", p_frase: null }), "use_ligar");
await recusa("abrir a Alumia com a trava desligada pede a frase (qualquer pessoa criaria conta e entraria)", () => rpc(C, "alumia_admin_recurso", { p_nome: "alumia-aberta", p_ligar: true, p_motivo: "Abrir a Alumia para todo mundo.", p_frase: "" }), "perigo_sem_trava");
await espera("com a frase escrita, abre, e o registro marca que foi sem a trava", async () => {
  await rpc(C, "alumia_admin_recurso", { p_nome: "alumia-aberta", p_ligar: true, p_motivo: "Abrir a Alumia para todo mundo.", p_frase: "ABRIR SEM A TRAVA" });
  return registro("recurso_ligado");
}, (r) => r.alvo === "alumia-aberta" && r.detalhes.sem_trava === true);

// ═══════════════════ 5. A porta de entrada: um clique ═══════════════════
const selo = (n) => createHmac("sha256", "x").update(String(n)).digest("hex");
const vence = () => new Date(Date.now() + 5 * 60_000).toISOString();
await espera("fechar a porta com um clique (sem motivo escrito, fica o padrão)", () => rpc(C, "alumia_admin_porta", { p_fechar: true, p_motivo: "" }), (r) => r.fechada === true);
await espera("... no registro", () => registro("porta_fechada"), (r) => r && /um clique/.test(r.motivo));
await recusa("fechar de novo não faz nada", () => rpc(C, "alumia_admin_porta", { p_fechar: true, p_motivo: "" }), "nada_a_fazer");
await espera("com a porta fechada, conta nova não passa no servidor", () => rpc(servico, "alumia_cadastro_passar", { p_momento: "conta", p_chave: null, p_selo: selo(1), p_vence: vence() }), (r) => r.ok === false && r.motivo === "porta_fechada");
await espera("nem pedido de entrada com convite", () => rpc(servico, "alumia_cadastro_passar", { p_momento: "pedido", p_chave: null, p_selo: selo(2), p_vence: vence(), p_usuario: P.nova, p_convite: "qualquer-convite" }), (r) => r.ok === false && r.motivo === "porta_fechada");
await recusa("quem pula o site e pede a entrada direto encontra a porta fechada", () => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: P.nova })]);
  try {
    return await banco.pg.query("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'em_analise')", [P.nova]);
  } finally {
    await banco.pg.query("select set_config('request.jwt.claims', '', false)");
  }
}), "porta_fechada");
await recusa("reabrir pede o motivo", () => rpc(C, "alumia_admin_porta", { p_fechar: false, p_motivo: "" }), "invalido:motivo");
await espera("reabrir com o motivo", () => rpc(C, "alumia_admin_porta", { p_fechar: false, p_motivo: "A onda de contas falsas passou." }), (r) => r.fechada === false);
await espera("... no registro", () => registro("porta_reaberta"), (r) => r && r.quem === P.coord);
await espera("aberta, a conta nova passa de novo", () => rpc(servico, "alumia_cadastro_passar", { p_momento: "conta", p_chave: null, p_selo: selo(3), p_vence: vence() }), (r) => r.ok === true);

// ═══════════════════ 6. Banir cascateia ═══════════════════
// O alvo gera quatro convites; três pessoas entram com três deles; o quarto fica aberto.
const codigos = ["convite-um-0001", "convite-dois-0002", "convite-tres-0003", "convite-quatro-0004"];
for (const c of codigos) await dono("insert into interno.alumia_convites (selo, criado_por) values (interno.selo($1), $2)", [c, P.alvo]);
for (const [i, quem] of [["conv1", 0], ["conv2", 1], ["conv3", 2]].map(([n, i]) => [i, n])) {
  await espera(`${quem} entra com o convite`, () => rpc(servico, "alumia_cadastro_passar", { p_momento: "pedido", p_chave: null, p_selo: selo(10 + i), p_vence: vence(), p_usuario: P[quem], p_convite: codigos[i] }), (r) => r.ok && r.convite === "aceito");
}
await espera("o convite usado sai da tabela; fica só o laço da cascata", () => um("select (select count(*)::int from interno.alumia_convites where criado_por = $1) convites, (select count(*)::int from interno.alumia_admin_convite_lacos where por = $1) lacos", [P.alvo]), (x) => x.convites === 1 && x.lacos === 3);
ok("a triagem continua vendo só a marca 'veio por convite', nunca de quem", !/alumia_admin_convite_lacos/.test((await um("select pg_get_functiondef('public.alumia_triagem_convites()'::regprocedure) d")).d));
for (const quem of ["alvo", "conv1", "conv2", "conv3", "outra"]) {
  await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P[quem]]);
}
await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'em_analise') on conflict (usuario) do update set situacao = 'em_analise'", [P.espera]);
await dono("insert into interno.alumia_admin_convite_lacos (convidado, por) values ($1, $2)", [P.espera, P.alvo]);
// A rede e o aparelho: duas impressões do alvo; "outra" divide uma delas (a confirmação leva o número de contas atingidas).
const imp = (n) => createHmac("sha256", "imp").update(String(n)).digest("hex");
await dono("insert into interno.alumia_impressoes (usuario, impressao) values ($1, $2), ($1, $3), ($4, $3)", [P.alvo, imp(1), imp(2), P.outra]);
const contasDaRede = (await um("select interno.alumia_painel_contas_da_rede($1) n", [P.alvo])).n;

const SEGREDO_EMAIL = "segredo-do-email-de-teste-com-mais-de-32-letras";
const { seloDoEmail, normalizarEmail } = await import("../lib/rede/admin/email.ts");
ok("o e-mail normaliza: minúsculas, sem +etiqueta, sem pontos no Gmail", normalizarEmail(" Fulana+teste@Exemplo.org ") === "fulana@exemplo.org" && normalizarEmail("f.u.l.a.n.a@gmail.com") === "fulana@gmail.com" && normalizarEmail("sem-arroba") === null);
ok("o resumo do e-mail é HMAC em hexadecimal; sem segredo (ou curto) não há resumo", /^[0-9a-f]{64}$/.test(seloDoEmail("a@b.org", SEGREDO_EMAIL) ?? "") && seloDoEmail("a@b.org", "curto") === null && seloDoEmail("a@b.org", undefined) === null && seloDoEmail("A+x@B.org", SEGREDO_EMAIL) === seloDoEmail("a@b.org", SEGREDO_EMAIL));
const seloAlvo = seloDoEmail("alvo@admin.local", SEGREDO_EMAIL);

await recusa("banir pede o codinome escrito igual", () => rpc(C, "alumia_admin_banir", { p_id: P.alvo, p_motivo: "Conta criada para atacar a rede.", p_confirma: "outro nome", p_selo_email: seloAlvo, p_rede_dias: 0, p_rede_contas: null }), "confirmacao_errada");
await recusa("ninguém se bane", () => rpc(C, "alumia_admin_banir", { p_id: P.coord, p_motivo: "Conta criada para atacar a rede.", p_confirma: "Codinome coord", p_selo_email: null, p_rede_dias: 0, p_rede_contas: null }), "voce_mesmo");
await recusa("a coordenação não é banida por aqui", () => rpc(C, "alumia_admin_banir", { p_id: P.coord2, p_motivo: "Conta criada para atacar a rede.", p_confirma: "Codinome coord2", p_selo_email: null, p_rede_dias: 0, p_rede_contas: null }), "coordenacao_protegida");
await recusa("quem tem função na casa segue as regras do painel da equipe", () => rpc(C, "alumia_admin_banir", { p_id: P.mediador, p_motivo: "Conta criada para atacar a rede.", p_confirma: "Codinome mediador", p_selo_email: null, p_rede_dias: 0, p_rede_contas: null }), "tem_funcao");
await recusa("o número de contas atingidas pela rede é conferido de novo", () => rpc(C, "alumia_admin_banir", { p_id: P.alvo, p_motivo: "Conta criada para atacar a rede.", p_confirma: "Codinome alvo", p_selo_email: seloAlvo, p_rede_dias: 7, p_rede_contas: contasDaRede + 5 }), "confira_de_novo");
ok("a recusa não deixou nada pela metade (tudo ou nada)", (await um("select (select suspenso from interno.perfis where id = $1) s, (select count(*)::int from interno.alumia_admin_emails_barrados) e", [P.alvo])).s === false);

const ban = await espera("banir a conta e o que vem dela", () => rpc(C, "alumia_admin_banir", { p_id: P.alvo, p_motivo: "Conta criada para atacar a rede.", p_confirma: "Codinome alvo", p_selo_email: seloAlvo, p_rede_dias: 7, p_rede_contas: contasDaRede }),
  (r) => r.ok && r.email === true && r.rede_dias === 7);
ok("números de pessoas só a partir de 3 (os três convidados aparecem; o convite aberto, que é 1, não)", ban?.convidados?.n === 3 && ban?.convites?.n === null && ban?.convites?.algum === true);
await espera("a conta: suspensa e com o banimento em vigor", () => um("select f.suspenso, (select count(*)::int from interno.alumia_sancoes s where s.usuario = f.id and s.tipo = 'banimento' and s.encerrada_em is null) b from interno.perfis f where f.id = $1", [P.alvo]), (x) => x.suspenso && x.b === 1);
await espera("as sessões: encerradas (a marca de sessão cortada está gravada)", () => um("select count(*)::int n from interno.alumia_sessoes_cortadas where usuario = $1", [P.alvo]), (x) => x.n >= 1);
await espera("o e-mail: só o resumo, e o banco não tem o e-mail em claro em lugar novo", () => dono("select selo from interno.alumia_admin_emails_barrados"), (r) => r.rows.length === 1 && r.rows[0].selo === seloAlvo && !JSON.stringify(r.rows).includes("@"));
await espera("o servidor confere o e-mail barrado pelo resumo", () => rpc(servico, "alumia_admin_email_barrado", { p_selo: seloAlvo }), (r) => r === true);
await espera("... e outro e-mail não está barrado", () => rpc(servico, "alumia_admin_email_barrado", { p_selo: seloDoEmail("outra@admin.local", SEGREDO_EMAIL) }), (r) => r === false);
await espera("os convites dela: o que estava aberto foi cancelado", () => um("select count(*) filter (where situacao = 'aberto')::int abertos, count(*) filter (where situacao = 'cancelado')::int cancelados from interno.alumia_convites where criado_por = $1", [P.alvo]), (x) => x.abertos === 0 && x.cancelados === 1);
await espera("quem ela convidou e já estava aprovado voltou à triagem", () => dono("select usuario, situacao from interno.alumia_entrada where usuario = any($1)", [[P.conv1, P.conv2, P.conv3, P.espera]]),
  (r) => r.rows.length === 4 && r.rows.every((x) => x.situacao === "em_analise"));
await espera("... recebeu um aviso neutro (sem dizer quem foi banida)", () => um("select count(*)::int n from interno.avisos where para = $1 and texto like '%voltou para a análise%'", [P.conv1]), (x) => x.n === 1);
await espera("os laços da cascata foram gastos", () => um("select count(*)::int n from interno.alumia_admin_convite_lacos where por = $1 or convidado = $1", [P.alvo]), (x) => x.n === 0);
await espera("a rede e o aparelho: barrados pela impressão com prazo (e a outra conta da mesma rede junto, como a confirmação disse)", () => um("select (select count(*)::int from interno.alumia_impressao_banidas) imp, (select count(*)::int from interno.alumia_sancoes where tipo = 'rede' and encerrada_em is null) contas"), (x) => x.imp === 2 && x.contas === contasDaRede);
await espera("o registro tem o banimento e a cascata, com quem fez, sem endereço e sem e-mail", () => dono("select acao, quem, papel, detalhes::text d from interno.alumia_painel_registro where alvo = $1 or acao in ('conta_banida_tudo', 'rede_banida') order by id", [P.alvo]),
  (r) => ["conta_banida", "rede_banida", "conta_banida_tudo"].every((a) => r.rows.some((x) => x.acao === a && x.quem === P.coord && x.papel === "coordenacao")) && !r.rows.some((x) => /@|\d+\.\d+\.\d+\.\d+/.test(x.d)));
await espera("o e-mail da conta só sai para a chave de serviço", () => rpc(servico, "alumia_admin_email_de", { p_id: P.alvo }), (r) => r === "alvo@admin.local");

// ═══════════════════ 7. Apagar qualquer post ═══════════════════
// Desde a R2 (membros escondidos) o banco não aceita post de núcleo; o espaço fechado que sobra é a conversa fechada ('fechado-*').
const nucleo = (await um("insert into interno.rede_nucleos (nome) values ('Núcleo do teste') returning id")).id;
await recusa("post de núcleo nem entra no banco (desde a R2)", () => um("insert into interno.rede_posts (autor, texto, nucleo) values ($1, 'post do núcleo', $2) returning id", [P.membro, nucleo]), "rede_posts_sem_nucleo");
const postNucleo = (await um("insert into interno.rede_posts (autor, texto, comunidade) values ($1, 'post do espaço fechado', 'fechado-teste') returning id", [P.membro])).id;
const postComum = (await um("insert into interno.rede_posts (autor, texto) values ($1, 'post comum') returning id", [P.membro])).id;
await recusa("o painel antigo não apaga post de espaço fechado (só pela denúncia)", () => rpc(C, "alumia_painel_post_agir", { p_id: postNucleo, p_acao: "apagar", p_motivo: "Post com ameaça a uma pessoa." }), "so_pela_denuncia");
const ap = await espera("o painel único apaga o post de espaço fechado, sem devolver o texto", () => rpc(C, "alumia_admin_post_apagar", { p_id: postNucleo, p_motivo: "Post com ameaça a uma pessoa." }), (r) => r.ok && r.restrito === true && !JSON.stringify(r).includes("fechado"));
ok("a resposta não traz o texto do post", ap && !("texto" in ap));
await espera("... foi para a lixeira (volta em 30 dias) e saiu do ar", () => um("select p.oculto, (select count(*)::int from interno.alumia_painel_lixeira l where l.post = p.id) l from interno.rede_posts p where p.id = $1", [postNucleo]), (x) => x.oculto && x.l === 1);
await espera("... no registro, sem a comunidade de um espaço fechado", () => registro("post_apagar"), (r) => r.alvo === postNucleo && r.detalhes.restrito === true && r.detalhes.comunidade === null);
await espera("post comum também", () => rpc(C, "alumia_admin_post_apagar", { p_id: postComum, p_motivo: "Spam repetido em várias comunidades." }), (r) => r.ok && r.restrito === false);
await recusa("o mesmo post de novo: já está na lixeira", () => rpc(C, "alumia_admin_post_apagar", { p_id: postComum, p_motivo: "Spam repetido em várias comunidades." }), "na_lixeira");
await recusa("post que não existe", () => rpc(C, "alumia_admin_post_apagar", { p_id: "00000000-0000-4000-8000-000000000001", p_motivo: "Spam repetido em várias comunidades." }), "nao_encontrado");

// ═══════════════════ 8. Servidores do Fediverso ═══════════════════
await espera("bloquear um servidor", () => rpc(C, "alumia_admin_fed_bloquear", { p_dominio: "Servidor-Ruim.example", p_sim: true, p_motivo: "Servidor que manda assédio em massa." }), (r) => r.some((s) => s.dominio === "servidor-ruim.example"));
await espera("... no registro", () => registro("fed_servidor_bloqueado"), (r) => r.alvo === "servidor-ruim.example" && r.quem === P.coord);
await recusa("domínio inválido", () => rpc(C, "alumia_admin_fed_bloquear", { p_dominio: "x", p_sim: true, p_motivo: "Servidor que manda assédio em massa." }), "invalido:dominio");
await espera("desbloquear", () => rpc(C, "alumia_admin_fed_bloquear", { p_dominio: "servidor-ruim.example", p_sim: false, p_motivo: "O servidor trocou a moderação." }), (r) => !r.some((s) => s.dominio === "servidor-ruim.example"));
await espera("... no registro", () => registro("fed_servidor_desbloqueado"), (r) => r && r.alvo === "servidor-ruim.example");

// ═══════════════════ 9. A borda no banco: só o número da regra e o prazo ═══════════════════
await recusa("prazo menor que 24 h não passa", () => rpc(C, "alumia_admin_borda_guardar", { p_regra: "a".repeat(32), p_horas: 23, p_motivo: "Ataque de cadastro em massa agora." }), "invalido:horas");
await recusa("prazo maior que 7 dias não passa", () => rpc(C, "alumia_admin_borda_guardar", { p_regra: "a".repeat(32), p_horas: 169, p_motivo: "Ataque de cadastro em massa agora." }), "invalido:horas");
for (const m of ["Ataque vindo de 203.0.113.77 agora mesmo.", "Ataque vindo de 2001:db8::5 agora mesmo.", "Ataque de 2001:db8:aa:bb:cc:dd:ee:ff.", "Faixa 203.0.113.0/24 atacando."]) {
  await recusa(`o motivo com endereço não passa (${m})`, () => rpc(C, "alumia_admin_borda_guardar", { p_regra: "a".repeat(32), p_horas: 24, p_motivo: m }), "invalido:motivo_com_endereco");
}
await recusa("o motivo com endereço não passa em nenhuma ação do painel (recurso)", () => rpc(C, "alumia_admin_recurso", { p_nome: "vlibras", p_ligar: true, p_motivo: "Pedido que veio de 198.51.100.4.", p_frase: null }), "invalido:motivo_com_endereco");
await espera("o motivo com hora, data e versão passa (não é endereço)", async () => {
  const d = await dono("select interno.alumia_painel_motivo('Ataque às 10:30:00 de 17/11, versão 1.2.3 do site, e às 22:15.') as m");
  return d.rows[0].m;
}, (m) => typeof m === "string" && m.includes("10:30:00"));
await espera("nenhum motivo guardado no banco tem endereço", () => um("select count(*)::int n from interno.alumia_painel_registro where motivo ~ '[0-9]{1,3}([.][0-9]{1,3}){3}'"), (x) => x.n === 0);
await recusa("a regra não aceita um endereço no lugar do número", () => rpc(C, "alumia_admin_borda_guardar", { p_regra: "203.0.113.7", p_horas: 24, p_motivo: "Ataque de cadastro em massa agora." }), "invalido:regra");
const bloq = await espera("guardar o bloqueio", () => rpc(C, "alumia_admin_borda_guardar", { p_regra: "b".repeat(32), p_horas: 48, p_motivo: "Ataque de cadastro em massa agora." }), (r) => r.id && r.vence_em);
await espera("... no registro, com o prazo", () => registro("borda_bloqueio"), (r) => r.alvo === bloq?.id && r.detalhes.horas === 48);
await espera("a lista não tem endereço nenhum", () => rpc(C, "alumia_admin_borda_lista"), (r) => r.ativos.length === 1 && !/regra|\d+\.\d+\.\d+\.\d+/.test(JSON.stringify(r)));
await espera("o número da regra só sai para quem tem o painel", () => rpc(C, "alumia_admin_borda_regra", { p_id: bloq.id }), (r) => r === "b".repeat(32));
await espera("tirar antes da hora", () => rpc(C, "alumia_admin_borda_tirada", { p_id: bloq.id, p_motivo: "O ataque parou antes do prazo." }), (r) => r.ok);
await espera("... no registro", () => registro("borda_desbloqueio"), (r) => r.alvo === bloq.id);
await dono("insert into interno.alumia_admin_borda (regra, por, motivo, criado_em, vence_em) values ($1, $2, 'Bloqueio que já venceu.', now() - interval '2 days', now() - interval '1 day')", ["c".repeat(32), P.coord]);
await espera("a rotina vê o vencido (chave de serviço)", () => rpc(servico, "alumia_admin_borda_vencidas"), (r) => r.length === 1 && r[0].regra === "c".repeat(32));
await espera("... e dá baixa, que fica no registro como do sistema", async () => {
  const lista = await rpc(servico, "alumia_admin_borda_vencidas");
  await rpc(servico, "alumia_admin_borda_apagada", { p_id: lista[0].id });
  return { r: await registro("borda_venceu"), n: await rpc(servico, "alumia_admin_borda_vencidas") };
}, (x) => x.r.papel === "sistema" && x.r.quem === null && x.n.length === 0);
await espera("a rotina do banco sem endereço configurado não faz nada (e não quebra)", () => um("select 1 as ok from (select interno.alumia_admin_rotina()) x"), (x) => x.ok === 1);

// ═══════════════════ 10. As rotas, com um banco de ponte e uma Cloudflare de mentira (sem rede) ═══════════════════
{
  const SUPA = "https://banco.duble";
  const CHAVE_SERVICO = "chave-de-servico-de-teste-0123456789";
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPA;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anonima-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_SERVICO;
  process.env.ALUMIA_EMAIL_SEGREDO = SEGREDO_EMAIL;
  process.env.CRON_SECRET = "segredo-das-outras-rotinas-de-teste-0123"; // gitleaks:allow (valor de teste)
  process.env.ALUMIA_BORDA_ROTINA = "chave-so-da-rotina-da-borda-de-teste-0123456789";
  delete process.env.ALUMIA_CF_TOKEN;
  delete process.env.ALUMIA_CF_ZONA;
  const ZONA = "0123456789abcdef0123456789abcdef";
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const tokenDe = (sub, aal = "aal2") => `${b64({ alg: "none" })}.${b64({ sub, role: "authenticated", aal })}.assinatura-de-teste`;
  const cf = { regras: new Map(), chamadas: [], falhar: false, proximo: 1 };
  const corposMandados = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const corpo = init.body ? JSON.parse(String(init.body)) : null;
    const cab = new Headers(init.headers ?? {});
    corposMandados.push({ u, corpo });
    if (u.startsWith("https://api.cloudflare.com/client/v4/")) {
      cf.chamadas.push({ u, metodo: init.method, corpo, auth: cab.get("authorization") });
      if (cf.falhar) return Response.json({ success: false }, { status: 500 });
      const m = /\/zones\/([0-9a-f]{32})\/firewall\/access_rules\/rules(?:\/([A-Za-z0-9]+))?$/.exec(u);
      if (!m || m[1] !== ZONA) return Response.json({ success: false }, { status: 404 });
      if (init.method === "POST") {
        const id = `regra${String(cf.proximo++).padStart(27, "0")}`;
        cf.regras.set(id, corpo.configuration);
        return Response.json({ success: true, result: { id } });
      }
      if (init.method === "DELETE") {
        const tinha = cf.regras.delete(m[2]);
        return Response.json({ success: tinha }, { status: tinha ? 200 : 404 });
      }
      return Response.json({ success: false }, { status: 405 });
    }
    if (u.startsWith(`${SUPA}/rest/v1/rpc/`)) {
      const funcao = u.slice(`${SUPA}/rest/v1/rpc/`.length);
      const bearer = cab.get("authorization")?.replace(/^Bearer /, "") ?? "";
      let quem;
      if (bearer === CHAVE_SERVICO) quem = servico;
      else {
        const dados = JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString("utf8") || "{}");
        quem = como(dados.sub, dados.aal);
      }
      try {
        return Response.json(await rpc(quem, funcao, corpo ?? {}));
      } catch (erro) {
        return Response.json({ message: String(erro.message) }, { status: 400 });
      }
    }
    return Response.json({ message: "sem dublê" }, { status: 404 });
  };
  const pedir = (corpo, token) => new Request("https://alumia.duble/api", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(corpo) });
  const borda = await import("../app/api/alumia/admin/borda/route.ts");
  const vencidas = await import("../app/api/alumia/admin/borda/vencidas/route.ts");
  const banir = await import("../app/api/alumia/admin/banir/route.ts");
  const { alvoDoBloqueio } = await import("../lib/rede/admin/cloudflare.ts");
  const { emailBarrado } = await import("../lib/rede/admin/servidor.ts");

  ok("o alvo: IPv4, IPv6 e as faixas que a Cloudflare aceita", alvoDoBloqueio("203.0.113.7").alvo?.target === "ip" && alvoDoBloqueio("2001:db8:aa:bb::1").alvo?.target === "ip6"
    && alvoDoBloqueio("203.0.113.9/24").alvo?.value === "203.0.113.0/24" && alvoDoBloqueio("2001:db8:aa:bb:1::/64").alvo?.value === "2001:db8:aa:bb:0:0:0:0/64");
  ok("o alvo recusa lixo, faixa larga demais e endereço interno ou reservado", alvoDoBloqueio("não é ip").motivo === "ip_invalido" && alvoDoBloqueio("203.0.113.7/8").motivo === "faixa_larga"
    && alvoDoBloqueio("192.168.0.1").motivo === "ip_reservado" && alvoDoBloqueio("127.0.0.1").motivo === "ip_reservado" && alvoDoBloqueio("::1").motivo === "ip_reservado" && alvoDoBloqueio("10.1.2.3/24").motivo === "ip_reservado");

  const TC = tokenDe(P.coord);
  for (const [rotulo, token] of [["sem sessão", null], ["conta comum", tokenDe(P.membro)], ["admin da Alumia", tokenDe(P.admin)], ["coordenação sem o código", tokenDe(P.coord, "aal1")]]) {
    const r = await borda.POST(pedir({ acao: "estado" }, token));
    ok(`rota da borda: ${rotulo} recebe 404`, r.status === 404);
    const b = await banir.POST(pedir({ id: P.conv1, motivo: "Conta criada para atacar a rede.", confirma: "Codinome conv1" }, token));
    ok(`rota de banir: ${rotulo} recebe 404`, b.status === 404);
  }
  let r = await borda.POST(pedir({ acao: "estado" }, TC));
  let d = await r.json();
  ok("sem as variáveis da Cloudflare, o painel diz que falta configurar", r.status === 200 && d.configurada === false);
  r = await borda.POST(pedir({ acao: "bloquear", ip: "203.0.113.7", horas: 24, motivo: "Ataque de cadastro em massa agora." }, TC));
  d = await r.json();
  ok("... e bloquear responde 'sem_configuracao' sem chamar a Cloudflare", r.status === 503 && d.codigo === "sem_configuracao" && cf.chamadas.length === 0);

  process.env.ALUMIA_CF_TOKEN = "token-da-cloudflare-de-teste-0123456789";
  process.env.ALUMIA_CF_ZONA = ZONA;
  r = await borda.POST(pedir({ acao: "bloquear", ip: "999.1.1.1", horas: 24, motivo: "Ataque de cadastro em massa agora." }, TC));
  ok("endereço inválido: 400, sem chamar a Cloudflare", r.status === 400 && (await r.json()).codigo === "ip_invalido" && cf.chamadas.length === 0);
  r = await borda.POST(pedir({ acao: "bloquear", ip: "203.0.113.7", horas: 12, motivo: "Ataque de cadastro em massa agora." }, TC));
  ok("prazo menor que 24 h: 400", r.status === 400);
  for (const motivo of ["Ataque vindo de 203.0.113.50 agora.", "Ataque da conta @faisca agora.", "Quem atacou foi fulana@exemplo.org agora."]) {
    r = await borda.POST(pedir({ acao: "bloquear", ip: "203.0.113.7", horas: 24, motivo }, TC));
    ok(`motivo com endereço ou conta: 400 sem chamar a Cloudflare (${motivo})`, r.status === 400 && (await r.json()).codigo === "invalido:motivo_com_endereco" && cf.chamadas.length === 0);
  }
  const IP = "203.0.113.77";
  r = await borda.POST(pedir({ acao: "bloquear", ip: IP, horas: 72, motivo: "Ataque de cadastro em massa agora." }, TC));
  d = await r.json();
  ok("bloquear: a Cloudflare recebe a regra de bloqueio, com o token só do servidor", r.status === 200 && d.ok && cf.chamadas.length === 1 && cf.chamadas[0].metodo === "POST" && cf.chamadas[0].corpo.mode === "block"
    && cf.chamadas[0].corpo.configuration.value === IP && cf.chamadas[0].auth === `Bearer ${process.env.ALUMIA_CF_TOKEN}` && !cf.chamadas[0].corpo.notes.includes(IP));
  ok("a resposta não devolve o endereço", !JSON.stringify(d).includes(IP));
  await espera("o banco guardou só o número da regra e o prazo (72 h)", () => um("select regra, extract(epoch from (vence_em - criado_em))/3600 as horas, row_to_json(b)::text t from interno.alumia_admin_borda b where id = $1", [d.id]), (x) => x.regra === "regra" + "1".padStart(27, "0") && Math.round(x.horas) === 72 && !x.t.includes(IP));
  await espera("nenhum lugar do banco que a rota tocou tem o endereço (borda, registro, configurações)", () => um("select (select string_agg(row_to_json(b)::text, '') from interno.alumia_admin_borda b) || (select string_agg(row_to_json(r)::text, '') from interno.alumia_painel_registro r) || (select string_agg(valor::text, '') from interno.configuracoes) t"), (x) => !x.t.includes(IP));
  ok("nada do que foi ao banco levou o endereço", corposMandados.filter((c) => c.u.startsWith(SUPA)).every((c) => !JSON.stringify(c.corpo).includes(IP)));

  // Falhas: a Cloudflare fora do ar não grava nada; o banco recusando apaga a regra na hora.
  const linhasAntes = (await um("select count(*)::int n from interno.alumia_admin_borda")).n;
  cf.falhar = true;
  r = await borda.POST(pedir({ acao: "bloquear", ip: "198.51.100.5", horas: 24, motivo: "Ataque de cadastro em massa agora." }, TC));
  cf.falhar = false;
  ok("Cloudflare fora do ar: 502 e nada no banco", r.status === 502 && (await um("select count(*)::int n from interno.alumia_admin_borda")).n === linhasAntes);
  await dono("insert into interno.limites_config (acao, maximo, minutos) values ('alumia_admin_borda', 1, 60) on conflict (acao) do update set maximo = 1");
  const regrasAntes = cf.regras.size;
  r = await borda.POST(pedir({ acao: "bloquear", ip: "198.51.100.6", horas: 24, motivo: "Ataque de cadastro em massa agora." }, TC));
  ok("o banco recusou: a regra recém-criada sai da Cloudflare (nada fica sem prazo)", r.status === 400 && cf.regras.size === regrasAntes);
  await dono("delete from interno.limites_config where acao = 'alumia_admin_borda'");

  r = await borda.POST(pedir({ acao: "tirar", id: d.id, motivo: "O ataque parou antes do prazo." }, TC));
  ok("tirar antes da hora apaga na Cloudflare e dá baixa", r.status === 200 && (await r.json()).ok && cf.regras.size === 0 && cf.chamadas.at(-1).metodo === "DELETE");

  // A rotina: um bloqueio vencido sai da Cloudflare sozinho.
  r = await borda.POST(pedir({ acao: "bloquear", ip: "198.51.100.8", horas: 24, motivo: "Ataque de cadastro em massa agora." }, TC));
  const id2 = (await r.json()).id;
  await dono("update interno.alumia_admin_borda set criado_em = now() - interval '2 days', vence_em = now() - interval '1 day' where id = $1", [id2]);
  r = await vencidas.POST(new Request("https://alumia.duble/api", { method: "POST", headers: { Authorization: "Bearer errado" } }));
  ok("a rotina sem a chave certa não faz nada", r.status === 401 && cf.regras.size === 1);
  r = await vencidas.POST(new Request("https://alumia.duble/api", { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  ok("a CRON_SECRET das outras rotinas não abre a rotina da borda (chave própria)", r.status === 401 && cf.regras.size === 1);
  r = await vencidas.POST(new Request("https://alumia.duble/api", { method: "POST", headers: { Authorization: `Bearer ${process.env.ALUMIA_BORDA_ROTINA}` } }));
  d = await r.json();
  ok("a rotina apaga na Cloudflare o que venceu e dá baixa", r.status === 200 && d.saidos === 1 && cf.regras.size === 0);
  await espera("... e o registro diz que venceu", () => registro("borda_venceu"), (x) => x.alvo === id2);
  r = await borda.POST(pedir({ acao: "bloquear", ip: "198.51.100.9", horas: 24, motivo: "Ataque de cadastro em massa agora." }, TC));
  const id3 = (await r.json()).id;
  await dono("update interno.alumia_admin_borda set criado_em = now() - interval '2 days', vence_em = now() - interval '1 day' where id = $1", [id3]);
  r = await borda.POST(pedir({ acao: "estado" }, TC));
  d = await r.json();
  ok("abrir a aba também apaga o que venceu", d.configurada === true && cf.regras.size === 0 && d.lista.ativos.length === 0);

  // Banir pela rota: o e-mail vira o resumo no servidor e não volta ao navegador.
  await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P.membro]);
  r = await banir.POST(pedir({ id: P.membro, motivo: "Conta criada para atacar a rede.", confirma: "Codinome membro" }, TC));
  d = await r.json();
  ok("banir pela rota: o banco baniu e o e-mail foi barrado pelo resumo", r.status === 200 && d.ok && d.email === true && d.email_sem_segredo === false && !JSON.stringify(d).includes("@"));
  await espera("o resumo gravado é o do e-mail da conta, com o segredo do servidor", () => rpc(servico, "alumia_admin_email_barrado", { p_selo: seloDoEmail("membro@admin.local", SEGREDO_EMAIL) }), (x) => x === true);
  ok("a rota de criar conta pode conferir o e-mail barrado (lib/rede/admin/servidor.ts)", (await emailBarrado("Membro+outra@admin.local")) === true && (await emailBarrado("ninguem@admin.local")) === false);
  r = await banir.POST(pedir({ id: P.conv2, motivo: "curto", confirma: "Codinome conv2" }, TC));
  ok("banir pela rota com o motivo curto: o banco recusa e a rota diz o código", r.status === 400 && (await r.json()).codigo === "invalido:motivo");
}

console.log(`\nPainel único de admin da Alumia: ${certos} certos, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
