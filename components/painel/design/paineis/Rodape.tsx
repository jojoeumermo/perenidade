// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Icone } from "../Icone";
import { variaveisDaPagina } from "../projeto";
import { ItemDeMenu, Menu, Miniatura, useEditor } from "../ui";

/** O pé do palco: as páginas (o carrossel), as guias do Instagram, o menu Ver e o encaixe na tela. */
export function RodapeDoPalco() {
  const ed = useEditor();
  const [ver, setVer] = useState(false);
  const [menuDaPagina, setMenuDaPagina] = useState<number | null>(null);
  const a = ed.ajudas;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-3">
      <div className="pointer-events-auto flex max-w-[60%] items-end gap-1.5 overflow-x-auto rounded-xl bg-[#1f1a14]/70 p-1.5 backdrop-blur [scrollbar-width:thin]" role="list" aria-label="Páginas">
        {ed.projeto.paginas.map((d, i) => (
          <div key={d.id ?? i} role="listitem" className="relative shrink-0">
            <button
              type="button"
              className={`block cursor-pointer rounded-md p-0.5 ${i === ed.pagina ? "ring-2 ring-[#d4a64a]" : "opacity-75 hover:opacity-100"}`}
              onClick={() => ed.irParaPagina(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuDaPagina(i);
              }}
              aria-label={`Página ${i + 1}${d.variante ? `, versão ${d.variante}` : ""}`}
              aria-current={i === ed.pagina ? "page" : undefined}
              title={`Página ${i + 1}${d.nome ? `: ${d.nome}` : ""} (botão direito: mais opções)`}
            >
              <Miniatura doc={d} largura={Math.round((44 * d.w) / d.h)} vars={variaveisDaPagina(ed.projeto, i)} voltar={ed.vars} className="rounded-sm" />
            </button>
            <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-[#1f1a14]/85 px-1 font-mono text-[0.6rem] text-[#f4ecd8]">
              {String(i + 1).padStart(2, "0")}
              {d.variante ?? ""}
            </span>
            {menuDaPagina === i && (
              <div className="absolute bottom-full left-0 mb-2 w-56">
                <Menu aberto fechar={() => setMenuDaPagina(null)} className="!top-auto !bottom-0 !mt-0">
                  <ItemDeMenu icone="paginas" rotulo="Duplicar página" onClick={() => { ed.irParaPagina(i); window.setTimeout(ed.acoes.duplicarPagina, 0); setMenuDaPagina(null); }} />
                  <ItemDeMenu icone="ab" rotulo="Criar versão B" onClick={() => { ed.irParaPagina(i); window.setTimeout(ed.acoes.versaoB, 0); setMenuDaPagina(null); }} />
                  <ItemDeMenu icone="seta-esq" rotulo="Mover para a esquerda" disabled={i === 0} onClick={() => { ed.irParaPagina(i); window.setTimeout(ed.acoes.paginaParaTras, 0); setMenuDaPagina(null); }} />
                  <ItemDeMenu icone="seta-dir" rotulo="Mover para a direita" disabled={i === ed.projeto.paginas.length - 1} onClick={() => { ed.irParaPagina(i); window.setTimeout(ed.acoes.paginaParaFrente, 0); setMenuDaPagina(null); }} />
                  <ItemDeMenu icone="lixeira" rotulo="Apagar página" perigo disabled={ed.projeto.paginas.length <= 1} onClick={() => { ed.irParaPagina(i); window.setTimeout(ed.acoes.apagarPagina, 0); setMenuDaPagina(null); }} />
                </Menu>
              </div>
            )}
          </div>
        ))}
        <button type="button" className="flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-white/30 text-[#e8dcc0] hover:bg-white/10" onClick={ed.acoes.novaPagina} aria-label="Nova página" title="Nova página">
          <Icone nome="mais" className="h-4 w-4" />
        </button>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <button type="button" className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-sm whitespace-nowrap ${a.instagram ? "border-[#d4a64a] bg-[#d4a64a]/15 text-[#f0cf8e]" : "border-white/15 bg-[#1f1a14]/70 text-[#e8dcc0] hover:bg-[#1f1a14]"}`} aria-pressed={a.instagram} onClick={ed.acoes.instagram} title="Guias do Instagram (Shift+I)">
          <Icone nome="guias" className="h-4 w-4" />
          Guias do Instagram
        </button>
        <div className="relative">
          <button type="button" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-[#1f1a14]/70 text-[#e8dcc0] hover:bg-[#1f1a14]" aria-label="Ver" title="Ver: grade, margens, réguas" aria-expanded={ver} onClick={() => setVer(!ver)}>
            <Icone nome="grade" className="h-4 w-4" />
          </button>
          {ver && (
            <div className="absolute right-0 bottom-full mb-2 w-64">
              <Menu aberto fechar={() => setVer(false)} alinhar="direita" className="!top-auto !bottom-0 !mt-0">
                <ItemDeMenu icone={a.grade ? "check" : undefined} rotulo="Grade" atalho="Shift+G" onClick={ed.acoes.grade} />
                <ItemDeMenu icone={a.margens ? "check" : undefined} rotulo="Margens da marca (80 pt)" atalho="Shift+M" onClick={ed.acoes.margens} />
                <ItemDeMenu icone={a.reguas ? "check" : undefined} rotulo="Réguas" atalho="Shift+R" onClick={ed.acoes.reguas} />
                <ItemDeMenu icone={a.oito ? "check" : undefined} rotulo="Encaixar de 8 em 8" onClick={ed.acoes.oito} />
                <div className="my-1 border-t border-e-fio" />
                <ItemDeMenu icone="foco" rotulo="Modo foco (só a arte)" atalho="Tab" onClick={() => { setVer(false); ed.acoes.foco(); }} />
              </Menu>
            </div>
          )}
        </div>
        <button type="button" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-[#1f1a14]/70 text-[#e8dcc0] hover:bg-[#1f1a14]" aria-label="Encaixar na tela" title="Encaixar na tela (Ctrl+0)" onClick={ed.acoes.encaixar}>
          <Icone nome="ajustar" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
