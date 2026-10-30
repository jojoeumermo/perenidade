// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test } from "@playwright/test";
import { abrir } from "./ajuda";

// O aplicativo num Galaxy S24: tela de 1080 × 2340 com densidade 3, isto é, 360 × 780 pontos. Dentro do aplicativo, a
// barra de notificações e a de navegação do Android ficam de fora (o WebView recua), sobram uns 360 × 716. O navegador
// se anuncia como o WebView do aplicativo ("; wv)" e InstitutoLuciaApp), que é o que liga o visual de aplicativo.
// Nada pode passar da largura da tela: rolar para o lado é o defeito mais visível no celular.
const S24 = { width: 360, height: 716 };
const UA = "Mozilla/5.0 (Linux; Android 14; SM-S921B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 InstitutoLuciaApp/2";

test.use({ viewport: S24, userAgent: UA, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const PAGINAS = [
  "/pt",
  "/pt/laboratorios",
  "/pt/laboratorios/design",
  "/pt/laboratorios/eletrica",
  "/pt/laboratorios/escritorio",
  "/pt/laboratorios/ia",
  "/pt/laboratorios/ide",
  "/pt/laboratorios/jogos",
  "/pt/laboratorios/linux",
  "/pt/laboratorios/modelos",
  "/pt/laboratorios/montador",
  "/pt/laboratorios/planilha",
  "/pt/laboratorios/quimica",
  "/pt/laboratorios/redes",
  "/pt/laboratorios/seguranca",
  "/pt/laboratorios/simulacoes",
  "/pt/ao-vivo",
];

for (const caminho of PAGINAS) {
  test(`S24 no aplicativo, sem rolar para o lado: ${caminho}`, async ({ page }, info) => {
    await abrir(page, caminho);
    await page.waitForTimeout(1500);
    // Menus de abrir e fechar (como "Exercícios" do laboratório de redes) também precisam caber: abre todos antes de medir.
    await page.evaluate(() => document.querySelectorAll("main details").forEach((d) => d.setAttribute("open", "")));
    await page.screenshot({ path: info.outputPath("tela.png"), fullPage: false });
    // O que passa da largura: a página toda e, para achar o culpado, os elementos que vazam para a direita.
    const medida = await page.evaluate(() => {
      const largura = document.documentElement.clientWidth;
      const vazam: string[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= largura + 1) continue;
        // O texto de um editor de código rola de lado junto com o campo de digitação: linha longa ali é normal.
        if (el.closest("pre, textarea, .cm-editor")) continue;
        // Dentro de algo que rola de lado de propósito (uma tabela, uma faixa de abas ou de cartões) não conta. O que só
        // fica escondido (overflow hidden ou clip) conta: some da tela sem a pessoa conseguir ver.
        let pai = el.parentElement;
        let rolavel = false;
        while (pai && pai !== document.body) {
          const estilo = getComputedStyle(pai);
          if (/(auto|scroll)/.test(estilo.overflowX) && pai.getBoundingClientRect().right <= largura + 1) {
            rolavel = true;
            break;
          }
          pai = pai.parentElement;
        }
        if (rolavel) continue;
        const nome = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".")}`;
        vazam.push(`${nome} (${Math.round(r.right)}px)`);
        if (vazam.length > 12) break;
      }
      return { pagina: document.documentElement.scrollWidth, largura, vazam, app: document.documentElement.hasAttribute("data-app") };
    });
    expect(medida.app, "o site não reconheceu o aplicativo").toBe(true);
    expect(medida.vazam, `vaza para o lado (página com ${medida.pagina}px em ${medida.largura}px)`).toEqual([]);
  });
}

test("S24 no aplicativo: acessibilidade pelo menu Mais, sem botão flutuando por cima do conteúdo", async ({ page }) => {
  await abrir(page, "/pt");
  await expect(page.locator("button[title='Acessibilidade']")).toBeHidden();
  await expect(async () => {
    await page.getByRole("link", { name: "Mais", exact: true }).last().click({ timeout: 5000 });
    await expect(page.getByRole("dialog").getByRole("button", { name: "Acessibilidade" })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90_000 });
  await page.getByRole("dialog").getByRole("button", { name: "Acessibilidade" }).click();
  await expect(page.getByRole("dialog", { name: "Acessibilidade" })).toBeVisible();
});
