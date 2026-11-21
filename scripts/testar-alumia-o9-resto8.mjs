// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 9F (o que a onda 8 deixou): supabase/migracoes/20261115-alumia-o9-resto8.sql num Postgres de verdade
// (scripts/banco-local.mjs), rodada DUAS vezes sobre o install.sql, e as rotas do servidor com um dublê do serviço de contas:
//   porta      entrar, reenviar a confirmação e o esqueci a senha pelo servidor, com a prova de trabalho e o freio; a conta criada
//              pela API de administração (nunca pelo cadastro público); nenhum desafio de terceiros no site nem na política;
//   endereço   public.conta_atividade não devolve o endereço de rede (nem nenhuma função public lê o endereço do serviço de contas);
//   avaliação  nenhum post da Alumia vai para a avaliação de fora, ligada ou não (nem pela triagem, nem pela entrega do texto,
//              nem pela lista de pendentes, nem pela função de borda, nem pela tela);
//   sair       "sair só da Alumia" tira a pessoa da rede e deixa a conta do Instituto; conta_apagar deixa "[post apagado]";
//   voto       a cédula cifrada abre só no servidor e só fechada; a votação secreta da equipe, a enquete de post, a de story e o
//              termômetro guardam a marca do servidor, nunca a pessoa. O teste faz o papel de quem lê o banco inteiro e TENTA casar
//              pessoa e voto: pelo id, pela marca recalculada com o sal do banco, pelo xmin, pelo freio. E não consegue.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o9-resto8.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));

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
const sql = ler("supabase/migracoes/20261115-alumia-o9-resto8.sql");
ok("toda função security definer da migração tem search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 30 && funcoes.filter((f) => /security definer/.test(f)).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a migração não lê nem guarda endereço de rede", !/x-forwarded-for|cf-connecting-ip|\binet\b|ip_address|interno\.origem\(\)/i.test(sql));
ok("as urnas sorteiam com gen_random_uuid", (sql.match(/order by gen_random_uuid\(\)/g) ?? []).length >= 8);

const fonte = (c) => (existe(c) ? ler(c) : "");
const telas = ["components/SignIn.tsx", "components/rede/entrada/Formularios.tsx", "components/rede/consertos/EsqueciASenha.tsx", "lib/passkey.ts", "lib/backend.ts", "next.config.ts"].map(fonte).join("\n");
// Decisão de 13/11: o Turnstile VOLTA (a Cloudflare já está na frente do site), junto da prova própria, conferido no servidor.
ok("o componente do desafio da Cloudflare existe e só carrega de challenges.cloudflare.com", existe("components/Captcha.tsx")
  && /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/.test(fonte("components/Captcha.tsx")));
ok("as telas de entrar, criar conta, reenviar e esqueci desenham o desafio e mandam a resposta ao servidor",
  ["components/SignIn.tsx", "components/rede/entrada/Formularios.tsx", "components/rede/consertos/EsqueciASenha.tsx"].every((c) => /<Captcha /.test(fonte(c)) && /turnstile: desafio\.token/.test(fonte(c))));
ok("a política de segurança: a única exceção é challenges.cloudflare.com, e só com a chave pública",
  /const captcha = process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY \? " https:\/\/challenges\.cloudflare\.com" : ""/.test(fonte("next.config.ts"))
  && (fonte("next.config.ts").match(/[a-z0-9.-]*cloudflare\.com/g) ?? []).every((h) => h === "challenges.cloudflare.com"));
ok("a montagem repassa a chave pública do desafio; a secreta não aparece no navegador nem na montagem",
  /NEXT_PUBLIC_TURNSTILE_SITE_KEY/.test(fonte(".github/workflows/producao.yml")) && !/TURNSTILE_SECRET_KEY/.test(fonte(".github/workflows/producao.yml") + telas + fonte("components/Captcha.tsx") + fonte("lib/rede/convites/cliente.ts")));
ok("as três rotas da porta conferem o desafio no servidor antes do resto", ["conta", "entrar", "aviso"].every((r) => /conferirDesafioDaCloudflare\(c\?\.turnstile\)/.test(fonte(`app/api/alumia/porta/${r}/route.ts`))));
ok("a conferência não manda o endereço de rede de quem pediu", !/remoteip|cf-connecting-ip|x-forwarded-for/i.test(fonte("lib/rede/convites/turnstile.ts").replace(/^\/\/.*$/gm, "")));
ok("entrar, reenviar e esqueci passam pelo servidor (Alumia e site)", /entrarPelaPorta/.test(fonte("components/SignIn.tsx")) && /avisoPelaPorta/.test(fonte("components/SignIn.tsx"))
  && /entrarPelaPorta/.test(fonte("components/rede/entrada/Formularios.tsx")) && /avisoPelaPorta/.test(fonte("components/rede/consertos/EsqueciASenha.tsx"))
  && /criarContaPelaPorta/.test(fonte("components/SignIn.tsx")));
ok("o cadastro do site não chama mais o cadastro público fora da cópia local", (() => {
  const t = fonte("components/SignIn.tsx");
  const i = t.indexOf("supabase.auth.signUp(");
  return i > 0 && /if \(localBackend\) \{\s*const supabase = await getClient\(\);\s*const \{ data, error \} = await supabase\.auth\.signUp\(/.test(t);
})());
ok("a conta nasce pela API de administração, com a chave de serviço só no servidor", /\/admin\/users/.test(fonte("app/api/alumia/porta/conta/route.ts")) && !/\/signup/.test(fonte("app/api/alumia/porta/conta/route.ts")));
ok("as contas extras também usam a API de administração", /\/auth\/v1\/admin\/users/.test(fonte("lib/rede/contas-extra.ts")));
ok("nenhum arquivo do navegador lê a chave de serviço", ["components/SignIn.tsx", "components/rede/entrada/Formularios.tsx", "lib/rede/convites/cliente.ts", "lib/rede/voto/cliente.ts", "lib/rede/voto/cedula.ts"].every((c) => !/SERVICE_ROLE|ALUMIA_VOTO_SEGREDO|ALUMIA_IMPRESSAO_SEGREDO/.test(fonte(c))));
ok("a função de avaliação de fora recusa post da Alumia", (() => {
  const t = fonte("supabase/functions/avaliar-comunidade/index.ts");
  return /const TIPOS = \["topico", "resposta", "comentario", "aula_chat"\];/.test(t) && !/"aula_chat", "rede"/.test(t) && /if \(!TIPOS\.includes\(String\(qual\)\)\) return "ignorado";/.test(t);
})());
ok("nenhuma tela pede a avaliação de fora para post", (() => {
  const busca = (dir) => fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? busca(path.join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [path.join(dir, d.name)] : []));
  return [...busca("components"), ...busca("app"), ...busca("lib")].every((c) => !/evaluatePost\(\s*["']rede["']/.test(ler(c)));
})());
ok("a atividade da conta não mostra endereço de rede", !/\bIP \{e\.ip\}/.test(fonte("components/painel/MinhaConta.tsx")));

// ═══════════════════ 1. Banco e pessoas (antes da migração, para provar as conversões) ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await dono(t, v)).rows[0];
const linhas = async (t, v = []) => (await dono(t, v)).rows;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const agora = () => Math.floor(Date.now() / 1000);
let ip = 10;
const como = (sub, fator = null) => ({ papel: "authenticated", sub, fator, ip: `198.51.100.${ip++ % 250}` });
/** Como banco.rpc, com "amr" no token (o segundo fator confirmado há `fator` segundos). */
const chamar = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const amr = [{ method: "password", timestamp: agora() - 3600 }, ...(quem.fator === null || quem.fator === undefined ? [] : [{ method: "totp", timestamp: agora() - quem.fator }])];
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [JSON.stringify({ role: "authenticated", sub: quem.sub, aal: "aal2", amr }), JSON.stringify({ "x-forwarded-for": quem.ip })]);
    await banco.pg.exec("set role authenticated");
    try {
      const nomes = Object.keys(argumentos);
      const valores = nomes.map((n) => (argumentos[n] !== null && typeof argumentos[n] === "object" && !Array.isArray(argumentos[n]) ? JSON.stringify(argumentos[n]) : argumentos[n]));
      return (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
/** Uma função public chamada com a chave de serviço (o servidor do site). */
const servico = (funcao, argumentos = {}) => rpc({ papel: "service_role" }, funcao, argumentos);

const nomes = ["dona", "amiga", "outra", "coord", "org", "v1", "v2", "v3", "v4", "v5", "e1", "e2", "e3", "e4", "apaga", "responde"];
const P = {};
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o9.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3, rede_bio = 'bio da rede' where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o9`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
for (const e of ["e1", "e2", "e3", "e4"]) await dono("insert into interno.papeis (usuario, papel) values ($1, 'curadoria')", [P[e]]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");

// Uma enquete de post com um voto de antes (a pessoa e a opção na mesma linha, como era).
const ENQ = (await um("insert into interno.rede_posts (autor, texto, tipo, publico) values ($1, 'Qual dia para a assembleia?', 'enquete', 'membros') returning id", [P.dona])).id;
await dono("insert into interno.rede_enquetes (post, prazo, multipla) values ($1, now() + interval '1 day', false)", [ENQ]);
const OP = [];
for (const [i, t] of ["Terça", "Quinta", "Sábado"].entries()) OP.push((await um("insert into interno.rede_opcoes (enquete, texto, ordem) values ($1, $2, $3) returning id", [ENQ, t, i])).id);
await dono("insert into interno.rede_votos (opcao, usuario) values ($1, $2)", [OP[0], P.v1]);

// Um story com enquete e um voto de antes.
for (const n of ["v1", "v2", "v3", "v4", "v5", "amiga"]) await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P[n], P.dona]);
const STORY = (await um("insert into interno.rede_stories (autor, publico, texto, expira_em) values ($1, 'seguidores', 'PLENÁRIA', now() + interval '20 hours') returning id", [P.dona])).id;
await dono("insert into interno.rede_story_figurinhas (story, ordem, tipo, dados) values ($1, 0, 'enquete', $2)", [STORY, JSON.stringify({ pergunta: "Vai ter ônibus?", opcoes: ["Sim", "Não"] })]);
await dono("insert into interno.rede_story_votos (story, quem, opcao) values ($1, $2, 1)", [STORY, P.v1]);

// Um post da Alumia que esperava a avaliação de fora.
const ESPERANDO = (await um("insert into interno.rede_posts (autor, texto, retido, oculto, motivo, avaliacao) values ($1, 'Texto que esperava avaliação', true, true, 'aguardando_avaliacao', 'revisao') returning id", [P.outra])).id;

// ═══════════════════ 2. A migração ═══════════════════
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_*/alumia_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("as funções do servidor só aceitam a chave de serviço", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('alumia_porta_pressao', 'alumia_porta_passar', 'alumia_porta_entrada', 'alumia_voto_cifradas', 'alumia_voto_apurar', 'alumia_voto_equipe', 'alumia_voto_equipe_votei', 'alumia_voto_enquete', 'alumia_voto_story', 'alumia_cuidado_bem_estar')
    and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute'))`), (l) => l.length === 0);
await espera("as funções de membro novas passam pela porta", () => um(`select pg_get_functiondef('public.rede_meusdados_sair(text)'::regprocedure) as s,
    pg_get_functiondef('public.rede_org_consulta_votar_cifrada(uuid, text)'::regprocedure) as c`), (r) => r.s.includes("alumia_porta") && r.c.includes("alumia_porta"));
await recusa("quem tem sessão não chama a função do servidor", () => chamar(como(P.v2), "alumia_voto_enquete", { p_usuario: P.v2, p_post: ENQ, p_opcoes: [OP[1]], p_marca: "a".repeat(64) }), "permission denied");

// Daqui em diante, um erro inesperado vira falha (e o resto do relatório ainda sai).
try {
// ═══════════════════ 3. A porta: o freio de entrar e de aviso ═══════════════════
{
  const selo = () => createHash("sha256").update(String(Math.random())).digest("hex");
  const vence = new Date(Date.now() + 5 * 60_000).toISOString();
  const chave = createHash("sha256").update("rede-de-teste").digest("hex");
  await recusa("a porta nova só aceita a chave de serviço", () => chamar(como(P.v2), "alumia_porta_passar", { p_momento: "entrar", p_chave: chave, p_selo: selo(), p_vence: vence }), "permission denied");
  const s1 = selo();
  await espera("entrar: o desafio passa uma vez", () => servico("alumia_porta_passar", { p_momento: "entrar", p_chave: chave, p_selo: s1, p_vence: vence }), (r) => r.ok === true);
  await espera("o mesmo desafio não vale duas vezes", () => servico("alumia_porta_passar", { p_momento: "entrar", p_chave: chave, p_selo: s1, p_vence: vence }), (r) => r.ok === false && r.motivo === "desafio_usado");
  // A chave do freio já traz o momento dentro (lib/rede/convites/prova-servidor.ts): "aviso" tem a dela.
  const chaveAviso = createHash("sha256").update("rede-de-teste:aviso").digest("hex");
  let ultimo;
  for (let i = 0; i < 6; i++) ultimo = await servico("alumia_porta_passar", { p_momento: "aviso", p_chave: chaveAviso, p_selo: selo(), p_vence: vence });
  await espera("aviso: o sexto da mesma rede na hora ainda passa", async () => ultimo, (r) => r.ok === true);
  await espera("aviso: o sétimo para no freio", () => servico("alumia_porta_passar", { p_momento: "aviso", p_chave: chaveAviso, p_selo: selo(), p_vence: vence }), (r) => r.ok === false && r.motivo === "muitos_pedidos");
  await espera("sem impressão, o freio não junta todo mundo num balde (só o desafio vale)", () => servico("alumia_porta_passar", { p_momento: "entrar", p_chave: null, p_selo: selo(), p_vence: vence }), (r) => r.ok === true);
  await espera("a pressão diz quantas vezes a rede passou", () => servico("alumia_porta_pressao", { p_chave: chaveAviso, p_momento: "aviso" }), (r) => r.rede === 7 && r.rede_teto === 6);
  await recusa("momento que não existe", () => servico("alumia_porta_passar", { p_momento: "conta", p_chave: chave, p_selo: selo(), p_vence: vence }), "invalido:momento");
  await espera("o freio guarda só o resumo da rede (nada de endereço)", () => linhas("select chave from interno.alumia_cadastro_freio"), (l) => l.every((x) => /^[0-9a-f]{64}$/.test(x.chave)));
}

// ═══════════════════ 3.1 O bloqueio da conta no banco, por qualquer caminho ═══════════════════
{
  const EMAIL = "Alvo.Da.Senha@o9.local";
  await recusa("o bloqueio da conta só pela chave de serviço", () => chamar(como(P.v2), "alumia_porta_entrada", { p_email: EMAIL, p_passo: "conferir" }), "permission denied");
  await recusa("o gancho não se chama pela API", () => chamar(como(P.v2), "alumia_porta_gancho_senha", { event: { user_id: P.v2, valid: false } }), "permission denied");
  await espera("conta sem erro: aberta", () => servico("alumia_porta_entrada", { p_email: EMAIL, p_passo: "conferir" }), (r) => r.bloqueado === false);
  let ultimo;
  for (let i = 0; i < 9; i++) ultimo = await servico("alumia_porta_entrada", { p_email: EMAIL, p_passo: "falhou" });
  await espera("nove erros: ainda aberta", async () => ultimo, (r) => r.bloqueado === false);
  await espera("o décimo erro fecha a conta por uns 15 minutos (maiúsculas e espaços não mudam a conta)", () => servico("alumia_porta_entrada", { p_email: " alvo.da.senha@o9.local ", p_passo: "falhou" }),
    (r) => r.bloqueado === true && r.segundos > 800 && r.segundos <= 900);
  await espera("o erro guarda só o resumo do e-mail e a hora (nada de endereço, nada de id)", () => linhas("select * from interno.alumia_entrada_erros"),
    (l) => l.length === 10 && l.every((x) => Object.keys(x).sort().join() === "conta,quando" && /^[0-9a-f]{32}$/.test(x.conta) && !JSON.stringify(x).includes("alvo")));
  // O gancho do serviço de contas (o caminho direto da API, que pula o site): a mesma conta fechada recusa até a senha certa.
  const idAlvo = (await um("select id from auth.users where id = $1", [P.v3])).id;
  const emailAlvo = (await um("select email from auth.users where id = $1", [idAlvo])).email;
  await espera("o gancho deixa a senha certa passar com a conta aberta", () => um("select public.alumia_porta_gancho_senha($1::jsonb) as r", [JSON.stringify({ user_id: idAlvo, valid: true })]), (x) => x.r.decision === "continue");
  for (let i = 0; i < 9; i++) await um("select public.alumia_porta_gancho_senha($1::jsonb) as r", [JSON.stringify({ user_id: idAlvo, valid: false })]);
  await espera("o décimo erro pela API direta fecha a conta", () => um("select public.alumia_porta_gancho_senha($1::jsonb) as r", [JSON.stringify({ user_id: idAlvo, valid: false })]), (x) => x.r.decision === "reject" && /tentativas/.test(x.r.message));
  await espera("fechada, nem a senha certa entra", () => um("select public.alumia_porta_gancho_senha($1::jsonb) as r", [JSON.stringify({ user_id: idAlvo, valid: true })]), (x) => x.r.decision === "reject");
  await espera("e o site vê a mesma conta fechada", () => servico("alumia_porta_entrada", { p_email: emailAlvo, p_passo: "conferir" }), (r) => r.bloqueado === true);
  await dono("update interno.alumia_entrada_erros set quando = quando - interval '16 minutes'");
  await espera("passados os 15 minutos, a senha certa entra e limpa os erros", async () => [(await um("select public.alumia_porta_gancho_senha($1::jsonb) as r", [JSON.stringify({ user_id: idAlvo, valid: true })])).r,
    (await um("select count(*)::int n from interno.alumia_entrada_erros where conta = md5('conta:' || lower($1))", [emailAlvo])).n], ([r, n]) => r.decision === "continue" && n === 0);
  await espera("entrar pelo site com a senha certa limpa os erros da conta", () => servico("alumia_porta_entrada", { p_email: EMAIL, p_passo: "certa" }).then(() => servico("alumia_porta_entrada", { p_email: EMAIL, p_passo: "conferir" })), (r) => r.bloqueado === false);
  await espera("conta que não existe: o gancho não faz nada", () => um("select public.alumia_porta_gancho_senha($1::jsonb) as r", [JSON.stringify({ user_id: "00000000-0000-4000-8000-000000000000", valid: false })]), (x) => x.r.decision === "continue");
  await dono("delete from interno.alumia_entrada_erros");
}

// ═══════════════════ 4. A atividade da conta sem endereço de rede ═══════════════════
{
  await dono(`create table if not exists auth.audit_log_entries (instance_id uuid, id uuid primary key default gen_random_uuid(), payload json, created_at timestamptz default now(), ip_address varchar(64) not null default '')`);
  await dono("insert into auth.audit_log_entries (payload, ip_address) values ($1, '203.0.113.77')", [JSON.stringify({ actor_id: P.dona, action: "login" })]);
  const r = await espera("conta_atividade traz a entrada", () => chamar(como(P.dona), "conta_atividade"), (l) => Array.isArray(l) && l.some((x) => x.acao === "auth:login"));
  ok("e não traz o endereço de rede, nem a chave", r && !JSON.stringify(r).includes("203.0.113.77") && r.every((x) => !("ip" in x)));
  // A Saúde do serviço de contas (20261120-alumia-o14-conta.sql) é a exceção: ela só CONTA as linhas com endereço, para a
  // coordenação saber que o Auth ainda grava um; nenhum endereço sai dela (conferido logo abaixo).
  await espera("nenhuma função public lê o endereço que o serviço de contas guarda", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname <> 'alumia_painel_servico_de_contas'
      and (p.prosrc ~* 'ip_address' or p.prosrc ~* '''ip''\\s*,')`), (l) => l.length === 0);
  await espera("a Saúde do serviço de contas só conta as linhas com endereço", () => linhas(`select p.prosrc from pg_proc p
      where p.oid = to_regprocedure('public.alumia_painel_servico_de_contas()')`),
    (l) => l.length === 0 || (/select count\(\*\)::integer from auth\.%I where %s/.test(l[0].prosrc) && (l[0].prosrc.match(/execute /g) ?? []).length === 1));
}

// ═══════════════════ 5. Nenhum post da Alumia vai para a avaliação de fora ═══════════════════
{
  await dono(`insert into interno.configuracoes (chave, valor) values ('comunidade', '{"avaliacao_externa": true}'::jsonb)
              on conflict (chave) do update set valor = interno.configuracoes.valor || '{"avaliacao_externa": true, "aprovacao_manual": false}'::jsonb`);
  await espera("com a avaliação de fora LIGADA, a triagem da Alumia não marca post para ela", () => um("select interno.rede_triagem('Texto tranquilo sobre a assembleia de amanhã', $1) as r", [P.dona]), (x) => x.r.externa === false);
  await espera("o post que esperava foi para a leitura da equipe (continua retido)", () => um("select motivo, retido, oculto from interno.rede_posts where id = $1", [ESPERANDO]), (x) => x.motivo === "leitura_humana" && x.retido && x.oculto);
  await dono("update interno.rede_posts set motivo = 'aguardando_avaliacao' where id = $1", [ESPERANDO]);
  await espera("a entrega do texto devolve nada para post da Alumia", () => servico("comunidade_para_avaliar", { p_tipo: "rede", p_id: ESPERANDO }), (x) => x === null);
  await espera("e o post nem é marcado em avaliação", () => um("select motivo, tentativas from interno.rede_posts where id = $1", [ESPERANDO]), (x) => x.motivo === "aguardando_avaliacao" && x.tentativas === 0);
  await espera("a lista de pendentes não traz post da Alumia", () => servico("comunidade_pendentes"), (l) => Array.isArray(l) && l.every((x) => x.tipo !== "rede"));
}

// ═══════════════════ 6. Voto: a enquete de post ═══════════════════
const SEGREDO = "segredo-do-voto-para-o-teste-0123456789";
const { marcaDoVoto, marcaDoBemEstar, semanaDeSaoPaulo, chavePublicaDaConsulta, abrirCedula } = await import("../lib/rede/voto/servidor.ts");
const { cifrarCedula } = await import("../lib/rede/voto/cedula.ts");
const sal = (await um("select valor #>> '{}' as s from interno.configuracoes where chave = 'cuidado_sal'"))?.s ?? "";
/** Tudo o que o banco guarda, em texto: se o id de alguém aparece numa linha, ela liga a pessoa. */
const temId = (linhasDoBanco, id) => JSON.stringify(linhasDoBanco).includes(id);
{
  await espera("o voto de antes perdeu a pessoa (a linha ficou só com a opção)", () => linhas("select usuario from interno.rede_votos"), (l) => l.length === 1 && l[0].usuario === null);
  await espera("e virou só 'votou', sem a opção", () => linhas("select post, usuario from interno.rede_voto_antigos"), (l) => l.length === 1 && l[0].usuario === P.v1 && l[0].post === ENQ);
  await recusa("votar direto no banco não dá mais (a pessoa ficaria ligada ao voto)", () => chamar(como(P.v2), "rede_pub_enquete_votar", { p_post: ENQ, p_opcoes: [OP[1]] }), "voto_pelo_servidor");
  await recusa("quem votou antes não vota de novo", () => servico("alumia_voto_enquete", { p_usuario: P.v1, p_post: ENQ, p_opcoes: [OP[1]], p_marca: marcaDoVoto(SEGREDO, "enquete", ENQ, P.v1) }), "ja_votou");
  const limitesAntes = (await um("select count(*)::int n from interno.limites")).n;
  const r = await espera("votar pelo servidor devolve a minha escolha; com 2 votos, nem total nem votos por opção (número só a partir de 3)", () => servico("alumia_voto_enquete", { p_usuario: P.v2, p_post: ENQ, p_opcoes: [OP[1]], p_marca: marcaDoVoto(SEGREDO, "enquete", ENQ, P.v2) }),
    (e) => e.votou === true && e.votei[0] === OP[1] && e.total === null && e.poucos === true && e.opcoes.every((o) => o.votos === null));
  void r;
  await recusa("a mesma pessoa não vota duas vezes", () => servico("alumia_voto_enquete", { p_usuario: P.v2, p_post: ENQ, p_opcoes: [OP[2]], p_marca: marcaDoVoto(SEGREDO, "enquete", ENQ, P.v2) }), "ja_votou");
  for (const n of ["v3", "v4"]) await servico("alumia_voto_enquete", { p_usuario: P[n], p_post: ENQ, p_opcoes: [OP[2]], p_marca: marcaDoVoto(SEGREDO, "enquete", ENQ, P[n]) });
  await espera("com 4 votos, os números aparecem", () => um("select interno.rede3_pub_enquete_x(p, null, true) j from interno.rede_posts p where p.id = $1", [ENQ]),
    (x) => x.j.total >= 3 && x.j.poucos === false && x.j.opcoes.some((o) => typeof o.votos === "number"));
  await espera("o voto não grava freio com o id da pessoa (ligaria pelo xmin)", () => um("select count(*)::int n from interno.limites"), (x) => x.n === limitesAntes);
  const tudo = [...(await linhas("select xmin::text x, * from interno.rede_votos")), ...(await linhas("select xmin::text x, * from interno.rede_voto_marcas"))];
  ok("ninguém que votou depois aparece em linha nenhuma do voto (nem a marca é a pessoa)", ["v2", "v3", "v4"].every((n) => !temId(tudo, P[n])));
  const marcas = (await linhas("select marca from interno.rede_voto_marcas where post = $1", [ENQ])).map((m) => m.marca);
  const tentativa = nomes.map((n) => md5Sal(sal, ENQ, P[n]));
  ok("a marca não se refaz com o sal do banco (o banco não tem o segredo)", marcas.length === 3 && !marcas.some((m) => tentativa.includes(m) || nomes.some((n) => m.includes(P[n].replace(/-/g, "")))));
  const vot = await linhas("select v.xmin::text x, opcao from interno.rede_votos v join interno.rede_opcoes o on o.id = v.opcao where o.enquete = $1", [ENQ]);
  ok("as linhas do voto foram regravadas juntas (um xmin só): a ordem de chegada some", new Set(vot.map((v) => v.x)).size === 1 && vot.length === 4);
  await espera("quem não votou vê a enquete sem os totais e sem 'votou'", () => um("select interno.rede3_pub_enquete(p, $2) as r from interno.rede_posts p where p.id = $1", [ENQ, P.v5]), (x) => x.r.votou === false && x.r.total === null);
  await espera("a autora vê o total (antigos + novos)", () => um("select interno.rede3_pub_enquete(p, $2) as r from interno.rede_posts p where p.id = $1", [ENQ, P.dona]), (x) => x.r.total === 4);
}
function md5Sal(s, alvo, pessoa) {
  return createHash("md5").update(`${s}:voto:${alvo}:${pessoa}`).digest("hex");
}

// ═══════════════════ 7. Voto: a enquete do story ═══════════════════
{
  await espera("o voto de antes no story perdeu a pessoa", () => linhas("select quem, opcao from interno.rede_story_votos"), (l) => l.length === 1 && l[0].quem === null && l[0].opcao === 1);
  await recusa("votar direto no banco não dá mais", () => chamar(como(P.v2), "rede_story_votar", { p_id: STORY, p_opcao: 0 }), "voto_pelo_servidor");
  await espera("quem votou antes recebe a figurinha, sem novo voto", () => servico("alumia_voto_story", { p_usuario: P.v1, p_story: STORY, p_opcao: 0, p_marca: marcaDoVoto(SEGREDO, "story", STORY, P.v1) }), (f) => f.ja_votou === true && f.meu_voto === null);
  for (const n of ["v2", "v3", "v4"]) await servico("alumia_voto_story", { p_usuario: P[n], p_story: STORY, p_opcao: 0, p_marca: marcaDoVoto(SEGREDO, "story", STORY, P[n]) });
  await espera("votar de novo não muda o voto", () => servico("alumia_voto_story", { p_usuario: P.v2, p_story: STORY, p_opcao: 1, p_marca: marcaDoVoto(SEGREDO, "story", STORY, P.v2) }), (f) => f.ja_votou === true);
  await espera("a autora vê a soma (3 de uma, 1 de outra)", () => um("select interno.rede5_story_figurinha(f, s, $2) as r from interno.rede_story_figurinhas f join interno.rede_stories s on s.id = f.story where f.story = $1", [STORY, P.dona]), (x) => JSON.stringify(x.r.soma) === "[3,1]");
  await recusa("a autora não vota na própria enquete", () => servico("alumia_voto_story", { p_usuario: P.dona, p_story: STORY, p_opcao: 0, p_marca: marcaDoVoto(SEGREDO, "story", STORY, P.dona) }), "sem_permissao");
  await recusa("quem não vê o story não vota", () => servico("alumia_voto_story", { p_usuario: P.outra, p_story: STORY, p_opcao: 0, p_marca: marcaDoVoto(SEGREDO, "story", STORY, P.outra) }), "nao_encontrado");
  const tudo = [...(await linhas("select * from interno.rede_story_votos")), ...(await linhas("select * from interno.rede_story_voto_marcas"))];
  ok("no story, ninguém que votou depois aparece nas linhas do voto", ["v2", "v3", "v4"].every((n) => !temId(tudo, P[n])));
}

// ═══════════════════ 8. Voto: a votação secreta da equipe ═══════════════════
{
  const VOT = (await um("insert into interno.votacoes (titulo, opcoes, secreta, encerra_em, criada_por) values ('Mudar a reunião para quinta?', array['Sim', 'Não'], true, now() + interval '2 days', $1) returning id", [P.coord])).id;
  const ABERTA = (await um("insert into interno.votacoes (titulo, opcoes, secreta, encerra_em, criada_por) values ('Voto aberto', array['Sim', 'Não'], false, now() + interval '2 days', $1) returning id", [P.coord])).id;
  await recusa("o voto secreto não entra direto pelo banco", () => chamar(como(P.e1, 60), "votar", { p_id: VOT, p_opcao: 0 }), "voto_pelo_servidor");
  await espera("o voto aberto continua direto pelo banco", () => chamar(como(P.e1, 60), "votar", { p_id: ABERTA, p_opcao: 1 }), (x) => x.ok === true);
  for (const [i, n] of ["e1", "e2", "e3", "coord"].entries()) {
    await espera(`${n} vota no secreto pelo servidor`, () => servico("alumia_voto_equipe", { p_usuario: P[n], p_votacao: VOT, p_opcao: i % 2, p_marca: marcaDoVoto(SEGREDO, "equipe", VOT, P[n]) }), (x) => x.ok === true);
  }
  await recusa("a mesma pessoa não vota duas vezes", () => servico("alumia_voto_equipe", { p_usuario: P.e1, p_votacao: VOT, p_opcao: 1, p_marca: marcaDoVoto(SEGREDO, "equipe", VOT, P.e1) }), "ja_votou");
  await recusa("quem não é da equipe não vota", () => servico("alumia_voto_equipe", { p_usuario: P.v5, p_votacao: VOT, p_opcao: 1, p_marca: marcaDoVoto(SEGREDO, "equipe", VOT, P.v5) }), "sem_permissao");
  await espera("quem votou NÃO está em votacao_votantes (só a marca)", () => linhas("select * from interno.votacao_votantes where votacao = $1", [VOT]), (l) => l.length === 0);
  const tudo = [...(await linhas("select * from interno.votacao_marcas where votacao = $1", [VOT])), ...(await linhas("select * from interno.votacao_votos where votacao = $1", [VOT]))];
  ok("ninguém que votou no secreto aparece nas linhas da votação", ["e1", "e2", "e3", "coord"].every((n) => !temId(tudo, P[n])));
  const marcas = (await linhas("select marca from interno.votacao_marcas where votacao = $1", [VOT])).map((m) => m.marca);
  ok("a marca da presença não se refaz com o sal do banco", marcas.length === 4 && nomes.every((n) => !marcas.includes(md5Sal(sal, VOT, P[n]))));
  await espera("o servidor sabe dizer em quais a pessoa votou (pela marca)", () => servico("alumia_voto_equipe_votei", { p_usuario: P.e2, p_marcas: { [VOT]: marcaDoVoto(SEGREDO, "equipe", VOT, P.e2) } }), (l) => l.length === 1 && l[0] === VOT);
  await espera("e não diz nada com a marca de outra pessoa", () => servico("alumia_voto_equipe_votei", { p_usuario: P.e4, p_marcas: { [VOT]: marcaDoVoto(SEGREDO, "equipe", VOT, P.e4) } }), (l) => l.length === 0);
  await espera("a lista conta quem votou (pelas marcas), sem dizer quem", () => chamar(como(P.coord, 60), "votacoes_listar"), (l) => l.find((v) => v.id === VOT)?.votantes === 4 && !JSON.stringify(l.find((v) => v.id === VOT)).includes(P.e1));
}

// ═══════════════════ 9. Voto: o termômetro da equipe ═══════════════════
{
  const semana = semanaDeSaoPaulo();
  await espera("a semana do servidor é a mesma do banco", () => um("select interno.semana_atual()::text s"), (x) => x.s === semana);
  await recusa("o termômetro não entra direto pelo banco", () => chamar(como(P.e1, 60), "bem_estar_responder", { p_nivel: 3 }), "pelo_servidor");
  const m = marcaDoBemEstar(SEGREDO, semana, P.e1);
  await espera("responder pelo servidor", () => servico("alumia_cuidado_bem_estar", { p_usuario: P.e1, p_semana: semana, p_marca: m, p_nivel: 4 }), (x) => x.ok === true);
  await espera("responder de novo na mesma semana não muda nada (mudar ligaria a marca ao nível)", () => servico("alumia_cuidado_bem_estar", { p_usuario: P.e1, p_semana: semana, p_marca: m, p_nivel: 2 }), (x) => x.ok === true && x.ja_respondeu === true);
  await espera("perguntar se já respondeu", () => servico("alumia_cuidado_bem_estar", { p_usuario: P.e1, p_semana: semana, p_marca: m, p_nivel: null }), (x) => x.respondeu === true);
  await recusa("quem não é da equipe não responde", () => servico("alumia_cuidado_bem_estar", { p_usuario: P.v5, p_semana: semana, p_marca: marcaDoBemEstar(SEGREDO, semana, P.v5), p_nivel: 3 }), "sem_permissao");
  await servico("alumia_cuidado_bem_estar", { p_usuario: P.e2, p_semana: semana, p_marca: marcaDoBemEstar(SEGREDO, semana, P.e2), p_nivel: 5 });
  await espera("a marca fica numa tabela só de 'respondeu', sem o nível", () => linhas("select * from interno.bem_estar_respostas where semana = $1::date", [semana]), (l) => l.length === 2 && l.every((x) => !("nivel" in x)));
  await espera("o nível fica na urna, sem marca, e a primeira resposta valeu", () => linhas("select * from interno.bem_estar_urna where semana = $1::date order by nivel", [semana]), (l) => l.length === 2 && l[0].nivel === 4 && l[1].nivel === 5 && l.every((x) => !("marca" in x)));
  await espera("a tabela antiga, com marca e nível na mesma linha, fica vazia", () => linhas("select * from interno.bem_estar"), (l) => l.length === 0);
  const urna = await linhas("select xmin::text x from interno.bem_estar_urna where semana = $1::date", [semana]);
  ok("a urna da semana foi regravada junta (um xmin só): a ordem de chegada some", new Set(urna.map((u) => u.x)).size === 1);
  const marca = (await um("select marca from interno.bem_estar_respostas where semana = $1::date and marca = $2", [semana, m])).marca;
  const comSal = (p) => createHash("md5").update(`${sal}:${p}:${semana}`).digest("hex");
  ok("a marca do termômetro não se refaz com o sal do banco (bem_estar_respostas.marca sem o sal)", nomes.every((n) => comSal(P[n]) !== marca));
}

// ═══════════════════ 10. Voto: a consulta com a cédula cifrada ═══════════════════
{
  await dono("insert into interno.rede_orgs (perfil, tipo) values ($1, 'coletivo')", [P.org]);
  const NUCLEO = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo do teste', $1) returning id", [P.org])).id;
  const VOTANTES = ["v1", "v2", "v3", "v4", "v5"];
  for (const n of VOTANTES) await dono("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [NUCLEO, P[n]]);
  const C = (await um("insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Qual pauta levamos?', 'ranqueada', now() + interval '2 days', 'A vencedora abre a próxima plenária.') returning id", [P.org])).id;
  const ops = [];
  for (const [i, t] of ["Tarifa zero", "Moradia", "Creche"].entries()) ops.push((await um("insert into interno.rede_consulta_opcoes (consulta, ordem, texto) values ($1, $2, $3) returning id", [C, i + 1, t])).id);
  const chave = chavePublicaDaConsulta(SEGREDO, C);
  const cedulas = {};
  const rankings = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [0, 2, 1]];
  for (const [i, n] of VOTANTES.slice(0, 4).entries()) {
    cedulas[n] = await cifrarCedula(C, chave, rankings[i].map((k) => ops[k]));
    await espera(`${n} vota com a cédula cifrada`, () => chamar(como(P[n]), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: cedulas[n] }), (x) => x.votei === true);
  }
  await recusa("cédula que não é cédula", () => chamar(como(P.v5), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: "c1.oi" }), "invalido:cedula");
  await recusa("quem já votou não vota de novo", () => chamar(como(P.v1), "rede_org_consulta_votar_cifrada", { p_consulta: C, p_cedula: cedulas.v1 }), "ja_votou");
  const noBanco = await linhas("select xmin::text x, cedula from interno.rede_consulta_cifradas where consulta = $1", [C]);
  ok("o banco guarda só o texto cifrado (nenhum id de opção à vista)", noBanco.length === 4 && noBanco.every((c) => ops.every((o) => !c.cedula.includes(o))));
  ok("as cédulas cifradas foram regravadas juntas (um xmin só)", new Set(noBanco.map((c) => c.x)).size === 1);
  ok("sem o segredo do servidor, nenhuma abre (nem com outro segredo)", noBanco.every((c) => abrirCedula("outro-segredo-qualquer-0123456789abcdef", C, c.cedula) === null));
  ok("a cédula de uma consulta não abre em outra", abrirCedula(SEGREDO, "11111111-2222-4333-8444-555555555555", noBanco[0].cedula) === null);
  const adulterada = noBanco[0].cedula.slice(0, -3) + (noBanco[0].cedula.endsWith("A") ? "B" : "A") + noBanco[0].cedula.slice(-2);
  ok("cédula adulterada não abre (AES-GCM confere a etiqueta)", abrirCedula(SEGREDO, C, adulterada) === null);
  await espera("aberta, o banco não entrega as cédulas ao servidor", () => servico("alumia_voto_cifradas", { p_consulta: C }), (x) => x.fechada === false && !("cedulas" in x));
  await recusa("aberta, não se apura", () => servico("alumia_voto_apurar", { p_consulta: C, p_rankings: [], p_quantas: 4 }), "consulta_aberta");
  await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [C]);
  await espera("fechada com cédula fechada: o resultado não sai e a tela é avisada", async () => (await rpc(como(P.v1), "rede_org_perfil", { p_handle: "org_o9" })).consultas.find((c) => c.id === C),
    (c) => c.apurar === true && c.opcoes.every((o) => o.proporcao === null));
  const lote = await servico("alumia_voto_cifradas", { p_consulta: C });
  const abertas = lote.cedulas.map((c) => abrirCedula(SEGREDO, C, c));
  ok("o servidor abre todas", abertas.every((r) => Array.isArray(r) && r.length === 3));
  await recusa("a apuração confere quantas cédulas o servidor abriu", () => servico("alumia_voto_apurar", { p_consulta: C, p_rankings: abertas, p_quantas: 3 }), "invalido:apuracao");
  const comNula = [...abertas.slice(0, 3), [ops[0], ops[0]]];
  await espera("apura: os rankings válidos entram, o inválido é nulo", () => servico("alumia_voto_apurar", { p_consulta: C, p_rankings: comNula, p_quantas: 4 }), (x) => x.apuradas === 3 && x.nulas === 1);
  await espera("as cifradas saíram; as abertas estão na urna, sem pessoa", () => um("select (select count(*)::int from interno.rede_consulta_cifradas where consulta = $1) c, (select count(*)::int from interno.rede_consulta_cedulas where consulta = $1) a", [C]), (x) => x.c === 0 && x.a === 3);
  await espera("apurar de novo não muda nada", () => servico("alumia_voto_apurar", { p_consulta: C, p_rankings: [], p_quantas: 0 }), (x) => x.apuradas === 0);
  await espera("o resultado sai (3 cédulas, sem quórum pedido)", async () => (await rpc(como(P.v1), "rede_org_perfil", { p_handle: "org_o9" })).consultas.find((c) => c.id === C),
    (c) => c.apurar === false && c.opcoes.some((o) => typeof o.proporcao === "number"));
  const ced = await linhas("select xmin::text x, ranking::text r from interno.rede_consulta_cedulas where consulta = $1", [C]);
  ok("na urna, as cédulas abertas dividem um xmin só e não dizem a ordem dos votos", new Set(ced.map((c) => c.x)).size === 1);
}

// ═══════════════════ 11. Sair só da Alumia ═══════════════════
{
  const D = P.dona;
  const raiz1 = (await um("insert into interno.rede_posts (autor, texto) values ($1, 'Post da dona que a amiga respondeu') returning id", [D])).id;
  await dono("insert into interno.rede_posts (autor, texto, resposta_a) values ($1, 'Resposta da amiga', $2)", [P.amiga, raiz1]);
  await dono("insert into interno.rede_posts (autor, texto) values ($1, 'Post solto da dona')", [D]);
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [D, P.amiga]);
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('passe-livre-o9', 'Passe Livre', 'lutas', 'aberta') on conflict (slug) do nothing");
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('passe-livre-o9', $1) on conflict do nothing", [D]);
  await dono("insert into interno.alumia_entrada (usuario, situacao, origem) values ($1, 'aprovada', 'pedido') on conflict do nothing", [D]).catch(() => null);
  await dono("insert into interno.alumia_sancoes (usuario, tipo, motivo) values ($1, 'advertencia', 'Sanção de teste que precisa ficar')", [D]).catch(() => null);
  const sancoesAntes = (await um("select count(*)::int n from interno.alumia_sancoes where usuario = $1", [D])).n;

  await recusa("sair pede o segundo fator de agora", () => chamar(como(D), "rede_meusdados_sair", { p_palavra: "@dona_o9" }), "confirme_segundo_fator");
  await recusa("e a palavra certa", () => chamar(como(D, 30), "rede_meusdados_sair", { p_palavra: "@outra" }), "confirmacao_errada");
  await espera("sair: o pedido nasce com 7 dias e a marca 'só a Alumia'", () => chamar(como(D, 30), "rede_meusdados_sair", { p_palavra: "@dona_o9" }), (r) => r.so_alumia === true && Math.abs(Date.parse(r.apagar_em) - Date.now() - 7 * 86400_000) < 120_000);
  await espera("a situação diz que é a saída só da Alumia", () => chamar(como(D, 30), "rede_meusdados_situacao"), (s) => s.apagamento?.so_alumia === true);
  await espera("na hora: perfil invisível e posts fora do ar", () => um("select (select rede_invisivel from interno.perfis where id = $1) inv, (select count(*)::int from interno.rede_posts where autor = $1 and not oculto) vivos", [D]), (x) => x.inv === true && x.vivos === 0);
  await dono("update interno.alumia_apagamentos set apagar_em = now() - interval '1 minute' where usuario = $1", [D]);
  await espera("a rodada do agendador cumpre a saída", () => um("select interno.alumia_md_rodada() as r"), (x) => x.r.cumpridos >= 1 && x.r.falhas === 0);
  await espera("a conta do Instituto continua (perfil e conta de acesso)", () => um("select (select count(*)::int from interno.perfis where id = $1) p, (select count(*)::int from auth.users where id = $1) u", [D]), (x) => x.p === 1 && x.u === 1);
  await espera("o perfil voltou a ser como antes da Alumia", () => um("select rede_handle, rede_codinome, rede_bio, rede_invisivel, rede_consentimento from interno.perfis where id = $1", [D]), (x) => x.rede_handle === null && x.rede_codinome === null && x.rede_bio === "" && x.rede_invisivel === false && x.rede_consentimento === null);
  await espera("a resposta da amiga ficou, e o post de cima virou '[post apagado]'", () => um("select r.texto rt, r.autor ra, p.texto pt, p.autor pa from interno.rede_posts r join interno.rede_posts p on p.id = r.resposta_a where r.autor = $1 and r.texto = 'Resposta da amiga'", [P.amiga]),
    (x) => x.ra === P.amiga && x.pt === "[post apagado]" && x.pa === null);
  await espera("nada da rede aponta mais para ela (fora as sanções e os registros que não se apagam)", async () => {
    const r = await linhas(`select c.conrelid::regclass::text t, a.attname col from pg_constraint c join pg_class k on k.oid = c.conrelid join pg_namespace n on n.oid = k.relnamespace and n.nspname = 'interno'
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1] where c.contype = 'f' and c.confrelid = 'interno.perfis'::regclass and cardinality(c.conkey) = 1
        and (k.relname like 'rede\\_%' or k.relname like 'alumia\\_%' or k.relname like 'fediverso\\_%')
        and k.relname not in ('alumia_sancoes', 'alumia_lei_retencoes', 'rede_moderacao') and k.relname not like 'alumia\\_painel\\_%'`);
    const sobra = [];
    for (const { t, col } of r) if ((await um(`select count(*)::int n from ${t} where ${col} = $1`, [D])).n > 0) sobra.push(`${t}.${col}`);
    return sobra;
  }, (l) => l.length === 0);
  await espera("a sanção continua (sair não apaga sanção)", () => um("select count(*)::int n from interno.alumia_sancoes where usuario = $1", [D]), (x) => x.n === sancoesAntes);
  await espera("os stories dela saíram", () => um("select count(*)::int n from interno.rede_stories where autor = $1", [D]), (x) => x.n === 0);

  // O pedido de sair vira apagar quando a pessoa pede para apagar tudo.
  const A = P.amiga;
  await chamar(como(A, 30), "rede_meusdados_sair", { p_palavra: "@amiga_o9" });
  await espera("quem pediu para sair e agora pede para apagar passa a ter o apagamento", () => chamar(como(A, 30), "rede_meusdados_apagar", { p_palavra: "@amiga_o9" }), (r) => r.so_alumia === false);
  await espera("desistir funciona para os dois", () => chamar(como(A, 30), "rede_meusdados_cancelar"), (r) => r.havia === true);

  // Quem administra a Alumia não sai por aqui.
  await dono("insert into interno.alumia_painel_admin (usuario) values ($1) on conflict do nothing", [P.outra]).catch(() => null);
  if ((await um("select count(*)::int n from interno.alumia_painel_admin where usuario = $1", [P.outra])).n === 1) {
    await recusa("quem administra a Alumia pede à coordenação", () => chamar(como(P.outra, 30), "rede_meusdados_sair", { p_palavra: "@outra_o9" }), "tem_funcao");
  }
}

// ═══════════════════ 12. Apagar a conta do site deixa "[post apagado]" ═══════════════════
{
  const B = P.apaga;
  await dono("update auth.users set encrypted_password = extensions.crypt('senha-forte-do-teste', extensions.gen_salt('bf', 4)) where id = $1", [B]);
  const raizB = (await um("insert into interno.rede_posts (autor, texto) values ($1, 'Post que vai ter resposta') returning id", [B])).id;
  const resp = (await um("insert into interno.rede_posts (autor, texto, resposta_a) values ($1, 'Resposta que tem de ficar', $2) returning id", [P.responde, raizB])).id;
  await recusa("senha errada não apaga", () => chamar(como(B), "conta_apagar", { p_senha: "errada" }), "senha_errada");
  await espera("a conta é apagada", () => chamar(como(B), "conta_apagar", { p_senha: "senha-forte-do-teste" }), (r) => r.ok === true);
  await espera("a conta e o perfil sumiram", () => um("select (select count(*)::int from interno.perfis where id = $1) p, (select count(*)::int from auth.users where id = $1) u", [B]), (x) => x.p === 0 && x.u === 0);
  await espera("a resposta de outra pessoa continua, debaixo de um '[post apagado]'", () => um("select r.id, p.texto, p.autor from interno.rede_posts r join interno.rede_posts p on p.id = r.resposta_a where r.id = $1", [resp]),
    (x) => x && x.texto === "[post apagado]" && x.autor === null);
}

// ═══════════════════ 13. As rotas, com um dublê do serviço de contas ═══════════════════
{
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://contas.duble";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anonima-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-de-teste";
  process.env.ALUMIA_VOTO_SEGREDO = SEGREDO;
  delete process.env.ALUMIA_IMPRESSAO_SEGREDO;
  const chamadas = [];
  let respostas = {};
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const corpo = init.body ? (typeof init.body === "string" ? JSON.parse(init.body) : String(init.body)) : null;
    chamadas.push({ u, metodo: init.method ?? "GET", corpo, cab: init.headers ?? {} });
    const achado = Object.entries(respostas).find(([k]) => u.includes(k));
    const [status, dado] = achado ? (typeof achado[1] === "function" ? achado[1](corpo) : achado[1]) : [404, { message: "sem dublê" }];
    return new Response(JSON.stringify(dado), { status, headers: { "Content-Type": "application/json" } });
  };
  const { emitirDesafio } = await import("../lib/rede/convites/prova-servidor.ts");
  const { resolverDesafio } = await import("../lib/rede/convites/prova-aparelho.ts");
  const provar = async (momento) => {
    const d = emitirDesafio(momento, 16);
    return { desafio: d.desafio, resposta: await resolverDesafio(d.desafio, d.dificuldade) };
  };
  const pedir = (corpo, extra = {}) => new Request("https://alumia.duble/api", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://alumia.duble", ...extra }, body: JSON.stringify(corpo) });

  // Entrar
  const entrar = await import("../app/api/alumia/porta/entrar/route.ts");
  respostas = { "/rpc/alumia_porta_passar": [200, { ok: true }], "/auth/v1/token": [200, { access_token: "a".repeat(40), refresh_token: "r".repeat(20), user: { id: "x" } }] };
  chamadas.length = 0;
  let r = await entrar.POST(pedir({ ...(await provar("entrar")), email: "pessoa@o9.local", senha: "uma senha" }));
  let d = await r.json();
  ok("entrar: com a prova, devolve só os dois tokens", r.status === 200 && d.ok && d.sessao.access_token === "a".repeat(40) && Object.keys(d.sessao).sort().join() === "access_token,refresh_token");
  const tok = chamadas.find((c) => c.u.includes("/auth/v1/token"));
  ok("entrar: a sessão é pedida com a chave de serviço, sem desafio de terceiros", tok && tok.cab.apikey === "chave-de-servico-de-teste" && !JSON.stringify(tok.corpo).includes("captcha"));
  ok("entrar: a porta foi conferida antes, no banco, com o momento certo", chamadas[0]?.u.includes("/rpc/alumia_porta_passar") && chamadas[0].corpo.p_momento === "entrar");
  chamadas.length = 0;
  r = await entrar.POST(pedir({ desafio: "p1.x", resposta: "1", email: "pessoa@o9.local", senha: "uma senha" }));
  ok("entrar: sem a prova, não chega ao serviço de contas", r.status === 400 && !chamadas.some((c) => c.u.includes("/auth/v1/")));
  respostas["/auth/v1/token"] = [400, { error_code: "invalid_credentials" }];
  r = await entrar.POST(pedir({ ...(await provar("entrar")), email: "pessoa@o9.local", senha: "errada" }));
  ok("entrar: senha errada vira 'credenciais'", (await r.json()).motivo === "credenciais");
  respostas["/rpc/alumia_porta_entrada"] = (c) => [200, { bloqueado: c.p_passo === "falhou", segundos: 600 }];
  chamadas.length = 0;
  r = await entrar.POST(pedir({ ...(await provar("entrar")), email: "pessoa@o9.local", senha: "errada" }));
  d = await r.json();
  ok("entrar: a senha errada conta um erro na conta, no banco, e a conta fechada vira 'bloqueado' com os minutos",
    r.status === 429 && d.motivo === "bloqueado" && d.minutos === 10 && chamadas.some((c) => c.u.includes("/rpc/alumia_porta_entrada") && c.corpo.p_passo === "falhou"));
  respostas["/rpc/alumia_porta_entrada"] = [200, { bloqueado: true, segundos: 300 }];
  chamadas.length = 0;
  r = await entrar.POST(pedir({ ...(await provar("entrar")), email: "pessoa@o9.local", senha: "certa" }));
  d = await r.json();
  ok("entrar: conta fechada no banco para antes do serviço de contas", d.motivo === "bloqueado" && d.minutos === 5 && !chamadas.some((c) => c.u.includes("/auth/v1/")));
  delete respostas["/rpc/alumia_porta_entrada"];
  respostas["/rpc/alumia_porta_passar"] = [200, { ok: false, motivo: "rede_barrada" }];
  chamadas.length = 0;
  r = await entrar.POST(pedir({ ...(await provar("entrar")), email: "pessoa@o9.local", senha: "x" }));
  ok("entrar: rede barrada para antes do serviço de contas", (await r.json()).motivo === "rede_barrada" && !chamadas.some((c) => c.u.includes("/auth/v1/")));

  // O desafio da Cloudflare, com a chave secreta no servidor
  process.env.TURNSTILE_SECRET_KEY = "segredo-do-desafio-de-teste";
  respostas = { "/rpc/alumia_porta_passar": [200, { ok: true }], "/auth/v1/token": [200, { access_token: "a".repeat(40), refresh_token: "r".repeat(20) }], "/turnstile/v0/siteverify": [200, { success: true }] };
  chamadas.length = 0;
  r = await entrar.POST(pedir({ ...(await provar("entrar")), email: "pessoa@o9.local", senha: "uma senha" }));
  ok("desafio: com a chave secreta, sem a resposta, nada segue (nem a Cloudflare, nem o banco, nem o serviço de contas)",
    r.status === 400 && (await r.json()).motivo === "captcha" && chamadas.length === 0);
  chamadas.length = 0;
  r = await entrar.POST(pedir({ ...(await provar("entrar")), turnstile: "resposta-do-desafio-0123456789", email: "pessoa@o9.local", senha: "uma senha" }));
  const sv = chamadas.find((c) => c.u.includes("/turnstile/v0/siteverify"));
  ok("desafio: a resposta é conferida na Cloudflare com a chave secreta, sem o endereço de rede, e a entrada segue",
    r.status === 200 && sv && chamadas.indexOf(sv) === 0 && /secret=segredo-do-desafio-de-teste/.test(sv.corpo) && /response=resposta-do-desafio-0123456789/.test(sv.corpo) && !/remoteip/.test(sv.corpo));
  respostas["/turnstile/v0/siteverify"] = [200, { success: false, "error-codes": ["timeout-or-duplicate"] }];
  chamadas.length = 0;
  r = await entrar.POST(pedir({ ...(await provar("entrar")), turnstile: "resposta-do-desafio-0123456789", email: "pessoa@o9.local", senha: "uma senha" }));
  ok("desafio: resposta recusada pela Cloudflare (gasta ou falsa) para antes do banco e do serviço de contas",
    (await r.json()).motivo === "captcha" && !chamadas.some((c) => c.u.includes("/auth/v1/") || c.u.includes("/rpc/")));
  respostas["/turnstile/v0/siteverify"] = () => { throw new Error("fora do ar"); };
  r = await entrar.POST(pedir({ ...(await provar("entrar")), turnstile: "resposta-do-desafio-0123456789", email: "pessoa@o9.local", senha: "uma senha" }));
  ok("desafio: a Cloudflare fora do ar não abre a porta", (await r.json()).motivo === "captcha");
  delete process.env.TURNSTILE_SECRET_KEY;

  // Reenviar e esqueci a senha
  const aviso = await import("../app/api/alumia/porta/aviso/route.ts");
  respostas = { "/rpc/alumia_porta_passar": [200, { ok: true }], "/auth/v1/recover": [200, {}], "/auth/v1/resend": [200, {}] };
  chamadas.length = 0;
  r = await aviso.POST(pedir({ ...(await provar("aviso")), tipo: "senha", email: "alvo@o9.local", volta: "https://alumia.duble/pt/entrar" }));
  const rec = chamadas.find((c) => c.u.includes("/auth/v1/recover"));
  ok("esqueci: pede o link pelo servidor, com a volta na mesma origem", r.status === 200 && rec && rec.u.includes(encodeURIComponent("https://alumia.duble/pt/entrar")) && rec.cab.apikey === "chave-de-servico-de-teste");
  chamadas.length = 0;
  await aviso.POST(pedir({ ...(await provar("aviso")), tipo: "senha", email: "alvo@o9.local", volta: "https://golpe.example/x" }));
  ok("esqueci: volta de outra origem é descartada", chamadas.some((c) => c.u.endsWith("/auth/v1/recover")));
  chamadas.length = 0;
  r = await aviso.POST(pedir({ ...(await provar("aviso")), tipo: "confirmacao", email: "alvo@o9.local", volta: "https://alumia.duble/" }));
  ok("reenviar: a confirmação de novo, tipo signup", chamadas.some((c) => c.u.includes("/auth/v1/resend") && c.corpo.type === "signup"));
  await aviso.POST(pedir({ ...(await provar("aviso")), tipo: "senha", email: "alvo@o9.local", volta: "" }));
  chamadas.length = 0;
  r = await aviso.POST(pedir({ ...(await provar("aviso")), tipo: "senha", email: "alvo@o9.local", volta: "" }));
  ok("esqueci: passou do freio do endereço, responde igual e não manda nada", r.status === 200 && (await r.json()).ok === true && !chamadas.some((c) => c.u.includes("/auth/v1/")));

  // Criar a conta
  const conta = await import("../app/api/alumia/porta/conta/route.ts");
  respostas = { "/rpc/alumia_cadastro_passar": [200, { ok: true }], "/auth/v1/admin/users": [200, { id: "novo" }], "/auth/v1/resend": [200, {}] };
  chamadas.length = 0;
  r = await conta.POST(pedir({ ...(await provar("conta")), email: "nova@o9.local", senha: "Senha-Bem-Forte-2026", codinome: "Faísca", volta: "https://alumia.duble/", convite: "abcdef123456" }));
  d = await r.json();
  const adm = chamadas.find((c) => c.u.includes("/auth/v1/admin/users"));
  ok("conta: criada pela API de administração, sem confirmar o e-mail, com o codinome e o convite", d.ok === true && adm && adm.corpo.email_confirm === false && adm.corpo.user_metadata.apelido === "Faísca" && adm.corpo.user_metadata.convite === "abcdef123456");
  ok("conta: o e-mail de confirmação sai depois (e nunca pelo cadastro público)", chamadas.some((c) => c.u.includes("/auth/v1/resend")) && !chamadas.some((c) => c.u.includes("/auth/v1/signup")));
  r = await conta.POST(pedir({ ...(await provar("conta")), email: "nova@o9.local", senha: "fraca", codinome: "", volta: "" }));
  ok("conta: senha fraca não chega ao serviço de contas", (await r.json()).motivo === "senha_fraca");
  respostas["/auth/v1/admin/users"] = [422, { error_code: "email_exists", msg: "A user with this email address has already been registered" }];
  r = await conta.POST(pedir({ ...(await provar("conta")), email: "ja@o9.local", senha: "Senha-Bem-Forte-2026", codinome: "", volta: "" }));
  ok("conta: e-mail que já tem conta recebe a mesma resposta (a tela não diz quem tem conta)", (await r.json()).ok === true);
  process.env.TURNSTILE_SECRET_KEY = "segredo-do-desafio-de-teste";
  respostas["/turnstile/v0/siteverify"] = [200, { success: false }];
  chamadas.length = 0;
  r = await conta.POST(pedir({ ...(await provar("conta")), turnstile: "resposta-do-desafio-0123456789", email: "robo@o9.local", senha: "Senha-Bem-Forte-2026", codinome: "", volta: "" }));
  ok("conta: com o desafio ligado e recusado, a conta não nasce", (await r.json()).motivo === "captcha" && !chamadas.some((c) => c.u.includes("/auth/v1/")));
  chamadas.length = 0;
  r = await aviso.POST(pedir({ ...(await provar("aviso")), tipo: "senha", email: "outro@o9.local", volta: "" }));
  ok("esqueci: com o desafio ligado e sem resposta, nenhum e-mail sai", (await r.json()).motivo === "captcha" && !chamadas.some((c) => c.u.includes("/auth/v1/")));
  delete process.env.TURNSTILE_SECRET_KEY;

  // O voto pelo servidor
  const marca = await import("../app/api/alumia/voto/marca/route.ts");
  const PESSOA = "0b5b2b1e-1111-4222-8333-444455556666";
  const POST_ID = "1c6c3c2f-1111-4222-8333-444455556666";
  const OPC = "2d7d4d3a-1111-4222-8333-444455556666";
  respostas = { "/auth/v1/user": [200, { id: PESSOA, email_confirmed_at: "2026-01-01" }], "/rpc/alumia_voto_enquete": [200, { votei: [OPC], votou: true }] };
  chamadas.length = 0;
  r = await marca.POST(pedir({ tipo: "enquete", post: POST_ID, opcoes: [OPC] }, { Authorization: `Bearer ${"t".repeat(30)}` }));
  const rpcVoto = chamadas.find((c) => c.u.includes("/rpc/alumia_voto_enquete"));
  ok("voto: a marca é a do segredo do servidor, e o banco recebe a pessoa só para conferir", r.status === 200 && rpcVoto && rpcVoto.corpo.p_marca === marcaDoVoto(SEGREDO, "enquete", POST_ID, PESSOA) && rpcVoto.corpo.p_usuario === PESSOA);
  r = await marca.POST(pedir({ tipo: "enquete", post: POST_ID, opcoes: [OPC] }));
  ok("voto: sem sessão, nada", r.status === 401);
  respostas["/rpc/alumia_voto_enquete"] = [400, { message: "ja_votou" }];
  r = await marca.POST(pedir({ tipo: "enquete", post: POST_ID, opcoes: [OPC] }, { Authorization: `Bearer ${"t".repeat(30)}` }));
  ok("voto: o 'já votou' do banco chega à tela", (await r.json()).motivo === "ja_votou");
  respostas["/rpc/alumia_cuidado_bem_estar"] = [200, { ok: true }];
  chamadas.length = 0;
  await marca.POST(pedir({ tipo: "bem_estar", nivel: 4 }, { Authorization: `Bearer ${"t".repeat(30)}` }));
  const be = chamadas.find((c) => c.u.includes("/rpc/alumia_cuidado_bem_estar"));
  ok("termômetro: a marca de 32 letras, com a semana de São Paulo", be && be.corpo.p_marca === marcaDoBemEstar(SEGREDO, semanaDeSaoPaulo(), PESSOA) && /^[0-9a-f]{32}$/.test(be.corpo.p_marca));
  delete process.env.ALUMIA_VOTO_SEGREDO;
  r = await marca.POST(pedir({ tipo: "enquete", post: POST_ID, opcoes: [OPC] }, { Authorization: `Bearer ${"t".repeat(30)}` }));
  ok("voto: sem o segredo do servidor, a rota não vota (nem finge)", r.status === 503);
  process.env.ALUMIA_VOTO_SEGREDO = SEGREDO;

  // A apuração da consulta
  const abrir = await import("../app/api/alumia/voto/abrir/route.ts");
  const CONS = "3e8e5e4b-1111-4222-8333-444455556666";
  const O1 = "4f9f6f5c-1111-4222-8333-444455556666";
  const O2 = "5a0a7a6d-1111-4222-8333-444455556666";
  const pub = chavePublicaDaConsulta(SEGREDO, CONS);
  const lote = [await cifrarCedula(CONS, pub, [O1, O2]), await cifrarCedula(CONS, pub, [O2, O1]), "c1." + "A".repeat(87) + "." + "B".repeat(16) + "." + "C".repeat(40)];
  respostas = { "/rpc/alumia_voto_cifradas": [200, { fechada: true, cedulas: lote }], "/rpc/alumia_voto_apurar": (c) => [200, { apuradas: c.p_rankings.length, nulas: c.p_quantas - c.p_rankings.length }] };
  r = await abrir.POST(pedir({ consulta: CONS }));
  ok("apurar: sem sessão, nada (um visitante não segura a apuração de ninguém)", r.status === 401);
  respostas["/auth/v1/user"] = [200, { id: PESSOA, email_confirmed_at: "2026-01-01" }];
  const comSessao = { Authorization: `Bearer ${"t".repeat(30)}` };
  chamadas.length = 0;
  r = await abrir.POST(pedir({ consulta: CONS }, comSessao));
  d = await r.json();
  const ap = chamadas.find((c) => c.u.includes("/rpc/alumia_voto_apurar"));
  ok("apurar: o servidor abre, descarta a que não abre e manda só os rankings", d.ok && d.apuradas === 2 && d.nulas === 1 && ap.corpo.p_quantas === 3 && ap.corpo.p_rankings.every((x) => Array.isArray(x) && x.length === 2));
  respostas["/rpc/alumia_voto_cifradas"] = [200, { fechada: false }];
  r = await abrir.POST(pedir({ consulta: CONS }, comSessao));
  ok("apurar: consulta aberta não se abre", r.status === 409);
  respostas["/rpc/alumia_voto_cifradas"] = [400, { message: "nao_encontrado" }];
  r = await abrir.POST(pedir({ consulta: CONS }, comSessao));
  ok("apurar: consulta que não existe é um 404 (antes virava 502 e a borda mostrava a página de erro dela)", r.status === 404 && (await r.json()).motivo === "nao_encontrado");

  // A chave pública da consulta: com sessão e freio por conta
  const chaveRota = await import("../app/api/alumia/voto/chave/route.ts");
  respostas["/auth/v1/user"] = [401, {}];
  r = await chaveRota.POST(pedir({ consulta: CONS }));
  ok("chave: sem sessão, nada", r.status === 401);
  respostas["/auth/v1/user"] = [200, { id: PESSOA, email_confirmed_at: "2026-01-01" }];
  r = await chaveRota.POST(pedir({ consulta: CONS }, comSessao));
  d = await r.json();
  ok("chave: com sessão, a chave pública da consulta", d.ok === true && d.chave === pub);
  let ultimo = 200;
  for (let i = 0; i < 35; i++) ultimo = (await chaveRota.POST(pedir({ consulta: CONS }, comSessao))).status;
  respostas["/auth/v1/user"] = [200, { id: "6b1b8b7e-1111-4222-8333-444455556666", email_confirmed_at: "2026-01-01" }];
  const outra = (await chaveRota.POST(pedir({ consulta: CONS }, comSessao))).status;
  ok("chave: o freio é por conta (a enxurrada de uma conta não barra a outra)", ultimo === 429 && outra === 200);
  const cli = fs.readFileSync(path.join(raiz, "lib/rede/voto/cliente.ts"), "utf8");
  ok("o aparelho só cai para o caminho sem cifra quando o servidor diz sem_servico (429 ou falta de rede viram erro)",
    cli.includes('if (r.dado?.motivo === "sem_servico") return null;') && !/catch \{\s*chave = null;/.test(cli) && cli.includes('throw new BackendError("falha");'));
}
} catch (erro) {
  falhas.push(`o teste quebrou: ${String(erro?.stack ?? erro).split("\n").slice(0, 3).join(" | ")}`);
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU  ${f}`);
process.exit(falhas.length ? 1 : 0);
