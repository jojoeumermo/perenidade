// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { avisoDaTroca, type AvisoDaTrocaNaTela } from "@/lib/rede/avisos/troca";
import { avisarTroca, dataDaTrocaNaTela } from "@/lib/rede/chat/r2/troca";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDoChat, type TextosDoChat } from "@/lib/rede/textos-chat";
import { botaoLeve } from "../chat/comum";

const FECHADO_NESTA_ABA = "lucia-alumia-troca-aviso";

/**
 * O aviso da troca do chat do beta (onda R2) no alto do Início, para quem nunca abre o chat também saber e ter o aparelho limpo:
 *   - ANTES da data (lib/rede/chat/r2/troca.ts, da conversa a dois): "Em DD/MM/AAAA o chat da Alumia muda de cifra..." (o texto
 *     troca.aviso do chat). Some com "Fechar" nesta aba.
 *   - Na primeira abertura do site novo, apaga deste aparelho as lojas do chat do beta (lib/rede/chat/r2/limpeza.ts, a mesma limpeza
 *     que o chat roda ao abrir) e, se apagou, diz uma vez que as conversas do beta foram apagadas, com a data.
 * A limpeza roda também para quem não entrou (apagar o que não serve mais nunca precisa de conta); o texto, só para quem entrou.
 */
export function AvisoDaTroca({ lang, s, logado = true }: { lang: string; s: TextosDaRede; logado?: boolean }) {
  const [t, setT] = useState<TextosDoChat | null>(null);
  const [aviso, setAviso] = useState<AvisoDaTrocaNaTela>(null);

  useEffect(() => {
    let vivo = true;
    let fechado = false;
    try {
      fechado = sessionStorage.getItem(FECHADO_NESTA_ABA) === "1";
    } catch {
      fechado = false;
    }
    const decidir = (limpou: boolean) => vivo && setAviso(avisoDaTroca({ avisar: avisarTroca(), data: dataDaTrocaNaTela(), limpou, fechado }));
    import("@/lib/rede/chat/r2/limpeza")
      .then((m) => m.limparChatAntigo())
      .then((limpou) => decidir(limpou), () => decidir(false));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!aviso || !logado) return;
    let vivo = true;
    carregarTextosDoChat(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [aviso, lang, logado]);

  if (!logado || !t || !aviso) return null;
  const antes = aviso.tipo === "antes";
  const texto = antes ? preencher(t.troca.aviso, { data: aviso.data }) : aviso.data ? preencher(t.troca.depois, { data: aviso.data }) : t.troca.depoisSemData;
  function fechar() {
    if (antes) {
      try {
        sessionStorage.setItem(FECHADO_NESTA_ABA, "1");
      } catch {
        // sem sessionStorage: volta na próxima página
      }
    }
    setAviso(null);
  }
  return (
    <section role={antes ? "alert" : "status"} className="mx-[18px] my-3 flex flex-wrap items-start gap-3 rounded-md border-[1.5px] border-oxblood bg-parchment px-4 py-3 text-sm text-ink">
      <p className="min-w-0 flex-1 basis-60 font-semibold">{texto}</p>
      <button type="button" onClick={fechar} className={botaoLeve}>{s.casca.fechar}</button>
    </section>
  );
}

/** A peça do alto do Início (encaixe da lei e da ajuda, components/rede/lei/encaixe.tsx). */
export function AvisoDaTrocaNoInicio({ lang, s, situacao }: { lang: string; s: TextosDaRede; situacao: { logado: boolean } }) {
  return <AvisoDaTroca lang={lang} s={s} logado={situacao.logado} />;
}
