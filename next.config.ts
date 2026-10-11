// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { NextConfig } from "next";

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

// Desafio contra robôs da página de entrada: a única coisa que o site carrega de fora.
const captcha = "https://challenges.cloudflare.com";

// Fora o desafio da entrada, o site não carrega nada de terceiros: scripts, estilos e fontes vêm do próprio domínio.
const policy = (script: string) =>
  [
    "default-src 'self'",
    `script-src 'self' ${script}`,
    "style-src 'self' 'unsafe-inline'",
    // blob: é a prévia de uma imagem antes do envio; o serviço de contas mostra à equipe as imagens ainda em revisão.
    `img-src 'self' data: blob: ${service}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${service}${dev ? " ws:" : ""}`.trim(),
    // A rádio toca arquivos do próprio acervo ou a transmissão ao vivo indicada pela coordenação.
    "media-src 'self' https:",
    "worker-src 'self'",
    "manifest-src 'self'",
    `frame-src ${captcha}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

// 'unsafe-inline' é exigido pelos scripts de hidratação das páginas estáticas do Next.
const pages = policy(`'unsafe-inline' ${captcha}${dev ? " 'unsafe-eval'" : ""}`);
// Os interpretadores de Python e PHP rodam isolados em um Worker, sem acesso à página;
// só ali é permitido compilar WebAssembly e código gerado em tempo de execução.
const workers = policy("'wasm-unsafe-eval' 'unsafe-eval'");

const common = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // O microfone só é pedido pelo afinador, e só depois de a pessoa clicar em "Começar".
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/((?!workers/).*)", headers: [{ key: "Content-Security-Policy", value: pages }, ...common] },
      { source: "/workers/:path*", headers: [{ key: "Content-Security-Policy", value: workers }, ...common] },
      // Os interpretadores são grandes e mudam raramente: o navegador pode guardá-los por uma semana.
      { source: "/(pyodide|php)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
      // Imagens e arquivos publicados têm o nome derivado do próprio conteúdo: nunca mudam, podem ficar guardados por um ano.
      { source: "/(arquivos|imagens)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // O painel e a entrada nunca ficam guardados em intermediários.
      { source: "/:lang/(painel|entrar)", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
