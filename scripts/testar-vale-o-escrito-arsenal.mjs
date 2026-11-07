// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o que o T31 (nível bl00d.money) acrescentou ao Vale o Escrito: os valores em dinheiro documentados (regra,
// dados e soma), os dossiês de leitura e o catálogo "Arsenal". Sem rede, sem navegador.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lerTudo } from "../lib/vale-o-escrito/dados.ts";
import { normalizar, validarEntrada, validarValores, valorDoEscrito } from "../lib/vale-o-escrito/regras.ts";
import { TIPOS_DE_VALOR } from "../lib/vale-o-escrito/tipos.ts";
import { formatarReais, somaDocumentada, valoresDaPonta, valoresOrdenados } from "../lib/vale-o-escrito/valores.ts";

let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const raiz = process.cwd();
const ler = (...partes) => fs.readFileSync(path.join(raiz, ...partes), "utf8");
const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler("i18n", "vale-o-escrito", `${l}.json`))]));
const lidos = lerTudo();
const publicadas = lidos.flatMap((d) => d.entradas);
const descartadas = lidos.flatMap((d) => d.descartadas);

// ───────────────────────────── Valores em dinheiro ─────────────────────────────

const base = {
  resumo: "Segundo o MPF, a empresa foi condenada a pagar R$ 6 milhões de reparação.",
  fontes: [{ id: "f1", trecho: "condenou a empresa ao pagamento de R$ 3.009.000,00" }],
  pessoas: [{ pessoaId: "fulano", situacao: "reu" }],
  organizacoes: ["empresa-x"],
};
const valor = (extra = {}) => ({ id: "v1", valor: 6e6, escrito: "R$ 6 milhões", tipo: "reparacao", data: "2026-07", resumo: "Reparação fixada, segundo o MPF.", fonteId: "f1", ...extra });

caso("valorDoEscrito lê reais como a fonte escreve", () => {
  assert.equal(valorDoEscrito("R$ 6 milhões"), 6e6);
  assert.equal(valorDoEscrito("R$ 6,3 bilhões"), 6.3e9);
  assert.equal(valorDoEscrito("R$ 694,6 milhões"), 694.6e6);
  assert.equal(valorDoEscrito("R$ 3.009.000,00"), 3009000);
  assert.equal(valorDoEscrito("R$ 359 mil"), 359000);
  assert.equal(valorDoEscrito("seis milhões"), null);
});
caso("valor válido passa; sem campo, nada a conferir", () => {
  assert.deepEqual(validarValores({ ...base, valores: [valor()] }), []);
  assert.deepEqual(validarValores({ ...base, valores: [valor({ id: "v2", valor: 3009000, escrito: "R$ 3.009.000,00", tipo: "indenizacao" })] }), []);
  assert.deepEqual(validarValores(base), []);
});
caso("valor inventado não passa: número diferente do escrito, escrito fora do resumo e do trecho", () => {
  assert.ok(validarValores({ ...base, valores: [valor({ valor: 7e6 })] }).some((e) => e.includes("não bate")));
  assert.ok(validarValores({ ...base, valores: [valor({ valor: 9e6, escrito: "R$ 9 milhões" })] }).some((e) => e.includes("não está no resumo")));
});
caso("valor sem fonte da entrada, sem 'segundo'/'supostamente', com tipo estranho ou ponta fora do caso não passa", () => {
  assert.ok(validarValores({ ...base, valores: [valor({ fonteId: "f9" })] }).some((e) => e.includes("fonteId")));
  assert.ok(validarValores({ ...base, valores: [valor({ resumo: "A empresa desviou o dinheiro." })] }).some((e) => e.includes("segundo")));
  assert.ok(validarValores({ ...base, valores: [valor({ tipo: "propina" })] }).some((e) => e.includes("tipo")));
  assert.ok(validarValores({ ...base, valores: [valor({ ponta: { tipo: "pessoa", id: "beltrano" } })] }).some((e) => e.includes("ponta")));
  assert.ok(validarValores({ ...base, valores: [valor({ ponta: { tipo: "organizacao", id: "empresa-x" } })] }).length === 0);
  assert.ok(validarValores({ ...base, valores: [valor({ resumo: "Segundo o MPF, pago à vítima do caso." })] }).some((e) => e.includes("vítima")));
});
caso("validarEntrada inclui a conferência dos valores", () => {
  const e = publicadas.find((x) => x.valores?.length);
  assert.ok(e, "há entrada com valores");
  assert.ok(validarEntrada(e).ok);
  assert.ok(!validarEntrada({ ...e, valores: [{ ...e.valores[0], valor: e.valores[0].valor + 1000 }] }).ok);
});
caso("dados: os valores publicados passam e nenhuma entrada foi descartada por causa deles", () => {
  assert.ok(!descartadas.some((d) => d.includes("valores[")), descartadas.join("\n"));
  const com = publicadas.filter((e) => e.valores?.length);
  assert.ok(com.length >= 5, `${com.length} casos com valor`);
  for (const e of com)
    for (const v of e.valores) {
      assert.ok(TIPOS_DE_VALOR.includes(v.tipo));
      const fonte = e.fontes.find((f) => f.id === v.fonteId);
      assert.ok(normalizar(e.resumo).includes(normalizar(v.escrito)) || normalizar(fonte.trecho).includes(normalizar(v.escrito)), `${e.id} ${v.id}`);
    }
});
caso("soma e ordem: do maior para o menor, soma por dossiê bate com o total", () => {
  const lista = valoresOrdenados(publicadas);
  for (let i = 1; i < lista.length; i++) assert.ok(lista[i - 1].valor.valor >= lista[i].valor.valor);
  assert.ok(lista.every((x) => x.nFonte > 0));
  const s = somaDocumentada(publicadas);
  assert.equal(Math.round(s.porDossie.reduce((a, p) => a + p.total, 0)), Math.round(s.total));
  assert.equal(s.total, lista.reduce((a, x) => a + x.valor.valor, 0));
  assert.deepEqual(somaDocumentada([]), { total: 0, casos: 0, porDossie: [] });
  const fenix = valoresDaPonta(publicadas, { tipo: "organizacao", id: "fenix-servicos-administrativos" });
  assert.ok(fenix.length >= 1 && fenix.every((x) => x.valor.ponta.id === "fenix-servicos-administrativos"));
});
caso("formatarReais: inteiro e compacto", () => {
  assert.match(formatarReais(3009000, "pt"), /R\$\s?3\.009\.000,00/);
  assert.match(formatarReais(6.3e9, "pt", true), /6,3\s?bi/);
});
caso("textos do dinheiro nos 6 idiomas, com {n} e todos os tipos", () => {
  for (const l of idiomas) {
    const d = textos[l].visual.dinheiro;
    assert.ok(d.explica.includes("{n}"), l);
    for (const t of TIPOS_DE_VALOR) assert.ok(d.tipos[t], `${l} ${t}`);
  }
});
caso("ficha e topo mostram os fluxos e o aviso de que valor sob apuração não é prova", () => {
  const fichas = ler("components", "vale-o-escrito", "Fichas.tsx");
  assert.ok(fichas.includes("FluxosDeDinheiro") && fichas.includes("dinheiro.suposto") && fichas.includes("valoresDaPonta"));
  const obs = ler("components", "vale-o-escrito", "Observatorio.tsx");
  assert.ok(obs.includes("somaDocumentada") && obs.includes("dinheiro.explica"));
});

console.log(`\n${total} conferências do T31 (dinheiro, dossiês de leitura e Arsenal) passaram.`);
