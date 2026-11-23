// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, item 4: os avisos de local (/alumia/mapa/avisos) com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim e as
// flags ligadas; nada vai a banco nenhum). No computador e em 390 px:
//   - a tela abre, com o rótulo "relato de usuárias, não verificado" e o limite do anonimato dito;
//   - o município leva ao desenho de 7 x 7 quadrados; as setas andam; só a célula e a categoria saem (o pedido é conferido);
//   - avisar pede confirmação e mostra o aviso na lista, sem número de relatos;
//   - nada passa da largura, todo alvo de toque tem 44 px e, com movimento reduzido, nada fica girando nem animando;
//   - nenhum pedido sai para outro endereço que não o do próprio site.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-avisos-de-local --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-avisos-de-local'
//    npx next dev --webpack -p <porta>)

const ROTA = "/pt/alumia/mapa/avisos";
const ALVOS = 'button, [role="button"], summary, a.al-botao, input[type="checkbox"], input[type="radio"], select';

async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
      if (!el.closest(".av-pagina")) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
      const alvo = (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && el.closest("label")) || el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) saida.push(`${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return saida;
  }, ALVOS);
}

async function percorrer(page: Page) {
  const fora: string[] = [];
  const base = new URL(page.url() === "about:blank" ? (process.env.BASE_URL ?? "http://localhost:3100") : page.url()).origin;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.origin !== base) fora.push(u.origin);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resposta = await page.goto(ROTA);
  expect(resposta?.status() ?? 0, "a tela abre").toBeLessThan(400);

  await expect(page.getByRole("heading", { level: 1, name: "Avisos de local" })).toBeVisible({ timeout: 120_000 });
  // A prévia entra como quem ainda não aceitou os termos em vigor (P5, A6): aceita e segue.
  const aceitar = page.getByRole("button", { name: "Aceitar e continuar" });
  if (await aceitar.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await page.locator(".le-reaceite input[type=checkbox]").check();
    await aceitar.click();
    await expect(aceitar).toBeHidden();
  }
  await expect(page.getByRole("note").filter({ hasText: "Relato de usuárias, não verificado" })).toBeVisible();
  await expect(page.getByText(/vale perante as outras pessoas, não perante o servidor/)).toBeVisible();
  await expect(page.getByText(/Ninguém recebe push nem notificação/)).toBeVisible();

  // O município e a UF levam ao desenho.
  // (a tela só monta no navegador: espera ela assentar antes de escrever, e tenta de novo se a casca remontar no meio)
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const desenho = page.getByRole("grid");
  await expect(async () => {
    await page.getByLabel("Município").fill("Recife");
    await page.getByLabel("UF").selectOption("PE");
    await page.getByRole("button", { name: "Ir para o município" }).click();
    await expect(desenho).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(desenho.getByRole("gridcell")).toHaveCount(49);
  await expect(page.getByText(/O ponto de partida é o centro do município/)).toBeVisible();

  // As setas andam um quadrado (o escolhido continua no meio do desenho).
  await page.getByRole("button", { name: "Um quadrado para o norte" }).click();
  await expect(desenho.locator('[aria-selected="true"]')).toHaveCount(1);

  // A lista chega, com estado em palavras e sem número.
  await expect(page.getByText("Relatos confirmados").first()).toBeVisible();
  await expect(page.getByText("Sem confirmação (menos de 3 relatos)").first()).toBeVisible();
  const lista = await page.locator(".av-lista").innerText();
  expect(lista, "nenhum número de relatos na lista").not.toMatch(/\b\d+\s+relatos?\b/);

  // Avisar: escolhe a categoria, confirma e o aviso aparece.
  await page.getByLabel("Violência contra manifestantes").check();
  await page.getByRole("button", { name: "Avisar neste quadrado" }).click();
  const janela = page.getByRole("dialog");
  await expect(janela).toBeVisible();
  await janela.getByRole("button", { name: "Avisar neste quadrado" }).click();
  await expect(page.getByText("Aviso feito. Ele some em 2 horas.")).toBeVisible();
  await expect(page.locator(".av-lista").getByText("Violência contra manifestantes")).toBeVisible();

  // Uma ação por hora: a segunda é recusada com a frase certa.
  await page.locator(".av-lista").getByRole("button", { name: "Ainda está lá" }).first().click();
  await expect(page.getByText("Você já fez uma ação nesta hora. Tente de novo na próxima hora.")).toBeVisible();

  // Seguir a área fica no aparelho.
  await page.getByRole("button", { name: "Seguir esta área" }).click();
  const guardado = await page.evaluate(() => localStorage.getItem("alumia:avisos-de-local:areas"));
  expect(guardado, "a área seguida fica no aparelho").toMatch(/^\[\{"ala":-?\d+,"alo":-?\d+\}\]$/);

  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
  expect(await alvosPequenos(page), "alvos de toque de pelo menos 44 px").toEqual([]);
  const rodando = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest(".av-pagina")).length,
  );
  expect(rodando, "nada animando com movimento reduzido").toBe(0);
  expect(await page.locator(".av-carimbo").evaluate((el) => getComputedStyle(el).transform), "o carimbo não gira com movimento reduzido").toBe("none");
  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

test.describe("Avisos de local", () => {
  test.setTimeout(300_000);

  test("no computador", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await percorrer(page);
  });

  test.describe("em 390 px", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    test("no celular", async ({ page }) => {
      await percorrer(page);
    });
  });
});
