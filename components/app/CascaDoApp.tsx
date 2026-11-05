// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { localePath } from "@/i18n/config";
import { ligado } from "@/lib/recursos";
import { useI18n } from "../I18n";
import { GESTO, podeComecar, progressoDoGesto, temGestoDoSistema, valeComoVoltar, type Toque } from "./gesto";
import { ABAS, CONSULTA_CASCA, RAIZ_DA_ABA, abaDoEndereco, ehRaizDaAba, ehTelaCheiaPorEndereco, ehTelaComCascaPropria, trechosDoEndereco, type AbaDoApp } from "./modo";
import { registrarPagina, voltarOuSubir } from "./navegacao";
import { fecharTelaDaVez, fecharTelas } from "./telas";
import { textosDoApp } from "./textos";
import { comTransicao, esperarARota, semMovimento, type Direcao } from "./transicoes";

const ICONES: Record<AbaDoApp, React.ReactNode> = {
  inicio: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  estudar: <path d="M4 5.5h7v14H4zM13 5.5h7v14h-7zM4 9.5h7M13 9.5h7" />,
  jogos: <path d="M7 8h10a4 4 0 0 1 4 4.2l-.6 3.6a2.4 2.4 0 0 1-4.1 1.3L15 15.5H9l-1.3 1.6a2.4 2.4 0 0 1-4.1-1.3L3 12.2A4 4 0 0 1 7 8zM8 10.5v3M6.5 12h3M16 11.5h.01M18 13h.01" />,
  comunidade: <path d="M4 5h16v11H10l-4.5 4v-4H4z" />,
  eu: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />,
};

function assinarConsulta(aviso: () => void) {
  const consulta = window.matchMedia(CONSULTA_CASCA);
  consulta.addEventListener("change", aviso);
  return () => consulta.removeEventListener("change", aviso);
}
const casca = () => window.matchMedia(CONSULTA_CASCA).matches;

/**
 * A casca do aplicativo (docs/APP.md). Ativa só quando o site roda instalado (display-mode: standalone) num aparelho de
 * toque ou em tela de celular (abaixo de 768 px); no computador não faz nada. Faz quatro coisas:
 *  1. a barra de baixo do aplicativo (Início, Estudar, Jogos e labs, Comunidade, Eu), no lugar da do site;
 *  2. o voltar por gesto (deslizar da borda esquerda), sem tomar a rolagem de lado;
 *  3. as transições entre telas (View Transitions API, com a chegada em fade como reserva);
 *  4. as marcas em <html> (data-casca, data-casca-aba) que os outros pacotes do aplicativo leem.
 * A barra de cima é a de components/celular/BarraDoCelular.tsx (voltar, título, ações), que esta casca reaproveita.
 * Fora dela (painel, Rede v2 ligada, área infantil, página embutida) a casca não entra: cada um tem a sua.
 */
export function CascaDoApp() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useI18n();
  const s = textosDoApp(lang);
  const ativa = useSyncExternalStore(assinarConsulta, casca, () => false);
  const propria = ehTelaComCascaPropria(pathname, ligado("rede-v2"));
  const aba = abaDoEndereco(pathname);
  const vale = ativa && !propria;

  const pathRef = useRef(pathname);
  const langRef = useRef(lang);
  const avisarRota = useRef<(() => void) | null>(null);
  const indicador = useRef<HTMLSpanElement>(null);
  const vistoAntes = useRef<string | null>(null);

  // A cada tela nova: conta que a pessoa andou e acorda quem espera a troca.
  useEffect(() => {
    pathRef.current = pathname;
    langRef.current = lang;
    registrarPagina();
    avisarRota.current?.();
    avisarRota.current = null;
  }, [pathname, lang]);

  // A chegada em fade (reserva da transição, para o aparelho sem View Transitions). A primeira tela não faz fade.
  useEffect(() => {
    const anterior = vistoAntes.current;
    vistoAntes.current = pathname;
    if (anterior === null || anterior === pathname || !vale || document.documentElement.hasAttribute("data-transicao") || semMovimento()) return;
    const raiz = document.documentElement;
    raiz.setAttribute("data-chega", "");
    const fim = setTimeout(() => raiz.removeAttribute("data-chega"), 260);
    return () => {
      clearTimeout(fim);
      raiz.removeAttribute("data-chega");
    };
  }, [pathname, lang, vale]);

  // Ao mudar de endereço nenhuma tela de ferramenta fica aberta por cima da página nova (nem a trava de rolagem dela).
  useEffect(() => {
    fecharTelas();
  }, [pathname]);

  // As marcas em <html> para os outros pacotes do aplicativo (e para o CSS de quem precisar).
  useEffect(() => {
    const raiz = document.documentElement;
    if (!vale) return;
    raiz.setAttribute("data-casca", "");
    if (aba) raiz.setAttribute("data-casca-aba", aba);
    else raiz.removeAttribute("data-casca-aba");
    // Tela cheia "por endereço" (um laboratório aberto): só a barra de baixo sai; a de cima continua com o voltar.
    // O gancho useTelaCheia (components/app/telas.ts) usa outra marca (data-tela-cheia) e tira as duas barras.
    if (ehTelaCheiaPorEndereco(pathname)) raiz.setAttribute("data-tela-cheia-rota", "");
    else raiz.removeAttribute("data-tela-cheia-rota");
    return () => {
      raiz.removeAttribute("data-casca");
      raiz.removeAttribute("data-casca-aba");
      raiz.removeAttribute("data-tela-cheia-rota");
    };
  }, [vale, aba, pathname]);

  const ir = (href: string, direcao: Direcao) => {
    const espera = esperarARota();
    avisarRota.current = espera.avisar;
    void comTransicao(direcao, () => {
      router.push(href);
      return espera.promessa;
    });
  };

  // Voltar por gesto: da borda esquerda para a direita. Só decide no fim do toque (touchend); se o sistema tomar o
  // gesto (Android com navegação por gestos), chega touchcancel e nada acontece: nunca voltam duas telas.
  useEffect(() => {
    if (!vale || temGestoDoSistema(navigator.userAgent, navigator.maxTouchPoints, navigator.platform)) return;
    let inicio: Toque | null = null;
    const ponta = indicador.current;
    const mostrar = (p: number) => {
      if (!ponta) return;
      ponta.style.opacity = p > 0 ? String(0.25 + p * 0.75) : "0";
      ponta.style.transform = `translate(${Math.round(p * 36) - 36}px, -50%) scale(${0.7 + p * 0.3})`;
    };
    const medir = (e: TouchEvent): Toque => ({ x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, t: performance.now() });
    const comecou = (e: TouchEvent) => {
      inicio = null;
      if (e.touches.length !== 1 || trechosDoEndereco(pathRef.current).length === 0) return;
      const toque = medir(e);
      if (toque.x > GESTO.borda || !podeComecar(e.target)) return;
      inicio = toque;
    };
    const andou = (e: TouchEvent) => {
      if (inicio) mostrar(progressoDoGesto(inicio, medir(e)));
    };
    const parou = () => {
      inicio = null;
      mostrar(0);
    };
    const terminou = (e: TouchEvent) => {
      const partida = inicio;
      parou();
      if (!partida || !valeComoVoltar(partida, medir(e))) return;
      // Há uma tela de ferramenta aberta (folha da aula, gaveta, cartão)? O voltar fecha ela, e a página fica onde está.
      if (fecharTelaDaVez()) return;
      const espera = esperarARota();
      avisarRota.current = espera.avisar;
      void comTransicao("voltar", () => {
        voltarOuSubir(router, pathRef.current, langRef.current);
        return espera.promessa;
      });
    };
    document.addEventListener("touchstart", comecou, { passive: true });
    document.addEventListener("touchmove", andou, { passive: true });
    document.addEventListener("touchend", terminou, { passive: true });
    document.addEventListener("touchcancel", parou, { passive: true });
    return () => {
      document.removeEventListener("touchstart", comecou);
      document.removeEventListener("touchmove", andou);
      document.removeEventListener("touchend", terminou);
      document.removeEventListener("touchcancel", parou);
    };
  }, [vale, router]);

  // Com a Escola ligada a barra de baixo é a dela (components/BottomNav.tsx); com o painel ou a Rede v2, a deles.
  const comBarra = !propria && !ligado("escola");

  return (
    <>
      <span ref={indicador} aria-hidden className="app-gesto-voltar">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </span>
      {comBarra && (
        <nav aria-label={s.menu} className="app-casca-abas app-abas abas-do-celular no-print no-focus fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[#c21f16] bg-[#1f1a14] pb-[var(--recuo-baixo)]">
          <ul className="grid grid-cols-5">
            {ABAS.map((item) => {
              const href = localePath(lang, RAIZ_DA_ABA[item]);
              const aberta = aba === item;
              return (
                <li key={item}>
                  <Link
                    href={href}
                    aria-current={aberta ? "page" : undefined}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || !casca()) return;
                      e.preventDefault();
                      if (!aberta) return ir(href, "aba");
                      // Tocar na aba aberta: numa tela de dentro, volta para a raiz da aba; na raiz, sobe até o começo.
                      if (!ehRaizDaAba(pathname)) return ir(href, "voltar");
                      window.scrollTo({ top: 0, behavior: semMovimento() ? "auto" : "smooth" });
                    }}
                    className={`aba-do-celular relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 font-sans text-[0.7rem] leading-tight ${aberta ? "aba-aberta bg-[#c21f16] font-bold text-white" : "text-[#e9dcbc] hover:text-white"}`}
                  >
                    <span className="aba-icone">
                      <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={aberta ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                        {ICONES[item]}
                      </svg>
                    </span>
                    <span className="max-w-full truncate">{s.abas[item]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
