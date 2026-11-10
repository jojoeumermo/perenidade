// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as regras puras de gente de FORA na tela da Alumia (lib/rede/fediverso/tela/**): o HTML de fora convertido em árvore por
// lista permitida (contra uma bateria de XSS), o link que mostra um endereço e leva a outro, a mídia só pela rota-proxy, o que o
// servidor assina antes de mandar à tela, o endereço de conta, a contagem a partir de 3, os endereços das páginas, os dados de
// exemplo da prévia e os seis arquivos de texto (mesmas chaves; rascunho marcado nos cinco).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/carregar-ts.mjs scripts/testar-fediverso-tela.mjs
import { readFileSync } from "node:fs";

// O segredo da federação ANTES de importar o servidor (ele lê a variável ao carregar): sem ele nenhuma mídia é assinada.
process.env.ALUMIA_FEDIVERSO_SEGREDO ??= "segredo-de-teste-da-tela-com-mais-de-32-caracteres";

const html = await import("../lib/rede/fediverso/tela/html.ts");
const tipos = await import("../lib/rede/fediverso/tela/tipos.ts");
const exemplos = await import("../lib/rede/fediverso/tela/exemplos.ts");
const servidor = await import("../lib/rede/fediverso/servidor.ts");
const { htmlParaArvore, textoDaArvore, hrefSeguro, semEntidades, destinoQueEngana, linkDaOrigem, semDirecao } = html;

let certos = 0;
const falhas = [];
function espera(nome, calcular, conferir = (v) => v !== false) {
  try {
    const valor = calcular();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

// ── A árvore: o que pode aparecer nela ──
const PERMITIDAS = new Set(html.TAGS_DE_FORA);
/** Tudo o que há de errado numa árvore: tag fora da lista, chave que não é tag/href/filhos, href fora de <a> ou que não é https. */
function problemas(nos, fundo = 1, saida = []) {
  for (const n of nos) {
    if (typeof n === "string") continue;
    if (!n || typeof n !== "object") { saida.push("nó estranho"); continue; }
    if (!PERMITIDAS.has(n.tag)) saida.push(`tag ${n.tag}`);
    for (const k of Object.keys(n)) if (!["tag", "href", "filhos"].includes(k)) saida.push(`chave ${k}`);
    if ("href" in n && (n.tag !== "a" || typeof n.href !== "string" || !/^https:\/\/[^\s"'<>\\]+$/.test(n.href))) saida.push(`href ${n.href}`);
    if (n.tag === "a" && !("href" in n)) saida.push("a sem href");
    if (fundo > html.LIMITE_DE_PROFUNDIDADE) saida.push(`fundo ${fundo}`);
    if (!Array.isArray(n.filhos)) saida.push("sem filhos");
    else problemas(n.filhos, fundo + 1, saida);
  }
  return saida;
}
const tags = (nos, saida = []) => { for (const n of nos) if (typeof n !== "string") { saida.push(n.tag); tags(n.filhos, saida); } return saida; };
const links = (nos, saida = []) => { for (const n of nos) if (typeof n !== "string") { if (n.tag === "a") saida.push(n.href); links(n.filhos, saida); } return saida; };
const contar = (nos) => nos.reduce((s, n) => s + 1 + (typeof n === "string" ? 0 : contar(n.filhos)), 0);

espera("HTML comum do Mastodon: parágrafos, quebra, menção e link viram a árvore, sem classe nenhuma", () => {
  const a = htmlParaArvore('<p>Oi <span class="h-card"><a href="https://mastodon.social/@tiao" class="u-url mention">@<span>tiao</span></a></span>,<br>veja <a href="https://exemplo.org/a?b=1&amp;c=2" rel="x" target="_top"><span class="invisible">https://</span><span class="ellipsis">exemplo.org/a</span></a></p><p>Segundo <strong>forte</strong> <em>ênfase</em> &amp; fim</p>');
  return [problemas(a), tags(a).join(","), links(a), textoDaArvore(a)];
}, (r) => r[0].length === 0 && r[1] === "p,span,a,span,br,a,span,span,p,strong,em" && r[2][0] === "https://mastodon.social/@tiao" && r[2][1] === "https://exemplo.org/a?b=1&c=2" && r[3] === "Oi @tiao,\nveja https://exemplo.org/a\nSegundo forte ênfase & fim\n");

espera("todas as tags da lista passam; listas, citação e código mantêm a estrutura", () => {
  const a = htmlParaArvore("<ul><li>um<li>dois</li></ul><ol><li><b>a</b><i>b</i><u>c</u><del>d</del><s>e</s></li></ol><blockquote><p>cita</p></blockquote><pre><code>x &lt; y</code></pre>");
  return [problemas(a), tags(a).join(","), textoDaArvore(a)];
}, (r) => r[0].length === 0 && r[1] === "ul,li,li,ol,li,b,i,u,del,s,blockquote,p,pre,code" && r[2].includes("x < y"));

// ── A bateria de XSS: nada disto pode virar elemento, atributo ou endereço ──
const ATAQUES = {
  script: '<p>a</p><script>alert(1)</script><p>b</p>',
  "script maiúsculo e com espaço": "<ScRiPt >alert(1)</sCrIpT ><p>b</p>",
  "script que não fecha": "<p>a</p><script>alert(1)",
  "script com src": '<script src="https://mau.teste/x.js"></script>ok',
  "onerror em img": '<img src=x onerror=alert(1)>texto',
  "onerror em img com aspas": '<img src="https://mau.teste/p.png" onerror="alert(1)" />texto',
  "onclick em tag permitida": '<p onclick="alert(1)" onmouseover=alert(2) style="position:fixed" class="x" id="y" data-x="1">a</p>',
  "javascript: no href": '<a href="javascript:alert(1)">clique</a>',
  "javascript: com espaço e maiúsculas": '<a href=" JaVaScRiPt:alert(1)">clique</a>',
  "javascript: com tabulação": '<a href="java\tscript:alert(1)">clique</a>',
  "javascript: em entidades decimais": '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">clique</a>',
  "javascript: em entidades hexadecimais sem ponto e vírgula": '<a href="&#x6a&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3a;alert(1)">clique</a>',
  "javascript: com entidade de dois-pontos": '<a href="javascript&colon;alert(1)">clique</a>',
  "data: no href": '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">clique</a>',
  "vbscript: no href": '<a href="vbscript:msgbox(1)">clique</a>',
  "href http": '<a href="http://exemplo.org/">clique</a>',
  "href //host": '<a href="//mau.teste/x">clique</a>',
  "href relativo": '<a href="/pt/alumia/sair">clique</a>',
  "href com usuário e senha": '<a href="https://banco.teste@mau.teste/">clique</a>',
  "href com barra invertida": '<a href="https:\\\\mau.teste/">clique</a>',
  "href com aspas dentro": "<a href='https://ok.teste/\"onmouseover=\"alert(1)'>clique</a>",
  "href sem aspas com evento": "<a href=https://ok.teste/ onclick=alert(1)>clique</a>",
  svg: '<svg onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a></svg>depois',
  "svg com use": '<svg><use href="data:image/svg+xml,<svg id=x onload=alert(1)>"></use></svg>depois',
  math: '<math><mtext><script>alert(1)</script></mtext></math>depois',
  style: "<style>p{background:url(https://mau.teste/pixel)}</style><p>a</p>",
  "style em atributo": '<p style="background:url(https://mau.teste/pixel)">a</p><span style=\'color:red\'>b</span>',
  iframe: '<iframe src="https://mau.teste/"></iframe><p>a</p>',
  "iframe com srcdoc": '<iframe srcdoc="<script>alert(1)</script>">dentro</iframe>fora',
  "object e embed": '<object data="https://mau.teste/x.swf"><param name="a" value="b"></object><embed src="https://mau.teste/y">fim',
  "formulário e botão": '<form action="https://mau.teste/"><input name="senha"><button formaction="javascript:alert(1)">ok</button></form>',
  "meta e link e base": '<meta http-equiv="refresh" content="0;url=https://mau.teste/"><link rel="stylesheet" href="https://mau.teste/x.css"><base href="https://mau.teste/">texto',
  "imagem, vídeo e áudio de fora": '<img src="https://mau.teste/p.png"><video src="https://mau.teste/v.mp4" autoplay></video><audio src="https://mau.teste/a.mp3"></audio><picture><source srcset="https://mau.teste/s.png"></picture>texto',
  "entidades que formam uma tag": "&lt;script&gt;alert(1)&lt;/script&gt; &#60;img src=x onerror=alert(1)&#62; &#x3c;svg onload=alert(1)&#x3e;",
  "tag que não fecha": '<p>a<b>negrito<a href="https://ok.teste/">link',
  "tag cortada no fim": '<p>a</p><a href="https://ok.teste/" onclick="alert(1)',
  "tag cortada com aspa aberta": '<p>a</p><img src="x onerror=alert(1)>depois <b>negrito</b>',
  "menor solto": "1 < 2 e 3 > 2 <3 <-- seta <<a>>",
  "comentário": "<!-- <script>alert(1)</script> --><p>a</p><!--[if IE]><script>alert(2)</script><![endif]-->",
  "comentário que não fecha": "<p>a</p><!-- <script>alert(1)</script>",
  "cdata e doctype": "<!DOCTYPE html><![CDATA[<script>alert(1)</script>]]><?xml version='1.0'?><p>a</p>",
  "fecha sem abrir": "</p></a></script></div><p>a</p></b></b></b>",
  "aninhamento torto": "<b><i>a</b>b</i><p><p><p>c</p>",
  "tag com dois-pontos e traço": '<x:script>alert(1)</x:script><custom-el onclick="alert(1)">a</custom-el>',
  "nulo e controle": "<scr\u0000ipt>alert(1)</scr\u0000ipt><a href=\"java\u0000script:alert(1)\">x</a>",
  "mutação por noscript e textarea": '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript><textarea></textarea><img src=x onerror=alert(1)>',
  "link dentro de link": '<a href="https://ok.teste/1">um<a href="javascript:alert(1)">dois</a><a href="https://ok.teste/3">três</a></a>',
};
for (const [nome, ataque] of Object.entries(ATAQUES)) {
  espera(`XSS (${nome}): só sobram tags da lista, nenhum atributo e nenhum endereço que não seja https`, () => {
    const a = htmlParaArvore(ataque);
    const ruins = problemas(a);
    for (const h of links(a)) if (/mau\.teste|javascript|data:|vbscript/i.test(h)) ruins.push(`link ${h}`);
    // O JSON da árvore só pode ter as chaves tag, href e filhos: nada de on*, style, src, class.
    if (/"(on\w+|style|src|srcdoc|class|id|action|formaction|srcset)"\s*:/i.test(JSON.stringify(a))) ruins.push("atributo no JSON");
    return ruins;
  }, (r) => r.length === 0);
}

espera("o conteúdo de script, style, iframe e svg some (não vira texto na tela)", () =>
  [ATAQUES.script, ATAQUES["script que não fecha"], ATAQUES.style, ATAQUES.svg, ATAQUES.iframe, ATAQUES.math, ATAQUES["iframe com srcdoc"]].map((x) => textoDaArvore(htmlParaArvore(x))),
(r) => r.every((t) => !/alert|background|dentro/.test(t)) && r[0] === "a\nb\n" && r[3] === "depois" && r[6] === "fora");
espera("link que não é https vira só o texto (sem <a>); o https fica, normalizado", () => {
  const a = htmlParaArvore('<p><a href="javascript:alert(1)">um</a> <a href="http://x.teste/">dois</a> <a href="//x.teste/">três</a> <a>quatro</a> <a href="HTTPS://Ok.Teste/a b">cinco</a> <a href="https://ok.teste/caminho?q=1#f">seis</a></p>');
  return [tags(a).join(","), links(a), textoDaArvore(a)];
}, (r) => r[0] === "p,a" && r[1].length === 1 && r[1][0] === "https://ok.teste/caminho?q=1#f" && r[2] === "um dois três quatro cinco seis\n");
espera("entidades viram TEXTO (a tela escapa de novo): nunca uma tag", () => {
  const a = htmlParaArvore("<p>&lt;b&gt;não é negrito&lt;/b&gt; &amp;amp; &#233; &#x1F600; &nbsp;| &naoexiste; &#0; &#xD800; a&b</p>");
  return [tags(a).join(","), textoDaArvore(a)];
}, (r) => r[0] === "p" && r[1] === "<b>não é negrito</b> &amp; é 😀  | &naoexiste;   a&b\n");
espera("aninhamento profundo: a árvore para no teto de profundidade e o texto de dentro fica", () => {
  const a = htmlParaArvore("<span>".repeat(5000) + "fundo" + "</span>".repeat(5000));
  const b = htmlParaArvore("<blockquote>".repeat(40) + "<b>fundo</b>" + "</blockquote>".repeat(40));
  const fundura = (nos) => nos.reduce((m, n) => (typeof n === "string" ? m : Math.max(m, 1 + fundura(n.filhos))), 0);
  return [problemas(a), fundura(a) <= html.LIMITE_DE_PROFUNDIDADE, problemas(b), fundura(b) <= html.LIMITE_DE_PROFUNDIDADE, textoDaArvore(b).includes("fundo")];
}, (r) => r[0].length === 0 && r[1] && r[2].length === 0 && r[3] && r[4]);
espera("tamanho: HTML enorme é cortado e o número de nós tem teto (e não trava)", () => {
  const inicio = Date.now();
  const a = htmlParaArvore("<p>a</p>".repeat(100_000));
  const b = htmlParaArvore("<".repeat(200_000));
  const c = htmlParaArvore('<a href="'.repeat(20_000));
  const d = htmlParaArvore("<b>x".repeat(20_000));
  return [contar(a) <= html.LIMITE_DE_NOS + 5, textoDaArvore(b).length <= html.LIMITE_DE_HTML, problemas(c).length, problemas(d).length, contar(d) <= html.LIMITE_DE_NOS + 5, Date.now() - inicio < 3000];
}, (r) => r.every((x) => x === true || x === 0));
espera("entrada que não é texto: árvore vazia", () => [htmlParaArvore(null), htmlParaArvore(undefined), htmlParaArvore(""), htmlParaArvore(42), htmlParaArvore({})].every((a) => Array.isArray(a) && a.length === 0));
espera("hrefSeguro e semEntidades", () => [
  hrefSeguro("https://ok.teste/a?b=1&amp;c=2"), hrefSeguro(" https://ok.teste/ "), hrefSeguro("http://ok.teste/"), hrefSeguro("//ok.teste/"), hrefSeguro("https://localhost/"),
  hrefSeguro("https://u:s@ok.teste/"), hrefSeguro("https://ok.teste/\nx"), hrefSeguro("javascript:alert(1)"), hrefSeguro(""), hrefSeguro(null), hrefSeguro("https://ok.teste/" + "a".repeat(3000)),
  semEntidades("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; ?x=1&copy=2"),
], (r) => r[0] === "https://ok.teste/a?b=1&c=2" && r[1] === "https://ok.teste/" && r.slice(2, 11).every((x) => x === null) && r[11] === "a & b <c> \"d\" 'e' ?x=1&copy=2");

// ── O href é lido atributo por atributo: um "href=" dentro do valor de OUTRO atributo não vale ──
espera("ataque: 'href=' escondido no valor de outro atributo não vira o destino do link", () => [
  links(htmlParaArvore('<a title="oi href=https://mau.teste/x" href="https://ok.teste/">y</a>')),
  links(htmlParaArvore('<a data-x="a href=https://mau.teste/x">y</a>')),
  links(htmlParaArvore("<a title='x' data-y=\"/ href=https://mau.teste/z \" class=a>y</a>")),
  links(htmlParaArvore('<a title=href=https://mau.teste/x href=https://ok.teste/2>y</a>')),
  links(htmlParaArvore('<a xhref="https://mau.teste/x" data-href="https://mau.teste/y" href="https://ok.teste/3" href="https://mau.teste/z">y</a>')),
  links(htmlParaArvore('<a HREF="https://ok.teste/4">y</a><a href = \'https://ok.teste/5\'>z</a><a class="x"href="https://ok.teste/6">w</a>')),
  textoDaArvore(htmlParaArvore('<a data-x="a href=https://mau.teste/x">y</a>')),
], (r) => JSON.stringify(r) === JSON.stringify([["https://ok.teste/"], [], [], ["https://ok.teste/2"], ["https://ok.teste/3"], ["https://ok.teste/4", "https://ok.teste/5", "https://ok.teste/6"], "y"]));

// ── Caracteres de direção: não entram no texto (nem escritos, nem por entidade) ──
espera("ataque: caracteres de direção (U+202E e parentes) somem do texto e do texto dos links; o de junção dos emojis fica", () => {
  const a = htmlParaArvore('<p>abc‮gro.aicul‬ <a href="https://mau.teste/">‮gro.aiculotutitsni⁦x⁩</a> &#x202e;fim&#8238; ‎‏؜ 👩‍💻</p>');
  const t = textoDaArvore(a);
  return [/[؜‎‏‪-‮⁦-⁩]/.test(t), t.includes("👩‍💻"), semDirecao("a‮b⁧c"), problemas(a).length];
}, (r) => r[0] === false && r[1] === true && r[2] === "abc" && r[3] === 0);

// ── O link que mostra um endereço e leva a outro ──
espera("ataque: link cujo TEXTO mostra um endereço que não é o do destino devolve o servidor de verdade (a tela escreve ao lado)", () => [
  destinoQueEngana("https://mau.teste/login", "https://institutolucia.org/entrar"),
  destinoQueEngana("https://mau.teste/login", "institutolucia.org"),
  destinoQueEngana("https://mau.teste/login", "Entre em alumia.institutolucia.org/entrar agora"),
  destinoQueEngana("https://mau.teste/login", "‮gro.aiculotutitsni institutolucia.org"),
  destinoQueEngana("https://mau.teste/", "institutolucia.оrg"),
  destinoQueEngana("https://mau.teste/", "ok.teste e mau.teste"),
  destinoQueEngana("https://xn--80ak6aa92e.com/", "apple.com"),
], (r) => r.slice(0, 6).every((x) => x === "mau.teste") && r[6] === "xn--80ak6aa92e.com");
espera("link honesto não ganha aviso: texto comum, menção, hashtag e o próprio destino (com ou sem https, www e caminho)", () => [
  destinoQueEngana("https://mastodon.social/@tiao", "@tiao"),
  destinoQueEngana("https://mastodon.social/@tiao", "@tiao@mastodon.social"),
  destinoQueEngana("https://mastodon.social/tags/moradia", "#moradia"),
  destinoQueEngana("https://exemplo.org/a/b?c=1", "https://exemplo.org/a/b…"),
  destinoQueEngana("https://www.exemplo.org/a", "exemplo.org/a"),
  destinoQueEngana("https://exemplo.org/a", "WWW.Exemplo.ORG"),
  destinoQueEngana("https://exemplo.org/a", "clique aqui, por favor."),
  destinoQueEngana("https://exemplo.org/a", "versão 1.2 e 10.5"),
  destinoQueEngana(null, "institutolucia.org"),
  destinoQueEngana("não é endereço", "institutolucia.org"),
], (r) => r.every((x) => x === null));
espera("o exemplo do Mastodon (https:// invisível + domínio) não é tomado por link que engana", () => {
  const a = htmlParaArvore('<p><a href="https://exemplo.org/a?b=1"><span class="invisible">https://</span><span class="ellipsis">exemplo.org/a</span><span class="invisible">?b=1</span></a></p>');
  const no = a[0].filhos[0];
  return destinoQueEngana(no.href, textoDaArvore(no.filhos));
}, (r) => r === null);

// ── "Abrir no original": só o servidor de onde o post veio ──
espera("ataque: 'abrir no original' com usuário e senha, de outro servidor ou sem https cai no endereço da própria nota", () => [
  linkDaOrigem("https://institutolucia.org@outro.teste/", "https://mau.teste/notes/1"),
  linkDaOrigem("https://outro.teste/@x/1", "https://mau.teste/notes/1"),
  linkDaOrigem("javascript:alert(1)", "https://mau.teste/notes/1"),
  linkDaOrigem("http://mau.teste/@x/1", "https://mau.teste/notes/1"),
  linkDaOrigem("//mau.teste/@x/1", "https://mau.teste/notes/1"),
  linkDaOrigem(null, "https://mau.teste/notes/1"),
  linkDaOrigem("https://mau.teste/@x/1", "https://mau.teste/notes/1"),
  linkDaOrigem("https://www.mau.teste/@x/1", "https://mau.teste/notes/1"),
  linkDaOrigem("https://mau.teste/@x/1", "https://u:s@mau.teste/notes/1"),
  linkDaOrigem("https://mau.teste/@x/1", "javascript:alert(1)"),
  linkDaOrigem("https://mau.teste/@x/1", null),
], (r) => r.slice(0, 6).every((x) => x === "https://mau.teste/notes/1") && r[6] === "https://mau.teste/@x/1" && r[7] === "https://www.mau.teste/@x/1" && r.slice(8).every((x) => x === null));

// ── Mídia só pela rota-proxy ──
espera("midiaSegura: só o caminho relativo da NOSSA rota-proxy", () => [
  tipos.midiaSegura("/api/fediverso/midia?u=https%3A%2F%2Fmastodon.social%2Fm%2F1.png&e=1790000000&s=abc_DEF-123"),
  tipos.midiaSegura("https://mastodon.social/m/1.png"), tipos.midiaSegura("http://x.teste/a.png"), tipos.midiaSegura("//mau.teste/api/fediverso/midia?u=x"),
  tipos.midiaSegura("https://mau.teste/api/fediverso/midia?u=x"), tipos.midiaSegura("/api/fediverso/midia"), tipos.midiaSegura("/api/fediverso/midia?"), tipos.midiaSegura("/api/fediverso/midiax?u=1"),
  tipos.midiaSegura("/api/fediverso/midia?u=1 onerror=alert(1)"), tipos.midiaSegura('/api/fediverso/midia?u=1"><script>'), tipos.midiaSegura("/api/fediverso/midia?u=1\\@mau.teste"),
  tipos.midiaSegura("/api/fediverso/../outra?u=1"), tipos.midiaSegura("/API/fediverso/midia?u=1"), tipos.midiaSegura(" /api/fediverso/midia?u=1"), tipos.midiaSegura("javascript:alert(1)"),
  tipos.midiaSegura("data:image/png;base64,AAAA"), tipos.midiaSegura("blob:https://x/1"), tipos.midiaSegura(null), tipos.midiaSegura(undefined), tipos.midiaSegura(1), tipos.midiaSegura({}), tipos.midiaSegura(""),
  tipos.midiaSegura("/api/fediverso/midia?u=" + "a".repeat(5000)),
], (r) => r[0]?.startsWith("/api/fediverso/midia?u=") && r.slice(1).every((x) => x === null));
espera("o endereço que o servidor assina passa por midiaSegura mesmo com ( ) ! * ' na origem, e a assinatura confere", () => {
  const origens = ["https://a.teste/img(1).png", "https://a.teste/it's.png", "https://a.teste/a!b*c.png", "https://a.teste/m/1.png?x=1&y=(2)#f", "https://a.teste/é ç.png".replace(" ", "%20")];
  return origens.map((o) => {
    const assinada = servidor.urlDaMidia(o);
    const p = new URL(assinada ?? "", "https://alumia.teste").searchParams;
    return [tipos.midiaSegura(assinada) === assinada, /[!'()*\s"<>\\]/.test(assinada ?? ""), p.get("u") === o, servidor.midiaAssinada(p.get("u") ?? "", p.get("e") ?? "", p.get("s") ?? "")];
  });
}, (r) => r.every((x) => x[0] === true && x[1] === false && x[2] === true && x[3] === true));
espera("ataque: o servidor não assina o que não é https, e ninguém reaproveita a assinatura em outro endereço", () => {
  const boa = new URL(servidor.urlDaMidia("https://a.teste/1.png"), "https://alumia.teste").searchParams;
  return [servidor.urlDaMidia("http://a.teste/1.png"), servidor.urlDaMidia("//a.teste/1.png"), servidor.urlDaMidia("javascript:alert(1)"), servidor.urlDaMidia("https://a.teste/1 2.png"), servidor.urlDaMidia(null),
    servidor.midiaAssinada("https://mau.teste/1.png", boa.get("e"), boa.get("s")), servidor.midiaAssinada("https://a.teste/1.png", boa.get("e"), boa.get("s"))];
}, (r) => r.slice(0, 6).every((x) => x === null || x === false) && r[6] === true);

// ── O que o servidor troca antes de mandar o cartão à tela (assinarCartao) ──
const temEnderecoDeFora = (v) => /"(?:https?:)?\/\/(?!alumia\.teste)[^"]*\.(?:png|jpe?g|gif|webp)|"\/\\|mau\.teste\/(?:a|c|f|p|i)\./i.test(JSON.stringify(v));
espera("ataque: avatar que parece caminho daqui mas leva para fora ('/\\\\host', '/\\thost', '//host', '/caminho') vira nulo", () => {
  const ruins = ["/\\mau.teste/a.png", "/\\\tmau.teste/a.png", "//mau.teste/a.png", "/\t/mau.teste/a.png", "/foto.png", "/api/fediverso/midia", "/api/fediverso/midia?u=1 onerror=x", "/api/fediverso/midia?u=x\\@mau.teste", "http://mau.teste/a.png", "data:image/png;base64,AAAA", 7, {}];
  const saidas = ruins.map((avatar) => servidor.assinarCartao({ origem: "fediverso", id: "https://m.teste/1", avatar, autor: { codinome: "x", avatar }, impulsionado_por: { ator: "https://m.teste/u", avatar } }));
  const ja = servidor.urlDaMidia("https://m.teste/av.png");
  const boa = servidor.assinarCartao({ origem: "fediverso", id: "https://m.teste/1", avatar: ja });
  return [saidas.every((c) => c.avatar === null && c.autor.avatar === null && c.impulsionado_por.avatar === null), boa.avatar === ja, tipos.midiaSegura(boa.avatar) === ja];
}, (r) => r.every((x) => x === true));
espera("ataque: nenhum endereço de fora escapa por chave que o cartão não conhece (midia[].preview_url, autor.foto, citado, posts[])", () => {
  const sujo = { origem: "fediverso", id: "https://m.teste/1", avatar: "https://mau.teste/a.png",
    midia: [{ url: "https://mau.teste/f.png", preview_url: "https://mau.teste/p.png", remote_url: "https://mau.teste/p.png", tipo: "image/png", alt: "foto", largura: 10, altura: 20, blurhash: "L", meta: { original: "https://mau.teste/p.png" } }, { url: "javascript:alert(1)", preview_url: "https://mau.teste/p.png" }, "https://mau.teste/p.png", null],
    autor: { codinome: "x", avatar: "https://mau.teste/a.png", foto: "https://mau.teste/f.png", icone: "//mau.teste/i.png" },
    impulsionado_por: { ator: "https://m.teste/u", avatar: "https://mau.teste/a.png", foto: "/\\mau.teste/f.png" },
    citado: { origem: "fediverso", id: "https://m.teste/2", avatar: "https://mau.teste/c.png", midia: [{ url: "https://mau.teste/c.png", preview_url: "https://mau.teste/p.png" }], autor: { foto: "https://mau.teste/f.png" } },
    posts: [{ origem: "fediverso", id: "https://m.teste/3", avatar: "/\\mau.teste/a.png", midia: [{ url: "https://mau.teste/f.png", preview_url: "https://mau.teste/p.png" }] }] };
  const copia = JSON.stringify(sujo);
  const c = servidor.assinarCartao(sujo);
  const m = c.midia[0];
  return [temEnderecoDeFora(c), c.midia.length, Object.keys(m).sort().join(","), tipos.midiaSegura(m.url) === m.url, m.alt, m.largura, tipos.midiaSegura(c.avatar) === c.avatar, tipos.midiaSegura(c.autor.foto) === c.autor.foto, c.autor.icone, c.impulsionado_por.foto,
    tipos.midiaSegura(c.citado.avatar) === c.citado.avatar, Object.keys(c.citado.midia[0]).sort().join(","), tipos.midiaSegura(c.citado.autor.foto) === c.citado.autor.foto, c.posts[0].avatar, Object.keys(c.posts[0].midia[0]).sort().join(","), JSON.stringify(sujo) === copia];
}, (r) => JSON.stringify(r) === JSON.stringify([false, 1, "alt,altura,blurhash,largura,tipo,url", true, "foto", 10, true, true, null, null, true, "alt,altura,blurhash,largura,tipo,url", true, null, "alt,altura,blurhash,largura,tipo,url", true]));
espera("assinarCartao: post DAQUI (id em uuid, sem origem) passa como veio, também quando é o citado", () => {
  const daqui = { id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", tipo: "post", midia: [{ id: "m1", alt: "", caminho: "x/y.webp" }], autor: { codinome: "Autora", foto: "x/z.webp" } };
  const c = servidor.assinarCartao({ origem: "fediverso", id: "https://m.teste/1", citado: daqui });
  return [servidor.assinarCartao(daqui) === daqui, c.citado === daqui];
}, (r) => r[0] === true && r[1] === true);

// ── O código de erro que chega à tela ──
espera("ataque: a mensagem crua do banco (nome de tabela, de coluna, de restrição) nunca vai no corpo da resposta: vira 'falha'", () => [
  'relation "interno.rede_fed_recebidos" does not exist', 'column "chave_privada" of relation "rede_fed_atores" does not exist', 'duplicate key value violates unique constraint "fediverso_filtros_pkey"',
  "permission denied for schema interno", "nao_encontrado: tabela interno.x", "Nao_Encontrado", "invalido:POST", "a", "", null, undefined, 42, {}, "x".repeat(200), "invalido:" + "a".repeat(80), "<script>alert(1)</script>", "http_500",
].map((c) => servidor.codigoParaATela(c)), (r) => r.every((x) => x === "falha"));
espera("os códigos da casa passam como são (e a sessão vencida vira 'entre_primeiro')", () => ["nao_encontrado", "invalido:post", "muitos_pedidos", "fediverso_desligado", "instancia_bloqueada", "sem_permissao", "so_na_origem", "invalido:campo_2", "JWT expired"].map((c) => servidor.codigoParaATela(c)),
  (r) => r.join() === "nao_encontrado,invalido:post,muitos_pedidos,fediverso_desligado,instancia_bloqueada,sem_permissao,so_na_origem,invalido:campo_2,entre_primeiro");

// ── A memória curta do que foi lido lá fora ──
{
  let pedidos = 0;
  const buscar = async () => { pedidos++; return { n: pedidos }; };
  servidor.esquecerOLembrado();
  const a = await servidor.lembrar("perfil:https://mau.teste/u/1", 60_000, buscar);
  const b = await servidor.lembrar("perfil:https://mau.teste/u/1", 60_000, buscar);
  const [c, d] = await Promise.all([servidor.lembrar("perfil:https://mau.teste/u/2", 60_000, buscar), servidor.lembrar("perfil:https://mau.teste/u/2", 60_000, buscar)]);
  const vencido = await servidor.lembrar("perfil:https://mau.teste/u/3", -1, buscar).then(() => servidor.lembrar("perfil:https://mau.teste/u/3", 60_000, buscar));
  const lanca = await servidor.lembrar("perfil:https://mau.teste/u/4", 60_000, async () => { throw new Error("rede"); });
  espera("ataque: abrir o mesmo perfil de novo (ou muita gente ao mesmo tempo) não vira um pedido novo lá fora a cada visita", () => [a.n, b.n, c.n === d.n, vencido.n, pedidos, lanca],
    (r) => r[0] === 1 && r[1] === 1 && r[2] === true && r[3] === 4 && r[4] === 4 && r[5] === null);
  servidor.esquecerOLembrado();
}

// ── O endereço de conta ──
espera("contaValida: @nome@servidor (com ou sem o @ da frente, com acct:), servidor em minúsculas", () => [
  tipos.contaValida("@tiao@mastodon.social"), tipos.contaValida("tiao@mastodon.social"), tipos.contaValida("acct:tiao@Mastodon.Social"), tipos.contaValida("  @Porto_1@sub.exemplo.org.br  "), tipos.contaValida("@a.b-c@x.io"),
], (r) => JSON.stringify(r) === JSON.stringify([{ nome: "tiao", servidor: "mastodon.social" }, { nome: "tiao", servidor: "mastodon.social" }, { nome: "tiao", servidor: "mastodon.social" }, { nome: "Porto_1", servidor: "sub.exemplo.org.br" }, { nome: "a.b-c", servidor: "x.io" }]));
espera("contaValida: o que não é endereço do Fediverso dá nulo", () => [
  "", "tiao", "@tiao", "tiao@", "@@mastodon.social", "tiao@localhost", "tiao@mastodon", "tiao@-x.org", "tiao@x..org", "tiao@x.org/caminho", "tiao@x.org:8080", "ti ao@x.org", "tiao@x.org@y.org", "https://mastodon.social/@tiao",
  "tiao@x.org?a=1", "<b>@a@b.org", "tiao@x.o", ".tiao@x.org", "tiao@" + "a".repeat(300) + ".org", null, undefined, 3, {},
].map((x) => tipos.contaValida(x)), (r) => r.every((x) => x === null));
espera("contaDoHandle: o handle das rotas vira @nome@servidor", () => [tipos.contaDoHandle("tiao@mastodon.social"), tipos.contaDoHandle("@tiao@mastodon.social"), tipos.contaDoHandle("tiao"), tipos.contaDoHandle(null)],
  (r) => r[0] === "@tiao@mastodon.social" && r[1] === "@tiao@mastodon.social" && r[2] === null && r[3] === null);

// ── Contagens, origem e endereços ──
espera("contagemVisivel: nulo abaixo de 3; depois, o número", () => [0, 1, 2, 2.9, -5, 3, 3.7, 27, 1000, NaN, Infinity, null, undefined, "5", {}].map((n) => tipos.contagemVisivel(n)),
  (r) => JSON.stringify(r) === JSON.stringify([null, null, null, null, null, 3, 3, 27, 1000, null, null, null, null, null, null]));
espera("eDeFora: só o cartão com origem 'fediverso' e id em texto", () => [
  tipos.eDeFora({ id: "https://mastodon.social/users/tiao/statuses/1", origem: "fediverso" }), tipos.eDeFora(exemplos.cartaoDeExemplo()),
  tipos.eDeFora({ id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" }), tipos.eDeFora({ id: "x", origem: "alumia" }), tipos.eDeFora({ origem: "fediverso" }), tipos.eDeFora({ id: 1, origem: "fediverso" }),
  tipos.eDeFora({ local: "x" }), tipos.eDeFora(null), tipos.eDeFora(undefined), tipos.eDeFora("fediverso"), tipos.eDeFora([]), tipos.eDeFora([{ origem: "fediverso", id: "x" }]),
], (r) => r[0] === true && r[1] === true && r.slice(2).every((x) => x === false));
espera("eContaDaqui e eDaquiNoFio", () => [
  tipos.eContaDaqui({ local: true, handle: "autora" }), tipos.eContaDaqui({ local: { seguindo: "sim" }, handle: "tiao@mastodon.social" }), tipos.eContaDaqui({ local: null }), tipos.eContaDaqui(null),
  tipos.eDaquiNoFio({ local: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" }), tipos.eDaquiNoFio(exemplos.cartaoDeExemplo()), tipos.eDaquiNoFio(null),
], (r) => JSON.stringify(r) === JSON.stringify([true, false, false, false, true, false, false]));
espera("endereços: o perfil e o fio de fora ficam em /<lang>/alumia/fediverso, com o valor codificado", () => [
  tipos.enderecoDoPerfilRemoto("pt", "@tiao@mastodon.social"), tipos.enderecoDoPerfilRemoto("en", "tiao@Mastodon.Social"), tipos.enderecoDoPerfilRemoto("pt", "https://mastodon.social/users/tiao"),
  tipos.enderecoDoPerfilRemoto("pt", "a&b=c#d"), tipos.enderecoDoFioRemoto("zh", "https://mastodon.social/users/tiao/statuses/1?a=1&b=2#c"),
], (r) => r[0] === "/pt/alumia/fediverso?conta=%40tiao%40mastodon.social" && r[1] === "/en/alumia/fediverso?conta=%40tiao%40mastodon.social" && r[2] === "/pt/alumia/fediverso?conta=https%3A%2F%2Fmastodon.social%2Fusers%2Ftiao"
  && r[3] === "/pt/alumia/fediverso?conta=a%26b%3Dc%23d" && r[4] === "/zh/alumia/fediverso?nota=https%3A%2F%2Fmastodon.social%2Fusers%2Ftiao%2Fstatuses%2F1%3Fa%3D1%26b%3D2%23c");
espera("endereços: o que sai volta igual pela URL (a página lê ?conta= e ?nota=)", () => {
  const nota = "https://mastodon.social/users/tiao/statuses/1?a=1&b=2";
  return [new URL(tipos.enderecoDoFioRemoto("pt", nota), "https://x.teste").searchParams.get("nota") === nota, new URL(tipos.enderecoDoPerfilRemoto("pt", "@tiao@mastodon.social"), "https://x.teste").searchParams.get("conta")];
}, (r) => r[0] === true && r[1] === "@tiao@mastodon.social");
espera("categorias de denúncia: as dez do banco (rede_fed_denunciar_remoto)", () => tipos.CATEGORIAS_DE_DENUNCIA.join(","), (r) => r === "menores,ameaca,exposicao,violencia,autolesao,odio,assedio,golpe,spam,outro");

// ── Os dados de exemplo da prévia ──
espera("exemplos: coerentes com a arte (Tião do Morro e Entregador do Porto, de mastodon.social) e no formato de cartão", () => {
  const c = exemplos.cartaoDeExemplo();
  const f = exemplos.fioDeExemplo();
  const p = exemplos.perfilDeExemplo();
  const l = exemplos.linhaDeExemplo();
  return [c.nome_remoto, c.handle_remoto, c.servidor, c.autor.codinome, c.autor.remoto, tipos.eDeFora(c), f.post.id === c.id, f.respostas.length, f.respostas[0].nome_remoto, f.respostas[0].handle_remoto, f.respostas[0].resposta_a === c.id,
    p.handle, p.posts.length >= 1 && p.posts.every(tipos.eDeFora), l.itens.length === 1 && l.proximo === null, tipos.contaDoHandle(c.handle_remoto)];
}, (r) => JSON.stringify(r) === JSON.stringify(["Tião do Morro", "tiao@mastodon.social", "mastodon.social", "Tião do Morro", true, true, true, 1, "Entregador do Porto", "porto@mastodon.social", true, "tiao@mastodon.social", true, true, "@tiao@mastodon.social"]));
espera("exemplos: nenhuma imagem (avatar nulo, sem mídia) e o HTML passa limpo pela lista permitida", () => {
  const todos = [exemplos.cartaoDeExemplo(), exemplos.respostaDeExemplo(), ...exemplos.perfilDeExemplo().posts, ...exemplos.linhaDeExemplo().itens];
  const perfil = exemplos.perfilDeExemplo();
  return [todos.every((c) => c.avatar === null && c.midia.length === 0 && c.impulsionado_por === null), perfil.avatar === null, todos.every((c) => problemas(htmlParaArvore(c.html)).length === 0 && textoDaArvore(htmlParaArvore(c.html)).trim() === c.texto),
    /\.(png|jpe?g|webp|gif|svg|avif)\b/i.test(JSON.stringify([todos, perfil]))];
}, (r) => r[0] && r[1] && r[2] && r[3] === false);

// ── Os textos: seis idiomas, mesmas chaves; pt é o final, os outros cinco são rascunho marcado ──
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const ler = (l) => JSON.parse(readFileSync(new URL(`../i18n/rede/fediverso/${l}.json`, import.meta.url), "utf8"));
const chavesDe = (o, prefixo = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chavesDe(v, `${prefixo}${k}.`) : [`${prefixo}${k}`]));
const folhas = (o) => Object.values(o).flatMap((v) => (v && typeof v === "object" ? folhas(v) : [v]));
/** O arquivo de um idioma sem a marca de rascunho (só as chaves de texto). */
const semMarca = (l) => Object.fromEntries(Object.entries(ler(l)).filter(([k]) => k !== "_rascunho"));
const PT = ler("pt");
const CHAVES = chavesDe(PT).sort();
espera("textos: o português tem todas as seções e chaves combinadas", () => {
  const precisa = {
    cartao: ["doFediverso", "curtir", "curtido", "impulsionar", "impulsionado", "responder", "abrirOriginal", "denunciar", "bloquear", "silenciar", "impulsionadoPor", "avisoDeConteudo", "mostrar", "midiaSensivel", "semAlt", "soSeguidores", "naoListado", "editado", "soNoOriginal"],
    perfil: ["seguir", "seguindo", "pedido", "deixarDeSeguir", "segueVoce", "postsRecentes", "vazio", "bloqueado", "silenciado", "abrirNoServidor", "contaDaqui", "rostoDe"],
    fio: ["titulo", "voltar", "acima", "respostas", "semRespostas", "responderPara", "enviar", "postDaqui", "respostaPublica", "enviada", "semResposta", "semRespostaSeguidores", "contador", "respostasDeFora", "respostasDeForaN", "maisRespostas", "buscarLa", "buscarLaAjuda"],
    denuncia: ["titulo", "categorias", "texto", "encaminhar", "enviar", "enviada", "jaEnviada", "fechar", "naoEncaminhada"],
    avisos: ["seguidor", "resposta", "mencao", "curtida", "impulso", "alguem"],
    comum: ["carregando", "tentarDeNovo"],
    ajuste: ["endereco", "descoberta", "descobertaAjuda", "desligar"],
    erros: ["entre_primeiro", "consentimento", "fediverso_desligado", "instancia_bloqueada", "nao_encontrado", "sem_permissao", "muitos_pedidos", "sem_conexao", "falha"],
    busca: ["titulo", "dica", "procurar", "naoAchou"],
  };
  const faltam = Object.entries(precisa).flatMap(([secao, chaves]) => chaves.filter((k) => !(PT[secao] && k in PT[secao])).map((k) => `${secao}.${k}`));
  for (const c of tipos.CATEGORIAS_DE_DENUNCIA) if (typeof PT.denuncia?.categorias?.[c] !== "string") faltam.push(`denuncia.categorias.${c}`);
  for (const a of ["seguidor", "resposta", "mencao", "curtida", "impulso"]) for (const q of ["um", "varios"]) if (typeof PT.avisos?.[a]?.[q] !== "string") faltam.push(`avisos.${a}.${q}`);
  return faltam;
}, (r) => r.length === 0);
espera("textos: pt sem '_rascunho'; os outros cinco com '_rascunho': true na raiz", () => IDIOMAS.map((l) => ler(l)._rascunho), (r) => r[0] === undefined && r.slice(1).every((x) => x === true));
espera("textos: os seis idiomas têm exatamente as mesmas chaves", () => IDIOMAS.slice(1).flatMap((l) => {
  const chaves = chavesDe(semMarca(l)).sort();
  return [...CHAVES.filter((k) => !chaves.includes(k)).map((k) => `${l} sem ${k}`), ...chaves.filter((k) => !CHAVES.includes(k)).map((k) => `${l} a mais ${k}`)];
}), (r) => r.length === 0);
espera("textos: nenhum texto vazio e os mesmos {campos} em todos os idiomas", () => IDIOMAS.flatMap((l) => {
  const t = semMarca(l);
  const pega = (o, caminho) => caminho.split(".").reduce((x, k) => x?.[k], o);
  return CHAVES.filter((k) => {
    const meu = pega(t, k);
    const campos = (x) => (String(x).match(/\{\w+\}/g) ?? []).sort().join(",");
    return typeof meu !== "string" || !meu.trim() || campos(meu) !== campos(pega(PT, k));
  }).map((k) => `${l}: ${k}`);
}), (r) => r.length === 0);
espera("textos: os campos combinados estão no português", () => [PT.cartao.doFediverso, PT.cartao.impulsionadoPor, PT.fio.responderPara, PT.denuncia.enviada, PT.denuncia.encaminhar],
  (r) => r[0] === "do Fediverso · {servidor}" && r[1] === "{nome} impulsionou" && r[2] === "Responder para {conta}" && r[3] === "Denúncia registrada. Protocolo {protocolo}" && r[4] === "Avisar também o servidor de origem");
espera("textos: curtida e impulso nunca dizem quem foi (sem {nome}); os outros avisos dizem", () => IDIOMAS.flatMap((l) => {
  const a = ler(l).avisos;
  return [...["curtida", "impulso"].flatMap((k) => [a[k].um, a[k].varios]).filter((v) => /\{nome\}/.test(v)), ...["seguidor", "resposta", "mencao"].flatMap((k) => [a[k].um, a[k].varios]).filter((v) => !/\{nome\}/.test(v))].map((v) => `${l}: ${v}`);
}), (r) => r.length === 0);
espera("textos: nenhum texto fixo em português sobrou nas peças (tudo vem do i18n)", () => ["AvisoDeFora", "BuscaDeFora", "CartaoRemoto", "DenunciarDeFora", "FioRemoto", "PerfilRemoto", "ResponderDeFora", "RespostasDeFora"].flatMap((peca) => {
  const fonte = readFileSync(new URL(`../components/rede/fediverso/${peca}.tsx`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  return (fonte.match(/\b(FIXOS|FRASES|SO_NO_ORIGINAL|FECHAR|NAO_ENCAMINHADA|TITULO|TITULO_COM_NUMERO|MAIS|ALGUEM)\b|"[^"\n]*(Carregando|Tentar de novo|do Fediverso|servidor de origem|Resposta enviada|outros servidores|sai pública|abra no original|Fechar|Mais respostas)[^"\n]*"/g) ?? []).map((x) => `${peca}: ${x}`);
}), (r) => r.length === 0);
espera("textos: nenhuma palavra proibida na interface, em nenhum idioma", () => IDIOMAS.flatMap((l) => folhas(ler(l)).filter((v) => typeof v === "string" && /universidade|diploma|universit|университет|диплом|大学|文凭/i.test(v)).map((v) => `${l}: ${v}`)), (r) => r.length === 0);

// O carregador (com o React instalado; sem ele, as conferências acima já valeram).
try {
  const textos = await import("../lib/rede/fediverso/tela/textos.ts");
  const [pt, ru, xx] = await Promise.all([textos.carregarTextosDoFediverso("pt"), textos.carregarTextosDoFediverso("ru"), textos.carregarTextosDoFediverso("xx")]);
  espera("carregador: traz o idioma pedido, cai no português e guarda em memória", () => [pt.cartao.curtir, ru.cartao.curtir, xx === pt, textos.textoDoErroDeFora(pt, "nao_encontrado"), textos.textoDoErroDeFora(pt, "invalido:post"), textos.textoDoErroDeFora(pt, "toString"), textos.textoDoErroDeFora(pt, null)],
    (r) => r[0] === "Curtir" && r[1] === "Нравится" && r[2] === true && r[3] === PT.erros.nao_encontrado && r[4] === PT.erros.falha && r[5] === PT.erros.falha && r[6] === PT.erros.falha);
} catch (erro) {
  if (erro?.code !== "ERR_MODULE_NOT_FOUND") falhas.push(`carregador de textos: ${erro.message}`);
  else console.log("(carregador de textos não conferido: o React não está instalado)");
}

// ── A linha mista: posts daqui e cartões de fora juntos por data (lib/rede/fediverso/tela/linha.ts) ──
{
  const linha = await import("../lib/rede/fediverso/tela/linha.ts");
  const { misturarDeFora, maisDeFora, estadoInicialDeFora, chaveDoItem, limiteDaPagina, podePedirDeFora } = linha;
  const hora = (h, m = 0) => `2026-11-10T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
  const daqui = (id, h, m) => ({ id, criado_em: hora(h, m) });
  const fora = (nota, h, m, chave) => ({ ...exemplos.cartaoDeExemplo(), id: `https://mastodon.social/notas/${nota}`, criado_em: hora(h, m), ...(chave ? { chave } : {}) });
  const ids = (lista) => lista.map((x) => (tipos.eDeFora(x) ? `f${x.id.split("/").pop()}` : x.id)).join(",");
  /** Uma rota de mentira: páginas prontas, na ordem; conta os pedidos e guarda os cursores recebidos. */
  const rota = (paginas) => {
    const pedidos = [];
    return { pedidos, pedir: async (cursor) => { pedidos.push(cursor); return paginas[pedidos.length - 1] ?? { ok: true, dado: { itens: [], proximo: null } }; } };
  };
  const pagina = (itens, proximo = null) => ({ ok: true, dado: { itens, proximo } });
  const sim = { logado: true, ligado: true, previa: false };
  const assinc = async (nome, calcular, conferir) => {
    let valor;
    try {
      valor = await calcular();
    } catch (erro) {
      falhas.push(`${nome}: ${erro.message}`);
      return;
    }
    espera(nome, () => valor, conferir);
  };

  espera("linha mista: junta por data, do mais novo ao mais antigo, sem mexer nas listas", () => {
    const l = [daqui("a", 12), daqui("b", 10)];
    const f = [fora("1", 11), fora("2", 9)];
    const copia = JSON.stringify([l, f]);
    return [ids(misturarDeFora(l, f)), JSON.stringify([l, f]) === copia];
  }, (r) => r[0] === "a,f1,b,f2" && r[1] === true);
  espera("linha mista: datas iguais ficam na ordem de entrada, os daqui antes (estável)", () => ids(misturarDeFora([daqui("a", 10), daqui("b", 10)], [fora("1", 10), fora("2", 10)])), (r) => r === "a,b,f1,f2");
  espera("linha mista: fuso e fração de segundo diferentes comparam pelo instante, não pelo texto", () =>
    ids(misturarDeFora([{ id: "a", criado_em: "2026-11-10T09:00:00-03:00" }], [{ ...fora("1", 11), criado_em: "2026-11-10T11:59:59.123456+00:00" }, fora("2", 12, 1)])), (r) => r === "f2,a,f1");
  espera("linha mista: a nota que vem como original e como impulso fica uma vez, na ocorrência mais recente", () => {
    const m = misturarDeFora([daqui("a", 10)], [fora("1", 8), fora("1", 11, 0, "https://mastodon.social/notas/1#i1"), fora("1", 9, 0, "https://mastodon.social/notas/1#i2")]);
    return [ids(m), chaveDoItem(m[0]), chaveDoItem(m[1])];
  }, (r) => r[0] === "f1,a" && r[1] === "https://mastodon.social/notas/1#i1" && r[2] === "a");
  espera("linha mista: a mesma chave em duas páginas e o post daqui repetido aparecem uma vez", () => ids(misturarDeFora([daqui("a", 10), daqui("a", 10)], [fora("1", 9), fora("1", 9)])), (r) => r === "a,f1");
  espera("linha mista: listas vazias, data inválida (vai para o fim) e o que não é cartão de fora (fica de fora)", () => [
    misturarDeFora([], []).length,
    ids(misturarDeFora([daqui("a", 10)], [])),
    ids(misturarDeFora([], [fora("1", 10)])),
    ids(misturarDeFora([{ id: "x", criado_em: "ontem" }, daqui("a", 10)], [fora("1", 9), { id: "https://exemplo.org/1", criado_em: hora(23) }, null])),
  ], (r) => r[0] === 0 && r[1] === "a" && r[2] === "f1" && r[3] === "a,f1,x");
  espera("linha mista: a chave do item é a `chave` da linha de fora, senão o id", () => [chaveDoItem({ id: "a", criado_em: hora(1) }), chaveDoItem({ id: "n", criado_em: hora(1), chave: "n#1" }), chaveDoItem({ id: "n", criado_em: hora(1), chave: "" })],
    (r) => r[0] === "a" && r[1] === "n#1" && r[2] === "n");
  espera("linha mista: o limite da página é o post mais antigo, só enquanto a linha daqui tem mais", () => [limiteDaPagina([daqui("a", 12), daqui("b", 10)], "cursor"), limiteDaPagina([daqui("a", 12)], null), limiteDaPagina([], "cursor")],
    (r) => r[0] === hora(10) && r[1] === null && r[2] === null);
  espera("linha mista: só pede com a flag ligada, com sessão e fora da prévia", () => [podePedirDeFora(true, true, false), podePedirDeFora(false, true, false), podePedirDeFora(true, false, false), podePedirDeFora(true, true, true)],
    (r) => r.join() === "true,false,false,false");

  await assinc("mais de fora: flag desligada ou sem sessão não pedem nada e devolvem vazio", async () => {
    const r = rota([pagina([fora("1", 10)])]);
    const e = estadoInicialDeFora();
    const a = await maisDeFora(e, { ...sim, ligado: false, ate: null, pedir: r.pedir });
    const b = await maisDeFora(e, { ...sim, logado: false, ate: null, pedir: r.pedir });
    return [r.pedidos.length, a.itens.length + b.itens.length, a.temMais || b.temMais, a.estado === e];
  }, (r) => r[0] === 0 && r[1] === 0 && r[2] === false && r[3] === true);
  await assinc("mais de fora na prévia: nenhum pedido (com ou sem flag, com ou sem sessão); sai UMA vez o post de exemplo da arte", async () => {
    const r = rota([pagina([fora("1", 10)])]);
    const e = estadoInicialDeFora();
    const a = await maisDeFora(e, { logado: false, ligado: false, previa: true, ate: hora(10), pedir: r.pedir });
    const b = await maisDeFora(a.estado, { ...sim, previa: true, ate: null, pedir: r.pedir });
    const c = await maisDeFora(e, { ...sim, previa: true, ate: null, pedir: r.pedir });
    return [r.pedidos.length, a.itens.length, a.itens[0]?.nome_remoto, a.itens[0]?.handle_remoto, a.temMais, a.estado.esgotado, b.itens.length, b.temMais, c.itens.length, JSON.stringify(e) === JSON.stringify(estadoInicialDeFora()),
      ids(misturarDeFora([], [...a.itens, ...b.itens, ...c.itens])).split(",").length];
  }, (r) => JSON.stringify(r) === JSON.stringify([0, 1, "Tião do Morro", "tiao@mastodon.social", false, true, 0, false, 1, true, 1]));
  espera("uma regra só para gente de fora aparecer: na prévia ou com a flag", () => [linha.deForaVale(true, false), linha.deForaVale(false, true), linha.deForaVale(true, true), linha.deForaVale(false, false)], (r) => r.join() === "true,true,true,false");
  await assinc("mais de fora: solta só o que é mais novo que a página daqui e guarda o resto, sem pedir de novo à toa", async () => {
    const r = rota([pagina([fora("1", 12), fora("2", 9), fora("3", 7)], "c1"), pagina([fora("4", 5)], null)]);
    const p1 = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: hora(10), pedir: r.pedir });
    // A página seguinte daqui vai até as 8h: o "2" da espera sai sem pedido novo (o "3", mais antigo, já garante a ordem).
    const p2 = await maisDeFora(p1.estado, { ...sim, ate: hora(8), pedir: r.pedir });
    // A linha daqui acabou: sai o resto da espera, ainda sem pedir; só a chamada seguinte busca a última página.
    const p3 = await maisDeFora(p2.estado, { ...sim, ate: null, pedir: r.pedir });
    const antes = r.pedidos.length;
    const p4 = await maisDeFora(p3.estado, { ...sim, ate: null, pedir: r.pedir });
    return [ids(p1.itens), ids(p1.estado.espera), p1.temMais, ids(p2.itens), ids(p3.itens), antes, p3.temMais, ids(p4.itens), r.pedidos, p4.temMais, p4.estado.esgotado];
  }, (r) => r[0] === "f1" && r[1] === "f2,f3" && r[2] === true && r[3] === "f2" && r[4] === "f3" && r[5] === 1 && r[6] === true && r[7] === "f4" && JSON.stringify(r[8]) === '[null,"c1"]' && r[9] === false && r[10] === true);
  await assinc("mais de fora: pede a página seguinte quando a espera não alcança o limite, guardando o cursor", async () => {
    const r = rota([pagina([fora("1", 12), fora("2", 11)], "c1"), pagina([fora("3", 10, 30), fora("4", 6)], "c2")]);
    const p = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: hora(10), pedir: r.pedir });
    return [ids(p.itens), ids(p.estado.espera), p.estado.cursor, r.pedidos, p.temMais];
  }, (r) => r[0] === "f1,f2,f3" && r[1] === "f4" && r[2] === "c2" && JSON.stringify(r[3]) === '[null,"c1"]' && r[4] === true);
  await assinc("mais de fora: data igual à do limite entra (não fica presa na espera)", async () => {
    const r = rota([pagina([fora("1", 10), fora("2", 9)], null)]);
    const p = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: hora(10), pedir: r.pedir });
    return [ids(p.itens), ids(p.estado.espera)];
  }, (r) => r[0] === "f1" && r[1] === "f2");
  await assinc("mais de fora: o lado de fora esgotado não pede mais; o daqui continua sozinho", async () => {
    const r = rota([pagina([fora("1", 12)], null)]);
    const p1 = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: hora(10), pedir: r.pedir });
    const p2 = await maisDeFora(p1.estado, { ...sim, ate: hora(8), pedir: r.pedir });
    const p3 = await maisDeFora(p2.estado, { ...sim, ate: null, pedir: r.pedir });
    return [ids(p1.itens), p1.temMais, p2.itens.length, p3.itens.length, r.pedidos.length, p3.temMais];
  }, (r) => r[0] === "f1" && r[1] === false && r[2] === 0 && r[3] === 0 && r[4] === 1 && r[5] === false);
  await assinc("mais de fora: o lado daqui esgotado (ou vazio) traz uma página de fora por vez", async () => {
    const r = rota([pagina([fora("1", 12), fora("2", 11)], "c1"), pagina([fora("3", 10)], null)]);
    const p1 = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: limiteDaPagina([], null), pedir: r.pedir });
    const p2 = await maisDeFora(p1.estado, { ...sim, ate: null, pedir: r.pedir });
    return [ids(p1.itens), p1.temMais, ids(p2.itens), p2.temMais, ids(misturarDeFora([], [...p1.itens, ...p2.itens]))];
  }, (r) => r[0] === "f1,f2" && r[1] === true && r[2] === "f3" && r[3] === false && r[4] === "f1,f2,f3");
  await assinc("mais de fora: teto de pedidos por chamada (uma página daqui que cobre muito tempo não vira rajada)", async () => {
    const r = rota([pagina([fora("1", 23)], "c1"), pagina([fora("2", 22)], "c2"), pagina([fora("3", 21)], "c3"), pagina([fora("4", 20)], "c4")]);
    const p = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: hora(1), pedir: r.pedir, maximoDePedidos: 2 });
    return [ids(p.itens), r.pedidos.length, p.temMais, p.estado.cursor];
  }, (r) => r[0] === "f1,f2" && r[1] === 2 && r[2] === true && r[3] === "c2");
  await assinc("mais de fora: erro (ou rota que lança) não perde o cursor nem a espera, e dá para tentar de novo", async () => {
    const r = rota([pagina([fora("1", 12)], "c1"), { ok: false, erro: "muitos_pedidos" }, pagina([fora("2", 11)], null)]);
    const p1 = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: hora(12), pedir: r.pedir });
    const p2 = await maisDeFora(p1.estado, { ...sim, ate: hora(10), pedir: r.pedir });
    const lanca = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: null, pedir: async () => { throw new Error("rede"); } });
    return [ids(p1.itens), p1.erro, p1.estado.cursor, p1.temMais, ids(p2.itens), p2.erro, lanca.erro, lanca.temMais];
  }, (r) => r[0] === "f1" && r[1] === "muitos_pedidos" && r[2] === "c1" && r[3] === true && r[4] === "f2" && r[5] === null && r[6] === "falha" && r[7] === true);
  await assinc("mais de fora: cursor que não anda e resposta torta encerram, sem laço", async () => {
    const r = rota([pagina([fora("1", 12)], "c1"), pagina([fora("2", 11)], "c1"), pagina([fora("3", 10)], "c1")]);
    const p = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: hora(1), pedir: r.pedir, maximoDePedidos: 9 });
    const torta = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: null, pedir: async () => ({ ok: true, dado: { itens: "x", proximo: 7 } }) });
    const estranho = await maisDeFora(estadoInicialDeFora(), { ...sim, ate: null, pedir: async () => pagina([{ id: "p", criado_em: hora(1) }, fora("1", 2)], null) });
    return [r.pedidos.length, p.estado.esgotado, torta.itens.length, torta.estado.esgotado, ids(estranho.itens)];
  }, (r) => r[0] === 2 && r[1] === true && r[2] === 0 && r[3] === true && r[4] === "f1");
  await assinc("mais de fora: o estado recebido não é alterado", async () => {
    const e = { cursor: "c0", esgotado: false, espera: [fora("9", 12)] };
    const copia = JSON.stringify(e);
    await maisDeFora(e, { ...sim, ate: null, pedir: rota([pagina([fora("1", 11)], null)]).pedir });
    return JSON.stringify(e) === copia;
  }, (r) => r === true);
}

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
