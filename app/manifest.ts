// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import pt from "@/i18n/pt.json";
import { site } from "@/lib/site";

// Permite "instalar" o site na tela inicial do celular e abri-lo como um aplicativo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/pt",
    name: site.name,
    short_name: "Lúcia",
    description: pt.meta.description,
    lang: "pt-BR",
    start_url: "/pt",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    dir: "ltr",
    prefer_related_applications: false,
    background_color: "#f4ecd8",
    theme_color: "#6e1f1a",
    categories: ["education", "books"],
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Ícone com margem de segurança: o Android recorta em círculo, gota ou quadrado sem comer a estrela e o livro.
      { src: "/icone-recorte-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: pt.nav.disciplines, url: "/pt/trilhas" },
      { name: pt.nav.library, url: "/pt/acervo" },
      { name: pt.nav.community, url: "/pt/comunidade" },
      { name: pt.nav.radio, url: "/pt/radio" },
    ],
  };
}
