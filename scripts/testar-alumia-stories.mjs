// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente F5 da Alumia (stories e mídia criativa; pranchas celular-stories-na-linha, celular-criar-story e
// celular-ver-story) no front-end: o tempo (some em 24 h, "3 h", a contagem "2 DIAS · 04 HORAS · 31 MIN"), o visual (barras,
// anel, nome curto, link só https, no máximo 3 figurinhas), o "já vi" só no aparelho, os endereços, o cliente (nenhuma chamada diz
// ao servidor que alguém viu; abrir é só leitura), o dublê da prévia, a enquete secreta (soma só para a autora e a partir de 3),
// as figurinhas desenhadas, os textos nos 6 idiomas e o encaixe desligado sem as flags.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-stories.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { doisDigitos, faltaParaOAto, haQuanto, noAr } from "../lib/rede/stories/tempo.ts";
import {
  alternarFigurinha, anelEmCss, barrasDoProgresso, coresDoAnel, corValida, dominioDoLink, duracaoDoStory, linkSeguro, mosaicoDeFundo,
  nomeCurto, somaDaEnquete, tamanhoDoTexto,
} from "../lib/rede/stories/visual.ts";
import {
  alternarSilencio, CHAVE_SILENCIADOS, CHAVE_VISTOS, grupoVisto, lerSilenciados, lerVistos, marcarVisto, ordenarFaixa, primeiroNaoVisto,
} from "../lib/rede/stories/aparelho.ts";
import { enderecosDosStories, lerPedidoDoEndereco } from "../lib/rede/stories/enderecos.ts";
import { medidaQueCabe } from "../lib/rede/stories/imagem.ts";
import { criarClienteDeStories } from "../lib/rede/cliente-stories.ts";
import { criarClienteDaPrevia, storiesDeExemplo } from "../lib/rede/stories/exemplos.ts";
import { LIMITES_DO_STORY, REACOES_DO_STORY } from "../lib/rede/tipos-stories.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 300)}, esperava ${JSON.stringify(esperado)?.slice(0, 300)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), "utf8");

const H = 3600_000;
const AGORA = Date.parse("2026-11-09T12:00:00Z");
const iso = (ms) => new Date(AGORA + ms).toISOString();

// ── O tempo ──
igual("há 3 h", haQuanto(iso(-3 * H - 60_000), AGORA), { n: 3, unidade: "h" });
igual("há 12 min", haQuanto(iso(-12 * 60_000), AGORA), { n: 12, unidade: "min" });
igual("agora (e data no futuro também)", [haQuanto(iso(-10_000), AGORA).unidade, haQuanto(iso(5 * H), AGORA).unidade], ["agora", "agora"]);
ok("ainda no ar com 23 h 59", noAr(iso(60_000), AGORA));
ok("some quando expira (24 h)", !noAr(iso(0), AGORA) && !noAr(iso(-1), AGORA) && !noAr("lixo", AGORA));
igual("a contagem da prancha: 2 dias, 04 horas, 31 min", faltaParaOAto(iso(2 * 24 * H + 4 * H + 31 * 60_000 + 30_000), AGORA), { dias: 2, horas: 4, minutos: 31, passou: false });
ok("ato que já começou = passou", faltaParaOAto(iso(-1000), AGORA).passou && faltaParaOAto("x", AGORA).passou);
igual("dois dígitos", [doisDigitos(4), doisDigitos(31), doisDigitos(-2)], ["04", "31", "00"]);

// ── O visual ──
igual("barras: antes cheias, a atual pela fração, depois vazias", barrasDoProgresso(3, 1, 0.45), [1, 0.45, 0]);
igual("barra com fração inválida fica 0", barrasDoProgresso(2, 0, NaN), [0, 0]);
igual("story com figurinha de toque dura 10 s, sem ela 6 s", [duracaoDoStory([{ tipo: "enquete" }]), duracaoDoStory([]), duracaoDoStory([{ tipo: "link" }])], [10_000, 6_000, 6_000]);
igual("nome curto como na prancha", [nomeCurto("Rosa Vermelha"), nomeCurto("Passe Livre SP"), nomeCurto("DCE")], ["Rosa Ver…", "Passe Li…", "DCE"]);
ok("anel: vermelho no alto e 4 cores sem repetir", (() => { const c = coresDoAnel("rosavermelha"); return c[0] === "#c21f16" && new Set(c).size === 4; })());
ok("anel visto fica cinza (sem cor nenhuma)", anelEmCss("x", true) === "var(--al-superficie-2)" && anelEmCss("x", false).startsWith("conic-gradient"));
igual("cor desconhecida vira azul", [corValida("rosa"), corValida("roxo"), corValida(null)], ["rosa", "azul", "azul"]);
ok("o mosaico de fundo é o mesmo para o mesmo story", JSON.stringify(mosaicoDeFundo("a", "vermelho")) === JSON.stringify(mosaicoDeFundo("a", "vermelho")) && mosaicoDeFundo("a", "vermelho").length === 26 * 48);
ok("texto longo encolhe, nunca abaixo de 28 px", tamanhoDoTexto("Paralisação na quinta") > tamanhoDoTexto("x".repeat(80)) && tamanhoDoTexto("x".repeat(140)) >= 28);
ok("o criar usa o texto menor (escala 0,76): a frase da prancha em 2 linhas", tamanhoDoTexto("Plenária do Núcleo Leste", 375, 0.76) < tamanhoDoTexto("Plenária do Núcleo Leste", 375) && tamanhoDoTexto("Plenária do Núcleo Leste", 375, 0.76) <= 56);
igual("link: só https, sem usuário/senha", [
  linkSeguro("https://institutolucia.org/a"), linkSeguro("institutolucia.org"), linkSeguro("http://x.org"), linkSeguro("javascript:alert(1)"),
  linkSeguro("https://user:senha@x.org"), linkSeguro("https://localhost"), linkSeguro(""),
], ["https://institutolucia.org/a", "https://institutolucia.org/", null, null, null, null, null]);
igual("domínio sem www", dominioDoLink("https://www.cartacapital.com.br/x"), "cartacapital.com.br");
{
  const p = { tipo: "pergunta" }, e = { tipo: "enquete" }, c = { tipo: "contagem" }, l = { tipo: "link" };
  igual("figurinha liga e desliga", alternarFigurinha(alternarFigurinha([], p), p), []);
  igual("no máximo 3 figurinhas", alternarFigurinha([p, e, c], l).map((f) => f.tipo), ["pergunta", "enquete", "contagem"]);
  ok("o limite do contrato é 3", LIMITES_DO_STORY.figurinhas === 3);
}
igual("enquete: abaixo de 3 votos não há soma", [somaDaEnquete([1, 1]), somaDaEnquete(null), somaDaEnquete([0, 2])], [null, null, null]);
igual("enquete: a partir de 3, porcentagens que somam 100", somaDaEnquete([2, 1]), { total: 3, pct: [67, 33] });

// ── O "já vi" fica SÓ no aparelho ──
{
  const mem = new Map();
  const a = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  marcarVisto(a, "s1", AGORA);
  marcarVisto(a, "s2", AGORA - 27 * H);
  igual("visto vale 26 h e o velho sai", Object.keys(lerVistos(a, AGORA)), ["s1"]);
  ok("as chaves começam com lucia:rede (o Sair rápido apaga)", CHAVE_VISTOS.startsWith("lucia:rede") && CHAVE_SILENCIADOS.startsWith("lucia:rede"));
  mem.set(CHAVE_VISTOS, "{lixo");
  igual("armazém estragado não quebra", lerVistos(a, AGORA), {});
  igual("sem armazém (aba anônima travada) não quebra", [lerVistos(null, AGORA), lerSilenciados(null)], [{}, []]);
  const g = (h, ids, t) => ({ autora: { handle: h, nome: h }, ids, ultimo_em: iso(t) });
  const vistos = { a1: AGORA, a2: AGORA };
  const grupos = [g("ana", ["a1", "a2"], -1 * H), g("bia", ["b1"], -5 * H), g("caio", ["c1", "c2"], -2 * H), g("vazio", [], 0)];
  igual("faixa: quem tem story não visto vem antes, o mais novo primeiro", ordenarFaixa(grupos, vistos).map((x) => x.autora.handle), ["caio", "bia", "ana"]);
  igual("silenciado neste aparelho sai da faixa", ordenarFaixa(grupos, vistos, ["bia"]).map((x) => x.autora.handle), ["caio", "ana"]);
  ok("grupo todo visto", grupoVisto(grupos[0], vistos) && !grupoVisto(grupos[1], vistos) && !grupoVisto(grupos[3], vistos));
  igual("abre do primeiro não visto", [primeiroNaoVisto(g("x", ["a1", "z"], 0), vistos), primeiroNaoVisto(grupos[0], vistos)], [1, 0]);
  igual("silenciar e voltar a mostrar", [alternarSilencio(a, "bia", true), alternarSilencio(a, "bia", false)], [["bia"], []]);
}

// ── Os endereços ──
igual("ver e criar", [enderecosDosStories.ver("pt", "rosavermelha", 2), enderecosDosStories.criar("en", "nada"), enderecosDosStories.stories("fr")],
  ["/pt/alumia/stories?ver=rosavermelha&i=2", "/en/alumia/stories?criar=1", "/fr/alumia/stories"]);
igual("o endereço só aceita o formato certo", lerPedidoDoEndereco(new URLSearchParams("ver=../../x&i=999&criar=1&post=<script>")), { ver: null, i: 0, criar: true, post: null });
igual("ver eu", lerPedidoDoEndereco(new URLSearchParams("ver=eu&i=1")).ver, "eu");

// ── A imagem ──
igual("cabe em 1080 × 1920 sem aumentar", [medidaQueCabe(4000, 3000), medidaQueCabe(500, 400), medidaQueCabe(0, 10)], [{ largura: 1080, altura: 810 }, { largura: 500, altura: 400 }, { largura: 0, altura: 0 }]);
{
  const src = ler("lib/rede/stories/imagem.ts");
  ok("a imagem é redesenhada num canvas (sem EXIF/GPS) e sai em WEBP até 3 MB", /drawImage/.test(src) && /image\/webp/.test(src) && /3 \* 1024 \* 1024/.test(src));
}

// ── O cliente: nenhuma chamada conta que alguém viu ──
{
  const chamadas = [];
  const c = criarClienteDeStories(async (nome, args) => { chamadas.push([nome, args]); return {}; }, async () => "u/x.webp");
  await c.faixa(); await c.abrir("rosavermelha"); await c.meus(); await c.responder("id", "oi"); await c.reagir("id", "punho");
  await c.votar("id", 1); await c.avisar("id", true); await c.atos(); await c.apagar("id"); await c.denunciar("id", "spam");
  const nomes = chamadas.map((x) => x[0]);
  ok("todas as funções são rede_story_*", nomes.every((n) => /^rede_story_[a-z]+$/.test(n)));
  ok("nenhuma função de visualização (viu, visto, view, visualiz)", !nomes.some((n) => /vist|viu|view|visualiz|assist/i.test(n)));
  igual("abrir os stories de alguém é UMA leitura e nada mais", (() => { chamadas.length = 0; return c.abrir("ana").then(() => chamadas.map((x) => x[0])); })() instanceof Promise, true);
  chamadas.length = 0;
  await c.abrir("ana");
  igual("abrir chama só rede_story_abrir", chamadas.map((x) => x[0]), ["rede_story_abrir"]);
  const contrato = ler("lib/rede/tipos-stories.ts").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
  ok("o contrato não tem campo de quem viu nem de quantos viram", !/\b(viu|visto|vistos|views?|visualiza\w*|assistiu|espectador\w*)\s*[?]?:/i.test(contrato));
  igual("reações: conjunto fechado de 3", [...REACOES_DO_STORY], ["punho", "chama", "coracao"]);
  for (const arq of ["components/rede/stories/Visor.tsx", "components/rede/stories/FaixaDeStories.tsx", "components/rede/stories/Criar.tsx"]) {
    const usados = new Set([...ler(arq).matchAll(/cliente\.(\w+)\(/g)].map((m) => m[1]));
    ok(`${arq} só usa funções do contrato`, [...usados].every((u) => ["faixa", "abrir", "meus", "publicar", "apagar", "responder", "reagir", "votar", "avisar", "atos", "denunciar", "enviarImagem"].includes(u)));
  }
  ok("o visor marca o visto só no aparelho", /marcarVisto\(armazemDoAparelho\(\)/.test(ler("components/rede/stories/Visor.tsx")));
  ok("o link abre sem dizer de onde veio", /noreferrer/.test(ler("components/rede/figurinhas/Link.tsx")));
  ok("o criar bloqueia dado pessoal antes de enviar", /checarTexto\(tudo\)\.bloqueia/.test(ler("components/rede/stories/Criar.tsx")));
}

// ── O dublê da prévia ──
{
  let t = AGORA;
  const d = criarClienteDaPrevia(() => t);
  ok("o dublê se diz prévia", d.previa === true);
  const faixa = await d.faixa();
  igual("a faixa da prévia: Rosa, Passe Livre, Núcleo Leste, DCE", faixa.grupos.map((g) => g.autora.nome), ["Rosa Vermelha", "Passe Livre SP", "Núcleo Leste", "DCE Livre"]);
  const rosa = await d.abrir("rosavermelha");
  const ver = rosa.find((s) => s.id === "ex-rosa-2");
  ok("o story da prancha tem contagem e enquete", ver.figurinhas.map((f) => f.tipo).join() === "contagem,enquete" && ver.legenda === "Panfletagem no RU · amanhã, 11h");
  const enq = ver.figurinhas.find((f) => f.tipo === "enquete");
  ok("quem vê não recebe a soma da enquete", enq.soma == null);
  const votada = await d.votar("ex-rosa-2", 0);
  igual("o voto volta só como o MEU voto", [votada.meu_voto, votada.soma ?? null], [0, null]);
  igual("me avise", await d.avisar("ex-rosa-2", true), { avisar: true });
  const r = await d.publicar({ publico: "proximos", fundo: { tipo: "listras", cor: "verde" }, texto: "Oi", legenda: null, imagem: null, alt: null, figurinhas: [], post_ref: null });
  ok("publicar devolve id e expira em 24 h", Date.parse(r.expira_em) - t === LIMITES_DO_STORY.vida);
  igual("o meu aparece na minha bolinha", (await d.faixa()).meus, [r.id]);
  t += LIMITES_DO_STORY.vida + 1;
  igual("depois de 24 h some da faixa e dos meus", [(await d.faixa()).meus, (await d.meus()).length, (await d.faixa()).grupos.length], [[], 0, 0]);
  ok("exemplos só com codinomes de exemplo", storiesDeExemplo(AGORA).every((s) => /^[a-z]+$/.test(s.autora.handle)));
}

// ── Os textos nos 6 idiomas ──
{
  const pasta = path.join(raiz, "i18n/rede/stories");
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const valor = (o, k) => k.split(".").reduce((x, c) => x?.[c], o);
  const pt = JSON.parse(fs.readFileSync(path.join(pasta, "pt.json"), "utf8"));
  const lista = chaves(pt);
  ok("as frases da prancha em pt", pt.faixa.aviso === "Ninguém fica sabendo que você viu. Some em 24 h." && pt.criar.regra === "Some em 24 h. Não vai para o Fediverso. Ninguém vê quem assistiu." && pt.figurinha.enquete.nota === "A soma fica só com {nome}. Seu nome não aparece." && pt.figurinha.contagem.avisar === "Me avise quando começar");
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(fs.readFileSync(path.join(pasta, `${l}.json`), "utf8"));
    igual(`${l}: as mesmas chaves do pt`, chaves(j).sort(), [...lista].sort());
    const faltaMarca = lista.filter((k) => {
      const marcas = (s) => [...String(s ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      return marcas(valor(pt, k)) !== marcas(valor(j, k));
    });
    igual(`${l}: as mesmas marcas {nome}/{n}`, faltaMarca, []);
    ok(`${l}: nada vazio`, lista.every((k) => String(valor(j, k) ?? "").trim() !== ""));
  }
}

// ── Os componentes desenhados (react-dom/server) ──
{
  const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@/": `${raiz}/` }, moduleCache: false });
  const React = await import("react");
  globalThis.React = React;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const h = React.createElement;
  const t = JSON.parse(fs.readFileSync(path.join(raiz, "i18n/rede/stories/pt.json"), "utf8"));
  try {
    const { EnqueteVer } = await jiti.import(path.join(raiz, "components/rede/figurinhas/Enquete.tsx"));
    const f = { tipo: "enquete", pergunta: "Você vai na panfletagem?", opcoes: ["Vou", "Não dá"], meu_voto: null, soma: [5, 1] };
    const quemVe = renderToStaticMarkup(h(EnqueteVer, { f, t: t.figurinha.enquete, nome: "Rosa", meu: false, ocupado: false, aoVotar() {} }));
    ok("enquete para quem vê: a nota da prancha e nenhuma porcentagem", quemVe.includes("A soma fica só com Rosa. Seu nome não aparece.") && !quemVe.includes("%"));
    const autora = renderToStaticMarkup(h(EnqueteVer, { f, t: t.figurinha.enquete, nome: "Rosa", meu: true, ocupado: false, aoVotar() {} }));
    ok("enquete para a autora: a soma em porcentagem", autora.includes("83%") && autora.includes("17%") && autora.includes("6 votos"));
    const poucas = renderToStaticMarkup(h(EnqueteVer, { f: { ...f, soma: [1, 1] }, t: t.figurinha.enquete, nome: "Rosa", meu: true, ocupado: false, aoVotar() {} }));
    ok("enquete com 2 votos: a autora vê só 'poucas pessoas'", poucas.includes("a partir de 3") && !poucas.includes("%"));

    const { ContagemVer } = await jiti.import(path.join(raiz, "components/rede/figurinhas/Contagem.tsx"));
    const agora = Date.now();
    const cont = renderToStaticMarkup(h(ContagemVer, { f: { tipo: "contagem", ato: "a1", titulo: "Passe Livre Já", inicio: new Date(agora + 2 * 24 * H + 4 * H + 31 * 60_000 + 30_000).toISOString(), avisar: false }, t: t.figurinha.contagem, agora, lang: "pt", ocupado: false, aoAvisar() {} }));
    ok("contagem: Ato · Passe Livre Já, 2 / 04 / 31 e Me avise", cont.includes("Ato · Passe Livre Já") && cont.includes("<dd>2</dd>") && cont.includes("<dd>04</dd>") && cont.includes("<dd>31</dd>") && cont.includes("Me avise quando começar"));
    const contAutora = renderToStaticMarkup(h(ContagemVer, { f: { tipo: "contagem", ato: "a1", titulo: "X", inicio: new Date(agora + H).toISOString() }, t: t.figurinha.contagem, agora, lang: "pt", ocupado: false, aoAvisar: null }));
    ok("a autora não tem 'Me avise' (nem vê quem pediu)", !contAutora.includes("Me avise"));

    const { LinkVer } = await jiti.import(path.join(raiz, "components/rede/figurinhas/Link.tsx"));
    ok("link http não desenha", renderToStaticMarkup(h(LinkVer, { url: "http://x.org", rotulo: "x", t: t.figurinha.link })) === "");
    ok("link https abre fora sem referência", /rel="noopener noreferrer[^"]*"/.test(renderToStaticMarkup(h(LinkVer, { url: "https://x.org", rotulo: "Leia", t: t.figurinha.link }))));

    const { PerguntaVer } = await jiti.import(path.join(raiz, "components/rede/figurinhas/Pergunta.tsx"));
    const perg = renderToStaticMarkup(h(PerguntaVer, { texto: "O que não pode faltar na pauta?", t: t.figurinha.pergunta, nome: "Rosa", meu: false, enviar: async () => true, aoFoco() {} }));
    ok("pergunta: resposta só para a autora", perg.includes("Respostas só para Rosa."));
  } catch (e) {
    falhas.push(`componentes: ${e?.stack?.split("\n").slice(0, 3).join(" | ") ?? e}`);
  }

  try {
    const { encaixe } = await jiti.import(path.join(raiz, "components/rede/stories/encaixe.tsx"));
    const ctx = { lang: "pt", s: {}, situacao: { logado: true, membro: true, regras_versao: 1 } };
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement: h } = await import("react");
    ok("sem item próprio no menu (a faixa vive no Início: um só aria-current)", !("menu" in encaixe));
    igual("sem as flags, a faixa do alto da linha não desenha nada", encaixe.topoDaLinha.map((C) => renderToStaticMarkup(h(C, ctx))), [""]);
    igual("sem as flags, o Pôr no story não desenha nada", encaixe.acoesDoCartao.map((C) => renderToStaticMarkup(h(C, { ...ctx, post: { id: "x" } }))), [""]);
    ok("o encaixe só pendura a faixa no alto da linha e o Pôr no story", Object.keys(encaixe).sort().join() === "acoesDoCartao,topoDaLinha");
    const fonte = ler("components/rede/stories/encaixe.tsx");
    ok("o Pôr no story só baixa os textos depois de conferir a flag", /function PorNoStory\([^)]*\) \{\s*if \(!situacao\.logado \|\| !rotaNovaLigada\("stories"\)\) return null;/.test(fonte) && !/function PorNoStory\([^)]*\) \{[^}]*useTextosDosStories/.test(fonte));
    ok("a linha de Início desenha o topoDaLinha acima das abas", /ENCAIXES\.topoDaLinha\.map[\s\S]*role="tablist"/.test(ler("components/rede/Rede.tsx")));
  } catch (e) {
    falhas.push(`encaixe: ${e?.stack?.split("\n").slice(0, 3).join(" | ") ?? e}`);
  }
}

// ── O CSS: tudo dentro de [data-al="2"] (desligado, nada casa) e as variantes e-ink e alto contraste ──
{
  const css = ler("components/rede/stories/stories.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const seletores = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim()).filter((s) => s && !/^(from|to|\d+%)$/.test(s));
  igual("todo seletor dos stories fica dentro de [data-al=\"2\"]", seletores.filter((s) => s.replace(/:is\([^)]*\)/g, ":is()").split(",").some((p) => !p.includes('[data-al="2"]'))), []);
  ok("tem e-ink e alto contraste", /\[data-eink\]/.test(css) && /\[data-contrast\]/.test(css));
}

console.log(`Alumia (F5, stories): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
