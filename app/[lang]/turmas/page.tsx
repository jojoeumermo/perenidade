// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { TurmasEmPausa } from "@/components/escola/turma/TurmasEmPausa";
import { Capa, Corpo, Secao } from "@/components/pagina/Capa";
import { TurmaDoMes } from "@/components/TurmaDoMes";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaTurma } from "@/i18n/escola/turma";
import { ligado } from "@/lib/recursos";
import { recursoLigado } from "@/lib/recursos-vivos";
import { paginaMeta } from "@/lib/seo";
import { mesesDaTurma, turmaDoMes } from "@/lib/turma-do-mes";

// A turma vira no dia 1: a página se refaz a cada hora para não ficar presa no mês que passou.
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]/turmas">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const meta = paginaMeta(lang, "/turmas", t.turmaDoMes.titulo, t.turmaDoMes.lead);
  // Em pausa (T08): o aviso não entra nos buscadores.
  return (await recursoLigado("turmas")) ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** Estudar junto: a turma deste mês, a do mês que vem e como funciona. */
export default async function Turmas({ params }: PageProps<"/[lang]/turmas">) {
  const { lang, t } = await loadLang(params);
  // T08: turmas em pausa por decisão da coordenação (recurso "turmas", ligado e desligado pelo painel). O endereço continua
  // vivo, com um aviso curto; os cursos da Escola só aparecem no aviso quando a Escola está ligada.
  if (!(await recursoLigado("turmas"))) return <TurmasEmPausa lang={lang} s={textosDaTurma(lang).pausa} escola={ligado("escola")} olho={t.turmaDoMes.rotulo} />;
  const s = t.turmaDoMes;
  const [agora, seguinte] = mesesDaTurma();
  const desta = turmaDoMes(lang, agora);
  const proxima = turmaDoMes(lang, seguinte);
  return (
    <>
      <Capa rotulo={s.rotulo} titulo={s.titulo}>{s.lead}</Capa>
      <Corpo largura="media">
        <div className="grid gap-10">
          {desta && <TurmaDoMes turma={desta} lang={lang} s={s} />}
          {proxima && <TurmaDoMes turma={proxima} lang={lang} s={s} proxima />}
        </div>

        <Secao titulo={s.comoTitulo} tarja="vermelha" className="mt-16">
          <ol className="mt-5 grid max-w-3xl list-decimal gap-3 pl-6 font-serif text-lg leading-relaxed">
            <li>{s.como1}</li>
            <li>{s.como2}</li>
            <li>{s.como3}</li>
            <li>{s.como4}</li>
          </ol>
          <p className="mt-6 flex flex-wrap gap-3">
            <Link href={localePath(lang, "/nucleos")} className="botao">{s.nucleos}</Link>
            <Link href={localePath(lang, "/conduta")} className="botao">{s.conduta}</Link>
          </p>
          {/* Recurso "escola" (lib/recursos.ts): ligado, a Escola tem turmas por curso (E4-15). Desligado, nada muda aqui. */}
          {ligado("escola") && (
            <p className="mt-6 font-sans" data-link-turmas-por-curso="">
              {textosDaTurma(lang).linkTurmas.texto}{" "}
              <Link href={localePath(lang, "/escola/turmas")} className="font-semibold underline hover:text-oxblood">{textosDaTurma(lang).linkTurmas.titulo} →</Link>
            </p>
          )}
        </Secao>
      </Corpo>
    </>
  );
}
