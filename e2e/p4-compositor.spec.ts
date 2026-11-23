// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, compositor (itens 26 a 29, 117, 118 e o A15 do P5) na prévia (dados de exemplo, nada vai a banco nenhum; o banco de
// verdade está em scripts/testar-p4-compositor.mjs), no computador e em 390 px:
//   - o cartão: "Mande a sua" com o total só a partir de 3 (o de 4 aparece; o de baixo, sem número) e o selo "Com fonte";
//   - o Escrever: "Mais do post" com o convite, a fonte (a que não vale é recusada na hora) e, no texto longo, a versão curta;
//   - no computador, a barrinha: escreve ali, publica com o Desfazer de 10 s e expande para o editor completo com o texto;
//   - os Ajustes: o filtro de imagens sem descrição fica só neste aparelho;
//   - nada passa da largura, os alvos novos têm 44 px e, com "menos movimento", nada se mexe.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-compositor --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-compositor' npx next dev --webpack -p <porta>)

async function aceitarTermos(page: Page) {
  const termos = page.getByRole("dialog", { name: "Leia os termos da Alumia" });
  if (await termos.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await termos.getByRole("checkbox").check();
    await termos.getByRole("button", { name: "Aceitar e continuar" }).click();
    await termos.waitFor({ state: "hidden" });
  }
}

async function semRolagemDeLado(page: Page) {
  const l = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect(l.conteudo).toBeLessThanOrEqual(l.tela + 1);
}

/** Os alvos de toque do que o prompt 4 desenha (data-p4c), menores que 44 px. */
async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-p4c] :is(button, a, summary, input[type="checkbox"], textarea, input[type="text"])'))) {
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden]')) continue;
      const alvo = (el instanceof HTMLInputElement && el.type === "checkbox" && el.closest("label")) || el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.height) < 44 || Math.round(r.width) < 44) saida.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return saida;
  });
}

for (const tamanho of [{ nome: "computador", viewport: { width: 1280, height: 900 }, computador: true }, { nome: "390 px", viewport: { width: 390, height: 844 }, computador: false }]) {
  test.describe(`Compositor do prompt 4 (${tamanho.nome})`, () => {
    test.use({ viewport: tamanho.viewport });
    test.setTimeout(180_000);

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("o cartão: o convite com o total só a partir de 3 e o selo Com fonte", async ({ page }) => {
      const r = await page.goto("/pt/alumia");
      expect(r?.status() ?? 0).toBeLessThan(400);
      await aceitarTermos(page);
      await expect(page.getByText("4 pessoas já mandaram a sua.")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Com fonte").first()).toBeVisible();
      // O convite com menos de 3 respostas: a frase, nenhum número.
      const semNumero = page.locator('[data-p4c="anexo"] .p4c-convite', { hasText: "Responda com uma frase ou uma imagem." });
      await expect(semNumero).toBeVisible();
      expect(await semNumero.textContent()).not.toMatch(/\d/);
      await semRolagemDeLado(page);
      expect(await alvosPequenos(page)).toEqual([]);
      const animados = await page.evaluate(() => Array.from(document.querySelectorAll("[data-p4c] *")).filter((e) => getComputedStyle(e).animationName !== "none" && getComputedStyle(e).animationDuration !== "0s").length);
      expect(animados).toBe(0);
    });

    test("o Escrever: Mais do post (convite, fonte, versão curta)", async ({ page }) => {
      await page.goto("/pt/alumia");
      await aceitarTermos(page);
      if (tamanho.computador) {
        // A barrinha: o "Expandir" leva o texto para o editor completo.
        const campo = page.locator('[data-p4c="barrinha"] textarea');
        await campo.waitFor({ timeout: 60_000 });
        await campo.fill("Ato na praça às 18h");
        await page.locator('[data-p4c="barrinha"]').getByRole("button", { name: "Expandir" }).click();
      } else {
        await page.getByRole("button", { name: "Escrever" }).last().click();
      }
      const janela = page.getByRole("dialog", { name: "Escrever" });
      await janela.waitFor({ timeout: 60_000 });
      if (tamanho.computador) await expect(janela.locator("textarea").first()).toHaveValue("Ato na praça às 18h");
      await janela.getByText("Mais do post").click();
      await expect(janela.getByText("Mande a sua: este post é um convite")).toBeVisible();
      const fonte = janela.getByLabel("Fonte (opcional)");
      await fonte.fill("https://exemplo.org/materia?utm_source=zap");
      await expect(janela.getByRole("alert").filter({ hasText: "Essa fonte não vale" })).toBeVisible();
      await fonte.fill("https://exemplo.org/materia");
      await expect(janela.getByText("Essa fonte não vale")).toHaveCount(0);
      await janela.getByRole("radio", { name: "Texto longo" }).or(janela.getByRole("tab", { name: "Texto longo" })).or(janela.getByRole("button", { name: "Texto longo" })).first().click();
      await expect(janela.getByText("Versão curta (opcional)")).toBeVisible();
      await expect(janela.getByText("Mande a sua: este post é um convite")).toHaveCount(0);
      await semRolagemDeLado(page);
      expect(await alvosPequenos(page)).toEqual([]);
    });

    if (tamanho.computador) {
      test("a barrinha publica com o Desfazer de 10 s, sem abrir janela", async ({ page }) => {
        await page.goto("/pt/alumia");
        await aceitarTermos(page);
        const campo = page.locator('[data-p4c="barrinha"] textarea');
        await campo.waitFor({ timeout: 60_000 });
        await campo.fill("Mutirão no sábado, quem vem?");
        await page.locator('[data-p4c="barrinha"]').getByRole("button", { name: "Publicar" }).click();
        await expect(page.getByRole("button", { name: "Desfazer" })).toBeVisible();
        await expect(page.getByRole("dialog", { name: "Escrever" })).toHaveCount(0);
        await page.getByRole("button", { name: "Desfazer" }).click();
        await expect(campo).toHaveValue("Mutirão no sábado, quem vem?");
        expect(await alvosPequenos(page)).toEqual([]);
      });
    }

    test("os Ajustes: o filtro de imagens sem descrição fica só neste aparelho", async ({ page }) => {
      await page.goto("/pt/alumia/seguranca");
      await aceitarTermos(page);
      const chave = page.locator('[data-p4c="filtro"]').getByRole("switch");
      await chave.waitFor({ timeout: 60_000 });
      await expect(chave).not.toBeChecked();
      await chave.check();
      await expect(page.getByText("Ligado neste aparelho.")).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("lucia:rede:esconder-sem-descricao"))).toBe("1");
      await chave.uncheck();
      expect(await page.evaluate(() => localStorage.getItem("lucia:rede:esconder-sem-descricao"))).toBeNull();
      await semRolagemDeLado(page);
      expect(await alvosPequenos(page)).toEqual([]);
    });
  });
}
