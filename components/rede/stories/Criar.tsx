// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import "../editor/editor.css";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as EventoDePonteiro } from "react";
import { checarTexto } from "@/lib/rede/publicar/checagem";
import { limparLegendas } from "@/lib/rede/stories/legendas";
import type { AreaBorrada } from "../publicar/imagem";
import { aplicarBorrado } from "../publicar/imagem";
import { BorrarRostos } from "../publicar/BorrarRostos";
import { carregarTextosPublicar } from "../publicar/textos";
import type { TextosPublicar } from "@/lib/rede/textos-publicar";
import { refazerImagem } from "@/lib/rede/stories/imagem";
import {
  comporFoto, filtroEmCss, fotoDoVideo, lerVideo, miniaturasDoVideo, regravarVideo, SEM_TRANSFORMACAO, TIPOS_DE_VIDEO_ACEITOS, transformacaoEmCss,
  transformacaoNeutra, transformacaoValida, VIDEO_ORIGINAL_MAXIMO, type FiltroDoStory, type TracoDoStory, type Transformacao,
} from "@/lib/rede/stories/midia";
import { alternarFigurinha, corDaLetraEmHex, estiloDoTexto, linkSeguro, PALETA_DO_STORY, posicaoInicial, tamanhoDoTexto } from "@/lib/rede/stories/visual";
import { RODA_SEM_BANCO, type ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import {
  CORES_DA_LETRA, CORES_DO_STORY, LIMITES_DO_STORY, PUBLICOS_DO_STORY, TIPOS_DE_FIGURINHA,
  type AtoParaContagem, type CartaoDoPost, type ComunidadeParaMencao, type CorDaLetra, type CorDoStory, type EstiloDoStory, type Figurinha, type LegendaDoVideo,
  type MusicaDoStory, type NomeDecorativo, type PedidoDeStory, type PosicaoDaFigurinha, type PublicoDoStory, type TipoDeFigurinha, type TipoDoBotao,
} from "@/lib/rede/tipos-stories";
import { handleOk } from "@/lib/rede/tipos";
import { Camera } from "../editor/Camera";
import { Cortar } from "../editor/Cortar";
import { EstiloDoTexto } from "../editor/EstiloDoTexto";
import { Filtros } from "../editor/Filtros";
import { useGestosDaMidia } from "../editor/gestos";
import { ComunidadeEditar } from "../figurinhas/Comunidade";
import { ContagemEditar } from "../figurinhas/Contagem";
import { EnqueteEditar } from "../figurinhas/Enquete";
import { LinkEditar } from "../figurinhas/Link";
import { PerguntaEditar } from "../figurinhas/Pergunta";
import { DecorativaVer, SeletorDeDecorativas } from "../figurinhas/Decorativas";
import { CampanhaEditar, PessoaEditar, RespostaVer, tagDaCampanha, VouEditar } from "../figurinhas/Novas";
import { EditarLegendas } from "../editor/Legendas";
import { EscolherMusica } from "../editor/Musica";
import { Recortar } from "../editor/Recortar";
import { CartaoDoPostNoStory } from "./CartaoDoPost";
import { RodaDeConfianca } from "./Roda";
import { FigurinhaSolta } from "./FigurinhaSolta";
import { FundoDoStory, estiloDaTela } from "./FundoDoStory";
import { IconeFechar } from "./icones";
import { codigoDoErro, focarNoGrupo, indiceDaSeta, larguraDaTela, preencherStory, useAgora, useModalDosStories } from "./usar";

type Modo = "texto" | "desenhar" | "figurinha";
type Midia =
  | { tipo: "imagem"; blob: Blob; url: string }
  | { tipo: "video"; blob: Blob; url: string; duracao: number };
type Fase = "preparando" | "foto" | "enviando" | "publicando";

/** O desenho de cada tipo no botão (prancha: "2D" dourado, "?" papel, "A|B" verde-água, "↗" rosa; a menção, "@" dourado-claro). */
const ICONE_DO_TIPO: Record<TipoDoBotao, { texto: string; cor: string }> = {
  contagem: { texto: "2D", cor: "var(--al-dourado, #ffc21a)" },
  pergunta: { texto: "?", cor: "var(--al-texto, #f3efe6)" },
  enquete: { texto: "A|B", cor: "var(--al-com-1, #1fc2b5)" },
  link: { texto: "↗", cor: "var(--al-com-2, #ff5c8a)" },
  comunidade: { texto: "@", cor: "#f6c84a" },
  vou: { texto: "✓", cor: "#7be0a6" },
  pessoa: { texto: "@a", cor: "#9fc5ff" },
  campanha: { texto: "#", cor: "#ff8a5c" },
};

/** Um enfeite no story (podem ser até 3, inclusive repetidos): a chave só diz qual é qual na tela. */
interface Enfeite {
  chave: number;
  nome: NomeDecorativo;
  pos: PosicaoDaFigurinha;
}
const LUGARES_DOS_ENFEITES: PosicaoDaFigurinha[] = [
  { x: 0.78, y: 0.2, giro: 8, escala: 1 },
  { x: 0.22, y: 0.3, giro: -10, escala: 0.9 },
  { x: 0.75, y: 0.5, giro: 4, escala: 0.9 },
];

/** Uma figurinha nova, com o que a prancha já mostra preenchido, no lugar livre seguinte da tela. */
function figurinhaNova(tipo: TipoDoBotao, t: TextosDosStories, k: number): Figurinha {
  return { ...conteudoNovo(tipo, t), pos: posicaoInicial(k) } as Figurinha;
}
function conteudoNovo(tipo: TipoDoBotao, t: TextosDosStories): Figurinha {
  switch (tipo) {
    case "contagem":
      return { tipo, ato: null, titulo: "", inicio: "" };
    case "pergunta":
      return { tipo, texto: "" };
    case "enquete":
      return { tipo, pergunta: "", opcoes: [t.figurinha.enquete.padraoA, t.figurinha.enquete.padraoB] };
    case "link":
      return { tipo, url: "", rotulo: "" };
    case "comunidade":
      return { tipo, slug: null, nome: "" };
    case "vou":
      return { tipo, ato: null, titulo: "", inicio: "" };
    case "pessoa":
      return { tipo, handle: "", nome: "" };
    case "campanha":
      return { tipo, tag: "", corrente: true };
  }
}

/** O que falta numa figurinha para publicar (a chave do erro), ou nulo. */
function faltaNaFigurinha(f: Figurinha): "ato" | "pergunta" | "enquete" | "link" | "comunidade" | "vou" | "pessoa" | "campanha" | null {
  if (f.tipo === "contagem") return f.ato ? null : "ato";
  if (f.tipo === "pergunta") return f.texto.trim() ? null : "pergunta";
  if (f.tipo === "enquete") return f.pergunta.trim() && f.opcoes.every((o) => o.trim()) ? null : "enquete";
  if (f.tipo === "comunidade") return f.slug ? null : "comunidade";
  if (f.tipo === "vou") return f.ato ? null : "vou";
  if (f.tipo === "pessoa") return f.handle && handleOk(f.handle.replace(/^@/, "").toLowerCase()) ? null : "pessoa";
  if (f.tipo === "campanha") return tagDaCampanha(f.tag) ? null : "campanha";
  if (f.tipo === "link") return linkSeguro(f.url) ? null : "link";
  return null;
}

/** Movimento reduzido (o do sistema ou o "parado" do site). */
const semMovimento = () =>
  typeof window === "undefined" || document.documentElement.hasAttribute("data-parado") || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const IconeCamera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
    <circle cx="12" cy="12.5" r="3.6" />
  </svg>
);
const IconeSom = ({ ligado }: { ligado: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
    {ligado ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
);

/**
 * Criar um story (prancha celular-criar-story), agora como o do Instagram: câmera (toque = foto, segurar = vídeo até 60 s) e
 * galeria (foto e vídeo); a mídia se move, gira e dá zoom com dois dedos (ou botões, para quem usa teclado); filtros; corte do
 * vídeo; som liga/desliga; o texto grande com 4 fontes, cor da letra, alinhamento e caixa; desenhar com caneta ou marca-texto;
 * as figurinhas (Contagem, Pergunta, Enquete, Link e a menção de comunidade); "Quem vê" e "Publicar". A foto e o vídeo são
 * REFEITOS no aparelho antes de sair (lib/rede/stories/midia.ts): sem GPS, sem modelo da câmera, sem data; vídeo em 720p e até
 * 20 MB; sem som, o áudio nem sai.
 */
export function Criar({
  t,
  cliente,
  lang = "pt",
  postRef = null,
  extras = null,
  aoFechar,
  aoPublicar,
}: {
  t: TextosDosStories;
  cliente: ClienteDeStories;
  lang?: string;
  /** "Pôr no story": o post (ou o ato) de onde veio. */
  postRef?: string | null;
  /** Do endereço: a resposta à minha pergunta a publicar (do story `de`) e a #campanha da corrente. */
  extras?: { de: string | null; resposta: string | null; campanha: string | null } | null;
  aoFechar: () => void;
  aoPublicar: () => void;
}) {
  const [modo, setModo] = useState<Modo>("texto");
  const [cor, setCor] = useState<CorDoStory>("azul");
  const [alvoDaCor, setAlvoDaCor] = useState<"fundo" | "letra">("fundo");
  const [pincel, setPincel] = useState<{ cor: CorDaLetra; marca: boolean; largura: number }>({ cor: "dourado", marca: false, largura: 0.014 });
  const [texto, setTexto] = useState("");
  const [estilo, setEstilo] = useState<EstiloDoStory>({});
  const [legenda, setLegenda] = useState("");
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([]);
  const [publico, setPublico] = useState<PublicoDoStory>("seguidores");
  const [tracos, setTracos] = useState<TracoDoStory[]>([]);
  const [midia, setMidia] = useState<Midia | null>(null);
  const [lendo, setLendo] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDoStory>("nenhum");
  const [transf, setTransf] = useState<Transformacao>(SEM_TRANSFORMACAO);
  const [corte, setCorte] = useState({ inicio: 0, fim: 0 });
  const [agulha, setAgulha] = useState(0);
  const [som, setSom] = useState(true);
  const [miniaturas, setMiniaturas] = useState<string[]>([]);
  const [camera, setCamera] = useState(false);
  const [alt, setAlt] = useState("");
  const [atos, setAtos] = useState<AtoParaContagem[] | null>(null);
  const [comunidades, setComunidades] = useState<ComunidadeParaMencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [estado, setEstado] = useState<"editando" | "publicando" | "publicado">("editando");
  const [progresso, setProgresso] = useState<{ fase: Fase; pct: number } | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [larguraDaPrevia, setLarguraDaPrevia] = useState(390);
  /** A figurinha tocada por último fica por cima (e vai por último no story, para o visor empilhar igual). */
  const [frente, setFrente] = useState<TipoDeFigurinha | null>(null);
  const [enfeites, setEnfeites] = useState<Enfeite[]>([]);
  const [cartao, setCartao] = useState<CartaoDoPost | null>(null);
  const [comunidadeDoPublico, setComunidadeDoPublico] = useState<string | null>(null);
  const [rodaAberta, setRodaAberta] = useState(false);
  const [legendas, setLegendas] = useState<LegendaDoVideo[]>([]);
  const [legendasGeradas, setLegendasGeradas] = useState(false);
  const [legendasAprovadas, setLegendasAprovadas] = useState(false);
  const [musica, setMusica] = useState<MusicaDoStory | null>(null);
  /** Borrar: a foto original (para refazer o borrado) e as áreas; no vídeo, as áreas e o quadro usado para marcar. */
  const [borrar, setBorrar] = useState<null | { tipo: "foto" | "video"; base: Blob }>(null);
  const [fotoOriginal, setFotoOriginal] = useState<{ blob: Blob; areas: AreaBorrada[] } | null>(null);
  const [borroesDoVideo, setBorroesDoVideo] = useState<AreaBorrada[]>([]);
  const [tp, setTp] = useState<TextosPublicar | null>(null);
  const [recortando, setRecortando] = useState(false);
  const [desfeitos, setDesfeitos] = useState<TracoDoStory[]>([]);
  const [borracha, setBorracha] = useState(false);
  const desenhando = useRef<TracoDoStory | null>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const painelFigurinhas = useRef<HTMLHeadingElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const campoDoTexto = useRef<HTMLTextAreaElement>(null);
  const campoDaTarja = useRef<HTMLTextAreaElement>(null);
  const areaDeGestos = useRef<HTMLDivElement>(null);
  const caixaDaMidia = useRef<HTMLDivElement>(null);
  const guias = useRef<HTMLDivElement>(null);
  const videoDaPrevia = useRef<HTMLVideoElement>(null);
  const cancelar = useRef<AbortController | null>(null);
  const ultimoPct = useRef(-1);
  const agora = useAgora(30_000);
  const id = useId();

  const mexeu = texto.trim() !== "" || legenda.trim() !== "" || figurinhas.length > 0 || enfeites.length > 0 || tracos.length > 0 || midia !== null || !!postRef;

  // Os atos para a contagem e as comunidades para a menção: só quando a pessoa liga a figurinha.
  const querAtos = figurinhas.some((f) => f.tipo === "contagem" || f.tipo === "vou");
  useEffect(() => {
    if (!querAtos || atos) return;
    cliente.atos().then(setAtos).catch(() => setAtos([]));
  }, [querAtos, atos, cliente]);
  const querComunidades = figurinhas.some((f) => f.tipo === "comunidade") || publico === "comunidade";
  useEffect(() => {
    if (!querComunidades || comunidades) return;
    cliente.comunidades().then(setComunidades).catch(() => setComunidades([]));
  }, [querComunidades, comunidades, cliente]);

  // "Pôr no story": o cartão do post (ou do ato) como vai aparecer, se eu vejo.
  useEffect(() => {
    if (!postRef) return;
    let vivo = true;
    cliente
      .post(postRef)
      .then((c) => vivo && setCartao(c))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [cliente, postRef]);

  // Do endereço: a resposta à minha pergunta (a figurinha "resposta", sem o nome) e a #campanha da corrente.
  const extraDe = extras?.de ?? null;
  const extraResposta = extras?.resposta ?? null;
  const extraCampanha = extras?.campanha ?? null;
  useEffect(() => {
    if (!extraDe || !extraResposta) return;
    let vivo = true;
    Promise.all([cliente.respostas(extraDe), cliente.meus().catch(() => [])])
      .then(([lista, meus]) => {
        const r = lista.find((x) => x.id === extraResposta && x.pergunta);
        if (!vivo || !r) return;
        const pergunta = meus.find((s) => s.id === extraDe)?.figurinhas.find((f) => f.tipo === "pergunta");
        setFigurinhas((l) => (l.some((f) => f.tipo === "resposta") ? l : [...l, { tipo: "resposta", resposta: r.id, pergunta: pergunta?.tipo === "pergunta" ? pergunta.texto : "", texto: r.texto, pos: posicaoInicial(0) }]));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [cliente, extraDe, extraResposta]);
  useEffect(() => {
    if (!extraCampanha) return;
    // Uma vez, ao abrir pela corrente ("Adicionar o seu").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFigurinhas((l) => (l.some((f) => f.tipo === "campanha") ? l : [...l, { tipo: "campanha", tag: extraCampanha, corrente: true, pos: posicaoInicial(1) }]));
  }, [extraCampanha]);

  // Os textos do "Borrar rostos" (os mesmos do escrever): só quando a pessoa abre o borrar.
  useEffect(() => {
    if (!borrar || tp) return;
    carregarTextosPublicar(lang).then(setTp).catch(() => undefined);
  }, [borrar, tp, lang]);

  useModalDosStories(raiz);
  useGestosDaMidia({ area: areaDeGestos, midia: caixaDaMidia, guias, valor: transf, ativo: !!midia && modo !== "desenhar" && estado === "editando", aoMudar: setTransf });

  // Prende a rolagem da página de trás e devolve o foco ao fechar. Abre escrevendo, com o cursor dourado no texto (prancha).
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    (campoDoTexto.current ?? raiz.current)?.focus({ preventScroll: true });
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = rolagem;
      cancelar.current?.abort();
      antes?.focus?.();
    };
  }, []);

  // A largura da prévia (o traço e o texto acompanham a tela de verdade).
  useEffect(() => {
    const el = tela.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(([e]) => setLarguraDaPrevia(Math.round(e.contentRect.width)));
    o.observe(el);
    return () => o.disconnect();
  }, []);

  // Solta os endereços locais quando a mídia sai.
  useEffect(() => () => (midia ? URL.revokeObjectURL(midia.url) : undefined), [midia]);
  useEffect(() => () => miniaturas.forEach((m) => URL.revokeObjectURL(m)), [miniaturas]);

  // A prévia do vídeo toca só o trecho cortado, em volta.
  useEffect(() => {
    const v = videoDaPrevia.current;
    if (!v || midia?.tipo !== "video") return;
    const aoTempo = () => {
      const ms = v.currentTime * 1000;
      if (ms >= corte.fim || ms < corte.inicio - 120) v.currentTime = corte.inicio / 1000;
      setAgulha(Math.max(corte.inicio, Math.min(corte.fim, v.currentTime * 1000)));
    };
    v.addEventListener("timeupdate", aoTempo);
    if (v.currentTime * 1000 < corte.inicio || v.currentTime * 1000 > corte.fim) v.currentTime = corte.inicio / 1000;
    return () => v.removeEventListener("timeupdate", aoTempo);
  }, [midia, corte]);
  useEffect(() => {
    const v = videoDaPrevia.current;
    if (!v) return;
    if (camera || estado !== "editando") v.pause();
    else void v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => undefined);
    });
  }, [camera, estado, midia]);

  const fechar = () => (mexeu && estado !== "publicado" ? setConfirmarSaida(true) : aoFechar());

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || camera) return;
      e.preventDefault();
      if (estado === "publicando") cancelar.current?.abort();
      else if (confirmarSaida) setConfirmarSaida(false);
      else if (mexeu && estado !== "publicado") setConfirmarSaida(true);
      else aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, camera, confirmarSaida, estado, mexeu]);

  function escolherModo(m: Modo) {
    setModo(m);
    if (m === "figurinha") {
      painelFigurinhas.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      painelFigurinhas.current?.focus();
    }
    if (m === "texto") campoDoTexto.current?.focus({ preventScroll: true });
  }

  const cheio = figurinhas.length >= LIMITES_DO_STORY.figurinhas;
  function alternar(tipo: TipoDeFigurinha) {
    if (tipo === "resposta" || tipo === "decorativa") {
      setFigurinhas((l) => l.filter((f) => f.tipo !== tipo));
      return;
    }
    const ligada = figurinhas.some((f) => f.tipo === tipo);
    // Já são 3: o botão está desligado (aria-disabled) e a dica embaixo do título explica; nada de erro.
    if (!ligada && cheio) return;
    setErro(null);
    // A nova nasce num lugar que ainda não está ocupado.
    const ocupados = new Set(figurinhas.map((f) => f.pos?.y));
    const k = [0, 1, 2].find((n) => !ocupados.has(posicaoInicial(n).y)) ?? figurinhas.length;
    setFigurinhas(alternarFigurinha(figurinhas, figurinhaNova(tipo, t, k)));
    if (!ligada) setFrente(tipo);
  }

  const porEnfeite = (nome: NomeDecorativo) =>
    setEnfeites((l) => (l.length >= LIMITES_DO_STORY.decorativas ? l : [...l, { chave: Date.now() + l.length, nome, pos: LUGARES_DOS_ENFEITES[l.length % LUGARES_DOS_ENFEITES.length] }]));
  const moverFigurinha = (tipo: TipoDeFigurinha, pos: PosicaoDaFigurinha) =>
    setFigurinhas((lista) => lista.map((f) => (f.tipo === tipo ? ({ ...f, pos } as Figurinha) : f)));
  const mudarFigurinha = (tipo: TipoDeFigurinha, novo: Partial<Figurinha>) =>
    setFigurinhas((lista) => lista.map((f) => (f.tipo === tipo ? ({ ...f, ...novo } as Figurinha) : f)));

  // ── Desenhar: traços em coordenadas de 0 a 1, para caberem em qualquer tela e na mídia final (1080 × 1920 ou 720 × 1280). ──
  const ponto = (e: EventoDePonteiro<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  /** A borracha apaga o traço inteiro que o dedo tocar (vai para o "refazer"). */
  const apagarNoPonto = ([x, y]: [number, number]) =>
    setTracos((l) => {
      const k = l.findIndex((tr) => tr.pontos.some(([a, b]) => Math.hypot(a - x, (b - y) * 1.78) < Math.max(0.02, (tr.largura ?? 0.014) * 1.6)));
      if (k < 0) return l;
      setDesfeitos((d) => [...d, l[k]]);
      return l.filter((_, j) => j !== k);
    });
  const comecar = (e: EventoDePonteiro<SVGSVGElement>) => {
    if (modo !== "desenhar") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (borracha) {
      apagarNoPonto(ponto(e));
      desenhando.current = null;
      return;
    }
    setDesfeitos([]);
    desenhando.current = { cor: corDaLetraEmHex(pincel.cor), pontos: [ponto(e)], largura: pincel.largura, marca: pincel.marca };
    setTracos((l) => [...l, desenhando.current as TracoDoStory]);
  };
  const mover = (e: EventoDePonteiro<SVGSVGElement>) => {
    if (borracha && modo === "desenhar" && e.buttons) return apagarNoPonto(ponto(e));
    const atual = desenhando.current;
    if (!atual) return;
    atual.pontos.push(ponto(e));
    setTracos((l) => [...l.slice(0, -1), { ...atual, pontos: [...atual.pontos] }]);
  };
  const terminar = () => {
    desenhando.current = null;
  };

  function limparMidia() {
    setMidia(null);
    setFiltro("nenhum");
    setTransf(SEM_TRANSFORMACAO);
    setMiniaturas([]);
    setAlt("");
    setFotoOriginal(null);
    setBorroesDoVideo([]);
    setLegendas([]);
    setLegendasGeradas(false);
    setLegendasAprovadas(false);
    setMusica(null);
  }

  async function aoEscolherArquivo(arquivo: Blob | undefined, deOnde: "galeria" | "camera") {
    if (!arquivo) return;
    setErro(null);
    setCamera(false);
    // A mídia nova aparece na tela do story: volta ao alto (no celular o painel fica embaixo).
    raiz.current?.scrollTo({ top: 0, behavior: semMovimento() ? "auto" : "smooth" });
    const ehVideo = arquivo.type.startsWith("video/") || (deOnde === "camera" && !arquivo.type.startsWith("image/"));
    if (ehVideo) {
      if (deOnde === "galeria" && !(TIPOS_DE_VIDEO_ACEITOS as readonly string[]).includes(arquivo.type)) return setErro(t.criar.erroMidia.video);
      if (arquivo.size > VIDEO_ORIGINAL_MAXIMO) return setErro(t.criar.erroMidia.videoGrande);
      setLendo(true);
      const url = URL.createObjectURL(arquivo);
      try {
        const info = await lerVideo(url);
        limparMidia();
        setMidia({ tipo: "video", blob: arquivo, url, duracao: info.duracao });
        setCorte({ inicio: 0, fim: Math.min(info.duracao, LIMITES_DO_STORY.videoMs) });
        setSom(true);
        void miniaturasDoVideo(url, info.duracao).then(setMiniaturas);
      } catch {
        URL.revokeObjectURL(url);
        setErro(t.criar.erroMidia.video);
      } finally {
        setLendo(false);
      }
      return;
    }
    try {
      // A foto da galeria é refeita já aqui (sem metadado, no máximo 1080 × 1920); a da câmera já nasceu num canvas.
      const blob = deOnde === "galeria" ? await refazerImagem(arquivo) : arquivo;
      limparMidia();
      setMidia({ tipo: "imagem", blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setErro(e instanceof Error && e.message === "grande" ? t.criar.erro.grande : t.criar.erro.invalida);
    }
  }

  const andar = (fase: Fase) => (f: number) => {
    const pct = Math.round(f * 100);
    if (pct === ultimoPct.current) return;
    ultimoPct.current = pct;
    setProgresso({ fase, pct });
  };

  async function publicar() {
    setErro(null);
    setLinkInvalido(false);
    if (!mexeu || (!texto.trim() && tracos.length === 0 && !midia && figurinhas.length === 0 && enfeites.length === 0 && !postRef)) return setErro(t.criar.vazio);
    for (const f of figurinhas) {
      const falta = faltaNaFigurinha(f);
      if (falta) {
        if (falta === "link") setLinkInvalido(true);
        if (falta === "vou") return setErro(t.b1.vou.escolher);
        if (falta === "pessoa") return setErro(t.b1.pessoa.ajuda);
        if (falta === "campanha") return setErro(t.b1.campanha.ajuda);
        return setErro(falta === "comunidade" ? t.criar.erroMidia.comunidade : t.criar.erro[falta]);
      }
    }
    if (publico === "comunidade" && !comunidadeDoPublico) return setErro(t.b1.comunidade.escolher);
    if (midia?.tipo === "video" && legendasGeradas && legendas.length > 0 && !legendasAprovadas) return setErro(t.b1.legendas.falta);
    // Dado pessoal no texto, na tarja, no alt ou nas figurinhas: bloqueia aqui; o banco confere de novo (LGPD art. 6º, III).
    const tudo = [texto, legenda, alt, ...legendas.map((l) => l.texto), ...figurinhas.map((f) => (f.tipo === "pergunta" ? f.texto : f.tipo === "enquete" ? `${f.pergunta} ${f.opcoes.join(" ")}` : f.tipo === "link" ? f.rotulo : ""))].join("\n");
    if (checarTexto(tudo).bloqueia.length > 0) return setErro(t.criar.erro.dadoPessoal);

    const ctrl = new AbortController();
    cancelar.current = ctrl;
    ultimoPct.current = -1;
    setEstado("publicando");
    try {
      let caminho: string | null = null;
      let video: PedidoDeStory["video"] = null;
      const fundo = PALETA_DO_STORY[cor].fundo;
      if (midia?.tipo === "video") {
        setProgresso({ fase: "preparando", pct: 0 });
        const pronto = await regravarVideo({ url: midia.url, inicio: corte.inicio, fim: corte.fim, som, fundo, filtro, transformacao: transf, tracos, musica, borroes: borroesDoVideo, aoProgresso: andar("preparando"), sinal: ctrl.signal });
        ultimoPct.current = -1;
        setProgresso({ fase: "enviando", pct: 0 });
        caminho = await cliente.enviarImagem(pronto.blob, andar("enviando"));
        video = { duracao_ms: pronto.duracao, som: pronto.som && som, musica, legendas: limparLegendas(legendas, pronto.duracao) };
      } else if (midia || tracos.length > 0) {
        setProgresso({ fase: "foto", pct: 0 });
        const blob = await comporFoto({ fundo, imagem: midia?.blob, filtro, transformacao: transf, tracos });
        if (ctrl.signal.aborted) throw new Error("cancelado");
        ultimoPct.current = -1;
        setProgresso({ fase: "enviando", pct: 0 });
        caminho = await cliente.enviarImagem(blob, andar("enviando"));
      }
      if (ctrl.signal.aborted) throw new Error("cancelado");
      setProgresso({ fase: "publicando", pct: 100 });
      const pedido: PedidoDeStory = {
        publico,
        fundo: { tipo: caminho ? (video ? "video" : "imagem") : "listras", cor },
        texto: texto.trim().slice(0, LIMITES_DO_STORY.texto),
        legenda: legenda.trim() ? legenda.trim().slice(0, LIMITES_DO_STORY.legenda) : null,
        imagem: caminho,
        video,
        estilo: Object.keys(estilo).length > 0 ? estilo : undefined,
        alt: caminho ? alt.trim() || null : null,
        figurinhas: [
          ...[...figurinhas.filter((f) => f.tipo !== frente), ...figurinhas.filter((f) => f.tipo === frente)].map((f) =>
            f.tipo === "link" ? { ...f, url: linkSeguro(f.url) ?? "" } : f.tipo === "campanha" ? { ...f, tag: tagDaCampanha(f.tag) ?? "" } : f,
          ),
          ...enfeites.map((e): Figurinha => ({ tipo: "decorativa", nome: e.nome, pos: e.pos })),
        ],
        post_ref: postRef,
        comunidade: publico === "comunidade" ? comunidadeDoPublico : null,
      };
      await cliente.publicar(pedido);
      setProgresso(null);
      setEstado("publicado");
      aoPublicar();
    } catch (e) {
      setEstado("editando");
      setProgresso(null);
      const m = e instanceof Error ? e.message : "";
      if (m === "cancelado") return setErro(t.criar.erroMidia.cancelado);
      // O banco ainda não tem a roda de confiança: nada foi publicado (o "proximos" de antes iria a todos os que se seguem).
      if (m === RODA_SEM_BANCO) return setErro(t.b1.roda.semBanco);
      if (m === "sem_gravador") return setErro(t.criar.erroMidia.semGravador);
      if (m === "grande") return setErro(midia?.tipo === "video" ? t.criar.erroMidia.videoGrande : t.criar.erro.grande);
      if (m === "invalida") return setErro(midia?.tipo === "video" ? t.criar.erroMidia.video : t.criar.erro.invalida);
      const c = codigoDoErro(e);
      setErro(t.criar.erro[c as keyof typeof t.criar.erro] ?? t.criar.erro.falha);
    } finally {
      cancelar.current = null;
    }
  }

  // No "criar" o texto fica um pouco menor que no visor (a prancha: "PLENÁRIA DO / NÚCLEO LESTE" em 2 linhas, com as cores e a
  // figurinha acima da dobra).
  const tamanho = tamanhoDoTexto(texto || t.criar.textoVazio, larguraDaTela(460), 0.76);
  const est = estiloDoTexto(estilo, cor);

  // O campo cresce só com o texto (a barra dourada tem a altura do que está escrito): mede de novo a cada letra e a cada tamanho.
  useLayoutEffect(() => {
    const c = campoDoTexto.current;
    if (!c) return;
    c.style.height = "auto";
    c.style.height = `${c.scrollHeight}px`;
    // A tarja: onde o navegador não tem field-sizing, a altura acompanha (até 2 linhas, o resto o CSS esconde).
    const j = campoDaTarja.current;
    if (j && typeof CSS !== "undefined" && !CSS.supports("field-sizing", "content")) {
      j.style.height = "auto";
      j.style.height = `${j.scrollHeight}px`;
    }
  }, [texto, tamanho, estilo, legenda]);
  const restam = LIMITES_DO_STORY.texto - [...texto].length;

  // Com foto ou vídeo, a cor de fundo não aparece (a mídia cobre a tela): só sobra a cor da letra.
  const alvo = midia ? "letra" : alvoDaCor;
  const coresDaFileira = modo === "desenhar" || alvo === "letra" ? CORES_DA_LETRA : CORES_DO_STORY;
  const corEscolhida = (c: string) => (modo === "desenhar" ? pincel.cor === c : alvo === "letra" ? (estilo.cor_texto ?? null) === c : cor === c);
  const escolherCor = (c: string) => {
    if (modo === "desenhar") setPincel((p) => ({ ...p, cor: c as CorDaLetra }));
    else if (alvo === "letra") setEstilo((e) => ({ ...e, cor_texto: c as CorDaLetra }));
    else setCor(c as CorDoStory);
  };
  const amostra = midia?.tipo === "imagem" ? midia.url : miniaturas[0] ?? null;
  const ajustar = (f: (t: Transformacao) => Partial<Transformacao>) => setTransf((x) => transformacaoValida({ ...x, ...f(x) }));
  const R = 2 * Math.PI * 52;

  return (
    <div ref={raiz} className="al-st-criar" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} tabIndex={-1} data-midia={midia?.tipo ?? "nenhuma"}>
      <h1 id={`${id}-titulo`} className="sr-only">
        {t.criar.titulo}
      </h1>
      {cliente.previa ? <p className="al-st-previa">{t.previa}</p> : null}
      <div className="al-st-criar-grade">
        {/* ── A tela do story, como vai ficar ── */}
        <div ref={tela} className="al-st-tela" style={estiloDaTela(cor, { "--st-tamanho": `${tamanho}px` } as CSSProperties)}>
          {midia ? (
            <div className="al-st-fundo al-ed-palco-midia" aria-hidden={!alt} style={{ background: PALETA_DO_STORY[cor].fundo }}>
              <div ref={caixaDaMidia} className="al-ed-midia" style={{ transform: transformacaoEmCss(transf), filter: filtroEmCss(filtro) }}>
                {midia.tipo === "video" ? (
                  <video ref={videoDaPrevia} src={midia.url} muted={!som} playsInline autoPlay preload="auto" aria-label={alt || t.criar.midia.video} />
                ) : (
                  // Endereço local do próprio aparelho (blob:), nada de rede.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={midia.url} alt={alt || t.criar.midia.foto} draggable={false} />
                )}
              </div>
            </div>
          ) : (
            <FundoDoStory tipo="listras" cor={cor} semente="criar" />
          )}
          {midia ? (
            <>
              <div ref={guias} className="al-ed-guias" data-x="nao" data-y="nao" aria-hidden />
              <div ref={areaDeGestos} className="al-ed-gestos" aria-hidden data-ativo={modo !== "desenhar" ? "sim" : "nao"} />
            </>
          ) : null}
          <svg
            className="al-st-desenho"
            data-ativo={modo === "desenhar" ? "sim" : "nao"}
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            role={modo === "desenhar" ? "img" : undefined}
            aria-label={modo === "desenhar" ? t.criar.desenho : undefined}
            aria-hidden={modo === "desenhar" ? undefined : true}
            onPointerDown={comecar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
          >
            {tracos.map((tr, k) => (
              <polyline
                key={k}
                points={tr.pontos.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ")}
                fill="none"
                stroke={tr.cor}
                strokeOpacity={tr.marca ? 0.45 : 1}
                strokeWidth={Math.max(2, (tr.largura ?? 0.014) * larguraDaPrevia * (tr.marca ? 2.4 : 1))}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="al-st-criar-topo" role="toolbar" aria-label={t.criar.modos} style={{ position: "relative", zIndex: 5 }}>
            <button type="button" className="al-st-icone" aria-label={t.criar.fechar} onClick={fechar}>
              <IconeFechar />
            </button>
            <button type="button" className="al-st-modo" aria-pressed={modo === "texto"} onClick={() => escolherModo("texto")}>
              <span aria-hidden>{t.criar.modoTextoAa} </span>
              {t.criar.modoTexto}
            </button>
            <button type="button" className="al-st-modo" aria-pressed={modo === "desenhar"} onClick={() => escolherModo("desenhar")}>
              {t.criar.modoDesenhar}
            </button>
            <button type="button" className="al-st-modo" aria-pressed={modo === "figurinha"} onClick={() => escolherModo("figurinha")}>
              {t.criar.modoFigurinha}
            </button>
          </div>

          {modo === "texto" ? (
            <div className="al-ed-estilo-faixa" style={{ position: "relative", zIndex: 5 }}>
              <EstiloDoTexto t={t.criar.estilo} estilo={estilo} aoMudar={setEstilo} />
            </div>
          ) : null}

          <div className="al-st-escrita" data-com-estilo={modo === "texto" ? "sim" : "nao"} data-alinhar={est.alinhar} style={{ zIndex: modo === "desenhar" ? 0 : 3 }}>
            <label htmlFor={`${id}-texto`} className="sr-only">
              {t.criar.texto}
            </label>
            <textarea
              id={`${id}-texto`}
              ref={campoDoTexto}
              className="al-st-texto"
              data-fonte={est.fonte}
              data-caixa={est.caixa ? "sim" : "nao"}
              rows={1}
              spellCheck={false}
              value={texto}
              maxLength={LIMITES_DO_STORY.texto}
              placeholder={t.criar.textoVazio}
              aria-describedby={`${id}-restam`}
              style={{ fontFamily: est.familia, "--st-letra": est.cor, "--st-caixa": est.caixa ?? "transparent", textAlign: est.alinhar === "esq" ? "left" : est.alinhar === "dir" ? "right" : "center" } as CSSProperties}
              onChange={(e) => setTexto(e.target.value)}
            />
            <span id={`${id}-restam`} className="al-st-restam" aria-live="polite">
              {restam <= 30 ? preencherStory(t.criar.restam, { n: restam }) : ""}
            </span>
            {texto.trim() || legenda ? (
              <p className="al-st-tarja" data-vazia={legenda ? "nao" : "sim"}>
                <label htmlFor={`${id}-tarja`} className="sr-only">
                  {t.criar.tarja}
                </label>
                <textarea
                  ref={campoDaTarja}
                  id={`${id}-tarja`}
                  rows={1}
                  value={legenda}
                  maxLength={LIMITES_DO_STORY.legenda}
                  placeholder={t.criar.tarjaVazia}
                  // A tarja cresce com o texto (field-sizing) e quebra em até 2 linhas, como no visor; Enter não pula linha.
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  onChange={(e) => setLegenda(e.target.value.replace(/\s*\n\s*/g, " "))}
                />
              </p>
            ) : null}
          </div>

          <div className="al-ed-cores-linha" style={{ position: "relative", zIndex: 5 }}>
            {modo !== "desenhar" && !midia ? (
              <div className="al-ed-alvo" role="radiogroup" aria-label={t.criar.cores}>
                {(["fundo", "letra"] as const).map((a, k) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={alvoDaCor === a}
                    tabIndex={alvoDaCor === a ? 0 : -1}
                    className="al-ed-alvo-op"
                    onClick={() => setAlvoDaCor(a)}
                    onKeyDown={(e) => {
                      const n = indiceDaSeta(e.key, k, 2);
                      if (n === null) return;
                      e.preventDefault();
                      setAlvoDaCor(n === 0 ? "fundo" : "letra");
                      focarNoGrupo(e.currentTarget, "[role=radio]", n);
                    }}
                  >
                    {t.criar.corAlvo[a]}
                  </button>
                ))}
              </div>
            ) : null}
            <fieldset className="al-st-cores" role="radiogroup">
              <legend>{modo === "desenhar" ? t.criar.coresDoTraco : alvo === "letra" ? t.criar.corDaLetra : t.criar.cores}</legend>
              {coresDaFileira.map((c, k) => {
                const escolhida = corEscolhida(c);
                const nenhumaMarcada = !coresDaFileira.some((x) => corEscolhida(x));
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={escolhida}
                    aria-label={t.criar.cor[c as CorDaLetra]}
                    tabIndex={escolhida || (nenhumaMarcada && k === 0) ? 0 : -1}
                    className="al-st-cor"
                    style={{ background: c === "papel" ? "#f3efe6" : PALETA_DO_STORY[c as CorDoStory].fundo }}
                    onClick={() => escolherCor(c)}
                    onKeyDown={(e) => {
                      const n = indiceDaSeta(e.key, k, coresDaFileira.length);
                      if (n === null) return;
                      e.preventDefault();
                      escolherCor(coresDaFileira[n]);
                      focarNoGrupo(e.currentTarget, "[role=radio]", n);
                    }}
                  />
                );
              })}
            </fieldset>
          </div>

          {modo === "desenhar" ? (
            <div className="al-st-desenho-acoes">
              <div className="al-ed-alvo" role="radiogroup" aria-label={t.criar.pincel.rotulo}>
                {([false, true] as const).map((marca) => (
                  <button key={String(marca)} type="button" role="radio" aria-checked={pincel.marca === marca} className="al-ed-alvo-op" onClick={() => setPincel((p) => ({ ...p, marca }))}>
                    {marca ? t.criar.pincel.marca : t.criar.pincel.caneta}
                  </button>
                ))}
              </div>
              <label className="al-ed-espessura">
                <span className="sr-only">{t.criar.pincel.espessura}</span>
                <input type="range" min={4} max={40} value={Math.round(pincel.largura * 1000)} onChange={(e) => setPincel((p) => ({ ...p, largura: Number(e.target.value) / 1000 }))} />
              </label>
              <button
                type="button"
                className="al-st-modo"
                disabled={tracos.length === 0}
                onClick={() => {
                  const ultimo = tracos[tracos.length - 1];
                  if (ultimo) setDesfeitos((d) => [...d, ultimo]);
                  setTracos((l) => l.slice(0, -1));
                }}
              >
                {t.criar.desfazer}
              </button>
              <button
                type="button"
                className="al-st-modo"
                disabled={desfeitos.length === 0}
                onClick={() => {
                  const volta = desfeitos[desfeitos.length - 1];
                  if (!volta) return;
                  setDesfeitos((d) => d.slice(0, -1));
                  setTracos((l) => [...l, volta]);
                }}
              >
                {t.b1.desenho.refazer}
              </button>
              <button type="button" className="al-st-modo" aria-pressed={borracha} title={t.b1.desenho.borrachaAjuda} disabled={tracos.length === 0 && !borracha} onClick={() => setBorracha((b) => !b)}>
                {t.b1.desenho.borracha}
              </button>
              <button type="button" className="al-st-modo" disabled={tracos.length === 0} onClick={() => setTracos([])}>
                {t.criar.limpar}
              </button>
            </div>
          ) : null}

          {figurinhas.length > 0 ? (
            <div className="al-st-palco-figurinhas" data-guia="nao" data-ativo={modo === "desenhar" ? "nao" : "sim"}>
              {figurinhas.map((f) => (
                <div key={f.tipo} className="al-st-fig-camada" style={{ zIndex: f.tipo === frente ? 2 : 1 }}>
                  <FigurinhaSolta
                    tipo={f.tipo}
                    pos={f.pos ?? posicaoInicial(0)}
                    ativa={modo !== "desenhar" && estado === "editando"}
                    rotulo={preencherStory(t.criar.figurinhaMover, { nome: t.criar.tipo[f.tipo] })}
                    idDaDica={`${id}-fig-dica`}
                    aoMudar={(p) => moverFigurinha(f.tipo, p)}
                    aoTocar={() => setFrente(f.tipo)}
                  >
                    <div className={f.tipo === "enquete" ? "al-fg-enquete-caixa" : undefined}>
                      {f.tipo === "contagem" ? (
                        <ContagemEditar t={t.figurinha.contagem} atos={atos} ato={f.ato} agora={agora} aoEscolher={(a) => mudarFigurinha("contagem", { ato: a.id, titulo: a.titulo, inicio: a.inicio })} />
                      ) : f.tipo === "pergunta" ? (
                        <PerguntaEditar texto={f.texto} t={t.figurinha.pergunta} aoMudar={(x) => mudarFigurinha("pergunta", { texto: x })} />
                      ) : f.tipo === "enquete" ? (
                        <EnqueteEditar pergunta={f.pergunta} opcoes={f.opcoes} t={t.figurinha.enquete} aoMudar={(p, o) => mudarFigurinha("enquete", { pergunta: p, opcoes: o })} />
                      ) : f.tipo === "comunidade" ? (
                        <ComunidadeEditar t={t.figurinha.comunidade} lista={comunidades} slug={f.slug} aoEscolher={(c) => mudarFigurinha("comunidade", { slug: c.slug, nome: c.nome })} />
                      ) : f.tipo === "vou" ? (
                        <VouEditar t={t.b1} atos={atos} ato={f.ato} lang={lang} aoEscolher={(a) => mudarFigurinha("vou", { ato: a.id, titulo: a.titulo, inicio: a.inicio })} />
                      ) : f.tipo === "pessoa" ? (
                        <PessoaEditar t={t.b1} handle={f.handle ?? ""} aoMudar={(h) => mudarFigurinha("pessoa", { handle: h })} />
                      ) : f.tipo === "campanha" ? (
                        <CampanhaEditar t={t.b1} tag={f.tag} corrente={f.corrente} aoMudar={(tag, corrente) => mudarFigurinha("campanha", { tag, corrente })} />
                      ) : f.tipo === "resposta" ? (
                        <RespostaVer pergunta={f.pergunta} texto={f.texto} t={t.b1} />
                      ) : f.tipo !== "link" ? null : (
                        <LinkEditar
                          url={f.url}
                          rotulo={f.rotulo}
                          t={t.figurinha.link}
                          invalido={linkInvalido ? t.criar.erro.link : null}
                          aoMudar={(u, r) => {
                            setLinkInvalido(false);
                            mudarFigurinha("link", { url: u, rotulo: r });
                          }}
                        />
                      )}
                    </div>
                    <button type="button" className="al-fg-tirar" aria-label={preencherStory(t.criar.figurinhaLigada, { nome: t.criar.tipo[f.tipo] })} onClick={() => alternar(f.tipo)}>
                      <IconeFechar />
                    </button>
                  </FigurinhaSolta>
                </div>
              ))}
            </div>
          ) : null}

          {enfeites.length > 0 ? (
            <div className="al-st-palco-figurinhas al-st-palco-enfeites" data-guia="nao" data-ativo={modo === "desenhar" ? "nao" : "sim"}>
              {enfeites.map((e) => (
                <div key={e.chave} className="al-st-fig-camada">
                  <FigurinhaSolta
                    tipo="decorativa"
                    pos={e.pos}
                    ativa={modo !== "desenhar" && estado === "editando"}
                    rotulo={preencherStory(t.b1.decorativas.mover, { nome: t.b1.decorativas.nomes[e.nome] })}
                    idDaDica={`${id}-fig-dica`}
                    aoMudar={(pos) => setEnfeites((l) => l.map((x) => (x.chave === e.chave ? { ...x, pos } : x)))}
                    aoTocar={() => setEnfeites((l) => [...l.filter((x) => x.chave !== e.chave), e])}
                  >
                    <DecorativaVer nome={e.nome} t={t.b1.decorativas} />
                    <button type="button" className="al-fg-tirar" aria-label={preencherStory(t.b1.decorativas.tirar, { nome: t.b1.decorativas.nomes[e.nome] })} onClick={() => setEnfeites((l) => l.filter((x) => x.chave !== e.chave))}>
                      <IconeFechar />
                    </button>
                  </FigurinhaSolta>
                </div>
              ))}
            </div>
          ) : null}

          {postRef ? (
            <div className="al-st-criar-cartao" style={{ zIndex: 4 }}>
              {cartao ? <CartaoDoPostNoStory cartao={cartao} t={t.b1.post} lang={lang} previa /> : <div className="al-st-cartao" aria-busy="true">{t.b1.post.carregando}</div>}
            </div>
          ) : null}

          {midia?.tipo === "video" ? (
            <button type="button" className="al-ed-som-na-tela" aria-pressed={som} aria-label={som ? t.criar.midia.comSom : t.criar.midia.semSom} onClick={() => setSom((s) => !s)}>
              <IconeSom ligado={som} />
            </button>
          ) : null}
          {lendo ? (
            <p className="al-ed-lendo" role="status">
              {t.criar.midia.lendo}
            </p>
          ) : null}
        </div>

        {/* ── O painel: mídia, figurinhas, quem vê, a regra, câmera/galeria e publicar ── */}
        <div className="al-st-painel">
          {midia ? (
            <section className="al-ed-painel-midia" aria-labelledby={`${id}-midia`}>
              <h2 id={`${id}-midia`} className="al-cond al-st-titulo-secao">
                {t.criar.midia.titulo}
              </h2>
              <Filtros t={t.criar.midia} filtro={filtro} amostra={amostra} aoEscolher={setFiltro} />
              {midia.tipo === "video" ? (
                <>
                  <Cortar t={t.criar.midia} total={midia.duracao} inicio={corte.inicio} fim={corte.fim} agulha={agulha} miniaturas={miniaturas} aoMudar={(i, f) => setCorte({ inicio: i, fim: f })} />
                  <div className="al-ed-som">
                    <button type="button" className="al-ed-interruptor" role="switch" aria-checked={som} onClick={() => setSom((s) => !s)}>
                      <span className="al-ed-interruptor-trilho" aria-hidden>
                        <span />
                      </span>
                      {t.criar.midia.som}: {som ? t.criar.midia.comSom : t.criar.midia.semSom}
                    </button>
                    {!som ? <p className="al-st-dica">{t.criar.midia.somAjuda}</p> : null}
                  </div>
                </>
              ) : null}
              {midia.tipo === "video" ? (
                <>
                  <EscolherMusica t={t.b1.musica} musica={musica} aoEscolher={setMusica} />
                  <EditarLegendas
                    t={t.b1.legendas}
                    lang={lang}
                    duracao={Math.max(0, corte.fim - corte.inicio)}
                    agulha={Math.max(0, agulha - corte.inicio)}
                    legendas={legendas}
                    aoMudar={(l) => {
                      setLegendas(l);
                      setLegendasAprovadas(false);
                    }}
                    video={videoDaPrevia}
                    inicio={corte.inicio}
                    fim={corte.fim}
                    geradas={legendasGeradas}
                    aprovadas={legendasAprovadas}
                    aoGerar={() => setLegendasGeradas(true)}
                    aoAprovar={setLegendasAprovadas}
                  />
                </>
              ) : null}
              <div className="al-ed-borrar">
                <button
                  type="button"
                  className="al-botao al-botao-contorno al-botao-p"
                  onClick={async () => {
                    if (midia.tipo === "imagem") return setBorrar({ tipo: "foto", base: fotoOriginal?.blob ?? midia.blob });
                    const v = videoDaPrevia.current;
                    if (!v) return;
                    v.pause();
                    try {
                      setBorrar({ tipo: "video", base: await fotoDoVideo(v, false) });
                    } catch {
                      setErro(t.b1.borrar.erro);
                    }
                  }}
                >
                  {midia.tipo === "imagem" ? t.b1.borrar.noCriar : t.b1.borrar.video}
                </button>
                {midia.tipo === "imagem" ? (
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setRecortando(true)}>
                    {t.b1.recortar.botao}
                  </button>
                ) : null}
                <p className="al-st-dica">
                  {(midia.tipo === "imagem" ? fotoOriginal?.areas.length : borroesDoVideo.length) ? preencherStory(t.b1.borrar.borradas, { n: (midia.tipo === "imagem" ? fotoOriginal?.areas.length : borroesDoVideo.length) ?? 0 }) + " · " : ""}
                  {midia.tipo === "imagem" ? t.b1.borrar.noCriarAjuda : t.b1.borrar.videoAjuda}
                </p>
              </div>
              <div className="al-ed-ajustar" role="group" aria-label={t.criar.midia.ajustar}>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => ajustar((x) => ({ giro: x.giro + Math.PI / 2 }))}>
                  {t.criar.midia.girar}
                </button>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" aria-label={t.criar.midia.menor} onClick={() => ajustar((x) => ({ escala: x.escala / 1.15 }))}>
                  −
                </button>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" aria-label={t.criar.midia.maior} onClick={() => ajustar((x) => ({ escala: x.escala * 1.15 }))}>
                  +
                </button>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={transformacaoNeutra(transf)} onClick={() => setTransf(SEM_TRANSFORMACAO)}>
                  {t.criar.midia.centralizar}
                </button>
              </div>
              <p className="al-st-dica">{t.criar.midia.gestos}</p>
              <label className="al-st-alt">
                {midia.tipo === "video" ? t.criar.midia.altVideo : t.criar.alt}
                <input value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} />
              </label>
              <p className="al-st-dica">{midia.tipo === "video" ? t.criar.midia.semMetadadoVideo : t.criar.semMetadado}</p>
              <button type="button" className="al-botao al-botao-contorno al-botao-p al-ed-remover" onClick={limparMidia}>
                {t.criar.midia.tirar}
              </button>
            </section>
          ) : null}

          <div className="al-st-titulo-linha">
            <h2 ref={painelFigurinhas} tabIndex={-1} className="al-cond al-st-titulo-secao">
              {t.criar.figurinhas}
            </h2>
            <span className="al-st-conta" data-cheio={cheio ? "sim" : "nao"} aria-hidden>
              {preencherStory(t.criar.contaDeFigurinhas, { n: figurinhas.length, max: LIMITES_DO_STORY.figurinhas })}
            </span>
          </div>
          <p id={`${id}-fig-cheio`} className="al-st-dica al-st-dica-figurinhas" aria-live="polite">
            {cheio ? t.criar.limiteDeFigurinhas : figurinhas.length > 0 ? t.criar.figurinhaDica : ""}
          </p>
          <p id={`${id}-fig-dica`} className="sr-only">
            {t.criar.figurinhaDica}
          </p>
          <ul className="al-st-tipos">
            {TIPOS_DE_FIGURINHA.map((tipo) => {
              const ligada = figurinhas.some((f) => f.tipo === tipo);
              const desligado = cheio && !ligada;
              return (
                <li key={tipo}>
                  <button
                    type="button"
                    className="al-st-tipo"
                    aria-pressed={ligada}
                    aria-disabled={desligado || undefined}
                    aria-describedby={desligado ? `${id}-fig-cheio` : undefined}
                    onClick={() => alternar(tipo)}
                  >
                    <span className="al-st-tipo-icone al-cond" aria-hidden style={{ color: ICONE_DO_TIPO[tipo].cor }}>
                      {ICONE_DO_TIPO[tipo].texto}
                    </span>
                    <span className="al-st-tipo-nome">{t.criar.tipo[tipo]}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="al-st-titulo-linha">
            <h2 className="al-cond al-st-titulo-secao">{t.b1.decorativas.titulo}</h2>
            <span className="al-st-conta" data-cheio={enfeites.length >= LIMITES_DO_STORY.decorativas ? "sim" : "nao"} aria-hidden>
              {preencherStory(t.criar.contaDeFigurinhas, { n: enfeites.length, max: LIMITES_DO_STORY.decorativas })}
            </span>
          </div>
          <p className="al-st-dica" aria-live="polite">
            {enfeites.length >= LIMITES_DO_STORY.decorativas ? t.b1.decorativas.limite : t.b1.decorativas.ajuda}
          </p>
          <SeletorDeDecorativas t={t.b1.decorativas} usadas={enfeites.length} limite={LIMITES_DO_STORY.decorativas} aoEscolher={porEnfeite} />

          <fieldset className="al-st-quem" role="radiogroup" aria-describedby={`${id}-regra`}>
            <legend className="al-cond al-st-titulo-secao">{t.criar.quemVe}</legend>
            {PUBLICOS_DO_STORY.map((p, k) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={publico === p}
                tabIndex={publico === p ? 0 : -1}
                className="al-st-quem-op"
                title={t.criar.publicoAjuda[p]}
                onClick={() => setPublico(p)}
                onKeyDown={(e) => {
                  const n = indiceDaSeta(e.key, k, PUBLICOS_DO_STORY.length);
                  if (n === null) return;
                  e.preventDefault();
                  setPublico(PUBLICOS_DO_STORY[n]);
                  focarNoGrupo(e.currentTarget, "[role=radio]", n);
                }}
              >
                {t.criar.publico[p]}
              </button>
            ))}
          </fieldset>
          <p className="al-st-dica">{t.criar.publicoAjuda[publico]}</p>
          {publico === "comunidade" ? (
            comunidades === null ? null : comunidades.length === 0 ? (
              <p className="al-st-dica">{t.b1.comunidade.nenhuma}</p>
            ) : (
              <label className="al-st-quem-comunidade">
                <span>{t.b1.comunidade.escolher}</span>
                <select value={comunidadeDoPublico ?? ""} onChange={(e) => setComunidadeDoPublico(e.target.value || null)}>
                  <option value="" disabled>
                    {t.b1.comunidade.escolher}
                  </option>
                  {comunidades.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
            )
          ) : null}
          {publico === "proximos" ? (
            <button type="button" className="al-botao al-botao-contorno al-botao-p al-st-roda-abrir" onClick={() => setRodaAberta(true)}>
              <span className="al-st-roda-selo" aria-hidden />
              {t.b1.roda.gerenciar}
            </button>
          ) : null}
          <p id={`${id}-regra`} className="al-st-regra">
            {t.criar.regra}
          </p>
          {postRef ? <p className="al-st-dica">{cartao?.tipo === "ato" ? `${t.b1.post.vaiJunto} ${t.b1.post.soCidade}` : t.b1.post.vaiJunto}</p> : null}

          <div className="al-st-acoes al-ed-acoes">
            {/* O erro e o "publicado" ficam na barra das ações (fixa no celular), à vista de quem tocou em Publicar. */}
            {erro ? (
              <p className="al-st-erro-criar" role="alert">
                {erro}
              </p>
            ) : null}
            {estado === "publicado" ? (
              <p className="al-st-feito" role="status">
                {t.criar.publicado}
              </p>
            ) : null}
            <input
              ref={galeria}
              type="file"
              accept={`image/jpeg,image/png,image/webp,${TIPOS_DE_VIDEO_ACEITOS.join(",")}`}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                void aoEscolherArquivo(e.target.files?.[0], "galeria");
                e.target.value = "";
              }}
            />
            <button type="button" className="al-botao al-botao-contorno al-botao-m al-ed-botao-camera" aria-label={t.criar.camera} title={t.criar.camera} disabled={estado !== "editando"} onClick={() => setCamera(true)}>
              <IconeCamera />
            </button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m al-st-galeria" title={t.criar.galeriaAjuda} disabled={estado !== "editando"} onClick={() => galeria.current?.click()}>
              {t.criar.galeria}
            </button>
            <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={estado !== "editando"} aria-busy={estado === "publicando"} onClick={() => void publicar()}>
              {estado === "publicando" ? t.criar.publicando : t.criar.publicar}
            </button>
          </div>
        </div>
      </div>

      {progresso ? (
        <div className="al-ed-progresso" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-prog`} aria-describedby={`${id}-prog-ajuda`}>
          <svg viewBox="0 0 120 120" className="al-ed-progresso-anel" aria-hidden data-fase={progresso.fase}>
            <circle cx="60" cy="60" r="52" className="al-ed-progresso-trilho" />
            <circle cx="60" cy="60" r="52" className="al-ed-progresso-cheio" style={{ strokeDasharray: R, strokeDashoffset: R * (1 - progresso.pct / 100) }} />
          </svg>
          <p id={`${id}-prog`} className="al-ed-progresso-texto">
            {progresso.fase === "preparando"
              ? preencherStory(t.criar.progresso.preparando, { pct: progresso.pct })
              : progresso.fase === "foto"
                ? t.criar.progresso.foto
                : progresso.fase === "enviando"
                  ? preencherStory(t.criar.progresso.enviando, { pct: progresso.pct })
                  : t.criar.progresso.publicando}
          </p>
          <p id={`${id}-prog-ajuda`} className="al-st-dica">
            {midia?.tipo === "video" ? t.criar.progresso.ajuda : t.criar.progresso.ajudaFoto}
          </p>
          {progresso.fase === "preparando" || progresso.fase === "foto" ? (
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" autoFocus onClick={() => cancelar.current?.abort()}>
              {t.criar.progresso.cancelar}
            </button>
          ) : null}
        </div>
      ) : null}

      {camera ? (
        <Camera
          t={t.camera}
          aoFoto={(b) => void aoEscolherArquivo(b, "camera")}
          aoVideo={(b) => void aoEscolherArquivo(b, "camera")}
          aoGaleria={() => {
            setCamera(false);
            galeria.current?.click();
          }}
          aoFechar={() => setCamera(false)}
        />
      ) : null}

      {borrar && tp ? (
        <BorrarRostos
          t={tp}
          base={borrar.base}
          areasIniciais={borrar.tipo === "foto" ? (fotoOriginal?.areas ?? []) : borroesDoVideo}
          aoCancelar={() => setBorrar(null)}
          aoConcluir={async (areas) => {
            const b = borrar;
            setBorrar(null);
            if (b.tipo === "video") return setBorroesDoVideo(areas);
            if (!midia || midia.tipo !== "imagem") return;
            try {
              // A original fica guardada só aqui (para refazer o borrado); o que sai do aparelho é a borrada.
              const nova = await aplicarBorrado(b.base, areas);
              setFotoOriginal({ blob: b.base, areas });
              setMidia({ tipo: "imagem", blob: nova, url: URL.createObjectURL(nova) });
            } catch {
              setErro(t.b1.borrar.erro);
            }
          }}
        />
      ) : null}

      {recortando && midia?.tipo === "imagem" ? (
        <Recortar
          t={t.b1.recortar}
          imagem={midia.blob}
          aoCancelar={() => setRecortando(false)}
          aoAplicar={(b) => {
            setRecortando(false);
            // Recortou: o borrado anterior já está queimado na foto recortada (a original não volta).
            setFotoOriginal(null);
            setTransf(SEM_TRANSFORMACAO);
            setMidia({ tipo: "imagem", blob: b, url: URL.createObjectURL(b) });
          }}
        />
      ) : null}

      {rodaAberta ? <RodaDeConfianca t={t.b1.roda} lang={lang} cliente={cliente} aoFechar={() => setRodaAberta(false)} /> : null}

      {confirmarSaida ? (
        <div className="al-st-caixa" role="alertdialog" aria-labelledby={`${id}-sair`} style={{ position: "fixed", zIndex: 90 }}>
          <h2 id={`${id}-sair`}>{t.criar.descartar}</h2>
          <div className="al-st-caixa-acoes">
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setConfirmarSaida(false)}>
              {t.criar.descartarNao}
            </button>
            <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={aoFechar}>
              {t.criar.descartarSim}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
