// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { L, useI18n } from "@/components/I18n";
import { fill } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { TextosDoAssistente } from "@/i18n/assistente";
import { type EstadoPublico, estadoDoPublico, perguntarAoPublico } from "@/lib/assistente/publico";

// O Markdown (com fórmulas) só é baixado quando chega a primeira resposta.
const Markdown = dynamic(() => import("@/components/Markdown").then((m) => m.Markdown), { ssr: false });

/** O mesmo teto da pergunta do assistente (supabase/functions/assistente/assistente.ts, LIMITES.pergunta). */
const MAXIMO = 3000;

type Estado =
  | { fase: "parado" | "pensando" }
  | { fase: "resposta"; pergunta: string; texto: string; cortada: boolean; restantesHora: number | null; restantesDia: number | null }
  | { fase: "erro"; texto: string };

/**
 * A janela do assistente em todas as páginas (T03). Baixada só no primeiro uso (BotaoDoAssistente). Fala só com o próprio
 * site (/api/assistente): vai a pergunta, o idioma da página e nada mais. Nada fica guardado no aparelho nem no servidor:
 * fechar a janela e recarregar a página apaga a conversa.
 */
export function PainelDoAssistente({ textos: s, aberto, fechar }: { textos: TextosDoAssistente; aberto: boolean; fechar: () => void }) {
  const { lang, t } = useI18n();
  const [publico, setPublico] = useState<EstadoPublico | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });
  const campo = useRef<HTMLTextAreaElement>(null);
  const tituloId = useId();
  const avisoId = useId();

  useEffect(() => {
    let vivo = true;
    void estadoDoPublico().then((e) => vivo && setPublico(e));
    return () => {
      vivo = false;
    };
  }, []);

  // Ao abrir, o foco vai para o campo (ou para o título, se o assistente estiver desligado).
  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto, publico]);

  // O aviso de "pensando", o erro e a resposta nova ficam à vista dentro da janela (que rola por dentro).
  const aviso = useRef<HTMLDivElement>(null);
  const topoDaResposta = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (estado.fase === "resposta") topoDaResposta.current?.scrollIntoView({ block: "start" });
    else if (estado.fase !== "parado") aviso.current?.scrollIntoView({ block: "nearest" });
  }, [estado]);

  const curta = pergunta.trim().length < 10;

  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    if (curta) {
      setEstado({ fase: "erro", texto: s.curta });
      return;
    }
    const texto = pergunta.trim();
    setEstado({ fase: "pensando" });
    // Só a pergunta e o idioma: sem disciplina, sem aulas, sem a página em que a pessoa está.
    const r = await perguntarAoPublico({ modo: "pergunta", pergunta: texto, disciplina: "", idioma: lang, aulas: [] });
    if (r.ok) {
      setEstado({ fase: "resposta", pergunta: texto, texto: r.texto, cortada: r.cortada, restantesHora: r.restantesHora ?? null, restantesDia: r.restantes });
      setPergunta("");
    } else setEstado({ fase: "erro", texto: r.recusa ? s.recusa : errorText(t, r.erro) });
  }

  return (
    <section
      id="assistente-do-site"
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      className="assistente-janela absolute bottom-14 left-0 flex max-h-[max(16rem,min(calc(100dvh-19rem),40rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col border-2 border-ink bg-folha text-ink shadow-[6px_6px_0_var(--sombra)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div>
          <h2 id={tituloId} className="font-serif text-xl font-semibold">{s.titulo}</h2>
          <p className="mt-1 text-xs text-ink-soft">{s.lead}</p>
        </div>
        <button type="button" onClick={fechar} aria-label={s.fechar} title={s.fechar} className="-mr-1 h-9 w-9 shrink-0 cursor-pointer text-xl leading-none hover:text-oxblood">
          <span aria-hidden>×</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {publico === null ? (
          <p className="text-ink-soft">{s.carregando}</p>
        ) : !publico.ligado ? (
          <p>
            {s.desligado}{" "}
            <L href="/reforco" className="font-semibold underline hover:text-oxblood">{s.reforco}</L>
          </p>
        ) : (
          <>
            {/* O aviso fica ANTES do campo e do botão: a pessoa sabe para onde vai a pergunta antes de escrever. */}
            <div id={avisoId} className="border-l-4 border-oxblood pl-3 text-xs">
              <p>{s.privacidade}</p>
              <p className="mt-1 font-semibold">{s.naoEscreva}</p>
              <p className="mt-1 text-ink-soft">{fill(s.limites, { h: publico.porHora, d: publico.porDia })}</p>
            </div>

            {estado.fase === "resposta" && (
              <div ref={topoDaResposta} className="mt-4">
                <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{s.suaPergunta}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{estado.pergunta}</p>
                <section aria-label={s.resposta} className="mt-3 border-l-4 border-gold bg-parchment-deep px-3 py-2">
                  <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{s.resposta}</p>
                  <div className="mt-1 font-serif text-base">
                    <Markdown lang={lang}>{estado.texto}</Markdown>
                  </div>
                  {estado.cortada && <p className="mt-2 text-ink-soft">{s.cortada}</p>}
                  <p className="mt-2 text-xs text-ink-soft">{s.podeErrar}</p>
                </section>
                {estado.restantesHora !== null && estado.restantesDia !== null && <p className="mt-2 text-xs text-ink-soft">{fill(s.restam, { h: estado.restantesHora, d: estado.restantesDia })}</p>}
                <p className="mt-2 text-xs">
                  <L href="/reforco" className="underline hover:text-oxblood">{s.reforco}</L>
                </p>
              </div>
            )}

            <form onSubmit={perguntar} className="mt-4">
              <label htmlFor="assistente-do-site-campo" className="block font-semibold">
                {estado.fase === "resposta" ? s.nova : s.rotulo}
              </label>
              <textarea
                id="assistente-do-site-campo"
                ref={campo}
                value={pergunta}
                maxLength={MAXIMO}
                rows={3}
                placeholder={s.dica}
                aria-describedby={avisoId}
                onChange={(e) => setPergunta(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl+Enter (ou Cmd+Enter) manda; Enter sozinho quebra a linha.
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
                }}
                className="mt-1 w-full resize-y border-2 border-ink bg-parchment p-2 font-serif text-base"
              />
              <p className="flex items-center justify-between gap-3 text-xs text-ink-soft">
                <span>{fill(s.contador, { n: pergunta.length, max: MAXIMO })}</span>
                <button type="submit" disabled={estado.fase === "pensando"} className="cursor-pointer bg-ink px-4 py-1.5 text-sm font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
                  {s.perguntar}
                </button>
              </p>
            </form>
          </>
        )}
        <div ref={aviso} role="status" aria-live="polite" className="text-sm">
          {estado.fase === "pensando" && <p className="mt-2 text-ink-soft">{s.pensando}</p>}
          {estado.fase === "erro" && <p className="mt-2 text-oxblood">{estado.texto}</p>}
        </div>
      </div>
    </section>
  );
}
