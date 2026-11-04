// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useConsertos } from "./contexto";

/** A mensagem gentil de quem declarou ter menos de 18 anos: fora só da Rede, o resto do site segue aberto. */
export function ForaDaRede() {
  const x = useConsertos();
  return (
    <div className="m-4 rounded-xl border-[1.5px] border-ink bg-parchment-deep p-5 font-sans" role="status">
      <p className="font-serif text-xl font-semibold">{x.menorTitulo}</p>
      <p className="mt-2 text-sm">{x.menorTexto}</p>
      <p className="mt-2 text-sm text-ink-soft">{x.menorEngano}</p>
    </div>
  );
}
