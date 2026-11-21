// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O freio de encaminhamento (Prompt 4, item 14, atrás de "alumia-p4-conversa"): escolher para quais conversas abertas encaminhar
// um texto. A contagem vai dentro do cifrado (lib/rede/chat/encaminhar.ts); o que já foi encaminhado muitas vezes só vai para uma
// conversa por vez. A lista de conversas é a deste aparelho (nada é buscado no servidor para montar esta janela).
// Alvos de toque de 44 px; sem animação.
import { useEffect, useId, useRef, useState } from "react";
import type { ConversaDoChat } from "@/lib/rede/cliente-chat";
import { destinosPermitidos, marcaDeEncaminhada } from "@/lib/rede/chat/encaminhar";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaConversaP4 } from "@/lib/rede/textos-p4-conversa";
import { botaoForte, botaoLeve } from "./comum";

type T = TextosDaConversaP4["encaminhar"];

/** A marca da mensagem encaminhada, dentro da bolha. */
export function MarcaDeEncaminhada({ t, contagem }: { t: T; contagem: number | undefined }) {
  const marca = marcaDeEncaminhada(contagem);
  if (!marca) return null;
  return (
    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold italic opacity-80" data-encaminhada={marca}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 5l7 7-7 7M21 12H9a6 6 0 0 0-6 6" />
        {marca === "muitas" && <path d="M10 5l7 7" />}
      </svg>
      {marca === "muitas" ? t.muitas : t.marca}
    </p>
  );
}

export function Encaminhar({ t, conversas, contagem, aoEncaminhar, aoFechar }: {
  t: T;
  /** As outras conversas abertas deste aparelho (sem a de agora). */
  conversas: readonly ConversaDoChat[];
  /** A contagem que o texto já traz. */
  contagem: number | undefined;
  aoEncaminhar: (ids: string[]) => Promise<void>;
  aoFechar: () => void;
}) {
  const id = useId();
  const maximo = destinosPermitidos(contagem);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState("");
  // A janela abre no alto da conversa: vem para a vista (abaixo do cabeçalho fixo), sem animação, e o foco vai para o título.
  const caixa = useRef<HTMLElement>(null);
  useEffect(() => {
    caixa.current?.scrollIntoView({ block: "start" });
    caixa.current?.querySelector("h2")?.focus();
  }, []);

  function marcar(c: string, sim: boolean) {
    setRecado("");
    setEscolhidas((atual) => {
      if (!sim) return atual.filter((x) => x !== c);
      // Uma por vez: escolher outra troca a escolha (o freio do que já foi encaminhado muitas vezes).
      if (maximo === 1) return [c];
      return atual.length >= maximo ? atual : [...atual, c];
    });
  }

  async function mandar() {
    if (!escolhidas.length || ocupado) return;
    setOcupado(true);
    setRecado("");
    try {
      await aoEncaminhar(escolhidas);
      aoFechar();
    } catch {
      setRecado(t.erro);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section ref={caixa} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 border-b border-rule bg-parchment-deep px-[18px] py-4 text-sm" data-encaminhar>
      <h2 id={`${id}-titulo`} tabIndex={-1} className="font-semibold">{t.titulo}</h2>
      <p className="mt-1 text-xs text-ink-soft">{t.explica}</p>
      <p className="mt-1 text-xs font-semibold" role="note">{maximo === 1 ? t.limite : preencher(t.ate, { n: maximo })}</p>
      {conversas.length === 0 ? (
        <p className="mt-3 text-ink-soft">{t.nenhuma}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {conversas.map((c) => (
            <li key={c.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type={maximo === 1 ? "radio" : "checkbox"}
                  name={`${id}-destino`}
                  className="h-5 w-5 shrink-0"
                  checked={escolhidas.includes(c.id)}
                  disabled={maximo > 1 && !escolhidas.includes(c.id) && escolhidas.length >= maximo}
                  onChange={(e) => marcar(c.id, e.target.checked)}
                />
                <span className="min-w-0 truncate">{c.com.codinome}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {recado && <p role="alert" className="mt-2 font-semibold text-oxblood">{recado}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={botaoForte} disabled={!escolhidas.length || ocupado} onClick={() => void mandar()}>{t.enviar}</button>
        <button type="button" className={botaoLeve} onClick={aoFechar}>{t.cancelar}</button>
      </div>
    </section>
  );
}
