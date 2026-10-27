// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test } from "@playwright/test";

// O teste visual simples: a captura das páginas principais, nos temas claro e escuro, comparada com a última aprovada
// (e2e/visual.spec.ts-snapshots). Pega layout quebrado antes de publicar. Só roda com VISUAL=1, porque as capturas
// mudam a cada redesenho; depois de uma mudança de propósito, aprove as novas com:
//   VISUAL=1 npx playwright test e2e/visual --update-snapshots
test.skip(!process.env.VISUAL, "o teste visual só roda com VISUAL=1");

const paginas = ["/pt", "/pt/trilhas", "/pt/trilhas/historia-antiga/pre-historia-os-primeiros-seres-humanos", "/pt/comunidade", "/pt/territorios/na-atividade"];

for (const tema of ["light", "dark"] as const) {
  for (const caminho of paginas) {
    test(`${caminho} no tema ${tema === "light" ? "claro" : "escuro"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
      await page.goto(caminho);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot({
        fullPage: false,
        // O que muda sozinho (datas, notícias do dia, contadores) fica de fora da comparação.
        mask: [page.locator("time, [data-dinamico], .letreiro")],
      });
    });
  }
}
