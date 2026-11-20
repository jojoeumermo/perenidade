// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Gera public/escolas/: o ranking das escolas do Brasil pelas médias do Enem 2024, por UF, com o
// top nacional no indice.json. São dados públicos do Inep, sem caráter oficial.
//
// Fontes (baixar antes; os zips grandes ficam fora do repositório):
//   1. Microdados do Enem 2024 — https://download.inep.gov.br/microdados/microdados_enem_2024.zip (526 MB;
//      o servidor recusa verificação de certificado — use "curl -k" — e estrangela conexões longas; se o
//      download direto travar, baixe só a entrada DADOS/RESULTADOS_2024.csv por faixas Range, como faz
//      scripts/enem/zip-remoto.mjs). Só o RESULTADOS_2024.csv (1,7 GB) é necessário: é ele que tem o
//      código da escola (CO_ESCOLA) e as notas; o PARTICIPANTES_2024.csv não tem notas.
//   2. Microdados do Censo Escolar 2024 — https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2024.zip
//      (34 MB; idem "curl -k"). Só o microdados_ed_basica_2024.csv é necessário: os nomes das escolas
//      (o RESULTADOS traz só o código).
//
// Uso:
//   node scripts/enem/gerar-ranking-escolas.mjs --resultados RESULTADOS_2024.csv --censo microdados_ed_basica_2024.csv
//
// Metodologia (a mesma dos rankings públicos consolidados, como rankingenem.com):
//   - entram só participantes presentes nos dois dias (TP_PRESENCA_CN/CH/LC/MT = 1) e com redação
//     válida (TP_STATUS_REDACAO = 1); a nota da escola é a média simples desses participantes;
//   - o RESULTADOS_2024.csv não traz o indicador de treineiro (nota de rodapé do Inep), então
//     treineiros não podem ser excluídos e ficam incluídos — mesmo critério do rankingenem.com;
//   - uma escola só entra no ranking com pelo menos MIN_PARTICIPANTES participantes nessas condições;
//   - a "média geral" é a média simples das 5 áreas (sem pesos do Sisu, que variam por curso);
//   - município, UF e dependência administrativa vêm do Censo Escolar 2024 (cadastro da escola);
//     o RESULTADOS serve de reserva quando a escola não está no Censo (raro: 0 casos em 2024 com n≥10).
//
// Saída: public/escolas/indice.json (resumo + top nacional) e public/escolas/uf-<uf>.json (lista da UF,
// ordenada pela média geral). Cada escola: [código, nome, município, dependência (1 fed, 2 est, 3 mun,
// 4 priv), participantes, geral, CN, CH, LC, MT, RED] — médias com uma casa decimal.
import fs from "node:fs";
import path from "node:path";

const MIN_PARTICIPANTES = 10;
const TOP_NACIONAL = 200;
const SAIDA = path.join(process.cwd(), "public", "escolas");

const args = process.argv.slice(2);
const opcao = (nome) => { const i = args.indexOf("--" + nome); return i >= 0 ? args[i + 1] : null; };
const camResultados = opcao("resultados");
const camCenso = opcao("censo");
if (!camResultados || !camCenso) {
  console.error("uso: node scripts/enem/gerar-ranking-escolas.mjs --resultados RESULTADOS_2024.csv --censo microdados_ed_basica_2024.csv");
  process.exit(1);
}

/** Lê um CSV enorme (";", aspas, latin1) linha a linha sem montar o arquivo inteiro em memória. */
async function lerLinhas(caminho, cb) {
  const fluxo = fs.createReadStream(caminho, { highWaterMark: 8 * 1024 * 1024 });
  let resto = Buffer.alloc(0);
  let primeira = true;
  for await (const pedaco of fluxo) {
    const buf = resto.length ? Buffer.concat([resto, pedaco]) : pedaco;
    let ini = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 10) {
        let fim = i;
        if (fim > ini && buf[fim - 1] === 13) fim--;
        cb(buf.toString("latin1", ini, fim), primeira);
        primeira = false;
        ini = i + 1;
      }
    }
    resto = buf.subarray(ini);
  }
  if (resto.length) cb(resto.toString("latin1"), primeira);
}

/** Uma linha de CSV com ";" e aspas (campos podem trazer ";" dentro das aspas). */
function campos(linha) {
  const saida = [];
  let campo = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"') { if (linha[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") { saida.push(campo); campo = ""; }
    else campo += c;
  }
  saida.push(campo);
  return saida;
}

const numero = (s) => { const n = Number((s ?? "").replace(",", ".")); return Number.isFinite(n) && (s ?? "").trim() !== "" ? n : null; };

// Os arquivos do Inep mudam de ordem de colunas entre edições: localizar pelo cabeçalho.
function indices(cabecalho, nomes) {
  const pos = {};
  for (const n of nomes) {
    pos[n] = cabecalho.findIndex((c) => c.replace(/^﻿/, "").toUpperCase() === n);
    if (pos[n] < 0) { console.error(`coluna ${n} não encontrada; cabeçalho: ${cabecalho.slice(0, 12).join(";")}…`); process.exit(1); }
  }
  return pos;
}

// De-PPT: "FARIAS BRITO CENTRO EDUCACIONAL" → "Farias Brito Centro Educacional".
const MINUSCULAS = new Set(["DE", "DA", "DO", "DOS", "DAS", "E", "EM"]);
const SIGLAS = new Set([
  "IF", "IFAL", "IFAM", "IFAP", "IFBA", "IFBAIANO", "IFCE", "IFES", "IFF", "IFG", "IFGOIANO", "IFGO", "IFMA", "IFMG",
  "IFMS", "IFMT", "IFNMG", "IFPA", "IFPB", "IFPE", "IFPI", "IFPR", "IFRJ", "IFRN", "IFRO", "IFRR", "IFRS", "IFS",
  "IFSC", "IFSP", "IFSUL", "IFSULDEMINAS", "IFTO", "CEFET", "ETEC", "EETEPA", "FAETEC", "CPII", "CPOR", "CPM",
  "CMRJ", "CMB", "CMBH", "CMCG", "CMM", "CMMG", "CMN", "CMPA", "CMSM", "CEU", "CEJA", "CEPEP", "EJA", "EEB",
  "EEFM", "EEM", "EEMTI", "EEP", "EEEP", "EESG", "EEPG", "EEEFM", "FUNEC", "SENAI", "SENAC", "SESI", "FEM",
  "UEMG", "CEFER", "EE", "EM", "EMEF", "EMEI", "EMEFM", "EMEIF", "CIEP", "CIEPs", "CED", "CET", "CETI", "ESC",
]);
function nomeProprio(nome) {
  const palavras = nome.replace(/\s+/g, " ").trim().split(" ");
  return palavras.map((p, i) => {
    const limpa = p.replace(/[().,/-]/g, "");
    if (SIGLAS.has(limpa.toUpperCase()) && limpa.length <= 12 && limpa.toUpperCase() === limpa) return p;
    if (/^[IVXLCDM]{2,}$/.test(limpa)) return p; // numeral romano: Pedro II, não "Pedro Ii"
    if (i > 0 && MINUSCULAS.has(p.toUpperCase())) return p.toLowerCase();
    return p.length ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p;
  }).join(" ");
}

console.log("1/3: lendo o Censo Escolar 2024 (nomes das escolas ativas)…");
const escolas = new Map(); // código → { nome, uf, mun, dep }
{
  let idx = null, n = 0;
  await lerLinhas(camCenso, (linha, primeira) => {
    const c = campos(linha);
    if (primeira) { idx = indices(c, ["CO_ENTIDADE", "NO_ENTIDADE", "NO_MUNICIPIO", "SG_UF", "TP_DEPENDENCIA", "TP_SITUACAO_FUNCIONAMENTO"]); return; }
    if (c[idx.TP_SITUACAO_FUNCIONAMENTO] !== "1") return; // só escolas em atividade
    const cod = c[idx.CO_ENTIDADE];
    if (!cod) return;
    escolas.set(cod, { nome: c[idx.NO_ENTIDADE], uf: c[idx.SG_UF], mun: c[idx.NO_MUNICIPIO], dep: numero(c[idx.TP_DEPENDENCIA]) });
    n++;
  });
  console.log(`   ${escolas.size.toLocaleString("pt-BR")} escolas ativas (${n.toLocaleString("pt-BR")} linhas)`);
}

console.log("2/3: somando as notas do RESULTADOS_2024.csv por escola…");
const somas = new Map(); // código → { n, s:[5], uf, mun, dep }
let lidos = 0, validos = 0;
{
  let idx = null;
  await lerLinhas(camResultados, (linha, primeira) => {
    const c = campos(linha);
    if (primeira) {
      idx = indices(c, ["CO_ESCOLA", "NO_MUNICIPIO_ESC", "SG_UF_ESC", "TP_DEPENDENCIA_ADM_ESC",
        "TP_PRESENCA_CN", "TP_PRESENCA_CH", "TP_PRESENCA_LC", "TP_PRESENCA_MT", "TP_STATUS_REDACAO",
        "NU_NOTA_CN", "NU_NOTA_CH", "NU_NOTA_LC", "NU_NOTA_MT", "NU_NOTA_REDACAO"]);
      return;
    }
    lidos++;
    if (lidos % 500000 === 0) console.log(`   … ${(lidos / 1e6).toFixed(1)} mi de linhas`);
    if (c[idx.TP_PRESENCA_CN] !== "1" || c[idx.TP_PRESENCA_CH] !== "1" || c[idx.TP_PRESENCA_LC] !== "1" || c[idx.TP_PRESENCA_MT] !== "1") return;
    if (c[idx.TP_STATUS_REDACAO] !== "1") return;
    const notas = [numero(c[idx.NU_NOTA_CN]), numero(c[idx.NU_NOTA_CH]), numero(c[idx.NU_NOTA_LC]), numero(c[idx.NU_NOTA_MT]), numero(c[idx.NU_NOTA_REDACAO])];
    if (notas.some((n) => n === null)) return;
    const cod = c[idx.CO_ESCOLA];
    if (!cod) return;
    validos++;
    let a = somas.get(cod);
    if (!a) { a = { n: 0, s: [0, 0, 0, 0, 0], uf: c[idx.SG_UF_ESC], mun: c[idx.NO_MUNICIPIO_ESC], dep: numero(c[idx.TP_DEPENDENCIA_ADM_ESC]) }; somas.set(cod, a); }
    a.n++;
    for (let i = 0; i < 5; i++) a.s[i] += notas[i];
  });
}
console.log(`   ${lidos.toLocaleString("pt-BR")} participantes, ${validos.toLocaleString("pt-BR")} válidos, ${somas.size.toLocaleString("pt-BR")} escolas`);

console.log("3/3: montando os arquivos…");
const NOMES_AREA = ["CN", "CH", "LC", "MT", "RED"];
const lista = [];
let semNome = 0;
for (const [cod, a] of somas) {
  if (a.n < MIN_PARTICIPANTES) continue;
  const cad = escolas.get(cod);
  if (!cad) semNome++;
  const nome = cad ? nomeProprio(cad.nome) : `Escola ${cod}`;
  const mun = cad?.mun ?? a.mun, uf = cad?.uf ?? a.uf, dep = cad?.dep ?? a.dep;
  const medias = a.s.map((s) => Math.round((s / a.n) * 10) / 10);
  const geral = Math.round((medias.reduce((x, y) => x + y, 0) / 5) * 10) / 10;
  lista.push({ cod, nome, mun, uf, dep: dep ?? 0, n: a.n, geral, medias });
}
// Checagens de sanidade: melhor falhar aqui do que publicar um ranking quebrado.
if (lista.length < 20000) { console.error(`só ${lista.length} escolas com n≥${MIN_PARTICIPANTES} — esperado 20 mil+; abortando`); process.exit(1); }
if (semNome > lista.length * 0.001) { console.error(`${semNome} escolas sem cadastro no Censo (>0,1%) — abortando`); process.exit(1); }
for (const e of lista) {
  if (e.medias.some((m) => !(m >= 0 && m <= 1000)) || !(e.geral >= 0 && e.geral <= 1000)) { console.error(`média fora de 0–1000 em ${e.cod}`); process.exit(1); }
}
lista.sort((a, b) => b.geral - a.geral || b.n - a.n);
console.log(`   ${lista.length.toLocaleString("pt-BR")} escolas no ranking (${semNome} sem nome no Censo)`);

const linha = (e) => [e.cod, e.nome, e.mun, e.dep, e.n, e.geral, ...e.medias];
const ufs = {};
for (const e of lista) (ufs[e.uf] ??= []).push(e);
fs.mkdirSync(SAIDA, { recursive: true });
const contagem = {};
for (const [uf, es] of Object.entries(ufs)) {
  contagem[uf] = es.length;
  fs.writeFileSync(path.join(SAIDA, `uf-${uf.toLowerCase()}.json`), JSON.stringify(es.map(linha)));
}
const saida = {
  fonte: "Microdados do Enem 2024 e do Censo Escolar 2024 (Inep)",
  gerado: new Date().toISOString().slice(0, 10),
  ano: 2024,
  participantesMinimo: MIN_PARTICIPANTES,
  areas: NOMES_AREA,
  escolas: lista.length,
  ufs: contagem,
  topo: lista.slice(0, TOP_NACIONAL).map(linha),
};
fs.writeFileSync(path.join(SAIDA, "indice.json"), JSON.stringify(saida));
console.log(`   gravados indice.json + ${Object.keys(ufs).length} arquivos por UF em public/escolas/`);
console.log(`   #1: ${lista[0].nome} (${lista[0].mun}/${lista[0].uf}) — geral ${lista[0].geral}, n=${lista[0].n}`);
