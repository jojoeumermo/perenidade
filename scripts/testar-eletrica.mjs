// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a lógica do laboratório de elétrica: o que o multímetro mostra em cada situação, as contas de série e paralelo
// e o que o treino de instalação diz de cada ligação. Uso: npm run testar:eletrica
import { ler, BANCADA_ELETRICA, fonteAtx } from "../components/labs/eletrica/multimetro.ts";
import { resolver } from "../components/labs/eletrica/conta-dos-circuitos.ts";
import { avaliar } from "../components/labs/eletrica/regras-da-instalacao.ts";

let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const peca = (id) => BANCADA_ELETRICA.find((p) => p.id === id) ?? fonteAtx(true).find((p) => p.id === id);

// Multímetro
confere("tomada em V~ mostra 127", ler("vac750", "vohm", peca("tomada127"), false, false).visor === "127");
confere("tomada em V⎓ avisa que é alternada", ler("vdc200", "vohm", peca("tomada127"), false, false).tipo === "aviso");
confere("vermelha no 10 A na tomada é perigo e queima o fusível", (() => { const r = ler("vac750", "a10", peca("tomada127"), false, false); return r.tipo === "perigo" && r.queimaFusivel === true; })());
confere("pilha em V⎓ 20 mostra 1,58", ler("vdc20", "vohm", peca("pilha"), false, false).visor === "1,58");
confere("pilha com ponteiras invertidas mostra o sinal de menos", ler("vdc20", "vohm", peca("pilha"), true, false).visor === "-1,58");
confere("lâmpada queimada sem continuidade não apita", ler("cont", "vohm", peca("lampada-queimada"), false, false).bipe !== true);
confere("lâmpada boa apita na continuidade", ler("cont", "vohm", peca("lampada-boa"), false, false).bipe === true);
confere("resistor de 100 kΩ estoura a escala de 2k", ler("ohm2k", "vohm", peca("resistor100k"), false, false).visor === "1");
confere("resistor de 100 kΩ na de 200k mostra 100,0 kΩ", (() => { const r = ler("ohm200k", "vohm", peca("resistor100k"), false, false); return r.visor === "100,0" && r.unidade === "kΩ"; })());
confere("chuveiro na de 200 Ω mostra 8,1", ler("ohm200", "vohm", peca("chuveiro"), false, false).visor === "8,1");
confere("medir resistência numa tomada é perigo", ler("ohm2k", "vohm", peca("tomada127"), false, false).tipo === "perigo");
confere("12 V do fio amarelo da fonte ligada", ler("vdc20", "vohm", peca("atx-amarelo"), false, false).visor === "12,08");
confere("desligado não mostra nada", ler("off", "vohm", peca("pilha"), false, false).visor === "");

// Série e paralelo
const tres = (ohm = 12) => [0, 1, 2].map(() => ({ ohm, chave: true, queimada: false }));
{
  const r = resolver("serie", 12, tres(), true);
  confere("série: 12 V em três lâmpadas de 12 Ω dá 1/3 A", Math.abs(r.total - 1 / 3) < 1e-9 && r.cada.every((c) => Math.abs(c.v - 4) < 1e-9));
  const queimada = tres();
  queimada[1].queimada = true;
  confere("série: uma lâmpada queimada apaga todas", resolver("serie", 12, queimada, true).cada.every((c) => c.i === 0));
  const p = resolver("paralelo", 12, tres(), true);
  confere("paralelo: cada lâmpada recebe os 12 V e a corrente soma 3 A", p.cada.every((c) => c.v === 12) && Math.abs(p.total - 3) < 1e-9);
  const desligada = tres();
  desligada[0].chave = false;
  confere("paralelo: desligar uma não apaga as outras", resolver("paralelo", 12, desligada, true).cada.filter((c) => c.i > 0).length === 2);
  confere("chave geral aberta: nada acende", resolver("paralelo", 12, tres(), false).total === 0);
}

// Instalação
const certo = [
  { de: "Q.F", para: "I.1", cor: "preto" },
  { de: "I.2", para: "L.C", cor: "amarelo" },
  { de: "L.R", para: "Q.N", cor: "azul-claro" },
  { de: "Q.F", para: "T.F", cor: "preto" },
  { de: "Q.N", para: "T.N", cor: "azul-claro" },
  { de: "Q.T", para: "T.T", cor: "verde-amarelo" },
];
confere("ligação certa: tudo ok", avaliar(certo).tipo === "ok");
confere("fase direto no neutro: curto", avaliar([{ de: "Q.F", para: "Q.N", cor: "preto" }]).titulo.startsWith("Curto"));
confere("interruptor no neutro: risco", (() => { const r = avaliar([{ de: "Q.F", para: "L.C", cor: "preto" }, { de: "L.R", para: "I.1", cor: "amarelo" }, { de: "I.2", para: "Q.N", cor: "azul-claro" }]); return r.tipo === "perigo" && r.itens.some((i) => i.includes("cortando o neutro")); })());
confere("retorno na rosca: aviso de choque", avaliar([{ de: "Q.F", para: "I.1", cor: "preto" }, { de: "I.2", para: "L.R", cor: "amarelo" }, { de: "L.C", para: "Q.N", cor: "azul-claro" }]).itens.some((i) => i.includes("rosca")));
confere("tomada sem terra: aviso", avaliar(certo.filter((f) => f.para !== "T.T")).itens.some((i) => i.includes("sem terra")));
confere("neutro em fio preto: aviso de cor", avaliar(certo.map((f) => (f.de === "L.R" ? { ...f, cor: "preto" } : f))).itens.some((i) => i.includes("azul-claro")));
confere("lâmpada sem interruptor no caminho: aviso", avaliar([{ de: "Q.F", para: "L.C", cor: "preto" }, { de: "L.R", para: "Q.N", cor: "azul-claro" }]).itens.some((i) => i.includes("mesmo com o interruptor desligado")));

console.log(`elétrica: ${certos} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
