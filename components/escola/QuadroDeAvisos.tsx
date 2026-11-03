// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { L } from "@/components/I18n";
import { PresencaSomada, type TextosDaPresenca } from "@/components/escola/PresencaSomada";
import { useGuardado } from "@/components/estudo/guardado";
import { fill, htmlLang, type Locale } from "@/i18n/config";
import { hasBackend } from "@/lib/backend";
import { type Evento, proximoEvento } from "@/lib/escola/calendario";
import type { Aviso, TextosDoCampus } from "@/lib/escola/campus-servidor";
import { CHAVES_DA_ESCOLA, lerMatricula } from "@/lib/escola/estudante";
import { hojeEmBrasilia } from "@/lib/escola/tempo";
import { estaLigado } from "@/lib/modo-seguro";
import { getItem, KEYS, parse } from "@/lib/storage";
import "@/styles/escola-campus.css";

const CHAVE_LIDOS = CHAVES_DA_ESCOLA.avisosLidos;
const MAX_LIDOS = 300;
const MAX_CARTOES = 3;

interface Cartao {
  id: string;
  rotulo: string;
  titulo: string;
  texto?: string;
  link?: string;
}

interface Novidade {
  titulo: string;
  data: string;
  url: string;
}

function lerLidos(): string[] {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(CHAVE_LIDOS) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-MAX_LIDOS) : [];
  } catch {
    return [];
  }
}

function gravarLidos(lidos: string[]) {
  if (estaLigado()) return; // modo seguro: vale só até fechar a aba
  try {
    globalThis.localStorage?.setItem(CHAVE_LIDOS, JSON.stringify(lidos.slice(-MAX_LIDOS)));
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // sem armazenamento: o aviso volta na próxima visita
  }
}

/** Quem volta: já terminou alguma aula neste aparelho ou tem matrícula. Quem chega não vê o quadro. */
function quemVolta(): boolean {
  return parse<unknown[]>(getItem(KEYS.done), []).length > 0 || lerMatricula() !== null;
}

/** As 3 novidades mais novas (jornal e acervo), pedidas só quando a página fica ociosa. */
function useNovidades(lang: Locale, pedir: boolean): Novidade[] {
  const [lista, setLista] = useState<Novidade[]>([]);
  useEffect(() => {
    if (!pedir) return;
    let vivo = true;
    const buscar = () => {
      fetch(`/${lang}/novidades.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { materias?: Novidade[]; obras?: Novidade[] } | null) => {
          if (!vivo || !j) return;
          const todas = [...(j.materias ?? []), ...(j.obras ?? [])].filter((n) => n && typeof n.titulo === "string" && typeof n.url === "string" && n.url.startsWith(`/${lang}/`));
          setLista(todas.sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 3));
        })
        .catch(() => undefined);
    };
    const ocioso = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ocioso ? ocioso(buscar, { timeout: 4000 }) : window.setTimeout(buscar, 1500);
    return () => {
      vivo = false;
      const cancelar = (globalThis as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback;
      if (ocioso && cancelar) cancelar(id);
      else window.clearTimeout(id);
    };
  }, [lang, pedir]);
  return lista;
}

const semIdioma = (url: string, lang: string) => (url.startsWith(`/${lang}/`) ? url.slice(lang.length + 1) : url);

/**
 * O quadro de avisos da Escola (E4-09, D1-4), para quem volta: os avisos da coordenação no prazo, o próximo evento do
 * calendário, a turma do mês, as novidades e a presença somada (E4-02). No máximo 3 cartões, sem número de não lidos e
 * sem notificação. "Já li" fica só no aparelho ("lucia:escola:avisos-lidos"). Quem chega não vê nada (nem espaço).
 */
export function QuadroDeAvisos({
  avisos,
  eventos,
  turmas,
  s,
  sCal,
  sPresenca,
  lang,
  className = "",
}: {
  avisos: Aviso[];
  eventos: Evento[];
  /** A turma do mês do mês em que a página foi feita e a do seguinte; o navegador escolhe a de hoje. */
  turmas: { mes: string; titulo: string }[];
  s: TextosDoCampus["quadro"];
  sCal: TextosDoCampus["calendario"];
  sPresenca: TextosDaPresenca;
  lang: Locale;
  className?: string;
}) {
  const [volta] = useGuardado<boolean>(quemVolta, false);
  const [lidosGuardados] = useGuardado<string[]>(lerLidos, []);
  const [lidosAgora, setLidosAgora] = useState<string[]>([]);
  const novidades = useNovidades(lang, volta);
  if (!volta) return null;

  const lidos = new Set([...lidosGuardados, ...lidosAgora]);
  const hoje = hojeEmBrasilia();
  const cartoes: Cartao[] = [];
  for (const a of avisos) if (a.desde <= hoje && hoje <= a.ate) cartoes.push({ id: `aviso:${a.id}`, rotulo: s.aviso, titulo: a.texto, link: a.link });
  const proximo = proximoEvento(hoje, eventos);
  if (proximo) cartoes.push({ id: `evento:${proximo.id}`, rotulo: `${s.calendario} · ${sCal.tipos[proximo.tipo]}`, titulo: proximo.titulo, texto: proximo.data === hoje ? s.hoje : new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${proximo.data}T12:00:00Z`)), link: proximo.tipo === "feriado" || proximo.tipo === "exame" ? "/escola/calendario" : proximo.link });
  const turma = turmas.find((t) => t.mes === hoje.slice(0, 7));
  if (turma) cartoes.push({ id: `turma:${turma.mes}`, rotulo: s.turma, titulo: fill(s.turmaTexto, { titulo: turma.titulo }), link: "/turmas" });
  for (const n of novidades) cartoes.push({ id: `novidade:${n.url}`, rotulo: s.novidade, titulo: n.titulo, link: semIdioma(n.url, lang) });
  const visiveis = cartoes.filter((c) => !lidos.has(c.id)).slice(0, MAX_CARTOES);

  // Sem cartão e sem o serviço das somas, não há o que mostrar: nem o título fica.
  if (visiveis.length === 0 && !hasBackend) return null;

  const marcar = (id: string) => {
    setLidosAgora((l) => [...l, id]);
    gravarLidos([...lerLidos().filter((x) => x !== id), id]);
  };

  return (
    <section aria-labelledby="quadro-de-avisos" className={`quadro-de-avisos no-leitor ${className}`} data-quadro-de-avisos="">
      <h2 id="quadro-de-avisos" className="rotulo">
        {s.titulo}
      </h2>
      {visiveis.length > 0 && (
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {visiveis.map((c) => (
            <li key={c.id} className="flex flex-col border-[1.5px] border-ink bg-folha p-4" data-cartao-do-quadro={c.id.split(":")[0]}>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">{c.rotulo}</p>
              <p className="mt-1.5 font-serif text-[1.15rem] font-semibold leading-snug">{c.titulo}</p>
              {c.texto && <p className="mt-0.5 font-sans text-sm text-ink-soft">{c.texto}</p>}
              <p className="mt-auto flex flex-wrap items-center gap-x-4 pt-2 font-sans text-sm">
                {c.link &&
                  (/^https?:/.test(c.link) ? (
                    <a href={c.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center font-semibold underline underline-offset-4 hover:text-oxblood">
                      {s.abrir}
                      <span className="sr-only">: {c.titulo}</span> ↗
                    </a>
                  ) : (
                    <L href={c.link} className="inline-flex items-center font-semibold underline underline-offset-4 hover:text-oxblood">
                      {s.abrir}
                      <span className="sr-only">: {c.titulo}</span> →
                    </L>
                  ))}
                <button type="button" onClick={() => marcar(c.id)} aria-label={fill(s.lidoDe, { titulo: c.titulo })} className="inline-flex cursor-pointer items-center text-ink-soft underline underline-offset-4 hover:text-oxblood">
                  {s.lido}
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <PresencaSomada s={sPresenca} lang={lang} />
      </div>
      {visiveis.length > 0 && <p className="mt-1 font-sans text-xs text-ink-soft">{s.nota}</p>}
    </section>
  );
}
