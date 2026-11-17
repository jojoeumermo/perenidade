// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A parte da frente 13D que vive em TODA tela da Alumia (encaixe colunaDireita, que existe em toda tela, mesmo quando a coluna
// não aparece; o recado sai num portal para dentro da pele da Alumia). Faz três coisas, todas neste aparelho:
//   1. no modo leve, guarda a foto do post atrás de um ladrilho "toque para ver" (leve.css) e solta a figura tocada;
//   2. quando a rede volta, manda os posts que esperavam na fila deste aparelho (./regras.ts) e diz o que saiu;
//   3. na hora de parar que a pessoa escolheu, mostra o lembrete (uma vez por noite).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/Link";
import { preencher } from "@/lib/rede/preencher";
import type { ContextoDoEncaixe } from "../encaixes";
import { Botao } from "../ui/Botao";
import { avisarMudanca, armazemDoAparelho, mandarDoAparelho, useAgora, useFila, useHoraDeParar } from "./aparelho";
import { CHAVES_DO_LEVE, horaDeLembrar, minutosDoDia, noiteDe, prontosParaSair } from "./regras";
import { useTextosDoLeve, type TextosDoLeve } from "./textos";

const RAIZ = '[data-al="2"]';
/** A imagem veio da rede (e não do próprio aparelho, como a foto escolhida antes de subir)? */
const daRede = (img: HTMLImageElement) => {
  const src = img.getAttribute("src") ?? "";
  return src !== "" && !src.startsWith("data:") && !src.startsWith("blob:");
};

/** Liga ou desliga o ladrilho numa figura (atributos que o leve.css lê; role e tabindex para o teclado e o leitor de tela). */
function guardarFigura(f: HTMLElement, guardar: boolean, rotulo: string) {
  if (guardar) {
    if (f.hasAttribute("data-lv-guardada")) return;
    f.setAttribute("data-lv-guardada", "");
    f.setAttribute("role", "button");
    f.setAttribute("tabindex", "0");
    const alt = f.querySelector("img")?.getAttribute("alt")?.trim();
    f.setAttribute("aria-label", alt ? `${rotulo}: ${alt}` : rotulo);
  } else if (f.hasAttribute("data-lv-guardada")) {
    f.removeAttribute("data-lv-guardada");
    f.removeAttribute("role");
    f.removeAttribute("tabindex");
    f.removeAttribute("aria-label");
  }
}

/** Passa por todas as figuras da Alumia: com o modo leve, guarda as que têm foto da rede e ainda não foram tocadas. */
function arrumarFiguras(raiz: ParentNode, leve: boolean, rotulo: string) {
  for (const f of Array.from(raiz.querySelectorAll<HTMLElement>(`${RAIZ} figure`))) {
    if (leve) f.setAttribute("data-lv-figura", "");
    else f.removeAttribute("data-lv-figura");
    const comFoto = Array.from(f.querySelectorAll("img")).some(daRede);
    guardarFigura(f, leve && comFoto && !f.hasAttribute("data-lv-ver"), rotulo);
  }
}

/** 1. O modo leve nas figuras dos posts. */
function useFigurasGuardadas(t: TextosDoLeve | null) {
  useEffect(() => {
    if (!t) return;
    const html = document.documentElement;
    const rotulo = t.economia.verImagem;
    const leve = () => html.hasAttribute("data-light");
    // O texto do ladrilho vai por variável (o CSS não traduz): uma string CSS entre aspas.
    html.style.setProperty("--lv-ver-imagem", JSON.stringify(rotulo));
    let pendente = 0;
    const arrumar = () => {
      pendente = 0;
      arrumarFiguras(document, leve(), rotulo);
    };
    const pedir = () => {
      if (!pendente) pendente = window.requestAnimationFrame(arrumar);
    };
    // Fora do modo leve não há nada a vigiar: o observador da página só fica ligado enquanto <html data-light> estiver lá.
    const observador = new MutationObserver(pedir);
    const vigiar = () => {
      observador.disconnect();
      if (leve()) observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
      arrumar();
    };
    vigiar();
    const doHtml = new MutationObserver(vigiar);
    doHtml.observe(html, { attributes: true, attributeFilter: ["data-light"] });
    // Um toque dentro de uma figura, no modo leve, solta a figura inteira (a foto, ou o vídeo que a pessoa mandou tocar). Se ela
    // estava guardada, o toque só abre: não vira também o clique de dentro (abrir o visor, por exemplo).
    const soltar = (f: HTMLElement, e: Event) => {
      const guardada = f.hasAttribute("data-lv-guardada");
      f.setAttribute("data-lv-ver", "");
      guardarFigura(f, false, rotulo);
      if (guardada) {
        e.preventDefault();
        e.stopPropagation();
        f.querySelector<HTMLElement>("button, a[href]")?.focus();
      }
    };
    const aoTocar = (e: MouseEvent) => {
      if (!leve() || e.button !== 0) return;
      const f = (e.target as Element | null)?.closest?.<HTMLElement>(`${RAIZ} figure`);
      if (f && !f.hasAttribute("data-lv-ver")) soltar(f, e);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (!leve() || (e.key !== "Enter" && e.key !== " ")) return;
      const f = e.target as HTMLElement | null;
      if (f?.tagName === "FIGURE" && f.hasAttribute("data-lv-guardada")) soltar(f, e);
    };
    document.addEventListener("click", aoTocar, true);
    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      observador.disconnect();
      doHtml.disconnect();
      if (pendente) window.cancelAnimationFrame(pendente);
      document.removeEventListener("click", aoTocar, true);
      document.removeEventListener("keydown", aoTeclar, true);
      arrumarFiguras(document, false, rotulo);
    };
  }, [t]);
}

type Recado = { texto: string; ruim: boolean; link: string | null };

/** 2. A fila: manda quando a rede volta (e a cada minuto enquanto houver o que mandar com a rede no ar). */
function useFilaQueSai(t: TextosDoLeve | null, conta: string | null, lang: string): [Recado | null, () => void] {
  const fila = useFila();
  const [recado, setRecado] = useState<Recado | null>(null);
  const agora = useAgora(60_000);
  const temPronto = Boolean(conta && fila && agora && prontosParaSair(fila, conta, agora).length > 0);
  const mandando = useRef(false);

  useEffect(() => {
    if (!t || !conta || !temPronto) return;
    const mandar = async () => {
      if (mandando.current || navigator.onLine === false) return;
      mandando.current = true;
      try {
        const r = await mandarDoAparelho(conta);
        const leve = `/${lang}/alumia/leve#lv-fila`;
        if (r.saiu.length === 1) setRecado({ texto: t.fila.saiu, ruim: false, link: r.saiu[0].post ? `/${lang}/alumia/p/${r.saiu[0].post}` : null });
        else if (r.saiu.length > 1) setRecado({ texto: preencher(t.fila.saiuVarios, { n: r.saiu.length }), ruim: false, link: leve });
        if (r.recusado.length) setRecado({ texto: t.fila.naoSaiu, ruim: true, link: leve });
      } finally {
        mandando.current = false;
      }
    };
    void mandar();
    window.addEventListener("online", mandar);
    const id = window.setInterval(() => void mandar(), 60_000);
    return () => {
      window.removeEventListener("online", mandar);
      window.clearInterval(id);
    };
  }, [t, conta, temPronto, lang]);

  return [recado, () => setRecado(null)];
}

/** 3. A hora de parar: confere a cada 30 s; aparece uma vez por noite, dentro da janela. */
function useHoraDePararAgora(): [string | null, () => void] {
  const [hora] = useHoraDeParar();
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    if (!hora || minutosDoDia(hora) === null) return;
    const conferir = () => {
      if (document.visibilityState !== "visible") return;
      const agora = new Date();
      if (horaDeLembrar(agora, hora, armazemDoAparelho()?.getItem(CHAVES_DO_LEVE.pararVisto))) setAberta(hora);
    };
    const id0 = window.setTimeout(conferir, 0);
    const id = window.setInterval(conferir, 30_000);
    return () => {
      window.clearTimeout(id0);
      window.clearInterval(id);
    };
  }, [hora]);
  const fechar = () => {
    const h = minutosDoDia(aberta);
    if (h !== null) {
      try {
        armazemDoAparelho()?.setItem(CHAVES_DO_LEVE.pararVisto, noiteDe(new Date(), h));
      } catch {
        // sem armazenamento: o lembrete pode voltar na próxima conferência
      }
      avisarMudanca();
    }
    setAberta(null);
  };
  return [aberta, fechar];
}

export default function LeveNaCasca({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDoLeve(lang);
  const conta = situacao.logado && situacao.membro ? (situacao.handle ?? null) : null;
  useFigurasGuardadas(t);
  const [recado, fecharRecado] = useFilaQueSai(t, conta, lang);
  const [parar, fecharParar] = useHoraDePararAgora();
  const [casa, setCasa] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setCasa(document.querySelector<HTMLElement>(RAIZ)), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!parar) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecharParar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [parar, fecharParar]);

  if (!t || !casa) return null;
  return createPortal(
    <div aria-live="polite">
      {recado && (
        <div className="lv-recado-flutuante" data-ruim={recado.ruim ? "" : undefined} role="status">
          <div className="lv-flutuante-linha">
            <p>{recado.texto}</p>
            {recado.link && (
              <Link href={recado.link} className="lv-link" onClick={fecharRecado}>
                {t.fila.ver}
              </Link>
            )}
            <Botao variante="contorno" tamanho="p" onClick={fecharRecado}>
              {t.fila.fechar}
            </Botao>
          </div>
        </div>
      )}
      {parar && !recado && (
        <section className="lv-parar" aria-labelledby="lv-parar-titulo">
          <h2 id="lv-parar-titulo" className="al-cond">
            {preencher(t.tempo.lembreteTitulo, { hora: parar })}
          </h2>
          <p>{t.tempo.lembreteTexto}</p>
          <Botao variante="primario" tamanho="p" onClick={fecharParar}>
            {t.tempo.fechar}
          </Botao>
        </section>
      )}
    </div>,
    casa,
  );
}
