// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";
import { abrir, vigiarErros } from "./ajuda";

// Campus e calendário da Escola Lúcia Maria (E4-09, docs/escola/campus.md).
// Com a Escola ligada:  NEXT_PUBLIC_RECURSOS=todos,escola npm run dev:local   e   BASE_URL=http://localhost:3100 npx playwright test e2e/escola-campus
// Sem a flag (montagem padrão): roda só o teste "sem a flag, o Mais é o de hoje"; os outros são pulados.
// Roda no computador e no celular (projetos do playwright.config.ts).

async function escolaLigada(page: Page): Promise<boolean> {
  return (await page.request.get("/pt/escola/calendario")).status() === 200;
}

/** Abre o "Mais" pelo mesmo aviso que o botão do cabeçalho e as abas do celular disparam. */
async function abrirMais(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lucia:abrir-mais", { detail: { mouse: false } })));
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("sem a flag, o Mais é o de hoje (sem mapa) e /campus não existe", async ({ page }, info) => {
  test.skip(await escolaLigada(page), "a Escola está ligada nesta montagem");
  await abrir(page, "/pt/explorar");
  await abrirMais(page);
  await expect(page.locator("[data-mapa-do-campus]")).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("link", { name: "Glossário" }).first()).toBeAttached();
  await page.screenshot({ path: info.outputPath("mais-sem-flag.png") });
  expect((await page.request.get("/pt/campus")).status()).toBe(404);
  await expect(page.locator("[data-quadro-de-avisos]")).toHaveCount(0);
});

test.describe("com a Escola ligada", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await escolaLigada(page)), "a Escola está desligada nesta montagem (NEXT_PUBLIC_RECURSOS sem 'escola')");
  });

  test("o Mais abre o mapa do campus, a busca filtra e o carimbo aparece depois da visita", async ({ page }, info) => {
    const erros = vigiarErros(page);
    await abrir(page, "/pt/glossario");
    await abrirMais(page);
    const mapa = page.getByRole("dialog").locator("[data-mapa-do-campus]:visible");
    await expect(mapa).toBeVisible();
    await expect(mapa.locator("[data-predio]")).toHaveCount(8);
    await page.screenshot({ path: info.outputPath("mais-com-flag.png") });
    // A visita ao glossário carimbou a Biblioteca, e só ela.
    await expect(mapa.locator('[data-predio="biblioteca"][data-visitado]')).toHaveCount(1);
    await expect(mapa.locator("[data-visitado]")).toHaveCount(1);
    await expect(mapa.locator("[data-convite-do-campus]")).toHaveText("Conheça o campus: 1 de 8 prédios");
    // A busca da janela filtra os prédios.
    await page.getByRole("dialog").getByRole("searchbox").fill("rádio");
    await expect(mapa.locator("[data-predio]")).toHaveCount(1);
    await expect(mapa.locator('[data-predio="radio"]')).toBeVisible();
    await page.keyboard.press("Escape");
    // Nada do passaporte vai para o servidor.
    const passaporte = await page.evaluate(() => localStorage.getItem("lucia:escola:passaporte"));
    expect(JSON.parse(passaporte ?? "{}")).toHaveProperty("biblioteca");
    expect(erros).toEqual([]);
  });

  test("modo seguro não carimba", async ({ page }) => {
    await abrir(page, "/pt");
    await page.evaluate(() => sessionStorage.setItem("lucia-seguro", "1"));
    await page.goto("/pt/radio");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => localStorage.getItem("lucia:escola:passaporte"))).toBeNull();
  });

  test("/campus e /explorar mostram o mapa sem JavaScript", async ({ browser }) => {
    const contexto = await browser.newContext({ javaScriptEnabled: false });
    const page = await contexto.newPage();
    for (const caminho of ["/pt/campus", "/pt/explorar"]) {
      await page.goto(caminho);
      await expect(page.locator("[data-mapa-do-campus] [data-predio]").first()).toBeAttached();
      expect(await page.locator("[data-mapa-do-campus] [data-predio]").count()).toBe(8);
      await expect(page.locator('[data-mapa-do-campus] a[href="/pt/acervo"]').first()).toBeAttached();
    }
    await contexto.close();
  });

  for (const lang of ["pt", "zh"]) {
    test(`/escola/calendario em /${lang}: dois semestres, proposta marcada, .ics e fonte dos exames`, async ({ page }) => {
      const erros = vigiarErros(page);
      await abrir(page, `/${lang}/escola/calendario`);
      await expect(page.locator("[data-semestre-do-calendario]")).toHaveCount(2);
      if (lang === "pt") {
        await expect(page.getByText("Proposto, a confirmar pela coordenação").first()).toBeVisible();
        await expect(page.getByText("A aula magna do semestre ainda não foi marcada.").first()).toBeVisible();
      } else {
        await expect(page.getByText("拟定日期，待协调组确认").first()).toBeVisible();
      }
      const ics = page.locator("button[data-ics]:visible").first();
      await expect(ics).toBeVisible();
      const [baixado] = await Promise.all([page.waitForEvent("download"), ics.click()]);
      expect(baixado.suggestedFilename()).toMatch(/\.ics$/);
      const caminho = await baixado.path();
      const texto = (await import("node:fs")).readFileSync(caminho, "utf8");
      expect(texto).toContain("BEGIN:VEVENT\r\n");
      expect(texto).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
      expect(erros).toEqual([]);
    });
  }

  test("o quadro de avisos aparece para quem volta e não para quem chega", async ({ page }) => {
    await abrir(page, "/pt");
    await expect(page.locator("[data-quadro-de-avisos]")).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem("lucia:concluidas", JSON.stringify(["feminismo-fundamental/o-8-de-marco"])));
    await page.reload();
    await page.waitForLoadState("networkidle");
    const quadro = page.locator("[data-quadro-de-avisos]:visible");
    await expect(quadro).toHaveCount(1);
    const cartoes = quadro.locator("[data-cartao-do-quadro]");
    expect(await cartoes.count()).toBeLessThanOrEqual(3);
    // "Já li" tira o cartão e fica só no aparelho.
    if ((await cartoes.count()) > 0) {
      const antes = await cartoes.count();
      await cartoes.first().getByRole("button").click();
      await expect(cartoes).toHaveCount(Math.max(0, antes - 1), { timeout: 5000 }).catch(() => undefined);
      expect(JSON.parse((await page.evaluate(() => localStorage.getItem("lucia:escola:avisos-lidos"))) ?? "[]").length).toBe(1);
    }
  });

  test("360 px sem rolagem lateral e tema escuro", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.emulateMedia({ colorScheme: "dark" });
    for (const caminho of ["/pt/campus", "/pt/escola/calendario", "/zh/escola/calendario", "/pt/explorar"]) {
      await abrir(page, caminho);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra, caminho).toBeLessThanOrEqual(0);
    }
    // No celular, a gaveta do prédio abre com o toque e mostra as seções.
    await abrir(page, "/pt/campus");
    const escola = page.locator('[data-predio="escola"] details');
    await escola.locator("summary").click();
    await expect(escola.getByRole("link").first()).toBeVisible();
  });
});
