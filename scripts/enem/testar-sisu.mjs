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
const ANOS_OFICIAIS = [2020, 2022, 2023, 2024, 2025];
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
  // contagens conhecidas das extrações (garante que a ampla foi filtrada com a coluna certa de cada formato:
  // 2020 TP_MODALIDADE, 2022/2023 TP_MOD_CONCORRENCIA, 2024/2025 TIPO_CONCORRENCIA; 2023 codifica "A")
  const esperado = { 2020: 6481, 2022: 6146, 2023: 6230, 2024: 6721, 2025: 6863 };
  const total = [...m.values()].reduce((s2, l) => s2 + l.length, 0);
  ok(total === esperado[ano], `extração ${ano}: ${total} linhas da ampla, esperadas ${esperado[ano]} (formato de modalidade mudou?)`);
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
console.log(`oficiais 2020/2022/2023/2024/2025: ${comparadas} notas comparadas, ${erradas} divergentes`);

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
const zeros25 = [...oficial.get(2025).values()].flat().filter((l) => l.nota === 0).length;
console.log(semCorte === 0 ? `oficial 2025: nenhum corte faltando; ${zeros25} linhas oficiais com nota 0 ficaram sem corte no JSON (relatório não registra nota)` : "");
// ofertas separadas por código MEC: cada nota tem que bater com a linha oficial DAQUELE código
const comCodigo = ofertas.filter((o) => o.cod);
ok(comCodigo.length >= 10, `esperadas ao menos 10 entradas separadas por código MEC, achadas ${comCodigo.length}`);
for (const o of comCodigo)
  for (const [ano, nota] of Object.entries(o.c)) {
    const ls = (oficial.get(Number(ano))?.get(chave6(o)) ?? []).filter((l) => l.cod === o.cod);
    ok(ls.some((l) => l.nota === nota), `entrada cod ${o.cod} (${o.sg} ${o.curso}) tem ${ano}=${nota} fora do relatório oficial`);
  }
console.log(`${comCodigo.length} entradas separadas por código MEC, todas as notas batendo com o código certo`);

// pesos do IFSP corrigidos contra o termo de adesão oficial 2025 (ordem LC, CH, CN, MT, RED);
// fonte e método no comentário de CORRECOES_PESOS_IFSP em gerar-sisu.mjs
{
  const esperado = { 319107: [1, 1, 1, 2, 1], 319109: [1, 2, 1, 2, 1], 319110: [1, 1, 2, 4, 2], 319112: [2, 1, 1, 1, 2], 319114: [2, 1, 2, 5, 3], 319115: [2, 1, 2, 2, 2], 319120: [3, 2, 1, 2, 3], 319122: [1, 1, 1, 1, 2], 319150: [1, 1, 2, 4, 2], 319153: [3, 2, 5, 5, 3], 319168: [1, 1, 1, 4, 2], 319178: [1, 1, 1, 4, 2], 319185: [1, 1, 1, 2, 2], 319191: [2, 1, 2, 2, 2], 319193: [1, 1, 2, 2, 1], 319195: [1, 1, 1, 2, 1], 319199: [1, 1, 1, 3, 1], 319211: [3, 1, 1, 3, 2], 319212: [3, 2, 1, 1, 4], 319218: [2, 1, 1, 2, 1], 319230: [2, 1, 1, 3, 2], 319231: [2, 1, 1, 2, 2], 319249: [1, 1, 1.5, 2, 1], 319251: [1, 1, 2, 2, 1], 319255: [2, 1, 1, 4, 2], 319276: [1, 1, 2, 3, 1], 319277: [2, 1, 1, 2, 2], 319281: [1, 1, 2, 1, 1], 319282: [2, 1, 1, 2, 2], 319284: [1, 1, 2, 2, 1], 319285: [1, 1, 2, 1, 2], 319287: [1, 1, 1, 2, 2], 319297: [1, 1, 1, 2, 1], 319300: [3, 2, 1, 4, 5] };
  const achados = new Map(ofertas.filter((o) => o.co in esperado).map((o) => [o.co, o.p]));
  ok(achados.size === Object.keys(esperado).length, `IFSP: esperadas ${Object.keys(esperado).length} ofertas com peso corrigido, achadas ${achados.size}`);
  for (const [co, p] of Object.entries(esperado)) {
    ok(JSON.stringify(achados.get(Number(co))) === JSON.stringify(p), `IFSP co_ies_curso ${co}: pesos ${JSON.stringify(achados.get(Number(co)))}, esperados ${JSON.stringify(p)}`);
  }
  console.log(`IFSP: ${achados.size} pesos corrigidos conferindo com o termo de adesão oficial 2025`);
}

// 4) ofertas-sem-corte.json: exatamente as linhas oficiais de 2025 com nota 0 na ampla que o catálogo
// não representa (nem por chave, nem por código); aviso honesto no simulador, nunca estimativa
{
  const arq = path.join(process.cwd(), "public", "sisu", "ofertas-sem-corte.json");
  ok(fs.existsSync(arq), "falta public/sisu/ofertas-sem-corte.json (rode gerar-sisu.mjs)");
  const sc = JSON.parse(fs.readFileSync(arq, "utf8"));
  ok(sc.ano === 2025 && typeof sc.fonte === "string" && Array.isArray(sc.ofertas), "ofertas-sem-corte.json: estrutura inválida");
  const oficial25 = [];
  for (const linha of fs.readFileSync(path.join(dir, "data", "relatorios", "extraidos", "2025.csv"), "utf8").split("\n")) {
    const c = linha.split(";");
    if (c.length < 11 || c[0] === "co_ies_curso" || c[0] === "") continue;
    const nota = numero(c[10]);
    if (nota === null) continue;
    oficial25.push({ cod: c[0].trim(), sg: c[1], campus: c[3].trim().replace(/\s+/g, " "), cidade: c[4], curso: c[6].trim().replace(/\s+/g, " "), grau: c[7], turno: c[8], v: Number(c[9]) || 0, nota });
  }
  const k6 = (x) => [norm(x.sg), norm(x.cidade), norm(x.campus), norm(x.curso), norm(x.grau), norm(x.turno)].join("|");
  const chavesCatalogo = new Set(ofertas.map(chave6));
  const codCatalogo = new Set(ofertas.filter((o) => o.cod).map((o) => o.cod));
  const coCatalogo = new Set(ofertas.filter((o) => o.co).map((o) => String(o.co)));
  const representada = (l) => chavesCatalogo.has(k6(l)) || codCatalogo.has(l.cod) || coCatalogo.has(l.cod);
  // cada entrada do arquivo: identidade completa, casa com uma linha oficial 2025 de nota 0 e não está no catálogo
  const chavesVistasSc = new Set();
  for (const o of sc.ofertas) {
    ok(o.curso && o.grau && o.turno && o.campus && o.cidade && o.uf && o.ies && o.sg && o.cod, `sem-corte sem identidade completa: ${o.sg}/${o.curso}`);
    ok(Number.isInteger(o.v) && o.v >= 0, `sem-corte com vagas inválidas: ${o.sg}/${o.curso}`);
    const chave = `${o.cod}|${norm(o.campus)}`;
    ok(!chavesVistasSc.has(chave), `sem-corte repetida: ${chave}`);
    chavesVistasSc.add(chave);
    const oficial = oficial25.find((l) => l.cod === o.cod && k6(l) === k6(o));
    ok(oficial && oficial.nota === 0, `sem-corte sem linha oficial 2025 de nota 0: ${o.cod} ${o.sg}/${o.curso}/${o.campus}`);
    if (oficial) ok(oficial.v === o.v, `sem-corte com vagas diferentes do relatório oficial: ${o.cod} (${o.v} no JSON, ${oficial.v} oficial)`);
    ok(!representada(o), `sem-corte já representada no catálogo: ${o.cod} ${o.sg}/${o.curso}`);
  }
  // conjunto exato: nenhuma linha oficial 2025 de nota 0 fora do catálogo pode faltar; nenhuma com nota > 0 pode sobrar fora
  const esperadas = oficial25.filter((l) => l.nota === 0 && !representada(l));
  ok(sc.ofertas.length === esperadas.length, `sem-corte: ${sc.ofertas.length} no JSON, ${esperadas.length} esperadas pelo relatório oficial`);
  const comCorteFora = oficial25.filter((l) => l.nota > 0 && !representada(l));
  ok(comCorteFora.length === 0, `${comCorteFora.length} linhas oficiais 2025 COM corte fora do catálogo e fora do sem-corte`);
  // casos conhecidos da investigação (inclui vagas 0, que ficam distintas das de vagas positivas)
  const conhecidos = { "1123027": 23, "5000477": 23, "99450": 23, "392254": 0, "1633932": 0 };
  for (const [cod, v] of Object.entries(conhecidos)) {
    const o = sc.ofertas.find((x) => x.cod === cod);
    ok(o && o.v === v, `sem-corte: caso conhecido cod ${cod} com ${v} vagas não encontrado`);
  }
  console.log(`sem-corte: ${sc.ofertas.length} ofertas sem nota de corte 2020–2025 (${sc.ofertas.filter((o) => o.v > 0).length} com vagas na ampla em 2025, ${sc.ofertas.filter((o) => o.v === 0).length} com 0 vagas), conjunto exato contra o relatório oficial`);
}

if (falhas > 0) { console.error(`\n${falhas} falha(s)`); process.exit(1); }
console.log("\ntodos os testes do Sisu passaram");
