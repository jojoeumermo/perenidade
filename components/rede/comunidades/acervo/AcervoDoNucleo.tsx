// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArquivosDoNucleo } from "./ArquivosDoNucleo";
import { DocumentosDoNucleo } from "./DocumentosDoNucleo";
import { useTextosDoAcervo } from "./textos";
import "./acervo.css";

/** O acervo na página do núcleo: os documentos escritos juntos e os arquivos (PDF e imagem), só para quem é do núcleo. */
export default function AcervoDoNucleo({ nucleo, lang }: { nucleo: string; lang: string }) {
  const t = useTextosDoAcervo(lang);
  if (!t) return null;
  return (
    <>
      <DocumentosDoNucleo nucleo={nucleo} lang={lang} t={t} />
      <ArquivosDoNucleo nucleo={nucleo} lang={lang} t={t} />
    </>
  );
}
