// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a moderação da comunidade da onda 9 (supabase/migracoes/20261115-alumia-o9-moderacao.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · o filtro automático: links, domínios, conta nova e a fila de recém-chegados só RETÊM (nada some), quem modera passa livre,
//     a regra é aberta para quem lê e só a moderação calibra;
//   · o modo lento diz quanto falta (e quem modera não espera);
//   · o alerta de brigada conta QUANTAS contas de fora (a partir de 3), avisa só a moderação e nunca diz quem;
//   · as perguntas para entrar: sem respostas o pedido não entra, a moderação lê, e as respostas somem com a decisão;
//   · a fila de recursos com o prazo da onda 8;
//   · as contas da tela (lib/rede/comunidade-moderacao.ts) iguais às do banco, e os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o9-moderacao.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { contarLinks, dominiosDoTexto, emMinutos, LIMITES, limparDominio, MOTIVOS_DO_FILTRO, OPCOES_DO_LENTO, previsaoDoFiltro, PRAZOS_DA_SONECA } from "../lib/rede/comunidade-moderacao.ts";

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
const sql = ler("supabase/migracoes/20261115-alumia-o9-moderacao.sql");
const PURAS = /(alumia_o9_links|alumia_o9_dominios|alumia_o9_dominio_bate)\(/;
ok("toda função nova é security definer com search_path fixo (menos as puras, que não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 18 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || PURAS.test(f.split("\n")[0]));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 4
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("o alerta de brigada não tem coluna de pessoa", (() => {
  const t = sql.match(/create table if not exists interno\.alumia_brigadas \([\s\S]*?\n\);/)?.[0] ?? "";
  return t.length > 0 && !/\b(usuario|quem|autor|pessoa|conta)\s+uuid/.test(t);
})());
ok("não mexe na versão da Alumia, no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-500)));
ok("os limites do código são os do banco", sql.includes(`links_max between 0 and ${LIMITES.linksMax}`) && sql.includes(`cardinality(dominios) <= ${LIMITES.dominios}`)
  && sql.includes(`conta_nova_dias between 1 and ${LIMITES.contaNovaDias}`) && sql.includes(`novatos_posts between 1 and ${LIMITES.novatosPosts}`)
  && sql.includes(`brigada_contas between ${LIMITES.brigadaContasMin} and ${LIMITES.brigadaContasMax}`)
  && sql.includes(`brigada_minutos between ${LIMITES.brigadaMinutosMin} and ${LIMITES.brigadaMinutosMax}`)
  && sql.includes(`char_length(explicacao) <= ${LIMITES.explicacao}`) && sql.includes(`'pergunta', ${LIMITES.perguntaMin}, ${LIMITES.perguntaMax}`)
  && sql.includes(`'resposta', 1, ${LIMITES.resposta}`));
ok("os motivos que o filtro grava são os que a tela conhece", ["automod_links", "automod_dominio", "automod_conta_nova", "recem_chegada"].every((m) => sql.includes(`'${m}'`) && MOTIVOS_DO_FILTRO.includes(m)));
ok("o modo lento da tela cabe no do banco (5 s a 24 h) e a soneca no silenciar (1 a 365 dias)",
  OPCOES_DO_LENTO.every((s) => s === 0 || (s >= 5 && s <= 86400)) && PRAZOS_DA_SONECA.every((d) => d === null || (d >= 1 && d <= 365)));

// ═══════════════════ 0b. As contas da tela ═══════════════════
ok("links contados como no banco", contarLinks("veja https://a.org e www.b.org e http://c.org") === 3 && contarLinks("sem link nenhum") === 0);
ok("domínios sem www e em minúsculas", JSON.stringify(dominiosDoTexto("olha https://WWW.Encurta.Exemplo/abc e www.sub.site.org/x e http://a.b.co")) === JSON.stringify(["encurta.exemplo", "sub.site.org", "a.b.co"]));
ok("domínio limpo do jeito que o banco guarda", limparDominio(" https://www.Encurta.Exemplo/abc ") === "encurta.exemplo" && limparDominio("nada") === null && limparDominio("") === null);
ok("previsão do filtro na ordem do gatilho", (() => {
  const base = { links_max: 1, dominios: ["encurta.exemplo"], modero: false, para_mim: { novata: true, lento_falta: 0 }, novatos_posts: 2 };
  return previsaoDoFiltro(base, "https://a.org https://b.org") === "automod_links"
    && previsaoDoFiltro(base, "https://x.encurta.exemplo/1") === "automod_dominio"
    && previsaoDoFiltro(base, "texto") === "recem_chegada"
    && previsaoDoFiltro({ ...base, novatos_posts: null }, "texto") === "automod_conta_nova"
    && previsaoDoFiltro({ ...base, para_mim: { novata: false, lento_falta: 0 } }, "texto") === null
    && previsaoDoFiltro({ ...base, modero: true }, "https://a.org https://b.org") === null;
})());
ok("minutos e horas arredondados para cima", JSON.stringify([emMinutos(600), emMinutos(125), emMinutos(3600), emMinutos(7200), emMinutos(30), emMinutos(5400)])
  === JSON.stringify([{ n: 10, unidade: "min" }, { n: 3, unidade: "min" }, { n: 1, unidade: "h" }, { n: 2, unidade: "h" }, { n: 30, unidade: "s" }, { n: 90, unidade: "min" }]));

// Os textos: as seis línguas com as mesmas chaves, listas do mesmo tamanho e os mesmos marcadores {x}; nenhuma palavra proibida.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/moderacao/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/moderacao/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`moderacao/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("o bloco novo não usa \"diploma\", \"universidade\" nem \"algoritmo\"", !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt.o9)));
  ok("todo motivo do filtro tem texto", MOTIVOS_DO_FILTRO.every((m) => typeof pt.o9.motivos[m] === "string"));
  ok("a categoria de conteúdo ilegal tem texto na fila", typeof pt.categorias.ilegal?.rotulo === "string");
  ok("todo erro novo do banco tem texto", ["responda_perguntas"].every((c) => typeof pt.erros[c] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
await espera("toda função pública nova passa pela porta", async () =>
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like any (array['alumia\\_mod\\_%', 'alumia\\_com\\_%', 'rede_mod_recursos'])`)).rows,
(rs) => rs.length === 10 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o9\\_%'`)).rows,
(rs) => rs.length === 9 && rs.every((r) => !r.a && !r.b));

const P = {};
const NOMES = ["coord", "mod", "modr", "membro", "membro2", "novata", "veterana", "autor", "fora1", "fora2", "fora3", "fora4", "fora5", "pede1", "pede2", "pede3"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o9.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o9_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono("update auth.users set created_at = now() - interval '2 days' where id = $1", [P.novata]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('o9-moradia', 'Moradia do teste', 'lutas', 'aberta', 'membros'),
  ('o9-fechadinha', 'Restrita do teste', 'lutas', 'restrita', 'membros') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('o9-moradia', $1, 'moderacao'), ('o9-moradia', $2, 'membro'), ('o9-moradia', $3, 'membro'), ('o9-moradia', $4, 'membro'),
  ('o9-moradia', $5, 'membro'), ('o9-moradia', $6, 'membro'), ('o9-fechadinha', $7, 'moderacao')`,
  [P.mod, P.membro, P.membro2, P.novata, P.veterana, P.autor, P.modr]);

const M = como(P.mod);
const postar = (quem, texto, extra = {}) => rpc(como(P[quem]), "rede_publicar", { p: { texto, ...extra } });
const linha = async (id) => (await dono("select retido, oculto, motivo, avaliacao from interno.rede_posts where id = $1", [id])).rows[0];
// O filtro geral do site (interno.veredito) já segura todo link de quem não é da equipe, com o motivo "endereco", antes do filtro
// da comunidade. Para provar o filtro da comunidade sozinho, o post entra direto na tabela com a sessão da pessoa (os gatilhos
// rodam do mesmo jeito, com auth.uid() dela), sem passar por rede_publicar.
const inserir = (quem, texto, comunidade = null) => banco.exclusivo(() => banco.pg.transaction(async (tx) => {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2" })]);
  return (await tx.query("insert into interno.rede_posts (autor, texto, comunidade) values ($1, $2, $3) returning id", [P[quem], texto, comunidade])).rows[0].id;
}));

// ═══════════════════ 2. Filtro automático ═══════════════════
await espera("sem filtro: a regra é aberta, visitante lê, sem lista e sem números da brigada", () => rpc(visitante, "alumia_mod_automod", { p_slug: "o9-moradia" }),
  (r) => r.comunidade === "o9-moradia" && r.links_max === null && r.palavras === false && r.modero === false && r.brigada === null && r.para_mim.novata === false);
await recusa("quem não modera não calibra", () => rpc(como(P.membro), "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { links_max: 0 } }), "sem_permissao");
await recusa("campo desconhecido é recusado", () => rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { ia_de_fora: true } }), "invalido:filtro");
await recusa("links acima do teto são recusados", () => rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { links_max: 99 } }), "invalido:links_max");
await recusa("domínio que não é domínio é recusado", () => rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { dominios: ["isto não"] } }), "invalido:dominios");
await recusa("brigada abaixo de 3 contas é recusada (número só a partir de 3)", () => rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { brigada_contas: 2 } }), "invalido:brigada");
await espera("a moderação calibra: links, domínios (limpos), explicação", () => rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { links_max: 1, dominios: ["https://www.Encurta.Exemplo/x", "encurta.exemplo"], explicacao: "Mais de um link ou link de encurtador espera a leitura da moderação." } }),
  (r) => r.links_max === 1 && JSON.stringify(r.dominios) === '["encurta.exemplo"]' && r.explicacao.startsWith("Mais de um link") && r.modero === true && r.brigada.contas === 10);
await espera("salvar de novo só o que veio (o resto fica)", () => rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { explicacao: "Mais de um link ou link de encurtador espera leitura." } }),
  (r) => r.links_max === 1 && r.dominios.length === 1);
await zerar();
await espera("o filtro geral do site continua valendo antes (link de quem não é da equipe espera, motivo dele)", async () => linha((await postar("membro", "veja https://a.org", { comunidade: "o9-moradia" })).id),
  (r) => r.retido && r.motivo === "endereco");
await rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { links_max: 0 } });
await espera("link acima do que a comunidade permite: o post nasce retido para leitura, com o motivo", async () => linha(await inserir("membro2", "veja https://a.org", "o9-moradia")),
  (r) => r.retido && r.oculto && r.motivo === "automod_links" && r.avaliacao === "revisao");
await rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { links_max: null } });
await espera("sem regra de links, um link passa pelo filtro da comunidade", async () => linha(await inserir("membro2", "veja https://a.org", "o9-moradia")), (r) => !r.retido && !r.oculto);
await espera("link do domínio da lista (subdomínio também) retém", async () => linha(await inserir("veterana", "olha https://x.encurta.exemplo/abc", "o9-moradia")),
  (r) => r.retido && r.motivo === "automod_dominio");
await espera("sem link, passa", async () => linha(await inserir("veterana", "post sem link nenhum", "o9-moradia")), (r) => !r.retido);
await rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { links_max: 0 } });
await espera("quem modera passa livre", async () => linha(await inserir("mod", "https://encurta.exemplo/1", "o9-moradia")), (r) => !r.retido);
await espera("fora da comunidade o filtro não vale", async () => linha(await inserir("autor", "veja https://encurta.exemplo/2")), (r) => !r.retido);
await espera("o retido aparece na fila Esperando leitura de quem modera, com o motivo", () => rpc(M, "rede_mod_retidos"),
  (r) => r.some((x) => x.motivo === "automod_links") && r.some((x) => x.motivo === "automod_dominio"));
await espera("palavra da lista da mediação: a regra diz que há lista, sem mostrar a lista", async () => {
  await rpc(M, "rede_mod_lista_adicionar", { p_escopo_tipo: "comunidade", p_escopo: "o9-moradia", p_tipo: "palavra", p_valor: "golpezinho", p_motivo: "" });
  return rpc(como(P.membro), "alumia_mod_automod", { p_slug: "o9-moradia" });
}, (r) => r.palavras === true && !JSON.stringify(r).includes("golpezinho"));

// ═══════════════════ 3. Conta nova e fila de recém-chegados ═══════════════════
await zerar();
await rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { links_max: null, dominios: [], conta_nova_dias: 7 } });
await espera("conta com menos de 7 dias: a regra diz que ela está na fila", () => rpc(como(P.novata), "alumia_mod_automod", { p_slug: "o9-moradia" }), (r) => r.para_mim.novata === true && r.conta_nova_dias === 7);
await espera("conta nova sozinha: todo post dela espera leitura", async () => linha((await postar("novata", "primeiro post da conta nova", { comunidade: "o9-moradia" })).id),
  (r) => r.retido && r.motivo === "automod_conta_nova");
await espera("conta antiga não espera", async () => linha((await postar("veterana", "post de conta antiga", { comunidade: "o9-moradia" })).id), (r) => !r.retido);
await rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { conta_nova_dias: null, novatos_posts: 1 } });
await zerar();
const primeiro = await espera("recém-chegados: o primeiro post de quem ainda não tem nenhum liberado aqui espera", async () => {
  const id = (await postar("veterana", "oi, sou nova por aqui? não: já tenho um liberado", { comunidade: "o9-moradia" })).id;
  const r1 = await linha(id);
  const id2 = (await postar("autor", "meu primeiro post na moradia", { comunidade: "o9-moradia" })).id;
  return { r1, r2: await linha(id2), id2 };
}, ({ r1, r2 }) => !r1.retido && r2.retido && r2.motivo === "recem_chegada");
await espera("liberado pela moderação, o próximo post não espera mais", async () => {
  await rpc(M, "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: primeiro.id2, p_acao: "restaurar", p_regra: "recem_chegada", p_motivo: "Post de boas-vindas, liberado." });
  return linha((await postar("autor", "segundo post, já conhecida", { comunidade: "o9-moradia" })).id);
}, (r) => !r.retido);
await rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { novatos_posts: null } });

// ═══════════════════ 4. Modo lento: quanto falta ═══════════════════
await zerar();
await rpc(M, "rede_mod_modo_lento", { p_tipo: "comunidade", p_alvo: "o9-moradia", p_segundos: 600, p_motivo: "" });
await espera("antes do primeiro post: falta zero", () => rpc(como(P.fora5), "alumia_mod_lento_falta", { p_tipo: "comunidade", p_alvo: "o9-moradia" }), (r) => r.segundos === 600 && r.falta === 0);
await espera("depois de postar: falta quase o intervalo inteiro", async () => {
  await postar("fora5", "post de quem é de fora, em comunidade aberta", { comunidade: "o9-moradia" });
  return rpc(como(P.fora5), "alumia_mod_lento_falta", { p_tipo: "comunidade", p_alvo: "o9-moradia" });
}, (r) => r.falta > 590 && r.falta <= 600);
await espera("as regras do lugar dizem o mesmo", () => rpc(como(P.fora5), "alumia_mod_automod", { p_slug: "o9-moradia" }), (r) => r.lento === 600 && r.para_mim.lento_falta > 590);
await recusa("e o banco barra o segundo post", () => postar("fora5", "de novo", { comunidade: "o9-moradia" }), "modo_lento");
await espera("quem modera não espera", async () => {
  await postar("mod", "aviso da moderação", { comunidade: "o9-moradia" });
  return rpc(M, "alumia_mod_lento_falta", { p_tipo: "comunidade", p_alvo: "o9-moradia" });
}, (r) => r.falta === 0);
await recusa("tipo desconhecido", () => rpc(M, "alumia_mod_lento_falta", { p_tipo: "planeta", p_alvo: "x" }), "invalido:tipo");
await rpc(M, "rede_mod_modo_lento", { p_tipo: "comunidade", p_alvo: "o9-moradia", p_segundos: 0, p_motivo: "" });

// ═══════════════════ 5. Alerta de brigada ═══════════════════
await zerar();
await rpc(M, "alumia_mod_automod_salvar", { p_slug: "o9-moradia", p: { brigada_contas: 3, brigada_minutos: 30 } });
const raizB = (await postar("autor", "Ocupação precisa de lona amanhã cedo.", { comunidade: "o9-moradia" })).id;
const responder = (quem) => postar(quem, `resposta de ${quem}`, { resposta_a: raizB });
const alertas = async () => (await dono("select * from interno.alumia_brigadas where post = $1", [raizB])).rows;
await espera("duas contas de fora: nada ainda", async () => { await responder("fora1"); await responder("fora2"); return alertas(); }, (r) => r.length === 0);
await espera("membro da comunidade respondendo não conta", async () => { await responder("membro"); await responder("veterana"); return alertas(); }, (r) => r.length === 0);
await espera("a terceira conta de fora acende o alerta, com o número e sem quem", async () => { await responder("fora3"); return alertas(); },
  (r) => r.length === 1 && r[0].contas === 3 && r[0].situacao === "aberto");
await espera("a moderação do lugar é avisada (e só ela)", async () => (await dono("select para from interno.avisos where texto like 'Alerta de brigada%'")).rows.map((x) => x.para),
  (r) => r.length === 1 && r[0] === P.mod);
await espera("a fila de alertas da moderação: o post, quantas contas e nenhuma conta de quem respondeu", () => rpc(M, "alumia_mod_brigadas"),
  (r) => r.length === 1 && r[0].contas === 3 && r[0].post === raizB && r[0].trecho.startsWith("Ocupação") && ["fora1", "fora2", "fora3"].every((n) => !JSON.stringify(r).includes(P[n]) && !JSON.stringify(r).includes(`o9_${n}`)));
await espera("quem não modera não vê alerta nenhum", () => rpc(como(P.membro), "alumia_mod_brigadas"), (r) => Array.isArray(r) && r.length === 0);
await espera("mais uma conta de fora: o mesmo alerta ganha o número novo", async () => { await responder("fora4"); return alertas(); }, (r) => r.length === 1 && r[0].contas === 4);
await recusa("quem não modera não encerra", async () => rpc(como(P.membro), "alumia_mod_brigada_encerrar", { p_id: (await alertas())[0].id }), "sem_permissao");
await espera("a moderação encerra", async () => rpc(M, "alumia_mod_brigada_encerrar", { p_id: (await alertas())[0].id }), (r) => r.ok === true);
await espera("encerrado não reabre dentro da mesma janela", async () => { await responder("fora5"); return alertas(); }, (r) => r.length === 1 && r[0].situacao === "encerrado");
await espera("a equipe vê os alertas de qualquer comunidade", async () => {
  await dono("update interno.alumia_brigadas set situacao = 'aberto', encerrado_em = null where post = $1", [raizB]);
  return rpc(como(P.coord), "alumia_mod_brigadas");
}, (r) => r.length === 1);

// ═══════════════════ 6. Perguntas para entrar ═══════════════════
await zerar();
const R = como(P.modr);
await recusa("quem não modera não escreve perguntas", () => rpc(como(P.membro), "alumia_com_perguntas_salvar", { p_slug: "o9-fechadinha", p_perguntas: ["Por que quer entrar?"] }), "sem_permissao");
await recusa("no máximo três perguntas", () => rpc(R, "alumia_com_perguntas_salvar", { p_slug: "o9-fechadinha", p_perguntas: ["Pergunta um?", "Pergunta dois?", "Pergunta três?", "Pergunta quatro?"] }), "invalido:perguntas");
await recusa("pergunta curta demais", () => rpc(R, "alumia_com_perguntas_salvar", { p_slug: "o9-fechadinha", p_perguntas: ["Oi?"] }), "invalido:pergunta");
await espera("a moderação escreve duas perguntas (linha vazia some)", () => rpc(R, "alumia_com_perguntas_salvar", { p_slug: "o9-fechadinha", p_perguntas: ["Em que bairro você atua?", "", "Por que quer entrar?"] }),
  (r) => r.perguntas.length === 2);
await espera("quem chega lê as perguntas antes de pedir", () => rpc(como(P.pede1), "alumia_com_perguntas", { p_slug: "o9-fechadinha" }), (r) => r.perguntas[0] === "Em que bairro você atua?");
await recusa("pedir pelo caminho antigo, sem responder, não entra na fila", () => rpc(como(P.pede1), "rede_com_entrar", { p_slug: "o9-fechadinha" }), "responda_perguntas");
await recusa("faltando uma resposta, não entra", () => rpc(como(P.pede1), "alumia_com_pedir", { p_slug: "o9-fechadinha", p_respostas: ["Centro"] }), "responda_perguntas");
await recusa("resposta vazia, não entra", () => rpc(como(P.pede1), "alumia_com_pedir", { p_slug: "o9-fechadinha", p_respostas: ["Centro", "  "] }), "invalido:resposta");
await espera("com as duas respostas, o pedido fica esperando", () => rpc(como(P.pede1), "alumia_com_pedir", { p_slug: "o9-fechadinha", p_respostas: ["Centro", "Fui despejada e quero ajudar."] }), (r) => r.situacao === "pendente");
await espera("outras duas pessoas pedem", async () => {
  await rpc(como(P.pede2), "alumia_com_pedir", { p_slug: "o9-fechadinha", p_respostas: ["Zona norte", "Comissão de moradores."] });
  return rpc(como(P.pede3), "alumia_com_pedir", { p_slug: "o9-fechadinha", p_respostas: ["Leste", "Quero aprender."] });
}, (r) => r.situacao === "pendente");
await espera("a moderação lê cada pedido com as respostas", () => rpc(R, "alumia_com_pedidos", { p_slug: "o9-fechadinha" }),
  (r) => r.perguntas.length === 2 && r.itens.length === 3 && r.itens.find((x) => x.usuario === P.pede1)?.respostas[1] === "Fui despejada e quero ajudar.");
await recusa("quem não modera não lê os pedidos", () => rpc(como(P.pede1), "alumia_com_pedidos", { p_slug: "o9-fechadinha" }), "sem_permissao");
const respostasDe = async (quem) => (await dono("select count(*)::int as n from interno.alumia_com_respostas where usuario = $1", [P[quem]])).rows[0].n;
await espera("aceito: as respostas somem", async () => { await rpc(R, "rede_com_decidir_pedido", { p_slug: "o9-fechadinha", p_usuario: P.pede1, p_aceita: true }); return respostasDe("pede1"); }, (n) => n === 0);
await espera("recusado: as respostas somem", async () => { await rpc(R, "rede_com_decidir_pedido", { p_slug: "o9-fechadinha", p_usuario: P.pede2, p_aceita: false }); return respostasDe("pede2"); }, (n) => n === 0);
await espera("desistiu: as respostas somem", async () => { await rpc(como(P.pede3), "rede_com_sair", { p_slug: "o9-fechadinha" }); return respostasDe("pede3"); }, (n) => n === 0);
await espera("sem perguntas, o caminho antigo volta a valer", async () => {
  await rpc(R, "alumia_com_perguntas_salvar", { p_slug: "o9-fechadinha", p_perguntas: [] });
  return rpc(como(P.pede3), "rede_com_entrar", { p_slug: "o9-fechadinha" });
}, (r) => r.situacao === "pendente");

// ═══════════════════ 7. Recursos com prazo ═══════════════════
await zerar();
await espera("a fila de recursos traz o prazo de resposta e se venceu", async () => {
  const id = (await postar("veterana", "um post que vai ser removido", { comunidade: "o9-moradia" })).id;
  await rpc(M, "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: id, p_acao: "remover", p_regra: "regra 2", p_motivo: "Fora do tema da comunidade." });
  const decisao = (await rpc(como(P.veterana), "rede_mod_minhas_decisoes")).find((d) => d.alvo === id);
  await rpc(como(P.veterana), "rede_mod_recorrer", { p_acao: decisao.id, p_texto: "Era sobre moradia, sim: o despejo foi aqui." });
  return rpc(como(P.coord), "rede_mod_recursos");
}, (r) => r.length >= 1 && r.every((x) => x.responder_ate && x.vencido === false) && r[0].acao.automatica === false && !JSON.stringify(r).includes(P.mod));

// ═══════════════════ 8. Nada de endereço de rede ═══════════════════
await espera("nenhuma coluna nova guarda endereço", async () =>
  (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta)($|_)/.test(c.column_name)));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`moderação da comunidade (onda 9): ${certos} conferências certas.`);
process.exit(0);
