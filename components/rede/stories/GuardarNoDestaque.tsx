// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { CORES_DO_STORY, LIMITES_DO_STORY, type CorDoStory, type DestaqueDeStories, type Story } from "@/lib/rede/tipos-stories";
import { CapaDoDestaque } from "./CapaDoDestaque";
import { IconeMais } from "./icones";
import { codigoDoErro, preencherStory } from "./usar";

/**
 * "Guardar no destaque" (do menu ⋯ do meu story): os meus destaques (marcado onde ele já está), ou um novo com nome e cor. Avisa
 * que o story fica no perfil depois das 24 h, para o mesmo público, e nunca vai ao Fediverso.
 */
export function GuardarNoDestaque({
  t,
  cliente,
  story,
  aoFechar,
  aoGuardar,
}: {
  t: TextosDosStories;
  cliente: ClienteDeStories;
  story: Story;
  aoFechar: () => void;
  aoGuardar: (recado: string, destaque: string) => void;
}) {
  const [lista, setLista] = useState<DestaqueDeStories[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [cor, setCor] = useState<CorDoStory>(story.fundo.cor);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    let vivo = true;
    cliente
      .destaques(story.autora.handle)
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [cliente, story.autora.handle]);

  async function guardar(destaque: string | null) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await cliente.salvarDestaque({ destaque, titulo: destaque ? null : titulo.trim(), story: story.id, cor: destaque ? null : cor });
      aoGuardar(preencherStory(t.destaques.guardado, { titulo: r.titulo }), r.id);
    } catch (e) {
      const c = e instanceof Error && /limite:destaques/.test(e.message) ? "limite" : codigoDoErro(e);
      setErro(c === "limite" ? t.destaques.limite : c === "dadoPessoal" ? t.criar.erro.dadoPessoal : t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  const ja = new Set(story.destaques ?? []);
  const cheio = (lista?.length ?? 0) >= LIMITES_DO_STORY.destaques;
  return (
    <form
      className="al-st-caixa al-st-guardar"
      aria-labelledby={`${id}-t`}
      onSubmit={(e) => {
        e.preventDefault();
        if (titulo.trim()) void guardar(null);
      }}
    >
      <h2 id={`${id}-t`}>{t.destaques.guardarTitulo}</h2>
      <p>{t.destaques.aviso}</p>
      {lista === null ? (
        <p role="status">…</p>
      ) : lista.length > 0 ? (
        <ul className="al-st-guardar-lista">
          {lista.map((d) => (
            <li key={d.id}>
              <button type="button" className="al-st-guardar-item" disabled={ocupado || ja.has(d.id)} onClick={() => void guardar(d.id)}>
                <span className="al-st-destaque-capa al-st-destaque-capa-p" aria-hidden>
                  <CapaDoDestaque d={d} />
                </span>
                <span>{ja.has(d.id) ? preencherStory(t.destaques.jaEsta, { titulo: d.titulo }) : d.titulo}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!cheio ? (
        <fieldset className="al-st-guardar-novo">
          <legend>{t.destaques.novo}</legend>
          <label htmlFor={`${id}-n`} className="sr-only">
            {t.destaques.nome}
          </label>
          <input id={`${id}-n`} value={titulo} maxLength={LIMITES_DO_STORY.tituloDoDestaque} placeholder={t.destaques.nome} onChange={(e) => setTitulo(e.target.value)} />
          <div className="al-st-guardar-cores" role="radiogroup" aria-label={t.destaques.cor}>
            {CORES_DO_STORY.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={t.criar.cor[c]} className="al-st-cor" style={{ background: PALETA_DO_STORY[c].fundo }} onClick={() => setCor(c)} />
            ))}
          </div>
        </fieldset>
      ) : (
        <p>{t.destaques.limite}</p>
      )}
      {erro ? (
        <p role="alert" style={{ color: "#ff8a7a", fontWeight: 700 }}>
          {erro}
        </p>
      ) : null}
      <div className="al-st-caixa-acoes">
        <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={aoFechar}>
          {t.visor.cancelar}
        </button>
        {!cheio ? (
          <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || !titulo.trim()}>
            <IconeMais /> {t.destaques.criar}
          </button>
        ) : null}
      </div>
    </form>
  );
}
