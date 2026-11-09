// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { Pilula } from "../ui/Pilula";
import { BotaoChamarIcone, BotaoConversa, BotaoVou } from "./Acoes";
import { CarimboDoAto, Era, MosaicoDoAto } from "./partes";
import { useTelaLarga } from "./usar";
import { pontoEDetalhe } from "@/lib/rede/atos/formulario";
import { dataCurta, dataPorExtenso } from "@/lib/rede/atos/tempo";
import { enderecos } from "@/lib/rede/tipos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato } from "@/lib/rede/tipos-atos";

export interface PropsDoCartaoDoAto {
  ato: Ato;
  t: TextosDosAtos;
  lang: string;
  logado?: boolean;
}

/** A frase de baixo do mosaico: o cartão dourado, ou por que ainda está apagado. Nunca um número de pessoas. */
export function FraseDoMosaico({ ato, t, longa }: { ato: Ato; t: TextosDosAtos; longa?: boolean }) {
  if (ato.situacao === "cancelado") return <p className="al-ato-frase">{t.mosaico.cancelado}</p>;
  if (ato.vou_eu && ato.acesos !== null) {
    return longa ? (
      <p className="al-ato-frase">
        <strong className="al-ato-dourado">{t.mosaico.voceLongo}</strong> {t.mosaico.voceLongoResto} {t.mosaico.explica}
      </p>
    ) : (
      <p className="al-ato-frase al-ato-dourado al-ato-forte">{t.mosaico.voce}</p>
    );
  }
  if (ato.vou_eu) return <p className="al-ato-frase">{t.mosaico.voceConfirmou}</p>;
  if (ato.acesos === null) return <p className="al-ato-frase">{t.mosaico.poucas}</p>;
  return longa ? <p className="al-ato-frase">{t.mosaico.explica}</p> : null;
}

/**
 * O cartão do ato na linha (pranchas computador-inicio e celular-inicio): comunidade, quem chamou (@nome público), carimbo da
 * situação, nome, quando e onde, o mosaico que acende a cada confirmação, "Você vai" e a conversa do ato; no computador, também o
 * Chamar. O título leva à página do ato.
 */
export function CartaoDoAto({ ato, t, lang, logado = true }: PropsDoCartaoDoAto) {
  const largo = useTelaLarga();
  const { ponto, detalhe } = pontoEDetalhe(ato.onde);
  const cancelado = ato.situacao === "cancelado";
  return (
    <article className={`al-ato-cartao${largo ? " al-ato-cartao-largo" : ""}`} aria-labelledby={`al-ato-titulo-${ato.id}`} data-situacao={ato.situacao}>
      <div className="al-ato-cartao-topo">
        <div className="al-ato-cartao-quem">
          {ato.comunidade ? <Pilula texto={ato.comunidade.nome} slug={ato.comunidade.slug} href={enderecos.comunidade(lang, ato.comunidade.slug)} tamanho={largo ? "p" : "m"} /> : null}
          {largo && ato.chamado_por ? <span className="al-ato-chamado-por">{preencherAto(t.chamadoPor, { handle: ato.chamado_por })}</span> : null}
        </div>
        <CarimboDoAto ato={ato} t={t} tamanho={largo ? "m" : "g"} className="al-ato-cartao-carimbo" />
      </div>
      <h2 id={`al-ato-titulo-${ato.id}`} className="al-cond al-ato-cartao-titulo">
        <Link href={`/${lang}/alumia/ato/${ato.id}`} className={cancelado ? "al-riscado" : undefined}>
          {ato.titulo}
        </Link>
      </h2>
      <p className="al-ato-cartao-quando">
        {largo ? (
          <>
            {dataPorExtenso(ato.inicio, lang)} · {ponto}, {ato.cidade}
            {detalhe ? <> · {detalhe}</> : null}
          </>
        ) : (
          <>
            {dataCurta(ato.inicio, lang)} · {ponto}
          </>
        )}
        {ato.inicio_anterior ? <> · <Era ato={ato} t={t} lang={lang} /></> : null}
      </p>
      {cancelado && ato.motivo ? <p className="al-ato-motivo">{ato.motivo}</p> : null}
      <MosaicoDoAto ato={ato} t={t} quebrar={largo ? undefined : 31} className="al-ato-cartao-mosaico" />
      {largo ? (
        <>
          <div className="al-ato-cartao-pe">
            <FraseDoMosaico ato={ato} t={t} longa />
            <div className="al-ato-cartao-botoes">
              <BotaoVou ato={ato} t={t} lang={lang} logado={logado} />
              <BotaoConversa ato={ato} t={t} lang={lang} longo />
            </div>
          </div>
          <BotaoChamarIcone ato={ato} t={t} lang={lang} />
        </>
      ) : (
        <>
          <div className="al-ato-cartao-botoes al-ato-cartao-botoes-celular">
            <BotaoVou ato={ato} t={t} lang={lang} logado={logado} tamanho="g" />
            <BotaoConversa ato={ato} t={t} lang={lang} tamanho="g" />
          </div>
          {ato.acesos === null || !ato.vou_eu ? <FraseDoMosaico ato={ato} t={t} /> : null}
        </>
      )}
    </article>
  );
}
