"use client";

import { useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { applyPrefs, defaultPrefs } from "@/lib/prefs";
import { useCompleted } from "@/lib/progress";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { useI18n } from "./I18n";

const action = "cursor-pointer border-2 border-ink px-5 py-2.5 font-medium hover:border-oxblood hover:text-oxblood";

/** Baixar, restaurar e apagar o que o site guarda neste navegador. */
export function DataPanel() {
  const { t } = useI18n();
  const d = t.data;
  const done = useCompleted();
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function exportData() {
    const data: Record<string, string> = {};
    for (const key of Object.values(KEYS)) {
      const value = getItem(key);
      if (value) data[key] = value;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "projeto-lucia-meus-dados.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>;
      const known = Object.values(KEYS).filter((key) => typeof data[key] === "string");
      if (known.length === 0) throw new Error("vazio");
      for (const key of known) setItem(key, data[key] as string);
      setNotice(d.imported);
    } catch {
      setNotice(d.importFailed);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function clearAll() {
    for (const key of Object.values(KEYS)) setItem(key, null);
    document.documentElement.removeAttribute("data-theme");
    applyPrefs(defaultPrefs);
    setNotice(d.cleared);
  }

  return (
    <section className="mt-10 border border-rule bg-parchment-deep p-6 font-sans text-sm">
      <h2 className="font-serif text-2xl font-semibold">{d.stored}</h2>
      <p className="mt-2 text-ink-soft">{done.size > 0 ? fill(d.doneLessons, { n: done.size }) : d.nothing}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={exportData} className={action}>
          {d.export}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={action}>
          {d.import}
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => importData(e.target.files?.[0])} />
        <button type="button" onClick={clearAll} className="cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment hover:bg-ink">
          {d.clear}
        </button>
      </div>
      <p className="mt-3 text-ink-soft">{d.clearHint}</p>
      <p role="status" className="mt-3 min-h-5 font-medium">
        {notice}
      </p>
    </section>
  );
}
