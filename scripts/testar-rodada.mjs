// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as contas das ferramentas novas de prática (lib/ferramentas/rodada.ts). Uso: npm run testar:rodada
import * as r from "../lib/ferramentas/rodada.ts";

let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const ordenado = (v) => v.every((x, i) => i === 0 || v[i - 1] <= x);

// Ordenação e busca
for (const alg of ["bolha", "selecao", "insercao", "quick"]) {
  const passos = r.ordenar(alg, [5, 3, 8, 1, 9, 2, 7]);
  confere(`${alg} termina ordenado`, ordenado(passos.at(-1).v) && passos.at(-1).prontos.length === 7);
}
confere("bolha num vetor já ordenado para cedo", r.ordenar("bolha", [1, 2, 3, 4, 5]).length < 8);
confere("busca binária acha em poucos passos", (() => { const p = r.buscar("binaria", [1, 3, 5, 7, 9, 11, 13, 15], 13); return p.at(-1).achou && p.length <= 3; })());
confere("busca linear olha um por um", r.buscar("linear", [4, 8, 15, 16], 15).length === 3);
confere("busca diz quando não acha", r.buscar("binaria", [1, 2, 3], 9).at(-1).achou === false);

// Grafos
const g = { nos: ["A", "B", "C", "D", "E"], arestas: [["A", "B", 4], ["A", "C", 1], ["C", "B", 2], ["B", "D", 5], ["C", "D", 8], ["D", "E", 3]] };
confere("largura a partir de A", r.largura(g, "A").join("") === "ABCDE");
confere("profundidade a partir de A", r.profundidade(g, "A").join("") === "ABCDE");
confere("menor caminho A→E passa por C e B", (() => { const m = r.menorCaminho(g, "A", "E"); return m.distancia === 11 && m.caminho.join("") === "ACBDE"; })());

// Sudoku
const s = r.gerarSudoku(7, "medio");
confere("sudoku tem a quantidade de pistas do nível", s.jogo.filter(Boolean).length >= r.NIVEIS.medio && s.jogo.filter(Boolean).length <= r.NIVEIS.medio + 6);
confere("sudoku tem solução única", r.contarSolucoes([...s.jogo]) === 1);
confere("solução respeita as regras", (() => { const v = s.solucao; for (let i = 0; i < 81; i++) { const d = v[i]; v[i] = 0; const ok = r.candidatos(v, i).includes(d); v[i] = d; if (!ok) return false; } return true; })());
confere("a mesma semente dá o mesmo jogo", JSON.stringify(r.gerarSudoku(7, "medio").jogo) === JSON.stringify(s.jogo));
confere("dica aponta uma casa vazia com o valor certo", (() => { const d = r.dicaSudoku(s.jogo, s.solucao); return d && s.jogo[d.casa] === 0 && d.valor === s.solucao[d.casa]; })());

// ABNT
confere("autor invertido", r.autorAbnt("Paulo Reglus Neves Freire") === "FREIRE, Paulo Reglus Neves");
confere("sobrenome com Filho", r.autorAbnt("João Silva Filho") === "SILVA FILHO, João");
confere("mais de três autores vira et al.", r.autoresAbnt(["Ana Lima", "Bia Souza", "Caio Reis", "Davi Melo"]) === "LIMA, Ana et al.");
confere("data no formato ABNT", r.dataAbnt(new Date(2026, 9, 21)) === "21 out. 2026");
confere("referência de livro", r.referencia("livro", { autores: ["Paulo Freire"], titulo: "Pedagogia do oprimido", edicao: "17", local: "Rio de Janeiro", editora: "Paz e Terra", ano: "1987" }).map((p) => p.t).join("") === "FREIRE, Paulo. Pedagogia do oprimido. 17. ed. Rio de Janeiro: Paz e Terra, 1987.");
confere("livro sem local nem editora usa [S. l.] e [s. n.]", r.referencia("livro", { autores: ["Ana Lima"], titulo: "Notas", ano: "2020" }).map((p) => p.t).join("").includes("[S. l.]: [s. n.], 2020."));
confere("site com acesso", r.referencia("site", { autores: [], titulo: "Página", ano: "2024", url: "https://exemplo.org", acesso: new Date(2026, 0, 5) }).map((p) => p.t).join("").endsWith("Disponível em: https://exemplo.org. Acesso em: 5 jan. 2026."));
confere("o título vai em negrito", r.referencia("livro", { autores: ["Ana Lima"], titulo: "Notas", ano: "2020" }).some((p) => p.negrito && p.t === "Notas"));

// Céu
confere("lua cheia em 13 de jan. de 2025", r.faseDaLua(new Date(Date.UTC(2025, 0, 13, 22, 27))).iluminada > 0.98);
confere("lua nova em 29 de jan. de 2025", r.faseDaLua(new Date(Date.UTC(2025, 0, 29, 12, 36))).iluminada < 0.02);
confere("no equinócio, o dia no equador tem cerca de 12 horas", (() => { const x = r.sol(new Date(Date.UTC(2025, 2, 20)), 0, 0, 0); return x.duracao > 11.9 && x.duracao < 12.3; })());
confere("em dezembro, o dia em Porto Alegre é mais longo que em junho", r.sol(new Date(Date.UTC(2025, 11, 21)), -30.03, -51.23, -3).duracao > r.sol(new Date(Date.UTC(2025, 5, 21)), -30.03, -51.23, -3).duracao + 3);
confere("Rio, 21/12: o sol nasce por volta das 5h e se põe por volta das 18h40", (() => { const x = r.sol(new Date(Date.UTC(2025, 11, 21)), -22.91, -43.17, -3); return x.nascer > 4.8 && x.nascer < 5.4 && x.por > 18.4 && x.por < 18.9; })());
confere("no inverno do polo norte, o sol não nasce", r.sol(new Date(Date.UTC(2025, 11, 21)), 80, 0, 0).nascer === null);
confere("horário formatado", r.hhmm(5.5) === "05:30" && r.hhmm(18.999) === "19:00");

// Direitos do trabalhador
confere("férias integrais com um terço", r.ferias(3000).total === 4000);
confere("férias de 6/12", r.ferias(2400, 6).total === 1600);
confere("13º de 7 meses", r.decimoTerceiro(1200, 7) === 700);
confere("15 dias contam como mês", r.mesesQueContam(4, 15) === 5 && r.mesesQueContam(4, 14) === 4);
confere("hora extra a 50% com divisor 220", (() => { const h = r.horasExtras(2200, 10); return h.valorDaHora === 10 && h.valorDaHoraExtra === 15 && h.total === 150; })());
confere("aviso prévio: 30 dias no primeiro ano", r.diasDeAviso(0) === 30);
confere("aviso prévio: 3 dias por ano", r.diasDeAviso(5) === 45);
confere("aviso prévio: no máximo 90 dias", r.diasDeAviso(40) === 90);
confere("FGTS de 8%", r.fgtsDoMes(2500) === 200);
confere("multa de 40%", r.multaDoFgts(10000) === 4000);
confere("rescisão soma as verbas", (() => { const x = r.rescisaoSemJustaCausa({ salario: 3000, diasTrabalhadosNoMes: 10, mesesDeFeriasProporcionais: 6, feriasVencidas: false, mesesDe13: 6, anosCompletos: 2, saldoFgts: 5000, avisoIndenizado: true }); return x.verbas === 1000 + 3600 + 2000 + 1500 && x.multaFgts === 2000 && x.saqueFgts === 7000; })());

// Karnaugh
confere("A + B", r.minimizar(2, [1, 2, 3]) === "A + B");
confere("A' sozinho", r.minimizar(3, [0, 1, 2, 3]) === "A'");
confere("tudo 1", r.minimizar(2, [0, 1, 2, 3]) === "1");
confere("nada", r.minimizar(3, []) === "0");
confere("ou exclusivo não simplifica", r.minimizar(2, [1, 2]) === "A'B + AB'");
confere("4 variáveis com não importa", r.minimizar(4, [1, 3, 5, 7, 9, 11, 13], [15]) === "D");
confere("exemplo clássico de 3 variáveis", r.minimizar(3, [1, 3, 5, 6, 7]) === "C + AB");

// Eletrônica
confere("série", r.emSerie([100, 220, 330]) === 650);
confere("paralelo de dois iguais é metade", perto(r.emParalelo([1000, 1000]), 500));
confere("corte RC de 1 kΩ e 1 µF ≈ 159 Hz", perto(r.corteRC(1000, 1e-6), 159.15, 0.1));
confere("no corte, o ganho é 0,707", perto(r.ganhoRC("baixa", 159.15, 159.15), 0.7071, 0.001) && perto(r.ganhoRC("alta", 159.15, 159.15), 0.7071, 0.001));
confere("faixas de 4,7 kΩ: amarelo, violeta, vermelho", (() => { const f = r.faixasDoResistor(4700); return f.d1 === 4 && f.d2 === 7 && f.mult === 2; })());
confere("faixas de 10 Ω: marrom, preto, preto", (() => { const f = r.faixasDoResistor(10); return f.d1 === 1 && f.d2 === 0 && f.mult === 0; })());

// Sólidos e contas
confere("cubo de aresta 2", (() => { const m = r.medidasDoSolido("cubo", 2, 0, 0); return m.area === 24 && m.volume === 8; })());
confere("esfera de raio 1", perto(r.medidasDoSolido("esfera", 1, 0, 0).volume, 4.18879, 0.0001));
confere("cone 3-4-5", perto(r.medidasDoSolido("cone", 3, 4, 0).area, Math.PI * 3 * 8));
confere("regra de três direta", r.regraDeTres(2, 10, 5) === 25);
confere("regra de três inversa: 4 pessoas em 6 dias, 8 pessoas em 3", r.regraDeTres(4, 6, 8, true) === 3);
confere("aumento de 10% e desconto de 10% não voltam ao valor", perto(r.variacoes(100, [10, -10]).final, 99));
confere("prestação sem juros", r.prestacao(1200, 0, 12).parcela === 100);
confere("prestação Price de 1000 em 12x a 2%", perto(r.prestacao(1000, 2, 12).parcela, 94.56, 0.01));

console.log(`rodada: ${certos} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
