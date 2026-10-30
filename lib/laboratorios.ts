// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ArquivoDoProjeto } from "./zip";

export type Perfil = "python" | "js" | "ts" | "web" | "cpp" | "php" | "ruby" | "lua" | "sql";

/** Um teste automático de exercício. Tudo roda no navegador; nada vai para servidor. */
export type Teste =
  | { tipo: "saida"; esperado: string }
  | { tipo: "contem"; texto: string }
  | { tipo: "regex"; padrao: string }
  | { tipo: "html"; seletor: string; texto?: string }
  | { tipo: "linhas"; esperado: unknown[][] };

export interface Exercicio {
  id: string;
  perfil: Perfil;
  titulo: string;
  enunciado: string;
  arquivos: ArquivoDoProjeto[];
  entrada?: string;
  testes: Teste[];
  dicas: string[];
  solucao?: ArquivoDoProjeto[];
  nivel: 1 | 2 | 3;
}

export interface DadosDoPerfil {
  nome: string;
  principal: string;
  exemplo: ArquivoDoProjeto[];
  /** Outros projetos prontos para começar (o exemplo é sempre o primeiro). */
  modelos?: { nome: string; arquivos: ArquivoDoProjeto[]; entrada?: string }[];
  /** O que vai no campo de entradas quando se abre o exemplo. */
  entrada?: string;
  download: string;
  /** Precisa de aceite antes de baixar o interpretador (o que passa de uns poucos megabytes). */
  pesado?: boolean;
  /** Lê do campo de entradas (input, gets, cin, io.read, prompt). */
  le?: boolean;
  naoRoda: string[];
}

/** A ordem é a dos botões na página. */
export const PERFIS: Record<Perfil, DadosDoPerfil> = {
  python: {
    nome: "Python",
    principal: "main.py",
    exemplo: [{ nome: "main.py", conteudo: 'nome = input("Como você se chama? ") or "mundo"\nprint(f"Olá, {nome}!")\n\nfor n in range(1, 6):\n    print(n, "x 7 =", n * 7)\n' }],
    modelos: [
      { nome: "Jogo de adivinhação", entrada: "50\n25\n37\n31\n34", arquivos: [{ nome: "main.py", conteudo: 'import random\n\nrandom.seed(7)  # tire esta linha para o número mudar a cada vez\nsecreto = random.randint(1, 100)\nprint("Pensei num número de 1 a 100.")\nfor tentativa in range(1, 8):\n    palpite = input(f"Tentativa {tentativa}: ")\n    if not palpite:\n        break\n    n = int(palpite)\n    if n == secreto:\n        print(f"Acertou em {tentativa} tentativa(s)!")\n        break\n    print("Maior." if n < secreto else "Menor.")\nelse:\n    print("Era", secreto)\n' }] },
      { nome: "Média da turma (com módulo)", arquivos: [{ nome: "main.py", conteudo: 'from notas import media, situacao\n\nturma = {"Ana": [8.5, 9, 7.5], "Bruno": [6, 7.5, 5], "Carla": [9.5, 8, 10]}\nfor nome, notas in turma.items():\n    m = media(notas)\n    print(f"{nome:<6} {m:4.1f}  {situacao(m)}")\n' }, { nome: "notas.py", conteudo: 'def media(notas):\n    return sum(notas) / len(notas)\n\n\ndef situacao(m):\n    return "aprovado(a)" if m >= 7 else "recuperação"\n' }] },
      { nome: "Gráfico de barras no texto", arquivos: [{ nome: "main.py", conteudo: 'votos = {"Saúde": 42, "Educação": 57, "Transporte": 23, "Moradia": 35}\ntotal = sum(votos.values())\nfor tema, n in sorted(votos.items(), key=lambda x: -x[1]):\n    barra = "█" * round(n / total * 40)\n    print(f"{tema:<11} {barra} {n / total:.0%}")\n' }] },
    ],
    entrada: "Lúcia",
    le: true,
    pesado: true,
    download: "cerca de 12 MB na primeira vez (Pyodide, fica guardado no navegador)",
    naoRoda: ["bibliotecas com partes em C fora do Pyodide (ex.: tensorflow)", "acesso à rede e a arquivos do seu computador", "programas gráficos (tkinter, pygame)"],
  },
  php: {
    nome: "PHP",
    principal: "index.php",
    exemplo: [{ nome: "index.php", conteudo: '<?php\n$nome = "mundo";\necho "Olá, $nome!\\n";\nfor ($i = 1; $i <= 5; $i++) {\n    echo "$i x 7 = " . ($i * 7) . "\\n";\n}\n' }],
    pesado: true,
    download: "cerca de 6 MB na primeira vez (php-wasm)",
    naoRoda: ["banco de dados MySQL (use o perfil SQL)", "extensões além das embutidas", "acesso à rede"],
  },
  web: {
    nome: "Web (HTML, CSS e JavaScript)",
    principal: "index.html",
    exemplo: [
      { nome: "index.html", conteudo: '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <title>Minha página</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Olá, mundo!</h1>\n  <button id="botao">Clique</button>\n  <p id="saida"></p>\n  <script src="script.js"></script>\n</body>\n</html>\n' },
      { nome: "style.css", conteudo: "body { font-family: sans-serif; margin: 2rem; background: #f4ecd8; color: #17130e; }\nbutton { padding: .5rem 1rem; }\n" },
      { nome: "script.js", conteudo: 'let vezes = 0;\ndocument.getElementById("botao").addEventListener("click", () => {\n  vezes++;\n  document.getElementById("saida").textContent = `Você clicou ${vezes} vez(es).`;\n  console.log("clique", vezes);\n});\n' },
    ],
    download: "nada: roda direto",
    naoRoda: ["pedidos de rede (fetch) para fora", "cookies e armazenamento do site", "abrir janelas"],
  },
  js: {
    nome: "JavaScript (console)",
    principal: "main.js",
    exemplo: [{ nome: "main.js", conteudo: 'const numeros = [3, 1, 4, 1, 5, 9, 2, 6];\nconsole.log("ordenados:", [...numeros].sort((a, b) => a - b));\nconsole.log("soma:", numeros.reduce((s, n) => s + n, 0));\n' }],
    modelos: [
      { nome: "Fila do posto de saúde", arquivos: [{ nome: "main.js", conteudo: 'const fila = [];\nconst chegar = (nome, prioridade = false) => (prioridade ? fila.unshift(nome) : fila.push(nome));\nchegar("Ana");\nchegar("Bruno");\nchegar("Dona Cida", true);\nchegar("Davi");\nwhile (fila.length) console.log("Atendendo:", fila.shift(), "· ainda na fila:", fila.length);\n' }] },
      { nome: "Pergunta com prompt", entrada: "Lúcia\n17", arquivos: [{ nome: "main.js", conteudo: 'const nome = prompt("Seu nome?") ?? "mundo";\nconst idade = Number(prompt("Sua idade?") ?? 0);\nconsole.log(`Olá, ${nome}!`, idade >= 16 ? "Você já pode votar." : `Faltam ${16 - idade} ano(s) para votar.`);\n' }] },
    ],
    le: true,
    download: "nada: roda direto",
    naoRoda: ["DOM (use o perfil Web)", "módulos de npm", "rede"],
  },
  ts: {
    nome: "TypeScript",
    principal: "main.ts",
    exemplo: [
      { nome: "main.ts", conteudo: 'import { type Aluno, media } from "./notas";\n\nconst turma: Aluno[] = [\n  { nome: "Ana", notas: [8.5, 9, 7.5] },\n  { nome: "Bruno", notas: [6, 7.5, 5] },\n];\n\nfor (const a of turma) {\n  const m = media(a.notas);\n  console.log(`${a.nome}: ${m.toFixed(1)} ${m >= 7 ? "aprovado(a)" : "recuperação"}`);\n}\n\n// Tire o comentário da linha abaixo para ver o erro de tipo:\n// media("dez");\n' },
      { nome: "notas.ts", conteudo: "export interface Aluno {\n  nome: string;\n  notas: number[];\n}\n\nexport function media(notas: number[]): number {\n  return notas.reduce((s, n) => s + n, 0) / notas.length;\n}\n" },
    ],
    le: true,
    pesado: true,
    download: "cerca de 10 MB na primeira vez (o compilador oficial do TypeScript)",
    naoRoda: ["DOM (use o perfil Web)", "pacotes de npm", "rede"],
  },
  cpp: {
    nome: "C e C++",
    principal: "main.cpp",
    exemplo: [{ nome: "main.cpp", conteudo: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cout << "Tabuada de qual número? ";\n    cin >> n;\n    cout << endl;\n    for (int i = 1; i <= 10; i++) {\n        cout << n << " x " << i << " = " << n * i << endl;\n    }\n    return 0;\n}\n' }],
    entrada: "7",
    modelos: [
      { nome: "C: média com scanf", entrada: "4\n8.5 7 9 6.5", arquivos: [{ nome: "main.c", conteudo: '#include <stdio.h>\n\nint main() {\n    int n;\n    double nota, soma = 0;\n    scanf("%d", &n);\n    for (int i = 0; i < n; i++) {\n        scanf("%lf", &nota);\n        soma += nota;\n    }\n    printf("Média: %.2f\\n", soma / n);\n    return 0;\n}\n' }] },
      { nome: "C++: vetor e função", arquivos: [{ nome: "main.cpp", conteudo: '#include <iostream>\nusing namespace std;\n\nint maior(int v[], int n) {\n    int m = v[0];\n    for (int i = 1; i < n; i++) if (v[i] > m) m = v[i];\n    return m;\n}\n\nint main() {\n    int v[] = {3, 41, 7, 19, 28};\n    cout << "Maior: " << maior(v, 5) << endl;\n    return 0;\n}\n' }] },
    ],
    le: true,
    download: "cerca de 1 MB na primeira vez (interpretador JSCPP)",
    naoRoda: ["a biblioteca padrão inteira: vector, string e map ainda não (use vetores e char[])", "vários arquivos com #include de arquivo próprio (escreva tudo em um arquivo)", "templates e classes complexas"],
  },
  ruby: {
    nome: "Ruby",
    principal: "main.rb",
    exemplo: [{ nome: "main.rb", conteudo: 'print "Seu nome: "\nnome = gets&.chomp\nnome = "mundo" if nome.nil? || nome.empty?\nputs "Olá, #{nome}!"\n\n[3, 1, 4, 1, 5].sort.each_with_index { |n, i| puts "#{i + 1}º: #{n}" }\n' }],
    entrada: "Lúcia",
    le: true,
    pesado: true,
    download: "cerca de 30 MB na primeira vez (Ruby 3.4 oficial em WebAssembly, fica guardado no navegador)",
    naoRoda: ["gems que não vêm com o Ruby", "rede e arquivos do seu computador", "Rails"],
  },
  lua: {
    nome: "Lua",
    principal: "main.lua",
    exemplo: [{ nome: "main.lua", conteudo: 'local frutas = { "caju", "acerola", "cupuaçu", "pitanga" }\nfor i, f in ipairs(frutas) do\n  print(i, f)\nend\n\nlocal function fatorial(n)\n  if n <= 1 then return 1 end\n  return n * fatorial(n - 1)\nend\nprint("10! =", fatorial(10))\n' }],
    le: true,
    download: "menos de 1 MB (Lua 5.4 oficial em WebAssembly)",
    naoRoda: ["bibliotecas em C (LuaRocks)", "acesso a arquivos do seu computador", "LÖVE e jogos gráficos"],
  },
  sql: {
    nome: "SQL (PostgreSQL no navegador)",
    principal: "consulta.sql",
    exemplo: [{ nome: "consulta.sql", conteudo: "-- As tabelas de exemplo (alunos, turmas, notas) já existem.\nselect t.nome as turma, count(*) as alunos, round(avg(n.nota), 1) as media\nfrom alunos a\njoin turmas t on t.id = a.turma\njoin notas n on n.aluno = a.id\ngroup by t.nome\norder by media desc;\n" }],
    pesado: true,
    download: "cerca de 3 MB na primeira vez (PGlite)",
    naoRoda: ["extensões do PostgreSQL", "conexão com um banco de fora", "mais de 20 MB de dados"],
  },
};

/** As tabelas de exemplo do perfil SQL. */
export const SQL_EXEMPLO = `
create table turmas (id int primary key, nome text not null);
create table alunos (id int primary key, nome text not null, turma int references turmas(id), nascimento date);
create table notas (aluno int references alunos(id), disciplina text, nota numeric(4,1));
insert into turmas values (1, '1º ano A'), (2, '1º ano B'), (3, '2º ano A');
insert into alunos values (1, 'Ana', 1, '2009-03-12'), (2, 'Bruno', 1, '2009-07-01'), (3, 'Carla', 2, '2009-11-23'), (4, 'Davi', 2, '2008-12-30'), (5, 'Elisa', 3, '2008-05-05'), (6, 'Fábio', 3, '2008-01-19');
insert into notas values (1, 'matemática', 8.5), (1, 'história', 9.0), (2, 'matemática', 6.0), (2, 'história', 7.5), (3, 'matemática', 9.5), (3, 'história', 8.0), (4, 'matemática', 5.5), (4, 'história', 6.5), (5, 'matemática', 7.0), (5, 'história', 9.5), (6, 'matemática', 8.0), (6, 'história', 7.0);
`;

const normal = (s: string) => s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();

/** Confere os testes de saída (texto) de um exercício. Devolve, para cada teste, se passou. */
export function conferirSaida(testes: Teste[], saida: string): boolean[] {
  return testes.map((t) => {
    if (t.tipo === "saida") return normal(saida) === normal(t.esperado);
    if (t.tipo === "contem") return normal(saida).includes(normal(t.texto));
    if (t.tipo === "regex") return new RegExp(t.padrao, "m").test(saida);
    return false;
  });
}

/** Testes de HTML: o documento montado precisa ter o seletor (e, se pedido, o texto). */
export function conferirHtml(testes: Teste[], documento: string): boolean[] {
  const dom = new DOMParser().parseFromString(documento, "text/html");
  return testes.map((t) => {
    if (t.tipo !== "html") return false;
    const el = dom.querySelector(t.seletor);
    if (!el) return false;
    return t.texto ? (el.textContent ?? "").toLowerCase().includes(t.texto.toLowerCase()) : true;
  });
}

/** Testes de SQL: as linhas devolvidas (comparadas como texto). */
export function conferirLinhas(testes: Teste[], linhas: unknown[][]): boolean[] {
  const texto = (l: unknown[][]) => JSON.stringify(l.map((r) => r.map((c) => String(c ?? "").trim())));
  return testes.map((t) => (t.tipo === "linhas" ? texto(linhas) === texto(t.esperado) : false));
}

/** Rascunho do projeto neste aparelho (só aqui; nada vai para servidor). */
export const chaveDoRascunho = (perfil: Perfil, exercicio?: string) => `lucia:lab:${perfil}:${exercicio ?? "livre"}`;

/**
 * Os baralhos do jogo Rumos (lib/rumos.ts), na ordem da página de jogos. Cada um mora em content/jogos/rumos-<id>.json,
 * é importado em app/[lang]/laboratorios/jogos/page.tsx e passa pelo validador no build e em `npm run testar:jogos`.
 */
export const BARALHOS_DE_RUMOS = ["historia-do-brasil", "filosofia-e-sociologia", "politica-e-cidadania", "revisao-enem"] as const;
