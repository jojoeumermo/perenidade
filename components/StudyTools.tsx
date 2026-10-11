// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { KEYS, parse, setItem, useHydrated, useStored } from "@/lib/storage";
import { errorText } from "@/i18n/core";
import { useI18n } from "./I18n";

interface Excerpt {
  tag: number;
  text: string;
}

interface Annotation {
  id: string;
  paragrafo: number;
  trecho: string;
  corpo: string;
  status: string;
  autor: string;
}

export interface StudyStrings {
  notesTitle: string;
  notesHint: string;
  tags: string[];
  notesEmpty: string;
  notesPrint: string;
  remove: string;
  selectFirst: string;
  zine: string;
  print: string;
  annotationsTitle: string;
  annotate: string;
  annotatePlaceholder: string;
  save: string;
  cancel: string;
  pending: string;
  goTo: string;
}

/** Trecho selecionado dentro do texto da aula e o bloco em que ele está. */
function selection(): { text: string; block: number } | null {
  const picked = window.getSelection();
  const text = picked?.toString().trim() ?? "";
  if (!picked || text.length < 3) return null;
  const node = picked.anchorNode instanceof Element ? picked.anchorNode : picked.anchorNode?.parentElement;
  const block = node?.closest("[data-p]");
  if (!block || !block.closest("#texto-da-aula")) return null;
  return { text: text.slice(0, 600), block: Number(block.getAttribute("data-p")) };
}

/**
 * Ferramentas de estudo no fim da aula:
 * fichamento (trechos marcados por quem lê, guardados no navegador) e
 * anotações da comunidade (explicações de voluntários presas a um parágrafo).
 */
export function StudyTools({ id, path, s }: { id: string; path: string; s: StudyStrings }) {
  const { t } = useI18n();
  const hydrated = useHydrated();
  const stored = useStored(KEYS.notes);
  const all = useMemo(() => parse<Record<string, Excerpt[]>>(stored, {}), [stored]);
  const excerpts = all[id] ?? [];
  const me = useMe();
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<{ text: string; block: number } | null>(null);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  const volunteer = me.status === "in" && me.me.papeis.length > 0;

  useEffect(() => {
    if (!hasBackend) return;
    let cancelled = false;
    rpc<Annotation[]>("anotacoes_listar", { p_caminho: path })
      .then((list) => {
        if (cancelled) return;
        setNotes(list);
        // Marca no texto os blocos que têm anotação.
        for (const note of list) document.querySelector(`#texto-da-aula [data-p="${note.paragrafo}"]`)?.classList.add("tem-nota");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  function saveExcerpts(next: Excerpt[]) {
    const copy = { ...all, [id]: next };
    if (next.length === 0) delete copy[id];
    setItem(KEYS.notes, JSON.stringify(copy));
  }

  function mark(tag: number) {
    const picked = selection();
    if (!picked) return setMessage(s.selectFirst);
    setMessage("");
    saveExcerpts([...excerpts, { tag, text: picked.text }]);
    window.getSelection()?.removeAllRanges();
  }

  function printAs(mode: "zine" | "notes" | "") {
    document.documentElement.dataset.print = mode;
    window.print();
    delete document.documentElement.dataset.print;
  }

  function goTo(block: number) {
    const target = document.querySelector<HTMLElement>(`#texto-da-aula [data-p="${block}"]`);
    target?.scrollIntoView({ block: "center" });
    target?.classList.add("nota-foco");
    setTimeout(() => target?.classList.remove("nota-foco"), 2500);
  }

  async function annotate() {
    if (!draft) return;
    try {
      await rpc("anotar", { p_caminho: path, p_paragrafo: draft.block, p_trecho: draft.text.slice(0, 300), p_corpo: body });
      setDraft(null);
      setBody("");
      setMessage("");
      setTick((value) => value + 1);
    } catch (error) {
      setMessage(errorText(t, error instanceof BackendError ? error.code : "falha"));
    }
  }

  if (!hydrated) return null;
  const link = "cursor-pointer underline hover:text-oxblood";

  return (
    <div className="mt-10 space-y-8 border-t border-rule pt-6 font-sans text-sm">
      <p className="no-print flex flex-wrap gap-x-5 gap-y-1 text-ink-soft">
        <button type="button" className={link} onClick={() => printAs("")}>{s.print}</button>
        <button type="button" className={link} onClick={() => printAs("zine")}>{s.zine}</button>
      </p>

      <section id="fichamento">
        <h2 className="font-mono text-xs uppercase tracking-widest text-gold">{s.notesTitle}</h2>
        <p className="no-print mt-2 text-ink-soft">{s.notesHint}</p>
        <div className="no-print mt-3 flex flex-wrap gap-2">
          {s.tags.map((tag, i) => (
            <button key={tag} type="button" onClick={() => mark(i)} className={`cursor-pointer border-2 px-3 py-1.5 hover:border-gold etiqueta-${i}`}>
              {tag}
            </button>
          ))}
        </div>
        {excerpts.length === 0 ? (
          <p className="no-print mt-3 text-ink-soft">{s.notesEmpty}</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {excerpts.map((excerpt, i) => (
                <li key={i} className={`border-l-4 pl-3 etiqueta-${excerpt.tag}`}>
                  <p className="font-mono text-xs text-ink-soft">{s.tags[excerpt.tag]}</p>
                  <p className="font-serif text-lg">“{excerpt.text}”</p>
                  <button type="button" className={`no-print text-ink-soft ${link}`} onClick={() => saveExcerpts(excerpts.filter((_, j) => j !== i))}>
                    {s.remove}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={`no-print mt-3 ${link}`} onClick={() => printAs("notes")}>{s.notesPrint}</button>
          </>
        )}
      </section>

      {hasBackend && (notes.length > 0 || volunteer) && (
        <section className="no-print">
          <h2 className="font-mono text-xs uppercase tracking-widest text-gold">{s.annotationsTitle}</h2>
          <ul className="mt-3 space-y-4">
            {notes.map((note) => (
              <li key={note.id} className="border-l-2 border-gold pl-3">
                {note.trecho && <p className="font-serif italic text-ink-soft">“{note.trecho}”</p>}
                <p className="mt-1 font-serif text-lg" lang="pt-BR">{note.corpo}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {note.autor}
                  {note.status === "pendente" && ` · ${s.pending}`} ·{" "}
                  <button type="button" className={link} onClick={() => goTo(note.paragrafo)}>{s.goTo}</button>
                </p>
              </li>
            ))}
          </ul>
          {volunteer &&
            (draft ? (
              <div className="mt-4">
                <p className="font-serif italic text-ink-soft">“{draft.text.slice(0, 300)}”</p>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  maxLength={1500}
                  placeholder={s.annotatePlaceholder}
                  aria-label={s.annotate}
                  className="mt-2 w-full border-2 border-ink bg-parchment-deep px-3 py-2"
                />
                <div className="mt-2 flex gap-4">
                  <button type="button" onClick={annotate} className="cursor-pointer bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">{s.save}</button>
                  <button type="button" onClick={() => setDraft(null)} className={link}>{s.cancel}</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`mt-4 ${link}`}
                onClick={() => {
                  const picked = selection();
                  if (!picked) return setMessage(s.selectFirst);
                  setMessage("");
                  setDraft(picked);
                }}
              >
                {s.annotate}
              </button>
            ))}
        </section>
      )}

      <p role="status" className="no-print min-h-5 text-oxblood">{message}</p>
    </div>
  );
}
