// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { useI18n } from "@/components/I18n";
import { localePath } from "@/i18n/config";
import { classeDoVeredito, sortear, type ChecagemParaJogo } from "@/lib/jogos-proprios/regras";
import { Btn, Moldura } from "./kit";

const RODADA = 5;

/** Fato ou boato?: a frase vem das checagens do próprio site; a resposta é o veredito delas, com o link para ler tudo. */
export default function FatoOuBoato({ checagens }: { checagens: ChecagemParaJogo[] }) {
  const { lang } = useI18n();
  const [rodada, setRodada] = useState<ChecagemParaJogo[] | null>(null);
  const [i, setI] = useState(0);
  const [palpite, setPalpite] = useState<"fato" | "boato" | "enganoso" | null>(null);
  const [certas, setCertas] = useState(0);

  const atual = rodada?.[i];
  const classe = atual ? classeDoVeredito(atual.veredito) : null;
  // As checagens do site hoje são "Falso" ou "Enganoso" (nenhuma "Verdadeiro"); por isso há três respostas, e "enganoso" é a que tem um fundo de verdade.
  const gabarito = classe ?? "boato";

  function comecar() {
    setRodada(sortear(checagens, RODADA));
    setI(0);
    setPalpite(null);
    setCertas(0);
  }

  return (
    <Moldura titulo="Fato ou boato?" ajuda={`Cinco frases que circulam por aí, tiradas das checagens do próprio Instituto. Diga se é verdade, falso ou enganoso (tem um pouco de verdade, mas engana) e leia a checagem completa.`}>
      {checagens.length === 0 && <p className="text-sm">As checagens não puderam ser carregadas agora.</p>}
      {checagens.length > 0 && !rodada && <Btn tipo="tinta" onClick={comecar}>Começar</Btn>}
      {atual && (
        <div>
          <p className="text-xs text-ink-soft">Frase {i + 1} de {rodada!.length}</p>
          <blockquote className="mt-1 border-l-4 border-ink pl-3 font-serif text-xl">{atual.alegacao}</blockquote>
          <div className="mt-3 flex flex-wrap gap-2">
            {([["fato", "É verdade"], ["boato", "É falso"], ["enganoso", "É enganoso"]] as const).map(([k, rot]) => (
              <Btn key={k} ativo={palpite === k} desligado={palpite !== null} onClick={() => { setPalpite(k); if (gabarito === k) setCertas((c) => c + 1); }}>{rot}</Btn>
            ))}
          </div>
          {palpite && (
            <div className="mt-3 text-sm" aria-live="polite">
              <p><b>{palpite === gabarito ? "Acertou." : "Dessa vez não."}</b> A checagem concluiu: <b>{atual.veredito}</b>. {atual.titulo}.</p>
              <p className="mt-1"><Link href={localePath(lang, `/checagens#${atual.slug}`)} className="underline underline-offset-2">Ler a checagem completa, com as fontes</Link></p>
              <div className="mt-2 flex gap-2">
                {i + 1 < rodada!.length ? <Btn tipo="tinta" onClick={() => { setI(i + 1); setPalpite(null); }}>Próxima</Btn> : <p>Fim da rodada: {certas} de {rodada!.length}. Quando quiser, jogue de novo com outras frases.</p>}
                {i + 1 >= rodada!.length && <Btn onClick={comecar}>Outra rodada</Btn>}
              </div>
            </div>
          )}
        </div>
      )}
    </Moldura>
  );
}
