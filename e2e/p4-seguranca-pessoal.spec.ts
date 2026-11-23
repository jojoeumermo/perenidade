// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, segurança pessoal (itens 10 a 12): a tela /alumia/seguranca-pessoal na prévia (dublê na memória, nada vai a banco
// nenhum; a cifra e o banco de verdade estão em scripts/testar-p4-seguranca-pessoal.mjs), no computador e em 390 px:
//   - abre com a flag; pedir o plantão passa pela confirmação e diz que foi cifrado, sem número de pessoas;
//   - o registro pede a foto ou o vídeo pela câmera; o interruptor de sumiço liga e desliga;
//   - nada passa da largura, todo alvo de toque tem 44 px, e com "menos movimento" nada fica se mexendo.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-seguranca-pessoal --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-seguranca-pessoal' npx next dev --webpack -p <porta>)

const ROTA = "/pt/alumia/seguranca-pessoal";
const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, a.sp-link, input[type="checkbox"], input[type="radio"], select, label.sp-arquivo';

async function assentar(page: Page) {
  await page.waitForLoadState("load");
  await page.getByRole("heading", { level: 1, name: "Segurança pessoal" }).waitFor({ timeout: 120_000 });
  // A prévia pede o reaceite dos termos numa janela que bloqueia a casca: aceita, como a pessoa faria.
  const termos = page.getByRole("dialog", { name: "Leia os termos da Alumia" });
  if (await termos.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await termos.getByRole("checkbox").check();
    await termos.getByRole("button", { name: "Aceitar e continuar" }).click();
    await termos.waitFor({ state: "hidden" });
  }
  await page.waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, { timeout: 15_000 }).catch(() => undefined);
  await page.locator('[data-bloco="sp-plantao"] select').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`.sp-pagina :is(${seletor})`))) {
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
      const estilo = getComputedStyle(el);
      if (estilo.visibility === "hidden" || estilo.display === "none") continue;
      const alvo = (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && el.closest("label")) || el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) saida.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return saida;
  }, ALVOS);
}

for (const tamanho of [{ nome: "computador", viewport: { width: 1280, height: 900 } }, { nome: "390 px", viewport: { width: 390, height: 844 } }]) {
  test.describe(`Segurança pessoal (${tamanho.nome})`, () => {
    test.use({ viewport: tamanho.viewport });
    test.setTimeout(150_000);

    test("a tela abre, cabe e tem alvos de 44 px, sem movimento", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const resposta = await page.goto(ROTA);
      expect(resposta?.status() ?? 0).toBeLessThan(400);
      await assentar(page);
      for (const titulo of ["Plantão jurídico", "Registro de abuso", "Interruptor de sumiço", "Sua chave de segurança", "Caixa da assessoria jurídica", "Assessoria jurídica da organização"]) {
        await expect(page.getByRole("heading", { level: 2, name: titulo })).toBeVisible();
      }
      await expect(page.getByText("fica só neste aparelho")).toBeVisible();
      const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
      expect.soft(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
      expect.soft(await alvosPequenos(page), "alvos de toque de pelo menos 44 px").toEqual([]);
      // Só o que é desta tela (a casca tem o seu próprio teste, e2e/alumia-390).
      const rodando = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running")
        .map((a) => (a.effect as KeyframeEffect | null)?.target as Element | null).filter((el) => el?.closest(".sp-pagina")).map((el) => el?.className ?? "?"));
      expect.soft(rodando, "com menos movimento, nada fica se mexendo").toEqual([]);
      // A câmera: o campo do registro pede foto ou vídeo pela câmera de trás.
      await expect(page.locator('[data-bloco="sp-registro"] input[type="file"]')).toHaveAttribute("capture", "environment");
      // A gestão não mostra lista de pessoas: só se o plantão está pronto.
      await expect(page.locator('[data-bloco="sp-gestao"] [data-pronta]')).toHaveCount(1);
    });

    test("pedir o plantão passa pela confirmação e não diz quantas pessoas recebem", async ({ page }) => {
      await page.goto(ROTA);
      await assentar(page);
      const bloco = page.locator('[data-bloco="sp-plantao"]');
      await bloco.getByLabel("Onde você está ou onde aconteceu").fill("Praça da Sé");
      await bloco.getByLabel("O que aconteceu").selectOption("agressao");
      await bloco.getByRole("radio", { name: "Telefone", exact: true }).check();
      await bloco.getByLabel("Contato", { exact: true }).fill("11 90000-0000");
      await bloco.getByRole("button", { name: "Mandar pedido cifrado" }).click();
      await page.getByRole("dialog").getByRole("button", { name: /Confirmar/ }).click();
      const ok = bloco.getByRole("status");
      await expect(ok).toHaveText("Pedido enviado, cifrado, para a assessoria jurídica da organização.");
      expect(await ok.textContent()).not.toMatch(/\d/);
    });

    test("o interruptor de sumiço liga e desliga", async ({ page }) => {
      await page.goto(ROTA);
      await assentar(page);
      const bloco = page.locator('[data-bloco="sp-sumico"]');
      await expect(bloco.locator("[data-ligado]")).toHaveAttribute("data-ligado", "false");
      await bloco.getByLabel(/@ do contato/).fill("@contato_exemplo");
      await bloco.getByLabel("Como você aparece no aviso").fill("@eu");
      await bloco.getByLabel(/O aviso/).fill("Se isto chegou, avise a minha família.");
      await bloco.getByRole("button", { name: "Ligar o interruptor" }).click();
      await expect(bloco.locator("[data-ligado]")).toHaveAttribute("data-ligado", "true");
      await expect(bloco.locator("[data-ligado]")).toContainText("@contato_exemplo");
      await bloco.getByRole("button", { name: "Desligar" }).click();
      await page.getByRole("dialog").getByRole("button", { name: /Confirmar/ }).click();
      await expect(bloco.locator("[data-ligado]")).toHaveAttribute("data-ligado", "false");
    });

    test("a assessora abre o pedido na caixa", async ({ page }) => {
      await page.goto(ROTA);
      await assentar(page);
      const bloco = page.locator('[data-bloco="sp-caixa"]');
      await bloco.getByRole("button", { name: "Abrir" }).click();
      await expect(bloco.getByText("Praça de exemplo")).toBeVisible();
      await expect(bloco.getByText("Detenção")).toBeVisible();
    });
  });
}
