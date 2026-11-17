// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useId, useState } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import { PostCompacto, useTextosAlumia3 } from "../../conversa/base3";
import { acervo } from "./cliente";
import { erroDoAcervo, type TextosDoAcervo } from "./textos";

/**
 * Buscar dentro da comunidade (L2-55): a busca de sempre com o operador "c:<slug>", só no que a pessoa já pode ver, do mais novo ao
 * mais antigo e com o teto de 100 (nada de rolagem sem fim). Com `aoEscolher`, cada resultado ganha "Pôr na coleção".
 */
export function BuscaNaComunidade({ slug, lang, s, t, logado, aoEscolher, jaNaColecao = [] }: { slug: string; lang: string; s: TextosDaRede; t: TextosDoAcervo; logado: boolean; aoEscolher?: (p: Post) => void; jaNaColecao?: string[] }) {
  const t3 = useTextosAlumia3(lang);
  const id = useId();
  const [q, setQ] = useState("");
  // Os filtros visíveis viram os operadores da busca de sempre (tipo:, tag:, desde:), sem a pessoa precisar escrever código.
  const [tipo, setTipo] = useState("");
  const [tema, setTema] = useState("");
  const [desde, setDesde] = useState("");
  const [r, setR] = useState<{ q: string; itens: Post[]; proximo: string | null; teto: boolean } | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const aoErro = useCallback((e: unknown) => setErro(erroDoAcervo(t, e)), [t]);

  async function buscar(cursor: string | null) {
    setBuscando(true);
    setErro("");
    try {
      const filtros = [tipo && `tipo:${tipo}`, tema.trim() && `tag:${tema.trim().replace(/^#/, "").replace(/\s+/g, "-")}`, /^\d{4}-\d{2}-\d{2}$/.test(desde) && `desde:${desde}`].filter(Boolean).join(" ");
      const pedido = cursor ? r?.q ?? q : [q.trim(), filtros].filter(Boolean).join(" ");
      const x = await acervo.buscar(slug, pedido, cursor);
      setR((antes) => ({ q: pedido, itens: [...(cursor ? antes?.itens ?? [] : []), ...x.itens], proximo: x.proximo, teto: x.fim_por_teto }));
    } catch (e) {
      aoErro(e);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} aria-busy={buscando}>
      <h2 id={`${id}-t`} className={aoEscolher ? "sr-only" : "acv-cond"} style={aoEscolher ? undefined : { fontSize: "2rem" }}>{aoEscolher ? t.busca.paraColecao : t.busca.titulo}</h2>
      <form
        role="search"
        className="acv-botoes"
        style={{ alignItems: "stretch" }}
        onSubmit={(e) => {
          e.preventDefault();
          void buscar(null);
        }}
      >
        <label htmlFor={`${id}-q`} className="sr-only">{t.busca.rotulo}</label>
        <input id={`${id}-q`} className="acv-campo" style={{ flex: "1 1 16rem", width: "auto" }} type="search" maxLength={180} value={q} onChange={(e) => setQ(e.target.value)} aria-describedby={`${id}-dica`} placeholder={t.busca.rotulo} />
        <button type="submit" className="acv-botao" data-cheio="" disabled={buscando}>{t.busca.buscar}</button>
      </form>
      <p id={`${id}-dica`} className="acv-dica" style={{ marginTop: "0.4rem" }}>{t.busca.dica}</p>
      <fieldset className="acv-filtros">
        <legend className="acv-rotulo">{t.busca.filtros}</legend>
        <label className="acv-filtro">
          <span>{t.busca.tipo}</span>
          <select className="acv-campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(t.busca.tipos).map(([valor, rotulo]) => <option key={valor} value={valor === "qualquer" ? "" : valor}>{rotulo}</option>)}
          </select>
        </label>
        <label className="acv-filtro">
          <span>{t.busca.tema} <small>({t.busca.temaDica})</small></span>
          <input className="acv-campo" maxLength={40} value={tema} onChange={(e) => setTema(e.target.value)} />
        </label>
        <label className="acv-filtro">
          <span>{t.busca.desde}</span>
          <input className="acv-campo" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
      </fieldset>
      {erro && <p role="alert" className="acv-aviso">{erro}</p>}
      <div role="status">{r && r.itens.length === 0 && <p className="acv-dica">{t.busca.nada}</p>}</div>
      {r && t3 && r.itens.length > 0 && (
        <ul className="acv-lista">
          {r.itens.map((p) => (
            <li key={p.id} style={{ padding: "0.4rem 0" }}>
              <PostCompacto post={p} lang={lang} s={s} t={t3} logado={logado} aoErro={aoErro} />
              {aoEscolher && !jaNaColecao.includes(p.id) && (
                <div className="acv-item-acoes">
                  <button type="button" className="acv-botao" data-pequeno="" onClick={() => aoEscolher(p)}>{t.busca.porNaColecao}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {r?.teto && <p className="acv-dica">{t.busca.teto}</p>}
      {r?.proximo && (
        <div className="acv-botoes">
          <button type="button" className="acv-botao" disabled={buscando} onClick={() => void buscar(r.proximo)}>{t.busca.mais}</button>
        </div>
      )}
    </section>
  );
}
