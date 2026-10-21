// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/backend";
import { Icone } from "../Icone";
import { carregarTudo, desenhar, type Documento, usarVariaveis } from "../motor";
import { variaveisDaPagina } from "../projeto";
import { semMarcas } from "../texto-rico";
import { BOTAO, Dialogo, Miniatura, useEditor } from "../ui";

type Aba = "feed" | "grade" | "story" | "camiseta" | "cartaz" | "ab" | "video";

/** Um celular de mentira (genérico, sem marca de nenhuma rede), com a tela do tamanho pedido. */
function Celular({ children, largura = 270 }: { children: React.ReactNode; largura?: number }) {
  return (
    <div className="rounded-[2.2rem] border-[10px] border-[#17130e] bg-[#17130e] shadow-2xl" style={{ width: largura + 20 }}>
      <div className="relative overflow-hidden rounded-[1.6rem] bg-white" style={{ width: largura, height: largura * (19.5 / 9) }}>
        <span className="absolute top-2 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#17130e]" aria-hidden />
        {children}
      </div>
    </div>
  );
}

function Video({ doc }: { doc: Documento }) {
  const ed = useEditor();
  const ref = useRef<HTMLCanvasElement>(null);
  const [tocando, setTocando] = useState(true);
  useEffect(() => {
    let quadro = 0;
    let inicio = performance.now();
    const largura = 300;
    void carregarTudo(doc).then(() => {
      const pintar = () => {
        const c = ref.current;
        if (!c) return;
        const t = ((performance.now() - inicio) / 1000) % ed.projeto.duracao;
        usarVariaveis(ed.vars);
        desenhar(c, doc, (largura / doc.w) * Math.min(2, window.devicePixelRatio || 1), { exportar: true, t: tocando ? t : undefined });
        if (tocando) quadro = requestAnimationFrame(pintar);
      };
      inicio = performance.now();
      pintar();
    });
    return () => cancelAnimationFrame(quadro);
  }, [doc, tocando, ed.projeto.duracao, ed.vars]);
  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={ref} style={{ width: 300, height: (300 * doc.h) / doc.w }} className="rounded shadow-xl" aria-label="Prévia da animação" />
      <button type="button" className={BOTAO} onClick={() => setTocando(!tocando)}>
        <Icone nome={tocando ? "pausa" : "play"} className="h-4 w-4" /> {tocando ? "Pausar" : "Tocar"}
      </button>
      {!doc.camadas.some((c) => c.anim) && <p className="text-sm text-e-suave">Nenhuma camada animada nesta página: escolha a animação nas propriedades da camada.</p>}
    </div>
  );
}

/** A prévia realista: como a arte fica no feed, na grade do perfil, no story, numa camiseta e num cartaz. */
export function Previa({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const doc = ed.doc;
  const story = doc.w / doc.h < 0.6;
  const [aba, setAba] = useState<Aba>(story ? "story" : "feed");
  const [indice, setIndice] = useState(ed.pagina);
  const [corDaCamisa, setCorDaCamisa] = useState("#f4ecd8");
  const [outros, setOutros] = useState<string[]>([]);
  useEffect(() => {
    rpc<{ miniatura: string; id: string }[]>("designs_listar", {})
      .then((l) => setOutros((l ?? []).filter((t) => t.id !== ed.idSalvo && t.miniatura).slice(0, 8).map((t) => t.miniatura)))
      .catch(() => setOutros([]));
  }, [ed.idSalvo]);
  const pagina = ed.projeto.paginas[indice] ?? doc;
  const vars = variaveisDaPagina(ed.projeto, indice);
  const legenda = ed.projeto.legenda.trim();
  const variantes = ed.projeto.paginas.map((d, i) => ({ d, i })).filter(({ d }) => d.variante);
  const abas: [Aba, string][] = [
    ["feed", "Feed"],
    ["grade", "Grade do perfil"],
    ["story", "Story"],
    ["camiseta", "Camiseta"],
    ["cartaz", "Cartaz na parede"],
    ...(variantes.length > 1 ? ([["ab", "A/B"]] as [Aba, string][]) : []),
    ["video", "Vídeo"],
  ];
  return (
    <Dialogo titulo="Pré-visualizar" fechar={fechar} largura="max-w-5xl">
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-e-fio">
        {abas.map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm ${aba === id ? "border-e-bordo font-semibold text-e-bordo" : "border-transparent text-e-suave hover:text-e-tinta"}`}>
            {nome}
          </button>
        ))}
      </div>
      <div className="flex min-h-[32rem] flex-col items-center justify-center gap-4 rounded-lg bg-[#2a231d] p-6">
        {aba === "feed" && (
          <Celular>
            <div className="h-full overflow-y-auto bg-white pt-9 text-[#111]">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6e1f1a] text-[0.6rem] font-bold text-white">IL</span>
                <span className="text-[0.8rem] font-semibold">{(ed.projeto.variaveis.arroba || (ed.laboratorio ? "@seuperfil" : "@institutoluciaorg")).replace(/^@/, "")}</span>
                <Icone nome="pontos" className="ml-auto h-4 w-4" />
              </div>
              <div className="relative">
                <Miniatura doc={pagina} largura={270} vars={vars} voltar={ed.vars} />
                {ed.projeto.paginas.length > 1 && <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] text-white">{indice + 1}/{ed.projeto.paginas.length}</span>}
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <Icone nome="coracao" className="h-5 w-5" />
                <Icone nome="comentario" className="h-5 w-5" />
                <Icone nome="publicar" className="h-5 w-5" />
                {ed.projeto.paginas.length > 1 && (
                  <span className="mx-auto flex gap-1">
                    {ed.projeto.paginas.map((_, i) => (
                      <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === indice ? "bg-[#0095f6]" : "bg-[#ccc]"}`} />
                    ))}
                  </span>
                )}
              </div>
              <p className="px-3 pb-6 text-[0.72rem] leading-snug whitespace-pre-wrap">
                <strong>{(ed.projeto.variaveis.arroba || (ed.laboratorio ? "@seuperfil" : "@institutoluciaorg")).replace(/^@/, "")}</strong> {legenda ? (legenda.length > 125 ? `${legenda.slice(0, 125)}… mais` : legenda) : <span className="text-[#999]">(a legenda aparece aqui)</span>}
              </p>
            </div>
          </Celular>
        )}
        {aba === "grade" && (
          <div className="w-[300px] rounded-lg bg-white p-1 shadow-2xl">
            <div className="grid grid-cols-3 gap-0.5">
              {[0, ...Array.from({ length: 8 }, (_, i) => i + 1)].map((i) =>
                i === 0 ? (
                  <div key="essa" className="relative aspect-[3/4] overflow-hidden ring-2 ring-[#d4a64a]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <Miniatura doc={ed.projeto.paginas[0]} largura={Math.max(98, (130 * ed.projeto.paginas[0].w) / ed.projeto.paginas[0].h)} vars={variaveisDaPagina(ed.projeto, 0)} voltar={ed.vars} />
                    </div>
                  </div>
                ) : outros[i - 1] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={outros[i - 1]} alt="" className="aspect-[3/4] w-full object-cover" />
                ) : (
                  <span key={i} className="aspect-[3/4] bg-[#eee]" />
                ),
              )}
            </div>
            <p className="px-1 pt-1 text-[0.65rem] text-[#666]">A grade do perfil corta em 3:4: o que ficar nas laterais some aqui.</p>
          </div>
        )}
        {aba === "story" && (
          <Celular>
            <div className="relative h-full bg-black">
              <div className="absolute inset-0 flex items-center justify-center">
                <Miniatura doc={pagina} largura={story ? 270 : 270} vars={vars} voltar={ed.vars} />
              </div>
              <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 to-transparent px-3 pt-9 pb-6">
                <div className="mb-2 h-0.5 rounded bg-white/50">
                  <div className="h-full w-1/3 rounded bg-white" />
                </div>
                <div className="flex items-center gap-2 text-[0.72rem] text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6e1f1a] text-[0.55rem] font-bold">IL</span>
                  <strong>{(ed.projeto.variaveis.arroba || (ed.laboratorio ? "@seuperfil" : "@institutoluciaorg")).replace(/^@/, "")}</strong> 2 h
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-4">
                <span className="flex-1 rounded-full border border-white/70 px-3 py-1.5 text-[0.7rem] text-white/80">Enviar mensagem</span>
                <Icone nome="coracao" className="h-5 w-5 text-white" />
                <Icone nome="publicar" className="h-5 w-5 text-white" />
              </div>
            </div>
          </Celular>
        )}
        {aba === "camiseta" && (
          <>
            <div className="relative" style={{ width: 360, height: 400 }}>
              <svg viewBox="0 0 360 400" className="absolute inset-0 h-full w-full drop-shadow-2xl" aria-hidden>
                <path d="M120 20 L60 45 L10 120 L60 150 L80 125 L80 390 L280 390 L280 125 L300 150 L350 120 L300 45 L240 20 C225 50 200 62 180 62 C160 62 135 50 120 20 Z" fill={corDaCamisa} stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
                <path d="M120 20 C135 50 160 62 180 62 C200 62 225 50 240 20" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="6" />
              </svg>
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 110 }}>
                <Miniatura doc={pagina} largura={Math.min(150, (190 * pagina.w) / pagina.h)} vars={vars} voltar={ed.vars} transparente />
              </div>
            </div>
            <div className="flex gap-2" role="group" aria-label="Cor da camiseta">
              {[
                ["#f4ecd8", "Pergaminho"],
                ["#ffffff", "Branca"],
                ["#17130e", "Preta"],
                ["#6e1f1a", "Bordô"],
                ["#c21f16", "Vermelha"],
              ].map(([cor, nome]) => (
                <button key={cor} type="button" title={nome} aria-label={nome} aria-pressed={corDaCamisa === cor} className={`h-8 w-8 cursor-pointer rounded-full border-2 ${corDaCamisa === cor ? "border-[#d4a64a]" : "border-white/30"}`} style={{ background: cor }} onClick={() => setCorDaCamisa(cor)} />
              ))}
            </div>
            <p className="text-xs text-[#b3a584]">A arte vai sem o fundo da página (como sai da serigrafia ou do transfer).</p>
          </>
        )}
        {aba === "cartaz" && (
          <div className="relative flex h-[30rem] w-full max-w-3xl items-center justify-center overflow-hidden rounded-md" style={{ background: "repeating-linear-gradient(0deg, #b9ad90 0 38px, #ad9f80 38px 40px), #b9ad90" }}>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-[#5a4e3c]" aria-hidden />
            <div className="relative rotate-[-1.5deg] shadow-[6px_10px_24px_rgba(0,0,0,0.45)]">
              <Miniatura doc={pagina} largura={Math.min(300, (360 * pagina.w) / pagina.h)} vars={vars} voltar={ed.vars} />
              <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-2 bg-[rgba(233,220,188,0.85)]" aria-hidden />
            </div>
          </div>
        )}
        {aba === "ab" && (
          <div className="flex flex-wrap items-start justify-center gap-6">
            {variantes.map(({ d, i }) => (
              <figure key={d.id ?? i} className="text-center">
                <Miniatura doc={d} largura={240} vars={variaveisDaPagina(ed.projeto, i)} voltar={ed.vars} className="shadow-xl" />
                <figcaption className="mt-2 text-sm text-[#e8dcc0]">
                  Versão {d.variante} · página {i + 1}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {aba === "video" && <Video doc={pagina} />}
        {ed.projeto.paginas.length > 1 && aba !== "grade" && aba !== "ab" && (
          <div className="flex items-center gap-2 text-sm text-[#e8dcc0]">
            <button type="button" className="cursor-pointer rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={indice === 0} onClick={() => setIndice(indice - 1)} aria-label="Página anterior">
              <Icone nome="seta-esq" className="h-5 w-5" />
            </button>
            Página {indice + 1} de {ed.projeto.paginas.length}
            <button type="button" className="cursor-pointer rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={indice === ed.projeto.paginas.length - 1} onClick={() => setIndice(indice + 1)} aria-label="Próxima página">
              <Icone nome="seta-dir" className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
      {pagina.alt && <p className="mt-3 text-sm text-e-suave">Texto alternativo: {semMarcas(pagina.alt)}</p>}
    </Dialogo>
  );
}
