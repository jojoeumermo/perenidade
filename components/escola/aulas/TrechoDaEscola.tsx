// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import "./trecho.css";
import { enderecoAntigoDaEscola } from "@/lib/escola/aulas-abertas";
import { trechoDoTexto } from "@/lib/escola/trecho";

export interface TextosDoTrecho {
  trechoTitulo: string;
  trechoTexto: string;
  trechoLer: string;
  trechoFechar: string;
  trechoFalha: string;
}

type Trecho = { titulo: string; paragrafos: string[]; destino: string } | { falha: true; destino: string };


/**
 * Numa aula do site que cita uma aula de Teoria revolucionária ou de Lutas do povo (que agora moram na Escola, P5, B2), o trecho
 * citado abre numa janela ali mesmo, e um botão leva à aula inteira na Escola. O trecho vem do texto puro da aula (/texto, no
 * próprio site: é o mesmo pedido de quem abre a aula, ninguém fica sabendo de mais nada). Sem JavaScript, ou se o trecho não
 * vier, o link segue para a aula, como sempre.
 */
export function TrechoDaEscola({ lang, s }: { lang: string; s: TextosDoTrecho }) {
  const caixa = useRef<HTMLDialogElement>(null);
  const [trecho, setTrecho] = useState<Trecho | null>(null);

  useEffect(() => {
    const raiz = document.getElementById("texto-da-aula");
    if (!raiz) return;
    const aoClicar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || !raiz.contains(link)) return;
      let url: URL;
      try {
        url = new URL(link.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      const comIdioma = /^\/[a-z]{2}\//.test(url.pathname) ? url.pathname : `/${lang}${url.pathname}`;
      const destino = enderecoAntigoDaEscola(comIdioma.replace(/\/+$/, ""));
      const partes = comIdioma.split("/").filter(Boolean);
      // Só a aula (não a estante nem a trilha inteira): /<idioma>/trilhas/<trilha>/<aula>.
      if (!destino || partes[1] !== "trilhas" || partes.length !== 4) return;
      e.preventDefault();
      setTrecho(null);
      caixa.current?.showModal();
      fetch(`/${partes[0]}/trilhas/${partes[2]}/${partes[3]}/texto`)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((texto) => setTrecho({ ...trechoDoTexto(texto), destino }))
        .catch(() => setTrecho({ falha: true, destino }));
    };
    raiz.addEventListener("click", aoClicar);
    return () => raiz.removeEventListener("click", aoClicar);
  }, [lang]);

  return (
    <dialog ref={caixa} className="trecho-da-escola" aria-labelledby="trecho-da-escola-titulo" onClose={() => setTrecho(null)}>
      <p id="trecho-da-escola-titulo" className="trecho-da-escola-olho">
        {s.trechoTitulo}
      </p>
      {!trecho && <p aria-busy="true">…</p>}
      {trecho && "falha" in trecho && <p role="alert">{s.trechoFalha}</p>}
      {trecho && !("falha" in trecho) && (
        <div className="trecho-da-escola-texto">
          <h2>{trecho.titulo}</h2>
          {trecho.paragrafos.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      <p className="trecho-da-escola-nota">{s.trechoTexto}</p>
      <div className="trecho-da-escola-botoes">
        {trecho && (
          <a href={trecho.destino} className="trecho-da-escola-ler">
            {s.trechoLer} →
          </a>
        )}
        <button type="button" onClick={() => caixa.current?.close()}>
          {s.trechoFechar}
        </button>
      </div>
    </dialog>
  );
}
