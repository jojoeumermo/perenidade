// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere a aula por dentro (Etapa 4, pacote E4-03): as fatias da aula (lib/fatias.ts), o ponto de retomar
// (lib/posicao-da-aula.ts), a contagem de sílabas e o índice de leitura (lib/legibilidade.ts) e que a versão fácil
// ("<aula>.facil.md") nunca vira aula nem idioma: em lib/content.ts, em lib/pendencias.ts e no filtro do E4-02 em
// scripts/alvos-de-contagem.mjs (que este teste só confere, sem mexer).
//
// Uso: npm run testar:aula-viva
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { contarPalavras, fatiar, MAXIMO, MINIMO } from "../lib/fatias.ts";
import { apagarPonto, CHAVE_POSICAO, gravarPonto, linkDoPonto, lerPosicoes, MAX_AULAS, pontoDaAula, pontoValido } from "../lib/posicao-da-aula.ts";
import { contarFrases, contarSilabas, faixaDe, indiceDeLeitura, medirLeitura, nivelDaAula, textoParaMedir } from "../lib/legibilidade.ts";
import { eOriginal } from "../lib/content.ts";
import { lerPendencias } from "../lib/pendencias.ts";
import { alvosDasAulas } from "./alvos-de-contagem.mjs";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

class Memoria {
  constructor(d = {}) {
    this.d = { ...d };
  }
  getItem(k) {
    return k in this.d ? this.d[k] : null;
  }
  setItem(k, v) {
    this.d[k] = String(v);
  }
  removeItem(k) {
    delete this.d[k];
  }
}
globalThis.localStorage = new Memoria();

// ───────────── Fatias ─────────────

/** Um parágrafo de `n` palavras que começa com letras distintas (para a âncora de texto). */
const paragrafo = (n, semente) => `${semente} ${Array.from({ length: n - 1 }, (_, i) => `palavra${i % 7}`).join(" ")}.`;
const secao = (titulo, paragrafos, palavras) => `## ${titulo}\n\n${Array.from({ length: paragrafos }, (_, i) => paragrafo(palavras, `Comeco${titulo.replace(/\W/g, "")}${i}`)).join("\n\n")}`;

{
  const curta = `${secao("Um", 2, 100)}\n\n${secao("Dois", 2, 100)}`;
  const f = fatiar(curta);
  conferir("aula curta é uma fatia só", f.length === 1, JSON.stringify(f.map((x) => x.palavras)));
  conferir("aula curta começa no início", f[0]?.ancora.tipo === "inicio" && f[0].inicio === 0);
  conferir("minutos pela conta de 180 por minuto", f[0]?.minutos === Math.max(1, Math.ceil(contarPalavras(curta) / 180)));
}
{
  const vazia = fatiar("");
  conferir("texto vazio não tem fatia", vazia.length === 0);
}
{
  // Dez seções de 150 palavras (1500 no total): partes entre 540 e 900, quebradas em títulos.
  const md = Array.from({ length: 10 }, (_, i) => secao(`Secao ${i + 1}`, 1, 150)).join("\n\n");
  const f = fatiar(md);
  conferir("aula longa vira várias fatias", f.length >= 2, String(f.length));
  conferir("cada fatia entre 540 e 900 palavras", f.every((x) => x.palavras >= MINIMO && x.palavras <= MAXIMO), f.map((x) => x.palavras).join(","));
  conferir("fatias seguintes começam num título", f.slice(1).every((x) => x.ancora.tipo === "titulo"));
  conferir("fatias cobrem o texto sem buraco", f.every((x, i) => i === 0 || x.inicio >= f[i - 1].fim));
  conferir("título da fatia é o da primeira seção dela", f[1]?.titulo !== null && md.slice(f[1].inicio).startsWith(`## ${f[1].titulo}`));
  conferir("soma das palavras bate", f.reduce((s, x) => s + x.palavras, 0) === contarPalavras(md));
}
{
  // Sem títulos: 15 parágrafos de 100 palavras. Quebra entre parágrafos, nunca passando de 900.
  const md = Array.from({ length: 15 }, (_, i) => paragrafo(100, `Inicio${"abcdefghijklmno"[i]}xyz`)).join("\n\n");
  const f = fatiar(md);
  conferir("aula sem títulos é fatiada por parágrafo", f.length >= 2, String(f.length));
  conferir("sem títulos: cada fatia até 900 palavras", f.every((x) => x.palavras <= MAXIMO), f.map((x) => x.palavras).join(","));
  conferir("sem títulos: fatias de pelo menos 540 palavras", f.every((x) => x.palavras >= MINIMO), f.map((x) => x.palavras).join(","));
  conferir("sem títulos: âncora de texto", f.slice(1).every((x) => x.ancora.tipo === "texto" && x.ancora.texto.length >= 12));
}
{
  // Bloco de código com linha em branco e um "## " dentro não quebra a fatia nem conta como título.
  const codigo = "```python\n## isto não é título\n\nprint(1)\n```";
  const md = `${secao("A", 3, 200)}\n\n${codigo}\n\n${secao("B", 3, 200)}\n\n${secao("C", 2, 200)}`;
  const f = fatiar(md);
  const titulos = f.filter((x) => x.ancora.tipo === "titulo").map((x) => x.ancora.n);
  conferir("título dentro de bloco de código não conta", titulos.every((n) => n === 1 || n === 2), JSON.stringify(titulos));
  conferir("fatia não corta bloco de código", f.every((x) => (md.slice(x.inicio, x.fim).match(/```/g) ?? []).length % 2 === 0));
}
{
  // Última parte curta demais: junta com a anterior se a soma não passar de 1080.
  const md = `${secao("A", 1, 600)}\n\n${secao("B", 1, 200)}`;
  const f = fatiar(md);
  conferir("sobra curta junta com a anterior", f.length === 1, f.map((x) => x.palavras).join(","));
}

// ───────────── Retomar ─────────────

{
  conferir("sem nada guardado", pontoDaAula("t/a") === null && Object.keys(lerPosicoes()).length === 0);
  const p = gravarPonto("t/a", { parte: 2, paragrafo: 11, trecho: -1, em: 1000 });
  conferir("grava e lê o ponto", pontoDaAula("t/a")?.paragrafo === 11 && p?.parte === 2);
  conferir("forma errada não grava", gravarPonto("t/b", { parte: -1, paragrafo: 1, trecho: -1 }) === null && pontoDaAula("t/b") === null);
  conferir("forma errada: texto no lugar do número", gravarPonto("t/c", { parte: "1", paragrafo: 1, trecho: -1 }) === null);
  conferir("ponto válido", pontoValido({ parte: 0, paragrafo: 0, trecho: 3, em: 5 }) && !pontoValido({ parte: 0, paragrafo: 0, trecho: -2, em: 5 }) && !pontoValido(null) && !pontoValido([]));
  // Lixo guardado à mão: as entradas ruins somem na leitura, a boa fica.
  localStorage.setItem(CHAVE_POSICAO, JSON.stringify({ boa: { parte: 0, paragrafo: 3, trecho: -1, em: 9 }, ruim: { parte: "x" }, outra: 7 }));
  conferir("lê só o que tem a forma certa", Object.keys(lerPosicoes()).join() === "boa");
  localStorage.setItem(CHAVE_POSICAO, "{não é json");
  conferir("JSON quebrado vira vazio", Object.keys(lerPosicoes()).length === 0);
  localStorage.removeItem(CHAVE_POSICAO);
  for (let i = 0; i < MAX_AULAS + 5; i++) gravarPonto(`t/aula-${i}`, { parte: 0, paragrafo: i, trecho: -1, em: 10_000 + i });
  const todas = lerPosicoes();
  conferir("no máximo 100 aulas", Object.keys(todas).length === MAX_AULAS, String(Object.keys(todas).length));
  conferir("sai a mais antiga", !("t/aula-0" in todas) && !("t/aula-4" in todas) && "t/aula-5" in todas && `t/aula-${MAX_AULAS + 4}` in todas);
  apagarPonto("t/aula-5");
  conferir("apaga um ponto", pontoDaAula("t/aula-5") === null);
  conferir("link do ponto", linkDoPonto("/trilhas/x/y", { paragrafo: 12 }) === "/trilhas/x/y#p-12" && linkDoPonto("/trilhas/x/y#velho", null) === "/trilhas/x/y");
}

// ───────────── Sílabas e índice de leitura ─────────────

// Divisão silábica conferida à mão (a gramatical, a da escola).
const SILABAS = {
  casa: 2, escola: 3, trabalhador: 4, pão: 1, mãe: 1, saúde: 3, país: 2, brasil: 2, leitura: 3, aula: 2, pessoa: 3,
  poesia: 4, queijo: 2, guerra: 2, quando: 2, água: 2, lição: 2, lições: 2, educação: 4, comunidade: 5, ler: 1, é: 1,
  estudar: 3, rua: 2, dia: 2, coração: 3, cidadania: 5, democracia: 5, memória: 4, muito: 2, também: 2, noite: 2,
  caixa: 2, ainda: 3, rainha: 3, cair: 2, juiz: 2, ideia: 3, quinto: 2, história: 4, Trabalho: 3, LEITURA: 3,
};
for (const [palavra, n] of Object.entries(SILABAS)) conferir(`sílabas de "${palavra}"`, contarSilabas(palavra) === n, `${contarSilabas(palavra)} em vez de ${n}`);
conferir("sigla sem vogal conta uma", contarSilabas("CPF") === 1 && contarSilabas("2026") === 1);
conferir("frases", contarFrases("Uma frase. Outra frase! E mais uma?") === 3 && contarFrases("Título\nLinha de lista") === 2);
{
  // 5 palavras, 1 frase, 14 sílabas (a 1, e-du-ca-ção 4, trans-for-ma 3, a 1, co-mu-ni-da-de 5):
  // 248,835 − 1,015 × 5 − 84,6 × 2,8 = 6,88.
  const m = medirLeitura("A educação transforma a comunidade.");
  conferir("índice de frase de referência", m?.silabas === 14 && m?.palavras === 5 && Math.abs(m.indice - 6.9) < 0.05, JSON.stringify(m));
  // Frase curta de palavras curtas passa de 100: o índice fica em 100.
  conferir("índice tem teto 100", indiceDeLeitura("O menino viu a casa. A casa era azul.") === 100);
  conferir("índice tem piso 0", indiceDeLeitura("A constitucionalização das prerrogativas institucionais pressupõe a interdependência hermenêutica dos dispositivos normativos infraconstitucionais.") === 0);
  conferir("texto vazio", indiceDeLeitura("") === 0 && medirLeitura("  ") === null);
  conferir("faixas", faixaDe(80) === "muito-facil" && faixaDe(60) === "facil" && faixaDe(30) === "dificil" && faixaDe(10) === "muito-dificil");
  conferir("nível da aula", nivelDaAula(55) === "facil" && nivelDaAula(40) === "media" && nivelDaAula(20) === "dificil");
  const medir = textoParaMedir("## Título\n\nUm texto curto. Outro.\n\n```js\nnao conta\n```\n\n- item de lista");
  conferir("texto para medir: sem código, cada linha fecha frase", !medir.includes("nao conta") && contarFrases(medir) === 4, JSON.stringify(medir));
}

// ───────────── A versão fácil não vira aula nem idioma ─────────────

conferir("content.ts: aula é original", eOriginal("03-fracoes.md") && eOriginal("fracoes.md"));
conferir("content.ts: tradução não", !eOriginal("fracoes.en.md"));
conferir("content.ts: versão fácil não", !eOriginal("fracoes.facil.md") && !eOriginal("03-fracoes.facil.md") && !eOriginal("fracoes.facil.en.md"));
{
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "aula-viva-"));
  try {
    const trilha = path.join(raiz, "content", "trilhas", "teste");
    fs.mkdirSync(trilha, { recursive: true });
    fs.mkdirSync(path.join(raiz, "content", "exercicios"), { recursive: true });
    fs.writeFileSync(path.join(trilha, "_trilha.md"), "---\ntitulo: Teste\narea: matematica\netapa: fundamental\nresumo: x\n---\n");
    fs.writeFileSync(path.join(trilha, "01-aula.md"), "---\ntitulo: Aula\nresumo: x\n---\nTexto.\n");
    fs.writeFileSync(path.join(trilha, "01-aula.facil.md"), "Texto fácil.\n");
    fs.writeFileSync(path.join(trilha, "01-aula.facil.en.md"), "Easy text.\n");
    fs.writeFileSync(path.join(trilha, "01-aula.en.md"), "---\ntitulo: Lesson\n---\nText.\n");
    const pendentes = lerPendencias(raiz).aulas.map((a) => `${a.trilha}/${a.aula}`);
    conferir("pendencias.ts ignora a versão fácil", pendentes.length === 1 && pendentes[0] === "teste/aula", JSON.stringify(pendentes));
    const alvos = alvosDasAulas(path.join(raiz, "content"));
    conferir("alvos-de-contagem (E4-02) ignora a versão fácil", alvos.length === 1 && alvos[0] === "teste/aula", JSON.stringify(alvos));
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
}
// O filtro tem de estar escrito, e não só funcionar por acaso da expressão do nome: se alguém afrouxar a expressão, a
// versão fácil não pode virar aula.
const fonteDosAlvos = fs.readFileSync(path.join(import.meta.dirname, "alvos-de-contagem.mjs"), "utf8");
conferir("alvos-de-contagem tem o filtro de .facil.md (E4-02)", /facil/.test(fonteDosAlvos), "o E4-02 ainda não pôs o filtro");

if (falhas.length) {
  console.error(`Aula por dentro: ${falhas.length} falha(s), ${ok} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Aula por dentro: ${ok} conferências certas.`);
