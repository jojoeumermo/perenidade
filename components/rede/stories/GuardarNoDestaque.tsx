// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import type { TextosPublicar } from "@/lib/rede/textos-publicar";
import { BorrarRostos } from "../publicar/BorrarRostos";
import { aplicarBorrado } from "../publicar/imagem";
import { carregarTextosPublicar } from "../publicar/textos";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { CORES_DO_STORY, LIMITES_DO_STORY, type CorDoStory, type DestaqueDeStories, type Story } from "@/lib/rede/tipos-stories";
import { CapaDoDestaque } from "./CapaDoDestaque";
import { IconeMais } from "./icones";
import { codigoDoErro, preencherStory } from "./usar";

/**
 * "Guardar no destaque" (do menu ⋯ do meu story): os meus destaques (marcado onde ele já está), ou um novo com nome e cor. Avisa
 * que o story fica no perfil depois das 24 h, para o mesmo público, e nunca vai ao Fediverso. Story com FOTO passa pelo borrar de
 * novo antes (B1; LGPD art. 11: quem aparece num ato tem opinião política exposta): a pessoa responde "Borrar rostos" (a foto é
 * refeita no aparelho e troca a do story, rede_story_trocar_midia) ou "Guardar assim"; só então escolhe o destaque.
 */
export function GuardarNoDestaque({
  t,
  cliente,
  story,
  lang = "pt",
  aoFechar,
  aoGuardar,
  aoTrocarFoto,
}: {
  t: TextosDosStories;
  cliente: ClienteDeStories;
  story: Story;
  lang?: string;
  aoFechar: () => void;
  aoGuardar: (recado: string, destaque: string) => void;
  /** A foto do story foi borrada e trocada: o visor passa a mostrar a nova (endereço local, até reabrir). */
  aoTrocarFoto?: (url: string) => void;
}) {
  const [lista, setLista] = useState<DestaqueDeStories[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [cor, setCor] = useState<CorDoStory>(story.fundo.cor);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();
  const temFoto = story.fundo.tipo === "imagem" && !!story.fundo.url;
  const [passo, setPasso] = useState<"perguntar" | "borrando" | "refazendo" | "pronto">(temFoto ? "perguntar" : "pronto");
  const [base, setBase] = useState<Blob | null>(null);
  const [tp, setTp] = useState<TextosPublicar | null>(null);
  const [recado, setRecado] = useState("");

  async function abrirBorrar() {
    if (story.fundo.tipo !== "imagem") return;
    setErro(null);
    try {
      const [b, textos] = await Promise.all([fetch(story.fundo.url, { referrerPolicy: "no-referrer", credentials: "omit" }).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("falha")))), carregarTextosPublicar(lang)]);
      setBase(b);
      setTp(textos);
      setPasso("borrando");
    } catch {
      setErro(t.b1.borrar.erro);
    }
  }

  async function aplicar(areas: { x: number; y: number; w: number; h: number }[]) {
    if (!base || areas.length === 0) return setPasso("pronto");
    setPasso("refazendo");
    try {
      const nova = await aplicarBorrado(base, areas);
      const caminho = await cliente.enviarImagem(nova);
      await cliente.trocarMidia(story.id, caminho);
      aoTrocarFoto?.(URL.createObjectURL(nova));
      setRecado(t.b1.borrar.feito);
      setPasso("pronto");
    } catch {
      setErro(t.b1.borrar.erro);
      setPasso("perguntar");
    }
  }

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
        if (titulo.trim() && passo === "pronto") void guardar(null);
      }}
    >
      <h2 id={`${id}-t`}>{t.destaques.guardarTitulo}</h2>
      <p>{t.destaques.aviso}</p>
      {passo === "perguntar" || passo === "refazendo" ? (
        <div className="al-st-guardar-borrar" role="group" aria-labelledby={`${id}-b`}>
          <p id={`${id}-b`}>{t.b1.borrar.pergunta}</p>
          <div className="al-st-caixa-acoes" style={{ justifyContent: "flex-start", marginTop: 0 }}>
            <button type="button" className="al-botao al-botao-claro al-botao-m" disabled={passo === "refazendo"} aria-busy={passo === "refazendo"} onClick={() => void abrirBorrar()}>
              {passo === "refazendo" ? t.b1.borrar.refazendo : t.b1.borrar.borrar}
            </button>
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" disabled={passo === "refazendo"} onClick={() => setPasso("pronto")}>
              {t.b1.borrar.assim}
            </button>
          </div>
        </div>
      ) : recado ? (
        <p role="status">{recado}</p>
      ) : null}
      {passo === "borrando" && base && tp ? <BorrarRostos t={tp} base={base} areasIniciais={[]} aoCancelar={() => setPasso("perguntar")} aoConcluir={(a) => void aplicar(a)} /> : null}
      {lista === null ? (
        <p role="status">…</p>
      ) : lista.length > 0 ? (
        <ul className="al-st-guardar-lista">
          {lista.map((d) => (
            <li key={d.id}>
              <button type="button" className="al-st-guardar-item" disabled={ocupado || ja.has(d.id) || passo !== "pronto"} onClick={() => void guardar(d.id)}>
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
          <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || !titulo.trim() || passo !== "pronto"}>
            <IconeMais /> {t.destaques.criar}
          </button>
        ) : null}
      </div>
    </form>
  );
}
