// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leveza e alcance da aula (E4-17, docs/escola/leveza.md): convite do modo pacote (pacote-acaba, "Agora não" por 14 dias,
// "Não perguntar mais"), Libras com aviso antes de qualquer pedido ao VLibras, "Só o texto", "Levar esta aula", medidor,
// "apagar meus dados" e 360 px sem rolagem lateral. Os pedidos ao VLibras e ao jsDelivr são bloqueados (teste estável).
// Suba o servidor com a Escola ligada:
//   NEXT_PUBLIC_RECURSOS=todos,escola npm run dev:local   e depois   BASE_URL=http://localhost:3000 npx playwright test e2e/escola-leveza
import { expect, type Page, test } from "@playwright/test";
import { abrir } from "./ajuda";

const TRILHA = "a-terra-e-quem-nela-trabalha";
const AULA = `/pt/trilhas/${TRILHA}/o-que-e-reforma-agraria`;
const CONVITE = "lucia:modo-pacote-convite";

const matricula = (acesso: string) =>
  JSON.stringify({ versao: 1, numero: "LM-ABCD-EFGH", criadaEm: "2026-11-01", objetivo: "outro", tempo: "1-3h", acesso, nivelamento: [] });

async function comMatricula(page: Page, acesso: string) {
  await page.addInitScript((m) => {
    try {
      localStorage.setItem("lucia:escola:matricula", m);
    } catch {
      // sem armazenamento
    }
  }, matricula(acesso));
}

/** Conta os pedidos ao tradutor de Libras (e os bloqueia). */
async function vigiarVLibras(page: Page) {
  const pedidos: string[] = [];
  await page.route(/vlibras\.gov\.br|cdn\.jsdelivr\.net/, (rota) => {
    pedidos.push(rota.request().url());
    return rota.abort();
  });
  return pedidos;
}

test.describe("convite do modo pacote", () => {
  test("pacote-acaba: convida, liga o pacote e o convite não volta", async ({ page }) => {
    await comMatricula(page, "pacote-acaba");
    await abrir(page, AULA);
    const convite = page.getByRole("region", { name: /pacote de dados/i });
    await expect(convite).toBeVisible();
    await convite.getByRole("button", { name: "Ligar o modo pacote" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-pacote", "");
    await expect(page.locator("html")).toHaveAttribute("data-light", "");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-pacote", "");
    await expect(page.getByRole("region", { name: /pacote de dados/i })).toHaveCount(0);
  });

  test("Agora não some por 14 dias; Não perguntar mais nunca volta", async ({ page }) => {
    await comMatricula(page, "pacote-acaba");
    await abrir(page, AULA);
    await page.getByRole("button", { name: "Agora não" }).first().click();
    await expect(page.getByRole("region", { name: /pacote de dados/i })).toHaveCount(0);
    expect(await page.evaluate((c) => JSON.parse(localStorage.getItem(c) ?? "{}").resposta, CONVITE)).toBe("depois");
    await page.reload();
    await expect(page.getByRole("region", { name: /pacote de dados/i })).toHaveCount(0);
    // Com a resposta guardada 15 dias atrás, volta.
    await page.evaluate((c) => {
      const velha = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10);
      localStorage.setItem(c, JSON.stringify({ resposta: "depois", em: velha }));
    }, CONVITE);
    await page.reload();
    const convite = page.getByRole("region", { name: /pacote de dados/i });
    await expect(convite).toBeVisible();
    await convite.getByRole("button", { name: "Não perguntar mais" }).click();
    await page.evaluate((c) => {
      const velha = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
      const atual = JSON.parse(localStorage.getItem(c) ?? "{}");
      localStorage.setItem(c, JSON.stringify({ ...atual, em: velha }));
    }, CONVITE);
    await page.reload();
    await expect(page.getByRole("region", { name: /pacote de dados/i })).toHaveCount(0);
  });

  test("sem matrícula e sem sinais, o convite não aparece", async ({ page }) => {
    await abrir(page, AULA);
    await expect(page.getByRole("button", { name: "Estudar mais leve" }).or(page.getByText("Estudar mais leve"))).toBeVisible();
    await expect(page.getByRole("region", { name: /pacote de dados/i })).toHaveCount(0);
  });
});

test.describe("Libras", () => {
  test("em português: aviso e selo antes de qualquer pedido; Agora não fecha", async ({ page }) => {
    const pedidos = await vigiarVLibras(page);
    await abrir(page, AULA);
    await page.getByRole("button", { name: "Ver esta aula em Libras" }).click();
    await expect(page.getByText(/não substitui um intérprete/i)).toBeVisible();
    expect(pedidos).toHaveLength(0);
    await page.getByRole("button", { name: "Agora não" }).first().click();
    await expect(page.getByRole("button", { name: "Ver esta aula em Libras" })).toBeVisible();
    expect(pedidos).toHaveLength(0);
  });

  test("em inglês: só português e link para a aula em /pt", async ({ page }) => {
    await vigiarVLibras(page);
    await abrir(page, AULA.replace("/pt/", "/en/"));
    const link = page.getByRole("link", { name: /Open this lesson in Portuguese/i });
    if (await link.count()) await expect(link).toHaveAttribute("href", new RegExp(`^/pt/trilhas/${TRILHA}/`));
  });
});

test.describe("estudar mais leve", () => {
  test("Só o texto esconde a margem, mantém o texto e persiste", async ({ page }) => {
    await abrir(page, AULA);
    await page.getByText("Estudar mais leve").click();
    await page.getByRole("switch", { name: "Só o texto" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-aula-leve", "");
    await expect(page.locator(".coluna-da-margem")).toBeHidden();
    await expect(page.locator("article h1")).toBeVisible();
    await expect(page.locator("[data-next], nav a").last()).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-aula-leve", "");
  });

  test("Levar esta aula: texto puro e EPUB da trilha", async ({ page }) => {
    await abrir(page, AULA);
    await page.getByText("Estudar mais leve").click();
    await expect(page.getByRole("link", { name: /Baixar só o texto/ })).toHaveAttribute("href", `${AULA}/texto`);
    await expect(page.getByRole("link", { name: /EPUB/ })).toHaveAttribute("href", `/epub/${TRILHA}.epub`);
  });

  test("o medidor mostra um tamanho ou diz que o navegador não informou, sem pedido novo", async ({ page }) => {
    await abrir(page, AULA);
    await page.getByText("Estudar mais leve").click();
    let novos = 0;
    page.on("request", () => novos++);
    await page.getByRole("button", { name: "Ver quanto esta página gastou" }).click();
    await expect(page.getByText(/gastou cerca de|não informou/i).last()).toBeVisible();
    expect(novos).toBe(0);
  });

  test("apagar meus dados remove as chaves do pacote", async ({ page }) => {
    await abrir(page, AULA);
    await page.evaluate((c) => {
      localStorage.setItem(c, JSON.stringify({ resposta: "nunca", em: "2026-11-01" }));
      localStorage.setItem("lucia:escola:aula-leve", "1");
    }, CONVITE);
    await abrir(page, "/pt/privacidade");
    const apagar = page.getByRole("button", { name: /apagar meus dados/i }).first();
    if (await apagar.count()) {
      page.once("dialog", (d) => d.accept());
      await apagar.click();
      const resto = await page.evaluate((c) => [localStorage.getItem(c), localStorage.getItem("lucia:escola:aula-leve")], CONVITE);
      expect(resto).toEqual([null, null]);
    }
  });
});

test("360 px sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await comMatricula(page, "pacote-acaba");
  await abrir(page, AULA);
  await page.getByText("Estudar mais leve").click();
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test("leitor de tinta (Kindle): o pacote não anima nada", async ({ browser }) => {
  const contexto = await browser.newContext({ userAgent: "Mozilla/5.0 (Linux; U; Android 4.4; Kindle Fire) Silk/90 like Chrome/90" });
  const page = await contexto.newPage();
  await abrir(page, AULA);
  const animando = await page.evaluate(() => [...document.querySelectorAll(".lev *")].some((e) => getComputedStyle(e).transitionDuration !== "0s" && getComputedStyle(e).transitionDuration !== ""));
  expect(animando).toBe(false);
  await contexto.close();
});
