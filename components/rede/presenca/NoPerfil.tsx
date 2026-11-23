// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, itens 6 e 1, no cabeçalho do perfil (components/rede/perfil/livre/Cabecalho.tsx):
//   PresencaRecente    "ativo recentemente", só quando a dona ligou o status e quem vê está na roda de confiança dela (o banco decide;
//                      para todo o resto a resposta é a mesma de quem não está ativo). Nunca a hora, nunca "visto por último".
//   useRostoProtegido  a foto de perfil que a dona protegeu: a própria moldura vira o conteúdo protegido (some quando a janela sai
//                      da frente, não copia nem arrasta, leva a marca d'água com o codinome de quem vê). Nada é gravado de quem abriu.
// Desligado ("alumia-p4-presenca-print") ou sem conta: nada é pedido ao servidor e nada muda na tela.
import "./presenca.css";
import type { ReactNode, RefObject } from "react";
import { atributosDaProtecao, CamadaDeProtecao, useProtecaoContraPrint } from "./ConteudoProtegido";
import { useTextosDePresencaEPrint } from "./textos";
import { presencaEPrintLigados, useFotoProtegida, usePresencaRecente } from "./usar";

export function PresencaRecente({ handle, lang, logado }: { handle: string; lang: string; logado: boolean }) {
  const recente = usePresencaRecente(handle, logado);
  const t = useTextosDePresencaEPrint(lang, recente);
  if (!recente || !t) return null;
  return (
    <span className="p4-recente" title={t.recenteAjuda} data-p4-recente="">
      {t.recente}
    </span>
  );
}

/**
 * A proteção da foto de @handle (`null`: nenhuma, como na prévia do editor) na moldura de `ref`. Devolve os atributos da moldura e a
 * camada (marca d'água e capa) que vai dentro dela, por último. Desligada, os atributos vêm vazios e a camada é nula.
 */
export function useRostoProtegido(
  ref: RefObject<HTMLElement | null>,
  handle: string | null,
  lang: string,
  logado: boolean,
): { atributos: Record<string, string | undefined>; camada: ReactNode } {
  const pedir = presencaEPrintLigados() && logado && !!handle;
  const { protegida, marca } = useFotoProtegida(pedir ? handle : null, logado);
  const t = useTextosDePresencaEPrint(lang, protegida);
  const ativo = protegida && !!t;
  const escondido = useProtecaoContraPrint(ref, ativo);
  if (!ativo || !t) return { atributos: {}, camada: null };
  return {
    atributos: { ...atributosDaProtecao(true, escondido), title: t.protegido },
    camada: <CamadaDeProtecao marca={marca} escondido={escondido} textoEscondido={t.escondido} />,
  };
}
