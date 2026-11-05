// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Gera public/tri/enem-AAAA.json: os parâmetros REAIS (a, b, c) dos itens de cada prova do Enem, tirados do arquivo
// ITENS_PROVA_AAAA.csv que o Inep publica dentro dos microdados (https://www.gov.br/inep/pt-br/acesso-a-informacao/
// dados-abertos/microdados/enem). O zip dos microdados tem 0,5 a 1,5 GB, então este script NÃO baixa o zip inteiro:
// lê a central de diretório com requisições "Range" e baixa só o CSV de itens (30 a 90 KB comprimido).
//
// Para cada ano e área, escolhe o caderno (cor) cuja numeração casa com as questões de public/questoes/enem-AAAA.json:
// uma questão do site só é ligada a um item se a posição bate E o gabarito da questão é igual ao gabarito oficial do
// item. Nada é inferido além disso: item sem parâmetro publicado ou "abandonado" pelo Inep fica marcado e fora da conta.
//
// Uso:  node scripts/enem/gerar-parametros-tri.mjs            (todos os anos, 2009 a 2023)
//       node scripts/enem/gerar-parametros-tri.mjs 2022 2023  (só estes anos)
//       node scripts/enem/gerar-parametros-tri.mjs --csv-dir pasta   (usa itens-AAAA.csv já baixados, sem rede)
import fs from "node:fs";
import path from "node:path";
import { extrairEntrada, listarZip } from "./zip-remoto.mjs";

const RAIZ = process.cwd();
const SAIDA = path.join(RAIZ, "public", "tri");
const AREAS = { linguagens: "LC", humanas: "CH", natureza: "CN", matematica: "MT" };
const COR_REGULAR = /^(azul|amarela?|branca?|rosa|cinza)$/i;
const LETRAS = ["A", "B", "C", "D", "E"];

const args = process.argv.slice(2);
const iDir = args.indexOf("--csv-dir");
const dirCsv = iDir >= 0 ? args[iDir + 1] : null;
const anos = args.filter((a, i) => /^\d{4}$/.test(a) && i !== iDir + 1).map(Number);
const lista = anos.length ? anos : Array.from({ length: 15 }, (_, i) => 2009 + i);

const num = (s) => (s === undefined || s.trim() === "" ? null : Number(s.replace(",", ".")));

function lerCsv(texto) {
  const linhas = texto.split(/\r?\n/).filter(Boolean);
  const sep = linhas[0].includes(";") ? ";" : ",";
  const cab = linhas[0].split(sep).map((c) => c.trim());
  return linhas.slice(1).map((l) => {
    const c = l.split(sep);
    const o = {};
    cab.forEach((k, i) => (o[k] = (c[i] ?? "").trim()));
    return o;
  });
}

async function csvDoAno(ano) {
  if (dirCsv) return fs.readFileSync(path.join(dirCsv, `itens-${ano}.csv`), "latin1");
  const url = `https://download.inep.gov.br/microdados/microdados_enem_${ano}.zip`;
  const entradas = await listarZip(url);
  const e = entradas.find((x) => /DADOS\/ITENS_PROVA_\d{4}\.csv$/i.test(x.nome));
  if (!e) throw new Error(`ITENS_PROVA_${ano}.csv não está no zip`);
  return (await extrairEntrada(url, e)).toString("latin1");
}

/** Itens de um caderno: { co, p (posição), g (gabarito), a, b, c, aban, lingua }. */
function itensDoCaderno(linhas) {
  return linhas.map((r) => {
    let a = num(r.NU_PARAM_A), b = num(r.NU_PARAM_B);
    const c = num(r.NU_PARAM_C);
    // Se algum ano vier na escala (500,100), volta para (0,1): b = (b500 − 500)/100 e a = a500·100.
    if (b !== null && Math.abs(b) > 20) { b = (b - 500) / 100; a = a === null ? null : a * 100; }
    const aban = r.IN_ITEM_ABAN === "1" || a === null || b === null || c === null;
    return { co: Number(r.CO_ITEM), p: Number(r.CO_POSICAO), g: r.TX_GABARITO, a, b, c, aban, lingua: !r.TP_LINGUA ? null : Number(r.TP_LINGUA), hab: r.CO_HABILIDADE ? Number(r.CO_HABILIDADE) : null };
  });
}

function questoesDoSite(ano) {
  const arq = path.join(RAIZ, "public", "questoes", `enem-${ano}.json`);
  if (!fs.existsSync(arq)) return [];
  return JSON.parse(fs.readFileSync(arq, "utf8")).questoes;
}

/** Melhor deslocamento (n = posição + desloc) entre as questões e os itens; preferência pelo menor |desloc|. */
function melhorMapa(itens, qs, faixa) {
  let melhor = { desloc: 0, mapa: new Map() };
  const ordem = Array.from({ length: faixa * 2 + 1 }, (_, i) => i - faixa).sort((x, y) => Math.abs(x) - Math.abs(y));
  for (const desloc of ordem) {
    const mapa = new Map();
    for (const q of qs) {
      const ok = itens.find((i) => i.p + desloc === q.n && i.g === LETRAS[q.resposta]);
      if (ok) mapa.set(ok.co, q.id);
    }
    if (mapa.size > melhor.mapa.size) melhor = { desloc, mapa };
  }
  return melhor;
}

/**
 * Liga as questões do site aos itens do caderno: posição + gabarito iguais. Itens comuns e itens de idioma têm
 * numeração própria. O inglês não está no banco do site (só o espanhol), então só o espanhol é ligado.
 */
function casar(itens, qs) {
  const comuns = melhorMapa(itens.filter((i) => i.lingua === null), qs.filter((q) => q.lingua !== "espanhol"), 140);
  const esp = melhorMapa(itens.filter((i) => i.lingua === 1), qs.filter((q) => q.lingua === "espanhol"), 10);
  const mapa = new Map([...comuns.mapa, ...esp.mapa]);
  return { acertos: comuns.mapa.size, desloc: comuns.desloc, mapa };
}

function porCaderno(linhas, sigla) {
  const g = new Map();
  for (const r of linhas) {
    if (r.SG_AREA !== sigla || !COR_REGULAR.test(r.TX_COR)) continue;
    if (r.TP_VERSAO_DIGITAL && r.TP_VERSAO_DIGITAL !== "0") continue;
    if (r.IN_ITEM_ADAPTADO === "1") continue;
    const k = r.CO_PROVA;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  // só cadernos de uma aplicação (45 itens, ou 40 comuns + 5 + 5 de idioma)
  return [...g.entries()].filter(([, l]) => new Set(l.map((r) => r.CO_ITEM + ":" + r.TP_LINGUA)).size <= 50 && l.length <= 50);
}

async function gerarAno(ano) {
  const linhas = lerCsv(await csvDoAno(ano));
  const site = questoesDoSite(ano);
  const saida = { ano, fonte: "Inep, microdados do Enem, arquivo ITENS_PROVA", url: `https://download.inep.gov.br/microdados/microdados_enem_${ano}.zip`, areas: {} };
  const resumo = [];
  for (const [area, sigla] of Object.entries(AREAS)) {
    const qs = site.filter((q) => q.area === area);
    let melhor = null;
    for (const [prova, l] of porCaderno(linhas, sigla)) {
      const itens = itensDoCaderno(l);
      const m = casar(itens, qs);
      if (!melhor || m.acertos > melhor.m.acertos) melhor = { prova, cor: l[0].TX_COR.toUpperCase(), itens, m };
    }
    if (!melhor) { resumo.push(`${area}: sem caderno`); continue; }
    const casou = melhor.m.acertos >= 20;
    let escolhido = melhor;
    if (!casou) {
      // sem ligação segura com as questões do site: usa o primeiro caderno regular, sem ligar nenhuma questão
      const [prova, l] = porCaderno(linhas, sigla).sort((x, y) => Number(x[0]) - Number(y[0]))[0];
      escolhido = { prova, cor: l[0].TX_COR.toUpperCase(), itens: itensDoCaderno(l), m: { acertos: 0, desloc: 0, mapa: new Map() } };
    }
    const { itens, m } = escolhido;
    const fmt = (i) => ({ co: i.co, p: i.p, g: i.g, ...(i.aban ? { aban: true } : { a: i.a, b: i.b, c: i.c }), ...(i.hab ? { h: i.hab } : {}), ...(m.mapa.has(i.co) ? { q: m.mapa.get(i.co) } : {}) });
    const ordem = (x, y) => x.p - y.p;
    const comuns = itens.filter((i) => i.lingua === null).sort(ordem).map(fmt);
    const bloco = { prova: Number(escolhido.prova), cor: escolhido.cor, casadoComSite: casou, ligadas: m.mapa.size, itens: comuns };
    if (sigla === "LC") {
      // idiomas: 0 = inglês, 1 = espanhol (dicionário dos microdados); cada um tem 5 itens que entram antes dos 40 comuns
      bloco.idiomas = {};
      const base = escolhido.itens;
      for (const [nome, cod] of [["ingles", 0], ["espanhol", 1]]) {
        bloco.idiomas[nome] = base.filter((i) => i.lingua === cod).sort(ordem).map(fmt);
      }
    }
    saida.areas[area] = bloco;
    resumo.push(`${area}: caderno ${bloco.cor}/${bloco.prova}, ${comuns.length}${sigla === "LC" ? "+5" : ""} itens, ${m.mapa.size} ligados ao site${casou ? "" : " (sem ligação segura)"}, ${itens.filter((i) => i.aban).length} fora da conta`);
  }
  fs.mkdirSync(SAIDA, { recursive: true });
  fs.writeFileSync(path.join(SAIDA, `enem-${ano}.json`), JSON.stringify(saida));
  return resumo;
}

const indice = [];
for (const ano of lista) {
  try {
    const r = await gerarAno(ano);
    console.log(ano, "\n  " + r.join("\n  "));
    indice.push(ano);
  } catch (e) {
    console.log(ano, "ERRO:", e.message);
  }
}
if (!anos.length) fs.writeFileSync(path.join(SAIDA, "indice.json"), JSON.stringify({ anos: indice, atualizado: new Date().toISOString().slice(0, 10) }));
