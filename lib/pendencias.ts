// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As pendências de revisão: que aulas ainda esperam revisão, o que falta a cada uma para seguir o modelo de aula e
// que exercícios ainda estão "em revisão". Lê os arquivos de content/ direto, sem passar pelo site; serve ao roteiro
// `npm run pendencias` e à página de pendências que só existe em desenvolvimento (/revisao-pendente).
// Sem os atalhos "@/" de propósito: o roteiro roda este arquivo direto no Node.

import fs from "node:fs";
import path from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import { validarExercicios } from "./exercicios";
import { parseFrontmatter } from "./frontmatter";
import { conferirModelo, conferirSecoesDoEnem, lerRevisoes, type ParteDoModelo, type Revisao, type SecaoDoEnem } from "./modelo-de-aula";

export interface AulaPendente {
  trilha: string;
  aula: string;
  titulo: string;
  area: string;
  /** "revisada" (com histórico), "aprovada" (revisada: true, vinda do painel) ou "em-revisao". */
  situacao: "revisada" | "aprovada" | "em-revisao";
  revisoes: Revisao[];
  faltam: ParteDoModelo[];
  /** Nas aulas do percurso ENEM: as seções a mais que faltam ("Como isso cai no ENEM", questão comentada, "Para aprofundar"). */
  faltamEnem: SecaoDoEnem[];
  exercicios: number;
  exerciciosEmRevisao: number;
}

export interface Pendencias {
  aulas: AulaPendente[];
  exercicios: number;
  exerciciosEmRevisao: number;
  /** Problemas de formato (campo "revisoes" ou arquivo de exercícios inválido): estes sim precisam de correção. */
  erros: string[];
}

export function lerPendencias(raiz = process.cwd()): Pendencias {
  const pastaDasTrilhas = path.join(raiz, "content", "trilhas");
  const pastaDosExercicios = path.join(raiz, "content", "exercicios");
  const erros: string[] = [];
  const contagem = new Map<string, { total: number; emRevisao: number }>();
  let exercicios = 0;
  let exerciciosEmRevisao = 0;
  if (fs.existsSync(pastaDosExercicios)) {
    for (const trilha of fs.readdirSync(pastaDosExercicios, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      for (const nome of fs.readdirSync(path.join(pastaDosExercicios, trilha.name)).filter((n) => n.endsWith(".yml"))) {
        const arquivo = `content/exercicios/${trilha.name}/${nome}`;
        try {
          const lista = validarExercicios(load(fs.readFileSync(path.join(raiz, arquivo), "utf8"), { schema: CORE_SCHEMA }), arquivo);
          const emRevisao = lista.filter((ex) => ex.revisao.status === "em-revisao").length;
          contagem.set(`${trilha.name}/${nome.slice(0, -4)}`, { total: lista.length, emRevisao });
          exercicios += lista.length;
          exerciciosEmRevisao += emRevisao;
        } catch (erro) {
          erros.push((erro as Error).message);
        }
      }
    }
  }

  const aulas: AulaPendente[] = [];
  for (const trilha of fs.readdirSync(pastaDasTrilhas, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const base = path.join(pastaDasTrilhas, trilha.name);
    const cabecalho = fs.existsSync(path.join(base, "_trilha.md")) ? parseFrontmatter(fs.readFileSync(path.join(base, "_trilha.md"), "utf8")).data : {};
    if (cabecalho.ativo === false) continue;
    for (const nome of fs.readdirSync(base)) {
      const achado = /^(?:\d+-)?([a-z0-9-]+)\.md$/.exec(nome);
      if (!achado || nome === "_trilha.md" || /\.[a-z]{2}\.md$/.test(nome)) continue;
      const arquivo = `content/trilhas/${trilha.name}/${nome}`;
      const { data, content } = parseFrontmatter(fs.readFileSync(path.join(base, nome), "utf8"));
      if (data.ativo === false) continue;
      let revisoes: Revisao[] = [];
      try {
        revisoes = lerRevisoes(data.revisoes, arquivo);
      } catch (erro) {
        erros.push((erro as Error).message);
      }
      const aula = achado[1];
      const ex = contagem.get(`${trilha.name}/${aula}`) ?? { total: 0, emRevisao: 0 };
      const modelo = conferirModelo({ corpo: content, quiz: Array.isArray(data.quiz) ? data.quiz.length : 0, fontes: Array.isArray(data.fontes) ? data.fontes.length : 0, exercicios: ex.total });
      aulas.push({
        trilha: trilha.name,
        aula,
        titulo: typeof data.titulo === "string" ? data.titulo : aula,
        area: typeof cabecalho.area === "string" ? cabecalho.area : "",
        situacao: revisoes.length ? "revisada" : data.revisada === true ? "aprovada" : "em-revisao",
        revisoes,
        faltam: modelo.filter((m) => !m.ok).map((m) => m.parte),
        faltamEnem: conferirSecoesDoEnem(trilha.name, content, aula),
        exercicios: ex.total,
        exerciciosEmRevisao: ex.emRevisao,
      });
    }
  }
  aulas.sort((a, b) => a.area.localeCompare(b.area) || a.trilha.localeCompare(b.trilha) || a.aula.localeCompare(b.aula));
  return { aulas, exercicios, exerciciosEmRevisao, erros };
}
