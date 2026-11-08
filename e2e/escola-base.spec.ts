// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";
import { abrir } from "./ajuda";

// A base da Escola Lúcia Maria (E4-01, docs/ESCOLA.md). Precisa do site montado com a Escola ligada:
//   NEXT_PUBLIC_RECURSOS=escola npm run dev:local   e depois   BASE_URL=http://localhost:3100 npx playwright test e2e/escola-base
// Sem a flag, /pt/escola responde "não encontrado" e os testes são pulados.

async function escolaLigada(page: Page): Promise<boolean> {
  const resposta = await page.request.get("/pt/escola");
  return resposta.status() === 200;
}

test.beforeEach(async ({ page }) => {
  test.skip(!(await escolaLigada(page)), "a Escola está desligada nesta montagem (NEXT_PUBLIC_RECURSOS sem 'escola')");
});

for (const lang of ["pt", "en"] as const) {
  test(`entrada /${lang}/escola: abertura, pular e o cartão de Lúcia Maria primeiro`, async ({ page }) => {
    await abrir(page, `/${lang}/escola`);
    // Primeira visita: a abertura aparece, com o "Pular" sempre à vista.
    const abertura = page.getByRole("dialog");
    await expect(abertura).toBeVisible();
    const pular = abertura.getByRole("button", { name: lang === "pt" ? "Pular" : "Skip" });
    await expect(pular).toBeVisible();
    await pular.click();
    await expect(abertura).toBeHidden();
    // Na próxima visita ela não volta.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // O primeiro item depois do título é o cartão "Quem foi Lúcia Maria".
    const main = page.locator("main");
    const primeiroDepoisDoTitulo = main.locator("[data-escola] header.cabeca-da-pagina + *").first();
    await expect(primeiroDepoisDoTitulo).toHaveAttribute("data-cartao-lucia-maria", "");
    await primeiroDepoisDoTitulo.click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/escola/quem-foi-lucia-maria$`));
    await expect(page.locator("[data-quem-foi-lucia-maria]")).toContainText("Lúcia, presente!");
  });
}

test("Esc fecha a abertura e o foco volta para a página", async ({ page }) => {
  await abrir(page, "/pt/escola");
  const abertura = page.getByRole("dialog");
  await expect(abertura).toBeVisible();
  // O foco está dentro da camada.
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(abertura).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")))).toBe(false);
});

test("barra de baixo do celular com a Escola ligada", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a barra de baixo só aparece no celular");
  await abrir(page, "/pt/escola");
  await page.keyboard.press("Escape");
  const barra = page.locator("nav.abas-do-celular");
  await expect(barra.getByRole("link")).toHaveText([/Início/, /Estudar/, /Meu estudo/, /Campus/, /Buscar/]);
  await expect(barra.getByRole("link", { name: /Estudar/ })).toHaveAttribute("aria-current", "page");
});

test("'apagar meus dados' limpa as chaves da Escola", async ({ page }) => {
  await abrir(page, "/pt/escola");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    localStorage.setItem("lucia:escola:matricula", "{}");
    localStorage.setItem("lucia:escola-privado:conversas", "[]");
    localStorage.setItem("lucia:historico", "[]");
    localStorage.setItem("lucia:ajudou-contou:x/y", "1");
  });
  await abrir(page, "/pt/meus-dados");
  await page.getByRole("button", { name: "Apagar tudo deste navegador" }).click();
  await expect(page.getByText("Tudo apagado.")).toBeVisible();
  const sobrou = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("lucia:escola") || k === "lucia:historico" || k.startsWith("lucia:ajudou-contou:")));
  expect(sobrou).toEqual([]);
});

test("sem rolagem lateral em 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const caminho of ["/pt/escola", "/pt/escola/quem-foi-lucia-maria", "/pt/escola/cursos"]) {
    await abrir(page, caminho);
    await page.keyboard.press("Escape");
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra, caminho).toBeLessThanOrEqual(0);
  }
});
