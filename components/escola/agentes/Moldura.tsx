// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { SelosDePrivacidade } from "@/components/SeloDePrivacidade";
import { localePath } from "@/i18n/config";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { SELOS_DE_FORA, type SelosDeUmItem } from "@/lib/selos";
import "@/styles/escola-acompanhante.css";

const APARELHO: SelosDeUmItem = { principal: { tipo: "aparelho" } };

/**
 * A moldura de cada página de agente (servidor): o título, a explicação, a marca "em revisão", o selo de privacidade
 * (o do assistente, nos 5 agentes que usam o servidor; "fica no aparelho", na revisão e na tradução) e o link para o
 * "Como funciona" do acompanhante.
 */
export function Moldura({ lang, eyebrow, chave, titulo, lead, usaServidor, comum, children }: { lang: string; eyebrow: string; chave: string; titulo: string; lead: string; usaServidor: boolean; comum: TextosDosAgentes["comum"]; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 font-sans" data-agente={chave} data-usa-servidor={usaServidor ? "sim" : "nao"}>
      <PageHeading eyebrow={eyebrow} title={titulo} voltar={{ href: localePath(lang as "pt", "/escola/agentes"), texto: comum.voltar }} />
      <p className="mt-6 text-lg">{lead}</p>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink-soft">{comum.emRevisao}</p>
      <div className="mt-3 border-l-4 border-gold pl-3 text-sm">
        <p className="font-semibold">{usaServidor ? comum.usaServidor : comum.ficaNoAparelho}</p>
        <SelosDePrivacidade item={usaServidor ? SELOS_DE_FORA.assistente : APARELHO} lang={lang} className="mt-2" />
        {usaServidor && (
          <p className="mt-1 text-xs">
            <Link href={localePath(lang as "pt", "/escola/acompanhante/como-funciona")} className="underline hover:text-oxblood">
              {comum.comoFunciona}
            </Link>
          </p>
        )}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
