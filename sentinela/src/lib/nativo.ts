// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// O que muda entre o app de mesa (Tauri) e o PWA: notificação e salvar arquivo. O resto é igual.

export const noTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Notificação no desktop (Tauri) ou no navegador. O texto nunca leva detalhe sensível. */
export async function notificar(titulo: string, corpo: string): Promise<void> {
  try {
    if (noTauri()) {
      const n = await import("@tauri-apps/plugin-notification");
      let permitido = await n.isPermissionGranted();
      if (!permitido) permitido = (await n.requestPermission()) === "granted";
      if (permitido) n.sendNotification({ title: titulo, body: corpo });
      return;
    }
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission === "granted") new Notification(titulo, { body: corpo, icon: "/icone-192.png" });
  } catch {
    // sem permissão, sem notificação
  }
}

/** Salva um arquivo: caixa de diálogo no Tauri, download no navegador. */
export async function salvarArquivo(nome: string, conteudo: string, tipo = "text/plain"): Promise<boolean> {
  try {
    if (noTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const destino = await save({ defaultPath: nome });
      if (!destino) return false;
      await writeTextFile(destino, conteudo);
      return true;
    }
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export async function abrirFora(url: string) {
  if (!/^https:\/\//.test(url)) return;
  if (noTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank", "noopener,noreferrer");
}

/** CSV simples, com aspas onde precisa. */
export function csv(linhas: Record<string, unknown>[]): string {
  if (!linhas.length) return "";
  const colunas = Object.keys(linhas[0]);
  const celula = (v: unknown) => {
    const t = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(";"))].join("\n");
}
