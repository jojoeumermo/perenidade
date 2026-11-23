// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { b1 } from "@/lib/rede/cliente-b1";
import { preencher } from "@/lib/rede/preencher";
import { faltaFuncaoNoBanco } from "@/lib/rede/reserva";
import type { TextosDoAcabamento } from "@/lib/rede/textos-acabamento";
import type { TextosDaB1 } from "@/lib/rede/textos-b1";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { BuscaSalva } from "@/lib/rede/tipos-b1";
import { enderecosDescoberta } from "@/lib/rede/tipos-descoberta";
import { erroDaB1 } from "../b1/base";
import { previa, type useTorrada } from "../conversa/base3";
import { Icone } from "../publicar/alumia2/icones";
import { Botao } from "../ui/Botao";

/** As buscas salvas de exemplo da prévia: vivem só na memória da página. */
let dePrevia: BuscaSalva[] | null = null;
const fonte = {
  async listar(): Promise<BuscaSalva[]> {
    if (!previa()) return (await b1.buscasSalvas()).itens ?? [];
    dePrevia ??= [
      { id: "previa-1", nome: "Tarifa em SP", q: "tarifa c:passe-livre-sp" },
      { id: "previa-2", nome: "Dúvidas de mais-valia", q: "mais-valia tipo:duvida" },
    ];
    return dePrevia;
  },
  async salvar(nome: string, q: string): Promise<BuscaSalva> {
    if (!previa()) return b1.salvarBusca(nome, q);
    const nova = { id: `previa-${Date.now()}`, nome, q };
    dePrevia = [...(dePrevia ?? []).filter((x) => x.q !== q), nova];
    return nova;
  },
  async apagar(id: string): Promise<void> {
    if (!previa()) return void (await b1.apagarBusca(id));
    dePrevia = (dePrevia ?? []).filter((x) => x.id !== id);
  },
};

/**
 * As buscas salvas da pessoa (rede_alumia_buscas_salvas), na tela da busca: uma ficha por busca (tocar refaz a busca), o "x" de
 * apagar em cada uma e, com uma busca na tela, o "Salvar esta busca" (pede só um nome). A lista é só dela e cabem 20. Visitante
 * e banco sem a B1 não veem nada disto; se a lista não carregar, a busca continua funcionando e a tela diz só isso.
 */
export function BuscasSalvas({ lang, q, membro, s, tb, t, torradas }: {
  lang: string;
  /** A busca que está na tela (vazia = nenhuma). */
  q: string;
  membro: boolean;
  s: Pick<TextosDaRede, "erros" | "estados">;
  tb: TextosDaB1;
  t: TextosDoAcabamento;
  torradas: ReturnType<typeof useTorrada>;
}) {
  const [itens, setItens] = useState<BuscaSalva[] | null>(null);
  const [fase, setFase] = useState<"carregando" | "ok" | "sem" | "erro">("carregando");
  const [vez, setVez] = useState(0);
  const [nomeando, setNomeando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (!membro) return;
    let vivo = true;
    fonte.listar().then(
      (lista) => {
        if (!vivo) return;
        setItens(lista);
        setFase("ok");
      },
      (e) => vivo && setFase(faltaFuncaoNoBanco(e) ? "sem" : "erro"),
    );
    return () => {
      vivo = false;
    };
  }, [membro, vez]);
  useEffect(() => {
    if (nomeando !== null) campo.current?.select();
    // Só ao abrir o campo (não a cada letra).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomeando !== null]);

  if (!membro || fase === "sem") return null;
  if (fase === "carregando") return null;
  if (fase === "erro") {
    return (
      <p role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-[var(--al-texto-2)]">
        {s.estados.erro}
        <button type="button" className="min-h-11 cursor-pointer font-bold underline" onClick={() => { setFase("carregando"); setVez((n) => n + 1); }}>{t.buscas.tentar}</button>
      </p>
    );
  }
  const lista = itens ?? [];
  const jaSalva = q.length >= 2 && lista.some((x) => x.q === q);
  const b = tb.busca;

  function salvar(nome: string) {
    const limpo = nome.trim().slice(0, 40);
    if (!limpo || ocupado) return;
    setOcupado(true);
    fonte
      .salvar(limpo, q)
      .then((nova) => {
        setItens((atual) => [...(atual ?? []).filter((x) => x.id !== nova.id && x.q !== nova.q), nova]);
        setNomeando(null);
        torradas.mostrar({ texto: b.salva });
      })
      .catch((e) => torradas.mostrar({ texto: erroDaB1(s, tb, e), erro: true }))
      .finally(() => setOcupado(false));
  }
  function apagar(x: BuscaSalva) {
    setItens((atual) => (atual ?? []).filter((y) => y.id !== x.id));
    fonte.apagar(x.id).then(
      () => torradas.mostrar({ texto: b.apagada }),
      (e) => {
        setItens((atual) => [...(atual ?? []), x]);
        torradas.mostrar({ texto: erroDaB1(s, tb, e), erro: true });
      },
    );
  }

  if (lista.length === 0 && q.length < 2) return null;
  return (
    <section aria-labelledby={`${id}-titulo`} className="mt-4">
      <h2 id={`${id}-titulo`} className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--al-texto-3)]">{b.salvas}</h2>
      <ul className="ac-fichas mt-2">
        {lista.map((x) => (
          <li key={x.id} className="inline-flex items-center">
            <Link href={`${enderecosDescoberta.buscar(lang)}?q=${encodeURIComponent(x.q)}`} className="ac-ficha !rounded-r-none !border-r-0 !pr-2" aria-current={x.q === q ? "true" : undefined} aria-label={preencher(t.buscas.refazer, { nome: x.nome })} title={x.q}>
              <Icone nome="lupa" />
              <span className="max-w-[12rem] truncate">{x.nome}</span>
            </Link>
            <button type="button" className="ac-ficha !rounded-l-none min-w-11 !px-2.5" aria-label={preencher(b.apagarSalva, { nome: x.nome })} title={preencher(b.apagarSalva, { nome: x.nome })} onClick={() => apagar(x)}>
              <Icone nome="fechar" />
            </button>
          </li>
        ))}
        {q.length >= 2 && nomeando === null && (
          <li>
            {jaSalva ? (
              <span className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-[var(--al-texto-3)]">
                <Icone nome="visto" className="h-4 w-4" grosso />
                {t.buscas.jaSalva}
              </span>
            ) : (
              <button type="button" className="ac-ficha ac-ficha-nova" onClick={() => setNomeando(q.slice(0, 40))}>
                <Icone nome="marcador" />
                {b.salvar}
              </button>
            )}
          </li>
        )}
      </ul>
      {nomeando !== null && (
        <form
          className="ac-form mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            salvar(nomeando);
          }}
        >
          <label className="sr-only" htmlFor={`${id}-nome`}>{b.nomeRotulo}</label>
          <input ref={campo} id={`${id}-nome`} className="ac-campo" value={nomeando} onChange={(e) => setNomeando(e.target.value)} maxLength={40} placeholder={b.nomeRotulo} autoComplete="off" enterKeyHint="done" autoFocus />
          <Botao type="submit" variante="primario" tamanho="p" disabled={!nomeando.trim() || ocupado}>{b.salvar}</Botao>
          <Botao variante="fantasma" tamanho="p" onClick={() => setNomeando(null)}>{t.pastas.cancelar}</Botao>
          <p className="ac-dica !mt-0 w-full">{t.buscas.salvarDica}</p>
        </form>
      )}
    </section>
  );
}
