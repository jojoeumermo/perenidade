// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { ligado, type Recurso } from "@/lib/recursos";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

// Carregados só quando um cartão (ou a linha de Início) aparece.
const AnexoDaCoautoria = dynamic(() => import("./AnexoDaCoautoria"), { ssr: false });
const AcoesDaCoautoria = dynamic(() => import("./AcoesDaCoautoria"), { ssr: false });
const ConvitesNoTopo = dynamic(() => import("./ConvitesNoTopo"), { ssr: false });

/**
 * Encaixe da frente 12C (assinar junto e reagir). Quem junta acrescenta `coautoria` à lista de components/rede/encaixes.tsx (import
 * de "./coautoria/encaixe") e a chave "alumia-coautoria" em lib/recursos.ts (descrição e SO_PELO_NOME). Desligada, o encaixe fica
 * vazio e nada muda na tela. Pendura:
 *   - no cartão, embaixo do texto: quem assina junto (só quem aceitou), o convite para quem foi chamada, a fonte da autora, o
 *     "Fonte?" de quem lê e os painéis da autora;
 *   - no menu "mais" do cartão, só para a autora: Assinar junto, Pôr a fonte e Marcar na foto;
 *   - no alto do Início: os convites para assinar junto que esperam a resposta da pessoa.
 * A checagem do Vale o Escrito na nota de contexto já vem em components/rede/conversa/NotasDeContexto.tsx (sem encaixe).
 */
export const encaixe: Encaixe = !ligado("alumia-coautoria" as Recurso)
  ? {}
  : {
      anexosDoCartao: [AnexoDaCoautoria as React.ComponentType<ContextoDoEncaixe & { post: Post }>],
      acoesDoCartao: [AcoesDaCoautoria as React.ComponentType<ContextoDoEncaixe & { post: Post }>],
      topoDaLinha: [ConvitesNoTopo as React.ComponentType<ContextoDoEncaixe>],
    };
