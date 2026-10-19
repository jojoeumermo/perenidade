// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Traz para o banco de questões as provas públicas que têm fonte aberta e estruturada, com gabarito:
//   - ENEM inteiro (2009 em diante), pela API aberta enem.dev (código aberto, MIT), que transcreve as provas do Inep;
//   - vestibulares da Unicamp (Comvest) e da USP (Fuvest), pelo conjunto aberto BLUEX (Almeida et al., 2023);
//   - o Exame de Ordem da OAB (1.ª fase, 2010 a 2018), pelo conjunto aberto oab_exams (Eduardo Garcia);
//   - ITA, IME e os anos da Fuvest (desde 1981) e da Unicamp que o BLUEX não tem, pelo Alvorada-Bench (licença MIT);
//   - olimpíadas de matemática (OBMEP e outras, por nível), pelo MATH-PT (licença MIT);
//   - saúde: Revalida (Inep) e as provas de residência do Enare, médica e multiprofissional, pelo HealthQA-BR (CC BY 4.0).
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

async function buscar(url, tentativas = 8) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      // Limite de pedidos do serviço (429): espera cada vez mais, até uns dois minutos no total.
      if (r.status === 429 && i < tentativas) {
        await new Promise((ok) => setTimeout(ok, 5000 * i));
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
async function linhasDoHf(dataset, split, config = "default") {
  const linhas = [];
  for (let offset = 0; ; offset += 100) {
    const pagina = await buscar(`${HF}?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${split}&offset=${offset}&length=100`);
    linhas.push(...(pagina.rows ?? []).map((r) => r.row));
    await new Promise((ok) => setTimeout(ok, 400));
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
/** Provas que o BLUEX já trouxe ("USP-2019"): o Alvorada-Bench não repete. */
const jaNoBluex = new Set();
async function bluex() {
  const porProva = new Map();
  for (const q of await linhasDoHf("portuguese-benchmark-datasets/BLUEX", "questions")) {
    if (q.alternatives_type !== "string" || !Array.isArray(q.alternatives) || q.alternatives.length < 2) continue;
    const [universidade, ano] = String(q.id).split("_");
    const resposta = "ABCDE".indexOf(String(q.answer).trim().toUpperCase());
    if (resposta < 0 || !ano) continue;
    const texto = limpar(desquebrar(q.question));
    const chave = `${universidade}-${ano}`;
    jaNoBluex.add(chave.toUpperCase());
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

/** LaTeX solto, sem $ (algumas questões do ITA e do IME vêm assim), vira texto legível: \frac{a}{b} → (a)/(b). */
const LETRAS_GREGAS = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", Sigma: "Σ", tau: "τ", phi: "φ", varphi: "φ", omega: "ω", Omega: "Ω" };
const SINAIS = { cdot: "·", times: "×", div: "÷", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", infty: "∞", pm: "±", in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩", to: "→", rightarrow: "→", Rightarrow: "⇒", Leftrightarrow: "⇔", ldots: "…", cdots: "…", circ: "°", angle: "∠", perp: "⊥", parallel: "∥" };
function semLatex(texto) {
  if (texto.includes("$") || !/\\[a-zA-Z]/.test(texto)) return texto;
  let t = texto;
  for (let i = 0; i < 6; i++) t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)").replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "($2)^(1/$1)").replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
  return t
    .replace(/\\(?:left|right|big|Big|bigg|Bigg)(\\[{}]|[()[\]|.])/g, (_, c) => (c === "." ? "" : c.replace("\\", "")))
    .replace(/\\mathbb\{R\}/g, "ℝ").replace(/\\mathbb\{N\}/g, "ℕ").replace(/\\mathbb\{Z\}/g, "ℤ").replace(/\\mathbb\{Q\}/g, "ℚ").replace(/\\mathbb\{C\}/g, "ℂ")
    .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, "$1")
    .replace(/\^\{?\\circ\}?/g, "°")
    .replace(/\\([a-zA-Z]+)/g, (_, nome) => LETRAS_GREGAS[nome] ?? SINAIS[nome] ?? nome)
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\([{}%])/g, "$1")
    .replace(/\^\{([^{}]*)\}/g, "^($1)")
    .replace(/_\{([^{}]*)\}/g, "_$1")
    .replace(/ {2,}/g, " ");
}

/** Alvorada-Bench: as matérias já vêm em português. */
const MATERIAS_PT = [
  [/portugu|ingl|espanh|literat|linguagens|artes/i, "linguagens"],
  [/hist|geogr|filos|sociol|humanas/i, "humanas"],
  [/biolog|f[ií]sica|qu[ií]mica|natureza/i, "natureza"],
  [/matem/i, "matematica"],
];
const areaDaMateria = (materia) => MATERIAS_PT.find(([r]) => r.test(String(materia ?? "")))?.[1] ?? "linguagens";
const NOMES_DAS_PROVAS = { fuvest: (ano) => `Fuvest (USP) ${ano}`, unicamp: (ano) => `Unicamp ${ano}`, ita: (ano) => `ITA ${ano}`, ime: (ano) => `IME ${ano}` };
const ORDEM_DAS_MATERIAS = ["Matemática", "Física", "Química", "Português", "Inglês", "Biologia", "História", "Geografia", "Filosofia", "Sociologia"];

async function alvorada() {
  // Se o BLUEX não respondeu nesta rodada, vale o que ele trouxe da última vez (para não repetir provas).
  if (!jaNoBluex.size) for (const p of antigo?.fontes?.find((f) => f.id === "vestibulares")?.provas ?? []) jaNoBluex.add(p.arquivo.replace(/\.json$/, "").toUpperCase());
  const porProva = new Map();
  for (const q of await linhasDoHf("HenriqueGodoy/Alvorada-bench", "train", "questions")) {
    const tipo = String(q.exam_type ?? "").toLowerCase();
    if (!NOMES_DAS_PROVAS[tipo]) continue;
    const ano = Number(/(\d{4})/.exec(String(q.exam_name))?.[1] ?? q.exam_year);
    if (!ano) continue;
    if ((tipo === "fuvest" && jaNoBluex.has(`USP-${ano}`)) || (tipo === "unicamp" && jaNoBluex.has(`UNICAMP-${ano}`))) continue;
    const opcoes = ["a", "b", "c", "d", "e"].map((l) => [l, String(q[`alternative_${l}`] ?? "").trim()]).filter(([, texto]) => texto);
    const resposta = opcoes.findIndex(([l]) => l === String(q.correct_answer ?? "").trim().toLowerCase());
    if (opcoes.length < 2 || resposta < 0) continue;
    const texto = limpar(semLatex(desquebrar(q.question_statement)));
    if (!texto) continue;
    const chave = `${tipo}-${ano}`;
    if (!porProva.has(chave)) porProva.set(chave, { tipo, ano, questoes: [] });
    porProva.get(chave).questoes.push({
      materia: String(q.subject ?? ""),
      numero: Number(q.question_number) || 0,
      area: areaDaMateria(q.subject),
      contexto: /\b(figura|gr[aá]fico|imagem|esquema|ilustra|charge|tirinha|quadrinho|mapa abaixo)/i.test(texto) ? `${texto}\n\n_[Esta questão pode ter figura na prova original.]_` : texto,
      alternativas: opcoes.map(([, a]) => limpar(semLatex(a)).replace(/^\(?[a-eA-E]\)\s*/, "")),
      resposta,
    });
  }
  const posicao = (m) => ORDEM_DAS_MATERIAS.indexOf(m) + 1 || 99;
  return [...porProva.values()]
    .sort((a, b) => b.ano - a.ano || a.tipo.localeCompare(b.tipo))
    .map((p) => ({
      ano: p.ano,
      titulo: NOMES_DAS_PROVAS[p.tipo](p.ano),
      arquivo: `vest-${p.tipo}-${p.ano}.json`,
      // O ITA vem por matéria, cada uma numerada do 1: aqui viram uma prova só, numerada em sequência.
      questoes: p.questoes
        .sort((a, b) => posicao(a.materia) - posicao(b.materia) || a.numero - b.numero)
        .map((q, i) => ({ id: `${p.tipo}-${p.ano}-${i + 1}`, n: i + 1, area: q.area, lingua: "", contexto: q.contexto, imagens: [], enunciado: "", alternativas: q.alternativas, resposta: q.resposta })),
    }));
}

/** MATH-PT: olimpíadas de matemática brasileiras (OBMEP e outras), separadas por nível. */
async function olimpiadas() {
  const porNivel = new Map();
  for (const q of await linhasDoHf("tiagoteixeira03/MATH-PT", "test", "ptbr_multiple_choice")) {
    const letras = Object.keys(q.choices ?? {}).filter((l) => String(q.choices[l] ?? "").trim()).sort();
    const resposta = letras.indexOf(String(q.answer ?? "").trim().toUpperCase());
    if (letras.length < 2 || resposta < 0 || !q.problem) continue;
    const nivel = Number(q.level) || 0;
    if (!porNivel.has(nivel)) porNivel.set(nivel, []);
    const lista = porNivel.get(nivel);
    lista.push({ id: `olimpiada-${nivel}-${lista.length + 1}`, n: lista.length + 1, area: "matematica", lingua: "", contexto: limpar(q.problem), imagens: [], enunciado: "", alternativas: letras.map((l) => limpar(q.choices[l])), resposta });
  }
  return [...porNivel.entries()].sort(([a], [b]) => a - b).map(([nivel, questoes]) => ({ ano: 0, titulo: `Olimpíadas de matemática · nível ${nivel}`, arquivo: `olimpiadas-nivel-${nivel}.json`, questoes }));
}

/** HealthQA-BR: Revalida por ano; Enare (residência médica e multiprofissional) por especialidade. */
const lesma = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
async function saude() {
  const provas = new Map();
  for (const q of await linhasDoHf("Larxel/healthqa-br", "train")) {
    const texto = String(q.question ?? "").replace(/\r\n?/g, "\n");
    // As alternativas vêm no fim do texto, uma por linha: 'A': 'texto'.
    const alternativas = [...texto.matchAll(/^'([A-E])':\s*'([\s\S]*?)'\s*$/gm)];
    if (alternativas.length < 2) continue;
    const resposta = alternativas.map((m) => m[1]).indexOf(String(q.answer ?? "").trim().toUpperCase());
    if (resposta < 0) continue;
    const enunciado = limpar(desquebrar(texto.slice(0, alternativas[0].index)));
    if (!enunciado) continue;
    const fonte = String(q.source ?? "");
    const ano = Number(q.year) || 0;
    const medica = /m[eé]dica/i.test(fonte);
    const grupo = String(q.group ?? "").trim() || "Geral";
    const chave = fonte === "Revalida" ? `revalida-${ano}` : `enare-${medica ? "medica" : "multi"}-${lesma(grupo)}`;
    if (!provas.has(chave)) {
      provas.set(chave, {
        ordem: fonte === "Revalida" ? 0 : medica ? 1 : 2,
        titulo: fonte === "Revalida" ? `Revalida ${ano}` : `Enare, residência ${medica ? "médica" : "multiprofissional"} · ${grupo}`,
        arquivo: `saude-${chave}.json`,
        ano: 0,
        questoes: [],
      });
    }
    const prova = provas.get(chave);
    prova.ano = Math.max(prova.ano, ano);
    prova.questoes.push({
      id: `saude-${chave}-${prova.questoes.length + 1}`,
      n: prova.questoes.length + 1,
      area: "saude",
      lingua: "",
      contexto: /\b(figura|imagem|radiografia abaixo|eletrocardiograma abaixo|foto)\b/i.test(enunciado) ? `${enunciado}\n\n_[Esta questão pode ter imagem na prova original.]_` : enunciado,
      imagens: [],
      enunciado: "",
      alternativas: alternativas.map((m) => limpar(m[2])),
      resposta,
    });
  }
  return [...provas.values()]
    .sort((a, b) => a.ordem - b.ordem || (a.ordem === 0 ? b.ano - a.ano : a.titulo.localeCompare(b.titulo, "pt")))
    .map((p) => ({ ano: p.ano, titulo: p.titulo, arquivo: p.arquivo, questoes: p.questoes }));
}

const FONTES = [
  { id: "enem", nome: "ENEM (Inep)", origem: "https://enem.dev", importar: enem },
  { id: "vestibulares", nome: "Vestibulares: Unicamp e Fuvest (USP)", origem: "https://huggingface.co/datasets/portuguese-benchmark-datasets/BLUEX", importar: bluex },
  { id: "vestibulares-mais", nome: "Vestibulares: ITA, IME e mais anos da Fuvest e da Unicamp", origem: "https://huggingface.co/datasets/HenriqueGodoy/Alvorada-bench", importar: alvorada },
  { id: "olimpiadas", nome: "Olimpíadas de matemática (OBMEP e outras)", origem: "https://huggingface.co/datasets/tiagoteixeira03/MATH-PT", importar: olimpiadas },
  { id: "saude", nome: "Saúde: Revalida e residências do Enare", origem: "https://huggingface.co/datasets/Larxel/healthqa-br", importar: saude },
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
