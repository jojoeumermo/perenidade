// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import { parseFrontmatter } from "./frontmatter";
import { type MapaDaAula, type MapaDaTrilha, validarMapa } from "./mapa-curricular";

// O que as páginas para professores leem de content/: o mapa curricular (content/curriculo/<trilha>.yml), o guia
// (content/professores/guia.md) e os planos de aula (content/professores/planos/<plano>.md). Só no servidor.

const RAIZ = path.join(process.cwd(), "content");
const producao = process.env.NODE_ENV === "production";

let mapas: Map<string, MapaDaTrilha> | null = null;
export function todosOsMapas(): Map<string, MapaDaTrilha> {
  if (mapas && producao) return mapas;
  const pasta = path.join(RAIZ, "curriculo");
  const lidos = new Map<string, MapaDaTrilha>();
  if (fs.existsSync(pasta))
    for (const nome of fs.readdirSync(pasta).filter((n) => n.endsWith(".yml")))
      lidos.set(nome.slice(0, -4), validarMapa(load(fs.readFileSync(path.join(pasta, nome), "utf8"), { schema: CORE_SCHEMA }), `content/curriculo/${nome}`));
  mapas = lidos;
  return lidos;
}

export function mapaDaAula(trilha: string, aula: string): MapaDaAula | null {
  const m = todosOsMapas().get(trilha)?.aulas[aula];
  return m && (m.bncc.length || m.enem.length) ? m : null;
}

export interface PlanoDeAula {
  slug: string;
  titulo: string;
  resumo: string;
  trilha: string;
  /** Slugs das aulas do site usadas no plano, na ordem. */
  aulas: string[];
  duracao: string;
  publico: string;
  corpo: string;
}

function texto(dado: Record<string, unknown>, chave: string, arquivo: string): string {
  const v = dado[chave];
  if (typeof v !== "string" || !v.trim()) throw new Error(`Conteúdo inválido em ${arquivo}: o campo "${chave}" é obrigatório`);
  return v.trim();
}

let planos: PlanoDeAula[] | null = null;
export function planosDeAula(): PlanoDeAula[] {
  if (planos && producao) return planos;
  const pasta = path.join(RAIZ, "professores", "planos");
  const lidos: PlanoDeAula[] = [];
  if (fs.existsSync(pasta))
    for (const nome of fs.readdirSync(pasta).filter((n) => /^[a-z0-9-]+\.md$/.test(n))) {
      const arquivo = `content/professores/planos/${nome}`;
      const { data, content } = parseFrontmatter(fs.readFileSync(path.join(pasta, nome), "utf8"));
      if (!Array.isArray(data.aulas) || data.aulas.length === 0) throw new Error(`Conteúdo inválido em ${arquivo}: "aulas" lista as aulas do site usadas no plano`);
      lidos.push({
        slug: nome.slice(0, -3),
        titulo: texto(data, "titulo", arquivo),
        resumo: texto(data, "resumo", arquivo),
        trilha: texto(data, "trilha", arquivo),
        aulas: data.aulas.map(String),
        duracao: texto(data, "duracao", arquivo),
        publico: texto(data, "publico", arquivo),
        corpo: content.trim(),
      });
    }
  planos = lidos.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
  return planos;
}

export function guiaDoProfessor(): { titulo: string; resumo: string; corpo: string } {
  const arquivo = path.join(RAIZ, "professores", "guia.md");
  const { data, content } = parseFrontmatter(fs.readFileSync(arquivo, "utf8"));
  return { titulo: texto(data, "titulo", "content/professores/guia.md"), resumo: texto(data, "resumo", "content/professores/guia.md"), corpo: content.trim() };
}
