// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O manifesto do aplicativo (ícone na tela inicial), um por idioma. Quem instala o site estando em /en abre /en, não /pt.
// O de /pt é igual ao padrão de app/manifest.ts (o mesmo código monta os dois). Cada idioma é servido em
// /[lang]/manifest.webmanifest (app/[lang]/manifest.webmanifest/route.ts) e ligado pelo layout daquele idioma.
// Sem leitura de disco: só os dicionários que o site já carrega.
import type { MetadataRoute } from "next";
import { htmlLang, localePath, type Locale } from "@/i18n/config";
import { site } from "@/lib/site";
import { textosDoApp } from "@/components/app/textos";
import capturas from "./capturas-app.json";

/** Uma captura de tela do aplicativo para o convite de instalação (preenchida por scripts/gerar-capturas-app.mjs). */
interface CapturaDoApp {
  src: string;
  sizes: string;
  type: string;
  form_factor: "narrow" | "wide";
  /** A aba mostrada (components/app/modo.ts): o texto do rótulo vem do idioma. */
  aba: "inicio" | "estudar" | "jogos" | "comunidade" | "eu";
}
const CAPTURAS = (capturas as { capturas: CapturaDoApp[] }).capturas;

/** Só as frases do dicionário que o manifesto usa. */
export interface TextosDoManifesto {
  meta: { title: string; description: string };
  nav: { disciplines: string; library: string; community: string; radio: string };
}

export function montarManifesto(lang: Locale, t: TextosDoManifesto): MetadataRoute.Manifest {
  const abas = textosDoApp(lang).abas;
  const icone = { src: "/marca-96.png", sizes: "96x96", type: "image/png" };
  return {
    // O id é o idioma: quem já instalou /pt continua com o mesmo aplicativo.
    id: `/${lang}`,
    // Nome completo na lista de aplicativos; o nome curto cabe embaixo do ícone (até uns 12 caracteres).
    name: t.meta.title,
    short_name: "Lúcia",
    description: `${site.name}, ${site.lema}. ${t.meta.description}`,
    lang: htmlLang[lang],
    // O aplicativo abre na própria Início do app (/app), não no site: quem instala quer o aplicativo.
    start_url: localePath(lang, "/app"),
    // O escopo é o site todo: trocar de idioma dentro do aplicativo não abre o navegador.
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    // Sem travar a tela: leitura e laboratórios pedem retrato e paisagem; quem usa o aparelho apoiado precisa girar.
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
    // Os atalhos do ícone (toque longo). Os três primeiros são abas do aplicativo; a Alumia ficou de fora
    // porque não existe no aplicativo instalado. Os dois últimos (acervo e rádio) seguem no site.
    shortcuts: [
      { name: abas.estudar, short_name: abas.estudar, description: t.nav.disciplines, url: localePath(lang, "/app/estudar"), icons: [icone] },
      { name: abas.jogos, short_name: abas.jogos, url: localePath(lang, "/app/jogos"), icons: [icone] },
      { name: abas.eu, short_name: abas.eu, url: localePath(lang, "/app/eu"), icons: [icone] },
      { name: t.nav.library, url: localePath(lang, "/acervo"), icons: [icone] },
      { name: t.nav.radio, url: localePath(lang, "/radio"), icons: [icone] },
    ],
    // Vazio até alguém rodar npm run gerar:capturas-app com o site no ar (precisa do Playwright); aí o convite de instalação mostra as telas.
    ...(CAPTURAS.length > 0 ? { screenshots: CAPTURAS.map((c) => ({ src: c.src, sizes: c.sizes, type: c.type, form_factor: c.form_factor, label: abas[c.aba] })) } : {}),
  };
}
