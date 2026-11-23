// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// Prompt 4, criação coletiva (itens 33, 34, 36 e 37): a tela /alumia/criacao na prévia (dublê na memória, nada vai a banco nenhum;
// o banco de verdade e as regras de privacidade estão em scripts/testar-p4-criacao-coletiva.mjs), no computador e em 390 px:
//   - abre com a flag, com as três abas; nada passa da largura, todo alvo de toque tem 44 px, e com "menos movimento" nada se mexe;
//   - a margem: escolher um trecho, anotar, ver a anotação como "sua"; começar um rascunho, sugerir uma troca e aceitar;
//   - o cartaz é desenhado no canvas e baixado como PNG; contraste baixo é barrado antes de gravar;
//   - a zine monta a folha de 8 quadros no aparelho, e "esconder quem escreveu" tira o codinome;
//   - nenhum pedido sai para outro endereço (regra 6).
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/p4-criacao-coletiva --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,alumia-p4-criacao-coletiva' npx next dev --webpack -p <porta>)

const ROTA = "/pt/alumia/criacao";
const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, input[type="checkbox"], select, input:not([type="checkbox"]), textarea';

async function assentar(page: Page) {
  await page.waitForLoadState("load");
  await page.getByRole("heading", { level: 1, name: "Criação coletiva" }).waitFor({ timeout: 120_000 });
  // A prévia pede o reaceite dos termos numa janela que bloqueia a casca: aceita, como a pessoa faria.
  const termos = page.getByRole("dialog", { name: "Leia os termos da Alumia" });
  if (await termos.waitFor({ state: "visible", timeout: 20_000 }).then(() => true, () => false)) {
    await termos.getByRole("checkbox").check();
    await termos.getByRole("button", { name: "Aceitar e continuar" }).click();
    await termos.waitFor({ state: "hidden" });
  }
  await page.waitForFunction(() => document.querySelectorAll('.cc-pagina[aria-busy="true"]').length === 0, null, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`.cc-pagina :is(${seletor})`))) {
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert], .folha-livrinho')) continue;
      const estilo = getComputedStyle(el);
      if (estilo.visibility === "hidden" || estilo.display === "none") continue;
      const alvo = (el instanceof HTMLInputElement && el.type === "checkbox" && el.closest("label")) || el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) saida.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return saida;
  }, ALVOS);
}

async function conferirTela(page: Page) {
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
  expect.soft(largura.conteudo, "nada passa da largura").toBeLessThanOrEqual(largura.tela + 1);
  expect.soft(await alvosPequenos(page), "alvos de toque de pelo menos 44 px").toEqual([]);
  const rodando = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running")
    .map((a) => (a.effect as KeyframeEffect | null)?.target as Element | null).filter((el) => el?.closest(".cc-pagina")).map((el) => el?.className ?? "?"));
  expect.soft(rodando, "com menos movimento, nada fica se mexendo").toEqual([]);
}

/** Seleciona um trecho do texto da página, como a pessoa faria com o dedo ou o mouse. */
async function selecionar(page: Page, trecho: string) {
  await page.evaluate((t) => {
    const el = document.querySelector(".cc-corpo")!;
    const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let feito = 0;
    const alvo = (el.textContent ?? "").indexOf(t);
    let inicio: [Node, number] | null = null;
    let fim: [Node, number] | null = null;
    for (let n = andar.nextNode(); n; n = andar.nextNode()) {
      const len = n.textContent?.length ?? 0;
      if (!inicio && alvo < feito + len) inicio = [n, alvo - feito];
      if (inicio && alvo + t.length <= feito + len) { fim = [n, alvo + t.length - feito]; break; }
      feito += len;
    }
    const r = document.createRange();
    r.setStart(...inicio!);
    r.setEnd(...fim!);
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, trecho);
}

for (const tamanho of [{ nome: "computador", viewport: { width: 1280, height: 900 } }, { nome: "390 px", viewport: { width: 390, height: 844 } }]) {
  test.describe(`Criação coletiva (${tamanho.nome})`, () => {
    test.use({ viewport: tamanho.viewport });
    test.setTimeout(180_000);
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("as três abas abrem, cabem, têm alvos de 44 px e nada vai a outro endereço", async ({ page, baseURL }) => {
      const origem = new URL(baseURL ?? page.url() ?? "http://localhost").origin;
      const fora: string[] = [];
      page.on("request", (r) => {
        const u = r.url();
        if (!u.startsWith("data:") && !u.startsWith("blob:") && new URL(u).origin !== origem) fora.push(u);
      });
      const resposta = await page.goto(ROTA);
      expect(resposta?.status() ?? 0).toBeLessThan(400);
      await assentar(page);
      await expect(page.getByRole("tab", { name: "Rascunhos e margem" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("heading", { level: 2, name: "Rascunhos coletivos" })).toBeVisible();
      await expect(page.getByText("Ninguém, nem a moderação, vê quem escreveu cada uma.").first()).toBeVisible();
      await conferirTela(page);
      await page.getByRole("tab", { name: "Cartaz e lambe" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Estúdio de cartaz" })).toBeVisible();
      await conferirTela(page);
      await page.getByRole("tab", { name: "Zine" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Zine" })).toBeVisible();
      await conferirTela(page);
      expect(fora, "regra 6: nenhum pedido a outro endereço").toEqual([]);
    });

    test("margem: anotar um trecho do acervo; rascunho: sugerir uma troca e aceitar", async ({ page }) => {
      await page.goto(ROTA);
      await assentar(page);
      await page.getByRole("button", { name: "Abrir: Cartilha de direitos" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Cartilha de direitos" })).toBeVisible();
      await expect(page.locator(".cc-marca")).toHaveCount(1);
      await selecionar(page, "ligue para a assessoria");
      await page.getByRole("button", { name: "Anotar o trecho" }).click();
      await expect(page.locator(".cc-trecho").first()).toHaveText("ligue para a assessoria");
      await page.getByLabel("Sua anotação").fill("Pôr o telefone do plantão aqui.");
      await page.getByRole("button", { name: "Enviar" }).click();
      await expect(page.getByText("Anotado.")).toBeVisible();
      const minha = page.locator(".cc-cartao", { hasText: "Pôr o telefone do plantão aqui." });
      await expect(minha).toContainText("sua");
      await expect(page.locator(".cc-marca")).toHaveCount(2);
      await conferirTela(page);

      await page.getByRole("button", { name: /Voltar à lista/ }).first().click();
      await page.getByLabel("Título").fill("Manifesto da ocupação");
      await page.getByLabel("Primeira versão do texto").fill("Nós exigimos diálogo. A prefeitura precisa ouvir.");
      await page.getByRole("button", { name: "Começar" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Manifesto da ocupação" })).toBeVisible();
      await selecionar(page, "exigimos diálogo");
      await page.getByRole("button", { name: "Sugerir troca" }).click();
      await page.getByLabel("Trocar por (vazio tira o trecho)").fill("exigimos diálogo e moradia");
      await page.getByRole("button", { name: "Enviar" }).click();
      await expect(page.getByText("Sugestão enviada.")).toBeVisible();
      await page.getByRole("button", { name: "Aceitar" }).click();
      await expect(page.locator(".cc-corpo")).toHaveText("Nós exigimos diálogo e moradia. A prefeitura precisa ouvir.");
      await expect(page.getByText("versão 2")).toBeVisible();
    });

    test("cartaz: desenhado no aparelho e baixado; contraste baixo não grava", async ({ page }) => {
      await page.goto(`${ROTA}?aba=cartaz`);
      await assentar(page);
      await page.getByLabel("Título").fill("Moradia é direito");
      await page.getByLabel("Quando").fill("Sábado, 10h");
      const tamanho = await page.locator("canvas.cc-tela").evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
      expect(tamanho).toEqual([1240, 1754]);
      // O canvas tem desenho (não é uma folha vazia).
      const pintado = await page.locator("canvas.cc-tela").evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        const cores = new Set<number>();
        for (let i = 0; i < d.length; i += 4 * 997) cores.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return cores.size;
      });
      expect(pintado).toBeGreaterThan(2);
      const baixa = page.waitForEvent("download");
      await page.getByRole("button", { name: "Baixar imagem" }).click();
      expect((await baixa).suggestedFilename()).toBe("cartaz-moradia-e-direito.png");

      await page.getByRole("button", { name: "Gravar a identidade" }).click();
      await page.getByLabel("Fundo").fill("#ffffff");
      await page.getByLabel("Texto", { exact: true }).last().fill("#dddddd");
      await expect(page.getByText("Contraste baixo")).toBeVisible();
      await expect(page.locator("form").filter({ hasText: "Contraste baixo" }).getByRole("button", { name: "Gravar a identidade" })).toBeDisabled();
      await conferirTela(page);
    });

    test("zine: a folha de 8 quadros é montada no aparelho, e dá para esconder quem escreveu", async ({ page }) => {
      await page.goto(`${ROTA}?aba=zine`);
      await assentar(page);
      await page.getByRole("checkbox", { name: /Por que ocupar/ }).check();
      await page.getByRole("checkbox", { name: /mutirão de sábado/ }).check();
      await expect(page.getByRole("heading", { name: "Na zine (2 de 12)" })).toBeVisible();
      await page.getByLabel("Título da capa").fill("Vozes da ocupação");
      await page.getByRole("button", { name: "Montar a folha" }).click();
      const folha = page.locator(".folha-livrinho");
      await expect(folha.locator(".livrinho-quadro")).toHaveCount(8);
      await expect(folha.locator(".livrinho-quadro.rotate-180")).toHaveCount(4);
      await expect(folha).toContainText("Vozes da ocupação");
      await expect(folha).toContainText("Codinome Exemplo");
      await page.getByRole("checkbox", { name: "Esconder quem escreveu" }).check();
      await expect(folha).not.toContainText("Codinome Exemplo");
      await expect(page.getByRole("button", { name: "Imprimir ou salvar PDF" })).toBeVisible();
      await conferirTela(page);
    });
  });
}
