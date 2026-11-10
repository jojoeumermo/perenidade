// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O aplicativo em dois aparelhos imitados (docs/TESTE-EM-APARELHO-REAL.md, docs/APP-LOJA.md):
//   1. Galaxy S24, pelo navegador e dentro do WebView do aplicativo ("; wv)" + InstitutoLuciaApp, como o Capacitor se
//      anuncia): casca de app (barra de baixo de 5 abas), nada rolando para o lado, tela cheia no laboratório.
//   2. Celular de entrada: 360 x 640, CPU 4 vezes mais lenta, 3G lento. A mesma conferência, com tempo de abertura.
// Imitar não é o mesmo que usar: o aparelho real continua sendo o roteiro de papel.
//
//   BASE_URL=http://localhost:3951 npm run testar:app-aparelho     → contra `next build && next start`
//
// Roda só no projeto "computador" (os dispositivos são trocados aqui dentro), para não repetir em celular/s24.
// A casca só existe se o build tem components/app/: se não tiver, os itens da casca são anotados como "sem casca neste
// build" e não falham (um build velho não pode acusar defeito de código novo).
import { devices, expect, test, type CDPSession, type Page } from "@playwright/test";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "computador", "este arquivo troca de aparelho sozinho; roda só no projeto computador");
});

const UA_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; SM-S921B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 InstitutoLuciaApp/2";

const PAGINAS = ["/pt", "/pt/trilhas", "/pt/jogos", "/pt/laboratorios", "/pt/alumia", "/pt/meu-estudo"];

async function rolouParaOLado(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function temCasca(page: Page) {
  return (await page.locator("nav.app-casca-abas").count()) > 0;
}

function conferir(nome: string, uso: Parameters<typeof test.use>[0]) {
  test.describe(nome, () => {
    test.use(uso);

    test("sem rolagem para o lado nas telas das 5 abas", async ({ page }) => {
      for (const caminho of PAGINAS) {
        await page.goto(caminho, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("load");
        const sobra = await rolouParaOLado(page);
        expect(sobra, `${caminho} passa ${sobra}px da largura da tela`).toBeLessThanOrEqual(1);
      }
    });

    test("barra de baixo com 5 abas e voltar pelo botão", async ({ page }, info) => {
      await page.goto("/pt", { waitUntil: "load" });
      if (!(await temCasca(page))) {
        info.annotations.push({ type: "casca", description: "sem casca neste build (build anterior ao pacote app-casca)" });
        return;
      }
      const abas = page.locator("nav.app-casca-abas a");
      await expect(abas).toHaveCount(5);
      await abas.nth(2).click(); // Jogos e labs
      await expect(page).toHaveURL(/\/pt\/jogos/);
      await page.goBack();
      await expect(page).toHaveURL(/\/pt\/?$/);
      // A barra da BottomNav do site não pode aparecer junto (sem barra dupla).
      expect(await page.locator("nav.abas-do-celular:not(.app-casca-abas)").filter({ has: page.locator("a") }).evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").length)).toBe(0);
    });

    test("laboratório aberto fica em tela cheia, sem a barra de baixo", async ({ page }, info) => {
      await page.goto("/pt/laboratorios/planilha", { waitUntil: "load" });
      if (!(await temCasca(page))) {
        info.annotations.push({ type: "casca", description: "sem casca neste build" });
        return;
      }
      await expect(page.locator("nav.app-casca-abas")).toBeHidden();
    });
  });
}

const { defaultBrowserType, ...S24 } = devices["Galaxy S24"];
void defaultBrowserType; // não pode ser trocado dentro de um describe
conferir("Galaxy S24 no navegador", S24);
// O tamanho de fábrica do S24 (1080 x 2340 com densidade 2,8125), que o Playwright arredonda para 360 x 780.
conferir("Galaxy S24 384x832", { ...S24, viewport: { width: 384, height: 832 }, deviceScaleFactor: 2.8125 });
conferir("Galaxy S24 dentro do aplicativo (WebView)", { ...S24, userAgent: UA_WEBVIEW });

test.describe("celular de entrada (360x640, CPU 4x, 3G lento)", () => {
  test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["Pixel 7"].userAgent });

  async function freiar(page: Page): Promise<CDPSession> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1000) / 8, uploadThroughput: (400 * 1000) / 8 });
    return cdp;
  }

  test("abre as telas das abas sem rolar para o lado e anota o tempo", async ({ page }, info) => {
    await freiar(page);
    const linhas: string[] = [];
    for (const caminho of ["/pt", "/pt/jogos", "/pt/meu-estudo"]) {
      const t0 = Date.now();
      await page.goto(caminho, { waitUntil: "domcontentloaded" });
      await page.locator("main, h1").first().waitFor({ timeout: 90_000 });
      const ms = Date.now() - t0;
      const sobra = await rolouParaOLado(page);
      linhas.push(`${caminho}: texto em ${ms} ms, sobra lateral ${sobra}px`);
      expect(sobra, `${caminho} rola para o lado`).toBeLessThanOrEqual(1);
    }
    console.log(`medicao-app-entrada\n${linhas.join("\n")}`);
    info.annotations.push({ type: "medicao", description: linhas.join(" | ") });
  });
});
