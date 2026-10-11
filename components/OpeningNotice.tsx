// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { getItem, KEYS, parse, setItem, useHydrated, useStored } from "@/lib/storage";
import { useI18n } from "./I18n";

export interface Notice {
  definido?: boolean;
  ativo: boolean;
  versao: number;
  titulo: string;
  texto: string;
  imagem: string;
  credito: string;
  link: string;
  link_texto: string;
  assinatura: string;
  /** Último dia em que o aviso aparece (AAAA-MM-DD). Vazio: sem data para sair. */
  ate: string;
}

interface Saved {
  /** Quando a versão do painel foi conferida pela última vez. */
  em?: number;
  valor?: Notice | { definido: false } | null;
  /** Versão que a pessoa já fechou. */
  fechado?: number;
}

const SEIS_HORAS = 6 * 3600 * 1000;

/**
 * O quadro que abre junto com o site. O texto vem dos arquivos do site; se a liderança guardou
 * outro pelo painel, vale o do painel (conferido no máximo uma vez a cada seis horas por navegador).
 * Quem fecha não vê de novo até o aviso mudar. Só aparece em português.
 */
export function OpeningNotice({ initial, close }: { initial: Notice | null; close: string }) {
  const { lang } = useI18n();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const raw = useStored(KEYS.notice);
  const saved = useMemo(() => parse<Saved>(raw, {}), [raw]);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!hasBackend) return;
    const before = parse<Saved>(getItem(KEYS.notice), {});
    if (before.em && Date.now() - before.em < SEIS_HORAS) return;
    let cancelled = false;
    rpc<Notice | { definido: false } | null>("abertura")
      .then((valor) => {
        if (!cancelled) setItem(KEYS.notice, JSON.stringify({ ...parse<Saved>(getItem(KEYS.notice), {}), em: Date.now(), valor }));
      })
      .catch(() => {
        // Sem conexão com o serviço: fica valendo o aviso dos arquivos do site.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const remote = saved.valor && saved.valor.definido ? (saved.valor as Notice) : null;
  const notice = remote ?? initial;
  const today = hydrated ? new Date().toLocaleDateString("sv-SE") : "";
  const inside = /\/(painel|entrar)(\/|$)/.test(pathname);
  const show = Boolean(hydrated && lang === "pt" && !inside && notice?.ativo && notice.titulo && (!notice.ate || today <= notice.ate) && saved.fechado !== notice.versao);

  useEffect(() => {
    const element = dialog.current;
    if (show && element && !element.open) element.showModal();
  }, [show]);

  if (!show || !notice) return null;
  const dismiss = () => setItem(KEYS.notice, JSON.stringify({ ...parse<Saved>(getItem(KEYS.notice), {}), fechado: notice.versao }));
  const internal = notice.link.startsWith("/");

  return (
    <dialog
      ref={dialog}
      onClose={dismiss}
      aria-labelledby="aviso-titulo"
      className="no-print m-auto max-h-[92vh] w-[min(92vw,44rem)] max-w-none overflow-y-auto border-2 border-ink bg-parchment p-0 text-ink shadow-2xl backdrop:bg-black/70"
    >
      <form method="dialog">
        <button type="submit" aria-label={close} title={close} className="absolute right-2 top-2 z-10 flex h-11 w-11 cursor-pointer items-center justify-center border-2 border-ink bg-parchment font-sans text-xl font-bold leading-none hover:bg-ink hover:text-parchment">
          ✕
        </button>
      </form>
      <div className="grid sm:grid-cols-[14rem_1fr]">
        {notice.imagem && (
          <figure className="relative h-48 bg-oxblood sm:h-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={notice.imagem} alt="" width={440} height={586} className="absolute inset-0 h-full w-full object-cover object-top" />
          </figure>
        )}
        <div className={`p-6 pr-14 ${notice.imagem ? "" : "sm:col-span-2"}`}>
          <h2 id="aviso-titulo" className="font-serif text-3xl font-semibold leading-tight">
            {notice.titulo}
          </h2>
          <div className="mt-3 space-y-3 font-serif text-lg leading-snug">
            {notice.texto.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {notice.assinatura && <p className="mt-4 font-sans text-sm text-ink-soft">{notice.assinatura}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-4 font-sans text-sm">
            {notice.link &&
              notice.link_texto &&
              (internal ? (
                <Link href={notice.link} onClick={() => dialog.current?.close()} className="bg-oxblood px-5 py-2.5 font-medium text-parchment hover:bg-ink">
                  {notice.link_texto}
                </Link>
              ) : (
                <a href={notice.link} target="_blank" rel="noopener noreferrer" className="bg-oxblood px-5 py-2.5 font-medium text-parchment hover:bg-ink">
                  {notice.link_texto}
                </a>
              ))}
            <form method="dialog">
              <button type="submit" className="cursor-pointer underline hover:text-oxblood">
                {close}
              </button>
            </form>
          </div>
          {notice.credito && <p className="mt-4 font-mono text-[0.7rem] leading-tight text-ink-soft">{notice.credito}</p>}
        </div>
      </div>
    </dialog>
  );
}
