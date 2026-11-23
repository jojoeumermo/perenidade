// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, grupo "presença e print" (itens 1, 6 e 9), na prévia com dados de exemplo (nada vai a banco nenhum): no dublê da prévia,
// todo story vem protegido e @faisca protege a foto e aparece como "ativo recentemente" (lib/rede/cliente-presenca-print.ts).
//   item 1  o conteúdo protegido some quando a janela perde o foco, volta com o foco e não pode ser copiado nem arrastado; marca
//           d'água e aviso fixo; a autora protege o próprio story pelo menu;
//   item 6  "ativo recentemente" no perfil; as escolhas nos Ajustes, desligadas por padrão, com alvos de 44 px;
//   item 9  três toques na marca fazem o Sair rápido.
// No computador e em 390 px, com movimento reduzido. Rodar:
//   NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-stories,alumia-org,alumia-p4-presenca-print' \
//     npx next dev --webpack -p <porta>
//   BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-presenca-print --project=computador

const TAMANHOS = [
  { nome: "computador", viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false },
  { nome: "390 px", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
] as const;

/** Simula a janela saindo da frente e voltando (o "blur" e o "focus" da janela). */
const perderFoco = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("blur")));
const ganharFoco = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

/** Copiar e arrastar no elemento protegido são barrados (o evento chega cancelado). */
async function barrados(page: Page, seletor: string): Promise<boolean[]> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return [false];
    return ["copy", "cut", "dragstart", "contextmenu"].map((tipo) => {
      const ev = new Event(tipo, { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
  }, seletor);
}

/** A janela dos termos (P5, A6) bloqueia a tela até o aceite: na prévia, aceita (só na memória da aba). */
async function aceitarOsTermos(page: Page) {
  const janela = page.locator(".le-janela-fundo");
  if (!(await janela.isVisible().catch(() => false))) {
    await page.waitForTimeout(1500);
    if (!(await janela.isVisible().catch(() => false))) return;
  }
  await janela.locator("input[type=checkbox]").check();
  await janela.getByRole("button", { name: "Aceitar e continuar" }).click();
  await expect(janela).toBeHidden();
}

/** Nenhuma animação rodando com movimento reduzido. */
const animando = (page: Page) => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest("[data-p4-protegido], .p4-capa, .p4-marca, [data-p4-ajustes]")).length);

for (const tam of TAMANHOS) {
  test.describe(`presença e print (${tam.nome})`, () => {
    test.use({ viewport: tam.viewport, isMobile: tam.isMobile, hasTouch: tam.hasTouch });
    test.setTimeout(240_000);

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("perfil: ativo recentemente e a foto protegida", async ({ page }) => {
      await page.goto("/pt/alumia/u/faisca");
      await expect(page.locator("[data-p4-recente]")).toHaveText("ativo recentemente");
      const rosto = page.locator(".pf-rosto-moldura[data-p4-protegido]");
      await expect(rosto).toBeVisible();
      await expect(rosto.locator(".p4-marca span").first()).toHaveText("Você (prévia)");
      expect(await barrados(page, ".pf-rosto-moldura[data-p4-protegido]")).toEqual([true, true, true, true]);
      await perderFoco(page);
      await expect(rosto).toHaveAttribute("data-p4-escondido", "");
      await expect(rosto.locator(".p4-capa")).toBeVisible();
      await ganharFoco(page);
      await expect(rosto).not.toHaveAttribute("data-p4-escondido", "");
      expect(await animando(page)).toBe(0);
    });

    test("story protegido: some fora de foco, não copia, tem aviso", async ({ page }) => {
      await page.goto("/pt/alumia/stories?ver=rosavermelha&i=0");
      const tela = page.locator(".al-st-tela[data-p4-protegido]");
      await expect(tela).toBeVisible();
      await expect(tela.locator(".p4-aviso-fixo")).toContainText("Não impede uma foto da tela com outro celular");
      await expect(tela.locator(".p4-aviso-fixo")).toContainText("mais fraca");
      expect(await barrados(page, ".al-st-tela[data-p4-protegido]")).toEqual([true, true, true, true]);
      // Copiar pelo teclado também não leva o texto: a seleção está desligada no conteúdo protegido.
      expect(await tela.evaluate((el) => getComputedStyle(el).userSelect)).toBe("none");
      await perderFoco(page);
      await expect(tela).toHaveAttribute("data-p4-escondido", "");
      await expect(tela.locator(".p4-capa")).toBeVisible();
      await expect(tela.locator(".al-st-topo")).toBeHidden();
      await ganharFoco(page);
      await expect(tela).not.toHaveAttribute("data-p4-escondido", "");
      expect(await animando(page)).toBe(0);
    });

    test("a autora protege e desprotege o próprio story pelo menu", async ({ page }) => {
      // Na prévia, o story da própria pessoa que já existe é o do destaque "Atos" (os meus stories no ar começam vazios).
      await page.goto("/pt/alumia/stories?destaque=ex-dest-meu");
      await expect(page.locator(".al-st-tela[data-p4-protegido]")).toBeVisible();
      await aceitarOsTermos(page);
      await page.locator(".al-st-topo button[aria-haspopup=menu]").click();
      const item = page.getByRole("menuitem", { name: "Tirar a proteção deste story" });
      await expect(item).toBeVisible();
      await item.click();
      await expect(page.locator(".al-st-recado")).toHaveText("A proteção deste story foi tirada.");
      await expect(page.locator(".al-st-tela")).not.toHaveAttribute("data-p4-protegido", "");
      await page.locator(".al-st-topo button[aria-haspopup=menu]").click();
      await page.getByRole("menuitem", { name: "Proteger este story" }).click();
      await expect(page.locator(".al-st-tela[data-p4-protegido]")).toBeVisible();
    });

    test("ajustes: as duas escolhas, desligadas por padrão, com alvos de 44 px", async ({ page }) => {
      await page.goto("/pt/alumia/seguranca");
      await aceitarOsTermos(page);
      const secao = page.locator("[data-p4-ajustes]");
      await expect(secao).toBeVisible();
      const presenca = secao.getByRole("checkbox", { name: /ativo recentemente/ });
      const foto = secao.getByRole("checkbox", { name: /Proteger minha foto de perfil/ });
      await expect(presenca).not.toBeChecked();
      await expect(foto).not.toBeChecked();
      for (const rotulo of await secao.locator("label.p4-escolha").all()) {
        const caixa = await rotulo.boundingBox();
        expect(caixa && caixa.height >= 44 && caixa.width >= 44, "alvo de toque de 44 px").toBe(true);
      }
      await presenca.check();
      await expect(presenca).toBeChecked();
      await presenca.uncheck();
      await expect(presenca).not.toBeChecked();
      await expect(secao).toContainText("Ninguém é avisado de print");
      const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
      expect(largura.conteudo).toBeLessThanOrEqual(largura.tela + 1);
    });

    test("três toques na marca fazem o Sair rápido", async ({ page }) => {
      // O Sair rápido vai para uma página neutra de fora (lib/modo-seguro.ts, DESTINO_NEUTRO): aqui ela é respondida localmente.
      await page.route("https://www.google.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>neutro</title>" }));
      await page.goto("/pt/alumia");
      await aceitarOsTermos(page);
      const marca = page.locator(tam.isMobile ? "header a.al2-alvo" : "a.al2-menu-marca").first();
      await expect(marca).toBeVisible();
      await marca.click();
      await marca.click();
      await Promise.all([page.waitForURL((u) => u.host === "www.google.com", { timeout: 30_000 }), marca.click()]);
      expect(new URL(page.url()).host).toBe("www.google.com");
    });

    test("dois toques só levam ao Início", async ({ page }) => {
      // No Início: a marca leva ao mesmo lugar, e a janela dos termos da prévia (que volta a cada tela nova) não entra no meio.
      await page.goto("/pt/alumia");
      await aceitarOsTermos(page);
      const marca = page.locator(tam.isMobile ? "header a.al2-alvo" : "a.al2-menu-marca").first();
      await marca.click();
      await marca.click();
      await page.waitForTimeout(1500);
      await marca.click();
      await page.waitForTimeout(800);
      expect(new URL(page.url()).pathname).toBe("/pt/alumia");
    });
  });
}
