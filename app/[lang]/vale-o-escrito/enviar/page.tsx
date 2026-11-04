// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { FormularioEnviar } from "@/components/vale-o-escrito/FormularioEnviar";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { lerDossies } from "@/lib/vale-o-escrito/dados";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return paginaMeta(lang, "/vale-o-escrito/enviar", s.enviar.titulo, s.enviar.lead);
}

/**
 * Enviar uma fonte (público, sem conta). O formulário é de cliente e leve; esta página só lê a lista de dossiês (pasta
 * literal, no servidor). Fora do recurso "vale-o-escrito" o layout já responde 404.
 */
export default async function EnviarFonte({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  const dossies = lerDossies().map((d) => ({ slug: d.slug, titulo: (d.titulo as Record<string, string | undefined>)[lang] ?? d.titulo.pt }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.entrada.titulo} title={s.enviar.titulo} voltar={{ href: localePath(lang, "/vale-o-escrito"), texto: s.navegacao.inicio }}>
        {s.enviar.lead}
      </PageHeading>
      <FormularioEnviar s={{ enviar: s.enviar, erros: s.erros, avisos: s.avisos }} dossies={dossies} />
      <p className="mt-8 font-sans text-sm">
        <Link className="underline" href={localePath(lang, "/vale-o-escrito/sobre")}>
          {s.navegacao.sobre}
        </Link>
      </p>
    </div>
  );
}
