// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { SignIn } from "@/components/SignIn";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/entrar">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.auth.title, robots: { index: false } };
}

export default async function Entrar({ params }: PageProps<"/[lang]/entrar">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.auth.eyebrow} title={t.auth.title}>
        {t.auth.lead}
      </PageHeading>
      <SignIn s={t.auth} />
      {/* A candidatura a voluntário mora na página de voluntariado: colada embaixo do entrar, deixava a tela comprida e
          misturava duas coisas (09/11/2026). Quem quer ser voluntário não precisa de conta. */}
      <p className="mt-10 max-w-md border-l-4 border-oxblood pl-4 font-sans">
        <Link href={localePath(lang, "/voluntarios")} className="font-semibold text-oxblood underline underline-offset-4 hover:text-ink">
          {t.auth.volunteerLink} →
        </Link>
      </p>
    </div>
  );
}
