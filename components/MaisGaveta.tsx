// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { localePath } from "@/i18n/config";
import type { SecaoDoSite } from "@/lib/secoes-do-site";
import { site } from "@/lib/site";
import { normalize } from "@/lib/text";
import { useI18n } from "./I18n";
import { ABRIR_MAIS, LanguageSwitcher } from "./NavLinks";

const USADOS = "lucia:mais-usados";

function lerUsados(): Record<string, number> {
  try {
    const valor = JSON.parse(localStorage.getItem(USADOS) ?? "{}");
    return valor && typeof valor === "object" ? valor : {};
  } catch {
    return {};
  }
}

function contarUso(path: string) {
  try {
    const usados = lerUsados();
    usados[path] = (usados[path] ?? 0) + 1;
    localStorage.setItem(USADOS, JSON.stringify(usados));
  } catch {
    // sem armazenamento, sem lembrança
  }
}

/**
 * O "Mais" numa janela só, sem rolagem infinita: todas as seções que não cabem no menu, por objetivo, em colunas,
 * com uma busca no alto e, quando houver, as três que a pessoa mais abre (lembradas só neste aparelho).
 * No celular vira uma folha de tela inteira com os grupos recolhidos.
 */
export interface TextosDoMais {
  titulo: string;
  busca: string;
  maisUsadas: string;
  rodape: string;
  instagram: string;
}

export function MaisGaveta({ secoes, textos }: { secoes: SecaoDoSite[]; textos: TextosDoMais }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  // A janela guarda em que página foi aberta: trocou de página, ela some sozinha (sem efeito que feche).
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const aberta = abertaEm !== null && abertaEm === pathname;
  const setAberta = (valor: boolean) => setAbertaEm(valor ? pathname : null);
  const pathnameAtual = useRef(pathname);
  useEffect(() => {
    pathnameAtual.current = pathname;
  }, [pathname]);
  const [busca, setBusca] = useState("");
  const [usados, setUsados] = useState<Record<string, number>>({});
  const campo = useRef<HTMLInputElement>(null);
  const antes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abrir = () => {
      antes.current = document.activeElement as HTMLElement | null;
      setUsados(lerUsados());
      setBusca("");
      setAbertaEm(pathnameAtual.current);
    };
    window.addEventListener(ABRIR_MAIS, abrir);
    return () => window.removeEventListener(ABRIR_MAIS, abrir);
  }, []);

  useEffect(() => {
    if (!aberta) return;
    const raiz = document.documentElement;
    raiz.style.setProperty("overflow", "hidden");
    const foco = window.setTimeout(() => campo.current?.focus(), 30);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertaEm(null);
    };
    window.addEventListener("keydown", tecla);
    return () => {
      raiz.style.removeProperty("overflow");
      window.clearTimeout(foco);
      window.removeEventListener("keydown", tecla);
      antes.current?.focus?.();
    };
  }, [aberta]);

  const termo = normalize(busca.trim());
  const filtradas = useMemo(
    () => secoes.map((s) => ({ ...s, items: s.items.filter((i) => !termo || normalize(`${i.label} ${i.description}`).includes(termo)) })).filter((s) => s.items.length > 0),
    [secoes, termo],
  );
  const todas = useMemo(() => secoes.flatMap((s) => s.items), [secoes]);
  const preferidas = Object.entries(usados)
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => todas.find((item) => item.path === path))
    .filter((item): item is SecaoDoSite["items"][number] => Boolean(item))
    .slice(0, 3);

  if (!aberta) return null;

  const ir = (path: string) => contarUso(path);

  return (
    <div className="mais-veu no-print fixed inset-0 z-50 flex items-start justify-center bg-[#1f1a14]/45 md:px-4 md:pt-[calc(var(--altura-topo,9rem)+0.5rem)]" onClick={() => setAberta(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={textos.titulo}
        onClick={(e) => e.stopPropagation()}
        className="mais-janela flex h-full w-full max-w-[78rem] flex-col border-ink bg-folha text-ink md:h-auto md:max-h-[calc(100dvh-var(--altura-topo,9rem)-1.5rem)] md:border-2 md:shadow-[8px_8px_0_var(--prelo)]"
      >
        <div className="flex items-center gap-3 border-b-2 border-ink px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 md:px-7 md:pt-5 md:pb-4">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 border-2 border-ink bg-parchment px-3">
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 20 20" />
            </svg>
            <span className="sr-only">{t.lists.find}</span>
            <input
              ref={campo}
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              maxLength={60}
              placeholder={textos.busca}
              className="min-w-0 flex-1 bg-transparent py-2.5 font-sans text-base outline-none placeholder:text-ink-soft"
            />
          </label>
          <button type="button" onClick={() => setAberta(false)} aria-label={t.a11y.close} className="botao botao-papel h-11 w-11 shrink-0 p-0 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:px-7 md:pt-5">
          {preferidas.length > 0 && !termo && (
            <p className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rotulo mr-1">{textos.maisUsadas}</span>
              {preferidas.map((item) => (
                <Link key={item.path} href={localePath(lang, item.path)} onClick={() => ir(item.path)} className="chip font-semibold">
                  {item.label}
                </Link>
              ))}
            </p>
          )}
          {filtradas.length === 0 && <p className="py-6 text-lg text-ink-soft">{t.lists.none}</p>}

          {/* No computador: as seções correm em quatro colunas equilibradas, cada grupo com a sua tarja. */}
          <div className="hidden gap-x-8 md:block md:columns-3 xl:columns-4">
            {filtradas.map((secao, i) => (
              <nav key={secao.title} aria-label={secao.title} className="mb-5 break-inside-avoid">
                <p className={`mb-1.5 inline-block px-2.5 py-1 font-mono text-[0.72rem] uppercase tracking-[0.18em] ${i === 1 ? "bg-[#c21f16] text-white" : "bg-ink text-parchment"}`}>{secao.title}</p>
                <ul>
                  {secao.items.map((item) => (
                    <li key={item.path} className="break-inside-avoid">
                      <Link href={localePath(lang, item.path)} onClick={() => ir(item.path)} title={item.description} className="mais-item group flex items-baseline gap-2 border-b border-dashed border-rule px-2 py-1.5 font-sans text-ink hover:bg-ink hover:text-parchment">
                        <span className="font-semibold">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* No celular: os grupos recolhidos; com busca, abertos. */}
          <div className="space-y-3 md:hidden">
            {filtradas.map((secao) => (
              <details key={secao.title} open={Boolean(termo)} className="border-2 border-ink bg-parchment">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-mono text-xs uppercase tracking-[0.18em]">
                  {secao.title}
                  <span className="text-ink-soft">{secao.items.length}</span>
                </summary>
                <ul className="border-t-2 border-ink">
                  {secao.items.map((item) => (
                    <li key={item.path}>
                      <Link href={localePath(lang, item.path)} onClick={() => ir(item.path)} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 last:border-b-0">
                        <span className="min-w-0">
                          <span className="block font-semibold leading-snug">{item.label}</span>
                          <span className="mt-0.5 block line-clamp-2 font-sans text-[0.8rem] leading-snug text-ink-soft">{item.description}</span>
                        </span>
                        <span aria-hidden className="font-sans text-2xl leading-none text-ink-soft">›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <label className="flex items-center justify-between gap-4 border-2 border-ink bg-parchment px-4 py-2 font-sans [&_select]:max-w-none">
              {t.common.language}
              <LanguageSwitcher wide />
            </label>
          </div>

          <p className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft">
            <span>{textos.rodape}</span>
            <a href={site.instagram} target="_blank" rel="noopener noreferrer me" className="text-ink underline hover:text-prelo-texto">
              {textos.instagram} · @institutoluciaorg ↗
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
