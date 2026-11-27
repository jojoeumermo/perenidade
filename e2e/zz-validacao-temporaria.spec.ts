// TEMPORÁRIO (PR #65): validação do mini-tocador e do cartaz (lambe) no fim da rolagem, sem o selo do modo de desenvolvimento.
import { expect, test } from "@playwright/test";

const semSelo = async (page: import("@playwright/test").Page) => {
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-dev-tools-button], #__next-build-watcher { display: none !important; }" });
};

test("mini-tocador: título legível e controles com toque, no app", async ({ page }, info) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { return original.call(this); };
  });
  await page.goto("/pt/podcasts");
  const slug = (await page.locator('a[href*="/podcasts/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""))).find((h) => /\/podcasts\/[a-z0-9-]{3,}$/.test(h) && !/microfone|revisao|convidado/.test(h));
  await page.goto(`/pt/app/eu/podcasts`);
  await page.goto(slug as string);
  await page.locator("button[aria-pressed]").first().click();
  const tocador = page.locator(".radio-player").first();
  await expect(tocador).toBeVisible();
  await page.waitForTimeout(3000);
  await semSelo(page);
  const medidas = await page.evaluate(() => {
    const r = document.querySelector(".radio-player") as HTMLElement;
    const q = (s: string) => Array.from(r.querySelectorAll(s)).map((e) => { const b = (e as HTMLElement).getBoundingClientRect(); return { rotulo: (e as HTMLElement).getAttribute("aria-label")?.slice(0, 30) ?? e.textContent?.slice(0, 20), w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) }; });
    const caixa = r.getBoundingClientRect();
    const aba = document.querySelector("nav.shell-abas")?.getBoundingClientRect();
    return { viewport: [innerWidth, innerHeight], tocador: [Math.round(caixa.x), Math.round(caixa.y), Math.round(caixa.width), Math.round(caixa.height)], abaTopo: aba ? Math.round(aba.y) : null, titulo: q("p a"), botoes: q("button"), estouroX: document.documentElement.scrollWidth > innerWidth };
  });
  console.log("MINI", JSON.stringify(medidas));
  await page.screenshot({ path: `test-results/zz/${info.project.name}-mini.png` });
  expect(medidas.titulo[0].w, "título com largura legível").toBeGreaterThan(120);
  for (const b of medidas.botoes.filter((x) => x.w > 0)) expect(b.w, `botão ${b.rotulo}`).toBeGreaterThanOrEqual(40);
  expect(medidas.estouroX).toBe(false);
});

test("lambe: fim da rolagem, sem selo de desenvolvimento, texto do rodapé fora da barra", async ({ page }, info) => {
  for (const rota of ["/pt/app", "/pt"]) {
    await page.goto(rota);
    await page.waitForTimeout(1500);
    await semSelo(page);
    const lambe = page.locator(".lambe-papel").first();
    await lambe.scrollIntoViewIfNeeded();
    // 1) rola até o fim da página; 2) mede o rodapé do cartaz contra a barra de abas
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const p = document.querySelector(".lambe-papel") as HTMLElement;
      const b = p.getBoundingClientRect();
      const pe = Array.from(p.querySelectorAll("p, span")).filter((e) => /instituto/i.test(e.textContent ?? "")).pop() as HTMLElement | undefined;
      const rodape = pe?.getBoundingClientRect();
      const aba = document.querySelector("nav.shell-abas")?.getBoundingClientRect();
      return { cartaz: [Math.round(b.top), Math.round(b.bottom)], rodape: rodape ? [Math.round(rodape.top), Math.round(rodape.bottom)] : null, abaTopo: aba ? Math.round(aba.top) : null, altura: innerHeight, fimDaPagina: Math.round(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 };
    });
    console.log("LAMBEFIM", rota, JSON.stringify(m));
    await page.screenshot({ path: `test-results/zz/${info.project.name}-lambefim-${rota.replace(/\W+/g, "_")}.png` });
    // rola o cartaz inteiro para o meio da tela e fotografa só o cartaz com o texto do rodapé
    await lambe.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `test-results/zz/${info.project.name}-lambecentro-${rota.replace(/\W+/g, "_")}.png` });
    if (m.abaTopo && m.rodape) expect(m.rodape[1], `rodapé do cartaz acima da barra em ${rota}`).toBeLessThanOrEqual(m.abaTopo);
  }
});
