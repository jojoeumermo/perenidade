// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import { useAnuncio } from "./usarQuadro";
import { fraseDoEvento } from "./usarEventos";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { enderecos } from "@/lib/rede/tipos";
import type { Ato, MaisDoAto, OrgDoAto } from "@/lib/rede/tipos-atos";
import "./eventos.css";

/** Um carimbo de organização: o @ leva ao perfil público dela; o selo vai escrito, não só desenhado. */
function Carimbo({ org, lang, t }: { org: OrgDoAto; lang: string; t: TextosDosAtos }) {
  return (
    <Link href={enderecos.perfil(lang, org.handle)} className="al-ev-carimbo">
      <span className="al-ev-carimbo-nome">{org.nome}</span>
      <span className="al-ev-carimbo-handle">@{org.handle}</span>
      {org.selo ? (
        <span className="al-ev-selo" title={t.eventos.junto.selo}>
          <svg aria-hidden viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span className="sr-only">{t.eventos.junto.selo}</span>
        </span>
      ) : null}
    </Link>
  );
}

/**
 * "Chamado junto com" (L3-19): as organizações que aceitaram o convite aparecem no ato, cada uma com o @ público. Quem chamou
 * convida pelo @ e vê os convites sem resposta; quem gere uma organização convidada aceita ou recusa ali mesmo; quem gere uma
 * organização que já está no ato pode tirá-la. Pessoas nunca aparecem aqui: só organizações, que são públicas.
 */
export function JuntoCom({ ato, mais, t, lang, logado, trocar }: { ato: Ato; mais: MaisDoAto; t: TextosDosAtos; lang: string; logado: boolean; trocar: (m: MaisDoAto) => void }) {
  const tj = t.eventos.junto;
  const [handle, setHandle] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, anunciar] = useAnuncio();
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const aberto = ato.situacao !== "cancelado";

  const nada = mais.coletivos.length === 0 && mais.convites.length === 0 && mais.meus_convites.length === 0 && !(mais.chamou && aberto);
  if (nada) return null;

  const agir = async (f: () => Promise<MaisDoAto>, pronta: string) => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      trocar(await f());
      anunciar(pronta);
      titulo.current?.focus();
    } catch (e) {
      setErro(fraseDoEvento(t, e));
    } finally {
      setOcupado(false);
    }
  };
  const convidar = (e: FormEvent) => {
    e.preventDefault();
    const h = handle.trim().replace(/^@/, "");
    if (!h) {
      setErro(tj.vazioCampo);
      campo.current?.focus();
      return;
    }
    void agir(async () => {
      const m = await cliente.coletivoConvidar(ato.id, h);
      setHandle("");
      return m;
    }, tj.convidado);
  };

  return (
    <section className="al-ev al-ev-junto" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} ref={titulo} tabIndex={-1} className="al-cond al-ev-titulo">
        {tj.titulo}
      </h2>
      {mais.coletivos.length ? (
        <ul className="al-ev-carimbos" role="list">
          {mais.coletivos.map((o) => (
            <li key={o.handle}>
              <Carimbo org={o} lang={lang} t={t} />
            </li>
          ))}
        </ul>
      ) : null}

      {logado && mais.meus_convites.map((o) => (
        <div key={o.handle} className="al-ev-convite" role="group" aria-label={preencherAto(tj.conviteParaMim, { org: `@${o.handle}` })}>
          <p className="al-ev-convite-titulo">{preencherAto(tj.conviteParaMim, { org: o.nome })}</p>
          <p className="al-ev-ajuda">{tj.conviteExplica}</p>
          <div className="al-ev-acoes">
            <Botao variante="primario" disabled={ocupado} onClick={() => void agir(() => cliente.coletivoResponder(ato.id, o.handle, true), preencherAto(tj.aceito, { org: o.nome }))}>
              {tj.aceitar}
            </Botao>
            <Botao variante="contorno" disabled={ocupado} onClick={() => void agir(() => cliente.coletivoResponder(ato.id, o.handle, false), tj.recusado)}>
              {tj.recusar}
            </Botao>
          </div>
        </div>
      ))}

      {logado && mais.minhas_orgs.length ? (
        <div className="al-ev-acoes">
          {mais.minhas_orgs.map((o) => (
            <Botao key={o.handle} variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => void agir(() => cliente.coletivoTirar(ato.id, o.handle), preencherAto(tj.saiu, { org: o.nome }))}>
              {preencherAto(tj.sair, { org: o.nome })}
            </Botao>
          ))}
        </div>
      ) : null}

      {mais.chamou && aberto ? (
        <form className="al-ev-convidar" onSubmit={convidar} noValidate>
          <label htmlFor={`${id}-campo`} className="al-ev-rotulo">
            {tj.convidar}
          </label>
          <div className="al-ev-linha-campo">
            <input
              ref={campo}
              id={`${id}-campo`}
              className="al-ato-form-campo"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={tj.exemplo}
              maxLength={21}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${id}-ajuda${erro ? ` ${id}-erro` : ""}`}
              aria-invalid={erro ? true : undefined}
            />
            <Botao type="submit" variante="contorno" disabled={ocupado} aria-busy={ocupado || undefined}>
              {tj.enviar}
            </Botao>
          </div>
          <p id={`${id}-ajuda`} className="al-ev-ajuda">
            {tj.explica}
          </p>
        </form>
      ) : null}

      {mais.chamou && mais.convites.length ? (
        <div className="al-ev-pendentes">
          <h3 className="al-q-subtitulo">{tj.convites}</h3>
          <ul className="al-ev-carimbos" role="list">
            {mais.convites.map((o) => (
              <li key={o.handle} className="al-ev-pendente">
                <span className="al-ev-carimbo al-ev-carimbo-espera">
                  <span className="al-ev-carimbo-nome">{o.nome}</span>
                  <span className="al-ev-carimbo-handle">@{o.handle}</span>
                </span>
                <button type="button" className="al-q-tirar" disabled={ocupado} aria-label={preencherAto(tj.tirarConvite, { org: o.nome })} title={preencherAto(tj.tirarConvite, { org: o.nome })} onClick={() => void agir(() => cliente.coletivoTirar(ato.id, o.handle), preencherAto(tj.saiu, { org: o.nome }))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {erro ? (
        <p id={`${id}-erro`} role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}
