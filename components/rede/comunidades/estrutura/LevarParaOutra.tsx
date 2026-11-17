// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { listaDeExemplo } from "@/lib/rede/conversa/exemplos";
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import { preencher } from "@/lib/rede/preencher";
import type { Post } from "@/lib/rede/tipos";
import type { ItemDaLista } from "@/lib/rede/tipos-comunidades";
import { previa } from "../../conversa/base3";
import type { ContextoDoEncaixe } from "../../encaixes";
import { mensagemDeErro, useTextosEstrutura } from "./base";
import "./estrutura.css";

function Seta() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h12M12 6l6 6-6 6" />
      <path d="M4 5v14" />
    </svg>
  );
}

/** O post pode viajar? Só o de primeiro nível com público de toda a Alumia (ou da internet). O banco confere de novo. */
export function podeLevar(post: Post): boolean {
  return post.resposta_a === null && (post.publico === "membros" || post.publico === "internet") && !post.retido;
}

/**
 * No menu "mais" do cartão (encaixe acoesDoCartao): levar o post a outra comunidade, com um comentário. Vai citado, com a
 * comunidade de origem à vista (alumia_estr_repostar). Só aparece com conta e para post que pode viajar. A folha abre no corpo da
 * página (portal), não dentro do menu: um ancestral do cartão com contêiner ou transformação prenderia o "fixed" dela ali. Abrir
 * fecha o menu; fechar devolve o foco ao botão "mais".
 */
export function LevarParaOutra({ lang, s, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  const [aberto, setAberto] = useState(false);
  const volta = useRef<HTMLElement | null>(null);
  // Fora da casca, a folha leva os atributos dela (data-al e o tema): os tokens e os botões da Alumia valem só dentro de [data-al="2"].
  const [pele, setPele] = useState<Record<string, string>>({});
  const te = useTextosEstrutura(lang, situacao.logado && situacao.membro);
  if (!te || !situacao.logado || !situacao.membro || !podeLevar(post)) return null;
  function abrir(e: React.MouseEvent<HTMLButtonElement>) {
    const casca = e.currentTarget.closest<HTMLElement>('[data-al="2"]');
    setPele(Object.fromEntries(["data-al", "data-al-tema", "data-al-sem-numeros"].flatMap((n) => (casca?.hasAttribute(n) ? [[n, casca.getAttribute(n) ?? ""]] : []))));
    const menu = e.currentTarget.closest("details");
    volta.current = menu?.querySelector("summary") ?? null;
    menu?.removeAttribute("open");
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    requestAnimationFrame(() => volta.current?.focus());
  }
  return (
    <div onClick={(e) => e.stopPropagation()} className="contents">
      <button type="button" className="al2-acao justify-start" onClick={abrir}>
        <Seta />
        {te.levar.botao}
      </button>
      {aberto && typeof document !== "undefined" && createPortal(<Folha lang={lang} s={s} post={post} te={te} pele={pele} aoFechar={fechar} />, document.body)}
    </div>
  );
}

function Folha({ s, post, te, pele, aoFechar }: { lang: string; s: ContextoDoEncaixe["s"]; post: Post; te: NonNullable<ReturnType<typeof useTextosEstrutura>>; pele: Record<string, string>; aoFechar: () => void }) {
  const l = te.levar;
  const id = useId();
  const [destinos, setDestinos] = useState<ItemDaLista[] | null>(null);
  const [destino, setDestino] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<{ texto: string; erro: boolean } | null>(null);
  const primeiro = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    let vivo = true;
    (previa() ? Promise.resolve({ itens: listaDeExemplo().map((c) => ({ ...c, situacao: "membro" as const })) }) : comunidades.lista()).then(
      (r) => {
        if (!vivo) return;
        // Onde a pessoa pode postar: as que ela participa e as abertas (o banco decide de verdade, inclusive o modo só leitura).
        setDestinos(r.itens.filter((c) => !c.amostra && c.slug !== post.comunidade && c.situacao !== "banido" && (c.situacao === "membro" || c.tipo === "aberta")));
      },
      () => vivo && setDestinos([]),
    );
    return () => {
      vivo = false;
    };
  }, [post.comunidade]);

  useEffect(() => {
    primeiro.current?.focus();
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aoFechar, destinos]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!destino || !texto.trim() || ocupado) return;
    setOcupado(true);
    setRetorno(null);
    try {
      const r = await cliente.repostar(post.id, destino, texto.trim());
      const nome = destinos?.find((d) => d.slug === destino)?.nome ?? r.destino.nome;
      setRetorno({ texto: preencher(l.levado, { nome }), erro: false });
      setTexto("");
    } catch (erro) {
      setRetorno({ texto: mensagemDeErro(s, te, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  const trecho = post.titulo || post.texto;
  return (
    <div {...pele} className="al-pele e10-folha-fundo" onClick={aoFechar}>
      <div className="e10 e10-folha" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onClick={(e) => e.stopPropagation()}>
        <h2 id={`${id}-t`} className="e10-cond">{l.titulo}</h2>
        <p className="e10-lead">{l.intro}</p>
        <blockquote className="e10-citado">{trecho.length > 180 ? `${trecho.slice(0, 180)}…` : trecho}</blockquote>
        {destinos === null ? (
          <p className="e10-nota" role="status">{te.carregando}</p>
        ) : destinos.length === 0 ? (
          <p className="e10-vazio">{l.semDestino}</p>
        ) : (
          <form className="e10-campos" onSubmit={enviar}>
            <label className="e10-campo">
              {l.destino}
              <select ref={primeiro} value={destino} onChange={(e) => setDestino(e.target.value)} required>
                <option value="">{l.destinoVazio}</option>
                {destinos.map((d) => <option key={d.slug} value={d.slug}>{d.nome}</option>)}
              </select>
            </label>
            <label className="e10-campo">
              {l.comentario}
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} required placeholder={l.comentarioExemplo} />
            </label>
            <div className="e10-acoes">
              <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || !destino || !texto.trim()}>{l.enviar}</button>
              <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={aoFechar}>{te.cancelar}</button>
            </div>
          </form>
        )}
        {retorno && <p role={retorno.erro ? "alert" : "status"} className={retorno.erro ? "e10-erro" : "e10-status"}>{retorno.texto}</p>}
      </div>
    </div>
  );
}

export default LevarParaOutra;
