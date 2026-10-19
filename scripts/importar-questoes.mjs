// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Traz para o banco de questões as provas públicas que têm fonte aberta e estruturada. Hoje: o ENEM inteiro (2009 em
// diante), pela API aberta enem.dev (código aberto, MIT), que transcreve as provas públicas do Inep. Roda toda semana
// pela rotina do GitHub (.github/workflows/questoes.yml): prova nova que a API publicar entra sozinha.
//
// Grava um arquivo por prova em public/questoes/ (o site baixa só a prova que a pessoa abrir) e um índice. As imagens
// das questões não são copiadas: ficam como link para a fonte, aberto só quando a pessoa pede.
//
// Uso: node scripts/importar-questoes.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pasta = path.join(raiz, "public", "questoes");
const API = "https://api.enem.dev/v1";
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
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
}

async function prova(ano) {
  const questoes = [];
  for (let offset = 0; ; offset += 50) {
    const pagina = await buscar(`${API}/exams/${ano}/questions?limit=50&offset=${offset}`);
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

const provas = await buscar(`${API}/exams`);
fs.mkdirSync(pasta, { recursive: true });
const indice = { atualizado: new Date().toISOString().slice(0, 10), fontes: [{ id: "enem", nome: "ENEM (Inep)", origem: "https://enem.dev", provas: [] }] };
for (const p of provas.sort((a, b) => b.year - a.year)) {
  const questoes = await prova(p.year);
  if (!questoes.length) continue;
  const arquivo = `enem-${p.year}.json`;
  fs.writeFileSync(path.join(pasta, arquivo), `${JSON.stringify({ fonte: "ENEM", ano: p.year, questoes })}\n`);
  const porArea = {};
  for (const q of questoes) porArea[q.area] = (porArea[q.area] ?? 0) + 1;
  indice.fontes[0].provas.push({ ano: p.year, titulo: p.title, arquivo, total: questoes.length, porArea });
  console.log(`${p.title}: ${questoes.length} questões`);
}
// Só reescreve o índice (e muda a data) quando alguma prova mudou: semana sem novidade não vira registro novo.
const caminhoDoIndice = path.join(pasta, "indice.json");
const antigo = fs.existsSync(caminhoDoIndice) ? JSON.parse(fs.readFileSync(caminhoDoIndice, "utf8")) : null;
if (!antigo || JSON.stringify(antigo.fontes) !== JSON.stringify(indice.fontes)) fs.writeFileSync(caminhoDoIndice, `${JSON.stringify(indice, null, 1)}\n`);
console.log(`Total: ${indice.fontes[0].provas.reduce((n, p) => n + p.total, 0)} questões.`);
