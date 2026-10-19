// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { enderecoDo } from "@/lib/estudio";
import { ziparBinarios } from "@/lib/zip";
import galeria from "@/content/galeria.json";
import type { Me } from "@/lib/backend";
import { Aviso, botao, campo, dataHora, elo, rotulo, useAcao, useLista } from "../comum";
import { MODELOS, GRUPOS, type Modelo } from "./modelos";
import { adaptar, type Alca, alcas, alturaDoTexto, type Camada, camadaEm, type CamadaForma, type CamadaImagem, type CamadaMarca, type CamadaTexto, carregarImagem, COR, desenhar, desenharSelecao, type Documento, documentoVazio, exportar, forma, type FormatoId, FORMATOS, imagem, marca, miniatura, nomeDaCamada, nomeDeArquivo, novoId, PALETA, paraPsd, prepararFontes, prepararImagem, texto } from "./motor";

type AbaEsquerda = "modelos" | "texto" | "formas" | "imagens" | "marca" | "fundo" | "trabalhos";

interface Trabalho {
  id: string;
  titulo: string;
  formato: string;
  largura: number;
  altura: number;
  autor: string;
  meu: boolean;
  compartilhado: boolean;
  miniatura: string;
  atualizado_em: string;
  dados: Documento | null;
}

interface Achado {
  titulo: string;
  arquivo: string;
  miniatura: string;
  autor: string;
  licenca: string;
  pagina: string;
}

const CAMPO = `${campo} mt-0 py-1 text-xs`;
const BOTAOZINHO = "cursor-pointer border border-rule bg-parchment px-2 py-1 text-xs hover:border-ink disabled:cursor-not-allowed disabled:opacity-40";
const ATIVO = "border-ink bg-ink text-parchment";

function Cores({ valor, mudar, semCor }: { valor: string; mudar: (cor: string) => void; semCor?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {semCor && (
        <button type="button" title="Sem cor" aria-label="Sem cor" onClick={() => mudar("")} className={`h-6 w-6 cursor-pointer border ${valor === "" ? "border-ink ring-2 ring-ink" : "border-rule"} bg-[linear-gradient(45deg,transparent_45%,#c21f16_45%,#c21f16_55%,transparent_55%)]`} />
      )}
      {PALETA.map(([nome, cor]) => (
        <button key={cor} type="button" title={nome} aria-label={nome} onClick={() => mudar(cor)} className={`h-6 w-6 cursor-pointer border ${valor === cor ? "border-ink ring-2 ring-ink" : "border-rule"}`} style={{ background: cor }} />
      ))}
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(valor) ? valor : "#000000"} onChange={(e) => mudar(e.target.value)} aria-label="Outra cor" title="Outra cor" className="h-6 w-8 cursor-pointer border border-rule bg-parchment p-0" />
    </div>
  );
}

function Faixa({ rotuloTexto, valor, min, max, passo = 1, mudar, sufixo = "" }: { rotuloTexto: string; valor: number; min: number; max: number; passo?: number; mudar: (v: number) => void; sufixo?: string }) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between text-ink-soft">
        {rotuloTexto}
        <span className="font-mono">{Number.isInteger(passo) ? Math.round(valor) : valor.toFixed(2)}{sufixo}</span>
      </span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => mudar(Number(e.target.value))} className="mt-0.5 w-full" />
    </label>
  );
}

/**
 * O estúdio de design: um "Canva" do instituto, dentro do painel. Modelos tirados do Kit de Lançamento, texto, formas,
 * imagens (do aparelho, da galeria de cartazes do site ou da Wikimedia Commons), a marca e o fundo; camadas que se movem,
 * redimensionam e giram com o mouse; desfazer e refazer; exportação em PNG, JPEG e PDF (pela impressão); e os trabalhos
 * guardados na conta, compartilhados com a equipe. Tudo desenhado no navegador, com a identidade visual como padrão.
 */
export function Estudio({ me }: { me: Me }) {
  const [doc, setDocBruto] = useState<Documento>(() => MODELOS[0].montar());
  const [titulo, setTitulo] = useState("Post: propósito");
  const [formato, setFormato] = useState<FormatoId>("post");
  const [idSalvo, setIdSalvo] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaEsquerda>("modelos");
  const [ajuste, setAjuste] = useState(1);
  const [zoomManual, setZoomManual] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [fontesProntas, setFontesProntas] = useState(false);
  const historico = useRef<{ passado: Passo[]; futuro: Passo[] }>({ passado: [], futuro: [] });
  // O histórico visível (os rótulos dos passos) e se há mudança ainda não guardada na conta.
  const [passos, setPassos] = useState<string[]>([]);
  const [mexido, setMexido] = useState(false);
  const [guias, setGuias] = useState<{ v: number[]; h: number[] } | null>(null);
  const [ferramenta, setFerramenta] = useState<"mover" | "texto">("mover");
  const espaco = useRef(false);
  const mao = useRef<{ x0: number; y0: number; sl: number; st: number } | null>(null);
  const sincronizar = useCallback(() => window.setTimeout(() => setPassos(historico.current.passado.map((p) => p.rotulo)), 0), []);
  const tela = useRef<HTMLCanvasElement>(null);
  const moldura = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const arrasto = useRef<{ modo: "mover" | "redimensionar" | "girar"; alca?: Alca; x0: number; y0: number; inicio: Camada; mexeu: boolean } | null>(null);
  const trabalhos = useLista<Trabalho[]>("designs_listar", {}, { quieta: true });
  const acao = useAcao(trabalhos.recarregar);
  const escala = zoomManual ?? ajuste;
  // Vindo do calendário da divulgação ("Criar arte no Estúdio de design"): o título da peça entra no maior texto do modelo.
  useEffect(() => {
    const id = window.setTimeout(() => {
      let pedido: { titulo?: string; legenda?: string } | null = null;
      try {
        pedido = JSON.parse(window.sessionStorage.getItem("lucia:estudio-pedido") ?? "null");
        window.sessionStorage.removeItem("lucia:estudio-pedido");
      } catch {
        pedido = null;
      }
      if (!pedido?.titulo) return;
      const tituloDoPedido = pedido.titulo.slice(0, 120);
      setTitulo(`Post: ${tituloDoPedido}`.slice(0, 80));
      setDocBruto((d) => {
        const textos = d.camadas.filter((c) => c.tipo === "texto") as Extract<Camada, { tipo: "texto" }>[];
        const maior = [...textos].sort((x, y) => y.tamanho - x.tamanho)[0];
        return maior ? { ...d, camadas: d.camadas.map((c) => (c.id === maior.id ? { ...c, texto: tituloDoPedido } : c)) } : d;
      });
      setAviso(pedido.legenda ? `Título trazido do calendário. A legenda está na peça do calendário (${pedido.legenda.length} caracteres).` : "Título trazido do calendário.");
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  const camada = useMemo(() => doc.camadas.find((c) => c.id === selecionado) ?? null, [doc, selecionado]);

  // Guarda o passo anterior para desfazer; o futuro se perde a cada mudança nova.
  const setDoc = useCallback((proximo: Documento | ((d: Documento) => Documento), lembrar = true, rotulo?: string) => {
    setDocBruto((atual) => {
      const novo = typeof proximo === "function" ? proximo(atual) : proximo;
      if (lembrar && novo !== atual) {
        historico.current.passado = [...historico.current.passado.slice(-59), { doc: atual, rotulo: rotulo ?? rotular(atual, novo) }];
        historico.current.futuro = [];
      }
      return novo;
    });
    if (lembrar) {
      setMexido(true);
      sincronizar();
    }
  }, [sincronizar]);
  const desfazer = useCallback(() => {
    const anterior = historico.current.passado.pop();
    if (!anterior) return;
    setDocBruto((atual) => {
      historico.current.futuro.push({ doc: atual, rotulo: anterior.rotulo });
      return anterior.doc;
    });
    setMexido(true);
    sincronizar();
  }, [sincronizar]);
  const refazer = useCallback(() => {
    const proximo = historico.current.futuro.pop();
    if (!proximo) return;
    setDocBruto((atual) => {
      historico.current.passado.push({ doc: atual, rotulo: proximo.rotulo });
      return proximo.doc;
    });
    setMexido(true);
    sincronizar();
  }, [sincronizar]);
  /** Volta até o passo escolhido no histórico (cada passo desfeito pode ser refeito). */
  const voltarAte = (indice: number) => {
    for (let i = passos.length - 1; i >= indice; i--) desfazer();
  };

  // Sair com mudança não guardada pede confirmação ao navegador.
  useEffect(() => {
    if (!mexido) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [mexido]);

  /** Muda a camada selecionada (texto recalcula a altura). */
  const mudar = useCallback((mudanca: Partial<Camada>, lembrar = true) => {
    if (!selecionado) return;
    setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (c.id === selecionado ? ajustarAltura({ ...c, ...mudanca } as Camada) : c)) }), lembrar);
  }, [selecionado, setDoc]);

  // As fontes do site, carregadas antes do primeiro desenho; o modelo inicial recalcula as alturas dos textos.
  useEffect(() => {
    void prepararFontes().then(() => {
      setFontesProntas(true);
      setDocBruto((d) => ({ ...d, camadas: d.camadas.map(ajustarAltura) }));
    });
  }, []);

  // A tela se encaixa na largura disponível.
  useEffect(() => {
    const el = moldura.current;
    if (!el) return;
    const medir = () => {
      const largura = Math.max(240, el.clientWidth - 8);
      const altura = Math.max(320, window.innerHeight - 260);
      setAjuste(Math.min(largura / doc.w, altura / doc.h, 1));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [doc.w, doc.h]);

  // Desenha a cada mudança (e de novo quando uma imagem termina de carregar).
  useEffect(() => {
    const el = tela.current;
    if (!el) return;
    const pintar = () => {
      desenhar(el, doc, escala);
      const ctx = el.getContext("2d");
      if (ctx && camada && !camada.oculta) desenharSelecao(ctx, camada, escala);
      if (ctx && guias) {
        ctx.save();
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.strokeStyle = "#c21f16";
        ctx.lineWidth = 1 / escala;
        ctx.setLineDash([4 / escala, 3 / escala]);
        for (const x of guias.v) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, doc.h); ctx.stroke(); }
        for (const y of guias.h) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(doc.w, y); ctx.stroke(); }
        ctx.restore();
      }
    };
    let pedido = requestAnimationFrame(pintar);
    const pendentes = doc.camadas.filter((c): c is CamadaImagem => c.tipo === "imagem").map((c) => carregarImagem(c.src).then(() => undefined, () => undefined));
    if (pendentes.length) void Promise.all(pendentes).then(() => { cancelAnimationFrame(pedido); pedido = requestAnimationFrame(pintar); });
    return () => cancelAnimationFrame(pedido);
  }, [doc, escala, camada, fontesProntas, guias]);

  // Teclas: apagar, setas, desfazer, refazer, duplicar, guardar.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        refazer();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "d" || e.key.toLowerCase() === "j") && camada) {
        e.preventDefault();
        duplicar();
      } else if (e.key === " " && !e.repeat) {
        // Espaço segurado: a mão, para arrastar a tela.
        e.preventDefault();
        espaco.current = true;
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "v") {
        setFerramenta("mover");
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "t") {
        setFerramenta("texto");
      } else if ((e.key === "Delete" || e.key === "Backspace") && camada) {
        e.preventDefault();
        apagar();
      } else if (e.key === "Escape") setSelecionado(null);
      else if (camada && /^Arrow/.test(e.key)) {
        e.preventDefault();
        const passo = e.shiftKey ? 10 : 1;
        mudar({ x: camada.x + (e.key === "ArrowRight" ? passo : e.key === "ArrowLeft" ? -passo : 0), y: camada.y + (e.key === "ArrowDown" ? passo : e.key === "ArrowUp" ? -passo : 0) });
      }
    };
    const soltarTecla = (e: KeyboardEvent) => {
      if (e.key === " ") espaco.current = false;
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("keyup", soltarTecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("keyup", soltarTecla);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camada, mudar, desfazer, refazer]);

  function ajustarAltura(c: Camada): Camada {
    if (c.tipo !== "texto") return c;
    return { ...c, h: alturaDoTexto(c) };
  }

  const ponto = (e: React.PointerEvent) => {
    const r = tela.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / escala, y: (e.clientY - r.top) / escala };
  };

  function apontar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (espaco.current && moldura.current) {
      mao.current = { x0: e.clientX, y0: e.clientY, sl: moldura.current.scrollLeft, st: moldura.current.scrollTop };
      tela.current?.setPointerCapture(e.pointerId);
      return;
    }
    const p = ponto(e);
    if (ferramenta === "texto") {
      const largura = Math.min(doc.w - p.x, doc.w * 0.6);
      acrescentar(texto({ x: p.x, y: p.y, w: Math.max(80, largura), texto: "Escreva aqui", fonte: "serifa", tamanho: Math.round(doc.w / 100) * 4, peso: 400 }));
      setFerramenta("mover");
      window.setTimeout(() => document.getElementById("estudio-texto")?.focus(), 50);
      return;
    }
    if (camada) {
      const alca = alcas(camada, escala).find((a) => Math.hypot((a.x - p.x) * escala, (a.y - p.y) * escala) <= 10);
      if (alca) {
        arrasto.current = { modo: alca.id === "rot" ? "girar" : "redimensionar", alca: alca.id, x0: p.x, y0: p.y, inicio: camada, mexeu: false };
        tela.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
    const alvo = camadaEm(doc, p.x, p.y);
    setSelecionado(alvo?.id ?? null);
    if (alvo) {
      arrasto.current = { modo: "mover", x0: p.x, y0: p.y, inicio: alvo, mexeu: false };
      tela.current?.setPointerCapture(e.pointerId);
    }
  }

  function arrastar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mao.current && moldura.current) {
      moldura.current.scrollLeft = mao.current.sl - (e.clientX - mao.current.x0);
      moldura.current.scrollTop = mao.current.st - (e.clientY - mao.current.y0);
      return;
    }
    const a = arrasto.current;
    if (!a) return;
    const p = ponto(e);
    const dx = p.x - a.x0;
    const dy = p.y - a.y0;
    if (!a.mexeu && Math.hypot(dx * escala, dy * escala) < 3) return;
    a.mexeu = true;
    const c = a.inicio;
    let mudanca: Partial<Camada> = {};
    if (a.modo === "mover") {
      let x = c.x + (e.shiftKey && Math.abs(dx) < Math.abs(dy) ? 0 : dx);
      let y = c.y + (e.shiftKey && Math.abs(dy) <= Math.abs(dx) ? 0 : dy);
      // Imã: bordas e centro da página e das outras camadas visíveis; as guias mostram onde encaixou.
      const ima = 8 / escala;
      const outras = doc.camadas.filter((k) => k.id !== c.id && !k.oculta);
      const linhasV = [0, doc.w / 2, doc.w, ...outras.flatMap((k) => [k.x, k.x + k.w / 2, k.x + k.w])];
      const linhasH = [0, doc.h / 2, doc.h, ...outras.flatMap((k) => [k.y, k.y + k.h / 2, k.y + k.h])];
      const encaixar = (pos: number, tamanho: number, linhas: number[]) => {
        let melhor: { pos: number; linha: number; d: number } | null = null;
        for (const borda of [0, tamanho / 2, tamanho]) for (const l of linhas) {
          const d = Math.abs(pos + borda - l);
          if (d < ima && (!melhor || d < melhor.d)) melhor = { pos: l - borda, linha: l, d };
        }
        return melhor;
      };
      const ex = encaixar(x, c.w, linhasV);
      const ey = encaixar(y, c.h, linhasH);
      if (ex) x = ex.pos;
      if (ey) y = ey.pos;
      setGuias(ex || ey ? { v: ex ? [ex.linha] : [], h: ey ? [ey.linha] : [] } : null);
      mudanca = { x, y };
    } else if (a.modo === "girar") {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      let graus = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) graus = Math.round(graus / 15) * 15;
      if (Math.abs(((graus % 360) + 360) % 360) < 3) graus = 0;
      mudanca = { rot: Math.round(graus * 10) / 10 };
    } else if (a.alca) {
      // Redimensiona nos eixos da própria camada (vale com rotação).
      const ang = (-c.rot * Math.PI) / 180;
      const lx = dx * Math.cos(ang) - dy * Math.sin(ang);
      const ly = dx * Math.sin(ang) + dy * Math.cos(ang);
      let w = c.w;
      let h = c.h;
      let x = c.x;
      let y = c.y;
      const fixa = c.tipo === "imagem" || c.tipo === "marca" || e.shiftKey;
      if (a.alca.includes("e")) w = Math.max(10, c.w + lx);
      if (a.alca.includes("w")) w = Math.max(10, c.w - lx);
      if (a.alca.includes("s")) h = Math.max(10, c.h + ly);
      if (a.alca.includes("n")) h = Math.max(10, c.h - ly);
      if (fixa && a.alca.length === 2) {
        const razao = c.w / c.h;
        if (Math.abs(w - c.w) > Math.abs(h - c.h)) h = w / razao;
        else w = h * razao;
      }
      if (c.rot === 0) {
        if (a.alca.includes("w")) x = c.x + (c.w - w);
        if (a.alca.includes("n")) y = c.y + (c.h - h);
      } else {
        x = c.x + (c.w - w) / 2;
        y = c.y + (c.h - h) / 2;
      }
      mudanca = c.tipo === "texto" ? { x, y, w } : { x, y, w, h };
    }
    setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => (k.id === c.id ? ajustarAltura({ ...k, ...mudanca } as Camada) : k)) }), false);
  }

  function soltar(e: React.PointerEvent<HTMLCanvasElement>) {
    const a = arrasto.current;
    arrasto.current = null;
    mao.current = null;
    setGuias(null);
    tela.current?.releasePointerCapture(e.pointerId);
    if (!a?.mexeu) return;
    // O passo inteiro do arrasto vira uma entrada só no histórico.
    const rotulo = `${a.modo === "mover" ? "Moveu" : a.modo === "girar" ? "Girou" : "Redimensionou"}: ${nomeDaCamada(a.inicio)}`;
    setDocBruto((atual) => {
      historico.current.passado = [...historico.current.passado.slice(-59), { doc: { ...atual, camadas: atual.camadas.map((k) => (k.id === a.inicio.id ? a.inicio : k)) }, rotulo }];
      historico.current.futuro = [];
      return atual;
    });
    setMexido(true);
    sincronizar();
  }

  function acrescentar(nova: Camada) {
    const c = ajustarAltura(nova);
    setDoc((d) => ({ ...d, camadas: [...d.camadas, c] }));
    setSelecionado(c.id);
  }
  function duplicar() {
    if (!camada) return;
    const copia = { ...camada, id: novoId(), x: camada.x + 24, y: camada.y + 24 };
    setDoc((d) => ({ ...d, camadas: [...d.camadas, copia] }));
    setSelecionado(copia.id);
  }
  function apagar() {
    if (!camada) return;
    setDoc((d) => ({ ...d, camadas: d.camadas.filter((c) => c.id !== camada.id) }));
    setSelecionado(null);
  }
  function ordenar(para: "frente" | "tras" | "topo" | "fundo") {
    if (!camada) return;
    setDoc((d) => {
      const lista = d.camadas.filter((c) => c.id !== camada.id);
      const i = d.camadas.findIndex((c) => c.id === camada.id);
      const alvo = para === "topo" ? lista.length : para === "fundo" ? 0 : para === "frente" ? Math.min(lista.length, i + 1) : Math.max(0, i - 1);
      lista.splice(alvo, 0, camada);
      return { ...d, camadas: lista };
    });
  }
  function alinhar(como: "esq" | "centro" | "dir" | "cima" | "meio" | "baixo") {
    if (!camada) return;
    const m = { esq: { x: 0 }, centro: { x: doc.w / 2 - camada.w / 2 }, dir: { x: doc.w - camada.w }, cima: { y: 0 }, meio: { y: doc.h / 2 - camada.h / 2 }, baixo: { y: doc.h - camada.h } }[como];
    mudar(m);
  }

  function usarModelo(modelo: Modelo) {
    if (doc.camadas.length > 0 && !window.confirm("Trocar pelo modelo? O que está na tela sai (dá para desfazer).")) return;
    const novo = modelo.montar();
    setDoc({ ...novo, camadas: novo.camadas.map(ajustarAltura) }, true, `Modelo: ${modelo.nome}`);
    setFormato(modelo.formato);
    setTitulo(modelo.nome);
    setSelecionado(null);
    setIdSalvo(null);
    setMexido(false);
  }
  function mudarFormato(id: FormatoId) {
    const f = FORMATOS.find((x) => x.id === id);
    if (!f) return;
    setFormato(id);
    setDoc((d) => ({ ...d, w: f.w, h: f.h }));
  }

  const centro = (w: number, h: number) => ({ x: Math.round(doc.w / 2 - w / 2), y: Math.round(doc.h / 2 - h / 2) });
  const u = doc.w / 100;

  async function escolherImagem(f: File | undefined) {
    if (!f) return;
    try {
      const src = await prepararImagem(f);
      const img = await carregarImagem(src);
      const w = Math.min(doc.w * 0.6, img.width);
      const h = (w * img.height) / img.width;
      acrescentar(imagem({ ...centro(w, h), w, h, src, nome: f.name.slice(0, 40) }));
    } catch {
      setAviso("Não deu para abrir esta imagem.");
    } finally {
      if (arquivo.current) arquivo.current.value = "";
    }
  }
  async function imagemDaGaleria(src: string, credito: string) {
    try {
      const img = await carregarImagem(src);
      const w = Math.min(doc.w * 0.5, img.width);
      const h = (w * img.height) / img.width;
      acrescentar(imagem({ ...centro(w, h), w, h, src, credito, borda: COR.Tinta, espessura: Math.max(2, Math.round(u * 0.4)), nome: "Cartaz" }));
    } catch {
      setAviso("Não deu para carregar a imagem.");
    }
  }
  async function procurar() {
    const termo = busca.trim();
    if (termo.length < 3) return;
    setBuscando(true);
    setAchados(null);
    try {
      const r = await fetch(`/api/imagens?q=${encodeURIComponent(termo)}`);
      const dados = (await r.json()) as { achados?: Achado[] };
      setAchados(dados.achados ?? []);
    } catch {
      setAchados([]);
    } finally {
      setBuscando(false);
    }
  }

  function baixarArquivo(blob: Blob, nome: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function baixar(tipo: "png" | "jpeg") {
    try {
      const blob = await exportar(doc, tipo, formato === "capa-podcast" ? 1 : 1);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${nomeDeArquivo(titulo)}-${doc.w}x${doc.h}.${tipo === "png" ? "png" : "jpg"}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      setAviso("Não deu para exportar.");
    }
  }
  /** A mesma arte em post, story e quadrado, num .zip (os textos refazem as linhas; confira antes de publicar). */
  async function exportarEmLote() {
    try {
      setAviso("Preparando os três formatos…");
      const alvos = FORMATOS.filter((f) => f.id === "post" || f.id === "story" || f.id === "quadrado");
      const arquivos = [];
      for (const f of alvos) {
        const versao = doc.w === f.w && doc.h === f.h ? doc : adaptar(doc, f.w, f.h);
        arquivos.push({ nome: `${nomeDeArquivo(titulo)}-${f.id}-${f.w}x${f.h}.png`, dados: await exportar(versao, "png") });
      }
      baixarArquivo(await ziparBinarios(arquivos), `${nomeDeArquivo(titulo)}-formatos.zip`);
      setAviso("Pronto: post, story e quadrado no .zip. Confira cada um: em formato diferente, o texto pode ter quebrado em outro lugar.");
    } catch {
      setAviso("Não deu para exportar os formatos.");
    }
  }
  /** O PSD da arte (camadas com nome, textos editáveis quando dá), para continuar no editor avançado. */
  async function abrirNoEditorAvancado(d: Documento = doc, nome = titulo) {
    try {
      setAviso("Montando o PSD…");
      baixarArquivo(await paraPsd(d), `${nomeDeArquivo(nome)}.psd`);
      const endereco = enderecoDo("photocraft");
      if (endereco) window.open(endereco, "_blank", "noopener");
      setAviso(endereco
        ? "PSD baixado. O editor avançado abriu em outra aba: abra o arquivo nele (File › Open… ou arrastando para a janela). Fontes: EB Garamond, Inter e IBM Plex Mono (Google Fonts, livres)."
        : "PSD baixado. O editor avançado ainda não está no ar no endereço do instituto; o arquivo abre em qualquer editor que leia PSD. Fontes: EB Garamond, Inter e IBM Plex Mono (Google Fonts, livres).");
    } catch {
      setAviso("Não deu para montar o PSD.");
    }
  }
  async function imprimir() {
    try {
      const blob = await exportar(doc, "png");
      const url = URL.createObjectURL(blob);
      const janela = window.open("", "_blank");
      if (!janela) return;
      janela.document.write(`<!doctype html><html><head><title>${titulo.replace(/</g, "&lt;")}</title><style>@page{margin:0}body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}img{max-width:100%;max-height:100vh}</style></head><body><img src="${url}" onload="setTimeout(function(){window.print()},300)"></body></html>`);
      janela.document.close();
    } catch {
      setAviso("Não deu para preparar a impressão.");
    }
  }
  async function guardar(compartilhado = true) {
    try {
      const mini = await miniatura(doc);
      const r = (await acao.agir("design_salvar", { p_id: idSalvo, p: { titulo: titulo || "Sem título", formato, largura: doc.w, altura: doc.h, dados: doc, miniatura: mini, compartilhado } }, "Trabalho guardado na sua conta.")) as { id?: string } | null;
      if (r?.id) {
        setIdSalvo(r.id);
        setMexido(false);
      }
    } catch {
      setAviso("Não deu para guardar.");
    }
  }
  async function abrir(id: string) {
    try {
      const r = (await acao.agir("design_ver", { p_id: id }, "")) as Trabalho | null;
      if (!r?.dados) return;
      setDoc({ ...r.dados, camadas: (r.dados.camadas ?? []).map(ajustarAltura) });
      setTitulo(r.titulo);
      setFormato((FORMATOS.find((f) => f.id === r.formato)?.id ?? "post") as FormatoId);
      setIdSalvo(r.id);
      setSelecionado(null);
      setAba("modelos");
      setMexido(false);
    } catch {
      setAviso("Não deu para abrir.");
    }
  }

  const abas: [AbaEsquerda, string][] = [["modelos", "Modelos"], ["texto", "Texto"], ["formas", "Formas"], ["imagens", "Imagens"], ["marca", "Marca"], ["fundo", "Fundo"], ["trabalhos", "Trabalhos"]];

  return (
    <div className="estudio -mx-5 -mt-7 flex min-h-[calc(100dvh-14rem)] flex-col text-xs sm:-mx-8">
      {/* A barra do alto: título, formato, histórico, guardar e exportar. */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-parchment-deep px-4 py-2">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} aria-label="Nome do trabalho" className="min-w-40 flex-1 border-2 border-transparent bg-transparent px-2 py-1 font-serif text-base font-semibold hover:border-rule focus:border-ink focus:outline-none" />
        {mexido && <span className="font-mono text-[0.65rem] text-oxblood" role="status" title="Há mudanças que ainda não foram guardadas na conta">● não guardado</span>}
        <span className="flex gap-1" role="group" aria-label="Ferramenta">
          <button type="button" className={`${BOTAOZINHO} ${ferramenta === "mover" ? ATIVO : ""}`} aria-pressed={ferramenta === "mover"} onClick={() => setFerramenta("mover")} title="Mover e selecionar (V)">↖ V</button>
          <button type="button" className={`${BOTAOZINHO} ${ferramenta === "texto" ? ATIVO : ""}`} aria-pressed={ferramenta === "texto"} onClick={() => setFerramenta("texto")} title="Texto: clique na tela para escrever (T)">T</button>
        </span>
        <select value={formato} onChange={(e) => mudarFormato(e.target.value as FormatoId)} aria-label="Formato" className={`${CAMPO} w-auto`}>
          {FORMATOS.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
        <span className="flex gap-1">
          <button type="button" className={BOTAOZINHO} onClick={desfazer} title="Desfazer (Ctrl+Z)">↶ Desfazer</button>
          <button type="button" className={BOTAOZINHO} onClick={refazer} title="Refazer (Ctrl+Y)">↷ Refazer</button>
        </span>
        <span className="flex items-center gap-1">
          <button type="button" className={BOTAOZINHO} onClick={() => setZoomManual(Math.max(0.05, escala * 0.8))} aria-label="Afastar">−</button>
          <button type="button" className={BOTAOZINHO} onClick={() => setZoomManual(null)} title="Encaixar na tela">{Math.round(escala * 100)}%</button>
          <button type="button" className={BOTAOZINHO} onClick={() => setZoomManual(Math.min(3, escala * 1.25))} aria-label="Aproximar">+</button>
        </span>
        <span className="ml-auto flex flex-wrap gap-1">
          <button type="button" className={BOTAOZINHO} onClick={() => void baixar("png")}>Baixar PNG</button>
          <button type="button" className={BOTAOZINHO} onClick={() => void baixar("jpeg")}>Baixar JPG</button>
          <button type="button" className={BOTAOZINHO} onClick={() => void imprimir()}>Imprimir / PDF</button>
          <button type="button" className={BOTAOZINHO} onClick={() => void exportarEmLote()} title="A mesma arte em post, story e quadrado, num .zip">Exportar em lote</button>
          <button type="button" className={BOTAOZINHO} onClick={() => void abrirNoEditorAvancado()} title="Baixa o PSD com as camadas e abre o editor avançado (PhotoCraft)">Abrir no editor avançado ↗</button>
          <button type="button" className={`${botao} py-1 text-xs`} disabled={acao.ocupado} onClick={() => void guardar()}>{idSalvo ? "Guardar" : "Guardar na conta"}</button>
        </span>
      </div>
      <Aviso texto={aviso || acao.aviso} />

      <div className="grid flex-1 gap-0 lg:grid-cols-[13rem_minmax(0,1fr)_17rem]">
        {/* Esquerda: o que se acrescenta. */}
        <aside className="border-b-2 border-ink bg-parchment-deep lg:border-b-0 lg:border-r-2">
          <div className="flex flex-wrap gap-0.5 border-b border-rule p-1.5">
            {abas.map(([id, nome]) => (
              <button key={id} type="button" onClick={() => setAba(id)} aria-pressed={aba === id} className={`cursor-pointer border px-2 py-1 ${aba === id ? ATIVO : "border-rule bg-parchment hover:border-ink"}`}>{nome}</button>
            ))}
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-3 [scrollbar-width:thin]">
            {aba === "modelos" &&
              GRUPOS.map((grupo) => (
                <div key={grupo} className="mb-3">
                  <p className={rotulo}>{grupo}</p>
                  <ul className="mt-1 space-y-1">
                    {MODELOS.filter((m) => m.grupo === grupo).map((m) => (
                      <li key={m.id} className="flex items-stretch gap-0.5">
                        <button type="button" onClick={() => usarModelo(m)} className="min-w-0 flex-1 cursor-pointer border border-rule bg-parchment px-2 py-1.5 text-left hover:border-ink">
                          {m.nome}
                          <span className="block font-mono text-[0.6rem] text-ink-soft">{FORMATOS.find((f) => f.id === m.formato)?.nome}</span>
                        </button>
                        <button type="button" title={`Baixar “${m.nome}” em PSD, para começar no editor avançado`} aria-label={`Baixar ${m.nome} em PSD`} onClick={() => { const d = m.montar(); void abrirNoEditorAvancado({ ...d, camadas: d.camadas.map(ajustarAltura) }, m.nome); }} className="cursor-pointer border border-rule bg-parchment px-1 font-mono text-[0.55rem] hover:border-ink">PSD</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {aba === "modelos" && (
              <div>
                <p className={rotulo}>Em branco</p>
                <button type="button" className={`${BOTAOZINHO} mt-1 w-full`} onClick={() => { if (!doc.camadas.length || window.confirm("Começar do zero?")) { setDoc(documentoVazio(formato)); setSelecionado(null); setIdSalvo(null); setTitulo("Sem título"); } }}>Página em branco neste formato</button>
              </div>
            )}
            {aba === "texto" && (
              <div className="space-y-1.5">
                {[
                  ["Título", () => texto({ ...centro(80 * u, 20 * u), w: 80 * u, texto: "Um título que fala alto", fonte: "serifa", tamanho: 12 * u, peso: 600, entrelinha: 0.97, espacamento: -0.02 })],
                  ["Subtítulo", () => texto({ ...centro(80 * u, 8 * u), w: 80 * u, texto: "Uma linha que explica o título.", fonte: "serifa", tamanho: 4.4 * u, peso: 400, cor: COR["Tinta suave"], entrelinha: 1.25 })],
                  ["Parágrafo", () => texto({ ...centro(80 * u, 12 * u), w: 80 * u, texto: "Escreva aqui. O texto quebra sozinho na largura da caixa; puxe as alças dos lados para mudar a largura.", fonte: "serifa", tamanho: 3.4 * u, peso: 400, entrelinha: 1.3 })],
                  ["Etiqueta (mono)", () => texto({ ...centro(60 * u, 3 * u), w: 60 * u, texto: "Educação popular", fonte: "mono", tamanho: 2 * u, peso: 500, cor: COR["Bordô"], espacamento: 0.2, maiusculas: true })],
                  ["Tarja (letra pesada)", () => texto({ ...centro(50 * u, 6 * u), w: 50 * u, texto: "De graça", fonte: "sans", tamanho: 2.2 * u, peso: 800, cor: COR.Pergaminho, fundo: COR.Tinta, recuo: 1.4 * u, alinhar: "center", espacamento: 0.08, maiusculas: true })],
                  ["Chamada em itálico", () => texto({ ...centro(80 * u, 10 * u), w: 80 * u, texto: "Pergunte. Alguém responde.", fonte: "serifa", tamanho: 6 * u, peso: 500, italico: true, cor: COR["Bordô"] })],
                  ["Cartaz (sans 900)", () => texto({ ...centro(84 * u, 20 * u), w: 84 * u, texto: "Estude de graça", fonte: "sans", tamanho: 11 * u, peso: 900, italico: true, maiusculas: true, entrelinha: 0.92, espacamento: -0.02 })],
                  ["Endereço do site", () => texto({ ...centro(60 * u, 3 * u), w: 60 * u, texto: "institutolucia.org", fonte: "mono", tamanho: 2 * u, peso: 500, cor: COR["Bordô"], espacamento: 0.14, maiusculas: true })],
                ].map(([nome, fazer]) => (
                  <button key={nome as string} type="button" className={`${BOTAOZINHO} w-full text-left`} onClick={() => acrescentar((fazer as () => Camada)())}>{nome as string}</button>
                ))}
              </div>
            )}
            {aba === "formas" && (
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["Retângulo", () => forma("retangulo", { ...centro(40 * u, 25 * u), w: 40 * u, h: 25 * u })],
                  ["Elipse", () => forma("elipse", { ...centro(30 * u, 30 * u), w: 30 * u, h: 30 * u, preenchimento: COR["Bordô"] })],
                  ["Estrela", () => forma("estrela", { ...centro(16 * u, 16 * u), w: 16 * u, h: 16 * u })],
                  ["Linha", () => forma("linha", { ...centro(80 * u, 2 * u), w: 80 * u, h: 2 * u, preenchimento: COR.Tinta, espessura: Math.max(2, 0.3 * u) })],
                  ["Cunha", () => forma("cunha", { x: doc.w - 40 * u, y: doc.h - 40 * u, w: 40 * u, h: 40 * u, preenchimento: COR.Tinta })],
                  ["Raios", () => forma("raios", { x: 0, y: 0, w: doc.w, h: doc.h, preenchimento: COR["Bordô"], opacidade: 0.5 })],
                  ["Faixa preta", () => forma("retangulo", { x: 8 * u, y: doc.h - 18 * u, w: 84 * u, h: 9 * u, preenchimento: COR.Tinta })],
                  ["Moldura", () => forma("retangulo", { ...centro(60 * u, 60 * u), w: 60 * u, h: 60 * u, preenchimento: "transparent", borda: COR.Tinta, espessura: Math.max(2, 0.4 * u) })],
                ] as [string, () => Camada][]).map(([nome, fazer]) => (
                  <button key={nome} type="button" className={BOTAOZINHO} onClick={() => acrescentar(fazer())}>{nome}</button>
                ))}
              </div>
            )}
            {aba === "imagens" && (
              <div className="space-y-4">
                <div>
                  <p className={rotulo}>Do seu aparelho</p>
                  <button type="button" className={`${BOTAOZINHO} mt-1 w-full`} onClick={() => arquivo.current?.click()}>Escolher imagem…</button>
                  <input ref={arquivo} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void escolherImagem(e.target.files?.[0])} />
                  <p className="mt-1 text-[0.65rem] text-ink-soft">Só imagem sua, em domínio público ou com licença livre. Fotos de pessoas, só com autorização.</p>
                </div>
                <div>
                  <p className={rotulo}>Galeria do instituto</p>
                  <ul className="mt-1 grid grid-cols-2 gap-1.5">
                    {(galeria as { slug: string; titulo: string; autor: string; ano: string; imagem: string }[]).map((item) => (
                      <li key={item.slug}>
                        <button type="button" onClick={() => void imagemDaGaleria(item.imagem, `${item.autor}, ${item.ano}. Domínio público.`)} className="w-full cursor-pointer border border-rule bg-parchment p-1 text-left hover:border-ink" title={`${item.titulo} (${item.autor}, ${item.ano})`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.imagem} alt={item.titulo} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                          <span className="mt-1 block truncate text-[0.65rem]">{item.titulo}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className={rotulo}>Wikimedia Commons</p>
                  <form className="mt-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); void procurar(); }}>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar imagem livre" aria-label="Procurar na Wikimedia Commons" className={`${CAMPO} min-w-0 flex-1`} />
                    <button type="submit" className={BOTAOZINHO} disabled={buscando || busca.trim().length < 3}>{buscando ? "…" : "Buscar"}</button>
                  </form>
                  {achados && achados.length === 0 && <p className="mt-1 text-ink-soft">Nada encontrado.</p>}
                  <ul className="mt-1 grid grid-cols-2 gap-1.5">
                    {achados?.map((a) => (
                      <li key={a.arquivo}>
                        <button type="button" onClick={() => void imagemDaGaleria(`/api/imagem?arquivo=${encodeURIComponent(a.arquivo)}`, `${a.autor ? `${a.autor}. ` : ""}${a.licenca}. Wikimedia Commons.`)} className="w-full cursor-pointer border border-rule bg-parchment p-1 text-left hover:border-ink" title={`${a.titulo} · ${a.licenca}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.miniatura} alt={a.titulo} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                          <span className="mt-1 block truncate text-[0.65rem]">{a.titulo}</span>
                          <span className="block truncate font-mono text-[0.6rem] text-ink-soft">{a.licenca}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[0.65rem] text-ink-soft">A busca traz só arquivos com licença livre. O crédito entra na camada; cite-o na legenda do post.</p>
                </div>
              </div>
            )}
            {aba === "marca" && (
              <div className="space-y-1.5">
                <button type="button" className={`${BOTAOZINHO} w-full text-left`} onClick={() => acrescentar(marca({ ...centro(20 * u, 20 * u), w: 20 * u, variante: "simbolo", cor: COR.Tinta }))}>Símbolo (estrela e livro)</button>
                <button type="button" className={`${BOTAOZINHO} w-full text-left`} onClick={() => acrescentar(marca({ ...centro(20 * u, 20 * u), w: 20 * u, variante: "circulo", cor: COR.Pergaminho, fundo: COR["Bordô"] }))}>Símbolo no círculo bordô</button>
                <button type="button" className={`${BOTAOZINHO} w-full text-left`} onClick={() => acrescentar(marca({ x: 8 * u, y: 6 * u, w: 6 * u, h: 6 * u, variante: "nome", cor: COR.Tinta }))}>Marca com o nome</button>
                <p className="pt-2 text-[0.65rem] text-ink-soft">A marca é sempre a estrela sobre o livro aberto. Não distorça, não gire, não troque as cores por fora da paleta. Em fundo escuro ou vermelho, use pergaminho ou branco.</p>
              </div>
            )}
            {aba === "fundo" && (
              <div className="space-y-3">
                <div>
                  <p className={rotulo}>Cor</p>
                  <div className="mt-1"><Cores valor={doc.fundo.cor} mudar={(cor) => setDoc((d) => ({ ...d, fundo: { ...d.fundo, cor } }))} /></div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={doc.fundo.pontilhado} onChange={(e) => setDoc((d) => ({ ...d, fundo: { ...d.fundo, pontilhado: e.target.checked } }))} /> Trama de pontinhos
                </label>
                <div>
                  <p className={rotulo}>Fio de cima</p>
                  <div className="mt-1"><Cores valor={doc.fundo.bordaCima} semCor mudar={(cor) => setDoc((d) => ({ ...d, fundo: { ...d.fundo, bordaCima: cor, espessura: d.fundo.espessura || Math.round(1.8 * u) } }))} /></div>
                </div>
                <div>
                  <p className={rotulo}>Fio de baixo</p>
                  <div className="mt-1"><Cores valor={doc.fundo.bordaBaixo} semCor mudar={(cor) => setDoc((d) => ({ ...d, fundo: { ...d.fundo, bordaBaixo: cor, espessura: d.fundo.espessura || Math.round(1.8 * u) } }))} /></div>
                </div>
                <Faixa rotuloTexto="Espessura dos fios" valor={doc.fundo.espessura} min={0} max={Math.round(6 * u)} mudar={(v) => setDoc((d) => ({ ...d, fundo: { ...d.fundo, espessura: v } }))} />
              </div>
            )}
            {aba === "trabalhos" && (
              <div>
                <Aviso texto={trabalhos.erro} />
                {trabalhos.dados?.length === 0 && <p className="text-ink-soft">Nenhum trabalho guardado ainda. Use “Guardar na conta” na barra de cima.</p>}
                <ul className="grid grid-cols-2 gap-1.5">
                  {trabalhos.dados?.map((tr) => (
                    <li key={tr.id} className={`border bg-parchment p-1 ${tr.id === idSalvo ? "border-ink" : "border-rule"}`}>
                      <button type="button" className="w-full cursor-pointer text-left" onClick={() => void abrir(tr.id)} title={`${tr.titulo} · ${tr.autor}`}>
                        {tr.miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tr.miniatura} alt="" className="aspect-square w-full object-contain" />
                        ) : (
                          <span className="block aspect-square w-full bg-parchment-deep" />
                        )}
                        <span className="mt-1 block truncate font-semibold">{tr.titulo}</span>
                        <span className="block truncate text-[0.6rem] text-ink-soft">{tr.autor} · {dataHora(tr.atualizado_em)}</span>
                      </button>
                      {tr.meu && <button type="button" className={`${elo} text-[0.65rem] text-oxblood`} onClick={() => { if (window.confirm("Apagar este trabalho?")) void acao.agir("design_apagar", { p_id: tr.id }, "Apagado."); }}>Apagar</button>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[0.65rem] text-ink-soft">Os trabalhos guardados ficam visíveis para a equipe de marketing e design, que pode continuar de onde você parou.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Centro: a tela. */}
        <div ref={moldura} className="relative flex min-h-[20rem] items-start justify-center overflow-auto bg-[#cdbb91]/40 p-4 [scrollbar-width:thin]" onPointerDown={(e) => { if (e.target === e.currentTarget) setSelecionado(null); }}>
          <canvas
            ref={tela}
            onPointerDown={apontar}
            onPointerMove={arrastar}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onDoubleClick={() => camada?.tipo === "texto" && document.getElementById("estudio-texto")?.focus()}
            className="touch-none shadow-[8px_8px_0_#1f1a14]"
            style={{ width: doc.w * escala, height: doc.h * escala, cursor: ferramenta === "texto" ? "text" : camada ? "move" : "default" }}
            aria-label={`Tela de ${doc.w} por ${doc.h} pontos`}
          />
        </div>

        {/* Direita: as propriedades do que está selecionado e a lista de camadas. */}
        <aside className="border-t-2 border-ink bg-parchment-deep lg:border-l-2 lg:border-t-0">
          <div className="max-h-[70vh] overflow-y-auto p-3 [scrollbar-width:thin]">
            {camada ? (
              <Propriedades camada={camada} doc={doc} mudar={mudar} duplicar={duplicar} apagar={apagar} ordenar={ordenar} alinhar={alinhar} />
            ) : (
              <p className="text-ink-soft">Clique numa camada da tela para mudar texto, cor, tamanho e posição. Arraste para mover; puxe as alças para redimensionar; o círculo vermelho gira. Shift trava o eixo ou a proporção.</p>
            )}
            <div className="mt-4 border-t border-rule pt-3">
              <p className={rotulo}>Camadas ({doc.camadas.length})</p>
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
                {[...doc.camadas].reverse().map((c) => (
                  <li key={c.id} className={`flex items-center gap-1 border px-1.5 py-1 ${c.id === selecionado ? ATIVO : "border-transparent hover:border-rule"}`}>
                    <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left" onClick={() => setSelecionado(c.id)}>
                      {c.nome || (c.tipo === "texto" ? (c.texto.split("\n")[0] || "Texto").slice(0, 30) : c.tipo === "imagem" ? "Imagem" : c.tipo === "marca" ? "Marca" : c.tipo[0].toUpperCase() + c.tipo.slice(1))}
                    </button>
                    <button type="button" className="cursor-pointer px-1" title={c.oculta ? "Mostrar" : "Esconder"} aria-label={c.oculta ? "Mostrar" : "Esconder"} onClick={() => setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => (k.id === c.id ? { ...k, oculta: !k.oculta } : k)) }))}>{c.oculta ? "◌" : "●"}</button>
                    <button type="button" className="cursor-pointer px-1" title={c.travada ? "Destravar" : "Travar"} aria-label={c.travada ? "Destravar" : "Travar"} onClick={() => setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => (k.id === c.id ? { ...k, travada: !k.travada } : k)) }))}>{c.travada ? "🔒" : "🔓"}</button>
                  </li>
                ))}
              </ul>
            </div>
            {passos.length > 0 && (
              <div className="mt-4 border-t border-rule pt-3">
                <p className={rotulo}>Histórico</p>
                <ol className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                  {passos.map((r, i) => ({ r, i })).slice(-15).reverse().map(({ r, i }) => (
                    <li key={i}>
                      <button type="button" className="w-full cursor-pointer truncate border border-transparent px-1.5 py-0.5 text-left hover:border-rule" title="Voltar para antes deste passo" onClick={() => voltarAte(i)}>↶ {r}</button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="mt-2 text-[0.65rem] text-ink-soft">Atalhos: V mover · T texto · Ctrl+Z desfazer · Ctrl+Shift+Z refazer · Ctrl+J duplicar · Delete apagar · setas ajuste fino · espaço segurado arrasta a tela.</p>
            <p className="mt-4 text-[0.65rem] text-ink-soft">Você assina como {me.nome}. Identidade do instituto: pergaminho, tinta, bordô e vermelho da gráfica; serifa para o texto, letra pesada para as etiquetas, monoespaçada para os rodapés.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Propriedades({ camada: c, doc, mudar, duplicar, apagar, ordenar, alinhar }: { camada: Camada; doc: Documento; mudar: (m: Partial<Camada>, lembrar?: boolean) => void; duplicar: () => void; apagar: () => void; ordenar: (p: "frente" | "tras" | "topo" | "fundo") => void; alinhar: (c: "esq" | "centro" | "dir" | "cima" | "meio" | "baixo") => void }) {
  const num = (rotuloTexto: string, chave: "x" | "y" | "w" | "h" | "rot", passo = 1) => (
    <label className="block">
      <span className="text-ink-soft">{rotuloTexto}</span>
      <input type="number" step={passo} value={Math.round(c[chave])} onChange={(e) => mudar({ [chave]: Number(e.target.value) } as Partial<Camada>)} className={CAMPO} disabled={chave === "h" && c.tipo === "texto"} />
    </label>
  );
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={rotulo}>Nome da camada</span>
        <input value={c.nome ?? ""} onChange={(e) => mudar({ nome: e.target.value }, false)} maxLength={40} className={CAMPO} />
      </label>

      {c.tipo === "texto" && <PropriedadesTexto c={c} mudar={mudar} />}
      {(c.tipo === "retangulo" || c.tipo === "elipse" || c.tipo === "estrela" || c.tipo === "linha" || c.tipo === "cunha" || c.tipo === "raios") && <PropriedadesForma c={c} mudar={mudar} />}
      {c.tipo === "imagem" && <PropriedadesImagem c={c} mudar={mudar} />}
      {c.tipo === "marca" && <PropriedadesMarca c={c} mudar={mudar} />}

      <Faixa rotuloTexto="Opacidade" valor={c.opacidade} min={0} max={1} passo={0.05} mudar={(v) => mudar({ opacidade: v })} />
      <div className="grid grid-cols-3 gap-1">
        {num("X", "x")}
        {num("Y", "y")}
        {num("Giro°", "rot")}
        {num("Largura", "w")}
        {num("Altura", "h")}
      </div>
      <div>
        <p className={rotulo}>Alinhar à página</p>
        <div className="mt-1 grid grid-cols-6 gap-0.5">
          {([["esq", "⇤"], ["centro", "↔"], ["dir", "⇥"], ["cima", "⤒"], ["meio", "↕"], ["baixo", "⤓"]] as const).map(([como, simbolo]) => (
            <button key={como} type="button" className={BOTAOZINHO} onClick={() => alinhar(como)} title={como} aria-label={`Alinhar: ${como}`}>{simbolo}</button>
          ))}
        </div>
      </div>
      <div>
        <p className={rotulo}>Ordem</p>
        <div className="mt-1 grid grid-cols-4 gap-0.5">
          <button type="button" className={BOTAOZINHO} onClick={() => ordenar("topo")} title="Trazer para o topo">⤒</button>
          <button type="button" className={BOTAOZINHO} onClick={() => ordenar("frente")} title="Trazer para a frente">↑</button>
          <button type="button" className={BOTAOZINHO} onClick={() => ordenar("tras")} title="Mandar para trás">↓</button>
          <button type="button" className={BOTAOZINHO} onClick={() => ordenar("fundo")} title="Mandar para o fundo">⤓</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={BOTAOZINHO} onClick={duplicar}>Duplicar (Ctrl+D)</button>
        <button type="button" className={`${BOTAOZINHO} text-oxblood`} onClick={apagar}>Apagar</button>
      </div>
      <p className="text-[0.65rem] text-ink-soft">Página: {doc.w} × {doc.h}.</p>
    </div>
  );
}

function PropriedadesTexto({ c, mudar }: { c: CamadaTexto; mudar: (m: Partial<Camada>, lembrar?: boolean) => void }) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={rotulo}>Texto</span>
        <textarea id="estudio-texto" value={c.texto} onChange={(e) => mudar({ texto: e.target.value })} rows={4} className={`${CAMPO} font-serif text-sm`} />
      </label>
      <div className="grid grid-cols-2 gap-1">
        <label className="block">
          <span className="text-ink-soft">Letra</span>
          <select value={c.fonte} onChange={(e) => mudar({ fonte: e.target.value as CamadaTexto["fonte"] })} className={CAMPO}>
            <option value="serifa">Serifa (EB Garamond)</option>
            <option value="sans">Pesada (Inter)</option>
            <option value="mono">Mono (IBM Plex)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-ink-soft">Peso</span>
          <select value={c.peso} onChange={(e) => mudar({ peso: Number(e.target.value) as CamadaTexto["peso"] })} className={CAMPO}>
            {[400, 500, 600, 700, 800, 900].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <Faixa rotuloTexto="Tamanho" valor={c.tamanho} min={8} max={400} mudar={(v) => mudar({ tamanho: v })} sufixo=" pt" />
      <Faixa rotuloTexto="Entrelinha" valor={c.entrelinha} min={0.8} max={2} passo={0.01} mudar={(v) => mudar({ entrelinha: v })} />
      <Faixa rotuloTexto="Espaço entre letras" valor={c.espacamento} min={-0.05} max={0.4} passo={0.01} mudar={(v) => mudar({ espacamento: v })} sufixo=" em" />
      <div className="flex flex-wrap gap-1">
        <button type="button" className={`${BOTAOZINHO} italic ${c.italico ? ATIVO : ""}`} onClick={() => mudar({ italico: !c.italico })}>Itálico</button>
        <button type="button" className={`${BOTAOZINHO} ${c.maiusculas ? ATIVO : ""}`} onClick={() => mudar({ maiusculas: !c.maiusculas })}>MAIÚSCULAS</button>
        {(["left", "center", "right"] as const).map((a) => (
          <button key={a} type="button" className={`${BOTAOZINHO} ${c.alinhar === a ? ATIVO : ""}`} onClick={() => mudar({ alinhar: a })} aria-label={`Alinhar ${a}`}>{a === "left" ? "⇤" : a === "center" ? "↔" : "⇥"}</button>
        ))}
      </div>
      <div>
        <p className="text-ink-soft">Cor do texto</p>
        <Cores valor={c.cor} mudar={(cor) => mudar({ cor })} />
      </div>
      <div>
        <p className="text-ink-soft">Tarja atrás do texto</p>
        <Cores valor={c.fundo} semCor mudar={(fundo) => mudar({ fundo, recuo: fundo && !c.recuo ? Math.round(c.tamanho * 0.5) : c.recuo })} />
        {c.fundo && <Faixa rotuloTexto="Recuo da tarja" valor={c.recuo} min={0} max={200} mudar={(v) => mudar({ recuo: v })} />}
      </div>
    </div>
  );
}

function PropriedadesForma({ c, mudar }: { c: CamadaForma; mudar: (m: Partial<Camada>) => void }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-ink-soft">Preenchimento</p>
        <Cores valor={c.preenchimento === "transparent" ? "" : c.preenchimento} semCor mudar={(cor) => mudar({ preenchimento: cor || "transparent" })} />
      </div>
      {c.tipo !== "linha" && c.tipo !== "raios" && (
        <>
          <div>
            <p className="text-ink-soft">Borda</p>
            <Cores valor={c.borda} semCor mudar={(borda) => mudar({ borda, espessura: borda && !c.espessura ? 4 : c.espessura })} />
          </div>
          {c.borda && <Faixa rotuloTexto="Espessura da borda" valor={c.espessura} min={1} max={60} mudar={(v) => mudar({ espessura: v })} />}
          {c.tipo === "retangulo" && <Faixa rotuloTexto="Cantos" valor={c.raio} min={0} max={200} mudar={(v) => mudar({ raio: v })} />}
        </>
      )}
      {c.tipo === "linha" && <Faixa rotuloTexto="Espessura" valor={c.espessura} min={1} max={60} mudar={(v) => mudar({ espessura: v })} />}
    </div>
  );
}

function PropriedadesImagem({ c, mudar }: { c: CamadaImagem; mudar: (m: Partial<Camada>) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        <label className="block">
          <span className="text-ink-soft">Filtro</span>
          <select value={c.filtro} onChange={(e) => mudar({ filtro: e.target.value as CamadaImagem["filtro"] })} className={CAMPO}>
            <option value="nenhum">Nenhum</option>
            <option value="pb">Preto e branco</option>
            <option value="duotom">Duotom vermelho</option>
            <option value="sepia">Sépia</option>
            <option value="contraste">Mais contraste</option>
          </select>
        </label>
        <label className="block">
          <span className="text-ink-soft">Ajuste</span>
          <select value={c.ajuste} onChange={(e) => mudar({ ajuste: e.target.value as CamadaImagem["ajuste"] })} className={CAMPO}>
            <option value="cobrir">Cobrir (corta)</option>
            <option value="conter">Conter (inteira)</option>
          </select>
        </label>
      </div>
      <div>
        <p className="text-ink-soft">Borda</p>
        <Cores valor={c.borda} semCor mudar={(borda) => mudar({ borda, espessura: borda && !c.espessura ? 4 : c.espessura })} />
      </div>
      {c.borda && <Faixa rotuloTexto="Espessura da borda" valor={c.espessura} min={1} max={60} mudar={(v) => mudar({ espessura: v })} />}
      <label className="block">
        <span className="text-ink-soft">Crédito (autor, ano, licença)</span>
        <input value={c.credito} onChange={(e) => mudar({ credito: e.target.value })} maxLength={200} className={CAMPO} />
      </label>
    </div>
  );
}

function PropriedadesMarca({ c, mudar }: { c: CamadaMarca; mudar: (m: Partial<Camada>) => void }) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-ink-soft">Variante</span>
        <select value={c.variante} onChange={(e) => mudar({ variante: e.target.value as CamadaMarca["variante"] })} className={CAMPO}>
          <option value="simbolo">Símbolo</option>
          <option value="circulo">Símbolo no círculo</option>
          <option value="nome">Símbolo com o nome</option>
        </select>
      </label>
      <div>
        <p className="text-ink-soft">Cor</p>
        <Cores valor={c.cor} mudar={(cor) => mudar({ cor })} />
      </div>
      {c.variante === "circulo" && (
        <div>
          <p className="text-ink-soft">Fundo do círculo</p>
          <Cores valor={c.fundo} mudar={(fundo) => mudar({ fundo })} />
        </div>
      )}
    </div>
  );
}

interface Passo {
  doc: Documento;
  rotulo: string;
}

/** O nome de um passo do histórico, tirado da diferença entre o antes e o depois. */
function rotular(antes: Documento, depois: Documento): string {
  if (antes.w !== depois.w || antes.h !== depois.h) return "Mudou o formato";
  if (depois.camadas.length > antes.camadas.length) {
    const nova = depois.camadas.find((c) => !antes.camadas.some((k) => k.id === c.id));
    return `Acrescentou: ${nova ? nomeDaCamada(nova) : "camada"}`;
  }
  if (depois.camadas.length < antes.camadas.length) {
    const saiu = antes.camadas.find((c) => !depois.camadas.some((k) => k.id === c.id));
    return `Apagou: ${saiu ? nomeDaCamada(saiu) : "camada"}`;
  }
  if (antes.fundo !== depois.fundo) return "Mudou o fundo";
  if (antes.camadas.some((c, i) => depois.camadas[i]?.id !== c.id)) return "Mudou a ordem";
  const mudou = depois.camadas.find((c, i) => c !== antes.camadas[i]);
  if (!mudou) return "Mudança";
  const velho = antes.camadas.find((c) => c.id === mudou.id);
  if (velho && velho.oculta !== mudou.oculta) return `${mudou.oculta ? "Escondeu" : "Mostrou"}: ${nomeDaCamada(mudou)}`;
  if (velho && velho.travada !== mudou.travada) return `${mudou.travada ? "Travou" : "Destravou"}: ${nomeDaCamada(mudou)}`;
  return `Editou: ${nomeDaCamada(mudou)}`;
}
