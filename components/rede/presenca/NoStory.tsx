// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 1, no visor dos stories (components/rede/stories/Visor.tsx): o story que a autora protegeu some quando a janela sai
// da frente, não copia, não arrasta e leva a marca d'água com o codinome de quem vê, mais o aviso fixo do limite. A autora escolhe
// "Proteger este story" no menu dela. Nada é gravado de quem abriu; a autora nunca é avisada de print. Desligado
// ("alumia-p4-presenca-print"): nada é pedido e o visor fica como sempre.
import "./presenca.css";
import { useState, type ReactNode, type RefObject } from "react";
import { clienteDePresencaEPrint } from "@/lib/rede/cliente-presenca-print";
import { plataformaDaProtecao } from "@/lib/rede/protecao-print";
import { atributosDaProtecao, CamadaDeProtecao, useProtecaoContraPrint } from "./ConteudoProtegido";
import { useTextosDePresencaEPrint } from "./textos";
import { presencaEPrintLigados, useStoriesProtegidos } from "./usar";

export interface ProtecaoDoStory {
  /** O grupo está ligado (o item do menu só aparece assim). */
  disponivel: boolean;
  /** O story da tela está protegido? */
  protegido: boolean;
  /** Os atributos da tela do story (vazios sem proteção). */
  atributos: Record<string, string | undefined>;
  /** A marca d'água, o aviso fixo e a capa (nulo sem proteção). */
  camada: ReactNode;
  /** O rótulo do item do menu da autora ("Proteger este story" ou "Tirar a proteção deste story"). */
  rotulo: string;
  /** Liga ou desliga a proteção do story da tela (só a autora; o banco confere). Devolve a frase do resultado, para anunciar. */
  alternar: () => Promise<string>;
}

/**
 * A proteção do story `atual` (um entre `ids`, os da autora na tela), na tela do visor (`tela`). Pergunta de uma vez só quais dos ids
 * estão protegidos, e só entre os que eu já posso ver.
 */
export function useProtecaoDoStory(tela: RefObject<HTMLElement | null>, ids: readonly string[], atual: string | null, lang: string): ProtecaoDoStory {
  const disponivel = presencaEPrintLigados();
  const { protegidos, marca, mudar } = useStoriesProtegidos(disponivel ? ids : []);
  const protegido = disponivel && !!atual && protegidos.has(atual);
  const t = useTextosDePresencaEPrint(lang, disponivel);
  const ativo = protegido && !!t;
  const escondido = useProtecaoContraPrint(tela, ativo);
  // O visor só monta no aparelho: o agente de usuário já está aqui.
  const [plataforma] = useState(() => (typeof navigator === "undefined" ? "navegador" : plataformaDaProtecao(navigator.userAgent)));

  async function alternar(): Promise<string> {
    if (!atual || !t) return "";
    const sim = !protegido;
    try {
      await clienteDePresencaEPrint().protegerStory(atual, sim);
      mudar(atual, sim);
      return sim ? t.storyProtegido : t.storyDesprotegido;
    } catch {
      return t.ajustes.erro;
    }
  }

  return {
    disponivel: disponivel && !!t,
    protegido,
    atributos: ativo ? atributosDaProtecao(true, escondido) : {},
    camada:
      ativo && t ? (
        <CamadaDeProtecao marca={marca} escondido={escondido} textoEscondido={t.escondido} aviso={`${t.aviso} ${plataforma === "app" ? t.avisoApp : t.avisoNavegador}`} />
      ) : null,
    rotulo: t ? (protegido ? t.storyDesproteger : t.storyProteger) : "",
    alternar,
  };
}
