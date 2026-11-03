// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Busca viva (E4-05): a caixa "Melhor caminho" na página de busca, o microfone que some sem reconhecimento de fala,
// o "Por onde andei" (desligado por padrão; ligado, guarda as páginas), os três passos do Meu estudo vazio, o
// "Revisar esta aula" abrindo o Praticar com a aula e a saída rápida do modo seguro (Esc três vezes apaga "lucia*").
// Roda nos projetos "computador" e "celular". Suba o servidor com a Escola, o Meu estudo e os exercícios ligados:
//   NEXT_PUBLIC_RECURSOS=escola,meu-estudo,exercicios npm run dev:local
import { expect, test } from "@playwright/test";

const chavesLucia = (page: import("@playwright/test").Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((chave) => chave.startsWith("lucia")));

test("a pergunta da EJA mostra o Melhor caminho em /busca", async ({ page }) => {
  await page.goto(`/pt/busca?q=${encodeURIComponent("como faço para estudar na EJA")}`);
  const caixa = page.locator("[data-melhor-caminho]");
  await expect(caixa).toBeVisible({ timeout: 20_000 });
  await expect(caixa).toContainText("Melhor caminho");
  await expect(caixa.getByRole("link").first()).toHaveAttribute("href", "/pt/trilhas/alfabetizacao-de-jovens-e-adultos/o-que-e-a-eja-e-como-se-matricular");
});

test("sem casamento, a busca fica como era", async ({ page }) => {
  await page.goto(`/pt/busca?q=${encodeURIComponent("revolução russa")}`);
  await expect(page.getByRole("status").first()).not.toHaveText(/Carregando|Loading/, { timeout: 20_000 });
  await expect(page.locator("[data-melhor-caminho]")).toHaveCount(0);
});

test("o microfone some sem reconhecimento de fala e aparece com ele", async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });
  await page.goto("/pt/busca");
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.locator("[data-busca-voz]")).toHaveCount(0);

  const outra = await page.context().newPage();
  await outra.addInitScript(() => {
    class Falso {
      lang = "";
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror = null;
      start() {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "como faço rescisão" }], { isFinal: true })] });
          this.onend?.();
        }, 50);
      }
      stop() {}
      abort() {}
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = Falso;
  });
  await outra.goto("/pt/busca");
  await outra.locator("[data-busca-voz]").click();
  // Primeiro uso: o aviso de que quem transcreve é o navegador, e só segue depois do "Entendi".
  await expect(outra.getByRole("dialog")).toContainText("não pelo Instituto");
  await outra.getByRole("button", { name: "Entendi" }).click();
  await expect(outra.getByRole("searchbox")).toHaveValue("como faço rescisão");
  await expect(outra.locator("[data-melhor-caminho]")).toBeVisible({ timeout: 20_000 });
  await outra.close();
});

test("sem ligar o histórico, nada é gravado", async ({ page }) => {
  await page.goto("/pt/acervo");
  await page.goto("/pt/sobre");
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => localStorage.getItem("lucia:historico"))).toBeNull();
});

test("ligar o histórico, visitar 3 páginas e vê-las em /por-onde-andei", async ({ page }) => {
  await page.goto("/pt/busca");
  const convite = page.locator("[data-convite-historico]");
  await expect(convite).toBeVisible();
  await convite.getByRole("button", { name: "Sim, lembrar" }).click();
  for (const caminho of ["/pt/sobre", "/pt/acervo", "/pt/direitos"]) {
    await page.goto(caminho);
    await page.waitForTimeout(700);
  }
  await page.goto("/pt/por-onde-andei");
  const lista = page.locator("main");
  await expect(lista.getByRole("heading", { name: "Hoje" })).toBeVisible();
  for (const href of ["/pt/sobre", "/pt/acervo", "/pt/direitos"]) await expect(lista.locator(`a[href="${href}"]`)).toBeVisible();
  await lista.getByRole("button", { name: "Não guardar mais" }).click();
  expect(await page.evaluate(() => [localStorage.getItem("lucia:historico"), localStorage.getItem("lucia:historico-ligado")])).toEqual([null, null]);
});

test("o Meu estudo vazio mostra os três passos", async ({ page }) => {
  await page.goto("/pt/meu-estudo");
  const passos = page.locator('[data-comeco="meuEstudo"]');
  await expect(passos).toBeVisible();
  await expect(passos.getByRole("listitem")).toHaveCount(3);
  await expect(passos).toContainText("Abra a primeira aula");
});

test("'Revisar esta aula' abre o Praticar com os exercícios da aula", async ({ page }) => {
  await page.goto("/pt");
  await page.evaluate(() => sessionStorage.setItem("lucia:praticar-aula", JSON.stringify({ aula: "alfabetizacao-de-jovens-e-adultos/fazer-contas-do-dia-a-dia" })));
  await page.goto("/pt/meu-estudo/praticar");
  const aviso = page.locator('[data-praticar-aula="alfabetizacao-de-jovens-e-adultos/fazer-contas-do-dia-a-dia"]');
  await expect(aviso).toContainText("Fazer contas do dia a dia");
  await expect(page.locator("main")).toContainText(/Da aula|da aula/);
  expect(await page.evaluate(() => sessionStorage.getItem("lucia:praticar-aula"))).toBeNull();
});

test("modo seguro: Esc três vezes apaga as chaves 'lucia*' e sai do site", async ({ page }) => {
  await page.route("https://www.google.com/**", (rota) => rota.fulfill({ status: 200, contentType: "text/html", body: "<title>neutra</title>" }));
  await page.goto("/pt/modo-seguro");
  await page.evaluate(() => {
    localStorage.setItem("lucia:concluidas", JSON.stringify(["x/y"]));
    localStorage.setItem("lucia:historico-ligado", "1");
    localStorage.setItem("outro-site", "fica");
  });
  await page.locator("[data-ligar-modo-seguro]").click();
  await expect(page.locator("[data-saida-rapida]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForURL(/google\.com/);
  await page.goto("/pt/sobre");
  expect(await chavesLucia(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("outro-site"))).toBe("fica");
  // O modo seguro vivia no sessionStorage: depois da saída, ele não está mais ligado.
  await expect(page.locator("[data-saida-rapida]")).toHaveCount(0);
});

test("sem rolagem lateral em /modo-seguro e /por-onde-andei", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const caminho of ["/pt/modo-seguro", "/pt/por-onde-andei"]) {
    await page.goto(caminho);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(largura, caminho).toBeLessThanOrEqual(0);
  }
});
