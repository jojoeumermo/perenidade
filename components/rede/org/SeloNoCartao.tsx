// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDaOrg, type TextosDaOrg } from "@/lib/rede/textos-org";
import type { Post } from "@/lib/rede/tipos";
import { orgLigada } from "@/lib/rede/org/flag";
import { SeloPequeno } from "./partes";

// Os textos da F4 de cada idioma carregam uma vez só para todos os cartões da linha.
const textos = new Map<string, Promise<TextosDaOrg>>();
function textosDe(lang: string): Promise<TextosDaOrg> {
  let p = textos.get(lang);
  if (!p) {
    p = carregarTextosDaOrg(lang);
    textos.set(lang, p);
  }
  return p;
}

/**
 * O selo "Organização verificada" ao lado do nome no cartão do post (prancha computador-inicio, cartão da Mandata Popular). Só
 * aparece quando o post vem de uma conta de organização verificada (`post.org.verificada_em`) e com a flag "alumia-org" ligada;
 * sem isso não desenha nada, e o cartão de hoje fica igual. O vínculo com quem gere a conta nunca vem (PLANO-ALUMIA §6.5).
 */
export function SeloNoCartao({ post, lang }: { post: Pick<Post, "org">; lang: string }) {
  const verificada = Boolean(post.org?.verificada_em) && orgLigada();
  const [t, setT] = useState<TextosDaOrg | null>(null);
  useEffect(() => {
    if (!verificada) return;
    let vivo = true;
    textosDe(lang)
      .then((x) => vivo && setT(x))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, verificada]);
  if (!verificada || !t) return null;
  return <SeloPequeno t={t} lang={lang} />;
}
