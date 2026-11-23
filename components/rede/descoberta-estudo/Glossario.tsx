// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 103: o glossário ao toque, com o glossário do site (/api/rede/glossario/[lang], estático). O termo marcado num texto vira um
// botão: tocar abre a definição curta ali mesmo, com o link para o verbete inteiro. A aba Glossário busca um termo ou marca os termos
// de um texto colado (o texto fica só na tela; não vai a lugar nenhum).
import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { buscarTermos, marcarTermos, type Termo } from "@/lib/rede/descoberta-estudo/glossario";
import { Bloco, type PropsDaParte } from "./comum";

const pedidos = new Map<string, Promise<Termo[]>>();
function carregar(lang: string): Promise<Termo[]> {
  let p = pedidos.get(lang);
  if (!p) {
    p = fetch(`/api/rede/glossario/${encodeURIComponent(lang)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ termos?: Termo[] }>) : { termos: [] }))
      .then((d) => (Array.isArray(d.termos) ? d.termos : []))
      .catch(() => {
        pedidos.delete(lang);
        return [];
      });
    pedidos.set(lang, p);
  }
  return p;
}

/** Os termos do glossário no idioma (vazio enquanto chega ou se não chegar). */
export function useTermos(lang: string): Termo[] | null {
  const [termos, setTermos] = useState<{ lang: string; lista: Termo[] } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregar(lang).then((lista) => vivo && setTermos({ lang, lista }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return termos?.lang === lang ? termos.lista : null;
}

/** Um termo tocável: o botão abre e fecha a definição logo abaixo, com o link para o verbete. */
function TermoAoToque({ texto, termo, lang, verMais }: { texto: string; termo: Termo; lang: string; verMais: string }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  return (
    <span className="de-termo">
      <button type="button" className="de-termo-botao" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto((x) => !x)}>{texto}</button>
      {aberto && (
        <span id={id} role="note" className="de-termo-balao">
          <strong>{termo.termo}</strong>: {termo.resumo}{" "}
          <Link href={`/${lang}/glossario#${termo.slug}`}>{verMais}</Link>
        </span>
      )}
    </span>
  );
}

/** Um texto com os termos do glossário tocáveis (a primeira aparição de cada um). */
export function TextoComGlossario({ texto, lang, verMais }: { texto: string; lang: string; verMais: string }) {
  const termos = useTermos(lang);
  if (!termos?.length) return <>{texto}</>;
  return (
    <>
      {marcarTermos(texto, termos).map((p, i) => (p.termo ? <TermoAoToque key={i} texto={p.texto} termo={p.termo} lang={lang} verMais={verMais} /> : <span key={i}>{p.texto}</span>))}
    </>
  );
}

export default function Glossario({ t, lang }: PropsDaParte) {
  const id = useId();
  const k = t.glossario;
  const termos = useTermos(lang);
  const [q, setQ] = useState("");
  const [colado, setColado] = useState("");
  const achados = termos ? buscarTermos(termos, q) : [];
  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        <label className="de-campo" htmlFor={`${id}-q`}>
          <span>{k.buscar}</span>
          <input id={`${id}-q`} className="al2-campo" type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
        </label>
        {!termos ? <p role="status" className="de-miudo">{t.carregando}</p> : termos.length === 0 ? <p className="de-miudo">{k.semLista}</p> : q.trim().length >= 2 && (
          achados.length === 0 ? <p className="de-miudo">{k.nada}</p> : (
            <ul className="de-lista" aria-live="polite">
              {achados.map((x) => (
                <li key={x.slug} className="de-item">
                  <strong>{x.termo}</strong>
                  <span className="de-texto">{x.resumo}</span>
                  <Link className="de-link" href={`/${lang}/glossario#${x.slug}`}>{k.verMais}</Link>
                </li>
              ))}
            </ul>
          )
        )}
      </Bloco>
      <div className="de-form">
        <label className="de-campo" htmlFor={`${id}-texto`}>
          <span>{k.colar}</span>
          <textarea id={`${id}-texto`} className="al2-campo" value={colado} maxLength={4000} rows={5} onChange={(e) => setColado(e.target.value)} />
        </label>
        {colado.trim() && <p className="de-texto de-pre"><TextoComGlossario texto={colado} lang={lang} verMais={k.verMais} /></p>}
        <p className="de-miudo">{k.aparelho}</p>
      </div>
    </div>
  );
}
