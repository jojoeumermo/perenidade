// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Discutir na Alumia" na página da aula da Escola (onda 11, L2-50): leva ao tópico daquela aula na comunidade de estudo da
// disciplina (/alumia/aula/<trilha>/<aula>?c=<comunidade>, components/rede/comunidades/TelaAula.tsx, que abre o tópico ou deixa
// começar). A página só monta o botão com a Alumia aberta (lib/rede/discutir-aula.ts, alumiaAbertaParaAula). Aqui, no navegador,
// ele ainda some: no aplicativo do Instituto (a Alumia não mora nele), sem sessão e para quem não tem conta aprovada na Alumia.
// Nada aparece antes da resposta, para o botão não piscar para quem não pode usá-lo. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim (a prévia
// sem banco) ele aparece direto.
import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { hasSession, rpc } from "@/lib/backend";
import { isApp } from "@/lib/prefs";
import { enderecoDiscutirAula, rotuloDiscutirAula } from "@/lib/rede/discutir-aula";

const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export function DiscutirNaAlumia({ lang, trilha, aula, disciplina }: { lang: string; trilha: string; aula: string; disciplina: string }) {
  const [pode, setPode] = useState(false);
  const href = enderecoDiscutirAula(lang, trilha, aula, disciplina);

  useEffect(() => {
    if (!href || isApp()) return;
    let vivo = true;
    if (PREVIA) {
      const relogio = window.setTimeout(() => vivo && setPode(true), 0);
      return () => {
        vivo = false;
        window.clearTimeout(relogio);
      };
    }
    if (!hasSession()) return;
    rpc<{ logado?: boolean; situacao?: string }>("alumia_entrada_eu")
      .then((eu) => vivo && setPode(eu?.logado === true && eu.situacao === "aprovada"))
      .catch(() => vivo && setPode(false));
    return () => {
      vivo = false;
    };
  }, [href]);

  if (!pode || !href) return null;
  return (
    <p className="no-print app:hidden mt-6 font-sans text-sm">
      <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-ink px-5 font-bold hover:bg-parchment-deep">
        {rotuloDiscutirAula(lang)} <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}
