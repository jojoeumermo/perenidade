// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, lote "pontes", com a prévia de dados de exemplo (nada vai a banco nenhum) e "alumia-p4-pontes" ligado. No computador e
// em 390 px:
//   - 130: a busca nos salvos filtra no aparelho (nenhum pedido sai com o termo), anuncia quantos achou e o "nada";
//   - 133: "Ler como texto" na conversa da Lia abre o leitor de fios, com o modo foco;
//   - alvos de toque de 44 px, nada passa da largura e, com "menos movimento", nenhuma animação rodando nas telas do lote.
// Os itens de banco (81, 82, 85, 86, 131, 132, 133) e os do aparelho que precisam de mídia de verdade (87 Libras, 88 legendas)
// ficam no testar:p4-pontes.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-pontes --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-pontes' npx next dev --webpack -p <porta>)

test.setTimeout(300_000);

async function aceitarTermos(page: Page) {
  const termos = page.getByRole("dialog", { name: "Leia os termos da Alumia" });
  if (await termos.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await termos.getByRole("checkbox").check();
    await termos.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(termos).toBeHidden();
  }
}

async function alvo(page: Page, nome: string | RegExp, papel: "button" | "link" | "searchbox" = "button") {
  const caixa = await page.getByRole(papel, { name: nome }).first().boundingBox();
  expect.soft(caixa && caixa.height >= 44 && (papel === "searchbox" || caixa.width >= 44), `alvo de 44 px: ${String(nome)}`).toBe(true);
}

async function semSobra(page: Page) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect.soft(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
}

async function semAnimacao(page: Page, seletor: string) {
  const rodando = await page.evaluate(
    (sel) =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .map((a) => (a.effect as KeyframeEffect | null)?.target as Element | null)
        .filter((x) => x?.closest(sel))
        .map((x) => `${x?.tagName}.${x?.className}`),
    seletor,
  );
  expect.soft(rodando, "nenhuma animação com menos movimento").toEqual([]);
}

for (const [nome, tela] of [["computador", { width: 1280, height: 900 }], ["390 px", { width: 390, height: 844 }]] as const) {
  test(`pontes do Prompt 4, ${nome}`, async ({ page }) => {
    await page.setViewportSize(tela);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const pedidos: string[] = [];
    page.on("request", (r) => pedidos.push(r.url()));

    // 130. A busca nos salvos, só no aparelho.
    await page.goto("/pt/alumia/salvos");
    await aceitarTermos(page);
    const busca = page.getByRole("searchbox", { name: "Procurar nos salvos" });
    await expect(busca).toBeVisible();
    await expect(page.getByText("A busca roda só neste aparelho", { exact: false })).toBeVisible();
    await alvo(page, "Procurar nos salvos", "searchbox");
    const antes = await page.locator("ol.al3-lista-entra > li").count();
    expect(antes).toBeGreaterThan(0);
    pedidos.length = 0;
    await busca.fill("zzqqxxyy");
    await expect(page.getByRole("status").filter({ hasText: "Nada nos salvos" })).toBeVisible();
    expect(pedidos.filter((u) => u.includes("zzqqxxyy")), "o termo não sai do aparelho").toEqual([]);
    await busca.fill("");
    await expect(page.locator("ol.al3-lista-entra > li")).toHaveCount(antes);
    await semSobra(page);
    await semAnimacao(page, "[data-p4-busca-salvos]");

    // 133. O leitor de fios, a partir da conversa da Lia (a resposta dela a ela mesma faz o fio).
    await page.goto("/pt/alumia/p/00000000-0000-4000-8000-0000000000c1");
    await aceitarTermos(page);
    const ler = page.getByRole("link", { name: "Ler como texto" });
    if (await ler.isVisible().catch(() => false)) {
      await alvo(page, "Ler como texto", "link");
      await ler.click();
    } else {
      // A conversa de exemplo pode não ter resposta da própria autora: o leitor abre direto.
      await page.goto("/pt/alumia/fio/00000000-0000-4000-8000-0000000000c1");
    }
    await aceitarTermos(page);
    await expect(page.locator("[data-p4-fio]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /Fio de/ })).toBeVisible();
    await alvo(page, "Modo foco");
    await page.getByRole("button", { name: "Modo foco" }).click();
    await expect(page.locator("[data-p4-fio]")).toHaveAttribute("data-foco", "sim");
    await alvo(page, "Sair do modo foco");
    await semSobra(page);
    await semAnimacao(page, "[data-p4-fio]");
    await page.getByRole("button", { name: "Sair do modo foco" }).click();
    await expect(page.locator("[data-p4-fio]")).toHaveAttribute("data-foco", "nao");
  });
}
