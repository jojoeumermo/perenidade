// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a migração da conversa a dois da onda R2 (supabase/migracoes/20261124-r2-dupla.sql) num Postgres de verdade
// (scripts/banco-local.mjs), rodada três vezes sobre o install.sql com conversas do beta dentro:
//   - zerar o beta: nenhuma tabela, função, gatilho ou sequência do chat a dois velho sobra, e nenhuma linha que ligue conta a
//     conversa (quem tem o banco inteiro não descobre quem conversava com quem);
//   - os arquivos cifrados da conta: cada pessoa lê e grava só o dela, a versão impede um aparelho de apagar o que o outro
//     gravou, o tamanho fora das faixas é recusado, ninguém de fora chama, a tabela não tem permissão direta;
//   - a carona: só o codinome, com as regras de antes (o próprio, bloqueado, invisível e ato apagado não abrem);
//   - as funções redefinidas continuam inteiras e passam pela porta.
// Uso: node scripts/testar-r2-dupla-banco.mjs
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
const sql = ler("supabase/migracoes/20261124-r2-dupla.sql");
ok("a migração termina trancando as funções na porta da Alumia", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia nem na lista de exceções da porta", !/function public\.rede_alumia_versao|function interno\.alumia_porta_aberta/.test(sql));
ok("nenhum parâmetro do tipo linha de tabela", !/\(\s*[a-z_]+ interno\.[a-z_]+[,)]/.test(sql.replace(/returns interno\.[a-z_]+/g, "")));
ok("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("toda função é security definer com search_path fixo (a de tamanho só tem o search_path)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length === 8 && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f) && (/security definer/.test(f) || /rede_cofre_tamanho_ok/.test(f)));
})());
ok("nada escreve 'Rede Lúcia'", !/Rede Lúcia/.test(sql.replace(/^--.*$/gm, "")));
ok("as faixas do arquivo cifrado são as mesmas no aparelho e no banco", (() => {
  const ts = ler("lib/rede/aparelhos/arquivo.ts");
  return /FAIXAS_DO_ARQUIVO = \[64 \* 1024, 256 \* 1024, 1024 \* 1024, 4 \* 1024 \* 1024\]/.test(ts) && sql.includes("array[65536, 262144, 1048576, 4194304]")
    && /33 \+ 24 \+ f \+ 17 \* \(f \/ 65536\)/.test(sql);
})());

// ═══════════════════ 1. O banco do beta, com conversas ═══════════════════
// O install.sql já traz a R2 inteira no fim: o banco do beta é o install.sql até antes da primeira migração da R2 (a das caixas, que
// roda antes desta na ordem do desenho e vai por cima dele aqui).
const CAIXAS = ler("supabase/migracoes/20261124-r2-caixas.sql");
const banco = await criarBanco({ antesDe: CAIXAS });
await banco.exclusivo(() => banco.pg.exec(CAIXAS));
const { dono, criarUsuario, rpc } = banco;
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const todas = async (s, v = []) => (await dono(s, v)).rows;
let ip = 10;
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: `198.51.100.${ip++ % 250}` });

const P = {};
for (const nome of ["ana", "bia", "caio", "invisivel", "fechada"]) {
  P[nome] = await criarUsuario(`${nome}@r2dupla.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `${nome}_r2`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [P.invisivel]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($2, $1)", [P.ana, P.bia]);

// As conversas do beta, pelas funções de antes (o que o beta tem de verdade no servidor).
const conversa = await espera("antes: a Ana abre conversa com a Bia pelo chat velho", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "bia_r2" }), (c) => typeof c?.id === "string");
await espera("antes: a Ana pede conversa ao Caio pelo chat velho", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "caio_r2" }), (c) => typeof c?.id === "string");
await espera("antes: há mensagem, caixa selada e preferência guardadas", async () => {
  await dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) select $1, $2, 1, 'c2.' || repeat('A', 360), now() + interval '7 days' where exists (select 1 from information_schema.columns where table_schema = 'interno' and table_name = 'rede_dm_mensagens')", [conversa?.id, P.ana]).catch(() => undefined);
  await dono("insert into interno.rede_sel_caixa (para, envelope, dia) values ($1, repeat('B', 100), current_date)", [P.bia]).catch(() => undefined);
  await rpc(como(P.fechada), "rede_dm_prefs", { p_quem_pode: "ninguem", p_prazo_dias: 7 });
  return (await um("select (select count(*) from interno.rede_dm_conversas)::int as c, (select count(*) from interno.rede_dm_prefs)::int as p")) ;
}, (r) => r.c === 2 && r.p >= 1);

// ═══════════════════ 2. A migração, três vezes ═══════════════════
for (let i = 1; i <= 3; i++) await espera(`a migração roda (vez ${i})`, () => banco.exclusivo(() => banco.pg.exec(sql)));

// ═══════════════════ 3. Zerar o beta: nada sobra ═══════════════════
await espera("nenhuma tabela do chat a dois velho sobra (rede_dm_*, rede_olm_*, rede_sel_*), em esquema nenhum", () => todas("select n.nspname || '.' || c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relname ~ '^rede_(dm|olm|sel)_'"), (r) => r.length === 0);
await espera("nenhuma função do chat a dois velho sobra", () => todas("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.proname ~ '^rede_(dm|olm|sel)_'"), (r) => r.length === 0);
await espera("nenhum gatilho ou sequência do chat velho sobra", () => todas("select tgname as n from pg_trigger where tgname ~ '^rede_(olm|sel)_' union all select relname from pg_class where relkind = 'S' and relname ~ '^rede_(dm|olm|sel)_'"), (r) => r.length === 0);
await espera("nenhuma função de interno ou public lê o chat velho", () => todas("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.prosrc ~ 'rede_(dm|olm|sel)_(conversas|mensagens|embrulhos|chaves|prefs|recusas|caixa|unicas|reserva|aparelhos|contagem|entrega)'"), (r) => r.length === 0);
await espera("com o banco inteiro, nenhuma tabela do chat guarda duas contas lado a lado (quem conversa com quem)", async () => {
  // As tabelas com duas colunas que apontam para perfis são relações públicas da rede (seguir, bloquear, amizade...). Nenhuma delas
  // pode ser do chat a dois.
  const r = await todas(`select c.conrelid::regclass::text as t from pg_constraint c where c.contype = 'f' and c.confrelid = 'interno.perfis'::regclass
    group by c.conrelid having count(*) >= 2`);
  // (interno.conversas e conversa_relatos são do chat da equipe no painel, da frente dela.)
  return r.map((x) => x.t).filter((t) => /^interno\.(rede_(dm|olm|sel)_|rede_cofres)/.test(t));
}, (r) => r.length === 0);
await espera("a tabela nova tem uma conta só por linha e nenhuma coluna de hora (só o dia)", () => todas("select column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = 'rede_cofres_da_conta' order by column_name"),
  (r) => r.map((c) => `${c.column_name}:${c.data_type}`).join(",") === "blob:bytea,dia:date,tipo:text,usuario:uuid,versao:integer");

// ═══════════════════ 4. Os arquivos cifrados da conta ═══════════════════
const faixa = (f) => 33 + 24 + f + 17 * (f / 65536);
const arquivo = (f, byte = 7) => new Uint8Array(Buffer.alloc(faixa(f), byte));
// O rpc do banco local manda objeto como JSON; o arquivo (bytea) vai como hexadecimal e o banco o decodifica, como a API faria.
const gravar = (quem, tipo, versao, bytes) =>
  banco.exclusivo(async () => {
    const claims = JSON.stringify({ role: quem.papel, ...(quem.sub ? { sub: quem.sub } : {}), ...(quem.aal ? { aal: quem.aal } : {}) });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, JSON.stringify({ "x-forwarded-for": "127.0.0.1" })]);
    await banco.pg.exec(`set role ${quem.papel}`);
    try {
      return (await banco.pg.query("select public.rede_cofre_gravar(p_tipo => $1, p_versao => $2, p_blob => decode($3, 'hex')) as r", [tipo, versao, Buffer.from(bytes).toString("hex")])).rows[0].r;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
await espera("o banco aceita as quatro faixas e só elas", async () => {
  const r = await um("select interno.rede_cofre_tamanho_ok($1) a, interno.rede_cofre_tamanho_ok($2) b, interno.rede_cofre_tamanho_ok($3) c, interno.rede_cofre_tamanho_ok($4) d, interno.rede_cofre_tamanho_ok($5) e, interno.rede_cofre_tamanho_ok($6) f",
    [faixa(65536), faixa(262144), faixa(1048576), faixa(4194304), faixa(65536) + 1, 1000]);
  return Object.values(r);
}, (r) => r.join(",") === "true,true,true,true,false,false");
await espera("a Ana grava a lista (versão 0 → 1)", () => gravar(como(P.ana), "lista", 0, arquivo(65536)), (r) => r?.versao === 1);
await recusa("outro aparelho que leu a versão 0 não apaga o que a Ana gravou", () => gravar(como(P.ana), "lista", 0, arquivo(65536, 9)), "versao_ocupada");
await espera("com a versão certa, grava a 2", () => gravar(como(P.ana), "lista", 1, arquivo(262144, 9)), (r) => r?.versao === 2);
await recusa("tamanho fora das faixas é recusado (diria quantas conversas)", () => gravar(como(P.ana), "copia", 0, new Uint8Array(5000)), "invalido:tamanho");
await recusa("tipo que não existe é recusado", () => gravar(como(P.ana), "conversas", 0, arquivo(65536)), "invalido:tipo");
await espera("a Ana lê a dela (versão 2, a faixa de 256 KB, só o dia)", () => rpc(como(P.ana), "rede_cofre_ler", { p_tipo: "lista" }),
  (r) => r?.versao === 2 && Buffer.from(r.blob, "base64").length === faixa(262144) && /^\d{4}-\d{2}-\d{2}$/.test(r.dia));
await espera("a Bia não lê a da Ana (cada uma só a dela)", () => rpc(como(P.bia), "rede_cofre_ler", { p_tipo: "lista" }), (r) => r === null);
await recusa("sem sessão não lê", () => rpc({ papel: "anon" }, "rede_cofre_ler", { p_tipo: "lista" }), "permission denied");
await recusa("sem sessão não grava", () => gravar({ papel: "anon" }, "lista", 2, arquivo(65536)), "permission denied");
await espera("a Ana apaga a dela", () => rpc(como(P.ana), "rede_cofre_apagar", { p_tipo: "lista" }), (r) => r?.apagado === true);
await espera("apagada, a leitura volta vazia", () => rpc(como(P.ana), "rede_cofre_ler", { p_tipo: "lista" }), (r) => r === null);
await espera("RLS ligada e nenhuma permissão direta na tabela para anon e authenticated", () => um(`select c.relrowsecurity as rls,
    has_table_privilege('anon', 'interno.rede_cofres_da_conta', 'select') as a, has_table_privilege('authenticated', 'interno.rede_cofres_da_conta', 'select') as b
    from pg_class c where c.oid = 'interno.rede_cofres_da_conta'::regclass`), (r) => r.rls === true && r.a === false && r.b === false);
await espera("a função de tamanho de interno não é chamável de fora", () => um("select has_function_privilege('anon', 'interno.rede_cofre_tamanho_ok(integer)', 'execute') a, has_function_privilege('authenticated', 'interno.rede_cofre_tamanho_ok(integer)', 'execute') b"), (r) => !r.a && !r.b);

// ═══════════════════ 5. A carona ═══════════════════
await dono(`create table if not exists interno.rede_ato_caronas (
  id uuid primary key default gen_random_uuid(),
  ato uuid not null references interno.rede_chamados (post) on delete cascade,
  tipo text not null check (tipo in ('oferta', 'pedido')),
  meio text not null default 'carro',
  saida_publica text not null,
  vagas smallint,
  sai_em timestamptz,
  quem uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
)`);
const novoAto = async (autor, apagado = false) => {
  const post = (await um("insert into interno.rede_posts (autor, texto, apagado_em) values ($1, 'Ato pela moradia', $2) returning id", [autor, apagado ? new Date().toISOString() : null])).id;
  await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto) values ($1, now() + interval '3 days', 'São Paulo', 'Praça da Sé')", [post]);
  return post;
};
const novaCarona = async (ato, quem) => (await um("insert into interno.rede_ato_caronas (ato, tipo, saida_publica, vagas, quem) values ($1, 'oferta', 'Metrô Itaquera', 3, $2) returning id", [ato, quem])).id;
const ato = await novoAto(P.bia);
const daBia = await novaCarona(ato, P.bia);
const daInvisivel = await novaCarona(ato, P.invisivel);
const escondida = await novaCarona(await novoAto(P.bia, true), P.bia);
await espera("a carona dá só o codinome de quem a publicou (nada de id de conversa, nada de conta)", () => rpc(como(P.caio), "rede_carona_contato", { p_carona: daBia }), (r) => JSON.stringify(r) === JSON.stringify({ codinome: "bia_r2" }));
await espera("a própria carona não dá contato", () => rpc(como(P.bia), "rede_carona_contato", { p_carona: daBia }), (r) => r?.erro === "dm_fechada");
await espera("pessoa invisível não aparece pela carona", () => rpc(como(P.caio), "rede_carona_contato", { p_carona: daInvisivel }), (r) => r?.erro === "dm_fechada");
await recusa("carona de ato apagado é como se não existisse", () => rpc(como(P.caio), "rede_carona_contato", { p_carona: escondida }), "nao_encontrado");
await recusa("carona que não existe", () => rpc(como(P.caio), "rede_carona_contato", { p_carona: "00000000-0000-4000-8000-000000000000" }), "nao_encontrado");
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.bia, P.caio]).catch(async () => {
  await rpc(como(P.bia), "rede_bloquear", { p_usuario: P.caio, p_sim: true });
});
await espera("quem foi bloqueado não recebe o contato (nem fica sabendo da carona)", async () => {
  try {
    return await rpc(como(P.caio), "rede_carona_contato", { p_carona: daBia });
  } catch (erro) {
    return { erro: String(erro.message) };
  }
}, (r) => r?.erro === "dm_fechada" || /nao_encontrado/.test(r?.erro ?? ""));
await recusa("sem sessão não chama", () => rpc({ papel: "anon" }, "rede_carona_contato", { p_carona: daBia }), "permission denied");

// ═══════════════════ 6. As redefinidas e a porta ═══════════════════
await espera("as funções novas e as redefinidas passam pela porta", () => todas(`select p.proname, p.prosrc ~ 'alumia_porta\\(\\)' as porta from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rede_cofre_ler', 'rede_cofre_gravar', 'rede_cofre_apagar', 'rede_carona_contato', 'rede_meusdados_mais', 'rede_alumia_emblemas')`),
  (r) => r.length === 6 && r.every((x) => x.porta));
await espera("o emblema de conversas é 0 (o aparelho conta)", () => rpc(como(P.ana), "rede_alumia_emblemas"), (r) => r?.conversas === 0 && "avisos" in r && "atos" in r);
await gravar(como(P.ana), "copia", 0, arquivo(65536));
await espera("\"meus dados\" sai sem erro e sem o arquivo cifrado inteiro", () => rpc(como(P.ana), "conta_meus_dados"), (r) => r?.conta?.id === P.ana && !Object.keys(r).some((k) => k.startsWith("rede_cofres_da_conta")));
await espera("\"meus dados (mais)\" diz que a conversa mora no aparelho e mostra só tipo, versão, dia e tamanho do arquivo", async () => {
  await dono("update interno.perfis set atualizado_em = atualizado_em where id = $1", [P.ana]).catch(() => undefined);
  return banco.exclusivo(async () => {
    const agora = Math.floor(Date.now() / 1000);
    const amr = [{ method: "password", timestamp: agora - 3600 }, { method: "totp", timestamp: agora - 60 }];
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [JSON.stringify({ role: "authenticated", sub: P.ana, aal: "aal2", amr })]);
    await banco.pg.exec("set role authenticated");
    try {
      return (await banco.pg.query("select public.rede_meusdados_mais() as r")).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
}, (r) => r?.preferencias?.conversas?.onde === "no_aparelho" && JSON.stringify(r.preferencias.conversas.arquivos_cifrados).includes("copia") && !JSON.stringify(r).includes("blob"));
await espera("nenhum corpo de função fala 'Rede Lúcia'", () => todas("select proname from pg_proc where proname in ('rede_cofre_ler','rede_cofre_gravar','rede_cofre_apagar','rede_carona_contato','conta_meus_dados','rede_meusdados_mais','rede_alumia_emblemas') and prosrc like '%Rede Lúcia%'"), (r) => r.length === 0);

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA:", f);
process.exit(falhas.length ? 1 : 0);
