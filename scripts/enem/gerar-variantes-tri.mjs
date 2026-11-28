// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Acrescenta "variantes" aos arquivos public/tri/enem-AAAA.json: cadernos REGULARES (mesmas cores e filtros do
// gerar-parametros-tri.mjs) cujo conjunto de itens difere do caderno de referência já publicado, mas tem ao menos
// um item em comum com ele — caso da reaplicação 2022 CN (caderno 1093, 44/45 itens comuns), medido na validação
// TRI com viés sistemático de até 15 pts por falta desses itens. Cadernos sem nenhum item em comum (PPL, digital)
// ficam fora desta fase e são só listados no resumo.
//
// Mudança estritamente aditiva: nenhum campo existente é alterado; consumidores atuais (lib/enem-tri.ts) ignoram
// o campo novo. Itens seguem o formato vigente ({co, p, g, a, b, c, h} ou {co, p, g, aban, h}), sem ligação com
// questões do site (sem "q").
//
// Uso:  node scripts/enem/gerar-variantes-tri.mjs 2022        (só este ano; só as áreas validadas, ver abaixo)
//       node scripts/enem/gerar-variantes-tri.mjs --csv-dir pasta 2022   (lê pasta/itens-AAAA.csv em vez do zip)
//       node scripts/enem/gerar-variantes-tri.mjs --areas natureza matematica 2022
//
// ÁREAS: por padrão regenera as áreas com validação populacional medida nos microdados (AREAS_VALIDADAS:
// natureza/CN 1093, matematica/MT 1081 e linguagens/LC 1073, 2022; números e limites no corpo do PR).
// Ficam fora, sem medição: cadernos especiais (CN 1165-1168, MT 1155-1158, LC 1145-1148) e humanas.
// --areas permite regenerar um subconjunto.
import fs from "node:fs";
import path from "node:path";
import { extrairEntrada, listarZip } from "./zip-remoto.mjs";

const RAIZ = process.cwd();
const DIR_TRI = path.join(RAIZ, "public", "tri");
const AREAS = { linguagens: "LC", humanas: "CH", natureza: "CN", matematica: "MT" };
// Áreas com validação populacional completa (efeito medido nos microdados com o estimador EAP do
// repositório, antes/depois com o mesmo leitor). Só estas são regeneradas por padrão.
const AREAS_VALIDADAS = ["natureza", "linguagens", "matematica"];

const args = process.argv.slice(2);
const iDir = args.indexOf("--csv-dir");
const dirCsv = iDir >= 0 ? args[iDir + 1] : null;
const iAreas = args.indexOf("--areas");
const areasEscolhidas = new Set(
  iAreas >= 0
    ? args.slice(iAreas + 1).filter((a) => a in AREAS)
    : AREAS_VALIDADAS,
);
if (iAreas >= 0 && areasEscolhidas.size === 0) {
  console.error(`--areas: informe ao menos uma de: ${Object.keys(AREAS).join(", ")}`);
  process.exit(1);
}
const anos = args.filter((a, i) => /^\d{4}$/.test(a) && (iDir < 0 || i !== iDir + 1)).map(Number);
if (!anos.length) {
  console.error("informe ao menos um ano (gerar ano a ano, com auditoria por edição)");
  process.exit(1);
}

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

function itensDoCaderno(linhas) {
  return linhas.map((r) => {
    let a = num(r.NU_PARAM_A), b = num(r.NU_PARAM_B);
    const c = num(r.NU_PARAM_C);
    if (b !== null && Math.abs(b) > 20) { b = (b - 500) / 100; a = a === null ? null : a * 100; }
    const aban = r.IN_ITEM_ABAN === "1" || a === null || b === null || c === null;
    return { co: Number(r.CO_ITEM), p: Number(r.CO_POSICAO), g: r.TX_GABARITO, a, b, c, aban, lingua: !r.TP_LINGUA ? null : Number(r.TP_LINGUA), hab: r.CO_HABILIDADE ? Number(r.CO_HABILIDADE) : null };
  });
}

// Filtros do gerar-parametros-tri.mjs, menos a cor: para variantes o critério é a sobreposição de itens
// com a referência (o caderno 1093 de 2022, medido com viés na validação, é VERDE e ficaria de fora).
function porCaderno(linhas, sigla) {
  const g = new Map();
  for (const r of linhas) {
    if (r.SG_AREA !== sigla) continue;
    if (r.TP_VERSAO_DIGITAL && r.TP_VERSAO_DIGITAL !== "0") continue;
    if (r.IN_ITEM_ADAPTADO === "1") continue;
    const k = r.CO_PROVA;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  return [...g.entries()].filter(([, l]) => new Set(l.map((r) => r.CO_ITEM + ":" + r.TP_LINGUA)).size <= 50 && l.length <= 50);
}

const fmt = (i) => ({ co: i.co, p: i.p, g: i.g, ...(i.aban ? { aban: true } : { a: i.a, b: i.b, c: i.c }), ...(i.hab ? { h: i.hab } : {}) });
const ordem = (x, y) => x.p - y.p;

for (const ano of anos) {
  const arq = path.join(DIR_TRI, `enem-${ano}.json`);
  const edicao = JSON.parse(fs.readFileSync(arq, "utf8"));
  const linhas = lerCsv(await csvDoAno(ano));
  const resumo = [];
  for (const [area, sigla] of Object.entries(AREAS)) {
    if (!areasEscolhidas.has(area)) continue;
    const bloco = edicao.areas[area];
    if (!bloco) { resumo.push(`${area}: sem bloco no JSON`); continue; }
    const cosJson = new Set([...(bloco.itens || []), ...(bloco.idiomas ? [...bloco.idiomas.ingles, ...bloco.idiomas.espanhol] : [])].map((i) => i.co));
    const cadernos = porCaderno(linhas, sigla);
    const ref = cadernos.find(([p]) => Number(p) === bloco.prova);
    if (!ref) { resumo.push(`${area}: referência ${bloco.prova} não achada no ITENS`); continue; }
    const cosRef = new Set(itensDoCaderno(ref[1]).map((i) => i.co));
    const faltam = [...cosJson].filter((c) => !cosRef.has(c));
    if (faltam.length) { resumo.push(`${area}: JSON tem ${faltam.length} itens fora da referência (${faltam.slice(0, 3).join(",")}) — revisar antes`); continue; }
    const variantes = [];
    const fase2 = [];
    for (const [prova, l] of cadernos) {
      if (Number(prova) === bloco.prova) continue;
      const itens = itensDoCaderno(l);
      const cos = new Set(itens.map((i) => i.co));
      if (cos.size === cosRef.size && [...cos].every((c) => cosRef.has(c))) continue; // mesma prova, outra cor
      const comuns = [...cos].filter((c) => cosJson.has(c)).length;
      if (comuns === 0) { fase2.push(prova); continue; }
      const entrada = { provas: [Number(prova)], itens: itens.filter((i) => i.lingua === null).sort(ordem).map(fmt) };
      if (sigla === "LC") {
        entrada.idiomas = {
          ingles: itens.filter((i) => i.lingua === 0).sort(ordem).map(fmt),
          espanhol: itens.filter((i) => i.lingua === 1).sort(ordem).map(fmt),
        };
      }
      variantes.push({ entrada, comuns, total: cos.size });
    }
    if (variantes.length) bloco.variantes = variantes.map((v) => v.entrada);
    else delete bloco.variantes;
    resumo.push(`${area}: ref ${bloco.prova} | ${variantes.length} variante(s) fase1 [${variantes.map((v) => v.entrada.provas[0] + " " + v.comuns + "/" + v.total).join(", ")}] | ${fase2.length} fase2 [${fase2.join(",")}]`);
  }
  fs.writeFileSync(arq, JSON.stringify(edicao));
  console.log(`${ano}: ${resumo.join(" | ")}`);
}
