// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import { BASE_DAS_AULAS } from "@/lib/escola/aulas-abertas";

/** A volta para /escola/aulas no alto das páginas de disciplina e de trilha que moram na Escola (P5, B2). */
export function VoltarAsAulasAbertas({ lang, texto }: { lang: Locale; texto: string }) {
  return (
    <nav className="efl-voltar no-print" aria-label={texto}>
      <Link href={localePath(lang, BASE_DAS_AULAS)}>
        <span aria-hidden>←</span> {texto}
      </Link>
    </nav>
  );
}
