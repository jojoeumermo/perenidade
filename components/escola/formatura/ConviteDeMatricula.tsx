// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useGuardado } from "@/components/estudo/guardado";
import Link from "@/components/Link";
import type { TextosDoAvisoDeMatricula } from "@/i18n/escola/formatura";
import { lerMatricula, type Matricula } from "@/lib/escola/estudante";

// O tipo e o helper avisoDeMatricula moram em i18n/escola/formatura (servidor): este arquivo é "use client", e a
// página de servidor não pode chamar função dele. Aqui fica só o tipo, reexportado para a carteirinha e o plano.
export type { TextosDoAvisoDeMatricula };

/**
 * O aviso ÚNICO das telas que pedem matrícula (caderneta, formatura, projeto final, registro, mural, carteirinha e
 * plano da semana): diz o que é a matrícula, o que ela dá e o que ela pede (nada de nome, e-mail ou documento), com um
 * botão visível que leva a ela. Cada tela mostra este aviso uma vez só: as outras partes da mesma página somem
 * enquanto não há matrícula. Enquanto o aparelho ainda está sendo lido (primeiro efeito), não mostra nada, para quem
 * já tem matrícula não ver o aviso piscar; e se já houver matrícula, também não mostra nada.
 */
export function ConviteDeMatricula({ c, base }: { c: TextosDoAvisoDeMatricula; base: string }) {
  const [matricula] = useGuardado<Matricula | null | undefined>(lerMatricula, undefined);
  if (matricula !== null) return null;
  const itens = [
    [c.rotuloOQueE, c.semMatriculaOQueE],
    [c.rotuloOQueDa, c.semMatriculaOQueDa],
    [c.rotuloOQuePede, c.semMatriculaOQuePede],
  ];
  return (
    <section className="border-2 border-ink bg-parchment-deep p-5 font-sans sm:p-6" aria-labelledby="aviso-de-matricula" data-sem-matricula="">
      <h2 id="aviso-de-matricula" className="font-serif text-2xl font-semibold text-balance">
        {c.semMatriculaTitulo}
      </h2>
      <p className="mt-2 text-ink-soft">{c.semMatriculaTexto}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {itens.map(([rotulo, texto]) => (
          <div key={rotulo} className="border-t-2 border-ink pt-2">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">{rotulo}</dt>
            <dd className="mt-1">{texto}</dd>
          </div>
        ))}
      </dl>
      <Link href={`${base}/matricula`} className="mt-5 inline-flex min-h-11 items-center border-2 border-ink bg-ink px-5 py-2.5 font-semibold text-parchment hover:border-oxblood hover:bg-oxblood hover:text-parchment" data-fazer-matricula="">
        {c.matricular} →
      </Link>
    </section>
  );
}

/** Mostra o que vem dentro só para quem já tem matrícula neste aparelho (as notas de rodapé das telas que pedem matrícula). */
export function SoComMatricula({ children }: { children: React.ReactNode }) {
  const [matricula] = useGuardado<Matricula | null | undefined>(lerMatricula, undefined);
  return matricula ? <>{children}</> : null;
}

/** O selo de privacidade "aparelho". */
export function SeloDoAparelho({ texto }: { texto: string }) {
  return <p className="formatura-selo-aparelho">{texto}</p>;
}
