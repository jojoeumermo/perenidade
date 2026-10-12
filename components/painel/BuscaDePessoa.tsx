// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { rpc } from "@/lib/backend";
import { campo } from "./comum";

export interface PessoaAchada {
  id: string;
  nome: string;
  email: string;
  suspenso?: boolean;
}

/**
 * Campo de busca de pessoa: digita-se o nome ou o e-mail e o banco devolve só quem corresponde (no máximo vinte).
 * Substitui a lista com todo mundo, que não aguenta milhares de contas. Setas escolhem, Enter confirma, Esc fecha.
 * "reserva" é a lista já carregada na tela: serve de busca local se o serviço ainda não tiver a função de busca.
 */
export function BuscaDePessoa({ escolhida, escolher, reserva = [] }: { escolhida: PessoaAchada | null; escolher: (pessoa: PessoaAchada | null) => void; reserva?: PessoaAchada[] }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [achadas, setAchadas] = useState<PessoaAchada[] | null>(null);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const reservaAtual = useRef(reserva);
  useEffect(() => {
    reservaAtual.current = reserva;
  }, [reserva]);

  const termo = texto.trim();
  useEffect(() => {
    if (termo.length < 2) return;
    let cancelada = false;
    // Espera a pessoa parar de digitar: uma consulta por pausa, não uma por letra.
    const relogio = window.setTimeout(() => {
      setBuscando(true);
      rpc<PessoaAchada[]>("pessoas_buscar", { p_busca: termo })
        .catch(() => {
          const alvo = termo.toLowerCase();
          return reservaAtual.current.filter((pessoa) => `${pessoa.nome} ${pessoa.email}`.toLowerCase().includes(alvo)).slice(0, 20);
        })
        .then((lista) => {
          if (cancelada) return;
          setAchadas(lista);
          setAtiva(0);
          setBuscando(false);
        });
    }, 250);
    return () => {
      cancelada = true;
      window.clearTimeout(relogio);
    };
  }, [termo]);

  const lista = termo.length < 2 ? [] : (achadas ?? []);
  const mostra = aberta && termo.length >= 2;

  function confirmar(pessoa: PessoaAchada) {
    escolher(pessoa);
    setTexto("");
    setAchadas(null);
    setAberta(false);
  }

  if (escolhida) {
    return (
      <div className={`${campo} flex items-center justify-between gap-3`}>
        <span className="min-w-0">
          <strong className="block truncate">{escolhida.nome}</strong>
          <span className="block truncate font-mono text-xs text-ink-soft">{escolhida.email}</span>
        </span>
        <button type="button" className="shrink-0 cursor-pointer underline hover:text-oxblood" onClick={() => escolher(null)}>
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        role="combobox"
        aria-expanded={mostra}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={mostra && lista[ativa] ? `${id}-${lista[ativa].id}` : undefined}
        autoComplete="off"
        value={texto}
        maxLength={120}
        placeholder="Digite o nome ou o e-mail"
        className={campo}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberta(true);
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => window.setTimeout(() => setAberta(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAberta(true);
            setAtiva((n) => Math.min(n + 1, Math.max(lista.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtiva((n) => Math.max(n - 1, 0));
          } else if (e.key === "Enter" && mostra && lista[ativa]) {
            e.preventDefault();
            confirmar(lista[ativa]);
          } else if (e.key === "Escape") {
            setAberta(false);
          }
        }}
      />
      {mostra && (
        <ul id={`${id}-lista`} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto border-2 border-ink bg-parchment shadow-lg">
          {lista.map((pessoa, i) => (
            <li
              key={pessoa.id}
              id={`${id}-${pessoa.id}`}
              role="option"
              aria-selected={i === ativa}
              className={`cursor-pointer px-3 py-2 ${i === ativa ? "bg-parchment-deep" : ""}`}
              onMouseEnter={() => setAtiva(i)}
              // mousedown, não click: o clique chegaria depois de o campo perder o foco e a lista fechar.
              onMouseDown={(e) => {
                e.preventDefault();
                confirmar(pessoa);
              }}
            >
              <strong className="block truncate">
                {pessoa.nome} {pessoa.suspenso && <span className="font-normal text-oxblood">(suspensa)</span>}
              </strong>
              <span className="block truncate font-mono text-xs text-ink-soft">{pessoa.email}</span>
            </li>
          ))}
          {lista.length === 0 && <li className="px-3 py-2 text-ink-soft">{buscando || achadas === null ? "Procurando…" : "Ninguém com esse nome ou e-mail. A pessoa precisa ter entrado no site pelo menos uma vez."}</li>}
          {lista.length === 20 && <li className="border-t border-rule px-3 py-2 text-xs text-ink-soft">Mostrando os vinte primeiros. Digite mais para afinar a busca.</li>}
        </ul>
      )}
    </div>
  );
}
