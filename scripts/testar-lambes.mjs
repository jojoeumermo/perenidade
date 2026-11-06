// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o lambe-lambe do dia (T16): nas datas especiais sai o cartaz mais ligado à data; nos outros dias, a página
// manda uma amostra embaralhada para o navegador sortear. Sem rede. Uso: npm run testar:lambes
import assert from "node:assert/strict";
import fs from "node:fs";
import { DATAS_ESPECIAIS, dataEspecial, diaDe, mesEDia, notaDoCartaz } from "../lib/lambe-do-dia.ts";
import { cartazDaData, lambesDoCartaz } from "../lib/lambes.ts";

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

// O cartaz que sai em cada data pedida pelo Jonathan, pelo id (o estoque tem um cartaz escrito para cada uma).
const esperados = {
  "11-20": "palmares-resistiu-quase-cem-anos",
  "12-25": "o-menino-nasceu-sem-teto",
  "03-08": "flor-e-bonito-direito-e-melhor",
  "05-01": "feriado-nao-caiu-do-ceu",
  "05-13": "liberdade-sem-terra-e-meia-liberdade",
  "04-19": "floresta-em-pe-tem-dono-antigo",
  "09-07": "independencia-pra-quem",
  "06-28": "orgulho-nasceu-de-uma-revolta",
  "07-25": "rainha-sem-coroa-com-quilombo",
};
for (const [md, id] of Object.entries(esperados)) {
  ok(`data especial ${md} (${DATAS_ESPECIAIS[md]?.nome}): ${id}`, () => {
    const [m, d] = md.split("-").map(Number);
    const achado = cartazDaData(dia(2026, m, d));
    assert.ok(achado, "sem cartaz");
    assert.equal(achado.item.id, id);
  });
}

ok("mesEDia e diaDe batem (fuso de Brasília)", () => assert.equal(mesEDia(dia(2026, 11, 20)), "11-20"));
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
ok("amostra do sorteio: sem cartaz de data especial, sem repetir, muda entre montagens", () => {
  const a = lambesDoCartaz("pt");
  const b = lambesDoCartaz("pt");
  assert.equal(a.sorteio.length, 36);
  assert.equal(new Set(a.sorteio.map((l) => l.numero)).size, 36);
  const especiais = new Set();
  const hoje = diaDe(new Date());
  for (let d = 0; d < 366; d++) {
    const c = cartazDaData(hoje + d);
    if (c) especiais.add(c.numero);
  }
  for (const l of a.sorteio) assert.ok(!especiais.has(l.numero), `nº ${l.numero} é de data especial`);
  assert.notDeepEqual(a.sorteio.map((l) => l.numero), b.sorteio.map((l) => l.numero));
  for (const d of a.datas) assert.ok(cartazDaData(d.dia), "dia da lista não é especial");
});
ok("o navegador sorteia com Math.random e guarda só no aparelho (localStorage com try/catch)", () => {
  const tela = fs.readFileSync("components/inicio/LambeDoDia.tsx", "utf8");
  assert.match(tela, /Math\.random\(\)/);
  assert.match(tela, /localStorage\.setItem\(CHAVE_DO_SORTEIO/);
  assert.ok(!/fetch\(/.test(tela), "o sorteio não pode sair do aparelho");
  const pagina = fs.readFileSync("app/[lang]/page.tsx", "utf8");
  assert.equal((pagina.match(/sorteio=\{sorteio\}/g) ?? []).length, 2, "os dois cartazes (computador e celular) recebem a amostra");
});

console.log(process.exitCode ? "✗ lambes" : `✓ lambes: ${n} conferências`);
