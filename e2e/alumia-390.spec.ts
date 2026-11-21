// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Page } from "@playwright/test";

// R1 (A3.3): TODAS as telas da Alumia num celular de 390 px, com a prévia de dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim e
// as flags da Alumia ligadas; nada vai a banco nenhum). Em cada tela:
//   - nada passa da largura (sem rolagem para o lado);
//   - todo alvo de toque (botão, aba, caixa de marcar, link com cara de botão, "summary") tem pelo menos 44 × 44 px;
//   - com "menos movimento" pedido pelo aparelho, nenhuma animação fica rodando depois que a tela assenta.
// Rodar: BASE_URL=http://localhost:<porta> npx playwright test e2e/alumia-390 --project=computador
//   (o servidor: NEXT_PUBLIC_ALUMIA_PREVIA=sim NEXT_PUBLIC_RECURSOS='todos,rede-v2,alumia-2,…' npx next dev --webpack -p <porta>)

/** As rotas de app/[lang]/alumia, com os parâmetros trocados pelos exemplos da prévia. */
export const TELAS_DA_ALUMIA = [
  "/pt/alumia",
  "/pt/alumia/agenda",
  "/pt/alumia/ajuda",
  "/pt/alumia/aparelhos",
  "/pt/alumia/aparencia",
  "/pt/alumia/aprovados",
  "/pt/alumia/ato/0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d01",
  "/pt/alumia/atos",
  "/pt/alumia/atos/previa",
  "/pt/alumia/avisos",
  "/pt/alumia/buscar",
  "/pt/alumia/c/passe-livre-sp",
  "/pt/alumia/c/passe-livre-sp/wiki",
  "/pt/alumia/calendario",
  "/pt/alumia/como-a-linha",
  "/pt/alumia/comunidades",
  "/pt/alumia/comunidades/prancha-f3",
  "/pt/alumia/conquistas",
  "/pt/alumia/conversas",
  "/pt/alumia/convite",
  "/pt/alumia/cuidado",
  "/pt/alumia/denuncias",
  "/pt/alumia/editar-perfil",
  "/pt/alumia/explorar",
  "/pt/alumia/fediverso",
  "/pt/alumia/identidades",
  "/pt/alumia/leve",
  "/pt/alumia/linhas",
  "/pt/alumia/listas",
  "/pt/alumia/mapa",
  "/pt/alumia/mapa/ao-vivo",
  "/pt/alumia/meus-dados",
  "/pt/alumia/moderacao",
  "/pt/alumia/modo-ato",
  "/pt/alumia/modo-ato/sem-sinal",
  "/pt/alumia/nucleos",
  "/pt/alumia/o-que-guardamos",
  "/pt/alumia/organizacoes",
  "/pt/alumia/organizacoes/exemplo",
  "/pt/alumia/organizacoes/selo",
  "/pt/alumia/pontes",
  "/pt/alumia/privacidade",
  "/pt/alumia/propor",
  "/pt/alumia/questoes",
  "/pt/alumia/redacao",
  "/pt/alumia/regras",
  "/pt/alumia/rotulos",
  "/pt/alumia/salvos",
  "/pt/alumia/seguranca",
  "/pt/alumia/series",
  "/pt/alumia/silenciados",
  "/pt/alumia/stories",
  "/pt/alumia/tag/passelivre",
  "/pt/alumia/temas",
  "/pt/alumia/termos",
  "/pt/alumia/trabalhadores",
  "/pt/alumia/transparencia",
  "/pt/alumia/turmas",
  "/pt/alumia/u/faisca",
  // As telas do portão de entrada (a prévia escolhe a fase pelo endereço): a primeira coisa que quem entra no beta vê.
  "/pt/alumia?portao=fora",
  "/pt/alumia?portao=pedido",
  "/pt/alumia?portao=fila",
  "/pt/alumia?portao=analise",
  "/pt/alumia?portao=recusada",
  "/pt/alumia?portao=codigo",
  "/pt/alumia?portao=codigos",
  // Prompt 4, item 4: os avisos de local (com "alumia-p4-avisos-de-local" na lista das flags do servidor).
  "/pt/alumia/mapa/avisos",
  // Prompt 4, criação coletiva (com "alumia-p4-criacao-coletiva" na lista das flags do servidor).
  "/pt/alumia/criacao",
  // Prompt 4, itens 38 a 42: a cultura (com "alumia-p4-cultura" na lista das flags do servidor).
  "/pt/alumia/cultura",
];

const ALVOS = 'button, [role="button"], [role="tab"], summary, a.al-botao, a.ale-botao, input[type="checkbox"], input[type="radio"], select';

/** Espera a tela assentar: a casca chegou e nenhum "carregando" ficou no ar (com um teto, para a prévia sem banco). */
async function assentar(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0, null, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
}

/** Os alvos de toque menores que 44 × 44 (a caixa de marcar e o rádio contam pelo rótulo em volta, que é o que se toca). */
async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate((seletor) => {
    const saida: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(seletor))) {
      if (el.closest('[aria-hidden="true"], .sr-only, [hidden], [inert]')) continue;
      const estilo = getComputedStyle(el);
      if (estilo.visibility === "hidden" || estilo.display === "none") continue;
      const alvo = (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && el.closest("label")) || el;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Fora da tela (um menu fechado que desliza) não se toca.
      if (r.right < 0 || r.left > innerWidth) continue;
      // A área de toque pode crescer por uma camada invisível em volta (::after absoluto, como o ALT da imagem): conta a maior.
      const depois = getComputedStyle(el, "::after");
      const camada = depois.content !== "none" && depois.position === "absolute";
      const largura = Math.max(r.width, camada ? parseFloat(depois.width) || 0 : 0);
      const altura = Math.max(r.height, camada ? parseFloat(depois.height) || 0 : 0);
      if (Math.round(largura) < 44 || Math.round(altura) < 44) {
        const nome = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
        saida.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""} "${nome}" ${Math.round(largura)}×${Math.round(altura)}`);
      }
    }
    return saida;
  }, ALVOS);
}

test.describe("Alumia em 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  test.setTimeout(240_000);

  for (const rota of TELAS_DA_ALUMIA) {
    test(`390 px: ${rota}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const resposta = await page.goto(rota);
      expect.soft(resposta?.status() ?? 0, "a tela abre").toBeLessThan(500);
      await assentar(page);

      const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth }));
      expect.soft(largura.conteudo, "nada passa da largura do celular").toBeLessThanOrEqual(largura.tela + 1);

      expect.soft(await alvosPequenos(page), "alvos de toque de pelo menos 44 px").toEqual([]);

      const rodando = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running")
          .map((a) => {
            const alvo = (a.effect as KeyframeEffect | null)?.target as Element | null;
            return `${alvo?.tagName.toLowerCase() ?? "?"}.${(alvo?.className && typeof alvo.className === "string" ? alvo.className.split(" ")[0] : "")} ${(a as CSSAnimation).animationName ?? ""}`;
          }),
      );
      expect.soft(rodando, "com menos movimento, nada fica se mexendo").toEqual([]);
    });
  }
});
