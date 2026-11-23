// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, Parte H: Conta e convivência (/alumia/conta) com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim e as flags
// ligadas; nada vai a banco nenhum). No computador e em 390 px, cada aba abre e:
//   - proteção: o tour sugere um nível, o nível liga e mostra as sugestões; a menção que espera é aprovada; o checkup anda e termina;
//   - atendimento: o horário e a ausência salvam; a resposta rápida entra e fica só no aparelho (na chave que o Sair rápido apaga);
//   - comunidades: guia, quiz, escudo, sala de cuidado e mediação abrem para quem modera;
//   - diário: cria com senha, escreve, fecha, e o que fica no aparelho não tem o texto;
//   - viagem e mudar de servidor abrem;
//   - nada passa da largura, todo alvo de toque tem 44 px, nada anima com movimento reduzido e nenhum pedido sai para outro endereço.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-conta --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-conta'
//    npx next dev --webpack -p <porta>)

const ROTA = "/pt/alumia/conta";
const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, a.ct-link, input[type="checkbox"], input[type="radio"], select';

async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
      if (!el.closest(".ct-pagina")) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
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
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest(".ct-pagina")).length,
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
  await expect(page.getByRole("heading", { level: 1, name: "Conta e convivência" })).toBeVisible({ timeout: 120_000 });
  const aceitar = page.getByRole("button", { name: "Aceitar e continuar" });
  if (await aceitar.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await page.locator(".le-reaceite input[type=checkbox]").check();
    await aceitar.click();
    await expect(aceitar).toBeHidden();
  }
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const ct = page.locator(".ct-pagina");
  const aba = (nome: string) => ct.getByRole("tab", { name: nome, exact: true });
  const titulo = (nome: string) => ct.getByRole("heading", { level: 2, name: nome });

  // ── Proteção (107, 76, 108) ──
  await expect(aba("Proteção")).toHaveAttribute("aria-selected", "true");
  await expect(titulo("Níveis de proteção")).toBeVisible();
  await ct.getByLabel("Estou sofrendo ataque ou perseguição").check();
  await expect(ct.getByText("Sugerido para o seu caso: Máximo.")).toBeVisible();
  await ct.getByRole("button", { name: "Usar o nível Máximo" }).click();
  await expect(ct.getByText("Nível Máximo ligado.")).toBeVisible();
  await expect(ct.getByText(/Trancar o perfil/)).toBeVisible();
  await expect(titulo("Menções")).toBeVisible();
  await expect(ct.getByText("Oi @voce, vem pro ato de sábado?")).toBeVisible();
  await ct.getByRole("button", { name: "Aprovar a menção" }).click();
  await expect(ct.getByText("Nenhuma menção esperando.")).toBeVisible();
  await conferirTela(page, "proteção");
  await ct.getByRole("button", { name: "Começar o checkup" }).click();
  for (let i = 0; i < 6; i++) await ct.getByRole("button", { name: "Próximo passo" }).click();
  await ct.getByRole("button", { name: "Terminar o checkup" }).click();
  await expect(ct.getByText("Checkup feito. Obrigada por cuidar da sua conta.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lucia:rede:conta:checkup")), "a data do checkup fica só no aparelho").toBeTruthy();

  // ── Atendimento (112, 111) ──
  await aba("Atendimento").click();
  await expect(titulo("Horário de atendimento")).toBeVisible();
  await ct.getByLabel("Tenho horário de atendimento").check();
  await ct.getByLabel(/Mensagem de ausência/).fill("Respondo de segunda a sexta.");
  await ct.getByRole("button", { name: "Salvar" }).click();
  await expect(ct.getByText("Salvo.")).toBeVisible();
  await ct.getByLabel("Nova resposta rápida").fill("Obrigada! Te respondo já.");
  await ct.getByRole("button", { name: "Guardar a resposta" }).click();
  await expect(ct.getByText("Obrigada! Te respondo já.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lucia:rede:conta:respostas")), "a resposta fica só no aparelho, na chave que o Sair rápido apaga").toContain("Te respondo");
  await conferirTela(page, "atendimento");

  // ── Comunidades (114, 127, 80, 105, 78) ──
  await aba("Comunidades").click();
  for (const [sub, h] of [["Guia de entrada", "Guia de entrada"], ["Quiz das regras", "Quiz das regras"], ["Escudo", "Escudo contra invasão"], ["Sala de cuidado", "Sala de cuidado"], ["Mediação", "Mediação restaurativa"]] as const) {
    await aba(sub).click();
    await expect(ct.getByRole("heading", { level: 3, name: h })).toBeVisible();
    await conferirTela(page, sub);
  }
  await ct.getByLabel("@ da primeira pessoa").fill("ventania");
  await ct.getByLabel("@ da segunda pessoa").fill("brisa");
  await ct.getByRole("button", { name: "Mandar o convite" }).click();
  await expect(ct.getByText(/Convite mandado/)).toBeVisible();
  await aba("Mediações").click();
  await expect(ct.locator("[data-situacao=convite]")).toBeVisible();
  await conferirTela(page, "mediações");

  // ── Diário (104) ──
  await aba("Diário").click();
  await expect(titulo("Diário privado")).toBeVisible();
  await ct.getByLabel(/Senha do diário/).fill("uma senha longa");
  await ct.getByRole("button", { name: "Criar o diário" }).click();
  await expect(ct.getByLabel("Escrever")).toBeVisible({ timeout: 60_000 });
  await ct.getByLabel("Escrever").fill("Hoje foi um dia difícil.");
  await ct.getByRole("button", { name: "Guardar a entrada" }).click();
  await expect(ct.getByText("Hoje foi um dia difícil.")).toBeVisible();
  const noAparelho = await page.evaluate(() => localStorage.getItem("alumia-diario") ?? "");
  expect(noAparelho.length, "o diário ficou no aparelho").toBeGreaterThan(50);
  expect(noAparelho, "cifrado: o texto não aparece").not.toContain("difícil");
  await conferirTela(page, "diário");
  await ct.getByRole("button", { name: "Fechar o diário" }).click();
  await expect(ct.getByRole("button", { name: "Abrir o diário" })).toBeVisible();

  // ── Viagem (109) e mudar de servidor (74) ──
  await aba("Viagem").click();
  await expect(titulo("Modo viagem")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("alumia-viagem") ?? ""), "o registro do modo viagem existe sempre (fachada)").toContain("marcas");
  await conferirTela(page, "viagem");
  await aba("Mudar de servidor").click();
  await expect(titulo("Mudar de servidor no Fediverso")).toBeVisible();
  await conferirTela(page, "mudar");

  // As setas do teclado andam entre as abas de cima.
  await aba("Mudar de servidor").focus();
  await page.keyboard.press("ArrowRight");
  await expect(aba("Proteção")).toHaveAttribute("aria-selected", "true");

  // 105. A sala marcada aparece em Como a Rede cuida (D7: a página continua), com o CVV.
  await aba("Comunidades").click();
  await aba("Sala de cuidado").click();
  await ct.getByLabel("Esta comunidade é uma sala de cuidado").check();
  await ct.getByRole("button", { name: "Salvar" }).click();
  await expect(ct.getByText("Salvo.")).toBeVisible();
  await page.goto("/pt/alumia/cuidado");
  const salas = page.locator("[data-salas-de-cuidado]");
  await expect(salas).toBeVisible({ timeout: 60_000 });
  await expect(salas).toContainText("188");

  expect([...new Set(fora)], "nenhum pedido a outro endereço").toEqual([]);
}

test.describe("Conta e convivência", () => {
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
