// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { copiarTexto, useProjetos } from "@/components/escola/formatura/usar-formatura";
import Link from "@/components/Link";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { diaEmBrasilia } from "@/lib/escola/estudante";
import { gravarGaveta, textoDaGaveta } from "@/lib/escola/formatura";

/**
 * A oferta de publicar o projeto final na Gaveta Aberta: um bloco para copiar (tipo, título, licença e o lembrete) e o
 * link para /gaveta. O formulário da Gaveta não é preenchido sozinho; a pessoa escolhe e envia. "Já enviei" guarda o dia.
 */
export function PublicarNaGaveta({ s, curso, gavetaHref }: { s: TextosDaFormatura["gaveta"]; curso: { slug: string; titulo: string }; gavetaHref: string }) {
  const projetos = useProjetos();
  const [copiado, setCopiado] = useState<boolean | null>(null);
  const t = textoDaGaveta({ curso: curso.slug, tituloDoCurso: curso.titulo });
  const enviado = projetos.cursos[curso.slug]?.gaveta;
  return (
    <section className="formatura-cartao" aria-labelledby={`gaveta-${curso.slug}`} data-gaveta="">
      <h3 id={`gaveta-${curso.slug}`} className="formatura-h3">
        {s.titulo}
      </h3>
      <p>{s.lead}</p>
      <pre className="formatura-bloco">{t.bloco}</pre>
      <p className="formatura-fraco">{s.lembrete}</p>
      <div className="formatura-barra">
        <button
          type="button"
          className="formatura-botao-fraco"
          onClick={async () => setCopiado(await copiarTexto(t.bloco))}
        >
          {s.copiar}
        </button>
        <Link href={gavetaHref} className="formatura-botao">
          {s.abrir}
        </Link>
      </div>
      {copiado !== null ? (
        <p role="status" className="formatura-fraco">
          {copiado ? s.copiado : s.naoCopiou}
        </p>
      ) : null}
      <label className="formatura-marca">
        <input type="checkbox" checked={Boolean(enviado)} onChange={(e) => gravarGaveta(curso.slug, e.target.checked ? diaEmBrasilia(new Date()) : null)} />
        <span>{enviado ? `${s.jaEnviei} (${enviado})` : s.jaEnviei}</span>
      </label>
    </section>
  );
}
