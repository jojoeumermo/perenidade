// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As salas de vídeo (reuniões da equipe, estudo em grupo e a sala Jitsi das aulas ao vivo) usam o Jitsi Meet, de código
// aberto, num servidor público de coletivo de tecnologia, sem conta e sem custo.
//
// Até 20/10/2026 o padrão era o meet.jit.si, que deixou de servir para isso: quando embutido em outro site, ele derruba
// a chamada depois de 5 minutos ("destina-se apenas a fins de demonstração") e só deixa a reunião começar quando alguém
// entra como moderador com conta do Google, do GitHub ou do Facebook. Os servidores abaixo não têm nenhum dos dois
// limites (conferido em 20/10/2026: aceitam ser embutidos e não exigem login): quem entra primeiro modera.
//
// Trocar por um servidor próprio (ou por outra lista): NEXT_PUBLIC_JITSI_DOMAIN com um ou mais domínios separados por
// vírgula, na ordem de preferência. O primeiro é o padrão; os outros aparecem em "Trocar de servidor".

const PADRAO = ["meet.systemli.org", "jitsi.hamburg.ccc.de", "jitsi.riot.im"];

const dominio = (texto: string) => texto.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/** Os servidores aceitos, na ordem de preferência. */
export const SERVIDORES_JITSI: string[] = (() => {
  const lista = (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "").split(",").map(dominio).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  return lista.length ? [...new Set(lista)] : PADRAO;
})();

/** O servidor padrão. */
export const JITSI_DOMINIO = SERVIDORES_JITSI[0];

/** Servidores que já foram usados e cujas salas são abertas no servidor padrão (o nome da sala continua valendo). */
const ANTIGOS = ["meet.jit.si", "8x8.vc"];

/** Um nome de sala imprevisível (o endereço não se adivinha), com o prefixo do instituto. */
export function novaSalaJitsi(prefixo = "InstitutoLucia"): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const sorteio = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
  return `https://${JITSI_DOMINIO}/${prefixo}-${sorteio}`;
}

/** Se o endereço é uma sala Jitsi conhecida, devolve o nome da sala; senão, null (abre fora do site). */
export function salaJitsiDe(url: string): string | null {
  return lerSalaJitsi(url)?.sala ?? null;
}

/** Nome da sala e servidor onde ela abre: um servidor da lista fica; um antigo (meet.jit.si) vai para o padrão. */
export function lerSalaJitsi(url: string): { sala: string; servidor: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:" || !(SERVIDORES_JITSI.includes(host) || ANTIGOS.includes(host))) return null;
    const nome = u.pathname.replace(/^\/+/, "");
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(nome)) return null;
    return { sala: nome, servidor: SERVIDORES_JITSI.includes(host) ? host : JITSI_DOMINIO };
  } catch {
    return null;
  }
}

/** O servidor escolhido para uma sala neste aparelho (depois de "Trocar de servidor"), ou o da sala. */
export function servidorEscolhido(sala: string, servidorDaSala = JITSI_DOMINIO): string {
  try {
    const guardado = window.localStorage.getItem(`lucia:jitsi:${sala}`);
    if (guardado && SERVIDORES_JITSI.includes(guardado)) return guardado;
  } catch {
    // sem armazenamento
  }
  return servidorDaSala;
}

export function escolherServidor(sala: string, servidor: string) {
  try {
    if (servidor === JITSI_DOMINIO) window.localStorage.removeItem(`lucia:jitsi:${sala}`);
    else window.localStorage.setItem(`lucia:jitsi:${sala}`, servidor);
  } catch {
    // sem armazenamento: vale só para esta página
  }
}
