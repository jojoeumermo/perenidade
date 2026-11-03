// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { PageHeading } from "@/components/PageHeading";
import { localePath } from "@/i18n/config";
import { textosDaBase } from "@/lib/escola/textos";
import type { Locale } from "@/i18n/config";
import "@/styles/escola-cursos.css";
import "@/styles/escola-formatura.css";

/** A moldura das páginas do E4-14: título, resumo e o link de volta (para a entrada da Escola ou para a formatura). */
export function PaginaDaFormatura({
  lang,
  texto,
  voltarPara = "/escola",
  voltarTexto,
  marca,
  children,
}: {
  lang: Locale;
  texto: { olho: string; titulo: string; lead: string };
  voltarPara?: string;
  voltarTexto?: string;
  marca: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" {...{ [`data-pagina-${marca}`]: "" }}>
      <PageHeading eyebrow={texto.olho} title={texto.titulo} voltar={{ href: localePath(lang, voltarPara), texto: voltarTexto ?? textosDaBase(lang).nav.entrada }}>
        <span>{texto.lead}</span>
      </PageHeading>
      <div className="mt-8 grid gap-8">{children}</div>
    </div>
  );
}
