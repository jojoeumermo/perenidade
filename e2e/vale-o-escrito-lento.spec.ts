// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, C2: o Vale o Escrito num celular fraco. A coordenação viu a aba cair ("This page couldn't load") no Vale o Escrito; a
// tela do navegador aparece quando a aba trava ou fica sem memória. Aqui, no projeto "entrada" do playwright.config.ts (360x640,
// toque), com a CPU 4x mais lenta e a rede 3G lenta (CDP), a página abre, cada visão pesada (a Teia e o Mapa) fica aberta por um
// tempo, e o teste confere que a aba não caiu, que a memória do JavaScript não passou do teto e que a página continua respondendo.
// Mede também o que a visão baixou ao abrir (o peso do mapa) e as tarefas longas (> 50 ms) no tempo parado.
//
//   npm run testar:vale-o-escrito-lento                                  → contra o dev:local (sobe sozinho; o peso não vale)
//   BASE_URL=http://localhost:3000 npm run testar:vale-o-escrito-lento   → contra next build && next start (o peso vale)
//
// Os tetos valem para qualquer montagem; os números de peso saem nas linhas "medicao" (e nas anotações do relatório).
import { expect, test, type CDPSession, type Page } from "@playwright/test";

/** Teto da memória do JavaScript da aba, com a visão aberta e parada (MB). Um celular de entrada tem 2 a 3 GB para tudo. */
const TETO_HEAP_MB = Number(process.env.TETO_HEAP_MB ?? 160);
/** Quanto tempo a visão fica aberta e parada, medindo (ms). */
const PARADA_MS = Number(process.env.PARADA_MS ?? 15_000);

async function celularFraco(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1000) / 8, uploadThroughput: (400 * 1000) / 8 });
  await cdp.send("Performance.enable");
  return cdp;
}

async function heapMb(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const usado = metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
  return Math.round((usado / 1024 / 1024) * 10) / 10;
}

const VISOES = [
  { nome: "teia", indice: 0, pronta: ".ve-viz svg, .ve-viz canvas" },
  { nome: "mapa", indice: 4, pronta: ".ve-viz .maplibregl-canvas, .ve-viz [role='region'] p" },
] as const;

for (const visao of VISOES) {
  test(`Vale o Escrito no celular fraco: ${visao.nome}`, async ({ page }, info) => {
    test.setTimeout(420_000);
    let caiu = false;
    page.on("crash", () => {
      caiu = true;
    });
    const cdp = await celularFraco(page);
    // Tarefas longas (> 50 ms) contadas desde o começo; o teste lê só o que veio depois de a visão abrir.
    await page.addInitScript(() => {
      const w = window as unknown as { __longas: number[] };
      w.__longas = [];
      try {
        new PerformanceObserver((lista) => {
          for (const e of lista.getEntries()) w.__longas.push(e.duration);
        }).observe({ type: "longtask", buffered: true });
      } catch {
        // navegador sem longtask: fica vazio
      }
    });
    const resposta = await page.goto("/pt/vale-o-escrito", { waitUntil: "load" });
    expect(resposta?.status() ?? 0, "a página abriu").toBeLessThan(400);
    await page.locator("[data-ve-pronto]").waitFor({ timeout: 180_000 });

    // O que a visão baixa ao abrir (o pedaço de JS e as malhas): conta só depois do clique.
    const bytes = { total: 0, js: 0, malhas: 0 };
    const tipos = new Map<string, { tipo: string; url: string }>();
    cdp.on("Network.responseReceived", (e) => tipos.set(e.requestId, { tipo: e.type, url: e.response.url }));
    cdp.on("Network.loadingFinished", (e) => {
      const r = tipos.get(e.requestId);
      bytes.total += e.encodedDataLength;
      if (r?.tipo === "Script") bytes.js += e.encodedDataLength;
      if (r && /\/vale-o-escrito\/malhas\//.test(r.url)) bytes.malhas += e.encodedDataLength;
    });
    const longasAntes = await page.evaluate(() => (window as unknown as { __longas: number[] }).__longas.length);
    const inicio = Date.now();
    // data-ve-pronto já vem do servidor: o clique só vale depois de a página ganhar vida (com a CPU 4x mais lenta, demora).
    const aba = page.locator(".ve-visao").nth(visao.indice);
    await expect(async () => {
      // O aviso de abertura do site (dialog) pode estar por cima: fecha antes.
      const aviso = page.locator("dialog[open]").getByRole("button", { name: "Fechar" }).first();
      if (await aviso.isVisible().catch(() => false)) await aviso.click();
      await aba.click({ timeout: 5000 });
      await expect(aba).toHaveAttribute("aria-selected", "true", { timeout: 5000 });
    }).toPass({ timeout: 180_000 });
    await page.locator(visao.pronta).first().waitFor({ timeout: 240_000 });
    const abriuEmMs = Date.now() - inicio;
    await page.waitForLoadState("networkidle").catch(() => {});

    // Parada: a visão aberta, sem mexer. A cada 3 s, a memória.
    const heaps: number[] = [];
    for (let t = 0; t < PARADA_MS; t += 3000) {
      await page.waitForTimeout(3000);
      if (caiu) break;
      heaps.push(await heapMb(cdp));
    }
    expect(caiu, "a aba não caiu").toBe(false);
    const longas = await page.evaluate((n) => (window as unknown as { __longas: number[] }).__longas.slice(n), longasAntes);
    // A página continua respondendo: um clique na lista de casos abre e fecha.
    const respondeuEm = await page.evaluate(
      () =>
        new Promise<number>((ok) => {
          const t0 = performance.now();
          requestAnimationFrame(() => requestAnimationFrame(() => ok(performance.now() - t0)));
        }),
    );
    const linha = {
      medicao: `vale-${visao.nome}`,
      abriuEmMs,
      baixouKb: Math.round(bytes.total / 1024),
      jsKb: Math.round(bytes.js / 1024),
      malhasKb: Math.round(bytes.malhas / 1024),
      heapMb: { primeiro: heaps[0] ?? 0, ultimo: heaps.at(-1) ?? 0, maior: Math.max(0, ...heaps) },
      tarefasLongas: longas.length,
      tarefasLongasMs: Math.round(longas.reduce((a, b) => a + b, 0)),
      quadroMs: Math.round(respondeuEm),
    };
    console.log(JSON.stringify(linha));
    info.annotations.push({ type: "medicao", description: JSON.stringify(linha) });
    expect(linha.heapMb.maior, `memória do JS (teto ${TETO_HEAP_MB} MB)`).toBeLessThanOrEqual(TETO_HEAP_MB);
    // Dois quadros seguidos em menos de 1 s, mesmo com a CPU 4x mais lenta: a página não está travada.
    expect(linha.quadroMs, "a página responde").toBeLessThan(1000);
  });
}
