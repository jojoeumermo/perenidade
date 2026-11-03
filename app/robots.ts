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
// Também as cópias que só gastam a cota quando um robô as percorre: o texto puro e a zine de cada aula (a aula já está
// liberada), os arquivos .json (índices de busca e dados que as páginas carregam sob pedido) e o original das trilhas
// usado pelo painel de traduções. O "$" casa com o fim do endereço.
const fechado = [
  "/*/painel",
  "/*/entrar",
  "/*/certificado",
  "/*/meus-dados",
  "/*/busca",
  "/*/denunciar",
  "/*/reforco",
  "/*/fora-do-ar",
  "/api/",
  "/*/trilhas/*/*/texto$",
  "/*/trilhas/*/*/zine$",
  "/*.json$",
  "/*/original/",
];
// O /.well-known/ continua aberto (o assetlinks.json do aplicativo Android é .json): pela regra do Google, a regra mais
// longa vence, e "/.well-known/" é mais longa que "/*.json$". O obras.json e o indice-leve.json também ficam abertos: as
// páginas públicas os buscam no navegador, e o renderizador do Google precisa deles para ver a página como ela é.
const aberto = ["/", "/.well-known/", "/*/obras.json$", "/*/indice-leve.json$"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: aberto, disallow: fechado },
      { userAgent: ["Baiduspider", "YandexBot"], allow: aberto, disallow: fechado },
      ...(bloqueadosDeIA.length ? [{ userAgent: bloqueadosDeIA, disallow: "/" }] : []),
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
