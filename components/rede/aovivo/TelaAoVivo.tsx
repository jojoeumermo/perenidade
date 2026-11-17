// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "@/components/Link";
import { aoVivo } from "@/lib/rede/mapa/cliente";
import type { AgendaAoVivo, SessaoAoVivo } from "@/lib/rede/mapa/tipos";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import { fraseDoErro } from "../mapa/comum";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Faixa } from "../ui/Faixa";
import { CabecaDaSessao, SessaoAoVivoTela } from "./SessaoAoVivo";
import type { TextosDoAoVivo } from "./textos";
import { useTextosDoAoVivo } from "./usar";
import "./aovivo.css";

type T = TextosDoAoVivo;

function CartaoDaSessao({ t, lang, s, children }: { t: T; lang: string; s: SessaoAoVivo; children?: ReactNode }) {
  return (
    <li className="av-cartao" data-momento={s.momento}>
      <CabecaDaSessao t={t} lang={lang} s={s} nivel={3} />
      <div className="av-acoes">
        {children ?? (
          <Link href={`/${lang}/alumia/mapa/ao-vivo?s=${encodeURIComponent(s.id)}`} className="av-link">{t.agenda.abrir}</Link>
        )}
      </div>
    </li>
  );
}

/**
 * As perguntas ao vivo (/alumia/mapa/ao-vivo; frente 13B, L1-17). Sem ?s: a agenda (no ar agora, próximos 14 dias e os convites da
 * pessoa para responder). Com ?s=<id>: a sessão, com as perguntas por ordem de chegada. Computador primeiro: a agenda em duas
 * colunas (no ar e próximas à esquerda, convites à direita); no celular, uma coluna só.
 */
export default function TelaAoVivo({ lang, situacao, params }: Pick<PropsDaTelaDoPacote, "lang" | "s" | "situacao" | "params">) {
  const t = useTextosDoAoVivo(lang);
  const t3 = useTextosAlumia3(lang);
  const id = useId();
  const sessao = params?.s ?? "";
  const [agenda, setAgenda] = useState<AgendaAoVivo | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [vez, setVez] = useState(0);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (sessao) return;
    let vivo = true;
    aoVivo.agenda().then(
      (a) => {
        if (!vivo) return;
        setAgenda(a);
        setErro(null);
      },
      (e: unknown) => vivo && setErro(e ?? new Error("falha")),
    );
    return () => {
      vivo = false;
    };
  }, [sessao, vez]);

  if (!t) return <p role="status" className="av-pagina av-miudo">…</p>;

  async function responderConvite(idDaSessao: string, aceita: boolean) {
    if (!t) return;
    setOcupado(true);
    try {
      await aoVivo.convite(idDaSessao, aceita);
      setAviso({ texto: aceita ? t.agenda.aceito : t.agenda.recusado });
      setVez((v) => v + 1);
    } catch (e) {
      setAviso({ texto: fraseDoErro(t.erros, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="av-pagina">
      {t3 && <FaixaDaPrevia t={t3} />}
      {sessao ? (
        <SessaoAoVivoTela t={t} lang={lang} id={sessao} situacao={situacao} />
      ) : (
        <article aria-labelledby={`${id}-titulo`} className="av-agenda">
          <header className="av-cabeca">
            <Faixa className="av-faixa" />
            <h1 id={`${id}-titulo`} className="av-titulo al-cond">{t.titulo}</h1>
            <p className="av-chamada">{t.chamada}</p>
          </header>
          <p className="av-aviso" role="status" aria-live="polite" data-erro={aviso?.erro ? "" : undefined}>{aviso?.texto ?? ""}</p>
          {erro && !agenda ? (
            <EstadoDaAlumia erro texto={fraseDoErro(t.erros, erro)}>
              <Botao variante="contorno" onClick={() => setVez((v) => v + 1)}>{t.tentar}</Botao>
            </EstadoDaAlumia>
          ) : !agenda ? (
            <p className="av-miudo" role="status">{t.carregando}</p>
          ) : (
            <div className="av-colunas">
              <div className="av-principal">
                <section aria-labelledby={`${id}-agora`}>
                  <h2 id={`${id}-agora`} className="av-subtitulo al-cond">{t.agenda.agora}</h2>
                  {agenda.ao_vivo.length === 0 ? (
                    <p className="av-miudo">{t.agenda.vazioAgora}</p>
                  ) : (
                    <ul className="av-lista">{agenda.ao_vivo.map((s) => <CartaoDaSessao key={s.id} t={t} lang={lang} s={s} />)}</ul>
                  )}
                </section>
                <section aria-labelledby={`${id}-prox`}>
                  <h2 id={`${id}-prox`} className="av-subtitulo al-cond">{t.agenda.proximas}</h2>
                  {agenda.proximas.length === 0 ? (
                    <p className="av-miudo">{t.agenda.vazioProximas}</p>
                  ) : (
                    <ul className="av-lista">{agenda.proximas.map((s) => <CartaoDaSessao key={s.id} t={t} lang={lang} s={s} />)}</ul>
                  )}
                </section>
              </div>
              <aside className="av-lado">
                {agenda.convites.length > 0 && (
                  <section aria-labelledby={`${id}-conv`}>
                    <h2 id={`${id}-conv`} className="av-subtitulo al-cond">{t.agenda.convites}</h2>
                    <ul className="av-lista">
                      {agenda.convites.map((s) => (
                        <CartaoDaSessao key={s.id} t={t} lang={lang} s={s}>
                          <Botao tamanho="p" disabled={ocupado} onClick={() => void responderConvite(s.id, true)}>{t.agenda.aceitar}</Botao>
                          <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void responderConvite(s.id, false)}>{t.agenda.recusar}</Botao>
                        </CartaoDaSessao>
                      ))}
                    </ul>
                  </section>
                )}
                <p className="av-cartao av-miudo">{t.sessao.regra}</p>
                <p className="av-cartao av-miudo">{t.agenda.comoMarcar}</p>
              </aside>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
