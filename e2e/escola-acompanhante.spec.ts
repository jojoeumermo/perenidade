// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Acompanhante do estudante (E4-10): "Não entendi" numa aula, pista de nível 1 num exercício, comentário de redação
// sem número e sem nota, documento que só segue depois do aviso, modo sem servidor sem conta, "Como funciona" e a
// largura de 360 px. A função "assistente" é SIMULADA (rota interceptada): nenhum provedor de IA é chamado.
// Suba o servidor com a Escola e os exercícios ligados e o banco local:
//   NEXT_PUBLIC_RECURSOS=escola,meu-estudo,exercicios npm run dev:local
import { expect, type Page, test } from "@playwright/test";
import { abrir, entrarComo } from "./ajuda";

const AULA = "/pt/trilhas/alfabetizacao-de-jovens-e-adultos/fazer-contas-do-dia-a-dia";

/** Liga o assistente no estado do banco e simula a função: devolve o texto e guarda os pedidos recebidos. */
async function simularAssistente(page: Page, texto: string) {
  const pedidos: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/assistente_estado", (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ligado: true }) }));
  await page.route("**/functions/v1/assistente", async (rota) => {
    if (rota.request().method() === "OPTIONS") return rota.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    pedidos.push(JSON.parse(rota.request().postData() ?? "{}"));
    return rota.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ texto, cortada: false, restantes: 9, provedor: "Simulado" }) });
  });
  return pedidos;
}

test("Não entendi numa aula: abre a folha com o trecho e pergunta no modo socrático", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  const pedidos = await simularAssistente(page, "Antes de explicar: o que você já sabe sobre somar dinheiro?");
  await abrir(page, AULA);
  const botao = page.locator("[data-nao-entendi]");
  test.skip(!(await botao.isVisible({ timeout: 15_000 }).catch(() => false)), "faixa da aula escondida neste projeto (modo aplicativo)");
  await botao.click();
  const folha = page.locator("dialog.acompanhante-folha[open]");
  await expect(folha).toBeVisible();
  await expect(folha.locator("blockquote")).not.toBeEmpty();
  await expect(folha).toContainText("fora do Brasil");
  await folha.getByRole("button", { name: "Perguntar sobre este trecho" }).click();
  await expect(folha.getByText("o que você já sabe")).toBeVisible({ timeout: 15_000 });
  expect(pedidos[0]?.modo).toBe("socratico");
  expect((pedidos[0]?.contexto as { aula?: string; trecho?: string })?.aula).toBe("alfabetizacao-de-jovens-e-adultos/fazer-contas-do-dia-a-dia");
  expect(((pedidos[0]?.contexto as { trecho?: string })?.trecho ?? "").length).toBeLessThanOrEqual(1200);
  // O histórico fica só no aparelho.
  const guardado = await page.evaluate(() => localStorage.getItem("lucia:escola-privado:conversas"));
  expect(guardado).toContain("socratico");
});

test("pista de nível 1 depois de errar, sem mandar qual é a certa", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  const pedidos = await simularAssistente(page, "Pense no que acontece com o troco.");
  await abrir(page, AULA);
  const cartoes = page.locator("article").filter({ has: page.locator('[role="group"] button') });
  test.skip((await cartoes.count()) === 0, "aula sem exercício de escolha");
  let achou = false;
  for (let i = 0; i < Math.min(await cartoes.count(), 6) && !achou; i++) {
    const cartao = cartoes.nth(i);
    for (const alternativa of await cartao.locator('[role="group"] button').all()) {
      if (await alternativa.isDisabled()) continue;
      await alternativa.click();
      if (await cartao.getByRole("button", { name: "Quero uma pista" }).isVisible({ timeout: 3000 }).catch(() => false)) {
        await cartao.getByRole("button", { name: "Quero uma pista" }).click();
        await expect(cartao.getByText("Pense no que acontece com o troco.")).toBeVisible({ timeout: 15_000 });
        achou = true;
        break;
      }
      if (await cartao.getByText(/Acertou|Certo/).isVisible().catch(() => false)) break;
    }
  }
  expect(achou).toBe(true);
  const contexto = pedidos[0]?.contexto as { nivel?: number; alternativas?: string[] };
  expect(pedidos[0]?.modo).toBe("pistas");
  expect(contexto?.nivel).toBe(1);
  expect(JSON.stringify(pedidos[0])).not.toMatch(/"certa"/);
});

test("comentário de redação sem número e sem nota", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  await simularAssistente(page, "**Competência 1: Escrever na norma formal da língua portuguesa**\n- Ponto forte: frases claras.\nNota estimada: 160 pontos\n- A melhorar: vírgulas.");
  await abrir(page, "/pt/escola/acompanhante/redacao");
  await expect(page.getByText("Comentário automático, não é correção nem nota.").first()).toBeVisible();
  await page.getByLabel("Sua redação").fill("A mobilidade urbana no Brasil é um desafio. ".repeat(6));
  await page.getByRole("button", { name: "Pedir o comentário" }).click();
  const resposta = page.locator('section[aria-label="Resposta do acompanhante"]');
  await expect(resposta).toContainText("Ponto forte", { timeout: 15_000 });
  await expect(resposta).not.toContainText("160");
  await expect(resposta).not.toContainText(/nota estimada/i);
  await expect(page.getByText("Uma linha que trazia nota ou pontuação foi tirada")).toBeVisible();
});

test("documento: a foto só pode ser escolhida depois do aviso", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  await simularAssistente(page, "Esta é uma conta de luz. **Vencimento: 10/11.** isto não é orientação jurídica.");
  await abrir(page, "/pt/escola/acompanhante/documento");
  await expect(page.getByText("Cubra CPF, RG, números de conta e dados de outras pessoas antes de mandar.")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.locator("[data-entendi-documento]").check();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  // Uma imagem mínima (1 × 1): basta para a tarja e para o envio simulado.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "conta.png", mimeType: "image/png", buffer: png });
  const tela = page.locator(".acompanhante-tarja canvas");
  await expect(tela).toBeVisible({ timeout: 15_000 });
  await tela.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Tarjas: 1")).toBeVisible();
  await page.getByRole("button", { name: "Mandar a imagem riscada" }).click();
  await expect(page.getByText("Vencimento: 10/11.")).toBeVisible({ timeout: 15_000 });
});

test("sem conta: modo sem servidor, com trechos das aulas", async ({ page }) => {
  await abrir(page, "/pt/escola/acompanhante");
  await page.locator('[data-modo-acompanhante="duvida"] summary').click();
  await page.getByLabel("Sua dúvida").fill("como fazer contas de troco no dia a dia");
  await expect(page.getByText("Sem conta, o assistente não responde.").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Procurar nas aulas" }).first().click();
  const caixa = page.locator('[data-sem-servidor="semConta"]');
  await expect(caixa).toContainText("Respostas tiradas das aulas do site (sem IA, sem servidor)");
  await expect(caixa.getByRole("link", { name: /Abrir a aula/ }).first()).toBeVisible({ timeout: 20_000 });
});

test("Como funciona lista os provedores e diz o que fica e o que vai", async ({ page }) => {
  await abrir(page, "/pt/escola/acompanhante/como-funciona");
  const lista = page.locator("[data-provedores] li");
  await expect(lista).toHaveCount(5);
  await expect(page.locator("[data-provedores]")).toContainText("Claude (Anthropic)");
  await expect(page.getByText(/art\. 33/)).toBeVisible();
  await expect(page.getByText(/apagada depois de 90 dias/)).toBeVisible();
  await expect(page.locator("[data-modelos-medidos] li")).toHaveCount(3);
});

test("360 px sem rolagem lateral nas páginas do acompanhante", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const caminho of ["/pt/escola/acompanhante", "/pt/escola/acompanhante/redacao", "/pt/escola/acompanhante/documento", "/pt/escola/acompanhante/conversa", "/pt/escola/acompanhante/como-funciona"]) {
    await abrir(page, caminho);
    const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(larguras[0], caminho).toBeLessThanOrEqual(larguras[1]);
  }
});
