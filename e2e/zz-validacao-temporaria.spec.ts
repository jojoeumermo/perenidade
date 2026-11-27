// TEMPORÁRIO (PR #65): validação funcional do podcast com episódios semeados e amostra dos lambes. Sai do ramo ao final.
import { expect, test } from "@playwright/test";

test("podcast: episódio semeado toca de fato (currentTime avança) no site e no app", async ({ page }, info) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.addInitScript(() => {
    const w = window as unknown as { __midias: HTMLMediaElement[] };
    w.__midias = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__midias.push(this);
      return original.call(this);
    };
  });
  const rotas = ["/pt/podcasts", "/pt/app/eu/podcasts"];
  for (const rota of rotas) {
    const r = await page.goto(rota);
    console.log("ROTA", rota, "status", r?.status(), "url", page.url());
    await page.screenshot({ path: `test-results/zz/${info.project.name}-${rota.replace(/\W+/g, "_")}.png`, fullPage: false });
    const links = await page.locator('a[href*="/podcasts/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")));
    console.log("LINKS", rota, JSON.stringify(links.slice(0, 6)));
  }
  await page.goto("/pt/podcasts");
  const botoes = page.getByRole("button", { name: /Ouvir|Tocar|Escutar|Play/i });
  console.log("BOTOES de ouvir", await botoes.count());
  const slugs = (await page.locator('a[href*="/podcasts/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""))).filter((h) => /\/podcasts\/[a-z0-9-]{3,}$/.test(h) && !/microfone|revisao|convidado/.test(h));
  console.log("EPISODIOS", JSON.stringify([...new Set(slugs)]));
  expect(slugs.length, "episódios semeados aparecem na lista").toBeGreaterThan(0);
  await page.goto([...new Set(slugs)][0]);
  const ouvir = page.getByRole("button", { name: /:/ }).filter({ has: page.locator("svg") }).first();
  await ouvir.click();
  await page.waitForTimeout(4000);
  const estado = await page.evaluate(() => {
    const w = window as unknown as { __midias: HTMLMediaElement[] };
    return w.__midias.map((m) => ({ src: m.currentSrc.slice(-40), t: m.currentTime, pausado: m.paused, dur: m.duration, estado: m.readyState, erro: m.error?.code ?? null }));
  });
  console.log("MIDIAS", JSON.stringify(estado));
  await page.screenshot({ path: `test-results/zz/${info.project.name}-tocando.png` });
  expect(estado.length, "o tocador chamou play() numa mídia").toBeGreaterThan(0);
  expect(estado[0].erro).toBeNull();
  expect(estado[0].t, "currentTime avançou").toBeGreaterThan(0.5);
  expect(erros).toEqual([]);
});

test("lambe do dia: amostra em 3 datas, no site e no app", async ({ page }, info) => {
  for (const [rotulo, data] of [["a", "2026-11-05T12:00:00-03:00"], ["b", "2026-11-18T12:00:00-03:00"], ["c", "2026-12-01T12:00:00-03:00"]] as const) {
    await page.clock.install({ time: new Date(data) });
    for (const rota of ["/pt", "/pt/app"]) {
      await page.goto(rota);
      const lambe = page.locator(".lambe-papel").first();
      const ok = await lambe.count();
      console.log("LAMBE", rotulo, rota, "presente", ok, "url", page.url());
      if (ok) await lambe.screenshot({ path: `test-results/zz/${info.project.name}-lambe-${rotulo}-${rota.replace(/\W+/g, "_")}.png` });
    }
  }
});
