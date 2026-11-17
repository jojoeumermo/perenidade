// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { listaDeExemplo } from "@/lib/rede/conversa/exemplos";
import { forum, LIMITES_DO_FORUM, tituloSugerido } from "@/lib/rede/forum-conversa";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoForum } from "@/lib/rede/textos-forum-conversa";
import { enderecos, type Post } from "@/lib/rede/tipos";
import { previa } from "../conversa/base3";
import { erroDoForum } from "./base";
import "./forum.css";

/**
 * "Virar tópico" (onda 10, 10A): leva uma mensagem da conversa (ou a conversa inteira, pela raiz) para um tópico novo no fórum de uma
 * comunidade. O tópico novo cita a mensagem (quando quem escreveu deixa citar) e a conversa original ganha a marca "continua no
 * fórum". Quando a mensagem não é de quem leva, a tela diz que quem escreveu vai receber um aviso. Folha modal da casa (o <dialog>
 * do navegador: o foco fica dentro e Escape fecha), nunca o confirm do navegador.
 */
export function VirarTopico({ post, lang, s, tf, aoFechar }: { post: Post; lang: string; s: TextosDaRede; tf: TextosDoForum; aoFechar: () => void }) {
  const folha = useRef<HTMLDialogElement>(null);
  const id = useId();
  // Na prévia, o nome vem da lista de exemplo; com banco, a lista abaixo traz o nome (enquanto não chega, "carregando", nunca o endereço).
  const [opcoes, setOpcoes] = useState<{ slug: string; nome: string }[] | null>(() => {
    if (!previa()) return null;
    const slug = post.comunidade ?? "moradia-zona-leste";
    return [{ slug, nome: listaDeExemplo().find((c) => c.slug === slug)?.nome ?? slug }];
  });
  const [comunidade, setComunidade] = useState(() => post.comunidade ?? (previa() ? "moradia-zona-leste" : ""));
  const [titulo, setTitulo] = useState(() => (post.titulo ? post.titulo.slice(0, LIMITES_DO_FORUM.titulo) : tituloSugerido(post.texto)));
  const [corpo, setCorpo] = useState(tf.virar.corpoPadrao);
  const [tipo, setTipo] = useState<"discussao" | "duvida">("discussao");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<{ topico: string; avaliar: boolean } | null>(null);

  useEffect(() => {
    const d = folha.current;
    if (d && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute("open", "");
      }
    }
  }, []);

  // As comunidades onde a pessoa participa (o banco confere de novo quem pode levar para onde).
  useEffect(() => {
    if (previa()) return;
    let vivo = true;
    comunidades
      .lista()
      .then((r) => {
        if (!vivo) return;
        const minhas = r.itens.filter((c) => c.situacao === "membro").map((c) => ({ slug: c.slug, nome: c.nome }));
        const daqui = post.comunidade ? r.itens.find((c) => c.slug === post.comunidade) : null;
        const todas = [...(daqui ? [{ slug: daqui.slug, nome: daqui.nome }] : post.comunidade ? [{ slug: post.comunidade, nome: post.comunidade }] : []), ...minhas.filter((c) => c.slug !== post.comunidade)];
        setOpcoes(todas);
        setComunidade((c) => c || todas[0]?.slug || "");
      })
      .catch(() => vivo && setOpcoes((o) => o ?? []));
    return () => {
      vivo = false;
    };
  }, [post.comunidade]);

  async function enviar() {
    if (ocupado) return;
    if (!comunidade) return setErro(tf.erros["invalido:comunidade"]);
    if (titulo.trim().length < LIMITES_DO_FORUM.tituloMin) return setErro(tf.erros["invalido:titulo"]);
    if (corpo.trim().length < LIMITES_DO_FORUM.corpoMin) return setErro(tf.erros["invalido:corpo"]);
    setErro("");
    setOcupado(true);
    try {
      const r = previa() ? { topico: "00000000-0000-4000-8000-0000000000e1", avaliar: false } : await forum.virar(post.id, { comunidade, titulo: titulo.trim(), corpo: corpo.trim(), tipo });
      setFeito(r);
    } catch (e) {
      setErro(erroDoForum(tf, s, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <dialog
      ref={folha}
      className="f10 f10-folha"
      aria-labelledby={`${id}-t`}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        // Tocar fora da folha (no fundo escurecido) fecha.
        if (e.target === folha.current) aoFechar();
      }}
    >
      <div className="f10-folha-corpo">
        <h2 id={`${id}-t`} className="f10-cond f10-folha-titulo">{tf.virar.titulo}</h2>
        {feito ? (
          <>
            <p className="f10-status" role="status">{feito.avaliar ? tf.virar.avaliar : tf.virar.feito}</p>
            <div className="f10-acoes">
              <Link href={enderecos.post(lang, feito.topico)} className="al-botao al-botao-primario al-botao-m">{tf.virar.ver}</Link>
              <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={aoFechar}>{tf.virar.fechar}</button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <p className="f10-lead">{tf.virar.lead}</p>
            <blockquote className="f10-citado">{post.titulo || post.texto}</blockquote>
            {!post.meu && <p className="f10-aviso-autora">{tf.virar.avisoAutora}</p>}
            <label className="f10-campo">
              <span>{tf.virar.comunidade}</span>
              {opcoes === null ? (
                <small role="status">{tf.virar.carregandoComunidades}</small>
              ) : opcoes.length === 0 ? (
                <small>{tf.virar.semComunidade}</small>
              ) : opcoes.length === 1 ? (
                // Uma comunidade só: o nome dela, sem seletor de uma opção.
                <strong className="f10-comunidade-fixa">{opcoes[0].nome}</strong>
              ) : (
                <select value={comunidade} onChange={(e) => setComunidade(e.target.value)}>
                  {!comunidade && <option value="">{tf.virar.escolha}</option>}
                  {opcoes.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.nome}</option>
                  ))}
                </select>
              )}
            </label>
            <label className="f10-campo">
              <span>{tf.virar.tituloCampo}</span>
              <input value={titulo} maxLength={LIMITES_DO_FORUM.titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </label>
            <fieldset className="f10-campo f10-tipos">
              <legend>{tf.virar.tipo}</legend>
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
            <label className="f10-campo">
              <span>{tf.virar.corpo}</span>
              <textarea value={corpo} rows={3} maxLength={LIMITES_DO_FORUM.corpo} onChange={(e) => setCorpo(e.target.value)} required />
            </label>
            {erro && <p className="f10-erro" role="alert">{erro}</p>}
            <div className="f10-acoes">
              <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || !opcoes?.length}>{tf.virar.enviar}</button>
              <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={aoFechar}>{tf.virar.cancelar}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
