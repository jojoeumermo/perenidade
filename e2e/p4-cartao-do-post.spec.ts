// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Locator, type Page } from "@playwright/test";

// Prompt 4, grupo "cartão do post" (itens 30, 35, 120 e 135), na prévia com dados de exemplo (nada vai a banco nenhum). No dublê
// da prévia (lib/rede/p4/cartao/cliente.ts), a comunidade "marxismo" tem a lista própria ✊ 📚 💡 🌻 e quem olha é da mediação.
//   item 30  a mediação vê "Reações desta comunidade" no alto da comunidade e confere a lista; a conversa mostra só os emojis da
//            lista (o 🤔 do exemplo some) e a paleta de reagir é a da comunidade;
//   item 35  nos Salvos, a pasta privada aberta tem "Tornar esta pasta pública"; a do núcleo, não;
//   item 120 no "Levar para fora", os destinos (Instagram e WhatsApp) e "Esconder quem escreveu";
//   item 135 (já existia) "Recolher" fecha um ramo da conversa com um toque e "Mostrar" o abre.
// No computador e em 390 px, com movimento reduzido e alvos de 44 px. Rodar:
//   NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-org,alumia-alcance,alumia-p4-cartao-do-post' \
//     npx next dev --webpack -p <porta>
//   BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-cartao-do-post --project=computador

const TAMANHOS = [
  { nome: "computador", viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false },
  { nome: "390 px", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
] as const;

/** A janela dos termos (P5, A6) bloqueia a tela até o aceite: na prévia, aceita (só na memória da aba). */
async function aceitarOsTermos(page: Page) {
  const janela = page.locator(".le-janela-fundo");
  // A janela só abre depois que a página hidrata: espera a rede assentar antes de olhar.
  await page.waitForLoadState("networkidle", { timeout: 90_000 }).catch(() => {});
  if (!(await janela.isVisible().catch(() => false))) {
    await page.waitForTimeout(1500);
    if (!(await janela.isVisible().catch(() => false))) return;
  }
  await janela.locator("input[type=checkbox]").check();
  await janela.getByRole("button", { name: "Aceitar e continuar" }).click();
  await expect(janela).toBeHidden();
}

async function alvoDe44(alvo: Locator) {
  const caixa = await alvo.boundingBox();
  expect(caixa, "o alvo aparece").not.toBeNull();
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
}

async function semRolagemDeLado(page: Page) {
  const largo = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(largo).toBeLessThanOrEqual(1);
}

for (const tam of TAMANHOS) {
  test.describe(`cartão do post (${tam.nome})`, () => {
    test.use({ viewport: tam.viewport, isMobile: tam.isMobile, hasTouch: tam.hasTouch });
    test.setTimeout(240_000);

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("item 30: a lista de reações da comunidade, na mediação e na conversa", async ({ page }) => {
      await page.goto("/pt/alumia/c/marxismo");
      await aceitarOsTermos(page);
      const bloco = page.locator('[data-p4c="reacoes"]');
      await expect(bloco).toBeVisible({ timeout: 90_000 });
      const resumo = bloco.locator("summary");
      await alvoDe44(resumo);
      await resumo.click();
      await expect(bloco.getByText("Ninguém vê quem reagiu", { exact: false })).toBeVisible();
      const campo = bloco.getByLabel("Emojis (até 6)");
      await expect(campo).toHaveValue("✊ 📚 💡 🌻");
      await alvoDe44(campo);
      // Sete emojis: o aviso aparece e salvar fica travado.
      await campo.fill("🌻🌹🌷🌼🌸🌺🍀");
      await expect(bloco.getByRole("alert")).toHaveText("No máximo 6 emojis.");
      await expect(bloco.getByRole("button", { name: "Salvar a lista" })).toBeDisabled();
      await campo.fill("✊ 📚 💡 🌻");
      await expect(bloco.getByRole("button", { name: "Salvar a lista" })).toBeEnabled();
      await alvoDe44(bloco.getByRole("button", { name: "Salvar a lista" }));
      await semRolagemDeLado(page);

      await page.goto("/pt/alumia/p/exemplo-lia");
      await aceitarOsTermos(page);
      const reacoes = page.getByRole("group", { name: "Reações" }).first();
      await expect(reacoes).toBeVisible({ timeout: 90_000 });
      // O 🤔 do exemplo não é da lista da comunidade: some; ✊ e 📚 ficam.
      await expect(reacoes.locator('[data-emoji="✊"]')).toBeVisible();
      await expect(reacoes.locator('[data-emoji="📚"]')).toBeVisible();
      await expect(reacoes.locator('[data-emoji="🤔"]')).toHaveCount(0);
      await aceitarOsTermos(page);
      await reacoes.getByRole("button", { name: "Reagir" }).click();
      const paleta = page.locator(".al3-paleta").first();
      await expect(paleta.getByRole("button", { name: "Reagir com 💡" })).toBeVisible();
      await expect(paleta.getByRole("button", { name: "Reagir com 🌻" })).toBeVisible();
      await expect(paleta.getByRole("button", { name: "Reagir com Fogo" })).toHaveCount(0);
      // Nenhum nome de quem reagiu na tela das reações.
      await expect(reacoes).not.toContainText("@");
      await semRolagemDeLado(page);
    });

    test("item 135: recolher e mostrar um ramo da conversa", async ({ page }) => {
      await page.goto("/pt/alumia/p/exemplo-lia");
      await aceitarOsTermos(page);
      const recolher = page.locator(".al3-recolher").first();
      await expect(recolher).toBeVisible({ timeout: 90_000 });
      await expect(recolher).toHaveAttribute("aria-expanded", "true");
      const ramo = page.locator(`#${await recolher.getAttribute("aria-controls")}`);
      await recolher.click();
      await expect(recolher).toHaveAttribute("aria-expanded", "false");
      await expect(ramo).toHaveAttribute("data-recolhido", "sim");
      await expect(recolher).toContainText("Mostrar");
      await recolher.click();
      await expect(recolher).toHaveAttribute("aria-expanded", "true");
      await expect(ramo).toHaveAttribute("data-recolhido", "nao");
    });

    test("item 35: a pasta privada pode virar pública; a do núcleo, não", async ({ page }) => {
      await page.goto("/pt/alumia/salvos");
      await aceitarOsTermos(page);
      await page.getByRole("button", { name: /Tarifa zero/ }).first().click({ timeout: 90_000 });
      const bloco = page.locator('[data-p4c="pasta-publica"]');
      await expect(bloco).toBeVisible();
      const chave = bloco.getByRole("checkbox", { name: "Tornar esta pasta pública" });
      await expect(chave).not.toBeChecked();
      await alvoDe44(chave.locator("xpath=ancestor::label[1]"));
      await chave.check();
      await expect(chave).toBeChecked();
      await expect(bloco).toContainText("aparece como coleção no seu perfil");
      await expect(bloco).toContainText("ficaram só aqui");
      await page.getByRole("button", { name: /Para a assembleia/ }).first().click();
      await expect(page.locator('[data-p4c="pasta-publica"]')).toHaveCount(0);
      await semRolagemDeLado(page);
    });

    test("item 120: a imagem para Instagram e WhatsApp, com a autora escondida", async ({ page }) => {
      await page.goto("/pt/alumia/p/exemplo-lia");
      await aceitarOsTermos(page);
      const mais = page.locator("article details > summary").first();
      await expect(mais).toBeVisible({ timeout: 90_000 });
      await mais.click();
      await page.getByRole("button", { name: "Levar para fora" }).first().click();
      const folha = page.getByRole("dialog");
      await expect(folha).toBeVisible();
      for (const destino of ["Instagram (feed)", "Instagram (stories)", "WhatsApp", "WhatsApp (status)"]) {
        await expect(folha.getByRole("radio", { name: destino, exact: true })).toBeVisible();
      }
      await folha.getByRole("radio", { name: "Instagram (stories)", exact: true }).check();
      await expect(folha.locator('.alc-arte-previa[data-formato="story"]')).toBeVisible();
      const esconder = folha.getByRole("checkbox", { name: "Esconder quem escreveu" });
      await esconder.check();
      await expect(folha.locator(".alc-arte-previa img")).toBeVisible({ timeout: 30_000 });
      await expect(folha.locator(".alc-arte-previa img")).not.toHaveAttribute("alt", /Lia Quilombo/);
      await expect(folha.getByText("@institutoluciaorg", { exact: false })).toBeVisible();
      await semRolagemDeLado(page);
    });
  });
}
