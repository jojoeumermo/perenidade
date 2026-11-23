// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 87 (atrás de "alumia-p4-pontes"): a janela de Libras na aula ao vivo. Quem assiste escolhe qual vídeo é o da
// intérprete; ele fica fixo num canto, sempre à vista. A escolha é só desta tela (nada vai ao banco, à rede ou ao armazenamento).
// Sem animação (respeita o movimento reduzido por não ter nenhum).
import { useEffect, useRef, useState } from "react";
import { estiloDaJanela, outroTamanho, type LadoDaJanela, type TamanhoDaJanela } from "@/lib/rede/p4/pontes/libras";
import { useTextosDasPontes } from "./usarTextos";

export interface VideoDaAula {
  chave: string;
  fluxo: MediaStream;
  nome: string;
}

const botao = "inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-ink bg-parchment px-3 font-sans text-sm font-semibold text-ink";

function VideoFixo({ fluxo, nome }: { fluxo: MediaStream; nome: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== fluxo) ref.current.srcObject = fluxo;
  }, [fluxo]);
  // Mudo: o som já toca no vídeo da aula; aqui é só a imagem da intérprete.
  return <video ref={ref} autoPlay playsInline muted aria-label={nome} className="aspect-video h-auto w-full bg-[#17130e] object-contain" />;
}

export function JanelaDeLibras({ videos, lang }: { videos: readonly VideoDaAula[]; lang: string }) {
  const t = useTextosDasPontes(lang);
  const [fixado, setFixado] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState<TamanhoDaJanela>("m");
  const [lado, setLado] = useState<LadoDaJanela>("direita");
  if (!t || videos.length === 0) return null;
  const escolhido = videos.find((v) => v.chave === fixado) ?? null;
  return (
    <div className="font-sans" data-p4-libras>
      <fieldset className="mt-2">
        <legend className="text-sm font-semibold">{t.libras.titulo}</legend>
        <p className="text-xs text-ink-soft">{t.libras.ajuda}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {videos.map((v) => (
            <button key={v.chave} type="button" className={botao} aria-pressed={fixado === v.chave} onClick={() => setFixado(fixado === v.chave ? null : v.chave)}>
              {fixado === v.chave ? t.libras.tirar : t.libras.fixar}: {v.nome}
            </button>
          ))}
        </div>
      </fieldset>
      {escolhido && (
        <aside aria-label={t.libras.titulo} style={estiloDaJanela(tamanho, lado)} className="border-2 border-ink bg-parchment shadow-lg" data-p4-janela-libras={tamanho}>
          <VideoFixo fluxo={escolhido.fluxo} nome={escolhido.nome} />
          <div className="flex flex-wrap gap-1 p-1">
            <button type="button" className={botao} onClick={() => setTamanho(outroTamanho(tamanho, false))} disabled={tamanho === "p"} aria-label={t.libras.menor}>−</button>
            <button type="button" className={botao} onClick={() => setTamanho(outroTamanho(tamanho, true))} disabled={tamanho === "g"} aria-label={t.libras.maior}>+</button>
            <button type="button" className={botao} onClick={() => setLado(lado === "direita" ? "esquerda" : "direita")}>{t.libras.lado}</button>
            <button type="button" className={botao} onClick={() => setFixado(null)}>{t.libras.tirar}</button>
          </div>
        </aside>
      )}
    </div>
  );
}
