// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";
import { abrir, vigiarErros } from "./ajuda";

// Matrícula sem cadastro, carteirinha e plano da semana da Escola Lúcia Maria (E4-08, docs/escola/matricula.md).
// Precisa do site montado com a Escola ligada:
//   NEXT_PUBLIC_RECURSOS=todos,escola npm run dev:local   e depois   BASE_URL=http://localhost:3100 npx playwright test e2e/escola-matricula
// Roda no computador e no celular (projetos do playwright.config.ts). Sem a flag, os testes são pulados.
// O plano com aulas precisa de cursos em content/escola/cursos (E4-07); sem eles, o teste do plano é pulado.

async function escolaLigada(page: Page): Promise<boolean> {
  return (await page.request.get("/pt/escola/matricula")).status() === 200;
}

test.beforeEach(async ({ page }) => {
  test.skip(!(await escolaLigada(page)), "a Escola está desligada nesta montagem (NEXT_PUBLIC_RECURSOS sem 'escola')");
});

/** Faz a matrícula inteira em /pt, pulando o nivelamento, e devolve o número. */
async function matricular(page: Page, apelido = "Zé da Vila"): Promise<string> {
  await abrir(page, "/pt/escola/matricula");
  await page.getByRole("button", { name: /Trabalho e renda/ }).click();
  await expect(page.getByRole("heading", { name: "Quanto tempo por semana você tem para estudar?" })).toBeFocused();
  await page.getByRole("button", { name: /De 1 a 3 horas/ }).click();
  await page.getByRole("button", { name: /O pacote acaba/ }).click();
  // Nivelamento e sugestão só aparecem quando há perguntas e cursos.
  const naoNivelar = page.getByRole("button", { name: /Agora não/ });
  if (await naoNivelar.isVisible().catch(() => false)) await naoNivelar.click();
  const seguir = page.getByRole("button", { name: /Continuar a matrícula/ });
  if (await seguir.isVisible().catch(() => false)) await seguir.click();
  await page.getByLabel("Apelido (opcional)").fill(apelido);
  await page.getByRole("button", { name: "Fazer minha matrícula" }).click();
  await expect(page.getByRole("heading", { name: "Matrícula feita neste aparelho" })).toBeVisible();
  const numero = (await page.locator("[data-matricula-feita] [data-numero-da-matricula]").textContent())?.trim() ?? "";
  expect(numero).toMatch(/^LM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  return numero;
}

test("matrícula completa em /pt: uma pergunta por tela, nada pedido além do apelido, número no aparelho", async ({ page }) => {
  const erros = vigiarErros(page);
  const pedidos: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") pedidos.push(`${r.url()} ${r.postData() ?? ""}`);
  });
  const numero = await matricular(page);
  // Nenhum campo de nome completo, CPF, e-mail, telefone ou endereço.
  await expect(page.locator("input[type=email], input[type=tel], input[autocomplete=email], input[autocomplete=name]")).toHaveCount(0);
  // O pacote acaba: a tela final sugere a economia de dados.
  await expect(page.locator("[data-convite-leve]")).toBeVisible();
  await expect(page.getByRole("link", { name: "Meus dados" })).toBeVisible();
  // A matrícula está no aparelho e o número/apelido não saíram dele (só o +1 anônimo pode sair).
  const guardada = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:escola:matricula") ?? "null"));
  expect(guardada?.numero).toBe(numero);
  expect(pedidos.filter((p) => p.includes(numero) || p.includes("Zé da Vila"))).toEqual([]);
  expect(pedidos.filter((p) => p.includes("/rpc/") && !p.includes("/rpc/contar_escola"))).toEqual([]);
  // Voltando, a página mostra a matrícula (e não pergunta de novo).
  await page.reload();
  await expect(page.locator("[data-gerir-matricula] [data-numero-da-matricula]")).toContainText(numero);
  expect(erros).toEqual([]);
});

test("Voltar e Pular nas perguntas", async ({ page }) => {
  await abrir(page, "/pt/escola/matricula");
  await page.getByRole("button", { name: "Pular →" }).click();
  await expect(page.locator("[data-pergunta=tempo]")).toBeVisible();
  await page.getByRole("button", { name: "← Voltar" }).click();
  await expect(page.locator("[data-pergunta=objetivo]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ouvir a pergunta" })).toBeVisible();
});

test("carteirinha: número, aviso de meia-entrada e impressão do tamanho do cartão", async ({ page }) => {
  const numero = await matricular(page);
  await page.getByRole("link", { name: "Carteirinha" }).first().click();
  await expect(page).toHaveURL(/\/pt\/escola\/carteirinha$/);
  const carteirinha = page.locator("[data-carteirinha]");
  await expect(carteirinha.locator("[data-carteirinha-frente] [data-numero]")).toHaveText(numero);
  await expect(carteirinha.locator("[data-carteirinha-frente]")).toContainText("Zé da Vila");
  await expect(carteirinha.locator("[data-aviso-meia-entrada]")).toHaveText(
    "Esta carteirinha não é documento oficial e não vale como carteira de estudante para meia-entrada. Foi feita neste aparelho; nada foi enviado.",
  );
  await expect(carteirinha).toContainText("Lei nº 12.933/2013");
  // Sem cara de documento: nenhum campo de CPF, RG ou data de nascimento.
  await expect(carteirinha).not.toContainText(/CPF|RG|nascimento/);
  // Impressão: só as duas faces, do tamanho do cartão.
  await page.emulateMedia({ media: "print" });
  const faces = page.locator(".carteirinha-impressao .certificado.carteirinha");
  await expect(faces).toHaveCount(2);
  await expect(faces.first()).toBeVisible();
  const largura = await faces.first().evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.abs(largura - (85.6 / 25.4) * 96)).toBeLessThan(2);
  await expect(page.locator("header.no-print").first()).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expect(page.locator(".carteirinha-impressao")).toBeHidden();
});

test("carteirinha sem matrícula mostra o convite", async ({ page }) => {
  await abrir(page, "/pt/escola/carteirinha");
  await expect(page.locator("[data-carteirinha-convite]")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fazer a matrícula" })).toBeVisible();
});

test("plano da semana com 3 dias (segunda, quarta e sexta)", async ({ page }) => {
  await matricular(page);
  // A matrícula entra no primeiro curso sugerido; sem cursos do E4-07, não há o que planejar.
  await abrir(page, "/pt/escola/plano");
  const plano = page.locator("[data-plano]");
  await expect(plano.locator("[data-plano-regra]")).toContainText("sem inteligência artificial");
  test.skip((await page.locator("[data-dia-da-semana]").count()) === 0, "sem cursos em content/escola/cursos (E4-07)");
  await expect(page.locator("[data-dia-da-semana][aria-pressed=true]")).toHaveCount(3);
  const dias = await plano.locator("[data-dia]").count();
  expect(dias).toBeGreaterThan(0);
  expect(dias).toBeLessThanOrEqual(3);
  await expect(plano).not.toContainText(/atrasad/i);
});

test("apagar a matrícula, com confirmação", async ({ page }) => {
  await matricular(page);
  await page.getByRole("button", { name: /Sua matrícula/ }).click();
  await page.getByRole("button", { name: "Apagar a matrícula" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();
  expect(await page.evaluate(() => localStorage.getItem("lucia:escola:matricula"))).not.toBeNull();
  await page.getByRole("button", { name: "Apagar a matrícula" }).click();
  await page.getByRole("button", { name: "Sim, apagar" }).click();
  await expect(page.getByText("Matrícula apagada deste aparelho.")).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("lucia:escola:")))).toEqual([]);
  await expect(page.locator("[data-pergunta=objetivo]")).toBeVisible();
});

test("/en com os textos traduzidos", async ({ page }) => {
  await abrir(page, "/en/escola/matricula");
  await expect(page.getByRole("heading", { name: "What brings you here?" })).toBeVisible();
  await page.getByRole("button", { name: /Understand the world/ }).click();
  await expect(page.getByRole("heading", { name: "How much time a week do you have to study?" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("O que te traz aqui?");
  await abrir(page, "/en/escola/carteirinha");
  await expect(page.getByText("You do not have an enrolment on this device yet")).toBeVisible();
});

test("sem rolagem lateral em 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await matricular(page);
  for (const caminho of ["/pt/escola/matricula", "/pt/escola/carteirinha", "/pt/escola/plano", "/pt/escola"]) {
    await abrir(page, caminho);
    await page.keyboard.press("Escape");
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura, caminho).toBeLessThanOrEqual(360);
  }
});

test("leitor de tinta: a matrícula funciona e a carteirinha aparece", async ({ browser }) => {
  const contexto = await browser.newContext({ userAgent: "Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+" });
  const page = await contexto.newPage();
  await matricular(page);
  await expect(page.locator("html")).toHaveAttribute("data-leitor", "");
  await abrir(page, "/pt/escola/carteirinha");
  await expect(page.locator("[data-carteirinha] [data-aviso-meia-entrada]")).toBeVisible();
  await contexto.close();
});

test("entrada da Escola: quem volta mostra a mini-carteirinha", async ({ page }) => {
  const numero = await matricular(page);
  await abrir(page, "/pt/escola");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-mini-carteirinha]")).toContainText(numero);
  await expect(page.locator("[data-quem-volta]")).toContainText("Hoje no seu plano");
});
