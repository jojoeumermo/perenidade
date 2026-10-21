// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { KitDeDivulgacao } from "@/components/governanca/KitDeDivulgacao";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import QRCode from "qrcode";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/divulgue">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("divulgue", lang);
  return paginaMeta(lang, "/divulgue", page.title, page.lead);
}

export default async function Divulgue({ params }: PageProps<"/[lang]/divulgue">) {
  const { lang, t } = await loadLang(params);
  // O QR code em vetor, gerado aqui no servidor pela biblioteca do próprio site.
  const qr = await QRCode.toString("https://institutolucia.org", { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return (
    <ContentPageView slug="divulgue" lang={lang} t={t} indice={false}>
      <KitDeDivulgacao qr={qr} email={site.newsletter} />
    </ContentPageView>
  );
}
