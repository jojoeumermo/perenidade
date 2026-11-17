// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Encaixe } from "../../encaixes";
import { estudoLigado } from "./ligado";

/**
 * Encaixe da frente 11C (turmas de estudo): o item "Turmas" no menu, para quem tem conta, levando a /alumia/turmas. Desligado
 * (ligado.ts), o encaixe fica vazio. Nada daqui mostra pessoa nem número abaixo de 3.
 */
const NOME: Record<string, string> = { pt: "Turmas", en: "Study groups", es: "Grupos de estudio", fr: "Groupes d’étude", ru: "Учебные группы", zh: "学习小组" };

export const encaixe: Encaixe = !estudoLigado() ? {} : {
  menu: [
    {
      chave: "turmas",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <path d="M14 17.5l2.2 2.2L20.5 15" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/turmas` : null),
    },
  ],
};
