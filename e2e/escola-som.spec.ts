// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { abrir } from "./ajuda";

// Som do campus (Etapa 4, pacote E4-06; docs/escola/som.md): a rádio que continua entre páginas e depois de recarregar,
// o som para estudar, o cordel da aula e o Hoje no campus, no computador e no celular. Tudo o que é novo fica atrás do
// recurso "escola": monte com NEXT_PUBLIC_RECURSOS=todos,escola para estes testes rodarem; desligado, cada teste confere
// que a página ficou como era e sai.
//
// Nenhuma emissora de verdade é chamada: o endereço da primeira emissora que toca aqui é interceptado e responde com
// um minuto de silêncio em WAV, gerado no próprio teste.

const raiz = path.resolve(__dirname, "..");
const emissoras = JSON.parse(fs.readFileSync(path.join(raiz, "content", "radios.json"), "utf8")) as { id: string; nome: string; transmissao?: string }[];
const emissora = emissoras.find((e) => e.transmissao)!;
const CORDEL = "/pt/trilhas/o-que-e-o-capitalismo/o-que-e-o-capitalismo/cordel";

/** Um minuto de silêncio (WAV, 8 kHz, 8 bits, mono). */
function silencio(segundos = 60): Buffer {
  const taxa = 8000;
  const dados = taxa * segundos;
  const b = Buffer.alloc(44 + dados, 128);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + dados, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(taxa, 24);
  b.writeUInt32LE(taxa, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(dados, 40);
  return b;
}

async function emissoraFalsa(page: Page) {
  const som = silencio();
  await page.route(emissora.transmissao!, (rota) => rota.fulfill({ status: 200, contentType: "audio/wav", body: som }));
}

async function escolaLigada(page: Page) {
  return (await page.locator("[data-hoje-no-campus]").count()) > 0;
}

/** Navega pelo próprio site, sem recarregar (o roteador do Next, como um clique num link). */
async function irSemRecarregar(page: Page, caminho: string) {
  await page.evaluate((destino) => {
    const roteador = (window as unknown as { next?: { router?: { push: (h: string) => void } } }).next?.router;
    if (roteador) roteador.push(destino);
    else {
      const link = document.createElement("a");
      link.href = destino;
      document.body.appendChild(link);
      link.click();
    }
  }, caminho);
  await page.waitForURL(`**${caminho}`);
}

const tocando = (page: Page) => page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => a.getAttribute("src") && !a.paused));

test.describe("som do campus", () => {
  test("a rádio continua entre páginas e, depois de recarregar, mostra Continuar", async ({ page }) => {
    await emissoraFalsa(page);
    await abrir(page, "/pt/radio");
    if (!(await escolaLigada(page))) {
      await expect(page.locator("[data-som-de-estudo]")).toHaveCount(0);
      test.skip(true, "recurso escola desligado nesta montagem");
    }
    await page.getByRole("button", { name: new RegExp(`: ${emissora.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click();
    await expect.poll(() => tocando(page)).toBe(true);
    // Três páginas pelo próprio site: o tocador mora no layout e o som segue.
    for (const caminho of ["/pt/trilhas", "/pt/acervo", "/pt/glossario"]) {
      await irSemRecarregar(page, caminho);
      await expect(page.locator(".radio-player")).toBeVisible();
      await expect.poll(() => tocando(page)).toBe(true);
    }
    // Ficou gravado só o que é público.
    const gravado = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:radio-retomar") ?? "null"));
    expect(gravado?.canal).toBeTruthy();
    expect(gravado?.url).toBe(emissora.transmissao);
    // Recarregar: nada toca sozinho; aparece o aviso recolhido "Continuar".
    await page.reload();
    const aviso = page.locator("[data-radio-retomar]");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("Continuar:");
    await expect(aviso).toContainText(emissora.nome);
    expect(await tocando(page)).toBe(false);
    // Um toque retoma.
    await aviso.getByRole("button", { name: /^Continuar:/ }).click();
    await expect.poll(() => tocando(page)).toBe(true);
    await expect(aviso).toHaveCount(0);
    // Fechar (✕) e recarregar: o aviso não volta.
    await page.locator(".radio-player").getByRole("button", { name: /Fechar|Close/i }).first().click();
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-radio-retomar]")).toHaveCount(0);
  });

  test("o x do Continuar descarta a gravação", async ({ page }) => {
    await abrir(page, "/pt/radio");
    test.skip(!(await escolaLigada(page)), "recurso escola desligado nesta montagem");
    await page.evaluate((url) => localStorage.setItem("lucia:radio-retomar", JSON.stringify({ canal: "emissora-teste", faixa: "emissora-teste", posicao: 0, titulo: "Rádio de Teste", artista: "", url, aoVivo: true, em: Date.now() - 60_000 })), emissora.transmissao);
    await page.reload();
    const aviso = page.locator("[data-radio-retomar]");
    await expect(aviso).toContainText("Rádio de Teste");
    await aviso.getByRole("button", { name: /Descartar/ }).click();
    await expect(aviso).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("lucia:radio-retomar"))).toBeNull();
    // Gravação de mais de 24 h não aparece.
    await page.evaluate((url) => localStorage.setItem("lucia:radio-retomar", JSON.stringify({ canal: "x", faixa: "x", posicao: 0, titulo: "Velha", artista: "", url, aoVivo: true, em: Date.now() - 25 * 3600_000 })), emissora.transmissao);
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-radio-retomar]")).toHaveCount(0);
  });

  test("o som para estudar liga, aparece no tocador e desliga", async ({ page }) => {
    await abrir(page, "/pt/radio");
    test.skip(!(await escolaLigada(page)), "recurso escola desligado nesta montagem");
    const canal = page.locator("[data-som-de-estudo]");
    await expect(canal).toContainText("Para estudar (sem fala)");
    await expect(canal).toContainText("Sons feitos no seu aparelho. Músicas livres entram quando a curadoria conferir a licença.");
    // Nada tocando ao abrir.
    await expect(canal).toHaveAttribute("data-som-de-estudo", "");
    await canal.locator("[data-som='chuva']").click();
    await expect(canal).toHaveAttribute("data-som-de-estudo", "chuva");
    await expect(canal.locator("[data-som='chuva']")).toHaveAttribute("aria-pressed", "true");
    const barra = page.locator("[data-radio-estudo]");
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("Chuva");
    // A voz da aula começa: o som baixa para 30%.
    await page.evaluate(() => document.dispatchEvent(new CustomEvent("lucia:voz-falou", { detail: { duracao: 1, texto: "teste" } })));
    await expect(barra).toContainText("30%");
    // Segue em outra página e desliga pelo tocador.
    await irSemRecarregar(page, "/pt/trilhas");
    await expect(barra).toBeVisible();
    await barra.getByRole("button", { name: /Parar o som para estudar/ }).click();
    await expect(page.locator("[data-radio-estudo]")).toHaveCount(0);
  });

  test("o cordel da aula abre com a faixa de rascunho", async ({ page }) => {
    const resposta = await page.goto(CORDEL);
    if (resposta?.status() === 404) {
      test.skip(true, "recurso escola desligado nesta montagem");
    }
    await expect(page.locator("[data-cordel-rascunho]")).toContainText("Rascunho em revisão: confira na aula");
    await expect(page.locator("[data-cordel-rascunho] a")).toHaveAttribute("href", "/pt/trilhas/o-que-e-o-capitalismo/o-que-e-o-capitalismo");
    await expect(page.locator("#cordel-titulo")).toContainText("cordel");
    expect(await page.locator(".cordel-estrofe").count()).toBeGreaterThan(3);
    for (const estrofe of await page.locator(".cordel-estrofe").all()) expect(await estrofe.locator(".cordel-verso").count()).toBe(6);
    await expect(page.locator(".folheto-capa")).toContainText("rascunho, em revisão");
    await expect(page.getByRole("button", { name: "Ouvir" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Imprimir o folheto/ })).toBeVisible();
    // A aula leva ao cordel.
    await abrir(page, "/pt/trilhas/o-que-e-o-capitalismo/o-que-e-o-capitalismo");
    await expect(page.locator(`a[href="${CORDEL}"]`)).toBeVisible();
    // Nos outros idiomas, o folheto em português.
    await page.goto(CORDEL.replace("/pt/", "/en/"));
    await expect(page).toHaveURL(new RegExp(`${CORDEL}$`));
  });

  test("a rádio mostra o Hoje no campus", async ({ page }) => {
    await abrir(page, "/pt/radio");
    test.skip(!(await escolaLigada(page)), "recurso escola desligado nesta montagem");
    const hoje = page.locator("[data-hoje-no-campus]");
    await expect(hoje.getByRole("heading", { name: "Hoje no campus" })).toBeVisible();
    const texto = hoje.locator("#hoje-no-campus-texto");
    await expect(texto).toContainText("Hoje no campus, da Escola Lúcia Maria");
    await expect(texto).toContainText("Por hoje é isso.");
    // Todo fato do roteiro diz a fonte.
    for (const fato of await texto.locator(".hoje-fato").all()) await expect(fato).toContainText("Segundo a Wikipédia");
    const palavras = (await texto.innerText()).split(/\s+/).filter(Boolean).length;
    expect(palavras).toBeLessThanOrEqual(300);
    await expect(hoje.getByRole("button", { name: "Ouvir" })).toBeVisible();
  });

  test("360 px sem rolagem lateral na rádio e no cordel", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await abrir(page, "/pt/radio");
    test.skip(!(await escolaLigada(page)), "recurso escola desligado nesta montagem");
    const largura = () => page.evaluate(() => document.documentElement.scrollWidth);
    expect(await largura()).toBeLessThanOrEqual(360);
    await page.locator("[data-som='rosa']").click();
    await expect(page.locator("[data-radio-estudo]")).toBeVisible();
    expect(await largura()).toBeLessThanOrEqual(360);
    await page.locator("[data-som='rosa']").click();
    await abrir(page, CORDEL);
    expect(await largura()).toBeLessThanOrEqual(360);
  });
});
