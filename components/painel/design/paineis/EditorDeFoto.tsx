// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O editor de foto do estúdio: recorte livre (com proporções prontas) e remoção do fundo à mão, sem inteligência
// artificial: a varinha tira as cores parecidas com a do ponto clicado, e o pincel apaga ou devolve à mão.

import { useEffect, useRef, useState } from "react";
import { Icone } from "../Icone";
import { type CamadaImagem, carregarImagem } from "../motor";
import { ATIVO, BOTAO, BOTAO_PRIMARIO, Chave, Dialogo, Faixa, useEditor } from "../ui";

type Ferramenta = "varinha" | "apagar" | "devolver";
type Retangulo = { x: number; y: number; w: number; h: number };

const PROPORCOES: [string, number | null][] = [
  ["Livre", null],
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["3:4", 3 / 4],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
];

export function EditorDeFoto({ id, fechar, redesenhar }: { id: string; fechar: () => void; redesenhar: () => void }) {
  const ed = useEditor();
  const c = ed.doc.camadas.find((k) => k.id === id) as CamadaImagem | undefined;
  const [aba, setAba] = useState<"recortar" | "fundo">("recortar");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (c) void carregarImagem(c.src).then(setImg).catch(() => setImg(null));
  }, [c]);
  if (!c) return null;
  return (
    <Dialogo titulo="Foto: recortar e tirar o fundo" fechar={fechar} largura="max-w-5xl">
      <div role="tablist" className="mb-4 flex gap-1 border-b border-e-fio">
        {(
          [
            ["recortar", "Recortar"],
            ["fundo", "Tirar o fundo"],
          ] as const
        ).map(([idAba, nome]) => (
          <button key={idAba} type="button" role="tab" aria-selected={aba === idAba} onClick={() => setAba(idAba)} className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm ${aba === idAba ? "border-e-bordo font-semibold text-e-bordo" : "border-transparent text-e-suave hover:text-e-tinta"}`}>
            {nome}
          </button>
        ))}
      </div>
      {!img ? (
        <p className="text-sm text-e-suave">Carregando a foto…</p>
      ) : aba === "recortar" ? (
        <Recortar c={c} img={img} fechar={fechar} />
      ) : (
        <TirarFundo c={c} img={img} fechar={fechar} redesenhar={redesenhar} />
      )}
    </Dialogo>
  );
}

function Recortar({ c, img, fechar }: { c: CamadaImagem; img: HTMLImageElement; fechar: () => void }) {
  const ed = useEditor();
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const largura = Math.min(640, (420 * iw) / ih);
  const k = largura / iw;
  const [r, setR] = useState<Retangulo>(() => {
    const rc = c.recorte ?? { x: 0, y: 0, w: 1, h: 1 };
    return { x: rc.x * iw, y: rc.y * ih, w: rc.w * iw, h: rc.h * ih };
  });
  const [proporcao, setProporcao] = useState<number | null>(null);
  const [ajustarCaixa, setAjustarCaixa] = useState(true);
  const arrasto = useRef<{ modo: string; x0: number; y0: number; r: Retangulo } | null>(null);
  const limitar = (n: Retangulo): Retangulo => {
    const w = Math.min(iw, Math.max(20, n.w));
    const h = Math.min(ih, Math.max(20, n.h));
    return { x: Math.min(iw - w, Math.max(0, n.x)), y: Math.min(ih - h, Math.max(0, n.y)), w, h };
  };
  const comProporcao = (p: number | null) => {
    setProporcao(p);
    if (!p) return;
    let w = r.w;
    let h = w / p;
    if (h > ih) {
      h = ih;
      w = h * p;
    }
    setR(limitar({ x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h }));
  };
  const mover = (e: React.PointerEvent) => {
    const a = arrasto.current;
    if (!a) return;
    const dx = (e.clientX - a.x0) / k;
    const dy = (e.clientY - a.y0) / k;
    const n = { ...a.r };
    if (a.modo === "mover") {
      n.x += dx;
      n.y += dy;
    } else {
      if (a.modo.includes("e")) n.w = a.r.w + dx;
      if (a.modo.includes("s")) n.h = a.r.h + dy;
      if (a.modo.includes("w")) {
        n.x = a.r.x + dx;
        n.w = a.r.w - dx;
      }
      if (a.modo.includes("n")) {
        n.y = a.r.y + dy;
        n.h = a.r.h - dy;
      }
      if (proporcao) {
        if (a.modo.includes("e") || a.modo.includes("w")) n.h = n.w / proporcao;
        else n.w = n.h * proporcao;
      }
    }
    setR(limitar(n));
  };
  const aplicar = () => {
    const recorte = { x: r.x / iw, y: r.y / ih, w: r.w / iw, h: r.h / ih };
    const inteira = recorte.x < 0.001 && recorte.y < 0.001 && recorte.w > 0.999 && recorte.h > 0.999;
    const deitado = c.girar === 90 || c.girar === 270;
    const razao = deitado ? r.h / r.w : r.w / r.h;
    ed.mudarCamada(c.id, { recorte: inteira ? null : recorte, enquadre: null, ...(ajustarCaixa ? { h: Math.round(c.w / razao) } : {}) });
    fechar();
  };
  const alca = (modo: string, estilo: React.CSSProperties) => (
    <span
      key={modo}
      className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-[#6e1f1a] bg-white"
      style={{ ...estilo, cursor: `${modo}-resize` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        arrasto.current = { modo, x0: e.clientX, y0: e.clientY, r };
      }}
      onPointerMove={mover}
      onPointerUp={() => (arrasto.current = null)}
    />
  );
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
      <div className="flex justify-center">
        <div className="relative select-none" style={{ width: largura, height: ih * k }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.src} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          <div className="absolute inset-0 bg-black/50" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${r.x * k}px ${r.y * k}px, ${r.x * k}px ${(r.y + r.h) * k}px, ${(r.x + r.w) * k}px ${(r.y + r.h) * k}px, ${(r.x + r.w) * k}px ${r.y * k}px, ${r.x * k}px ${r.y * k}px)` }} aria-hidden />
          <div
            className="absolute cursor-move border-2 border-white outline outline-1 outline-[#6e1f1a]"
            style={{ left: r.x * k, top: r.y * k, width: r.w * k, height: r.h * k, backgroundImage: "linear-gradient(to right, rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: `${(r.w * k) / 3}px ${(r.h * k) / 3}px` }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              arrasto.current = { modo: "mover", x0: e.clientX, y0: e.clientY, r };
            }}
            onPointerMove={mover}
            onPointerUp={() => (arrasto.current = null)}
            role="img"
            aria-label="Área do recorte: arraste para mover, puxe os cantos para mudar"
          >
            {alca("nw", { left: 0, top: 0 })}
            {alca("ne", { left: "100%", top: 0 })}
            {alca("sw", { left: 0, top: "100%" })}
            {alca("se", { left: "100%", top: "100%" })}
            {!proporcao && alca("n", { left: "50%", top: 0 })}
            {!proporcao && alca("s", { left: "50%", top: "100%" })}
            {!proporcao && alca("w", { left: 0, top: "50%" })}
            {!proporcao && alca("e", { left: "100%", top: "50%" })}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs text-e-suave">Proporção</p>
        <div className="grid grid-cols-3 gap-1.5">
          {PROPORCOES.map(([nome, p]) => (
            <button key={nome} type="button" className={`${BOTAO} h-8 text-xs ${proporcao === p ? ATIVO : ""}`} onClick={() => comProporcao(p)}>
              {nome}
            </button>
          ))}
          <button type="button" className={`${BOTAO} col-span-3 h-8 text-xs`} onClick={() => comProporcao(c.w / c.h)}>
            Igual à caixa na arte
          </button>
        </div>
        <p className="font-mono text-xs text-e-suave">
          {Math.round(r.w)} × {Math.round(r.h)} px
        </p>
        <Chave rotulo="Ajustar a caixa na arte ao recorte" ligado={ajustarCaixa} mudar={setAjustarCaixa} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BOTAO} onClick={() => setR({ x: 0, y: 0, w: iw, h: ih })}>Foto inteira</button>
          <button type="button" className={BOTAO_PRIMARIO} onClick={aplicar}>Recortar</button>
        </div>
      </div>
    </div>
  );
}

function TirarFundo({ c, img, fechar, redesenhar }: { c: CamadaImagem; img: HTMLImageElement; fechar: () => void; redesenhar: () => void }) {
  const ed = useEditor();
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const largura = Math.min(640, (440 * iw) / ih);
  const k = largura / iw;
  const tela = useRef<HTMLCanvasElement>(null);
  const mascara = useRef<HTMLCanvasElement | null>(null);
  const pixels = useRef<Uint8ClampedArray | null>(null);
  const desfazer = useRef<ImageData[]>([]);
  const pintando = useRef(false);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("varinha");
  const [tolerancia, setTolerancia] = useState(40);
  const [pincel, setPincel] = useState(30);
  const [continua, setContinua] = useState(true);
  const [versao, setVersao] = useState(0);
  const [pronta, setPronta] = useState(false);
  const [passosDesfeitos, setPassosDesfeitos] = useState(0);

  // A máscara começa toda opaca (ou a que já existia) no tamanho da foto.
  useEffect(() => {
    const m = document.createElement("canvas");
    m.width = iw;
    m.height = ih;
    const g = m.getContext("2d", { willReadFrequently: true })!;
    const pronto = () => {
      mascara.current = m;
      const base = document.createElement("canvas");
      base.width = iw;
      base.height = ih;
      const b = base.getContext("2d", { willReadFrequently: true })!;
      b.drawImage(img, 0, 0);
      pixels.current = b.getImageData(0, 0, iw, ih).data;
      setPronta(true);
      setVersao((v) => v + 1);
    };
    if (c.fundoRemovido)
      void carregarImagem(c.fundoRemovido).then((mi) => {
        g.drawImage(mi, 0, 0, iw, ih);
        pronto();
      });
    else {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, iw, ih);
      pronto();
    }
  }, [c.fundoRemovido, img, iw, ih]);

  // A prévia: xadrez (o transparente) e a foto com a máscara.
  useEffect(() => {
    const t = tela.current;
    const m = mascara.current;
    if (!t || !m) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    t.width = Math.round(largura * dpr);
    t.height = Math.round(ih * k * dpr);
    const g = t.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = 0; y < ih * k; y += 12) for (let x = 0; x < largura; x += 12) {
      g.fillStyle = (x / 12 + y / 12) % 2 ? "#ddd" : "#fff";
      g.fillRect(x, y, 12, 12);
    }
    const composta = document.createElement("canvas");
    composta.width = iw;
    composta.height = ih;
    const cg = composta.getContext("2d")!;
    cg.drawImage(img, 0, 0);
    cg.globalCompositeOperation = "destination-in";
    cg.drawImage(m, 0, 0);
    g.drawImage(composta, 0, 0, largura, ih * k);
  }, [versao, img, iw, ih, k, largura]);

  const guardarPasso = () => {
    const m = mascara.current?.getContext("2d");
    if (!m) return;
    desfazer.current = [...desfazer.current.slice(-9), m.getImageData(0, 0, iw, ih)];
    setPassosDesfeitos(desfazer.current.length);
  };
  const pontoNaFoto = (e: React.PointerEvent) => {
    const r = tela.current!.getBoundingClientRect();
    return { x: Math.round((e.clientX - r.left) / k), y: Math.round((e.clientY - r.top) / k) };
  };
  /** A varinha: tira (deixa transparente) as cores parecidas com a do ponto, coladas a ele ou na foto toda. */
  const varinha = (px: number, py: number) => {
    const fonte = pixels.current;
    const m = mascara.current?.getContext("2d", { willReadFrequently: true });
    if (!fonte || !m || px < 0 || py < 0 || px >= iw || py >= ih) return;
    guardarPasso();
    const dados = m.getImageData(0, 0, iw, ih);
    const alfa = dados.data;
    const i0 = (py * iw + px) * 4;
    const [r0, g0, b0] = [fonte[i0], fonte[i0 + 1], fonte[i0 + 2]];
    const limite = (tolerancia * 4.4) ** 2;
    const parecida = (i: number) => (fonte[i] - r0) ** 2 + (fonte[i + 1] - g0) ** 2 + (fonte[i + 2] - b0) ** 2 <= limite;
    if (!continua) {
      for (let i = 0; i < fonte.length; i += 4) if (parecida(i)) alfa[i + 3] = 0;
    } else {
      const visto = new Uint8Array(iw * ih);
      const pilha = new Int32Array(iw * ih);
      let topo = 0;
      pilha[topo++] = py * iw + px;
      visto[py * iw + px] = 1;
      while (topo > 0) {
        const p = pilha[--topo];
        alfa[p * 4 + 3] = 0;
        const x = p % iw;
        const y = (p - x) / iw;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= iw || ny >= ih) continue;
          const q = ny * iw + nx;
          if (visto[q]) continue;
          visto[q] = 1;
          if (parecida(q * 4)) pilha[topo++] = q;
        }
      }
    }
    m.putImageData(dados, 0, 0);
    setVersao((v) => v + 1);
  };
  const pincelar = (px: number, py: number) => {
    const m = mascara.current?.getContext("2d");
    if (!m) return;
    m.save();
    m.globalCompositeOperation = ferramenta === "apagar" ? "destination-out" : "source-over";
    m.fillStyle = "#fff";
    m.beginPath();
    m.arc(px, py, pincel / k / 2, 0, Math.PI * 2);
    m.fill();
    m.restore();
    setVersao((v) => v + 1);
  };
  const salvar = () => {
    const m = mascara.current;
    if (!m) return;
    // A máscara guardada fica pequena: lado maior de 900 basta para o contorno.
    const escala = Math.min(1, 900 / Math.max(iw, ih));
    const menor = document.createElement("canvas");
    menor.width = Math.round(iw * escala);
    menor.height = Math.round(ih * escala);
    menor.getContext("2d")!.drawImage(m, 0, 0, menor.width, menor.height);
    ed.mudarCamada(c.id, { fundoRemovido: menor.toDataURL("image/png") });
    window.setTimeout(redesenhar, 50);
    fechar();
  };
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
      <div className="flex justify-center">
        <canvas
          ref={tela}
          style={{ width: largura, height: ih * k, cursor: ferramenta === "varinha" ? "crosshair" : "cell" }}
          className="touch-none rounded"
          aria-label="A foto: clique com a varinha ou pinte com o pincel"
          onPointerDown={(e) => {
            if (!pronta) return;
            const p = pontoNaFoto(e);
            if (ferramenta === "varinha") varinha(p.x, p.y);
            else {
              guardarPasso();
              pintando.current = true;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              pincelar(p.x, p.y);
            }
          }}
          onPointerMove={(e) => {
            if (!pintando.current) return;
            const p = pontoNaFoto(e);
            pincelar(p.x, p.y);
          }}
          onPointerUp={() => (pintando.current = false)}
        />
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Ferramenta">
          {(
            [
              ["varinha", "varinha", "Varinha"],
              ["apagar", "borracha", "Apagar"],
              ["devolver", "pincel", "Devolver"],
            ] as const
          ).map(([id, icone, nome]) => (
            <button key={id} type="button" className={`${BOTAO} h-auto flex-col py-2 text-xs ${ferramenta === id ? ATIVO : ""}`} aria-pressed={ferramenta === id} onClick={() => setFerramenta(id)}>
              <Icone nome={icone} className="h-5 w-5" />
              {nome}
            </button>
          ))}
        </div>
        {ferramenta === "varinha" ? (
          <>
            <Faixa rotulo="Tolerância (cores parecidas)" valor={tolerancia} min={5} max={100} mudar={setTolerancia} />
            <Chave rotulo="Só a área encostada no clique" ligado={continua} mudar={setContinua} />
            <p className="text-xs text-e-suave">Clique no fundo: tudo da mesma cor some. Fundo de várias cores: clique em cada parte.</p>
          </>
        ) : (
          <>
            <Faixa rotulo="Tamanho do pincel" valor={pincel} min={4} max={120} sufixo=" px" mudar={setPincel} />
            <p className="text-xs text-e-suave">{ferramenta === "apagar" ? "Pinte o que deve sumir." : "Pinte o que a varinha tirou por engano."}</p>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BOTAO} disabled={!passosDesfeitos} onClick={() => {
            const ultimo = desfazer.current.pop();
            setPassosDesfeitos(desfazer.current.length);
            if (ultimo) mascara.current?.getContext("2d")?.putImageData(ultimo, 0, 0);
            setVersao((v) => v + 1);
          }}>
            <Icone nome="desfazer" className="h-4 w-4" /> Desfazer
          </button>
          <button type="button" className={BOTAO} onClick={() => {
            guardarPasso();
            const m = mascara.current?.getContext("2d");
            if (m) {
              m.globalCompositeOperation = "source-over";
              m.fillStyle = "#fff";
              m.fillRect(0, 0, iw, ih);
            }
            setVersao((v) => v + 1);
          }}>
            Recomeçar
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-e-fio pt-3">
          {c.fundoRemovido && (
            <button type="button" className={BOTAO} onClick={() => { ed.mudarCamada(c.id, { fundoRemovido: undefined }); fechar(); }}>
              Devolver o fundo
            </button>
          )}
          <button type="button" className={BOTAO_PRIMARIO} disabled={!pronta} onClick={salvar}>
            Usar na arte
          </button>
        </div>
      </div>
    </div>
  );
}
