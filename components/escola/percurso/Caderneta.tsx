// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDoPercurso } from "@/i18n/escola/percurso";
import type { Caderneta as ContasDaCaderneta } from "@/lib/escola/conquistas";

/**
 * A caderneta (prancha Cel-Percurso): aulas feitas, tarefas no mundo, rodas de núcleo e o link dos retornos por
 * competência. Os números são deste aparelho (o mesmo progresso de /trilhas e a caderneta da Escola), nunca do servidor.
 */
export function Caderneta({ contas, t, lang }: { contas: ContasDaCaderneta; t: TextosDoPercurso["caderneta"]; lang: Locale }) {
  const formato = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang);
  return (
    <section aria-labelledby="ep-caderneta" className="ep-caderneta">
      <h2 id="ep-caderneta" className="ef-t">
        {t.titulo}
      </h2>
      <dl>
        <div className="ep-caderneta-linha">
          <dt>{t.aulas}</dt>
          <dd>{formato.format(contas.aulas)}</dd>
        </div>
        <div className="ep-caderneta-linha">
          <dt>{t.tarefas}</dt>
          <dd>{formato.format(contas.tarefas)}</dd>
        </div>
        <div className="ep-caderneta-linha">
          <dt>{t.rodas}</dt>
          <dd>{formato.format(contas.rodas)}</dd>
        </div>
        <div className="ep-caderneta-linha">
          <dt>{t.retornos}</dt>
          <dd style={{ fontWeight: 400 }}>
            <Link href={localePath(lang, "/escola/provas")} aria-label={t.verRetornos} className="ep-casca-link">
              {t.ver}
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
