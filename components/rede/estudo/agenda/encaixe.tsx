// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import type { Encaixe } from "../../encaixes";
import { estudoLigado } from "../turma/ligado";

/**
 * Encaixe da frente 11C (agenda de provas e monitoria). Desligado (../turma/ligado.ts), o encaixe fica vazio.
 *
 *   menu            "Agenda", para quem tem conta: leva a /alumia/agenda;
 *   colunaDireita   "Próximas provas": as duas próximas datas que a pessoa pediu para ser avisada (só dela; nada de quem mais).
 */
const NOME: Record<string, string> = { pt: "Agenda", en: "Study calendar", es: "Agenda", fr: "Agenda", ru: "Календарь", zh: "日程" };

const ProximasProvas = dynamic(() => import("./ProximasProvas").then((m) => m.ProximasProvas), { ssr: false });

export const encaixe: Encaixe = !estudoLigado() ? {} : {
  menu: [
    {
      chave: "agenda",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
          <path d="M8 14h3v3H8z" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/agenda` : null),
    },
  ],
  colunaDireita: [ProximasProvas],
};
