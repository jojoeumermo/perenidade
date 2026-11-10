// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { FlapsDoAto } from "./FlapsDoAto";
import { useFarol } from "./usar";
import { pontoEDetalhe } from "@/lib/rede/atos/formulario";
import { dataCurta, diaEHora } from "@/lib/rede/atos/tempo";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato } from "@/lib/rede/tipos-atos";
import "./atos.css";

/**
 * A faixa dourada "PRÓXIMO ATO" (pranchas computador-inicio e celular-inicio): o nome, quando e onde, e quanto falta em
 * plaquinhas ("2d 04h"). A faixa inteira leva à página do ato. No celular sai a versão curta ("sex 18h · Sé"); no computador, a
 * longa ("sex 15/11, 18h · Praça da Sé, São Paulo"). Ato cancelado não vira faixa (quem chama já filtra; aqui conferimos de novo).
 * As plaquinhas giram como painel de aeroporto. Para quem confirmou, o FAROL do ato pinta a faixa (âmbar, vermelho ou azul) e ela
 * pulsa quando o farol muda (o farol diz o estado em palavra também: a cor nunca é o único sinal).
 */
export function FaixaProximoAto({ ato, t, lang }: { ato: Ato; t: TextosDosAtos; lang: string }) {
  const { farol, novo } = useFarol(ato);
  if (ato.situacao === "cancelado") return null;
  const { ponto } = pontoEDetalhe(ato.onde);
  const estado = farol && farol.mudado_em && farol.estado !== "tranquilo" ? farol.estado : undefined;
  return (
    <Link href={`/${lang}/alumia/ato/${ato.id}`} className="al-faixa-ato" data-situacao={ato.situacao} data-farol={estado} data-farol-novo={estado && novo ? "" : undefined}>
      <span className="al-cond al-faixa-ato-rotulo">{t.faixa.rotulo}</span>
      {estado ? (
        <span className="al-faixa-ato-farol">
          <span className="al-so-leitor">{t.farol.titulo}: </span>
          {t.farol.estado[estado]}
        </span>
      ) : null}
      <span className="al-faixa-ato-texto">
        <span className="al-faixa-ato-curto">
          {ato.titulo} · {diaEHora(ato.inicio, lang)} · {ponto}
        </span>
        <span className="al-faixa-ato-longo">
          {ato.titulo} · {dataCurta(ato.inicio, lang)} · {ponto}, {ato.cidade}
        </span>
      </span>
      <FlapsDoAto
        ate={ato.inicio}
        agoraTexto={t.faixa.agora}
        rotulo={(f) => (f.dias > 0 ? preencherAto(t.faixa.faltamDias, { d: f.dias, h: f.horas }) : preencherAto(t.faixa.faltamHoras, { h: f.horas, m: f.minutos }))}
        className="al-faixa-ato-flaps"
      />
    </Link>
  );
}
