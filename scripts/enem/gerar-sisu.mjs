// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Gera public/sisu/ofertas.json: as ofertas do Sisu com os PESOS de cada área e a NOTA DE CORTE da ampla
// concorrência por ano. Os dados vêm do repositório maiakanegae/sisu-data (licença MIT,
// https://github.com/maiakanegae/sisu-data), que coleta das APIs públicas do Sisu (sisu.mec.gov.br) — dados
// públicos do MEC, sem caráter oficial; confirme sempre no portal do Sisu.
//
// Uso:  node scripts/enem/gerar-sisu.mjs <dir>   (dir = clone do sisu-data, com data/AAAA/scraping/grades.csv)
//
// Cada linha do grades.csv: codigo;curso;grau;turno;vagas;campus;cidade;uf;ies;sigla; peso CN;CH;LC;MT;RED;
// notas mínimas (6); depois blocos de 5 campos por modalidade: nome;vagas;nota de corte;bônus;data.
// O código da oferta muda a cada edição: a série histórica casa por (sigla, campus, curso, grau, turno).
// Só a ampla concorrência entra no JSON (as cotas mudam de nome e de regra entre edições; v1 fica na ampla).
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("uso: node scripts/enem/gerar-sisu.mjs <dir do sisu-data>"); process.exit(1); }
const ANOS = [2020, 2021, 2022, 2023, 2024, 2025];

/** CSV com aspas em tudo e ";" de separador (campos podem trazer ";" dentro das aspas). */
function lerCsv(texto) {
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texto[i + 1] === "\n") i++; linha.push(campo); campo = ""; if (linha.length > 1) linhas.push(linha); linha = []; }
    else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const numero = (s) => { const n = Number((s ?? "").replace(",", ".")); return Number.isFinite(n) && (s ?? "").trim() !== "" ? n : null; };
const norm = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

// Por edição: chave da oferta → { ano, nota da ampla }; e o cadastro mais recente de cada oferta.
const ofertas = new Map();
for (const ano of ANOS) {
  const arq = path.join(dir, "data", String(ano), "scraping", "grades.csv");
  if (!fs.existsSync(arq)) { console.log(`${ano}: sem ${arq}, pulando`); continue; }
  let n = 0;
  for (const c of lerCsv(fs.readFileSync(arq, "utf8"))) {
    if (c.length < 21) continue;
    const [codigo, curso, grau, turno, vagas, campus, cidade, uf, ies, sigla] = c;
    // ordem no CSV: CN, CH, LC, MT, RED → aqui fica LC, CH, CN, MT, RED (a ordem de PROVAS_DO_SISU do site)
    const pesos = [numero(c[12]), numero(c[11]), numero(c[10]), numero(c[13]), numero(c[14])];
    if (pesos.some((p) => p === null)) continue;
    const chave = [norm(sigla), norm(campus), norm(curso), norm(grau), norm(turno)].join("|");
    // modalidades: blocos de 5 a partir do campo 21; a ampla concorrência é a referência
    let ampla = null;
    for (let i = 21; i + 4 < c.length + 1; i += 5) {
      if (norm(c[i]).startsWith("AMPLA")) { ampla = numero(c[i + 2]); break; }
    }
    let o = ofertas.get(chave);
    if (!o) {
      o = { curso: curso.trim().replace(/\s+/g, " "), grau, turno, campus: campus.trim().replace(/\s+/g, " "), cidade, uf, ies: ies.trim().replace(/\s+/g, " "), sg: sigla, p: pesos, v: Number(vagas) || 0, c: {} };
      ofertas.set(chave, o);
    }
    if (ano === Math.max(...ANOS)) { o.p = pesos; o.v = Number(vagas) || 0; o.co = Number(codigo); } // cadastro e pesos da edição mais nova
    if (ampla !== null && ampla > 0) o.c[ano] = ampla;
    n++;
  }
  console.log(`${ano}: ${n} ofertas lidas`);
}

// Só ofertas da edição mais nova (o catálogo do que dá para escolher agora), com ao menos uma nota de corte.
const lista = [...ofertas.values()].filter((o) => o.co && Object.keys(o.c).length > 0)
  .sort((a, b) => a.uf.localeCompare(b.uf) || a.ies.localeCompare(b.ies) || a.curso.localeCompare(b.curso));
const saida = {
  fonte: "Notas de corte e pesos do Sisu (MEC), coletados pelo projeto sisu-data (MIT): github.com/maiakanegae/sisu-data",
  gerado: new Date().toISOString().slice(0, 10),
  anos: ANOS,
  ofertas: lista,
};
fs.mkdirSync(path.join(process.cwd(), "public", "sisu"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "public", "sisu", "ofertas.json"), JSON.stringify(saida));
console.log(`ofertas no JSON: ${lista.length} (${(fs.statSync(path.join(process.cwd(), "public", "sisu", "ofertas.json")).size / 1e6).toFixed(1)} MB)`);
