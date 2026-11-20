// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente de operação da Onda 8 (supabase/migracoes/20261114-alumia-o8-operacao.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada duas vezes sobre o install.sql, e as peças puras da operação: a avaliação do
// monitor (scripts/operacao/monitor.mjs), o aviso que vira issue (scripts/operacao/avisar.mjs), as conferências da cópia
// restaurada (scripts/operacao/conferir-restauracao.sql) e a política de segurança das telas da Alumia (next.config.ts).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/operacao/testar-operacao.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "../banco-local.mjs";
import { avaliar, textoDoRelatorio } from "./monitor.mjs";
import { corpoDoAviso, emailConfigurado, podeAbrirIssue } from "./avisar.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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
const sql = ler("supabase/migracoes/20261114-alumia-o8-operacao.sql");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 12 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("as tabelas nascem com RLS e nenhuma permissão direta", (sql.match(/create table if not exists interno\./g) ?? []).length === 2
  && (sql.match(/enable row level security/g) ?? []).length === 2 && !/grant [a-z, ]+ on (table )?interno\./i.test(sql) && !/create policy "[^"]+" on interno\./.test(sql));
ok("nenhuma tabela guarda endereço de rede, fuso ou lugar", (() => {
  const tabelas = sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? [];
  return tabelas.length === 2 && !tabelas.some((t) => /\b(inet|cidr|endereco|ip|fuso|cidade|timezone)\b/i.test(t));
})());
ok("a porta roda no fim", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe no install.sql nem na versão da Alumia", !/create or replace function public\.rede_alumia_versao/.test(sql));
ok("a regra nova do depósito é restritiva (só acrescenta)", /as restrictive for insert/.test(sql) && !/drop policy if exists "rede_(midia|stories)_/.test(sql));

// ═══════════════════ 1. O monitor (puro) ═══════════════════
const tudoBem = { saude: { status: 200, json: { site: "ok", banco: "ok", versao: 4, esperada: 4, filas: { emails: true, agendados: true, faxina: null } } }, alumia: { status: 200 } };
ok("tudo respondendo: nada a avisar", avaliar(tudoBem).problemas.length === 0 && avaliar(tudoBem).estado === "ok");
ok("site fora: avisa", avaliar({ saude: { status: 0, erro: "tempo" }, alumia: { status: 0, erro: "tempo" } }).problemas.length >= 2);
ok("banco atrasado: avisa a versão", avaliar({ ...tudoBem, saude: { status: 200, json: { ...tudoBem.saude.json, banco: "desatualizado", versao: 3 } } }).problemas.some((p) => /3/.test(p) && /4/.test(p)));
ok("fila parada: avisa qual", avaliar({ ...tudoBem, saude: { status: 200, json: { ...tudoBem.saude.json, filas: { emails: false, agendados: true, faxina: false } } } }).problemas.length === 2);
ok("site interditado pela coordenação não abre alarme (é decisão da casa)", (() => {
  const r = avaliar({ saude: { status: 503, json: { erro: "area_interditada" } }, alumia: { status: 503 } });
  return r.estado === "interditado" && r.problemas.length === 0;
})());
ok("Alumia com 404 avisa", avaliar({ ...tudoBem, alumia: { status: 404 } }).problemas.length === 1);
ok("desafio da Cloudflare não é queda: nota sem alarme", (() => {
  const r = avaliar({ saude: { status: 403, desafio: true }, alumia: { status: 403, desafio: true } });
  return r.estado === "ok" && r.problemas.length === 0 && r.notas.length === 2 && /Cloudflare/.test(r.notas[0]);
})());
ok("desafio só na saúde: o resto continua valendo", (() => {
  const r = avaliar({ saude: { status: 403, desafio: true }, alumia: { status: 500 } });
  return r.estado === "falha" && r.problemas.length === 1 && /500/.test(r.problemas[0]) && r.notas.length === 1;
})());
ok("o relatório não leva endereço de rede nem e-mail", (() => {
  const texto = textoDoRelatorio(avaliar({ saude: { status: 500 }, alumia: { status: 502 } }), "2026-11-14T10:00:00Z");
  return !/@|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(texto) && /500/.test(texto);
})());
ok("o aviso da issue é texto curto, sem dado de pessoa", (() => {
  const c = corpoDoAviso({ titulo: "Monitor da Alumia: falha", texto: "- a página da Alumia respondeu 502" });
  return c.title.length <= 120 && c.body.includes("502") && !/@/.test(c.body);
})());
ok("a issue de alerta só num repositório privado (num público, ou sem resposta do GitHub, não)", podeAbrirIssue({ private: true }) && !podeAbrirIssue({ private: false }) && !podeAbrirIssue(null) && !podeAbrirIssue({}));

{
  const cfg = emailConfigurado({ OPERACAO_EMAIL: "alerta@exemplo.org", EMAIL_REMETENTE: "Instituto <ola@institutolucia.org>", RESEND_API_KEY: "re_teste" });
  ok("o alerta por e-mail sai com endereço, remetente e chave", cfg?.para === "alerta@exemplo.org" && cfg?.de.includes("institutolucia.org"));
  ok("o alerta por e-mail some sem endereço, sem chave ou com endereço inválido",
    emailConfigurado({}) === null &&
    emailConfigurado({ OPERACAO_EMAIL: "alerta@exemplo.org" }) === null &&
    emailConfigurado({ OPERACAO_EMAIL: "isso-nao-e-email", EMAIL_REMETENTE: "x@y.org", RESEND_API_KEY: "re_teste" }) === null);
}

// ═══════════════════ 2. A política das telas da Alumia ═══════════════════
{
  const config = (await import("../../next.config.ts")).default;
  const regras = await config.headers();
  const daAlumia = regras.filter((r) => /alumia/.test(r.source) || r.has?.some((h) => /alumia/.test(String(h.value))));
  const politicas = daAlumia.map((r) => r.headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "");
  ok("as telas da Alumia ganham uma política própria (pelo caminho e pelo endereço)", daAlumia.length >= 2 && politicas.every(Boolean));
  ok("a política global continua lá, inteira (com 'wasm-unsafe-eval' nos workers)", regras.some((r) => r.source.startsWith("/((?!workers/") && /Content-Security-Policy/.test(JSON.stringify(r.headers)))
    && regras.some((r) => r.source === "/workers/:path*" && /'wasm-unsafe-eval'/.test(JSON.stringify(r.headers))));
  const terceiros = /youtube|vimeo|instagram|jitsi|meet\.|phet|geogebra|netlogo|brunolemos|vlibras|jsdelivr|googleapis|gstatic|fonts\.|enem|wikimedia|https:(?=[\s;]|$)/i;
  ok("nenhuma origem de terceiros na política da Alumia (fora o desafio da entrada enquanto a 8D não o troca)", politicas.every((p) => !terceiros.test(p.replace(/https:\/\/challenges\.cloudflare\.com/g, ""))));
  ok("a política da Alumia fecha objeto, base e formulário", politicas.every((p) => /object-src 'none'/.test(p) && /base-uri 'self'/.test(p) && /form-action 'self'/.test(p) && /frame-ancestors 'self'/.test(p)));
  ok("o endereço das conversas (Faixa 2) fica fora da regra da Alumia", daAlumia.every((r) => (r.missing ?? []).some((m) => /conversas/.test(String(m.value)))));
}

// ═══════════════════ 3. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const servico = { papel: "service_role", ip: "127.0.0.1" };

// Um depósito de mentira, com o formato do Supabase (storage.objects), para a cota e a faxina.
await exec(`
  create schema if not exists storage;
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz not null default now(),
    unique (bucket_id, name));
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert on storage.objects to authenticated;
  alter table storage.objects enable row level security;
  create policy "tudo_entra" on storage.objects for insert to authenticated with check (true);
  create policy "tudo_se_ve" on storage.objects for select to authenticated using (true);
`);

const P = {};
for (const nome of ["coord", "membro", "outro", "comum"]) {
  P[nome] = await criarUsuario(`${nome}@operacao.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
for (const nome of ["coord", "membro", "outro"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("a porta não deixa nenhuma função aberta", () => dono("select interno.alumia_trancar() as r"), (r) => (r.rows[0].r.abertas ?? []).length === 0);

// 3.1 Cota
const MB = 1024 * 1024;
const objeto = (bucket, dono_, nome, bytes, horas = 0) =>
  dono("insert into storage.objects (bucket_id, name, metadata, created_at) values ($1, $2, $3, now() - make_interval(hours => $4))", [bucket, `${dono_}/${nome}`, JSON.stringify({ size: bytes, mimetype: "image/webp" }), horas]);
await objeto("rede-midia", P.membro, "a.webp", 4 * MB);
await objeto("rede-stories", P.membro, "b.mp4", 5 * MB);
await objeto("gaveta", P.membro, "fora.pdf", 50 * MB);
await espera("a pessoa vê o próprio uso (os dois depósitos da Alumia, e só eles)", () => rpc(como(P.membro), "rede_midia_meu_uso"), (r) => r.usado === 9 * MB && r.cota === 500 * MB && r.cheio === false);
await espera("o uso de outra pessoa não entra na conta", () => rpc(como(P.outro), "rede_midia_meu_uso"), (r) => r.usado === 0);
await recusa("visitante não tem uso", () => rpc(visitante, "rede_midia_meu_uso"), "permission denied");
await dono("update interno.configuracoes set valor = '{\"bytes\": 10485760}' where chave = 'midia_cota'");
await espera("com a cota de 10 MB, ainda cabe (9 MB)", () => rpc(como(P.membro), "rede_midia_cabe"), (r) => r === true);
const enviar = (sub, bucket, nome, bytes) => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub, aal: "aal2" })]);
  await banco.pg.exec("set role authenticated");
  try {
    return await banco.pg.query("insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3)", [bucket, `${sub}/${nome}`, JSON.stringify({ size: bytes })]);
  } finally {
    await banco.pg.exec("reset role");
  }
});
await espera("o depósito aceita o envio dentro da cota", () => enviar(P.membro, "rede-midia", "c.webp", 2 * MB));
await espera("agora (11 MB) a pessoa está cheia", () => rpc(como(P.membro), "rede_midia_meu_uso"), (r) => r.cheio === true && r.usado === 11 * MB);
await recusa("e o depósito recusa o próximo arquivo da Alumia", () => enviar(P.membro, "rede-stories", "d.webp", 1024), "row-level security");
await espera("os outros depósitos do site não passam pela cota da Alumia", () => enviar(P.membro, "gaveta", "outro.pdf", 1024));
await espera("outra pessoa continua enviando", () => enviar(P.outro, "rede-midia", "e.webp", 1024));
await dono("update interno.configuracoes set valor = '{\"bytes\": \"lixo\"}' where chave = 'midia_cota'");
await espera("cota estranha cai no padrão de 500 MB", () => rpc(como(P.membro), "rede_midia_meu_uso"), (r) => r.cota === 500 * MB);

// 3.2 Faxina
await objeto("rede-midia", P.outro, "velho-orfao.webp", 1000, 30);
await objeto("rede-midia", P.outro, "novo-orfao.webp", 1000, 1);
const post = (await dono("insert into interno.rede_posts (autor, texto) values ($1, 'post com imagem') returning id", [P.outro])).rows[0].id;
const usado = `${P.outro}/${"0".repeat(8)}-0000-4000-8000-${"0".repeat(12)}.webp`;
await dono("insert into storage.objects (bucket_id, name, metadata, created_at) values ('rede-midia', $1, '{\"size\": 10}', now() - interval '30 hours')", [usado]);
await dono("insert into interno.rede_midia (post, caminho, tipo) values ($1, $2, 'image/webp')", [post, usado]);
await recusa("só a chave de serviço lista a faxina", () => rpc(como(P.coord), "rede_midia_faxina_lista"), "permission denied");
await espera("a faxina lista só o órfão com mais de 24 horas (nem o novo, nem o usado, nem os stories)", () => rpc(servico, "rede_midia_faxina_lista", { p_limite: 50 }),
  (r) => Array.isArray(r) && r.length === 1 && r[0] === `${P.outro}/velho-orfao.webp`);
await espera("a faxina devolve o que fez", () => rpc(servico, "rede_midia_faxina_feito", { p_apagados: 1, p_bytes: 1000, p_falhas: 0 }), (r) => r.apagados === 1);
await recusa("conta comum não grava faxina", () => rpc(como(P.membro), "rede_midia_faxina_feito", { p_apagados: 99 }), "permission denied");

// 3.3 O painel
await recusa("conta comum não lê o espaço do painel", () => rpc(como(P.membro), "alumia_painel_espaco"), "sem_permissao");
await espera("a coordenação lê o espaço: totais por depósito, a cota, a faxina", () => rpc(como(P.coord), "alumia_painel_espaco"),
  (r) => r.depositos["rede-midia"].arquivos >= 4 && r.depositos["rede-stories"].bytes === 5 * MB && r.cota === 500 * MB && r.faxina?.detalhes?.apagados === 1 && r.orfaos === 1);
await espera("perto da cota só aparece a partir de 3 pessoas (aqui, nulo)", () => rpc(como(P.coord), "alumia_painel_espaco"), (r) => r.perto_da_cota === null && !JSON.stringify(r).includes(P.membro));

// 3.4 Horário de silêncio
const minutoAgora = Number((await dono("select (extract(hour from now() at time zone 'UTC') * 60 + extract(minute from now() at time zone 'UTC'))::integer as m")).rows[0].m);
const mod = (n) => ((n % 1440) + 1440) % 1440;
await recusa("horário igual no início e no fim é recusado", () => rpc(como(P.membro), "rede_aviso_silencio_salvar", { p_inicio: 60, p_fim: 60 }), "invalido:horario");
await recusa("minuto fora do dia é recusado", () => rpc(como(P.membro), "rede_aviso_silencio_salvar", { p_inicio: 0, p_fim: 1440 }), "invalido:horario");
await espera("guardar e ler o silêncio", async () => {
  await rpc(como(P.membro), "rede_aviso_silencio_salvar", { p_inicio: 60, p_fim: 600 });
  return rpc(como(P.membro), "rede_aviso_silencio_ver");
}, (r) => r.inicio === 60 && r.fim === 600);
await espera("a janela que atravessa a meia-noite vale dos dois lados", () => dono(`select interno.alumia_em_silencio($1, '2026-11-14 23:30+00') as a, interno.alumia_em_silencio($1, '2026-11-14 00:30+00') as b, interno.alumia_em_silencio($1, '2026-11-14 12:00+00') as c`, [P.outro]).then(async (antes) => {
  await rpc(como(P.outro), "rede_aviso_silencio_salvar", { p_inicio: 1380, p_fim: 60 });
  const depois = await dono(`select interno.alumia_em_silencio($1, '2026-11-14 23:30+00') as a, interno.alumia_em_silencio($1, '2026-11-14 00:30+00') as b, interno.alumia_em_silencio($1, '2026-11-14 12:00+00') as c`, [P.outro]);
  return { antes: antes.rows[0], depois: depois.rows[0] };
}), (r) => !r.antes.a && !r.antes.b && r.depois.a && r.depois.b && !r.depois.c);
await espera("tirar o silêncio (os dois nulos)", async () => {
  await rpc(como(P.outro), "rede_aviso_silencio_salvar", { p_inicio: null, p_fim: null });
  return rpc(como(P.outro), "rede_aviso_silencio_ver");
}, (r) => r === null);

// O push respeita o silêncio: no silêncio, nada sai e o aviso NÃO é dado como empurrado (sai depois, junto com os outros).
await dono("insert into interno.rede_push_assinaturas (usuario, endpoint, p256dh, auth, criado_em) values ($1, 'https://fcm.googleapis.com/fcm/send/teste-operacao', $2, $3, now() - interval '1 day')", [P.membro, "B".repeat(40), "a".repeat(16)]);
await dono("insert into interno.rede_avisos_prefs (usuario, tipo, canal, ligado) values ($1, 'resposta', 'push', true) on conflict do nothing", [P.membro]);
const aviso = (await dono("insert into interno.avisos (para, texto, categoria, tipo) values ($1, 'Você tem uma resposta.', 'rede', 'resposta') returning id", [P.membro])).rows[0].id;
await rpc(como(P.membro), "rede_aviso_silencio_salvar", { p_inicio: mod(minutoAgora - 30), p_fim: mod(minutoAgora + 30) });
await espera("no silêncio, o push não sai", () => rpc(servico, "rede_aviso_push_pendentes", { p_limite: 10 }), (r) => Array.isArray(r) && r.length === 0);
await espera("e o aviso continua esperando", () => dono("select empurrado from interno.avisos where id = $1", [aviso]), (r) => r.rows[0].empurrado === false);
await rpc(como(P.membro), "rede_aviso_silencio_salvar", { p_inicio: mod(minutoAgora + 120), p_fim: mod(minutoAgora + 180) });
await espera("fora do silêncio, a rodada pega o aviso", async () => {
  await rpc(servico, "rede_aviso_push_pendentes", { p_limite: 10 });
  return dono("select empurrado from interno.avisos where id = $1", [aviso]);
}, (r) => r.rows[0].empurrado === true);
await recusa("só a chave de serviço pede os pendentes do push", () => rpc(como(P.membro), "rede_aviso_push_pendentes", { p_limite: 10 }), "permission denied");

// 3.5 Saúde
await espera("a saúde responde a visitante, só com sim, não e a versão", () => rpc(visitante, "operacao_saude"), (r) => {
  const chaves = Object.keys(r).sort().join(",");
  return chaves === "agendador,agendados_em_dia,emails_em_dia,faxina_em_dia,versao" && typeof r.versao === "number" && r.emails_em_dia === true && r.faxina_em_dia === null;
});
await dono("insert into interno.emails (para, tipo, assunto, criado_em) values ('pessoa@exemplo.org', 'teste_fila', 'Teste', now() - interval '2 hours')");
await espera("um e-mail parado há 2 horas aparece como fila parada", () => rpc(visitante, "operacao_saude"), (r) => r.emails_em_dia === false);
await dono("insert into interno.configuracoes (chave, valor) values ('faxina_midia', '{}') on conflict (chave) do update set valor = excluded.valor");
await dono("update interno.alumia_operacao set rodou_em = now() - interval '5 days' where rotina = 'faxina_midia'");
await espera("faxina ligada e parada há 5 dias aparece", () => rpc(visitante, "operacao_saude"), (r) => r.faxina_em_dia === false);

// 3.6 As conferências da cópia restaurada rodam num banco recém-instalado (sem exigir dados, como no teste do workflow).
const conferir = ler("scripts/operacao/conferir-restauracao.sql");
// Desde a onda 8 o banco não tem mais o segredo fixo (a conta segura apaga): a cópia que o levasse é montada aqui.
await recusa("a cópia que levasse o segredo das origens não passa", () => exec(`insert into interno.origem_segredo (segredo) values (repeat('a', 64)) on conflict do nothing; set lucia.exigir_dados = 'nao';\n${conferir}`), "restauracao:a_copia_levou_o_segredo_das_origens");
await recusa("nem a que levasse o sal de uma hora que já acabou", () => exec(`delete from interno.origem_segredo; insert into interno.origem_sal (hora, sal) values (date_trunc('hour', now()) - interval '2 hours', repeat('b', 64)) on conflict do nothing; set lucia.exigir_dados = 'nao';\n${conferir}`), "restauracao:a_copia_levou_o_sal_das_origens");
await exec("delete from interno.origem_sal");
// A cópia semanal deixa os dados do segredo de fora (--exclude-table-data=interno.origem_segredo): aqui, o mesmo.
await espera("as conferências da restauração passam num banco instalado (sem exigir dados)", () => exec(`delete from interno.origem_segredo; set lucia.exigir_dados = 'nao';\n${conferir}`));
await recusa("e exigindo dados num banco sem perfis de verdade, falham", () => exec(`delete from interno.perfis; set lucia.exigir_dados = 'sim';\n${conferir}`), "restauracao:");

// ═══════════════════ Resultado ═══════════════════
if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`operação da Alumia (onda 8): ${certos} conferências certas.`);
process.exit(0);
