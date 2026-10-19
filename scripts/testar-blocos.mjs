// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o editor por blocos: cortar o Markdown em blocos e juntar de novo não pode mudar a aula.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { comMarcas, miolo, partir, textoPuro, tipoDe } from "../lib/blocos.ts";
import { expressaoSegura, lacunaCerta, lerCacaPalavras, lerCalculadora, lerDados, lerForca, lerGrafico, lerPares, lerPronuncia, lerTeste, MODELOS_INTERATIVOS, montarGrade, numeroCerto } from "../lib/interativos.ts";
import { anguloEm, areaDoPoligono, distancia, lerArrastar, lerCena, lerGeometria, lerMapa, lerMolecula, lerMusica, lerProgramacao, lerRodar, lerSimulacao, nomeDeLugar, parDeNumeros, posicoesDaGeometria, saidaConfere, segundos } from "../lib/interativos-mais.ts";
import { BIBLIOTECA, comprimentoDaLigacao, formula, lerSmiles, moleculaDe } from "../lib/moleculas.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const exemplo = [
  "## Título", "", "Um parágrafo com **negrito**.", "Segunda linha do mesmo parágrafo.", "",
  "### Sub", "", "- um", "- dois", "", "1. primeiro", "2. segundo", "", "> citação", "> continua", "",
  "![Mapa](/arquivos/abc12345.webp \"IBGE, domínio público\")", "", "```video", "https://www.youtube.com/watch?v=x", "Legenda", "```", "",
  "$$", "E = mc^2", "$$", "", "```verificar", "Pergunta?", "+ certa", "- errada", "> dica", "```", "",
  "```python", "print(1)", "", "print(2)", "```", "", "[📎 Lista de exercícios](/arquivos/abcdef1234.pdf)", "",
  "| a | b |", "| --- | --- |", "| 1 | 2 |", "", "```conta", "2 + 2", "= 4", "```",
].join("\n");
const blocos = partir(exemplo);
const tipos = blocos.map(tipoDe);
const esperado = ["titulo", "paragrafo", "subtitulo", "lista", "numerada", "citacao", "imagem", "video", "formula", "questao", "codigo", "anexo", "tabela", "conta"];
conferir("tipos reconhecidos", JSON.stringify(tipos) === JSON.stringify(esperado), JSON.stringify(tipos));
conferir("código com linha em branco fica num bloco só", blocos[10].includes("print(1)\n\nprint(2)"));
conferir("juntar devolve o mesmo texto", blocos.join("\n\n") === exemplo);
conferir("miolo do vídeo", miolo(blocos[7]) === "https://www.youtube.com/watch?v=x\nLegenda");
conferir("miolo da fórmula", miolo(blocos[8]) === "E = mc^2");
conferir("lista vira numerada sem perder texto", comMarcas("numerada", textoPuro("- um\n- dois")) === "1. um\n2. dois");
conferir("título vira parágrafo", comMarcas("paragrafo", textoPuro("## Olá")) === "Olá");
conferir("cerca sem fechar não engole o resto em erro", partir("```python\nprint(1)").length === 1);
conferir("lista aninhada fica intocada", tipoDe("- a\n  - b") === "bruto");
conferir("pauta musical fica intocada", tipoDe("```pauta\nC D E\n```") === "bruto");
conferir("CRLF", partir("a\r\n\r\nb").length === 2);

// Toda aula do acervo: partir e juntar (com as linhas em branco normalizadas) preserva o conteúdo.
const raiz = path.join(process.cwd(), "content", "trilhas");
let aulas = 0;
for (const trilha of readdirSync(raiz, { withFileTypes: true })) {
  if (!trilha.isDirectory()) continue;
  for (const arq of readdirSync(path.join(raiz, trilha.name))) {
    if (!arq.endsWith(".md") || arq.startsWith("_")) continue;
    const texto = readFileSync(path.join(raiz, trilha.name, arq), "utf8").replace(/\r\n?/g, "\n");
    const corpo = texto.replace(/^---\n[\s\S]*?\n---\n/, "");
    const semBrancos = (t) => t.split("\n").filter((l) => l.trim() !== "").join("\n");
    const volta = partir(corpo).join("\n\n");
    aulas++;
    if (semBrancos(volta) !== semBrancos(corpo)) falhas.push(`a aula ${trilha.name}/${arq} muda ao passar pelos blocos`);
  }
}
conferir(`${aulas} aulas lidas`, aulas > 100);

// Blocos interativos: cada modelo do menu é lido sem perder nada, e dado perigoso não passa.
const g = lerGrafico(MODELOS_INTERATIVOS.grafico.modelo);
conferir("gráfico: função, três controles e faixa", g.funcoes.length === 1 && g.parametros.length === 3 && g.x[0] === -10 && g.pontos.length === 1);
conferir("gráfico: ponto com vírgula decimal", lerGrafico("y = x\nponto (1,5; 2) A").pontos[0]?.x === 1.5);
conferir("gráfico: expressão com código é recusada", lerGrafico("y = import('fs')").funcoes.length === 0 && !expressaoSegura("evaluate('1')") && !expressaoSegura("x; alert(1)"));
const c = lerCalculadora(MODELOS_INTERATIVOS.calculadora.modelo);
conferir("calculadora: resultado e dois campos", c?.resultado.nome === "v" && c.campos.length === 2 && c.campos[1].valor === 9.58);
const d = lerDados(MODELOS_INTERATIVOS.dados.modelo);
conferir("dados: tipo, título, cabeçalho e três linhas", d.tipo === "barras" && d.titulo === "Chuva em 2024" && d.cabecalho.length === 2 && d.linhas.length === 3 && d.linhas[2].valores[0] === 150);
const q = lerTeste(MODELOS_INTERATIVOS.teste.modelo);
conferir("teste: os cinco tipos de pergunta", q.map((x) => x.tipo).join() === "escolha,vf,numero,lacunas,ordenar", q.map((x) => x.tipo).join());
conferir("teste: retorno por alternativa", q[0].tipo === "escolha" && q[0].opcoes[1].retorno.includes("satélite"));
conferir("teste: lacuna sem acento e com maiúscula vale", lacunaCerta(["Brasília"], "brasilia") && !lacunaCerta(["Brasília"], "Rio"));
conferir("teste: número com tolerância", numeroCerto({ resposta: 56, tolerancia: 0.5 }, "56,4") && !numeroCerto({ resposta: 56, tolerancia: 0.5 }, "57"));
conferir("cartões: língua e três pares", lerPares(MODELOS_INTERATIVOS.cartoes.modelo).lingua === "en-US" && lerPares(MODELOS_INTERATIVOS.cartoes.modelo).pares.length === 3);
conferir("forca: palavras em maiúsculas com dica", lerForca(MODELOS_INTERATIVOS.forca.modelo)[0]?.palavra === "FOTOSSINTESE");
const caca = lerCacaPalavras(MODELOS_INTERATIVOS.cacapalavras.modelo);
const grade = montarGrade(caca.palavras, caca.tamanho);
conferir("caça-palavras: todas as palavras entram na grade", grade.posicoes.length === caca.palavras.length && grade.posicoes.every((pos) => pos.celulas.map(([l, col]) => grade.grade[l][col]).join("") === pos.palavra));
conferir("caça-palavras: a mesma lista monta a mesma grade", JSON.stringify(montarGrade(caca.palavras, caca.tamanho).grade) === JSON.stringify(grade.grade));
const pr = lerPronuncia("lingua: en-US\nHello | Olá | /arquivos/0123456789abcdef0123.webm\nBye | Tchau | javascript:alert(1)");
conferir("pronúncia: áudio do site aceito, endereço estranho recusado", pr.lingua === "en-US" && pr.frases[0].audio.endsWith(".webm") && pr.frases[1].audio === "");
conferir("bloco interativo é reconhecido pelo editor", tipoDe("```forca\ncasa | onde se mora\n```") === "interativo" && tipoDe("```python\nprint(1)\n```") === "codigo");
const comBranco = "Antes.\n\n```teste\n? Um\n= 1\n\n? Dois\n= 2\n```\n\nDepois.";
conferir("teste com linha em branco continua um bloco só", partir(comBranco).length === 3);

// ───────────── Blocos de ciência, mapa, programação e jogos de montar ─────────────

const sim = lerSimulacao(MODELOS_INTERATIVOS.simulacao.modelo);
conferir("simulação: rampa, bola, caixa e pêndulo do modelo", sim.corpos.map((c) => c.tipo).join() === "rampa,bola,caixa,pendulo", sim.corpos.map((c) => c.tipo).join());
conferir("simulação: nome, raio com vírgula e cor", sim.corpos[1].nome === "A" && Math.abs(sim.corpos[1].raio - 0.4) < 1e-9 && sim.corpos[1].cor.startsWith("#"));
conferir("simulação: gravidade e o que mostrar", sim.gravidade === 9.8 && sim.mostrar.join() === "A");
conferir("simulação: valor absurdo não entra", lerSimulacao("bola em (500, 2)").corpos.length === 0 && lerSimulacao("gravidade: 999\nbola em (2, 2)").gravidade === 9.8);
conferir("simulação: velocidade dentro de palavra não confunde (de)", lerSimulacao("bola em (2, 3) velocidade (4, 1)").corpos[0].vx === 4 && lerSimulacao("bola em (2, 3) velocidade (4, 1)").corpos[0].x === 2);

const geo = lerGeometria(MODELOS_INTERATIVOS.geometria.modelo);
const pos = posicoesDaGeometria(geo);
conferir("geometria: triângulo 3-4-5", Math.abs(distancia(pos.B, pos.C) - 5) < 1e-9 && Math.abs(areaDoPoligono([pos.A, pos.B, pos.C]) - 6) < 1e-9 && Math.abs(anguloEm(pos.B, pos.A, pos.C) - 90) < 1e-9);
const comMeio = lerGeometria("A = (0, 0)\nB = (4, 2)\nM = meio A B\nsegmento A M");
conferir("geometria: ponto médio acompanha o arrasto", posicoesDaGeometria(comMeio, { B: { x: 6, y: 6 } }).M.x === 3 && comMeio.objetos.length === 1);
conferir("geometria: objeto com ponto que não existe fica de fora", lerGeometria("A = (0, 0)\nsegmento A Z").objetos.length === 0);

const mapa = lerMapa(MODELOS_INTERATIVOS.mapa.modelo);
conferir("mapa: pontos com vírgula decimal e rota", mapa.pontos[0].lat === 38.72 && mapa.pontos[0].lon === -9.14 && mapa.rotas[0].trecho.length === 7 && mapa.destaques.join() === "Portugal,Índia");
conferir("mapa: coordenada impossível recusada", lerMapa("ponto 120 10 | x").pontos.length === 0 && parDeNumeros("(38.7, -9.1)")?.[1] === -9.1);
conferir("mapa: nome comparável sem acento e sem artigo", nomeDeLugar("os Estados Unidos") === "estados unidos" && nomeDeLugar("Índia") === "india");

const prog = lerProgramacao(MODELOS_INTERATIVOS.programacao.modelo);
conferir("programação: categorias com acento e plural", prog.categorias.join() === "lacos,matematica,texto,variaveis" && prog.esperado === "1\n2\n3\n4\n5");
conferir("programação: sem 'blocos:' vêm todas as gavetas", lerProgramacao("objetivo: x").categorias.length === 7);
const rod = lerRodar(MODELOS_INTERATIVOS.rodar.modelo);
conferir("código para rodar: linguagem, código e saída esperada", rod.linguagem === "python" && rod.codigo.startsWith("nome =") && rod.esperado === "Olá, Lúcia 0\nOlá, Lúcia 1\nOlá, Lúcia 2");
conferir("código para rodar: saída confere sem ligar para espaço no fim", saidaConfere("1 \n2\n\n", "1\n2") && !saidaConfere("1\n3", "1\n2"));

conferir("cena: modelo com duas áreas e modo", lerCena(MODELOS_INTERATIVOS.cena.modelo)?.areas.length === 2);
conferir("cena: imagem de fora do site é recusada", lerCena("imagem: https://exemplo.com/a.png\nx | 1 1 10 10") === null && lerCena("imagem: /arquivos/../segredo.png\nx | 1 1 10 10") === null);
const arr = lerArrastar(MODELOS_INTERATIVOS.arrastar.modelo);
conferir("arrastar: três grupos de três itens", arr.grupos.length === 3 && arr.grupos.every((g) => g.itens.length === 3));
conferir("arrastar: um grupo só não vira jogo", lerArrastar("A: x, y").grupos.length === 0);
const mus = lerMusica(MODELOS_INTERATIVOS.musica.modelo);
conferir("música: tempos em segundos e tradução", mus.linhas[0].t === 5 && mus.linhas[1].t === 12 && mus.linhas[0].traducao.startsWith("tradução") && mus.lingua === "es-ES");
conferir("música: áudio de fora é recusado", lerMusica("audio: https://x.com/a.mp3\n0:01 | a").audio === "" && segundos("1:05,5") === 65.5);

// Moléculas: a forma que a escola ensina.
const angulos = (m, c) => {
  const viz = m.ligacoes.filter((l) => l.a === c || l.b === c).map((l) => (l.a === c ? l.b : l.a));
  const r = [];
  for (let i = 0; i < viz.length; i++) for (let j = i + 1; j < viz.length; j++) {
    const [A, C, B] = [m.atomos[viz[i]], m.atomos[c], m.atomos[viz[j]]];
    const u = [A.x - C.x, A.y - C.y, A.z - C.z], v = [B.x - C.x, B.y - C.y, B.z - C.z];
    r.push((Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v))))) * 180) / Math.PI);
  }
  return r;
};
const agua = moleculaDe("água").mol;
conferir("molécula: água angular, perto de 104,5°", formula(agua) === "H₂O" && Math.abs(angulos(agua, 0)[0] - 104.5) < 2);
const metano = moleculaDe("metano").mol;
conferir("molécula: metano tetraédrico (109,5°)", angulos(metano, 0).every((a) => Math.abs(a - 109.47) < 2));
const sf6 = moleculaDe("SF6").mol;
conferir("molécula: SF6 octaédrico (90° e 180°)", angulos(sf6, 1).every((a) => Math.abs(a - 90) < 3 || Math.abs(a - 180) < 3));
const xef4 = moleculaDe("xef4").mol;
conferir("molécula: XeF4 quadrado plano", angulos(xef4, 1).filter((a) => Math.abs(a - 180) < 3).length === 2);
const benzeno = moleculaDe("benzeno").mol;
conferir("molécula: benzeno plano, 120° e seis hidrogênios", formula(benzeno) === "C₆H₆" && angulos(benzeno, 0).every((a) => Math.abs(a - 120) < 3));
conferir("molécula: cafeína com a fórmula certa", formula(moleculaDe("cafeína").mol) === "C₈H₁₀N₄O₂");
const naftaleno = moleculaDe("c1ccc2ccccc2c1").mol;
conferir("molécula: anéis fundidos sem ligação esticada", naftaleno.ligacoes.every((l) => {
  const [a, b] = [naftaleno.atomos[l.a], naftaleno.atomos[l.b]];
  return Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - comprimentoDaLigacao(a.el, b.el, l.ordem)) < 0.1;
}));
conferir("molécula: SMILES inválido não trava", moleculaDe("C(C") === null && lerSmiles("C1CC") === null);
conferir("molécula: toda a biblioteca monta", BIBLIOTECA.every((b) => moleculaDe(b.nomes[0]) !== null));
conferir("molécula: XYZ pronto vira ligações pela distância", moleculaDe("", [{ el: "O", x: 0, y: 0, z: 0 }, { el: "H", x: 0.96, y: 0, z: 0 }, { el: "H", x: -0.24, y: 0.93, z: 0 }]).mol.ligacoes.length === 2);
const lido = lerMolecula("etanol\nestilo: bolas\nrotulos: sim");
conferir("molécula: opções do bloco", lido.entrada === "etanol" && lido.estilo === "bolas" && lido.rotulos);

for (const f of falhas.slice(0, 20)) console.log(`  ✗ ${f}`);
console.log(`blocos: ${ok} conferências certas, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
