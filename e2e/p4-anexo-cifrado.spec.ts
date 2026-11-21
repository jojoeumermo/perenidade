// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, itens 137 e 138: os botões de áudio e vídeo curto no chat a dois, com a prévia de dados de exemplo (nada vai a banco
// nenhum) e "alumia-p4-anexo-cifrado" ligado. No computador e em 390 px:
//   - os botões aparecem no compositor, com o aviso honesto do que o servidor vê;
//   - alvos de toque de 44 px, nada passa da largura e, com "menos movimento", nenhuma animação rodando;
//   - gravar: o microfone falso do Chrome grava, o contador é texto, "Parar e enviar" tenta mandar; na prévia, sem chat de verdade,
//     a tela diz que ainda não está ligado (nada sai do aparelho);
//   - "Cancelar" para o microfone sem mandar nada;
//   - vídeo curto (item 138): um MP4 de 6 s passa pela duração e pela limpeza de metadado no aparelho e tenta mandar (na prévia, a
//     mesma frase de "ainda não ligado"); um arquivo que não é vídeo é recusado na tela.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-anexo-cifrado --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-anexo-cifrado' npx next dev --webpack -p <porta>)

test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] }, permissions: ["microphone"] });
test.setTimeout(300_000);

async function abrirConversa(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/pt/alumia/conversas");
  // A janela dos termos (P5) cobre tudo até o aceite: na prévia, aceita e segue.
  const termos = page.getByRole("dialog", { name: "Leia os termos da Alumia" });
  if (await termos.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await termos.getByRole("checkbox").check();
    await termos.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(termos).toBeHidden();
  }
  await page.getByRole("button", { name: /Rosa Vermelha/ }).first().click();
  await expect(page.getByRole("button", { name: "Gravar áudio" })).toBeVisible();
}

async function conferirTela(page: Page) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect.soft(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
  for (const nome of ["Gravar áudio", "Vídeo curto"]) {
    const caixa = await page.getByRole("button", { name: nome }).boundingBox();
    expect.soft(caixa && caixa.width >= 44 && caixa.height >= 44, `alvo de 44 px: ${nome}`).toBe(true);
  }
  // Só as do compositor do chat (onde os botões novos moram): o resto da casca tem o teste dele (e2e/alumia-390.spec.ts).
  const rodando = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => (a.effect as KeyframeEffect | null)?.target as Element | null)
      .filter((alvo) => alvo?.closest(".al2-chat-escrever"))
      .map((alvo) => `${alvo?.tagName}.${alvo?.className}`),
  );
  expect.soft(rodando, "nenhuma animação no compositor com menos movimento").toEqual([]);
  await expect(page.getByText("O arquivo é cifrado neste aparelho antes de sair.", { exact: false })).toBeVisible();
}

for (const [nome, tela] of [["computador", { width: 1280, height: 900 }], ["390 px", { width: 390, height: 844 }]] as const) {
  test(`anexo cifrado no chat, ${nome}`, async ({ page }) => {
    await page.setViewportSize(tela);
    await abrirConversa(page);
    await conferirTela(page);

    // Gravar e cancelar: o contador aparece, e cancelar volta aos botões sem mensagem de erro.
    await page.getByRole("button", { name: "Gravar áudio" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Gravando: \d+ s de 60/ })).toBeVisible();
    const parar = page.getByRole("button", { name: "Parar e enviar" });
    const caixa = await parar.boundingBox();
    expect.soft(caixa && caixa.height >= 44, "Parar e enviar com 44 px").toBe(true);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Gravar áudio" })).toBeVisible();

    // Gravar e mandar: na prévia não há chat de verdade, então nada sai e a tela diz que ainda não está ligado.
    await page.getByRole("button", { name: "Gravar áudio" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Parar e enviar" }).click();
    await expect(page.getByText("Áudio e vídeo no chat ainda não estão ligados.")).toBeVisible();
    await conferirTela(page);

    // Vídeo curto: o arquivo escolhido é lido, medido e limpo no aparelho; na prévia, nada sai.
    const entrada = page.locator('input[type="file"][accept="video/mp4,video/webm"]');
    await entrada.setInputFiles({ name: "falso.mp4", mimeType: "video/mp4", buffer: Buffer.from("isto não é um vídeo, só texto com nome de vídeo") });
    await expect(page.getByText("Formato não aceito. Use MP4 ou WebM.")).toBeVisible();
    await expect(page.getByText("Áudio e vídeo no chat ainda não estão ligados.")).toBeHidden();
    // Um MP4 de verdade, de 6 s: passa pela duração e pela limpeza e chega ao envio (que a prévia não faz).
    await entrada.setInputFiles("public/territorios/coletivo-desordem/notados.mp4");
    await expect(page.getByText("Áudio e vídeo no chat ainda não estão ligados.")).toBeVisible();
    await expect(page.getByText("Formato não aceito. Use MP4 ou WebM.")).toBeHidden();
    await conferirTela(page);
  });
}
