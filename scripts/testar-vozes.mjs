// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o que prepara o texto para as vozes naturais (lib/vozes/normalizar.ts), o léxico (content/vozes/lexico.yml),
// a divisão em frases, o motor (public/workers/voz-motor.js, sem modelo) e a lista de vozes do vozes:baixar.
// Não precisa dos modelos: o teste de verdade, com a voz baixada, é scripts/testar-vozes-real.mjs.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { decimal, dividirEmFrases, fracao, lerSigla, lerTex, normalizar, normalizarOutroIdioma, ordinal, porExtenso, romano } from "../lib/vozes/normalizar.ts";
import { conferirLexico, lerLexico } from "../lib/vozes/lexico.ts";
import { escolherVoz, marcarTrechos, proximoTrecho } from "../lib/vozes/trechos.ts";

const raiz = path.resolve(import.meta.dirname, "..");
let ok = 0;
const falhas = [];
const igual = (nome, veio, esperado) => (veio === esperado ? ok++ : falhas.push(`${nome}\n    veio:     ${veio}\n    esperado: ${esperado}`));
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// ── Números por extenso ──
const CARDINAIS = [
  [0, "zero"], [1, "um"], [10, "dez"], [11, "onze"], [14, "catorze"], [16, "dezesseis"], [19, "dezenove"], [20, "vinte"], [21, "vinte e um"],
  [99, "noventa e nove"], [100, "cem"], [101, "cento e um"], [110, "cento e dez"], [162, "cento e sessenta e dois"], [200, "duzentos"],
  [999, "novecentos e noventa e nove"], [1000, "mil"], [1001, "mil e um"], [1020, "mil e vinte"], [1100, "mil e cem"], [1200, "mil e duzentos"],
  [1230, "mil duzentos e trinta"], [1822, "mil oitocentos e vinte e dois"], [1964, "mil novecentos e sessenta e quatro"], [2000, "dois mil"],
  [2026, "dois mil e vinte e seis"], [10000, "dez mil"], [21000, "vinte e um mil"], [100000, "cem mil"], [101000, "cento e um mil"],
  [1000000, "um milhão"], [2000000, "dois milhões"], [1500000, "um milhão e quinhentos mil"], [1000001, "um milhão e um"],
  [2300450, "dois milhões trezentos mil quatrocentos e cinquenta"], [1000000000, "um bilhão"], [-5, "menos cinco"],
];
for (const [n, esperado] of CARDINAIS) igual(`porExtenso(${n})`, porExtenso(n), esperado);
igual("feminino 1", porExtenso(1, "f"), "uma");
igual("feminino 2", porExtenso(2, "f"), "duas");
igual("feminino 202", porExtenso(202, "f"), "duzentas e duas");
igual("feminino 2000", porExtenso(2000, "f"), "duas mil");
igual("feminino 2 milhões", porExtenso(2000000, "f"), "dois milhões");
igual("feminino 532", porExtenso(532, "f"), "quinhentas e trinta e duas");
igual("feminino 21", porExtenso(21, "f"), "vinte e uma");

// ── Ordinais, decimais, frações, romanos ──
igual("ordinal 1", ordinal(1), "primeiro");
igual("ordinal 2 f", ordinal(2, "f"), "segunda");
igual("ordinal 22 f", ordinal(22, "f"), "vigésima segunda");
igual("ordinal 100", ordinal(100), "centésimo");
igual("ordinal 1000", ordinal(1000), "milésimo");
igual("ordinal 357", ordinal(357), "trecentésimo quinquagésimo sétimo");
igual("decimal 0,81", decimal("0", "81"), "zero vírgula oitenta e um");
igual("decimal 3,05", decimal("3", "05"), "três vírgula zero cinco");
igual("decimal 8,5", decimal("8", "5"), "oito vírgula cinco");
igual("decimal longo", decimal("3", "14159"), "três vírgula um quatro um cinco nove");
igual("fração 1/2", fracao(1, 2), "um meio");
igual("fração 3/4", fracao(3, 4), "três quartos");
igual("fração 2/3", fracao(2, 3), "dois terços");
igual("fração 5/12", fracao(5, 12), "cinco doze avos");
igual("fração 7/100", fracao(7, 100), "sete centésimos");
igual("romano XX", romano("XX"), 20);
igual("romano XIV", romano("XIV"), 14);
igual("romano XIX", romano("XIX"), 19);

// ── Siglas ──
igual("sigla ONU", lerSigla("ONU"), "Onu");
igual("sigla SUS", lerSigla("SUS"), "Sus");
igual("sigla STF", lerSigla("STF"), "ésse tê éfe");
igual("sigla IBGE", lerSigla("IBGE"), "i bê gê é");

// ── Frases inteiras ──
const lex = lerLexico();
const CASOS = [
  // dinheiro
  ["R$ 162,00", "cento e sessenta e dois reais"],
  ["R$ 162,50", "cento e sessenta e dois reais e cinquenta centavos"],
  ["R$ 1,00", "um real"],
  ["R$ 0,50", "cinquenta centavos"],
  ["R$ 0,01", "um centavo"],
  ["R$ 1.500", "mil e quinhentos reais"],
  ["R$ 1.000.000,00", "um milhão de reais"],
  ["R$ 2 milhões", "dois milhões de reais"],
  ["R$ 1,5 bilhão", "um vírgula cinco bilhão de reais"],
  ["US$ 20", "vinte dólares"],
  ["custou R$162,50.", "custou cento e sessenta e dois reais e cinquenta centavos."],
  // porcentagem
  ["19%", "dezenove por cento"],
  ["2,5%", "dois vírgula cinco por cento"],
  ["100 %", "cem por cento"],
  ["caiu -3%", "caiu menos três por cento"],
  // decimais e milhares
  ["0,81", "zero vírgula oitenta e um"],
  ["1.500 pessoas", "mil e quinhentas pessoas"],
  ["2 questões", "duas questões"],
  ["2 mil pessoas", "duas mil pessoas"],
  ["21 dias", "vinte e um dias"],
  ["R$ 2 mil", "dois mil reais"],
  ["8,5 milhões de habitantes", "oito vírgula cinco milhões de habitantes"],
  ["8,5 milhões de km²", "oito vírgula cinco milhões de quilômetros quadrados"],
  ["o preço do m² subiu", "o preço do metros quadrados subiu"],
  ["2 mil anos", "dois mil anos"],
  ["1 milhão", "um milhão"],
  ["-5 graus", "menos cinco graus"],
  // anos e datas
  ["Em 1822, Dom Pedro I proclamou a independência.", "Em mil oitocentos e vinte e dois, Dom Pedro primeiro proclamou a independência."],
  ["D. Pedro II", "Dom Pedro segundo"],
  ["João Paulo II", "João Paulo segundo"],
  ["Luís XIV", "Luís catorze"],
  ["Rainha Elizabeth II", "Rainha Elizabeth segunda"],
  ["no século XX", "no século vinte"],
  ["séc. XIX", "século dezenove"],
  ["capítulo IV", "capítulo quatro"],
  ["07/09/1822", "sete de setembro de mil oitocentos e vinte e dois"],
  ["1/1/2000", "primeiro de janeiro de dois mil"],
  ["1º de maio", "primeiro de maio"],
  ["a 2ª Guerra", "a segunda Guerra"],
  ["o 3º lugar", "o terceiro lugar"],
  ["entre 1914–1918", "entre mil novecentos e catorze a mil novecentos e dezoito"],
  ["de 1939-1945", "de mil novecentos e trinta e nove a mil novecentos e quarenta e cinco"],
  ["500 a.C.", "quinhentos antes de Cristo"],
  ["476 d.C.", "quatrocentos e setenta e seis depois de Cristo"],
  // horas
  ["às 14h30", "às catorze horas e trinta minutos"],
  ["às 14h", "às catorze horas"],
  ["1h", "uma hora"],
  ["às 8:05", "às oito e cinco"],
  ["das 9:00", "das nove"],
  // unidades
  ["8,5 km²", "oito vírgula cinco quilômetros quadrados"],
  ["1 km", "um quilômetro"],
  ["100 km/h", "cem quilômetros por hora"],
  ["9,8 m/s²", "nove vírgula oito metros por segundo ao quadrado"],
  ["20 m/s", "vinte metros por segundo"],
  ["150 kWh", "cento e cinquenta quilowatts-hora"],
  ["220 V", "duzentos e vinte volts"],
  ["2 t", "duas toneladas"],
  ["500 g", "quinhentos gramas"],
  ["1 kg", "um quilo"],
  ["2 L", "dois litros"],
  ["37 °C", "trinta e sete graus Celsius"],
  ["37°C", "trinta e sete graus Celsius"],
  ["90°", "noventa graus"],
  ["5 min", "cinco minutos"],
  ["10 s", "dez segundos"],
  ["3 ha", "três hectares"],
  ["2 mil km", "dois mil quilômetros"],
  // símbolos e fórmulas
  ["2 + 2 = 4", "dois mais dois é igual a quatro"],
  ["5 - 3 = 2", "cinco menos três é igual a dois"],
  ["3 × 4", "três vezes quatro"],
  ["3x4", "três vezes quatro"],
  ["10 ÷ 2", "dez dividido por dois"],
  ["x ≠ y", "x é diferente de y"],
  ["a ≤ b", "a é menor ou igual a b"],
  ["x² + 1", "x ao quadrado mais um"],
  ["10³", "dez ao cubo"],
  ["10⁻³", "dez elevado a menos três"],
  ["3 × 10⁸ m/s", "três vezes dez elevado a oito metros por segundo"],
  ["2^10", "dois elevado a dez"],
  ["√16 = 4", "raiz quadrada de dezesseis é igual a quatro"],
  ["3/4 da turma", "três quartos da turma"],
  ["1/2", "um meio"],
  ["½ xícara", "um meio xícara"],
  ["π ≈ 3,14", "pi é aproximadamente três vírgula catorze"],
  ["±2", "mais ou menos dois"],
  ["3 < 5", "três é menor que cinco"],
  ["Pão & Circo", "Pão e Circo"],
  // abreviações
  ["Sr. Silva", "senhor Silva"],
  ["Dra. Ana", "doutora Ana"],
  ["Prof. Paulo", "professor Paulo"],
  ["art. 5º", "artigo quinto"],
  ["nº 10", "número dez"],
  ["pág. 32", "página trinta e dois"],
  ["§ 2º", "parágrafo segundo"],
  ["livros, cadernos etc.", "livros, cadernos etcétera."],
  ["ex.: água", "por exemplo: água"],
  // siglas e léxico
  ["O ENEM é feito pelo INEP.", "O Enem é feito pelo Inep."],
  ["Segundo o IBGE, o PIB cresceu.", "Segundo o i bê gê é, o Píbi cresceu."],
  ["A nota da TRI", "A nota da tê érre i"],
  ["O STF decidiu.", "O ésse tê éfe decidiu."],
  ["A ONU e o SUS", "A Onu e o Sus"],
  ["as ONGs", "as Onguis"],
  ["Marx e Engels", "Márquis e Énguels"],
  ["Acesse o site online.", "Acesse o sáite onláine."],
  ["ATENÇÃO: leia", "atenção: leia"],
  // texto comum não muda
  ["A casa é bonita.", "A casa é bonita."],
  ["Você já parou para pensar nisso? Então vamos lá!", "Você já parou para pensar nisso? Então vamos lá!"],
  ["O Brasil, a Bahia e Minas.", "O Brasil, a Bahia e Minas."],
  ["Eu vi a menina.", "Eu vi a menina."],
  ["Capítulo de A Moreninha", "Capítulo de A Moreninha"],
];
for (const [entrada, esperado] of CASOS) igual(`normalizar("${entrada}")`, normalizar(entrada, lex), esperado);

igual("tex fração", lerTex("\\frac{a}{b}"), "a sobre b");
igual("tex potência", lerTex("x^2 + 1"), "x ao quadrado mais um");
igual("tex raiz", lerTex("\\sqrt{16} = 4"), "raiz quadrada de dezesseis é igual a quatro");

// ── Outros idiomas: nada de regra brasileira ──
igual("inglês: ano em pares", normalizarOutroIdioma("In 1822, the price was 162 dollars.", "en"), "In 18 22, the price was 162 dollars.");
igual("inglês: 1900", normalizarOutroIdioma("in 1900", "en"), "in 19 hundred");
igual("inglês: 1905", normalizarOutroIdioma("in 1905", "en"), "in 19 oh 5");
igual("inglês: 2024 fica", normalizarOutroIdioma("in 2024", "en"), "in 2024");
igual("inglês: dinheiro fica", normalizarOutroIdioma("$1500 and 1.5%", "en"), "$1500 and 1.5%");
igual("espanhol: números ficam", normalizarOutroIdioma("En 1822 costaba 162 pesos, el 19%.", "es"), "En 1822 costaba 162 pesos, el 19%.");
igual("francês: sigla fica", normalizarOutroIdioma("La SNCF en 1938", "fr"), "La SNCF en 1938");

// ── Frases ──
const partes = (t) => dividirEmFrases(t).map((p) => t.slice(p.ini, p.fim));
igual("duas frases", JSON.stringify(partes("Olá, mundo. Tudo bem?")), JSON.stringify(["Olá, mundo.", "Tudo bem?"]));
igual("Sr. não corta", JSON.stringify(partes("O Sr. Silva chegou. Depois saiu.")), JSON.stringify(["O Sr. Silva chegou.", "Depois saiu."]));
igual("D. Pedro não corta", partes("D. Pedro I chegou.").length, 1);
igual("decimal com ponto não corta", partes("O valor é 3.5 metros.").length, 1);
igual("a.C. no meio não corta", partes("Em 500 a.C. Roma crescia.").length, 1);
igual("quebra de linha separa", JSON.stringify(partes("Título\nTexto da aula.")), JSON.stringify(["Título", "Texto da aula."]));
igual("reticências", JSON.stringify(partes("Ele esperou… Nada aconteceu.")), JSON.stringify(["Ele esperou…", "Nada aconteceu."]));
igual("aspas no fim", JSON.stringify(partes("Ela disse: “Vamos.” Fomos.")), JSON.stringify(["Ela disse: “Vamos.”", "Fomos."]));
igual("minúscula depois do ponto não corta", partes("Veja o item a. depois o b.").length, 1);
igual("só pontuação some", partes("— ... —").length, 0);
const longa = "Esta é uma frase muito longa, que vai continuando sem parar, com vírgulas e mais vírgulas, explicando um assunto difícil em detalhes, porque a aula precisa disso, e a pessoa que lê em voz alta precisa respirar em algum lugar, senão cansa, e a voz começa a correr no fim da frase, o que atrapalha a compreensão de quem ouve.";
const pedacos = partes(longa);
conferir("frase longa é partida", pedacos.length >= 2 && pedacos.every((p) => p.length <= 260), JSON.stringify(pedacos));
conferir("frase longa não perde texto", pedacos.join(" ").replace(/\s+/g, " ") === longa);
const offsets = dividirEmFrases("  Ah. Bem.  ");
conferir("frases sem espaço nas pontas", offsets.length === 2 && offsets[0].ini === 2 && offsets[1].fim === 10, JSON.stringify(offsets));

// ── Léxico ──
conferir("léxico do site está certo", conferirLexico(lex).length === 0, conferirLexico(lex).join("; "));
conferir("léxico pega sigla errada", conferirLexico({ siglas: { enem: "x" } }).length === 1);
conferir("léxico pega pronúncia vazia", conferirLexico({ palavras: { site: "" } }).length === 1);
conferir("léxico pega repetida", conferirLexico({ palavras: { Site: "a", site: "b" } }).length === 1);
conferir("léxico pega seção estranha", conferirLexico({ outras: {} }).length === 1);

// ── Motor (sem modelo): fonemas do Kokoro e conferência do sha256 ──
const require = createRequire(import.meta.url);
const { criarMotor, conferirSha256 } = require(path.join(raiz, "public/workers/voz-motor.js"));
const motor = criarMotor({ ort: {}, buscar: async () => new ArrayBuffer(0), criarFonemas: async () => ({}), fonemas: {} });
igual("kokoro: africadas viram um símbolo", motor.fonemasDoKokoro(["t", "ʃ", "ˈ", "i", "a", " ", "d", "ʒ", "ˈ", "i", "a"]), "ʧˈia ʤˈia");
igual("kokoro: espaço depois do ponto", motor.fonemasDoKokoro(["a", ".", "b"]), "a. b");
igual("kokoro inglês: r vira ɹ", motor.fonemasDoKokoro(["r", "ˈ", "ɛ", "d"], "en-us"), "ɹˈɛd");
igual("kokoro português: r fica", motor.fonemasDoKokoro(["r", "ˈ", "ɛ", "d"], "pt-br"), "rˈɛd");
const { webcrypto } = await import("node:crypto");
conferir("sha256 confere", await conferirSha256(new TextEncoder().encode("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", webcrypto.subtle));
conferir("sha256 recusa", !(await conferirSha256(new TextEncoder().encode("abd"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", webcrypto.subtle)));

// ── Lista de vozes: revisões fixas, sha256 de 64 letras, Piper fora do site ──
const script = fs.readFileSync(path.join(raiz, "scripts/vozes-baixar.mjs"), "utf8");
conferir("revisões fixas (commit inteiro)", (script.match(/rev: "[0-9a-f]{40}"/g) ?? []).length === 2);
conferir("nada de 'main' nos endereços", !/resolve\/main\//.test(script));
conferir("todo arquivo tem sha256", (script.match(/origem: hf\(/g) ?? []).length === (script.match(/sha256: "[0-9a-f]{64}"/g) ?? []).length);
conferir("vozes de inglês, espanhol e francês", ["af_heart", "am_michael", "ef_dora", "em_alex", "ff_siwis"].every((v) => script.includes(`voices/${v}.bin`)));
conferir("Piper fica bloqueada", /id: "piper-m"[\s\S]*?liberada: false/.test(script));
const pacote = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
conferir("bibliotecas em versão exata", /^\d+\.\d+\.\d+$/.test(pacote.dependencies["onnxruntime-web"]) && /^\d+\.\d+\.\d+$/.test(pacote.dependencies["@diffusionstudio/piper-wasm"]));
conferir("modelos fora do Git", /^\/public\/vozes\/$/m.test(fs.readFileSync(path.join(raiz, ".gitignore"), "utf8")));

// ── Nada de terceiros no navegador: o trabalhador da voz só busca o que a lista manda, e a lista só aponta para /vozes/ ──
const trabalhador = fs.readFileSync(path.join(raiz, "public/workers/voz.js"), "utf8") + fs.readFileSync(path.join(raiz, "public/workers/voz-motor.js"), "utf8");
conferir("trabalhador sem endereço de fora", !/https?:\/\//.test(trabalhador.replace(/^\s*\/\/.*$/gm, "")));
const manifestoArq = path.join(raiz, "public/vozes/vozes.json");
if (fs.existsSync(manifestoArq)) {
  const m = JSON.parse(fs.readFileSync(manifestoArq, "utf8"));
  const urls = [m.fonemas.js, m.fonemas.wasm.url, m.fonemas.dados.url, m.ort.wasm.js, m.ort.wasm.wasm.url, m.ort.webgpu.js, ...m.vozes.flatMap((v) => v.arquivos.map((a) => a.url))];
  conferir("lista de vozes só aponta para /vozes/", urls.every((u) => u.startsWith("/vozes/")), urls.filter((u) => !u.startsWith("/vozes/")).join(", "));
  conferir("arquivos da lista existem", urls.every((u) => fs.existsSync(path.join(raiz, "public", u))));
}

// ── Trechos e a troca de voz (lib/vozes/trechos.ts): começa na hora com o aparelho, a natural entra no próximo trecho ──
{
  const texto = "Título da aula\nPrimeira frase. Segunda frase.\nItem um\nItem dois. Mais.";
  const pedacos = dividirEmFrases(texto);
  igual("trechos por bloco", JSON.stringify(marcarTrechos(texto, pedacos)), JSON.stringify([0, 1, 1, 2, 3, 3]));
  igual("trechos vazios", JSON.stringify(marcarTrechos("", [])), "[]");
  igual("próximo trecho", proximoTrecho([0, 1, 1, 2], 1), 3);
  igual("próximo trecho no fim", proximoTrecho([0, 1, 1], 2), -1);
  const base = { naturalPronta: false, somPronto: false, abreTrecho: true, vozAtual: null, aparelhoFala: true };
  igual("sem natural: aparelho na hora", escolherVoz(base), "aparelho");
  igual("sem natural nem aparelho: espera", escolherVoz({ ...base, aparelhoFala: false }), "esperar");
  igual("natural pronta, som pronto, começo de trecho: natural", escolherVoz({ ...base, naturalPronta: true, somPronto: true }), "natural");
  igual("natural pronta, som ainda não: aparelho começa", escolherVoz({ ...base, naturalPronta: true }), "aparelho");
  igual("natural pronta no meio do trecho: aparelho termina o trecho", escolherVoz({ ...base, naturalPronta: true, somPronto: true, abreTrecho: false, vozAtual: "aparelho" }), "aparelho");
  igual("natural já lendo: continua", escolherVoz({ ...base, naturalPronta: true, abreTrecho: false, vozAtual: "natural" }), "natural");
  igual("aparelho falhou: natural mesmo esperando o som", escolherVoz({ ...base, naturalPronta: true, abreTrecho: false, vozAtual: "aparelho", aparelhoFala: false }), "natural");
}

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s), ${ok} ok:\n  - ${falhas.join("\n  - ")}`);
  process.exit(1);
}
console.log(`✓ vozes: ${ok} conferências`);
