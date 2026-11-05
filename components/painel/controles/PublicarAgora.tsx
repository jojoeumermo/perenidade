// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { getClient } from "@/lib/backend";
import { Botao, confirmar, notificar } from "../ui";

/** Pergunta à rota se a publicação fora de hora está ligada (token do GitHub no servidor). Sem token, o botão nem aparece. */
export function usePublicacaoLigada(ativo = true) {
  const [ligada, setLigada] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    fetch("/api/painel/publicar-agora")
      .then((r) => r.json())
      .then((r: { configurado?: boolean }) => vivo && setLigada(Boolean(r.configurado)))
      .catch(() => vivo && setLigada(false));
    return () => {
      vivo = false;
    };
  }, [ativo]);
  return ligada;
}

/** Pede a rotina de publicação fora de hora. Devolve o texto para mostrar (sucesso ou erro) e se deu certo. */
export async function pedirPublicacaoAgora(): Promise<{ ok: boolean; texto: string }> {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const r = await fetch("/api/painel/publicar-agora", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
    if (r.ok) return { ok: true, texto: "Publicação pedida: em alguns minutos o GitHub roda a rotina, e o site atualiza depois do build." };
    return { ok: false, texto: corpo.erro ?? "Não deu para pedir a publicação." };
  } catch {
    return { ok: false, texto: "Não deu para pedir a publicação." };
  }
}

/**
 * O botão "Publicar agora": o mesmo em qualquer tela do painel. Pergunta antes (a rotina publica tudo o que já foi aprovado,
 * não só o que está nesta tela), pede à rota e avisa o resultado. Some quando a publicação fora de hora não está ligada,
 * a não ser que "explicar" esteja ligado (o Centro de controle explica por que não há botão).
 */
export function PublicarAgora({ rotulo = "Publicar agora", pequeno = false, explicar = false, aoPedir }: { rotulo?: string; pequeno?: boolean; explicar?: boolean; aoPedir?: () => void }) {
  const ligada = usePublicacaoLigada();
  const [ocupado, setOcupado] = useState(false);
  if (ligada === null) return null;
  if (!ligada) {
    return explicar ? <p className="pn-ajuda">A publicação fora de hora ainda não está ligada neste servidor (falta o token do GitHub). A rodada diária publica do mesmo jeito.</p> : null;
  }
  async function pedir() {
    const certo = await confirmar({ titulo: "Publicar agora?", texto: "A rotina publica tudo o que já foi aprovado e ainda não foi ao ar, não só o que está nesta tela. O site atualiza em alguns minutos.", confirmar: "Publicar agora" });
    if (!certo) return;
    setOcupado(true);
    const r = await pedirPublicacaoAgora();
    setOcupado(false);
    if (r.ok) {
      notificar.ok(r.texto);
      aoPedir?.();
    } else notificar.erro(r.texto);
  }
  return (
    <Botao pequeno={pequeno} disabled={ocupado} onClick={() => void pedir()} title="Roda a rotina de publicação agora, sem esperar a da hora">
      {ocupado ? "Pedindo…" : rotulo}
    </Botao>
  );
}
