// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { PropsDaTelaDoPacote } from "../registro";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import { gravarSilenciosLocais, lerSilenciosLocais, type SilencioLocal } from "@/lib/rede/silenciar-local";
import type { Silenciado } from "@/lib/rede/tipos-moderacao";
import { dataCurta, estilo, mensagemDeErro, useTextosMod } from "./base";

function armazem(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** "O que eu silenciei" (/comunidade/silenciados): a lista da conta (no servidor) e a deste aparelho; dá para desfazer e para silenciar uma palavra. */
export default function TelaSilenciados({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const sm = useTextosMod(lang);
  const [conta, setConta] = useState<Silenciado[] | null>(null);
  // A tela só roda no navegador (import dinâmico sem SSR): dá para ler o aparelho já no primeiro render.
  const [local, setLocal] = useState<SilencioLocal[]>(() => lerSilenciosLocais(armazem()));
  const [palavra, setPalavra] = useState("");
  const [soAparelho, setSoAparelho] = useState(false);
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    redeMod.silenciados().then((x) => vivo && setConta(x)).catch((e) => vivo && setErro(mensagemDeErro(s, null, e)));
    return () => {
      vivo = false;
    };
  }, [situacao.logado, rodada, s]);

  if (!situacao.logado) return <p className="px-[18px] py-8 font-sans text-ink-soft">{sm?.entreParaVer ?? s.estados.carregando}</p>;
  if (!sm || !conta) return erro ? <p role="alert" className="px-[18px] py-8 font-sans text-oxblood">{erro}</p> : <p className="px-[18px] py-8 font-sans" role="status">{s.estados.carregando}</p>;
  const tipos = sm.silenciados.tipo as Record<string, string>;

  async function desfazer(id: string) {
    setErro("");
    try {
      await redeMod.silenciarRemover(id);
      setRodada((n) => n + 1);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }
  function desfazerLocal(i: number) {
    const lista = local.filter((_, k) => k !== i);
    setLocal(lista);
    gravarSilenciosLocais(armazem(), lista);
  }
  async function adicionar() {
    const valor = palavra.trim();
    if (valor.length < 2) return;
    setErro("");
    try {
      if (soAparelho) {
        const lista = [...local.filter((x) => !(x.tipo === "palavra" && x.valor === valor)), { tipo: "palavra" as const, valor }];
        setLocal(lista);
        gravarSilenciosLocais(armazem(), lista);
      } else {
        await redeMod.silenciar("palavra", valor);
        setRodada((n) => n + 1);
      }
      setPalavra("");
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  return (
    <div className="font-sans">
      <h1 className="border-b border-rule px-[18px] py-3 font-serif text-2xl font-semibold">{sm.silenciados.titulo}</h1>
      <p className="px-[18px] py-3 text-sm text-ink-soft">{sm.silenciados.ajuda}</p>
      <div className="space-y-2 px-[18px] pb-3">
        <label className="block text-sm font-bold">
          {sm.silenciados.palavra}
          <input value={palavra} onChange={(e) => setPalavra(e.target.value)} maxLength={60} placeholder={sm.silenciados.palavraDica} className={`${estilo.campo} mt-1 font-normal`} />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={soAparelho} onChange={(e) => setSoAparelho(e.target.checked)} />
          {sm.silenciar.soAparelho}
        </label>
        <button type="button" disabled={palavra.trim().length < 2} className={estilo.botaoForte} onClick={() => void adicionar()}>{sm.silenciados.adicionar}</button>
      </div>
      {erro && <p role="alert" className="px-[18px] pb-2 text-sm text-oxblood">{erro}</p>}

      <h2 className="border-y border-rule bg-parchment-deep px-[18px] py-2 font-bold">{sm.silenciados.naConta}</h2>
      {conta.length === 0 ? (
        <p className="px-[18px] py-4 text-ink-soft">{sm.silenciados.vazio}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {conta.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-[18px] py-2">
              <span className="break-words">
                <span className="text-xs text-ink-soft">{tipos[c.tipo]}: </span>
                {c.rotulo}
                {c.ate && <span className="text-xs text-ink-soft"> · {preencher(sm.silenciados.ate, { data: dataCurta(c.ate, lang) })}</span>}
              </span>
              <button type="button" className={estilo.botao} onClick={() => void desfazer(c.id)}>{sm.silenciados.desfazer}</button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="border-y border-rule bg-parchment-deep px-[18px] py-2 font-bold">{sm.silenciados.noAparelho}</h2>
      {local.length === 0 ? (
        <p className="px-[18px] py-4 text-ink-soft">{sm.silenciados.vazio}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {local.map((c, i) => (
            <li key={`${c.tipo}:${c.valor}`} className="flex items-center justify-between gap-2 px-[18px] py-2">
              <span className="break-words"><span className="text-xs text-ink-soft">{tipos[c.tipo]}: </span>{c.valor}</span>
              <button type="button" className={estilo.botao} onClick={() => desfazerLocal(i)}>{sm.silenciados.desfazer}</button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-[18px] py-3 text-xs text-ink-soft">{sm.silenciados.limpar}</p>
    </div>
  );
}
