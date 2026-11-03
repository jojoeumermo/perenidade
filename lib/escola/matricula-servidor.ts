// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as páginas da matrícula, da carteirinha, do plano e o "quem volta" (E4-08) mandam ao aparelho: os cursos de
// content/escola/cursos (resumidos), o título e os minutos estimados de cada aula deles e as perguntas de nivelamento
// das trilhas que os cursos usam. Só servidor (lê arquivos). Sem curso nenhum, tudo vem vazio e a matrícula funciona
// sem sugestão. Os textos dos cursos ficam em português, como o resto do conteúdo.
import type { TesteDeNivelamento } from "@/components/estudo/Nivelamento";
import en from "@/i18n/escola/matricula/en.json";
import es from "@/i18n/escola/matricula/es.json";
import fr from "@/i18n/escola/matricula/fr.json";
import pt from "@/i18n/escola/matricula/pt.json";
import ru from "@/i18n/escola/matricula/ru.json";
import zh from "@/i18n/escola/matricula/zh.json";
import presencaEn from "@/i18n/escola/presenca/en.json";
import presencaEs from "@/i18n/escola/presenca/es.json";
import presencaFr from "@/i18n/escola/presenca/fr.json";
import presencaPt from "@/i18n/escola/presenca/pt.json";
import presencaRu from "@/i18n/escola/presenca/ru.json";
import presencaZh from "@/i18n/escola/presenca/zh.json";
import type { Locale } from "@/i18n/config";
import { getTracks } from "@/lib/content";
import type { ExercicioNovo } from "@/lib/exercicios";
import { exerciciosDaTrilha } from "@/lib/exercicios-conteudo";
import { aulasDoCurso, horasDoCurso, trilhaDe } from "./cursos";
import { carregarCursos, minutosDaAula } from "./cursos-servidor";
import type { AulasDoAparelho, CursoDoAparelho } from "./matricula";
import { escolher } from "./textos";

/** Os textos da matrícula, da carteirinha, do plano e do "quem volta" (i18n/escola/matricula), no idioma. */
export type TextosDaMatricula = typeof pt;
export const textosDaMatricula = (lang: string): TextosDaMatricula => escolher({ pt, en, es, fr, ru, zh }, lang);
/** Os textos da presença somada (E4-02), que o "quem volta" mostra. */
export const textosDaPresenca = (lang: string): typeof presencaPt => escolher({ pt: presencaPt, en: presencaEn, es: presencaEs, fr: presencaFr, ru: presencaRu, zh: presencaZh }, lang);

/** Os cursos válidos, só com o que o aparelho usa. */
export function cursosDoAparelho(): CursoDoAparelho[] {
  return carregarCursos().map((c) => ({
    slug: c.slug,
    titulo: c.titulo,
    resumo: c.resumo,
    ciclo: c.ciclo,
    objetivos: c.objetivos,
    requisitos: c.requisitos,
    horas: horasDoCurso(c, minutosDaAula),
    modulos: c.modulos.map((m) => ({ titulo: m.titulo, aulas: m.aulas })),
  }));
}

/** Título (no idioma, quando a aula tem tradução) e minutos estimados de cada aula dos cursos. */
export function aulasDoAparelho(lang: Locale, cursos: readonly CursoDoAparelho[]): AulasDoAparelho {
  const ids = new Set(cursos.flatMap((c) => aulasDoCurso(c)));
  if (ids.size === 0) return {};
  const trilhas = new Set([...ids].map(trilhaDe));
  const titulos = new Map<string, string>();
  for (const track of getTracks(lang)) if (trilhas.has(track.slug)) for (const l of track.lessons) titulos.set(`${track.slug}/${l.slug}`, l.title);
  const saida: AulasDoAparelho = {};
  for (const id of ids) saida[id] = { titulo: titulos.get(id) ?? id, minutos: minutosDaAula(id) };
  return saida;
}

/**
 * As perguntas de nivelamento das trilhas usadas pelos cursos, montadas como em app/[lang]/nivelamento/page.tsx: uma
 * por aula, a marcada para o nivelamento ou a primeira do teste da aula; só trilhas com 3 perguntas ou mais. Ficam só
 * as trilhas dos cursos (o aparelho não baixa as 300 trilhas do site).
 */
export function testesDosCursos(lang: Locale, cursos: readonly CursoDoAparelho[]): TesteDeNivelamento[] {
  const trilhas = new Set(cursos.flatMap((c) => aulasDoCurso(c).map(trilhaDe)));
  if (trilhas.size === 0) return [];
  return getTracks(lang)
    .filter((track) => trilhas.has(track.slug))
    .map((track) => {
      const porAula = new Map(exerciciosDaTrilha(track.slug).map((g) => [g.aula, g.exercicios.filter((ex) => ex.nivelamento)]));
      const questoes = track.lessons.flatMap((l) => {
        const marcada = porAula.get(l.slug)?.[0];
        if (marcada) return [{ aula: `${track.slug}/${l.slug}`, ex: marcada }];
        const q = l.quiz[0];
        if (!q || q.options.length < 2) return [];
        const ex: ExercicioNovo = {
          tipo: "escolha",
          id: `quiz-${track.slug}-${l.slug}-0`,
          tema: l.title,
          dificuldade: 1,
          enunciado: q.question,
          explicacao: q.explanation ?? "",
          fonte: "Teste da aula",
          nivelamento: true,
          revisao: { status: "em-revisao" },
          autoria: l.authors.join(", "),
          alternativas: q.options.map((texto, i) => ({ texto, certa: i === q.answer })),
        };
        return [{ aula: `${track.slug}/${l.slug}`, ex }];
      });
      return { trilha: track.slug, titulo: track.title, roteiro: track.lessons.map((l) => ({ id: `${track.slug}/${l.slug}`, titulo: l.title })), questoes };
    })
    .filter((teste) => teste.questoes.length >= 3);
}
