// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import { preencher } from "@/lib/rede/preencher";
import { abaPreferida, guardarAbaPreferida, type AbaInicial } from "@/lib/rede/publicar/b1";
import { useAlumia2 } from "./contexto";
import { Icone } from "./icones";

/**
 * "Abrir sempre nesta aba": a pessoa escolhe em qual aba (Seguindo, Comunidades ou Tudo) a Alumia abre. A escolha fica só neste
 * aparelho (o servidor não precisa saber como a pessoa lê: LGPD art. 6º, III). Um toque marca a aba atual; outro volta ao padrão.
 * `junto` vem na mesma linha, à esquerda (o "Como a linha é montada", que antes ocupava uma linha sozinho, com espaço morto).
 */
export function AbaInicialDaAlumia2({ aba, junto = null }: { aba: string; junto?: ReactNode }) {
  const al2 = useAlumia2();
  const [preferida, setPreferida] = useState<AbaInicial | null>(() => abaPreferida());
  const [nota, setNota] = useState("");
  if (!al2 || !["seguindo", "comunidades", "tudo"].includes(aba)) {
    return junto ? <div className="flex flex-wrap items-center gap-2 px-4 pt-1 text-xs md:px-5">{junto}</div> : null;
  }
  const { t } = al2;
  const nome = (a: string) => ({ seguindo: t.linha.seguindo, comunidades: t.linha.comunidadesCurto, tudo: t.linha.tudo })[a as AbaInicial] ?? a;
  const marcada = preferida === aba;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-1 text-xs text-[var(--al-texto-3)] md:px-5">
      {junto ? <span className="mr-auto">{junto}</span> : null}
      <span role="status" className={nota ? "min-w-0 flex-1 text-right" : "sr-only"}>
        {nota}
      </span>
      <button
        type="button"
        className="al2-acao al2-alvo text-xs"
        aria-pressed={marcada}
        onClick={() => {
          const nova = marcada ? null : (aba as AbaInicial);
          guardarAbaPreferida(nova);
          setPreferida(nova);
          setNota(nova ? preencher(t.b1.abaInicialFeita, { aba: nome(nova) }) : "");
        }}
      >
        <Icone nome={marcada ? "visto" : "inicio"} className="h-4 w-4" />
        {marcada ? t.b1.abaInicialTirar : t.b1.abaInicial}
      </button>
    </div>
  );
}
