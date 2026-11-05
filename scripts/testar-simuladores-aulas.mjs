// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os simuladores dentro das aulas (Etapa 5, B17): a leitura do bloco ```simulador, a conta do circuito (lei de Ohm,
// série, paralelo, disjuntor, curto-circuito), o interpretador do visualizador de execução (JavaScript e Python simples:
// variáveis, pilha, saída, erros em português, limite de passos), o carregamento sob demanda (dynamic import) e as aulas
// que receberam o bloco (todo bloco precisa ser lido sem erro). Uso: npm run testar:simuladores-aulas
import fs from "node:fs";
import path from "node:path";
import { executarPassoAPasso } from "../lib/execucao-passo-a-passo.ts";
import { DISJUNTORES, formatar, lerSimulador, resolverCircuito, TIPOS_DE_SIMULADOR } from "../lib/simuladores-aula.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const perto = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ── Leitura do bloco ──
const l1 = lerSimulador("circuito\n# Quanto puxa o chuveiro?\ntensao 220\ndisjuntor 32\nmodo paralelo");
conferir("circuito lido", l1.ok && l1.simulador.tipo === "circuito" && l1.simulador.tensao === 220 && l1.simulador.disjuntor === 32 && l1.simulador.titulo === "Quanto puxa o chuveiro?");
const l2 = lerSimulador("\n\nexecucao-python\n# Laço\nsoma = 0\nfor n in range(3):\n    soma = soma + n\n");
conferir("execução lida", l2.ok && l2.simulador.codigo.startsWith("soma = 0") && l2.simulador.codigo.includes("    soma = soma + n") && l2.simulador.titulo === "Laço");
conferir("apelidos", lerSimulador("js\nlet a = 1").ok && lerSimulador("python\na = 1").ok && lerSimulador("js\nlet a = 1").simulador.tipo === "execucao-js");
conferir("tipo desconhecido recusado", !lerSimulador("foguete").ok);
conferir("vazio recusado", !lerSimulador("").ok);
conferir("execução sem código recusada", !lerSimulador("execucao-js\n# só título").ok);
conferir("linha estranha recusada", !lerSimulador("circuito\nbanana 3").ok);
conferir("valor absurdo recusado", !lerSimulador("circuito\ntensao 99999").ok && !lerSimulador("circuito\ndisjuntor -1").ok);
conferir("modo inválido recusado", !lerSimulador("circuito\nmodo diagonal").ok);
conferir("tensão com vírgula", lerSimulador("circuito\ntensao 12,5").simulador.tensao === 12.5);
conferir("tipos de laboratório existentes", lerSimulador("lampadas").ok && lerSimulador("instalacao").ok);
conferir("todos os tipos leem", TIPOS_DE_SIMULADOR.every((t) => lerSimulador(t.startsWith("execucao") ? `${t}\nx = 1` : t).ok));

// ── Circuito: lei de Ohm ──
const cargas = (...o) => o.map((ohm) => ({ ohm, ligada: true }));
let r = resolverCircuito("serie", 12, cargas(2, 4), 16);
conferir("série: R total", perto(r.ohmTotal, 6) && perto(r.correnteTotal, 2));
conferir("série: tensão se divide", perto(r.cada[0].v, 4) && perto(r.cada[1].v, 8) && perto(r.cada[0].v + r.cada[1].v, 12));
conferir("série: mesma corrente", r.cada.every((c) => perto(c.i, 2)));
conferir("série: potência", perto(r.potencia, 24) && perto(r.cada[0].p + r.cada[1].p, 24));
r = resolverCircuito("paralelo", 12, cargas(6, 12), 16);
conferir("paralelo: R total", perto(r.ohmTotal, 4) && perto(r.correnteTotal, 3));
conferir("paralelo: tensão inteira", r.cada.every((c) => perto(c.v, 12)) && perto(r.cada[0].i, 2) && perto(r.cada[1].i, 1));
conferir("paralelo: correntes se somam", perto(r.cada[0].i + r.cada[1].i, r.correnteTotal));
// o exemplo da aula de Ohm: ferro de 48,4 Ω em 220 V
r = resolverCircuito("paralelo", 220, cargas(48.4), 32);
conferir("ferro de passar: 4,5 A", perto(r.correnteTotal, 220 / 48.4) && formatar(r.correnteTotal, 1) === "4,5");
// chave aberta
r = resolverCircuito("serie", 12, [{ ohm: 2, ligada: true }, { ohm: 4, ligada: false }], 16);
conferir("série com chave aberta apaga tudo", r.aberto && r.correnteTotal === 0 && !r.desarmou);
r = resolverCircuito("paralelo", 12, [{ ohm: 6, ligada: true }, { ohm: 12, ligada: false }], 16);
conferir("paralelo com uma chave aberta", !r.aberto && perto(r.correnteTotal, 2) && r.cada[1].i === 0);
r = resolverCircuito("paralelo", 12, [{ ohm: 6, ligada: false }], 16);
conferir("nada ligado: aberto", r.aberto && r.correnteTotal === 0);
// disjuntor
r = resolverCircuito("paralelo", 127, cargas(10, 10), 16);
conferir("25,4 A num de 16 A: desarma", perto(r.correnteTotal, 25.4) && r.desarmou === true, `corrente ${r.correnteTotal}`);
r = resolverCircuito("paralelo", 127, cargas(20, 20), 16);
conferir("12,7 A num de 16 A: aguenta", perto(r.correnteTotal, 12.7) && !r.desarmou);
r = resolverCircuito("paralelo", 127, cargas(20, 20), 10);
conferir("12,7 A num de 10 A: desarma", r.desarmou);
r = resolverCircuito("paralelo", 220, cargas(220 / 16), 16);
conferir("exatamente no valor: não desarma", perto(r.correnteTotal, 16) && !r.desarmou);
r = resolverCircuito("paralelo", 127, cargas(20), 16, true);
conferir("curto-circuito desarma", r.desarmou && r.correnteTotal > 1000 && perto(r.correnteTotal, 127 / 0.05));
conferir("tensão zero é circuito aberto", resolverCircuito("paralelo", 0, cargas(10), 16).aberto);
conferir("disjuntores em ordem", DISJUNTORES.every((v, i, a) => i === 0 || a[i - 1] < v));
conferir("formatar", formatar(1.5) === "1,50" && formatar(Infinity) === "—" && formatar(12.345, 0) === "12");

// ── Visualizador: Python ──
const py = (c) => executarPassoAPasso(c, "python");
const js = (c) => executarPassoAPasso(c, "js");
const ultimo = (e) => e.passos[e.passos.length - 1];
let e = py("soma = 0\nfor n in range(1, 4):\n    soma = soma + n\nprint(soma)");
conferir("py: sem erro", e.erro === null && !e.truncado, JSON.stringify(e.erro));
conferir("py: saída 6", ultimo(e).saida.join("|") === "6");
conferir("py: soma final", ultimo(e).vars.some((v) => v.nome === "soma" && v.valor === "6"));
conferir("py: linhas visitadas", e.passos.some((p) => p.linha === 3) && e.passos[0].linha === 1);
conferir("py: passos crescem com o laço", e.passos.length === 9, String(e.passos.length));
e = py("x = 7 / 2\ny = 8 / 2\nz = 7 // 2\nw = -7 // 2\nm = -7 % 3\nprint(x, y, z, w, m, 2 ** 3, 2 ** -1)");
conferir("py: aritmética", ultimo(e).saida[0] === "3.5 4.0 3 -4 2 8 0.5", ultimo(e)?.saida[0]);
e = py('nome = "Ana"\nprint("Oi, " + nome)\nprint("ab" * 3)\nprint(len(nome), True, None, [1, "a", 2.0])');
conferir("py: textos e valores", ultimo(e).saida.join("|") === "Oi, Ana|ababab|3 True None [1, 'a', 2.0]", ultimo(e)?.saida.join("|"));
e = py("def dobro(n):\n    return n * 2\n\nr = dobro(4)\nprint(r)");
conferir("py: função devolve", e.erro === null && ultimo(e).saida[0] === "8");
conferir("py: pilha mostra a função", e.passos.some((p) => p.pilha.length === 2 && p.pilha[1].nome === "dobro(4)" && p.vars.some((v) => v.nome === "n" && v.valor === "4")));
conferir("py: nota do return", e.passos.some((p) => p.nota.includes("devolve 8")));
e = py("def fat(n):\n    if n <= 1:\n        return 1\n    return n * fat(n - 1)\n\nprint(fat(4))");
conferir("py: recursão", e.erro === null && ultimo(e).saida[0] === "24");
conferir("py: recursão empilha 4 chamadas", Math.max(...e.passos.map((p) => p.pilha.length)) === 5);
e = py("n = 5\nwhile n > 0:\n    n = n - 2\n    if n == 1:\n        break\nprint(n)");
conferir("py: while com break", e.erro === null && ultimo(e).saida[0] === "1");
e = py("t = 0\nfor i in range(5):\n    if i % 2 == 0:\n        continue\n    t += i\nprint(t)");
conferir("py: continue e +=", ultimo(e).saida[0] === "4");
e = py("n = 7\nif n < 5:\n    print('a')\nelif n < 10:\n    print('b')\nelse:\n    print('c')");
conferir("py: elif", ultimo(e).saida.join("") === "b");
e = py("l = [3, 1]\nl.append(9)\nl[0] = 5\nprint(l, l[-1], len(l))\nfor x in l:\n    pass");
conferir("py: listas", ultimo(e).saida[0] === "[5, 1, 9] 9 3" && e.erro === null, JSON.stringify(e.erro) + ultimo(e)?.saida[0]);
e = py("a = 3\nb = 5\nprint(a < b and b < 9, not a == 3, a in [1, 3], 'x' in 'xyz')");
conferir("py: lógica", ultimo(e).saida[0] === "True False True True", ultimo(e)?.saida[0]);
e = py("print(min(3, 1, 2), max([4, 9, 2]), sum([1, 2, 3]), abs(-3), int('42') + 1, float(2), str(5) + 'a')");
conferir("py: funções embutidas", ultimo(e).saida[0] === "1 9 6 3 43 2.0 5a", ultimo(e)?.saida[0]);
// erros em português
e = py("x = 1\nprint(y)");
conferir("py: NameError com a linha", e.erro?.linha === 2 && /NameError/.test(e.erro.mensagem) && e.passos.length === 1);
e = py("print(1 / 0)");
conferir("py: divisão por zero", /ZeroDivisionError/.test(e.erro?.mensagem ?? ""));
e = py('print("a" + 1)');
conferir("py: texto + número", /TypeError/.test(e.erro?.mensagem ?? "") && /str/.test(e.erro.mensagem));
e = py("l = [1]\nprint(l[3])");
conferir("py: IndexError", /IndexError/.test(e.erro?.mensagem ?? ""));
e = py("def f(a):\n    return a\nf(1, 2)");
conferir("py: argumentos a mais", /precisa de 1/.test(e.erro?.mensagem ?? ""));
e = py("if x == 1\n    pass");
conferir("py: falta dois-pontos", e.passos.length === 0 && e.erro?.linha === 1 && /dois-pontos/.test(e.erro.mensagem));
e = py("if True:\npass");
conferir("py: falta recuo", e.passos.length === 0 && /recuo/.test(e.erro?.mensagem ?? ""));
e = py("  x = 1\ny = 2");
conferir("py: recuo inesperado ou aceito sem travar", e.erro === null || e.erro.linha >= 1);
e = py("import os");
conferir("py: import avisado", /ainda não é entendido/.test(e.erro?.mensagem ?? ""));
e = py('print(f"oi {x}")');
conferir("py: f-string avisada", /prefixo/.test(e.erro?.mensagem ?? ""));
e = py("n = input()");
conferir("py: input avisado", /teclado/.test(e.erro?.mensagem ?? ""));
e = py("def f(n):\n    return f(n + 1)\nf(0)");
conferir("py: recursão sem fim vira erro", /RecursionError/.test(e.erro?.mensagem ?? ""));
e = py("while True:\n    x = 1");
conferir("py: laço sem fim para em 300 passos", e.truncado && e.passos.length === 300 && e.erro === null);
e = py("x = 'aberto");
conferir("py: texto aberto", /aspas/.test(e.erro?.mensagem ?? ""));
conferir("py: vazio", py("   \n").erro !== null);
conferir("py: código grande demais", py("x = 1\n".repeat(1000)).erro !== null);
e = py("# só comentário\n\nx = 1  # outro\n");
conferir("py: comentários", e.erro === null && ultimo(e).vars[0].valor === "1");
e = py("def a():\n    return 1\nx = a()\ny = x + 1");
conferir("py: variável global visível e função sem argumentos", ultimo(e).vars.some((v) => v.nome === "y" && v.valor === "2"));
e = py("g = 10\ndef f():\n    return g + 1\nprint(f())");
conferir("py: função lê global", ultimo(e).saida[0] === "11");
e = py("for c in 'ab':\n    print(c)");
conferir("py: for em texto", ultimo(e).saida.join("") === "ab");
e = py("print(f())\ndef f():\n    return 1");
conferir("py: função antes do def é erro", e.erro !== null);

// ── Visualizador: JavaScript ──
e = js("let soma = 0;\nfor (let i = 1; i <= 3; i++) {\n  soma = soma + i;\n}\nconsole.log(soma);");
conferir("js: for clássico", e.erro === null && ultimo(e).saida[0] === "6", JSON.stringify(e.erro));
e = js("function dobro(n) {\n  return n * 2;\n}\nconst r = dobro(4);\nconsole.log(r, 'ok', true, null);");
conferir("js: função e saída", e.erro === null && ultimo(e).saida[0] === "8 ok true null", JSON.stringify(e.erro));
conferir("js: pilha", e.passos.some((p) => p.pilha.length === 2 && p.pilha[1].nome === "dobro(4)"));
e = js("console.log(soma(2, 3));\nfunction soma(a, b) { return a + b; }");
conferir("js: função içada", e.erro === null && ultimo(e).saida[0] === "5", JSON.stringify(e.erro));
e = js("let n = 3;\nwhile (n > 0) n--;\nif (n === 0) { console.log('zero'); } else if (n > 0) { console.log('mais'); } else { console.log('menos'); }");
conferir("js: while sem chaves, ===, else if", e.erro === null && ultimo(e).saida[0] === "zero", JSON.stringify(e.erro));
e = js("const l = [1, 2, 3];\nlet t = 0;\nfor (const x of l) { t += x; }\nl.push(4);\nconsole.log(t, l.length, l, 7 / 2, 7 % 3, '5' + 1, !true || 1 > 0 && 2 > 1);");
conferir("js: for...of, push, length, contas", e.erro === null && ultimo(e).saida[0] === "6 4 [1, 2, 3, 4] 3.5 1 51 true", JSON.stringify(e.erro) + ultimo(e)?.saida[0]);
e = js("let x;\nconsole.log(x, Math.floor(7 / 2), Math.max(1, 5, 3));");
conferir("js: undefined e Math", ultimo(e)?.saida[0] === "undefined 3 5", JSON.stringify(e.erro));
e = js("console.log(naoExiste);");
conferir("js: ReferenceError", /ReferenceError/.test(e.erro?.mensagem ?? ""));
e = js("class A {}");
conferir("js: class avisada", /ainda não é entendido/.test(e.erro?.mensagem ?? ""));
e = js("let a = `oi`;");
conferir("js: template avisado", /template/.test(e.erro?.mensagem ?? ""));
e = js("if (true) {\n  let a = 1;");
conferir("js: chave sem fechar", /chave/.test(e.erro?.mensagem ?? ""));
e = js("for (let i = 0; i < 2; i++) { console.log(i) }\n/* c */ // d");
conferir("js: comentários e sem ponto e vírgula", e.erro === null && ultimo(e).saida.join("") === "01", JSON.stringify(e.erro));
e = js("while (true) {}");
conferir("js: laço sem fim para", e.truncado);
e = js("function f(n) { return n <= 1 ? 1 : n; }");
conferir("js: operador ternário avisado sem travar", e.erro !== null || e.passos.length >= 0);

// ── Peso e privacidade: nada de eval, rede nem armazenamento no interpretador ──
const fonteDoInterpretador = fs.readFileSync("lib/execucao-passo-a-passo.ts", "utf8");
conferir("interpretador sem eval/Function/fetch/Worker", !/\beval\s*\(|new Function|\bfetch\s*\(|new Worker|XMLHttpRequest|localStorage|import\(/.test(fonteDoInterpretador.replace(/\/\/.*$/gm, "")));
conferir("interpretador sem importar nada", !/^import /m.test(fonteDoInterpretador));
const fonteCircuito = fs.readFileSync("lib/simuladores-aula.ts", "utf8");
conferir("lib do circuito sem importar nada", !/^import /m.test(fonteCircuito));

// ── Carregamento sob demanda ──
const casca = fs.readFileSync("components/aula/SimuladorDaAula.tsx", "utf8");
conferir("casca: dynamic import dos 4 simuladores", (casca.match(/dynamic\(\(\) => import\(/g) ?? []).length === 4);
conferir("casca: sem import estático dos simuladores", !/^import .* from "\.\/simuladores\//m.test(casca) && !/^import .* from "\.\.\/labs\//m.test(casca));
conferir("casca: só abre depois do clique", /useState\(false\)/.test(casca) && /Abrir o simulador/.test(casca));
conferir("casca: reaproveita os laboratórios", /labs\/eletrica\/Circuitos/.test(casca) && /labs\/eletrica\/Instalacao/.test(casca));
const markdown = fs.readFileSync("components/Markdown.tsx", "utf8");
conferir("Markdown liga o bloco", /language === "simulador"\) return <SimuladorDaAula/.test(markdown));
conferir("sem iframe nem script de terceiros", !/<iframe|<script|https?:\/\//.test(casca + fs.readFileSync("components/aula/simuladores/CircuitoSimples.tsx", "utf8") + fs.readFileSync("components/aula/simuladores/VisualizadorDeExecucao.tsx", "utf8").replace(/"http:\/\/www\.w3\.org[^"]*"/g, "")));
for (const arq of ["CircuitoSimples", "VisualizadorDeExecucao"]) {
  const f = fs.readFileSync(`components/aula/simuladores/${arq}.tsx`, "utf8");
  conferir(`${arq}: sem as palavras proibidas`, !/universidade|diploma/i.test(f));
}

// ── Abuso: nada pode travar o aparelho nem lançar ──
let t0 = Date.now();
e = py("a = [1]\nwhile True:\n    a = [a, a]");
conferir("py: lista aninhada dobrando não trava", Date.now() - t0 < 3000 && e.passos.length > 0 && ultimo(e).vars[0].valor.length < 3000);
e = py("a = [1]\nwhile True:\n    a = a + a");
conferir("py: lista dobrando para com erro", e.erro !== null && /grande demais/.test(e.erro.mensagem));
e = js("let s = \"ab\";\nwhile (true) {\n  s = s + s;\n}");
conferir("js: texto dobrando para com erro", e.erro !== null && /grande demais/.test(e.erro.mensagem));
e = js("Math.constructor(1)\nMath.__proto__()");
conferir("js: Math.constructor não vaza", e.erro !== null && /ainda não é entendido/.test(e.erro.mensagem), JSON.stringify(e.erro));
e = py("x = " + "(".repeat(20000) + "1" + ")".repeat(20000));
conferir("py: parênteses demais não lançam", e.erro !== null || e.passos.length > 0);

// ── As aulas que receberam o bloco ──
const trilhas = path.join(process.cwd(), "content", "trilhas");
const comBloco = [];
const andar = (pasta) => {
  for (const d of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, d.name);
    if (d.isDirectory()) andar(p);
    else if (d.name.endsWith(".md")) {
      const texto = fs.readFileSync(p, "utf8");
      for (const m of texto.matchAll(/```simulador\r?\n([\s\S]*?)```/g)) comBloco.push({ arq: path.relative(trilhas, p).replaceAll("\\", "/"), spec: m[1] });
    }
  }
};
andar(trilhas);
conferir("de 6 a 10 aulas com simulador", new Set(comBloco.map((b) => b.arq)).size >= 6 && new Set(comBloco.map((b) => b.arq)).size <= 10, `${new Set(comBloco.map((b) => b.arq)).size} aulas`);
for (const b of comBloco) {
  const l = lerSimulador(b.spec);
  conferir(`bloco de ${b.arq} é lido`, l.ok, l.ok ? "" : l.erro);
  if (l.ok && l.simulador.tipo.startsWith("execucao")) {
    const x = executarPassoAPasso(l.simulador.codigo, l.simulador.tipo === "execucao-js" ? "js" : "python");
    conferir(`programa de ${b.arq} roda sem erro`, x.erro === null && !x.truncado && x.passos.length > 0, JSON.stringify(x.erro));
  }
}
conferir("há aulas de eletricidade e de programação", comBloco.some((b) => /eletric/.test(b.arq)) && comBloco.some((b) => /programa|python/.test(b.arq)));

// ── Documentação ──
const doc = fs.existsSync("docs/simuladores-nas-aulas.md") ? fs.readFileSync("docs/simuladores-nas-aulas.md", "utf8") : "";
conferir("doc existe e cita o bloco", /```simulador/.test(doc) && /execucao-python/.test(doc) && /circuito/.test(doc));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s):`);
  for (const f of falhas) console.error(` - ${f}`);
  process.exit(1);
}
console.log(`Simuladores nas aulas: ${ok} conferências, tudo certo.`);
