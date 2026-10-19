// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type Ajuda, lerAjudas, responderAjuda } from "@/lib/meu-estudo";
import { useHydrated } from "@/lib/storage";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L } from "../I18n";
import { useGuardado } from "./guardado";

type S = TextosDoEstudo["ajudou"];

/**
 * "Isso ajudou?" no fim da aula (recurso "ajudou"). A resposta fica só neste aparelho (lucia:ajudou), entra na cópia
 * de segurança e sai no "apagar". Nada é enviado: quem quiser contar à equipe usa o link de sugerir uma melhoria.
 */
export function IssoAjudou({ aula, s, sugerir }: { aula: string; s: S; sugerir: string }) {
  const hidratado = useHydrated();
  const [ajudas, recarregar] = useGuardado(lerAjudas, {});
  if (!hidratado) return null;
  const atual = ajudas[aula]?.resposta;
  const opcoes: [Ajuda, string][] = [
    ["sim", s.sim],
    ["em-parte", s.emParte],
    ["nao", s.nao],
  ];
  return (
    <section aria-labelledby="ajudou-titulo" className="no-print mt-8 border-t border-rule pt-5 font-sans text-sm">
      <h2 id="ajudou-titulo" className="font-serif text-xl font-semibold">
        {s.pergunta}
      </h2>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="ajudou-titulo">
        {opcoes.map(([valor, nome]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={atual === valor}
            onClick={() => {
              responderAjuda(aula, atual === valor ? null : valor);
              recarregar();
            }}
            className={`cursor-pointer border-2 px-4 py-1.5 ${atual === valor ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}
          >
            {nome}
          </button>
        ))}
      </div>
      <p role="status" className="mt-2 min-h-5 text-ink-soft">
        {atual && (
          <>
            {s.obrigado}{" "}
            {atual !== "sim" && (
              <L href={sugerir} className="underline hover:text-oxblood">
                {s.contar}
              </L>
            )}
          </>
        )}
      </p>
    </section>
  );
}
