// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as telas novas da F3 (PLANO-ALUMIA §8 F3; pranchas celular-comunidade, celular-conversa-fediverso e computador-inicio):
// as contas puras (total só a partir de 3, reações da lista fechada, "ajudou a autora" pelo pronome, servidor do Fediverso, cor da
// comunidade, "N posts esta semana", "Comunidades ativas"); os dados de exemplo batem com as pranchas e não carregam lista de
// pessoas; as telas só trocam com a Alumia nova ligada; a folha de estilo só vale dentro de [data-al="2"]; os textos existem nos 6
// idiomas com as mesmas chaves; a banca de conferência só existe na prévia.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-f3.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generoDoAjudou, MINIMO_AGREGADO, montarArvore, REACOES, reacaoOk, reacoesParaMostrar, servidorDaResposta, tempoCurto, totalVisivel,
  trilhaDoCaminho,
} from "../lib/rede/tipos-conversa.ts";
import { comunidadesAtivas, corDaComunidadeNova, postsDaSemana } from "../lib/rede/tipos-comunidades.ts";
import { arvoreDeExemplo, listaDeExemplo, paginaDeExemplo, postsDeExemplo, previaDaAlumiaLigada } from "../lib/rede/conversa/exemplos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 300)}, esperava ${JSON.stringify(esperado)?.slice(0, 300)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ── Contagens: só agregadas e a partir de 3 (PLANO-ALUMIA §6.1) ──
igual("mínimo agregado é 3", MINIMO_AGREGADO, 3);
igual("totalVisivel: 0, 1, 2 viram 'poucas'", [0, 1, 2].map(totalVisivel), [null, null, null]);
igual("totalVisivel: 3 e 1204 aparecem", [totalVisivel(3), totalVisivel(1204)], [3, 1204]);
igual("totalVisivel: nulo, NaN, fração e texto viram 'poucas'", [totalVisivel(null), totalVisivel(NaN), totalVisivel(2.5), totalVisivel("9")], [null, null, null, null]);
igual("postsDaSemana: 2 vira 'poucos', 214 aparece", [postsDaSemana(2), postsDaSemana(214), postsDaSemana(undefined)], [null, 214, null]);

// ── Reações: lista fechada, total por emoji, nunca quem ──
igual("8 reações na lista fechada", REACOES.length, 8);
ok("emoji fora da lista é recusado", !reacaoOk("💩") && !reacaoOk("abc") && !reacaoOk(""));
ok("emoji da lista é aceito", REACOES.every((r) => reacaoOk(r.emoji)));
const mostradas = reacoesParaMostrar([
  { emoji: "📚", total: 11, minha: true },
  { emoji: "💩", total: 99, minha: false },
  { emoji: "✊", total: 24, minha: false },
  { emoji: "🤔", total: 2, minha: false },
  { emoji: "🔥", total: 0, minha: false },
]);
igual("reações: na ordem da lista, sem as de fora, sem as zeradas, 2 vira 'poucas'", mostradas.map((r) => [r.emoji, r.total, r.minha]), [["✊", 24, false], ["🤔", null, false], ["📚", 11, true]]);
ok("reações mostradas não trazem nenhum campo de pessoa", mostradas.every((r) => Object.keys(r).sort().join() === "emoji,minha,nome,total"));
igual("sem reações, nada", reacoesParaMostrar(undefined), []);

// ── "ajudou a autora": pelo pronome escrito, nunca por palpite ──
igual("pronomes → selo", ["ela/dela", "ele/dele", "she/her", "elu/delu", "", null].map(generoDoAjudou), ["a", "o", "a", "quem", "quem", "quem"]);

// ── Fediverso: só o nome do servidor ──
igual("servidor pelo @", servidorDaResposta({ servidor: null, autor: { handle: "porto@mastodon.social" } }), "mastodon.social");
igual("servidor que veio do banco vale", servidorDaResposta({ servidor: "lemmy.ml", autor: { handle: "x" } }), "lemmy.ml");
igual("quem é daqui não tem servidor", servidorDaResposta({ servidor: null, autor: { handle: "liaquilombo" } }), null);

// ── Cor e lista ──
igual("cores das pranchas viram 1–5", ["#1fc2b5", "#ff5c8a", "#ff8a1f", "#5b8cff", "#a27bff"].map((c) => corDaComunidadeNova("x", c)), [1, 2, 3, 4, 5]);
ok("sem cor, a mesma comunidade tem sempre a mesma cor", corDaComunidadeNova("passe-livre-sp") === corDaComunidadeNova("passe-livre-sp", ""));
const ativas = comunidadesAtivas(listaDeExemplo());
igual("Comunidades ativas da prancha, na ordem dos posts", ativas.map((c) => [c.nome, c.posts_7d]), [
  ["Passe Livre SP", 214], ["Estudantes UFPE", 168], ["Moradia Zona Leste", 121], ["Marxismo · aula em debate", 97],
]);
ok("amostra de visitante fica de fora", comunidadesAtivas([{ slug: "a", nome: "A", amostra: true, posts_7d: 99 }]).length === 0);
igual("trilha bonita", trilhaDoCaminho("marxismo/o-que-e-mais-valia"), "Marxismo");
ok("tempo curto: 20 min", /20/.test(tempoCurto(new Date(Date.now() - 20 * 60000).toISOString(), "pt")));

// ── Exemplos = pranchas, sem lista de pessoas ──
const pagina = paginaDeExemplo("passe-livre-sp");
igual("comunidade da prancha", [pagina.comunidade.nome, pagina.comunidade.regras.length, pagina.posts_7d, pagina.fixados[0].titulo], ["Passe Livre SP", 4, 214, "Sexta tem ato: como vai funcionar"]);
igual("posts da prancha", postsDeExemplo("passe-livre-sp").map((p) => [p.autor.codinome, p.respostas]), [["Bruno Catraca", 18], ["Mandata Popular", 52]]);
const arv = arvoreDeExemplo("00000000-0000-4000-8000-0000000000c1");
const nos = montarArvore(arv.post.id, arv.respostas);
igual("fio da prancha: Bruno (com a Lia dentro) e o Porto", nos.map((n) => [n.post.autor.codinome, n.filhos.map((f) => f.post.autor.codinome)]), [["Bruno Catraca", ["Lia Quilombo"]], ["Entregador do Porto", []]]);
igual("a que ajudou é a do Bruno", arv.post.aceita, arv.respostas[0].id);
igual("31 respostas na barra", arv.post.na_conversa, 31);
const textoDosExemplos = JSON.stringify([pagina, postsDeExemplo("x"), arv, listaDeExemplo()]);
ok("exemplos não têm lista de quem reagiu/confirmou/votou", !/"(quem|pessoas|reagiram|votantes|membros_lista|ip|lat|lng|gps)"\s*:/.test(textoDosExemplos));
ok("prévia desligada sem a variável", (delete process.env.NEXT_PUBLIC_ALUMIA_PREVIA, previaDaAlumiaLigada() === false));

// ── As telas só trocam com a Alumia nova ──
const pag = ler("components/rede/comunidades/PaginaDaComunidade.tsx");
ok("a página da comunidade escolhe pela Alumia nova", /const nova = useAlumia2\(\);\s*return nova \? <PaginaDaComunidadeAlumia/.test(pag));
ok("a página de hoje continua inteira", pag.includes("function PaginaDaComunidadeDeHoje("));
const conv = ler("components/rede/conversa/TelaDaConversa.tsx");
ok("a conversa escolhe pela Alumia nova", /const nova = useAlumia2\(\);\s*return nova \? <TelaDaConversaAlumia/.test(conv));
ok("a conversa de hoje continua inteira", conv.includes("function TelaDaConversaDeHoje("));
ok("useAlumia2 lê o [data-al=\"2\"] do layout", /querySelector\('\[data-al="2"\]'\)/.test(ler("components/rede/conversa/base3.tsx")));
const enc = ler("components/rede/conversa/encaixe.tsx");
ok("o encaixe pendura a busca e Comunidades ativas na coluna", /colunaDireita: \[BuscaDaColuna, ComunidadesAtivas\]/.test(enc));

// ── A folha só vale dentro de [data-al="2"] ──
const css = ler("components/rede/conversa/alumia3.css").replace(/\/\*[\s\S]*?\*\//g, "");
const seletores = [];
for (const m of css.matchAll(/([^{}]+)\{/g)) {
  const sel = m[1].trim();
  if (sel.startsWith("@media") || sel.startsWith("@supports")) continue;
  // separa nas vírgulas de fora dos parênteses (":is(a, b)" é um seletor só)
  let fundo = 0;
  let atual = "";
  for (const ch of sel) {
    if (ch === "(") fundo++;
    if (ch === ")") fundo--;
    if (ch === "," && fundo === 0) {
      seletores.push(atual.trim());
      atual = "";
    }
    else atual += ch;
  }
  seletores.push(atual.trim());
}
const fora = seletores.filter((sel) => !/^(:root(\[[^\]]+\]|:is\([^)]*\))\s+)?\[data-al="2"\]/.test(sel));
ok(`todos os ${seletores.length} seletores da folha estão dentro de [data-al="2"] (fora: ${fora.slice(0, 3).join(" | ")})`, fora.length === 0 && seletores.length > 50);
ok("cores só por token (nenhum hex solto fora da capa e do contraste)", !/color:\s*#(?!0f0e0d|f3efe6|000\b|fff\b)/i.test(css));
for (const f of ["descoberta/Buscar", "descoberta/Explorar", "descoberta/Tag", "descoberta/ListaOrdenada", "avisos/Tela", "alumia/Salvos", "comunidades/Lista", "comunidades/TelaAula", "comunidades/Propor"]) {
  const src = ler(`components/rede/${f}.tsx`);
  ok(`${f}: ganha a classe al3-tela e a folha`, src.includes("al3-tela") && src.includes('import "../conversa/alumia3.css";'));
}

// ── Textos nos 6 idiomas, mesmas chaves ──
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort();
const pt = JSON.parse(ler("i18n/rede/conversa/alumia/pt.json"));
for (const l of ["en", "es", "fr", "ru", "zh"]) {
  const outro = JSON.parse(ler(`i18n/rede/conversa/alumia/${l}.json`));
  igual(`textos ${l}: mesmas chaves do pt`, chaves(outro).filter((k) => k !== "_rascunho"), chaves(pt));
}
const usados = new Set();
for (const f of ["components/rede/conversa/base3.tsx", "components/rede/conversa/TelaDaConversaAlumia.tsx", "components/rede/comunidades/PaginaDaComunidadeAlumia.tsx", "components/rede/comunidades/ComunidadesAtivas.tsx"]) {
  for (const m of ler(f).matchAll(/\bt!?\.((?:comum|comunidade|conversa|reacoes|ativas|busca)\.[a-zA-Z]+)/g)) usados.add(m[1]);
}
const todas = new Set(chaves(pt));
const faltam = [...usados].filter((k) => !todas.has(k) && !k.startsWith("reacoes.nomes"));
igual("toda chave usada nas telas existe no pt", faltam, []);

// ── A banca só existe na prévia ──
const banca = ler("app/[lang]/alumia/comunidades/prancha-f3/page.tsx");
ok("a banca responde 404 fora da prévia e sem a Alumia nova", /if \(!previaDaAlumiaLigada\(\) \|\| !alumia2Ligada\(\)\) notFound\(\);/.test(banca));
ok("a banca não é indexada", /index: false/.test(banca));

console.log(`testar-alumia-f3: ${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.error(`  FALHOU: ${f}`);
  process.exit(1);
}
