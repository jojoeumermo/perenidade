// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o teste dos 12 eixos (docs/eixos.md): a conta pura (lib/eixos/pontuacao.ts), o equilíbrio das perguntas
// (metade para cada lado de cada eixo, em cada tamanho), os dados (ideologias, países, figuras com retrato de licença
// livre e crédito) e o agregado que a Etapa 8 reusa. Sem rede, sem navegador. Uso: npm run testar:eixos
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PERGUNTAS_POR_EIXO, PESOS, agregarPontos, faixaDe, maisProximos, ordemDoNivel, pontuarEixos, proximidade, respostaValida } from "../lib/eixos/pontuacao.ts";

const dados = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "eixos.json"), "utf8"));
const { eixos, perguntas, ideologias, paises, figuras } = dados;
const ids = eixos.map((e) => e.id);

let n = 0;
const ok = (nome, f) => {
  try {
    f();
    n++;
  } catch (e) {
    console.error("FALHOU:", nome, "\n ", e.message);
    process.exitCode = 1;
  }
};

ok("12 eixos em 4 grupos de 3", () => {
  assert.equal(eixos.length, 12);
  for (const g of dados.grupos) assert.equal(eixos.filter((e) => e.grupo === g.id).length, 3);
});
ok("tamanhos: curto 36, médio 96 e longo 240 perguntas", () => {
  assert.equal(ordemDoNivel(eixos, perguntas, 1).length, 36);
  assert.equal(ordemDoNivel(eixos, perguntas, 2).length, 96);
  assert.equal(ordemDoNivel(eixos, perguntas, 3).length, 240);
});
ok("cada eixo tem 3, 8 e 20 perguntas por tamanho", () => {
  for (const e of ids) for (const nv of [1, 2, 3]) assert.equal(perguntas.filter((p) => p.eixo === e && p.nivel <= nv).length, PERGUNTAS_POR_EIXO[nv], `${e} nível ${nv}`);
});
ok("equilíbrio: médio e longo com metade para cada lado em cada eixo; curto 18/18 no total", () => {
  for (const e of ids) {
    for (const nv of [2, 3]) {
      const l = perguntas.filter((p) => p.eixo === e && p.nivel <= nv);
      assert.equal(l.filter((p) => p.lado === "a").length, l.length / 2, `${e} nível ${nv}`);
    }
  }
  const curto = perguntas.filter((p) => p.nivel === 1);
  assert.equal(curto.filter((p) => p.lado === "a").length, 18);
  for (const e of ids) assert.ok(Math.abs(curto.filter((p) => p.eixo === e && p.lado === "a").length - 1.5) <= 0.5);
});
ok("ids únicos, eixos e lados válidos, textos sem repetição", () => {
  assert.equal(new Set(perguntas.map((p) => p.id)).size, perguntas.length);
  assert.equal(new Set(perguntas.map((p) => p.texto)).size, perguntas.length);
  for (const p of perguntas) {
    assert.ok(ids.includes(p.eixo));
    assert.ok(p.lado === "a" || p.lado === "b");
    assert.ok(p.texto.length > 15 && p.texto.length < 200, p.id);
  }
});
ok("a interface não usa as palavras proibidas (universidade, diploma)", () => {
  const todo = fs.readFileSync(path.join(process.cwd(), "content", "eixos.json"), "utf8");
  assert.ok(!/universidade/i.test(todo));
  assert.ok(!/\bdiploma\b/i.test(todo));
});
ok("ordem alterna os eixos: as 12 primeiras são de 12 eixos diferentes", () => {
  const o = ordemDoNivel(eixos, perguntas, 3);
  assert.equal(new Set(o.slice(0, 12).map((p) => p.eixo)).size, 12);
  assert.equal(new Set(ordemDoNivel(eixos, perguntas, 1).map((p) => p.id)).size, 36);
});
ok("o tamanho menor está contido no maior", () => {
  const c = new Set(ordemDoNivel(eixos, perguntas, 1).map((p) => p.id));
  const m = new Set(ordemDoNivel(eixos, perguntas, 2).map((p) => p.id));
  const l = new Set(ordemDoNivel(eixos, perguntas, 3).map((p) => p.id));
  for (const id of c) assert.ok(m.has(id));
  for (const id of m) assert.ok(l.has(id));
});

// A conta
const todasComo = (r) => Object.fromEntries(perguntas.map((p) => [p.id, r]));
ok("pesos: concordo totalmente 1, concordo 0,5, neutro 0, discordo -0,5, discordo totalmente -1", () => {
  assert.deepEqual([...PESOS], [1, 0.5, 0, -0.5, -1]);
});
ok("sem respostas: tudo em 50", () => {
  const p = pontuarEixos(eixos, perguntas, {});
  for (const e of ids) assert.equal(p[e], 50);
});
ok("neutro em tudo: 50 em todos os eixos", () => {
  const p = pontuarEixos(eixos, perguntas, todasComo(2));
  for (const e of ids) assert.equal(p[e], 50);
});
ok("concordar com tudo cancela (perguntas balanceadas): 50 em todos os eixos nos tamanhos médio e longo", () => {
  for (const nv of [2, 3]) {
    const lista = ordemDoNivel(eixos, perguntas, nv);
    const p = pontuarEixos(eixos, lista, todasComo(0));
    for (const e of ids) assert.equal(p[e], 50, `${e} nível ${nv}`);
  }
});
ok("quem concorda só com o lado a de todo eixo fica em 100; só com o lado b fica em 0", () => {
  const a = Object.fromEntries(perguntas.map((p) => [p.id, p.lado === "a" ? 0 : 4]));
  const b = Object.fromEntries(perguntas.map((p) => [p.id, p.lado === "a" ? 4 : 0]));
  const pa = pontuarEixos(eixos, perguntas, a);
  const pb = pontuarEixos(eixos, perguntas, b);
  for (const e of ids) {
    assert.equal(pa[e], 100);
    assert.equal(pb[e], 0);
  }
});
ok("concordar (meio ponto) puxa metade: 75", () => {
  const a = Object.fromEntries(perguntas.map((p) => [p.id, p.lado === "a" ? 1 : 3]));
  assert.equal(pontuarEixos(eixos, perguntas, a).propriedade, 75);
});
ok("responder só parte das perguntas conta só as respondidas; resposta inválida é ignorada", () => {
  const pr = perguntas.filter((p) => p.eixo === "propriedade");
  const r = { [pr[0].id]: 0, [pr[1].id]: 99, [pr[2].id]: -1, [pr[3].id]: 1.5 };
  const esperado = pr[0].lado === "a" ? 100 : 0;
  assert.equal(pontuarEixos(eixos, perguntas, r).propriedade, esperado);
  assert.ok(!respostaValida(5) && !respostaValida(NaN) && !respostaValida("1") && respostaValida(4));
});
ok("todos os resultados ficam entre 0 e 100, mesmo com respostas aleatórias", () => {
  let semente = 12345;
  const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 50; k++) {
    const r = Object.fromEntries(perguntas.map((p) => [p.id, Math.floor(rnd() * 5)]));
    for (const v of Object.values(pontuarEixos(eixos, perguntas, r))) assert.ok(v >= 0 && v <= 100);
  }
});

// Proximidade, ideologias, países, figuras
ok("proximidade: a própria posição dá 100; o oposto exato dá 0", () => {
  const pos = Object.fromEntries(ids.map((e) => [e, 100]));
  const zero = Object.fromEntries(ids.map((e) => [e, 0]));
  assert.equal(proximidade(eixos, pos, pos), 100);
  assert.equal(proximidade(eixos, pos, zero), 0);
});
for (const [nome, lista] of [["ideologias", ideologias], ["países", paises], ["figuras", figuras]]) {
  ok(`${nome}: ids únicos, posição completa de 0 a 100 e texto`, () => {
    assert.ok(lista.length >= 10);
    assert.equal(new Set(lista.map((x) => x.id)).size, lista.length);
    for (const x of lista) {
      assert.ok(x.nome && x.texto && x.texto.length > 30, x.id);
      for (const e of ids) assert.ok(Number.isInteger(x.posicao[e]) && x.posicao[e] >= 0 && x.posicao[e] <= 100, `${x.id}/${e}`);
    }
  });
  ok(`${nome}: quem responde exatamente a posição de um item o tem como o mais próximo`, () => {
    for (const x of lista) {
      const [melhor] = maisProximos(eixos, x.posicao, lista, 1);
      assert.equal(melhor.proximidade, 100, x.id);
    }
  });
  ok(`${nome}: maisProximos devolve em ordem decrescente e respeita o limite`, () => {
    const r = maisProximos(eixos, Object.fromEntries(ids.map((e) => [e, 40])), lista, 3);
    assert.equal(r.length, 3);
    assert.ok(r[0].proximidade >= r[1].proximidade && r[1].proximidade >= r[2].proximidade);
  });
}
ok("um perfil de esquerda radical e um libertário recebem ideologias diferentes", () => {
  const perfilA = Object.fromEntries(perguntas.map((p) => [p.id, p.lado === "a" ? 0 : 4]));
  const perfilB = Object.fromEntries(perguntas.map((p) => [p.id, p.lado === "a" ? 4 : 0]));
  const [x] = maisProximos(eixos, pontuarEixos(eixos, perguntas, perfilA), ideologias, 1);
  const [y] = maisProximos(eixos, pontuarEixos(eixos, perguntas, perfilB), ideologias, 1);
  assert.notEqual(x.item.id, y.item.id);
});

// Figuras e imagens: só domínio público ou licença livre, com autor, licença e página no Commons.
ok("figuras: retrato com arquivo, autor, licença livre e página do Commons; só falecidas há mais de 70 anos", () => {
  for (const f of figuras) {
    assert.ok(f.imagem?.arquivo && f.imagem.autor && f.imagem.licenca, f.id);
    assert.match(f.imagem.licenca, /Domínio público|CC0|CC BY/, f.id);
    assert.match(f.imagem.pagina, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, f.id);
    const morte = Number(f.vida.split("–")[1]);
    assert.ok(morte <= 1955, `${f.id} morreu em ${morte}: a Lei 9.610/1998, art. 41, pede mais de 70 anos`);
  }
});
ok("nenhuma imagem é embutida no código: só o nome do arquivo (carregada depois do clique)", () => {
  const c = fs.readFileSync(path.join(process.cwd(), "components", "estudo", "DozeEixos.tsx"), "utf8");
  assert.ok(/mostrarFotos|setFotos/.test(c));
  assert.ok(/\{fotos && \(/.test(c), "a imagem só aparece com o clique");
  assert.ok(!/upload\.wikimedia\.org/.test(JSON.stringify(dados)));
});

// Agregado (Etapa 8)
ok("agregarPontos: média e distribuição, sem guardar resultados individuais", () => {
  const um = (v) => Object.fromEntries(ids.map((e) => [e, v]));
  const lista = [um(0), um(10), um(50), um(90), um(100)];
  const ag = agregarPontos(eixos, lista, 5);
  assert.equal(ag.n, 5);
  assert.equal(ag.media.propriedade, 50);
  assert.deepEqual(ag.distribuicao.propriedade, [2, 0, 1, 0, 2]);
  assert.deepEqual(Object.keys(ag).sort(), ["distribuicao", "media", "n"]);
});
ok("agregarPontos: grupo pequeno demais devolve null; entradas inválidas são descartadas", () => {
  const um = (v) => Object.fromEntries(ids.map((e) => [e, v]));
  assert.equal(agregarPontos(eixos, [um(10), um(20), um(30), um(40)], 5), null);
  assert.equal(agregarPontos(eixos, [um(10), um(20), um(30), um(40), { propriedade: 50 }], 5), null);
  assert.equal(agregarPontos(eixos, [um(10), um(20), um(130), um(40), um(50)], 5), null);
  assert.equal(agregarPontos(eixos, [um(10)], 1).n, 1);
});
ok("faixaDe: limites 0-19, 20-39, 40-59, 60-79, 80-100", () => {
  assert.deepEqual([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(faixaDe), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});
ok("a conta não importa nada (pura): sem import, sem fetch, sem disco", () => {
  const c = fs.readFileSync(path.join(process.cwd(), "lib", "eixos", "pontuacao.ts"), "utf8");
  assert.ok(!/^import /m.test(c));
  assert.ok(!/fetch\(|node:fs|localStorage|window\./.test(c));
});

console.log(`testar:eixos — ${n} verificações ${process.exitCode ? "COM FALHAS" : "ok"}`);
