// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { getClient } from "./backend";

// O painel fala com o canal do instituto no YouTube só pela função "youtube" do serviço (supabase/functions/youtube):
// a autorização do canal nunca chega ao navegador de ninguém.

export type PedidoAoCanal =
  | { acao: "situacao" }
  | { acao: "enviar" | "liberar"; id: string }
  | { acao: "transmissao" | "encerrar"; aula: string };

export interface RespostaDoCanal {
  erro?: string;
  ligado?: boolean;
  youtube?: string;
  travado?: boolean;
  rtmp?: string;
  chave?: string;
  ok?: boolean;
}

export async function pedirAoCanal(pedido: PedidoAoCanal): Promise<RespostaDoCanal> {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase.functions.invoke<RespostaDoCanal>("youtube", { body: pedido });
    if (error || !data) return { erro: (error as { context?: { status?: number } } | null)?.context?.status === 403 ? "sem_permissao" : "servico" };
    return data;
  } catch {
    return { erro: "servico" };
  }
}

export const mensagensDoCanal: Record<string, string> = {
  desligado: "O canal do YouTube ainda não foi ligado: a coordenação precisa guardar a autorização do canal nos segredos do Supabase (passo a passo em docs/YOUTUBE.md).",
  sem_permissao: "Você não pode fazer isso no canal. Mandar aulas ao YouTube é da curadoria e da coordenação; a chave da transmissão é de quem conduz a aula.",
  cota: "O YouTube limita quanto o canal envia por dia. Tente de novo amanhã.",
  lives_desligadas: "O canal ainda não pode transmitir ao vivo: a coordenação precisa ativar as transmissões no YouTube Studio (na primeira vez, leva até 24 horas).",
  ocupado: "Esta aula já está sendo enviada ao YouTube. Espere alguns minutos.",
  nao_encontrado: "Aula não encontrada (ou ainda não aprovada).",
  servico: "O YouTube não respondeu. Tente de novo em alguns minutos.",
};

export const mensagemDoCanal = (erro: string) => mensagensDoCanal[erro] ?? mensagensDoCanal.servico;

export const linkDoYoutube = (id: string) => `https://youtu.be/${id}`;
