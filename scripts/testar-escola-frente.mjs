// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a F6 da Escola de Formação (PLANO-ESCOLA.md: Biblioteca, A Frente e Tirar uma dúvida):
//  1. O banco (supabase/migracoes/2026-11-escola-frente.sql, sobre o install.sql e a migração da F1, num Postgres de
//     verdade dentro do Node): só militante escolhe a própria frente; as somas são só números, sem nomes, e escondem
//     frente com menos de 3 pessoas; conta suspensa e quem saiu do departamento não contam; a migração roda duas vezes;
//     execute só para os papéis da API; security definer e search_path fixo.
//  2. As contas puras das telas (prateleiras, frentes, assembleia, contexto da dúvida, avisos).
//  3. As páginas e o código: rotas existem, nada secreto vai pelo servidor, a dúvida não fica no aparelho, "levar ao
//     núcleo" chama a função da F4 pelo nome do contrato, o manifesto e Quem foi são só linkados.
//  4. Os textos nos 6 idiomas (mesmas chaves, nada vazio, marcadores iguais) e o contraste AA das cores usadas.
// Uso: npm run testar:escola-frente
import fs from "node:fs";
import path from "node:path";
import { criarBanco } from "./banco-local.mjs";
import { FRENTES_DE_ATUACAO, FUNCOES_DA_ESCOLA, MIGRACOES_DA_ESCOLA, TELAS_DA_ESCOLA } from "../lib/escola/contratos.ts";
import { TELAS_DA_FORMACAO } from "../lib/escola/rotas.ts";
import { COR_DO_DEGRAU, PRATELEIRAS, prateleirasDaBiblioteca } from "../components/escola/biblioteca/prateleiras.ts";
import { avisoDaEscolha, cartaoDaAssembleia, diaPorExtenso, frenteMarcada, frentesNaTela, proximaEscolha } from "../components/escola/frente2/frentes.ts";
import { avisoDoLevar, contextoDaDuvida, textoParaLevar } from "../components/escola/duvida/duvida.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let certos = 0;
const falhas = [];
const confere = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !(await conferir(valor))) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigos) {
  const lista = [].concat(codigos);
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${lista.join('" ou "')}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (lista.some((c) => String(erro.message).includes(c))) certos++;
    else falhas.push(`${nome}: esperava "${lista.join('" ou "')}", veio "${erro.message}"`);
  }
}

// ───────────────────────────── 1. O banco ─────────────────────────────
const F1 = ler("supabase", "migracoes", MIGRACOES_DA_ESCOLA.F1);
const F6 = ler("supabase", "migracoes", MIGRACOES_DA_ESCOLA.F6);
const banco = await criarBanco();
const { rpc, dono, criarUsuario, pg, exclusivo } = banco;
await espera("a migração da F1 instala", () => exclusivo(() => pg.exec(F1)));
await espera("a migração da F6 instala sobre a F1", () => exclusivo(() => pg.exec(F6)));
await espera("a migração da F6 roda de novo sem quebrar (acrescentável)", () => exclusivo(() => pg.exec(F6)));

const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.80" });
const anon = { papel: "anon", ip: "203.0.113.81" };
const ids = {};
const NOMES = ["coord", "comum", "m1", "m2", "m3", "m4", "m5", "suspensa", "sai"];
for (const chave of NOMES) {
  ids[chave] = await criarUsuario(`${chave}@frente.local`, `Nome Civil ${chave}`);
  await rpc(como(ids[chave]), "eu");
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [ids.coord]);
const entrar = (u) => dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [u, ids.coord]);
for (const u of ["m1", "m2", "m3", "m4", "m5", "suspensa", "sai"]) await entrar(ids[u]);
const frenteDe = async (u) => (await dono("select frente from interno.escola_militancia where usuario = $1", [u])).rows[0]?.frente ?? null;

await recusa("anon não escolhe frente", () => rpc(anon, "escola_frente_escolher", { p_frente: "bairros" }), ["entre_primeiro", "sem_permissao"]);
await recusa("conta comum não escolhe frente", () => rpc(como(ids.comum), "escola_frente_escolher", { p_frente: "bairros" }), "sem_permissao");
await recusa("anon não soma frentes", () => rpc(anon, "escola_frentes_somadas"), ["entre_primeiro", "sem_permissao"]);
await recusa("conta comum não soma frentes", () => rpc(como(ids.comum), "escola_frentes_somadas"), "sem_permissao");

await espera("militante escolhe a própria frente", async () => {
  const r = await rpc(como(ids.m1), "escola_frente_escolher", { p_frente: "bairros" });
  return r.ok === true && (await frenteDe(ids.m1)) === "bairros";
}, (x) => x);
await espera("escolher com espaços em volta vale", async () => {
  await rpc(como(ids.m2), "escola_frente_escolher", { p_frente: "  bairros " });
  return (await frenteDe(ids.m2)) === "bairros";
}, (x) => x);
await recusa("frente fora das 7 é recusada", () => rpc(como(ids.m3), "escola_frente_escolher", { p_frente: "partido" }), "invalido:frente");
await espera("tirar a escolha (null) deixa sem frente", async () => {
  await rpc(como(ids.m3), "escola_frente_escolher", { p_frente: "trabalho" });
  const antes = await frenteDe(ids.m3);
  await rpc(como(ids.m3), "escola_frente_escolher", { p_frente: null });
  return antes === "trabalho" && (await frenteDe(ids.m3)) === null;
}, (x) => x);
await espera("escolher só muda a linha de quem chama", async () => (await frenteDe(ids.m4)) === null && (await frenteDe(ids.m5)) === null, (x) => x);
await espera("escola_eu devolve a frente escolhida", () => rpc(como(ids.m1), "escola_eu"), (r) => r.frente === "bairros");
await recusa("coordenação fora do departamento não tem frente própria", () => rpc(como(ids.coord), "escola_frente_escolher", { p_frente: "atos" }), "sem_militancia");

// Somas: bairros com 2 (m1, m2) ainda não aparece; com 3, aparece. Trabalho com 2 nunca aparece.
await espera("frente com menos de 3 pessoas não aparece na soma", () => rpc(como(ids.m4), "escola_frentes_somadas"), (r) => JSON.stringify(r) === "{}");
await rpc(como(ids.m4), "escola_frente_escolher", { p_frente: "bairros" });
await rpc(como(ids.m3), "escola_frente_escolher", { p_frente: "trabalho" });
await rpc(como(ids.m5), "escola_frente_escolher", { p_frente: "trabalho" });
await espera("com 3 pessoas, a frente aparece só como número", () => rpc(como(ids.m4), "escola_frentes_somadas"), (r) => JSON.stringify(r) === JSON.stringify({ bairros: 3 }));
await espera("a coordenação também vê a soma", () => rpc(como(ids.coord), "escola_frentes_somadas"), (r) => r.bairros === 3 && !("trabalho" in r));
await espera("a soma não leva nome, codinome nem id", () => rpc(como(ids.m1), "escola_frentes_somadas"), (r) => {
  const s = JSON.stringify(r);
  return !s.includes("Nome Civil") && !Object.values(ids).some((id) => s.includes(id)) && Object.values(r).every((n) => Number.isInteger(n));
});
await dono("update interno.escola_militancia set frente = 'trabalho' where usuario = $1", [ids.suspensa]);
await dono("update interno.perfis set suspenso = true where id = $1", [ids.suspensa]);
await espera("conta suspensa não conta (trabalho fica com 2)", () => rpc(como(ids.m1), "escola_frentes_somadas"), (r) => !("trabalho" in r));
await recusa("conta suspensa não escolhe", () => rpc(como(ids.suspensa), "escola_frente_escolher", { p_frente: "atos" }), ["sem_permissao", "conta_suspensa"]);
await rpc(como(ids.sai), "escola_frente_escolher", { p_frente: "bairros" });
await espera("4 em bairros", () => rpc(como(ids.m1), "escola_frentes_somadas"), (r) => r.bairros === 4);
await dono("delete from interno.departamento_membros where departamento = 'revolucionarios' and usuario = $1", [ids.sai]);
await espera("quem sai do departamento sai da soma (e perde a frente)", async () => (await rpc(como(ids.m1), "escola_frentes_somadas")).bairros === 3 && (await frenteDe(ids.sai)) === null, (x) => x);
await recusa("quem saiu não escolhe mais", () => rpc(como(ids.sai), "escola_frente_escolher", { p_frente: "bairros" }), "sem_permissao");

await espera("execute: anon, authenticated e service_role sim; public não", () => dono(`select
  has_function_privilege('authenticated', 'public.escola_frente_escolher(text)', 'execute') a,
  has_function_privilege('authenticated', 'public.escola_frentes_somadas()', 'execute') b,
  has_function_privilege('anon', 'public.escola_frentes_somadas()', 'execute') c,
  exists (select 1 from pg_proc, aclexplode(proacl) x where proname in ('escola_frente_escolher', 'escola_frentes_somadas') and x.grantee = 0) p`),
  (r) => r.rows[0].a && r.rows[0].b && r.rows[0].c && r.rows[0].p === false);
await espera("funções da F6: security definer e search_path fixo", () => dono("select proname, prosecdef, proconfig from pg_proc where proname in ('escola_frente_escolher', 'escola_frentes_somadas')"), (r) =>
  r.rows.length === 2 && r.rows.every((x) => x.prosecdef && (x.proconfig ?? []).some((c) => c === "search_path=interno, pg_temp")));
confere("a migração da F6 não cria tabela (a coluna frente é da F1)", !/create table/i.test(F6));
confere("a migração da F6 não grava nome civil", !/perfis\.nome|p\.nome\b|f\.nome\b/.test(F6));
confere("a migração da F6 não toca no install.sql", !ler("supabase", "install.sql").includes("escola_frentes_somadas"));
confere("contrato: as funções da F6 estão na migração da F6", Object.entries(FUNCOES_DA_ESCOLA).filter(([, f]) => f === "F6").every(([n]) => F6.includes(`public.${n}(`)));
confere("as 7 frentes do contrato são as do check da migração", FRENTES_DE_ATUACAO.every((f) => F6.includes(`'${f}'`)) && FRENTES_DE_ATUACAO.length === 7);

// ───────────────────────────── 2. Contas puras ─────────────────────────────
const nomes = Array.from({ length: 11 }, (_, i) => `Caderno nome ${i + 1}`);
const itens = Object.fromEntries(PRATELEIRAS.map((n) => [n, `itens ${n}`]));
const pr = prateleirasDaBiblioteca(nomes, itens);
confere("prateleiras: as 6 da prancha, na ordem", pr.map((p) => p.n).join() === "01,03,05,06,08,09");
confere("prateleiras: cor pelo degrau (01 ouro, 03 vermelho-núcleo, 08 laranja)", pr[0].cor === COR_DO_DEGRAU[1] && pr[1].cor === COR_DO_DEGRAU[2] && pr[4].cor === COR_DO_DEGRAU[3]);
confere("prateleiras: nome e caminho do caderno", pr[1].nome === "Caderno nome 3" && pr[1].caminho === "/escola/formacao/conversar-com-quem-pensa-diferente");
confere("prateleiras: sem texto, sem caixa", prateleirasDaBiblioteca(nomes, { "01": "x" }).length === 1);

const fs0 = frentesNaTela("bairros", { bairros: 12, trabalho: 2, atos: 3.5 });
confere("frentes: as 7 na ordem do contrato, a sua marcada", fs0.map((f) => f.frente).join() === FRENTES_DE_ATUACAO.join() && fs0.filter((f) => f.sua).map((f) => f.frente).join() === "bairros");
confere("frentes: só número inteiro >= 3 aparece", fs0.find((f) => f.frente === "bairros").conta === 12 && fs0.find((f) => f.frente === "trabalho").conta === null && fs0.find((f) => f.frente === "atos").conta === null);
confere("frentes: sem soma, sem número", frentesNaTela(null, null).every((f) => f.conta === null && !f.sua));
{
  // Escolher, sair da tela e voltar: a casca (escola_eu lido uma vez por aba) ainda diz "bairros"; o banco já diz "atos".
  const casca = "bairros";
  const nova = proximaEscolha(frenteMarcada(undefined, { ok: true, dados: { militante: true, frente: casca } }, casca).frente, "atos");
  const depois = frenteMarcada(nova, { ok: true, dados: { militante: true, frente: casca } }, casca);
  confere("frente: escolher marca a nova na mesma montagem (mesmo com a leitura velha chegando depois)", nova === "atos" && depois.frente === "atos" && depois.pronta);
  const carregando = frenteMarcada(undefined, null, casca);
  confere("frente: ao remontar, enquanto escola_eu não chega, os botões esperam (nenhuma troca errada)", carregando.pronta === false);
  const remontada = frenteMarcada(undefined, { ok: true, dados: { militante: true, frente: "atos" } }, casca);
  const marcadas = frentesNaTela(remontada.frente, null).filter((f) => f.sua).map((f) => f.frente).join();
  confere("frente: escolher, remontar, a marcada é a nova (não a da casca)", remontada.pronta && marcadas === "atos");
  confere("frente: depois de remontar, tocar na nova tira a escolha e tocar noutra troca", proximaEscolha(remontada.frente, "atos") === null && proximaEscolha(remontada.frente, "bairros") === "bairros");
  confere("frente: leitura de escola_eu falhou, vale a casca", frenteMarcada(undefined, { ok: false }, casca).frente === casca && frenteMarcada(undefined, { ok: false }, casca).pronta);
  confere("frente: tirar a escolha (null) nesta montagem vale sobre a casca", frenteMarcada(null, null, casca).frente === null);
}
confere("tocar na sua tira; tocar em outra troca", proximaEscolha("bairros", "bairros") === null && proximaEscolha("bairros", "atos") === "atos" && proximaEscolha(null, "atos") === "atos");
confere("avisos da escolha", avisoDaEscolha("banco_desatualizado") === "ausente" && avisoDaEscolha("ausente") === "ausente" && avisoDaEscolha("sem_militancia") === "semPermissao" && avisoDaEscolha("limite") === "falha");

confere("assembleia sem pauta", JSON.stringify(cartaoDaAssembleia("sem-pauta", null, null)) === JSON.stringify({ situacao: "semPauta", ate: null, aConfirmar: false }));
confere("assembleia aberta até o fechaEm, a confirmar", JSON.stringify(cartaoDaAssembleia("aberta", { confirmado: false, fechaEm: "2026-11-15" }, "2026-12-18")) === JSON.stringify({ situacao: "aberta", ate: "2026-11-15", aConfirmar: true }));
confere("assembleia aberta sem fechaEm vai até o fim do semestre", cartaoDaAssembleia("aberta", { confirmado: true }, "2026-12-18").ate === "2026-12-18");
confere("assembleia de outro semestre conta como fechada", cartaoDaAssembleia("outro-semestre", { confirmado: true }, null).situacao === "fechada");
confere("dia por extenso", /^domingo, 15 de novembro$/.test(diaPorExtenso("pt", "2026-11-15")), diaPorExtenso("pt", "2026-11-15"));
// A pauta de verdade (content/escola/assembleia.json) vale para a tela.
{
  const { validarPauta, assembleiaAberta } = await import("../lib/escola/organizacao.ts");
  const { pauta, erros } = validarPauta(JSON.parse(ler("content", "escola", "assembleia.json")));
  confere("a pauta do semestre é válida", erros.length === 0, erros.join("; "));
  const c = cartaoDaAssembleia(assembleiaAberta(pauta, "2026-11-08"), pauta, null);
  confere("a pauta de hoje dá uma situação conhecida", ["aberta", "fechada", "semPauta"].includes(c.situacao));
}

const ctx = contextoDaDuvida("?aula=F-0304&de=/escola/formacao/conversar-com-quem-pensa-diferente/discordar-sem-humilhar");
confere("dúvida: lê a aula e a volta", ctx.aula === "F-0304" && ctx.de === "/escola/formacao/conversar-com-quem-pensa-diferente/discordar-sem-humilhar");
confere("dúvida: volta de outra trilha (trilha--aula) vale", contextoDaDuvida("?de=/escola/formacao/consciencia-de-classe/marxismo-fundamental--o-que-e-exploracao").de !== null);
for (const ruim of ["https://exemplo.org", "//exemplo.org", "/escola/../painel", "/escola/formacao/x/y/z", "/painel", "/escola/formacao/X", "javascript:alert(1)"]) {
  confere(`dúvida: volta recusada (${ruim})`, contextoDaDuvida(`?de=${encodeURIComponent(ruim)}`).de === null);
}
confere("dúvida: código de aula fora do formato é ignorado", contextoDaDuvida("?aula=<b>x</b>").aula === null && contextoDaDuvida("?aula=F-03045").aula === null && contextoDaDuvida("").aula === null);
confere("dúvida: texto junta espaços e respeita 3 a 200", textoParaLevar("  não   entendi\n a mais-valia ") === "não entendi a mais-valia" && textoParaLevar("ok") === null && textoParaLevar("x".repeat(201)) === null && textoParaLevar("x".repeat(200)) !== null);
confere("dúvida: avisos de cada recusa", ["banco_desatualizado", "ausente", "sem_permissao", "sem_nucleo", "sem_encontro", "pauta_cheia", "invalido:texto", "limite"].map(avisoDoLevar).join() === "ausente,ausente,semPermissao,semNucleo,semEncontro,pautaCheia,tamanho,falha");

// ───────────────────────────── 3. Páginas e código ─────────────────────────────
for (const tela of TELAS_DA_FORMACAO.filter((x) => x.frente === "F6")) {
  confere(`a tela ${tela.caminho} tem página`, fs.existsSync(path.join(raiz, "app", "[lang]", ...tela.caminho.split("/").filter(Boolean), "page.tsx")));
}
confere("as telas da F6 são as do contrato", TELAS_DA_ESCOLA.biblioteca === "/escola/biblioteca" && TELAS_DA_ESCOLA.frente === "/escola/frente" && TELAS_DA_ESCOLA.duvida === "/escola/duvida");
const paginas = ["biblioteca", "frente", "duvida"].map((n) => ler("app", "[lang]", "escola", n, "page.tsx")).join("\n");
confere("páginas: nada de banco, sessão ou chave no servidor", !/rpc\(|supabase|service_role|SERVICE|cookies\(|headers\(/i.test(paginas));
const pasta = (p) => fs.readdirSync(path.join(raiz, ...p)).map((n) => ler(...p, n)).join("\n");
const codigo = [pasta(["components", "escola", "biblioteca"]), pasta(["components", "escola", "frente2"]), pasta(["components", "escola", "duvida"])].join("\n");
confere("telas: nada no aparelho (nem a dúvida, nem a frente)", !/localStorage|sessionStorage|setItem|useStored/.test(codigo));
confere("telas: chamadas ao banco só pelos nomes do contrato", [...codigo.matchAll(/(?:chamarDaEscola|useDaEscola|lerDaEscola)\("([a-z_]+)"/g)].every((m) => m[1] in FUNCOES_DA_ESCOLA));
confere("levar ao núcleo chama escola_levar_ao_nucleo (F4) pelo contrato", /chamarDaEscola\("escola_levar_ao_nucleo", \{ p_texto: pronto \}\)/.test(ler("components", "escola", "duvida", "EscolherComQuem.tsx")) && FUNCOES_DA_ESCOLA.escola_levar_ao_nucleo === "F4");
confere("escolher a frente chama escola_frente_escolher pelo contrato", /chamarDaEscola\("escola_frente_escolher", \{ p_frente: nova \}\)/.test(ler("components", "escola", "frente2", "EscolherFrente.tsx")));
{
  const ef = ler("components", "escola", "frente2", "EscolherFrente.tsx");
  confere("A Frente lê escola_eu de novo ao montar e marca por frenteMarcada", /useDaEscola\("escola_eu"\)/.test(ef) && /frenteMarcada\(escolhidaAqui, euLido, eu\.frente\)/.test(ef) && !/useState<FrenteDeAtuacao \| null>\(eu\.frente\)/.test(ef));
  confere("A Frente lê as somas de novo depois de escolher", /lerDaEscola\("escola_frentes_somadas"\)[\s\S]*\}, \[vez\]\)/.test(ef) && /setVez\(/.test(ef));
  confere("A Frente: botões esperam a leitura de escola_eu", /disabled=\{guardando !== null \|\| !pronta\}/.test(ef));
  const dq = ler("components", "escola", "duvida", "EscolherComQuem.tsx");
  confere("Dúvida: sem núcleo, o campo de escrever some (nada o enviaria)", /\{eu\.nucleo && \(\s*<>\s*<label htmlFor="ef6-duvida-texto">/.test(dq));
}
confere("a prévia nunca vai ao banco (chamar passa pelo lerDaEscola)", /if \(emPrevia\(\)\) \{\s*const lido = await lerDaEscola/.test(ler("components", "escola", "duvida", "chamar.ts")));
confere("nada de nome civil nas telas (só codinome)", !/\.nome_civil|perfis\.nome|eu\.nome\b/.test(codigo));
const frente = ler("components", "escola", "frente2", "TelaDaFrente.tsx");
confere("A Frente só linka o manifesto e Quem foi Lúcia Maria", /"\/escola\/manifesto"/.test(frente) && /"\/escola\/quem-foi-lucia-maria"/.test(frente));
for (const [rota, conteudo] of [["manifesto", "manifesto.md"], ["quem-foi-lucia-maria", "quem-foi-lucia-maria.md"]]) {
  confere(`a página ${rota} e o texto existem`, fs.existsSync(path.join(raiz, "app", "[lang]", "escola", rota, "page.tsx")) && fs.existsSync(path.join(raiz, "content", "escola", conteudo)));
}
const biblioteca = ler("components", "escola", "biblioteca", "TelaDaBiblioteca.tsx");
for (const destino of ["/escola/lutas", "/escola/vozes", "/estantes/formacao-militante", "/acervo"]) confere(`Biblioteca leva a ${destino}`, biblioteca.includes(`"${destino}"`));
for (const rota of ["lutas", "vozes"]) confere(`a página /escola/${rota} existe`, fs.existsSync(path.join(raiz, "app", "[lang]", "escola", rota, "page.tsx")));
confere("a estante de formação militante existe", ler("lib", "areas.ts").includes('"formacao-militante"'));
confere("leitura guiada: há ao menos uma em content/escola/leituras", fs.readdirSync(path.join(raiz, "content", "escola", "leituras")).some((n) => n.endsWith(".json")));
confere("a Lei de Greve citada na prateleira 05 está nas aulas", ler("content", "trilhas", "organizacao-sindical-de-base", "greve-na-pratica.md").includes("7.783"));

// ───────────────────────────── 4. Textos e contraste ─────────────────────────────
const chaves = (o, p = "") => (Array.isArray(o) ? [`${p}[${o.length}]`, ...o.flatMap((v, i) => chaves(v, `${p}[${i}]`))] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => chaves(v, p ? `${p}.${k}` : k)) : [p]);
const pt = JSON.parse(ler("i18n", "escola", "biblioteca", "pt.json"));
const chavesPt = chaves(pt).join("|");
const marcadores = (t) => JSON.stringify(t).match(/\{[a-z]+\}/gi)?.sort().join();
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(ler("i18n", "escola", "biblioteca", `${l}.json`));
  confere(`textos ${l}: mesmas chaves do português`, chaves(t).join("|") === chavesPt);
  confere(`textos ${l}: nada vazio`, !JSON.stringify(t).includes('""'));
  confere(`textos ${l}: os marcadores {x} batem`, marcadores(t) === marcadores(pt));
}
confere("textos: as 7 frentes com nome", FRENTES_DE_ATUACAO.every((f) => pt.frente.nomes[f]));
confere("textos: as 6 prateleiras com texto", PRATELEIRAS.every((n) => pt.biblioteca.prateleiras[n]));
confere("textos: a dúvida não promete prazo de resposta", !/em até \d+ dia/.test(JSON.stringify(pt.duvida)));
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const TEXTO = [
  ["#B3140E", "#FBFAF6"], ["#8A100B", "#FBFAF6"], ["#4A4F4B", "#FBFAF6"], ["#1B1F1C", "#FBFAF6"], ["#FFFFFF", "#C21F16"],
  ["#F2C94C", "#110C0A"], ["#E8604C", "#110C0A"], ["#EA7A24", "#110C0A"], ["#F1EEE6", "#110C0A"], ["#CDBFB5", "#110C0A"], ["#AE9C90", "#110C0A"],
  ["#110C0A", "#E8604C"], ["#110C0A", "#EA7A24"], ["#110C0A", "#F1EEE6"], ["#FAE3A0", "#C21F16"], ["#8A1610", "#FFFFFF"],
  ["#110C0A", "#F2C94C"], ["#EADFD5", "#1A1311"], ["#EADFD5", "#110C0A"], ["#F1EEE6", "#1A1311"], ["#4A4F4B", "#F1EEE6"], ["#4A4F4B", "#E6E1D6"],
  ["#B3140E", "#F1EEE6"], ["#110C0A", "#FFFFFF"], ["#6B675F", "#FFFFFF"], ["#110C0A", "#E63B2A"],
];
for (const [f, b] of TEXTO) confere(`contraste AA ${f} sobre ${b}`, contraste(f, b) >= 4.5, contraste(f, b).toFixed(2));
for (const [f, b] of [["#7A6056", "#110C0A"], ["#7A6056", "#1A1311"], ["#7A7468", "#FFFFFF"], ["#7A7468", "#F1EEE6"]]) confere(`contorno de campo 3:1 ${f} sobre ${b}`, contraste(f, b) >= 3, contraste(f, b).toFixed(2));
const css = ler("components", "escola", "biblioteca", "escola-f6.css");
confere("CSS: o ouro da prancha sobre o vermelho foi trocado pelo tom AA", /\.ef6-cartaz-olho \{[^}]*#fae3a0/.test(css));
confere("CSS: movimento respeita quem pede menos", /prefers-reduced-motion: reduce/.test(css));
confere("CSS: só classes ef6- (não mexe nas da casca)", ![...css.matchAll(/^\s*([^@/{}\n][^{}\n]*)\{/gm)].some((m) => /\.ef-(?!t\b)/.test(m[1]) && !/\.ef6-/.test(m[1])));

// ───────────────────────────── 5. HTML sem sessão (opcional, com servidor no ar) ─────────────────────────────
const base = process.env.ESCOLA_URL;
if (base) {
  for (const rota of ["/pt/escola/biblioteca", "/pt/escola/frente", "/pt/escola/duvida"]) {
    try {
      const r = await fetch(base + rota, { redirect: "manual", signal: AbortSignal.timeout(180_000) });
      const html = await r.text();
      confere(`HTML sem sessão de ${rota}: responde`, r.status === 200, `status ${r.status}`);
      const achados = [/Faísca/, /Jurema/, /Núcleo Zona Leste/, /"codinome"/, /escola_frentes_somadas"?\s*[,:]/].filter((re) => re.test(html)).map(String);
      confere(`HTML sem sessão de ${rota}: nada de militante`, achados.length === 0, achados.join(", "));
      console.log(`escola-frente: ${rota} sem sessão -> ${r.status}, ${html.length} bytes, proibidos achados: ${achados.length}`);
    } catch (erro) {
      falhas.push(`HTML sem sessão de ${rota}: ${erro.message}`);
    }
  }
} else console.log("escola-frente: sem ESCOLA_URL, a prova do HTML sem sessão não rodou.");

if (falhas.length) {
  console.error(`escola-frente: ${certos} certos, ${falhas.length} falhas:\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`escola-frente: ${certos} conferências certas.`);
process.exit(0);
