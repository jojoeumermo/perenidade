// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test } from "@playwright/test";
import { abrir, entrarComo, rpc } from "./ajuda";

// A aula em vídeo de ponta a ponta, pelo gravador do painel: quem ensina liga a câmera, grava alguns segundos, para,
// confere a prévia, preenche título e fonte e envia para a revisão; a aula aparece em "Minhas". Câmera e microfone são
// os de teste do Chrome. Para repetir: npx playwright test e2e/videoaula --repeat-each=5
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera", "microphone"],
});

test("aula em vídeo: gravar com a câmera e enviar para revisão", async ({ page }) => {
  const s = await entrarComo(page, "prof@local");
  await rpc(s.access_token, "termo_voluntario_aceitar").catch(() => null);
  // O tutorial da primeira visita ao painel fica fechado.
  await page.addInitScript(() => window.localStorage.setItem("lucia:tutorial-painel", String(Date.now())));
  await abrir(page, "/pt/painel?aba=videoaulas");
  // Clicado antes de a página terminar de carregar, o clique se perde: repete até o gravador aparecer.
  await expect(async () => {
    await page.getByRole("button", { name: "Gravar uma aula" }).click({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Ligar a câmera" })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90_000 });
  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  await page.getByRole("button", { name: "Começar a gravar" }).click({ timeout: 30_000 });
  await expect(page.getByText(/REC 0:0[3-9]|REC 00:0[3-9]/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Parar" }).click();
  // A prévia do que foi gravado, com duração e tamanho.
  await expect(page.getByRole("button", { name: "Descartar e gravar de novo" })).toBeVisible({ timeout: 60_000 });
  const titulo = `Aula em vídeo de teste ${Date.now()}`;
  await page.getByLabel("Título", { exact: true }).fill(titulo);
  await page.getByRole("button", { name: /Adicionar fonte/ }).click().catch(() => undefined);
  await page.getByLabel("Título da obra ou da página").first().fill("Prealgebra 2e (OpenStax)");
  await page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(page.getByText(titulo).first()).toBeVisible({ timeout: 90_000 });
});
