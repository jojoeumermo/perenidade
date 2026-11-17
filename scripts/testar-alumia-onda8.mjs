// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fecho da onda 8: as migrações 20261114-alumia-o8-*.sql e o fim (20261114-alumia-onda8-fim.sql) estão coladas, inteiras e na
// ordem, no fim do install.sql; e, num Postgres de verdade (scripts/banco-local.mjs):
//   · o install.sql sobe do zero, com a versão 5 e nenhuma função da rede sem porta;
//   · por cima dele, a onda inteira roda DUAS vezes seguidas sem estrago;
//   · montado como o banco estava depois da onda 7 (o install.sql até o começo da primeira migração da onda 8), a onda roda duas
//     vezes, sobe a versão de 4 para 5 e deixa as exceções novas da porta (o pedido de revisão de conta e a marca de convite da
//     triagem) sem a porta, mesmo que a porta de entrada tenha rodado antes da lista nova;
//   · o pânico da conta segura e o apagamento da conta (meus dados) não desfazem um ao outro.
// Uso: npm run testar:alumia-onda8
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
/** A ordem da onda 8 (a mesma do fim do install.sql e do SQL único da onda). */
const ORDEM = [
  "20261114-alumia-o8-conta.sql",
  "20261114-alumia-o8-lei.sql",
  "20261114-alumia-o8-meusdados.sql",
  "20261114-alumia-o8-voto.sql",
  "20261114-alumia-o8-porta.sql",
  "20261114-alumia-o8-operacao.sql",
  "20261114-alumia-onda8-fim.sql",
];
const pasta = path.join(raiz, "supabase", "migracoes");
const daOnda = fs.readdirSync(pasta).filter((n) => /^20261114-alumia-(o8-.+|onda8-fim)\.sql$/.test(n));
ok(`toda migração da onda 8 está na ordem (fora dela: ${daOnda.filter((n) => !ORDEM.includes(n)).join(", ") || "nenhuma"})`, daOnda.length === ORDEM.length && daOnda.every((n) => ORDEM.includes(n)));
const migracoes = ORDEM.map((n) => ({ nome: n, sql: ler(`supabase/migracoes/${n}`) }));
const install = normal(ler("supabase/install.sql"));
const posicoes = migracoes.map(({ sql }) => install.lastIndexOf(normal(sql)));
ok("cada migração da onda está inteira (idêntica) no install.sql", posicoes.every((i) => i > 0));
ok("e na ordem certa, depois do fim da onda 7", posicoes.every((i, k) => k === 0 || i > posicoes[k - 1]) && posicoes[0] > install.lastIndexOf(normal(ler("supabase/migracoes/20261113-alumia-onda7-fim.sql"))));
ok("o fim da onda é a última do install.sql (depois dele, só migrações datadas que entraram depois)", noFimDoInstall(migracoes.at(-1).sql));
const fim = migracoes.at(-1).sql;
ok("o fim sobe a versão para 5", /create or replace function public\.rede_alumia_versao\(\)[\s\S]*?select 5\s*\$\$/.test(fim));
ok("o fim passa a porta nas funções novas", /interno\.alumia_trancar\(\)/.test(fim));
ok("só o fim mexe na versão", migracoes.slice(0, -1).every(({ sql }) => !/function public\.rede_alumia_versao/.test(sql)));
ok("toda migração da onda termina passando a porta", migracoes.every(({ sql }) => /interno\.alumia_trancar\(\)/.test(sql)));
const lista = (s) => (s.match(/create or replace function interno\.alumia_porta_aberta[\s\S]*?\$\$;/) ?? [""])[0];
ok("a lista de exceções da porta é uma só nas quatro migrações que a definem (portas, portas do Fediverso, entrada e lei)", (() => {
  const l = ["20261112-alumia-portas.sql", "20261113-alumia-o7-portas-fediverso.sql", "20261113-alumia-o7-entrada.sql", "20261114-alumia-o8-lei.sql"].map((n) => normal(lista(ler(`supabase/migracoes/${n}`))));
  return l[0].length > 0 && l.every((x) => x === l[0]) && ["rede_fed_servidor", "rede_org_diretorio", "alumia_lei_minha_conta", "alumia_lei_recorrer_conta", "alumia_triagem_convites"].every((n) => l[0].includes(`'${n}'`));
})());
ok("nenhuma outra migração da onda redefine a lista de exceções nem a porta", migracoes.filter(({ nome }) => nome !== "20261114-alumia-o8-lei.sql").every(({ sql }) => !/function interno\.alumia_(porta_aberta|porta)\(/.test(sql)));
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
}
ok("o catálogo de interruptores leva alumia-convites, só pelo nome, no install.sql e no backend-1", [install, ler("supabase/migracoes/2026-11-backend-1.sql")].every((t) => t.includes("('alumia-convites', true)")));

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

// ═══════════════════ 1. Do zero ═══════════════════
{
  const banco = await criarBanco();
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  // Do zero, o install.sql já leva as ondas seguintes (a 9 sobe para 6): aqui vale "5 ou mais".
await espera("o install.sql sobe do zero e responde a versão 5 ou mais, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.5" }, "rede_alumia_versao"), (v) => v >= 5);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", async () => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`), (l) => l.length === 0);
  await espera("as funções novas da onda passam pela porta (conta, lei, meus dados, convites, operação)", async () => (await dono(`select p.proname, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname in ('alumia_conta_situacao', 'alumia_conta_aparelhos', 'alumia_termos_aceitar', 'alumia_lei_painel', 'rede_meusdados_exportar', 'rede_meusdados_apagar', 'alumia_convite_criar', 'alumia_painel_porta', 'rede_midia_meu_uso', 'alumia_painel_espaco', 'alumia_painel_apagamentos')`)).rows,
    (r) => r.length === 11 && r.every((x) => x.porta));
  await espera("a onda roda de novo por cima do install.sql", () => exec(onda));
  await espera("e mais uma vez, sem estrago (idempotente)", () => exec(onda));
  await espera("continua na versão 5 ou mais e sem porta aberta", async () => [await rpc({ papel: "anon", ip: "203.0.113.6" }, "rede_alumia_versao"), (await dono("select interno.alumia_trancar() as r")).rows[0].r], ([v, r]) => v >= 5 && r.abertas.length === 0);

  // ── O pânico e o apagamento da conta não se desfazem ──
  const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "198.51.100.30" });
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  const pessoa = async (n) => {
    const id = await banco.criarUsuario(`p${n}@onda8.local`, `Pessoa ${n}`);
    await rpc(como(id), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1, rede_modo = 'aberto', rede_invisivel = false where id = $1", [id, `Codinome ${n}`, `onda8_${n}`]);
    return id;
  };
  const marcarApagamento = (id) => dono(`insert into interno.alumia_apagamentos (usuario, apagar_em, estava_invisivel)
      select id, now() + interval '7 days', coalesce(rede_invisivel, false) from interno.perfis where id = $1;
    `.replace(/;\s*$/, ""), [id]).then(() => dono("update interno.perfis set rede_invisivel = true where id = $1", [id]));
  const invisivel = async (id) => (await dono("select rede_invisivel as v from interno.perfis where id = $1", [id])).rows[0].v;

  const a = await pessoa("a");
  await marcarApagamento(a);
  await espera("apagamento marcado, depois o pânico com esconder", () => rpc(como(a), "alumia_conta_panico", { p_esconder: true }), (r) => r?.ok === true);
  await espera("desistir do apagamento não mostra o perfil que o pânico escondeu", async () => { await rpc(como(a), "rede_meusdados_cancelar"); return invisivel(a); }, (v) => v === true);
  await espera("e o mostrar do pânico mostra", async () => { await rpc(como(a), "alumia_conta_mostrar_perfil"); return invisivel(a); }, (v) => v === false);

  const b = await pessoa("b");
  await espera("o pânico primeiro", () => rpc(como(b), "alumia_conta_panico", { p_esconder: true }), (r) => r?.ok === true);
  await marcarApagamento(b);
  await espera("com o apagamento marcado, o mostrar do pânico não põe o perfil no ar antes do prazo", async () => { await rpc(como(b), "alumia_conta_mostrar_perfil"); return invisivel(b); }, (v) => v === true);
  await espera("e desistir devolve o perfil como a pessoa quer agora (no ar)", async () => { await rpc(como(b), "rede_meusdados_cancelar"); return invisivel(b); }, (v) => v === false);
  await banco.pg.close?.();
}

// ═══════════════════ 2. O banco depois da onda 7 ═══════════════════
{
  const banco = await criarBanco({ antesDe: migracoes[0].sql });
  const { dono, rpc } = banco;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  await espera("o banco de antes responde a versão 4 (onda 7)", () => rpc({ papel: "anon", ip: "203.0.113.7" }, "rede_alumia_versao"), (v) => v === 4);
  // A porta de entrada rodada sozinha, antes da lei (com a lista de exceções da onda 7): a marca da triagem nasce trancada.
  await espera("a porta de entrada rodada sozinha antes da lei tranca a marca da triagem", async () => {
    await exec(`create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
      select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                        'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                        'rede_fed_situacao', 'rede_antigo', 'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor')
          or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
          or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
          or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
    $$;`);
    await exec(migracoes.find((m) => m.nome === "20261114-alumia-o8-porta.sql").sql);
    return (await dono("select prosrc ~ 'interno\\.alumia_porta\\(\\)' as t from pg_proc where proname = 'alumia_triagem_convites'")).rows[0].t;
  }, (t) => t === true);
  await espera("a onda 8 inteira roda sobre o banco da onda 7", () => exec(onda));
  await espera("e de novo, logo em seguida, sem estrago (idempotente)", () => exec(onda));
  await espera("rede_alumia_versao() = 5, para visitante também", () => rpc({ papel: "anon", ip: "203.0.113.8" }, "rede_alumia_versao"), (v) => v === 5);
  await espera("nenhuma função da rede ficou sem porta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
  await espera("toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista de exceções", async () => (await dono(FUNCOES_DA_REDE)).rows.filter((f) => !f.porta && !f.aberta).map((f) => `${f.nome}(${f.args})`), (l) => l.length === 0);
  await espera("as exceções novas (revisão de conta e marca de convite) ficaram sem a porta; o servidor da federação e o diretório também", async () => (await dono("select bool_or(prosrc ~ 'interno\\.alumia_porta\\(\\)') as t, count(*)::int as n from pg_proc where proname in ('alumia_lei_minha_conta', 'alumia_lei_recorrer_conta', 'alumia_triagem_convites', 'rede_fed_servidor', 'rede_org_diretorio', 'rede_org_mapa')")).rows[0], (r) => r.t === false && r.n >= 6);
  await espera("a coordenação liga a trava (nenhuma porta aberta)", async () => (await dono("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r?.exigir === true);
  await espera("com a trava ligada, visitante ainda vê o diretório das organizações", () => rpc({ papel: "anon", ip: "203.0.113.9" }, "rede_org_diretorio", { p: {} }), (r) => Array.isArray(r?.itens));
  await dono("select interno.alumia_entrada_ligar(false)");
  await banco.pg.close?.();
}

console.log(`Alumia (fecho da onda 8): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
