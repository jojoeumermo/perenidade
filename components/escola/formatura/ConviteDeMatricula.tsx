// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";

/** O convite para quem ainda não tem matrícula neste aparelho (a matrícula não pede nome, e-mail nem documento). */
export function ConviteDeMatricula({ c, base }: { c: TextosDaFormatura["comum"]; base: string }) {
  return (
    <div className="formatura-cartao" data-sem-matricula="">
      <h2 className="formatura-h2">{c.semMatriculaTitulo}</h2>
      <p>{c.semMatriculaTexto}</p>
      <p>
        <Link href={`${base}/matricula`} className="formatura-botao">
          {c.matricular}
        </Link>
      </p>
    </div>
  );
}

/** O selo de privacidade "aparelho". */
export function SeloDoAparelho({ texto }: { texto: string }) {
  return <p className="formatura-selo-aparelho">{texto}</p>;
}
