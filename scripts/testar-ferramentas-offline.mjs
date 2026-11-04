// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere "Baixar a ferramenta num arquivo só" (Etapa 3, B17) e o manifesto por idioma:
// 1. cada ferramenta exportável gera um .html < 1 MB nos 6 idiomas, sem nenhuma requisição externa (nada de src, link,
//    @import, url(), fetch, XHR, WebSocket, import()) e com o único endereço http dentro do <a> do rodapé;
// 2. o código dentro do arquivo compila (new Function) e as contas do núcleo dão o valor certo;
// 3. ferramenta sem versão offline não gera arquivo (e a página não mostra o botão);
// 4. o manifesto de cada idioma tem start_url no idioma, e o de /pt é igual ao padrão.
// Uso: npm run testar:ferramentas-offline
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { nucleoDe, FERRAMENTAS_OFFLINE, IDIOMAS, LIMITE_DO_ARQUIVO, montarFerramentaUnica, nomeDaFerramenta, tamanhoDoArquivo, temVersaoOffline } from "../lib/ferramentas-offline.ts";
import { htmlLang, locales } from "../i18n/config.ts";
import { montarManifesto } from "../lib/manifesto.ts";

const raiz = path.resolve(import.meta.dirname, "..");
let certos = 0;
const falhas = [];
const ok = (nome, cond, extra = "") => (cond ? certos++ : falhas.push(`${nome} ${extra}`));
const perto = (nome, v, e, tol = 1e-9) => ok(nome, typeof v === "number" && Math.abs(v - e) <= tol * Math.max(1, Math.abs(e)), `veio ${v}, esperava ${e}`);
const dic = (l) => JSON.parse(fs.readFileSync(path.join(raiz, "i18n", `${l}.json`), "utf8"));
const URL_FONTE = "https://example.org/pt/ferramentas/x";

// 1 e 3: tamanho e rede
ok("lista não vazia", FERRAMENTAS_OFFLINE.length >= 6);
for (const id of FERRAMENTAS_OFFLINE) {
  for (const lang of IDIOMAS) {
    const d = dic(lang);
    const html = montarFerramentaUnica({ id, titulo: (d.toolNames[id] ?? [id])[0], descricao: (d.toolNames[id] ?? ["", ""])[1], url: URL_FONTE, lang, fonte: d.compartilhar.baixarHtmlFonte, rodape: d.compartilhar.baixarFerramentaRodape });
    const nome = `${id}/${lang}`;
    ok(`${nome}: gerou`, typeof html === "string");
    if (typeof html !== "string") continue;
    ok(`${nome}: tamanho`, tamanhoDoArquivo(html) < LIMITE_DO_ARQUIVO && tamanhoDoArquivo(html) < 60_000, `${tamanhoDoArquivo(html)} bytes`);
    // Tira o único endereço permitido: o link de navegação do rodapé.
    const semRodape = html.replace(/<footer>[\s\S]*<\/footer>/, "");
    ok(`${nome}: sem endereço de rede`, !/https?:/i.test(semRodape), "achou endereço fora do rodapé");
    ok(`${nome}: sem recurso externo`, !/\ssrc\s*=|<link\b|@import|url\(|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|\bimport\s*\(|<iframe|<img|<audio|<video|navigator\.serviceWorker/i.test(html));
    ok(`${nome}: sem rastreio nem armazenamento`, !/localStorage|sessionStorage|indexedDB|document\.cookie|gtag|analytics/i.test(html));
    ok(`${nome}: um só link, o do rodapé`, (html.match(/<a\s/g) ?? []).length === 1 && /<footer>[\s\S]*<a href="https:\/\/example\.org/.test(html));
    ok(`${nome}: idioma`, html.includes(`<html lang="${lang}">`));
    // O código compila (ES5: sem seta nem template).
    const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1] ?? "";
    try {
      new Function(script);
      certos++;
    } catch (e) {
      falhas.push(`${nome}: script não compila: ${e.message}`);
    }
    const semTextos = script.replace(/^var L=\{[^\n]*?\},LANG=/, "");
    ok(`${nome}: ES5`, !/=>|`/.test(semTextos), "seta ou template no código");
    ok(`${nome}: frases`, [...html.matchAll(/data-t="(\w+)"/g)].every((m) => script.includes(`"${m[1]}":`)), "data-t sem frase");
  }
}
ok("sem versão offline: python", montarFerramentaUnica({ id: "python", titulo: "x", url: URL_FONTE, lang: "pt", fonte: "", rodape: "" }) === null && !temVersaoOffline("python"));
for (const id of ["ide", "html", "simulacoes", "pronuncia", "dicionario", "graficos", "direitos-trabalhistas", "quanto-cobrar"]) ok(`sem botão: ${id}`, !temVersaoOffline(id));
ok("id hostil", !temVersaoOffline("__proto__") && !temVersaoOffline("constructor") && !temVersaoOffline("toString"));
ok("nome do arquivo", nomeDaFerramenta("juros-compostos") === "ferramenta-juros-compostos.html" && nomeDaFerramenta("../x") === "ferramenta-x.html");
// Texto hostil no título não abre tag nem fecha o script.
const hostil = montarFerramentaUnica({ id: "calculadora", titulo: '<script>alert(1)</script>"', url: 'https://x"><script>', lang: "pt", fonte: "<b>", rodape: "</footer>" });
ok("escapa título e links", !/<script>alert/.test(hostil) && (hostil.match(/<script>/g) ?? []).length === 1);

// 2: as contas (rodam só o núcleo, num contexto vazio)
const rodar = (id, expr) => vm.runInNewContext(`${nucleoDe(id)}\n${expr}`, {});
perto("calc 1", rodar("calculadora", 'calcular("(12 + 8) × 3 ÷ 4")'), 15);
perto("calc 2", rodar("calculadora", 'calcular("2,5 + 0,5")'), 3);
perto("calc 3", rodar("calculadora", 'calcular("10 − 4")'), 6);
ok("calc rejeita código", ["alert(1)", "1;2", "2**3", "1/0", "", "a+1", "constructor"].every((x) => Number.isNaN(rodar("calculadora", `calcular(${JSON.stringify(x)})`))));
const j = rodar("juros-compostos", "juros(1000,0,1,false,12)");
perto("juros 12 meses a 1%", j.total, 1000 * 1.01 ** 12, 1e-12);
perto("juros investido", j.investido, 1000);
perto("juros depósito", rodar("juros-compostos", "juros(0,100,1,false,2)").total, 100 * 1.01 + 100, 1e-12);
perto("juros simples", j.simples, 1120, 1e-12);
perto("juros a.a. vira mensal", rodar("juros-compostos", "juros(1000,0,10,true,12)").total, 1100, 1e-9);
ok("juros inválidos", rodar("juros-compostos", "juros(-1,0,1,false,12)") === null && rodar("juros-compostos", "juros(1,0,1,false,0)") === null && rodar("juros-compostos", "juros(NaN,0,1,false,1)") === null);
ok("juros estouram", rodar("juros-compostos", "juros(1e308,1e308,1000,false,1200)") === null);
ok("bases",rodar("bases-numericas", 'converterBase("255",10,16)') === "FF" && rodar("bases-numericas", 'converterBase("ff",16,2)') === "11111111" && rodar("bases-numericas", 'converterBase("777",8,10)') === "511");
ok("bases inválidas", rodar("bases-numericas", 'converterBase("12",2,10)') === null && rodar("bases-numericas", 'converterBase("",10,2)') === null && rodar("bases-numericas", 'converterBase("1".repeat(70),10,2)') === null && rodar("bases-numericas", 'converterBase("99999999999999999999",10,2)') === "grande");
const un = (v, g, a, b) => rodar("conversor-de-unidades", `converterUnidade(${v},"${g}","${a}","${b}")`);
perto("1 km = 1000 m", un(1, "cLength", "km", "m"), 1000);
perto("1 in = 2,54 cm", un(1, "cLength", "in", "cm"), 2.54, 1e-12);
perto("1 mi = 1,609344 km", un(1, "cLength", "mi", "km"), 1.609344, 1e-12);
perto("1 lb = 453,59237 g", un(1, "cMass", "lb", "g"), 453.59237, 1e-12);
perto("1 gal US = 3,785411784 L", un(1, "cVolume", "gal(US)", "L"), 3.785411784, 1e-12);
perto("1 h = 3600 s", un(1, "cTime", "h", "s"), 3600);
perto("100 °C = 212 °F", un(100, "cTemp", "°C", "°F"), 212, 1e-12);
perto("0 °C = 273,15 K", un(0, "cTemp", "°C", "K"), 273.15, 1e-12);
perto("-40 °F = -40 °C", un(-40, "cTemp", "°F", "°C"), -40, 1e-12);
ok("unidade inválida", Number.isNaN(un(-300, "cTemp", "°C", "K")) && Number.isNaN(un(1, "cTemp", "m", "K")) && Number.isNaN(un(1, "cLength", "kg", "m")));
perto("escala: 5 cm em 1:100000 = 5 km", rodar("escala-cartografica", 'escalaMapaParaReal(5,"cm",100000,"km")'), 5, 1e-12);
perto("escala: 5 km em 1:100000 = 5 cm", rodar("escala-cartografica", 'escalaRealParaMapa(5,"km",100000,"cm")'), 5, 1e-12);
perto("escala: achar 1:100000", rodar("escala-cartografica", 'escalaAchar(5,"cm",5,"km")'), 100000, 1e-12);
ok("cronômetro", rodar("cronometro", "formatarTempo(0)") === "0:00.0" && rodar("cronometro", "formatarTempo(65400)") === "1:05.4" && rodar("cronometro", "formatarTempo(3725000)") === "1:02:05.0" && rodar("cronometro", "formatarTempo(-5)") === "0:00.0");

// A página mostra o botão só quando há versão offline, e o layout liga o manifesto do idioma.
const pagina = fs.readFileSync(path.join(raiz, "app", "[lang]", "ferramentas", "[tool]", "page.tsx"), "utf8");
ok("página: botão condicionado", /temVersaoOffline\(tool\) && <BaixarFerramentaUnica/.test(pagina));
const layout = fs.readFileSync(path.join(raiz, "app", "[lang]", "layout.tsx"), "utf8");
ok("layout: link do manifesto do idioma", layout.includes("manifest: `/${lang}/manifest.webmanifest`"));
ok("layout: sem fs", !/from "node:fs"|from "fs"|readFileSync|readdirSync/.test(layout));
const rota = fs.readFileSync(path.join(raiz, "app", "[lang]", "manifest.webmanifest", "route.ts"), "utf8");
ok("rota do manifesto: sem fs, estática", !/node:fs|readFileSync|readdirSync/.test(rota) && /dynamicParams = false/.test(rota) && /generateStaticParams/.test(rota));
ok("manifesto: sem fs", !/node:fs|readFileSync|readdirSync/.test(fs.readFileSync(path.join(raiz, "lib", "manifesto.ts"), "utf8")));
ok("app/manifest.ts continua", fs.existsSync(path.join(raiz, "app", "manifest.ts")));

// 4: o manifesto por idioma
const padrao = montarManifesto("pt", dic("pt"));
for (const lang of locales) {
  const m = montarManifesto(lang, dic(lang));
  ok(`manifesto ${lang}: start_url`, m.start_url === `/${lang}` && m.id === `/${lang}`);
  ok(`manifesto ${lang}: idioma`, m.lang === htmlLang[lang]);
  ok(`manifesto ${lang}: atalhos no idioma`, m.shortcuts.length === 4 && m.shortcuts.every((a) => a.url.startsWith(`/${lang}/`) && a.name));
  ok(`manifesto ${lang}: escopo, ícones e nome`, m.scope === "/" && m.icons.length === 3 && !!m.name && m.display === "standalone");
}
ok("manifesto pt = padrão de sempre", padrao.start_url === "/pt" && padrao.id === "/pt" && padrao.lang === "pt-BR" && padrao.shortcuts[0].url === "/pt/trilhas");

// i18n: as chaves novas existem nos 6 idiomas
for (const lang of IDIOMAS) for (const k of ["baixarFerramenta", "baixarFerramentaDica", "baixarFerramentaRodape"]) ok(`i18n ${lang}.${k}`, typeof dic(lang).compartilhar[k] === "string" && dic(lang).compartilhar[k].length > 10);

console.log(`${certos} conferências certas, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas.slice(0, 40)) console.error("FALHOU:", f);
  process.exit(1);
}
