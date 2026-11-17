// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { carregarTextosDeMeusDados, type TextosDeMeusDados } from "@/lib/rede/meusdados/textos";
import type { ContextoDoEncaixe } from "../encaixes";
import { LinkBotao } from "../ui/Botao";

/** Em Ajustes: o que a página de meus dados faz, com os dois caminhos (baixar a cópia e apagar a conta). */
export default function SecaoNosAjustes({ lang }: ContextoDoEncaixe) {
  const [t, setT] = useState<TextosDeMeusDados | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDeMeusDados(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang]);
  if (!t) return null;
  const href = `/${lang}/alumia/meus-dados`;
  return (
    <div>
      <p className="sg-texto" style={{ marginBottom: 0 }}>{t.chamada}</p>
      <p className="sg-acoes">
        <LinkBotao variante="claro" tamanho="m" href={href}>{t.exportar.titulo}</LinkBotao>
        <Link className="sg-link sg-link-perigo" href={href}>{t.apagar.titulo}</Link>
      </p>
    </div>
  );
}
