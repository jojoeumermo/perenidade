// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Endereços do YouTube: o vídeo (ou a transmissão ao vivo) e o canal. O site só mostra o player pelo domínio sem
// cookies (youtube-nocookie.com) e só depois do clique de quem quer assistir.

export type DoYoutube = { tipo: "video"; id: string } | { tipo: "canal"; id: string };

/** Lê youtube.com/watch?v=…, youtu.be/…, youtube.com/live/…, youtube.com/embed/… e youtube.com/channel/UC…(/live). */
export function lerYoutube(endereco: string): DoYoutube | null {
  let u: URL;
  try {
    u = new URL(endereco.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  const id = (x: string | null | undefined) => (x && /^[A-Za-z0-9_-]{11}$/.test(x) ? x : null);
  if (host === "youtu.be") {
    const v = id(u.pathname.slice(1));
    return v ? { tipo: "video", id: v } : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const partes = u.pathname.split("/").filter(Boolean);
  if (partes[0] === "watch") {
    const v = id(u.searchParams.get("v"));
    return v ? { tipo: "video", id: v } : null;
  }
  if (partes[0] === "live" || partes[0] === "embed" || partes[0] === "shorts") {
    if (partes[1] === "live_stream") {
      const canal = u.searchParams.get("channel");
      return canal && /^UC[A-Za-z0-9_-]{22}$/.test(canal) ? { tipo: "canal", id: canal } : null;
    }
    const v = id(partes[1]);
    return v ? { tipo: "video", id: v } : null;
  }
  if (partes[0] === "channel" && /^UC[A-Za-z0-9_-]{22}$/.test(partes[1] ?? "")) return { tipo: "canal", id: partes[1] };
  return null;
}

/** O endereço do player, sem cookies. Canal: a transmissão ao vivo que estiver no ar. */
export const playerDoYoutube = (y: DoYoutube) =>
  y.tipo === "video" ? `https://www.youtube-nocookie.com/embed/${y.id}?autoplay=1&rel=0` : `https://www.youtube-nocookie.com/embed/live_stream?channel=${y.id}&autoplay=1&rel=0`;
