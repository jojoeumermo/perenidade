// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios", t.labs.title, t.labs.lead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios">) {
  const { lang, t } = await loadLang(params);
  const s = t.labs;
  const itens: [string, string, string][] = [
    [s.ide, s.ideLead, "/laboratorios/ide"],
    [s.redes, s.redesLead, "/laboratorios/redes"],
    [s.linux, s.linuxLead, "/laboratorios/linux"],
    [s.montador, s.montadorLead, "/laboratorios/montador"],
    [s.eletrica, s.eletricaLead, "/laboratorios/eletrica"],
    [s.ia, s.iaLead, "/laboratorios/ia"],
    [s.escritorio, s.escritorioLead, "/laboratorios/escritorio"],
    [s.seguranca, s.segurancaLead, "/laboratorios/seguranca"],
    [s.simulacoes, s.simulacoesLead, "/laboratorios/simulacoes"],
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.eyebrow} title={s.title}>
        {s.lead}
      </PageHeading>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {itens.map(([nome, lead, path]) => (
          <Link key={path} href={localePath(lang, path)} className="group border border-rule bg-parchment-deep p-5 hover:border-gold">
            <p className="text-2xl font-semibold group-hover:text-oxblood">{nome}</p>
            <p className="mt-1 text-ink-soft">{lead}</p>
          </Link>
        ))}
      </div>
      <p className="mt-8 border-2 border-ink bg-parchment-deep p-4 font-sans text-sm">
        <Link href={localePath(lang, "/sala-livre")} className="font-bold underline hover:text-oxblood">{t.nav.freeRoom} →</Link> {t.salaLivre.description}
      </p>
      <p className="mt-10 border-t border-rule pt-5 font-sans text-sm text-ink-soft">
        <Link href={localePath(lang, "/creditos")} className="underline hover:text-oxblood">{s.creditos}</Link>
      </p>
    </div>
  );
}
