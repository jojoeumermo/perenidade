// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import Link from "@/components/Link";
import { BlocoDaData, CarimboDoAto, LinhaCurta } from "./partes";
import type { TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato } from "@/lib/rede/tipos-atos";

/**
 * Um ato numa lista (prancha computador-inicio "Atos perto de você" e o "próximo ato" embaixo da tela dos atos): o bloco da data,
 * o nome (riscado se cancelado), onde e quando (ou o motivo do cancelamento, ou "era 12/11" riscado), e o carimbo. Por padrão
 * leva à página do ato; quem usa pode trocar o destino por uma ação (`aoTocar`) e pôr algo à direita (`fim`).
 */
export function ItemDoAto({
  ato,
  t,
  lang,
  aoTocar,
  rotulo,
  fim,
  tamanho = "p",
}: {
  ato: Ato;
  t: TextosDosAtos;
  lang: string;
  aoTocar?: () => void;
  rotulo?: string;
  fim?: ReactNode;
  tamanho?: "p" | "g";
}) {
  const cancelado = ato.situacao === "cancelado";
  const miolo = (
    <>
      <BlocoDaData iso={ato.inicio} lang={lang} apagado={cancelado} />
      <span className="al-ato-item-texto">
        <span className={`al-ato-item-titulo${cancelado ? " al-riscado" : ""}`}>{ato.titulo}</span>
        <LinhaCurta ato={ato} t={t} lang={lang} />
      </span>
      <CarimboDoAto ato={ato} t={t} tamanho={tamanho === "g" ? "m" : "p"} className="al-ato-item-carimbo" />
      {fim}
    </>
  );
  const classe = `al-ato-item al-ato-item-${tamanho}`;
  if (aoTocar) {
    return (
      <button type="button" className={classe} onClick={aoTocar} aria-label={rotulo}>
        {miolo}
      </button>
    );
  }
  return (
    <Link href={`/${lang}/alumia/ato/${ato.id}`} className={classe} aria-label={rotulo}>
      {miolo}
    </Link>
  );
}
