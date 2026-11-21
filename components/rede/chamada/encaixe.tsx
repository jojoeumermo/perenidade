// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import { ligado } from "@/lib/recursos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { guardaDosToques } from "@/lib/rede/chamada/guarda";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

/**
 * Encaixe das chamadas da conversa a dois (Prompt 4, itens 139 e 140, atrás de "alumia-p4-chamadas"). Ligado, o cartão da chamada
 * (o toque que chegou e a chamada aberta) fica em toda tela pela coluna da direita; os botões de ligar ficam no alto da conversa
 * (components/rede/chat/Conversa.tsx). Desligado, o encaixe só limpa: o "Sair rápido" apaga os toques da memória (apagar nunca
 * precisa de flag).
 */
const ChamadaNaCasca = dynamic<ContextoDoEncaixe>(() => import("./NaCasca").then((m) => m.ChamadaNaCasca), { ssr: false });

const limpar = () => guardaDosToques.esquecer();

export const encaixe: Encaixe = !(alumia2Ligada() && ligado("alumia-p4-chamadas"))
  ? { aoSairRapido: [limpar] }
  : { colunaDireita: [ChamadaNaCasca], aoSairRapido: [limpar] };
