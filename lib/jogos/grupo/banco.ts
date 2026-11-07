// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O banco dos jogos em grupo: tudo vem do conteúdo que o site já tem. Os exercícios das aulas (content/exercicios, por
// disciplina), o glossário, as frases do "Quem disse?", as checagens, os cartões de debate e as datas do "Neste dia".
// Nenhuma pergunta é inventada aqui; estas funções só sorteiam, embaralham as alternativas e escondem a resposta do texto.
// Puro (sem "@/"): roda no teste em Node.
import { embaralhar, mascarar, palavrasParaLetras, primeiraFrase, type Sorteio, type Verbete } from "../base";

/** Uma pergunta de escolha, já com as alternativas embaralhadas. */
export interface Pergunta {
  enunciado: string;
  opcoes: string[];
  certa: number;
  /** Por que a certa é a certa (aparece depois da revelação). */
  explicacao?: string;
  /** De onde veio (a aula, a checagem, a fonte da frase). */
  fonte?: string;
  aula?: { titulo: string; href: string };
}

/** Uma questão do banco de uma disciplina, como a rota /api/jogos-em-grupo/<área> entrega (só as de escolha). */
export interface QuestaoDoBanco {
  enunciado: string;
  alternativas: string[];
  certa: number;
  explicacao: string;
  fonte: string;
  aula?: { titulo: string; href: string };
}

export interface FraseParaJogo {
  texto: string;
  autor: string;
  fonte: string;
}

export interface ChecagemDoJogo {
  alegacao: string;
  veredito: string;
  titulo: string;
  slug: string;
}

export interface FatoComAno {
  ano: number;
  texto: string;
}

export interface TemaDeDebate {
  slug: string;
  afirmacao: string;
  resposta: string;
  fontes: { titulo: string; url?: string }[];
}

/** Uma carta de história: o ano fica escondido até a revelação. */
export interface CartaDaHistoria {
  ano: number;
  texto: string;
}

export interface PalavraDaForca {
  /** A-Z, sem acento. */
  palavra: string;
  termo: string;
  dica: string;
  aula?: { titulo: string; href: string };
}

export interface ConceitoDoBingo {
  termo: string;
  /** A definição, com o termo escondido ("____"). */
  definicao: string;
}

/** Tira negrito, itálico e links de Markdown ("[aula](/x)" vira "aula"). */
export const semMarkdown = (texto: string): string =>
  texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Embaralha as alternativas de uma questão e devolve onde a certa foi parar. */
export function embaralharAlternativas(alternativas: readonly string[], certa: number, rnd: Sorteio): { opcoes: string[]; certa: number } {
  const ordem = embaralhar(
    alternativas.map((_, i) => i),
    rnd,
  );
  return { opcoes: ordem.map((i) => alternativas[i]), certa: ordem.indexOf(certa) };
}

/** As perguntas de uma disciplina (exercícios das aulas). */
export function perguntasDoBanco(questoes: readonly QuestaoDoBanco[], n: number, rnd: Sorteio): Pergunta[] {
  return embaralhar(
    questoes.filter((q) => q.alternativas.length >= 2 && q.certa >= 0 && q.certa < q.alternativas.length),
    rnd,
  )
    .slice(0, n)
    .map((q) => ({ enunciado: q.enunciado, ...embaralharAlternativas(q.alternativas, q.certa, rnd), explicacao: q.explicacao, fonte: q.fonte, aula: q.aula }));
}

/** "Qual é o termo?": a definição do glossário (com o termo escondido) e quatro termos para escolher. */
export function perguntasDoGlossario(verbetes: readonly Verbete[], n: number, rnd: Sorteio): Pergunta[] {
  // Fica fora o verbete cuja definição, mesmo mascarada, ainda traz o termo escrito (termos de duas palavras).
  const bons = verbetes.filter((v) => v.termo.length <= 40 && !mascarar(primeiraFrase(v.resumo, 220), v.termo).toLowerCase().includes(v.termo.toLowerCase()));
  const escolhidos = embaralhar(bons, rnd).slice(0, n);
  return escolhidos.map((v) => {
    const outros = embaralhar(
      bons.filter((x) => x.termo.toLowerCase() !== v.termo.toLowerCase()),
      rnd,
    )
      .slice(0, 3)
      .map((x) => x.termo);
    const { opcoes, certa } = embaralharAlternativas([v.termo, ...outros], 0, rnd);
    return {
      enunciado: `Que termo é este? “${mascarar(primeiraFrase(v.resumo, 220), v.termo)}”`,
      opcoes,
      certa,
      explicacao: `${v.termo}: ${primeiraFrase(v.resumo, 220)}`,
      fonte: "Glossário do Instituto Lúcia",
      aula: v.aula,
    };
  });
}

/** "Quem disse?": a frase e quatro autores (o certo e três outros do mesmo arquivo). */
export function perguntasDeFrases(frases: readonly FraseParaJogo[], n: number, rnd: Sorteio): Pergunta[] {
  const autores = [...new Set(frases.map((f) => f.autor))];
  if (autores.length < 4) return [];
  return embaralhar(
    frases.filter((f) => f.texto.length <= 320),
    rnd,
  )
    .slice(0, n)
    .map((f) => {
      const outros = embaralhar(
        autores.filter((a) => a !== f.autor),
        rnd,
      ).slice(0, 3);
      const { opcoes, certa } = embaralharAlternativas([f.autor, ...outros], 0, rnd);
      return { enunciado: `Quem disse? “${f.texto}”`, opcoes, certa, explicacao: `${f.autor}, ${f.fonte}.`, fonte: f.fonte };
    });
}

/** As três respostas do "Fato ou boato? em roda", na ordem em que aparecem. */
export const OPCOES_DA_CHECAGEM = ["É fato", "É boato", "É enganoso"] as const;

function classe(veredito: string): 0 | 1 | 2 | -1 {
  const v = veredito.trim().toLowerCase();
  if (v === "verdadeiro" || v === "fato") return 0;
  if (v === "falso") return 1;
  if (v === "enganoso") return 2;
  return -1;
}

/** Cada checagem do site vira uma pergunta: a alegação, e a turma decide se é fato, boato ou enganosa. */
export function perguntasDeChecagens(checagens: readonly ChecagemDoJogo[], n: number, rnd: Sorteio): Pergunta[] {
  return embaralhar(
    checagens.filter((c) => classe(c.veredito) >= 0),
    rnd,
  )
    .slice(0, n)
    .map((c) => ({
      enunciado: `“${c.alegacao}”`,
      opcoes: [...OPCOES_DA_CHECAGEM],
      certa: classe(c.veredito),
      explicacao: `Veredito da checagem: ${c.veredito}. ${c.titulo}`,
      fonte: "Checagens do Instituto Lúcia",
      aula: { titulo: c.titulo, href: `/checagens#${c.slug}` },
    }));
}

/** As cartas do "Fio da história": anos diferentes entre si (para a ordem não ter empate), texto sem Markdown. */
export function cartasDaHistoria(fatos: readonly FatoComAno[], n: number, rnd: Sorteio): CartaDaHistoria[] {
  const usados = new Set<number>();
  const cartas: CartaDaHistoria[] = [];
  for (const f of embaralhar(fatos, rnd)) {
    if (!Number.isInteger(f.ano) || usados.has(f.ano)) continue;
    const texto = semMarkdown(f.texto);
    if (texto.length < 20 || texto.length > 300) continue;
    usados.add(f.ano);
    cartas.push({ ano: f.ano, texto });
    if (cartas.length === n) break;
  }
  return cartas;
}

/** As palavras da forca coletiva: uma palavra só, de 5 a 12 letras, com a dica tirada da definição. */
export function palavrasDaForca(verbetes: readonly Verbete[], n: number, rnd: Sorteio): PalavraDaForca[] {
  return embaralhar(palavrasParaLetras(verbetes, 5, 12), rnd)
    .slice(0, n)
    .map((p) => ({ palavra: p.palavra, termo: p.termo, dica: mascarar(primeiraFrase(p.resumo, 180), p.termo), aula: p.aula }));
}

/** Os conceitos do bingo: termos curtos (cabem na cartela), sem repetir. */
export function conceitosDoBingo(verbetes: readonly Verbete[], n: number, rnd: Sorteio): ConceitoDoBingo[] {
  const vistos = new Set<string>();
  const saida: ConceitoDoBingo[] = [];
  for (const v of embaralhar(verbetes, rnd)) {
    const chave = v.termo.toLowerCase();
    if (v.termo.length > 18 || vistos.has(chave)) continue;
    const definicao = mascarar(primeiraFrase(v.resumo, 200), v.termo);
    if (!definicao.includes("____") && definicao.toLowerCase().includes(chave)) continue; // a definição entregaria o termo
    vistos.add(chave);
    saida.push({ termo: v.termo, definicao });
    if (saida.length === n) break;
  }
  return saida;
}
