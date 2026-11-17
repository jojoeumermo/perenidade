// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import type { ConviteDeCoautoria } from "@/lib/rede/tipos-conversa";
import type { ContextoDoEncaixe } from "../encaixes";
import { coautoria } from "./cliente";
import { encher, textoDoErro } from "./textos";
import { avisarQueMudou, useTextosDaCoautoria } from "./use-cartao";
import "./coautoria.css";

/**
 * No alto do Início (encaixe topoDaLinha): um aviso neutro quando há convites para assinar junto esperando a resposta da pessoa,
 * com aceitar e recusar ali mesmo. Só ela vê os convites dela; recusar não avisa ninguém.
 */
export default function ConvitesNoTopo({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDaCoautoria(lang);
  const [lista, setLista] = useState<ConviteDeCoautoria[]>([]);
  const [aberta, setAberta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [vez, setVez] = useState(0);
  const id = useId();

  useEffect(() => {
    if (!situacao.logado || !situacao.membro) return;
    let vivo = true;
    coautoria.convites().then((l) => vivo && setLista(l)).catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [situacao.logado, situacao.membro, vez]);

  if (!t || (lista.length === 0 && !nota)) return null;

  async function decidir(post: string, aceitar: boolean) {
    if (!t) return;
    setOcupado(true);
    try {
      await coautoria.decidir(post, aceitar);
      setNota({ texto: aceitar ? t.assinar.aceitou : t.assinar.recusou });
      avisarQueMudou(post);
      setVez((v) => v + 1);
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="co-topo" aria-labelledby={`${id}-t`}>
      {lista.length > 0 && (
        <div className="co-topo-alto">
          <span className="co-ladrilhos" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <p id={`${id}-t`} className="co-topo-frase">
            {lista.length === 1 ? t.assinar.noTopoUm : encher(t.assinar.noTopoVarios, { n: lista.length })}
          </p>
          <button type="button" className="co-botao" aria-expanded={aberta} aria-controls={`${id}-l`} onClick={() => setAberta((a) => !a)}>
            {aberta ? t.assinar.esconder : t.assinar.ver}
          </button>
        </div>
      )}
      {aberta && lista.length > 0 && (
        <ul id={`${id}-l`} className="co-lista">
          {lista.map((c) => (
            <li key={c.post} className="co-item co-item-convite">
              <div>
                <strong>{encher(t.assinar.convidadaTitulo, { codinome: c.codinome })}</strong>
                <p>{c.trecho}</p>
                <Link href={`/${lang}/alumia/p/${c.post}`} className="co-link">
                  {t.assinar.abrirPost}
                </Link>
              </div>
              <div className="co-linha">
                <button type="button" className="co-botao co-botao-cheio" disabled={ocupado} onClick={() => void decidir(c.post, true)}>
                  {t.assinar.aceitar}
                </button>
                <button type="button" className="co-botao" disabled={ocupado} onClick={() => void decidir(c.post, false)}>
                  {t.assinar.recusar}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {nota && <p className="co-nota" role={nota.erro ? "alert" : "status"} data-erro={nota.erro ? "" : undefined}>{nota.texto}</p>}
    </section>
  );
}
