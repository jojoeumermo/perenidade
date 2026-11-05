// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test } from "@playwright/test";
import { abrir, vigiarErros } from "./ajuda";

// Laboratório e aula em telas próprias, sem conflito no celular (docs/APP.md, pacote app-telas): abrir a folha da aula,
// ir a um laboratório e voltar não pode deixar a página travada nem dois overlays abertos. Roda no celular:
//   npx playwright test e2e/app-telas --project=celular
test.describe.configure({ timeout: 480_000 });

const AULA = "/pt/trilhas/historia-antiga/pre-historia-os-primeiros-seres-humanos";
const travada = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.style.getPropertyValue("overflow") === "hidden");

test("folha da aula aberta, ir ao laboratório: nada fica aberto nem travado", async ({ page }) => {
  const erros = vigiarErros(page);
  await abrir(page, AULA);
  const folha = page.locator('button[aria-haspopup="dialog"]').first();
  if (!(await folha.count())) test.skip(true, "a barra de cima do celular não apareceu nesta largura");
  await folha.click();
  expect(await travada(page)).toBe(true);
  // Troca de página DENTRO do aplicativo (sem recarregar): é aí que a folha e a trava ficavam para trás.
  await page.evaluate(() => (window as unknown as { next: { router: { push: (u: string) => void } } }).next.router.push("/pt/laboratorios/quimica"));
  await page.waitForURL(/laboratorios\/quimica/);
  await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
  expect(await travada(page)).toBe(false);
  expect(erros.filter((e) => /TypeError|ReferenceError/.test(e))).toEqual([]);
});

test("o voltar da barra fecha a folha da aula antes de sair da página", async ({ page }) => {
  await abrir(page, AULA);
  const folha = page.locator('button[aria-haspopup="dialog"]').first();
  if (!(await folha.count())) test.skip(true, "a barra de cima do celular não apareceu nesta largura");
  await folha.click();
  // O véu da folha cobre a barra de cima; o voltar do sistema (gesto, tecla) chega pelo mesmo caminho do clique.
  await page.getByRole("button", { name: /voltar/i }).first().dispatchEvent("click");
  expect(page.url()).toContain(AULA);
  expect(await travada(page)).toBe(false);
});
