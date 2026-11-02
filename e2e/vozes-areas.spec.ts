// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { abrir } from "./ajuda";
import { listaFalsa } from "./ajuda-vozes";

// O "Ouvir a aula" (seletor de voz e leitura por frase) em uma aula escrita de cada área. Lento (uma página por área):
// rode à parte, contra um servidor já montado (npm run build && npx next start):
//   AREAS=1 BASE_URL=http://localhost:3207 npx playwright test e2e/vozes-areas.spec.ts --project=computador

const raiz = path.resolve(__dirname, "..");
const trilhas = path.join(raiz, "content/trilhas");

function umaAulaPorArea(): { area: string; url: string }[] {
  const vistas = new Map<string, string>();
  for (const trilha of fs.readdirSync(trilhas).sort()) {
    const meta = path.join(trilhas, trilha, "_trilha.md");
    if (!fs.existsSync(meta)) continue;
    const area = fs.readFileSync(meta, "utf8").match(/^area:\s*"?([\w-]+)/m)?.[1];
    if (!area || vistas.has(area)) continue;
    const aula = fs.readdirSync(path.join(trilhas, trilha)).filter((n) => n.endsWith(".md") && !n.startsWith("_") && !/\.(en|es|fr|ru|zh)\.md$/.test(n)).sort()[0];
    if (aula) vistas.set(area, `/pt/trilhas/${trilha}/${aula.replace(/\.md$/, "")}`);
  }
  return [...vistas].map(([area, url]) => ({ area, url }));
}

test("Ouvir a aula em uma aula de cada área", async ({ page }) => {
  test.skip(!process.env.AREAS, "lento: só com AREAS=1");
  const aulas = umaAulaPorArea();
  test.setTimeout(aulas.length * 60_000);
  const falhas: string[] = [];
  let primeira = true;
  await page.route("**/vozes/vozes.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listaFalsa()) }));
  await page.addInitScript(() => localStorage.setItem("lucia:voz", JSON.stringify({ voz: "teste-f", velocidade: 1, numero: 1 })));
  for (const { area, url } of aulas) {
    try {
      if (primeira) await abrir(page, url);
      else await page.goto(url, { waitUntil: "domcontentloaded" });
      primeira = false;
      const folha = page.locator(".folha-da-aula");
      await expect(folha.getByRole("button", { name: /^Voz/ })).toBeVisible({ timeout: 20_000 });
      // Lê com a voz falsa (e2e/vozes.spec.ts): o leitor monta as frases e o tocador aparece.
      await folha.getByRole("button", { name: /Ouvir a aula/ }).click();
      const tocador = page.getByRole("region", { name: "Leitura em voz alta" });
      await expect(tocador).toContainText(/Frase \d+ de \d+/, { timeout: 20_000 });
      const total = Number((await tocador.textContent())?.match(/de (\d+)/)?.[1] ?? 0);
      if (total < 3) falhas.push(`${area}: ${url} com só ${total} frase(s)`);
      await tocador.getByRole("button", { name: "Parar a leitura" }).click();
    } catch (erro) {
      falhas.push(`${area}: ${url} → ${(erro as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`[areas] ${aulas.length} áreas conferidas, ${falhas.length} com problema`);
  expect(falhas).toEqual([]);
});
