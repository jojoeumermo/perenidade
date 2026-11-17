// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Uma sala de voz cifrada de um núcleo ou comunidade fechada (sala de estudo, conversa de voz). Fica na página do
// grupo. Documento: docs/rede/VOZ.md. O microfone só liga com o toque
// em "Entrar" e desliga ao sair, ao fechar a página e no "Sair rápido".
import { useEffect, useRef, useState } from "react";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import type { Participante, SalaDeVoz as Sala } from "@/lib/rede/voz/sala";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import "./voz.css";

function Ouvir({ fluxo }: { fluxo: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = fluxo;
  }, [fluxo]);
  return <audio ref={ref} autoPlay />;
}

export function SalaDeVoz({ t, eu, grupo, sala, nomes }: { t: TextosDoChat["voz"]; eu: string; grupo: string; sala: string; nomes?: Record<string, string> }) {
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

  async function entrar() {
    if (ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      const { entrarNaSalaDeVoz } = await import("@/lib/rede/voz/navegador");
      const nova = await entrarNaSalaDeVoz({ eu, grupo, sala, aoMudar: (p) => setParticipantes(p) });
      salaRef.current = nova;
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
    setAberta(null);
    setParticipantes([]);
    setMudo(false);
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
          <button type="button" disabled={ocupado} onClick={() => void entrar()} className="al-voz-botao al-voz-botao-entrar">{t.entrar}</button>
        </>
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
          <div className="al-voz-sala-acoes">
            <button type="button" onClick={() => { aberta.mudo(!mudo); setMudo(!mudo); }} aria-pressed={mudo} className="al-voz-botao">{mudo ? t.falar : t.mudo}</button>
            <button type="button" onClick={() => void sair()} className="al-voz-botao al-voz-botao-sair">{t.sair}</button>
          </div>
        </>
      )}
      {aviso && <p role="alert" className="al-voz-sala-aviso">{aviso}</p>}
    </section>
  );
}
