// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { abrir, entrarComo, entrarForteComo, rpc, sessao, sessaoForte } from "./ajuda";

// Prompt 4, itens 3 e 5 (interruptor "alumia-p4-selo-contagens"): pedir o selo e ligar a contagem em editar o perfil; a
// coordenação dá o selo; outra pessoa vê o selo que explica num toque e a contagem "menos de 3", sem lista de ninguém. No computador
// e em 390 px, com alvos de toque de 44 px e "menos movimento" respeitado.
// Rodar contra o banco local com a migração e a flag ligada no banco (ALUMIA_BANCO_EXTRAS com a migração e uma linha em
// interno.recursos_vivos) e no site (NEXT_PUBLIC_RECURSOS com rede-v2, alumia-2, alumia-org e alumia-p4-selo-contagens):
//   BASE_URL=http://localhost:<porta> BANCO_URL=http://127.0.0.1:<porta do banco> npx playwright test e2e/p4-selo-contagens --project=computador

const LARGURAS = [
  { nome: "computador", largura: 1280, altura: 900 },
  { nome: "390 px", largura: 390, altura: 844 },
];

async function alvoDe44(alvo: Locator) {
  const caixa = await alvo.boundingBox();
  expect(caixa, "o alvo aparece").not.toBeNull();
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
}

async function semRolagemDeLado(page: Page) {
  const largo = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(largo).toBeLessThanOrEqual(1);
}

/** Uma conta da Rede pronta (idade, codinome e @), com o nome de teste dado. */
async function prepararMembro(email: string, handle: string, codinome: string) {
  const s = await sessao(email);
  // Entrar na Alumia (maior de idade, normas da versão 1) e aceitar os termos, direto no banco local.
  await rpc(s.access_token, "rede_aderir", { p_maior: true, p_versao: 1, p_fediverso: false });
  await rpc(s.access_token, "alumia_termos_aceitar", { p_versao: 1 });
  // Numa segunda rodada contra o mesmo banco, o codinome e o @ já são estes (a troca seguida é recusada): segue.
  await rpc(s.access_token, "rede_codinome_definir", { p_codinome: codinome }).catch(() => null);
  await rpc(s.access_token, "rede_perfil_handle_definir", { p_handle: handle }).catch(() => null);
  return s;
}

for (const tela of LARGURAS) {
  test(`selo e contagens (${tela.nome})`, async ({ page }) => {
    test.slow();
    const sufixo = tela.largura < 500 ? "m" : "c";
    // Cada largura usa a sua dupla de contas (o banco local vive na memória durante a rodada inteira).
    const [quemPede, quemVe] = sufixo === "m" ? ["mentora@local", "revisor@local"] : ["leitora@local", "tradutor@local"];
    const handle = `selo_${sufixo}_pessoa`;
    await page.setViewportSize({ width: tela.largura, height: tela.altura });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const pede = await prepararMembro(quemPede, handle, sufixo === "m" ? "Pessoa Mosaico" : "Pessoa Cartaz");
    // Rodar de novo contra o mesmo banco: volta ao começo (chaves desligadas, sem pedido e sem selo).
    await rpc(pede.access_token, "rede_p4_contagens_salvar", { p_seguidores: false, p_apoios: false });
    await rpc(pede.access_token, "rede_p4_selo_desistir");
    const coordAntes = await sessaoForte("coord@local");
    await rpc(coordAntes.access_token, "rede_p4_selo_tirar", { p_handle: handle, p_motivo: "Volta ao começo do teste de ponta a ponta." }).catch(() => null);
    await prepararMembro(quemVe, `ve_${sufixo}_pessoa`, sufixo === "m" ? "Quem Olha Mosaico" : "Quem Olha Cartaz");

    // 1. Quem pede: o bloco aparece na aba Conta do editor, com as duas chaves desligadas.
    await entrarComo(page, quemPede);
    await abrir(page, "/pt/alumia/editar-perfil");
    // O editor do perfil livre mostra uma parte por vez no computador (o menu "Partes do perfil"); a conta é a última.
    const abaConta = page.getByRole("navigation", { name: "Partes do perfil" }).getByRole("button", { name: "Conta", exact: true });
    const chave = page.getByRole("checkbox", { name: "Mostrar quantas pessoas me seguem" });
    if (await abaConta.waitFor({ timeout: 60_000 }).then(() => abaConta.isVisible(), () => false)) {
      // O clique antes de a página acordar se perde: tenta de novo até a parte "Conta" abrir.
      await expect(async () => {
        await abaConta.click();
        await expect(chave).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 90_000 });
    }
    await expect(chave).toBeVisible({ timeout: 90_000 });
    await expect(chave).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Mostrar o número de apoios nos meus posts" })).not.toBeChecked();
    await alvoDe44(chave.locator("xpath=ancestor::label[1]"));
    await chave.check();
    await expect(page.getByText("Escolha salva.")).toBeVisible();
    await expect(chave).toBeChecked();

    // 2. Pedir o selo: só o tipo e o canal, nada de documento.
    await expect(page.getByText(/É gratuito, sempre/)).toBeVisible();
    await page.getByRole("radio", { name: "Educadora ou educador" }).check();
    await page.getByRole("radio", { name: "Gabinete ou assessoria" }).check();
    const pedir = page.getByRole("button", { name: "Pedir o selo" });
    await alvoDe44(pedir);
    await pedir.click();
    await expect(page.getByText(/Seu pedido espera a coordenação desde/)).toBeVisible();
    await expect(page.locator(".al-sc-bloco input[type=file], .al-sc-bloco textarea")).toHaveCount(0);
    await semRolagemDeLado(page);

    // 3. A coordenação (com o segundo fator) dá o selo pelo banco.
    const coord = await sessaoForte("coord@local");
    const fila = await rpc<{ id: string; handle: string }[]>(coord.access_token, "rede_p4_selo_fila");
    const pedido = fila.find((p) => p.handle === handle);
    expect(pedido, "o pedido está na fila da coordenação").toBeTruthy();
    await rpc(coord.access_token, "rede_p4_selo_decidir", { p_id: pedido!.id, p_aceitar: true, p_motivo: "", p_reservado: null });

    // 4. Outra pessoa abre o perfil: o selo explica num toque; a contagem diz "menos de 3", sem número e sem lista.
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.removeItem("lucia:sessao"));
    await entrarComo(page, quemVe);
    await abrir(page, `/pt/alumia/u/${handle}`);
    const selo = page.getByRole("button", { name: /Educadora verificada/ });
    await expect(selo).toBeVisible({ timeout: 90_000 });
    await alvoDe44(selo);
    await expect(selo).toHaveAttribute("aria-expanded", "false");
    await selo.click();
    await expect(selo).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("note").filter({ hasText: /Não quer dizer que a Alumia apoia esta pessoa/ })).toBeVisible();
    await expect(page.getByText("Menos de 3 pessoas seguem")).toBeVisible();
    await expect(page.getByText(/Sem contagens públicas/)).toHaveCount(0);
    // Menos movimento: o botão do selo não anima (a casa põe 0,01 ms em tudo; o CSS do selo põe "none").
    const transicao = await selo.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transicao.split(",").every((d) => parseFloat(d) <= 0.001), `transição: ${transicao}`).toBe(true);
    await semRolagemDeLado(page);
  });
}

test("painel único: a coordenação reserva um nome, e o @ parecido passa a ser recusado", async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const nome = `Figura Teste ${Date.now() % 100000}`;
  await entrarForteComo(page, "coord@local");
  await page.addInitScript(() => window.localStorage.setItem("lucia:tutorial-painel", String(Date.now())));
  await abrir(page, "/pt/painel?aba=alumia-admin");
  const aba = page.getByRole("button", { name: "Selo das pessoas e nomes reservados" });
  await expect(aba).toBeVisible({ timeout: 90_000 });
  await aba.click();
  await expect(page.getByText(/O interruptor “Selo de pessoas e contagens” fica em Recursos/)).toBeVisible();
  await page.getByRole("button", { name: "Nomes reservados", exact: true }).click();
  await page.getByRole("button", { name: "Reservar um nome" }).click();
  await page.getByLabel("Nome ou @").fill(nome);
  await page.getByRole("dialog").getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(page.getByText(nome, { exact: true })).toBeVisible();
  // Quem não é da coordenação não passa com um @ parecido (sem acento, com 1 no lugar do l...).
  // Uma conta nova na Alumia tenta o codinome com a mesma figura escrita de outro jeito (minúsculas, 1 no lugar do i).
  const outra = await sessao("designer@local");
  await rpc(outra.access_token, "rede_aderir", { p_maior: true, p_versao: 1, p_fediverso: false });
  const parecido = nome.toLowerCase().replace(/i/g, "1");
  await expect(rpc(outra.access_token, "rede_codinome_definir", { p_codinome: parecido })).rejects.toThrow(/nome_reservado/);
});
