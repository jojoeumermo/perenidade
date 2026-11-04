// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { enderecos } from "@/lib/rede/tipos";
import { trechosComMencoes } from "@/lib/rede/tipos-conversa";

/**
 * O texto de um post com as menções (@nome) viradas em link para o perfil. Não confere se a pessoa existe: o perfil que não
 * existe, está invisível ou bloqueou quem lê responde "não encontrado" (a matriz decide), e o link nunca revela o contrário.
 * Pequeno de propósito: o cartão de post usa em toda a Rede e este arquivo não traz textos nem rede.
 */
export function TextoComMencoes({ texto, lang }: { texto: string; lang: string }) {
  return (
    <>
      {trechosComMencoes(texto).map((t, i) =>
        t.tipo === "mencao" ? (
          <Link key={i} href={enderecos.perfil(lang, t.handle)} className="font-bold text-[#c21f16] hover:underline">
            {t.valor}
          </Link>
        ) : (
          <span key={i}>{t.valor}</span>
        ),
      )}
    </>
  );
}
