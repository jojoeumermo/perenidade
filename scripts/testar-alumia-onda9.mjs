// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 9: as migrações 20261115-alumia-o9-*.sql e o fim (20261115-alumia-onda9-fim.sql) estão coladas, inteiras e na
// ordem, no fim do install.sql; e, num Postgres de verdade (scripts/banco-local.mjs):
//   · o install.sql sobe do zero, com a versão 6, os tipos de aviso de todas as frentes e nenhuma função da rede sem porta;
//   · por cima dele, a onda inteira roda DUAS vezes seguidas sem estrago;
//   · a regra de quem vê está composta numa ordem só (a vida do post, o rótulo que esconde e a resposta recolhida da restrita) e
//     vale nas leituras: o arquivado some para os outros, a resposta da restrita chega sem texto a quem não é dona;
//   · montado como o banco estava depois da onda 8 (o install.sql até o começo da primeira migração da onda 9), a onda roda duas
//     vezes, sobe a versão de 5 para 6 e deixa o relatório de transparência, o servidor da federação e o diretório sem a porta.
// Uso: npm run testar:alumia-onda9
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

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

// ═══════════════════ 0. Os arquivos ═══════════════════
/** A ordem da onda 9 (a mesma do fim do install.sql e do SQL único da onda). */
const ORDEM = [
  "20261115-alumia-o9-protecao.sql",
  "20261115-alumia-o9-moderacao.sql",
  "20261115-alumia-o9-modoato.sql",
  "20261115-alumia-o9-publicar.sql",
  "20261115-alumia-o9-transparencia.sql",
  "20261115-alumia-o9-resto8.sql",
  "20261115-alumia-onda9-fim.sql",
];
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261115-alumia-(o9-.+|onda9-fim)\.sql$/.test(n));
ok(`toda migração da onda 9 está na ordem (fora dela: ${daOnda.filter((n) => !ORDEM.includes(n)).join(", ") || "nenhuma"})`, daOnda.length === ORDEM.length && daOnda.every((n) => ORDEM.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa, depois do fim da onda 8", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]) && posicoes[0] > install.lastIndexOf(normal(ler("supabase/migracoes/20261114-alumia-onda8-fim.sql"))));
ok("o fim da onda está no install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 6", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 6\s*\$\$/.test(fim));
ok("o fim passa a porta nas funções novas", /interno\.alumia_trancar\(\)/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
ok("toda migração da onda termina passando a porta", migracoes.every(({ sql }) => /interno\.alumia_trancar\(\)/.test(sql)));
ok("o código espera a versão 6 do banco ou mais", Number((ler("lib/rede/painel/tipos.ts").match(/VERSAO_ESPERADA_DO_BANCO = (\d+);/) ?? [])[1]) >= 6);

const lista = (s) => (s.match(/create or replace function interno\.alumia_porta_aberta[\s\S]*?\$\$;/) ?? [""])[0];
{
  // A lista de exceções da porta: a da transparência é a da onda 8 mais o relatório, sem perder a federação nem o diretório.
  const o8 = normal(lista(ler("supabase/migracoes/20261114-alumia-o8-lei.sql")));
  const o9 = normal(lista(migracoes.find((m) => m.nome === "20261115-alumia-o9-transparencia.sql").sql));
  const nomes = (l) => new Set([...l.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]));
  const faltam = [...nomes(o8)].filter((n) => !nomes(o9).has(n));
  ok(`a lista de exceções da onda 9 leva tudo o que a da onda 8 levava (faltam: ${faltam.join(", ") || "nenhuma"})`, o8.length > 0 && faltam.length === 0);
  ok("e mais o relatório de transparência, com a federação e o diretório", ["alumia_transparencia", "rede_fed_servidor", "rede_fed_midia_servidor", "rede_fed_mudanca_servidor", "rede_org_diretorio", "rede_org_mapa"].every((n) => o9.includes(`'${n}'`)));
  ok("só a transparência redefine a lista de exceções na onda 9", migracoes.filter(({ nome }) => nome !== "20261115-alumia-o9-transparencia.sql").every(({ sql }) => !/function interno\.alumia_porta_aberta\(/.test(sql)));
}
{
  // Duas migrações da onda não redefinem a mesma função (o git não acusa esse conflito; a segunda apagaria a primeira).
  const nomes = (sql) => new Set([...sql.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\s*\(/gi)].map((m) => m[1].toLowerCase()));
  const vistos = new Map();
  const repetidas = [];
  for (const { nome, sql } of migracoes.slice(0, -1)) {
    for (const f of nomes(sql)) {
      if (vistos.has(f)) repetidas.push(`${f} (${vistos.get(f)} e ${nome})`);
      else vistos.set(f, nome);
    }
  }
  ok(`nenhuma função redefinida por duas migrações da onda (${repetidas.join("; ") || "nenhuma"})`, repetidas.length === 0);
  const doFim = nomes(fim);
  const pisadas = [...doFim].filter((f) => vistos.has(f));
  ok(`o fim não redefine função de nenhuma frente (${pisadas.join(", ") || "nenhuma"})`, pisadas.length === 0);
  ok("nenhuma frente redefine a regra de quem vê (rede2_pode_ver, rede_ve, rede_silenciado, rede_post_v2): só o fim", migracoes.slice(0, -1).every(({ sql }) => !/function interno\.(rede2_pode_ver|rede_ve|rede_silenciado|rede_post_v2)\(/.test(sql)));
}
ok("o fim compõe a vida do post em rede2_pode_ver, antes do público", /v_vida := interno\.rede_vida_ve\(p, p_quem\);\s*if v_vida is not null then return v_vida; end if;\s*return case v_publico/.test(fim));
ok("o fim compõe o não listado, o arquivado e o rótulo que esconde em rede_silenciado", /interno\.rede_vida_fora_da_lista\(p, p_quem\)[\s\S]*interno\.alumia_rotulo_esconde\(p, p_quem\)/.test(fim));
ok("o fim tira a resposta recolhida da restrita do fio em rede2_pode_ver, antes da vida do post", /interno\.rede_o9_recolhida\(p, p_quem\) then\s*return false;\s*end if;[\s\S]*v_vida := interno\.rede_vida_ve/.test(fim));
ok("o fim recolhe a resposta da restrita em rede_post_v2, também o aviso de conteúdo", /interno\.rede_o9_recolhida\(p, p_quem\)[\s\S]*'aviso', '', 'cita', null, 'chamado', null, 'aguardando', true/.test(fim));
ok("o catálogo de interruptores leva alumia-fui-detido, só pelo nome, no install.sql, no backend-1 e em lib/recursos.ts",
  [install, ler("supabase/migracoes/2026-11-backend-1.sql")].every((t) => t.includes("('alumia-fui-detido', true)")) && /SO_PELO_NOME[^;]*"alumia-fui-detido"/.test(ler("lib/recursos.ts")));

// Nenhuma tabela nova da onda guarda endereço de rede (decisão de 13/11).
for (const { nome, sql } of migracoes) {
  const tabelas = [...sql.matchAll(/create table if not exists (interno\.[a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi)];
  const comIp = tabelas.filter(([, , corpo]) => /\b(ip|endereco_ip|ip_origem|inet)\b/i.test(corpo.replace(/--.*$/gm, ""))).map(([, t]) => t);
  ok(`${nome}: nenhuma tabela com coluna de endereço de rede (${comIp.join(", ") || "nenhuma"})`, comIp.length === 0);
}

const onda = migracoes.map(({ sql }) => sql).join("\n");
const FUNCOES_DA_REDE = `
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid)) as aberta
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
/** Os tipos de aviso que cada frente acrescentou ao longo das ondas: nenhum pode sumir quando outra refaz a regra. */
const TIPOS_DE_AVISO = ["resposta", "mencao", "citacao", "seguidor", "chamado", "nucleo", "moderacao", "apoio", "fed_seguidor", "fed_resposta", "fed_mencao", "fed_curtida", "fed_impulso",
  "conversa_seguida", "ajudou", "ato", "reacao_story", "lembrete", "marcacao", "estou_bem", "detido"];
const tiposQueFaltam = async (dono) => {
  const d = (await dono("select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'interno.avisos'::regclass and conname = 'avisos_tipo'")).rows[0]?.d ?? "";
  return TIPOS_DE_AVISO.filter((t) => !new RegExp(`[{,'"]${t}[},'"]`).test(d));
};

// ═══════════════════ 1. Do zero ═══════════════════
{
  const banco = await criarBanco();
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o install.sql sobe do zero e responde a versão 6 ou mais, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.5" }, "rede_alumia_versao"), (v) => v >= 6);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", async () => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`), (l) => l.length === 0);
  await espera("as funções novas de membro da onda passam pela porta (proteção, moderação, modo ato, vida do post, rótulos, sair só da Alumia)", async () => (await dono(`select p.proname, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname in ('rede_o9_restringir', 'rede_o9_blindagem', 'alumia_mod_automod_salvar', 'alumia_com_pedir', 'rede_pub_arquivar', 'rede_pub_vida_publicar', 'alumia_rotulos_assinar', 'alumia_transp_painel', 'rede_meusdados_sair', 'alumia_ato_fui_detido')`)).rows,
    (r) => r.length === 10 && r.every((x) => x.porta));
  await espera("o relatório de transparência fica sem a porta (público como a página)", async () => (await dono("select prosrc ~ 'interno\\.alumia_porta\\(\\)' as t from pg_proc where proname = 'alumia_transparencia'")).rows[0], (r) => r?.t === false);
  await espera("nenhum tipo de aviso se perdeu (federação, B1, marcação, estou bem e detido)", () => tiposQueFaltam(dono), (f) => f.length === 0);
  await espera("a onda roda de novo por cima do install.sql", () => exec(onda));
  await espera("e mais uma vez, sem estrago (idempotente)", () => exec(onda));
  await espera("fica na versão 6 (o fim da onda 9 rodado de novo) e sem porta aberta", async () => [await rpc({ papel: "anon", ip: "203.0.113.6" }, "rede_alumia_versao"), (await dono("select interno.alumia_trancar() as r")).rows[0].r], ([v, r]) => v === 6 && r.abertas.length === 0);
  await espera("e os tipos de aviso continuam todos lá", () => tiposQueFaltam(dono), (f) => f.length === 0);

  // ── A regra de quem vê, composta, nas leituras ──
  let ip = 20;
  const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  const P = {};
  for (const nome of ["ana", "bia", "caio"]) {
    P[nome] = await banco.criarUsuario(`${nome}@onda9.local`, nome);
    await rpc(como(P[nome]), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1, rede_modo = 'aberto', rede_invisivel = false where id = $1", [P[nome], `Codinome ${nome}`, `onda9_${nome}`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
  }
  await dono("delete from interno.papeis");
  await dono("update auth.users set created_at = now() - interval '30 days'");
  const zerar = () => dono("delete from interno.limites");
  const ve = async (id, quem) => (await dono("select interno.rede_ve(p, $2::uuid) as v from interno.rede_posts p where p.id = $1", [id, quem ? P[quem] : null])).rows[0].v;

  const raizPost = await espera("ana publica", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Plenária do bairro no sábado, quem vem?" } }), (r) => typeof r?.id === "string");
  await espera("ana restringe o caio", () => rpc(como(P.ana), "rede_o9_restringir", { p_handle: "onda9_caio" }), (r) => r?.restrita === true);
  await zerar();
  const resposta = await espera("caio responde (a resposta entra, recolhida)", () => rpc(como(P.caio), "rede_publicar", { p: { texto: "Texto da resposta do caio", resposta_a: raizPost?.id } }), (r) => typeof r?.id === "string");
  await zerar();
  const daArvore = async (quem) => ((await rpc(como(P[quem]), "rede_conv_arvore", { p_id: raizPost.id })).respostas ?? []).find((x) => x.id === resposta?.id);
  await espera("para bia (nem autora nem dona) a resposta nem chega: sem carimbo, ninguém deduz que ana restringiu caio", () => daArvore("bia"), (r) => r === undefined);
  await espera("e para visitante também não", () => ve(resposta?.id, null), (v) => v === false);
  await espera("se alguma leitura chegar a ela por fora, rede_post_v2 vai sem texto e sem o aviso de conteúdo", async () => {
    await dono("update interno.rede_posts set aviso = 'AVISO_RECOLHIDO' where id = $1", [resposta?.id]);
    return (await dono("select interno.rede_post_v2(p, $2::uuid) as j from interno.rede_posts p where p.id = $1", [resposta?.id, P.bia])).rows[0].j;
  }, (j) => j && j.texto === "" && j.aviso === "" && j.aguardando === true && !JSON.stringify(j).includes("AVISO_RECOLHIDO"));
  await espera("para ana (dona da conversa) a resposta chega inteira", () => daArvore("ana"), (r) => r && r.texto === "Texto da resposta do caio" && !r.aguardando);
  await espera("para caio (quem escreveu) a resposta chega inteira", () => daArvore("caio"), (r) => r && r.texto === "Texto da resposta do caio" && !r.aguardando);

  await zerar();
  const outro = await espera("ana publica outro post", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Post que vai para o arquivo" } }), (r) => typeof r?.id === "string");
  await espera("antes de arquivar, bia vê", () => ve(outro?.id, "bia"), (v) => v === true);
  await espera("ana arquiva", () => rpc(como(P.ana), "rede_pub_arquivar", { p_post: outro?.id, p_sim: true }));
  await espera("arquivado: bia não vê mais (regra de dois argumentos e a da Rede de hoje), ana ainda vê", async () => [await ve(outro?.id, "bia"), await ve(outro?.id, "ana"),
    (await dono("select set_config('request.jwt.claim.sub', $2, true), interno.rede_ve(p) as v from interno.rede_posts p where p.id = $1", [outro?.id, P.bia])).rows[0].v],
  ([b, a, antigo]) => b === false && a === true && antigo === false);
  await espera("arquivado: sai das listas da própria autora também (fica na lista dos arquivados)", async () => (await dono("select interno.rede_silenciado(p, $2::uuid) as s from interno.rede_posts p where p.id = $1", [outro?.id, P.ana])).rows[0].s, (s) => s === true);
  await banco.pg.close?.();
}

// ═══════════════════ 2. O banco depois da onda 8 ═══════════════════
{
  const banco = await criarBanco({ antesDe: migracoes[0].sql });
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o banco de antes responde a versão 5 (onda 8)", () => rpc({ papel: "anon", ip: "203.0.113.7" }, "rede_alumia_versao"), (v) => v === 5);
  await espera("a onda 9 inteira roda sobre o banco da onda 8", () => exec(onda));
  await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
  await espera("rede_alumia_versao() = 6, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.8" }, "rede_alumia_versao"), (v) => v === 6);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", async () => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`), (l) => l.length === 0);
  await espera("o relatório de transparência, o servidor da federação, o diretório e a revisão de conta ficaram sem a porta", async () => (await dono("select bool_or(prosrc ~ 'interno\\.alumia_porta\\(\\)') as t, count(*)::int as n from pg_proc where proname in ('alumia_transparencia', 'rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa', 'alumia_lei_minha_conta', 'alumia_triagem_convites')")).rows[0], (r) => r.t === false && r.n >= 6);
  await espera("nenhum tipo de aviso se perdeu", () => tiposQueFaltam(dono), (f) => f.length === 0);
  await espera("a coordenação liga a trava (nenhuma porta aberta)", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r?.exigir === true);
  await espera("com a trava ligada, visitante ainda lê o relatório de transparência e o diretório das organizações", async () => [await rpc({ papel: "anon", ip: "203.0.113.9" }, "alumia_transparencia"), await rpc({ papel: "anon", ip: "203.0.113.10" }, "rede_org_diretorio", { p: {} })],
    ([t, d]) => t && typeof t === "object" && Array.isArray(d?.itens));
  await dono("select interno.alumia_entrada_ligar(false)");
  await banco.pg.close?.();
}

console.log(`Alumia (fecho da onda 9): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
