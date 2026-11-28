// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { vigiarErros } from "./ajuda";

// O Laboratório da TRI na página REAL (/pt/enem/laboratorio-tri), no computador e no celular: o seletor de caderno
// (variantes de 2022: CN 1093, MT 1081/1082, LC 1073), os nomes oficiais por código de prova, o aviso do código sem
// descrição, a alternância de caderno, idioma, ano e área sem nota nem resposta de outro caderno, e a página sem rolagem
// lateral. Só dados sintéticos: as "respostas" são marcações do próprio teste, sem microdados de pessoa.
//
//   NEXT_PUBLIC_RECURSOS=enem-curso npm run dev:local   (a página fica atrás do recurso "enem-curso")
//   npx playwright test e2e/laboratorio-tri --project=computador --project=s24
//   CAPTURAS=1 npx playwright test e2e/laboratorio-tri   → também guarda uma captura de cada estado em test-results/capturas/
//
// A primeira visita compila a página no servidor de desenvolvimento: folga de tempo só aqui.
test.describe.configure({ timeout: 240_000, retries: 0 });

const CAMINHO = "/pt/enem/laboratorio-tri";

async function abrirLab(page: Page) {
  // Diagnóstico: se o laboratório não aparecer, a falha diz o que o navegador viu (texto, erros, respostas ruins).
  const visto: string[] = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) visto.push(`console ${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => visto.push(`exceção: ${String(e).slice(0, 200)}`));
  page.on("requestfailed", (r) => visto.push(`falhou: ${r.url().slice(0, 120)}`));
  page.on("response", (r) => { if (r.status() >= 400) visto.push(`http ${r.status()}: ${r.url().slice(0, 120)}`); });
  const resposta = await page.goto(CAMINHO, { waitUntil: "domcontentloaded", timeout: 180_000 });
  expect(resposta?.status(), "a página existe (recurso enem-curso ligado no servidor?)").toBe(200);
  try {
    await page.locator("#tri-colar").waitFor({ state: "visible", timeout: 90_000 });
  } catch {
    const texto = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(-500);
    throw new Error(`o laboratório não apareceu em 90 s. Fim do texto da página: ${texto}\n${visto.slice(0, 12).join("\n")}`);
  }
  // A raiz do laboratório (a página tem outras seções e seletores, como o de idioma do site).
  return page.locator("[data-laboratorio-tri]");
}
const seletorAno = (lab: Locator) => lab.locator("select").filter({ has: lab.page().locator('option[value="2009"]') });
const seletorArea = (lab: Locator) => lab.locator("select").filter({ has: lab.page().locator("option[value=natureza]") });
const seletorCaderno = (lab: Locator) => lab.locator("select").filter({ has: lab.page().locator("option", { hasText: /Prova \d+/ }) });
const seletorIdioma = (lab: Locator) => lab.locator("select").filter({ has: lab.page().locator("option[value=espanhol]") });
const marcadas = (lab: Locator) => lab.locator("input[type=checkbox]:checked").count();
const nota = async (lab: Locator) => (await lab.locator("[role=status] p").first().textContent()) ?? "";
const bloco = (lab: Locator) => lab.locator(".mt-3.space-y-1");
async function marcar(lab: Locator, k: number) {
  for (let i = 0; i < k; i++) await lab.locator("input[type=checkbox]").nth(i).check();
}
async function capturar(page: Page, nome: string, info: { project: { name: string } }) {
  if (process.env.CAPTURAS) await page.screenshot({ path: `test-results/capturas/lab-tri-${info.project.name}-${nome}.png`, fullPage: true });
}
async function semRolagemLateral(page: Page, lab: Locator, estado: string) {
  const largura = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
  expect(largura.doc, `${estado}: a página não rola para o lado`).toBeLessThanOrEqual(largura.janela + 1);
  const caixas = await lab.locator("select, textarea, button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { esquerda: r.left, direita: r.right, visivel: r.width > 0 }; }));
  for (const c of caixas.filter((x) => x.visivel)) {
    expect(c.esquerda, `${estado}: controle dentro da tela (esquerda)`).toBeGreaterThanOrEqual(-1);
    expect(c.direita, `${estado}: controle dentro da tela (direita)`).toBeLessThanOrEqual(largura.janela + 1);
  }
}

test("laboratório da TRI: estados do seletor de caderno com nome oficial por código", async ({ page }, info) => {
  const erros = vigiarErros(page);
  const lab = await abrirLab(page);
  await seletorArea(lab).selectOption("natureza");
  await expect(seletorCaderno(lab)).toBeVisible();
  const cn = await seletorCaderno(lab).locator("option").allTextContents();
  expect(cn.map((t) => t.match(/Prova (\d+)/)?.[1])).toEqual(["1085", "1093"]);
  expect(cn[1]).toContain("Videoprova - Libras");
  await semRolagemLateral(page, lab, "natureza referência");
  await capturar(page, "1-natureza-1085", info);
  await seletorCaderno(lab).selectOption("1093");
  await expect(bloco(lab)).toContainText("Nome no dicionário oficial dos microdados: Verde - Videoprova - Libras");
  await semRolagemLateral(page, lab, "natureza 1093");
  await capturar(page, "2-natureza-1093", info);

  await seletorArea(lab).selectOption("matematica");
  const mt = await seletorCaderno(lab).locator("option").allTextContents();
  expect(mt.map((t) => t.match(/Prova (\d+)/)?.[1])).toEqual(["1075", "1081", "1082"]);
  expect(mt[1]).toContain("sem descrição no dicionário do Inep");
  expect(mt[1]).not.toContain("Ledor");
  expect(mt[2]).toContain("Adaptada Ledor");
  await seletorCaderno(lab).selectOption("1081");
  await expect(bloco(lab)).toContainText("não tem descrição no dicionário oficial dos microdados");
  await expect(bloco(lab)).not.toContainText("Ledor");
  await semRolagemLateral(page, lab, "matemática 1081");
  await capturar(page, "3-matematica-1081", info);
  await seletorCaderno(lab).selectOption("1082");
  await expect(bloco(lab)).toContainText("Nome no dicionário oficial dos microdados: Laranja - Adaptada Ledor");
  await semRolagemLateral(page, lab, "matemática 1082");
  await capturar(page, "4-matematica-1082", info);

  await seletorArea(lab).selectOption("linguagens");
  const lc = await seletorCaderno(lab).locator("option").allTextContents();
  expect(lc.map((t) => t.match(/Prova (\d+)/)?.[1])).toEqual(["1065", "1073"]);
  await seletorCaderno(lab).selectOption("1073");
  await expect(bloco(lab)).toContainText("Videoprova - Libras");
  await semRolagemLateral(page, lab, "linguagens 1073");
  await capturar(page, "5-linguagens-1073", info);

  await seletorAno(lab).selectOption("2021");
  await expect(seletorCaderno(lab)).toHaveCount(0);
  expect(erros).toEqual([]);
});

test("laboratório da TRI: alternar caderno, idioma, ano e área não mistura nota nem respostas", async ({ page }, info) => {
  const lab = await abrirLab(page);
  await seletorArea(lab).selectOption("natureza");
  await marcar(lab, 10);
  await lab.locator("#tri-colar").fill("ABCDE");
  const nota1085 = await nota(lab);
  expect(await marcadas(lab)).toBe(10);
  await expect(lab.getByText(/10 acerto\(s\) marcados guardados neste caderno \(prova 1085\)/)).toBeVisible();

  await seletorCaderno(lab).selectOption("1093");
  expect(await marcadas(lab), "1093 não herda as marcas do 1085").toBe(0);
  await expect(lab.locator("#tri-colar")).toHaveValue("");
  await expect(lab.getByText(/acerto\(s\) marcados guardados/)).toHaveCount(0);
  expect(await nota(lab), "1093 não mostra a nota do 1085").not.toBe(nota1085);
  await marcar(lab, 3);
  const nota1093 = await nota(lab);
  await capturar(page, "6-1093-com-respostas", info);

  await seletorCaderno(lab).selectOption("1085");
  expect(await marcadas(lab)).toBe(10);
  await expect(lab.locator("#tri-colar")).toHaveValue("ABCDE");
  expect(await nota(lab)).toBe(nota1085);
  await seletorCaderno(lab).selectOption("1093");
  expect(await marcadas(lab)).toBe(3);
  expect(await nota(lab)).toBe(nota1093);
  await expect(lab.locator("#tri-colar")).toHaveValue("");

  await seletorAno(lab).selectOption("2021");
  expect(await marcadas(lab), "outro ano começa sem marcas").toBe(0);
  await seletorAno(lab).selectOption("2022");
  await expect(seletorCaderno(lab)).toHaveValue("1085");
  expect(await marcadas(lab)).toBe(10);
  expect(await nota(lab)).toBe(nota1085);

  await seletorArea(lab).selectOption("matematica");
  expect(await marcadas(lab), "outra área começa sem marcas").toBe(0);
  await expect(seletorCaderno(lab)).toHaveValue("1075");
  await seletorArea(lab).selectOption("natureza");
  await expect(seletorCaderno(lab)).toHaveValue("1085");
  expect(await marcadas(lab)).toBe(10);

  await seletorArea(lab).selectOption("linguagens");
  await marcar(lab, 2);
  const notaIngles = await nota(lab);
  await seletorIdioma(lab).selectOption("espanhol");
  expect(await marcadas(lab), "espanhol começa sem marcas").toBe(0);
  expect(await nota(lab)).not.toBe(notaIngles);
  await seletorIdioma(lab).selectOption("ingles");
  expect(await marcadas(lab)).toBe(2);
  expect(await nota(lab)).toBe(notaIngles);
  await seletorCaderno(lab).selectOption("1073");
  expect(await marcadas(lab)).toBe(0);
});

test("laboratório da TRI: celular estreito (360 px) sem rolagem lateral com o rótulo mais longo", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const lab = await abrirLab(page);
  await seletorArea(lab).selectOption("matematica");
  await seletorCaderno(lab).selectOption("1081");
  await semRolagemLateral(page, lab, "360 px matemática 1081");
  await capturar(page, "7-360px-1081", info);
  await seletorCaderno(lab).selectOption("1082");
  await semRolagemLateral(page, lab, "360 px matemática 1082");
  await capturar(page, "8-360px-1082", info);
});
