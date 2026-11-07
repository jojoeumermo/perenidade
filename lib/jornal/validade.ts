// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Matéria com prazo (docs/jornal/EXPIRACAO.md): o campo "sai_do_ar_em" do cabeçalho de uma matéria do Jornal diz quando
// ela deixa de existir no site. Depois dessa hora a matéria some da capa do Jornal, da página inicial, das páginas dos
// Territórios, da busca, do mapa do site (sitemap) e do novidades.json, e o endereço dela responde 410 ("removida"),
// pelo proxy.ts. O arquivo continua no repositório: o histórico não se apaga.
//
// Este módulo não lê arquivo nenhum (o proxy e lib/content.ts o usam): só entende a data e compara com o relógio.

/** Fuso de Brasília. O Brasil não tem horário de verão desde 2019 (Decreto 9.772/2019), então é sempre -03:00. */
export const FUSO_BRASILIA = "-03:00";

/**
 * Entende o valor de "sai_do_ar_em" e devolve o instante em ISO (com fuso), ou null se não der para entender.
 *  - "2026-11-13": o dia inteiro conta; sai às 23:59:59 de Brasília.
 *  - "2026-11-13 23:59" ou "2026-11-13T23:59": hora de Brasília.
 *  - "2026-11-13T23:59:00-03:00" ou "...Z": o fuso dito.
 * Um Date (o YAML transforma datas sem aspas em Date, à meia-noite UTC) com hora zerada vale como o dia inteiro.
 * Um Date com hora é recusado (null): sem aspas, o YAML lê "2026-11-13 23:59:00" como UTC, e o proxy (que lê o texto
 * cru, lib/jornal/saidas.ts) como hora de Brasília. As duas leituras dariam 3 horas de diferença; com aspas, as duas batem.
 */
export function instanteDeSaida(valor: unknown): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    const iso = valor.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? instanteDeSaida(iso.slice(0, 10)) : null;
  }
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  let iso: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) iso = `${texto}T23:59:59${FUSO_BRASILIA}`;
  else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(texto)) iso = `${texto.replace(" ", "T")}${texto.length === 16 ? ":00" : ""}${FUSO_BRASILIA}`;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(texto)) iso = texto;
  else return null;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** A matéria já saiu do ar? Sem prazo ("" ou null), nunca sai. */
export function saiuDoAr(instante: string | null | undefined, agora: number = Date.now()): boolean {
  if (!instante) return false;
  const quando = Date.parse(instante);
  return !Number.isNaN(quando) && agora > quando;
}

/** "/pt/jornal/slug" (com ou sem barra no fim) → { lang, slug }; qualquer outro caminho → null. */
export function materiaDoCaminho(caminho: string): { lang: string; slug: string } | null {
  const m = /^\/([a-z]{2})\/jornal\/([a-z0-9-]+)\/?$/.exec(caminho);
  return m ? { lang: m[1], slug: m[2] } : null;
}

/** O aviso da página removida (410), curto, nos idiomas do site. Fica aqui (e não em i18n/*.json) para o proxy não carregar os dicionários inteiros. */
const AVISO: Record<string, { titulo: string; texto: string; voltar: string }> = {
  pt: { titulo: "Esta matéria saiu do ar", texto: "Ela foi publicada com prazo e o prazo terminou.", voltar: "Voltar ao Jornal" },
  en: { titulo: "This article has been taken down", texto: "It was published for a limited time, and that time is over.", voltar: "Back to the Journal" },
  es: { titulo: "Este artículo fue retirado", texto: "Se publicó por un tiempo limitado y ese plazo terminó.", voltar: "Volver al Periódico" },
  fr: { titulo: "Cet article a été retiré", texto: "Il a été publié pour une durée limitée, qui est terminée.", voltar: "Retour au Journal" },
  ru: { titulo: "Эта статья снята с публикации", texto: "Она была опубликована на ограниченный срок, и срок истёк.", voltar: "Вернуться в газету" },
  zh: { titulo: "本文已下线", texto: "本文为限时发布，期限已过。", voltar: "返回报刊" },
};

/** A página mínima da resposta 410: sem script, sem nada de fora, no idioma do endereço. */
export function paginaRemovida(lang: string): string {
  const a = AVISO[lang] ?? AVISO.pt;
  const idioma = AVISO[lang] ? lang : "pt";
  return `<!doctype html><html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${a.titulo}</title></head><body style="margin:0;background:#f4ecd8;color:#1a1612;font:18px/1.5 Georgia,serif"><main style="max-width:36rem;margin:0 auto;padding:4rem 1rem"><h1 style="font-size:2rem;line-height:1.1">${a.titulo}</h1><p>${a.texto}</p><p><a href="/${idioma}/jornal" style="color:#8a1a12;font-weight:bold">${a.voltar} →</a></p></main></body></html>`;
}
