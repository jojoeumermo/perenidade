// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, lote perto (itens 2, 7 e 8), com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim e as flags ligadas; nada vai
// a banco nenhum nem a chat nenhum). No computador e em 390 px:
//   - /alumia/perto: o círculo (a Brasa, que aceitou e tem conversa) e a posição de exemplo que ela compartilha;
//   - compartilhar: "só o bairro" é o padrão, passa pela confirmação, a faixa mostra até quando, e "Parar agora" para;
//   - a faixa fixa aparece em OUTRA tela enquanto compartilha, com o botão de parar;
//   - mandar onde estou uma vez só (ponto de encontro) e pedir a localização da Brasa, cada um com a confirmação;
//   - pedir ajuda: com a confirmação; cancelar a confirmação não manda nada;
//   - volta para casa: começa, conta, e "Cheguei" encerra;
//   - nenhum link para mapa de site de fora (só geo:), nenhum pedido a outro endereço, nenhuma coordenada em pedido nenhum;
//   - nada passa da largura, todo alvo de toque tem 44 px e, com movimento reduzido, nada fica animando.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-perto --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-modo-ato,alumia-p4-perto'
//    npx next dev --webpack -p <porta>)

const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, input[type="checkbox"], input[type="radio"], select';

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

/** Vigia os pedidos: nenhum a outro endereço, e nenhuma coordenada em pedido nenhum (nem na URL nem no corpo). */
function vigiar(page: Page) {
  const fora: string[] = [];
  const comPosicao: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    const base = new URL(process.env.BASE_URL ?? "http://localhost:3100").origin;
    if (u.protocol.startsWith("http") && u.origin !== base) fora.push(u.origin);
    const tudo = `${r.url()} ${r.postData() ?? ""}`;
    if (/-8\.0[0-9]|-34\.8[0-9]/.test(tudo)) comPosicao.push(u.pathname);
  });
  return { fora, comPosicao };
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

async function abrir(page: Page, rota: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resposta = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(resposta?.status() ?? 0, "a tela abre").toBeLessThan(400);
  await aceitarTermos(page);
}

async function responderJanela(page: Page, sim: boolean) {
  const janela = page.getByRole("dialog");
  await expect(janela).toBeVisible();
  await janela.getByRole("button").nth(sim ? -1 : 0).click();
  await expect(janela).toBeHidden();
}

async function perto(page: Page) {
  const { fora, comPosicao } = vigiar(page);
  await abrir(page, "/pt/alumia/perto");
  await expect(page.getByRole("heading", { level: 1, name: "Perto" })).toBeVisible({ timeout: 120_000 });

  // O círculo: a Brasa aceitou e tem conversa (recebe); o Cais não aceitou (não aparece).
  const circulo = page.locator('[data-bloco="pt-circulo"]');
  await expect(circulo.getByText("@brasa")).toBeVisible();
  await expect(circulo.getByText("@cais_do_porto")).toHaveCount(0);

  // Quem compartilha comigo: a posição de exemplo da Brasa, do bairro, perto do Recife (índice local), e só o mapa do aparelho.
  const recebidas = page.locator('[data-bloco="pt-recebidas"]');
  await expect(recebidas.getByRole("heading", { name: "@brasa" })).toBeVisible();
  await expect(recebidas.getByText(/posição do bairro/)).toBeVisible();
  await expect(recebidas.getByRole("link", { name: "Abrir no mapa do aparelho" })).toHaveAttribute("href", /^geo:/);
  expect(await page.locator('.pt-pagina a[href^="http"]').count(), "nenhum link para site de fora").toBe(0);
  await conferirTela(page, ".pt-pagina");

  // 2. Compartilhar: "só o bairro" é o padrão; com a confirmação; a tela diz até quando; parar.
  const comp = page.locator('[data-bloco="pt-compartilhar"]');
  await expect(comp.getByLabel("Só o bairro (cerca de 1 km)")).toBeChecked();
  await comp.getByRole("button", { name: "Começar a compartilhar" }).click();
  await responderJanela(page, true);
  await expect(comp.getByText(/Compartilhando com 1 pessoa\(s\) até \d\d:\d\d\./)).toBeVisible();
  await conferirTela(page, ".pt-pagina");

  // A faixa fixa em outra tela, com o botão de parar.
  await page.getByRole("link", { name: "Escolher contatos no modo ato" }).click();
  const faixa = page.locator("[data-pt-faixa]");
  await expect(faixa).toBeVisible({ timeout: 60_000 });
  // A outra tela também pede o reaceite dos termos na prévia (a janela cobre a faixa até aceitar).
  await aceitarTermos(page);
  await expect(faixa).toContainText(/Você está mostrando sua localização para 1 pessoa\(s\) do seu círculo até \d\d:\d\d\./);
  await conferirTela(page, "[data-pt-vigia]");
  await faixa.getByRole("button", { name: "Parar agora" }).click();
  await expect(faixa).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Perto" })).toBeVisible({ timeout: 60_000 });
  await aceitarTermos(page);
  await expect(page.locator('[data-bloco="pt-compartilhar"]').getByRole("button", { name: "Começar a compartilhar" })).toBeVisible();

  // Ponto de encontro: a posição de agora, uma vez só.
  await page.locator('[data-bloco="pt-compartilhar"]').getByRole("button", { name: "Mandar onde estou agora, uma vez só" }).click();
  await responderJanela(page, true);
  await expect(page.getByText("Posição enviada a 1 pessoa(s). Some em 1 hora.")).toBeVisible();

  // Pedir a localização: chega como pedido.
  await page.locator('[data-bloco="pt-circulo"]').getByRole("button", { name: "Pedir a localização" }).click();
  await responderJanela(page, true);
  await expect(page.getByText("Pedido enviado. Você só recebe se a pessoa aceitar.")).toBeVisible();

  // 7. Pedir ajuda: cancelar a confirmação não manda nada; confirmar manda.
  const sos = page.locator('[data-bloco="pt-sos"]');
  await sos.getByRole("button", { name: "Pedir ajuda" }).click();
  await responderJanela(page, false);
  await expect(sos.getByRole("status")).toHaveCount(0);
  await sos.getByRole("button", { name: "Pedir ajuda" }).click();
  await responderJanela(page, true);
  await expect(sos.getByText("Pedido de ajuda enviado a 1 pessoa(s).")).toBeVisible();

  // 8. Volta para casa: começa, conta, "Cheguei" encerra.
  const volta = page.locator('[data-bloco="pt-volta"]');
  await volta.getByLabel("40 min").check();
  await volta.getByRole("button", { name: "Começar" }).click();
  await expect(volta.getByRole("timer")).toContainText(/Faltam (39|40) min/);
  await conferirTela(page, ".pt-pagina");
  await volta.getByRole("button", { name: "Cheguei", exact: true }).click();
  await expect(volta.getByText("Volta para casa encerrada.")).toBeVisible();

  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
  expect(comPosicao, "nenhuma coordenada em pedido nenhum").toEqual([]);
}

test.describe("Perto", () => {
  test.setTimeout(400_000);

  test.describe("no computador", () => {
    test.use({ viewport: { width: 1280, height: 900 } });
    test("localização, ponto de encontro, pedido, ajuda e volta para casa", async ({ page }) => perto(page));
  });

  test.describe("em 390 px", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    test("localização, ponto de encontro, pedido, ajuda e volta para casa", async ({ page }) => perto(page));
  });
});
