// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test } from "@playwright/test";
import { abrir, vigiarErros } from "./ajuda";

// Presença somada da Escola (components/escola/PresencaSomada.tsx, E4-02). Quem monta o componente é a entrada da Escola
// (E4-08) e o quadro de avisos (E4-09); estas páginas são onde ele aparece.
//
//   NEXT_PUBLIC_RECURSOS=escola npm run dev:local   e depois   BASE_URL=http://localhost:3000 npx playwright test e2e/escola-presenca
//
// 1. Com o serviço fora do ar (o pedido escola_presenca_hoje falha), nada aparece e não há erro no console.
// 2. Com números, as frases aparecem sem nomes e sem ranking (pulado enquanto nenhuma página monta o componente).
const PAGINAS = ["/pt/escola", "/pt"];

for (const caminho of PAGINAS) {
  test(`presença somada com o serviço fora: ${caminho}`, async ({ page }) => {
    const erros = vigiarErros(page);
    await page.route("**/rest/v1/rpc/escola_presenca_hoje", (rota) => rota.abort("failed"));
    await abrir(page, caminho);
    await page.waitForTimeout(500);
    await expect(page.locator("[data-presenca-somada] li")).toHaveCount(0);
    expect(erros).toEqual([]);
  });
}

test("presença somada com números: frases sem pessoa, números no formato do idioma", async ({ page }) => {
  const erros = vigiarErros(page);
  await page.route("**/rest/v1/rpc/escola_presenca_hoje", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ aulas_hoje: 1234, aulas_terminadas_7d: 1, matriculas_mes: 0 }) }),
  );
  await abrir(page, "/pt/escola");
  const bloco = page.locator("[data-presenca-somada]").first();
  test.skip((await bloco.count()) === 0, "nenhuma página monta a presença somada ainda (E4-08/E4-09)");
  await expect(bloco.locator("li")).toHaveCount(2);
  await expect(bloco).toContainText("Hoje, 1.234 aulas foram abertas na Escola");
  await expect(bloco).toContainText("Nos últimos 7 dias, 1 aula foi terminada");
  await expect(bloco).not.toContainText("matrícula");
  expect(erros).toEqual([]);
});
