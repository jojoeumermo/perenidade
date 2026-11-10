// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as EventoDePonteiro } from "react";
import { armazemDoAparelho, alternarSilencio, marcarVisto } from "@/lib/rede/stories/aparelho";
import { haQuanto, noAr } from "@/lib/rede/stories/tempo";
import { barrasDoProgresso, duracaoNaTela, estiloDoTexto, tamanhoDoTexto } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { CATEGORIAS_DE_DENUNCIA, type CategoriaDeDenuncia } from "@/lib/rede/tipos-moderacao";
import { LIMITES_DO_STORY, REACOES_DO_STORY, type FigurinhaEnquete, type ReacaoDoStory, type Story } from "@/lib/rede/tipos-stories";
import { ComunidadeVer } from "../figurinhas/Comunidade";
import { ContagemVer } from "../figurinhas/Contagem";
import { EnqueteVer } from "../figurinhas/Enquete";
import { LinkVer } from "../figurinhas/Link";
import { PerguntaVer } from "../figurinhas/Pergunta";
import { Avatar16 } from "../ui/Avatar16";
import { FundoDoStory, estiloDaTela } from "./FundoDoStory";
import { GuardarNoDestaque } from "./GuardarNoDestaque";
import { IconeFechar, IconePausar, IconeSetaDir, IconeSetaEsq, IconeTocar, IconeTresPontos } from "./icones";
import { codigoDoErro, focarNoGrupo, indiceDaSeta, larguraDaTela, preencherStory, useAgora, useModalDosStories } from "./usar";

/** As reações da prancha (conjunto fechado, sem emoji livre: PLANO-ALUMIA §12). */
const DESENHO_DA_REACAO: Record<ReacaoDoStory, string> = { punho: "✊", chama: "\u{1F525}", coracao: "❤️" };

type Caixa = null | "menu" | "denunciar" | "apagar" | "guardar";

/** O som vale para a sessão inteira (só na memória deste aparelho, como no Instagram: ligou uma vez, fica ligado). */
const somDaSessao = { mudo: false };
/** A chave de cada festa de reação (só para o React saber que é outra). */
const contagemDeExplosoes = { n: 0 };
const novaExplosao = () => ++contagemDeExplosoes.n;

const IconeSom = ({ ligado }: { ligado: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
    {ligado ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
);

/** Movimento reduzido (o do sistema ou o "parado" do site): sem cubo, sem mola, troca seca. */
function semMovimento(): boolean {
  if (typeof window === "undefined") return true;
  return document.documentElement.hasAttribute("data-parado") || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * O visor em tela cheia (prancha celular-ver-story), como o do Instagram: barras de progresso (o vídeo anda a barra no tempo dele,
 * até 60 s), quem publicou e para quem, som, pausar, mais opções e fechar; o texto grande com a fonte e a cor que a autora
 * escolheu, a tarja e as figurinhas que funcionam (contagem do ato, enquete secreta, pergunta, link, menção de comunidade); e
 * embaixo "Responder só para…" e as três reações — tudo vai SÓ para a autora. Nada aqui conta ao servidor que eu vi: o "visto" é
 * marcado só no aparelho (PLANO-ALUMIA §6.4; LGPD art. 11, opinião política é dado sensível).
 *
 * Toque: esquerda volta, direita avança, segurar pausa (e esconde o resto da tela); deslizar para o lado troca de pessoa com o
 * cubo; para baixo fecha; para cima abre a resposta. Teclado: setas trocam, espaço pausa, M liga o som, Esc fecha; o Tab não sai
 * do visor. Com `destaque`, mostra os stories guardados num destaque do perfil (sem prazo, mesmo público).
 */
export function Visor({
  t,
  cliente,
  lang,
  handle,
  inicio = 0,
  fila = [],
  destaque = null,
  aoFechar,
  aoMudou,
}: {
  t: TextosDosStories;
  cliente: ClienteDeStories;
  lang: string;
  /** De quem ("eu" = os meus). */
  handle: string;
  inicio?: number;
  /** As autoras da faixa, na ordem: ao acabar uma, o visor passa para a seguinte (e volta para a anterior). */
  fila?: string[];
  /** Os stories de um destaque do perfil, em vez dos que estão no ar. */
  destaque?: { id: string; titulo: string } | null;
  aoFechar: () => void;
  /** Algo mudou (vi, apaguei, silenciei, guardei): a faixa relê. */
  aoMudou?: () => void;
}) {
  const [quem, setQuem] = useState(handle);
  const [stories, setStories] = useState<Story[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [i, setI] = useState(inicio);
  const [fracao, setFracao] = useState(0);
  const [pausadoPelaPessoa, setPausadoPelaPessoa] = useState(false);
  const [segurando, setSegurando] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [caixa, setCaixa] = useState<Caixa>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [resposta, setResposta] = useState("");
  const [reacaoFeita, setReacaoFeita] = useState<{ id: string; r: ReacaoDoStory } | null>(null);
  const [explosao, setExplosao] = useState<{ r: ReacaoDoStory; n: number } | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDeDenuncia | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const [mudo, setMudoAgora] = useState(somDaSessao.mudo);
  const [somBloqueado, setSomBloqueado] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const agora = useAgora(15_000);
  const raiz = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const campoResposta = useRef<HTMLInputElement>(null);
  const botaoMais = useRef<HTMLButtonElement>(null);
  /** Quando o dedo desceu numa área de toque: soltar depois de ~250 ms foi "segurar" (pausa), não um toque que troca. */
  const tocouEm = useRef(0);
  /** O gesto em andamento (deslizar para o lado, para baixo ou para cima). */
  const gesto = useRef<{ id: number; x0: number; y0: number; t0: number; eixo: null | "x" | "baixo" | "cima"; dx: number; dy: number } | null>(null);
  const arrastou = useRef(false);
  /** Os stories da próxima/anterior pessoa, buscados enquanto o dedo ainda desliza (a troca já chega pronta). */
  const precarga = useRef<{ handle: string; lista: Promise<Story[]> } | null>(null);
  const idDoTitulo = useId();
  useModalDosStories(raiz);

  const setMudo = (m: boolean) => {
    somDaSessao.mudo = m;
    setMudoAgora(m);
    setSomBloqueado(false);
  };

  // Carrega os stories da autora (ou os meus, ou os do destaque). Uma leitura igual a abrir um perfil: o servidor não registra quem abriu.
  const idDoDestaque = destaque?.id ?? null;
  useEffect(() => {
    let vivo = true;
    const pronto = precarga.current?.handle === quem && !idDoDestaque ? precarga.current.lista : null;
    precarga.current = null;
    (pronto ?? (idDoDestaque ? cliente.destaque(idDoDestaque) : quem === "eu" ? cliente.meus() : cliente.abrir(quem)))
      .then((lista) => {
        if (!vivo) return;
        setStories(lista);
        setErro(null);
      })
      .catch((e) => vivo && setErro(codigoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [cliente, quem, idDoDestaque]);

  // No destaque não há prazo (o banco já mandou só o que eu posso ver); nos outros, só o que ainda está no ar.
  const vivos = stories ? (destaque ? stories : stories.filter((s) => noAr(s.expira_em, agora))) : null;
  const atual = vivos && vivos.length > 0 ? vivos[Math.min(i, vivos.length - 1)] : null;
  const ehVideo = atual?.fundo.tipo === "video" && !!atual.fundo.url;
  const temSom = ehVideo && atual?.fundo.tipo === "video" && atual.fundo.som;
  const pausado = pausadoPelaPessoa || segurando || digitando || caixa !== null || ocupado || trocando;

  // Foco no visor ao abrir (o teclado já funciona) e de volta para onde estava ao fechar.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    raiz.current?.focus();
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = rolagem;
      antes?.focus?.();
    };
  }, []);

  // Marca como visto SÓ neste aparelho.
  useEffect(() => {
    if (!atual) return;
    marcarVisto(armazemDoAparelho(), atual.id, Date.now());
    aoMudou?.();
    // aoMudou muda a cada render do pai; só o story importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id]);

  const fracaoAtual = useRef(0);
  const zerar = () => {
    fracaoAtual.current = 0;
    setFracao(0);
    setResposta("");
    setEsperando(false);
    if (video.current) video.current.currentTime = 0;
  };

  // ── Trocar de pessoa, com o cubo (ou seco, com movimento reduzido) ──
  const vizinha = useCallback(
    (direcao: 1 | -1): string | undefined => {
      if (idDoDestaque) return undefined;
      const k = fila.indexOf(quem);
      if (direcao === 1) return quem === "eu" ? fila[0] : k >= 0 ? fila[k + 1] : undefined;
      return k > 0 ? fila[k - 1] : undefined;
    },
    [idDoDestaque, fila, quem],
  );
  const precarregar = useCallback(
    (h: string | undefined) => {
      if (!h || precarga.current?.handle === h) return;
      precarga.current = { handle: h, lista: h === "eu" ? cliente.meus() : cliente.abrir(h) };
      precarga.current.lista.catch(() => undefined);
    },
    [cliente],
  );

  const girar = useCallback(async (direcao: 1 | -1, trocar: () => void, deOnde = 0) => {
    const el = tela.current;
    if (!el || semMovimento() || !el.animate) {
      trocar();
      return;
    }
    setTrocando(true);
    const sai = direcao === 1 ? "translateX(-100%) rotateY(-90deg)" : "translateX(100%) rotateY(90deg)";
    const entra = direcao === 1 ? "translateX(100%) rotateY(90deg)" : "translateX(-100%) rotateY(-90deg)";
    el.style.transformOrigin = direcao === 1 ? "100% 50%" : "0% 50%";
    const de = el.style.transform || "none";
    try {
      await el.animate([{ transform: de }, { transform: sai }], { duration: Math.max(140, 300 * (1 - deOnde)), easing: "cubic-bezier(.45,0,.75,.6)", fill: "forwards" }).finished;
    } catch {
      /* interrompida */
    }
    trocar();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    el.getAnimations().forEach((a) => a.cancel());
    el.style.transform = "";
    el.style.transformOrigin = direcao === 1 ? "0% 50%" : "100% 50%";
    const a = el.animate([{ transform: entra, filter: "brightness(.55)" }, { transform: "none", filter: "brightness(1)" }], { duration: 360, easing: "cubic-bezier(.2,.85,.3,1.04)" });
    a.finished.finally(() => {
      el.style.transformOrigin = "";
      setTrocando(false);
    });
  }, []);

  const irPara = useCallback(
    (h: string, direcao: 1 | -1, deOnde = 0) => {
      precarregar(h);
      void girar(
        direcao,
        () => {
          setStories(null);
          setQuem(h);
          setI(0);
          zerar();
        },
        deOnde,
      );
    },
    [girar, precarregar],
  );

  const proximaAutora = useCallback(() => {
    const seguinte = vizinha(1);
    if (seguinte) irPara(seguinte, 1);
    else aoFechar();
  }, [aoFechar, irPara, vizinha]);

  const avancar = useCallback(() => {
    if (!vivos) return;
    if (i + 1 < vivos.length) {
      setI(i + 1);
      zerar();
    } else proximaAutora();
  }, [i, proximaAutora, vivos]);

  const voltar = useCallback(() => {
    if (i > 0) {
      zerar();
      setI(i - 1);
      return;
    }
    const anterior = vizinha(-1);
    if (anterior) irPara(anterior, -1);
    else zerar();
  }, [i, irPara, vizinha]);
  const avancarAgora = useRef(avancar);
  useEffect(() => {
    avancarAgora.current = avancar;
  }, [avancar]);

  // O relógio da barra: no vídeo, o tempo do próprio vídeo (parado quando ele espera a rede); no resto, 6 ou 10 s. Anda só com o
  // story à vista e sem pausa (tela escondida também pausa).
  const duracao = atual ? duracaoNaTela(atual) : 6000;
  useEffect(() => {
    if (!atual || pausado) {
      video.current?.pause();
      return;
    }
    const v = ehVideo ? video.current : null;
    // Sem permissão de tocar com som (o navegador pede um toque antes): o vídeo passa a mudo (somBloqueado) e mostra "Toque para
    // ouvir"; este efeito roda de novo e toca mudo.
    v?.play().catch(() => {
      if (temSom && !mudo && !somBloqueado) setSomBloqueado(true);
    });
    let anterior = performance.now();
    let quadro = 0;
    const passo = (t0: number) => {
      if (v) {
        const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration * 1000 : duracao;
        fracaoAtual.current = Math.min(1, (v.currentTime * 1000) / d);
        if (v.ended) fracaoAtual.current = 1;
      } else {
        const dt = document.hidden ? 0 : t0 - anterior;
        fracaoAtual.current = Math.min(1, fracaoAtual.current + dt / duracao);
      }
      anterior = t0;
      setFracao(fracaoAtual.current);
      if (fracaoAtual.current >= 1) avancarAgora.current();
      else quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      v?.pause();
    };
  }, [atual, pausado, duracao, ehVideo, mudo, temSom, somBloqueado]);

  // Teclado.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.key === "Escape") {
        e.preventDefault();
        if (caixa) setCaixa(null);
        else aoFechar();
        return;
      }
      // Espaço e setas só valem com o foco no próprio visor (ou numa área de toque): num botão, o Espaço aciona o botão
      // (WCAG 2.1.1); num campo, escreve.
      const livre = !alvo || alvo === raiz.current || alvo === document.body || alvo.classList.contains("al-st-toque");
      if (!livre || caixa) return;
      if (e.key === "ArrowRight") avancar();
      else if (e.key === "ArrowLeft") voltar();
      else if (e.key === " ") {
        e.preventDefault();
        setPausadoPelaPessoa((p) => !p);
      } else if ((e.key === "m" || e.key === "M") && temSom) setMudo(!mudo);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, avancar, voltar, caixa, temSom, mudo]);

  // O foco acompanha a caixa aberta: o menu leva ao primeiro item, a denúncia à primeira categoria, o "apagar" ao Cancelar; ao
  // fechar qualquer uma, volta ao botão ⋯.
  const caixaAntes = useRef<Caixa>(null);
  useEffect(() => {
    const antes = caixaAntes.current;
    caixaAntes.current = caixa;
    const r = raiz.current;
    if (!r) return;
    if (caixa === "menu") r.querySelector<HTMLElement>(".al-st-menu [role=menuitem]")?.focus();
    else if (caixa === "denunciar") r.querySelector<HTMLElement>(".al-st-caixa input[type=radio]")?.focus();
    else if (caixa === "apagar") r.querySelector<HTMLElement>(".al-st-caixa .al-botao")?.focus();
    else if (caixa === "guardar") r.querySelector<HTMLElement>(".al-st-guardar button, .al-st-guardar input")?.focus();
    else if (antes) botaoMais.current?.focus();
  }, [caixa]);

  // Sem stories (sumiram ou nada a ver): segue para a próxima autora.
  useEffect(() => {
    if (vivos && vivos.length === 0 && !erro) {
      const id = window.setTimeout(proximaAutora, 1200);
      return () => window.clearTimeout(id);
    }
  }, [vivos, erro, proximaAutora]);

  const avisar = (texto: string) => {
    setRecado(texto);
    window.setTimeout(() => setRecado((r) => (r === texto ? null : r)), 3200);
  };

  const nome = atual?.autora.nome ?? "";
  const reagiu = reacaoFeita && atual && reacaoFeita.id === atual.id ? reacaoFeita.r : null;
  const meu = !!atual?.meu;

  async function enviarResposta(texto: string): Promise<boolean> {
    if (!atual) return false;
    setOcupado(true);
    try {
      await cliente.responder(atual.id, texto.slice(0, LIMITES_DO_STORY.resposta));
      avisar(preencherStory(t.visor.enviado, { nome }));
      return true;
    } catch {
      avisar(t.visor.erroAoEnviar);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function reagir(r: ReacaoDoStory) {
    if (!atual || ocupado) return;
    setOcupado(true);
    const n = novaExplosao();
    setExplosao({ r, n });
    window.setTimeout(() => setExplosao((x) => (x && x.n === n ? null : x)), 1400);
    try {
      await cliente.reagir(atual.id, r);
      setReacaoFeita({ id: atual.id, r });
      avisar(preencherStory(t.visor.reagiu, { reacao: t.visor.reacao[r], nome }));
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  function trocarFigurinha(id: string, nova: Partial<FigurinhaEnquete> | { avisar: boolean }, tipo: "enquete" | "contagem") {
    setStories((lista) =>
      lista?.map((s) => (s.id !== id ? s : { ...s, figurinhas: s.figurinhas.map((f) => (f.tipo === tipo ? ({ ...f, ...nova } as typeof f) : f)) })) ?? null,
    );
  }

  async function votar(opcao: 0 | 1) {
    if (!atual) return;
    setOcupado(true);
    try {
      const f = await cliente.votar(atual.id, opcao);
      trocarFigurinha(atual.id, { meu_voto: f.meu_voto ?? opcao }, "enquete");
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  async function pedirAviso(sim: boolean) {
    if (!atual) return;
    setOcupado(true);
    try {
      const r = await cliente.avisar(atual.id, sim);
      trocarFigurinha(atual.id, { avisar: r.avisar }, "contagem");
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  async function denunciar() {
    if (!atual || !categoria) return;
    setOcupado(true);
    try {
      const r = await cliente.denunciar(atual.id, categoria, detalhe.trim());
      setCaixa(null);
      setCategoria(null);
      setDetalhe("");
      avisar(preencherStory(t.visor.denunciaEnviada, { protocolo: r.protocolo }));
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    if (!atual) return;
    setOcupado(true);
    try {
      await cliente.apagar(atual.id);
      setCaixa(null);
      setStories((lista) => lista?.filter((s) => s.id !== atual.id) ?? null);
      aoMudou?.();
      avisar(t.visor.apagado);
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  async function tirarDoDestaque() {
    if (!atual || !destaque) return;
    setOcupado(true);
    try {
      await cliente.tirarDoDestaque(destaque.id, atual.id);
      setCaixa(null);
      setStories((lista) => lista?.filter((s) => s.id !== atual.id) ?? null);
      aoMudou?.();
      avisar(t.destaques.tirado);
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  function silenciar() {
    if (!atual) return;
    alternarSilencio(armazemDoAparelho(), atual.autora.handle, true);
    aoMudou?.();
    setCaixa(null);
    avisar(preencherStory(t.visor.silenciado, { nome }));
    window.setTimeout(proximaAutora, 1500);
  }

  // ── Gestos no palco: deslizar para o lado (cubo), para baixo (fechar) e para cima (responder) ──
  const ignorarGesto = (alvo: EventTarget | null) =>
    alvo instanceof Element && !!alvo.closest("a, input, textarea, select, label, .al-st-menu, .al-st-caixa, .al-st-topo button, .al-fg button, .al-st-seta");
  const aoBaixar = (e: EventoDePonteiro<HTMLDivElement>) => {
    if (caixa || trocando || ignorarGesto(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
    gesto.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), eixo: null, dx: 0, dy: 0 };
    arrastou.current = false;
  };
  const aoMover = (e: EventoDePonteiro<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    g.dx = e.clientX - g.x0;
    g.dy = e.clientY - g.y0;
    if (!g.eixo) {
      if (Math.hypot(g.dx, g.dy) < 12) return;
      g.eixo = Math.abs(g.dx) > Math.abs(g.dy) ? "x" : g.dy > 0 ? "baixo" : "cima";
      e.currentTarget.setPointerCapture(e.pointerId);
      setSegurando(true);
      if (g.eixo === "x") precarregar(vizinha(g.dx < 0 ? 1 : -1));
    }
    const el = tela.current;
    const p = palco.current;
    if (!el || !p || semMovimento()) return;
    if (g.eixo === "x") {
      const w = el.clientWidth || 1;
      const temVizinha = !!vizinha(g.dx < 0 ? 1 : -1);
      // Sem vizinha, o cubo resiste (borracha); com ela, gira até 90°.
      const q = Math.min(1, Math.abs(g.dx) / w) * (temVizinha ? 1 : 0.18);
      el.style.transformOrigin = g.dx < 0 ? "100% 50%" : "0% 50%";
      el.style.transform = g.dx < 0 ? `translateX(${-q * 100}%) rotateY(${-q * 90}deg)` : `translateX(${q * 100}%) rotateY(${q * 90}deg)`;
    } else if (g.eixo === "baixo") {
      const dy = Math.max(0, g.dy);
      p.style.transform = `translateY(${dy}px) scale(${1 - Math.min(0.22, dy / 1800)})`;
      raiz.current?.style.setProperty("--al-st-escurece", String(Math.max(0, 1 - dy / 500)));
    }
  };
  const aoSoltar = (e: EventoDePonteiro<HTMLDivElement>) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.id !== e.pointerId) return;
    if (!g.eixo) return;
    arrastou.current = true;
    setSegurando(false);
    const el = tela.current;
    const p = palco.current;
    const ms = Math.max(1, performance.now() - g.t0);
    const voltarAoLugar = (alvo: HTMLElement | null) => {
      if (!alvo) return;
      const de = alvo.style.transform;
      alvo.style.transform = "";
      if (!de || semMovimento() || !alvo.animate) return;
      alvo.animate([{ transform: de }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,1.35,.35,1)" }).finished.finally(() => {
        alvo.style.transformOrigin = "";
      });
    };
    if (g.eixo === "x") {
      const direcao: 1 | -1 = g.dx < 0 ? 1 : -1;
      const destino = vizinha(direcao);
      const w = el?.clientWidth || 1;
      const q = Math.abs(g.dx) / w;
      if (destino && (q > 0.28 || Math.abs(g.dx) / ms > 0.55)) irPara(destino, direcao, Math.min(0.9, q));
      else voltarAoLugar(el);
    } else if (g.eixo === "baixo") {
      raiz.current?.style.removeProperty("--al-st-escurece");
      if (g.dy > 110 || g.dy / ms > 0.6) {
        if (p && !semMovimento() && p.animate) {
          const de = p.style.transform || "none";
          p.animate([{ transform: de, opacity: 1 }, { transform: "translateY(60%) scale(.8)", opacity: 0 }], { duration: 220, easing: "ease-in", fill: "forwards" }).finished.finally(aoFechar);
        } else aoFechar();
      } else voltarAoLugar(p);
    } else if (g.eixo === "cima" && g.dy < -70 && !meu && !destaque) {
      campoResposta.current?.focus();
    }
  };

  const quando = atual ? haQuanto(atual.criado_em, agora) : null;
  const quandoTexto = !quando || destaque ? "" : quando.unidade === "agora" ? t.visor.agora : quando.unidade === "min" ? preencherStory(t.visor.min, { n: quando.n }) : preencherStory(t.visor.h, { n: Math.min(23, quando.unidade === "d" ? 23 : quando.n) });
  const barras = vivos ? barrasDoProgresso(vivos.length, Math.min(i, vivos.length - 1), fracao) : [];
  const est = atual ? estiloDoTexto(atual.estilo, atual.fundo.cor) : null;
  const temAnterior = i > 0 || !!vizinha(-1);

  return (
    <div
      ref={raiz}
      className="al-st-visor"
      role="dialog"
      aria-modal="true"
      aria-labelledby={idDoTitulo}
      aria-describedby={`${idDoTitulo}-ajuda`}
      tabIndex={-1}
      data-segurando={segurando && !digitando && !caixa ? "sim" : "nao"}
    >
      <p id={`${idDoTitulo}-ajuda`} className="sr-only">
        {t.visor.ajuda} {t.visor.ajudaToque}
      </p>
      <div ref={palco} className="al-st-visor-palco" onPointerDown={aoBaixar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}>
        <div ref={tela} className="al-st-tela" style={atual ? estiloDaTela(atual.fundo.cor) : undefined}>
          {atual ? (
            <FundoDoStory
              key={atual.id}
              tipo={atual.fundo.tipo}
              cor={atual.fundo.cor}
              semente={atual.id}
              url={atual.fundo.tipo === "imagem" || atual.fundo.tipo === "video" ? atual.fundo.url : undefined}
              alt={atual.fundo.tipo === "imagem" ? atual.fundo.alt || t.visor.imagem : atual.fundo.tipo === "video" ? atual.fundo.alt || t.visor.video : undefined}
              videoRef={video}
              mudo={mudo || !temSom || somBloqueado}
              aoEsperar={() => setEsperando(true)}
              aoTocar={() => setEsperando(false)}
            />
          ) : null}

          <ol className="al-st-barras" aria-label={atual && vivos ? preencherStory(t.visor.progresso, { i: Math.min(i, vivos.length - 1) + 1, n: vivos.length }) : undefined}>
            {barras.map((b, k) => (
              <li key={k} className="al-st-barra" aria-hidden>
                <span style={{ transform: `scaleX(${b})` }} />
              </li>
            ))}
          </ol>

          <div className="al-st-topo">
            <div className="al-st-topo-quem">
              {atual ? <Avatar16 handle={atual.autora.handle} cor={atual.autora.cor ?? undefined} tamanho={38} /> : null}
              <span className="al-st-topo-nome">
                <strong id={idDoTitulo}>
                  {atual ? (meu && !destaque ? t.visor.seu : nome) : t.visor.carregando}
                  {quandoTexto ? <span> · {quandoTexto}</span> : null}
                </strong>
                {destaque ? <small>{preencherStory(t.visor.destaque, { titulo: destaque.titulo })}</small> : atual ? <small>{t.visor.publico[atual.publico]}</small> : null}
              </span>
            </div>
            {ehVideo ? (
              temSom ? (
                <button type="button" className="al-st-icone" aria-label={mudo || somBloqueado ? t.visor.som : t.visor.mudo} aria-pressed={!(mudo || somBloqueado)} onClick={() => setMudo(!(mudo || somBloqueado) )}>
                  <IconeSom ligado={!(mudo || somBloqueado)} />
                </button>
              ) : (
                <span className="al-st-icone al-st-icone-mudo" role="img" aria-label={t.visor.semSomNoVideo} title={t.visor.semSomNoVideo}>
                  <IconeSom ligado={false} />
                </span>
              )
            ) : null}
            <button
              type="button"
              className="al-st-icone"
              aria-label={pausadoPelaPessoa ? t.visor.continuar : t.visor.pausar}
              aria-pressed={pausadoPelaPessoa}
              onClick={() => setPausadoPelaPessoa((p) => !p)}
            >
              {pausadoPelaPessoa ? <IconeTocar /> : <IconePausar />}
            </button>
            <button
              type="button"
              className="al-st-icone"
              aria-label={t.visor.mais}
              ref={botaoMais}
              aria-haspopup="menu"
              aria-expanded={caixa === "menu"}
              disabled={!atual}
              onClick={() => setCaixa((c) => (c === "menu" ? null : "menu"))}
            >
              <IconeTresPontos />
            </button>
            <button type="button" className="al-st-icone" aria-label={t.visor.fechar} onClick={aoFechar}>
              <IconeFechar />
            </button>
          </div>

          {somBloqueado && temSom ? (
            <button type="button" className="al-st-ouvir" onClick={() => setMudo(false)}>
              <IconeSom ligado={false} /> {t.visor.tocarParaOuvir}
            </button>
          ) : null}
          {ehVideo && esperando && !pausado ? <span className="al-st-girando" role="status" aria-label={t.visor.carregandoVideo} /> : null}

          {/* Toque: esquerda volta, direita avança, segurar pausa. Atrás do texto e das figurinhas. */}
          {(["esq", "dir"] as const).map((lado) => (
            <button
              key={lado}
              type="button"
              className={`al-st-toque al-st-toque-${lado}`}
              aria-label={lado === "esq" ? t.visor.anterior : t.visor.proximo}
              tabIndex={-1}
              onClick={() => {
                const segurou = tocouEm.current > 0 && performance.now() - tocouEm.current > 250;
                tocouEm.current = 0;
                if (segurou || arrastou.current) {
                  arrastou.current = false;
                  return;
                }
                if (lado === "esq") voltar();
                else avancar();
              }}
              onPointerDown={() => {
                tocouEm.current = performance.now();
                setSegurando(true);
              }}
              onPointerUp={() => setSegurando(false)}
              onPointerLeave={() => setSegurando(false)}
              onPointerCancel={() => {
                tocouEm.current = 0;
                setSegurando(false);
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))}

          {atual && est ? (
            <div key={atual.id} className="al-st-miolo al-st-entra" style={{ "--st-tamanho": `${tamanhoDoTexto(atual.texto, larguraDaTela())}px` } as CSSProperties}>
              {atual.texto ? (
                <h2
                  className={`al-st-texto${est.caixa ? "" : " al-st-texto-sombra"}`}
                  data-fonte={est.fonte}
                  data-caixa={est.caixa ? "sim" : "nao"}
                  style={{ fontFamily: est.familia, color: est.cor, textAlign: est.alinhar === "esq" ? "left" : est.alinhar === "dir" ? "right" : "center" }}
                >
                  {est.caixa ? <span style={{ background: est.caixa }}>{atual.texto}</span> : atual.texto}
                </h2>
              ) : null}
              {atual.legenda ? <p className="al-st-tarja">{atual.legenda}</p> : null}
              {atual.figurinhas.length > 0 ? (
                <div className="al-st-figurinhas">
                  {atual.figurinhas.map((f, k) =>
                    f.tipo === "contagem" ? (
                      <ContagemVer key={k} f={f} t={t.figurinha.contagem} agora={agora} lang={lang} ocupado={ocupado} aoAvisar={meu ? null : pedirAviso} />
                    ) : f.tipo === "enquete" ? (
                      <EnqueteVer key={k} f={f} t={t.figurinha.enquete} nome={nome.split(" ")[0]} meu={meu} ocupado={ocupado} aoVotar={votar} />
                    ) : f.tipo === "pergunta" ? (
                      <PerguntaVer key={k} texto={f.texto} t={t.figurinha.pergunta} nome={nome.split(" ")[0]} meu={meu} enviar={enviarResposta} aoFoco={setDigitando} />
                    ) : f.tipo === "comunidade" ? (
                      <ComunidadeVer key={k} slug={f.slug} nome={f.nome} lang={lang} t={t.figurinha.comunidade} />
                    ) : (
                      <LinkVer key={k} url={f.url} rotulo={f.rotulo} t={t.figurinha.link} />
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="al-st-estado" role="status">
              {erro ? (erro === "banco" ? t.criar.erro.banco : t.visor.erro) : vivos && vivos.length === 0 ? t.visor.sumiu : t.visor.carregando}
            </p>
          )}

          {explosao ? (
            <span key={explosao.n} className="al-st-explosao" aria-hidden>
              {Array.from({ length: 9 }, (_, k) => (
                <span key={k} style={{ "--k": k, "--x": `${((k * 37) % 9) * 11 - 44}px`, "--atraso": `${(k % 4) * 60}ms` } as CSSProperties}>
                  {DESENHO_DA_REACAO[explosao.r]}
                </span>
              ))}
            </span>
          ) : null}

          {caixa === "menu" && atual ? (
            <ul
              className="al-st-menu"
              role="menu"
              aria-label={t.visor.mais}
              onKeyDown={(e) => {
                const itens = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"));
                const k = indiceDaSeta(e.key, Math.max(0, itens.indexOf(document.activeElement as HTMLElement)), itens.length, "vertical");
                if (k === null) {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    setCaixa(null);
                  }
                  return;
                }
                e.preventDefault();
                focarNoGrupo(e.target as HTMLElement, "[role=menuitem]", k);
              }}
            >
              {meu ? (
                <>
                  {destaque ? (
                    <li role="none">
                      <button type="button" role="menuitem" tabIndex={-1} onClick={() => void tirarDoDestaque()}>
                        {t.visor.tirarDoDestaque}
                      </button>
                    </li>
                  ) : (
                    <li role="none">
                      <button type="button" role="menuitem" tabIndex={-1} onClick={() => setCaixa("guardar")}>
                        {t.visor.guardar}
                      </button>
                    </li>
                  )}
                  <li role="none">
                    <button type="button" role="menuitem" tabIndex={-1} className="al-st-perigo" onClick={() => setCaixa("apagar")}>
                      {t.visor.apagar}
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li role="none">
                    <button type="button" role="menuitem" tabIndex={-1} onClick={silenciar}>
                      {preencherStory(t.visor.silenciar, { nome })}
                    </button>
                  </li>
                  <li role="none">
                    <button type="button" role="menuitem" tabIndex={-1} className="al-st-perigo" onClick={() => setCaixa("denunciar")}>
                      {t.visor.denunciar}
                    </button>
                  </li>
                </>
              )}
            </ul>
          ) : null}

          {caixa === "guardar" && atual ? (
            <GuardarNoDestaque
              t={t}
              cliente={cliente}
              story={atual}
              aoFechar={() => setCaixa(null)}
              aoGuardar={(texto, d) => {
                setStories((lista) => lista?.map((s) => (s.id === atual.id ? { ...s, destaques: [...(s.destaques ?? []), d] } : s)) ?? null);
                setCaixa(null);
                aoMudou?.();
                avisar(texto);
              }}
            />
          ) : null}

          {caixa === "denunciar" ? (
            <form
              className="al-st-caixa"
              aria-labelledby={`${idDoTitulo}-den`}
              onSubmit={(e) => {
                e.preventDefault();
                void denunciar();
              }}
            >
              <h2 id={`${idDoTitulo}-den`}>{t.visor.denunciaTitulo}</h2>
              <p>{t.visor.denunciaAjuda}</p>
              <fieldset>
                <legend className="sr-only">{t.visor.denunciaTitulo}</legend>
                {CATEGORIAS_DE_DENUNCIA.map((c) => (
                  <label key={c}>
                    <input type="radio" name="categoria" value={c} checked={categoria === c} onChange={() => setCategoria(c)} />
                    {t.visor.categorias[c]}
                  </label>
                ))}
              </fieldset>
              <textarea value={detalhe} maxLength={500} onChange={(e) => setDetalhe(e.target.value)} aria-label={t.visor.denunciaTitulo} />
              <div className="al-st-caixa-acoes">
                <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setCaixa(null)}>
                  {t.visor.cancelar}
                </button>
                <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={!categoria || ocupado}>
                  {t.visor.denunciaEnviar}
                </button>
              </div>
            </form>
          ) : null}

          {caixa === "apagar" ? (
            <div className="al-st-caixa" role="alertdialog" aria-labelledby={`${idDoTitulo}-ap`}>
              <h2 id={`${idDoTitulo}-ap`}>{t.visor.apagarConfirma}</h2>
              <div className="al-st-caixa-acoes">
                <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setCaixa(null)}>
                  {t.visor.cancelar}
                </button>
                <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={ocupado} onClick={() => void apagar()}>
                  {t.visor.apagarSim}
                </button>
              </div>
            </div>
          ) : null}

          {recado ? (
            <p className="al-st-recado" role="status">
              {recado}
            </p>
          ) : null}
        </div>
        <button type="button" className="al-st-seta al-st-seta-esq" aria-label={i === 0 && temAnterior ? t.visor.pessoaAnterior : t.visor.anterior} disabled={!temAnterior} onClick={voltar}>
          <IconeSetaEsq />
        </button>
        <button type="button" className="al-st-seta al-st-seta-dir" aria-label={vivos && i + 1 >= vivos.length && vizinha(1) ? t.visor.proximaPessoa : t.visor.proximo} disabled={!atual} onClick={avancar}>
          <IconeSetaDir />
        </button>
      </div>

      <div className="al-st-rodape">
        {meu || destaque ? (
          <p className="al-st-dica" style={{ margin: "0 6px", color: "inherit" }}>
            {meu ? t.visor.respostasChegam : null}
          </p>
        ) : null}
        {!meu ? (
          <>
            <form
              className="al-st-responder"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = resposta.trim();
                if (r && (await enviarResposta(r))) setResposta("");
              }}
            >
              <label htmlFor={`${idDoTitulo}-r`} className="sr-only">
                {preencherStory(t.visor.responderRotulo, { nome: nome.split(" ")[0] })}
              </label>
              <input
                id={`${idDoTitulo}-r`}
                ref={campoResposta}
                value={resposta}
                maxLength={LIMITES_DO_STORY.resposta}
                placeholder={preencherStory(t.visor.responder, { nome: nome.split(" ")[0] })}
                disabled={!atual || ocupado}
                autoComplete="off"
                enterKeyHint="send"
                onChange={(e) => setResposta(e.target.value)}
                onFocus={() => setDigitando(true)}
                onBlur={() => setDigitando(false)}
              />
              {resposta.trim() ? (
                <button type="submit" className="al-botao al-botao-claro al-botao-m" disabled={ocupado}>
                  {t.visor.enviar}
                </button>
              ) : null}
            </form>
            <div role="group" aria-label={preencherStory(t.visor.reacoes, { nome: nome.split(" ")[0] })} style={{ display: "flex" }}>
              {REACOES_DO_STORY.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="al-st-reacao"
                  aria-label={t.visor.reacao[r]}
                  aria-pressed={reagiu === r}
                  disabled={!atual || ocupado}
                  onClick={() => void reagir(r)}
                >
                  <span aria-hidden>{DESENHO_DA_REACAO[r]}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
