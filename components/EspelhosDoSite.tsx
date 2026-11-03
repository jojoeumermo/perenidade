// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// Componente do servidor. Os endereços dos espelhos de leitura (R1-93, docs/ESPELHO-E-COPIAS.md) vêm da variável
// NEXT_PUBLIC_ESPELHOS, uma lista separada por vírgula que a coordenação preenche na Vercel quando um espelho estiver
// no ar. Sem valor, nada aparece. Só entram endereços https completos; o resto é ignorado.
import { isLocale } from "@/i18n/config";
import en from "@/i18n/escola/acesso/en.json";
import es from "@/i18n/escola/acesso/es.json";
import fr from "@/i18n/escola/acesso/fr.json";
import pt from "@/i18n/escola/acesso/pt.json";
import ru from "@/i18n/escola/acesso/ru.json";
import zh from "@/i18n/escola/acesso/zh.json";
import { ligado, type Recurso } from "@/lib/recursos";

const TEXTOS = { pt, en, es, fr, ru, zh };

/** Lê a lista: só https, sem usuário e senha no endereço, sem repetir, no máximo cinco. */
export function lerEspelhos(valor: string | undefined): string[] {
  const lista: string[] = [];
  for (const pedaco of (valor ?? "").split(",")) {
    const texto = pedaco.trim();
    if (!texto) continue;
    try {
      const url = new URL(texto);
      if (url.protocol !== "https:" || url.username || url.password) continue;
      const limpo = url.href;
      if (!lista.includes(limpo)) lista.push(limpo);
    } catch {
      // Endereço malformado: fica de fora.
    }
    if (lista.length === 5) break;
  }
  return lista;
}

/** Os espelhos desta montagem. A referência literal deixa o Next gravar o valor na montagem. */
export function espelhosDoSite(): string[] {
  // "escola" entra em lib/recursos.ts pelo E4-01.
  if (!ligado("escola" as Recurso)) return [];
  return lerEspelhos(process.env.NEXT_PUBLIC_ESPELHOS);
}

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const semProtocolo = (url: string) => url.replace(/^https:\/\//, "").replace(/\/$/, "");

/** O mesmo bloco em HTML puro, para a página "fora do ar" (app/[lang]/fora-do-ar/route.ts), que não usa React. */
export function htmlDosEspelhos(lang: string, lista = espelhosDoSite()): string {
  if (!lista.length) return "";
  const s = TEXTOS[isLocale(lang) ? lang : "pt"].espelhos;
  return `<section class="espelhos"><h2>${escapar(s.titulo)}</h2><p>${escapar(s.texto)}</p><ul>${lista.map((url) => `<li><a href="${escapar(url)}" rel="noopener">${escapar(semProtocolo(url))}</a></li>`).join("")}</ul></section>`;
}

/** "Se o site cair, leia aqui": some quando a variável está vazia. */
export function EspelhosDoSite({ lang, lista = espelhosDoSite() }: { lang: string; lista?: string[] }) {
  if (!lista.length) return null;
  const s = TEXTOS[isLocale(lang) ? lang : "pt"].espelhos;
  return (
    <section aria-labelledby="espelhos-titulo" className="mt-10 border-l-4 border-gold bg-parchment-deep px-4 py-3 font-sans" data-espelhos>
      <h2 id="espelhos-titulo" className="font-serif text-xl font-semibold">
        {s.titulo}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{s.texto}</p>
      <ul className="mt-2 space-y-1">
        {lista.map((url) => (
          <li key={url}>
            <a href={url} rel="noopener" className="inline-block py-2 font-semibold break-all underline hover:text-oxblood">
              {semProtocolo(url)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
