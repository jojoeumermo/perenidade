// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { htmlLang } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";
import { useI18n } from "./I18n";

interface Result {
  encontrado: boolean;
  valido?: boolean;
  nome?: string;
  horas?: number;
  inicio?: string;
  fim?: string;
  atividades?: string;
  emitido_em?: string;
  testemunhas?: string[];
}

/** Datas sem hora não passam pelo fuso, para não virarem o dia anterior. */
const day = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));

/** Qualquer pessoa confere aqui se um certificado de voluntariado é verdadeiro, pelo código impresso nele. */
export function CertificateCheck({ s }: { s: Dict["certificate"] }) {
  const { lang } = useI18n();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("codigo") ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;
  const locale = htmlLang[lang];

  async function check() {
    setState("busy");
    setResult(null);
    try {
      setResult(await rpc<Result>("certificado_conferir", { p_codigo: code }));
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-8 font-sans text-sm">
      <form className="flex max-w-xl flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void check(); }}>
        <label className="block min-w-60 flex-1">
          {s.code}
          <input value={code} onChange={(e) => setCode(e.target.value)} required minLength={12} maxLength={20} autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX" className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-mono uppercase tracking-widest" />
        </label>
        <button type="submit" disabled={state === "busy"} className="cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:opacity-50">
          {s.check}
        </button>
      </form>
      <div role="status" className="mt-6">
        {state === "error" && <p className="text-oxblood">{s.failed}</p>}
        {result && !result.encontrado && <p className="border-l-2 border-oxblood pl-4 text-lg text-oxblood">{s.notFound}</p>}
        {result?.encontrado && !result.valido && <p className="border-l-2 border-oxblood pl-4 text-lg text-oxblood">{s.cancelled}</p>}
        {result?.valido && (
          <div className="max-w-2xl border-l-2 border-ok pl-4">
            <p className="text-lg font-semibold text-ok">{s.valid}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 font-serif text-lg sm:grid-cols-[auto_1fr]">
              <dt className="font-sans text-sm text-ink-soft">{s.name}</dt>
              <dd>{result.nome}</dd>
              <dt className="font-sans text-sm text-ink-soft">{s.hours}</dt>
              <dd>{new Intl.NumberFormat(locale).format(Number(result.horas))}</dd>
              <dt className="font-sans text-sm text-ink-soft">{s.period}</dt>
              <dd>
                {day(result.inicio ?? "", locale)} – {day(result.fim ?? "", locale)}
              </dd>
              <dt className="font-sans text-sm text-ink-soft">{s.activities}</dt>
              <dd className="whitespace-pre-line" lang="pt-BR">{result.atividades}</dd>
              <dt className="font-sans text-sm text-ink-soft">{s.issued}</dt>
              <dd>{day(result.emitido_em ?? "", locale)}</dd>
              {(result.testemunhas?.length ?? 0) > 0 && (
                <>
                  <dt className="font-sans text-sm text-ink-soft">{s.witnesses}</dt>
                  <dd>{result.testemunhas?.join(", ")}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
