// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useRef, useState } from "react";
import { conversa } from "@/lib/rede/cliente-conversa";
import type { TextosDaConversa } from "@/lib/rede/textos-conversa";
import { inserirMencao, mencaoEmDigitacao, type SugestaoDeMencao } from "@/lib/rede/tipos-conversa";

/** Quanto se espera depois da última tecla antes de perguntar ao banco (para não perguntar a cada letra). */
const ESPERA_MS = 220;

/**
 * Uma caixa de texto que sugere pessoas quando se digita @. Escolher uma sugestão (toque, Enter ou Tab) troca o que foi
 * digitado por @nome e um espaço. As sugestões vêm do banco (rede_conv_sugerir): só gente da Rede, nunca perfil invisível nem quem
 * bloqueou ou foi bloqueado, e, com `postId`, só quem poderia ver a conversa. Lista acessível (combobox + listbox), com setas.
 * Reaproveitável por qualquer campo da Rede (a caixa de Escrever pode trocar o <textarea> por este).
 */
export function CampoComMencoes({
  valor,
  aoMudar,
  t,
  rotulo,
  placeholder,
  maxLength,
  postId = null,
  className = "",
  linhas = 4,
  autoFocus = false,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  t: TextosDaConversa;
  rotulo: string;
  placeholder?: string;
  maxLength: number;
  postId?: string | null;
  className?: string;
  linhas?: number;
  autoFocus?: boolean;
}) {
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef(0);
  const [opcoes, setOpcoes] = useState<SugestaoDeMencao[]>([]);
  const [ativa, setAtiva] = useState(0);
  const [aberta, setAberta] = useState(false);
  const [vazia, setVazia] = useState(false);

  function fechar() {
    pedido.current++;
    if (espera.current) clearTimeout(espera.current);
    setAberta(false);
    setOpcoes([]);
    setVazia(false);
  }

  function pesquisar(texto: string, cursor: number) {
    const digitando = mencaoEmDigitacao(texto, cursor);
    if (!digitando) {
      fechar();
      return;
    }
    if (espera.current) clearTimeout(espera.current);
    const meu = ++pedido.current;
    espera.current = setTimeout(() => {
      conversa
        .sugerir(digitando.prefixo, postId)
        .then((lista) => {
          if (meu !== pedido.current) return;
          setOpcoes(lista);
          setVazia(lista.length === 0);
          setAtiva(0);
          setAberta(true);
        })
        .catch(() => {
          // Sem conta, sem Rede ou sem conexão: sem sugestão. Dá para digitar o @nome inteiro do mesmo jeito.
          if (meu === pedido.current) fechar();
        });
    }, ESPERA_MS);
  }

  function escolher(o: SugestaoDeMencao) {
    const el = area.current;
    const cursor = el?.selectionStart ?? valor.length;
    const novo = inserirMencao(valor, cursor, o.handle);
    fechar();
    if (!novo) return;
    aoMudar(novo.texto);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(novo.cursor, novo.cursor);
    });
  }

  function teclas(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!aberta || opcoes.length === 0) {
      if (e.key === "Escape" && aberta) {
        e.stopPropagation();
        fechar();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtiva((n) => (n + 1) % opcoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtiva((n) => (n - 1 + opcoes.length) % opcoes.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      escolher(opcoes[ativa] ?? opcoes[0]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      fechar();
    }
  }

  const lista = `${id}-lista`;
  return (
    <div className="relative">
      <textarea
        ref={area}
        aria-label={rotulo}
        aria-describedby={`${id}-dica`}
        aria-autocomplete="list"
        aria-controls={lista}
        aria-expanded={aberta && opcoes.length > 0}
        aria-activedescendant={aberta && opcoes.length > 0 ? `${id}-o${ativa}` : undefined}
        role="combobox"
        autoFocus={autoFocus}
        rows={linhas}
        maxLength={maxLength}
        placeholder={placeholder}
        value={valor}
        className={className}
        onChange={(e) => {
          aoMudar(e.target.value);
          pesquisar(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={teclas}
        onBlur={() => setTimeout(fechar, 150)}
      />
      <span id={`${id}-dica`} className="sr-only">
        {t.mencao.dica}
      </span>
      <ul
        id={lista}
        role="listbox"
        aria-label={t.mencao.lista}
        hidden={!aberta || (opcoes.length === 0 && !vazia)}
        className="absolute inset-x-0 z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-rule bg-parchment font-sans shadow-lg"
      >
        {opcoes.map((o, i) => (
          <li
            key={o.handle}
            id={`${id}-o${i}`}
            role="option"
            aria-selected={i === ativa}
            // onMouseDown em vez de onClick: o campo perde o foco antes do clique e fecharia a lista.
            onMouseDown={(e) => {
              e.preventDefault();
              escolher(o);
            }}
            className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-1.5 ${i === ativa ? "bg-parchment-deep" : ""}`}
          >
            <span className="font-bold">{o.codinome}</span>
            <span className="text-sm text-ink-soft">@{o.handle}</span>
            {o.equipe && <span className="rounded bg-ink px-1 text-[0.6rem] font-semibold uppercase tracking-wider text-parchment">{t.mencao.equipe}</span>}
          </li>
        ))}
        {opcoes.length === 0 && vazia && (
          <li role="option" aria-selected="false" aria-disabled className="px-3 py-2 text-sm text-ink-soft">
            {t.mencao.nenhuma}
          </li>
        )}
      </ul>
    </div>
  );
}
