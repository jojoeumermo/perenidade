import Link from "next/link";
import { defaultLocale, htmlLang, localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/pt";

/** Aviso exibido quando o conteúdo aparece em português por falta de tradução. */
export function Untranslated({ lang, t, show }: { lang: Locale; t: Dict; show: boolean }) {
  if (!show) return null;
  return (
    <p className="no-print mt-6 border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">
      {t.common.notTranslated}{" "}
      <Link href={localePath(lang, "/voluntarios")} className="underline hover:text-oxblood">
        {t.common.helpTranslate}
      </Link>
      .
    </p>
  );
}

/** Atributos para marcar um bloco que está no idioma original (leitores de tela e leitura em voz alta). */
export function originalLang(translated: boolean) {
  return translated ? {} : { lang: htmlLang[defaultLocale], "data-content-lang": htmlLang[defaultLocale] };
}
