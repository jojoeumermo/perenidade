// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere os jogos próprios (parte 1, docs/jogos-proprios.md): regras puras, dados com fonte, registro e checagens.
// Sem rede, sem navegador. Uso: npm run testar:jogos-proprios
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CARTAS_DE_FLUXO, CENAS_DE_NEGOCIACAO, CONQUISTAS, CTB_2023, DESTINOS, MENSAGEM_DE_TREINO, PAUTA_1917,
  classeDoVeredito, conferirFluxo, conferirSinais, diaDeTrabalho, finalDaNegociacao, maisValia, outrosGastos,
  parteDoTempoLivre, pesoNaRenda, repartirCarga, rodarNegociacao, sortear,
} from "../lib/jogos-proprios/regras.ts";
import { lerChecagensParaJogo } from "../lib/jogos-proprios/checagens.ts";
import { JOGOS_PROPRIOS } from "../components/jogos/proprios/registro.ts";

let n = 0;
const ok = (nome, f) => { f(); n++; };

ok("mais-valia: 8h, salário 120, 30/h → 4h pagam o salário, taxa 100%", () => {
  const r = maisValia(120, 30, 8);
  assert.equal(r.horasNecessarias, 4);
  assert.equal(r.horasExcedentes, 4);
  assert.equal(r.paraQuemContrata, 120);
  assert.equal(r.taxa, 1);
});
ok("mais-valia: jornada menor com o mesmo salário diminui o excedente", () => {
  assert.ok(maisValia(120, 30, 6).horasExcedentes < maisValia(120, 30, 8).horasExcedentes);
  assert.equal(maisValia(500, 10, 4).horasExcedentes, 0);
  assert.equal(maisValia(100, 0, 8).paraQuemContrata, 0);
});

ok("fluxo: todas as cartas têm destino válido e id único", () => {
  const ids = new Set(CARTAS_DE_FLUXO.map((c) => c.id));
  assert.equal(ids.size, CARTAS_DE_FLUXO.length);
  const dest = new Set(DESTINOS.map((d) => d.id));
  for (const c of CARTAS_DE_FLUXO) assert.ok(dest.has(c.destino) && c.explicacao);
});
ok("fluxo: conferir", () => {
  const todas = Object.fromEntries(CARTAS_DE_FLUXO.map((c) => [c.id, c.destino]));
  assert.equal(conferirFluxo(todas).certas, CARTAS_DE_FLUXO.length);
  assert.equal(conferirFluxo({}).certas, 0);
  assert.deepEqual(conferirFluxo({ ...todas, salario: "dono" }).erradas, ["salario"]);
});

ok("conquistas: toda conquista tem lei citada e fonte com https do planalto", () => {
  assert.ok(CONQUISTAS.length >= 8);
  for (const c of CONQUISTAS) {
    assert.ok(c.direito && c.lei, c.id);
    assert.match(c.fonte.url, /^https:\/\/www\.planalto\.gov\.br\//, c.id);
  }
  assert.equal(new Set(CONQUISTAS.map((c) => c.id)).size, CONQUISTAS.length);
});
ok("pauta de 1917: tem itens dentro e fora", () => {
  assert.ok(PAUTA_1917.some((p) => p.estavaNaPauta) && PAUTA_1917.some((p) => !p.estavaNaPauta));
});

ok("orçamento: CTB 2023 soma 32,11 e o repasse mantém a proporção", () => {
  // A Receita publica as três partes arredondadas: a soma difere do total em até 0,02 ponto.
  assert.ok(Math.abs(CTB_2023.uniao + CTB_2023.estados + CTB_2023.municipios - CTB_2023.total) <= 0.02);
  const r = repartirCarga(CTB_2023.total);
  assert.equal(r.uniao, CTB_2023.uniao);
  assert.equal(r.total, CTB_2023.total);
  const dobro = repartirCarga(CTB_2023.total * 2);
  assert.ok(Math.abs(dobro.uniao - CTB_2023.uniao * 2) < 0.02);
  assert.equal(outrosGastos(), 27.8);
  assert.equal(pesoNaRenda(10, 100), 10);
  assert.equal(pesoNaRenda(10, 50), 5);
});

ok("veredito e sorteio", () => {
  assert.equal(classeDoVeredito("Falso"), "boato");
  assert.equal(classeDoVeredito("Enganoso"), "enganoso");
  assert.equal(classeDoVeredito("Verdadeiro"), "fato");
  assert.equal(classeDoVeredito("Sei lá"), null);
  const s = sortear([1, 2, 3, 4, 5, 6], 4);
  assert.equal(s.length, 4);
  assert.equal(new Set(s).size, 4);
  assert.equal(sortear([1, 2], 9).length, 2);
});
ok("checagens do site: lê as de content/checagens e todas têm veredito reconhecido", () => {
  const itens = lerChecagensParaJogo();
  const arquivos = fs.readdirSync("content/checagens").filter((f) => f.endsWith(".md")).length;
  assert.ok(itens.length >= 5 && itens.length <= arquivos);
  for (const i of itens) assert.ok(i.alegacao && classeDoVeredito(i.veredito), i.slug);
});

ok("detetive: método de marcar", () => {
  const alertas = MENSAGEM_DE_TREINO.sinais.filter((s) => s.alerta).map((s) => s.id);
  const falsos = MENSAGEM_DE_TREINO.sinais.filter((s) => !s.alerta).map((s) => s.id);
  assert.ok(alertas.length >= 3 && falsos.length >= 1);
  const r = conferirSinais([...alertas, falsos[0]]);
  assert.equal(r.acertos.length, alertas.length);
  assert.equal(r.erros.length, 1);
  assert.equal(conferirSinais([]).faltaram.length, alertas.length);
});

ok("catraca: 24 horas fecham", () => {
  const d = diaDeTrabalho(8, 2, 7);
  assert.equal(d.sobra, 7);
  assert.equal(diaDeTrabalho(12, 5, 10).sobra < 0, true);
  assert.equal(parteDoTempoLivre(d), Math.round((2 / 9) * 100));
});

ok("negociação: toda cena aponta para cena existente ou o fim; finais variam", () => {
  const ids = new Set([...CENAS_DE_NEGOCIACAO.map((c) => c.id), "fim"]);
  for (const c of CENAS_DE_NEGOCIACAO) for (const e of c.escolhas) assert.ok(ids.has(e.proxima) && e.retorno, c.id);
  const melhor = rodarNegociacao([0, 0, 1]);
  const pior = rodarNegociacao([1, 1, 2]);
  assert.ok(melhor.forca > pior.forca);
  const titulos = new Set([finalDaNegociacao(5, 1).titulo, finalDaNegociacao(1, 0).titulo, finalDaNegociacao(-1, -3).titulo, finalDaNegociacao(-3, 3).titulo]);
  assert.ok(titulos.size >= 3);
});

ok("registro: slugs únicos, todos têm componente no catálogo e nada de 'universidade' ou 'diploma'", () => {
  assert.equal(new Set(JOGOS_PROPRIOS.map((j) => j.slug)).size, JOGOS_PROPRIOS.length);
  const catalogo = fs.readFileSync("components/jogos/proprios/Catalogo.tsx", "utf8");
  for (const j of JOGOS_PROPRIOS) {
    assert.ok(catalogo.includes(`"${j.slug}"`), j.slug);
    assert.ok(j.titulo && j.resumo && j.minutos > 0 && j.minutos <= 15, j.slug);
  }
  for (const f of fs.readdirSync("components/jogos/proprios")) {
    const t = fs.readFileSync(`components/jogos/proprios/${f}`, "utf8").toLowerCase();
    assert.ok(!/universidade|diploma/.test(t), f);
  }
});

console.log(`jogos próprios: ${n} conferências passaram.`);
