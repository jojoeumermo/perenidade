// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o lambe-lambe do dia: um por dia, o mesmo para todo mundo (conta fixa pela data de São Paulo, sem sorteio);
// nas datas especiais, o cartaz próprio da data (content/lambes-datas.json) ou o do estoque mais ligado a ela. Sem rede.
// Uso: npm run testar:lambes
import assert from "node:assert/strict";
import fs from "node:fs";
import { DATAS_ESPECIAIS, dataEspecial, diaDe, mesEDia, notaDoCartaz } from "../lib/lambe-do-dia.ts";
import { cartazDaData, cartazDoDia, cartazesProprios, lambesDoCartaz } from "../lib/lambes.ts";

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
const dia = (ano, mes, d) => diaDe(new Date(Date.UTC(ano, mes - 1, d, 15)));

// As datas pedidas em 08/11/2026, cada uma com o cartaz próprio de content/lambes-datas.json.
const proprios = {
  "03-08": "oito-de-marco-nao-e-dia-de-flor",
  "03-21": "racismo-nao-e-opiniao-e-crime",
  "04-19": "esta-terra-ja-tinha-nome",
  "05-01": "cada-hora-de-descanso-foi-greve",
  "05-13": "a-lei-assinou-quem-lutou-foi-o-povo",
  "06-28": "antes-da-parada-teve-revolta",
  "07-25": "tereza-de-benguela-governou-quilombo",
  "08-11": "estudante-organizado-muda-o-pais",
  "09-07": "independencia-de-verdade-ainda-falta",
  "10-15": "professora-tambem-e-trabalhadora",
  "11-07": "pao-paz-e-terra-1917",
  "11-20": "zumbi-nao-morreu-virou-semente",
};
for (const [md, id] of Object.entries(proprios)) {
  ok(`data especial ${md} (${DATAS_ESPECIAIS[md]?.nome}): cartaz próprio ${id}`, () => {
    const [m, d] = md.split("-").map(Number);
    for (const ano of [2026, 2027, 2028]) {
      const achado = cartazDoDia(dia(ano, m, d));
      assert.equal(achado.item.id, id);
      assert.ok(achado.numero > 366, "o cartaz próprio é numerado depois do estoque");
    }
  });
}
ok("todo cartaz próprio cai numa data do mapa DATAS_ESPECIAIS e tem os seis idiomas", () => {
  for (const p of cartazesProprios()) {
    assert.ok(DATAS_ESPECIAIS[p.dia], `${p.dia} fora do mapa`);
    for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) assert.equal(p[lang].linhas.length, 3, `${p.id} ${lang}`);
  }
});

// Datas especiais sem cartaz próprio: sai o do estoque escrito para elas.
const doEstoque = { "12-25": "o-menino-nasceu-sem-teto", "03-14": "mataram-marielle-nasceram-mil", "01-01": "ano-novo-cuba-nova" };
for (const [md, id] of Object.entries(doEstoque)) {
  ok(`data especial ${md} (${DATAS_ESPECIAIS[md]?.nome}): ${id}`, () => {
    const [m, d] = md.split("-").map(Number);
    assert.equal(cartazDaData(dia(2026, m, d))?.item.id, id);
  });
}

ok("diaDe usa o fuso de São Paulo: 02:59 UTC ainda é o dia anterior, 03:00 UTC já é o dia novo", () => {
  assert.equal(mesEDia(diaDe(new Date(Date.UTC(2026, 10, 8, 2, 59)))), "11-07");
  assert.equal(mesEDia(diaDe(new Date(Date.UTC(2026, 10, 8, 3, 0)))), "11-08");
  assert.equal(diaDe(new Date(Date.UTC(1970, 0, 1, 12))), 0);
});
ok("mesEDia e diaDe batem", () => assert.equal(mesEDia(dia(2026, 11, 20)), "11-20"));
ok("Dia das Mães e dos Pais mudam de data a cada ano", () => {
  assert.equal(dataEspecial(dia(2026, 5, 10))?.nome, "Dia das Mães");
  assert.equal(dataEspecial(dia(2027, 5, 9))?.nome, "Dia das Mães");
  assert.equal(dataEspecial(dia(2027, 8, 8))?.nome, "Dia dos Pais");
  assert.equal(dataEspecial(dia(2026, 5, 11)), null);
});
ok("dia comum (06/11) não é data especial", () => assert.equal(cartazDaData(dia(2026, 11, 6)), null));
ok("tema é palavra inteira: 'eca' não acha 'biblioteca'", () => {
  const nota = notaDoCartaz({ dia: "01-01", id: "x", lambe: { linhas: ["a", "b", "c"], texto: "biblioteca", carimbo: ["a", "b"] } }, "07-13", { nome: "t", temas: ["eca"] });
  assert.equal(nota, 0);
});
ok("tema com * vale como começo de palavra", () => {
  const nota = notaDoCartaz({ dia: "01-01", id: "x", lambe: { linhas: ["a", "b", "c"], texto: "t", carimbo: ["luta", "feminista"] } }, "03-08", { nome: "t", temas: ["feminis*"] });
  assert.equal(nota, 3);
});
ok("um por dia: a mesma data dá sempre o mesmo cartaz, e montagens diferentes dão a mesma lista", () => {
  for (let d = dia(2026, 1, 1); d < dia(2027, 1, 1); d++) assert.equal(cartazDoDia(d).numero, cartazDoDia(d).numero);
  assert.deepEqual(lambesDoCartaz("pt"), lambesDoCartaz("pt"));
  const lista = lambesDoCartaz("pt");
  assert.equal(lista.length, 40);
  assert.equal(lista[0].dia, diaDe(new Date()));
  for (const l of lista) assert.equal(l.numero, cartazDoDia(l.dia).numero);
});
ok("dias comuns: nenhum cartaz reservado a data especial, dias seguidos trocam e nenhum se repete em 200 dias", () => {
  const especiais = new Set();
  const comuns = [];
  const inicio = dia(2026, 1, 1);
  for (let d = inicio; d < inicio + 365; d++) {
    const c = cartazDaData(d);
    if (c) especiais.add(c.numero);
  }
  for (let d = inicio; d < inicio + 200; d++) {
    if (cartazDaData(d)) continue;
    const c = cartazDoDia(d);
    assert.ok(!especiais.has(c.numero), `nº ${c.numero} é de data especial`);
    if (!cartazDaData(d - 1)) assert.notEqual(c.numero, cartazDoDia(d - 1).numero, "dois dias seguidos com o mesmo cartaz");
    comuns.push(c.numero);
  }
  assert.equal(new Set(comuns).size, comuns.length, "repetiu cartaz em menos de 200 dias");
});
ok("o idioma muda o texto, não o cartaz", () => {
  const pt = lambesDoCartaz("pt");
  const zh = lambesDoCartaz("zh");
  assert.deepEqual(pt.map((l) => l.numero), zh.map((l) => l.numero));
});
ok("a tela não sorteia nem guarda nada no aparelho; a página manda só a lista dos dias", () => {
  const tela = fs.readFileSync("components/inicio/LambeDoDia.tsx", "utf8");
  assert.ok(!/Math\.random\(\)/.test(tela), "nada de sorteio");
  assert.ok(!/localStorage/.test(tela), "nada guardado no aparelho");
  const pagina = fs.readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(!/sorteio/.test(pagina));
  assert.equal((pagina.match(/<LambeDoDia dias=\{lambes\}/g) ?? []).length, 2, "os dois cartazes (computador e celular) recebem a lista");
});

console.log(process.exitCode ? "✗ lambes" : `✓ lambes: ${n} conferências`);
