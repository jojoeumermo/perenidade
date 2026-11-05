// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type CSSProperties, useState } from "react";
import { formatar } from "@/lib/mensagem";
import { EmojiDoInstituto } from "./EmojiDoInstituto";

// Só tokens: no painel, as cores vêm de --pn-*; fora dele (a Rede, no site), a mistura com a cor do texto faz as vezes.
const FUNDO_DE_CODIGO: CSSProperties = { backgroundColor: "var(--pn-superficie-2, color-mix(in srgb, currentColor 12%, transparent))" };
const FUNDO_DE_MENCAO: CSSProperties = { backgroundColor: "var(--pn-ativo, color-mix(in srgb, currentColor 10%, transparent))" };
const FUNDO_DA_MINHA_MENCAO: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--pn-ouro, currentColor) 28%, transparent)" };
const FUNDO_DO_SPOILER_VISTO: CSSProperties = { backgroundColor: "color-mix(in srgb, currentColor 12%, transparent)" };

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
    saida.push(<pre key={`codigo-${saida.length}`} className="my-1 overflow-x-auto rounded-md p-2 font-mono text-[0.85em] leading-snug" style={FUNDO_DE_CODIGO}>{codigo.join("\n")}</pre>);
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
          return <code key={j} className="rounded px-1 font-mono text-[0.9em]" style={FUNDO_DE_CODIGO}>{pedaco.valor}</code>;
        case "link":
          return (
            <a key={j} href={pedaco.href} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
              {pedaco.valor}
            </a>
          );
        case "mencao":
          return (
            <span key={j} className="rounded px-0.5 font-semibold" style={pedaco.id === eu ? FUNDO_DA_MINHA_MENCAO : FUNDO_DE_MENCAO}>
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
      className={`rounded px-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 ${visto ? "cursor-text" : "cursor-pointer bg-current/80 text-transparent select-none"}`}
      style={visto ? FUNDO_DO_SPOILER_VISTO : undefined}
    >
      {texto}
    </button>
  );
}
