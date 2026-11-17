// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A marca da Alumia fora da tela: o cartão de compartilhamento (public/cartao-alumia.png, 1200 × 630), os ícones da aba e da tela
// inicial (public/alumia/, gerados do lampião por scripts/gerar-icones-alumia.mjs) e o manifesto próprio. Valem em TODAS as
// páginas de /[lang]/alumia (o layout dela); o resto do site continua com o cartão e os ícones do Instituto
// (app/[lang]/layout.tsx). Sem leitura de disco: só os textos que o site já carrega. Sem os atalhos "@/" (roda no Node nos testes).
import type { Metadata, MetadataRoute } from "next";
import { htmlLang, type Locale } from "../../i18n/config";
import { site } from "../site";
import { textosDaRede } from "./textos";

/** A noite das pranchas: o fundo dos ícones, da tela de abertura e da barra do aplicativo instalado. */
const NOITE = "#0f0e0d";

/** O cartão de compartilhamento da Alumia (o mesmo em todas as páginas dela: nenhuma prévia leva o texto de um post). */
export const CARTAO_DA_ALUMIA = { url: "/cartao-alumia.png", width: 1200, height: 630 } as const;

/** A imagem do cartão, no formato do openGraph e do twitter, com o nome da rede como texto alternativo. */
export function imagensDaAlumia(lang: Locale) {
  const s = textosDaRede(lang);
  const imagem = { ...CARTAO_DA_ALUMIA, alt: `${s.marca}, ${s.alumia.lema}` };
  return { openGraph: [imagem], twitter: [{ url: imagem.url, alt: imagem.alt }] };
}

/**
 * Os metadados que a Alumia inteira herda: o cartão (openGraph e twitter, no lugar do /cartao-lucia.png do site), os ícones da
 * aba e do iPhone, e o manifesto próprio. Uma página que define o próprio openGraph precisa repetir a imagem (o Next troca o
 * openGraph inteiro): use `imagensDaAlumia`.
 */
export function metadadosDaMarcaDaAlumia(lang: Locale): Metadata {
  const s = textosDaRede(lang);
  const imagens = imagensDaAlumia(lang);
  return {
    openGraph: { type: "website", locale: htmlLang[lang], siteName: s.marca, title: s.marca, description: s.alumia.descricao, images: imagens.openGraph },
    twitter: { card: "summary_large_image", title: s.marca, description: s.alumia.descricao, images: imagens.twitter },
    icons: {
      // O vetorial vem primeiro e com sizes="any": o navegador escolhe ele no lugar do /favicon.ico do site, que o Next põe em
      // toda página (o arquivo de app/ não se troca por segmento). Os PNG ficam para quem não lê SVG.
      icon: [
        { url: "/alumia/icone.svg", sizes: "any", type: "image/svg+xml" },
        { url: "/alumia/icone-32.png", sizes: "32x32", type: "image/png" },
        { url: "/alumia/icone-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/alumia/apple-icone-180.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: `/${lang}/alumia/manifest.webmanifest`,
    appleWebApp: { capable: true, title: s.marca, statusBarStyle: "black" },
  };
}

/**
 * O manifesto da Alumia (app/[lang]/alumia/manifest.webmanifest): quem instala estando na Alumia ganha o lampião na tela inicial
 * e abre direto na rede. O id é outro que o do site (/[lang]), então os dois aplicativos convivem. O escopo é o site todo, como no
 * do Instituto: o "Voltar ao site" não abre o navegador.
 */
export function montarManifestoDaAlumia(lang: Locale): MetadataRoute.Manifest {
  const s = textosDaRede(lang);
  return {
    id: `/${lang}/alumia`,
    name: `${s.marca} · ${site.name}`,
    short_name: s.marca,
    description: s.alumia.descricao,
    lang: htmlLang[lang],
    start_url: `/${lang}/alumia`,
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    dir: "ltr",
    prefer_related_applications: false,
    background_color: NOITE,
    theme_color: NOITE,
    categories: ["social", "education"],
    icons: [
      { src: "/alumia/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/alumia/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // O lampião inteiro cabe no círculo seguro (80% do lado): o mesmo arquivo serve recortado em círculo, gota ou quadrado.
      { src: "/alumia/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
