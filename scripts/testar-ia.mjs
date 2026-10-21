// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o motor do laboratório de IA: a rede aprende o XOR e o círculo, a mesma semente dá o mesmo resultado, o k
// vizinhos e o k-médias fazem o que dizem, o ajuste polinomial acerta dados exatos e o modelo de próxima palavra conta
// direito. Uso: npm run testar:ia
import { ajustarPolinomio, avaliar, bigramas, criarRede, entradas, gerarDados, knn, passoKMedias, polinomio, proximas, treinar } from "../components/labs/ia/motor.ts";

let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));

const preparar = (pts, usadas) => pts.map((p) => ({ x: entradas(p.x, p.y, usadas), y: p.c }));

// XOR: com x1 e x2 e uma camada oculta, a rede aprende.
const xor = preparar(gerarDados("xor", 200, 0, 7), ["x1", "x2"]);
const redeXor = criarRede(2, [6, 4], "tanh", 3);
const antes = avaliar(redeXor, xor);
for (let e = 0; e < 300; e++) treinar(redeXor, xor, 0.1, 0, 10, e);
const depois = avaliar(redeXor, xor);
confere(`XOR: a perda cai (${antes.perda.toFixed(3)} → ${depois.perda.toFixed(3)})`, depois.perda < antes.perda / 2);
confere(`XOR: acerto acima de 90% (${(depois.acerto * 100).toFixed(0)}%)`, depois.acerto > 0.9);

// Círculo com x1² e x2²: até sem camada oculta (uma reta no espaço das características) resolve.
const circulo = preparar(gerarDados("circulo", 200, 0, 5), ["x1²", "x2²"]);
const redeCirculo = criarRede(2, [], "tanh", 1);
for (let e = 0; e < 200; e++) treinar(redeCirculo, circulo, 0.3, 0, 10, e);
confere(`círculo com x1² e x2²: acerto acima de 95% (${(avaliar(redeCirculo, circulo).acerto * 100).toFixed(0)}%)`, avaliar(redeCirculo, circulo).acerto > 0.95);

// Reprodutível: mesma semente, mesmos pesos e mesmos dados.
const a = criarRede(3, [4], "relu", 42);
const b = criarRede(3, [4], "relu", 42);
confere("mesma semente, mesma rede", JSON.stringify(a.pesos) === JSON.stringify(b.pesos));
confere("mesma semente, mesmos dados", JSON.stringify(gerarDados("espiral", 50, 0.2, 9)) === JSON.stringify(gerarDados("espiral", 50, 0.2, 9)));

// k vizinhos
const pts = [{ x: 0, y: 0, c: 1 }, { x: 0.5, y: 0, c: 1 }, { x: 0, y: 0.5, c: 1 }, { x: 5, y: 5, c: -1 }, { x: 5.5, y: 5, c: -1 }];
confere("k vizinhos: perto do grupo azul é azul", knn(pts, 0.2, 0.2, 3) === 1);
confere("k vizinhos: perto do grupo laranja é laranja", knn(pts, 5, 5.2, 1) === -1);

// k-médias converge para os dois grupos
const nuvem = [...Array.from({ length: 10 }, (_, i) => ({ x: i * 0.05, y: 0 })), ...Array.from({ length: 10 }, (_, i) => ({ x: 10 + i * 0.05, y: 0 }))];
let centros = [{ x: 3, y: 0 }, { x: 4, y: 0 }];
for (let i = 0; i < 5; i++) centros = passoKMedias(nuvem, centros).centros;
const xs = centros.map((c) => c.x).sort((p, q) => p - q);
confere(`k-médias acha os dois grupos (${xs.map((x) => x.toFixed(2)).join(", ")})`, Math.abs(xs[0] - 0.225) < 0.01 && Math.abs(xs[1] - 10.225) < 0.01);

// Ajuste polinomial: dados exatos de 2x² − 3x + 1 são recuperados.
const px = [-2, -1, 0, 1, 2, 3];
const coef = ajustarPolinomio(px, px.map((x) => 2 * x * x - 3 * x + 1), 2);
confere(`polinômio de grau 2 recuperado (${coef.map((c) => c.toFixed(3)).join(", ")})`, Math.abs(coef[0] - 1) < 1e-6 && Math.abs(coef[1] + 3) < 1e-6 && Math.abs(coef[2] - 2) < 1e-6);
confere("polinômio avaliado", Math.abs(polinomio(coef, 4) - 21) < 1e-6);

// Próxima palavra
const m = bigramas("o gato comeu. o gato dormiu. o cachorro latiu.");
const depoisDeO = proximas(m, "o", 1);
confere("depois de 'o', 'gato' é a mais provável (2 de 3)", depoisDeO[0][0] === "gato" && Math.abs(depoisDeO[0][1] - 2 / 3) < 1e-9);
confere("temperatura baixa quase sempre escolhe a mais comum", proximas(m, "o", 0.1)[0][1] > 0.99);
confere("palavra desconhecida não tem próxima", proximas(m, "zebra", 1).length === 0);

console.log(`ia: ${certos} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
