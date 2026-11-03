// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { FormularioDaOuvidoria } from "@/components/escola/organizacao/FormularioDaOuvidoria";
import { MeusProtocolos } from "@/components/escola/organizacao/MeusProtocolos";
import { RespostasPublicas } from "@/components/escola/organizacao/RespostasPublicas";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaOrganizacao } from "@/i18n/escola/organizacao";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-organizacao.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/ouvidoria">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaOrganizacao(lang);
  return paginaMeta(lang, "/escola/ouvidoria", `${s.meta.ouvidoriaTitulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.ouvidoriaDescricao);
}

/**
 * Ouvidoria da Escola (E4-12, docs/escola/organizacao.md): como funciona e o que é guardado, o formulário (sem conta,
 * `ouvidoria_enviar`), "Meus protocolos" (só no aparelho) e as respostas públicas. Página igual para todos; o que depende
 * da pessoa (protocolos, ?sobre=, ?caminho=) é lido no navegador.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/ouvidoria">) {
  const { lang } = await loadLang(params);
  const s = textosDaOrganizacao(lang);
  const o = s.ouvidoria;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-ouvidoria="">
      <PageHeading eyebrow={o.olho} title={o.titulo} voltar={{ href: localePath(lang, "/escola"), texto: s.voltar }}>
        {o.lead}
      </PageHeading>

      <section className="org-bloco" aria-labelledby="ouv-guarda">
        <h2 id="ouv-guarda" className="org-bloco-titulo">
          {o.guardaTitulo}
        </h2>
        <p className="org-nota">{o.guarda}</p>
        <p className="org-nota">{o.quemLe}</p>
        <p className="org-nota">{o.apaga}</p>
        <p className="org-nota">{o.prazo}</p>
        <p className="org-nota">
          {o.eliminar}{" "}
          <Link href={localePath(lang, "/privacidade")} className="underline hover:text-oxblood">
            {o.privacidade}
          </Link>
        </p>
      </section>

      <section className="org-bloco" aria-labelledby="ouv-form">
        <h2 id="ouv-form" className="org-bloco-titulo">
          {o.formTitulo}
        </h2>
        <FormularioDaOuvidoria s={o} roda={s.roda} />
      </section>

      <section className="org-bloco" aria-labelledby="ouv-meus">
        <h2 id="ouv-meus" className="org-bloco-titulo">
          {s.protocolos.titulo}
        </h2>
        <MeusProtocolos s={s.protocolos} assuntos={o.assuntos} />
      </section>

      <section className="org-bloco" aria-labelledby="ouv-publicas">
        <h2 id="ouv-publicas" className="org-bloco-titulo">
          {s.publicas.titulo}
        </h2>
        <p className="org-nota">{s.publicas.lead}</p>
        <RespostasPublicas s={s.publicas} assuntos={o.assuntos} />
      </section>
    </div>
  );
}
