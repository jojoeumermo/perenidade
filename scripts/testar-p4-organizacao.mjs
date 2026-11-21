// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, grupo organização e ação coletiva (itens 52 a 67 e 122), atrás de "alumia-p4-organizacao":
//   · banco (supabase/migracoes/20261127-p4-organizacao.sql por cima do install.sql, duas vezes): cada item e a regra de privacidade
//     dele (nenhuma lista de pessoas, nenhum número abaixo de 3, nenhum IP, quem assumiu/votou/apoiou/contribuiu nunca sai);
//   · as regras puras do aparelho (lib/rede/organizacao/regras.ts: as datas e o .ics das reuniões, a rota sem internet, a denúncia
//     coletiva, o rascunho da ata, a chave Pix aleatória);
//   · as ligações (flag, rota, registro, painel, textos nos seis idiomas).
// Uso: npm run testar:p4-organizacao
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { RECURSOS, SO_PELO_NOME, ligado, lerRecursos } from "../lib/recursos.ts";
import { ROTAS_NOVAS } from "../lib/rede/rotas-novas.ts";
import { NOMES_DAS_FUNCOES } from "../components/painel/alumia/nomes-das-funcoes.ts";
import * as R from "../lib/rede/organizacao/regras.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
// Um erro fora de passa()/recusa() para o teste: mostra as falhas até ali e a causa, sem o despejo do PGlite.
process.on("uncaughtException", (e) => {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  console.log(`parou: ${e?.message}`);
  process.exit(1);
});
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

const SQL = normal(ler("supabase/migracoes/20261127-p4-organizacao.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
const TABELAS = [...semComentario.matchAll(/create table if not exists interno\.(rede_p4_or_\w+)/g)].map((m) => m[1]);

// ═══ 0. A migração, por fora ═══
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("cabeçalho com licença, a ordem (antes do p4-fim), \"Pode rodar mais de uma vez\" e a lei",
  SQL.startsWith("-- Instituto Lúcia") && SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)") && SQL.includes("antes do 20261127-p4-fim.sql")
  && SQL.includes("Pode rodar mais de uma vez") && /Lei: LGPD art\./.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem\(|vale_hash_origem/i.test(semComentario));
ok("o interruptor entra no catálogo protegido por to_regclass", /if to_regclass\('interno\.recursos_catalogo'\) is not null then\s+insert into interno\.recursos_catalogo \(nome, so_pelo_nome\) values \('alumia-p4-organizacao', true\)/.test(SQL));
ok("não sobe a versão nem mexe na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
ok("não redefine função que já existia (só rede_p4_or_*)", [...semComentario.matchAll(/create or replace function (\w+)\.(\w+)/g)].every((m) => m[2].startsWith("rede_p4_or_")));
ok("nenhum Math.random nem random() de segurança", !/random\(\)/.test(semComentario));
{
  const publicas = [...semComentario.matchAll(/create or replace function public\.(\w+)\([^)]*\)[^$]*?\$\$\s*(declare[\s\S]*?)?begin\s+([^;]+);/g)];
  const semPorta = publicas.filter((m) => !m[3].includes("interno.alumia_porta()")).map((m) => m[1]);
  ok(`toda função pública começa pela porta (${semPorta.join(", ")})`, semPorta.length === 0 && publicas.length >= 1);
}

// ═══ 1. Antes da migração: nada disso existia ═══
{
  const banco = await criarBanco(normal(ler("supabase/install.sql")).includes(SQL) ? { antesDe: SQL } : {});
  const n = (await banco.dono("select count(*)::int n from pg_proc where proname like 'rede_p4_or_%'")).rows[0].n;
  ok(`antes: nenhuma função do grupo (${n})`, n === 0);
  const t = (await banco.dono("select count(*)::int n from pg_class where relname like 'rede_p4_or_%'")).rows[0].n;
  ok(`antes: nenhuma tabela do grupo (${t})`, t === 0);
  await banco.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const install = normal(ler("supabase/install.sql"));
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const t = (await dono(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'interno' and c.relname = any($1) and c.relkind = 'r'`, [TABELAS])).rows;
  ok(`as tabelas novas existem, todas com RLS ligada (${t.length} de ${TABELAS.length})`, t.length === TABELAS.length && t.every((x) => x.relrowsecurity));
  const pol = (await dono("select count(*)::int n from pg_policies where schemaname = 'interno' and tablename = any($1)", [TABELAS])).rows[0].n;
  ok("nenhuma política nas tabelas (só as funções)", pol === 0);
  const cols = (await dono(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)`, [TABELAS])).rows;
  ok("nenhuma coluna de endereço de rede", !cols.some((c) => c.data_type === "inet" || /(^|_)ip($|_)|origem|endereco_rede/.test(c.column_name)));
  const cat = (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-organizacao'")).rows[0];
  ok("o interruptor está no catálogo, só pelo nome", cat?.so_pelo_nome === true);
  const vivo = (await dono("select ligado from interno.recursos_vivos where nome = 'alumia-p4-organizacao'")).rows[0];
  ok("e começa desligado (sem decisão no painel)", vivo === undefined || vivo.ligado === false);
  const anon = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname like 'rede_p4_or_%' and has_function_privilege('anon', p.oid, 'execute')`)).rows.map((x) => x.proname);
  ok(`visitante não chama nada do grupo (${anon.join(", ")})`, anon.length === 0);
  const internas = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'interno' and p.proname like 'rede_p4_or_%' and has_function_privilege('authenticated', p.oid, 'execute')`)).rows.map((x) => x.proname);
  ok(`as funções internas ficam fechadas para quem tem conta (${internas.join(", ")})`, internas.length === 0);
}

// Pessoas: ana gerencia a organização; bia e cris ocupam uma função (mandato aceito); eva foi indicada e não aceitou; duda e fabi
// são membros da Alumia sem nada na organização. A organização é um perfil próprio.
const P = {};
for (const [i, nome] of ["ana", "bia", "cris", "duda", "eva", "fabi", "gil", "org"].entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-organizacao.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], nome === "org" ? "Coletivo Teste" : `Pessoa ${i + 1}`, nome === "org" ? "coletivo_teste" : `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_orgs (perfil, tipo, cidade) values ($1, 'coletivo', 'São Paulo') on conflict do nothing", [P.org]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono') on conflict do nothing", [P.org, P.ana]);
const FUNCAO_SEC = (await dono("insert into interno.rede_org_funcoes (org, tipo, nome) values ($1, 'secretaria', 'Secretaria') returning id", [P.org])).rows[0].id;
const FUNCAO_COM = (await dono("insert into interno.rede_org_funcoes (org, tipo, nome) values ($1, 'comunicacao', 'Comunicação') returning id", [P.org])).rows[0].id;
for (const [quem, aceito] of [["bia", true], ["cris", true], ["eva", false]]) {
  await dono("insert into interno.rede_org_mandatos (funcao, pessoa, fim, aceito) values ($1, $2, current_date + 90, $3)", [FUNCAO_SEC, P[quem], aceito]);
}
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values
  ('luta-moradia', 'Luta por moradia', 'lutas', 'aberta'), ('roda-fechada', 'Roda fechada', 'lutas', 'fechada') on conflict do nothing`);
for (const [slug, quem, papel] of [["luta-moradia", "ana", "moderacao"], ["luta-moradia", "bia", "membro"], ["luta-moradia", "cris", "membro"], ["luta-moradia", "duda", "membro"],
  ["roda-fechada", "ana", "moderacao"], ["roda-fechada", "bia", "membro"]]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ($1, $2, $3, 'ativo') on conflict do nothing", [slug, P[quem], papel]);
}
const como = (quem, funcao, args = {}) => rpc({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9" }, funcao, args);
const chamar = async (quem, funcao, args) => {
  await dono("delete from interno.limites");
  return como(quem, funcao, args);
};
/** Nenhum id de pessoa (nem da organização) na resposta. */
const semPessoas = (r, ...quem) => {
  const s = JSON.stringify(r ?? null);
  return (quem.length ? quem : Object.keys(P).filter((k) => k !== "org")).every((k) => !s.includes(P[k]));
};
const ORG = "coletivo_teste";

// ── Desligado: tudo recusa ──
await recusa("desligado: as organizações e comunidades da pessoa recusam", () => chamar("ana", "rede_p4_or_minhas", {}), "desligado");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-organizacao', true) on conflict (nome) do update set ligado = true");

// ── As organizações e comunidades da própria pessoa: só as dela ──
{
  const daAna = await passa("as da ana", () => chamar("ana", "rede_p4_or_minhas", {}));
  ok(`a ana vê a organização que gerencia (${JSON.stringify(daAna?.orgs)})`, daAna?.orgs?.length === 1 && daAna.orgs[0].handle === ORG && daAna.orgs[0].gerencio === true);
  const daBia = await chamar("bia", "rede_p4_or_minhas", {});
  ok("a bia, com função, vê a organização sem gerenciar", daBia?.orgs?.length === 1 && daBia.orgs[0].gerencio === false);
  ok("a bia vê as duas comunidades dela", daBia?.comunidades?.length === 2);
  const daEva = await chamar("eva", "rede_p4_or_minhas", {});
  ok("a eva, indicada sem aceitar, não é de dentro", daEva?.orgs?.length === 0);
  const daDuda = await chamar("duda", "rede_p4_or_minhas", {});
  ok("a duda, de fora, não vê organização nenhuma", daDuda?.orgs?.length === 0);
  ok("a resposta não traz id de ninguém nem número de pessoas", semPessoas(daAna) && !/membros|total|pessoas/.test(JSON.stringify(daAna)));
}

// ═══ 3. Os itens ═══

// ── 52. Quadro da organização ──
const ATO = (await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Ato pela moradia na praça', 'post') returning id", [P.org])).rows[0].id;
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, titulo) values ($1, now() + interval '2 days', 'São Paulo', 'Praça da Sé', 'Ato pela moradia')", [ATO]);
const ATO_ALHEIO = (await dono("insert into interno.rede_posts (autor, texto, tipo) values ($1, 'Ato de outra pessoa', 'post') returning id", [P.fabi])).rows[0].id;
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, titulo) values ($1, now() + interval '3 days', 'Recife', 'Marco Zero', 'Outro ato')", [ATO_ALHEIO]);
{
  await recusa("52: quem é de fora não vê o quadro (nem fica sabendo que existe)", () => chamar("duda", "rede_p4_or_quadro", { p_org: ORG }), "nao_encontrado");
  await recusa("52: a indicada que não aceitou também não", () => chamar("eva", "rede_p4_or_quadro", { p_org: ORG }), "nao_encontrado");
  const q = await passa("52: a bia (com função) abre o quadro", () => chamar("bia", "rede_p4_or_quadro", { p_org: ORG }));
  ok("52: o quadro traz as funções e os atos que a organização chama (só os dela)", q?.funcoes?.length === 2 && q?.atos?.length === 1 && q.atos[0].id === ATO && q.gerencio === false);
  await recusa("52: cartão sem título não entra", () => chamar("bia", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "x" } }), "invalido:titulo");
  await recusa("52: cartão com telefone nas notas não entra", () => chamar("bia", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Levar o som", notas: "liga 11 98765-4321" } }), "dado_pessoal");
  await recusa("52: ato de outra pessoa não liga ao cartão", () => chamar("bia", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Faixa", ato: ATO_ALHEIO } }), "invalido:ato");
  await recusa("52: função de fora da organização não", () => chamar("bia", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Faixa", funcao: "00000000-0000-4000-8000-000000000000" } }), "invalido:funcao");
  const c = await passa("52: a bia põe um cartão ligado ao ato e à secretaria", () => chamar("bia", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Pintar a faixa do ato", notas: "Tinta na sede", prazo: "2030-01-10", ato: ATO, funcao: FUNCAO_SEC } }));
  ok("52: o cartão nasce em 'a fazer', com o ato e a função (nunca uma pessoa)", c?.coluna === "a_fazer" && c.ato?.id === ATO && c.funcao?.nome === "Secretaria" && c.eu === false && c.tem_quem === false && c.assumidas === null);
  ok("52: o cartão não traz id de pessoa nenhuma", semPessoas(c) && !/autor|criado_por|pessoa|handle|codinome/.test(Object.keys(c ?? {}).join()));
  const eu = await passa("52: a bia assume", () => chamar("bia", "rede_p4_or_cartao_assumir", { p_id: c?.id, p_sim: true }));
  ok("52: para ela, 'eu' e 'tem quem leve'; o total, abaixo de 3, não aparece", eu?.eu === true && eu.tem_quem === true && eu.assumidas === null);
  const daCris = await chamar("cris", "rede_p4_or_quadro", { p_org: ORG });
  const visto = daCris?.cartoes?.find((x) => x.id === c?.id);
  ok("52: a cris vê 'tem quem leve', sem saber quem (nem o total, com 1)", visto?.tem_quem === true && visto.eu === false && visto.assumidas === null && semPessoas(daCris));
  await chamar("cris", "rede_p4_or_cartao_assumir", { p_id: c?.id, p_sim: true });
  const com2 = await chamar("ana", "rede_p4_or_quadro", { p_org: ORG });
  ok("52: com 2 pessoas, nem quem gerencia vê o número", com2?.cartoes?.find((x) => x.id === c?.id)?.assumidas === null && semPessoas(com2));
  await chamar("ana", "rede_p4_or_cartao_assumir", { p_id: c?.id, p_sim: true });
  const com3 = await chamar("cris", "rede_p4_or_quadro", { p_org: ORG });
  ok("52: com 3, o total aparece (3), ainda sem quem", com3?.cartoes?.find((x) => x.id === c?.id)?.assumidas === 3 && semPessoas(com3));
  const desfeito = await chamar("bia", "rede_p4_or_cartao_assumir", { p_id: c?.id, p_sim: false });
  ok("52: desfazer tira só a própria pessoa (volta a menos de 3)", desfeito?.eu === false && desfeito.assumidas === null && desfeito.tem_quem === true);
  await recusa("52: coluna inventada não", () => chamar("bia", "rede_p4_or_cartao_mover", { p_id: c?.id, p_coluna: "lixo" }), "invalido:coluna");
  const movido = await passa("52: a cris move para 'fazendo'", () => chamar("cris", "rede_p4_or_cartao_mover", { p_id: c?.id, p_coluna: "fazendo" }));
  ok("52: o cartão está em 'fazendo'", movido?.coluna === "fazendo");
  await recusa("52: quem é de fora não move nem assume", () => chamar("duda", "rede_p4_or_cartao_mover", { p_id: c?.id, p_coluna: "feito" }), "nao_encontrado");
  await recusa("52: quem tem função não apaga (só quem gerencia)", () => chamar("bia", "rede_p4_or_cartao_apagar", { p_id: c?.id }), "sem_permissao");
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_cartoes'")).rows.map((x) => x.column_name);
  ok("52: a tabela do cartão não guarda quem criou nem quem move", !cols.some((x) => /autor|criado_por|pessoa|movido_por|quem/.test(x)));
  globalThis.CARTAO_52 = c?.id;
}

// ── 122. Rodízio de tarefas ──
{
  await recusa("122: recorrência inventada não", () => chamar("ana", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Boletim", recorrencia: "diaria" } }), "invalido:recorrencia");
  await recusa("122: escala sem recorrência não", () => chamar("ana", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Boletim", rodizio: [FUNCAO_SEC] } }), "invalido:rodizio");
  await recusa("122: escala com função repetida não", () => chamar("ana", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Boletim", recorrencia: "semanal", rodizio: [FUNCAO_SEC, FUNCAO_SEC] } }), "invalido:rodizio");
  await recusa("122: escala com função de fora não", () => chamar("ana", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Boletim", recorrencia: "semanal", rodizio: [FUNCAO_SEC, "00000000-0000-4000-8000-000000000001"] } }), "invalido:rodizio");
  const r = await passa("122: a ana põe o boletim semanal com a escala secretaria → comunicação", () =>
    chamar("ana", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Mandar o boletim", prazo: "2030-01-07", recorrencia: "semanal", rodizio: [FUNCAO_SEC, FUNCAO_COM] } }));
  ok("122: o cartão leva a escala (só funções, na ordem) e começa pela primeira", r?.recorrencia === "semanal" && r.rodizio?.map((f) => f.nome).join() === "Secretaria,Comunicação" && r.funcao?.nome === "Secretaria");
  ok("122: a escala não traz pessoa nenhuma", semPessoas(r) && !/pessoa|ocupa|codinome|handle/.test(JSON.stringify(r?.rodizio)));
  await chamar("bia", "rede_p4_or_cartao_assumir", { p_id: r?.id, p_sim: true });
  const feito = await passa("122: a bia leva para 'feito'", () => chamar("bia", "rede_p4_or_cartao_mover", { p_id: r?.id, p_coluna: "feito" }));
  ok("122: o feito deixa de ser recorrente", feito?.coluna === "feito" && feito.recorrencia === null);
  const q = await chamar("bia", "rede_p4_or_quadro", { p_org: ORG });
  const novo = q?.cartoes?.find((x) => x.titulo === "Mandar o boletim" && x.coluna === "a_fazer");
  ok(`122: nasce o próximo, uma semana depois, com a próxima função (${novo?.prazo}, ${novo?.funcao?.nome})`, novo?.prazo === "2030-01-14" && novo.funcao?.nome === "Comunicação" && novo.recorrencia === "semanal");
  ok("122: o próximo não herda quem assumiu", novo?.eu === false && novo.tem_quem === false);
  await chamar("bia", "rede_p4_or_cartao_mover", { p_id: r?.id, p_coluna: "fazendo" });
  await chamar("bia", "rede_p4_or_cartao_mover", { p_id: r?.id, p_coluna: "feito" });
  const q2 = await chamar("bia", "rede_p4_or_quadro", { p_org: ORG });
  ok("122: ir e voltar de 'feito' não cria outro", q2?.cartoes?.filter((x) => x.titulo === "Mandar o boletim").length === 2);
  await chamar("cris", "rede_p4_or_cartao_mover", { p_id: novo?.id, p_coluna: "feito" });
  const q3 = await chamar("cris", "rede_p4_or_quadro", { p_org: ORG });
  const terceiro = q3?.cartoes?.find((x) => x.titulo === "Mandar o boletim" && x.coluna === "a_fazer");
  ok("122: a escala volta ao começo (comunicação → secretaria)", terceiro?.funcao?.nome === "Secretaria" && terceiro.prazo === "2030-01-21");
  const m = await chamar("ana", "rede_p4_or_cartao_criar", { p: { org: ORG, titulo: "Prestar contas", prazo: "2030-01-31", recorrencia: "mensal" } });
  await chamar("ana", "rede_p4_or_cartao_mover", { p_id: m?.id, p_coluna: "feito" });
  const q4 = await chamar("ana", "rede_p4_or_quadro", { p_org: ORG });
  ok("122: o mensal de 31/01 vai para o último dia de fevereiro", q4?.cartoes?.find((x) => x.titulo === "Prestar contas" && x.coluna === "a_fazer")?.prazo === "2030-02-28");
  ok("122: as regras do aparelho dão a mesma conta", R.proximaFuncao(["a", "b", "c"], "c") === "a" && R.proximaFuncao(["a", "b"], null) === "a" && R.proximaFuncao([], "x") === "x"
    && R.proximoPrazo("2030-01-07", "semanal") === "2030-01-14" && R.proximoPrazo("2030-01-07", "quinzenal") === "2030-01-21" && R.proximoPrazo("2030-01-31", "mensal") === "2030-02-28");
}

// ── 53. Enquete de horário para reunião ──
{
  const futuro = (dias, hora) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 11) + `${hora}:00:00-03:00`;
  const OPC = [futuro(10, "19"), futuro(11, "19"), futuro(12, "10")];
  await recusa("53: quem só tem função sem a mesa não abre a enquete", () => chamar("bia", "rede_p4_or_horario_criar", { p: { org: ORG, titulo: "Reunião de novembro", opcoes: OPC, fecha_em: futuro(5, "12") } }), "sem_permissao");
  await recusa("53: um horário só não é enquete", () => chamar("ana", "rede_p4_or_horario_criar", { p: { org: ORG, titulo: "Reunião", opcoes: [OPC[0]], fecha_em: futuro(5, "12") } }), "invalido:opcoes");
  await recusa("53: fechar depois do primeiro horário não", () => chamar("ana", "rede_p4_or_horario_criar", { p: { org: ORG, titulo: "Reunião", opcoes: OPC, fecha_em: futuro(20, "12") } }), "invalido:fecha_em");
  const e = await passa("53: quem gerencia abre a enquete", () => chamar("ana", "rede_p4_or_horario_criar", { p: { org: ORG, titulo: "Reunião de novembro", opcoes: OPC, fecha_em: futuro(5, "12") } }));
  ok("53: aberta, sem parcial nenhum", e?.fechada === false && e.resultado === null && e.opcoes?.length === 3 && e.votei === false);
  await recusa("53: quem é de fora não vota", () => chamar("duda", "rede_p4_or_horario_votar", { p_id: e?.id, p_opcoes: [1] }), "nao_encontrado");
  await recusa("53: horário que não existe não", () => chamar("bia", "rede_p4_or_horario_votar", { p_id: e?.id, p_opcoes: [4] }), "invalido:opcoes");
  const vb = await passa("53: a bia vota em 1 e 2", () => chamar("bia", "rede_p4_or_horario_votar", { p_id: e?.id, p_opcoes: [1, 2, 2] }));
  ok("53: depois de votar, ela vê só que votou (nenhum parcial)", vb?.votei === true && vb.resultado === null);
  await recusa("53: e não vota de novo", () => chamar("bia", "rede_p4_or_horario_votar", { p_id: e?.id, p_opcoes: [3] }), "ja_votou");
  await passa("53: a cris vota em 1", () => chamar("cris", "rede_p4_or_horario_votar", { p_id: e?.id, p_opcoes: [1] }));
  await passa("53: a ana vota em 1 e 3", () => chamar("ana", "rede_p4_or_horario_votar", { p_id: e?.id, p_opcoes: [1, 3] }));
  const somas = (await dono("select opcao, total from interno.rede_p4_or_horario_somas where enquete = $1 order by opcao", [e?.id])).rows;
  ok("53: o banco só tem contadores (1: 3, 2: 1, 3: 1), sem linha por voto", JSON.stringify(somas) === JSON.stringify([{ opcao: 1, total: 3 }, { opcao: 2, total: 1 }, { opcao: 3, total: 1 }]));
  const cols = (await dono("select table_name, column_name from information_schema.columns where table_schema = 'interno' and table_name in ('rede_p4_or_horario_somas', 'rede_p4_or_horario_votantes')")).rows;
  ok("53: nem contador nem votante guardam hora ou escolha junto da pessoa", !cols.some((c) => /criad|quando|em$|dia/.test(c.column_name)) && !cols.some((c) => c.table_name === "rede_p4_or_horario_votantes" && c.column_name === "opcao"));
  await recusa("53: quem só tem função não fecha", () => chamar("bia", "rede_p4_or_horario_fechar", { p_id: e?.id }), "sem_permissao");
  const f = await passa("53: quem gerencia fecha", () => chamar("ana", "rede_p4_or_horario_fechar", { p_id: e?.id }));
  ok(`53: fechada, o resultado: só o 1 passa de 3, o melhor é o 1 (${JSON.stringify(f?.resultado)})`, f?.fechada === true && JSON.stringify(f.resultado?.totais) === "[3,null,null]" && f.resultado.melhor === 1 && f.resultado.votantes === 3);
  ok("53: o resultado não traz pessoa nenhuma", semPessoas(f));
  await recusa("53: fechada, ninguém vota", () => chamar("gil", "rede_p4_or_horario_votar", { p_id: e?.id, p_opcoes: [1] }), "nao_encontrado");
  const lista = await chamar("cris", "rede_p4_or_horarios", { p_org: ORG });
  ok("53: a lista da organização tem a enquete, para quem é de dentro", lista?.enquetes?.length === 1 && lista.posso_criar === false);
}

// ── 54. Reuniões recorrentes ──
{
  const R54 = { org: ORG, titulo: "Reunião da coordenação", frequencia: "semanal", dia_semana: 2, hora: "19:30", duracao_min: 90, local_tipo: "sindicato", local_texto: "Sede do sindicato", inicio: "2030-01-01", lembrete_min: 60 };
  await recusa("54: quem só tem função sem a mesa não marca", () => chamar("bia", "rede_p4_or_reuniao_criar", { p: R54 }), "sem_permissao");
  await recusa("54: frequência inventada não", () => chamar("ana", "rede_p4_or_reuniao_criar", { p: { ...R54, frequencia: "diaria" } }), "invalido:frequencia");
  await recusa("54: mensal sem a semana do mês não", () => chamar("ana", "rede_p4_or_reuniao_criar", { p: { ...R54, frequencia: "mensal" } }), "invalido:semana_do_mes");
  await recusa("54: hora estranha não", () => chamar("ana", "rede_p4_or_reuniao_criar", { p: { ...R54, hora: "25:00" } }), "invalido:hora");
  await recusa("54: lembrete fora da lista não", () => chamar("ana", "rede_p4_or_reuniao_criar", { p: { ...R54, lembrete_min: 7 } }), "invalido:lembrete_min");
  await recusa("54: fim antes do início não", () => chamar("ana", "rede_p4_or_reuniao_criar", { p: { ...R54, fim: "2029-01-01" } }), "invalido:fim");
  const r = await passa("54: quem gerencia marca a reunião semanal", () => chamar("ana", "rede_p4_or_reuniao_criar", { p: R54 }));
  ok("54: a reunião volta como foi marcada", r?.frequencia === "semanal" && r.hora === "19:30" && r.dia_semana === 2 && r.semana_do_mes === null);
  const m = await passa("54: e a mensal (a última sexta)", () => chamar("ana", "rede_p4_or_reuniao_criar", { p: { ...R54, titulo: "Plenária do mês", frequencia: "mensal", dia_semana: 5, semana_do_mes: 5, lembrete_min: 1440 } }));
  await recusa("54: quem é de fora não vê", () => chamar("duda", "rede_p4_or_reunioes", { p_org: ORG }), "nao_encontrado");
  const lista = await passa("54: a cris vê as reuniões", () => chamar("cris", "rede_p4_or_reunioes", { p_org: ORG }));
  ok("54: as duas, sem quem marcou nem presença", lista?.reunioes?.length === 2 && lista.posso_criar === false && semPessoas(lista) && !/presen|criad|quem/.test(JSON.stringify(lista.reunioes)));
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_reunioes'")).rows.map((x) => x.column_name);
  ok("54: a tabela não guarda presença, quem marcou nem lista de avisados", !cols.some((x) => /presen|autor|criad[ao]_por|pessoa|avisad/.test(x)));
  // As datas e o .ics, no aparelho
  ok("54: semanal na terça, a partir de 01/01/2030 (uma terça)", JSON.stringify(R.proximasDatas(r, "2030-01-01", 3)) === JSON.stringify(["2030-01-01", "2030-01-08", "2030-01-15"]));
  ok("54: quinzenal guarda a fase do início", JSON.stringify(R.proximasDatas({ ...r, frequencia: "quinzenal" }, "2030-01-10", 2)) === JSON.stringify(["2030-01-15", "2030-01-29"]));
  ok("54: a última sexta de janeiro e de fevereiro de 2030", JSON.stringify(R.proximasDatas(m, "2030-01-01", 2)) === JSON.stringify(["2030-01-25", "2030-02-22"]));
  ok("54: a segunda segunda-feira do mês", JSON.stringify(R.proximasDatas({ frequencia: "mensal", dia_semana: 1, semana_do_mes: 2, inicio: "2030-01-01", fim: null }, "2030-01-01", 2)) === JSON.stringify(["2030-01-14", "2030-02-11"]));
  ok("54: o fim corta as datas", R.proximasDatas({ ...r, fim: "2030-01-10" }, "2030-01-01", 5).length === 2);
  const ics = R.icsDaReuniao(r, new Date("2029-12-01T00:00:00Z"));
  ok("54: o .ics repete toda terça no fuso de Brasília", ics.includes("RRULE:FREQ=WEEKLY;BYDAY=TU") && ics.includes("DTSTART;TZID=America/Sao_Paulo:20300101T193000") && ics.includes("DTEND;TZID=America/Sao_Paulo:20300101T210000") && ics.includes("TZOFFSETTO:-0300"));
  ok("54: o lembrete vira alarme do calendário (nada do servidor)", ics.includes("TRIGGER:-PT60M") && ics.includes("BEGIN:VALARM"));
  ok("54: o mensal da última sexta vira BYDAY=-1FR", R.icsDaReuniao(m).includes("RRULE:FREQ=MONTHLY;BYDAY=-1FR") && R.icsDaReuniao(m).includes("TRIGGER:-PT1440M"));
  ok("54: o .ics não leva pessoa nenhuma", !/ORGANIZER|ATTENDEE|mailto/i.test(ics));
  ok("54: vírgula, ponto e vírgula e quebra de linha vão escapados no .ics", R.icsDaReuniao({ ...r, titulo: "A, B; C\nD" }).includes("SUMMARY:A\\, B\\; C\\nD"));
  await recusa("54: quem só tem função não tira", () => chamar("bia", "rede_p4_or_reuniao_apagar", { p_id: r?.id }), "sem_permissao");
  await passa("54: quem gerencia tira", () => chamar("ana", "rede_p4_or_reuniao_apagar", { p_id: m?.id }));
}

// ── 55. Mural "ofereço / preciso" ──
{
  await recusa("55: quem não é da comunidade não põe", () => chamar("gil", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "preciso", titulo: "Ajuda na mudança" } }), "nao_encontrado");
  await recusa("55: tipo inventado não", () => chamar("duda", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "vendo", titulo: "Ajuda na mudança" } }), "invalido:tipo");
  await recusa("55: endereço com número não entra", () => chamar("duda", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "preciso", titulo: "Ajuda na mudança", texto: "moro na Rua das Flores, 123" } }), "dado_pessoal");
  await recusa("55: telefone não entra", () => chamar("duda", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "preciso", titulo: "Ajuda na mudança", texto: "chama no 11 91234-5678" } }), "dado_pessoal");
  const m = await passa("55: a duda pede ajuda na mudança", () => chamar("duda", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "preciso", categoria: "mudanca", titulo: "Ajuda na mudança no sábado", texto: "Preciso de duas pessoas e um carrinho." } }));
  ok("55: o pedido sai sob o codinome e o @ de quem pôs, para combinar por mensagem", m?.autor?.codinome === "Pessoa 4" && m.autor.handle === "pessoa_duda" && m.meu === true && m.categoria === "mudanca");
  ok("55: some sozinho em 30 dias", m && Math.round((new Date(m.expira_em) - new Date(m.criado_em)) / 864e5) === 30);
  await passa("55: a bia oferece aula", () => chamar("bia", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "ofereco", categoria: "aula", titulo: "Aula de matemática para o ENEM" } }));
  const deFora = await passa("55: na comunidade aberta, o gil (membro da Alumia) vê o mural", () => chamar("gil", "rede_p4_or_mural", { p_slug: "luta-moradia" }));
  ok("55: vê os dois pedidos, mas não pode pôr", deFora?.itens?.length === 2 && deFora.posso_por === false && deFora.modero === false);
  ok("55: a resposta não traz id de pessoa nem quem respondeu", semPessoas(deFora) && !/respond|interess|contat/.test(JSON.stringify(deFora)));
  const soPreciso = await chamar("gil", "rede_p4_or_mural", { p_slug: "luta-moradia", p_tipo: "preciso" });
  ok("55: o filtro por tipo funciona", soPreciso?.itens?.length === 1 && soPreciso.itens[0].tipo === "preciso");
  await recusa("55: a comunidade fechada não mostra o mural a quem é de fora", () => chamar("gil", "rede_p4_or_mural", { p_slug: "roda-fechada" }), "nao_encontrado");
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.gil, P.duda]);
  const bloqueado = await chamar("gil", "rede_p4_or_mural", { p_slug: "luta-moradia" });
  ok("55: quem bloqueou não vê o pedido de quem foi bloqueada", bloqueado?.itens?.length === 1 && bloqueado.itens[0].tipo === "ofereco");
  await dono("delete from interno.rede_bloqueios where quem = $1", [P.gil]);
  await recusa("55: outra pessoa não tira o pedido", () => chamar("cris", "rede_p4_or_mural_tirar", { p_id: m?.id }), "sem_permissao");
  await passa("55: a mediação tira", () => chamar("ana", "rede_p4_or_mural_tirar", { p_id: m?.id }));
  for (let i = 0; i < 5; i++) await chamar("cris", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "ofereco", categoria: "doacao", titulo: `Doação de roupas ${i + 1}` } });
  await recusa("55: até 5 pedidos valendo por pessoa", () => chamar("cris", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "ofereco", titulo: "Doação de roupas 6" } }), "limite");
  await dono("update interno.rede_p4_or_mural set expira_em = now() - interval '1 minute' where autor = $1", [P.cris]);
  const depois = await chamar("gil", "rede_p4_or_mural", { p_slug: "luta-moradia" });
  ok("55: vencido, o pedido some do mural", depois?.itens?.length === 1);
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_mural'")).rows.map((x) => x.column_name);
  ok("55: o mural não guarda endereço, telefone nem quem se interessou", !cols.some((x) => /endereco|telefone|lat|lon|interess|respost/.test(x)));
}

// ── 63. Vagas e bicos solidários ──
{
  await recusa("63: link que não é https não", () => chamar("bia", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "vaga", titulo: "Vaga na cooperativa de costura", link: "http://coop.exemplo.org" } }), "invalido:link");
  await recusa("63: e-mail de contato não entra (combina por mensagem)", () => chamar("bia", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "bico", titulo: "Bico de pintura", texto: "mande para bia@exemplo.org" } }), "dado_pessoal");
  const v = await passa("63: a bia põe uma vaga com link", () => chamar("bia", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "vaga", categoria: "aula", titulo: "Vaga na cooperativa de costura", texto: "Meio período, com formação.", link: "https://coop.exemplo.org/vagas" } }));
  ok("63: a vaga não tem categoria de ajuda e leva o link", v?.tipo === "vaga" && v.categoria === "outro" && v.link === "https://coop.exemplo.org/vagas");
  const o = await passa("63: o link só vale para vaga e bico", () => chamar("bia", "rede_p4_or_mural_por", { p: { comunidade: "luta-moradia", tipo: "ofereco", titulo: "Empresto uma furadeira", link: "https://exemplo.org" } }));
  ok("63: no ofereço, o link é ignorado", o?.link === null);
  const so = await chamar("gil", "rede_p4_or_mural", { p_slug: "luta-moradia", p_tipo: "vaga" });
  ok("63: o filtro das vagas mostra só a vaga", so?.itens?.length === 1 && so.itens[0].titulo === "Vaga na cooperativa de costura");
  ok("63: sem perfil profissional de ninguém (só a vaga e quem pôs)", Object.keys(so?.itens?.[0]?.autor ?? {}).sort().join() === "codinome,handle" && !/curriculo|formacao_de|experiencia|profiss/.test(JSON.stringify(so)));
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_mural'")).rows.map((x) => x.column_name);
  ok("63: a tabela não ganha campo de perfil profissional", !cols.some((x) => /curriculo|formacao|experiencia|profiss|salario/.test(x)));
}

// ── 56. Banco de tempo ──
{
  const S = "luta-moradia";
  await recusa("56: quem não é da comunidade não abre o banco de tempo", () => chamar("gil", "rede_p4_or_banco_de_tempo", { p_slug: S }), "nao_encontrado");
  await recusa("56: registrar com quem não é da comunidade não", () => chamar("duda", "rede_p4_or_hora_registrar", { p: { comunidade: S, de: "pessoa_gil", minutos: 60, servico: "Conserto da bicicleta" } }), "invalido:de");
  await recusa("56: consigo mesma não", () => chamar("duda", "rede_p4_or_hora_registrar", { p: { comunidade: S, de: "pessoa_duda", minutos: 60, servico: "Conserto da bicicleta" } }), "invalido:de");
  await recusa("56: minutos quebrados não", () => chamar("duda", "rede_p4_or_hora_registrar", { p: { comunidade: S, de: "pessoa_bia", minutos: 45, servico: "Conserto da bicicleta" } }), "invalido:minutos");
  const h = await passa("56: a duda registra 2 h que a bia deu", () => chamar("duda", "rede_p4_or_hora_registrar", { p: { comunidade: S, de: "@pessoa_bia", minutos: 120, servico: "Aula de matemática" } }));
  ok("56: a troca fica pendente; para a duda, 'recebi', e a outra pessoa é a bia", h?.estado === "pendente" && h.papel === "recebi" && h.outra?.handle === "pessoa_bia" && h.pode_responder === false);
  const antes = await chamar("duda", "rede_p4_or_banco_de_tempo", { p_slug: S });
  ok("56: pendente não conta no saldo", antes?.saldo_min === 0 && antes.trocas.length === 1);
  await recusa("56: quem recebeu não confirma a própria troca", () => chamar("duda", "rede_p4_or_hora_responder", { p_id: h?.id, p_sim: true }), "sem_permissao");
  await recusa("56: uma terceira pessoa nem acha a troca", () => chamar("cris", "rede_p4_or_hora_responder", { p_id: h?.id, p_sim: true }), "nao_encontrado");
  const c = await passa("56: a bia confirma", () => chamar("bia", "rede_p4_or_hora_responder", { p_id: h?.id, p_sim: true }));
  ok("56: confirmada", c?.estado === "confirmada" && c.papel === "dei");
  const daBia = await chamar("bia", "rede_p4_or_banco_de_tempo", { p_slug: S });
  const daDuda = await chamar("duda", "rede_p4_or_banco_de_tempo", { p_slug: S });
  ok(`56: a bia tem +120 e a duda −120 (${daBia?.saldo_min}, ${daDuda?.saldo_min})`, daBia?.saldo_min === 120 && daDuda?.saldo_min === -120);
  const daCris = await chamar("cris", "rede_p4_or_banco_de_tempo", { p_slug: S });
  ok("56: a cris não vê a troca das outras nem saldo de ninguém além do dela", daCris?.saldo_min === 0 && daCris.trocas.length === 0 && semPessoas(daCris));
  const publicas = (await dono(`select p.proname, pg_get_function_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and (p.proname ~ '^rede_p4_or_hora_' or p.proname = 'rede_p4_or_banco_de_tempo')`)).rows;
  ok(`56: nenhuma função recebe outra pessoa para devolver saldo ou trocas (${publicas.length})`, publicas.length === 4 && publicas.every((x) => !/handle|pessoa|quem/.test(x.a)));
  ok("56: a troca não traz id de pessoa", semPessoas(daBia));
  const r = await chamar("duda", "rede_p4_or_hora_registrar", { p: { comunidade: S, de: "pessoa_cris", minutos: 30, servico: "Cuidou das crianças" } });
  await passa("56: a cris recusa", () => chamar("cris", "rede_p4_or_hora_responder", { p_id: r?.id, p_sim: false }));
  ok("56: recusada não conta", (await chamar("duda", "rede_p4_or_banco_de_tempo", { p_slug: S }))?.saldo_min === -120);
  const velha = await chamar("duda", "rede_p4_or_hora_registrar", { p: { comunidade: S, de: "pessoa_cris", minutos: 60, servico: "Faxina na ocupação" } });
  await dono("update interno.rede_p4_or_horas set dia = current_date - 20 where id = $1", [velha?.id]);
  await recusa("56: pendente de mais de 14 dias não se confirma mais", () => chamar("cris", "rede_p4_or_hora_responder", { p_id: velha?.id, p_sim: true }), "sem_permissao");
  ok("56: e some da lista", !(await chamar("cris", "rede_p4_or_banco_de_tempo", { p_slug: S }))?.trocas.some((x) => x.id === velha?.id));
  await passa("56: quem participou apaga", () => chamar("bia", "rede_p4_or_hora_apagar", { p_id: h?.id }));
  ok("56: e sai do saldo", (await chamar("duda", "rede_p4_or_banco_de_tempo", { p_slug: S }))?.saldo_min === 0);
  const cols = (await dono("select column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_horas'")).rows;
  ok("56: só a data da troca, sem hora nem dinheiro", !cols.some((x) => /timestamp/.test(x.data_type) || /valor|centavo|reais|preco/.test(x.column_name)));
}

ok("56: o aparelho mostra o saldo em horas e minutos", JSON.stringify(R.duracao(150)) === JSON.stringify({ h: 2, min: 30 }) && JSON.stringify(R.duracao(-60)) === JSON.stringify({ h: 1, min: 0 }));

// ── 57. Inventário solidário ──
{
  await recusa("57: quem é de fora nem sabe que o inventário existe", () => chamar("duda", "rede_p4_or_inventario", { p_org: ORG }), "nao_encontrado");
  await recusa("57: quem só tem função não põe coisa", () => chamar("bia", "rede_p4_or_coisa_criar", { p: { org: ORG, nome: "Megafone" } }), "sem_permissao");
  await recusa("57: quantidade estranha não", () => chamar("ana", "rede_p4_or_coisa_criar", { p: { org: ORG, nome: "Megafone", quantidade: 500 } }), "invalido:quantidade");
  const m = await passa("57: quem gerencia põe 2 megafones", () => chamar("ana", "rede_p4_or_coisa_criar", { p: { org: ORG, nome: "Megafone", notas: "Pilhas na caixa azul", quantidade: 2 } }));
  ok("57: 2 disponíveis", m?.quantidade === 2 && m.disponiveis === 2 && m.emprestadas === 0);
  const p1 = await passa("57: a bia pega um", () => chamar("bia", "rede_p4_or_coisa_emprestar", { p_id: m?.id, p_pegar: true }));
  await passa("57: a cris pega outro", () => chamar("cris", "rede_p4_or_coisa_emprestar", { p_id: m?.id, p_pegar: true }));
  ok("57: depois de um, 1 disponível", p1?.disponiveis === 1);
  await recusa("57: acabou, ninguém pega mais", () => chamar("ana", "rede_p4_or_coisa_emprestar", { p_id: m?.id, p_pegar: true }), "esgotado");
  const inv = await chamar("ana", "rede_p4_or_inventario", { p_org: ORG });
  ok("57: o inventário mostra 0 disponíveis e nunca com quem está", inv?.coisas?.[0]?.disponiveis === 0 && semPessoas(inv) && !/quem|pessoa|com_quem|saiu/.test(JSON.stringify(inv)));
  await passa("57: qualquer pessoa de dentro marca a devolução", () => chamar("ana", "rede_p4_or_coisa_emprestar", { p_id: m?.id, p_pegar: false }));
  await chamar("bia", "rede_p4_or_coisa_emprestar", { p_id: m?.id, p_pegar: false });
  await recusa("57: não devolve o que não saiu", () => chamar("bia", "rede_p4_or_coisa_emprestar", { p_id: m?.id, p_pegar: false }), "invalido:devolver");
  await recusa("57: quem é de fora não pega", () => chamar("duda", "rede_p4_or_coisa_emprestar", { p_id: m?.id, p_pegar: true }), "nao_encontrado");
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_coisas'")).rows.map((x) => x.column_name);
  ok("57: a tabela lista coisas, não pessoas (sem com quem, sem quando)", !cols.some((x) => /pessoa|quem|com_|_em$|dia|usuario/.test(x)));
  await recusa("57: quem só tem função não tira coisa", () => chamar("bia", "rede_p4_or_coisa_apagar", { p_id: m?.id }), "sem_permissao");
  await passa("57: quem gerencia tira", () => chamar("ana", "rede_p4_or_coisa_apagar", { p_id: m?.id }));
}

// ── 58. Pontos de apoio ──
{
  const S = "luta-moradia";
  const P58 = { comunidade: S, tipo: "biblioteca", nome: "Biblioteca Mário de Andrade", endereco: "Rua da Consolação, 94", cidade: "São Paulo", horario: "Seg a sex, 8h às 20h", publico: true };
  await recusa("58: sem declarar que é lugar público não entra", () => chamar("duda", "rede_p4_or_ponto_propor", { p: { ...P58, publico: false } }), "invalido:publico");
  await recusa("58: quem não é da comunidade não propõe", () => chamar("gil", "rede_p4_or_ponto_propor", { p: P58 }), "nao_encontrado");
  await recusa("58: telefone no horário não", () => chamar("duda", "rede_p4_or_ponto_propor", { p: { ...P58, horario: "ligue (11) 3256-5270" } }), "dado_pessoal");
  await recusa("58: e-mail no nome não", () => chamar("duda", "rede_p4_or_ponto_propor", { p: { ...P58, nome: "fale@biblioteca.org" } }), "dado_pessoal");
  await recusa("58: tipo inventado não", () => chamar("duda", "rede_p4_or_ponto_propor", { p: { ...P58, tipo: "casa" } }), "invalido:tipo");
  const x = await passa("58: a duda propõe a biblioteca (o endereço do lugar público pode ter número)", () => chamar("duda", "rede_p4_or_ponto_propor", { p: P58 }));
  ok("58: fica esperando a mediação", x?.aprovado === false && x.endereco === "Rua da Consolação, 94");
  const antes = await chamar("gil", "rede_p4_or_pontos", { p_slug: S });
  ok("58: antes da aprovação, ninguém vê (nem a lista de pendentes, para quem não modera)", antes?.pontos?.length === 0 && antes.pendentes === null && antes.modero === false);
  const med = await chamar("ana", "rede_p4_or_pontos", { p_slug: S });
  ok("58: a mediação vê o pendente", med?.pendentes?.length === 1 && med.modero === true);
  await recusa("58: quem não modera não aprova", () => chamar("bia", "rede_p4_or_ponto_decidir", { p_id: x?.id, p_aprovar: true }), "sem_permissao");
  await passa("58: a mediação aprova", () => chamar("ana", "rede_p4_or_ponto_decidir", { p_id: x?.id, p_aprovar: true }));
  const depois = await chamar("gil", "rede_p4_or_pontos", { p_slug: S });
  ok("58: aprovado, aparece para quem vê a comunidade", depois?.pontos?.length === 1 && depois.pontos[0].nome === "Biblioteca Mário de Andrade");
  ok("58: o ponto não diz quem propôs", semPessoas(depois) && !/propos|autor|quem/.test(JSON.stringify(depois)));
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_pontos'")).rows.map((c) => c.column_name);
  ok("58: a tabela não guarda quem propôs nem posição de aparelho", !cols.some((c) => /autor|pessoa|propos|quem|lat|lon/.test(c)));
  const y = await chamar("bia", "rede_p4_or_ponto_propor", { p: { ...P58, nome: "Casa de alguém" } });
  await passa("58: a mediação recusa (some)", () => chamar("ana", "rede_p4_or_ponto_decidir", { p_id: y?.id, p_aprovar: false }));
  ok("58: recusado não fica nem como pendente", (await chamar("ana", "rede_p4_or_pontos", { p_slug: S }))?.pendentes?.length === 0);
  ok("58: o como chegar é o mesmo link do ato (OpenStreetMap, só o endereço)", R.comoChegar(depois?.pontos?.[0] ?? P58) === "https://www.openstreetmap.org/search?query=Rua%20da%20Consola%C3%A7%C3%A3o%2C%2094%2C%20S%C3%A3o%20Paulo");
}

// ── 59. Rota do ato sem internet ──
{
  const ROTA = { pontos: [[-23.5505, -46.6333], [-23.5489, -46.6388], [-23.5475, -46.6361]], apoios: [{ lat: -23.5498, lon: -46.6350, tipo: "agua", nome: "Água na escadaria" }] };
  await recusa("59: quem tem só função (não chama o ato) não desenha", () => chamar("bia", "rede_p4_or_rota_salvar", { p_ato: ATO, p: ROTA }), "sem_permissao");
  await recusa("59: um ponto só não é rota", () => chamar("ana", "rede_p4_or_rota_salvar", { p_ato: ATO, p: { pontos: [[-23.55, -46.63]] } }), "invalido:pontos");
  await recusa("59: coordenada fora do mundo não", () => chamar("ana", "rede_p4_or_rota_salvar", { p_ato: ATO, p: { pontos: [[-23.55, -46.63], [123, 10]] } }), "invalido:pontos");
  await recusa("59: telefone no nome do apoio não", () => chamar("ana", "rede_p4_or_rota_salvar", { p_ato: ATO, p: { ...ROTA, apoios: [{ lat: -23.55, lon: -46.63, tipo: "agua", nome: "liga 11 98888-7777" }] } }), "dado_pessoal");
  const r = await passa("59: quem chama o ato (pela organização) salva a rota", () => chamar("ana", "rede_p4_or_rota_salvar", { p_ato: ATO, p: { ...ROTA, pontos: [[-23.550512345, -46.6333], ...ROTA.pontos.slice(1)] } }));
  ok("59: a rota volta arredondada a 5 casas e com o apoio", r?.rota?.pontos?.[0]?.[0] === -23.55051 && r.rota.apoios[0].nome === "Água na escadaria" && r.posso_desenhar === true);
  const vista = await passa("59: quem vê o ato (a duda, de fora da organização) baixa a rota", () => chamar("duda", "rede_p4_or_rota", { p_ato: ATO }));
  ok("59: vem o ato e a rota, sem pessoa nenhuma", vista?.rota?.pontos?.length === 3 && vista.ato?.titulo === "Ato pela moradia" && vista.posso_desenhar === false && semPessoas(vista));
  await recusa("59: ato que não existe não", () => chamar("duda", "rede_p4_or_rota", { p_ato: "00000000-0000-4000-8000-000000000009" }), "nao_encontrado");
  const listaAna = await chamar("ana", "rede_p4_or_rota_atos", {});
  ok("59: na lista da ana, o ato que ela chama, com rota", listaAna?.some?.((x) => x.id === ATO && x.chamo && x.tem_rota));
  ok("59: a duda, sem 'vou', não tem ato na lista", (await chamar("duda", "rede_p4_or_rota_atos", {}))?.length === 0);
  await dono("insert into interno.rede_vou (post, usuario) values ($1, $2) on conflict do nothing", [ATO, P.duda]);
  const listaDuda = await chamar("duda", "rede_p4_or_rota_atos", {});
  ok("59: com 'vou', o ato com rota aparece só para ela, sem quem mais vai", listaDuda?.length === 1 && listaDuda[0].chamo === false && !/vou|pessoas|total/.test(JSON.stringify(listaDuda)));
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_rotas'")).rows.map((c) => c.column_name);
  ok("59: a rota não guarda quem desenhou nem quem baixou", !cols.some((c) => /autor|pessoa|quem|baix/.test(c)));
  // No aparelho
  const gpx = `<?xml version="1.0"?><gpx><wpt lat="-23.5498" lon="-46.6350"><name>Ponto de &amp; água</name></wpt>
    <trk><trkseg><trkpt lon="-46.6333" lat="-23.5505"></trkpt><trkpt lat="-23.5489" lon="-46.6388"/><trkpt lat="abc" lon="1"/></trkseg></trk></gpx>`;
  const lida = R.gpxParaRota(gpx);
  ok("59: o GPX vira rota no aparelho (atributos em qualquer ordem; ponto inválido fica de fora)", JSON.stringify(lida.pontos) === JSON.stringify([[-23.5505, -46.6333], [-23.5489, -46.6388]]) && lida.apoios[0]?.nome === "Ponto de & água");
  ok("59: e se reduz a 300 pontos, guardando o começo e o fim", (() => { const muitos = Array.from({ length: 1000 }, (_, i) => [i, i]); const r3 = R.reduzirPontos(muitos, 300); return r3.length === 300 && r3[0][0] === 0 && r3[299][0] === 999; })());
  ok("59: 'lat, lon' por linha também", JSON.stringify(R.linhasParaPontos("-23.55, -46.63\nlixo\n-23.54;-46.64")) === JSON.stringify([[-23.55, -46.63], [-23.54, -46.64]]));
  ok(`59: a distância sai em km (${R.distanciaKm(ROTA.pontos)})`, R.distanciaKm([[0, 0], [0, 1]]) === 111.2 && R.distanciaKm(ROTA.pontos) > 0.5 && R.distanciaKm(ROTA.pontos) < 1);
  const d = R.desenhoDaRota(ROTA);
  ok("59: o desenho cabe na caixa e numera os apoios", d && d.linha.split(" ").length === 3 && d.linha.split(" ").every((p) => p.split(",").every((n) => Number(n) >= 0 && Number(n) <= 320)) && d.apoios[0].n === 1);
  const guarda = new Map();
  const armazem = { getItem: (k) => guarda.get(k) ?? null, setItem: (k, v) => guarda.set(k, v) };
  const ato = { id: ATO, titulo: "Ato", inicio: new Date(Date.now() + 864e5).toISOString(), cidade: "São Paulo", ponto: "Praça da Sé" };
  R.guardarRota(armazem, { ato, rota: ROTA });
  R.guardarRota(armazem, { ato: { ...ato, id: "velho", inicio: "2020-01-01T00:00:00Z" }, rota: ROTA });
  ok("59: a rota fica no aparelho (chave que o Sair rápido apaga) e a de ato passado some", R.CHAVE_DAS_ROTAS.startsWith("lucia:rede") && R.lerRotasGuardadas(armazem).length === 1 && R.lerRotasGuardadas(armazem)[0].ato.id === ATO);
  ok("59: esquecer tira do aparelho", R.esquecerRota(armazem, ATO).length === 0);
  ok("59: lixo no aparelho não quebra", R.lerRotasGuardadas({ getItem: () => "{nao e json" }).length === 0);
  await passa("59: quem chama apaga a rota", () => chamar("ana", "rede_p4_or_rota_apagar", { p_ato: ATO }));
}

// ── 60. Consenso por posições ──
{
  await dono("insert into interno.rede_org_mandatos (funcao, pessoa, fim, aceito) values ($1, $2, current_date + 90, true)", [FUNCAO_COM, P.fabi]);
  const fecha = new Date(Date.now() + 3 * 864e5).toISOString();
  await recusa("60: quem só tem função não põe proposta", () => chamar("bia", "rede_p4_or_consenso_criar", { p: { org: ORG, proposta: "Fazer a festa junina na praça", fecha_em: fecha } }), "sem_permissao");
  await recusa("60: fechar em 10 minutos não", () => chamar("ana", "rede_p4_or_consenso_criar", { p: { org: ORG, proposta: "Fazer a festa junina na praça", fecha_em: new Date(Date.now() + 6e5).toISOString() } }), "invalido:fecha_em");
  const c1 = await passa("60: quem gerencia põe a proposta", () => chamar("ana", "rede_p4_or_consenso_criar", { p: { org: ORG, proposta: "Fazer a festa junina na praça", fecha_em: fecha } }));
  ok("60: aberto, sem parcial", c1?.fechado === false && c1.resultado === null && c1.votei === false);
  await recusa("60: posição inventada não", () => chamar("bia", "rede_p4_or_consenso_posicao", { p_id: c1?.id, p_posicao: "talvez" }), "invalido:posicao");
  await recusa("60: quem é de fora não se posiciona", () => chamar("duda", "rede_p4_or_consenso_posicao", { p_id: c1?.id, p_posicao: "concordo" }), "nao_encontrado");
  const vb = await passa("60: a bia concorda", () => chamar("bia", "rede_p4_or_consenso_posicao", { p_id: c1?.id, p_posicao: "concordo" }));
  ok("60: depois de votar, ela vê só que votou", vb?.votei === true && vb.resultado === null);
  await recusa("60: e não vota de novo", () => chamar("bia", "rede_p4_or_consenso_posicao", { p_id: c1?.id, p_posicao: "bloqueio" }), "ja_votou");
  await chamar("ana", "rede_p4_or_consenso_posicao", { p_id: c1?.id, p_posicao: "concordo" });
  await chamar("cris", "rede_p4_or_consenso_posicao", { p_id: c1?.id, p_posicao: "bloqueio" });
  const f1 = await passa("60: quem gerencia fecha", () => chamar("ana", "rede_p4_or_consenso_fechar", { p_id: c1?.id }));
  ok(`60: 3 posições: houve bloqueio, sem consenso, e nenhum total abaixo de 3 aparece (${JSON.stringify(f1?.resultado)})`,
    f1?.resultado?.votantes === 3 && f1.resultado.houve_bloqueio === true && f1.resultado.consenso === false && Object.values(f1.resultado.totais).every((x) => x === null));
  ok("60: nunca quem bloqueou", semPessoas(f1) && !/quem|pessoa|handle|codinome/.test(JSON.stringify(f1?.resultado)));
  const somas = (await dono("select posicao, total from interno.rede_p4_or_consenso_somas where consenso = $1 order by posicao", [c1?.id])).rows;
  ok("60: o banco só tem contadores por posição", JSON.stringify(somas) === JSON.stringify([{ posicao: "bloqueio", total: 1 }, { posicao: "concordo", total: 2 }]));
  const cols = (await dono("select table_name, column_name from information_schema.columns where table_schema = 'interno' and table_name in ('rede_p4_or_consenso_votantes', 'rede_p4_or_consenso_somas')")).rows;
  ok("60: quem votou e o que votou ficam separados, sem hora", !cols.some((c) => /criad|quando|em$|dia/.test(c.column_name)) && !cols.some((c) => c.table_name === "rede_p4_or_consenso_votantes" && c.column_name === "posicao"));
  const c2 = await chamar("ana", "rede_p4_or_consenso_criar", { p: { org: ORG, proposta: "Comprar um megafone novo", fecha_em: fecha } });
  for (const [quem, pos] of [["ana", "concordo"], ["bia", "concordo"], ["cris", "concordo"], ["fabi", "ressalva"]]) await chamar(quem, "rede_p4_or_consenso_posicao", { p_id: c2?.id, p_posicao: pos });
  const f2 = await chamar("ana", "rede_p4_or_consenso_fechar", { p_id: c2?.id });
  ok(`60: 4 posições sem bloqueio: consenso, concordo 3 e a ressalva sozinha escondida (${JSON.stringify(f2?.resultado)})`,
    f2?.resultado?.consenso === true && f2.resultado.houve_bloqueio === false && f2.resultado.totais.concordo === 3 && f2.resultado.totais.ressalva === null && f2.resultado.votantes === 4);
  const c3 = await chamar("ana", "rede_p4_or_consenso_criar", { p: { org: ORG, proposta: "Mudar a sede de lugar", fecha_em: fecha } });
  await chamar("ana", "rede_p4_or_consenso_posicao", { p_id: c3?.id, p_posicao: "bloqueio" });
  await chamar("bia", "rede_p4_or_consenso_posicao", { p_id: c3?.id, p_posicao: "concordo" });
  const f3 = await chamar("ana", "rede_p4_or_consenso_fechar", { p_id: c3?.id });
  ok("60: com menos de 3, nem o bloqueio nem o veredito aparecem", f3?.resultado?.votantes === null && f3.resultado.houve_bloqueio === null && f3.resultado.consenso === null);
  await recusa("60: fechado, ninguém vota", () => chamar("cris", "rede_p4_or_consenso_posicao", { p_id: c3?.id, p_posicao: "concordo" }), "fechada");
  const lista = await chamar("cris", "rede_p4_or_consensos", { p_org: ORG });
  ok("60: a lista da organização para quem é de dentro", lista?.consensos?.length === 3 && lista.posso_criar === false && semPessoas(lista));
}

// ── 61. Orçamento participativo ──
{
  const CAIXA = (await dono("insert into interno.rede_org_caixas (org, nome, tipo) values ($1, 'Caixa geral', 'geral') returning id", [P.org])).rows[0].id;
  const CAIXA_ALHEIA_ORG = await criarUsuario("org2@p4-organizacao.local", "org2");
  await rpc({ papel: "authenticated", sub: CAIXA_ALHEIA_ORG, ip: "198.51.100.20" }, "eu");
  await dono("insert into interno.rede_orgs (perfil, tipo, cidade) values ($1, 'coletivo', 'Recife') on conflict do nothing", [CAIXA_ALHEIA_ORG]);
  const CAIXA_ALHEIA = (await dono("insert into interno.rede_org_caixas (org, nome, tipo) values ($1, 'Caixa de outra', 'geral') returning id", [CAIXA_ALHEIA_ORG])).rows[0].id;
  const em = (h) => new Date(Date.now() + h * 36e5).toISOString();
  const O = { org: ORG, titulo: "Orçamento do segundo semestre", caixa: CAIXA, centavos: 500000, propostas_ate: em(48), apoio_ate: em(96) };
  await recusa("61: quem só tem função não abre orçamento", () => chamar("bia", "rede_p4_or_orcamento_criar", { p: O }), "sem_permissao");
  await recusa("61: caixa de outra organização não", () => chamar("ana", "rede_p4_or_orcamento_criar", { p: { ...O, caixa: CAIXA_ALHEIA } }), "invalido:caixa");
  await recusa("61: apoio antes das propostas não", () => chamar("ana", "rede_p4_or_orcamento_criar", { p: { ...O, apoio_ate: em(24) } }), "invalido:prazo");
  const o = await passa("61: quem gerencia abre o orçamento", () => chamar("ana", "rede_p4_or_orcamento_criar", { p: O }));
  ok("61: começa na fase das propostas, com a caixa", o?.fase === "propostas" && o.caixa?.nome === "Caixa geral" && o.centavos === 500000);
  await recusa("61: proposta acima do valor não", () => chamar("bia", "rede_p4_or_orcamento_propor", { p_id: o?.id, p: { titulo: "Som novo", centavos: 900000 } }), "invalido:centavos");
  await recusa("61: quem é de fora não propõe", () => chamar("duda", "rede_p4_or_orcamento_propor", { p_id: o?.id, p: { titulo: "Som novo", centavos: 90000 } }), "nao_encontrado");
  for (const [quem, titulo, c] of [["bia", "Caixa de som", 150000], ["cris", "Tinta para faixas", 30000], ["ana", "Lanche das plenárias", 60000]]) {
    await passa(`61: ${quem} propõe ${titulo}`, () => chamar(quem, "rede_p4_or_orcamento_propor", { p_id: o?.id, p: { titulo, descricao: "", centavos: c } }));
  }
  await recusa("61: na fase das propostas ainda não se apoia", () => chamar("bia", "rede_p4_or_orcamento_apoiar", { p_id: o?.id, p_propostas: [] }), "fora_da_fase");
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_orc_propostas'")).rows.map((c) => c.column_name);
  ok("61: a proposta não guarda quem propôs", !cols.some((c) => /autor|pessoa|quem|propos/.test(c)));
  await dono("update interno.rede_p4_or_orcamentos set propostas_ate = now() - interval '1 minute' where id = $1", [o?.id]);
  const vo = await chamar("bia", "rede_p4_or_orcamentos", { p_org: ORG });
  const props = vo?.orcamentos?.[0]?.propostas ?? [];
  ok("61: na fase do apoio, nenhum total aparece", vo?.orcamentos?.[0]?.fase === "apoio" && props.length === 3 && props.every((x) => x.apoios === null) && vo.orcamentos[0].apoiadores === null);
  await recusa("61: na fase do apoio não se propõe mais", () => chamar("bia", "rede_p4_or_orcamento_propor", { p_id: o?.id, p: { titulo: "Outra", centavos: 100 } }), "fora_da_fase");
  const id = (t) => props.find((x) => x.titulo === t)?.id;
  await recusa("61: mais de 3 propostas não", () => chamar("bia", "rede_p4_or_orcamento_apoiar", { p_id: o?.id, p_propostas: [id("Caixa de som"), id("Tinta para faixas"), id("Lanche das plenárias"), id("Caixa de som")] }), "invalido:propostas");
  for (const quem of ["ana", "bia", "cris"]) await passa(`61: ${quem} apoia a caixa de som`, () => chamar(quem, "rede_p4_or_orcamento_apoiar", { p_id: o?.id, p_propostas: [id("Caixa de som"), ...(quem === "cris" ? [id("Tinta para faixas")] : [])] }));
  await recusa("61: e não apoia de novo", () => chamar("bia", "rede_p4_or_orcamento_apoiar", { p_id: o?.id, p_propostas: [id("Lanche das plenárias")] }), "ja_votou");
  const apoios = (await dono("select count(*)::int n from interno.rede_p4_or_orc_apoios a join interno.rede_p4_or_orc_propostas x on x.id = a.proposta where x.orcamento = $1", [o?.id])).rows[0].n;
  const apCols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name in ('rede_p4_or_orc_apoios', 'rede_p4_or_orc_apoiadores')")).rows.map((c) => c.column_name);
  ok("61: os apoios são contadores por proposta (sem linha por apoio, sem hora)", apoios === 2 && !apCols.some((c) => /criad|quando|em$|dia/.test(c)) && !apCols.includes("orcamento_proposta"));
  await dono("update interno.rede_p4_or_orcamentos set apoio_ate = now() - interval '1 second' where id = $1", [o?.id]);
  const fim = (await chamar("cris", "rede_p4_or_orcamentos", { p_org: ORG }))?.orcamentos?.[0];
  ok(`61: na votação, só o total a partir de 3 aparece (${JSON.stringify(fim?.propostas?.map((x) => [x.titulo, x.apoios]))})`,
    fim?.fase === "votacao" && fim.propostas.find((x) => x.titulo === "Caixa de som")?.apoios === 3 && fim.propostas.find((x) => x.titulo === "Tinta para faixas")?.apoios === null && fim.apoiadores === 3);
  ok("61: nada de quem apoiou ou propôs", semPessoas(fim));
  const CONSULTA = (await dono(`insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Qual proposta do orçamento?', 'simples', now() + interval '7 days', 'A coordenação segue o resultado da consulta.') returning id`, [P.org])).rows[0].id;
  const CONSULTA_ALHEIA = (await dono(`insert into interno.rede_consultas (org, pergunta, metodo, prazo, compromisso) values ($1, 'Pergunta de outra organização', 'simples', now() + interval '7 days', 'Compromisso de outra organização.') returning id`, [CAIXA_ALHEIA_ORG])).rows[0].id;
  await recusa("61: quem só tem função não liga a consulta", () => chamar("bia", "rede_p4_or_orcamento_consulta", { p_id: o?.id, p_consulta: CONSULTA }), "sem_permissao");
  await recusa("61: consulta de outra organização não", () => chamar("ana", "rede_p4_or_orcamento_consulta", { p_id: o?.id, p_consulta: CONSULTA_ALHEIA }), "invalido:consulta");
  const lig = await passa("61: quem gerencia liga a consulta", () => chamar("ana", "rede_p4_or_orcamento_consulta", { p_id: o?.id, p_consulta: CONSULTA }));
  ok("61: o orçamento aponta para a consulta (o voto é o dela)", lig?.consulta?.id === CONSULTA);
  ok("61: este grupo não toca nas tabelas nem nas funções do voto", !/rede_consulta_(votantes|cedulas|votos)|rede_org_consulta_votar/.test(semComentario.replace(/rede_consultas/g, "")));
}
ok("61: o valor escrito vira centavos no aparelho", R.centavosDoTexto("1.500,00") === 150000 && R.centavosDoTexto("R$ 30") === 3000 && R.centavosDoTexto("12.5") === 1250 && R.centavosDoTexto("1.500") === 150000 && R.centavosDoTexto("abc") === null && R.centavosDoTexto("0") === null);

// ── 62. Meta coletiva ──
{
  await recusa("62: quem só tem função não põe meta", () => chamar("bia", "rede_p4_or_meta_criar", { p: { org: ORG, titulo: "Panfletar o bairro", unidade: "panfletos", alvo: 500 } }), "sem_permissao");
  await recusa("62: alvo zero não", () => chamar("ana", "rede_p4_or_meta_criar", { p: { org: ORG, titulo: "Panfletar o bairro", unidade: "panfletos", alvo: 0 } }), "invalido:alvo");
  const m = await passa("62: quem gerencia põe a meta", () => chamar("ana", "rede_p4_or_meta_criar", { p: { org: ORG, titulo: "Panfletar o bairro", unidade: "panfletos", alvo: 500, prazo: "2030-12-31" } }));
  ok("62: começa sem soma à mostra", m?.soma === null && m.pessoas === null && m.atingida === null && m.somei === false);
  await recusa("62: quem é de fora não soma", () => chamar("duda", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 10 }), "nao_encontrado");
  await recusa("62: somar mais que o alvo de uma vez não", () => chamar("bia", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 501 }), "invalido:quanto");
  const um = await passa("62: a bia soma 200", () => chamar("bia", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 200 }));
  await chamar("bia", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 50 });
  ok("62: com menos de 3 pessoas, nem a soma aparece (nem para quem somou)", um?.soma === null && um.somei === true);
  const dois = await chamar("ana", "rede_p4_or_meta_criar", { p: { org: ORG, titulo: "Outra", unidade: "cartazes", alvo: 10 } });
  await chamar("bia", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 1 });
  ok("62: três vezes a mesma pessoa não são 3 pessoas: a soma continua escondida", (await chamar("ana", "rede_p4_or_metas", { p_org: ORG }))?.metas?.find((x) => x.id === m?.id)?.soma === null && dois?.soma === null);
  const tres = await passa("62: a cris soma 300", () => chamar("cris", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 300 }));
  ok(`62: com 2 pessoas, ainda escondida (${tres?.soma})`, tres?.soma === null);
  const quatro = await passa("62: a ana soma 10", () => chamar("ana", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 10 }));
  ok(`62: com 3 pessoas, a soma (561) e a meta batida aparecem (${quatro?.soma})`, quatro?.soma === 561 && quatro.atingida === true && quatro.pessoas === 3);
  ok("62: sem ranking e sem quem somou", semPessoas(quatro) && !/ranking|quem|maior|"por"/.test(JSON.stringify(quatro)));
  const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name like 'rede_p4_or_meta%'")).rows.map((c) => c.column_name);
  const colsPessoas = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_or_meta_pessoas'")).rows.map((c) => c.column_name).sort().join();
  ok(`62: da pessoa, só que somou: nem quanto, nem quando (${colsPessoas})`, colsPessoas === "meta,pessoa" && cols.includes("soma"));
  await recusa("62: quem só tem função não encerra", () => chamar("bia", "rede_p4_or_meta_encerrar", { p_id: m?.id }), "sem_permissao");
  await passa("62: quem gerencia encerra", () => chamar("ana", "rede_p4_or_meta_encerrar", { p_id: m?.id }));
  await recusa("62: encerrada, ninguém soma", () => chamar("bia", "rede_p4_or_meta_somar", { p_id: m?.id, p_quanto: 1 }), "fechada");
}

// ── 64. Termômetro do território ──
{
  await recusa("64: tipo inventado não", () => chamar("duda", "rede_p4_or_lugar_criar", { p: { tipo: "praca", nome: "Praça", municipio: "São Paulo", uf: "SP" } }), "invalido:tipo");
  await recusa("64: UF estranha não", () => chamar("duda", "rede_p4_or_lugar_criar", { p: { tipo: "ubs", nome: "UBS Vila Nova", municipio: "São Paulo", uf: "sp" } }), "invalido:municipio");
  const l = await passa("64: a duda põe a UBS", () => chamar("duda", "rede_p4_or_lugar_criar", { p: { tipo: "ubs", nome: "UBS Vila Nova", municipio: "São  Paulo", uf: "SP" } }));
  ok("64: o município fica normalizado como o dos atos", l?.municipio === "sao paulo" && l.uf === "SP" && l.resultado === null);
  const mesma = await chamar("gil", "rede_p4_or_lugar_criar", { p: { tipo: "ubs", nome: "ubs vila nova", municipio: "SAO PAULO", uf: "SP" } });
  ok("64: o mesmo lugar não entra duas vezes", mesma?.id === l?.id);
  await recusa("64: nota 6 não", () => chamar("duda", "rede_p4_or_lugar_avaliar", { p_id: l?.id, p_nota: 6, p_problemas: [] }), "invalido:nota");
  await recusa("64: problema de outro tipo não", () => chamar("duda", "rede_p4_or_lugar_avaliar", { p_id: l?.id, p_nota: 2, p_problemas: ["merenda"] }), "invalido:problemas");
  const a1 = await passa("64: a duda avalia (2, falta remédio e demora)", () => chamar("duda", "rede_p4_or_lugar_avaliar", { p_id: l?.id, p_nota: 2, p_problemas: ["falta_remedio", "demora"] }));
  ok("64: com 1 avaliação, nada do agregado aparece", a1?.resultado === null && a1.avaliei === true);
  await recusa("64: uma vez por semestre", () => chamar("duda", "rede_p4_or_lugar_avaliar", { p_id: l?.id, p_nota: 1, p_problemas: [] }), "ja_votou");
  await chamar("gil", "rede_p4_or_lugar_avaliar", { p_id: l?.id, p_nota: 1, p_problemas: ["falta_remedio"] });
  ok("64: com 2, ainda nada", (await chamar("fabi", "rede_p4_or_lugares", { p_municipio: "São Paulo", p_uf: "SP" }))?.lugares?.[0]?.resultado === null);
  const a3 = await passa("64: a fabi avalia (3, falta remédio)", () => chamar("fabi", "rede_p4_or_lugar_avaliar", { p_id: l?.id, p_nota: 3, p_problemas: ["falta_remedio"] }));
  ok(`64: com 3, a nota média (2) e só o problema citado 3 vezes (${JSON.stringify(a3?.resultado)})`,
    a3?.resultado?.avaliacoes === 3 && Number(a3.resultado.nota) === 2 && JSON.stringify(a3.resultado.problemas) === JSON.stringify({ falta_remedio: 3 }));
  ok("64: nada de quem avaliou", semPessoas(a3));
  const cols = (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name like 'rede_p4_or_lugar%'")).rows;
  ok("64: nota e problemas ficam em contadores; da pessoa, só que avaliou no semestre (sem hora)",
    !cols.some((c) => c.table_name === "rede_p4_or_lugar_avaliadores" && /nota|problema/.test(c.column_name)) && !cols.some((c) => /timestamp/.test(c.data_type))
    && !cols.some((c) => /pessoa/.test(c.column_name) && c.table_name !== "rede_p4_or_lugar_avaliadores"));
  const linhas = (await dono("select count(*)::int n from interno.rede_p4_or_lugar_somas where lugar = $1", [l?.id])).rows[0].n;
  ok("64: uma linha de soma por lugar e semestre, não por avaliação", linhas === 1);
  // A denúncia coletiva, no aparelho
  const lugar = (await chamar("ana", "rede_p4_or_lugares", { p_municipio: "sao paulo", p_uf: "SP" }))?.lugares?.[0];
  const den = R.denunciaColetiva(lugar, { tipos: { ubs: "UBS" }, problemas: { falta_remedio: "Falta de remédio" }, modelo: "Avaliação de {lugar} ({tipo}), {municipio}/{uf}: nota {nota} de 5 em {n} avaliações. Problemas: {problemas}." });
  ok(`64: a denúncia coletiva sai do agregado (${den})`, den === "Avaliação de UBS Vila Nova (UBS), sao paulo/SP: nota 2 de 5 em 3 avaliações. Problemas: Falta de remédio (3).");
  ok("64: sem agregado (menos de 3), não há denúncia", R.denunciaColetiva({ ...lugar, resultado: null }, { tipos: {}, problemas: {}, modelo: "{lugar}" }) === null);
  ok("64: os problemas de cada tipo são os mesmos no aparelho e no banco",
    JSON.stringify(R.PROBLEMAS_DO_LUGAR.ubs) === JSON.stringify((await dono("select interno.rede_p4_or_problemas_do_tipo('ubs') p")).rows[0].p)
    && JSON.stringify(R.PROBLEMAS_DO_LUGAR.iluminacao) === JSON.stringify((await dono("select interno.rede_p4_or_problemas_do_tipo('iluminacao') p")).rows[0].p));
}

// ── 65. Apoio direto a quem produz ──
{
  const CHAVE = "123e4567-e89b-42d3-a456-426614174000";
  await recusa("65: CPF como chave não (dado pessoal)", () => chamar("cris", "rede_p4_or_apoio_salvar", { p: { pix: "123.456.789-09" } }), "dado_pessoal");
  await recusa("65: telefone como chave não", () => chamar("cris", "rede_p4_or_apoio_salvar", { p: { pix: "(11) 98765-4321" } }), "dado_pessoal");
  await recusa("65: e-mail como chave não", () => chamar("cris", "rede_p4_or_apoio_salvar", { p: { pix: "cris@exemplo.org" } }), "dado_pessoal");
  await recusa("65: chave que não é aleatória não", () => chamar("cris", "rede_p4_or_apoio_salvar", { p: { pix: "minhachave" } }), "invalido:pix");
  await recusa("65: link http não", () => chamar("cris", "rede_p4_or_apoio_salvar", { p: { link: "http://vaquinha.exemplo.org" } }), "invalido:link");
  const meu = await passa("65: a cris põe a chave aleatória e o link", () => chamar("cris", "rede_p4_or_apoio_salvar", { p: { pix: CHAVE.toUpperCase(), link: "https://vaquinha.exemplo.org/cris", texto: "Para o próximo zine" } }));
  ok("65: a chave fica em minúsculas, com o link", meu?.pix === CHAVE && meu.link === "https://vaquinha.exemplo.org/cris");
  const visto = await passa("65: a duda vê no perfil da cris", () => chamar("duda", "rede_p4_or_apoio_de", { p_handle: "@pessoa_cris" }));
  ok("65: vem só a chave, o link e a frase (nada de quem apoiou ou quantos)", visto?.pix === CHAVE && visto.meu === false && Object.keys(visto).sort().join() === "link,meu,pix,texto");
  const tabelas = (await dono("select count(*)::int n from information_schema.columns where table_schema = 'interno' and table_name like 'rede_p4_or_apoio%' and column_name ~ '(quem|apoiador|visto|abriu|copiou|valor|centavo|taxa)'")).rows[0].n;
  ok("65: nada guarda quem abriu, copiou ou apoiou, nem valor ou taxa", tabelas === 0);
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.cris, P.duda]);
  ok("65: com bloqueio, não aparece", (await chamar("duda", "rede_p4_or_apoio_de", { p_handle: "pessoa_cris" })) === null);
  await dono("delete from interno.rede_bloqueios where quem = $1", [P.cris]);
  ok("65: quem não pôs não tem nada", (await chamar("duda", "rede_p4_or_apoio_de", { p_handle: "pessoa_gil" })) === null);
  await passa("65: os dois vazios tiram tudo", () => chamar("cris", "rede_p4_or_apoio_salvar", { p: { pix: "", link: "" } }));
  ok("65: e some do perfil", (await chamar("duda", "rede_p4_or_apoio_de", { p_handle: "pessoa_cris" })) === null);
  ok("65: o aparelho confere a chave aleatória do mesmo jeito", R.chavePixAleatoria(CHAVE.toUpperCase()) === CHAVE && R.chavePixAleatoria("123.456.789-09") === null && R.chavePixAleatoria("a@b.org") === null);
}

// ── 66. Pedir checagem ao Instituto ──
{
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('historia', 'História', 'disciplinas', 'aberta', 'internet') on conflict do nothing");
  const ABERTO = (await dono("insert into interno.rede_posts (autor, texto, tipo, comunidade, publico) values ($1, 'A Lei Áurea foi assinada em 1888 por pressão popular.', 'post', 'historia', 'internet') returning id", [P.fabi])).rows[0].id;
  const DE_MEMBROS = (await dono("insert into interno.rede_posts (autor, texto, tipo, publico) values ($1, 'Só para quem tem conta.', 'post', 'membros') returning id", [P.fabi])).rows[0].id;
  const vePublico = (await dono("select interno.rede_ve(p, null) v from interno.rede_posts p where id = $1", [ABERTO])).rows[0].v;
  ok(`66: o post de teste é aberto a visitante (${vePublico})`, vePublico === true);
  await recusa("66: post só de membros não sai para a fila", () => chamar("duda", "rede_p4_or_checagem_pedir", { p_post: DE_MEMBROS, p_motivo: "Parece notícia falsa sobre o ato." }), "so_aberto");
  await recusa("66: post que não existe não", () => chamar("duda", "rede_p4_or_checagem_pedir", { p_post: "00000000-0000-4000-8000-000000000066", p_motivo: "Parece notícia falsa sobre o ato." }), "nao_encontrado");
  await recusa("66: motivo curto não", () => chamar("duda", "rede_p4_or_checagem_pedir", { p_post: ABERTO, p_motivo: "falso" }), "invalido:motivo");
  await recusa("66: telefone no motivo não", () => chamar("duda", "rede_p4_or_checagem_pedir", { p_post: ABERTO, p_motivo: "me liga no 11 99999-8888 para falar" }), "dado_pessoal");
  const antes = (await dono("select count(*)::int n from interno.vale_fila")).rows[0].n;
  const r = await passa("66: a duda pede a checagem", () => chamar("duda", "rede_p4_or_checagem_pedir", { p_post: ABERTO, p_motivo: "A data me parece errada, conferir na fonte." }));
  ok("66: entrou na fila", r?.ok === true && r.ja_na_fila === false && (await dono("select count(*)::int n from interno.vale_fila")).rows[0].n === antes + 1);
  const envio = (await dono("select e.* from interno.vale_envios e where e.url like '%' || $1", [ABERTO])).rows[0];
  ok("66: na fila vai só o endereço do post e o motivo: sem o texto do post, sem quem pediu, sem endereço de rede",
    envio?.url === `https://alumia.institutolucia.org/pt/p/${ABERTO}` && envio.descricao === "A data me parece errada, conferir na fonte." && envio.trecho === null && envio.contato === null
    && envio.origem_hash === "alumia" && !JSON.stringify(envio).includes("Lei Áurea") && !Object.values(P).some((id) => JSON.stringify(envio).includes(id)));
  const fila = (await dono("select f.origem, f.revisor from interno.vale_fila f where f.envio = $1", [envio?.id])).rows[0];
  ok("66: como envio do público", fila?.origem === "publico" && fila.revisor === null);
  const de_novo = await passa("66: o mesmo post de novo (por outra pessoa)", () => chamar("gil", "rede_p4_or_checagem_pedir", { p_post: ABERTO, p_motivo: "Também acho que a data está errada." }));
  ok("66: não entra duas vezes na semana", de_novo?.ja_na_fila === true && (await dono("select count(*)::int n from interno.vale_fila")).rows[0].n === antes + 1);
  ok("66: a migração não guarda quem pediu (nenhuma tabela nova para isso)", !/create table if not exists interno\.rede_p4_or_checag/.test(semComentario));
  ok("66: o botão só aparece para post aberto à internet", R.podePedirChecagem({ publico: "internet" }) && !R.podePedirChecagem({ publico: "membros" }) && !R.podePedirChecagem({ publico: "nucleo" }) && !R.podePedirChecagem({ publico: "internet", cifrado: true }));
}

// ── 67. Ata assistida (só no aparelho) ──
{
  const ROT = { data: "Data", pessoas: "Quantas pessoas", pauta: "Pauta", falas: "Falas", encaminhamentos: "Encaminhamentos", nenhum: "(nada)", aviso: "Rascunho feito no aparelho." };
  const fala = "Abrimos a reunião às sete. A pauta é o ato de sábado. Decidimos levar a faixa grande. Precisamos de água!  Quem leva o som? Encaminhamento: a comunicação faz o panfleto até quinta.";
  const ata = R.rascunhoDeAta(fala, { titulo: "Reunião da coordenação", data: "21/11/2026", pauta: "Ato de sábado", rotulos: ROT });
  ok("67: a fala vira frases", R.frasesDaFala(fala).length === 6);
  ok("67: o rascunho tem título, data, pauta, as falas em parágrafos e os encaminhamentos achados na fala",
    ata.startsWith("Reunião da coordenação\nData: 21/11/2026\nQuantas pessoas: ___\n") && ata.includes("Pauta:\nAto de sábado") && ata.includes("Falas:\nAbrimos a reunião às sete. A pauta é o ato de sábado. Decidimos levar a faixa grande. Precisamos de água!\nQuem leva o som?")
    && ata.includes("Encaminhamentos:\n- Decidimos levar a faixa grande.\n- Encaminhamento: a comunicação faz o panfleto até quinta.") && ata.trimEnd().endsWith("Rascunho feito no aparelho."));
  ok("67: sem fala, o rascunho diz que não há nada (e não inventa)", R.rascunhoDeAta("", { titulo: "Reunião", data: "1/1/2027", rotulos: ROT }).includes("Falas:\n(nada)"));
  ok("67: a ata não tem lista de presença (só quantas pessoas)", !/presentes|lista de presen/i.test(ata));
  const tela = ler("components/rede/organizacao/AbaAta.tsx");
  ok("67: a tela transcreve só pelo reconhecimento no aparelho (lib/rede/midia/reconhecer.ts) e nada vai ao banco",
    /from "@\/lib\/rede\/midia\/reconhecer"/.test(tela) && /ditadoNoAparelho/.test(tela) && !/webkitSpeechRecognition|organizacao\.\w+\(|fetch\(/.test(tela));
  ok("67: a migração não tem tabela de ata assistida (nada vai ao banco)", !/rede_p4_or_ata/.test(semComentario));
}

// ═══ 4. As ligações ═══
ok("a flag existe e é só pelo nome", R.FLAG_DA_ORGANIZACAO in RECURSOS && SO_PELO_NOME.includes(R.FLAG_DA_ORGANIZACAO));
ok("\"todos\" não liga; o nome liga", ligado(R.FLAG_DA_ORGANIZACAO, lerRecursos("todos")) === false && ligado(R.FLAG_DA_ORGANIZACAO, lerRecursos(`todos,${R.FLAG_DA_ORGANIZACAO}`)) === true);
ok("o painel descreve a função", typeof NOMES_DAS_FUNCOES[R.FLAG_DA_ORGANIZACAO]?.sobre === "string" && NOMES_DAS_FUNCOES[R.FLAG_DA_ORGANIZACAO].sobre.length > 40);
ok("os números de pessoas: nada abaixo de 3", R.pessoas(0) === null && R.pessoas(2) === null && R.pessoas(3) === 3 && R.pessoas(null) === null);
ok("links: só https", R.linkSeguro("https://exemplo.org/a") !== null && R.linkSeguro("http://exemplo.org") === null && R.linkSeguro("javascript:alert(1)") === null && R.linkSeguro("https://u:s@exemplo.org") === null);
{
  const registro = ler("components/rede/registro.tsx");
  const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
  const onda5 = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler(`i18n/rede/onda5/${l}.json`))]));
  for (const nome of R.ROTAS_DA_ORGANIZACAO) {
    const r = ROTAS_NOVAS.find((x) => x.nome === nome);
    ok(`rota ${nome}: em ROTAS_NOVAS com a flag do grupo`, r?.flag === R.FLAG_DA_ORGANIZACAO && r.indexar === false);
    const pagina = `app/[lang]/alumia${r?.caminho}/page.tsx`;
    ok(`rota ${nome}: a página passa pela PaginaNova`, existe(pagina) && ler(pagina).includes(`nome="${nome}"`) && ler(pagina).includes("metadadosDaRotaNova"));
    ok(`rota ${nome}: no registro com import dinâmico`, new RegExp(`"?${nome}"?: \\{ componente: dynamic`).test(registro));
    for (const l of idiomas) ok(`rota ${nome}: título em ${l}`, !!onda5[l].telas[nome]?.titulo && !!onda5[l].telas[nome]?.descricao);
  }
  const encaixes = ler("components/rede/encaixes.tsx");
  ok("o encaixe do grupo está na lista das frentes, logo depois da cultura (e antes da ação coletiva, da junção)", encaixes.includes('import { encaixe as organizacao } from "./organizacao/encaixe";') && /cultura, organizacao, coletiva, modoato,/.test(encaixes));
  ok("o menu só ganha o item com a rota ligada e para quem tem conta", /!rotaNovaLigada\("organizar"\) \? \{\} :/.test(ler("components/rede/organizacao/encaixe.tsx")) && /situacao\.logado \?/.test(ler("components/rede/organizacao/encaixe.tsx")));
  const pt = JSON.parse(ler("i18n/rede/organizacao/pt.json"));
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).filter((k) => k !== "_rascunho").sort();
  for (const l of idiomas.slice(1)) {
    const t = JSON.parse(ler(`i18n/rede/organizacao/${l}.json`));
    ok(`textos ${l}: marcados como rascunho`, t._rascunho === true);
    ok(`textos ${l}: as mesmas chaves do português`, JSON.stringify(chaves(t)) === JSON.stringify(chaves(pt)));
  }
  ok("textos pt: não é rascunho", pt._rascunho === undefined);
  const pasta = "components/rede/organizacao";
  const telas = fs.readdirSync(path.join(raiz, pasta)).filter((n) => n.endsWith(".tsx")).map((n) => ler(`${pasta}/${n}`)).join("\n");
  ok("as telas não usam confirm(), alert() nem prompt() do navegador", !/\b(window\.)?(confirm|alert|prompt)\(/.test(telas.replace(/confirmar\(|perguntar\(/g, "")));
  ok("as telas não mandam nada a terceiros (nenhum fetch a outro endereço)", !/fetch\(\s*["'`]https?:/.test(telas));
  ok("as telas e as regras não pedem a posição do aparelho", !/geolocation|getCurrentPosition|watchPosition/.test(telas + ler("lib/rede/organizacao/regras.ts")));
  ok("nenhum Math.random nas regras, no cliente e nas telas", !/Math\.random/.test(telas + ler("lib/rede/organizacao/regras.ts") + ler("lib/rede/organizacao/cliente.ts") + ler("lib/rede/organizacao/duble.ts")));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
