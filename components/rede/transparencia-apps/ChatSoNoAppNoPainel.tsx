// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { ChatSoNoApp } from "./ChatSoNoApp";
import { carregarTextosDoApp, type TextosDoApp } from "./textos";

/** O aviso "Para conversar, use o app" dentro do painel (as conversas da equipe), com os textos carregados no navegador. */
export function ChatSoNoAppNoPainel({ lang = "pt" }: { lang?: string }) {
  const [t, setT] = useState<TextosDoApp | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDoApp(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t ? <ChatSoNoApp lang={lang} t={t} voltar={null} /> : null;
}
