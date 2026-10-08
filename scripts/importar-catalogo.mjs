// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
//
// Monta o "catálogo ampliado" de cada disciplina (content/catalogo/<disciplina>.json) a partir de dois
// catálogos abertos. Nada é copiado para cá além de título, autor e endereço: a obra continua na fonte.
//
//   1. Project Gutenberg: o arquivo público pg_catalog.csv. Só entram obras cujos autores e tradutores
//      morreram há mais de 70 anos (domínio público no Brasil), classificadas pela área da Biblioteca
//      do Congresso (LoCC) e pelos assuntos informados no próprio catálogo.
//   2. Arquivo Marxista na Internet, seção em português: as listas de obras de cada autor.
//
// Uso: npm run importar:catalogo            (baixa tudo; leva alguns minutos)
//      npm run importar:catalogo -- arquivo.csv   (usa um pg_catalog.csv já baixado)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "content", "catalogo");
const LIMITE = 150; // obras por disciplina e por fonte: o catálogo é um ponto de partida, não um depósito
const anoLimite = new Date().getFullYear() - 71; // quem morreu até esse ano está em domínio público no Brasil
const agente = { "User-Agent": "Mozilla/5.0 (catálogo do Instituto Lúcia)" };

// ───────────── Project Gutenberg ─────────────

/** Lê um CSV com aspas e quebras de linha dentro dos campos. */
function lerCsv(texto) {
  const linhas = [];
  let campo = "";
  let linha = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  const [cabecalho, ...resto] = linhas;
  return resto.map((valores) => Object.fromEntries(cabecalho.map((nome, i) => [nome, valores[i] ?? ""])));
}

/** "Assis, Machado de, 1839-1908; Fulano, 1850-1920 [Translator]" → nomes, e se todos estão em domínio público. */
function autores(campo) {
  const pessoas = campo.split(";").map((parte) => parte.trim()).filter(Boolean);
  if (pessoas.length === 0 || pessoas.length > 3) return null;
  const nomes = [];
  for (const pessoa of pessoas) {
    const anos = /,\s*(\d{3,4})?\??\s*-\s*(\d{3,4})\??/.exec(pessoa);
    if (!anos?.[2] || Number(anos[2]) > anoLimite) return null;
    if (/\[(Translator|Editor|Illustrator|Contributor|Commentator)\]/i.test(pessoa)) continue;
    const [sobrenome, nome = ""] = pessoa.slice(0, anos.index).split(",").map((parte) => parte.trim());
    nomes.push(`${nome.replace(/\(.*?\)/g, "").trim()} ${sobrenome}`.trim());
  }
  return nomes.length ? nomes.join(" e ") : null;
}

const temClasse = (locc, ...classes) => locc.split(";").map((item) => item.trim()).some((item) => classes.includes(item));

/** Disciplina de uma obra, pela língua, pela classe e pelos assuntos. Sem encaixe claro, a obra fica de fora. */
function disciplina(obra) {
  const { Language: lingua, LoCC: locc, Subjects: assuntos } = obra;
  if (lingua === "es") return "espanhol";
  if (lingua === "zh") return "chines";
  if (lingua !== "pt" && lingua !== "en") return null;
  const tem = (...classes) => temClasse(locc, ...classes);
  const sobre = (padrao) => padrao.test(assuntos);

  // Nas disciplinas das lutas sociais, a classificação por assunto do catálogo de origem mistura obras
  // do movimento com panfletos contra ele e com romances de época. Só entram os assuntos que indicam
  // testemunho, história ou defesa de direitos; polêmicas, ficção e relatos de guerra colonial ficam de fora.
  // As disciplinas das lutas sociais NÃO recebem importação automática. No catálogo de origem, o assunto
  // "escravidão" reúne tanto o relato de quem fugiu quanto o panfleto de quem a defendia, e o mesmo vale
  // para o voto feminino, o socialismo e os povos indígenas. Nessas áreas, cada obra é escolhida à mão
  // pela curadoria (content/acervo). Do Arquivo Marxista vêm só os autores listados mais abaixo.
  if (sobre(/Slav(e|ery)|African Americans|Negro|Women's rights|Feminis|Suffrag|Socialism|Communism|Anarchism|Bolshevi|Indians of|Labor|Working class|Strikes|Race relations/i) || tem("HX", "HQ", "HT", "HD")) return null;
  if (tem("QA")) return "matematica";
  if (tem("QB")) return "astronomia";
  if (tem("QC")) return "fisica";
  if (tem("QD")) return "quimica";
  if (tem("QH", "QK", "QL", "QM", "QP", "QR")) return "biologia";
  if (tem("M", "ML", "MT")) return "musica";
  if (tem("N", "NA", "NB", "NC", "ND", "NE", "NK", "NX")) return "artes";
  if (tem("B", "BC", "BD", "BH", "BJ")) return "filosofia";
  if (tem("HB", "HC", "HG", "HJ")) return "economia";
  if (tem("JA", "JC", "JF", "JK", "JN", "JX", "JZ")) return "politica";
  if (tem("HM", "HN", "HV")) return "sociologia";
  if (tem("LA", "LB", "LC")) return "educacao-popular";
  if (tem("G", "GB", "GF")) return "geografia";
  if (tem("QE", "SD", "GE")) return "meio-ambiente";
  if (tem("PN") && sobre(/Journalism|Press|Newspapers/i)) return "midia";
  if (lingua === "pt") {
    if (tem("PC")) return "portugues";
    if (tem("PQ", "PN", "PA", "PR", "PS", "PT")) return "literatura";
    if (tem("D", "DA", "DB", "DC", "DD", "DE", "DF", "DG", "DP", "DS", "DT", "E", "F")) return "historia";
    return null;
  }
  if (tem("PE")) return "ingles";
  if (tem("D", "DT", "DS", "F") && sobre(/Brazil|Latin America|South America|Africa|Revolution/i)) return "historia";
  return null;
}

const LINGUAS = { pt: "Português", en: "Inglês", es: "Espanhol", zh: "Chinês" };

async function gutenberg(arquivo) {
  const texto = arquivo
    ? fs.readFileSync(arquivo, "utf8")
    : await (await fetch("https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv", { headers: agente, signal: AbortSignal.timeout(300_000) })).text();
  const porArea = new Map();
  const vistos = new Set();
  // Português primeiro: é a língua de quem estuda aqui.
  const obras = lerCsv(texto).filter((obra) => obra.Type === "Text").sort((a, b) => (a.Language === "pt" ? 0 : 1) - (b.Language === "pt" ? 0 : 1) || Number(a["Text#"]) - Number(b["Text#"]));
  for (const obra of obras) {
    const area = disciplina(obra);
    if (!area) continue;
    const autor = autores(obra.Authors);
    const completo = obra.Title.split("\n")[0].replace(/\s+/g, " ").trim();
    const titulo = completo.length > 140 ? `${completo.slice(0, 137).trimEnd()}…` : completo;
    if (!autor || titulo.length < 3) continue;
    const chave = `${titulo.toLowerCase()}|${autor.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    const lista = porArea.get(area) ?? [];
    if (lista.length >= LIMITE) continue;
    vistos.add(chave);
    lista.push({ t: titulo, a: autor, u: `https://www.gutenberg.org/ebooks/${obra["Text#"]}`, f: "Project Gutenberg", l: "Domínio público", i: LINGUAS[obra.Language] });
    porArea.set(area, lista);
  }
  return porArea;
}

// ───────────── Arquivo Marxista na Internet ─────────────

const MARXISTAS = [
  ["marx", "Karl Marx e Friedrich Engels", "marxismo"],
  ["luxemburgo", "Rosa Luxemburgo", "marxismo"],
  ["gramsci", "Antonio Gramsci", "marxismo"],
  ["mariategui", "José Carlos Mariátegui", "marxismo"],
  ["lenin", "Vladimir Lenin", "socialismo"],
  ["trotsky", "Leon Trotsky", "socialismo"],
  ["stalin", "Josef Stalin", "socialismo"],
  ["guevara", "Ernesto Che Guevara", "socialismo"],
  ["castro", "Fidel Castro", "socialismo"],
  ["mao", "Mao Tsé-tung", "ideologia-e-politica"],
  ["kollontai", "Alexandra Kollontai", "feminismo"],
];

// Entidades com nome que aparecem nas páginas antigas ("Fam&iacute;lia").
const ENTIDADES = { nbsp: " ", amp: "&", quot: '"', laquo: "«", raquo: "»", ndash: "–", mdash: "—", ordm: "º", ordf: "ª", ccedil: "ç", ntilde: "ñ" };
const ACENTOS = { acute: "áéíóú", grave: "àèìòù", circ: "âêîôû", uml: "äëïöü" };
for (const [sinal, letras] of Object.entries(ACENTOS)) [..."aeiou"].forEach((letra, n) => (ENTIDADES[`${letra}${sinal}`] = letras[n]));
Object.assign(ENTIDADES, { atilde: "ã", otilde: "õ" });
// As mesmas, em maiúsculas: "&Eacute;" → "É".
for (const [nome, letra] of Object.entries(ENTIDADES)) if (/^[a-z](acute|grave|circ|uml|tilde|cedil)$/.test(nome)) ENTIDADES[nome[0].toUpperCase() + nome.slice(1)] = letra.toUpperCase();

const decodificar = (texto) =>
  texto
    .replace(/<[^>]+>/g, "")
    .replace(/&([A-Za-z]+);/g, (tudo, nome) => ENTIDADES[nome] ?? tudo)
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCodePoint(Number(codigo)))
    .replace(/\s+/g, " ")
    .trim();

async function marxistas() {
  const porArea = new Map();
  for (const [pasta, autor, area] of MARXISTAS) {
    const base = `https://www.marxists.org/portugues/${pasta}/`;
    let pagina;
    try {
      const resposta = await fetch(`${base}index.htm`, { headers: agente, signal: AbortSignal.timeout(60_000) });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      // O arquivo tem páginas antigas em latin-1 e novas em utf-8: respeita o que o cabeçalho ou a página declarar.
      const bytes = Buffer.from(await resposta.arrayBuffer());
      const latin = /charset=["']?(iso-8859-1|windows-1252)/i.test(bytes.toString("latin1").slice(0, 2000));
      pagina = new TextDecoder(latin ? "windows-1252" : "utf-8").decode(bytes);
    } catch (erro) {
      console.warn(`[catálogo] ${pasta}: ${erro.message}; autor pulado.`);
      continue;
    }
    const lista = porArea.get(area) ?? [];
    const vistos = new Set(lista.map((item) => item.u));
    let doAutor = 0;
    // As obras ficam em subpastas com o ano: "1867/capital/index.htm".
    for (const achado of pagina.matchAll(/<a\s+href="(\d{4}\/[^"#]+\.html?)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const titulo = decodificar(achado[2]).slice(0, 160);
      const url = new URL(achado[1], base).href;
      if (titulo.length < 4 || vistos.has(url) || doAutor >= 60) continue;
      vistos.add(url);
      doAutor++;
      lista.push({ t: titulo, a: autor, u: url, f: "Arquivo Marxista na Internet", l: "Conforme a fonte", i: "Português" });
    }
    porArea.set(area, lista);
  }
  return porArea;
}

// ───────────── Gravação ─────────────

const [doGutenberg, doArquivo] = await Promise.all([gutenberg(process.argv[2]), marxistas()]);
fs.mkdirSync(destino, { recursive: true });
let total = 0;
for (const area of new Set([...doGutenberg.keys(), ...doArquivo.keys()])) {
  // Os textos do Arquivo Marxista vêm primeiro: estão em português.
  const obras = [...(doArquivo.get(area) ?? []), ...(doGutenberg.get(area) ?? [])];
  fs.writeFileSync(path.join(destino, `${area}.json`), JSON.stringify(obras, null, 1) + "\n");
  console.log(`${area.padEnd(24)} ${obras.length}`);
  total += obras.length;
}
console.log(`\n${total} obras no catálogo ampliado. Confira uma amostra antes de publicar.`);
