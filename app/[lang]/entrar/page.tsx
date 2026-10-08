// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { SignIn } from "@/components/SignIn";
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
    </div>
  );
}
