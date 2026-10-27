// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { defineConfig, devices } from "@playwright/test";

// Os testes de ponta a ponta dos fluxos que não podem quebrar (e2e/). Rodam contra o site com o banco de teste local
// (npm run dev:local), nunca contra produção. Usam o Chrome já instalado na máquina: nada de baixar navegador.
//
//   npx playwright test                         → sobe o dev:local sozinho (porta 3100) e roda tudo
//   BASE_URL=http://localhost:3951 npx playwright test   → usa um servidor que já está rodando
//   VISUAL=1 npx playwright test e2e/visual     → também compara as capturas das páginas principais
const base = process.env.BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 60_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: base,
    channel: "chrome",
    locale: "pt-BR",
    navigationTimeout: 180_000,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "celular", use: { ...devices["Pixel 7"], channel: "chrome" }, testIgnore: /visual/ },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run dev:local", url: `${base}/pt`, timeout: 600_000, reuseExistingServer: true },
});
