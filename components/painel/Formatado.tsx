// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { formatar } from "@/lib/mensagem";
import { EmojiDoInstituto } from "./EmojiDoInstituto";

/**
 * O texto de uma mensagem com a formatação simples (*negrito*, _itálico_, ~tachado~, `mono`, listas), links e menções.
 * Tudo vira elementos do React: nada do texto é interpretado como HTML.
 */
export function Formatado({ texto, membros = [], eu, className = "" }: { texto: string; membros?: { id: string; nome: string }[]; eu?: string; className?: string }) {
  const linhas = formatar(texto, membros);
  const saida: React.ReactNode[] = [];
  let lista: { numerada: boolean; itens: React.ReactNode[] } | null = null;
  const fecharLista = () => {
    if (!lista) return;
    const Tag = lista.numerada ? "ol" : "ul";
    saida.push(
      <Tag key={`lista-${saida.length}`} className={`my-0.5 pl-5 ${lista.numerada ? "list-decimal" : "list-disc"}`}>
        {lista.itens}
      </Tag>,
    );
    lista = null;
  };
  // Os blocos de código e de citação juntam as linhas seguidas do mesmo tipo.
  let codigo: string[] | null = null;
  let citacao: React.ReactNode[] | null = null;
  const fecharCodigo = () => {
    if (!codigo) return;
    saida.push(<pre key={`codigo-${saida.length}`} className="my-1 overflow-x-auto rounded-md bg-black/25 p-2 font-mono text-[0.85em] leading-snug">{codigo.join("\n")}</pre>);
    codigo = null;
  };
  const fecharCitacao = () => {
    if (!citacao) return;
    saida.push(<blockquote key={`citacao-${saida.length}`} className="my-0.5 border-l-4 border-current/30 pl-2.5 opacity-90">{citacao}</blockquote>);
    citacao = null;
  };
  linhas.forEach((linha, i) => {
    if (linha.codigo !== undefined) {
      fecharLista();
      fecharCitacao();
      (codigo ??= []).push(linha.codigo);
      return;
    }
    fecharCodigo();
    const pedacos = linha.pedacos.map((pedaco, j) => {
      switch (pedaco.tipo) {
        case "negrito":
          return <strong key={j}>{pedaco.valor}</strong>;
        case "italico":
          return <em key={j}>{pedaco.valor}</em>;
        case "tachado":
          return <s key={j}>{pedaco.valor}</s>;
        case "mono":
          return <code key={j} className="rounded bg-ink/10 px-1 font-mono text-[0.9em]">{pedaco.valor}</code>;
        case "link":
          return (
            <a key={j} href={pedaco.href} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
              {pedaco.valor}
            </a>
          );
        case "mencao":
          return (
            <span key={j} className={`rounded px-0.5 font-semibold ${pedaco.id === eu ? "bg-gold/40" : "bg-ink/10"}`}>
              {pedaco.valor}
            </span>
          );
        case "spoiler":
          return <Spoiler key={j} texto={pedaco.valor} />;
        case "emoji":
          return <EmojiDoInstituto key={j} nome={pedaco.nome} className="mx-px inline-block h-[1.25em] w-[1.25em] align-[-0.25em]" />;
        case "quebra":
          return <br key={j} />;
        default:
          return <span key={j}>{pedaco.valor}</span>;
      }
    });
    if (linha.citacao) {
      fecharLista();
      (citacao ??= []).push(<span key={i} className="block">{pedacos}</span>);
      return;
    }
    fecharCitacao();
    if (linha.item) {
      if (!lista || lista.numerada !== (linha.item.numero !== undefined)) {
        fecharLista();
        lista = { numerada: linha.item.numero !== undefined, itens: [] };
      }
      lista.itens.push(<li key={i}>{pedacos}</li>);
      return;
    }
    fecharLista();
    saida.push(
      <span key={i}>
        {pedacos}
        {i < linhas.length - 1 && <br />}
      </span>,
    );
  });
  fecharLista();
  fecharCodigo();
  fecharCitacao();
  return <span className={className} data-original>{saida}</span>;
}

/** ||texto||: escondido até clicar. */
function Spoiler({ texto }: { texto: string }) {
  const [visto, setVisto] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setVisto(true)}
      aria-label={visto ? undefined : "Mostrar o texto escondido"}
      className={`rounded px-0.5 ${visto ? "cursor-text bg-black/15" : "cursor-pointer bg-current/80 text-transparent select-none"}`}
    >
      {texto}
    </button>
  );
}
