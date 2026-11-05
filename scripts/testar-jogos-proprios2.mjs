// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere os jogos próprios, parte 2 (Etapa 5, docs/JOGOS-PROPRIOS-2.md): registro, dados com fonte, regras de cada jogo,
// cabeçalho de licença, palavras proibidas e ausência de scripts ou iframes de terceiros. Sem rede, sem navegador.
import fs from "node:fs";
import path from "node:path";
import { JOGOS_PROPRIOS_2 } from "../components/jogos/proprios2/registro.ts";
import { OBRAS } from "../components/jogos/proprios2/dados/quem-construiu.ts";
import { MAPA_INICIAL, avaliar } from "../components/jogos/proprios2/dados/zoneamento.ts";
import { CENAS, INICIO, MEDIDORES, aplicar, classificar } from "../components/jogos/proprios2/dados/energia.ts";
import { CASAS, avaliarEscolha, ordemSugerida } from "../components/jogos/proprios2/dados/saude.ts";
import { CIRCUITOS, CAPACIDADE_DO_FIO, avaliarCircuito, combinacoesQueServem, correnteDeProjeto } from "../components/jogos/proprios2/dados/disjuntores.ts";
import { TECIDOS, CASOS_DE_TENSAO, avaliarAgulha } from "../components/jogos/proprios2/dados/ponto.ts";
import { ENIGMAS, acertou } from "../components/jogos/proprios2/dados/bug.ts";
import { disponibilidade, minutosForaPorAno, TABELA_SRE, escreverTempo } from "../components/jogos/proprios2/dados/redundancia.ts";

let falhas = 0;
const confere = (ok, msg) => {
  if (!ok) {
    falhas++;
    console.error("FALHOU: " + msg);
  }
};
const PASTA = path.join(process.cwd(), "components", "jogos", "proprios2");

// Registro
confere(JOGOS_PROPRIOS_2.length === 8, "o registro tem 8 jogos");
const ids = new Set(JOGOS_PROPRIOS_2.map((j) => j.id));
confere(ids.size === JOGOS_PROPRIOS_2.length, "ids únicos");
for (const j of JOGOS_PROPRIOS_2) {
  confere(j.titulo && j.resumo && j.tema, `${j.id}: título, resumo e tema`);
  confere(typeof j.carregar === "function", `${j.id}: carregar é função`);
  confere(j.minutos > 0 && j.minutos <= 15, `${j.id}: tempo de rodada curto`);
  confere(j.fontes.length > 0 && j.fontes.every((f) => /^https:\/\//.test(f.url) && f.nome), `${j.id}: fontes com https e nome`);
}
const componentes = ["QuemConstruiu", "ZoneamentoPopular", "TransicaoEnergetica", "MapaDaSaude", "QuadroDeDisjuntores", "AjusteOPonto", "BugNaMemoria", "RedundanciaDeServidores"];
for (const c of componentes) confere(fs.existsSync(path.join(PASTA, c + ".tsx")), `componente ${c}.tsx existe`);

// Quem construiu a cidade?
for (const o of OBRAS) {
  confere(o.opcoes.length >= 3 && o.certa >= 0 && o.certa < o.opcoes.length, `${o.id}: opção certa existe`);
  confere(/^https:\/\//.test(o.fonte.url), `${o.id}: fonte`);
}

// Zoneamento: o mapa de partida não cumpre tudo; uma solução à mão cumpre tudo
confere(avaliar(MAPA_INICIAL).some((r) => !r.ok), "zoneamento: mapa vazio não cumpre as regras");
const solucao = "V M M ~ K  S C C ~ V  M C C ~ K  M V S K K  M M V K O".split(/\s+/).map((s) => ({ V: "verde", M: "moradia", K: "comercio", S: "servico", O: "oficina", C: "casa", "~": "corrego" })[s]);
confere(solucao.length === 25, "zoneamento: solução com 25 lotes");
confere(avaliar(solucao).every((r) => r.ok), "zoneamento: a solução à mão cumpre todas as regras: " + avaliar(solucao).filter((r) => !r.ok).map((r) => r.id));
const ruim = [...solucao];
ruim[24] = "oficina";
ruim[23] = "moradia"; // oficina colada em moradia
confere(!avaliar(ruim).find((r) => r.id === "incompativeis").ok, "zoneamento: oficina colada em moradia é barrada");

// Transição energética
for (const c of CENAS) {
  confere(c.escolhas.length === 3, `${c.id}: 3 escolhas`);
  confere(/^https:\/\/www\.planalto\.gov\.br\//.test(c.naVidaReal.fonte.url), `${c.id}: fonte do planalto`);
}
confere(MEDIDORES.length === 4, "4 medidores");
const limite = aplicar(INICIO, { emprego: 999, conta: -999 });
confere(limite.emprego === 100 && limite.conta === 0, "medidores ficam entre 0 e 100");
confere(classificar({ emprego: 80, conta: 70, clima: 60, territorio: 70 }) === "justa", "final justa");
confere(classificar({ emprego: 80, conta: 10, clima: 60, territorio: 70 }) === "injusta", "final injusta");
confere(classificar(INICIO) === "parcial", "final parcial");
// existe um caminho justo, para o jogo ser vencível
let melhor = INICIO;
for (const c of CENAS) {
  const soma = (e) => Object.values(e.efeito).reduce((a, b) => a + b, 0);
  melhor = aplicar(melhor, [...c.escolhas].sort((a, b) => soma(b) - soma(a))[0].efeito);
}
confere(classificar(melhor) === "justa", "energia: o melhor caminho termina em transição justa");

// Saúde
confere(CASAS.length === 6 && new Set(CASAS.map((c) => c.id)).size === 6, "6 casas");
confere(ordemSugerida(CASAS)[0].prioridade === 3, "ordem sugerida começa pelo mais urgente");
const ideal = avaliarEscolha(CASAS, CASAS.filter((c) => c.prioridade === 3).map((c) => c.id));
confere(ideal.acertos === ideal.total && ideal.faltou.length === 0, "escolha ideal acerta tudo");
confere(CASAS.filter((c) => c.prioridade === 3).length <= 3, "no máximo 3 casas urgentes (cabem nas 3 visitas)");

// Disjuntores: Ib <= In <= Iz
const chuveiro = CIRCUITOS.find((c) => c.id === "chuveiro");
confere(correnteDeProjeto(chuveiro) === 25, "chuveiro 5500/220 = 25 A");
confere(CAPACIDADE_DO_FIO[2.5] === 24 && CAPACIDADE_DO_FIO[1.5] === 17.5, "capacidades conferidas na fonte");
confere(avaliarCircuito(chuveiro, { secao: 2.5, disjuntor: 25, dr: true }).falhas.includes("fio-pequeno"), "2,5 mm² não aguenta o chuveiro");
confere(avaliarCircuito(chuveiro, { secao: 4, disjuntor: 50, dr: true }).falhas.includes("fio-esquenta"), "disjuntor maior que o fio esquenta");
confere(avaliarCircuito(chuveiro, { secao: 6, disjuntor: 20, dr: true }).falhas.includes("desarma"), "disjuntor menor que a carga desarma");
confere(avaliarCircuito(chuveiro, { secao: 4, disjuntor: 32, dr: false }).falhas.includes("dr-faltando"), "sem DR em área molhada falha");
confere(avaliarCircuito(chuveiro, { secao: 4, disjuntor: 32, dr: true }).ok, "chuveiro: 4 mm², 32 A e DR servem");
confere(avaliarCircuito(CIRCUITOS[1], { secao: 1.5, disjuntor: 16, dr: false }).falhas.includes("secao-minima"), "tomadas com 1,5 mm² abaixo do mínimo");
for (const c of CIRCUITOS) confere(combinacoesQueServem(c).length > 0, `${c.id}: existe combinação que serve`);

// Costura
for (const t of TECIDOS) {
  confere(avaliarAgulha(t, t.tamanhos[0], t.ponta).ok, `${t.id}: agulha certa passa`);
  confere(!avaliarAgulha(t, 70 === t.tamanhos[0] ? 100 : 70, t.ponta).ok, `${t.id}: agulha errada é barrada`);
}
confere(!avaliarAgulha(TECIDOS.find((t) => t.id === "malha"), 80, "universal").ok, "malha pede ponta bola");
confere(CASOS_DE_TENSAO.length === 3 && new Set(CASOS_DE_TENSAO.map((c) => c.acao)).size === 3, "3 casos de tensão com ações diferentes");

// Bug
for (const e of ENIGMAS) {
  confere(e.linhaDoErro >= 1 && e.linhaDoErro <= e.codigo.length && e.codigo[e.linhaDoErro - 1].trim() !== "", `${e.id}: linha do erro existe e não é vazia`);
  confere(e.passos.every((p) => p.linha >= 1 && p.linha <= e.codigo.length && p.memoria.length > 0), `${e.id}: passos válidos`);
  confere(acertou(e, e.linhaDoErro) && !acertou(e, e.linhaDoErro + 1), `${e.id}: acertou()`);
  confere(e.explicacao && e.correcao && e.saida, `${e.id}: explicação, correção e saída`);
}
confere(ENIGMAS.filter((e) => e.fonte === null).length <= 1, "enigma sem fonte só quando é raciocínio lógico puro");

// Redundância
confere(Math.abs(disponibilidade(0.99, 1) - 0.99) < 1e-12, "um servidor: disponibilidade igual à dele");
confere(Math.abs(disponibilidade(0.99, 2) - 0.9999) < 1e-12, "dois servidores de 99% dão 99,99%");
confere(disponibilidade(0.99, 3, 0.999) < 0.999, "a peça comum limita o ganho");
confere(disponibilidade(0.9, 0) === 0, "zero servidores: zero");
for (const l of TABELA_SRE) {
  const calc = minutosForaPorAno(l.disp);
  confere(Math.abs(calc - l.minutosPorAno) / l.minutosPorAno < 0.01, `tabela SRE ${l.texto}: ${calc.toFixed(2)} min`);
}
confere(escreverTempo(0.5) === "30 segundos" && escreverTempo(90).includes("horas"), "escreverTempo");

// Arquivos: licença, palavras proibidas, sem terceiros carregando sozinhos
const todos = [];
const andar = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) andar(p);
    else if (/\.(ts|tsx)$/.test(f.name)) todos.push(p);
  }
};
andar(PASTA);
confere(todos.length >= 19, "arquivos da pasta encontrados");
for (const p of todos) {
  const txt = fs.readFileSync(p, "utf8");
  const nome = path.relative(process.cwd(), p);
  confere(txt.startsWith("// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later"), `${nome}: cabeçalho de licença`);
  confere(!/universidade|diploma/i.test(txt), `${nome}: sem 'universidade' nem 'diploma'`);
  confere(!/<iframe|<script|fetch\(|XMLHttpRequest|localStorage|document\.cookie/.test(txt), `${nome}: sem iframe, script, rede nem armazenamento`);
  confere(!/node:fs|from "fs"/.test(txt), `${nome}: não lê disco`);
}

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("Jogos próprios 2: tudo certo.");
