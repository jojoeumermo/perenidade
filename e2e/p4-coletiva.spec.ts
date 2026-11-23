// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, lote ação coletiva (Parte F: itens 89 a 100 e 122 a 126), com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim
// e as flags ligadas; nada vai a banco nenhum). No computador e em 390 px, /alumia/acao-coletiva, aba por aba:
//   - Comunidade: "Eu mandei" na pressão (o total sobe; o e-mail abre no aparelho), uma carta para a mediação, responder o
//     questionário (o relatório só somado) e entrar no rodízio (só as próprias vezes);
//   - Atos: marcar um selo de acessibilidade, reservar vagas na ciranda, a previsão do tempo (a resposta da nossa rota é fixada no
//     teste) e o panfleto com QR, desenhado no aparelho;
//   - Projetos de lei: seguir um projeto (a lista fica só no aparelho; a resposta da nossa rota é fixada) e parar de seguir;
//   - Documentos: o pedido pela LAI com o prazo contado, montado no aparelho;
//   - Organizações: a chave Pix oficial, a sala de imprensa, a vitrine, os links e a frente;
//   - Pouso e filiação: oferecer pouso (só a pessoa e a gestão veem);
//   - nada passa da largura, todo alvo de toque tem 44 px e, com movimento reduzido, nada fica animando;
//   - nenhum pedido sai para outro endereço que não o do próprio site.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-coletiva --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-coletiva'
//    npx next dev --webpack -p <porta>)

const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, a.ac-link, input[type="checkbox"], input[type="radio"], select';

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

async function conferirTela(page: Page) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
  expect(await alvosPequenos(page, ".ac-pagina"), "alvos de toque de pelo menos 44 px").toEqual([]);
  const rodando = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest(".ac-pagina")).length);
  expect(rodando, "nada animando com movimento reduzido").toBe(0);
}

function vigiar(page: Page) {
  const fora: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    const base = new URL(process.env.BASE_URL ?? "http://localhost:3100").origin;
    if (u.protocol.startsWith("http") && u.origin !== base) fora.push(u.origin);
  });
  return fora;
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

async function acaoColetiva(page: Page) {
  const fora = vigiar(page);
  // As duas rotas do servidor respondem com dados fixos (o servidor de verdade buscaria nos dados abertos e no Open-Meteo).
  await page.route("**/api/rede/coletiva/tempo**", (r) => r.fulfill({ json: { previsao: { dia: "", maxima: 31, minima: 24, chuva: 80, codigo: 95, tipo: "temporal" }, cidade: "Recife", fonte: "https://open-meteo.com/" } }));
  await page.route("**/api/rede/coletiva/radar**", (r) => r.fulfill({ json: { situacao: { chave: "camara:PL:1234:2024", titulo: "PL 1234/2024", ementa: "Dispõe sobre a moradia popular.", situacao: "Aguardando Parecer", orgao: "CDU", quando: "2026-11-10T10:00", link: "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=1" } } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resposta = await page.goto("/pt/alumia/acao-coletiva", { waitUntil: "domcontentloaded" });
  expect(resposta?.status() ?? 0, "a tela abre").toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1, name: "Ação coletiva" })).toBeVisible({ timeout: 120_000 });
  await aceitarTermos(page);
  const abas = page.getByRole("tablist", { name: "Partes da ação coletiva" });
  await expect(abas.getByRole("tab")).toHaveCount(6);

  // 89. Pressão: o e-mail abre no aparelho e "Eu mandei" sobe o total (12 → 13).
  await expect(page.getByText("12 pessoas já mandaram")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mandar e-mail: dep\.fulana@camara\.leg\.br/ })).toHaveAttribute("href", /^mailto:dep\.fulana@camara\.leg\.br\?subject=/);
  await page.getByRole("button", { name: "Eu mandei" }).click();
  await expect(page.getByText("13 pessoas já mandaram")).toBeVisible();
  await expect(page.getByRole("button", { name: "Desfazer" })).toHaveAttribute("aria-pressed", "true");
  // 92. Cartas: escrever uma; ela fica esperando a mediação.
  await page.getByRole("button", { name: "Escrever uma carta" }).first().click();
  await page.getByRole("form", { name: "Escrever uma carta" }).getByLabel("Texto").fill("Rafael, a ocupação inteira está com você. Força!");
  await page.getByRole("button", { name: "Mandar para a mediação" }).click();
  await expect(page.getByText("esperando a mediação")).toBeVisible();
  // 93. Questionário: responder; o relatório mostra "menos de 3" onde a contagem é pequena.
  const quest = page.getByRole("form", { name: "Como está o bairro" });
  await quest.getByLabel("Sim").check();
  await quest.getByRole("button", { name: "Mandar respostas" }).click();
  await expect(page.getByText("Você já respondeu. Obrigada.")).toBeVisible();
  await expect(page.getByText("Não: menos de 3")).toBeVisible();
  // 122. Rodízio: entrar mostra só as próprias vezes.
  await page.getByRole("button", { name: "Entrar no rodízio" }).click();
  await expect(page.getByRole("heading", { name: "Suas próximas vezes" })).toBeVisible();
  await conferirTela(page);

  // 95, 96, 97 e 94. Atos.
  await abas.getByRole("tab", { name: "Atos" }).click();
  await page.getByRole("button", { name: /Fica Esperança · Recife/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Fica Esperança" })).toBeVisible();
  await page.getByLabel("Banheiro").check();
  await page.locator('[data-item="95"]').getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByLabel("Banheiro")).toBeChecked();
  await expect(page.getByText("Sobram 6 vagas")).toBeVisible();
  await page.getByLabel("Vagas para as suas crianças").fill("2");
  await page.getByRole("button", { name: "Reservar" }).click();
  await expect(page.getByText("Sobram 4 vagas")).toBeVisible();
  await expect(page.getByText("Temporal")).toBeVisible();
  await expect(page.getByText("Chance de chuva: 80%")).toBeVisible();
  await page.getByRole("button", { name: "Fazer o panfleto" }).click();
  const panfleto = page.getByRole("img", { name: "Panfleto do ato Fica Esperança, com o QR da página do ato" });
  await expect(panfleto).toBeVisible();
  expect(await panfleto.getAttribute("src"), "o panfleto é desenhado aqui, em SVG").toMatch(/^data:image\/svg\+xml/);
  await conferirTela(page);

  // 90. Projetos de lei: a lista fica só no aparelho.
  await abas.getByRole("tab", { name: "Projetos de lei" }).click();
  await page.getByLabel("Projeto (ex.: PL 1234/2024)").fill("PL 1234/2024");
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByText("Dispõe sobre a moradia popular.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lucia:rede:radar"))).toContain("camara:PL:1234:2024");
  await expect(page.getByRole("link", { name: "Ver na fonte" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await conferirTela(page);
  await page.getByRole("button", { name: "Parar de seguir" }).click();
  await expect(page.getByText("Você não segue nenhum projeto.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lucia:rede:radar")), "parar de seguir apaga do aparelho").toBeNull();

  // 91. Documentos: o pedido pela LAI, montado aqui.
  await abas.getByRole("tab", { name: "Documentos" }).click();
  await page.getByLabel("Para quem").fill("Secretaria Municipal de Habitação");
  await page.getByLabel("O pedido ou o relato").fill("Quantas famílias estão na fila do aluguel social?");
  const doc = page.getByLabel("Documento pronto", { exact: true });
  await expect(doc).toContainText("Lei nº 12.527/2011");
  await expect(doc).toContainText("Secretaria Municipal de Habitação");
  await expect(page.getByText(/Se mandar hoje, a resposta vence em/)).toBeVisible();
  await conferirTela(page);

  // 100, 124, 125, 126 e 123. Organizações.
  await abas.getByRole("tab", { name: "Organizações" }).click();
  await page.getByRole("button", { name: "@lume" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Coletivo Lume" })).toBeVisible();
  await expect(page.getByText("12.345.678/0001-90").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Site" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await expect(page.getByRole("heading", { name: "Cooperativa Raiz Forte" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Frente pela Moradia" }).click();
  await expect(page.getByRole("heading", { name: "Atos da frente" })).toBeVisible();
  const frente = await page.locator('[data-item="123"]').innerText();
  expect(frente, "a frente não diz quem gere").not.toMatch(/gerid[oa] por|Pessoa \d/i);
  await conferirTela(page);

  // 98. Pouso: oferecer; só a pessoa e a gestão veem.
  await abas.getByRole("tab", { name: "Pouso e filiação" }).click();
  const pouso = page.locator('[data-item="98"]');
  await pouso.getByLabel("Cidade").fill("Recife");
  await pouso.getByLabel("Quantas pessoas").fill("2");
  await pouso.getByRole("button", { name: "Salvar" }).click();
  await expect(pouso.getByRole("heading", { name: "Seus pedidos e ofertas" })).toBeVisible();
  await expect(page.getByText("A filiação passa por revisão jurídica antes de ser ligada.")).toBeVisible();
  await conferirTela(page);

  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

test.describe("Ação coletiva", () => {
  test.setTimeout(400_000);

  test.describe("no computador", () => {
    test.use({ viewport: { width: 1280, height: 900 } });
    test("ação coletiva", async ({ page }) => acaoColetiva(page));
  });

  test.describe("em 390 px", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    test("ação coletiva", async ({ page }) => acaoColetiva(page));
  });
});
