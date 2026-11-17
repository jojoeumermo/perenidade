// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { slugOk } from "@/lib/rede/tipos";
import type { EscopoDeModeracao, ItemDeLista } from "@/lib/rede/tipos-moderacao";
import { estilo, mensagemDeErro } from "./base";

/**
 * As listas de bloqueio da mediação: de pessoa (comunidade e núcleo) e de palavra (só núcleo). O modo lento e as palavras de uma
 * comunidade ficam num lugar só, a aba Comunidades (FerramentasDaComunidade), para quem modera não ter dois ajustes do mesmo.
 */
export function Lugares({ s, sm, escopo }: { s: TextosDaRede; sm: TextosDaModeracao; escopo: EscopoDeModeracao }) {
  const opcoes = [
    ...escopo.comunidades.map((c) => ({ tipo: "comunidade" as const, valor: c, rotulo: escopo.nomes?.[c] ?? c })),
    ...escopo.nucleos.map((n) => ({ tipo: "nucleo" as const, valor: n.id, rotulo: `${sm.lugares.nucleo}: ${n.nome}` })),
  ];
  const [chave, setChave] = useState(opcoes[0] ? `${opcoes[0].tipo}:${opcoes[0].valor}` : "");
  const [outra, setOutra] = useState("");
  const [lista, setLista] = useState<ItemDeLista[] | null>(null);
  const [tipo, setTipo] = useState<"palavra" | "pessoa">("palavra");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [rodada, setRodada] = useState(0);

  const corte = chave.indexOf(":");
  const [escopoTipo, escopoValor]: ["comunidade" | "nucleo", string] = outra && slugOk(outra) ? ["comunidade", outra] : [chave.slice(0, Math.max(corte, 0)) === "nucleo" ? "nucleo" : "comunidade", corte >= 0 ? chave.slice(corte + 1) : ""];
  const tipoDaLista: "palavra" | "pessoa" = escopoTipo === "comunidade" ? "pessoa" : tipo;

  useEffect(() => {
    if (!escopoValor) return;
    let vivo = true;
    redeMod.lista(escopoTipo, escopoValor).then((x) => vivo && (setLista(x), setErro(""))).catch((e) => vivo && (setLista([]), setErro(mensagemDeErro(s, sm, e))));
    return () => {
      vivo = false;
    };
  }, [escopoTipo, escopoValor, rodada, s, sm]);

  const adicionar = useCallback(async () => {
    setErro("");
    setAviso("");
    try {
      await redeMod.listaAdicionar(escopoTipo, escopoValor, tipoDaLista, valor.trim(), motivo.trim());
      setValor("");
      setMotivo("");
      setAviso(sm.lugares.feito);
      setRodada((n) => n + 1);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }, [escopoTipo, escopoValor, tipoDaLista, valor, motivo, s, sm]);

  async function remover(id: string) {
    setErro("");
    try {
      await redeMod.listaRemover(id);
      setRodada((n) => n + 1);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  return (
    <div className="space-y-4 px-[18px] py-4 font-sans">
      <h2 className="font-serif text-xl font-semibold">{sm.lugares.titulo}</h2>
      {opcoes.length > 0 && (
        <label className="block text-sm">
          {sm.lugares.escolha}
          <select value={chave} onChange={(e) => { setChave(e.target.value); setOutra(""); setLista(null); }} className={`${estilo.campo} mt-1`}>
            {opcoes.map((o) => <option key={`${o.tipo}:${o.valor}`} value={`${o.tipo}:${o.valor}`}>{o.rotulo}</option>)}
          </select>
        </label>
      )}
      {escopo.cuida && (
        <label className="block text-sm">
          {sm.lugares.outraComunidade}
          <input value={outra} onChange={(e) => setOutra(e.target.value.toLowerCase())} maxLength={60} className={`${estilo.campo} mt-1`} />
        </label>
      )}
      {!escopoValor ? (
        <p className="text-ink-soft">{sm.nenhum}</p>
      ) : (
        <>
          <div className={`${estilo.caixa} space-y-2`}>
            <p className="font-bold">{sm.lugares.lista}</p>
            <p className="text-xs text-ink-soft">{escopoTipo === "comunidade" ? sm.lugares.listaAjudaComunidade : sm.lugares.listaAjuda}</p>
            {/* Numa comunidade, as palavras ficam no Filtro automático (aba Comunidades), com o modo lento: um ajuste num lugar só. */}
            {escopoTipo === "comunidade" && <p className="text-xs text-ink-soft">{sm.lugares.palavrasNoFiltro}</p>}
            {escopoTipo === "nucleo" && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={sm.lugares.lista}>
                {(["palavra", "pessoa"] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={tipoDaLista === t} onClick={() => setTipo(t)} className="al-botao al-botao-contorno al-botao-p">
                    {sm.lugares[t]}
                  </button>
                ))}
              </div>
            )}
            <label className="block text-sm">
              {sm.lugares[tipoDaLista]}
              <input value={valor} onChange={(e) => setValor(e.target.value)} maxLength={60} placeholder={tipoDaLista === "pessoa" ? sm.lugares.exemploPessoa : sm.lugares.exemploPalavra} className={`${estilo.campo} mt-1`} />
            </label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} aria-label={sm.lugares.motivo} placeholder={sm.lugares.motivo} className={estilo.campo} />
            <button type="button" disabled={valor.trim().length < 2} className={estilo.botaoForte} onClick={() => void adicionar()}>{sm.lugares.adicionar}</button>
            {!lista ? (
              <p role="status" className="text-sm">{sm.carregando}</p>
            ) : lista.length === 0 ? (
              <p className="text-sm text-ink-soft">{sm.lugares.vazia}</p>
            ) : (
              <ul className="divide-y divide-rule">
                {lista.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="break-words">
                      <span className="text-xs text-ink-soft">{sm.lugares[i.tipo]}: </span>
                      {i.palavra ?? i.pessoa}
                      {i.motivo && <span className="text-xs text-ink-soft"> · {i.motivo}</span>}
                    </span>
                    <button type="button" className={estilo.botao} onClick={() => void remover(i.id)}>{sm.remover}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {aviso && <p role="status" className="text-sm font-bold">{aviso}</p>}
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
    </div>
  );
}
