// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o mosaico do ato e os componentes base da Alumia nova (PLANO-ALUMIA F0; pranchas celular-modo-atos e computador-inicio):
// a palavra vira a grade certa (31 × 17 no celular, 65 × 9 no computador), cartão a cartão; nada acende abaixo de 3 confirmações;
// a proporção anda em passos de 10 % com piso 30 no denominador; mesma semente, mesma grade; o cartão dourado sai de uma semente do
// aparelho; e os componentes (Mosaico, Carimbo, Flaps, Avatar16, Selo, Botao, Pilula, Lampiao, Faixa) desenham o que dizem.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-mosaico.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import {
  cartaoDoVoce, cartoesAcesos, celulasDoAvatar, FONTE_5X7, gradeDaPalavra, larguraDaLinha, montarMosaico, normalizarPalavra,
  proporcaoDoMosaico, proporcaoValida, quebrarEmLinhas, sementeDe,
} from "../lib/rede/mosaico.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 400)}, esperava ${JSON.stringify(esperado)?.slice(0, 400)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const desenho = (g) => Array.from({ length: g.linhas }, (_, y) => g.letra.slice(y * g.colunas, (y + 1) * g.colunas).map((l) => (l ? "#" : ".")).join(""));

// ── A fonte ──
for (const [ch, glifo] of Object.entries(FONTE_5X7)) ok(`a letra "${ch}" tem 7 linhas de 5`, glifo.length === 7 && glifo.every((l) => /^[#.]{5}$/.test(l)));
ok("a fonte tem A–Z e 0–9", [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].every((c) => c in FONTE_5X7));

// ── A palavra ──
igual("maiúsculas, sem acento, espaços simples", normalizarPalavra("  já   livre! "), "JA LIVRE!");
igual("ç e til", normalizarPalavra("Ocupação São"), "OCUPACAO SAO");
igual("no máximo 14", normalizarPalavra("ABCDEFGHIJKLMNOPQ"), "ABCDEFGHIJKLMN");
igual("sinais fora da fonte viram espaço", normalizarPalavra("GREVE@GERAL#"), "GREVE GERAL");
igual("largura de PASSE", larguraDaLinha("PASSE"), 29);
igual("largura de PASSE LIVRE (espaço de 3)", larguraDaLinha("PASSE LIVRE"), 63);
igual("quebra nos espaços para caber em 31", quebrarEmLinhas("PASSE LIVRE", 31), ["PASSE", "LIVRE"]);
igual("sem largura, uma linha só", quebrarEmLinhas("PASSE LIVRE"), ["PASSE LIVRE"]);
igual("palavra maior que a largura não é cortada", quebrarEmLinhas("OCUPACAO", 31), ["OCUPACAO"]);

// ── As grades das pranchas ──
const celular = gradeDaPalavra("Passe Livre", { quebrar: 31 });
igual("celular-modo-atos: 31 colunas × 17 linhas", [celular.colunas, celular.linhas], [31, 17]);
// Conferido cartão a cartão com a prancha celular-modo-atos (letras em vermelho; margem de 1; uma linha entre PASSE e LIVRE).
igual("celular: a grade bate com a prancha", desenho(celular), [
  "...............................",
  ".####...###...####..####.#####.",
  ".#...#.#...#.#.....#.....#.....",
  ".#...#.#...#.#.....#.....#.....",
  ".####..#####..###...###..####..",
  ".#.....#...#.....#.....#.#.....",
  ".#.....#...#.....#.....#.#.....",
  ".#.....#...#.####..####..#####.",
  "...............................",
  ".#......###..#...#.####..#####.",
  ".#.......#...#...#.#...#.#.....",
  ".#.......#...#...#.#...#.#.....",
  ".#.......#...#...#.####..####..",
  ".#.......#...#...#.#.#...#.....",
  ".#.......#....#.#..#..#..#.....",
  ".#####..###....#...#...#.#####.",
  "...............................",
]);
const computador = gradeDaPalavra("PASSE LIVRE");
igual("computador-inicio: uma linha, 65 × 9", [computador.colunas, computador.linhas], [65, 9]);
igual("computador: a primeira e a última linha são margem", [desenho(computador)[0].includes("#"), desenho(computador)[8].includes("#")], [false, false]);
igual("VEM (traga-sua-organizacao): 19 × 9", [gradeDaPalavra("VEM").colunas, gradeDaPalavra("VEM").linhas], [19, 9]);
igual("palavra vazia ainda dá uma grade apagada", [gradeDaPalavra("").colunas, gradeDaPalavra("").linhas, gradeDaPalavra("").letra.some(Boolean)], [3, 9, false]);

// ── Privacidade: proporção, nunca número; nada abaixo de 3 ──
igual("abaixo de 3, nada acende", [proporcaoDoMosaico(0), proporcaoDoMosaico(1), proporcaoDoMosaico(2), proporcaoDoMosaico(null)], [null, null, null, null]);
igual("3 confirmações acendem 10 % (piso 30 no denominador)", proporcaoDoMosaico(3), 0.1);
igual("passos de 10 %, arredondando para baixo", [proporcaoDoMosaico(5), proporcaoDoMosaico(9), proporcaoDoMosaico(14), proporcaoDoMosaico(29), proporcaoDoMosaico(30), proporcaoDoMosaico(1000)], [0.1, 0.3, 0.4, 0.9, 1, 1]);
igual("com meta de 200, 48 pessoas = 20 %", proporcaoDoMosaico(48, 200), 0.2);
igual("meta menor que 30 não baixa o piso", proporcaoDoMosaico(6, 10), 0.2);
igual("só passos de 10 % passam; um número de pessoas vira nulo", [proporcaoValida(0.3), proporcaoValida(0.35), proporcaoValida(48), proporcaoValida(0), proporcaoValida(1)], [0.3, null, null, null, 1]);
for (const p of [null, 0.35, 48]) {
  igual(`proporção ${p} não acende nada`, cartoesAcesos(celular, 1, p).some(Boolean), false);
}
{
  const total = celular.colunas * celular.linhas;
  for (const p of [0.1, 0.5, 0.8, 1]) igual(`com ${p * 100} % acendem ceil(${p} × ${total})`, cartoesAcesos(celular, sementeDe("ato"), p).filter(Boolean).length, Math.ceil(p * total));
  const a = cartoesAcesos(celular, sementeDe("ato-1"), 0.5);
  igual("mesma semente, mesmos cartões", cartoesAcesos(celular, sementeDe("ato-1"), 0.5), a);
  ok("semente diferente, cartões diferentes", JSON.stringify(cartoesAcesos(celular, sementeDe("ato-2"), 0.5)) !== JSON.stringify(a));
  const a8 = cartoesAcesos(celular, sementeDe("ato-1"), 0.8);
  ok("mais gente só acende mais (quem estava aceso continua)", a.every((v, i) => !v || a8[i]));
  const letras = celular.letra.filter(Boolean).length;
  const letrasAcesas = celular.letra.filter((l, i) => l && a8[i]).length;
  ok("letra e fundo acendem na mesma proporção (a palavra fica mais nítida com mais gente)", Math.abs(letrasAcesas / letras - 0.8) < 0.15);
}

// ── O cartão dourado ──
{
  const acesos = cartoesAcesos(celular, sementeDe("ato-1"), 0.6);
  const v = cartaoDoVoce(acesos, sementeDe("aparelho-A"));
  ok("o cartão dourado é um cartão aceso", v !== null && acesos[v]);
  igual("mesma semente do aparelho, mesmo lugar", cartaoDoVoce(acesos, sementeDe("aparelho-A")), v);
  igual("nada aceso, sem cartão dourado", cartaoDoVoce(cartoesAcesos(celular, 1, null), 1), null);
  const m = montarMosaico("PASSE LIVRE", "ato-1", 0.6, { quebrar: 31, voce: true, sementeLocal: "aparelho-A" });
  igual("montarMosaico: um só cartão dourado", m.cartoes.filter((c) => c === "voce").length, 1);
  igual("sem ter confirmado, nenhum dourado", montarMosaico("PASSE LIVRE", "ato-1", 0.6, { quebrar: 31 }).cartoes.includes("voce"), false);
  const sem = montarMosaico("PASSE LIVRE", "ato-1", null, { quebrar: 31, voce: true });
  igual("abaixo de 3: tudo apagado, a palavra só em vermelho escuro, sem dourado", [...new Set(sem.cartoes)].sort(), ["apagado", "letra-apagada"]);
  igual("o mosaico nunca recebe número de pessoas", montarMosaico("X", "a", 48).proporcao, null);
}

// ── O rosto de 16 cartões ──
{
  const r = celulasDoAvatar("rosavermelha");
  igual("16 cartões", r.length, 16);
  igual("o mesmo @nome dá o mesmo rosto", celulasDoAvatar("rosavermelha"), r);
  ok("@nomes diferentes dão rostos diferentes", JSON.stringify(celulasDoAvatar("tiaodomorro")) !== JSON.stringify(r));
  ok("sempre pelo menos 9 cartões cheios", ["a", "bb", "rosavermelha", "faisca", "lia_quilombo", "x1", "nucleocohab2"].every((h) => celulasDoAvatar(h).filter((c) => c !== 0).length >= 9));
}

// ── Os componentes, desenhados no servidor (react-dom/server) ──
{
  const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@/": `${raiz}/` }, moduleCache: false });
  const React = await import("react");
  // O jiti transforma JSX no React.createElement clássico: o React fica à mão, só neste roteiro.
  globalThis.React = React;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const h = React.createElement;
  const html = (el) => renderToStaticMarkup(el);
  try {
    const { Mosaico } = await jiti.import(path.join(raiz, "components/rede/mosaico/Mosaico.tsx"));
    const svg = html(h(Mosaico, { palavra: "Passe Livre", semente: "ato-1", proporcao: 0.8, quebrar: 31, voce: true, sementeLocal: "a", rotulo: "Mosaico do ato PASSE LIVRE" }));
    ok("Mosaico: svg com role=img e o rótulo", /<svg role="img" aria-label="Mosaico do ato PASSE LIVRE"/.test(svg));
    ok("Mosaico: 31 × 17 cartões", /data-colunas="31"/.test(svg) && /data-linhas="17"/.test(svg));
    igual("Mosaico: um <rect> por cartão + o anel do dourado", (svg.match(/<rect /g) ?? []).length, 31 * 17 + 1);
    ok("Mosaico: o dourado tem anel", /<g data-voce="">/.test(svg));
    ok("Mosaico: nenhum número de pessoas no desenho", !/\b48\b/.test(svg.replace(/(x|y|width|height|rx|viewBox|data-[a-z]+)="[^"]*"/g, "")));
    const vazio = html(h(Mosaico, { palavra: "VEM", semente: "ato-2", proporcao: null, rotulo: "Mosaico apagado" }));
    ok("Mosaico abaixo de 3: só cores de apagado", !vazio.includes("--al-cartao-aceso") && !vazio.includes("--al-letra-acesa") && !vazio.includes("--al-voce"));
  } catch (e) {
    falhas.push(`Mosaico: ${e.message}`);
  }
  try {
    const { Carimbo } = await jiti.import(path.join(raiz, "components/rede/ui/Carimbo.tsx"));
    const c = html(h(Carimbo, { situacao: "cancelado" }));
    ok("Carimbo cancelado: escrito e riscado", c.includes("Cancelado") && c.includes("al-riscado") && c.includes('data-situacao="cancelado"'));
    ok("Carimbo adiado: escrito, sem risco", html(h(Carimbo, { situacao: "adiado", texto: "Adiado" })).includes("Adiado") && !html(h(Carimbo, { situacao: "adiado" })).includes("al-riscado"));
  } catch (e) {
    falhas.push(`Carimbo: ${e.message}`);
  }
  try {
    const { Flaps, quantoFalta, gruposDosFlaps } = await jiti.import(path.join(raiz, "components/rede/ui/Flaps.tsx"));
    const agora = Date.UTC(2026, 10, 13, 14, 0);
    igual("Flaps: 2 dias e 4 horas viram 2d 04h (as pranchas)", gruposDosFlaps(quantoFalta(agora + (2 * 24 + 4) * 3600e3 + 59e3, agora)), ["2d", "04h"]);
    igual("Flaps: menos de um dia vira horas e minutos", gruposDosFlaps(quantoFalta(agora + (3 * 60 + 7) * 60e3, agora)), ["03h", "07m"]);
    igual("Flaps: passou, nada", gruposDosFlaps(quantoFalta(agora - 1, agora)), []);
    const f = html(h(Flaps, { ate: new Date(agora).toISOString(), rotulo: () => "faltam", agoraTexto: "agora" }));
    ok("Flaps: no servidor não mostra número (a hora é do aparelho) e é um timer", f.includes('role="timer"') && !/\d/.test(f.replace(/<[^>]+>/g, "")));
  } catch (e) {
    falhas.push(`Flaps: ${e.message}`);
  }
  try {
    const { Avatar16 } = await jiti.import(path.join(raiz, "components/rede/ui/Avatar16.tsx"));
    const a = html(h(Avatar16, { handle: "rosavermelha" }));
    ok("Avatar16: decorativo sem rótulo, cantos arredondados, só cartões cheios", a.includes('aria-hidden="true"') && a.includes('rx="8"') && (a.match(/<rect x=/g) ?? []).length === celulasDoAvatar("rosavermelha").filter((c) => c !== 0).length);
    ok("Avatar16: com rótulo vira imagem", html(h(Avatar16, { handle: "faisca", rotulo: "Rosto de @faisca" })).includes('role="img" aria-label="Rosto de @faisca"'));
  } catch (e) {
    falhas.push(`Avatar16: ${e.message}`);
  }
  try {
    const { Selo } = await jiti.import(path.join(raiz, "components/rede/ui/Selo.tsx"));
    const s = html(h(Selo, { texto: "Organização verificada", regra: "O selo diz que a conta é de quem diz ser; não é apoio do Instituto Lúcia." }));
    ok("Selo: o texto e a regra (não é apoio do Instituto) para leitor de tela e mouse", s.includes("Organização verificada") && s.includes("sr-only") && /title="[^"]*não é apoio do Instituto/.test(s));
  } catch (e) {
    falhas.push(`Selo: ${e.message}`);
  }
  try {
    const { Botao } = await jiti.import(path.join(raiz, "components/rede/ui/Botao.tsx"));
    const b = html(h(Botao, { pressionado: true, variante: "claro" }, "Você vai"));
    ok("Botao: type=button, aria-pressed e a variante", b.includes('type="button"') && b.includes('aria-pressed="true"') && b.includes("al-botao-claro"));
    const { Lampiao } = await jiti.import(path.join(raiz, "components/rede/ui/Lampiao.tsx"));
    const l = html(h(Lampiao, {}));
    ok("Lampião: 32 × 40, decorativo, chama de 10 cartões (2 dourados)", l.includes('viewBox="0 0 32 40"') && l.includes('aria-hidden="true"') && (l.match(/var\(--al-dourado/g) ?? []).length === 2);
    const { Faixa } = await jiti.import(path.join(raiz, "components/rede/ui/Faixa.tsx"));
    ok("Faixa: escondida do leitor de tela", html(h(Faixa, {})).includes('aria-hidden="true"'));
  } catch (e) {
    falhas.push(`Botao/Lampiao/Faixa: ${e.message}`);
  }
}

// ── Os tokens: contraste de verdade, calculado (WCAG 1.4.3) ──
{
  const css = (await import("node:fs")).readFileSync(path.join(raiz, "styles/alumia-tokens.css"), "utf8");
  const bloco = (seletor) => {
    const i = css.indexOf(`${seletor} {`);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };
  const token = (b, nome) => (b.match(new RegExp(`--${nome}:[ ]*(#[0-9a-fA-F]{6})`)) ?? [])[1];
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const razao = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const padrao = bloco('[data-al="2"]');
  const temas = {
    padrao,
    claro: bloco('[data-al="2"][data-al-tema="claro"]'),
    contraste: bloco(':root[data-contrast] [data-al="2"]'),
    eink: bloco(':root[data-eink] [data-al="2"]'),
  };
  for (const [nome, b] of Object.entries(temas)) {
    const fundo = token(b, "al-vermelho-texto") ?? token(padrao, "al-vermelho-texto");
    const texto = token(b, "al-sobre-vermelho") ?? token(padrao, "al-sobre-vermelho");
    ok(`tema ${nome}: texto pequeno sobre o vermelho (selo, botão p/m) passa de 4,5:1 (${fundo}/${texto})`, !!fundo && !!texto && razao(fundo, texto) >= 4.5);
    ok(`tema ${nome}: a chama do lampião tem token`, !!token(b, "al-vermelho-chama"));
  }
  ok("o botão grande primário usa o vermelho das pranchas e passa como texto grande (3:1)", razao(token(padrao, "al-vermelho"), token(padrao, "al-sobre-vermelho")) >= 3
    && /\.al-botao-primario\.al-botao-g \{ background: var\(--al-vermelho\); \}/.test(css));
  ok("selo e botão primário usam o vermelho de texto", /\.al-botao-primario \{ background: var\(--al-vermelho-texto\)/.test(css) && /\.al-selo \{[^}]*background: var\(--al-vermelho-texto\)/.test(css));
  ok("no e-ink e no alto contraste o fantasma ligado inverte o fundo (não depende só da cor)",
    /:root:is\(\[data-contrast\], \[data-eink\]\) \[data-al="2"\] \.al-botao\[aria-pressed="true"\]\.al-botao-fantasma \{ background: var\(--al-texto\); color: var\(--al-fundo\); \}/.test(css));
  const fs = await import("node:fs");
  const pasta = path.join(raiz, "components/rede/ui");
  const definidos = new Set([...css.matchAll(/(--al-[a-z0-9-]+):/g)].map((m) => m[1]));
  const faltando = fs.readdirSync(pasta).filter((f) => f.endsWith(".tsx"))
    .flatMap((f) => [...fs.readFileSync(path.join(pasta, f), "utf8").matchAll(/var\((--al-[a-z0-9-]+)/g)].map((m) => `${f}: ${m[1]}`))
    // "--al-com-${n}" é montado na hora (com-1 a com-5): confere só os nomes inteiros.
    .filter((x) => !x.endsWith("-") && !definidos.has(x.split(": ")[1]));
  ok("as cores por comunidade com-1 a com-5 existem", [1, 2, 3, 4, 5].every((n) => definidos.has(`--al-com-${n}`)));
  igual("nenhum componente base usa token que não existe em alumia-tokens.css", faltando, []);
}

console.log(`Alumia (F0, mosaico e componentes): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
