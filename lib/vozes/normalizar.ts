// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prepara o texto da aula para a voz ler como uma pessoa leria: números por extenso (com gênero e plural), dinheiro,
// porcentagem, decimais, datas, horas, frações, potências, unidades, siglas, abreviações e símbolos. O léxico de
// pronúncia (content/vozes/lexico.yml) vem por último a palavra inteira. Também divide o texto em frases.
// Sem os atalhos "@/" de propósito: `npm run testar:vozes` roda este arquivo direto no Node.

export type Genero = "m" | "f";
export type Lexico = { siglas?: Record<string, string>; palavras?: Record<string, string> };

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const ESCALAS: [string, string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
  ["trilhão", "trilhões"],
];

function feminino(palavra: string): string {
  if (palavra === "um") return "uma";
  if (palavra === "dois") return "duas";
  return palavra.replace(/entos$/, "entas");
}

/** De 0 a 999. */
function ate999(n: number, genero: Genero): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = DEZENAS[Math.floor(resto / 10)];
      const u = resto % 10;
      partes.push(u ? `${d} e ${UNIDADES[u]}` : d);
    }
  }
  if (!partes.length) return "zero";
  const texto = partes.join(" e ");
  return genero === "f" ? texto.split(" ").map(feminino).join(" ") : texto;
}

/** Número inteiro por extenso ("cento e sessenta e dois"; feminino: "duzentas e duas"). */
export function porExtenso(valor: number | bigint, genero: Genero = "m"): string {
  let n = BigInt(valor);
  if (n < BigInt(0)) return `menos ${porExtenso(-n, genero)}`;
  if (n === BigInt(0)) return "zero";
  if (n >= BigInt(10) ** BigInt(15)) return String(n).split("").map((d) => UNIDADES[Number(d)]).join(" ");
  const grupos: number[] = [];
  while (n > BigInt(0)) {
    grupos.push(Number(n % BigInt(1000)));
    n /= BigInt(1000);
  }
  const partes: { texto: string; valor: number; escala: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    // Milhão e bilhão são masculinos ("duas mil pessoas", mas "dois milhões de pessoas").
    const gen: Genero = i >= 2 ? "m" : genero;
    if (i === 1) partes.push({ texto: g === 1 ? "mil" : `${ate999(g, gen)} mil`, valor: g, escala: i });
    else if (i >= 2) partes.push({ texto: `${ate999(g, gen)} ${g === 1 ? ESCALAS[i][0] : ESCALAS[i][1]}`, valor: g, escala: i });
    else partes.push({ texto: ate999(g, gen), valor: g, escala: i });
  }
  // "mil e cem", "mil e vinte", "mil duzentos e trinta": o "e" entra antes do último grupo quando ele é menor que cem
  // ou é uma centena redonda.
  let texto = partes[0].texto;
  for (let i = 1; i < partes.length; i++) {
    const p = partes[i];
    const ultimo = i === partes.length - 1;
    texto += ultimo && (p.valor < 100 || p.valor % 100 === 0) ? ` e ${p.texto}` : ` ${p.texto}`;
  }
  return texto;
}

const ORD_U = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono"];
const ORD_D = ["", "décimo", "vigésimo", "trigésimo", "quadragésimo", "quinquagésimo", "sexagésimo", "septuagésimo", "octogésimo", "nonagésimo"];
const ORD_C = ["", "centésimo", "ducentésimo", "trecentésimo", "quadringentésimo", "quingentésimo", "sexcentésimo", "septingentésimo", "octingentésimo", "noningentésimo"];

/** Ordinal até 9 999 ("primeiro", "vigésima segunda", "milésimo"). */
export function ordinal(n: number, genero: Genero = "m"): string {
  if (n <= 0 || n >= 10000) return porExtenso(n, genero);
  const partes: string[] = [];
  const m = Math.floor(n / 1000);
  if (m) partes.push(m === 1 ? "milésimo" : `${porExtenso(m)} milésimo`);
  const c = Math.floor((n % 1000) / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  if (c) partes.push(ORD_C[c]);
  if (d) partes.push(ORD_D[d]);
  if (u) partes.push(ORD_U[u]);
  const texto = partes.join(" ");
  return genero === "f" ? texto.replace(/o\b/g, "a") : texto;
}

/** "3,05" → "três vírgula zero cinco"; "0,81" → "zero vírgula oitenta e um". */
export function decimal(inteiro: string, fracao: string, genero: Genero = "m"): string {
  const parte = porExtenso(BigInt(inteiro.replace(/\./g, "") || "0"), genero);
  if (!fracao) return parte;
  const zeros = fracao.match(/^0+/)?.[0].length ?? 0;
  const resto = fracao.slice(zeros);
  const lido = fracao.length > 3 ? fracao.split("").map((d) => UNIDADES[Number(d)]).join(" ") : [...Array(zeros).fill("zero"), ...(resto ? [porExtenso(BigInt(resto))] : [])].join(" ");
  return `${parte} vírgula ${lido}`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const DENOMINADORES: Record<number, [string, string]> = {
  2: ["meio", "meios"],
  3: ["terço", "terços"],
  4: ["quarto", "quartos"],
  5: ["quinto", "quintos"],
  6: ["sexto", "sextos"],
  7: ["sétimo", "sétimos"],
  8: ["oitavo", "oitavos"],
  9: ["nono", "nonos"],
  10: ["décimo", "décimos"],
  100: ["centésimo", "centésimos"],
  1000: ["milésimo", "milésimos"],
};

/** "3/4" → "três quartos"; "5/12" → "cinco doze avos". */
export function fracao(a: number, b: number): string {
  const nome = DENOMINADORES[b];
  if (nome) return `${porExtenso(a)} ${a === 1 ? nome[0] : nome[1]}`;
  return `${porExtenso(a)} ${porExtenso(b)} avos`;
}

// Unidades depois de um número: [singular, plural, gênero]. A ordem importa (as compostas antes das simples).
const UNIDADES_DE_MEDIDA: [string, string, string, Genero][] = [
  ["km²", "quilômetro quadrado", "quilômetros quadrados", "m"],
  ["km2", "quilômetro quadrado", "quilômetros quadrados", "m"],
  ["m²", "metro quadrado", "metros quadrados", "m"],
  ["m2", "metro quadrado", "metros quadrados", "m"],
  ["cm²", "centímetro quadrado", "centímetros quadrados", "m"],
  ["m³", "metro cúbico", "metros cúbicos", "m"],
  ["m3", "metro cúbico", "metros cúbicos", "m"],
  ["cm³", "centímetro cúbico", "centímetros cúbicos", "m"],
  ["km/h", "quilômetro por hora", "quilômetros por hora", "m"],
  ["m/s²", "metro por segundo ao quadrado", "metros por segundo ao quadrado", "m"],
  ["m/s", "metro por segundo", "metros por segundo", "m"],
  ["kWh", "quilowatt-hora", "quilowatts-hora", "m"],
  ["MWh", "megawatt-hora", "megawatts-hora", "m"],
  ["kW", "quilowatt", "quilowatts", "m"],
  ["MW", "megawatt", "megawatts", "m"],
  ["GW", "gigawatt", "gigawatts", "m"],
  ["W", "watt", "watts", "m"],
  ["kV", "quilovolt", "quilovolts", "m"],
  ["V", "volt", "volts", "m"],
  ["mA", "miliampère", "miliampères", "m"],
  ["A", "ampère", "ampères", "m"],
  ["Ω", "ohm", "ohms", "m"],
  ["kHz", "quilo-hertz", "quilo-hertz", "m"],
  ["MHz", "mega-hertz", "mega-hertz", "m"],
  ["Hz", "hertz", "hertz", "m"],
  ["km", "quilômetro", "quilômetros", "m"],
  ["cm", "centímetro", "centímetros", "m"],
  ["mm", "milímetro", "milímetros", "m"],
  ["nm", "nanômetro", "nanômetros", "m"],
  ["µm", "micrômetro", "micrômetros", "m"],
  ["m", "metro", "metros", "m"],
  ["kg", "quilo", "quilos", "m"],
  ["mg", "miligrama", "miligramas", "m"],
  ["g", "grama", "gramas", "m"],
  ["t", "tonelada", "toneladas", "f"],
  ["mL", "mililitro", "mililitros", "m"],
  ["ml", "mililitro", "mililitros", "m"],
  ["L", "litro", "litros", "m"],
  ["l", "litro", "litros", "m"],
  ["ha", "hectare", "hectares", "m"],
  ["°C", "grau Celsius", "graus Celsius", "m"],
  ["ºC", "grau Celsius", "graus Celsius", "m"],
  ["K", "kelvin", "kelvins", "m"],
  ["°", "grau", "graus", "m"],
  ["min", "minuto", "minutos", "m"],
  ["s", "segundo", "segundos", "m"],
  ["mol", "mol", "mols", "m"],
  ["cal", "caloria", "calorias", "f"],
  ["kcal", "quilocaloria", "quilocalorias", "f"],
  ["J", "joule", "joules", "m"],
  ["kJ", "quilojoule", "quilojoules", "m"],
  ["N", "newton", "newtons", "m"],
  ["Pa", "pascal", "pascals", "m"],
  ["atm", "atmosfera", "atmosferas", "f"],
  ["GB", "gigabyte", "gigabytes", "m"],
  ["MB", "megabyte", "megabytes", "m"],
  ["kB", "quilobyte", "quilobytes", "m"],
  ["TB", "terabyte", "terabytes", "m"],
  ["hab./km²", "habitante por quilômetro quadrado", "habitantes por quilômetro quadrado", "m"],
];
UNIDADES_DE_MEDIDA.sort((a, b) => b[0].length - a[0].length);

const ABREVIACOES: [RegExp, string][] = [
  [/\bSr\.(?=\s)/g, "senhor"],
  [/\bSra\.(?=\s)/g, "senhora"],
  [/\bSrta\.(?=\s)/g, "senhorita"],
  [/\bDr\.(?=\s)/g, "doutor"],
  [/\bDra\.(?=\s)/g, "doutora"],
  [/\bProf\.(?=\s)/g, "professor"],
  [/\bProfa\.(?=\s)/g, "professora"],
  [/\bD\.(?=\s+(?:Pedro|João|Maria|Leopoldina|Isabel|Sebastião|Manuel|Miguel|Carlota|Teresa|Afonso|Duarte|Fernando|José|Luís|Henrique))/g, "Dom"],
  [/\ba\.\s?C\./g, "antes de Cristo"],
  [/\bd\.\s?C\./g, "depois de Cristo"],
  [/\bex\.:/gi, "por exemplo:"],
  [/\bp\.\s?ex\./gi, "por exemplo"],
  [/\betc\./g, "etcétera."],
  [/\bn[º°o]\s?(?=\d)/g, "número "],
  [/\bpág\.\s?(?=\d)/g, "página "],
  [/\bp\.\s?(?=\d)/g, "página "],
  [/\bart\.\s?(?=\d)/gi, "artigo "],
  [/\binc\.\s?(?=[IVXL\d])/g, "inciso "],
  [/\bcap\.\s?(?=[IVXL\d])/gi, "capítulo "],
  [/\bvol\.\s?(?=[IVXL\d])/gi, "volume "],
  [/\bfig\.\s?(?=\d)/gi, "figura "],
  [/\btab\.\s?(?=\d)/gi, "tabela "],
  [/§\s?(?=\d)/g, "parágrafo "],
  [/\bséc\.\s?(?=[IVXL])/gi, "século "],
];

const LETRAS: Record<string, string> = {
  A: "á", B: "bê", C: "cê", D: "dê", E: "é", F: "éfe", G: "gê", H: "agá", I: "i", J: "jota", K: "cá", L: "éle", M: "ême",
  N: "êne", O: "ó", P: "pê", Q: "quê", R: "érre", S: "ésse", T: "tê", U: "u", V: "vê", W: "dáblio", X: "xis", Y: "ípsilon", Z: "zê",
};

/** Sigla sem entrada no léxico: lê como palavra quando dá para pronunciar (ONU, PIB, SUS), letra por letra quando não (STF, IBGE). */
export function lerSigla(sigla: string): string {
  const pronunciavel = /^[BCDFGJKLMNPQRSTVXZ]?[AEIOU][BCDFGJKLMNPQRSTVXZ]?([AEIOU][BCDFGJKLMNPQRSTVXZ]?)*$/.test(sigla) && /[AEIOU]/.test(sigla) && sigla.length <= 5;
  if (pronunciavel) return sigla.charAt(0) + sigla.slice(1).toLowerCase();
  return sigla.split("").map((l) => LETRAS[l] ?? l).join(" ");
}

const ROMANOS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
export function romano(r: string): number {
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const v = ROMANOS[r[i]];
    const prox = ROMANOS[r[i + 1]] ?? 0;
    total += v < prox ? -v : v;
  }
  return total;
}
const ROMANO_VALIDO = /^(?=[IVXLC])(C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

// Texto de LaTeX (das fórmulas das aulas) lido em palavras: só o que aparece nas aulas, sem pretensão de cobrir tudo.
const TEX: [RegExp, string][] = [
  [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, " $1 sobre $2 "],
  [/\\sqrt\{([^{}]+)\}/g, " raiz quadrada de $1 "],
  [/\^\{?2\}?/g, " ao quadrado "],
  [/\^\{?3\}?/g, " ao cubo "],
  [/\^\{([^{}]+)\}/g, " elevado a $1 "],
  [/\^(\w)/g, " elevado a $1 "],
  [/_\{([^{}]+)\}/g, " $1 "],
  [/_(\w)/g, " $1 "],
  [/\\(times|cdot)/g, " vezes "],
  [/\\div/g, " dividido por "],
  [/\\pm/g, " mais ou menos "],
  [/\\(leq|le)\b/g, " menor ou igual a "],
  [/\\(geq|ge)\b/g, " maior ou igual a "],
  [/\\neq/g, " diferente de "],
  [/\\approx/g, " aproximadamente "],
  [/\\pi/g, " pi "],
  [/\\infty/g, " infinito "],
  [/\\Delta/g, " delta "],
  [/\\alpha/g, " alfa "],
  [/\\beta/g, " beta "],
  [/\\theta/g, " teta "],
  [/\\lambda/g, " lâmbda "],
  [/\\(left|right|,|;|!|quad|qquad)/g, " "],
  [/\\text\{([^{}]*)\}/g, " $1 "],
  [/\\[a-zA-Z]+/g, " "],
  [/[{}]/g, " "],
];

/** Uma fórmula em LaTeX lida em palavras ("x^2 + 1" → "x ao quadrado mais um"). */
export function lerTex(tex: string): string {
  let t = tex;
  for (const [re, por] of TEX) t = t.replace(re, por);
  return normalizar(t).replace(/\s+/g, " ").trim();
}

const N = String.raw`\d{1,3}(?:\.\d{3})+|\d+`;

// Masculinas terminadas em "a" (as que aparecem nas aulas); o resto em "a", "ção", "dade", "agem" é feminino.
const MASCULINAS_EM_A = new Set(["dia", "dias", "mapa", "mapas", "problema", "problemas", "sistema", "sistemas", "tema", "temas", "programa", "programas", "planeta", "planetas", "clima", "climas", "idioma", "idiomas", "poeta", "poetas", "cinema", "drama", "dramas", "esquema", "esquemas", "diploma", "diplomas", "dilema", "dilemas", "teorema", "teoremas", "cometa", "cometas", "profeta", "profetas", "telefonema", "poema", "poemas", "lema", "lemas", "sofá", "sofás", "fantasma", "fantasmas", "guarda", "guardas", "pijama", "pijamas", "gorila", "gorilas", "aroma", "aromas", "trema", "enigma", "enigmas", "dogma", "dogmas", "carisma", "estigma", "paradigma", "paradigmas", "prisma", "prismas", "axioma", "axiomas", "fonema", "fonemas", "morfema", "morfemas", "ecossistema", "ecossistemas", "crisma", "magma", "plasma", "trauma", "traumas"]);
const FEMININAS = new Set(["vez", "vezes", "mulher", "mulheres", "mão", "mãos", "flor", "flores", "cor", "cores", "dor", "dores", "lei", "leis", "rede", "redes", "parede", "paredes", "fase", "fases", "frase", "frases", "classe", "classes", "base", "bases", "árvore", "árvores", "noite", "noites", "tarde", "tardes", "fonte", "fontes", "gente", "nuvem", "nuvens", "viagem", "viagens", "imagem", "imagens", "ordem", "ordens", "origem", "série", "séries", "espécie", "espécies", "superfície", "nação", "nações", "região", "regiões", "questão", "questões", "opção", "opções", "lição", "lições", "razão", "razões", "estação", "estações", "milhar"]);

/** O gênero de um substantivo, por um palpite que acerta a maioria: serve para "duas pessoas", "duzentas questões". */
export function generoDaPalavra(palavra: string): Genero {
  const p = palavra.toLowerCase();
  if (!p || MASCULINAS_EM_A.has(p)) return "m";
  if (FEMININAS.has(p)) return "f";
  return /(?:as?|ções|ção|sões|são|dades?|agens?|tudes?|ices?|ises?|ezas?)$/.test(p) && !/^(?:mil|de|da|das|e|a|as|em|ou)$/.test(p) ? "f" : "m";
}

function numeroDe(texto: string): bigint {
  return BigInt(texto.replace(/\./g, ""));
}

function plural(n: bigint, singular: string, pluralForma: string) {
  return n === BigInt(1) ? singular : pluralForma;
}

/** "R$ 162,50" → "cento e sessenta e dois reais e cinquenta centavos". */
function dinheiro(inteiro: string, centavos: string | undefined, escala: string | undefined, moeda: [string, string]): string {
  const [um, varios] = moeda;
  if (escala) {
    const valor = centavos ? decimal(inteiro, centavos) : porExtenso(numeroDe(inteiro));
    return `${valor} ${escala}${escala === "mil" ? "" : " de"} ${varios}`;
  }
  const n = numeroDe(inteiro);
  const c = centavos ? Number(centavos.padEnd(2, "0").slice(0, 2)) : 0;
  const partes: string[] = [];
  if (n > BigInt(0) || c === 0) {
    const redondo = n >= BigInt(1000000) && n % BigInt(1000000) === BigInt(0);
    partes.push(`${porExtenso(n)}${redondo ? " de" : ""} ${plural(n, um, varios)}`);
  }
  if (c) partes.push(`${porExtenso(c)} ${c === 1 ? "centavo" : "centavos"}`);
  return partes.join(" e ");
}

const ESCALA = String.raw`(?:\s(trilhões|trilhão|bilhões|bilhão|milhões|milhão|mil)(?![a-zà-ú]))?`;

/**
 * Prepara o texto para a voz. A ordem importa: primeiro o que tem símbolo (dinheiro, porcentagem, data, hora, unidade),
 * depois os números soltos, por fim o léxico e as siglas.
 */
export function normalizar(entrada: string, lexico: Lexico = {}): string {
  let t = ` ${entrada} `;
  t = t.replace(/[   ]/g, " ");

  // Léxico de expressões com espaço ou ponto ("a.C.", "Sr.") antes das abreviações.
  for (const [re, por] of ABREVIACOES) t = t.replace(re, por);

  // Dinheiro.
  const moedas: [RegExp, [string, string]][] = [
    [/R\$/, ["real", "reais"]],
    [/US\$|U\$/, ["dólar", "dólares"]],
    [/€/, ["euro", "euros"]],
  ];
  for (const [simbolo, moeda] of moedas) {
    const re = new RegExp(String.raw`(-\s?)?(?:${simbolo.source})\s?(${N})(?:,(\d{1,2}))?${ESCALA}`, "g");
    t = t.replace(re, (_, menos, inteiro, centavos, escala) => `${menos ? "menos " : ""}${dinheiro(inteiro, centavos, escala, moeda)}`);
  }

  // Porcentagem (e por mil).
  t = t.replace(new RegExp(String.raw`(-)?(${N})(?:,(\d+))?\s?%`, "g"), (_, menos, i, f) => `${menos ? "menos " : ""}${decimal(i, f ?? "")} por cento`);
  t = t.replace(new RegExp(String.raw`(${N})(?:,(\d+))?\s?‰`, "g"), (_, i, f) => `${decimal(i, f ?? "")} por mil`);

  // Datas: 07/09/1822, 7/9/22, 1º de maio.
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g, (todo, d, m, a) => {
    const dia = Number(d);
    const mes = Number(m);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return todo;
    const ano = a.length === 2 ? Number(a) + (Number(a) > 40 ? 1900 : 2000) : Number(a);
    return `${dia === 1 ? "primeiro" : porExtenso(dia)} de ${MESES[mes - 1]} de ${porExtenso(ano)}`;
  });
  t = t.replace(/\b1[º°o]\s(?=de\s(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))/gi, "primeiro ");

  // Horas: 14h30, 14h, 8h05min, às 14:30.
  t = t.replace(/\b(\d{1,2})h(\d{2})(?:min)?\b/g, (_, h, m) => `${porExtenso(Number(h), "f")} ${Number(h) === 1 ? "hora" : "horas"}${Number(m) ? ` e ${porExtenso(Number(m))} ${Number(m) === 1 ? "minuto" : "minutos"}` : ""}`);
  t = t.replace(/\b(\d{1,2})h\b/g, (_, h) => `${porExtenso(Number(h), "f")} ${Number(h) === 1 ? "hora" : "horas"}`);
  t = t.replace(/(?<!\p{L})(às|as|das|até|de)\s(\d{1,2}):(\d{2})\b/giu, (_, prep, h, m) => `${prep} ${porExtenso(Number(h), "f")}${Number(m) ? ` e ${porExtenso(Number(m))}` : ""}`);

  // Ordinais: 1º, 2ª, 3.º, 22ª.
  t = t.replace(/\b(\d{1,4})\.?([ºª])(?!\s?[CF]\b)/g, (_, n, marca) => ordinal(Number(n), marca === "ª" ? "f" : "m"));

  // Intervalos com travessão: 1914–1918, 10-12 (só entre números).
  t = t.replace(new RegExp(String.raw`\b(${N})\s?[–—]\s?(${N})\b`, "g"), (_, a, b) => `${a} a ${b}`);
  t = t.replace(/\b(\d{3,4})-(\d{3,4})\b/g, (_, a, b) => `${a} a ${b}`);

  // Potências: x², 10³, 10⁻³, 10^8.
  const SOBRESCRITOS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
  t = t.replace(/([0-9A-Za-z)])([⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (todo, base, exp, onde: number, tudo: string) => {
    // "8 km²" e "3 m³" são unidades: ficam para a lista de unidades, logo abaixo.
    if (/(?:^|[^\p{L}])(?:k|c|d|m|µ)?m$/u.test(tudo.slice(Math.max(0, onde - 4), onde + 1))) return todo;
    const e = exp.replace(/./g, (c: string) => SOBRESCRITOS[c] ?? c);
    if (/^[A-Za-z]$/.test(base) || /\d/.test(base) || base === ")") {
      if (e === "2") return `${base} ao quadrado`;
      if (e === "3") return `${base} ao cubo`;
      return `${base} elevado a ${e.startsWith("-") ? `menos ${e.slice(1)}` : e}`;
    }
    return todo;
  });
  t = t.replace(/(\d)\s?\^\s?(-?\d+)/g, (_, b, e) => `${b} elevado a ${e.startsWith("-") ? `menos ${e.slice(1)}` : e}`);

  // Raiz, frações e operações entre números.
  t = t.replace(/√\s?\(?(\d+)\)?/g, "raiz quadrada de $1");
  t = t.replace(/∛\s?\(?(\d+)\)?/g, "raiz cúbica de $1");
  t = t.replace(/(^|[^\d/,.])(\d{1,3})\/(\d{1,4})(?![\d/])/g, (todo, antes, a, b) => (Number(b) > 1 && Number(b) <= 1000 && Number(a) < 1000 ? `${antes}${fracao(Number(a), Number(b))}` : todo));
  t = t.replace(/½/g, " um meio").replace(/¼/g, " um quarto").replace(/¾/g, " três quartos").replace(/⅓/g, " um terço");
  t = t.replace(/(\d|\))\s?[x×]\s?(?=\d|\()/g, "$1 vezes ");
  t = t.replace(/\s×\s/g, " vezes ");
  t = t.replace(/(\d)\s?÷\s?(?=\d)/g, "$1 dividido por ");
  t = t.replace(/÷/g, " dividido por ");
  t = t.replace(/\s+\+\s+/g, " mais ").replace(/(\d)\+(?=\d)/g, "$1 mais ");
  t = t.replace(/(\d|\)|(?<!\p{L})\p{L}|quadrado|cubo)\s+[−-]\s+(?=\d|\(|\p{L}(?!\p{L}))/gu, "$1 menos ");
  t = t.replace(/(\d)−(?=\d)/g, "$1 menos ");
  t = t.replace(/\s?≠\s?/g, " é diferente de ");
  t = t.replace(/\s?≤\s?/g, " é menor ou igual a ");
  t = t.replace(/\s?≥\s?/g, " é maior ou igual a ");
  t = t.replace(/\s?≈\s?/g, " é aproximadamente ");
  t = t.replace(/\s?±\s?/g, " mais ou menos ");
  t = t.replace(/(?<![=<>!])\s*=\s*(?![=>])/g, " é igual a ");
  t = t.replace(/(\d|\b[a-z])\s?<\s?(?=\d|[a-z]\b)/g, "$1 é menor que ");
  t = t.replace(/(\d|\b[a-z])\s?>\s?(?=\d|[a-z]\b)/g, "$1 é maior que ");
  t = t.replace(/π/g, " pi ").replace(/∞/g, " infinito ").replace(/Δ/g, " delta ");
  t = t.replace(/\s&\s/g, " e ");
  t = t.replace(/\s?→\s?/g, ", ");

  // Unidades depois de número: "8,5 km²", "1 kg", "220 V".
  for (const [simbolo, um, varios, genero] of UNIDADES_DE_MEDIDA) {
    const esc = simbolo.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const re = new RegExp(String.raw`(-)?(${N})(?:,(\d+))?${ESCALA}\s?${esc}(?![\p{L}\d])`, "gu");
    t = t.replace(re, (_, menos, i, f, escala) => {
      const um1 = !f && !escala && numeroDe(i) === BigInt(1);
      const valor = f ? decimal(i, f, genero) : porExtenso(numeroDe(i), genero);
      return `${menos ? "menos " : ""}${valor}${escala ? ` ${escala}${escala === "mil" ? "" : " de"}` : ""} ${um1 ? um : varios}`;
    });
  }

  // Unidade de área e volume sem número na frente ("milhões de km²", "em m³").
  t = t.replace(/(?<![\p{L}\d])(km|m|cm)([²³]|[23](?![\d]))(?![\p{L}\d])/gu, (_, u, e) => `${{ km: "quilômetros", m: "metros", cm: "centímetros" }[u as "km" | "m" | "cm"]} ${/[²2]/.test(e) ? "quadrados" : "cúbicos"}`);

  // Números com escala por extenso ("8,5 milhões", "2 mil").
  t = t.replace(new RegExp(String.raw`(${N})(?:,(\d+))?\s(mil|milhão|milhões|bilhão|bilhões|trilhão|trilhões)\b(?=(\s+[\p{L}-]+)?)`, "gu"), (_, i, f, escala, seguinte) => {
    if (escala === "mil") return `${f ? decimal(i, f) : porExtenso(numeroDe(i), generoDaPalavra(seguinte?.trim() ?? ""))} mil`;
    const um = numeroDe(i) === BigInt(1) && !f;
    const nome = escala.replace(/ões$/, "ão");
    return `${f ? decimal(i, f) : porExtenso(numeroDe(i))} ${um ? nome : nome.replace(/ão$/, "ões")}`;
  });

  // Algarismos romanos: "século XX" (cardinal), "Dom Pedro I" e "João Paulo II" (ordinal até o décimo).
  t = t.replace(/\b(século|séculos|capítulo|parte|volume|título|livro|inciso|ato|canto|tomo|fase)\s([IVXLC]+)\b/gi, (todo, palavra, r) => (ROMANO_VALIDO.test(r) ? `${palavra} ${porExtenso(romano(r))}` : todo));
  t = t.replace(/(?<!\p{L})(?:(Rainha|Imperatriz|Princesa|Dona|Santa|Rei|Imperador|Príncipe|Papa|Dom)\s)?(\p{Lu}\p{Ll}+)\s([IVX]{1,4})(?=[\s,.;:!?)]|$)/gu, (todo, titulo, nome, r) => {
    if (!ROMANO_VALIDO.test(r)) return todo;
    const n = romano(r);
    const fem = titulo ? /^(Rainha|Imperatriz|Princesa|Dona|Santa)$/.test(titulo) : /a$/.test(nome);
    return `${titulo ? `${titulo} ` : ""}${nome} ${n <= 10 ? ordinal(n, fem ? "f" : "m") : porExtenso(n)}`;
  });

  // Números soltos: decimais ("0,81"), negativos ("-5") e inteiros com ponto de milhar ("1.500").
  t = t.replace(new RegExp(String.raw`(^|[\s(])-(?=\d)`, "g"), "$1menos ");
  t = t.replace(new RegExp(String.raw`\b(${N}),(\d+)\b`, "g"), (_, i, f) => decimal(i, f));
  t = t.replace(new RegExp(String.raw`\b(${N})\b(?=(\s+(?:mil\s+)?[\p{L}-]+)?)`, "gu"), (_, i, seguinte) => porExtenso(numeroDe(i), generoDaPalavra(seguinte?.trim().split(/\s+/).pop() ?? "")));

  // Léxico: palavras (sem diferença de maiúsculas) e siglas (exatas).
  for (const [palavra, pronuncia] of Object.entries(lexico.palavras ?? {})) {
    const esc = palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(String.raw`(?<![\p{L}\d])${esc}(?![\p{L}\d])`, "giu"), pronuncia);
  }
  const siglas = lexico.siglas ?? {};
  t = t.replace(/(?<![\p{L}\d])(\p{Lu}{2,8})(?:s)?(?![\p{L}\d])/gu, (todo, sigla: string) => {
    if (siglas[sigla] != null) return todo.replace(sigla, siglas[sigla]);
    // Palavra inteira em maiúsculas que não é sigla (TÍTULO, ATENÇÃO) fica como está, em minúsculas para a voz.
    if (/[ÁÉÍÓÚÂÊÔÃÕÇ]/.test(sigla) || sigla.length > 5) return todo.toLowerCase();
    return lerSigla(sigla);
  });

  return t.replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

const ABREV_FIM = /(?:\b(?:Sr|Sra|Srta|Dr|Dra|Prof|Profa|D|p|pág|art|inc|cap|vol|fig|tab|ex|etc|séc|n|nº|a\.C|d\.C|[A-Z])\.)$/;

/** Divide o texto em frases (início e fim de cada uma), sem cortar em "Sr.", "D. Pedro", "3.5" ou "a.C.". */
export function dividirEmFrases(texto: string, limite = 260): { ini: number; fim: number }[] {
  const frases: { ini: number; fim: number }[] = [];
  let ini = 0;
  const empurrar = (fim: number) => {
    let a = ini;
    let b = fim;
    while (a < b && /\s/.test(texto[a])) a++;
    while (b > a && /\s/.test(texto[b - 1])) b--;
    if (b > a && /[\p{L}\p{N}]/u.test(texto.slice(a, b))) frases.push(...partirLonga(texto, a, b, limite));
    ini = fim;
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\n") {
      empurrar(i + 1);
      continue;
    }
    if (!/[.!?…]/.test(c)) continue;
    let j = i;
    while (j + 1 < texto.length && /[.!?…"”»)\]]/.test(texto[j + 1])) j++;
    const depois = texto.slice(j + 1);
    if (!/^\s/.test(depois) && depois.length) continue;
    const resto = depois.trimStart();
    if (resto && !/^[\p{Lu}\p{N}"“«(—–-]/u.test(resto)) continue;
    if (c === "." && ABREV_FIM.test(texto.slice(Math.max(0, i - 6), i + 1))) continue;
    empurrar(j + 1);
    i = j;
  }
  empurrar(texto.length);
  return frases;
}

/** Frase longa demais cansa e algumas vozes correm: parte em ponto e vírgula, dois-pontos ou vírgula perto do meio. */
function partirLonga(texto: string, a: number, b: number, limite: number): { ini: number; fim: number }[] {
  if (b - a <= limite) return [{ ini: a, fim: b }];
  const trecho = texto.slice(a, b);
  const meio = trecho.length / 2;
  let melhor = -1;
  for (const sinal of [/[;:]\s/g, /,\s/g, /\s(?=e\s|ou\s|mas\s|porque\s|que\s)/g]) {
    for (const m of trecho.matchAll(sinal)) if (melhor < 0 || Math.abs(m.index + 1 - meio) < Math.abs(melhor - meio)) melhor = m.index + 1;
    if (melhor > limite * 0.25 && melhor < trecho.length - limite * 0.15) break;
    melhor = -1;
  }
  if (melhor < 0) {
    melhor = trecho.lastIndexOf(" ", limite);
    if (melhor <= 0) return [{ ini: a, fim: b }];
  }
  return [...partirLonga(texto, a, a + melhor, limite), ...partirLonga(texto, a + melhor + 1, b, limite)].filter((p) => p.fim > p.ini);
}
