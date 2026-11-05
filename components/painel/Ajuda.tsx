// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MANUAL_DA_COORDENACAO } from "./manual-texto";

/** Tira o acento e põe em minúsculas, para a busca achar "seguranca" em "segurança". */
const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Separa o manual em partes: o começo e cada "## ". O texto é o de docs/MANUAL-DA-COORDENACAO.md. */
function partes(texto: string): { titulo: string; corpo: string }[] {
  const saida: { titulo: string; corpo: string }[] = [];
  let atual: { titulo: string; linhas: string[] } | null = null;
  for (const linha of texto.split("\n")) {
    if (linha.startsWith("## ")) {
      if (atual) saida.push({ titulo: atual.titulo, corpo: atual.linhas.join("\n") });
      atual = { titulo: linha.slice(3).trim(), linhas: [linha] };
    } else if (atual) {
      atual.linhas.push(linha);
    }
  }
  if (atual) saida.push({ titulo: atual.titulo, corpo: atual.linhas.join("\n") });
  return saida;
}

const introducao = MANUAL_DA_COORDENACAO.split("\n## ")[0].replace(/^# .*\n+/, "");

/**
 * Minha conta > Ajuda: o manual curto da coordenação, renderizado do mesmo texto de docs/MANUAL-DA-COORDENACAO.md.
 * Só classes do tema novo (pn-*) e variáveis do painel; sem cor escrita à mão. Cada parte abre e fecha, e a busca
 * filtra as partes que têm a palavra.
 */
export function Ajuda() {
  const todas = useMemo(() => partes(MANUAL_DA_COORDENACAO), []);
  const [busca, setBusca] = useState("");
  const q = semAcento(busca.trim());
  const visiveis = q ? todas.filter((p) => semAcento(p.corpo).includes(q)) : todas;

  return (
    <section aria-labelledby="ajuda-titulo" className="grid gap-4">
      <div>
        <h2 id="ajuda-titulo" className="font-serif text-xl font-semibold">Manual da coordenação</h2>
        <div className="mt-1 max-w-3xl text-sm text-ink-soft">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{introducao}</ReactMarkdown>
        </div>
        <label className="mt-3 block max-w-md text-sm">
          Procurar no manual
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="pn-campo mt-1 w-full" placeholder="aprovar, interdição, Vale o Escrito…" />
        </label>
        <p className="mt-1 text-xs text-ink-soft" role="status">{q ? `${visiveis.length} de ${todas.length} partes têm "${busca.trim()}".` : `${todas.length} partes.`}</p>
      </div>
      {visiveis.map((p, i) => (
        <details key={p.titulo} open={Boolean(q) || i === 0} className="pn-ajuda border border-rule bg-parchment-deep p-4">
          <summary className="cursor-pointer font-serif text-lg font-semibold">{p.titulo}</summary>
          <div className="pn-ajuda-texto mt-3 max-w-3xl text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: () => null,
                h3: ({ children }) => <h3 className="mt-5 font-semibold text-base">{children}</h3>,
                p: ({ children }) => <p className="mt-2">{children}</p>,
                ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
                code: ({ children }) => <code className="font-mono text-[0.85em]">{children}</code>,
                table: ({ children }) => <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm">{children}</table></div>,
                th: ({ children }) => <th className="border-b border-rule px-2 py-1 font-semibold">{children}</th>,
                td: ({ children }) => <td className="border-b border-rule px-2 py-1 align-top">{children}</td>,
              }}
            >
              {p.corpo}
            </ReactMarkdown>
          </div>
        </details>
      ))}
      {visiveis.length === 0 && <p className="text-sm text-ink-soft">Nada com essa palavra. Tente uma parte dela, ou abra a busca do painel (Ctrl K).</p>}
      <p className="text-xs text-ink-soft">O mesmo texto está em <code>docs/MANUAL-DA-COORDENACAO.md</code>, no repositório.</p>
    </section>
  );
}
