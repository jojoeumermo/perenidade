// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere as contas das ferramentas práticas (a lógica pura, em lib/ferramentas). Toda conta e todo método mostrados
// a quem estuda precisam estar certos. Uso: npm run testar:ferramentas
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acharEscala, contarTexto, contraste, corpos, deHsl, fcMaxima, fcMaximaAntiga, harmonias, lerHex, mapaParaReal, maisValia, paraHex, paraHsl, pesoEm, realParaMapa, tempoDaLuz } from "../lib/ferramentas/diversas.ts";
import { classes, lerNumeros, resumir } from "../lib/ferramentas/estatistica.ts";
import { cruzar, proporcao } from "../lib/ferramentas/genetica.ts";
import { escrever, lerProposicao, tabelaVerdade } from "../lib/ferramentas/logica.ts";
import { balancear, escreverEquacao, lerFormula, massaMolar } from "../lib/ferramentas/quimica.ts";
import { porcentagemDe, quantoPorcento, regraDeTres, resolver, resolverEquacao, resolverExpressao, resolverSistema, ResolverError, variacao } from "../lib/ferramentas/resolvedor.ts";
import { converter } from "../lib/ferramentas/unidades.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)}, esperava ${JSON.stringify(esperado)}`);
};
const perto = (nome, valor, esperado, tolerancia = 1e-9) => {
  if (typeof valor === "number" && Math.abs(valor - esperado) <= tolerancia * Math.max(1, Math.abs(esperado))) certos++;
  else falhas.push(`${nome}: veio ${valor}, esperava ${esperado}`);
};
const erro = (nome, funcao, codigo) => {
  try {
    const r = funcao();
    falhas.push(`${nome}: deveria dar o erro "${codigo}", mas deu ${JSON.stringify(r?.respostas ?? r)}`);
  } catch (e) {
    if (e?.codigo === codigo || e?.code === codigo) certos++;
    else falhas.push(`${nome}: esperava o erro "${codigo}", veio ${e?.codigo ?? e?.message}`);
  }
};

// ── Resolvedor: expressões com frações ──
const exp = (texto) => resolverExpressao(texto).respostas[0];
igual("1/2 + 1/3", exp("1/2 + 1/3"), "5/6");
igual("3/4 − 1/4 simplifica", exp("3/4 - 1/4"), "1/2");
igual("2/3 × 3/4", exp("2/3 * 3/4"), "1/2");
igual("dividir por fração", exp("1/2 ÷ 3/4"), "2/3");
igual("ordem das operações", exp("2 + 3 × 4"), "14");
igual("parênteses", exp("(2 + 3) × 4"), "20");
igual("potência", exp("2^10"), "1024");
igual("potência de fração", exp("(2/3)^2"), "4/9");
igual("expoente negativo", exp("2^-2"), "1/4");
igual("negativo", exp("-1/2 + 1"), "1/2");
igual("decimal com vírgula", exp("0,5 + 1/4"), "3/4");
igual("porcentagem dentro da conta", exp("50% × 30"), "15");
igual("divisão inteira vira fração", exp("7 ÷ 2"), "7/2");
igual("menos com menos", exp("3 - (-2)"), "5");
igual("conta grande sem transbordar", exp("(1/3)^30 × 3^30"), "1");
igual("mmc aparece como passo", resolverExpressao("1/4 + 1/6").passos.some((p) => p.chave === "mmc" && p.valores.m === "12"), true);
igual("simplificação aparece como passo", resolverExpressao("2/4 + 0").passos.some((p) => p.chave === "simplificar"), true);
igual("número misto", resolverExpressao("7/2").passos.find((p) => p.chave === "misto")?.valores, { inteiro: "3", fracao: "1/2" });
erro("divisão por zero", () => resolverExpressao("1 ÷ 0"), "divisao");
erro("fração com zero embaixo", () => resolverExpressao("1/0"), "divisao");
erro("texto vazio", () => resolverExpressao("  "), "vazio");
erro("símbolo estranho", () => resolverExpressao("2 # 3"), "leitura");
erro("função fora do resolvedor exato", () => resolverExpressao("sen(30)"), "nao_suportado");

// ── Resolvedor: equação do 1º grau ──
const eq = (texto, o) => resolverEquacao(texto, o);
igual("2x + 3 = 11", eq("2x + 3 = 11").respostas, ["x = 4"]);
igual("x dos dois lados", eq("5x - 2 = 3x + 8").respostas, ["x = 5"]);
igual("resposta em fração", eq("3x = 2").respostas, ["x = 2/3"]);
igual("coeficiente negativo", eq("-4x + 1 = 9").respostas, ["x = −2"]);
igual("distributiva", eq("2(x + 3) = 4x").respostas, ["x = 3"]);
igual("frações na equação", eq("x/2 + x/3 = 5").respostas, ["x = 6"]);
igual("decimal", eq("0,5x = 2").respostas, ["x = 4"]);
igual("identidade", eq("2x + 2 = 2(x + 1)").tipo, "identidade");
igual("sem solução", eq("x + 1 = x + 2").tipo, "impossivel");
igual("passo de transpor", eq("5x - 2 = 3x + 8").passos.find((p) => p.chave === "transpor")?.conta, "5x − 3x = 8 + 2");
erro("x no denominador", () => eq("1/x = 2"), "nao_suportado");
erro("grau 3", () => eq("x^3 = 8"), "grau");
erro("dois sinais de igual", () => eq("x = 2 = 3"), "leitura");

// ── Resolvedor: equação do 2º grau ──
igual("x² − 5x + 6 = 0", eq("x^2 - 5x + 6 = 0").respostas, ["x₁ = 3", "x₂ = 2"]);
igual("x² = 9", eq("x^2 = 9").respostas, ["x₁ = 3", "x₂ = −3"]);
igual("raiz dupla", eq("x^2 - 4x + 4 = 0").respostas, ["x = 2"]);
igual("raízes racionais", eq("2x^2 - x - 1 = 0").respostas, ["x₁ = 1", "x₂ = −1/2"]);
igual("Δ negativo sem complexas", eq("x^2 + x + 1 = 0").respostas, []);
igual("Δ negativo avisa", eq("x^2 + x + 1 = 0").passos.some((p) => p.chave === "delta_negativo"), true);
igual("complexas quando pedidas", eq("x^2 + 4 = 0", { complexas: true }).respostas, ["x₁ = 2i", "x₂ = −2i"]);
igual("complexas com parte real", eq("x^2 - 2x + 5 = 0", { complexas: true }).respostas, ["x₁ = 1 + 2i", "x₂ = 1 − 2i"]);
igual("raiz irracional simplificada", eq("x^2 - 2x - 1 = 0").respostas, ["x = 1 ± √2"]);
perto("raiz irracional em decimal (1)", eq("x^2 - 2x - 1 = 0").aproximadas[0], 1 + Math.SQRT2);
perto("raiz irracional em decimal (2)", eq("x^2 - 2x - 1 = 0").aproximadas[1], 1 - Math.SQRT2);
igual("Δ calculado", eq("x^2 - 5x + 6 = 0").passos.find((p) => p.chave === "delta")?.conta, "Δ = (−5)² − 4 × 1 × 6 = 1");
igual("tira as frações antes de Bhaskara", eq("x^2/2 - x/2 - 1 = 0").respostas, ["x₁ = 2", "x₂ = −1"]);
igual("produto notável", eq("(x - 1)^2 = 4").respostas, ["x₁ = 3", "x₂ = −1"]);
igual("a negativo", eq("-x^2 + 4 = 0").respostas, ["x₁ = 2", "x₂ = −2"]);
igual("raiz com fator comum", eq("x^2 - 6x + 7 = 0").respostas, ["x = 3 ± √2"]);
igual("raiz com denominador", eq("2x^2 - 2x - 1 = 0").respostas, ["x = (1 ± √3) ÷ 2"]);

// ── Sistemas 2×2 ──
igual("sistema por adição", resolverSistema("x + y = 10; x - y = 2").respostas, ["x = 6", "y = 4"]);
igual("sistema por substituição", resolverSistema("2x + 3y = 8\nx - y = -1", "substituicao").respostas, ["x = 1", "y = 2"]);
igual("sistema com frações", resolverSistema("x + 2y = 1; 3x - y = 2").respostas, ["x = 5/7", "y = 1/7"]);
igual("sistema impossível", resolverSistema("x + y = 1; x + y = 2").tipo, "impossivel");
igual("sistema indeterminado", resolverSistema("x + y = 1; 2x + 2y = 2").tipo, "identidade");
igual("sistema com uma equação sem y", resolverSistema("2x = 6; x + y = 5").respostas, ["x = 3", "y = 2"]);
erro("sistema com três equações", () => resolverSistema("x = 1; y = 2; x + y = 3"), "sistema");
erro("sistema com x²", () => resolverSistema("x^2 + y = 1; x - y = 0"), "grau");

// ── Detecção automática ──
igual("resolver escolhe expressão", resolver("1/2 + 1/2").tipo, "expressao");
igual("resolver escolhe equação", resolver("x + 1 = 2").tipo, "equacao1");
igual("resolver escolhe sistema", resolver("x + y = 2; x - y = 0").tipo, "sistema");
erro("y numa equação de uma linha", () => resolver("x + y = 2"), "variavel");

// ── Porcentagem e regra de três ──
igual("20% de 150", porcentagemDe("20", "150").respostas, ["30"]);
igual("12,5% de 80", porcentagemDe("12,5", "80").respostas, ["10"]);
igual("15 é quantos % de 60", quantoPorcento("15", "60").respostas, ["25%"]);
igual("1 é quantos % de 3", quantoPorcento("1", "3").respostas, ["33,33%"]);
igual("aumento de 10% em 200", variacao("200", "10", true).respostas, ["220"]);
igual("desconto de 25% em 80", variacao("80", "25", false).respostas, ["60"]);
igual("regra de três direta", regraDeTres("2", "10", "5").respostas, ["x = 25"]);
igual("regra de três inversa", regraDeTres("4", "6", "3", true).respostas, ["x = 8"]);
igual("regra de três com fração", regraDeTres("3", "1", "2").respostas, ["x = 0,666667"]);
erro("porcentagem de algo que não é número", () => porcentagemDe("vinte", "100"), "numero");
erro("quantos % de zero", () => quantoPorcento("1", "0"), "divisao");
erro("regra de três com zero", () => regraDeTres("0", "1", "2"), "divisao");
void ResolverError;

// ── Conversor de unidades ──
const conv = (g, v, de, para) => converter(g, v, de, para).resultado;
perto("1 km em m", conv("comprimento", 1, "km", "m"), 1000);
perto("1 milha em km", conv("comprimento", 1, "milha", "km"), 1.609344);
perto("12 polegadas em cm", conv("comprimento", 12, "pol", "cm"), 30.48);
perto("1 hectare em m²", conv("area", 1, "ha", "m2"), 10000);
perto("1 alqueire paulista em ha", conv("area", 1, "alqueire_sp", "ha"), 2.42);
perto("1 alqueire mineiro em alqueires paulistas", conv("area", 1, "alqueire_mg", "alqueire_sp"), 2);
perto("1 L em mL", conv("volume", 1, "l", "ml"), 1000);
perto("1 m³ em L", conv("volume", 1, "m3", "l"), 1000);
perto("1 arroba em kg", conv("massa", 1, "arroba", "kg"), 15);
perto("1 libra em g", conv("massa", 1, "lb", "g"), 453.59237);
perto("1 dia em horas", conv("tempo", 1, "dia", "h"), 24);
perto("100 °C em °F", conv("temperatura", 100, "c", "f"), 212);
perto("32 °F em °C", conv("temperatura", 32, "f", "c"), 0);
perto("0 K em °C", conv("temperatura", 0, "k", "c"), -273.15);
perto("−40 °C em °F", conv("temperatura", -40, "c", "f"), -40);
perto("36,5 °C em K", conv("temperatura", 36.5, "c", "k"), 309.65);
perto("100 km/h em m/s", conv("velocidade", 100, "km_h", "m_s"), 27.7777777778, 1e-9);
perto("1 kcal em kJ", conv("energia", 1, "kcal", "kj"), 4.184);
perto("1 kWh em J", conv("energia", 1, "kwh", "j"), 3.6e6);
perto("1 atm em mmHg", conv("pressao", 1, "atm", "mmhg"), 760, 1e-6);
perto("1 cv em W", conv("potencia", 1, "cv", "w"), 735.49875);
perto("1 GiB em MB", conv("dados", 1, "gib", "mb"), 1073.741824);
perto("1 byte em bits", conv("dados", 1, "byte", "bit"), 8);
igual("fator mostrado", converter("comprimento", 3, "m", "cm").fator, 100);
igual("temperatura não tem fator", converter("temperatura", 10, "c", "f").fator, null);
erro("abaixo do zero absoluto", () => converter("temperatura", -300, "c", "k"), undefined);
erro("unidade de outra grandeza", () => converter("comprimento", 1, "kg", "m"), undefined);

// ── Química ──
const elementos = JSON.parse(fs.readFileSync(path.join(raiz, "lib/elementos.json"), "utf8"));
const existe = (s) => elementos.some((e) => e.s === s);
const contagem = (f) => Object.fromEntries(lerFormula(f, existe));
igual("H2O", contagem("H2O"), { H: 2, O: 1 });
igual("Ca(OH)2", contagem("Ca(OH)2"), { Ca: 1, O: 2, H: 2 });
igual("Al2(SO4)3", contagem("Al2(SO4)3"), { Al: 2, S: 3, O: 12 });
igual("K4[Fe(CN)6]", contagem("K4[Fe(CN)6]"), { K: 4, Fe: 1, C: 6, N: 6 });
igual("hidrato CuSO4·5H2O", contagem("CuSO4·5H2O"), { Cu: 1, S: 1, O: 9, H: 10 });
igual("hidrato com ponto", contagem("CuSO4.5H2O"), { Cu: 1, S: 1, O: 9, H: 10 });
igual("Co é cobalto", contagem("CoCl2"), { Co: 1, Cl: 2 });
igual("CO é carbono e oxigênio", contagem("CO2"), { C: 1, O: 2 });
igual("subscrito tipográfico", contagem("H₂SO₄"), { H: 2, S: 1, O: 4 });
erro("elemento que não existe", () => lerFormula("Xz2", existe), "elemento");
erro("parêntese aberto", () => lerFormula("Ca(OH2", existe), "parentese");
erro("parêntese trocado", () => lerFormula("K4[Fe(CN)6)", existe), "parentese");
erro("íon com carga", () => lerFormula("SO4^2-", existe), "carga");
perto("massa molar da água", massaMolar("H2O", elementos).total, 18.015, 1e-3);
perto("massa molar do NaCl", massaMolar("NaCl", elementos).total, 58.44, 1e-3);
perto("massa molar da glicose", massaMolar("C6H12O6", elementos).total, 180.156, 1e-3);
perto("massa molar do sulfato de cobre penta-hidratado", massaMolar("CuSO4·5H2O", elementos).total, 249.68, 1e-3);
perto("composição: hidrogênio na água", massaMolar("H2O", elementos).partes.find((p) => p.simbolo === "H").porcento, 11.19, 1e-2);
const eqq = (e) => escreverEquacao(balancear(e, existe));
igual("água", eqq("H2 + O2 -> H2O"), "2H2 + O2 → 2H2O");
igual("combustão do metano", eqq("CH4 + O2 → CO2 + H2O"), "CH4 + 2O2 → CO2 + 2H2O");
igual("combustão do propano", eqq("C3H8 + O2 = CO2 + H2O"), "C3H8 + 5O2 → 3CO2 + 4H2O");
igual("ferrugem", eqq("Fe + O2 -> Fe2O3"), "4Fe + 3O2 → 2Fe2O3");
igual("fotossíntese", eqq("CO2 + H2O -> C6H12O6 + O2"), "6CO2 + 6H2O → C6H12O6 + 6O2");
igual("neutralização", eqq("H2SO4 + NaOH -> Na2SO4 + H2O"), "H2SO4 + 2NaOH → Na2SO4 + 2H2O");
igual("com parênteses", eqq("Al + H2SO4 -> Al2(SO4)3 + H2"), "2Al + 3H2SO4 → Al2(SO4)3 + 3H2");
igual("ignora coeficiente escrito errado", eqq("3H2 + O2 -> H2O"), "2H2 + O2 → 2H2O");
igual("conferência átomo por átomo", balancear("CH4 + O2 -> CO2 + H2O", existe).conferencia.every((c) => c.esquerda === c.direita), true);
erro("reação impossível", () => balancear("H2 -> O2", existe), "sem_solucao");
erro("sem seta", () => balancear("H2 + O2", existe), "seta");
erro("várias soluções independentes", () => balancear("H2 + O2 -> H2O + H2O2", existe), "varias_solucoes");

// ── Genética ──
const c1 = cruzar("Aa", "Aa");
igual("monoibridismo: genótipos 1:2:1", c1.genotipos, [{ genotipo: "Aa", vezes: 2 }, { genotipo: "AA", vezes: 1 }, { genotipo: "aa", vezes: 1 }]);
igual("monoibridismo: fenótipos 3:1", c1.fenotipos, [{ fenotipo: "A_", vezes: 3 }, { fenotipo: "aa", vezes: 1 }]);
igual("dominante sempre primeiro", cruzar("aa", "AA").genotipos, [{ genotipo: "Aa", vezes: 4 }]);
const c2 = cruzar("AaBb", "AaBb");
igual("di-hibridismo: 16 casas", c2.total, 16);
igual("di-hibridismo: 9:3:3:1", proporcao(c2.fenotipos.map((f) => f.vezes)), [9, 3, 3, 1]);
igual("di-hibridismo: 9 genótipos diferentes", c2.genotipos.length, 9);
igual("cruzamento-teste", proporcao(cruzar("AaBb", "aabb").fenotipos.map((f) => f.vezes)), [1, 1, 1, 1]);
const x = cruzar("XAXa", "XAY");
igual("ligada ao X: gametas da mãe", x.gametasMae, ["XA", "Xa"]);
igual("ligada ao X: metade dos meninos afetados", x.fenotipos.find((f) => f.fenotipo === "homem:afetado")?.vezes, 1);
igual("ligada ao X: meninas portadoras", x.fenotipos.find((f) => f.fenotipo === "mulher:portadora")?.vezes, 1);
igual("ligada ao X: nenhuma menina afetada", x.fenotipos.some((f) => f.fenotipo === "mulher:afetado"), false);
igual("pai afetado e mãe normal: filhas portadoras", cruzar("XAXA", "XaY").fenotipos.find((f) => f.fenotipo === "mulher:portadora")?.vezes, 2);
erro("genes diferentes", () => cruzar("Aa", "Bb"), "genes_diferentes");
erro("genótipo com uma letra só", () => cruzar("A", "Aa"), "genotipo");
erro("três genes", () => cruzar("AaBbCc", "AaBbCc"), "muitos_genes");
erro("mãe com Y", () => cruzar("XAY", "XAY"), "sexo");

// ── Estatística ──
const r = resumir(lerNumeros("2; 4; 4; 4; 5; 5; 7; 9"));
perto("média", r.media, 5);
perto("mediana com n par", r.mediana, 4.5);
igual("moda", r.modas, [4]);
perto("desvio populacional", r.desvioPopulacional, 2);
perto("desvio amostral", r.desvioAmostral, 2.1380899353, 1e-9);
perto("variância amostral", r.varianciaAmostral, 32 / 7);
perto("amplitude", r.amplitude, 7);
perto("Q1 (metade de baixo)", r.q1, 4);
perto("Q3 (metade de cima)", r.q3, 6);
const r2 = resumir(lerNumeros("1,5; 2,5; 3,5"));
perto("vírgula decimal", r2.media, 2.5);
perto("mediana com n ímpar", r2.mediana, 2.5);
igual("amodal", r2.modas, []);
perto("Q1 com n ímpar exclui a mediana", resumir([1, 2, 3, 4, 5, 6, 7]).q1, 2);
igual("só vírgulas separam", lerNumeros("1,2,3"), [1, 2, 3]);
igual("vírgula com espaço separa", lerNumeros("1, 2, 3"), [1, 2, 3]);
igual("espaços separam e a vírgula é decimal", lerNumeros("1,5 2 3"), [1.5, 2, 3]);
igual("quebra de linha", lerNumeros("10\n20\n30"), [10, 20, 30]);
igual("negativos", lerNumeros("-1; −2; 3"), [-1, -2, 3]);
igual("milhar com ponto", lerNumeros("1.200,5; 3"), [1200.5, 3]);
igual("um número só não tem amostral", resumir([7]).desvioAmostral, null);
igual("bimodal", resumir([1, 1, 2, 2, 3]).modas, [1, 2]);
igual("Sturges: 8 números, 4 classes", classes([2, 4, 4, 4, 5, 5, 7, 9]).length, 4);
igual("classes contam todo mundo", classes([2, 4, 4, 4, 5, 5, 7, 9]).reduce((s, c) => s + c.vezes, 0), 8);
erro("texto no meio", () => lerNumeros("1; dois; 3"), "numero");
erro("lista vazia", () => lerNumeros("  "), "vazio");

// ── Tabela-verdade ──
const tv = (t) => tabelaVerdade(t);
igual("p ∨ ¬p é tautologia", tv("p ou não p").classificacao, "tautologia");
igual("p ∧ ¬p é contradição", tv("p & ~p").classificacao, "contradicao");
igual("p → q é contingência", tv("p -> q").classificacao, "contingencia");
igual("p → q só é falsa em V,F", tv("p -> q").linhas.map((l) => l.resultados.at(-1)), [true, false, true, true]);
igual("bicondicional", tv("p <-> q").linhas.map((l) => l.resultados.at(-1)), [true, false, false, true]);
igual("ou exclusivo", tv("p xor q").linhas.map((l) => l.resultados.at(-1)), [false, true, true, false]);
igual("De Morgan é tautologia", tv("~(p & q) <-> (~p | ~q)").classificacao, "tautologia");
igual("modus ponens é tautologia", tv("((p -> q) & p) -> q").classificacao, "tautologia");
igual("condicional agrupa pela direita", escrever(lerProposicao("p -> q -> r")), "p → q → r");
igual("e liga mais forte que ou", escrever(lerProposicao("p | q & r")), "p ∨ q ∧ r");
igual("parênteses mantidos quando precisa", escrever(lerProposicao("(p | q) & r")), "(p ∨ q) ∧ r");
igual("8 linhas com três letras", tv("p & q & r").linhas.length, 8);
igual("primeira linha toda verdadeira", tv("p & q").linhas[0].valores, [true, true]);
igual("colunas intermediárias", tv("(p -> q) & p").colunas, ["p → q", "(p → q) ∧ p"]);
erro("parêntese aberto", () => tv("(p & q"), "parentese");
erro("símbolo estranho", () => tv("p # q"), "simbolo");
erro("operador sem o outro lado", () => tv("p &"), "falta");
erro("sete letras", () => tv("p & q & r & s & t & u & w"), "muitas");

// ── Sistema solar, escala, saúde, cores, mais-valia, redação ──
perto("peso em Marte", pesoEm(60, corpos.find((c) => c.id === "marte").gravidade), 22.653, 1e-3);
perto("luz do Sol à Terra (s)", tempoDaLuz(149.6), 499.0, 1e-3);
perto("escala: 5 cm em 1:100.000 são 5 km", mapaParaReal(5, "cm", 100000, "km"), 5);
perto("escala: 2 km em 1:50.000 são 4 cm", realParaMapa(2, "km", 50000, "cm"), 4);
perto("escala: 3 cm para 15 km é 1:500.000", acharEscala(3, "cm", 15, "km"), 500000);
perto("frequência máxima aos 40 (Tanaka)", fcMaxima(40), 180);
perto("frequência máxima aos 40 (220 − idade)", fcMaximaAntiga(40), 180);
perto("Tanaka aos 20", fcMaxima(20), 194);
erro("idade impossível", () => fcMaxima(5), undefined);
igual("hex curto", lerHex("#fff"), { r: 255, g: 255, b: 255 });
igual("hex do vermelho", paraHex({ r: 194, g: 31, b: 22 }), "#c21f16");
igual("HSL do vermelho puro", paraHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
igual("de HSL para RGB", deHsl(120, 100, 50), { r: 0, g: 255, b: 0 });
igual("complementar do vermelho", harmonias({ r: 255, g: 0, b: 0 }).complementar, ["#00ffff"]);
igual("tríade do vermelho", harmonias({ r: 255, g: 0, b: 0 }).triade, ["#00ff00", "#0000ff"]);
perto("contraste preto e branco é 21", contraste(lerHex("#000"), lerHex("#fff")), 21);
perto("contraste igual é 1", contraste(lerHex("#777"), lerHex("#777")), 1);
perto("contraste do texto do site (tinta no papel)", contraste(lerHex("#1f1a14"), lerHex("#f4ecd8")), 14.67, 0.001);
erro("hex inválido", () => lerHex("#zzz"), undefined);
const mv = maisValia(8, 4, 100);
perto("valor por hora", mv.valorPorHora, 25);
perto("valor novo da jornada", mv.valorNovo, 200);
perto("mais-valia", mv.maisValia, 100);
perto("taxa de 100% quando metade é excedente", mv.taxa, 1);
perto("taxa com 10 horas e 2 necessárias", maisValia(10, 2, 50).taxa, 4);
erro("necessário maior que a jornada", () => maisValia(6, 8, 100), undefined);
const ct = contarTexto("Primeiro parágrafo curto.\n\nSegundo parágrafo, um pouco maior que o primeiro.", 30);
igual("parágrafos", ct.paragrafos, 2);
igual("palavras", ct.palavras, 11);
igual("linhas estimadas", ct.linhas, 3);
igual("texto vazio", contarTexto("", 70), { palavras: 0, caracteres: 0, semEspacos: 0, paragrafos: 0, linhas: 0 });

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
