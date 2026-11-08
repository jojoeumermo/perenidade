// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// SÓ NO SERVIDOR: monta o que as telas Formação e Caderno mostram de cada um dos 11 cadernos (lib/escola/contratos.ts e
// lib/escola/cadernos.ts) a partir do conteúdo público de /trilhas: as aulas (com o MESMO lessonId e o mesmo código F-NNAA
// da tela Hoje, components/escola/hoje/cadernos-do-quadro.ts), os minutos, os lados A e B e a contagem real. Nada de
// militante passa por aqui: o que a pessoa já fez fica no aparelho e é cruzado no navegador.

import ano from "@/content/escola/cursos/ano-de-formacao-politica.json";
import despertar from "@/content/despertar.json";
import { cadernosDoQuadro } from "@/components/escola/hoje/cadernos-do-quadro";
import type { Locale } from "@/i18n/config";
import { getTrack } from "@/lib/content";
import { catalogoDe, contagemDoCaderno, ladoNaTrilha, type Contagem, type Lado } from "@/lib/escola/cadernos";
import { CADERNOS_DA_ESCOLA, type CadernoDaEscola, type Degrau } from "@/lib/escola/contratos";
import { lessonId } from "@/lib/ids";

export interface AulaDoCaderno {
  /** O lessonId de /trilhas ("trilha/aula"); nas aulas em preparação, o id que a aula terá. */
  id: string;
  titulo: string;
  /** F-NNAA; nulo enquanto a aula está em preparação. */
  codigo: string | null;
  /** Endereço da aula na Escola (sem o idioma); nulo enquanto a aula está em preparação. */
  href: string | null;
  minutos: number | null;
  lado: Lado;
  /** Posição entre as aulas prontas do caderno (0 em diante); -1 na aula em preparação. */
  posicao: number;
}

export interface GrupoDoCaderno {
  titulo: string;
  /** O título do grupo só existe em português (content/despertar.json e o curso). */
  emPortugues: boolean;
  lado: Lado;
  aulas: AulaDoCaderno[];
}

export interface CadernoVisto {
  numero: number;
  slug: string;
  degrau: Degrau;
  nome: string;
  href: string;
  /** "trilha" (lados com aulas) ou "grupos" (Despertar e Ano de formação: lados com etapas ou módulos). */
  forma: "trilha" | "grupos";
  trilha: string | null;
  resumo: string;
  resumoTraduzido: boolean;
  patrono: string | null;
  contagem: Contagem;
  /** As aulas prontas, na ordem (as mesmas da tela Hoje). */
  prontas: AulaDoCaderno[];
  /** Nas trilhas: todas as aulas do plano, prontas e em preparação, na ordem. */
  plano: AulaDoCaderno[];
  /** No Despertar e no Ano de formação: as etapas ou os módulos. */
  grupos: GrupoDoCaderno[];
}

/** Os 11 cadernos com o que as telas precisam. `nomes` vem de i18n/escola/formacao-base ("hoje.cadernos"). */
export function cadernosVistos(lang: Locale, nomes: readonly string[], resumoDoDespertar: string): CadernoVisto[] {
  const quadro = cadernosDoQuadro(lang, nomes);
  return CADERNOS_DA_ESCOLA.map((c, i) => verCaderno(lang, c, quadro[i], resumoDoDespertar));
}

export function cadernoVisto(lang: Locale, slug: string, nomes: readonly string[], resumoDoDespertar: string): CadernoVisto | null {
  const i = CADERNOS_DA_ESCOLA.findIndex((c) => c.slug === slug);
  return i < 0 ? null : cadernosVistos(lang, nomes, resumoDoDespertar)[i];
}

/** Minutos de uma aula ("trilha/aula") no idioma pedido, ou nulo se ela não existe. */
function minutosDe(lang: Locale, id: string): number | null {
  const [t, a] = id.split("/");
  return getTrack(t, lang)?.lessons.find((l) => l.slug === a)?.minutes ?? null;
}

function verCaderno(lang: Locale, c: CadernoDaEscola, q: ReturnType<typeof cadernosDoQuadro>[number], resumoDoDespertar: string): CadernoVisto {
  const cat = catalogoDe(c.numero);
  const prontas: AulaDoCaderno[] = q.aulas.map((a, posicao) => ({ id: a.id, titulo: a.titulo, codigo: a.codigo, href: a.href, minutos: minutosDe(lang, a.id), lado: "A", posicao }));
  const porId = new Map(prontas.map((a) => [a.id, a]));
  const base = { numero: c.numero, slug: c.slug, degrau: c.degrau, nome: q.nome, href: q.href, patrono: cat.patrono, contagem: contagemDoCaderno(c) };

  if (c.fonte.tipo === "trilha") {
    const track = getTrack(c.fonte.trilha, lang);
    const slugs = (track?.plan ?? []).map((p) => p.slug);
    const comeca = cat.ladoB.tipo === "aula" ? cat.ladoB.comeca : "";
    const plano: AulaDoCaderno[] = (track?.plan ?? []).map((p) => {
      const id = lessonId(c.fonte.tipo === "trilha" ? c.fonte.trilha : "", p.slug);
      const lado = ladoNaTrilha(slugs, comeca, p.slug);
      const pronta = porId.get(id);
      if (pronta) pronta.lado = lado;
      return pronta ?? { id, titulo: p.title, codigo: null, href: null, minutos: null, lado, posicao: -1 };
    });
    return { ...base, forma: "trilha", trilha: c.fonte.trilha, resumo: track?.summary ?? "", resumoTraduzido: track?.translated ?? true, prontas, plano, grupos: [] };
  }

  // Despertar (etapas) e Ano de formação (módulos): cada aula entra uma vez, no primeiro grupo em que aparece.
  const vistas = new Set<string>();
  const grupo = (titulo: string, lado: Lado, ids: string[]): GrupoDoCaderno => ({
    titulo,
    emPortugues: true,
    lado,
    aulas: ids.flatMap((id) => {
      const a = porId.get(id);
      if (!a || vistas.has(id)) return [];
      vistas.add(id);
      a.lado = lado;
      return [a];
    }),
  });
  if (c.fonte.tipo === "despertar") {
    const deB = cat.ladoB.tipo === "etapas" ? cat.ladoB.ids : [];
    const grupos = despertar.etapas.map((e) => grupo(e.titulo, deB.includes(e.id) ? "B" : "A", e.aulas));
    return { ...base, forma: "grupos", trilha: null, resumo: resumoDoDespertar, resumoTraduzido: true, prontas, plano: [], grupos };
  }
  const deB = cat.ladoB.tipo === "modulos" ? cat.ladoB.indices : [];
  const grupos = (ano.modulos as { titulo: string; aulas: string[] }[]).map((m, i) => grupo(m.titulo, deB.includes(i) ? "B" : "A", m.aulas));
  return { ...base, forma: "grupos", trilha: null, resumo: ano.resumo, resumoTraduzido: lang === "pt", prontas, plano: [], grupos };
}

/** "~1h20", "45 min": o tempo somado de um lado. */
export function tempoSomado(minutos: number, rotuloMin: string): string {
  if (minutos < 60) return rotuloMin.replace("{n}", String(minutos));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "Texto com **negrito**" em partes: as ímpares vão em <strong>. */
export const partesComNegrito = (texto: string) => texto.split("**");
