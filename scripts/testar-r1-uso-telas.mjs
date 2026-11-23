// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as peças de tela da frente "uso e funções" do R1 que dão para rodar no Node, sem navegador:
//   - A3.4: tradução em rascunho não vai para a tela (lib/rede/textos-prontos.ts), em todos os carregadores de textos da Alumia
//     (fora o chat e o Fediverso, que têm dono próprio), e a marca "_rascunho" continua nos arquivos;
//   - o pacote novo de textos (i18n/rede/uso): as mesmas chaves e marcadores nos seis idiomas, os cinco não-portugueses marcados;
//   - A4.1: o kit de bolso só no aparelho, com tetos, que o "Sair rápido" apaga, e sem chamada própria ao servidor;
//   - A4.2: a busca nos posts cifrados com os três tetos (posts, dias, memória), sem mandar o termo para lugar nenhum;
//   - A3.2: a situação do pedido em passos;
//   - A3.1: o "por que não aparece o número?" ao lado das contagens escondidas;
//   - A4.3 e A2.2: o canal com a mediação só com o interruptor, e a tela das identidades sem "em construção".
// Uso: npm run testar:r1-uso-telas
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const json = (c) => JSON.parse(ler(c));

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const v = await promessa();
    if (!conferir(v)) throw new Error(`resultado inesperado: ${JSON.stringify(v)?.slice(0, 300)}`);
    certos++;
  } catch (e) {
    falhas.push(`${nome}: ${e.message}`);
  }
}

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];

// ═══════════════════ A3.4 · rascunho mostra o português ═══════════════════
const prontos = await import("../lib/rede/textos-prontos.ts");
ok("rascunho: true é rascunho", prontos.eRascunho({ _rascunho: true }));
ok("rascunho com frase é rascunho", prontos.eRascunho({ _rascunho: "Draft translation" }));
ok("sem marca não é rascunho", !prontos.eRascunho({ a: 1 }) && !prontos.eRascunho({ _rascunho: false }) && !prontos.eRascunho(null));
ok("prontoOuPortugues troca o rascunho pelo português", prontos.prontoOuPortugues({ _rascunho: true, x: "en" }, { x: "pt" }).x === "pt");
ok("prontoOuPortugues mantém o idioma revisado", prontos.prontoOuPortugues({ x: "en" }, { x: "pt" }).x === "en");
await espera("carregarPronto: idioma em rascunho carrega o português", async () => {
  const c = { pt: async () => ({ default: { x: "pt" } }), en: async () => ({ default: { _rascunho: true, x: "en" } }), es: async () => ({ default: { x: "es" } }) };
  return [await prontos.carregarPronto(c, "en"), await prontos.carregarPronto(c, "es"), await prontos.carregarPronto(c, "xx")];
}, ([en, es, xx]) => en.x === "pt" && es.x === "es" && xx.x === "pt");
await espera("prontoOu só carrega o português quando precisa", async () => {
  let vezes = 0;
  const pt = async () => (vezes++, { x: "pt" });
  const a = await prontos.prontoOu({ x: "es" }, pt);
  const b = await prontos.prontoOu({ _rascunho: true, x: "en" }, pt);
  return { a, b, vezes };
}, ({ a, b, vezes }) => a.x === "es" && b.x === "pt" && vezes === 1);

// Todo carregador de textos da Alumia (fora o chat e o Fediverso) passa pela troca. Quem é um carregador: importa um JSON de
// i18n/rede/ por import() ou junta os seis idiomas num objeto.
const arquivos = execFileSync("git", ["grep", "-l", "i18n/rede", "--", "lib/rede", "components/rede"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean);
const carregadores = arquivos.filter((f) => {
  if (/\/chat\/|\/fediverso\/|textos-chat\.ts$/.test(f)) return false;
  const s = ler(f);
  return /import\(\s*[`"][^`"]*i18n\/rede\/[^`"]*\{?[^`"]*\.json/.test(s) && /(en|\$\{\w+\})\.json/.test(s) || /\{ pt, en, es, fr, ru, zh \}|pt, en: en as/.test(s);
});
const semTroca = carregadores.filter((f) => !/textos-prontos/.test(ler(f)));
ok(`todo carregador de textos da Alumia mostra o português no lugar do rascunho (${carregadores.length} achados; sem a troca: ${semTroca.join(", ") || "nenhum"})`, carregadores.length >= 40 && semTroca.length === 0);

const { textosDaRede } = await import("../lib/rede/textos.ts");
const ptRede = json("i18n/rede/pt.json");
for (const l of IDIOMAS.slice(1)) {
  const cru = json(`i18n/rede/${l}.json`);
  ok(`textos da Rede em ${l}: ${prontos.eRascunho(cru) ? "rascunho → português" : "revisado → o próprio"}`, textosDaRede(l).menu.principal === (prontos.eRascunho(cru) ? ptRede.menu.principal : cru.menu.principal));
}
const { carregarTextosMod } = await import("../lib/rede/textos-moderacao.ts");
await espera("o pacote da moderação em inglês (rascunho) chega em português", () => carregarTextosMod("en"), (t) => JSON.stringify(t) === JSON.stringify(json("i18n/rede/moderacao/pt.json")));

const marcados = execFileSync("git", ["grep", "-l", '"_rascunho"', "--", "i18n/rede"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean);
ok(`a marca _rascunho continua nos arquivos (${marcados.length})`, marcados.length >= 170);

// ═══════════════════ O pacote novo de textos ═══════════════════
const chaves = (v, p = "", s = new Map()) => {
  if (Array.isArray(v)) {
    s.set(p, `lista:${v.length}`);
    v.forEach((x, i) => chaves(x, `${p}[${i}]`, s));
  } else if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) chaves(f, p ? `${p}.${k}` : k, s);
  else s.set(p, typeof v === "string" && v.trim() === "" ? "vazio" : "texto");
  return s;
};
const marcas = (t) => (typeof t === "string" ? (t.match(/\{\w+\}/g) ?? []).sort().join() : "");
const usoPt = json("i18n/rede/uso/pt.json");
const refUso = chaves(usoPt);
ok("o português do pacote novo não é rascunho", !prontos.eRascunho(usoPt));
for (const l of IDIOMAS.slice(1)) {
  const t = json(`i18n/rede/uso/${l}.json`);
  ok(`uso/${l} está marcado como rascunho`, t._rascunho === true);
  const { _rascunho, ...resto } = t;
  void _rascunho;
  const atual = chaves(resto);
  const diferentes = [...refUso].filter(([k, v]) => atual.get(k) !== v).map(([k]) => k).concat([...atual.keys()].filter((k) => !refUso.has(k)));
  ok(`uso/${l} tem as mesmas chaves do português (${diferentes.slice(0, 5).join(", ") || "ok"})`, diferentes.length === 0);
  const plano = (v, p = "", s = {}) => {
    if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) plano(f, `${p}.${k}`, s);
    else s[p] = v;
    return s;
  };
  const [a, b] = [plano(usoPt), plano(resto)];
  ok(`uso/${l} tem os mesmos marcadores {n}`, Object.keys(a).every((k) => marcas(a[k]) === marcas(b[k])));
}
ok("o aviso de quem lê a moderação é honesto (servidor, banco, sem nome de quem moderou, 90 dias)", /não é cifrado/i.test(usoPt.falar.quemLeItens.join(" ")) && /administra o banco/.test(usoPt.falar.quemLeItens.join(" ")) && /Mediação/.test(usoPt.falar.quemLeItens.join(" ")) && /90 dias/.test(usoPt.falar.quemLeItens.join(" ")));
ok("o aviso do chat diz que perder o aparelho e o Sair rápido apagam o histórico", /perder o aparelho/.test(usoPt.chat.itens.join(" ")) && /Sair rápido/.test(usoPt.chat.itens.join(" ")) && /não volta/.test(usoPt.chat.itens.join(" ")));
ok("a ajuda do Sair rápido diz que o histórico do chat não volta", /histórico do chat some deste aparelho e não volta/.test(json("i18n/rede/pt.json").casca.sairRapidoAjuda) && /histórico do chat some deste aparelho e não volta/.test(json("i18n/rede/publicar/alumia2/pt.json").conta.sairRapidoAjuda));

// ═══════════════════ A4.1 · kit de bolso ═══════════════════
const kit = await import("../components/rede/uso/kit.ts");
const { PREFIXO_DA_REDE, apagarChavesDaRede } = await import("../lib/rede/saida.ts");
const armazem = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
ok("a chave do kit começa com o prefixo que o Sair rápido apaga", kit.CHAVE_DO_KIT.startsWith(PREFIXO_DA_REDE));
{
  const a = armazem();
  const k = kit.montarKit([{ nome: "Coletivo", texto: "Plantão das 8h às 22h" }, { nome: "Sem texto", texto: null }], "Ponto: praça");
  ok("o kit guarda só nome e texto da assessoria (nada de @ nem id) e tira as sem texto", k.assessorias.length === 1 && Object.keys(k.assessorias[0]).sort().join() === "nome,texto");
  ok("guardar e ler devolvem o mesmo kit", kit.guardarKit(a, k) && JSON.stringify(kit.lerKit(a)) === JSON.stringify(k));
  apagarChavesDaRede([a]);
  ok("o Sair rápido (apagarChavesDaRede) leva o kit embora", kit.lerKit(a) === null);
}
{
  const muitas = Array.from({ length: 40 }, (_, i) => ({ nome: `Org ${i}`, texto: "x".repeat(900) }));
  const k = kit.montarKit(muitas, "y".repeat(900) + "\u0000\u0007");
  ok("tetos: até 20 assessorias, 400 letras cada, notas com 400 e sem caracteres de controle", k.assessorias.length === 20 && k.assessorias.every((a) => a.texto.length === 400) && k.notas.length === 400 && !/[\u0000-\u0008]/.test(k.notas));
  const a = armazem();
  a.setItem(kit.CHAVE_DO_KIT, "{nao é json");
  ok("conteúdo estragado não vira kit", kit.lerKit(a) === null);
  a.setItem(kit.CHAVE_DO_KIT, JSON.stringify({ versao: 9, guardado_em: "x", assessorias: [] }));
  ok("versão desconhecida não vira kit", kit.lerKit(a) === null);
  const bloqueado = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("cheio"); }, removeItem() { throw new Error("bloqueado"); } };
  ok("armazenamento bloqueado: lê nulo, guardar diz falso, apagar não lança", kit.lerKit(bloqueado) === null && kit.guardarKit(bloqueado, kit.montarKit([], "")) === false && (kit.apagarKit(bloqueado), true));
}
{
  const fonte = ler("components/rede/uso/KitDeBolso.tsx") + ler("components/rede/uso/kit.ts");
  ok("o kit não tem chamada própria ao servidor (só a lista de assessorias que o modo ato já lê)", !/rpc\(|fetch\(|chamar\(|navigator\.sendBeacon/.test(fonte) && /modoAto\.assessorias\(\)/.test(fonte));
  ok("o modo ato e o guia Sem sinal? mostram o kit", /<KitDeBolso /.test(ler("components/rede/modoato/TelaDoModoAto.tsx")) && /<KitNoGuia /.test(ler("components/rede/modoato/GuiaSemSinal.tsx")));
}

// ═══════════════════ A4.2 · busca no aparelho ═══════════════════
const busca = await import("../components/rede/uso/busca-local.ts");
const agora = Date.parse("2026-11-17T12:00:00Z");
const post = (i, diasAtras, extra = {}) => ({ id: `p${i}`, texto: `Post ${i} sobre a ocupação`, criado_em: new Date(agora - diasAtras * 86_400_000).toISOString(), autor: { id: "a" }, ...extra });
const linha = (posts, porPagina = 20) => {
  const pedidos = [];
  return {
    pedidos,
    pagina: async (cursor) => {
      pedidos.push(cursor);
      const i = cursor ? Number(cursor) : 0;
      return { itens: posts.slice(i, i + porPagina), proximo: i + porPagina < posts.length ? String(i + porPagina) : null };
    },
  };
};
await espera("para no teto de posts", async () => {
  const l = linha(Array.from({ length: 500 }, (_, i) => post(i, 0)));
  return busca.baixarParaBusca({ pagina: l.pagina, cifrado: () => false, abrir: async () => null }, { posts: 50, dias: 60, bytes: 1e9 }, agora);
}, (r) => r.parou === "posts" && r.itens.length === 50);
await espera("para nos posts mais velhos que o teto de dias", async () => {
  const l = linha(Array.from({ length: 30 }, (_, i) => post(i, i * 5)));
  return busca.baixarParaBusca({ pagina: l.pagina, cifrado: () => false, abrir: async () => null }, { posts: 300, dias: 60, bytes: 1e9 }, agora);
}, (r) => r.parou === "dias" && r.itens.length === 13);
await espera("para no teto de memória", async () => {
  const l = linha(Array.from({ length: 30 }, (_, i) => post(i, 0, { texto: "x".repeat(1000) })));
  return busca.baixarParaBusca({ pagina: l.pagina, cifrado: () => false, abrir: async () => null }, { posts: 300, dias: 60, bytes: 10_000 }, agora);
}, (r) => r.parou === "memoria" && r.itens.length === 5 && r.bytes <= 10_000);
await espera("abre os cifrados no aparelho e conta os que não abrem", async () => {
  const posts = [post(1, 0, { texto: "", grupo: "g", corpo_grupo: "p2" }), post(2, 0, { texto: "", grupo: "g", corpo_grupo: "p2" }), post(3, 0)];
  const l = linha(posts);
  return busca.baixarParaBusca({ pagina: l.pagina, cifrado: (p) => !!p.corpo_grupo, abrir: async (p) => (p.id === "p1" ? "Concentração na praça às 17h" : null) }, busca.LIMITES, agora);
}, (r) => r.parou === "fim" && r.itens.length === 2 && r.fechados === 1 && r.itens[0].texto.startsWith("Concentração"));
await espera("a linha só recebe o cursor: o termo procurado nunca sai do aparelho", async () => {
  const l = linha(Array.from({ length: 45 }, (_, i) => post(i, 0)));
  const r = await busca.baixarParaBusca({ pagina: l.pagina, cifrado: () => false, abrir: async () => null }, busca.LIMITES, agora);
  busca.procurar(r.itens, "ocupacao");
  return l.pedidos;
}, (pedidos) => pedidos.every((c) => c === null || /^\d+$/.test(c)) && pedidos.length === 3);
await espera("um cursor que não anda não prende a aba", async () => {
  const sempre = async () => ({ itens: [post(1, 0)], proximo: "mesmo" });
  return busca.baixarParaBusca({ pagina: sempre, cifrado: () => false, abrir: async () => null }, busca.LIMITES, agora);
}, (r) => r.parou === "fim" && r.itens.length === 1);
{
  const itens = [{ id: "a", texto: "A ação de quinta muda de lugar", criado_em: "" }, { id: "b", texto: "Nada a ver", criado_em: "" }];
  const r = busca.procurar(itens, "acao");
  ok("procurar ignora acento e caixa e devolve o trecho com o termo como está no texto", r.length === 1 && r[0].achado === "ação" && r[0].antes === "A " && r[0].depois.startsWith(" de quinta"));
  ok("termo com menos de 2 letras não procura", busca.procurar(itens, "a").length === 0);
  ok("os tetos padrão são os da tela (300 posts, 60 dias, 2 MB)", busca.LIMITES.posts === 300 && busca.LIMITES.dias === 60 && busca.LIMITES.bytes === 2 * 1024 * 1024);
  const tela = ler("components/rede/uso/BuscaNoAparelho.tsx");
  ok("a busca não guarda nada no navegador", !/localStorage|sessionStorage|indexedDB/.test(tela + ler("components/rede/uso/busca-local.ts")));
  // (A página do núcleo, desde a R2, só tem o perfil público e a entrada: a busca do núcleo mora no grupo, nos aparelhos.)
  ok("a busca aparece na comunidade fechada", /<BuscaDoGrupo /.test(ler("components/rede/comunidades/PaginaDaComunidadeAlumia.tsx")));
}

// ═══════════════════ A3.2 · a situação do pedido ═══════════════════
const etapa = await import("../components/rede/uso/etapa.ts");
const nomes = (e) => etapa.passosDoPedido(e).map((p) => `${p.nome}:${p.estado}`).join(" ");
ok("na fila: o primeiro passo é o de agora", nomes("na_fila") === "na_fila:agora em_analise:falta aprovada:falta");
ok("em análise: a fila já foi", nomes("em_analise") === "na_fila:feito em_analise:agora aprovada:falta");
ok("recusado: o último passo é recusado (nunca aprovado junto)", nomes("recusada") === "na_fila:feito em_analise:feito recusada:agora");
ok("banco antigo sem etapa: vale a situação", etapa.etapaDe({ situacao: "em_analise" }) === "em_analise" && etapa.etapaDe({ situacao: "em_analise", etapa: "na_fila" }) === "na_fila" && etapa.etapaDe({ situacao: "suspensa" }) === null);
{
  const portao = ler("components/rede/entrada/PortaoDaAlumia.tsx");
  ok("o portão mostra a situação em passos na análise e na recusa", (portao.match(/<SituacaoDoPedido /g) ?? []).length === 2);
  ok("depois de cadastrar o aplicativo vêm os códigos de recuperação", /aoConfirmar=\{\(\) => setFase\(\{ f: "codigos" \}\)\}/.test(portao) && /<CodigosNaEntrada /.test(portao));
  ok("o pedido do código mostra o caminho de quem perdeu o celular", /<PerdiOAplicativo /.test(ler("components/rede/entrada/SegundoFator.tsx")));
  ok("o texto da situação não fala de quem analisa por nome", /Não mostramos o nome de quem analisou/.test(usoPt.entrada.quem));
}

// ═══════════════════ A3.1 · por que não aparece o número ═══════════════════
{
  const telas = execFileSync("git", ["grep", "-l", "<PorQueSemNumero", "--", "components/rede"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean);
  ok(`o "por que não aparece o número?" está ao lado das contagens escondidas (${telas.length} telas)`, telas.length >= 15);
  const peca = ler("components/rede/uso/PorQueSemNumero.tsx") + ler("components/rede/uso/uso.css");
  ok("o botão tem alvo de toque de 44 px e não pede nada ao servidor", /min-width: 44px; min-height: 44px/.test(peca) && !/rpc\(|fetch\(/.test(peca));
}

// ═══════════════════ A4.3 e A2.2 · interruptores ═══════════════════
{
  const pagina = ler("components/rede/comunidades/PaginaDaComunidadeAlumia.tsx");
  ok("o canal com a mediação só abre com o interruptor ligado; desligado, segue a denúncia com protocolo", /canal === true && <FalarComAModeracao/.test(pagina) && /canal === false && sm/.test(pagina));
  ok("a caixa da mediação só aparece com o interruptor ligado", /if \(!ligado\) return null;/.test(pagina) && /<CaixaDaMediacao /.test(pagina));
  const nomes2 = ler("components/painel/alumia/nomes-das-funcoes.ts");
  ok("os dois interruptores novos têm nome e descrição no painel único", /"alumia-falar-moderacao":/.test(nomes2) && /"alumia-identidades":/.test(nomes2));
  ok("a tela das identidades não mostra mais o em construção", !/EmConstrucao/.test(ler("components/rede/seguranca/TelaDasIdentidades.tsx")));
  const modmail = await import("../components/rede/uso/cliente-modmail.ts").catch(() => null);
  if (modmail) {
    const d = modmail.criarDubleDaPrevia();
    await espera("o dublê da prévia nunca mostra o codinome à mediação sem a pessoa escolher", async () => [await d.caixa(""), await d.minhas()], ([caixa, minhas]) => caixa.every((c) => (c.codinome === null) === !c.com_codinome) && minhas.every((c) => c.codinome === null));
    ok("os códigos do banco viram texto da tela", modmail.codigoDoModmail(new Error("muitas_abertas")) === "muitas_abertas" && modmail.codigoDoModmail({ code: "invalido:texto" }) === "invalido" && modmail.codigoDoModmail(new Error("sem_permissao")) === "nao_encontrado" && modmail.codigoDoModmail("x") === "falha");
  } else falhas.push("cliente-modmail.ts não carregou no Node");
}

console.log(falhas.length ? `\nFALHAS:\n - ${falhas.join("\n - ")}\n` : "");
console.log(`R1 uso (telas): ${certos} certos, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
