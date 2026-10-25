// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { LabRedes } from "@/components/labs/redes/Redes";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/redes">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/redes", t.labs.redes, t.labs.redesLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/redes">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.redes}>
        {t.labs.redesLead}
      </PageHeading>
      <LabRedes />
      <section className="mt-12 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <h2 className="font-serif text-xl font-semibold text-ink">Quer ir além?</h2>
        <p className="mt-2">
          O <a href="https://www.netacad.com/pt-br/courses/packet-tracer" target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">Packet Tracer</a> é gratuito pela Cisco Networking Academy (exige cadastro na Cisco). Este simulador é didático e não é o Cisco IOS: para OSPF, BGP e ACLs avançadas, use o Packet Tracer oficial. Arquivos de exercício (.pkt) que os educadores publicarem ficam em{" "}
          <Link href={localePath(lang, "/materiais")} className="underline hover:text-oxblood">Materiais</Link>.
        </p>
      </section>
    </div>
  );
}
