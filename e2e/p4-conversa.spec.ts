// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, lote da conversa (itens 13 a 21), com a prévia de dados de exemplo (nada vai a banco nenhum) e "alumia-p4-conversa"
// ligado (mais "alumia-p4-anexo-cifrado", de que a foto e a nota de voz dependem). No computador e em 390 px:
//   - 15: "Notas para mim" no alto da lista, abre a tela das notas com o aviso de que só a pessoa lê;
//   - 18: "Agendar envio" no campo, com o aviso de que o aparelho precisa estar ligado com o chat aberto; hora fora da janela recusada;
//   - 14: "Encaminhar" no menu da mensagem abre a escolha das conversas, com o limite;
//   - 13: o botão da foto de ver uma vez no compositor;
//   - alvos de toque de 44 px, nada passa da largura e, com "menos movimento", nenhuma animação rodando no compositor.
// A transcrição da nota de voz (21) não roda aqui: precisa de um áudio cifrado de verdade e de um navegador com reconhecimento
// local; o testar:p4-conversa prova a conferência e a tela.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-conversa --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-anexo-cifrado,alumia-p4-conversa' npx next dev --webpack -p <porta>)

test.setTimeout(300_000);

async function abrirLista(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/pt/alumia/conversas");
  const termos = page.getByRole("dialog", { name: "Leia os termos da Alumia" });
  if (await termos.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await termos.getByRole("checkbox").check();
    await termos.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(termos).toBeHidden();
  }
  await expect(page.getByRole("button", { name: /Rosa Vermelha/ }).first()).toBeVisible();
}

async function alvo(page: Page, nome: string | RegExp, papel: "button" | "textbox" = "button") {
  const caixa = await page.getByRole(papel, { name: nome }).first().boundingBox();
  expect.soft(caixa && caixa.width >= 44 && caixa.height >= 44, `alvo de 44 px: ${String(nome)}`).toBe(true);
}

async function semSobra(page: Page) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect.soft(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
}

async function semAnimacao(page: Page) {
  const rodando = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => (a.effect as KeyframeEffect | null)?.target as Element | null)
      .filter((x) => x?.closest(".al2-chat-escrever, [data-agendar], [data-encaminhar]"))
      .map((x) => `${x?.tagName}.${x?.className}`),
  );
  expect.soft(rodando, "nenhuma animação com menos movimento").toEqual([]);
}

for (const [nome, tela] of [["computador", { width: 1280, height: 900 }], ["390 px", { width: 390, height: 844 }]] as const) {
  test(`conversa do Prompt 4, ${nome}`, async ({ page }) => {
    await page.setViewportSize(tela);
    await abrirLista(page);

    // 15. Notas para mim, no alto da lista.
    const notas = page.getByRole("button", { name: /Notas para mim/ });
    await expect(notas).toBeVisible();
    await alvo(page, /Notas para mim/);
    await notas.click();
    await expect(page.getByText("O servidor não sabe que elas existem.", { exact: false })).toBeVisible();
    await semSobra(page);
    await abrirLista(page);
    await page.getByRole("button", { name: /Rosa Vermelha/ }).first().click();

    // 13. A foto de ver uma vez no compositor.
    await expect(page.getByRole("button", { name: "Foto que abre uma vez" })).toBeVisible();
    await alvo(page, "Foto que abre uma vez");

    // 18. Envio agendado.
    const campo = page.locator("#alumia-chat-texto");
    await campo.fill("Lembrete: panfletagem às 7h");
    const agendar = page.getByRole("button", { name: "Agendar envio" });
    await expect(agendar).toBeVisible();
    await alvo(page, "Agendar envio");
    await agendar.click();
    const janela = page.locator("[data-agendar]");
    await expect(janela.getByText("Fica só neste aparelho e sai na hora se ele estiver ligado com o chat da Alumia aberto.", { exact: false })).toBeVisible();
    const quando = janela.locator('input[type="datetime-local"]');
    const caixaDoCampo = await quando.boundingBox();
    expect.soft(caixaDoCampo && caixaDoCampo.height >= 44, "campo da hora com 44 px").toBe(true);
    await quando.fill("2020-01-01T10:00");
    await janela.getByRole("button", { name: "Agendar", exact: true }).click();
    await expect(janela.getByRole("alert")).toHaveText("Escolha uma hora entre 1 minuto e 30 dias daqui.");
    await alvo(page, "Agendar");
    await semSobra(page);
    await semAnimacao(page);
    await janela.getByRole("button", { name: "Cancelar" }).click();
    await expect(janela).toBeHidden();

    // 14. Encaminhar, pelo menu de uma mensagem com texto.
    const menus = page.getByRole("button", { name: "Mais ações desta mensagem" });
    const quantos = await menus.count();
    let achou = false;
    for (let i = quantos - 1; i >= 0 && !achou; i--) {
      await menus.nth(i).click();
      const item = page.getByRole("menuitem", { name: "Encaminhar" }).or(page.getByRole("button", { name: "Encaminhar", exact: true }));
      if (await item.first().isVisible().catch(() => false)) {
        await item.first().click();
        achou = true;
      } else await page.keyboard.press("Escape");
    }
    expect(achou, "alguma mensagem com texto oferece Encaminhar").toBe(true);
    const encaminhar = page.locator("[data-encaminhar]");
    await expect(encaminhar.getByRole("heading", { name: "Encaminhar para" })).toBeVisible();
    await expect(encaminhar.getByText(/Até 5 conversas de uma vez|só para uma conversa por vez/)).toBeVisible();
    await semSobra(page);
    await semAnimacao(page);
    await encaminhar.getByRole("button", { name: "Cancelar" }).click();
    await expect(encaminhar).toBeHidden();
  });
}
