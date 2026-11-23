// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Locator, type Page } from "@playwright/test";

// A conversa em grupo (recurso "alumia-chat-grupo"), com a prévia de dados de exemplo (nada vai a banco nenhum; o dublê de
// lib/rede/chat/grupo/exemplos.ts responde). No computador (1440 px) e no celular (390 px):
//   - a página Conversas mostra os grupos junto das conversas a dois: o convite recebido (entrar), criar um grupo, abrir o grupo;
//   - no grupo: mandar mensagem (com prazo e ver uma vez), quem está (o @ conferido, o código de segurança, sem número abaixo de 3),
//     convidar pelo @ (só quem tem conversa a dois), tirar alguém, sair;
//   - a janela flutuante lista os grupos e abre o grupo ao lado das conversas a dois (no celular, em tela cheia);
//   - alvos de 44 px; nada passa da largura.
// Capturas em CAPTURAS (ou no diretório de saída do Playwright).
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/chat-grupo --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-chat-grupo' npx next dev --webpack -p <porta>)

test.setTimeout(300_000);
const CAPTURAS = process.env.CAPTURAS ?? "";

async function foto(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png` });
}

async function entrar(page: Page, caminho: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
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

async function alvo(onde: Locator, nome: string | RegExp) {
  const caixa = await onde.getByRole("button", { name: nome }).first().boundingBox();
  expect.soft(caixa && caixa.width >= 44 && caixa.height >= 44, `alvo de 44 px: ${String(nome)}`).toBe(true);
}

async function semSobra(page: Page) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect.soft(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
}

for (const [nome, tela] of [
  ["computador 1440", { width: 1440, height: 900 }],
  ["celular 390", { width: 390, height: 844 }],
] as const) {
  test(`grupos na página Conversas, ${nome}`, async ({ page }) => {
    await page.setViewportSize(tela);
    await entrar(page, "/pt/alumia/conversas");
    const grupos = page.locator("[data-chat-grupos]");
    await expect(grupos.getByRole("heading", { name: "Grupos", exact: true })).toBeVisible();
    // Os grupos junto das conversas a dois.
    await expect(grupos.getByRole("button", { name: /Núcleo Zona Leste/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Rosa Vermelha/ }).first()).toBeVisible();
    await expect(grupos.getByText("4 pessoas")).toBeVisible();
    await expect(grupos.getByText("@liaquilombo convidou você para o grupo “Brigada da Horta”")).toBeVisible();
    await alvo(grupos, "Entrar");
    await alvo(grupos, /Núcleo Zona Leste/);
    await semSobra(page);
    await foto(page, `grupo-${tela.width}-1-lista`);

    // Entrar no grupo do convite: ele aparece na lista (com 3 pessoas, a contagem aparece).
    await grupos.getByRole("button", { name: "Entrar" }).click();
    await expect(grupos.getByRole("button", { name: /Brigada da Horta/ })).toBeVisible();

    // Criar um grupo: abre o grupo novo; com uma pessoa, nenhum número.
    await grupos.getByRole("button", { name: "Criar grupo" }).click();
    await grupos.getByRole("textbox", { name: "Nome do grupo" }).fill("Comissão do Sarau");
    await foto(page, `grupo-${tela.width}-2-criar`);
    await grupos.getByRole("button", { name: "Criar", exact: true }).click();
    const conversa = page.locator("[data-conversa-grupo]");
    await expect(conversa.getByRole("heading", { name: "Comissão do Sarau" })).toBeVisible();
    await expect(conversa.getByText(/\d+ pessoas/)).toHaveCount(0);

    // Convidar: só quem tem conversa a dois aberta.
    await conversa.getByRole("button", { name: "Convidar" }).click();
    await conversa.getByRole("textbox", { name: "@ da pessoa" }).fill("@ninguem_aqui");
    await conversa.getByRole("button", { name: "Mandar o convite" }).click();
    await expect(conversa.getByText(/abra antes uma conversa a dois/)).toBeVisible();
    await conversa.getByRole("textbox", { name: "@ da pessoa" }).fill("@rosavermelha");
    await conversa.getByRole("button", { name: "Mandar o convite" }).click();
    await expect(conversa.getByText("Convite mandado para @rosavermelha. A pessoa aceita ou recusa no aparelho dela.")).toBeVisible();
    await foto(page, `grupo-${tela.width}-3-convidar`);
    await conversa.getByRole("button", { name: "Voltar" }).click();

    // Abrir o grupo de exemplo: mensagens com o @ de quem escreveu; mandar com prazo e ver uma vez.
    await grupos.getByRole("button", { name: /Núcleo Zona Leste/ }).click();
    await expect(conversa.getByText("Levo as faixas. Alguém leva água?")).toBeVisible();
    await expect(conversa.getByText("@liaquilombo").first()).toBeVisible();
    await conversa.getByRole("combobox").selectOption("1");
    await conversa.getByRole("checkbox", { name: "Ver uma vez" }).check();
    await conversa.getByRole("textbox", { name: "Mensagem para o grupo" }).fill("Mensagem cifrada para o núcleo");
    await conversa.getByRole("button", { name: "Enviar" }).click();
    await expect(conversa.getByText("Mensagem cifrada para o núcleo")).toBeVisible();
    await alvo(conversa, "Enviar");
    await alvo(conversa, "Quem está");
    await semSobra(page);
    await foto(page, `grupo-${tela.width}-4-conversa`);

    // Quem está: o @ conferido, o código de segurança, tirar alguém (só quem administra).
    await conversa.getByRole("button", { name: "Quem está" }).click();
    const pessoas = conversa.locator("[data-pessoa-grupo]");
    await expect(pessoas).toHaveCount(4);
    await expect(conversa.getByText("@ conferido no registro público das chaves").first()).toBeVisible();
    await pessoas.filter({ hasText: "@rosavermelha" }).getByRole("button", { name: "Ver o código" }).click();
    await expect(conversa.locator("[data-codigo-grupo]")).toContainText("Código de segurança com @rosavermelha");
    await semSobra(page);
    await foto(page, `grupo-${tela.width}-5-quem-esta`);
    await pessoas.filter({ hasText: "@saradograjau" }).getByRole("button", { name: "Tirar do grupo" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tirar", exact: true }).click();
    await expect(pessoas).toHaveCount(3);
    await expect(conversa.getByText("3 pessoas").first()).toBeVisible();

    // Sair do grupo: confirma e volta à lista, sem o grupo.
    await conversa.getByRole("button", { name: "Sair do grupo" }).click();
    await foto(page, `grupo-${tela.width}-6-sair`);
    await page.getByRole("dialog").getByRole("button", { name: "Sair", exact: true }).click();
    await expect(grupos.getByRole("button", { name: /Núcleo Zona Leste/ })).toHaveCount(0);
    await expect(grupos.getByRole("button", { name: /Brigada da Horta/ })).toBeVisible();
  });
}

test("grupos na janela flutuante, computador 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, "/pt/alumia");
  await page.getByRole("button", { name: "Abrir as conversas" }).click();
  const lista = page.getByRole("region", { name: "Conversas" });
  await expect(lista.getByRole("button", { name: /Núcleo Zona Leste/ })).toBeVisible();
  await expect(lista.getByRole("button", { name: /Rosa Vermelha/ })).toBeVisible();
  // A busca filtra os grupos também.
  const busca = lista.getByRole("textbox", { name: "Buscar ou começar conversa" });
  await busca.fill("zona");
  await expect(lista.getByRole("button", { name: /Núcleo Zona Leste/ })).toBeVisible();
  await expect(lista.getByRole("button", { name: /Rosa Vermelha/ })).toHaveCount(0);
  await busca.fill("");
  // O grupo abre ao lado de uma conversa a dois.
  await lista.getByRole("button", { name: /Rosa Vermelha/ }).click();
  await lista.getByRole("button", { name: /Núcleo Zona Leste/ }).click();
  const grupo = page.getByRole("region", { name: "Grupo Núcleo Zona Leste" });
  await expect(grupo).toBeVisible();
  await expect(page.getByRole("region", { name: "Conversa com Rosa Vermelha" })).toBeVisible();
  await expect(grupo.getByText("Combinado. Até sábado!")).toBeVisible();
  await grupo.getByRole("textbox", { name: "Mensagem para o grupo" }).fill("Da janela flutuante");
  await grupo.getByRole("button", { name: "Enviar" }).click();
  await expect(grupo.getByText("Da janela flutuante")).toBeVisible();
  for (const n of ["Minimizar a conversa com Grupo Núcleo Zona Leste", "Fechar a conversa com Grupo Núcleo Zona Leste"]) await alvo(grupo, n);
  await semSobra(page);
  await foto(page, "grupo-janela-1440");
  // Minimizar e restaurar sem perder o rascunho.
  await grupo.getByRole("textbox", { name: "Mensagem para o grupo" }).fill("rascunho do grupo");
  await grupo.getByRole("button", { name: "Minimizar a conversa com Grupo Núcleo Zona Leste" }).first().click();
  await grupo.getByRole("button", { name: "Abrir a conversa com Grupo Núcleo Zona Leste" }).click();
  await expect(grupo.getByRole("textbox", { name: "Mensagem para o grupo" })).toHaveValue("rascunho do grupo");
  await grupo.getByRole("button", { name: "Fechar a conversa com Grupo Núcleo Zona Leste" }).click();
  await expect(grupo).toHaveCount(0);
});

test("grupos na janela flutuante, celular 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, "/pt/alumia");
  await page.getByRole("button", { name: "Abrir as conversas" }).click();
  const janela = page.getByRole("dialog", { name: "Conversas" });
  await expect(janela.getByRole("button", { name: /Núcleo Zona Leste/ })).toBeVisible();
  await semSobra(page);
  await foto(page, "grupo-janela-390-lista");
  await janela.getByRole("button", { name: /Núcleo Zona Leste/ }).click();
  const grupo = page.getByRole("dialog", { name: "Grupo Núcleo Zona Leste" });
  await expect(grupo).toBeVisible();
  await expect(grupo.getByText("Combinado. Até sábado!")).toBeVisible();
  await alvo(grupo, "Voltar");
  await alvo(grupo, "Enviar");
  await semSobra(page);
  await foto(page, "grupo-janela-390-conversa");
  await grupo.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByRole("dialog", { name: "Conversas" })).toBeVisible();
});
