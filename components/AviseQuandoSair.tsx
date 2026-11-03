// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { fill, localePath, type Locale } from "@/i18n/config";
import { CHAVE_DO_AVISE, lerAvisos, novidades, type Avisos } from "@/lib/avise";
import { setItem, useHydrated, useStored } from "@/lib/storage";

export interface TextosDoAvise {
  notifyMe: string;
  notifyOn: string;
  notifyOff: string;
  notifyHint: string;
  notifyNews: string;
  notifyNewsItem: string;
  notifySeen: string;
}

/** Lê os avisos guardados de novo a cada mudança no armazenamento (useStored só serve para re-renderizar). */
function useAvisos(): Avisos {
  const bruto = useStored(CHAVE_DO_AVISE);
  return bruto ? lerAvisos() : {};
}

const gravar = (avisos: Avisos) => setItem(CHAVE_DO_AVISE, Object.keys(avisos).length ? JSON.stringify(avisos) : null);

/** Na página de uma trilha em construção: "Me avise quando sair aula nova", guardado só neste aparelho. */
export function MeAviseQuandoSair({ trilha, prontas, s }: { trilha: string; prontas: number; s: TextosDoAvise }) {
  const hidratado = useHydrated();
  const avisos = useAvisos();
  const ligado = hidratado && trilha in avisos;
  const novas = ligado ? prontas - avisos[trilha] : 0;
  return (
    <div className="no-print mt-4 font-sans text-sm">
      {novas > 0 && (
        <p role="status" className="mb-2 font-bold">
          {fill(s.notifyNewsItem, { n: novas })}{" "}
          <button type="button" className="cursor-pointer underline" onClick={() => gravar({ ...avisos, [trilha]: prontas })}>
            {s.notifySeen}
          </button>
        </p>
      )}
      <button
        type="button"
        aria-pressed={ligado}
        className="cursor-pointer border-2 border-ink bg-folha px-3 py-2 font-bold hover:border-oxblood hover:text-oxblood"
        onClick={() => {
          const proximo = { ...avisos };
          if (ligado) delete proximo[trilha];
          else proximo[trilha] = prontas;
          gravar(proximo);
        }}
      >
        {ligado ? s.notifyOn : s.notifyMe}
      </button>
      {ligado && (
        <span className="ml-3 text-ink-soft">
          <button type="button" className="cursor-pointer underline" onClick={() => { const p = { ...avisos }; delete p[trilha]; gravar(p); }}>
            {s.notifyOff}
          </button>
        </span>
      )}
      <p className="mt-2 text-ink-soft">{s.notifyHint}</p>
    </div>
  );
}

/** Na página das disciplinas: as trilhas marcadas que ganharam aula pronta desde o pedido. Some quando não há nada. */
export function AvisosDeTrilhas({ prontas, titulos, lang, s }: { prontas: Record<string, number>; titulos: Record<string, string>; lang: Locale; s: TextosDoAvise }) {
  const hidratado = useHydrated();
  const avisos = useAvisos();
  const lista = hidratado ? novidades(avisos, prontas).filter((n) => titulos[n.trilha]) : [];
  if (lista.length === 0) return null;
  return (
    <section role="status" className="no-print mt-8 border-2 border-ink bg-folha p-5 font-sans text-sm shadow-[4px_4px_0_var(--sombra)]">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em]">{s.notifyNews}</h2>
      <ul className="mt-3 space-y-2">
        {lista.map(({ trilha, novas }) => (
          <li key={trilha}>
            <Link href={localePath(lang, `/trilhas/${trilha}`)} className="font-bold underline hover:text-oxblood">{titulos[trilha]}</Link>
            {" · "}
            {fill(s.notifyNewsItem, { n: novas })}{" "}
            <button type="button" className="cursor-pointer underline text-ink-soft" onClick={() => gravar({ ...avisos, [trilha]: prontas[trilha] })}>
              {s.notifySeen}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
