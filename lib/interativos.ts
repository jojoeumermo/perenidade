// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Blocos interativos das aulas. Cada um é uma cerca de código com um "idioma" próprio (```grafico, ```teste…) e só
// guarda dados, em linhas simples que qualquer pessoa escreve sem decorar sintaxe. Este arquivo só lê esses dados
// (sem React), para o roteiro de conferência (npm run testar:blocos) rodar direto no Node. Sem os atalhos "@/".

export const INTERATIVOS = ["grafico", "calculadora", "dados", "teste", "cartoes", "memoria", "forca", "cacapalavras", "pronuncia", "diagrama", "linhadotempo", "desenho", "ferramenta"] as const;
export type Interativo = (typeof INTERATIVOS)[number];
export const eInterativo = (lingua: string): lingua is Interativo => (INTERATIVOS as readonly string[]).includes(lingua);

const linhasDe = (spec: string) => spec.replace(/\r\n?/g, "\n").split("\n");
const numero = (texto: string) => Number(texto.trim().replace(",", "."));
/** Só letras, números, espaço e os sinais da matemática: nada de chamar funções do JavaScript ou mexer em objetos. */
export const expressaoSegura = (expr: string) => expr.length <= 200 && /^[\w\s+\-*/^().,π√²³]*$/.test(expr) && !/(import|evaluate|parse|compile|createUnit|simplify|derivative|resolve|config|reviver)/.test(expr);
const normalizarExpressao = (expr: string) => expr.replace(/π/g, "pi").replace(/√/g, "sqrt").replace(/²/g, "^2").replace(/³/g, "^3").replace(/,(?=\d)/g, ".");

// ───────────── Gráfico de função com controles ─────────────

export interface Grafico {
  funcoes: { nome: string; expr: string }[];
  parametros: { nome: string; valor: number; min: number; max: number; passo: number }[];
  x: [number, number];
  y: [number, number] | null;
  pontos: { x: number; y: number; rotulo: string }[];
}

/**
 * y = a*x^2 + b*x + c
 * a = 1 [-5, 5]
 * x de -10 a 10
 * ponto (1, 2) A
 */
export function lerGrafico(spec: string): Grafico {
  const g: Grafico = { funcoes: [], parametros: [], x: [-10, 10], y: null, pontos: [] };
  for (const bruta of linhasDe(spec)) {
    const linha = bruta.trim();
    if (!linha || linha.startsWith("#")) continue;
    let m = /^([xy])\s+de\s+(-?[\d.,]+)\s+a\s+(-?[\d.,]+)$/i.exec(linha);
    if (m) {
      const faixa: [number, number] = [numero(m[2]), numero(m[3])];
      if (faixa.every(Number.isFinite) && faixa[0] < faixa[1]) {
        if (m[1].toLowerCase() === "x") g.x = faixa;
        else g.y = faixa;
      }
      continue;
    }
    // ponto (1, 2) ou, com vírgula decimal, ponto (1,5; 2)
    m = /^ponto\s*\(([^)]*)\)\s*(.*)$/i.exec(linha);
    if (m) {
      const [px = "", py = ""] = m[1].split(m[1].includes(";") ? ";" : ",");
      const p = { x: numero(px), y: numero(py), rotulo: m[2].slice(0, 30) };
      if (Number.isFinite(p.x) && Number.isFinite(p.y) && g.pontos.length < 20) g.pontos.push(p);
      continue;
    }
    m = /^([a-wz]|[a-z]{2,8})\s*=\s*(-?[\d.,]+)\s*(?:\[\s*(-?[\d.,]+)\s*[,;]\s*(-?[\d.,]+)\s*(?:[,;]\s*([\d.,]+))?\s*\])?$/i.exec(linha);
    if (m && !/^(y|f|g|h)$/i.test(m[1])) {
      const valor = numero(m[2]);
      const min = m[3] !== undefined ? numero(m[3]) : valor - 10;
      const max = m[4] !== undefined ? numero(m[4]) : valor + 10;
      const passo = m[5] !== undefined ? numero(m[5]) : Math.max(0.01, Math.round(((max - min) / 100) * 100) / 100);
      if ([valor, min, max, passo].every(Number.isFinite) && min < max && g.parametros.length < 6) g.parametros.push({ nome: m[1], valor, min, max, passo });
      continue;
    }
    m = /^(y|[fgh]\s*\(\s*x\s*\))\s*=\s*(.+)$/i.exec(linha);
    if (m && g.funcoes.length < 4 && expressaoSegura(m[2])) g.funcoes.push({ nome: m[1].replace(/\s+/g, ""), expr: normalizarExpressao(m[2]) });
  }
  return g;
}

// ───────────── Calculadora de variáveis ─────────────

export interface Calculadora {
  resultado: { nome: string; expr: string; rotulo: string };
  campos: { nome: string; valor: number; rotulo: string }[];
}

/**
 * v = d / t | velocidade (m/s)
 * d = 100 | distância (m)
 * t = 9,58 | tempo (s)
 */
export function lerCalculadora(spec: string): Calculadora | null {
  const linhas = linhasDe(spec).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const primeira = /^([a-zA-Z]\w{0,15})\s*=\s*([^|]+?)\s*(?:\|\s*(.*))?$/.exec(linhas[0] ?? "");
  if (!primeira || !expressaoSegura(primeira[2])) return null;
  const campos = linhas
    .slice(1)
    .map((l) => /^([a-zA-Z]\w{0,15})\s*=\s*(-?[\d.,]+)\s*(?:\|\s*(.*))?$/.exec(l))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ nome: m[1], valor: numero(m[2]), rotulo: (m[3] ?? m[1]).slice(0, 60) }))
    .filter((c) => Number.isFinite(c.valor))
    .slice(0, 8);
  return { resultado: { nome: primeira[1], expr: normalizarExpressao(primeira[2]), rotulo: (primeira[3] ?? primeira[1]).slice(0, 60) }, campos };
}

// ───────────── Gráficos de dados ─────────────

export interface Dados {
  tipo: "barras" | "linhas" | "pizza";
  titulo: string;
  cabecalho: string[];
  linhas: { rotulo: string; valores: number[] }[];
}

/**
 * tipo: barras
 * titulo: Chuva em 2024
 * Mês | Chuva (mm)
 * Jan | 120
 */
export function lerDados(spec: string): Dados {
  const d: Dados = { tipo: "barras", titulo: "", cabecalho: [], linhas: [] };
  for (const bruta of linhasDe(spec)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const opcao = /^(tipo|titulo|título)\s*:\s*(.*)$/i.exec(linha);
    if (opcao) {
      if (opcao[1].toLowerCase() === "tipo") {
        const t = opcao[2].trim().toLowerCase();
        d.tipo = t.startsWith("lin") ? "linhas" : t.startsWith("piz") ? "pizza" : "barras";
      } else d.titulo = opcao[2].trim().slice(0, 120);
      continue;
    }
    if (!linha.includes("|")) continue;
    const celulas = linha.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (/^[-:\s]+$/.test(celulas.join(""))) continue;
    if (!d.cabecalho.length && celulas.slice(1).some((c) => !Number.isFinite(numero(c)))) {
      d.cabecalho = celulas.slice(0, 4);
      continue;
    }
    if (d.linhas.length < 40) d.linhas.push({ rotulo: celulas[0].slice(0, 40), valores: celulas.slice(1, 4).map(numero).map((v) => (Number.isFinite(v) ? v : 0)) });
  }
  if (!d.cabecalho.length) d.cabecalho = ["", ...Array.from({ length: Math.max(1, ...d.linhas.map((l) => l.valores.length)) }, (_, i) => `Série ${i + 1}`)];
  return d;
}

// ───────────── Testes autocorrigíveis ─────────────

export type Questao =
  | { tipo: "escolha"; enunciado: string; opcoes: { texto: string; certa: boolean; retorno: string }[]; explicacao: string }
  | { tipo: "vf"; enunciado: string; resposta: boolean; explicacao: string }
  | { tipo: "numero"; enunciado: string; resposta: number; tolerancia: number; explicacao: string }
  | { tipo: "lacunas"; enunciado: string; respostas: string[][]; explicacao: string }
  | { tipo: "ordenar"; enunciado: string; itens: string[]; explicacao: string };

/**
 * Uma pergunta por grupo (linha em branco separa):
 * ? Enunciado            (com ___ para lacunas)
 * + certa / - errada >> retorno daquela alternativa
 * = verdadeiro | falso    (V ou F)
 * = 56 ± 0,5              (resposta numérica com tolerância)
 * = Brasília | Brasilia   (uma linha por lacuna, alternativas aceitas separadas por |)
 * * item                  (itens na ordem certa: a pessoa reordena)
 * > explicação
 */
export function lerTeste(spec: string): Questao[] {
  const grupos = spec.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  const saida: Questao[] = [];
  for (const grupo of grupos) {
    const linhas = grupo.split("\n").map((l) => l.trim()).filter(Boolean);
    const enunciado = linhas.find((l) => l.startsWith("?"))?.slice(1).trim();
    if (!enunciado) continue;
    const explicacao = linhas.filter((l) => /^>(?!>)/.test(l)).map((l) => l.slice(1).trim()).join(" ");
    const opcoes = linhas.filter((l) => /^[+-]\s/.test(l)).map((l) => {
      const [texto, retorno = ""] = l.slice(2).split(">>");
      return { texto: texto.trim(), certa: l.startsWith("+"), retorno: retorno.trim() };
    });
    const iguais = linhas.filter((l) => l.startsWith("=")).map((l) => l.slice(1).trim());
    const itens = linhas.filter((l) => /^\*\s/.test(l)).map((l) => l.slice(2).trim());
    if (opcoes.length >= 2 && opcoes.filter((o) => o.certa).length === 1) {
      saida.push({ tipo: "escolha", enunciado, opcoes, explicacao });
    } else if (itens.length >= 2) {
      saida.push({ tipo: "ordenar", enunciado, itens, explicacao });
    } else if (enunciado.includes("___") && iguais.length) {
      saida.push({ tipo: "lacunas", enunciado, respostas: iguais.map((r) => r.split("|").map((x) => x.trim()).filter(Boolean)), explicacao });
    } else if (iguais.length === 1 && /^(v|verdadeiro|f|falso|true|false)$/i.test(iguais[0])) {
      saida.push({ tipo: "vf", enunciado, resposta: /^(v|verdadeiro|true)$/i.test(iguais[0]), explicacao });
    } else if (iguais.length === 1) {
      const m = /^(-?[\d.,]+)\s*(?:(?:±|\+-|\+\/-)\s*([\d.,]+))?/.exec(iguais[0]);
      if (m && Number.isFinite(numero(m[1]))) saida.push({ tipo: "numero", enunciado, resposta: numero(m[1]), tolerancia: m[2] ? numero(m[2]) : 0, explicacao });
    }
  }
  return saida.slice(0, 30);
}

const comparar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const lacunaCerta = (aceitas: string[], dada: string) => aceitas.some((a) => comparar(a) === comparar(dada));
export const numeroCerto = (q: { resposta: number; tolerancia: number }, dada: string) => Math.abs(numero(dada) - q.resposta) <= q.tolerancia + 1e-9;

// ───────────── Pares (cartões, jogo da memória), forca, caça-palavras, pronúncia, linha do tempo ─────────────

/** "frente = verso" por linha; "lingua: en-US" escolhe a voz da pronúncia. */
export function lerPares(spec: string): { lingua: string; pares: { a: string; b: string }[] } {
  let lingua = "";
  const pares: { a: string; b: string }[] = [];
  for (const bruta of linhasDe(spec)) {
    const linha = bruta.trim();
    const l = /^(lingua|língua|idioma)\s*:\s*([a-z]{2}(?:-[A-Z]{2})?)$/i.exec(linha);
    if (l) {
      lingua = l[2];
      continue;
    }
    const i = linha.indexOf("=");
    if (i > 0 && pares.length < 40) pares.push({ a: linha.slice(0, i).trim().slice(0, 120), b: linha.slice(i + 1).trim().slice(0, 200) });
  }
  return { lingua, pares: pares.filter((p) => p.a && p.b) };
}

/** "palavra | dica" por linha. */
export function lerForca(spec: string): { palavra: string; dica: string }[] {
  return linhasDe(spec)
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter(([p]) => p && /^[\p{L} -]{2,30}$/u.test(p))
    .map(([palavra, dica = ""]) => ({ palavra: palavra.toUpperCase(), dica: dica.slice(0, 160) }))
    .slice(0, 30);
}

/** Uma palavra por linha (só letras); "tamanho: 12" opcional. */
export function lerCacaPalavras(spec: string): { palavras: string[]; tamanho: number } {
  let tamanho = 0;
  const palavras: string[] = [];
  for (const bruta of linhasDe(spec)) {
    const linha = bruta.trim();
    const t = /^tamanho\s*:\s*(\d+)$/i.exec(linha);
    if (t) {
      tamanho = Math.min(16, Math.max(6, Number(t[1])));
      continue;
    }
    const p = linha.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
    if (p.length >= 2 && p.length <= 14 && palavras.length < 15) palavras.push(p);
  }
  return { palavras, tamanho: tamanho || Math.min(16, Math.max(8, ...palavras.map((p) => p.length + 2))) };
}

/** Gerador de números previsível: a mesma lista de palavras monta sempre a mesma grade. */
function sorteador(semente: string) {
  let h = 2166136261;
  for (const c of semente) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Monta a grade do caça-palavras: horizontal, vertical e diagonal, sem palavra de trás para a frente. */
export function montarGrade(palavras: string[], tamanho: number) {
  const sorte = sorteador(palavras.join(","));
  const grade: string[][] = Array.from({ length: tamanho }, () => Array(tamanho).fill(""));
  const posicoes: { palavra: string; celulas: [number, number][] }[] = [];
  const direcoes: [number, number][] = [[0, 1], [1, 0], [1, 1]];
  for (const palavra of [...palavras].sort((a, b) => b.length - a.length)) {
    for (let tentativa = 0; tentativa < 200; tentativa++) {
      const [dl, dc] = direcoes[Math.floor(sorte() * direcoes.length)];
      const l0 = Math.floor(sorte() * (tamanho - dl * (palavra.length - 1)));
      const c0 = Math.floor(sorte() * (tamanho - dc * (palavra.length - 1)));
      const celulas = [...palavra].map((_, k) => [l0 + dl * k, c0 + dc * k] as [number, number]);
      if (celulas.every(([l, c], k) => grade[l][c] === "" || grade[l][c] === palavra[k])) {
        celulas.forEach(([l, c], k) => (grade[l][c] = palavra[k]));
        posicoes.push({ palavra, celulas });
        break;
      }
    }
  }
  const letras = "ABCDEFGHIJLMNOPRSTUV";
  for (const linha of grade) for (let c = 0; c < linha.length; c++) if (!linha[c]) linha[c] = letras[Math.floor(sorte() * letras.length)];
  return { grade, posicoes };
}

/** "frase | tradução | /arquivos/audio.webm" por linha; "lingua: en-US" escolhe a voz. */
export function lerPronuncia(spec: string): { lingua: string; frases: { texto: string; traducao: string; audio: string }[] } {
  let lingua = "pt-BR";
  const frases: { texto: string; traducao: string; audio: string }[] = [];
  for (const bruta of linhasDe(spec)) {
    const linha = bruta.trim();
    const l = /^(lingua|língua|idioma)\s*:\s*([a-z]{2}(?:-[A-Z]{2})?)$/i.exec(linha);
    if (l) {
      lingua = l[2];
      continue;
    }
    if (!linha) continue;
    const [texto, traducao = "", audio = ""] = linha.split("|").map((x) => x.trim());
    const audioOk = /^(\/arquivos\/[A-Za-z0-9/._-]+\.(webm|m4a|mp3|ogg)|envio:[0-9a-f-]{36}\/[a-z0-9-]{8,60}\.(webm|m4a))$/.test(audio) ? audio : "";
    if (texto && frases.length < 30) frases.push({ texto: texto.slice(0, 200), traducao: traducao.slice(0, 200), audio: audioOk });
  }
  return { lingua, frases };
}

/** "ano | acontecimento" por linha. */
export function lerLinhaDoTempo(spec: string): { quando: string; texto: string }[] {
  return linhasDe(spec)
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter(([q, t]) => q && t)
    .map(([quando, ...resto]) => ({ quando: quando.slice(0, 30), texto: resto.join(" | ").slice(0, 300) }))
    .slice(0, 60);
}

/** "sistema-solar | Abrir o sistema solar". */
export function lerFerramenta(spec: string): { id: string; rotulo: string } | null {
  const [id = "", rotulo = ""] = (linhasDe(spec)[0] ?? "").split("|").map((x) => x.trim());
  return /^[a-z0-9-]{2,40}$/.test(id) ? { id, rotulo: rotulo.slice(0, 80) } : null;
}

/** O que cada bloco mostra quando é novo, e um resumo de como escrever. */
export const MODELOS_INTERATIVOS: Record<Interativo, { nome: string; modelo: string; ajuda: string }> = {
  grafico: { nome: "Gráfico de função", modelo: "y = a*x^2 + b*x + c\na = 1 [-5, 5]\nb = 0 [-5, 5]\nc = 0 [-5, 5]\nx de -10 a 10\nponto (0, 0) origem", ajuda: "Uma linha por função (y = …, até quatro). Cada letra que aparece vira um controle: a = 1 [-5, 5]. Faixa do eixo: x de -10 a 10. Pontos: ponto (1, 2) nome." },
  calculadora: { nome: "Calculadora de variáveis", modelo: "v = d / t | velocidade (m/s)\nd = 100 | distância (m)\nt = 9,58 | tempo (s)", ajuda: "Primeira linha: o resultado (nome = fórmula | rótulo). Nas outras, um campo por linha: nome = valor | rótulo." },
  dados: { nome: "Gráfico de dados", modelo: "tipo: barras\ntitulo: Chuva em 2024\nMês | Chuva (mm)\nJan | 120\nFev | 90\nMar | 150", ajuda: "tipo: barras, linhas ou pizza. Depois uma tabela com | entre as colunas: a primeira linha é o cabeçalho; até três séries." },
  teste: { nome: "Teste autocorrigível", modelo: "? Qual destes é um planeta?\n+ Marte\n- Lua >> A Lua é um satélite da Terra.\n- Sol >> O Sol é uma estrela.\n> Planetas giram em volta de uma estrela.\n\n? O Sol é uma estrela.\n= verdadeiro\n\n? Quanto é 7 × 8?\n= 56\n\n? A capital do Brasil é ___.\n= Brasília\n\n? Ponha em ordem, do menor para o maior:\n* Lua\n* Terra\n* Júpiter", ajuda: "Linha em branco separa as perguntas. ? enunciado. Múltipla escolha: + certa, - errada >> retorno. V ou F: = verdadeiro. Número: = 56 ± 0,5. Lacunas: ___ no enunciado e uma linha = por lacuna (alternativas com |). Ordenar: * itens na ordem certa. > explicação." },
  cartoes: { nome: "Cartões virar-e-ver", modelo: "lingua: en-US\napple = maçã\nbook = livro\nhouse = casa", ajuda: "Um cartão por linha: frente = verso. lingua: en-US (opcional) faz a frente ser lida em voz alta." },
  memoria: { nome: "Jogo da memória", modelo: "H₂O = água\nNaCl = sal de cozinha\nCO₂ = gás carbônico\nO₂ = oxigênio", ajuda: "Um par por linha: lado A = lado B. De 3 a 12 pares." },
  forca: { nome: "Forca", modelo: "fotossintese | Como a planta faz o próprio alimento\nmitocondria | A usina de energia da célula", ajuda: "Uma palavra por linha, com a dica depois de |. Acentos contam: escreva sem acento se quiser deixar mais fácil." },
  cacapalavras: { nome: "Caça-palavras", modelo: "SINDICATO\nGREVE\nSALARIO\nDIREITO\nLUTA", ajuda: "Uma palavra por linha (os acentos são tirados). tamanho: 12 muda o tamanho da grade." },
  pronuncia: { nome: "Pronúncia", modelo: "lingua: en-US\nGood morning | Bom dia\nHow are you? | Como vai você?", ajuda: "lingua: en-US, es-ES, fr-FR… Uma frase por linha: frase | tradução | áudio gravado (opcional). Sem áudio, o aparelho lê com a própria voz." },
  diagrama: { nome: "Diagrama (Mermaid)", modelo: "flowchart LR\n  A[Cliente] -->|pedido| B(Servidor)\n  B --> C{Tem estoque?}\n  C -->|sim| D[Envia]\n  C -->|não| E[Avisa]", ajuda: "Escrito na linguagem Mermaid (fluxograma, sequência, linha do tempo…). Veja exemplos em mermaid.js.org." },
  linhadotempo: { nome: "Linha do tempo", modelo: "1888 | Abolição da escravatura no Brasil\n1917 | Greve geral em São Paulo\n1943 | Consolidação das Leis do Trabalho", ajuda: "Um acontecimento por linha: quando | o que aconteceu." },
  desenho: { nome: "Quadro de desenho", modelo: "Desenhe o ciclo da água: evaporação, condensação e chuva.", ajuda: "Escreva a proposta. Na aula, a pessoa desenha no quadro e pode baixar o desenho; nada é enviado." },
  ferramenta: { nome: "Ferramenta do site", modelo: "sistema-solar | Abrir o simulador do sistema solar", ajuda: "O nome da ferramenta (como no endereço /ferramentas/…) e o texto do botão, separados por |." },
};
