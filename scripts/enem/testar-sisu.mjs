// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regressão das ofertas do Sisu (public/sisu/ofertas.json): estrutura, totais e a comparação completa
// com os relatórios oficiais do MEC (chamada regular final), extraídos por extrair-sisu-oficial.py.
// Uso: node scripts/enem/testar-sisu.mjs <dir do sisu-data>
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("uso: node scripts/enem/testar-sisu.mjs <dir do sisu-data>"); process.exit(1); }

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHA: ${msg}`); } };
const norm = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const numero = (s) => { const n = Number((s ?? "").replace(",", ".")); return Number.isFinite(n) && (s ?? "").trim() !== "" ? n : null; };

const catalogo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "sisu", "ofertas.json"), "utf8"));
const ofertas = catalogo.ofertas;
const ANOS = new Set(catalogo.anos.map(String));

// 1) estrutura
const chavesVistas = new Set();
let comCod = 0;
for (const o of ofertas) {
  ok(o.curso && o.grau && o.turno && o.campus && o.cidade && o.uf && o.ies && o.sg, `oferta sem identidade completa: ${o.sg}/${o.curso}`);
  ok(o.co !== undefined || o.cod !== undefined, `oferta sem código: ${o.sg}/${o.curso}/${o.campus}`);
  if (o.cod) comCod++;
  if (o.sm) ok(o.p === undefined, `oferta com sm não devia ter pesos: ${o.sg}/${o.curso}`);
  else {
    ok(Array.isArray(o.p) && o.p.length === 5 && o.p.every((p) => Number.isFinite(p) && p > 0), `pesos inválidos: ${o.sg}/${o.curso}/${o.campus}`);
  }
  const chave = `${o.sg}|${o.cidade}|${o.campus}|${o.curso}|${o.grau}|${o.turno}|${o.cod ?? ""}`;
  ok(!chavesVistas.has(chave), `oferta repetida: ${chave}`);
  chavesVistas.add(chave);
  for (const [ano, nota] of Object.entries(o.c)) {
    ok(ANOS.has(ano), `ano fora da lista (${ano}): ${o.sg}/${o.curso}`);
    ok(typeof nota === "number" && nota > 0 && nota <= 1000, `corte inválido ${ano}=${nota}: ${o.sg}/${o.curso}/${o.campus}`);
  }
  ok(Object.keys(o.c).length > 0, `oferta sem nenhum corte: ${o.sg}/${o.curso}/${o.campus}`);
}
ok(ofertas.length >= 6800, `total de ofertas caiu demais: ${ofertas.length}`);
ok(catalogo.cortes && ["2020", "2021", "2022", "2023", "2024", "2025"].every((a) => catalogo.cortes[a]), "faltam rótulos de proveniência por ano");
console.log(`estrutura: ${ofertas.length} ofertas (${comCod} separadas por código MEC), 0 repetidas`);

// 2) comparação completa com os relatórios oficiais da chamada regular (2022/1, 2024, 2025)
const ANOS_OFICIAIS = [2022, 2024, 2025];
const oficial = new Map();
for (const ano of ANOS_OFICIAIS) {
  const m = new Map();
  for (const linha of fs.readFileSync(path.join(dir, "data", "relatorios", "extraidos", `${ano}.csv`), "utf8").split("\n")) {
    const c = linha.split(";");
    if (c.length < 11 || c[0] === "co_ies_curso" || c[0] === "") continue;
    const nota = numero(c[10]);
    if (nota === null) continue;
    const chave = [norm(c[1]), norm(c[4]), norm(c[3]), norm(c[6]), norm(c[7]), norm(c[8])].join("|");
    if (!m.has(chave)) m.set(chave, []);
    m.get(chave).push({ cod: c[0].trim(), nota });
  }
  oficial.set(ano, m);
}
let comparadas = 0, erradas = 0;
const chave6 = (o) => [norm(o.sg), norm(o.cidade), norm(o.campus), norm(o.curso), norm(o.grau), norm(o.turno)].join("|");
for (const o of ofertas) {
  const k6 = chave6(o);
  for (const ano of ANOS_OFICIAIS) {
    const nota = o.c[String(ano)];
    if (nota === undefined) continue;
    const linhas = oficial.get(ano).get(k6) ?? [];
    const esperadas = o.cod ? linhas.filter((l) => l.cod === o.cod).map((l) => l.nota) : linhas.map((l) => l.nota);
    comparadas++;
    if (!esperadas.includes(nota)) { erradas++; console.error(`DIVERGE ${ano}: ${o.sg} ${o.campus} ${o.curso} ${o.turno}${o.cod ? ` cod ${o.cod}` : ""}: nosso ${nota}, oficial ${esperadas.join("/") || "sem linha"}`); }
  }
}
ok(erradas === 0, `${erradas} notas divergem dos relatórios oficiais`);
console.log(`oficiais 2022/2024/2025: ${comparadas} notas comparadas, ${erradas} divergentes`);

// 3) toda oferta do relatório oficial de 2025 que está no catálogo tem corte de 2025 (ou 0 oficial = sem classificado)
let semCorte = 0;
for (const [k6, ls] of oficial.get(2025)) {
  const o = ofertas.find((x) => chave6(x) === k6 && (x.cod === undefined || ls.some((l) => l.cod === x.cod)));
  if (!o) continue; // fora do catálogo (não ofertada em 2025 no scraping) — fora do escopo
  for (const l of ls) {
    if (o.cod && l.cod !== o.cod) continue;
    if (l.nota > 0) { if (o.c["2025"] === undefined) { semCorte++; console.error(`FALTA 2025: ${k6}${o.cod ? ` cod ${o.cod}` : ""} (oficial ${l.nota})`); } }
    else ok(o.c["2025"] === undefined, `nota 2025 inventada para oferta sem classificado na ampla: ${k6}`);
  }
}
ok(semCorte === 0, `${semCorte} ofertas sem o corte oficial de 2025`);
console.log(semCorte === 0 ? "oficial 2025: nenhum corte faltando; zeros oficiais sem corte no JSON" : "");

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log("\ntodos os testes do Sisu passaram");
