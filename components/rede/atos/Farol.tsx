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
import { MOLAS, podeMexer, vibrar } from "@/lib/rede/atos/movimento";
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
    <span ref={ref} className="al-farol-carimbo">
      {texto}
    </span>
  );
}

/**
 * O farol para quem vai: estado, quando mudou, o carimbo da coordenação (numa linha só dele), o novo ponto e a explicação. No
 * celular fica compacto (lâmpada, estado e "há X min"; a explicação abre ao tocar na seta), mas o novo ponto de encontro aparece
 * sempre e o leitor de tela ouve tudo. Nada aparece para quem não confirmou.
 */
export function FaixaDoFarol({ ato, t }: { ato: Ato; t: TextosDosAtos }) {
  const { farol, novo, visto } = useFarol(ato);
  const caixa = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [, setTique] = useState(0);
  const idExplica = useId();
  // o "há 3 min" anda sozinho
  useEffect(() => {
    const r = window.setInterval(() => setTique((x) => x + 1), 60_000);
    return () => window.clearInterval(r);
  }, []);
  // mudou desde a última vez que este aparelho viu: pulsa três vezes POR DENTRO (nada vaza da caixa) e marca como visto
  useEffect(() => {
    if (!novo || !farol) return;
    if (podeMexer()) {
      caixa.current?.animate(
        [
          { boxShadow: "inset 0 0 0 0 var(--al-farol-cor)" },
          { boxShadow: "inset 0 0 0 5px var(--al-farol-cor)", offset: 0.35 },
          { boxShadow: "inset 0 0 0 0 transparent" },
        ],
        { duration: 900, iterations: 3, easing: "ease-out" },
      );
    }
    const r = window.setTimeout(visto, 1500);
    return () => window.clearTimeout(r);
  }, [novo, farol, visto]);
  if (!farol || ato.situacao === "cancelado") return null;
  const nome = t.farol.estado[farol.estado];
  return (
    <div ref={caixa} className="al-farol" data-estado={farol.estado} data-aberto={aberto ? "" : undefined} role="status" aria-live="polite" aria-atomic="true">
      <Lampada estado={farol.estado} />
      <div className="al-farol-texto">
        <p className="al-farol-linha">
          <span className="al-so-leitor">{t.farol.titulo}: </span>
          <strong className="al-cond al-farol-estado">{nome}</strong>
          <span className="al-farol-quando">{haQuanto(t, farol.mudado_em)}</span>
        </p>
        {farol.mudado_em ? <CarimboDaCoordenacao texto={t.farol.confirmadoPor} /> : null}
        {farol.estado === "ponto2" && farol.texto ? <strong className="al-farol-ponto">{farol.texto}</strong> : null}
        <p id={idExplica} className="al-farol-explica">
          {t.farol.explica[farol.estado]}
        </p>
      </div>
      <button type="button" className="al-farol-mais" aria-expanded={aberto} aria-controls={idExplica} aria-label={t.farol.detalhes} onClick={() => setAberto((a) => !a)}>
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

/**
 * A coordenação mexe no farol: pedir um estado; a segunda pessoa confirma o mesmo. O pedido que espera a segunda pessoa fica
 * marcado no próprio botão (borda tracejada, "esperando"). Dispersar pede dois toques (é o estado crítico), e trocar um pedido que
 * ainda espera também (para ninguém trocar sem querer).
 */
export function PainelDoFarol({ ato, t, lang }: { ato: Ato; t: TextosDosAtos; lang: string }) {
  const { farol, pedir } = useFarol(ato);
  const [escolha, setEscolha] = useState<EstadoDoFarol | null>(null);
  const [armado, setArmado] = useState<EstadoDoFarol | null>(null);
  const [ponto, setPonto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const relogio = useRef<number | undefined>(undefined);
  const idPonto = useId();
  const idAviso = useId();
  useEffect(() => () => window.clearTimeout(relogio.current), []);
  if (!farol?.coordena || ato.situacao === "cancelado") return null;
  const pendente = farol.pendente;
  const meuPendente = pendente?.meu ? pendente : null;

  const enviar = async (estado: EstadoDoFarol, texto: string) => {
    setOcupado(true);
    setErro(null);
    setArmado(null);
    try {
      await pedir(estado, texto);
      setEscolha(null);
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  // o primeiro toque só "arma" (e avisa); o segundo, em até 5 s, pede
  const precisaDeNovo = (e: EstadoDoFarol) => e === "dispersar" || (!!meuPendente && meuPendente.estado !== e);
  const aoEscolher = (e: EstadoDoFarol) => {
    if (meuPendente?.estado === e) return;
    if (precisaDeNovo(e) && armado !== e) {
      setArmado(e);
      vibrar([10]);
      window.clearTimeout(relogio.current);
      relogio.current = window.setTimeout(() => setArmado(null), 5000);
      return;
    }
    setArmado(null);
    if (e === "ponto2") setEscolha("ponto2");
    else void enviar(e, "");
  };
  const aoPonto = (e: FormEvent) => {
    e.preventDefault();
    void enviar("ponto2", ponto.trim());
  };
  const hora = pendente ? new Date(pendente.expira_em).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) : "";
  const aviso = armado
    ? meuPendente && meuPendente.estado !== armado
      ? preencherAto(t.farol.trocarPedido, { pendente: t.farol.estado[meuPendente.estado], estado: t.farol.estado[armado] })
      : preencherAto(t.farol.deNovo, { estado: t.farol.estado[armado] })
    : "";
  const idPainel = `al-farol-painel-${ato.id}`;

  return (
    <section className="al-farol-painel" aria-labelledby={idPainel}>
      <h2 id={idPainel} className="al-cond">
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
      {meuPendente ? (
        <p className="al-farol-pedido al-farol-esperando" data-estado={meuPendente.estado} role="status">
          {preencherAto(t.farol.esperando, { estado: t.farol.estado[meuPendente.estado], hora })}
        </p>
      ) : null}
      <div className="al-farol-botoes" role="group" aria-label={t.farol.coordenar} aria-describedby={idAviso}>
        {ESTADOS_DO_FAROL.map((e) => {
          const esperando = meuPendente?.estado === e;
          return (
            <button
              key={e}
              type="button"
              className="al-farol-botao"
              data-estado={e}
              data-esperando={esperando ? "" : undefined}
              data-armado={armado === e ? "" : undefined}
              aria-pressed={farol.estado === e}
              aria-disabled={esperando || undefined}
              disabled={ocupado}
              onClick={() => aoEscolher(e)}
            >
              <Lampada estado={e} />
              <span className="al-farol-botao-nome">{t.farol.estado[e]}</span>
              {farol.estado === e ? <span className="al-farol-botao-atual">{t.farol.atual}</span> : null}
              {esperando ? <span className="al-farol-botao-atual al-farol-botao-espera">{t.farol.esperandoCurto}</span> : null}
            </button>
          );
        })}
      </div>
      <p id={idAviso} className="al-farol-armado" role="status">
        {aviso}
      </p>
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
