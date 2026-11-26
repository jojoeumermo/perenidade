// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leitura enxuta das matérias do jornal e do glossário para o leitor do aplicativo (/app/eu/jornal/[slug]).
// Por que existe: lib/content.ts fixa CONTENT_DIR em content/ inteiro, e toda rota que importa um valor dele leva esse
// diretório (~6 mil arquivos) no rastreio da própria função (npm run conferir:rastreio, limite do total). Aqui os
// caminhos são literais e presos a content/jornal e content/glossario: a função do leitor leva só essas duas pastas.
// A montagem (montarMateria, montarTermo, ordem) é a MESMA de lib/content.ts (lib/jornal/materia.ts); só a leitura do
// disco é repetida. scripts/testar-leitura-do-app.mjs compara o resultado com getArticles/getGlossary, arquivo por arquivo.
import fs from "node:fs";
import path from "node:path";
import { defaultLocale, type Locale } from "@/i18n/config";
import { eOriginal, isActive, slugOf, type Data } from "../conteudo-campos";
import type { Article, Term } from "../content";
import { parseFrontmatter } from "../frontmatter";
import { compararMaterias, montarMateria, montarTermo } from "./materia";

const JORNAL = path.join(process.cwd(), "content", "jornal");
const GLOSSARIO = path.join(process.cwd(), "content", "glossario");

function ler(pasta: string, arquivo: string) {
  const parsed = parseFrontmatter(fs.readFileSync(path.join(pasta, arquivo), "utf8"));
  return { data: parsed.data as Data, body: parsed.content.trim() };
}

/** O original e, se existir, a tradução do idioma pedido sobreposta (mesma regra de lib/content.ts). */
function lerNoIdioma(pasta: string, arquivo: string, lang: Locale) {
  const base = ler(pasta, arquivo);
  const traduzido = arquivo.replace(/\.md$/, `.${lang}.md`);
  if (lang === defaultLocale || !fs.existsSync(path.join(pasta, traduzido))) return { ...base, translated: lang === defaultLocale };
  const traducao = ler(pasta, traduzido);
  return { data: { ...base.data, ...traducao.data }, body: traducao.body || base.body, translated: true };
}

function colecao<T>(pasta: string, nome: string, lang: Locale, montar: (e: { slug: string; file: string; data: Data; body: string; translated: boolean }) => T): T[] {
  if (!fs.existsSync(pasta)) return [];
  const itens: T[] = [];
  for (const arquivo of fs.readdirSync(pasta).filter(eOriginal)) {
    const file = `content/${nome}/${arquivo}`;
    const slug = slugOf(arquivo, file);
    const { data, body, translated } = lerNoIdioma(pasta, arquivo, lang);
    if (!isActive(data)) continue;
    itens.push(montar({ slug, file, data, body, translated }));
  }
  return itens;
}

export const materiasDoApp = (lang: Locale): Article[] => colecao(JORNAL, "jornal", lang, montarMateria).sort(compararMaterias);
export const termosDoApp = (lang: Locale): Term[] => colecao(GLOSSARIO, "glossario", lang, montarTermo).sort((a, b) => a.term.localeCompare(b.term, lang));
