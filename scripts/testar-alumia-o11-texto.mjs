// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 11A da onda 11 (supabase/migracoes/20261117-alumia-o11-texto.sql e lib/rede/texto, components/rede/estudo/questoes):
//   · o texto formatado: o que vira bloco e trecho, o que fica texto, a limpeza (imagem só do próprio post, link só http(s) ou do site,
//     sem caractere que inverte a direção do texto) IGUAL no aparelho e no banco, com as mesmas entradas;
//   · XSS: o texto desenhado (lib/rede/texto/desenhar.ts, renderizado de verdade com o react-dom/server) e a fórmula (KaTeX com as
//     opções da Alumia) não deixam passar elemento, atributo de evento, "javascript:" nem link de fora vindo do texto;
//   · os botões da barra de formatação e as contas do banco de questões (conferência, acertos no aparelho);
//   · o banco num Postgres de verdade (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql: o gatilho que
//     limpa o post, o banco de questões (a lista nunca leva a certa nem a explicação; responder não grava nada; sem quem escreveu nem
//     quem denunciou; só a mediação retira), a porta e as permissões;
//   · os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-texto.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import katex from "katex";
import { criarBanco } from "./banco-local.mjs";
import { lerTextoFormatado, lerTrechos, temFormatacao, textoSemMarcas, imagensNoMeio } from "../lib/rede/texto/formatado.ts";
import { limparFonte, urlSegura } from "../lib/rede/texto/limpar.ts";
import { OPCOES_DO_KATEX, formulaCabe } from "../lib/rede/texto/formula.ts";
import { desenhar } from "../lib/rede/texto/desenhar.ts";
import { aplicarMarca } from "../lib/rede/texto/inserir.ts";
import {
  apagarAcertos, CHAVE_DOS_ACERTOS, guardarResposta, esquecerResposta, lerAcertos, letra, MATERIAS, problemasDaQuestao, resumoDosAcertos,
} from "../components/rede/estudo/questoes/regras.ts";

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

// ═══════════════════ 0. Os arquivos ═══════════════════
const sql = ler("supabase/migracoes/20261117-alumia-o11-texto.sql");
ok("toda função nova é security definer com search_path fixo (menos a limpeza, pura, e o gatilho)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const outras = funcoes.filter((f) => !/interno\.rede_texto_limpo(_no_post)?\(/.test(f));
  return funcoes.length >= 17 && outras.every((f) => /security definer set search_path = interno, pg_temp/.test(f)) && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão direta", tabelas.length === 2
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql) && !/create policy/i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("nenhuma tabela de respostas, acertos ou placar", !/create table[^;]*(respost|acert|placar|ranking|tentativ)/i.test(sql));
ok("a denúncia não tem coluna de pessoa", (() => {
  const corpo = sql.match(/create table if not exists interno\.rede_questoes_denuncias \([\s\S]*?\n\);/)?.[0] ?? "usuario uuid";
  return !/\b(usuario|quem|autor|pessoa|conta|denunciou)\s+uuid/.test(corpo);
})());
ok("não mexe na versão da Alumia nem no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-500)));
ok("nenhum caractere de direção escondido no código da frente", ["lib/rede/texto/limpar.ts", "lib/rede/texto/formatado.ts", "supabase/migracoes/20261117-alumia-o11-texto.sql"].every((c) => !/[\u202A-\u202E\u2066-\u2069]/.test(ler(c))));
ok("nada de innerHTML nas telas da frente (o KaTeX escreve com katex.render)", ["components/rede/texto/TextoFormatado.tsx", "components/rede/texto/Formula.tsx", "components/rede/texto/BlocoDeCodigo.tsx", "components/rede/texto/EditorDeTexto.tsx", "components/rede/texto/TextoDoPost.tsx", "components/rede/conversa/TextoComMencoes.tsx", "components/rede/estudo/questoes/CartaoDaQuestao.tsx", "components/rede/estudo/questoes/TelaDasQuestoes.tsx", "components/rede/estudo/questoes/EscreverQuestao.tsx"].every((c) => !/dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|document\.write/.test(ler(c).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))));
ok("a fórmula usa as opções travadas (sem trust, com teto)", /katex\.render\(expressao, alvo\.current, \{ \.\.\.OPCOES_DO_KATEX/.test(ler("components/rede/texto/Formula.tsx")) && OPCOES_DO_KATEX.trust === false && OPCOES_DO_KATEX.maxExpand <= 1000 && OPCOES_DO_KATEX.maxSize <= 10);
ok("nada carregado de fora nas telas da frente (sem http em src/href fixos)", ["components/rede/texto/TextoFormatado.tsx", "components/rede/texto/Formula.tsx", "components/rede/estudo/questoes/TelaDasQuestoes.tsx", "components/rede/estudo/questoes/CartaoDaQuestao.tsx"].every((c) => !/(src|href)=["'`]https?:/.test(ler(c))));

// ═══════════════════ 1. O texto formatado ═══════════════════
const R = String.raw;
{
  const b = lerTextoFormatado(R`## Função do 2º grau
### Vértice

A fórmula de **Bhaskara** é $$x = \frac{-b \pm \sqrt{\Delta}}{2a}$$ e custa R$ 10, não R$ 12.
Um _itálico_, um *outro*, nome_de_arquivo, 2*3*4, ~~riscado~~ e \*literal\*.

$$
\Delta = b^2 - 4ac
$$

$$ e^{i\pi} + 1 = 0 $$

![gráfico da parábola](imagem:2)

${"```"}python
for i in range(3):
    print("<b>", i)
${"```"}

> primeira
> segunda

- um
- dois
3. três
4. quatro

---
`);
  const tipos = b.map((x) => x.t).join(",");
  ok("os blocos lidos na ordem", tipos === "titulo,titulo,paragrafo,formula,formula,imagem,codigo,citacao,lista,lista,separador");
  ok("## e ### viram os dois níveis de título", b[0].nivel === 2 && b[1].nivel === 3);
  const p = b[2].trechos;
  ok("negrito, fórmula, itálico com _ e *, riscado; R$ e nome_de_arquivo e 2*3*4 ficam texto; \\* fica literal", (() => {
    const t = p.map((x) => x.t);
    const texto = JSON.stringify(p);
    return t.includes("negrito") && t.filter((x) => x === "italico").length === 2 && t.includes("riscado") && t.includes("quebra")
      && p.find((x) => x.t === "formula")?.v === R`x = \frac{-b \pm \sqrt{\Delta}}{2a}` && texto.includes("R$ 10, não R$ 12") && texto.includes("nome_de_arquivo, 2*3*4") && texto.includes("e *literal*.");
  })());
  ok("fórmula em bloco (com $$ em linhas sozinhas e numa linha só)", b[3].v === R`\Delta = b^2 - 4ac` && b[4].v === R`e^{i\pi} + 1 = 0`);
  ok("imagem do próprio post vira bloco com o número e a descrição", b[5].n === 2 && b[5].alt === "gráfico da parábola");
  ok("bloco de código guarda o texto cru e a linguagem", b[6].lingua === "python" && b[6].v.includes('print("<b>", i)') && b[6].v.includes("    print"));
  ok("citação com as linhas juntas", b[7].paragrafos.length === 1 && b[7].paragrafos[0].some((x) => x.t === "quebra"));
  ok("lista sem e com número (começando no 3)", b[8].ordenada === false && b[8].itens.length === 2 && b[9].ordenada === true && b[9].inicio === 3);
  ok("um cifrão sozinho nunca abre fórmula", !JSON.stringify(lerTrechos("Paguei R$ 5 e $ 3 hoje")).includes("formula"));
  ok("fórmula grande demais fica texto", !JSON.stringify(lerTrechos(`$$${"x+".repeat(600)}x$$`)).includes('"formula"') && !formulaCabe("x".repeat(1001)));
  ok("link seguro vira link; o resto fica só o texto", (() => {
    const t = lerTrechos("[a](https://exemplo.org/x) [b](javascript:alert(1)) [c](/pt/alumia/p/1) [d](//evil.example) [e](https://u@evil.example)");
    const links = t.filter((x) => x.t === "link").map((x) => x.url);
    return JSON.stringify(links) === JSON.stringify(["https://exemplo.org/x", "/pt/alumia/p/1"]) && !JSON.stringify(t).includes("javascript");
  })());
  ok("alcance mínimo (post curto): só código e fórmula, asterisco antigo fica igual", (() => {
    const t = lerTrechos("**oi** `x` $$y$$ _z_ \\*", "minimo");
    return JSON.stringify(t.map((x) => x.t)) === JSON.stringify(["texto", "codigo", "texto", "formula", "texto"]) && t[0].v === "**oi** " && t[4].v === " _z_ \\*";
  })());
  ok("texto sem marcas (resumo e leitor de tela)", textoSemMarcas("## Título\n\n**forte** e $$x^2$$\n\n![foto](imagem:1)") === "Título\n\nforte e x^2\n\nfoto");
  ok("temFormatacao: texto comum não troca o cartão", !temFormatacao("Ato amanhã às 18h, na praça. Bora! #passelivre @maria") && temFormatacao("## Pauta") && temFormatacao("use `npm`") && temFormatacao("$$x$$") && temFormatacao("- item"));
  ok("as imagens que o texto põe no meio", JSON.stringify(imagensNoMeio("![a](imagem:3)\n\ntexto\n\n![b](imagem:1)\n![c](imagem:3)")) === "[3,1]");
  ok("título no meio da frase não vira título (# é hashtag)", lerTextoFormatado("#passelivre amanhã")[0].t === "paragrafo");
  ok("nunca lança com lixo", (() => { try { lerTextoFormatado("```\n" + "[](".repeat(3000) + "**_~~`$$"); lerTextoFormatado("\u0000\u0001>>>> - 1. ## $$"); return true; } catch { return false; } })());
  ok("texto enorme é cortado no teto", lerTextoFormatado("a".repeat(50000))[0].trechos[0].v.length === 20000);
}

// A limpeza.
{
  const sujo = "[a](javascript:alert(1)) [b](//evil.example/x) [c](/alumia/p/1) [d](https://ok.example/x?y=1#z) ![e](imagem:1) ![f](https://evil.example/t.png) "
    + "[g](HTTPS://Exemplo.org) [h](https://usuario@evil.example) [i](/\\evil.example) [j](data:text/html;base64,PHNjcmlwdD4=) [k](vbscript:x) "
    + "\u202Eabc\u2066\r\nfim\u0007 [l](#) ![m](imagem:21) [n]( https://ok.example )";
  const limpo = limparFonte(sujo);
  ok("limpeza: só sobra link http(s) e do site; imagem de fora vira a descrição; sem caractere de direção nem de controle", limpo === "[a](#) [b](#) [c](/alumia/p/1) [d](https://ok.example/x?y=1#z) ![e](imagem:1) f "
    + "[g](HTTPS://Exemplo.org) [h](#) [i](#) [j](#) [k](#) abc\nfim [l](#) m [n](#)");
  ok("limpar duas vezes dá o mesmo (o banco pode limpar de novo)", limparFonte(limpo) === limpo);
  ok("endereço com parênteses (enciclopédia) continua link, e o ataque com parênteses some inteiro",
    limparFonte("[w](https://pt.wikipedia.org/wiki/Canudos_(guerra)) [x](javascript:alert(1))") === "[w](https://pt.wikipedia.org/wiki/Canudos_(guerra)) [x](#)"
    && lerTrechos("[w](https://pt.wikipedia.org/wiki/Canudos_(guerra))")[0].url === "https://pt.wikipedia.org/wiki/Canudos_(guerra)");
  ok("urlSegura", urlSegura("https://a.example/b") === "https://a.example/b" && urlSegura("/pt/alumia") === "/pt/alumia" && [
    "javascript:alert(1)", "JaVaScRiPt:x", "//evil", "/\\evil", "https://u@evil", "data:x", "http://", "mailto:a@b.c", " ", "x".repeat(600)].every((u) => urlSegura(u) === null));
}

// ═══════════════════ 2. XSS: o texto desenhado de verdade ═══════════════════
const PECAS_DE_PROVA = {
  // A fórmula de verdade (KaTeX com as opções da Alumia), como katex.render escreve no elemento.
  Formula: ({ expressao, bloco }) => h("span", { className: "f", dangerouslySetInnerHTML: { __html: katex.renderToString(expressao, { ...OPCOES_DO_KATEX, displayMode: bloco }) } }),
  Codigo: ({ codigo, lingua }) => h("pre", { "data-lingua": lingua }, h("code", null, codigo)),
  Texto: ({ texto }) => h("span", null, texto),
  Imagem: ({ n, alt }) => h("img", { src: `/deposito/${n}.webp`, alt }),
  Link: ({ href, children }) => h("a", { href }, children),
};
const html = (fonte) => renderToStaticMarkup(desenhar(lerTextoFormatado(fonte), PECAS_DE_PROVA));
const ATAQUES = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "<iframe src=\"javascript:alert(1)\"></iframe>",
  "[clique](javascript:alert(document.cookie))",
  "[clique](JAVASCRIPT:alert(1))",
  "[clique](data:text/html,<script>alert(1)</script>)",
  "[x](https://ok.example\" onmouseover=\"alert(1))",
  "![x](javascript:alert(1))",
  "![x\" onerror=\"alert(1)](imagem:1)",
  "![rastreio](https://evil.example/pixel.gif)",
  "**<b onmouseover=alert(1)>negrito</b>**",
  "`<script>alert(1)</script>`",
  "```html\n<script>alert(1)</script>\n```",
  "> <a href=\"javascript:alert(1)\">x</a>",
  "## <img src=x onerror=alert(1)>",
  "- [a](vbscript:msgbox(1))",
  R`$$\href{javascript:alert(1)}{clique}$$`,
  R`$$\url{javascript:alert(1)}$$`,
  R`$$\includegraphics{https://evil.example/x.png}$$`,
  R`$$\htmlClass{x" onclick="alert(1)}{y}$$`,
  R`$$\htmlId{evil}{y}$$`,
  R`$$\htmlStyle{background:url(https://evil.example/x)}{y}$$`,
  R`$$\htmlData{onclick=alert(1)}{y}$$`,
  R`$$\text{<script>alert(1)</script>}$$`,
  "$$\n\\def\\a{\\a\\a}\\a\n$$",
  R`$$\rule{1000em}{1000em}$$`,
];
for (const ataque of ATAQUES) {
  let saida = "";
  try {
    saida = html(ataque);
  } catch (e) {
    falhas.push(`XSS: o desenho lançou com ${JSON.stringify(ataque)}: ${e.message}`);
    continue;
  }
  const semCodigo = saida.replace(/<code>[\s\S]*?<\/code>/g, "");
  const problemas = [
    /<script/i.test(saida) && "<script",
    // Os valores entre aspas saem antes de procurar (aspas de dentro do texto chegam escapadas, &quot;, e não fecham o atributo).
    (saida.match(/<[^>]*>/g) ?? []).some((tag) => /\son[a-z]+=/i.test(tag.replace(/"[^"]*"/g, '""'))) && "atributo de evento",
    /<(?!\/?(p|span|strong|em|s|code|pre|a|br|h[2-6]|ul|ol|li|blockquote|hr|div|img|link|math|semantics|mrow|mi|mo|mn|ms|mtext|mstyle|msup|msub|msubsup|mfrac|msqrt|mroot|mover|munder|munderover|mspace|mpadded|mphantom|menclose|mtable|mtr|mtd|annotation|svg|path|line|rect)\b)[a-z]/i.test(semCodigo) && "elemento desconhecido",
    /(href|src)="\s*(javascript|vbscript|data):/i.test(saida) && "endereço perigoso",
    /<img[^>]+src="(?!\/deposito\/)/i.test(saida) && "imagem de fora",
    /<(iframe|svg|object|embed)\b/i.test(saida.replace(/<svg[^>]*class="[^"]*"[^>]*>|<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>/g, "")) && "elemento ativo",
    /href="https?:\/\/evil/i.test(saida) && "link de fora vindo da fórmula",
    /style="[^"]*url\(/i.test(saida) && "estilo com endereço",
    /\sid="evil"/.test(saida) && "id escolhido pelo texto",
  ].filter(Boolean);
  ok(`XSS barrado: ${ataque.slice(0, 60).replace(/\n/g, "⏎")}${problemas.length ? ` (${problemas.join(", ")} em ${saida.slice(0, 300)})` : ""}`, problemas.length === 0);
}
ok("o texto do ataque aparece escapado, como texto", html("<img src=x onerror=alert(1)>").includes("&lt;img src=x onerror=alert(1)&gt;"));
ok("a fórmula de verdade sai desenhada (KaTeX com MathML)", /class="katex"/.test(html("$$x^2$$")) && /<math/.test(html("$$x^2$$")));
ok("\\href sem trust vira erro em texto, sem link", (() => { const s = html(R`$$\href{https://exemplo.org}{x}$$`); return !/<a\s/i.test(s) && !/href=/i.test(s); })());

// ═══════════════════ 3. A barra de formatação ═══════════════════
{
  const r1 = aplicarMarca("oi mundo", 3, 8, "negrito", "x");
  ok("negrito em volta da seleção", r1.valor === "oi **mundo**" && r1.inicio === 5 && r1.fim === 10);
  const r2 = aplicarMarca("oi ", 3, 3, "formula", "x^2");
  ok("fórmula sem seleção entra com o exemplo selecionado", r2.valor === "oi $$x^2$$" && r2.valor.slice(r2.inicio, r2.fim) === "x^2");
  const r3 = aplicarMarca("a\nb\nc", 2, 5, "lista", "item");
  ok("lista nas linhas selecionadas", r3.valor === "a\n- b\n- c");
  const r4 = aplicarMarca("texto", 5, 5, "blocoDeCodigo", "código");
  ok("bloco de código numa linha só dele", r4.valor === "texto\n\n```\ncódigo\n```" && lerTextoFormatado(r4.valor).map((x) => x.t).join() === "paragrafo,codigo");
  const r5 = aplicarMarca("veja", 4, 4, "imagem2", "foto do ato");
  ok("imagem 2 no meio do texto", r5.valor === "veja\n\n![foto do ato](imagem:2)" && lerTextoFormatado(r5.valor)[1].n === 2);
  const r6 = aplicarMarca("site", 0, 4, "link", "x");
  ok("link com o endereço selecionado para escrever", r6.valor === "[site](https://)" && r6.valor.slice(r6.inicio, r6.fim) === "https://");
  const r7 = aplicarMarca("", 0, 0, "titulo", "Subtítulo");
  ok("título na linha vazia", r7.valor === "## Subtítulo" && lerTextoFormatado(r7.valor)[0].t === "titulo");
}

// ═══════════════════ 4. As contas do banco de questões ═══════════════════
{
  const boa = { materia: "matematica", tema: "Porcentagem", enunciado: "Quanto é 10% de 50?", alternativas: ["5", "10", "15"], certa: 0, explicacao: "Dez por cento é um décimo: 50 / 10 = 5." };
  ok("questão boa passa", problemasDaQuestao(boa).length === 0);
  ok("cada problema é achado", JSON.stringify(problemasDaQuestao({ ...boa, materia: "astrologia", tema: "x", enunciado: "curto", alternativas: ["a", "A"], certa: 3, explicacao: "" }))
    === JSON.stringify(["materia", "tema", "enunciado", "repetida", "certa", "explicacao"]));
  ok("alternativa vazia e quantidade", problemasDaQuestao({ ...boa, alternativas: ["a", " "] }).includes("alternativa") && problemasDaQuestao({ ...boa, alternativas: ["a"], certa: 0 }).includes("alternativas")
    && problemasDaQuestao({ ...boa, alternativas: ["a", "b", "c", "d", "e", "f"] }).includes("alternativas"));
  ok("letras", letra(0) === "A" && letra(4) === "E");
  ok("a lista de matérias é a mesma do banco", MATERIAS.every((m) => sql.includes(`'${m}'`)) && (sql.match(/'matematica', 'fisica'[^)]*\)/g) ?? []).length === 2);

  const mem = new Map();
  const guarda = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const id1 = "00000000-0000-4000-8000-000000000001";
  const id2 = "00000000-0000-4000-8000-000000000002";
  guardarResposta(guarda, id1, { e: 1, a: false, m: "matematica", d: "2026-11-13" });
  guardarResposta(guarda, id1, { e: 0, a: true, m: "matematica", d: "2026-11-13" });
  const todos = guardarResposta(guarda, id2, { e: 2, a: true, m: "historia", d: "2026-11-13" });
  ok("vale a primeira resposta", todos[id1].a === false && todos[id1].e === 1);
  ok("a chave usa o prefixo da Alumia (o Sair rápido apaga)", CHAVE_DOS_ACERTOS.startsWith("lucia:rede") && mem.has(CHAVE_DOS_ACERTOS));
  const r = resumoDosAcertos(lerAcertos(guarda));
  ok("o resumo da própria pessoa, por matéria", r.feitas === 2 && r.certas === 1 && r.porMateria.length === 2);
  ok("o aparelho guarda só escolha, acerto, matéria e dia (sem hora, sem texto)", JSON.stringify(Object.values(lerAcertos(guarda))[0]) === '{"e":1,"a":false,"m":"matematica","d":"2026-11-13"}');
  ok("responder de novo esquece a questão", !esquecerResposta(guarda, id1)[id1]);
  apagarAcertos(guarda);
  ok("apagar os acertos do aparelho", !mem.has(CHAVE_DOS_ACERTOS) && Object.keys(lerAcertos(guarda)).length === 0);
  mem.set(CHAVE_DOS_ACERTOS, "{lixo");
  ok("armazenamento estragado conta como vazio", Object.keys(lerAcertos(guarda)).length === 0 && Object.keys(lerAcertos(null)).length === 0);
  mem.set(CHAVE_DOS_ACERTOS, JSON.stringify({ "nao-e-id": { e: 1, a: true, m: "x", d: "y" }, [id2]: { e: "1" } }));
  ok("entrada estranha no aparelho é ignorada", Object.keys(lerAcertos(guarda)).length === 0);
}

// ═══════════════════ 5. Os textos ═══════════════════
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) formas(x, p ? `${p}.${k}` : k, out);
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  for (const pasta of ["texto", "questoes"]) {
    const pt = JSON.parse(ler(`i18n/rede/${pasta}/pt.json`));
    const base = formas(pt);
    for (const l of ["en", "es", "fr", "ru", "zh"]) {
      const outro = formas(JSON.parse(ler(`i18n/rede/${pasta}/${l}.json`)));
      const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
      ok(`${pasta}/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
    }
    ok(`${pasta}: nenhum texto vazio no pt`, ![...base.values()].some((v) => v.endsWith(":vazio")));
    ok(`${pasta}: os textos não usam "diploma", "universidade" nem "algoritmo"`, ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|university|universidad|universit|algoritm|algorithm|алгоритм|算法|университет|大学/i.test(ler(`i18n/rede/${pasta}/${l}.json`))));
  }
  const q = JSON.parse(ler("i18n/rede/questoes/pt.json"));
  ok("toda matéria tem nome", MATERIAS.every((m) => typeof q.materias[m] === "string"));
  ok("todo problema da conferência e erro do banco tem texto", ["materia", "tema", "enunciado", "alternativas", "alternativa", "repetida", "certa", "explicacao"].every((p) => typeof q.escrever.problemas[p] === "string")
    && ["consentimento", "dado_pessoal", "nao_encontrado", "sem_permissao", "muitos_pedidos", "invalido:propria", "invalido:muitas", "invalido:escolha"].every((c) => typeof q.erros[c] === "string"));
  ok("a ajuda do texto mostra a forma de cada sinal que o leitor entende", (() => {
    const t = JSON.parse(ler("i18n/rede/texto/pt.json"));
    return t.ajuda.itens.every((x) => lerTextoFormatado(x.escreva.replace("https://…", "https://exemplo.org")).length > 0) && t.ajuda.itens.length === 10;
  })());
}

// ═══════════════════ 6. Banco ═══════════════════
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
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_quest%'`)).rows,
(rs) => rs.length === 11 && rs.every((r) => /interno\.alumia_(porta|passa)\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and (p.proname like 'rede\\_quest%' or p.proname like 'rede\\_texto\\_limpo%')`)).rows,
(rs) => rs.length === 6 && rs.every((r) => !r.a && !r.b));
await espera("nenhuma função das questões abre para visitante", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_quest%' and has_function_privilege('anon', p.oid, 'execute')`)).rows,
(r) => r.length === 0);
await recusa("visitante não lê questões", () => rpc(visitante, "rede_questoes_materias"), "permission denied");

// A limpeza do banco é a mesma do aparelho.
{
  const corpus = [
    "[a](javascript:alert(1)) [b](//evil.example/x) [c](/alumia/p/1) [d](https://ok.example/x?y=1#z)",
    // A imagem 5 a 20 do álbum do prompt 4 tem a prova dela (testar-p4-compositor): aqui, uma fora de qualquer faixa.
    "![e](imagem:1) ![f](https://evil.example/t.png) ![g](imagem:25) ![](data:x)",
    "[g](HTTPS://Exemplo.org) [h](https://usuario@evil.example) [i](/\\evil.example) [j](data:text/html;base64,PHNjcmlwdD4=)",
    "\u202Eabc\u2066def\u2069\r\nfim\u0007\u007f\rtudo",
    "## Título\n\n$$x^2$$ e `código` e **forte** [l](#) [m](   https://ok.example   ) [n](https://ok.example/a b)",
    "texto comum, sem nada demais. R$ 10. f(x) = (x+1)(x-1). [colchete] (parêntese) ](javascript:x)",
    "![" + "x".repeat(300) + "](https://evil.example)",
  ];
  for (const [i, entrada] of corpus.entries()) {
    await espera(`limpeza igual no banco e no aparelho (${i + 1})`, async () => (await dono("select interno.rede_texto_limpo($1) as x", [entrada])).rows[0].x, (x) => x === limparFonte(entrada));
  }
}

const P = {};
const NOMES = ["autora", "membro", "membro2", "mediadora", "fora"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o11.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of NOMES.filter((n) => n !== "fora")) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o11_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '90 days'");
await dono("delete from interno.papeis where usuario = $1", [P.mediadora]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'mediacao')", [P.mediadora]);

// O gatilho que limpa todo post.
{
  const inserir = (quem, campos) => banco.exclusivo(() => banco.pg.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2" })]);
    return (await tx.query("insert into interno.rede_posts (autor, tipo, titulo, texto, corpo, publico) values ($1, $2, $3, $4, $5, 'membros') returning id, texto, corpo",
      [P[quem], campos.tipo ?? "post", campos.titulo ?? null, campos.texto, campos.corpo ?? null])).rows[0];
  }));
  const corpo = "## Plano\n\n![mapa](imagem:1)\n![rastreio](https://evil.example/p.gif)\n\n[ver](javascript:alert(1)) e [site](https://exemplo.org)\n\u202Efim";
  const p = await espera("o post longo nasce com o corpo limpo", () => inserir("autora", { tipo: "discussao", titulo: "Plano de estudo", texto: "[x](javascript:1) resumo", corpo }),
    (r) => r.corpo === limparFonte(corpo) && !r.corpo.includes("javascript") && !r.corpo.includes("evil.example") && r.corpo.includes("![mapa](imagem:1)") && r.texto === "[x](#) resumo");
  if (p) {
    await espera("editar passa pela limpeza de novo", async () => {
      await dono("update interno.rede_posts set corpo = $2 where id = $1", [p.id, "Novo ![x](http://evil.example/a.png) [y](data:text/html,oi)"]);
      return (await dono("select corpo from interno.rede_posts where id = $1", [p.id])).rows[0].corpo;
    }, (c) => c === "Novo x [y](#)");
  }
  await espera("o gatilho roda antes dos outros (nome com a0)", async () => (await dono(`select tgname from pg_trigger where tgrelid = 'interno.rede_posts'::regclass and not tgisinternal and tgname < 'a0_rede_texto_limpo'`)).rows, (r) => r.length === 0);
}

// O banco de questões.
await zerar();
const A = como(P.autora);
const M = como(P.membro);
const MED = como(P.mediadora);
const boa = (extra = {}) => ({
  p_id: null, p_materia: "matematica", p_tema: "Porcentagem", p_enunciado: "A passagem subiu de R$ 4,40 para R$ 4,84. De quanto foi o aumento? $$\\frac{0{,}44}{4{,}40}$$",
  p_alternativas: ["4%", "8%", "10%", "44%"], p_certa: 2, p_explicacao: "O aumento foi de R$ 0,44, que é **10%** de R$ 4,40.", ...extra,
});
await recusa("quem não é membro não escreve", () => rpc(como(P.fora), "rede_questao_salvar", boa()), "consentimento");
await recusa("quem não é membro não lê", () => rpc(como(P.fora), "rede_questoes", { p_materia: "matematica" }), "consentimento");
await recusa("matéria fora da lista", () => rpc(A, "rede_questao_salvar", boa({ p_materia: "astrologia" })), "invalido:materia");
await recusa("tema curto", () => rpc(A, "rede_questao_salvar", boa({ p_tema: "x" })), "invalido:tema");
await recusa("enunciado curto", () => rpc(A, "rede_questao_salvar", boa({ p_enunciado: "curto" })), "invalido:enunciado");
await recusa("uma alternativa só", () => rpc(A, "rede_questao_salvar", boa({ p_alternativas: ["a"], p_certa: 0 })), "invalido:alternativas");
await recusa("seis alternativas", () => rpc(A, "rede_questao_salvar", boa({ p_alternativas: ["a", "b", "c", "d", "e", "f"] })), "invalido:alternativas");
await recusa("alternativa que não é texto", () => rpc(A, "rede_questao_salvar", boa({ p_alternativas: ["a", 2] })), "invalido:alternativas");
await recusa("alternativa vazia", () => rpc(A, "rede_questao_salvar", boa({ p_alternativas: ["a", "   "] })), "invalido:alternativa");
await recusa("alternativas iguais (sem acento e maiúscula)", () => rpc(A, "rede_questao_salvar", boa({ p_alternativas: ["Ação", "acao"], p_certa: 0 })), "invalido:repetida");
await recusa("a certa fora das alternativas", () => rpc(A, "rede_questao_salvar", boa({ p_certa: 4 })), "invalido:certa");
await recusa("explicação curta", () => rpc(A, "rede_questao_salvar", boa({ p_explicacao: "porque" })), "invalido:explicacao");
await recusa("dado pessoal no enunciado", () => rpc(A, "rede_questao_salvar", boa({ p_enunciado: "Ligue para (81) 98765-4321 e pergunte a resposta." })), "dado_pessoal");
await recusa("dado pessoal na alternativa", () => rpc(A, "rede_questao_salvar", boa({ p_alternativas: ["maria@exemplo.org", "b"], p_certa: 0 })), "dado_pessoal");
const q1 = await espera("membro escreve uma questão", () => rpc(A, "rede_questao_salvar", boa()), (r) => r.id && r.criada === true);
const q2 = await espera("e outra, com link perigoso e imagem de fora (o banco limpa)", () => rpc(A, "rede_questao_salvar", boa({
  p_tema: "porcentagem ", p_enunciado: "Veja [isto](javascript:alert(1)) e ![x](https://evil.example/p.gif) antes de responder.", p_alternativas: ["sim", "não"], p_certa: 1,
})), (r) => r.id);
const q3 = await espera("uma de outra matéria e outro tema", () => rpc(M, "rede_questao_salvar", boa({ p_materia: "historia", p_tema: "Brasil República", p_enunciado: "Em que ano foi a Revolta da Vacina?", p_alternativas: ["1904", "1922", "1932"], p_certa: 0, p_explicacao: "Foi em novembro de 1904, no Rio de Janeiro." })), (r) => r.id);
await espera("o que foi guardado está limpo", async () => (await dono("select enunciado from interno.rede_questoes where id = $1", [q2?.id])).rows[0].enunciado,
  (e) => e === "Veja [isto](#) e x antes de responder.");
await espera("as matérias contam questões (não pessoas) e dizem se é mediação", () => rpc(M, "rede_questoes_materias"),
  (r) => JSON.stringify(r.materias) === JSON.stringify([{ materia: "historia", questoes: 1 }, { materia: "matematica", questoes: 2 }]) && r.modera === false && r.minhas === 1);
await espera("para a mediação, modera = sim", () => rpc(MED, "rede_questoes_materias"), (r) => r.modera === true);
await espera("os temas juntam o mesmo tema escrito de outro jeito", () => rpc(M, "rede_questoes_temas", { p_materia: "matematica" }),
  (r) => r.temas.length === 1 && r.temas[0].tema === "Porcentagem" && r.temas[0].questoes === 2);
const lista = await espera("a lista NUNCA leva a certa nem a explicação, nem quem escreveu", () => rpc(M, "rede_questoes", { p_materia: "matematica" }),
  (r) => r.itens.length === 2 && r.itens.every((q) => Object.keys(q).sort().join() === "alternativas,criado_em,editada,enunciado,id,materia,minha,tema")
    && !JSON.stringify(r).includes(P.autora) && !JSON.stringify(r).includes("10%** de") && r.itens.every((q) => q.minha === false) && r.proximo === null);
await espera("a própria autora vê \"minha\"", () => rpc(A, "rede_questoes", { p_materia: "matematica" }), (r) => r.itens.every((q) => q.minha === true));
await espera("a ordem é das mais novas para as mais velhas", () => Promise.resolve(lista), (r) => r.itens[0].id === q2?.id && r.itens[1].id === q1?.id);
await espera("filtro por tema", () => rpc(M, "rede_questoes", { p_materia: "matematica", p_tema: "PORCENTAGEM" }), (r) => r.itens.length === 2);
await espera("páginas com cursor", async () => {
  const p1 = await rpc(M, "rede_questoes", { p_materia: "matematica", p_limite: 1 });
  const p2 = await rpc(M, "rede_questoes", { p_materia: "matematica", p_limite: 1, p_cursor: p1.proximo });
  return { p1, p2 };
}, ({ p1, p2 }) => p1.itens.length === 1 && p1.proximo && p2.itens.length === 1 && p2.itens[0].id !== p1.itens[0].id && p2.proximo === null);
await recusa("cursor estragado", () => rpc(M, "rede_questoes", { p_materia: "matematica", p_cursor: "lixo" }), "invalido:cursor");
await espera("uma questão pelo id, também sem a certa", () => rpc(M, "rede_questao", { p_id: q1?.id }), (r) => r.id === q1?.id && !("certa" in r) && !("explicacao" in r));

// Responder não grava nada.
const contar = async () => (await dono(`select string_agg(c.relname || '=' || coalesce(s.n_live_tup, 0), ',' order by c.relname) as x from pg_class c join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid where n.nspname = 'interno' and c.relkind = 'r' and c.relname <> 'limites'`)).rows[0].x;
const contarDeVerdade = async () => {
  const tabs = (await dono("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and relname <> 'limites' order by relname")).rows.map((r) => r.relname);
  const partes = [];
  for (const t of tabs) partes.push(`${t}=${(await dono(`select count(*)::int as n from interno.${t}`)).rows[0].n}`);
  return partes.join(",");
};
void contar;
const antes = await contarDeVerdade();
await espera("responder errado devolve a certa e a explicação", () => rpc(M, "rede_questao_responder", { p_id: q1?.id, p_escolha: 0 }),
  (r) => r.acertou === false && r.certa === 2 && r.explicacao.includes("10%"));
await espera("responder certo", () => rpc(M, "rede_questao_responder", { p_id: q1?.id, p_escolha: 2 }), (r) => r.acertou === true);
await espera("responder não grava NADA no banco (nenhuma tabela muda, fora a janela do limite)", () => contarDeVerdade(), (depois) => depois === antes);
await recusa("escolha fora das alternativas", () => rpc(M, "rede_questao_responder", { p_id: q1?.id, p_escolha: 9 }), "invalido:escolha");
await recusa("escolha negativa", () => rpc(M, "rede_questao_responder", { p_id: q1?.id, p_escolha: -1 }), "invalido:escolha");
await recusa("quem não é membro não responde", () => rpc(como(P.fora), "rede_questao_responder", { p_id: q1?.id, p_escolha: 0 }), "consentimento");

// Minhas, editar e apagar.
await espera("minhas: com a certa e a explicação, só as próprias", () => rpc(A, "rede_questoes_minhas"),
  (r) => r.itens.length === 2 && r.itens.every((q) => typeof q.certa === "number" && q.explicacao && q.retirada === false));
await recusa("ninguém edita a questão dos outros", () => rpc(M, "rede_questao_salvar", boa({ p_id: q1?.id })), "nao_encontrado");
await espera("a autora edita", () => rpc(A, "rede_questao_salvar", boa({ p_id: q1?.id, p_certa: 1, p_alternativas: ["4%", "10%", "8%"] })), (r) => r.criada === false);
await espera("a edição vale na resposta", () => rpc(M, "rede_questao_responder", { p_id: q1?.id, p_escolha: 1 }), (r) => r.acertou === true && r.certa === 1);
await recusa("ninguém apaga a questão dos outros", () => rpc(M, "rede_questao_apagar", { p_id: q1?.id }), "nao_encontrado");

// Denunciar e mediar.
await recusa("não denuncia a própria", () => rpc(A, "rede_questao_denunciar", { p_id: q1?.id, p_motivo: "errada" }), "invalido:propria");
await recusa("motivo fora da lista", () => rpc(M, "rede_questao_denunciar", { p_id: q1?.id, p_motivo: "chata" }), "invalido:motivo");
await espera("membro denuncia; a denúncia não guarda quem denunciou", async () => {
  await rpc(M, "rede_questao_denunciar", { p_id: q1?.id, p_motivo: "errada" });
  await rpc(como(P.membro2), "rede_questao_denunciar", { p_id: q1?.id, p_motivo: "spam" });
  return (await dono("select * from interno.rede_questoes_denuncias where questao = $1", [q1?.id])).rows;
}, (rs) => rs.length === 2 && rs.every((x) => Object.keys(x).sort().join() === "criado_em,id,motivo,questao") && !JSON.stringify(rs).includes(P.membro));
await recusa("quem não é mediação não vê as denunciadas", () => rpc(M, "rede_questoes_denunciadas"), "sem_permissao");
await recusa("quem não é mediação não retira", () => rpc(M, "rede_questao_mediar", { p_id: q1?.id, p_retirar: true }), "sem_permissao");
await espera("a mediação vê as denunciadas, com a certa, os motivos e o número, sem quem escreveu nem quem denunciou", () => rpc(MED, "rede_questoes_denunciadas"),
  (r) => r.itens.length === 1 && r.itens[0].denuncias === 2 && r.itens[0].motivos.sort().join() === "errada,spam" && typeof r.itens[0].certa === "number"
    && !JSON.stringify(r).includes(P.autora) && !JSON.stringify(r).includes(P.membro));
await espera("a mediação retira", () => rpc(MED, "rede_questao_mediar", { p_id: q1?.id, p_retirar: true }), (r) => r.retirada === true);
await espera("a retirada some da lista e da contagem, e a fila esvazia", async () => ({
  l: await rpc(M, "rede_questoes", { p_materia: "matematica" }), m: await rpc(M, "rede_questoes_materias"), d: await rpc(MED, "rede_questoes_denunciadas"),
}), ({ l, m, d }) => l.itens.length === 1 && m.materias.find((x) => x.materia === "matematica").questoes === 1 && d.itens.length === 0);
await recusa("a retirada não responde mais para os outros", () => rpc(M, "rede_questao_responder", { p_id: q1?.id, p_escolha: 0 }), "nao_encontrado");
await espera("a autora ainda a vê em \"minhas\", marcada como retirada", () => rpc(A, "rede_questoes_minhas"), (r) => r.itens.find((q) => q.id === q1?.id)?.retirada === true);
await espera("editar não devolve a retirada", async () => {
  await rpc(A, "rede_questao_salvar", boa({ p_id: q1?.id }));
  return rpc(M, "rede_questoes", { p_materia: "matematica" });
}, (r) => !r.itens.some((q) => q.id === q1?.id));
await espera("a mediação pode devolver", async () => {
  await rpc(MED, "rede_questao_mediar", { p_id: q1?.id, p_retirar: false });
  return rpc(M, "rede_questoes", { p_materia: "matematica" });
}, (r) => r.itens.some((q) => q.id === q1?.id));
await espera("a autora apaga a dela (com as denúncias)", async () => {
  await rpc(M, "rede_questao_denunciar", { p_id: q2?.id, p_motivo: "outro" });
  await rpc(A, "rede_questao_apagar", { p_id: q2?.id });
  return (await dono("select (select count(*)::int from interno.rede_questoes where id = $1) as q, (select count(*)::int from interno.rede_questoes_denuncias where questao = $1) as d", [q2?.id])).rows[0];
}, (r) => r.q === 0 && r.d === 0);
await espera("apagar a conta leva as questões dela", async () => {
  await dono("delete from interno.perfis where id = $1", [P.membro]);
  return (await dono("select count(*)::int as n from interno.rede_questoes where id = $1", [q3?.id])).rows[0].n;
}, (n) => n === 0);
await zerar();
await espera("o limite de escrita: 20 por hora", async () => {
  let ultimo = null;
  for (let i = 0; i < 21; i++) {
    try {
      await rpc(A, "rede_questao_salvar", boa({ p_tema: `Tema ${i}`, p_enunciado: `Enunciado número ${i} da sequência.` }));
    } catch (e) {
      ultimo = { i, msg: e.message };
      break;
    }
  }
  return ultimo;
}, (r) => r && r.i === 20 && r.msg.includes("muitos_pedidos"));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
