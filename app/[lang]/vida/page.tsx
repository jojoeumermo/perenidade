// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { HubDaVida } from "@/components/escola/vida/HubDaVida";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { textosDaVida } from "@/i18n/escola/vida";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import missoes from "@/content/escola/vida/missoes.json";
import "@/styles/escola-vida.css";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  return paginaMeta(lang, "/vida", `${s.meta.hub.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.hub.descricao);
}

/** Hub "Vida real" (E4-11): reúne as peças e aponta para o círculo de cultura digital. Página estática, igual para todos. */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  const nCursos = carregarCursos().filter((c) => c.tarefaNoMundo).length;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-vida="hub">
      <PageHeading eyebrow={s.hub.olho} title={s.hub.titulo}>
        {s.hub.lead}
      </PageHeading>
      <HubDaVida s={s.hub} lang={lang} totalDeTarefas={nCursos} totalDeMissoes={missoes.missoes.length} />
    </div>
  );
}