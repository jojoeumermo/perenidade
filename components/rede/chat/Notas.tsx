// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Notas para mim (Prompt 4, item 15, atrás de "alumia-p4-conversa"): uma conversa só consigo mesma. Cada nota fica cifrada no
// histórico deste aparelho e vai, cifrada para cada um, só aos meus outros aparelhos ligados (lib/rede/chat/r2/servico.ts,
// mandarNota). O servidor não sabe que as notas existem: elas viajam pela caixa de sincronia, no envelope de tamanho fixo de sempre.
// Alvos de toque de 44 px; sem animação.
import { useCallback, useEffect, useId, useState } from "react";
import { apagarNota, escreverNota, type Eu, type MensagemAberta, minhasNotas } from "@/lib/rede/chat-chaveiro";
import { MAX_CARACTERES, textoCabe } from "@/lib/rede/chat-privado";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import type { TextosDaConversaP4 } from "@/lib/rede/textos-p4-conversa";
import { Confirmar, type PedidoDeConfirmacao } from "./Confirmar";
import { botaoForte, botaoPerigo } from "./comum";

export function Notas({ lang, t, tc, eu, aoVoltar }: { lang: string; t: TextosDoChat; tc: TextosDaConversaP4["notas"]; eu: Eu; aoVoltar: () => void }) {
  const id = useId();
  const [notas, setNotas] = useState<MensagemAberta[] | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmacao, setConfirmacao] = useState<PedidoDeConfirmacao | null>(null);

  const ler = useCallback(async () => {
    const lista = await minhasNotas(eu);
    setNotas([...lista].sort((a, b) => b.criado_em.localeCompare(a.criado_em)));
  }, [eu]);

  useEffect(() => {
    // ler é assíncrona: o estado muda depois do histórico responder, não durante o efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ler().catch(() => setErro(tc.erro));
  }, [ler, tc.erro]);

  // "Sair rápido": as notas abertas somem da memória desta tela na hora.
  useEffect(
    () =>
      aoApagarTudoDoChat(() => {
        setNotas([]);
        setTexto("");
      }),
    [],
  );

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!textoCabe(texto) || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await escreverNota(eu, texto);
      setTexto("");
      await ler();
    } catch {
      setErro(tc.erro);
    } finally {
      setOcupado(false);
    }
  }

  const restam = MAX_CARACTERES - [...texto].length;
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex min-h-[70vh] flex-col font-sans" data-notas>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-rule bg-parchment px-[18px] py-3">
        <button type="button" onClick={aoVoltar} className="min-h-11 min-w-11 rounded-full hover:bg-parchment-deep" aria-label={t.conversa.voltar}>
          <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h2 id={`${id}-titulo`} className="min-w-0 flex-1 truncate font-serif text-xl font-bold">{tc.titulo}</h2>
      </header>
      <p className="border-b border-rule px-[18px] py-3 text-sm text-ink-soft">{tc.explica}</p>
      {erro && <p role="alert" className="border-b border-rule px-[18px] py-3 text-sm text-oxblood">{erro}</p>}
      <form onSubmit={(e) => void guardar(e)} className="border-b border-rule px-[18px] py-3">
        <label htmlFor={`${id}-texto`} className="sr-only">{tc.escreva}</label>
        <textarea
          id={`${id}-texto`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder={tc.escreva}
          autoComplete="off"
          className="min-h-11 w-full resize-y rounded-xl border border-rule bg-parchment px-3 py-2"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className={restam < 0 ? "text-oxblood" : "text-ink-soft"}>{restam < 0 ? t.conversa.grande : preencher(t.conversa.restam, { n: restam })}</p>
          <button type="submit" disabled={ocupado || !textoCabe(texto)} className={botaoForte}>{tc.guardar}</button>
        </div>
      </form>
      <div className="flex-1 px-[18px] py-4" aria-live="polite">
        {notas === null ? (
          <p className="text-sm text-ink-soft">{t.conversa.aguarde}</p>
        ) : notas.length === 0 ? (
          <p className="text-sm text-ink-soft">{tc.vazio}</p>
        ) : (
          <ul className="space-y-3">
            {notas.map((n) => (
              <li key={n.id} className="rounded-2xl border border-rule bg-parchment-deep px-3.5 py-2">
                <p className="whitespace-pre-wrap break-words">{n.texto}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <time className="opacity-80" dateTime={n.criado_em}>{new Date(n.criado_em).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" })}</time>
                  <button
                    type="button"
                    className={botaoPerigo}
                    onClick={() =>
                      setConfirmacao({
                        pergunta: tc.apagarConfirma,
                        sim: tc.apagar,
                        fazer: () =>
                          void apagarNota(eu, n.id)
                            .then(() => ler())
                            .catch(() => setErro(tc.erro)),
                      })
                    }
                  >
                    {tc.apagar}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Confirmar pedido={confirmacao} nao={t.confirmar.nao} aoFechar={() => setConfirmacao(null)} />
    </section>
  );
}
