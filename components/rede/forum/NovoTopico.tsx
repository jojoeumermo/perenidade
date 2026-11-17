// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { rede } from "@/lib/rede/cliente";
import { LIMITES_DO_FORUM } from "@/lib/rede/forum-conversa";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Situacao } from "@/lib/rede/tipos";
import type { TextosDoForum } from "@/lib/rede/textos-forum-conversa";
import { verificarAntesDePublicar } from "../encaixes";
import { previa } from "../conversa/base3";
import { erroDoForum } from "./base";

/**
 * Abrir um tópico dentro da aba Fórum: título, tipo (discussão ou dúvida), etiqueta da comunidade (se ela tem) e a primeira mensagem.
 * Publica pelo mesmo caminho de todo post (rede_publicar, com todas as conferências do banco) e roda antes as verificações dos
 * encaixes (o modo lento e o filtro da comunidade avisam antes de gastar a tentativa).
 */
export function NovoTopico({
  slug,
  lang,
  s,
  situacao,
  tf,
  etiquetas,
  aoFechar,
  aoPublicar,
}: {
  slug: string;
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  tf: TextosDoForum;
  etiquetas: string[];
  aoFechar: () => void;
  aoPublicar: (aviso: string) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [tipo, setTipo] = useState<"discussao" | "duvida">("discussao");
  const [etiqueta, setEtiqueta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; seguir: boolean } | null>(null);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const id = useId();
  const tituloOk = titulo.trim().length >= LIMITES_DO_FORUM.tituloMin && titulo.trim().length <= LIMITES_DO_FORUM.titulo;
  const corpoOk = corpo.trim().length >= LIMITES_DO_FORUM.corpoMin;

  useEffect(() => {
    campoTitulo.current?.focus();
  }, []);

  async function publicar(forcar = false) {
    if (ocupado) return;
    if (!tituloOk) return setErro(tf.erros["invalido:titulo"]);
    if (!corpoOk) return setErro(tf.erros["invalido:corpo"]);
    setErro("");
    setOcupado(true);
    try {
      if (!forcar) {
        const antes = await verificarAntesDePublicar({ texto: corpo, tipo, publico: "", comunidade: slug, extras: {} }, { lang, s, situacao });
        if (!antes.ok) {
          setAviso({ texto: antes.aviso, seguir: !antes.bloqueia });
          return;
        }
      }
      if (previa()) {
        aoPublicar(tf.novo.feito);
        return;
      }
      const r = await rede.publicar({ tipo, titulo: titulo.trim(), corpo: corpo.trim(), comunidade: slug, flair: etiqueta || null });
      aoPublicar(r.avaliar || r.retido ? tf.novo.avaliar : tf.novo.feito);
    } catch (e) {
      setErro(erroDoForum(tf, s, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      className="f10-form"
      aria-labelledby={`${id}-t`}
      onSubmit={(e) => {
        e.preventDefault();
        void publicar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          aoFechar();
        }
      }}
    >
      <h3 id={`${id}-t`} className="f10-cond f10-form-titulo">{tf.novo.titulo}</h3>
      <label className="f10-campo">
        <span>{tf.novo.tituloCampo}</span>
        <input ref={campoTitulo} value={titulo} maxLength={LIMITES_DO_FORUM.titulo} onChange={(e) => setTitulo(e.target.value)} aria-describedby={`${id}-td`} required />
        <small id={`${id}-td`}>{tf.novo.tituloDica}</small>
      </label>
      <div className="f10-campos-2">
        <fieldset className="f10-campo f10-tipos">
          <legend>{tf.novo.tipo}</legend>
          <div>
            <label>
              <input type="radio" name={`${id}-tipo`} checked={tipo === "discussao"} onChange={() => setTipo("discussao")} />
              {tf.item.discussao}
            </label>
            <label>
              <input type="radio" name={`${id}-tipo`} checked={tipo === "duvida"} onChange={() => setTipo("duvida")} />
              {tf.item.duvida}
            </label>
          </div>
        </fieldset>
        {etiquetas.length > 0 && (
          <label className="f10-campo">
            <span>{tf.novo.etiqueta}</span>
            <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
              <option value="">{tf.etiqueta.nenhuma}</option>
              {etiquetas.map((nome) => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="f10-campo">
        <span>{tf.novo.corpo}</span>
        <textarea value={corpo} maxLength={LIMITES_DO_FORUM.corpo} rows={5} onChange={(e) => setCorpo(e.target.value)} aria-describedby={`${id}-cd`} required />
        <small id={`${id}-cd`}>{tf.novo.corpoDica}</small>
      </label>
      {aviso && (
        <div className="f10-aviso" role="alert">
          <p>{aviso.texto}</p>
          {aviso.seguir && (
            <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} onClick={() => void publicar(true)}>
              {tf.novo.enviar}
            </button>
          )}
        </div>
      )}
      {erro && <p className="f10-erro" role="alert">{erro}</p>}
      <div className="f10-acoes">
        <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado}>{tf.novo.enviar}</button>
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={aoFechar}>{tf.novo.cancelar}</button>
      </div>
    </form>
  );
}
