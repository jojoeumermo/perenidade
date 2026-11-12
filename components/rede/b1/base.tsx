// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDaB1, type TextosDaB1 } from "@/lib/rede/textos-b1";
import type { TextosDaRede } from "@/lib/rede/textos";
import { codigoDoErro, textoDoErro } from "../erros";
import "./b1.css";

/** Os textos da B1 no idioma da página (só um idioma chega ao navegador). Nulo enquanto carrega. */
export function useTextosB1(lang: string): TextosDaB1 | null {
  const [t, setT] = useState<{ lang: string; t: TextosDaB1 } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaB1(lang).then((x) => vivo && setT({ lang, t: x }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** O texto do erro, com os dois códigos novos da B1 (nível de confiança e conflito de versão) antes dos da Rede. */
export function erroDaB1(s: Pick<TextosDaRede, "erros">, t: TextosDaB1, e: unknown): string {
  const c = codigoDoErro(e);
  if (c === "nivel") return t.erros.nivel;
  if (c === "conflito") return t.erros.conflito;
  return textoDoErro(s, e);
}

/** A data curta do idioma ("10 nov., 14:30"). */
export function quandoCurto(lang: string, iso: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Um contador de caracteres que só fala quando chega perto do fim (leitor de tela não ouve cada tecla). */
export function Contador({ n, max, modelo }: { n: number; max: number; modelo: string }) {
  const perto = n > max * 0.9;
  return (
    <span className="b1-contador" data-perto={perto ? "sim" : undefined} aria-live={perto ? "polite" : "off"}>
      {preencher(modelo, { n })}
    </span>
  );
}
