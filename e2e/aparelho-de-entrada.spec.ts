// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O celular de entrada (R1-89, Etapa 4): 360x640, toque, CPU 4x mais lenta e rede 3G lenta (400 kbps, 400 ms), no
// projeto "entrada" do playwright.config.ts. Mede, em três páginas, o LCP (maior pintura) e o JavaScript baixado, e
// falha acima dos limites abaixo.
//
//   npm run testar:entrada                                   → contra o dev:local (sobe sozinho)
//   BASE_URL=http://localhost:3000 npm run testar:entrada    → contra uma montagem de produção (next build && next start)
//
// COMO CALIBRAR. Os limites valem para a montagem de produção (o dev:local manda o JavaScript sem compactar e não serve
// de régua). Rode uma vez contra `next start`, leia as linhas "medicao" da saída e grave aqui o valor medido mais 10%,
// com a data. Enquanto um limite estiver null, o teste só mede e anota (não falha), e diz isso na saída.
// Os limites também podem vir do ambiente, para um teste pontual: LIMITE_LCP_MS e LIMITE_JS_KB.
import fs from "node:fs";
import path from "node:path";
import { expect, test, type CDPSession, type Page } from "@playwright/test";

interface Limite {
  /** Maior pintura (Largest Contentful Paint), em milissegundos. */
  lcpMs: number | null;
  /** JavaScript transferido (comprimido, como vem pela rede), em KB. */
  jsKb: number | null;
}

// A CALIBRAR: medição atual mais 10%, na montagem de produção (ver "COMO CALIBRAR" acima). null = ainda não medido.
const LIMITES: Record<"inicio" | "aula" | "escola", Limite> = {
  inicio: { lcpMs: null, jsKb: null },
  aula: { lcpMs: null, jsKb: null },
  escola: { lcpMs: null, jsKb: null },
};

const doAmbiente = (nome: string) => (process.env[nome] ? Number(process.env[nome]) : null);

/** A primeira aula escrita da trilha "Ler e escrever", na ordem do roteiro. */
function aulaDeLerEEscrever(): string {
  const base = path.join(process.cwd(), "content", "trilhas", "ler-e-escrever");
  const roteiro = JSON.parse(fs.readFileSync(path.join(base, "plano.json"), "utf8")) as { slug: string }[];
  const escrita = roteiro.find((item) => fs.existsSync(path.join(base, `${item.slug}.md`)));
  if (!escrita) throw new Error("a trilha ler-e-escrever não tem aula escrita");
  return `/pt/trilhas/ler-e-escrever/${escrita.slug}`;
}

/** CPU 4x mais lenta e rede 3G lenta, pelo protocolo do Chrome. */
async function aparelhoDeEntrada(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1000) / 8, uploadThroughput: (400 * 1000) / 8 });
  return cdp;
}

/** Soma o que chega pela rede: o JavaScript à parte e o total (para o "gastar menos de X MB" do roteiro). */
function contarBytes(cdp: CDPSession) {
  const tipos = new Map<string, string>();
  const soma = { js: 0, total: 0 };
  cdp.on("Network.responseReceived", (e) => tipos.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    soma.total += e.encodedDataLength;
    if (tipos.get(e.requestId) === "Script") soma.js += e.encodedDataLength;
  });
  return soma;
}

async function medir(page: Page, endereco: string) {
  const cdp = await aparelhoDeEntrada(page);
  const soma = contarBytes(cdp);
  // O observador entra antes de qualquer script da página, para pegar a primeira pintura.
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number };
    w.__lcp = 0;
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) w.__lcp = Math.max(w.__lcp, entrada.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const resposta = await page.goto(endereco, { waitUntil: "load" });
  // O LCP só fecha com a primeira interação ou quando a página fica quieta: espera a rede parar.
  await page.waitForLoadState("networkidle").catch(() => {});
  const lcpMs = Math.round(await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp));
  return { status: resposta?.status() ?? 0, lcpMs, jsKb: Math.round(soma.js / 1024), totalKb: Math.round(soma.total / 1024) };
}

const PAGINAS: { nome: keyof typeof LIMITES; endereco: () => string; podeFaltar?: boolean }[] = [
  { nome: "inicio", endereco: () => "/pt" },
  { nome: "aula", endereco: aulaDeLerEEscrever },
  { nome: "escola", endereco: () => "/pt/escola", podeFaltar: true },
];

for (const pagina of PAGINAS) {
  test(`aparelho de entrada: ${pagina.nome}`, async ({ page }, info) => {
    const m = await medir(page, pagina.endereco());
    if (pagina.podeFaltar && m.status === 404) test.skip(true, `${pagina.endereco()} ainda não existe nesta montagem`);
    expect(m.status, "a página abriu").toBeLessThan(400);
    const linha = { medicao: pagina.nome, endereco: pagina.endereco(), ...m };
    console.log(JSON.stringify(linha));
    info.annotations.push({ type: "medicao", description: JSON.stringify(linha) });

    const lcp = doAmbiente("LIMITE_LCP_MS") ?? LIMITES[pagina.nome].lcpMs;
    const js = doAmbiente("LIMITE_JS_KB") ?? LIMITES[pagina.nome].jsKb;
    if (lcp === null || js === null) info.annotations.push({ type: "a calibrar", description: `limite de ${pagina.nome} ainda não gravado: só medição` });
    if (lcp !== null) expect(m.lcpMs, `LCP de ${pagina.nome} (limite ${lcp} ms)`).toBeLessThanOrEqual(lcp);
    if (js !== null) expect(m.jsKb, `JavaScript de ${pagina.nome} (limite ${js} KB)`).toBeLessThanOrEqual(js);
    // Sem rolagem lateral em 360 px, mesmo no aparelho lento.
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra, "rolagem lateral").toBeLessThanOrEqual(0);
  });
}
