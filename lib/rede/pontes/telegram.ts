// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Publicar junto no Telegram (atrás de "alumia-telegram"). Só no servidor do site (app/api/rede/telegram): o token do robô do
// Telegram vem de ALUMIA_TELEGRAM_TOKEN, segredo do servidor sem o prefixo NEXT_PUBLIC_, que nunca vai ao banco, ao navegador
// nem ao repositório. A organização põe esse robô como administrador do próprio canal e liga o canal na Alumia; daí em diante,
// os posts dela para a internet saem também lá, só o texto e o endereço do post. Nada é escrito em log. Sem "@/" de propósito.

export interface PostParaOTelegram {
  post: string;
  canal: string;
  titulo: string | null;
  texto: string;
}

/** O token tem a forma de um token do Telegram? ("<número>:<letras>") */
export function tokenTemForma(token: string): boolean {
  return /^[0-9]{5,15}:[A-Za-z0-9_-]{30,64}$/.test(token);
}

/** O token do ambiente do servidor; nulo sem ele (aí nada sai). */
export function tokenDoAmbiente(ambiente: Record<string, string | undefined> = process.env): string | null {
  if (typeof window !== "undefined") return null;
  const t = (ambiente.ALUMIA_TELEGRAM_TOKEN ?? "").trim();
  return tokenTemForma(t) ? t : null;
}

/** O texto da mensagem: título (se houver), o texto do post e o endereço dele na Alumia. Até 4096 letras (o teto do Telegram). */
export function mensagemDoPost(p: PostParaOTelegram, site: string): string {
  const endereco = `${site.replace(/\/+$/, "")}/pt/alumia/p/${p.post}`;
  const cabeca = p.titulo?.trim() ? `${p.titulo.trim()}\n\n` : "";
  const espaco = 4096 - endereco.length - cabeca.length - 4;
  const corpo = p.texto.length > espaco ? `${p.texto.slice(0, Math.max(0, espaco - 1))}…` : p.texto;
  return `${cabeca}${corpo}\n\n${endereco}`;
}

/** Manda uma mensagem ao canal (sendMessage, sem prévia de link). Devolve só se deu certo. */
export async function enviarAoCanal(token: string, canal: string, texto: string, buscar: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await buscar(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: canal, text: texto, link_preview_options: { is_disabled: true } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const corpo = (await r.json().catch(() => null)) as { ok?: unknown } | null;
    return r.ok && corpo?.ok === true;
  } catch {
    return false;
  }
}
