// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { Suspense } from "react";
import { CertificateCheck } from "@/components/CertificateCheck";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/certificado">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.certificate.title, description: t.certificate.description, robots: { index: false } };
}

// Conferência pública dos certificados de trabalho voluntário emitidos pelo instituto.
export default async function Certificado({ params }: PageProps<"/[lang]/certificado">) {
  const { t } = await loadLang(params);
  const s = t.certificate;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.eyebrow} title={s.title}>
        {s.lead}
      </PageHeading>
      <Suspense>
        <CertificateCheck s={s} />
      </Suspense>
    </div>
  );
}
