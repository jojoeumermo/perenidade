// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";
import { abrir } from "./ajuda";

// Os cursos da Escola Lúcia Maria (E4-07, docs/escola/cursos.md). Precisa do site montado com a Escola ligada:
//   NEXT_PUBLIC_RECURSOS=escola npm run dev:local   e depois   BASE_URL=http://localhost:3100 npx playwright test e2e/escola-cursos
// Sem a flag, /pt/escola responde "não encontrado" e os testes são pulados.

async function escolaLigada(page: Page): Promise<boolean> {
  const resposta = await page.request.get("/pt/cursos");
  return resposta.status() === 200;
}

test.beforeEach(async ({ page }) => {
  test.skip(!(await escolaLigada(page)), "a Escola está desligada nesta montagem (NEXT_PUBLIC_RECURSOS sem 'escola')");
});

/** Uma matrícula de teste no aparelho (sem nome; o número segue o formato LM-XXXX-XXXX) e, se pedido, a inscrição. */
async function matricular(page: Page, curso?: string) {
  await page.addInitScript((c) => {
    localStorage.setItem(
      "lucia:escola:matricula",
      JSON.stringify({ versao: 1, numero: "LM-2345-6789", criadaEm: "2026-08-10", objetivo: "outro", tempo: "1-3h", acesso: "wifi-em-casa", nivelamento: [] }),
    );
    if (c) localStorage.setItem("lucia:escola:cursos", JSON.stringify([{ curso: c, entrouEm: "2026-08-10", semestre: "2026.2", dispensas: [] }]));
  }, curso);
}

for (const lang of ["pt", "en"] as const) {
  test(`catálogo /${lang}/cursos: ciclos, cartões, selo e filtro`, async ({ page }) => {
    await abrir(page, `/${lang}/cursos`);
    await expect(page.locator("[data-catalogo-de-cursos]")).toBeVisible();
    const cartoes = page.locator("[data-curso]");
    expect(await cartoes.count()).toBeGreaterThanOrEqual(13);
    await expect(page.locator("[data-curso='aprender-a-estudar']")).toBeVisible();
    await expect(page.locator(".selo-aulas-prontas").first()).toHaveText(lang === "pt" ? "Curso montado só com aulas prontas" : "Course built only from finished lessons");
    // O filtro por objetivo esconde os cursos que não servem a ele.
    const antes = await cartoes.count();
    await page.getByLabel(lang === "pt" ? "O que você quer" : "What you want").selectOption("enem");
    await expect(page.locator("[data-curso='costura']")).toHaveCount(0);
    expect(await cartoes.count()).toBeLessThan(antes);
    await expect(page.locator("[data-curso='enem']")).toBeVisible();
  });
}

test("ementa: abre, tem as seis partes e o botão de imprimir", async ({ page }) => {
  await abrir(page, "/pt/cursos/ano-de-formacao-politica");
  await expect(page.locator("[data-aviso-sensivel]")).toBeVisible();
  await page.getByText("Ver a ementa completa").click();
  const ementa = page.locator("[data-ementa]");
  for (const parte of ["Objetivo", "Conteúdo", "Avaliação", "Bibliografia", "Requisitos", "Carga horária estimada"]) await expect(ementa.getByRole("heading", { name: parte, exact: true })).toBeVisible();
  await expect(ementa).toContainText("Formativa, sem nota");
  await expect(page.getByRole("button", { name: "Imprimir ementa" })).toBeVisible();
  await expect(page.locator("[data-patrono='antonio-gramsci']")).toContainText("Patrono proposto, a confirmar pela coordenação");
  await expect(page.locator("[data-obra='manifesto-do-partido-comunista']")).toContainText("Leitura guiada");
});

test("entrar no curso sem matrícula leva à matrícula com o curso", async ({ page }) => {
  await abrir(page, "/pt/cursos/aprender-a-estudar");
  const link = page.locator("[data-fazer-matricula]");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /\/pt\/escola\/matricula\?curso=aprender-a-estudar$/);
});

test("com matrícula, entrar no curso guarda a inscrição só no aparelho", async ({ page }) => {
  await matricular(page);
  await abrir(page, "/pt/cursos/aprender-a-estudar");
  await page.locator("[data-entrar-no-curso]").click();
  await expect(page.locator("[data-no-curso]")).toBeVisible();
  const inscricoes = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:escola:cursos") ?? "[]"));
  expect(inscricoes.map((i: { curso: string }) => i.curso)).toEqual(["aprender-a-estudar"]);
});

test("faixa do curso na aula de um curso inscrito", async ({ page }) => {
  await matricular(page, "aprender-a-estudar");
  await abrir(page, "/pt/trilhas/enem-estrategia-de-prova/estudar-do-jeito-que-funciona");
  const faixa = page.locator("[data-faixa-do-curso='aprender-a-estudar']");
  await expect(faixa).toBeVisible();
  await expect(faixa).toContainText("Aprender a estudar · módulo 1 · aula 1 de 8");
});

test("sem inscrição, a aula não mostra faixa", async ({ page }) => {
  await abrir(page, "/pt/trilhas/enem-estrategia-de-prova/estudar-do-jeito-que-funciona");
  await page.waitForTimeout(500);
  await expect(page.locator("[data-faixa-do-curso]")).toHaveCount(0);
});

test("zine do curso: folhas A4 com QR, e os outros idiomas vão para o português", async ({ page }) => {
  await abrir(page, "/pt/cursos/aprender-a-estudar/zine");
  const folhas = page.locator(".folha-livrinho");
  expect(await folhas.count()).toBeGreaterThanOrEqual(4);
  await expect(folhas.first().locator("svg").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".zine-do-curso .no-print").first()).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await abrir(page, "/en/cursos/aprender-a-estudar/zine");
  await expect(page).toHaveURL(/\/pt\/escola\/cursos\/aprender-a-estudar\/zine$/);
});

test("leitura guiada guarda a resposta só no aparelho", async ({ page }) => {
  await abrir(page, "/pt/escola/leituras/manifesto-do-partido-comunista");
  const campo = page.getByRole("textbox").first();
  await campo.fill("Os poderosos da Europa.");
  await campo.blur();
  await expect(page.getByText("Guardado só neste aparelho.")).toBeVisible();
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:escola:leituras") ?? "{}"));
  expect(guardado["manifesto-do-partido-comunista"].introducao[0]).toBe("Os poderosos da Europa.");
});

test("sem rolagem lateral em 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const caminho of ["/pt/cursos", "/pt/cursos/eletricista-residencial", "/pt/cursos/ano-de-formacao-politica/zine", "/pt/escola/leituras/manifesto-do-partido-comunista"]) {
    await abrir(page, caminho);
    await page.keyboard.press("Escape");
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra, caminho).toBeLessThanOrEqual(0);
  }
});
