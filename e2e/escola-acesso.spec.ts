// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Acesso e confiança (E4-04): o selo de privacidade numa ferramenta da caixa e no reforço, o painel de qualidade em
// /status, os espelhos que somem sem a variável e nada de rolagem lateral em 360 px. Roda nos projetos "computador" e
// "celular". O selo do reforço fica atrás do recurso "escola": suba o servidor com NEXT_PUBLIC_RECURSOS=escola.
import { expect, test } from "@playwright/test";

const AULA = "/pt/trilhas/ler-e-escrever/as-vogais";

test("o selo de privacidade aparece no cabeçalho de uma ferramenta da caixa", async ({ page }) => {
  await page.goto(AULA);
  // O mesmo evento que os botões da aula usam para abrir a caixa (components/aula/MargemDaAula.tsx).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lucia:abrir-caixa", { detail: "calculadora" })));
  const caixa = page.locator("#caixa-de-ferramentas");
  await expect(caixa).toBeVisible();
  const selo = caixa.locator('[data-selo="aparelho"]').first();
  await expect(selo).toBeVisible();
  await expect(selo).toContainText("Fica no seu aparelho");
  await expect(selo.getByRole("link")).toHaveAttribute("href", /\/pt\/privacidade#/);
});

test("o dicionário diz que passa pelo servidor do Instituto, sem prometer o que não foi conferido", async ({ page }) => {
  await page.goto(AULA);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("lucia:abrir-caixa", { detail: "dicionario" })));
  const selo = page.locator('#caixa-de-ferramentas [data-selo="instituto"]').first();
  await expect(selo).toContainText("Passa pelo servidor do Instituto");
  await expect(selo).not.toContainText("não guarda");
});

test("o selo aparece no reforço (com o assistente ligado no banco de teste)", async ({ page }) => {
  await page.goto("/pt/reforco");
  const assistente = page.locator('section[aria-labelledby="assistente-titulo"]');
  // O assistente só aparece quando o banco diz que está ligado; sem ele, não há onde pôr o selo.
  if (!(await assistente.isVisible({ timeout: 15_000 }).catch(() => false))) test.skip(true, "assistente desligado neste banco");
  await expect(assistente.locator('[data-selo="instituto"]')).toContainText("não guarda");
  await expect(assistente.locator('[data-selo="externo"]')).toContainText("provedor de IA");
});

test("/status mostra a qualidade do conteúdo, sem ranking de pessoas", async ({ page }) => {
  await page.goto("/pt/status");
  const painel = page.locator("[data-qualidade]");
  await expect(painel.getByRole("heading", { name: "Qualidade do conteúdo" })).toBeVisible();
  await expect(painel).toContainText("Aulas publicadas");
  await expect(painel).toContainText("Com fontes");
  await expect(painel.getByRole("link", { name: /guia de revisão/ })).toHaveAttribute("href", "/pt/contribuir/guia#revisar");
});

test("os espelhos somem quando a variável está vazia", async ({ page }) => {
  test.skip(Boolean(process.env.NEXT_PUBLIC_ESPELHOS), "este teste é para a montagem sem espelhos");
  await page.goto("/pt/status");
  await expect(page.locator("[data-qualidade]")).toBeVisible();
  await expect(page.locator("[data-espelhos]")).toHaveCount(0);
});

test("sem rolagem lateral em 360 px (status e caixa com selo)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const endereco of ["/pt/status", AULA]) {
    await page.goto(endereco);
    if (endereco === AULA) await page.evaluate(() => window.dispatchEvent(new CustomEvent("lucia:abrir-caixa", { detail: "resolvedor" })));
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra, endereco).toBeLessThanOrEqual(0);
  }
});
