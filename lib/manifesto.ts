// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O manifesto do aplicativo (ícone na tela inicial), um por idioma. Quem instala o site estando em /en abre /en, não /pt.
// O de /pt é igual ao padrão de app/manifest.ts (o mesmo código monta os dois). Cada idioma é servido em
// /[lang]/manifest.webmanifest (app/[lang]/manifest.webmanifest/route.ts) e ligado pelo layout daquele idioma.
// Sem leitura de disco: só os dicionários que o site já carrega.
import type { MetadataRoute } from "next";
import { htmlLang, localePath, type Locale } from "@/i18n/config";
import { site } from "@/lib/site";

/** Só as frases do dicionário que o manifesto usa. */
export interface TextosDoManifesto {
  meta: { title: string; description: string };
  nav: { disciplines: string; library: string; community: string; radio: string };
}

export function montarManifesto(lang: Locale, t: TextosDoManifesto): MetadataRoute.Manifest {
  const inicio = localePath(lang, "/");
  return {
    // O id é o idioma: quem já instalou /pt continua com o mesmo aplicativo.
    id: `/${lang}`,
    // Nome completo na lista de aplicativos; o nome curto cabe embaixo do ícone (até uns 12 caracteres).
    name: t.meta.title,
    short_name: "Lúcia",
    description: `${site.name}, ${site.lema}. ${t.meta.description}`,
    lang: htmlLang[lang],
    start_url: inicio,
    // O escopo é o site todo: trocar de idioma dentro do aplicativo não abre o navegador.
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    dir: "ltr",
    prefer_related_applications: false,
    background_color: "#f8f5ee",
    theme_color: "#6e1f1a",
    categories: ["education", "books"],
    icons: [
      { src: "/marca-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/marca-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Ícone com margem de segurança: o Android recorta em círculo, gota ou quadrado sem comer a estrela e o livro.
      { src: "/marca-recorte-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t.nav.disciplines, url: localePath(lang, "/trilhas") },
      { name: t.nav.library, url: localePath(lang, "/acervo") },
      { name: t.nav.community, url: localePath(lang, "/comunidade") },
      { name: t.nav.radio, url: localePath(lang, "/radio") },
    ],
  };
}
