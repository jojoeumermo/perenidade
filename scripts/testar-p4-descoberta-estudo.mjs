// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, lote descoberta e estudo (Parte E, itens 45 a 51, e Parte G, itens 68 a 73 e 101 a 103):
//   · antes da migração: nada disso existe no banco;
//   · com o interruptor desligado, tudo recusa com "desligado" (e o RSS do #tema devolve nulo);
//   · cada item funciona e cumpre a regra de privacidade dele: nenhum número abaixo de 3, nenhuma lista de pessoas (nenhuma
//     resposta traz o id de ninguém), nenhum IP, nada de quem propôs, respondeu ou segue;
//   · o que é só do aparelho (46, 47, 48, 70, 72, 73, 103) não fala com servidor nenhum;
//   · a tela: rota, flag, painel, registro, textos e nenhum pedido do aparelho a serviço de fora.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p4-descoberta-estudo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { RECURSOS, SO_PELO_NOME, ligado, lerRecursos } from "../lib/recursos.ts";
import { ROTAS_NOVAS } from "../lib/rede/rotas-novas.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
/** Compara objetos sem ligar para a ordem das chaves (o jsonb reordena). */
const ordenado = (v) => (Array.isArray(v) ? v.map(ordenado) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenado(v[k])])) : v);
const igual = (nome, a, b) => ok(`${nome} (veio ${JSON.stringify(a)})`, JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b)));
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

const FLAG = "alumia-p4-descoberta-estudo";
const SQL = normal(ler("supabase/migracoes/20261127-p4-descoberta-estudo.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");

// ═══ 0. A migração no padrão ═══
ok("a migração começa com a licença", SQL.startsWith("-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later"));
ok("a migração diz que pode rodar mais de uma vez e a lei", SQL.includes("Pode rodar mais de uma vez") && /-- Lei: LGPD art\./.test(SQL));
ok("a migração diz onde entra (antes do 20261127-p4-fim.sql)", SQL.includes("quem junta põe antes do\n-- 20261127-p4-fim.sql") && SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)"));
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem/i.test(semComentario));
ok("a migração não sobe a versão da Alumia", !/rede_alumia_versao/.test(semComentario));
ok("a migração não redefine função de fora do lote", [...semComentario.matchAll(/create or replace function (\w+)\.(\w+)/g)].every((m) => m[2].startsWith("rede_p4_de_")));
ok("o interruptor entra no catálogo protegido por to_regclass", /to_regclass\('interno\.recursos_catalogo'\) is not null then\s+insert into interno\.recursos_catalogo \(nome, so_pelo_nome\) values \('alumia-p4-descoberta-estudo', true\)/.test(SQL));
{
  const comDeclare = [...semComentario.matchAll(/create or replace function public\.(rede_p4_de_\w+)\([^)]*\)[^$]*?\$\$\s*declare[^;]*;?[\s\S]*?\bbegin\s+([^\n]*)/g)];
  const semDeclare = [...semComentario.matchAll(/create or replace function public\.(rede_p4_de_\w+)\([^)]*\)[^$]*?\$\$\s*begin\s+([^\n]*)/g)];
  const todas = [...comDeclare, ...semDeclare].filter((m) => m[1] !== "rede_p4_de_servidores_fora");
  const semPorta = todas.filter((m) => !m[2].startsWith("perform interno.alumia_porta();")).map((m) => m[1]);
  igual("toda função pública (menos a da chave de serviço) começa pela porta", semPorta, []);
}

// ═══ 1. Antes: nada disso existe ═══
// Colada no install.sql (depois da junção), o banco de antes é o install.sql cortado antes dela.
const install = normal(ler("supabase/install.sql"));
const banco = await criarBanco(install.includes(SQL) ? { antesDe: SQL } : {});
const { dono, rpc } = banco;
igual("antes: nenhuma função do lote existe", (await dono("select count(*)::int n from pg_proc where proname like 'rede\\_p4\\_de\\_%'")).rows[0].n, 0);
igual("antes: nenhuma tabela do lote existe", (await dono("select count(*)::int n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname like 'rede\\_p4\\_de\\_%'")).rows[0].n, 0);

// ═══ 2. A migração ═══
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  igual("trancar não acha nada aberto", r.abertas, []);
  const semPorta = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\\_p4\\_de\\_%' and p.prosrc !~ 'interno\\.alumia_(porta|passa)\\(\\)'
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.proname);
  igual("no banco, toda função do lote que anon ou authenticated chamam tem a porta", semPorta, []);
  const tabelas = (await dono(`select c.relname, c.relrowsecurity, (select count(*) from pg_policy po where po.polrelid = c.oid)::int as politicas
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and c.relname like 'rede\\_p4\\_de\\_%' order by 1`)).rows;
  igual("todas as tabelas do lote com RLS ligada e sem política", tabelas.filter((t) => !t.relrowsecurity || t.politicas > 0).map((t) => t.relname), []);
  const ip = (await dono(`select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'interno' and table_name like 'rede\\_p4\\_de\\_%'
    and (data_type in ('inet', 'cidr') or column_name ~ '(^|_)(ip|origem|endereco_ip)($|_)')`)).rows.map((x) => x.c);
  igual("nenhuma coluna de endereço de rede", ip, []);
  const anon = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\\_p4\\_de\\_%' and has_function_privilege('anon', p.oid, 'execute') order by 1`)).rows.map((x) => x.proname);
  igual("o visitante só chama o RSS do #tema (e só se o lote tem o 50)", anon, SQL.includes("public.rede_p4_de_rss_tag") ? ["rede_p4_de_rss_tag"] : []);
  const internas = (await dono(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'rede\\_p4\\_de\\_%' and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`)).rows[0].n;
  igual("as peças de dentro não são chamáveis por quem tem sessão", internas, 0);
}

// ═══ 3. As pessoas e as comunidades ═══
const NOMES = ["ana", "bia", "caio", "duda", "eva", "fia", "gil"];
const P = {};
for (const [i, nome] of NOMES.entries()) {
  P[nome] = await banco.criarUsuario(`${nome}@p4-de.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Codinome ${nome}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.ana]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
// Gil chegou agora; as outras têm conta de meses.
await dono("update auth.users set created_at = now() - interval '200 days'");
await dono("update auth.users set created_at = now() - interval '5 days' where id = $1", [P.gil]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('de-um', 'Roda Um', 'lutas', 'aberta'), ('de-dois', 'Roda Dois', 'lutas', 'aberta'),
  ('de-tres', 'Roda Três', 'lutas', 'aberta'), ('de-quatro', 'Quatro', 'disciplinas', 'aberta'), ('de-fechada', 'Fechada', 'lutas', 'fechada') on conflict do nothing`);

const como = (nome) => ({ papel: "authenticated", sub: P[nome], ip: "198.51.100.9", ...(nome === "ana" ? { aal: "aal2" } : {}) });
const chamar = async (nome, funcao, argumentos = {}) => {
  await dono("delete from interno.limites");
  return rpc(como(nome), funcao, argumentos);
};
const visitante = { papel: "anon", ip: "203.0.113.10" };
const IDS = new Set(Object.values(P));
/** Nenhuma resposta traz o id de uma pessoa (nenhuma lista de pessoas, nem escondida no JSON). */
const semPessoas = (nome, r) => {
  const texto = JSON.stringify(r ?? null);
  ok(`${nome}: a resposta não traz o id de ninguém`, ![...IDS].some((id) => texto.includes(id)));
};
const post = async (autor, campos = {}) => {
  const c = { texto: "Post de teste.", publico: "membros", comunidade: "de-um", ...campos };
  const r = await dono("insert into interno.rede_posts (autor, texto, comunidade, publico, criado_em) values ($1, $2, $3, $4, coalesce($5, now())) returning id",
    [P[autor], c.texto, c.comunidade, c.publico, c.criado_em ?? null]);
  return r.rows[0].id;
};

// ═══ 4. Desligado ═══
await recusa("desligado: o começo recusa", () => chamar("caio", "rede_p4_de_inicio"), "desligado");
igual("desligado: a tela sabe que está desligado", await chamar("caio", "rede_p4_de_ligado"), false);
await dono("insert into interno.recursos_vivos (nome, ligado) values ($1, true) on conflict (nome) do update set ligado = true", [FLAG]);
igual("ligado pelo painel: a tela sabe", await chamar("caio", "rede_p4_de_ligado"), true);
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-2', false) on conflict (nome) do update set ligado = false");
await recusa("com a Alumia 2 desligada no painel, o lote também", () => chamar("caio", "rede_p4_de_inicio"), "desligado");
await dono("delete from interno.recursos_vivos where nome = 'alumia-2'");
{
  const inicio = await passa("início: abre para quem é membro", () => chamar("caio", "rede_p4_de_inicio"));
  igual("início: caio não cuida nem é educadora e não tem turma", inicio && [inicio.cuido, inicio.educadora, inicio.turmas], [false, false, []]);
  const daAna = await chamar("ana", "rede_p4_de_inicio");
  igual("início: a coordenação cuida", daAna.cuido, true);
  semPessoas("início", inicio);
}

// ═══ Item 45: assuntos em movimento ═══
{
  // #greve: 3 comunidades e 3 pessoas → entra. #creche: 3 comunidades mas 2 pessoas → não. #sarau: 3 pessoas em 2 comunidades → não.
  // #velho: 3 e 3, mas há mais de 72 horas → não. #segredo: 3 e 3 com uma na comunidade fechada → não. #retido: a moderação reteve.
  await post("bia", { texto: "Assembleia hoje #greve", comunidade: "de-um" });
  await post("caio", { texto: "Piquete cedo #greve", comunidade: "de-dois" });
  await post("duda", { texto: "Fundo de greve #greve", comunidade: "de-tres" });
  await post("bia", { texto: "#creche já", comunidade: "de-um" });
  await post("bia", { texto: "#creche agora", comunidade: "de-dois" });
  await post("caio", { texto: "#creche para todas", comunidade: "de-tres" });
  await post("bia", { texto: "#sarau sexta", comunidade: "de-um" });
  await post("caio", { texto: "#sarau sábado", comunidade: "de-dois" });
  await post("duda", { texto: "#sarau domingo", comunidade: "de-dois" });
  for (const [quem, c] of [["bia", "de-um"], ["caio", "de-dois"], ["duda", "de-tres"]]) await post(quem, { texto: "#velho assunto", comunidade: c, criado_em: new Date(Date.now() - 80 * 3600e3).toISOString() });
  for (const [quem, c] of [["bia", "de-um"], ["caio", "de-dois"], ["duda", "de-fechada"]]) await post(quem, { texto: "#segredo da roda", comunidade: c });
  for (const [quem, c] of [["bia", "de-um"], ["caio", "de-dois"], ["duda", "de-tres"]]) await post(quem, { texto: "#retido aqui", comunidade: c });
  await dono("insert into interno.rede_o7_temas_retidos (tag) values ('retido') on conflict do nothing");
  const r = await passa("assuntos: responde", () => chamar("eva", "rede_p4_de_assuntos"));
  igual("assuntos: só o #tema de 3 comunidades e 3 pessoas, nas últimas 72 h, fora da fechada e do retido", (r?.temas ?? []).map((t) => t.tag), ["greve"]);
  igual("assuntos: sem número, só a faixa", r?.temas?.[0], { tag: "greve", faixa: "algumas" });
  igual("assuntos: a regra volta junto (\"como contamos isso?\")", r?.regra, { horas: 72, comunidades: 3, pessoas: 3, maximo: 12 });
  semPessoas("assuntos", r);
  ok("assuntos: nenhum post nem texto na resposta", !JSON.stringify(r).includes("Assembleia") && !/"id"/.test(JSON.stringify(r)));
  igual("assuntos: a mesma lista para todo mundo", await chamar("bia", "rede_p4_de_assuntos"), r);
  await recusa("assuntos: visitante não chama", () => rpc(visitante, "rede_p4_de_assuntos"), "permission denied");
}


// ═══ Item 46: "Você está em dia" (escolha da pessoa, só no aparelho) ═══
{
  const { abaComEmDia, emDiaEscolhido, escolherEmDia, guardarMarco, marcoDaAba, ondeParar } = await import("../lib/rede/descoberta-estudo/em-dia.ts");
  const falsa = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
  const g = falsa();
  igual("em dia: desligado por padrão (a rolagem contínua do A20 continua)", emDiaEscolhido(g), false);
  escolherEmDia(true, g);
  igual("em dia: a pessoa liga", emDiaEscolhido(g), true);
  ok("em dia: a escolha fica numa chave \"lucia…\" (o Sair rápido apaga)", [...g.m.keys()].every((k) => k.startsWith("lucia:p4-de:")));
  escolherEmDia(false, g);
  igual("em dia: desligar apaga a chave", [...g.m.keys()], []);
  igual("em dia: só nas abas principais e sem regra montada", [abaComEmDia("seguindo", false), abaComEmDia("tudo", false), abaComEmDia("c:greve", false), abaComEmDia("seguindo", true)], [true, true, false, false]);
  const lista = [{ criado_em: "2026-11-21T10:00:00Z" }, { criado_em: "2026-11-21T09:00:00Z" }, { criado_em: "2026-11-20T08:00:00Z" }, { criado_em: "2026-11-19T08:00:00Z" }];
  igual("em dia: sem marco (primeira vez), nunca para", ondeParar(lista, null), null);
  igual("em dia: para no primeiro post já visto", ondeParar(lista, "2026-11-20T08:00:00Z"), 2);
  igual("em dia: tudo novo, a linha continua carregando", ondeParar(lista.slice(0, 2), "2026-11-20T08:00:00Z"), null);
  igual("em dia: nada novo, para logo no começo", ondeParar(lista, "2026-11-22T00:00:00Z"), 0);
  guardarMarco("seguindo", lista, g);
  igual("em dia: o marco é o post mais novo mostrado", marcoDaAba("seguindo", g), "2026-11-21T10:00:00Z");
  guardarMarco("seguindo", [{ criado_em: "2026-11-01T00:00:00Z" }], g);
  igual("em dia: o marco só avança", marcoDaAba("seguindo", g), "2026-11-21T10:00:00Z");
  const fonte = ler("components/rede/descoberta-estudo/EmDia.tsx");
  ok("em dia: só com a flag do lote (rotaNovaLigada) e com a escolha", /rotaNovaLigada\("descobrir"\) && abaComEmDia\(aba, comRegra\) && emDiaEscolhido\(\)/.test(fonte));
  const linha = ler("components/rede/Linha.tsx");
  ok("em dia: a linha para de carregar sozinha só quando está em dia", /if \(!alvo \|\| !temMais \|\| erroDoMais \|\| emDiaParado \|\|/.test(linha));
  ok("em dia: a linha mostra o cartão no lugar do \"carregar mais\"", /pararEmDia !== null \? \(\s*<VoceEstaEmDia lang=\{lang\} aoVerAntigos=\{emDia\.verAntigos\} \/>/.test(linha));
  ok("em dia: nada vai ao servidor", !/chamar|rpc\(|fetch\(/.test(ler("lib/rede/descoberta-estudo/em-dia.ts") + fonte));
}


// ═══ Item 47: pausa e limite de tempo (já existia: o lembrete de pausa da B1 e a hora de parar do modo leve). A prova. ═══
{
  const b1 = await import("../lib/rede/publicar/b1.ts");
  const leve = await import("../components/rede/leve/regras.ts");
  const falsa = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
  const g = falsa();
  igual("pausa: 30 minutos por padrão, ajustável de 15 em 15 ou desligada", [b1.minutosDaPausa(g), [...b1.MINUTOS_DA_PAUSA]], [30, [15, 30, 45, 60, 0]]);
  b1.guardarMinutosDaPausa(15, g);
  igual("pausa: a escolha fica no aparelho", b1.minutosDaPausa(g), 15);
  b1.guardarMinutosDaPausa(7, g);
  igual("pausa: valor torto volta ao padrão", b1.minutosDaPausa(g), 30);
  // O relógio conta só o tempo rolando de verdade (página à vista e um gesto nos últimos 90 s), sem placar.
  const r = b1.criarRelogioDaPausa(1);
  let t = 0, avisou = false;
  r.gesto(t);
  for (; t <= 55_000; t += 5_000) avisou = r.tique(t, true) || avisou;
  igual("pausa: menos de 1 minuto rolando, nada", avisou, false);
  for (; t <= 70_000; t += 5_000) avisou = r.tique(t, false) || avisou;
  igual("pausa: com a página escondida, o relógio não anda", avisou, false);
  r.gesto(t);
  for (; t <= 80_000; t += 5_000) avisou = r.tique(t, true) || avisou;
  igual("pausa: passou do minuto rolando, avisa", avisou, true);
  r.zerar();
  igual("pausa: zera a cada lembrete (sem contagem do dia)", r.ms, 0);
  const parado = b1.criarRelogioDaPausa(2);
  parado.gesto(0);
  let avisouParado = false;
  for (let x = 0; x <= 300_000; x += 5_000) avisouParado = parado.tique(x, true) || avisouParado;
  igual("pausa: depois de 90 s sem gesto de rolar, para de contar (ler devagar não é rolar)", avisouParado, false);
  igual("pausa desligada (0) nunca avisa", (() => { const z = b1.criarRelogioDaPausa(0); z.gesto(0); return [0, 5e3, 1e4].some((x) => z.tique(x, true)); })(), false);
  // A hora de parar (limite de tempo do dia), também só no aparelho.
  igual("hora de parar: \"23:00\" vira minutos; torto é nulo", [leve.minutosDoDia("23:00"), leve.minutosDoDia("25:00"), leve.minutosDoDia("x")], [1380, null, null]);
  const noite = new Date(2026, 10, 20, 23, 30);
  igual("hora de parar: lembra na janela, uma vez por noite", [leve.horaDeLembrar(noite, "23:00", null), leve.horaDeLembrar(noite, "23:00", leve.noiteDe(noite, 1380)), leve.horaDeLembrar(new Date(2026, 10, 20, 15, 0), "23:00", null)], [true, false, false]);
  ok("hora de parar: as chaves são \"lucia…\" (o Sair rápido apaga)", leve.CHAVES_DO_LEVE.parar.startsWith("lucia") && leve.CHAVES_DO_LEVE.pararVisto.startsWith("lucia"));
  const fontes = ler("components/rede/publicar/alumia2/LembreteDePausa.tsx") + ler("lib/rede/publicar/b1.ts");
  ok("pausa: nada vai ao servidor (sem chamada ao banco nem fetch)", !/rpc\(|chamar\(|fetch\(/.test(fontes));
}


// ═══ Item 48: ritmo de estudo privado (só no aparelho; não pune quem perde um dia) ═══
{
  const rt = await import("../lib/rede/descoberta-estudo/ritmo.ts");
  const falsa = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
  const g = falsa();
  igual("ritmo: começa vazio, sem meta", rt.lerRitmo(g), { meta: 0, dias: {} });
  rt.escolherMeta(120, "2026-11-18", g);
  rt.marcar(30, "2026-11-16", g); // segunda
  rt.marcar(45, "2026-11-18", g); // quarta (a pessoa não estudou na terça)
  const r = rt.lerRitmo(g);
  const s = rt.resumo(r, "2026-11-18");
  igual("ritmo: a semana soma os minutos e os dias com estudo", [s.semana.segunda, s.semana.minutos, s.semana.dias, s.meta, s.metaFeita], ["2026-11-16", 75, 2, 120, false]);
  ok("ritmo: nenhum campo de sequência, placar ou atraso", !/sequencia|streak|placar|atras|pontos|xp/i.test(JSON.stringify(s) + JSON.stringify(r)));
  // Perder dias não tira nada: dois dias sem marcar e a semana continua a mesma.
  igual("ritmo: perder um dia não muda nada do que já foi feito", rt.resumo(r, "2026-11-20").semana.minutos, 75);
  rt.marcar(60, "2026-11-20", g);
  igual("ritmo: chegou na meta da semana", rt.resumo(rt.lerRitmo(g), "2026-11-20").metaFeita, true);
  igual("ritmo: a semana seguinte começa do zero (sem \"atrasada\")", rt.resumo(rt.lerRitmo(g), "2026-11-23").semana.minutos, 0);
  rt.marcar(-100, "2026-11-20", g);
  igual("ritmo: tirar nunca deixa negativo (o dia some)", rt.lerRitmo(g).dias["2026-11-20"], undefined);
  // Só 8 semanas ficam guardadas.
  rt.marcar(20, "2026-09-01", g);
  rt.marcar(10, "2026-11-21", g);
  igual("ritmo: o que passa de 8 semanas some sozinho", Object.keys(rt.lerRitmo(g).dias).includes("2026-09-01"), false);
  ok("ritmo: guardado numa chave \"lucia…\" (o Sair rápido apaga)", [...g.m.keys()].every((k) => k === "lucia:p4-de:ritmo"));
  rt.esquecerRitmo(g);
  igual("ritmo: a pessoa apaga tudo", [...g.m.keys()], []);
  ok("ritmo: nada vai ao servidor", !/chamar|rpc\(|fetch\(/.test(ler("lib/rede/descoberta-estudo/ritmo.ts") + ler("components/rede/descoberta-estudo/Ritmo.tsx")));
  ok("ritmo: os textos não falam em sequência nem atraso como cobrança", !/sequ[eê]ncia de dias|você está atrasad/i.test(JSON.stringify(JSON.parse(ler("i18n/rede/p4-descoberta-estudo/pt.json")).ritmo)));
}


// ═══ Item 49: #temas do Fediverso, só de servidores aprovados ═══
{
  // O banco: só quem cuida aprova; servidor bloqueado não entra; a lista é só de domínios; o servidor do site lê com a chave de serviço.
  await recusa("servidores: quem não cuida não aprova", () => chamar("caio", "rede_p4_de_servidor", { p_dominio: "exemplo.social", p_sim: true }), "sem_permissao");
  await passa("servidores: a coordenação aprova", () => chamar("ana", "rede_p4_de_servidor", { p_dominio: "https://Exemplo.Social/", p_sim: true }));
  await recusa("servidores: domínio torto", () => chamar("ana", "rede_p4_de_servidor", { p_dominio: "http://x", p_sim: true }), "invalido:dominio");
  await dono("insert into interno.rede_fed_bloqueados (dominio) values ('ruim.exemplo') on conflict do nothing");
  await recusa("servidores: servidor bloqueado não entra", () => chamar("ana", "rede_p4_de_servidor", { p_dominio: "sub.ruim.exemplo", p_sim: true }), "bloqueado");
  const lista = await chamar("caio", "rede_p4_de_servidores");
  igual("servidores: a lista é só de domínios", lista, { servidores: ["exemplo.social"], cuido: false });
  semPessoas("servidores", lista);
  igual("servidores: a tabela não guarda quem aprovou", (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_de_servidores' order by ordinal_position")).rows.map((x) => x.column_name), ["dominio", "aprovado_em"]);
  igual("servidores: o servidor do site lê pela chave de serviço", await rpc({ papel: "service_role" }, "rede_p4_de_servidores_fora"), ["exemplo.social"]);
  await recusa("servidores: quem tem conta não chama a do servidor do site", () => rpc(como("caio"), "rede_p4_de_servidores_fora"), "permission denied");
  await dono("insert into interno.rede_p4_de_servidores (dominio) values ('ruim.exemplo') on conflict do nothing");
  igual("servidores: bloqueado depois de aprovado sai da lista na hora", await rpc({ papel: "service_role" }, "rede_p4_de_servidores_fora"), ["exemplo.social"]);
  await dono("update interno.recursos_vivos set ligado = false where nome = $1", [FLAG]);
  igual("servidores: com o lote desligado, o servidor do site recebe nulo (a rota dá 404)", await rpc({ papel: "service_role" }, "rede_p4_de_servidores_fora"), null);
  await dono("update interno.recursos_vivos set ligado = true where nome = $1", [FLAG]);

  // As regras puras e o servidor do site (com dublês: nada sai para a rede no teste).
  const ft = await import("../lib/rede/descoberta-estudo/fediverso-tema.ts");
  igual("fediverso: #tema aceito", [ft.temaOk("#Greve"), ft.temaOk("ação"), ft.temaOk("a"), ft.temaOk("2026")], ["greve", null, null, null]);
  igual("fediverso: o endereço é só https, na API pública do #tema", ft.enderecoDoTema("exemplo.social", "greve"), "https://exemplo.social/api/v1/timelines/tag/greve?limit=20");
  const resposta = [
    { url: "https://exemplo.social/@a/1", visibility: "public", created_at: "2026-11-21T10:00:00Z", content: "<p>Ato <b>sábado</b> &amp; domingo</p><img src=\"https://rastreio.example/x.png\">", spoiler_text: "", account: { acct: "a", display_name: "Coletivo A", avatar: "https://exemplo.social/a.png" }, media_attachments: [{ url: "https://exemplo.social/f.jpg" }] },
    { url: "https://exemplo.social/@b/2", visibility: "unlisted", created_at: "2026-11-21T09:00:00Z", content: "não listado", account: { acct: "b" } },
    { url: "https://exemplo.social/@c/3", visibility: "public", created_at: "2026-11-21T08:00:00Z", content: "impulso", reblog: { id: 1 }, account: { acct: "c" } },
    { url: "http://exemplo.social/@d/4", visibility: "public", created_at: "2026-11-21T07:00:00Z", content: "sem https", account: { acct: "d" } },
    { url: "https://outro.exemplo/@e/5", visibility: "public", created_at: "2026-11-21T06:00:00Z", content: "de longe", spoiler_text: "luto", account: { acct: "e@outro.exemplo", display_name: "E" } },
  ];
  const notas = ft.lerNotasDoTema(resposta, "exemplo.social");
  igual("fediverso: só as públicas, originais e https", notas.map((n) => n.conta), ["a@exemplo.social", "e@outro.exemplo"]);
  igual("fediverso: texto puro, com o aviso", [notas[0].texto, notas[1].aviso], ["Ato sábado & domingo", "luto"]);
  ok("fediverso: nenhuma foto, avatar ou endereço de imagem passa", !/png|jpg|avatar|media|rastreio/.test(JSON.stringify(notas)));
  const srv = await import("../lib/rede/descoberta-estudo/servidor.ts");
  const pedidos = [];
  srv.usarDubles({ servidores: async () => ["exemplo.social", "rede.exemplo.org"], buscar: async (url) => (pedidos.push(url), url.includes("exemplo.social") ? resposta : [resposta[0]]) });
  const juntas = await srv.notasDoTema("greve");
  igual("fediverso: busca em cada servidor aprovado, junta sem repetir", [pedidos.length, juntas.map((n) => n.url)], [2, ["https://exemplo.social/@a/1", "https://outro.exemplo/@e/5"]]);
  await srv.notasDoTema("greve");
  igual("fediverso: o mesmo #tema em menos de 10 minutos não sai de novo (cache)", pedidos.length, 2);
  ok("fediverso: o pedido de fora não leva quem pediu", pedidos.every((u) => !/token|conta|usuario|sub=/.test(u)));
  srv.usarDubles({ servidores: async () => null });
  igual("fediverso: lote desligado no banco → nulo (404)", await srv.notasDoTema("greve"), null);
  srv.usarDubles({});
  const g = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; })();
  igual("fediverso: seguir fica no aparelho", [ft.seguirTema("#Greve", true, g), [...g.m.keys()]], [["greve"], ["lucia:p4-de:fed-temas"]]);
  for (let i = 0; i < 9; i++) ft.seguirTema(`tema_${i}`, true, g);
  igual("fediverso: até 10 #temas de fora", ft.seguirTema("outro", true, g), "muitos");
  const rota = ler("app/api/rede/fediverso-tema/route.ts");
  ok("fediverso: a rota pede a sessão, tem freio pela conta e cai em 404 sem a flag", /contaDoToken\(pedido\)/.test(rota) && /freio\(conta\.id\)/.test(rota) && /!ligado\("alumia-p4-descoberta-estudo"\)/.test(rota));
  ok("fediverso: o servidor busca pelo buscarSeguro (nada de endereço de dentro de casa), sem redirecionar", /buscarSeguro\(url, \{[^}]*maxRedirecionamentos: 0/.test(ler("lib/rede/descoberta-estudo/servidor.ts")));
  ok("fediverso: o aparelho só pede à rota do nosso servidor", /fetch\(`\/api\/rede\/fediverso-tema\?tag=/.test(ler("lib/rede/descoberta-estudo/cliente.ts")) && !/fetch\(/.test(ler("components/rede/descoberta-estudo/FediversoTemas.tsx")));
}


// ═══ Item 50: RSS e Atom por comunidade pública e por #tema (nada restrito entra) ═══
{
  const sai = await post("bia", { texto: "Simulado aberto sábado #enem", comunidade: "de-quatro", publico: "internet" });
  await post("bia", { texto: "Só para membros #enem", comunidade: "de-quatro", publico: "membros" });
  await post("bia", { texto: "Na comunidade de lutas, internet vira membros #enem", comunidade: "de-um", publico: "internet" });
  await post("bia", { texto: "Na fechada #enem", comunidade: "de-fechada", publico: "internet" });
  await post("fia", { texto: "Conta trancada #enem", comunidade: "de-quatro", publico: "internet" });
  await dono("update interno.perfis set rede_modo = 'trancado' where id = $1", [P.fia]);
  const canal = await passa("rss do #tema: o visitante lê", () => rpc(visitante, "rede_p4_de_rss_tag", { p_tag: "#ENEM" }));
  igual("rss do #tema: só o post aberto à internet, de comunidade aberta e de conta que sai", (canal?.itens ?? []).map((i) => i.id), [sai]);
  igual("rss do #tema: o canal", canal && [canal.tipo, canal.nome, canal.titulo], ["tag", "enem", "#enem"]);
  ok("rss do #tema: nada de foto, número ou e-mail", !/midia|apoios|util|@p4-de\.local/.test(JSON.stringify(canal)));
  igual("rss do #tema: #tema torto → nulo", await rpc(visitante, "rede_p4_de_rss_tag", { p_tag: "../x" }), null);
  await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-alcance', false) on conflict (nome) do update set ligado = false");
  igual("rss do #tema: com o alcance desligado no painel → nulo", await rpc(visitante, "rede_p4_de_rss_tag", { p_tag: "enem" }), null);
  await dono("delete from interno.recursos_vivos where nome = 'alumia-alcance'");
  await dono("update interno.recursos_vivos set ligado = false where nome = $1", [FLAG]);
  igual("rss do #tema: com o lote desligado → nulo", await rpc(visitante, "rede_p4_de_rss_tag", { p_tag: "enem" }), null);
  await dono("update interno.recursos_vivos set ligado = true where nome = $1", [FLAG]);

  const fd = await import("../lib/rede/descoberta-estudo/feeds.ts");
  const textos = { descricaoPerfil: "Posts de {nome}", descricaoComunidade: "Posts da comunidade {nome}", aviso: "Aviso: {aviso}", continua: "Continua", semTitulo: "Post de {codinome}", descricaoTema: "Posts com #{nome}" };
  const bases = { alumia: "", site: "https://site.exemplo" };
  const item = { id: "11111111-1111-4111-8111-111111111111", tipo: "post", titulo: null, texto: "Texto <com> & marcas", longo: false, aviso: "", criado_em: "2026-11-21T10:00:00Z", editado_em: null, comunidade: { slug: "de-quatro", nome: "Quatro" }, autor: { codinome: "Bia", handle: "pessoa_bia" } };
  const proprio = fd.enderecoDoFeed("https://site.exemplo", "atom", "t", "enem");
  const atom = fd.montarAtom({ tipo: "tag", nome: "enem", titulo: "#enem", descricao: "", itens: [item] }, { lang: "pt", bases, textos, proprio });
  ok("atom: é Atom 1.0, com o próprio endereço e a página do #tema", atom.includes('<feed xmlns="http://www.w3.org/2005/Atom"') && atom.includes(`<link rel="self" type="application/atom+xml" href="${proprio}"/>`) && atom.includes("https://site.exemplo/pt/alumia/tag/enem"));
  ok("atom: texto escapado, sem HTML de quem escreveu", atom.includes("Texto &lt;com&gt; &amp; marcas") && !atom.includes("<com>"));
  const rss = fd.montarRssDoTema({ tipo: "tag", nome: "enem", titulo: "#enem", descricao: "", itens: [item] }, { lang: "pt", bases, textos, proprio: fd.enderecoDoFeed("https://site.exemplo", "rss", "t", "enem") });
  ok("rss do #tema: RSS 2.0 com a descrição do #tema", rss.includes('<rss version="2.0"') && rss.includes("<description>Posts com #enem</description>"));
  igual("feeds: os endereços", [fd.enderecoDoFeed("https://site.exemplo/", "rss", "c", "de-quatro", "en"), fd.enderecoDoFeed("https://site.exemplo", "atom", "u", "org_x")],
    ["https://site.exemplo/api/rede/rss/c/de-quatro?lang=en", "https://site.exemplo/api/rede/atom/u/org_x"]);
  const rf = await import("../lib/rede/descoberta-estudo/rotas-feed.ts");
  igual("feeds: nomes aceitos por letra", [rf.nomeDoCanal("t", "%23Greve"), rf.nomeDoCanal("c", "de-um"), rf.nomeDoCanal("u", "@org_x"), rf.nomeDoCanal("x", "a"), rf.nomeDoCanal("c", "../x")],
    [{ letra: "t", nome: "greve" }, { letra: "c", nome: "de-um" }, { letra: "u", nome: "org_x" }, null, null]);
  igual("feeds: sem as flags no servidor, 404", (await rf.responderFeed(new Request("https://site.exemplo/api/rede/atom/t/enem"), "atom", "t", "enem")).status, 404);
  const rota = ler("app/api/rede/rss/[tipo]/[nome]/route.ts");
  ok("feeds: o RSS da onda 13 só ganhou a letra t (o resto do arquivo é o mesmo)", /if \(letra === "t"\) return responderFeed\(pedido, "rss", letra, cru\);/.test(rota) && rota.includes('const tipo = letra === "u" ? "perfil" : letra === "c" ? "comunidade" : null;'));
  ok("feeds: a rota do Atom passa pelo mesmo responderFeed", /responderFeed\(pedido, "atom", tipo, nome\)/.test(ler("app/api/rede/atom/[tipo]/[nome]/route.ts")));
}


// ═══ Item 51: linhas compartilháveis (o banco não sabe quem segue) ═══
{
  await recusa("linhas: nada de cidade, núcleo ou tipo (só #temas e comunidades)", () => chamar("bia", "rede_p4_de_linha_publicar", { p_nome: "Minha", p_filtro: { cidade: "Recife" } }), "invalido:filtro");
  await recusa("linhas: comunidade fechada não entra", () => chamar("bia", "rede_p4_de_linha_publicar", { p_nome: "Minha", p_filtro: { comunidades: ["de-fechada"] } }), "invalido:comunidade");
  await recusa("linhas: vazia não", () => chamar("bia", "rede_p4_de_linha_publicar", { p_nome: "Minha", p_filtro: {} }), "invalido:vazia");
  await recusa("linhas: mais de 5 #temas não", () => chamar("bia", "rede_p4_de_linha_publicar", { p_nome: "Minha", p_filtro: { tags: ["a1", "b1", "c1", "d1", "e1", "f1"] } }), "invalido:filtro");
  const l = await passa("linhas: publicar com #temas e comunidades abertas", () => chamar("bia", "rede_p4_de_linha_publicar", { p_nome: "Transporte e moradia", p_filtro: { tags: ["#PasseLivre", "moradia"], comunidades: ["de-um", "de-dois"] } }));
  ok("linhas: ganha um código de 12", /^[a-f0-9]{12}$/.test(l?.codigo ?? ""));
  igual("linhas: a regra arrumada", l && [l.tags, l.comunidades.map((c) => c.slug), l.minha], [["moradia", "passelivre"], ["de-dois", "de-um"], true]);
  const vista = await chamar("caio", "rede_p4_de_linha", { p_codigo: l.codigo });
  igual("linhas: quem recebe o código vê a regra, sem saber quem fez", vista && [vista.nome, vista.minha, Object.keys(vista).sort()], ["Transporte e moradia", false, ["codigo", "comunidades", "minha", "nome", "tags"]]);
  semPessoas("linhas", vista);
  await dono("update interno.rede_comunidades set tipo = 'fechada' where slug = 'de-dois'");
  igual("linhas: comunidade que fechou depois sai da linha na hora de ler", (await chamar("caio", "rede_p4_de_linha", { p_codigo: l.codigo })).comunidades.map((c) => c.slug), ["de-um"]);
  await dono("update interno.rede_comunidades set tipo = 'aberta' where slug = 'de-dois'");
  const colunas = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name like 'rede\\_p4\\_de\\_linha%' order by table_name, ordinal_position")).rows.map((x) => x.column_name);
  igual("linhas: o banco só tem a linha (nenhuma tabela de quem segue)", colunas, ["codigo", "dona", "nome", "filtro", "criada_em"]);
  igual("linhas: só a dona vê as dela", [(await chamar("bia", "rede_p4_de_minhas_linhas")).itens.length, (await chamar("caio", "rede_p4_de_minhas_linhas")).itens.length], [1, 0]);
  await recusa("linhas: outra pessoa não tira", () => chamar("caio", "rede_p4_de_linha_tirar", { p_codigo: l.codigo }), "nao_encontrada");
  // O aparelho de quem segue: a linha entra nas "Minhas linhas" e se atualiza pela regra publicada.
  const ln = await import("../lib/rede/descoberta-estudo/linhas.ts");
  const la = await import("../lib/rede/linha-aberta.ts");
  const falsa = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
  const g = falsa(), gl = falsa();
  const r = ln.seguirLinha(vista, g, gl);
  igual("linhas: seguir põe a linha nas Minhas linhas deste aparelho", la.lerLinhas(gl).map((x) => [x.nome, x.base, x.filtro]), [["Transporte e moradia", "tudo", { tags: ["moradia", "passelivre"], comunidades: ["de-dois", "de-um"] }]]);
  igual("linhas: seguir de novo não duplica", ln.seguirLinha(vista, g, gl), "ja");
  ok("linhas: o código seguido fica numa chave \"lucia…\"", Array.isArray(r) && [...g.m.keys()].every((k) => k.startsWith("lucia:p4-de:")));
  ln.atualizarSeguida(l.codigo, { ...vista, nome: "Transporte", tags: ["passelivre"] }, g, gl);
  igual("linhas: a seguida se atualiza pela regra publicada", la.lerLinhas(gl).map((x) => [x.nome, x.filtro.tags]), [["Transporte", ["passelivre"]]]);
  await passa("linhas: a dona tira", () => chamar("bia", "rede_p4_de_linha_tirar", { p_codigo: l.codigo }));
  await recusa("linhas: tirada, quem seguia recebe nao_encontrada", () => chamar("caio", "rede_p4_de_linha", { p_codigo: l.codigo }), "nao_encontrada");
  ln.atualizarSeguida(l.codigo, null, g, gl);
  igual("linhas: e a linha sai do aparelho de quem seguia", [la.lerLinhas(gl).length, ln.seguidas(g).length], [0, 0]);
  igual("linhas: o código colado (também dentro de um endereço)", [ln.codigoDe("ABCDEF012345"), ln.codigoDe("https://x/descobrir?linha=abcdef012345"), ln.codigoDe("xyz")], ["abcdef012345", "abcdef012345", null]);
}


// ═══ Item 68: correção de referência da redação (a roda anônima já existia; a referência só depois de corrigir) ═══
{
  const semana = (await dono("select interno.semana_atual()::text as s")).rows[0].s;
  await dono("insert into interno.alumia_redacao_temas (semana, titulo) values ($1, 'Os desafios do transporte público nas cidades') on conflict do nothing", [semana]);
  const ficha = { competencias: Array.from({ length: 5 }, (_, i) => ({ nota: 160, comentario: `Na competência ${i + 1}, o texto precisa mostrar domínio e repertório.` })), geral: "Referência para a semana." };
  await recusa("redação: quem não é educadora não escreve a referência", () => chamar("caio", "rede_p4_de_redacao_ref_salvar", { p_semana: semana, p_ficha: ficha }), "sem_permissao");
  if ((await dono("select to_regclass('interno.rede_p4_selos') is not null as t")).rows[0].t) {
    await dono("insert into interno.rede_p4_selos (perfil, tipo) values ($1, 'educadora') on conflict (perfil) do update set tipo = 'educadora'", [P.bia]);
  }
  await recusa("redação: a ficha passa pela régua da roda (nota de 40 em 40)", () => chamar("bia", "rede_p4_de_redacao_ref_salvar", { p_semana: semana, p_ficha: { ...ficha, competencias: ficha.competencias.map((c) => ({ ...c, nota: 150 })) } }), "invalido:nota");
  await passa("redação: a educadora (selo do Prompt 4) escreve", () => chamar("bia", "rede_p4_de_redacao_ref_salvar", { p_semana: semana, p_ficha: ficha }));
  await passa("redação: a coordenação também", () => chamar("ana", "rede_p4_de_redacao_ref_salvar", { p_semana: semana, p_ficha: ficha }));
  igual("redação: a tabela não guarda quem escreveu", (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_de_redacao_ref' order by ordinal_position")).rows.map((x) => x.column_name), ["semana", "ficha", "escrita_em"]);
  const antes = await chamar("caio", "rede_p4_de_redacao_ref", { p_semana: semana });
  igual("redação: antes de corrigir, a pessoa da roda não vê a régua", antes, { existe: true, liberada: false, ficha: null });
  await dono("insert into interno.alumia_redacao_creditos (usuario, semana, feitas) values ($1, $2, 1) on conflict (usuario, semana) do update set feitas = 1", [P.caio, semana]);
  const depois = await chamar("caio", "rede_p4_de_redacao_ref", { p_semana: semana });
  igual("redação: depois de corrigir uma, vê a referência", depois && [depois.liberada, depois.ficha?.competencias.length], [true, 5]);
  semPessoas("redação", depois);
  igual("redação: a educadora vê sempre", (await chamar("bia", "rede_p4_de_redacao_ref", { p_semana: semana })).liberada, true);
  const velha = (await dono("select (interno.semana_atual() - 21)::text as s")).rows[0].s;
  await dono("insert into interno.alumia_redacao_temas (semana, titulo) values ($1, 'Tema antigo para a roda que já fechou') on conflict do nothing", [velha]);
  await chamar("ana", "rede_p4_de_redacao_ref_salvar", { p_semana: velha, p_ficha: ficha });
  igual("redação: com a roda fechada, quem não corrigiu também vê", (await chamar("duda", "rede_p4_de_redacao_ref", { p_semana: velha })).liberada, true);
  const lista = await chamar("duda", "rede_p4_de_redacao_semanas");
  igual("redação: as semanas, com e sem referência", lista.itens.filter((x) => [semana, velha].includes(x.semana)).map((x) => [x.aberta, x.tem_ref]), [[true, true], [false, true]]);
}


// ═══ Item 69: simulado ao vivo da turma (resultado só agregado a partir de 3; as respostas somem) ═══
{
  // Uma turma de 5 (ana cuida) e três questões no banco.
  const turma = (await dono("insert into interno.alumia_turmas (nome, meta, codigo) values ('Turma do cursinho', 'Um simulado por semana', 'turmade001') returning id")).rows[0].id;
  for (const [nome, cuida] of [["ana", true], ["bia", false], ["caio", false], ["duda", false], ["eva", false]]) {
    await dono("insert into interno.alumia_turma_pessoas (turma, usuario, cuida) values ($1, $2, $3)", [turma, P[nome], cuida]);
  }
  const q = [];
  for (const [i, certa] of [2, 0, 1].entries()) {
    q.push((await dono(`insert into interno.rede_questoes (autor, materia, tema, enunciado, alternativas, certa, explicacao) values ($1, 'matematica', 'porcentagem', $2, '["a","b","c","d"]'::jsonb, $3, 'Explicação da questão.') returning id`,
      [P.ana, `Enunciado da questão número ${i + 1}.`, certa])).rows[0].id);
  }
  igual("simulado: a pessoa vê só as turmas dela, sem ninguém", (await chamar("bia", "rede_p4_de_inicio")).turmas, [{ id: turma, nome: "Turma do cursinho", cuido: false }]);
  await recusa("simulado: quem não cuida não abre", () => chamar("bia", "rede_p4_de_simulado_abrir", { p_turma: turma, p_titulo: "Simulado 1", p_questoes: q, p_minutos: 30 }), "sem_permissao");
  await recusa("simulado: menos de 3 questões não", () => chamar("ana", "rede_p4_de_simulado_abrir", { p_turma: turma, p_titulo: "Simulado 1", p_questoes: q.slice(0, 2), p_minutos: 30 }), "invalido:questoes");
  const s = await passa("simulado: quem cuida abre", () => chamar("ana", "rede_p4_de_simulado_abrir", { p_turma: turma, p_titulo: "Simulado 1", p_questoes: q, p_minutos: 30 }));
  await recusa("simulado: um aberto por vez", () => chamar("ana", "rede_p4_de_simulado_abrir", { p_turma: turma, p_titulo: "Simulado 2", p_questoes: q, p_minutos: 30 }), "ja_aberto");
  await recusa("simulado: quem não está na turma não vê", () => chamar("fia", "rede_p4_de_simulados", { p_turma: turma }), "sem_permissao");
  const aberto = (await chamar("bia", "rede_p4_de_simulados", { p_turma: turma })).itens[0];
  ok("simulado: aberto, as questões vêm SEM o gabarito", aberto && !aberto.fechado && aberto.questoes.length === 3 && aberto.questoes.every((x) => !("certa" in x) && !("explicacao" in x)));
  // Só 2 respondem: no fim, nenhuma faixa (menos de 3).
  await chamar("bia", "rede_p4_de_simulado_responder", { p_id: s.id, p_respostas: [2, 0, 1] });
  await chamar("caio", "rede_p4_de_simulado_responder", { p_id: s.id, p_respostas: [0, 0, -1] });
  await recusa("simulado: resposta torta", () => chamar("duda", "rede_p4_de_simulado_responder", { p_id: s.id, p_respostas: [9, 0, 1] }), "invalido:respostas");
  igual("simulado: \"respondi\" é só de quem pergunta", [(await chamar("bia", "rede_p4_de_simulados", { p_turma: turma })).itens[0].respondi, (await chamar("duda", "rede_p4_de_simulados", { p_turma: turma })).itens[0].respondi], [true, false]);
  await passa("simulado: quem cuida encerra", () => chamar("ana", "rede_p4_de_simulado_encerrar", { p_id: s.id }));
  const fechado2 = (await chamar("bia", "rede_p4_de_simulados", { p_turma: turma })).itens[0];
  igual("simulado: com 2 respondendo, nenhuma faixa (nunca abaixo de 3)", [fechado2.fechado, fechado2.resultado, fechado2.questoes.map((x) => x.faixa ?? null)], [true, false, [null, null, null]]);
  igual("simulado: fechado, o gabarito sai (a pessoa confere no aparelho)", fechado2.questoes.map((x) => x.certa), [2, 0, 1]);
  igual("simulado: no fim, as respostas SOMEM", (await dono("select count(*)::int n from interno.rede_p4_de_simulado_respostas where simulado = $1", [s.id])).rows[0].n, 0);
  // Com 4 respondendo, a faixa: questão 1, 3 de 4 certas (maioria acertou); 2, 2 de 4 (metade); 3, 0 de 4 (maioria errou).
  const s2 = await chamar("ana", "rede_p4_de_simulado_abrir", { p_turma: turma, p_titulo: "Simulado 2", p_questoes: q, p_minutos: 15 });
  for (const [nome, r] of [["bia", [2, 0, 0]], ["caio", [2, 0, 0]], ["duda", [2, 1, 0]], ["eva", [0, 1, -1]]]) await chamar(nome, "rede_p4_de_simulado_responder", { p_id: s2.id, p_respostas: r });
  await dono("update interno.rede_p4_de_simulados set fecha = now() - interval '1 minute', abre = now() - interval '20 minutes' where id = $1", [s2.id]);
  const fechado4 = (await chamar("eva", "rede_p4_de_simulados", { p_turma: turma })).itens.find((x) => x.id === s2.id);
  igual("simulado: o prazo passou, fecha sozinho na próxima leitura, com a faixa de cada questão", fechado4 && [fechado4.fechado, fechado4.resultado, fechado4.questoes.map((x) => x.faixa)], [true, true, ["maioria_acertou", "metade", "maioria_errou"]]);
  const r = await chamar("eva", "rede_p4_de_simulados", { p_turma: turma });
  semPessoas("simulado", r);
  ok("simulado: nenhum número de pessoas na resposta", !/"(respondentes|total|pessoas|n)":/.test(JSON.stringify(r)));
  igual("simulado: a tabela de respostas está vazia depois do fim", (await dono("select count(*)::int n from interno.rede_p4_de_simulado_respostas")).rows[0].n, 0);
  await recusa("simulado: fechado não aceita resposta", () => chamar("bia", "rede_p4_de_simulado_responder", { p_id: s2.id, p_respostas: [2, 0, 1] }), "encerrado");
  // O aparelho guarda as respostas da própria pessoa para conferir.
  const sm = await import("../lib/rede/descoberta-estudo/simulado.ts");
  const g = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; })();
  sm.guardarRespostas(s2.id, [2, 1, -1], g);
  igual("simulado: no aparelho, a pessoa confere a dela com o gabarito", sm.acertos(fechado4.questoes, sm.minhasRespostas(s2.id, g)), 1);
  igual("simulado: as respostas do aparelho somem depois de 40 dias", (sm.guardarRespostas("velho", [1], g, Date.now() - 41 * 864e5), sm.minhasRespostas("velho", g)), null);
  await dono("update interno.rede_p4_de_simulados set apagar_em = now() - interval '1 second'");
  await dono("select interno.rede_p4_de_faxina()");
  igual("simulado: 30 dias depois do fim, o simulado some (a faxina)", (await dono("select count(*)::int n from interno.rede_p4_de_simulados")).rows[0].n, 0);
}


// ═══ Item 70: baralhos de revisão (repetição espaçada, o mesmo baralho do site, só no aparelho) ═══
{
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const estudo = await import("../lib/estudo.ts");
  const bx = await import("../lib/rede/descoberta-estudo/baralhos.ts");
  estudo.guardarCartoes([{ frente: "Capital do Acre?", verso: "Rio Branco", origem: "Geografia" }, { frente: "2 + 2?", verso: "4", origem: "Matemática" }, { frente: "3 x 3?", verso: "9", origem: "Matemática" }]);
  const dia = estudo.hoje();
  igual("baralhos: agrupados pela origem, com quantos vencem hoje", bx.baralhos(estudo.lerCartoes(), dia).map((b) => [b.nome, b.hoje, b.total]), [["Matemática", 2, 2], ["Geografia", 1, 1]]);
  igual("baralhos: a fila de hoje mistura os baralhos (o rodízio do site)", bx.filaDeHoje(estudo.lerCartoes(), null, dia).map((c) => c.origem), ["Geografia", "Matemática", "Matemática"]);
  const primeiro = bx.filaDeHoje(estudo.lerCartoes(), "Matemática", dia)[0];
  estudo.responderCartao(primeiro.id, "facil");
  igual("baralhos: \"fácil\" afasta o cartão (sai da fila de hoje)", bx.filaDeHoje(estudo.lerCartoes(), "Matemática", dia).length, 1);
  const outro = bx.filaDeHoje(estudo.lerCartoes(), "Matemática", dia)[0];
  estudo.responderCartao(outro.id, "errei");
  igual("baralhos: \"errei\" volta para hoje", bx.filaDeHoje(estudo.lerCartoes(), "Matemática", dia).map((c) => c.id), [outro.id]);
  igual("baralhos: tudo na chave do site neste aparelho (lucia:revisao), que o Sair rápido apaga", [...m.keys()], ["lucia:revisao"]);
  ok("baralhos: nada vai ao servidor", !/chamar|rpc\(|fetch\(/.test(ler("lib/rede/descoberta-estudo/baralhos.ts") + ler("components/rede/descoberta-estudo/Baralhos.tsx")));
  ok("baralhos: reaproveita o que o site já tem (lib/estudo.ts)", /from "\.\.\/\.\.\/estudo"/.test(ler("lib/rede/descoberta-estudo/baralhos.ts")) && /from "@\/lib\/estudo"/.test(ler("components/rede/descoberta-estudo/Baralhos.tsx")));
  delete globalThis.localStorage;
}


// ═══ Item 71: mentoria entre pares (sem lista de veteranas; só o par se vê) ═══
{
  await recusa("mentoria: conta nova não é veterana", () => chamar("gil", "rede_p4_de_mentoria_oferecer", { p_trilha: "antifascismo", p_vagas: 1 }), "cedo");
  await passa("mentoria: veterana se oferece", () => chamar("bia", "rede_p4_de_mentoria_oferecer", { p_trilha: "antifascismo", p_vagas: 1 }));
  await passa("mentoria: outra veterana também", () => chamar("caio", "rede_p4_de_mentoria_oferecer", { p_trilha: "antifascismo", p_vagas: 1 }));
  igual("mentoria: só \"há ou não há\", nunca quantas", await chamar("gil", "rede_p4_de_mentoria_ha", { p_trilha: "antifascismo" }), { ha: true });
  igual("mentoria: em outra trilha, não há", await chamar("gil", "rede_p4_de_mentoria_ha", { p_trilha: "alemao-basico" }), { ha: false });
  const r = await passa("mentoria: a caloura pede e o banco sorteia", () => chamar("gil", "rede_p4_de_mentoria_pedir", { p_trilha: "antifascismo" }));
  ok("mentoria: o par traz só codinome e @ da outra pessoa", r?.par && ["Codinome bia", "Codinome caio"].includes(r.par.codinome) && ["pessoa_bia", "pessoa_caio"].includes(r.par.handle) && r.par.papel === "caloura");
  semPessoas("mentoria (pedido)", r);
  await recusa("mentoria: a mesma trilha duas vezes não", () => chamar("gil", "rede_p4_de_mentoria_pedir", { p_trilha: "antifascismo" }), "ja_tem");
  const vet = r.par.handle === "pessoa_bia" ? "bia" : "caio";
  const outra = vet === "bia" ? "caio" : "bia";
  const daVet = await chamar(vet, "rede_p4_de_mentorias");
  igual("mentoria: a veterana vê a caloura (codinome e @)", daVet.pares.map((p) => [p.papel, p.codinome, p.handle]), [["veterana", "Codinome gil", "pessoa_gil"]]);
  igual("mentoria: a outra veterana não vê nada do par", (await chamar(outra, "rede_p4_de_mentorias")).pares, []);
  semPessoas("mentoria (lista)", daVet);
  // Vaga 1 ocupada: a próxima caloura cai na outra veterana; sem vaga, nada.
  const r2 = await chamar("duda", "rede_p4_de_mentoria_pedir", { p_trilha: "antifascismo" });
  igual("mentoria: com a vaga ocupada, vai para quem ainda tem vaga", r2.par.handle, `pessoa_${outra}`);
  igual("mentoria: sem vaga, sem par (e sem dizer de quem)", await chamar("eva", "rede_p4_de_mentoria_pedir", { p_trilha: "antifascismo" }), { par: null });
  await passa("mentoria: qualquer uma encerra", () => chamar(vet, "rede_p4_de_mentoria_encerrar", { p_id: daVet.pares[0].id }));
  igual("mentoria: o par encerrado some do banco", (await dono("select count(*)::int n from interno.rede_p4_de_mentorias where caloura = $1", [P.gil])).rows[0].n, 0);
  await recusa("mentoria: quem não é do par não encerra", () => chamar("ana", "rede_p4_de_mentoria_encerrar", { p_id: r2.par.id }), "nao_encontrado");
  igual("mentoria: as tabelas não guardam nada além do par e da oferta", (await dono("select table_name || '.' || column_name c from information_schema.columns where table_schema = 'interno' and table_name in ('rede_p4_de_mentoras', 'rede_p4_de_mentorias') order by table_name, ordinal_position")).rows.map((x) => x.c),
    ["rede_p4_de_mentoras.usuario", "rede_p4_de_mentoras.trilha", "rede_p4_de_mentoras.vagas", "rede_p4_de_mentoras.desde", "rede_p4_de_mentorias.id", "rede_p4_de_mentorias.trilha", "rede_p4_de_mentorias.veterana", "rede_p4_de_mentorias.caloura", "rede_p4_de_mentorias.criada_em"]);
  ok("mentoria: o sorteio usa o gerador do banco (gen_random_uuid), não a ordem de chegada", /order by gen_random_uuid\(\) limit 1/.test(SQL));
}


// ═══ Item 72: estante de fontes com citação pronta (ABNT, só no aparelho) ═══
{
  const fo = await import("../lib/rede/descoberta-estudo/fontes.ts");
  const g = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; })();
  const est = fo.guardarFonte({ tipo: "livro", autores: ["Paulo Freire"], campos: { titulo: "Pedagogia do oprimido", edicao: "17", local: "Rio de Janeiro", editora: "Paz e Terra", ano: "1987" } }, g);
  igual("fontes: a referência da ABNT (a mesma da ferramenta do site)", fo.referenciaTexto(est[0]), "FREIRE, Paulo. Pedagogia do oprimido. 17. ed. Rio de Janeiro: Paz e Terra, 1987.");
  igual("fontes: o título vai em destaque", fo.referenciaHtml(est[0]), "FREIRE, Paulo. <strong>Pedagogia do oprimido</strong>. 17. ed. Rio de Janeiro: Paz e Terra, 1987.");
  igual("fontes: a citação no texto, com e sem página", [fo.citacao(est[0]), fo.citacao(est[0], "45")], ["(FREIRE, 1987)", "(FREIRE, 1987, p. 45)"]);
  const varios = { id: "x", tipo: "artigo", autores: ["Ana Silva", "Bia Souza", "Caio Lima", "Duda Reis"], campos: { titulo: "Um estudo", ano: "2020" } };
  igual("fontes: mais de 3 autorias → et al.", fo.citacao(varios), "(SILVA et al., 2020)");
  igual("fontes: duas autorias com ponto e vírgula", fo.citacao({ ...varios, autores: ["Paulo Freire", "Ira Shor"], campos: { titulo: "Medo e ousadia", ano: "1986" } }), "(FREIRE; SHOR, 1986)");
  igual("fontes: sem título não entra", fo.guardarFonte({ tipo: "livro", autores: [], campos: { titulo: " " } }, g), "titulo");
  fo.guardarFonte({ tipo: "site", autores: ["Instituto Exemplo"], campos: { titulo: "Abaixo-assinado", ano: "2026", url: "https://exemplo.org" }, acesso: "2026-11-20T12:00:00Z" }, g);
  igual("fontes: a lista sai em ordem alfabética", fo.emOrdem(fo.lerFontes(g)).map((f) => f.campos.titulo), ["Abaixo-assinado", "Pedagogia do oprimido"]);
  ok("fontes: página da internet com o \"Acesso em\"", fo.referenciaTexto(fo.lerFontes(g)[1]).includes("Acesso em: 20 nov. 2026"));
  igual("fontes: tudo numa chave \"lucia…\" deste aparelho", [...g.m.keys()], ["lucia:p4-de:fontes"]);
  fo.tirarFonte(est[0].id, g);
  igual("fontes: tirar", fo.lerFontes(g).length, 1);
  ok("fontes: nada vai ao servidor; reaproveita a ABNT do site", !/chamar|rpc\(|fetch\(/.test(ler("lib/rede/descoberta-estudo/fontes.ts") + ler("components/rede/descoberta-estudo/Fontes.tsx")) && /from "\.\.\/\.\.\/ferramentas\/rodada"/.test(ler("lib/rede/descoberta-estudo/fontes.ts")));
}


// ═══ Item 73: trilha de segurança digital em microlições, ligadas às aulas ═══
{
  const mc = await import("../lib/rede/descoberta-estudo/microlicoes.ts");
  const plano = JSON.parse(ler("content/trilhas/autodefesa-digital/plano.json")).map((x) => x.slug);
  igual("microlições: uma para cada aula da trilha, na ordem do plano", mc.MICROLICOES.map((m) => m.aula), plano);
  const prontas = fs.readdirSync(path.join(raiz, "content/trilhas/autodefesa-digital")).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => f.replace(/\.md$/, ""));
  igual("microlições: o link vai para a aula só quando ela existe no site", [...mc.AULAS_PRONTAS].sort(), prontas.filter((s) => plano.includes(s)).sort());
  igual("microlições: o endereço da aula pronta e o da trilha", [mc.enderecoDaAula("pt", "senhas-e-verificacao-em-duas-etapas"), mc.enderecoDaAula("en", "privacidade-nas-redes-sociais")],
    ["/pt/trilhas/autodefesa-digital/senhas-e-verificacao-em-duas-etapas", "/en/trilhas/autodefesa-digital"]);
  ok("microlições: cada uma com 3 pontos e uma pergunta de resposta válida", mc.MICROLICOES.every((m) => m.pontos.length === 3 && m.pergunta.opcoes.length >= 2 && m.pergunta.certa >= 0 && m.pergunta.certa < m.pergunta.opcoes.length && m.pergunta.porque));
  const g = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; })();
  mc.marcarFeita("golpes-pelo-celular-como-reconhecer", true, g);
  mc.marcarFeita("nao-existe", true, g);
  igual("microlições: o feito fica no aparelho, só com aulas da trilha", [mc.feitas(g), [...g.m.keys()]], [["golpes-pelo-celular-como-reconhecer"], ["lucia:p4-de:microlicoes"]]);
  ok("microlições: nada vai ao servidor", !/chamar|rpc\(|fetch\(/.test(ler("lib/rede/descoberta-estudo/microlicoes.ts") + ler("components/rede/descoberta-estudo/Microlicoes.tsx")));
}


// ═══ Item 101: calendário de inscrições (sobre a agenda de provas da onda 11: fonte oficial obrigatória, lembrete 7 e 1 dia antes) ═══
{
  const ins = await import("../lib/rede/descoberta-estudo/inscricoes.ts");
  igual("inscrições: os cinco programas, cada um com a página oficial em gov.br", ins.PROGRAMAS.map((p) => [p.nome, /^https:\/\/(www\.gov\.br\/inep|acessounico\.mec\.gov\.br)\//.test(p.oficial)]),
    [["ENEM", true], ["SISU", true], ["ProUni", true], ["FIES", true], ["Encceja", true]]);
  igual("inscrições: o programa pelo nome do exame", ["ENEM 2027", "Sisu 2027", "ProUni 1/2027", "FIES", "Encceja Nacional", "Fuvest"].map((e) => ins.programaDe(e)?.chave ?? null), ["enem", "sisu", "prouni", "fies", "encceja", null]);
  const datas = [
    { id: "a", exame: "SISU 2027", etapa: "Inscrições", dia: "2027-01-20", hora: null, orgao: "MEC", fonte: "https://acessounico.mec.gov.br/sisu", conferido_em: "2026-11-20", assinada: false },
    { id: "b", exame: "ENEM 2026", etapa: "Segundo dia", dia: "2026-11-15", hora: "13:30", orgao: "Inep", fonte: "https://www.gov.br/inep", conferido_em: "2026-11-01", assinada: false },
    { id: "c", exame: "Fuvest 2027", etapa: "Primeira fase", dia: "2026-12-01", hora: null, orgao: "Fuvest", fonte: "https://www.fuvest.br", conferido_em: "2026-11-01", assinada: false },
  ];
  const g = ins.porPrograma(datas, "2026-11-21");
  igual("inscrições: todo programa aparece; só datas de hoje em diante; vestibular fica fora", g.map((x) => [x.programa.chave, x.datas.map((d) => d.id)]), [["enem", []], ["sisu", ["a"]], ["prouni", []], ["fies", []], ["encceja", []]]);
  igual("inscrições: destaca as etapas de inscrição", [ins.ehInscricao("Inscrições"), ins.ehInscricao("Período de matrícula"), ins.ehInscricao("Primeira fase")], [true, true, false]);
  // A regra que já existia (onda 11): sem fonte oficial não entra, e a assinatura é o lembrete. Prova no banco.
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [P.ana]);
  const hoje = (await dono("select interno.alumia_o11t_hoje()::text as d")).rows[0].d;
  const daqui = (n) => new Date(Date.parse(`${hoje}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  await recusa("inscrições: sem a fonte oficial em https, a data não entra (regra da onda 11)", () => chamar("ana", "alumia_agenda_salvar", { p_id: null, p: { exame: "SISU 2027", etapa: "Inscrições", dia: daqui(60), hora: "", orgao: "MEC", fonte: "http://qualquer", conferido_em: hoje } }), "invalido:fonte");
  const d = await passa("inscrições: com a fonte oficial e o dia da conferência, entra", () => chamar("ana", "alumia_agenda_salvar", { p_id: null, p: { exame: "SISU 2027", etapa: "Inscrições", dia: daqui(60), hora: "", orgao: "MEC", fonte: "https://acessounico.mec.gov.br/sisu", conferido_em: hoje } }));
  await recusa("inscrições: quem não cuida não põe data", () => chamar("caio", "alumia_agenda_salvar", { p_id: null, p: { exame: "FIES", etapa: "Inscrições", dia: daqui(60), hora: "", orgao: "MEC", fonte: "https://acessounico.mec.gov.br/fies", conferido_em: hoje } }), "sem_permissao");
  await passa("inscrições: a pessoa pede o lembrete", () => chamar("caio", "alumia_agenda_assinar", { p_datas: [d.id], p_sim: true }));
  igual("inscrições: o lembrete guarda só (data, pessoa) e os dois avisos", (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'alumia_agenda_assinaturas' order by ordinal_position")).rows.map((x) => x.column_name), ["data", "usuario", "avisado_7", "avisado_1", "desde"]);
  const vista = await chamar("caio", "alumia_agenda_datas");
  igual("inscrições: a data volta com a fonte, a conferência e o \"assinada\" de quem vê", vista.itens.filter((x) => x.id === d.id).map((x) => [x.exame, x.fonte, x.assinada]), [["SISU 2027", "https://acessounico.mec.gov.br/sisu", true]]);
  ok("inscrições: a tela só lê pela agenda que já existe (nenhuma data inventada no código)", /agenda\.datas\(\)/.test(ler("components/rede/descoberta-estudo/Inscricoes.tsx")) && !/\d{4}-\d{2}-\d{2}/.test(ler("lib/rede/descoberta-estudo/inscricoes.ts")));
}


// ═══ Item 102: mural de editais e bolsas (não diz quem propôs; a coordenação confere) ═══
{
  const daqui = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const pedido = { titulo: "Bolsa de extensão em comunicação popular", orgao: "Universidade Federal", tipo: "bolsa", link: "https://ufexemplo.edu.br/edital-12", prazo: daqui(20), resumo: "Para estudantes de escola pública." };
  await recusa("editais: link sem https não", () => chamar("caio", "rede_p4_de_edital_propor", { p: { ...pedido, link: "http://ufexemplo.edu.br" } }), "invalido:link");
  await recusa("editais: link com usuário e senha não", () => chamar("caio", "rede_p4_de_edital_propor", { p: { ...pedido, link: "https://a:b@ufexemplo.edu.br" } }), "invalido:link");
  await recusa("editais: prazo que já passou não", () => chamar("caio", "rede_p4_de_edital_propor", { p: { ...pedido, prazo: daqui(-1) } }), "invalido:prazo");
  await recusa("editais: tipo fora da lista não", () => chamar("caio", "rede_p4_de_edital_propor", { p: { ...pedido, tipo: "rifa" } }), "invalido:tipo");
  const e = await passa("editais: quem é da Alumia propõe", () => chamar("caio", "rede_p4_de_edital_propor", { p: pedido }));
  igual("editais: proposto ainda não aparece no mural", (await chamar("duda", "rede_p4_de_editais", { p_tipo: null })).itens, []);
  igual("editais: quem não cuida não vê a fila", (await chamar("duda", "rede_p4_de_editais", { p_tipo: null })).fila, []);
  const daCoord = await chamar("ana", "rede_p4_de_editais", { p_tipo: null });
  igual("editais: a coordenação vê a fila", daCoord.fila.map((x) => x.id), [e.id]);
  semPessoas("editais (fila)", daCoord);
  igual("editais: a tabela não guarda quem propôs nem quem publicou", (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_de_editais' order by ordinal_position")).rows.map((x) => x.column_name),
    ["id", "titulo", "orgao", "tipo", "link", "prazo", "resumo", "situacao", "criado_em", "apagar_em"]);
  await recusa("editais: quem não cuida não publica", () => chamar("caio", "rede_p4_de_edital_decidir", { p_id: e.id, p_publicar: true }), "sem_permissao");
  await passa("editais: a coordenação publica", () => chamar("ana", "rede_p4_de_edital_decidir", { p_id: e.id, p_publicar: true }));
  const mural = await chamar("duda", "rede_p4_de_editais", { p_tipo: "bolsa" });
  igual("editais: publicado aparece no mural, com o link oficial", mural.itens.map((x) => [x.titulo, x.link, x.situacao]), [[pedido.titulo, pedido.link, "publicado"]]);
  igual("editais: o filtro por tipo", (await chamar("duda", "rede_p4_de_editais", { p_tipo: "curso" })).itens, []);
  semPessoas("editais (mural)", mural);
  await dono("update interno.rede_p4_de_editais set prazo = current_date - 1 where id = $1", [e.id]);
  igual("editais: passado o prazo, sai do mural", (await chamar("duda", "rede_p4_de_editais", { p_tipo: null })).itens, []);
  await dono("update interno.rede_p4_de_editais set apagar_em = current_date - 1 where id = $1", [e.id]);
  await dono("select interno.rede_p4_de_faxina()");
  igual("editais: 30 dias depois do prazo, some do banco (a faxina)", (await dono("select count(*)::int n from interno.rede_p4_de_editais where id = $1", [e.id])).rows[0].n, 0);
  for (let i = 0; i < 5; i++) await rpc(como("eva"), "rede_p4_de_edital_propor", { p: { ...pedido, titulo: `Edital de teste número ${i}` } }).catch(() => null);
  await recusa("editais: limite de propostas por conta (5 por hora)", () => rpc(como("eva"), "rede_p4_de_edital_propor", { p: pedido }), "muitos_pedidos");
}


// ═══ Item 103: glossário ao toque (o glossário do site, sem serviço de fora) ═══
{
  const gl = await import("../lib/rede/descoberta-estudo/glossario.ts");
  const termos = [
    { slug: "acido", termo: "Ácido", resumo: "Substância que, na água, libera íons de hidrogênio." },
    { slug: "acao-afirmativa", termo: "Ação afirmativa", resumo: "Política que corrige desigualdades históricas." },
    { slug: "acao", termo: "Ação", resumo: "Um termo curto que não deve engolir o comprido." },
  ];
  const p = gl.marcarTermos("A ação afirmativa e o acido. Outra AÇÃO AFIRMATIVA não marca de novo; transação não é ação.", termos);
  igual("glossário: marca a primeira aparição, o termo mais comprido primeiro, sem ligar para acento e maiúscula",
    p.filter((x) => x.termo).map((x) => [x.texto, x.termo.slug]), [["ação afirmativa", "acao-afirmativa"], ["acido", "acido"], ["ação", "acao"]]);
  igual("glossário: o texto volta inteiro, como estava", p.map((x) => x.texto).join(""), "A ação afirmativa e o acido. Outra AÇÃO AFIRMATIVA não marca de novo; transação não é ação.");
  ok("glossário: palavra dentro de outra não marca (transação)", !p.some((x) => x.termo && x.texto === "ação" && p.indexOf(x) < 4));
  igual("glossário: a busca começa pelo que começa com o digitado", gl.buscarTermos(termos, "aca").map((x) => x.slug), ["acao-afirmativa", "acao"]);
  const rota = ler("app/api/rede/glossario/[lang]/route.ts");
  ok("glossário: a lista vem do glossário do site, estática, atrás da flag", /getGlossary\(lang\)/.test(rota) && /dynamic = "force-static"/.test(rota) && /ligado\("alumia-p4-descoberta-estudo"\)/.test(rota));
  ok("glossário: a rota só entrega slug, termo e resumo", /\(\{ slug: t\.slug, termo: t\.term, resumo: /.test(rota));
  const tela = ler("components/rede/descoberta-estudo/Glossario.tsx");
  ok("glossário: o aparelho só pede à rota do nosso servidor", (tela.match(/fetch\(/g) ?? []).length === 1 && /fetch\(`\/api\/rede\/glossario\//.test(tela));
  ok("glossário: as microlições usam o glossário ao toque", /<TextoComGlossario /.test(ler("components/rede/descoberta-estudo/Microlicoes.tsx")));
  ok("glossário: o termo é um botão (toque e teclado), com aria-expanded", /<button type="button" className="de-termo-botao" aria-expanded=\{aberto\}/.test(tela));
}


// ═══ A tela: flag, rotas, painel, registro, menu, textos ═══
ok("a flag existe em RECURSOS", FLAG in RECURSOS);
ok("a flag é só pelo nome", SO_PELO_NOME.includes(FLAG));
igual("\"todos\" não liga o lote (desligado por padrão)", ligado(FLAG, lerRecursos("todos")), false);
igual("o nome liga", ligado(FLAG, lerRecursos(`todos,${FLAG}`)), true);
for (const nome of ["descobrir", "estudar"]) {
  const rota = ROTAS_NOVAS.find((r) => r.nome === nome);
  igual(`a rota /${nome} está em ROTAS_NOVAS com a flag e sem indexar`, rota && [rota.caminho, rota.flag, rota.indexar], [`/${nome}`, FLAG, false]);
  const pagina = existe(`app/[lang]/alumia/${nome}/page.tsx`) ? ler(`app/[lang]/alumia/${nome}/page.tsx`) : "";
  ok(`/${nome}: a página passa pela PaginaNova (404 com a flag desligada)`, pagina.includes(`metadadosDaRotaNova("${nome}"`) && pagina.includes(`<PaginaNova nome="${nome}"`));
  ok(`/${nome}: o host próprio conhece a rota`, new RegExp(`"${nome}"`).test(ler("lib/rede/alumia.ts")));
}
ok("as telas estão no registro com import dinâmico", /descobrir: \{ componente: dynamic\(\(\) => import\("\.\/descoberta-estudo\/TelaDeDescobrir"\), \{ ssr: false \}\)/.test(ler("components/rede/registro.tsx"))
  && /estudar: \{ componente: dynamic\(\(\) => import\("\.\/descoberta-estudo\/TelaDeEstudar"\), \{ ssr: false \}\)/.test(ler("components/rede/registro.tsx")));
ok("o painel único descreve o interruptor", /"alumia-p4-descoberta-estudo": \{ nome: "[^"]+", sobre: "[^"]+" \}/.test(ler("components/painel/alumia/nomes-das-funcoes.ts")));
ok("o menu só ganha os itens com a rota ligada", /!rotaNovaLigada\("descobrir"\) \? \{\} :/.test(ler("components/rede/descoberta-estudo/encaixe.tsx")) && /perto, descobertaEstudo, protecao,/.test(ler("components/rede/encaixes.tsx")));
{
  const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  const lerJson = (c) => (existe(c) ? JSON.parse(ler(c)) : {});
  const textos = Object.fromEntries(idiomas.map((l) => [l, lerJson(`i18n/rede/p4-descoberta-estudo/${l}.json`)]));
  const marcas = (o) => Object.fromEntries(chaves(o).map((k) => [k, (String(k.split(".").reduce((x, y) => x?.[y], o)).match(/\{\w+\}/g) ?? []).sort().join()]));
  for (const l of idiomas) {
    igual(`textos ${l}: as mesmas chaves do português`, chaves(textos[l]).filter((k) => !chaves(textos.pt).includes(k)).concat(chaves(textos.pt).filter((k) => !chaves(textos[l]).includes(k))), []);
    ok(`textos ${l}: ${l === "pt" ? "sem" : "com"} a marca de rascunho`, l === "pt" ? !("_rascunho" in textos[l]) : textos[l]._rascunho === true);
    const mp = marcas(textos.pt), ml = marcas(textos[l]);
    igual(`textos ${l}: os mesmos marcadores {x}`, Object.keys(mp).filter((k) => mp[k] !== ml[k]), []);
    const onda5 = lerJson(`i18n/rede/onda5/${l}.json`);
    ok(`onda5 ${l}: título e descrição das duas telas`, !!onda5.telas?.descobrir?.titulo && !!onda5.telas?.estudar?.descricao);
  }
  ok("o pacote de textos não promete cifra (nada daqui é cifrado)", !/cifrad[oa] de ponta/i.test(JSON.stringify(textos.pt)));
}
{
  // Nada vai a terceiros pelo navegador: a tela só fala com o banco (pelo cliente) e com rotas do nosso servidor.
  const pastas = ["components/rede/descoberta-estudo", "lib/rede/descoberta-estudo"];
  const fontes = pastas.flatMap((p) => (existe(p) ? fs.readdirSync(path.join(raiz, p)).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => [`${p}/${f}`, ler(`${p}/${f}`)]) : []));
  ok("a pasta da tela existe", fontes.length >= 4);
  const navegador = fontes.filter(([f]) => !f.endsWith("servidor.ts"));
  const fetches = navegador.flatMap(([f, t]) => [...t.matchAll(/fetch\(\s*([`"'][^`"']*)/g)].map((m) => `${f}:${m[1]}`));
  igual("o aparelho só pede às rotas do nosso servidor (/api/...)", fetches.filter((x) => !/:[`"']\/api\//.test(x)), []);
  ok("nenhum iframe, embed ou player de fora", navegador.every(([, t]) => !/<iframe|<embed|<object/i.test(t)));
  ok("nada de Math.random", fontes.every(([, t]) => !/Math\.random/.test(t)));
  ok("o que fica no aparelho usa chaves \"lucia…\" (o Sair rápido apaga)", navegador.every(([, t]) => [...t.matchAll(/(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)/g)].every((m) => m[1].startsWith("lucia"))));
}
ok("o e2e do lote existe (computador e 390 px)", existe("e2e/p4-descoberta-estudo.spec.ts") && /\["390 px", 390\]/.test(ler("e2e/p4-descoberta-estudo.spec.ts")));

ok("o script está no package.json", /"testar:p4-descoberta-estudo": "node [^"]*scripts\/testar-p4-descoberta-estudo\.mjs"/.test(ler("package.json")));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
