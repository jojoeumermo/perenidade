// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { parseFrontmatter } from "../lib/frontmatter";
import { abrir } from "./ajuda";

// A avaliação e o aprender ativo da Escola Lúcia Maria (E4-13, docs/escola/avaliacao.md). Precisa do site montado com
// a Escola ligada:
//   NEXT_PUBLIC_RECURSOS=todos,escola npm run dev:local   e depois   BASE_URL=http://localhost:3100 npx playwright test e2e/escola-avaliacao
// Sem a flag, /pt/escola responde "não encontrado" e os testes são pulados.

const TRILHA = "ingles-do-zero";
const PRIMEIRA = "alfabeto-e-sons";
const SEGUNDA = "saudacoes-e-apresentacoes";

test.beforeEach(async ({ page }) => {
  const resposta = await page.request.get("/pt/escola/provas");
  test.skip(resposta.status() !== 200, "a Escola está desligada nesta montagem (NEXT_PUBLIC_RECURSOS sem 'escola')");
});

/** As respostas certas da trilha, lidas do próprio conteúdo: {pergunta: texto da opção certa}. */
function gabarito(): Map<string, string> {
  const pasta = path.join(process.cwd(), "content", "trilhas", TRILHA);
  const mapa = new Map<string, string>();
  for (const arquivo of fs.readdirSync(pasta).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(pasta, arquivo), "utf8"));
    for (const q of (data.quiz as { pergunta: string; opcoes: string[]; resposta: number }[] | undefined) ?? []) mapa.set(q.pergunta.trim(), q.opcoes[q.resposta]);
  }
  return mapa;
}

/** Responde a prova inteira: com `certas`, a opção certa; sem, sempre a primeira. Devolve quantas questões havia. */
async function responderTudo(page: Page, modo: "normal" | "dupla" | "proficiencia", certas?: Map<string, string>) {
  const prova = page.locator(`[data-modo-da-prova='${modo}']`);
  await expect(prova).toBeVisible();
  const total = Number((await prova.locator("h2").innerText()).match(/(\d+)\D*$/)?.[1] ?? "0");
  for (let i = 0; i < total; i++) {
    const pergunta = (await prova.locator("p.font-serif").first().innerText()).trim();
    const certa = certas?.get(pergunta);
    const opcoes = prova.locator("button:has(span.flex-1)");
    if (certa) await opcoes.filter({ has: page.getByText(certa, { exact: true }) }).first().click();
    else await opcoes.first().click();
    if (modo === "proficiencia") await prova.getByRole("button", { name: /Próxima questão|Terminar a prova/ }).click();
    else if (i < total - 1) await prova.getByRole("button", { name: /Próxima (pergunta|questão)/ }).click();
  }
  return total;
}

const semNumero = async (page: Page) => {
  const texto = await page.locator("[data-retorno-competencia]").innerText();
  expect(texto).not.toMatch(/\d|%/);
};

test("prova normal: grava no aparelho e mostra o retorno por competência sem número", async ({ page }) => {
  await abrir(page, `/pt/trilhas/${TRILHA}/prova`);
  await page.getByRole("button", { name: "Fazer a prova" }).click();
  const total = await responderTudo(page, "normal");
  // O que a prova mostrava continua: "acertou X de Y".
  await expect(page.locator("[data-modo-da-prova='normal']")).toContainText(String(total));
  await expect(page.locator("[data-retorno-competencia]")).toBeVisible();
  await semNumero(page);
  const guardadas = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:escola:provas") ?? "{}"));
  expect(guardadas[TRILHA]).toHaveLength(1);
  expect(guardadas[TRILHA][0].modo).toBe("normal");
});

test("prova de proficiência: explica antes e oferece a dispensa a quem sabe tudo, sem esconder aula", async ({ page }) => {
  await page.addInitScript((t) => {
    localStorage.setItem("lucia:escola:cursos", JSON.stringify([{ curso: t, entrouEm: "2026-08-10", semestre: "2026.2", dispensas: [] }]));
  }, TRILHA);
  await abrir(page, `/pt/trilhas/${TRILHA}/prova?modo=proficiencia`);
  await expect(page.locator("[data-proficiencia] .aviso-do-modo")).toContainText("Dá para refazer");
  await page.getByRole("button", { name: "Começar a prova de proficiência" }).click();
  await responderTudo(page, "proficiencia", gabarito());
  await expect(page.locator("[data-oferta-de-dispensa='pode']")).toBeVisible();
  await page.getByRole("button", { name: /Marcar esta trilha como dispensada/ }).click();
  await expect(page.locator(`[data-dispensada='${TRILHA}']`)).toBeVisible();
  const cursos = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:escola:cursos") ?? "[]"));
  expect(cursos[0].dispensas).toContain(TRILHA);
  // Nenhuma aula some: a aula da trilha dispensada continua abrindo.
  expect((await page.request.get(`/pt/trilhas/${TRILHA}/${PRIMEIRA}`)).status()).toBe(200);
});

test("prova em dupla: as duas pessoas se revezam e o fim não tem placar", async ({ page }) => {
  await abrir(page, `/pt/trilhas/${TRILHA}/prova?modo=dupla`);
  await page.getByRole("button", { name: "Começar a prova em dupla" }).click();
  await expect(page.locator("[data-vez-da-dupla='a']")).toContainText("Combinem a resposta");
  const prova = page.locator("[data-modo-da-prova='dupla']");
  await prova.locator("button:has(span.flex-1)").first().click();
  await prova.getByRole("button", { name: /Próxima (pergunta|questão)/ }).click();
  await expect(page.locator("[data-vez-da-dupla='b']")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Começar a prova em dupla" }).click();
  await responderTudo(page, "dupla");
  await expect(prova).not.toContainText("Você acertou");
  await expect(page.locator("[data-retorno-competencia]")).toBeVisible();
  await semNumero(page);
  const guardadas = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:escola:provas") ?? "{}"));
  expect(guardadas[TRILHA].at(-1).modo).toBe("dupla");
});

test("o cartão 'lembra?' aparece no começo da aula, some ao pular e não volta no mesmo dia", async ({ page }) => {
  await page.addInitScript(
    ({ aula }) => {
      if (sessionStorage.getItem("ja-preparado")) return;
      sessionStorage.setItem("ja-preparado", "1");
      localStorage.setItem("lucia:concluidas", JSON.stringify([aula]));
      localStorage.setItem("lucia:concluidas-em", JSON.stringify({ [aula]: Date.now() - 3 * 86_400_000 }));
    },
    { aula: `${TRILHA}/${PRIMEIRA}` },
  );
  await abrir(page, `/pt/trilhas/${TRILHA}/${SEGUNDA}`);
  const cartao = page.locator(`[data-lembra-da-anterior='${TRILHA}/${PRIMEIRA}']`);
  await expect(cartao).toBeVisible();
  await expect(cartao).toContainText("Antes de começar: lembra?");
  await cartao.locator("[data-lembra-pular]").click();
  await expect(cartao).toHaveCount(0);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-lembra-da-anterior]")).toHaveCount(0);
});

test("explique com suas palavras: guarda no aparelho, volta na aula e apaga", async ({ page }) => {
  await abrir(page, `/pt/trilhas/${TRILHA}/${PRIMEIRA}`);
  const caixa = page.locator("[data-explique]");
  await caixa.locator("textarea").fill("O H de hour não se pronuncia.");
  await caixa.getByRole("button", { name: "Guardar no aparelho" }).click();
  await page.reload();
  await expect(page.locator("[data-explique] [data-explicacao-anterior]")).toContainText("O H de hour");
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem("lucia:escola:explicacoes") ?? "{}"));
  expect(guardado[`ingles-do-zero/${PRIMEIRA}`].texto).toContain("hour");
  await page.locator("[data-apagar-explicacao]").click();
  await expect(page.locator("[data-explique] [data-explicacao-anterior]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("lucia:escola:explicacoes"))).toBe("{}");
});

// A resposta digitada com erro de digitação ("quase") é conferida em scripts/testar-escola-avaliacao.mjs. Hoje nenhuma
// aula publicada tem prática com resposta digitada (as de idioma usam banco de palavras ou alternativas; conferido em
// 03/11/2026 em content/trilhas), então o teste de tela fica marcado para quando houver uma.
test.fixme("resposta com erro de digitação aceita como quase", async () => {
  // Quando houver aula com "traduzir" sem "palavras" ou "lacuna" sem "opcoes": abrir a prática, digitar a resposta com
  // uma letra trocada (palavra de 5 a 8 letras) e esperar [data-quase] com "Quase! A grafia é".
});

test("360 px: a semana de provas, a prova e os saberes cabem sem rolar para o lado", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const caminho of ["/pt/escola/provas", `/pt/trilhas/${TRILHA}/prova`, "/pt/escola/saberes", "/pt/cursos/ingles-do-zero/modulo/1"]) {
    await abrir(page, caminho);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura, caminho).toBeLessThanOrEqual(360);
  }
  await abrir(page, "/pt/escola/saberes");
  await expect(page.locator("[data-aviso-honesto]")).toContainText("não é certificação oficial");
});
