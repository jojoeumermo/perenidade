// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Hub } from "@/components/escola/agentes/Hub";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDosAgentes } from "@/i18n/escola/agentes";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-acompanhante.css";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDosAgentes(lang);
  return paginaMeta(lang, "/escola/agentes", `${s.meta.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.descricao);
}

/**
 * Os agentes de trabalho, turma e equipe (Etapa 4, E4-16; docs/escola/agentes.md): o hub com os 7 agentes. Página igual
 * para todos, sem leitura de disco. O layout de /escola dá o 404 quando o recurso está desligado.
 */
export default async function Agentes({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDosAgentes(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 font-sans" data-agentes="">
      <PageHeading eyebrow={textosDaBase(lang).meta.titulo} title={s.hub.titulo} voltar={{ href: localePath(lang, "/escola"), texto: textosDaBase(lang).nav.entrada }} />
      <p className="mt-6 max-w-2xl text-lg">{s.hub.lead}</p>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink-soft">{s.comum.emRevisao}</p>
      <div className="mt-8">
        <Hub lang={lang} s={s} />
      </div>
    </div>
  );
}
