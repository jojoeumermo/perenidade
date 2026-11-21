// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 83 (atrás de "alumia-p4-pontes"): o cartão de vídeo e de áudio de fora (PeerTube, Loops, Pixelfed, Owncast,
// Funkwhale, Castopod). A rota-proxy (app/api/fediverso/midia) só serve imagem: a miniatura chega por ela, e o navegador de quem lê
// nunca toca o servidor de fora. O vídeo e o áudio em si NÃO tocam dentro da Alumia: o cartão diz de que servidor são e oferece
// abrir no site de origem, com o aviso de que lá o servidor vê o acesso. Lógica pura, sem "@/" de propósito.

export interface MidiaParaOCartao {
  tipo: string;
  url: string;
}

export interface CartaoDeMidia {
  tipo: "video" | "audio";
  servidor: string;
  /** A página do post na origem (só https), para "assistir no site de origem". Nula se a origem não deu uma página segura. */
  pagina: string | null;
}

/** Os tipos de nota de fora que viram cartão de mídia, além da Note com anexo de vídeo ou áudio: o Video (PeerTube, Loops) e o Audio (Funkwhale). */
export const TIPOS_DE_MIDIA_DE_FORA = new Set(["Video", "Audio"]);

const httpsSeguro = (u: unknown): string | null => {
  if (typeof u !== "string" || u.length > 1000) return null;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && !x.username && !x.password ? x.toString() : null;
  } catch {
    return null;
  }
};

/**
 * O cartão do post de fora, se ele tem vídeo ou áudio. O vídeo vence o áudio. `servidor` é o nome que a tela já mostra (nunca um
 * endereço de pessoa). Sem vídeo nem áudio, nulo (o post segue só com as imagens).
 */
export function cartaoDeMidia(post: { midia?: readonly MidiaParaOCartao[] | null; servidor: string; url?: string | null }): CartaoDeMidia | null {
  const tipos = (Array.isArray(post.midia) ? post.midia : []).map((m) => String(m?.tipo ?? "").toLowerCase());
  const tipo = tipos.some((t) => t.startsWith("video/") || t === "video") ? "video" : tipos.some((t) => t.startsWith("audio/") || t === "audio") ? "audio" : null;
  if (!tipo) return null;
  const servidor = String(post.servidor ?? "").replace(/[^a-z0-9.:\-[\]]/gi, "").slice(0, 253);
  return { tipo, servidor, pagina: httpsSeguro(post.url) };
}
