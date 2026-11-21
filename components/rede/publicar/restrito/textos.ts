// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type pt from "@/i18n/rede/publicar/restrito/pt.json";
import { prontoDe } from "../../../../lib/rede/textos-prontos";

/** Os textos dos posts restritos cifrados e da sala de voz do grupo: i18n/rede/publicar/restrito/{pt,en,es,fr,ru,zh}.json. */
export type TextosDoRestrito = typeof pt;

// O navegador baixa SÓ o idioma da pessoa, e só quando um grupo cifrado aparece.
const CARREGADORES: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/publicar/restrito/pt.json"),
  en: () => import("@/i18n/rede/publicar/restrito/en.json"),
  es: () => import("@/i18n/rede/publicar/restrito/es.json"),
  fr: () => import("@/i18n/rede/publicar/restrito/fr.json"),
  ru: () => import("@/i18n/rede/publicar/restrito/ru.json"),
  zh: () => import("@/i18n/rede/publicar/restrito/zh.json"),
};

const guardados = new Map<string, Promise<TextosDoRestrito>>();
const prontos = new Map<string, TextosDoRestrito>();

export function carregarTextosDoRestrito(lang: string): Promise<TextosDoRestrito> {
  const l = lang in CARREGADORES ? lang : "pt";
  let p = guardados.get(l);
  if (!p) {
    p = prontoDe(CARREGADORES[l], CARREGADORES.pt).then((d) => {
      const t = d as TextosDoRestrito;
      prontos.set(l, t);
      return t;
    });
    guardados.set(l, p);
  }
  return p;
}

/** Os textos, ou nulo enquanto chegam. `ligado` falso: nem baixa (a tela sem grupo cifrado não paga nada). */
export function useTextosDoRestrito(lang: string, ligado = true): TextosDoRestrito | null {
  const l = lang in CARREGADORES ? lang : "pt";
  const [t, setT] = useState<TextosDoRestrito | null>(() => prontos.get(l) ?? null);
  useEffect(() => {
    if (!ligado || (t && prontos.get(l) === t)) return;
    let vivo = true;
    carregarTextosDoRestrito(l).then(
      (x) => vivo && setT(x),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [l, t, ligado]);
  return t;
}

/** A frase da recusa da cifra (o código vem de cifrarParaOGrupo). */
export function textoDaCifra(t: TextosDoRestrito, codigo: "sem_chave" | "grupo_suspeito" | "sem_identidade" | "falha"): string {
  return codigo === "grupo_suspeito" ? t.suspeito : codigo === "sem_chave" ? t.semChave : codigo === "sem_identidade" ? t.semIdentidade : t.falha;
}
