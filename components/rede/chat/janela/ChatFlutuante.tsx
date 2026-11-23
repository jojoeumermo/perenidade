// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A janela de conversas no canto (recurso "alumia-chat-flutuante"), como nas redes grandes: um botão no canto de baixo à direita
// de todas as telas da Alumia abre a lista e as conversas por cima da tela, sem sair dela. Fica no layout da Alumia
// (app/[lang]/alumia/layout.tsx), que não se refaz entre uma página e outra: navegar não fecha a janela nem perde a conversa.
//
// Esta peça é LEVE de propósito: só o botão e o estado (lib/rede/chat/janela.ts). Nada do chat (cliente, chaves, cifra) desce ao
// navegador antes do primeiro toque no botão; aí a janela de verdade (./JanelaDoChat) chega sob demanda. O estado mora só na
// memória da aba: nada vai ao servidor nem ao disco.
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { hasSession } from "@/lib/backend";
import { JANELA_FECHADA, janela, naPaginaDasConversas } from "@/lib/rede/chat/janela";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import "@/styles/alumia-chat-flutuante.css";

const JanelaDoChat = dynamic(() => import("./JanelaDoChat"), { ssr: false });

export interface RotulosDoBotao {
  botao: string;
  abrir: string;
}

export function ChatFlutuante({ lang, rotulos }: { lang: string; rotulos: RotulosDoBotao }) {
  const caminho = usePathname();
  const [estado, despachar] = useReducer(janela, JANELA_FECHADA);
  // A janela de verdade só é montada depois do primeiro toque (e fica montada enquanto houver janela aberta, mesmo minimizada).
  const [montada, setMontada] = useState(false);
  // Só para quem tem sessão neste navegador (ou na prévia): sem conta, nada de botão. O servidor confere de novo na janela.
  const [comConta, setComConta] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const conferir = () => setComConta(previaLigada() || hasSession());
    conferir();
    // A sessão pode chegar depois (o portão traz a sessão do site) ou sair (Sair, Sair rápido em outra aba).
    window.addEventListener("storage", conferir);
    window.addEventListener("focus", conferir);
    return () => {
      window.removeEventListener("storage", conferir);
      window.removeEventListener("focus", conferir);
    };
  }, []);

  const abrir = useCallback(() => {
    setMontada(true);
    despachar({ tipo: "abrir" });
  }, []);
  // Ao minimizar ou fechar, o foco volta ao botão (quem usa teclado não fica perdido no fim da página).
  const minimizar = useCallback(() => {
    despachar({ tipo: "minimizar" });
    requestAnimationFrame(() => botao.current?.focus());
  }, []);
  const fechar = useCallback(() => {
    despachar({ tipo: "fechar" });
    setMontada(false);
    requestAnimationFrame(() => botao.current?.focus());
  }, []);

  // Na página Conversas o chat já ocupa a tela: a janela some (e é desmontada) até a pessoa sair de lá.
  if (!comConta || naPaginaDasConversas(caminho)) return null;
  const visivel = estado.aberta && !estado.minimizada;
  const abertas = estado.conversas.length;
  return (
    <>
      {!visivel && (
        <button ref={botao} type="button" className="al-cf-lancador no-print" onClick={abrir} aria-label={rotulos.abrir} aria-haspopup="dialog" data-chat-flutuante-botao>
          <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
          </svg>
          <span className="al-cf-lancador-texto">{rotulos.botao}</span>
          {abertas > 0 && (
            <span className="al-cf-lancador-conta" aria-hidden>
              {abertas}
            </span>
          )}
        </button>
      )}
      {montada && estado.aberta && <JanelaDoChat lang={lang} estado={estado} despachar={despachar} aoMinimizar={minimizar} aoFechar={fechar} />}
    </>
  );
}
