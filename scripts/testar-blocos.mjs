// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o editor por blocos: cortar o Markdown em blocos e juntar de novo não pode mudar a aula.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { comMarcas, miolo, partir, textoPuro, tipoDe } from "../lib/blocos.ts";
import { expressaoSegura, lacunaCerta, lerCacaPalavras, lerCalculadora, lerDados, lerForca, lerGrafico, lerPares, lerPronuncia, lerTeste, MODELOS_INTERATIVOS, montarGrade, numeroCerto } from "../lib/interativos.ts";

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

for (const f of falhas.slice(0, 20)) console.log(`  ✗ ${f}`);
console.log(`blocos: ${ok} conferências certas, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
