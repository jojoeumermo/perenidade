// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as EventoDePonteiro } from "react";
import { armazemDoAparelho, alternarSilencio, lerSilenciados, lerVistos, marcarVisto, ordenarFaixa } from "@/lib/rede/stories/aparelho";
import { haQuanto, noAr } from "@/lib/rede/stories/tempo";
import { anelEmCss, barrasDoProgresso, duracaoNaTela, estiloDoTexto, PALETA_DO_STORY, posicaoInicial, posicaoValida, tamanhoDoTexto } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { CATEGORIAS_DE_DENUNCIA, type CategoriaDeDenuncia } from "@/lib/rede/tipos-moderacao";
import { LIMITES_DO_STORY, REACOES_DO_STORY, type AutoraDoStory, type Figurinha, type FigurinhaEnquete, type FigurinhaVou, type ReacaoDoStory, type Story } from "@/lib/rede/tipos-stories";
import { ComunidadeVer } from "../figurinhas/Comunidade";
import { ContagemVer } from "../figurinhas/Contagem";
import { EnqueteVer } from "../figurinhas/Enquete";
import { LinkVer } from "../figurinhas/Link";
import { PerguntaVer } from "../figurinhas/Pergunta";
import { DecorativaVer } from "../figurinhas/Decorativas";
import { CampanhaVer, PessoaVer, RespostaVer, VouVer } from "../figurinhas/Novas";
import { legendaNoTempo } from "@/lib/rede/stories/legendas";
import { CartaoDoPostNoStory } from "./CartaoDoPost";
import { CaixaDeRespostas, ResumoDaAutora } from "./Respostas";
import { Avatar16 } from "../ui/Avatar16";
import { estiloDaPosicao } from "./FigurinhaSolta";
import { FundoDoStory, estiloDaTela } from "./FundoDoStory";
import { GuardarNoDestaque } from "./GuardarNoDestaque";
import { IconeFechar, IconePausar, IconeSetaDir, IconeSetaEsq, IconeTocar, IconeTresPontos } from "./icones";
import { avisarDestaques, codigoDoErro, focarNoGrupo, indiceDaSeta, larguraDaTela, preencherStory, useAgora, useModalDosStories } from "./usar";

/** As reações da prancha (conjunto fechado, sem emoji livre: PLANO-ALUMIA §12). */
const DESENHO_DA_REACAO: Record<ReacaoDoStory, string> = { punho: "✊", chama: "\u{1F525}", coracao: "❤️" };

type Caixa = null | "menu" | "denunciar" | "apagar" | "guardar" | "respostas";

/** O som vale para a sessão inteira (só na memória deste aparelho, como no Instagram: ligou uma vez, fica ligado). */
const somDaSessao = { mudo: false };
/** As legendas do vídeo começam ligadas (a acessibilidade de quem vê sem som); desligar vale para a sessão. */
const legendasDaSessao = { ligadas: true };
/** A chave de cada festa de reação (só para o React saber que é outra). */
const contagemDeExplosoes = { n: 0 };
const novaExplosao = () => ++contagemDeExplosoes.n;
const SEM_FILA: string[] = [];

const IconeSom = ({ ligado }: { ligado: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
    {ligado ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
);

/**
 * Como chamar a autora nas frases curtas ("Responda à Rosa"): o nome inteiro quando é curto (organizações e coletivos, como
 * "Passe Livre SP", não viram "Passe"), senão a primeira palavra. O campo de resposta usa o nome inteiro, cortado pelo CSS.
 */
export function nomeDeChamada(nome: string): string {
  const n = nome.trim();
  return n.length <= 16 ? n : (n.split(/\s+/)[0] ?? n);
}

/** O que, com o foco, fica com as setas (o resto do visor usa ← → para trocar de story). */
const DONO_DAS_SETAS = "input, textarea, select, [contenteditable='true'], [role=menu], [role=radiogroup], [role=slider]";

/** As faces do cubo: a que sai e a que entra, para a fração `q` (0 a 1) do giro na direção `d` (1 = próxima). */
function faceQueSai(d: 1 | -1, q: number) {
  return { transform: `translateX(${-d * q * 100}%) rotateY(${-d * q * 90}deg)`, filter: `brightness(${1 - q * 0.45})` };
}
function faceQueEntra(d: 1 | -1, q: number) {
  const r = 1 - q;
  return { transform: r === 0 ? "none" : `translateX(${d * r * 100}%) rotateY(${d * r * 90}deg)`, filter: `brightness(${0.55 + q * 0.45})` };
}

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
  fila = SEM_FILA,
  destaque = null,
  autoras,
  aoFechar,
  aoMudou,
  aoTrocar,
  noStory = null,
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
  /** O rosto e o nome de quem está na fila (as vizinhas aparecem dos lados no computador e na face do cubo que entra). */
  autoras?: Record<string, AutoraDoStory>;
  aoFechar: () => void;
  /** Algo mudou (vi, apaguei, silenciei, guardei): a faixa relê. */
  aoMudou?: () => void;
  /** Passou para outra pessoa ou outro story: o endereço acompanha (?ver=<handle>&i=<i>), para recarregar e compartilhar. */
  aoTrocar?: (handle: string, i: number) => void;
  /** Abrir já neste story (um dos meus) com a caixa de respostas aberta (a caixa geral da tela dos stories). */
  noStory?: string | null;
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
  const [legendasLigadas, setLegendasLigadasAgora] = useState(legendasDaSessao.ligadas);
  const setLegendasLigadas = (sim: boolean) => {
    legendasDaSessao.ligadas = sim;
    setLegendasLigadasAgora(sim);
  };
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
  /** A outra face do cubo: a pessoa que entra, já com o story em que ela vai abrir (ou carregando). */
  const [face, setFace] = useState<{ handle: string; direcao: 1 | -1; story: Story | null } | null>(null);
  const faceAgora = useRef(face);
  useEffect(() => {
    faceAgora.current = face;
  }, [face]);
  const telaVizinha = useRef<HTMLDivElement>(null);
  /** Em que story cada pessoa parou (voltar para alguém retoma dali, como no Instagram). */
  const lembrado = useRef<Record<string, number>>({});
  const idDoTitulo = useId();
  useModalDosStories(raiz);

  const setMudo = (m: boolean) => {
    somDaSessao.mudo = m;
    setMudoAgora(m);
    setSomBloqueado(false);
  };

  // Carrega os stories da autora (ou os meus, ou os do destaque). Uma leitura igual a abrir um perfil: o servidor não registra quem abriu.
  const idDoDestaque = destaque?.id ?? null;
  // Aberto pelo endereço (?ver=@nome, sem a fila da faixa): a fila vem da mesma faixa, na mesma ordem (uma leitura, sem rastro).
  const [filaDaFaixa, setFilaDaFaixa] = useState<string[] | null>(null);
  const [autorasDaFaixa, setAutorasDaFaixa] = useState<Record<string, AutoraDoStory>>({});
  const precisaDaFila = fila.length === 0 && !idDoDestaque;
  useEffect(() => {
    if (!precisaDaFila) return;
    let vivo = true;
    cliente
      .faixa()
      .then((d) => {
        if (!vivo) return;
        const a = armazemDoAparelho();
        setFilaDaFaixa(ordenarFaixa(d.grupos, lerVistos(a, Date.now()), lerSilenciados(a)).map((g) => g.autora.handle));
        setAutorasDaFaixa(Object.fromEntries(d.grupos.map((g) => [g.autora.handle, g.autora])));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [cliente, precisaDaFila]);
  const filaDeVerdade = useMemo(() => (precisaDaFila ? (filaDaFaixa ?? []) : fila), [precisaDaFila, filaDaFaixa, fila]);
  const conhecidas = useMemo(() => ({ ...autorasDaFaixa, ...autoras }), [autorasDaFaixa, autoras]);
  useEffect(() => {
    let vivo = true;
    const pronto = precarga.current?.handle === quem && !idDoDestaque ? precarga.current.lista : null;
    precarga.current = null;
    (pronto ?? (idDoDestaque ? cliente.destaque(idDoDestaque) : quem === "eu" ? cliente.meus() : cliente.abrir(quem)))
      .then((lista) => {
        if (!vivo) return;
        setStories(lista);
        setErro(null);
        if (noStory) {
          const k = lista.findIndex((x) => x.id === noStory);
          if (k >= 0) {
            setI(k);
            setCaixa("respostas");
          }
        }
        // A tela de verdade já tem o story: a face do cubo que cobria a troca sai.
        setFace(null);
      })
      .catch((e) => {
        if (!vivo) return;
        setErro(codigoDoErro(e));
        setFace(null);
      });
    return () => {
      vivo = false;
    };
    // noStory só vale na primeira leitura (quem abriu pela caixa).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, quem, idDoDestaque]);

  // No destaque não há prazo (o banco já mandou só o que eu posso ver); nos outros, só o que ainda está no ar.
  const vivos = stories ? (destaque ? stories : stories.filter((s) => noAr(s.expira_em, agora))) : null;
  const atual = vivos && vivos.length > 0 ? vivos[Math.min(i, vivos.length - 1)] : null;
  const ehVideo = atual?.fundo.tipo === "video" && !!atual.fundo.url;
  const temSom = ehVideo && atual?.fundo.tipo === "video" && atual.fundo.som;
  const pausado = pausadoPelaPessoa || segurando || digitando || caixa !== null || ocupado || trocando;
  const indiceNaTela = vivos && vivos.length > 0 ? Math.min(i, vivos.length - 1) : null;

  // Em que story estou: guardado para quando eu voltar a esta pessoa, e no endereço (recarregar abre aqui mesmo).
  const aoTrocarAgora = useRef(aoTrocar);
  useEffect(() => {
    aoTrocarAgora.current = aoTrocar;
  });
  useEffect(() => {
    if (indiceNaTela === null || idDoDestaque) return;
    lembrado.current[quem] = indiceNaTela;
    aoTrocarAgora.current?.(quem, indiceNaTela);
  }, [quem, indiceNaTela, idDoDestaque]);

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
      const k = filaDeVerdade.indexOf(quem);
      if (direcao === 1) return quem === "eu" ? filaDeVerdade[0] : k >= 0 ? filaDeVerdade[k + 1] : undefined;
      return k > 0 ? filaDeVerdade[k - 1] : undefined;
    },
    [idDoDestaque, filaDeVerdade, quem],
  );
  const precarregar = useCallback(
    (h: string | undefined) => {
      if (!h || precarga.current?.handle === h) return;
      precarga.current = { handle: h, lista: h === "eu" ? cliente.meus() : cliente.abrir(h) };
      precarga.current.lista.catch(() => undefined);
    },
    [cliente],
  );
  /** Monta a face de quem vem (na direção `d`): os stories dela já vêm da precarga, no story em que ela parou. */
  const prepararFace = useCallback(
    (d: 1 | -1): string | undefined => {
      const h = vizinha(d);
      if (!h) {
        if (faceAgora.current) setFace(null);
        return undefined;
      }
      const f = faceAgora.current;
      if (f && f.handle === h && f.direcao === d) return h;
      precarregar(h);
      setFace({ handle: h, direcao: d, story: null });
      precarga.current?.lista
        .then((lista) => {
          const vivas = lista.filter((x) => noAr(x.expira_em, Date.now()));
          const k = Math.min(lembrado.current[h] ?? 0, Math.max(0, vivas.length - 1));
          setFace((x) => (x && x.handle === h ? { ...x, story: vivas[k] ?? null } : x));
        })
        .catch(() => undefined);
      return h;
    },
    [precarregar, vizinha],
  );

  const girar = useCallback(async (direcao: 1 | -1, trocar: () => void, deOnde = 0) => {
    const a = tela.current;
    if (!a || semMovimento() || !a.animate) {
      trocar();
      return;
    }
    setTrocando(true);
    // A face que entra acabou de ser montada (troca pelo teclado ou pela seta): espera ela existir.
    if (!telaVizinha.current) await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = telaVizinha.current;
    const duracao = Math.max(200, 460 * (1 - deOnde));
    const jeito: KeyframeAnimationOptions = { duration: duracao, easing: "cubic-bezier(.25,.8,.3,1)", fill: "forwards" };
    a.style.transformOrigin = direcao === 1 ? "100% 50%" : "0% 50%";
    const anims = [a.animate([{ transform: a.style.transform || "none", filter: a.style.filter || "none" }, faceQueSai(direcao, 1)], jeito)];
    if (b) {
      b.style.transformOrigin = direcao === 1 ? "0% 50%" : "100% 50%";
      anims.push(b.animate([{ transform: b.style.transform || faceQueEntra(direcao, 0).transform, filter: b.style.filter || faceQueEntra(direcao, 0).filter }, faceQueEntra(direcao, 1)], jeito));
    }
    await Promise.allSettled(anims.map((x) => x.finished));
    // A face que entrou fica parada no lugar (cobrindo a tela) até os stories da pessoa chegarem; aí ela sai (setFace(null)).
    trocar();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    a.getAnimations().forEach((x) => x.cancel());
    a.style.transform = "";
    a.style.filter = "";
    a.style.transformOrigin = "";
    setTrocando(false);
  }, []);

  const irPara = useCallback(
    (h: string, direcao: 1 | -1, deOnde = 0) => {
      if (vizinha(direcao) === h) prepararFace(direcao);
      else precarregar(h);
      void girar(
        direcao,
        () => {
          setStories(null);
          setQuem(h);
          setI(lembrado.current[h] ?? 0);
          zerar();
        },
        deOnde,
      );
    },
    [girar, precarregar, prepararFace, vizinha],
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
      const alvo = e.target instanceof HTMLElement ? e.target : null;
      const campo = !!alvo && alvo.matches("input:not([type=radio]):not([type=checkbox]), textarea, [contenteditable='true']");
      if (e.key === "Escape") {
        e.preventDefault();
        if (caixa) setCaixa(null);
        else if (campo && alvo) {
          // O primeiro Esc num campo só sai dele (e desiste da resposta que estava escrevendo); o segundo fecha o visor.
          if (alvo === campoResposta.current) setResposta("");
          alvo.blur();
          raiz.current?.focus({ preventScroll: true });
        } else aoFechar();
        return;
      }
      if (caixa) return;
      // As setas trocam de story com o foco em qualquer lugar do visor (até num botão), menos onde elas têm outro uso: num
      // campo (mexem o cursor), num menu ou num grupo de opções.
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (alvo?.closest(DONO_DAS_SETAS) || e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (e.key === "ArrowRight") avancar();
        else voltar();
        return;
      }
      // O Espaço e o M só valem com o foco no próprio visor (ou numa área de toque): num botão, o Espaço aciona o botão
      // (WCAG 2.1.1); num campo, escreve.
      const livre = !alvo || alvo === raiz.current || alvo === document.body || alvo.classList.contains("al-st-toque");
      if (!livre) return;
      if (e.key === " ") {
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
    else if (caixa === "respostas") r.querySelector<HTMLElement>(".al-st-caixa-respostas button")?.focus();
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

  /** A resposta à figurinha de pergunta: vai só para a autora, marcada como "da pergunta" (ela pode publicar sem o meu nome). */
  async function enviarRespostaDaPergunta(texto: string): Promise<boolean> {
    if (!atual) return false;
    setOcupado(true);
    try {
      await cliente.responderPergunta(atual.id, texto.slice(0, LIMITES_DO_STORY.resposta));
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

  function trocarFigurinha(id: string, nova: Partial<FigurinhaEnquete> | { avisar: boolean } | Partial<FigurinhaVou>, tipo: "enquete" | "contagem" | "vou") {
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

  /** "Vou" pela figurinha: a mesma confirmação da página do ato. O total volta do banco ao reabrir (só a partir de 3). */
  async function vou(sim: boolean) {
    if (!atual) return;
    const f = atual.figurinhas.find((x) => x.tipo === "vou");
    if (!f || f.tipo !== "vou" || !f.ato) return;
    setOcupado(true);
    try {
      const r = await cliente.vou(f.ato, sim);
      trocarFigurinha(atual.id, { vou_eu: r.vou_eu }, "vou");
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
      const restam = (vivos ?? []).filter((s) => s.id !== atual.id);
      aoMudou?.();
      if (restam.length === 0) {
        // Era o único no ar: não há o que mostrar; o visor fecha (ou segue para a próxima pessoa, se veio da fila).
        if (quem === "eu" || meu) aoFechar();
        else proximaAutora();
        return;
      }
      setStories((lista) => lista?.filter((s) => s.id !== atual.id) ?? null);
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
      aoMudou?.();
      avisarDestaques();
      if ((vivos ?? []).filter((s) => s.id !== atual.id).length === 0) {
        aoFechar();
        return;
      }
      setStories((lista) => lista?.filter((s) => s.id !== atual.id) ?? null);
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
      if (g.eixo === "x") prepararFace(g.dx < 0 ? 1 : -1);
    }
    const el = tela.current;
    const p = palco.current;
    if (!el || !p || semMovimento()) return;
    if (g.eixo === "x") {
      const w = el.clientWidth || 1;
      const d: 1 | -1 = g.dx < 0 ? 1 : -1;
      // Mudou de lado no meio do gesto: a outra vizinha vira a face que entra.
      const temVizinha = !!prepararFace(d);
      // Sem vizinha, o cubo resiste (borracha); com ela, gira até 90° e a face de quem vem entra junto.
      const q = Math.min(1, Math.abs(g.dx) / w) * (temVizinha ? 1 : 0.18);
      el.style.transformOrigin = d === 1 ? "100% 50%" : "0% 50%";
      Object.assign(el.style, faceQueSai(d, q));
      const b = telaVizinha.current;
      if (b && temVizinha) {
        b.style.transformOrigin = d === 1 ? "0% 50%" : "100% 50%";
        Object.assign(b.style, faceQueEntra(d, q));
      }
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
      const luz = alvo.style.filter || "none";
      alvo.style.transform = "";
      alvo.style.filter = "";
      if (!de || semMovimento() || !alvo.animate) return;
      alvo.animate([{ transform: de, filter: luz }, { transform: "none", filter: "none" }], { duration: 420, easing: "cubic-bezier(.2,1.35,.35,1)" }).finished.finally(() => {
        alvo.style.transformOrigin = "";
      });
    };
    /** Desistiu do giro: a face de quem vinha volta para o lado e some. */
    const recolherFace = (d: 1 | -1) => {
      const b = telaVizinha.current;
      if (!b || semMovimento() || !b.animate) return setFace(null);
      const de = { transform: b.style.transform || faceQueEntra(d, 0).transform, filter: b.style.filter || "none" };
      b.animate([de, faceQueEntra(d, 0)], { duration: 380, easing: "cubic-bezier(.2,1.1,.35,1)", fill: "forwards" }).finished.finally(() => setFace(null));
    };
    if (g.eixo === "x") {
      const direcao: 1 | -1 = g.dx < 0 ? 1 : -1;
      const destino = vizinha(direcao);
      const w = el?.clientWidth || 1;
      const q = Math.abs(g.dx) / w;
      if (destino && (q > 0.28 || Math.abs(g.dx) / ms > 0.55)) irPara(destino, direcao, Math.min(0.9, q));
      else {
        voltarAoLugar(el);
        if (destino) recolherFace(direcao);
      }
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
  const chamada = nomeDeChamada(nome);
  const lados = ([-1, 1] as const).map((d) => ({ d, h: vizinha(d) })).filter((x): x is { d: -1 | 1; h: string } => !!x.h);
  const corDoFundo = atual ? PALETA_DO_STORY[atual.fundo.cor]?.fundo : undefined;
  const figurinhasSoltas = !!atual && atual.figurinhas.some((f) => f.pos);

  /** Uma figurinha como quem vê a recebe (a mesma para a pilha antiga e para a solta). */
  const figurinhaNaTela = (f: Figurinha, k: number) =>
    !atual ? null : f.tipo === "contagem" ? (
      <ContagemVer key={k} f={f} t={t.figurinha.contagem} agora={agora} lang={lang} ocupado={ocupado} aoAvisar={meu ? null : pedirAviso} />
    ) : f.tipo === "enquete" ? (
      <EnqueteVer key={k} f={f} t={t.figurinha.enquete} nome={chamada} meu={meu} ocupado={ocupado} aoVotar={votar} />
    ) : f.tipo === "pergunta" ? (
      <PerguntaVer key={k} texto={f.texto} t={t.figurinha.pergunta} nome={chamada} meu={meu} enviar={enviarRespostaDaPergunta} aoFoco={setDigitando} />
    ) : f.tipo === "comunidade" ? (
      <ComunidadeVer key={k} slug={f.slug} nome={f.nome} lang={lang} t={t.figurinha.comunidade} />
    ) : f.tipo === "decorativa" ? (
      <DecorativaVer key={k} nome={f.nome} t={t.b1.decorativas} />
    ) : f.tipo === "resposta" ? (
      <RespostaVer key={k} pergunta={f.pergunta} texto={f.texto} t={t.b1} />
    ) : f.tipo === "vou" ? (
      <VouVer key={k} f={f} t={t.b1} lang={lang} meu={meu} ocupado={ocupado} aoVou={meu ? null : (sim) => void vou(sim)} />
    ) : f.tipo === "pessoa" ? (
      <PessoaVer key={k} handle={f.handle} nome={f.nome} t={t.b1} lang={lang} />
    ) : f.tipo === "campanha" ? (
      <CampanhaVer key={k} f={f} t={t.b1} lang={lang} meu={meu} />
    ) : (
      <LinkVer key={k} url={f.url} rotulo={f.rotulo} t={t.figurinha.link} />
    );
  const legendaAgora = atual?.legendas && ehVideo && legendasLigadas ? legendaNoTempo(atual.legendas, fracao * duracao) : null;

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
      {/* Computador: a cor (e a foto) do story, bem desfocada, atrás de tudo: o story não fica solto num preto chapado. */}
      <div className="al-st-visor-fundo" aria-hidden style={corDoFundo ? ({ "--al-st-visor-cor": corDoFundo } as CSSProperties) : undefined}>
        {atual?.fundo.tipo === "imagem" && atual.fundo.url ? (
          // Endereço assinado do próprio story (já baixado pela tela); só a cópia desfocada.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={atual.id} src={atual.fundo.url} alt="" />
        ) : null}
      </div>
      <div ref={palco} className="al-st-visor-palco" onPointerDown={aoBaixar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}>
        {/* Computador largo: quem vem antes e depois, pequenas e escurecidas dos lados (um clique leva a elas). */}
        {lados.map(({ d, h }) => {
          const a = conhecidas[h];
          const rotulo = a?.nome ?? (h === "eu" ? t.visor.seu : h);
          return (
            <button
              key={`lado-${d}`}
              type="button"
              tabIndex={-1}
              className={`al-st-lado al-st-lado-${d === 1 ? "dir" : "esq"}`}
              aria-label={preencherStory(t.visor.verAoLado, { nome: rotulo })}
              style={{ "--al-st-anel": anelEmCss(a?.handle ?? h, false) } as CSSProperties}
              onClick={() => !trocando && irPara(h, d)}
            >
              <span className="al-st-lado-rosto" aria-hidden>
                <Avatar16 handle={a?.handle ?? h} cor={a?.cor ?? undefined} tamanho={64} />
              </span>
              <span className="al-st-lado-nome" aria-hidden>
                {rotulo}
              </span>
            </button>
          );
        })}
        {/* A face do cubo de quem vem (durante o deslizar e o giro): já com o fundo, o texto e o nome dela, sem tela preta. */}
        {face ? (
          <div
            ref={telaVizinha}
            key={`face-${face.handle}`}
            className="al-st-tela al-st-tela-vizinha"
            aria-hidden
            style={{
              ...(face.story ? estiloDaTela(face.story.fundo.cor) : {}),
              transform: faceQueEntra(face.direcao, 0).transform,
              transformOrigin: face.direcao === 1 ? "0% 50%" : "100% 50%",
            }}
          >
            {face.story ? (
              <>
                <FundoDoStory
                  tipo={face.story.fundo.tipo === "video" ? "listras" : face.story.fundo.tipo}
                  cor={face.story.fundo.cor}
                  semente={face.story.id}
                  url={face.story.fundo.tipo === "imagem" ? face.story.fundo.url : undefined}
                  alt=""
                />
                <div className="al-st-topo al-st-topo-vizinha">
                  <div className="al-st-topo-quem">
                    <Avatar16 handle={face.story.autora.handle} cor={face.story.autora.cor ?? undefined} tamanho={38} />
                    <span className="al-st-topo-nome">
                      <strong>{face.story.meu ? t.visor.seu : face.story.autora.nome}</strong>
                    </span>
                  </div>
                </div>
                {face.story.texto ? (
                  <div className="al-st-miolo">
                    <h2
                      className="al-st-texto al-st-texto-sombra"
                      data-fonte={estiloDoTexto(face.story.estilo, face.story.fundo.cor).fonte}
                      style={{ fontFamily: estiloDoTexto(face.story.estilo, face.story.fundo.cor).familia, fontSize: `${tamanhoDoTexto(face.story.texto, larguraDaTela())}px` }}
                    >
                      {face.story.texto}
                    </h2>
                  </div>
                ) : null}
              </>
            ) : (
              <span className="al-st-girando" />
            )}
          </div>
        ) : null}
        <div ref={tela} className="al-st-tela" data-carregando={!atual && !erro && !(vivos && vivos.length === 0) ? "sim" : undefined} style={atual ? estiloDaTela(atual.fundo.cor) : undefined}>
          {atual ? (
            <FundoDoStory
              key={`fundo-${atual.id}`}
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
                  {/* Carregando: o nome vira um esqueleto (só um indicador na tela; o leitor de tela ouve o "carregando" aqui). */}
                  {atual ? (meu && !destaque ? t.visor.seu : nome) : <><span className="sr-only">{t.visor.carregando}</span><span className="al-st-esqueleto-nome" aria-hidden /></>}
                  {quandoTexto ? <span> · {quandoTexto}</span> : null}
                </strong>
                {destaque ? (
                  <small>{preencherStory(t.visor.destaque, { titulo: destaque.titulo })}</small>
                ) : atual?.publico === "proximos" ? (
                  <small className="al-st-selo-roda">{t.b1.visor.roda}</small>
                ) : atual?.publico === "comunidade" && atual.comunidade ? (
                  <small className="al-st-selo-comunidade">{preencherStory(t.b1.visor.comunidade, { nome: atual.comunidade.nome })}</small>
                ) : atual ? (
                  <small>{t.visor.publico[atual.publico]}</small>
                ) : null}
              </span>
            </div>
            {ehVideo && atual?.legendas?.length ? (
              <button
                type="button"
                className="al-st-icone al-st-icone-cc"
                aria-label={legendasLigadas ? t.b1.visor.legendasDesligar : t.b1.visor.legendasLigar}
                aria-pressed={legendasLigadas}
                onClick={() => setLegendasLigadas(!legendasLigadas)}
              >
                <span aria-hidden>CC</span>
              </button>
            ) : null}
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
            {atual ? (
              <>
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
                  onClick={() => setCaixa((c) => (c === "menu" ? null : "menu"))}
                >
                  <IconeTresPontos />
                </button>
              </>
            ) : null}
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
          {atual?.musica && ehVideo ? (
            <p className="al-st-musica">
              <span aria-hidden>♪</span> {preencherStory(t.b1.visor.musica, { nome: t.b1.musica.nomes[atual.musica] ?? atual.musica })}
            </p>
          ) : null}
          {legendaAgora ? (
            <p key={legendaAgora.de} className="al-st-legenda-video" data-grande={legendaAgora.grande ? "sim" : "nao"}>
              <span>{legendaAgora.texto}</span>
            </p>
          ) : null}

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
            <div key={`miolo-${atual.id}`} className="al-st-miolo al-st-entra" style={{ "--st-tamanho": `${tamanhoDoTexto(atual.texto, larguraDaTela())}px` } as CSSProperties}>
              {atual.texto ? (
                <h2
                  className={`al-st-texto${est.caixa ? "" : " al-st-texto-sombra"}`}
                  data-fonte={est.fonte}
                  data-caixa={est.caixa ? "sim" : "nao"}
                  style={{ fontFamily: est.familia, "--st-letra": est.cor, "--st-caixa": est.caixa ?? "transparent", textAlign: est.alinhar === "esq" ? "left" : est.alinhar === "dir" ? "right" : "center" } as CSSProperties}
                >
                  {est.caixa ? <span>{atual.texto}</span> : atual.texto}
                </h2>
              ) : null}
              {atual.legenda ? <p className="al-st-tarja">{atual.legenda}</p> : null}
              {atual.post ? <CartaoDoPostNoStory cartao={atual.post} t={t.b1.post} lang={lang} /> : null}
              {atual.figurinhas.length > 0 && !figurinhasSoltas ? <div className="al-st-figurinhas">{atual.figurinhas.map(figurinhaNaTela)}</div> : null}
            </div>
          ) : (
            erro || (vivos && vivos.length === 0) ? (
              <p className="al-st-estado" role="status">
                {erro ? (erro === "banco" ? t.criar.erro.banco : t.visor.erro) : t.visor.sumiu}
              </p>
            ) : null
          )}

          {/* As figurinhas no lugar em que a autora deixou (arrastadas, giradas, no tamanho dela). */}
          {atual && figurinhasSoltas ? (
            <div key={`soltas-${atual.id}`} className="al-st-figurinhas-soltas al-st-entra">
              {atual.figurinhas.map((f, k) => (
                <div key={k} className="al-st-fig-solta" data-tipo={f.tipo} style={estiloDaPosicao(posicaoValida(f.pos ?? posicaoInicial(k)))}>
                  {figurinhaNaTela(f, k)}
                </div>
              ))}
            </div>
          ) : null}

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
                avisarDestaques();
                avisar(texto);
              }}
            />
          ) : null}

          {caixa === "respostas" && atual && meu ? <CaixaDeRespostas t={t} cliente={cliente} lang={lang} story={atual.id} aoFechar={() => setCaixa(null)} /> : null}

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

      <div className="al-st-rodape" hidden={!atual}>
        {!atual ? null : meu || destaque ? (
          meu ? (
            <ResumoDaAutora t={t} lang={lang} respostas={atual.respostas} reacoes={atual.reacoes} aoAbrir={() => setCaixa("respostas")} />
          ) : null
        ) : null}
        {atual && !meu ? (
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
                {preencherStory(t.visor.responderRotulo, { nome })}
              </label>
              <input
                id={`${idDoTitulo}-r`}
                ref={campoResposta}
                value={resposta}
                maxLength={LIMITES_DO_STORY.resposta}
                // O exemplo completo ("Responder só para Rosa…") só quando cabe; nome comprido fica "Responder…" (o rótulo diz para quem).
                placeholder={[...preencherStory(t.visor.responder, { nome })].length <= 26 ? preencherStory(t.visor.responder, { nome }) : t.visor.responderCurto}
                title={preencherStory(t.visor.responderRotulo, { nome })}
                disabled={ocupado}
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
            <div role="group" aria-label={preencherStory(t.visor.reacoes, { nome: chamada })} style={{ display: "flex" }}>
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
