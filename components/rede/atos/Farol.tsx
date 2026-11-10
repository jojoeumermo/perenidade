// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O FAROL DO ATO (ALUMIA-FUNCOES-E-IDEIAS §2.1, ideia 1): o estado oficial do ato, assinado por DUAS pessoas da coordenação.
// Em ato, boato mata: o farol é a única coisa na Alumia com o carimbo "CONFIRMADO PELA COORDENAÇÃO", e nenhum post comum consegue
// imitar este componente (ele só nasce do rede_ato_farol). Quatro estados: tranquilo (verde), atenção (âmbar), dispersar
// (vermelho) e ponto de encontro 2 (azul, com o novo ponto). Só quem confirmou presença ou coordena vê. Sem GPS.
//   FaixaDoFarol   o farol para quem vai (no ato aberto e na página do ato); pulsa e vibra quando muda;
//   PainelDoFarol  a coordenação pede um estado; a segunda pessoa confirma o mesmo estado (15 min).
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Botao } from "../ui/Botao";
import { frase, useFarol } from "./usar";
import { MOLAS, podeMexer } from "@/lib/rede/atos/movimento";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { ESTADOS_DO_FAROL, type Ato, type EstadoDoFarol } from "@/lib/rede/tipos-atos";
import "./atos.css";

/** "há 12 min" / "há 2 h" / "agora há pouco". */
export function haQuanto(t: TextosDosAtos, iso: string | null, agora = Date.now()): string {
  if (!iso) return t.farol.nunca;
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000));
  if (min < 2) return t.farol.agora;
  if (min < 60) return preencherAto(t.farol.minutos, { n: min });
  return preencherAto(t.farol.horas, { n: Math.floor(min / 60) });
}

/** A lâmpada do farol: um lampião de ladrilhos que brilha na cor do estado. */
function Lampada({ estado }: { estado: EstadoDoFarol }) {
  return (
    <span className="al-farol-lampada" data-estado={estado} aria-hidden>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21h6M10 17h4M12 3v2M5.6 5.6 7 7M18.4 5.6 17 7M4 12h2M18 12h2" />
        <path d="M8.5 14.5a5 5 0 1 1 7 0c-.8.8-1.5 1.6-1.5 2.5h-4c0-.9-.7-1.7-1.5-2.5z" />
      </svg>
    </span>
  );
}

/** O carimbo reservado do farol (nenhum outro lugar da Alumia usa este componente). */
function CarimboDaCoordenacao({ texto }: { texto: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!podeMexer()) return;
    ref.current?.animate([{ scale: 2.4, rotate: "-10deg", opacity: 0 }, { scale: 1, rotate: "0deg", opacity: 1 }], {
      duration: MOLAS.quique.duracao,
      easing: MOLAS.quique.easing,
      delay: 160,
      fill: "backwards",
    });
  }, [texto]);
  return (
    <span ref={ref} className="al-cond al-farol-carimbo">
      {texto}
    </span>
  );
}

/** O farol para quem vai: estado, explicação, novo ponto e quando mudou. Nada aparece para quem não confirmou. */
export function FaixaDoFarol({ ato, t }: { ato: Ato; t: TextosDosAtos }) {
  const { farol, novo, visto } = useFarol(ato);
  const caixa = useRef<HTMLDivElement>(null);
  const [, setTique] = useState(0);
  // o "há 3 min" anda sozinho
  useEffect(() => {
    const r = window.setInterval(() => setTique((x) => x + 1), 60_000);
    return () => window.clearInterval(r);
  }, []);
  // mudou desde a última vez que este aparelho viu: pulsa três vezes e marca como visto
  useEffect(() => {
    if (!novo || !farol) return;
    if (podeMexer()) {
      caixa.current?.animate(
        [{ boxShadow: "0 0 0 0 var(--al-farol-cor)" }, { boxShadow: "0 0 0 14px transparent" }],
        { duration: 900, iterations: 3, easing: "ease-out" },
      );
    }
    const r = window.setTimeout(visto, 1500);
    return () => window.clearTimeout(r);
  }, [novo, farol, visto]);
  if (!farol || ato.situacao === "cancelado") return null;
  const nome = t.farol.estado[farol.estado];
  return (
    <div ref={caixa} className="al-farol" data-estado={farol.estado} role="status" aria-live="polite" aria-atomic="true">
      <Lampada estado={farol.estado} />
      <div className="al-farol-texto">
        <p className="al-farol-linha">
          <span className="al-so-leitor">{t.farol.titulo}: </span>
          <strong className="al-cond al-farol-estado">{nome}</strong>
          {farol.mudado_em ? <CarimboDaCoordenacao texto={t.farol.confirmadoPor} /> : null}
        </p>
        <p className="al-farol-explica">
          {t.farol.explica[farol.estado]}
          {farol.estado === "ponto2" && farol.texto ? <strong className="al-farol-ponto"> {farol.texto}</strong> : null}
        </p>
        <p className="al-farol-quando">{haQuanto(t, farol.mudado_em)}</p>
      </div>
    </div>
  );
}

/** A coordenação mexe no farol: pedir um estado; a segunda pessoa confirma o mesmo. */
export function PainelDoFarol({ ato, t }: { ato: Ato; t: TextosDosAtos }) {
  const { farol, pedir } = useFarol(ato);
  const [escolha, setEscolha] = useState<EstadoDoFarol | null>(null);
  const [ponto, setPonto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idPonto = useId();
  if (!farol?.coordena || ato.situacao === "cancelado") return null;
  const pendente = farol.pendente;

  const enviar = async (estado: EstadoDoFarol, texto: string) => {
    setOcupado(true);
    setErro(null);
    try {
      await pedir(estado, texto);
      setEscolha(null);
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  const aoEscolher = (e: EstadoDoFarol) => {
    if (e === "ponto2") setEscolha("ponto2");
    else void enviar(e, "");
  };
  const aoPonto = (e: FormEvent) => {
    e.preventDefault();
    void enviar("ponto2", ponto.trim());
  };
  const hora = pendente ? new Date(pendente.expira_em).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <section className="al-farol-painel" aria-labelledby={`al-farol-painel-${ato.id}`}>
      <h2 id={`al-farol-painel-${ato.id}`} className="al-cond">
        {t.farol.coordenar}
      </h2>
      <p className="al-farol-ajuda">{t.farol.coordenarAjuda}</p>
      {pendente && !pendente.meu ? (
        <div className="al-farol-pedido" data-estado={pendente.estado}>
          <p>
            {preencherAto(t.farol.outraPediu, { estado: t.farol.estado[pendente.estado] })}
            {pendente.texto ? <strong> {pendente.texto}</strong> : null}
          </p>
          <Botao variante="primario" aria-busy={ocupado} disabled={ocupado} onClick={() => void enviar(pendente.estado, pendente.texto)}>
            {preencherAto(t.farol.confirmar, { estado: t.farol.estado[pendente.estado] })}
          </Botao>
        </div>
      ) : null}
      {pendente?.meu ? (
        <p className="al-farol-pedido al-farol-esperando" data-estado={pendente.estado} role="status">
          {preencherAto(t.farol.esperando, { estado: t.farol.estado[pendente.estado], hora })}
        </p>
      ) : null}
      <div className="al-farol-botoes" role="group" aria-label={t.farol.coordenar}>
        {ESTADOS_DO_FAROL.map((e) => (
          <button
            key={e}
            type="button"
            className="al-farol-botao"
            data-estado={e}
            aria-pressed={farol.estado === e}
            disabled={ocupado}
            onClick={() => aoEscolher(e)}
          >
            <Lampada estado={e} />
            <span>{t.farol.estado[e]}</span>
            {farol.estado === e ? <span className="al-farol-botao-atual">{t.farol.atual}</span> : null}
          </button>
        ))}
      </div>
      {escolha === "ponto2" ? (
        <form className="al-farol-ponto-form" onSubmit={aoPonto}>
          <label htmlFor={idPonto}>{t.farol.novoPonto}</label>
          <input id={idPonto} className="al-ato-form-campo" value={ponto} onChange={(e) => setPonto(e.target.value)} maxLength={140} minLength={3} required placeholder={t.farol.novoPontoExemplo} autoComplete="off" />
          <div className="al-ato-org-botoes">
            <Botao type="submit" variante="dourado" aria-busy={ocupado} disabled={ocupado}>
              {preencherAto(t.farol.pedir, { estado: t.farol.estado.ponto2 })}
            </Botao>
            <Botao variante="fantasma" onClick={() => setEscolha(null)}>
              {t.pagina.desistir}
            </Botao>
          </div>
        </form>
      ) : null}
      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
