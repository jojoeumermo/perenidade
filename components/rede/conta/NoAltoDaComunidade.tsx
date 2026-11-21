// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// No alto da página da comunidade (encaixe altoDaComunidade), com "alumia-p4-conta" ligado:
//   105 a faixa da sala de cuidado (CVV 188, SAMU 192, CAPS e UBS), quando a mediação marcou;
//   127 o quiz das regras, para quem ainda não aceitou (o "li e aceito" de sempre recusa com quiz_pendente);
//   114 o guia de entrada, recolhido, com o progresso só no aparelho.
// Qualquer erro (sem conta, comunidade fechada, desligado): não mostra nada.
import { useEffect, useState } from "react";
import type { ContextoDoEncaixe } from "../encaixes";
import { conta, type Cuidado, type Guia, type Quiz } from "@/lib/rede/conta/cliente";
import { LerGuia, ResponderQuiz } from "./AbaComunidades";
import { useTextosDaConta } from "./textos";
import "./conta.css";

export function NoAltoDaComunidade({ lang, situacao, slug }: ContextoDoEncaixe & { slug: string }) {
  const t = useTextosDaConta(lang);
  const [dados, setDados] = useState<{ cuidado: Cuidado | null; quiz: Quiz | null; guia: Guia | null } | null>(null);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    Promise.all([conta.cuidado(slug).catch(() => null), conta.quiz(slug).catch(() => null), conta.guia(slug).catch(() => null)]).then(
      ([cuidado, quiz, guia]) => vivo && setDados({ cuidado, quiz, guia }),
    );
    return () => {
      vivo = false;
    };
  }, [slug, situacao.logado, vez]);
  if (!t || !dados) return null;
  const { cuidado, quiz, guia } = dados;
  const temQuiz = quiz && quiz.perguntas.length > 0 && !quiz.aceitei && !quiz.modero;
  const temGuia = guia && guia.passos.length > 0;
  if (!cuidado?.sala && !temQuiz && !temGuia) return null;
  return (
    <div className="ct-bloco" style={{ padding: "0.75rem 16px" }} data-conta-no-alto>
      {cuidado?.sala && (
        <div className="ct-cartao" role="note" data-sala-de-cuidado>
          <p className="ct-etiqueta">{t.cuidado.titulo}</p>
          <p>{t.cuidado.faixa}</p>
          {cuidado.texto && <p>{cuidado.texto}</p>}
        </div>
      )}
      {temQuiz && (
        <details className="ct-cartao" open>
          <summary className="ct-cartao-titulo" style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}>{t.quiz.naComunidade}</summary>
          <ResponderQuiz t={t} slug={slug} quiz={quiz} aoAceitar={() => setVez((v) => v + 1)} />
        </details>
      )}
      {temGuia && (
        <details className="ct-cartao">
          <summary className="ct-cartao-titulo" style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}>{t.guia.titulo}</summary>
          <LerGuia t={t} lang={lang} slug={slug} guia={guia} />
        </details>
      )}
    </div>
  );
}
