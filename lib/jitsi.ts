// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** O servidor de vídeo: o público do Jitsi por padrão; um próprio em NEXT_PUBLIC_JITSI_DOMAIN (só o domínio). */
export const JITSI_DOMINIO = (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si").replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/** Um nome de sala imprevisível (o endereço não se adivinha), com o prefixo do instituto. */
export function novaSalaJitsi(prefixo = "InstitutoLucia"): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const sorteio = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
  return `https://${JITSI_DOMINIO}/${prefixo}-${sorteio}`;
}

/** Se o endereço é uma sala do servidor configurado, devolve o nome da sala; senão, null (abre fora do site). */
export function salaJitsiDe(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.hostname !== JITSI_DOMINIO) return null;
    const nome = u.pathname.replace(/^\/+/, "");
    return /^[A-Za-z0-9_-]{6,80}$/.test(nome) ? nome : null;
  } catch {
    return null;
  }
}
