// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os laboratórios são a casa do t.labs no navegador (i18n/core.ts): o provedor daqui cobre a página do mapa e cada
// laboratório, sem mandar a seção nas rotas que não a usam.
import { I18nProvider } from "@/components/I18n";
import { loadLang } from "@/i18n";
import { pickSections } from "@/i18n/core";

export default async function LayoutDosLaboratorios({ children, params }: LayoutProps<"/[lang]/laboratorios">) {
  const { lang, t } = await loadLang(params);
  return (
    <I18nProvider lang={lang} t={pickSections(t, ["labs"])}>
      {children}
    </I18nProvider>
  );
}
