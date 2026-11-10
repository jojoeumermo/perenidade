// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDaOrg, type TextosDaOrg } from "@/lib/rede/textos-org";
import type { PropsDaTelaDoPacote } from "../registro";
import { ConteudoParaOrganizacoes } from "./ParaOrganizacoes";

/**
 * A página para organizações (prancha traga-sua-organizacao) quando aberta pelo registro de telas (dentro da casca). A rota
 * /alumia/organizacoes desenha a mesma página direto do servidor (app/[lang]/alumia/organizacoes/page.tsx), sem a casca, como na
 * prancha, para quem não tem sessão; quem tem sessão vê esta, dentro da casca (CascaSeLogado.tsx), sem Entrar e Criar conta.
 */
export default function PaginaParaOrganizacoes({ lang }: PropsDaTelaDoPacote) {
  const [t, setT] = useState<TextosDaOrg | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaOrg(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  if (!t) return <div aria-busy className="al-org-pagina" style={{ minHeight: "60vh" }} />;
  return <ConteudoParaOrganizacoes t={t} lang={lang} naCasca />;
}
