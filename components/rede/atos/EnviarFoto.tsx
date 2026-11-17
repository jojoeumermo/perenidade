// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Botao } from "../ui/Botao";
import { acharRostos, aplicarBorrado, ErroDeImagem, prepararImagem, temDetectorDeRostos, type AreaBorrada } from "../publicar/imagem";
import { enviarFotoDoAlbum } from "./albumNoAparelho";
import { fraseDoEvento } from "./usarEventos";
import { rostosDeFora } from "@/lib/rede/atos/eventos";
import { PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { FotoDoAlbum } from "@/lib/rede/tipos-atos";
import "./eventos.css";

type Passo = "escolher" | "marcar" | "ver";

/**
 * Mandar uma foto para o álbum do ato. Tudo acontece no aparelho, nesta ordem:
 *   1. a foto é refeita no canvas (sai sem localização, modelo do aparelho e data; no máximo 1600 px);
 *   2. borrar rostos: com o detector do próprio navegador, "Achar rostos" marca sozinho (e roda logo ao abrir); sem ele, ou para o
 *      que ele não achou, a pessoa arrasta um retângulo sobre cada rosto;
 *   3. a pessoa declara que conferiu (a caixa) e vê a foto como ela vai sair, já borrada;
 *   4. com o detector, a foto borrada é conferida de novo: se ainda achar rosto fora do borrão, a foto não sobe e volta ao passo 2.
 * Só então a foto vai para a rota do servidor, que tira o metadado de novo; a moderação do ato confere antes de ela aparecer.
 * Janela dentro da página (nunca alert/confirm do navegador); Esc fecha; o foco volta a quem abriu.
 */
export function EnviarFoto({ ato, t, modera, aoFechar, aoEnviar }: { ato: string; t: TextosDosAtos; modera: boolean; aoFechar: () => void; aoEnviar: (f: FotoDoAlbum, frase: string) => void }) {
  const te = t.eventos.enviar;
  const [passo, setPasso] = useState<Passo>("escolher");
  const [base, setBase] = useState<Blob | null>(null);
  const [urlBase, setUrlBase] = useState("");
  const [urlPronta, setUrlPronta] = useState("");
  const [pronta, setPronta] = useState<Blob | null>(null);
  const [areas, setAreas] = useState<AreaBorrada[]>([]);
  const [rascunho, setRascunho] = useState<AreaBorrada | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [achados, setAchados] = useState<number | null>(null);
  const [conferi, setConferi] = useState(false);
  const [legenda, setLegenda] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const detector = temDetectorDeRostos();
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const janela = useRef<HTMLDivElement>(null);
  const escolher = useRef<HTMLInputElement>(null);

  useEffect(() => {
    janela.current?.querySelector<HTMLElement>("[data-primeiro]")?.focus();
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ocupado) aoFechar();
    };
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [aoFechar, ocupado]);

  useEffect(() => {
    if (!base) return;
    const u = URL.createObjectURL(base);
    // O endereço local (blob:) vive enquanto a janela está aberta: sincroniza com o recurso do navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlBase(u);
    return () => URL.revokeObjectURL(u);
  }, [base]);
  useEffect(() => {
    if (!pronta) return;
    const u = URL.createObjectURL(pronta);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlPronta(u);
    return () => URL.revokeObjectURL(u);
  }, [pronta]);

  const procurar = async (imagem: Blob) => {
    setProcurando(true);
    const novas = await acharRostos(imagem);
    setProcurando(false);
    setAchados(novas.length);
    if (novas.length) setAreas((a) => [...a, ...novas]);
  };

  const aoEscolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro(null);
    setOcupado(true);
    try {
      const { blob } = await prepararImagem(arquivo);
      setBase(blob);
      setAreas([]);
      setAchados(null);
      setConferi(false);
      setPasso("marcar");
      if (detector) void procurar(blob);
    } catch (e) {
      setErro(e instanceof ErroDeImagem && e.codigo === "grande" ? te.grande : te.invalida);
    } finally {
      setOcupado(false);
    }
  };

  const ponto = (e: React.PointerEvent) => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const retangulo = (a: { x: number; y: number }, b: { x: number; y: number }): AreaBorrada => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  const verComoFica = async () => {
    if (!base) return;
    if (!conferi) return setErro(te.falta);
    setErro(null);
    setOcupado(true);
    try {
      const borrada = await aplicarBorrado(base, areas);
      // A segunda conferência: o detector roda na foto JÁ borrada. Rosto achado fora do borrão = a foto não sobe.
      if (detector && rostosDeFora(await acharRostos(borrada), areas) > 0) {
        setConferi(false);
        setErro(te.rostoDeFora);
        return;
      }
      setPronta(borrada);
      setPasso("ver");
    } catch {
      setErro(te.invalida);
    } finally {
      setOcupado(false);
    }
  };

  const enviar = async () => {
    if (!pronta || !conferi) return;
    setErro(null);
    setOcupado(true);
    try {
      const f = await enviarFotoDoAlbum(ato, pronta, legenda.trim(), conferi);
      aoEnviar(f, f.estado === "aprovada" ? te.publicada : te.enviada);
    } catch (e) {
      setErro(fraseDoEvento(t, e));
      setOcupado(false);
    }
  };

  return (
    <div className="al-ev-fundo" role="presentation">
      <div ref={janela} className="al-ev-janela" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`} className="al-cond al-ev-titulo">
          {te.titulo}
        </h2>
        {PREVIA_DOS_ATOS ? <p className="al-ev-ajuda">{te.previa}</p> : null}

        {passo === "escolher" ? (
          <div className="al-ev-passo">
            <p className="al-ev-ajuda">{te.formatos}</p>
            <input ref={escolher} id={`${id}-arquivo`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void aoEscolher(e.target.files?.[0])} />
            <div className="al-ev-acoes">
              <Botao variante="primario" data-primeiro="" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => escolher.current?.click()}>
                {te.escolher}
              </Botao>
              <Botao variante="fantasma" onClick={aoFechar}>
                {te.cancelar}
              </Botao>
            </div>
          </div>
        ) : null}

        {passo === "marcar" && base ? (
          <div className="al-ev-passo">
            <h3 className="al-q-subtitulo">{te.borrar}</h3>
            <p className="al-ev-ajuda">{detector ? te.instrucao : `${te.semDetector} ${te.instrucao}`}</p>
            <div
              ref={caixa}
              className="al-ev-tela"
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                inicio.current = ponto(e);
                setRascunho(null);
              }}
              onPointerMove={(e) => {
                if (inicio.current) setRascunho(retangulo(inicio.current, ponto(e)));
              }}
              onPointerUp={(e) => {
                if (inicio.current) {
                  const r = retangulo(inicio.current, ponto(e));
                  if (r.w > 0.02 && r.h > 0.02) {
                    setAreas((a) => [...a, r]);
                    setConferi(false);
                  }
                }
                inicio.current = null;
                setRascunho(null);
              }}
            >
              {urlBase ? (
                // A imagem local (blob:), só para marcar as áreas; nada sai do aparelho aqui.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlBase} alt="" draggable={false} />
              ) : null}
              {[...areas, ...(rascunho ? [rascunho] : [])].map((a, i) => (
                <span key={i} className="al-ev-area" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }} />
              ))}
            </div>
            <p className="al-ev-ajuda" role="status">
              {procurando ? te.procurando : achados === null ? "" : achados > 0 ? preencherAto(te.achou, { n: achados }) : te.naoAchou}{" "}
              <span data-al-numero="">{preencherAto(te.marcadas, { n: areas.length })}</span>
            </p>
            <div className="al-ev-acoes">
              {detector ? (
                <Botao variante="contorno" tamanho="p" disabled={procurando} onClick={() => void procurar(base)}>
                  {procurando ? te.procurando : te.achar}
                </Botao>
              ) : null}
              <Botao variante="contorno" tamanho="p" disabled={!areas.length} onClick={() => { setAreas((a) => a.slice(0, -1)); setConferi(false); }}>
                {te.desfazer}
              </Botao>
            </div>
            <label className="al-ev-conferi">
              <input type="checkbox" data-primeiro="" checked={conferi} onChange={(e) => { setConferi(e.target.checked); if (e.target.checked) setErro(null); }} />
              <span>{te.conferi}</span>
            </label>
            <label className="al-ev-campo">
              <span className="al-ev-rotulo">{te.legenda}</span>
              <input className="al-ato-form-campo" value={legenda} maxLength={140} onChange={(e) => setLegenda(e.target.value)} placeholder={te.legendaExemplo} />
            </label>
            <div className="al-ev-acoes al-ev-acoes-fim">
              <Botao variante="fantasma" onClick={aoFechar} disabled={ocupado}>
                {te.cancelar}
              </Botao>
              <Botao variante="dourado" onClick={() => void verComoFica()} disabled={ocupado || procurando} aria-busy={ocupado || undefined}>
                {te.ver}
              </Botao>
            </div>
          </div>
        ) : null}

        {passo === "ver" && pronta ? (
          <div className="al-ev-passo">
            <p className="al-ev-ajuda">{te.comoFica}</p>
            <div className="al-ev-tela al-ev-tela-pronta">
              {urlPronta ? (
                // A foto já borrada, ainda no aparelho.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlPronta} alt={legenda.trim() || t.eventos.album.fotoDe} />
              ) : null}
            </div>
            <div className="al-ev-acoes al-ev-acoes-fim">
              <Botao variante="fantasma" data-primeiro="" onClick={() => { setPasso("marcar"); setPronta(null); }} disabled={ocupado}>
                {te.voltar}
              </Botao>
              <Botao variante="primario" onClick={() => void enviar()} disabled={ocupado} aria-busy={ocupado || undefined}>
                {ocupado ? te.enviando : modera ? te.enviarDireto : te.enviar}
              </Botao>
            </div>
          </div>
        ) : null}

        {erro ? (
          <p role="alert" className="al-ato-erro">
            {erro}
          </p>
        ) : null}
      </div>
    </div>
  );
}
