// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a leveza e o alcance da aula (E4-17, docs/escola/leveza.md): quando o convite do modo pacote aparece, a resposta
// guardada, a soma do que a página gastou, o tamanho do texto, o índice de Libras com intérprete, as chaves no aparelho,
// o modo pacote em lib/prefs.ts, o ponto de montagem na página da aula (sem fs novo), os textos nos 6 idiomas e o CSS.
// Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import {
  CHAVES_DA_LEVEZA,
  DIAS_DEPOIS,
  caminhosDeLevar,
  deveConvidar,
  formatarTamanho,
  gravarRespostaDoConvite,
  lerRespostaDoConvite,
  librasDaAula,
  somarTransferencia,
  tamanhoDoTexto,
  validarLibras,
} from "../lib/escola/leveza.ts";
import { apagarEscola } from "../lib/escola/estudante.ts";
import { entraNaCopia, SO_APAGAR } from "../lib/estudo.ts";
import pt from "../i18n/escola/leveza/pt.json" with { type: "json" };
import en from "../i18n/escola/leveza/en.json" with { type: "json" };
import es from "../i18n/escola/leveza/es.json" with { type: "json" };
import fr from "../i18n/escola/leveza/fr.json" with { type: "json" };
import ru from "../i18n/escola/leveza/ru.json" with { type: "json" };
import zh from "../i18n/escola/leveza/zh.json" with { type: "json" };

const RAIZ = process.cwd();
let certos = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const ler = (...p) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");

// ───────────── 1. deveConvidar ─────────────
const base = { pacoteLigado: false, acesso: null, saveData: false, tipoDeRede: undefined, resposta: null, hoje: "2026-11-03" };
const d = (o) => deveConvidar({ ...base, ...o });
conferir("pacote-acaba convida", d({ acesso: "pacote-acaba" }).convidar && d({ acesso: "pacote-acaba" }).motivo === "pacote-acaba");
conferir("wifi-em-casa não convida", !d({ acesso: "wifi-em-casa" }).convidar);
conferir("computador-ou-nucleo não convida", !d({ acesso: "computador-ou-nucleo" }).convidar);
conferir("saveData convida", d({ saveData: true }).convidar && d({ saveData: true }).motivo === "economia-do-aparelho");
for (const r of ["slow-2g", "2g", "3g"]) conferir(`rede ${r} convida`, d({ tipoDeRede: r }).motivo === "rede-lenta");
conferir("rede 4g não convida", !d({ tipoDeRede: "4g" }).convidar);
conferir("rede desconhecida não convida", !d({ tipoDeRede: undefined }).convidar);
conferir("pacote já ligado não convida", !d({ pacoteLigado: true, acesso: "pacote-acaba", saveData: true }).convidar);
conferir("aceito não convida", !d({ acesso: "pacote-acaba", resposta: { resposta: "aceito", em: "2020-01-01" } }).convidar);
conferir("nunca não convida", !d({ acesso: "pacote-acaba", resposta: { resposta: "nunca", em: "2020-01-01" } }).convidar);
conferir("DIAS_DEPOIS é 14", DIAS_DEPOIS === 14);
conferir("depois com 13 dias não convida", !d({ acesso: "pacote-acaba", resposta: { resposta: "depois", em: "2026-10-21" } }).convidar);
conferir("depois com 14 dias convida", d({ acesso: "pacote-acaba", resposta: { resposta: "depois", em: "2026-10-20" } }).convidar);
conferir("depois com data inválida não convida", !d({ acesso: "pacote-acaba", resposta: { resposta: "depois", em: "ontem" } }).convidar);
conferir("matrícula nula com saveData convida", d({ acesso: null, saveData: true }).convidar);
conferir("sem motivo o motivo é null", d({}).motivo === null);

// ───────────── 2. resposta do convite ─────────────
class Memoria {
  constructor() {
    this.d = {};
  }
  get length() {
    return Object.keys(this.d).length;
  }
  key(i) {
    return Object.keys(this.d)[i] ?? null;
  }
  getItem(k) {
    return k in this.d ? this.d[k] : null;
  }
  setItem(k, v) {
    this.d[k] = String(v);
  }
  removeItem(k) {
    delete this.d[k];
  }
}
let avisos = 0;
globalThis.window = { dispatchEvent: (e) => (e.type === "lucia:estudo" && avisos++, true) };
const mem = new Memoria();
conferir("sem resposta guardada é null", lerRespostaDoConvite(mem) === null);
conferir("gravar devolve true", gravarRespostaDoConvite(mem, "depois", "2026-11-03") === true);
const volta = lerRespostaDoConvite(mem);
conferir("ida e volta", volta?.resposta === "depois" && volta.em === "2026-11-03");
conferir("gravar dispara lucia:estudo uma vez", avisos === 1);
for (const [nome, texto] of [
  ["JSON quebrado", "{oi"],
  ["resposta fora da lista", JSON.stringify({ resposta: "talvez", em: "2026-11-03" })],
  ["data inválida", JSON.stringify({ resposta: "nunca", em: "2026-02-31" })],
  ["sem data", JSON.stringify({ resposta: "nunca" })],
  ["não é objeto", "42"],
]) {
  const m = new Memoria();
  m.setItem(CHAVES_DA_LEVEZA.CONVITE, texto);
  conferir(`resposta com ${nome} vira null`, lerRespostaDoConvite(m) === null);
}
const quebra = {
  getItem() {
    throw new Error("bloqueado");
  },
  setItem() {
    throw new Error("cheio");
  },
};
conferir("getItem que lança não derruba", lerRespostaDoConvite(quebra) === null);
conferir("setItem que lança devolve false", gravarRespostaDoConvite(quebra, "nunca", "2026-11-03") === false);
conferir("sem armazenamento devolve false", gravarRespostaDoConvite(null, "nunca", "2026-11-03") === false);

// ───────────── 3. medidor, tamanhos e caminhos ─────────────
const O = "https://exemplo.org";
const so = somarTransferencia([{ name: `${O}/a`, transferSize: 1000 }, { name: `${O}/b`, transferSize: 500 }], O);
conferir("soma só da mesma origem", so.bytes === 1500 && so.incompleto === false);
const fora = somarTransferencia([{ name: `${O}/a`, transferSize: 1000 }, { name: "https://vlibras.gov.br/x.js", transferSize: 9999 }], O);
conferir("outra origem não entra e marca incompleto", fora.bytes === 1000 && fora.incompleto === true);
const zero = somarTransferencia([{ name: `${O}/a`, transferSize: 0 }, { name: `${O}/b`, transferSize: 200 }], O);
conferir("entrada com 0 marca incompleto", zero.bytes === 200 && zero.incompleto === true);
const sujo = somarTransferencia([{ name: `${O}/a`, transferSize: -5 }, { name: `${O}/b`, transferSize: Number.NaN }, { name: `${O}/c` }, { name: `${O}/d`, transferSize: 100 }], O);
conferir("negativas, NaN e ausentes são ignoradas", sujo.bytes === 100);
const vazia = somarTransferencia([], O);
conferir("lista vazia dá 0 e incompleto", vazia.bytes === 0 && vazia.incompleto === true);
conferir("formatarTamanho 0 e 1 byte são 1 KB", formatarTamanho(0, "pt") === "1 KB" && formatarTamanho(1, "pt") === "1 KB");
conferir("formatarTamanho 1023 KB", formatarTamanho(1023 * 1024, "pt") === "1023 KB");
conferir("formatarTamanho 1,5 MB em pt", formatarTamanho(1.5 * 1024 * 1024, "pt") === "1,5 MB");
conferir("formatarTamanho 1.5 MB em en", formatarTamanho(1.5 * 1024 * 1024, "en") === "1.5 MB");
const enc = (s) => new TextEncoder().encode(s).length;
conferir("tamanhoDoTexto conta UTF-8", tamanhoDoTexto("ação", "", "") - tamanhoDoTexto("acao", "", "") === 2);
conferir("tamanhoDoTexto conta 3 bytes do chinês", tamanhoDoTexto("", "", "中") - tamanhoDoTexto("", "", "a") === 2);
conferir("tamanhoDoTexto é monotônico", tamanhoDoTexto("t", "r", "abc") < tamanhoDoTexto("t", "r", "abcd") && tamanhoDoTexto("t", "r", "") >= enc("t\nr\n"));
const c = caminhosDeLevar("pt", "matematica", "fracoes");
conferir("caminhosDeLevar", c.texto === "/pt/trilhas/matematica/fracoes/texto" && c.epub === "/epub/matematica.epub");

// ───────────── 4. Libras com intérprete ─────────────
const real = JSON.parse(ler("content", "escola", "libras-aulas.json"));
const trilhas = fs.readdirSync(path.join(RAIZ, "content", "trilhas"), { withFileTypes: true }).filter((e) => e.isDirectory());
const existem = new Set();
for (const t of trilhas) {
  for (const f of fs.readdirSync(path.join(RAIZ, "content", "trilhas", t.name))) {
    if (/\.md$/.test(f) && !/\.(en|es|fr|ru|zh)\.md$/.test(f) && !f.startsWith("_")) existem.add(`${t.name}/${f.replace(/\.md$/, "")}`);
  }
}
const umaAula = [...existem][0];
conferir("content/escola/libras-aulas.json é válido", validarLibras(real, existem).length === 0, validarLibras(real, existem).join("; "));
conferir("o índice real começa vazio", real.aulas.length === 0 && librasDaAula("x/y") === null);
const bom = {
  aula: umaAula ?? "a/b",
  url: "https://player.vimeo.com/video/1",
  fonte: "Coordenação",
  interprete: "equipe",
  autorizacao: "termo arquivado em 2026-01-01",
  licenca: "CC BY-SA 4.0",
  em_revisao: true,
};
const val = (o, lista = existem) => validarLibras({ versao: 1, aulas: [{ ...bom, ...o }] }, lista);
conferir("entrada boa passa", val({}, new Set([bom.aula])).length === 0, val({}, new Set([bom.aula])).join("; "));
conferir("aula inexistente falha", val({ aula: "nao/existe" }).length > 0);
conferir("http sem s falha", val({ url: "http://player.vimeo.com/video/1" }, new Set([bom.aula])).length > 0);
conferir("host fora da lista falha", val({ url: "https://exemplo.com/v" }, new Set([bom.aula])).length > 0);
conferir("usuário:senha na url falha", val({ url: "https://u:p@player.vimeo.com/v" }, new Set([bom.aula])).length > 0);
conferir("autorizacao vazia falha", val({ autorizacao: " " }, new Set([bom.aula])).length > 0);
conferir("sem em_revisao falha", val({ em_revisao: false }, new Set([bom.aula])).length > 0);
const proibidas = ["univers" + "idade da vida", "dipl" + "oma"];
for (const p of proibidas) conferir(`palavra proibida "${p}" falha`, val({ fonte: p }, new Set([bom.aula])).length > 0);
conferir(
  "duplicata falha",
  validarLibras({ versao: 1, aulas: [bom, bom] }, new Set([bom.aula])).some((e) => /repetida/.test(e)),
);
conferir("formato errado falha", validarLibras({ versao: 2, aulas: [] }).length > 0 && validarLibras(null).length > 0);

// ───────────── 5. Chaves no aparelho ─────────────
const leveza = ler("lib", "escola", "leveza.ts");
const pastaComp = path.join(RAIZ, "components", "escola", "leveza");
const arquivosDoPacote = [
  ["lib/escola/leveza.ts", leveza],
  ...fs.readdirSync(pastaComp).filter((f) => /\.tsx?$/.test(f)).map((f) => [`components/escola/leveza/${f}`, fs.readFileSync(path.join(pastaComp, f), "utf8")]),
];
for (const [nome, texto] of arquivosDoPacote) {
  for (const m of texto.matchAll(/"(lucia:[^"\s]*)"/g)) {
    const chave = m[1];
    const ok = chave === CHAVES_DA_LEVEZA.CONVITE || chave === CHAVES_DA_LEVEZA.AULA_LEVE || chave.startsWith("lucia:escola:") || chave.startsWith("lucia:escola-privado:") || chave === "lucia:estudo";
    conferir(`chave ${chave} em ${nome} é permitida`, ok);
  }
}
conferir("convite está em SO_APAGAR", SO_APAGAR.includes("lucia:modo-pacote-convite"));
conferir("convite fica fora da cópia", !entraNaCopia(CHAVES_DA_LEVEZA.CONVITE));
conferir("aula-leve entra na cópia", entraNaCopia(CHAVES_DA_LEVEZA.AULA_LEVE));
globalThis.localStorage = new Memoria();
globalThis.dispatchEvent = () => true;
globalThis.localStorage.setItem(CHAVES_DA_LEVEZA.AULA_LEVE, "1");
globalThis.localStorage.setItem("lucia:caderno", "x");
apagarEscola();
conferir("apagarEscola tira a aula leve e só ela", globalThis.localStorage.getItem(CHAVES_DA_LEVEZA.AULA_LEVE) === null && globalThis.localStorage.getItem("lucia:caderno") === "x");
conferir("SO_APAGAR sem chave nova além do convite", SO_APAGAR.length === 4 && SO_APAGAR.every((k) => ["lucia:historico", "lucia:historico-ligado", "lucia:radio-retomar", "lucia:modo-pacote-convite"].includes(k)));

// ───────────── 6. lib/prefs.ts ─────────────
const prefs = ler("lib", "prefs.ts");
conferir("defaultPrefs tem pacote:false", /pacote: false,\n\};/.test(prefs));
const listaFlags = /const flags = \[([\s\S]*?)\] as const;/.exec(prefs)?.[1] ?? "";
const dosFlags = [...listaFlags.matchAll(/\["(\w+)", "(\w+)"\]/g)].map((m) => `${m[1]}:${m[2]}`).sort();
const noScript = /\[\["contrast","contrast"\][\s\S]*?\]\]\.forEach/.exec(prefs)?.[0] ?? "";
const dosScript = [...noScript.matchAll(/\["(\w+)","(\w+)"\]/g)].map((m) => `${m[1]}:${m[2]}`).sort();
conferir("pacote está em flags", dosFlags.includes("pacote:pacote"));
conferir("pacote está no prefsScript", dosScript.includes("pacote:pacote"));
conferir("flags e prefsScript listam o mesmo conjunto", dosFlags.length > 0 && dosFlags.join() === dosScript.join(), `${dosFlags.join()} x ${dosScript.join()}`);
conferir("setPrefs acopla pacote ao modo leve", /if \(patch\.pacote\) next\.light = true;/.test(prefs));
conferir("pedeEconomia e KEYS.a11y intactos", /export function pedeEconomia\(\)/.test(prefs) && /KEYS\.a11y/.test(prefs));

// ───────────── 7. Página da aula ─────────────
const pagina = ler("app", "[lang]", "trilhas", "[track]", "[lesson]", "page.tsx");
conferir("o ponto E4-17 virou LevezaDaAula dentro de 'sa &&'", /\{sa && \(\s*<LevezaDaAula/.test(pagina) && !/\{\/\* E4-17: Libras \*\/\}/.test(pagina));
conferir("a página não ganhou fs novo (só o existsSync do cordel)", (pagina.match(/\bfs\./g) ?? []).length === 1);
conferir("sem generateStaticParams novo", (pagina.match(/generateStaticParams/g) ?? []).length === 1);
conferir("textosDaLeveza só dentro do condicional", (pagina.match(/textosDaLeveza\(/g) ?? []).length === 1 && /\{sa && \(\s*<LevezaDaAula[\s\S]*?textosDaLeveza\(lang\)[\s\S]*?\)\}/.test(pagina));
conferir("classes no-leve e no-pacote na página", (pagina.match(/no-leve/g) ?? []).length >= 3 && /no-leve no-pacote/.test(pagina));
conferir("a página importa o CSS da leveza", pagina.includes('"@/styles/escola-leveza.css"'));
conferir("lib/escola/leveza.ts sem fs e sem @/", !/node:fs|from "fs"/.test(leveza) && !/from "@\//.test(leveza));
for (const [nome, texto] of arquivosDoPacote) {
  conferir(`${nome} sem fs`, !/node:fs|from "fs"/.test(texto));
  conferir(`${nome} sem NEXT_PUBLIC_RECURSOS`, !/NEXT_PUBLIC_RECURSOS/.test(texto));
  conferir(`${nome} sem palavra proibida`, !new RegExp("univers" + "idade|dipl" + "oma", "i").test(texto.replace(/new RegExp\([^)]*\)|"univers"|"diplo"/g, "")) || nome === "lib/escola/leveza.ts");
}
conferir("componentes importam textos só como tipo", arquivosDoPacote.filter(([n]) => n.endsWith(".tsx")).every(([, t]) => !/import (?!type)[^;]*from "@\/i18n\/escola\/leveza"/.test(t) && !/lib\/escola\/textos"/.test(t)));

// ───────────── 8. Arquivos que NÃO podem mudar ─────────────
const nextConfig = ler("next.config.ts");
conferir("next.config.ts mantém outputFileTracingIncludes", /outputFileTracingIncludes: \{/.test(nextConfig) && !/leveza|libras-aulas/.test(nextConfig));
const recursos = ler("lib", "recursos.ts");
conferir("SO_PELO_NOME ainda é só escola", /SO_PELO_NOME[^=]*=\s*\[\s*"escola"\s*\]/.test(recursos) || /SO_PELO_NOME[\s\S]{0,80}"escola"/.test(recursos));
const sw = ler("public", "sw.js");
const offline = ler("components", "Offline.tsx");
conferir("cache das páginas continua v4 no sw.js e no Offline", /VERSAO\s*=\s*"v4"/.test(sw) && /PAGINAS = "lucia-paginas-v4"/.test(offline));
conferir("vlibras.ts mantém as exportações", ["carregarVLibras", "vlibrasCarregado", "vlibrasLembrado", "lembrarVLibras"].every((n) => ler("lib", "vlibras.ts").includes(`export function ${n}`) || ler("lib", "vlibras.ts").includes(`export const ${n}`)));

// ───────────── 9. Textos nos 6 idiomas ─────────────
const textos = { pt, en, es, fr, ru, zh };
const achatar = (o, prefixo = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[`${prefixo}${k}`, v]] : achatar(v, `${prefixo}${k}.`)));
const chavesPt = achatar(pt).map(([k]) => k).sort();
const proibida = new RegExp("univers" + "idade|univers" + "ité|univers" + "ity|dipl" + "oma|dipl" + "ôme|университет|диплом|大学|文凭", "i");
const marcadores = { pt: /não substitui/i, en: /not replace/i, es: /no sustituye/i, fr: /ne remplace pas/i, ru: /не заменяет/i, zh: /不能替代/ };
for (const [l, dic] of Object.entries(textos)) {
  const plano = new Map(achatar(dic));
  conferir(`${l}: mesmas chaves do pt`, [...plano.keys()].sort().join() === chavesPt.join());
  conferir(`${l}: nenhum texto vazio`, [...plano.values()].every((v) => v.trim().length > 0));
  conferir(`${l}: sem palavra proibida`, ![...plano.values()].some((v) => proibida.test(v)));
  for (const [k, v] of achatar(pt)) {
    for (const m of v.matchAll(/\{(\w+)\}/g)) conferir(`${l}: ${k} mantém {${m[1]}}`, (plano.get(k) ?? "").includes(`{${m[1]}}`));
  }
  conferir(`${l}: libras.aviso diz que não substitui intérprete`, marcadores[l].test(dic.libras.aviso));
  if (l !== "pt") {
    for (const k of ["libras.aviso", "libras.soPortugues", "convite.ligar"]) conferir(`${l}: ${k} não é cópia do pt`, plano.get(k) !== new Map(achatar(pt)).get(k));
  }
  conferir(`${l}: telaApagada tem título e texto`, dic.telaApagada.titulo.length > 0 && dic.telaApagada.texto.length > 20);
}
const vozAula = JSON.parse(ler("i18n", "escola", "aula", "pt.json")).voz?.telaApagada;
conferir("o aviso de tela apagada da aula continua lá", typeof vozAula === "string" && vozAula.length > 10);

// ───────────── 10. CSS e estrutura ─────────────
const css = ler("styles", "escola-leveza.css");
conferir("CSS esconde com data-aula-leve", /:root\[data-aula-leve\] :is\(\.coluna-da-margem, \.no-leve\)\s*\{\s*display: none;/.test(css));
conferir("CSS esconde com data-pacote", /:root\[data-pacote\] \.no-pacote\s*\{\s*display: none;/.test(css));
conferir("CSS: alvo de 48 px (3rem) nos botões e interruptores", /\.lev-botao \{[^}]*min-height: 3rem/.test(css) && /\.lev-interruptor \{[^}]*min-height: 3rem/.test(css));
conferir("CSS: leitor de tinta e alto contraste sem sombra", /data-eink[\s\S]*data-contrast[\s\S]*box-shadow: none/.test(css) && /data-leitor/.test(css));
conferir("CSS: sem animação com parado e leve", /data-parado\] \.lev \*/.test(css) && /data-light\] \.lev \*/.test(css));
conferir("CSS: sem rolagem lateral (overflow-wrap)", /overflow-wrap: anywhere/.test(css) && !/min-width: (3[6-9]\d|[4-9]\d\d)px/.test(css));

console.log(`leveza: ${certos} conferências certas, ${falhas.length} falha(s).`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
