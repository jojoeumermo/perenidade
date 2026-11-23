// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o acabamento da Faixa 1: a Alumia some dentro do aplicativo do Instituto (lib/rede/app-do-instituto.ts e o pedaço dele no
// prefsScript), a aparência guardada no aparelho (lib/rede/aparencia-da-rede.ts e o script que roda antes da primeira pintura),
// o tema claro com contraste AA medido nos próprios tokens (styles/alumia-tokens.css), as telas novas registradas e os textos nos
// seis idiomas com as mesmas chaves.
// Uso: npm run testar:alumia-acabamento
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { ATRIBUTO_SEM_ALUMIA, CHAVE_DO_APP, dentroDoAppDoInstituto, ehHostDaAlumia, hostDoEndereco, pedidoPeloParametro, scriptDoApp } from "../lib/rede/app-do-instituto.ts";
import { APARENCIA_PADRAO, atributosDaAparencia, CHAVE_DA_APARENCIA, lerAparencia, scriptDaAparencia, temaQueVale } from "../lib/rede/aparencia-da-rede.ts";
import { ROTAS_DA_ALUMIA } from "../lib/rede/alumia.ts";
import { PREFIXO_DA_REDE } from "../lib/rede/saida.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));

let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)}, esperava ${JSON.stringify(esperado)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ═══════════════════ 1. Dentro do aplicativo do Instituto a Alumia some ═══════════════════
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";
const base = { ua: CHROME, instalada: false, host: "institutolucia.org", hostDaAlumia: "", busca: "", lembrado: false };
igual("navegador comum: a Alumia continua", dentroDoAppDoInstituto(base), false);
igual("WebView do Android (; wv)): some", dentroDoAppDoInstituto({ ...base, ua: WEBVIEW }), true);
igual("a marca da casca do Capacitor: some", dentroDoAppDoInstituto({ ...base, ua: `${CHROME} InstitutoLuciaApp/2` }), true);
igual("instalado na tela inicial (PWA do Instituto): some", dentroDoAppDoInstituto({ ...base, instalada: true }), true);
igual("aberto por TWA com ?app=instituto: some", dentroDoAppDoInstituto({ ...base, busca: "?app=instituto&x=1" }), true);
igual("aba que já recebeu o parâmetro: some", dentroDoAppDoInstituto({ ...base, lembrado: true }), true);
igual("outro valor de ?app não conta", dentroDoAppDoInstituto({ ...base, busca: "?app=outro" }), false);
igual("no endereço alumia.* nunca conta (é a casa dela)", dentroDoAppDoInstituto({ ...base, ua: WEBVIEW, instalada: true, host: "alumia.institutolucia.org" }), false);
igual("no host do endereço próprio configurado, nunca", dentroDoAppDoInstituto({ ...base, instalada: true, host: "rede.exemplo.org:443", hostDaAlumia: "rede.exemplo.org" }), false);
igual("ehHostDaAlumia: porta e caixa não importam", ehHostDaAlumia("ALUMIA.localhost:3000", ""), true);
igual("ehHostDaAlumia: host vazio não é", ehHostDaAlumia("", "x.org"), false);
igual("pedidoPeloParametro: busca quebrada não derruba", pedidoPeloParametro("%%%"), false);
igual("hostDoEndereco: endereço vazio", hostDoEndereco(""), "");
igual("hostDoEndereco: endereço válido", hostDoEndereco("https://alumia.institutolucia.org"), "alumia.institutolucia.org");

// O texto que roda antes da primeira pintura faz a MESMA conta (roda num navegador de mentira).
function rodarScriptDoApp({ ua, host, busca = "", instalada = false, sessao = {} }, hostDaAlumia = "") {
  const atributos = {};
  const guardado = { ...sessao };
  const contexto = {
    location: { host, search: busca },
    navigator: { userAgent: ua, standalone: false },
    sessionStorage: { getItem: (k) => guardado[k] ?? null, setItem: (k, v) => (guardado[k] = String(v)) },
    matchMedia: () => ({ matches: instalada }),
    URLSearchParams,
    document: { documentElement: { setAttribute: (n, v) => (atributos[n] = v) } },
  };
  vm.runInNewContext(scriptDoApp(hostDaAlumia), contexto);
  return { marcado: ATRIBUTO_SEM_ALUMIA in atributos, guardado };
}
igual("script: navegador comum não marca", rodarScriptDoApp({ ua: CHROME, host: "institutolucia.org" }).marcado, false);
igual("script: WebView marca o <html>", rodarScriptDoApp({ ua: WEBVIEW, host: "institutolucia.org" }).marcado, true);
igual("script: PWA instalado marca", rodarScriptDoApp({ ua: CHROME, host: "institutolucia.org", instalada: true }).marcado, true);
const viaTwa = rodarScriptDoApp({ ua: CHROME, host: "institutolucia.org", busca: "?app=instituto" });
igual("script: ?app=instituto marca e lembra na aba", [viaTwa.marcado, viaTwa.guardado[CHAVE_DO_APP]], [true, "1"]);
igual("script: a aba lembrada marca sem o parâmetro", rodarScriptDoApp({ ua: CHROME, host: "institutolucia.org", sessao: { [CHAVE_DO_APP]: "1" } }).marcado, true);
igual("script: no alumia.* nunca marca", rodarScriptDoApp({ ua: WEBVIEW, host: "alumia.institutolucia.org", instalada: true }).marcado, false);
igual("script: no host próprio configurado nunca marca", rodarScriptDoApp({ ua: WEBVIEW, host: "rede.exemplo.org" }, "rede.exemplo.org").marcado, false);

// O script que roda antes da primeira pintura mora em lib/prefs-script.ts (a página do chat o libera pelo hash).
ok("o prefsScript leva o pedaço do aplicativo", /prefsScript = `\(function\(\)\{\$\{scriptDoApp\(hostDoEndereco\(ALUMIA_URL\)\)\}/.test(ler("lib/prefs-script.ts")));
const css = ler("app/globals.css");
ok("CSS: links para /alumia e alumia.* somem com data-sem-alumia", css.includes(':root[data-sem-alumia] :is(a[href*="/alumia"], a[href^="https://alumia."]) { display: none !important; }'));
ok("CSS: a barra do celular fica com 4 abas", css.includes(":root[data-sem-alumia] .abas-do-celular > ul { grid-template-columns: repeat(4, minmax(0, 1fr)); }"));
ok("CSS: fora do aplicativo o aviso não aparece e a tela não muda", css.includes(".al-fora-do-app { display: none; }") && css.includes(".al-dentro-do-navegador { display: contents; }"));
const layout = ler("app/[lang]/alumia/layout.tsx");
ok("layout da Alumia: o aviso e a caixa do navegador", layout.includes('className="al-fora-do-app"') && layout.includes('className="al-dentro-do-navegador"'));
ok("layout da Alumia (P5): a tela vem antes do aviso escondido (o primeiro h1 é o da tela)", layout.indexOf('className="al-dentro-do-navegador"') < layout.indexOf('className="al-fora-do-app"'));
ok("layout da Alumia: o aviso volta para o início do site, não para a Alumia", layout.includes("<Link href={`/${lang}`}>{ta.voltar}</Link>"));

// ═══════════════════ 2. Aparência e leitura (só no aparelho) ═══════════════════
igual("padrão: o escuro das pranchas, números à vista", APARENCIA_PADRAO, { tema: "escuro", semNumeros: false });
igual("lerAparencia: vazio vira o padrão", lerAparencia(null), APARENCIA_PADRAO);
igual("lerAparencia: texto quebrado vira o padrão", lerAparencia("{nao é json"), APARENCIA_PADRAO);
igual("lerAparencia: tema desconhecido vira o padrão", lerAparencia(JSON.stringify({ tema: "roxo", semNumeros: true })), { tema: "escuro", semNumeros: true });
igual("lerAparencia: semNumeros só com true de verdade", lerAparencia(JSON.stringify({ tema: "claro", semNumeros: "sim" })), { tema: "claro", semNumeros: false });
igual("temaQueVale: sistema claro", temaQueVale("sistema", true), "claro");
igual("temaQueVale: sistema escuro", temaQueVale("sistema", false), "escuro");
igual("temaQueVale: escolha fixa vence o aparelho", temaQueVale("escuro", true), "escuro");
igual("atributos: claro e sem números", atributosDaAparencia({ tema: "claro", semNumeros: true }, false), { "data-al-tema": "claro", "data-al-sem-numeros": "" });
igual("atributos: escuro com números (nenhum atributo)", atributosDaAparencia({ tema: "escuro", semNumeros: false }, true), { "data-al-tema": null, "data-al-sem-numeros": null });
ok("a chave começa com o prefixo da rede (o Sair rápido apaga)", CHAVE_DA_APARENCIA.startsWith(PREFIXO_DA_REDE));

function rodarScriptDaAparencia(guardado, aparelhoClaro) {
  const atributos = {};
  const caixa = { setAttribute: (n, v) => (atributos[n] = v) };
  const contexto = {
    document: { querySelector: () => caixa },
    localStorage: { getItem: (k) => (k === CHAVE_DA_APARENCIA ? guardado : null) },
    matchMedia: () => ({ matches: aparelhoClaro }),
    JSON,
  };
  vm.runInNewContext(scriptDaAparencia, contexto);
  return atributos;
}
igual("script da aparência: nada guardado, nada muda", rodarScriptDaAparencia(null, true), {});
igual("script da aparência: claro", rodarScriptDaAparencia(JSON.stringify({ tema: "claro" }), false), { "data-al-tema": "claro" });
igual("script da aparência: sistema num aparelho claro", rodarScriptDaAparencia(JSON.stringify({ tema: "sistema" }), true), { "data-al-tema": "claro" });
igual("script da aparência: sistema num aparelho escuro", rodarScriptDaAparencia(JSON.stringify({ tema: "sistema" }), false), {});
igual("script da aparência: ocultar números", rodarScriptDaAparencia(JSON.stringify({ semNumeros: true }), false), { "data-al-sem-numeros": "" });
igual("script da aparência: lixo guardado não quebra", rodarScriptDaAparencia("{{{", true), {});

// ═══════════════════ 3. O tema claro passa no AA (medido nos tokens) ═══════════════════
const tokens = ler("styles/alumia-tokens.css");
function bloco(seletorInicial) {
  const i = tokens.indexOf(seletorInicial);
  if (i < 0) return {};
  const corpo = tokens.slice(tokens.indexOf("{", i) + 1, tokens.indexOf("}", i));
  return Object.fromEntries([...corpo.matchAll(/--(al-[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}
const luz = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const claro = bloco('[data-al="2"][data-al-tema="claro"],');
ok("o bloco do tema claro foi achado", Object.keys(claro).length > 15);
const pares = [
  ["al-texto", "al-fundo"], ["al-texto-2", "al-fundo"], ["al-texto-3", "al-fundo"], ["al-texto-3", "al-superficie"], ["al-texto-2", "al-superficie-2"],
  ["al-vermelho-texto", "al-fundo"], ["al-vermelho-texto", "al-superficie"], ["al-dourado", "al-fundo"], ["al-dourado", "al-superficie"],
  ["al-sobre-dourado", "al-dourado-fundo"], ["al-sobre-saliente", "al-saliente"],
  ["al-com-1", "al-fundo"], ["al-com-2", "al-fundo"], ["al-com-3", "al-fundo"], ["al-com-4", "al-fundo"], ["al-com-5", "al-fundo"],
];
for (const [frente, fundo] of pares) {
  const a = claro[frente];
  const b = claro[fundo];
  if (!a || !b) {
    falhas.push(`tema claro: falta ${!a ? frente : fundo}`);
    continue;
  }
  const c = contraste(a, b);
  ok(`tema claro: ${frente} sobre ${fundo} dá ${c.toFixed(2)}:1 (precisa de 4,5:1)`, c >= 4.5);
}

// Nenhuma cor literal nos componentes novos: tudo por token, para os dois temas valerem.
const novos = ["components/rede/aparencia/TelaDaAparencia.tsx", "components/rede/aparencia/TelaDasSeries.tsx", "components/rede/aparencia/TelaDosTemas.tsx", "components/rede/alumia/Pastas.tsx", "components/rede/descoberta/BuscasSalvas.tsx", "components/rede/aparencia/acabamento.css"];
for (const f of novos) {
  const texto = ler(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  ok(`${f}: sem cor literal`, !/#[0-9a-f]{3,8}\b|rgba?\(/i.test(texto));
}

// ═══════════════════ 4. As telas novas existem e os textos têm as mesmas chaves nos seis idiomas ═══════════════════
for (const rota of ["aparencia", "series", "temas"]) {
  ok(`rota /alumia/${rota} na lista do endereço próprio`, ROTAS_DA_ALUMIA.includes(rota));
  ok(`página /alumia/${rota}`, existe(`app/[lang]/alumia/${rota}/page.tsx`));
}
const registro = ler("components/rede/registro.tsx");
for (const [nome, arquivo] of [["aparencia", "TelaDaAparencia"], ["series", "TelaDasSeries"], ["temas", "TelaDosTemas"]]) ok(`registro: ${nome}`, registro.includes(`${nome}: { componente: dynamic(() => import("./aparencia/${arquivo}")`));
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}${Array.isArray(v) ? `[${v.length}]` : ""}`])).sort();
const pt = chaves(JSON.parse(ler("i18n/rede/acabamento/pt.json")));
for (const lang of ["en", "es", "fr", "ru", "zh"]) igual(`textos do acabamento em ${lang}: as mesmas chaves do português`, chaves(JSON.parse(ler(`i18n/rede/acabamento/${lang}.json`))), pt);
const proibidas = /diploma|universidade|algoritmo|university|algorithm/i;
for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) ok(`textos do acabamento em ${lang}: sem palavra proibida`, !proibidas.test(ler(`i18n/rede/acabamento/${lang}.json`)));

// ═══════════════════ 5. Pedidos P16 e P17 (as duas saídas rápidas) ═══════════════════
const seguro = ler("lib/modo-seguro.ts");
ok("P16: a saída do site roda as limpezas registradas, dentro do teto de tempo", seguro.includes("export function registrarLimpezaDaSaida") && seguro.includes("Promise.all([bases, apagarCaches(), apagarLojasDoMotor(), rodarLimpezasExtras()])") && seguro.includes(".then(apagarBases)"));
ok("P16: a casca da Alumia registra as limpezas do Sair rápido dela", ler("components/rede/publicar/alumia2/CascaDaAlumia2.tsx").includes("useEffect(() => registrarLimpezaDaSaida(() => rodarLimpezas(ENCAIXES.aoSairRapido)), []);"));
const saida = ler("lib/rede/saida.ts");
ok("P17: o Sair rápido da Alumia encerra a sessão (no servidor, antes de apagar o token, e no aparelho)", /revogarSessao\(local\);\s*apagarChavesDaRede\(armazens\);\s*apagarChavesDaSessao\(armazens\);/.test(saida) && saida.includes('CHAVE_DA_SESSAO = "lucia:sessao"'));

console.log(`Alumia (acabamento da Faixa 1): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
