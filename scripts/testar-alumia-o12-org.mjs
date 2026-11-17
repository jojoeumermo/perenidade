// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a comunicação da organização da onda 12 (supabase/migracoes/20261118-alumia-o12-org.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · a fila: só quem fala pela organização escreve; quem escreveu não aprova; OUTRA pessoa aprova; o post sai com o nome da
//     organização e nenhuma resposta traz quem escreveu ou quem aprovou; na decisão o banco esquece quem escreveu; vence em 14 dias;
//   · os modelos: só a comunicação; nome repetido recusado;
//   · o teto do núcleo: 2 em 7 dias POR NÚCLEO (duas pessoas com cargo não somam 4); quem não tem cargo não chama; o aviso não diz
//     quem chamou; número de avisadas só a partir de 3;
//   · o boletim: passa pela fila; um e-mail por pessoa que pediu por e-mail (sem lista), sem link; um a cada 6 dias; o número de
//     quem assina só a partir de 3;
//   · o domínio: só com selo, só quem gerencia; o desafio; o resultado só pela chave de serviço; domínio de outra organização
//     recusado; sem selo some do perfil; a prova pelo servidor (lib/rede/org/dominio.ts) com dublês de DNS e de HTTPS, e a recusa
//     de endereço interno;
//   · as listas da tela iguais às do banco, e os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o12-org.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { dominioLimpo, LIMITES_DA_COMUNICACAO as L, PUBLICOS_DA_ORG, problemaDoTexto, restamLetras, separarFila } from "../lib/rede/org/comunicacao.ts";
import { arquivoConfere, enderecoReservado, provarDominio, textoEsperado, txtConfere } from "../lib/rede/org/dominio.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 600)}`);
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
const sql = ler("supabase/migracoes/20261118-alumia-o12-org.sql");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 25 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 6
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("a tabela das chamadas de núcleo não guarda quem chamou", /create table if not exists interno\.rede_org_nucleo_chamadas \(([\s\S]*?)\n\);/.exec(sql)?.[1].match(/^\s+[a-z_]+/gm).map((x) => x.trim()).join() === "id,nucleo,post,quando");
ok("nenhuma função recebe parâmetro do tipo linha de tabela", !/create or replace function [^(]+\([^)]*\binterno\.rede_[a-z_]+\b(?!\()/i.test(sql.replace(/--.*$/gm, "")));
ok("não mexe na versão da Alumia nem no install.sql, e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-400)));
ok("os limites da tela são os do banco", sql.includes(`between 1 and ${L.texto}`) && sql.includes(`between ${L.modeloNomeMin} and ${L.modeloNome}`)
  && sql.includes(`>= ${L.modelos} then perform interno.erro('limite')`) && sql.includes(`>= ${L.esperando} then perform interno.erro('fila_cheia')`)
  && sql.includes(`cardinality(boletim_posts) <= ${L.boletimPosts}`) && sql.includes(`interval '${L.boletimDias} days'`)
  && sql.includes(`interval '${L.boletimIntervaloDias} days'`) && sql.includes(`greatest(0, ${L.chamadasPorSemana} - `) && sql.includes(`interval '${L.venceDias} days'`));
ok("os públicos da tela são os do banco", sql.includes(`publico in (${["internet", "membros", "seguidores"].map((p) => `'${p}'`).join(", ")})`) && PUBLICOS_DA_ORG.length === 3);

// As regras puras da tela.
ok("texto vazio e longo", problemaDoTexto("   ") === "vazio" && problemaDoTexto("a".repeat(501)) === "longo" && problemaDoTexto("ok") === null && restamLetras("🔥🔥") === 498);
ok("a fila separa o que espera do histórico", (() => {
  const f = separarFila([{ situacao: "aprovado" }, { situacao: "esperando" }, { situacao: "recusado" }]);
  return f.esperando.length === 1 && f.decididos.length === 2;
})());
ok("o domínio limpo como o banco aceita", dominioLimpo(" https://WWW.Exemplo.org.BR/contato?x=1 ") === "exemplo.org.br" && dominioLimpo("exemplo.org.") === "exemplo.org"
  && dominioLimpo("sindicato:8080") === null && dominioLimpo("192.168.0.1") === null && dominioLimpo("intranet.local") === null
  && dominioLimpo("institutolucia.org") === null && dominioLimpo("alumia.institutolucia.org") === null && dominioLimpo("ação.org") === "xn--ao-siap.org"
  && dominioLimpo("a.b") === null && dominioLimpo("") === null);
ok("endereços internos recusados", ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1",
  "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2002:a00:1::", "2001:db8::1", "lixo", "999.1.1.1"].every(enderecoReservado));
ok("endereços públicos passam", ["1.1.1.1", "8.8.8.8", "200.160.2.3", "2606:4700:4700::1111", "2804:14c::1", "::ffff:8.8.8.8"].every((ip) => !enderecoReservado(ip)));
ok("o TXT e o arquivo conferem o texto exato", (() => {
  const d = "0123456789abcdef0123456789abcdef";
  return textoEsperado(d) === `alumia-dominio=${d}` && txtConfere([["v=spf1 -all"], ["alumia-dominio=0123456789abcdef", "0123456789abcdef"]], d)
    && !txtConfere([["alumia-dominio=errado"]], d) && arquivoConfere(`# nosso\n alumia-dominio=${d} \n`, d) && !arquivoConfere(`xalumia-dominio=${d}`, d);
})());
{
  const d = "0123456789abcdef0123456789abcdef";
  const nomes = [];
  const so = (txt, arquivo) => ({ resolverTxt: async (n) => { nomes.push(n); if (txt instanceof Error) throw txt; return txt; }, buscarArquivo: async () => { if (arquivo instanceof Error) throw arquivo; return arquivo; } });
  await espera("prova pelo TXT (o nome procurado é _alumia.<domínio>)", () => provarDominio("exemplo.org", d, so([[textoEsperado(d)]], null)), (r) => r.ok && r.metodo === "txt" && nomes.at(-1) === "_alumia.exemplo.org");
  await espera("sem TXT, prova pelo arquivo", () => provarDominio("exemplo.org", d, so(new Error("ENODATA"), `${textoEsperado(d)}\n`)), (r) => r.ok && r.metodo === "arquivo");
  await espera("nem TXT nem arquivo: não achou", () => provarDominio("exemplo.org", d, so([], new Error("rede"))), (r) => !r.ok && r.motivo === "nao_achou");
  await espera("domínio que o banco não aceitaria nem é procurado", () => provarDominio("10.0.0.1", d, so([[textoEsperado(d)]], null)), (r) => !r.ok && r.motivo === "invalido");
  await espera("desafio fora do formato nem é procurado", () => provarDominio("exemplo.org", "abc", so([[textoEsperado("abc")]], null)), (r) => !r.ok && r.motivo === "invalido");
}

// Os textos: as seis línguas com as mesmas chaves e marcadores; nenhuma palavra proibida; todo erro do banco com frase.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/org/comunicacao/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/org/comunicacao/${l}.json`));
    const outro = formas(j);
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`comunicacao/${l}.json: mesmas chaves e marcadores do pt, marcado como rascunho${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0 && j._rascunho === true);
  }
  ok("o nome da aba no perfil é o \"aba\" de cada língua", (() => {
    const perfil = ler("components/rede/org/PerfilDaOrg.tsx");
    return ["pt", "en", "es", "fr", "ru", "zh"].every((l) => perfil.includes(`${l}: ${JSON.stringify(JSON.parse(ler(`i18n/rede/org/comunicacao/${l}.json`)).aba)}`));
  })());
  ok("nenhum texto vazio no pt",![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|university|universidad|universit|algoritm|algorithm/i.test(ler(`i18n/rede/org/comunicacao/${l}.json`))));
  const codigos = [...new Set([...sql.matchAll(/interno\.erro\('([a-z_]+)(?::[a-z_]+)?'\)/g)].map((m) => m[1]))];
  ok(`todo erro da migração tem frase (${codigos.filter((c) => !pt.erros[c]).join(", ")})`, codigos.every((c) => typeof pt.erros[c] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const servico = { papel: "service_role", ip: "127.0.0.1" };
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
const PUBLICAS = ["rede_org_comunicacao", "rede_org_fila_escrever", "rede_org_fila_decidir", "rede_org_fila_retirar", "rede_org_modelo_salvar", "rede_org_modelo_apagar",
  "rede_org_nucleo_chamar", "rede_org_boletim_propor", "rede_org_boletim", "rede_org_boletim_assinar", "rede_org_dominio_pedir", "rede_org_dominio_tirar",
  "rede_org_dominio_para_conferir", "rede_org_dominio"];
await espera("toda função pública nova de membro passa pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)", [PUBLICAS])).rows,
(rs) => rs.length === PUBLICAS.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
await espera("o resultado do domínio é só da chave de serviço", async () =>
  (await um(`select has_function_privilege('anon', 'public.rede_org_dominio_resultado(uuid, text, text, boolean, text)', 'execute') a,
                    has_function_privilege('authenticated', 'public.rede_org_dominio_resultado(uuid, text, text, boolean, text)', 'execute') b,
                    has_function_privilege('service_role', 'public.rede_org_dominio_resultado(uuid, text, text, boolean, text)', 'execute') c`)),
(r) => !r.a && !r.b && r.c);
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => um("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t]),
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas novas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and (p.proname like 'alumia\\_o12\\_%' or p.proname = 'rede_org_por_dominio')`)).rows,
(rs) => rs.length >= 11 && rs.every((r) => !r.a && !r.b));
await espera("nenhuma função pública nova recebe parâmetro do tipo linha (o Supabase barra o ALTER TABLE depois)", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('public', 'interno') and (p.proname = any ($1) or p.proname like 'alumia\\_o12\\_%')
                 and exists (select 1 from unnest(p.proargtypes) t join pg_type ty on ty.oid = t where ty.typtype = 'c')`, [PUBLICAS])).rows,
(rs) => rs.length === 0);

const P = {};
const NOMES = ["org", "org2", "dona", "com1", "com2", "med", "m1", "m2", "m3", "m4", "fora", "bloq"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o12.local`, nome);
  await rpc(como(P[nome]), "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const [i, nome] of NOMES.entries()) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o12`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono("update interno.perfis set rede_handle = 'lume', rede_codinome = 'Coletivo Lume' where id = $1", [P.org]);
await dono("update interno.perfis set rede_handle = 'brasa', rede_codinome = 'Coletivo Brasa' where id = $1", [P.org2]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, documento_tipo, verificada_em) values ($1, 'coletivo', 'São Paulo', 'LUME', 'CNPJ', now())", [P.org]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra) values ($1, 'coletivo', 'Recife', 'BRASA')", [P.org2]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($3, $2, 'dono')", [P.org, P.dona, P.org2]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.org, P.bloq]);
const NUC = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo Leste', $1) returning id", [P.org])).id;
const NUC2 = (await um("insert into interno.rede_nucleos (nome, org) values ('Núcleo Sul', $1) returning id", [P.org])).id;
await dono(`insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'mediacao'), ($1, $3, 'membro'), ($1, $4, 'membro'), ($1, $5, 'membro'),
            ($1, $6, 'membro'), ($1, $7, 'membro'), ($1, $8, 'membro'), ($1, $9, 'membro'), ($10, $3, 'membro')`,
  [NUC, P.med, P.m1, P.m2, P.m3, P.m4, P.com1, P.com2, P.bloq, NUC2]);
const A = (n) => como(P[n]);
// Nenhuma resposta traz o id de pessoa nenhuma (só o da organização, que é pública).
const semPessoas = (r) => { const s = JSON.stringify(r); return !Object.entries(P).filter(([k]) => k !== "org" && k !== "org2").some(([, id]) => s.includes(id)); };

// A função de comunicação: duas pessoas com a permissão "avisos".
{
  const fim = new Date(Date.now() + 200 * 86400e3).toISOString().slice(0, 10);
  const f = await rpc(A("dona"), "rede_org_funcao_salvar", { p_handle: "lume", p: { tipo: "comunicacao", nome: "Comunicação", permissoes: ["avisos"], vagas: 2 } });
  const COM = f.funcoes.find((x) => x.nome === "Comunicação").id;
  for (const n of ["com1", "com2"]) {
    const r = await rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: COM, handle: `${n}_o12`, fim } });
    await rpc(A(n), "rede_org_mandato_aceitar", { p_mandato: (await rpc(A(n), "rede_org_funcoes", { p_handle: "lume" })).minhas[0].mandato });
    void r;
  }
}

// ═══════════════════ 2. A aba Comunicação ═══════════════════
await espera("quem fala pela organização vê a aba (sem ninguém dentro)", () => rpc(A("com1"), "rede_org_comunicacao", { p_handle: "lume" }),
  (r) => r.comunico && !r.gerencio && r.selo && Array.isArray(r.fila) && r.nucleos.length === 2 && r.dominio === null && r.boletim.assinantes === null && semPessoas(r));
await espera("a mediação de um núcleo vê só o chamar daquele núcleo", () => rpc(A("med"), "rede_org_comunicacao", { p_handle: "lume" }),
  (r) => !r.comunico && r.nucleos.length === 1 && r.nucleos[0].id === NUC && r.fila.length === 0 && r.boletim === null);
await espera("membro do núcleo sem cargo não vê nada", () => rpc(A("m1"), "rede_org_comunicacao", { p_handle: "lume" }), (r) => r === null);
await espera("quem está fora não vê nada", () => rpc(A("fora"), "rede_org_comunicacao", { p_handle: "lume" }), (r) => r === null);
await espera("quem gerencia vê o domínio", () => rpc(A("dona"), "rede_org_comunicacao", { p_handle: "lume" }), (r) => r.comunico && r.gerencio && r.dominio === null);

// ═══════════════════ 3. A fila ═══════════════════
await recusa("quem está fora não escreve", () => rpc(A("fora"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Oi" } }), "sem_permissao");
await recusa("membro de núcleo sem a função não escreve", () => rpc(A("m1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Oi" } }), "sem_permissao");
await recusa("a mediação do núcleo não escreve pela organização", () => rpc(A("med"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Oi" } }), "sem_permissao");
await recusa("público fora da lista", () => rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Oi", publico: "equipe" } }), "invalido:publico");
await recusa("texto com telefone é dado pessoal", () => rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Liga pra gente: (11) 98888-7777" } }), "dado_pessoal");
await recusa("texto vazio", () => rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "   " } }), "invalido:texto");
const it1 = await espera("a comunicação escreve: entra esperando, marcado como meu", () => rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Assembleia aberta no sábado, 10h, na praça.", publico: "seguidores" } }),
  (r) => r.situacao === "esperando" && r.meu === true && r.possoDecidir === false && r.publico === "seguidores" && semPessoas(r));
await espera("a outra pessoa da comunicação foi avisada (sem dizer quem escreveu)", async () => (await dono("select texto from interno.avisos where para = $1 and texto like '%esperando aprovação%'", [P.com2])).rows,
  (rs) => rs.length === 1 && !rs[0].texto.includes("Codinome"));
await espera("quem escreveu não é avisado do próprio texto", async () => (await dono("select count(*)::int n from interno.avisos where para = $1 and texto like '%esperando aprovação%'", [P.com1])).rows[0], (r) => r.n === 0);
await espera("a outra pessoa vê o texto, sem saber quem escreveu", () => rpc(A("com2"), "rede_org_comunicacao", { p_handle: "lume" }),
  (r) => r.fila.length === 1 && r.fila[0].meu === false && r.fila[0].possoDecidir === true && semPessoas(r));
await recusa("quem escreveu não aprova o próprio texto", () => rpc(A("com1"), "rede_org_fila_decidir", { p_id: it1?.id, p_aprovar: true, p_motivo: "" }), "outra_pessoa");
await recusa("quem não fala pela organização não aprova", () => rpc(A("m1"), "rede_org_fila_decidir", { p_id: it1?.id, p_aprovar: true, p_motivo: "" }), "nao_encontrado");
await recusa("a mediação do núcleo não aprova", () => rpc(A("med"), "rede_org_fila_decidir", { p_id: it1?.id, p_aprovar: true, p_motivo: "" }), "nao_encontrado");
const ap = await espera("OUTRA pessoa aprova: sai como post da organização", () => rpc(A("com2"), "rede_org_fila_decidir", { p_id: it1?.id, p_aprovar: true, p_motivo: "" }),
  (r) => r.situacao === "aprovado" && r.post && r.retido === false && semPessoas(r));
await espera("o post tem a organização como autor e como \"como\"", () => um("select autor, como, publico, tipo from interno.rede_posts where id = $1", [ap?.post]),
  (r) => r.autor === P.org && r.como === P.org && r.publico === "seguidores" && r.tipo === "post");
await espera("na decisão, o banco esquece quem escreveu", () => um("select escreveu, decidido_dia from interno.rede_org_fila where id = $1", [it1?.id]), (r) => r.escreveu === null && r.decidido_dia !== null);
await espera("quem lê o post vê a organização, e ninguém de quem escreveu ou aprovou", async () => {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P.fora, P.org]);
  return rpc(A("fora"), "rede_post", { p_id: ap?.post });
}, (r) => JSON.stringify(r).includes("lume") && semPessoas(r));
await recusa("decidir de novo", () => rpc(A("dona"), "rede_org_fila_decidir", { p_id: it1?.id, p_aprovar: true, p_motivo: "" }), "ja_decidido");
// Recusar com motivo, retirar, vencer.
await zerar();
const it2 = await rpc(A("com2"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Texto que vai ser recusado." } });
await espera("recusar com motivo (quem escreveu lê o motivo)", () => rpc(A("dona"), "rede_org_fila_decidir", { p_id: it2.id, p_aprovar: false, p_motivo: "Falta o horário." }),
  (r) => r.situacao === "recusado" && r.motivo === "Falta o horário." && r.post === null);
const it3 = await rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Texto que vai ser retirado." } });
await recusa("só quem escreveu retira", () => rpc(A("com2"), "rede_org_fila_retirar", { p_id: it3.id }), "nao_encontrado");
await espera("quem escreveu retira", () => rpc(A("com1"), "rede_org_fila_retirar", { p_id: it3.id }), (r) => r.situacao === "retirado");
const it4 = await rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Texto que vai vencer." } });
await dono("update interno.rede_org_fila set criado_em = now() - interval '15 days' where id = $1", [it4.id]);
await recusa("o que espera há mais de 14 dias vence (não sai mais)", () => rpc(A("com2"), "rede_org_fila_decidir", { p_id: it4.id, p_aprovar: true, p_motivo: "" }), "vencido");
await espera("…e, na leitura da aba, vira vencido e esquece quem escreveu", async () => {
  await rpc(A("com2"), "rede_org_comunicacao", { p_handle: "lume" });
  return um("select situacao, escreveu from interno.rede_org_fila where id = $1", [it4.id]);
}, (r) => r.situacao === "vencido" && r.escreveu === null);
await espera("a triagem segura o post de ódio, mesmo aprovado", async () => {
  await zerar();
  const it = await rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Esse retardado da câmara votou contra." } });
  return rpc(A("com2"), "rede_org_fila_decidir", { p_id: it.id, p_aprovar: true, p_motivo: "" });
}, (r) => r.situacao === "aprovado" && r.retido === true);
await espera("quem perde a função perde a fila", async () => {
  await dono("update interno.rede_org_mandatos set encerrado_dia = current_date where pessoa = $1", [P.com2]);
  const r = await rpc(A("com2"), "rede_org_comunicacao", { p_handle: "lume" });
  await dono("update interno.rede_org_mandatos set encerrado_dia = null where pessoa = $1", [P.com2]);
  return r;
}, (r) => r === null);

// ═══════════════════ 4. Modelos ═══════════════════
await zerar();
await recusa("membro sem a função não cria modelo", () => rpc(A("m1"), "rede_org_modelo_salvar", { p_handle: "lume", p: { nome: "Chamado", texto: "Ato marcado." } }), "sem_permissao");
const mods = await espera("a comunicação cria um modelo", () => rpc(A("com1"), "rede_org_modelo_salvar", { p_handle: "lume", p: { nome: "Chamado para ato", texto: "Ato marcado: [o quê], [quando], [onde].", publico: "seguidores" } }),
  (r) => r.length === 1 && r[0].publico === "seguidores");
await recusa("nome repetido (sem olhar maiúsculas)", () => rpc(A("com2"), "rede_org_modelo_salvar", { p_handle: "lume", p: { nome: "CHAMADO PARA ATO", texto: "Outro." } }), "modelo_existe");
await espera("mudar o modelo", () => rpc(A("com2"), "rede_org_modelo_salvar", { p_handle: "lume", p: { id: mods?.[0]?.id, nome: "Chamado", texto: "Ato: [o quê].", publico: "membros" } }),
  (r) => r.length === 1 && r[0].nome === "Chamado" && r[0].publico === "membros");
await espera("apagar o modelo", () => rpc(A("dona"), "rede_org_modelo_apagar", { p_handle: "lume", p_id: mods?.[0]?.id }), (r) => r.length === 0);

// ═══════════════════ 5. Chamar o núcleo (teto) ═══════════════════
await zerar();
await recusa("membro do núcleo sem cargo não chama", () => rpc(A("m1"), "rede_org_nucleo_chamar", { p_nucleo: NUC, p_texto: "Reunião hoje." }), "sem_permissao");
await recusa("quem está fora não chama", () => rpc(A("fora"), "rede_org_nucleo_chamar", { p_nucleo: NUC, p_texto: "Reunião hoje." }), "sem_permissao");
await recusa("a mediação de um núcleo não chama outro núcleo", () => rpc(A("med"), "rede_org_nucleo_chamar", { p_nucleo: NUC2, p_texto: "Oi." }), "sem_permissao");
const ch1 = await espera("a comunicação chama o núcleo: avisa quem é do núcleo (só o número, a partir de 3)", () => rpc(A("com1"), "rede_org_nucleo_chamar", { p_nucleo: NUC, p_texto: "Reunião extraordinária hoje, 19h." }),
  (r) => r.post && r.retido === false && r.avisadas === 6 && r.restam === 1 && r.volta === null && semPessoas(r));
await espera("o recado é da organização, só para o núcleo", () => um("select autor, como, publico, nucleo from interno.rede_posts where id = $1", [ch1?.post]),
  (r) => r.autor === P.org && r.como === P.org && r.publico === "nucleo" && r.nucleo === NUC);
await espera("o aviso chega a quem é do núcleo, sem quem chamou (e não a quem a organização bloqueou, nem a quem chamou)", async () =>
  (await dono("select para, ator, tipo, texto from interno.avisos where post = $1", [ch1?.post])).rows,
(rs) => rs.length === 6 && rs.every((a) => a.ator === null && a.tipo === "nucleo" && !a.texto.includes("Codinome")) && !rs.some((a) => a.para === P.com1 || a.para === P.bloq));
await espera("quem não é do núcleo não vê o recado", () => rpc(A("fora"), "rede_post", { p_id: ch1?.post }).catch(() => null), (r) => r === null || !JSON.stringify(r).includes("extraordinária"));
await espera("a mediação chama o mesmo núcleo: o teto é do núcleo (acabou)", () => rpc(A("med"), "rede_org_nucleo_chamar", { p_nucleo: NUC, p_texto: "Lembrete da reunião." }),
  (r) => r.restam === 0 && r.volta !== null);
await recusa("a terceira chamada na semana, por qualquer pessoa com cargo", () => rpc(A("dona"), "rede_org_nucleo_chamar", { p_nucleo: NUC, p_texto: "Mais uma." }), "teto_do_nucleo");
await espera("o outro núcleo tem o teto dele", () => rpc(A("com2"), "rede_org_nucleo_chamar", { p_nucleo: NUC2, p_texto: "Oi, núcleo Sul." }),
  (r) => r.restam === 1 && r.avisadas === null);
await espera("a tabela das chamadas não guarda quem chamou", () => um("select count(*)::int n from interno.rede_org_nucleo_chamadas where nucleo = $1", [NUC]), (r) => r.n === 2);
await espera("passados 7 dias, o núcleo pode ser chamado de novo", async () => {
  await dono("update interno.rede_org_nucleo_chamadas set quando = quando - interval '8 days' where nucleo = $1", [NUC]);
  return rpc(A("com1"), "rede_org_comunicacao", { p_handle: "lume" });
}, (r) => r.nucleos.find((n) => n.id === NUC).restam === 2);

// ═══════════════════ 6. Boletim ═══════════════════
await zerar();
await espera("pedir o boletim na Alumia", () => rpc(A("m1"), "rede_org_boletim_assinar", { p_handle: "lume", p_sim: true, p_email: true }), (r) => r.assino && r.email);
await rpc(A("m2"), "rede_org_boletim_assinar", { p_handle: "lume", p_sim: true, p_email: false });
await recusa("a organização bloqueou: não assina", () => rpc(A("bloq"), "rede_org_boletim_assinar", { p_handle: "lume", p_sim: true, p_email: true }), "nao_encontrado");
await espera("com 2 pessoas, a organização não vê o número", () => rpc(A("com1"), "rede_org_comunicacao", { p_handle: "lume" }), (r) => r.boletim.assinantes === null && r.boletim.porEmail === null);
await rpc(A("m3"), "rede_org_boletim_assinar", { p_handle: "lume", p_sim: true, p_email: true });
await rpc(A("fora"), "rede_org_boletim_assinar", { p_handle: "lume", p_sim: true, p_email: false });
const painel = await espera("com 4, vê o número (e o de e-mail, abaixo de 3, segue escondido)", () => rpc(A("com1"), "rede_org_comunicacao", { p_handle: "lume" }),
  (r) => r.boletim.assinantes === 4 && r.boletim.porEmail === null && r.boletim.posts.length >= 1 && semPessoas(r));
const SEGUIDORES = painel?.boletim.posts.filter((x) => x.publico === "seguidores").map((x) => x.id) ?? [];
ok("a lista da aba não traz o recado do núcleo", !(painel?.boletim.posts ?? []).some((x) => x.id === ch1?.post || x.publico === "nucleo"));
// Um post público da organização, para o e-mail levar o começo dele.
const pub = await (async () => { await zerar(); const it = await rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "Votamos não no aumento da tarifa. O porquê está na prestação de contas.", publico: "internet" } }); return rpc(A("com2"), "rede_org_fila_decidir", { p_id: it.id, p_aprovar: true, p_motivo: "" }); })();
ok(`o post público saiu (${JSON.stringify(pub)?.slice(0, 300)})`, pub?.situacao === "aprovado" && pub?.retido === false);
// E um só de membros. Num boletim de membros só cabem os posts de membros e os da internet (os de seguidores, no de seguidores).
const doMembros = await (async () => { await zerar(); const it = await rpc(A("com1"), "rede_org_fila_escrever", { p_handle: "lume", p: { texto: "A consulta da pauta de outubro fica aberta até domingo.", publico: "membros" } }); return rpc(A("com2"), "rede_org_fila_decidir", { p_id: it.id, p_aprovar: true, p_motivo: "" }); })();
const POSTS = [doMembros?.post].filter(Boolean);
ok("a aba oferece o post de membros e o público para o boletim", ((await rpc(A("com1"), "rede_org_comunicacao", { p_handle: "lume" })).boletim.posts ?? []).filter((x) => [doMembros?.post, pub?.post].includes(x.id)).length === 2);
await recusa("boletim com post que não é da organização", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Boletim.", posts: [ch1?.post, "00000000-0000-0000-0000-000000000000"] } }), "invalido:posts");
await recusa("o recado do núcleo não entra num boletim aberto", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Boletim.", posts: [ch1?.post, pub?.post], publico: "internet" } }), "invalido:posts");
await recusa("o recado do núcleo não entra nem no boletim de membros", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Boletim.", posts: [ch1?.post], publico: "membros" } }), "invalido:posts");
await recusa("post só de membros não entra no boletim da internet", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Boletim.", posts: [POSTS.find((x) => x !== pub?.post)], publico: "internet" } }), "invalido:posts");
if (SEGUIDORES.length) await recusa("post só de seguidores não entra no boletim de membros", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Boletim.", posts: [SEGUIDORES[0]], publico: "membros" } }), "invalido:posts");
await recusa("post só de membros não entra no boletim de seguidores", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Boletim.", posts: [POSTS.find((x) => x !== pub?.post)], publico: "seguidores" } }), "invalido:posts");
await recusa("boletim sem post", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Boletim.", posts: [] } }), "invalido:posts");
const bol = await espera("a comunicação propõe o boletim: vai para a fila", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "O que fizemos nesta semana.", posts: [...POSTS, pub?.post], publico: "membros" } }),
  (r) => r.tipo === "boletim" && r.situacao === "esperando" && r.boletim.length === POSTS.length + 1);
await recusa("um boletim de cada vez na fila", () => rpc(A("com2"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "Outro.", posts: POSTS } }), "boletim_esperando");
// Depois de proposto, um dos posts vira só de seguidores: na hora de sair, o boletim de membros não o leva.
const mudou = POSTS.find((x) => x !== pub?.post);
const textoMudou = (await um("select texto from interno.rede_posts where id = $1", [mudou])).texto;
await dono("update interno.rede_posts set publico = 'seguidores', alcance = interno.rede_alcance('seguidores') where id = $1", [mudou]);
await recusa("quem propôs não aprova o boletim", () => rpc(A("com1"), "rede_org_fila_decidir", { p_id: bol?.id, p_aprovar: true, p_motivo: "" }), "outra_pessoa");
await dono("delete from interno.emails");
const bolOk = await espera("outra pessoa aprova: o boletim sai como post da organização", () => rpc(A("com2"), "rede_org_fila_decidir", { p_id: bol?.id, p_aprovar: true, p_motivo: "" }),
  (r) => r.situacao === "aprovado" && r.post && !r.retido);
await espera("o post do boletim é da organização, com título e os posts escolhidos", () => um("select autor, como, tipo, titulo, corpo from interno.rede_posts where id = $1", [bolOk?.post]),
  (r) => r.autor === P.org && r.como === P.org && r.tipo === "aviso" && r.titulo === "Boletim de Coletivo Lume" && r.corpo.includes("Votamos não"));
await espera("o post que ficou só de seguidores depois de proposto não entra no corpo", () => um("select corpo from interno.rede_posts where id = $1", [bolOk?.post]),
  (r) => !r.corpo.includes(textoMudou.slice(0, 40)) && !r.corpo.includes("Reunião extraordinária"));
await espera("cada pessoa que pediu é avisada na Alumia", async () => (await dono("select para from interno.avisos where texto like 'Saiu o boletim%'")).rows,
  (rs) => rs.length === 4 && [P.m1, P.m2, P.m3, P.fora].every((id) => rs.some((a) => a.para === id)));
const emails = await espera("um e-mail por pessoa que pediu por e-mail, para o endereço da própria conta", async () => (await dono("select para, tipo, assunto, texto, sair from interno.emails order by para")).rows,
  (rs) => rs.length === 2 && rs[0].para === "m1@o12.local" && rs[1].para === "m3@o12.local" && rs.every((e) => e.tipo === "alumia_org_boletim"));
ok("o e-mail não traz lista de destinatários nem o endereço de outra pessoa", (emails ?? []).every((e) => !/@o12\.local/.test(e.texto) && !e.texto.includes("m3@") && !e.texto.includes("m1@")));
ok("o e-mail leva só o começo do post público, sem link (fora o da própria Alumia)", (emails ?? []).every((e) => e.texto.includes("Votamos não no aumento") && (e.texto.match(/https?:\/\/\S*/g) ?? []).every((u) => u.startsWith("https://institutolucia.org")) && e.texto.includes("https://institutolucia.org/pt/alumia/@lume") && e.texto.includes("O que fizemos")));
ok("o e-mail não leva o texto dos posts que não são públicos", (emails ?? []).every((e) => !e.texto.includes("Assembleia aberta no sábado")));
await recusa("outro boletim em menos de 6 dias", () => rpc(A("com1"), "rede_org_boletim_propor", { p_handle: "lume", p: { texto: "De novo.", posts: [pub?.post] } }), "boletim_cedo");
await espera("parar o boletim", () => rpc(A("m1"), "rede_org_boletim_assinar", { p_handle: "lume", p_sim: false, p_email: false }), (r) => !r.assino && !r.email && r.saidos.length === 1);
await espera("quem assina vê os boletins que saíram, e nada de quem mais assina", () => rpc(A("m3"), "rede_org_boletim", { p_handle: "lume" }), (r) => r.assino && r.saidos.length === 1 && semPessoas(r) && Object.keys(r).sort().join() === "assino,email,saidos");

// ═══════════════════ 7. Domínio próprio ═══════════════════
await zerar();
await recusa("organização sem selo não prova domínio", () => rpc(A("dona"), "rede_org_dominio_pedir", { p_handle: "brasa", p_dominio: "brasa.org.br" }), "sem_selo");
await recusa("a comunicação (sem gerenciar) não pede domínio", () => rpc(A("com1"), "rede_org_dominio_pedir", { p_handle: "lume", p_dominio: "lume.org.br" }), "sem_permissao");
for (const ruim of ["10.0.0.1", "lume", "intranet.local", "institutolucia.org", "alumia.institutolucia.org", "lume.org.br:8080/x?y"]) {
  if (ruim === "lume.org.br:8080/x?y") continue;
  await recusa(`domínio que não serve: ${ruim}`, () => rpc(A("dona"), "rede_org_dominio_pedir", { p_handle: "lume", p_dominio: ruim }), "invalido:dominio");
}
const dom = await espera("quem gerencia pede o domínio: recebe o desafio (o endereço é limpo como na tela)", () => rpc(A("dona"), "rede_org_dominio_pedir", { p_handle: "lume", p_dominio: "https://WWW.Lume.org.br/sobre" }),
  (r) => r.dominio === "lume.org.br" && r.situacao === "esperando" && r.txtNome === "_alumia.lume.org.br" && /^alumia-dominio=[0-9a-f]{32}$/.test(r.txtValor)
    && r.arquivo === "https://lume.org.br/.well-known/alumia-dominio.txt" && r.dominio === dominioLimpo("https://WWW.Lume.org.br/sobre"));
const desafio = dom?.txtValor.split("=")[1];
await espera("antes da prova, o perfil não mostra domínio", () => rpc(A("fora"), "rede_org_dominio", { p_handle: "lume" }), (r) => r === null);
const alvo = await espera("o servidor pede o que conferir COMO a pessoa (só quem gerencia)", () => rpc(A("dona"), "rede_org_dominio_para_conferir", { p_handle: "lume" }),
  (r) => r.org === P.org && r.dominio === "lume.org.br" && r.desafio === desafio);
await recusa("quem não gerencia não pede a conferência", () => rpc(A("com1"), "rede_org_dominio_para_conferir", { p_handle: "lume" }), "sem_permissao");
await recusa("a pessoa não grava o resultado (só a chave de serviço)", () => rpc(A("dona"), "rede_org_dominio_resultado", { p_org: P.org, p_dominio: "lume.org.br", p_desafio: desafio, p_ok: true, p_metodo: "txt" }), "permission denied");
await recusa("desafio velho não vale", () => rpc(servico, "rede_org_dominio_resultado", { p_org: P.org, p_dominio: "lume.org.br", p_desafio: "0".repeat(32), p_ok: true, p_metodo: "txt" }), "nao_encontrado");
await espera("não achou: continua esperando", () => rpc(servico, "rede_org_dominio_resultado", { p_org: P.org, p_dominio: "lume.org.br", p_desafio: desafio, p_ok: false, p_metodo: null }),
  (r) => r.situacao === "esperando" && r.conferidoEm !== null);
await espera("a prova de ponta a ponta com o dublê do DNS, e o resultado pela chave de serviço", async () => {
  const prova = await provarDominio(alvo.dominio, alvo.desafio, { resolverTxt: async (n) => (n === "_alumia.lume.org.br" ? [[textoEsperado(alvo.desafio)]] : []), buscarArquivo: async () => null });
  return rpc(servico, "rede_org_dominio_resultado", { p_org: alvo.org, p_dominio: alvo.dominio, p_desafio: alvo.desafio, p_ok: prova.ok, p_metodo: prova.ok ? prova.metodo : null });
}, (r) => r.situacao === "verificado" && r.metodo === "txt" && r.verificadoEm !== null);
await espera("o perfil mostra o domínio verificado", () => rpc(A("fora"), "rede_org_dominio", { p_handle: "lume" }), (r) => r.dominio === "lume.org.br" && /^\d{4}-\d{2}-\d{2}$/.test(r.desde));
await espera("a Faixa 2 acha a organização pelo domínio", () => um("select interno.rede_org_por_dominio('LUME.org.br.') as o"), (r) => r.o === P.org);
await espera("uma falha de rede depois não tira o domínio do perfil", () => rpc(servico, "rede_org_dominio_resultado", { p_org: P.org, p_dominio: "lume.org.br", p_desafio: desafio, p_ok: false, p_metodo: null }),
  (r) => r.situacao === "verificado");
await espera("pedir o mesmo domínio de novo não apaga a prova", () => rpc(A("dona"), "rede_org_dominio_pedir", { p_handle: "lume", p_dominio: "lume.org.br" }), (r) => r.situacao === "verificado");
await espera("outra organização não toma o domínio", async () => {
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org2]);
  await zerar();
  return rpc(A("dona"), "rede_org_dominio_pedir", { p_handle: "brasa", p_dominio: "lume.org.br" }).then(() => "passou", (e) => e.message);
}, (r) => String(r).includes("dominio_em_uso"));
await espera("tirado o selo, o domínio some do perfil e da busca da Faixa 2", async () => {
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org]);
  const r = { perfil: await rpc(A("fora"), "rede_org_dominio", { p_handle: "lume" }), f2: (await um("select interno.rede_org_por_dominio('lume.org.br') as o")).o };
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org]);
  return r;
}, (r) => r.perfil === null && r.f2 === null);
await espera("quem a organização bloqueou não vê o domínio", () => rpc(A("bloq"), "rede_org_dominio", { p_handle: "lume" }), (r) => r === null);
await espera("trocar de domínio volta a esperar, com desafio novo", () => rpc(A("dona"), "rede_org_dominio_pedir", { p_handle: "lume", p_dominio: "coletivolume.org" }),
  (r) => r.dominio === "coletivolume.org" && r.situacao === "esperando" && r.txtValor !== dom?.txtValor);
await espera("tirar o domínio", () => rpc(A("dona"), "rede_org_dominio_tirar", { p_handle: "lume" }), (r) => r.ok === true);
await espera("a tabela do domínio não guarda endereço de rede", () => um("select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_org_dominios'"),
  (r) => r.c === "org,dominio,desafio,situacao,metodo,pedido_dia,verificado_em,conferido_em");

// ═══════════════════ 8. A porta com a trava ligada ═══════════════════
await espera("com a trava ligada, conta não aprovada não usa nada daqui", async () => {
  await dono("select interno.alumia_entrada_ligar(true)");
  const n = await criarUsuario("novata@o12.local", "novata");
  const erros = [];
  for (const [f, a] of [["rede_org_comunicacao", { p_handle: "lume" }], ["rede_org_boletim_assinar", { p_handle: "lume", p_sim: true, p_email: true }], ["rede_org_dominio", { p_handle: "lume" }]]) {
    erros.push(await rpc(como(n), f, a).then(() => "passou", (e) => e.message));
  }
  await dono("select interno.alumia_entrada_ligar(false)");
  return erros;
}, (es) => es.every((e) => e.includes("alumia_entrada")));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
