// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Turmas por curso da Escola (E4-15, docs/escola/turma.md), com as funções do banco SIMULADAS (rotas interceptadas):
// lista de turmas; entrar sem conta leva a /entrar; o curso sensível sem "Concordo" não chama a função; com "Concordo"
// manda p_consentimento=true; sair manda p_entrar=false; cronograma; o círculo gera link do modo turma; a banca registra
// na caderneta; o cartaz exporta; 360 px sem rolagem para o lado.
// Suba o servidor com a Escola ligada e o banco local:
//   NEXT_PUBLIC_RECURSOS=escola npm run dev:local   e depois   BASE_URL=http://localhost:3000 npx playwright test e2e/escola-turma
import { expect, type Page, test } from "@playwright/test";
import { abrir, entrarComo, vigiarErros } from "./ajuda";

const SENSIVEL = "ano-de-formacao-politica";
const COMUM = "matematica-para-a-vida";
const json = (dado: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(dado),
});

/** Simula turma_curso e turma_curso_entrar; devolve os pedidos de entrar/sair recebidos. */
async function simularTurmas(page: Page, eu = false) {
  const pedidos: Record<string, unknown>[] = [];
  let dentro = eu;
  await page.route("**/rest/v1/rpc/turma_curso", (rota) => {
    const p = JSON.parse(rota.request().postData() ?? "{}");
    return rota.fulfill(
      json({
        inscritos: dentro ? 4 : 3,
        eu: dentro,
        sala: dentro ? "InstitutoLucia-Curso-0123456789" : null,
        sensivel: p.p_curso === SENSIVEL,
      }),
    );
  });
  await page.route("**/rest/v1/rpc/turma_curso_entrar", (rota) => {
    const p = JSON.parse(rota.request().postData() ?? "{}");
    pedidos.push(p);
    dentro = p.p_entrar === true;
    return rota.fulfill(
      json({
        inscritos: dentro ? 4 : 3,
        eu: dentro,
        sala: dentro ? "InstitutoLucia-Curso-0123456789" : null,
        sensivel: p.p_curso === SENSIVEL,
      }),
    );
  });
  return pedidos;
}

test("lista de turmas: os cursos com turma e o número de inscritos", async ({
  page,
}) => {
  const erros = vigiarErros(page);
  await simularTurmas(page);
  await abrir(page, "/pt/escola/turmas");
  await expect(
    page.getByRole("heading", { level: 1, name: "Turmas por curso" }),
  ).toBeVisible();
  await expect(page.locator(`[data-turma-curso="${COMUM}"]`)).toBeVisible();
  await expect(
    page
      .locator(`[data-turma-curso="${COMUM}"]`)
      .getByText("3 pessoas na turma")
      .first(),
  ).toBeVisible();
  expect(erros).toEqual([]);
});

test("entrar sem conta explica e leva a /entrar", async ({ page }) => {
  await simularTurmas(page);
  await abrir(page, `/pt/escola/turmas/${COMUM}`);
  const semConta = page.locator("[data-turma-sem-conta]").first();
  await expect(semConta).toContainText("é preciso ter conta");
  await semConta.getByRole("link", { name: "Entrar na turma" }).click();
  await expect(page).toHaveURL(/\/pt\/entrar/);
});

test("curso sensível: sem Concordo não chama a função; com Concordo manda o consentimento", async ({
  page,
}) => {
  await entrarComo(page, "leitora@local");
  const pedidos = await simularTurmas(page);
  await abrir(page, `/pt/escola/turmas/${SENSIVEL}`);
  const bloco = page.locator("[data-turma-entrar]").first();
  const quadro = bloco.locator("[data-turma-consentimento]");
  await expect(quadro).toContainText(
    "Só a sua conta vê; você pode sair quando quiser, e sair apaga o registro.",
  );
  await bloco.locator("[data-turma-entrar-botao]").click();
  await expect(bloco.getByRole("alert")).toContainText("marque “Concordo”");
  expect(pedidos).toEqual([]);
  await quadro.getByLabel("Concordo").check();
  await bloco.locator("[data-turma-entrar-botao]").click();
  await expect(bloco.locator("[data-turma-sair]")).toBeVisible();
  expect(pedidos[0]).toMatchObject({
    p_curso: SENSIVEL,
    p_entrar: true,
    p_consentimento: true,
  });
});

test("sair da turma manda p_entrar=false e diz que apagou", async ({
  page,
}) => {
  await entrarComo(page, "leitora@local");
  const pedidos = await simularTurmas(page, true);
  await abrir(page, `/pt/escola/turmas/${COMUM}`);
  const bloco = page.locator("[data-turma-entrar]").first();
  await expect(bloco.locator("[data-turma-sala]")).toHaveAttribute(
    "href",
    /InstitutoLucia-Curso-0123456789$/,
  );
  await bloco.locator("[data-turma-sair]").click();
  await expect(bloco.locator("[data-turma-saiu]")).toContainText(
    "o registro foi apagado",
  );
  expect(pedidos.at(-1)).toMatchObject({ p_curso: COMUM, p_entrar: false });
});

test("cronograma: 4 semanas, encontros às quartas e o seminário no fim", async ({
  page,
}) => {
  await simularTurmas(page);
  await abrir(page, `/pt/escola/turmas/${COMUM}`);
  const cronograma = page.locator("[data-cronograma]").first();
  await expect(cronograma.locator("[data-semana]")).toHaveCount(4);
  await expect(cronograma.locator(".turma-encontro")).toHaveCount(4);
  await expect(cronograma.locator(".turma-encontro-seminario")).toContainText(
    "Seminário: quarta",
  );
  await expect(page.locator("[data-seminario]")).toBeVisible();
  await expect(page.locator("[data-monitoria]")).toContainText(
    "Ainda não há monitoria",
  );
  const download = page.waitForEvent("download");
  await cronograma.locator("[data-turma-ics]").click();
  expect((await download).suggestedFilename()).toMatch(/\.ics$/);
});

test("círculo de cultura: palavras, tema, busca local e link do modo turma", async ({
  page,
}) => {
  await abrir(page, "/pt/escola/turmas/circulo");
  await page.locator("[data-circulo-palavra]").fill("fração");
  await page.locator("[data-circulo-palavra]").press("Enter");
  await expect(page.locator("[data-circulo-palavras]")).toContainText("fração");
  await page.getByRole("button", { name: "Usar “fração” como tema" }).click();
  await page.locator("[data-circulo-buscar]").click();
  const achadas = page.locator("[data-circulo-achadas] li");
  await expect(achadas.first()).toBeVisible({ timeout: 20_000 });
  await achadas
    .first()
    .getByRole("button", { name: "Pôr na sequência" })
    .click();
  await page.locator("[data-circulo-gerar]").click();
  await expect(page.locator("[data-circulo-link] input")).toHaveValue(
    /\/pt\/turma#t=/,
  );
  const guardado = await page.evaluate(() =>
    localStorage.getItem("lucia:escola:circulos"),
  );
  expect(guardado).toContain("fração");
  await page.locator("[data-circulos-apagar-tudo]").click();
  expect(
    await page.evaluate(() => localStorage.getItem("lucia:escola:circulos")),
  ).toBeNull();
});

test("banca: a devolutiva vai para a caderneta deste aparelho", async ({
  page,
}) => {
  await abrir(page, "/pt/escola/turmas/banca");
  await page.locator("[data-banca-curso]").selectOption(COMUM);
  await page
    .locator('[data-banca-devolutiva="clareza"]')
    .fill("Explicou bem as contas da feira.");
  await page.locator("[data-banca-registrar]").click();
  await expect(page.locator('[data-banca-estado="registrado"]')).toBeVisible();
  const caderneta = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lucia:escola:caderneta") ?? "[]"),
  );
  expect(caderneta.at(-1)).toMatchObject({
    tipo: "banca",
    curso: COMUM,
    titulo: "Projeto apresentado em banca",
  });
  expect(caderneta.at(-1).detalhe).toContain("Clareza: Explicou bem");
});

test("cartaz: monta com o curso e as frases e exporta PNG", async ({
  page,
}) => {
  await abrir(page, "/pt/escola/turmas/cartaz");
  await page.locator("[data-cartaz-curso]").selectOption(COMUM);
  for (const frase of [
    "Aprendi a fazer a conta do mercado.",
    "Estudar junto deu coragem.",
  ]) {
    await page.locator("[data-cartaz-frase-campo]").fill(frase);
    await page.locator("[data-cartaz-frase-campo]").press("Enter");
  }
  await expect(page.locator("[data-cartaz-folha] .cartaz-frase")).toHaveCount(
    2,
  );
  const download = page.waitForEvent("download");
  await page.locator("[data-cartaz-png]").click();
  expect((await download).suggestedFilename()).toMatch(
    /^cartaz-da-turma-.*\.png$/,
  );
  await expect(page.locator("[data-cartaz-pdf]")).toBeEnabled();
});

test("360 px: nenhuma página das turmas rola para o lado", async ({ page }) => {
  await simularTurmas(page);
  await page.setViewportSize({ width: 360, height: 780 });
  for (const caminho of [
    "/pt/escola/turmas",
    `/pt/escola/turmas/${SENSIVEL}`,
    "/pt/escola/turmas/circulo",
    "/pt/escola/turmas/banca",
    "/pt/escola/turmas/cartaz",
  ]) {
    await abrir(page, caminho);
    const largura = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(largura, caminho).toBeLessThanOrEqual(360);
  }
});
