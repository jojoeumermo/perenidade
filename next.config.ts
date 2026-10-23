// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { NextConfig } from "next";
import { SERVIDORES_JITSI } from "./lib/jitsi";
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

// Fora o desafio da entrada, o site não carrega nada de terceiros: scripts, estilos e fontes vêm do próprio domínio.
const policy = (script: string) =>
  [
    "default-src 'self'",
    `script-src 'self' ${script}`,
    `style-src 'self' 'unsafe-inline'${vlibras}`,
    // blob: é a prévia de uma imagem antes do envio; o serviço de contas mostra à equipe as imagens ainda em revisão.
    `img-src 'self' data: blob: ${service}${vlibras}`.trim(),
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
    `frame-src 'self' blob: ${captcha} ${jitsi} https://phet.colorado.edu ${videos} ${estudio}${vlibrasCodigo}`.trim(),
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
  // O microfone é pedido pelo afinador e pelo gravador do painel; a câmera e a tela, só pelo gravador de aulas em vídeo.
  // Nada é pedido antes de a pessoa clicar.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // O destino do "report-to" da política acima.
  ...(reporting ? [{ key: "Reporting-Endpoints", value: `sentinela="${reporting}"` }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // O build gera mais de dezesseis mil páginas. Na Vercel há um só processo para todas, com oito páginas ao mesmo tempo,
  // e o prazo de cada uma conta também a espera na fila: com o padrão de 60 s, até o robots.txt estourava quando o
  // processo estava ocupado, e o build caía (o mesmo commit passava numa tentativa e falhava na outra). Cinco minutos
  // por página tiram essa loteria sem esconder nada: uma página de fato travada continua derrubando o build.
  staticPageGenerationTimeout: 300,
  // Só em desenvolvimento: abrir o painel também em 127.0.0.1 faz de conta que é um segundo aparelho (outro navegador, outras
  // chaves), o que serve para testar a aprovação de aparelhos das conversas sem dois computadores.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      { source: "/((?!workers/).*)", headers: [{ key: "Content-Security-Policy", value: pages }, ...common] },
      { source: "/workers/:path*", headers: [{ key: "Content-Security-Policy", value: workers }, ...common] },
      // Os interpretadores são grandes e mudam raramente: o navegador pode guardá-los por uma semana.
      { source: "/(pyodide|php|typescript|lua|ruby|jscpp)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
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
