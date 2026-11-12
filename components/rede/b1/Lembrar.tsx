// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { b1 } from "@/lib/rede/cliente-b1";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { horasDoLembrete } from "@/lib/rede/tipos-b1";
import { previa } from "../conversa/base3";
import { erroDaB1, quandoCurto, useTextosB1 } from "./base";

/** O valor de um <input type="datetime-local"> no horário do aparelho. */
function paraCampo(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

/**
 * "Lembrar mais tarde" (Onda B, rede_lembretes): um aviso privado do tipo 'lembrete' na hora escolhida. Só a pessoa sabe; se o
 * post for apagado ou sair do alcance dela, o lembrete some. O botão abre um painel (disclosure) com as horas prontas e o campo
 * de dia e hora; Escape fecha e devolve o foco.
 */
export function LembrarMaisTarde({ post, lang, s, aoAvisar }: { post: string; lang: string; s: TextosDaRede; aoAvisar: (texto: string, erro?: boolean) => void }) {
  const t = useTextosB1(lang);
  const [aberto, setAberto] = useState(false);
  // Os limites do campo "outro horário" (de 6 minutos a 89 dias), medidos na hora em que a pessoa abre a caixa.
  const [limites, setLimites] = useState<{ min: string; max: string } | null>(null);
  const [marcado, setMarcado] = useState<string | null>(null);
  const [existe, setExiste] = useState(previa());
  const [outro, setOutro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previa()) return;
    let vivo = true;
    b1.lembretes(post)
      .then((r) => {
        if (!vivo) return;
        setExiste(true);
        setMarcado(r.itens[0]?.quando ?? null);
      })
      // Banco sem a B1 ou sem conta: o botão não aparece (a conversa já mostra o motivo de um limite ou de conta suspensa).
      .catch(() => vivo && setExiste(false));
    return () => {
      vivo = false;
    };
  }, [post]);

  useEffect(() => {
    if (!aberto) return;
    painel.current?.querySelector<HTMLElement>("button")?.focus();
  }, [aberto]);

  if (!t || !existe) return null;
  const l = t.lembrar;

  async function marcar(quando: Date | null) {
    if (!t) return;
    setOcupado(true);
    try {
      const iso = quando ? quando.toISOString() : null;
      if (!previa()) await b1.lembrar(post, iso);
      setMarcado(iso);
      aoAvisar(iso ? preencher(l.marcado, { quando: quandoCurto(lang, iso) }) : l.tirado);
      setAberto(false);
      botao.current?.focus();
    } catch (e) {
      aoAvisar(erroDaB1(s, t, e), true);
    } finally {
      setOcupado(false);
    }
  }

  const opcoes = horasDoLembrete(new Date());
  return (
    <div className="relative">
      <button
        ref={botao}
        type="button"
        className="al3-sino"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={marcado ? preencher(l.ja, { quando: quandoCurto(lang, marcado) }) : l.acao}
        title={marcado ? preencher(l.ja, { quando: quandoCurto(lang, marcado) }) : l.acao}
        onClick={() => {
          const agora = Date.now();
          setLimites({ min: paraCampo(new Date(agora + 6 * 60e3)), max: paraCampo(new Date(agora + 89 * 86400e3)) });
          setAberto((a) => !a);
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill={marcado ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="13" r="8" fill="none" />
          <path d="M12 9v4l2.5 2M5 4 2.5 6.5M19 4l2.5 2.5" />
          {marcado && <circle cx="12" cy="13" r="2" />}
        </svg>
      </button>
      {aberto && (
        <div
          ref={painel}
          id={id}
          role="group"
          aria-label={l.titulo}
          className="b1-painel absolute right-0 z-20 w-72 max-w-[calc(100vw-32px)]"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setAberto(false);
              botao.current?.focus();
            }
          }}
        >
          <p className="font-bold">{l.titulo}</p>
          <div className="mt-2 grid gap-2">
            {opcoes.map((o) => (
              <button key={o.chave} type="button" className="b1-botao" disabled={ocupado} onClick={() => void marcar(o.quando)}>
                {l[o.chave]}
              </button>
            ))}
          </div>
          <label className="b1-rotulo" htmlFor={`${id}-outro`}>{l.outro}</label>
          <div className="flex gap-2">
            <input
              id={`${id}-outro`}
              className="b1-campo"
              type="datetime-local"
              value={outro}
              min={limites?.min}
              max={limites?.max}
              onChange={(e) => setOutro(e.target.value)}
            />
            <button type="button" className="b1-botao" disabled={ocupado || !outro} onClick={() => void marcar(new Date(outro))}>
              {l.marcar}
            </button>
          </div>
          {marcado && (
            <button type="button" className="b1-link mt-1" disabled={ocupado} onClick={() => void marcar(null)}>
              {l.tirar}
            </button>
          )}
          <p className="b1-cinza mt-2">{l.regra}</p>
        </div>
      )}
    </div>
  );
}
