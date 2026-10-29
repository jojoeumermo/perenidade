// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { FaixaDaRadio } from "@/components/radio/FaixaDaRadio";
import { RadioLuciaAoVivo } from "@/components/RadioLuciaAoVivo";
import { RadioPage, type Station } from "@/components/RadioPage";
import stations from "@/content/radios.json";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/radio">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/radio", t.radio.title, t.radio.lead);
}

/** O diretório das rádios do povo: o lambe-lambe no alto, o que está tocando e a lista por frente. */
export default async function Radio({ params }: PageProps<"/[lang]/radio">) {
  const { lang, t } = await loadLang(params);
  const lista = stations as Station[];
  return (
    <div className="pont">
      <div className="mx-auto flex max-w-[78rem] flex-col gap-7 px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-12">
        <FaixaDaRadio
          lang={lang}
          s={t.radioPagina}
          slogan={t.slogans.radio}
          emissoras={lista.length}
          tocamAqui={lista.filter((station) => station.transmissao).length}
          frentes={new Set(lista.map((station) => station.frente)).size}
        />
        <RadioLuciaAoVivo />
        <RadioPage stations={lista} s={t.radioPagina} />
      </div>
    </div>
  );
}
