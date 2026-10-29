// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { MuroDoMemorial } from "@/components/memorial/MuroDoMemorial";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { fill, localePath } from "@/i18n/config";
import { getTributes } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/memorial">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/memorial", t.memorial.title, t.memorial.lead);
}

export default async function Memorial({ params }: PageProps<"/[lang]/memorial">) {
  const { lang, t } = await loadLang(params);
  const tributes = getTributes(lang);
  const anos = tributes.map((tribute) => Number(tribute.died)).filter(Number.isFinite);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow={t.memorial.eyebrow} title={t.memorial.title} slogan={t.slogans.memorial} tone="luto">
        {t.memorial.lead}
      </Cartaz>
      <Untranslated lang={lang} t={t} show={tributes.some((tribute) => !tribute.translated)} />

      {/* A placa: as contas tiradas das próprias fichas. */}
      <p className="mt-8 max-w-3xl border-l-8 border-ink pl-5 font-serif text-2xl italic leading-snug text-balance">
        {fill(t.memorial.plaque, { n: String(tributes.length), de: String(Math.min(...anos)), ate: String(Math.max(...anos)) })}
      </p>

      <MuroDoMemorial
        s={t.memorial}
        pessoas={tributes.map((tribute) => ({
          id: tribute.slug,
          nome: tribute.name,
          anos: tribute.born === "—" ? tribute.died : `${tribute.born} – ${tribute.died}`,
          local: tribute.place,
          regiao: tribute.region,
          foto: tribute.photo,
          credito: tribute.photoCredit,
          fonte: tribute.photoSource,
          texto: tribute.body,
          idioma: originalLang(tribute.translated),
        }))}
      />

      <div className="no-print mt-14 grid gap-3 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <p className="max-w-3xl">{t.memorial.noPortrait}</p>
        <p>
          {t.memorial.add}{" "}
          <Link href={localePath(lang, "/contribuir")} className="underline hover:text-oxblood">{t.memorial.addLink}</Link>.
        </p>
      </div>
    </div>
  );
}
