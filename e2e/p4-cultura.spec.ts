// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, itens 38 a 42: a cultura (/alumia/cultura) com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim e as flags
// ligadas; nada vai a banco nenhum). No computador e em 390 px:
//   - obras: abrir, seguir, criar uma obra e ligar um capítulo (o endereço ruim é recusado na tela);
//   - mural: o portfólio de um @ sob o codinome;
//   - cineclube: a sessão e o diário sem autor; endereço de casa é recusado antes de sair;
//   - clube de leitura: o grupo somado só a partir de 3 e o próprio progresso;
//   - playlist: só links, abrindo fora sem levar a página de origem;
//   - nada passa da largura, todo alvo de toque tem 44 px, nada anima com movimento reduzido e nenhum pedido sai para outro endereço.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-cultura --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-cultura'
//    npx next dev --webpack -p <porta>)

const ROTA = "/pt/alumia/cultura";
const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, input[type="checkbox"], input[type="radio"], select';

async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
      if (!el.closest(".cu-pagina")) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) saida.push(`${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return saida;
  }, ALVOS);
}

async function conferirTela(page: Page, onde: string) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect(largura.conteudo, `nada passa da largura (${onde})`).toBeLessThanOrEqual(largura.tela + 1);
  expect(await alvosPequenos(page), `alvos de toque de pelo menos 44 px (${onde})`).toEqual([]);
  const rodando = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest(".cu-pagina")).length,
  );
  expect(rodando, `nada animando com movimento reduzido (${onde})`).toBe(0);
}

async function percorrer(page: Page) {
  const fora: string[] = [];
  const base = new URL(process.env.BASE_URL ?? "http://localhost:3100").origin;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.origin !== base) fora.push(u.origin);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resposta = await page.goto(ROTA);
  expect(resposta?.status() ?? 0, "a tela abre").toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1, name: "Cultura" })).toBeVisible({ timeout: 120_000 });
  // A prévia entra como quem ainda não aceitou os termos em vigor (P5, A6): aceita e segue.
  const aceitar = page.getByRole("button", { name: "Aceitar e continuar" });
  if (await aceitar.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await page.locator(".le-reaceite input[type=checkbox]").check();
    await aceitar.click();
    await expect(aceitar).toBeHidden();
  }
  await page.waitForLoadState("networkidle").catch(() => undefined);
  expect(await page.locator(".cu-carimbo").evaluate((el) => getComputedStyle(el).transform), "o carimbo não gira com movimento reduzido").toBe("none");

  const cu = page.locator(".cu-pagina");
  // ── 38. Obras ──
  const aba = (nome: string) => page.getByRole("tab", { name: nome });
  await expect(aba("Obras em capítulos")).toHaveAttribute("aria-selected", "true");
  await expect(cu.getByText("Cordel da greve")).toBeVisible();
  await conferirTela(page, "obras");
  await page.getByRole("button", { name: "Abrir a obra: Cordel da greve" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Cordel da greve" })).toBeVisible();
  await expect(cu.getByText("A autora não sabe quem segue")).toBeVisible();
  await page.getByRole("button", { name: "Seguir a obra" }).click();
  await expect(page.getByRole("button", { name: "Deixar de seguir" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Ler o capítulo 1" })).toHaveAttribute("href", /\/pt\/alumia\/p\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "← Voltar às obras" }).click();

  await cu.getByLabel("Título da obra").fill("Poemas do bairro");
  await page.getByRole("button", { name: "Criar a obra" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Poemas do bairro" })).toBeVisible();
  await expect(cu.getByText(/Menos de 3 pessoas seguem esta obra/)).toBeVisible();
  await cu.getByLabel("Endereço do post").fill("https://exemplo.org/pt/alumia/u/fulana");
  await page.getByRole("button", { name: "Ligar como próximo capítulo" }).click();
  await expect(cu.getByText(/Não reconheci o endereço/)).toBeVisible();
  await cu.getByLabel("Endereço do post").fill("/pt/alumia/p/0f8b3c2a-1d4e-4f5a-9b6c-7d8e9f0a1b2c");
  await page.getByRole("button", { name: "Ligar como próximo capítulo" }).click();
  await expect(cu.getByText(/Capítulo ligado/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ler o capítulo 1" })).toBeVisible();
  await conferirTela(page, "obra aberta");

  // ── 39. Mural ──
  await aba("Mural de arte").click();
  await expect(cu.getByText("Lambe da escola")).toBeVisible();
  await cu.getByLabel("Portfólio de um @").fill("@faisca");
  await page.getByRole("button", { name: "Ver o portfólio" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Portfólio de Faísca" })).toBeVisible();
  await expect(cu.getByText("Retrato da ocupação")).toBeHidden();
  await conferirTela(page, "mural");

  // ── 40. Cineclube ──
  await aba("Cineclube").click();
  await expect(cu.locator(".cu-campo-comunidade select")).toBeVisible();
  await expect(cu.getByText("Eles não usam black-tie (1981)")).toBeVisible();
  const diario = page.locator(".cu-item").filter({ hasText: "Bacurau" });
  await expect(diario).toBeVisible();
  expect(await diario.innerText(), "o diário não diz quem escreveu").not.toMatch(/por |Codinome|@/);
  await cu.getByLabel("Qual lugar (opcional)").fill("Rua das Flores, 123");
  await cu.getByLabel("Filme", { exact: true }).first().fill("Filme qualquer");
  await page.locator(".al-quando input").fill("2030-05-10T19:00");
  await page.getByRole("button", { name: "Marcar a sessão", exact: true }).click();
  await expect(cu.getByText(/Isso parece um endereço de casa/)).toBeVisible();
  const cine = await page.locator(".cu-painel").innerText();
  expect(cine, "sem número de quem viu nem ranking").not.toMatch(/\bvou\b|presentes|\d+\s+pessoas|\d+º lugar/i);
  await conferirTela(page, "cineclube");

  // ── 41. Clube de leitura ──
  await aba("Clube de leitura").click();
  const quarto = page.locator(".cu-item").filter({ hasText: "Quarto de despejo" });
  await expect(quarto.getByText("3 leitoras, em média 70% lido.")).toBeVisible();
  const torto = page.locator(".cu-item").filter({ hasText: "Torto arado" });
  await expect(torto.getByText("O progresso do grupo aparece com 3 leitoras ou mais.")).toBeVisible();
  await quarto.getByLabel("O meu progresso").selectOption("100");
  await expect(quarto.getByText("4 leitoras, em média 80% lido.")).toBeVisible();
  await conferirTela(page, "leitura");

  // ── 42. Playlist ──
  await aba("Playlist").click();
  const abrir = page.getByRole("link", { name: "Abrir em musica.exemplo.org" });
  await expect(abrir).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await expect(abrir).toHaveAttribute("target", "_blank");
  await expect(page.locator(".cu-painel iframe, .cu-painel audio, .cu-painel video")).toHaveCount(0);
  await cu.getByLabel("Link (https://…)").fill("https://video.exemplo.net/v/9");
  await page.getByRole("button", { name: "Buscar a prévia" }).click();
  await expect(cu.getByText(/Não deu para ler a prévia/)).toBeVisible();
  await page.getByRole("button", { name: "Pôr na playlist" }).click();
  await expect(cu.getByText("Link na playlist.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir em video.exemplo.net" })).toBeVisible();
  await conferirTela(page, "playlist");

  // As setas do teclado andam entre as abas.
  await aba("Playlist").focus();
  await page.keyboard.press("ArrowRight");
  await expect(aba("Obras em capítulos")).toHaveAttribute("aria-selected", "true");

  const guardado = await page.evaluate(() => Object.keys(localStorage).filter((k) => /cultura/i.test(k)));
  expect(guardado, "a cultura não guarda nada no aparelho").toEqual([]);
  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

test.describe("Cultura", () => {
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
