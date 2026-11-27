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

// ---- Relatórios oficiais do MEC (chamada regular final; extraídos por extrair-sisu-oficial.py) ----
// Corrige dois problemas comprovados do scraping: (1) a API parou de divulgar parciais de 2025 antes do fim,
// então faltam cortes de 2025 — completados com o relatório oficial; (2) alguns nomes de curso valem para mais
// de um código MEC (CO_IES_CURSO) com cortes diferentes, e o scraping não distingue (a última linha lida vencia) —
// essas ofertas viram uma entrada por código, com as notas oficiais de cada um.
const ANOS_OFICIAIS = [2020, 2022, 2023, 2024, 2025];
const oficial = new Map(); // ano -> Map chave (sigla|cidade|campus|curso|grau|turno) -> linhas
for (const ano of ANOS_OFICIAIS) {
  const arq = path.join(dir, "data", "relatorios", "extraidos", `${ano}.csv`);
  if (!fs.existsSync(arq)) { console.log(`oficial ${ano}: sem extração (rode extrair-sisu-oficial.py), pulando`); continue; }
  const m = new Map();
  for (const c of lerCsv(fs.readFileSync(arq, "utf8"))) {
    if (c.length < 11 || c[0] === "co_ies_curso") continue;
    const nota = numero(c[10]);
    if (nota === null) continue;
    const chave = [norm(c[1]), norm(c[4]), norm(c[3]), norm(c[6]), norm(c[7]), norm(c[8])].join("|");
    if (!m.has(chave)) m.set(chave, []);
    m.get(chave).push({
      cod: c[0].trim(), sg: c[1], ies: c[2].trim().replace(/\s+/g, " "), campus: c[3].trim().replace(/\s+/g, " "),
      cidade: c[4], uf: c[5], curso: c[6].trim().replace(/\s+/g, " "), grau: c[7], turno: c[8], v: Number(c[9]) || 0, nota,
    });
  }
  oficial.set(ano, m);
  console.log(`oficial ${ano}: ${[...m.values()].reduce((s, l) => s + l.length, 0)} linhas da ampla`);
}

if (oficial.size > 0) {
  const chave6 = (o) => [norm(o.sg), norm(o.cidade), norm(o.campus), norm(o.curso), norm(o.grau), norm(o.turno)].join("|");
  const porChave6 = new Map();
  const colididas = new Set();
  for (const o of ofertas.values()) {
    const k6 = chave6(o);
    if (porChave6.has(k6)) { colididas.add(k6); porChave6.delete(k6); }
    else if (!colididas.has(k6)) porChave6.set(k6, o);
  }
  if (colididas.size) console.log(`aviso: ${colididas.size} chaves repetidas no catálogo ficam de fora da conferência oficial`);

  // Chaves que o MEC registra com mais de um código de curso (ou com mais de uma nota para o mesmo código):
  // o scraping colapsa tudo numa linha só, então aqui elas viram uma entrada por código.
  const ambiguas = new Set();
  for (const [, m] of oficial)
    for (const [k6, ls] of m)
      if (new Set(ls.map((l) => l.cod)).size > 1 || new Set(ls.map((l) => l.nota)).size > 1) ambiguas.add(k6);

  const novas = [];
  const removerK5 = new Set();
  let anosPerdidos = 0;
  for (const k6 of ambiguas) {
    const base = porChave6.get(k6);
    // Sem base no catálogo e sem oferta na edição mais nova, não entra (o catálogo é o que dá para escolher agora)
    if (!base && !(oficial.get(Math.max(...ANOS_OFICIAIS))?.has(k6))) continue;
    const porCod = new Map();
    for (const [ano, m] of oficial) {
      for (const l of m.get(k6) ?? []) {
        if (!porCod.has(l.cod)) porCod.set(l.cod, { cod: l.cod, c: {}, v: 0, meta: l });
        const e = porCod.get(l.cod);
        // nota 0,0 no relatório oficial = ninguém classificado na ampla naquela vaga; não vira nota de corte
        if (l.nota > 0) e.c[ano] = l.nota;
        if (ano === Math.max(...ANOS_OFICIAIS)) e.v = l.v;
      }
    }
    if (base) {
      removerK5.add([norm(base.sg), norm(base.campus), norm(base.curso), norm(base.grau), norm(base.turno)].join("|"));
      // anos sem relatório oficial (2020, 2021, 2023) não dá para atribuir a um código: ficam de fora das entradas novas
      anosPerdidos += Object.keys(base.c).filter((a) => !ANOS_OFICIAIS.includes(Number(a))).length;
    }
    // O que distingue cada código, quando fonte oficial sustenta (termo de adesão / edital da IES, edição 2025):
    // UFMS ingresso.ufms.br/files/2024/12/termo_adesao_694_UFMS-1.pdf (turnos/semestres de entrada);
    // IFRN Edital 03/2025 retificado (habilitações). UEM e UFBA: o termo não distingue os códigos — fica só o código.
    const DET_POR_COD = {
      "15837": "matutino/vespertino, entrada no 1º semestre",
      "1128355": "vespertino/noturno, entrada no 2º semestre",
      "1357991": "habilitação Ciências Humanas e Sociais",
      "1357992": "habilitação Matemática",
    };
    for (const e of porCod.values()) {
      const meta = e.meta;
      const det = DET_POR_COD[e.cod] ? { det: DET_POR_COD[e.cod] } : {};
      if (base) novas.push({ ...base, c: { ...e.c }, v: e.v || base.v, cod: e.cod, co: undefined, ...det });
      else novas.push({ curso: meta.curso, grau: meta.grau, turno: meta.turno, campus: meta.campus, cidade: meta.cidade, uf: meta.uf, ies: meta.ies, sg: meta.sg, sm: 1, v: e.v, c: e.c, cod: e.cod, ...det });
    }
  }
  if (ambiguas.size) console.log(`chaves ambíguas separadas por código MEC: ${ambiguas.size} (→ ${novas.length} entradas; ${anosPerdidos} notas de anos sem conferência ficaram de fora)`);

  // Completa com o relatório oficial de 2025 as notas que a API não chegou a divulgar em parcial.
  const of25 = oficial.get(2025);
  if (of25) {
    let completadas = 0, criadas = 0, semClassificado = 0;
    for (const [k6, ls] of of25) {
      if (ambiguas.has(k6) || colididas.has(k6) || ls.length === 0) continue;
      const l = ls[0];
      const base = porChave6.get(k6);
      if (base) {
        if (base.c[String(Math.max(...ANOS))] === undefined) {
          if (l.nota > 0) { base.c[String(Math.max(...ANOS))] = l.nota; base.cf = 1; completadas++; }
          else semClassificado++;
        }
      } else if (l.nota > 0) {
        novas.push({ curso: l.curso, grau: l.grau, turno: l.turno, campus: l.campus, cidade: l.cidade, uf: l.uf, ies: l.ies, sg: l.sg, sm: 1, v: l.v, c: { [String(Math.max(...ANOS))]: l.nota }, cod: l.cod, cf: 1 });
        criadas++;
      } else semClassificado++;
    }
    console.log(`oficial ${Math.max(...ANOS)}: ${completadas} notas completadas, ${criadas} ofertas criadas, ${semClassificado} sem classificado na ampla (sem corte)`);
  }

  for (const k5 of removerK5) ofertas.delete(k5);
  for (const o of novas) ofertas.set(`oficial:${o.cod}`, o);
}

const CORRECOES_PESOS_IFSP = {
  319107: [1, 1, 1, 2, 1], // ENGENHARIA CIVIL - Votuporanga (antes: [1, 1, 1, 1, 1])
  319109: [1, 2, 1, 2, 1], // MATEMÁTICA - Campos do Jordão (antes: [1, 1, 1, 1, 1])
  319110: [1, 1, 2, 4, 2], // ENGENHARIA DE CONTROLE E AUTOMAÇÃO - São José dos Campos (antes: [1, 1, 1, 1, 1])
  319112: [2, 1, 1, 1, 2], // LETRAS - Itaquaquecetuba (antes: [1, 1, 1, 1, 1])
  319114: [2, 1, 2, 5, 3], // ENGENHARIA DE PRODUÇÃO - Registro (antes: [1, 1, 1, 1, 1])
  319115: [2, 1, 2, 2, 2], // QUÍMICA INDUSTRIAL - Suzano (antes: [1, 1, 1, 1, 1])
  319120: [3, 2, 1, 2, 3], // PEDAGOGIA - Jacareí (antes: [1, 1, 1, 1, 1])
  319122: [1, 1, 1, 1, 2], // PEDAGOGIA - Registro (antes: [1, 1, 1, 1, 1])
  319150: [1, 1, 2, 4, 2], // ENGENHARIA MECÂNICA - São José dos Campos (antes: [1, 1, 1, 1, 1])
  319153: [3, 2, 5, 5, 3], // ENGENHARIA DE CONTROLE E AUTOMAÇÃO - Hortolândia (antes: [1, 1, 1, 1, 1])
  319168: [1, 1, 1, 4, 2], // MATEMÁTICA - São José dos Campos (antes: [1, 1, 1, 1, 1])
  319178: [1, 1, 1, 4, 2], // QUÍMICA - São José dos Campos (antes: [1, 1, 1, 1, 1])
  319185: [1, 1, 1, 2, 2], // SISTEMAS DE INFORMAÇÃO - Votuporanga (antes: [1, 1, 1, 1, 1])
  319191: [2, 1, 2, 2, 2], // QUÍMICA - Suzano (antes: [1, 1, 1, 1, 1])
  319193: [1, 1, 2, 2, 1], // FÍSICA - Caraguatatuba (antes: [1, 1, 1, 1, 1])
  319195: [1, 1, 1, 2, 1], // MATEMÁTICA - Itaquaquecetuba (antes: [1, 1, 1, 1, 1])
  319199: [1, 1, 1, 3, 1], // MATEMÁTICA - Hortolândia (antes: [1, 1, 1, 1, 1])
  319211: [3, 1, 1, 3, 2], // ANÁLISE E DESENVOLVIMENTO DE SISTEMAS - Hortolândia (antes: [1, 1, 1, 1, 1])
  319212: [3, 2, 1, 1, 4], // PEDAGOGIA - Sorocaba (antes: [1, 1, 1, 1, 1])
  319218: [2, 1, 1, 2, 1], // ENGENHARIA DE SOFTWARE - São Carlos (antes: [1, 1, 1, 1, 1])
  319230: [2, 1, 1, 3, 2], // ENGENHARIA DE CONTROLE E AUTOMAÇÃO - Suzano (antes: [1, 1, 1, 1, 1])
  319231: [2, 1, 1, 2, 2], // ADMINISTRAÇÃO - Jacareí (antes: [1, 1, 1, 1, 1])
  319249: [1, 1, 1.5, 2, 1], // ENGENHARIA MECÂNICA - Itaquaquecetuba (antes: [1, 1, 1, 1, 1])
  319251: [1, 1, 2, 2, 1], // ENGENHARIA DE COMPUTAÇÃO - Guarulhos (antes: [1, 1, 1, 1, 1])
  319255: [2, 1, 1, 4, 2], // ANÁLISE E DESENVOLVIMENTO DE SISTEMAS - Caraguatatuba (antes: [1, 1, 1, 1, 1])
  319276: [1, 1, 2, 3, 1], // ANÁLISE E DESENVOLVIMENTO DE SISTEMAS - Jacareí (antes: [1, 1, 1, 1, 1])
  319277: [2, 1, 1, 2, 2], // GESTÃO DE RECURSOS HUMANOS - Sorocaba (antes: [1, 1, 1, 1, 1])
  319281: [1, 1, 2, 1, 1], // FÍSICA - Registro (antes: [1, 1, 1, 1, 1])
  319282: [2, 1, 1, 2, 2], // ADMINISTRAÇÃO - Suzano (antes: [1, 1, 1, 1, 1])
  319284: [1, 1, 2, 2, 1], // ENGENHARIA DE CONTROLE E AUTOMAÇÃO - Guarulhos (antes: [1, 1, 1, 1, 1])
  319285: [1, 1, 2, 1, 2], // CIÊNCIAS BIOLÓGICAS - Avaré (antes: [1, 1, 1, 1, 1])
  319287: [1, 1, 1, 2, 2], // ENGENHARIA ELÉTRICA - Votuporanga (antes: [1, 1, 1, 1, 1])
  319297: [1, 1, 1, 2, 1], // SISTEMAS DE INFORMAÇÃO - São Paulo (antes: [1, 1, 1, 1, 1])
  319300: [3, 2, 1, 4, 5], // PROCESSOS GERENCIAIS - Caraguatatuba (antes: [1, 1, 1, 1, 1])
};
// Pesos do IFSP comprovadamente errados no sisu-data (todos os 141 cursos do IFSP
// uniformemente [1,1,1,1,1], padrão de default da coleta). Os 34 valores abaixo foram
// lidos do termo de adesão oficial do IFSP ao Sisu 2025
// (processoseletivo.ifsp.edu.br/media/public/9/9l78z5fn5rx8o5v3yx2p0dpii/8t/8thpudl2rzefg6ccey70fb1td.pdf),
// com duas extrações independentes conferindo iguais e identidade
// campus+grau+turno confirmada curso a curso. Ordem: LC, CH, CN, MT, RED.
for (const o of ofertas.values()) {
  if (o.co in CORRECOES_PESOS_IFSP) o.p = CORRECOES_PESOS_IFSP[o.co];
}

// Só ofertas da edição mais nova (o catálogo do que dá para escolher agora), com ao menos uma nota de corte.
const lista = [...ofertas.values()].filter((o) => (o.co || o.cod) && Object.keys(o.c).length > 0)
  .sort((a, b) => a.uf.localeCompare(b.uf) || a.ies.localeCompare(b.ies) || a.curso.localeCompare(b.curso));
// Proveniência por ano: o que cada nota de corte é. Conferido = idêntico, oferta por oferta, ao relatório
// oficial da chamada regular (comparação refeita por testar-sisu.mjs a cada geração).
const cortes = oficial.size > 0 ? {
  "2020": "Igual à nota final da chamada regular 2020/1 (conferido com o relatório oficial do MEC)",
  "2021": "Última parcial coletada da API do Sisu (2021/1); não validado — não encontramos relatório oficial da edição 2021/1 (o disponível é de 2021/2, edição diferente)",
  "2022": "Igual à nota final da chamada regular 2022/1 (conferido com o relatório oficial do MEC)",
  "2023": "Igual à nota final da chamada regular 2023/1 (conferido com o relatório oficial do MEC)",
  "2024": "Igual à nota final da chamada regular (conferido com o relatório oficial do MEC)",
  "2025": "Igual à nota final da chamada regular (conferido com o relatório oficial do MEC; onde o relatório registra 0 não há nota de corte para mostrar)",
} : undefined;
const saida = {
  fonte: "Notas de corte e pesos do Sisu (MEC) coletados pelo projeto sisu-data (MIT): github.com/maiakanegae/sisu-data. As notas de corte foram conferidas com os relatórios oficiais do MEC (gov.br/mec/sisu); os pesos não constam nesses relatórios; vêm do sisu-data e estão sendo conferidos contra os termos de adesão oficiais de cada instituição — os do IFSP divergiam do termo oficial 2025 e foram corrigidos",
  gerado: new Date().toISOString().slice(0, 10),
  anos: ANOS,
  cortes,
  ofertas: lista,
};
fs.mkdirSync(path.join(process.cwd(), "public", "sisu"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "public", "sisu", "ofertas.json"), JSON.stringify(saida));
console.log(`ofertas no JSON: ${lista.length} (${(fs.statSync(path.join(process.cwd(), "public", "sisu", "ofertas.json")).size / 1e6).toFixed(1)} MB)`);

// ---- Ofertas do Sisu 2025 sem nota de corte nos dados consultados (2020–2025) ----
// O relatório oficial de 2025 registra 0 na ampla concorrência dessas ofertas (ninguém classificado pela
// nota) e elas não têm nenhuma nota de corte de 2020 a 2025 no catálogo. O ofertas.json exige ao menos um
// corte, então elas ficam fora dele; aqui viram um arquivo separado, só de aviso no simulador (sem média,
// sem estimativa), para não mudar o contrato do catálogo principal.
if (oficial.get(2025)) {
  const chave6o = (o) => [norm(o.sg), norm(o.cidade), norm(o.campus), norm(o.curso), norm(o.grau), norm(o.turno)].join("|");
  const noCatalogo = new Set(lista.map(chave6o));
  const codsNoCatalogo = new Set(lista.filter((o) => o.cod).map((o) => o.cod));
  const cosNoCatalogo = new Set(lista.filter((o) => o.co).map((o) => String(o.co))); // o scraping trunca nomes longos; o código cobre esse caso
  const semCorte = [];
  let comCorteFora = 0;
  for (const [k6, ls] of oficial.get(2025)) {
    for (const l of ls) {
      if (noCatalogo.has(k6) || codsNoCatalogo.has(l.cod) || cosNoCatalogo.has(l.cod)) continue;
      if (l.nota > 0) { comCorteFora++; continue; } // não devia acontecer: a etapa de completar cria essas ofertas
      semCorte.push({ curso: l.curso, grau: l.grau, turno: l.turno, campus: l.campus, cidade: l.cidade, uf: l.uf, ies: l.ies, sg: l.sg, v: l.v, cod: l.cod });
    }
  }
  if (comCorteFora) console.log(`aviso: ${comCorteFora} linhas oficiais de 2025 COM corte fora do catálogo (conferir)`);
  semCorte.sort((a, b) => a.uf.localeCompare(b.uf) || a.ies.localeCompare(b.ies) || a.curso.localeCompare(b.curso));
  const saidaSemCorte = {
    fonte: "Relatório oficial do MEC da chamada regular do Sisu 2025 (gov.br/mec/sisu): ofertas em que a ampla concorrência registrou nota 0 (sem classificado pela nota) e que não têm nota de corte de 2020 a 2025 nos dados consultados",
    gerado: new Date().toISOString().slice(0, 10),
    ano: 2025,
    ofertas: semCorte,
  };
  fs.writeFileSync(path.join(process.cwd(), "public", "sisu", "ofertas-sem-corte.json"), JSON.stringify(saidaSemCorte));
  console.log(`sem nota de corte 2020–2025: ${semCorte.length} ofertas (${semCorte.filter((o) => o.v > 0).length} com vagas na ampla em 2025, ${semCorte.filter((o) => o.v === 0).length} com 0 vagas)`);
}
