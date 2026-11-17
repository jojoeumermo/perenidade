// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import { ligado } from "@/lib/recursos";
import { verificarAntesDePublicar, type MemoriaDosAvisos } from "@/lib/rede/modoato/antes-de-publicar";
import { armazemDoNavegador, CHAVE_DO_MODO_ATO, lerModoAto } from "@/lib/rede/modoato/aparelho";
import { carregarTextosDoModoAto } from "@/lib/rede/modoato/textos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe da frente 9C (modo ato e depois do ato): o que ela pendura nas telas comuns, tudo atrás de "rede-v2" + "alumia-2" +
 * "alumia-modo-ato" (lib/recursos.ts). Desligado, o encaixe fica vazio.
 *
 *   menu              "Modo ato", para quem tem conta: leva a /alumia/modo-ato;
 *   topoDaLinha       a barra do modo ato ligado (desde quando, "Estou bem" e o pânico), no alto do Início;
 *   colunaDireita     a mesma barra, no alto da coluna da direita do computador;
 *   anexosDoCartao    "Voltou do ato? Avisar que estou bem" no cartão do ato confirmado que já começou (até 24 horas);
 *   antesDePublicar   o aviso de dado pessoal com placa e telefone fixo e, com o modo ato ligado, o aviso de foto com gente;
 *   aoSairRapido      o pânico esquece o modo ato deste aparelho.
 * Nenhuma peça daqui guarda nada fora do aparelho, e nenhuma mostra número ou lista de pessoas.
 */
const LIGADO = alumia2Ligada() && ligado("alumia-modo-ato");

const NOME: Record<string, string> = { pt: "Modo ato", en: "Protest mode", es: "Modo acto", fr: "Mode manif", ru: "Режим акции", zh: "行动模式" };

const BarraDoTopo = dynamic(() => import("./BarraDoModoAto").then((m) => m.BarraDoTopo), { ssr: false });
const BarraDoLado = dynamic(() => import("./BarraDoModoAto").then((m) => m.BarraDoLado), { ssr: false });
const AnexoEstouBem = dynamic(() => import("./AnexoEstouBem").then((m) => m.AnexoEstouBem), { ssr: false });

/** O "já avisei" das verificações (uma por aba; some ao recarregar). */
const memoria: MemoriaDosAvisos = new Map();

export const encaixe: Encaixe = !LIGADO ? {} : {
  menu: [
    {
      chave: "modo-ato",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" />
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/modo-ato` : null),
    },
  ],
  topoDaLinha: [BarraDoTopo],
  colunaDireita: [BarraDoLado],
  anexosDoCartao: [AnexoEstouBem],
  antesDePublicar: [
    async (pedido, { lang }) => {
      const t = (await carregarTextosDoModoAto(lang)).verificar;
      return verificarAntesDePublicar(pedido, { t, modoAto: lerModoAto(armazemDoNavegador()).ligado, memoria });
    },
  ],
  aoSairRapido: [
    () => {
      try {
        armazemDoNavegador()?.removeItem(CHAVE_DO_MODO_ATO);
      } catch {
        // sem armazenamento: nada a esquecer
      }
    },
  ],
};
