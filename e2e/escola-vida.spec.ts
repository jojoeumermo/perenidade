// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vida real e vozes da Escola (E4-11, docs/escola/vida.md): o mapa das lutas mostra os meses e "Pôr na agenda"; a tarefa no
// mundo marca e desmarca e o estado volta depois de recarregar; sem microfone as vozes mostram a alternativa escrita; a
// missão abre o laboratório; a página abre em chinês; 360 px sem rolagem para o lado; tema escuro. Sem a flag as páginas
// respondem "não encontrado": isso é do layout de /escola e já está em e2e/escola-base.spec.ts.
// Suba o servidor com a Escola ligada:
//   NEXT_PUBLIC_RECURSOS=escola npm run dev:local   e depois   BASE_URL=http://localhost:3000 npx playwright test e2e/escola-vida
import { expect, test } from "@playwright/test";
import { abrir, vigiarErros } from "./ajuda";

const CURSO = "barbearia";

test("lutas: mostra os meses e o link Pôr na agenda", async ({ page }) => {
  await abrir(page, "/pt/escola/lutas");
  await expect(page.getByRole("heading", { name: "Mapa das lutas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /março/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pôr na agenda" }).first()).toBeVisible();
  await expect(page.getByText("Feriado do campus").first()).toBeVisible();
});

test("lutas: abre em chinês", async ({ page }) => {
  await abrir(page, "/zh/escola/lutas");
  await expect(page.getByRole("heading", { name: "斗争地图" })).toBeVisible();
});

test("tarefas: marca, desmarca e o estado volta depois de recarregar", async ({ page }) => {
  await abrir(page, "/pt/escola/vida/tarefas");
  const cartao = page.locator(`[data-tarefa-curso="${CURSO}"]`);
  await cartao.getByRole("button", { name: "Marcar como feita" }).click();
  await expect(cartao.getByText(/Feita em/)).toBeVisible();
  await page.reload();
  await expect(page.locator(`[data-tarefa-curso="${CURSO}"]`).getByText(/Feita em/)).toBeVisible();
  await page.locator(`[data-tarefa-curso="${CURSO}"]`).getByRole("button", { name: "Desfazer" }).click();
  await expect(page.locator(`[data-tarefa-curso="${CURSO}"]`).getByRole("button", { name: "Marcar como feita" })).toBeVisible();
});

test("vozes: sem microfone mostra a alternativa escrita e o roteiro", async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error simula um aparelho sem gravação
    delete window.MediaRecorder;
  });
  await abrir(page, "/pt/escola/vozes");
  await expect(page.locator("[data-sem-gravacao]")).toContainText("Seu aparelho não grava áudio");
  await expect(page.locator("[data-roteiro-da-voz]")).toContainText("O que eu faço no meu trabalho?");
  await expect(page.locator("[data-vozes-vazio]")).toBeVisible();
});

test("missões: abre o laboratório", async ({ page }) => {
  await abrir(page, "/pt/escola/vida/missoes");
  await page.locator('[data-missao="sql-ver-os-dados"]').getByRole("link", { name: "Abrir o laboratório" }).click();
  await expect(page).toHaveURL(/\/laboratorios\/ide\?p=sql&ex=sql-01-select/);
});

test("360 px: nenhuma página da vida real rola para o lado", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const caminho of ["/pt/escola/vida", "/pt/escola/vozes", "/pt/escola/lutas", "/pt/escola/vida/tarefas", "/pt/escola/vida/missoes", "/pt/escola/vida/caso-do-bairro", "/pt/escola/vida/documentos"]) {
    await abrir(page, caminho);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura, caminho).toBeLessThanOrEqual(360);
  }
});

test("tema escuro: as páginas abrem sem erro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const erros = vigiarErros(page);
  await abrir(page, "/pt/escola/vida");
  await expect(page.locator("[data-hub-da-vida]")).toBeVisible();
  expect(erros).toEqual([]);
});

test("caso do bairro: guarda o rascunho e ele volta depois de recarregar", async ({ page }) => {
  await abrir(page, "/pt/escola/vida/caso-do-bairro");
  await page.locator("#caso-passo-0").fill("Vi a rua alagada.");
  await page.getByRole("button", { name: "Guardar o rascunho" }).click();
  await page.reload();
  await expect(page.locator("#caso-passo-0")).toHaveValue("Vi a rua alagada.");
});