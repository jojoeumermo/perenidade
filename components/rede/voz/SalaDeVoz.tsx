// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Uma sala de voz cifrada de um núcleo ou comunidade fechada (sala de estudo, conversa de voz). Fica na página do
// grupo. Documento: docs/rede/VOZ.md. O microfone só liga com o toque
// em "Entrar" e desliga ao sair, ao fechar a página e no "Sair rápido".
// Prompt 4 (itens 23 a 25, atrás de "alumia-p4-perto"): a senha da sala, entrar sem microfone (estudo em silêncio) e os modos (palco,
// sala de espera e ritmo de estudo: components/rede/perto/ModosDaSala.tsx). Desligado, a sala é a de antes.
import { useEffect, useRef, useState } from "react";
import { ligado } from "@/lib/recursos";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import { type ControleDosModos, criarControleDosModos } from "@/lib/rede/voz/controle-dos-modos";
import { type EstadoDaSala, possoFalar } from "@/lib/rede/voz/modos";
import type { Participante, SalaDeVoz as Sala } from "@/lib/rede/voz/sala";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import { ModosDaSala, Presenca } from "../perto/ModosDaSala";
import { useTextosDoPerto } from "../perto/usarTextos";
import "../perto/perto.css";
import "./voz.css";
import { LegendasDaSala } from "../p4/pontes/LegendasDaSala";

function Ouvir({ fluxo }: { fluxo: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = fluxo;
  }, [fluxo]);
  return <audio ref={ref} autoPlay />;
}

export function SalaDeVoz({ t, eu, grupo, sala, nomes, lang = "pt" }: { t: TextosDoChat["voz"]; eu: string; grupo: string; sala: string; nomes?: Record<string, string>; lang?: string }) {
  const comModos = ligado("alumia-p4-perto");
  const tp = useTextosDoPerto(comModos ? lang : "pt");
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<EstadoDaSala | null>(null);
  const [silencio, setSilencio] = useState(false);
  const [controle, setControle] = useState<ControleDosModos | null>(null);
  const [aberta, setAberta] = useState<Sala | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [mudo, setMudo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const salaRef = useRef<Sala | null>(null);

  useEffect(() => {
    const sair = () => void salaRef.current?.sair();
    window.addEventListener("pagehide", sair);
    const desfazer = aoApagarTudoDoChat(sair);
    return () => {
      window.removeEventListener("pagehide", sair);
      desfazer();
      sair();
    };
  }, []);

  async function entrar(semMicrofone = false) {
    if (ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      const { entrarNaSalaDeVoz } = await import("@/lib/rede/voz/navegador");
      // No palco, sem a vez, o controle desliga o microfone no aparelho; a tela acompanha.
      const novo = comModos ? criarControleDosModos(eu, (e) => {
        setEstado(e);
        if (!possoFalar(e, eu)) setMudo(true);
      }) : null;
      const nova = await entrarNaSalaDeVoz({ eu, grupo, sala, aoMudar: (p) => setParticipantes(p), ...(novo ? { modos: novo.ganchos, senha, semMicrofone } : {}) });
      novo?.ligar(nova);
      setControle(novo);
      salaRef.current = nova;
      setSilencio(semMicrofone);
      setAberta(nova);
    } catch (e) {
      const codigo = (e as Error)?.name === "NotAllowedError" ? "NotAllowedError" : String((e as Error)?.message ?? "");
      setAviso((t.erros as Record<string, string>)[codigo] ?? t.erros.outro);
    } finally {
      setOcupado(false);
    }
  }

  async function sair() {
    await salaRef.current?.sair();
    salaRef.current = null;
    setControle(null);
    setAberta(null);
    setParticipantes([]);
    setMudo(false);
    setEstado(null);
    setSilencio(false);
  }

  // Pelo Tor, a voz (UDP) não passa pelo Tor: o servidor de retransmissão veria o endereço de quem fala. A sala fica fechada e a
  // tela não promete voz ali (nem a explicação da voz aparece).
  const peloTor = typeof window !== "undefined" && window.location.hostname.endsWith(".onion");
  return (
    <section className="al-voz-sala" aria-label={t.titulo}>
      <p className="al-voz-sala-titulo">{t.titulo}</p>
      {peloTor && !aberta ? (
        <p role="note" className="al-voz-sala-nota">{t.pelOnion}</p>
      ) : !aberta ? (
        <>
          <p className="al-voz-sala-explica">{t.explica}</p>
          {comModos && tp && (
            <label className="pt-campo">
              <span>{tp.sala.senha}</span>
              <input type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} />
              <span className="pt-nota">{tp.sala.senhaAjuda}</span>
            </label>
          )}
          <button type="button" disabled={ocupado} onClick={() => void entrar()} className="al-voz-botao al-voz-botao-entrar">{t.entrar}</button>
          {comModos && tp && (
            <button type="button" disabled={ocupado} onClick={() => void entrar(true)} className="al-voz-botao">{tp.sala.semMicrofone}</button>
          )}
        </>
      ) : (
        <>
          {comModos && tp && estado && controle && (
            <ModosDaSala t={tp.sala} eu={eu} estado={estado} controle={controle} nomes={nomes} total={participantes.length + 1} />
          )}
          {comModos && tp && (silencio || estado?.ritmo) ? (
            // Estudo: presença só como contagem, a partir de 3 (nada de nomes).
            !estado?.ritmo && <Presenca t={tp.sala} n={participantes.length + 1} />
          ) : (
          <>
          <p>{participantes.length ? t.naSala : t.sozinho}</p>
          <ul className="al-voz-sala-lista">
            {participantes.map((p) => (
              <li key={p.usuario}>
                <span aria-hidden className="al-voz-sala-ponto" />
                <span>{nomes?.[p.usuario] ?? t.alguem}</span>
                <span className="al-voz-sala-explica">{p.conexao.connectionState === "connected" ? t.ligado : t.ligando}</span>
                <Ouvir fluxo={p.audio} />
              </li>
            ))}
          </ul>
          </>
          )}
          {comModos && (silencio || estado?.ritmo) && participantes.map((p) => <Ouvir key={p.usuario} fluxo={p.audio} />)}
          {/* Prompt 4, item 88: legendas ao vivo só no aparelho, só com o lote ligado. */}
          {ligado("alumia-p4-pontes") && <LegendasDaSala participantes={participantes} nomes={nomes} lang={lang} />}
          <div className="al-voz-sala-acoes">
            {!silencio && (!estado || possoFalar(estado, eu)) && (
              <button type="button" onClick={() => { aberta.mudo(!mudo); setMudo(!mudo); }} aria-pressed={mudo} className="al-voz-botao">{mudo ? t.falar : t.mudo}</button>
            )}
            <button type="button" onClick={() => void sair()} className="al-voz-botao al-voz-botao-sair">{t.sair}</button>
          </div>
        </>
      )}
      {aviso && <p role="alert" className="al-voz-sala-aviso">{aviso}</p>}
    </section>
  );
}
