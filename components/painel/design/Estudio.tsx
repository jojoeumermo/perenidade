// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { rpc } from "@/lib/backend";
import type { Me } from "@/lib/backend";
import { textoDoErro } from "../comum";
import { Icone } from "./Icone";
import { AVISO_DO_LABORATORIO, citaOInstituto, paraOLaboratorio } from "./laboratorio";
import { type Modelo, paginasDoModelo } from "./modelos";
import {
  adaptar,
  type Alca,
  alcas,
  alturaDoTexto,
  caixa,
  caixaDeVarias,
  type Camada,
  camadaEm,
  camadasEm,
  type CamadaImagem,
  type CamadaTexto,
  carregarImagem,
  desenhar,
  desenharAjudas,
  desenharSelecao,
  type Documento,
  documentoVazio,
  formatoDe,
  type FormatoId,
  formatoPorMedida,
  FORMATOS,
  imagem,
  imagemPronta,
  imagensDo,
  miniatura,
  modoLaboratorio,
  nomeDaCamada,
  novoId,
  posicaoDaFoto,
  prepararFontes,
  prepararImagem,
  texto,
  usarVariaveis,
} from "./motor";
import { BarraDoAlto, Trilho, AbasDoCelular } from "./paineis/Barras";
import { Atalhos, Avisos, type AvisoDoEstudio, BarraFlutuante, type Comando, Comandos, MenuDeContexto, ReguaHorizontal, ReguaVertical } from "./paineis/Flutuantes";
import { Gavetas } from "./paineis/Gavetas";
import { Janelas } from "./paineis/Janelas";
import { FolhaDoCelular, PainelDireito } from "./paineis/Propriedades";
import { RodapeDoPalco } from "./paineis/Rodape";
import { aplicarEstilo, CAMPOS_DO_ESTILO, type Projeto, paraProjeto, projetoNovo, variaveisDaPagina } from "./projeto";
import { type AjudasDaTela, ContextoDoEditor, type Editor, type Gaveta, type Janela, useEditor } from "./ui";

/** Como o editor abre: um modelo, uma página em branco, um trabalho guardado, o rascunho do aparelho ou um projeto pronto. */
export type Abertura =
  | { tipo: "modelo"; modelo: Modelo }
  | { tipo: "branco"; formato: FormatoId }
  | { tipo: "trabalho"; id: string; copia?: boolean }
  | { tipo: "rascunho" }
  | { tipo: "projeto"; projeto: Projeto; titulo: string; formato: FormatoId };

interface Passo {
  projeto: Projeto;
  pagina: number;
  rotulo: string;
}

interface Arrasto {
  modo: "mover" | "redimensionar" | "girar" | "escalar" | "enquadre" | "selecao";
  alca?: Alca;
  x0: number;
  y0: number;
  /** As camadas como estavam no começo (para mover em grupo e para o histórico). */
  inicio: Camada[];
  mexeu: boolean;
  caixa?: { x: number; y: number; w: number; h: number };
}

export const CHAVE_DO_RASCUNHO = (usuario: string) => `lucia:estudio-rascunho:${usuario}`;
const CHAVE_DAS_PREFERENCIAS = "lucia:estudio-preferencias";

export interface Rascunho {
  projeto: Projeto;
  titulo: string;
  formato: FormatoId;
  idSalvo: string | null;
  quando: number;
}

/** Lê o rascunho deste aparelho (o que ficou sem guardar na última vez). */
export function lerRascunho(usuario: string): Rascunho | null {
  try {
    const r = JSON.parse(window.localStorage.getItem(CHAVE_DO_RASCUNHO(usuario)) ?? "null") as Rascunho | null;
    return r && r.projeto ? { ...r, projeto: paraProjeto(r.projeto) } : null;
  } catch {
    return null;
  }
}

const AJUDAS_PADRAO: AjudasDaTela = { instagram: false, margens: false, grade: false, reguas: false, oito: true };
function lerPreferencias(): { ajudas: AjudasDaTela; simples: boolean; tema: "" | "claro" | "escuro" } {
  const padrao = { ajudas: AJUDAS_PADRAO, simples: false, tema: "" as const };
  try {
    const p = JSON.parse(window.localStorage.getItem(CHAVE_DAS_PREFERENCIAS) ?? "null");
    return p ? { ajudas: { ...AJUDAS_PADRAO, ...p.ajudas }, simples: Boolean(p.simples), tema: p.tema === "claro" || p.tema === "escuro" ? p.tema : "" } : padrao;
  } catch {
    return padrao;
  }
}

const ajustarAltura = (c: Camada): Camada => (c.tipo === "texto" && !c.ajustar ? { ...c, h: alturaDoTexto(c) } : c);

/** O nome de um passo do histórico, tirado da diferença entre o antes e o depois. */
function rotular(antes: Projeto, depois: Projeto, pagina: number): string {
  if (antes.paginas.length !== depois.paginas.length) return depois.paginas.length > antes.paginas.length ? "Nova página" : "Apagou página";
  if (antes.legenda !== depois.legenda) return "Legenda";
  const a = antes.paginas[pagina];
  const d = depois.paginas[pagina];
  if (!a || !d) return "Mudança";
  if (a.w !== d.w || a.h !== d.h) return "Mudou o formato";
  if (d.camadas.length > a.camadas.length) {
    const nova = d.camadas.find((c) => !a.camadas.some((k) => k.id === c.id));
    return `Acrescentou: ${nova ? nomeDaCamada(nova) : "camada"}`;
  }
  if (d.camadas.length < a.camadas.length) {
    const saiu = a.camadas.find((c) => !d.camadas.some((k) => k.id === c.id));
    return `Apagou: ${saiu ? nomeDaCamada(saiu) : "camada"}`;
  }
  if (a.fundo !== d.fundo) return "Mudou o fundo";
  if (a.camadas.some((c, i) => d.camadas[i]?.id !== c.id)) return "Mudou a ordem";
  const mudou = d.camadas.find((c, i) => c !== a.camadas[i]);
  if (!mudou) return "Mudança";
  const velho = a.camadas.find((c) => c.id === mudou.id);
  if (velho && velho.oculta !== mudou.oculta) return `${mudou.oculta ? "Escondeu" : "Mostrou"}: ${nomeDaCamada(mudou)}`;
  if (velho && velho.travada !== mudou.travada) return `${mudou.travada ? "Travou" : "Destravou"}: ${nomeDaCamada(mudou)}`;
  return `Editou: ${nomeDaCamada(mudou)}`;
}

/** As contagens do site (disciplinas, obras), lidas do próprio site; sem rede, ficam os números guardados. */
async function numerosDoSite(): Promise<Record<string, string>> {
  try {
    const { areaSlugs } = await import("@/lib/areas");
    const r = await fetch("/pt/apoio-numeros.json", { cache: "force-cache", signal: AbortSignal.timeout(8000) });
    const n = r.ok ? ((await r.json()) as { obras?: number; aulas?: number }) : {};
    return { disciplinas: String(areaSlugs.length), ...(n.obras ? { obras: String(n.obras) } : {}), ...(n.aulas ? { aulas: String(n.aulas) } : {}) };
  } catch {
    return {};
  }
}

const MARGEM_DO_PALCO = 56;
const CABECA_DO_PALCO = 64;

/**
 * O estúdio rápido: o "Canva" do instituto, em tela cheia dentro do painel. Barra do alto (título, guardado,
 * desfazer, zoom, pré-visualizar, baixar, guardar), trilho de ícones com as gavetas (modelos, texto, elementos,
 * imagens, fundo, trabalhos), o palco escuro com a arte, a barra de texto flutuante, e à direita as propriedades e
 * as camadas. No celular, abas embaixo e uma folha com os controles da camada.
 */
export function Estudio({ me, abertura, fechar, laboratorio = false }: { me: Me; abertura: Abertura; fechar: (guardado: boolean) => void; laboratorio?: boolean }) {
  const [projeto, setProjetoBruto] = useState<Projeto>(() => projetoNovo([documentoVazio("post")]));
  const [pagina, setPagina] = useState(0);
  const [titulo, setTitulo] = useState("Sem título");
  const [formato, setFormato] = useState<FormatoId>("post");
  const [idSalvo, setIdSalvo] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<number | null>(null);
  const [mexido, setMexido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [selecao, setSelecao] = useState<string[]>([]);
  const [gaveta, setGaveta] = useState<Gaveta>("modelos");
  const [janela, setJanela] = useState<Janela>(null);
  // O estúdio só abre depois de um clique (nunca no servidor): dá para ler as preferências já no começo.
  const [prefs] = useState(lerPreferencias);
  const [ajudas, setAjudasBruto] = useState<AjudasDaTela>(prefs.ajudas);
  const [simples, setSimplesBruto] = useState(prefs.simples);
  const [temaDaInterface, setTemaDaInterface] = useState<"" | "claro" | "escuro">(prefs.tema);
  const [foco, setFoco] = useState(false);
  const [ajuste, setAjuste] = useState(0.4);
  const [zoomManual, setZoomManual] = useState<number | null>(null);
  const [ferramenta, setFerramenta] = useState<"mover" | "texto" | "mao">("mover");
  const [guias, setGuias] = useState<{ v: number[]; h: number[] } | null>(null);
  const [marquise, setMarquise] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [reenquadrar, setReenquadrar] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [avisos, setAvisos] = useState<AvisoDoEstudio[]>([]);
  const [andamento, setAndamento] = useState<{ f: number; rotulo: string } | null>(null);
  const [fotoEmEdicao, setFotoEmEdicao] = useState<string | null>(null);
  const [celular, setCelular] = useState(false);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [desenhoPedido, setDesenhoPedido] = useState(0);
  const [pegando, setPegando] = useState(false);
  const [tamanhoDoPalco, setTamanhoDoPalco] = useState({ w: 800, h: 600 });
  const historico = useRef<{ passado: Passo[]; futuro: Passo[] }>({ passado: [], futuro: [] });
  const [passos, setPassos] = useState<string[]>([]);
  const [refaziveis, setRefaziveis] = useState(0);
  const tela = useRef<HTMLCanvasElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const arrasto = useRef<Arrasto | null>(null);
  const mao = useRef<{ x0: number; y0: number; sl: number; st: number } | null>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ d: number; escala: number } | null>(null);
  const espaco = useRef(false);
  const ancora = useRef<{ dx: number; dy: number; px: number; py: number } | null>(null);
  const pegarCorRef = useRef<((cor: string) => void) | null>(null);
  const area = useRef<Camada[] | null>(null);
  const estiloCopiado = useRef<Partial<Camada> | null>(null);
  const focoPeloMouse = useRef(false);
  const projetoRef = useRef(projeto);
  const paginaRef = useRef(pagina);
  // As páginas que vieram de um modelo e ninguém mexeu (cada edição cria um objeto novo, que não está aqui).
  const intactas = useRef(new WeakSet<Documento>());
  useEffect(() => {
    projetoRef.current = projeto;
    paginaRef.current = pagina;
  }, [projeto, pagina]);
  // No laboratório público, a marca do instituto não é desenhada (veja laboratorio.ts).
  useEffect(() => {
    modoLaboratorio(laboratorio);
    return () => modoLaboratorio(false);
  }, [laboratorio]);

  const doc = projeto.paginas[Math.min(pagina, projeto.paginas.length - 1)] ?? projeto.paginas[0];
  const escala = zoomManual ?? ajuste;
  const [dpr] = useState(() => Math.min(2, window.devicePixelRatio || 1));
  const vars = useMemo(() => variaveisDaPagina(projeto, pagina), [projeto, pagina]);
  // As medidas dos textos dependem das variáveis da página aberta ({pagina}, {link}...).
  usarVariaveis(vars);
  const selecionadas = useMemo(() => doc.camadas.filter((c) => selecao.includes(c.id)), [doc, selecao]);
  const camada = selecionadas.length === 1 ? selecionadas[0] : null;

  // ───── Avisos ─────
  const avisar = useCallback((mensagem: string, tipo: AvisoDoEstudio["tipo"] = "ok") => {
    const id = novoId();
    setAvisos((lista) => [...lista.slice(-3), { id, mensagem, tipo }]);
    window.setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), tipo === "erro" ? 7000 : 4200);
  }, []);
  const progresso = useCallback((f: number | null, rotulo = "") => setAndamento(f === null ? null : { f, rotulo }), []);

  // ───── Histórico ─────
  const sincronizar = useCallback(
    () =>
      window.setTimeout(() => {
        setPassos(historico.current.passado.map((p) => p.rotulo));
        setRefaziveis(historico.current.futuro.length);
      }, 0),
    [],
  );
  const setProjeto = useCallback(
    (f: (p: Projeto) => Projeto, lembrar = true, rotulo?: string) => {
      setProjetoBruto((atual) => {
        const novo = f(atual);
        if (lembrar && novo !== atual) {
          historico.current.passado = [...historico.current.passado.slice(-79), { projeto: atual, pagina: paginaRef.current, rotulo: rotulo ?? rotular(atual, novo, paginaRef.current) }];
          historico.current.futuro = [];
        }
        return novo;
      });
      if (lembrar) {
        setMexido(true);
        sincronizar();
      }
    },
    [sincronizar],
  );
  const setDoc = useCallback(
    (f: (d: Documento) => Documento, lembrar = true, rotulo?: string) => setProjeto((p) => ({ ...p, paginas: p.paginas.map((d, i) => (i === paginaRef.current ? f(d) : d)) }), lembrar, rotulo),
    [setProjeto],
  );
  const desfazer = useCallback(() => {
    const anterior = historico.current.passado.pop();
    if (!anterior) return;
    setProjetoBruto((atual) => {
      historico.current.futuro.push({ projeto: atual, pagina: paginaRef.current, rotulo: anterior.rotulo });
      return anterior.projeto;
    });
    setPagina(Math.min(anterior.pagina, anterior.projeto.paginas.length - 1));
    setMexido(true);
    sincronizar();
  }, [sincronizar]);
  const refazer = useCallback(() => {
    const proximo = historico.current.futuro.pop();
    if (!proximo) return;
    setProjetoBruto((atual) => {
      historico.current.passado.push({ projeto: atual, pagina: paginaRef.current, rotulo: proximo.rotulo });
      return proximo.projeto;
    });
    setPagina(Math.min(proximo.pagina, proximo.projeto.paginas.length - 1));
    setMexido(true);
    sincronizar();
  }, [sincronizar]);
  const voltarAte = useCallback(
    (indice: number) => {
      for (let i = historico.current.passado.length - 1; i >= indice; i--) desfazer();
    },
    [desfazer],
  );

  // ───── Abrir ─────
  const abrir = useCallback(
    async (a: Abertura) => {
      await prepararFontes();
      setPronto(false);
      let p: Projeto | null = null;
      let t = "Sem título";
      let f: FormatoId = "post";
      let id: string | null = null;
      let quando: number | null = null;
      try {
        if (a.tipo === "modelo") {
          p = projetoNovo(paginasDoModelo(a.modelo));
          t = a.modelo.nome;
          f = a.modelo.formato;
          if (!laboratorio) void rpc("design_modelo_usado", { p_modelo: a.modelo.id }).catch(() => undefined);
        } else if (a.tipo === "branco") {
          p = projetoNovo([documentoVazio(a.formato)]);
          f = a.formato;
        } else if (a.tipo === "rascunho") {
          const r = lerRascunho(me.id);
          if (r) {
            p = r.projeto;
            t = r.titulo;
            f = r.formato;
            id = r.idSalvo;
          }
        } else if (a.tipo === "projeto") {
          p = a.projeto;
          t = a.titulo;
          f = a.formato;
        } else {
          const r = await rpc<{ id: string; titulo: string; formato: string; dados: unknown; atualizado_em: string }>("design_ver", { p_id: a.id });
          p = paraProjeto(r.dados);
          t = a.copia ? `Cópia de ${r.titulo}`.slice(0, 120) : r.titulo;
          f = (formatoDe(r.formato)?.id ?? formatoPorMedida(p.paginas[0]?.w ?? 1080, p.paginas[0]?.h ?? 1350)?.id ?? "post") as FormatoId;
          id = a.copia ? null : r.id;
          quando = a.copia ? null : new Date(r.atualizado_em).getTime();
        }
      } catch (erro) {
        avisar(`Não deu para abrir: ${textoDoErro(erro)}`, "erro");
      }
      const aberto = p && p.paginas.length ? p : projetoNovo([documentoVazio(f)]);
      // No laboratório: sem a marca e sem o endereço do instituto, mesmo num arquivo que venha do painel.
      const base = laboratorio ? paraOLaboratorio(aberto) : aberto;
      const recalcular = (q: Projeto): Projeto => ({
        ...q,
        paginas: q.paginas.map((d, i) => {
          usarVariaveis(variaveisDaPagina(q, i));
          return { ...d, id: d.id ?? novoId(), camadas: d.camadas.map(ajustarAltura) };
        }),
      });
      const final = recalcular(base);
      if (a.tipo === "modelo" || a.tipo === "branco") for (const d of final.paginas) intactas.current.add(d);
      historico.current = { passado: [], futuro: [] };
      setPassos([]);
      setRefaziveis(0);
      setProjetoBruto(final);
      setTitulo(t);
      setFormato(f);
      setIdSalvo(id);
      setSalvoEm(quando);
      setPagina(0);
      setSelecao([]);
      setZoomManual(null);
      setMexido(a.tipo === "rascunho" || (a.tipo === "trabalho" && Boolean(a.copia)));
      setPronto(true);
      // Os números do site (disciplinas, obras) chegam depois e entram nas variáveis que ainda têm o valor do modelo.
      if (!laboratorio) void numerosDoSite().then((numeros) => {
        if (!Object.keys(numeros).length) return;
        setProjetoBruto((atual) => {
          const variaveis = { ...atual.variaveis };
          let mudou = false;
          for (const [k, v] of Object.entries(numeros))
            if ((!variaveis[k] || variaveis[k] === "61" || variaveis[k] === "300") && variaveis[k] !== v) {
              variaveis[k] = v;
              mudou = true;
            }
          return mudou ? recalcular({ ...atual, variaveis }) : atual;
        });
      });
    },
    [me.id, avisar, laboratorio],
  );
  useEffect(() => {
    const id = window.setTimeout(() => void abrir(abertura), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───── Preferências e tela ─────
  const setAjudas = useCallback((f: (a: AjudasDaTela) => AjudasDaTela) => setAjudasBruto(f), []);
  const setSimples = useCallback((s: boolean) => setSimplesBruto(s), []);
  useEffect(() => {
    if (!pronto) return;
    try {
      window.localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ ajudas, simples, tema: temaDaInterface }));
    } catch {
      /* sem armazenamento: as preferências valem só agora */
    }
  }, [ajudas, simples, temaDaInterface, pronto]);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 767.98px)");
    const ver = () => {
      setCelular(m.matches);
      if (m.matches) setGaveta(null);
    };
    ver();
    m.addEventListener("change", ver);
    return () => m.removeEventListener("change", ver);
  }, []);
  // A página do painel não rola enquanto o estúdio está aberto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  // O encaixe: a página cabe no palco.
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const medir = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Medida de zero (a tela ainda montando, a aba escondida): espera a próxima.
      if (w < 60 || h < 60) return;
      // Só muda com diferença de verdade: um pixel a mais ou a menos (barra de rolagem, arredondamento) fazia a página
      // ser recentralizada sem parar com o zoom bem afastado, e a arte tremia.
      setTamanhoDoPalco((antes) => (Math.abs(antes.w - w) > 2 || Math.abs(antes.h - h) > 2 ? { w, h } : antes));
      const folgaV = CABECA_DO_PALCO + (celular ? 24 : 92);
      setAjuste(Math.max(0.05, Math.min((w - 2 * (celular ? 16 : MARGEM_DO_PALCO)) / doc.w, (h - folgaV) / doc.h, 2)));
    };
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, [doc.w, doc.h, celular]);

  // Aproximar mantendo o ponto do mouse no lugar.
  const zoomEm = useCallback(
    (nova: number, px?: number, py?: number) => {
      const c = tela.current;
      const limitada = Math.min(8, Math.max(0.05, nova));
      if (c && px !== undefined && py !== undefined) {
        const r = c.getBoundingClientRect();
        ancora.current = { dx: (px - r.left) / escala, dy: (py - r.top) / escala, px, py };
      }
      setZoomManual(limitada);
    },
    [escala],
  );
  useLayoutEffect(() => {
    const a = ancora.current;
    const el = palco.current;
    const c = tela.current;
    if (!a || !el || !c) return;
    ancora.current = null;
    const r = c.getBoundingClientRect();
    el.scrollLeft += r.left + a.dx * escala - a.px;
    el.scrollTop += r.top + a.dy * escala - a.py;
  }, [escala]);

  // ───── Desenho ─────
  useEffect(() => {
    const el = tela.current;
    if (!el || !pronto) return;
    const k = escala * dpr;
    const pintar = () => {
      usarVariaveis(vars);
      const visivel = editando ? { ...doc, camadas: doc.camadas.filter((c) => c.id !== editando) } : doc;
      desenhar(el, visivel, k);
      const ctx = el.getContext("2d");
      if (!ctx) return;
      desenharAjudas(ctx, doc, k, ajudas, dpr);
      if (!editando) desenharSelecao(ctx, selecionadas.filter((c) => !c.oculta), k, dpr);
      if (guias) {
        ctx.save();
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.strokeStyle = "#c21f16";
        ctx.lineWidth = dpr / k;
        ctx.setLineDash([(4 * dpr) / k, (3 * dpr) / k]);
        for (const x of guias.v) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, doc.h);
          ctx.stroke();
        }
        for (const y of guias.h) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(doc.w, y);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (marquise) {
        ctx.save();
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.fillStyle = "rgba(110, 31, 26, 0.08)";
        ctx.strokeStyle = "#6e1f1a";
        ctx.lineWidth = dpr / k;
        ctx.fillRect(marquise.x, marquise.y, marquise.w, marquise.h);
        ctx.strokeRect(marquise.x, marquise.y, marquise.w, marquise.h);
        ctx.restore();
      }
    };
    let quadro = requestAnimationFrame(pintar);
    const faltam = imagensDo(doc).filter((src) => !imagemPronta(src));
    if (faltam.length)
      void Promise.all(faltam.map((src) => carregarImagem(src).catch(() => null))).then(() => {
        cancelAnimationFrame(quadro);
        quadro = requestAnimationFrame(pintar);
      });
    return () => cancelAnimationFrame(quadro);
  }, [doc, escala, dpr, selecionadas, guias, marquise, ajudas, pronto, editando, desenhoPedido, vars]);

  // ───── Guardar (na conta) e rascunho (no aparelho) ─────
  const guardar = useCallback(
    async (silencioso = false) => {
      if (guardando) return;
      if (laboratorio) {
        // No laboratório não há conta: o trabalho fica neste aparelho (e sai pelo Baixar).
        try {
          window.localStorage.setItem(CHAVE_DO_RASCUNHO(me.id), JSON.stringify({ projeto: projetoRef.current, titulo, formato, idSalvo: null, quando: Date.now() } satisfies Rascunho));
          setSalvoEm(Date.now());
          setMexido(false);
          if (!silencioso) avisar("Guardado neste aparelho. Para levar a arte, use Baixar.");
        } catch {
          if (!silencioso) avisar("O aparelho não tem espaço para guardar: baixe a arte para não perder.", "erro");
        }
        return;
      }
      setGuardando(true);
      try {
        const p = projetoRef.current;
        usarVariaveis(variaveisDaPagina(p, 0));
        const mini = await miniatura(p.paginas[0]);
        usarVariaveis(variaveisDaPagina(p, paginaRef.current));
        const r = await rpc<{ id?: string }>("design_salvar", {
          p_id: idSalvo,
          p: { titulo: titulo.trim() || "Sem título", formato, largura: p.paginas[0].w, altura: p.paginas[0].h, dados: p, miniatura: mini, compartilhado: true, legenda: p.legenda.slice(0, 2200), paginas: p.paginas.length },
        });
        if (r?.id) {
          setIdSalvo(r.id);
          setSalvoEm(Date.now());
          setMexido(false);
          try {
            window.localStorage.removeItem(CHAVE_DO_RASCUNHO(me.id));
          } catch {
            /* sem armazenamento */
          }
          if (!silencioso) avisar("Guardado na sua conta.");
        }
      } catch (erro) {
        if (!silencioso) avisar(`Não deu para guardar: ${textoDoErro(erro)}`, "erro");
      } finally {
        setGuardando(false);
      }
    },
    [guardando, idSalvo, titulo, formato, me.id, avisar, laboratorio],
  );
  // O rascunho fica no aparelho a cada mudança (com uma pequena espera), para nada se perder se a aba fechar.
  useEffect(() => {
    if (!pronto || !mexido) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(CHAVE_DO_RASCUNHO(me.id), JSON.stringify({ projeto, titulo, formato, idSalvo, quando: Date.now() } satisfies Rascunho));
      } catch {
        /* sem espaço: o rascunho não fica, mas o trabalho continua na tela */
      }
    }, 1200);
    return () => window.clearTimeout(id);
  }, [projeto, titulo, formato, idSalvo, mexido, pronto, me.id]);
  // Trabalho que já está na conta: guarda sozinho 20 segundos depois da última mudança.
  useEffect(() => {
    if (!pronto || !mexido || !idSalvo) return;
    const id = window.setTimeout(() => void guardar(true), 20_000);
    return () => window.clearTimeout(id);
  }, [projeto, titulo, mexido, idSalvo, pronto, guardar]);
  useEffect(() => {
    if (!mexido) return;
    const avisarAoSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisarAoSair);
    return () => window.removeEventListener("beforeunload", avisarAoSair);
  }, [mexido]);

  // ───── Camadas ─────
  const mudarCamada = useCallback((id: string, m: Partial<Camada>, lembrar = true) => setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (c.id === id ? ajustarAltura({ ...c, ...m } as Camada) : c)) }), lembrar), [setDoc]);
  const mudar = useCallback(
    (m: Partial<Camada>, lembrar = true) => {
      if (!selecao.length) return;
      const ehEstilo = (k: string) => (CAMPOS_DO_ESTILO as readonly string[]).includes(k);
      // Texto ligado a um estilo: a mudança de tipografia vale para o estilo inteiro (todas as páginas).
      if (camada?.tipo === "texto" && camada.estilo && Object.keys(m).some(ehEstilo)) {
        const estilo = projeto.estilos.find((e) => e.id === camada.estilo);
        if (estilo) {
          const proporcao = camada.tamanho / estilo.tamanho || 1;
          const tamanho = (m as Partial<CamadaTexto>).tamanho;
          const novo = { ...estilo, ...Object.fromEntries(Object.entries(m).filter(([k]) => ehEstilo(k))) };
          if (typeof tamanho === "number") novo.tamanho = tamanho / proporcao;
          const resto = Object.fromEntries(Object.entries(m).filter(([k]) => !ehEstilo(k)));
          setProjeto(
            (p) => {
              const comEstilo = aplicarEstilo(p, novo, ajustarAltura);
              return { ...comEstilo, paginas: comEstilo.paginas.map((d, i) => (i === paginaRef.current ? { ...d, camadas: d.camadas.map((c) => (c.id === camada.id ? ajustarAltura({ ...c, ...resto, ...(typeof tamanho === "number" ? { tamanho } : {}) } as Camada) : c)) } : d)) };
            },
            lembrar,
            `Estilo: ${estilo.nome}`,
          );
          return;
        }
      }
      setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (selecao.includes(c.id) ? ajustarAltura({ ...c, ...m } as Camada) : c)) }), lembrar);
    },
    [selecao, camada, projeto.estilos, setProjeto, setDoc],
  );
  const selecionar = useCallback((ids: string[]) => {
    setSelecao(ids);
    if (ids.length) setFolhaAberta(true);
  }, []);
  const acrescentar = useCallback(
    (nova: Camada | Camada[]) => {
      const lista = (Array.isArray(nova) ? nova : [nova]).map(ajustarAltura);
      setDoc((d) => ({ ...d, camadas: [...d.camadas, ...lista] }));
      setSelecao(lista.map((c) => c.id));
    },
    [setDoc],
  );
  const centro = useCallback((w: number, h: number) => ({ x: Math.round(doc.w / 2 - w / 2), y: Math.round(doc.h / 2 - h / 2) }), [doc.w, doc.h]);

  // ───── Páginas ─────
  const irParaPagina = useCallback((i: number) => {
    setPagina(i);
    setSelecao([]);
    setEditando(null);
    setReenquadrar(null);
  }, []);
  const novaPagina = useCallback(
    (nova?: Documento, depois = paginaRef.current) => {
      const atual = projetoRef.current.paginas[paginaRef.current];
      const d = nova ?? { ...documentoVazio(formato), w: atual.w, h: atual.h, fundo: { ...atual.fundo }, camadas: [] };
      setProjeto((p) => {
        const paginas = [...p.paginas];
        paginas.splice(depois + 1, 0, { ...d, id: novoId() });
        return { ...p, paginas };
      }, true, "Nova página");
      irParaPagina(depois + 1);
    },
    [formato, setProjeto, irParaPagina],
  );

  const ordenar = useCallback(
    (para: "frente" | "tras" | "topo" | "fundo") => {
      if (!selecao.length) return;
      setDoc((d) => {
        const fica = d.camadas.filter((c) => !selecao.includes(c.id));
        const vai = d.camadas.filter((c) => selecao.includes(c.id));
        const primeiro = d.camadas.findIndex((c) => selecao.includes(c.id));
        const posicao = para === "topo" ? fica.length : para === "fundo" ? 0 : para === "frente" ? Math.min(fica.length, primeiro + 1) : Math.max(0, primeiro - 1);
        fica.splice(posicao, 0, ...vai);
        return { ...d, camadas: fica };
      });
    },
    [selecao, setDoc],
  );
  const alinhar = useCallback(
    (como: "esq" | "centro" | "dir" | "cima" | "meio" | "baixo") => {
      if (!selecionadas.length) return;
      // Uma camada: em relação à página. Várias: em relação à caixa que contém todas.
      const alvo = selecionadas.length === 1 ? { x: 0, y: 0, w: doc.w, h: doc.h } : caixaDeVarias(selecionadas);
      setDoc(
        (d) => ({
          ...d,
          camadas: d.camadas.map((c) => {
            if (!selecao.includes(c.id)) return c;
            const b = caixa(c);
            const dx = como === "esq" ? alvo.x - b.x : como === "centro" ? alvo.x + alvo.w / 2 - (b.x + b.w / 2) : como === "dir" ? alvo.x + alvo.w - (b.x + b.w) : 0;
            const dy = como === "cima" ? alvo.y - b.y : como === "meio" ? alvo.y + alvo.h / 2 - (b.y + b.h / 2) : como === "baixo" ? alvo.y + alvo.h - (b.y + b.h) : 0;
            return { ...c, x: Math.round(c.x + dx), y: Math.round(c.y + dy) };
          }),
        }),
        true,
        "Alinhou",
      );
    },
    [selecionadas, selecao, doc.w, doc.h, setDoc],
  );
  const distribuir = useCallback(
    (eixo: "h" | "v") => {
      if (selecionadas.length < 3) return;
      const lista = [...selecionadas].sort((a, b) => (eixo === "h" ? caixa(a).x - caixa(b).x : caixa(a).y - caixa(b).y));
      const caixas = lista.map(caixa);
      const total = caixas.reduce((s, b) => s + (eixo === "h" ? b.w : b.h), 0);
      const ultima = caixas[caixas.length - 1];
      const inicio = eixo === "h" ? caixas[0].x : caixas[0].y;
      const fim = eixo === "h" ? ultima.x + ultima.w : ultima.y + ultima.h;
      const vao = (fim - inicio - total) / (lista.length - 1);
      let cursor = inicio;
      const novos = new Map<string, number>();
      lista.forEach((c, i) => {
        const b = caixas[i];
        novos.set(c.id, (eixo === "h" ? c.x - b.x : c.y - b.y) + cursor);
        cursor += (eixo === "h" ? b.w : b.h) + vao;
      });
      setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (novos.has(c.id) ? { ...c, [eixo === "h" ? "x" : "y"]: Math.round(novos.get(c.id)!) } : c)) }), true, "Distribuiu");
    },
    [selecionadas, setDoc],
  );

  const acoes = useMemo(() => {
    const sel = () => doc.camadas.filter((c) => selecao.includes(c.id));
    const novoGrupo = (mapa: Map<string, string>, g?: string) => {
      if (!g) return undefined;
      if (!mapa.has(g)) mapa.set(g, novoId());
      return mapa.get(g);
    };
    const a: Record<string, () => void> = {
      desfazer,
      refazer,
      duplicar: () => {
        const lista = sel();
        if (!lista.length) return;
        const grupos = new Map<string, string>();
        const copias = lista.map((c) => ({ ...c, id: novoId(), x: c.x + 24, y: c.y + 24, grupo: novoGrupo(grupos, c.grupo) }));
        setDoc((d) => ({ ...d, camadas: [...d.camadas, ...copias] }), true, `Duplicou: ${copias.length > 1 ? `${copias.length} camadas` : nomeDaCamada(copias[0])}`);
        setSelecao(copias.map((c) => c.id));
      },
      apagar: () => {
        if (!selecao.length) return;
        setDoc((d) => ({ ...d, camadas: d.camadas.filter((c) => !selecao.includes(c.id)) }));
        setSelecao([]);
      },
      copiar: () => {
        const lista = sel();
        if (!lista.length) return;
        area.current = lista;
        void navigator.clipboard?.writeText(JSON.stringify({ estudioLucia: 1, camadas: lista })).catch(() => undefined);
        avisar(lista.length > 1 ? `${lista.length} camadas copiadas.` : "Camada copiada.", "info");
      },
      recortar: () => {
        const lista = sel();
        if (!lista.length) return;
        area.current = lista;
        void navigator.clipboard?.writeText(JSON.stringify({ estudioLucia: 1, camadas: lista })).catch(() => undefined);
        setDoc((d) => ({ ...d, camadas: d.camadas.filter((c) => !selecao.includes(c.id)) }), true, "Recortou");
        setSelecao([]);
      },
      colar: () => {
        const colarLista = (lista: Camada[]) => {
          const grupos = new Map<string, string>();
          acrescentar(lista.map((c) => ({ ...c, id: novoId(), x: c.x + 16, y: c.y + 16, grupo: novoGrupo(grupos, c.grupo) })));
        };
        if (area.current) return colarLista(area.current);
        void navigator.clipboard
          ?.readText()
          .then((t) => {
            try {
              const dados = JSON.parse(t) as { estudioLucia?: number; camadas?: Camada[] };
              if (dados.estudioLucia && Array.isArray(dados.camadas)) return colarLista(dados.camadas);
            } catch {
              /* texto comum */
            }
            if (t.trim()) acrescentar(texto({ ...centro(doc.w * 0.8, 100), w: doc.w * 0.8, texto: t.slice(0, 2000), tamanho: Math.round(doc.w / 28), peso: 400 }));
          })
          .catch(() => undefined);
      },
      copiarEstilo: () => {
        const c = sel()[0];
        if (!c) return;
        const copia: Record<string, unknown> = { ...c };
        for (const k of ["id", "x", "y", "w", "h", "rot", "nome", "texto", "src", "grupo", "credito", "recorte", "enquadre", "fundoRemovido", "conteudo", "conteudo2", "legendaFoto"]) delete copia[k];
        estiloCopiado.current = copia as Partial<Camada>;
        avisar("Estilo copiado: use Ctrl+Alt+V em outra camada do mesmo tipo.", "info");
      },
      colarEstilo: () => {
        const e = estiloCopiado.current;
        if (!e) return;
        setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (selecao.includes(c.id) && c.tipo === e.tipo ? ajustarAltura({ ...c, ...e, tipo: c.tipo } as Camada) : c)) }), true, "Colou o estilo");
      },
      agrupar: () => {
        if (selecao.length < 2) return;
        const g = novoId();
        setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (selecao.includes(c.id) ? { ...c, grupo: g } : c)) }), true, "Agrupou");
      },
      desagrupar: () => setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (selecao.includes(c.id) ? { ...c, grupo: undefined } : c)) }), true, "Desagrupou"),
      tudo: () => setSelecao(doc.camadas.filter((c) => !c.travada && !c.oculta).map((c) => c.id)),
      travar: () => {
        const travar = sel().some((c) => !c.travada);
        setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (selecao.includes(c.id) ? { ...c, travada: travar } : c)) }));
      },
      esconder: () => setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (selecao.includes(c.id) ? { ...c, oculta: !c.oculta } : c)) })),
      frente: () => ordenar("frente"),
      tras: () => ordenar("tras"),
      topo: () => ordenar("topo"),
      fundo: () => ordenar("fundo"),
      "alinhar-esq": () => alinhar("esq"),
      "alinhar-centro-h": () => alinhar("centro"),
      "alinhar-dir": () => alinhar("dir"),
      "alinhar-topo": () => alinhar("cima"),
      "alinhar-meio": () => alinhar("meio"),
      "alinhar-base": () => alinhar("baixo"),
      "distribuir-h": () => distribuir("h"),
      "distribuir-v": () => distribuir("v"),
      guardar: () => void guardar(),
      baixar: () => setJanela("baixar"),
      previa: () => setJanela("previa"),
      atalhos: () => setJanela("atalhos"),
      comandos: () => setJanela("comandos"),
      conferir: () => setJanela("conferir"),
      encaixar: () => setZoomManual(null),
      cem: () => setZoomManual(1),
      metade: () => setZoomManual(0.5),
      aproximar: () => setZoomManual(Math.min(8, escala * 1.25)),
      afastar: () => setZoomManual(Math.max(0.05, escala / 1.25)),
      foco: () => setFoco((f) => !f),
      instagram: () => setAjudasBruto((x) => ({ ...x, instagram: !x.instagram })),
      grade: () => setAjudasBruto((x) => ({ ...x, grade: !x.grade })),
      margens: () => setAjudasBruto((x) => ({ ...x, margens: !x.margens })),
      reguas: () => setAjudasBruto((x) => ({ ...x, reguas: !x.reguas })),
      oito: () => setAjudasBruto((x) => ({ ...x, oito: !x.oito })),
      temaDaInterface: () => setTemaDaInterface((t) => (t === "escuro" ? "claro" : "escuro")),
      simples: () => setSimplesBruto((s) => !s),
      novaPagina: () => novaPagina(),
      duplicarPagina: () => {
        const original = projeto.paginas[pagina];
        novaPagina({ ...original, camadas: original.camadas.map((c) => ({ ...c, id: novoId() })) }, pagina);
      },
      apagarPagina: () => {
        if (projeto.paginas.length <= 1) return;
        setProjeto((p) => ({ ...p, paginas: p.paginas.filter((_, k) => k !== pagina) }), true, "Apagou página");
        irParaPagina(Math.max(0, Math.min(pagina, projeto.paginas.length - 2)));
      },
      paginaParaTras: () => moverPagina(pagina, pagina - 1),
      paginaParaFrente: () => moverPagina(pagina, pagina + 1),
      proximaPagina: () => irParaPagina(Math.min(projeto.paginas.length - 1, pagina + 1)),
      paginaAnterior: () => irParaPagina(Math.max(0, pagina - 1)),
      versaoB: () => {
        const original = projeto.paginas[pagina];
        setProjeto((p) => {
          const paginas = [...p.paginas];
          paginas[pagina] = { ...original, variante: original.variante || "A" };
          paginas.splice(pagina + 1, 0, { ...original, id: novoId(), variante: "B", camadas: original.camadas.map((c) => ({ ...c, id: novoId() })) });
          return { ...p, paginas };
        }, true, "Versão B");
        irParaPagina(pagina + 1);
        avisar("Versão B criada logo depois desta página. Compare as duas em Pré-visualizar.", "info");
      },
      editarTexto: () => {
        if (camada?.tipo === "texto") setEditando(camada.id);
      },
      reenquadrar: () => {
        if (camada?.tipo === "imagem") setReenquadrar(camada.id);
      },
      editarFoto: () => {
        if (camada?.tipo === "imagem") setFotoEmEdicao(camada.id);
      },
      idioma: () => setJanela("idioma"),
      lote: () => setJanela("lote"),
      historicoDeVersoes: () => setJanela("historico"),
      revisao: () => setJanela("revisao"),
      publicar: () => setJanela("publicar"),
      ferramentaMover: () => setFerramenta("mover"),
      ferramentaTexto: () => setFerramenta("texto"),
      ferramentaMao: () => setFerramenta("mao"),
      sair: () => fechar(!mexido),
    };
    function moverPagina(i: number, para: number) {
      if (para < 0 || para >= projeto.paginas.length) return;
      setProjeto((p) => {
        const paginas = [...p.paginas];
        const [d] = paginas.splice(i, 1);
        paginas.splice(para, 0, d);
        return { ...p, paginas };
      }, true, "Mudou a ordem das páginas");
      irParaPagina(para);
    }
    return a;
  }, [doc, selecao, camada, escala, pagina, projeto.paginas, guardar, desfazer, refazer, mexido, setDoc, setProjeto, acrescentar, avisar, centro, ordenar, alinhar, distribuir, novaPagina, irParaPagina, fechar]);

  const usarModelo = useCallback(
    (m: Modelo, modo: "trocar" | "acrescentar" | "novo") => {
      if (!laboratorio) void rpc("design_modelo_usado", { p_modelo: m.id }).catch(() => undefined);
      const novas = paginasDoModelo(m).map((d) => ({ ...d, id: novoId(), camadas: d.camadas.map(ajustarAltura) }));
      for (const d of novas) intactas.current.add(d);
      const p0 = paginaRef.current;
      if (modo === "trocar") {
        setProjeto((p) => {
          const paginas = [...p.paginas];
          paginas.splice(p0, 1, ...novas);
          return { ...p, paginas };
        }, true, `Modelo: ${m.nome}`);
        if (projetoRef.current.paginas.length === 1) {
          setFormato(m.formato);
          setTitulo((t) => (t === "Sem título" ? m.nome : t));
        }
      } else {
        setProjeto((p) => {
          const paginas = [...p.paginas];
          paginas.splice(p0 + 1, 0, ...novas);
          return { ...p, paginas };
        }, true, `Modelo: ${m.nome}`);
        irParaPagina(p0 + 1);
      }
      setSelecao([]);
      setZoomManual(null);
    },
    [setProjeto, irParaPagina, laboratorio],
  );
  const mudarFormato = useCallback(
    (id: FormatoId, adaptarCamadas: boolean) => {
      const f = formatoDe(id);
      if (!f) return;
      setFormato(id);
      setProjeto((p) => ({ ...p, paginas: p.paginas.map((d) => (d.w === f.w && d.h === f.h ? d : adaptarCamadas ? adaptar(d, f.w, f.h) : { ...d, w: f.w, h: f.h })) }), true, `Formato: ${f.curto}`);
      setZoomManual(null);
    },
    [setProjeto],
  );

  // ───── Imagens que chegam de fora (arrastar, colar) ─────
  const acrescentarArquivo = useCallback(
    async (arquivo: File, em?: { x: number; y: number }) => {
      if (!arquivo.type.startsWith("image/")) return;
      try {
        const src = await prepararImagem(arquivo);
        const img = await carregarImagem(src);
        const w = Math.min(doc.w * 0.6, img.width);
        const h = (w * img.height) / img.width;
        const pos = em ? { x: Math.round(em.x - w / 2), y: Math.round(em.y - h / 2) } : centro(w, h);
        acrescentar(imagem({ ...pos, w, h, src, nome: arquivo.name.slice(0, 40) || "Imagem" }));
      } catch {
        avisar("Não deu para abrir esta imagem.", "erro");
      }
    },
    [doc.w, centro, acrescentar, avisar],
  );
  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      const arquivo = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (arquivo) {
        e.preventDefault();
        void acrescentarArquivo(arquivo);
      }
    };
    window.addEventListener("paste", colar);
    return () => window.removeEventListener("paste", colar);
  }, [acrescentarArquivo]);

  // ───── Teclado ─────
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (janela) return;
      const alvo = e.target as HTMLElement;
      const digitando = alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === "s") {
        e.preventDefault();
        acoes.guardar();
        return;
      }
      if (ctrl && k === "k") {
        e.preventDefault();
        setJanela("comandos");
        return;
      }
      if (digitando) return;
      const fazer = (f: () => void) => {
        e.preventDefault();
        f();
      };
      if (ctrl && k === "z") fazer(e.shiftKey ? refazer : desfazer);
      else if (ctrl && k === "y") fazer(refazer);
      else if (ctrl && e.altKey && k === "c") fazer(acoes.copiarEstilo);
      else if (ctrl && e.altKey && k === "v") fazer(acoes.colarEstilo);
      else if (ctrl && (k === "d" || k === "j")) fazer(acoes.duplicar);
      else if (ctrl && k === "c") fazer(acoes.copiar);
      else if (ctrl && k === "x") fazer(acoes.recortar);
      else if (ctrl && k === "v") fazer(acoes.colar);
      else if (ctrl && k === "g") fazer(e.shiftKey ? acoes.desagrupar : acoes.agrupar);
      else if (ctrl && k === "a") fazer(acoes.tudo);
      else if (ctrl && k === "e") fazer(acoes.baixar);
      else if (ctrl && k === "l") fazer(acoes.travar);
      else if (ctrl && e.shiftKey && k === "h") fazer(acoes.esconder);
      else if (ctrl && e.key === "]") fazer(e.shiftKey ? acoes.topo : acoes.frente);
      else if (ctrl && e.key === "[") fazer(e.shiftKey ? acoes.fundo : acoes.tras);
      else if (ctrl && e.key === "0") fazer(acoes.encaixar);
      else if (ctrl && e.key === "1") fazer(acoes.cem);
      else if (ctrl && (e.key === "=" || e.key === "+")) fazer(acoes.aproximar);
      else if (ctrl && e.key === "-") fazer(acoes.afastar);
      else if (ctrl && e.key === ".") fazer(acoes.foco);
      else if (e.key === "Tab" && !ctrl && !e.altKey && !e.shiftKey && focoPeloMouse.current && alvo === palco.current) fazer(acoes.foco);
      else if (ctrl || e.altKey) return;
      else if (e.key === "?") fazer(acoes.atalhos);
      else if (e.shiftKey && k === "i") fazer(acoes.instagram);
      else if (e.shiftKey && k === "g") fazer(acoes.grade);
      else if (e.shiftKey && k === "m") fazer(acoes.margens);
      else if (e.shiftKey && k === "r") fazer(acoes.reguas);
      else if (k === "v") setFerramenta("mover");
      else if (k === "t") setFerramenta("texto");
      else if (k === "h") setFerramenta("mao");
      else if (k === "p") fazer(acoes.previa);
      else if (e.key === "PageDown") fazer(acoes.proximaPagina);
      else if (e.key === "PageUp") fazer(acoes.paginaAnterior);
      else if (e.key === " " && !e.repeat) fazer(() => (espaco.current = true));
      else if ((e.key === "Delete" || e.key === "Backspace") && selecao.length) fazer(acoes.apagar);
      else if (e.key === "Enter" && camada?.tipo === "texto") fazer(acoes.editarTexto);
      else if (e.key === "Enter" && camada?.tipo === "imagem") fazer(() => setReenquadrar((r) => (r ? null : camada.id)));
      else if (e.key === "Escape") {
        if (reenquadrar) setReenquadrar(null);
        else if (menu) setMenu(null);
        else if (foco) setFoco(false);
        else setSelecao([]);
        pegarCorRef.current = null;
        setPegando(false);
      } else if (selecao.length && /^Arrow/.test(e.key)) {
        e.preventDefault();
        const passo = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowRight" ? passo : e.key === "ArrowLeft" ? -passo : 0;
        const dy = e.key === "ArrowDown" ? passo : e.key === "ArrowUp" ? -passo : 0;
        setDoc((d) => ({ ...d, camadas: d.camadas.map((c) => (selecao.includes(c.id) && !c.travada ? { ...c, x: c.x + dx, y: c.y + dy } : c)) }), true, "Moveu com as setas");
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
  }, [acoes, janela, selecao, camada, reenquadrar, menu, foco, desfazer, refazer, setDoc]);

  // ───── Mouse e toque ─────
  const ponto = (e: { clientX: number; clientY: number }) => {
    const r = tela.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / escala, y: (e.clientY - r.top) / escala };
  };
  /** As camadas que andam juntas com esta (o grupo dela), a menos que Ctrl esteja apertado. */
  const comGrupo = (c: Camada, sozinha: boolean) => (sozinha || !c.grupo ? [c.id] : doc.camadas.filter((k) => k.grupo === c.grupo).map((k) => k.id));

  function apontar(e: React.PointerEvent<HTMLCanvasElement>) {
    focoPeloMouse.current = true;
    palco.current?.focus({ preventScroll: true });
    setMenu(null);
    if (e.pointerType === "touch") {
      toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.current.size === 2) {
        // Dois dedos: pinça para aproximar e arrastar a tela.
        const [a, b] = [...toques.current.values()];
        pinca.current = { d: Math.hypot(a.x - b.x, a.y - b.y), escala };
        mao.current = palco.current ? { x0: (a.x + b.x) / 2, y0: (a.y + b.y) / 2, sl: palco.current.scrollLeft, st: palco.current.scrollTop } : null;
        arrasto.current = null;
        return;
      }
    }
    const p = ponto(e);
    if (pegarCorRef.current) {
      const ctx = tela.current?.getContext("2d");
      if (ctx) {
        const r = tela.current!.getBoundingClientRect();
        const [rr, gg, bb] = ctx.getImageData(Math.round((e.clientX - r.left) * dpr), Math.round((e.clientY - r.top) * dpr), 1, 1).data;
        pegarCorRef.current(`#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
      }
      pegarCorRef.current = null;
      setPegando(false);
      return;
    }
    if (espaco.current || ferramenta === "mao" || e.button === 1) {
      if (palco.current) mao.current = { x0: e.clientX, y0: e.clientY, sl: palco.current.scrollLeft, st: palco.current.scrollTop };
      tela.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 2) return;
    if (ferramenta === "texto") {
      const largura = Math.max(120, Math.min(doc.w - p.x, doc.w * 0.6));
      const nova = texto({ x: Math.round(p.x), y: Math.round(p.y), w: largura, texto: "Escreva aqui", fonte: "serifa", tamanho: Math.round(doc.w / 100) * 4, peso: 400 });
      acrescentar(nova);
      setFerramenta("mover");
      window.setTimeout(() => setEditando(nova.id), 30);
      return;
    }
    if (reenquadrar) {
      const alvoR = doc.camadas.find((c) => c.id === reenquadrar);
      if (alvoR && camadasEm(doc, p.x, p.y).some((c) => c.id === reenquadrar)) {
        arrasto.current = { modo: "enquadre", x0: p.x, y0: p.y, inicio: [alvoR], mexeu: false };
        tela.current?.setPointerCapture(e.pointerId);
        return;
      }
      setReenquadrar(null);
    }
    // Alças da seleção (uma camada: redimensiona e gira; várias: escala o conjunto).
    const livres = selecionadas.filter((c) => !c.travada);
    if (livres.length) {
      const alvoDasAlcas = livres.length === 1 ? livres[0] : caixaDeVarias(livres);
      const alca = alcas(alvoDasAlcas, escala, livres.length === 1).find((a) => Math.hypot((a.x - p.x) * escala, (a.y - p.y) * escala) <= (e.pointerType === "touch" ? 18 : 10));
      if (alca) {
        arrasto.current = { modo: alca.id === "rot" ? "girar" : livres.length === 1 ? "redimensionar" : "escalar", alca: alca.id, x0: p.x, y0: p.y, inicio: livres, mexeu: false, caixa: livres.length > 1 ? caixaDeVarias(livres) : undefined };
        tela.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
    let alvo = camadaEm(doc, p.x, p.y);
    if (e.altKey) {
      // Alt+clique: a próxima camada empilhada sob o ponto.
      const pilha = camadasEm(doc, p.x, p.y);
      if (pilha.length) {
        const atual = pilha.findIndex((c) => selecao.includes(c.id));
        alvo = pilha[(atual + 1) % pilha.length];
      }
    }
    if (!alvo) {
      if (!e.shiftKey) setSelecao([]);
      arrasto.current = { modo: "selecao", x0: p.x, y0: p.y, inicio: [], mexeu: false };
      tela.current?.setPointerCapture(e.pointerId);
      return;
    }
    const ids = comGrupo(alvo, e.ctrlKey || e.metaKey || e.altKey);
    let nova = selecao;
    if (e.shiftKey) nova = ids.every((id) => selecao.includes(id)) ? selecao.filter((id) => !ids.includes(id)) : [...new Set([...selecao, ...ids])];
    else if (!selecao.includes(alvo.id) || e.altKey) nova = ids;
    setSelecao(nova);
    if (nova.length) setFolhaAberta(true);
    const andam = doc.camadas.filter((c) => nova.includes(c.id) && !c.travada);
    if (andam.length) {
      arrasto.current = { modo: "mover", x0: p.x, y0: p.y, inicio: andam, mexeu: false };
      tela.current?.setPointerCapture(e.pointerId);
    }
  }

  function arrastar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch" && toques.current.has(e.pointerId)) {
      toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.current.size === 2 && pinca.current && palco.current) {
        // Dois dedos: a pinça aproxima e o meio dos dedos arrasta a tela.
        const [a, b] = [...toques.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (mao.current) {
          palco.current.scrollLeft = mao.current.sl - (meio.x - mao.current.x0);
          palco.current.scrollTop = mao.current.st - (meio.y - mao.current.y0);
        }
        if (Math.abs(d / pinca.current.d - 1) > 0.04) zoomEm(pinca.current.escala * (d / pinca.current.d), meio.x, meio.y);
        return;
      }
    }
    if (mao.current && palco.current && !pinca.current) {
      palco.current.scrollLeft = mao.current.sl - (e.clientX - mao.current.x0);
      palco.current.scrollTop = mao.current.st - (e.clientY - mao.current.y0);
      return;
    }
    const a = arrasto.current;
    if (!a) return;
    const p = ponto(e);
    const dx = p.x - a.x0;
    const dy = p.y - a.y0;
    if (!a.mexeu && Math.hypot(dx * escala, dy * escala) < 3) return;
    a.mexeu = true;
    if (a.modo === "selecao") {
      setMarquise({ x: Math.min(a.x0, p.x), y: Math.min(a.y0, p.y), w: Math.abs(dx), h: Math.abs(dy) });
      return;
    }
    const oito = (v: number) => (ajudas.oito && !e.altKey ? Math.round(v / 8) * 8 : v);
    if (a.modo === "enquadre") {
      const c = a.inicio[0] as CamadaImagem;
      const img = imagemPronta(c.src);
      if (!img) return;
      const pos = posicaoDaFoto(c, img.naturalWidth, img.naturalHeight, c.w, c.h);
      const folgaX = Math.max(1, (pos.w - c.w) / 2);
      const folgaY = Math.max(1, (pos.h - c.h) / 2);
      const ex = Math.min(1, Math.max(-1, (c.enquadre?.x ?? 0) - dx / folgaX));
      const ey = Math.min(1, Math.max(-1, (c.enquadre?.y ?? 0) - dy / folgaY));
      setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => (k.id === c.id ? { ...k, enquadre: { x: ex, y: ey, zoom: (k as CamadaImagem).enquadre?.zoom ?? 1 } } : k)) }), false);
      return;
    }
    if (a.modo === "mover") {
      const b = caixaDeVarias(a.inicio);
      let mx = e.shiftKey && Math.abs(dx) < Math.abs(dy) ? 0 : dx;
      let my = e.shiftKey && Math.abs(dy) <= Math.abs(dx) ? 0 : dy;
      // Ímã: bordas, centro e margens da página e das outras camadas; as guias mostram onde encaixou.
      const ima = 8 / escala;
      const ids = new Set(a.inicio.map((c) => c.id));
      const outras = doc.camadas.filter((k) => !ids.has(k.id) && !k.oculta).map(caixa);
      const margem = 80 * (doc.w / 1080);
      const linhasV = [0, doc.w / 2, doc.w, margem, doc.w - margem, ...outras.flatMap((k) => [k.x, k.x + k.w / 2, k.x + k.w])];
      const linhasH = [0, doc.h / 2, doc.h, margem, doc.h - margem, ...outras.flatMap((k) => [k.y, k.y + k.h / 2, k.y + k.h])];
      const encaixar = (pos: number, tamanho: number, linhas: number[]) => {
        let melhor: { pos: number; linha: number; d: number } | null = null;
        for (const borda of [0, tamanho / 2, tamanho])
          for (const l of linhas) {
            const dist = Math.abs(pos + borda - l);
            if (dist < ima && (!melhor || dist < melhor.d)) melhor = { pos: l - borda, linha: l, d: dist };
          }
        return melhor;
      };
      const ex = e.altKey ? null : encaixar(b.x + mx, b.w, linhasV);
      const ey = e.altKey ? null : encaixar(b.y + my, b.h, linhasH);
      if (ex) mx = ex.pos - b.x;
      else mx = oito(b.x + mx) - b.x;
      if (ey) my = ey.pos - b.y;
      else my = oito(b.y + my) - b.y;
      setGuias(ex || ey ? { v: ex ? [ex.linha] : [], h: ey ? [ey.linha] : [] } : null);
      const novos = new Map(a.inicio.map((c) => [c.id, { x: c.x + mx, y: c.y + my }]));
      setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => (novos.has(k.id) ? { ...k, ...novos.get(k.id)! } : k)) }), false);
      return;
    }
    if (a.modo === "escalar" && a.caixa && a.alca) {
      // Várias camadas: escala tudo junto a partir do canto oposto.
      const b = a.caixa;
      const al = a.alca;
      const ax = al.includes("w") ? b.x + b.w : al.includes("e") ? b.x : b.x + b.w / 2;
      const ay = al.includes("n") ? b.y + b.h : al.includes("s") ? b.y : b.y + b.h / 2;
      const sx = al.includes("e") || al.includes("w") ? Math.max(0.05, (b.w + (al.includes("e") ? dx : -dx)) / b.w) : 1;
      const sy = al.includes("n") || al.includes("s") ? Math.max(0.05, (b.h + (al.includes("s") ? dy : -dy)) / b.h) : 1;
      const fx = al.length === 2 ? Math.max(sx, sy) : sx;
      const fy = al.length === 2 ? Math.max(sx, sy) : sy;
      const novos = new Map(
        a.inicio.map((c) => {
          const nova = { ...c, x: ax + (c.x - ax) * fx, y: ay + (c.y - ay) * fy, w: c.w * fx, h: c.h * fy } as Camada;
          if (nova.tipo === "texto") nova.tamanho = Math.max(4, nova.tamanho * Math.min(fx, fy));
          return [c.id, ajustarAltura(nova)];
        }),
      );
      setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => novos.get(k.id) ?? k) }), false);
      return;
    }
    const c = a.inicio[0];
    let mudanca: Partial<Camada> = {};
    if (a.modo === "girar") {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      let graus = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) graus = Math.round(graus / 15) * 15;
      graus = (((graus % 360) + 540) % 360) - 180;
      if (Math.abs(graus) < 2) graus = 0;
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
      const proporcional = c.tipo === "imagem" || c.tipo === "marca" || (c.tipo === "elemento" && !["pincelada", "fita", "ornamento", "figurinha", "raios-traco"].includes(c.desenho));
      const fixa = proporcional ? !e.shiftKey : e.shiftKey;
      if (a.alca.includes("e")) w = Math.max(8, c.w + lx);
      if (a.alca.includes("w")) w = Math.max(8, c.w - lx);
      if (a.alca.includes("s")) h = Math.max(8, c.h + ly);
      if (a.alca.includes("n")) h = Math.max(8, c.h - ly);
      if (fixa && a.alca.length === 2) {
        const razao = c.w / c.h;
        if (Math.abs(w - c.w) > Math.abs(h - c.h)) h = w / razao;
        else w = h * razao;
      } else if (ajudas.oito && !e.altKey && c.rot === 0) {
        if (a.alca.includes("e")) w = Math.max(8, oito(c.x + w) - c.x);
        if (a.alca.includes("w")) w = Math.max(8, c.x + c.w - oito(c.x + c.w - w));
        if (a.alca.includes("s")) h = Math.max(8, oito(c.y + h) - c.y);
        if (a.alca.includes("n")) h = Math.max(8, c.y + c.h - oito(c.y + c.h - h));
      }
      if (c.rot === 0) {
        if (a.alca.includes("w")) x = c.x + (c.w - w);
        if (a.alca.includes("n")) y = c.y + (c.h - h);
      } else {
        x = c.x + (c.w - w) / 2;
        y = c.y + (c.h - h) / 2;
      }
      // Texto: os cantos mudam o tamanho da letra junto; os lados, só a largura da caixa.
      if (c.tipo === "texto" && !c.ajustar) mudanca = a.alca.length === 2 ? { x, y, w, tamanho: Math.max(4, c.tamanho * (w / c.w)) } : { x, y, w };
      else mudanca = { x, y, w, h };
    }
    setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => (k.id === c.id ? ajustarAltura({ ...k, ...mudanca } as Camada) : k)) }), false);
  }

  function soltar(e: React.PointerEvent<HTMLCanvasElement>) {
    toques.current.delete(e.pointerId);
    if (toques.current.size < 2) pinca.current = null;
    const a = arrasto.current;
    arrasto.current = null;
    mao.current = null;
    setGuias(null);
    if (tela.current?.hasPointerCapture(e.pointerId)) tela.current.releasePointerCapture(e.pointerId);
    if (!a) return;
    if (a.modo === "selecao") {
      const m = marquise;
      if (m && m.w > 2 && m.h > 2) {
        const dentro = doc.camadas.filter((c) => {
          if (c.travada || c.oculta) return false;
          const b = caixa(c);
          return b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y;
        });
        setSelecao((s) => [...new Set([...(e.shiftKey ? s : []), ...dentro.map((c) => c.id)])]);
      }
      setMarquise(null);
      return;
    }
    if (!a.mexeu) return;
    // O arrasto inteiro vira um passo só no histórico.
    const rotulo = `${a.modo === "mover" ? "Moveu" : a.modo === "girar" ? "Girou" : a.modo === "enquadre" ? "Reenquadrou" : "Redimensionou"}: ${a.inicio.length > 1 ? `${a.inicio.length} camadas` : nomeDaCamada(a.inicio[0])}`;
    const antes = new Map(a.inicio.map((c) => [c.id, c]));
    setProjetoBruto((atual) => {
      const passado = { ...atual, paginas: atual.paginas.map((d, i) => (i === paginaRef.current ? { ...d, camadas: d.camadas.map((k) => antes.get(k.id) ?? k) } : d)) };
      historico.current.passado = [...historico.current.passado.slice(-79), { projeto: passado, pagina: paginaRef.current, rotulo }];
      historico.current.futuro = [];
      return atual;
    });
    setMexido(true);
    sincronizar();
  }

  function rodinha(e: React.WheelEvent<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey) zoomEm(escala * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
    else if (reenquadrar && camada?.id === reenquadrar && camada.tipo === "imagem") {
      const z = Math.min(4, Math.max(1, (camada.enquadre?.zoom ?? 1) * Math.exp(-e.deltaY * 0.0018)));
      mudarCamada(camada.id, { enquadre: { x: camada.enquadre?.x ?? 0, y: camada.enquadre?.y ?? 0, zoom: z } }, false);
    }
  }
  // O navegador só deixa impedir a rolagem e o zoom da página num ouvinte que não é "passivo".
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const impedir = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || (reenquadrar && e.target === tela.current)) e.preventDefault();
    };
    el.addEventListener("wheel", impedir, { passive: false });
    return () => el.removeEventListener("wheel", impedir);
  }, [reenquadrar]);

  function menuDeContexto(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const p = ponto(e);
    const alvo = camadaEm(doc, p.x, p.y);
    if (alvo && !selecao.includes(alvo.id)) setSelecao(comGrupo(alvo, false));
    const r = palco.current!.getBoundingClientRect();
    setMenu({ x: e.clientX - r.left + palco.current!.scrollLeft, y: e.clientY - r.top + palco.current!.scrollTop });
  }

  // ───── O editor, para os painéis ─────
  const editor: Editor = {
    me,
    projeto,
    doc,
    pagina,
    titulo,
    setTitulo: (t) => {
      setTitulo(t);
      setMexido(true);
    },
    formato,
    selecionadas,
    camada,
    selecionar,
    setProjeto,
    setDoc,
    mudar,
    mudarCamada,
    acrescentar,
    ajustarAltura,
    acoes,
    irParaPagina,
    usarModelo,
    mudarFormato,
    avisar,
    progresso,
    gaveta,
    setGaveta,
    janela,
    setJanela,
    ajudas,
    setAjudas,
    simples,
    setSimples,
    pegarCor: (devolver) => {
      pegarCorRef.current = devolver;
      setPegando(true);
      avisar("Conta-gotas: clique num ponto da arte.", "info");
    },
    idSalvo,
    guardar: () => guardar(),
    vars,
    editarFoto: (id) => setFotoEmEdicao(id),
    reenquadrar,
    setReenquadrar,
    editarTexto: (id) => {
      setSelecao([id]);
      setEditando(id);
    },
    abrir: (a) => {
      if (mexido && !window.confirm("Trocar de trabalho? O que não foi guardado continua no rascunho deste aparelho só até a próxima mudança.")) return;
      void abrir(a);
    },
    mexido,
    laboratorio,
    paginaIntacta: () => {
      const d = projetoRef.current.paginas[paginaRef.current];
      return Boolean(d && intactas.current.has(d));
    },
    podeExportar: () => {
      if (!laboratorio || !citaOInstituto(projetoRef.current)) return true;
      avisar(AVISO_DO_LABORATORIO, "erro");
      return false;
    },
  };

  const comandos: Comando[] = useMemo(
    () => [
      { id: "guardar", nome: "Guardar", icone: "check", atalho: "Ctrl+S" },
      { id: "baixar", nome: "Baixar", icone: "baixar", atalho: "Ctrl+E" },
      { id: "previa", nome: "Pré-visualizar", icone: "olho", atalho: "P" },
      { id: "conferir", nome: "Conferir antes de postar", icone: "verificar" },
      { id: "desfazer", nome: "Desfazer", icone: "desfazer", atalho: "Ctrl+Z" },
      { id: "refazer", nome: "Refazer", icone: "refazer", atalho: "Ctrl+Shift+Z" },
      { id: "duplicar", nome: "Duplicar", icone: "duplicar", atalho: "Ctrl+D" },
      { id: "apagar", nome: "Apagar", icone: "lixeira", atalho: "Delete" },
      { id: "copiar", nome: "Copiar", icone: "copiar", atalho: "Ctrl+C" },
      { id: "colar", nome: "Colar", icone: "colar", atalho: "Ctrl+V" },
      { id: "copiarEstilo", nome: "Copiar estilo", icone: "copiar-estilo", atalho: "Ctrl+Alt+C" },
      { id: "colarEstilo", nome: "Colar estilo", icone: "copiar-estilo", atalho: "Ctrl+Alt+V" },
      { id: "agrupar", nome: "Agrupar", icone: "agrupar", atalho: "Ctrl+G" },
      { id: "desagrupar", nome: "Desagrupar", icone: "desagrupar", atalho: "Ctrl+Shift+G" },
      { id: "tudo", nome: "Selecionar tudo", icone: "camadas", atalho: "Ctrl+A" },
      { id: "travar", nome: "Travar ou destravar", icone: "cadeado", atalho: "Ctrl+L" },
      { id: "esconder", nome: "Esconder ou mostrar", icone: "olho-fechado", atalho: "Ctrl+Shift+H" },
      { id: "frente", nome: "Trazer para a frente", icone: "frente", atalho: "Ctrl+]" },
      { id: "tras", nome: "Mandar para trás", icone: "tras", atalho: "Ctrl+[" },
      { id: "alinhar-centro-h", nome: "Centralizar na horizontal", icone: "alinhar-centro-h" },
      { id: "alinhar-meio", nome: "Centralizar na vertical", icone: "alinhar-meio" },
      { id: "distribuir-h", nome: "Distribuir na horizontal", icone: "distribuir-h" },
      { id: "distribuir-v", nome: "Distribuir na vertical", icone: "distribuir-v" },
      { id: "editarTexto", nome: "Editar o texto na arte", icone: "texto", atalho: "Enter" },
      { id: "reenquadrar", nome: "Reenquadrar a foto", icone: "enquadrar", atalho: "Enter" },
      { id: "editarFoto", nome: "Recortar ou tirar o fundo da foto", icone: "remover-fundo" },
      { id: "novaPagina", nome: "Nova página", icone: "pagina" },
      { id: "duplicarPagina", nome: "Duplicar página", icone: "paginas" },
      { id: "apagarPagina", nome: "Apagar página", icone: "lixeira" },
      { id: "proximaPagina", nome: "Próxima página", icone: "seta-dir", atalho: "PageDown" },
      { id: "paginaAnterior", nome: "Página anterior", icone: "seta-esq", atalho: "PageUp" },
      { id: "versaoB", nome: "Criar versão B (teste A/B)", icone: "ab" },
      { id: "idioma", nome: "Versão em outro idioma", icone: "idioma" },
      { id: "lote", nome: "Gerar várias artes de uma lista", icone: "lista" },
      { id: "historicoDeVersoes", nome: "Versões guardadas", icone: "historico" },
      { id: "revisao", nome: "Revisão e comentários", icone: "comentario" },
      { id: "publicar", nome: "Publicar no Instagram", icone: "publicar" },
      { id: "encaixar", nome: "Encaixar na tela", icone: "ajustar", atalho: "Ctrl+0" },
      { id: "cem", nome: "Tamanho real (100%)", icone: "lupa", atalho: "Ctrl+1" },
      { id: "aproximar", nome: "Aproximar", icone: "mais", atalho: "Ctrl++" },
      { id: "afastar", nome: "Afastar", icone: "menos", atalho: "Ctrl+-" },
      { id: "instagram", nome: "Guias do Instagram", icone: "guias", atalho: "Shift+I" },
      { id: "grade", nome: "Grade", icone: "grade", atalho: "Shift+G" },
      { id: "margens", nome: "Margens da marca", icone: "moldura", atalho: "Shift+M" },
      { id: "reguas", nome: "Réguas", icone: "regua", atalho: "Shift+R" },
      { id: "oito", nome: "Encaixar de 8 em 8", icone: "grade" },
      { id: "ferramentaMover", nome: "Ferramenta mover", icone: "mover", atalho: "V" },
      { id: "ferramentaTexto", nome: "Ferramenta texto", icone: "texto", atalho: "T" },
      { id: "ferramentaMao", nome: "Ferramenta mão (arrastar a tela)", icone: "maos", atalho: "H" },
      { id: "foco", nome: "Modo foco (só a arte)", icone: "foco", atalho: "Tab" },
      { id: "temaDaInterface", nome: "Interface clara ou escura", icone: "lua" },
      { id: "simples", nome: "Modo simples", icone: "lampada" },
      { id: "atalhos", nome: "Atalhos do teclado", icone: "teclado", atalho: "?" },
      { id: "sair", nome: "Sair do estúdio", icone: "seta-esq" },
    ],
    [],
  );

  const largura = doc.w * escala;
  const altura = doc.h * escala;
  const margemPalco = celular ? 16 : MARGEM_DO_PALCO;
  // Medidas inteiras e um pixel de folga: o miolo nunca passa do palco por arredondamento (e a barra não pisca).
  const interno = { w: Math.floor(Math.max(tamanhoDoPalco.w - 1, largura + 2 * margemPalco)), h: Math.floor(Math.max(tamanhoDoPalco.h - 1, altura + CABECA_DO_PALCO + (celular ? 24 : 92))) };
  const esquerda = Math.round(Math.max(margemPalco, (interno.w - largura) / 2));
  const topo = Math.round(Math.max(CABECA_DO_PALCO, (interno.h - altura) / 2 + (celular ? 0 : 6)));
  const editandoCamada = editando ? (doc.camadas.find((c) => c.id === editando) as CamadaTexto | undefined) : undefined;

  // Em tela cheia de verdade: o editor vai direto no corpo da página (as animações do painel não o prendem).
  return createPortal(
    <ContextoDoEditor.Provider value={editor}>
      <div className="estudio-app fixed inset-0 z-[80] flex flex-col" data-estudio-tema={temaDaInterface || undefined}>
        {!foco && <BarraDoAlto mexido={mexido} salvoEm={salvoEm} guardando={guardando} escala={escala} passos={passos} voltarAte={voltarAte} podeRefazer={refaziveis > 0} celular={celular} ferramenta={ferramenta} />}
        {andamento && (
          <div className="relative h-1 bg-e-fio" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(andamento.f * 100)} aria-label={andamento.rotulo || "Andamento"}>
            <div className="h-full bg-e-bordo transition-[width]" style={{ width: `${Math.max(3, andamento.f * 100)}%` }} />
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          {!foco && !celular && <Trilho />}
          {!foco && gaveta && <Gavetas celular={celular} />}
          <div className="relative min-w-0 flex-1">
          <div
            ref={palco}
            tabIndex={0}
            aria-label="Palco: a arte"
            className="estudio-palco absolute inset-0 overflow-auto outline-none [scrollbar-color:#5a4e3c_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]"
            onPointerDownCapture={() => {
              // Só quem chegou ao palco pelo mouse liga o modo foco com Tab; pelo teclado, o Tab segue adiante.
              focoPeloMouse.current = true;
            }}
            onBlur={(e) => {
              if (e.target === e.currentTarget) focoPeloMouse.current = false;
            }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.fundo) {
                setSelecao([]);
                setMenu(null);
                if (reenquadrar) setReenquadrar(null);
              }
            }}
            onWheel={rodinha}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const arquivo = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
              if (arquivo) void acrescentarArquivo(arquivo, tela.current ? ponto(e) : undefined);
            }}
          >
            <div data-fundo="1" className="relative" style={{ width: interno.w, height: interno.h }}>
              {ajudas.reguas && (
                <>
                  <ReguaHorizontal escala={escala} doc={doc} style={{ left: esquerda, top: topo - 22, width: largura }} />
                  <ReguaVertical escala={escala} doc={doc} style={{ left: esquerda - 22, top: topo, height: altura }} />
                </>
              )}
              <canvas
                ref={tela}
                onPointerDown={apontar}
                onPointerMove={arrastar}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                onContextMenu={menuDeContexto}
                onDoubleClick={(e) => {
                  const p = ponto(e);
                  const alvo = camadaEm(doc, p.x, p.y);
                  if (alvo?.tipo === "texto") editor.editarTexto(alvo.id);
                  else if (alvo?.tipo === "imagem") {
                    setSelecao([alvo.id]);
                    setReenquadrar(alvo.id);
                  }
                }}
                className="absolute touch-none shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                style={{ left: esquerda, top: topo, width: largura, height: altura, cursor: pegando ? "crosshair" : ferramenta === "texto" ? "text" : ferramenta === "mao" ? "grab" : reenquadrar ? "move" : "default" }}
                role="img"
                aria-label={`A arte: ${doc.w} por ${doc.h} pontos, ${doc.camadas.length} camadas. ${doc.alt ?? ""}`}
              />
              {editandoCamada && <EditorDeTexto key={editandoCamada.id} camada={editandoCamada} escala={escala} esquerda={esquerda} topo={topo} terminar={() => setEditando(null)} />}
              {!editando && camada && !camada.travada && !reenquadrar && !celular && <BarraFlutuante key={camada.id} escala={escala} esquerda={esquerda} topo={topo} />}
              {reenquadrar && (
                <p className="absolute z-10 -translate-x-1/2 rounded-full bg-[#1f1a14] px-4 py-2 text-sm whitespace-nowrap text-[#f4ecd8] shadow" role="status" style={{ top: topo + 10, left: esquerda + largura / 2 }}>
                  Arraste a foto para reenquadrar · role para aproximar · Enter ou Esc para terminar
                </p>
              )}
              {menu && <MenuDeContexto x={menu.x} y={menu.y} fechar={() => setMenu(null)} />}
            </div>
          </div>
          {!celular && !foco && <CabecaDoPalco formato={formato} />}
          {!celular && !foco && <RodapeDoPalco />}
          </div>
          {!foco && !celular && <PainelDireito passos={passos} voltarAte={voltarAte} />}
        </div>
        {celular && !foco && camada && folhaAberta && <FolhaDoCelular fechar={() => setFolhaAberta(false)} />}
        {celular && !foco && <AbasDoCelular />}
        {foco && (
          <button type="button" className="fixed top-3 right-3 z-[85] cursor-pointer rounded-full bg-[#1f1a14]/85 px-4 py-2 text-sm text-[#f4ecd8]" onClick={() => setFoco(false)}>
            Sair do modo foco
          </button>
        )}
        <Avisos avisos={avisos} />
        <Janelas comandos={comandos} fotoEmEdicao={fotoEmEdicao} fecharFoto={() => setFotoEmEdicao(null)} redesenhar={() => setDesenhoPedido((n) => n + 1)} />
        {janela === "comandos" && <Comandos comandos={comandos} fechar={() => setJanela(null)} />}
        {janela === "atalhos" && <Atalhos comandos={comandos} fechar={() => setJanela(null)} />}
      </div>
    </ContextoDoEditor.Provider>,
    document.body,
  );
}

/** O chip do formato, a página e o "+ Página", em cima da arte. */
function CabecaDoPalco({ formato }: { formato: FormatoId }) {
  const ed = useEditor();
  const [aberto, setAberto] = useState(false);
  const f = formatoDe(formato) ?? FORMATOS[0];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-center justify-center gap-2 text-sm text-[#e8dcc0] [&>*]:pointer-events-auto">
      <div className="relative">
        <button type="button" className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 whitespace-nowrap hover:bg-white/10" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-haspopup="menu">
          {f.curto} · {ed.doc.w} × {ed.doc.h}
          <Icone nome="seta" className="h-4 w-4" />
        </button>
        {aberto && <MenuDeFormatos fechar={() => setAberto(false)} />}
      </div>
      <span className="whitespace-nowrap text-[#b3a584]">
        Página {ed.pagina + 1} de {ed.projeto.paginas.length}
        {ed.doc.variante ? ` · versão ${ed.doc.variante}` : ""}
      </span>
      <button type="button" className="flex h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-white/25 px-3.5 whitespace-nowrap hover:bg-white/10" onClick={ed.acoes.novaPagina}>
        <Icone nome="mais" className="h-4 w-4" /> Página
      </button>
    </div>
  );
}

function MenuDeFormatos({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const [adaptarCamadas, setAdaptarCamadas] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("pointerdown", fora, true);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("pointerdown", fora, true);
      window.removeEventListener("keydown", tecla);
    };
  }, [fechar]);
  const grupos = [...new Set(FORMATOS.map((f) => f.grupo))];
  return (
    <div ref={ref} className="estudio-surge absolute top-full left-1/2 z-30 mt-2 max-h-[70vh] w-80 -translate-x-1/2 overflow-y-auto rounded-lg border border-e-fio bg-e-painel p-2 text-e-tinta shadow-2xl [scrollbar-width:thin]" role="menu">
      <label className="mb-2 flex items-center gap-2 px-2 text-xs text-e-suave">
        <input type="checkbox" checked={adaptarCamadas} onChange={(e) => setAdaptarCamadas(e.target.checked)} /> Reposicionar as camadas no formato novo
      </label>
      {grupos.map((g) => (
        <div key={g} className="mb-1">
          <p className="px-2 pt-1 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-e-suave">{g}</p>
          {FORMATOS.filter((f) => f.grupo === g).map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
              className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-e-bordo-claro ${ed.formato === f.id ? "text-e-bordo" : ""}`}
              onClick={() => {
                ed.mudarFormato(f.id, adaptarCamadas);
                fechar();
              }}
            >
              {f.nome}
              {ed.formato === f.id && <Icone nome="check" className="h-4 w-4" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A edição do texto direto na arte (duplo clique): uma caixa por cima da camada, com a mesma letra. */
function EditorDeTexto({ camada: c, escala, esquerda, topo, terminar }: { camada: CamadaTexto; escala: number; esquerda: number; topo: number; terminar: () => void }) {
  const ed = useEditor();
  const ref = useRef<HTMLTextAreaElement>(null);
  const original = useRef(c.texto);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const fim = () => {
    // A edição inteira vira um passo só no histórico.
    if (c.texto !== original.current) {
      const agora = c.texto;
      ed.mudarCamada(c.id, { texto: original.current }, false);
      ed.mudarCamada(c.id, { texto: agora }, true);
    }
    terminar();
  };
  const familia = c.fonte === "serifa" ? "var(--font-serif-display), serif" : c.fonte === "mono" ? "var(--font-archive), monospace" : c.fonte === "manuscrita" ? "var(--font-hand), cursive" : "var(--font-ui), sans-serif";
  return (
    <textarea
      ref={ref}
      value={c.texto}
      spellCheck
      lang="pt-BR"
      aria-label="Texto da camada"
      onChange={(e) => ed.mudarCamada(c.id, { texto: e.target.value }, false)}
      onBlur={fim}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          e.stopPropagation();
          fim();
        }
      }}
      className="absolute z-20 resize-none overflow-hidden border-0 bg-[rgba(255,255,255,0.14)] p-0 outline-2 outline-[#6e1f1a]"
      style={{
        left: esquerda + c.x * escala,
        top: topo + c.y * escala,
        width: c.w * escala,
        height: Math.max(c.h, c.tamanho * c.entrelinha) * escala + 6,
        transform: `rotate(${c.rot}deg)`,
        transformOrigin: "center",
        fontFamily: familia,
        fontSize: c.tamanho * escala,
        fontWeight: c.peso,
        fontStyle: c.italico ? "italic" : "normal",
        lineHeight: c.entrelinha,
        letterSpacing: `${c.espacamento}em`,
        textAlign: c.alinhar,
        textTransform: c.maiusculas ? "uppercase" : "none",
        color: c.cor,
        padding: c.recuo * escala,
        caretColor: "#c21f16",
      }}
    />
  );
}
