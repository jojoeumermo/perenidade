// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
//
// Peças pequenas que a turma e a agenda dividem (frente 11C): os textos sob demanda, o {marcador} preenchido, a nota que a tela
// lê em voz alta, o código do erro e o arquivo que nasce no aparelho (.ics).

import { useEffect, useState } from "react";
import { BackendError } from "@/lib/backend";

/** Um gancho de textos sob demanda: o primeiro uso baixa o pedaço do idioma; os outros leem do cache. */
export function criarTextos<T>(carregar: (lang: string) => Promise<T>): (lang: string) => T | null {
  const cache = new Map<string, T>();
  return function useTextos(lang: string): T | null {
    const [chegou, setChegou] = useState<{ lang: string; texto: T } | null>(null);
    useEffect(() => {
      if (cache.has(lang)) return;
      let vivo = true;
      carregar(lang)
        .then((texto) => {
          cache.set(lang, texto);
          if (vivo) setChegou({ lang, texto });
        })
        .catch(() => undefined);
      return () => {
        vivo = false;
      };
    }, [lang]);
    return cache.get(lang) ?? (chegou?.lang === lang ? chegou.texto : null);
  };
}

/** Troca {nome} pelo valor. */
export function encher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}

/** O código curto do erro do banco ("sem_vaga", "invalido:fonte"); vazio quando não é do banco. */
export function codigoDoErro(e: unknown): string {
  return e instanceof BackendError ? e.code : "";
}

/** O texto do erro: o código exato, depois o começo dele ("invalido"), depois o genérico. */
export function textoDoErro(erros: Record<string, string>, e: unknown): string {
  const c = codigoDoErro(e);
  return erros[c] ?? erros[c.split(":")[0]] ?? erros.generico;
}

/** Uma nota curta que a tela lê em voz alta ao aparecer. */
export function Nota({ nota }: { nota: { texto: string; erro?: boolean } | null }) {
  if (!nota) return null;
  return (
    <p className={nota.erro ? "es-nota es-nota-erro" : "es-nota"} role={nota.erro ? "alert" : "status"}>
      {nota.texto}
    </p>
  );
}

/** Entrega um arquivo feito no aparelho (nada vai a servidor nenhum). */
export function baixar(nome: string, conteudo: string, tipo = "text/calendar;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Os ladrilhos do alto de um cartão (as cores das lutas, como na faixa tecida). */
export function Ladrilhos({ cores }: { cores: readonly string[] }) {
  return (
    <span className="es-ladrilhos" aria-hidden>
      {cores.map((c, i) => (
        <span key={i} data-cor={c} />
      ))}
    </span>
  );
}
