// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o motor do Laboratório de modelos com resultados conhecidos: Monty Hall (2/3 trocando), aniversário (23 pessoas
// passam de 50%), moedas convergem, Gini, SIR conserva a população, Lotka-Volterra oscila, a órbita circular conserva a
// energia, Fourier converge, o planador do Jogo da Vida anda e a regra 90 faz o triângulo de Sierpinski.
// Uso: npm run testar:modelos
import { aniversarioExato, campeonato, fourier, gini, lotkaVolterra, mediasDeDados, montyHall, moedas, orbita, partida, projetil, regraPasso, schellingInicial, schellingPasso, segregacao, sir, vidaPasso, yardSale } from "../components/labs/modelos/motor.ts";

let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const perto = (a, b, tol) => Math.abs(a - b) <= tol;

const mh = montyHall(20000, 1);
confere(`Monty Hall: trocando ganha ~2/3 (${mh.trocando.toFixed(3)})`, perto(mh.trocando, 2 / 3, 0.02));
confere("Monty Hall: a mesma semente repete", JSON.stringify(montyHall(500, 9)) === JSON.stringify(montyHall(500, 9)));
confere(`aniversário: 23 pessoas passam de 50% (${aniversarioExato(23).toFixed(4)})`, perto(aniversarioExato(23), 0.5073, 0.0005));
confere("aniversário: 1 pessoa é 0%", aniversarioExato(1) === 0);
const m = moedas(20000, 3);
confere(`moedas: a fração de caras converge para 0,5 (${m.at(-1).toFixed(3)})`, perto(m.at(-1), 0.5, 0.015));
const medias = mediasDeDados(5000, 10, 4);
const media = medias.reduce((s, x) => s + x, 0) / medias.length;
confere(`médias de 10 dados ficam perto de 3,5 (${media.toFixed(3)})`, perto(media, 3.5, 0.03));

confere("Gini: todos iguais é 0", gini([5, 5, 5, 5]) === 0);
confere(`Gini: um só com tudo tende a 1 (${gini([0, 0, 0, 0, 0, 0, 0, 0, 0, 100]).toFixed(2)})`, gini([0, 0, 0, 0, 0, 0, 0, 0, 0, 100]) > 0.85);
const ys = yardSale(Array(200).fill(100), 50000, 0.2, 5);
confere(`yard-sale: trocas "justas" concentram riqueza (Gini ${gini(ys).toFixed(2)})`, gini(ys) > 0.5);
confere("yard-sale: a riqueza total se conserva", perto(ys.reduce((s, x) => s + x, 0), 20000, 1e-6));

const s = sir(200, 0.3, 0.1, 0);
confere("SIR: S + I + R = 1 o tempo todo", s.every((p) => perto(p.S + p.I + p.R, 1, 1e-9)));
confere("SIR: com R0 = 3 a epidemia cresce e depois cai", Math.max(...s.map((p) => p.I)) > 0.2 && s.at(-1).I < 0.01);
const vac = sir(200, 0.3, 0.1, 0.7);
confere("SIR: com 70% vacinados (acima de 1 − 1/R0) não há surto", Math.max(...vac.map((p) => p.I)) < 0.002);

const lv = lotkaVolterra(4000, 0.01, { a: 1.1, b: 0.4, c: 0.4, d: 0.1 }, 10, 10);
const presas = lv.map((p) => p[0]);
confere("Lotka-Volterra: as presas sobem e descem (oscilam)", Math.max(...presas) > 20 && Math.min(...presas) < 5);

const circ = orbita(2000, 0.005, 1, 1);
const raios = circ.pts.map(([x, y]) => Math.hypot(x, y));
confere("órbita circular (v = 1 em r = 1) mantém o raio", raios.every((r) => perto(r, 1, 0.01)));
confere("energia da órbita circular é −1/2", perto(circ.energia, -0.5, 0.001));
const p = projetil(20, 45);
confere(`projétil a 45° e 20 m/s: alcance de ~40,8 m (${p.alcance.toFixed(2)})`, perto(p.alcance, 40.816, 0.01));

confere(`Fourier: a onda quadrada com 200 termos vale ~1 em t = π/2 (${fourier("quadrada", 200, Math.PI / 2).toFixed(3)})`, perto(fourier("quadrada", 200, Math.PI / 2), 1, 0.01));
confere("Fourier: a triangular converge para 1 em t = π/2", perto(fourier("triangular", 100, Math.PI / 2), 1, 0.01));

// Planador: depois de 4 gerações, a mesma forma uma casa para baixo e para a direita.
const lado = 10;
const g = Array(lado * lado).fill(false);
for (const [x, y] of [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) g[y * lado + x] = true;
let v = g;
for (let i = 0; i < 4; i++) v = vidaPasso(v, lado);
const esperado = Array(lado * lado).fill(false);
for (const [x, y] of [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) esperado[(y + 1) * lado + (x + 1)] = true;
confere("Jogo da Vida: o planador anda", JSON.stringify(v) === JSON.stringify(esperado));
const linha = Array(31).fill(false);
linha[15] = true;
const prox = regraPasso(linha, 90);
confere("regra 90: o 1 do meio vira dois vizinhos", prox[14] && prox[16] && !prox[15]);

const sc = schellingInicial(30, 0.1, 2);
let grade = sc;
const antes = segregacao(grade, 30);
for (let i = 0; i < 20; i++) grade = schellingPasso(grade, 30, 0.4, i).grade;
confere(`Schelling: preferência de 40% aumenta a segregação (${antes.toFixed(2)} → ${segregacao(grade, 30).toFixed(2)})`, segregacao(grade, 30) > antes + 0.15);
confere("Schelling: ninguém some nem aparece", grade.filter((x) => x === 1).length === sc.filter((x) => x === 1).length);

const [a, b] = partida("olho-por-olho", "sempre-trai", 10, 1);
confere("dilema: olho por olho perde só a primeira contra quem sempre trai (9 a 14)", a === 9 && b === 14);
const ingenuos = campeonato(["olho-por-olho", "sempre-trai", "sempre-coopera", "rancoroso"], 50, 1);
confere(`dilema: com um cooperador ingênuo no grupo, quem sempre trai tira proveito (${ingenuos.join(", ")})`, ingenuos[1] > ingenuos[2]);
const reciprocos = campeonato(["olho-por-olho", "sempre-trai", "rancoroso", "olho-por-olho"], 50, 1);
confere(`dilema: entre quem coopera com reciprocidade, quem sempre trai fica por último (${reciprocos.join(", ")})`, reciprocos[1] < Math.min(reciprocos[0], reciprocos[2], reciprocos[3]));

console.log(`modelos: ${certos} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
