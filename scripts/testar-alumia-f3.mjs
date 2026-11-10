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
import { atosDeExemplo } from "../lib/rede/atos/exemplos.ts";
import { COMUNIDADES_DE_EXEMPLO, postsDeExemplo as postsDoInicio } from "../lib/rede/publicar/exemplos-alumia2.ts";

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
igual("trilha do caminho gravado", trilhaDoCaminho("/trilhas/direito-a-cidade/david-harvey-a-cidade-como-negocio"), "Direito a cidade");
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
// A "Conversa do ato · 48" leva à conversa do próprio ato (mesmo id, 48 respostas), nunca à da Lia; id desconhecido: nada.
const PASSE = "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d01";
const doAto = arvoreDeExemplo(PASSE);
igual("conversa do ato: o post do chamado com o número do cartão", [doAto?.post.id, doAto?.post.tipo, doAto?.post.titulo, doAto?.post.na_conversa], [PASSE, "chamado", "Passe Livre Já", 48]);
ok("conversa do ato não é a da Lia", doAto && doAto.post.autor.codinome !== "Lia Quilombo" && doAto.respostas.every((r) => r.raiz === PASSE));
for (const { ato } of atosDeExemplo()) ok(`todo ato tem a sua conversa (${ato.titulo})`, arvoreDeExemplo(ato.id)?.post.na_conversa === ato.respostas);
igual("conversa que não existe: nula", arvoreDeExemplo("00000000-0000-4000-8000-00000000ffff"), null);
ok("post de comunidade abre a própria conversa", arvoreDeExemplo(postsDeExemplo("passe-livre-sp")[0].id)?.post.texto === postsDeExemplo("passe-livre-sp")[0].texto);
// Um endereço só por comunidade: o que os exemplos do Início e dos atos apontam existe na prévia.
const slugs = new Set(listaDeExemplo().map((c) => c.slug));
const apontados = [...Object.keys(COMUNIDADES_DE_EXEMPLO), ...postsDoInicio().map((p) => p.comunidade).filter(Boolean), ...atosDeExemplo().map((a) => a.ato.comunidade?.slug).filter(Boolean)];
igual("toda comunidade dos exemplos tem página", apontados.filter((c) => !slugs.has(c) || !paginaDeExemplo(c)), []);
igual("comunidade que não existe: nula", paginaDeExemplo("marxismo-aula"), null);
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
const lay = ler("app/[lang]/alumia/layout.tsx");
ok("useAlumia2 vem do layout por contexto, só com a Alumia nova", /if \(!alumia2Ligada\(\)\) return moldura;/.test(lay) && /<ComAlumia2>\{moldura\}<\/ComAlumia2>/.test(lay));
ok("sem o provedor, useAlumia2 é false", /createContext\(false\)/.test(ler("components/rede/conversa/Alumia2.tsx")));
const enc = ler("components/rede/conversa/encaixe.tsx");
// A busca da coluna saiu (a casca já tem a busca no topo da coluna: duas buscas iguais lado a lado confundiam).
ok("o encaixe pendura Comunidades ativas na coluna (sem a segunda busca)", /colunaDireita: \[ComunidadesAtivas\]/.test(enc));

// ── Correções da revisão: sem lista de quem modera, sem contornar bloqueio, denúncia no post compacto, sem enfeite quebrado ──
const pagNova = ler("components/rede/comunidades/PaginaDaComunidadeAlumia.tsx");
ok("a aba Sobre não lista quem modera (só quantas, a partir de 3)", !/moderacao\.join|moderacao\.map/.test(pagNova) && /totalVisivel\(comunidade\.moderacao\.length\)/.test(pagNova));
ok("o '…' da comunidade é disclosure, sem papéis de menu", !/role="menu(item)?"/.test(pagNova) && /aria-controls=\{idDoMenu\}/.test(pagNova));
ok("Entrar não usa disabled: aria-disabled e motivo visível", !/disabled=\{ocupado \|\| !podeEntrar/.test(pagNova) && /aria-describedby=\{motivo \? idDoMotivo/.test(pagNova));
ok("as quatro abas têm painel (aria-controls não aponta para o vazio)", ["posts", "atos", "aulas", "sobre"].every((c) => pagNova.includes(`id="al3-painel-${c}"`)));
const telaNova = ler("components/rede/conversa/TelaDaConversaAlumia.tsx");
ok("'Enviar assim mesmo' só depois de alerta, nunca de bloqueio", /\{!conferir\.bloqueia && <button/.test(telaNova) && /if \(mesmoAssim && conferir\?\.bloqueia !== false\) return;/.test(telaNova));
ok("o texto da resposta fica fora do botão", !/role="button"/.test(telaNova));
// As reações voltaram com o back-end da F3 (20261109-alumia-f3.sql): só quando o banco manda post.reacoes, pela função de verdade.
const clienteConversa = ler("lib/rede/cliente-conversa.ts");
ok("reações com emoji só quando o banco manda (post.reacoes) e pela função de verdade", /\{post\.reacoes && <Reacoes/.test(telaNova) && /"rede_alumia_reagir"/.test(clienteConversa));
ok("'ajudou' pela função nova (só a autora marca), nunca pela de hoje", /conversa\.ajudou\(/.test(telaNova) && !/conversa\.aceitar\(/.test(telaNova) && /dado\.pode_ajudou === true/.test(telaNova));
ok("as telas novas chamam as funções da F3", /"rede_alumia_conversa"/.test(clienteConversa) && /"rede_alumia_com_pagina"/.test(ler("lib/rede/cliente-comunidades.ts")) && /"rede_alumia_ativas"/.test(ler("lib/rede/cliente-comunidades.ts")));
ok("a regra de 'ajudou' não diz mais que a moderação marca", !/moderação\)/.test(ler("i18n/rede/conversa/alumia/pt.json")));
ok("o post compacto tem Denunciar/Silenciar/Moderar", /<AcoesDeCuidado post=\{post\}/.test(ler("components/rede/conversa/base3.tsx")));

// ── A folha só vale dentro de [data-al="2"] ──
// Sem os comentários e sem os @keyframes (o "from"/"to"/"50%" de dentro não é seletor de elemento).
const css = ler("components/rede/conversa/alumia3.css")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
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
// ":root:has([data-al=\"2\"] …) …" também vale: só casa quando a tela nova está na página (os flutuantes sobem por causa dela).
const fora = seletores.filter((sel) => !/^(:root(\[[^\]]+\]|:is\([^)]*\))\s+)?\[data-al="2"\]/.test(sel) && !/^:root:has\(\[data-al="2"\]/.test(sel));
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

// ── Um cartão só: comunidade e conversa usam o cartão do Início (mesmas ações, mesmo selo), variando só a densidade ──
const b3 = ler("components/rede/conversa/base3.tsx");
ok("o post compacto usa o cartão do Início na casca nova", /<CartaoDaAlumia2 [^>]*densidade="compacta"/.test(b3));
const tc = ler("components/rede/conversa/TelaDaConversaAlumia.tsx");
ok("o post aberto da conversa usa o cartão do Início", /<CartaoDaAlumia2[\s\S]{0,400}densidade="aberta"/.test(tc));
const ca2 = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
ok("o cartão tem as três densidades", /"lista" \| "compacta" \| "aberta"/.test(ca2));
// ── 404 de verdade na prévia ──
ok("comunidade que não existe responde 404 na prévia", /previaDaAlumiaLigada\(\) && !paginaDeExemplo\(slug\)\) notFound\(\)/.test(ler("app/[lang]/alumia/c/[slug]/page.tsx")));
ok("conversa que não existe responde 404 na prévia", /previaDaAlumiaLigada\(\) && !arvoreDeExemplo\(id\)(?: && !id\.startsWith\("exemplo-"\))?\) notFound\(\)/.test(ler("app/[lang]/alumia/p/[id]/page.tsx")));

// ── A banca só existe na prévia ──
const banca = ler("app/[lang]/alumia/comunidades/prancha-f3/page.tsx");
ok("a banca responde 404 fora da prévia e sem a Alumia nova", /if \(!previaDaAlumiaLigada\(\) \|\| !alumia2Ligada\(\)\) notFound\(\);/.test(banca));
ok("a banca não é indexada", /index: false/.test(banca));

console.log(`testar-alumia-f3: ${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.error(`  FALHOU: ${f}`);
  process.exit(1);
}
