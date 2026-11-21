// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O aviso do beta sobre o chat (R1): as conversas cifradas moram só no aparelho, e perder o aparelho, trocar de aparelho,
// limpar os dados do navegador ou usar o "Sair rápido" apaga o histórico de vez, porque ainda não há cópia de segurança (ela ainda
// vai chegar). Fica na segurança da conta, nos aparelhos conectados e no menu da conta, perto do "Sair rápido".
import { useId } from "react";
import { useTextosDoUso } from "./textos";
import "./uso.css";

export function AvisoDoChat({ lang, className = "" }: { lang: string; className?: string }) {
  const t = useTextosDoUso(lang);
  const id = useId();
  if (!t) return null;
  return (
    <section className={`al-uso-bloco ${className}`.trim()} aria-labelledby={`${id}-t`} role="note">
      <h2 id={`${id}-t`} className="al-uso-titulo">{t.chat.titulo}</h2>
      <ul className="al-uso-lista">
        {t.chat.itens.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </section>
  );
}
