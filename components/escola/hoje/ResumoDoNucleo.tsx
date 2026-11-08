// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import type { LidoDaEscola } from "@/lib/escola/acesso";
import type { EscolaEuDentro, EscolaNucleo } from "@/lib/escola/contratos";
import { diaEHora } from "./tempo";

/**
 * O cartão do núcleo (prancha Hoje, coluna da direita; Cel-Hoje, logo abaixo do quadro): o nome (de escola_eu), o
 * próximo encontro e a pauta (de escola_nucleo, da F4). Sem núcleo, diz que a coordenação indica; com a F4 ainda fora
 * do banco, diz que a pauta ainda não chegou e leva ao núcleo na Alumia.
 */
export function ResumoDoNucleo({ lang, t, eu, lido }: { lang: Locale; t: TextosDaFormacaoBase["hoje"]; eu: EscolaEuDentro; lido: LidoDaEscola<EscolaNucleo> | null }) {
  const n = t.nucleo;
  const dados = lido?.ok ? lido.dados : null;
  const nucleo = dados?.nucleo ?? eu.nucleo;
  const proximo = dados?.proximo ?? null;
  let corpo: React.ReactNode;
  if (!nucleo) corpo = <p>{n.semNucleo}</p>;
  else if (lido === null) corpo = <p>{t.carregando}</p>;
  else if (!lido.ok) corpo = <p>{lido.motivo === "ausente" ? n.ausente : t.falha}</p>;
  else if (!proximo) corpo = <p>{n.semEncontro}</p>;
  else
    corpo = (
      <>
        <p className="ef-so-computador">
          {n.proximo} <strong>{diaEHora(lang, proximo.quando)}</strong>
        </p>
        {proximo.pauta.length > 0 && (
          <p className="ef-so-computador">
            {n.pauta} {proximo.pauta.map((p) => p.texto).join("; ")}.
          </p>
        )}
        {/* Celular (Cel-Hoje): uma linha só, dia e hora e o primeiro item da pauta. */}
        <p className="ef-so-celular ef-nucleo-curto">
          {diaEHora(lang, proximo.quando)}
          {proximo.pauta[0] ? ` · ${proximo.pauta[0].texto}` : ""}
        </p>
      </>
    );
  return (
    <section aria-labelledby="ef-nucleo" className="ef-cartao ef-nucleo ef-o-nucleo" aria-busy={lido === null}>
      <h2 id="ef-nucleo" className="ef-t">
        {nucleo?.nome ?? n.titulo}
      </h2>
      {corpo}
      {nucleo && (
        <Link href={localePath(lang, `/comunidade/nucleos/${nucleo.id}`)} className="ef-botao-escuro ef-nucleo-abrir">
          {n.abrir}
        </Link>
      )}
    </section>
  );
}
