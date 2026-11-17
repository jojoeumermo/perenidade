// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import type { Post } from "@/lib/rede/tipos";

// A tarja no cartão (só para quem assina um rotulador). Carregada só quando um cartão aparece.
const TarjaDoRotulo = dynamic(() => import("./TarjaDoRotulo"), { ssr: false });

/**
 * Encaixe da frente 9E (rótulos e transparência). Quem junta acrescenta `rotulos` à lista de components/rede/encaixes.tsx (import
 * de "./rotulos/encaixe") e liga a tela /alumia/rotulos (lib/rede/rotas-novas.ts e components/rede/registro.tsx). A tarja só
 * aparece para membro que assina algum rotulador; para os outros o banco devolve lista vazia e nada muda no cartão.
 */
export const encaixe: Encaixe = {
  anexosDoCartao: [TarjaDoRotulo as React.ComponentType<ContextoDoEncaixe & { post: Post }>],
};
