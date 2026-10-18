// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ArquivoDoProjeto } from "./zip";

export type Perfil = "python" | "php" | "web" | "js" | "sql";

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

export const PERFIS: Record<Perfil, { nome: string; principal: string; exemplo: ArquivoDoProjeto[]; download: string; naoRoda: string[] }> = {
  python: {
    nome: "Python",
    principal: "main.py",
    exemplo: [{ nome: "main.py", conteudo: 'nome = input("Como você se chama? ") or "mundo"\nprint(f"Olá, {nome}!")\n\nfor n in range(1, 6):\n    print(n, "x 7 =", n * 7)\n' }],
    download: "cerca de 12 MB na primeira vez (Pyodide, fica guardado no navegador)",
    naoRoda: ["bibliotecas com partes em C fora do Pyodide (ex.: tensorflow)", "acesso à rede e a arquivos do seu computador", "programas gráficos (tkinter, pygame)"],
  },
  php: {
    nome: "PHP",
    principal: "index.php",
    exemplo: [{ nome: "index.php", conteudo: '<?php\n$nome = "mundo";\necho "Olá, $nome!\\n";\nfor ($i = 1; $i <= 5; $i++) {\n    echo "$i x 7 = " . ($i * 7) . "\\n";\n}\n' }],
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
    download: "nada: roda direto",
    naoRoda: ["DOM (use o perfil Web)", "módulos de npm", "rede"],
  },
  sql: {
    nome: "SQL (PostgreSQL no navegador)",
    principal: "consulta.sql",
    exemplo: [{ nome: "consulta.sql", conteudo: "-- As tabelas de exemplo (alunos, turmas, notas) já existem.\nselect t.nome as turma, count(*) as alunos, round(avg(n.nota), 1) as media\nfrom alunos a\njoin turmas t on t.id = a.turma\njoin notas n on n.aluno = a.id\ngroup by t.nome\norder by media desc;\n" }],
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
