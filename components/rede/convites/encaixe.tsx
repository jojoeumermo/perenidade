// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import { ligado } from "@/lib/recursos";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe da porta de entrada e dos convites (onda 8, frente 8D): o item "Convidar" no menu (leva a /alumia/convite, onde quem já
 * está dentro gera convites com o teto do mês) e a mesma tela como seção dos ajustes. Tudo atrás da flag "alumia-convites"
 * (lib/recursos.ts, só pelo nome). Sem a flag, o encaixe fica VAZIO.
 */
const LIGADO = ligado("alumia-convites");

const NOME: Record<string, string> = { pt: "Convidar", en: "Invite", es: "Invitar", fr: "Inviter", ru: "Пригласить", zh: "邀请" };
const nome = (lang: string) => NOME[lang] ?? NOME.pt;
/** O título da seção em Segurança: um só (o bloco não repete o título dentro). */
const TITULO: Record<string, string> = { pt: "Convidar para a Alumia", en: "Invite to Alumia", es: "Invitar a Alumia", fr: "Inviter sur Alumia", ru: "Пригласить в Алюмию", zh: "邀请加入 Alumia" };

const MeusConvites = dynamic(() => import("./MeusConvites").then((m) => m.MeusConvites), { ssr: false });

export const encaixe: Encaixe = !LIGADO ? {} : {
  menu: [
    {
      chave: "convidar",
      lugar: "conta",
      rotulo: ({ lang }) => nome(lang),
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
          <path d="M10 7v12" strokeDasharray="2 2.5" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/convite` : null),
    },
  ],
  secoesDeAjustes: [{ chave: "convites", titulo: ({ lang }) => TITULO[lang] ?? TITULO.pt, Componente: ({ lang }) => <MeusConvites lang={lang} embutido /> }],
};
