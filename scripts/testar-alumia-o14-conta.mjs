// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a conta da Alumia no Supabase de verdade (supabase/migracoes/20261120-alumia-o14-conta.sql) num Postgres local
// (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql e as tabelas do serviço de contas criadas como no
// serviço real. O centro: quando o banco NÃO pode apagar (fase A) ou nem ler (fase B) as sessões do serviço de contas, a porta não
// libera em silêncio (o token cortado para nela; o vencido também), desconectar e o pânico não quebram, o código de recuperação só é
// gasto quando o servidor pode tirar o aplicativo, e o aviso de entrada nova sai pelo servidor quando falta o gatilho. A falta de
// permissão é simulada como o Postgres a dá (erro 42501); a prova com a permissão tirada de verdade foi no Postgres do Supabase.
// E varreduras genéricas do repositório inteiro (rodam de novo sem mudança quando entrarem as ondas 12 e 13): nenhuma variável
// secreta do servidor chega ao navegador, e toda rota que lê uma delas tem a saída para quando ela falta; os e-mails de conta
// levam o recado nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o14-conta.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { situacaoDasVariaveis, VARIAVEIS_DO_SERVIDOR } from "../lib/rede/seguranca/variaveis.ts";
import { lerToken } from "../lib/rede/seguranca/servico-de-contas.ts";

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

// ═══════════════════ 0. Varreduras do repositório ═══════════════════
const SEGREDOS = VARIAVEIS_DO_SERVIDOR.map((v) => v.nome);
ok("a lista da Saúde tem as seis variáveis secretas da Alumia", ["SUPABASE_SERVICE_ROLE_KEY", "ALUMIA_VOTO_SEGREDO", "ALUMIA_IMPRESSAO_SEGREDO", "ALUMIA_BORDA_SEGREDO",
  "TURNSTILE_SECRET_KEY", "GOOGLE_SAFE_BROWSING_KEY"].every((n) => SEGREDOS.includes(n)));

const IGNORAR = new Set(["node_modules", ".next", ".git", ".claude", "out", "public", "docs"]);
function arquivos(dir, achados = []) {
  for (const e of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const c = path.posix.join(dir, e.name);
    if (e.isDirectory()) arquivos(c, achados);
    else if (/\.(ts|tsx|mjs|js|cjs|json|ya?ml|toml)$/.test(e.name)) achados.push(c);
  }
  return achados;
}
const codigo = ["app", "components", "lib", "i18n", "hooks", "supabase/functions", ".github"].filter((d) => fs.existsSync(path.join(raiz, d))).flatMap((d) => arquivos(d));
const soltos = fs.readdirSync(raiz).filter((n) => /^(next\.config\.[a-z]+|proxy\.ts|middleware\.ts|instrumentation\.ts)$/.test(n));
const todos = [...codigo, ...soltos];
ok("a varredura achou o código (app, components, lib)", todos.length > 500);

const NOME_PUBLICO_PERMITIDO = /^NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_ANON_KEY|TURNSTILE_SITE_KEY|VAPID_PUBLIC_KEY)$/;
const publicosSuspeitos = new Set();
for (const c of todos) for (const m of ler(c).matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
  if (/SECRET|SEGREDO|SERVICE|PRIVATE|_KEY$|TOKEN|SENHA|PASSWORD/.test(m[0]) && !NOME_PUBLICO_PERMITIDO.test(m[0])) publicosSuspeitos.add(`${m[0]} (${c})`);
}
ok(`nenhuma variável com cara de segredo começa com NEXT_PUBLIC_ (achadas: ${[...publicosSuspeitos].join(", ")})`, publicosSuspeitos.size === 0);

const clientes = todos.filter((c) => /\.(tsx?|m?js)$/.test(c) && /^\s*["']use client["'];?/m.test(ler(c).split("\n").slice(0, 12).join("\n")));
ok("a varredura achou as telas do navegador", clientes.length > 100);
const segredoNoCliente = clientes.filter((c) => SEGREDOS.some((n) => new RegExp(`process\\.env(\\.${n}\\b|\\[["']${n}["']\\])`).test(ler(c))));
ok(`nenhuma tela do navegador lê variável secreta (achadas: ${segredoNoCliente.join(", ")})`, segredoNoCliente.length === 0);
const config = soltos.filter((n) => n.startsWith("next.config")).map(ler).join("\n");
ok("o next.config não repassa variável secreta ao navegador", !SEGREDOS.some((n) => config.includes(n)) && !/\benv\s*:\s*\{/.test(config));

// Toda rota de API que lê uma variável secreta (direto ou por uma peça da lib) tem a saída para quando ela falta: 503/404/"sem_servico",
// ou a resposta de "desligado". Leitura de texto, de propósito simples: a regra é a rota NÃO seguir com a variável vazia.
const PECAS = {
  "lib/rede/convites/servidor": ["SUPABASE_SERVICE_ROLE_KEY", "ALUMIA_IMPRESSAO_SEGREDO"],
  "lib/rede/voto/servidor": ["ALUMIA_VOTO_SEGREDO"],
  "lib/rede/redacao/servidor": ["ALUMIA_VOTO_SEGREDO"],
  "lib/rede/convites/turnstile": ["TURNSTILE_SECRET_KEY"],
  "lib/rede/painel/impressao": ["ALUMIA_IMPRESSAO_SEGREDO", "ALUMIA_BORDA_SEGREDO"],
};
// Peças que só servem para usar a chave de serviço: a rota que importa qualquer coisa delas depende da chave (ondas 10 a 13).
const PECAS_SO_DA_CHAVE = ["lib/rede/midia/servidor", "lib/rede/atos/album-servidor", "lib/rede/contas-extra", "lib/rede/pontes/robos"];
for (const p of PECAS_SO_DA_CHAVE) {
  ok(`a peça ${p} existe e lê a chave de serviço`, fs.existsSync(path.join(raiz, `${p}.ts`))
    && /process\.env\.SUPABASE_SERVICE_ROLE_KEY|configDoAmbiente[\s\S]*from "\.\.\/contas-extra"/.test(ler(`${p}.ts`)));
}
// Rotas que seguem sem a variável de propósito (o motivo está no comentário do alto de cada uma).
const DEGRADAM_DE_PROPOSITO = new Set([
  // Sem banco, a dificuldade de cautela; sem ALUMIA_IMPRESSAO_SEGREDO, os desafios são assinados com uma chave sorteada no processo.
  "app/api/alumia/porta/desafio/route.ts",
]);
const rotas = todos.filter((c) => /^app\/api\/.*\/route\.ts$/.test(c));
const semSaida = [];
const rotasComSegredo = [];
for (const c of rotas) {
  const t = ler(c);
  const usa = SEGREDOS.some((n) => t.includes(`process.env.${n}`)) || Object.keys(PECAS).some((p) => t.includes(`@/${p}"`) && /servico\(\)|segredoDo|impressaoDo|conferirDesafio|rpcDeServico/.test(t))
    || PECAS_SO_DA_CHAVE.some((p) => t.includes(`@/${p}"`));
  if (!usa || DEGRADAM_DE_PROPOSITO.has(c)) continue;
  rotasComSegredo.push(c);
  if (!/\b(503|404)\b|naoExiste|sem_servico|ligado: false|conferido: false|estadoDaConferencia|"sem_chave"/.test(t)) semSaida.push(c);
}
ok(`toda rota que lê variável secreta tem a saída para quando ela falta (sem saída: ${semSaida.join(", ")})`, semSaida.length === 0);
// As rotas novas das ondas 12 e 13 que dependem da chave entram na varredura (o vídeo do post é a sobra da onda 12).
for (const c of ["app/api/rede/video/route.ts", "app/api/rede/perfil-link/route.ts", "app/api/rede/robos/route.ts", "app/api/rede/telegram/route.ts", "app/api/rede/org/selo/route.ts"]) {
  ok(`a varredura confere ${c}`, !fs.existsSync(path.join(raiz, c)) || rotasComSegredo.includes(c));
}
ok("o vídeo do post sem a chave de serviço responde 503 (desligado), sem tentar gravar", (() => {
  const t = ler("app/api/rede/video/route.ts");
  const m = ler("lib/rede/midia/servidor.ts");
  return /if \(!videoLigadoNoServidor\(\)\) return resposta\(\{ erro: "desligado" \}, 503\)/.test(t) && /videoLigadoNoServidor = \(\): boolean => Boolean\(url && servico\(\)\)/.test(m)
    && /if \(!url \|\| !chave/.test(m);
})());
ok("a Saúde diz o que para sem a chave de serviço, inclusive o vídeo dos posts", (VARIAVEIS_DO_SERVIDOR.find((v) => v.nome === "SUPABASE_SERVICE_ROLE_KEY")?.semEla ?? "").includes("vídeo dos posts"));
ok("a rota da Saúde devolve só o nome e a situação (nunca o valor)", (() => {
  const t = ler("app/api/alumia/painel/saude/route.ts");
  return t.includes("situacaoDasVariaveis()") && !/process\.env/.test(t);
})());
const sit = situacaoDasVariaveis({ SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40), ALUMIA_VOTO_SEGREDO: "curto", TURNSTILE_SECRET_KEY: "  " });
ok("a situação das variáveis: presente, curta e falta, sem o valor", sit.find((v) => v.nome === "SUPABASE_SERVICE_ROLE_KEY")?.situacao === "presente"
  && sit.find((v) => v.nome === "ALUMIA_VOTO_SEGREDO")?.situacao === "curta" && sit.find((v) => v.nome === "TURNSTILE_SECRET_KEY")?.situacao === "falta"
  && !JSON.stringify(sit).includes("xxxx") && !JSON.stringify(sit).includes("curto"));

{
  const rota = ler("app/api/alumia/conta/route.ts");
  ok("a rota do código não confia em cabeçalho: termina pela função que só a chave de serviço chama", !/x-alumia-fator/.test(rota)
    && /rpcDeServico<[^>]+>\("conta_codigo_usar_pelo_servidor", \{ p_usuario: conta\.id/.test(rota));
}
const tokenDe = (corpo) => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(corpo)).toString("base64url")}.assinatura`;
ok("lerToken: a conta e a sessão do token", JSON.stringify(lerToken(tokenDe({ sub: "11111111-2222-3333-4444-555555555555", session_id: "AAAAAAAA-2222-3333-4444-555555555555" })))
  === JSON.stringify({ conta: "11111111-2222-3333-4444-555555555555", sessao: "aaaaaaaa-2222-3333-4444-555555555555" }));
ok("lerToken: token torto ou sem conta não vale", lerToken("x.y") === null && lerToken(tokenDe({ sub: "nao-e-uuid" })) === null && lerToken("a.%%%.c") === null);

const sql = ler("supabase/migracoes/20261120-alumia-o14-conta.sql");
ok("a migração termina trancando a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia", !/rede_alumia_versao/.test(sql));
ok("toda função que lê dado é security definer com search_path fixo (as puras não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = /interno\.(alumia_token_emitido|alumia_token_no_prazo|alumia_email_linguas)\(/;
  return funcoes.length >= 15 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || puras.test(f));
})());
ok("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?(interno|auth)\./i.test(sql));
ok("a tabela nova guarda só conta, sessão e horas (nenhum endereço, nenhum aparelho)", (() => {
  const t = /create table if not exists interno\.alumia_sessoes_cortadas \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "";
  return t && !/\bip\b|endereco|agente|user_agent|origem/.test(t.replace(/--.*$/gm, ""));
})());
ok("o endereço de rede do serviço de contas não sai do banco: só a contagem", !/->> ?'ip'|new\.ip|select [^;]*\bip\b[^;]* from auth/.test(sql));

// Os e-mails de conta: o tipo existe no envio (a fila é genérica: o envio não filtra por tipo) e o recado vai nas cinco outras línguas.
const envio = ler("supabase/functions/_shared/emails.mjs");
ok("o envio dos e-mails não tem lista de tipos (todo tipo novo sai)", !/tipo\s*===\s*["']alumia_|TIPOS_CONHECIDOS/.test(envio));
for (const tipo of ["alumia_entrada_nova", "codigo_recuperacao_usado", "alumia_apagamento", "alumia_termos_novos"]) {
  const bloco = new RegExp(`when '${tipo}' then([\\s\\S]*?)(?=\\n    when '|\\n    else)`).exec(sql)?.[1] ?? "";
  ok(`e-mail ${tipo}: recado em inglês, espanhol, francês, russo e chinês`, ["EN:", "ES:", "FR :", "RU:", "ZH："].every((m) => bloco.includes(m)) && /[Ѐ-ӿ]/.test(bloco) && /[一-鿿]/.test(bloco));
  ok(`e-mail ${tipo}: o texto em português usa o recado`, new RegExp(`alumia_email_linguas\\('${tipo}'\\)`).test(sql));
}
// Os modelos do serviço de contas que chegam a quem entra pela Alumia (confirmar o e-mail do cadastro e o convite) levam o mesmo recado
// nas cinco outras línguas, depois do português (o modelo não sabe o idioma da pessoa). O Jonathan cola em Authentication → Email Templates.
for (const modelo of ["confirmar-email", "convite"]) {
  const t = ler(`supabase/templates/${modelo}.html`);
  ok(`modelo ${modelo}: recado em inglês, espanhol, francês, russo e chinês`, ["en", "es", "fr", "ru", "zh"].every((l) => t.includes(`<p lang="${l}"`)) && /[Ѐ-ӿ]/.test(t) && /[一-鿿]/.test(t));
  ok(`modelo ${modelo}: o botão continua sendo o link do serviço de contas`, t.includes("{{ .ConfirmationURL }}"));
}

// ═══════════════════ 1. Banco e serviço de contas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const agora = () => Math.floor(Date.now() / 1000);
/** Chama uma função como a API faria: o token com a conta, a sessão, "iat" e "exp"; e os cabeçalhos do pedido. */
const rpc = (quem, funcao, argumentos = {}, cabecalhos = {}) =>
  banco.exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    const claims = JSON.stringify({
      role: quem.papel ?? "authenticated", ...(quem.sub ? { sub: quem.sub } : {}), aal: quem.aal ?? "aal2",
      ...(quem.sessao ? { session_id: quem.sessao } : {}), iat: quem.iat ?? agora() - 30, exp: quem.exp ?? agora() + 3600,
    });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, JSON.stringify(cabecalhos)]);
    await banco.pg.exec(`set role ${quem.papel === "anon" ? "anon" : quem.papel === "service_role" ? "service_role" : "authenticated"}`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, nomes.map((n) => argumentos[n]))).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });

await exec(`
  create table auth.sessions (
    id uuid primary key default gen_random_uuid(), user_id uuid not null, created_at timestamptz default now(), updated_at timestamptz default now(),
    factor_id uuid, aal text, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text);
  create table auth.refresh_tokens (
    id bigserial primary key, token varchar(255), user_id varchar(255), revoked boolean default false, created_at timestamptz default now(),
    session_id uuid references auth.sessions (id) on delete cascade);
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null, factor_type text default 'totp', created_at timestamptz default now());
  create table auth.mfa_challenges (id uuid primary key default gen_random_uuid(), factor_id uuid not null, created_at timestamptz not null default now(), ip_address inet not null);
  create table auth.audit_log_entries (instance_id uuid, id uuid primary key default gen_random_uuid(), payload json, created_at timestamptz default now(), ip_address varchar(64) not null default '');
`);

const P = {};
for (const nome of ["ana", "bia", "caio", "duda", "coord"]) {
  P[nome] = await criarUsuario(`${nome}@o14.local`, `Pessoa ${nome}`);
  await rpc({ sub: P[nome] }, "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia", "duda", "coord"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o14_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [P.coord]);

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
const trancou = await espera("a porta tranca tudo (nenhuma função aberta)", () => dono("select interno.alumia_trancar() as r"), (r) => (r.rows[0].r.abertas ?? []).length === 0);
void trancou;
const funcoes = (await dono(`
  select p.proname as nome, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as autenticado,
         p.prosrc like '%alumia_porta()%' as porta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('alumia_porta_entrou', 'alumia_painel_servico_de_contas', 'alumia_conta_aparelhos')`)).rows;
const fn = Object.fromEntries(funcoes.map((f) => [f.nome, f]));
ok("o aviso pelo servidor é só da chave de serviço", fn.alumia_porta_entrou && !fn.alumia_porta_entrou.anon && !fn.alumia_porta_entrou.autenticado);
ok("a Saúde e os aparelhos passam pela porta, visitante não chama", fn.alumia_painel_servico_de_contas?.porta && fn.alumia_conta_aparelhos?.porta && !fn.alumia_painel_servico_de_contas.anon && !fn.alumia_conta_aparelhos.anon);
ok("nenhuma função interna nova é chamável de fora", (await dono(`
  select bool_or(has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')) as algum
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno'
    and p.proname in ('alumia_cortar_sessoes', 'alumia_sessao_cortada', 'alumia_entrada_avisar', 'alumia_sessoes_apagaveis', 'alumia_painel_derrubar', 'vencer_sessoes')`)).rows[0].algum === false);

const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const novaSessao = async (usuario, agente, aal = "aal2") =>
  (await dono("insert into auth.sessions (user_id, user_agent, aal) values ($1, $2, $3) returning id", [usuario, agente, aal])).rows[0].id;
const avisosDe = async (u) => (await dono("select texto from interno.avisos where para = $1 and categoria = 'conta' order by criado_em", [u])).rows.map((r) => r.texto);
const emailsDe = async (u, tipo) => (await dono("select texto from interno.emails where para = $1 and tipo = $2", [`${u}@o14.local`, tipo])).rows.map((r) => r.texto);
const servico = { papel: "service_role" };

// ═══════════════════ 2. Aviso de entrada nova pelo servidor ═══════════════════
ok("o banco local não tem o gatilho de entrada nova (como no projeto que não deixa criar)", (await dono("select interno.alumia_entrada_gatilho() as g")).rows[0].g === false);
const s1 = await novaSessao(P.ana, FIREFOX);
await espera("sem o gatilho, o servidor avisa ao entrar pela porta", () => rpc(servico, "alumia_porta_entrou", { p_usuario: P.ana, p_sessao: s1, p_agente: FIREFOX }),
  (r) => r.avisou === true && r.por === "servidor");
ok("o aviso na conta tem o navegador e o sistema, sem endereço", (await avisosDe(P.ana)).length === 1 && (await avisosDe(P.ana))[0].includes("Firefox em Linux"));
await espera("o e-mail de entrada nova: português e as outras cinco línguas", () => emailsDe("ana", "alumia_entrada_nova"),
  (r) => r.length === 1 && r[0].includes("Firefox em Linux") && /EN: .*ES: .*FR : .*RU: .*ZH：/s.test(r[0]));
const s2 = await novaSessao(P.ana, FIREFOX);
await espera("o mesmo navegador em 15 minutos não avisa de novo", () => rpc(servico, "alumia_porta_entrou", { p_usuario: P.ana, p_sessao: s2, p_agente: FIREFOX }), (r) => r.avisou === false);
await recusa("quem não é o servidor não chama", () => rpc({ sub: P.ana, sessao: s1 }, "alumia_porta_entrou", { p_usuario: P.ana, p_sessao: s1, p_agente: FIREFOX }), "permission denied");
await espera("quem não está na Alumia não recebe", () => rpc(servico, "alumia_porta_entrou", { p_usuario: P.caio, p_sessao: null, p_agente: FIREFOX }), (r) => r.avisou === false);
await exec("create trigger alumia_sessao_nova after insert on auth.sessions for each row execute function interno.alumia_sessao_nova()");
await espera("com o gatilho, o servidor não repete o aviso", () => rpc(servico, "alumia_porta_entrou", { p_usuario: P.ana, p_sessao: s1, p_agente: CHROME }), (r) => r.avisou === false && r.por === "gatilho");
await novaSessao(P.ana, CHROME);
ok("e o gatilho avisa a entrada de outro navegador", (await avisosDe(P.ana)).length === 2 && (await avisosDe(P.ana))[1].includes("Chrome em Android"));
await exec("drop trigger alumia_sessao_nova on auth.sessions; delete from auth.sessions;");

// ═══════════════════ 3. Com permissão: o de antes continua ═══════════════════
const a1 = await novaSessao(P.ana, FIREFOX), a2 = await novaSessao(P.ana, CHROME);
await dono("insert into auth.refresh_tokens (token, user_id, session_id) values ('r1', $1, $2), ('r2', $1, $3)", [P.ana, a1, a2]);
await espera("desconectar os outros apaga a sessão no serviço de contas", () => rpc({ sub: P.ana, sessao: a1 }, "alumia_conta_desconectar"), (r) => r.desconectados === 1);
ok("sobrou só este aparelho e o token de renovação dele", (await dono("select (select count(*) from auth.sessions where user_id = $1)::int as s, (select count(*) from auth.refresh_tokens where user_id = $1::text)::int as t", [P.ana])).rows[0].s === 1);
await recusa("o token da sessão que saiu para na porta", () => rpc({ sub: P.ana, sessao: a2 }, "alumia_conta_situacao"), "alumia_entrada");
await espera("este aparelho passa", () => rpc({ sub: P.ana, sessao: a1 }, "alumia_conta_situacao"), (r) => r.sessoes === true);
await recusa("token vencido para na porta", () => rpc({ sub: P.ana, sessao: a1, exp: agora() - 5 }, "alumia_conta_situacao"), "alumia_entrada");
await espera("o pânico apaga tudo", () => rpc({ sub: P.ana, sessao: a1 }, "alumia_conta_panico", { p_esconder: false }), (r) => r.desconectados === 1);
const a3 = await novaSessao(P.ana, FIREFOX);
await espera("entrar de novo depois do pânico vale (token novo)", () => rpc({ sub: P.ana, sessao: a3, iat: agora() + 2 }, "alumia_conta_situacao"), (r) => r !== null);

// ═══════════════════ 4. Fase A: o banco lê as sessões, mas não apaga ═══════════════════
await exec(`
  create function auth.negar() returns trigger language plpgsql as $$ begin raise exception 'permission denied for table %', tg_table_name using errcode = '42501'; end $$;
  create trigger negar before delete on auth.sessions for each statement execute function auth.negar();
  create trigger negar before delete on auth.refresh_tokens for each statement execute function auth.negar();
  create trigger negar before delete on auth.mfa_factors for each statement execute function auth.negar();
`);
await exec("delete from interno.alumia_sessoes_cortadas");
const b1 = await novaSessao(P.bia, FIREFOX), b2 = await novaSessao(P.bia, CHROME), b3 = await novaSessao(P.bia, EDGE);
const bia = (sessao, extra = {}) => ({ sub: P.bia, sessao, ...extra });
await espera("antes: o outro aparelho passa", () => rpc(bia(b2), "alumia_conta_situacao"), (r) => r !== null);
await espera("desconectar os outros não quebra sem permissão de apagar", () => rpc(bia(b1), "alumia_conta_desconectar"), (r) => r.ok === true && r.desconectados === 2);
ok("as sessões continuam no serviço de contas (quem apaga é o servidor)", (await dono("select count(*)::int as n from auth.sessions where user_id = $1", [P.bia])).rows[0].n === 3);
await recusa("mas o token já emitido do outro aparelho para na porta", () => rpc(bia(b2), "alumia_conta_situacao"), "alumia_entrada");
await espera("este aparelho continua", () => rpc(bia(b1), "alumia_conta_situacao"), (r) => r !== null);
await espera("token renovado depois do corte passa (o servidor encerra a sessão no serviço de contas; é a reserva)", () => rpc(bia(b2, { iat: agora() + 2 }), "alumia_conta_situacao"), (r) => r !== null);
await espera("desconectar UM aparelho corta a sessão, mesmo com o token renovado", () => rpc(bia(b1), "alumia_conta_desconectar", { p_sessao: b3 }), (r) => r.desconectados === 1);
await recusa("o token renovado da sessão cortada para na porta", () => rpc(bia(b3, { iat: agora() + 5 }), "alumia_conta_situacao"), "alumia_entrada");
await espera("o pânico não quebra sem permissão de apagar", () => rpc(bia(b1), "alumia_conta_panico", { p_esconder: true }), (r) => r.ok === true && r.escondido === true);
await recusa("e o token de antes do pânico para na porta", () => rpc(bia(b1), "alumia_conta_situacao"), "alumia_entrada");
await espera("o pânico do painel da equipe também não quebra", () => rpc({ sub: P.duda, sessao: null }, "panico", { p_motivo: "teste" }), (r) => r.ok === true);
await espera("a derrubada pelo painel diz que não apagou, sem erro", () => dono("select interno.alumia_painel_derrubar($1) as r", [P.caio]), (r) => r.rows[0].r === false);
await dono("update auth.sessions set updated_at = now() - interval '400 days', created_at = now() - interval '400 days' where id = $1", [b2]);
await espera("o vencimento das sessões não quebra a entrada da equipe", () => dono("select interno.vencer_sessoes() as n"), (r) => r.rows[0].n === 0);

// O código de recuperação com o aplicativo que o banco não pode apagar.
await dono("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [P.duda]);
const d1 = await novaSessao(P.duda, FIREFOX);
const duda = (sessao, aal = "aal2") => ({ sub: P.duda, sessao, aal });
const gerados = await espera("gera os códigos", () => rpc(duda(d1), "conta_codigos_gerar"), (r) => r.codigos.length === 10);
const d2 = await novaSessao(P.duda, CHROME, "aal1");
const restam = async () => (await dono("select count(*)::int as n from interno.codigos_recuperacao where usuario = $1 and usado_em is null", [P.duda])).rows[0].n;
await espera("chamado direto, sem poder tirar o aplicativo: não gasta o código", () => rpc(duda(d2, "aal1"), "conta_codigo_usar", { p_codigo: gerados?.codigos[0] }),
  (r) => r.ok === false && r.motivo === "pelo_servidor");
ok("o código continua valendo", (await restam()) === 10);
await espera("o cabeçalho de antes, posto por quem chama direto, não gasta o código", () =>
  rpc(duda(d2, "aal1"), "conta_codigo_usar", { p_codigo: gerados?.codigos[0] }, { "x-alumia-fator": "servidor" }), (r) => r.ok === false && r.motivo === "pelo_servidor");
ok("e o código continua valendo", (await restam()) === 10);
await recusa("a função do servidor não é da pessoa", () => rpc(duda(d2, "aal1"), "conta_codigo_usar_pelo_servidor", { p_usuario: P.duda, p_sessao: d2, p_codigo: gerados?.codigos[0] }), "permission denied");
await espera("pela chave de serviço, código errado não vale", () => rpc(servico, "conta_codigo_usar_pelo_servidor", { p_usuario: P.duda, p_sessao: d2, p_codigo: "00000-00000" }),
  (r) => r.ok === false && r.motivo === "codigo_invalido");
await espera("pelo servidor (que tira o aplicativo pelo serviço de contas): gasta e avisa que falta tirar", () =>
  rpc(servico, "conta_codigo_usar_pelo_servidor", { p_usuario: P.duda, p_sessao: d2, p_codigo: gerados?.codigos[0] }), (r) => r.ok === true && r.fator_pendente === true && Number(r.restantes) === 9);
await espera("o mesmo código não vale de novo pelo servidor", () => rpc(servico, "conta_codigo_usar_pelo_servidor", { p_usuario: P.duda, p_sessao: d2, p_codigo: gerados?.codigos[0] }),
  (r) => r.ok === false && r.motivo === "codigo_invalido");
await recusa("e os outros aparelhos param na porta", () => rpc(duda(d1), "alumia_conta_situacao"), "alumia_entrada");
ok("o e-mail de código usado leva as seis línguas", (await emailsDe("duda", "codigo_recuperacao_usado")).some((t) => /EN: .*ZH：/s.test(t)));

// ═══════════════════ 5. Fase B: o banco nem lê as sessões ═══════════════════
await exec(`
  drop trigger negar on auth.sessions;
  alter table auth.sessions rename to sessions_real;
  create function auth.sessoes_negadas() returns setof auth.sessions_real language plpgsql as $$
    begin raise exception 'permission denied for table sessions' using errcode = '42501'; end $$;
  create view auth.sessions as select * from auth.sessoes_negadas();
  create trigger negar instead of delete on auth.sessions for each row execute function auth.negar();
`);
await exec("delete from interno.alumia_sessoes_cortadas");
ok("o banco sabe que não lê as sessões", (await dono("select interno.alumia_sessoes_legiveis() as l")).rows[0].l === false);
const e1 = "aaaaaaaa-0000-4000-8000-000000000001", e2 = "aaaaaaaa-0000-4000-8000-000000000002";
const ana = (sessao, extra = {}) => ({ sub: P.ana, sessao, ...extra });
await espera("sessão no prazo passa (pela conferência do token)", () => rpc(ana(e1), "alumia_conta_situacao"), (r) => r.sessoes === false);
await recusa("token vencido NÃO passa em silêncio", () => rpc(ana(e1, { exp: agora() - 1 }), "alumia_conta_situacao"), "alumia_entrada");
await espera("a lista de aparelhos responde indisponível, sem erro", () => rpc(ana(e1), "alumia_conta_aparelhos"), (r) => r.disponivel === false && r.aparelhos.length === 0);
await espera("desconectar os outros não quebra", () => rpc(ana(e1), "alumia_conta_desconectar"), (r) => r.ok === true && r.desconectados === 0);
await recusa("e o token do outro aparelho para na porta", () => rpc(ana(e2), "alumia_conta_situacao"), "alumia_entrada");
await espera("este continua", () => rpc(ana(e1), "alumia_conta_situacao"), (r) => r !== null);
await espera("o pânico não quebra", () => rpc(ana(e1), "alumia_conta_panico", { p_esconder: false }), (r) => r.ok === true);
await recusa("e o token deste aparelho também para", () => rpc(ana(e1), "alumia_conta_situacao"), "alumia_entrada");
await espera("sem ler as sessões, o aviso de entrada nova sai pelo servidor", () => rpc(servico, "alumia_porta_entrou", { p_usuario: P.bia, p_sessao: e1, p_agente: EDGE }), (r) => r.avisou === true);
await espera("e não repete o mesmo navegador em 15 minutos (pelo aviso da conta)", () => rpc(servico, "alumia_porta_entrou", { p_usuario: P.bia, p_sessao: e2, p_agente: EDGE }), (r) => r.avisou === false);
await espera("outro navegador avisa", () => rpc(servico, "alumia_porta_entrou", { p_usuario: P.bia, p_sessao: e2, p_agente: CHROME }), (r) => r.avisou === true);

// ═══════════════════ 6. A Saúde do painel ═══════════════════
const coord = { sub: P.coord, sessao: null };
const saude = await espera("a coordenação lê a saúde do serviço de contas", () => rpc(coord, "alumia_painel_servico_de_contas"),
  (r) => r.sessoes_legiveis === false && r.aviso_de_entrada === "servidor" && "sessoes_apagaveis" in r && r.enderecos && "mfa_challenges" in r.enderecos);
if (saude) {
  ok("sem leitura, a tabela de sessões diz que não dá para conferir o endereço", saude.enderecos.sessions?.com_endereco === null);
  ok("a contagem de cortes só aparece a partir de 3", saude.cortes_em_vigor === "menos de 3" || Number(saude.cortes_em_vigor) >= 3);
  ok("a saúde não traz endereço, conta nem sessão", !/\d+\.\d+\.\d+\.\d+|[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(saude)));
}
await dono("insert into auth.mfa_challenges (factor_id, ip_address) values (gen_random_uuid(), '192.0.2.40')");
await espera("tabela sem o gatilho que zera: a Saúde mostra quantas linhas têm endereço", async () => {
  await dono("drop trigger if exists alumia_sem_endereco on auth.mfa_challenges");
  await dono("insert into auth.mfa_challenges (factor_id, ip_address) values (gen_random_uuid(), '192.0.2.41')");
  return rpc(coord, "alumia_painel_servico_de_contas");
}, (r) => r.enderecos.mfa_challenges.gatilho === false && r.enderecos.mfa_challenges.com_endereco >= 1 && !JSON.stringify(r).includes("192.0.2"));
await recusa("quem não tem o painel não lê", () => rpc(bia(e1), "alumia_painel_servico_de_contas"), "sem_permissao");
await recusa("visitante não chama", () => rpc({ papel: "anon" }, "alumia_painel_servico_de_contas"), "permission denied");

// ═══════════════════ 7. E-mails de apagamento e de termos novos ═══════════════════
await espera("o pedido de apagamento manda e-mail com o prazo e as seis línguas", async () => {
  await dono("insert into interno.alumia_apagamentos (usuario, apagar_em) values ($1, now() + interval '7 days')", [P.caio]).catch(() => null);
  await dono("insert into interno.alumia_apagamentos (usuario, apagar_em) values ($1, now() + interval '7 days') on conflict do nothing", [P.ana]);
  return emailsDe("ana", "alumia_apagamento");
}, (r) => r.length === 1 && /apagada de vez em \d{2}\/\d{2}\/\d{4}/.test(r[0]) && /EN: .*ES: .*FR : .*RU: .*ZH：/s.test(r[0]));
await espera("termos novos: e-mail para quem aceitou a versão anterior (e não para quem não está na Alumia), sem link no que mudou", async () => {
  await dono("insert into interno.alumia_termos_aceites (usuario, versao, como) values ($1, 1, 'cadastro'), ($2, 1, 'cadastro') on conflict do nothing", [P.bia, P.duda]);
  await dono("insert into interno.alumia_termos (versao, publicada_em, mudou) values (2, current_date, 'O prazo do recurso: https://exemplo.invalid agora é de 30 dias.') on conflict do nothing");
  return { bia: await emailsDe("bia", "alumia_termos_novos"), caio: await emailsDe("caio", "alumia_termos_novos") };
}, (r) => r.bia.length === 1 && r.caio.length === 0 && /aceite de novo/.test(r.bia[0]) && !r.bia[0].includes("https://exemplo") && /ZH：/.test(r.bia[0]));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
