// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";

type S = Dict["tools"]["code"];

const samples = {
  python: 'nome = "mundo"\nprint("Olá,", nome)\n\nfor numero in range(1, 6):\n    print(numero, "x 7 =", numero * 7)\n',
  php: '<?php\n$nome = "mundo";\necho "Olá, $nome!\\n";\n\nfor ($i = 1; $i <= 5; $i++) {\n    echo "$i x 7 = " . ($i * 7) . "\\n";\n}\n',
};

/** Editor para testar código sem instalar nada: o interpretador roda no próprio navegador. */
export function CodeRunner({ language, s }: { language: "python" | "php"; s: S }) {
  const params = useSearchParams();
  const [code, setCode] = useState(() => params.get("codigo") ?? samples[language]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<{ text: string; error: boolean }[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "running">("idle");
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = (message?: string) => {
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    if (message) setOutput((lines) => [...lines, { text: `${message}\n`, error: true }]);
    setState("idle");
  };

  useEffect(() => () => worker.current?.terminate(), []);

  function run() {
    setOutput([]);
    setState(worker.current ? "running" : "loading");
    worker.current ??= language === "python" ? new Worker("/workers/python.js") : new Worker("/workers/php.mjs", { type: "module" });
    const current = worker.current;
    current.onmessage = (event: MessageEvent<{ type: string; text?: string }>) => {
      const { type, text = "" } = event.data;
      if (type === "ready") {
        setState("running");
        // Laço infinito não derruba a página: depois de 15 segundos a execução é interrompida.
        timer.current = setTimeout(() => stop(s.timeout), 15000);
      } else if (type === "done") {
        if (timer.current) clearTimeout(timer.current);
        setState("idle");
      } else {
        setOutput((lines) => (lines.length > 2000 ? lines : [...lines, { text, error: type === "err" }]));
      }
    };
    current.onerror = () => stop(s.failed);
    current.postMessage({ code, input });
  }

  const busy = state !== "idle";
  return (
    <div className="mt-8 space-y-4 font-sans text-sm">
      <label className="block">
        {s.code}
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          rows={14}
          onKeyDown={(e) => {
            // Tab insere recuo em vez de pular para o próximo campo; Ctrl+Enter executa.
            if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              const el = e.currentTarget;
              const at = el.selectionStart;
              setCode(code.slice(0, at) + "    " + code.slice(el.selectionEnd));
              requestAnimationFrame(() => el.setSelectionRange(at + 4, at + 4));
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (!busy) run();
            }
          }}
          className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-mono text-sm leading-relaxed"
        />
      </label>
      {language === "python" && (
        <label className="block">
          {s.input}
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} className="mt-1 w-full border-2 border-rule bg-parchment-deep px-3 py-2 font-mono text-sm" />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={busy} className="cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
          ▶ {s.run}
        </button>
        {busy && (
          <button type="button" onClick={() => stop(s.stopped)} className="cursor-pointer border-2 border-oxblood px-5 py-2 font-medium text-oxblood">
            {s.stop}
          </button>
        )}
        <span role="status" className="text-ink-soft">
          {state === "loading" ? s.loading : state === "running" ? s.running : s.shortcut}
        </span>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.output}</p>
        <pre aria-live="polite" className="mt-1 min-h-24 overflow-x-auto whitespace-pre-wrap border border-rule bg-parchment-deep p-4 font-mono text-sm">
          {output.length === 0 && <span className="text-ink-soft">{s.empty}</span>}
          {output.map((line, i) => (
            <span key={i} className={line.error ? "text-oxblood" : ""}>
              {line.text}
            </span>
          ))}
        </pre>
      </div>
      <p className="text-ink-soft">{s.note}</p>
    </div>
  );
}
