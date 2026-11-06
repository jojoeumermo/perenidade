// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Atkinson_Hyperlegible } from "next/font/google";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { COLOR_MODES, GUIDE_MODES, type GuideMode, resetPrefs, setPrefs, SPACING_LEVELS, TEXT_SCALES, usePrefs } from "@/lib/prefs";
import { arrastavel, CANTOS, type Canto, estiloDaPosicao, gravarPosicao, ladoDe, posicaoDoPonto, usePosicoes } from "@/lib/flutuantes";
import { ligado } from "@/lib/recursos";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { useHydrated } from "@/lib/storage";
import { useI18n } from "./I18n";

// VLibras (recurso "vlibras", desligado por padrão): o código só é baixado com o recurso ligado e o painel aberto.
const AtivarVLibras = dynamic(() => import("./estudo/AtivarVLibras"), { ssr: false });
const VLibrasLembrado = dynamic(() => import("./estudo/VLibrasLembrado"), { ssr: false });
// O lugar do botão do VLibras (T11): só age depois de o VLibras ligar.
const VLibrasPosicao = dynamic(() => import("./estudo/VLibrasPosicao"), { ssr: false });

/** O tamanho do botão redondo (h-11), para as contas da posição livre (lib/flutuantes.ts). */
const TAMANHO_DO_BOTAO = "2.75rem";

// A letra mais legível: Atkinson Hyperlegible, do Braille Institute, sob a licença SIL Open Font License 1.1. O next/font
// guarda os arquivos junto com o site no build (nenhum pedido vai ao Google) e, sem pré-carga, o navegador só baixa a
// letra quando alguma regra a usa, isto é, quando o modo está ligado (app/globals.css, :root[data-dislexia]).
const legivel = Atkinson_Hyperlegible({ subsets: ["latin", "latin-ext"], weight: ["400", "700"], preload: false });

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-11 shrink-0 border-2 border-ink bg-parchment after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:bg-ink-soft peer-checked:bg-ink peer-checked:after:left-[1.375rem] peer-checked:after:bg-parchment peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold"
      />
    </label>
  );
}

/** Uma escolha entre poucas opções: botões lado a lado, o escolhido marcado (aria-pressed), dentro de um fieldset. */
function Opcoes<T extends string | number>({
  legenda,
  dica,
  valores,
  rotulos,
  atual,
  escolher,
  desenho,
}: {
  legenda: string;
  dica?: string;
  valores: readonly T[];
  rotulos: readonly string[];
  atual: T;
  escolher: (valor: T) => void;
  /** O que aparece no botão no lugar do rótulo (o rótulo continua para o leitor de tela). */
  desenho?: (i: number) => ReactNode;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={dica ? id : undefined}>
      <legend className="font-semibold">{legenda}</legend>
      {dica && (
        <p id={id} className="text-xs text-ink-soft">
          {dica}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {valores.map((valor, i) => (
          <button
            key={String(valor)}
            type="button"
            aria-pressed={atual === valor}
            onClick={() => escolher(valor)}
            className={`min-h-10 flex-1 cursor-pointer border-2 px-2 py-1.5 text-xs font-medium ${
              atual === valor ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"
            }`}
          >
            {desenho ? (
              <>
                {desenho(i)}
                <span className="sr-only">{rotulos[i]}</span>
              </>
            ) : (
              rotulos[i]
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-4 border-t-2 border-rule pt-4">
      <h3 id={id} className="rotulo">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/**
 * Guia de leitura. "Linha": uma régua logo abaixo da linha que se lê. "Máscara": escurece a tela e deixa só uma faixa
 * clara. Acompanha o mouse e o dedo (pointermove) e também o teclado (o elemento que recebe o foco). Fica abaixo do
 * painel de acessibilidade (z-39 contra z-40), não recebe cliques e não existe para o leitor de tela.
 */
function GuiaDeLeitura({ modo }: { modo: GuideMode }) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modo) return;
    let quadro = 0;
    const mover = (y: number) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const el = caixa.current;
        if (!el) return;
        el.style.setProperty("--guia-y", `${Math.round(y)}px`);
        el.hidden = false;
      });
    };
    const noPonteiro = (e: PointerEvent) => mover(e.clientY);
    const noFoco = (e: FocusEvent) => {
      if (!(e.target instanceof Element) || e.target === document.body) return;
      const r = e.target.getBoundingClientRect();
      mover(r.top + Math.min(r.height, 48) / 2);
    };
    window.addEventListener("pointermove", noPonteiro, { passive: true });
    window.addEventListener("pointerdown", noPonteiro, { passive: true });
    document.addEventListener("focusin", noFoco);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", noPonteiro);
      window.removeEventListener("pointerdown", noPonteiro);
      document.removeEventListener("focusin", noFoco);
    };
  }, [modo]);

  if (!modo) return null;
  return (
    <div ref={caixa} hidden aria-hidden className="guia-de-leitura no-print pointer-events-none fixed inset-0 z-[39]" style={{ "--guia-y": "50vh" } as CSSProperties}>
      {modo === "mascara" ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-black/65" style={{ height: "max(0px, calc(var(--guia-y) - 2.75rem))" }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/65" style={{ top: "calc(var(--guia-y) + 2.75rem)" }} />
        </>
      ) : (
        <div className="absolute inset-x-0 h-1.5 bg-gold shadow-[0_0_0_2px_var(--parchment)]" style={{ top: "calc(var(--guia-y) + 0.85rem)" }} />
      )}
    </div>
  );
}

/**
 * "Pausar animações" vale também para os vídeos que tocam sozinhos (autoplay): os que já estão na página e os que
 * chegam depois, na navegação. O vídeo que a pessoa mandou tocar não é parado.
 */
function usePausarVideos(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const pausar = (raiz: Element | Document) => {
      const videos = raiz instanceof HTMLVideoElement ? [raiz] : Array.from(raiz.querySelectorAll("video"));
      for (const video of videos) {
        if (!video.autoplay) continue;
        video.autoplay = false;
        video.pause();
      }
    };
    pausar(document);
    const observador = new MutationObserver((mudancas) => {
      for (const mudanca of mudancas) for (const no of mudanca.addedNodes) if (no instanceof Element) pausar(no);
    });
    observador.observe(document.body, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, [ativo]);
}

/** Pede para abrir o painel de acessibilidade (o item "Acessibilidade" do "Mais", no aplicativo). */
export const ABRIR_ACESSIBILIDADE = "lucia:abrir-acessibilidade";
export const abrirAcessibilidade = () => window.dispatchEvent(new Event(ABRIR_ACESSIBILIDADE));

/**
 * Botão flutuante de acessibilidade: texto (tamanho, linhas, letras, letra legível, links), cores (contraste, e-ink,
 * cinza e saturação, preto absoluto), leitura (guia, pausar animações, cursor grande, foco, modo leve), leitura em voz
 * alta e VLibras. Tudo fica no aparelho (localStorage, lib/prefs.ts) e o prefsScript aplica antes da primeira pintura.
 * No aplicativo o botão redondo não flutua por cima do conteúdo (cobria ícones e títulos, coisa de site): o painel abre
 * pelo item "Acessibilidade" do "Mais". Só volta a aparecer enquanto a leitura em voz alta está tocando, para dar como parar.
 */
export function A11yWidget() {
  const { t } = useI18n();
  const a = t.a11y;
  const prefs = usePrefs();
  const speaking = useSpeaking();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [aviso, setAviso] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const antesRef = useRef<HTMLElement | null>(null);
  const tituloId = useId();
  const introId = useId();
  const caixaRef = useRef<HTMLDivElement>(null);
  // Onde a pessoa pôs os botões (T11): arrastando ou pelo grupo "Lugar dos botões" do painel. Só neste aparelho.
  const posicoes = usePosicoes();
  const minha = posicoes.acessibilidade ?? null;
  const lado = ladoDe(minha);

  // Arrastar o botão redondo com o mouse, o dedo ou a caneta. Um toque curto continua abrindo o painel.
  useEffect(() => {
    const botao = buttonRef.current;
    const caixa = caixaRef.current;
    if (!botao || !caixa) return;
    const pintar = (x: number, y: number) => {
      const r = botao.getBoundingClientRect();
      Object.assign(caixa.style, estiloDaPosicao(posicaoDoPonto(x, y, r.width, r.height), TAMANHO_DO_BOTAO));
    };
    return arrastavel(botao, {
      mover: pintar,
      soltar: (x, y) => {
        const r = botao.getBoundingClientRect();
        gravarPosicao("acessibilidade", posicaoDoPonto(x, y, r.width, r.height));
      },
    });
  }, []);

  usePausarVideos(prefs.motion);

  // Fechar pelo Esc ou pelo X: o painel some do DOM, então o foco volta para onde estava (sem isso cairia no <body>).
  const fecharDevolvendoFoco = () => {
    setOpen(false);
    const antes = antesRef.current;
    if (antes && antes.isConnected && antes.offsetParent !== null && !panelRef.current?.contains(antes)) antes.focus();
    else buttonRef.current?.focus();
  };

  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener(ABRIR_ACESSIBILIDADE, abrir);
    return () => window.removeEventListener(ABRIR_ACESSIBILIDADE, abrir);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Ao abrir, o foco vai para o título do painel (o leitor de tela anuncia onde a pessoa está); ao fechar com Esc,
    // volta para onde estava (o botão redondo ou o item do "Mais", no aplicativo).
    antesRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    tituloRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharDevolvendoFoco();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(""), 4000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  const restaurar = () => {
    resetPrefs();
    setAviso(a.resetDone);
  };

  return (
    <>
      {/* O nome da letra legível, para o CSS (--font-legivel). O React leva este <style> para o <head>, já no HTML do servidor. */}
      <style href="a11y-letra-legivel" precedence="medium">{`:root{--font-legivel:${legivel.style.fontFamily}}`}</style>
      {/* Fora da caixa do botão: ela some no aplicativo durante a leitura (.app-flutua) e prenderia o z-index. */}
      <GuiaDeLeitura modo={prefs.guide} />
      <div
        ref={caixaRef}
        style={minha ? estiloDaPosicao(minha, TAMANHO_DO_BOTAO) : undefined}
        className="app-flutua no-print fixed bottom-[calc(4.75rem+var(--recuo-baixo))] right-3 z-40 font-sans text-sm md:bottom-4 md:right-4"
      >
        {ligado("vlibras") && <VLibrasLembrado />}
        {ligado("vlibras") && <VLibrasPosicao />}
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={tituloId}
            aria-describedby={introId}
            className={`absolute ${lado.baixo ? "bottom-14" : "top-14"} ${lado.direita ? "right-0" : "left-0"} max-h-[78vh] w-[min(22rem,calc(100vw-1.5rem))] space-y-5 overflow-y-auto border-2 border-ink bg-folha p-5 text-ink shadow-[6px_6px_0_var(--sombra)]`}
          >
            {/* Um título só: antes o rótulo "Acessibilidade" ficava em cima do título "Acessibilidade". */}
            <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
              <div>
                <h2 id={tituloId} ref={tituloRef} tabIndex={-1} className="font-serif text-2xl font-semibold leading-tight focus:outline-none">
                  {a.title}
                </h2>
                <p id={introId} className="mt-1 text-xs text-ink-soft">
                  {a.intro}
                </p>
              </div>
              <button type="button" onClick={fecharDevolvendoFoco} aria-label={a.close} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-2 border-ink hover:bg-ink hover:text-parchment">
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {/* O VLibras no alto, em destaque: quem precisa de Libras não deve ter de rolar a janela para achar. */}
            {ligado("vlibras") && (
              <div className="border-2 border-ink bg-ink p-4 text-parchment shadow-[4px_4px_0_var(--prelo)] [&_.text-ink-soft]:text-[#e9dcbc] [&_button]:border-parchment">
                <AtivarVLibras />
              </div>
            )}

            <Grupo titulo={a.groupText}>
              <Opcoes
                legenda={a.textSize}
                valores={TEXT_SCALES}
                rotulos={a.sizes}
                atual={prefs.scale as (typeof TEXT_SCALES)[number]}
                escolher={(scale) => setPrefs({ scale })}
                desenho={(i) => (
                  <span aria-hidden className="font-serif" style={{ fontSize: `${0.8 + i * 0.2}rem` }}>
                    A
                  </span>
                )}
              />
              <Opcoes legenda={a.lineHeight} valores={SPACING_LEVELS} rotulos={a.spacingLevels} atual={prefs.lines as (typeof SPACING_LEVELS)[number]} escolher={(lines) => setPrefs({ lines })} />
              <Opcoes legenda={a.letterSpacing} valores={SPACING_LEVELS} rotulos={a.spacingLevels} atual={prefs.letters as (typeof SPACING_LEVELS)[number]} escolher={(letters) => setPrefs({ letters })} />
              <Switch checked={prefs.dyslexia} onChange={(dyslexia) => setPrefs({ dyslexia })} label={a.dyslexia} hint={a.dyslexiaHint} />
              <Switch checked={prefs.links} onChange={(links) => setPrefs({ links })} label={a.links} hint={a.linksHint} />
            </Grupo>

            <Grupo titulo={a.groupColor}>
              <Switch checked={prefs.contrast} onChange={(contrast) => setPrefs({ contrast })} label={a.contrast} hint={a.contrastHint} />
              <Switch checked={prefs.eink} onChange={(eink) => setPrefs({ eink })} label={a.eink} hint={a.einkHint} />
              <Opcoes legenda={a.color} dica={a.colorHint} valores={COLOR_MODES} rotulos={a.colorModes} atual={prefs.color} escolher={(color) => setPrefs({ color })} />
              <Switch checked={prefs.black} onChange={(black) => setPrefs({ black })} label={a.black} hint={a.blackHint} />
            </Grupo>

            <Grupo titulo={a.groupReading}>
              <Opcoes legenda={a.guide} dica={a.guideHint} valores={GUIDE_MODES} rotulos={a.guideModes} atual={prefs.guide} escolher={(guide) => setPrefs({ guide })} />
              <Switch checked={prefs.motion} onChange={(motion) => setPrefs({ motion })} label={a.motion} hint={a.motionHint} />
              <Switch checked={prefs.cursor} onChange={(cursor) => setPrefs({ cursor })} label={a.cursor} hint={a.cursorHint} />
              <Switch checked={prefs.focus} onChange={(focus) => setPrefs({ focus })} label={a.focus} hint={a.focusHint} />
              <Switch checked={prefs.light} onChange={(light) => setPrefs({ light })} label={a.light} hint={a.lightHint} />
            </Grupo>

            <Grupo titulo={a.groupListen}>
              <div>
                <p className="font-semibold">{a.read}</p>
                <p className="text-xs text-ink-soft">{a.readHint}</p>
                {hydrated && !speechSupported() ? (
                  <p className="mt-2 text-xs text-oxblood">{a.noSpeech}</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => startReading()} className="cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood">
                      {speaking ? a.readAgain : a.readPage}
                    </button>
                    {speaking && (
                      <button type="button" onClick={stopReading} className="cursor-pointer border-2 border-oxblood px-4 py-2 font-medium text-oxblood">
                        {a.stop}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Grupo>

            {/* T11: os botões flutuantes cobriam o conteúdo. Pelo teclado (e pelo leitor de tela), o canto se escolhe aqui;
                com o mouse ou o dedo, também dá para arrastar o próprio botão. */}
            <Grupo titulo={a.groupMove}>
              <p className="text-xs text-ink-soft">{a.moveHint}</p>
              <Opcoes
                legenda={a.move}
                valores={CANTOS}
                rotulos={a.corners}
                atual={(minha ? ("canto" in minha ? minha.canto : "") : "inf-dir") as Canto}
                escolher={(canto) => {
                  gravarPosicao("acessibilidade", { canto });
                  setAviso(a.moveDone);
                }}
              />
              {ligado("vlibras") && (
                <Opcoes
                  legenda={a.moveVLibras}
                  valores={CANTOS}
                  rotulos={a.corners}
                  atual={(posicoes.vlibras && "canto" in posicoes.vlibras ? posicoes.vlibras.canto : "") as Canto}
                  escolher={(canto) => {
                    gravarPosicao("vlibras", { canto });
                    setAviso(a.moveDone);
                  }}
                />
              )}
              {(posicoes.acessibilidade || posicoes.vlibras) && (
                <button
                  type="button"
                  onClick={() => {
                    gravarPosicao("acessibilidade", null);
                    gravarPosicao("vlibras", null);
                    setAviso(a.moveDone);
                  }}
                  className="cursor-pointer text-xs underline hover:text-oxblood"
                >
                  {a.moveReset}
                </button>
              )}
            </Grupo>

            <div className="border-t-2 border-rule pt-4">
              <button type="button" onClick={restaurar} className="cursor-pointer border-2 border-ink px-4 py-2 font-medium hover:bg-ink hover:text-parchment">
                {a.reset}
              </button>
            </div>
            <span role="status" className="sr-only">
              {[speaking ? a.reading : "", aviso].filter(Boolean).join(". ")}
            </span>
          </div>
        )}

        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={speaking ? `${a.button} (${a.reading})` : a.button}
          title={a.button}
          className={`relative flex h-11 w-11 cursor-pointer touch-none items-center justify-center rounded-full border-2 border-parchment bg-ink text-parchment hover:bg-oxblood ${speaking || open ? "" : "app:hidden"}`}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="4.5" r="1.5" fill="currentColor" />
            <path d="M5 8.5c4.5 1.5 9.500 1.500 14 0M12 9.500v5.500m0 0-3.500 6m3.500-6 3.500 6" />
          </svg>
          {speaking && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-gold" />}
        </button>
      </div>
    </>
  );
}
