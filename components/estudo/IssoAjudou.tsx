// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { hasBackend, rpc } from "@/lib/backend";
import { type Ajuda, lerAjudas, responderAjuda } from "@/lib/meu-estudo";
import { ligado } from "@/lib/recursos";
import { useHydrated } from "@/lib/storage";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L } from "../I18n";
import { useGuardado } from "./guardado";

type S = TextosDoEstudo["ajudou"];

/** Com a Escola ligada (e o serviço no ar), a resposta também soma +1 anônimo no banco. */
const SOMA_LIGADA = ligado("escola") && hasBackend;

/**
 * A primeira resposta de cada aula soma +1 anônimo em contar ('aula_ajudou' para "ajudou"; 'aula_nao_ajudou' para
 * "em parte" e "não ajudou", que dizem à equipe que a aula precisa ser refeita), uma vez por aula e aparelho: a marca
 * fica em 'lucia:ajudou-contou:<aula>' (está na lista "só apagar" de Meus dados). Trocar ou desmarcar a resposta não
 * soma de novo. Mesmo padrão de contarUmaVez em components/aula/BarraDaAula.tsx; erros são engolidos.
 */
function somarUmaVez(aula: string, resposta: Ajuda) {
  const chave = `lucia:ajudou-contou:${aula}`;
  const tipo = resposta === "sim" ? "aula_ajudou" : "aula_nao_ajudou";
  try {
    if (localStorage.getItem(chave)) return;
    localStorage.setItem(chave, tipo);
  } catch {
    // sem armazenamento: conta assim mesmo, como a barra da aula
  }
  void rpc("contar", { p_tipo: tipo, p_alvo: aula }).catch(() => {});
}

/**
 * "Isso ajudou?" no fim da aula (recurso "ajudou"). A resposta fica neste aparelho (lucia:ajudou), entra na cópia
 * de segurança e sai no "apagar". Com a Escola ligada, a primeira resposta também soma +1 anônimo (somarUmaVez), e o
 * texto avisa antes do clique. Quem quiser contar mais à equipe usa o link de sugerir uma melhoria.
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
              const nova = atual === valor ? null : valor;
              responderAjuda(aula, nova);
              if (nova && SOMA_LIGADA) somarUmaVez(aula, nova);
              recarregar();
            }}
            className={`cursor-pointer border-2 px-4 py-1.5 ${atual === valor ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}
          >
            {nome}
          </button>
        ))}
      </div>
      {SOMA_LIGADA && <p className="mt-2 text-ink-soft">{s.soma}</p>}
      <p role="status" className="mt-2 min-h-5 text-ink-soft">
        {atual && (
          <>
            {!SOMA_LIGADA && s.obrigado}{" "}
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
