// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os dois botões da chamada no alto da conversa a dois (Prompt 4, itens 139 e 140, atrás de "alumia-p4-chamadas"): voz e vídeo. O
// toque só sai com a conversa aberta dos dois lados e a identidade da outra pessoa em ordem (nada de chamada com a identidade
// trocada ou fora do registro). O andamento fica no cartão de toda tela (NaCasca.tsx).
import { painelDaChamada } from "@/lib/rede/chamada/cliente";
import { useChamada, useTextosDasChamadas } from "./usar";
import "./chamada.css";

export function BotoesDaChamada({ lang, conversa, nome, pronta }: { lang: string; conversa: string; nome: string; pronta: boolean }) {
  const t = useTextosDasChamadas(lang);
  const c = useChamada();
  if (!t) return null;
  const ocupada = c.fase === "ligando" || c.fase === "conectando" || c.fase === "em_chamada";
  const pode = pronta && !ocupada;
  return (
    <span className="ch-botoes" data-ch-botoes="">
      <button type="button" disabled={!pode} onClick={() => void painelDaChamada().ligar(conversa, nome, false)} aria-label={t.botoes.voz} title={t.botoes.voz}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        </svg>
      </button>
      <button type="button" disabled={!pode} onClick={() => void painelDaChamada().ligar(conversa, nome, true)} aria-label={t.botoes.video} title={t.botoes.video}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </svg>
      </button>
    </span>
  );
}
