// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { Flaps } from "../ui/Flaps";
import { pontoEDetalhe } from "@/lib/rede/atos/formulario";
import { dataCurta, diaEHora } from "@/lib/rede/atos/tempo";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato } from "@/lib/rede/tipos-atos";
import "./atos.css";

/**
 * A faixa dourada "PRÓXIMO ATO" (pranchas computador-inicio e celular-inicio): o nome, quando e onde, e quanto falta em
 * plaquinhas ("2d 04h"). A faixa inteira leva à página do ato. No celular sai a versão curta ("sex 18h · Sé"); no computador, a
 * longa ("sex 15/11, 18h · Praça da Sé, São Paulo"). Ato cancelado não vira faixa (quem chama já filtra; aqui conferimos de novo).
 */
export function FaixaProximoAto({ ato, t, lang }: { ato: Ato; t: TextosDosAtos; lang: string }) {
  if (ato.situacao === "cancelado") return null;
  const { ponto } = pontoEDetalhe(ato.onde);
  return (
    <Link href={`/${lang}/alumia/ato/${ato.id}`} className="al-faixa-ato" data-situacao={ato.situacao}>
      <span className="al-cond al-faixa-ato-rotulo">{t.faixa.rotulo}</span>
      <span className="al-faixa-ato-texto">
        <span className="al-faixa-ato-curto">
          {ato.titulo} · {diaEHora(ato.inicio, lang)} · {ponto}
        </span>
        <span className="al-faixa-ato-longo">
          {ato.titulo} · {dataCurta(ato.inicio, lang)} · {ponto}, {ato.cidade}
        </span>
      </span>
      <Flaps
        ate={ato.inicio}
        agoraTexto={t.faixa.agora}
        rotulo={(f) => (f.dias > 0 ? preencherAto(t.faixa.faltamDias, { d: f.dias, h: f.horas }) : preencherAto(t.faixa.faltamHoras, { h: f.horas, m: f.minutos }))}
        className="al-faixa-ato-flaps"
      />
    </Link>
  );
}
