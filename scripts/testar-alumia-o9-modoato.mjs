// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 9C (modo ato e depois do ato):
//   aparelho     o estado do modo ato no aparelho (liga, desliga, vence em 18 horas, guarda a assessoria escolhida, aguenta lixo);
//   dados        a placa de carro (Mercosul e antiga) e o telefone fixo avisam; CPF, celular, e-mail e endereço bloqueiam;
//   antes        a verificação antes de publicar: bloqueia o dado duro, avisa UMA vez a placa e a foto no modo ato;
//   textos       os seis idiomas com as mesmas chaves e os mesmos marcadores; nenhuma palavra proibida;
//   banco        a migração 20261115-alumia-o9-modoato.sql num Postgres de verdade (scripts/banco-local.mjs), rodada DUAS vezes:
//                contatos só com aceite, "estou bem" só para quem aceitou e some em 24 horas, "fui detido" só com o interruptor do
//                painel e chega à assessoria da organização com selo, ninguém lê o que não é seu, nenhum endereço de rede.
// Uso: npm run testar:alumia-o9-modoato
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { CHAVE_DO_MODO_ATO, DURACAO_MAXIMA_MS, escolherOrg, lerModoAto, trocarModoAto } from "../lib/rede/modoato/aparelho.ts";
import { acharDadosPessoais } from "../lib/rede/modoato/dados-pessoais.ts";
import { verificarAntesDePublicar, JANELA_DO_SEGUNDO_TOQUE_MS } from "../lib/rede/modoato/antes-de-publicar.ts";

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

// ═══════════════════ 1. O aparelho ═══════════════════
const armazem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
{
  const a = armazem();
  const t0 = 1_800_000_000_000;
  ok("aparelho: começa desligado", lerModoAto(a, t0).ligado === false);
  trocarModoAto(a, true, t0);
  ok("aparelho: liga e guarda desde quando", lerModoAto(a, t0 + 1000).ligado && lerModoAto(a, t0 + 1000).desde === t0);
  trocarModoAto(a, true, t0 + 5000);
  ok("aparelho: ligar de novo não muda o desde", lerModoAto(a, t0 + 6000).desde === t0);
  ok("aparelho: desliga sozinho depois de 18 horas", lerModoAto(a, t0 + DURACAO_MAXIMA_MS + 1).ligado === false);
  escolherOrg(a, "@Coletivo_Faisca", t0 + 7000);
  ok("aparelho: guarda a assessoria sem o @ e em minúsculas", lerModoAto(a, t0 + 8000).org === "coletivo_faisca");
  escolherOrg(a, "nada de <script>", t0 + 9000);
  ok("aparelho: @ torto vira nulo", lerModoAto(a, t0 + 9000).org === null);
  trocarModoAto(a, false, t0 + 10_000);
  ok("aparelho: desligado e sem assessoria, nada fica guardado", !a.m.has(CHAVE_DO_MODO_ATO));
  a.setItem(CHAVE_DO_MODO_ATO, "{lixo");
  ok("aparelho: lixo no armazém vale desligado", lerModoAto(a, t0).ligado === false);
  a.setItem(CHAVE_DO_MODO_ATO, JSON.stringify({ ligado: true, desde: t0 + 3_600_000, org: null }));
  ok("aparelho: desde no futuro vale desligado", lerModoAto(a, t0).ligado === false);
  const quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cheio"); }, removeItem: () => { throw new Error("x"); } };
  ok("aparelho: armazém que falha não quebra", lerModoAto(quebrado).ligado === false && trocarModoAto(quebrado, true).ligado === true);
  ok("aparelho: sem armazém, desligado", lerModoAto(null).ligado === false);
}

// ═══════════════════ 2. Dados pessoais ═══════════════════
{
  const tipos = (t) => acharDadosPessoais(t).map((a) => `${a.tipo}:${a.bloqueia ? "b" : "a"}`).join(",");
  ok("dados: placa Mercosul avisa", tipos("o carro ABC1D23 parou na esquina") === "placa:a");
  ok("dados: placa Mercosul em minúsculas avisa", tipos("placa abc1d23") === "placa:a");
  ok("dados: placa antiga avisa", tipos("viatura ABC-1234 na frente") === "placa:a" && tipos("viatura ABC1234") === "placa:a");
  ok("dados: ano e palavra em minúsculas não é placa", tipos("ato 2026 na praça") === "" && tipos("abc-1234") === "");
  ok("dados: telefone fixo avisa", tipos("plantão (11) 3333-4444") === "fixo:a");
  ok("dados: celular bloqueia (checagem do compositor)", tipos("me liga 11 98765-4321") === "telefone:b");
  ok("dados: CPF bloqueia", tipos("cpf 123.456.789-09") === "cpf:b");
  ok("dados: endereço com número bloqueia", tipos("na rua das Flores, 120") === "endereco:b");
  ok("dados: texto comum passa", tipos("Todo mundo às 17h na praça da Sé!") === "");
}

// ═══════════════════ 3. Antes de publicar ═══════════════════
{
  const t = { cpf: "C {trecho}", telefone: "T {trecho}", email: "E {trecho}", endereco: "R {trecho}", placa: "P {trecho}", fixo: "F {trecho}", foto: "FOTO" };
  const memoria = new Map();
  const v = (texto, extras = {}, modoAto = false, agora = 1000) => verificarAntesDePublicar({ texto, extras }, { t, modoAto, memoria, agora });
  ok("antes: texto comum passa", v("bom dia").ok === true);
  const cpf = v("cpf 123.456.789-09");
  ok("antes: CPF para sempre", cpf.ok === false && cpf.aviso === "C 123.456.789-09" && v("cpf 123.456.789-09").ok === false);
  const p1 = v("viatura ABC1D23");
  ok("antes: placa para uma vez com o trecho", p1.ok === false && p1.aviso === "P ABC1D23");
  ok("antes: o segundo toque com o mesmo texto passa", v("viatura ABC1D23", {}, false, 2000).ok === true);
  ok("antes: depois da janela, avisa de novo", v("viatura ABC1D23", {}, false, 3000 + JANELA_DO_SEGUNDO_TOQUE_MS).ok === false);
  ok("antes: foto fora do modo ato passa", v("foto do ato", { imagens: 2 }).ok === true);
  const f1 = v("foto do ato", { imagens: 2 }, true, 5000);
  ok("antes: foto no modo ato para uma vez", f1.ok === false && f1.aviso === "FOTO" && v("foto do ato", { imagens: 2 }, true, 6000).ok === true);
  ok("antes: foto já toda borrada passa", v("outra foto", { imagens: 1, imagensSemBorrar: 0 }, true).ok === true);
  ok("antes: sem a contagem de fotos, não para", v("sem contagem", {}, true).ok === true);
  memoria.clear();
  const a1 = v("placa ABC1D23 na foto", { imagens: 1 }, true, 10_000);
  const a2 = v("placa ABC1D23 na foto", { imagens: 1 }, true, 11_000);
  const a3 = v("placa ABC1D23 na foto", { imagens: 1 }, true, 12_000);
  ok("antes: placa e foto juntas avisam uma de cada vez e depois passam", a1.aviso === "P ABC1D23" && a2.aviso === "FOTO" && a3.ok === true);
}

// ═══════════════════ 4. Textos ═══════════════════
{
  const chaves = (v, p = "", s = new Map()) => {
    if (Array.isArray(v)) { s.set(p, `lista:${v.length}`); v.forEach((x, i) => chaves(x, `${p}[${i}]`, s)); }
    else if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) chaves(f, p ? `${p}.${k}` : k, s);
    else s.set(p, typeof v === "string" && v.trim() ? (v.match(/\{\w+\}/g) ?? []).sort().join() : "VAZIO");
    return s;
  };
  const pt = chaves(JSON.parse(ler("i18n/rede/modoato/pt.json")));
  for (const lang of ["en", "es", "fr", "ru", "zh"]) {
    const outro = chaves(JSON.parse(ler(`i18n/rede/modoato/${lang}.json`)));
    const dif = [...pt].filter(([k, v]) => outro.get(k) !== v).concat([...outro].filter(([k]) => !pt.has(k)));
    ok(`textos: ${lang} com as mesmas chaves e marcadores do pt${dif.length ? ` (${dif.slice(0, 3).map(([k]) => k).join(", ")})` : ""}`, dif.length === 0);
  }
  const tudo = ["pt", "en", "es", "fr", "ru", "zh"].map((l) => ler(`i18n/rede/modoato/${l}.json`)).join("\n").toLowerCase();
  ok("textos: nenhuma palavra proibida", !/diploma|universidade|algoritmo|university|algorithm/.test(tudo));
}

// ═══════════════════ 5. O arquivo da migração ═══════════════════
const sql = ler("supabase/migracoes/20261115-alumia-o9-modoato.sql");
ok("toda função security definer tem search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 17 && funcoes.filter((f) => /security definer/.test(f)).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("toda função public é security definer", (() => {
  const publicas = sql.match(/create or replace function public\.[^(]+\([\s\S]*?\$\$/g) ?? [];
  return publicas.length === 9 && publicas.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a migração não apaga tabela nem coluna", !/drop table|drop column/i.test(sql));
ok("nenhum endereço de rede é lido nem guardado", !/x-forwarded-for|cf-connecting-ip|\binet\b|interno\.origem\(\)|request\.headers/i.test(sql));
ok("nenhuma localização", !/latitude|longitude|geolocal|\bgps\b/i.test(sql));

// ═══════════════════ 6. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.alumia_ato_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r,
  (r) => Array.isArray(r?.abertas) && !r.abertas.some((x) => x.startsWith("alumia_ato")));
await espera("as funções da tela passam pela porta; as de dentro não são da API", async () => um(`select
    pg_get_functiondef('public.alumia_ato_estou_bem()'::regprocedure) as e, pg_get_functiondef('public.alumia_ato_fui_detido(text)'::regprocedure) as d,
    has_function_privilege('anon', 'public.alumia_ato_situacao()', 'execute') as anon_ve,
    has_function_privilege('authenticated', 'interno.alumia_ato_faxina()', 'execute') as faxina_aut,
    has_function_privilege('authenticated', 'interno.alumia_ato_situacao_de(uuid)', 'execute') as sit_aut`),
  (r) => r.e.includes("alumia_porta") && r.d.includes("alumia_porta") && !r.anon_ve && !r.faxina_aut && !r.sit_aut);
await espera("as três tabelas com RLS ligada e sem política", async () => um(`select
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('alumia_ato_contatos', 'alumia_ato_sinais', 'alumia_assessorias') and c.relrowsecurity)::int as rls,
    (select count(*) from pg_policies where schemaname = 'interno' and tablename in ('alumia_ato_contatos', 'alumia_ato_sinais', 'alumia_assessorias'))::int as politicas,
    (select count(*) from information_schema.columns where table_schema = 'interno' and table_name in ('alumia_ato_contatos', 'alumia_ato_sinais', 'alumia_assessorias') and (data_type = 'inet' or column_name ~ '(^ip|_ip$|endereco)'))::int as rede`),
  (r) => r.rls === 3 && r.politicas === 0 && r.rede === 0);

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const chamar = (quem, funcao, args = {}) => rpc(como(quem), funcao, args);

const P = {};
const nomes = ["dona", "amiga", "irma", "estranha", "gestora", "coletivo"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o9.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o9`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
// O coletivo é uma organização com selo; a gestora gere a conta dele.
await dono("insert into interno.rede_orgs (perfil, tipo, verificada_em) values ($1, 'coletivo', now()) on conflict do nothing", [P.coletivo]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono') on conflict do nothing", [P.coletivo, P.gestora]);

// ── Contatos ──
const sit0 = await espera("a situação de quem não tem nada", () => chamar(P.dona, "alumia_ato_situacao"),
  (s) => s.contatos.length === 0 && s.pedidos.length === 0 && s.recados.length === 0 && s.detido_ligado === false && s.minhas_orgs.length === 0);
void sit0;
await recusa("pedir um @ que não existe", () => chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "ninguem_o9" }), "nao_encontrado");
await recusa("pedir a si mesma", () => chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "@dona_o9" }), "nao_encontrado");
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.estranha, P.dona]);
await recusa("pedir a quem bloqueou dá o mesmo erro de quem não existe", () => chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "estranha_o9" }), "nao_encontrado");
await espera("pedir a amiga e a irmã", async () => {
  await chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "@amiga_o9" });
  return chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "IRMA_O9" });
}, (s) => s.contatos.length === 2 && s.contatos.every((c) => !c.aceito));
await espera("pedir de novo não repete nem duplica o aviso", async () => {
  await chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "amiga_o9" });
  return (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%contato de segurança%'", [P.amiga])).n;
}, (n) => n === 1);
await espera("o aviso do pedido não diz quem pediu", async () => um("select texto, ator, tipo from interno.avisos where para = $1 and texto like '%contato de segurança%'", [P.amiga]),
  (r) => r.ator === null && r.tipo === null && !r.texto.includes("Codinome") && !r.texto.includes("dona_o9"));
await espera("a amiga vê o pedido, com @ e codinome", () => chamar(P.amiga, "alumia_ato_situacao"),
  (s) => s.pedidos.length === 1 && s.pedidos[0].handle === "dona_o9" && s.pedidos[0].nome === "Codinome 1");
await espera("a estranha não vê nada da dona", () => chamar(P.estranha, "alumia_ato_situacao"), (s) => JSON.stringify(s).indexOf("dona_o9") < 0);

// ── Estou bem antes do aceite ──
await recusa("estou bem sem nenhum contato que aceitou", () => chamar(P.dona, "alumia_ato_estou_bem"), "sem_contatos");
await espera("a amiga aceita; a irmã recusa", async () => {
  await chamar(P.amiga, "alumia_ato_contato_responder", { p_handle: "dona_o9", p_aceito: true });
  return chamar(P.irma, "alumia_ato_contato_responder", { p_handle: "dona_o9", p_aceito: false });
}, (s) => s.pedidos.length === 0 && s.sou_contato_de.length === 0);
await recusa("responder a um pedido que não existe", () => chamar(P.irma, "alumia_ato_contato_responder", { p_handle: "dona_o9", p_aceito: true }), "nao_encontrado");
await espera("a dona vê a amiga aceita e a irmã fora", () => chamar(P.dona, "alumia_ato_situacao"),
  (s) => s.contatos.length === 1 && s.contatos[0].handle === "amiga_o9" && s.contatos[0].aceito === true);
await espera("a amiga se vê como contato da dona", () => chamar(P.amiga, "alumia_ato_situacao"), (s) => s.sou_contato_de.length === 1 && s.sou_contato_de[0].handle === "dona_o9");

// ── Estou bem ──
await espera("estou bem chega só a quem aceitou", () => chamar(P.dona, "alumia_ato_estou_bem"), (r) => r.avisados === 1);
await espera("a amiga recebe o recado e o aviso (com quem mandou em ator, sem lugar)", async () => {
  const s = await chamar(P.amiga, "alumia_ato_situacao");
  const a = await um("select tipo, ator, texto from interno.avisos where para = $1 and tipo = 'estou_bem'", [P.amiga]);
  return { s, a };
}, ({ s, a }) => s.recados.length === 1 && s.recados[0].tipo === "estou_bem" && s.recados[0].handle === "dona_o9"
  && new Date(s.recados[0].expira_em) - new Date(s.recados[0].criado_em) === 24 * 3600 * 1000 && a.ator === P.dona);
await espera("a irmã (recusou) e a estranha não recebem nada", async () => um("select count(*)::int as n from interno.alumia_ato_sinais where para in ($1, $2)", [P.irma, P.estranha]), (r) => r.n === 0);
await espera("quem mandou não vê painel de quem recebeu", () => chamar(P.dona, "alumia_ato_situacao"), (s) => s.recados.length === 0 && !("avisados" in s));
await espera("mandar de novo troca o recado, não empilha", async () => {
  await chamar(P.dona, "alumia_ato_estou_bem");
  return um("select (select count(*) from interno.alumia_ato_sinais where para = $1)::int as s, (select count(*) from interno.avisos where para = $1 and tipo = 'estou_bem')::int as a", [P.amiga]);
}, (r) => r.s === 1 && r.a === 1);
await espera("o sino da amiga mostra o texto do recado", async () => chamar(P.amiga, "rede_aviso_listar", {}),
  (r) => r.itens.some((i) => i.tipo === "estou_bem" && typeof i.texto === "string" && i.texto.includes("está bem")));
await espera("a faxina leva o recado e o aviso vencidos (24 horas)", async () => {
  await dono("update interno.alumia_ato_sinais set criado_em = now() - interval '25 hours', expira_em = now() - interval '1 hour' where para = $1", [P.amiga]);
  await dono("update interno.avisos set criado_em = now() - interval '25 hours' where para = $1 and tipo = 'estou_bem'", [P.amiga]);
  await dono("select interno.alumia_ato_faxina()");
  return um("select (select count(*) from interno.alumia_ato_sinais where para = $1)::int as s, (select count(*) from interno.avisos where para = $1 and tipo = 'estou_bem')::int as a", [P.amiga]);
}, (r) => r.s === 0 && r.a === 0);
await espera("o recado vencido não aparece nem antes da faxina", async () => {
  await dono("insert into interno.alumia_ato_sinais (de, para, tipo, criado_em, expira_em) values ($1, $2, 'estou_bem', now() - interval '25 hours', now() - interval '1 hour')", [P.dona, P.amiga]);
  return chamar(P.amiga, "alumia_ato_situacao");
}, (s) => s.recados.length === 0);
await dono("delete from interno.alumia_ato_sinais");

// ── Assessoria jurídica ──
await recusa("quem não gere a organização não publica o plantão", () => chamar(P.dona, "alumia_ato_assessoria_guardar", { p_org: "coletivo_o9", p_texto: "Plantão de teste com texto." }), "sem_permissao");
await espera("a gestora vê a organização que gere", () => chamar(P.gestora, "alumia_ato_situacao"), (s) => s.minhas_orgs.length === 1 && s.minhas_orgs[0].handle === "coletivo_o9" && s.minhas_orgs[0].texto === null);
await recusa("plantão curto demais", () => chamar(P.gestora, "alumia_ato_assessoria_guardar", { p_org: "coletivo_o9", p_texto: "curto" }), "invalido:texto");
await recusa("plantão com marcação", () => chamar(P.gestora, "alumia_ato_assessoria_guardar", { p_org: "coletivo_o9", p_texto: "<b>Plantão</b> do coletivo" }), "invalido:texto");
await espera("a gestora publica o plantão", () => chamar(P.gestora, "alumia_ato_assessoria_guardar", { p_org: "@coletivo_o9", p_texto: "Plantão jurídico do coletivo em todo dia de ato." }),
  (s) => s.minhas_orgs[0].texto === "Plantão jurídico do coletivo em todo dia de ato.");
await espera("qualquer membro vê as assessorias", () => chamar(P.dona, "alumia_ato_assessorias"), (r) => r.length === 1 && r[0].handle === "coletivo_o9");
await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.coletivo]);
await espera("sem selo, a assessoria some da lista", () => chamar(P.dona, "alumia_ato_assessorias"), (r) => r.length === 0);
await recusa("e sem selo não se publica", () => chamar(P.gestora, "alumia_ato_assessoria_guardar", { p_org: "coletivo_o9", p_texto: "Plantão jurídico do coletivo." }), "sem_permissao");
await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.coletivo]);

// ── Fui detido ──
await recusa("fui detido sem o interruptor do painel", () => chamar(P.dona, "alumia_ato_fui_detido", { p_org: null }), "desligado");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-fui-detido', true) on conflict (nome) do update set ligado = true");
await espera("o interruptor aparece ligado na situação", () => chamar(P.dona, "alumia_ato_situacao"), (s) => s.detido_ligado === true);
await recusa("assessoria de um @ que não tem plantão", () => chamar(P.dona, "alumia_ato_fui_detido", { p_org: "amiga_o9" }), "nao_encontrado");
await espera("fui detido chega à amiga e à gestora do coletivo", () => chamar(P.dona, "alumia_ato_fui_detido", { p_org: "coletivo_o9" }), (r) => r.avisados === 2 && r.assessoria === true);
await espera("a gestora recebe pela assessoria; a amiga, como contato", async () => ({
  g: await chamar(P.gestora, "alumia_ato_situacao"),
  a: await chamar(P.amiga, "alumia_ato_situacao"),
}), ({ g, a }) => g.recados.length === 1 && g.recados[0].tipo === "detido" && g.recados[0].via_org === "Codinome 6"
  && a.recados.length === 1 && a.recados[0].via_org === null
  && new Date(a.recados[0].expira_em) - new Date(a.recados[0].criado_em) === 72 * 3600 * 1000);
await espera("o recado do fui detido não leva texto livre nem lugar", async () => um("select count(*)::int as n from information_schema.columns where table_schema = 'interno' and table_name = 'alumia_ato_sinais' and column_name in ('texto', 'lugar', 'local', 'onde')"), (r) => r.n === 0);
await espera("quem recebeu tira o recado da própria tela (e o aviso)", async () => {
  const g = await chamar(P.gestora, "alumia_ato_situacao");
  const s = await chamar(P.gestora, "alumia_ato_recado_apagar", { p_id: g.recados[0].id });
  const a = await um("select count(*)::int as n from interno.avisos where para = $1 and tipo = 'detido'", [P.gestora]);
  return { s, a };
}, ({ s, a }) => s.recados.length === 0 && a.n === 0);
await espera("ninguém apaga o recado de outra pessoa", async () => {
  const a = await chamar(P.amiga, "alumia_ato_situacao");
  await chamar(P.estranha, "alumia_ato_recado_apagar", { p_id: a.recados[0].id });
  return chamar(P.amiga, "alumia_ato_situacao");
}, (s) => s.recados.length === 1);
await dono("update interno.recursos_vivos set ligado = false where nome = 'alumia-fui-detido'");
await recusa("o painel desliga de novo e o envio para", () => chamar(P.dona, "alumia_ato_fui_detido", { p_org: null }), "desligado");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-modo-ato', false) on conflict (nome) do update set ligado = false");
await recusa("com o modo ato desligado no painel, tudo fecha", () => chamar(P.dona, "alumia_ato_situacao"), "desligado");
await dono("delete from interno.recursos_vivos where nome = 'alumia-modo-ato'");

// ── Tirar e limites ──
await espera("a amiga deixa de ser contato: o laço e os recados entre as duas somem", async () => {
  const s = await chamar(P.amiga, "alumia_ato_contato_tirar", { p_handle: "dona_o9" });
  const n = await um("select (select count(*) from interno.alumia_ato_contatos where dono = $1)::int as c, (select count(*) from interno.alumia_ato_sinais where de = $1 and para = $2)::int as s", [P.dona, P.amiga]);
  return { s, n };
}, ({ s, n }) => s.sou_contato_de.length === 0 && s.recados.length === 0 && n.c === 0 && n.s === 0);
await espera("até 10 contatos", async () => {
  for (let i = 0; i < 10; i++) {
    const id = await criarUsuario(`extra${i}@o9.local`, `Extra ${i}`);
    await rpc({ papel: "authenticated", sub: id }, "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [id, `Extra ${i}`, `extra${i}_o9`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
  }
  await dono("delete from interno.limites");
  for (let i = 0; i < 10; i++) await chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: `extra${i}_o9` });
  return (await um("select count(*)::int as n from interno.alumia_ato_contatos where dono = $1", [P.dona])).n;
}, (n) => n === 10);
await recusa("o 11º contato é recusado", () => chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "irma_o9" }), "limite_de_contatos");
await espera("a faxina leva o pedido sem resposta depois de 30 dias", async () => {
  await dono("update interno.alumia_ato_contatos set pedido_em = current_date - 31 where dono = $1", [P.dona]);
  await dono("select interno.alumia_ato_faxina()");
  return (await um("select count(*)::int as n from interno.alumia_ato_contatos where dono = $1", [P.dona])).n;
}, (n) => n === 0);
await espera("a conta apagada leva os laços e os recados (cascata)", async () => {
  await chamar(P.dona, "alumia_ato_contato_pedir", { p_handle: "irma_o9" });
  await dono("delete from auth.users where id = $1", [P.dona]);
  return um("select (select count(*) from interno.alumia_ato_contatos where dono = $1 or contato = $1)::int as c, (select count(*) from interno.alumia_ato_sinais where de = $1 or para = $1)::int as s", [P.dona]);
}, (r) => r.c === 0 && r.s === 0);

// ═══════════════════ Resultado ═══════════════════
console.log(`\nModo ato (frente 9C): ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
