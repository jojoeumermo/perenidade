// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BackendError, getClient } from "@/lib/backend";
import type { VideoRegravado } from "@/lib/rede/midia/regravar";

async function token(): Promise<string> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

/**
 * Sobe o vídeo já regravado para a rota do servidor (app/api/rede/video), com o andamento. A rota limpa de novo, reserva o caminho
 * no banco e guarda no depósito. Devolve o id da reserva, que entra no post depois de publicar.
 */
export async function enviarVideo(v: VideoRegravado, aoProgresso: (fracao: number) => void, sinal?: AbortSignal): Promise<string> {
  const t = await token();
  const q = new URLSearchParams({ d: String(Math.round(v.duracao)), l: String(v.largura), a: String(v.altura), s: v.som ? "1" : "0" });
  return new Promise((pronto, falhou) => {
    const x = new XMLHttpRequest();
    x.open("POST", `/api/rede/video?${q.toString()}`);
    x.setRequestHeader("Authorization", `Bearer ${t}`);
    x.setRequestHeader("Content-Type", v.tipo);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable) aoProgresso(e.loaded / e.total);
    };
    x.onload = () => {
      let corpo: { id?: string; erro?: string } | null = null;
      try {
        corpo = JSON.parse(x.responseText) as { id?: string; erro?: string };
      } catch {
        corpo = null;
      }
      if (x.status >= 200 && x.status < 300 && corpo?.id) return pronto(corpo.id);
      falhou(new BackendError(corpo?.erro ?? (x.status === 413 ? "grande" : x.status === 415 ? "tipo" : "falha")));
    };
    x.onerror = () => falhou(new BackendError("sem_conexao"));
    x.onabort = () => falhou(new Error("cancelado"));
    sinal?.addEventListener("abort", () => x.abort());
    x.send(v.blob);
  });
}
