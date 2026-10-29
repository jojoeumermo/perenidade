// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { L } from "@/components/I18n";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setCompleted, useCompleted } from "@/lib/progress";
import { setPrefs, TEXT_SCALES, usePrefs } from "@/lib/prefs";
import { localePath } from "@/i18n/config";
import { ANOTAR } from "../aula/BarraDaAula";
import { ABRIR_CAIXA } from "../aula/MargemDaAula";
import { useI18n } from "../I18n";

/** A barra de cima (o "Aa") abre a folha da aula por este aviso. */
export const ABRIR_FOLHA_DA_AULA = "lucia:folha-da-aula";

interface AulaDaLista {
  id: string;
  path: string;
  title: string;
  ready?: boolean;
}

interface Secao {
  id: string;
  titulo: string;
}

/**
 * A aula no celular, embaixo, ao alcance do polegar: a folha da aula (sumário, letra e ferramentas), a aula anterior e
 * "Concluir e seguir", que marca a aula como feita neste aparelho e já abre a próxima. Enquanto ela está na tela, as
 * abas do site saem (a barra de cima tem o voltar). Só no celular; no computador e no leitor de tinta não aparece.
 */
export function AcoesDaAula({ id, anterior, proxima, aulas }: { id: string; anterior?: AulaDaLista; proxima?: AulaDaLista; aulas: AulaDaLista[] }) {
  const { lang, t } = useI18n();
  const c = t.celular;
  const router = useRouter();
  const feitas = useCompleted();
  const feita = feitas.has(id);
  const prefs = usePrefs();
  const [aberta, setAberta] = useState(false);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [foco, setFoco] = useState(false);
  const fechar = useRef<HTMLButtonElement>(null);
  const antes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abrir = () => {
      antes.current = document.activeElement as HTMLElement | null;
      setSecoes(
        [...document.querySelectorAll<HTMLElement>("#texto-da-aula h2[id]")].map((h) => ({ id: h.id, titulo: h.textContent?.trim() ?? "" })).filter((s) => s.titulo),
      );
      setFoco(document.documentElement.hasAttribute("data-aula-foco"));
      setAberta(true);
    };
    window.addEventListener(ABRIR_FOLHA_DA_AULA, abrir);
    return () => window.removeEventListener(ABRIR_FOLHA_DA_AULA, abrir);
  }, []);

  useEffect(() => {
    if (!aberta) return;
    const raiz = document.documentElement;
    raiz.style.setProperty("overflow", "hidden");
    const tempo = window.setTimeout(() => fechar.current?.focus(), 30);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
    };
    window.addEventListener("keydown", tecla);
    return () => {
      raiz.style.removeProperty("overflow");
      window.clearTimeout(tempo);
      window.removeEventListener("keydown", tecla);
      antes.current?.focus?.();
    };
  }, [aberta]);

  const concluir = () => {
    setCompleted(id, true);
    if (proxima) router.push(localePath(lang, proxima.path));
  };

  // Abrir uma ferramenta da aula (anotação, caixa de ferramentas) fecha a folha antes, para ela aparecer na frente.
  const usar = (fazer: () => void) => {
    setAberta(false);
    window.setTimeout(fazer, 60);
  };

  const escala = TEXT_SCALES.indexOf(prefs.scale as (typeof TEXT_SCALES)[number]);
  const icone = "flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-[1.1rem] border-[1.5px] border-ink bg-folha";
  const ferramenta = "flex cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent p-0 font-sans text-xs font-semibold text-ink";

  return (
    <>
      <div className="acoes-da-aula no-leitor no-print md:hidden" role="toolbar" aria-label={c.folhaDaAula}>
        <button type="button" className="acao-icone" aria-haspopup="dialog" aria-label={c.folhaDaAula} onClick={() => window.dispatchEvent(new Event(ABRIR_FOLHA_DA_AULA))}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
        </button>
        {anterior && (
          <L href={anterior.path} className="acao-icone" aria-label={`${c.anterior}: ${anterior.title}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </L>
        )}
        {feita && proxima ? (
          <L href={proxima.path} className="acao-principal">
            <span>
              {t.lesson.next} {proxima.title}
            </span>
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </L>
        ) : (
          <button type="button" className="acao-principal" data-feita={feita || undefined} aria-pressed={feita} onClick={() => (feita ? setCompleted(id, false) : concluir())}>
            <span>{feita ? `✓ ${t.lesson.done}` : proxima ? c.concluirSeguir : t.lesson.markDone}</span>
            {!feita && proxima && (
              <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        )}
      </div>

      {aberta && (
        <div className="folha-que-sobe-veu no-leitor no-print md:hidden" onClick={() => setAberta(false)}>
          <div role="dialog" aria-modal="true" aria-label={c.folhaDaAula} className="folha-que-sobe" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-[1.1rem] pt-2.5 pb-1.5">
              <span className="font-serif text-[1.4rem] font-semibold">{c.folhaDaAula}</span>
              <button ref={fechar} type="button" onClick={() => setAberta(false)} aria-label={t.a11y.close} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink bg-folha">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[1.1rem] pt-2 pb-6">
              <div className="grid grid-cols-4 gap-2">
                <button type="button" className={ferramenta} onClick={() => usar(() => window.dispatchEvent(new Event(ANOTAR)))}>
                  <span className={icone}>
                    <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 20h4L19 9l-4-4L4 16z" />
                      <path d="M13.5 6.5l4 4" />
                    </svg>
                  </span>
                  {t.lesson.annotate}
                </button>
                <button type="button" className={ferramenta} onClick={() => usar(() => window.dispatchEvent(new CustomEvent(ABRIR_CAIXA, { detail: "" })))}>
                  <span className={icone}>
                    <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="7" width="18" height="13" rx="2" />
                      <path d="M9 7V5h6v2M3 12h18" />
                    </svg>
                  </span>
                  {c.ferramentas}
                </button>
                <button
                  type="button"
                  className={ferramenta}
                  aria-pressed={foco}
                  onClick={() => {
                    const ligado = !foco;
                    document.documentElement.toggleAttribute("data-aula-foco", ligado);
                    setFoco(ligado);
                  }}
                >
                  <span className={`${icone} ${foco ? "bg-ink text-parchment" : ""}`}>
                    <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                    </svg>
                  </span>
                  {foco ? t.lesson.focusExit : t.lesson.focus}
                </button>
                <button
                  type="button"
                  className={ferramenta}
                  onClick={() =>
                    usar(() => {
                      // Com o compartilhar do aparelho, a lista de aplicativos dele; sem, os botões de WhatsApp e Telegram da aula.
                      if (typeof navigator.share === "function") navigator.share({ title: document.title, url: window.location.href }).catch(() => {});
                      else document.getElementById("compartilhar")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    })
                  }
                >
                  <span className={icone}>
                    <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8" />
                    </svg>
                  </span>
                  {c.compartilhar}
                </button>
              </div>

              <div className="mt-5 flex items-center gap-2.5 rounded-[1rem] border-[1.5px] border-ink bg-folha px-3 py-2.5 font-sans">
                <span className="flex-1 text-sm font-bold">{c.letra}</span>
                <button type="button" disabled={escala <= 0} onClick={() => setPrefs({ scale: TEXT_SCALES[Math.max(0, escala - 1)] })} aria-label={c.letraMenor} className="h-[2.4rem] w-[2.6rem] cursor-pointer rounded-[0.75rem] border-[1.5px] border-ink bg-parchment font-serif text-base font-semibold disabled:opacity-40">
                  A−
                </button>
                <span className="w-12 text-center font-mono text-xs font-medium">{prefs.scale}%</span>
                <button type="button" disabled={escala >= TEXT_SCALES.length - 1} onClick={() => setPrefs({ scale: TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, escala + 1)] })} aria-label={c.letraMaior} className="h-[2.4rem] w-[2.6rem] cursor-pointer rounded-[0.75rem] border-[1.5px] border-ink bg-ink font-serif text-xl font-semibold text-parchment disabled:opacity-40">
                  A+
                </button>
              </div>

              {secoes.length > 1 && (
                <nav aria-label={t.lesson.inThisLesson} className="mt-5">
                  <p className="rotulo">{t.lesson.inThisLesson}</p>
                  <ol className="mt-1.5">
                    {secoes.map((secao, i) => (
                      <li key={secao.id}>
                        <a href={`#${secao.id}`} onClick={() => setAberta(false)} className="flex min-h-12 items-center gap-3 border-b border-[var(--cel-fio)] font-sans text-[0.95rem] font-semibold text-ink">
                          <span className="font-mono text-[0.7rem] text-ink-soft">{i + 1}</span>
                          {secao.titulo}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}

              <nav aria-label={c.aulasDaTrilha} className="mt-5">
                <p className="rotulo">{c.aulasDaTrilha}</p>
                <ol className="mt-1.5">
                  {aulas.map((aula) => {
                    const aqui = aula.id === id;
                    const pronta = feitas.has(aula.id);
                    const marca = pronta ? "border-ok bg-ok" : aqui ? "border-[#c21f16] bg-[#c21f16]" : "border-ink";
                    const conteudo = (
                      <>
                        <span aria-hidden className={`flex h-[1.4rem] w-[1.4rem] shrink-0 items-center justify-center rounded-full border-[1.5px] ${marca}`}>
                          {pronta && (
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                          )}
                        </span>
                        <span className={`min-w-0 flex-1 ${aqui ? "font-extrabold" : ""} ${aula.ready === false ? "italic text-ink-soft" : ""}`}>{aula.title}</span>
                      </>
                    );
                    const linha = "flex min-h-12 items-center gap-3 border-b border-[var(--cel-fio)] font-sans text-[0.95rem] font-semibold text-ink";
                    return (
                      <li key={aula.id}>
                        {aula.ready === false || aqui ? (
                          <span className={linha} aria-current={aqui ? "page" : undefined}>
                            {conteudo}
                          </span>
                        ) : (
                          <L href={aula.path} className={linha} onClick={() => setAberta(false)}>
                            {conteudo}
                          </L>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
