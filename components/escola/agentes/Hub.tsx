// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { AGENTES, type ParaQuem } from "@/lib/escola/agentes";
import "@/styles/escola-acompanhante.css";

const GRUPOS: ParaQuem[] = ["estudante", "turma", "equipe"];
const NOME_DO_GRUPO = { estudante: "estudar", turma: "turma", equipe: "equipe" } as const;

/** O hub dos agentes: cartões agrupados em "Para estudar", "Para a turma" e "Para a equipe". Servidor, sem estado. */
export function Hub({ lang, s }: { lang: string; s: TextosDosAgentes }) {
  return (
    <div className="space-y-10" data-hub-agentes>
      {GRUPOS.map((grupo) => (
        <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
          <h2 id={`grupo-${grupo}`} className="font-serif text-2xl font-semibold">
            {s.hub.grupos[NOME_DO_GRUPO[grupo]]}
          </h2>
          <ul className="acompanhante-modos mt-4">
            {AGENTES.filter((a) => a.paraQuem === grupo).map((a) => (
              <li key={a.chave} className="acompanhante-modo block" data-agente-cartao={a.chave}>
                <Link href={localePath(lang as "pt", a.caminho)} className="block no-underline hover:text-ink">
                  <span className="block font-serif text-xl font-semibold">{s.hub.cartoes[a.chave].titulo} →</span>
                  <span className="mt-1 block text-sm text-ink-soft">{s.hub.cartoes[a.chave].texto}</span>
                </Link>
                <span className="mt-2 block text-xs text-ink-soft">{a.usaServidor ? s.hub.servidor : s.hub.aparelho}</span>
                {a.usaServidor && (
                  <Link href={localePath(lang as "pt", "/escola/acompanhante")} className="mt-1 inline-block text-xs underline hover:text-oxblood">
                    {s.comum.conversasGuardadas}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
