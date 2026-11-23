// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente "uso e funções" do R1 (supabase/migracoes/20261123-r1-uso.sql) num Postgres de verdade (scripts/banco-local.mjs),
// com a migração rodada três vezes sobre o install.sql:
//   - "Falar com a moderação": desligado não abre nada; ligado, a pessoa abre, a mediação responde sem nome, ninguém de fora lê (o
//     mesmo erro de "não existe"), o codinome só aparece quando a pessoa escolhe, conversa encerrada não recebe mais nada, os limites
//     valem, nenhuma coluna de endereço de rede, tudo com a porta;
//   - a situação do cadastro: "na_fila" até a triagem listar o pedido, "em_analise" depois, sem guardar quem viu;
//   - as três funções redefinidas continuam inteiras (o que existia antes segue no corpo).
// Uso: npm run testar:r1-uso
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

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261123-r1-uso.sql");
ok("a migração termina trancando as funções na porta da Alumia", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia", !/function public\.rede_alumia_versao/.test(sql));
ok("nenhum parâmetro do tipo linha de tabela", !/\(\s*[a-z_]+ interno\.[a-z_]+[,)]/.test(sql.replace(/returns interno\.[a-z_]+/g, "")));
ok("nenhuma permissão direta em tabela para anon ou authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 14 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("nada escreve 'Rede Lúcia'", !/Rede Lúcia/.test(sql.replace(/^--.*$/gm, "")));

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });

const P = {};
for (const nome of ["coord", "mod", "pessoa", "outra", "intrusa", "nova", "nova2"]) {
  P[nome] = await criarUsuario(`${nome}@r1uso.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set nome = $2, rede_codinome = $3, rede_codinome_ok = true, rede_handle = $4, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${nome}`, `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}

const defAntes = async (assinatura) => (await um(`select pg_get_functiondef('${assinatura}'::regprocedure) as d`)).d;
const antes = {
  fila: await defAntes("public.alumia_triagem_fila()"),
  cadastros: await defAntes("public.alumia_painel_cadastros(text,text,integer)"),
  eu: await defAntes("public.alumia_entrada_eu()"),
};
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("nenhuma função da rede ficou sem a porta", () => um("select interno.alumia_trancar() as r"), (x) => Array.isArray(x.r.abertas) && x.r.abertas.length === 0);

// A comunidade, a mediação dela e quem é de fora.
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('moradia', $1, 'moderacao'), ('moradia', $2, 'membro') on conflict do nothing", [P.mod, P.pessoa]);

// ═══════════════════ 2. As tabelas e as permissões ═══════════════════
await espera("as tabelas novas: nenhuma coluna de endereço de rede, nenhuma do tipo inet ou cidr", () => dono(`
  select table_name, column_name, data_type from information_schema.columns
  where table_schema = 'interno' and table_name in ('rede_modmail_conversas', 'rede_modmail_mensagens', 'alumia_entrada_vista')`), (r) =>
  r.rows.length >= 15 && !r.rows.some((c) => /inet|cidr/.test(c.data_type) || /(^|_)(ip|ipv4|ipv6|endereco|email)($|_)/.test(c.column_name)));
await espera("a ficha vista não guarda quem viu nem quando", () => dono(`select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'alumia_entrada_vista' order by 1`),
  (r) => r.rows.map((c) => c.column_name).join(",") === "ficha,tentativa");
await espera("as três tabelas com RLS e sem política", () => um(`
  select count(*) filter (where c.relrowsecurity)::int com_rls, (select count(*)::int from pg_policies where schemaname = 'interno' and tablename in ('rede_modmail_conversas', 'rede_modmail_mensagens', 'alumia_entrada_vista')) politicas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('rede_modmail_conversas', 'rede_modmail_mensagens', 'alumia_entrada_vista')`), (x) => x.com_rls === 3 && x.politicas === 0);
await espera("anon e authenticated não leem as tabelas", () => um(`select has_table_privilege('authenticated', 'interno.rede_modmail_mensagens', 'select') a, has_table_privilege('anon', 'interno.rede_modmail_conversas', 'select') b`), (x) => !x.a && !x.b);
const funcoes = (await dono(`
  select n.nspname as esquema, p.proname as nome, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut,
    p.prosecdef as definer, array_to_string(p.proconfig, ',') as config, p.prosrc as corpo
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname like 'rede\\_modmail\\_%' order by 1, 2`)).rows;
ok("as funções do canal existem (7 da tela, 5 de dentro)", funcoes.filter((f) => f.esquema === "public").length === 7 && funcoes.filter((f) => f.esquema === "interno").length === 5);
ok("todas security definer com search_path fixo", funcoes.every((f) => f.definer && /search_path=interno, pg_temp/.test(f.config ?? "")));
ok("visitante não executa nenhuma", funcoes.every((f) => !f.anon));
ok("as de dentro ninguém chama pela API", funcoes.filter((f) => f.esquema === "interno").every((f) => !f.aut));
ok("as da tela passam pela porta da entrada", funcoes.filter((f) => f.esquema === "public").every((f) => /alumia_porta\(\)/.test(f.corpo)));

// ═══════════════════ 3. Desligado, nada abre ═══════════════════
await espera("o interruptor está no catálogo, só pelo nome", () => um("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-falar-moderacao'"), (x) => x?.so_pelo_nome === true);
await espera("o interruptor das várias identidades está no catálogo, só pelo nome e sem decisão (desligado)", () => um("select k.so_pelo_nome, v.ligado from interno.recursos_catalogo k left join interno.recursos_vivos v on v.nome = k.nome where k.nome = 'alumia-identidades'"), (x) => x?.so_pelo_nome === true && x.ligado !== true);
await espera("os dois aparecem no painel único (alumia_painel_recurso_da_alumia)", () => um("select interno.alumia_painel_recurso_da_alumia('alumia-falar-moderacao') and interno.alumia_painel_recurso_da_alumia('alumia-identidades') as ok"), (x) => x?.ok === true);
await espera("desligado: a tela é avisada", () => rpc(como(P.pessoa), "rede_modmail_ligado"), (x) => x === false);
await recusa("desligado: não abre conversa", () => rpc(como(P.pessoa), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "Oi, mediação.", p_com_codinome: false }), "desligado");
await recusa("desligado: a mediação não lê a caixa", () => rpc(como(P.mod), "rede_modmail_caixa", { p_comunidade: "moradia" }), "desligado");
await recusa("desligado: nem a lista própria", () => rpc(como(P.pessoa), "rede_modmail_minhas"), "desligado");

await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-falar-moderacao', true) on conflict (nome) do update set ligado = true");
await espera("ligado pelo painel: a tela é avisada", () => rpc(como(P.pessoa), "rede_modmail_ligado"), (x) => x === true);
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-2', false) on conflict (nome) do update set ligado = false");
await recusa("com a Alumia nova desligada no painel, o canal também desliga", () => rpc(como(P.pessoa), "rede_modmail_minhas"), "desligado");
await dono("delete from interno.recursos_vivos where nome = 'alumia-2'");

// ═══════════════════ 4. A conversa ═══════════════════
await recusa("visitante não abre", () => rpc({ papel: "anon" }, "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "Oi.", p_com_codinome: false }), "permission denied");
await recusa("texto vazio não passa", () => rpc(como(P.pessoa), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "   ", p_com_codinome: false }), "invalido:texto");
await recusa("texto de mais de 2000 letras não passa", () => rpc(como(P.pessoa), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "a".repeat(2001), p_com_codinome: false }), "invalido:texto");
await recusa("comunidade que não existe", () => rpc(como(P.pessoa), "rede_modmail_abrir", { p_comunidade: "nao-existe", p_texto: "Oi.", p_com_codinome: false }), "nao_encontrado");
const c1 = await espera("a pessoa abre uma conversa sem mostrar o codinome", () => rpc(como(P.pessoa), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "Quero entender por que meu post saiu.", p_com_codinome: false }),
  (r) => r.id && r.numero === 1 && r.situacao === "aberta" && r.com_codinome === false && r.codinome === null && r.nome);
const caixa = await espera("a mediação vê a conversa pelo número, sem o codinome", () => rpc(como(P.mod), "rede_modmail_caixa", { p_comunidade: "moradia" }),
  (r) => r.length === 1 && r[0].numero === 1 && r[0].codinome === null && r[0].nova === true);
ok("a caixa não traz id de conta nenhuma", caixa && !JSON.stringify(caixa).includes(P.pessoa));
await recusa("quem não modera não lê a caixa", () => rpc(como(P.outra), "rede_modmail_caixa", { p_comunidade: "moradia" }), "sem_permissao");
await recusa("membro comum também não", () => rpc(como(P.pessoa), "rede_modmail_caixa", { p_comunidade: "moradia" }), "sem_permissao");
await recusa("quem é de fora não abre a conversa (mesmo erro de não existir)", () => rpc(como(P.intrusa), "rede_modmail_conversa", { p_id: c1?.id }), "nao_encontrado");
await recusa("id que não existe: o mesmo erro", () => rpc(como(P.intrusa), "rede_modmail_conversa", { p_id: "00000000-0000-4000-8000-00000000abcd" }), "nao_encontrado");
await recusa("quem é de fora não escreve", () => rpc(como(P.intrusa), "rede_modmail_escrever", { p_id: c1?.id, p_texto: "Entrei." }), "nao_encontrado");
await recusa("quem é de fora não encerra", () => rpc(como(P.intrusa), "rede_modmail_encerrar", { p_id: c1?.id }), "nao_encontrado");
const lidaMed = await espera("a mediação abre a conversa e lê a mensagem", () => rpc(como(P.mod), "rede_modmail_conversa", { p_id: c1?.id }),
  (r) => r.lado === "mediacao" && r.mensagens.length === 1 && r.mensagens[0].de === "pessoa" && r.mensagens[0].minha === false && r.codinome === null);
ok("a conversa aberta pela mediação não traz o id de ninguém", lidaMed && !JSON.stringify(lidaMed).includes(P.pessoa) && !JSON.stringify(lidaMed).includes(P.mod));
await espera("a mediação responde", () => rpc(como(P.mod), "rede_modmail_escrever", { p_id: c1?.id, p_texto: "Oi! O post caiu no filtro automático; já voltou." }), (r) => r.id === c1?.id);
await espera("a pessoa vê a conversa como nova", () => rpc(como(P.pessoa), "rede_modmail_minhas"), (r) => r.length === 1 && r[0].nova === true);
const lidaPessoa = await espera("a pessoa lê a resposta, assinada só como mediação", () => rpc(como(P.pessoa), "rede_modmail_conversa", { p_id: c1?.id }),
  (r) => r.lado === "pessoa" && r.mensagens.length === 2 && r.mensagens[1].de === "mediacao" && r.mensagens[1].minha === false && r.mensagens[0].minha === true);
ok("a resposta não diz quem da mediação escreveu", lidaPessoa && !JSON.stringify(lidaPessoa).includes(P.mod) && !/Codinome mod|c_mod/.test(JSON.stringify(lidaPessoa)));
await espera("depois de ler, não é mais nova", () => rpc(como(P.pessoa), "rede_modmail_minhas"), (r) => r[0].nova === false);
await espera("mas o banco guarda quem da mediação respondeu (para a equipe responder por abuso)", () => um("select por from interno.rede_modmail_mensagens where de = 'mediacao'"), (x) => x.por === P.mod);

await espera("outra conversa, agora mostrando o codinome", () => rpc(como(P.outra), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "Posso propor uma regra nova?", p_com_codinome: true }),
  (r) => r.numero === 2 && r.com_codinome === true && r.codinome === null);
await espera("a mediação vê o codinome só dessa", () => rpc(como(P.mod), "rede_modmail_caixa", { p_comunidade: "moradia" }),
  (r) => r.length === 2 && r.find((x) => x.numero === 2)?.codinome === "Codinome outra" && r.find((x) => x.numero === 1)?.codinome === null);
await espera("quem modera e escreve como pessoa não vê a própria conversa na caixa", async () => {
  await rpc(como(P.mod), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "Conversa minha com a mediação.", p_com_codinome: false });
  return rpc(como(P.mod), "rede_modmail_caixa", { p_comunidade: "moradia" });
}, (r) => r.length === 2);

await espera("a pessoa encerra", () => rpc(como(P.pessoa), "rede_modmail_encerrar", { p_id: c1?.id }), (r) => r.situacao === "encerrada");
await recusa("encerrada não recebe mais nada (nem da mediação)", () => rpc(como(P.mod), "rede_modmail_escrever", { p_id: c1?.id, p_texto: "Mais uma coisa." }), "encerrada");
await espera("encerrada há mais de 90 dias some com as mensagens", async () => {
  await dono("update interno.rede_modmail_conversas set encerrada_em = now() - interval '91 days' where id = $1", [c1?.id]);
  await dono("select interno.rede_modmail_faxina()");
  return um("select (select count(*)::int from interno.rede_modmail_conversas where id = $1) c, (select count(*)::int from interno.rede_modmail_mensagens where conversa = $1) m", [c1?.id]);
}, (x) => x.c === 0 && x.m === 0);

// Limites: no máximo 3 abertas por pessoa e comunidade; 5 aberturas por hora.
await espera("três abertas ao mesmo tempo passam", async () => {
  for (let i = 0; i < 3; i++) await rpc(como(P.nova), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: `Pergunta ${i}.`, p_com_codinome: false });
  return true;
});
await recusa("a quarta aberta na mesma comunidade não passa", () => rpc(como(P.nova), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "Pergunta 4.", p_com_codinome: false }), "muitas_abertas");
await recusa("o limite por hora vale (5 aberturas)", async () => {
  for (const k of ["trabalho", "antirracismo", "feminismo"]) await rpc(como(P.nova), "rede_modmail_abrir", { p_comunidade: k, p_texto: "Oi.", p_com_codinome: false });
}, "muitos_pedidos");

// Corrida: dez aberturas em paralelo na mesma comunidade não repetem número.
await espera("o número da conversa nunca repete, nem em paralelo", async () => {
  const pessoas = [];
  for (let i = 0; i < 6; i++) {
    const id = await criarUsuario(`corrida${i}@r1uso.local`, `Corrida ${i}`);
    await rpc(como(id), "eu");
    pessoas.push(id);
  }
  await Promise.allSettled(pessoas.map((id) => rpc(como(id), "rede_modmail_abrir", { p_comunidade: "moradia", p_texto: "Corrida.", p_com_codinome: false })));
  return um("select count(*)::int n, count(distinct numero)::int d from interno.rede_modmail_conversas where comunidade = 'moradia'");
}, (x) => x.n === x.d && x.n >= 8);

// Conta apagada leva as conversas junto.
await espera("apagar a conta apaga as conversas e as mensagens dela", async () => {
  await dono("delete from interno.perfis where id = $1", [P.outra]);
  return um("select count(*)::int n from interno.rede_modmail_conversas where autor = $1", [P.outra]);
}, (x) => x.n === 0);

// ═══════════════════ 5. A situação do cadastro ═══════════════════
await dono("update interno.configuracoes set valor = jsonb_set(valor, '{exigir}', 'true') where chave = 'alumia_entrada'");
await dono("delete from interno.alumia_entrada where usuario in ($1, $2)", [P.nova, P.nova2]);
await dono("insert into interno.alumia_entrada (usuario, situacao, motivo_pedido) values ($1, 'em_analise', 'Quero entrar no núcleo do bairro.'), ($2, 'em_analise', 'Quero estudar para o ENEM.')", [P.nova, P.nova2]);
await espera("pedido novo: na fila", () => rpc(como(P.nova, "aal1"), "alumia_entrada_eu"), (r) => r.situacao === "em_analise" && r.etapa === "na_fila");
await espera("a triagem lista a fila", () => rpc(como(P.coord), "alumia_triagem_fila"), (r) => r.pendentes.length >= 2);
await espera("depois da lista: em análise (e a situação de sempre não muda)", () => rpc(como(P.nova, "aal1"), "alumia_entrada_eu"), (r) => r.situacao === "em_analise" && r.etapa === "em_analise");
await espera("a ficha vista não diz quem viu", () => um("select count(*)::int n from interno.alumia_entrada_vista"), (x) => x.n >= 2);
await espera("pedido de novo depois de recusado volta para a fila", async () => {
  await dono("update interno.alumia_entrada set tentativas = tentativas + 1 where usuario = $1", [P.nova]);
  return rpc(como(P.nova, "aal1"), "alumia_entrada_eu");
}, (r) => r.etapa === "na_fila");
await espera("o painel da Alumia também tira da fila", async () => {
  await rpc(como(P.coord), "alumia_painel_cadastros", { p_situacao: "em_analise", p_busca: "", p_pagina: 0 });
  return rpc(como(P.nova, "aal1"), "alumia_entrada_eu");
}, (r) => r.etapa === "em_analise");
await espera("aprovada: a etapa é a situação", async () => {
  await dono("update interno.alumia_entrada set situacao = 'aprovada', decidido_em = now() where usuario = $1", [P.nova2]);
  return rpc(como(P.nova2, "aal1"), "alumia_entrada_eu");
}, (r) => r.etapa === "aprovada");
await recusa("a triagem continua só para quem pode", () => rpc(como(P.pessoa), "alumia_triagem_fila"), "sem_permissao");
await espera("visitante recebe só que não está logado", () => rpc({ papel: "anon" }, "alumia_entrada_eu"), (r) => r.logado === false && !("etapa" in r));

// ═══════════════════ 5b. A faxina da moderação roda sozinha (pg_cron) ═══════════════════
// O PGlite não tem pg_cron: um cron de mentira, com a mesma assinatura (cron.schedule e a tabela cron.job), guarda a rotina.
await exec(`create schema if not exists cron;
  create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
  create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $f$
    insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid
  $f$;`);
await espera("com o pg_cron, a migração agenda a faxina toda madrugada (e rodar de novo não duplica)", async () => {
  await exec(sql);
  await exec(sql);
  return (await dono("select schedule, command from cron.job where jobname = 'alumia-modmail-faxina'")).rows;
}, (l) => l.length === 1 && /^\d+ \d+ \* \* \*$/.test(l[0].schedule) && l[0].command === "select interno.rede_modmail_faxina()");
await espera("a conversa encerrada há 91 dias some na rotina, sem ninguém abrir conversa nova", async () => {
  const velha = (await um(`insert into interno.rede_modmail_conversas (comunidade, autor, numero, situacao, encerrada_em, ultima_de, lida_pessoa, lida_mediacao)
    values ('moradia', $1, 9001, 'encerrada', now() - interval '91 days', 'pessoa', true, true) returning id`, [P.mod])).id;
  await dono("insert into interno.rede_modmail_mensagens (conversa, de, autor, texto) values ($1, 'pessoa', $2, 'Conversa antiga.')", [velha, P.mod]);
  const recente = (await um(`insert into interno.rede_modmail_conversas (comunidade, autor, numero, situacao, encerrada_em, ultima_de, lida_pessoa, lida_mediacao)
    values ('moradia', $1, 9002, 'encerrada', now() - interval '30 days', 'pessoa', true, true) returning id`, [P.mod])).id;
  await exec((await um("select command from cron.job where jobname = 'alumia-modmail-faxina'")).command);
  return um("select (select count(*)::int from interno.rede_modmail_conversas where id = $1) v, (select count(*)::int from interno.rede_modmail_mensagens where conversa = $1) m, (select count(*)::int from interno.rede_modmail_conversas where id = $2) r", [velha, recente]);
}, (x) => x.v === 0 && x.m === 0 && x.r === 1);
await espera("a Saúde mostra que a faxina está agendada", () => rpc(como(P.coord), "alumia_painel_r1_banco"), (r) => r.faxina_da_moderacao === true);

// ═══════════════════ 6. As redefinidas continuam inteiras ═══════════════════
const depois = {
  fila: await defAntes("public.alumia_triagem_fila()"),
  cadastros: await defAntes("public.alumia_painel_cadastros(text,text,integer)"),
  eu: await defAntes("public.alumia_entrada_eu()"),
};
const trechos = {
  fila: ["alumia_triagem_pode", "alumia_triagem_ler", "conta_dias", "decididos", "interval '30 days'"],
  cadastros: ["alumia_painel_exige", "alumia_painel_quem", "alumia_painel_da_casa", "alumia_painel_busca", "offset v_pagina * 50"],
  eu: ["alumia_exigida", "pedir_de_novo_em", "regras_versao", "direto"],
};
for (const k of Object.keys(trechos)) {
  ok(`${k}: o corpo de antes continua inteiro`, trechos[k].every((t) => antes[k].includes(t) && depois[k].includes(t)));
}
ok("o painel de cadastros continua com a porta", /alumia_porta\(\)/.test(depois.cadastros));
ok("a fila da triagem e o 'onde estou' continuam sem a porta (abrem antes da aprovação)", !/alumia_porta\(\)/.test(depois.fila) && !/alumia_porta\(\)/.test(depois.eu));

console.log(`${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  FALHA: ${f}`);
  process.exit(1);
}
process.exit(0);
