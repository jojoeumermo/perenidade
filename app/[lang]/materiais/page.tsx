// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import QRCode from "qrcode";
import { Materials } from "@/components/Materials";
import { Cartaz } from "@/components/Cartaz";
import { KitDeDivulgacao } from "@/components/governanca/KitDeDivulgacao";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/materiais">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/materiais", t.materials.title, t.materials.description);
}

// Materiais para imprimir e distribuir: o kit de divulgação (desenhado aqui, pronto para imprimir) e os zines, panfletos,
// cartazes e banners publicados pela coordenação.
export default async function Materiais({ params }: PageProps<"/[lang]/materiais">) {
  const { lang, t } = await loadLang(params);
  const s = t.materials;
  // O QR code em vetor, gerado aqui no servidor pela biblioteca do próprio site.
  const qr = await QRCode.toString("https://institutolucia.org", { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.slogans.materiais} tone="vermelho">
        {s.lead}
      </Cartaz>
      {/* Faixa de agitação: raios vermelhos e letra de cartaz, no estilo dos cartazes revolucionários (desenho próprio). */}
      <p
        aria-hidden
        className="mt-8 overflow-hidden border-2 border-ink px-4 py-3 text-center font-black uppercase italic tracking-tight text-parchment"
        style={{ fontFamily: "var(--font-cartaz), 'Arial Narrow', Impact, sans-serif", fontSize: "clamp(1.1rem, 4vw, 2rem)", background: "repeating-conic-gradient(from 0deg at 50% 160%, #C21F16 0deg 5deg, #A51810 5deg 10deg)", boxShadow: "6px 6px 0 #1F1A14" }}
      >
        {lang === "pt" ? "★ Imprima · Cole · Passe adiante ★" : "★ ★ ★"}
      </p>
      <section id="kit" aria-labelledby="kit-titulo" className="mt-12 scroll-mt-28">
        <h2 id="kit-titulo" className="tarja tarja-v">
          <span className="tarja-nome">★ {s.kitTitle}</span>
        </h2>
        <p className="mt-3 max-w-3xl font-sans text-sm text-ink-soft">{s.kitLead}</p>
        <KitDeDivulgacao qr={qr} email={site.newsletter} />
      </section>
      <section aria-labelledby="da-coordenacao" className="mt-16">
        <h2 id="da-coordenacao" className="tarja">
          <span className="tarja-nome">{s.fromTeam}</span>
        </h2>
        <Materials s={s} />
      </section>
    </div>
  );
}
