// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Encaixe do grupo "cartão do post" (prompt 4, itens 30, 31, 35 e 120). Pendura só a lista de reações da comunidade no alto da
// página da comunidade (altoDaComunidade; aparece só para a mediação). O resto entra pelo nome, cada peça atrás da mesma flag: a
// paleta da comunidade nas reações da conversa (./usar, usePaletaDaComunidade), a pasta pública nos Salvos (./PastaPublica), a
// tradução no aparelho no "Traduzir" das pontes e a imagem para Instagram e WhatsApp no "Levar para fora". Desligado
// ("alumia-p4-cartao-do-post", lib/recursos.ts), o encaixe fica vazio e nada muda.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ContextoDoEncaixe, Encaixe } from "../../encaixes";
import { CARTAO_P4 } from "./usar";

const LIGADO = CARTAO_P4;

const ReacoesDaComunidade = dynamic(() => import("./ReacoesDaComunidade"), { ssr: false });

export const encaixe: Encaixe = !LIGADO ? {} : {
  altoDaComunidade: [ReacoesDaComunidade as ComponentType<ContextoDoEncaixe & { slug: string }>],
};
