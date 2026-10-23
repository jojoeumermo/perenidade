// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { Selo } from "@/components/Selo";
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
  const itens: [string, string, string, string][] = [
    [s.ide, s.ideLead, "/laboratorios/ide", "terminal"],
    [s.redes, s.redesLead, "/laboratorios/redes", "rede"],
    [s.linux, s.linuxLead, "/laboratorios/linux", "pinguim"],
    [s.montador, s.montadorLead, "/laboratorios/montador", "chip"],
    [s.eletrica, s.eletricaLead, "/laboratorios/eletrica", "raio"],
    [s.ia, s.iaLead, "/laboratorios/ia", "rede-neural"],
    [s.modelos, s.modelosLead, "/laboratorios/modelos", "probabilidade"],
    [s.quimica, s.quimicaLead, "/laboratorios/quimica", "tubo"],
    [s.escritorio, s.escritorioLead, "/laboratorios/escritorio", "folha"],
    [s.design, s.designLead, "/laboratorios/design", "paleta"],
    [s.seguranca, s.segurancaLead, "/laboratorios/seguranca", "escudo"],
    [s.simulacoes, s.simulacoesLead, "/laboratorios/simulacoes", "microscopio"],
  ];
  return (
    <>
      <section className="pont border-b-[3px] border-ink">
        <div className="mx-auto max-w-[78rem] px-4 pt-12 pb-10 sm:px-6 lg:px-8">
          <PageHeading eyebrow={s.eyebrow} title={s.title}>
            {s.lead}
          </PageHeading>
        </div>
      </section>
      <div className="mx-auto max-w-[78rem] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map(([nome, lead, path, selo], i) => (
            <Link key={path} href={localePath(lang, path)} className={`sobe group flex flex-col p-5 text-ink hover:text-ink ${i % 2 ? "cartao-v" : "cartao"}`}>
              <span className="flex items-start justify-between gap-3">
                <span className="selo h-14 w-14 group-hover:border-[#c21f16]">
                  <Selo nome={selo} className="h-9 w-9" />
                </span>
                <span className="font-mono text-xs text-ink-soft">Nº {String(i + 1).padStart(2, "0")}</span>
              </span>
              <span className="mt-4 block text-2xl font-semibold leading-tight">{nome}</span>
              <span className="mt-1.5 block leading-snug text-ink-soft">{lead}</span>
              <span className="mt-auto pt-4 font-sans text-sm font-bold">→</span>
            </Link>
          ))}
        </div>
        <p className="cartao-preto mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 p-5 font-sans text-sm">
          <Link href={localePath(lang, "/sala-livre")} className="botao botao-prelo botao-menor">
            {t.nav.freeRoom} →
          </Link>
          <span className="min-w-0 flex-1 text-[#e9dcbc]">{t.salaLivre.description}</span>
        </p>
        <p className="mt-10 border-t-2 border-ink pt-5 font-sans text-sm text-ink-soft">
          <Link href={localePath(lang, "/creditos")} className="underline hover:text-prelo-texto">{s.creditos}</Link>
        </p>
      </div>
    </>
  );
}
