// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { abrir } from "./ajuda";
import { listaFalsa } from "./ajuda-vozes";

// O "Ouvir a aula" com a escolha da voz. Sem os modelos baixados (o caso do CI), a lista de vozes é trocada por uma
// voz falsa ("teste"), que baixa arquivos pequenos do próprio site e fala um zumbido: dá para testar o seletor, o
// progresso, a escolha guardada e os controles da leitura sem 90 MB de modelo. Com VOZES_REAL=1 e os modelos em
// public/vozes/ (npm run vozes:baixar -- --com-bloqueadas), o último teste usa a voz de verdade e mede o tempo.

const AULA = "/pt/trilhas/alfabetizacao-de-jovens-e-adultos/fazer-contas-do-dia-a-dia";
const raiz = path.resolve(__dirname, "..");

/** Guarda os endereços de fora do site que a página tentar abrir (não pode haver nenhum). */
function vigiarRede(page: Page) {
  const fora: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("data") && !u.protocol.startsWith("blob")) fora.push(r.url());
  });
  return fora;
}

async function abrirAula(page: Page) {
  await abrir(page, AULA);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Voz/ })).toBeVisible({ timeout: 120_000 });
}

test("sem a lista de vozes, só a voz do aparelho aparece, sem erro", async ({ page }) => {
  await page.route("**/vozes/vozes.json", (r) => r.fulfill({ status: 404, body: "" }));
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await abrirAula(page);
  await page.getByRole("button", { name: /^Voz/ }).click();
  const janela = page.getByRole("dialog", { name: "Escolha a voz" });
  await expect(janela).toBeVisible();
  await expect(janela).toContainText("Voz do aparelho · leve");
  await expect(janela).toContainText("ainda não estão disponíveis");
  await page.keyboard.press("Escape");
  await expect(janela).toBeHidden();
  expect(erros).toEqual([]);
});

test("escolher, baixar e ouvir com a voz natural (falsa), com os controles", async ({ page }) => {
  const fora = vigiarRede(page);
  await page.route("**/vozes/vozes.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listaFalsa()) }));
  await abrirAula(page);
  await page.getByRole("button", { name: /^Voz/ }).click();
  const janela = page.getByRole("dialog", { name: "Escolha a voz" });
  const voz = janela.locator('[data-voz="teste-f"]');
  await expect(voz).toContainText("Voz 1 · feminina");
  await expect(voz).toContainText(/Baixa [\d,]+ MB uma vez/);
  await voz.getByRole("button", { name: "Baixar e usar" }).click();
  await expect(voz.getByRole("button", { name: "Em uso" })).toBeVisible({ timeout: 30_000 });
  await expect(voz).toContainText("Já está neste aparelho");
  const guardada = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:voz") ?? "{}"));
  expect(guardada.voz).toBe("teste-f");
  // Teclado: Esc fecha a janela e o botão de escolher mostra a voz nova.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Voz\s*Voz 1/ })).toBeVisible();

  const falou = page.evaluate(() => new Promise<number>((ok) => document.addEventListener("lucia:voz-falou", (e) => ok((e as CustomEvent).detail.frase), { once: true })));
  await page.locator(".folha-da-aula").getByRole("button", { name: /Ouvir a aula/ }).click();
  const tocador = page.getByRole("region", { name: "Leitura em voz alta" });
  await expect(tocador).toContainText(/Frase 1 de \d+/, { timeout: 30_000 });
  expect(await falou).toBe(0);
  await page.screenshot({ path: test.info().outputPath("tocador.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: test.info().outputPath("tocador-escuro.png") });
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
  expect(await page.evaluate(() => (CSS as unknown as { highlights?: Map<string, unknown> }).highlights?.has("lucia-frase"))).toBe(true);

  await tocador.getByRole("button", { name: "Próxima frase" }).click();
  await expect(tocador).toContainText(/Frase 2 de/);
  await tocador.getByRole("button", { name: "Frase anterior" }).click();
  await expect(tocador).toContainText(/Frase 1 de/);
  await tocador.getByRole("button", { name: "Pausar" }).click();
  await expect(tocador.getByRole("button", { name: "Continuar" })).toBeVisible();
  await tocador.getByRole("button", { name: "Continuar" }).click();
  await tocador.getByLabel("Velocidade").selectOption("1.5");
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:voz") ?? "{}"))).velocidade).toBe(1.5);
  // A leitura anda sozinha de uma frase para a outra.
  await expect(tocador).toContainText(/Frase [2-9]\d* de/, { timeout: 30_000 });
  await tocador.getByRole("button", { name: "Parar a leitura" }).click();
  await expect(tocador).toBeHidden();
  expect(await page.evaluate(() => (CSS as unknown as { highlights?: Map<string, unknown> }).highlights?.has("lucia-frase"))).toBe(false);

  // O "apagar tudo" de Meus dados leva a voz baixada e a escolha.
  expect(await page.evaluate(async () => (await caches.keys()).includes("lucia-vozes"))).toBe(true);
  expect(fora).toEqual([]);
});

test("no modo leitor (Kindle), nada do Ouvir aparece", async ({ browser }) => {
  const contexto = await browser.newContext({ userAgent: "Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+" });
  const page = await contexto.newPage();
  await page.goto(AULA, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-leitor", "");
  await expect(page.getByRole("button", { name: /Ouvir a aula/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Voz/ })).toHaveCount(0);
  await contexto.close();
});

test("voz de verdade: baixa, começa a falar e mede o tempo", async ({ page }) => {
  test.skip(!process.env.VOZES_REAL || !fs.existsSync(path.join(raiz, "public/vozes/vozes.json")), "só com VOZES_REAL=1 e os modelos baixados");
  const id = process.env.VOZES_REAL === "1" ? "kokoro-f" : process.env.VOZES_REAL!;
  test.setTimeout(900_000);
  page.on("console", (m) => m.type() === "error" && console.log(`[console] ${m.text()}`));
  const fora = vigiarRede(page);
  await abrirAula(page);
  await page.getByRole("button", { name: /^Voz/ }).click();
  const voz = page.getByRole("dialog").locator(`[data-voz="${id}"]`);
  const t0 = Date.now();
  await voz.getByRole("button", { name: /Baixar e usar|Usar esta voz/ }).click();
  await expect(voz.getByRole("button", { name: "Em uso" })).toBeVisible({ timeout: 600_000 });
  const baixou = Date.now() - t0;
  await page.keyboard.press("Escape");
  const falou = page.evaluate(() => new Promise<number>((ok) => document.addEventListener("lucia:voz-falou", () => ok(performance.now()), { once: true })));
  const t1 = await page.evaluate(() => performance.now());
  await page.locator(".folha-da-aula").getByRole("button", { name: /Ouvir a aula/ }).click();
  const comecou = (await falou) - t1;
  console.log(`[vozes] ${id}: baixar e abrir ${(baixou / 1000).toFixed(1)} s; do clique em Ouvir até a primeira frase soar ${(comecou / 1000).toFixed(1)} s`);
  // Recarregada a página, a voz já está guardada: abre sem baixar de novo.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Voz/ })).toBeVisible({ timeout: 120_000 });
  const falou2 = page.evaluate(() => new Promise<number>((ok) => document.addEventListener("lucia:voz-falou", () => ok(performance.now()), { once: true })));
  const t2 = await page.evaluate(() => performance.now());
  await page.locator(".folha-da-aula").getByRole("button", { name: /Ouvir a aula/ }).click();
  console.log(`[vozes] ${id}: já guardada, do clique até a primeira frase ${(((await falou2) - t2) / 1000).toFixed(1)} s`);
  // Pausas entre as frases: do fim do som de uma até o começo da seguinte, nas 5 primeiras.
  const pausas = await page.evaluate(() => new Promise<number[]>((ok) => {
    const marcas: { t: number; d: number }[] = [];
    document.addEventListener("lucia:voz-falou", (e) => {
      marcas.push({ t: performance.now() / 1000, d: (e as CustomEvent).detail.duracao });
      if (marcas.length === 5) ok(marcas.slice(1).map((m, i) => m.t - marcas[i].t - marcas[i].d));
    });
  }));
  console.log(`[vozes] ${id}: pausas entre frases ${pausas.map((p) => p.toFixed(1)).join(" / ")} s`);
  expect(fora).toEqual([]);
});

type ComFaladas = { faladas: string[] };

test("trocar de aula no meio da leitura não mistura as frases das duas aulas", async ({ page }) => {
  await page.route("**/vozes/vozes.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listaFalsa()) }));
  await page.addInitScript(() => localStorage.setItem("lucia:voz", JSON.stringify({ voz: "teste-f", velocidade: 1, numero: 1, modo: "direto" })));
  await abrirAula(page);
  // Guarda, na página, tudo o que soar (a navegação no próprio site não recarrega a página, e o registro continua).
  await page.evaluate(() => {
    (window as unknown as ComFaladas).faladas = [];
    document.addEventListener("lucia:voz-falou", (e) => (window as unknown as ComFaladas).faladas.push((e as CustomEvent).detail.texto));
  });
  const quantas = () => page.evaluate(() => (window as unknown as ComFaladas).faladas.length);
  await page.locator(".folha-da-aula").getByRole("button", { name: /Ouvir a aula/ }).click();
  await expect.poll(quantas, { timeout: 30_000 }).toBeGreaterThan(1);
  const titulo = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";

  // Vai para a próxima aula pelo link do próprio site (navegação do Next, sem recarregar a página).
  await page.locator("nav[data-vizinhas] a").last().click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(titulo, { timeout: 60_000 });
  await expect(page.getByRole("region", { name: "Leitura em voz alta" })).toBeHidden();
  await page.evaluate(() => ((window as unknown as ComFaladas).faladas = []));
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => (window as unknown as ComFaladas).faladas)).toEqual([]);

  // Ouve a nova: tudo o que soa está no texto da aula nova.
  await page.locator(".folha-da-aula").getByRole("button", { name: /Ouvir a aula/ }).click();
  await expect.poll(quantas, { timeout: 30_000 }).toBeGreaterThan(3);
  const faladas = await page.evaluate(() => (window as unknown as ComFaladas).faladas);
  const textoNovo = (await page.locator(".folha-da-aula").innerText()).replace(/\s+/g, " ");
  for (const frase of faladas) expect(textoNovo).toContain(frase.slice(0, 40));
});
