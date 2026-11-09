// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test } from "@playwright/test";
import { abrir, aceitarTermo, entrarComo, vigiarErros } from "./ajuda";

// A fumaça das telas principais: cada uma abre, tem título e conteúdo, não cai na página "não encontrada", não solta
// erro de JavaScript nem recebe resposta 5xx do site ou do banco de teste. Roda no projeto "computador" e no "s24"
// (Galaxy S24 pelo navegador do celular), contra o banco de teste local (npm run dev:local), nunca contra produção.
//
//   npx playwright test e2e/fumaca --project=computador --project=s24
//   CAPTURAS=1 npx playwright test e2e/fumaca   → também guarda uma captura de cada tela em test-results/capturas/
//
// A frase da página "não encontrada" (i18n/pt.json › notFound.title): se ela aparecer, a rota sumiu.
const NAO_ENCONTRADA = "Este rolo não está na estante";

// No servidor de desenvolvimento, a primeira visita a uma rota compila a página na hora: a de trilha e a de aula passam
// de 3 minutos quando os dois aparelhos as pedem juntos. Mais folga só aqui, para a fumaça não falhar por compilação.
test.describe.configure({ timeout: 480_000 });

// [caminho, título esperado (quando a tela tem um título fixo e visível)]
const PAGINAS: [string, RegExp | null][] = [
  ["/pt", null],
  ["/pt/trilhas", null],
  ["/pt/trilhas/historia-antiga", null],
  ["/pt/trilhas/historia-antiga/pre-historia-os-primeiros-seres-humanos", /Pré-história/],
  ["/pt/acervo", null],
  ["/pt/alumia", null],
  ["/pt/territorios", null],
  ["/pt/territorios/na-atividade", null],
  ["/pt/territorios/noizocupa", /NoizOcupa/],
  ["/pt/territorios/coletivo-kamikaze", /Kamikaze/],
  ["/pt/jogos", null],
];

async function capturar(page: import("@playwright/test").Page, nome: string, projeto: string) {
  if (!process.env.CAPTURAS) return;
  const arquivo = `${projeto}-${nome.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-") || "inicio"}.png`;
  await page.screenshot({ path: `test-results/capturas/${arquivo}`, fullPage: false });
}

for (const [caminho, titulo] of PAGINAS) {
  test(`fumaça: ${caminho}`, async ({ page }, info) => {
    const erros = vigiarErros(page);
    // A própria página não pode responder com erro (o abrir() não devolve a resposta: ela é conferida aqui). Vale a
    // última navegação da janela principal, depois de algum redirecionamento.
    const navegacoes: number[] = [];
    page.on("response", (r) => {
      if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) navegacoes.push(r.status());
    });
    await abrir(page, caminho);
    expect(navegacoes.at(-1), `status de ${caminho}`).toBeLessThan(400);

    // Toda tela tem um h1 (na comunidade ele só existe para leitores de tela: por isso "attached", e não "visible").
    await expect(page.locator("h1").first()).toBeAttached();
    if (titulo) await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText(NAO_ENCONTRADA)).toHaveCount(0);

    // No celular, nada pode passar da largura da tela (a conferência completa, com o visual do aplicativo, é a do s24.spec.ts).
    if (info.project.name === "s24") {
      const vaza = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(vaza, `${caminho} rola para o lado`).toBeLessThanOrEqual(1);
    }
    await capturar(page, caminho, info.project.name);
    expect(erros, `erros em ${caminho}`).toEqual([]);
  });
}

test("fumaça: painel logado com a conta de teste", async ({ page, isMobile }, info) => {
  const erros = vigiarErros(page);
  const s = await entrarComo(page, "jornal@local");
  // Na primeira vez, o termo de voluntariado vem antes de tudo: aceito direto no banco local.
  await aceitarTermo(s.access_token);
  // O passeio do painel abre sozinho na primeira visita e cobre a tela; aqui ele já foi visto.
  await page.addInitScript(() => window.localStorage.setItem("lucia:tutorial-painel", String(Date.now())));
  await abrir(page, "/pt/painel");
  // Com a sessão guardada, o painel não manda para a tela de entrar.
  expect(new URL(page.url()).pathname).not.toMatch(/\/entrar/);
  // No celular, o menu fica atrás do botão Menu, na barra do alto.
  if (isMobile) await page.getByRole("button", { name: "Menu", exact: true }).click();
  // O menu agrupa as telas por assunto; quem produz conteúdo tem o grupo Produção.
  await expect(page.getByRole("button", { name: "Produção" })).toBeVisible();
  await capturar(page, "painel", info.project.name);
  expect(erros, "erros no painel").toEqual([]);
});
