// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { L } from "@/components/I18n";
import { LIMITES, tirarNotas } from "@/lib/escola/acompanhante";
import { Conversa, type Textos } from "./Conversa";

/** A redação que outra ferramenta do site deixou para ser comentada (a mesma chave que o reforço lê). */
export const CHAVE_REDACAO = "lucia:redacao-para-correcao";

/**
 * Comentário de redação por competência (R1-53): as 5 competências do Enem, até 2 pontos fortes e 2 a melhorar em
 * cada, SEM nota e sem reescrever. O aviso "Comentário automático, não é correção nem nota" fica junto da resposta, e
 * qualquer linha com nota que escape da instrução é tirada no aparelho (tirarNotas). A Oficina de Redação não muda.
 */
export function RedacaoPorCompetencia({ s }: { s: Textos }) {
  const id = useId();
  const [tema, setTema] = useState("");
  const [inicial, setInicial] = useState<string | null>(null);
  const r = s.redacao;

  useEffect(() => {
    // Só no navegador: a redação pode ter vindo de outra ferramenta, nesta aba (sessionStorage). Lida uma vez e apagada.
    let texto = "";
    try {
      texto = sessionStorage.getItem(CHAVE_REDACAO) ?? "";
      if (texto) sessionStorage.removeItem(CHAVE_REDACAO);
    } catch {
      // sem armazenamento: começa vazio
    }
    const tempo = window.setTimeout(() => setInicial(texto.slice(0, LIMITES.redacao)), 0);
    return () => window.clearTimeout(tempo);
  }, []);

  return (
    <div data-redacao-acompanhante>
      <p className="border-l-4 border-oxblood pl-3 font-semibold">{r.aviso}</p>
      <p className="mt-1 text-sm text-ink-soft">{r.notaSoInep}</p>
      {inicial && <p className="mt-3 text-sm text-ink-soft">{r.veioDaOficina}</p>}
      <label htmlFor={`${id}-tema`} className="mt-4 block font-semibold">
        {r.tema}
      </label>
      <input id={`${id}-tema`} value={tema} maxLength={LIMITES.trecho} onChange={(e) => setTema(e.target.value.slice(0, LIMITES.trecho))} className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2" />
      {inicial !== null && (
        <Conversa
          s={s}
          modo="redacao"
          contexto={tema.trim() ? { trecho: tema.trim() } : undefined}
          itens={["redacao"]}
          campo={{ rotulo: r.texto, dica: r.minimo, max: LIMITES.redacao, min: 100, linhas: 14 }}
          botao={r.botao}
          umaVez
          semServidor="aviso"
          inicial={inicial}
          avisoDaResposta={r.aviso}
          transformar={(texto) => {
            const limpo = tirarNotas(texto);
            return limpo.tirou ? { texto: limpo.texto, nota: r.tirouNota } : { texto: limpo.texto };
          }}
        />
      )}
      <p className="mt-6 text-sm">
        <L href="/enem/redacao" className="underline hover:text-oxblood">
          {r.oficina}
        </L>
      </p>
    </div>
  );
}
