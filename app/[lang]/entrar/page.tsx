// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { SignIn } from "@/components/SignIn";
import { VolunteerForm } from "@/components/VolunteerForm";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/entrar">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.auth.title, robots: { index: false } };
}

export default async function Entrar({ params }: PageProps<"/[lang]/entrar">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.auth.eyebrow} title={t.auth.title}>
        {t.auth.lead}
      </PageHeading>
      <SignIn s={t.auth} />
      {/* Quem quer ser voluntário não precisa de conta para se candidatar: o formulário abre aqui mesmo. */}
      <details className="mt-12 border-2 border-oxblood bg-parchment-deep p-5">
        <summary className="flex cursor-pointer items-center gap-3 font-sans text-lg font-semibold text-oxblood hover:underline">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center bg-oxblood font-sans text-xl font-black italic text-parchment">+</span>
          {t.auth.volunteerLink}
        </summary>
        <VolunteerForm s={t.volunteer} />
      </details>
    </div>
  );
}
