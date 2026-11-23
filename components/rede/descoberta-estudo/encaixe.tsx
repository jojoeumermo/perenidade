// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe de Descobrir e Estudar (Prompt 4, lote descoberta e estudo). Com as rotas ligadas (lib/rede/rotas-novas.ts, flag
 * "alumia-p4-descoberta-estudo"), os itens "Descobrir" e "Estudar" entram no grupo Mais do menu de quem tem conta. Desligadas, o
 * encaixe fica vazio e nada aparece.
 */
const DESCOBRIR: Record<string, string> = { pt: "Descobrir", en: "Discover", es: "Descubrir", fr: "Découvrir", ru: "Открытия", zh: "发现" };
const ESTUDAR: Record<string, string> = { pt: "Estudar", en: "Study", es: "Estudiar", fr: "Étudier", ru: "Учёба", zh: "学习" };

export const encaixe: Encaixe = !rotaNovaLigada("descobrir") ? {} : {
  menu: [
    {
      chave: "descobrir",
      lugar: "mais",
      rotulo: ({ lang }) => DESCOBRIR[lang] ?? DESCOBRIR.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/descobrir` : null),
    },
    {
      chave: "estudar",
      lugar: "mais",
      rotulo: ({ lang }) => ESTUDAR[lang] ?? ESTUDAR.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
          <path d="M7 10.5v4.5c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.5" />
          <path d="M21 8.5v6" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/estudar` : null),
    },
  ],
};
