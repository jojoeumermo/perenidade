// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda 14, frente 14A: a revisão do banco. VARRE O CATÁLOGO INTEIRO do banco montado pelo install.sql (com
// 20261120-alumia-o14-banco.sql por cima, duas vezes, quando ela ainda não estiver colada no fim) e o texto de todas as migrações.
// Nada aqui lista as funções de uma onda: o que as ondas 12 e 13 (e a integração das faixas) criarem entra na varredura sozinho.
//   · toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está em interno.alumia_porta_aberta;
//   · toda função security definer (public e interno) tem search_path fixo terminando em pg_temp; as public.rede_*/alumia_* são
//     security definer (fora as exceções escritas abaixo, com motivo);
//   · o que só o servidor chama (interno.servico) e as funções de gatilho não ficam abertas a anon/authenticated;
//   · toda tabela de interno com RLS ligada, SEM política e sem privilégio de tabela para anon/authenticated; nenhuma tabela da rede
//     no esquema public;
//   · nenhuma função devolve lista de pessoas de uma relação (quem curtiu, segue, votou, assina, doou), fora as revistas abaixo;
//   · número de pessoas só a partir de 3 nas contagens de reação, presença, membros e seguidores, fora as revistas abaixo;
//   · nenhuma security definer de interno aberta a todo mundo (no Supabase, anon e authenticated usam o esquema interno pelas
//     regras do storage); nenhuma coluna de endereço de rede; o pgcrypto sempre com o esquema dele;
//   · nenhuma função com parâmetro do tipo linha de tabela E valor padrão (no Postgres do Supabase isso impede o alter table);
//   · todo cron.schedule dentro de "if exists pg_cron" e nenhum nome de rotina usado para duas coisas diferentes;
//   · o corpo final de interno.alumia_porta_aberta, interno.alumia_passa, interno.rede_ve, interno.rede_fed_federavel e
//     public.rede_publicar (passagem da Faixa 1, seção 10, item 8);
//   · o gancho da senha só para supabase_auth_admin (item 4); trancar e destrancar idempotentes (item 7).
// Com --sql, só imprime as conferências do catálogo como um SELECT de leitura (para rodar no Postgres do Supabase).
// Uso: node scripts/testar-alumia-o14-banco.mjs [--sql]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
const lit = (t) => `'${String(t).replace(/'/g, "''")}'`;
const lista = (xs) => `array[${[...xs].map(lit).join(", ") || "''"}]::text[]`;

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ═══════════════════ As exceções revistas (cada uma com o motivo) ═══════════════════
/** As funções public.rede_* e public.alumia_* que não precisam ser security definer. */
const INVOCADORAS = new Map([["rede_alumia_versao", "devolve só o número da versão, sem ler tabela"]]);

/**
 * Funções que montam uma lista com pessoas a partir de uma tabela que liga pessoa a alguma coisa, revistas uma a uma: nenhuma é
 * "quem curtiu, viu, segue, votou, assina ou doou" para quem está de fora. Função nova que cair na regra para o teste até ser revista.
 */
const LISTAS_REVISTAS = new Map([
  ["rede_voto_guardias_possiveis", "as pessoas da coordenação que já têm chave de guardiã (a coordenação é pública na organização), só para quem cria a chave de uma votação"],
  ["alumia_ato_assessorias", "organizações (não pessoas) que assessoram atos"],
  ["alumia_com_pedidos", "pedidos de entrada, só para quem modera a comunidade (alumia_o10_pode)"],
  ["rede_com_pedidos", "pedidos de entrada, só para quem modera a comunidade (alumia_o10_pode)"],
  ["alumia_estr_origens", "comunidades de origem de um repost, sem pessoa"],
  ["alumia_rotulos_meus", "os rótulos da própria pessoa"],
  ["rede_acervo_doc_historico", "histórico de versões de um documento (autoria, como a de um post)"],
  ["rede_aviso_listar", "avisos da própria pessoa: até 2 codinomes de quem agiu, nunca em apoio, nulo para invisível"],
  ["rede_com_nucleo", "a mediação de um núcleo (papel público dele)"],
  ["rede_conv_sintese_historico", "autoria das sínteses de uma conversa"],
  ["rede_corrente_posso", "as organizações em nome das quais a própria pessoa age"],
  ["rede_desc_buscar", "busca por nome ou @ (não é relação de ninguém)"],
  ["rede_desc_explorar", "comunidades"],
  ["rede_modmail_conversa", "as mensagens de UMA conversa com a mediação, só para quem a abriu ou modera a comunidade; \"de\" é o lado (pessoa ou mediação), nunca alguém"],
  ["rede_dm_chaves_da_conversa", "chaves das duas pontas da própria conversa"],
  ["rede_dm_mensagens", "mensagens da própria conversa"],
  ["rede_fed_servidor", "servidor da federação (Faixa 2): só o servidor do site, com o segredo"],
  ["rede_identidade_de", "identidade pública de @ pedidos pela tela"],
  ["rede_org_funcoes", "mandatos em curso de uma organização (transparência da organização)"],
  ["rede_perfil_aparencia", "organizações escolhidas pela própria pessoa para o perfil"],
  // Ondas 12 e 13 (revistas na 14A).
  ["rede_coautoria_cartoes", "coautoras que aceitaram (autoria do post, como a da autora); convites e marcações à espera só para a autora"],
  ["rede_ama", "perguntas de uma sessão: o nome de quem perguntou só quando a pessoa quis mostrar"],
  ["alumia_pontes_rotulos", "o rótulo do robô e a organização dona dele, que são públicos"],
  ["alumia_trabalhadores", "chamados de organizações; a lista de organizações é só aquelas em que a própria pessoa fala"],
  // Prompt 4 (revistas na primeira junção).
  ["rede_p4_fotos_protegidas", "dos até 60 @ que a tela já mostra, quais protegeram a própria foto (um atributo do perfil, não uma relação entre pessoas)"],
  ["rede_p4_selo_fila", "pedidos de selo, só para a coordenação (interno.alumia_coordenacao)"],
  ["rede_p4_seg_caixa", "os envios da caixa da própria assessora (b.conta = ela); só a organização de origem, nunca quem mandou"],
  ["rede_p4_seg_situacao", "as organizações da própria pessoa e as que têm plantão; nenhuma pessoa"],
  // Prompt 4 (revista na segunda junção).
  ["rede_p4_cc_estudio_orgs", "só as organizações em que a própria pessoa fala (gerencia ou tem a função de avisos), com a identidade visual delas; nenhuma pessoa"],
  // Prompt 4 (revistas na terceira junção).
  ["rede_p4_or_minhas", "só as organizações de que a própria pessoa faz parte e as comunidades em que ela está, para a tela Organizar; nenhuma pessoa"],
  ["rede_p4_ac_minhas", "só as comunidades em que a própria pessoa está e as organizações que ela mesma gere (g.gestor = ela), para a tela Ação coletiva; nenhuma pessoa"],
  // Prompt 4 (revista na quarta junção).
  ["rede_p4_ct_mencoes", "a fila da própria pessoa: os posts que a mencionam e esperam a revisão dela (até 50), só os que ela já vê, com o autor como nos avisos de menção; nada de relação entre outras pessoas"],
]);

/** Contagens de pessoas que não passam pelo "a partir de 3", revistas: a própria pessoa, o servidor ou a coordenação. */
const CONTAGENS_REVISTAS = new Map([
  ["rede_fed_situacao", "os próprios seguidores e seguidos no Fediverso (só a própria pessoa)"],
  ["rede_fed_servidor", "total de seguidores que o protocolo do Fediverso publica (Faixa 2)"],
  ["rede_meus_espacos", "membros do espaço fechado da Rede de hoje, só para quem é membro dele (tela antiga)"],
]);

// ═══════════════════ As conferências do catálogo (cada uma devolve o que está errado; vazio = certo) ═══════════════════
const DA_REDE = `n.nspname = 'public' and p.prokind = 'f' and (p.proname like 'rede\\_%' or p.proname like 'alumia\\_%')`;
const CHAMA = `(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`;
const FUNCOES = `pg_proc p join pg_namespace n on n.oid = p.pronamespace`;
const CATALOGO = [
  ["toda public.rede_*/alumia_* que anon ou authenticated chamam tem a porta ou está na lista aberta",
    `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' from ${FUNCOES}
     where ${DA_REDE} and p.prorettype <> 'trigger'::regtype and ${CHAMA}
       and p.prosrc !~ 'interno[.]alumia_(porta|passa)[(][)]' and not interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))`],
  ["toda public.rede_*/alumia_* é security definer (fora as exceções com motivo)",
    `select p.proname from ${FUNCOES} where ${DA_REDE} and not p.prosecdef and p.proname <> all (${lista(INVOCADORAS.keys())})`],
  ["toda função security definer de public e interno tem search_path fixo terminando em pg_temp",
    `select n.nspname || '.' || p.proname from ${FUNCOES} where n.nspname in ('public', 'interno') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c ~ '^search_path=.*pg_temp$')`],
  ["nenhuma função de gatilho da rede aberta a anon ou authenticated",
    `select p.proname from ${FUNCOES} where ${DA_REDE} and p.prorettype = 'trigger'::regtype and ${CHAMA}`],
  ["o que só o servidor chama (interno.servico) não fica aberto a anon ou authenticated",
    `select p.proname from ${FUNCOES} where ${DA_REDE} and p.prosrc ~ 'not interno[.]servico[(][)]' and ${CHAMA}`],
  ["toda tabela de interno tem RLS ligada",
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind in ('r', 'p') and not c.relrowsecurity`],
  ["nenhuma tabela de interno tem política (o acesso é só pelas funções)",
    `select c.relname || ': ' || po.polname from pg_policy po join pg_class c on c.oid = po.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno'`],
  ["nenhuma tabela de interno com privilégio para anon ou authenticated",
    `select c.relname || ' (' || r || ')' from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon', 'authenticated']) r
     where n.nspname = 'interno' and c.relkind in ('r', 'p', 'v', 'm') and exists (select 1 from pg_roles where rolname = r)
       and has_table_privilege(r, c.oid, 'select, insert, update, delete, truncate, references, trigger')`],
  ["nenhuma tabela da rede no esquema public",
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
       and (c.relname like 'rede%' or c.relname like 'alumia%')`],
  ["nenhuma função com parâmetro do tipo linha de tabela e valor padrão",
    `select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' from ${FUNCOES}
     where p.pronargdefaults > 0 and n.nspname in ('public', 'interno')
       and (exists (select 1 from unnest((p.proargtypes::oid[])[p.pronargs - p.pronargdefaults : p.pronargs - 1]) t (o)
                    join pg_type ty on ty.oid = t.o join pg_class c on c.oid = ty.typrelid where c.relkind in ('r', 'p'))
            or exists (select 1 from pg_class c join pg_namespace cn on cn.oid = c.relnamespace
                       where c.relkind in ('r', 'p') and cn.nspname in ('public', 'interno')
                         and pg_get_expr(p.proargdefaults, 0) like '%::' || cn.nspname || '.' || c.relname || '%'))`],
  ["nenhuma security definer de interno com execute para todo mundo (PUBLIC), fora as que uma regra ou uma função comum chama",
    `select p.proname from ${FUNCOES} where n.nspname = 'interno' and p.prokind = 'f' and p.prosecdef
       and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
       and not exists (select 1 from pg_policy po where coalesce(pg_get_expr(po.polqual, po.polrelid), '') || ' ' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '') ~ ('(^|[^a-z0-9_])' || p.proname || '[(]'))
       and not exists (select 1 from pg_proc q join pg_namespace qn on qn.oid = q.pronamespace where not q.prosecdef and qn.nspname not in ('pg_catalog', 'information_schema')
                         and q.prolang in (select l.oid from pg_language l where l.lanname in ('sql', 'plpgsql')) and q.prosrc ~ ('(^|[^a-z0-9_])' || p.proname || '[(]'))`],
  ["nenhuma coluna de endereço de rede em public e interno (decisão de 13/11: endereço de rede não é guardado)",
    `select n.nspname || '.' || c.relname || '.' || a.attname from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'interno') and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
       and (a.atttypid in ('inet'::regtype, 'cidr'::regtype) or a.attname ~ '^(ip|ip_[a-z_]+|[a-z_]+_ip|endereco_ip|remote_addr)$')`],
  ["nenhuma função chama o pgcrypto sem o esquema dele (no Supabase ele fica em extensions, fora do search_path das funções)",
    `select n.nspname || '.' || p.proname from ${FUNCOES} where n.nspname in ('public', 'interno')
       and p.prosrc ~ '(^|[^.%A-Za-z0-9_])(crypt|gen_salt|hmac|gen_random_bytes|digest|pgp_sym_encrypt|pgp_sym_decrypt|pgp_pub_encrypt|pgp_pub_decrypt)[[:space:]]*[(]'`],
  ["o gancho da senha só para o serviço de contas",
    `select r from unnest(array['public', 'anon', 'authenticated', 'service_role']) r
     where to_regprocedure('public.alumia_porta_gancho_senha(jsonb)') is not null and (r = 'public' or exists (select 1 from pg_roles where rolname = r))
       and (case when r = 'public' then exists (select 1 from aclexplode((select proacl from pg_proc where oid = 'public.alumia_porta_gancho_senha(jsonb)'::regprocedure)) a where a.grantee = 0)
                 else has_function_privilege(r, 'public.alumia_porta_gancho_senha(jsonb)'::regprocedure, 'execute') end)
     union all
     select 'supabase_auth_admin sem execute' where exists (select 1 from pg_roles where rolname = 'supabase_auth_admin')
       and not has_function_privilege('supabase_auth_admin', 'public.alumia_porta_gancho_senha(jsonb)'::regprocedure, 'execute')`],
];

/** O corpo final das funções que as duas faixas redefinem (item 8): cada uma tem de ter todos estes pedaços. */
const CORPOS = [
  ["interno.alumia_porta_aberta(text, text)", ["'rede_fed_servidor'", "'rede_fed_midia_servidor'", "'rede_fed_mudanca_servidor'", "'rede_org_diretorio'", "'rede_org_mapa'", "'alumia_transparencia'", "'alumia_lei_minha_conta'", "'alumia_triagem_convites'", "'rede_caixa_lote'", "'rede_kt_ponta'", "'rede_kt_trecho'", "'rede_linha', 'rede_novos'"]],
  ["interno.alumia_passa()", ["interno.alumia_sessao_viva()", "interno.alumia_exigida()", "interno.alumia_sessao_ok()"]],
  ["interno.rede_ve(interno.rede_posts)", ["interno.rede_bloqueado(", "interno.rede_espaco_entra(", "interno.rede_vida_ve(", "interno.rede_o9_recolhida("]],
  ["interno.rede_fed_federavel(interno.rede_posts, integer)", ["interno.rede_vida_federa(p)", "<> 'internet' then", "interno.rede_fed_impedimento(", "interno.rede_ve(p, null)", "interno.rede_fed_comunidade_ok("]],
  ["public.rede_publicar(jsonb)", ["perform interno.alumia_porta()", "enquete", "responde_quem", "audio", "interno.erro("]],
];

if (process.argv.includes("--sql")) {
  const partes = CATALOGO.map(([nome, sql]) => `select ${lit(nome)} as conferencia, count(x) = 0 as ok, left(string_agg(x, ', '), 800) as detalhe from (${sql.replace(/\s+/g, " ")}) t (x)`);
  for (const [f, pedacos] of CORPOS) {
    partes.push(`select ${lit(`corpo final de ${f}`)}, coalesce(bool_and(position(x in s) > 0), false), string_agg(case when position(x in s) = 0 then x end, ', ') from (select prosrc s from pg_proc where oid = to_regprocedure(${lit(f)})) c, unnest(${lista(pedacos)}) x`);
  }
  console.log(`-- Conferência só de leitura do catálogo (gerada por scripts/testar-alumia-o14-banco.mjs --sql). "ok" = true é o esperado.\n${partes.join("\nunion all\n")};`);
  process.exit(0);
}

// ═══════════════════ 1. O texto das migrações ═══════════════════
const install = normal(ler("supabase/install.sql"));
const pasta = path.join(raiz, "supabase", "migracoes");
const migracoes = fs.readdirSync(pasta).filter((n) => n.endsWith(".sql")).map((n) => ({ nome: n, sql: normal(fs.readFileSync(path.join(pasta, n), "utf8")) }));
const O14 = migracoes.find((m) => m.nome === "20261120-alumia-o14-banco.sql").sql;
ok("a migração o14-banco termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(O14));
ok("a migração o14-banco não guarda endereço de rede", !/\b(inet|ip_origem|endereco_ip)\b/i.test(O14.replace(/--.*$/gm, "")));

{
  // Todo cron.schedule dentro de um bloco que confere o pg_cron, e o mesmo nome nunca para duas coisas diferentes.
  const semGuarda = [];
  const usos = new Map();
  // A guarda pode ser a extensão (extname = 'pg_cron') ou a própria função (to_regprocedure('cron.schedule(text,text,text)'), a da R1):
  // a menção da função dentro da guarda não é um agendamento.
  const GUARDA_PELA_FUNCAO = /to_regprocedure\s*\(\s*'cron\.schedule\(text,\s*text,\s*text\)'\s*\)\s*is\s+not\s+null/gi;
  for (const { nome, sql: texto } of [{ nome: "install.sql", sql: install }, ...migracoes]) {
    const sql = texto.replace(GUARDA_PELA_FUNCAO, "<guarda do pg_cron pela função>");
    for (const m of sql.matchAll(/cron\.schedule\s*\(\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*('(?:[^']|'')*'|\$[a-z_]*\$[\s\S]*?\$[a-z_]*\$)/gi)) {
      const antes = sql.slice(0, m.index);
      const bloco = antes.slice(antes.lastIndexOf("do $"));
      if (!/extname\s*=\s*'pg_cron'|<guarda do pg_cron pela função>/.test(bloco)) semGuarda.push(`${nome}: ${m[1]}`);
      if (!usos.has(m[1])) usos.set(m[1], new Set());
      usos.get(m[1]).add(m[2].replace(/\s+/g, " "));
    }
    const soltos = (sql.match(/cron\.schedule\s*\(/gi) ?? []).length - [...sql.matchAll(/cron\.schedule\s*\(\s*'([^']+)'/gi)].length;
    if (soltos > 0) semGuarda.push(`${nome}: ${soltos} cron.schedule sem nome escrito`);
  }
  ok(`todo cron.schedule fica dentro de "if exists pg_cron" e tem nome (${semGuarda.join("; ") || "todos"})`, semGuarda.length === 0);
  const dobrados = [...usos].filter(([, cmds]) => cmds.size > 1).map(([n]) => n);
  ok(`nenhum nome de rotina do pg_cron usado para dois comandos diferentes (${dobrados.join(", ") || "nenhum"})`, dobrados.length === 0);
  ok("há rotinas agendadas para conferir", usos.size >= 30);
}
{
  // A lista aberta final tem todo nome que alguma definição anterior já teve (nenhuma migração tira um nome sem querer).
  const definicoes = [install, ...migracoes.map((m) => m.sql)].flatMap((t) =>
    [...t.matchAll(/create or replace function interno\.alumia_porta_aberta\(p_nome text, p_argumentos text\)[\s\S]*?\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]));
  const nomes = new Set(definicoes.flatMap((d) => [...d.replace(/--.*$/gm, "").matchAll(/'((?:rede|alumia)_[a-z0-9_]+)'/g)].map((m) => m[1])));
  // rede_sel_depositar saiu da lista com a função dela (o envelope selado do chat do beta, apagado em 20261124-r2-dupla.sql).
  nomes.delete("rede_sel_depositar");
  globalThis.NOMES_ABERTOS = nomes;
  ok("há definições da lista aberta para comparar", definicoes.length >= 3 && nomes.size >= 20);
}

// ═══════════════════ 2. O catálogo ═══════════════════
async function noBanco() {
  const banco = await criarBanco();
  const dono = (s, v) => banco.dono(s, v);
  const linhas = async (s, v) => (await dono(s, v)).rows;
  const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
  // O papel do serviço de contas existe no Supabase; aqui ele nasce antes da migração, para o gancho ser conferido de verdade.
  await exec("do $$ begin if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if; end $$;");
  const colada = install.includes(O14);
  try {
    await exec(O14);
    await exec(O14);
    ok("a migração o14-banco roda duas vezes por cima do install.sql", true);
    // E o install.sql inteiro de novo por cima: as definições finais (a lista de exceções da porta da R2, entre outras) voltam.
    await banco.instalarDeNovo();
  } catch (e) {
    falhas.push(`a migração o14-banco roda duas vezes: ${e.message}`);
  }
  if (colada) ok("a migração o14-banco está no install.sql", true);
  const [r2] = await linhas("select interno.alumia_trancar() as r");
  ok("depois dela, trancar de novo não acha nada para trancar", r2.r.trancadas === 0 && r2.r.abertas.length === 0);

  for (const [nome, sql] of CATALOGO) {
    try {
      const erradas = (await linhas(sql)).map((r) => Object.values(r)[0]);
      ok(`${nome}${erradas.length ? ` (${erradas.slice(0, 12).join(", ")}${erradas.length > 12 ? `, mais ${erradas.length - 12}` : ""})` : ""}`, erradas.length === 0);
    } catch (e) {
      falhas.push(`${nome}: ${e.message}`);
    }
  }

  // Item 8: o corpo final de cada função redefinida pelas duas faixas.
  for (const [f, pedacos] of CORPOS) {
    const [linha] = await linhas("select prosrc from pg_proc where oid = to_regprocedure($1)", [f]);
    const faltam = linha ? pedacos.filter((x) => !linha.prosrc.includes(x)) : ["(a função não existe)"];
    ok(`o corpo final de ${f} está completo (${faltam.join(", ") || "tudo"})`, faltam.length === 0);
  }
  {
    const [{ src }] = await linhas("select prosrc as src from pg_proc where oid = 'interno.alumia_porta_aberta(text, text)'::regprocedure");
    const faltam = [...globalThis.NOMES_ABERTOS].filter((n) => !src.includes(`'${n}'`));
    ok(`a lista aberta final tem todo nome que as definições anteriores tinham (faltam: ${faltam.join(", ") || "nenhum"})`, faltam.length === 0);
    const [abre] = await linhas("select interno.alumia_porta_aberta('rede_sel_depositar', 'p_para uuid, p_senha text, p_envelope text') a, interno.alumia_porta_aberta('rede_kt_trecho', 'p_desde bigint') b, interno.alumia_porta_aberta('rede_kt_ponta', '') c, interno.alumia_porta_aberta('rede_sel_abrir', '') d");
    // Desde a R2 o envelope selado do beta (rede_sel_depositar) saiu, com a função: só o registro das chaves fica aberto.
    ok("o registro das chaves da Faixa 2 fica aberto, e nenhuma rede_sel_* (o selado do beta saiu na R2)", !abre.a && abre.b && abre.c && !abre.d);
    const [vida] = await linhas("select interno.rede_vida_federacao_ligada(gen_random_uuid()) as v");
    ok("com a federação compondo a vida do post, publicar não recusa mais o não listado de quem federa", vida.v === false);
    const [fed] = await linhas("select interno.rede_vida_federa(jsonb_populate_record(null::interno.rede_posts, jsonb_build_object('id', gen_random_uuid(), 'nao_listado', true))) a, interno.rede_vida_federa(jsonb_populate_record(null::interno.rede_posts, jsonb_build_object('id', gen_random_uuid(), 'nao_listado', false, 'fora_do_fediverso', false))) b");
    ok("a vida do post barra o não listado e deixa o comum", fed.a === false && fed.b === true);
  }

  // Listas de pessoas: agregação que põe pessoa (handle, codinome, perfil…) a partir de uma tabela de relação com pessoa, sem ser a
  // própria pessoa e sem guarda de coordenação ou moderação. Heurística: o que cair nela e não estiver revisto acima para o teste.
  const funcoes = await linhas(`select p.proname as f, p.prosrc as s from ${FUNCOES} where ${DA_REDE}`);
  // alumia_admin_exige: o painel único de admin (20261122-alumia-admin.sql), só coordenação com o segundo fator; o "quem" ali é o
  // registro de quem fez o quê no painel, não uma lista de pessoas da rede.
  const guarda = /interno\.(alumia_painel_exige|alumia_admin_exige|cuida|coord|media|alumia_lei_exige|rede3_com_modera|rede3_mod_\w+|alumia_triagem_\w+|voluntario|rede_mod_\w*pode\w*)\s*\(/;
  const relacao = new Set((await linhas(`select distinct c.relname from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'interno' and k.contype = 'f' and k.confrelid in (to_regclass('interno.perfis'), to_regclass('auth.users'))`)).map((r) => r.relname));
  const listas = new Set();
  const contagens = new Set();
  for (const { f, s } of funcoes) {
    for (const m of s.matchAll(/(jsonb_agg|json_agg|array_agg|jsonb_object_agg)\s*\(/g)) {
      const trecho = s.slice(m.index, m.index + 1200);
      const k = trecho.search(/\bfrom\b/i);
      if (k < 0) continue;
      const de = trecho.slice(k).match(/^from\s+(?:\(?\s*select \* from\s+)?(?:interno\.)?([a-z0-9_]+)/i);
      if (!de || !relacao.has(de[1])) continue;
      if (!/'(handle|codinome|perfil|usuario|quem|autor|membro|votante|assinante|doador|seguidor|pessoa)'|rede_nome\(|nome_visto\(|rede_handle|rede_codinome/.test(trecho.slice(0, k))) continue;
      if (/\b(usuario|quem|perfil|dono|autor|marcado|segue|membro|org)\s*=\s*(v|v_eu|auth\.uid\(\))\b/.test(trecho.slice(k, k + 500))) continue;
      if (guarda.test(s) || LISTAS_REVISTAS.has(f)) continue;
      listas.add(f);
    }
    // Contagem de pessoas numa tabela de reação, presença, membros ou seguidores, sem o "a partir de 3" e sem ser da própria pessoa.
    for (const m of s.matchAll(/'[a-z_]+'\s*,\s*\(\s*select\s+count\s*\(\s*\*\s*\)[^()]*?\bfrom\s+(?:interno\.)?([a-z0-9_]*(?:reac|apoio|vou|curt|presen|membro|seguid|seguindo|assin|votant|leitur|vist)[a-z0-9_]*)\b([^()]*(?:\([^()]*\)[^()]*)*)\)/gi)) {
      const filtro = m[2];
      if (/(usuario|quem|perfil|segue)\s*=\s*(v|auth\.uid\(\))\b/.test(filtro) || guarda.test(s) || CONTAGENS_REVISTAS.has(f)) continue;
      contagens.add(`${f} [${m[1]}]`);
    }
  }
  ok(`nenhuma função devolve lista de pessoas de uma relação (a rever: ${[...listas].join(", ") || "nenhuma"})`, listas.size === 0);
  ok(`número de pessoas só a partir de 3 (a rever: ${[...contagens].join(", ") || "nenhuma"})`, contagens.size === 0);
  {
    const [{ s }] = await linhas("select prosrc as s from pg_proc where oid = 'interno.rede_post_v2(interno.rede_posts, uuid, boolean)'::regprocedure");
    ok("o cartão do post devolve o total de útil pelo marco, só a partir de 3", s.includes("'util', interno.rede_util_publicado(p.id)") && !/from rede_reacoes r where r\.post = p\.id and r\.tipo = 'util'\)/.test(s));
    const [{ s: reagir }] = await linhas("select prosrc as s from pg_proc where oid = 'public.rede_reagir(uuid, text, boolean)'::regprocedure");
    ok("rede_reagir devolve o total de útil pelo marco, só a partir de 3", reagir.includes("'util', interno.rede_util_publicado(p_post)") && !/'util', \(select/.test(reagir));
    const [{ s: arvore }] = await linhas("select prosrc as s from pg_proc where oid = 'public.rede_conv_arvore(uuid, text)'::regprocedure");
    ok("a ordem 'úteis' das respostas usa a mesma conta (nula abaixo de 3, valendo 0)", arvore.includes("coalesce(interno.rede_util_publicado(c.id), 0) as util") && !/count\(\*\)[^;]*tipo = 'util'/.test(arvore));
    const [{ s: pagina }] = await linhas("select prosrc as s from pg_proc where oid = 'interno.rede3_desc_pagina(text, text, text, integer, jsonb, uuid, tsquery)'::regprocedure");
    ok("a ordem 'úteis' da descoberta usa a mesma conta", pagina.includes("coalesce(interno.rede_util_publicado(p.id), 0)::numeric") && !/count\(\*\) from rede_reacoes r where r\.post = p\.id and r\.tipo = 'util'/.test(pagina));
    // De verdade: as marcas de antes do marco contam; a de agora só no marco seguinte; quem desfaz continua contado até ele.
    await exec("set session_replication_role = replica");
    try {
      const [{ id }] = await linhas("insert into interno.rede_posts (texto) values ('pergunta de teste') returning id");
      const total = async () => (await linhas("select interno.rede_post_v2(p, null, false) -> 'util' as u from interno.rede_posts p where p.id = $1", [id]))[0].u;
      const marcar = (quando) => linhas(`insert into interno.rede_reacoes (post, usuario, tipo, criado_em) values ($1, gen_random_uuid(), 'util', ${quando}) returning usuario`, [id]);
      await marcar("now() - interval '1 hour'");
      await marcar("now() - interval '1 hour'");
      const dois = await total();
      const [{ usuario: agora }] = await marcar("now()");
      const doisEUmAgora = await total();
      await marcar("now() - interval '1 hour'");
      const tres = await total();
      ok(`com 2 marcas o total vem nulo; a marca de agora não muda o número; com 3 de antes do marco vem 3 (veio ${dois}, ${doisEUmAgora} e ${tres})`,
        dois === null && doisEUmAgora === null && tres === 3);
      await exec("set session_replication_role = origin");
      await linhas("delete from interno.rede_reacoes where post = $1 and usuario = $2", [id, agora]);
      const [{ usuario: antiga }] = await linhas("select usuario from interno.rede_reacoes where post = $1 and tipo = 'util' order by usuario limit 1", [id]);
      await linhas("delete from interno.rede_reacoes where post = $1 and usuario = $2", [id, antiga]);
      const depoisDeDesfazer = await total();
      const [{ n: saidas }] = await linhas("select count(*)::int as n from interno.rede_contagem_saidas where alvo = interno.rede_util_alvo($1)", [id]);
      const [{ n: doPost }] = await linhas("select count(*)::int as n from interno.rede_contagem_saidas where alvo = $1", [id]);
      ok(`quem desfaz uma marca de antes do marco continua contado até o marco seguinte (veio ${depoisDeDesfazer}; ${saidas} intervalo, ${doPost} na chave do "vou")`,
        depoisDeDesfazer === 3 && saidas === 1 && doPost === 0);
    } catch (e) {
      falhas.push(`o total de útil de um post de teste: ${e.message}`);
    } finally {
      await exec("set session_replication_role = origin");
    }
  }

  // O gancho chamado como o serviço de contas responde no formato do Supabase; a chave de serviço não chama.
  {
    const como = async (papel, sql) => banco.exclusivo(async () => {
      await banco.pg.exec(`set role ${papel}`);
      try { return (await banco.pg.query(sql)).rows; } finally { await banco.pg.exec("reset role"); }
    });
    try {
      const [{ r }] = await como("supabase_auth_admin", `select public.alumia_porta_gancho_senha('{"user_id": "${"0".repeat(8)}-0000-0000-0000-000000000000", "valid": true}'::jsonb) as r`);
      ok("o gancho responde {decision: continue} ao serviço de contas", r?.decision === "continue");
    } catch (e) {
      falhas.push(`o gancho chamado pelo serviço de contas: ${e.message}`);
    }
    try {
      await como("service_role", "select public.alumia_porta_gancho_senha('{}'::jsonb)");
      falhas.push("a chave de serviço não chama o gancho");
    } catch (e) {
      ok("a chave de serviço não chama o gancho", /permission denied/.test(e.message));
    }
  }

  // Item 7: trancar e destrancar idempotentes, em plpgsql e na de SQL que virou plpgsql.
  {
    const alvos = await linhas(`select p.proname, l.lanname, p.prosrc from ${FUNCOES} join pg_language l on l.oid = p.prolang
      where ${DA_REDE} and not interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))
        and (select count(*) from pg_proc q where q.proname = p.proname and q.pronamespace = p.pronamespace) = 1
        and (starts_with(p.prosrc, 'begin perform interno.alumia_porta(); ') or starts_with(p.prosrc, E'\\nbegin perform interno.alumia_porta(); return ('))
      order by (left(p.prosrc, 1) = E'\\n'), p.proname`);
    const pl = alvos.find((a) => !a.prosrc.startsWith("\n"));
    const sq = alvos.find((a) => a.prosrc.startsWith("\n"));
    ok("há uma função trancada de cada jeito para provar", Boolean(pl && sq));
    for (const a of [pl, sq].filter(Boolean)) {
      const fonte = async () => (await linhas("select p.prosrc, l.lanname from pg_proc p join pg_language l on l.oid = p.prolang join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1", [a.proname]))[0];
      const [{ n: um }] = await linhas("select interno.alumia_destrancar($1) as n", [a.proname]);
      const solta = await fonte();
      const [{ n: dois }] = await linhas("select interno.alumia_destrancar($1) as n", [a.proname]);
      const t1 = (await linhas("select interno.alumia_trancar() as r"))[0].r;
      const t2 = (await linhas("select interno.alumia_trancar() as r"))[0].r;
      const volta = await fonte();
      ok(`${a.proname} (${a.lanname}): destrancar tira a porta uma vez só (${um}, depois ${dois})`, um === 1 && dois === 0 && !/interno\.alumia_porta\(\)/.test(solta.prosrc));
      ok(`${a.proname}: a de SQL volta a ser SQL quando destrancada`, a.prosrc.startsWith("\n") ? solta.lanname === "sql" : solta.lanname === "plpgsql");
      ok(`${a.proname}: trancar põe a porta de volta uma vez só (${t1.trancadas}, depois ${t2.trancadas})`, t1.trancadas === 1 && t2.trancadas === 0 && t2.abertas.length === 0);
      ok(`${a.proname}: o corpo trancado de novo é o mesmo de antes`, volta.prosrc === a.prosrc && volta.lanname === a.lanname);
    }
  }
}

await noBanco().catch((e) => falhas.push(`o banco: ${e.stack ?? e.message}`));

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
