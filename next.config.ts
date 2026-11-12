// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { NextConfig } from "next";
import { SERVIDORES_JITSI } from "./lib/jitsi";
import { GALENE_URL } from "./lib/aula-sala";
import { ORIGENS_DAS_FIGURAS } from "./lib/figuras-da-prova";
import { ligado } from "./lib/recursos";

const dev = process.env.NODE_ENV !== "production";

/** Endereço do serviço de contas, quando configurado. É o único destino externo que o site pode chamar. */
function serviceOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
}
const service = serviceOrigin();
// O canal de tempo real do serviço (avisos entre painéis, sala das aulas ao vivo) é o mesmo endereço, por WebSocket.
const realtime = service.replace(/^https:/, "wss:");

// Desafio contra robôs da página de entrada: o único programa que o site carrega de fora.
const captcha = "https://challenges.cloudflare.com";
// A sala de vídeo (Sala Lúcia, Reuniões e estudo em grupo): os servidores Jitsi de lib/jitsi.ts (públicos, sem limite
// de tempo nem login de moderador); troca-se por um próprio em NEXT_PUBLIC_JITSI_DOMAIN.
const jitsi = SERVIDORES_JITSI.map((d) => `https://${d}`).join(" ");
// Na Permissions-Policy cada origem vai entre aspas.
// A sala própria das aulas ao vivo (Galène, infra/aula-ao-vivo/): só com NEXT_PUBLIC_GALENE_URL; entra nos quadros e nas permissões de câmera.
const galene = GALENE_URL;
const jitsiPermitidos = [...SERVIDORES_JITSI.map((d) => `https://${d}`), ...(galene ? [galene] : [])].map((o) => `"${o}"`).join(" ");
// Vídeos de aula ficam em outros sites e só carregam quando a pessoa clica. Servidores PeerTube entram por NEXT_PUBLIC_VIDEO_HOSTS.
const videos = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  ...(process.env.NEXT_PUBLIC_VIDEO_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host))
    .map((host) => `https://${host}`),
].join(" ");

// As páginas dos coletivos (Territórios) trazem o vídeo do anúncio no quadro oficial do Instagram, que só é criado depois do clique.
const instagram = "https://www.instagram.com";

// O Estúdio de prática: os editores (FilmCraft, Blockbench…) abrem dentro das páginas do site, num quadro de outra
// origem (estudio.institutolucia.org), para não alcançarem a sessão nem os dados do instituto.
const estudio = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_ESTUDIO_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// VLibras (recurso "vlibras", desligado por padrão): o tradutor de Libras do Governo Federal (lib/vlibras.ts). Só com o
// recurso ligado a política libera o endereço oficial (vlibras.gov.br, que entrega o quadro do avatar e redireciona o
// resto), o repositório oficial dele no jsDelivr (só esse caminho) e os serviços do governo (*.vlibras.gov.br: tradução
// e dicionário). O avatar roda dentro do quadro, com a política dele: a página não precisa liberar WebAssembly. Ele só
// carrega depois do clique de quem quer usar, e outros destinos que tente (métricas de terceiros) ficam bloqueados.
// Desligado, nada aqui muda.
const vlibrasCodigo = ligado("vlibras") ? " https://vlibras.gov.br https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/" : "";
const vlibras = ligado("vlibras") ? `${vlibrasCodigo} https://*.vlibras.gov.br` : "";

// Para onde o navegador avisa o que a política de segurança bloqueou (o coletor do painel Sentinela Lúcia).
// Sem a variável, nada muda: a política continua a mesma, só deixa de relatar. O endereço é público por natureza.
const reportUrl = (process.env.CSP_REPORT_URL ?? "").trim();
const reporting = /^https:\/\/[a-z0-9.-]+(:\d+)?(\/[^\s"';]*)?$/i.test(reportUrl) ? reportUrl : "";

// Laboratórios externos (docs/LABS-EXTERNOS.md): só entram num quadro depois que a pessoa clica em "Abrir". The Evolution of Trust
// (tradução em português do Bruno Lemos), NetLogo Web (modelos oficiais, sem cópia) e GeoGebra (calculadora, sem cópia).
const labsExternos = "https://brunolemos.github.io https://netlogoweb.org https://www.geogebra.org";

// A ponte de sessão (login único, lib/sessao/ponte.ts e app/api/sessao/ponte): a Alumia e a Escola, nos endereços próprios,
// abrem um quadro escondido do site do instituto (/api/sessao/ponte) para trazer a entrada sem pedir a senha de novo. Por isso o
// site do instituto entra no frame-src das páginas, e o quadro da ponte só pode ser embutido pelos dois subdomínios.
const origemDoSiteParaPonte = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || (dev ? "http://localhost:3000" : "https://institutolucia.org")).origin;
  } catch {
    return "";
  }
})();
const quadroDaPonte = dev ? "http://localhost:*" : origemDoSiteParaPonte;
const quemEmbuteAPonte = (() => {
  if (dev) return "http://alumia.localhost:* http://escola.localhost:*";
  try {
    const host = new URL(origemDoSiteParaPonte).host;
    return `https://alumia.${host} https://escola.${host}`;
  } catch {
    return "'none'";
  }
})();
const politicaDaPonte = [
  "default-src 'none'",
  "script-src 'self'",
  `connect-src 'self' ${service}`.trim(),
  `frame-ancestors ${quemEmbuteAPonte}`,
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Fora o desafio da entrada, o site não carrega nada de terceiros: scripts, estilos e fontes vêm do próprio domínio.
const policy = (script: string) =>
  [
    "default-src 'self'",
    `script-src 'self' ${script}`,
    `style-src 'self' 'unsafe-inline'${vlibras}`,
    // blob: é a prévia de uma imagem antes do envio; o serviço de contas mostra à equipe as imagens ainda em revisão.
    // As figuras das provas públicas (Enem) vêm da fonte aberta que as transcreve (lib/figuras-da-prova.ts): só imagem,
    // sem referência da página de origem (as tags pedem no-referrer).
    `img-src 'self' data: blob: ${service} ${ORIGENS_DAS_FIGURAS.join(" ")}${vlibras}`.replace(/\s+/g, " ").trim(),
    `font-src 'self'${vlibras}`,
    `connect-src 'self' ${service} ${realtime}${dev ? " ws:" : ""}${vlibras}`.replace(/\s+/g, " ").trim(),
    // A rádio e o podcast tocam arquivos do próprio acervo ou a transmissão ao vivo indicada pela coordenação;
    // blob: é o áudio gravado ou escolhido no próprio aparelho (pergunta gravada, teste de microfone, corte de vídeo).
    `media-src 'self' https: blob: ${service}`.trim(),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // 'self': os laboratórios e editores do próprio site abertos dentro da Sala livre e da caixa das aulas (sem ele, o
    // navegador recusava o quadro e mostrava "este conteúdo está bloqueado"). blob: é a prévia, no próprio aparelho, de um
    // PDF ou DOCX recebido nas conversas (nunca um endereço de fora).
    `frame-src 'self' blob: ${captcha} ${jitsi} ${galene} https://phet.colorado.edu ${labsExternos} ${videos} ${instagram} ${estudio}${vlibrasCodigo} ${quadroDaPonte}`.trim(),
    // Só o próprio site embute as páginas dele (os laboratórios abrem dentro da caixa das aulas); ninguém de fora.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Relato das violações, nos dois formatos que os navegadores entendem (o antigo e o novo).
    ...(reporting ? [`report-uri ${reporting}`, "report-to sentinela"] : []),
  ].join("; ");

// 'unsafe-inline' é exigido pelos scripts de hidratação das páginas estáticas do Next.
const pages = policy(`'unsafe-inline' ${captcha} ${jitsi}${dev ? " 'unsafe-eval'" : ""}${vlibrasCodigo}`);
// Os interpretadores de Python e PHP rodam isolados em um Worker, sem acesso à página;
// só ali é permitido compilar WebAssembly e código gerado em tempo de execução.
const workers = policy("'wasm-unsafe-eval' 'unsafe-eval'");

const common = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // O microfone é pedido pelo afinador e pelo gravador do painel; a câmera e a tela, pelo gravador de aulas em vídeo e pela
  // sala das aulas ao vivo. Nada é pedido antes de a pessoa clicar. Os servidores Jitsi entram na lista: a sala de vídeo
  // (reuniões, chamadas, estudo em grupo) roda num quadro deles, e com só "self" o navegador negava câmera e microfone
  // ao quadro sem nem perguntar (a chamada abria muda e sem imagem).
  { key: "Permissions-Policy", value: `camera=(self ${jitsiPermitidos}), microphone=(self ${jitsiPermitidos}), display-capture=(self ${jitsiPermitidos}), fullscreen=(self ${jitsiPermitidos}), autoplay=(self ${jitsiPermitidos}), geolocation=(), payment=(), usb=(), interest-cohort=()` },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // O destino do "report-to" da política acima.
  ...(reporting ? [{ key: "Reporting-Endpoints", value: `sentinela="${reporting}"` }] : []),
];

// Os cabeçalhos do quadro da ponte: os mesmos da casa, MENOS os três que impedem um subdomínio de embutir ou de ler o quadro
// (X-Frame-Options, Cross-Origin-Opener-Policy e Cross-Origin-Resource-Policy). Quem pode embutir é a política da ponte que diz.
const cabecalhosDaPonte = [
  ...common.filter((c) => !["X-Frame-Options", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy", "Referrer-Policy"].includes(c.key)),
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Endereço que nenhuma rota atende ganha a página de app/global-not-found.tsx: o layout do site vive dentro de
  // [lang], e sem isso o Next mostrava a tela branca dele, em inglês.
  experimental: { globalNotFound: true },
  // O servidor de desenvolvimento não escreve arquivos de instrução na raiz do projeto.
  agentRules: false,
  // Na imagem do servidor próprio (Dockerfile), o Next junta num só lugar o servidor e só os pacotes que ele usa
  // ("standalone"). Fora dela (desenvolvimento, testes), nada muda.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // O build gera mais de dezesseis mil páginas. Na Vercel há um só processo para todas, com oito páginas ao mesmo tempo,
  // e o prazo de cada uma conta também a espera na fila: com o padrão de 60 s, até o robots.txt estourava quando o
  // processo estava ocupado, e o build caía (o mesmo commit passava numa tentativa e falhava na outra). Cinco minutos
  // por página tiram essa loteria sem esconder nada: uma página de fato travada continua derrubando o build.
  staticPageGenerationTimeout: 300,
  // As páginas que saem na primeira visita, e não no build, leem o conteúdo na hora: a aula e a obra nos idiomas sem
  // tradução (lib/params.ts), o texto puro da aula, o zine e o kit do núcleo. Isto garante que a função da Vercel leve
  // a pasta content/ junto, mesmo quando o rastreio automático não a enxerga.
  outputFileTracingIncludes: {
    "/*/trilhas/**": ["./content/**/*", "./historico/**/*"],
    "/*/acervo/*": ["./content/**/*", "./historico/**/*", "./public/capas/**/*"],
    // A aula da Escola de Formação (/escola/formacao/<caderno>/<aula>) também sai na primeira visita e lê as trilhas, o
    // léxico das vozes e os exercícios na hora.
    "/*/escola/formacao/**": ["./content/**/*"],
  },
  // Só em desenvolvimento: abrir o painel também em 127.0.0.1 faz de conta que é um segundo aparelho (outro navegador, outras
  // chaves), o que serve para testar a aprovação de aparelhos das conversas sem dois computadores.
  allowedDevOrigins: ["127.0.0.1"],
  // O otimizador de imagens (/_next/image) só serve o que o próprio build importou (o busto da dedicatória): nenhum
  // endereço de fora, nenhum arquivo enviado depois, nenhum SVG. Fecha a porta das falhas desse serviço para o resto.
  images: {
    // Na Vercel, os arquivos do build ficam em /_next/static/immutable/media; fora dela, em /_next/static/media.
    localPatterns: [
      { pathname: "/_next/static/media/**", search: "" },
      { pathname: "/_next/static/immutable/media/**", search: "" },
      // As fotos dos coletivos parceiros (public/territorios), usadas com autorização deles.
      { pathname: "/territorios/**", search: "" },
    ],
    remotePatterns: [],
    dangerouslyAllowSVG: false,
  },
  // O percurso Consciência de classe (antes Despertar, em /consciencia) saiu do site aberto e foi para dentro da Escola
  // (09/11/2026): os cadernos da Formação são o mesmo percurso. Os endereços antigos (/consciencia, /despertar e
  // /consciencia-de-classe), já espalhados em materiais e conversas, levam à Escola. Temporário (307) de propósito: dá
  // para voltar atrás sem os navegadores guardarem o desvio.
  async redirects() {
    return [
      { source: "/:lang(pt|en|es|fr|ru|zh)/consciencia", destination: "/:lang/escola", permanent: false },
      { source: "/consciencia", destination: "/pt/escola", permanent: false },
      { source: "/:lang(pt|en|es|fr|ru|zh)/despertar", destination: "/:lang/escola", permanent: false },
      { source: "/despertar", destination: "/pt/escola", permanent: false },
      { source: "/:lang(pt|en|es|fr|ru|zh)/consciencia-de-classe", destination: "/:lang/escola", permanent: false },
      { source: "/consciencia-de-classe", destination: "/pt/escola", permanent: false },
      // Os jogos saíram de Laboratórios e ganharam página própria (Etapa 5): o endereço antigo leva ao novo, para sempre (308).
      { source: "/:lang(pt|en|es|fr|ru|zh)/laboratorios/jogos", destination: "/:lang/jogos", permanent: true },
      { source: "/laboratorios/jogos", destination: "/pt/jogos", permanent: true },
      // F7 da Escola (docs/plano-2026-11/PLANO-ESCOLA.md, prancha Mapa): a Escola virou formação militante, fechada, e o
      // que não é formação militante voltou ao site aberto. Os cursos, o campus e a vida real saíram de /escola; os
      // endereços antigos (com e sem idioma, e tudo o que vem abaixo deles) levam ao novo para sempre (308).
      ...["cursos", "campus", "vida"].flatMap((secao) => [
        { source: `/:lang(pt|en|es|fr|ru|zh)/escola/${secao}/:resto*`, destination: `/:lang/${secao}/:resto*`, permanent: true },
        { source: `/escola/${secao}/:resto*`, destination: `/pt/${secao}/:resto*`, permanent: true },
      ]),
    ];
  },
  async headers() {
    return [
      // O quadro da ponte fica FORA da regra geral: ele precisa ser embutido por alumia. e escola. (frame-ancestors na política
      // própria, abaixo), e a regra geral manda X-Frame-Options: SAMEORIGIN. Navegador atual ignora o X-Frame-Options quando há
      // frame-ancestors, mas a ponte não pode depender disso.
      { source: "/((?!workers/|api/sessao/ponte(?:/|$)).*)", headers: [{ key: "Content-Security-Policy", value: pages }, ...common] },
      { source: "/workers/:path*", headers: [{ key: "Content-Security-Policy", value: workers }, ...common] },
      // O quadro da ponte de sessão: só os subdomínios embutem, só o próprio script roda, nada vai para o cache.
      { source: "/api/sessao/ponte/:resto*", headers: [{ key: "Content-Security-Policy", value: politicaDaPonte }, { key: "Cache-Control", value: "private, no-store" }, ...cabecalhosDaPonte] },
      // Os interpretadores são grandes e mudam raramente: o navegador pode guardá-los por uma semana.
      { source: "/(pyodide|php|typescript|lua|ruby|jscpp)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
      // Vozes naturais do "Ouvir a aula" (npm run vozes:baixar): a versão está no nome da pasta (kokoro-1939ad2/,
      // ort-1.22.0/, espeak-<hash>/), então o arquivo nunca muda e o Cloudflare e o navegador guardam por um ano.
      // A lista vozes.json e o motor (/workers/voz*.js) ficam fora: mudam a cada versão nova.
      { source: "/vozes/:pasta/:arquivo", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/vozes-amostras/:arquivo", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
      // Imagens e arquivos publicados têm o nome derivado do próprio conteúdo: nunca mudam, podem ficar guardados por um ano.
      { source: "/(arquivos|imagens)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // O arquivo que liga o modo sem internet é conferido a cada visita, para as correções chegarem logo.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      // O painel e a entrada nunca ficam guardados em intermediários.
      { source: "/:lang/(painel|entrar)", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
