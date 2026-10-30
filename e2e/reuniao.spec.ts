// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { expect, type Frame, type Page, test } from "@playwright/test";
import { abrir } from "./ajuda";

// A sala de vídeo de ponta a ponta, no servidor de verdade (o Jitsi público de lib/jitsi.ts, pela internet): duas
// pessoas entram, e as duas se veem e se ouvem. Câmera e microfone são
// os de teste do Chrome. Era aqui que a política de permissões do site negava câmera e microfone ao quadro da sala.
// Para repetir: npx playwright test e2e/reuniao --repeat-each=5
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
  permissions: ["camera", "microphone"],
});

/** O quadro da sala de vídeo dentro da página. */
async function quadroDaSala(page: Page): Promise<Frame> {
  await expect(page.locator("iframe[src*='meet.systemli.org'], iframe[src*='jitsi']").first()).toBeAttached({ timeout: 90_000 });
  const handle = await page.locator("iframe[src*='meet.systemli.org'], iframe[src*='jitsi']").first().elementHandle();
  const frame = await handle!.contentFrame();
  return frame!;
}

/** Dentro da sala: entrou na conferência, com câmera e microfone próprios ligados, e com N pessoas. */
async function estado(frame: Frame) {
  return frame.evaluate(() => {
    const app = (window as unknown as { APP?: { store?: { getState(): Record<string, unknown> }; conference?: { membersCount?: number; isJoined?: () => boolean } } }).APP;
    const st = app?.store?.getState() as Record<string, unknown> | undefined;
    const trilhos = (st?.["features/base/tracks"] as { local: boolean; mediaType: string; muted: boolean }[] | undefined) ?? [];
    return {
      entrou: Boolean(app?.conference?.isJoined?.()),
      pessoas: app?.conference?.membersCount ?? 0,
      camera: trilhos.some((t) => t.local && t.mediaType === "video" && !t.muted),
      microfone: trilhos.some((t) => t.local && t.mediaType === "audio"),
      remotos: trilhos.filter((t) => !t.local).map((t) => t.mediaType),
    };
  });
}

test("sala de vídeo: duas pessoas entram, cada uma com câmera e microfone, e se veem", async ({ browser }) => {
  // A sala de vídeo é a mesma nas reuniões da equipe, nas chamadas das conversas, no estudo em grupo e nas aulas com
  // sala Jitsi (components/JitsiSala.tsx). Aqui pelo estudo em grupo, que abre sem conta: a reunião da equipe pede
  // ainda o aparelho aprovado das conversas, que não tem a ver com o vídeo.
  const id = `teste${Date.now()}`.slice(0, 24);
  const endereco = `/pt/estudo-em-grupo?sala=${id}&inicio=${Date.now()}&foco=25&pausa=5`;
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    const a = await ctxA.newPage();
    await abrir(a, endereco);
    await a.getByRole("button", { name: "Entrar na sala de vídeo" }).click({ timeout: 90_000 });
    const salaA = await quadroDaSala(a);
    await expect.poll(async () => (await estado(salaA).catch(() => null))?.entrou, { timeout: 90_000 }).toBe(true);

    const b = await ctxB.newPage();
    await abrir(b, endereco);
    await b.getByRole("button", { name: "Entrar na sala de vídeo" }).click({ timeout: 90_000 });
    const salaB = await quadroDaSala(b);
    await expect.poll(async () => (await estado(salaB).catch(() => null))?.entrou, { timeout: 90_000 }).toBe(true);
    await expect.poll(async () => (await estado(salaB)).pessoas, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    // Câmera e microfone liberados ao quadro: era isto que a política de permissões do site negava.
    for (const sala of [salaA, salaB]) {
      await sala.evaluate(() => {
        const app = (window as unknown as { APP?: { conference?: { muteVideo?: (m: boolean) => void; muteAudio?: (m: boolean) => void } } }).APP;
        app?.conference?.muteVideo?.(false);
        app?.conference?.muteAudio?.(false);
      });
    }
    await expect.poll(async () => (await estado(salaA)).camera, { timeout: 45_000 }).toBe(true);
    await expect.poll(async () => (await estado(salaB)).camera, { timeout: 45_000 }).toBe(true);
    await expect.poll(async () => (await estado(salaA)).microfone, { timeout: 30_000 }).toBe(true);
    await expect.poll(async () => (await estado(salaA)).remotos.join(","), { timeout: 60_000 }).toContain("video");
    await expect.poll(async () => (await estado(salaB)).remotos.join(","), { timeout: 60_000 }).toContain("video");
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
