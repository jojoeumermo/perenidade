// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Organização estudantil da Escola (E4-12, docs/escola/organizacao.md), com as funções do banco SIMULADAS (rotas
// interceptadas): assembleia (estado sem pauta, roda, votação quando a pauta tem candidatas), Roda do semestre que leva
// à ouvidoria sem pôr texto no endereço, ouvidoria (texto curto, envio com protocolo, recusa que não apaga o texto,
// serviço fora, esquecer protocolo), educador do mês vazio e 360 px sem rolagem para o lado.
// Suba o servidor com a Escola ligada e o banco local:
//   NEXT_PUBLIC_RECURSOS=escola npm run dev:local   e depois   BASE_URL=http://localhost:3000 npx playwright test e2e/escola-organizacao
// A votação lê a pauta de content/escola/assembleia.json: com 'candidatas' vazia (o estado de fábrica) os testes de voto
// são pulados; com a pauta preenchida pela coordenação, rodam.
import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { abrir, vigiarErros } from "./ajuda";

const json = (dado: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(dado) });
const pauta = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "escola", "assembleia.json"), "utf8")) as { semestre: string; candidatas: string[] };
const CHAVE_DOS_PROTOCOLOS = "lucia:escola:ouvidoria-protocolos";

async function simularContagens(page: Page, contagens: { alvo: string; total: number }[] = []) {
  const pedidos: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/contar_escola", (rota) => {
    pedidos.push(JSON.parse(rota.request().postData() ?? "{}"));
    return rota.fulfill(json(null));
  });
  await page.route("**/rest/v1/rpc/escola_contagens", (rota) => rota.fulfill(json(contagens)));
  return pedidos;
}

async function simularOuvidoria(page: Page, opcoes: { recusa?: string; publicas?: unknown[] } = {}) {
  const pedidos: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/ouvidoria_enviar", (rota) => {
    pedidos.push(JSON.parse(rota.request().postData() ?? "{}"));
    if (opcoes.recusa) return rota.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: opcoes.recusa }) });
    return rota.fulfill(json({ ok: true, protocolo: "abcd1234" }));
  });
  await page.route("**/rest/v1/rpc/ouvidoria_publicas", (rota) => rota.fulfill(json(opcoes.publicas ?? [])));
  return pedidos;
}

test("assembleia: sem pauta mostra o estado vazio e a Roda do semestre", async ({ page }) => {
  test.skip(pauta.candidatas.length > 0, "a pauta já tem candidatas");
  const erros = vigiarErros(page);
  await simularContagens(page);
  await abrir(page, "/pt/escola/assembleia");
  await expect(page.getByRole("heading", { level: 1, name: "Assembleia estudantil do semestre" })).toBeVisible();
  await expect(page.locator('[data-assembleia-estado="sem-pauta"]')).toContainText("ainda não publicou a pauta");
  await expect(page.getByRole("heading", { name: "Roda do semestre" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Faça a assembleia no seu núcleo" })).toBeVisible();
  expect(erros).toEqual([]);
});

test("assembleia: marca até 3 trilhas, o 4º botão fica desativado e o voto chama contar_escola", async ({ page }) => {
  test.skip(pauta.candidatas.length < 4, "precisa de uma pauta com pelo menos 4 candidatas");
  const erros = vigiarErros(page);
  const pedidos = await simularContagens(page);
  await abrir(page, "/pt/escola/assembleia");
  await page.getByLabel("Entendi: o voto não pode ser desfeito").check();
  for (const t of pauta.candidatas.slice(0, 3)) await page.locator(`[data-votar="${t}"]`).click();
  await expect(page.locator(`[data-votar="${pauta.candidatas[3]}"]`)).toBeDisabled();
  expect(pedidos.map((p) => p.p_alvo)).toEqual(pauta.candidatas.slice(0, 3).map((t) => `${pauta.semestre}/${t}`));
  expect(pedidos[0]).toMatchObject({ p_tipo: "assembleia_voto" });
  await page.reload();
  await expect(page.locator(`[data-trilha="${pauta.candidatas[0]}"]`)).toHaveAttribute("data-votado", "sim");
  await expect(page.locator(`[data-votar="${pauta.candidatas[0]}"]`)).toHaveCount(0);
  expect(erros).toEqual([]);
});

test("Roda do semestre gera o texto e 'Levar à ouvidoria' preenche o campo sem pôr nada na URL", async ({ page }) => {
  const erros = vigiarErros(page);
  await simularContagens(page);
  await simularOuvidoria(page);
  await abrir(page, "/pt/escola/assembleia");
  await page.getByLabel("O que funcionou neste semestre?").fill("As aulas curtas no celular.");
  await expect(page.locator("[data-roda-folha]")).toContainText("As aulas curtas no celular.");
  await page.getByLabel("O que travou?").fill("Falou Maria Aparecida Souza.");
  await expect(page.locator("[data-roda-aviso-nome]")).toBeVisible();
  await page.locator("[data-roda-levar]").click();
  await expect(page).toHaveURL(/\/pt\/escola\/ouvidoria\?sobre=escola$/);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#ouv-sobre")).toHaveValue("escola");
  await page.locator("[data-ouvidoria-usar-roda]").click();
  await expect(page.locator("#ouv-texto")).toHaveValue(/As aulas curtas no celular\./);
  expect(page.url()).not.toContain("aulas");
  expect(erros).toEqual([]);
});

test("ouvidoria: texto curto não envia; envio mostra o protocolo e grava no aparelho", async ({ page }) => {
  const erros = vigiarErros(page);
  const pedidos = await simularOuvidoria(page);
  await abrir(page, "/pt/escola/ouvidoria");
  await page.locator("#ouv-texto").fill("curto");
  await page.locator("[data-ouvidoria-enviar]").click();
  await expect(page.locator("[data-ouvidoria-erro]")).toContainText("pelo menos 10");
  expect(pedidos).toEqual([]);
  await page.locator("#ouv-texto").fill("A aula de matemática travou no celular.");
  await page.locator("[data-ouvidoria-enviar]").click();
  await expect(page.locator("[data-ouvidoria-protocolo]")).toContainText("ABCD1234");
  expect(pedidos[0]).toMatchObject({ p: { sobre: "escola", texto: "A aula de matemática travou no celular.", site: "" } });
  const guardado = await page.evaluate((k) => localStorage.getItem(k), CHAVE_DOS_PROTOCOLOS);
  expect(JSON.parse(guardado ?? "[]")[0]).toMatchObject({ protocolo: "abcd1234", sobre: "escola" });
  await expect(page.locator('[data-protocolo="abcd1234"]')).toContainText("Recebida");
  expect(erros).toEqual([]);
});

test("ouvidoria: recusa 'muitos_pedidos' mostra a mensagem sem apagar o texto", async ({ page }) => {
  await simularOuvidoria(page, { recusa: "muitos_pedidos" });
  await abrir(page, "/pt/escola/ouvidoria");
  await page.locator("#ouv-texto").fill("Quero sugerir um curso novo de eletricidade.");
  await page.locator("[data-ouvidoria-enviar]").click();
  await expect(page.locator("[data-ouvidoria-erro]")).toContainText("Muitos envios em pouco tempo");
  await expect(page.locator("#ouv-texto")).toHaveValue("Quero sugerir um curso novo de eletricidade.");
});

test("ouvidoria: serviço fora do ar avisa e não gera erro no console", async ({ page }) => {
  const erros = vigiarErros(page);
  await page.route("**/rest/v1/rpc/ouvidoria_enviar", (rota) => rota.abort("failed"));
  await page.route("**/rest/v1/rpc/ouvidoria_publicas", (rota) => rota.abort("failed"));
  await abrir(page, "/pt/escola/ouvidoria");
  await expect(page.locator("[data-publicas-vazio]")).toContainText("Ainda não há respostas públicas");
  await page.locator("#ouv-texto").fill("Mensagem que não vai sair agora.");
  await page.locator("[data-ouvidoria-enviar]").click();
  await expect(page.locator("[data-ouvidoria-erro]")).toBeVisible();
  await expect(page.locator("#ouv-texto")).toHaveValue("Mensagem que não vai sair agora.");
  expect(erros).toEqual([]);
});

test("meus protocolos: mostra a resposta pública e 'Esquecer este protocolo' só apaga do aparelho", async ({ page }) => {
  await simularOuvidoria(page, {
    publicas: [{ protocolo: "abcd1234", sobre: "curso", resumo_publico: "Pediram mais exemplos.", resposta_publica: "Vamos acrescentar exemplos.", respondida_em: "2026-11-02T12:00:00Z" }],
  });
  await page.addInitScript(
    ([k]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify([{ protocolo: "abcd1234", sobre: "curso", em: "2026-11-01" }, { protocolo: "11112222", sobre: "aula", em: "2026-11-01" }]));
    },
    [CHAVE_DOS_PROTOCOLOS],
  );
  await abrir(page, "/pt/escola/ouvidoria");
  await expect(page.locator('[data-protocolo="abcd1234"] [data-protocolo-respondida]')).toContainText("Respondida em 2026-11-02");
  await expect(page.locator('[data-protocolo="11112222"]')).toContainText("Recebida");
  await page.locator('[data-protocolo-esquecer="11112222"]').click();
  await expect(page.locator('[data-protocolo="11112222"]')).toHaveCount(0);
  await expect(page.locator('[data-protocolo="abcd1234"]')).toBeVisible();
});

test("educador do mês vazio mostra o estado vazio com o link da ouvidoria", async ({ page }) => {
  const erros = vigiarErros(page);
  await abrir(page, "/pt/escola/educador-do-mes");
  await expect(page.getByRole("heading", { level: 1, name: "Educador ou educadora do mês" })).toBeVisible();
  await expect(page.locator("[data-educador-vazio]")).toBeVisible();
  await expect(page.locator("[data-educador-indicar]")).toHaveAttribute("href", "/pt/escola/ouvidoria?sobre=educador");
  expect(erros).toEqual([]);
});

test("360 px: nenhuma página da organização rola para o lado e o foco é visível", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await simularContagens(page);
  await simularOuvidoria(page);
  for (const caminho of ["/pt/escola/assembleia", "/pt/escola/ouvidoria", "/pt/escola/educador-do-mes"]) {
    await abrir(page, caminho);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura, caminho).toBeLessThanOrEqual(360);
  }
  await abrir(page, "/pt/escola/ouvidoria");
  await page.locator("#ouv-texto").focus();
  const contorno = await page.locator("#ouv-texto").evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(contorno).not.toBe("none");
});
