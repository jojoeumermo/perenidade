// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Todo buscador pode indexar o conteúdo público: um único bloco "*" libera tudo, menos as áreas privadas.
// O Baiduspider (busca chinesa, para /zh) e o YandexBot (busca russa, para /ru) ganham um bloco próprio e
// explícito, porque alguns deles ignoram o "*" quando há qualquer outro bloco no arquivo.
// Robôs de IA, conforme site.robosDeIA. Os de TREINO só coletam texto para treinar modelos; os de BUSCA respondem
// perguntas citando e linkando a página (como um buscador), e por isso entram no padrão "bloquear-treino".
const treinoDeIA = ["GPTBot", "CCBot", "Google-Extended", "anthropic-ai", "ClaudeBot", "Claude-Web", "Bytespider", "Amazonbot", "cohere-ai", "Applebot-Extended", "meta-externalagent", "FacebookBot", "Diffbot", "omgili", "Timpibot", "ImagesiftBot", "YouBot", "AI2Bot", "PetalBot"];
const buscaComIA = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User"];
const bloqueadosDeIA = site.robosDeIA === "permitir-todos" ? [] : site.robosDeIA === "bloquear-todos" ? [...treinoDeIA, ...buscaComIA] : treinoDeIA;

// O que nem os buscadores precisam ver: o painel, a entrada, a busca interna e as páginas que só fazem
// sentido para quem está usando o site naquele momento. A rádio (diretório de emissoras) é pública.
const fechado = ["/*/painel", "/*/entrar", "/*/certificado", "/*/meus-dados", "/*/busca", "/*/denunciar", "/*/reforco", "/*/fora-do-ar", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: fechado },
      { userAgent: ["Baiduspider", "YandexBot"], allow: "/", disallow: fechado },
      ...(bloqueadosDeIA.length ? [{ userAgent: bloqueadosDeIA, disallow: "/" }] : []),
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
