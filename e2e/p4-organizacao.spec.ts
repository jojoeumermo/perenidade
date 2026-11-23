// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, itens 52 a 67 e 122: Organizar (/alumia/organizar) com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim e as
// flags ligadas; nada vai a banco nenhum). No computador e em 390 px, cada parte abre e:
//   - organização: quadro, horário, reuniões, consenso (as posições e o "menos de 3"), orçamento, metas (a soma escondida com menos
//     de 3 pessoas) e inventário (pegar e devolver, sem com quem);
//   - comunidade: ofereço e preciso (o pedido sob codinome), vagas e bicos, banco de tempo (o saldo só seu) e pontos de apoio (o como
//     chegar abre fora sem levar a página de origem);
//   - rota do ato: o desenho sem mapa de fundo e o guardar no aparelho (na chave que o Sair rápido apaga);
//   - território, apoio direto e ata assistida;
//   - nada passa da largura, todo alvo de toque tem 44 px (a caixa de marcar conta pelo rótulo inteiro, que é onde se toca), nada anima
//     com movimento reduzido e nenhum pedido sai para outro endereço.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-organizacao --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-organizacao'
//    npx next dev --webpack -p <porta>)

const ROTA = "/pt/alumia/organizar";
const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, a.or-link, input[type="checkbox"], input[type="radio"], select';

async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
      if (!el.closest(".or-pagina")) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
      // A caixa de marcar dentro de um rótulo: o alvo é o rótulo inteiro.
      const alvo = el instanceof HTMLInputElement && el.closest("label") ? (el.closest("label") as HTMLElement) : el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) saida.push(`${el.tagName} "${(el.getAttribute("aria-label") || alvo.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return saida;
  }, ALVOS);
}

async function conferirTela(page: Page, onde: string) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect(largura.conteudo, `nada passa da largura (${onde})`).toBeLessThanOrEqual(largura.tela + 1);
  expect(await alvosPequenos(page), `alvos de toque de pelo menos 44 px (${onde})`).toEqual([]);
  const rodando = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest(".or-pagina")).length,
  );
  expect(rodando, `nada animando com movimento reduzido (${onde})`).toBe(0);
}

async function percorrer(page: Page) {
  const fora: string[] = [];
  const base = new URL(process.env.BASE_URL ?? "http://localhost:3100").origin;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.origin !== base) fora.push(u.origin);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resposta = await page.goto(ROTA);
  expect(resposta?.status() ?? 0, "a tela abre").toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1, name: "Organizar" })).toBeVisible({ timeout: 120_000 });
  const aceitar = page.getByRole("button", { name: "Aceitar e continuar" });
  if (await aceitar.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await page.locator(".le-reaceite input[type=checkbox]").check();
    await aceitar.click();
    await expect(aceitar).toBeHidden();
  }
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const or = page.locator(".or-pagina");
  const aba = (nome: string) => or.getByRole("tab", { name: nome, exact: true });
  const titulo = (nome: string) => or.getByRole("heading", { level: 2, name: nome });

  // ── A organização ──
  await expect(aba("Organização")).toHaveAttribute("aria-selected", "true");
  for (const [sub, h2] of [["Quadro", "Quadro da organização"], ["Horário", "Enquete de horário"], ["Reuniões", "Reuniões recorrentes"]] as const) {
    await aba(sub).click();
    await expect(titulo(h2)).toBeVisible();
    await conferirTela(page, sub);
  }
  // 60. Consenso
  await aba("Consenso").click();
  await expect(titulo("Consenso por posições")).toBeVisible();
  const festa = or.locator(".or-cartao").filter({ hasText: "festa junina" });
  await festa.getByRole("button", { name: "Bloqueio" }).click();
  await expect(festa.getByText("Você já se posicionou.")).toBeVisible();
  const megafone = or.locator(".or-cartao").filter({ hasText: "megafone novo" });
  await expect(megafone.getByText("Houve consenso: ninguém bloqueou.")).toBeVisible();
  await expect(megafone.getByText(/Me abstenho: menos de 3/)).toBeVisible();
  await conferirTela(page, "consenso");
  // 61. Orçamento
  await aba("Orçamento").click();
  await expect(titulo("Orçamento participativo")).toBeVisible();
  await or.getByLabel(/Caixa de som para os atos/).check();
  await or.getByRole("button", { name: "Apoiar as marcadas (até 3)" }).click();
  await expect(or.getByText(/Apoio contado/)).toBeVisible();
  await conferirTela(page, "orçamento");
  // 62. Metas
  await aba("Metas").click();
  await expect(titulo("Meta coletiva")).toBeVisible();
  await expect(or.getByText(/320 panfletos \(64%\)/)).toBeVisible();
  await expect(or.locator(".or-cartao").filter({ hasText: "abaixo-assinado" }).getByText(/Menos de 3 pessoas somaram/)).toBeVisible();
  await conferirTela(page, "metas");
  // 57. Inventário
  await aba("Inventário").click();
  await expect(titulo("Inventário solidário")).toBeVisible();
  const mega = or.locator(".or-cartao").filter({ hasText: "Megafone" });
  await mega.getByRole("button", { name: "Peguei uma" }).click();
  await expect(mega.getByText("0 de 2 disponíveis")).toBeVisible();
  expect(await mega.innerText(), "nunca com quem está").not.toMatch(/com @|está com|codinome/i);
  await conferirTela(page, "inventário");

  // ── A comunidade ──
  await aba("Comunidade").click();
  await expect(titulo("Ofereço e preciso")).toBeVisible();
  await expect(or.getByRole("link", { name: "Combinar com Girassol" })).toHaveAttribute("href", "/pt/alumia/u/girassol");
  await or.getByRole("button", { name: "Pôr um pedido" }).click();
  await or.getByLabel("Título").fill("Empresto uma escada");
  await or.getByRole("button", { name: "Salvar" }).click();
  await expect(or.getByText("Pedido posto no mural.")).toBeVisible();
  await conferirTela(page, "mural");
  await aba("Vagas e bicos").click();
  await expect(titulo("Vagas e bicos solidários")).toBeVisible();
  await expect(or.getByText("Vaga na cooperativa de costura")).toBeVisible();
  await expect(or.getByText("Ajuda na mudança no sábado")).toBeHidden();
  await conferirTela(page, "vagas");
  await aba("Banco de tempo").click();
  await expect(titulo("Banco de tempo")).toBeVisible();
  await expect(or.getByText("Só você vê este número.")).toBeVisible();
  await or.getByRole("button", { name: "Confirmar" }).click();
  await conferirTela(page, "banco de tempo");
  await aba("Pontos de apoio").click();
  await expect(titulo("Pontos de apoio")).toBeVisible();
  const chegar = or.getByRole("link", { name: "Como chegar" }).first();
  await expect(chegar).toHaveAttribute("href", /^https:\/\/www\.openstreetmap\.org\/search\?query=/);
  await expect(chegar).toHaveAttribute("rel", /noreferrer/);
  await conferirTela(page, "pontos");

  // ── 59. Rota do ato ──
  await aba("Rota do ato").click();
  await expect(titulo("Rota do ato")).toBeVisible();
  await or.getByRole("combobox", { name: /^Ato/ }).selectOption({ index: 1 });
  await expect(or.locator("svg.or-mapa").first()).toBeVisible();
  await expect(or.locator("svg.or-mapa image, iframe")).toHaveCount(0);
  await or.getByRole("button", { name: "Guardar neste aparelho" }).click();
  await expect(or.getByText(/Guardada\./)).toBeVisible();
  const guardado = await page.evaluate(() => Object.keys(localStorage).filter((k) => /organizar/i.test(k)));
  expect(guardado, "a rota fica numa chave que o Sair rápido apaga").toEqual(["lucia:rede:organizar:rotas"]);
  await conferirTela(page, "rota");

  // ── 64, 65, 67 ──
  await aba("Território").click();
  await expect(titulo("Termômetro do território")).toBeVisible();
  await or.getByLabel("Cidade").fill("São Paulo");
  await or.getByLabel("UF").selectOption("SP");
  await or.getByRole("button", { name: "Ver os lugares" }).click();
  await expect(or.getByText("Nota 2,3 de 5 (12 avaliações)")).toBeVisible();
  await expect(or.getByRole("button", { name: "Texto da denúncia coletiva" })).toBeVisible();
  await conferirTela(page, "território");
  await aba("Apoio direto").click();
  await expect(titulo("Apoio direto a quem produz")).toBeVisible();
  await conferirTela(page, "apoio");
  await aba("Ata assistida").click();
  await expect(titulo("Ata assistida")).toBeVisible();
  await or.getByLabel("Falas").fill("Abrimos às sete. Decidimos levar a faixa.");
  await or.getByRole("button", { name: "Montar o rascunho da ata" }).click();
  await expect(or.getByLabel("Rascunho da ata")).toHaveValue(/Encaminhamentos:\n- Decidimos levar a faixa\./);
  await conferirTela(page, "ata");

  // As setas do teclado andam entre as abas de cima.
  await aba("Ata assistida").focus();
  await page.keyboard.press("ArrowRight");
  await expect(aba("Organização")).toHaveAttribute("aria-selected", "true");

  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

test.describe("Organizar", () => {
  test.setTimeout(300_000);

  test("no computador", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await percorrer(page);
  });

  test.describe("em 390 px", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    test("no celular", async ({ page }) => {
      await percorrer(page);
    });
  });
});
