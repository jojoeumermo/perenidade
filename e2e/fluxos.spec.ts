// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test } from "@playwright/test";
import { abrir, entrarComo, rpc, sessao } from "./ajuda";

// Os fluxos que não podem quebrar: estudar uma aula, buscar, entrar, postar na Comunidade, o painel de cada cargo,
// contribuir e imprimir material. Rodam contra o banco de teste local (playwright.config.ts).

test("abrir uma aula e marcar como concluída", async ({ page }) => {
  await abrir(page, "/pt/trilhas/historia-antiga/pre-historia-os-primeiros-seres-humanos");
  await expect(page.getByRole("heading", { level: 1, name: /Pré-história/ })).toBeVisible();
  // Clicado antes de a página terminar de carregar, o clique se perde: repete até a marca aparecer.
  await expect(async () => {
    await page.getByRole("button", { name: /Marcar como concluída|Aula concluída/ }).first().click({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Aula concluída/ })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90_000 });
  // A marca fica no aparelho: recarregou, continua lá.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /Aula concluída/ })).toBeVisible();
});

test("buscar no acervo e nas aulas", async ({ page }) => {
  await abrir(page, "/pt/busca");
  const campo = page.getByRole("searchbox", { name: /Buscar em aulas/ });
  await expect(async () => {
    await campo.fill("pré-história");
    await expect(page.locator("main a").filter({ hasText: /Pré-história/i }).first()).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 90_000 });
});

test("entrar pelo formulário", async ({ page }) => {
  await abrir(page, "/pt/entrar");
  await page.getByLabel("Seu e-mail").fill("leitora@local");
  await page.getByLabel("Senha", { exact: true }).fill("uma senha qualquer de teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("lucia:sessao") !== null)).toBe(true);
});

test("postar na Rede Lúcia e ver o post na linha", async ({ page }) => {
  const s = await entrarComo(page, "leitora@local");
  await rpc(s.access_token, "rede_confirmar_idade");
  const texto = `Teste de ponta a ponta ${Date.now()}`;
  await abrir(page, "/pt/comunidade");
  const postar = page.getByRole("button", { name: "Postar", exact: true });
  await expect(async () => {
    await page.getByRole("textbox", { name: "Escrever na rede" }).fill(texto);
    await expect(postar).toBeEnabled({ timeout: 3000 });
  }).toPass({ timeout: 90_000 });
  await postar.click();
  await page.getByRole("tab", { name: "Tudo" }).click();
  await expect(page.getByText(texto)).toBeVisible();
});

test("o painel abre com o menu da função de quem entra", async ({ page }) => {
  const s = await entrarComo(page, "jornal@local");
  // Na primeira vez, o termo de voluntariado vem antes de tudo: aceito direto no banco local.
  await rpc(s.access_token, "termo_voluntario_aceitar").catch(() => null);
  await abrir(page, "/pt/painel");
  // O menu agrupa as telas por assunto; quem produz conteúdo tem o grupo Produção.
  await expect(page.getByRole("button", { name: "Produção" })).toBeVisible();
});

test("contribuir: o formulário público abre e explica o caminho", async ({ page }) => {
  await abrir(page, "/pt/contribuir");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main form, main a[href*='/entrar']").first()).toBeVisible();
});

test("imprimir: o kit do núcleo e a zine da aula saem prontos para o papel", async ({ page }) => {
  await abrir(page, "/pt/trilhas/historia-antiga/nucleo");
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lista de presença" })).toBeVisible();
  await abrir(page, "/pt/trilhas/historia-antiga/pre-historia-os-primeiros-seres-humanos/zine");
  await expect(page.locator(".folha-livrinho .livrinho-quadro")).toHaveCount(8);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeHidden();
});

test("a conta de teste existe no banco local", async () => {
  // Guarda contra rodar os testes apontando para o banco errado (ou para produção, que recusaria este segredo).
  const s = await sessao("leitora@local");
  expect(s.access_token).toBeTruthy();
});
