// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, lote descoberta e estudo: /alumia/descobrir (itens 45, 46, 49, 50, 51) e /alumia/estudar (48, 68 a 73, 101 a 103) com a
// prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim e as flags ligadas; nada vai a banco nenhum). No computador e em 390 px:
//   - cada aba abre e faz o essencial (seguir uma linha pelo código, um #tema de fora, montar o endereço do RSS, marcar estudo, um
//     cartão de revisão, uma fonte com citação, uma microlição, um simulado da turma até o resultado em faixa, um par de mentoria e
//     o glossário);
//   - nada passa da largura, todo alvo de toque tem 44 px, nada anima com movimento reduzido e nenhum pedido sai para outro endereço.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-descoberta-estudo --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-descoberta-estudo'
//    npx next dev --webpack -p <porta>)

const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, input[type="checkbox"], input[type="radio"], select';

async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
      if (!el.closest(".de-pagina")) continue;
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
      // O termo do glossário é um botão dentro da frase (alvo em linha, a exceção do WCAG 2.5.8); a caixa de marcar conta pelo rótulo.
      if (el.classList.contains("de-termo-botao")) continue;
      const alvo = (el instanceof HTMLInputElement && el.closest("label")) || el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) saida.push(`${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return saida;
  }, ALVOS);
}

async function conferirTela(page: Page, onde: string) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect(largura.conteudo, `nada passa da largura (${onde})`).toBeLessThanOrEqual(largura.tela + 1);
  expect(await alvosPequenos(page), `alvos de toque de pelo menos 44 px (${onde})`).toEqual([]);
  const rodando = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target instanceof Element && ((a.effect as KeyframeEffect).target as Element).closest(".de-pagina")).length,
  );
  expect(rodando, `nada animando com movimento reduzido (${onde})`).toBe(0);
}

async function abrir(page: Page, rota: string, titulo: string, fora: string[]) {
  const base = new URL(process.env.BASE_URL ?? "http://localhost:3100").origin;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith("http") && u.origin !== base) fora.push(u.origin);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resposta = await page.goto(rota);
  expect(resposta?.status() ?? 0, "a tela abre").toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible({ timeout: 120_000 });
  // A prévia entra como quem ainda não aceitou os termos em vigor (P5, A6): aceita e segue.
  const aceitar = page.getByRole("button", { name: "Aceitar e continuar" });
  if (await aceitar.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)) {
    await page.locator(".le-reaceite input[type=checkbox]").check();
    await aceitar.click();
    await expect(aceitar).toBeHidden();
  }
}

const aba = (page: Page, nome: string) => page.getByRole("tab", { name: nome, exact: true });

test.describe("Prompt 4: descoberta e estudo", () => {
  test.setTimeout(240_000);

  for (const [nome, largura] of [["computador", 1280], ["390 px", 390]] as const) {
    test(`Descobrir (${nome})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const fora: string[] = [];
      await abrir(page, "/pt/alumia/descobrir", "Descobrir", fora);

      await expect(page.getByRole("link", { name: /#passelivre/ })).toBeVisible();
      await page.getByText("Como contamos isso?").click();
      await expect(page.getByText(/pelo menos 3 comunidades diferentes/)).toBeVisible();
      await conferirTela(page, `assuntos, ${nome}`);

      await aba(page, "Linhas").click();
      await page.getByLabel("O código que recebeu").fill("0a1b2c3d4e5f");
      await page.getByRole("button", { name: "Seguir", exact: true }).click();
      await expect(page.getByText(/"Moradia e transporte" está nas suas linhas/)).toBeVisible();
      await conferirTela(page, `linhas, ${nome}`);

      await aba(page, "Fediverso").click();
      await page.getByLabel("Seguir um #tema").fill("#greve");
      await page.getByRole("button", { name: "Seguir", exact: true }).click();
      await expect(page.getByText("Ato marcado para sábado. #greve")).toBeVisible();
      await expect(page.getByRole("link", { name: "Abrir em exemplo.social" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
      await conferirTela(page, `fediverso, ${nome}`);

      await aba(page, "RSS e Atom").click();
      await page.getByLabel("Qual #tema").fill("greve");
      await expect(page.getByText(/\/api\/rede\/rss\/t\/greve$/)).toBeVisible();
      await expect(page.getByText(/\/api\/rede\/atom\/t\/greve$/)).toBeVisible();
      await conferirTela(page, `feeds, ${nome}`);

      await aba(page, "Fim da linha").click();
      await page.getByLabel("Parar a linha quando eu estiver em dia").check();
      await expect(page.getByText("Pronto: a linha vai parar quando você estiver em dia.")).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("lucia:p4-de:em-dia"))).toBe("true");
      await conferirTela(page, `fim da linha, ${nome}`);

      expect(fora, "nenhum pedido a outro endereço").toEqual([]);
    });

    test(`Estudar (${nome})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const fora: string[] = [];
      await abrir(page, "/pt/alumia/estudar", "Estudar", fora);

      await page.getByRole("button", { name: "+15 min" }).click();
      await expect(page.getByText("Hoje: 15 min.")).toBeVisible();
      await conferirTela(page, `ritmo, ${nome}`);

      await aba(page, "Baralhos").click();
      await page.getByLabel("Frente (a pergunta)").fill("Capital do Acre?");
      await page.getByLabel("Verso (a resposta)").fill("Rio Branco");
      await page.getByRole("button", { name: "Guardar o cartão" }).click();
      await page.getByRole("button", { name: "Ver a resposta" }).click();
      await expect(page.getByText("Rio Branco", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Fácil" }).click();
      await expect(page.getByText(/Nada para revisar hoje/)).toBeVisible();
      await conferirTela(page, `baralhos, ${nome}`);

      await aba(page, "Fontes").click();
      await page.getByLabel("Autoria (um nome por linha, ou a instituição)").fill("Paulo Freire");
      await page.getByLabel("Título", { exact: true }).fill("Pedagogia do oprimido");
      await page.getByLabel("Ano", { exact: true }).fill("1987");
      await page.getByRole("button", { name: "Guardar na estante" }).click();
      await expect(page.getByText("(FREIRE, 1987)")).toBeVisible();
      await conferirTela(page, `fontes, ${nome}`);

      await aba(page, "Segurança digital").click();
      await page.getByLabel("cadeira laranja sobe devagar").check();
      await expect(page.getByText(/^Isso\./)).toBeVisible();
      await conferirTela(page, `microlições, ${nome}`);

      await aba(page, "Inscrições").click();
      for (const p of ["ENEM", "SISU", "ProUni", "FIES", "Encceja"]) await expect(page.getByRole("heading", { name: p, exact: true })).toBeVisible();
      await conferirTela(page, `inscrições, ${nome}`);

      await aba(page, "Editais").click();
      await expect(page.getByText("Bolsa de iniciação científica (exemplo)")).toBeVisible();
      await conferirTela(page, `editais, ${nome}`);

      await aba(page, "Redação").click();
      await expect(page.getByText("Esta semana ainda não tem correção de referência.")).toBeVisible();
      await conferirTela(page, `redação, ${nome}`);

      await aba(page, "Simulado").click();
      await page.getByLabel("Nome do simulado").fill("Simulado de sábado");
      for (const q of ["Quanto é 15% de 200?", "Em que ano foi promulgada a Constituição brasileira em vigor?", "Qual palavra está escrita corretamente?"]) await page.getByRole("checkbox", { name: q }).check();
      await page.getByRole("button", { name: "Abrir o simulado" }).click();
      await page.getByRole("radio", { name: "C) 30" }).check();
      await page.getByRole("button", { name: "Enviar minhas respostas" }).click();
      await expect(page.getByText("Respostas enviadas. Dá para trocar até o fim.")).toBeVisible();
      await page.getByRole("button", { name: "Encerrar agora" }).click();
      await expect(page.getByText("Cerca de metade acertou").first()).toBeVisible();
      await expect(page.getByText(/Você acertou 1 de 3/)).toBeVisible();
      await conferirTela(page, `simulado, ${nome}`);

      await aba(page, "Mentoria").click();
      await page.getByRole("button", { name: "Pedir mentoria" }).click();
      await expect(page.getByText(/Maré \(exemplo\) vai acompanhar você/)).toBeVisible();
      await conferirTela(page, `mentoria, ${nome}`);

      await aba(page, "Glossário").click();
      await page.getByLabel("Buscar um termo").fill("ácido");
      await expect(page.getByText("Ácido", { exact: true })).toBeVisible({ timeout: 30_000 });
      await conferirTela(page, `glossário, ${nome}`);

      expect(fora, "nenhum pedido a outro endereço").toEqual([]);
    });
  }
});
