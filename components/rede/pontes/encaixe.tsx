// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Encaixe da frente 13E (pontes). Quem junta acrescenta `pontes` à lista de components/rede/encaixes.tsx (import de
// "./pontes/encaixe"), as telas "pontes" (TelaDasPontes, menu "perfil") e "trabalhadores" (TelaDosTrabalhadores, menu "nenhum") ao
// registro, as rotas /alumia/pontes e /alumia/trabalhadores em lib/rede/rotas-novas.ts (flag "alumia-org") e
// app/[lang]/alumia/{pontes,trabalhadores}/page.tsx. Pendura:
//   menu              "Mural do Trabalho", com as organizações ligadas ("alumia-org"). O mesmo nome no menu, no título da página e
//                     na descrição do item para o leitor de tela (o antigo "Mural dos Trabalhadores" quebrava em duas linhas no menu
//                     de 1440 e fazia o menu e a página terem nomes diferentes);
//   acoesDoCartao     "Traduzir" no menu "mais" do cartão (só com "alumia-traducao" e o tradutor do servidor configurado);
//   anexosDoCartao    a tradução embaixo do texto, e o rótulo ROBÔ de todo post de conta automática (sempre, sem desligar);
//   secoesDeAjustes   Pontes (com a Alumia nova): o resumo das comunidades por e-mail e o caminho para os robôs e o Telegram (entrar pelo
//                     Tor fica na Segurança da conta).
// Nenhuma peça mostra número ou lista de pessoas.
import dynamic from "next/dynamic";
import { pontesLigadas, traducaoLigada } from "@/lib/rede/pontes/ligado";
import { cartaoP4Ligado } from "@/lib/rede/p4/cartao/ligado";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import { PREVIA_DAS_PONTES } from "./cliente";

/** O nome inteiro do mural (o título da página, i18n/rede/onda5, e a descrição do item do menu para o leitor de tela). */
const NOME_DO_MURAL: Record<string, string> = { pt: "Mural do Trabalho", en: "Workers' Board", es: "Mural del Trabajo", fr: "Mur du travail", ru: "Доска труда", zh: "工人公告栏" };
/** O nome curto, só no menu lateral: cabe numa linha no menu de 1440 sem perder o sentido. */
const NOME_CURTO_DO_MURAL: Record<string, string> = { pt: "Mural do Trabalho", en: "Workers' Board", es: "Mural del Trabajo", fr: "Mur du travail", ru: "Доска труда", zh: "工人公告栏" };
const NOME_DOS_AJUSTES: Record<string, string> = { pt: "Pontes", en: "Bridges", es: "Puentes", fr: "Passerelles", ru: "Мосты", zh: "桥梁" };

const ALUMIA = PREVIA_DAS_PONTES || alumia2Ligada();
const LIGADAS = PREVIA_DAS_PONTES || pontesLigadas();
// Prompt 4, item 31: com "alumia-p4-cartao-do-post", o Traduzir aparece também sem o nosso servidor (traduz no aparelho).
const TRADUCAO = traducaoLigada() || PREVIA_DAS_PONTES || cartaoP4Ligado();

const BotaoTraduzir = dynamic(() => import("./Traduzir").then((m) => m.BotaoTraduzir), { ssr: false });
const TraducaoNoCartao = dynamic(() => import("./Traduzir").then((m) => m.TraducaoNoCartao), { ssr: false });
const RotuloNoCartao = dynamic(() => import("./RotuloDeRobo").then((m) => m.RotuloNoCartao), { ssr: false });
const AjustesDasPontes = dynamic(() => import("./AjustesDasPontes"), { ssr: false });

type PecaDoCartao = React.ComponentType<ContextoDoEncaixe & { post: import("@/lib/rede/tipos").Post }>;

const MENU = [
  {
    chave: "trabalhadores",
    rotulo: ({ lang }: ContextoDoEncaixe) => NOME_CURTO_DO_MURAL[lang] ?? NOME_CURTO_DO_MURAL.pt,
    rotuloInteiro: ({ lang }: ContextoDoEncaixe) => NOME_DO_MURAL[lang] ?? NOME_DO_MURAL.pt,
    icone: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="8" height="7" rx="1" />
        <rect x="13" y="4" width="8" height="4" rx="1" />
        <rect x="3" y="13" width="8" height="7" rx="1" />
        <rect x="13" y="10" width="8" height="10" rx="1" />
      </svg>
    ),
    href: ({ lang }: ContextoDoEncaixe) => `/${lang}/alumia/trabalhadores`,
  },
];

// O rótulo de robô vale com a Alumia nova inteira, mesmo com as organizações desligadas depois: post de robô nunca fica sem ele.
export const encaixe: Encaixe = !ALUMIA ? {} : {
  menu: LIGADAS ? MENU : [],
  acoesDoCartao: TRADUCAO ? [BotaoTraduzir as PecaDoCartao] : [],
  anexosDoCartao: [RotuloNoCartao as PecaDoCartao, ...(TRADUCAO ? [TraducaoNoCartao as PecaDoCartao] : [])],
  secoesDeAjustes: [{ chave: "pontes", titulo: ({ lang }) => NOME_DOS_AJUSTES[lang] ?? NOME_DOS_AJUSTES.pt, Componente: AjustesDasPontes as React.ComponentType<ContextoDoEncaixe> }],
};
