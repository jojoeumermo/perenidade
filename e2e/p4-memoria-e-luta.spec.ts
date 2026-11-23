// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, grupo memória e luta (itens 43, 44, 115, 116, 119 e 121), com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim
// e as flags ligadas; nada vai a banco nenhum). No computador e em 390 px:
//   - /alumia/memoria-da-luta: registrar uma vitória; abrir a campanha e pôr um documento na linha do tempo; enviar uma memória com
//     o consentimento escolhido (ela vai para a fila, não para o arquivo); "Eu apareço aqui: quero sair" tira a memória na hora;
//     o podcast mostra o RSS;
//   - /alumia/desafio: cinco perguntas, a pontuação fica só no aparelho (uma chave, só o dia de hoje) e não sai em pedido nenhum;
//   - o quadro "Neste dia na luta" no topo da linha (a resposta do /api/neste-dia é fixada no teste) e o "fechar por hoje";
//   - nada passa da largura, todo alvo de toque tem 44 px e, com movimento reduzido, nada fica animando;
//   - nenhum pedido sai para outro endereço que não o do próprio site.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-memoria-e-luta --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-memoria-e-luta'
//    npx next dev --webpack -p <porta>)

const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, a.ml-link, input[type="checkbox"], input[type="radio"], select';

async function alvosPequenos(page: Page, dentro: string): Promise<string[]> {
  return page.evaluate(({ seletor, dentro }) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
      if (!el.closest(dentro)) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
      const alvo = (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && el.closest("label")) || el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) saida.push(`${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return saida;
  }, { seletor: ALVOS, dentro });
}

async function conferirTela(page: Page, dentro: string) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
  expect(await alvosPequenos(page, dentro), "alvos de toque de pelo menos 44 px").toEqual([]);
  const rodando = await page.evaluate((d) =>
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest(d)).length, dentro);
  expect(rodando, "nada animando com movimento reduzido").toBe(0);
}

/** Vigia os pedidos: nenhum a outro endereço; e guarda os corpos que saem, para conferir que a pontuação não vai a lugar nenhum. */
function vigiar(page: Page) {
  const fora: string[] = [];
  const corpos: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    const base = new URL(process.env.BASE_URL ?? "http://localhost:3100").origin;
    if (u.protocol.startsWith("http") && u.origin !== base) fora.push(u.origin);
    const corpo = r.postData();
    if (corpo) corpos.push(`${u.pathname} ${corpo}`);
  });
  return { fora, corpos };
}

async function abrir(page: Page, rota: string, titulo: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resposta = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(resposta?.status() ?? 0, "a tela abre").toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible({ timeout: 120_000 });
  await aceitarTermos(page);
}

/** A prévia entra como quem ainda não aceitou os termos em vigor (P5, A6), a cada carga da página: aceita e segue. */
async function aceitarTermos(page: Page) {
  const aceitar = page.getByRole("button", { name: "Aceitar e continuar" });
  if (await aceitar.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)) {
    await page.locator(".le-reaceite input[type=checkbox]").check();
    await aceitar.click();
    await expect(aceitar).toBeHidden();
  }
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function confirmarJanela(page: Page) {
  const janela = page.getByRole("dialog");
  await expect(janela).toBeVisible();
  await janela.getByRole("button").last().click();
  await expect(janela).toBeHidden();
}

async function memoriaDaLuta(page: Page) {
  const { fora } = vigiar(page);
  await abrir(page, "/pt/alumia/memoria-da-luta", "Memória da luta");
  const abas = page.getByRole("tablist", { name: "Partes da memória da luta" });
  await expect(abas.getByRole("tab")).toHaveCount(4);

  // 116. Vitórias: a de exemplo, e registrar uma nova.
  await expect(page.getByRole("heading", { name: "Prédio da rua do Carmo vira moradia popular" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar uma vitória" }).click();
  const formVitoria = page.getByRole("form", { name: "Registrar uma vitória" });
  await formVitoria.getByLabel("Título").fill("Escola do bairro reaberta");
  await formVitoria.getByLabel("Data").fill("2025-02-10");
  await formVitoria.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Vitória registrada.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escola do bairro reaberta" })).toBeVisible();
  const mural = await page.locator(".ml-lista").first().innerText();
  expect(mural, "o mural não diz quem registrou").not.toMatch(/@|registrad[oa] por/i);
  await conferirTela(page, ".ml-pagina");

  // 115. Campanhas: abrir a de exemplo e pôr um documento na linha do tempo.
  await abas.getByRole("tab", { name: "Campanhas" }).click();
  await page.getByRole("button", { name: "Ver a linha do tempo" }).first().click();
  const linha = page.getByRole("list", { name: "Linha do tempo de Moradia já" });
  await expect(linha.getByRole("listitem")).toHaveCount(3);
  const formItem = page.getByRole("form", { name: "Pôr na linha do tempo" });
  await formItem.getByLabel("Tipo").selectOption("documento");
  await formItem.getByLabel("Título").fill("Abaixo-assinado entregue");
  await formItem.getByLabel("Endereço do documento (https)").fill("https://exemplo.org/abaixo-assinado.pdf");
  await formItem.getByLabel(/^Data/).fill("2023-08-01");
  await formItem.getByRole("button", { name: "Pôr na linha do tempo" }).click();
  await expect(linha.getByRole("listitem")).toHaveCount(4);
  // A linha do tempo fica em ordem de data: 2022 (ofício), 2022 (memória), 2023 (o novo), 2024 (vitória).
  await expect(linha.getByRole("listitem").nth(2)).toContainText("Abaixo-assinado entregue");
  const doc = linha.getByRole("listitem").nth(2).getByRole("link", { name: "Abrir" });
  await expect(doc).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await conferirTela(page, ".ml-pagina");
  await page.getByRole("button", { name: /Voltar às campanhas/ }).click();

  // 44. Arquivo vivo: enviar com consentimento (vai para a fila), e "quero sair" tira a publicada na hora.
  await abas.getByRole("tab", { name: "Arquivo vivo" }).click();
  await expect(page.getByRole("heading", { name: "A primeira noite da ocupação" })).toBeVisible();
  await page.getByRole("button", { name: "Enviar uma memória" }).click();
  const formMemoria = page.getByRole("form", { name: "Enviar uma memória" });
  await formMemoria.getByLabel("Título").fill("A assembleia na escada");
  await formMemoria.getByLabel("Texto").fill("Decidimos ficar, todo mundo junto, na escada do prédio.");
  await formMemoria.getByLabel("Não aparece ninguém (nem nome, nem rosto)").check();
  await formMemoria.getByRole("button", { name: "Enviar uma memória" }).click();
  await expect(page.getByText("Memória enviada. Ela aparece depois que a mediação conferir.")).toBeVisible();
  const fila = page.locator("div.ml-bloco", { has: page.getByRole("heading", { name: "Esperando a mediação" }) });
  await expect(fila.getByRole("heading", { name: "A assembleia na escada" })).toBeVisible();
  await page.getByRole("button", { name: "Eu apareço aqui: quero sair" }).first().click();
  await confirmarJanela(page);
  await expect(page.getByText("A memória saiu do arquivo.")).toBeVisible();
  await expect(page.locator(".ml-lista").last().getByRole("heading", { name: "A primeira noite da ocupação" })).toHaveCount(0);
  await conferirTela(page, ".ml-pagina");

  // 119. Podcasts: o podcast de exemplo tem o RSS, com o aviso do que sai.
  await abas.getByRole("tab", { name: "Podcasts" }).click();
  await page.getByRole("button", { name: "Ver os episódios" }).first().click();
  await expect(page.getByRole("link", { name: "Assinar por RSS" })).toHaveAttribute("href", "/api/rede/podcast/vozes-da-ocupacao");
  await expect(page.getByText(/sem o texto do post e sem quem publicou/)).toBeVisible();
  await conferirTela(page, ".ml-pagina");

  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

async function desafio(page: Page) {
  const { fora, corpos } = vigiar(page);
  await abrir(page, "/pt/alumia/desafio", "Desafio do dia");
  await expect(page.getByRole("note").filter({ hasText: "A sua pontuação fica só neste aparelho" })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("alumia-desafio-do-dia"));
  await page.getByRole("button", { name: "Desafio do dia" }).click();
  for (let n = 1; n <= 5; n++) {
    await expect(page.getByText(`Pergunta ${n} de 5`)).toBeVisible();
    await page.getByRole("group", { name: "Qual é o termo?" }).getByRole("button").first().click();
    await expect(page.getByText(/^(Certo!|Era “.+”\.)$/)).toBeVisible();
    await conferirTela(page, ".ml-pagina");
    await page.getByRole("button", { name: n < 5 ? "Próxima" : "Ver o resultado" }).click();
  }
  await expect(page.getByText(/Você já fez o desafio de hoje: \d de 5\./)).toBeVisible();
  const guardado = await page.evaluate(() => ({ chaves: Object.keys(localStorage).filter((k) => k.includes("desafio")), valor: localStorage.getItem("alumia-desafio-do-dia") }));
  expect(guardado.chaves, "uma chave só no aparelho").toEqual(["alumia-desafio-do-dia"]);
  expect(Object.keys(JSON.parse(guardado.valor ?? "{}")).sort(), "só o dia, os acertos e o total: nada de sequência").toEqual(["acertos", "dia", "total"]);
  expect(corpos.filter((c) => /acertos|pontua/.test(c)), "a pontuação não sai do aparelho").toEqual([]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Você já fez o desafio de hoje/)).toBeVisible({ timeout: 120_000 });
  await aceitarTermos(page);
  await page.getByRole("button", { name: "Apagar a pontuação deste aparelho" }).click();
  await expect(page.getByText("Pontuação apagada.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("alumia-desafio-do-dia"))).toBeNull();
  await conferirTela(page, ".ml-pagina");
  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

async function nesteDia(page: Page) {
  // A resposta do /api/neste-dia fica fixa (o servidor buscaria a Wikipédia, com cache; o aparelho nunca fala com ela).
  await page.route("**/api/neste-dia**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dia: "20/11", fatos: [{ ano: 1695, texto: "Zumbi dos Palmares é morto em combate.", link: "https://pt.wikipedia.org/wiki/Zumbi_dos_Palmares" }] }) }));
  const { fora } = vigiar(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/pt/alumia", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("alumia-neste-dia-fechado"));
  await page.reload({ waitUntil: "domcontentloaded" });
  const quadro = page.getByRole("complementary", { name: /Neste dia na luta/ });
  await expect(quadro).toBeVisible({ timeout: 120_000 });
  await aceitarTermos(page);
  await expect(quadro).toContainText("1695. Zumbi dos Palmares é morto em combate.");
  await expect(quadro.getByRole("link", { name: "Fonte" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await conferirTela(page, ".ml-quadro");
  await quadro.getByRole("button", { name: "Fechar por hoje" }).click();
  await expect(quadro).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("alumia-neste-dia-fechado")), "só a data de hoje fica no aparelho").toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

test.describe("Memória e luta", () => {
  test.setTimeout(400_000);

  test.describe("no computador", () => {
    test.use({ viewport: { width: 1280, height: 900 } });
    test("memória da luta", async ({ page }) => memoriaDaLuta(page));
    test("desafio do dia", async ({ page }) => desafio(page));
    test("neste dia na luta", async ({ page }) => nesteDia(page));
  });

  test.describe("em 390 px", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    test("memória da luta", async ({ page }) => memoriaDaLuta(page));
    test("desafio do dia", async ({ page }) => desafio(page));
    test("neste dia na luta", async ({ page }) => nesteDia(page));
  });
});
