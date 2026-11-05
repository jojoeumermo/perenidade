// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { LoaderCircle, Search, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { rpc } from "@/lib/backend";
import { Botao, Selo } from "./ui";

export interface PessoaAchada {
  id: string;
  nome: string;
  /** A segunda linha de cada resultado. Onde a lista não tem e-mail (colegas da equipe), vai a função da pessoa. */
  email: string;
  suspenso?: boolean;
  /** O nível na hierarquia de cargos, quando a busca é para confiar função. */
  nivel?: number;
}

/**
 * Campo de busca de pessoa: digita-se o nome ou o e-mail e o banco devolve só quem corresponde (no máximo vinte).
 * Substitui a lista com todo mundo, que não aguenta milhares de contas. Setas escolhem, Enter confirma, Esc fecha.
 * "reserva" é a lista já carregada na tela: serve de busca local se o serviço ainda não tiver a função de busca.
 * "entre" troca a busca no banco por uma busca só dentro da lista dada (os colegas da equipe, quem pode assinar…):
 * aí o campo já abre mostrando os primeiros nomes e afina conforme a pessoa digita.
 * Desenho do painel: campo com a lupa (gira enquanto procura) e a lista no jeito do MenuSuspenso.
 */
export function BuscaDePessoa({
  escolhida,
  escolher,
  reserva = [],
  entre,
  rotulo,
}: {
  escolhida: PessoaAchada | null;
  escolher: (pessoa: PessoaAchada | null) => void;
  reserva?: PessoaAchada[];
  entre?: PessoaAchada[];
  rotulo?: string;
}) {
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
  const local = entre !== undefined;
  useEffect(() => {
    if (local || termo.length < 2) return;
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
  }, [termo, local]);

  const alvo = termo.toLowerCase();
  const lista = local ? entre.filter((pessoa) => `${pessoa.nome} ${pessoa.email}`.toLowerCase().includes(alvo)).slice(0, 20) : termo.length < 2 ? [] : (achadas ?? []);
  const mostra = aberta && (local || termo.length >= 2);

  function confirmar(pessoa: PessoaAchada) {
    escolher(pessoa);
    setTexto("");
    setAchadas(null);
    setAberta(false);
  }

  if (escolhida) {
    return (
      <div className="pn-campo mt-1 flex items-center justify-between gap-3">
        <UserRound aria-hidden className="h-4 w-4 shrink-0 text-ink-soft" />
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{escolhida.nome}</strong>
          <span className="pn-rotulo-mono block truncate normal-case tracking-normal">{escolhida.email}</span>
        </span>
        <Botao variante="discreto" pequeno className="shrink-0" onClick={() => escolher(null)}>
          Trocar
        </Botao>
      </div>
    );
  }

  return (
    <div className="pn-campo-com-simbolo relative mt-1">
      {buscando ? <LoaderCircle aria-hidden className="pn-girando" /> : <Search aria-hidden />}
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
        aria-label={rotulo}
        placeholder={local ? "Digite o nome para procurar" : "Digite o nome ou o e-mail"}
        className="pn-campo"
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
        <ul id={`${id}-lista`} role="listbox" aria-label={rotulo} className="pn-menu-suspenso absolute top-full right-0 left-0 z-20 mt-1 max-h-48 max-w-none">
          {lista.map((pessoa, i) => (
            <li
              key={pessoa.id}
              id={`${id}-${pessoa.id}`}
              role="option"
              aria-selected={i === ativa}
              className="pn-menu-suspenso-item cursor-pointer"
              // O destaque do item ativo é o mesmo do MenuSuspenso (data-highlighted pinta o fundo com --pn-ativo).
              data-highlighted={i === ativa ? "" : undefined}
              onMouseEnter={() => setAtiva(i)}
              // mousedown, não click: o clique chegaria depois de o campo perder o foco e a lista fechar.
              onMouseDown={(e) => {
                e.preventDefault();
                confirmar(pessoa);
              }}
            >
              {/* Um só filho em bloco: o item do menu é flex, e o nome e o e-mail ficam um embaixo do outro. */}
              <span className="min-w-0">
                <strong className="block truncate">
                  {pessoa.nome} {pessoa.suspenso && <Selo tom="erro">(suspensa)</Selo>}
                </strong>
                <span className="pn-ajuda block truncate font-mono">{pessoa.email}</span>
              </span>
            </li>
          ))}
          {lista.length === 0 && <li className="pn-ajuda px-3 py-2">{local ? "Ninguém com esse nome nesta lista." : buscando || achadas === null ? "Procurando…" : "Ninguém com esse nome ou e-mail. A pessoa precisa ter entrado no site pelo menos uma vez."}</li>}
          {lista.length === 20 && <li className="pn-ajuda border-t border-rule px-3 py-2">Mostrando os vinte primeiros. Digite mais para afinar a busca.</li>}
        </ul>
      )}
    </div>
  );
}
