// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { abrir, entrarComo, rpc, sessao } from "./ajuda";

// A sala das aulas ao vivo de ponta a ponta: quem ensina liga a câmera e começa a aula, quem assiste recebe a imagem.
// Câmera e microfone são os de teste do Chrome (um padrão colorido e um bipe), liberados sem perguntar. O canal de tempo
// real é o imitado pelo banco local (scripts/tempo-real-local.mjs). Para repetir: npx playwright test e2e/aovivo --repeat-each=5
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera", "microphone"],
});

/** Espera um vídeo recebido de outra pessoa (não o espelho da própria câmera) mostrar imagem de verdade. */
async function esperarImagem(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll("video")).some((v) => !v.muted && v.srcObject instanceof MediaStream && v.srcObject.getVideoTracks().length > 0 && v.videoWidth > 0 && !v.paused),
        ),
      { timeout: 90_000 },
    )
    .toBe(true);
}

async function novaAba(context: BrowserContext) {
  return context.newPage();
}

test("aula ao vivo: o vídeo de quem ensina chega a quem assiste", async ({ browser }) => {
  const prof = await sessao("prof@local");
  const aula = await rpc<{ id: string }>(prof.access_token, "aula_ao_vivo_salvar", {
    p_id: null,
    p: { titulo: `Teste ao vivo ${Date.now()}`, descricao: "", disciplina: "matematica", inicio: new Date().toISOString(), duracao: 30 },
  });
  const endereco = `/pt/ao-vivo/sala?aula=${aula.id}`;

  // Quem ensina, num navegador; quem assiste, noutro (sem conta).
  const ctxProf = await browser.newContext();
  const ctxAluno = await browser.newContext();
  try {
    const professor = await novaAba(ctxProf);
    await entrarComo(professor, "prof@local");
    await abrir(professor, endereco);
    await expect(professor.getByText("Você conduz esta aula")).toBeVisible();
    const camera = professor.getByRole("button", { name: "Câmera", exact: true });
    await expect(camera).toBeVisible({ timeout: 60_000 });
    await camera.click();
    // A própria imagem aparece (espelhada) para quem ensina.
    await expect.poll(() => professor.evaluate(() => Array.from(document.querySelectorAll("video")).some((v) => v.muted && v.videoWidth > 0)), { timeout: 30_000 }).toBe(true);
    await professor.getByRole("button", { name: "Começar a aula" }).click();

    const aluno = await novaAba(ctxAluno);
    await abrir(aluno, endereco);
    await esperarImagem(aluno);
    // E sem o aviso de que o vídeo não existe nesta cópia do site.
    await expect(aluno.getByText(/O vídeo não está disponível/)).toHaveCount(0);
  } finally {
    await ctxProf.close();
    await ctxAluno.close();
    await rpc(prof.access_token, "aula_ao_vivo_estado", { p_id: aula.id, p_status: "encerrada" }).catch(() => undefined);
  }
});
