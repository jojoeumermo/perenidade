// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote backend-2 do painel (docs/backend-2.md): as frases puras (lib/operacao.ts), o SQL (nenhuma tabela em public,
// toda função public.* com security definer e search_path, nada executável por anon além do formulário de imprensa, nada
// que afrouxe o Mural de Saúde, token do Instagram só como data), a rota da operação (token só no servidor, banco antes dos
// serviços), as telas (sem cor escrita à mão, sem a palavra proibida) e o registro das seções. Uso: npm run testar:backend-2
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { backupAtrasado, diasAteVencer, fraseDaAula, fraseDoToken, nivelDoToken, resumirBackup, resumirPublicacao } from "../lib/operacao.ts";

const ler = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const sql = ler("supabase", "migracoes", "2026-11-backend-2.sql");
const rota = ler("app", "api", "painel", "operacao", "route.ts");
const telas = ["Operacao", "Imprensa", "Ensino", "Previa", "SaudeRegras"].map((n) => [n, ler("components", "painel", `${n}.tsx`)]);
const formulario = ler("components", "ImprensaForm.tsx");
const pagina = ler("app", "[lang]", "imprensa", "page.tsx");
let n = 0;
const ok = (nome, f) => {
  try {
    f();
    n++;
  } catch (e) {
    console.error("FALHOU:", nome, "\n ", e.message);
    process.exitCode = 1;
  }
};

// ── Frases puras ──
ok("dias até vencer, em dias inteiros", () => {
  assert.equal(diasAteVencer("2026-11-20", "2026-11-05"), 15);
  assert.equal(diasAteVencer("2026-11-05", "2026-11-05"), 0);
  assert.equal(diasAteVencer("2026-11-04", "2026-11-05"), -1);
  assert.equal(diasAteVencer("2027-01-01", "2026-12-31"), 1);
  assert.equal(diasAteVencer("lixo", "2026-11-05"), null);
});
ok("faixas do token iguais às do banco (14, 3, vencido)", () => {
  assert.equal(nivelDoToken(null), "indefinido");
  assert.equal(nivelDoToken(15), "ok");
  assert.equal(nivelDoToken(14), "aviso");
  assert.equal(nivelDoToken(4), "aviso");
  assert.equal(nivelDoToken(3), "urgente");
  assert.equal(nivelDoToken(0), "urgente");
  assert.equal(nivelDoToken(-1), "vencido");
  for (const faixa of ["when v_dias < 0 then 'vencido'", "when v_dias <= 3 then 'urgente'", "when v_dias <= 14 then 'aviso'"]) assert.ok(sql.includes(faixa), faixa);
  assert.match(fraseDoToken(1), /amanhã/);
  assert.match(fraseDoToken(-2), /venceu/);
  assert.match(fraseDoToken(null), /ainda não foi anotada/);
});
ok("publicação: estados da Vercel viram frases", () => {
  const agora = Date.UTC(2026, 10, 5, 12, 0, 0);
  const antes = (min) => agora - min * 60_000;
  assert.equal(resumirPublicacao({ readyState: "READY", created: antes(25), url: "site-abc.vercel.app" }, agora).estado, "pronta");
  assert.match(resumirPublicacao({ readyState: "READY", created: antes(25) }, agora).frase, /há 25 min/);
  assert.match(resumirPublicacao({ readyState: "READY", created: antes(300) }, agora).frase, /há 5 h/);
  assert.equal(resumirPublicacao({ readyState: "BUILDING", created: antes(2) }, agora).estado, "em_andamento");
  assert.equal(resumirPublicacao({ readyState: "ERROR", created: antes(2) }, agora).estado, "falhou");
  assert.equal(resumirPublicacao({ readyState: "CANCELED" }, agora).estado, "cancelada");
  assert.equal(resumirPublicacao(undefined, agora).estado, "desconhecida");
  assert.equal(resumirPublicacao({ readyState: "READY", url: "x/../y" }, agora).endereco, "");
});
ok("backup: conclusões do GitHub viram frases", () => {
  const agora = Date.UTC(2026, 10, 5, 12, 0, 0);
  const dias = (d) => new Date(agora - d * 86_400_000).toISOString();
  assert.equal(resumirBackup({ status: "completed", conclusion: "success", created_at: dias(3) }, agora).estado, "ok");
  assert.equal(resumirBackup({ status: "completed", conclusion: "skipped", created_at: dias(3) }, agora).estado, "pulado");
  assert.equal(resumirBackup({ status: "completed", conclusion: "failure", created_at: dias(1) }, agora).estado, "falhou");
  assert.equal(resumirBackup({ status: "in_progress", conclusion: null, created_at: dias(0) }, agora).estado, "em_andamento");
  assert.equal(resumirBackup(undefined, agora).estado, "nenhum");
  assert.equal(backupAtrasado(resumirBackup({ status: "completed", conclusion: "success", created_at: dias(12) }, agora)), true);
  assert.equal(backupAtrasado(resumirBackup({ status: "completed", conclusion: "success", created_at: dias(3) }, agora)), false);
});
ok("resultado da aula: poucos testes sem número, tendência e aula difícil", () => {
  assert.match(fraseDaAula({ poucos: true }), /menos de 5/);
  assert.doesNotMatch(fraseDaAula({ poucos: true }), /\d+%/);
  assert.match(fraseDaAula({ poucos: false, testes: 20, pct: 30, dificil: true, recente_pct: 20, anterior_pct: 40 }), /piorando.*difícil/);
  assert.match(fraseDaAula({ poucos: false, testes: 20, pct: 80, recente_pct: 90, anterior_pct: 70 }), /melhorando/);
  assert.doesNotMatch(fraseDaAula({ poucos: false, testes: 8, pct: 50 }), /NaN|undefined/);
});

// ── SQL ──
ok("nenhuma tabela no esquema public; tudo em interno", () => {
  assert.doesNotMatch(sql, /create table[^\n]*\bpublic\./i);
  const tabelas = [...sql.matchAll(/create table if not exists (\S+)/g)].map((m) => m[1]);
  assert.equal(tabelas.length, 5);
  for (const t of tabelas) assert.match(t, /^interno\./, t);
  assert.equal([...sql.matchAll(/enable row level security|foreach t in array array\['operacao_registro'/g)].length >= 1, true);
});
ok("idempotente: sem create sem if not exists, sem drop table nem delete geral", () => {
  assert.doesNotMatch(sql, /create table (?!if not exists)/i);
  assert.doesNotMatch(sql, /drop table|truncate/i);
  assert.doesNotMatch(sql, /install\.sql['"]?\s*;/);
});
ok("toda função public.* é security definer com search_path fixo", () => {
  const funcoes = sql.split(/create or replace function /).slice(1).filter((t) => t.startsWith("public."));
  assert.ok(funcoes.length >= 20, `achei ${funcoes.length}`);
  for (const f of funcoes) {
    const cab = f.slice(0, f.indexOf("$$"));
    assert.match(cab, /security definer/, cab.slice(0, 60));
    assert.match(cab, /set search_path = interno, pg_temp/, cab.slice(0, 60));
  }
});
ok("só imprensa_enviar é aberta ao visitante (anon)", () => {
  const dar = [...sql.matchAll(/grant execute on function %s to (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(dar.sort(), ["anon", "authenticated"]);
  assert.match(sql, /if f\.proname = 'imprensa_enviar' then execute format\('grant execute on function %s to anon'/);
  assert.match(sql, /revoke all on function %s from anon/);
});
ok("funções internas sem acesso público", () => {
  for (const f of ["interno.backend2_papel_de(uuid, text[])", "interno.imprensa_pode()", "interno.ensina(text)", "interno.instagram_token_estado()", "interno.instagram_token_vigiar()", "interno.imprensa_limpeza()", "interno.resumo_diario_montar(uuid)", "interno.resumo_diario_enviar()"])
    assert.ok(sql.includes(`revoke all on function ${f} from public`), f);
  assert.doesNotMatch(sql, /grant execute on function interno\./);
});
ok("operação: só coordenação, ritmo segurando, ação em lista fechada", () => {
  assert.match(sql, /operacao_pedir[\s\S]*?interno\.coord\(\)/);
  assert.match(sql, /p_acao not in \('limpar_cache', 'ver_publicacao', 'ver_backup'\)/);
  assert.match(sql, /interno\.limite\('operacao_' \|\| p_acao, case p_acao when 'limpar_cache' then 3 else 30 end, 60\)/);
});
ok("token do Instagram: só a data, nunca o token", () => {
  assert.doesNotMatch(sql, /p_token|access_token|create table[^;]*token text/i);
  assert.match(sql, /instagram_token_validade_salvar\(p_expira date\)/);
  assert.match(sql, /interno\.email_lideranca\('instagram_token'/);
});
ok("Mural de Saúde: só aperta (termos a mais e categorias pausadas), nunca afrouxa", () => {
  assert.match(sql, /\(r -> 'bloqueio'\) \|\| coalesce\(x, '\[\]'::jsonb\)/);
  assert.match(sql, /and not coalesce\(interno\.saude_categoria\(p_conselho\) = any/);
  assert.match(sql, /if not \(r -> 'categorias'\) \? k then perform interno\.erro\('invalido:categoria'\)/);
  assert.doesNotMatch(sql, /update interno\.saude_perfis|delete from[^;]*saude_/i);
  assert.match(sql, /jsonb_array_length\(coalesce\(p_grupos, '\[\]'::jsonb\)\) > 30/);
});
ok("resultado das aulas: mínimo de 5 testes e só quem ensina", () => {
  assert.match(sql, /when x\.testes < 5/);
  assert.match(sql, /'poucos', true/);
  assert.match(sql, /not interno\.ensina\(p_trilha\)/);
  assert.match(sql, /from contagens/);
  assert.doesNotMatch(sql, /from (interno\.)?(perfis|auth\.users)[^;]*aula_teste/);
});
ok("imprensa: consentimento, isca, limites, só os dados necessários e eliminação em 180 dias", () => {
  assert.match(sql, /coalesce\(\(p ->> 'consentimento'\)::boolean, false\) is not true then perform interno\.erro\('invalido:consentimento'\)/);
  assert.match(sql, /if coalesce\(p ->> 'site', ''\) <> ''/);
  assert.match(sql, /interno\.limite\('imprensa_enviar', 3, 60\)/);
  const tabela = /create table if not exists interno\.imprensa_pedidos \(([\s\S]*?)\n\);/.exec(sql)[1];
  assert.doesNotMatch(tabela, /telefone|cpf|documento|ip\b|rede_social/i);
  assert.match(sql, /now\(\) \+ interval '180 days'/);
  assert.match(sql, /from imprensa_pedidos where \(apagar_em is not null and apagar_em < now\(\)\)/);
  // O e-mail de aviso não leva dado do pedido.
  const aviso = /'imprensa_nova'[^;]*/.exec(sql)[0];
  assert.doesNotMatch(aviso, /nome|v_email|mensagem|assunto, /);
  assert.match(sql, /LGPD|Lei 13\.709\/2018/);
  assert.match(sql, /arts\. 15, I, e 16/);
});
ok("resumo diário: começa desligado, só contagens, um por dia, pela fila de e-mails", () => {
  assert.match(sql, /coalesce\(\(select ativo from resumo_diario where usuario = v\), false\)/);
  assert.match(sql, /ativo boolean not null default true/); // o registro só nasce quando a pessoa liga
  assert.match(sql, /insert into resumo_diario \(usuario, ativo\) values \(v, coalesce\(p_ativo, false\)\)/);
  assert.match(sql, /interno\.email\(v_email, 'resumo_diario', v ->> 'assunto', v ->> 'texto', '', 1\)/);
  assert.match(sql, /d\.ultimo is distinct from v_hoje/);
  const montar = /function interno\.resumo_diario_montar[\s\S]*?end \$\$;/.exec(sql)[0];
  assert.doesNotMatch(montar, /\b(nome|email|mensagem)\b\s*(,|\))/);
  assert.match(montar, /return null;/);
  assert.match(sql, /cron\.schedule\('lucia-resumo-diario'/);
});
ok("prévia: dados marcados como exemplo e inventados", () => {
  assert.match(sql, /'exemplo', true/);
  assert.match(sql, /Pessoa de Exemplo/);
  assert.doesNotMatch(sql, /previa_exemplo[\s\S]{0,3000}@(?!.*exemplo)[a-z]+\.[a-z]+/);
});
ok("a migração não mexe em install.sql", () => {
  assert.doesNotMatch(sql, /\\i |install\.sql\s+foi/);
});

// ── Rota ──
ok("rota: o banco confere ANTES de falar com qualquer serviço; os tokens nunca voltam", () => {
  assert.ok(rota.indexOf('rpcNoBanco<boolean>("operacao_pedir"') < rota.indexOf("await publicacao()"));
  assert.ok(rota.indexOf('rpcNoBanco<boolean>("operacao_pedir"') < rota.indexOf("await limparCache()"));
  assert.match(rota, /Bearer\\s\+/);
  assert.match(rota, /operacao_resultado/);
  const respostas = [...rota.matchAll(/responder\(\{([^}]*)\}/g)].map((m) => m[1]).join("\n");
  assert.doesNotMatch(respostas, /process\.env/);
  assert.match(rota, /VERCEL_TOKEN_LEITURA/);
  assert.match(rota, /api\.vercel\.com\/v7\/deployments/);
  assert.match(rota, /workflows\/backup\.yml\/runs/);
  assert.match(rota, /purge_everything/);
  assert.match(rota, /"Cache-Control": "no-store"/);
});
ok("rota (T33): o GET só diz o que está ligado depois de o banco conferir que é a coordenação", () => {
  const get = rota.slice(rota.indexOf("export async function GET"), rota.indexOf("async function publicacao"));
  assert.ok(get.indexOf('rpcNoBanco<unknown>("operacao_situacao"') > 0);
  assert.ok(get.indexOf('rpcNoBanco<unknown>("operacao_situacao"') < get.indexOf("ligado: ligado()"));
  assert.match(get, /if \(!coordenacao\.ok\) return responder/);
});

// ── Telas ──
ok("telas: sem cor escrita à mão, sem confirm/prompt do navegador, sem a palavra proibida", () => {
  for (const [nome, tela] of [...telas, ["ImprensaForm", formulario], ["pagina", pagina]]) {
    assert.doesNotMatch(tela, /#[0-9a-fA-F]{3,8}\b(?![\w-])/, `${nome}: cor escrita à mão`);
    assert.doesNotMatch(tela, /window\.(confirm|prompt|alert)/, nome);
    assert.doesNotMatch(tela, /universidade|diploma/i, nome);
  }
  assert.doesNotMatch(sql + rota, /universidade|diploma/i);
});
ok("formulário de imprensa: consentimento obrigatório, isca, sem terceiros", () => {
  assert.match(formulario, /name="consentimento" type="checkbox" required/);
  assert.match(formulario, /name="site" tabIndex=\{-1\}/);
  assert.match(formulario, /180 dias/);
  assert.doesNotMatch(formulario + pagina, /<script|<iframe|googletagmanager|recaptcha/i);
});
ok("telas só chamam funções que o SQL cria", () => {
  const criadas = new Set([...sql.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]));
  const chamadas = new Set();
  for (const [, tela] of [...telas, ["f", formulario]]) {
    for (const m of tela.matchAll(/(?:rpc(?:<[^>]*(?:<[^>]*>)?[^>]*>)?|useLista<[^(]*?>)\(\s*"(\w+)"/g)) chamadas.add(m[1]);
  }
  assert.ok(chamadas.size >= 12, `achei ${chamadas.size}`);
  for (const c of chamadas) assert.ok(criadas.has(c), `função ${c} não existe no SQL`);
});

// ── Registro das seções ──
ok("seções registradas no painel e no mapa", () => {
  // O registro de seções e a casca saíram de Painel.tsx para casca/ no redesenho (docs/PAINEL-REDESENHO.md): lemos os dois.
const painel = ler("components", "painel", "Painel.tsx") + "\n" + ler("components", "painel", "casca", "Dentro.tsx");
  const mapa = ler("components", "painel", "estrutura.ts");
  for (const id of ["operacao", "imprensa", "ensino", "previa"]) {
    assert.ok(painel.includes(`id: "${id}"`), `${id} sem registro no Painel`);
    assert.match(mapa, new RegExp(`\\b${id}: \\{ espaco:`), `${id} fora do mapa`);
  }
  assert.match(ler("components", "painel", "Saude.tsx"), /<SaudeRegras \/>/);
});
ok("a página de imprensa existe em pt e usa o formulário", () => {
  assert.match(pagina, /ImprensaForm/);
  assert.match(pagina, /paginaMeta\(lang, "\/imprensa"/);
});

ok("funções que gravam não são stable; apagar lacuna confere linhas apagadas", () => {
  const cab = /create or replace function public\.imprensa_listar.*/.exec(sql)[0];
  assert.doesNotMatch(cab, /stable/, "imprensa_listar grava o registro de acesso");
  const apagar = /function public\.lacunas_apagar[\s\S]*?end \$\$;/.exec(sql)[0];
  assert.match(apagar, /get diagnostics n = row_count/);
  assert.doesNotMatch(apagar, /return found/);
});

console.log(`backend-2: ${n} conferências ok.`);
if (process.exitCode) {
  console.error("Há conferências que falharam.");
}
