// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Onda R3, item 1.2, o aceite do recurso "alumia-chat-so-app": com ele LIGADO, cada página do chat no site mostra só "Para conversar,
// use o app", nenhum pedido vai a /cifra/* (o WebAssembly e os arquivos da cifra) e nenhum pedaço de JavaScript baixado contém os
// marcadores do chat. Com ele DESLIGADO (CHAT_NO_SITE=1), o mesmo teste exige o contrário na página das conversas: é o controle que
// prova que o teste enxerga o chat quando ele vem.
// Rodar (o servidor com a prévia de dados de exemplo, que não fala com banco nenhum):
//   NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-chat-grupo,alumia-chat-so-app' npx next dev -p 3971
//   BASE_URL=http://localhost:3971 npx playwright test e2e/so-app --project=computador
//   (controle: o servidor sem alumia-chat-so-app, e CHAT_NO_SITE=1 no teste)

// Os marcadores do desenho: textos que só existem DENTRO do código do chat. ("core-crypto" não entra: no servidor de
// desenvolvimento o mapa de import() da página cita o NOME do pedaço do motor sem baixá-lo; o que conta é o pedaço não vir, e isso
// é a conferência dos endereços abaixo.)
const MARCADORES = ["alumia/r2/envelope/v1", "proteusEncrypt", "spqr"];
// Endereços que só aparecem se o motor do chat for baixado (o pedaço do core-crypto, o WebAssembly dele e o do SPQR).
const ENDERECOS_DO_CHAT = /core-crypto|wireapp|spqr|\.wasm(\?|$)/;
const PAGINAS_DO_CHAT = ["/pt/alumia/conversas", "/pt/alumia/aparelhos"];
const controle = process.env.CHAT_NO_SITE === "1";

async function abrirEOuvir(page: Page, caminho: string) {
  const cifra: string[] = [];
  const achados: string[] = [];
  const leituras: Promise<void>[] = [];
  page.on("request", (r) => {
    const caminho = new URL(r.url()).pathname;
    if (caminho.startsWith("/cifra/") || ENDERECOS_DO_CHAT.test(caminho)) cifra.push(caminho);
  });
  page.on("response", (r) => {
    const tipo = r.headers()["content-type"] ?? "";
    if (!/javascript|wasm/.test(tipo) && !/\.(m?js|wasm)(\?|$)/.test(r.url())) return;
    leituras.push(
      r.text().then(
        (texto) => {
          for (const m of MARCADORES) if (texto.includes(m)) achados.push(`${m} em ${new URL(r.url()).pathname}`);
        },
        () => undefined,
      ),
    );
  });
  await page.goto(caminho, { waitUntil: "networkidle" });
  // A Rede e o chat vêm por import() depois da primeira pintura: espera assentar.
  await page.waitForTimeout(4000);
  await page.waitForLoadState("networkidle");
  await Promise.all(leituras);
  return { cifra, achados };
}

test.describe("alumia-chat-so-app", () => {
  for (const caminho of PAGINAS_DO_CHAT) {
    test(`${caminho}: ${controle ? "(controle) o chat vem" : "só o aviso, nada do chat"}`, async ({ page }) => {
      const { cifra, achados } = await abrirEOuvir(page, caminho);
      if (controle) {
        if (caminho.endsWith("/conversas")) expect(achados.length + cifra.length, "o controle precisa ver o chat").toBeGreaterThan(0);
        return;
      }
      await expect(page.locator("[data-chat-so-app]")).toBeVisible();
      await expect(page.getByRole("link", { name: "Baixar e conferir o app" })).toHaveAttribute("href", "/pt/alumia/app");
      expect(cifra, "pedidos a /cifra/*").toEqual([]);
      expect(achados, "marcadores do chat no JavaScript baixado").toEqual([]);
    });
  }

  test("/pt/alumia/app: abre, sem nada do chat", async ({ page }) => {
    const { cifra, achados } = await abrirEOuvir(page, "/pt/alumia/app");
    await expect(page.locator("[data-pagina-do-app]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("O app da Alumia");
    expect(cifra).toEqual([]);
    expect(achados).toEqual([]);
    // Nada passa da largura (390 px no celular).
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(largura).toBeLessThanOrEqual(0);
  });
});
