// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente da lei e da ajuda da Alumia (supabase/migracoes/20261114-alumia-o8-lei.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · os termos: a versão em vigor, o aceite do cadastro (pelo consentimento) e o reaceite quando a versão muda;
//   · a denúncia de conteúdo ilegal e o prazo de resposta em toda denúncia, na fila e no painel da lei;
//   · a proteção de menores: a denúncia retém a conta por precaução, com as travas contra abuso, e a mediação decide;
//   · o recurso de conta: quem está suspensa pede revisão (fora da porta), outra pessoa decide, a conta volta, e o que a
//     coordenação decidiu só a coordenação (ou a vice) desfaz;
//   · a porta da Alumia em tudo o que é de membro, e os números de components/rede/lei/versao.ts iguais aos do banco.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o8-lei.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { lerAlvo } from "../components/rede/lei/alvo.ts";
import { JANELA_DO_RECURSO_DIAS, PRAZO_DA_RETENCAO_HORAS, PRAZO_DO_RECURSO_DIAS, PRAZOS_DAS_DENUNCIAS, VERSAO_DOS_TERMOS } from "../components/rede/lei/versao.ts";

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
const horas = (iso) => (new Date(iso).getTime() - Date.now()) / 3_600_000;

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261114-alumia-o8-lei.sql");
ok("toda função nova é security definer com search_path fixo (menos as puras, que não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = /(rede2_prioridade|alumia_lei_prazo|rede3_mod_categoria|alumia_lei_prazo_recurso|alumia_porta_aberta)\(/;
  return funcoes.length >= 18 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || puras.test(f.split("\n")[0]));
})());
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", (() => {
  const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
  return tabelas.length === 3 && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql);
})());
ok("nenhuma tabela guarda endereço de rede", (() => {
  const tabelas = sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? [];
  return tabelas.length === 3 && !tabelas.some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t));
})());
ok("não mexe na versão da Alumia e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-600)));
ok("a data da versão no código é a do banco", sql.includes(`(${VERSAO_DOS_TERMOS.numero}, date '${VERSAO_DOS_TERMOS.data}', '')`));
ok("os prazos das denúncias no código são os do banco", (() => {
  const em24 = Object.entries(PRAZOS_DAS_DENUNCIAS).filter(([, h]) => h === 24).map(([c]) => c);
  const em72 = Object.entries(PRAZOS_DAS_DENUNCIAS).filter(([, h]) => h === 72).map(([c]) => c);
  const lista = (cs) => cs.map((c) => `'${c}'`).join(", ");
  return sql.includes(`p_categoria in (${lista(em24)}) then interval '24 hours'`) && sql.includes(`p_categoria in (${lista(em72)}) then interval '72 hours'`)
    && sql.includes("else interval '7 days' end") && Object.values(PRAZOS_DAS_DENUNCIAS).every((h) => [24, 72, 168].includes(h));
})());
ok("o prazo do recurso e o da retenção no código são os do banco", sql.includes(`select interval '${PRAZO_DO_RECURSO_DIAS} days'`)
  && sql.includes(`default now() + interval '${PRAZO_DA_RETENCAO_HORAS} hours'`) && sql.includes(`interval '${JANELA_DO_RECURSO_DIAS} days'`));
// Na junção da onda 8, a lista ficou uma só nas quatro migrações que a definem (portas, portas do Fediverso, entrada e esta), com
// as duas da conta suspensa e a marca de convite da triagem (20261114-alumia-o8-porta.sql).
ok("a lista de exceções da porta é a mesma da entrada da onda 7, com as duas da conta suspensa", (() => {
  const daOnda7 = ler("supabase/migracoes/20261113-alumia-o7-entrada.sql").match(/create or replace function interno\.alumia_porta_aberta[\s\S]*?\n\$\$;/)[0];
  const daqui = sql.match(/create or replace function interno\.alumia_porta_aberta[\s\S]*?\n\$\$;/)[0];
  return daOnda7 === daqui && /'alumia_lei_minha_conta', 'alumia_lei_recorrer_conta'/.test(daqui);
})());

// Os textos: as seis línguas com as mesmas chaves, listas do mesmo tamanho e os mesmos marcadores {x}; nenhuma palavra proibida.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/lei/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/lei/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`lei/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("o texto novo não usa \"diploma\", \"universidade\" nem \"algoritmo\"", !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt)));
  ok("a linha do endereço de rede diz que não é guardado", pt.guardamos.grupos.some((g) => g.linhas.some((x) => /IP/.test(x.dado) && x.tempo === "—" && /Não é guardado/.test(x.onde))));
  ok("as categorias da tabela de prazos são as do código", pt.regras.prazos.flatMap((p) => p.categorias).sort().join() === Object.keys(PRAZOS_DAS_DENUNCIAS).sort().join());
  ok("o título de Ajustes existe nas seis línguas", Object.keys(JSON.parse(ler("i18n/rede/lei/titulos.json")).ajustes).sort().join() === "en,es,fr,pt,ru,zh");
}
// O endereço colado no canal de conteúdo ilegal.
{
  const id = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  ok("post pelo endereço completo", JSON.stringify(lerAlvo(`https://alumia.exemplo.org/p/${id}`)) === JSON.stringify({ tipo: "post", alvo: id }));
  ok("post pelo caminho com idioma e pelo número sozinho", lerAlvo(`/pt/alumia/p/${id}?x=1`)?.alvo === id && lerAlvo(id.toUpperCase())?.alvo === id);
  ok("perfil pelo @ e pelo endereço", lerAlvo("@Fulana_1")?.tipo === "perfil" && lerAlvo("@Fulana_1")?.alvo === "fulana_1" && lerAlvo("https://x.org/u/@beltrano")?.alvo === "beltrano");
  ok("comunidade pelo endereço", JSON.stringify(lerAlvo("https://x.org/pt/alumia/c/passe-livre")) === JSON.stringify({ tipo: "comunidade", alvo: "passe-livre" }));
  ok("lixo não vira alvo", lerAlvo("") === null && lerAlvo("qualquer coisa") === null && lerAlvo("/p/nao-e-numero") === null && lerAlvo("x".repeat(400)) === null);
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
// Com a migração já colada no install.sql (junção da onda 8), o banco é montado como estava antes dela: quem consentiu antes
// passa pelo reaceite, e a migração roda por cima.
const semCr = (t) => t.replace(/\r\n/g, "\n");
const noInstall = semCr(ler("supabase/install.sql")).includes(semCr(sql).trim());
const banco = await criarBanco(noInstall ? { antesDe: sql } : {});
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const visitante = { papel: "anon", ip: "203.0.113.10" };

const P = {};
const NOMES = ["coord", "vice", "mediador", "mediador2", "membro", "membro2", "alvo", "alvo2", "alvo3", "alvo4", "outro", "equipe", "novo"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@lei.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'vice'), ($3, 'mediacao'), ($4, 'mediacao'), ($5, 'mediacao')",
  [P.coord, P.vice, P.mediador, P.mediador2, P.equipe]);
for (const nome of NOMES.filter((n) => n !== "novo")) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
await espera("só uma versão dos termos depois das três rodadas", async () => (await dono("select count(*)::int as n from interno.alumia_termos")).rows[0].n, (n) => n === 1);

const C = como(P.coord), V = como(P.vice), M = como(P.mediador), M2 = como(P.mediador2);

// ═══════════════════ 2. Termos ═══════════════════
await espera("visitante vê a versão e a data, sem conta", () => rpc(visitante, "alumia_termos_eu"),
  (r) => r.logado === false && r.vigente === 1 && r.publicada_em === VERSAO_DOS_TERMOS.data);
await espera("quem consentiu antes desta migração ainda não aceitou os termos (passa pelo reaceite)", () => rpc(como(P.membro), "alumia_termos_eu"),
  (r) => r.logado === true && r.aceita === false && r.anterior === false);
await recusa("aceitar outra versão que não a em vigor é recusado", () => rpc(como(P.membro), "alumia_termos_aceitar", { p_versao: 2 }), "invalido:versao");
await espera("aceitar a versão em vigor", () => rpc(como(P.membro), "alumia_termos_aceitar", { p_versao: 1 }), (r) => r.aceita === true && r.aceita_em);
await espera("aceitar de novo não duplica", async () => {
  await rpc(como(P.membro), "alumia_termos_aceitar", { p_versao: 1 });
  return (await dono("select count(*)::int as n from interno.alumia_termos_aceites where usuario = $1", [P.membro])).rows[0].n;
}, (n) => n === 1);
await espera("o cadastro (o consentimento do pedido de entrada) anota o aceite da versão em vigor", async () => {
  await dono("update interno.perfis set rede_codinome = 'Codinome novo', rede_codinome_ok = true, rede_handle = 'c_novo' where id = $1", [P.novo]);
  await rpc(como(P.novo), "rede_aderir", { p_maior: true, p_versao: 1 });
  return (await dono("select como, versao from interno.alumia_termos_aceites where usuario = $1", [P.novo])).rows;
}, (rows) => rows.length === 1 && rows[0].como === "cadastro" && rows[0].versao === 1);
await recusa("sem ter declarado 18 anos não aceita pelo reaceite", async () => {
  await dono("update interno.perfis set rede_18 = false where id = $1", [P.outro]);
  try { return await rpc(como(P.outro), "alumia_termos_aceitar", { p_versao: 1 }); } finally { await dono("update interno.perfis set rede_18 = true where id = $1", [P.outro]); }
}, "idade_minima");
await espera("versão nova: quem aceitou a anterior volta ao reaceite e a tela sabe que mudou", async () => {
  await dono("insert into interno.alumia_termos (versao, publicada_em, mudou) values (2, current_date, 'O prazo do recurso mudou.')");
  return rpc(como(P.membro), "alumia_termos_eu");
}, (r) => r.vigente === 2 && r.aceita === false && r.anterior === true && r.mudou === "O prazo do recurso mudou.");
await espera("e aceita a nova", () => rpc(como(P.membro), "alumia_termos_aceitar", { p_versao: 2 }), (r) => r.aceita === true);
await dono("delete from interno.alumia_termos_aceites where versao = 2");
await dono("delete from interno.alumia_termos where versao = 2");

// ═══════════════════ 3. Denúncia de conteúdo ilegal e prazos ═══════════════════
const post = async (autor, texto) => (await dono("insert into interno.rede_posts (autor, texto) values ($1, $2) returning id", [autor, texto])).rows[0].id;
const postAlvo = await post(P.alvo, "Um post público que vai ser denunciado por conteúdo ilegal.");
const postSpam = await post(P.alvo2, "Um post público que vai ser denunciado como spam.");

const ilegal = await espera("denunciar conteúdo ilegal: prioridade 1 e prazo de 24 horas", () => rpc(como(P.membro), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: postAlvo, p_categoria: "ilegal", p_texto: "Venda de coisa proibida por lei." }),
  (r) => r.prioridade === 1 && r.ja === false && Math.abs(horas(r.responder_ate) - 24) < 0.1);
await espera("spam: prazo de 7 dias", () => rpc(como(P.membro), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: postSpam, p_categoria: "spam", p_texto: "" }),
  (r) => r.prioridade === 3 && Math.abs(horas(r.responder_ate) - 168) < 0.1);
await recusa("categoria desconhecida continua recusada", () => rpc(como(P.membro), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: postSpam, p_categoria: "qualquer", p_texto: "" }), "invalido:categoria");
await espera("a mesma denúncia de novo devolve o mesmo protocolo e o mesmo prazo", () => rpc(como(P.membro), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: postAlvo, p_categoria: "ilegal", p_texto: "" }),
  (r) => r.ja === true && r.protocolo === ilegal?.protocolo && r.responder_ate);
await espera("a fila da moderação mostra o prazo e se venceu, sem quem denunciou", () => rpc(M, "rede_mod_fila", { p_situacao: "abertas" }),
  (r) => { const d = r.find((x) => x.protocolo === ilegal?.protocolo); return d && d.categoria === "ilegal" && d.responder_ate && d.vencida === false && !JSON.stringify(d).includes(P.membro); });
await espera("a página /denunciar com \"crime\" no motivo cai como conteúdo ilegal", async () => (await dono("select interno.rede3_mod_categoria('Isso é crime') as c, interno.rede3_mod_categoria('menor de idade cometendo crime') as m")).rows[0],
  (r) => r.c === "ilegal" && r.m === "menores");
await espera("o painel da lei conta a ilegal aberta e, vencido o prazo, conta como vencida", async () => {
  const antes = await rpc(M, "alumia_lei_painel");
  await dono("update interno.rede_denuncias set responder_ate = now() - interval '1 hour' where protocolo = $1", [ilegal?.protocolo]);
  const depois = await rpc(M, "alumia_lei_painel");
  return { antes, depois };
}, ({ antes, depois }) => antes.contadores.ilegais === 1 && antes.contadores.ilegais_vencidas === 0 && depois.contadores.ilegais_vencidas === 1
  && depois.contadores.denuncias_vencidas >= 1 && depois.ilegais.length === 1 && depois.ilegais[0].vencida === true && !JSON.stringify(depois.ilegais).includes(P.membro));
await espera("vencendo nas próximas 6 horas aparece à parte", async () => {
  await dono("update interno.rede_denuncias set responder_ate = now() + interval '2 hours' where protocolo = $1", [ilegal?.protocolo]);
  return rpc(M, "alumia_lei_painel");
}, (r) => r.contadores.ilegais_vencendo === 1 && r.contadores.ilegais_vencidas === 0);
await recusa("conta comum não abre o painel da lei", () => rpc(como(P.membro), "alumia_lei_painel"), "sem_permissao");

// ═══════════════════ 4. Menores: a conta fica retida por precaução ═══════════════════
const conta = async (id) => (await dono("select suspenso from interno.perfis where id = $1", [id])).rows[0].suspenso;
const menor = await espera("denúncia de menor sobre um perfil", () => rpc(como(P.membro), "rede_mod_denunciar", { p_alvo_tipo: "perfil", p_alvo: "c_alvo", p_categoria: "menores", p_texto: "Disse que tem 15 anos." }),
  (r) => r.prioridade === 1 && Math.abs(horas(r.responder_ate) - 24) < 0.1);
await espera("a conta fica retida (suspensa) por precaução, com a sanção sem pessoa e o registro de moderação automático", async () => {
  const r = (await dono(`select r.situacao, r.responder_ate, s.por, s.tipo, s.encerrada_em, m.quem, m.regra
    from interno.alumia_lei_retencoes r join interno.alumia_sancoes s on s.id = r.sancao
    join interno.rede_moderacao m on m.alvo_tipo = 'perfil' and m.alvo = r.usuario::text and m.acao = 'reter' where r.usuario = $1`, [P.alvo])).rows;
  return { r, suspensa: await conta(P.alvo) };
}, ({ r, suspensa }) => suspensa === true && r.length === 1 && r[0].situacao === "retida" && r[0].por === null && r[0].quem === null && r[0].regra === "precaucao_menor" && r[0].encerrada_em === null);
await espera("a pessoa retida recebe aviso de conta com o caminho da revisão", async () => (await dono("select texto from interno.avisos where para = $1 and categoria = 'conta' order by criado_em desc limit 1", [P.alvo])).rows[0]?.texto ?? "",
  (t) => /retida por precaução/.test(t) && /24 horas/.test(t) && /Regras da Alumia/.test(t));
await recusa("retida, a pessoa não usa as funções de membro", () => rpc(como(P.alvo), "rede_mod_minhas_decisoes"), "conta_suspensa");
await espera("mas vê a situação da própria conta e as decisões, sem quem decidiu", () => rpc(como(P.alvo), "alumia_lei_minha_conta"),
  (r) => r.suspensa === true && r.retida && Math.abs(horas(r.retida.responder_ate) - 24) < 0.1 && r.decisoes.length === 1 && r.decisoes[0].acao === "reter"
    && r.decisoes[0].automatica === true && r.decisoes[0].pode_recorrer === true && !("quem" in r.decisoes[0]) && !JSON.stringify(r).includes(P.membro));
await espera("visitante: só \"não entrou\"", () => rpc(visitante, "alumia_lei_minha_conta"), (r) => r.logado === false && Object.keys(r).length === 1);

// As travas contra abuso.
await espera("uma segunda conta retida pela mesma pessoa no mês: passa", async () => {
  await rpc(como(P.membro), "rede_mod_denunciar", { p_alvo_tipo: "perfil", p_alvo: "c_alvo2", p_categoria: "menores", p_texto: "" });
  return conta(P.alvo2);
}, (s) => s === true);
await espera("a terceira da mesma pessoa no mês entra na fila, mas não retém a conta", async () => {
  const r = await rpc(como(P.membro), "rede_mod_denunciar", { p_alvo_tipo: "perfil", p_alvo: "c_alvo3", p_categoria: "menores", p_texto: "" });
  return { r, s: await conta(P.alvo3) };
}, ({ r, s }) => r.prioridade === 1 && s === false);
await espera("denúncia de menor sobre alguém da equipe não retém", async () => {
  await rpc(como(P.membro2), "rede_mod_denunciar", { p_alvo_tipo: "perfil", p_alvo: "c_equipe", p_categoria: "menores", p_texto: "" });
  return conta(P.equipe);
}, (s) => s === false);
await espera("denúncia sem conta de quem denuncia (a ponte da página /denunciar para visitante) não retém", async () => {
  await dono("insert into interno.rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ('perfil', $1, 'menores', 1, '', null)", [P.alvo4]);
  return conta(P.alvo4);
}, (s) => s === false);
await espera("o post de quem foi denunciado como menor também leva à conta", async () => {
  const p = await post(P.alvo4, "Post de quem pode ser menor.");
  await rpc(como(P.membro2), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: p, p_categoria: "menores", p_texto: "" });
  return conta(P.alvo4);
}, (s) => s === true);

// A mediação decide.
const painel = await espera("o painel da lei lista as contas retidas com prazo, pelo codinome", () => rpc(M, "alumia_lei_painel"),
  (r) => r.contadores.retidas === 3 && r.retidas.length === 3 && r.retidas.every((x) => x.responder_ate && x.conta && x.pode === true) && !JSON.stringify(r.retidas).includes("Pessoa "));
const ret = (codinome) => painel?.retidas.find((x) => x.conta === codinome)?.id;
await recusa("conta comum não decide", () => rpc(como(P.membro2), "alumia_lei_menor_decidir", { p_retencao: ret("Codinome alvo"), p_decisao: "liberar", p_motivo: "Conferido na conversa." }), "sem_permissao");
await recusa("decidir pede motivo", () => rpc(M, "alumia_lei_menor_decidir", { p_retencao: ret("Codinome alvo"), p_decisao: "liberar", p_motivo: "curto" }), "invalido:motivo");
await espera("liberar: a conta volta, a denúncia é descartada e quem denunciou é avisado", async () => {
  const r = await rpc(M, "alumia_lei_menor_decidir", { p_retencao: ret("Codinome alvo"), p_decisao: "liberar", p_motivo: "A pessoa mostrou na conversa que é adulta." });
  const d = (await dono("select situacao from interno.rede_denuncias where protocolo = $1", [menor?.protocolo])).rows[0];
  const s = (await dono("select encerrada_em from interno.alumia_sancoes where usuario = $1", [P.alvo])).rows;
  return { r, d, s, suspensa: await conta(P.alvo) };
}, ({ r, d, s, suspensa }) => r.situacao === "liberada" && d.situacao === "descartada" && suspensa === false && s.every((x) => x.encerrada_em !== null));
await recusa("decidir de novo a mesma retenção: não existe mais", () => rpc(M, "alumia_lei_menor_decidir", { p_retencao: ret("Codinome alvo"), p_decisao: "manter", p_motivo: "Tentando de novo a decisão." }), "nao_encontrado");
await espera("liberada há menos de 90 dias, uma denúncia nova de outra pessoa não retém de novo", async () => {
  await rpc(como(P.membro2), "rede_mod_denunciar", { p_alvo_tipo: "perfil", p_alvo: "c_alvo", p_categoria: "menores", p_texto: "" });
  return conta(P.alvo);
}, (s) => s === false);
await espera("manter: a conta segue suspensa, agora por decisão de uma pessoa, com a regra e o recurso", async () => {
  const r = await rpc(M, "alumia_lei_menor_decidir", { p_retencao: ret("Codinome alvo2"), p_decisao: "manter", p_motivo: "A própria pessoa confirmou que tem 16 anos." });
  const m = (await dono("select quem, regra from interno.rede_moderacao where alvo = $1 and acao = 'suspender'", [P.alvo2])).rows;
  return { r, m, suspensa: await conta(P.alvo2) };
}, ({ r, m, suspensa }) => r.situacao === "mantida" && suspensa === true && m.length === 1 && m[0].quem === P.mediador && m[0].regra === "menor_de_18");

// ═══════════════════ 5. Recurso de conta ═══════════════════
await dono("select interno.alumia_entrada_ligar(true)");
await recusa("com a trava ligada, a conta suspensa não passa pela porta", () => rpc(como(P.alvo2), "alumia_termos_eu"), "alumia_entrada");
const decisoes = await espera("mas, suspensa e com a trava ligada, vê as decisões sobre a conta", () => rpc(como(P.alvo2), "alumia_lei_minha_conta"),
  (r) => r.suspensa === true && r.retida === null && r.decisoes.length === 2 && r.decisoes[0].acao === "suspender" && r.decisoes[0].automatica === false);
await recusa("recurso pede texto de 10 letras ou mais", () => rpc(como(P.alvo2), "alumia_lei_recorrer_conta", { p_acao: decisoes?.decisoes[0].id, p_texto: "curto" }), "invalido:texto");
await recusa("ninguém recorre de decisão sobre outra conta", () => rpc(como(P.alvo4), "alumia_lei_recorrer_conta", { p_acao: decisoes?.decisoes[0].id, p_texto: "Quero recorrer da decisão dos outros." }), "nao_encontrado");
await espera("pedir revisão: entra com prazo de resposta de 7 dias", () => rpc(como(P.alvo2), "alumia_lei_recorrer_conta", { p_acao: decisoes?.decisoes[0].id, p_texto: "Errei a idade no formulário: tenho 19 anos." }),
  (r) => r.ok === true && Math.abs(horas(r.responder_ate) - 24 * 7) < 0.1);
await recusa("um recurso por decisão", () => rpc(como(P.alvo2), "alumia_lei_recorrer_conta", { p_acao: decisoes?.decisoes[0].id, p_texto: "De novo o mesmo pedido de revisão." }), "recurso_ja_feito");
await recusa("decisão de mais de 30 dias: prazo vencido", async () => {
  // O registro é só de inserção: para envelhecer a linha no teste, o dono desliga o gatilho por um instante.
  await exec("alter table interno.rede_moderacao disable trigger rede2_so_insercao");
  await dono("update interno.rede_moderacao set criado_em = criado_em - interval '31 days' where id = $1", [decisoes?.decisoes[1].id]);
  await exec("alter table interno.rede_moderacao enable trigger rede2_so_insercao");
  return rpc(como(P.alvo2), "alumia_lei_recorrer_conta", { p_acao: decisoes?.decisoes[1].id, p_texto: "Pedido de revisão fora do prazo." });
}, "prazo_vencido");
await dono("select interno.alumia_entrada_ligar(false)");
const recursos = await espera("o painel da lei lista o recurso com prazo, sem quem recorreu", () => rpc(M2, "alumia_lei_painel"),
  (r) => r.contadores.recursos >= 1 && r.recursos.some((x) => x.conta === "Codinome alvo2" && x.responder_ate && x.vencido === false && x.minha === false) && !JSON.stringify(r.recursos).includes(P.alvo2));
const idRecurso = recursos?.recursos.find((x) => x.conta === "Codinome alvo2")?.id;
await recusa("quem decidiu não revê o próprio caso", () => rpc(M, "rede_mod_rever", { p_recurso: idRecurso, p_decisao: "revertido", p_motivo: "Revendo a minha decisão." }), "outra_pessoa");
await espera("outra pessoa da mediação reverte: a conta volta e a retenção sai", async () => {
  const r = await rpc(M2, "rede_mod_rever", { p_recurso: idRecurso, p_decisao: "revertido", p_motivo: "A pessoa mostrou que é adulta." });
  const ret2 = (await dono("select situacao from interno.alumia_lei_retencoes where usuario = $1", [P.alvo2])).rows[0];
  return { r, ret2, suspensa: await conta(P.alvo2) };
}, ({ r, ret2, suspensa }) => r.situacao === "revertido" && suspensa === false && ret2.situacao === "liberada");

// Suspensão pelo painel (coordenação): a mediação pode manter, mas só a coordenação ou a vice desfaz.
const susp = await espera("a coordenação suspende uma conta pelo painel", () => rpc(C, "alumia_painel_sancionar", { p_id: P.outro, p_tipo: "suspensao", p_dias: 30, p_motivo: "Ofensas repetidas na comunidade." }), (r) => r.id);
const decOutro = await espera("a pessoa suspensa vê a decisão e pede revisão", async () => {
  const r = await rpc(como(P.outro), "alumia_lei_minha_conta");
  await rpc(como(P.outro), "alumia_lei_recorrer_conta", { p_acao: r.decisoes[0].id, p_texto: "Peço revisão: as mensagens foram tiradas do contexto." });
  return r;
}, (r) => susp && r.decisoes.length === 1 && r.decisoes[0].acao === "suspender" && r.decisoes[0].regra === "painel");
const recOutro = (await dono("select r.id from interno.rede_recursos r where r.acao = $1", [decOutro?.decisoes[0].id])).rows[0]?.id;
await recusa("a mediação não desfaz o que a coordenação decidiu", () => rpc(M, "rede_mod_rever", { p_recurso: recOutro, p_decisao: "revertido", p_motivo: "Achei a decisão dura demais." }), "so_coordenacao");
await espera("o recurso continua aberto e a conta continua suspensa", async () => ({
  sit: (await dono("select situacao from interno.rede_recursos where id = $1", [recOutro])).rows[0].situacao, suspensa: await conta(P.outro),
}), (r) => r.sit === "aberto" && r.suspensa === true);
await espera("a vice-coordenação desfaz: a sanção do painel se encerra e a conta volta", async () => {
  const r = await rpc(V, "rede_mod_rever", { p_recurso: recOutro, p_decisao: "revertido", p_motivo: "O contexto mostra que não houve ofensa." });
  const s = (await dono("select encerrada_em, encerrada_por from interno.alumia_sancoes where usuario = $1", [P.outro])).rows[0];
  return { r, s, suspensa: await conta(P.outro) };
}, ({ r, s, suspensa }) => r.situacao === "revertido" && s.encerrada_em !== null && s.encerrada_por === P.vice && suspensa === false);

// ═══════════════════ 6. A porta ═══════════════════
await dono("select interno.alumia_entrada_ligar(true)");
await recusa("com a trava ligada, o painel da lei passa pela porta (sessão sem o segundo fator)", () => rpc(como(P.mediador, "aal1"), "alumia_lei_painel"), "alumia_entrada");
await recusa("e o reaceite também", () => rpc(como(P.membro, "aal1"), "alumia_termos_aceitar", { p_versao: 1 }), "alumia_entrada");
await espera("visitante chama a situação da conta sem tropeçar na porta", () => rpc(visitante, "alumia_lei_minha_conta"), (r) => r.logado === false);
await dono("select interno.alumia_entrada_ligar(false)");
await espera("nenhuma permissão para visitante nas funções de decidir", async () => (await dono(`
  select bool_and(not has_function_privilege('anon', p.oid, 'execute')) as ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('alumia_termos_aceitar', 'alumia_lei_menor_decidir', 'alumia_lei_recorrer_conta', 'alumia_lei_painel')`)).rows[0].ok, (ok) => ok === true);

await banco.pg.close();
console.log(`\n${certos} conferências certas, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
