// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 4: avisos de local no estilo do Waze, sem autor (supabase/migracoes/20261127-p4-avisos-de-local.sql).
//   · antes da migração, as funções não existem;
//   · desligado, o banco recusa; ligado, só membro logado vê e avisa;
//   · categorias fechadas (nenhuma nomeia a polícia), célula de 200 m em inteiros, horário em 10 minutos, 2 horas, renova uma vez;
//   · "sem confirmação" até 3 relatos distintos na mesma hora; nenhum número sai do banco;
//   · a moderação apaga e trava área; o vencido some;
//   · o aceite: com acesso total ao banco, não dá para ligar um aviso a uma conta (nem pelos limites: troca de papéis dá o mesmo
//     banco, a transação que gravou não aponta ninguém, nenhuma outra tabela ganha linha com a conta);
//   · o aparelho arredonda antes de enviar; as áreas seguidas ficam no aparelho; a tela não pede nada a serviço de fora.
// Uso: npm run testar:p4-avisos-de-local
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  CATEGORIAS, MOTIVOS_DA_TRAVA, PASSO, alternarSeguida, andar, areaDe, avisosDeLocalLigados, celulaDe, celulaDoMunicipio, distanciaERumo, guardarSeguidas,
  lerSeguidas, limparVizinhanca, pedidoDeAviso,
} from "../lib/rede/mapa/avisos.ts";
import { ROTAS_NOVAS, rotaNovaLigada } from "../lib/rede/rotas-novas.ts";
import { RECURSOS, SO_PELO_NOME, ligado, lerRecursos } from "../lib/recursos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const lerSeHouver = (c) => (existe(c) ? ler(c) : "");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

const FLAG = "alumia-p4-avisos-de-local";
const SQL = normal(ler("supabase/migracoes/20261127-p4-avisos-de-local.sql"));
// Depois da junção a migração já está no install.sql: o banco de antes é o install.sql cortado antes dela.
const bancoDeAntes = () => criarBanco(ler("supabase/install.sql").replace(/\r\n/g, "\n").includes(SQL.replace(/\r\n/g, "\n").trim()) ? { antesDe: SQL } : {});
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");

// ═══ 0. O texto da migração ═══
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração diz que pode rodar mais de uma vez e a lei", SQL.includes("Pode rodar mais de uma vez") && /Lei: LGPD art\./.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bcidr\b|x-forwarded|cf-connecting|remote_addr|interno\.origem\(/i.test(semComentario));
ok("o catálogo ganha o interruptor só pelo nome, protegido por to_regclass", /to_regclass\('interno\.recursos_catalogo'\) is not null/.test(SQL) && SQL.includes(`('${FLAG}', true)`));
ok("avisar não usa interno.limite (que guarda a hora exata com a conta)", !/rede_local_avisar[\s\S]*?interno\.limite\(/.test(semComentario.split("create or replace function public.rede_local_ainda_la")[0].split("create or replace function public.rede_local_avisar")[1] ?? "x"));
ok("o limite regrava as linhas da hora em ordem sorteada (sorteio criptográfico)", /array_agg\(u order by extensions\.gen_random_bytes\(16\)\)/.test(SQL) && /delete from rede_local_limite where bloco <= v_bloco/.test(SQL));
ok("nenhum push nem aviso a pessoas", !/interno\.avisar\(|rede_aviso_|push/i.test(semComentario));

// ═══ 1. Antes da migração ═══
{
  const antes = await bancoDeAntes();
  const r = (await antes.dono("select to_regprocedure('public.rede_local_avisar(integer,integer,text)') as f, to_regclass('interno.rede_local_avisos') as t")).rows[0];
  ok("antes: não existe função nem tabela de avisos de local", r.f === null && r.t === null);
  await antes.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono, rpc, criarUsuario } = banco;
const um = async (q, v = []) => (await dono(q, v)).rows[0];
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
{
  const r = (await um("select interno.alumia_trancar() as r")).r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const k = await um(`select so_pelo_nome from interno.recursos_catalogo where nome = '${FLAG}'`);
  ok("o interruptor está no catálogo, só pelo nome", k?.so_pelo_nome === true);
  const v = await um(`select count(*)::int n from interno.recursos_vivos where nome = '${FLAG}'`);
  ok("e sem decisão do painel (desligado)", v.n === 0);
}

// Auditoria do P4 (B5): o embaralhamento das linhas do limite (que esconde quem agiu na hora) usava random() do Postgres, que não
// é sorteio criptográfico. No banco montado, a função não pode ordenar por random().
{
  const def = (await dono("select pg_get_functiondef('interno.rede_local_gastar(uuid)'::regprocedure) as d")).rows[0].d;
  ok("o limite não embaralha com random() (só com gen_random_bytes)", !/\brandom\(\)/.test(def.replace(/gen_random_bytes/g, "")) && (def.match(/gen_random_bytes\(16\)/g) ?? []).length === 2);
}

// As tabelas: o aviso não tem autor; o limite não tem célula, categoria, aviso nem hora exata.
const colunas = async (t) => (await dono(`select column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = $1 order by column_name`, [t])).rows;
{
  const av = await colunas("rede_local_avisos");
  ok(`o aviso tem só célula, categoria e tempo (${av.map((c) => c.column_name).join(",")})`,
    av.map((c) => c.column_name).join(",") === "bloco,categoria,confirmado,criado_em,expira_em,id,la,lo,relatos_no_bloco,renovado");
  ok("o único uuid do aviso é o id dele", av.filter((c) => c.data_type === "uuid").map((c) => c.column_name).join(",") === "id");
  const li = await colunas("rede_local_limite");
  ok(`o limite tem só a conta e a hora cheia (${li.map((c) => `${c.column_name}:${c.data_type}`).join(",")})`, li.map((c) => `${c.column_name}:${c.data_type}`).join(",") === "bloco:integer,usuario:uuid");
  const tr = await colunas("rede_local_travas");
  ok("a trava não guarda quem travou", !tr.some((c) => c.data_type === "uuid"));
  const fks = await dono(`select conrelid::regclass::text t, confrelid::regclass::text r from pg_constraint where contype = 'f' and (conrelid in ('interno.rede_local_avisos'::regclass, 'interno.rede_local_limite'::regclass, 'interno.rede_local_travas'::regclass) or confrelid = 'interno.rede_local_avisos'::regclass)`);
  ok(`só o limite aponta para a conta; nada aponta para o aviso (${JSON.stringify(fks.rows)})`, fks.rows.length === 1 && fks.rows[0].t === "interno.rede_local_limite" && fks.rows[0].r === "interno.perfis");
  const todas = (await dono(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name like 'rede\\_local\\_%'`)).rows;
  ok("nenhuma coluna de endereço de rede, texto livre ou foto", !todas.some((c) => /inet|cidr|bytea/.test(c.data_type) || /(^|_)(ip|endereco|texto|foto|imagem|autor|email)($|_)/.test(c.column_name)));
  const rls = await um(`select count(*) filter (where c.relrowsecurity)::int com, (select count(*)::int from pg_policies where schemaname = 'interno' and tablename like 'rede\\_local\\_%') pol
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('rede_local_avisos', 'rede_local_limite', 'rede_local_travas')`);
  ok("as três tabelas com RLS e sem política", rls.com === 3 && rls.pol === 0);
  const priv = await um(`select has_table_privilege('authenticated', 'interno.rede_local_avisos', 'select') a, has_table_privilege('anon', 'interno.rede_local_limite', 'select') b`);
  ok("anon e authenticated não leem as tabelas", !priv.a && !priv.b);
  const fn = (await dono(`select n.nspname e, p.proname nome, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') aut,
      p.prosecdef d, array_to_string(p.proconfig, ',') cfg, p.prosrc corpo from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname like 'rede\\_local\\_%'`)).rows;
  const pub = fn.filter((f) => f.e === "public");
  ok(`as seis funções da tela existem (${pub.map((f) => f.nome).sort().join(",")})`, pub.length === 7 && ["ligado", "ver", "avisar", "ainda_la", "apagar", "travar", "destravar"].every((x) => pub.some((f) => f.nome === `rede_local_${x}`)));
  ok("as da tela começam pela porta da entrada", pub.every((f) => /^\s*(declare[\s\S]*?)?begin\s+perform interno\.alumia_porta\(\);/.test(f.corpo)));
  ok("as da tela: security definer com search_path fixo", pub.every((f) => f.d && /search_path=interno, pg_temp/.test(f.cfg ?? "")));
  ok("visitante não executa nenhuma", fn.every((f) => !f.anon));
  ok("as de dentro ninguém chama pela API", fn.filter((f) => f.e === "interno").every((f) => !f.aut));
  ok("o banco tem as mesmas categorias da tela", (await um(`select pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'interno.rede_local_avisos'::regclass and conname like '%categoria%'`)).d.match(/'[a-z_]+'/g).map((x) => x.slice(1, -1)).join(",") === CATEGORIAS.join(","));
}

// As pessoas.
const P = {};
for (const nome of ["ana", "bia", "cris", "duda", "eva", "coord", "fora"]) {
  P[nome] = await criarUsuario(`${nome}@p4-local.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: "198.51.100.7" }, "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const [nome, id] of Object.entries(P)) {
  if (nome === "fora") continue; // conta sem a adesão à Alumia
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [id, `Pessoa ${nome}`, `p_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
}
const como = (quem) => ({ papel: "authenticated", sub: P[quem], aal: "aal2", ip: "198.51.100.8" });
const chamar = (quem, f, a = {}) => rpc(como(quem), f, a);
const zerarLimite = () => dono("delete from interno.rede_local_limite");
const limpar = async () => {
  for (const t of ["rede_local_avisos", "rede_local_limite", "rede_local_travas"]) await dono(`delete from interno.${t}`);
};

// Recife, perto do Marco Zero: a célula que o aparelho mandaria.
const RECIFE = celulaDe(-8.0631, -34.8711);
const AREA = areaDe(RECIFE);

// ═══ 3. Desligado ═══
await recusa("desligado: ver recusa", () => chamar("ana", "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo }), "desligado");
await recusa("desligado: avisar recusa", () => chamar("ana", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "obra" }), "desligado");
ok("desligado: a tela não mostra", (await chamar("ana", "rede_local_ligado")) === false);
await dono(`insert into interno.recursos_vivos (nome, ligado) values ('${FLAG}', true) on conflict (nome) do update set ligado = true`);
ok("ligado: a tela mostra para membro", (await chamar("ana", "rede_local_ligado")) === true);
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-2', false) on conflict (nome) do update set ligado = false");
await recusa("Alumia desligada no painel: recusa", () => chamar("ana", "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo }), "desligado");
await dono("delete from interno.recursos_vivos where nome = 'alumia-2'");

// ═══ 4. Quem vê: só membro logado ═══
await recusa("visitante (anon) não chama", () => rpc({ papel: "anon" }, "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo }), "permission denied");
await recusa("conta sem adesão à Alumia não vê", () => chamar("fora", "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo }), "consentimento");
await recusa("conta sem adesão à Alumia não avisa", () => chamar("fora", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "obra" }), "consentimento");

// ═══ 5. Avisar ═══
await recusa("categoria fora da lista (policia)", () => chamar("ana", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "policia" }), "invalido:categoria");
await recusa("categoria com texto livre", () => chamar("ana", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "obra na rua x" }), "invalido:categoria");
await recusa("célula fora da Terra", () => chamar("ana", "rede_local_avisar", { p_la: 99999, p_lo: RECIFE.lo, p_categoria: "obra" }), "invalido:celula");
await recusa("posição de verdade (com casas decimais) não entra", () => chamar("ana", "rede_local_avisar", { p_la: -8.0631, p_lo: -34.8711, p_categoria: "obra" }), "integer");
const primeiro = await passa("ana avisa: assalto na célula do Marco Zero", () => chamar("ana", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "assalto" }));
const CHAVES = ["categoria", "confirmado", "criado_em", "expira_em", "id", "la", "lo", "renovado"];
if (primeiro) {
  ok("o aviso volta sem confirmação e é novo", primeiro.confirmado === false && primeiro.novo === true);
  ok(`o aviso não traz autor nem número (${Object.keys(primeiro).sort().join(",")})`, Object.keys(primeiro).filter((k) => k !== "novo").sort().join(",") === CHAVES.join(","));
  const criado = Date.parse(primeiro.criado_em);
  ok("o horário vem arredondado para 10 minutos (e para baixo)", criado % 600_000 === 0 && criado <= Date.now() && Date.now() - criado < 600_000 + 5000);
  ok("expira 2 horas depois", Date.parse(primeiro.expira_em) - criado === 2 * 3600_000);
}
await recusa("a mesma pessoa, de novo na mesma hora: recusa (uma ação por hora)", () => chamar("ana", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "assalto" }), "uma_por_hora");
await recusa("nem em outra célula", () => chamar("ana", "rede_local_avisar", { p_la: RECIFE.la + 1, p_lo: RECIFE.lo, p_categoria: "obra" }), "uma_por_hora");
const segundo = await passa("bia confirma o mesmo aviso", () => chamar("bia", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "assalto" }));
ok("com 2 relatos, ainda sem confirmação (e o mesmo aviso)", segundo?.confirmado === false && segundo?.novo === false && segundo?.id === primeiro?.id);
const terceiro = await passa("cris confirma: 3 relatos distintos", () => chamar("cris", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "assalto" }));
ok("com 3 relatos distintos na mesma hora, \"relatos confirmados\"", terceiro?.confirmado === true && terceiro?.id === primeiro?.id);
// A contagem é por hora: relatos de horas diferentes não somam (é o limite de uma por hora que garante que são pessoas distintas).
await dono("update interno.rede_local_avisos set bloco = bloco - 1 where id = $1", [primeiro?.id]);
await zerarLimite();
await passa("duda avisa uma obra ao lado", () => chamar("duda", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo + 1, p_categoria: "obra" }));
{
  const obra = await um("select * from interno.rede_local_avisos where categoria = 'obra'");
  await dono("update interno.rede_local_avisos set bloco = bloco - 1 where id = $1", [obra.id]);
  await zerarLimite();
  await passa("ana e bia confirmam a obra em outra hora", async () => {
    await chamar("ana", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo + 1, p_categoria: "obra" });
    return chamar("bia", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo + 1, p_categoria: "obra" });
  });
  const depois = await um("select confirmado from interno.rede_local_avisos where id = $1", [obra.id]);
  ok("1 relato numa hora e 2 na seguinte não confirmam (não dá para saber se são 3 pessoas)", depois.confirmado === false);
}

// ═══ 6. Ver ═══
await zerarLimite();
const viz = await passa("ver a vizinhança", () => chamar("eva", "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo }));
if (viz) {
  ok("ver traz os dois avisos", viz.avisos.length === 2);
  ok("o confirmado vem primeiro", viz.avisos[0].confirmado === true && viz.avisos[0].categoria === "assalto");
  ok(`ver não traz autor, contagem nem lista de pessoas (${Object.keys(viz).sort().join(",")})`, Object.keys(viz).sort().join(",") === "area,avisos,modera,travadas" && viz.avisos.every((a) => Object.keys(a).sort().join(",") === CHAVES.join(",")));
  ok("ver não diz que eva modera", viz.modera === false);
  ok("nenhum número de relatos em lugar nenhum da resposta", !/relatos|"n"|autor|usuario|quem/.test(JSON.stringify(viz)));
}
const longe = await passa("ver uma área longe (São Paulo)", () => chamar("eva", "rede_local_ver", { p_ala: areaDe(celulaDe(-23.55, -46.63)).ala, p_alo: areaDe(celulaDe(-23.55, -46.63)).alo }));
ok("a área longe não traz os avisos do Recife", longe?.avisos.length === 0);
await recusa("área fora da Terra", () => chamar("eva", "rede_local_ver", { p_ala: 99999, p_alo: 0 }), "invalido:area");

// ═══ 7. "Ainda está lá" ═══
{
  const obra = await um("select id, expira_em from interno.rede_local_avisos where categoria = 'obra'");
  // O aviso já tem 1h40 de vida: o fim vai para 2 horas a partir de agora.
  await dono("update interno.rede_local_avisos set criado_em = to_timestamp(floor(extract(epoch from now() - interval '100 minutes') / 600) * 600), expira_em = to_timestamp(floor(extract(epoch from now() - interval '100 minutes') / 600) * 600) + interval '2 hours' where id = $1", [obra.id]);
  const antes = await um("select expira_em from interno.rede_local_avisos where id = $1", [obra.id]);
  const r = await passa("eva: ainda está lá", () => chamar("eva", "rede_local_ainda_la", { p_id: obra.id }));
  ok("renovou: marca e o fim andou", r?.renovado === true && Date.parse(r.expira_em) > new Date(antes.expira_em).getTime());
  ok("o novo fim é 2 horas depois de agora, em 10 minutos", r && Date.parse(r.expira_em) % 600_000 === 0 && Date.parse(r.expira_em) - Date.now() <= 2 * 3600_000 && Date.parse(r.expira_em) - Date.now() > 2 * 3600_000 - 600_000 - 5000);
  await zerarLimite();
  await recusa("renovar de novo: recusa (uma vez só)", () => chamar("cris", "rede_local_ainda_la", { p_id: obra.id }), "ja_renovado");
  await recusa("renovar o que não existe", () => chamar("cris", "rede_local_ainda_la", { p_id: crypto.randomUUID() }), "nao_encontrado");
}

// ═══ 8. Vence e some ═══
{
  const obra = await um("select id from interno.rede_local_avisos where categoria = 'obra'");
  await dono("update interno.rede_local_avisos set criado_em = to_timestamp(floor(extract(epoch from now() - interval '5 hours') / 600) * 600), expira_em = to_timestamp(floor(extract(epoch from now() - interval '5 hours') / 600) * 600) + interval '2 hours' where id = $1", [obra.id]);
  const v = await chamar("eva", "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo });
  ok("o vencido não aparece", !v.avisos.some((a) => a.id === obra.id));
  await dono("select interno.rede_local_faxina()");
  ok("e a faxina apaga (relato falso some quando expira)", (await um("select count(*)::int n from interno.rede_local_avisos where id = $1", [obra.id])).n === 0);
}

// ═══ 9. A moderação ═══
{
  const assalto = await um("select id from interno.rede_local_avisos where categoria = 'assalto'");
  await recusa("quem não modera não apaga", () => chamar("eva", "rede_local_apagar", { p_id: assalto.id }), "sem_permissao");
  await recusa("quem não modera não trava", () => chamar("eva", "rede_local_travar", { p_ala: AREA.ala, p_alo: AREA.alo, p_horas: 6, p_motivo: "abuso" }), "sem_permissao");
  ok("a coordenação vê que modera", (await chamar("coord", "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo })).modera === true);
  await passa("a coordenação apaga um aviso", () => chamar("coord", "rede_local_apagar", { p_id: assalto.id }));
  ok("apagado, some", (await um("select count(*)::int n from interno.rede_local_avisos where id = $1", [assalto.id])).n === 0);
  const reg = await um("select acao, alvo, detalhes from interno.auditoria where acao = 'local_aviso_apagado' order by criado_em desc limit 1");
  ok("o registro diz quem apagou e a categoria, sem célula nem autor", reg?.alvo === "" && JSON.stringify(reg.detalhes) === '{"categoria":"assalto"}');
  await zerarLimite();
  await passa("ana avisa de novo na área", () => chamar("ana", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "rua_bloqueada" }));
  await recusa("trava com motivo fora da lista", () => chamar("coord", "rede_local_travar", { p_ala: AREA.ala, p_alo: AREA.alo, p_horas: 6, p_motivo: "porque sim" }), "invalido:motivo");
  await recusa("trava por mais de 72 horas", () => chamar("coord", "rede_local_travar", { p_ala: AREA.ala, p_alo: AREA.alo, p_horas: 100, p_motivo: "abuso" }), "invalido:horas");
  const t = await passa("a coordenação trava a área", () => chamar("coord", "rede_local_travar", { p_ala: AREA.ala, p_alo: AREA.alo, p_horas: 6, p_motivo: "infiltracao" }));
  ok("a trava não devolve número abaixo de 3 (só se apagou 3 ou mais)", t && typeof t.apagados === "boolean");
  ok("travada, os avisos da área somem", (await um("select count(*)::int n from interno.rede_local_avisos where la >= $1 and la < $2", [AREA.ala * 10, AREA.ala * 10 + 10])).n === 0);
  await recusa("área travada: ninguém avisa nela", () => chamar("bia", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "obra" }), "area_travada");
  const v = await chamar("bia", "rede_local_ver", { p_ala: AREA.ala, p_alo: AREA.alo });
  ok("ver diz que a área está travada (só a área, sem quem travou)", v.travadas.length === 1 && Object.keys(v.travadas[0]).sort().join(",") === "ala,alo,ate");
  await passa("a coordenação destrava", () => chamar("coord", "rede_local_destravar", { p_ala: AREA.ala, p_alo: AREA.alo }));
  await passa("destravada, avisa de novo", () => chamar("bia", "rede_local_avisar", { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "obra" }));
}

// ═══ 10. O aceite: com acesso total ao banco, não dá para ligar um aviso a uma conta ═══
// 10a. Nenhuma linha em tabela nenhuma (fora o próprio aviso) leva o id do aviso; e a ação só deixa rastro da conta no limite.
{
  await limpar();
  const tabelas = (await dono(`select format('%I.%I', n.nspname, c.relname) t from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('interno', 'public', 'auth') order by 1`)).rows.map((r) => r.t);
  const comTexto = async (agulha) => {
    const achou = {};
    for (const t of tabelas) {
      const n = (await dono(`select count(*)::int n from ${t} x where x::text like $1`, [`%${agulha}%`])).rows[0].n;
      if (n) achou[t] = n;
    }
    return achou;
  };
  const antes = await comTexto(P.duda);
  const a = await chamar("duda", "rede_local_avisar", { p_la: RECIFE.la + 2, p_lo: RECIFE.lo + 2, p_categoria: "alagamento" });
  const depois = await comTexto(P.duda);
  const mudou = tabelas.filter((t) => (antes[t] ?? 0) !== (depois[t] ?? 0));
  ok(`avisar só deixa a conta no limite (mudou: ${mudou.join(",")})`, mudou.length === 1 && mudou[0] === "interno.rede_local_limite");
  const comId = await comTexto(a.id);
  ok(`o id do aviso só existe no próprio aviso (${JSON.stringify(comId)})`, Object.keys(comId).join(",") === "interno.rede_local_avisos");
  ok("nada no registro de atividades por avisar", (await um("select count(*)::int n from interno.auditoria where acao like 'local_%' and quem = $1", [P.duda])).n === 0);
}

// 10b. Troca de papéis: duas pessoas avisam na mesma hora; trocando quem avisou o quê, o banco fica igual.
async function retrato() {
  const av = (await dono("select la, lo, categoria, criado_em, expira_em, renovado, confirmado, bloco, relatos_no_bloco from interno.rede_local_avisos order by la, lo, categoria")).rows;
  const li = (await dono("select usuario, bloco from interno.rede_local_limite order by usuario")).rows;
  return JSON.stringify({ av, li });
}
{
  const X = { p_la: RECIFE.la, p_lo: RECIFE.lo, p_categoria: "cuidado" };
  const Y = { p_la: RECIFE.la + 3, p_lo: RECIFE.lo - 2, p_categoria: "rua_bloqueada" };
  const cenario = async (quemX, quemY, renova) => {
    await limpar();
    await chamar(quemX, "rede_local_avisar", X);
    await chamar(quemY, "rede_local_avisar", Y);
    if (renova) {
      // A terceira pessoa renova o aviso de quemY... ou de quemX: o limite fica igual.
      const alvo = await um("select id from interno.rede_local_avisos where categoria = $1", [renova]);
      await chamar("eva", "rede_local_ainda_la", { p_id: alvo.id });
    }
    return retrato();
  };
  let A, B, tentativas = 0;
  do {
    A = await cenario("ana", "bia");
    B = await cenario("bia", "ana");
    tentativas++;
  } while (A !== B && tentativas < 3); // se a hora virar no meio, repete
  ok("ana avisa X e bia Y, ou bia X e ana Y: o banco fica exatamente igual", A === B);
  const C = await cenario("ana", "bia", "cuidado");
  const D = await cenario("ana", "bia", "rua_bloqueada");
  ok("eva renova X ou renova Y: o limite fica igual (só o aviso muda)", JSON.parse(C).li.length === 3 && JSON.stringify(JSON.parse(C).li) === JSON.stringify(JSON.parse(D).li));
}

// 10c. A transação que gravou: nenhuma linha do limite tem a transação de um aviso que não seja de todas as linhas.
{
  await limpar();
  for (const [i, quem] of ["ana", "bia", "cris", "duda"].entries()) await chamar(quem, "rede_local_avisar", { p_la: RECIFE.la + i, p_lo: RECIFE.lo, p_categoria: "obra" });
  const av = (await dono("select xmin::text x from interno.rede_local_avisos")).rows.map((r) => r.x);
  const li = (await dono("select xmin::text x from interno.rede_local_limite")).rows.map((r) => r.x);
  ok("as linhas do limite foram todas regravadas juntas (uma transação só)", new Set(li).size === 1 && li.length === 4);
  ok("cada aviso ou não divide a transação com o limite ou divide com TODAS as linhas", av.every((x) => !li.includes(x) || li.every((y) => y === x)));
  ok("só o último aviso divide a transação (com as quatro contas ao mesmo tempo)", av.filter((x) => li.includes(x)).length === 1);
  ok("a hora passada do limite some na próxima ação", (await um("select count(*)::int n from interno.rede_local_limite where bloco < floor(extract(epoch from now()) / 3600)")).n === 0);
}

// ═══ 11. O aparelho: arredonda antes de enviar ═══
{
  const c = celulaDe(-8.06312345, -34.87114321);
  ok("a célula é um par de inteiros", Number.isInteger(c.la) && Number.isInteger(c.lo));
  ok("duas posições a 50 m caem na mesma célula", JSON.stringify(celulaDe(-8.06312, -34.8711)) === JSON.stringify(celulaDe(-8.0627, -34.8712)) || JSON.stringify(celulaDe(-8.0634, -34.8705)) === JSON.stringify(celulaDe(-8.0632, -34.8709)));
  ok("o lado da célula é de cerca de 200 m", Math.round(PASSO * 111_320) === 223 && Math.round(PASSO * 111_320 * Math.cos((23.5 * Math.PI) / 180)) === 204);
  ok("do centro da célula, a posição de verdade não volta (só a célula)", JSON.stringify(Object.keys(pedidoDeAviso(c, "obra")).sort()) === '["p_categoria","p_la","p_lo"]' && Object.values(pedidoDeAviso(c, "obra")).slice(0, 2).every(Number.isInteger));
  let lancou = false;
  try {
    pedidoDeAviso({ la: -8.06, lo: -34.87 }, "obra");
  } catch {
    lancou = true;
  }
  ok("o pedido com posição de verdade nem sai do aparelho", lancou);
  ok("categoria fora da lista nem sai", (() => { try { pedidoDeAviso(c, "policia"); return false; } catch { return true; } })());
  ok("a área (2 km) usa o mesmo floor do banco, inclusive com número negativo", JSON.stringify(areaDe({ la: -4032, lo: -17436 })) === '{"ala":-404,"alo":-1744}');
  ok("andar pelas setas: norte e leste", JSON.stringify(andar({ la: 1, lo: 1 }, 1, -1)) === '{"la":2,"lo":0}');
  {
    // O ponto de partida pelo município: o centro do índice (lib/rede/mapa/municipios.json) volta a uma célula perto da cidade.
    const indice = JSON.parse(ler("lib/rede/mapa/municipios.json"));
    const ponto = (uf, nome) => { const [, x, y] = indice[uf].split(";").find((i) => i.startsWith(`${nome}|`)).split("|").map(Number); return { x, y }; };
    const perto = (uf, nome, lat, lon, km) => distanciaERumo(celulaDoMunicipio(ponto(uf, nome)), celulaDe(lat, lon)).metros <= km * 1000;
    ok("o centro do município de Recife cai a menos de 10 km do Marco Zero", perto("PE", "Recife", -8.0631, -34.8711, 10));
    ok("o de Porto Alegre e o de São Paulo também (a mesma conta para o Brasil todo)", perto("RS", "Porto Alegre", -30.03, -51.23, 10) && perto("SP", "São Paulo", -23.55, -46.63, 10));
    ok("ponto do desenho inválido não vira célula", celulaDoMunicipio({ x: Number.NaN, y: 1 }) === null);
  }
  ok("distância e rumo de célula a célula", distanciaERumo({ la: 0, lo: 0 }, { la: 2, lo: 0 }).rumo === "n" && distanciaERumo({ la: 0, lo: 0 }, { la: 2, lo: 0 }).metros === 400);
  const v = limparVizinhanca({ area: { ala: 1, alo: 2 }, avisos: [
    { id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d01", la: 10, lo: 20, categoria: "obra", confirmado: true, renovado: false, criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 60e3).toISOString(), autor: "x", relatos: 2 },
    { id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d02", la: 10, lo: 20, categoria: "policia", confirmado: false, renovado: false, criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 60e3).toISOString() },
    { id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d03", la: 10, lo: 20, categoria: "obra", confirmado: false, renovado: false, criado_em: new Date().toISOString(), expira_em: new Date(Date.now() - 60e3).toISOString() },
  ], travadas: [], modera: false });
  ok("a tela desconfia do banco: sem campo estranho, sem categoria de fora, sem vencido", v.avisos.length === 1 && !("autor" in v.avisos[0]) && !("relatos" in v.avisos[0]));
  // As áreas seguidas: só no aparelho.
  const guarda = new Map();
  const loja = { getItem: (k) => guarda.get(k) ?? null, setItem: (k, x) => guarda.set(k, x), removeItem: (k) => guarda.delete(k) };
  guardarSeguidas(loja, alternarSeguida([], { ala: -404, alo: -1744 }));
  ok("seguir uma área guarda no aparelho", lerSeguidas(loja).length === 1);
  guardarSeguidas(loja, alternarSeguida(lerSeguidas(loja), { ala: -404, alo: -1744 }));
  ok("deixar de seguir tira", lerSeguidas(loja).length === 0);
  ok("sem armazenamento (aba privada), nada quebra", lerSeguidas({ getItem: () => { throw new Error("x"); } }).length === 0);
}

// ═══ 12. A tela, a rota, o interruptor e os textos ═══
try {
  ok("o interruptor existe e é só pelo nome", FLAG in RECURSOS && SO_PELO_NOME.includes(FLAG));
  ok("\"todos\" não liga; o nome liga", ligado(FLAG, lerRecursos("todos")) === false && ligado(FLAG, lerRecursos(`todos,${FLAG}`)) === true);
  ok("desligado por padrão: a tela não abre", avisosDeLocalLigados() === false || (process.env.NEXT_PUBLIC_RECURSOS ?? "").includes(FLAG));
  const rota = ROTAS_NOVAS.find((r) => r.nome === "avisos-de-local");
  ok("a rota nova está na lista, nunca indexada", rota?.caminho === "/mapa/avisos" && rota.flag === FLAG && rota.indexar === false);
  ok("desligada, a rota não abre (404)", rotaNovaLigada("avisos-de-local") === false || (process.env.NEXT_PUBLIC_RECURSOS ?? "").includes(FLAG));
  const pagina = "app/[lang]/alumia/mapa/avisos/page.tsx";
  ok("a página existe e passa pela PaginaNova", existe(pagina) && ler(pagina).includes('nome="avisos-de-local"') && ler(pagina).includes("metadadosDaRotaNova"));
  ok("a tela está no registro com import dinâmico", /"avisos-de-local": \{ componente: dynamic\(\(\) => import\("\.\/mapa\/TelaDosAvisosDeLocal"\), \{ ssr: false \}\)/.test(ler("components/rede/registro.tsx")));
  ok("o painel único descreve o interruptor", ler("components/painel/alumia/nomes-das-funcoes.ts").includes(`"${FLAG}": { nome: "Avisos de local"`));
  ok("a tela e o cliente existem", existe("components/rede/mapa/TelaDosAvisosDeLocal.tsx") && existe("lib/rede/mapa/cliente-avisos.ts"));
  const tela = lerSeHouver("components/rede/mapa/TelaDosAvisosDeLocal.tsx") + lerSeHouver("lib/rede/mapa/cliente-avisos.ts");
  ok("a tela não pede nada a serviço de fora (sem http, sem blocos de mapa)", !/https?:\/\/|tile|openstreetmap|googleapis|mapbox|leaflet/i.test(tela));
  ok("a tela não envia a posição de verdade: o rpc só recebe o pedido arredondado", /pedidoDeAviso\(/.test(tela) && !/rpc[^;]*latitude/.test(tela));
  ok("seguir área não chama o banco", !/rpc\([^)]*segu/i.test(tela) && /lerSeguidas|guardarSeguidas/.test(tela));
  ok("a tela não pede push nem notificação", !/Notification|pushManager|serviceWorker/.test(tela));
  // Nada daqui no Fediverso, na prévia de link nem nas páginas abertas.
  const fora = [];
  const andarPor = (dir) => {
    if (!existe(dir)) return;
    for (const e of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) andarPor(rel);
      else if (/\.(tsx?|mjs)$/.test(e.name) && /rede_local_|avisos-de-local|cliente-avisos/.test(ler(rel))) fora.push(rel);
    }
  };
  for (const d of ["lib/fediverso", "app/api", "lib/rede/previa", "lib/rede/fediverso"]) andarPor(d);
  ok(`nenhuma rota de API, do Fediverso ou de prévia de link fala dos avisos (${fora.join(",")})`, fora.length === 0);
  // Os textos.
  const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
  const T = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(lerSeHouver(`i18n/rede/avisos-de-local/${l}.json`) || "{}")]));
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).filter((k) => k !== "_rascunho").sort();
  for (const l of idiomas) {
    ok(`${l}: as mesmas chaves do português`, JSON.stringify(chaves(T[l])) === JSON.stringify(chaves(T.pt)));
    ok(`${l}: ${l === "pt" ? "sem" : "com"} a marca de rascunho`, l === "pt" ? !("_rascunho" in T.pt) : T[l]._rascunho === true);
    ok(`${l}: as seis categorias`, CATEGORIAS.every((c) => typeof T[l].categorias[c] === "string" && T[l].categorias[c].length > 2));
    ok(`${l}: os motivos da trava`, MOTIVOS_DA_TRAVA.every((m) => typeof T[l].moderacao.motivos[m] === "string"));
  }
  const nomesDasCategorias = idiomas.map((l) => Object.values(T[l].categorias).join(" ")).join(" ");
  ok("nenhuma categoria nomeia a polícia", !/pol[ií]c|police|polic[eí]a|полиц|警|\bPM\b|guarda|blitz/i.test(nomesDasCategorias));
  ok("o rótulo \"relato de usuárias, não verificado\"", T.pt.rotulo === "Relato de usuárias, não verificado");
  ok("a tela diz o limite do anonimato (perante as pessoas, não perante o servidor)", /outras pessoas/.test(T.pt.anonimato) && /servidor/.test(T.pt.anonimato));
  ok("a tela não mostra número abaixo de 3: sem confirmação, sem número", !/\{n\}/.test(JSON.stringify(T.pt.estado)) && /menos de 3/.test(T.pt.estado.semConfirmacao));
  ok("a tela diz que não há push", /push|notifica/i.test(T.pt.semPush));
  const onda5 = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler(`i18n/rede/onda5/${l}.json`))]));
  ok("o título da rota nos seis idiomas (onda5)", idiomas.every((l) => onda5[l].telas["avisos-de-local"]?.titulo && onda5[l].telas["avisos-de-local"]?.descricao));
} catch (erro) {
  falhas.push(`a tela, a rota e os textos: ${erro.message}`);
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
