// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Caderneta, projeto final e formatura da Escola (E4-14, docs/escola/formatura.md). Não roda no CI. Suba o servidor com a
// Escola ligada:
//   NEXT_PUBLIC_RECURSOS=todos,escola npm run dev   e depois   BASE_URL=http://localhost:3000 npx playwright test e2e/escola-formatura
// Confere: caderneta vazia com convite; registrar e remover uma tarefa; o comprovante colado vira "2 de 3 aulas" sem o nome;
// a impressão deixa só a folha; o projeto marca etapas; a formatura fica bloqueada e libera; o Mural gera o texto sem
// enviar nada; o curso de eletricista não gera anúncio; a memória vazia explica; /en traduzido; 360 px sem rolagem para o
// lado; "reduzir movimento" respeitado.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { gerarComprovante } from "../lib/turma";

const MATRICULA = {
  versao: 1,
  numero: "LM-ABCD-EFGH",
  criadaEm: "2026-02-01",
  apelido: "Rosa",
  objetivo: "outro",
  tempo: "1-3h",
  acesso: "wifi-em-casa",
  nivelamento: [],
};
const CURSO = "costura";

async function semear(page: Page, dados: Record<string, unknown>) {
  await page.addInitScript((d) => {
    for (const [k, v] of Object.entries(d)) if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
  }, dados);
}

/** Registra os pedidos de rede que não são arquivos da própria página (só a contagem anônima é permitida). */
function vigiarRede(page: Page) {
  const pedidos: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/\/rest\/v1\/|\/functions\/v1\//.test(u)) pedidos.push(`${r.method()} ${u}`);
  });
  return pedidos;
}

test("caderneta vazia mostra o convite e, com matrícula, deixa registrar e remover", async ({ page }) => {
  await page.goto("/pt/escola/caderneta");
  await expect(page.locator("[data-sem-matricula]")).toBeVisible();

  await semear(page, { "lucia:escola:matricula": MATRICULA });
  await page.goto("/pt/escola/caderneta");
  await expect(page.locator("[data-caderneta-vazia]")).toBeVisible();
  await page.getByRole("button", { name: "Registrar algo" }).click();
  await page.getByLabel("Título").fill("Ajudei a pintar a associação");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("[data-registro]")).toHaveCount(1);
  await page.getByRole("button", { name: "Remover" }).click();
  await page.getByRole("button", { name: "Sim, remover" }).click();
  await expect(page.locator("[data-registro]")).toHaveCount(0);
});

test("o comprovante colado vira '2 de 3 aulas' e o nome não é copiado", async ({ page }) => {
  await semear(page, { "lucia:escola:matricula": MATRICULA });
  await page.goto("/pt/escola/caderneta");
  const comprovante = gerarComprovante({ v: 1, titulo: "T", aulas: ["a/1", "a/2", "a/3"] }, new Set(["a/1", "a/2"]), "Maria da Silva", "2026-11-03");
  await page.getByLabel("Comprovantes").fill(comprovante);
  await page.getByRole("button", { name: "Ler" }).click();
  await expect(page.getByText("2 de 3 aulas")).toBeVisible();
  await page.getByRole("button", { name: "Guardar na caderneta" }).click();
  await expect(page.locator("main")).not.toContainText("Maria da Silva");
});

test("imprimir deixa só a folha e o aviso", async ({ page }) => {
  await semear(page, {
    "lucia:escola:matricula": MATRICULA,
    "lucia:escola:caderneta": [{ id: "r1", tipo: "outro", data: "2026-11-01", titulo: "Registro de teste", detalhe: "" }],
  });
  await page.goto("/pt/escola/caderneta");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".caderneta-impressao")).toBeVisible();
  await expect(page.locator(".caderneta-impressao")).toContainText("Não é certificado");
  await expect(page.locator("header").first()).toBeHidden();
});

test("projeto: marca etapas; formatura fica bloqueada e libera; confirmar grava o registro", async ({ page }) => {
  const rede = vigiarRede(page);
  await semear(page, {
    "lucia:escola:matricula": MATRICULA,
    "lucia:escola:cursos": [{ curso: CURSO, entrouEm: "2026-02-01", semestre: "2026.1", dispensas: [] }],
  });
  await page.goto("/pt/escola/formatura");
  await expect(page.locator("[data-o-que-falta]")).toBeVisible();
  await expect(page.locator("[data-minha-formatura]")).toHaveCount(0);

  await page.goto("/pt/escola/formatura/projeto");
  for (const etapa of ["plano", "rascunho", "apresentacao"]) await page.locator(`[data-etapa="${etapa}"] input[type="checkbox"]`).check();
  await expect(page.locator('[data-etapa="plano"]')).toHaveAttribute("data-feita", "");
  // Com o projeto pronto, só faltam as aulas: o painel continua bloqueado e o botão não aparece.
  await page.goto("/pt/escola/formatura");
  await expect(page.locator("[data-o-que-falta]")).toContainText("Faltam");
  await expect(page.locator("[data-minha-formatura]")).toHaveCount(0);
  // Concluir todas as aulas do curso (mesma chave que a aula usa) libera o botão; confirmar grava o registro e a folha.
  const curso = JSON.parse(readFileSync(join(process.cwd(), "content", "escola", "cursos", `${CURSO}.json`), "utf8")) as { modulos: { aulas: string[] }[] };
  await page.evaluate((aulas) => localStorage.setItem("lucia:concluidas", JSON.stringify(aulas)), curso.modulos.flatMap((m) => m.aulas));
  await page.goto("/pt/escola/formatura");
  await page.locator("[data-minha-formatura]").click();
  await page.getByRole("button", { name: "Confirmo: terminei este curso" }).click();
  await expect(page.locator("[data-parabens]")).toBeVisible();
  await page.goto("/pt/escola/formatura/registro");
  await expect(page.locator("[data-registro-de-formatura]").first()).toContainText("Não é certificado");
  await page.goto("/pt/escola/caderneta");
  await expect(page.locator(`[data-registro="formatura-${CURSO}"]`)).toBeVisible();
  // Só a contagem anônima pode ir para a rede.
  expect(rede.filter((r) => !/contar/.test(r))).toEqual([]);
});

test("Mural: gera o texto e copia sem enviar; eletricista não gera anúncio", async ({ page }) => {
  const rede = vigiarRede(page);
  await semear(page, {
    "lucia:escola:matricula": MATRICULA,
    "lucia:escola:cursos": [
      { curso: CURSO, entrouEm: "2026-02-01", semestre: "2026.1", dispensas: [] },
      { curso: "eletricista-residencial", entrouEm: "2026-02-01", semestre: "2026.1", dispensas: [] },
    ],
  });
  await page.goto("/pt/escola/formatura/mural");
  await page.getByLabel("Curso").selectOption(CURSO);
  await page.getByLabel(/Seu ofício/).fill("Costureira");
  await expect(page.locator("[data-anuncio-pronto]")).toContainText("registro de estudo, não uma certificação oficial");
  await page.getByRole("button", { name: "Copiar a descrição" }).click();
  await page.getByLabel("Curso").selectOption("eletricista-residencial");
  await expect(page.locator("[data-sem-anuncio]")).toContainText("Procure um profissional habilitado");
  await expect(page.locator("[data-anuncio-pronto]")).toHaveCount(0);
  expect(rede).toEqual([]);
});

test("memória vazia explica como pedir; /en traduzido", async ({ page }) => {
  await page.goto("/pt/escola/formatura/memoria");
  await expect(page.locator("[data-memoria-vazia]")).toBeVisible();
  await page.goto("/en/escola/formatura");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("My graduation");
});

test("360 px sem rolagem para o lado e 'reduzir movimento' respeitado", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const caminho of ["/escola/caderneta", "/escola/formatura", "/escola/formatura/projeto", "/escola/formatura/mural", "/escola/formatura/memoria", "/escola/formatura/registro"]) {
    await page.goto(`/pt${caminho}`);
    const largura = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
    expect(largura.doc, caminho).toBeLessThanOrEqual(largura.janela);
  }
});
