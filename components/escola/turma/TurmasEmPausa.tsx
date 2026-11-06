// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";

/**
 * O aviso das turmas em pausa (T08; recurso "turmas", lib/recursos.ts, EM_PAUSA). Com o recurso desligado pelo painel
 * (Site › Controles avançados › Recursos), as páginas de turma continuam respondendo no mesmo endereço (nenhum link quebra,
 * nada de 404) e mostram só este aviso curto, com o caminho para os cursos e as disciplinas, que seguem abertos.
 * `noindex` fica na página que o usa (metadados), para os buscadores não guardarem o aviso no lugar das turmas.
 */
export function TurmasEmPausa({ lang, s, escola = true, olho }: { lang: Locale; s: TextosDaTurma["pausa"]; escola?: boolean; olho?: string }) {
  const to = (p: string) => localePath(lang, p);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-turmas-em-pausa="">
      <PageHeading eyebrow={olho ?? s.olho} title={s.titulo}>
        {s.texto}
      </PageHeading>
      <p className="mt-8 flex flex-wrap gap-3 font-sans">
        {escola && (
          <Link href={to("/escola/cursos")} className="botao">
            {s.cursos}
          </Link>
        )}
        <Link href={to("/trilhas")} className="botao">
          {s.trilhas}
        </Link>
      </p>
    </div>
  );
}
