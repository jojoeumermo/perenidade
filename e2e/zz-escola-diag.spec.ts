// TEMPORÁRIO (PR #65): por que /pt/escola/assembleia não mostra o h1 no CI? Só registra; sai do ramo ao final.
import { test } from "@playwright/test";
import { abrir } from "./ajuda";

test("diag escola: assembleia e ouvidoria", async ({ page }) => {
  const consola: string[] = [];
  const falhas: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consola.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consola.push("PAGEERROR " + String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400) falhas.push(`${r.status()} ${r.url().slice(0, 120)}`); });
  for (const rota of ["/pt/escola", "/pt/escola/assembleia", "/pt/escola/ouvidoria", "/pt/escola/turmas"]) {
    const t0 = Date.now();
    const r = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(5000);
    const h1 = await page.locator("h1").allTextContents();
    const corpo = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 220);
    console.log("DIAG", rota, "status", r?.status(), "ms", Date.now() - t0, "url", page.url(), "h1", JSON.stringify(h1), "corpo", JSON.stringify(corpo));
  }
  console.log("DIAG consola", JSON.stringify(consola.slice(0, 8)));
  console.log("DIAG http>=400", JSON.stringify(falhas.slice(0, 10)));
});
