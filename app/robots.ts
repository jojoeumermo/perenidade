// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// A regra é ao contrário do costume: ninguém entra, a não ser quem está na lista.
// Entram os buscadores (para o site aparecer nas buscas), os robôs que montam a prévia de um link
// colado em uma conversa e o arquivo da internet, que guarda cópias para o futuro.
const buscadores = ["Googlebot", "Googlebot-Image", "Bingbot", "DuckDuckBot", "Applebot", "YandexBot", "Baiduspider", "Qwantbot", "Ecosia", "MojeekBot", "SeznamBot"];
const previas = ["facebookexternalhit", "Twitterbot", "WhatsApp", "TelegramBot", "LinkedInBot", "Slackbot", "Discordbot", "Mastodon", "Signal"];
const arquivo = ["archive.org_bot", "ia_archiver"];

// O que nem os buscadores precisam ver: o painel, a entrada, a busca interna e as páginas que só fazem
// sentido para quem está usando o site naquele momento.
const fechado = ["/*/painel", "/*/entrar", "/*/radio", "/*/certificado", "/*/meus-dados", "/*/busca", "/*/denunciar", "/*/reforco", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...buscadores, ...previas, ...arquivo], allow: "/", disallow: fechado },
      { userAgent: "*", disallow: "/" },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
