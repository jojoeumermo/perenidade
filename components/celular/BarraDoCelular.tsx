// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { localePath } from "@/i18n/config";
import { site } from "@/lib/site";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { TRECHOS_DA_AULA } from "../aula/BarraDaAula";
import { useI18n } from "../I18n";
import { AccountLink } from "../NavLinks";
import { ABRIR_FOLHA_DA_AULA } from "./AcoesDaAula";

/** As abas de baixo: nelas a barra mostra o nome da aba, e não a seta de voltar. */
const RAIZES = ["trilhas", "acervo", "comunidade"];

// Andou dentro do site desde que a página abriu? Então "voltar" é voltar mesmo; quem chegou por um link de fora
// (WhatsApp, busca) volta para a página de cima, em vez de sair do site.
let andouAqui = false;

/** A página de cima de um endereço: a aula volta para a trilha, a trilha para as disciplinas, o resto para o início. */
function paginaDeCima(trechos: string[]): string {
  if (trechos[0] === "estantes") return "/trilhas";
  return `/${trechos.slice(0, -1).join("/")}`;
}

const lupa = (
  <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 20 20" />
  </svg>
);

/**
 * A barra de cima do celular, no navegador e no aplicativo (o cabeçalho do computador some nessa largura).
 * Nas abas (início, disciplinas, acervo, comunidade): a marca ou o nome da aba, a busca e a conta. Nas outras páginas:
 * voltar, o título (aparece quando o título grande da página sai da tela), compartilhar e buscar. Na aula: em que aula
 * a pessoa está, ouvir, a letra e as ferramentas, e a régua do quanto já leu, que some ao rolar o texto para baixo.
 * Desenho no canvas "Instituto Lúcia — Design", página Aplicativo.
 */
export function BarraDoCelular() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  const trechos = pathname.split("/").filter(Boolean).slice(1);
  const raiz = trechos.length === 0 ? "inicio" : trechos.length === 1 && RAIZES.includes(trechos[0]) ? trechos[0] : null;
  const naAula = trechos[0] === "trilhas" && trechos.length === 3 && trechos[2] !== "prova" && trechos[2] !== "nucleo";
  const naBusca = trechos[0] === "busca";

  const [titulo, setTitulo] = useState("");
  const [mostrarTitulo, setMostrarTitulo] = useState(false);
  const [aula, setAula] = useState<{ posicao: string; trilha: string } | null>(null);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  const [podeOuvir, setPodeOuvir] = useState(false);
  const falando = useSpeaking();
  const regua = useRef<HTMLSpanElement>(null);
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) primeira.current = false;
    else andouAqui = true;
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o compartilhar e a voz só existem no aparelho
    setPodeCompartilhar(typeof navigator.share === "function");
    setPodeOuvir(speechSupported());
  }, []);

  // O título da página e, na aula, a posição e a trilha (data-posicao e data-trilha na folha da aula).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o título vem da página já montada (o h1 dela)
    setMostrarTitulo(false);
    const folha = document.querySelector<HTMLElement>(".folha-da-aula");
    setAula(naAula && folha?.dataset.posicao ? { posicao: folha.dataset.posicao, trilha: folha.dataset.trilha ?? "" } : null);
    const h1 = document.querySelector<HTMLElement>("main h1");
    setTitulo(h1?.textContent?.trim() ?? document.title.split(" — ")[0]);
    if (!h1 || raiz === "inicio") return;
    const observador = new IntersectionObserver(([entrada]) => setMostrarTitulo(!entrada.isIntersecting && entrada.boundingClientRect.top < 80), { rootMargin: "-64px 0px 0px 0px" });
    observador.observe(h1);
    return () => observador.disconnect();
  }, [pathname, naAula, raiz]);

  // Na aula: a régua do quanto já leu e a leitura sem distração (a barra sai ao rolar para baixo e volta ao subir).
  useEffect(() => {
    if (!naAula) return;
    const raizDoc = document.documentElement;
    const texto = document.getElementById("texto-da-aula");
    let ultimo = window.scrollY;
    let esperando = false;
    const medir = () => {
      esperando = false;
      if (texto && regua.current) {
        const caixa = texto.getBoundingClientRect();
        const total = caixa.height - window.innerHeight * 0.6;
        const feito = total > 0 ? Math.min(1, Math.max(0, -caixa.top / total)) : 1;
        regua.current.style.transform = `scaleX(${feito})`;
      }
      const y = window.scrollY;
      const perto = y > raizDoc.scrollHeight - window.innerHeight - 320;
      if (Math.abs(y - ultimo) < 12 && !perto) return;
      if (y > ultimo && y > 160 && !perto) raizDoc.setAttribute("data-lendo", "");
      else raizDoc.removeAttribute("data-lendo");
      ultimo = y;
    };
    const rolar = () => {
      if (esperando) return;
      esperando = true;
      requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", rolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", rolar);
      raizDoc.removeAttribute("data-lendo");
    };
  }, [naAula, pathname]);

  const voltar = () => {
    if (andouAqui && window.history.length > 1) router.back();
    else router.push(localePath(lang, paginaDeCima(trechos)));
  };

  const compartilhar = () => {
    navigator.share({ title: titulo || site.name, url: window.location.href }).catch(() => {
      // a pessoa fechou a janela de compartilhar
    });
  };

  const nomeDaAba: Record<string, string> = { trilhas: t.nav.disciplines, acervo: t.nav.library, comunidade: t.nav.community };

  return (
    <header className="barra-do-celular no-leitor no-print no-focus md:hidden" data-raiz={raiz ?? undefined}>
      <div className="barra-linha">
        {raiz === "inicio" ? (
          <Link href={localePath(lang, "/")} aria-label={site.name} className="barra-marca">
            {/* A marca do instituto (o livro aberto com a estrela) não muda nunca. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={32} height={32} />
            <span>{site.name}</span>
          </Link>
        ) : raiz ? (
          // Nas outras abas: a marca e, quando o título grande da página sai da tela, o nome da aba ao lado dela.
          <Link href={localePath(lang, "/")} aria-label={site.name} className="barra-marca">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={32} height={32} />
            <span className="barra-titulo-raiz" data-visivel={mostrarTitulo || undefined}>
              {nomeDaAba[raiz]}
            </span>
          </Link>
        ) : (
          <button type="button" className="barra-icone" onClick={voltar} aria-label={t.common.back}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        {!raiz &&
          (aula ? (
            <span className="barra-centro">
              <span className="barra-sobre">{aula.posicao}</span>
              <span className="barra-titulo">{aula.trilha}</span>
            </span>
          ) : (
            <span className="barra-titulo" data-visivel={mostrarTitulo || undefined} aria-hidden={!mostrarTitulo}>
              {titulo}
            </span>
          ))}

        <span className="barra-acoes">
          {aula ? (
            <>
              {podeOuvir && (
                <button type="button" className="barra-icone" aria-pressed={falando} aria-label={falando ? t.lesson.stopListening : t.lesson.listenLesson} onClick={() => (falando ? stopReading() : startReading(TRECHOS_DA_AULA))}>
                  <svg aria-hidden viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7" />
                  </svg>
                </button>
              )}
              <button type="button" className="barra-icone" aria-haspopup="dialog" aria-label={t.celular.folhaDaAula} onClick={() => window.dispatchEvent(new Event(ABRIR_FOLHA_DA_AULA))}>
                Aa
              </button>
            </>
          ) : (
            <>
              {!raiz && podeCompartilhar && (
                <button type="button" className="barra-icone" aria-label={t.celular.compartilhar} onClick={compartilhar}>
                  <svg aria-hidden viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8" />
                  </svg>
                </button>
              )}
              {!naBusca && (
                <Link href={localePath(lang, "/busca")} className="barra-icone" aria-label={t.nav.search}>
                  {lupa}
                </Link>
              )}
              {raiz && <AccountLink />}
            </>
          )}
        </span>
      </div>
      {aula && (
        <div aria-hidden className="barra-lido">
          <span ref={regua} style={{ transform: "scaleX(0)" }} />
        </div>
      )}
    </header>
  );
}
