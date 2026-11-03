// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { fill } from "@/i18n/config";
import type { TextosDaAula } from "@/i18n/escola/aula";
import { nivelDaAula } from "@/lib/legibilidade";

/**
 * "Leitura: fácil / média / difícil" (Etapa 4, R1-88), nas aulas de entrada. O índice é calculado na montagem do site
 * (lib/legibilidade.ts), nunca no aparelho; a explicação abre ali mesmo, com a fonte da fórmula. Componente de servidor:
 * não manda JavaScript ao navegador.
 */
export function NivelDeLeitura({ indice, s }: { indice: number; s: TextosDaAula["nivel"] }) {
  const nivel = nivelDaAula(indice);
  return (
    <details className="nivel-de-leitura no-print" data-nivel={nivel}>
      <summary>
        <span className="nivel-de-leitura-marca" aria-hidden>
          {nivel === "facil" ? "●○○" : nivel === "media" ? "●●○" : "●●●"}
        </span>
        {fill(s.rotulo, { nivel: s[nivel] })}
        <span className="nivel-de-leitura-como">{s.como}</span>
      </summary>
      <p>{s.explicacao}</p>
      <p className="text-xs">
        {s.fonteDaConta} ({Math.round(indice)}/100)
      </p>
    </details>
  );
}
