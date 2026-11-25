// TEMPORÁRIO (validação do PR #65): capturas de tela do app instalado e do site, para conferir os pixels antes de publicar.
// Sai do ramo por commit próprio antes do master. Roda só com CAPTURA_ROTULO definido (workflow captura-app.yml), contra o
// banco de teste local (npm run dev:local), sem segredo e sem tocar em produção.
//   CAPTURA_ROTULO=app CAPTURA_GRUPO=tudo      → app instalado (?app=instituto) + site/Alumia no navegador
//   CAPTURA_ROTULO=base CAPTURA_GRUPO=site     → só o site/Alumia (ramo-base, que não tem as rotas /app)
import { expect, test, type Page } from "@playwright/test";
import { abrir } from "./ajuda";

test.describe.configure({ timeout: 240_000 });
test.skip(!process.env.CAPTURA_ROTULO, "só roda no workflow de captura");

const ROTULO = process.env.CAPTURA_ROTULO ?? "x";
const TUDO = process.env.CAPTURA_GRUPO === "tudo";
const AULA = "/pt/trilhas/historia-antiga/pre-historia-os-primeiros-seres-humanos";

async function foto(page: Page, nome: string, cheia = false) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/capturas/${ROTULO}-${nome}.png`, fullPage: cheia });
}
const atributo = (page: Page, a: string) => page.evaluate((n) => document.documentElement.hasAttribute(n), a);

// O aplicativo instalado é reconhecido pelo <html data-app>, posto pelo prefsScript (lib/prefs-script.ts) no modo standalone, no
// navegador embutido ("; wv)") ou com navigator.standalone. O Playwright não emula o display-mode: o teste usa o "; wv)" no UA.
const UA_APP = "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const CELULAR = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } as const;

// Páginas do site e da Alumia no navegador comum (sem ?app): são as que NÃO podem mudar.
const SITE: [string, string][] = [
  ["inicio", "/pt"], ["trilhas", "/pt/trilhas"], ["aula", AULA], ["busca", "/pt/busca"], ["jogos", "/pt/jogos"],
  ["acervo", "/pt/acervo"], ["alumia", "/pt/alumia"], ["apoie", "/pt/apoie"], ["laboratorios", "/pt/laboratorios"],
];

test.describe("site no navegador do celular (390 px)", () => {
  test.use(CELULAR);
  for (const [nome, caminho] of SITE) {
    test(`celular ${nome}`, async ({ page }) => {
      await abrir(page, caminho);
      await foto(page, `site-celular-${nome}`);
      expect(await atributo(page, "data-sem-alumia")).toBe(false);
    });
  }
});

test.describe("site no navegador do computador (1280 px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const [nome, caminho] of SITE.slice(0, 5)) {
    test(`computador ${nome}`, async ({ page }) => {
      await abrir(page, caminho);
      await foto(page, `site-computador-${nome}`);
    });
  }
});

test.describe("navegador comum abre /pt/app (390 px)", () => {
  test.skip(!TUDO, "o ramo-base não tem as rotas do app");
  test.use(CELULAR);
  test("o navegador comum que abre /pt/app é levado ao site", async ({ page }) => {
    await abrir(page, "/pt/app");
    await page.waitForTimeout(2500);
    console.log("URL final no navegador comum:", page.url());
    await foto(page, "navegador-pede-app");
  });
});

test.describe("app instalado (390 px, navegador embutido com \"; wv)\")", () => {
  test.skip(!TUDO, "o ramo-base não tem as rotas do app");
  test.use({ ...CELULAR, userAgent: UA_APP });

  test("primeira abertura do app: sem modal de apoio", async ({ page }) => {
    await page.goto("/pt/app");
    await page.waitForLoadState("networkidle");
    await foto(page, "app-primeira-abertura");
    expect(await atributo(page, "data-app")).toBe(true);
    expect(await atributo(page, "data-sem-alumia")).toBe(true);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  test("as quatro abas: tocar e conferir cada hub", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app");
    await page.waitForLoadState("networkidle");
    await foto(page, "app-1-inicio");
    await foto(page, "app-1-inicio-cheia", true);
    for (const [aba, nome] of [["/pt/app/estudar", "2-estudar"], ["/pt/app/jogos", "3-jogos"], ["/pt/app/eu", "4-eu"]] as const) {
      await page.locator(`.shell-abas a[href="${aba}"]`).first().click();
      await page.waitForURL(new RegExp(`${aba}$`));
      await page.waitForLoadState("networkidle");
      await foto(page, `app-${nome}`);
      await foto(page, `app-${nome}-cheia`, true);
    }
    // nenhuma aba mostra a Alumia
    await expect(page.locator('a[href*="/alumia"]:visible')).toHaveCount(0);
  });

  test("jornadas dentro do app: aula, busca, apoie, laboratórios", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() })));
    await page.goto("/pt/app");
    await page.waitForLoadState("networkidle");
    for (const [nome, caminho] of [["trilhas", "/pt/trilhas"], ["aula", AULA], ["busca", "/pt/busca"], ["apoie", "/pt/apoie"], ["laboratorios", "/pt/laboratorios"], ["alumia-no-app", "/pt/alumia"]] as const) {
      await page.goto(`${caminho}`);
      await page.waitForLoadState("networkidle");
      console.log(`no app, ${caminho} termina em ${page.url()}`);
      await foto(page, `app-jornada-${nome}`);
    }
  });
});
