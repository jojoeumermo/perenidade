// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Peças pequenas que as telas do acervo dividem: o recado que some sozinho (role="status"), a data curta e a comparação de versões.
import { useCallback, useEffect, useRef, useState } from "react";
import { diferencaDeLinhas } from "./regras";
import type { TextosDoAcervo } from "./textos";

/** Um recado curto para leitor de tela e para quem vê (some em 5 s). Erro fica até a próxima ação. */
export function useRecado() {
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrar = useCallback((texto: string, erro = false) => {
    if (relogio.current) clearTimeout(relogio.current);
    setRecado({ texto, erro });
    if (!erro) relogio.current = setTimeout(() => setRecado(null), 5000);
  }, []);
  useEffect(() => () => {
    if (relogio.current) clearTimeout(relogio.current);
  }, []);
  return { recado, mostrar };
}

export function Recado({ recado }: { recado: { texto: string; erro: boolean } | null }) {
  return (
    <p role={recado?.erro ? "alert" : "status"} className={recado ? "acv-aviso" : undefined} hidden={!recado}>
      {recado?.texto}
    </p>
  );
}

/** "13 de nov. de 2026" no idioma da tela. */
export function dataCurta(lang: string, iso: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** A diferença entre a versão de antes e a atual, linha a linha (o que saiu riscado, o que entrou sublinhado e com rótulo). */
export function Diferenca({ antes, agora, t }: { antes: string; agora: string; t: TextosDoAcervo }) {
  const linhas = diferencaDeLinhas(antes, agora);
  if (!linhas.some((l) => l.tipo !== "igual")) return <p className="acv-dica">{t.wiki.semMudanca}</p>;
  return (
    <div className="acv-dif">
      {linhas.map((l, i) => (
        <p key={i} data-tipo={l.tipo === "igual" ? undefined : l.tipo}>
          {l.tipo !== "igual" && <span>{l.tipo === "saiu" ? t.wiki.saiu : t.wiki.entrou}</span>}
          {l.texto || " "}
        </p>
      ))}
    </div>
  );
}

export function IconeVoltarAcervo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
