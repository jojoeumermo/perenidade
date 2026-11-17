// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a proteção contra ataque da Alumia (supabase/migracoes/20261115-alumia-o9-protecao.sql) num Postgres de verdade (banco
// local, sem rede), com a migração rodada DUAS vezes sobre o install.sql. O que este teste PROVA:
//   - blindagem: por 24 h ou 7 dias, só quem a pessoa segue responde (pela função de publicar e por qualquer outro caminho que
//     grave a resposta), cita e menciona; desliga sozinha no fim do prazo e com um toque;
//   - restringir: a resposta da restrita fica "aguardando" (recolhida para os outros, aberta para quem escreveu, para a dona e
//     para a mediação), a dona libera, os avisos da restrita não chegam, e ninguém mais sabe quem a pessoa restringiu;
//   - desvincular citação: só quem foi citada solta, e quem citou não cita o mesmo post de novo;
//   - quem pode me mencionar: a menção fora da regra não vira aviso nem linha de menção;
//   - marcações: padrão "ninguém me marca", aceite antes de aparecer, proibido em post de ato e sem imagem;
//   - tabelas com RLS e sem política, funções security definer com search_path fixo e a porta em toda função pública;
//   - as peças puras do aparelho (o aviso de link suspeito) e os seis idiomas dos textos.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o9-protecao.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { analisarLink, linksDoTexto, PADROES_DE_LINK } from "../components/rede/protecao/link-suspeito.ts";
import { ateQuando, MENCAO, HORAS_DA_BLINDAGEM } from "../lib/rede/tipos-protecao.ts";

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

// ═══════════════════ 0. O arquivo, as peças puras e os textos ═══════════════════
const sql = ler("supabase/migracoes/20261115-alumia-o9-protecao.sql");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 25 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("não redefine rede_ve nem as leituras de post", !/function interno\.rede_ve\(|function interno\.rede_post_v2\(|function public\.rede_publicar\(|function interno\.rede3_conv_mencionar\(/.test(sql));
ok("não mexe na versão da Alumia", !/rede_alumia_versao/.test(sql));
ok("nenhum endereço de rede", !/\binet\b|x-forwarded-for|cf-connecting-ip|ip_address|\borigem\(/i.test(sql));
ok("a porta passa em toda função nova (alumia_trancar no fim)", /select interno\.alumia_trancar\(\);\s*$/.test(sql));

// O aviso de link suspeito: lista aberta, no aparelho, sem serviço de fora.
const motivos = (u) => analisarLink(u).motivos.sort().join();
ok("link comum não acusa nada", analisarLink("https://institutolucia.org/pt/alumia").suspeito === false && analisarLink("https://www.gov.br/inss").suspeito === false);
ok("endereço com número no lugar do nome", motivos("http://203.0.113.9/login").includes("numero"));
ok("nome com letras de outro alfabeto (punycode)", motivos("https://xn--instituolucia-9kb.org/") .includes("alfabeto"));
ok("encurtador esconde o destino", motivos("https://bit.ly/3abc") === "encurtador");
ok("arroba antes do endereço engana", motivos("https://gov.br@exemplo.ru/pagina").includes("arroba"));
ok("imitação de gov.br fora do gov.br", motivos("https://gov-br.pagamento-inss.com/").includes("imitacao") && !analisarLink("https://servicos.gov.br/").suspeito);
ok("imitação do Instituto fora do domínio dele", motivos("https://instituto-lucia.help/entrar").includes("imitacao") && !analisarLink("https://institutolucia.org/").suspeito);
ok("terminação que parece arquivo (.zip, .mov)", motivos("https://atualizacao.zip/").includes("terminacao"));
ok("sem cadeado (http)", motivos("http://exemplo.com.br/").includes("sem_cadeado"));
ok("javascript: e data: são perigo", analisarLink("javascript:alert(1)").perigo && analisarLink("data:text/html,oi").perigo);
ok("lixo não quebra", analisarLink("isso não é link").suspeito === false && analisarLink("").suspeito === false);
ok("os links de um texto são achados", linksDoTexto("veja https://bit.ly/x e http://203.0.113.9/a, e só texto").length === 2);
ok("a lista de padrões é aberta (exportada, com nome e explicação)", PADROES_DE_LINK.length >= 6 && PADROES_DE_LINK.every((p) => p.chave && typeof p.confere === "function"));
ok("a peça do link não chama a rede", !/fetch\(|XMLHttpRequest|navigator\.sendBeacon|import\(/.test(ler("components/rede/protecao/link-suspeito.ts")));
ok("blindagem: 24 h e 7 dias", HORAS_DA_BLINDAGEM.join() === "24,168" && MENCAO.join() === "todos,seguindo,ninguem");
ok("ateQuando: soma as horas", ateQuando(24, new Date("2026-11-15T10:00:00Z")).toISOString() === "2026-11-16T10:00:00.000Z");

const chavesDe = (v, p = "", s = new Map()) => {
  if (Array.isArray(v)) { s.set(p, `lista:${v.length}`); v.forEach((x, i) => chavesDe(x, `${p}[${i}]`, s)); }
  else if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) chavesDe(f, p ? `${p}.${k}` : k, s);
  else s.set(p, typeof v === "string" && v.trim() ? "texto" : "vazio");
  return s;
};
const marcas = (t) => (typeof t === "string" ? (t.match(/\{\w+\}/g) ?? []).sort().join() : "");
const textos = Object.fromEntries(["pt", "en", "es", "fr", "ru", "zh"].map((l) => [l, JSON.parse(ler(`i18n/rede/protecao/${l}.json`))]));
const refer = chavesDe(textos.pt);
const pegar = (o, k) => k.split(/\.|\[|\]/).filter(Boolean).reduce((x, c) => x?.[c], o);
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const atual = chavesDe(textos[l]);
  ok(`textos em ${l}: as mesmas chaves do português, nenhuma vazia`, refer.size === atual.size && [...refer].every(([k, tipo]) => atual.get(k) === tipo));
  ok(`textos em ${l}: os mesmos {marcadores}`, [...refer.keys()].every((k) => marcas(pegar(textos.pt, k)) === marcas(pegar(textos[l], k))));
}
ok("texto de tela novo sem palavra proibida", !/diploma|universidade|algoritmo/i.test(Object.values(textos).map((t) => JSON.stringify(t)).join()));
ok("as telas da proteção não carregam nada de fora", !/https?:\/\/(?!institutolucia)/.test(
  fs.readdirSync(path.join(raiz, "components/rede/protecao")).filter((n) => /\.(tsx|ts|css)$/.test(n) && n !== "link-suspeito.ts").map((n) => ler(`components/rede/protecao/${n}`)).join("\n")));

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
/** Chama uma função como a API faria. O rpc do banco local só aceita nome sem algarismo, e as funções desta frente têm "o9". */
const rpc = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    if (!/^[a-z0-9_]+$/.test(funcao)) throw new Error("função inválida");
    const nomes = Object.keys(argumentos);
    const claims = JSON.stringify({ role: quem.papel, ...(quem.sub ? { sub: quem.sub } : {}) });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, JSON.stringify({})]);
    await banco.pg.exec(`set role ${quem.papel === "anon" ? "anon" : "authenticated"}`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      const valores = nomes.map((n) => {
        const v = argumentos[n];
        return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
      });
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("a regra dos tipos de aviso ganhou 'marcacao' sem perder nenhum tipo", async () => {
  const def = (await um("select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'interno.avisos'::regclass and conname = 'avisos_tipo'")).d;
  return ["resposta", "mencao", "citacao", "seguidor", "chamado", "nucleo", "moderacao", "apoio", "conversa_seguida", "ajudou", "ato", "reacao_story", "lembrete", "marcacao"].filter((t) => !def.includes(t));
}, (faltam) => faltam.length === 0);


const como = (sub) => ({ papel: "authenticated", sub });
const visitante = () => ({ papel: "anon" });

const P = {};
const nomes = ["ana", "bia", "caio", "duda", "eva", "mod"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o9.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${i + 1}`, `p_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
const zerar = () => dono("delete from interno.limites");
const seguir = (quem, segue) => dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P[quem], P[segue]]);
const publicar = (quem, campos) => rpc(como(P[quem]), "rede_publicar", { p: { texto: "Um post de teste da proteção.", ...campos } });
const avisos = async (para, tipo) => (await um("select count(*)::int as n from interno.avisos where para = $1 and tipo = $2", [P[para], tipo])).n;

// ═══════════════════ 2. Tabelas, funções e porta ═══════════════════
const TABELAS = ["rede_o9_prefs", "rede_o9_restritos", "rede_o9_liberadas", "rede_o9_soltas", "rede_o9_marcacoes"];
for (const tabela of TABELAS) {
  await espera(`${tabela}: RLS ligada`, async () => (await um("select relrowsecurity as r from pg_class where oid = $1::regclass", [`interno.${tabela}`])).r, (r) => r === true);
  await espera(`${tabela}: nenhuma política`, async () => (await um("select count(*)::int as n from pg_policies where schemaname = 'interno' and tablename = $1", [tabela])).n, (n) => n === 0);
  await espera(`${tabela}: nenhuma permissão para anon/authenticated`, async () =>
    (await um("select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and table_name = $1 and grantee in ('anon', 'authenticated', 'PUBLIC')", [tabela])).n, (n) => n === 0);
}
const PUBLICAS = ["rede_o9_protecao", "rede_o9_blindagem", "rede_o9_preferir", "rede_o9_restringir", "rede_o9_restritos", "rede_o9_liberar",
  "rede_o9_aguardando_na_conversa", "rede_o9_citacao_soltar", "rede_o9_marcar", "rede_o9_desmarcar", "rede_o9_marcacoes_pendentes",
  "rede_o9_marcacao_decidir", "rede_o9_cartoes"];
await espera("toda função pública passa pela porta da entrada", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)", [PUBLICAS])).rows,
(rs) => rs.length === PUBLICAS.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
await espera("a regra das portas não acha função da rede aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r.abertas) && r.abertas.length === 0);
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede\\_o9\\_%'`)).rows,
(rs) => rs.length >= 10 && rs.every((r) => !r.a && !r.b));
await recusa("visitante não liga blindagem", () => rpc(visitante(), "rede_o9_blindagem", { p_horas: 24 }), "permission denied");
await recusa("visitante não restringe", () => rpc(visitante(), "rede_o9_restringir", { p_handle: "p_ana" }), "permission denied");

// ═══════════════════ 3. Blindagem ═══════════════════
await seguir("ana", "bia"); // ana segue bia: bia continua podendo responder
// Post novo nasce com "ninguém cita" (20261110-alumia-b1-casca.sql): os posts citados aqui abrem para todos.
const citavel = (id) => dono("update interno.rede_b1_post set citar_quem = 'todos' where post = $1", [id]).then(() => id);
const postAna = await citavel((await publicar("ana", { texto: "Post da ana, @p_duda vai ler." })).id);
await espera("estado inicial: sem blindagem, todos mencionam, ninguém marca, aprovar ligado", () => rpc(como(P.ana), "rede_o9_protecao"),
  (r) => r.blindagem_ate === null && r.mencao_quem === "todos" && r.marcar_quem === "ninguem" && r.marcar_aprovar === true && r.restritos === 0);
await recusa("horas fora da lista", () => rpc(como(P.ana), "rede_o9_blindagem", { p_horas: 5 }), "invalido:horas");
await espera("liga por 24 horas com um toque", () => rpc(como(P.ana), "rede_o9_blindagem", { p_horas: 24 }),
  (r) => Math.abs(new Date(r.blindagem_ate).getTime() - Date.now() - 24 * 3600e3) < 120e3);
await recusa("blindada: quem ela não segue não responde", () => publicar("caio", { resposta_a: postAna, texto: "Resposta de quem ela não segue." }), "protegido");
await recusa("blindada: nem por outro caminho que grave a resposta", () =>
  dono("insert into interno.rede_posts (autor, texto, publico, resposta_a, root_id, profundidade) values ($1, 'Por fora.', 'membros', $2, $2, 1)", [P.caio, postAna]), "protegido");
const respBia = await espera("blindada: quem ela segue responde", () => publicar("bia", { resposta_a: postAna, texto: "Resposta de quem ela segue." }), (r) => r?.id);
await recusa("blindada: nem responder à resposta de outra pessoa dentro da conversa dela", () => publicar("caio", { resposta_a: respBia?.id, texto: "Dentro da conversa." }), "protegido");
await espera("blindada: ela mesma responde", () => publicar("ana", { resposta_a: postAna, texto: "A própria ana." }), (r) => r?.id);
await recusa("blindada: quem ela não segue não cita", () => rpc(como(P.caio), "rede_conv_citar", { p: { texto: "Citando a ana.", citar: postAna } }), "protegido");
await zerar();
await espera("blindada: quem ela não segue menciona, mas não vira aviso nem linha de menção", async () => {
  const antes = await avisos("ana", "mencao");
  const x = await publicar("caio", { texto: "Oi @p_ana, olha isso." });
  const linha = await um("select count(*)::int as n from interno.rede_mencoes where post = $1", [x.id]);
  return { novos: (await avisos("ana", "mencao")) - antes, linha: linha.n };
}, (r) => r.novos === 0 && r.linha === 0);
await espera("blindada: quem ela segue menciona e o aviso chega", async () => {
  const antes = await avisos("ana", "mencao");
  await publicar("bia", { texto: "Oi @p_ana, de quem você segue." });
  return (await avisos("ana", "mencao")) - antes;
}, (n) => n === 1);
await espera("o prazo vencido desliga sozinho", async () => {
  await dono("update interno.rede_o9_prefs set blindagem_ate = now() - interval '1 minute' where usuario = $1", [P.ana]);
  const st = await rpc(como(P.ana), "rede_o9_protecao");
  const x = await publicar("caio", { resposta_a: postAna, texto: "Depois do prazo." });
  return { st, x };
}, ({ st, x }) => st.blindagem_ate === null && !!x?.id);
await zerar();
await espera("7 dias e desligar antes", async () => {
  const a = await rpc(como(P.ana), "rede_o9_blindagem", { p_horas: 168 });
  const b = await rpc(como(P.ana), "rede_o9_blindagem", { p_horas: 0 });
  return { a, b };
}, ({ a, b }) => Math.abs(new Date(a.blindagem_ate).getTime() - Date.now() - 168 * 3600e3) < 120e3 && b.blindagem_ate === null);

// ═══════════════════ 4. Quem pode me mencionar ═══════════════════
await zerar();
await espera("escolha: só quem eu sigo me menciona", () => rpc(como(P.duda), "rede_o9_preferir", { p: { mencao_quem: "seguindo" } }), (r) => r.mencao_quem === "seguindo");
await recusa("escolha inválida", () => rpc(como(P.duda), "rede_o9_preferir", { p: { mencao_quem: "quase" } }), "invalido:mencao_quem");
await espera("menção de quem ela não segue não avisa", async () => {
  const antes = await avisos("duda", "mencao");
  await publicar("caio", { texto: "Chamando @p_duda pra ver." });
  return (await avisos("duda", "mencao")) - antes;
}, (n) => n === 0);
await seguir("duda", "caio");
await espera("depois de seguir, a menção avisa", async () => {
  const antes = await avisos("duda", "mencao");
  await publicar("caio", { texto: "De novo, @p_duda, agora você me segue." });
  return (await avisos("duda", "mencao")) - antes;
}, (n) => n === 1);
await zerar();
await espera("ninguém me menciona", async () => {
  await rpc(como(P.duda), "rede_o9_preferir", { p: { mencao_quem: "ninguem" } });
  const antes = await avisos("duda", "mencao");
  await publicar("caio", { texto: "Mais uma, @p_duda." });
  return (await avisos("duda", "mencao")) - antes;
}, (n) => n === 0);

// ═══════════════════ 5. Restringir ═══════════════════
await zerar();
const postBia = (await publicar("bia", { texto: "Conversa da bia sobre o ato de sexta." })).id;
await recusa("não se restringe a si mesma", () => rpc(como(P.bia), "rede_o9_restringir", { p_handle: "p_bia" }), "invalido:propria");
await recusa("@ que não existe", () => rpc(como(P.bia), "rede_o9_restringir", { p_handle: "ninguem_aqui" }), "nao_encontrado");
await espera("bia restringe o caio (com ou sem @)", () => rpc(como(P.bia), "rede_o9_restringir", { p_handle: "@p_caio" }), (r) => r.restrita === true);
const antesResp = await avisos("bia", "resposta");
const respCaio = await espera("a restrita continua respondendo (nada é recusado)", () => publicar("caio", { resposta_a: postBia, texto: "Resposta do caio, que foi restrito." }), (r) => r?.id);
await espera("o aviso da resposta da restrita não chega", async () => (await avisos("bia", "resposta")) - antesResp, (n) => n === 0);
const cartao = (quem, id) => rpc(quem ? como(P[quem]) : visitante(), "rede_o9_cartoes", { p_ids: [id] }).then((r) => r[id]);
await espera("para os outros a resposta sai do fio: nem cartão, nem carimbo (ninguém deduz quem restringiu quem)", () => cartao("eva", respCaio.id), (c) => c === undefined);
await espera("para visitante também", () => rpc(visitante(), "rede_o9_cartoes", { p_ids: [respCaio.id] }), (r) => r[respCaio.id] === undefined);
await espera("e o post não abre para os outros", () => rpc(como(P.eva), "rede_post", { p_id: respCaio.id }).then((r) => JSON.stringify(r)).catch((e) => e.message), (r) => !r.includes("Resposta do caio"));
await espera("nem conta nas respostas da conversa para os outros", () => rpc(como(P.eva), "rede_post", { p_id: postBia }).then((r) => r.post?.respostas ?? r.respostas), (n) => n === 0);
await espera("para quem escreveu: aguardando, mas não recolhida (a tela diz a verdade a ela)", () => cartao("caio", respCaio.id), (c) => c.aguardando && !c.recolhida && !c.dona && c.restringi === false);
await espera("para a dona: aguardando, abre com um toque e pode liberar", () => cartao("bia", respCaio.id), (c) => c.aguardando && !c.recolhida && c.dona);
await espera("a tela da conversa não recebe id nenhum de quem não vê a resposta", () => rpc(como(P.eva), "rede_o9_aguardando_na_conversa", { p_post: postBia }), (r) => r.ids.length === 0 && r.dona === false);
await espera("a dona recebe a lista vazia (ela vê tudo) e sabe que é dona", () => rpc(como(P.bia), "rede_o9_aguardando_na_conversa", { p_post: postBia }), (r) => r.ids.length === 0 && r.dona === true);
await recusa("outra pessoa não libera (nem acha a resposta)", () => rpc(como(P.eva), "rede_o9_liberar", { p_resposta: respCaio.id }), "nao_encontrado");
await espera("a dona libera e a resposta volta para todos", async () => {
  const r = await rpc(como(P.bia), "rede_o9_liberar", { p_resposta: respCaio.id });
  return { r, c: await cartao("eva", respCaio.id), d: await cartao("bia", respCaio.id) };
}, ({ r, c, d }) => r.liberada && !c.aguardando && !c.recolhida && c.liberada && d.dona);
await espera("e pode recolher de novo", async () => {
  await rpc(como(P.bia), "rede_o9_liberar", { p_resposta: respCaio.id, p_sim: false });
  return cartao("eva", respCaio.id);
}, (c) => c === undefined);
await espera("a menção da restrita não avisa a dona", async () => {
  const antes = await avisos("bia", "mencao");
  await publicar("caio", { texto: "Falando da @p_bia aqui." });
  return (await avisos("bia", "mencao")) - antes;
}, (n) => n === 0);
await espera("a lista de restritos é só dela", () => rpc(como(P.bia), "rede_o9_restritos"), (l) => l.length === 1 && l[0].handle === "p_caio" && !("id" in l[0]));
await espera("o cartão diz à dona que ela restringiu a autora; a ninguém mais", async () => [await cartao("bia", respCaio.id), await cartao("caio", respCaio.id), await cartao("eva", respCaio.id)],
  ([b, c, e]) => b.restringi === true && c.restringi === false && e === undefined);
await espera("a menção a uma terceira numa resposta recolhida não vira aviso (o texto não sai por fora do fio)", async () => {
  const antes = await avisos("eva", "mencao");
  await publicar("caio", { resposta_a: postBia, texto: "SEGREDO_RECOLHIDO contra a bia, olha @p_eva" });
  return { n: (await avisos("eva", "mencao")) - antes, meus: JSON.stringify(await rpc(como(P.eva), "avisos_meus", {})), rede: JSON.stringify(await rpc(como(P.eva), "rede_avisos", {})) };
}, (r) => r.n === 0 && !r.meus.includes("SEGREDO_RECOLHIDO") && !r.rede.includes("SEGREDO_RECOLHIDO"));
await espera("deixar de restringir devolve tudo", async () => {
  await rpc(como(P.bia), "rede_o9_restringir", { p_handle: "p_caio", p_sim: false });
  return cartao("eva", respCaio.id);
}, (c) => !c.aguardando && !c.recolhida);

// ═══════════════════ 6. Desvincular citação ═══════════════════
await zerar();
const postEva = await citavel((await publicar("eva", { texto: "Post da eva que vai ser citado." })).id);
const citacao = await espera("caio cita a eva", () => rpc(como(P.caio), "rede_conv_citar", { p: { texto: "Citando a eva.", citar: postEva } }), (r) => r?.id);
await espera("o cartão diz à eva que a citação é de um post dela", () => cartao("eva", citacao.id), (c) => c.citacao_minha && !c.solta);
await espera("e a ninguém mais", () => cartao("duda", citacao.id), (c) => !c.citacao_minha);
await recusa("outra pessoa não desvincula", () => rpc(como(P.duda), "rede_o9_citacao_soltar", { p_post: citacao.id }), "sem_permissao");
await espera("a eva desvincula", () => rpc(como(P.eva), "rede_o9_citacao_soltar", { p_post: citacao.id }), (r) => r.solta === true);
await espera("a citação continua no ar, sem o post dentro", () => um("select quote_of, apagado_em from interno.rede_posts where id = $1", [citacao.id]), (r) => r.quote_of === null && r.apagado_em === null);
await espera("o cartão mostra que foi desvinculada", () => cartao("duda", citacao.id), (c) => c.solta === true && !c.citacao_minha);
await espera("desvincular de novo não quebra", () => rpc(como(P.eva), "rede_o9_citacao_soltar", { p_post: citacao.id }), (r) => r.solta === true);
await recusa("quem citou não cita o mesmo post de novo", () => rpc(como(P.caio), "rede_conv_citar", { p: { texto: "Citando de novo.", citar: postEva } }), "citacao_solta");
await espera("outra pessoa cita normalmente", () => rpc(como(P.duda), "rede_conv_citar", { p: { texto: "Eu cito.", citar: postEva } }), (r) => r?.id);

// ═══════════════════ 7. Marcações ═══════════════════
await zerar();
const comImagem = async (quem, extra = "") => {
  const id = (await um(`insert into interno.rede_posts (autor, texto, publico${extra ? ", chamado" : ""}) values ($1, 'Foto da plenária.', 'membros'${extra ? ", $2" : ""}) returning id`,
    extra ? [P[quem], extra] : [P[quem]])).id;
  await dono("insert into interno.rede_midia (post, caminho, tipo, alt, ordem) values ($1, $2, 'image/webp', 'Mesa da plenária', 0)", [id, `${P[quem]}/${crypto.randomUUID()}.webp`]);
  return id;
};
const foto = await comImagem("ana");
await recusa("padrão: ninguém me marca", () => rpc(como(P.ana), "rede_o9_marcar", { p_post: foto, p_handle: "p_eva" }), "marcar_fechado");
await rpc(como(P.eva), "rede_o9_preferir", { p: { marcar_quem: "todos" } });
await recusa("só a autora marca", () => rpc(como(P.bia), "rede_o9_marcar", { p_post: foto, p_handle: "p_eva" }), "sem_permissao");
const semImagem = (await publicar("ana", { texto: "Sem imagem nenhuma." })).id;
await recusa("post sem imagem não tem marcação", () => rpc(como(P.ana), "rede_o9_marcar", { p_post: semImagem, p_handle: "p_eva" }), "invalido:sem_imagem");
const ato = await comImagem("ana", JSON.stringify({ tipo: "ato", quando: "2026-11-20T18:00:00Z", onde: "Praça" }));
await recusa("post de ato não tem marcação", () => rpc(como(P.ana), "rede_o9_marcar", { p_post: ato, p_handle: "p_eva" }), "marcar_ato");
await espera("marcar: nasce pendente e avisa", async () => {
  const antes = await avisos("eva", "marcacao");
  const r = await rpc(como(P.ana), "rede_o9_marcar", { p_post: foto, p_handle: "p_eva" });
  return { r, n: (await avisos("eva", "marcacao")) - antes };
}, ({ r, n }) => r.estado === "pendente" && n === 1);
await espera("pendente não aparece para ninguém", () => cartao("duda", foto), (c) => c.marcacoes.length === 0);
await espera("a marcada vê a pendência dela", async () => [await rpc(como(P.eva), "rede_o9_marcacoes_pendentes"), await rpc(como(P.eva), "rede_o9_protecao")],
  ([l, st]) => l.length === 1 && l[0].post === foto && l[0].handle === "p_ana" && st.marcacoes_pendentes === 1);
await espera("aceita e aparece", async () => {
  const r = await rpc(como(P.eva), "rede_o9_marcacao_decidir", { p_post: foto, p_aceitar: true });
  return { r, c: await cartao("duda", foto), e: await cartao("eva", foto) };
}, ({ r, c, e }) => r.estado === "aprovada" && c.marcacoes.length === 1 && c.marcacoes[0].handle === "p_eva" && e.minha_marcacao === "aprovada");
await espera("a marcada tira a própria marcação e não é marcada de novo ali", async () => {
  await rpc(como(P.eva), "rede_o9_desmarcar", { p_post: foto, p_handle: "p_eva" });
  const c = await cartao("duda", foto);
  const de_novo = await rpc(como(P.ana), "rede_o9_marcar", { p_post: foto, p_handle: "p_eva" });
  return { c, de_novo };
}, ({ c, de_novo }) => c.marcacoes.length === 0 && de_novo.estado === "feita");
await espera("sem 'aprovar antes', a marcação aparece direto", async () => {
  await rpc(como(P.duda), "rede_o9_preferir", { p: { marcar_quem: "todos", marcar_aprovar: false } });
  const r = await rpc(como(P.ana), "rede_o9_marcar", { p_post: foto, p_handle: "p_duda" });
  return { r, c: await cartao("bia", foto) };
}, ({ r, c }) => r.estado === "aprovada" && c.marcacoes.some((m) => m.handle === "p_duda"));
await espera("recusar some e não se refaz", async () => {
  await rpc(como(P.bia), "rede_o9_preferir", { p: { marcar_quem: "seguindo" } });
  await seguir("bia", "ana");
  await rpc(como(P.ana), "rede_o9_marcar", { p_post: foto, p_handle: "p_bia" });
  const r = await rpc(como(P.bia), "rede_o9_marcacao_decidir", { p_post: foto, p_aceitar: false });
  const c = await cartao("eva", foto);
  return { r, c };
}, ({ r, c }) => r.estado === "recusada" && !c.marcacoes.some((m) => m.handle === "p_bia"));
await recusa("'só quem eu sigo' recusa quem ela não segue", async () => {
  await rpc(como(P.eva), "rede_o9_preferir", { p: { marcar_quem: "seguindo" } });
  const outra = await comImagem("caio");
  return rpc(como(P.caio), "rede_o9_marcar", { p_post: outra, p_handle: "p_eva" });
}, "marcar_fechado");

// ═══════════════════ 8. Nada de endereço de rede, nada de lista dos outros ═══════════════════
await espera("nenhuma coluna nova guarda endereço de rede", async () =>
  (await dono("select column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name like 'rede_o9_%'")).rows,
(cs) => cs.length > 0 && !cs.some((c) => /ip|endereco|origem/.test(c.column_name) || c.data_type === "inet"));

console.log(`testar-alumia-o9-protecao: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
