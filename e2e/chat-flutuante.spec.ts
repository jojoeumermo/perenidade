// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// A janela de conversas no canto da Alumia (recurso "alumia-chat-flutuante", ligado por padrão), com a prévia de dados de exemplo
// (nada vai a banco nenhum). No computador (1280 e 1440 px) e no celular (360 e 390 px), no tema escuro e no claro:
//   - o botão no canto abre a lista; a busca filtra e oferece começar conversa pelo @; a conversa abre dentro da janela;
//   - navegar pela Alumia não fecha a janela nem perde o rascunho;
//   - no computador, duas conversas lado a lado; minimizar (botão e Esc), fechar, expandir para a página Conversas;
//   - no celular, a janela ocupa a tela, prende o foco, tem o voltar, e o botão do canto não cobre a barra de baixo;
//   - a página Conversas não mostra "Falta a chave" nem a janela; alvos de 44 px; nada passa da largura.
// Capturas em CAPTURAS (ou no diretório de saída do Playwright).
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/chat-flutuante --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-anexo-cifrado,alumia-p4-conversa' npx next dev --webpack -p <porta>)

test.setTimeout(300_000);
const CAPTURAS = process.env.CAPTURAS ?? "";

async function foto(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png` });
}

async function entrar(page: Page, caminho: string, tema: "escuro" | "claro") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("lucia:rede:aparencia", JSON.stringify({ tema: t, semNumeros: false }));
    } catch {
      // sem armazenamento: fica o tema de sempre
    }
  }, tema);
  await page.goto(caminho);
  await aceitarTermos(page);
}

/** Na prévia, a janela dos termos volta a cada tela montada: aceita de novo (ela toma o foco enquanto está aberta). */
async function aceitarTermos(page: Page) {
  const termos = page.getByRole("dialog", { name: "Leia os termos da Alumia" });
  if (await termos.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await termos.getByRole("checkbox").check();
    await termos.getByRole("button", { name: "Aceitar e continuar" }).click();
    await expect(termos).toBeHidden();
  }
}

async function alvo(page: Page, nome: string | RegExp) {
  const caixa = await page.getByRole("button", { name: nome }).first().boundingBox();
  expect.soft(caixa && caixa.width >= 44 && caixa.height >= 44, `alvo de 44 px: ${String(nome)}`).toBe(true);
}

async function semSobra(page: Page) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect.soft(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
}

for (const [nome, tela, tema] of [
  ["computador 1440", { width: 1440, height: 900 }, "escuro"],
  ["computador 1440 claro", { width: 1440, height: 900 }, "claro"],
] as const) {
  test(`janela de conversas, ${nome}`, async ({ page }) => {
    await page.setViewportSize(tela);
    await entrar(page, "/pt/alumia", tema);
    const botao = page.getByRole("button", { name: "Abrir as conversas" });
    await expect(botao).toBeVisible();
    await alvo(page, "Abrir as conversas");
    await foto(page, `${tela.width}-${tema}-1-botao`);

    // Abre a lista.
    await botao.click();
    const lista = page.getByRole("region", { name: "Conversas" });
    await expect(lista).toBeVisible();
    await expect(lista.getByRole("button", { name: /Rosa Vermelha/ })).toBeVisible();
    await expect(page.getByText("Falta a chave")).toHaveCount(0);
    for (const n of ["Minimizar as conversas", "Fechar as conversas"]) await alvo(page, n);

    // A busca filtra e oferece começar pelo @.
    const busca = lista.getByRole("textbox", { name: "Buscar ou começar conversa" });
    await busca.fill("lia");
    await expect(lista.getByRole("button", { name: /Lia Quilombo/ })).toBeVisible();
    await expect(lista.getByRole("button", { name: /Rosa Vermelha/ })).toHaveCount(0);
    await busca.fill("@pessoa_nova");
    await expect(lista.getByRole("button", { name: "Começar conversa com @pessoa_nova" })).toBeVisible();
    await busca.fill("");

    // Duas conversas lado a lado.
    await lista.getByRole("button", { name: /Rosa Vermelha/ }).click();
    const rosa = page.getByRole("region", { name: "Conversa com Rosa Vermelha" });
    await expect(rosa).toBeVisible();
    await lista.getByRole("button", { name: /Lia Quilombo/ }).click();
    const lia = page.getByRole("region", { name: "Conversa com Lia Quilombo" });
    await expect(lia).toBeVisible();
    const [caixaRosa, caixaLia, caixaLista] = await Promise.all([rosa.boundingBox(), lia.boundingBox(), lista.boundingBox()]);
    expect(caixaLista && caixaLia && caixaRosa && caixaLia.x + caixaLia.width <= caixaLista.x + 1 && caixaRosa.x + caixaRosa.width <= caixaLia.x + 1, "lado a lado, sem se cobrir").toBe(true);
    // O "Sair rápido" (no pé da coluna do menu) continua à vista e clicável.
    const sair = await page.getByRole("button", { name: /Sair rápido/ }).first().boundingBox();
    expect(sair && caixaRosa && sair.x + sair.width <= caixaRosa.x, "a janela não cobre o Sair rápido").toBe(true);
    const campo = rosa.getByRole("textbox").last();
    await campo.fill("rascunho que não pode sumir");
    await semSobra(page);
    await foto(page, `${tela.width}-${tema}-2-duas-conversas`);

    // Navegar pela Alumia não fecha a janela nem perde o rascunho.
    await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>('a[href="/pt/alumia/explorar"]');
      a?.click();
    });
    await page.waitForURL(/\/pt\/alumia\/explorar/);
    await aceitarTermos(page);
    await expect(rosa).toBeVisible();
    await expect(rosa.getByRole("textbox").last()).toHaveValue("rascunho que não pode sumir");
    await foto(page, `${tela.width}-${tema}-3-depois-de-navegar`);

    // Esc dentro da conversa minimiza só ela.
    await rosa.getByRole("textbox").last().focus();
    await page.keyboard.press("Escape");
    await expect(rosa.getByRole("button", { name: "Abrir a conversa com Rosa Vermelha" })).toHaveAttribute("aria-expanded", "false");
    await rosa.getByRole("button", { name: "Abrir a conversa com Rosa Vermelha" }).click();
    await expect(rosa.getByRole("textbox").last()).toHaveValue("rascunho que não pode sumir");

    // Fechar uma conversa.
    await lia.getByRole("button", { name: "Fechar a conversa com Lia Quilombo" }).click();
    await expect(lia).toHaveCount(0);

    // Minimizar a janela: volta o botão (com o foco), com a conta das conversas abertas; abrir de novo traz tudo.
    await lista.getByRole("button", { name: "Minimizar as conversas" }).click();
    await expect(page.getByRole("button", { name: "Abrir as conversas" })).toBeFocused();
    await expect(rosa).toBeHidden();
    await foto(page, `${tela.width}-${tema}-4-minimizada`);
    await page.getByRole("button", { name: "Abrir as conversas" }).click();
    await expect(rosa).toBeVisible();

    // Expandir leva à página Conversas, já na conversa aberta; lá a janela some e não há "Falta a chave".
    await lista.getByRole("link", { name: "Abrir na página Conversas" }).click();
    await page.waitForURL(/\/pt\/alumia\/conversas/);
    await expect(page.getByRole("button", { name: "Abrir as conversas" })).toHaveCount(0);
    await expect(page.locator("[data-chat-flutuante]")).toHaveCount(0);
    await expect(page.getByText("Falta a chave")).toHaveCount(0);
    await foto(page, `${tela.width}-${tema}-5-pagina-conversas`);
  });
}

for (const [nome, tela, tema] of [
  ["390 px", { width: 390, height: 844 }, "escuro"],
  ["360 px claro", { width: 360, height: 740 }, "claro"],
] as const) {
  test(`janela de conversas, celular ${nome}`, async ({ page }) => {
    await page.setViewportSize(tela);
    await entrar(page, "/pt/alumia", tema);
    const botao = page.getByRole("button", { name: "Abrir as conversas" });
    await expect(botao).toBeVisible();
    await alvo(page, "Abrir as conversas");
    // O botão fica acima da barra de baixo, sem cobrir nenhum item dela.
    const barra = await page.locator(".al2-barra-baixo").boundingBox();
    const caixa = await botao.boundingBox();
    expect(barra && caixa && caixa.y + caixa.height <= barra.y + 1, "o botão não cobre a barra de baixo").toBe(true);
    await semSobra(page);
    await foto(page, `${tela.width}-${tema}-1-botao`);

    await botao.click();
    const janela = page.getByRole("dialog", { name: "Conversas" });
    await expect(janela).toBeVisible();
    const tamanho = await janela.boundingBox();
    expect(tamanho && tamanho.width >= tela.width - 1 && tamanho.height >= tela.height - 1, "a janela ocupa a tela inteira").toBe(true);
    await alvo(page, "Fechar as conversas");
    await foto(page, `${tela.width}-${tema}-2-lista`);

    // O foco fica preso na janela.
    for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[data-chat-flutuante]")), "o foco continua na janela").toBe(true);

    // A conversa abre em tela cheia; o voltar leva à lista.
    await janela.getByRole("button", { name: /Rosa Vermelha/ }).click();
    await expect(page.getByRole("dialog", { name: "Conversa com Rosa Vermelha" })).toBeVisible();
    await alvo(page, "Voltar às conversas");
    await semSobra(page);
    await foto(page, `${tela.width}-${tema}-3-conversa`);
    await page.getByRole("button", { name: "Voltar às conversas" }).click();
    await expect(page.getByRole("dialog", { name: "Conversas" })).toBeVisible();

    // Esc minimiza e devolve o foco ao botão.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Abrir as conversas" })).toBeFocused();
    await expect(page.locator("[data-chat-flutuante]")).toBeHidden();
  });
}

for (const [nome, tela] of [
  ["tablet 768 px", { width: 768, height: 1024 }],
  ["computador 1280 px", { width: 1280, height: 800 }],
] as const) {
  test(`janela de conversas, ${nome} (uma conversa ao lado da lista, sem cobrir a barra de baixo nem o Sair rápido)`, async ({ page }) => {
    await page.setViewportSize(tela);
    await entrar(page, "/pt/alumia", "escuro");
    const botao = page.getByRole("button", { name: "Abrir as conversas" });
    await expect(botao).toBeVisible();
    const barraVisivel = await page.locator(".al2-barra-baixo").isVisible();
    const barra = barraVisivel ? await page.locator(".al2-barra-baixo").boundingBox() : null;
    const caixaDoBotao = await botao.boundingBox();
    if (barra) expect(caixaDoBotao && caixaDoBotao.y + caixaDoBotao.height <= barra.y + 1, "o botão não cobre a barra de baixo").toBe(true);
    await botao.click();
    const lista = page.getByRole("region", { name: "Conversas" });
    await expect(lista).toBeVisible();
    await lista.getByRole("button", { name: /Rosa Vermelha/ }).click();
    const rosa = page.getByRole("region", { name: "Conversa com Rosa Vermelha" });
    await expect(rosa).toBeVisible();
    await lista.getByRole("button", { name: /Lia Quilombo/ }).click();
    const lia = page.getByRole("region", { name: "Conversa com Lia Quilombo" });
    await expect(lia).toBeVisible();
    await expect(rosa).toHaveCount(0);
    for (const r of [lista, lia]) {
      const c = await r.boundingBox();
      expect(c && c.x >= 0 && (!barra || c.y + c.height <= barra.y + 1), "a janela fica dentro da tela e acima da barra").toBe(true);
    }
    if (!barra) {
      const sair = await page.getByRole("button", { name: /Sair rápido/ }).first().boundingBox();
      const c = await lia.boundingBox();
      expect(sair && c && sair.x + sair.width <= c.x, "a janela não cobre o Sair rápido").toBe(true);
    }
    await semSobra(page);
    await foto(page, `${tela.width}-escuro-1-janela`);
  });
}

test("a página Conversas sem conversa aberta mostra a lista, não \"Falta a chave\"", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, "/pt/alumia/conversas", "escuro");
  await expect(page.getByRole("button", { name: /Rosa Vermelha/ }).first()).toBeVisible();
  await expect(page.getByText("Falta a chave")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir as conversas" })).toHaveCount(0);
});
