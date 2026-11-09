// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { Aba, Situacao } from "@/lib/rede/tipos";
import { ENCAIXES } from "../../encaixes";
import { Avatar16 } from "../../ui/Avatar16";
import type { TipoAoEscrever } from "./CascaDaAlumia2";
import { useAlumia2 } from "./contexto";
import { Icone } from "./icones";
import { CartaoDoAtoDuble, FaixaProximoAtoDuble } from "./previa/Dubles";

/**
 * O alto da linha na cara nova (pranchas computador-inicio e celular-inicio): "INÍCIO" e "Ordem de chegada, sem algoritmo" no
 * computador; as abas Seguindo / Minhas comunidades / Tudo (no celular, "Comunidades"); o compositor da linha (só computador:
 * imagem, enquete, Chamar ato e Publicar, cada um abre o Escrever já no tipo certo); e, na prévia, a faixa do próximo ato e o
 * cartão do ato (dublês da F2, que ainda não tem encaixe no alto da linha).
 */
export function TopoDaLinha2({
  lang,
  situacao,
  abas,
  aba,
  aoAba,
  aoEscrever,
}: {
  lang: string;
  situacao: Situacao;
  abas: Aba[];
  aba: Aba;
  aoAba: (a: Aba) => void;
  aoEscrever: (tipo?: TipoAoEscrever) => void;
}) {
  const al2 = useAlumia2();
  if (!al2) return null;
  const { t, previa } = al2;
  const pode = situacao.logado && situacao.membro;
  const temAto = previa || ENCAIXES.tiposDoCompositor.some((x) => x.tipo === "ato");
  const rotuloDaAba = (a: Aba, curto: boolean) =>
    a === "seguindo" ? t.linha.seguindo : a === "comunidades" ? (curto ? t.linha.comunidadesCurto : t.linha.comunidades) : a === "tudo" ? t.linha.tudo : t.linha.geral;

  return (
    <>
      <div className="hidden items-baseline justify-between px-5 pt-6 lg:flex">
        <h2 className="al-cond text-[1.9rem] font-black uppercase leading-none">{t.linha.titulo}</h2>
        <p className="text-xs text-[var(--al-texto-2)]">{t.linha.ordem}</p>
      </div>
      <div role="tablist" aria-label={t.linha.abas} className="al2-abas sticky top-0 z-10 mt-1 flex border-b border-[var(--al-linha)] bg-[var(--al-fundo)] lg:mt-3 lg:gap-2 lg:px-3">
        {abas.map((a) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => aoAba(a)} className="al2-aba flex-1 lg:flex-none">
            <span className="lg:hidden">{rotuloDaAba(a, true)}</span>
            <span className="hidden lg:inline">{rotuloDaAba(a, false)}</span>
          </button>
        ))}
      </div>
      <p className="px-4 pt-2 text-xs text-[var(--al-texto-3)] lg:hidden">{t.linha.ordem}</p>

      {pode && (
        <div className="hidden border-b border-[var(--al-linha)] px-5 pb-3 pt-4 lg:block">
          <div className="flex items-center gap-3">
            <Avatar16 handle={situacao.handle ?? situacao.codinome ?? "?"} tamanho={40} className="shrink-0" />
            <button type="button" onClick={() => aoEscrever()} className="min-h-11 flex-1 cursor-text text-left text-[1.05rem] text-[var(--al-texto-3)] hover:text-[var(--al-texto-2)]">
              {t.compositor.convite}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1 pl-[52px]">
            <button type="button" className="al2-acao" onClick={() => aoEscrever("imagem")} aria-label={t.compositor.imagem} title={t.compositor.imagem}>
              <Icone nome="imagem" className="h-[18px] w-[18px]" />
            </button>
            <button type="button" className="al2-acao" onClick={() => aoEscrever("enquete")} aria-label={t.compositor.enquete} title={t.compositor.enquete}>
              <Icone nome="enquete" className="h-[18px] w-[18px]" />
            </button>
            {temAto && (
              <button type="button" className="al2-acao !text-[var(--al-dourado)]" onClick={() => aoEscrever("ato")}>
                <Icone nome="atos" className="h-[18px] w-[18px]" />
                {t.compositor.chamarAto}
              </button>
            )}
            <button type="button" className="al-botao al-botao-primario al-botao-m ml-auto" onClick={() => aoEscrever()}>
              {t.compositor.publicar}
            </button>
          </div>
        </div>
      )}

      {previa && aba !== "comunidades" && (
        <>
          <FaixaProximoAtoDuble t={t} lang={lang} />
          <CartaoDoAtoDuble t={t} lang={lang} />
        </>
      )}
    </>
  );
}
