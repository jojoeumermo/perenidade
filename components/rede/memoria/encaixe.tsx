// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

/**
 * Encaixe do grupo "memória e luta" (Prompt 4, itens 43, 44, 115, 116, 119 e 121). Com a rota "memoria-da-luta" ligada
 * (lib/rede/rotas-novas.ts, flag "alumia-p4-memoria-e-luta"): o quadro "Neste dia na luta" no topo da linha (./NesteDiaNaLuta, sem
 * mexer na Linha) e dois itens no grupo "Mais" do menu, "Memória da luta" e "Desafio do dia", para quem tem conta. Desligada, o
 * encaixe fica vazio e nada aparece.
 */
const MEMORIA: Record<string, string> = { pt: "Memória da luta", en: "Memory of the struggle", es: "Memoria de la lucha", fr: "Mémoire de la lutte", ru: "Память борьбы", zh: "斗争的记忆" };
const DESAFIO: Record<string, string> = { pt: "Desafio do dia", en: "Daily challenge", es: "Desafío del día", fr: "Défi du jour", ru: "Задание дня", zh: "每日挑战" };

const NesteDiaNaLuta = dynamic(() => import("./NesteDiaNaLuta"), { ssr: false });

export const encaixe: Encaixe = !rotaNovaLigada("memoria-da-luta") ? {} : {
  topoDaLinha: [NesteDiaNaLuta as ComponentType<ContextoDoEncaixe>],
  menu: [
    {
      chave: "memoria-da-luta",
      lugar: "mais",
      rotulo: ({ lang }) => MEMORIA[lang] ?? MEMORIA.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5.5h16v13H4z" />
          <path d="M8 3.5v4M16 3.5v4M7.5 12h9M7.5 15.5h6" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/memoria-da-luta` : null),
    },
    {
      chave: "desafio",
      lugar: "mais",
      rotulo: ({ lang }) => DESAFIO[lang] ?? DESAFIO.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.8v.2" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/desafio` : null),
    },
  ],
};
