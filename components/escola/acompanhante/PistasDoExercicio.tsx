// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { RespostaDoAssistente } from "@/components/Assistente";
import { useI18n } from "@/components/I18n";
import { fill } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import { askAssistant } from "@/lib/backend";
import { type Fala, gravarConversa, montarPedido, novoId, tituloDe } from "@/lib/escola/acompanhante";
import type { ExercicioNovo } from "@/lib/exercicios";
import { AvisoDoQueVai, useDisponibilidade, useModoSeguro } from "./Conversa";
import { useTextosDoAcompanhante } from "./textos";
import "@/styles/escola-acompanhante.css";

// "Quero uma pista" (R1-50): aparece no exercício depois de um erro. Três níveis: 1, uma pista de conceito; 2, o
// próximo passo; 3, quase a solução, e a solução completa só se a pessoa pedir. Os níveis 1 e 2 nunca dizem a
// alternativa certa (a instrução do assistente proíbe, e o site nem manda qual é a certa: vão só o enunciado e as
// alternativas). Sem conta, com o assistente desligado ou sem internet, não aparece nada: fica a explicação do
// engano que o exercício já mostra, que roda no aparelho.

export function PistasDoExercicio({ ex, aula }: { ex: ExercicioNovo; aula: string }) {
  const { lang, t } = useI18n();
  const s = useTextosDoAcompanhante(lang);
  const disponivel = useDisponibilidade();
  const seguro = useModoSeguro();
  const [falas, setFalas] = useState<Fala[]>([]);
  const [nivel, setNivel] = useState<0 | 1 | 2 | 3>(0);
  const [pediuSolucao, setPediuSolucao] = useState(false);
  const [estado, setEstado] = useState<{ fase: "parado" | "pensando" } | { fase: "erro"; texto: string }>({ fase: "parado" });
  const conversa = useRef<{ id: string; criada: number } | null>(null);

  if (!s || disponivel !== "pronto") return null;
  const textos = s;

  async function pedir(proximo: 1 | 2 | 3, solucao = false) {
    setEstado({ fase: "pensando" });
    const pergunta = solucao ? textos.pistas.solucao : `${textos.pistas.botao} (${fill(textos.pistas.titulo, { n: proximo })})`;
    const enunciado = [ex.textoBase, ex.enunciado].filter(Boolean).join("\n\n");
    const pedido = montarPedido({
      modo: "pistas",
      pergunta,
      idioma: lang,
      falas,
      contexto: { enunciado, nivel: proximo, ...(ex.tipo === "escolha" ? { alternativas: ex.alternativas.map((a) => a.texto) } : {}), ...(/^[a-z0-9-]+\/[a-z0-9-]+$/.test(aula) ? { aula } : {}) },
    });
    const r = await askAssistant(pedido);
    if (!r.ok) {
      setEstado({ fase: "erro", texto: r.recusa ? textos.comum.recusa : errorText(t, r.erro) });
      return;
    }
    const agora = Date.now();
    const novas: Fala[] = [...falas, { de: "pessoa", texto: pergunta, em: agora }, { de: "assistente", texto: r.texto, em: agora, ...(r.cortada ? { cortada: true } : {}) }];
    setFalas(novas);
    setNivel(proximo);
    if (solucao) setPediuSolucao(true);
    setEstado({ fase: "parado" });
    if (!conversa.current) conversa.current = { id: novoId(), criada: agora };
    gravarConversa({ id: conversa.current.id, modo: "pistas", titulo: tituloDe(ex.enunciado), ...(pedido.contexto?.aula ? { aula: pedido.contexto.aula } : {}), criada: conversa.current.criada, atualizada: agora, falas: novas });
  }

  const pensando = estado.fase === "pensando";
  const respostas = falas.filter((f) => f.de === "assistente");

  return (
    <section className="mt-4 border-t border-rule pt-3" aria-label={textos.pistas.botao} data-pistas>
      {nivel === 0 && <p className="text-sm text-ink-soft">{textos.pistas.lead}</p>}
      {respostas.map((f, i) => (
        <RespostaDoAssistente key={i} texto={f.texto} cortada={Boolean(f.cortada)} rotulo={i < 3 ? fill(textos.pistas.titulo, { n: i + 1 }) : textos.pistas.solucao} aviso={textos.comum.avisoAutomatico} avisoCortada={textos.comum.cortada} lang={lang} />
      ))}
      {!pediuSolucao && (
        <>
          <AvisoDoQueVai s={textos.comum} itens={falas.length ? ["enunciado", "aula", "historico"] : ["enunciado", "aula"]} lang={lang} />
          <p className="mt-3 flex flex-wrap gap-2">
            {nivel < 3 && (
              <button type="button" className="acompanhante-botao-claro" disabled={pensando} onClick={() => void pedir((nivel + 1) as 1 | 2 | 3)}>
                {nivel === 0 ? textos.pistas.botao : textos.pistas.outra}
              </button>
            )}
            {nivel === 3 && (
              <button type="button" className="acompanhante-botao-claro" disabled={pensando} onClick={() => void pedir(3, true)}>
                {textos.pistas.solucao}
              </button>
            )}
          </p>
        </>
      )}
      <div role="status" aria-live="polite">
        {pensando && <p className="mt-2 text-ink-soft">{textos.comum.enviando}</p>}
        {estado.fase === "erro" && <p className="mt-2 text-oxblood">{estado.texto}</p>}
      </div>
      {falas.length > 0 && <p className="mt-2 text-xs text-ink-soft">{seguro ? textos.comum.modoSeguro : textos.comum.historicoAqui}</p>}
    </section>
  );
}
