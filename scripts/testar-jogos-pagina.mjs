// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere a página /jogos (Etapa 5): a lógica dos jogos de treino com o glossário de verdade (cruzadas, caça-palavras,
// sudoku de solução única, forca, memória, quebra-cabeça, jogo da velha, ditado), os sons das crianças, os textos nos 6
// idiomas, o redirecionamento 308 de /laboratorios/jogos, o menu e a privacidade (nada de terceiros, nada guardado).
// Uso: npm run testar:jogos-pagina
import fs from "node:fs";
import path from "node:path";
import { compararDitado, criarSorteio, embaralhar, ehPalavraSimples, mascarar, palavrasParaLetras, primeiraFrase, soLetras } from "../lib/jogos/base.ts";
import { celulasDe, gerarCacaPalavras, gerarCruzadas, palavraNoTraco } from "../lib/jogos/grades.ts";
import { acertou, empate, erros, forcaAcabou, gerarMemoria, gerarPergunta, gerarQuebra, jogadaDoComputador, perdeu, PETALAS, tentarLetra, vencedor } from "../lib/jogos/pequenos.ts";
import { BATIDAS, conferirMelodia, frequenciaMidi, paresDeSons, RODADAS_DA_MELODIA, sortearMelodia, TECLAS } from "../lib/jogos/sons.ts";
import { contarSolucoes, conflitos, gerarSudoku, MEDIDAS, PISTAS } from "../lib/jogos/sudoku.ts";
import { menuDosJogos, MENU_DOS_JOGOS } from "../lib/jogos/menu.ts";

const raiz = path.resolve(import.meta.dirname, "..");
let falhas = 0;
function conferir(nome, ok, detalhe = "") {
  if (!ok) {
    falhas++;
    console.error(`FALHOU: ${nome}${detalhe ? ` (${detalhe})` : ""}`);
  } else console.log(`ok: ${nome}`);
}
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");

// ───────── O glossário de verdade (pasta literal) ─────────
const pasta = path.join(raiz, "content", "glossario");
const verbetes = fs
  .readdirSync(pasta)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const texto = fs.readFileSync(path.join(pasta, f), "utf8").replace(/^﻿/, "");
    const termo = /^termo:\s*"?(.*?)"?\s*$/m.exec(texto)?.[1];
    const resumo = /^resumo:\s*"?(.*?)"?\s*$/m.exec(texto)?.[1];
    return termo && resumo ? { termo, resumo } : null;
  })
  .filter(Boolean);
conferir("o glossário tem verbetes para os jogos", verbetes.length >= 150, String(verbetes.length));
const palavras = palavrasParaLetras(verbetes, 4, 12);
conferir("há palavras de uma palavra só em número suficiente", palavras.length >= 80, String(palavras.length));
conferir("as palavras dos jogos são só A-Z e únicas", palavras.every((p) => /^[A-Z]{4,12}$/.test(p.palavra)) && new Set(palavras.map((p) => p.palavra)).size === palavras.length);

// ───────── Texto ─────────
conferir("soLetras tira acento e cedilha", soLetras("Ação é Coração") === "ACAOECORACAO");
conferir("ehPalavraSimples", ehPalavraSimples("Átomo") && !ehPalavraSimples("Big Bang") && !ehPalavraSimples("AI-5"));
conferir("mascarar esconde o termo e as palavras da mesma raiz", mascarar("O algoritmo resolve; algoritmos são passos.", "Algoritmo") === "O ____ resolve; ____ são passos.");
conferir("primeiraFrase corta no primeiro ponto", primeiraFrase("Uma coisa. Outra coisa.") === "Uma coisa.");
conferir("primeiraFrase respeita o limite", primeiraFrase("palavra ".repeat(60), 40).length <= 41);
conferir("ditado: certo, acento e errado", compararDitado("Átomo", "átomo") === "certo" && compararDitado("atomo", "átomo") === "acento" && compararDitado("atmo", "átomo") === "errado");
const r1 = criarSorteio(7);
const r2 = criarSorteio(7);
conferir("o sorteio com semente se repete", [r1(), r1(), r1()].join() === [r2(), r2(), r2()].join());
conferir("embaralhar não perde nem repete", embaralhar([1, 2, 3, 4, 5, 6], criarSorteio(3)).sort().join() === "1,2,3,4,5,6");

// ───────── Caça-palavras ─────────
for (const facil of [true, false]) {
  let bom = true;
  let achou = true;
  for (let semente = 1; semente <= 25; semente++) {
    const rnd = criarSorteio(semente);
    const tam = facil ? 9 : 12;
    const alvo = embaralhar(palavras.filter((p) => p.palavra.length < tam), rnd).slice(0, facil ? 6 : 9).map((p) => p.palavra);
    const jogo = gerarCacaPalavras(alvo, tam, rnd, facil);
    if (jogo.colocadas.length !== alvo.length) bom = false;
    for (const p of jogo.colocadas) {
      const letras = celulasDe(p).map(([r, c]) => jogo.grade[r][c]).join("");
      if (letras !== p.palavra) bom = false;
      if (facil && (p.dr < 0 || p.dc < 0)) bom = false;
      const fim = celulasDe(p).at(-1);
      const de = palavraNoTraco(jogo, p.r, p.c, fim[0], fim[1]);
      const volta = palavraNoTraco(jogo, fim[0], fim[1], p.r, p.c);
      if (de?.palavra !== p.palavra || volta?.palavra !== p.palavra) achou = false;
    }
    if (jogo.grade.some((l) => l.some((x) => !/^[A-Z]$/.test(x)))) bom = false;
  }
  conferir(`caça-palavras ${facil ? "fácil" : "normal"}: todas as palavras entram, na grade, na direção certa`, bom);
  conferir(`caça-palavras ${facil ? "fácil" : "normal"}: o traço de ponta a ponta acha a palavra nos dois sentidos`, achou);
}

// ───────── Palavras cruzadas ─────────
{
  let ok = true;
  let minimo = 99;
  let detalhe = "";
  for (let semente = 1; semente <= 20; semente++) {
    const rnd = criarSorteio(semente);
    const itens = embaralhar(palavrasParaLetras(verbetes, 4, 9), rnd).slice(0, 14).map((p) => ({ palavra: p.palavra, dica: mascarar(primeiraFrase(p.resumo, 120), p.termo) }));
    const jogo = gerarCruzadas(itens, rnd);
    if (!jogo) { ok = false; detalhe = "sem jogo"; continue; }
    minimo = Math.min(minimo, jogo.entradas.length);
    for (const e of jogo.entradas) {
      for (let i = 0; i < e.palavra.length; i++) {
        const r = e.r + (e.dir === "V" ? i : 0);
        const c = e.c + (e.dir === "H" ? i : 0);
        if (jogo.letras[r]?.[c] !== e.palavra[i]) { ok = false; detalhe = `${e.palavra} fora da grade`; }
      }
      if (jogo.numeros[e.r][e.c] !== e.numero) ok = false;
    }
    // Toda letra da grade pertence a alguma palavra, e toda sequência de 2+ letras em linha é uma palavra da lista.
    const sequencias = [];
    for (let r = 0; r < jogo.linhas; r++) {
      let s = "";
      for (let c = 0; c <= jogo.colunas; c++) {
        const l = c < jogo.colunas ? jogo.letras[r][c] : null;
        if (l) s += l;
        else { if (s.length > 1) sequencias.push(s); s = ""; }
      }
    }
    for (let c = 0; c < jogo.colunas; c++) {
      let s = "";
      for (let r = 0; r <= jogo.linhas; r++) {
        const l = r < jogo.linhas ? jogo.letras[r][c] : null;
        if (l) s += l;
        else { if (s.length > 1) sequencias.push(s); s = ""; }
      }
    }
    const lista = new Set(jogo.entradas.map((e) => e.palavra));
    if (sequencias.some((s) => !lista.has(s))) { ok = false; detalhe = "sequência na grade que não é palavra"; }
    if (sequencias.length !== jogo.entradas.length) { ok = false; detalhe = "número de sequências diferente do de entradas"; }
  }
  conferir("cruzadas: toda palavra está na grade, sem palavra intrusa nem colada", ok, detalhe);
  conferir("cruzadas: encaixa pelo menos 5 palavras em todas as sementes", minimo >= 5, String(minimo));
}

// ───────── Sudoku ─────────
for (const tam of [4, 6, 9]) {
  let ok = true;
  const sementes = tam === 9 ? 4 : 10;
  for (const dif of ["facil", "medio"]) {
    for (let semente = 1; semente <= sementes; semente++) {
      const j = gerarSudoku(tam, dif, criarSorteio(semente * 31 + tam));
      const m = MEDIDAS[tam];
      if (conflitos(m, j.solucao).size) ok = false;
      if (j.solucao.some((v) => v < 1 || v > tam)) ok = false;
      if (j.dadas.some((v, i) => v !== 0 && v !== j.solucao[i])) ok = false;
      if (contarSolucoes(m, j.dadas) !== 1) ok = false;
      const dadas = j.dadas.filter(Boolean).length;
      if (dadas < PISTAS[tam][dif] || dadas > PISTAS[tam][dif] + 6) ok = false;
    }
  }
  conferir(`sudoku ${tam}x${tam}: solução válida, solução única e número de pistas`, ok);
}
conferir("o contador de soluções vê um sudoku com duas soluções", contarSolucoes(MEDIDAS[4], Array(16).fill(0)) === 2);

// ───────── Forca ─────────
{
  let f = { palavra: "ATOMO", tentadas: [] };
  f = tentarLetra(f, "á");
  f = tentarLetra(f, "A");
  conferir("forca: letra repetida não conta, acento vira a letra", f.tentadas.length === 1 && erros(f) === 0);
  for (const l of "TOM") f = tentarLetra(f, l);
  conferir("forca: acertou ao completar a palavra", acertou(f) && forcaAcabou(f) && !perdeu(f));
  let g = { palavra: "ATOMO", tentadas: [] };
  for (const l of "BCDEFGHJ") g = tentarLetra(g, l);
  conferir("forca: perde com 6 erros e para de aceitar letra", perdeu(g) && erros(g) === PETALAS && tentarLetra(g, "Z") === g);
}

// ───────── Memória ─────────
{
  const rnd = criarSorteio(5);
  const cartas = gerarMemoria(verbetes, 8, rnd);
  conferir("memória: 8 pares, cada um com um termo e uma definição", cartas.length === 16 && new Set(cartas.map((c) => c.par)).size === 8 && [...new Set(cartas.map((c) => c.par))].every((p) => cartas.filter((c) => c.par === p && c.tipo === "termo").length === 1 && cartas.filter((c) => c.par === p && c.tipo === "definicao").length === 1));
  conferir("memória: definições curtas o bastante para a carta", cartas.filter((c) => c.tipo === "definicao").every((c) => c.texto.length <= 95));
}

// ───────── Quebra-cabeça ─────────
for (const modo of ["letras", "frase"]) {
  let ok = true;
  for (let semente = 1; semente <= 30; semente++) {
    const q = gerarQuebra(modo, palavras, verbetes, criarSorteio(semente), mascarar);
    if ([...q.pecas.map((p) => p.texto)].sort().join("|") !== [...q.certa].sort().join("|")) ok = false;
    if (q.pecas.map((p) => p.texto).join("|") === q.certa.join("|") && new Set(q.certa).size > 1) ok = false;
    if (modo === "letras" && q.certa.join("") !== soLetras(q.termo)) ok = false;
  }
  conferir(`quebra-cabeça (${modo}): as peças são as da resposta, fora de ordem`, ok);
}

// ───────── Jogo da velha ─────────
{
  conferir("velha: vencedor em linha, coluna e diagonal", vencedor(["X", "X", "X", null, null, null, null, null, null])?.marca === "X" && vencedor(["O", null, null, "O", null, null, "O", null, null])?.marca === "O" && vencedor(["X", null, null, null, "X", null, null, null, "X"])?.marca === "X");
  conferir("velha: empate", empate(["X", "O", "X", "X", "O", "O", "O", "X", "X"]));
  conferir("velha: o computador fecha a própria linha", jogadaDoComputador(["O", "O", null, "X", "X", null, null, null, null], criarSorteio(1)) === 2);
  conferir("velha: o computador impede a linha do outro", jogadaDoComputador(["X", "X", null, null, "O", null, null, null, null], criarSorteio(1)) === 2);
  conferir("velha: pega o centro livre", jogadaDoComputador(["X", null, null, null, null, null, null, null, null], criarSorteio(1)) === 4);
  let ok = true;
  for (let semente = 1; semente <= 60; semente++) {
    const p = gerarPergunta(verbetes, criarSorteio(semente), mascarar);
    if (p.opcoes.length !== 3 || new Set(p.opcoes).size !== 3 || p.opcoes[p.certa] !== p.termo) ok = false;
    if (p.enunciado.toLowerCase().includes(p.termo.toLowerCase()) && p.termo.length > 4) ok = false;
  }
  conferir("velha: pergunta com 3 termos diferentes, um certo, sem entregar o termo", ok);
}

// ───────── Sons das crianças ─────────
conferir("sons: o lá central (MIDI 69) é 440 Hz e o dó central (60) é 261,63 Hz", Math.abs(frequenciaMidi(69) - 440) < 1e-9 && Math.abs(frequenciaMidi(60) - 261.6256) < 0.001);
conferir("sons: as teclas são notas diferentes, em ordem crescente, com atalhos únicos", TECLAS.every((t, i) => i === 0 || t.midi > TECLAS[i - 1].midi) && new Set(TECLAS.map((t) => t.tecla)).size === TECLAS.length);
conferir("sons: batidas com atalhos únicos", new Set(BATIDAS.map((b) => b.tecla)).size === BATIDAS.length);
{
  const melodia = sortearMelodia(4, criarSorteio(9));
  conferir("melodia: tamanho certo e só notas existentes", melodia.length === 4 && melodia.every((n) => n >= 0 && n < TECLAS.length));
  conferir("melodia: conferência passo a passo", conferirMelodia([1, 2, 3], [1]) === "continua" && conferirMelodia([1, 2, 3], [1, 2, 3]) === "completa" && conferirMelodia([1, 2, 3], [1, 3]) === "errou");
  conferir("melodia: termina (4 rodadas, de 2 a 5 notas), sem pontos", RODADAS_DA_MELODIA.join() === "2,3,4,5");
  const pares = paresDeSons(4);
  conferir("sons iguais: cada nota duas vezes", pares.length === 8 && [0, 1, 2, 3].every((n) => pares.filter((x) => x === n).length === 2));
}

// ───────── Textos nos 6 idiomas ─────────
{
  const langs = ["pt", "en", "es", "fr", "ru", "zh"];
  const dic = Object.fromEntries(langs.map((l) => [l, JSON.parse(ler("i18n", "jogos", `${l}.json`).replace(/^﻿/, ""))]));
  const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? achatar(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]));
  const base = new Map(achatar(dic.pt));
  for (const l of langs.slice(1)) {
    const outro = new Map(achatar(dic[l]));
    const faltam = [...base.keys()].filter((k) => !outro.has(k));
    const sobram = [...outro.keys()].filter((k) => !base.has(k));
    conferir(`i18n ${l}: mesmas chaves do português`, !faltam.length && !sobram.length, `faltam ${faltam.slice(0, 3)} sobram ${sobram.slice(0, 3)}`);
    const marcas = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) ?? []).sort().join();
    const ruins = [...base].filter(([k, v]) => outro.has(k) && marcas(v) !== marcas(outro.get(k)));
    conferir(`i18n ${l}: os {campos} de cada texto são os mesmos`, !ruins.length, ruins.slice(0, 3).map(([k]) => k).join());
    conferir(`i18n ${l}: nenhum texto vazio`, [...outro.values()].every((v) => String(v).trim()));
  }
  const todos = JSON.stringify(dic);
  conferir("nenhum texto usa 'universidade' nem 'diploma'", !/universidade|diploma/i.test(todos));
  conferir("o menu tem os 6 idiomas e cai no português", langs.every((l) => MENU_DOS_JOGOS[l]?.rotulo) && menuDosJogos("xx").rotulo === "Jogos");
}

// ───────── Estrutura: página, redirecionamento, menu, privacidade ─────────
conferir("a página /jogos existe e a de Laboratórios saiu", fs.existsSync(path.join(raiz, "app", "[lang]", "jogos", "page.tsx")) && !fs.existsSync(path.join(raiz, "app", "[lang]", "laboratorios", "jogos")));
const pagina = ler("app", "[lang]", "jogos", "page.tsx");
conferir("a página /jogos mantém o Rumos, a Greve! e os baralhos", pagina.includes("JogosDeFormacao") && pagina.includes("greve.json") && pagina.includes("rumos-historia-do-brasil.json") && pagina.includes("validarBaralho"));
conferir("a página lê o disco só com pasta literal", /path\.join\(process\.cwd\(\), "content", "trilhas"\)/.test(pagina));
const config = ler("next.config.ts");
conferir("redirecionamento 308 (permanent) de /laboratorios/jogos para /jogos, com e sem idioma", /source: "\/:lang\(pt\|en\|es\|fr\|ru\|zh\)\/laboratorios\/jogos", destination: "\/:lang\/jogos", permanent: true/.test(config) && /source: "\/laboratorios\/jogos", destination: "\/pt\/jogos", permanent: true/.test(config));
const menu = ler("components", "NavLinks.tsx");
conferir("Jogos está no menu principal e não repete no Mais", menu.includes('menuDosJogos(lang).rotulo, "/jogos"') && /MAIS_NO_MENU = \[[^\]]*"\/jogos"/.test(menu));
conferir("Jogos está no rodapé, no Mais/explorar, no mapa do site e na interdição de ferramentas", ler("components", "Footer.tsx").includes('"/jogos"') && ler("lib", "secoes-do-site.ts").includes('"/jogos"') && ler("app", "sitemap.ts").includes('"/jogos"') && ler("lib", "interdicao.ts").includes('"/jogos"'));
// Nenhum link interno para o endereço antigo (só o redirecionamento o cita).
const antigos = [];
for (const dir of ["app", "components", "lib", "content/paginas", "i18n", "e2e"]) {
  const andar = (d) => fs.readdirSync(path.join(raiz, d), { withFileTypes: true }).forEach((e) => {
    const rel = `${d}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== "node_modules") andar(rel); } else if (/\.(tsx?|md|json|mjs)$/.test(e.name) && fs.readFileSync(path.join(raiz, rel), "utf8").includes("laboratorios/jogos")) antigos.push(rel);
  });
  andar(dir);
}
conferir("nenhum link interno aponta para /laboratorios/jogos", antigos.length === 0, antigos.join());

const arquivosDosJogos = fs.readdirSync(path.join(raiz, "components", "jogos"), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name).map((f) => path.join("components", "jogos", f)).concat(fs.readdirSync(path.join(raiz, "lib", "jogos"), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name).map((f) => path.join("lib", "jogos", f)));
const fonte = arquivosDosJogos.map((f) => [f, ler(f)]);
conferir("nenhum arquivo dos jogos fala com a rede nem guarda dados", fonte.every(([, t]) => !/\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|<iframe|https?:\/\//.test(t.replace(/Licença: AGPL[^\n]*/g, "").replace(/^\s*(\/\/|\/\*\*|\*).*$/gm, ""))));
conferir("os sons não usam arquivo nem biblioteca de terceiros", !/new Audio\(|<audio|\.mp3|\.wav|\.ogg|from "(tone|howler|pizzicato)/.test(ler("components", "jogos", "audio.ts") + ler("components", "jogos", "SonsInfantis.tsx")));
conferir("o ditado usa a voz do navegador (speechSynthesis)", ler("components", "jogos", "Ditado.tsx").includes("speechSynthesis"));
conferir("os jogos de treino carregam sob demanda (dynamic import)", (ler("components", "jogos", "Treino.tsx").match(/dynamic\(\(\) => import\(/g) ?? []).length === 8 && ler("components", "jogos", "CriancasSons.tsx").includes("dynamic("));
conferir("os arquivos dos jogos trazem o cabeçalho de licença", fonte.filter(([f]) => /\.(ts|tsx)$/.test(f)).every(([, t]) => t.startsWith("// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later")));
conferir("não há pontos, placar nem sequência nos jogos", fonte.filter(([f]) => !f.endsWith("menu.ts")).every(([, t]) => !/\b(pontuacao|placar|streak|sequencia-diaria|ranking)\b/i.test(t.replace(/\/\/.*$/gm, ""))));
conferir("o ditado e os jogos de grade não usam 'universidade' nem 'diploma'", fonte.every(([, t]) => !/universidade|diploma/i.test(t)));
const kids = ler("components", "criancas", "atividades.ts");
conferir("a área infantil tem a atividade 'sons'", kids.includes('id: "sons"') && ler("components", "criancas", "AreaInfantil.tsx").includes("sons: Sons"));
conferir("existe a documentação do pacote", fs.existsSync(path.join(raiz, "docs", "jogos", "PAGINA.md")));

if (falhas) {
  console.error(`\n${falhas} conferência(s) falharam.`);
  process.exit(1);
}
console.log("\nTudo certo na página de jogos.");
