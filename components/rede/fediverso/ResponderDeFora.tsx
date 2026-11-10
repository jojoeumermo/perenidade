// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { deFora } from "@/lib/rede/fediverso/tela/cliente";
import { textoDoErroDeFora, type TextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { contaDoHandle, type CartaoDeFora } from "@/lib/rede/fediverso/tela/tipos";
import { preencher } from "@/lib/rede/preencher";
import { IconeEnviar } from "../conversa/base3";
import "../conversa/alumia3.css";

/** O teto do texto de uma resposta a alguém de fora (o mesmo da rota app/api/fediverso/responder). */
export const LIMITE_DA_RESPOSTA = 5000;
const LIMITE_DO_AVISO = 200;

/**
 * Dá para responder daqui? Não quando o banco não guarda a nota (`ao_vivo`) nem quando ela é só para seguidores (a resposta
 * sairia pública, e o banco recusa).
 */
export function podeResponderDeFora(post: Pick<CartaoDeFora, "ao_vivo" | "visibilidade">): boolean {
  return post.ao_vivo !== true && post.visibilidade !== "seguidores";
}

const campoDoAviso =
  "min-h-11 w-full rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] px-3 text-[var(--al-texto)] placeholder:text-[var(--al-texto-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--al-foco)]";

/**
 * "Responder para @conta@servidor": a caixa presa embaixo do fio de fora, no mesmo desenho da conversa nova (al3-responder).
 * A resposta vira um post público daqui e vai para o servidor de origem (app/api/fediverso/responder); o aviso de conteúdo é
 * opcional. Nota que o banco não guarda (`ao_vivo`) ou que é só para seguidores não recebe resposta: a caixa diz isso antes de
 * a pessoa escrever, em vez de falhar depois.
 */
export default function ResponderDeFora({
  post,
  t,
  campo: campoDeFora,
  aoEnviar,
}: {
  post: CartaoDeFora;
  t: TextosDoFediverso;
  /** Para o "Responder" do cartão levar o foco até aqui. */
  campo?: RefObject<HTMLTextAreaElement | null>;
  /** Depois de enviar: o id do post novo (nulo na prévia). */
  aoEnviar?: (id: string | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [comAviso, setComAviso] = useState(false);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [recado, setRecado] = useState("");
  const [caixa, setCaixa] = useState<HTMLElement | null>(null);
  const campoProprio = useRef<HTMLTextAreaElement>(null);
  const campo = campoDeFora ?? campoProprio;
  const id = useId();
  const conta = contaDoHandle(post.handle_remoto) ?? post.nome_remoto ?? post.autor.codinome;
  const rotulo = preencher(t.fio.responderPara, { conta });

  // A altura da caixa presa embaixo vai para a página (--al3-caixa-h), como na conversa daqui: nada fica escondido atrás dela.
  useEffect(() => {
    const el = caixa;
    if (!el || typeof ResizeObserver === "undefined") return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--al3-caixa-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => {
      ro.disconnect();
      raiz.style.removeProperty("--al3-caixa-h");
    };
  }, [caixa]);

  if (!podeResponderDeFora(post)) {
    return (
      <div className="al3-responder" ref={setCaixa}>
        <p className="al3-cinza" style={{ gridColumn: "1 / -1", margin: 0 }}>{post.ao_vivo ? t.fio.semResposta : t.fio.semRespostaSeguidores}</p>
      </div>
    );
  }

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErro("");
    setRecado("");
    const r = await deFora.responder(post.id, limpo.slice(0, LIMITE_DA_RESPOSTA), comAviso ? aviso.trim().slice(0, LIMITE_DO_AVISO) : "");
    setEnviando(false);
    if (!r.ok) {
      setErro(textoDoErroDeFora(t, r.erro));
      return;
    }
    setTexto("");
    setAviso("");
    setComAviso(false);
    if (campo.current) campo.current.style.height = "";
    setRecado(t.fio.enviada);
    aoEnviar?.(r.dado.id);
  }

  return (
    <form
      ref={setCaixa}
      className="al3-responder"
      data-enviando={enviando ? "sim" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <div className="al3-responder-linha">
        <span id={`${id}-publica`}>{t.fio.respostaPublica}</span>
        <button type="button" aria-expanded={comAviso} aria-controls={`${id}-aviso`} onClick={() => setComAviso((v) => !v)}>
          {t.cartao.avisoDeConteudo}
        </button>
      </div>
      {(erro || recado) && (
        <div className="al3-responder-linha">
          {erro ? <span role="alert" style={{ color: "var(--al-vermelho)" }}>{erro}</span> : <span role="status">{recado}</span>}
        </div>
      )}
      <div id={`${id}-aviso`} hidden={!comAviso} style={{ gridColumn: "1 / -1" }}>
        <label className="al3-sr" htmlFor={`${id}-aviso-campo`}>{t.cartao.avisoDeConteudo}</label>
        <input
          id={`${id}-aviso-campo`}
          value={aviso}
          maxLength={LIMITE_DO_AVISO}
          placeholder={t.cartao.avisoDeConteudo}
          autoComplete="off"
          onChange={(e) => setAviso(e.target.value)}
          className={campoDoAviso}
        />
      </div>
      <label className="al3-sr" htmlFor={`${id}-texto`}>{rotulo}</label>
      <textarea
        id={`${id}-texto`}
        ref={campo}
        rows={1}
        maxLength={LIMITE_DA_RESPOSTA}
        placeholder={rotulo}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          // Altura automática: cresce com o texto até o teto do CSS.
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          // Ctrl/⌘ + Enter envia (Enter sozinho quebra a linha).
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void enviar();
          }
        }}
        aria-describedby={`${id}-publica ${id}-contador`}
      />
      <button type="submit" className="al3-enviar" disabled={enviando || !texto.trim()} aria-label={t.fio.enviar} title={t.fio.enviar}>
        <IconeEnviar />
      </button>
      <span id={`${id}-contador`} className="al3-sr">{preencher(t.fio.contador, { n: texto.length, max: LIMITE_DA_RESPOSTA })}</span>
      {texto.length > LIMITE_DA_RESPOSTA - 200 && (
        <span className="al3-contador-visivel" aria-hidden data-perto={texto.length >= LIMITE_DA_RESPOSTA ? "fim" : "perto"}>
          {LIMITE_DA_RESPOSTA - texto.length}
        </span>
      )}
    </form>
  );
}
