// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Robôs que copiam sites inteiros para treinar produtos comerciais. O acervo é livre para gente e para
// buscadores; para esse uso, pedimos que fiquem de fora.
const scrapers = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "CCBot", "Google-Extended", "anthropic-ai", "ClaudeBot", "Claude-Web", "Bytespider", "Amazonbot", "PerplexityBot", "meta-externalagent", "FacebookBot", "Applebot-Extended", "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "YouBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // O painel, a entrada, a rádio e a conferência de certificados não têm nada para os buscadores.
      { userAgent: "*", allow: "/", disallow: ["/*/painel", "/*/entrar", "/*/radio", "/*/certificado", "/*/meus-dados"] },
      { userAgent: scrapers, disallow: "/" },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
