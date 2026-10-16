// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { applyPrefs, defaultPrefs } from "@/lib/prefs";
import { useCompleted } from "@/lib/progress";
import { getItem, KEYS, setItem, useStored } from "@/lib/storage";
import { quickExit } from "./Shortcuts";

const action = "cursor-pointer border-2 border-ink px-5 py-2.5 font-medium hover:border-oxblood hover:text-oxblood";
// A sessão de quem tem conta (e o nome que vem com ela) não entra na cópia: é credencial, não dado de estudo.
const portable = Object.values(KEYS).filter((key) => key !== KEYS.session && key !== KEYS.name && key !== KEYS.seen && key !== KEYS.site);

/** Baixar, restaurar e apagar o que o site guarda neste navegador. */
export function DataPanel({ s }: { s: Dict["data"] }) {
  const done = useCompleted();
  const [notice, setNotice] = useState("");
  const purge = useStored(KEYS.purge) ?? "0";
  const fileRef = useRef<HTMLInputElement>(null);

  function exportData() {
    const data: Record<string, string> = {};
    for (const key of portable) {
      const value = getItem(key);
      if (value) data[key] = value;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "instituto-lucia-meus-dados.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>;
      const known = portable.filter((key) => typeof data[key] === "string" && (data[key] as string).length < 2_000_000);
      if (known.length === 0) throw new Error("vazio");
      for (const key of known) {
        JSON.parse(data[key] as string);
        setItem(key, data[key] as string);
      }
      setNotice(s.imported);
    } catch {
      setNotice(s.importFailed);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function clearAll() {
    for (const key of Object.values(KEYS)) setItem(key, null);
    document.documentElement.removeAttribute("data-theme");
    applyPrefs(defaultPrefs);
    setNotice(s.cleared);
  }

  return (
    <section className="mt-10 border border-rule bg-parchment-deep p-6 font-sans text-sm">
      <h2 className="font-serif text-2xl font-semibold">{s.stored}</h2>
      <p className="mt-2 text-ink-soft">{done.size > 0 ? fill(s.doneLessons, { n: done.size }) : s.nothing}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={exportData} className={action}>
          {s.export}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={action}>
          {s.import}
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => importData(e.target.files?.[0])} />
        <button type="button" onClick={clearAll} className={action}>
          {s.clear}
        </button>
        <button type="button" onClick={quickExit} className="cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment hover:bg-ink">
          {s.exitNow}
        </button>
      </div>
      <p className="mt-3 text-ink-soft">{s.clearHint}</p>
      <label className="mt-6 block max-w-md">
        <span className="font-serif text-xl font-semibold">{s.purgeTitle}</span>
        <select
          value={purge}
          onChange={(e) => {
            setItem(KEYS.purge, e.target.value === "0" ? null : e.target.value);
            setItem(KEYS.seen, e.target.value === "0" ? null : String(Date.now()));
          }}
          className="mt-2 w-full border-2 border-ink bg-parchment px-3 py-2"
        >
          <option value="0">{s.purgeNever}</option>
          {[1, 7, 30].map((days) => (
            <option key={days} value={days}>
              {fill(s.purgeAfter, { n: days })}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-ink-soft">{s.purgeHint}</p>
      <p role="status" className="mt-3 min-h-5 font-medium">
        {notice}
      </p>
    </section>
  );
}
