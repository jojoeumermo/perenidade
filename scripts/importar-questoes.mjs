// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Traz para o banco de questões as provas públicas que têm fonte aberta e estruturada, com gabarito:
//   - ENEM inteiro (2009 em diante), pela API aberta enem.dev (código aberto, MIT), que transcreve as provas do Inep;
//   - vestibulares da Unicamp (Comvest) e da USP (Fuvest), pelo conjunto aberto BLUEX (Almeida et al., 2023);
//   - o Exame de Ordem da OAB (1.ª fase, 2010 a 2018), pelo conjunto aberto oab_exams (Eduardo Garcia).
// Roda toda semana pela rotina do GitHub (.github/workflows/questoes.yml): prova nova que a fonte publicar entra sozinha.
// Se uma fonte estiver fora do ar, ficam as provas que já tínhamos dela.
//
// Grava um arquivo por prova em public/questoes/ (o site baixa só a prova que a pessoa abrir) e um índice. As imagens
// das questões não são copiadas: no ENEM ficam como link para a fonte; nos outros, a questão avisa que tem imagem.
//
// Uso: node scripts/importar-questoes.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pasta = path.join(raiz, "public", "questoes");
const ENEM = "https://api.enem.dev/v1";
const HF = "https://datasets-server.huggingface.co/rows";
const AREAS = { linguagens: "linguagens", "ciencias-humanas": "humanas", "ciencias-natureza": "natureza", matematica: "matematica" };

async function buscar(url, tentativas = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (r.status === 429 && i < tentativas) {
        await new Promise((ok) => setTimeout(ok, 3000 * i));
        continue;
      }
      if (!r.ok) throw new Error(`${r.status} em ${url}`);
      return await r.json();
    } catch (erro) {
      if (i >= tentativas) throw erro;
      await new Promise((ok) => setTimeout(ok, 1500 * i));
    }
  }
}

/** Só texto e Markdown simples: sem HTML, imagens viram link para a fonte (aberto só se a pessoa quiser). */
function limpar(texto) {
  return String(texto ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g, (_, url) => (/broken-image/.test(url) ? "[imagem da prova]" : `[🖼 imagem da questão](${url})`))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[imagem da prova]")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
}

/** Linhas quebradas no meio da frase (o texto veio de PDF): junta, mas mantém os parágrafos. */
const desquebrar = (t) => String(t ?? "").replace(/[ \t]+\n(?!\n)/g, " ").replace(/([^\n.:;!?])\n(?=[a-zà-ú(])/g, "$1 ").replace(/ {2,}/g, " ");

/** Todas as linhas de um conjunto aberto do Hugging Face, de cem em cem. */
async function linhasDoHf(dataset, split) {
  const linhas = [];
  for (let offset = 0; ; offset += 100) {
    const pagina = await buscar(`${HF}?dataset=${encodeURIComponent(dataset)}&config=default&split=${split}&offset=${offset}&length=100`);
    linhas.push(...(pagina.rows ?? []).map((r) => r.row));
    if (!pagina.rows?.length || linhas.length >= (pagina.num_rows_total ?? 0)) break;
  }
  return linhas;
}

async function provaDoEnem(ano) {
  const questoes = [];
  for (let offset = 0; ; offset += 50) {
    const pagina = await buscar(`${ENEM}/exams/${ano}/questions?limit=50&offset=${offset}`);
    for (const q of pagina.questions ?? []) {
      const alternativas = (q.alternatives ?? []).map((a) => (a.file ? `${limpar(a.text)} [🖼 imagem da alternativa](${a.file})`.trim() : limpar(a.text)));
      const resposta = (q.alternatives ?? []).findIndex((a) => a.isCorrect);
      if (alternativas.length < 2 || resposta < 0) continue;
      questoes.push({
        id: `enem-${ano}-${q.index}${q.language ? `-${q.language}` : ""}`,
        n: q.index,
        area: AREAS[q.discipline] ?? q.discipline,
        lingua: q.language ?? "",
        contexto: limpar(q.context),
        imagens: (q.files ?? []).filter((f) => /^https:\/\//.test(f)).slice(0, 6),
        enunciado: limpar(q.alternativesIntroduction),
        alternativas,
        resposta,
      });
    }
    if (!pagina.metadata?.hasMore) break;
  }
  return questoes;
}

async function enem() {
  const provas = [];
  for (const p of (await buscar(`${ENEM}/exams`)).sort((a, b) => b.year - a.year)) {
    const questoes = await provaDoEnem(p.year);
    if (questoes.length) provas.push({ ano: p.year, titulo: p.title, arquivo: `enem-${p.year}.json`, questoes });
  }
  return provas;
}

/** BLUEX: as matérias em inglês viram as quatro áreas do ENEM, para filtrar do mesmo jeito. */
const MATERIAS = {
  portuguese: "linguagens", english: "linguagens", spanish: "linguagens", arts: "linguagens", literature: "linguagens",
  history: "humanas", geography: "humanas", philosophy: "humanas", sociology: "humanas",
  biology: "natureza", chemistry: "natureza", physics: "natureza",
  mathematics: "matematica",
};
async function bluex() {
  const porProva = new Map();
  for (const q of await linhasDoHf("portuguese-benchmark-datasets/BLUEX", "questions")) {
    if (q.alternatives_type !== "string" || !Array.isArray(q.alternatives) || q.alternatives.length < 2) continue;
    const [universidade, ano] = String(q.id).split("_");
    const resposta = "ABCDE".indexOf(String(q.answer).trim().toUpperCase());
    if (resposta < 0 || !ano) continue;
    const texto = limpar(desquebrar(q.question));
    const chave = `${universidade}-${ano}`;
    if (!porProva.has(chave)) porProva.set(chave, { universidade, ano: Number(ano), questoes: [] });
    porProva.get(chave).questoes.push({
      id: `${universidade.toLowerCase()}-${ano}-${q.number}`,
      n: q.number,
      area: MATERIAS[q.subject?.[0]] ?? "linguagens",
      lingua: "",
      contexto: q.has_associated_images ? `${texto}\n\n_[Esta questão tem imagem na prova original.]_` : texto,
      imagens: [],
      enunciado: "",
      alternativas: q.alternatives.map((a) => limpar(desquebrar(a)).replace(/^\(?[a-eA-E]\)\s*/, "")),
      resposta,
    });
  }
  return [...porProva.values()]
    .sort((a, b) => b.ano - a.ano || a.universidade.localeCompare(b.universidade))
    .map((p) => ({
      ano: p.ano,
      titulo: p.universidade === "USP" ? `Fuvest (USP) ${p.ano}` : `Unicamp ${p.ano}`,
      arquivo: `${p.universidade.toLowerCase()}-${p.ano}.json`,
      questoes: p.questoes.sort((a, b) => a.n - b.n),
    }));
}

async function oab() {
  const porProva = new Map();
  for (const q of await linhasDoHf("eduagarcia/oab_exams", "train")) {
    if (q.nullified) continue;
    const resposta = (q.choices?.label ?? []).indexOf(q.answerKey);
    if (resposta < 0) continue;
    if (!porProva.has(q.exam_id)) porProva.set(q.exam_id, []);
    porProva.get(q.exam_id).push({
      id: `oab-${q.exam_id}-${q.question_number}`,
      n: q.question_number,
      area: "direito",
      lingua: "",
      contexto: "",
      imagens: [],
      enunciado: limpar(q.question),
      alternativas: q.choices.text.map(limpar),
      resposta,
    });
  }
  return [...porProva.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([exame, questoes]) => {
      const [ano, edicao] = exame.split("-");
      return { ano: Number(ano), titulo: `OAB ${ano}, ${Number(edicao)}.º exame (1.ª fase)`, arquivo: `oab-${exame}.json`, questoes: questoes.sort((a, b) => a.n - b.n) };
    });
}

const FONTES = [
  { id: "enem", nome: "ENEM (Inep)", origem: "https://enem.dev", importar: enem },
  { id: "vestibulares", nome: "Vestibulares: Unicamp e Fuvest (USP)", origem: "https://huggingface.co/datasets/portuguese-benchmark-datasets/BLUEX", importar: bluex },
  { id: "oab", nome: "OAB: Exame de Ordem (1.ª fase)", origem: "https://huggingface.co/datasets/eduagarcia/oab_exams", importar: oab },
];

fs.mkdirSync(pasta, { recursive: true });
const caminhoDoIndice = path.join(pasta, "indice.json");
const antigo = fs.existsSync(caminhoDoIndice) ? JSON.parse(fs.readFileSync(caminhoDoIndice, "utf8")) : null;
const indice = { atualizado: new Date().toISOString().slice(0, 10), fontes: [] };
for (const { importar, ...fonte } of FONTES) {
  try {
    const provas = [];
    for (const p of await importar()) {
      fs.writeFileSync(path.join(pasta, p.arquivo), `${JSON.stringify({ fonte: fonte.id === "enem" ? "ENEM" : fonte.nome, ano: p.ano, questoes: p.questoes })}\n`);
      const porArea = {};
      for (const q of p.questoes) porArea[q.area] = (porArea[q.area] ?? 0) + 1;
      provas.push({ ano: p.ano, titulo: p.titulo, arquivo: p.arquivo, total: p.questoes.length, porArea });
    }
    indice.fontes.push({ ...fonte, provas });
    console.log(`${fonte.nome}: ${provas.length} provas, ${provas.reduce((n, p) => n + p.total, 0)} questões`);
  } catch (erro) {
    const anterior = antigo?.fontes?.find((f) => f.id === fonte.id);
    if (anterior) indice.fontes.push(anterior);
    console.warn(`${fonte.nome}: fonte indisponível (${erro.message}); ficam as provas que já tínhamos.`);
  }
}
// Só reescreve o índice (e muda a data) quando alguma prova mudou: semana sem novidade não vira registro novo.
if (!antigo || JSON.stringify(antigo.fontes) !== JSON.stringify(indice.fontes)) fs.writeFileSync(caminhoDoIndice, `${JSON.stringify(indice, null, 1)}\n`);
console.log(`Total: ${indice.fontes.reduce((n, f) => n + f.provas.reduce((m, p) => m + p.total, 0), 0)} questões.`);
