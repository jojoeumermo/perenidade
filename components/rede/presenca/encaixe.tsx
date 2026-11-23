// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe do grupo "presença e print" (prompt 4, itens 1, 6 e 9). Pendura só a seção "Presença e proteção contra print" nos Ajustes
// (/alumia/seguranca). O resto entra pelo nome, cada peça atrás da mesma flag: o "ativo recentemente" e a foto protegida no
// cabeçalho do perfil (./NoPerfil), a proteção do story no visor (./NoStory) e os três toques na marca e o "estou aqui" na casca
// (./tres-toques e ./usar). Desligado ("alumia-p4-presenca-print", lib/recursos.ts), o encaixe fica vazio e nada muda.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { presencaPrintLigada } from "@/lib/rede/cliente-presenca-print";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

const TITULO: Record<string, string> = {
  pt: "Presença e proteção contra print",
  en: "Presence and screenshot protection",
  es: "Presencia y protección contra capturas",
  fr: "Présence et protection contre les captures",
  ru: "Присутствие и защита от скриншотов",
  zh: "在线状态与防截屏",
};

const NosAjustes = dynamic(() => import("./NosAjustes"), { ssr: false });

export const encaixe: Encaixe = !presencaPrintLigada()
  ? {}
  : {
      secoesDeAjustes: [{ chave: "p4-presenca-print", titulo: ({ lang }) => TITULO[lang] ?? TITULO.pt, Componente: NosAjustes as ComponentType<ContextoDoEncaixe> }],
    };
