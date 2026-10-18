// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Todo buscador pode indexar o conteúdo público: um único bloco "*" libera tudo, menos as áreas privadas.
// O Baiduspider (busca chinesa, para /zh) e o YandexBot (busca russa, para /ru) ganham um bloco próprio e
// explícito, porque alguns deles ignoram o "*" quando há qualquer outro bloco no arquivo.
// Robôs que só coletam texto para TREINAR modelos de IA ficam de fora: é a escolha do instituto, e não afeta a busca.
const treinoDeIA = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "CCBot", "Google-Extended", "anthropic-ai", "ClaudeBot", "Claude-Web", "Bytespider", "PerplexityBot", "Amazonbot", "cohere-ai", "Applebot-Extended", "meta-externalagent", "FacebookBot", "Diffbot", "omgili", "Timpibot", "ImagesiftBot", "YouBot", "AI2Bot", "PetalBot"];

// O que nem os buscadores precisam ver: o painel, a entrada, a busca interna e as páginas que só fazem
// sentido para quem está usando o site naquele momento. A rádio (diretório de emissoras) é pública.
const fechado = ["/*/painel", "/*/entrar", "/*/certificado", "/*/meus-dados", "/*/busca", "/*/denunciar", "/*/reforco", "/*/fora-do-ar", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: fechado },
      { userAgent: ["Baiduspider", "YandexBot"], allow: "/", disallow: fechado },
      { userAgent: treinoDeIA, disallow: "/" },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
