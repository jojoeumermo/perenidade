// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Agentes de trabalho, turma e equipe (E4-16): o hub com 7 cartões; a entrevista (5 respostas, "Começar outra"); CPF
// que bloqueia o botão e não envia nada; oratória só com números no aparelho; papelada só mostra a foto depois do aviso;
// agente da turma (acha aula, edita o resumo, copia); revisão sem chamada de rede; tradução que bloqueia a cópia; sem
// conta o aviso leva ao /entrar; modo seguro não grava; 360 px sem rolagem lateral. A função "assistente" é SIMULADA
// (rota interceptada): nenhum provedor de IA é chamado. Suba o servidor com a Escola ligada e o banco local:
//   NEXT_PUBLIC_RECURSOS=escola,meu-estudo,exercicios npm run dev:local
// Com o recurso desligado, /escola/agentes dá 404 (conferido em scripts/testar-agentes.mjs pelo layout de /escola).
import { expect, type Page, test } from "@playwright/test";
import { abrir, entrarComo } from "./ajuda";

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

test("o hub mostra os 7 agentes, em 3 grupos", async ({ page }) => {
  await abrir(page, "/pt/escola/agentes");
  await expect(page.locator("[data-agente-cartao]")).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "Para estudar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Para a turma" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Para a equipe" })).toBeVisible();
});

test("entrevista: a primeira fala vai com 'Pergunta 1 de 5' e a quinta resposta encerra", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  const pedidos = await simularAssistente(page, "Boa resposta. Próxima pergunta: por que você quer esta vaga?");
  await abrir(page, "/pt/escola/agentes/entrevista");
  await page.getByRole("button", { name: "Auxiliar administrativo" }).click();
  await expect(page.locator("[data-etapa-da-entrevista]")).toContainText("Pergunta 1 de 5");
  await page.getByRole("button", { name: "Começar a entrevista" }).click();
  await expect(page.getByText("Boa resposta.").first()).toBeVisible({ timeout: 15_000 });
  expect((pedidos[0]?.contexto as { trecho?: string }).trecho).toMatch(/pergunta 1 de 5/);
  for (let n = 1; n <= 5; n++) {
    await page.getByLabel("Sua resposta").fill(`Minha resposta número ${n}, com um exemplo do meu trabalho.`);
    await page.getByRole("button", { name: "Enviar a resposta" }).click();
    await expect(page.getByText("Boa resposta.")).toHaveCount(n + 1, { timeout: 15_000 });
  }
  await expect(page.locator("[data-entrevista-concluida]")).toContainText("Treino concluído, sem nota");
  await expect(page.getByRole("button", { name: "Começar outra conversa" })).toBeVisible();
});

test("CPF digitado bloqueia o botão e nada é enviado", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  const pedidos = await simularAssistente(page, "ok");
  await abrir(page, "/pt/escola/agentes/educador");
  await page.getByLabel("Tema da aula").fill("Como calcular desconto. Meu CPF é 529.982.247-25 para o cadastro.");
  await expect(page.locator('[data-dado-pessoal="bloqueia"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Escrever o rascunho" })).toBeDisabled();
  expect(pedidos).toHaveLength(0);
});

test("oratória digitando: mostra o ritmo e grava só números", async ({ page }) => {
  await abrir(page, "/pt/escola/agentes/oratoria");
  const fala = Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(" ");
  await page.getByLabel("Texto da sua fala").fill(fala);
  await page.locator("[data-segundos]").fill("30");
  await page.locator("[data-medir]").click();
  await expect(page.locator("[data-ppm]")).toContainText("120 palavras por minuto");
  const guardado = await page.evaluate(() => localStorage.getItem("lucia:escola-privado:ensaios"));
  expect(guardado).toContain('"palavras":60');
  expect(guardado).not.toContain("palavra1");
});

test("papelada: a foto só pode ser escolhida depois do 'Li o aviso'", async ({ page }) => {
  await abrir(page, "/pt/escola/agentes/papelada");
  await expect(page.locator("[data-foto-papelada]")).toHaveCount(0);
  await page.locator("[data-entendi-papelada]").check();
  await expect(page.locator("[data-foto-papelada]")).toHaveCount(1);
  await expect(page.getByText("Isto não é orientação jurídica").first()).toBeVisible();
});

test("agente da turma: acha uma aula, edita o resumo e pede as perguntas", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  const pedidos = await simularAssistente(page, "1. O que mudou na sua rua?\n2. Quem decide?\n3. E se fosse diferente?\n4. O que a aula não diz?");
  await abrir(page, "/pt/escola/agentes/turma");
  await page.locator("[data-busca-aula]").fill("favela");
  await page.getByRole("button", { name: "Procurar uma aula" }).click();
  await page.locator("[data-usar-aula]").first().click();
  const resumo = page.locator("[data-resumo-da-aula]");
  await expect(resumo).not.toHaveValue("");
  await resumo.fill("Um resumo editado pela pessoa que facilita a turma.");
  await page.getByRole("button", { name: "Sugerir perguntas de debate" }).click();
  await expect(page.getByText("O que mudou na sua rua?")).toBeVisible({ timeout: 15_000 });
  expect(pedidos[0]?.modo).toBe("turma");
  expect((pedidos[0]?.contexto as { trecho?: string }).trecho).toBe("Um resumo editado pela pessoa que facilita a turma.");
  await expect(page.getByRole("button", { name: "Copiar as perguntas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Levar para o círculo de cultura" }).first()).toBeVisible();
});

test("revisão: acusa link http e fonte ausente sem nenhuma chamada de rede", async ({ page }) => {
  await abrir(page, "/pt/escola/agentes/revisao");
  const chamadas: string[] = [];
  page.on("request", (r) => {
    if (/exemplo\.org|functions\/v1|rest\/v1/.test(r.url())) chamadas.push(r.url());
  });
  await page.locator("[data-texto-para-revisar]").fill("Veja [o site](http://exemplo.org/a) para mais.");
  await page.locator("[data-revisar]").click();
  await expect(page.locator('[data-regra="http"]')).toBeVisible();
  await expect(page.locator('[data-regra="sem-secao"]')).toBeVisible();
  expect(chamadas).toHaveLength(0);
  await expect(page.getByText("npm run conferir:links")).toBeVisible();
});

test("tradução: a cópia fica bloqueada sem a caixa do revisor", async ({ page }) => {
  await abrir(page, "/pt/escola/agentes/traducao");
  await page.locator("[data-origem]").fill("O Instituto Lúcia atende 1.200 pessoas.");
  await page.locator("[data-traducao]").fill("The Institute serves people.");
  await page.locator("[data-conferir-traducao]").click();
  await expect(page.locator('[data-regra="numero"]')).toBeVisible();
  await expect(page.locator('[data-regra="termo"]')).toBeVisible();
  const copiar = page.locator("[data-copiar-com-marca]");
  await expect(copiar).toBeDisabled();
  await page.locator("[data-revisado-por-falante]").check();
  await expect(copiar).toBeEnabled();
});

test("sem conta o aviso leva ao /entrar", async ({ page }) => {
  await abrir(page, "/pt/escola/agentes/educador");
  await page.getByLabel("Tema da aula").fill("Como calcular desconto em uma compra");
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
});

test("modo seguro: a conversa e os ensaios não ficam guardados", async ({ page }) => {
  await entrarComo(page, "leitora@local");
  await simularAssistente(page, "Comentário de teste sobre a fala.");
  await abrir(page, "/pt/escola/agentes/oratoria");
  await page.evaluate(() => sessionStorage.setItem("lucia-seguro", "1"));
  await page.reload();
  await page.getByLabel("Texto da sua fala").fill("a".repeat(60));
  await page.locator("[data-segundos]").fill("30");
  await page.locator("[data-medir]").click();
  await page.getByRole("button", { name: "Pedir o comentário" }).click();
  await expect(page.getByText("Comentário de teste sobre a fala.")).toBeVisible({ timeout: 15_000 });
  const guardado = await page.evaluate(() => [localStorage.getItem("lucia:escola-privado:conversas"), localStorage.getItem("lucia:escola-privado:ensaios")]);
  expect(guardado).toEqual([null, null]);
});

test("360 px sem rolagem lateral nas páginas dos agentes", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const caminho of ["", "/entrevista", "/oratoria", "/papelada", "/turma", "/educador", "/revisao", "/traducao"]) {
    await abrir(page, `/pt/escola/agentes${caminho}`);
    const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(larguras[0], caminho).toBeLessThanOrEqual(larguras[1]);
  }
});
