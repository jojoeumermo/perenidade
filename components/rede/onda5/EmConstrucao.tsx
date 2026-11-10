// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDaOnda5, textosDaTela, type TextosDaOnda5 } from "@/lib/rede/textos-onda5";
import { enderecos } from "@/lib/rede/tipos";
import type { PropsDaTelaDoPacote } from "../registro";
import { LinkBotao } from "../ui/Botao";

/**
 * A tela "em construção" das rotas novas da Onda 5 (F0): cada frente troca a sua pela de verdade. Só aparece com as flags ligadas
 * (a página dá 404 antes disso). Diz o que a tela vai ser, avisa que nada é guardado aqui e leva de volta ao início: nenhum
 * botão de enfeite.
 */
export function EmConstrucao({ lang, nome }: PropsDaTelaDoPacote & { nome: string }) {
  const [t, setT] = useState<TextosDaOnda5 | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaOnda5(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  const tela = t ? textosDaTela(t, nome) : null;
  return (
    <section aria-labelledby="al-em-construcao" aria-busy={!t} className="al-em-construcao">
      {/* Sem faixa e sem marca próprias: a tela mora dentro da casca da Alumia, que já mostra as duas. */}
      <div className="al-em-construcao-miolo">
        <p className="al-em-construcao-selo al-cond">{t?.emConstrucao.selo ?? ""}</p>
        <h1 id="al-em-construcao" className="al-cond al-em-construcao-titulo">
          {tela?.titulo ?? ""}
        </h1>
        <p className="al-em-construcao-texto">{tela?.descricao ?? ""}</p>
        <p className="al-em-construcao-aviso">{t?.emConstrucao.aviso ?? ""}</p>
        <LinkBotao href={enderecos.linha(lang)} variante="primario" tamanho="g">
          {t?.emConstrucao.voltar ?? "Alumia"}
        </LinkBotao>
        <p className="al-em-construcao-rodape">{t?.emConstrucao.rodape ?? ""}</p>
      </div>
    </section>
  );
}
