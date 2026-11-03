// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";
import { abrir } from "./ajuda";

// A aula por dentro (Etapa 4, pacote E4-03; docs/escola/aula.md), no computador e no celular. Tudo fica atrás do
// recurso "escola": monte com NEXT_PUBLIC_RECURSOS=escola (ou "todos") para estes testes rodarem; com ele desligado,
// cada teste confere só que a aula ficou como era e sai.
//
// Aulas usadas: uma longa, que vira 3 partes (pré-modernismo, do curso ENEM), e uma de alfabetização (ler e escrever).
const LONGA = "/pt/trilhas/enem-linguagens-literatura/pre-modernismo";
const ALFABETIZACAO = "/pt/trilhas/ler-e-escrever/as-vogais";

async function ligado(page: Page) {
  return (await page.locator(".passo-seguinte").count()) > 0;
}

test.describe("aula por dentro", () => {
  test("fim da aula com o botão grande e a barra fixa depois de 85%", async ({ page }) => {
    await abrir(page, LONGA);
    if (!(await ligado(page))) {
      await expect(page.locator(".proximo-passo, .fatias-indice")).toHaveCount(0);
      test.skip(true, "recurso escola desligado nesta montagem");
    }
    const grande = page.locator(".passo-seguinte-grande");
    await expect(grande).toContainText(/Próxima aula:|Fazer a prova da trilha|Escolher a próxima trilha/);
    const caixa = await grande.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(56);
    // A barra compacta só aparece depois de 85% do texto e some ao voltar para cima.
    await expect(page.locator(".proximo-passo")).toHaveCount(0);
    const blocos = page.locator("#texto-da-aula [data-p]");
    const n = await blocos.count();
    await blocos.nth(Math.floor(n * 0.9)).scrollIntoViewIfNeeded();
    const temProxima = (await page.locator(".passo-seguinte-grande", { hasText: "Próxima aula" }).count()) > 0;
    if (temProxima) await expect(page.locator(".proximo-passo")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".proximo-passo")).toHaveCount(0);
    // Revisar esta aula grava a aula na sessão (nada vai na URL).
    await page.locator(".passo-seguinte-revisar").click();
    await expect(page).toHaveURL(/\/meu-estudo\/praticar$/);
    const guardada = await page.evaluate(() => sessionStorage.getItem("lucia:praticar-aula"));
    expect(JSON.parse(guardada ?? "{}").aula).toContain("pre-modernismo");
  });

  test("partes, Parar aqui e o aviso de retomar depois de recarregar", async ({ page }) => {
    await abrir(page, LONGA);
    test.skip(!(await ligado(page)), "recurso escola desligado nesta montagem");
    const indice = page.locator(".fatias-indice");
    await expect(indice).toBeVisible();
    await expect(page.locator(".fatia-marca-texto").first()).toContainText(/Parte 1 de \d · \d+ min/);
    expect(await page.locator("#texto-da-aula [data-parte='1']").count()).toBeGreaterThan(0);
    await page.locator(".fatia-parar").first().click();
    await expect(page.locator(".fatia-guardado")).toBeVisible();
    // Sem pular sozinho: ao recarregar, a aula abre no topo e só oferece voltar.
    await page.reload();
    await page.waitForLoadState("networkidle");
    const aviso = page.locator(".retomar-ir");
    await expect(aviso).toContainText(/Voltar para onde parou \(parte 2, parágrafo \d+\)/);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(400);
    await aviso.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
    // Uma parte por vez: só a atual fica na tela, com "Continuar".
    await page.locator(".fatias-modo").click();
    await page.locator(".fatias-indice li a").first().click();
    await expect(page.locator("#texto-da-aula [data-parte='1']").first()).toBeHidden();
    await page.locator(".fatia-continuar").first().click();
    await expect(page.locator("#texto-da-aula [data-parte='1']").first()).toBeVisible();
    await page.evaluate(() => localStorage.removeItem("lucia:aula-em-partes"));
  });

  test("A+ muda o tamanho da letra e grava o mesmo da acessibilidade", async ({ page, isMobile }) => {
    await abrir(page, LONGA);
    test.skip(!(await ligado(page)), "recurso escola desligado nesta montagem");
    if (isMobile) await page.getByRole("button", { name: "Sumário e ferramentas" }).first().click();
    const maior = page.getByRole("button", { name: "Letra maior" }).first();
    await maior.click();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe("115%");
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:a11y") ?? "{}"));
    expect(prefs.scale).toBe(115);
    await page.getByRole("button", { name: "Letra normal" }).first().click();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe("");
  });

  test("selecionar uma palavra abre O que é? e uma frase gera o cartão", async ({ page }) => {
    await page.route("**/api/dicionario**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ palavra: "x", sentidos: [{ classe: "substantivo", definicoes: [{ texto: "definição de teste" }] }], fonte: "Wikcionário", link: "https://pt.wiktionary.org/wiki/x", licenca: "CC BY-SA 4.0" }) }));
    await abrir(page, LONGA);
    test.skip(!(await ligado(page)), "recurso escola desligado nesta montagem");
    const paragrafo = page.locator("#texto-da-aula p[data-p]").first();
    // Seleciona a primeira palavra do parágrafo.
    await paragrafo.evaluate((p) => {
      const texto = [...p.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && /\p{L}{4,}/u.test(n.textContent ?? ""))!;
      const m = /\p{L}{4,}/u.exec(texto.textContent ?? "")!;
      const r = document.createRange();
      r.setStart(texto, m.index);
      r.setEnd(texto, m.index + m[0].length);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(r);
    });
    await page.getByRole("button", { name: "O que é?" }).click();
    const folha = page.locator(".folha-da-palavra");
    await expect(folha).toContainText("definição de teste");
    await expect(folha).toContainText("Consulta feita pelo servidor do Instituto a um dicionário aberto.");
    await expect(folha).toContainText("CC BY-SA 4.0");
    await page.keyboard.press("Escape");
    // Uma frase inteira: compartilhar trecho, cartão feito no aparelho, PNG 1080×1080 abaixo de 80 KB.
    await paragrafo.evaluate((p) => {
      const r = document.createRange();
      r.selectNodeContents(p);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(r);
    });
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(r.url()));
    await page.getByRole("button", { name: "Compartilhar trecho" }).click();
    const imagem = page.locator(".cartao-do-trecho img");
    await expect(imagem).toBeVisible();
    const medida = await imagem.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight, bytes: Number(img.dataset.cartaoBytes) }));
    expect(medida.w).toBe(1080);
    expect(medida.h).toBe(1080);
    expect(medida.bytes).toBeLessThan(80 * 1024);
    expect(pedidos.filter((u) => u.includes("/api/"))).toEqual([]);
  });

  test("modo uma mão no celular", async ({ page, isMobile }) => {
    test.skip(!isMobile, "só no celular");
    await abrir(page, LONGA);
    test.skip(!(await ligado(page)), "recurso escola desligado nesta montagem");
    await page.getByRole("button", { name: "Sumário e ferramentas" }).first().click();
    await page.getByRole("button", { name: /Modo uma mão/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-uma-mao", "");
    await page.keyboard.press("Escape");
    await expect(page.locator(".faixa-uma-mao")).toBeVisible();
    await expect(page.locator(".barra-do-celular .barra-acoes")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("lucia:uma-mao"))).toBe("1");
    await page.evaluate(() => localStorage.removeItem("lucia:uma-mao"));
  });

  test("botões de ouvir numa aula de ler e escrever", async ({ page }) => {
    await abrir(page, ALFABETIZACAO);
    test.skip(!(await ligado(page)), "recurso escola desligado nesta montagem");
    const botoes = page.locator("#texto-da-aula .ouvir-paragrafo-botao");
    expect(await botoes.count()).toBe(await page.locator("#texto-da-aula p[data-p]").count());
    await expect(botoes.first()).toHaveAccessibleName("Ouvir este parágrafo");
    await expect(page.locator("nav[data-vizinhas] a svg").first()).toBeAttached();
  });

  test("sem rolagem lateral em 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await abrir(page, LONGA);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(360);
  });

  test("leitor de tinta: sem animação e sem nada flutuando", async ({ browser }) => {
    const contexto = await browser.newContext({ userAgent: "Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+" });
    const page = await contexto.newPage();
    await abrir(page, LONGA);
    await expect(page.locator("html")).toHaveAttribute("data-leitor", "");
    const blocos = page.locator("#texto-da-aula [data-p]");
    await blocos.nth(Math.floor((await blocos.count()) * 0.9)).scrollIntoViewIfNeeded();
    await expect(page.locator(".proximo-passo")).toBeHidden();
    const animadas = await page.evaluate(() => [...document.querySelectorAll(".proximo-passo, .folha-da-palavra, .fatias-indice")].filter((el) => getComputedStyle(el).animationName !== "none").length);
    expect(animadas).toBe(0);
    await contexto.close();
  });
});
