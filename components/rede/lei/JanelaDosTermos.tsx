// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A janela dos termos (P5, A6): quem entrou na Alumia e ainda não aceitou a versão em vigor dos termos (ou nunca aceitou) vê uma
// janela grande, por cima de tudo, que bloqueia o uso até marcar que leu e aceitou. O resto da página fica inerte (nem o mouse,
// nem o teclado, nem o leitor de tela chegam lá). Os termos, a privacidade, o que guardamos, as regras e a ajuda abrem DENTRO da
// janela: os links dessas cinco páginas trocam a aba em vez de sair; "Meus dados" (baixar os dados e apagar a conta, para quem não
// concorda) abre a página dela, onde a janela não aparece. Versão nova dos termos: a janela volta.
// A saída rápida continua valendo com a janela aberta: o botão dela está na própria janela, e o Esc Esc Esc do modo seguro
// (components/SaidaRapida.tsx) ouve na fase de captura, antes de qualquer coisa daqui. A janela nunca fecha com Esc sem o aceite.
// Depois de aceito, a pessoa reabre a janela quando quiser: pelo evento ABRIR_OS_TERMOS (Ajustes e o botão de Segurança).
import "./lei.css";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { type ComponentType, type MouseEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DESTINO_DA_SAIDA, sairRapido } from "@/lib/rede/saida";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Situacao } from "@/lib/rede/tipos";
import { ENCAIXES } from "../encaixes";
import type { PropsDaTelaDoPacote } from "../registro";
import { quando, Rico, type PaginaDaLei } from "./base";
import { levaParaForaDaJanela, paginaDoEndereco, SEM_JANELA } from "./janela-enderecos";
import { lei } from "./cliente";
import { useTermos } from "./Reaceite";
import { por } from "./textos";
import { useTextosDaLei } from "./usarTextos";
import { dataDaVersao } from "./versao";

/** O evento que reabre a janela (depois de aceito, só para ler; fecha com o botão ou com Esc). */
export const ABRIR_OS_TERMOS = "alumia:abrir-termos";

/** Abre a janela dos termos de qualquer lugar da Alumia. */
export function abrirOsTermos(pagina: PaginaDaLei = "termos") {
  window.dispatchEvent(new CustomEvent(ABRIR_OS_TERMOS, { detail: pagina }));
}

type PropsDaPagina = PropsDaTelaDoPacote & { semAceite?: boolean };
const PAGINAS: Record<PaginaDaLei, ComponentType<PropsDaPagina>> = {
  termos: dynamic(() => import("./TelaDosTermos"), { ssr: false }),
  privacidade: dynamic(() => import("./TelaDaPrivacidade"), { ssr: false }),
  guardamos: dynamic(() => import("../seguranca/OQueGuardamos"), { ssr: false }),
  regras: dynamic(() => import("./TelaDasRegras"), { ssr: false }),
  ajuda: dynamic(() => import("./TelaDaAjuda"), { ssr: false }),
};
const nada = () => undefined;

export function JanelaDosTermos({ lang, s, situacao }: { lang: string; s: TextosDaRede; situacao: Situacao }) {
  const t = useTextosDaLei(lang);
  const [termos, setTermos] = useTermos(situacao.logado);
  const caminho = usePathname() ?? "";
  const [lendo, setLendo] = useState<PaginaDaLei | null>(null);
  const [pagina, setPagina] = useState<PaginaDaLei>("termos");
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const corpo = useRef<HTMLDivElement>(null);
  const id = useId();

  const pendente = Boolean(termos?.logado && !termos.aceita);
  const aberta = (pendente && !SEM_JANELA.test(caminho)) || lendo !== null;

  // Reabrir pela Segurança ou pelos Ajustes.
  useEffect(() => {
    const abrir = (e: Event) => {
      const p = (e as CustomEvent<PaginaDaLei | undefined>).detail;
      setPagina(p && p in PAGINAS ? p : "termos");
      setLendo(p && p in PAGINAS ? p : "termos");
    };
    window.addEventListener(ABRIR_OS_TERMOS, abrir);
    return () => window.removeEventListener(ABRIR_OS_TERMOS, abrir);
  }, []);

  // Com a janela aberta, o resto da página fica inerte e não rola; o foco vai para o título.
  useEffect(() => {
    if (!aberta) return;
    const raiz = document.getElementById(`${id}-raiz`);
    const irmaos = [...document.body.children].filter((el) => el !== raiz && !el.hasAttribute("inert"));
    for (const el of irmaos) el.setAttribute("inert", "");
    const rolagem = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.getElementById(`${id}-t`)?.focus();
    return () => {
      for (const el of irmaos) el.removeAttribute("inert");
      document.documentElement.style.overflow = rolagem;
    };
  }, [aberta, id]);

  const fecharLeitura = useCallback(() => setLendo(null), []);
  // Esc só fecha a leitura de quem já aceitou; com o aceite pendente, a janela fica (a saída rápida é outra coisa e continua).
  useEffect(() => {
    if (!aberta || pendente) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fecharLeitura();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, pendente, fecharLeitura]);

  if (!aberta || !t || !termos?.logado) return null;
  const r = t.reaceite;
  const j = t.janela;
  const Pagina = PAGINAS[pagina];
  // O tema (claro ou escuro) é o da casca: a janela mora fora dela, direto no body.
  const tema = document.querySelector('[data-al="2"]:not(.le-janela-fundo)')?.getAttribute("data-al-tema") ?? undefined;

  // Os links das cinco páginas trocam a aba aqui dentro; "Meus dados" e o resto do site abrem fora (o resto em outra aba).
  const noClique = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || !a.getAttribute("href") || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#")) return;
    const destino = paginaDoEndereco(href, window.location.origin);
    if (destino) {
      e.preventDefault();
      setPagina(destino.pagina);
      requestAnimationFrame(() => {
        const alvo = destino.ancora ? corpo.current?.querySelector(`#${CSS.escape(destino.ancora)}`) : null;
        if (alvo) alvo.scrollIntoView();
        else corpo.current?.scrollTo({ top: 0 });
      });
      return;
    }
    if (levaParaForaDaJanela(href)) {
      setLendo(null);
      return;
    }
    e.preventDefault();
    window.open(new URL(href, window.location.origin).toString(), "_blank", "noopener,noreferrer");
  };

  const aceitar = async () => {
    setEnviando(true);
    setErro(false);
    try {
      setTermos(await lei.aceitar(termos.vigente));
      setLendo(null);
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  };

  return createPortal(
    <div id={`${id}-raiz`} data-al="2" data-al-tema={tema} className="al-pele le-janela-fundo">
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="le-janela">
        <header className="le-janela-cabeca">
          <h2 id={`${id}-t`} tabIndex={-1} className="al-cond">{pendente ? (termos.anterior ? r.tituloMudou : r.tituloNovo) : j.titulo}</h2>
          <p id={`${id}-d`}>{pendente ? por(j.leia, { data: dataDaVersao(lang) }) : por(r.aceito, { quando: quando(lang, termos.aceita_em, false) })}</p>
          {pendente && termos.anterior && termos.mudou && <p><strong>{por(r.mudou, { mudou: termos.mudou })}</strong></p>}
          <div className="le-janela-topo-acoes">
            <button type="button" className="al-botao al-botao-p le-janela-sair" onClick={() => void sairRapido(DESTINO_DA_SAIDA, ENCAIXES.aoSairRapido)} title={j.saidaAjuda}>
              {j.saida}
            </button>
            {!pendente && (
              <button type="button" className="al-botao al-botao-p" onClick={fecharLeitura}>
                {j.fechar}
              </button>
            )}
          </div>
        </header>
        {/* O conteúdo das cinco páginas, com a faixa delas no alto: um clique num link troca a página aqui dentro. */}
        <div ref={corpo} className="le-janela-corpo" onClickCapture={noClique}>
          <Pagina lang={lang} s={s} situacao={situacao} params={{}} aoEscrever={nada} semAceite />
        </div>
        {pendente && (
          <footer className="le-janela-pe le-reaceite">
            <label>
              <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
              <span>{r.caixa}</span>
            </label>
            <div className="le-acoes">
              <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={!marcado || enviando} onClick={aceitar}>
                {enviando ? t.comum.enviando : r.aceitar}
              </button>
            </div>
            {erro && <p role="alert">{t.comum.erro}</p>}
            <p className="le-pequeno" onClickCapture={noClique}>
              <Rico lang={lang} texto={r.naoQuer} />
            </p>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
