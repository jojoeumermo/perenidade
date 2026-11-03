// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import { aberturaVista, marcarAberturaVista } from "@/lib/escola/estudante";
import type { TextosDaBase } from "@/lib/escola/textos";
import { iniciar, parar, useLeitor } from "@/lib/vozes/leitor";
import { carregarLista, faltaBaixar, lerEscolha, VOZ_DO_APARELHO } from "@/lib/vozes/catalogo";
import "@/styles/escola-base.css";

/** Evento que abre a abertura de novo ("Ver a abertura de novo", na entrada). */
const REVER = "lucia:escola-abertura";
/** Cada quadro fica 10 s quando avança sozinho: uns 40 s no total. */
const DURACAO = 10_000;

export interface TrechoPublicado {
  texto: string;
  /** Idioma do texto: o da página, ou "pt" quando ainda não há tradução publicada. */
  idioma: string;
  /** Não há versão publicada neste idioma: mostra o original com "(texto em português)". */
  emPortugues: boolean;
}

type Quadro = { id: string; titulo: string; corpo: React.ReactNode; idioma?: string };

/** Sem animação e sem avanço sozinho: movimento reduzido (do aparelho ou do site), leitor de tinta ou modo leve. */
function semMovimento(): boolean {
  const raiz = document.documentElement;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || raiz.hasAttribute("data-parado") || raiz.hasAttribute("data-eink") || raiz.hasAttribute("data-light");
}

/**
 * A abertura da Escola (R1-65): aparece só na primeira visita a /escola. É uma camada por cima da página com "Pular"
 * sempre à vista; Esc fecha; o foco fica preso nela enquanto está aberta e volta para onde estava ao fechar. Quatro
 * quadros curtos que avançam sozinhos (uns 40 s) só sem movimento reduzido; com ele, só pelo "Seguir". "Ouvir" lê o
 * quadro com a voz escolhida em "Ouvir a aula" (a do aparelho, por padrão) e nunca baixa uma voz sem perguntar antes.
 */
export function AberturaDaEscola({ lang, s, textoDeLucia, trecho }: { lang: Locale; s: TextosDaBase["abertura"]; textoDeLucia: string; trecho: TrechoPublicado | null }) {
  const [aberta, setAberta] = useState(false);
  const [i, setI] = useState(0);
  const [sozinho, setSozinho] = useState(false);
  const [pergunta, setPergunta] = useState<{ bytes: number } | null>(null);
  const leitor = useLeitor();
  const caixa = useRef<HTMLDivElement>(null);
  const antes = useRef<Element | null>(null);
  const tituloId = useId();

  const quadros: Quadro[] = [
    { id: "q1", titulo: s.q1Titulo, corpo: <p>{s.q1Texto}</p> },
    { id: "q2", titulo: s.q2Titulo, corpo: <p lang="pt-BR">{textoDeLucia}</p> },
    ...(trecho
      ? [
          {
            id: "q3",
            titulo: s.q3Titulo,
            idioma: trecho.idioma,
            corpo: (
              <figure>
                <blockquote className="border-l-4 border-oxblood pl-4 italic" lang={trecho.idioma === "pt" ? "pt-BR" : trecho.idioma}>
                  {trecho.texto}
                </blockquote>
                <figcaption className="mt-3 font-sans text-sm text-ink-soft">
                  <Link href={localePath(lang, "/quem-somos")} className="underline hover:text-oxblood">
                    {s.fonte}
                  </Link>
                  {trecho.emPortugues && <span> {s.emPortugues}</span>}
                </figcaption>
              </figure>
            ),
          },
        ]
      : []),
    { id: "q4", titulo: s.q4Titulo, corpo: <p>{s.q4Texto}</p> },
  ];
  const total = quadros.length;
  const ultimo = i >= total - 1;
  const quadro = quadros[Math.min(i, total - 1)];

  // Primeira visita: abre depois da hidratação (o HTML do servidor é igual para todo mundo).
  useEffect(() => {
    const abrir = () => {
      antes.current = document.activeElement;
      setI(0);
      setSozinho(!semMovimento());
      setAberta(true);
    };
    const id = window.setTimeout(() => {
      if (!aberturaVista()) abrir();
    }, 0);
    window.addEventListener(REVER, abrir);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(REVER, abrir);
    };
  }, []);

  const fechar = useCallback(() => {
    parar();
    setPergunta(null);
    setAberta(false);
    marcarAberturaVista();
    const voltar = antes.current;
    window.setTimeout(() => {
      if (voltar instanceof HTMLElement && voltar.isConnected) voltar.focus();
      else document.getElementById("conteudo")?.focus();
    }, 0);
  }, []);

  const seguir = useCallback(() => {
    parar();
    setPergunta(null);
    if (ultimo) fechar();
    else setI((n) => n + 1);
  }, [ultimo, fechar]);

  // Avança sozinho (sem movimento reduzido), parando enquanto a voz lê ou a pergunta da voz está aberta.
  useEffect(() => {
    if (!aberta || !sozinho || ultimo || leitor.ativo || pergunta) return;
    const id = window.setTimeout(() => setI((n) => Math.min(n + 1, total - 1)), DURACAO);
    return () => window.clearTimeout(id);
  }, [aberta, sozinho, ultimo, leitor.ativo, pergunta, i, total]);

  // O foco entra na camada ao abrir e a cada quadro novo vai para o título (o leitor de tela lê o quadro).
  useEffect(() => {
    if (!aberta) return;
    caixa.current?.querySelector<HTMLElement>("[data-titulo-do-quadro]")?.focus();
  }, [aberta, i]);

  // Esc fecha; Tab fica dentro da camada.
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar();
        return;
      }
      if (e.key !== "Tab" || !caixa.current) return;
      const focaveis = [...caixa.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex='0']")].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const fim = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !caixa.current.contains(ativo))) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && (ativo === fim || !caixa.current.contains(ativo))) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberta, fechar]);

  async function ouvir() {
    if (leitor.ativo) {
      parar();
      return;
    }
    const escolha = lerEscolha();
    if (escolha.voz !== VOZ_DO_APARELHO) {
      const lista = await carregarLista();
      const voz = lista?.vozes.find((v) => v.id === escolha.voz);
      const falta = lista && voz ? await faltaBaixar(lista, voz) : 0;
      if (falta > 0) {
        setPergunta({ bytes: falta });
        return;
      }
    }
    void iniciar(["#abertura-quadro-texto"]);
  }

  if (!aberta) return null;
  const tamanho = pergunta ? `${new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(Math.max(1, pergunta.bytes / 1_000_000))} MB` : "";
  return (
    <div className="abertura-da-escola no-print" data-abertura-da-escola="">
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={tituloId} className="abertura-folha font-serif">
        {sozinho && !ultimo && !leitor.ativo && !pergunta && (
          <div className="abertura-tempo" aria-hidden>
            <span key={i} style={{ animationDuration: `${DURACAO}ms` }} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-2 font-sans text-sm">
          <span className="text-ink-soft" aria-live="polite">
            {s.de.replace("{n}", String(i + 1)).replace("{total}", String(total))}
          </span>
          <button type="button" onClick={fechar} className="cursor-pointer px-3 font-semibold underline hover:text-oxblood">
            {s.pular}
          </button>
        </div>
        <div key={quadro.id} id="abertura-quadro-texto" className="abertura-quadro px-5 py-6 sm:px-7">
          <p className="rotulo font-sans">{s.rotulo}</p>
          <h2 id={tituloId} data-titulo-do-quadro="" tabIndex={-1} className="mt-2 text-3xl font-semibold leading-tight outline-none sm:text-4xl">
            {quadro.titulo}
          </h2>
          <div className="mt-4 text-xl leading-relaxed">{quadro.corpo}</div>
        </div>
        {pergunta && (
          <div role="alert" className="mx-5 mb-4 border border-rule bg-parchment-deep p-4 font-sans text-sm">
            <p>{s.baixarVoz.replace("{tamanho}", tamanho)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="cursor-pointer border-2 border-ink px-4 font-medium hover:border-oxblood hover:text-oxblood"
                onClick={() => {
                  setPergunta(null);
                  void iniciar(["#abertura-quadro-texto"]);
                }}
              >
                {s.baixarSim}
              </button>
              <button type="button" className="cursor-pointer px-4 underline hover:text-oxblood" onClick={() => setPergunta(null)}>
                {s.baixarNao}
              </button>
            </div>
          </div>
        )}
        {leitor.erro === "sem-voz" && <p className="mx-5 mb-4 font-sans text-sm text-ink-soft">{s.semVoz}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3 font-sans">
          <button type="button" onClick={() => void ouvir()} aria-pressed={leitor.ativo} className="cursor-pointer px-2 underline hover:text-oxblood">
            {leitor.ativo ? s.parar : s.ouvir}
          </button>
          <button type="button" onClick={seguir} className="cursor-pointer border-2 border-ink bg-ink px-5 font-medium text-parchment hover:border-oxblood hover:bg-oxblood">
            {ultimo ? s.entrar : s.seguir}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Ver a abertura de novo", na entrada da Escola. */
export function ReverAbertura({ texto }: { texto: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(REVER))} className="inline-flex min-h-11 cursor-pointer items-center font-sans text-sm text-ink-soft underline hover:text-oxblood">
      {texto}
    </button>
  );
}
