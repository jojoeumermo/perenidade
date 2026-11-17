// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { useMarcaDoModoAto, useModoAto, useTextosDoModoAto } from "./usar";
import "./modoato.css";

const DIA_MS = 24 * 60 * 60 * 1000;

/** O ato deste post já começou, há menos de 24 horas, não foi cancelado e a pessoa disse que ia? Puro (o teste chama). */
export function voltouDoAto(post: Pick<Post, "chamado" | "vou_eu">, agora: number): boolean {
  if (!post.chamado || !post.vou_eu || post.chamado.situacao === "cancelado") return false;
  const quando = new Date(post.chamado.quando).getTime();
  return Number.isFinite(quando) && quando <= agora && agora - quando < DIA_MS;
}

/**
 * No cartão de um ato que a pessoa confirmou e que já começou (até 24 horas depois): "Voltou do ato? Avisar que estou bem", que
 * leva ao modo ato. Em todo cartão, também põe ou tira a marca do modo ato na raiz (os números somem com o modo ato ligado).
 */
export function AnexoEstouBem({ lang, post }: ContextoDoEncaixe & { post: Post }) {
  const estado = useModoAto();
  useMarcaDoModoAto(estado.ligado);
  // A hora só depois de montar (o servidor não sabe a hora da pessoa).
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setAgora(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const mostrar = agora !== null && voltouDoAto(post, agora);
  const t = useTextosDoModoAto(lang);
  if (!mostrar || !t) return null;
  return (
    <p className="ma-anexo">
      <span>{t.anexo.texto}</span>
      <Link href={`/${lang}/alumia/modo-ato#estou-bem`} className="ma-anexo-link">
        {t.anexo.botao}
      </Link>
    </p>
  );
}
