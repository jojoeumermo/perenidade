// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";

// O aviso que cobre a Alumia inteira enquanto o recurso "alumia-aberta" está desligado (app/[lang]/alumia/layout.tsx). Sem script,
// sem chamada ao banco e sem nada guardado: só o recado, a faixa tecida e o caminho de volta ao site.

const TEXTOS: Record<Locale, { selo: string; titulo: string; texto: string; voltar: string }> = {
  pt: {
    selo: "Em construção",
    titulo: "A Alumia ainda está sendo erguida",
    texto: "A rede social do Instituto Lúcia abre quando estiver pronta, segura e inteira. Até lá, o resto do site funciona normalmente.",
    voltar: "Voltar ao site",
  },
  en: {
    selo: "Under construction",
    titulo: "Alumia is still being built",
    texto: "Instituto Lúcia's social network opens once it is ready, safe and complete. Until then, the rest of the site works as usual.",
    voltar: "Back to the site",
  },
  es: {
    selo: "En construcción",
    titulo: "Alumia todavía se está levantando",
    texto: "La red social del Instituto Lúcia abre cuando esté lista, segura y completa. Mientras tanto, el resto del sitio funciona con normalidad.",
    voltar: "Volver al sitio",
  },
  fr: {
    selo: "En construction",
    titulo: "Alumia est encore en chantier",
    texto: "Le réseau social de l'Instituto Lúcia ouvrira lorsqu'il sera prêt, sûr et complet. En attendant, le reste du site fonctionne normalement.",
    voltar: "Retour au site",
  },
  ru: {
    selo: "Идёт строительство",
    titulo: "Алюмия ещё строится",
    texto: "Социальная сеть Института Лусии откроется, когда будет готова, безопасна и завершена. А пока остальной сайт работает как обычно.",
    voltar: "Вернуться на сайт",
  },
  zh: {
    selo: "建设中",
    titulo: "Alumia 仍在建设中",
    texto: "Lúcia 学院的社交网络将在完备、安全、完整之后开放。在此之前，网站的其他部分照常运行。",
    voltar: "返回网站",
  },
};

// As cores da faixa tecida das pranchas (vermelho, ouro, creme sobre a noite), em 11 listras.
const LISTRAS = ["#e8321f", "#ffc21a", "#f3efe6", "#e8321f", "#0f0e0d", "#ffc21a", "#0f0e0d", "#e8321f", "#f3efe6", "#ffc21a", "#e8321f"];

export function EmConstrucao({ lang, site, className }: { lang: Locale; site: string; className?: string }) {
  const t = TEXTOS[lang] ?? TEXTOS.pt;
  return (
    <main className={`al-obras ${className ?? ""}`} lang={lang} aria-labelledby="al-obras-titulo">
      <meta name="robots" content="noindex" />
      <style href="al-obras" precedence="medium">{`
.al-obras{position:fixed;inset:0;z-index:2147483000;overflow:auto;background:#0f0e0d;color:#f3efe6;color-scheme:dark;
  display:grid;grid-template-rows:auto 1fr auto;font-family:var(--al-fonte-archivo,"Archivo Narrow","Arial Narrow",system-ui,sans-serif)}
.al-obras__faixa{display:grid;grid-template-columns:repeat(11,1fr);height:14px}
.al-obras__corpo{display:grid;align-content:center;justify-items:start;gap:28px;width:min(100%,880px);margin:0 auto;
  padding-block:64px;padding-left:max(24px,env(safe-area-inset-left,0px));padding-right:max(24px,env(safe-area-inset-right,0px))}
.al-obras__selo{display:inline-block;border:3px solid #ffc21a;color:#ffc21a;padding:6px 14px 4px;font-weight:800;font-stretch:62%;
  text-transform:uppercase;letter-spacing:.08em;font-size:clamp(15px,1.6vw,19px);transform:rotate(-2.5deg)}
.al-obras__titulo{margin:0;font-weight:900;font-stretch:62%;text-transform:uppercase;line-height:.9;letter-spacing:-.01em;
  font-size:clamp(46px,8.4vw,112px);text-wrap:balance}
.al-obras__titulo span{color:#e8321f}
.al-obras__texto{margin:0;max-width:56ch;font-family:system-ui,sans-serif;font-size:clamp(16px,1.35vw,19px);line-height:1.55;color:#d9d3c7}
.al-obras__voltar{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:0 22px;background:#e8321f;color:#0f0e0d;
  font-weight:800;font-stretch:62%;text-transform:uppercase;letter-spacing:.06em;font-size:18px;text-decoration:none}
.al-obras__voltar:hover{background:#ffc21a}
.al-obras__voltar:focus-visible{outline:3px solid #f3efe6;outline-offset:4px}
.al-obras__ladrilhos{display:grid;grid-template-columns:repeat(24,1fr);gap:3px;padding:0 0 3px}
.al-obras__ladrilhos i{aspect-ratio:1;background:#1c1a18}
.al-obras__ladrilhos i:nth-child(7n+3){background:#e8321f}
.al-obras__ladrilhos i:nth-child(11n+5){background:#ffc21a}
.al-obras__ladrilhos i:nth-child(13n+8){background:#f3efe6}
@media (max-width:600px){.al-obras__ladrilhos{grid-template-columns:repeat(12,1fr)}.al-obras__ladrilhos i:nth-child(n+25){display:none}}
`}</style>
      <div className="al-obras__faixa" aria-hidden="true">
        {LISTRAS.map((cor, i) => (
          <span key={i} style={{ background: cor }} />
        ))}
      </div>
      <div className="al-obras__corpo">
        <p className="al-obras__selo">{t.selo}</p>
        <h1 id="al-obras-titulo" className="al-obras__titulo">
          {t.titulo}
          <span aria-hidden="true">.</span>
        </h1>
        <p className="al-obras__texto">{t.texto}</p>
        <a className="al-obras__voltar" href={site}>
          <span aria-hidden="true">←</span> {t.voltar}
        </a>
      </div>
      <div className="al-obras__ladrilhos" aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
    </main>
  );
}
