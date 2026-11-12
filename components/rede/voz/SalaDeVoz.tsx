// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Uma sala de voz cifrada de um núcleo ou comunidade fechada (sala de estudo, conversa de voz). A Faixa 1 põe este componente na
// página do grupo (pedido P22 em docs/rede/PEDIDOS-ENTRE-FAIXAS.md). Documento: docs/rede/VOZ.md. O microfone só liga com o toque
// em "Entrar" e desliga ao sair, ao fechar a página e no "Sair rápido".
import { useEffect, useRef, useState } from "react";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import type { Participante, SalaDeVoz as Sala } from "@/lib/rede/voz/sala";
import type { TextosDoChat } from "@/lib/rede/textos-chat";

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

  return (
    <section className="space-y-3 rounded-xl border border-rule p-4 text-sm" aria-label={t.titulo}>
      <p className="font-semibold">{t.titulo}</p>
      <p className="text-ink-soft">{t.explica}</p>
      {!aberta ? (
        <button type="button" disabled={ocupado} onClick={() => void entrar()} className="min-h-11 rounded-full bg-[#1f1a14] px-4 text-[#f6efe2]">{t.entrar}</button>
      ) : (
        <>
          <p>{participantes.length ? t.naSala : t.sozinho}</p>
          <ul className="space-y-1">
            {participantes.map((p) => (
              <li key={p.usuario} className="flex items-center gap-2">
                <span aria-hidden>●</span>
                <span>{nomes?.[p.usuario] ?? t.alguem}</span>
                <span className="text-ink-soft">{p.conexao.connectionState === "connected" ? t.ligado : t.ligando}</span>
                <Ouvir fluxo={p.audio} />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { aberta.mudo(!mudo); setMudo(!mudo); }} aria-pressed={mudo} className="min-h-11 rounded-full border border-rule px-4">{mudo ? t.falar : t.mudo}</button>
            <button type="button" onClick={() => void sair()} className="min-h-11 rounded-full border border-oxblood px-4 text-oxblood">{t.sair}</button>
          </div>
        </>
      )}
      {aviso && <p role="alert">{aviso}</p>}
    </section>
  );
}
